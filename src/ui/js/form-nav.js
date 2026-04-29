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
      if (validateAllPages()) {
        document.getElementById('validation-summary').hidden = true;
        phsForm.dispatchEvent(new Event('submit', { cancelable: true }));
      }
    } else {
      if (validatePage(currentPage)) {
        document.getElementById('validation-summary').hidden = true;
        showPage(currentPage + 1);
      }
    }
  }

  function validatePage(pageNum) {
    const pageEl = document.querySelector(`.form-page[data-page="${pageNum}"]`);
    if (!pageEl) return true;

    const inputs = pageEl.querySelectorAll('input, select, textarea');
    let firstInvalid = null;
    let isValid = true;

    inputs.forEach(input => {
      // For type="tel" and other patterns, we check validity
      if (!input.checkValidity()) {
        isValid = false;
        if (!firstInvalid) firstInvalid = input;
      }
    });

    if (!isValid) {
      if (window.toast) {
        window.toast.error('Please correct the highlighted fields before proceeding.');
      } else {
        alert('Please correct the highlighted fields before proceeding.');
      }
      if (firstInvalid) {
        firstInvalid.focus();
        firstInvalid.reportValidity();
      }
    }

    return isValid;
  }

  function validateAllPages() {
    const summaryContainer = document.getElementById('validation-summary');
    const summaryList = document.getElementById('validation-summary-list');
    summaryList.innerHTML = '';
    
    let allValid = true;
    let firstInvalidInput = null;
    let firstInvalidPage = null;

    for (let p = 1; p <= TOTAL_PAGES; p++) {
      const pageEl = document.querySelector(`.form-page[data-page="${p}"]`);
      if (!pageEl) continue;

      const inputs = pageEl.querySelectorAll('input, select, textarea');
      inputs.forEach(input => {
        if (!input.checkValidity()) {
          allValid = false;
          if (!firstInvalidInput) {
            firstInvalidInput = input;
            firstInvalidPage = p;
          }
          
          // Get label text for the error summary
          let labelText = input.id || 'Unknown field';
          const labelEl = input.closest('.row, .two-cols > div, .three-cols > div, .four-cols > div')?.querySelector('label');
          if (labelEl) {
             labelText = labelEl.textContent.trim();
          }

          const li = document.createElement('li');
          li.textContent = `Page ${p}: ${labelText} is required or invalid.`;
          li.addEventListener('click', () => {
             showPage(p);
             setTimeout(() => {
               input.focus();
               input.reportValidity();
             }, 100);
          });
          summaryList.appendChild(li);
        }
      });
    }

    if (!allValid) {
      summaryContainer.hidden = false;
      if (window.toast) {
         window.toast.error('Form contains errors. See summary below.');
      }
    } else {
      summaryContainer.hidden = true;
    }

    return allValid;
  }

  function goPrev() {
    if (currentPage > 1) showPage(currentPage - 1);
  }

  return { showPage, goNext, goPrev };
}
