const electron = require('electron');
if (!electron || typeof electron === 'string' || !electron.app) {
  console.error('This app must be started with Electron. Use "npm start" or run the built .exe.');
  process.exit(1);
}
const { app, BrowserWindow, ipcMain, dialog } = electron;
const path = require('path');
const fs = require('fs');
const os = require('os');
const { pathToFileURL } = require('url');
const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config({ override: true });

const CONFIG_KEYS = new Set([
  'DATABASE_URL',
  'USE_REMOTE_API',
  'REMOTE_API_BASE',
  'USE_POSTGRES_READ',
  'USE_POSTGRES_WRITE',
  'ENABLE_DUAL_WRITE',
]);

function applyConfigValues(values) {
  if (!values || typeof values !== 'object') return;
  Object.keys(values).forEach(function (key) {
    if (!CONFIG_KEYS.has(key)) return;
    const val = values[key];
    if (val == null) return;
    process.env[key] = String(val);
  });
}

function loadConfigFromFile(configPath, loader) {
  try {
    if (!fs.existsSync(configPath)) return;
    const raw = fs.readFileSync(configPath, 'utf8').replace(/^\uFEFF/, '');
    const parsed = loader(raw);
    applyConfigValues(parsed);
  } catch (e) {
    console.warn('Could not load config file:', configPath, e && e.message ? e.message : e);
  }
}

function loadExternalConfig() {
  const dirs = [];
  if (process.execPath) dirs.push(path.dirname(process.execPath));
  if (process.cwd()) dirs.push(process.cwd());
  if (__dirname) dirs.push(__dirname);
  if (process.env.APPDATA) {
    dirs.push(path.join(process.env.APPDATA, 'APOLLO Personnel Database'));
    dirs.push(path.join(process.env.APPDATA, 'apollo-personnel-db'));
  }
  try {
    dirs.push(app.getPath('userData'));
  } catch (_) {
    // ignore, app path may not be available this early in startup on some hosts
  }
  const uniqueDirs = Array.from(new Set(dirs.filter(Boolean)));
  uniqueDirs.forEach(function (dir) {
    loadConfigFromFile(path.join(dir, 'app-config.json'), function (text) {
      return JSON.parse(text);
    });
    loadConfigFromFile(path.join(dir, '.env.local'), function (text) {
      return dotenv.parse(text);
    });
  });
}

loadExternalConfig();

function configSearchLocations() {
  const dirs = [];
  if (process.execPath) dirs.push(path.dirname(process.execPath));
  if (process.cwd()) dirs.push(process.cwd());
  if (__dirname) dirs.push(__dirname);
  if (process.env.APPDATA) {
    dirs.push(path.join(process.env.APPDATA, 'APOLLO Personnel Database'));
    dirs.push(path.join(process.env.APPDATA, 'apollo-personnel-db'));
  }
  try {
    dirs.push(app.getPath('userData'));
  } catch (_) {
    // ignore
  }
  return Array.from(new Set(dirs.filter(Boolean)));
}

// Force software rendering — must be before app is ready (fixes "failed to create shared context")
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('disable-accelerated-2d-canvas');
app.commandLine.appendSwitch('disable-accelerated-video-decode');
app.commandLine.appendSwitch('disable-accelerated-video-encode');
app.commandLine.appendSwitch('disable-features', 'GPU');

let mainWindow;
const DATA_FILE = path.join(app.getPath('userData'), 'personnel-data.json');
const REMOVED_FIELDS = new Set(['brOfSvc']);
const DEFAULT_DATABASE_URL = 'postgresql://apollo_app:ApolloApp2026@10.10.218.144:5432/apollo_db';
const USE_POSTGRES_READ = /^(1|true|yes)$/i.test(String(process.env.USE_POSTGRES_READ || 'true'));
const USE_POSTGRES_WRITE = /^(1|true|yes)$/i.test(String(process.env.USE_POSTGRES_WRITE || 'true'));
const ENABLE_DUAL_WRITE = /^(1|true|yes)$/i.test(String(process.env.ENABLE_DUAL_WRITE || 'true'));
const USE_REMOTE_API = /^(1|true|yes)$/i.test(String(process.env.USE_REMOTE_API || 'false'));
const REMOTE_API_BASE = String(process.env.REMOTE_API_BASE || 'http://10.10.218.144:3210');
const DATABASE_URL = process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
let pgPool = null;
const AUTH_SESSION_PATH = path.join(app.getPath('userData'), 'auth-session.json');
let authSession = null;

async function remoteApi(pathname, options) {
  const base = REMOTE_API_BASE.replace(/\/+$/, '');
  const url = base + pathname;
  const userHeaders = (options && options.headers) || {};
  const headers = Object.assign({ 'Content-Type': 'application/json' }, userHeaders);
  if (authSession && authSession.token) {
    headers.Authorization = 'Bearer ' + authSession.token;
  }
  const res = await fetch(url, {
    ...(options || {}),
    headers: headers,
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch (_) {
    body = null;
  }
  if (!res.ok) {
    throw new Error((body && body.error) || ('Remote API error: ' + res.status));
  }
  return body;
}

function loadAuthSessionFromDisk() {
  try {
    const raw = fs.readFileSync(AUTH_SESSION_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && parsed.token && parsed.user && Array.isArray(parsed.user.roles)) {
      authSession = parsed;
    }
  } catch (_) {
    // ignore
  }
}

function persistAuthSessionToDisk() {
  try {
    if (!authSession || !authSession.token) {
      try { fs.unlinkSync(AUTH_SESSION_PATH); } catch (_) {}
      return;
    }
    fs.writeFileSync(AUTH_SESSION_PATH, JSON.stringify(authSession, null, 2), 'utf8');
  } catch (_) {
    // ignore
  }
}

loadAuthSessionFromDisk();

function getPgPool() {
  if (!DATABASE_URL) return null;
  if (!pgPool) {
    pgPool = new Pool({ connectionString: DATABASE_URL });
  }
  return pgPool;
}

async function loginWithLocalPostgres(username, password) {
  const pool = getPgPool();
  if (!pool) throw new Error('DATABASE_URL is required for local auth.');
  const rows = await pool.query(
    `
      SELECT
        u.id,
        u.username,
        u.full_name,
        ARRAY_REMOVE(ARRAY_AGG(r.name ORDER BY r.name), NULL) AS roles
      FROM app_users u
      LEFT JOIN app_user_roles ur ON ur.user_id = u.id
      LEFT JOIN app_roles r ON r.id = ur.role_id
      WHERE u.username = $1
        AND u.is_active = TRUE
        AND u.password_hash = crypt($2, u.password_hash)
      GROUP BY u.id, u.username, u.full_name
    `,
    [username, password]
  );
  if (!rows.rows || !rows.rows.length) {
    throw new Error('Invalid credentials.');
  }
  const user = rows.rows[0];
  return {
    token: 'local-session',
    user: {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      roles: Array.isArray(user.roles) ? user.roles : [],
    },
  };
}

async function getAdminRolesLocal() {
  const pool = getPgPool();
  if (!pool) throw new Error('DATABASE_URL is required for local admin operations.');
  const rows = await pool.query('SELECT name FROM app_roles ORDER BY name ASC');
  return { roles: (rows.rows || []).map(function (r) { return r.name; }) };
}

async function createAdminUserLocal(payload) {
  const pool = getPgPool();
  if (!pool) throw new Error('DATABASE_URL is required for local admin operations.');

  const body = payload || {};
  const username = String(body.username || '').trim();
  const password = String(body.password || '');
  const fullName = String(body.fullName || body.full_name || '').trim();
  const roleName = String(body.roleName || body.role || '').trim();
  if (!username || !password || !roleName) {
    throw new Error('username, password, and roleName are required.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const roleRow = await client.query('SELECT id FROM app_roles WHERE name = $1', [roleName]);
    if (!roleRow.rows || !roleRow.rows.length) {
      throw new Error('Unknown roleName.');
    }
    const roleId = roleRow.rows[0].id;
    const inserted = await client.query(
      `
        INSERT INTO app_users (username, password_hash, full_name, is_active)
        VALUES ($1, crypt($2, gen_salt('bf')), $3, TRUE)
        RETURNING id, username, full_name
      `,
      [username, password, fullName]
    );
    const userId = inserted.rows && inserted.rows[0] ? inserted.rows[0].id : null;
    if (!userId) throw new Error('Failed to create user.');

    await client.query('INSERT INTO app_user_roles (user_id, role_id) VALUES ($1, $2)', [userId, roleId]);
    await client.query('COMMIT');
    return { ok: true, user: { id: userId, username: username, fullName: fullName, roleName: roleName } };
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    if (e && e.code === '23505') throw new Error('Username already exists.');
    throw e;
  } finally {
    client.release();
  }
}

async function updateAdminUserRoleLocal(userId, roleName) {
  const pool = getPgPool();
  if (!pool) throw new Error('DATABASE_URL is required for local admin operations.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const roleRow = await client.query('SELECT id FROM app_roles WHERE name = $1', [roleName]);
    if (!roleRow.rows || !roleRow.rows.length) {
      throw new Error('Unknown roleName.');
    }
    const roleId = roleRow.rows[0].id;
    await client.query('DELETE FROM app_user_roles WHERE user_id = $1', [userId]);
    await client.query('INSERT INTO app_user_roles (user_id, role_id) VALUES ($1, $2)', [userId, roleId]);
    await client.query('COMMIT');
    return { ok: true };
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw e;
  } finally {
    client.release();
  }
}

async function deleteAdminUserLocal(userId) {
  const pool = getPgPool();
  if (!pool) throw new Error('DATABASE_URL is required for local admin operations.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM app_user_roles WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM app_users WHERE id = $1', [userId]);
    await client.query('COMMIT');
    return { ok: true };
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw e;
  } finally {
    client.release();
  }
}



function ensureDataFile() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2), 'utf8');
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
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function saveData(records) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(records, null, 2), 'utf8');
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

const PERSONNEL_FIELD_MAP = {
  fullName: 'full_name',
  nameLast: 'name_last',
  nameFirst: 'name_first',
  nameMiddle: 'name_middle',
  organization: 'organization',
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
  signatureDataUrl: 'signature_data_url',
  handwrittenEntryDataUrl: 'handwritten_entry_data_url',
  leftThumbMarkDataUrl: 'left_thumb_mark_data_url',
  rightThumbMarkDataUrl: 'right_thumb_mark_data_url',
  photoDataUrl: 'photo_data_url'
};

const CHILD_TABLES = [
  {
    sourceKey: 'children',
    table: 'personnel_children',
    map: { name: 'name', dob: 'dob', citizenshipAddress: 'citizenship_address', fatherMother: 'father_mother' }
  },
  {
    sourceKey: 'placesOfResidence',
    table: 'personnel_places_of_residence',
    map: { inclusiveDates: 'inclusive_dates', address: 'address' }
  },
  {
    sourceKey: 'employmentHistory',
    table: 'personnel_employment_history',
    map: { inclusiveDate: 'inclusive_date', type: 'type', employerAddress: 'employer_address', reasonForLeaving: 'reason_for_leaving' }
  },
  {
    sourceKey: 'seminarsTraining',
    table: 'personnel_seminars_training',
    map: { inclusiveDate: 'inclusive_date', name: 'name', conductedBy: 'conducted_by', remarks: 'remarks' }
  },
  {
    sourceKey: 'foreignCountries',
    table: 'personnel_foreign_countries',
    map: { dateOfVisit: 'date_of_visit', country: 'country', purpose: 'purpose', addressAbroad: 'address_abroad' }
  },
  {
    sourceKey: 'banksCredit',
    table: 'personnel_banks_credit',
    map: { name: 'name', address: 'address', natureOfAccount: 'nature_of_account' }
  },
  { sourceKey: 'creditReferences', table: 'personnel_credit_references', map: { name: 'name', address: 'address' } },
  { sourceKey: 'characterRefs', table: 'personnel_character_refs', map: { name: 'name', address: 'address' } },
  { sourceKey: 'neighbors', table: 'personnel_neighbors', map: { name: 'name', address: 'address' } },
  {
    sourceKey: 'organizations',
    table: 'personnel_organizations',
    map: { organization: 'organization', address: 'address', membershipDate: 'membership_date', positionHeld: 'position_held' }
  },
  {
    sourceKey: 'languages',
    table: 'personnel_languages',
    map: { languageDialect: 'language_dialect', speak: 'speak', read: 'read', write: 'write' }
  }
];

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

async function savePostgresRecord(record) {
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
    const insertRes = await client.query(
      'INSERT INTO personnel (' +
        insertCols.join(', ') +
        ') VALUES (' +
        insertPlaceholders +
        ') ON CONFLICT (id) DO NOTHING RETURNING version, updated_at',
      insertVals
    );

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
        const childCols = ['personnel_id'].concat(Object.values(def.map));
        const childVals = [id];
        Object.keys(def.map).forEach(function (srcKey) {
          childVals.push(item[srcKey] == null ? null : item[srcKey]);
        });
        const childPlaceholders = childVals.map(function (_v, idx) { return '$' + (idx + 1); }).join(', ');
        await client.query(
          'INSERT INTO ' + def.table + ' (' + childCols.join(', ') + ') VALUES (' + childPlaceholders + ')',
          childVals
        );
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

async function deletePostgresRecord(id, expectedVersion) {
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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 500,
    webPreferences: {
      preload: path.join(__dirname, 'src', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: require('fs').existsSync(path.join(__dirname, 'assets', 'icon.png'))
      ? path.join(__dirname, 'assets', 'icon.png')
      : undefined,
  });

  const loginPath = path.join(__dirname, 'src', 'ui', 'login.html');
  mainWindow.loadURL(pathToFileURL(loginPath).href);
  mainWindow.maximize();
  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.setTitle('Personnel Database');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});

ipcMain.handle('auth:login', async function (_evt, creds) {
  creds = creds || {};
  const username = String(creds.username || '').trim();
  const password = String(creds.password || '');
  if (!username || !password) throw new Error('Missing username/password.');

  let result = null;
  const hasLocalDb = !!DATABASE_URL;
  const shouldTryRemote = USE_REMOTE_API || !hasLocalDb;

  if (shouldTryRemote) {
    try {
      result = await remoteApi('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: username, password: password }),
      });
    } catch (e) {
      console.error('auth:login remote API failed, trying local DB auth:', e && e.message ? e.message : e);
    }
  }

  if (!result && hasLocalDb) {
    result = await loginWithLocalPostgres(username, password);
  }

  if (!result) {
    throw new Error(
      'No local DATABASE_URL configured. Add app-config.json or .env.local in one of: ' +
      configSearchLocations().join('; ')
    );
  }

  authSession = { token: result && result.token ? String(result.token) : '', user: result && result.user ? result.user : null };
  persistAuthSessionToDisk();
  return authSession ? { user: authSession.user } : null;
});

ipcMain.handle('auth:session', async function () {
  if (!authSession || !authSession.token || !authSession.user) return null;
  return { user: authSession.user, roles: authSession.user.roles || [] };
});

ipcMain.handle('auth:logout', async function () {
  authSession = null;
  persistAuthSessionToDisk();
  return { ok: true };
});

ipcMain.handle('admin:roles', async function () {
  if (USE_REMOTE_API) {
    try {
      return await remoteApi('/admin/roles');
    } catch (e) {
      console.error('admin:roles remote API failed, trying local DB:', e && e.message ? e.message : e);
    }
  }
  return await getAdminRolesLocal();
});

ipcMain.handle('admin:createUser', async function (_evt, payload) {
  if (USE_REMOTE_API) {
    try {
      return await remoteApi('/admin/users', {
        method: 'POST',
        body: JSON.stringify(payload || {}),
      });
    } catch (e) {
      console.error('admin:createUser remote API failed, trying local DB:', e && e.message ? e.message : e);
    }
  }
  return await createAdminUserLocal(payload || {});
});

ipcMain.handle('admin:listUsers', async function () {
  if (USE_REMOTE_API) {
    try {
      return await remoteApi('/admin/users');
    } catch (e) {
      console.error('admin:listUsers remote API failed, trying local DB:', e && e.message ? e.message : e);
    }
  }
  const pool = getPgPool();
  if (!pool) throw new Error('DATABASE_URL is required for local admin operations.');
  const rows = await pool.query(
    `
      SELECT
        u.id,
        u.username,
        u.full_name,
        u.is_active,
        COALESCE(ARRAY_REMOVE(ARRAY_AGG(r.name ORDER BY r.name), NULL), '{}') AS roles
      FROM app_users u
      LEFT JOIN app_user_roles ur ON ur.user_id = u.id
      LEFT JOIN app_roles r ON r.id = ur.role_id
      GROUP BY u.id, u.username, u.full_name, u.is_active
      ORDER BY u.username ASC
    `
  );
  return { users: rows.rows || [] };
});

ipcMain.handle('admin:updateUserRole', async function (_evt, payload) {
  const body = payload || {};
  const userId = body.userId;
  const roleName = String(body.roleName || '').trim();
  if (!userId || !roleName) {
    throw new Error('userId and roleName are required.');
  }
  if (USE_REMOTE_API) {
    try {
      return await remoteApi('/admin/users/' + encodeURIComponent(String(userId)) + '/role', {
        method: 'PUT',
        body: JSON.stringify({ roleName: roleName }),
      });
    } catch (e) {
      console.error('admin:updateUserRole remote API failed, trying local DB:', e && e.message ? e.message : e);
    }
  }
  return await updateAdminUserRoleLocal(userId, roleName);
});

ipcMain.handle('admin:deleteUser', async function (_evt, payload) {
  const body = payload || {};
  const userId = body.userId;
  if (!userId) {
    throw new Error('userId is required.');
  }
  if (USE_REMOTE_API) {
    try {
      return await remoteApi('/admin/users/' + encodeURIComponent(String(userId)), {
        method: 'DELETE',
      });
    } catch (e) {
      console.error('admin:deleteUser remote API failed, trying local DB:', e && e.message ? e.message : e);
    }
  }
  return await deleteAdminUserLocal(userId);
});

ipcMain.handle('personnel:getAll', async () => {
  if (USE_POSTGRES_READ) {
    try {
      return await getPostgresData();
    } catch (e) {
      console.error('personnel:getAll postgres failed, trying remote/json fallback:', e && e.message ? e.message : e);
    }
  }
  if (USE_REMOTE_API) {
    try {
      return await remoteApi('/personnel');
    } catch (e) {
      console.error('personnel:getAll remote API failed, falling back to JSON:', e && e.message ? e.message : e);
    }
  }
  return getData();
});

ipcMain.handle('personnel:save', async (_, record) => {
  const shouldWritePg = USE_POSTGRES_WRITE;
  const shouldDualWrite = ENABLE_DUAL_WRITE;
  if (shouldWritePg) {
    try {
      const savedPg = await savePostgresRecord(record || {});
      if (shouldDualWrite) {
        try {
          saveJsonRecord(savedPg);
        } catch (e) {
          console.error('personnel:save dual-write JSON failed:', e);
        }
      }
      return savedPg;
    } catch (e) {
      console.error('personnel:save postgres failed, trying remote/json fallback:', e && e.message ? e.message : e);
    }
  }
  if (USE_REMOTE_API) {
    try {
      return await remoteApi('/personnel', {
        method: 'POST',
        body: JSON.stringify(record || {}),
      });
    } catch (e) {
      console.error('personnel:save remote API failed, falling back to JSON:', e && e.message ? e.message : e);
    }
  }
  return saveJsonRecord(record || {});
});

ipcMain.handle('personnel:delete', async (_, id, version) => {
  const shouldWritePg = USE_POSTGRES_WRITE;
  const shouldDualWrite = ENABLE_DUAL_WRITE;
  if (shouldWritePg) {
    try {
      const ok = await deletePostgresRecord(id, version);
      if (shouldDualWrite) {
        try {
          deleteJsonRecord(id);
        } catch (e) {
          console.error('personnel:delete dual-write JSON failed:', e);
        }
      }
      return ok;
    } catch (e) {
      console.error('personnel:delete postgres failed, trying remote/json fallback:', e && e.message ? e.message : e);
    }
  }
  if (USE_REMOTE_API) {
    try {
      const qs = '?version=' + encodeURIComponent(version == null ? '' : String(version));
      const result = await remoteApi('/personnel/' + encodeURIComponent(id) + qs, {
        method: 'DELETE',
      });
      return !!(result && result.ok);
    } catch (e) {
      console.error('personnel:delete remote API failed, falling back to JSON:', e && e.message ? e.message : e);
    }
  }
  return deleteJsonRecord(id);
});

async function writePhsPdfFromHtml(parentWindow, html, defaultName) {
  const FOLIO_PAGE_SIZE_MICRONS = {
    width: 215900, // 8.5 in
    height: 330200, // 13 in
  };
  const tmp = path.join(
    os.tmpdir(),
    'phs-export-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9) + '.html'
  );
  fs.writeFileSync(tmp, html, 'utf8');
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  try {
    await win.loadFile(tmp);
    await new Promise(function (resolve) {
      setTimeout(resolve, 450);
    });
    const pdfBuffer = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: FOLIO_PAGE_SIZE_MICRONS,
      preferCSSPageSize: true,
      marginsType: 0,
    });
    win.destroy();
    try {
      fs.unlinkSync(tmp);
    } catch (_) {}
    const { canceled, filePath } = await dialog.showSaveDialog(parentWindow || undefined, {
      title: 'Save PDF',
      defaultPath: path.join(app.getPath('documents'), defaultName || 'Personnel-History-Statement.pdf'),
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (canceled || !filePath) return { ok: false };
    fs.writeFileSync(filePath, pdfBuffer);
    return { ok: true, filePath };
  } catch (err) {
    try {
      win.destroy();
    } catch (_) {}
    try {
      fs.unlinkSync(tmp);
    } catch (_) {}
    throw err;
  }
}

ipcMain.handle('export:phsPdf', async function (event, payload) {
  var html = payload && payload.html;
  var defaultName = (payload && payload.defaultName) || 'Personnel-History-Statement.pdf';
  if (!html || typeof html !== 'string') return { ok: false, error: 'Missing HTML' };
  var parent = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  return writePhsPdfFromHtml(parent, html, defaultName);
});

ipcMain.handle('export:phsWord', async function (event, payload) {
  var html = payload && payload.html;
  var defaultName = (payload && payload.defaultName) || 'Personnel-History-Statement.doc';
  if (!html || typeof html !== 'string') return { ok: false, error: 'Missing HTML' };
  var parent = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  var result = await dialog.showSaveDialog(parent || undefined, {
    title: 'Save for Microsoft Word',
    defaultPath: path.join(app.getPath('documents'), defaultName),
    filters: [
      { name: 'Word document', extensions: ['doc'] },
      { name: 'Web page', extensions: ['html'] },
    ],
  });
  if (result.canceled || !result.filePath) return { ok: false };
  var bom = '\ufeff';
  fs.writeFileSync(result.filePath, bom + html, 'utf8');
  return { ok: true, filePath: result.filePath };
});
