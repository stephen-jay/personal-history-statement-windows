/**
 * db-sync.js
 *
 * Periodic one-way sync from the primary Postgres (Ubuntu) into the Supabase
 * fallback. Treats Supabase as a read-only mirror — it is fully replaced on
 * each run rather than being incrementally updated, which keeps the logic
 * simple and avoids drift.
 *
 * Tables synced (in dependency order):
 *   - personnel (parent)
 *   - all personnel_* child tables (defined in shared/schema.js)
 *   - cards
 *   - personnel_card_registrations (if present)
 *
 * Strategy per run:
 *   1. Read all rows from the primary inside a single transaction
 *      (REPEATABLE READ) so the snapshot is consistent.
 *   2. On Supabase, run inside a transaction:
 *        SET session_replication_role = replica  (defer FK checks)
 *        TRUNCATE <child tables, personnel_card_registrations, cards, personnel> RESTART IDENTITY CASCADE
 *        INSERT batched rows for each table
 *      COMMIT — readers either see the old snapshot or the new one, never
 *      partial state.
 *
 * Safety:
 *   - Never runs unless the primary is reachable (so a degraded primary
 *     can't wipe Supabase).
 *   - Never runs if Supabase isn't configured.
 *   - All errors are caught; a failed run leaves the previous Supabase
 *     contents intact (the transaction is rolled back).
 */

const dbManager = require('./db-manager');
const { CARD_REGISTRATION_TABLE, CHILD_TABLES } = require('../shared/schema');

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const DEFAULT_BATCH_SIZE = 50;             // INSERT rows per round-trip

// Tables synced in dependency order (parents first on insert; reverse order
// is used for TRUNCATE to satisfy FK constraints when CASCADE isn't enabled).
function getSyncTablePlan() {
  const childTables = CHILD_TABLES.map(function (def) { return def.table; });
  return {
    parents: ['personnel'],
    children: childTables.concat(['cards', CARD_REGISTRATION_TABLE]),
  };
}

let syncTimer = null;
let inFlight = false;
let lastResult = null; // { ok, durationMs, tables, error, finishedAt }

function getStatus() {
  return {
    running: inFlight,
    last: lastResult,
    intervalMs: DEFAULT_INTERVAL_MS,
    enabled: Boolean(syncTimer),
  };
}

/**
 * Start the periodic background sync. Safe to call multiple times — only
 * the first call schedules the interval.
 *
 * @param {{ intervalMs?: number }} [options]
 */
function startPeriodicSync(options) {
  if (syncTimer) return;
  const intervalMs = (options && options.intervalMs) || DEFAULT_INTERVAL_MS;

  // First run: short delay so the manager has a chance to probe tiers.
  setTimeout(function () { runSync().catch(function () {}); }, 30 * 1000);

  syncTimer = setInterval(function () {
    runSync().catch(function () {});
  }, intervalMs);
  console.log('[DB-SYNC] periodic sync scheduled every ' + Math.round(intervalMs / 1000) + 's');
}

function stopPeriodicSync() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
}

/**
 * Run a single sync pass primary → Supabase. Returns a status object with
 * either { ok: true, ... } or { ok: false, error }.
 */
async function runSync() {
  if (inFlight) {
    return { ok: false, error: 'A sync is already in progress', skipped: true };
  }
  inFlight = true;
  const startedAt = Date.now();
  try {
    const ubuntuPool = dbManager.getUbuntuPool();
    const supabasePool = dbManager.getSupabasePool();
    if (!ubuntuPool) {
      throw new Error('Primary Postgres is not configured');
    }
    if (!supabasePool) {
      throw new Error('Supabase fallback is not configured');
    }
    if (dbManager.getActiveTier() !== 'ubuntu') {
      // Refuse to sync when primary is degraded — a flaky primary
      // shouldn't replace good Supabase data with empty/partial data.
      throw new Error('Primary tier is not currently active; refusing to sync');
    }

    const plan = getSyncTablePlan();
    console.log('[DB-SYNC] reading snapshot from primary…');
    const readStart = Date.now();
    const snapshot = await readSnapshot(ubuntuPool, plan);
    console.log('[DB-SYNC] snapshot read in ' + (Date.now() - readStart) + 'ms');
    console.log('[DB-SYNC] writing snapshot to Supabase…');
    const writeStart = Date.now();
    const tableStats = await writeSnapshot(supabasePool, plan, snapshot);
    console.log('[DB-SYNC] snapshot written in ' + (Date.now() - writeStart) + 'ms');

    const result = {
      ok: true,
      durationMs: Date.now() - startedAt,
      finishedAt: new Date().toISOString(),
      tables: tableStats,
    };
    lastResult = result;
    console.log('[DB-SYNC] completed in ' + result.durationMs + 'ms', tableStats);
    return result;
  } catch (e) {
    const result = {
      ok: false,
      durationMs: Date.now() - startedAt,
      finishedAt: new Date().toISOString(),
      error: e && e.message ? e.message : String(e),
    };
    lastResult = result;
    console.warn('[DB-SYNC] failed:', result.error);
    return result;
  } finally {
    inFlight = false;
  }
}

/**
 * Read all source rows from the primary inside a single REPEATABLE READ
 * transaction so we have a consistent snapshot.
 *
 * @returns {Promise<Map<string, { columns: string[], rows: any[][] }>>}
 *   Map keyed by table name.
 */
async function readSnapshot(ubuntuPool, plan) {
  const client = await ubuntuPool.connect();
  const snapshot = new Map();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const allTables = plan.parents.concat(plan.children);
    for (const tableName of allTables) {
      const exists = await tableExists(client, tableName);
      if (!exists) {
        snapshot.set(tableName, { columns: [], rows: [], skipped: 'missing-on-primary' });
        continue;
      }
      // Pull every column the source has so we don't silently drop data
      // when the destination has more columns than we know about.
      const colInfo = await client.query(
        "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position",
        [tableName]
      );
      const columns = colInfo.rows.map(function (r) { return r.column_name; });
      if (!columns.length) {
        snapshot.set(tableName, { columns: [], rows: [], skipped: 'no-columns' });
        continue;
      }
      const quotedCols = columns.map(quoteIdent).join(', ');
      const dataRes = await client.query('SELECT ' + quotedCols + ' FROM ' + quoteIdent(tableName));
      const rows = dataRes.rows.map(function (row) {
        return columns.map(function (c) { return row[c]; });
      });
      snapshot.set(tableName, { columns: columns, rows: rows });
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

/**
 * Replace the contents of the destination tables atomically.
 *
 * @returns {Promise<Array<{ table: string, rows: number, skipped?: string }>>}
 */
async function writeSnapshot(supabasePool, plan, snapshot) {
  const client = await supabasePool.connect();
  const stats = [];
  try {
    await client.query('BEGIN');
    // Defer FK and trigger checks within the transaction. This requires
    // appropriate role privileges on Supabase; if the role can't set
    // session_replication_role we fall back to relying on TRUNCATE CASCADE.
    let replicaRole = false;
    try {
      await client.query("SET LOCAL session_replication_role = 'replica'");
      replicaRole = true;
    } catch (_) {
      replicaRole = false;
    }

    // Truncate in reverse order: children first, then parents. CASCADE on
    // the parent TRUNCATE handles any FK we don't know about.
    const truncOrder = plan.children.slice().reverse().concat(plan.parents);
    for (const tableName of truncOrder) {
      const exists = await tableExists(client, tableName);
      if (!exists) continue;
      await client.query('TRUNCATE TABLE ' + quoteIdent(tableName) + ' RESTART IDENTITY CASCADE');
    }

    // Insert in dependency order: parents first.
    const insertOrder = plan.parents.concat(plan.children);
    for (const tableName of insertOrder) {
      const data = snapshot.get(tableName);
      if (!data || data.skipped) {
        stats.push({ table: tableName, rows: 0, skipped: (data && data.skipped) || 'no-source-data' });
        continue;
      }
      const exists = await tableExists(client, tableName);
      if (!exists) {
        stats.push({ table: tableName, rows: 0, skipped: 'missing-on-destination' });
        continue;
      }
      // Limit destination columns to the intersection of source/dest
      // schemas, so the sync survives modest schema drift.
      const destCols = await getTableColumns(client, tableName);
      const destSet = new Set(destCols);
      const useColumns = data.columns.filter(function (c) { return destSet.has(c); });
      if (!useColumns.length) {
        stats.push({ table: tableName, rows: 0, skipped: 'no-shared-columns' });
        continue;
      }
      const colIndex = useColumns.map(function (c) { return data.columns.indexOf(c); });
      const tStart = Date.now();
      const inserted = await batchedInsert(client, tableName, useColumns, data.rows, colIndex);
      console.log('[DB-SYNC]   ' + tableName + ': ' + inserted + ' rows in ' + (Date.now() - tStart) + 'ms');
      stats.push({ table: tableName, rows: inserted, replicaRole: replicaRole });
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

async function batchedInsert(client, tableName, columns, sourceRows, colIndex) {
  if (!sourceRows.length) return 0;
  const quotedCols = columns.map(quoteIdent).join(', ');
  const colCount = columns.length;
  let total = 0;
  for (let offset = 0; offset < sourceRows.length; offset += DEFAULT_BATCH_SIZE) {
    const slice = sourceRows.slice(offset, offset + DEFAULT_BATCH_SIZE);
    const valuesSql = [];
    const params = [];
    let p = 1;
    for (const sourceRow of slice) {
      const placeholders = [];
      for (let c = 0; c < colCount; c++) {
        placeholders.push('$' + (p++));
        params.push(sourceRow[colIndex[c]]);
      }
      valuesSql.push('(' + placeholders.join(', ') + ')');
    }
    const sql =
      'INSERT INTO ' + quoteIdent(tableName) +
      ' (' + quotedCols + ') VALUES ' + valuesSql.join(', ');
    await client.query(sql, params);
    total += slice.length;
  }
  return total;
}

async function tableExists(client, tableName) {
  const res = await client.query(
    "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1",
    [tableName]
  );
  return res.rowCount > 0;
}

async function getTableColumns(client, tableName) {
  const res = await client.query(
    "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1",
    [tableName]
  );
  return res.rows.map(function (r) { return r.column_name; });
}

function quoteIdent(name) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    // Defensive — these come from our own schema, but escape anything odd
    // just in case.
    return '"' + String(name).replace(/"/g, '""') + '"';
  }
  return name;
}

module.exports = {
  startPeriodicSync,
  stopPeriodicSync,
  runSync,
  getStatus,
};
