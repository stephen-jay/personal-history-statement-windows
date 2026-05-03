/**
 * Large PHS form modal: focus trap, Escape, unsaved-changes confirm.
 * Backdrop click is wired in main.js to reuse showList() dismiss logic.
 */

var FOCUSABLE_SEL =
  'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * @param {object} opts
 * @param {HTMLElement} opts.modalEl
 * @param {HTMLElement} opts.dialogEl
 * @param {HTMLFormElement} opts.formEl
 * @param {() => void} [opts.onEscape] Called when Escape is pressed (e.g. showList)
 */
import { showConfirm } from './confirm.js';

export function createPhsModalController(opts) {
  var modalEl = opts.modalEl;
  var dialogEl = opts.dialogEl;
  var formEl = opts.formEl;
  var onEscape = opts.onEscape;

  if (!modalEl || !dialogEl || !formEl) {
    throw new Error('createPhsModalController: modalEl, dialogEl, and formEl are required');
  }

  var formDirty = false;
  /** @type {Element | null} */
  var lastFocus = null;

  function getFocusable() {
    return Array.prototype.slice.call(dialogEl.querySelectorAll(FOCUSABLE_SEL)).filter(function (el) {
      return el.offsetParent !== null || el === document.activeElement;
    });
  }

  function focusFirst() {
    var list = getFocusable();
    if (list.length) list[0].focus();
  }

  function markDirty() {
    formDirty = true;
  }

  function resetDirty() {
    formDirty = false;
  }

  function isOpen() {
    return modalEl && modalEl.classList.contains('open');
  }

  function onDocumentKeydown(e) {
    if (!isOpen()) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      if (typeof onEscape === 'function') onEscape();
      return;
    }
    if (e.key !== 'Tab') return;
    var list = getFocusable();
    if (!list.length) return;
    var first = list[0];
    var last = list[list.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  function open() {
    lastFocus = document.activeElement;
    modalEl.classList.add('open');
    modalEl.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onDocumentKeydown);
    window.requestAnimationFrame(function () {
      focusFirst();
    });
  }

  /**
   * @param {boolean} [force] Skip dirty confirm (after successful save)
   * @returns {boolean} True if modal is now closed
   */
  async function close(force) {
    if (!modalEl.classList.contains('open')) return true;
    if (!force && formDirty) {
      const ok = await showConfirm('You have unsaved changes. Discard and close?', { confirmText: 'Discard', cancelText: 'Cancel' });
      if (!ok) return false;
    }
    modalEl.classList.remove('open');
    modalEl.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onDocumentKeydown);
    resetDirty();
    if (lastFocus && typeof lastFocus.focus === 'function') {
      try {
        lastFocus.focus();
      } catch (_) {}
    }
    lastFocus = null;
    return true;
  }

  formEl.addEventListener(
    'input',
    function () {
      markDirty();
    },
    true
  );
  formEl.addEventListener(
    'change',
    function () {
      markDirty();
    },
    true
  );

  return {
    open: open,
    close: close,
    resetDirty: resetDirty,
    isOpen: isOpen
  };
}
