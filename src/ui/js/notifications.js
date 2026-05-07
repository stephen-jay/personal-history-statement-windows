// ---------------------------------------------------------------------------
// Notification System
// Manages preferences (localStorage), notification history, bell badge,
// and the notification panel dropdown.
// ---------------------------------------------------------------------------

const PREFS_KEY = 'phs_notif_prefs';
const HISTORY_KEY = 'phs_notif_history';
const MAX_HISTORY = 50;

const DEFAULT_PREFS = {
  activity: true,
  personnel: true,
  audit: false
};

function getPrefs() {
  try {
    return Object.assign({}, DEFAULT_PREFS, JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'));
  } catch (_) {
    return Object.assign({}, DEFAULT_PREFS);
  }
}

function setPrefs(prefs) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (_) {}
}

function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch (_) {
    return [];
  }
}

function addToHistory(item) {
  const history = getHistory();
  history.unshift(item);
  if (history.length > MAX_HISTORY) history.splice(MAX_HISTORY);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch (_) {}
}

function getUnreadCount() {
  return getHistory().filter(function (n) { return !n.read; }).length;
}

function markAllRead() {
  const history = getHistory().map(function (n) {
    return Object.assign({}, n, { read: true });
  });
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch (_) {}
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatTime(ts) {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    const diff = Date.now() - d.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    return d.toLocaleDateString();
  } catch (_) {
    return '';
  }
}

function getTypeIcon(type) {
  if (type === 'personnel') {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
  }
  if (type === 'audit') {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>';
  }
  // activity / default
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>';
}

export function initNotifications(options) {
  const opts = options || {};
  const toast = opts.toast || null;

  const bell = document.getElementById('notif-bell');
  const badge = document.getElementById('notif-badge');
  const panel = document.getElementById('notif-panel');
  const panelList = document.getElementById('notif-panel-list');
  const markReadBtn = document.getElementById('notif-mark-read');
  const clearAllBtn = document.getElementById('notif-clear-all');

  function updateBadge() {
    const count = getUnreadCount();
    if (badge) {
      badge.textContent = count > 9 ? '9+' : String(count);
      badge.hidden = count === 0;
    }
  }

  function renderPanel() {
    if (!panelList) return;
    const history = getHistory();
    if (!history.length) {
      panelList.innerHTML = '<div class="notif-empty"><div class="notif-empty-icon">🔔</div><div>No notifications yet</div></div>';
      return;
    }
    panelList.innerHTML = history.map(function (n) {
      return (
        '<div class="notif-item' + (n.read ? '' : ' notif-item--unread') + '">' +
          '<div class="notif-item-icon notif-icon--' + escapeHtml(n.type) + '">' +
            getTypeIcon(n.type) +
          '</div>' +
          '<div class="notif-item-body">' +
            '<div class="notif-item-title">' + escapeHtml(n.title) + '</div>' +
            '<div class="notif-item-msg">' + escapeHtml(n.message) + '</div>' +
            '<div class="notif-item-time">' + formatTime(n.timestamp) + '</div>' +
          '</div>' +
        '</div>'
      );
    }).join('');
  }

  let panelOpen = false;

  function openPanel() {
    panelOpen = true;
    if (panel) panel.hidden = false;
    markAllRead();
    updateBadge();
    renderPanel();
  }

  function closePanel() {
    panelOpen = false;
    if (panel) panel.hidden = true;
  }

  if (bell) {
    bell.addEventListener('click', function (e) {
      e.stopPropagation();
      if (panelOpen) closePanel();
      else openPanel();
    });
  }

  if (markReadBtn) {
    markReadBtn.addEventListener('click', function () {
      markAllRead();
      updateBadge();
      renderPanel();
    });
  }

  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', function () {
      try { localStorage.removeItem(HISTORY_KEY); } catch (_) {}
      updateBadge();
      renderPanel();
    });
  }

  document.addEventListener('click', function (e) {
    if (!panelOpen) return;
    if (panel && !panel.contains(e.target) && e.target !== bell && !bell.contains(e.target)) {
      closePanel();
    }
  });

  // Wire Settings notification toggles
  const activityToggle = document.getElementById('notif-toggle-activity');
  const personnelToggle = document.getElementById('notif-toggle-personnel');
  const auditToggle = document.getElementById('notif-toggle-audit');

  const prefs = getPrefs();
  if (activityToggle) activityToggle.checked = prefs.activity;
  if (personnelToggle) personnelToggle.checked = prefs.personnel;
  if (auditToggle) auditToggle.checked = prefs.audit;

  function saveToggles() {
    setPrefs({
      activity: activityToggle ? activityToggle.checked : getPrefs().activity,
      personnel: personnelToggle ? personnelToggle.checked : getPrefs().personnel,
      audit: auditToggle ? auditToggle.checked : getPrefs().audit,
    });
  }

  [activityToggle, personnelToggle, auditToggle].forEach(function (toggle) {
    if (toggle) toggle.addEventListener('change', saveToggles);
  });

  updateBadge();

  // ---------------------------------------------------------------------------
  // Main notify function
  // ---------------------------------------------------------------------------
  function notify(type, title, message) {
    const currentPrefs = getPrefs();
    if (type === 'activity' && !currentPrefs.activity) return;
    if (type === 'personnel' && !currentPrefs.personnel) return;
    if (type === 'audit' && !currentPrefs.audit) return;

    const item = {
      id: Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      type: type,
      title: title,
      message: message,
      timestamp: new Date().toISOString(),
      read: false,
    };

    addToHistory(item);
    updateBadge();

    // Animate bell
    if (bell) {
      bell.classList.remove('notif-bell--ring');
      void bell.offsetWidth; // reflow to restart animation
      bell.classList.add('notif-bell--ring');
      setTimeout(function () { bell.classList.remove('notif-bell--ring'); }, 600);
    }

    // Fire toast
    if (toast) {
      if (type === 'personnel') toast.success(message, { duration: 5000 });
      else if (type === 'audit') toast.warning(message, { duration: 5000 });
      else toast.info(message, { duration: 4000 });
    }

    // Re-render panel if open
    if (panelOpen) renderPanel();
  }

  return { notify, updateBadge, renderPanel, getPrefs, setPrefs };
}
