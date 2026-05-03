import { FIELD_IDS } from './constants.js';
import { buildDisplayFullName } from './form-data.js';
import { escapeHtml, normalizeValue } from './escape.js';
import { showConfirm } from './confirm.js';

// Organization filter state
let organizationFilter = null;
let organizationFilterInitialized = false;
let currentOrgs = [];

function applyOrgFilterInlineStyles(btn, dropdown, searchInput, list) {
  if (btn) {
    btn.style.appearance = 'none';
    btn.style.webkitAppearance = 'none';
    btn.style.display = 'inline-flex';
    btn.style.alignItems = 'center';
    btn.style.gap = '6px';
    btn.style.width = 'auto';
    btn.style.padding = '0';
    btn.style.border = 'none';
    btn.style.borderRadius = '0';
    btn.style.background = 'none';
    btn.style.boxShadow = 'none';
    btn.style.color = '#475569';
    btn.style.fontWeight = '700';
    btn.style.fontSize = '0.65rem';
    btn.style.lineHeight = '1';
    btn.style.textTransform = 'uppercase';
    btn.style.letterSpacing = '0.07em';
    btn.style.cursor = 'pointer';
    btn.style.textAlign = 'left';
    btn.style.fontFamily = 'inherit';
    btn.style.boxSizing = 'border-box';
  }

  if (dropdown) {
    dropdown.style.position = 'absolute';
    dropdown.style.top = 'calc(100% + 8px)';
    dropdown.style.left = '0';
    dropdown.style.zIndex = '140';
    dropdown.style.width = 'clamp(230px, 24vw, 320px)';
    dropdown.style.background = '#ffffff';
    dropdown.style.border = '1px solid #cbd5e1';
    dropdown.style.borderRadius = '12px';
    dropdown.style.boxShadow = '0 18px 42px rgba(15, 23, 42, 0.16), 0 2px 8px rgba(15, 23, 42, 0.08)';
    dropdown.style.overflow = 'hidden';
    dropdown.style.fontWeight = '400';
    dropdown.style.textTransform = 'none';
    dropdown.style.letterSpacing = '0';
    dropdown.style.color = '#1f2937';
    dropdown.style.fontSize = '0.88rem';
    dropdown.style.boxSizing = 'border-box';
  }

  if (searchInput) {
    searchInput.style.width = '100%';
    searchInput.style.padding = '9px 10px';
    searchInput.style.border = '1px solid #cbd5e1';
    searchInput.style.borderRadius = '8px';
    searchInput.style.fontSize = '0.88rem';
    searchInput.style.background = '#ffffff';
    searchInput.style.color = '#1f2937';
    searchInput.style.fontWeight = '400';
    searchInput.style.textTransform = 'none';
    searchInput.style.letterSpacing = '0';
    searchInput.style.boxSizing = 'border-box';
  }

  if (list) {
    list.style.maxHeight = '280px';
    list.style.overflowY = 'auto';
    list.style.padding = '6px';
    list.style.background = '#ffffff';
    list.style.boxSizing = 'border-box';
  }
}

function applyOrgFilterOptionInlineStyles(option, isActive) {
  if (!option) return;
  option.style.display = 'block';
  option.style.padding = '9px 12px';
  option.style.fontSize = '0.88rem';
  option.style.fontWeight = isActive ? '600' : '400';
  option.style.textTransform = 'none';
  option.style.letterSpacing = '0';
  option.style.color = isActive ? '#1e40af' : '#1f2937';
  option.style.background = isActive ? '#eff6ff' : '#ffffff';
  option.style.borderRadius = '8px';
  option.style.border = isActive ? '1px solid #bfdbfe' : '1px solid transparent';
  option.style.cursor = 'pointer';
  option.style.userSelect = 'none';
  option.style.whiteSpace = 'nowrap';
  option.style.overflow = 'hidden';
  option.style.textOverflow = 'ellipsis';
  option.style.boxSizing = 'border-box';
}

function normalizeOrganizationKey(value) {
  const text = normalizeValue(value);
  if (!text) return null;
  return text.replace(/^member\s*-\s*/i, '').trim().toLowerCase();
}

function normalizeOrganizationLabel(value) {
  const text = normalizeValue(value);
  if (!text) return null;
  return text.replace(/^member\s*-\s*/i, '').trim();
}

function syncOrgFilterButtonState() {
  const btn = document.getElementById('org-filter-btn');
  const badge = document.getElementById('org-filter-badge');
  if (badge) badge.hidden = organizationFilter === null;
  if (btn) {
    btn.classList.toggle('org-filter-header--filtered', organizationFilter !== null);
    if (organizationFilter !== null) {
      btn.setAttribute('title', 'Filtered by: ' + organizationFilter);
    } else {
      btn.setAttribute('title', 'Filter by organization');
    }
  }
}

function positionOrgDropdown() {
  const btn = document.getElementById('org-filter-btn');
  const dropdown = document.getElementById('org-filter-dropdown');
  if (!btn || !dropdown || dropdown.hidden) return;

  const rect = btn.getBoundingClientRect();
  const gap = 8;
  const viewportPadding = 12;
  const viewportMaxWidth = Math.max(230, window.innerWidth - viewportPadding * 2);
  const desiredWidth = Math.min(Math.max(rect.width, 230), Math.min(320, viewportMaxWidth));

  dropdown.style.position = 'fixed';
  dropdown.style.width = desiredWidth + 'px';
  dropdown.style.maxWidth = 'calc(100vw - 24px)';
  dropdown.style.left = Math.round(Math.max(viewportPadding, Math.min(rect.left, window.innerWidth - desiredWidth - viewportPadding))) + 'px';
  dropdown.style.top = Math.round(rect.bottom + gap) + 'px';
  dropdown.style.bottom = 'auto';

  const dropdownRect = dropdown.getBoundingClientRect();
  if (dropdownRect.bottom > window.innerHeight - viewportPadding) {
    dropdown.style.top = Math.max(viewportPadding, Math.round(rect.top - gap - dropdownRect.height)) + 'px';
  }
}

function ensureOrganizationFilterDom() {
  let btn = document.getElementById('org-filter-btn');
  let dropdown = document.getElementById('org-filter-dropdown');
  let searchInput = document.getElementById('org-filter-search');
  let list = document.getElementById('org-filter-list');

  if (btn && dropdown && searchInput && list) {
    const hostTh = btn.closest('th');
    if (hostTh) hostTh.classList.add('org-header-cell');
    btn.classList.add('org-filter-header');
    dropdown.classList.add('org-filter-dropdown');
    list.classList.add('org-filter-list');
    searchInput.classList.add('org-filter-search-input');
    applyOrgFilterInlineStyles(btn, dropdown, searchInput, list);
    return { btn: btn, dropdown: dropdown, searchInput: searchInput, list: list };
  }

  const table = document.querySelector('.personnel-table');
  if (!table) return null;

  let orgHeaderCell = table.querySelector('th.org-header-cell');
  if (!orgHeaderCell) {
    const headerCells = Array.prototype.slice.call(table.querySelectorAll('thead th'));
    orgHeaderCell = headerCells.find(function (th) {
      return normalizeValue(th && th.textContent).toLowerCase() === 'organization';
    }) || null;
    if (orgHeaderCell) orgHeaderCell.classList.add('org-header-cell');
  }

  if (!orgHeaderCell) return null;

  orgHeaderCell.innerHTML =
    '<button type="button" class="org-filter-header" id="org-filter-btn" aria-label="Filter by organization" aria-expanded="false" aria-haspopup="listbox">' +
      '<span>Organization</span>' +
      '<span class="org-filter-icon" aria-hidden="true">▼</span>' +
      '<span class="org-filter-badge" id="org-filter-badge" hidden>●</span>' +
    '</button>' +
    '<div class="org-filter-dropdown" id="org-filter-dropdown" hidden aria-label="Organization filter" role="listbox">' +
      '<div class="org-filter-search">' +
        '<input type="text" id="org-filter-search" placeholder="Search organizations..." class="org-filter-search-input" />' +
      '</div>' +
      '<div class="org-filter-list" id="org-filter-list" role="presentation"></div>' +
    '</div>';

  btn = document.getElementById('org-filter-btn');
  dropdown = document.getElementById('org-filter-dropdown');
  searchInput = document.getElementById('org-filter-search');
  list = document.getElementById('org-filter-list');
  if (btn && dropdown && searchInput && list) {
    applyOrgFilterInlineStyles(btn, dropdown, searchInput, list);
    return { btn: btn, dropdown: dropdown, searchInput: searchInput, list: list };
  }
  return null;
}

/**
 * Update org filter list without reinitializing (preserves state).
 */
function updateOrganizationList(records) {
  const dom = ensureOrganizationFilterDom();
  const list = dom && dom.list ? dom.list : null;
  console.log('[ORG-FILTER] updateOrganizationList - list element:', !!list, 'records:', records.length);
  if (!list) {
    console.error('[ORG-FILTER] org-filter-list element not found in DOM');
    return;
  }
  currentOrgs = getUniqueOrganizations(records);
  console.log('[ORG-FILTER] Updated org list:', currentOrgs);
  renderOrgOptions();
}

/**
 * Render org options (call from updateOrganizationList or search).
 */
function renderOrgOptions(filterText = '') {
  const dom = ensureOrganizationFilterDom();
  const list = dom && dom.list ? dom.list : null;
  if (!list) return;
  applyOrgFilterInlineStyles(dom && dom.btn ? dom.btn : null, dom && dom.dropdown ? dom.dropdown : null, dom && dom.searchInput ? dom.searchInput : null, list);
  const filtered = filterText
    ? currentOrgs.filter(function (o) { return o.toLowerCase().includes(filterText.toLowerCase()); })
    : currentOrgs;
  
  list.innerHTML = '';
  
  // "All" option
  const allOption = document.createElement('div');
  allOption.className = 'org-filter-option' + (organizationFilter === null ? ' org-filter-option--active' : '');
  allOption.setAttribute('role', 'option');
  allOption.setAttribute('aria-selected', organizationFilter === null ? 'true' : 'false');
  allOption.textContent = 'All Organizations';
  applyOrgFilterOptionInlineStyles(allOption, organizationFilter === null);
  allOption.addEventListener('click', function () {
    organizationFilter = null;
    console.log('[ORG-FILTER] Selected: All');
    const badge = document.getElementById('org-filter-badge');
    if (badge) badge.hidden = true;
    // Trigger rerender
    closeOrgDropdown();
  });
  list.appendChild(allOption);
  
  // Organization options
  filtered.forEach(function (org) {
    const option = document.createElement('div');
    option.className = 'org-filter-option' + (organizationFilter === org ? ' org-filter-option--active' : '');
    option.setAttribute('role', 'option');
    option.setAttribute('aria-selected', organizationFilter === org ? 'true' : 'false');
    option.textContent = org;
    applyOrgFilterOptionInlineStyles(option, organizationFilter === org);
    option.addEventListener('click', function () {
      organizationFilter = org;
      console.log('[ORG-FILTER] Selected org:', org);
      const badge = document.getElementById('org-filter-badge');
      if (badge) badge.hidden = false;
      // Trigger rerender
      closeOrgDropdown();
    });
    list.appendChild(option);
  });

  if (orgDropdownOpen) positionOrgDropdown();
}

/**
 * Global functions for dropdown management.
 */
let orgDropdownOpen = false;

function closeOrgDropdown() {
  const btn = document.getElementById('org-filter-btn');
  const dropdown = document.getElementById('org-filter-dropdown');
  if (dropdown) dropdown.hidden = true;
  if (btn) btn.setAttribute('aria-expanded', 'false');
  orgDropdownOpen = false;
  syncOrgFilterButtonState();
  // Trigger list update by calling rosterDisplayName to force a rerender
  const personnelTbody = document.getElementById('personnel-tbody');
  if (personnelTbody) {
    // Dispatch a custom event that main.js will catch
    window.dispatchEvent(new CustomEvent('phs-org-filter-changed'));
  }
}

/**
 * Extract unique organization values from records.
 */
function getUniqueOrganizations(records) {
  const orgs = new Map();
  records.forEach(function (r) {
    const raw = r && r.organization != null ? String(r.organization) : '';
    const key = normalizeOrganizationKey(raw);
    const label = normalizeOrganizationLabel(raw);
    if (!key || !label) return;
    if (!orgs.has(key)) orgs.set(key, label);
  });
  return Array.from(orgs.values()).sort();
}

/**
 * Build and manage the organization filter dropdown.
 */
function initializeOrganizationFilter(records, deps) {
  if (organizationFilterInitialized) {
    console.log('[ORG-FILTER] Already initialized, skipping');
    return;
  }
  const dom = ensureOrganizationFilterDom();
  const btn = dom && dom.btn ? dom.btn : null;
  const dropdown = dom && dom.dropdown ? dom.dropdown : null;
  const searchInput = dom && dom.searchInput ? dom.searchInput : null;
  console.log('[ORG-FILTER] Init - btn:', !!btn, 'dropdown:', !!dropdown, 'searchInput:', !!searchInput);
  if (!btn || !dropdown || !searchInput) {
    console.error('[ORG-FILTER] Missing required DOM elements. btn=' + !!btn + ', dropdown=' + !!dropdown + ', searchInput=' + !!searchInput);
    return;
  }
  console.log('[ORG-FILTER] All elements found, attaching listeners');
  organizationFilterInitialized = true;
  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    if (orgDropdownOpen) {
      closeOrgDropdown();
    } else {
      orgDropdownOpen = true;
      dropdown.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      requestAnimationFrame(function () {
        positionOrgDropdown();
        searchInput.focus();
      });
    }
  });
  searchInput.addEventListener('input', function () {
    renderOrgOptions(searchInput.value);
  });
  document.addEventListener('click', function (e) {
    if (!btn.contains(e.target) && !dropdown.contains(e.target)) {
      closeOrgDropdown();
    }
  });
  window.addEventListener('scroll', function () {
    if (orgDropdownOpen) positionOrgDropdown();
  }, true);
  window.addEventListener('resize', function () {
    if (orgDropdownOpen) positionOrgDropdown();
  });
  syncOrgFilterButtonState();
}

/**
 * Re-render the roster with both name search and org filter applied.
 */
function rerenderRoster(records, deps) {
  const query = (deps.searchInput && deps.searchInput.value || '').trim().toLowerCase();
  const canEdit = !!(deps.permissions && deps.permissions.canEdit);
  const canDelete = !!(deps.permissions && deps.permissions.canDelete);
  
  const filtered = records.filter(function (r) {
    // Apply organization filter
    const recordOrgKey = normalizeOrganizationKey(r && r.organization != null ? String(r.organization) : '');
    const selectedOrgKey = normalizeOrganizationKey(organizationFilter);
    if (organizationFilter !== null && recordOrgKey !== selectedOrgKey) {
      return false;
    }
    
    // Apply name search filter
    if (query) {
      const fn = rosterDisplayName(r).toLowerCase();
      const pos = (r.presentJob || '').toLowerCase();
      const org = (r.organization || '').toLowerCase();
      const mob = (r.mobile || '').toString().toLowerCase();
      const em = (r.email || '').toLowerCase();
      const edu = (formatEducationBackground(r) || '').toLowerCase();
      const sem = (formatSeminarsTraining(r) || '').toLowerCase();
      return fn.includes(query) || pos.includes(query) || org.includes(query) || mob.includes(query) || em.includes(query) || edu.includes(query) || sem.includes(query);
    }
    
    return true;
  });

  deps.personnelTbody.innerHTML = '';
  deps.emptyState.style.display = filtered.length ? 'none' : 'block';

  filtered.forEach(function (r) {
    const edu = formatEducationBackground(r);
    const sem = formatSeminarsTraining(r);
    const nameCell = escapeHtml(rosterDisplayName(r) || '—');
    const position = escapeHtml(r.presentJob || '—');
    const organization = escapeHtml(r.organization || '—');
    const contact = escapeHtml(r.mobile || r.email || '—');
    const safeId = escapeHtml(r.id || '');
    const pct = getRecordCompletenessPercent(r);
    const dateStr = formatDate(r.updatedAt);
    const tr = document.createElement('tr');
    const editBtnHtml = canEdit
      ? '<button type="button" class="btn roster-action-btn roster-action-btn--edit edit-btn" data-id="' + safeId + '"><span class="roster-action-btn__glyph" aria-hidden="true"></span>Edit</button>'
      : '';
    const deleteBtnHtml = canDelete
      ? '<button type="button" class="btn roster-action-btn roster-action-btn--delete delete-btn" data-id="' + safeId + '"><span class="roster-action-btn__glyph" aria-hidden="true"></span>Delete</button>'
      : '';
    tr.innerHTML =
      '<td class="avatar-cell">' + getAvatarHtml(r) + '</td>' +
      '<td class="name-cell"><span class="name-chip">' + nameCell + '</span></td>' +
      '<td>' + position + '</td>' +
      '<td>' + organization + '</td>' +
      '<td class="cell-multiline">' + escapeHtml(edu) + '</td>' +
      '<td class="cell-multiline">' + escapeHtml(sem) + '</td>' +
      '<td>' + contact + '</td>' +
      '<td class="progress-cell">' +
        '<div class="updated-meter" style="--completion:' + pct + '" title="' + pct + '% Complete">' +
        '<div class="updated-meter__ring" aria-hidden="true"></div>' +
        '<div class="updated-meter__pct">' + pct + '%</div>' +
        '</div></td>' +
      '<td class="date-cell">' +
        '<span class="updated-date">' + escapeHtml(dateStr) + '</span>' +
      '</td>' +
      '<td class="table-actions-cell">' +
        '<div class="table-actions table-actions--stacked" role="group" aria-label="Row actions">' +
        '<button type="button" class="btn roster-action-btn roster-action-btn--view view-btn" data-id="' + safeId + '"><span class="roster-action-btn__glyph" aria-hidden="true"></span>View</button>' +
        editBtnHtml +
        deleteBtnHtml +
        '</div>' +
      '</td>';
    deps.personnelTbody.appendChild(tr);
  });

  // Re-attach event listeners
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
      if (!id) return;
      showConfirm('Delete this personnel record?', { confirmText: 'Delete', cancelText: 'Cancel' }).then(function (confirmed) {
        if (!confirmed) return;
        const record = records.find(function (r) { return String(r.id) === String(id); });
        const version = record && record.version != null ? Number(record.version) : null;
        window.personnelApi.delete(id, version).then(function () {
          deps.loadList(true);
        }).catch(function (err) {
          window.toast.error('Delete failed: ' + (err && err.message ? err.message : String(err)));
        });
      });
    });
  });
}


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
  var emptyFields = [];
  FIELD_IDS.forEach(function (id) {
    var v = record[id];
    if (v == null) {
      emptyFields.push(id);
      return;
    }
    if (typeof v === 'string' && v.trim() === '') {
      emptyFields.push(id);
      return;
    }
    filled++;
  });
  var percent = Math.min(100, Math.round((filled / n) * 100));
  if (emptyFields.length > 0) {
    console.log('[PROGRESS DEBUG] Record:', record.id || 'unknown', 'Filled:', filled, '/', n, 'Percent:', percent, 'Empty fields:', emptyFields);
  }
  return percent;
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

export function renderList(records, deps) {
  console.log('[ORG-FILTER] renderList called with', records ? records.length : 0, 'records, deps:', !!deps);
  console.log('[LOADER] Rendering real records:', records.length);
  console.log('[ORG-FILTER] Current filter state:', organizationFilter);
  initializeOrganizationFilter(records, deps);
  updateOrganizationList(records);
  rerenderRoster(records, deps);
}

function createSkeletonRow() {
  const tr = document.createElement('tr');
  tr.className = 'skeleton-row';
  tr.setAttribute('aria-hidden', 'true');
  tr.innerHTML = 
    '<td class="avatar-cell"><div class="skeleton-cell skeleton--avatar" style="height:56px;"></div></td>' +
    '<td class="name-cell"><div class="skeleton-cell skeleton--name" style="height:14px;"></div></td>' +
    '<td><div class="skeleton-cell skeleton--medium" style="height:14px;"></div></td>' +
    '<td><div class="skeleton-cell skeleton--medium" style="height:14px;"></div></td>' +
    '<td class="cell-multiline"><div class="skeleton-cell skeleton--wide" style="height:12px;"></div><div class="skeleton-cell skeleton--medium" style="height:12px;margin-top:8px;"></div></td>' +
    '<td class="cell-multiline"><div class="skeleton-cell skeleton--wide" style="height:12px;"></div><div class="skeleton-cell skeleton--short" style="height:12px;margin-top:8px;"></div></td>' +
    '<td><div class="skeleton-cell skeleton--short" style="height:14px;"></div></td>' +
    '<td class="progress-cell"><div class="skeleton-cell skeleton--meter" style="height:42px;width:52px;margin:0 auto;border-radius:999px;"></div></td>' +
    '<td class="date-cell"><div class="skeleton-cell skeleton--short" style="height:12px;"></div></td>' +
    '<td class="table-actions-cell"><div class="skeleton-cell skeleton--button" style="height:28px;width:80px;margin-left:auto;border-radius:7px;"></div><div class="skeleton-cell skeleton--button" style="height:28px;width:80px;margin-left:auto;margin-top:6px;border-radius:7px;"></div></td>';
  return tr;
}

export function renderRosterSkeleton(deps, count) {
  console.log('[LOADER] Rendering dashboard-style loader for Personnels');
  
  if (deps.emptyState) {
    deps.emptyState.style.display = 'none';
  }

  // Show dashboard-style animated loader instead of skeleton rows
  const loaderHtml = `
    <tr style="pointer-events: none;">
      <td colspan="10" style="padding: 60px 0; text-align: center; border: none;">
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;">
          <div class="db-loader-dots" aria-hidden="true">
            <div class="db-loader-dot"></div>
            <div class="db-loader-dot"></div>
            <div class="db-loader-dot"></div>
          </div>
          <div class="db-loader-text">Loading personnel records...</div>
        </div>
      </td>
    </tr>
  `;
  
  deps.personnelTbody.innerHTML = loaderHtml;
  console.log('[LOADER] Dashboard loader inserted');
}
