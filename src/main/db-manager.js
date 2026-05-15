/**
 * db-manager.js
 * 3-Tier Database Connection Manager
 *
 * Priority:
 *   1. Ubuntu PostgreSQL (primary)     — 10.10.218.144
 *   2. Supabase PostgreSQL (fallback)  — cloud
 *   3. Local JSON file (last resort)   — always available
 *
 * Failover is silent — no user-facing errors.
 * Background health check re-promotes to primary when it recovers.
 */

const { Pool } = require('pg');

const TIER_UBUNTU   = 'ubuntu';
const TIER_SUPABASE = 'supabase';
const TIER_LOCAL    = 'local';

const CONNECTION_TIMEOUT_MS = 3000;         // 3s per-tier probe timeout (optimized for LAN/Fast Cloud)
const HEALTH_CHECK_INTERVAL_MS = 30 * 1000; // 30 seconds
const MAX_RETRIES = 1;                      // Reduced retries for faster failover
const RETRY_DELAY_MS = 1000;                // Delay between retries
const PROMOTE_THRESHOLD = 3;                // Consecutive successful probes before promoting back

// Patterns that indicate the active pool's tier is unreachable (vs. a real
// query/data error). When we see one of these on a query, we immediately mark
// the current tier as failed and fall through to the next one — instead of
// waiting for the 30-second background health check to flip the tier.
const CONNECTION_ERROR_PATTERN = /timeout exceeded when trying to connect|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|EHOSTUNREACH|EHOSTDOWN|ENETUNREACH|connection terminated|server closed the connection|terminating connection due to administrator command|read ECONNRESET/i;

function isConnectionError(err) {
  if (!err) return false;
  const msg = String(err.message || err.code || err);
  return CONNECTION_ERROR_PATTERN.test(msg);
}

/**
 * Mark the current tier as failed and downgrade to the next-best tier.
 * Called from runWithFailover when a query fails with a connection error.
 */
function markActiveTierFailed(reason) {
  const previous = activeTier;
  if (previous === TIER_UBUNTU) {
    activeTier = supabasePool ? TIER_SUPABASE : TIER_LOCAL;
  } else if (previous === TIER_SUPABASE) {
    activeTier = TIER_LOCAL;
  }
  if (previous !== activeTier) {
    console.log(`[DB-MANAGER] ${previous} unreachable mid-query (${reason || 'connection error'}) — downgrading to ${activeTier}`);
  }
}

let ubuntuPool    = null;
let supabasePool  = null;
let activeTier    = TIER_LOCAL;
let healthTimer   = null;
let _initialized  = false;
let ubuntuPromoteCount = 0;   // consecutive successful probes while not on ubuntu
let supabasePromoteCount = 0; // consecutive successful probes while on local

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Test if a pool can serve a query within its configured timeout window.
 * Relies on Pool's connectionTimeoutMillis.
 * @param {Pool} pool
 * @param {number} retries - Number of additional attempts if the first one fails
 * @returns {Promise<boolean>}
 */
async function testPool(pool, retries = 0) {
  if (!pool) return false;
  
  for (let i = 0; i <= retries; i++) {
    let client = null;
    try {
      // pool.connect() will throw if it exceeds its connectionTimeoutMillis
      client = await pool.connect();
      await client.query('SELECT 1');
      return true;
    } catch (e) {
      console.warn(`[DB-MANAGER] Pool test attempt ${i + 1} failed:`, e.message || e);
      if (i < retries) {
        console.log(`[DB-MANAGER] Retrying in ${RETRY_DELAY_MS}ms...`);
        await new Promise(res => setTimeout(res, RETRY_DELAY_MS));
      }
    } finally {
      if (client) {
        try { 
          // Use release(true) if there was an error to ensure the connection is destroyed
          // but pg handles this mostly. Still, we want to be safe.
          client.release(); 
        } catch (_) {}
      }
    }
  }
  return false;
}

/**
 * Probe all tiers and set activeTier to the best available one.
 */
async function determineTier() {
  // Use 1 retry for initial probe to be more robust
  if (await testPool(ubuntuPool, 1)) {
    activeTier = TIER_UBUNTU;
  } else if (await testPool(supabasePool, 1)) {
    activeTier = TIER_SUPABASE;
  } else {
    activeTier = TIER_LOCAL;
  }
  console.log('[DB-MANAGER] Active tier:', activeTier);
}

/**
 * Start background health check.
 * If not on primary, checks if primary has recovered.
 * If currently active tier fails, downgrades to next available.
 */
function startHealthCheck() {
  if (healthTimer) clearInterval(healthTimer);
  healthTimer = setInterval(async () => {
    try {
      // 1. Check if we should downgrade (if current tier went offline)
      if (activeTier === TIER_UBUNTU) {
        const ubuntuOk = await testPool(ubuntuPool, MAX_RETRIES);
        if (!ubuntuOk) {
          console.log('[DB-MANAGER] Primary server went offline after retries — downgrading');
          const supabaseOk = await testPool(supabasePool, 1);
          activeTier = supabaseOk ? TIER_SUPABASE : TIER_LOCAL;
        }
      } else if (activeTier === TIER_SUPABASE) {
        const supabaseOk = await testPool(supabasePool, MAX_RETRIES);
        if (!supabaseOk) {
          console.log('[DB-MANAGER] Supabase went offline after retries — downgrading to local');
          activeTier = TIER_LOCAL;
        }
      }

      // 2. Check if we should upgrade (if primary or fallback recovered)
      if (activeTier !== TIER_UBUNTU) {
        const ubuntuOk = await testPool(ubuntuPool);
        if (ubuntuOk) {
          console.log('[DB-MANAGER] Primary server restored — switching back to Ubuntu');
          activeTier = TIER_UBUNTU;
          return;
        }
      }

      if (activeTier === TIER_LOCAL && supabasePool) {
        const supabaseOk = await testPool(supabasePool);
        if (supabaseOk) {
          console.log('[DB-MANAGER] Supabase available — upgrading from local to Supabase');
          activeTier = TIER_SUPABASE;
        }
      }
    } catch (e) {
      console.warn('[DB-MANAGER] Health check error:', e && e.message ? e.message : e);
    }
  }, HEALTH_CHECK_INTERVAL_MS);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Initialize the connection manager.
 * Creates pools immediately (non-blocking) and probes tiers in the background.
 *
 * @param {string} ubuntuUrl    - Primary PostgreSQL connection string
 * @param {string} supabaseDbUrl - Supabase PostgreSQL connection string
 */
function initDbManager(ubuntuUrl, supabaseDbUrl) {
  if (_initialized) return;
  _initialized = true;

  if (ubuntuUrl) {
    try {
      ubuntuPool = new Pool({
        connectionString: ubuntuUrl,
        connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
        idleTimeoutMillis: 30000,
        max: 5,
      });

      // CRITICAL: Handle errors on idle clients to prevent app crashes
      ubuntuPool.on('error', (err) => {
        console.error('[DB-MANAGER] Unexpected error on idle Ubuntu client:', err.message);
      });
    } catch (e) {
      console.warn('[DB-MANAGER] Failed to create Ubuntu pool:', e && e.message ? e.message : e);
    }
  }

  if (supabaseDbUrl) {
    try {
      supabasePool = new Pool({
        connectionString: supabaseDbUrl,
        connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
        idleTimeoutMillis: 30000,
        max: 5,
        ssl: { rejectUnauthorized: false }, // Supabase requires SSL
      });

      // CRITICAL: Handle errors on idle clients to prevent app crashes
      supabasePool.on('error', (err) => {
        console.error('[DB-MANAGER] Unexpected error on idle Supabase client:', err.message);
      });
    } catch (e) {
      console.warn('[DB-MANAGER] Failed to create Supabase pool:', e && e.message ? e.message : e);
    }
  }

  // Non-blocking: determine tier in background, start health checks
  determineTier()
    .then(() => startHealthCheck())
    .catch(e => {
      console.warn('[DB-MANAGER] Init probe failed:', e && e.message ? e.message : e);
      startHealthCheck();
    });
}

/**
 * Get the currently active PostgreSQL pool.
 * Returns null if local JSON fallback is active.
 *
 * @returns {Pool|null}
 */
function getActivePool() {
  switch (activeTier) {
    case TIER_UBUNTU:   return ubuntuPool;
    case TIER_SUPABASE: return supabasePool;
    default:            return null; // TIER_LOCAL → use JSON
  }
}

/**
 * Get the name of the currently active tier.
 * @returns {'ubuntu'|'supabase'|'local'}
 */
function getActiveTier() {
  return activeTier;
}

/**
 * Execute a database operation with immediate reactive failover.
 * If the primary tier fails during the query, it immediately downgrades
 * and retries on the next available tier.
 *
 * @param {Function} queryFn - (pool) => Promise<any>
 * @returns {Promise<any>}
 */
async function runWithFailover(queryFn) {
  const startTier = activeTier;
  
  // 1. Attempt with currently active pool
  let pool = getActivePool();
  try {
    // If pool is null (TIER_LOCAL), queryFn should handle JSON fallback
    return await queryFn(pool);
  } catch (err) {
    const isConnError = err.message.includes('timeout') || 
                        err.message.includes('terminated') || 
                        err.code === 'ECONNREFUSED';

    // 2. If it was a connection error and we were on Ubuntu, downgrade and retry immediately
    if (isConnError && activeTier === TIER_UBUNTU) {
      console.warn(`[DB-MANAGER] Primary (${startTier}) failed mid-query. Forcing immediate downgrade.`);
      
      // Proactively test Supabase
      const supabaseOk = await testPool(supabasePool);
      activeTier = supabaseOk ? TIER_SUPABASE : TIER_LOCAL;
      
      console.log(`[DB-MANAGER] New active tier: ${activeTier}`);
      
      pool = getActivePool();
      if (pool) {
        try {
          return await queryFn(pool);
        } catch (retryErr) {
          console.error('[DB-MANAGER] Retry on fallback tier also failed:', retryErr.message);
          throw retryErr;
        }
      }
    }
    
    // If we're already on local or the error wasn't a connection issue, just throw
    throw err;
  }
}

/**
 * Clean up pools and health check timer on app exit.
 */
async function closeDbManager() {
  if (healthTimer) {
    clearInterval(healthTimer);
    healthTimer = null;
  }
  const closers = [];
  if (ubuntuPool)   closers.push(ubuntuPool.end().catch(() => {}));
  if (supabasePool) closers.push(supabasePool.end().catch(() => {}));
  await Promise.all(closers);
  _initialized = false;
}

/**
 * Get the underlying primary (Ubuntu) pool, regardless of which tier is
 * currently active. Returns null if the manager wasn't initialized with a
 * primary URL. Intended for the sync job; normal app code should use
 * getActivePool() / runWithFailover().
 */
function getUbuntuPool() {
  return ubuntuPool;
}

/**
 * Get the underlying Supabase pool, regardless of active tier. Returns null
 * if Supabase isn't configured. Intended for the sync job.
 */
function getSupabasePool() {
  return supabasePool;
}

module.exports = {
  initDbManager,
  getActivePool,
  getActiveTier,
  runWithFailover,
  getUbuntuPool,
  getSupabasePool,
  closeDbManager,
};
