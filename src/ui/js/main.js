import { ROW_SECTIONS } from './constants.js';
import * as formData from './form-data.js';
import { renderAnalytics } from './analytics.js';
import { buildSummaryHtml } from './summary.js';
import { renderList } from './list.js';
import { setActiveNav, setAppView, setTopbarSection } from './views.js';
import { createFormNav } from './form-nav.js';
import { createPhsModalController } from './phs-modal.js';
import { squareThumbnailDataUrl } from './photo-thumbnail.js';

function showError(msg) {
  document.body.innerHTML = '<div style="padding:24px;font-family:sans-serif;max-width:500px"><h2>Error</h2><p>' + String(msg).replace(/</g, '&lt;') + '</p><p>Check the console (Ctrl+Shift+I) for details.</p></div>';
}

async function loadFormPages() {
  const pagesContainer = document.getElementById('form-pages');
  if (!pagesContainer) throw new Error('Form pages container not found.');
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
}

async function loadAnalyticsPage() {
  const analyticsContainer = document.getElementById('analytics-content');
  if (!analyticsContainer) throw new Error('Analytics container not found.');
  const response = await fetch('pages/analytics-view.html');
  if (!response.ok) throw new Error('Failed to load analytics-view.html');
  analyticsContainer.innerHTML = await response.text();
}

(async function bootstrap() {
  try {
    await loadFormPages();
    await loadAnalyticsPage();

    if (!window.personnelApi) {
      showError('personnelApi not loaded. Preload may have failed.');
      return;
    }

    const listView = document.getElementById('list-view');
    const analyticsView = document.getElementById('analytics-view');
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
    const topbarSection = document.getElementById('topbar-section');

    const { showPage, goNext, goPrev } = createFormNav(phsForm);

    function applyListChrome() {
      listView.classList.add('active');
      if (analyticsView) analyticsView.classList.remove('active');
      setActiveNav('list');
      setAppView('list');
      setTopbarSection(topbarSection, 'Personnel roster');
      loadList();
    }

    function openSummary(record) {
      if (!summaryModal || !summaryContent) return;
      summaryContent.innerHTML = buildSummaryHtml(record);
      summaryModal.classList.add('open');
      summaryModal.setAttribute('aria-hidden', 'false');
    }

    function closeSummary() {
      if (!summaryModal) return;
      summaryModal.classList.remove('open');
      summaryModal.setAttribute('aria-hidden', 'true');
    }

    /** @type {object} */
    const listDeps = {
      personnelTbody: personnelTbody,
      emptyState: emptyState,
      searchInput: searchInput,
      setFormData: formData.setFormData,
      showForm: null,
      openSummary: openSummary,
      loadList: null
    };

    function loadAllDataAndRender() {
      return window.personnelApi.getAll().then(function (records) {
        renderList(records, listDeps);
        renderAnalytics(records);
        return records;
      });
    }

    function loadList() {
      loadAllDataAndRender().catch(function (err) {
        console.error(err);
        alert('Could not load data.\n\n' + (err && err.message ? err.message : 'Unknown error'));
        renderList([], listDeps);
        renderAnalytics([]);
      });
    }

    var phsModalCtl = null;

    /**
     * @param {{ forceCloseModal?: boolean }} [opts]
     */
    function showList(opts) {
      var force = opts && opts.forceCloseModal;
      if (phsModalCtl && phsModalCtl.isOpen()) {
        if (!phsModalCtl.close(force === true)) return;
      }
      applyListChrome();
    }

    phsModalCtl = createPhsModalController({
      modalEl: phsModalEl,
      dialogEl: phsModalDialog,
      formEl: phsForm,
      onEscape: function () {
        showList();
      }
    });

    function showForm() {
      if (analyticsView) analyticsView.classList.remove('active');
      listView.classList.add('active');
      setActiveNav('none');
      setAppView('form');
      const rid = recordIdInput && recordIdInput.value && String(recordIdInput.value).trim();
      setTopbarSection(topbarSection, rid ? 'Edit personnel' : 'New personnel');
      phsModalCtl.open();
      showPage(1);
      window.requestAnimationFrame(function () {
        phsModalCtl.resetDirty();
      });
    }

    listDeps.showForm = showForm;
    listDeps.loadList = loadList;

    function showAnalytics() {
      if (phsModalCtl.isOpen()) {
        if (!phsModalCtl.close(false)) return;
      }
      listView.classList.remove('active');
      if (analyticsView) analyticsView.classList.add('active');
      setActiveNav('analytics');
      setAppView('analytics');
      setTopbarSection(topbarSection, 'Reports');
      loadAllDataAndRender().catch(function () {
        renderAnalytics([]);
      });
    }

    document.querySelectorAll('.nav-item').forEach(function (tab) {
      tab.addEventListener('click', function () {
        const which = tab.getAttribute('data-tab');
        if (which === 'list') showList();
        if (which === 'analytics') showAnalytics();
      });
    });

    document.getElementById('btn-new').addEventListener('click', function () {
      formData.clearForm();
      showForm();
    });

    document.getElementById('btn-cancel').addEventListener('click', function () {
      showList();
    });

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
        window.personnelApi.getAll().then(function (records) {
          renderList(records, listDeps);
        });
      });
    }

    phsForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const data = formData.getFormData();
      window.personnelApi.save(data).then(function () {
        showList({ forceCloseModal: true });
      }).catch(function (err) {
        console.error(err);
        alert('Could not save.\n\n' + (err && err.message ? err.message : 'Unknown error'));
      });
    });

    formData.setChildrenRows([]);
    ROW_SECTIONS.forEach(function (section) {
      formData.setStructuredRows(section, []);
    });
    setActiveNav('list');
    setAppView('list');
    setTopbarSection(topbarSection, 'Personnel roster');
    loadList();
  } catch (e) {
    showError(e.message || String(e));
    console.error(e);
  }
})();
