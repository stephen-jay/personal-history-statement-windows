const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function run() {
  try {
    const migrations = [
      '002-create-cards-table.sql',
      '003-add-totp-auth.sql'
    ];
    
    const databaseUrl = process.env.DATABASE_URL || process.argv[2];
    if (!databaseUrl) {
      console.error('DATABASE_URL is required (env or first arg)');
      process.exit(3);
    }
    console.log('Using DATABASE_URL:', databaseUrl.replace(/:(?:[^:]+)@/, ':****@'));
    const pool = new Pool({ connectionString: databaseUrl });
    const client = await pool.connect();
    
    try {
      for (const migrationFile of migrations) {
        const sqlPath = path.join(__dirname, '..', '..', 'db', migrationFile);
        if (!fs.existsSync(sqlPath)) {
          console.error('Migration file not found:', sqlPath);
          process.exit(2);
        }
        const sql = fs.readFileSync(sqlPath, 'utf8');
        console.log(`Executing migration ${migrationFile}...`);
        await client.query(sql);
        console.log(`Migration ${migrationFile} executed successfully.`);
      }
    } finally {
      client.release();
      await pool.end();
    }
  } catch (e) {
    console.error('Migration failed:', e && e.message ? e.message : e);
    process.exit(1);
  }
}

run();
