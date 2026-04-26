const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const tables = ['personnel', 'personnel_children', 'personnel_seminars_training'];
async function check() {
  for (const t of tables) {
    const res = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = '${t}' AND table_schema = 'public'`);
    console.log(`Table: ${t}`, res.rows.map(r => r.column_name));
  }
  pool.end();
}
check();
