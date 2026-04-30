
import { escapeHtml } from './escape.js';

export function initAuditLogs({
  isAdmin,
  phsModalCtl,
  listView,
  analyticsView,
  adminView,
  auditView,
  setActiveNav,
  setAppView,
  topbarSection,
  setTopbarSection,
  auditLogsContainer,
  auditSearch,
  auditFilterAction,
  adminApi,
  toast
}) {
  let allAuditLogs = [];
  let actionFilter = '';
  const dateFilterEl = auditFilterAction;
  const actionButtons = Array.from(document.querySelectorAll('[data-audit-action]'));
  const statInsertEl = document.getElementById('audit-stat-inserts');
  const statUpdateEl = document.getElementById('audit-stat-updates');
  const statDeleteEl = document.getElementById('audit-stat-deletes');
  const statUsersEl = document.getElementById('audit-stat-users');

  function getDateValue(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function startOfDay(date) {
    const copy = new Date(date);
    copy.setHours(0, 0, 0, 0);
    return copy;
  }

  function isSameDay(left, right) {
    return left && right && left.toDateString() === right.toDateString();
  }

  function formatLongDate(date) {
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase();
  }

  function formatShortTime(date) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  function getActionMeta(action) {
    const normalized = String(action || '').toUpperCase();
    if (normalized === 'INSERT') return { label: 'INSERT', className: 'insert', verb: 'created' };
    if (normalized === 'UPDATE') return { label: 'UPDATE', className: 'update', verb: 'updated' };
    if (normalized === 'DELETE') return { label: 'DELETE', className: 'delete', verb: 'deleted' };
    return { label: normalized || 'CHANGE', className: 'update', verb: 'updated' };
  }

  function getRecordTarget(log) {
    const name = log && log.target_personnel_name ? String(log.target_personnel_name) : '';
    if (name) return name;
    const recordId = log && log.record_id != null ? String(log.record_id) : '';
    if (recordId) return 'Record ' + recordId.slice(0, 8);
    return 'Unknown record';
  }

  function getSummaryText(log) {
    if (!log) return 'Updated record';
    if (log.action === 'UPDATE' && log.old_data && log.new_data) {
      let changeCount = 0;
      Object.keys(log.new_data).forEach(function (key) {
        if (['updated_at', 'version', 'created_at', 'deleted_at'].includes(key)) return;
        if (JSON.stringify(log.old_data[key]) !== JSON.stringify(log.new_data[key])) changeCount++;
      });
      return changeCount > 0 ? ('Modified ' + changeCount + ' field' + (changeCount === 1 ? '' : 's')) : 'System metadata updated';
    }
    if (log.action === 'INSERT') return 'Created new record';
    if (log.action === 'DELETE') return 'Removed record from active roster';
    return 'Updated record';
  }

  function getDateFilterBounds() {
    const now = new Date();
    const todayStart = startOfDay(now);
    if (!dateFilterEl || dateFilterEl.value === 'all') return null;
    if (dateFilterEl.value === 'today') {
      return { start: todayStart, end: new Date(todayStart.getTime() + 24 * 60 * 60 * 1000) };
    }
    if (dateFilterEl.value === 'yesterday') {
      const start = new Date(todayStart);
      start.setDate(start.getDate() - 1);
      const end = new Date(todayStart);
      return { start, end };
    }
    if (dateFilterEl.value === '7d') {
      const start = new Date(todayStart);
      start.setDate(start.getDate() - 6);
      return { start, end: new Date(todayStart.getTime() + 24 * 60 * 60 * 1000) };
    }
    if (dateFilterEl.value === '30d') {
      const start = new Date(todayStart);
      start.setDate(start.getDate() - 29);
      return { start, end: new Date(todayStart.getTime() + 24 * 60 * 60 * 1000) };
    }
    return null;
  }

  function matchesDateFilter(log) {
    const date = getDateValue(log && log.changed_at);
    const bounds = getDateFilterBounds();
    if (!bounds) return true;
    if (!date) return false;
    return date >= bounds.start && date < bounds.end;
  }

  function updateActionButtons() {
    actionButtons.forEach(function (button) {
      const isActive = String(button.getAttribute('data-audit-action') || '') === actionFilter;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  function updateStats() {
    const today = new Date();
    const todayLogs = allAuditLogs.filter(function (log) {
      const date = getDateValue(log && log.changed_at);
      return date ? isSameDay(date, today) : false;
    });

    const insertsToday = todayLogs.filter(function (log) { return log.action === 'INSERT'; }).length;
    const updatesToday = todayLogs.filter(function (log) { return log.action === 'UPDATE'; }).length;
    const deletesToday = todayLogs.filter(function (log) { return log.action === 'DELETE'; }).length;
    const activeUsers = new Set(todayLogs.map(function (log) {
      return String(log && log.admin_name ? log.admin_name : 'System User').trim();
    }).filter(Boolean)).size;

    if (statInsertEl) statInsertEl.textContent = String(insertsToday);
    if (statUpdateEl) statUpdateEl.textContent = String(updatesToday);
    if (statDeleteEl) statDeleteEl.textContent = String(deletesToday);
    if (statUsersEl) statUsersEl.textContent = String(activeUsers);
  }

  function renderAuditSkeleton(count) {
    if (!auditLogsContainer) return;
    const skeletonCount = Math.max(3, Number(count) || 6);
    let html = '<div class="audit-list">';
    for (let i = 0; i < skeletonCount; i++) {
      html += `
        <div class="audit-date-group">
          <div class="audit-date-group__header audit-date-group__header--skeleton">
            <span class="audit-date-group__label skeleton-cell skeleton--wide" style="height:12px; max-width:280px;"></span>
            <span class="audit-date-group__line"></span>
            <span class="audit-date-group__count skeleton-cell skeleton--short" style="height:12px; max-width:72px;"></span>
          </div>
          <div class="audit-date-group__items">
            <div class="audit-log-card audit-log-card--skeleton">
              <span class="audit-log-card__dot"></span>
              <div class="audit-log-card__body">
                <div class="skeleton-cell skeleton--wide" style="height:14px; margin-bottom:10px;"></div>
                <div class="skeleton-cell skeleton--medium" style="height:12px; max-width:220px;"></div>
              </div>
              <span class="skeleton-cell skeleton--short" style="height:12px; width:72px;"></span>
            </div>
          </div>
        </div>
      `;
    }
    html += '</div>';
    auditLogsContainer.innerHTML = html;
  }

  function showAuditLogs() {
      if (!isAdmin) {
        toast.error('Admin access required.');
        return;
      }
      if (phsModalCtl && phsModalCtl.isOpen()) {
        phsModalCtl.close(false);
      }
      listView.classList.remove('active');
      if (analyticsView) analyticsView.classList.remove('active');
      if (adminView) adminView.classList.remove('active');
      if (auditView) auditView.classList.add('active');
      setActiveNav('audit');
      setAppView('audit');
      setTopbarSection(topbarSection, 'Audit Logs');
      updateActionButtons();
      loadAuditLogs();
    }

    function loadAuditLogs() {
      if (!auditLogsContainer) return;
      renderAuditSkeleton(6);
      
      adminApi.getAuditLogs().then(function (logs) {
        allAuditLogs = logs || [];
        updateStats();
        applyAuditFilters();
      }).catch(function (err) {
        console.error(err);
        auditLogsContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #b91c1c;">Failed to load logs: ' + (err.message || String(err)) + '</div>';
      });
    }

    function applyAuditFilters() {
      const searchTerm = (auditSearch && auditSearch.value ? auditSearch.value : '').toLowerCase().trim();
      const selectedDateFilter = auditFilterAction && auditFilterAction.value ? auditFilterAction.value : 'all';

      const filteredLogs = allAuditLogs.filter(function (log) {
        const matchesAction = !actionFilter || String(log.action || '').toUpperCase() === actionFilter;
        const searchTarget = [log.admin_name || '', log.target_personnel_name || '', log.action || '', log.table_name || ''].join(' ').toLowerCase();
        const matchesSearch = !searchTerm || searchTarget.includes(searchTerm);
        return matchesAction && matchesSearch && matchesDateFilter(log);
      });

      renderAuditLogs(filteredLogs);
      if (dateFilterEl && selectedDateFilter !== dateFilterEl.value) {
        dateFilterEl.value = selectedDateFilter;
      }
    }

    if (auditSearch) auditSearch.addEventListener('input', applyAuditFilters);
    if (auditFilterAction) auditFilterAction.addEventListener('change', applyAuditFilters);

    actionButtons.forEach(function (button) {
      button.addEventListener('click', function () {
        actionFilter = String(button.getAttribute('data-audit-action') || '');
        updateActionButtons();
        applyAuditFilters();
      });
    });

    if (dateFilterEl) {
      dateFilterEl.addEventListener('change', applyAuditFilters);
    }

    function renderAuditLogs(logs) {
      if (!auditLogsContainer) return;
      if (!logs || logs.length === 0) {
        auditLogsContainer.innerHTML = '<div class="audit-empty-state">No activity logs found matching your criteria.</div>';
        return;
      }

      const sortedLogs = logs.slice().sort(function (left, right) {
        return new Date(right.changed_at).getTime() - new Date(left.changed_at).getTime();
      });
      const grouped = [];
      const today = new Date();
      let currentKey = '';
      let currentGroup = null;

      sortedLogs.forEach(function (log) {
        const date = getDateValue(log.changed_at);
        if (!date) return;
        const key = startOfDay(date).getTime();
        if (!currentGroup || currentKey !== key) {
          currentKey = key;
          currentGroup = {
            date: date,
            logs: []
          };
          grouped.push(currentGroup);
        }
        currentGroup.logs.push(log);
      });

      let html = '<div class="audit-list">';

      grouped.forEach(function (group) {
        const isToday = isSameDay(group.date, today);
        const label = isToday ? ('TODAY — ' + formatLongDate(group.date)) : formatLongDate(group.date);
        const count = group.logs.length;

        html += '<section class="audit-date-group">';
        html += '<div class="audit-date-group__header">';
        html += '<span class="audit-date-group__label">' + escapeHtml(label) + '</span>';
        html += '<span class="audit-date-group__line" aria-hidden="true"></span>';
        html += '<span class="audit-date-group__count">' + count + ' EVENT' + (count === 1 ? '' : 'S') + '</span>';
        html += '</div>';
        html += '<div class="audit-date-group__items">';

        group.logs.forEach(function (log) {
          const meta = getActionMeta(log.action);
          const date = getDateValue(log.changed_at) || new Date();
          const title = escapeHtml((log.admin_name || 'System User') + ' ' + meta.verb + ' record for ' + getRecordTarget(log));
          const summary = escapeHtml(getSummaryText(log));
          const badge = escapeHtml(meta.label);
          const adminName = escapeHtml(log.admin_name || 'System User');
          const targetName = escapeHtml(getRecordTarget(log));

          html += '<article class="audit-log-card audit-log-card--' + meta.className + '">';
          html += '<span class="audit-log-card__dot audit-log-card__dot--' + meta.className + '" aria-hidden="true"></span>';
          html += '<div class="audit-log-card__body">';
          html += '<div class="audit-log-card__title"><strong>' + adminName + '</strong> ' + meta.verb + ' record for <strong>' + targetName + '</strong></div>';
          html += '<div class="audit-log-card__meta"><span class="audit-log-card__badge audit-log-card__badge--' + meta.className + '">' + badge + '</span><span class="audit-log-card__summary">' + summary + '</span></div>';
          html += '</div>';
          html += '<time class="audit-log-card__time" datetime="' + escapeHtml(date.toISOString()) + '">' + escapeHtml(formatShortTime(date)) + '</time>';
          html += '</article>';
        });

        html += '</div></section>';
      });

      html += '</div>';
      auditLogsContainer.innerHTML = html;
    }

    

  return { showAuditLogs };
}
