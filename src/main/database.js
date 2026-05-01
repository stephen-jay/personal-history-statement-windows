const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { REMOVED_FIELDS, PERSONNEL_FIELD_MAP, CHILD_TABLES } = require('../shared/schema');

let dataFile = null;

let pgPool = null;

function initDatabase(url, jsonPath) {
  dataFile = jsonPath;
  if (url && !pgPool) {
    pgPool = new Pool({ connectionString: url });
  }
}

function getPgPool() {
  return pgPool;
}

async function closeDatabase() {
  if (!pgPool) return;
  const pool = pgPool;
  pgPool = null;
  await pool.end();
}

function ensureDataFile() {
  try {
    if (!fs.existsSync(dataFile)) {
      fs.writeFileSync(dataFile, JSON.stringify([], null, 2), 'utf8');
      return true;
    }
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}

function getData() {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(dataFile, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function saveData(records) {
  ensureDataFile();
  fs.writeFileSync(dataFile, JSON.stringify(records, null, 2), 'utf8');
}

function sanitizeRecord(record) {
  return Object.fromEntries(Object.entries(record || {}).filter(([key]) => !REMOVED_FIELDS.has(key)));
}

function saveJsonRecord(record) {
  const records = getData();
  const id = record.id || String(Date.now());
  const existing = records.findIndex((r) => r.id === id);
  const sanitizedRecord = sanitizeRecord(record);
  const toSave = { ...sanitizedRecord, id, updatedAt: new Date().toISOString() };
  if (existing >= 0) {
    records[existing] = toSave;
  } else {
    records.push(toSave);
  }
  saveData(records);
  return toSave;
}

function deleteJsonRecord(id) {
  const records = getData().filter((r) => r.id !== id);
  saveData(records);
  return true;
}

function normalizeFromDbRow(row) {
  const out = {
    id: row.id,
    version: typeof row.version === 'number' ? row.version : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null
  };
  Object.keys(PERSONNEL_FIELD_MAP).forEach(function (srcKey) {
    out[srcKey] = row[PERSONNEL_FIELD_MAP[srcKey]];
  });
  return out;
}

function groupByPersonnelId(rows) {
  const map = new Map();
  rows.forEach(function (r) {
    if (!map.has(r.personnel_id)) map.set(r.personnel_id, []);
    map.get(r.personnel_id).push(r);
  });
  return map;
}

async function getPersonnelColumnSet(client) {
  const result = await client.query(
    "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'personnel'"
  );
  return new Set((result.rows || []).map(function (r) { return r.column_name; }));
}

function assertPersonnelColumnsAvailable(personnelColumnSet, record) {
  const requiredWhenPresent = [
    ['signatureDataUrl', 'signature_data_url'],
    ['leftThumbMarkDataUrl', 'left_thumb_mark_data_url'],
    ['rightThumbMarkDataUrl', 'right_thumb_mark_data_url'],
  ];
  const missing = requiredWhenPresent.filter(function (pair) {
    const sourceKey = pair[0];
    const columnName = pair[1];
    const value = record && record[sourceKey];
    if (value == null || String(value).trim() === '') return false;
    return !personnelColumnSet.has(columnName);
  });
  if (!missing.length) return;
  throw new Error(
    'Database schema is missing required media columns: ' +
    missing.map(function (pair) { return pair[1]; }).join(', ') +
    '. Apply the latest personnel schema update before saving thumb marks/signature.'
  );
}

async function getPostgresData() {
  const pool = getPgPool();
  if (!pool) throw new Error('DATABASE_URL is required for Postgres read');
  const client = await pool.connect();
  try {
    const base = await client.query('SELECT * FROM personnel WHERE deleted_at IS NULL ORDER BY updated_at DESC');
    const records = base.rows.map(normalizeFromDbRow);
    if (!records.length) return [];
    const ids = records.map((r) => r.id);
    const childGrouped = {};
    for (const def of CHILD_TABLES) {
      const q = await client.query('SELECT * FROM ' + def.table + ' WHERE personnel_id = ANY($1::text[]) ORDER BY id ASC', [ids]);
      childGrouped[def.sourceKey] = groupByPersonnelId(q.rows);
    }
    records.forEach(function (rec) {
      for (const def of CHILD_TABLES) {
        const rows = (childGrouped[def.sourceKey] && childGrouped[def.sourceKey].get(rec.id)) || [];
        rec[def.sourceKey] = rows.map(function (row) {
          const item = {};
          Object.keys(def.map).forEach(function (srcKey) {
            item[srcKey] = row[def.map[srcKey]];
          });
          return item;
        });
      }
    });
    return records;
  } finally {
    client.release();
  }
}

async function savePostgresRecord(record, currentUserId) {
  const pool = getPgPool();
  if (!pool) throw new Error('DATABASE_URL is required for Postgres write');
  const safe = sanitizeRecord(record);
  const id = safe.id || String(Date.now());
  const expectedVersion =
    safe.version == null || safe.version === ''
      ? null
      : Number.isFinite(Number(safe.version))
        ? Number(safe.version)
        : null;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (currentUserId) {
      await client.query("SELECT set_config('app.current_user_id', $1, true)", [String(currentUserId)]);
    }
    const personnelColumnSet = await getPersonnelColumnSet(client);
    assertPersonnelColumnsAvailable(personnelColumnSet, safe);
    const cols = [];
    const vals = [];
    Object.keys(PERSONNEL_FIELD_MAP).forEach(function (srcKey) {
      const dbCol = PERSONNEL_FIELD_MAP[srcKey];
      if (!personnelColumnSet.has(dbCol)) return;
      cols.push(dbCol);
      vals.push(safe[srcKey] == null ? null : safe[srcKey]);
    });
    const insertCols = ['id'].concat(cols, ['updated_at']);
    const insertVals = [id].concat(vals, [new Date().toISOString()]);
    const insertPlaceholders = insertVals.map(function (_v, idx) { return '$' + (idx + 1); }).join(', ');
    const insertSql = 'INSERT INTO personnel (' + insertCols.join(', ') + ') VALUES (' + insertPlaceholders + ') ON CONFLICT (id) DO NOTHING RETURNING version, updated_at';
    const insertRes = await client.query(insertSql, insertVals);

    var nextVersion = null;
    var nextUpdatedAt = null;
    if (insertRes.rowCount > 0) {
      nextVersion = insertRes.rows[0].version;
      nextUpdatedAt = insertRes.rows[0].updated_at;
    } else {
      if (expectedVersion == null) {
        throw new Error(
          'Concurrency conflict: record already exists. Reload the roster and retry your save.'
        );
      }
      const setParts = cols.map(function (c, idx) {
        return c + ' = $' + (idx + 1);
      });
      const updateSql =
        'UPDATE personnel SET ' +
        setParts.join(', ') +
        ', updated_at = NOW(), version = version + 1 WHERE id = $' +
        (cols.length + 1) +
        ' AND version = $' +
        (cols.length + 2) +
        ' AND deleted_at IS NULL RETURNING version, updated_at';
      const updateVals = vals.concat([id, expectedVersion]);
      const updRes = await client.query(updateSql, updateVals);
      if (updRes.rowCount === 0) {
        throw new Error(
          'Concurrency conflict: this record was updated by someone else. Reload and apply your changes again.'
        );
      }
      nextVersion = updRes.rows[0].version;
      nextUpdatedAt = updRes.rows[0].updated_at;
    }

    for (const def of CHILD_TABLES) {
      await client.query('DELETE FROM ' + def.table + ' WHERE personnel_id = $1', [id]);
      const rows = Array.isArray(safe[def.sourceKey]) ? safe[def.sourceKey] : [];
      for (const row of rows) {
        const item = row || {};
        const mapKeys = Object.keys(def.map);
        const childCols = ['personnel_id'].concat(mapKeys.map(k => def.map[k]));
        const childVals = [id];
        mapKeys.forEach(function (srcKey) {
          childVals.push(item[srcKey] == null ? null : item[srcKey]);
        });
        const childPlaceholders = childVals.map(function (_v, idx) { return '$' + (idx + 1); }).join(', ');
        const childSql = 'INSERT INTO ' + def.table + ' (' + childCols.join(', ') + ') VALUES (' + childPlaceholders + ')';
        await client.query(childSql, childVals);
      }
    }

    await client.query('COMMIT');
    return {
      ...safe,
      id,
      version: nextVersion,
      updatedAt: nextUpdatedAt ? new Date(nextUpdatedAt).toISOString() : new Date().toISOString()
    };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function deletePostgresRecord(id, expectedVersion, currentUserId) {
  const pool = getPgPool();
  if (!pool) throw new Error('DATABASE_URL is required for Postgres delete');
  if (expectedVersion == null || expectedVersion === '') {
    throw new Error('Concurrency conflict: missing record version for delete.');
  }
  const ver = Number(expectedVersion);
  if (!Number.isFinite(ver)) {
    throw new Error('Concurrency conflict: invalid record version for delete.');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (currentUserId) {
      await client.query("SELECT set_config('app.current_user_id', $1, true)", [String(currentUserId)]);
    }
    const res = await client.query(
      'UPDATE personnel SET deleted_at = NOW(), updated_at = NOW(), version = version + 1 WHERE id = $1 AND version = $2 AND deleted_at IS NULL RETURNING id',
      [id, ver]
    );
    if (res.rowCount === 0) {
      throw new Error(
        'Concurrency conflict: record already changed or removed. Reload the roster before deleting.'
      );
    }
    await client.query('COMMIT');
    return true;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

module.exports = {
  initDatabase,
  getPgPool,
  getData,
  saveJsonRecord,
  deleteJsonRecord,
  getPostgresData,
  savePostgresRecord,
  deletePostgresRecord,
  closeDatabase
};
