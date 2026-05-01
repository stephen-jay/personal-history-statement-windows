import { FIELD_IDS, ROW_SECTIONS } from './constants.js';

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom(values) {
  return values[randomInt(0, values.length - 1)];
}

function maybeNA(value, chance) {
  return Math.random() < (chance == null ? 0.25 : chance) ? 'N/A' : value;
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
    organization: pickRandom(['DepEd', 'DOH', 'PNP', 'AFP']),
    presentJob: pickRandom(['Operations Analyst', 'Administrative Officer', 'Data Compliance Associate']),
    businessAddress: seed.businessAddress,
    homeAddress: seed.homeAddress,
    dateOfBirth: seed.dob,
    placeOfBirth: seed.placeOfBirth,
    changeInName: maybeNA('N/A', 0.6),
    nicknames: pickRandom(['J', 'Ace', 'MJ', 'Pat', 'N/A']),
    nationality: 'Filipino',
    taxId: String(randomInt(100, 999)) + '-' + String(randomInt(100, 999)) + '-' + String(randomInt(100, 999)) + '-' + String(randomInt(1000, 9999)),
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

  const uploadFieldIds = new Set([
    'handwrittenEntryDataUrl',
    'leftThumbMarkDataUrl',
    'rightThumbMarkDataUrl',
    'signatureDataUrl',
    'photoDataUrl'
  ]);

  const nullableFieldIds = new Set([
    'changeInName',
    'nicknames',
    'spousePlaceBirth',
    'spouseOccupation',
    'spouseContact',
    'stepParentFullName',
    'stepParentDob',
    'stepParentAddress',
    'stepParentOccupation',
    'stepParentCitizenship',
    'fatherInLawFullName',
    'fatherInLawDob',
    'fatherInLawAddress',
    'fatherInLawOccupation',
    'fatherInLawCitizenship',
    'motherInLawFullName',
    'motherInLawDob',
    'motherInLawAddress',
    'motherInLawOccupation',
    'motherInLawCitizenship',
    'recentIllness',
    'dismissedResign',
    'salaryDependent',
    'salFiled',
    'incomeTaxFiled',
    'arrestRecord',
    'familyArrest',
    'adminCase',
    'pd1081',
    'liquorDrugs',
    'signedAtCert',
    'signedDateCert',
    'swornDay',
    'swornMonth',
    'swornPlace',
    'residenceCertNr2',
    'residenceCertIssuedOn2',
    'residenceCertIssuedAt2',
    'administeringOfficer2'
  ]);

  if (fieldId === 'photoDataUrl') {
    return '';
  }

  if (fieldId === 'handwrittenEntryDataUrl') {
    return '';
  }

  if (uploadFieldIds.has(fieldId)) return '';

  if (Object.prototype.hasOwnProperty.call(fixed, fieldId)) {
    return nullableFieldIds.has(fieldId) ? maybeNA(fixed[fieldId], 0.18) : fixed[fieldId];
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

  record.signatureDataUrl = '';
  record.leftThumbMarkDataUrl = '';
  record.rightThumbMarkDataUrl = '';
  record.handwrittenEntryDataUrl = '';
  record.photoDataUrl = '';

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


export { buildAutoFillRecord };
