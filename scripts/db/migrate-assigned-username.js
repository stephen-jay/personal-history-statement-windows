require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('Adding personnel_id column to app_users if not exists...');
    await client.query('ALTER TABLE app_users ADD COLUMN IF NOT EXISTS personnel_id text NULL');

    console.log('Backfilling personnel_id in app_users by full_name match...');
    const resUsers = await client.query(`
      UPDATE app_users u
      SET personnel_id = p.id
      FROM personnel p
      WHERE (LOWER(TRIM(u.full_name)) = LOWER(TRIM(p.full_name)) OR LOWER(TRIM(u.full_name)) = LOWER(TRIM(p.name_last || ', ' || p.name_first)))
        AND u.full_name IS NOT NULL AND u.full_name != ''
        AND u.personnel_id IS NULL
      RETURNING u.username, u.full_name, u.personnel_id
    `);
    console.log(`Updated ${resUsers.rowCount} users with personnel_id.`);
    if (resUsers.rows.length > 0) console.table(resUsers.rows);

    console.log('Backfilling assigned_username in cards table...');
    
    // Path 1: Using personnel_id link in app_users (most reliable after backfill)
    const resCards1 = await client.query(`
      UPDATE cards c
      SET assigned_username = u.username
      FROM app_users u
      WHERE c.personnel_id = u.personnel_id
        AND c.assigned_username IS NULL
        AND u.personnel_id IS NOT NULL
      RETURNING c.card_uid, c.assigned_username, c.personnel_id
    `);
    console.log(`Updated ${resCards1.rowCount} cards via explicit personnel_id link.`);
    if (resCards1.rows.length > 0) console.table(resCards1.rows);

    // Path 2: Using name matching via personnel table (fallback)
    const resCards2 = await client.query(`
      UPDATE cards c
      SET assigned_username = u.username
      FROM personnel p
      JOIN app_users u ON (LOWER(TRIM(u.full_name)) = LOWER(TRIM(p.full_name)) OR LOWER(TRIM(u.full_name)) = LOWER(TRIM(p.name_last || ', ' || p.name_first)))
      WHERE c.personnel_id = p.id
        AND c.assigned_username IS NULL
        AND u.full_name IS NOT NULL AND u.full_name != ''
      RETURNING c.card_uid, c.assigned_username, c.personnel_id
    `);
    console.log(`Updated ${resCards2.rowCount} cards via name-match fallback.`);
    if (resCards2.rows.length > 0) console.table(resCards2.rows);

    await client.query('COMMIT');
    console.log('\n✅ Migration complete.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', e);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
