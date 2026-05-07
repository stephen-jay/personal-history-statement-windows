require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const res = await pool.query(
    `UPDATE cards SET assigned_username = 'pdelacruzlopez' WHERE card_uid = '15BE0649' RETURNING card_uid, assigned_username, status`
  );
  console.log('Fixed:', res.rows);
  await pool.end();
}

main().catch(console.error);
