export function initToastSystem(containerSelector = '#toast-container') {
  const container = document.querySelector(containerSelector);
  if (!container) return null;

  function showToast(message, options = {}) {
    const {
      type = 'info',
      duration = 4000,
      dismissible = true
    } = options;

    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.setAttribute('role', 'status');

    const dotSpan = document.createElement('span');
    dotSpan.className = 'toast-dot';
    dotSpan.setAttribute('aria-hidden', 'true');

    const messageSpan = document.createElement('span');
    messageSpan.className = 'toast-message';
    messageSpan.textContent = String(message || '');

    toast.appendChild(dotSpan);
    toast.appendChild(messageSpan);

    if (dismissible) {
      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'toast-close';
      closeBtn.setAttribute('aria-label', 'Dismiss notification');
      closeBtn.textContent = '×';
      closeBtn.addEventListener('click', function () {
        removeToast(toast);
      });
      toast.appendChild(closeBtn);
    }

    container.appendChild(toast);

    if (duration && duration > 0) {
      setTimeout(function () {
        removeToast(toast);
      }, duration);
    }

    return toast;
  }

  function removeToast(toast) {
    if (!toast || !toast.parentNode) return;
    toast.classList.add('closing');
    toast.classList.add('toast--closing');
    setTimeout(function () {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }

  return {
    success: function (msg, opts) {
      return showToast(msg, { type: 'success', ...opts });
    },
    error: function (msg, opts) {
      return showToast(msg, { type: 'error', ...opts });
    },
    warning: function (msg, opts) {
      return showToast(msg, { type: 'warning', ...opts });
    },
    info: function (msg, opts) {
      return showToast(msg, { type: 'info', ...opts });
    },
    show: showToast,
    remove: removeToast
  };
}
