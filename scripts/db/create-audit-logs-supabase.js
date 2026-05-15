// Create audit_logs table on Supabase if it doesn't exist.
require('dotenv').config();
const { Client } = require('pg');

(async () => {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) { console.error('SUPABASE_DB_URL not set'); process.exit(1); }
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  await c.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      table_name text NOT NULL,
      record_id text,
      action text NOT NULL,
      old_data jsonb,
      new_data jsonb,
      changed_by uuid,
      changed_at timestamptz NOT NULL DEFAULT NOW()
    )
  `);
  console.log('audit_logs table created on Supabase');
  await c.end();
})().catch(e => { console.error('Failed:', e.message); process.exit(1); });
