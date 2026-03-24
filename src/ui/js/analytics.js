import { escapeHtml, normalizeValue } from './escape.js';
import { buildDisplayFullName } from './form-data.js';

var EMPTY_CHART = '<div class="chart-empty">No data available yet.</div>';

/** @type {Array} full roster for scope dropdown (updated each render) */
var cachedRecords = [];

function monthKey(date) {
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
}

function monthLabelFromKey(key) {
  var parts = String(key).split('-');
  var d = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
  return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
}

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function rosterLabel(r) {
  if (!r) return '—';
  var n = buildDisplayFullName(r.nameLast, r.nameFirst, r.nameMiddle);
  if (n) return n;
  var f = normalizeValue(r.fullName);
  if (f) return f;
  var id = r.id != null ? String(r.id) : '';
  return id ? 'Record ' + id.slice(0, 12) : 'Unnamed record';
}

function pushUnique(arr, name) {
  if (arr.indexOf(name) === -1) arr.push(name);
}

function extractYearFromText(str) {
  if (str == null) return null;
  var m = String(str).match(/\b(19|20)\d{2}\b/);
  if (!m) return null;
  var y = parseInt(m[0], 10);
  if (y < 1900 || y > 2100) return null;
  return y;
}

function latestGraduationYear(record) {
  var fields = [record.pgGraduated, record.collegeGraduated, record.hsGraduated, record.elemGraduated];
  var best = null;
  for (var i = 0; i < fields.length; i++) {
    var y = extractYearFromText(fields[i]);
    if (y != null && (best == null || y > best)) best = y;
  }
  return best;
}

function graduationBracket(year) {
  if (year == null) return 'Unknown';
  if (year < 1990) return 'Before 1990';
  if (year <= 1999) return '1990–1999';
  if (year <= 2009) return '2000–2009';
  if (year <= 2019) return '2010–2019';
  return '2020–Present';
}

function hasEducationRecord(record) {
  var keys = [
    'elemLocation', 'elemAttendance', 'elemGraduated',
    'hsLocation', 'hsAttendance', 'hsGraduated',
    'collegeLocation', 'collegeAttendance', 'collegeGraduated',
    'pgLocation', 'pgCourseAttendance', 'pgGraduated',
    'otherSchools'
  ];
  for (var i = 0; i < keys.length; i++) {
    if (normalizeValue(record[keys[i]])) return true;
  }
  return false;
}

function educationAttainmentLevel(record) {
  var pgCourse = (normalizeValue(record.pgCourseAttendance) || '') + ' ' + (normalizeValue(record.pgLocation) || '');
  if (/\bph\.?\s*d\b|doctorate|\bdoctor\b|\bmd\b|\bj\.?\s*d\.?\b/i.test(pgCourse)) {
    return 'Doctorate';
  }
  if (normalizeValue(record.pgLocation)) return 'Post-Graduate';
  if (normalizeValue(record.collegeLocation)) return 'College Graduate';
  var other = normalizeValue(record.otherSchools) || '';
  if (other && /vocational|tech[\s-]?voc|tesda|techvoc|trade\s+school|technical\s+(school|college)|t\.?\s*i\.?\s*v\.?\s*t\.?/i.test(other)) {
    return 'Vocational/Tech-Voc';
  }
  if (normalizeValue(record.hsLocation)) return 'High School';
  if (normalizeValue(record.elemLocation)) return 'Elementary';
  return null;
}

function parseSeminarDateMonthKey(inclusiveDateStr) {
  var s = normalizeValue(inclusiveDateStr);
  if (!s) return null;
  var d = new Date(s);
  if (!isNaN(d.getTime())) return monthKey(d);
  var iso = s.match(/\b(20\d{2}|19\d{2})-(\d{1,2})(?:-(\d{1,2}))?\b/);
  if (iso) {
    var y = parseInt(iso[1], 10);
    var mo = Math.min(12, Math.max(1, parseInt(iso[2], 10)));
    return y + '-' + String(mo).padStart(2, '0');
  }
  var slash = s.match(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2}|19\d{2})\b/);
  if (slash) {
    var y2 = parseInt(slash[3], 10);
    var mo2 = Math.min(12, Math.max(1, parseInt(slash[1], 10)));
    return y2 + '-' + String(mo2).padStart(2, '0');
  }
  var monYear = s.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*[\s.,]+(20\d{2}|19\d{2})\b/i);
  if (monYear) {
    var months = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
    var mi = months[monYear[1].toLowerCase().slice(0, 3)];
    if (mi) {
      var y3 = parseInt(monYear[2], 10);
      return y3 + '-' + String(mi).padStart(2, '0');
    }
  }
  var yearOnly = s.match(/\b(20\d{2}|19\d{2})\b/);
  if (yearOnly) return yearOnly[1] + '-06';
  return null;
}

function fieldOfStudyLabel(record) {
  var pg = normalizeValue(record.pgCourseAttendance);
  if (pg) {
    var main = pg.split(/[;,]/)[0].trim();
    if (main.length > 1) return main;
  }
  var coll = normalizeValue(record.collegeLocation);
  if (coll) return coll;
  var other = normalizeValue(record.otherSchools);
  if (other) {
    var line = other.split(/\r?\n/)[0].split(/[;,]/)[0].trim();
    if (line.length > 2) return line;
  }
  return null;
}

function splitEntryLines(value) {
  return String(value || '')
    .split(/\r?\n/)
    .map(function (s) { return normalizeValue(s); })
    .filter(Boolean);
}

function syncScopeSelect(records) {
  var sel = document.getElementById('analytics-scope');
  if (!sel) return;
  var prev = sel.value;
  var opts = '<option value="">All personnel (combined totals)</option>';
  (records || []).forEach(function (r) {
    var id = r.id != null ? String(r.id) : '';
    if (!id) return;
    opts += '<option value="' + escapeAttr(id) + '">' + escapeHtml(rosterLabel(r)) + '</option>';
  });
  sel.innerHTML = opts;
  if (prev && Array.from(sel.options).some(function (o) { return o.value === prev; })) {
    sel.value = prev;
  } else {
    sel.value = '';
  }
}

function bindScopeChangeOnce() {
  var sel = document.getElementById('analytics-scope');
  if (!sel || sel.dataset.analyticsBound === '1') return;
  sel.dataset.analyticsBound = '1';
  sel.addEventListener('change', function () {
    renderAnalytics(cachedRecords);
  });
}

function bindMetricModeChangeOnce() {
  var sel = document.getElementById('analytics-metric-mode');
  if (!sel || sel.dataset.analyticsBound === '1') return;
  sel.dataset.analyticsBound = '1';
  sel.addEventListener('change', function () {
    renderAnalytics(cachedRecords);
  });
}

function metricMode() {
  var sel = document.getElementById('analytics-metric-mode');
  var val = sel && sel.value ? String(sel.value) : 'count';
  return val === 'percent' ? 'percent' : 'count';
}

function bindSearchFiltersOnce() {
  ['analytics-search-query', 'analytics-search-type'].forEach(function (id) {
    var input = document.getElementById(id);
    if (!input || input.dataset.analyticsBound === '1') return;
    input.dataset.analyticsBound = '1';
    var eventName = input.tagName === 'SELECT' ? 'change' : 'input';
    input.addEventListener(eventName, function () {
      renderAnalytics(cachedRecords);
    });
  });
}

function queryValue(id) {
  var el = document.getElementById(id);
  return el && el.value ? String(el.value).trim().toLowerCase() : '';
}

function educationSearchText(record) {
  var parts = [
    record.elemLocation,
    record.elemAttendance,
    record.elemGraduated,
    record.hsLocation,
    record.hsAttendance,
    record.hsGraduated,
    record.collegeLocation,
    record.collegeAttendance,
    record.collegeGraduated,
    record.pgLocation,
    record.pgCourseAttendance,
    record.pgGraduated,
    record.otherSchools,
    record.civilServiceEligibility
  ];
  return parts.map(function (v) { return normalizeValue(v); }).filter(Boolean).join(' ').toLowerCase();
}

function trainingSearchText(record) {
  var parts = [record.otherSchools];
  var seminars = Array.isArray(record.seminarsTraining) ? record.seminarsTraining : [];
  seminars.forEach(function (row) {
    parts.push(
      row && row.inclusiveDate,
      row && row.name,
      row && row.conductedBy,
      row && row.remarks
    );
  });
  return parts.map(function (v) { return normalizeValue(v); }).filter(Boolean).join(' ').toLowerCase();
}

function recordMatchesSearches(record, filters) {
  var query = filters.query;
  if (!query) return true;

  var nameText = [
    rosterLabel(record),
    normalizeValue(record.nameFirst),
    normalizeValue(record.nameMiddle),
    normalizeValue(record.nameLast),
    normalizeValue(record.fullName)
  ].join(' ').toLowerCase();
  var educationText = educationSearchText(record);
  var trainingText = trainingSearchText(record);

  if (filters.type === 'name') return nameText.indexOf(query) !== -1;
  if (filters.type === 'education') return educationText.indexOf(query) !== -1;
  if (filters.type === 'training') return trainingText.indexOf(query) !== -1;

  return [nameText, educationText, trainingText].join(' ').indexOf(query) !== -1;
}

function bindAnalyticsTabsOnce() {
  var buttons = Array.from(document.querySelectorAll('.analytics-tab-btn'));
  if (!buttons.length || buttons[0].dataset.analyticsBound === '1') return;
  buttons.forEach(function (btn) {
    btn.dataset.analyticsBound = '1';
    btn.addEventListener('click', function () {
      var selected = btn.getAttribute('data-analytics-tab');
      buttons.forEach(function (b) {
        var active = b === btn;
        b.classList.toggle('active', active);
        b.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      document.querySelectorAll('.analytics-panel').forEach(function (panel) {
        var show = panel.getAttribute('data-analytics-panel') === selected;
        panel.classList.toggle('active', show);
        panel.hidden = !show;
      });
    });
  });
}

function bindAnalyticsViewTabsOnce() {
  var buttons = Array.from(document.querySelectorAll('.analytics-view-tab-btn'));
  if (!buttons.length || buttons[0].dataset.analyticsBound === '1') return;
  buttons.forEach(function (btn) {
    btn.dataset.analyticsBound = '1';
    btn.addEventListener('click', function () {
      var selected = btn.getAttribute('data-analytics-view');
      buttons.forEach(function (b) {
        var active = b === btn;
        b.classList.toggle('active', active);
        b.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      document.querySelectorAll('.analytics-view-panel').forEach(function (panel) {
        var show = panel.getAttribute('data-analytics-view-panel') === selected;
        panel.hidden = !show;
      });
    });
  });
}

function updateScopeHint(selectedId, records) {
  var hint = document.getElementById('analytics-scope-hint');
  if (!hint) return;
  if (!selectedId) {
    hint.hidden = true;
    hint.innerHTML = '';
    return;
  }
  var person = (records || []).find(function (r) { return String(r.id) === String(selectedId); });
  var name = person ? rosterLabel(person) : 'Selected personnel';
  hint.innerHTML =
    'Showing education and training metrics for <strong>' + escapeHtml(name) + '</strong> only. ' +
    'Choose <em>All personnel</em> to see everyone and name lists under each chart.';
  hint.hidden = false;
}

function setBreakdownSlot(slotId, namesMap, orderedKeys, summaryTitle, showAggregate) {
  var el = document.getElementById(slotId);
  if (!el) return;
  if (!showAggregate) {
    el.innerHTML = '';
    el.hidden = true;
    return;
  }
  var keys = orderedKeys || Object.keys(namesMap || {}).sort();
  var parts = [];
  keys.forEach(function (k) {
    var arr = namesMap[k];
    if (!arr || !arr.length) return;
    var sorted = arr.slice().sort(function (a, b) { return a.localeCompare(b, undefined, { sensitivity: 'base' }); });
    parts.push('<dt>' + escapeHtml(k) + '</dt><dd>' + escapeHtml(sorted.join('; ')) + '</dd>');
  });
  if (!parts.length) {
    el.innerHTML = '';
    el.hidden = true;
    return;
  }
  el.innerHTML =
    '<details class="analytics-breakdown">' +
    '<summary>' + escapeHtml(summaryTitle) + '</summary>' +
    '<dl class="analytics-breakdown-dl">' + parts.join('') + '</dl>' +
    '</details>';
  el.hidden = false;
}

function renderBarChart(containerId, dataMap, options) {
  options = options || {};
  var host = document.getElementById(containerId);
  if (!host) return;
  var entries;
  if (options.fixedOrder && options.fixedOrder.length) {
    entries = options.fixedOrder.map(function (label) {
      return [label, dataMap[label] || 0];
    });
    if (options.omitZeroRows) {
      entries = entries.filter(function (e) { return e[1] > 0; });
    }
  } else {
    entries = Object.entries(dataMap || {}).sort(function (a, b) { return b[1] - a[1]; });
  }
  if (options.maxItems && entries.length > options.maxItems) {
    var top = entries.slice(0, options.maxItems);
    if (options.groupOthers) {
      var others = entries.slice(options.maxItems).reduce(function (acc, entry) { return acc + entry[1]; }, 0);
      if (others > 0) top.push(['Others', others]);
    }
    entries = top;
  }
  if (!entries.length) {
    host.innerHTML = EMPTY_CHART;
    return;
  }
  var sum = entries.reduce(function (acc, e) { return acc + e[1]; }, 0);
  if (options.treatAllZeroAsEmpty && sum === 0) {
    host.innerHTML = EMPTY_CHART;
    return;
  }
  var max = Math.max.apply(null, entries.map(function (e) { return e[1]; })) || 1;
  var labelClass = options.wideLabels ? ' bar-row__label--wide' : '';
  var mode = options.valueMode === 'percent' ? 'percent' : 'count';
  host.innerHTML = '<div class="bar-chart">' + entries.map(function (entry) {
    var labelText = String(entry[0]);
    var shortLabel = labelText.length > 68 ? labelText.slice(0, 65) + '...' : labelText;
    var width = Math.max(4, Math.round((entry[1] / max) * 100));
    var pct = sum > 0 ? (entry[1] / sum) * 100 : 0;
    var valueText = mode === 'percent'
      ? pct.toFixed(pct >= 10 ? 0 : 1) + '% (' + entry[1] + ')'
      : String(entry[1]) + ' (' + pct.toFixed(pct >= 10 ? 0 : 1) + '%)';
    return '' +
      '<div class="bar-row">' +
        '<div class="bar-row__label' + labelClass + '"><span class="bar-row__label-text" title="' + escapeAttr(labelText) + '">' + escapeHtml(shortLabel) + '</span></div>' +
        '<div class="bar-track"><div class="bar-fill" style="width:' + width + '%"></div></div>' +
        '<div class="bar-value">' + escapeHtml(valueText) + '</div>' +
      '</div>';
  }).join('') + '</div>';
}

function renderPieChart(containerId, dataMap, options) {
  options = options || {};
  var host = document.getElementById(containerId);
  if (!host) return;

  var entries = (options.fixedOrder && options.fixedOrder.length
    ? options.fixedOrder.map(function (label) { return [label, dataMap[label] || 0]; })
    : Object.entries(dataMap || {}).sort(function (a, b) { return b[1] - a[1]; })
  ).filter(function (e) { return Number(e[1]) > 0; });

  if (!entries.length) {
    host.innerHTML = EMPTY_CHART;
    return;
  }

  var total = entries.reduce(function (acc, e) { return acc + Number(e[1] || 0); }, 0);
  if (!total) {
    host.innerHTML = EMPTY_CHART;
    return;
  }

  var palette = options.colors || ['#1f4e79', '#2a7f9e', '#5aa469', '#f2a541', '#8e7dbe', '#cc6f6f'];
  var mode = options.valueMode === 'percent' ? 'percent' : 'count';

  var cursor = 0;
  var slices = entries.map(function (entry, idx) {
    var value = Number(entry[1] || 0);
    var pct = (value / total) * 100;
    var start = cursor;
    cursor += pct;
    return {
      label: String(entry[0]),
      value: value,
      pct: pct,
      color: palette[idx % palette.length],
      range: palette[idx % palette.length] + ' ' + start.toFixed(2) + '% ' + cursor.toFixed(2) + '%'
    };
  });

  var pieGradient = slices.map(function (s) { return s.range; }).join(', ');
  var legend = slices.map(function (s) {
    var valueText = mode === 'percent'
      ? s.pct.toFixed(s.pct >= 10 ? 0 : 1) + '% (' + s.value + ')'
      : s.value + ' (' + s.pct.toFixed(s.pct >= 10 ? 0 : 1) + '%)';
    return '' +
      '<li class="analytics-pie-legend-item">' +
        '<span class="analytics-pie-legend-swatch" style="background:' + s.color + '"></span>' +
        '<span class="analytics-pie-legend-label" title="' + escapeAttr(s.label) + '">' + escapeHtml(s.label) + '</span>' +
        '<span class="analytics-pie-legend-value">' + escapeHtml(valueText) + '</span>' +
      '</li>';
  }).join('');

  host.innerHTML = '' +
    '<div class="analytics-pie-wrap">' +
      '<div class="analytics-pie-chart" style="--analytics-pie:' + escapeAttr(pieGradient) + '">' +
        '<div class="analytics-pie-center">' +
          '<span class="analytics-pie-center-label">Total</span>' +
          '<strong class="analytics-pie-center-value">' + total + '</strong>' +
        '</div>' +
      '</div>' +
      '<ul class="analytics-pie-legend">' + legend + '</ul>' +
    '</div>';
}

function topLabelFromMap(dataMap) {
  var entries = Object.entries(dataMap || {}).sort(function (a, b) { return b[1] - a[1]; });
  if (!entries.length || entries[0][1] <= 0) return 'None';
  return entries[0][0] + ' (' + entries[0][1] + ')';
}

function topLabelFromEntries(entries) {
  if (!entries || !entries.length || entries[0][1] <= 0) return 'None';
  return entries[0][0] + ' (' + entries[0][1] + ')';
}

function hasCivilServiceEligibility(record) {
  return !!normalizeValue(record && record.civilServiceEligibility);
}

function hasTrainingEntry(record) {
  var seminars = Array.isArray(record && record.seminarsTraining) ? record.seminarsTraining : [];
  if (seminars.some(function (row) {
    return normalizeValue(row && row.name) || normalizeValue(row && row.inclusiveDate) || normalizeValue(row && row.conductedBy);
  })) {
    return true;
  }
  return !!normalizeValue(record && record.otherSchools);
}

function renderKeyFindingsGraph(summary, valueMode) {
  var note = document.getElementById('analytics-key-findings-note');
  var total = summary && summary.total ? Number(summary.total) : 0;
  if (!total) {
    renderPieChart('chart-key-findings-overview', {}, {});
    if (note) note.textContent = 'No records match the current filters.';
    return;
  }

  var map = {
    'With Education Records': summary.withEdu || 0,
    'With Training/Seminar Entries': summary.withTraining || 0,
    'Trained This Month': summary.trainedThisMonth || 0,
    'With Civil Service Eligibility': summary.withCivilService || 0
  };

  renderPieChart('chart-key-findings-overview', map, {
    fixedOrder: [
      'With Education Records',
      'With Training/Seminar Entries',
      'Trained This Month',
      'With Civil Service Eligibility'
    ],
    valueMode: valueMode,
    colors: ['#1f4e79', '#2a7f9e', '#5aa469', '#f2a541']
  });

  if (note) {
    note.textContent =
      'Based on ' + total + ' filtered personnel records. Top attainment: ' + summary.topAttainment +
      '; Top field/course: ' + summary.topField +
      '; Top training program: ' + summary.topProgram +
      '; Top civil service entry: ' + summary.topEligibility + '. ' +
      'These pie slices represent distribution across key metrics and may overlap by personnel.';
  }
}

export function renderAnalytics(records) {
  records = records || [];
  cachedRecords = records;
  bindAnalyticsViewTabsOnce();
  bindAnalyticsTabsOnce();
  bindScopeChangeOnce();
  bindMetricModeChangeOnce();
  bindSearchFiltersOnce();
  syncScopeSelect(records);

  var sel = document.getElementById('analytics-scope');
  var selectedId = sel && sel.value ? String(sel.value) : '';
  updateScopeHint(selectedId, records);

  var scoped = selectedId
    ? records.filter(function (r) { return String(r.id) === selectedId; })
    : records;

  var filters = {
    type: queryValue('analytics-search-type') || 'all',
    query: queryValue('analytics-search-query')
  };

  var subset = scoped.filter(function (r) {
    return recordMatchesSearches(r, filters);
  });

  var showAggregateBreakdowns = !selectedId && records.length > 0;
  var valueMode = metricMode();

  var total = subset.length;
  var withEdu = subset.filter(hasEducationRecord).length;
  var withCivilService = subset.filter(hasCivilServiceEligibility).length;
  var withTraining = subset.filter(hasTrainingEntry).length;

  var now = new Date();
  var thisMonthKey = monthKey(now);
  var trainedThisMonth = 0;

  subset.forEach(function (r) {
    var items = r.seminarsTraining;
    if (!Array.isArray(items) || !items.length) return;
    var hit = items.some(function (row) {
      var k = parseSeminarDateMonthKey(row && row.inclusiveDate);
      return k === thisMonthKey;
    });
    if (hit) trainedThisMonth += 1;
  });

  var kpiTotal = document.getElementById('kpi-total');
  var kpiEdu = document.getElementById('kpi-education-records');
  var kpiTrain = document.getElementById('kpi-trained-month');
  if (kpiTotal) kpiTotal.textContent = String(total);
  if (kpiEdu) kpiEdu.textContent = String(withEdu);
  if (kpiTrain) kpiTrain.textContent = String(trainedThisMonth);

  var eduOrder = [
    'Elementary',
    'High School',
    'Vocational/Tech-Voc',
    'College Graduate',
    'Post-Graduate',
    'Doctorate'
  ];
  var eduMap = {};
  var eduToNames = {};
  eduOrder.forEach(function (l) {
    eduMap[l] = 0;
    eduToNames[l] = [];
  });
  subset.forEach(function (r) {
    var level = educationAttainmentLevel(r);
    if (level && Object.prototype.hasOwnProperty.call(eduMap, level)) {
      eduMap[level] += 1;
      pushUnique(eduToNames[level], rosterLabel(r));
    }
  });
  renderBarChart('chart-education-level', eduMap, {
    fixedOrder: eduOrder,
    omitZeroRows: true,
    wideLabels: true,
    valueMode: valueMode
  });
  setBreakdownSlot(
    'breakdown-education-level',
    eduToNames,
    eduOrder,
    'Which personnel are counted in each attainment level',
    showAggregateBreakdowns
  );

  var fieldMap = {};
  var fieldToNames = {};
  subset.forEach(function (r) {
    var f = fieldOfStudyLabel(r);
    if (!f) return;
    fieldMap[f] = (fieldMap[f] || 0) + 1;
    if (!fieldToNames[f]) fieldToNames[f] = [];
    pushUnique(fieldToNames[f], rosterLabel(r));
  });
  var topFieldEntries = Object.entries(fieldMap).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 10);
  var topFields = Object.fromEntries(topFieldEntries);
  var topFieldKeys = topFieldEntries.map(function (e) { return e[0]; });
  renderBarChart('chart-field-course', topFields, {
    wideLabels: true,
    valueMode: valueMode,
    maxItems: 8,
    groupOthers: true
  });
  setBreakdownSlot(
    'breakdown-field-course',
    fieldToNames,
    topFieldKeys,
    'Which personnel are listed under each field or course',
    showAggregateBreakdowns
  );

  var bracketOrder = ['Before 1990', '1990–1999', '2000–2009', '2010–2019', '2020–Present', 'Unknown'];
  var bracketMap = {};
  var bracketToNames = {};
  bracketOrder.forEach(function (b) {
    bracketMap[b] = 0;
    bracketToNames[b] = [];
  });
  subset.forEach(function (r) {
    var y = latestGraduationYear(r);
    var b = graduationBracket(y);
    if (Object.prototype.hasOwnProperty.call(bracketMap, b)) {
      bracketMap[b] += 1;
      pushUnique(bracketToNames[b], rosterLabel(r));
    }
  });
  renderBarChart('chart-grad-year', bracketMap, {
    fixedOrder: bracketOrder,
    omitZeroRows: true,
    wideLabels: true,
    valueMode: valueMode
  });
  setBreakdownSlot(
    'breakdown-grad-year',
    bracketToNames,
    bracketOrder,
    'Which personnel fall in each graduation year bracket',
    showAggregateBreakdowns
  );

  var monthlyTraining = {};
  var monthToNames = {};
  for (var i = 5; i >= 0; i--) {
    var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    var key = monthKey(d);
    var lbl = monthLabelFromKey(key);
    monthlyTraining[lbl] = 0;
    monthToNames[lbl] = [];
  }

  subset.forEach(function (r) {
    var items = r.seminarsTraining;
    if (!Array.isArray(items)) return;
    var seenLabels = {};
    var label = rosterLabel(r);
    items.forEach(function (row) {
      var k = parseSeminarDateMonthKey(row && row.inclusiveDate);
      if (!k) return;
      var ml = monthLabelFromKey(k);
      if (!Object.prototype.hasOwnProperty.call(monthlyTraining, ml)) return;
      if (seenLabels[ml]) return;
      seenLabels[ml] = true;
      monthlyTraining[ml] += 1;
      pushUnique(monthToNames[ml], label);
    });
  });

  var monthKeysOrder = Object.keys(monthlyTraining);
  renderBarChart('chart-training-monthly', monthlyTraining, {
    fixedOrder: monthKeysOrder,
    omitZeroRows: false,
    treatAllZeroAsEmpty: true,
    valueMode: valueMode
  });
  setBreakdownSlot(
    'breakdown-training-monthly',
    monthToNames,
    monthKeysOrder,
    'Who completed at least one training or seminar in each month (once per person per month)',
    showAggregateBreakdowns
  );

  var programToNames = {};
  subset.forEach(function (r) {
    var items = r.seminarsTraining;
    if (!Array.isArray(items)) return;
    var seenProg = {};
    var label = rosterLabel(r);
    items.forEach(function (row) {
      var n = normalizeValue(row && row.name);
      if (!n) return;
      if (seenProg[n]) return;
      seenProg[n] = true;
      if (!programToNames[n]) programToNames[n] = [];
      pushUnique(programToNames[n], label);
    });
  });
  var programCounts = {};
  Object.keys(programToNames).forEach(function (name) {
    programCounts[name] = programToNames[name].length;
  });
  var topProgramEntries = Object.entries(programCounts).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 12);
  var topPrograms = Object.fromEntries(topProgramEntries);
  var topProgramKeys = topProgramEntries.map(function (e) { return e[0]; });
  renderBarChart('chart-top-programs', topPrograms, {
    wideLabels: true,
    valueMode: valueMode,
    maxItems: 10,
    groupOthers: true
  });
  setBreakdownSlot(
    'breakdown-top-programs',
    programToNames,
    topProgramKeys,
    'Which personnel attended each training or seminar (counted once per program per person)',
    showAggregateBreakdowns
  );

  var otherTrainingToNames = {};
  subset.forEach(function (r) {
    var lines = splitEntryLines(r.otherSchools);
    if (!lines.length) return;
    var seen = {};
    var label = rosterLabel(r);
    lines.forEach(function (line) {
      if (seen[line]) return;
      seen[line] = true;
      if (!otherTrainingToNames[line]) otherTrainingToNames[line] = [];
      pushUnique(otherTrainingToNames[line], label);
    });
  });
  var otherTrainingCounts = {};
  Object.keys(otherTrainingToNames).forEach(function (name) {
    otherTrainingCounts[name] = otherTrainingToNames[name].length;
  });
  var otherTrainingEntries = Object.entries(otherTrainingCounts).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 12);
  var otherTrainingTop = Object.fromEntries(otherTrainingEntries);
  var otherTrainingKeys = otherTrainingEntries.map(function (e) { return e[0]; });
  renderBarChart('chart-other-schools-training', otherTrainingTop, {
    wideLabels: true,
    valueMode: valueMode,
    maxItems: 8,
    groupOthers: true
  });
  setBreakdownSlot(
    'breakdown-other-schools-training',
    otherTrainingToNames,
    otherTrainingKeys,
    'Which personnel reported each other school or training item',
    showAggregateBreakdowns
  );

  var civilServiceToNames = {};
  subset.forEach(function (r) {
    var lines = splitEntryLines(r.civilServiceEligibility);
    if (!lines.length) return;
    var seenCivil = {};
    var label = rosterLabel(r);
    lines.forEach(function (line) {
      if (seenCivil[line]) return;
      seenCivil[line] = true;
      if (!civilServiceToNames[line]) civilServiceToNames[line] = [];
      pushUnique(civilServiceToNames[line], label);
    });
  });
  var civilServiceCounts = {};
  Object.keys(civilServiceToNames).forEach(function (name) {
    civilServiceCounts[name] = civilServiceToNames[name].length;
  });
  var civilServiceEntries = Object.entries(civilServiceCounts).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 12);
  var civilServiceTop = Object.fromEntries(civilServiceEntries);
  var civilServiceKeys = civilServiceEntries.map(function (e) { return e[0]; });
  renderBarChart('chart-civil-service-eligibility', civilServiceTop, {
    wideLabels: true,
    valueMode: valueMode,
    maxItems: 8,
    groupOthers: true
  });
  setBreakdownSlot(
    'breakdown-civil-service-eligibility',
    civilServiceToNames,
    civilServiceKeys,
    'Which personnel reported each civil service eligibility/date-acquired entry',
    showAggregateBreakdowns
  );

  renderKeyFindingsGraph({
    total: total,
    withEdu: withEdu,
    withCivilService: withCivilService,
    withTraining: withTraining,
    trainedThisMonth: trainedThisMonth,
    topAttainment: topLabelFromMap(eduMap),
    topField: topLabelFromEntries(topFieldEntries),
    topProgram: topLabelFromEntries(topProgramEntries),
    topEligibility: topLabelFromEntries(civilServiceEntries)
  }, valueMode);
}
