// Clear audit_logs on both Ubuntu primary and Supabase.
require('dotenv').config();
const { Client } = require('pg');

async function truncate(label, url, ssl) {
  if (!url) { console.log(label + ': skipped (no URL)'); return; }
  const c = new Client({ connectionString: url, ssl: ssl || undefined, connectionTimeoutMillis: 10000 });
  try {
    await c.connect();
    await c.query('TRUNCATE audit_logs');
    console.log(label + ': audit_logs cleared');
    await c.end();
  } catch (e) {
    console.error(label + ': failed -', e.message);
    try { await c.end(); } catch (_) {}
  }
}

(async () => {
  await truncate('Ubuntu', process.env.DATABASE_URL, false);
  await truncate('Supabase', process.env.SUPABASE_DB_URL, { rejectUnauthorized: false });
})();
