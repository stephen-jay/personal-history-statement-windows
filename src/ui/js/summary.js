import { buildOfficialPrintHtml } from './phs-print-document.js';

/**
 * View modal: full official PHS layout (aligned with PERSONNEL HISTORY STATEMENT.docx).
 */
export function buildSummaryHtml(record) {
  const historyHtml = `
    <div class="profile-card profile-card--span profile-history-card" style="margin-top: 24px; padding: 20px; background: #fff; border: 1px solid #dce3ec; border-radius: 12px;">
      <h3 style="margin-top: 0; color: #1f3b63; font-size: 1.1rem; border-bottom: 2px solid #1f3b63; padding-bottom: 8px;">Record History & Audit Trail</h3>
      <div class="history-timeline" id="profile-history-timeline">
        <p style="font-size:0.85rem; color:#64748b; padding:10px;">Loading history from database...</p>
      </div>
    </div>
  `;

  return (
    '<div class="summary-phs-document">' +
    buildOfficialPrintHtml(record || {}) +
    historyHtml +
    '</div>'
  );
}
