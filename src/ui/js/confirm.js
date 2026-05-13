// ── Premium Alert-Dialog Helper ───────────────────────────────────────────────

const DIALOG_ICONS = {
  danger: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/></svg>`,
  info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
  save: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`,
};

function ensureDialogEl() {
  let dlg = document.getElementById('app-confirm-dialog');
  if (dlg) return dlg;

  dlg = document.createElement('div');
  dlg.id = 'app-confirm-dialog';
  dlg.className = 'app-dialog';
  dlg.setAttribute('aria-hidden', 'true');
  dlg.innerHTML = `
    <div class="app-dialog-backdrop"></div>
    <div class="app-dialog-panel" role="dialog" aria-modal="true" aria-labelledby="app-dlg-title" aria-describedby="app-dlg-body">
      <div class="app-dialog-icon-wrap" aria-hidden="true">
        <div class="app-dialog-icon"></div>
      </div>
      <div class="app-dialog-content">
        <div class="app-dialog-title" id="app-dlg-title"></div>
        <div class="app-dialog-body" id="app-dlg-body"></div>
      </div>
      <div class="app-dialog-actions">
        <button type="button" class="app-dialog-btn app-dialog-cancel"></button>
        <button type="button" class="app-dialog-btn app-dialog-confirm"></button>
      </div>
    </div>
  `;
  document.body.appendChild(dlg);
  return dlg;
}

/**
 * Show a premium confirm dialog.
 * @param {string} message
 * @param {{ title?: string, confirmText?: string, cancelText?: string, type?: 'danger'|'warning'|'info'|'success'|'save' }} [opts]
 * @returns {Promise<boolean>}
 */
export function showConfirm(message, opts) {
  opts = opts || {};
  const title       = opts.title       || 'Confirm';
  const confirmText = opts.confirmText || 'Confirm';
  const cancelText  = opts.cancelText !== undefined ? opts.cancelText : 'Cancel';
  const type        = opts.type        || 'info';

  return new Promise(function (resolve) {
    const dlg       = ensureDialogEl();
    const panel     = dlg.querySelector('.app-dialog-panel');
    const iconWrap  = dlg.querySelector('.app-dialog-icon-wrap');
    const iconEl    = dlg.querySelector('.app-dialog-icon');
    const titleEl   = dlg.querySelector('.app-dialog-title');
    const bodyEl    = dlg.querySelector('.app-dialog-body');
    const btnConfirm = dlg.querySelector('.app-dialog-confirm');
    const btnCancel  = dlg.querySelector('.app-dialog-cancel');
    const backdrop   = dlg.querySelector('.app-dialog-backdrop');

    // Set content
    titleEl.textContent   = title;
    bodyEl.textContent    = message;
    btnConfirm.textContent = confirmText;

    // Configure cancel button
    if (cancelText) {
      btnCancel.textContent = cancelText;
      btnCancel.style.display = '';
      panel.classList.remove('alert');
    } else {
      btnCancel.style.display = 'none';
      panel.classList.add('alert');
    }

    // Set type variant on panel & icon
    panel.setAttribute('data-dialog-type', type);
    iconEl.innerHTML = DIALOG_ICONS[type] || DIALOG_ICONS.info;

    // Confirm button variant
    btnConfirm.setAttribute('data-dialog-confirm-type', type);

    function close(result) {
      dlg.classList.add('is-closing');
      dlg.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      btnConfirm.removeEventListener('click', onConfirm);
      btnCancel.removeEventListener('click', onCancel);
      backdrop.removeEventListener('click', onCancel);
      document.removeEventListener('keydown', onKey);
      setTimeout(function () {
        dlg.classList.remove('open', 'is-closing');
      }, 220);
      resolve(!!result);
    }

    function onConfirm() { close(true); }
    function onCancel()  { close(false); }
    function onKey(e) {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter' && document.activeElement !== btnCancel) onConfirm();
    }

    btnConfirm.addEventListener('click', onConfirm);
    btnCancel.addEventListener('click', onCancel);
    backdrop.addEventListener('click', onCancel);
    document.addEventListener('keydown', onKey);

    dlg.classList.remove('is-closing');
    dlg.classList.add('open');
    dlg.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        try { (cancelText ? btnCancel : btnConfirm).focus(); } catch (_) {}
      });
    });
  });
}

/**
 * Show a simple alert dialog (no cancel button).
 * @param {string} message
 * @param {{ title?: string, okText?: string, type?: string }} [opts]
 * @returns {Promise<void>}
 */
export function showAlert(message, opts) {
  opts = opts || {};
  return showConfirm(message, {
    title: opts.title || 'Notice',
    confirmText: opts.okText || 'OK',
    cancelText: '',
    type: opts.type || 'info',
  }).then(function () {});
}

