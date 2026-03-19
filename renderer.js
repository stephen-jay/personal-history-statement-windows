(function () {
  function showError(msg) {
    document.body.innerHTML = '<div style="padding:24px;font-family:sans-serif;max-width:500px"><h2>Error</h2><p>' + String(msg).replace(/</g, '&lt;') + '</p><p>Check the console (Ctrl+Shift+I) for details.</p></div>';
  }
  try {
  const listView = document.getElementById('list-view');
  const formView = document.getElementById('form-view');
  const personnelTbody = document.getElementById('personnel-tbody');
  const emptyState = document.getElementById('empty-state');
  const searchInput = document.getElementById('search');
  const phsForm = document.getElementById('phs-form');
  const recordIdInput = document.getElementById('record-id');
  const TOTAL_PAGES = 5;
  let currentPage = 1;
  if (!window.personnelApi) {
    showError('personnelApi not loaded. Preload may have failed.');
    return;
  }

  const FIELD_IDS = [
    'nameLast', 'nameFirst', 'nameMiddle', 'rank', 'afpSn', 'brOfSvc', 'presentJob', 'businessAddress', 'homeAddress',
    'dateOfBirth', 'placeOfBirth', 'changeInName', 'nicknames', 'nationality', 'taxId', 'telNo', 'mobile', 'email',
    'passportNr', 'passportExpiry', 'sex', 'age', 'height', 'weight', 'build', 'complexion', 'colorEyes', 'colorHair',
    'scarMarks', 'healthState', 'recentIllness', 'bloodType', 'maritalStatus', 'spouseName', 'marriageDatePlace',
    'spouseDob', 'spousePlaceBirth', 'spouseOccupation', 'spouseContact', 'spouseCitizenship', 'children',
    'fatherName', 'fatherDobPlace', 'fatherAddress', 'fatherOccupation', 'fatherCitizenship',
    'motherName', 'motherDobPlace', 'motherAddress', 'motherOccupation', 'motherCitizenship',
    'siblings', 'stepParent', 'fatherInLaw', 'motherInLaw',
    'elemLocation', 'elemAttendance', 'elemGraduated', 'hsLocation', 'hsAttendance', 'hsGraduated',
    'collegeLocation', 'collegeAttendance', 'collegeGraduated', 'pgLocation', 'pgCourseAttendance', 'pgGraduated',
    'otherSchools', 'civilServiceEligibility', 'placesOfResidence', 'employmentHistory', 'dismissedResign',
    'foreignCountries', 'salaryDependent', 'banksCredit', 'salFiled', 'incomeTaxFiled', 'creditReferences',
    'arrestRecord', 'familyArrest', 'adminCase', 'pd1081', 'liquorDrugs', 'characterRefs', 'neighbors',
    'organizations', 'hobbies', 'languages', 'lieDetector', 'signedAt', 'signedDate',
    'residenceCertNr', 'residenceCertIssuedOn', 'residenceCertIssuedAt', 'administeringOfficer'
  ];

  function getFormData() {
    const data = { id: recordIdInput.value || undefined };
    const parts = [];
    FIELD_IDS.forEach(function (id) {
      const el = document.getElementById(id);
      if (!el) return;
      let val = el.value;
      if (typeof val === 'string') val = val.trim();
      if (val === '') val = null;
      data[id] = val;
      if (['nameLast', 'nameFirst', 'nameMiddle'].indexOf(id) >= 0 && val) parts.push(val);
    });
    data.fullName = parts.length ? parts.join(', ') : (data.nameFirst || data.nameLast || null);
    return data;
  }

  function setFormData(record) {
    recordIdInput.value = record.id || '';
    FIELD_IDS.forEach(function (id) {
      const el = document.getElementById(id);
      if (!el) return;
      const val = record[id];
      if (val == null || val === '') {
        el.value = '';
      } else {
        el.value = String(val);
      }
    });
  }

  function clearForm() {
    setFormData({});
  }

  function formatDate(iso) {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return isNaN(d.getTime()) ? iso : d.toLocaleDateString();
    } catch (_) {
      return iso;
    }
  }

  function renderList(records) {
    const query = (searchInput && searchInput.value || '').trim().toLowerCase();
    const filtered = query
      ? records.filter(function (r) {
          const fn = (r.fullName || '').toLowerCase();
          const pos = (r.presentJob || r.rank || '').toLowerCase();
          const mob = (r.mobile || '').toString();
          const em = (r.email || '').toLowerCase();
          return fn.includes(query) || pos.includes(query) || mob.includes(query) || em.includes(query);
        })
      : records;

    personnelTbody.innerHTML = '';
    emptyState.style.display = filtered.length ? 'none' : 'block';

    filtered.forEach(function (r) {
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' + (r.fullName || '—') + '</td>' +
        '<td>' + (r.presentJob || r.rank || '—') + '</td>' +
        '<td>' + (r.mobile || r.email || '—') + '</td>' +
        '<td>' + formatDate(r.updatedAt) + '</td>' +
        '<td>' +
          '<button type="button" class="btn small primary edit-btn" data-id="' + (r.id || '') + '">Edit</button> ' +
          '<button type="button" class="btn small danger delete-btn" data-id="' + (r.id || '') + '">Delete</button>' +
        '</td>';
      personnelTbody.appendChild(tr);
    });

    personnelTbody.querySelectorAll('.edit-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const id = btn.getAttribute('data-id');
        const record = records.find(function (r) { return String(r.id) === String(id); });
        if (record) {
          setFormData(record);
          showForm();
        }
      });
    });

    personnelTbody.querySelectorAll('.delete-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const id = btn.getAttribute('data-id');
        if (id && confirm('Delete this personnel record?')) {
          window.personnelApi.delete(id).then(function () {
            loadList();
          });
        }
      });
    });
  }

  function loadList() {
    window.personnelApi.getAll().then(renderList).catch(function (err) {
      console.error(err);
      alert('Could not load data.\n\n' + (err && err.message ? err.message : 'Unknown error'));
      renderList([]);
    });
  }

  function showList() {
    listView.classList.add('active');
    formView.classList.remove('active');
    document.querySelectorAll('.tabs .tab').forEach(function (t) {
      t.classList.toggle('active', t.getAttribute('data-tab') === 'list');
    });
    loadList();
  }

  function showForm() {
    listView.classList.remove('active');
    formView.classList.add('active');
    document.querySelectorAll('.tabs .tab').forEach(function (t) {
      t.classList.toggle('active', t.getAttribute('data-tab') === 'form');
    });
    showPage(1);
  }

  function showPage(n) {
    currentPage = Math.max(1, Math.min(n, TOTAL_PAGES));
    document.querySelectorAll('.form-page').forEach(function (el) {
      el.classList.toggle('active', parseInt(el.getAttribute('data-page'), 10) === currentPage);
    });
    document.querySelectorAll('.step-dot').forEach(function (el) {
      const p = parseInt(el.getAttribute('data-page'), 10);
      el.classList.remove('active', 'completed');
      if (p === currentPage) el.classList.add('active');
      else if (p < currentPage) el.classList.add('completed');
    });
    var progressFill = document.getElementById('progress-fill');
    if (progressFill) progressFill.style.width = (currentPage / TOTAL_PAGES * 100) + '%';
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

  document.querySelectorAll('.tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      const which = tab.getAttribute('data-tab');
      if (which === 'list') showList();
      if (which === 'form') {
        clearForm();
        showForm();
      }
    });
  });

  document.getElementById('btn-new').addEventListener('click', function () {
    clearForm();
    showForm();
  });

  document.getElementById('btn-cancel').addEventListener('click', function () {
    showList();
  });

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

  if (searchInput) {
    searchInput.addEventListener('input', function () {
      window.personnelApi.getAll().then(renderList);
    });
  }

  phsForm.addEventListener('submit', function (e) {
    e.preventDefault();
    const data = getFormData();
    window.personnelApi.save(data).then(function () {
      showList();
    }).catch(function (err) {
      console.error(err);
      alert('Could not save.\n\n' + (err && err.message ? err.message : 'Unknown error'));
    });
  });

  loadList();
  } catch (e) {
    showError(e.message || String(e));
    console.error(e);
  }
})();
