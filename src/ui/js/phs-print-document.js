/**
 * Official PHS layout matching the structure and wording of PERSONNEL HISTORY STATEMENT.docx
 * (government form: Personal Details grid with lettered rows A–K.)
 */
import { escapeHtml } from './escape.js';

/** Sample paragraph for handwriting exercise (Misc. — per standard PHS). */
export const HANDWRITING_SAMPLE =
  'As Luis E Repazo III of 105th Xavier Ave., Yale Mountain guzzled his way through three bottles of brandy, ' +
  'Josephine Z. Quinsing a partner in the law firm of San Diego and Ballesteros located at 2879 Valley Forge St., ' +
  'Quezon City turned to Richard Ting Sr., a chinese food expert from W. O. N. Kwantung Company Unltd., ' +
  '346 Hadji Jairul Hussein Blvd., and said: "I can\'t speak for my Government but I\'m quite sure your country ' +
  'and mine will be better together for closer understanding".';

function v(data, key) {
  var x = data && data[key];
  if (x == null || String(x).trim() === '') {
    return '<span class="phs-print-placeholder">—</span>';
  }
  return '<span class="phs-print-val">' + escapeHtml(String(x)) + '</span>';
}

/** Table cell: filled value or ruled blank (matches underlined fields in the Word form). */
function c(data, key) {
  var x = data && data[key];
  if (x == null || String(x).trim() === '') {
    return '<span class="phs-print-cell-line">&nbsp;</span>';
  }
  return '<span class="phs-print-val">' + escapeHtml(String(x)) + '</span>';
}

function joinData(data, keys) {
  var parts = keys.map(function (k) {
    var x = data && data[k];
    if (x == null || String(x).trim() === '') return '';
    return escapeHtml(String(x));
  }).filter(Boolean);
  if (!parts.length) return '<span class="phs-print-placeholder">—</span>';
  return '<span class="phs-print-val">' + parts.join(' · ') + '</span>';
}

function charCell(label, data, key) {
  return (
    '<td class="phs-char-cell">' +
    '<span class="phs-print-field-label">' + escapeHtml(label) + '</span>' +
    '<div class="phs-char-value">' + v(data, key) + '</div></td>'
  );
}

function ynLine(label, value) {
  var s = (value == null ? '' : String(value)).trim().toLowerCase();
  var yes = s === 'yes' || s === 'y' || s.indexOf('yes') === 0;
  var no = s === 'no' || s === 'n' || s.indexOf('no') === 0;
  var yMark = yes ? '☒' : '☐';
  var nMark = no ? '☒' : '☐';
  return (
    '<div class="phs-print-yn">' +
    '<span class="phs-print-yn-label">' + escapeHtml(label) + '</span> ' +
    '<span class="phs-print-yn-opt">YES ' + yMark + '</span> ' +
    '<span class="phs-print-yn-opt">NO ' + nMark + '</span> ' +
    '<span class="phs-print-yn-detail">' + (value && !yes && !no ? escapeHtml(String(value)) : '') + '</span>' +
    '</div>'
  );
}

function listRows(title, rows, formatRow) {
  if (!Array.isArray(rows) || !rows.length) {
    return '<div class="phs-print-block phs-print-list-block"><span class="phs-print-list-title">' + escapeHtml(title) + '</span><span class="phs-print-placeholder">None listed</span></div>';
  }
  return (
    '<div class="phs-print-block phs-print-list-block"><span class="phs-print-list-title">' + escapeHtml(title) + '</span>' +
    '<ol class="phs-print-ol">' +
    rows
      .map(function (row) {
        return '<li>' + formatRow(row) + '</li>';
      })
      .join('') +
    '</ol></div>'
  );
}

/**
 * @param {object} data Record from API / form
 */
export function buildOfficialPrintHtml(data) {
  data = data || {};
  return (
    '<article class="phs-official-print phs-print-doc phs-print-doc--readable">' +
    '<header class="phs-print-header">' +
    '<div class="phs-print-header-main">' +
    '<div class="phs-print-header-text">' +
    '<h1 class="phs-print-title">Personnel History Statement</h1>' +
    '<p class="phs-print-header-subtitle">' + escapeHtml(String(data.fullName || '').trim() || 'Personnel Profile') + '</p>' +
    '<p class="phs-print-header-meta">' +
    '<span>' + (data.organization ? escapeHtml(String(data.organization)) : 'Organization not set') + '</span>' +
    '<span> | </span>' +
    '<span>' + (data.presentJob ? escapeHtml(String(data.presentJob)) : 'Position not set') + '</span>' +
    '</p>' +
    '</div>' +
    '<div class="phs-print-header-photo">' +
    (data.photoDataUrl
      ? '<img class="phs-print-photo-img phs-print-photo-img--header" src="' + escapeHtml(data.photoDataUrl) + '" alt="2x2 photo" />'
      : '<div class="phs-print-photo-placeholder phs-print-photo-placeholder--header">2x2 Photo</div>') +
    '</div>' +
    '</div>' +
    '</header>' +

    '<section class="phs-print-section">' +
    '<h2 class="phs-print-h2 phs-print-h2--section">I. PERSONAL DETAILS</h2>' +
    '<table class="phs-print-table phs-print-i-table">' +
    '<tr>' +
    '<td rowspan="3" class="phs-td-letter">A.</td>' +
    '<td colspan="6" class="phs-td-prompt-wide">Name</td>' +
    '</tr>' +
    '<tr class="phs-name-row">' +
    '<td colspan="2" class="phs-td-underline">' + c(data, 'nameLast') + '</td>' +
    '<td colspan="2" class="phs-td-underline">' + c(data, 'nameFirst') + '</td>' +
    '<td colspan="2" class="phs-td-underline">' + c(data, 'nameMiddle') + '</td>' +
    '</tr>' +
    '<tr class="phs-caption-row">' +
    '<td colspan="2" class="phs-caption">(Last)</td>' +
    '<td colspan="2" class="phs-caption">(First)</td>' +
    '<td colspan="2" class="phs-caption">(Middle/Maternal)</td>' +
    '</tr>' +
    '<tr class="phs-job-row">' +
    '<td class="phs-td-letter">B.</td>' +
    '<td colspan="2" class="phs-td-prompt">PRESENT JOB/ASSIGNMENT:</td>' +
    '<td class="phs-td-underline" colspan="4">' + c(data, 'presentJob') + '</td>' +
    '</tr>' +
    '<tr>' +
    '<td class="phs-td-letter">C.</td>' +
    '<td colspan="2" class="phs-td-prompt">BUSINESS OR DUTY ADDRESS:</td>' +
    '<td class="phs-td-underline" colspan="4">' + c(data, 'businessAddress') + '</td>' +
    '</tr>' +
    '<tr>' +
    '<td class="phs-td-letter">D.</td>' +
    '<td colspan="2" class="phs-td-prompt">HOME ADDRESS (Include Street &amp; No.):</td>' +
    '<td class="phs-td-underline" colspan="4">' + c(data, 'homeAddress') + '</td>' +
    '</tr>' +
    '<tr>' +
    '<td class="phs-td-letter">E.</td>' +
    '<td colspan="2" class="phs-td-prompt">DATE OF BIRTH:</td>' +
    '<td class="phs-td-underline" colspan="2">' + c(data, 'dateOfBirth') + '</td>' +
    '<td class="phs-td-prompt-tight">PLACE OF BIRTH:</td>' +
    '<td class="phs-td-underline">' + c(data, 'placeOfBirth') + '</td>' +
    '</tr>' +
    '<tr>' +
    '<td class="phs-td-letter">F.</td>' +
    '<td colspan="2" class="phs-td-prompt">CHANGE IN NAME (If by Court Action give details):</td>' +
    '<td class="phs-td-underline" colspan="4">' + c(data, 'changeInName') + '</td>' +
    '</tr>' +
    '<tr>' +
    '<td class="phs-td-letter">&nbsp;</td>' +
    '<td class="phs-td-prompt-tight">NICKNAMES:</td>' +
    '<td class="phs-td-underline" colspan="2">' + c(data, 'nicknames') + '</td>' +
    '<td colspan="2" class="phs-td-prompt">NATIONALITY:</td>' +
    '<td class="phs-td-underline">' + c(data, 'nationality') + '</td>' +
    '</tr>' +
    '<tr>' +
    '<td class="phs-td-letter">H.</td>' +
    '<td class="phs-td-prompt-tight">TAX IDENTIFICATION NR.:</td>' +
    '<td class="phs-td-underline" colspan="2">' + c(data, 'taxId') + '</td>' +
    '<td colspan="2" class="phs-td-prompt">TEL. NO.:</td>' +
    '<td class="phs-td-underline">' + c(data, 'telNo') + '</td>' +
    '</tr>' +
    '<tr>' +
    '<td class="phs-td-letter">I.</td>' +
    '<td class="phs-td-prompt-tight">MOBILE PHONE NR.:</td>' +
    '<td class="phs-td-underline" colspan="2">' + c(data, 'mobile') + '</td>' +
    '<td colspan="2" class="phs-td-prompt">EMAIL ADDRESS:</td>' +
    '<td class="phs-td-underline">' + c(data, 'email') + '</td>' +
    '</tr>' +
    '<tr>' +
    '<td class="phs-td-letter">J.</td>' +
    '<td class="phs-td-prompt-tight">PASSPORT NR.:</td>' +
    '<td class="phs-td-underline" colspan="2">' + c(data, 'passportNr') + '</td>' +
    '<td colspan="2" class="phs-td-prompt">DATE OF EXPIRATION:</td>' +
    '<td class="phs-td-underline">' + c(data, 'passportExpiry') + '</td>' +
    '</tr>' +
    '</table>' +
    '</section>' +

    '<section class="phs-print-section">' +
    '<h2 class="phs-print-h2 phs-print-h2--section">II. PERSONAL CHARACTERISTICS</h2>' +
    '<table class="phs-print-table phs-char-table">' +
    '<tr class="phs-char-row">' +
    charCell('Sex', data, 'sex') +
    charCell('Age', data, 'age') +
    charCell('Height (m)', data, 'height') +
    charCell('Weight (kg)', data, 'weight') +
    '</tr>' +
    '<tr class="phs-char-row">' +
    charCell('Build', data, 'build') +
    charCell('Complexion', data, 'complexion') +
    charCell('Eyes', data, 'colorEyes') +
    charCell('Hair', data, 'colorHair') +
    '</tr>' +
    '<tr><td colspan="4" class="phs-char-cell phs-char-cell--block">' +
    '<span class="phs-print-field-label">Scar, marks, or distinguishing features</span>' +
    '<div class="phs-char-value">' + v(data, 'scarMarks') + '</div></td></tr>' +
    '<tr class="phs-char-row">' +
    charCell('Present state of health', data, 'healthState') +
    charCell('Recent serious illness', data, 'recentIllness') +
    '<td class="phs-char-cell phs-char-cell--span2" colspan="2">' +
    '<span class="phs-print-field-label">Blood type</span>' +
    '<div class="phs-char-value">' + v(data, 'bloodType') + '</div></td>' +
    '</tr>' +
    '</table>' +
    '<div class="phs-print-sig-ii">' +
    '<div class="phs-print-sig-line"></div><p class="phs-print-sig-cap">(Signature of Applicant)</p>' +
    '<div class="phs-print-sig-line"></div><p class="phs-print-sig-cap">(Signature of Applicant)</p>' +
    '</div>' +
    '</section>' +

    '<section class="phs-print-section">' +
    '<h2 class="phs-print-h2 phs-print-h2--section">III. MARITAL HISTORY</h2>' +
    '<table class="phs-print-table phs-stack-table">' +
    '<tr><th scope="row" class="phs-stack-label">Marital status</th><td class="phs-stack-value">' + v(data, 'maritalStatus') + '</td></tr>' +
    '<tr><th scope="row" class="phs-stack-label">Name of spouse</th><td class="phs-stack-value">' + v(data, 'spouseName') + '</td></tr>' +
    '<tr><th scope="row" class="phs-stack-label">Date &amp; place of marriage</th><td class="phs-stack-value">' + v(data, 'marriageDatePlace') + '</td></tr>' +
    '<tr><th scope="row" class="phs-stack-label">Spouse date of birth</th><td class="phs-stack-value">' + v(data, 'spouseDob') + '</td></tr>' +
    '<tr><th scope="row" class="phs-stack-label">Spouse (place of birth, occupation, contact, citizenship)</th><td class="phs-stack-value">' +
    joinData(data, ['spousePlaceBirth', 'spouseOccupation', 'spouseContact', 'spouseCitizenship']) +
    '</td></tr>' +
    '</table>' +
    listRows('Children', data.children, function (row) {
      return escapeHtml(
        [row.name, row.dob, row.citizenshipAddress, row.fatherMother].filter(Boolean).join(' — ') || '—'
      );
    }) +
    '</section>' +

    '<section class="phs-print-section phs-print-section--prose">' +
    '<h2 class="phs-print-h2 phs-print-h2--section">IV. FAMILY HISTORY AND INFORMATION</h2>' +
    '<div class="phs-print-kv-block"><span class="phs-print-kv-label">Father</span><div class="phs-print-kv-text">' + v(data, 'fatherName') + ' · DOB/place: ' + v(data, 'fatherDobPlace') + ' · Address: ' + v(data, 'fatherAddress') + ' · Occupation: ' + v(data, 'fatherOccupation') + ' · Citizenship: ' + v(data, 'fatherCitizenship') + '</div></div>' +
    '<div class="phs-print-kv-block"><span class="phs-print-kv-label">Mother</span><div class="phs-print-kv-text">' + v(data, 'motherName') + ' · DOB/place: ' + v(data, 'motherDobPlace') + ' · Address: ' + v(data, 'motherAddress') + ' · Occupation: ' + v(data, 'motherOccupation') + ' · Citizenship: ' + v(data, 'motherCitizenship') + '</div></div>' +
    '<div class="phs-print-kv-block"><span class="phs-print-kv-label">Brothers / sisters</span><div class="phs-print-kv-text">' + joinData(data, ['siblingsName', 'siblingsDob', 'siblingsCitizenship', 'siblingsAddress', 'siblingsOccupation', 'siblingsEmployerAddress']) + '</div></div>' +
    '<div class="phs-print-kv-block"><span class="phs-print-kv-label">Step-parent / guardian</span><div class="phs-print-kv-text">' + joinData(data, ['stepParentFullName', 'stepParentDob', 'stepParentAddress', 'stepParentOccupation', 'stepParentCitizenship']) + '</div></div>' +
    '<div class="phs-print-kv-block"><span class="phs-print-kv-label">Father-in-law</span><div class="phs-print-kv-text">' + joinData(data, ['fatherInLawFullName', 'fatherInLawDob', 'fatherInLawAddress', 'fatherInLawOccupation', 'fatherInLawCitizenship']) + '</div></div>' +
    '<div class="phs-print-kv-block"><span class="phs-print-kv-label">Mother-in-law</span><div class="phs-print-kv-text">' + joinData(data, ['motherInLawFullName', 'motherInLawDob', 'motherInLawAddress', 'motherInLawOccupation', 'motherInLawCitizenship']) + '</div></div>' +
    '</section>' +

    '<section class="phs-print-section">' +
    '<h2 class="phs-print-h2 phs-print-h2--section">V. EDUCATIONAL BACKGROUND</h2>' +
    '<table class="phs-print-table phs-print-table-sm phs-edu-table">' +
    '<thead><tr><th scope="col" class="phs-edu-h"></th><th scope="col" class="phs-edu-h">Location</th><th scope="col" class="phs-edu-h">Attendance</th><th scope="col" class="phs-edu-h">Year graduated</th></tr></thead><tbody>' +
    '<tr><th scope="row" class="phs-edu-level">Elementary</th><td>' + v(data, 'elemLocation') + '</td><td>' + v(data, 'elemAttendance') + '</td><td>' + v(data, 'elemGraduated') + '</td></tr>' +
    '<tr><th scope="row" class="phs-edu-level">High school</th><td>' + v(data, 'hsLocation') + '</td><td>' + v(data, 'hsAttendance') + '</td><td>' + v(data, 'hsGraduated') + '</td></tr>' +
    '<tr><th scope="row" class="phs-edu-level">College</th><td>' + v(data, 'collegeLocation') + '</td><td>' + v(data, 'collegeAttendance') + '</td><td>' + v(data, 'collegeGraduated') + '</td></tr>' +
    '<tr><th scope="row" class="phs-edu-level">Post graduate</th><td>' + v(data, 'pgLocation') + '</td><td>' + v(data, 'pgCourseAttendance') + '</td><td>' + v(data, 'pgGraduated') + '</td></tr>' +
    '</tbody></table>' +
    '<div class="phs-print-kv-block"><span class="phs-print-kv-label">Other schools / training</span><div class="phs-print-kv-text">' + v(data, 'otherSchools') + '</div></div>' +
    '<div class="phs-print-kv-block"><span class="phs-print-kv-label">Civil service eligibility &amp; similar qualifications</span><div class="phs-print-kv-text">' + v(data, 'civilServiceEligibility') + '</div></div>' +
    '</section>' +

    '<section class="phs-print-section">' +
    '<h2 class="phs-print-h2 phs-print-h2--section">VI. PLACES OF RESIDENCE SINCE BIRTH</h2>' +
    listRows('Rows', data.placesOfResidence, function (row) {
      return escapeHtml([row.inclusiveDates, row.address].filter(Boolean).join(' — ') || '—');
    }) +
    '</section>' +

    '<section class="phs-print-section">' +
    '<h2 class="phs-print-h2 phs-print-h2--section">VII. EMPLOYMENT &amp; TRAINING</h2>' +
    listRows('Employment history', data.employmentHistory, function (row) {
      return escapeHtml([row.inclusiveDate, row.type, row.employerAddress, row.reasonForLeaving].filter(Boolean).join(' — ') || '—');
    }) +
    listRows('Seminars &amp; training', data.seminarsTraining, function (row) {
      return escapeHtml([row.inclusiveDate, row.name, row.conductedBy, row.remarks].filter(Boolean).join(' — ') || '—');
    }) +
    '<div class="phs-print-kv-block"><span class="phs-print-kv-label">Dismissed or forced to resign?</span><div class="phs-print-kv-text">' + v(data, 'dismissedResign') + '</div></div>' +
    '</section>' +

    '<section class="phs-print-section">' +
    '<h2 class="phs-print-h2 phs-print-h2--section">VIII. FOREIGN COUNTRIES VISITED</h2>' +
    listRows('Visits', data.foreignCountries, function (row) {
      return escapeHtml([row.dateOfVisit, row.country, row.purpose, row.addressAbroad].filter(Boolean).join(' — ') || '—');
    }) +
    '</section>' +

    '<section class="phs-print-section">' +
    '<h2 class="phs-print-h2 phs-print-h2--section">IX. CREDIT REPUTATION</h2>' +
    ynLine('Entirely dependent on salary? If NO, state other source of income', data.salaryDependent) +
    listRows('Banks / credit institutions', data.banksCredit, function (row) {
      return escapeHtml([row.name, row.address, row.natureOfAccount].filter(Boolean).join(' — ') || '—');
    }) +
    '<div class="phs-print-kv-block"><span class="phs-print-kv-label">Statement of assets &amp; liabilities filed</span><div class="phs-print-kv-text">' + v(data, 'salFiled') + '</div></div>' +
    '<div class="phs-print-kv-block"><span class="phs-print-kv-label">Income tax return (last calendar year)</span><div class="phs-print-kv-text">' + v(data, 'incomeTaxFiled') + '</div></div>' +
    listRows('Three credit references', data.creditReferences, function (row) {
      return escapeHtml([row.name, row.address].filter(Boolean).join(' — ') || '—');
    }) +
    '</section>' +

    '<section class="phs-print-section phs-print-section--prose">' +
    '<h2 class="phs-print-h2 phs-print-h2--section">X. ARREST RECORD AND CONDUCT</h2>' +
    '<div class="phs-print-kv-block"><span class="phs-print-kv-label">Ever investigated, arrested, indicted, or convicted? (If yes: court, offense, disposition)</span><div class="phs-print-kv-text">' + v(data, 'arrestRecord') + '</div></div>' +
    '<div class="phs-print-kv-block"><span class="phs-print-kv-label">Immediate family member investigated or arrested?</span><div class="phs-print-kv-text">' + v(data, 'familyArrest') + '</div></div>' +
    '<div class="phs-print-kv-block"><span class="phs-print-kv-label">Charged in any administrative case?</span><div class="phs-print-kv-text">' + v(data, 'adminCase') + '</div></div>' +
    '<div class="phs-print-kv-block"><span class="phs-print-kv-label">Arrested or detained under PD 1081?</span><div class="phs-print-kv-text">' + v(data, 'pd1081') + '</div></div>' +
    '<div class="phs-print-kv-block"><span class="phs-print-kv-label">Use of intoxicating liquor or illegal drugs</span><div class="phs-print-kv-text">' + v(data, 'liquorDrugs') + '</div></div>' +
    '</section>' +

    '<section class="phs-print-section">' +
    '<h2 class="phs-print-h2 phs-print-h2--section">XI. GENERAL REPUTATION</h2>' +
    listRows('Character references', data.characterRefs, function (row) {
      return escapeHtml([row.name, row.address].filter(Boolean).join(' — ') || '—');
    }) +
    listRows('Neighbors', data.neighbors, function (row) {
      return escapeHtml([row.name, row.address].filter(Boolean).join(' — ') || '—');
    }) +
    '</section>' +

    '<section class="phs-print-section">' +
    '<h2 class="phs-print-h2 phs-print-h2--section">XII. ORGANIZATIONS</h2>' +
    listRows('Organizations', data.organizations, function (row) {
      return escapeHtml([row.organization, row.address, row.membershipDate, row.positionHeld].filter(Boolean).join(' — ') || '—');
    }) +
    '</section>' +

    '<section class="phs-print-section phs-print-section-misc">' +
    '<h2 class="phs-print-h2 phs-print-h2--section">XIII. MISCELLANEOUS</h2>' +
    '<div class="phs-print-kv-block"><span class="phs-print-kv-label">Hobbies, sports, pastimes</span><div class="phs-print-kv-text">' + v(data, 'hobbies') + '</div></div>' +
    listRows('Languages', data.languages, function (row) {
      return escapeHtml([row.languageDialect, row.speak, row.read, row.write].filter(Boolean).join(' — ') || '—');
    }) +
    ynLine('Willing to undergo periodic lie detector test?', data.lieDetector) +

    '<div class="phs-print-handwriting">' +
    '<p class="phs-print-handwriting-title"><strong>Copy exactly the following paragraph in your own handwriting:</strong></p>' +
    '<p class="phs-print-handwriting-sample">' + escapeHtml(HANDWRITING_SAMPLE) + '</p>' +
    (data.handwrittenDataUrl
      ? '<img class="phs-print-handwriting-uploaded" src="' + escapeHtml(data.handwrittenDataUrl) + '" alt="Uploaded handwritten sample" />'
      : '<div class="phs-print-handwriting-uploaded phs-print-handwriting-uploaded--empty">No handwritten upload attached.</div>') +
    '<div class="phs-print-handwriting-lines">' +
    '<div class="phs-print-hw-line"></div><div class="phs-print-hw-line"></div><div class="phs-print-hw-line"></div>' +
    '</div></div>' +

    '<div class="phs-print-certify">' +
    '<p>I certify that the following answers are true and correct to the best of my knowledge and belief and I agree that my misstatement or omission as to material facts will constitute ground for denial of my application for clearance.</p>' +
    '</div>' +

    '<div class="phs-print-id-block">' +
    '<div class="phs-print-id-left">' +
    '<div class="phs-print-signatures">' +
    '<div class="phs-print-sig-line"></div><p class="phs-print-sig-cap">(Signature of Applicant)</p>' +
    '</div>' +
    '</div>' +
    '<div class="phs-print-id-right">' +
    '<div class="phs-print-photo-cell"><strong>2×2 Photo — Passport size</strong><br/>' +
    (data.photoDataUrl
      ? '<img class="phs-print-photo-img" src="' + escapeHtml(data.photoDataUrl) + '" alt="Photo" />'
      : '<div class="phs-print-photo-placeholder">Photo on file / attach printout</div>') +
    '</div>' +
    '<div class="phs-print-thumb-cell"><strong>Thumb mark</strong><br/>' +
    '<div class="phs-print-thumb-pair"><span class="phs-print-thumb-box"></span> (Left) &nbsp; <span class="phs-print-thumb-box"></span> (Right)</div></div>' +
    '</div>' +
    '</div>' +

    '</section>' +
    '</article>'
  );
}
