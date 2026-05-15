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

function persistAuthSessionToDisk() {
  if (!authSessionPath) return;
  try {
    if (!authSession || !authSession.token) {
      try { fs.unlinkSync(authSessionPath); } catch (_) {}
      return;
    }
    fs.writeFileSync(authSessionPath, JSON.stringify(authSession, null, 2), 'utf8');
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

    // Check if personnel_id column exists (may not if migration hasn't run yet)
    const colCheck = await client.query(
      "SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='app_users' AND column_name='personnel_id'"
    );
    const hasPersonnelId = colCheck.rowCount > 0;

    let inserted;
    if (hasPersonnelId) {
      inserted = await client.query(
        `
          INSERT INTO app_users (username, password_hash, full_name, personnel_id, is_active)
          VALUES ($1, crypt($2, gen_salt('bf')), $3, $4, TRUE)
          RETURNING id, username, full_name, personnel_id
        `,
        [username, password, fullName, personnelId || null]
      );
    } else {
      inserted = await client.query(
        `
          INSERT INTO app_users (username, password_hash, full_name, is_active)
          VALUES ($1, crypt($2, gen_salt('bf')), $3, TRUE)
          RETURNING id, username, full_name
        `,
        [username, password, fullName]
      );
    }
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
  
  const res = await pool.query(
    `INSERT INTO auth_challenges (user_id, status, expires_at) 
     VALUES ($1, 'pending_card', NOW() + INTERVAL '10 minutes') 
     RETURNING id`,
    [user.id]
  );

  const canUsePassword = String(user.username || '').trim().toLowerCase() === 'admin';
  
  return { challengeId: res.rows[0].id, canUsePassword };
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
        ARRAY_REMOVE(ARRAY_AGG(r.name ORDER BY r.name), NULL) AS roles
      FROM app_users u
      LEFT JOIN app_user_roles ur ON ur.user_id = u.id
      LEFT JOIN app_roles r ON r.id = ur.role_id
      WHERE u.id = $1
      GROUP BY u.id, u.username, u.full_name
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
  getAdminRolesLocal,
  createAdminUserLocal,
  updateAdminUserRoleLocal,
  deleteAdminUserLocal,
  changePasswordLocal,
  beginLogin,
  verifyCardStep,
  enrollTotp,
  verifyTotpStep,
  adminResetTotp,
  enrollTotpForUser,
  verifyTotpForUser,
  verifyLocalCacheTier,
  updateLocalCredCache,
};
