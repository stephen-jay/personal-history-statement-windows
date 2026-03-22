import { FIELD_IDS } from './constants.js';
import { buildDisplayFullName } from './form-data.js';
import { escapeHtml, normalizeValue } from './escape.js';

/** Roster label + search string: prefer recomputed "Last, First Middle" when name parts exist. */
function rosterDisplayName(record) {
  if (!record) return '';
  var computed = buildDisplayFullName(record.nameLast, record.nameFirst, record.nameMiddle);
  if (computed) return computed;
  return normalizeValue(record.fullName) || '';
}

export function formatDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso : d.toLocaleDateString();
  } catch (_) {
    return iso;
  }
}

function truncateText(value, maxLen) {
  var s = String(value == null ? '' : value);
  if (!maxLen || s.length <= maxLen) return s;
  return s.slice(0, Math.max(0, maxLen - 1)) + '…';
}

export function formatEducationBackground(r) {
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

  if (otherSchools) return truncateText('Training: ' + otherSchools, 42);
  if (civil) return truncateText('Civil Service: ' + civil, 42);
  return '—';
}

export function formatSeminarsTraining(r) {
  var items = r.seminarsTraining;
  if (!Array.isArray(items)) return '—';
  if (!items.length) return '—';
  var first = items[0] || {};
  var name = normalizeValue(first.name);
  var count = items.length;
  if (count === 1) return truncateText(name || '1 Seminar/Training', 36);
  return truncateText(count + ' Seminars/Trainings', 36);
}

/**
 * Approximate PHS completeness from scalar fields (FIELD_IDS).
 * @param {object} record
 * @returns {number} 0–100
 */
export function getRecordCompletenessPercent(record) {
  if (!record) return 0;
  var filled = 0;
  var n = FIELD_IDS.length;
  FIELD_IDS.forEach(function (id) {
    var v = record[id];
    if (v == null) return;
    if (typeof v === 'string' && v.trim() === '') return;
    filled++;
  });
  return Math.min(100, Math.round((filled / n) * 100));
}

export function getAvatarHtml(record) {
  var src = normalizeValue(record && (record.photoDataUrl || record.photo || record.avatar)) || null;
  if (src) {
    return '' +
      '<div class="avatar-thumb">' +
        '<img class="avatar-thumb-img" src="' + escapeHtml(src) + '" alt="" />' +
      '</div>';
  }

  var last = normalizeValue(record && record.nameLast) || '';
  var first = normalizeValue(record && record.nameFirst) || '';
  if (!last && !first) {
    var full = normalizeValue(record && record.fullName) || '';
    var parts = full.split(',').map(function (p) { return p.trim(); }).filter(Boolean);
    last = parts[0] || '';
    first = parts[1] || '';
  }
  var initials = '';
  if (first) initials += first.charAt(0).toUpperCase();
  if (last) initials += last.charAt(0).toUpperCase();
  initials = initials || '—';

  return '' +
    '<div class="avatar-thumb">' +
      '<span class="avatar-initials">' + escapeHtml(initials) + '</span>' +
    '</div>';
}

/**
 * @param {Array} records
 * @param {object} deps
 */
export function renderList(records, deps) {
  const query = (deps.searchInput && deps.searchInput.value || '').trim().toLowerCase();
  const filtered = query
    ? records.filter(function (r) {
        const fn = rosterDisplayName(r).toLowerCase();
        const pos = (r.presentJob || '').toLowerCase();
        const mob = (r.mobile || '').toString().toLowerCase();
        const em = (r.email || '').toLowerCase();
        const edu = (formatEducationBackground(r) || '').toLowerCase();
        const sem = (formatSeminarsTraining(r) || '').toLowerCase();
        return fn.includes(query) || pos.includes(query) || mob.includes(query) || em.includes(query) || edu.includes(query) || sem.includes(query);
      })
    : records;

  deps.personnelTbody.innerHTML = '';
  deps.emptyState.style.display = filtered.length ? 'none' : 'block';

  filtered.forEach(function (r) {
    const edu = formatEducationBackground(r);
    const sem = formatSeminarsTraining(r);
    const nameCell = escapeHtml(rosterDisplayName(r) || '—');
    const position = escapeHtml(r.presentJob || '—');
    const contact = escapeHtml(r.mobile || r.email || '—');
    const safeId = escapeHtml(r.id || '');
    const pct = getRecordCompletenessPercent(r);
    const dateStr = formatDate(r.updatedAt);
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td class="avatar-cell">' + getAvatarHtml(r) + '</td>' +
      '<td class="name-cell"><span class="name-chip">' + nameCell + '</span></td>' +
      '<td>' + position + '</td>' +
      '<td class="cell-multiline">' + escapeHtml(edu) + '</td>' +
      '<td class="cell-multiline">' + escapeHtml(sem) + '</td>' +
      '<td>' + contact + '</td>' +
      '<td class="updated-cell">' +
        '<div class="updated-meter" style="--completion:' + pct + '">' +
        '<div class="updated-meter__ring" aria-hidden="true"></div>' +
        '<div class="updated-meter__meta">' +
        '<span class="updated-meter__pct">' + pct + '%</span>' +
        '<span class="updated-meter__date">' + escapeHtml(dateStr) + '</span>' +
        '</div></div></td>' +
      '<td class="table-actions-cell">' +
        '<div class="table-actions table-actions--stacked" role="group" aria-label="Row actions">' +
        '<button type="button" class="btn roster-action-btn roster-action-btn--view view-btn" data-id="' + safeId + '"><span class="roster-action-btn__glyph" aria-hidden="true"></span>View</button>' +
        '<button type="button" class="btn roster-action-btn roster-action-btn--edit edit-btn" data-id="' + safeId + '"><span class="roster-action-btn__glyph" aria-hidden="true"></span>Edit</button>' +
        '<button type="button" class="btn roster-action-btn roster-action-btn--delete delete-btn" data-id="' + safeId + '"><span class="roster-action-btn__glyph" aria-hidden="true"></span>Delete</button>' +
        '</div>' +
      '</td>';
    deps.personnelTbody.appendChild(tr);
  });

  deps.personnelTbody.querySelectorAll('.edit-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const id = btn.getAttribute('data-id');
      const record = records.find(function (r) { return String(r.id) === String(id); });
      if (record) {
        deps.setFormData(record);
        deps.showForm();
      }
    });
  });

  deps.personnelTbody.querySelectorAll('.view-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const id = btn.getAttribute('data-id');
      const record = records.find(function (r) { return String(r.id) === String(id); });
      if (record) deps.openSummary(record);
    });
  });

  deps.personnelTbody.querySelectorAll('.delete-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const id = btn.getAttribute('data-id');
      if (id && confirm('Delete this personnel record?')) {
        window.personnelApi.delete(id).then(function () {
          deps.loadList();
        });
      }
    });
  });
}
