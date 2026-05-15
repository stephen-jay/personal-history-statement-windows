const fs = require('fs');
const path = require('path');
const { REMOVED_FIELDS, CARD_REGISTRATION_TABLE, PERSONNEL_FIELD_MAP, CHILD_TABLES } = require('../shared/schema');
const dbManager = require('./db-manager');

let dataFile = null;

/**
 * Initialize the database layer.
 * Delegates pool management to db-manager which handles the
 * 3-tier fallback: Ubuntu PostgreSQL → Supabase → Local JSON.
 *
 * @param {string} url       - Primary (Ubuntu) PostgreSQL connection string
 * @param {string} jsonPath  - Path to local JSON fallback file
 */
function initDatabase(url, jsonPath) {
  dataFile = jsonPath;
  const supabaseDbUrl = process.env.SUPABASE_DB_URL || '';
  console.log('[DB] initDatabase: starting 3-tier connection manager');
  console.log('[DB] primary (masked):', String(url || '').replace(/:(?:[^:]+)@/, ':****@'));
  console.log('[DB] supabase fallback:', supabaseDbUrl ? 'configured' : 'not configured');
  dbManager.initDbManager(url, supabaseDbUrl);
}

/**
 * Returns the currently active PostgreSQL pool (Ubuntu or Supabase),
 * or null if the local JSON fallback is active.
 */
function getPgPool() {
  return dbManager.getActivePool();
}

async function closeDatabase() {
  await dbManager.closeDbManager();
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
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    cardUID: row.card_uid || null
  };
  Object.keys(PERSONNEL_FIELD_MAP).forEach(function (srcKey) {
    out[srcKey] = row[PERSONNEL_FIELD_MAP[srcKey]];
  });
  return out;
}

// Heavy base64 columns excluded from the slim list payload. Per measured DB
// stats (~1 MB per thumb mark, ~200 KB per handwritten entry, ~80 KB per
// signature) these columns alone account for >95% of the personnel table's
// payload. The roster avatar uses photo_data_url (~13 KB) which we keep.
const HEAVY_LIST_FIELDS = new Set([
  'signatureDataUrl',
  'handwrittenEntryDataUrl',
  'leftThumbMarkDataUrl',
  'rightThumbMarkDataUrl'
]);

function buildListColumnList() {
  // Scalar/light columns + photo, no signatures/thumb marks/handwriting.
  const cols = ['id', 'version', 'updated_at'];
  Object.keys(PERSONNEL_FIELD_MAP).forEach(function (srcKey) {
    if (HEAVY_LIST_FIELDS.has(srcKey)) return;
    cols.push(PERSONNEL_FIELD_MAP[srcKey]);
  });
  return cols;
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

async function hasTable(client, tableName) {
  const result = await client.query('SELECT to_regclass($1) AS regclass', ['public.' + tableName]);
  return !!(result.rows && result.rows[0] && result.rows[0].regclass);
}

async function ensureCardRegistrationTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS personnel_card_registrations (
      personnel_id text PRIMARY KEY REFERENCES personnel(id) ON DELETE CASCADE,
      card_uid text UNIQUE NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT NOW(),
      created_at timestamptz NOT NULL DEFAULT NOW()
    )
  `);
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

async function getPostgresList() {
  // Slim roster payload: scalar fields + small avatar (photo_data_url).
  // Skips signatures, handwritten entry, and thumb-mark columns (~2 MB/row),
  // and skips child tables entirely. Roster + dashboard only need this.
  const records = await dbManager.runWithFailover(async function (pool) {
    const client = await pool.connect();
    try {
      const personnelColumnSet = await dbManager_getPersonnelColumns(client);
      const wantCols = buildListColumnList().filter(function (c) { return personnelColumnSet.has(c); });
      const colsSql = wantCols.map(function (c) { return '"' + c + '"'; }).join(', ');
      const baseRes = await client.query(
        'SELECT ' + colsSql + ' FROM personnel WHERE deleted_at IS NULL ORDER BY updated_at DESC'
      );
      const rows = baseRes.rows.map(normalizeFromDbRow);
      if (!rows.length) return [];
      // Attach card UID (single small extra query, same connection).
      const ids = rows.map(function (r) { return r.id; });
      const cardTableExistsRes = await client.query("SELECT to_regclass($1) AS regclass", ['public.' + CARD_REGISTRATION_TABLE]);
      if (cardTableExistsRes.rows && cardTableExistsRes.rows[0] && cardTableExistsRes.rows[0].regclass) {
        const cardRows = await client.query(
          'SELECT personnel_id, card_uid FROM ' + CARD_REGISTRATION_TABLE + ' WHERE personnel_id = ANY($1::text[])',
          [ids]
        );
        const cardByPersonnelId = new Map();
        (cardRows.rows || []).forEach(function (r) { cardByPersonnelId.set(r.personnel_id, r.card_uid || null); });
        rows.forEach(function (rec) {
          rec.cardUID = cardByPersonnelId.get(rec.id) || rec.cardUID || null;
        });
      }
      return rows;
    } finally {
      try { client.release(); } catch (_) {}
    }
  });
  if (records == null) {
    throw new Error('No PostgreSQL tier is currently reachable');
  }
  return records;
}

// Cache the personnel column set briefly to avoid re-querying every call.
let _personnelColumnSetCache = null;
let _personnelColumnSetCacheAt = 0;
async function dbManager_getPersonnelColumns(clientOrPool) {
  const now = Date.now();
  if (_personnelColumnSetCache && (now - _personnelColumnSetCacheAt) < 60000) {
    return _personnelColumnSetCache;
  }
  const r = await clientOrPool.query(
    "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'personnel'"
  );
  const set = new Set((r.rows || []).map(function (row) { return row.column_name; }));
  _personnelColumnSetCache = set;
  _personnelColumnSetCacheAt = now;
  return set;
}

async function getPostgresOne(id) {
  // Full record for a single personnel: heavy image columns + all child tables.
  if (!id) return null;
  const NOT_FOUND = '__NOT_FOUND__';
  const result = await dbManager.runWithFailover(async function (pool) {
    const client = await pool.connect();
    try {
      const baseRes = await client.query(
        'SELECT * FROM personnel WHERE id = $1 AND deleted_at IS NULL LIMIT 1',
        [id]
      );
      if (!baseRes.rowCount) return NOT_FOUND;
      const rec = normalizeFromDbRow(baseRes.rows[0]);

      const cardTableExists = await hasTable(client, CARD_REGISTRATION_TABLE);
      if (cardTableExists) {
        const cardRes = await client.query(
          'SELECT card_uid FROM ' + CARD_REGISTRATION_TABLE + ' WHERE personnel_id = $1 LIMIT 1',
          [id]
        );
        if (cardRes.rowCount) {
          rec.cardUID = cardRes.rows[0].card_uid || rec.cardUID || null;
        }
      }

      for (const def of CHILD_TABLES) {
        const q = await client.query(
          'SELECT * FROM ' + def.table + ' WHERE personnel_id = $1 ORDER BY id ASC',
          [id]
        );
        rec[def.sourceKey] = (q.rows || []).map(function (row) {
          const item = {};
          Object.keys(def.map).forEach(function (srcKey) {
            item[srcKey] = row[def.map[srcKey]];
          });
          return item;
        });
      }
      return rec;
    } finally {
      try { client.release(); } catch (_) {}
    }
  });
  if (result == null) {
    throw new Error('No PostgreSQL tier is currently reachable');
  }
  if (result === NOT_FOUND) return null;
  return result;
}

async function getPostgresData() {
  const records = await dbManager.runWithFailover(async function (pool) {
    const client = await pool.connect();
    try {
      const base = await client.query('SELECT * FROM personnel WHERE deleted_at IS NULL ORDER BY updated_at DESC');
      const rows = base.rows.map(normalizeFromDbRow);
      if (!rows.length) return [];
      const ids = rows.map((r) => r.id);
      const cardTableExists = await hasTable(client, CARD_REGISTRATION_TABLE);
      const cardByPersonnelId = new Map();
      if (cardTableExists) {
        const cardRows = await client.query(
          'SELECT personnel_id, card_uid FROM ' + CARD_REGISTRATION_TABLE + ' WHERE personnel_id = ANY($1::text[])',
          [ids]
        );
        (cardRows.rows || []).forEach(function (row) {
          cardByPersonnelId.set(row.personnel_id, row.card_uid || null);
        });
      }
      const childGrouped = {};
      for (const def of CHILD_TABLES) {
        const q = await client.query('SELECT * FROM ' + def.table + ' WHERE personnel_id = ANY($1::text[]) ORDER BY id ASC', [ids]);
        childGrouped[def.sourceKey] = groupByPersonnelId(q.rows);
      }
      rows.forEach(function (rec) {
        rec.cardUID = cardByPersonnelId.get(rec.id) || rec.cardUID || null;
        for (const def of CHILD_TABLES) {
          const childRows = (childGrouped[def.sourceKey] && childGrouped[def.sourceKey].get(rec.id)) || [];
          rec[def.sourceKey] = childRows.map(function (row) {
            const item = {};
            Object.keys(def.map).forEach(function (srcKey) {
              item[srcKey] = row[def.map[srcKey]];
            });
            return item;
          });
        }
      });
      return rows;
    } finally {
      client.release();
    }
  });
  if (records == null) {
    throw new Error('No PostgreSQL tier is currently reachable');
  }
  return records;
}

async function savePostgresRecord(record, currentUserId) {
  const safe = sanitizeRecord(record);
  const id = safe.id || String(Date.now());
  const expectedVersion =
    safe.version == null || safe.version === ''
      ? null
      : Number.isFinite(Number(safe.version))
        ? Number(safe.version)
        : null;
  const result = await dbManager.runWithFailover(async function (pool) {
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

      let cardTableExists = await hasTable(client, CARD_REGISTRATION_TABLE);
      if (cardTableExists && Object.prototype.hasOwnProperty.call(safe, 'cardUID')) {
        const cardUID = safe.cardUID == null ? '' : String(safe.cardUID).trim();
        if (cardUID) {
          await client.query(
            'INSERT INTO ' + CARD_REGISTRATION_TABLE + ' (personnel_id, card_uid) VALUES ($1, $2) ON CONFLICT (personnel_id) DO UPDATE SET card_uid = EXCLUDED.card_uid, updated_at = NOW()',
            [id, cardUID]
          );
        } else {
          await client.query('DELETE FROM ' + CARD_REGISTRATION_TABLE + ' WHERE personnel_id = $1', [id]);
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
      try { await client.query('ROLLBACK'); } catch (_) { /* connection may already be dead */ }
      if (e && e.code === '23505' && /card_uid|personnel_card_registrations/i.test(String(e.constraint || '') + ' ' + String(e.detail || ''))) {
        throw new Error('This card is already linked to another personnel record. Use a different card or unlink it first.');
      }
      throw e;
    } finally {
      try { client.release(); } catch (_) {}
    }
  });
  if (result == null) {
    throw new Error('No PostgreSQL tier is currently reachable for write');
  }
  return result;
}

async function deletePostgresRecord(id, expectedVersion, currentUserId) {
  if (expectedVersion == null || expectedVersion === '') {
    throw new Error('Concurrency conflict: missing record version for delete.');
  }
  const ver = Number(expectedVersion);
  if (!Number.isFinite(ver)) {
    throw new Error('Concurrency conflict: invalid record version for delete.');
  }
  const result = await dbManager.runWithFailover(async function (pool) {
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
      try { await client.query('ROLLBACK'); } catch (_) {}
      throw e;
    } finally {
      try { client.release(); } catch (_) {}
    }
  });
  if (result == null) {
    throw new Error('No PostgreSQL tier is currently reachable for delete');
  }
  return result;
}

module.exports = {
  initDatabase,
  getPgPool,
  getData,
  saveJsonRecord,
  deleteJsonRecord,
  getPostgresData,
  getPostgresList,
  getPostgresOne,
  savePostgresRecord,
  deletePostgresRecord,
  closeDatabase
};
