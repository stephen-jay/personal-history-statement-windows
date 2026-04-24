import { FIELD_IDS, ROW_SECTIONS } from './constants.js';
import * as formData from './form-data.js';
import { renderAnalytics } from './analytics.js';
import { buildSummaryHtml } from './summary.js';
import { buildStandalonePhsHtml, suggestedExportBasename } from './phs-export-html.js';
import { renderList } from './list.js';
import { setActiveNav, setAppView, setTopbarSection } from './views.js';
import { createFormNav } from './form-nav.js';
import { createPhsModalController } from './phs-modal.js';
import { squareThumbnailDataUrl } from './photo-thumbnail.js';
import { initAdminUsersView } from './admin-users.js';

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

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom(values) {
  return values[randomInt(0, values.length - 1)];
}

function randomDateISO(startYear, endYear) {
  const year = randomInt(startYear, endYear);
  const month = String(randomInt(1, 12)).padStart(2, '0');
  const day = String(randomInt(1, 28)).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

function buildRandomEducationTimeline(dobIso, city) {
  var birthYear = Number(String(dobIso || '').slice(0, 4));
  if (!Number.isFinite(birthYear)) birthYear = randomInt(1988, 2001);

  var elemStart = birthYear + randomInt(6, 8);
  var elemEnd = elemStart + randomInt(5, 6);

  var hsStart = elemEnd;
  var hsEnd = hsStart + randomInt(3, 4);

  var collegeStart = hsEnd;
  var collegeEnd = collegeStart + randomInt(3, 5);

  var pgStart = collegeEnd + randomInt(1, 4);
  var pgEnd = pgStart + randomInt(1, 2);

  var elemSchool = pickRandom(['San Isidro Elementary School', 'Rizal Elementary School', 'Bagong Silang Elementary School', 'Sto. Nino Central School']);
  var hsSchool = pickRandom(['Rizal National High School', 'Juan Luna High School', 'Bonifacio Science High School', 'Mabini Integrated High School']);
  var collegeSchool = pickRandom(['Polytechnic University of the Philippines', 'Technological University of the Philippines', 'University of Makati', 'City College of ' + city]);
  var pgSchool = pickRandom(['State University Graduate School', 'National College of Public Administration', 'Institute for Governance Studies']);
  var pgCourse = pickRandom(['Public Administration', 'Information Technology', 'Criminology', 'Business Administration', 'Human Resource Management']);

  var trainingA = pickRandom(['Leadership Seminar', 'Records Management Workshop', 'Risk Assessment Training', 'Public Service Ethics Program']);
  var trainingB = pickRandom(['Cybersecurity Awareness Training', 'Data Privacy Compliance Seminar', 'Disaster Preparedness Workshop', 'Financial Management Training']);

  var civilService = pickRandom([
    'Career Service Professional',
    'Career Service Subprofessional',
    'PD 907 Honor Graduate Eligibility',
    'Barangay Official Eligibility',
    'RA 1080 (Board/Bar) Eligibility'
  ]);
  var civilYear = randomInt(Math.max(hsEnd, 2010), pgEnd + 5);

  return {
    elemLocation: elemSchool + ', ' + city,
    elemAttendance: elemStart + '-' + elemEnd,
    elemGraduated: String(elemEnd),
    hsLocation: hsSchool + ', ' + city,
    hsAttendance: hsStart + '-' + hsEnd,
    hsGraduated: String(hsEnd),
    collegeLocation: collegeSchool + ', ' + city,
    collegeAttendance: collegeStart + '-' + collegeEnd,
    collegeGraduated: String(collegeEnd),
    pgLocation: pgSchool + ', ' + city,
    pgCourseAttendance: pgCourse + ', ' + pgStart + '-' + pgEnd,
    pgGraduated: String(pgEnd),
    otherSchools: trainingA + ', ' + (pgEnd + 1) + '\n' + trainingB + ', ' + (pgEnd + 2),
    civilServiceEligibility: civilService + ' - ' + civilYear
  };
}

function titleFromId(id) {
  return String(id)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\d+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, function (c) { return c.toUpperCase(); });
}

function buildRandomPhotoDataUrl(initials) {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">' +
      '<defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1">' +
        '<stop offset="0%" stop-color="#1d4e89"/>' +
        '<stop offset="100%" stop-color="#2f6c9b"/>' +
      '</linearGradient></defs>' +
      '<rect width="256" height="256" fill="url(#g)"/>' +
      '<circle cx="128" cy="92" r="42" fill="#dbeafe" opacity="0.95"/>' +
      '<rect x="58" y="148" width="140" height="78" rx="38" fill="#dbeafe" opacity="0.95"/>' +
      '<text x="128" y="242" fill="#ffffff" font-size="22" font-family="Arial, sans-serif" text-anchor="middle">' + initials + '</text>' +
    '</svg>';
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

function buildRandomHandwritingDataUrl(initials) {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="240" viewBox="0 0 640 240">' +
      '<rect width="640" height="240" fill="#ffffff"/>' +
      '<g stroke="#d1d5db" stroke-width="1">' +
        '<line x1="24" y1="52" x2="616" y2="52"/>' +
        '<line x1="24" y1="96" x2="616" y2="96"/>' +
        '<line x1="24" y1="140" x2="616" y2="140"/>' +
        '<line x1="24" y1="184" x2="616" y2="184"/>' +
      '</g>' +
      '<path d="M44 80 C110 40, 165 130, 236 88 S365 54, 432 96 S540 132, 604 86" fill="none" stroke="#1f2937" stroke-width="2.6" stroke-linecap="round"/>' +
      '<text x="600" y="220" text-anchor="end" fill="#6b7280" font-size="16" font-family="Arial, sans-serif">' + initials + ' handwritten sample</text>' +
    '</svg>';
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

function randomFieldValue(fieldId, el, seed) {
  const fixed = {
    nameLast: seed.lastName,
    nameFirst: seed.firstName,
    nameMiddle: seed.middleName,
    organization: pickRandom(['Member - DepEd', 'Member - DOH', 'Member - PNP', 'Member - AFP']),
    presentJob: pickRandom(['Operations Analyst', 'Administrative Officer', 'Data Compliance Associate']),
    businessAddress: seed.businessAddress,
    homeAddress: seed.homeAddress,
    dateOfBirth: seed.dob,
    placeOfBirth: seed.placeOfBirth,
    changeInName: 'N/A',
    nicknames: pickRandom(['J', 'Ace', 'MJ', 'Pat']),
    nationality: 'Filipino',
    taxId: String(randomInt(100000000000, 999999999999)),
    telNo: '02-' + String(randomInt(1000000, 9999999)),
    mobile: '09' + String(randomInt(100000000, 999999999)),
    email: (seed.firstName + '.' + seed.lastName + randomInt(10, 99) + '@example.com').toLowerCase(),
    passportNr: pickRandom(['P' + randomInt(1000000, 9999999), 'N/A']),
    passportExpiry: randomDateISO(2027, 2035),
    age: String(seed.age),
    height: (randomInt(150, 185) / 100).toFixed(2),
    weight: String(randomInt(52, 90)),
    colorEyes: pickRandom(['Brown', 'Black', 'Dark Brown']),
    colorHair: pickRandom(['Black', 'Dark Brown']),
    scarMarks: 'None',
    recentIllness: 'None in the last 5 years',
    spouseName: seed.spouseName,
    marriageDatePlace: randomDateISO(2012, 2024) + ', ' + seed.city,
    spouseDob: randomDateISO(1986, 2001),
    spousePlaceBirth: seed.placeOfBirth,
    spouseOccupation: pickRandom(['Teacher', 'Nurse', 'Account Specialist', 'Project Coordinator']),
    spouseContact: '09' + String(randomInt(100000000, 999999999)),
    spouseCitizenship: 'Filipino',
    fatherName: pickRandom(['Roberto ' + seed.lastName, 'Antonio ' + seed.lastName, 'Ramon ' + seed.lastName]),
    fatherDobPlace: randomDateISO(1952, 1970) + ', ' + seed.city,
    fatherAddress: seed.homeAddress,
    fatherOccupation: pickRandom(['Retired Technician', 'Small Business Owner', 'Security Supervisor']),
    fatherCitizenship: 'Filipino',
    motherName: pickRandom(['Maria ' + seed.lastName, 'Elena ' + seed.lastName, 'Luzviminda ' + seed.lastName]),
    motherDobPlace: randomDateISO(1955, 1972) + ', ' + seed.city,
    motherAddress: seed.homeAddress,
    motherOccupation: pickRandom(['Homemaker', 'Public School Teacher', 'Store Manager']),
    motherCitizenship: 'Filipino',
    siblingsName: pickRandom(['Carlo ' + seed.lastName, 'Anna ' + seed.lastName, 'Paolo ' + seed.lastName]),
    siblingsDob: randomDateISO(1988, 2004),
    siblingsCitizenship: 'Filipino',
    siblingsAddress: seed.homeAddress,
    siblingsOccupation: pickRandom(['Engineer', 'Call Center Agent', 'Government Staff']),
    siblingsEmployerAddress: pickRandom(['Quezon City', 'Makati City', 'Taguig City']) + ', Metro Manila',
    stepParentFullName: pickRandom(['N/A', 'Joel ' + seed.lastName, 'Celia ' + seed.lastName]),
    stepParentDob: randomDateISO(1960, 1978),
    stepParentAddress: seed.homeAddress,
    stepParentOccupation: pickRandom(['N/A', 'Business Owner', 'Clerk']),
    stepParentCitizenship: 'Filipino',
    fatherInLawFullName: pickRandom(['Mario ' + seed.lastName, 'N/A']),
    fatherInLawDob: randomDateISO(1950, 1970),
    fatherInLawAddress: seed.homeAddress,
    fatherInLawOccupation: pickRandom(['Retired', 'Farmer', 'Driver']),
    fatherInLawCitizenship: 'Filipino',
    motherInLawFullName: pickRandom(['Gloria ' + seed.lastName, 'N/A']),
    motherInLawDob: randomDateISO(1952, 1972),
    motherInLawAddress: seed.homeAddress,
    motherInLawOccupation: pickRandom(['Homemaker', 'Vendor', 'Retired']),
    motherInLawCitizenship: 'Filipino',
    elemLocation: seed.education.elemLocation,
    elemAttendance: seed.education.elemAttendance,
    elemGraduated: seed.education.elemGraduated,
    hsLocation: seed.education.hsLocation,
    hsAttendance: seed.education.hsAttendance,
    hsGraduated: seed.education.hsGraduated,
    collegeLocation: seed.education.collegeLocation,
    collegeAttendance: seed.education.collegeAttendance,
    collegeGraduated: seed.education.collegeGraduated,
    pgLocation: seed.education.pgLocation,
    pgCourseAttendance: seed.education.pgCourseAttendance,
    pgGraduated: seed.education.pgGraduated,
    otherSchools: seed.education.otherSchools,
    civilServiceEligibility: seed.education.civilServiceEligibility,
    dismissedResign: 'NO',
    salaryDependent: 'YES',
    salFiled: 'Yes, filed at agency HR on ' + randomDateISO(2024, 2025),
    incomeTaxFiled: 'Yes, BIR annual filing, PHP ' + randomInt(12000, 45000),
    arrestRecord: 'NO',
    familyArrest: 'NO',
    adminCase: 'NO',
    pd1081: 'NO',
    liquorDrugs: 'No illegal drugs; occasional social drinking',
    hobbies: pickRandom(['Reading, jogging, basketball', 'Cycling, chess, cooking', 'Badminton, photography, travel']),
    signedAtCert: seed.city,
    signedDateCert: randomDateISO(2025, 2026),
    swornDay: String(randomInt(1, 28)),
    swornMonth: pickRandom(['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']),
    swornPlace: seed.city + ', Philippines',
    residenceCertNr2: String(randomInt(100000, 999999)),
    residenceCertIssuedOn2: randomDateISO(2025, 2026),
    residenceCertIssuedAt2: seed.city,
    administeringOfficer2: pickRandom(['Atty. Ramon Villanueva', 'Atty. Liza Mendoza', 'Atty. Carlos Dela Cruz'])
  };

  if (fieldId === 'photoDataUrl') {
    return buildRandomPhotoDataUrl(seed.initials);
  }

  if (fieldId === 'handwrittenEntryDataUrl') {
    return buildRandomHandwritingDataUrl(seed.initials);
  }

  if (Object.prototype.hasOwnProperty.call(fixed, fieldId)) {
    return fixed[fieldId];
  }

  if (!el) return 'Sample ' + titleFromId(fieldId);

  const tag = String(el.tagName || '').toLowerCase();
  const type = String(el.type || '').toLowerCase();

  if (tag === 'select') {
    const choices = Array.from(el.options || []).map(function (opt) { return opt.value; }).filter(Boolean);
    return choices.length ? pickRandom(choices) : 'Yes';
  }

  if (type === 'date') return randomDateISO(2018, 2026);
  if (type === 'number') return String(randomInt(20, 80));
  if (type === 'email') return 'sample' + randomInt(100, 999) + '@example.com';
  if (type === 'tel') return '09' + String(randomInt(100000000, 999999999));
  return 'Sample ' + titleFromId(fieldId);
}

function randomStructuredRow(sectionKey, seed) {
  const rowBySection = {
    placesOfResidence: {
      inclusiveDates: '2012-2017',
      address: 'Blk 12 Lot 5 ' + seed.barangay + ', ' + seed.city
    },
    employmentHistory: {
      inclusiveDate: (function () {
        var start = randomInt(2012, 2023);
        var end = start + randomInt(1, 6);
        return start + '-' + end;
      })(),
      type: pickRandom(['Permanent', 'Contractual', 'Job Order', 'Project-based', 'Temporary']),
      employerAddress: pickRandom([
        'City Government Office, ' + seed.city,
        'Provincial Capitol, ' + seed.city,
        'Private Logistics Corp., ' + seed.city,
        'Metro Services Inc., ' + seed.city,
        'Regional Operations Center, ' + seed.city
      ]),
      reasonForLeaving: pickRandom([
        'Career advancement',
        'End of contract',
        'Relocation',
        'Better compensation',
        'Personal development'
      ])
    },
    seminarsTraining: {
      inclusiveDate: (function () {
        var start = randomInt(2017, 2025);
        var end = start + randomInt(0, 1);
        return start === end ? String(start) : start + '-' + end;
      })(),
      name: pickRandom([
        'Data Privacy and Information Security',
        'Records Management and Archiving',
        'Disaster Risk Reduction and Response',
        'Public Service Ethics and Accountability',
        'Office Productivity and Workflow Automation'
      ]),
      conductedBy: pickRandom([
        'Civil Service Institute',
        'DILG Training Center',
        'National Government HR Academy',
        'Local Government Training Office',
        'CSC Regional Office'
      ]),
      remarks: pickRandom(['Completed', 'With distinction', 'Completed - online', 'Completed - in person'])
    },
    foreignCountries: {
      dateOfVisit: '2023',
      country: pickRandom(['Japan', 'Singapore', 'Thailand']),
      purpose: 'Tourism',
      addressAbroad: 'Hotel district, city center'
    },
    banksCredit: {
      name: pickRandom(['BDO Unibank', 'LandBank', 'BPI']),
      address: seed.city,
      natureOfAccount: pickRandom(['Savings', 'Payroll', 'Savings and ATM'])
    },
    creditReferences: {
      name: pickRandom(['Jordan Reyes', 'Mia Santos', 'Rafael Cruz']),
      address: seed.city + ', Metro Manila'
    },
    characterRefs: {
      name: pickRandom(['Atty. Noel Ramos', 'Engr. Leah Flores', 'Dr. Kelvin Torres']),
      address: seed.city + ', Metro Manila'
    },
    neighbors: {
      name: pickRandom(['Rona Perez', 'Leo Bautista', 'Karen Lim']),
      address: seed.barangay + ', ' + seed.city
    },
    organizations: {
      organization: pickRandom(['Philippine Red Cross - Local Chapter', 'Rotary Club', 'Civic Volunteer Group']),
      address: seed.city,
      membershipDate: String(randomInt(2018, 2025)),
      positionHeld: pickRandom(['Member', 'Committee Volunteer', 'Secretary'])
    },
    languages: {
      languageDialect: pickRandom(['Filipino', 'English', 'Cebuano']),
      speak: pickRandom(['Fluent', 'Fair']),
      read: pickRandom(['Fluent', 'Fair']),
      write: pickRandom(['Fluent', 'Fair'])
    }
  };
  return rowBySection[sectionKey] || {};
}

function buildAutoFillRecord() {
  const firstName = pickRandom(['Miguel', 'Patricia', 'Angela', 'Carlo', 'Jasmine', 'Ramon']);
  const lastName = pickRandom(['Santos', 'Dela Cruz', 'Reyes', 'Garcia', 'Mendoza', 'Villanueva']);
  const middleName = pickRandom(['Lopez', 'Torres', 'Aquino', 'Navarro', 'Rivera']);
  const cities = ['Quezon City', 'Makati City', 'Taguig City', 'Pasig City', 'Manila'];
  const city = pickRandom(cities);
  const barangay = pickRandom(['Barangay Poblacion', 'Barangay San Isidro', 'Barangay South Signal', 'Barangay Commonwealth']);
  const seed = {
    firstName: firstName,
    lastName: lastName,
    middleName: middleName,
    initials: firstName.charAt(0) + lastName.charAt(0),
    city: city,
    barangay: barangay,
    placeOfBirth: city,
    homeAddress: randomInt(1, 300) + ' ' + pickRandom(['Rizal St.', 'Mabini St.', 'Bonifacio Ave.', 'Quezon Ave.']) + ', ' + barangay + ', ' + city,
    businessAddress: pickRandom(['Civic Center', 'Government Center', 'Business District']) + ', ' + city,
    dob: randomDateISO(1988, 2001),
    age: randomInt(24, 38),
    spouseName: pickRandom(['Andrea ' + lastName, 'Mark ' + lastName, 'Camille ' + lastName])
  };
  seed.education = buildRandomEducationTimeline(seed.dob, seed.city);
  const skipEducationalBackground = Math.random() < 0.4;
  const skipSeminarsTraining = Math.random() < 0.4;

  const record = {};
  FIELD_IDS.forEach(function (fieldId) {
    const el = document.getElementById(fieldId);
    record[fieldId] = randomFieldValue(fieldId, el, seed);
  });

  var sexEl = document.getElementById('sex');
  if (sexEl) record.sex = pickRandom(['Male', 'Female']);
  record.maritalStatus = 'Married';
  record.build = pickRandom(['Medium', 'Light', 'Heavy']);
  record.complexion = pickRandom(['Fair', 'Light', 'Dark']);
  record.healthState = pickRandom(['Excellent', 'Good']);
  record.bloodType = pickRandom(['A+', 'B+', 'O+', 'AB+']);
  record.lieDetector = pickRandom(['Yes', 'No']);

  record.children = [
    {
      name: pickRandom(['Liam ' + seed.lastName, 'Sofia ' + seed.lastName, 'Noah ' + seed.lastName]),
      dob: randomDateISO(2011, 2021),
      citizenshipAddress: 'Filipino / ' + seed.homeAddress,
      fatherMother: seed.firstName + ' ' + seed.lastName + ' & ' + seed.spouseName
    }
  ];

  ROW_SECTIONS.forEach(function (section) {
    record[section.key] = [randomStructuredRow(section.key, seed)];
  });

  if (skipEducationalBackground) {
    [
      'elemLocation',
      'elemAttendance',
      'elemGraduated',
      'hsLocation',
      'hsAttendance',
      'hsGraduated',
      'collegeLocation',
      'collegeAttendance',
      'collegeGraduated',
      'pgLocation',
      'pgCourseAttendance',
      'pgGraduated',
      'otherSchools',
      'civilServiceEligibility'
    ].forEach(function (fieldId) {
      record[fieldId] = '';
    });
  }

  if (skipSeminarsTraining) {
    record.seminarsTraining = [];
  }

  return record;
}

(async function bootstrap() {
  try {
    await loadFormPages();
    await loadAnalyticsPage();

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
    if (navAdmin) navAdmin.hidden = !isAdmin;
    if (btnAutoFillPhs) btnAutoFillPhs.disabled = !canEdit;

    var btnNew = document.getElementById('btn-new');
    if (btnNew) btnNew.disabled = !canEdit;

    if (isAdmin && adminView && window.adminApi) {
      initAdminUsersView({ adminViewEl: adminView, adminApi: window.adminApi });
    }

    /** @type {object|null} */
    var lastSummaryRecord = null;

    const { showPage, goNext, goPrev } = createFormNav(phsForm);

    function applyListChrome() {
      listView.classList.add('active');
      if (analyticsView) analyticsView.classList.remove('active');
      if (adminView) adminView.classList.remove('active');
      setActiveNav('list');
      setAppView('list');
      setTopbarSection(topbarSection, 'Personnel roster');
      loadList();
    }

    function openSummary(record) {
      if (!summaryModal || !summaryContent) return;
      lastSummaryRecord = record || null;
      summaryContent.innerHTML = buildSummaryHtml(record);
      summaryModal.classList.add('open');
      summaryModal.setAttribute('aria-hidden', 'false');
    }

    function closeSummary() {
      if (!summaryModal) return;
      lastSummaryRecord = null;
      summaryModal.classList.remove('open');
      summaryModal.setAttribute('aria-hidden', 'true');
    }

    function exportSummaryError(err) {
      console.error(err);
      alert('Export failed.\n\n' + (err && err.message ? err.message : String(err)));
    }

    if (summaryExportPdf) {
      summaryExportPdf.addEventListener('click', async function () {
        var rec = lastSummaryRecord;
        if (!rec) return;
        if (!window.exportApi) {
          alert('Export is not available. Restart the application.');
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
        alert('You do not have permission to create or edit personnel records.');
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
        alert('You do not have permission to view analytics.');
        return;
      }
      if (phsModalCtl.isOpen()) {
        if (!phsModalCtl.close(false)) return;
      }
      listView.classList.remove('active');
      if (analyticsView) analyticsView.classList.add('active');
      if (adminView) adminView.classList.remove('active');
      setActiveNav('analytics');
      setAppView('analytics');
      setTopbarSection(topbarSection, 'Reports');
      loadAllDataAndRender().catch(function () {
        renderAnalytics([]);
      });
    }

    function showAdminUsers() {
      if (!isAdmin) {
        alert('Admin access required.');
        return;
      }
      if (phsModalCtl && phsModalCtl.isOpen()) {
        phsModalCtl.close(false);
      }
      listView.classList.remove('active');
      if (analyticsView) analyticsView.classList.remove('active');
      if (adminView) adminView.classList.add('active');
      setActiveNav('admin');
      setAppView('admin');
      setTopbarSection(topbarSection, 'User management');
    }

    document.querySelectorAll('.nav-item').forEach(function (tab) {
      tab.addEventListener('click', function () {
        const which = tab.getAttribute('data-tab');
        if (which === 'list') showList();
        if (which === 'analytics') showAnalytics();
        if (which === 'admin') showAdminUsers();
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
          if (signaturePreview) {
            signaturePreview.src = raw;
            signaturePreview.style.display = 'block';
          }
          if (signaturePlaceholder) signaturePlaceholder.style.display = 'none';
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
      var isUpdate = !!(data && data.id);
      var confirmed = confirm(
        isUpdate
          ? 'Save changes to this personnel record?'
          : 'Save this new personnel record?'
      );
      if (!confirmed) return;
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
