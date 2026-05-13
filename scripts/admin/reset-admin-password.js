#!/usr/bin/env node
'use strict';

require('dotenv').config({ override: true });
const { Pool } = require('pg');

const databaseUrl = process.env.DATABASE_URL || '';
const username = process.env.RESET_USERNAME || 'admin';
const newPassword = process.env.RESET_PASSWORD || '';

if (!databaseUrl || !newPassword) {
  console.error('Missing DATABASE_URL or RESET_PASSWORD in environment.');
  process.exit(1);
}

async function run() {
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const res = await pool.query(
      "UPDATE app_users SET password_hash = crypt($1, gen_salt('bf')) WHERE username = $2 RETURNING username",
      [newPassword, username]
    );
    if (!res.rows || !res.rows.length) {
      console.error('No user found:', username);
      process.exit(1);
    }
    console.log('Password reset for user:', res.rows[0].username);
  } finally {
    await pool.end();
  }
}

run().catch(function (e) {
  console.error(e && e.message ? e.message : String(e));
  process.exit(1);
});
