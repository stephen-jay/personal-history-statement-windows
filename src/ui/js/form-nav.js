import { TOTAL_PAGES } from './constants.js';

let currentPage = 1;

/** Short labels for breadcrumb (must match nav order) */
const BREADCRUMB_SECTIONS = [
  'Personal details',
  'Characteristics & marital',
  'Family history',
  'Education & employment',
  'Credit, arrest & photo'
];

export function getCurrentPage() {
  return currentPage;
}

export function createFormNav(phsForm) {
  function showPage(n) {
    currentPage = Math.max(1, Math.min(n, TOTAL_PAGES));
    document.querySelectorAll('.form-page').forEach(function (el) {
      el.classList.toggle('active', parseInt(el.getAttribute('data-page'), 10) === currentPage);
    });
    document.querySelectorAll('.phs-section-nav-item').forEach(function (el) {
      const p = parseInt(el.getAttribute('data-page'), 10);
      const isCurrent = p === currentPage;
      el.classList.toggle('active', isCurrent);
      if (isCurrent) el.setAttribute('aria-current', 'step');
      else el.removeAttribute('aria-current');
    });
    var crumb = document.getElementById('phs-breadcrumb-section');
    if (crumb && BREADCRUMB_SECTIONS[currentPage - 1]) {
      crumb.textContent = BREADCRUMB_SECTIONS[currentPage - 1];
    }
    var pageIndicator = document.getElementById('page-indicator');
    if (pageIndicator) pageIndicator.textContent = 'Page ' + currentPage + ' of ' + TOTAL_PAGES;
    var btnPrev = document.getElementById('btn-prev');
    if (btnPrev) btnPrev.disabled = currentPage === 1;
    var btnNext = document.getElementById('btn-next');
    if (btnNext) {
      btnNext.textContent = currentPage === TOTAL_PAGES ? 'Save Personnel' : 'Next';
    }
  }

  function goNext() {
    if (currentPage === TOTAL_PAGES) {
      phsForm.dispatchEvent(new Event('submit', { cancelable: true }));
    } else {
      showPage(currentPage + 1);
    }
  }

  function goPrev() {
    if (currentPage > 1) showPage(currentPage - 1);
  }

  return { showPage, goNext, goPrev };
}
