(async function () {
  function showError(msg) {
    document.body.innerHTML = '<div style="padding:24px;font-family:sans-serif;max-width:500px"><h2>Error</h2><p>' + String(msg).replace(/</g, '&lt;') + '</p><p>Check the console (Ctrl+Shift+I) for details.</p></div>';
  }
  try {
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

  await loadFormPages();
  await loadAnalyticsPage();

  const listView = document.getElementById('list-view');
  const formView = document.getElementById('form-view');
  const analyticsView = document.getElementById('analytics-view');
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
  const TOTAL_PAGES = 5;
  let currentPage = 1;
  if (!window.personnelApi) {
    showError('personnelApi not loaded. Preload may have failed.');
    return;
  }

  const FIELD_IDS = [
    'nameLast', 'nameFirst', 'nameMiddle', 'rank', 'afpSn', 'presentJob', 'businessAddress', 'homeAddress',
    'dateOfBirth', 'placeOfBirth', 'changeInName', 'nicknames', 'nationality', 'taxId', 'telNo', 'mobile', 'email',
    'passportNr', 'passportExpiry', 'sex', 'age', 'height', 'weight', 'build', 'complexion', 'colorEyes', 'colorHair',
    'scarMarks', 'healthState', 'recentIllness', 'bloodType', 'maritalStatus', 'spouseName', 'marriageDatePlace',
    'spouseDob', 'spousePlaceBirth', 'spouseOccupation', 'spouseContact', 'spouseCitizenship',
    'fatherName', 'fatherDobPlace', 'fatherAddress', 'fatherOccupation', 'fatherCitizenship',
    'motherName', 'motherDobPlace', 'motherAddress', 'motherOccupation', 'motherCitizenship',
    'siblingsName', 'siblingsDob', 'siblingsCitizenship', 'siblingsAddress', 'siblingsOccupation', 'siblingsEmployerAddress',
    'stepParentFullName', 'stepParentDob', 'stepParentAddress', 'stepParentOccupation', 'stepParentCitizenship',
    'fatherInLawFullName', 'fatherInLawDob', 'fatherInLawAddress', 'fatherInLawOccupation', 'fatherInLawCitizenship',
    'motherInLawFullName', 'motherInLawDob', 'motherInLawAddress', 'motherInLawOccupation', 'motherInLawCitizenship',
    'elemLocation', 'elemAttendance', 'elemGraduated', 'hsLocation', 'hsAttendance', 'hsGraduated',
    'collegeLocation', 'collegeAttendance', 'collegeGraduated', 'pgLocation', 'pgCourseAttendance', 'pgGraduated',
    'otherSchools', 'civilServiceEligibility', 'dismissedResign',
    'salaryDependent', 'salFiled', 'incomeTaxFiled',
    'arrestRecord', 'familyArrest', 'adminCase', 'pd1081', 'liquorDrugs',
    'hobbies', 'lieDetector',
    'signedAtCert', 'signedDateCert', 'swornDay', 'swornMonth', 'swornPlace',
    'residenceCertNr2', 'residenceCertIssuedOn2', 'residenceCertIssuedAt2', 'administeringOfficer2'
    , 'photoDataUrl'
  ];

  function normalizeValue(val) {
    if (val == null) return null;
    const trimmed = String(val).trim();
    return trimmed === '' ? null : trimmed;
  }

  function setPhotoPreview(dataUrl) {
    const previewImg = document.getElementById('photo-preview');
    const placeholderText = document.getElementById('photo-placeholder-text');
    if (!previewImg || !placeholderText) return;
    const src = dataUrl && String(dataUrl).trim() !== '' ? String(dataUrl) : '';
    if (src) {
      previewImg.src = src;
      previewImg.style.display = 'block';
      placeholderText.style.display = 'none';
    } else {
      previewImg.src = '';
      previewImg.style.display = 'none';
      placeholderText.style.display = 'block';
    }
  }

  function createChildRow(rowData) {
    const row = document.createElement('div');
    row.className = 'row child-row';
    row.innerHTML =
      '<div class="four-cols">' +
        '<input type="text" data-child="name" placeholder="Child name" />' +
        '<input type="date" data-child="dob" />' +
        '<input type="text" data-child="citizenshipAddress" placeholder="Citizenship / Address" />' +
        '<input type="text" data-child="fatherMother" placeholder="Name of Father and Mother" />' +
      '</div>' +
      '<button type="button" class="btn small danger remove-child-row" style="margin-top:8px">Remove</button>';
    const data = rowData || {};
    row.querySelector('[data-child="name"]').value = data.name || '';
    row.querySelector('[data-child="dob"]').value = data.dob || '';
    row.querySelector('[data-child="citizenshipAddress"]').value = data.citizenshipAddress || '';
    row.querySelector('[data-child="fatherMother"]').value = data.fatherMother || '';
    return row;
  }

  const ROW_SECTIONS = [
    { key: 'placesOfResidence', hostId: 'places-of-residence-rows', addBtnId: 'add-places-of-residence-row', fields: [{ key: 'inclusiveDates', placeholder: 'Inclusive dates' }, { key: 'address', placeholder: 'Address' }], colsClass: 'two-cols' },
    { key: 'employmentHistory', hostId: 'employment-history-rows', addBtnId: 'add-employment-history-row', fields: [{ key: 'inclusiveDate', placeholder: 'Inclusive date' }, { key: 'type', placeholder: 'Type' }, { key: 'employerAddress', placeholder: 'Name & address of employer' }, { key: 'reasonForLeaving', placeholder: 'Reason for leaving' }], colsClass: 'four-cols' },
    { key: 'seminarsTraining', hostId: 'seminars-training-rows', addBtnId: 'add-seminars-training-row', fields: [{ key: 'inclusiveDate', placeholder: 'Inclusive date' }, { key: 'name', placeholder: 'Name of Seminar/Training' }, { key: 'conductedBy', placeholder: 'Conducted by' }, { key: 'remarks', placeholder: 'Remarks' }], colsClass: 'four-cols' },
    { key: 'foreignCountries', hostId: 'foreign-countries-rows', addBtnId: 'add-foreign-countries-row', fields: [{ key: 'dateOfVisit', placeholder: 'Date of visit' }, { key: 'country', placeholder: 'Country' }, { key: 'purpose', placeholder: 'Purpose' }, { key: 'addressAbroad', placeholder: 'Address abroad' }], colsClass: 'four-cols' },
    { key: 'banksCredit', hostId: 'banks-credit-rows', addBtnId: 'add-banks-credit-row', fields: [{ key: 'name', placeholder: 'Institution name' }, { key: 'address', placeholder: 'Address' }, { key: 'natureOfAccount', placeholder: 'Nature of account' }], colsClass: 'three-cols' },
    { key: 'creditReferences', hostId: 'credit-references-rows', addBtnId: 'add-credit-references-row', fields: [{ key: 'name', placeholder: 'Name' }, { key: 'address', placeholder: 'Address' }], colsClass: 'two-cols' },
    { key: 'characterRefs', hostId: 'character-refs-rows', addBtnId: 'add-character-refs-row', fields: [{ key: 'name', placeholder: 'Name' }, { key: 'address', placeholder: 'Address' }], colsClass: 'two-cols' },
    { key: 'neighbors', hostId: 'neighbors-rows', addBtnId: 'add-neighbors-row', fields: [{ key: 'name', placeholder: 'Name' }, { key: 'address', placeholder: 'Address' }], colsClass: 'two-cols' },
    { key: 'organizations', hostId: 'organizations-rows', addBtnId: 'add-organizations-row', fields: [{ key: 'organization', placeholder: 'Organization' }, { key: 'address', placeholder: 'Address' }, { key: 'membershipDate', placeholder: 'Date of membership' }, { key: 'positionHeld', placeholder: 'Position held' }], colsClass: 'four-cols' },
    { key: 'languages', hostId: 'languages-rows', addBtnId: 'add-languages-row', fields: [{ key: 'languageDialect', placeholder: 'Language / Dialect' }, { key: 'speak', placeholder: 'Speak' }, { key: 'read', placeholder: 'Read' }, { key: 'write', placeholder: 'Write' }], colsClass: 'four-cols' }
  ];

  function createStructuredRow(section, rowData) {
    const row = document.createElement('div');
    row.className = 'row data-row';
    row.setAttribute('data-section', section.key);
    const data = rowData || {};
    const fieldsHtml = section.fields.map(function (field) {
      return '<input type="text" data-field="' + field.key + '" placeholder="' + field.placeholder + '" />';
    }).join('');
    row.innerHTML =
      '<div class="' + section.colsClass + '">' + fieldsHtml + '</div>' +
      '<button type="button" class="btn small danger remove-data-row" style="margin-top:8px">Remove</button>';
    section.fields.forEach(function (field) {
      const input = row.querySelector('[data-field="' + field.key + '"]');
      if (input) input.value = data[field.key] || '';
    });
    return row;
  }

  function parseLegacyStructured(section, value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value !== 'string') return [];
    return value.split('\n').map(function (line) {
      const parts = String(line).split(',').map(function (p) { return p.trim(); });
      const row = {};
      section.fields.forEach(function (field, idx) {
        row[field.key] = parts[idx] || '';
      });
      return row;
    }).filter(function (row) {
      return section.fields.some(function (field) { return row[field.key]; });
    });
  }

  function setStructuredRows(section, value) {
    const host = document.getElementById(section.hostId);
    if (!host) return;
    host.innerHTML = '';
    const rows = parseLegacyStructured(section, value);
    if (!rows.length) rows.push({});
    rows.forEach(function (rowData) {
      host.appendChild(createStructuredRow(section, rowData));
    });
  }

  function getStructuredRows(section) {
    const host = document.getElementById(section.hostId);
    if (!host) return [];
    return Array.from(host.querySelectorAll('.data-row')).map(function (row) {
      const item = {};
      section.fields.forEach(function (field) {
        const input = row.querySelector('[data-field="' + field.key + '"]');
        item[field.key] = normalizeValue(input ? input.value : '');
      });
      return item;
    }).filter(function (item) {
      return section.fields.some(function (field) { return item[field.key]; });
    });
  }

  function parseLegacyChildren(children) {
    if (!children) return [];
    if (Array.isArray(children)) return children;
    if (typeof children !== 'string') return [];
    return children.split('\n').map(function (line) {
      const parts = String(line).split(',').map(function (p) { return p.trim(); });
      return {
        name: parts[0] || '',
        dob: parts[1] || '',
        citizenshipAddress: parts[2] || '',
        fatherMother: parts[3] || ''
      };
    }).filter(function (row) {
      return row.name || row.dob || row.citizenshipAddress || row.fatherMother;
    });
  }

  function setChildrenRows(children) {
    const rowsHost = document.getElementById('children-rows');
    if (!rowsHost) return;
    rowsHost.innerHTML = '';
    const rows = parseLegacyChildren(children);
    if (!rows.length) rows.push({});
    rows.forEach(function (row) {
      rowsHost.appendChild(createChildRow(row));
    });
  }

  function getChildrenRows() {
    const rowsHost = document.getElementById('children-rows');
    if (!rowsHost) return [];
    return Array.from(rowsHost.querySelectorAll('.child-row')).map(function (row) {
      return {
        name: normalizeValue(row.querySelector('[data-child="name"]').value),
        dob: normalizeValue(row.querySelector('[data-child="dob"]').value),
        citizenshipAddress: normalizeValue(row.querySelector('[data-child="citizenshipAddress"]').value),
        fatherMother: normalizeValue(row.querySelector('[data-child="fatherMother"]').value)
      };
    }).filter(function (item) {
      return item.name || item.dob || item.citizenshipAddress || item.fatherMother;
    });
  }

  function getFormData() {
    const data = { id: recordIdInput.value || undefined };
    const parts = [];
    FIELD_IDS.forEach(function (id) {
      const el = document.getElementById(id);
      if (!el) return;
      const val = normalizeValue(el.value);
      data[id] = val;
      if (['nameLast', 'nameFirst', 'nameMiddle'].indexOf(id) >= 0 && val) parts.push(val);
    });
    data.children = getChildrenRows();
    ROW_SECTIONS.forEach(function (section) {
      data[section.key] = getStructuredRows(section);
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
    setChildrenRows(record.children);
    ROW_SECTIONS.forEach(function (section) {
      setStructuredRows(section, record[section.key]);
    });
    setPhotoPreview(record.photoDataUrl);
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

  function escapeHtml(value) {
    return String(value == null ? 'N/A' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function truncateText(value, maxLen) {
    var s = String(value == null ? '' : value);
    if (!maxLen || s.length <= maxLen) return s;
    return s.slice(0, Math.max(0, maxLen - 1)) + '…';
  }

  function getAvatarHtml(record) {
    var src = normalizeValue(record && (record.photoDataUrl || record.photo || record.avatar)) || null;
    if (src) {
      return '' +
        '<div class="avatar-thumb">' +
          '<img class="avatar-thumb-img" src="' + escapeHtml(src) + '" alt="" />' +
        '</div>';
    }

    // Fallback: initials from name fields.
    var full = normalizeValue(record && record.fullName) || '';
    var parts = full.split(',').map(function (p) { return p.trim(); }).filter(Boolean);
    var last = parts[0] || normalizeValue(record && record.nameLast) || '';
    var first = parts[1] || normalizeValue(record && record.nameFirst) || '';
    var initials = '';
    if (first) initials += first.charAt(0).toUpperCase();
    if (last) initials += last.charAt(0).toUpperCase();
    initials = initials || '—';

    return '' +
      '<div class="avatar-thumb">' +
        '<span class="avatar-initials">' + escapeHtml(initials) + '</span>' +
      '</div>';
  }

  function formatEducationBackground(r) {
    var pg = normalizeValue(r.pgLocation);
    var college = normalizeValue(r.collegeLocation);
    var hs = normalizeValue(r.hsLocation);
    var elem = normalizeValue(r.elemLocation);
    var otherSchools = normalizeValue(r.otherSchools);
    var civil = normalizeValue(r.civilServiceEligibility);

    if (pg) return truncateText('Post Graduate: ' + pg, 42);
    if (college) return truncateText('College: ' + college, 42);
    if (hs) return truncateText('High School: ' + hs, 42);
    if (elem) return truncateText('Elementary: ' + elem, 42);

    // Fallbacks: other schools/training and civil service eligibility
    if (otherSchools) return truncateText('Training: ' + otherSchools, 42);
    if (civil) return truncateText('Civil Service: ' + civil, 42);
    return '—';
  }

  function formatSeminarsTraining(r) {
    var items = r.seminarsTraining;
    if (!Array.isArray(items)) return '—';
    if (!items.length) return '—';
    var first = items[0] || {};
    var name = normalizeValue(first.name);
    var count = items.length;
    if (count === 1) return truncateText(name || '1 Seminar/Training', 36);
    return truncateText(count + ' Seminars/Trainings', 36);
  }

  function field(label, value) {
    return '<div class="summary-item"><span class="summary-label">' + escapeHtml(label) + ':</span> ' + escapeHtml(value || 'N/A') + '</div>';
  }

  function listFromRows(rows, formatRow) {
    if (!Array.isArray(rows) || !rows.length) return '<div class="summary-item">N/A</div>';
    return '<ol class="summary-list">' + rows.map(function (row) {
      return '<li class="summary-item">' + formatRow(row) + '</li>';
    }).join('') + '</ol>';
  }

  function buildSummaryHtml(record) {
    var data = record || {};
    return '' +
      '<article class="phs-summary">' +
        '<h1>Personnel History Statement</h1>' +
        '<p class="summary-sub">Summary View</p>' +

        '<section class="summary-section">' +
          '<div class="summary-section-title">I. Personal Details</div>' +
          '<div class="summary-grid-3">' +
            field('Last Name', data.nameLast) +
            field('First Name', data.nameFirst) +
            field('Middle Name', data.nameMiddle) +
          '</div>' +
          '<div class="summary-grid-2">' +
            field('Rank', data.rank) +
            field('AFP SN', data.afpSn) +
          '</div>' +
          '<div class="summary-grid-2">' +
            field('Present Job/Assignment', data.presentJob) +
            field('Nationality', data.nationality) +
          '</div>' +
          '<div class="summary-grid-2">' +
            field('Business/Duty Address', data.businessAddress) +
            field('Home Address', data.homeAddress) +
          '</div>' +
          '<div class="summary-grid-4">' +
            field('Date of Birth', data.dateOfBirth) +
            field('Place of Birth', data.placeOfBirth) +
            field('Mobile', data.mobile) +
            field('Email', data.email) +
          '</div>' +
        '</section>' +

        '<section class="summary-section">' +
          '<div class="summary-section-title">II. Personal Characteristics</div>' +
          '<div class="summary-grid-4">' +
            field('Sex', data.sex) +
            field('Age', data.age) +
            field('Height', data.height) +
            field('Weight', data.weight) +
          '</div>' +
          '<div class="summary-grid-4">' +
            field('Build', data.build) +
            field('Complexion', data.complexion) +
            field('Color of Eyes', data.colorEyes) +
            field('Color of Hair', data.colorHair) +
          '</div>' +
          '<div class="summary-grid-3">' +
            field('Scar/Marks', data.scarMarks) +
            field('Health State', data.healthState) +
            field('Blood Type', data.bloodType) +
          '</div>' +
        '</section>' +

        '<section class="summary-section">' +
          '<div class="summary-section-title">III. Marital History</div>' +
          '<div class="summary-grid-3">' +
            field('Marital Status', data.maritalStatus) +
            field('Spouse Name', data.spouseName) +
            field('Spouse Contact', data.spouseContact) +
          '</div>' +
          '<div class="summary-item"><span class="summary-label">Children:</span>' + listFromRows(data.children, function (row) {
            return escapeHtml([row.name, row.dob, row.citizenshipAddress, row.fatherMother].filter(Boolean).join(' | ') || 'N/A');
          }) + '</div>' +
        '</section>' +

        '<section class="summary-section">' +
          '<div class="summary-section-title">IV. Family History</div>' +
          '<div class="summary-grid-2">' +
            field('Father', data.fatherName) +
            field('Mother', data.motherName) +
          '</div>' +
          '<div class="summary-grid-2">' +
            field('Sibling Name', data.siblingsName) +
            field('Sibling Occupation', data.siblingsOccupation) +
          '</div>' +
        '</section>' +

        '<section class="summary-section">' +
          '<div class="summary-section-title">V-VIII. Education, Residence, Employment, Foreign Travel</div>' +
          '<div class="summary-grid-3">' +
            field('Elementary', data.elemLocation) +
            field('High School', data.hsLocation) +
            field('College', data.collegeLocation) +
          '</div>' +
          '<div class="summary-item"><span class="summary-label">Places of Residence:</span>' + listFromRows(data.placesOfResidence, function (row) {
            return escapeHtml([row.inclusiveDates, row.address].filter(Boolean).join(' | ') || 'N/A');
          }) + '</div>' +
          '<div class="summary-item"><span class="summary-label">Employment History:</span>' + listFromRows(data.employmentHistory, function (row) {
            return escapeHtml([row.inclusiveDate, row.type, row.employerAddress, row.reasonForLeaving].filter(Boolean).join(' | ') || 'N/A');
          }) + '</div>' +
          '<div class="summary-item"><span class="summary-label">Seminars & Training:</span>' + listFromRows(data.seminarsTraining, function (row) {
            return escapeHtml([row.inclusiveDate, row.name, row.conductedBy, row.remarks].filter(Boolean).join(' | ') || 'N/A');
          }) + '</div>' +
          '<div class="summary-item"><span class="summary-label">Foreign Countries Visited:</span>' + listFromRows(data.foreignCountries, function (row) {
            return escapeHtml([row.dateOfVisit, row.country, row.purpose, row.addressAbroad].filter(Boolean).join(' | ') || 'N/A');
          }) + '</div>' +
        '</section>' +

        '<section class="summary-section">' +
          '<div class="summary-section-title">IX-XIII. Credit, Reputation, Organizations, Misc</div>' +
          '<div class="summary-item"><span class="summary-label">Banks/Credit:</span>' + listFromRows(data.banksCredit, function (row) {
            return escapeHtml([row.name, row.address, row.natureOfAccount].filter(Boolean).join(' | ') || 'N/A');
          }) + '</div>' +
          '<div class="summary-item"><span class="summary-label">Character References:</span>' + listFromRows(data.characterRefs, function (row) {
            return escapeHtml([row.name, row.address].filter(Boolean).join(' | ') || 'N/A');
          }) + '</div>' +
          '<div class="summary-grid-2">' +
            field('Hobbies', data.hobbies) +
            field('Lie Detector Willingness', data.lieDetector) +
          '</div>' +
        '</section>' +
      '</article>';
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

  function renderList(records) {
    const query = (searchInput && searchInput.value || '').trim().toLowerCase();
    const filtered = query
      ? records.filter(function (r) {
          const fn = (r.fullName || '').toLowerCase();
          const pos = (r.presentJob || r.rank || '').toLowerCase();
          const mob = (r.mobile || '').toString();
          const em = (r.email || '').toLowerCase();
          const edu = (formatEducationBackground(r) || '').toLowerCase();
          const sem = (formatSeminarsTraining(r) || '').toLowerCase();
          return fn.includes(query) || pos.includes(query) || mob.includes(query) || em.includes(query) || edu.includes(query) || sem.includes(query);
        })
      : records;

    personnelTbody.innerHTML = '';
    emptyState.style.display = filtered.length ? 'none' : 'block';

    filtered.forEach(function (r) {
      const edu = formatEducationBackground(r);
      const sem = formatSeminarsTraining(r);
      const position = escapeHtml(r.presentJob || r.rank || '—');
      const contact = escapeHtml(r.mobile || r.email || '—');
      const safeId = escapeHtml(r.id || '');
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td class="avatar-cell">' + getAvatarHtml(r) + '</td>' +
        '<td>' + position + '</td>' +
        '<td>' + escapeHtml(edu) + '</td>' +
        '<td>' + escapeHtml(sem) + '</td>' +
        '<td>' + contact + '</td>' +
        '<td>' + escapeHtml(formatDate(r.updatedAt)) + '</td>' +
        '<td>' +
          '<button type="button" class="btn small secondary view-btn" data-id="' + safeId + '">View</button> ' +
          '<button type="button" class="btn small primary edit-btn" data-id="' + safeId + '">Edit</button> ' +
          '<button type="button" class="btn small danger delete-btn" data-id="' + safeId + '">Delete</button>' +
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

    personnelTbody.querySelectorAll('.view-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const id = btn.getAttribute('data-id');
        const record = records.find(function (r) { return String(r.id) === String(id); });
        if (record) openSummary(record);
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

  function monthKey(date) {
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
  }

  function monthLabelFromKey(key) {
    var parts = String(key).split('-');
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
    return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
  }

  function mapCounts(records, getter) {
    return records.reduce(function (acc, record) {
      var key = getter(record);
      if (!key) key = 'Unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }

  function renderBarChart(containerId, dataMap) {
    var host = document.getElementById(containerId);
    if (!host) return;
    var entries = Object.entries(dataMap || {}).sort(function (a, b) { return b[1] - a[1]; });
    if (!entries.length) {
      host.innerHTML = '<div class="chart-empty">No data available yet.</div>';
      return;
    }
    var max = entries[0][1] || 1;
    host.innerHTML = '<div class="bar-chart">' + entries.map(function (entry) {
      var width = Math.max(4, Math.round((entry[1] / max) * 100));
      return '' +
        '<div class="bar-row">' +
          '<div>' + escapeHtml(entry[0]) + '</div>' +
          '<div class="bar-track"><div class="bar-fill" style="width:' + width + '%"></div></div>' +
          '<div class="bar-value">' + entry[1] + '</div>' +
        '</div>';
    }).join('') + '</div>';
  }

  function renderAnalytics(records) {
    var total = records.length;
    var ageFilled = records.filter(function (r) { return r.age != null && String(r.age).trim() !== ''; }).length;
    var now = new Date();
    var thisMonth = records.filter(function (r) {
      if (!r.updatedAt) return false;
      var d = new Date(r.updatedAt);
      return !isNaN(d.getTime()) && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;

    var kpiTotal = document.getElementById('kpi-total');
    var kpiAge = document.getElementById('kpi-age-filled');
    var kpiMonth = document.getElementById('kpi-updated-month');
    if (kpiTotal) kpiTotal.textContent = String(total);
    if (kpiAge) kpiAge.textContent = String(ageFilled);
    if (kpiMonth) kpiMonth.textContent = String(thisMonth);

    var sexMap = mapCounts(records, function (r) { return r.sex; });
    var maritalMap = mapCounts(records, function (r) { return r.maritalStatus; });

    var ageMap = { '18-24': 0, '25-34': 0, '35-44': 0, '45-54': 0, '55+': 0, Unknown: 0 };
    records.forEach(function (r) {
      var age = Number(r.age);
      if (!isFinite(age) || age <= 0) { ageMap.Unknown += 1; return; }
      if (age <= 24) ageMap['18-24'] += 1;
      else if (age <= 34) ageMap['25-34'] += 1;
      else if (age <= 44) ageMap['35-44'] += 1;
      else if (age <= 54) ageMap['45-54'] += 1;
      else ageMap['55+'] += 1;
    });

    var monthlyMap = {};
    for (var i = 5; i >= 0; i--) {
      var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      var key = monthKey(d);
      monthlyMap[monthLabelFromKey(key)] = 0;
    }
    records.forEach(function (r) {
      if (!r.updatedAt) return;
      var d = new Date(r.updatedAt);
      if (isNaN(d.getTime())) return;
      var label = monthLabelFromKey(monthKey(d));
      if (Object.prototype.hasOwnProperty.call(monthlyMap, label)) monthlyMap[label] += 1;
    });

    var assignmentMap = mapCounts(records, function (r) {
      return r.presentJob ? String(r.presentJob).trim() : null;
    });
    var topAssignments = Object.fromEntries(
      Object.entries(assignmentMap).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 6)
    );

    renderBarChart('chart-sex', sexMap);
    renderBarChart('chart-marital', maritalMap);
    renderBarChart('chart-age', ageMap);
    renderBarChart('chart-monthly', monthlyMap);
    renderBarChart('chart-assignment', topAssignments);
  }

  function loadAllDataAndRender() {
    return window.personnelApi.getAll().then(function (records) {
      renderList(records);
      renderAnalytics(records);
      return records;
    });
  }

  function loadList() {
    loadAllDataAndRender().catch(function (err) {
      console.error(err);
      alert('Could not load data.\n\n' + (err && err.message ? err.message : 'Unknown error'));
      renderList([]);
      renderAnalytics([]);
    });
  }

  function showList() {
    listView.classList.add('active');
    formView.classList.remove('active');
    if (analyticsView) analyticsView.classList.remove('active');
    document.querySelectorAll('.nav-item').forEach(function (t) {
      t.classList.toggle('active', t.getAttribute('data-tab') === 'list');
    });
    loadList();
  }

  function showForm() {
    listView.classList.remove('active');
    formView.classList.add('active');
    if (analyticsView) analyticsView.classList.remove('active');
    document.querySelectorAll('.nav-item').forEach(function (t) {
      t.classList.toggle('active', t.getAttribute('data-tab') === 'form');
    });
    showPage(1);
  }

  function showAnalytics() {
    listView.classList.remove('active');
    formView.classList.remove('active');
    if (analyticsView) analyticsView.classList.add('active');
    document.querySelectorAll('.nav-item').forEach(function (t) {
      t.classList.toggle('active', t.getAttribute('data-tab') === 'analytics');
    });
    loadAllDataAndRender().catch(function () {
      renderAnalytics([]);
    });
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

  document.querySelectorAll('.nav-item').forEach(function (tab) {
    tab.addEventListener('click', function () {
      const which = tab.getAttribute('data-tab');
      if (which === 'list') showList();
      if (which === 'form') {
        clearForm();
        showForm();
      }
      if (which === 'analytics') showAnalytics();
    });
  });

  document.getElementById('btn-new').addEventListener('click', function () {
    clearForm();
    showForm();
  });

  document.getElementById('btn-cancel').addEventListener('click', function () {
    showList();
  });

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

  var addChildRow = document.getElementById('add-child-row');
  if (addChildRow) {
    addChildRow.addEventListener('click', function () {
      var rowsHost = document.getElementById('children-rows');
      if (rowsHost) rowsHost.appendChild(createChildRow({}));
    });
  }

  ROW_SECTIONS.forEach(function (section) {
    var addBtn = document.getElementById(section.addBtnId);
    if (addBtn) {
      addBtn.addEventListener('click', function () {
        var host = document.getElementById(section.hostId);
        if (host) host.appendChild(createStructuredRow(section, {}));
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
        photoDataUrlInput.value = String(reader.result || '');
        setPhotoPreview(photoDataUrlInput.value);
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
        rowsHost.appendChild(createChildRow({}));
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
        host.appendChild(createStructuredRow(section, {}));
      }
    }
  });

  if (searchInput) {
    searchInput.addEventListener('input', function () {
      window.personnelApi.getAll().then(function (records) {
        renderList(records);
      });
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

  setChildrenRows([]);
  ROW_SECTIONS.forEach(function (section) {
    setStructuredRows(section, []);
  });
  loadList();
  } catch (e) {
    showError(e.message || String(e));
    console.error(e);
  }
})();
