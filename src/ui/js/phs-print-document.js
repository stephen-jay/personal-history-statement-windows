/**
 * Official PHS layout for printing (aligned with paper / Word form).
 * Shown only in @media print; on screen the compact summary is visible.
 */
import { escapeHtml } from './escape.js';

/** Sample paragraph for handwriting exercise (Misc. — per standard PHS). */
export const HANDWRITING_SAMPLE =
  'As Luis E Repazo III of 105th Xavier Ave., Yale Mountain guzzled his way through three bottles of brandy, ' +
  'Josephine Z. Quinsing a partner in the law firm of San Diego and Ballesteros located at 2879 Valley Forge St., ' +
  'Quezon City turned to Richard Ting Sr., a chinese food expert from W. O. N. Kwantung Company Unltd., ' +
  '346 Hadji Jairul Hussein Blvd., and said: "I can\'t speak for my Government but I\'m quite sure your country ' +
  'and mine will be better together for closer understanding".';

const INSTRUCTIONS = [
  'Answer all the questions completely; If the question is not applicable, write "N/A". Write "UNKNOWN" only if you do not know the answer and cannot obtain the answer from personal records. Use the blank pages at the back of this form for extra details on any question for which you do not have sufficient space.',
  'Type, print or write carefully; illegible or incomplete forms will not receive consideration.',
  'WARNING: The correctness of all statements or entries made herein will be investigated. Any deliberate omission or distortion of material facts may give sufficient cause for denial of clearance.',
  'The statements made herein are classified CONFIDENTIAL. Revelation or use other than authorized is prohibited.'
];

function v(data, key) {
  var x = data && data[key];
  if (x == null || String(x).trim() === '') return '______________________________';
  return escapeHtml(String(x));
}

function joinData(data, keys) {
  var parts = keys.map(function (k) {
    var x = data && data[k];
    if (x == null || String(x).trim() === '') return '';
    return escapeHtml(String(x));
  }).filter(Boolean);
  return parts.length ? parts.join(' | ') : '______________________________';
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
    return '<div class="phs-print-block"><strong>' + escapeHtml(title) + '</strong>: N/A</div>';
  }
  return (
    '<div class="phs-print-block"><strong>' + escapeHtml(title) + '</strong>' +
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
    '<article class="phs-official-print phs-print-doc" aria-hidden="true">' +
    '<header class="phs-print-header">' +
    '<h1 class="phs-print-title">Personnel History Statement</h1>' +
    '</header>' +

    '<section class="phs-print-section phs-print-instructions">' +
    '<h2 class="phs-print-h2">Instructions</h2>' +
    '<ol class="phs-print-ol phs-print-instructions-ol">' +
    INSTRUCTIONS.map(function (t, i) {
      return '<li>' + escapeHtml(t) + '</li>';
    }).join('') +
    '</ol>' +
    '</section>' +

    '<section class="phs-print-section">' +
    '<h2 class="phs-print-h2">I. Personal Details</h2>' +
    '<table class="phs-print-table">' +
    '<tr><td colspan="3"><strong>A.</strong> Name — Last: ' +
    v(data, 'nameLast') +
    ' &nbsp; First: ' +
    v(data, 'nameFirst') +
    ' &nbsp; Middle/Maternal: ' +
    v(data, 'nameMiddle') +
    '</td></tr>' +
    '<tr><td colspan="3"><strong>C.</strong> Present Job/Assignment: ' + v(data, 'presentJob') + '</td></tr>' +
    '<tr><td colspan="3"><strong>D.</strong> Business or Duty Address: ' + v(data, 'businessAddress') + '</td></tr>' +
    '<tr><td colspan="3"><strong>E.</strong> Home Address (Street &amp; No.): ' + v(data, 'homeAddress') + '</td></tr>' +
    '<tr><td><strong>F.</strong> Date of Birth: ' + v(data, 'dateOfBirth') + '</td>' +
    '<td colspan="2"><strong>Place of Birth:</strong> ' + v(data, 'placeOfBirth') + '</td></tr>' +
    '<tr><td colspan="3"><strong>G.</strong> Change in Name (if by court action, give details): ' + v(data, 'changeInName') + '</td></tr>' +
    '<tr><td><strong>H.</strong> Nicknames: ' + v(data, 'nicknames') + '</td>' +
    '<td colspan="2">Nationality: ' + v(data, 'nationality') + '</td></tr>' +
    '<tr><td><strong>I.</strong> Tax Identification Nr.: ' + v(data, 'taxId') + '</td>' +
    '<td colspan="2">Tel. No.: ' + v(data, 'telNo') + '</td></tr>' +
    '<tr><td><strong>J.</strong> Mobile Phone Nr.: ' + v(data, 'mobile') + '</td>' +
    '<td colspan="2">Email Address: ' + v(data, 'email') + '</td></tr>' +
    '<tr><td><strong>K.</strong> Passport Nr.: ' + v(data, 'passportNr') + '</td>' +
    '<td colspan="2">Date of Expiration: ' + v(data, 'passportExpiry') + '</td></tr>' +
    '</table>' +
    '</section>' +

    '<section class="phs-print-section">' +
    '<h2 class="phs-print-h2">II. Personal Characteristics</h2>' +
    '<table class="phs-print-table">' +
    '<tr><td>Sex: ' + v(data, 'sex') + '</td><td>Age: ' + v(data, 'age') + '</td><td>Height (m): ' + v(data, 'height') + '</td><td>Weight (kgs): ' + v(data, 'weight') + '</td></tr>' +
    '<tr><td>Build: ' + v(data, 'build') + '</td><td>Complexion: ' + v(data, 'complexion') + '</td><td>Eyes: ' + v(data, 'colorEyes') + '</td><td>Hair: ' + v(data, 'colorHair') + '</td></tr>' +
    '<tr><td colspan="4">Scar/Marks / distinguishing features: ' + v(data, 'scarMarks') + '</td></tr>' +
    '<tr><td colspan="2">Present State of Health: ' + v(data, 'healthState') + '</td>' +
    '<td colspan="2">Recent Serious Illness: ' + v(data, 'recentIllness') + '</td></tr>' +
    '<tr><td colspan="4">Blood Type: ' + v(data, 'bloodType') + '</td></tr>' +
    '</table>' +
    '<div class="phs-print-sig-ii">' +
    '<div class="phs-print-sig-line"></div><p class="phs-print-sig-cap">(Signature of Applicant)</p>' +
    '<div class="phs-print-sig-line"></div><p class="phs-print-sig-cap">(Signature of Applicant)</p>' +
    '</div>' +
    '</section>' +

    '<section class="phs-print-section">' +
    '<h2 class="phs-print-h2">III. Marital History</h2>' +
    '<table class="phs-print-table">' +
    '<tr><td colspan="2">Marital Status: ' + v(data, 'maritalStatus') + '</td></tr>' +
    '<tr><td colspan="2">Name of Spouse: ' + v(data, 'spouseName') + '</td></tr>' +
    '<tr><td>Date &amp; Place of Marriage: ' + v(data, 'marriageDatePlace') + '</td><td>Spouse DOB: ' + v(data, 'spouseDob') + '</td></tr>' +
    '<tr><td colspan="2">Spouse Place of Birth / Occupation / Contact / Citizenship: ' +
    joinData(data, ['spousePlaceBirth', 'spouseOccupation', 'spouseContact', 'spouseCitizenship']) +
    '</td></tr>' +
    '</table>' +
    listRows('Children', data.children, function (row) {
      return escapeHtml(
        [row.name, row.dob, row.citizenshipAddress, row.fatherMother].filter(Boolean).join(' — ') || '—'
      );
    }) +
    '</section>' +

    '<section class="phs-print-section">' +
    '<h2 class="phs-print-h2">IV. Family History and Information</h2>' +
    '<p><strong>Father:</strong> ' + v(data, 'fatherName') + ' — DOB/Place: ' + v(data, 'fatherDobPlace') + ' — Address: ' + v(data, 'fatherAddress') + ' — Occupation: ' + v(data, 'fatherOccupation') + ' — Citizenship: ' + v(data, 'fatherCitizenship') + '</p>' +
    '<p><strong>Mother:</strong> ' + v(data, 'motherName') + ' — DOB/Place: ' + v(data, 'motherDobPlace') + ' — Address: ' + v(data, 'motherAddress') + ' — Occupation: ' + v(data, 'motherOccupation') + ' — Citizenship: ' + v(data, 'motherCitizenship') + '</p>' +
    '<p><strong>Brothers/Sisters:</strong> ' + joinData(data, ['siblingsName', 'siblingsDob', 'siblingsCitizenship', 'siblingsAddress', 'siblingsOccupation', 'siblingsEmployerAddress']) + '</p>' +
    '<p><strong>Step-parent/Guardian:</strong> ' + joinData(data, ['stepParentFullName', 'stepParentDob', 'stepParentAddress', 'stepParentOccupation', 'stepParentCitizenship']) + '</p>' +
    '<p><strong>Father-in-law:</strong> ' + joinData(data, ['fatherInLawFullName', 'fatherInLawDob', 'fatherInLawAddress', 'fatherInLawOccupation', 'fatherInLawCitizenship']) + '</p>' +
    '<p><strong>Mother-in-law:</strong> ' + joinData(data, ['motherInLawFullName', 'motherInLawDob', 'motherInLawAddress', 'motherInLawOccupation', 'motherInLawCitizenship']) + '</p>' +
    '</section>' +

    '<section class="phs-print-section">' +
    '<h2 class="phs-print-h2">V. Educational Background</h2>' +
    '<table class="phs-print-table phs-print-table-sm">' +
    '<tr><th></th><th>Location</th><th>Attendance</th><th>Year Graduated</th></tr>' +
    '<tr><td>Elementary</td><td>' + v(data, 'elemLocation') + '</td><td>' + v(data, 'elemAttendance') + '</td><td>' + v(data, 'elemGraduated') + '</td></tr>' +
    '<tr><td>High School</td><td>' + v(data, 'hsLocation') + '</td><td>' + v(data, 'hsAttendance') + '</td><td>' + v(data, 'hsGraduated') + '</td></tr>' +
    '<tr><td>College</td><td>' + v(data, 'collegeLocation') + '</td><td>' + v(data, 'collegeAttendance') + '</td><td>' + v(data, 'collegeGraduated') + '</td></tr>' +
    '<tr><td>Post Graduate</td><td>' + v(data, 'pgLocation') + '</td><td>' + v(data, 'pgCourseAttendance') + '</td><td>' + v(data, 'pgGraduated') + '</td></tr>' +
    '</table>' +
    '<p><strong>Other schools/training:</strong> ' + v(data, 'otherSchools') + '</p>' +
    '<p><strong>Civil service eligibility / similar:</strong> ' + v(data, 'civilServiceEligibility') + '</p>' +
    '</section>' +

    '<section class="phs-print-section">' +
    '<h2 class="phs-print-h2">VI. Places of Residence Since Birth</h2>' +
    listRows('Rows', data.placesOfResidence, function (row) {
      return escapeHtml([row.inclusiveDates, row.address].filter(Boolean).join(' — ') || '—');
    }) +
    '</section>' +

    '<section class="phs-print-section">' +
    '<h2 class="phs-print-h2">VII. Employment &amp; Training</h2>' +
    listRows('Employment history', data.employmentHistory, function (row) {
      return escapeHtml([row.inclusiveDate, row.type, row.employerAddress, row.reasonForLeaving].filter(Boolean).join(' — ') || '—');
    }) +
    listRows('Seminars &amp; training', data.seminarsTraining, function (row) {
      return escapeHtml([row.inclusiveDate, row.name, row.conductedBy, row.remarks].filter(Boolean).join(' — ') || '—');
    }) +
    '<p><strong>Dismissed or forced to resign?</strong> ' + v(data, 'dismissedResign') + '</p>' +
    '</section>' +

    '<section class="phs-print-section">' +
    '<h2 class="phs-print-h2">VIII. Foreign Countries Visited</h2>' +
    listRows('Visits', data.foreignCountries, function (row) {
      return escapeHtml([row.dateOfVisit, row.country, row.purpose, row.addressAbroad].filter(Boolean).join(' — ') || '—');
    }) +
    '</section>' +

    '<section class="phs-print-section">' +
    '<h2 class="phs-print-h2">IX. Credit Reputation</h2>' +
    ynLine('Entirely dependent on salary? If NO, state other source of income', data.salaryDependent) +
    listRows('Banks / credit institutions', data.banksCredit, function (row) {
      return escapeHtml([row.name, row.address, row.natureOfAccount].filter(Boolean).join(' — ') || '—');
    }) +
    '<p><strong>Statement of Assets &amp; Liabilities filed?</strong> ' + v(data, 'salFiled') + '</p>' +
    '<p><strong>Income tax return (last calendar year):</strong> ' + v(data, 'incomeTaxFiled') + '</p>' +
    listRows('Three credit references', data.creditReferences, function (row) {
      return escapeHtml([row.name, row.address].filter(Boolean).join(' — ') || '—');
    }) +
    '</section>' +

    '<section class="phs-print-section">' +
    '<h2 class="phs-print-h2">X. Arrest Record and Conduct</h2>' +
    '<p>' + v(data, 'arrestRecord') + '</p>' +
    '<p><strong>Family member:</strong> ' + v(data, 'familyArrest') + '</p>' +
    '<p><strong>Administrative case:</strong> ' + v(data, 'adminCase') + '</p>' +
    '<p><strong>PD 1081:</strong> ' + v(data, 'pd1081') + '</p>' +
    '<p><strong>Liquor / drugs:</strong> ' + v(data, 'liquorDrugs') + '</p>' +
    '</section>' +

    '<section class="phs-print-section">' +
    '<h2 class="phs-print-h2">XI. General Reputation</h2>' +
    listRows('Character references', data.characterRefs, function (row) {
      return escapeHtml([row.name, row.address].filter(Boolean).join(' — ') || '—');
    }) +
    listRows('Neighbors', data.neighbors, function (row) {
      return escapeHtml([row.name, row.address].filter(Boolean).join(' — ') || '—');
    }) +
    '</section>' +

    '<section class="phs-print-section">' +
    '<h2 class="phs-print-h2">XII. Organizations</h2>' +
    listRows('Organizations', data.organizations, function (row) {
      return escapeHtml([row.organization, row.address, row.membershipDate, row.positionHeld].filter(Boolean).join(' — ') || '—');
    }) +
    '</section>' +

    '<section class="phs-print-section phs-print-section-misc">' +
    '<h2 class="phs-print-h2">XIII. Miscellaneous</h2>' +
    '<p><strong>Hobbies / sports / pastimes:</strong> ' + v(data, 'hobbies') + '</p>' +
    listRows('Languages', data.languages, function (row) {
      return escapeHtml([row.languageDialect, row.speak, row.read, row.write].filter(Boolean).join(' — ') || '—');
    }) +
    ynLine('Willing to undergo periodic lie detector test?', data.lieDetector) +

    '<div class="phs-print-handwriting">' +
    '<p class="phs-print-handwriting-title"><strong>G. Copy exactly the following paragraph in your own handwriting:</strong></p>' +
    '<p class="phs-print-handwriting-sample">' + escapeHtml(HANDWRITING_SAMPLE) + '</p>' +
    '<div class="phs-print-handwriting-lines">' +
    '<div class="phs-print-hw-line"></div><div class="phs-print-hw-line"></div><div class="phs-print-hw-line"></div>' +
    '</div></div>' +

    '<div class="phs-print-certify">' +
    '<p>I certify that the following answers are true and correct to the best of my knowledge and belief and I agree that my misstatement or omission as to material facts will constitute ground for denial of my application for clearance.</p>' +
    '</div>' +

    '<div class="phs-print-signatures">' +
    '<table class="phs-print-table phs-print-sign-table"><tr>' +
    '<td class="phs-print-sign-left">Signed at: ' + v(data, 'signedAtCert') + '<br/>Date: ' + v(data, 'signedDateCert') + '</td>' +
    '<td class="phs-print-sign-right">' +
    '<div class="phs-print-sig-line"></div><p class="phs-print-sig-cap">(Signature of Applicant)</p>' +
    '<div class="phs-print-sig-line"></div><p class="phs-print-sig-cap">Witness</p>' +
    '<div class="phs-print-sig-line"></div><p class="phs-print-sig-cap">Witness</p>' +
    '</td></tr></table>' +
    '</div>' +

    '<div class="phs-print-thumb-photo">' +
    '<table class="phs-print-table"><tr>' +
    '<td class="phs-print-thumb-cell"><strong>THUMB MARK</strong><br/>' +
    '<div class="phs-print-thumb-pair"><span class="phs-print-thumb-box"></span> (Left) &nbsp; <span class="phs-print-thumb-box"></span> (Right)</div></td>' +
    '<td class="phs-print-photo-cell"><strong>2×2 Photo — Passport size</strong><br/>' +
    (data.photoDataUrl
      ? '<img class="phs-print-photo-img" src="' + escapeHtml(data.photoDataUrl) + '" alt="Photo" />'
      : '<div class="phs-print-photo-placeholder">Photo on file / attach printout</div>') +
    '</td></tr></table>' +
    '</div>' +

    '<div class="phs-print-sworn">' +
    '<p><strong>Subscribed and sworn before me</strong> this ' + v(data, 'swornDay') + ' day of ' + v(data, 'swornMonth') + ', Philippines.</p>' +
    '<p>Place: ' + v(data, 'swornPlace') + '</p>' +
    '<table class="phs-print-table">' +
    '<tr><td>Residence Certificate Nr.: ' + v(data, 'residenceCertNr2') + '</td>' +
    '<td>Issued on: ' + v(data, 'residenceCertIssuedOn2') + '</td>' +
    '<td>Issued at: ' + v(data, 'residenceCertIssuedAt2') + '</td></tr>' +
    '</table>' +
    '<p><strong>Administering Officer:</strong> ' + v(data, 'administeringOfficer2') + '</p>' +
    '<div class="phs-print-sig-line phs-print-sig-line-wide"></div>' +
    '<p class="phs-print-sig-cap">Signature / stamp</p>' +
    '</div>' +

    '</section>' +
    '</article>'
  );
}
