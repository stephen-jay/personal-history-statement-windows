export const TOTAL_PAGES = 5;

export const FIELD_IDS = [
  'nameLast', 'nameFirst', 'nameMiddle', 'organization', 'presentJob', 'businessAddress', 'homeAddress',
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
  'hobbies', 'lieDetector', 'handwrittenEntryDataUrl', 'signatureDataUrl',
  'signedAtCert', 'signedDateCert', 'swornDay', 'swornMonth', 'swornPlace',
  'residenceCertNr2', 'residenceCertIssuedOn2', 'residenceCertIssuedAt2', 'administeringOfficer2',
  'photoDataUrl'
];

export const ROW_SECTIONS = [
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
