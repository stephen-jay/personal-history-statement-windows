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
  const usersTbody = adminViewEl.querySelector('#admin-users-tbody');
  const createCard = adminViewEl.querySelector('.admin-card--create');
  const toolbar = adminViewEl.querySelector('.toolbar.roster-toolbar');

  if (!form || !usernameEl || !passwordEl || !roleSelectEl || !usersTbody) return;
  if (!adminApi || typeof adminApi.getRoles !== 'function' || typeof adminApi.createUser !== 'function' || typeof adminApi.listUsers !== 'function') {
    setStatus(statusEl, 'Admin API unavailable.', 'error');
    return;
  }

  // Add "Add New User" button to toolbar if not present
  if (toolbar && !toolbar.querySelector('#admin-card-add-btn')) {
    const addBtn = document.createElement('button');
    addBtn.id = 'admin-card-add-btn';
    addBtn.type = 'button';
    addBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Add New User';
    toolbar.appendChild(addBtn);
    
    addBtn.addEventListener('click', () => {
      if (createCard) {
        createCard.classList.toggle('open');
        if (createCard.classList.contains('open')) {
          usernameEl.focus();
        }
      }
    });
  }

  // Add close button functionality
  if (createCard) {
    let closeBtn = createCard.querySelector('.admin-close-btn');
    if (!closeBtn) {
      // Create close button if it doesn't exist
      closeBtn = document.createElement('button');
      closeBtn.className = 'admin-close-btn';
      closeBtn.type = 'button';
      closeBtn.textContent = '✕';
      const header = createCard.querySelector('.admin-card-header');
      if (header) {
        header.appendChild(closeBtn);
      }
    }
    
    closeBtn.addEventListener('click', () => {
      createCard.classList.remove('open');
      clearForm();
    });
  }

  // Close form on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && createCard && createCard.classList.contains('open')) {
      createCard.classList.remove('open');
      clearForm();
    }
  });

  function clearForm() {
    usernameEl.value = '';
    fullNameEl.value = '';
    passwordEl.value = '';
    roleSelectEl.value = '';
    setStatus(statusEl, '');
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

  function getAvatarInitials(username, fullName) {
    var name = (fullName || username || '').trim();
    var parts = name.split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
    return String(username || 'U').charAt(0).toUpperCase();
  }

  function getRoleColor(roleName) {
    var role = String(roleName || '').toLowerCase();
    if (role === 'admin') return 'admin';
    if (role === 'encoder') return 'encoder';
    if (role === 'viewer') return 'viewer';
    return 'default';
  }

  function renderUsers(users) {
    usersTbody.innerHTML = '';
    (users || []).forEach(function (u) {
      var tr = document.createElement('tr');
      var roles = Array.isArray(u.roles) ? u.roles : [];
      var status = u.is_active ? 'Active' : 'Inactive';
      var initials = getAvatarInitials(u.username, u.full_name);
      tr.setAttribute('data-user-id', String(u.id));
      tr.setAttribute('data-username', String(u.username || ''));
      tr.setAttribute('data-roles', roles.join(', '));
      
      var rolesPillsHtml = roles.map(function (role) {
        var color = getRoleColor(role);
        return '<span class="admin-role-pill admin-role-pill--' + color + '">' + String(role) + '</span>';
      }).join('');
      
      var statusPillClass = status === 'Active' ? 'admin-status-pill--active' : 'admin-status-pill--inactive';
      
      tr.innerHTML =
        '<td class="admin-user-cell">' +
          '<div class="admin-user-avatar admin-avatar--' + (u.username === 'admin' ? 'admin' : 'standard') + '">' + initials + '</div>' +
          '<span class="admin-username">' + String(u.username || '') + '</span>' +
        '</td>' +
        '<td>' + String(u.full_name || '—') + '</td>' +
        '<td class="admin-roles-cell">' + rolesPillsHtml + '</td>' +
        '<td><span class="admin-status-pill ' + statusPillClass + '">' + status + '</span></td>' +
        '<td class="table-actions">' +
          '<button type="button" class="btn danger small admin-user-delete" title="Delete user">Delete</button>' +
        '</td>';
      usersTbody.appendChild(tr);
    });
  }

  async function loadUsers() {
    try {
      const result = await adminApi.listUsers();
      renderUsers((result && result.users) || []);
    } catch (err) {
      var msg = err && err.message ? err.message : String(err);
      setStatus(statusEl, 'Could not load users. ' + msg, 'error');
    }
  }

  usersTbody.addEventListener('click', async function (event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const row = target.closest('tr');
    if (!row) return;
    const userId = row.getAttribute('data-user-id');
    const username = row.getAttribute('data-username') || '';
    if (!userId) return;

    if (target.classList.contains('admin-user-delete')) {
      const { showConfirm } = await import('./confirm.js');
      const confirmed = await showConfirm('Delete user "' + username + '"? This cannot be undone.', { confirmText: 'Delete', cancelText: 'Cancel' });
      if (!confirmed) return;
      try {
        setStatus(statusEl, 'Deleting user…', 'success');
        if (typeof adminApi.deleteUser === 'function') {
          await adminApi.deleteUser(userId);
        } else {
          throw new Error('Delete user API not available.');
        }
        await loadUsers();
        setStatus(statusEl, 'Deleted user ' + username + '.', 'success');
      } catch (err) {
        var msgDel = err && err.message ? err.message : String(err);
        setStatus(statusEl, 'Delete failed. ' + msgDel, 'error');
      }
    }
  });

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
      if (createCard) {
        createCard.classList.remove('open');
      }
      await loadRoles();
      await loadUsers();
    } catch (err) {
      var msg = err && err.message ? err.message : String(err);
      setStatus(statusEl, 'Create failed. ' + msg, 'error');
    }
  });

  loadRoles().catch(function (err) {
    setStatus(statusEl, 'Could not load roles. ' + (err && err.message ? err.message : String(err)), 'error');
  });

  loadUsers().catch(function () {});
}

