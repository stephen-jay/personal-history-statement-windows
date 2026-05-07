require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const res = await pool.query(
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'personnel' ORDER BY ordinal_position`
  );
  console.log(res.rows.map(c => `${c.column_name} (${c.data_type})`).join('\n'));
  await pool.end();
}
main().catch(console.error);
