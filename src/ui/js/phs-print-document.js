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

/** Wording aligned with the official Word template (PERSONNEL HISTORY STATEMENT.docx). */
const INSTRUCTIONS = [
  'Answer all the questions completely; If the question is not applicable, write "N/A". Write "UNKNOWN" only if you do not know the answer and cannot obtain the answer from personal records. Use the blank pages at the back of this form for extra details on any question for which you do not have sufficient space.',
  'Type, print or write carefully; illegible or incomplete forms will not receive consideration.',
  'WARNING: The correctness of all statements of entries made herein will be investigated.',
  'Any deliberate omission or distortion of material facts may give sufficient cause for denial of clearance.',
  'The statements made herein are classified CONFIDENTIAL. Revelation or use other than the authorized is prohibited.'
];

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

function raw(data, key) {
  var x = data && data[key];
  if (x == null || String(x).trim() === '') return '';
  return String(x).trim();
}

function displayNameNatural(data) {
  var parts = [raw(data, 'nameFirst'), raw(data, 'nameMiddle'), raw(data, 'nameLast')].filter(Boolean);
  if (parts.length) return parts.join(' ');
  return raw(data, 'fullName') || '';
}

function initialsFromName(data) {
  var f = raw(data, 'nameFirst');
  var l = raw(data, 'nameLast');
  var seed = (f ? f.charAt(0) : '') + (l ? l.charAt(0) : '');
  var initials = seed.toUpperCase();
  if (!initials) initials = 'NA';
  return initials;
}

function modernItem(iconClass, label, valueHtml) {
  return (
    '<div class="phs-personal-modern-item">' +
    '<span class="phs-personal-modern-icon ' + iconClass + '" aria-hidden="true"></span>' +
    '<div class="phs-personal-modern-item-body">' +
    '<span class="phs-personal-modern-label">' + escapeHtml(label) + '</span>' +
    '<span class="phs-personal-modern-value">' + valueHtml + '</span>' +
    '</div>' +
    '</div>'
  );
}

function modernLine(iconClass, label, valueHtml, extraClass) {
  var cls = 'phs-modern-line' + (extraClass ? ' ' + extraClass : '');
  return (
    '<div class="' + cls + '">' +
    '<span class="phs-modern-line-icon ' + iconClass + '" aria-hidden="true"></span>' +
    '<span class="phs-modern-line-label">' + escapeHtml(label) + ':</span>' +
    '<span class="phs-modern-line-value">' + valueHtml + '</span>' +
    '</div>'
  );
}

function childCitizenship(value) {
  var s = String(value || '').trim();
  if (!s) return '—';
  var parts = s.split('/').map(function (x) { return x.trim(); }).filter(Boolean);
  return parts.length > 1 ? parts[0] : s;
}

function childAddress(value) {
  var s = String(value || '').trim();
  if (!s) return '—';
  var parts = s.split('/').map(function (x) { return x.trim(); }).filter(Boolean);
  if (parts.length > 1) return parts.slice(1).join(' / ');
  return '—';
}

function childrenRowsHtml(children) {
  if (!Array.isArray(children) || !children.length) {
    return '<tr><td colspan="5"><span class="phs-print-placeholder">No children listed</span></td></tr>';
  }
  return children.map(function (row) {
    return (
      '<tr>' +
      '<td>' + escapeHtml(String(row && row.name || '—')) + '</td>' +
      '<td>' + escapeHtml(String(row && row.dob || '—')) + '</td>' +
      '<td>' + escapeHtml(childCitizenship(row && row.citizenshipAddress)) + '</td>' +
      '<td>' + escapeHtml(childAddress(row && row.citizenshipAddress)) + '</td>' +
      '<td>' + escapeHtml(String(row && row.fatherMother || '—')) + '</td>' +
      '</tr>'
    );
  }).join('');
}

function tableValue(value) {
  var s = value == null ? '' : String(value).trim();
  if (!s) return '<span class="phs-print-placeholder">—</span>';
  return '<span class="phs-print-val">' + escapeHtml(s) + '</span>';
}

function modernField(label, valueHtml) {
  return (
    '<div class="phs-modern-field">' +
    '<span class="phs-modern-field-label">' + escapeHtml(label) + '</span>' +
    '<div class="phs-modern-field-value">' + valueHtml + '</div>' +
    '</div>'
  );
}

function modernCard(title, bodyHtml) {
  return (
    '<section class="phs-modern-card">' +
    '<h4 class="phs-modern-card-title">' + escapeHtml(title) + '</h4>' +
    '<div class="phs-modern-card-body">' + bodyHtml + '</div>' +
    '</section>'
  );
}

function modernTableCard(title, headers, rows) {
  var head = (headers || []).map(function (h) {
    return '<th scope="col">' + escapeHtml(h) + '</th>';
  }).join('');

  var body = '';
  if (!Array.isArray(rows) || !rows.length) {
    body = '<tr><td colspan="' + headers.length + '"><span class="phs-print-placeholder">No records listed</span></td></tr>';
  } else {
    body = rows.map(function (row) {
      return '<tr>' + (row || []).map(function (cell) {
        return '<td>' + tableValue(cell) + '</td>';
      }).join('') + '</tr>';
    }).join('');
  }

  return (
    '<section class="phs-modern-table-card">' +
    '<h4 class="phs-modern-card-title">' + escapeHtml(title) + '</h4>' +
    '<table class="phs-modern-table">' +
    '<thead><tr>' + head + '</tr></thead>' +
    '<tbody>' + body + '</tbody>' +
    '</table>' +
    '</section>'
  );
}

function handwrittenEntryHtml(data) {
  var src = raw(data, 'handwrittenEntryDataUrl');
  if (!src) {
    return '<span class="phs-print-placeholder">No handwritten entry image uploaded</span>';
  }
  return (
    '<div class="phs-modern-handwriting-wrap">' +
    '<img class="phs-modern-handwriting-img" src="' + escapeHtml(src) + '" alt="Personnel handwritten entry" />' +
    '</div>'
  );
}

function thumbMarkHtml(data, key, label) {
  var src = raw(data, key);
  return (
    '<div class="phs-modern-thumb-item">' +
    (src
      ? '<img class="phs-modern-thumb-box phs-modern-thumb-box--img" src="' + escapeHtml(src) + '" alt="' + escapeHtml(label) + ' thumb mark" />'
      : '<span class="phs-modern-thumb-box"></span>') +
    '<span class="phs-modern-thumb-label">' + escapeHtml(label) + '</span>' +
    '</div>'
  );
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
    '<h1 class="phs-print-title">Personnel History Statement Summary</h1>' +
    '</header>' +

    '<section class="phs-print-section phs-print-instructions phs-print-instructions-box">' +
    '<h2 class="phs-print-h2 phs-print-h2--instructions">I N S T R U C T I O N S</h2>' +
    '<ol class="phs-print-ol phs-print-instructions-ol">' +
    INSTRUCTIONS.map(function (t) {
      return '<li>' + escapeHtml(t) + '</li>';
    }).join('') +
    '</ol>' +
    '</section>' +

    '<section class="phs-print-section phs-print-section--personal">' +
    '<h2 class="phs-print-h2 phs-print-h2--section">I. PERSONAL DETAILS</h2>' +
    '<div class="phs-personal-modern" aria-hidden="true">' +
    '<div class="phs-personal-modern-hero">' +
    '<div class="phs-personal-modern-avatar-wrap">' +
    (data.photoDataUrl
      ? '<img class="phs-personal-modern-avatar-img" src="' + escapeHtml(data.photoDataUrl) + '" alt="Profile photo" />'
      : '<div class="phs-personal-modern-avatar-placeholder">' + escapeHtml(initialsFromName(data)) + '</div>') +
    '</div>' +
    '<div class="phs-personal-modern-nameblock">' +
    '<h3 class="phs-personal-modern-name">' + (displayNameNatural(data) ? escapeHtml(displayNameNatural(data)) : '<span class="phs-print-placeholder">—</span>') + '</h3>' +
    '<p class="phs-personal-modern-job">' + v(data, 'presentJob') + '</p>' +
    '</div>' +
    '</div>' +

    '<div class="phs-personal-modern-cards">' +
    '<section class="phs-personal-modern-card">' +
    '<h4 class="phs-personal-modern-card-title">Contact</h4>' +
    modernItem('phs-icon--mobile', 'Mobile', v(data, 'mobile')) +
    modernItem('phs-icon--email', 'Email', v(data, 'email')) +
    modernItem('phs-icon--phone', 'Tel No.', v(data, 'telNo')) +
    '</section>' +

    '<section class="phs-personal-modern-card">' +
    '<h4 class="phs-personal-modern-card-title">Identity</h4>' +
    modernItem('phs-icon--birth', 'Date of Birth', v(data, 'dateOfBirth')) +
    modernItem('phs-icon--place', 'Place of Birth', v(data, 'placeOfBirth')) +
    modernItem('phs-icon--nationality', 'Nationality', v(data, 'nationality')) +
    modernItem('phs-icon--nickname', 'Nickname', v(data, 'nicknames')) +
    '</section>' +

    '<section class="phs-personal-modern-card">' +
    '<h4 class="phs-personal-modern-card-title">Legal / Address</h4>' +
    modernItem('phs-icon--address', 'Home Address', v(data, 'homeAddress')) +
    modernItem('phs-icon--tax', 'Tax Identification Nr.', v(data, 'taxId')) +
    modernItem('phs-icon--passport', 'Passport Nr. / Expiration', joinData(data, ['passportNr', 'passportExpiry'])) +
    '</section>' +
    '</div>' +
    '</div>' +

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
    '<td class="phs-td-letter">G.</td>' +
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
    '<div class="phs-print-photo-inline">' +
    '<span class="phs-print-photo-inline-title">2×2 Photo — Passport size</span>' +
    (data.photoDataUrl
      ? '<img class="phs-print-photo-img phs-print-photo-img--inline" src="' + escapeHtml(data.photoDataUrl) + '" alt="Photo" />'
      : '<div class="phs-print-photo-placeholder">Photo on file / attach printout</div>') +
    '</div>' +
    '</section>' +

    '<section class="phs-print-section phs-print-section--char">' +
    '<h2 class="phs-print-h2 phs-print-h2--section">II. PERSONAL CHARACTERISTICS</h2>' +
    '<div class="phs-char-modern" aria-hidden="true">' +
    '<div class="phs-char-modern-grid">' +
    '<div class="phs-char-modern-col">' +
    modernLine('phs-micon--sex', 'Sex', v(data, 'sex')) +
    modernLine('phs-micon--age', 'Age', v(data, 'age')) +
    '</div>' +
    '<div class="phs-char-modern-col">' +
    modernLine('phs-micon--height', 'Height (m)', v(data, 'height')) +
    modernLine('phs-micon--weight', 'Weight (kg)', v(data, 'weight')) +
    '</div>' +
    '<div class="phs-char-modern-col">' +
    modernLine('phs-micon--build', 'Build', v(data, 'build')) +
    modernLine('phs-micon--complexion', 'Complexion', v(data, 'complexion')) +
    '</div>' +
    '<div class="phs-char-modern-col">' +
    modernLine('phs-micon--eyes', 'Eyes', v(data, 'colorEyes')) +
    modernLine('phs-micon--hair', 'Hair', v(data, 'colorHair')) +
    '</div>' +
    '</div>' +

    '<div class="phs-char-modern-health">' +
    '<div class="phs-char-modern-health-item">' + modernLine('phs-micon--health', 'Present State of Health', v(data, 'healthState'), 'phs-modern-line--stacked') + '</div>' +
    '<div class="phs-char-modern-health-item">' + modernLine('phs-micon--illness', 'Recent Serious Illness', v(data, 'recentIllness'), 'phs-modern-line--stacked') + '</div>' +
    '<div class="phs-char-modern-health-item">' + modernLine('phs-micon--blood', 'Blood Type', v(data, 'bloodType')) + '</div>' +
    '</div>' +

    '<div class="phs-char-modern-footer">' +
    modernLine('phs-micon--feature', 'Scars, marks, or distinguishing features', v(data, 'scarMarks')) +
    '</div>' +
    '</div>' +

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

    '<section class="phs-print-section phs-print-section--marital">' +
    '<h2 class="phs-print-h2 phs-print-h2--section">III. MARITAL HISTORY</h2>' +
    '<div class="phs-marital-modern" aria-hidden="true">' +
    '<div class="phs-marital-modern-split">' +
    '<div class="phs-marital-modern-col">' +
    modernLine('phs-micon--marital', 'Marital Status', v(data, 'maritalStatus')) +
    modernLine('phs-micon--spouse', 'Name of Spouse', v(data, 'spouseName')) +
    modernLine('phs-micon--marriage', 'Date/Place of Marriage', v(data, 'marriageDatePlace')) +
    '</div>' +
    '<div class="phs-marital-modern-col">' +
    modernLine('phs-micon--calendar', 'Spouse DOB', v(data, 'spouseDob')) +
    modernLine('phs-micon--job', 'Occupation', v(data, 'spouseOccupation')) +
    modernLine('phs-micon--phone', 'Contact', v(data, 'spouseContact')) +
    modernLine('phs-micon--nationality', 'Citizenship', v(data, 'spouseCitizenship')) +
    '</div>' +
    '</div>' +

    '<div class="phs-marital-modern-children">' +
    '<h4 class="phs-marital-modern-children-title">Children</h4>' +
    '<table class="phs-marital-modern-children-table">' +
    '<thead><tr><th>Name</th><th>Birth Date</th><th>Nationality</th><th>Address</th><th>Parents</th></tr></thead>' +
    '<tbody>' + childrenRowsHtml(data.children) + '</tbody>' +
    '</table>' +
    '</div>' +
    '</div>' +

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

    '<section class="phs-print-section phs-print-section--prose phs-print-section--family">' +
    '<h2 class="phs-print-h2 phs-print-h2--section">IV. FAMILY HISTORY AND INFORMATION</h2>' +
    '<div class="phs-family-modern" aria-hidden="true">' +
    '<div class="phs-modern-card-grid phs-modern-card-grid--2">' +
    modernCard('Father',
      modernField('Name', v(data, 'fatherName')) +
      modernField('DOB / Place', v(data, 'fatherDobPlace')) +
      modernField('Address', v(data, 'fatherAddress')) +
      modernField('Occupation', v(data, 'fatherOccupation')) +
      modernField('Citizenship', v(data, 'fatherCitizenship'))
    ) +
    modernCard('Mother',
      modernField('Name', v(data, 'motherName')) +
      modernField('DOB / Place', v(data, 'motherDobPlace')) +
      modernField('Address', v(data, 'motherAddress')) +
      modernField('Occupation', v(data, 'motherOccupation')) +
      modernField('Citizenship', v(data, 'motherCitizenship'))
    ) +
    modernCard('Brothers / Sisters',
      modernField('Name', v(data, 'siblingsName')) +
      modernField('DOB', v(data, 'siblingsDob')) +
      modernField('Citizenship', v(data, 'siblingsCitizenship')) +
      modernField('Address', v(data, 'siblingsAddress')) +
      modernField('Occupation', v(data, 'siblingsOccupation')) +
      modernField('Employer / Address', v(data, 'siblingsEmployerAddress'))
    ) +
    modernCard('Step-parent / Guardian',
      modernField('Name', v(data, 'stepParentFullName')) +
      modernField('DOB', v(data, 'stepParentDob')) +
      modernField('Address', v(data, 'stepParentAddress')) +
      modernField('Occupation', v(data, 'stepParentOccupation')) +
      modernField('Citizenship', v(data, 'stepParentCitizenship'))
    ) +
    modernCard('Father-in-law',
      modernField('Name', v(data, 'fatherInLawFullName')) +
      modernField('DOB', v(data, 'fatherInLawDob')) +
      modernField('Address', v(data, 'fatherInLawAddress')) +
      modernField('Occupation', v(data, 'fatherInLawOccupation')) +
      modernField('Citizenship', v(data, 'fatherInLawCitizenship'))
    ) +
    modernCard('Mother-in-law',
      modernField('Name', v(data, 'motherInLawFullName')) +
      modernField('DOB', v(data, 'motherInLawDob')) +
      modernField('Address', v(data, 'motherInLawAddress')) +
      modernField('Occupation', v(data, 'motherInLawOccupation')) +
      modernField('Citizenship', v(data, 'motherInLawCitizenship'))
    ) +
    '</div>' +
    '</div>' +
    '<div class="phs-print-kv-block"><span class="phs-print-kv-label">Father</span><div class="phs-print-kv-text">' + v(data, 'fatherName') + ' · DOB/place: ' + v(data, 'fatherDobPlace') + ' · Address: ' + v(data, 'fatherAddress') + ' · Occupation: ' + v(data, 'fatherOccupation') + ' · Citizenship: ' + v(data, 'fatherCitizenship') + '</div></div>' +
    '<div class="phs-print-kv-block"><span class="phs-print-kv-label">Mother</span><div class="phs-print-kv-text">' + v(data, 'motherName') + ' · DOB/place: ' + v(data, 'motherDobPlace') + ' · Address: ' + v(data, 'motherAddress') + ' · Occupation: ' + v(data, 'motherOccupation') + ' · Citizenship: ' + v(data, 'motherCitizenship') + '</div></div>' +
    '<div class="phs-print-kv-block"><span class="phs-print-kv-label">Brothers / sisters</span><div class="phs-print-kv-text">' + joinData(data, ['siblingsName', 'siblingsDob', 'siblingsCitizenship', 'siblingsAddress', 'siblingsOccupation', 'siblingsEmployerAddress']) + '</div></div>' +
    '<div class="phs-print-kv-block"><span class="phs-print-kv-label">Step-parent / guardian</span><div class="phs-print-kv-text">' + joinData(data, ['stepParentFullName', 'stepParentDob', 'stepParentAddress', 'stepParentOccupation', 'stepParentCitizenship']) + '</div></div>' +
    '<div class="phs-print-kv-block"><span class="phs-print-kv-label">Father-in-law</span><div class="phs-print-kv-text">' + joinData(data, ['fatherInLawFullName', 'fatherInLawDob', 'fatherInLawAddress', 'fatherInLawOccupation', 'fatherInLawCitizenship']) + '</div></div>' +
    '<div class="phs-print-kv-block"><span class="phs-print-kv-label">Mother-in-law</span><div class="phs-print-kv-text">' + joinData(data, ['motherInLawFullName', 'motherInLawDob', 'motherInLawAddress', 'motherInLawOccupation', 'motherInLawCitizenship']) + '</div></div>' +
    '</section>' +

    '<div class="phs-page-group-v8">' +
    '<section class="phs-print-section phs-print-section--education">' +
    '<h2 class="phs-print-h2 phs-print-h2--section">V. EDUCATIONAL BACKGROUND</h2>' +
    '<div class="phs-education-modern" aria-hidden="true">' +
    modernTableCard('Educational Background', ['Level', 'Location', 'Attendance', 'Year Graduated'], [
      ['Elementary', data.elemLocation, data.elemAttendance, data.elemGraduated],
      ['High School', data.hsLocation, data.hsAttendance, data.hsGraduated],
      ['College', data.collegeLocation, data.collegeAttendance, data.collegeGraduated],
      ['Post Graduate', data.pgLocation, data.pgCourseAttendance, data.pgGraduated]
    ]) +
    '<div class="phs-modern-card-grid phs-modern-card-grid--2">' +
    modernCard('Other Schools / Training', modernField('Details', v(data, 'otherSchools'))) +
    modernCard('Civil Service Eligibility', modernField('Details', v(data, 'civilServiceEligibility'))) +
    '</div>' +
    '</div>' +
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

    '<section class="phs-print-section phs-print-section--residence">' +
    '<h2 class="phs-print-h2 phs-print-h2--section">VI. PLACES OF RESIDENCE SINCE BIRTH</h2>' +
    '<div class="phs-residence-modern" aria-hidden="true">' +
    modernTableCard('Places of Residence', ['Inclusive Dates', 'Address'], (Array.isArray(data.placesOfResidence) ? data.placesOfResidence : []).map(function (row) {
      return [row && row.inclusiveDates, row && row.address];
    })) +
    '</div>' +
    listRows('Rows', data.placesOfResidence, function (row) {
      return escapeHtml([row.inclusiveDates, row.address].filter(Boolean).join(' — ') || '—');
    }) +
    '</section>' +

    '<section class="phs-print-section phs-print-section--employment">' +
    '<h2 class="phs-print-h2 phs-print-h2--section">VII. EMPLOYMENT &amp; TRAINING</h2>' +
    '<div class="phs-employment-modern" aria-hidden="true">' +
    modernTableCard('Employment History', ['Inclusive Date', 'Type', 'Employer / Address', 'Reason for Leaving'], (Array.isArray(data.employmentHistory) ? data.employmentHistory : []).map(function (row) {
      return [row && row.inclusiveDate, row && row.type, row && row.employerAddress, row && row.reasonForLeaving];
    })) +
    modernTableCard('Seminars / Training', ['Inclusive Date', 'Name', 'Conducted By', 'Remarks'], (Array.isArray(data.seminarsTraining) ? data.seminarsTraining : []).map(function (row) {
      return [row && row.inclusiveDate, row && row.name, row && row.conductedBy, row && row.remarks];
    })) +
    modernCard('Employment Integrity', modernField('Dismissed or forced to resign?', v(data, 'dismissedResign'))) +
    '</div>' +
    listRows('Employment history', data.employmentHistory, function (row) {
      return escapeHtml([row.inclusiveDate, row.type, row.employerAddress, row.reasonForLeaving].filter(Boolean).join(' — ') || '—');
    }) +
    listRows('Seminars &amp; training', data.seminarsTraining, function (row) {
      return escapeHtml([row.inclusiveDate, row.name, row.conductedBy, row.remarks].filter(Boolean).join(' — ') || '—');
    }) +
    '<div class="phs-print-kv-block"><span class="phs-print-kv-label">Dismissed or forced to resign?</span><div class="phs-print-kv-text">' + v(data, 'dismissedResign') + '</div></div>' +
    '</section>' +

    '<section class="phs-print-section phs-print-section--foreign">' +
    '<h2 class="phs-print-h2 phs-print-h2--section">VIII. FOREIGN COUNTRIES VISITED</h2>' +
    '<div class="phs-foreign-modern" aria-hidden="true">' +
    modernTableCard('Foreign Countries Visited', ['Date of Visit', 'Country', 'Purpose', 'Address Abroad'], (Array.isArray(data.foreignCountries) ? data.foreignCountries : []).map(function (row) {
      return [row && row.dateOfVisit, row && row.country, row && row.purpose, row && row.addressAbroad];
    })) +
    '</div>' +
    listRows('Visits', data.foreignCountries, function (row) {
      return escapeHtml([row.dateOfVisit, row.country, row.purpose, row.addressAbroad].filter(Boolean).join(' — ') || '—');
    }) +
    '</section>' +
    '</div>' +

    '<section class="phs-print-section phs-print-section--credit">' +
    '<h2 class="phs-print-h2 phs-print-h2--section">IX. CREDIT REPUTATION</h2>' +
    '<div class="phs-credit-modern" aria-hidden="true">' +
    modernCard('Income Dependency', modernField('Entirely dependent on salary?', v(data, 'salaryDependent'))) +
    modernTableCard('Banks / Credit Institutions', ['Name', 'Address', 'Nature of Account'], (Array.isArray(data.banksCredit) ? data.banksCredit : []).map(function (row) {
      return [row && row.name, row && row.address, row && row.natureOfAccount];
    })) +
    '<div class="phs-modern-card-grid phs-modern-card-grid--2">' +
    modernCard('Statement of Assets & Liabilities', modernField('Filed', v(data, 'salFiled'))) +
    modernCard('Income Tax Return', modernField('Last calendar year', v(data, 'incomeTaxFiled'))) +
    '</div>' +
    modernTableCard('Credit References', ['Name', 'Address'], (Array.isArray(data.creditReferences) ? data.creditReferences : []).map(function (row) {
      return [row && row.name, row && row.address];
    })) +
    '</div>' +
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

    '<section class="phs-print-section phs-print-section--prose phs-print-section--arrest">' +
    '<h2 class="phs-print-h2 phs-print-h2--section">X. ARREST RECORD AND CONDUCT</h2>' +
    '<div class="phs-arrest-modern" aria-hidden="true">' +
    '<div class="phs-modern-card-grid phs-modern-card-grid--1">' +
    modernCard('Investigated / Arrested / Convicted', modernField('Court, offense, disposition', v(data, 'arrestRecord'))) +
    modernCard('Immediate Family Investigated / Arrested', modernField('Details', v(data, 'familyArrest'))) +
    modernCard('Administrative Case', modernField('Details', v(data, 'adminCase'))) +
    modernCard('Arrested or detained under PD 1081', modernField('Details', v(data, 'pd1081'))) +
    modernCard('Intoxicating liquor / illegal drugs', modernField('Details', v(data, 'liquorDrugs'))) +
    '</div>' +
    '</div>' +
    '<div class="phs-print-kv-block"><span class="phs-print-kv-label">Ever investigated, arrested, indicted, or convicted? (If yes: court, offense, disposition)</span><div class="phs-print-kv-text">' + v(data, 'arrestRecord') + '</div></div>' +
    '<div class="phs-print-kv-block"><span class="phs-print-kv-label">Immediate family member investigated or arrested?</span><div class="phs-print-kv-text">' + v(data, 'familyArrest') + '</div></div>' +
    '<div class="phs-print-kv-block"><span class="phs-print-kv-label">Charged in any administrative case?</span><div class="phs-print-kv-text">' + v(data, 'adminCase') + '</div></div>' +
    '<div class="phs-print-kv-block"><span class="phs-print-kv-label">Arrested or detained under PD 1081?</span><div class="phs-print-kv-text">' + v(data, 'pd1081') + '</div></div>' +
    '<div class="phs-print-kv-block"><span class="phs-print-kv-label">Use of intoxicating liquor or illegal drugs</span><div class="phs-print-kv-text">' + v(data, 'liquorDrugs') + '</div></div>' +
    '</section>' +

    '<section class="phs-print-section phs-print-section--reputation">' +
    '<h2 class="phs-print-h2 phs-print-h2--section">XI. GENERAL REPUTATION</h2>' +
    '<div class="phs-reputation-modern" aria-hidden="true">' +
    modernTableCard('Character References', ['Name', 'Address'], (Array.isArray(data.characterRefs) ? data.characterRefs : []).map(function (row) {
      return [row && row.name, row && row.address];
    })) +
    modernTableCard('Neighbors', ['Name', 'Address'], (Array.isArray(data.neighbors) ? data.neighbors : []).map(function (row) {
      return [row && row.name, row && row.address];
    })) +
    '</div>' +
    listRows('Character references', data.characterRefs, function (row) {
      return escapeHtml([row.name, row.address].filter(Boolean).join(' — ') || '—');
    }) +
    listRows('Neighbors', data.neighbors, function (row) {
      return escapeHtml([row.name, row.address].filter(Boolean).join(' — ') || '—');
    }) +
    '</section>' +

    '<section class="phs-print-section phs-print-section--organizations">' +
    '<h2 class="phs-print-h2 phs-print-h2--section">XII. ORGANIZATIONS</h2>' +
    '<div class="phs-organizations-modern" aria-hidden="true">' +
    modernTableCard('Organizations', ['Organization', 'Address', 'Membership Date', 'Position Held'], (Array.isArray(data.organizations) ? data.organizations : []).map(function (row) {
      return [row && row.organization, row && row.address, row && row.membershipDate, row && row.positionHeld];
    })) +
    '</div>' +
    listRows('Organizations', data.organizations, function (row) {
      return escapeHtml([row.organization, row.address, row.membershipDate, row.positionHeld].filter(Boolean).join(' — ') || '—');
    }) +
    '</section>' +

    '<section class="phs-print-section phs-print-section-misc phs-print-section--misc">' +
    '<h2 class="phs-print-h2 phs-print-h2--section">XIII. MISCELLANEOUS</h2>' +
    '<div class="phs-misc-modern" aria-hidden="true">' +
    modernCard('Hobbies, Sports, Pastimes', modernField('Details', v(data, 'hobbies'))) +
    modernTableCard('Languages', ['Language / Dialect', 'Speak', 'Read', 'Write'], (Array.isArray(data.languages) ? data.languages : []).map(function (row) {
      return [row && row.languageDialect, row && row.speak, row && row.read, row && row.write];
    })) +
    modernCard('Lie Detector Test', modernField('Willing to undergo periodic test?', v(data, 'lieDetector'))) +
    modernCard('Personnel Handwritten Entry', handwrittenEntryHtml(data)) +
    '<section class="phs-modern-card phs-modern-card--thumb-sign">' +
    '<h4 class="phs-modern-card-title">Thumb Mark / Signature</h4>' +
    '<div class="phs-modern-card-body">' +
    '<div class="phs-modern-thumb-pair">' +
    thumbMarkHtml(data, 'leftThumbMarkDataUrl', 'Left') +
    thumbMarkHtml(data, 'rightThumbMarkDataUrl', 'Right') +
    '</div>' +
    '<div class="phs-modern-thumb-signature">' +
    (data && data.signatureDataUrl
      ? '<img class="phs-modern-sign-img" src="' + escapeHtml(data.signatureDataUrl) + '" alt="Signature of applicant"/>'
      : '<div class="phs-modern-thumb-sign-line"></div><p class="phs-modern-thumb-sign-cap">(Signature of Applicant)</p>') +
    '</div>' +
    '</div>' +
    '</section>' +
    '</div>' +
    '<div class="phs-print-kv-block"><span class="phs-print-kv-label">Hobbies, sports, pastimes</span><div class="phs-print-kv-text">' + v(data, 'hobbies') + '</div></div>' +
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
    '<div class="phs-print-thumb-pair">' +
    (data.leftThumbMarkDataUrl
      ? '<img class="phs-print-thumb-box phs-print-thumb-box--img" src="' + escapeHtml(data.leftThumbMarkDataUrl) + '" alt="Left thumb mark" />'
      : '<span class="phs-print-thumb-box"></span>') +
    ' (Left) &nbsp; ' +
    (data.rightThumbMarkDataUrl
      ? '<img class="phs-print-thumb-box phs-print-thumb-box--img" src="' + escapeHtml(data.rightThumbMarkDataUrl) + '" alt="Right thumb mark" />'
      : '<span class="phs-print-thumb-box"></span>') +
    ' (Right)</div></td>' +
    '</tr></table>' +
    '</div>' +

    '<div class="phs-print-sworn">' +
    '<div class="phs-print-kv-block"><span class="phs-print-kv-label">Subscribed and sworn before me</span><div class="phs-print-kv-text">This ' + v(data, 'swornDay') + ' day of ' + v(data, 'swornMonth') + ', Philippines. Place: ' + v(data, 'swornPlace') + '</div></div>' +
    '<table class="phs-print-table">' +
    '<tr><td>Residence Certificate Nr.: ' + v(data, 'residenceCertNr2') + '</td>' +
    '<td>Issued on: ' + v(data, 'residenceCertIssuedOn2') + '</td>' +
    '<td>Issued at: ' + v(data, 'residenceCertIssuedAt2') + '</td></tr>' +
    '</table>' +
    '<div class="phs-print-kv-block"><span class="phs-print-kv-label">Administering officer</span><div class="phs-print-kv-text">' + v(data, 'administeringOfficer2') + '</div></div>' +
    '<div class="phs-print-sig-line phs-print-sig-line-wide"></div>' +
    '<p class="phs-print-sig-cap">Signature / stamp</p>' +
    '</div>' +

    '</section>' +

    '</article>'
  );
}
