#!/usr/bin/env node
'use strict';

/**
 * Convert legacy image path fields into data:image/... base64 strings.
 *
 * Run this on the machine that still has the image files available. For a
 * deployed Ubuntu server, use IMAGE_UPLOAD_DIR to point at the copied image
 * archive before running it.
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ override: true });
const imageStorage = require('../../src/shared/image-storage');
const { initDatabase, getPostgresData, savePostgresRecord, closeDatabase } = require('../../src/main/database');

const IMAGE_FIELDS = [
  'photoDataUrl',
  'signatureDataUrl',
  'handwrittenEntryDataUrl',
  'leftThumbMarkDataUrl',
  'rightThumbMarkDataUrl',
];

const DRY_RUN = process.argv.includes('--dry-run') ||
  /^(1|true|yes)$/i.test(String(process.env.DRY_RUN || ''));

function defaultImageDir() {
  if (process.env.IMAGE_UPLOAD_DIR) return process.env.IMAGE_UPLOAD_DIR;
  if (process.env.APPDATA) {
    return path.join(process.env.APPDATA, 'apollo-personnel-db', 'personnel-images');
  }
  return path.join(process.cwd(), 'personnel-images');
}

function isDataImage(value) {
  return /^data:image\/[^,]+,/i.test(String(value || ''));
}

function countLegacyImageFields(record) {
  return IMAGE_FIELDS.reduce(function (count, field) {
    const value = record && record[field];
    if (!value || isDataImage(value)) return count;
    return count + 1;
  }, 0);
}

function countHydratedImageFields(record) {
  return IMAGE_FIELDS.reduce(function (count, field) {
    return count + (isDataImage(record && record[field]) ? 1 : 0);
  }, 0);
}

function getLegacyImageFields(record) {
  return IMAGE_FIELDS.filter(function (field) {
    const value = record && record[field];
    return value && !isDataImage(value);
  });
}

function describeRecord(record) {
  const id = record && record.id ? String(record.id) : '(no id)';
  const name = [record && record.nameLast, record && record.nameFirst, record && record.nameMiddle]
    .map(function (value) { return String(value || '').trim(); })
    .filter(Boolean)
    .join(', ');
  return name ? `${id} ${name}` : id;
}

async function migratePostgres(imageDir) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return null;

  initDatabase(databaseUrl, path.join(process.cwd(), 'personnel-data.json'));
  const records = await getPostgresData();
  let scanned = 0;
  let updated = 0;
  let unresolved = 0;
  const unresolvedDetails = [];

  for (const record of records) {
    scanned++;
    const legacyBefore = countLegacyImageFields(record);
    if (!legacyBefore) continue;

    const hydrated = imageStorage.hydrateRecordImages(imageDir, record, { preserveUnresolved: true });
    const hydratedCount = countHydratedImageFields(hydrated);
    const legacyAfter = countLegacyImageFields(hydrated);

    if (hydratedCount > countHydratedImageFields(record)) {
      if (!DRY_RUN) {
        await savePostgresRecord(hydrated, null);
      }
      updated++;
    }
    if (legacyAfter || hydratedCount === 0) {
      unresolved++;
      unresolvedDetails.push({
        record: describeRecord(hydrated),
        fields: getLegacyImageFields(hydrated),
      });
    }
  }

  return { target: 'postgres', scanned, updated, unresolved, unresolvedDetails };
}

function migrateJson(imageDir) {
  const jsonPath = process.env.PERSONNEL_JSON ||
    path.join(process.env.APPDATA || process.cwd(), 'apollo-personnel-db', 'personnel-data.json');

  if (!fs.existsSync(jsonPath)) return null;

  const records = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  if (!Array.isArray(records)) throw new Error('Expected JSON personnel data to be an array.');

  let updated = 0;
  let unresolved = 0;
  const unresolvedDetails = [];
  const migrated = records.map(function (record) {
    const legacyBefore = countLegacyImageFields(record);
    if (!legacyBefore) return record;

    const hydrated = imageStorage.hydrateRecordImages(imageDir, record, { preserveUnresolved: true });
    if (countHydratedImageFields(hydrated) > countHydratedImageFields(record)) updated++;
    if (countLegacyImageFields(hydrated)) {
      unresolved++;
      unresolvedDetails.push({
        record: describeRecord(hydrated),
        fields: getLegacyImageFields(hydrated),
      });
    }
    return hydrated;
  });

  if (updated && !DRY_RUN) {
    fs.writeFileSync(jsonPath, JSON.stringify(migrated, null, 2), 'utf8');
  }

  return { target: 'json', path: jsonPath, scanned: records.length, updated, unresolved, unresolvedDetails };
}

async function main() {
  const imageDir = defaultImageDir();
  console.log('Image archive:', imageDir);
  if (DRY_RUN) console.log('Dry run: no database or JSON changes will be written.');

  const results = [];
  const pgResult = await migratePostgres(imageDir);
  if (pgResult) results.push(pgResult);

  const jsonResult = migrateJson(imageDir);
  if (jsonResult) results.push(jsonResult);

  if (!results.length) {
    console.log('No DATABASE_URL or personnel JSON file found. Nothing to migrate.');
    return;
  }

  results.forEach(function (result) {
    const location = result.path ? ' (' + result.path + ')' : '';
    console.log(
      `${result.target}${location}: scanned=${result.scanned}, updated=${result.updated}, unresolved=${result.unresolved}`
    );
    if (result.unresolvedDetails && result.unresolvedDetails.length) {
      result.unresolvedDetails.forEach(function (detail) {
        console.log(`  unresolved: ${detail.record} -> ${detail.fields.join(', ')}`);
      });
    }
  });
}

main().catch(function (error) {
  console.error('Migration failed:', error && error.message ? error.message : error);
  process.exit(1);
}).finally(async function () {
  await closeDatabase();
});