// One-time migration: add personnel_id column to app_users.
// Must be run as a user with ALTER TABLE privileges (e.g. postgres superuser).
// Usage: DATABASE_URL=postgresql://postgres:...@host/db node scripts/db/add-personnel-id-to-app-users.js
require('dotenv').config();
const { Client } = require('pg');

(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error('DATABASE_URL not set'); process.exit(1); }
  const c = new Client({ connectionString: url });
  await c.connect();
  await c.query('ALTER TABLE app_users ADD COLUMN IF NOT EXISTS personnel_id text NULL');
  console.log('Done: personnel_id column ensured on app_users.');
  await c.end();
})().catch(e => { console.error('Migration failed:', e.message); process.exit(1); });
