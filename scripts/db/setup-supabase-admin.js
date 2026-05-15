'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const { Pool } = require('pg');

const url = new URL(process.env.SUPABASE_DB_URL);
const pool = new Pool({
  host: url.hostname,
  port: parseInt(url.port),
  database: url.pathname.replace('/', ''),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const client = await pool.connect();
  try {
    console.log('Adding missing auth roles schema...');
    
    // 1. Create missing roles tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_roles (
        id serial PRIMARY KEY,
        name text UNIQUE NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS app_user_roles (
        user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
        role_id integer NOT NULL REFERENCES app_roles(id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, role_id)
      );
      
      ALTER TABLE app_roles ENABLE ROW LEVEL SECURITY;
      ALTER TABLE app_user_roles ENABLE ROW LEVEL SECURITY;
    `);

    // 2. Insert default roles
    await client.query(`
      INSERT INTO app_roles (name) VALUES ('admin'), ('user'), ('viewer')
      ON CONFLICT (name) DO NOTHING;
    `);

    // 3. Create default admin user (password: admin)
    console.log('Creating default admin user...');
    
    const adminRes = await client.query(`
      INSERT INTO app_users (username, password_hash, role)
      VALUES ('admin', crypt('admin', gen_salt('bf')), 'admin')
      ON CONFLICT (username) DO NOTHING
      RETURNING id;
    `);

    let adminId;
    if (adminRes.rows.length > 0) {
      adminId = adminRes.rows[0].id;
      console.log('Created new admin user.');
    } else {
      const existing = await client.query("SELECT id FROM app_users WHERE username = 'admin'");
      adminId = existing.rows[0].id;
      console.log('Admin user already exists.');
    }

    // 4. Link admin to admin role
    const roleRes = await client.query("SELECT id FROM app_roles WHERE name = 'admin'");
    const roleId = roleRes.rows[0].id;

    await client.query(`
      INSERT INTO app_user_roles (user_id, role_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING;
    `, [adminId, roleId]);

    console.log('\n✅ Supabase admin setup complete!');
    console.log('Username: admin');
    console.log('Password: admin\n');

  } catch (e) {
    console.error('Error:', e);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
