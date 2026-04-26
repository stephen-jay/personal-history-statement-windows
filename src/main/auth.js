const { getPgPool } = require('./database');
const fs = require('fs');
const path = require('path');

let authSessionPath = null;

function initAuth(userDataPath) {
  authSessionPath = path.join(userDataPath, 'auth-session.json');
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

module.exports = {
  initAuth,
  loadAuthSessionFromDisk,
  getAuthSession,
  setAuthSession,
  loginWithLocalPostgres,
  getAdminRolesLocal,
  createAdminUserLocal,
  updateAdminUserRoleLocal,
  deleteAdminUserLocal
};
