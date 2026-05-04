import { FIELD_IDS, ROW_SECTIONS } from './constants.js';
import * as formData from './form-data.js';
import { renderAnalytics } from './analytics.js';
import { buildSummaryHtml } from './summary.js';
import { buildStandalonePhsHtml, suggestedExportBasename } from './phs-export-html.js';
import { renderList, renderRosterSkeleton } from './list.js';
import { setActiveNav, setAppView, setTopbarSection } from './views.js';
import { createFormNav } from './form-nav.js';
import { createPhsModalController } from './phs-modal.js';
import { squareThumbnailDataUrl } from './photo-thumbnail.js';
import { initAdminUsersView } from './admin-users.js';
import { initToastSystem } from './toast.js';
import { buildAutoFillRecord } from './autofill.js';
import { initAuditLogs } from './audit-log.js';
import { initSettingsView } from './settings.js';
import { show as showLoader, hide as hideLoader } from './loader.js';

function showError(msg) {
  document.body.innerHTML = '<div style="padding:24px;font-family:sans-serif;max-width:500px"><h2>Error</h2><p>' + String(msg).replace(/</g, '&lt;') + '</p><p>Check the console (Ctrl+Shift+I) for details.</p></div>';
}

async function loadFormPages() {
  const pagesContainer = document.getElementById('form-pages');
  if (!pagesContainer) throw new Error('Form pages container not found.');
  showLoader('Loading interface…');
  const files = [
    'pages/form-page-1-personal-details.html',
    'pages/form-page-2-characteristics-marital.html',
    'pages/form-page-3-family-history.html',
    'pages/form-page-4-education-residence-employment-foreign.html',
    'pages/form-page-5-credit-to-misc.html'
  ];
  const htmlPages = await Promise.all(files.map(async function (file) {
    const response = await fetch(file);
    if (!response.ok) throw new Error('Failed to load ' + file);
    return response.text();
  }));
  pagesContainer.innerHTML = htmlPages.join('\n');
  hideLoader();
}

async function loadAnalyticsPage() {
  const analyticsContainer = document.getElementById('analytics-content');
  if (!analyticsContainer) throw new Error('Analytics container not found.');
  showLoader('Loading reports…');
  const response = await fetch('pages/analytics-view.html');
  if (!response.ok) throw new Error('Failed to load analytics-view.html');
  analyticsContainer.innerHTML = await response.text();
  hideLoader();
}

(async function bootstrap() {
  try {
    await loadFormPages();
    await loadAnalyticsPage();

    // Initialize toast system
    window.toast = initToastSystem();

    const isPackagedApp = (() => {
      try {
        if (typeof process === 'undefined' || !process || !process.execPath) return false;
        const execPath = String(process.execPath).toLowerCase();
        if (/electron(\.exe)?$/.test(execPath)) return false;
        if (typeof process.defaultApp === 'boolean') return !process.defaultApp;
        return true;
      } catch (e) {
        return false;
      }
    })();

    // --- Update popup (anchored above logout) ---
    function createUpdatePopup() {
      if (document.getElementById('update-popup')) return;
      const sidebarFooter = document.querySelector('.sidebar-footer');
      const container = document.createElement('div');
      container.id = 'update-popup';
      container.className = 'update-popup';
      container.innerHTML = `
        <div class="update-popup-inner" aria-live="polite">
          <div class="update-header">
            <span class="update-title">Update Available</span>
            <button class="update-close" aria-label="Close update" title="Close">×</button>
          </div>
          <div class="update-version">Version <span class="update-version-num"></span> is ready to install</div>
          <div class="update-progress-row" hidden>
            <div class="update-progress-track"><div class="update-progress-fill" style="width:0%"></div></div>
            <div class="update-progress-percent">0%</div>
          </div>
          <div class="update-actions">
            <button class="update-now">Update Now</button>
            <button class="update-restart" hidden>Restart to Apply</button>
          </div>
          <button class="update-later" type="button">Later</button>
        </div>
      `;
      if (sidebarFooter) sidebarFooter.parentNode.insertBefore(container, sidebarFooter);
      else document.body.appendChild(container);

      const closeBtn = container.querySelector('.update-close');
      const laterBtn = container.querySelector('.update-later');
      const nowBtn = container.querySelector('.update-now');
      const restartBtn = container.querySelector('.update-restart');
      const progressRow = container.querySelector('.update-progress-row');
      const progressFill = container.querySelector('.update-progress-fill');
      const progressPercent = container.querySelector('.update-progress-percent');

      function setIdleState() {
        nowBtn.hidden = false;
        nowBtn.disabled = false;
        nowBtn.textContent = 'Update Now';
        restartBtn.hidden = true;
        progressRow.hidden = true;
      }

      function setDownloadingState(pct) {
        const safePct = Math.min(100, Math.max(0, Math.floor(Number(pct) || 0)));
        nowBtn.hidden = false;
        nowBtn.disabled = true;
        nowBtn.textContent = safePct >= 100 ? 'Downloaded' : 'Downloading...';
        restartBtn.hidden = true;
        progressRow.hidden = false;
        progressFill.style.width = safePct + '%';
        progressPercent.textContent = safePct + '%';
      }

      function setCompleteState() {
        nowBtn.hidden = true;
        restartBtn.hidden = false;
        progressRow.hidden = true;
      }

      closeBtn.addEventListener('click', () => container.remove());
      laterBtn.addEventListener('click', () => container.remove());
      nowBtn.addEventListener('click', async function () {
        try {
          const res = await window.updateApi.downloadUpdate();
          if (!res || !res.ok) {
            window.toast.error('Failed to start download: ' + (res && res.error ? res.error : 'unknown'));
          } else {
            window.toast.info('Downloading update…');
            setDownloadingState(0);
          }
        } catch (e) { window.toast.error('Download failed'); }
      });
      restartBtn.addEventListener('click', async function () {
        try {
          await window.updateApi.installUpdate();
        } catch (e) {
          window.toast.error('Could not install update: ' + (e && e.message ? e.message : e));
        }
      });

      setIdleState();

      container._updateUi = {
        setIdleState,
        setDownloadingState,
        setCompleteState
      };
    }

    function showUpdatePopupFor(info) {
      createUpdatePopup();
      const el = document.getElementById('update-popup');
      if (!el) return;
      el.querySelector('.update-version-num').textContent = (info && info.version) ? info.version : 'new';
      if (el._updateUi && typeof el._updateUi.setIdleState === 'function') {
        el._updateUi.setIdleState();
      }
      el.classList.add('visible');
    }
    function setUpdateProgress(progress) {
      const el = document.getElementById('update-popup');
      if (!el) return;
      const pct = Math.min(100, Math.floor((progress && progress.percent) ? progress.percent : 0));
      if (el._updateUi && typeof el._updateUi.setDownloadingState === 'function') {
        el._updateUi.setDownloadingState(pct);
      }
    }
    function showRestartAction() {
      const el = document.getElementById('update-popup');
      if (!el) return;
      if (el._updateUi && typeof el._updateUi.setCompleteState === 'function') {
        el._updateUi.setCompleteState();
      }
    }

    // Wire updateApi events (safe if updateApi not present)
    try {
      if (window.updateApi) {
        window.updateApi.onUpdateAvailable((info) => {
          console.log('[UPDATE][renderer] available:', info && info.version ? info.version : info);
          showUpdatePopupFor(info);
        });
        window.updateApi.onDownloadProgress((p) => {
          console.log('[UPDATE][renderer] progress:', p && p.percent ? p.percent : p);
          setUpdateProgress(p);
          const pct = Math.min(100, Math.floor((p && p.percent) ? p.percent : 0));
          if (pct >= 100) {
            setTimeout(() => showRestartAction(), 300);
          }
        });
        window.updateApi.onUpdateDownloaded((info) => {
          console.log('[UPDATE][renderer] downloaded:', info && info.version ? info.version : info);
          showRestartAction();
          window.toast.success('Update ready. Restart the app to apply.');
        });
        window.updateApi.onUpdateNotAvailable((info) => {
          console.log('[UPDATE][renderer] not available:', info && info.version ? info.version : info);
        });
        window.updateApi.onUpdateError((payload) => {
          const msg = payload && payload.message ? payload.message : String(payload || 'Unknown update error');
          console.error('[UPDATE][renderer] error:', msg);
          window.toast.error('Update check failed: ' + msg);
        });
        // Re-check only in packaged builds so dev startup does not hit missing main-process handlers.
        if (isPackagedApp) {
          window.updateApi.checkForUpdates().then(function (res) {
            console.log('[UPDATE][renderer] check requested:', res);
          }).catch(function (e) {
            console.error('[UPDATE][renderer] check request failed:', e && e.message ? e.message : e);
          });
        }
      }
    } catch (e) { /* ignore if not present */ }

    if (!window.personnelApi) {
      showError('personnelApi not loaded. Preload may have failed.');
      return;
    }

    if (!window.authApi || typeof window.authApi.getSession !== 'function') {
      showError('authApi not loaded. Preload may have failed.');
      return;
    }

    const session = await window.authApi.getSession();
    if (!session || !session.user) {
      window.location.href = 'login.html';
      return;
    }

    const listView = document.getElementById('list-view');
    const analyticsView = document.getElementById('analytics-view');
    const adminView = document.getElementById('admin-view');
    const auditView = document.getElementById('audit-view');
    const settingsView = document.getElementById('settings-view');
    const auditTbody = document.getElementById('audit-logs-tbody');
    const btnRefreshAudit = document.getElementById('btn-refresh-audit');
    const phsModalEl = document.getElementById('phs-modal');
    const phsModalBackdrop = document.getElementById('phs-modal-backdrop');
    const phsModalDialog = phsModalEl && phsModalEl.querySelector('.phs-modal-dialog');
    const personnelTbody = document.getElementById('personnel-tbody');
    const emptyState = document.getElementById('empty-state');
    const searchInput = document.getElementById('search');
    const phsForm = document.getElementById('phs-form');
    const recordIdInput = document.getElementById('record-id');
    const summaryModal = document.getElementById('summary-modal');
    const summaryContent = document.getElementById('summary-content');
    const summaryClose = document.getElementById('summary-close');
    const summaryBackdrop = document.getElementById('summary-backdrop');
    const summaryPrint = document.getElementById('summary-print');
    const summaryExportPdf = document.getElementById('summary-export-pdf');
    const topbarSection = document.getElementById('topbar-section');
    const btnLogout = document.getElementById('btn-logout');
    const btnAutoFillPhs = document.getElementById('btn-autofill-phs');

    const roles = Array.isArray(session.roles) ? session.roles : [];
    const isAdmin = roles.includes('admin');
    const canEdit = roles.includes('admin') || roles.includes('encoder');
    const canDelete = roles.includes('admin');
    const canViewAnalytics = roles.includes('admin') || roles.includes('viewer');

    const navAdmin = document.getElementById('nav-admin');
    const navAudit = document.getElementById('nav-audit');
    const navSettings = document.getElementById('nav-settings');
    if (navAdmin) navAdmin.hidden = !isAdmin;
    if (navAudit) navAudit.hidden = !isAdmin;
    if (navSettings) navSettings.hidden = !isAdmin;
    if (btnAutoFillPhs) btnAutoFillPhs.disabled = !canEdit;

    var btnNew = document.getElementById('btn-new');
    if (btnNew) btnNew.disabled = !canEdit;

    // Audit Log variables
    const auditLogsContainer = document.getElementById('audit-logs-container');
    const auditSearch = document.getElementById('audit-search');
    const auditFilterAction = document.getElementById('audit-filter-action');
    let allAuditLogs = [];

    if (isAdmin && adminView && window.adminApi) {
      initAdminUsersView({ adminViewEl: adminView, adminApi: window.adminApi });
    }

    const settingsCtl = initSettingsView({
      settingsViewEl: settingsView,
      updateApi: window.updateApi,
      appApi: window.appApi,
      authApi: window.authApi,
      toast: window.toast
    });

    // Populate sidebar version text (best-effort)
    (async function setSidebarVersion() {
      try {
        const el = document.getElementById('sidebar-version');
        if (!el) return;
        if (window.appApi && typeof window.appApi.getVersion === 'function') {
          const ver = await window.appApi.getVersion();
          if (ver) el.textContent = 'Current version: ' + ver;
        }
      } catch (e) { /* ignore */ }
    })();

    
    let showAuditLogs;
    if (initAuditLogs) {
      const auditLogCtl = initAuditLogs({
        isAdmin,
        phsModalCtl: {
          isOpen: () => phsModalCtl && phsModalCtl.isOpen(),
          close: (b) => phsModalCtl && phsModalCtl.close(b)
        },
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
        adminApi: window.adminApi,
        toast: window.toast
      });
      showAuditLogs = auditLogCtl.showAuditLogs;
    }
/** @type {object|null} */
    var lastSummaryRecord = null;

    const { showPage, goNext, goPrev } = createFormNav(phsForm);

    function applyListChrome(forceRefresh) {
      listView.classList.add('active');
      if (analyticsView) analyticsView.classList.remove('active');
      if (adminView) adminView.classList.remove('active');
      if (auditView) auditView.classList.remove('active');
      if (settingsView) settingsView.classList.remove('active');
      setActiveNav('list');
      setAppView('list');
      setTopbarSection(topbarSection, 'Personnels');
      loadList(!!forceRefresh);
    }

    async function openSummary(record) {
      if (!summaryModal || !summaryContent) return;
      lastSummaryRecord = record || null;
      summaryContent.innerHTML = buildSummaryHtml(record);
      summaryModal.classList.add('open');
      summaryModal.setAttribute('aria-hidden', 'false');
    }

    function renderHistoryTimeline(logs) {
      const timeline = document.getElementById('profile-history-timeline');
      if (!timeline) return;
      if (!logs || logs.length === 0) {
        timeline.innerHTML = '<p style="font-size:0.85rem; color:#64748b; padding:10px;">No change history found for this record.</p>';
        return;
      }

      timeline.innerHTML = logs.map(log => {
        const actionClass = log.action.toLowerCase();
        const dateStr = new Date(log.changed_at).toLocaleString();
        const adminName = log.admin_name || 'System / PHS Import';
        
        let diffHtml = '';
        if (log.action === 'UPDATE' && log.old_data && log.new_data) {
           const changes = [];
           for (const key in log.new_data) {
             if (JSON.stringify(log.old_data[key]) !== JSON.stringify(log.new_data[key])) {
               if (['updated_at', 'version'].includes(key)) continue;
               changes.push(`<strong>${key}:</strong> <span class="diff-old">${log.old_data[key] || 'empty'}</span> → <span class="diff-new">${log.new_data[key] || 'empty'}</span>`);
             }
           }
           if (changes.length > 0) {
             diffHtml = `<div class="history-diff">${changes.join('<br>')}</div>`;
           }
        }

        return `
          <div class="history-item">
            <div class="history-marker"></div>
            <div class="history-content">
              <div class="history-header">
                <span class="history-action ${actionClass}">${log.action}</span>
                <span class="history-time">${dateStr}</span>
              </div>
              <p class="history-desc">Action by <strong>${adminName}</strong></p>
              ${diffHtml}
            </div>
          </div>
        `;
      }).join('');
    }

    function closeSummary() {
      if (!summaryModal) return;
      lastSummaryRecord = null;
      summaryModal.classList.remove('open');
      summaryModal.setAttribute('aria-hidden', 'true');
    }

    function exportSummaryError(err) {
      console.error(err);
      window.toast.error('Export failed: ' + (err && err.message ? err.message : String(err)));
    }

    if (summaryExportPdf) {
      summaryExportPdf.addEventListener('click', async function () {
        var rec = lastSummaryRecord;
        if (!rec) return;
        if (!window.exportApi) {
          window.toast.error('Export is not available. Restart the application.');
          return;
        }
        try {
          var html = await buildStandalonePhsHtml(rec);
          var base = suggestedExportBasename(rec);
          await window.exportApi.savePhsPdf({ html: html, defaultName: base + '.pdf' });
        } catch (err) {
          exportSummaryError(err);
        }
      });
    }

    /** @type {object} */
    const listDeps = {
      personnelTbody: personnelTbody,
      emptyState: emptyState,
      searchInput: searchInput,
      setFormData: formData.setFormData,
      showForm: null,
      openSummary: openSummary,
      loadList: null,
      permissions: { canEdit: canEdit, canDelete: canDelete }
    };

    // Roster cache: persist records after first successful fetch.
    // Only re-fetch when explicitly requested (forceRefresh) or when stale.
    const ROSTER_STALE_MS = 5 * 60 * 1000; // 5 minutes
    // Minimum visible time for the roster skeleton. Start with a sensible default
    // and adapt based on measured network speed (bandwidth/connection hints).
    let ROSTER_SKELETON_MIN_MS = 1500;

    // Estimate a reasonable skeleton minimum based on connection hints or a
    // lightweight bandwidth measurement. This runs once and updates the
    // `ROSTER_SKELETON_MIN_MS` value when available.
    (function initAdaptiveSkeletonMs() {
      async function measureBandwidthMbps(urls) {
        const candidates = urls || ['images/thinktech.png', 'images/ansys.png', 'images/hendexis.png'];
        for (const u of candidates) {
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 1500);
            const start = performance.now();
            const resp = await fetch(u, { cache: 'no-store', signal: controller.signal });
            clearTimeout(timeout);
            if (!resp.ok) continue;
            const blob = await resp.blob();
            const elapsed = (performance.now() - start) / 1000; // seconds
            if (elapsed <= 0) continue;
            const bytes = blob.size || 1024; // fallback
            const mbps = (bytes * 8) / (elapsed * 1_000_000);
            if (mbps > 0) return mbps;
          } catch (_) {
            // try next candidate
          }
        }
        return null;
      }

      async function estimateSkeletonMinMs() {
        // 1) Network Information API heuristic
        try {
          const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
          if (conn && conn.effectiveType) {
            switch (conn.effectiveType) {
              case 'slow-2g': return 3000;
              case '2g': return 3000;
              case '3g': return 1800;
              case '4g': return 800;
              default: break;
            }
          }
        } catch (_) {}

        // 2) Measure bandwidth by downloading a small local image (fast, low-cost)
        try {
          const mbps = await measureBandwidthMbps();
          if (mbps && isFinite(mbps) && mbps > 0) {
            // Derive a min ms from bandwidth. Tunable constant: 2000.
            const ms = Math.round(2000 / mbps);
            return Math.min(3000, Math.max(150, ms));
          }
        } catch (_) {}

        // Fallback
        return 1500;
      }

      // Run in background; don't block startup.
      estimateSkeletonMinMs().then(function (ms) {
        if (ms && typeof ms === 'number') ROSTER_SKELETON_MIN_MS = ms;
      }).catch(function () {});
    })();
    let rosterCache = { records: null, ts: 0 };

    // Ensure the skeleton CSS/animation is present at runtime. Some environments
    // (file:// loads, CSP, or stylesheet ordering) may prevent the .skeleton-cell
    // rule from applying — inject a safe fallback style once if needed.
    function ensureSkeletonStyles() {
      try {
        if (document.getElementById('phs-skeleton-fallback')) return;
        // Create a temporary element to test computed styles
        const tmp = document.createElement('div');
        tmp.className = 'skeleton-cell';
        tmp.style.position = 'absolute';
        tmp.style.left = '-9999px';
        tmp.style.top = '-9999px';
        document.body.appendChild(tmp);
        const cs = window.getComputedStyle(tmp);
        const hasAnim = (cs && cs.getPropertyValue('animation-name') && cs.getPropertyValue('animation-name') !== 'none') || (cs && cs.getPropertyValue('animation') && cs.getPropertyValue('animation') !== 'none');
        const hasBgSize = cs && cs.getPropertyValue('background-size') && cs.getPropertyValue('background-size') !== 'auto';
        document.body.removeChild(tmp);
        if (hasAnim && hasBgSize) return; // existing stylesheet covers it

        const css = `
/* phs fallback skeleton shimmer */
@keyframes shimmer { 0% { background-position: -800px 0; } 100% { background-position: 800px 0; } }
.skeleton-cell { background: linear-gradient(90deg,#e8e8e8 25%,#f5f5f5 50%,#e8e8e8 75%); background-size:800px 100%; animation: shimmer 1.5s infinite linear; border-radius:4px; display:block }
`;
        const s = document.createElement('style');
        s.id = 'phs-skeleton-fallback';
        s.textContent = css;
        document.head.appendChild(s);
      } catch (e) {
        // swallow errors — fallback isn't critical
        console.warn('ensureSkeletonStyles failed:', e && e.message);
      }
    }

    function loadAllDataAndRender(options) {
      const opts = options || {};
      const force = !!opts.forceRefresh;
      
      // Use cache when available and not stale
      if (!force && rosterCache.records && (Date.now() - rosterCache.ts) < ROSTER_STALE_MS) {
        // Briefly show skeleton to avoid a blank gap while the DOM repaints,
        // then render the cached data almost immediately.
        try {
          ensureSkeletonStyles();
          renderRosterSkeleton(listDeps, Math.min(6, (rosterCache.records && rosterCache.records.length) || 6));
        } catch (_) {}

        return new Promise(function (resolve) {
          // Small delay to allow the browser to paint the skeleton.
          window.setTimeout(function () {
            renderList(rosterCache.records, listDeps);
            renderAnalytics(rosterCache.records, { openSummary: openSummary });
            try { hideLoader(); } catch (_) {}
            resolve(rosterCache.records);
          }, 60);
        });
      }

      const startedAt = Date.now();
      try { ensureSkeletonStyles(); } catch (_) {}
      renderRosterSkeleton(listDeps, 6);

      // Show dashboard-specific overlay loader while fetching (do not hide content)
      try {
        var _dbLoader = document.getElementById('dashboard-loader');
        if (_dbLoader) {
          _dbLoader.removeAttribute('hidden');
          _dbLoader.style.display = 'flex';
          document.body.classList.add('dashboard-loading');
          document.documentElement.classList.add('dashboard-loading');
        }
      } catch (_) {}

      return window.personnelApi.getAll().then(function (records) {
        const elapsed = Date.now() - startedAt;
        const waitMs = Math.max(0, ROSTER_SKELETON_MIN_MS - elapsed);
        
        return new Promise(function (resolve) {
          if (!waitMs) return resolve(records);
          window.setTimeout(function () { resolve(records); }, waitMs);
        });
      }).then(function (records) {
        rosterCache.records = records;
        rosterCache.ts = Date.now();
        renderList(records, listDeps);
        renderAnalytics(records, { openSummary: openSummary });
        // Small delay to ensure DOM updates are painted before hiding loader
        return new Promise(function (resolve) {
          window.setTimeout(function () {
            // Hide dashboard-specific overlay loader
            try {
              var __dbLoader = document.getElementById('dashboard-loader');
              if (__dbLoader) {
                __dbLoader.setAttribute('hidden', '');
                __dbLoader.style.display = 'none';
                document.body.classList.remove('dashboard-loading');
                document.documentElement.classList.remove('dashboard-loading');
              }
            } catch (_) {}
            hideLoader();
            resolve(records);
          }, 60);
        });
      }).catch(function (err) {
        hideLoader();
        throw err;
      });
    }

    function loadList(forceRefresh) {
      // Clear any stale loader before rendering cached results
      try { hideLoader(); } catch (_) {}
      return loadAllDataAndRender({ forceRefresh: !!forceRefresh }).catch(function (err) {
        console.error(err);
        window.toast.error('Could not load data: ' + (err && err.message ? err.message : 'Unknown error'));
        renderList([], listDeps);
        renderAnalytics([], { openSummary: openSummary });
      });
    }

    var phsModalCtl = null;

    /**
     * @param {{ forceCloseModal?: boolean }} [opts]
     */
    function showList(opts) {
      var forceClose = opts && opts.forceCloseModal;
      var forceRefresh = opts && opts.forceRefresh;
      if (phsModalCtl && phsModalCtl.isOpen()) {
        if (!phsModalCtl.close(forceClose === true)) return;
      }
      applyListChrome(forceRefresh === true);
    }

    phsModalCtl = createPhsModalController({
      modalEl: phsModalEl,
      dialogEl: phsModalDialog,
      formEl: phsForm,
      onEscape: function () {
        showList();
      }
    });

    function runDialogEntryAnimation() {
      if (!phsModalDialog) return;
      phsModalDialog.classList.remove('phs-modal-dialog--entry');
      // Force reflow so the same animation class can replay on repeated clicks.
      void phsModalDialog.offsetWidth;
      phsModalDialog.classList.add('phs-modal-dialog--entry');
      phsModalDialog.addEventListener('animationend', function onAnimEnd() {
        phsModalDialog.classList.remove('phs-modal-dialog--entry');
        phsModalDialog.removeEventListener('animationend', onAnimEnd);
      });
    }

    /**
     * @param {{ animateEntry?: boolean }} [opts]
     */
    function showForm(opts) {
      if (!canEdit) {
        window.toast.warning('You do not have permission to create or edit personnel records.');
        return;
      }
      if (analyticsView) analyticsView.classList.remove('active');
      listView.classList.add('active');
      if (adminView) adminView.classList.remove('active');
      setActiveNav('none');
      setAppView('form');
      const rid = recordIdInput && recordIdInput.value && String(recordIdInput.value).trim();
      setTopbarSection(topbarSection, rid ? 'Edit personnel' : 'New personnel');
      phsModalCtl.open();
      if (opts && opts.animateEntry) runDialogEntryAnimation();
      showPage(1);
      window.requestAnimationFrame(function () {
        phsModalCtl.resetDirty();
      });
    }

    listDeps.showForm = showForm;
    listDeps.loadList = loadList;

    function showAnalytics() {
      if (!canViewAnalytics) {
        window.toast.warning('You do not have permission to view analytics.');
        return;
      }
      if (phsModalCtl.isOpen()) {
        if (!phsModalCtl.close(false)) return;
      }
      listView.classList.remove('active');
      if (analyticsView) analyticsView.classList.add('active');
      if (adminView) adminView.classList.remove('active');
      if (auditView) auditView.classList.remove('active');
      if (settingsView) settingsView.classList.remove('active');
      setActiveNav('analytics');
      setAppView('analytics');
      setTopbarSection(topbarSection, 'Dashboard');
      loadAllDataAndRender().catch(function () {
        renderAnalytics([], { openSummary: openSummary });
      });
    }

    function showAdminUsers() {
      if (!isAdmin) {
        window.toast.error('Admin access required.');
        return;
      }
      if (phsModalCtl && phsModalCtl.isOpen()) {
        phsModalCtl.close(false);
      }
      listView.classList.remove('active');
      if (analyticsView) analyticsView.classList.remove('active');
      if (adminView) adminView.classList.add('active');
      if (auditView) auditView.classList.remove('active');
      if (settingsView) settingsView.classList.remove('active');
      setActiveNav('admin');
      setAppView('admin');
      setTopbarSection(topbarSection, 'User management');
    }

    function showSettings() {
      if (!isAdmin) {
        window.toast.error('Admin access required.');
        return;
      }
      if (phsModalCtl && phsModalCtl.isOpen()) {
        phsModalCtl.close(false);
      }
      listView.classList.remove('active');
      if (analyticsView) analyticsView.classList.remove('active');
      if (adminView) adminView.classList.remove('active');
      if (auditView) auditView.classList.remove('active');
      if (settingsView) settingsView.classList.add('active');
      setActiveNav('settings');
      setAppView('settings');
      setTopbarSection(topbarSection, 'Settings');
      if (settingsCtl && typeof settingsCtl.refreshVersion === 'function') {
        settingsCtl.refreshVersion();
      }
    }

    document.querySelectorAll('.nav-item').forEach(function (tab) {
      tab.addEventListener('click', function () {
        const which = tab.getAttribute('data-tab');
        if (which === 'list') showList();
        if (which === 'analytics') showAnalytics();
        if (which === 'admin') showAdminUsers();
        if (which === 'settings') showSettings();
        if (settingsView && which === 'audit') settingsView.classList.remove('active');
        if (which === 'audit') showAuditLogs();
      });
    });

    document.getElementById('btn-new').addEventListener('click', function () {
      if (!canEdit) return;
      formData.clearForm();
      showForm({ animateEntry: true });
    });

    document.getElementById('btn-cancel').addEventListener('click', function () {
      showList();
    });

    if (btnLogout) {
      btnLogout.addEventListener('click', function () {
        var confirmed = confirm('Are you sure you want to log out?');
        if (!confirmed) return;
        if (window.authApi && typeof window.authApi.logout === 'function') {
          window.authApi.logout().finally(function () {
            window.location.href = 'login.html';
          });
          return;
        }
        window.location.href = 'login.html';
      });
    }

    if (phsModalBackdrop) {
      phsModalBackdrop.addEventListener('click', function () {
        showList();
      });
    }

    if (summaryClose) summaryClose.addEventListener('click', closeSummary);
    if (summaryBackdrop) summaryBackdrop.addEventListener('click', closeSummary);
    if (summaryPrint) {
      summaryPrint.addEventListener('click', function () {
        window.print();
      });
    }

    var btnPrev = document.getElementById('btn-prev');
    if (btnPrev) btnPrev.addEventListener('click', goPrev);
    var btnNext = document.getElementById('btn-next');
    if (btnNext) btnNext.addEventListener('click', goNext);

    if (btnAutoFillPhs) {
      btnAutoFillPhs.addEventListener('click', function () {
        var generated = buildAutoFillRecord();
        var currentId = recordIdInput && String(recordIdInput.value || '').trim();
        if (currentId) generated.id = currentId;
        formData.setFormData(generated);
      });
    }

    var stepIndicator = document.getElementById('step-indicator');
    if (stepIndicator) {
      stepIndicator.addEventListener('click', function (e) {
        var dot = e.target.closest('.step-dot');
        if (dot) {
          var p = parseInt(dot.getAttribute('data-page'), 10);
          if (!isNaN(p)) showPage(p);
        }
      });
    }

    var phsSectionNav = document.querySelector('.phs-section-nav');
    if (phsSectionNav) {
      phsSectionNav.addEventListener('click', function (e) {
        var btn = e.target.closest('.phs-section-nav-item');
        if (!btn) return;
        var p = parseInt(btn.getAttribute('data-page'), 10);
        if (!isNaN(p)) showPage(p);
      });
    }

    var addChildRow = document.getElementById('add-child-row');
    if (addChildRow) {
      addChildRow.addEventListener('click', function () {
        var rowsHost = document.getElementById('children-rows');
        if (rowsHost) rowsHost.appendChild(formData.createChildRow({}));
      });
    }

    ROW_SECTIONS.forEach(function (section) {
      var addBtn = document.getElementById(section.addBtnId);
      if (addBtn) {
        addBtn.addEventListener('click', function () {
          var host = document.getElementById(section.hostId);
          if (host) host.appendChild(formData.createStructuredRow(section, {}));
        });
      }
    });

    var photoUpload = document.getElementById('photo-upload');
    var photoDataUrlInput = document.getElementById('photoDataUrl');
    if (photoUpload && photoDataUrlInput) {
      photoUpload.addEventListener('change', function () {
        var file = photoUpload.files && photoUpload.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () {
          var raw = String(reader.result || '');
          squareThumbnailDataUrl(raw, 256, 0.88)
            .then(function (thumb) {
              photoDataUrlInput.value = thumb;
              formData.setPhotoPreview(thumb);
            })
            .catch(function () {
              photoDataUrlInput.value = raw;
              formData.setPhotoPreview(raw);
            });
        };
        reader.readAsDataURL(file);
      });
    }

    var handwritingUpload = document.getElementById('handwriting-upload');
    var handwrittenEntryInput = document.getElementById('handwrittenEntryDataUrl');
    if (handwritingUpload && handwrittenEntryInput) {
      handwritingUpload.addEventListener('change', function () {
        var file = handwritingUpload.files && handwritingUpload.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () {
          var raw = String(reader.result || '');
          handwrittenEntryInput.value = raw;
          formData.setHandwritingPreview(raw);
        };
        reader.readAsDataURL(file);
      });
    }

    function bindThumbUpload(uploadId, inputId, previewSetter) {
      var uploadEl = document.getElementById(uploadId);
      var dataInputEl = document.getElementById(inputId);
      if (!uploadEl || !dataInputEl) return;
      uploadEl.addEventListener('change', function () {
        var file = uploadEl.files && uploadEl.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () {
          var raw = String(reader.result || '');
          dataInputEl.value = raw;
          previewSetter(raw);
        };
        reader.readAsDataURL(file);
      });
    }

    bindThumbUpload('left-thumb-upload', 'leftThumbMarkDataUrl', formData.setLeftThumbPreview);
    bindThumbUpload('right-thumb-upload', 'rightThumbMarkDataUrl', formData.setRightThumbPreview);

    var signatureUpload = document.getElementById('signature-upload');
    var signatureDataUrlInput = document.getElementById('signatureDataUrl');
    var signaturePreview = document.getElementById('signature-preview');
    var signaturePlaceholder = document.getElementById('signature-placeholder-text');
    if (signatureUpload && signatureDataUrlInput) {
      signatureUpload.addEventListener('change', function () {
        var file = signatureUpload.files && signatureUpload.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () {
          var raw = String(reader.result || '');
          signatureDataUrlInput.value = raw;
          formData.setSignaturePreview(raw);
        };
        reader.readAsDataURL(file);
      });
    }

    document.addEventListener('click', function (e) {
      var btn = e.target.closest('.remove-child-row');
      if (btn) {
        var rowsHost = document.getElementById('children-rows');
        if (!rowsHost) return;
        var row = btn.closest('.child-row');
        if (row) row.remove();
        if (!rowsHost.querySelector('.child-row')) {
          rowsHost.appendChild(formData.createChildRow({}));
        }
        return;
      }

      var removeDataBtn = e.target.closest('.remove-data-row');
      if (removeDataBtn) {
        var dataRow = removeDataBtn.closest('.data-row');
        if (!dataRow) return;
        var sectionKey = dataRow.getAttribute('data-section');
        var section = ROW_SECTIONS.find(function (s) { return s.key === sectionKey; });
        if (!section) return;
        var host = document.getElementById(section.hostId);
        dataRow.remove();
        if (host && !host.querySelector('.data-row')) {
          host.appendChild(formData.createStructuredRow(section, {}));
        }
      }
    });

    if (searchInput) {
      searchInput.addEventListener('input', function () {
        const q = (searchInput && searchInput.value || '').trim().toLowerCase();
        if (rosterCache.records) {
          // Use cached records for instant search
          const records = rosterCache.records;
          renderList(records, listDeps);
          return;
        }
        // Fallback to fetching if cache is not yet populated
        window.personnelApi.getAll().then(function (records) {
          // update cache
          rosterCache.records = records;
          rosterCache.ts = Date.now();
          renderList(records, listDeps);
        });
      });
    }

    // Listen for organization filter changes
    window.addEventListener('phs-org-filter-changed', function () {
      console.log('[MAIN] Org filter changed event received');
      if (rosterCache.records) {
        renderList(rosterCache.records, listDeps);
      } else {
        loadList(false);
      }
    });

    phsForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const data = formData.getFormData();
      var isUpdate = !!(data && data.id);
      var confirmed = confirm(
        isUpdate
          ? 'Save changes to this personnel record?'
          : 'Save this new personnel record?'
      );
      if (!confirmed) return;
      window.personnelApi.save(data).then(function () {
        // After saving, force refresh the roster so cache is updated
        showList({ forceCloseModal: true, forceRefresh: true });
      }).catch(function (err) {
        console.error(err);
        window.toast.error('Could not save: ' + (err && err.message ? err.message : 'Unknown error'));
      });
    });

    formData.setChildrenRows([]);
    ROW_SECTIONS.forEach(function (section) {
      formData.setStructuredRows(section, []);
    });
    if (canViewAnalytics) {
      showAnalytics();
    } else {
      showList();
    }
    // Ensure loader hidden after initial load (defensive)
    try { hideLoader(); } catch (_) {}
  } catch (e) {
    showError(e.message || String(e));
    console.error(e);
  }
})();
