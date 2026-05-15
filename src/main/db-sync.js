/**
 * db-sync.js
 *
 * Periodic one-way sync from the primary Postgres (Ubuntu) into the Supabase
 * fallback. Treats Supabase as a read-only mirror — fully replaced on each run.
 *
 * Tables synced: personnel, all personnel_* child tables, cards,
 * personnel_card_registrations, audit_logs.
 */

const dbManager = require('./db-manager');
const { CARD_REGISTRATION_TABLE, CHILD_TABLES } = require('../shared/schema');

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const DEFAULT_BATCH_SIZE = 50;

function getSyncTables() {
  const childTables = CHILD_TABLES.map(function (def) { return def.table; });
  return ['personnel'].concat(childTables, ['cards', CARD_REGISTRATION_TABLE, 'audit_logs']);
}

let syncTimer = null;
let inFlight = false;
let lastResult = null;

function getStatus() {
  return {
    running: inFlight,
    last: lastResult,
    intervalMs: DEFAULT_INTERVAL_MS,
    enabled: Boolean(syncTimer),
  };
}

function startPeriodicSync(options) {
  if (syncTimer) return;
  const intervalMs = (options && options.intervalMs) || DEFAULT_INTERVAL_MS;
  setTimeout(function () { runSync().catch(function () {}); }, 30 * 1000);
  syncTimer = setInterval(function () { runSync().catch(function () {}); }, intervalMs);
  console.log('[DB-SYNC] periodic sync scheduled every ' + Math.round(intervalMs / 1000) + 's');
}

function stopPeriodicSync() {
  if (syncTimer) { clearInterval(syncTimer); syncTimer = null; }
}

async function runSync() {
  if (inFlight) return { ok: false, error: 'Sync already in progress', skipped: true };
  inFlight = true;
  const startedAt = Date.now();
  try {
    const ubuntuPool = dbManager.getUbuntuPool();
    const supabasePool = dbManager.getSupabasePool();
    if (!ubuntuPool) throw new Error('Primary Postgres is not configured');
    if (!supabasePool) throw new Error('Supabase fallback is not configured');
    if (dbManager.getActiveTier() !== 'ubuntu') {
      throw new Error('Primary tier is not currently active; refusing to sync');
    }

    const tables = getSyncTables();
    console.log('[DB-SYNC] reading snapshot from primary…');
    const readStart = Date.now();
    const snapshot = await readSnapshot(ubuntuPool, tables);
    console.log('[DB-SYNC] snapshot read in ' + (Date.now() - readStart) + 'ms');
    console.log('[DB-SYNC] writing snapshot to Supabase…');
    const writeStart = Date.now();
    const tableStats = await writeSnapshot(supabasePool, tables, snapshot);
    console.log('[DB-SYNC] snapshot written in ' + (Date.now() - writeStart) + 'ms');

    const result = { ok: true, durationMs: Date.now() - startedAt, finishedAt: new Date().toISOString(), tables: tableStats };
    lastResult = result;
    console.log('[DB-SYNC] completed in ' + result.durationMs + 'ms');
    return result;
  } catch (e) {
    const result = { ok: false, durationMs: Date.now() - startedAt, finishedAt: new Date().toISOString(), error: e && e.message ? e.message : String(e) };
    lastResult = result;
    console.warn('[DB-SYNC] failed:', result.error);
    return result;
  } finally {
    inFlight = false;
  }
}

async function readSnapshot(pool, tables) {
  const client = await pool.connect();
  const snapshot = new Map();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    for (const tableName of tables) {
      const exists = await tableExists(client, tableName);
      if (!exists) { snapshot.set(tableName, null); continue; }
      const colInfo = await client.query(
        "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position", [tableName]
      );
      const columns = colInfo.rows.map(function (r) { return r.column_name; });
      const dataRes = await client.query('SELECT * FROM ' + quoteIdent(tableName));
      snapshot.set(tableName, { columns: columns, rows: dataRes.rows });
    }
    await client.query('COMMIT');
    return snapshot;
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw e;
  } finally {
    try { client.release(); } catch (_) {}
  }
}

async function writeSnapshot(supabasePool, tables, snapshot) {
  const client = await supabasePool.connect();
  const stats = [];
  try {
    await client.query('BEGIN');
    try { await client.query("SET LOCAL session_replication_role = 'replica'"); } catch (_) {}

    // Truncate in reverse order
    for (let i = tables.length - 1; i >= 0; i--) {
      const t = tables[i];
      if (!snapshot.get(t)) continue;
      const exists = await tableExists(client, t);
      if (exists) await client.query('TRUNCATE TABLE ' + quoteIdent(t) + ' RESTART IDENTITY CASCADE');
    }

    // Insert in forward order
    for (const tableName of tables) {
      const data = snapshot.get(tableName);
      if (!data) { stats.push({ table: tableName, rows: 0, skipped: 'missing-on-primary' }); continue; }
      const exists = await tableExists(client, tableName);
      if (!exists) { stats.push({ table: tableName, rows: 0, skipped: 'missing-on-destination' }); continue; }

      const destCols = await getTableColumns(client, tableName);
      const destSet = new Set(destCols);
      const useColumns = data.columns.filter(function (c) { return destSet.has(c); });
      if (!useColumns.length) { stats.push({ table: tableName, rows: 0, skipped: 'no-shared-columns' }); continue; }

      let inserted = 0;
      for (let offset = 0; offset < data.rows.length; offset += DEFAULT_BATCH_SIZE) {
        const slice = data.rows.slice(offset, offset + DEFAULT_BATCH_SIZE);
        const valuesSql = [];
        const params = [];
        let p = 1;
        for (const row of slice) {
          const placeholders = [];
          for (const col of useColumns) {
            placeholders.push('$' + (p++));
            params.push(row[col]);
          }
          valuesSql.push('(' + placeholders.join(', ') + ')');
        }
        const sql = 'INSERT INTO ' + quoteIdent(tableName) + ' (' + useColumns.map(quoteIdent).join(', ') + ') VALUES ' + valuesSql.join(', ');
        await client.query(sql, params);
        inserted += slice.length;
      }
      console.log('[DB-SYNC]   ' + tableName + ': ' + inserted + ' rows');
      stats.push({ table: tableName, rows: inserted });
    }

    await client.query('COMMIT');
    return stats;
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw e;
  } finally {
    try { client.release(); } catch (_) {}
  }
}

async function tableExists(client, tableName) {
  const res = await client.query("SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1", [tableName]);
  return res.rowCount > 0;
}

async function getTableColumns(client, tableName) {
  const res = await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1", [tableName]);
  return res.rows.map(function (r) { return r.column_name; });
}

function quoteIdent(name) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) return '"' + String(name).replace(/"/g, '""') + '"';
  return name;
}

module.exports = {
  startPeriodicSync,
  stopPeriodicSync,
  runSync,
  getStatus,
};
