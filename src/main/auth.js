const { getPgPool } = require('./database');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// DB Retry Helper
// Automatically retries a DB query/operation on transient connection errors
// (ETIMEDOUT, ECONNRESET, ECONNREFUSED, EPIPE) up to maxRetries times.
// This prevents mid-flow crashes when the DB server is briefly unreachable.
// ---------------------------------------------------------------------------
async function withDbRetry(fn, maxRetries = 3, delayMs = 800) {
  const RETRYABLE_CODES = new Set(['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'EPIPE']);
  let lastErr;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isRetryable = RETRYABLE_CODES.has(err.code) || RETRYABLE_CODES.has(err.syscall);
      if (!isRetryable || attempt === maxRetries) throw err;
      lastErr = err;
      console.warn(`[DB Retry] Attempt ${attempt}/${maxRetries} failed (${err.code}), retrying in ${delayMs * attempt}ms...`);
      await new Promise(r => setTimeout(r, delayMs * attempt));
    }
  }
  throw lastErr;
}

function isConnectionError(err) {
  return ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'EPIPE'].includes(err.code);
}


const { createHash } = require('crypto');
const dbManager = require('./db-manager');

let authSessionPath = null;
let localCredCachePath = null;

// Simple local credential cache — updated on every successful DB login.
// Used ONLY when both Ubuntu and Supabase are unreachable (local tier).
let localCredCache = {};

function hashForLocalCache(password) {
  return createHash('sha256').update('phs-local-salt:' + password).digest('hex');
}

function loadLocalCredCache() {
  if (!localCredCachePath) return;
  try {
    const raw = fs.readFileSync(localCredCachePath, 'utf8');
    localCredCache = JSON.parse(raw) || {};
  } catch (_) { localCredCache = {}; }
}

function saveLocalCredCache() {
  if (!localCredCachePath) return;
  try { fs.writeFileSync(localCredCachePath, JSON.stringify(localCredCache, null, 2), 'utf8'); } catch (_) {}
}

/**
 * Called after every successful DB login to keep the local cache up-to-date.
 * @param {string} username
 * @param {string} plainPassword - the password the user just successfully logged in with
 * @param {object} userMeta      - { id, username, fullName, roles }
 */
function updateLocalCredCache(username, plainPassword, userMeta) {
  if (!username || !plainPassword) return;
  localCredCache[String(username).toLowerCase()] = {
    hash: hashForLocalCache(plainPassword),
    user: userMeta,
    cachedAt: new Date().toISOString(),
  };
  saveLocalCredCache();
}

function initAuth(userDataPath) {
  authSessionPath = path.join(userDataPath, 'auth-session.json');
  localCredCachePath = path.join(userDataPath, 'auth-credentials-cache.json');
  loadLocalCredCache();
}

let authSession = null;

function loadAuthSessionFromDisk() {
  if (!authSessionPath) return;
  try {
    const raw = fs.readFileSync(authSessionPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && parsed.token && parsed.user && Array.isArray(parsed.user.roles)) {
      authSession = parsed;
    }
  } catch (_) {
    // ignore
  }
}

async function writeAuditLog(tableName, recordId, action, newData, changedBy) {
  const pool = getPgPool();
  if (!pool) return;
  try {
    await pool.query(
      `INSERT INTO audit_logs (table_name, record_id, action, new_data, changed_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [tableName, recordId, action, JSON.stringify(newData || {}), changedBy]
    );
  } catch (_) {
    // Audit logging should not block authentication.
  }
}

function persistAuthSessionToDisk() {
  if (!authSessionPath) return;
  try {
    if (!authSession || !authSession.token) {
      try { fs.unlinkSync(authSessionPath); } catch (_) {}
      return;
    }
    const toPersist = { ...authSession };
    delete toPersist.justLoggedIn;
    fs.writeFileSync(authSessionPath, JSON.stringify(toPersist, null, 2), 'utf8');
  } catch (_) {
    // ignore
  }
}

function getAuthSession() {
  return authSession;
}

function setAuthSession(session) {
  authSession = session;
  persistAuthSessionToDisk();
}

async function loginWithLocalPostgres(username, password) {
  const pool = getPgPool();
  if (!pool) throw new Error('DATABASE_URL is required for local auth.');

  const colCheck = await pool.query(
    `SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'app_users' AND column_name = 'personnel_id'`
  );
  const hasPersonnelIdCol = colCheck.rowCount > 0;
  const personnelIdSelect = hasPersonnelIdCol ? 'u.personnel_id' : 'NULL AS personnel_id';
  const personnelIdGroupBy = hasPersonnelIdCol ? ', u.personnel_id' : '';

  const rows = await pool.query(
    `
      SELECT
        u.id,
        u.username,
        u.full_name,
        ${personnelIdSelect},
        ARRAY_REMOVE(ARRAY_AGG(r.name ORDER BY r.name), NULL) AS roles
      FROM app_users u
      LEFT JOIN app_user_roles ur ON ur.user_id = u.id
      LEFT JOIN app_roles r ON r.id = ur.role_id
      WHERE u.username = $1
        AND u.is_active = TRUE
        AND u.password_hash = crypt($2, u.password_hash)
      GROUP BY u.id, u.username, u.full_name${personnelIdGroupBy}
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
      personnelId: user.personnel_id || null,
      roles: Array.isArray(user.roles) ? user.roles : [],
    },
  };
}

async function loginViewerWithLocalPostgres(username) {
  const pool = getPgPool();
  if (!pool) throw new Error('DATABASE_URL is required for local auth.');

  const colCheck = await pool.query(
    `SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'app_users' AND column_name = 'personnel_id'`
  );
  const hasPersonnelIdCol = colCheck.rowCount > 0;
  const personnelIdSelect = hasPersonnelIdCol ? 'u.personnel_id' : 'NULL AS personnel_id';
  const personnelIdGroupBy = hasPersonnelIdCol ? ', u.personnel_id' : '';

  const rows = await pool.query(
    `
      SELECT
        u.id,
        u.username,
        u.full_name,
        ${personnelIdSelect},
        ARRAY_REMOVE(ARRAY_AGG(r.name ORDER BY r.name), NULL) AS roles
      FROM app_users u
      LEFT JOIN app_user_roles ur ON ur.user_id = u.id
      LEFT JOIN app_roles r ON r.id = ur.role_id
      WHERE u.username = $1
        AND u.is_active = TRUE
      GROUP BY u.id, u.username, u.full_name${personnelIdGroupBy}
    `,
    [username]
  );
  if (!rows.rows || !rows.rows.length) {
    throw new Error('User not found.');
  }

  const user = rows.rows[0];
  const roles = Array.isArray(user.roles) ? user.roles : [];
  const isViewerOnly = roles.includes('viewer') && !roles.includes('admin') && !roles.includes('encoder');
  if (!isViewerOnly) {
    throw new Error('Viewer login is only available for viewer accounts.');
  }

  await writeAuditLog('app_users', user.id, 'LOGIN', { login_type: 'viewer' }, user.id);

  return {
    token: 'local-session',
    user: {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      personnelId: user.personnel_id || null,
      roles,
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
  const username    = String(body.username   || '').trim();
  const password    = String(body.password   || '');
  const fullName    = String(body.fullName   || body.full_name  || '').trim();
  const email       = String(body.email      || '').trim() || null;
  const roleName    = String(body.roleName   || body.role       || '').trim();
  const personnelId = String(body.personnelId || body.personnel_id || '').trim();
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

    // Check which optional columns exist (read-only schema query — no DDL needed)
    const colCheck = await client.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'app_users'
          AND column_name IN ('personnel_id', 'email')`
    );
    const existingCols = new Set((colCheck.rows || []).map(r => r.column_name));
    const hasPersonnelId = existingCols.has('personnel_id');
    const hasEmail       = existingCols.has('email');

    // Build INSERT dynamically based on what columns exist
    const cols   = ['username', 'password_hash', 'full_name', 'is_active'];
    const params = [username, password, fullName];          // $1, $2, $3
    const vals   = ['$1', `crypt($2, gen_salt('bf'))`, '$3', 'TRUE'];  // is_active = literal TRUE, no param
    let idx = 3;

    if (hasPersonnelId) {
      cols.push('personnel_id');
      params.push(personnelId || null);
      vals.push(`$${++idx}`);
    }
    if (hasEmail && email) {
      cols.push('email');
      params.push(email);
      vals.push(`$${++idx}`);
    }

    const insertSql = `
      INSERT INTO app_users (${cols.join(', ')})
      VALUES (${vals.join(', ')})
      RETURNING id, username, full_name
    `;
    const inserted = await client.query(insertSql, params);
    const userId = inserted.rows && inserted.rows[0] ? inserted.rows[0].id : null;
    if (!userId) throw new Error('Failed to create user.');

    if (!hasEmail && email) {
      await client.query(`
        CREATE TABLE IF NOT EXISTS app_user_emails (
          user_id uuid PRIMARY KEY,
          email text NOT NULL,
          created_at timestamptz NOT NULL DEFAULT NOW(),
          updated_at timestamptz NOT NULL DEFAULT NOW()
        )
      `);
      await client.query(
        `INSERT INTO app_user_emails (user_id, email)
         VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email, updated_at = NOW()`,
        [userId, email]
      );
    }

    await client.query('INSERT INTO app_user_roles (user_id, role_id) VALUES ($1, $2)', [userId, roleId]);
    await client.query('COMMIT');
    return { ok: true, user: { id: userId, username, fullName, email, roleName } };
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
    try {
      await client.query('DELETE FROM app_user_emails WHERE user_id = $1', [userId]);
    } catch (_) {}
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

async function changePasswordLocal(userId, currentPassword, newPassword) {
  const pool = getPgPool();
  if (!pool) throw new Error('DATABASE_URL is required for local auth operations.');

  const id = String(userId || '').trim();
  const oldPass = String(currentPassword || '');
  const nextPass = String(newPassword || '');
  if (!id || !oldPass || !nextPass) {
    throw new Error('userId, currentPassword, and newPassword are required.');
  }

  const res = await pool.query(
    `
      UPDATE app_users
      SET password_hash = crypt($3, gen_salt('bf'))
      WHERE id = $1
        AND is_active = TRUE
        AND password_hash = crypt($2, password_hash)
      RETURNING id
    `,
    [id, oldPass, nextPass]
  );

  if (!res.rows || !res.rows.length) {
    throw new Error('Current password is incorrect.');
  }

  return { ok: true };
}

const { generateSecret, verify, generateURI } = require('otplib');
const QRCode = require('qrcode');

async function beginLogin(username) {
  const pool = getPgPool();

  // ── Local tier fallback: no DB available ──────────────────────────────────
  // When both Ubuntu and Supabase are unreachable, allow login from the
  // local credential cache that was populated on the last successful login.
  if (!pool) {
    const key = String(username || '').toLowerCase();
    if (localCredCache[key]) {
      console.warn('[Auth] No DB available — using local credential cache for:', username);
      // Return a fake challengeId so the flow continues; password is verified in verifyLocalCacheTier
      return { challengeId: 'LOCAL_TIER:' + key, canUsePassword: true, localTier: true };
    }
    throw new Error('Database unavailable and no offline credentials cached for this user.');
  }
  
  const userRow = await pool.query('SELECT id, username, is_active FROM app_users WHERE username = $1', [username]);
  if (!userRow.rows || !userRow.rows.length) {
    throw new Error('User not found.');
  }
  
  const user = userRow.rows[0];
  if (!user.is_active) {
    throw new Error('User account is disabled.');
  }

  const roleRows = await pool.query(
    `SELECT ARRAY_REMOVE(ARRAY_AGG(r.name ORDER BY r.name), NULL) AS roles
     FROM app_user_roles ur
     LEFT JOIN app_roles r ON r.id = ur.role_id
     WHERE ur.user_id = $1`,
    [user.id]
  );
  const roles = (roleRows.rows && roleRows.rows[0] && Array.isArray(roleRows.rows[0].roles)) ? roleRows.rows[0].roles : [];
  const canUsePassword = roles.includes('admin') || roles.includes('viewer') || roles.includes('encoder');
  
  const res = await pool.query(
    `INSERT INTO auth_challenges (user_id, status, expires_at) 
     VALUES ($1, 'pending_card', NOW() + INTERVAL '10 minutes') 
     RETURNING id`,
    [user.id]
  );
  
  return { challengeId: res.rows[0].id, canUsePassword };
}

// ── verifyCredentials — credentials-first login entry point ───────────────────
// Validates username + password before creating the auth challenge.
// Replaces the old beginLogin() call in the UI login flow.
async function verifyCredentials(username, password) {
  const pool = getPgPool();

  // ── Local tier fallback: no DB available ──────────────────────────────────
  if (!pool) {
    const key = String(username || '').toLowerCase();
    const cached = localCredCache[key];
    if (cached) {
      const hash = hashForLocalCache(password);
      if (cached.passwordHash !== hash) throw new Error('Invalid credentials.');
      console.warn('[Auth] No DB available — using local credential cache for:', username);
      return { challengeId: 'LOCAL_TIER:' + key, canUsePassword: true, localTier: true };
    }
    throw new Error('Database unavailable and no offline credentials cached for this user.');
  }

  // Verify username + password together
  const userRow = await pool.query(
    `SELECT id, username, is_active
     FROM app_users
     WHERE username = $1
       AND is_active = TRUE
       AND password_hash = crypt($2, password_hash)`,
    [username, password]
  );

  if (!userRow.rows || !userRow.rows.length) {
    // Intentionally vague — do not reveal whether the username or password is wrong
    throw new Error('Invalid credentials.');
  }

  const user = userRow.rows[0];

  const roleRows = await pool.query(
    `SELECT ARRAY_REMOVE(ARRAY_AGG(r.name ORDER BY r.name), NULL) AS roles
     FROM app_user_roles ur
     LEFT JOIN app_roles r ON r.id = ur.role_id
     WHERE ur.user_id = $1`,
    [user.id]
  );
  const roles = (roleRows.rows && roleRows.rows[0] && Array.isArray(roleRows.rows[0].roles)) ? roleRows.rows[0].roles : [];
  const canUsePassword = roles.includes('admin') || roles.includes('viewer') || roles.includes('encoder');

  const res = await pool.query(
    `INSERT INTO auth_challenges (user_id, status, expires_at)
     VALUES ($1, 'pending_card', NOW() + INTERVAL '10 minutes')
     RETURNING id`,
    [user.id]
  );

  return { challengeId: res.rows[0].id, canUsePassword };
}

// ── loginWithPasswordDirect — direct login bypass for testing ─────────────────
// Requires ENABLE_PASSWORD_DIRECT_LOGIN=true (default off).
async function loginWithPasswordDirect(username, password) {
  const enabled = /^(1|true|yes)$/i.test(String(process.env.ENABLE_PASSWORD_DIRECT_LOGIN || 'false'));
  if (!enabled) {
    throw new Error('Direct password login is disabled.');
  }

  const pool = getPgPool();

  if (!pool) {
    const key = String(username || '').toLowerCase();
    const cached = localCredCache[key];
    if (cached) {
      const hash = hashForLocalCache(password);
      if (cached.hash !== hash) throw new Error('Invalid credentials.');
      const sessionUser = cached.user || { id: 'local', username: key, fullName: key, roles: ['admin'] };
      const session = { token: 'local-session', user: sessionUser, justLoggedIn: true };
      setAuthSession(session);
      return { user: sessionUser };
    }
    throw new Error('Database unavailable and no offline credentials cached for this user.');
  }

  const userRow = await pool.query(
    `SELECT u.id, u.username, u.full_name, u.personnel_id, u.is_active
     FROM app_users u
     WHERE u.username = $1
       AND u.is_active = TRUE
       AND u.password_hash = crypt($2, u.password_hash)`,
    [username, password]
  );

  if (!userRow.rows || !userRow.rows.length) {
    throw new Error('Invalid credentials.');
  }

  const user = userRow.rows[0];

  const roleRows = await pool.query(
    `SELECT ARRAY_REMOVE(ARRAY_AGG(r.name ORDER BY r.name), NULL) AS roles
     FROM app_user_roles ur
     LEFT JOIN app_roles r ON r.id = ur.role_id
     WHERE ur.user_id = $1`,
    [user.id]
  );
  const roles = (roleRows.rows && roleRows.rows[0] && Array.isArray(roleRows.rows[0].roles)) ? roleRows.rows[0].roles : [];

  const sessionUser = {
    id: user.id,
    username: user.username,
    fullName: user.full_name,
    personnelId: user.personnel_id || null,
    roles: Array.isArray(roles) ? roles : [],
  };

  updateLocalCredCache(user.username, password, sessionUser);
  const newSession = { token: 'local-session', user: sessionUser, justLoggedIn: true };
  setAuthSession(newSession);

  return { user: sessionUser };
}

async function verifyCardStep(challengeId, cardUid) {
  const pool = getPgPool();
  if (!pool) throw new Error('DATABASE_URL is required for local auth.');
  
  const challengeRes = await pool.query(
    'SELECT user_id, status, attempts FROM auth_challenges WHERE id = $1 AND expires_at > NOW()',
    [challengeId]
  );
  
  if (!challengeRes.rows || !challengeRes.rows.length) {
    throw new Error('Login challenge expired or invalid.');
  }
  
  const challenge = challengeRes.rows[0];

  // --- Fallback: resume the flow if the card was already verified ---
  // This happens when a DB timeout occurred mid-flow (e.g. during TOTP step)
  // and the user re-taps their card. Instead of erroring, we resume from
  // wherever the challenge currently is.
  if (challenge.status === 'pending_enrollment' || challenge.status === 'pending_totp') {
    console.warn(`[Auth] Card tapped on challenge already at '${challenge.status}' — resuming flow.`);
    return { status: challenge.status, resumed: true };
  }

  if (challenge.status !== 'pending_card') {
    throw new Error('Invalid challenge state for card verification.');
  }
  
  if (challenge.attempts >= 5) {
    throw new Error('Too many failed attempts. Please restart login.');
  }
  
  // Verify card belongs to the user (with retry on transient connection errors)
  // Try exact UID match first
  let cardRes = await withDbRetry(() => pool.query(
    `SELECT c.card_uid 
     FROM cards c 
     LEFT JOIN app_users u ON u.username = c.assigned_username
     WHERE LOWER(TRIM(c.card_uid)) = LOWER(TRIM($1)) AND u.id = $2 AND c.status = 'assigned'`,
    [cardUid, challenge.user_id]
  ));
  // If not found, fall back to a starts‑with match (handles legacy trimmed UIDs)
  if (!cardRes.rows || !cardRes.rows.length) {
    console.warn(`[Auth] Exact UID lookup failed for '${cardUid}'. Trying prefix match.`);
    cardRes = await withDbRetry(() => pool.query(
      `SELECT c.card_uid 
       FROM cards c 
       LEFT JOIN app_users u ON u.username = c.assigned_username
       WHERE LOWER(TRIM(c.card_uid)) LIKE LOWER(TRIM($1)) || '%' AND u.id = $2 AND c.status = 'assigned'`,
      [cardUid, challenge.user_id]
    ));
  }
  
  if (!cardRes.rows || !cardRes.rows.length) {
    await pool.query('UPDATE auth_challenges SET attempts = attempts + 1 WHERE id = $1', [challengeId]);
    throw new Error('Card not recognized or not assigned to this user.');
  }
  
  // Card verified, check TOTP enrollment
  const userRes = await pool.query('SELECT totp_enabled FROM app_user_totp WHERE user_id = $1', [challenge.user_id]);
  const totpEnabled = userRes.rows && userRes.rows.length ? userRes.rows[0].totp_enabled : false;
  
  const nextStatus = totpEnabled ? 'pending_totp' : 'pending_enrollment';
  await pool.query('UPDATE auth_challenges SET status = $1, attempts = 0 WHERE id = $2', [nextStatus, challengeId]);
  
  return { status: nextStatus };
}

async function enrollTotp(challengeId) {
  const pool = getPgPool();
  if (!pool) throw new Error('DATABASE_URL is required for local auth.');
  
  const challengeRes = await pool.query(
    'SELECT user_id, status FROM auth_challenges WHERE id = $1 AND expires_at > NOW()',
    [challengeId]
  );
  
  if (!challengeRes.rows || !challengeRes.rows.length) {
    throw new Error('Login challenge expired or invalid.');
  }
  
  const challenge = challengeRes.rows[0];
  if (challenge.status !== 'pending_enrollment') {
    throw new Error('User already enrolled or invalid state.');
  }
  
  // Fetch username with defensive checks
  let username = 'User';
  if (challenge.user_id) {
    const userRes = await pool.query('SELECT username FROM app_users WHERE id = $1', [challenge.user_id]);
    if (userRes && userRes.rows && userRes.rows.length > 0 && userRes.rows[0].username) {
      username = String(userRes.rows[0].username).trim();
      if (!username) username = 'User';
    }
  }
  
  // Reuse existing secret if one was already generated but not yet enabled.
  // This prevents QR/secret mismatch if enrollTotp is called more than once
  // (e.g. user goes back, page reloads, or a DB timeout causes a retry).
  let secret;
  const existingTotp = await pool.query(
    'SELECT totp_secret, totp_enabled FROM app_user_totp WHERE user_id = $1',
    [challenge.user_id]
  );
  if (existingTotp.rows.length && existingTotp.rows[0].totp_secret && !existingTotp.rows[0].totp_enabled) {
    // Reuse the previously generated secret — keeps the QR consistent
    secret = existingTotp.rows[0].totp_secret;
  } else {
    // Generate a new secret only on first enrollment or after a reset
    secret = generateSecret();
    // Encrypting at rest is recommended, but storing plain text to begin with if no encryption key provided.
    // In a real prod environment, use a symmetric key.
    await pool.query(
      'INSERT INTO app_user_totp (user_id, totp_secret, totp_enabled) VALUES ($1, $2, false) ON CONFLICT (user_id) DO UPDATE SET totp_secret = $2',
      [challenge.user_id, secret]
    );
  }
  
  const otpauthUrl = generateURI({ label: username, issuer: 'APOLLO Personnel DB', secret });
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
  
  return { secret, qrCodeDataUrl };
}

async function verifyTotpStep(challengeId, token) {
  const pool = getPgPool();
  if (!pool) throw new Error('DATABASE_URL is required for local auth.');
  
  const challengeRes = await pool.query(
    'SELECT user_id, status, attempts FROM auth_challenges WHERE id = $1 AND expires_at > NOW()',
    [challengeId]
  );
  
  if (!challengeRes.rows || !challengeRes.rows.length) {
    throw new Error('Login challenge expired or invalid.');
  }
  
  const challenge = challengeRes.rows[0];
  if (challenge.status !== 'pending_totp' && challenge.status !== 'pending_enrollment') {
    throw new Error('Invalid challenge state for TOTP verification.');
  }
  
  if (challenge.attempts >= 5) {
    await pool.query('UPDATE auth_challenges SET status = $1 WHERE id = $2', ['failed', challengeId]);
    throw new Error('Too many failed OTP attempts. Please restart login.');
  }
  
  // Fetch TOTP secret with retry on transient connection errors.
  // Connection errors do NOT count as a failed OTP attempt.
  let userTotp;
  try {
    const userRes = await withDbRetry(() =>
      pool.query('SELECT totp_secret, totp_enabled FROM app_user_totp WHERE user_id = $1', [challenge.user_id])
    );
    userTotp = userRes.rows && userRes.rows.length ? userRes.rows[0] : null;
  } catch (err) {
    if (isConnectionError(err)) {
      console.error('[Auth] DB unreachable during TOTP verify (not counted as failed attempt):', err.code);
      throw new Error('Database temporarily unreachable. Please try again.');
    }
    throw err;
  }

  if (!userTotp || !userTotp.totp_secret) {
    throw new Error('TOTP secret not found. Enrollment required.');
  }
  
  const isValid = await verify({ token, secret: userTotp.totp_secret, epochTolerance: 120 });
  console.log(`\n=== [DEBUG TOTP] ===`);
  console.log(`Token received from UI: '${token}'`);
  console.log(`Secret stored in DB: '${userTotp.totp_secret}'`);
  console.log(`Verify Result object:`, isValid);
  console.log(`====================\n`);
  
  if (!isValid || !isValid.valid) {
    // Only increment attempts for genuinely wrong codes, not connection errors
    await pool.query('UPDATE auth_challenges SET attempts = attempts + 1 WHERE id = $1', [challengeId]);
    throw new Error('Invalid or expired OTP code.');
  }
  
  // Mark as verified and enable totp if this was enrollment
  await pool.query('UPDATE auth_challenges SET status = $1 WHERE id = $2', ['verified', challengeId]);
  if (!userTotp.totp_enabled) {
    await pool.query('UPDATE app_user_totp SET totp_enabled = true WHERE user_id = $1', [challenge.user_id]);
  }
  
  // Complete login
  const rows = await pool.query(
    `
      SELECT
        u.id,
        u.username,
        u.full_name,
        u.personnel_id,
        ARRAY_REMOVE(ARRAY_AGG(r.name ORDER BY r.name), NULL) AS roles
      FROM app_users u
      LEFT JOIN app_user_roles ur ON ur.user_id = u.id
      LEFT JOIN app_roles r ON r.id = ur.role_id
      WHERE u.id = $1
      GROUP BY u.id, u.username, u.full_name, u.personnel_id
    `,
    [challenge.user_id]
  );
  
  const user = rows.rows[0];
  return {
    token: 'local-session',
    user: {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      personnelId: user.personnel_id || null,
      roles: Array.isArray(user.roles) ? user.roles : [],
    },
  };
}

async function enrollTotpForUser(userId) {
  const pool = getPgPool();
  if (!pool) throw new Error('DATABASE_URL is required.');

  if (!userId) throw new Error('userId is required.');

  const userRes = await pool.query('SELECT username FROM app_users WHERE id = $1 AND is_active = TRUE', [userId]);
  if (!userRes.rows || !userRes.rows.length) throw new Error('User not found.');
  const username = String(userRes.rows[0].username || '').trim() || 'User';

  // Reuse an existing pending secret so the QR stays consistent on retries
  let secret;
  const existing = await pool.query(
    'SELECT totp_secret, totp_enabled FROM app_user_totp WHERE user_id = $1',
    [userId]
  );
  if (existing.rows.length && existing.rows[0].totp_secret && !existing.rows[0].totp_enabled) {
    secret = existing.rows[0].totp_secret;
  } else {
    secret = generateSecret();
    await pool.query(
      'INSERT INTO app_user_totp (user_id, totp_secret, totp_enabled) VALUES ($1, $2, false) ON CONFLICT (user_id) DO UPDATE SET totp_secret = $2, totp_enabled = false',
      [userId, secret]
    );
  }

  const otpauthUrl = generateURI({ label: username, issuer: 'APOLLO Personnel DB', secret });
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

  return { secret, qrCodeDataUrl };
}

/**
 * Resolve the best email address for a user account by looking at the
 * linked personnel record. Tries app_users.personnel_id first (if the
 * column exists), then falls back to matching personnel by full_name.
 *
 * @param {string} userId
 * @returns {Promise<{ email: string|null, username: string, fullName: string|null }>}
 */
async function getUserEmail(userId) {
  const pool = getPgPool();
  if (!pool) throw new Error('DATABASE_URL is required.');
  if (!userId) throw new Error('userId is required.');

  // Check if the email column exists (read-only, no DDL required)
  const colCheck = await pool.query(
    `SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'app_users' AND column_name = 'email'`
  );
  const hasEmailCol = colCheck.rowCount > 0;

  const selectCols = hasEmailCol ? 'id, username, full_name, email' : 'id, username, full_name';
  const userRes = await pool.query(
    `SELECT ${selectCols} FROM app_users WHERE id = $1`,
    [userId]
  );
  if (!userRes.rows || !userRes.rows.length) throw new Error('User not found.');
  const user = userRes.rows[0];

  let email = user.email ? String(user.email).trim() || null : null;

  if (!hasEmailCol) {
    try {
      const emailRes = await pool.query(
        'SELECT email FROM app_user_emails WHERE user_id = $1',
        [userId]
      );
      if (emailRes.rows && emailRes.rows.length) {
        email = String(emailRes.rows[0].email).trim() || null;
      }
    } catch (_) {}
  }

  return {
    email:    email,
    username: user.username ? String(user.username).trim()  || ''   : '',
    fullName: user.full_name ? String(user.full_name).trim() || null : null,
  };
}



async function verifyTotpForUser(userId, token) {
  const pool = getPgPool();
  if (!pool) throw new Error('DATABASE_URL is required.');

  if (!userId || !token) throw new Error('userId and token are required.');

  const userTotp = await pool.query(
    'SELECT totp_secret, totp_enabled FROM app_user_totp WHERE user_id = $1',
    [userId]
  );
  if (!userTotp.rows || !userTotp.rows.length || !userTotp.rows[0].totp_secret) {
    throw new Error('TOTP secret not found. Enrollment required.');
  }

  const isValid = await verify({ token: String(token).trim(), secret: userTotp.rows[0].totp_secret, epochTolerance: 120 });
  if (!isValid || !isValid.valid) {
    throw new Error('Invalid or expired OTP code.');
  }

  await pool.query('UPDATE app_user_totp SET totp_enabled = true WHERE user_id = $1', [userId]);
  return { ok: true };
}

// ── Email-OTP login fallback ────────────────────────────────────────────────
// A SEPARATE one-time code (not the TOTP secret) emailed to the user's address.
// State is kept in-memory keyed by challengeId so no schema change is needed.
const EMAIL_OTP_TTL_MS = 5 * 60 * 1000;
const EMAIL_OTP_MAX_ATTEMPTS = 5;
const emailOtpStore = new Map(); // challengeId -> { hash, expiresAt, attempts, userId }

function hashEmailOtp(challengeId, code) {
  return createHash('sha256').update('phs-email-otp:' + challengeId + ':' + code).digest('hex');
}

function generateNumericCode() {
  // 6-digit, zero-padded, from crypto-strength randomness
  const { randomInt } = require('crypto');
  return String(randomInt(0, 1000000)).padStart(6, '0');
}

/**
 * Generate + email a one-time login code for the given challenge.
 * Returns { ok, sent, reason, maskedEmail }.
 */
async function sendLoginEmailOtp(challengeId) {
  const pool = getPgPool();
  if (!pool) throw new Error('Email login is unavailable while the database is offline.');
  if (!challengeId) throw new Error('Missing challengeId.');

  const challengeRes = await pool.query(
    'SELECT user_id, status FROM auth_challenges WHERE id = $1 AND expires_at > NOW()',
    [challengeId]
  );
  if (!challengeRes.rows || !challengeRes.rows.length) {
    throw new Error('Login challenge expired or invalid.');
  }
  const challenge = challengeRes.rows[0];
  // Only offer email OTP at the verify/enrollment stage (after card step).
  if (challenge.status !== 'pending_totp' && challenge.status !== 'pending_enrollment') {
    throw new Error('Email code is not available at this step.');
  }

  const mailer = require('./mailer');
  if (!mailer.isConfigured()) {
    return { ok: true, sent: false, reason: 'smtp-not-configured' };
  }

  const info = await getUserEmail(challenge.user_id);
  if (!info.email) {
    return { ok: true, sent: false, reason: 'no-email-on-file' };
  }

  const code = generateNumericCode();
  emailOtpStore.set(String(challengeId), {
    hash: hashEmailOtp(String(challengeId), code),
    expiresAt: Date.now() + EMAIL_OTP_TTL_MS,
    attempts: 0,
    userId: challenge.user_id,
  });

  const sent = await mailer.sendLoginCodeEmail({
    to: info.email,
    code: code,
    username: info.username,
    fullName: info.fullName,
    ttlMinutes: Math.round(EMAIL_OTP_TTL_MS / 60000),
  });

  if (!sent.ok) {
    emailOtpStore.delete(String(challengeId));
    return { ok: true, sent: false, reason: sent.reason || 'send-failed' };
  }

  return { ok: true, sent: true, maskedEmail: maskEmail(info.email) };
}

function maskEmail(email) {
  const s = String(email || '');
  const at = s.indexOf('@');
  if (at <= 0) return s;
  const local = s.slice(0, at);
  const domain = s.slice(at);
  const shown = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
  return shown + '***' + domain;
}

/**
 * Verify an email-OTP code and complete login if valid.
 * Returns the same session shape as verifyTotpStep.
 */
async function verifyLoginEmailOtp(challengeId, code) {
  const pool = getPgPool();
  if (!pool) throw new Error('DATABASE_URL is required for local auth.');
  if (!challengeId || !code) throw new Error('Missing challengeId or code.');

  const entry = emailOtpStore.get(String(challengeId));
  if (!entry) throw new Error('No email code was requested or it has expired.');
  if (Date.now() > entry.expiresAt) {
    emailOtpStore.delete(String(challengeId));
    throw new Error('Email code expired. Request a new one.');
  }
  if (entry.attempts >= EMAIL_OTP_MAX_ATTEMPTS) {
    emailOtpStore.delete(String(challengeId));
    throw new Error('Too many incorrect attempts. Request a new email code.');
  }

  if (entry.hash !== hashEmailOtp(String(challengeId), String(code).trim())) {
    entry.attempts += 1;
    throw new Error('Invalid or expired OTP code.');
  }

  // Re-validate the challenge is still live and matches the user.
  const challengeRes = await pool.query(
    'SELECT user_id, status FROM auth_challenges WHERE id = $1 AND expires_at > NOW()',
    [challengeId]
  );
  if (!challengeRes.rows || !challengeRes.rows.length) {
    emailOtpStore.delete(String(challengeId));
    throw new Error('Login challenge expired or invalid.');
  }
  const challenge = challengeRes.rows[0];
  if (String(challenge.user_id) !== String(entry.userId)) {
    emailOtpStore.delete(String(challengeId));
    throw new Error('Challenge mismatch.');
  }

  // Success — consume the code, mark the challenge verified.
  emailOtpStore.delete(String(challengeId));
  await pool.query('UPDATE auth_challenges SET status = $1 WHERE id = $2', ['verified', challengeId]);

  const rows = await pool.query(
    `
      SELECT
        u.id,
        u.username,
        u.full_name,
        u.personnel_id,
        ARRAY_REMOVE(ARRAY_AGG(r.name ORDER BY r.name), NULL) AS roles
      FROM app_users u
      LEFT JOIN app_user_roles ur ON ur.user_id = u.id
      LEFT JOIN app_roles r ON r.id = ur.role_id
      WHERE u.id = $1
      GROUP BY u.id, u.username, u.full_name, u.personnel_id
    `,
    [challenge.user_id]
  );
  const user = rows.rows[0];
  return {
    token: 'local-session',
    user: {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      personnelId: user.personnel_id || null,
      roles: Array.isArray(user.roles) ? user.roles : [],
    },
  };
}

async function adminResetTotp(adminUserId, targetUserId) {
  const pool = getPgPool();
  if (!pool) throw new Error('DATABASE_URL is required.');
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Reset TOTP state for the user
    await client.query(
      'UPDATE app_user_totp SET totp_secret = NULL, totp_enabled = false, updated_at = NOW() WHERE user_id = $1',
      [targetUserId]
    );
    
    // Log the reset action
    const adminRes = await client.query('SELECT id FROM app_users WHERE id = $1', [adminUserId]);
    if (adminRes.rows.length) {
      await client.query(
        `INSERT INTO audit_logs (table_name, record_id, action, new_data, changed_by)
         VALUES ($1, $2, $3, $4, $5)`,
        ['app_users', targetUserId, 'UPDATE', JSON.stringify({ action: 'totp_reset' }), adminUserId]
      );
    }
    
    await client.query('COMMIT');
    return { ok: true };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Verify a password against the local credential cache (used in local tier only).
 * Returns the cached user session if the password matches.
 */
function verifyLocalCacheTier(username, password) {
  const key = String(username || '').toLowerCase();
  const entry = localCredCache[key];
  if (!entry) throw new Error('No offline credentials cached for this user.');
  if (entry.hash !== hashForLocalCache(password)) throw new Error('Incorrect password.');
  console.warn('[Auth] Local tier login success for:', username);
  return {
    token: 'local-session',
    user: entry.user,
  };
}

module.exports = {
  initAuth,
  loadAuthSessionFromDisk,
  getAuthSession,
  setAuthSession,
  loginWithLocalPostgres,
  loginViewerWithLocalPostgres,
  getAdminRolesLocal,
  createAdminUserLocal,
  updateAdminUserRoleLocal,
  deleteAdminUserLocal,
  changePasswordLocal,
  beginLogin,
  verifyCredentials,
  loginWithPasswordDirect,
  verifyCardStep,
  enrollTotp,
  verifyTotpStep,
  adminResetTotp,
  enrollTotpForUser,
  getUserEmail,
  verifyTotpForUser,
  sendLoginEmailOtp,
  verifyLoginEmailOtp,
  verifyLocalCacheTier,
  updateLocalCredCache,
  writeAuditLog,
};
