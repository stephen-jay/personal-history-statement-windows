const express = require('express');
const { Pool } = require('pg');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ override: true });
const { REMOVED_FIELDS, PERSONNEL_FIELD_MAP, CHILD_TABLES } = require('./src/shared/schema');
const { initDatabase, getPgPool, getPostgresData, savePostgresRecord, deletePostgresRecord } = require('./src/main/database');
const auth = require('./src/main/auth');

const imageStorage = require('./src/shared/image-storage');
const IMAGE_UPLOAD_DIR = path.join(__dirname, 'personnel-images');
if (!fs.existsSync(IMAGE_UPLOAD_DIR)) {
  fs.mkdirSync(IMAGE_UPLOAD_DIR, { recursive: true });
}

const DATABASE_URL = process.env.DATABASE_URL || '';
const PORT = Number(process.env.API_PORT || process.env.PORT || 3210);

if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL');
  process.exit(1);
}

const app = express();
initDatabase(DATABASE_URL, path.join(__dirname, 'personnel-data.json'));
auth.initAuth(__dirname);

app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '50mb' }));

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
  const sigOk = (() => {
    try {
      // Compare raw signature bytes, not base64url-encoded strings.
      const sigBase64 = sigB64.replace(/-/g, '+').replace(/_/g, '/');
      const pad = sigBase64.length % 4 === 0 ? '' : '='.repeat(4 - (sigBase64.length % 4));
      const sigRaw = Buffer.from(sigBase64 + pad, 'base64');
      if (sigRaw.length !== expectedSig.length) return false;
      return crypto.timingSafeEqual(sigRaw, expectedSig);
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

app.post('/auth/login', async function (req, res) {
  const body = req.body || {};
  const username = String(body.username || '').trim();
  const password = String(body.password || '');
  if (!username || !password) return res.status(400).json({ error: 'username and password required.' });

  try {
    const result = await auth.loginWithLocalPostgres(username, password);
    const user = result.user;
    
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
    res.json({ token: token, user: { id: user.id, username: user.username, fullName: user.fullName, roles: payload.roles } });
  } catch (e) {
    res.status(401).json({ error: 'Invalid credentials.' });
  }
});

app.get('/auth/me', requireAuth, async function (req, res) {
  res.json({ userId: req.auth.userId, roles: req.auth.roles, username: req.auth.username });
});

app.get('/admin/roles', requireAuth, requireAdmin, async function (_req, res) {
  try {
    const result = await auth.getAdminRolesLocal();
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e && e.message ? e.message : String(e) });
  }
});

app.get('/admin/users', requireAuth, requireAdmin, async function (_req, res) {
  try {
    const rows = await getPgPool().query(
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
    res.json({ users: rows.rows || [] });
  } catch (e) {
    res.status(500).json({ error: e && e.message ? e.message : String(e) });
  }
});

app.get('/admin/audit-logs', requireAuth, requireAdmin, async function (_req, res) {
  try {
    const rows = await getPgPool().query(
      `SELECT 
        a.id,
        a.table_name,
        a.record_id,
        a.action,
        a.changed_at,
        a.old_data,
        a.new_data,
        u.full_name as admin_name,
        p.full_name as target_personnel_name
       FROM audit_logs a
       LEFT JOIN app_users u ON a.changed_by = u.id
       LEFT JOIN personnel p ON a.record_id = p.id
       ORDER BY a.changed_at DESC
       LIMIT 500`
    );
    res.json(rows.rows);
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
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

  const client = await getPgPool().connect();
  try {
    const roleRow = await client.query('SELECT id FROM app_roles WHERE name = $1', [roleName]);
    if (!roleRow.rows || !roleRow.rows.length) return res.status(400).json({ error: 'Unknown roleName.' });
    const roleId = roleRow.rows[0].id;

    await client.query('BEGIN');
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

    res.json({ ok: true, user: { id: userId, username: username, fullName: fullName, roleName: roleName } });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    // 23505 = unique_violation
    if (e && e.code === '23505') return res.status(409).json({ error: 'Username already exists.' });
    res.status(500).json({ error: e && e.message ? e.message : String(e) });
  } finally {
    client.release();
  }
});

app.put('/admin/users/:id/role', requireAuth, requireAdmin, async function (req, res) {
  const userId = req.params.id;
  const body = req.body || {};
  const roleName = String(body.roleName || body.role || '').trim();
  if (!userId || !roleName) {
    return res.status(400).json({ error: 'userId and roleName are required.' });
  }
  const client = await getPgPool().connect();
  try {
    await client.query('BEGIN');
    const roleRow = await client.query('SELECT id FROM app_roles WHERE name = $1', [roleName]);
    if (!roleRow.rows || !roleRow.rows.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Unknown roleName.' });
    }
    const roleId = roleRow.rows[0].id;
    await client.query('DELETE FROM app_user_roles WHERE user_id = $1', [userId]);
    await client.query('INSERT INTO app_user_roles (user_id, role_id) VALUES ($1, $2)', [userId, roleId]);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    res.status(500).json({ error: e && e.message ? e.message : String(e) });
  } finally {
    client.release();
  }
});

app.delete('/admin/users/:id', requireAuth, requireAdmin, async function (req, res) {
  const userId = req.params.id;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required.' });
  }
  const client = await getPgPool().connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM app_user_roles WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM app_users WHERE id = $1', [userId]);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    res.status(500).json({ error: e && e.message ? e.message : String(e) });
  } finally {
    client.release();
  }
});

app.get('/health', async function (_req, res) {
  try {
    await getPgPool().query('SELECT 1');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || String(e) });
  }
});

app.get('/personnel', requireAuth, requirePersonnelRead, async function (_req, res) {
  try {
    const rows = await getPostgresData();
    const hydrated = rows.map(function (r) {
      return imageStorage.hydrateRecordImages(IMAGE_UPLOAD_DIR, r);
    });
    res.json(hydrated);
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

app.post('/personnel', requireAuth, requirePersonnelWrite, async function (req, res) {
  try {
    console.log(`[${new Date().toISOString()}] Incoming save request for: ${req.body.nameLast || 'Unknown'}`);
    const processed = imageStorage.processRecordImages(IMAGE_UPLOAD_DIR, req.body || {});
    const saved = await savePostgresRecord(processed, req.auth.userId);
    console.log(`[${new Date().toISOString()}] Successfully saved record: ${saved.id}`);
    const hydrated = imageStorage.hydrateRecordImages(IMAGE_UPLOAD_DIR, saved);
    res.json(hydrated);
  } catch (e) {
    console.error(`[${new Date().toISOString()}] Save failed:`, e.message);
    const msg = e && e.message ? e.message : String(e);
    const status = /Concurrency conflict/i.test(msg) ? 409 : 500;
    res.status(status).json({ error: msg });
  }
});

app.delete('/personnel/:id', requireAuth, requirePersonnelDelete, async function (req, res) {
  try {
    const id = req.params.id;
    const version = req.query.version;
    const ok = await deletePostgresRecord(id, version, req.auth.userId);
    res.json({ ok: ok });
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    const status = /Concurrency conflict/i.test(msg) ? 409 : 500;
    res.status(status).json({ error: msg });
  }
});

app.get('/personnel/:id/history', requireAuth, requirePersonnelRead, async function (req, res) {
try {
    const id = req.params.id;
    const rows = await getPgPool().query(
      `SELECT a.*, u.full_name as admin_name 
       FROM audit_logs a 
       LEFT JOIN app_users u ON a.changed_by = u.id 
       WHERE a.record_id = $1 
       ORDER BY a.changed_at DESC`,
      [id]
    );
    res.json(rows.rows);
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

app.listen(PORT, function () {
  console.log('APOLLO API listening on port', PORT);
});
