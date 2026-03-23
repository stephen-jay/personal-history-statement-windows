import { escapeHtml } from './escape.js';

function monthKey(date) {
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
}

function monthLabelFromKey(key) {
  var parts = String(key).split('-');
  var d = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
  return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
}

function mapCounts(records, getter) {
  return records.reduce(function (acc, record) {
    var key = getter(record);
    if (!key) key = 'Unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function renderBarChart(containerId, dataMap) {
  var host = document.getElementById(containerId);
  if (!host) return;
  var entries = Object.entries(dataMap || {}).sort(function (a, b) { return b[1] - a[1]; });
  if (!entries.length) {
    host.innerHTML = '<div class="chart-empty">No data available yet.</div>';
    return;
  }
  var max = entries[0][1] || 1;
  host.innerHTML = '<div class="bar-chart">' + entries.map(function (entry) {
    var width = Math.max(4, Math.round((entry[1] / max) * 100));
    return '' +
      '<div class="bar-row">' +
        '<div>' + escapeHtml(entry[0]) + '</div>' +
        '<div class="bar-track"><div class="bar-fill" style="width:' + width + '%"></div></div>' +
        '<div class="bar-value">' + entry[1] + '</div>' +
      '</div>';
  }).join('') + '</div>';
}

export function renderAnalytics(records) {
  var total = records.length;
  var ageFilled = records.filter(function (r) { return r.age != null && String(r.age).trim() !== ''; }).length;
  var now = new Date();
  var thisMonth = records.filter(function (r) {
    if (!r.updatedAt) return false;
    var d = new Date(r.updatedAt);
    return !isNaN(d.getTime()) && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  var kpiTotal = document.getElementById('kpi-total');
  var kpiAge = document.getElementById('kpi-age-filled');
  var kpiMonth = document.getElementById('kpi-updated-month');
  if (kpiTotal) kpiTotal.textContent = String(total);
  if (kpiAge) kpiAge.textContent = String(ageFilled);
  if (kpiMonth) kpiMonth.textContent = String(thisMonth);

  var sexMap = mapCounts(records, function (r) { return r.sex; });
  var maritalMap = mapCounts(records, function (r) { return r.maritalStatus; });

  var ageMap = { '18-24': 0, '25-34': 0, '35-44': 0, '45-54': 0, '55+': 0, Unknown: 0 };
  records.forEach(function (r) {
    var age = Number(r.age);
    if (!isFinite(age) || age <= 0) { ageMap.Unknown += 1; return; }
    if (age <= 24) ageMap['18-24'] += 1;
    else if (age <= 34) ageMap['25-34'] += 1;
    else if (age <= 44) ageMap['35-44'] += 1;
    else if (age <= 54) ageMap['45-54'] += 1;
    else ageMap['55+'] += 1;
  });

  var monthlyMap = {};
  for (var i = 5; i >= 0; i--) {
    var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    var key = monthKey(d);
    monthlyMap[monthLabelFromKey(key)] = 0;
  }
  records.forEach(function (r) {
    if (!r.updatedAt) return;
    var d = new Date(r.updatedAt);
    if (isNaN(d.getTime())) return;
    var label = monthLabelFromKey(monthKey(d));
    if (Object.prototype.hasOwnProperty.call(monthlyMap, label)) monthlyMap[label] += 1;
  });

  var assignmentMap = mapCounts(records, function (r) {
    return r.presentJob ? String(r.presentJob).trim() : null;
  });
  var topAssignments = Object.fromEntries(
    Object.entries(assignmentMap).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 6)
  );

  renderBarChart('chart-sex', sexMap);
  renderBarChart('chart-marital', maritalMap);
  renderBarChart('chart-age', ageMap);
  renderBarChart('chart-monthly', monthlyMap);
  renderBarChart('chart-assignment', topAssignments);
}
