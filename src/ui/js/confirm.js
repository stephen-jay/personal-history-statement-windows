// Lightweight confirm/alert modal helper
export function showConfirm(message, opts) {
  opts = opts || {};
  const title = opts.title || '';
  const confirmText = opts.confirmText || 'OK';
  const cancelText = opts.cancelText || 'Cancel';

  return new Promise(function (resolve) {
    let dlg = document.getElementById('app-confirm-dialog');
    if (!dlg) {
      dlg = document.createElement('div');
      dlg.id = 'app-confirm-dialog';
      dlg.className = 'app-dialog';
      dlg.setAttribute('aria-hidden', 'true');
      dlg.innerHTML = `
        <div class="app-dialog-backdrop"></div>
        <div class="app-dialog-panel" role="dialog" aria-modal="true">
          <div class="app-dialog-title"></div>
          <div class="app-dialog-body"></div>
          <div class="app-dialog-actions">
            <button type="button" class="btn secondary app-dialog-cancel"></button>
            <button type="button" class="btn primary app-dialog-confirm"></button>
          </div>
        </div>
      `;
      document.body.appendChild(dlg);
    }

    const panel = dlg.querySelector('.app-dialog-panel');
    const titleEl = dlg.querySelector('.app-dialog-title');
    const bodyEl = dlg.querySelector('.app-dialog-body');
    const btnConfirm = dlg.querySelector('.app-dialog-confirm');
    const btnCancel = dlg.querySelector('.app-dialog-cancel');

    titleEl.textContent = title || '';
    bodyEl.textContent = message || '';
    btnConfirm.textContent = confirmText;
    btnCancel.textContent = cancelText;

    function cleanup() {
      dlg.classList.remove('open');
      dlg.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      btnConfirm.removeEventListener('click', onConfirm);
      btnCancel.removeEventListener('click', onCancel);
      backdrop.removeEventListener('click', onCancel);
      document.removeEventListener('keydown', onKey);
    }

    function onConfirm() {
      cleanup();
      resolve(true);
    }
    function onCancel() {
      cleanup();
      resolve(false);
    }

    function onKey(e) {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') {
        // Avoid accidental submits when focus is on buttons
        if (document.activeElement === btnCancel) return;
        onConfirm();
      }
    }

    const backdrop = dlg.querySelector('.app-dialog-backdrop');

    btnConfirm.addEventListener('click', onConfirm);
    btnCancel.addEventListener('click', onCancel);
    backdrop.addEventListener('click', onCancel);
    document.addEventListener('keydown', onKey);

    // show
    dlg.classList.add('open');
    dlg.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    // focus confirm button after opening
    window.requestAnimationFrame(function () {
      try { btnConfirm.focus(); } catch (_) {}
    });
  });
}

export function showAlert(message, opts) {
  opts = opts || {};
  const title = opts.title || '';
  const okText = opts.okText || 'OK';
  return new Promise(function (resolve) {
    showConfirm(message, { title: title, confirmText: okText, cancelText: '' }).then(function () {
      resolve();
    });
  });
}
