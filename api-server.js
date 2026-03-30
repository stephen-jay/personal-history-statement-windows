const express = require('express');
const { Pool } = require('pg');
const crypto = require('crypto');
require('dotenv').config({ override: true });

const DATABASE_URL = process.env.DATABASE_URL || '';
const PORT = Number(process.env.API_PORT || process.env.PORT || 3210);

if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL');
  process.exit(1);
}

const app = express();
const pool = new Pool({ connectionString: DATABASE_URL });

app.use(express.json({ limit: '6mb' }));

const REMOVED_FIELDS = new Set(['brOfSvc']);

// ---------------------------------------------------------------------------
// Minimal auth (no extra npm deps): HMAC-signed tokens + pgcrypto password check.
// ---------------------------------------------------------------------------
const AUTH_SECRET = process.env.AUTH_SECRET || '';

function base64UrlEncode(input) {
  const b64 = Buffer.from(input).toString('base64');
  return b64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlEncodeBuf(buf) {
  const b64 = Buffer.from(buf).toString('base64');
  return b64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlDecodeToString(b64url) {
  const b64 = String(b64url).replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  return Buffer.from(b64 + pad, 'base64').toString('utf8');
}

function signToken(payload) {
  if (!AUTH_SECRET) throw new Error('AUTH_SECRET not configured on API server.');
  const payloadJson = JSON.stringify(payload || {});
  const payloadB64 = base64UrlEncode(payloadJson);
  const sig = crypto.createHmac('sha256', AUTH_SECRET).update(payloadB64).digest();
  const sigB64 = base64UrlEncodeBuf(sig);
  return 'phs.' + payloadB64 + '.' + sigB64;
}

function verifyToken(token) {
  if (!token) return null;
  if (!AUTH_SECRET) throw new Error('AUTH_SECRET not configured on API server.');
  const t = String(token).trim();
  if (!t.startsWith('phs.')) return null;
  const parts = t.split('.');
  if (parts.length !== 3) return null;
  const payloadB64 = parts[1];
  const sigB64 = parts[2];
  const expectedSig = crypto.createHmac('sha256', AUTH_SECRET).update(payloadB64).digest();
  const expectedSigB64 = base64UrlEncodeBuf(expectedSig);
  const sigOk = (() => {
    try {
      return crypto.timingSafeEqual(Buffer.from(sigB64), Buffer.from(expectedSigB64));
    } catch (_) {
      return false;
    }
  })();
  if (!sigOk) return null;
  let payload = null;
  try {
    payload = JSON.parse(base64UrlDecodeToString(payloadB64));
  } catch (_) {
    payload = null;
  }
  if (!payload || !payload.sub) return null;
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && typeof payload.exp === 'number' && payload.exp <= now) return null;
  return payload;
}

function requireAuth(req, res, next) {
  const authHeader = req.headers && (req.headers.authorization || req.headers.Authorization);
  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing Bearer token.' });
  }
  try {
    const payload = verifyToken(authHeader.slice('Bearer '.length).trim());
    if (!payload) return res.status(401).json({ error: 'Invalid token.' });
    req.auth = { userId: payload.sub, roles: Array.isArray(payload.roles) ? payload.roles : [], username: payload.username || '' };
    next();
  } catch (e) {
    return res.status(500).json({ error: e.message || String(e) });
  }
}

function requireAnyRole(allowedRoles) {
  const allow = Array.isArray(allowedRoles) ? allowedRoles : [];
  return function (req, res, next) {
    const roles = (req.auth && req.auth.roles) || [];
    const ok = allow.some(function (r) { return roles.includes(r); });
    if (!ok) return res.status(403).json({ error: 'Forbidden.' });
    next();
  };
}

const requireAdmin = requireAnyRole(['admin']);
const requirePersonnelRead = requireAnyRole(['admin', 'viewer', 'encoder']);
const requirePersonnelWrite = requireAnyRole(['admin', 'encoder']);
const requirePersonnelDelete = requireAnyRole(['admin']);

function sanitizeRecord(record) {
  return Object.fromEntries(Object.entries(record || {}).filter(([key]) => !REMOVED_FIELDS.has(key)));
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
  photoDataUrl: 'photo_data_url',
};

const CHILD_TABLES = [
  {
    sourceKey: 'children',
    table: 'personnel_children',
    map: { name: 'name', dob: 'dob', citizenshipAddress: 'citizenship_address', fatherMother: 'father_mother' },
  },
  {
    sourceKey: 'placesOfResidence',
    table: 'personnel_places_of_residence',
    map: { inclusiveDates: 'inclusive_dates', address: 'address' },
  },
  {
    sourceKey: 'employmentHistory',
    table: 'personnel_employment_history',
    map: { inclusiveDate: 'inclusive_date', type: 'type', employerAddress: 'employer_address', reasonForLeaving: 'reason_for_leaving' },
  },
  {
    sourceKey: 'seminarsTraining',
    table: 'personnel_seminars_training',
    map: { inclusiveDate: 'inclusive_date', name: 'name', conductedBy: 'conducted_by', remarks: 'remarks' },
  },
  {
    sourceKey: 'foreignCountries',
    table: 'personnel_foreign_countries',
    map: { dateOfVisit: 'date_of_visit', country: 'country', purpose: 'purpose', addressAbroad: 'address_abroad' },
  },
  {
    sourceKey: 'banksCredit',
    table: 'personnel_banks_credit',
    map: { name: 'name', address: 'address', natureOfAccount: 'nature_of_account' },
  },
  { sourceKey: 'creditReferences', table: 'personnel_credit_references', map: { name: 'name', address: 'address' } },
  { sourceKey: 'characterRefs', table: 'personnel_character_refs', map: { name: 'name', address: 'address' } },
  { sourceKey: 'neighbors', table: 'personnel_neighbors', map: { name: 'name', address: 'address' } },
  {
    sourceKey: 'organizations',
    table: 'personnel_organizations',
    map: { organization: 'organization', address: 'address', membershipDate: 'membership_date', positionHeld: 'position_held' },
  },
  {
    sourceKey: 'languages',
    table: 'personnel_languages',
    map: { languageDialect: 'language_dialect', speak: 'speak', read: 'read', write: 'write' },
  },
];

function normalizeFromDbRow(row) {
  const out = {
    id: row.id,
    version: typeof row.version === 'number' ? row.version : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
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

async function getPostgresData() {
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
    const cols = [];
    const vals = [];
    Object.keys(PERSONNEL_FIELD_MAP).forEach(function (srcKey) {
      cols.push(PERSONNEL_FIELD_MAP[srcKey]);
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
        throw new Error('Concurrency conflict: record already exists. Reload the roster and retry your save.');
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
        throw new Error('Concurrency conflict: this record was updated by someone else. Reload and apply your changes again.');
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
      updatedAt: nextUpdatedAt ? new Date(nextUpdatedAt).toISOString() : new Date().toISOString(),
    };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function deletePostgresRecord(id, expectedVersion) {
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
      throw new Error('Concurrency conflict: record already changed or removed. Reload the roster before deleting.');
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

app.post('/auth/login', async function (req, res) {
  const body = req.body || {};
  const username = String(body.username || '').trim();
  const password = String(body.password || '');
  if (!username || !password) return res.status(400).json({ error: 'username and password required.' });

  try {
    // Password verification uses pgcrypto crypt() against stored hash.
    // Stored hashes are expected to come from crypt(..., gen_salt('bf')).
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

    if (!rows.rows || !rows.rows.length) return res.status(401).json({ error: 'Invalid credentials.' });

    const user = rows.rows[0];
    const now = Math.floor(Date.now() / 1000);
    const ttlSeconds = 60 * 60 * 8; // 8 hours
    const payload = {
      sub: user.id,
      username: user.username,
      roles: Array.isArray(user.roles) ? user.roles : [],
      iat: now,
      exp: now + ttlSeconds,
      iss: 'phs-api',
    };
    const token = signToken(payload);
    res.json({ token: token, user: { id: user.id, username: user.username, fullName: user.full_name, roles: payload.roles } });
  } catch (e) {
    res.status(500).json({ error: e && e.message ? e.message : String(e) });
  }
});

app.get('/auth/me', requireAuth, async function (req, res) {
  res.json({ userId: req.auth.userId, roles: req.auth.roles, username: req.auth.username });
});

app.get('/admin/roles', requireAuth, requireAdmin, async function (_req, res) {
  try {
    const rows = await pool.query('SELECT name FROM app_roles ORDER BY name ASC');
    const roles = (rows.rows || []).map(function (r) { return r.name; });
    res.json({ roles: roles });
  } catch (e) {
    res.status(500).json({ error: e && e.message ? e.message : String(e) });
  }
});

app.post('/admin/users', requireAuth, requireAdmin, async function (req, res) {
  const body = req.body || {};
  const username = String(body.username || '').trim();
  const password = String(body.password || '');
  const fullName = String(body.fullName || body.full_name || '').trim();
  const roleName = String(body.roleName || body.role || '').trim();

  if (!username || !password || !roleName) {
    return res.status(400).json({ error: 'username, password, and roleName are required.' });
  }

  try {
    const roleRow = await pool.query('SELECT id FROM app_roles WHERE name = $1', [roleName]);
    if (!roleRow.rows || !roleRow.rows.length) return res.status(400).json({ error: 'Unknown roleName.' });
    const roleId = roleRow.rows[0].id;

    await pool.query('BEGIN');
    const inserted = await pool.query(
      `
        INSERT INTO app_users (username, password_hash, full_name, is_active)
        VALUES ($1, crypt($2, gen_salt('bf')), $3, TRUE)
        RETURNING id, username, full_name
      `,
      [username, password, fullName]
    );

    const userId = inserted.rows && inserted.rows[0] ? inserted.rows[0].id : null;
    if (!userId) throw new Error('Failed to create user.');

    await pool.query('INSERT INTO app_user_roles (user_id, role_id) VALUES ($1, $2)', [userId, roleId]);
    await pool.query('COMMIT');

    res.json({ ok: true, user: { id: userId, username: username, fullName: fullName, roleName: roleName } });
  } catch (e) {
    try { await pool.query('ROLLBACK'); } catch (_) {}
    // 23505 = unique_violation
    if (e && e.code === '23505') return res.status(409).json({ error: 'Username already exists.' });
    res.status(500).json({ error: e && e.message ? e.message : String(e) });
  }
});

app.get('/health', async function (_req, res) {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || String(e) });
  }
});

app.get('/personnel', requireAuth, requirePersonnelRead, async function (_req, res) {
  try {
    const rows = await getPostgresData();
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

app.post('/personnel', requireAuth, requirePersonnelWrite, async function (req, res) {
  try {
    const saved = await savePostgresRecord(req.body || {});
    res.json(saved);
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    const status = /Concurrency conflict/i.test(msg) ? 409 : 500;
    res.status(status).json({ error: msg });
  }
});

app.delete('/personnel/:id', requireAuth, requirePersonnelDelete, async function (req, res) {
  try {
    const id = req.params.id;
    const version = req.query.version;
    const ok = await deletePostgresRecord(id, version);
    res.json({ ok: ok });
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    const status = /Concurrency conflict/i.test(msg) ? 409 : 500;
    res.status(status).json({ error: msg });
  }
});

app.listen(PORT, function () {
  console.log('APOLLO API listening on port', PORT);
});
