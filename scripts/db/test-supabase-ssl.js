/**
 * Test using pg connection object (not connection string) to bypass sslmode parsing
 */
'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const { Pool } = require('pg');

// Parse the URL manually
const url = new URL(process.env.SUPABASE_DB_URL);
const connObj = {
  host: url.hostname,
  port: parseInt(url.port),
  database: url.pathname.replace('/', ''),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  connectionTimeoutMillis: 8000,
};

console.log('Host:', connObj.host);
console.log('Port:', connObj.port);
console.log('User:', connObj.user);
console.log('Database:', connObj.database);

async function tryConnect(ssl, label) {
  const pool = new Pool({ ...connObj, ssl });
  try {
    const client = await pool.connect();
    const res = await client.query('SELECT current_database()');
    client.release();
    console.log(`\n✅ [${label}] Connected! DB: ${res.rows[0].current_database}`);
    await pool.end();
    return true;
  } catch (e) {
    console.log(`❌ [${label}] ${e.message}`);
    await pool.end().catch(() => {});
    return false;
  }
}

async function main() {
  // Try with explicit ssl object — bypasses connection string sslmode parsing
  await tryConnect({ rejectUnauthorized: false }, 'obj: rejectUnauthorized=false');
  await tryConnect({ rejectUnauthorized: false, checkServerIdentity: () => undefined }, 'obj: skip identity check');
  await tryConnect(false, 'obj: ssl=false');
  await tryConnect(true, 'obj: ssl=true');
}

main();
