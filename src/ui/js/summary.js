import { buildOfficialPrintHtml } from './phs-print-document.js';

/**
 * View modal: full official PHS layout (aligned with PERSONNEL HISTORY STATEMENT.docx).
 */
export function buildSummaryHtml(record) {
  return (
    '<div class="summary-phs-document">' +
    buildOfficialPrintHtml(record || {}) +
    '</div>'
  );
}
