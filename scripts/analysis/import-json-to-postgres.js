#!/usr/bin/env node
'use strict';

/**
 * APOLLO JSON -> PostgreSQL importer
 *
 * Usage (PowerShell):
 *   $env:DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DBNAME"
 *   node scripts/import-json-to-postgres.js
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error('Missing DATABASE_URL');
  process.exit(1);
}

console.error('Sample data file has been removed. Please provide a valid JSON file path.');
console.error('Usage: SOURCE_FILE=/path/to/file.json node scripts/import-json-to-postgres.js');
process.exit(1);

const sourceFile = process.env.SOURCE_FILE;
if (!sourceFile) {
  console.error('Missing SOURCE_FILE environment variable');
  process.exit(1);
}
const raw = fs.readFileSync(sourceFile, 'utf8');
const records = JSON.parse(raw);

function clean(v) {
  if (v == null) return null;
  if (typeof v === 'string') {
    var t = v.trim();
    return t === '' ? null : t;
  }
  return v;
}

const scalarMap = {
  fullName: 'full_name',
  nameLast: 'name_last',
  nameFirst: 'name_first',
  nameMiddle: 'name_middle',
  presentJob: 'present_job',
  businessAddress: 'business_address',
  homeAddress: 'home_address',
  dateOfBirth: 'date_of_birth',
  placeOfBirth: 'place_of_birth',
  changeInName: 'change_in_name',
  nicknames: 'nicknames',
  nationality: 'nationality',
  taxId: 'tax_id',
  telNo: 'tel_no',
  mobile: 'mobile',
  email: 'email',
  passportNr: 'passport_nr',
  passportExpiry: 'passport_expiry',
  sex: 'sex',
  age: 'age',
  height: 'height',
  weight: 'weight',
  build: 'build',
  complexion: 'complexion',
  colorEyes: 'color_eyes',
  colorHair: 'color_hair',
  scarMarks: 'scar_marks',
  healthState: 'health_state',
  recentIllness: 'recent_illness',
  bloodType: 'blood_type',
  maritalStatus: 'marital_status',
  spouseName: 'spouse_name',
  marriageDatePlace: 'marriage_date_place',
  spouseDob: 'spouse_dob',
  spousePlaceBirth: 'spouse_place_birth',
  spouseOccupation: 'spouse_occupation',
  spouseContact: 'spouse_contact',
  spouseCitizenship: 'spouse_citizenship',
  fatherName: 'father_name',
  fatherDobPlace: 'father_dob_place',
  fatherAddress: 'father_address',
  fatherOccupation: 'father_occupation',
  fatherCitizenship: 'father_citizenship',
  motherName: 'mother_name',
  motherDobPlace: 'mother_dob_place',
  motherAddress: 'mother_address',
  motherOccupation: 'mother_occupation',
  motherCitizenship: 'mother_citizenship',
  siblingsName: 'siblings_name',
  siblingsDob: 'siblings_dob',
  siblingsCitizenship: 'siblings_citizenship',
  siblingsAddress: 'siblings_address',
  siblingsOccupation: 'siblings_occupation',
  siblingsEmployerAddress: 'siblings_employer_address',
  stepParentFullName: 'step_parent_full_name',
  stepParentDob: 'step_parent_dob',
  stepParentAddress: 'step_parent_address',
  stepParentOccupation: 'step_parent_occupation',
  stepParentCitizenship: 'step_parent_citizenship',
  fatherInLawFullName: 'father_in_law_full_name',
  fatherInLawDob: 'father_in_law_dob',
  fatherInLawAddress: 'father_in_law_address',
  fatherInLawOccupation: 'father_in_law_occupation',
  fatherInLawCitizenship: 'father_in_law_citizenship',
  motherInLawFullName: 'mother_in_law_full_name',
  motherInLawDob: 'mother_in_law_dob',
  motherInLawAddress: 'mother_in_law_address',
  motherInLawOccupation: 'mother_in_law_occupation',
  motherInLawCitizenship: 'mother_in_law_citizenship',
  elemLocation: 'elem_location',
  elemAttendance: 'elem_attendance',
  elemGraduated: 'elem_graduated',
  hsLocation: 'hs_location',
  hsAttendance: 'hs_attendance',
  hsGraduated: 'hs_graduated',
  collegeLocation: 'college_location',
  collegeAttendance: 'college_attendance',
  collegeGraduated: 'college_graduated',
  pgLocation: 'pg_location',
  pgCourseAttendance: 'pg_course_attendance',
  pgGraduated: 'pg_graduated',
  otherSchools: 'other_schools',
  civilServiceEligibility: 'civil_service_eligibility',
  dismissedResign: 'dismissed_resign',
  salaryDependent: 'salary_dependent',
  salFiled: 'sal_filed',
  incomeTaxFiled: 'income_tax_filed',
  arrestRecord: 'arrest_record',
  familyArrest: 'family_arrest',
  adminCase: 'admin_case',
  pd1081: 'pd1081',
  liquorDrugs: 'liquor_drugs',
  hobbies: 'hobbies',
  lieDetector: 'lie_detector',
  signedAtCert: 'signed_at_cert',
  signedDateCert: 'signed_date_cert',
  swornDay: 'sworn_day',
  swornMonth: 'sworn_month',
  swornPlace: 'sworn_place',
  residenceCertNr2: 'residence_cert_nr2',
  residenceCertIssuedOn2: 'residence_cert_issued_on2',
  residenceCertIssuedAt2: 'residence_cert_issued_at2',
  administeringOfficer2: 'administering_officer2',
  photoDataUrl: 'photo_data_url'
};

function childInsertRows(client, personnelId, rows, table, map) {
  return Promise.resolve().then(async function () {
    await client.query('DELETE FROM ' + table + ' WHERE personnel_id = $1', [personnelId]);
    if (!Array.isArray(rows) || !rows.length) return 0;
    var cols = Object.values(map);
    var keys = Object.keys(map);
    var inserted = 0;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i] || {};
      var vals = [personnelId];
      for (var k = 0; k < keys.length; k++) vals.push(clean(r[keys[k]]));
      var placeholders = vals.map(function (_v, idx) { return '$' + (idx + 1); }).join(', ');
      await client.query(
        'INSERT INTO ' +
          table +
          ' (personnel_id, ' +
          cols.join(', ') +
          ') VALUES (' +
          placeholders +
          ')',
        vals
      );
      inserted++;
    }
    return inserted;
  });
}

async function run() {
  const pool = new Pool({ connectionString: DB_URL });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let imported = 0;
    for (const rec of records) {
      const id = clean(rec.id) || String(Date.now()) + '_' + imported;

      const cols = ['id'];
      const vals = [id];
      for (const srcKey of Object.keys(scalarMap)) {
        cols.push(scalarMap[srcKey]);
        vals.push(clean(rec[srcKey]));
      }
      cols.push('updated_at');
      vals.push(clean(rec.updatedAt) || new Date().toISOString());

      const updates = cols
        .filter(function (c) { return c !== 'id'; })
        .map(function (c) { return c + ' = EXCLUDED.' + c; })
        .join(', ');
      const placeholders = vals.map(function (_v, idx) { return '$' + (idx + 1); }).join(', ');
      await client.query(
        'INSERT INTO personnel (' +
          cols.join(', ') +
          ') VALUES (' +
          placeholders +
          ') ON CONFLICT (id) DO UPDATE SET ' +
          updates,
        vals
      );

      await childInsertRows(client, id, rec.children, 'personnel_children', {
        name: 'name',
        dob: 'dob',
        citizenshipAddress: 'citizenship_address',
        fatherMother: 'father_mother'
      });
      await childInsertRows(client, id, rec.placesOfResidence, 'personnel_places_of_residence', {
        inclusiveDates: 'inclusive_dates',
        address: 'address'
      });
      await childInsertRows(client, id, rec.employmentHistory, 'personnel_employment_history', {
        inclusiveDate: 'inclusive_date',
        type: 'type',
        employerAddress: 'employer_address',
        reasonForLeaving: 'reason_for_leaving'
      });
      await childInsertRows(client, id, rec.seminarsTraining, 'personnel_seminars_training', {
        inclusiveDate: 'inclusive_date',
        name: 'name',
        conductedBy: 'conducted_by',
        remarks: 'remarks'
      });
      await childInsertRows(client, id, rec.foreignCountries, 'personnel_foreign_countries', {
        dateOfVisit: 'date_of_visit',
        country: 'country',
        purpose: 'purpose',
        addressAbroad: 'address_abroad'
      });
      await childInsertRows(client, id, rec.banksCredit, 'personnel_banks_credit', {
        name: 'name',
        address: 'address',
        natureOfAccount: 'nature_of_account'
      });
      await childInsertRows(client, id, rec.creditReferences, 'personnel_credit_references', {
        name: 'name',
        address: 'address'
      });
      await childInsertRows(client, id, rec.characterRefs, 'personnel_character_refs', {
        name: 'name',
        address: 'address'
      });
      await childInsertRows(client, id, rec.neighbors, 'personnel_neighbors', {
        name: 'name',
        address: 'address'
      });
      await childInsertRows(client, id, rec.organizations, 'personnel_organizations', {
        organization: 'organization',
        address: 'address',
        membershipDate: 'membership_date',
        positionHeld: 'position_held'
      });
      await childInsertRows(client, id, rec.languages, 'personnel_languages', {
        languageDialect: 'language_dialect',
        speak: 'speak',
        read: 'read',
        write: 'write'
      });

      imported++;
    }
    await client.query('COMMIT');
    console.log('Imported personnel records:', imported);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Import failed:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
