require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://user:password@10.10.218.144:5432/apollo_db'
});

async function main() {
  try {
    const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    console.log("Tables:", res.rows.map(r => r.table_name));
    
    // Attempt to query users or accounts if they exist
    const tables = res.rows.map(r => r.table_name);
    let targetTable = 'app_users';
    
    if (targetTable) {
        console.log(`Found table ${targetTable}. Fetching rows...`);
        const result = await pool.query(`SELECT * FROM ${targetTable}`);
        console.log(result.rows);
    } else {
        console.log("No users table found among:", tables);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
main();
