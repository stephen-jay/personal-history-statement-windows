import { FIELD_IDS, ROW_SECTIONS } from './constants.js';
import { normalizeValue } from './escape.js';

export { ROW_SECTIONS };

export function setPhotoPreview(dataUrl) {
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

export function createChildRow(rowData) {
  const row = document.createElement('div');
  row.className = 'row child-row';
  row.innerHTML =
    '<div class="four-cols">' +
      '<input type="text" data-child="name" placeholder="Child name" />' +
      '<input type="date" data-child="dob" />' +
      '<input type="text" data-child="citizenshipAddress" placeholder="Citizenship / Address" />' +
      '<input type="text" data-child="fatherMother" placeholder="Name of Father and Mother" />' +
    '</div>' +
    '<button type="button" class="btn small danger remove-child-row form-add-row">Remove</button>';
  const data = rowData || {};
  const setChild = function (attr, val) {
    const input = row.querySelector('[data-child="' + attr + '"]');
    if (input) input.value = val || '';
  };
  setChild('name', data.name);
  setChild('dob', data.dob);
  setChild('citizenshipAddress', data.citizenshipAddress);
  setChild('fatherMother', data.fatherMother);
  return row;
}

export function createStructuredRow(section, rowData) {
  const row = document.createElement('div');
  row.className = 'row data-row';
  row.setAttribute('data-section', section.key);
  const data = rowData || {};
  const fieldsHtml = section.fields.map(function (field) {
    return '<input type="text" data-field="' + field.key + '" placeholder="' + field.placeholder + '" />';
  }).join('');
  row.innerHTML =
    '<div class="' + section.colsClass + '">' + fieldsHtml + '</div>' +
    '<button type="button" class="btn small danger remove-data-row form-add-row">Remove</button>';
  section.fields.forEach(function (field) {
    const input = row.querySelector('[data-field="' + field.key + '"]');
    if (input) input.value = data[field.key] || '';
  });
  return row;
}

export function parseLegacyStructured(section, value) {
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

export function setStructuredRows(section, value) {
  const host = document.getElementById(section.hostId);
  if (!host) return;
  host.innerHTML = '';
  const rows = parseLegacyStructured(section, value);
  if (!rows.length) rows.push({});
  rows.forEach(function (rowData) {
    host.appendChild(createStructuredRow(section, rowData));
  });
}

export function getStructuredRows(section) {
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

export function parseLegacyChildren(children) {
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

export function setChildrenRows(children) {
  const rowsHost = document.getElementById('children-rows');
  if (!rowsHost) return;
  rowsHost.innerHTML = '';
  const rows = parseLegacyChildren(children);
  if (!rows.length) rows.push({});
  rows.forEach(function (row) {
    rowsHost.appendChild(createChildRow(row));
  });
}

export function getChildrenRows() {
  const rowsHost = document.getElementById('children-rows');
  if (!rowsHost) return [];
  return Array.from(rowsHost.querySelectorAll('.child-row')).map(function (row) {
    const childVal = function (attr) {
      const input = row.querySelector('[data-child="' + attr + '"]');
      return normalizeValue(input ? input.value : '');
    };
    return {
      name: childVal('name'),
      dob: childVal('dob'),
      citizenshipAddress: childVal('citizenshipAddress'),
      fatherMother: childVal('fatherMother')
    };
  }).filter(function (item) {
    return item.name || item.dob || item.citizenshipAddress || item.fatherMother;
  });
}

/**
 * Display / search name: "Last, First Middle" (comma only after surname — not "Last, First, Middle").
 * @param {string|null|undefined} nameLast
 * @param {string|null|undefined} nameFirst
 * @param {string|null|undefined} nameMiddle
 * @returns {string|null}
 */
export function buildDisplayFullName(nameLast, nameFirst, nameMiddle) {
  const L = normalizeValue(nameLast);
  const F = normalizeValue(nameFirst);
  const M = normalizeValue(nameMiddle);
  const given = [F, M].filter(Boolean).join(' ');
  if (L && given) return L + ', ' + given;
  if (L) return L;
  if (given) return given;
  return null;
}

export function getFormData() {
  const recordIdInput = document.getElementById('record-id');
  const data = { id: recordIdInput && recordIdInput.value ? recordIdInput.value : undefined };
  FIELD_IDS.forEach(function (id) {
    const el = document.getElementById(id);
    if (!el) return;
    const val = normalizeValue(el.value);
    data[id] = val;
  });
  data.children = getChildrenRows();
  ROW_SECTIONS.forEach(function (section) {
    data[section.key] = getStructuredRows(section);
  });
  data.fullName = buildDisplayFullName(data.nameLast, data.nameFirst, data.nameMiddle);
  return data;
}

export function setFormData(record) {
  const recordIdInput = document.getElementById('record-id');
  if (recordIdInput) recordIdInput.value = record.id || '';
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

export function clearForm() {
  setFormData({});
}
