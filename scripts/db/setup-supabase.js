/**
 * scripts/db/setup-supabase.js
 *
 * Verifies the Supabase connection using the DB URL from .env
 * and reports which tables already exist.
 *
 * Usage:
 *   node scripts/db/setup-supabase.js
 *
 * IMPORTANT: Run this AFTER pasting supabase-init.sql into the
 * Supabase SQL Editor to verify everything was created correctly.
 */

'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const { Pool } = require('pg');

const SUPABASE_DB_URL = process.env.SUPABASE_DB_URL;

if (!SUPABASE_DB_URL) {
  console.error('[ERROR] SUPABASE_DB_URL is not set in .env');
  process.exit(1);
}

const EXPECTED_TABLES = [
  'personnel',
  'personnel_children',
  'personnel_places_of_residence',
  'personnel_employment_history',
  'personnel_seminars_training',
  'personnel_foreign_countries',
  'personnel_banks_credit',
  'personnel_credit_references',
  'personnel_character_refs',
  'personnel_neighbors',
  'personnel_organizations',
  'personnel_languages',
  'cards',
  'personnel_card_registrations',
  'app_users',
  'app_user_totp',
  'auth_challenges',
];

async function main() {
  console.log('='.repeat(60));
  console.log('PHS Supabase Connection & Schema Verification');
  console.log('='.repeat(60));
  console.log('Connecting to Supabase...');

  const pool = new Pool({
    connectionString: SUPABASE_DB_URL,
    connectionTimeoutMillis: 5000,
    ssl: { rejectUnauthorized: false },
  });

  let client;
  try {
    client = await pool.connect();
    console.log('✅ Connected to Supabase successfully!\n');

    // Check which tables exist
    const res = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    const existingTables = new Set(res.rows.map(r => r.table_name));

    console.log('Table Status:');
    console.log('-'.repeat(50));

    let allGood = true;
    for (const table of EXPECTED_TABLES) {
      const exists = existingTables.has(table);
      console.log(`  ${exists ? '✅' : '❌'} ${table}`);
      if (!exists) allGood = false;
    }

    console.log('-'.repeat(50));

    if (allGood) {
      console.log('\n✅ All tables verified! Supabase is ready as fallback DB.\n');
    } else {
      console.log('\n⚠️  Some tables are missing.');
      console.log('   → Go to Supabase Dashboard → SQL Editor');
      console.log('   → Paste and run: db/supabase-init.sql');
      console.log('   → Then re-run this script to verify.\n');
    }

    // Quick row count on personnel
    if (existingTables.has('personnel')) {
      const count = await client.query('SELECT COUNT(*) FROM personnel WHERE deleted_at IS NULL');
      console.log(`Personnel records in Supabase: ${count.rows[0].count}`);
    }

  } catch (e) {
    console.error('\n❌ Connection failed:', e && e.message ? e.message : e);
    console.log('\nCheck that SUPABASE_DB_URL in .env is correct.');
    console.log('Format: postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres');
    process.exit(1);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
