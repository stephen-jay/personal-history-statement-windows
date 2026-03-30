function setStatus(statusEl, message, state) {
  if (!statusEl) return;
  statusEl.textContent = message || '';
  if (!message) {
    statusEl.removeAttribute('data-state');
    return;
  }
  statusEl.setAttribute('data-state', state || 'error');
}

export function initAdminUsersView(opts) {
  opts = opts || {};
  const adminViewEl = opts.adminViewEl;
  const adminApi = opts.adminApi;
  if (!adminViewEl) return;

  const form = adminViewEl.querySelector('#admin-user-form');
  const usernameEl = adminViewEl.querySelector('#admin-username');
  const fullNameEl = adminViewEl.querySelector('#admin-fullname');
  const passwordEl = adminViewEl.querySelector('#admin-password');
  const roleSelectEl = adminViewEl.querySelector('#admin-role');
  const statusEl = adminViewEl.querySelector('#admin-user-status');

  if (!form || !usernameEl || !passwordEl || !roleSelectEl) return;
  if (!adminApi || typeof adminApi.getRoles !== 'function' || typeof adminApi.createUser !== 'function') {
    setStatus(statusEl, 'Admin API unavailable.', 'error');
    return;
  }

  async function loadRoles() {
    setStatus(statusEl, '');
    const result = await adminApi.getRoles();
    const roles = (result && result.roles) || [];

    roleSelectEl.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Select a role…';
    placeholder.disabled = true;
    placeholder.selected = true;
    roleSelectEl.appendChild(placeholder);

    roles.forEach(function (roleName) {
      const opt = document.createElement('option');
      opt.value = String(roleName);
      opt.textContent = String(roleName);
      roleSelectEl.appendChild(opt);
    });
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    setStatus(statusEl, '');

    const username = String(usernameEl.value || '').trim();
    const fullName = String(fullNameEl && fullNameEl.value ? fullNameEl.value : '').trim();
    const password = String(passwordEl.value || '');
    const roleName = String(roleSelectEl.value || '').trim();

    if (!username || !password || !roleName) {
      setStatus(statusEl, 'Please complete username, password, and role.', 'error');
      return;
    }

    try {
      const resp = await adminApi.createUser({
        username: username,
        password: password,
        fullName: fullName,
        roleName: roleName,
      });

      const createdUsername = resp && resp.user && resp.user.username ? resp.user.username : username;
      setStatus(statusEl, 'User created: ' + createdUsername, 'success');
      form.reset();
      await loadRoles();
    } catch (err) {
      var msg = err && err.message ? err.message : String(err);
      setStatus(statusEl, 'Create failed. ' + msg, 'error');
    }
  });

  loadRoles().catch(function (err) {
    setStatus(statusEl, 'Could not load roles. ' + (err && err.message ? err.message : String(err)), 'error');
  });
}

