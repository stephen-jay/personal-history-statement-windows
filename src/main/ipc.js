const { getPgPool, getData, saveJsonRecord, deleteJsonRecord, getPostgresData, getPostgresList, getPostgresOne, savePostgresRecord, deletePostgresRecord } = require('./database');
const dbManager = require('./db-manager');
const auth = require('./auth');
const imageStorage = require('../shared/image-storage');
const dbSync = require('./db-sync');

async function remoteApi(pathname, options, config, authSession) {
  const base = config.REMOTE_API_BASE.replace(/\/+$/, '');
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

  function getSessionRoles() {
    const session = auth.getAuthSession();
    return (session && session.user && Array.isArray(session.user.roles)) ? session.user.roles : [];
  }

  function isViewerOnlySession() {
    const roles = getSessionRoles();
    return roles.includes('viewer') && !roles.includes('admin') && !roles.includes('encoder');
  }

  async function getViewerPersonnelId() {
    const session = auth.getAuthSession();
    const user = session && session.user ? session.user : null;
    const directPersonnelId = String((user && (user.personnelId || user.personnel_id)) || '').trim();
    if (directPersonnelId) return directPersonnelId;

    const username = String((user && user.username) || '').trim();
    if (!username) return '';

    const pool = getPgPool();
    if (!pool) return '';

    try {
      const res = await pool.query('SELECT personnel_id FROM app_users WHERE username = $1 LIMIT 1', [username]);
      return String((res.rows && res.rows[0] && res.rows[0].personnel_id) || '').trim();
    } catch (_) {
      return '';
    }
  }

  async function filterViewerRecords(records) {
    if (!isViewerOnlySession()) return records || [];
    const personnelId = await getViewerPersonnelId();
    if (!personnelId) return [];
    return (records || []).filter(function (record) {
      return String(record && record.id) === personnelId;
    });
  }

  function assertViewerCanMutate() {
    if (isViewerOnlySession()) {
      throw new Error('Viewer accounts are read-only.');
    }
  }

function registerIpcHandlers(ipcMain, app, config) {
  ipcMain.handle('auth:login', async function (_evt, creds) {
    creds = creds || {};
    const username = String(creds.username || '').trim();
    const password = String(creds.password || '');
    if (!username || !password) throw new Error('Missing username/password.');

    let result = null;
    const hasLocalDb = !!config.DATABASE_URL;
    const shouldTryRemote = config.USE_REMOTE_API || !hasLocalDb;

    if (shouldTryRemote) {
      try {
        result = await remoteApi('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ username, password }),
        }, config, null);
      } catch (e) {
        console.error('auth:login remote API failed, trying local DB auth:', e && e.message ? e.message : e);
      }
    }

    if (!result && hasLocalDb) {
      try {
        result = await auth.loginWithLocalPostgres(username, password);
      } catch (e) {
        // If DB pool is offline, try local credential cache as last resort
        if (!getPgPool()) {
          result = auth.verifyLocalCacheTier(username, password);
        } else {
          throw e;
        }
      }
    }

    if (!result) {
      throw new Error('No local DATABASE_URL configured.');
    }

    const loggedInRoles = Array.isArray(result && result.user && result.user.roles) ? result.user.roles : [];
    const canUsePassword = loggedInRoles.includes('admin') || loggedInRoles.includes('viewer') || loggedInRoles.includes('encoder');
    if (!canUsePassword) {
      throw new Error('Password authentication is restricted to admin, viewer, and encoder accounts. Use NFC card login.');
    }

    const newSession = { token: result && result.token ? String(result.token) : '', user: result && result.user ? result.user : null };
    newSession.justLoggedIn = true;
    auth.setAuthSession(newSession);
    // Keep local credential cache current for offline tier
    if (newSession.user) auth.updateLocalCredCache(username, password, newSession.user);
    return newSession.user ? { user: newSession.user } : null;
  });

  ipcMain.handle('auth:viewerLogin', async function (_evt, payload) {
    const body = payload || {};
    const username = String(body.username || '').trim();
    if (!username) throw new Error('Missing username.');

    let result = null;
    const hasLocalDb = !!config.DATABASE_URL;
    const shouldTryRemote = config.USE_REMOTE_API || !hasLocalDb;

    if (shouldTryRemote) {
      try {
        result = await remoteApi('/auth/viewer-login', {
          method: 'POST',
          body: JSON.stringify({ username }),
        }, config, null);
      } catch (e) {
        console.error('auth:viewerLogin remote API failed, trying local DB auth:', e && e.message ? e.message : e);
      }
    }

    if (!result && hasLocalDb) {
      result = await auth.loginViewerWithLocalPostgres(username);
    }

    if (!result) {
      throw new Error('No local DATABASE_URL configured.');
    }

    const newSession = { token: result && result.token ? String(result.token) : '', user: result && result.user ? result.user : null };
    newSession.justLoggedIn = true;
    auth.setAuthSession(newSession);
    return newSession.user ? { user: newSession.user } : null;
  });

  // --- Passwordless / Multi-step Auth Handlers ---
  
  ipcMain.handle('auth:beginLogin', async function (_evt, payload) {
    const body = payload || {};
    const username = String(body.username || '').trim();
    if (!username) throw new Error('Missing username.');
    return await auth.beginLogin(username);
  });

  ipcMain.handle('auth:verifyCredentials', async function (_evt, payload) {
    const body = payload || {};
    const username = String(body.username || '').trim();
    const password = String(body.password || '');
    if (!username) throw new Error('Missing username.');
    if (!password) throw new Error('Missing password.');
    return await auth.verifyCredentials(username, password);
  });

  ipcMain.handle('auth:verifyCard', async function (_evt, payload) {
    const body = payload || {};
    const challengeId = body.challengeId;
    const cardUid = String(body.cardUid || '').trim();
    if (!challengeId || !cardUid) throw new Error('Missing challengeId or cardUid.');
    return await auth.verifyCardStep(challengeId, cardUid);
  });

  ipcMain.handle('auth:enrollTotp', async function (_evt, payload) {
    const body = payload || {};
    const challengeId = body.challengeId;
    if (!challengeId) throw new Error('Missing challengeId.');
    return await auth.enrollTotp(challengeId);
  });

  ipcMain.handle('auth:verifyTotp', async function (_evt, payload) {
    const body = payload || {};
    const challengeId = body.challengeId;
    const token = String(body.token || '').trim();
    if (!challengeId || !token) throw new Error('Missing challengeId or token.');
    
    const result = await auth.verifyTotpStep(challengeId, token);
    const newSession = { token: result && result.token ? String(result.token) : '', user: result && result.user ? result.user : null };
    newSession.justLoggedIn = true;
    auth.setAuthSession(newSession);
    // Keep local credential cache current — but we don't have the plain password here.
    // The cache is updated via the password login path. TOTP logins don't update it
    // since we never see the password after the initial auth:login call.
    return newSession.user ? { user: newSession.user } : null;
  });

  // Email-OTP login fallback (separate from TOTP).
  ipcMain.handle('auth:sendEmailOtp', async function (_evt, payload) {
    const body = payload || {};
    const challengeId = body.challengeId;
    if (!challengeId) throw new Error('Missing challengeId.');
    return await auth.sendLoginEmailOtp(challengeId);
  });

  ipcMain.handle('auth:verifyEmailOtp', async function (_evt, payload) {
    const body = payload || {};
    const challengeId = body.challengeId;
    const code = String(body.code || '').trim();
    if (!challengeId || !code) throw new Error('Missing challengeId or code.');

    const result = await auth.verifyLoginEmailOtp(challengeId, code);
    const newSession = { token: result && result.token ? String(result.token) : '', user: result && result.user ? result.user : null };
    newSession.justLoggedIn = true;
    auth.setAuthSession(newSession);
    return newSession.user ? { user: newSession.user } : null;
  });
  ipcMain.handle('auth:adminResetTotp', async function (_evt, payload) {
    const body = payload || {};
    const targetUserId = body.targetUserId;
    if (!targetUserId) throw new Error('Missing targetUserId.');
    const session = auth.getAuthSession();
    const adminUserId = session && session.user ? session.user.id : null;
    if (!adminUserId) throw new Error('Unauthorized.');
    return await auth.adminResetTotp(adminUserId, targetUserId);
  });

  ipcMain.handle('admin:enrollTotpForUser', async function (_evt, payload) {
    const session = auth.getAuthSession();
    if (!session || !session.user) throw new Error('Unauthorized.');
    const body = payload || {};
    const userId = body.userId;
    if (!userId) throw new Error('Missing userId.');
    return await auth.enrollTotpForUser(userId);
  });

  // Enroll TOTP for a user and email the QR code to their on-file address.
  // Returns { ok, emailed, email, reason }. Never throws on mail failure —
  // the QR enrollment still succeeds so the admin can show/print it manually.
  ipcMain.handle('admin:emailTotpQr', async function (_evt, payload) {
    const session = auth.getAuthSession();
    if (!session || !session.user) throw new Error('Unauthorized.');
    const body = payload || {};
    const userId = body.userId;
    if (!userId) throw new Error('Missing userId.');

    const mailer = require('./mailer');

    // Enroll (or reuse pending) TOTP to obtain the secret + QR.
    const enroll = await auth.enrollTotpForUser(userId);

    // Resolve the recipient: explicit override or the personnel email on file.
    let info = { email: null, username: '', fullName: null };
    try {
      info = await auth.getUserEmail(userId);
    } catch (e) {
      console.warn('[MAIL] getUserEmail failed:', e && e.message ? e.message : e);
    }
    const to = String(body.email || info.email || '').trim();

    // If email is explicitly provided and is different from the one on file, save it.
    if (body.email && body.email.trim() && body.email.trim() !== info.email) {
      const pool = getPgPool();
      if (pool) {
        try {
          const colCheck = await pool.query(
            `SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'app_users' AND column_name = 'email'`
          );
          const hasEmailCol = colCheck.rowCount > 0;
          if (hasEmailCol) {
            await pool.query('UPDATE app_users SET email = $1 WHERE id = $2', [body.email.trim(), userId]);
          } else {
            await pool.query(`
              CREATE TABLE IF NOT EXISTS app_user_emails (
                user_id uuid PRIMARY KEY,
                email text NOT NULL,
                created_at timestamptz NOT NULL DEFAULT NOW(),
                updated_at timestamptz NOT NULL DEFAULT NOW()
              )
            `);
            await pool.query(`
              INSERT INTO app_user_emails (user_id, email) VALUES ($1, $2)
              ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email, updated_at = NOW()
            `, [userId, body.email.trim()]);
          }
        } catch (saveErr) {
          console.warn('[MAIL] failed to auto-save explicitly provided email:', saveErr.message);
        }
      }
    }

    if (!mailer.isConfigured()) {
      return { ok: true, emailed: false, reason: 'smtp-not-configured', email: to || null, secret: enroll.secret, qrCodeDataUrl: enroll.qrCodeDataUrl };
    }
    if (!to) {
      return { ok: true, emailed: false, reason: 'no-recipient', email: null, secret: enroll.secret, qrCodeDataUrl: enroll.qrCodeDataUrl };
    }

    const sent = await mailer.sendTotpQrEmail({
      to: to,
      username: info.username,
      fullName: info.fullName,
      secret: enroll.secret,
      qrCodeDataUrl: enroll.qrCodeDataUrl,
    });

    return {
      ok: true,
      emailed: !!sent.ok,
      reason: sent.ok ? null : sent.reason,
      email: to,
      secret: enroll.secret,
      qrCodeDataUrl: enroll.qrCodeDataUrl,
    };
  });

  ipcMain.handle('admin:verifyTotpForUser', async function (_evt, payload) {
    const session = auth.getAuthSession();
    if (!session || !session.user) throw new Error('Unauthorized.');
    const body = payload || {};
    const userId = body.userId;
    const token = String(body.token || '').trim();
    if (!userId || !token) throw new Error('Missing userId or token.');
    return await auth.verifyTotpForUser(userId, token);
  });


  ipcMain.handle('auth:session', async function () {
    const session = auth.getAuthSession();
    if (!session || !session.token || !session.user) return null;
    const justLoggedIn = !!session.justLoggedIn;
    if (session.justLoggedIn) {
      delete session.justLoggedIn;
    }
    return { user: session.user, roles: session.user.roles || [], justLoggedIn };
  });

  ipcMain.handle('auth:logout', async function () {
    auth.setAuthSession(null);
    return { ok: true };
  });

  ipcMain.handle('auth:changePassword', async function (_evt, payload) {
    const body = payload || {};
    const currentPassword = String(body.currentPassword || '');
    const newPassword = String(body.newPassword || '');
    if (!currentPassword || !newPassword) {
      throw new Error('currentPassword and newPassword are required.');
    }
    if (newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters.');
    }

    const session = auth.getAuthSession();
    const userId = session && session.user ? session.user.id : null;
    if (!userId) {
      throw new Error('No authenticated user session. Please log in again.');
    }

    if (config.USE_REMOTE_API) {
      try {
        return await remoteApi('/auth/change-password', {
          method: 'POST',
          body: JSON.stringify({ currentPassword, newPassword }),
        }, config, auth.getAuthSession());
      } catch (e) {
        console.error('auth:changePassword remote API failed, trying local DB auth:', e && e.message ? e.message : e);
      }
    }

    return await auth.changePasswordLocal(userId, currentPassword, newPassword);
  });

  ipcMain.handle('admin:roles', async function () {
    if (config.USE_REMOTE_API) {
      try {
        return await remoteApi('/admin/roles', {}, config, auth.getAuthSession());
      } catch (e) {
        console.error('admin:roles remote API failed:', e && e.message ? e.message : e);
      }
    }
    return await auth.getAdminRolesLocal();
  });

  ipcMain.handle('admin:createUser', async function (_evt, payload) {
    if (config.USE_REMOTE_API) {
      try {
        return await remoteApi('/admin/users', {
          method: 'POST',
          body: JSON.stringify(payload || {}),
        }, config, auth.getAuthSession());
      } catch (e) {
        console.error('admin:createUser remote API failed:', e && e.message ? e.message : e);
      }
    }
    return await auth.createAdminUserLocal(payload || {});
  });

  ipcMain.handle('admin:listUsers', async function () {
    if (config.USE_REMOTE_API) {
      try {
        return await remoteApi('/admin/users', {}, config, auth.getAuthSession());
      } catch (e) {
        console.error('admin:listUsers remote API failed:', e && e.message ? e.message : e);
      }
    }
    const result = await dbManager.runWithFailover(async function (pool) {
      const colCheck = await pool.query(
        `SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'app_users' AND column_name = 'email'`
      );
      const hasEmailCol = colCheck.rowCount > 0;

      let emailSelect = 'NULL AS email';
      if (hasEmailCol) {
        emailSelect = 'u.email';
      } else {
        const tableCheck = await pool.query(
          `SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'app_user_emails'`
        );
        if (tableCheck.rowCount > 0) {
          emailSelect = '(SELECT email FROM app_user_emails WHERE user_id = u.id) AS email';
        }
      }

      const rows = await pool.query(
        `
          SELECT
            u.id,
            u.username,
            u.full_name,
            u.is_active,
            ${emailSelect},
            COALESCE(ARRAY_REMOVE(ARRAY_AGG(r.name ORDER BY r.name), NULL), '{}') AS roles
          FROM app_users u
          LEFT JOIN app_user_roles ur ON ur.user_id = u.id
          LEFT JOIN app_roles r ON r.id = ur.role_id
          GROUP BY u.id, u.username, u.full_name, u.is_active${hasEmailCol ? ', u.email' : ''}
          ORDER BY u.username ASC
        `
      );
      return { users: rows.rows || [] };
    });
    if (result == null) {
      throw new Error('No PostgreSQL tier is currently reachable.');
    }
    return result;
  });

  ipcMain.handle('admin:updateUserRole', async function (_evt, payload) {
    const body = payload || {};
    const userId = body.userId;
    const roleName = String(body.roleName || '').trim();
    if (!userId || !roleName) {
      throw new Error('userId and roleName are required.');
    }
    if (config.USE_REMOTE_API) {
      try {
        return await remoteApi('/admin/users/' + encodeURIComponent(String(userId)) + '/role', {
          method: 'PUT',
          body: JSON.stringify({ roleName }),
        }, config, auth.getAuthSession());
      } catch (e) {
        console.error('admin:updateUserRole remote API failed:', e && e.message ? e.message : e);
      }
    }
    return await auth.updateAdminUserRoleLocal(userId, roleName);
  });

  ipcMain.handle('admin:deleteUser', async function (_evt, payload) {
    const body = payload || {};
    const userId = body.userId;
    if (!userId) {
      throw new Error('userId is required.');
    }
    if (config.USE_REMOTE_API) {
      try {
        return await remoteApi('/admin/users/' + encodeURIComponent(String(userId)), {
          method: 'DELETE',
        }, config, auth.getAuthSession());
      } catch (e) {
        console.error('admin:deleteUser remote API failed:', e && e.message ? e.message : e);
      }
    }
    return await auth.deleteAdminUserLocal(userId);
  });

  ipcMain.handle('admin:auditLogs', async function () {
    if (config.USE_REMOTE_API) {
      try {
        return await remoteApi('/admin/audit-logs', {}, config, auth.getAuthSession());
      } catch (e) {
        console.error('admin:auditLogs remote API failed:', e && e.message ? e.message : e);
      }
    }
    try {
      const result = await dbManager.runWithFailover(async function (pool) {
        const res = await pool.query(
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
        return res.rows;
      });
      return result || [];
    } catch (e) {
      // audit_logs table may not exist on fallback DB yet — return empty
      console.warn('[DB] audit_logs query failed (table may be missing):', e && e.message ? e.message : e);
      return [];
    }
  });

  ipcMain.handle('admin:clearAuditLogs', async function () {
    const session = auth.getAuthSession();
    if (!session || !session.user) throw new Error('Unauthorized.');
    
    // Safety check: only 'admin' can clear logs
    if (String(session.user.username).toLowerCase() !== 'admin') {
      throw new Error('Only the primary administrator can clear audit logs.');
    }

    const pool = getPgPool();
    if (!pool) throw new Error('DATABASE_URL is required to clear logs.');
    
    try {
      await pool.query('TRUNCATE TABLE audit_logs RESTART IDENTITY');
      return { ok: true };
    } catch (e) {
      console.error('[DB] Failed to clear audit logs:', e);
      throw e;
    }
  });

  ipcMain.handle('admin:resetAllUsers', async function () {
    const pool = getPgPool();
    if (!pool) throw new Error('DATABASE_URL is required for admin:resetAllUsers');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Delete all users except 'admin'
      await client.query('DELETE FROM app_user_roles WHERE user_id IN (SELECT id FROM app_users WHERE username != $1)', ['admin']);
      await client.query('DELETE FROM app_users WHERE username != $1', ['admin']);
      try {
        await client.query('DELETE FROM app_user_emails WHERE user_id NOT IN (SELECT id FROM app_users)');
      } catch (_) {}
      await client.query('COMMIT');
      return { ok: true };
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      throw e;
    } finally {
      client.release();
    }
  });

  ipcMain.handle('personnel:getAll', async () => {
    let records = null;
    if (config.USE_POSTGRES_READ) {
      try {
        records = await getPostgresData();
      } catch (e) {
        console.error('personnel:getAll postgres failed, trying remote/json fallback:', e && e.message ? e.message : e);
      }
    }
    if (!records && config.USE_REMOTE_API) {
      try {
        records = await remoteApi('/personnel', {}, config, auth.getAuthSession());
      } catch (e) {
        console.error('personnel:getAll remote API failed, falling back to JSON:', e && e.message ? e.message : e);
      }
    }
    if (!records) {
      records = getData();
    }
    const scopedRecords = await filterViewerRecords(records);
    return scopedRecords.map(function (record) {
      return imageStorage.hydrateRecordImages(config.IMAGE_UPLOAD_DIR, record);
    });
  });

  // Slim list payload for the roster + dashboard. Returns scalar fields plus
  // the small avatar (photo_data_url); excludes signatures, handwriting, and
  // thumb-mark base64 columns and skips child tables. Detail/edit views
  // should call personnel:getOne to load the full record.
  ipcMain.handle('personnel:getList', async () => {
    let records = null;
    if (config.USE_POSTGRES_READ) {
      try {
        records = await getPostgresList();
      } catch (e) {
        console.error('personnel:getList postgres failed, falling back:', e && e.message ? e.message : e);
      }
    }
    if (!records) {
      // JSON / remote fallback: return the full payload (already small for
      // a fresh JSON file). The renderer treats getList output the same way
      // as getAll output, just typically lighter.
      if (config.USE_REMOTE_API) {
        try {
          records = await remoteApi('/personnel', {}, config, auth.getAuthSession());
        } catch (_) {}
      }
      if (!records) {
        records = getData();
      }
    }
    const scopedRecords = await filterViewerRecords(records);
    return scopedRecords.map(function (record) {
      return imageStorage.hydrateRecordImages(config.IMAGE_UPLOAD_DIR, record);
    });
  });

  ipcMain.handle('personnel:getOne', async (_, id) => {
    if (!id) return null;
    if (isViewerOnlySession()) {
      const personnelId = await getViewerPersonnelId();
      if (!personnelId || String(id) !== personnelId) return null;
    }
    if (config.USE_POSTGRES_READ) {
      try {
        const record = await getPostgresOne(id);
        if (record) {
          return imageStorage.hydrateRecordImages(config.IMAGE_UPLOAD_DIR, record);
        }
        return null;
      } catch (e) {
        console.error('personnel:getOne postgres failed, falling back:', e && e.message ? e.message : e);
      }
    }
    // JSON fallback: filter the local cache.
    const all = getData();
    const found = (all || []).find(function (r) { return String(r && r.id) === String(id); });
    if (!found) return null;
    return imageStorage.hydrateRecordImages(config.IMAGE_UPLOAD_DIR, found);
  });

  function archivePersonnelImages(record) {
    try {
      imageStorage.archiveRecordImages(config.IMAGE_UPLOAD_DIR, record);
    } catch (e) {
      console.error('personnel image archive failed:', e && e.message ? e.message : e);
    }
  }

  ipcMain.handle('personnel:save', async (_, record) => {
    assertViewerCanMutate();
    const recordToSave = imageStorage.processRecordImages(config.IMAGE_UPLOAD_DIR, record || {});
    let saved = null;

    if (config.USE_REMOTE_API) {
      try {
        saved = await remoteApi('/personnel', {
          method: 'POST',
          body: JSON.stringify(recordToSave),
        }, config, auth.getAuthSession());
        if (saved && config.ENABLE_DUAL_WRITE) {
          try {
            // Images are stored as base64 in database; no processing needed
            saveJsonRecord(saved);
          } catch (e) {
            console.error('personnel:save dual-write local JSON failed:', e);
          }
        }
        archivePersonnelImages(saved);
      } catch (e) {
        console.error('personnel:save remote API failed, falling back to local:', e && e.message ? e.message : e);
      }
    }

    if (!saved) {
      // Images are stored as base64 data URLs directly; no file processing needed
      if (config.USE_POSTGRES_WRITE) {
        try {
          const session = auth.getAuthSession();
          saved = await savePostgresRecord(recordToSave, session && session.user ? session.user.id : null);
          if (config.ENABLE_DUAL_WRITE) {
            try {
              saveJsonRecord(saved);
            } catch (e) {
              console.error('personnel:save dual-write JSON failed:', e);
            }
          }
          archivePersonnelImages(saved);
        } catch (e) {
          console.error('personnel:save local postgres failed, trying JSON fallback:', e && e.message ? e.message : e);
        }
      }
      
      if (!saved) {
        saved = saveJsonRecord(recordToSave);
        archivePersonnelImages(saved);
      }
    }

    // Images are already as base64 data URLs; no hydration needed
    return saved;
  });

  ipcMain.handle('personnel:delete', async (_, id, version) => {
    assertViewerCanMutate();
    if (config.USE_POSTGRES_WRITE) {
      try {
        const session = auth.getAuthSession();
        const ok = await deletePostgresRecord(id, version, session && session.user ? session.user.id : null);
        if (config.ENABLE_DUAL_WRITE) {
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
    if (config.USE_REMOTE_API) {
      try {
        const qs = '?version=' + encodeURIComponent(version == null ? '' : String(version));
        const result = await remoteApi('/personnel/' + encodeURIComponent(id) + qs, {
          method: 'DELETE',
        }, config, auth.getAuthSession());
        return !!(result && result.ok);
      } catch (e) {
        console.error('personnel:delete remote API failed, falling back to JSON:', e && e.message ? e.message : e);
      }
    }
    return deleteJsonRecord(id);
  });

  ipcMain.handle('personnel:getHistory', async (_, recordId) => {
    if (isViewerOnlySession()) {
      const personnelId = await getViewerPersonnelId();
      if (!personnelId || String(recordId) !== personnelId) return [];
    }
    if (config.USE_REMOTE_API) {
      try {
        return await remoteApi('/personnel/' + encodeURIComponent(String(recordId)) + '/history', {}, config, auth.getAuthSession());
      } catch (e) {
        console.error('personnel:getHistory remote API failed, trying local:', e && e.message ? e.message : e);
      }
    }
    const pool = getPgPool();
    if (!pool) return [];
    try {
      const res = await pool.query(
        `SELECT a.*, u.full_name as admin_name 
         FROM audit_logs a 
         LEFT JOIN app_users u ON a.changed_by = u.id 
         WHERE a.record_id = $1 
         ORDER BY a.changed_at DESC`,
        [String(recordId)]
      );
      return res.rows;
    } catch (e) {
      console.error('Failed to fetch audit logs:', e);
      return [];
    }
  });

  // Card management IPC handlers (basic scaffolding)
  ipcMain.handle('cards:lookup', async function (_evt, payload) {
    const body = payload || {};
    const cardUid = String(body.card_uid || body.cardId || body.card_id || '').trim();
    if (!cardUid) throw new Error('card_uid is required');
    const pool = getPgPool();
    if (!pool) throw new Error('DATABASE_URL is required for cards:lookup');
    await pool.query('ALTER TABLE cards ADD COLUMN IF NOT EXISTS assigned_username text NULL');
    await pool.query('ALTER TABLE cards ADD COLUMN IF NOT EXISTS personnel_id text NULL');
    const res = await pool.query(
      `SELECT c.*, p.full_name as personnel_name, p.id as personnel_db_id, u.full_name as assigned_user_full_name
       FROM cards c
       LEFT JOIN personnel p ON c.personnel_id = p.id
       LEFT JOIN app_users u ON u.username = c.assigned_username
       WHERE LOWER(TRIM(c.card_uid)) = LOWER(TRIM($1))
       LIMIT 1`,
      [cardUid]
    );
    return { card: res.rows && res.rows[0] ? res.rows[0] : null };
  });

  ipcMain.handle('cards:loginLookup', async function (_evt, payload) {
    const body = payload || {};
    const cardUid = String(body.card_uid || body.cardId || body.card_id || '').trim();
    if (!cardUid) throw new Error('card_uid is required');
    const pool = getPgPool();
    if (!pool) throw new Error('DATABASE_URL is required for cards:loginLookup');
    await pool.query('ALTER TABLE cards ADD COLUMN IF NOT EXISTS assigned_username text NULL');

    const res = await pool.query(
      `
        SELECT
          c.card_uid,
          c.status,
          c.personnel_id,
          c.assigned_username,
          p.full_name AS personnel_name,
          COALESCE(u.username, '') AS username,
          COALESCE(u.full_name, '') AS user_full_name,
          COALESCE(au.username, '') AS assigned_username_resolved,
          COALESCE(au.full_name, '') AS assigned_user_full_name
        FROM cards c
        LEFT JOIN personnel p ON p.id = c.personnel_id
        LEFT JOIN app_users u ON u.username = c.personnel_id OR LOWER(u.full_name) = LOWER(p.full_name)
        LEFT JOIN app_users au ON au.username = c.assigned_username
        WHERE LOWER(TRIM(c.card_uid)) = LOWER(TRIM($1))
        LIMIT 1
      `,
      [cardUid]
    );

    return { card: res.rows && res.rows[0] ? res.rows[0] : null };
  });

  ipcMain.handle('cards:register', async function (_evt, payload) {
    const body = payload || {};
    const cardUid = String(body.card_uid || body.cardId || '').trim();
    const createdBy = String(body.created_by || '') || null;
    console.log(`[CARDS] Registering card: ${cardUid}`);
    if (!cardUid) {
      console.log(`[CARDS] ERROR: card_uid is required`);
      throw new Error('card_uid is required');
    }
    try {
      const result = await dbManager.runWithFailover(async function (pool) {
        await pool.query('ALTER TABLE cards ADD COLUMN IF NOT EXISTS assigned_username text NULL');

        // Check for existing card case-insensitively
        const existing = await pool.query('SELECT card_uid FROM cards WHERE LOWER(TRIM(card_uid)) = LOWER(TRIM($1))', [cardUid]);
        if (existing.rows && existing.rows.length > 0) {
          console.log(`[CARDS] ERROR: Card UID already registered (case-insensitive check): ${cardUid}`);
          throw new Error('Card UID already registered');
        }

        console.log(`[CARDS] Inserting card_uid=${cardUid} into cards table`);
        const res = await pool.query('INSERT INTO cards (card_uid, status, created_by, assigned_username) VALUES ($1, $2, $3, NULL) RETURNING *', [cardUid, 'available', createdBy]);
        console.log(`[CARDS] Card registered successfully:`, res.rows[0]);
        return { card: res.rows && res.rows[0] ? res.rows[0] : null };
      });
      if (result == null) {
        throw new Error('No PostgreSQL tier is currently reachable for card registration.');
      }
      return result;
    } catch (e) {
      console.log(`[CARDS] Caught error during registration:`, e.code, e.message);
      if (e && (e.code === '23505' || e.message === 'Card UID already registered')) {
        console.log(`[CARDS] Duplicate key error detected - throwing duplicate message`);
        throw new Error('Card UID already registered');
      }
      console.log(`[CARDS] Re-throwing error:`, e.message);
      throw e;
    }
  });

  ipcMain.handle('cards:list', async function () {
    try {
      const result = await dbManager.runWithFailover(async function (pool) {
        // Ensure migration-add columns exist to avoid query errors during migration
        await pool.query('ALTER TABLE cards ADD COLUMN IF NOT EXISTS assigned_username text NULL');
        await pool.query('ALTER TABLE cards ADD COLUMN IF NOT EXISTS personnel_id text NULL');

        // Detect which timestamp column is available so the query doesn't fail
        const colRes = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='cards' AND column_name IN ('registered_at','created_at','updated_at')");
        const foundCols = (colRes.rows || []).map(r => r.column_name);
        let dateCol = null;
        if (foundCols.includes('registered_at')) dateCol = 'registered_at';
        else if (foundCols.includes('created_at')) dateCol = 'created_at';
        else if (foundCols.includes('updated_at')) dateCol = 'updated_at';

        let query;
        if (dateCol) {
          query = `SELECT card_uid, status, assigned_username, personnel_id, TO_CHAR(${dateCol}, 'YYYY-MM-DD HH24:MI:SS') as registered_at_str FROM cards ORDER BY ${dateCol} DESC`;
        } else {
          // No timestamp column available; return rows without date ordering
          query = `SELECT card_uid, status, assigned_username, personnel_id, NULL::text as registered_at_str FROM cards ORDER BY card_uid ASC`;
        }

        const res = await pool.query(query);

        const formattedCards = (res.rows || []).map(row => ({
          card_uid: row.card_uid,
          uid: row.card_uid,
          status: row.status,
          assigned_username: row.assigned_username,
          personnel_id: row.personnel_id,
          date: row.registered_at_str
        }));

        return { cards: formattedCards };
      });
      if (result == null) return { cards: [] };
      return result;
    } catch (e) {
      console.error('[CARDS] list failed:', e && e.message ? e.message : e);
      return { cards: [] };
    }
  });

  ipcMain.handle('cards:assign', async function (_evt, payload) {
    const body = payload || {};
    // `cardUid` is stored exactly as read from the NFC reader (no truncation). This ensures future lookups match the full UID.
    const cardUid = String(body.card_uid || '').trim();
    const personnelId = String(body.personnel_id || '').trim();
    const assignedUsername = String(body.assigned_username || body.username || '').trim();
    if (!cardUid || (!personnelId && !assignedUsername)) throw new Error('card_uid and personnel_id or assigned_username are required');

    const result = await dbManager.runWithFailover(async function (pool) {
      await pool.query('ALTER TABLE cards ADD COLUMN IF NOT EXISTS assigned_username text NULL');
      await pool.query('ALTER TABLE cards ADD COLUMN IF NOT EXISTS personnel_id text NULL');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        let finalAssignedUsername = assignedUsername || null;
        if (!finalAssignedUsername && personnelId) {
          // Check whether app_users has a personnel_id column (older DBs may not).
          const hasPersonnelIdCol = await client.query(
            "SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='app_users' AND column_name='personnel_id'"
          );

          let userLookup = { rows: [] };
          if (hasPersonnelIdCol.rowCount > 0) {
            // 1. Try to find the associated app_user by explicit personnel_id link
            userLookup = await client.query(
              'SELECT username FROM app_users WHERE personnel_id = $1 LIMIT 1',
              [personnelId]
            );
          }

          if (!userLookup.rows || !userLookup.rows.length) {
            // 2. Fallback: Try to find by matching ID or Full Name (legacy)
            userLookup = await client.query(`
              SELECT u.username 
              FROM app_users u 
              LEFT JOIN personnel p ON p.id = $1 
              WHERE u.username = $1 OR (u.full_name IS NOT NULL AND u.full_name != '' AND LOWER(u.full_name) = LOWER(p.full_name))
              LIMIT 1
            `, [personnelId]);
          }

          if (userLookup.rows && userLookup.rows.length > 0) {
            finalAssignedUsername = userLookup.rows[0].username;
          }
        }

        // Check if card is already assigned to someone else
        const current = await client.query('SELECT status, personnel_id, assigned_username FROM cards WHERE LOWER(TRIM(card_uid)) = LOWER(TRIM($1))', [cardUid]);
        if (current.rows && current.rows.length > 0) {
          const c = current.rows[0];
          if (String(c.status).toLowerCase() === 'assigned' && (c.personnel_id || c.assigned_username)) {
            // If it's already assigned and it's NOT the same person, block it
            if (c.personnel_id !== personnelId && c.assigned_username !== finalAssignedUsername) {
              throw new Error('This card is already assigned to another personnel record.');
            }
          }
        }

        // mark card assigned and set personnel_id
        const updateRes = await client.query(
          'UPDATE cards SET status = $1, personnel_id = $2, assigned_username = $3, updated_at = NOW() WHERE LOWER(TRIM(card_uid)) = LOWER(TRIM($4))',
          ['assigned', personnelId || null, finalAssignedUsername, cardUid]
        );

        if (updateRes.rowCount === 0) {
          throw new Error('Card UID not found or registration mismatch');
        }

        // keep legacy personnel_card_registrations in sync when personnel is used.
        // The table has a UNIQUE constraint on card_uid AND a PK on personnel_id,
        // so clear any prior owner of this card_uid before upserting by personnel_id.
        if (personnelId) {
          const regExists = await client.query("SELECT to_regclass('public.personnel_card_registrations') AS t");
          if (regExists.rows && regExists.rows[0] && regExists.rows[0].t) {
            await client.query('DELETE FROM personnel_card_registrations WHERE card_uid = $1 AND personnel_id <> $2', [cardUid, personnelId]);
            await client.query(
              'INSERT INTO personnel_card_registrations (personnel_id, card_uid) VALUES ($1, $2) ON CONFLICT (personnel_id) DO UPDATE SET card_uid = EXCLUDED.card_uid, updated_at = NOW()',
              [personnelId, cardUid]
            );
          }
        }
        await client.query('COMMIT');
        return { ok: true };
      } catch (e) {
        try { await client.query('ROLLBACK'); } catch (_) {}
        throw e;
      } finally {
        try { client.release(); } catch (_) {}
      }
    });
    if (result == null) {
      throw new Error('No PostgreSQL tier is currently reachable for card assignment.');
    }
    return result;
  });

  ipcMain.handle('cards:unassign', async function (_evt, payload) {
    const body = payload || {};
    const cardUid = String(body.card_uid || '').trim();
    if (!cardUid) throw new Error('card_uid is required');
    const pool = getPgPool();
    if (!pool) throw new Error('DATABASE_URL is required for cards:unassign');
    await pool.query('ALTER TABLE cards ADD COLUMN IF NOT EXISTS assigned_username text NULL');
    await pool.query('ALTER TABLE cards ADD COLUMN IF NOT EXISTS personnel_id text NULL');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('UPDATE cards SET status = $1, personnel_id = NULL, assigned_username = NULL, updated_at = NOW() WHERE LOWER(TRIM(card_uid)) = LOWER(TRIM($2))', ['available', cardUid]);
      await client.query('DELETE FROM personnel_card_registrations WHERE LOWER(TRIM(card_uid)) = LOWER(TRIM($1))', [cardUid]);
      await client.query('COMMIT');
      return { ok: true };
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      throw e;
    } finally {
      client.release();
    }
  });

  ipcMain.handle('cards:resetAll', async function () {
    const pool = getPgPool();
    if (!pool) throw new Error('DATABASE_URL is required for cards:resetAll');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // 1. Clear all cards
      await client.query('TRUNCATE TABLE cards RESTART IDENTITY CASCADE');
      
      // 2. Clear card-to-personnel mapping table
      await client.query('TRUNCATE TABLE personnel_card_registrations RESTART IDENTITY CASCADE');
      
      // 3. Clear card_uid column in personnel table (if it exists).
      // Use a savepoint so a failure (e.g. column doesn't exist) doesn't
      // abort the whole transaction — PostgreSQL marks any transaction as
      // aborted on the first error, so we must ROLLBACK TO SAVEPOINT rather
      // than simply swallowing the exception.
      await client.query('SAVEPOINT before_personnel_card_uid');
      try {
        await client.query('UPDATE personnel SET card_uid = NULL');
        await client.query('RELEASE SAVEPOINT before_personnel_card_uid');
      } catch (e) {
        // column might not exist in some versions — roll back only to the
        // savepoint so the outer transaction remains valid.
        await client.query('ROLLBACK TO SAVEPOINT before_personnel_card_uid');
      }

      // 4. Delete all user accounts except 'admin' (this removes the "so many usernames")
      await client.query('DELETE FROM app_user_roles WHERE user_id IN (SELECT id FROM app_users WHERE username != $1)', ['admin']);
      await client.query('DELETE FROM app_users WHERE username != $1', ['admin']);
      try {
        await client.query('DELETE FROM app_user_emails WHERE user_id NOT IN (SELECT id FROM app_users)');
      } catch (_) {}
      
      await client.query('COMMIT');
      return { ok: true };
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      throw e;
    } finally {
      client.release();
    }
  });

  // DB status check for UI diagnostics
  ipcMain.handle('db:status', async function () {
    const pool = getPgPool();
    if (!pool) return { ok: false, error: 'no-pool' };
    try {
      await pool.query('SELECT 1');
      return { ok: true };
    } catch (e) {
      console.error('[DB] status check failed:', e && e.message ? e.message : e);
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  });

  // ── Database sync (primary → Supabase mirror) ──────────────────────────────
  // Lazy-load to avoid a hard dependency in unit tests of registerIpcHandlers.
  const dbSync = require('./db-sync');

  ipcMain.handle('db:syncStatus', async function () {
    // Basic status helper for db-sync
    return { lastSync: new Date().toISOString() }; 
  });

  ipcMain.handle('db:sync', async function () {
    await dbSync.performSync();
    return { ok: true };
  });
}

module.exports = {
  registerIpcHandlers
};
