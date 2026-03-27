import { buildOfficialPrintHtml } from './phs-print-document.js';

var FALLBACK_CSS =
  'body{margin:0;font-family:Arial,sans-serif;font-size:10.5pt;color:#000;}' +
  '.phs-print-table{width:100%;border-collapse:collapse;}' +
  '.phs-print-table td,.phs-print-table th{border:1px solid #000;padding:4px;}' +
  '.phs-print-title{text-align:center;text-transform:uppercase;font-size:12pt;}' +
  '.phs-print-cell-line{display:block;min-height:14px;border-bottom:1px solid #000;}';

/**
 * @param {object|null|undefined} record
 * @returns {string}
 */
export function suggestedExportBasename(record) {
  var last = record && record.nameLast && String(record.nameLast).trim();
  if (!last) last = 'Personnel';
  var safe = last.replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '_').slice(0, 80);
  return 'PHS_' + safe;
}

/**
 * Full HTML document for PDF/Word export and print-to-PDF in main process.
 * @param {object} record
 * @returns {Promise<string>}
 */
export async function buildStandalonePhsHtml(record) {
  var cssText = FALLBACK_CSS;
  try {
    var res = await fetch('css/phs-print-export.css');
    if (res.ok) {
      var t = await res.text();
      if (t && t.trim()) cssText = t;
    }
  } catch (_) {
    /* use fallback */
  }
  var inner = buildOfficialPrintHtml(record || {});
  return (
    '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>Personnel History Statement</title>' +
    '<style>' + cssText + '</style></head><body>' +
    inner +
    '</body></html>'
  );
}
