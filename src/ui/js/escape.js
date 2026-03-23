export function normalizeValue(val) {
  if (val == null) return null;
  const trimmed = String(val).trim();
  return trimmed === '' ? null : trimmed;
}

export function escapeHtml(value) {
  return String(value == null ? 'N/A' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
