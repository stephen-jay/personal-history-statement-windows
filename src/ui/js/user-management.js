// User Management Module
(function() {
  let users = [];
  let filteredUsers = [];
  let userToDelete = null;

  // DOM Elements
  const formPanel = document.getElementById('formPanel');
  const btnToggleForm = document.getElementById('btnToggleForm');
  const btnCloseForm = document.getElementById('btnCloseForm');
  const btnCancelForm = document.getElementById('btnCancelForm');
  const btnCreateUser = document.getElementById('btnCreateUser');
  const inputUsername = document.getElementById('inputUsername');
  const inputFullname = document.getElementById('inputFullname');
  const inputPassword = document.getElementById('inputPassword');
  const inputRole = document.getElementById('inputRole');
  const searchInput = document.getElementById('searchInput');
  const tableBody = document.getElementById('tableBody');
  const userCount = document.getElementById('userCount');
  const emptyState = document.getElementById('emptyState');
  const toast = document.getElementById('toast');
  const deleteOverlay = document.getElementById('deleteOverlay');
  const btnDialogCancel = document.getElementById('btnDialogCancel');
  const btnDialogConfirm = document.getElementById('btnDialogConfirm');

  // Initialize
  function init() {
    addEventListeners();
    loadUsers();
  }

  function addEventListeners() {
    btnToggleForm.addEventListener('click', () => toggleFormPanel());
    btnCloseForm.addEventListener('click', () => closeFormPanel());
    btnCancelForm.addEventListener('click', () => closeFormPanel());
    btnCreateUser.addEventListener('click', () => createUser());
    searchInput.addEventListener('input', () => filterUsers());
    btnDialogCancel.addEventListener('click', () => closeDeleteDialog());
    btnDialogConfirm.addEventListener('click', () => confirmDelete());

    // Close form on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && formPanel.classList.contains('open')) {
        closeFormPanel();
      }
    });
  }

  function toggleFormPanel() {
    if (formPanel.classList.contains('open')) {
      closeFormPanel();
    } else {
      openFormPanel();
    }
  }

  function openFormPanel() {
    formPanel.classList.add('open');
    inputUsername.focus();
  }

  function closeFormPanel() {
    formPanel.classList.remove('open');
    clearForm();
  }

  function clearForm() {
    inputUsername.value = '';
    inputFullname.value = '';
    inputPassword.value = '';
    inputRole.value = '';
  }

  async function loadUsers() {
    try {
      // In a real app, this would be an API call
      // For now, using mock data
      const response = await window.adminApi?.getUsers?.() || getMockUsers();
      users = Array.isArray(response) ? response : response.data || [];
      filteredUsers = users;
      renderTable();
      updateUserCount();
    } catch (error) {
      console.error('Error loading users:', error);
      showToast('Error loading users', 'danger');
    }
  }

  function getMockUsers() {
    return [
      { id: 1, username: 'admin', fullname: 'System Admin', role: 'ADMIN', status: 'Active' },
      { id: 2, username: 'apollo3', fullname: 'Apollo Haha', role: 'ADMIN', status: 'Active' },
      { id: 3, username: 'encoder1', fullname: 'Encoder User', role: 'ENCODER', status: 'Active' }
    ];
  }

  function filterUsers() {
    const query = searchInput.value.toLowerCase();
    filteredUsers = users.filter(u => 
      u.username.toLowerCase().includes(query) ||
      u.fullname.toLowerCase().includes(query) ||
      u.role.toLowerCase().includes(query)
    );
    renderTable();
  }

  function renderTable() {
    tableBody.innerHTML = '';

    if (filteredUsers.length === 0) {
      emptyState.classList.add('show');
      return;
    }

    emptyState.classList.remove('show');

    filteredUsers.forEach(user => {
      const row = document.createElement('div');
      row.className = 't-row';

      const userInitial = user.username.charAt(0).toUpperCase();
      const initClass = user.role === 'ADMIN' ? 'admin-init' : 'encoder-init';
      const badge = user.role === 'ADMIN' 
        ? '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 1z"/></svg> ADMIN'
        : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 1z"/></svg> ENCODER';

      row.innerHTML = `
        <div class="user-cell">
          <div class="user-init ${initClass}">${userInitial}</div>
          <div class="username">${escapeHtml(user.username)}</div>
        </div>
        <div class="fullname">${escapeHtml(user.fullname || '')}</div>
        <div class="badge badge-${user.role.toLowerCase()}">${badge}</div>
        <div class="status-active">
          <div class="status-dot"></div>
          ${user.status}
        </div>
        <button class="btn-delete" data-user-id="${user.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6"/><path d="M14 11v6"/>
          </svg>
          Delete
        </button>
      `;

      tableBody.appendChild(row);

      // Add delete handler
      row.querySelector('.btn-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        openDeleteDialog(user.id, user.username);
      });
    });
  }

  function updateUserCount() {
    const count = users.length;
    userCount.textContent = `${count} user${count !== 1 ? 's' : ''}`;
  }

  async function createUser() {
    const username = inputUsername.value.trim();
    const fullname = inputFullname.value.trim();
    const password = inputPassword.value.trim();
    const role = inputRole.value;

    if (!username) {
      showToast('Username is required', 'danger');
      return;
    }
    if (!password || password.length < 8) {
      showToast('Password must be at least 8 characters', 'danger');
      return;
    }
    if (!role) {
      showToast('Please select a role', 'danger');
      return;
    }

    try {
      // In a real app, this would be an API call
      if (window.adminApi?.createUser) {
        await window.adminApi.createUser({ username, fullname, password, role });
      }

      closeFormPanel();
      showToast('User created successfully', 'success');
      loadUsers();
    } catch (error) {
      console.error('Error creating user:', error);
      showToast('Error creating user', 'danger');
    }
  }

  function openDeleteDialog(userId, username) {
    userToDelete = { id: userId, username };
    document.getElementById('dialogMsg').textContent = 
      `Are you sure you want to delete the user "${username}"? This action cannot be undone.`;
    deleteOverlay.classList.add('show');
  }

  function closeDeleteDialog() {
    deleteOverlay.classList.remove('show');
    userToDelete = null;
  }

  async function confirmDelete() {
    if (!userToDelete) return;

    try {
      if (window.adminApi?.deleteUser) {
        await window.adminApi.deleteUser(userToDelete.id);
      }

      closeDeleteDialog();
      showToast(`User "${userToDelete.username}" deleted successfully`, 'success');
      loadUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      showToast('Error deleting user', 'danger');
    }
  }

  function showToast(message, type = 'success') {
    toast.textContent = message;
    toast.className = 'toast show ' + (type === 'danger' ? 'danger' : '');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Export for testing/external use
  window.userManagementModule = {
    init,
    loadUsers,
    filterUsers,
    renderTable
  };
})();
