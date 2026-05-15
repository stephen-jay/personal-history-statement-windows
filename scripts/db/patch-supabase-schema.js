'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const { Pool } = require('pg');

const url = new URL(process.env.SUPABASE_DB_URL);
const pool = new Pool({
  host: url.hostname, port: parseInt(url.port),
  database: url.pathname.replace('/', ''),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const client = await pool.connect();
  try {
    console.log('Patching app_users schema in Supabase...');

    await client.query(`
      ALTER TABLE app_users
        ADD COLUMN IF NOT EXISTS full_name text,
        ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

      CREATE TABLE IF NOT EXISTS app_roles (
        id   serial PRIMARY KEY,
        name text UNIQUE NOT NULL
      );
      ALTER TABLE app_roles ENABLE ROW LEVEL SECURITY;

      CREATE TABLE IF NOT EXISTS app_user_roles (
        user_id uuid    NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
        role_id integer NOT NULL REFERENCES app_roles(id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, role_id)
      );
      ALTER TABLE app_user_roles ENABLE ROW LEVEL SECURITY;

      INSERT INTO app_roles (name) VALUES ('admin'),('user'),('viewer')
        ON CONFLICT (name) DO NOTHING;
    `);

    // Link existing admin user to admin role
    const adminRes = await client.query(`SELECT id FROM app_users WHERE username = 'admin'`);
    if (adminRes.rows.length) {
      const adminId = adminRes.rows[0].id;
      const roleRes = await client.query(`SELECT id FROM app_roles WHERE name = 'admin'`);
      const roleId  = roleRes.rows[0].id;
      await client.query(
        `INSERT INTO app_user_roles (user_id, role_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [adminId, roleId]
      );
      // Also set full_name for admin
      await client.query(
        `UPDATE app_users SET full_name = 'Administrator', is_active = true WHERE id = $1`,
        [adminId]
      );
      console.log('✅ Admin user patched and linked to admin role.');
    }

    console.log('\n✅ Schema patch complete. Supabase is now fully compatible.');
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    client.release();
    await pool.end();
  }
}
main();
