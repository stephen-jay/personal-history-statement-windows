import { escapeHtml } from './escape.js';
import { buildOfficialPrintHtml } from './phs-print-document.js';

function field(label, value) {
  return '<div class="summary-item"><span class="summary-label">' + escapeHtml(label) + ':</span> ' + escapeHtml(value || 'N/A') + '</div>';
}

function listFromRows(rows, formatRow) {
  if (!Array.isArray(rows) || !rows.length) return '<div class="summary-item">N/A</div>';
  return '<ol class="summary-list">' + rows.map(function (row) {
    return '<li class="summary-item">' + formatRow(row) + '</li>';
  }).join('') + '</ol>';
}

export function buildSummaryHtml(record) {
  var data = record || {};
  var compact = '' +
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

  return (
    '<div class="phs-summary-compact">' +
    compact +
    '</div>' +
    buildOfficialPrintHtml(data)
  );
}
