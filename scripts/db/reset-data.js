// Remove all personnel and non-admin users from the primary database.
require('dotenv').config();
const { Client } = require('pg');

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  await c.query('BEGIN');

  // Delete all child tables (CASCADE from personnel would handle this, but be explicit)
  const childTables = [
    'personnel_children', 'personnel_places_of_residence', 'personnel_employment_history',
    'personnel_seminars_training', 'personnel_foreign_countries', 'personnel_banks_credit',
    'personnel_credit_references', 'personnel_character_refs', 'personnel_neighbors',
    'personnel_organizations', 'personnel_languages', 'personnel_card_registrations'
  ];
  for (const t of childTables) {
    await c.query('DELETE FROM ' + t);
    console.log('Cleared:', t);
  }

  // Delete all personnel
  await c.query('DELETE FROM personnel');
  console.log('Cleared: personnel');

  // Delete all cards
  await c.query('DELETE FROM cards');
  console.log('Cleared: cards');

  // Delete non-admin users (keep username = 'admin')
  const deleted = await c.query("DELETE FROM app_users WHERE LOWER(username) != 'admin' RETURNING username");
  console.log('Deleted users:', deleted.rows.map(r => r.username));

  // Clear audit logs
  await c.query('DELETE FROM audit_logs');
  console.log('Cleared: audit_logs');

  await c.query('COMMIT');
  console.log('\nDone. Only admin user remains.');
  await c.end();
})().catch(async e => { console.error('Failed:', e.message); process.exit(1); });
