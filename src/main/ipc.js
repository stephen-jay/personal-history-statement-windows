const { getPgPool, getData, saveJsonRecord, deleteJsonRecord, getPostgresData, savePostgresRecord, deletePostgresRecord } = require('./database');
const auth = require('./auth');
const imageStorage = require('../../image-storage');

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
      result = await auth.loginWithLocalPostgres(username, password);
    }

    if (!result) {
      throw new Error('No local DATABASE_URL configured.');
    }

    const newSession = { token: result && result.token ? String(result.token) : '', user: result && result.user ? result.user : null };
    auth.setAuthSession(newSession);
    return newSession.user ? { user: newSession.user } : null;
  });

  ipcMain.handle('auth:session', async function () {
    const session = auth.getAuthSession();
    if (!session || !session.token || !session.user) return null;
    return { user: session.user, roles: session.user.roles || [] };
  });

  ipcMain.handle('auth:logout', async function () {
    auth.setAuthSession(null);
    return { ok: true };
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
    const pool = getPgPool();
    if (!pool) throw new Error('DATABASE_URL is required for local admin operations.');
    const rows = await pool.query(
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
    return { users: rows.rows || [] };
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
    const pool = getPgPool();
    if (!pool) throw new Error('DATABASE_URL is required for audit logs.');
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
    return (records || []).map(function (record) {
      return imageStorage.hydrateRecordImages(config.IMAGE_UPLOAD_DIR, record);
    });
  });

  function archivePersonnelImages(record) {
    try {
      imageStorage.archiveRecordImages(config.IMAGE_UPLOAD_DIR, record);
    } catch (e) {
      console.error('personnel image archive failed:', e && e.message ? e.message : e);
    }
  }

  ipcMain.handle('personnel:save', async (_, record) => {
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
}

module.exports = {
  registerIpcHandlers
};
