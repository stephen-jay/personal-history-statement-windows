require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const USERNAME = 'pdelacruzlopez';

  const userRes = await pool.query(`SELECT id FROM app_users WHERE username = $1`, [USERNAME]);
  if (!userRes.rows.length) { console.log('User not found'); return; }
  const userId = userRes.rows[0].id;

  // Reset TOTP
  const totp = await pool.query(
    `UPDATE app_user_totp SET totp_secret = NULL, totp_enabled = false WHERE user_id = $1 RETURNING user_id`,
    [userId]
  );
  console.log('TOTP reset:', totp.rowCount ? '✅ Done' : '⚠️  No TOTP row found (may not need reset)');

  // Expire all pending challenges
  const challenges = await pool.query(
    `UPDATE auth_challenges SET status = 'failed', expires_at = NOW() WHERE user_id = $1 AND status NOT IN ('verified', 'failed') RETURNING id`,
    [userId]
  );
  console.log('Expired challenges:', challenges.rowCount);

  await pool.end();
  console.log('\n✅ Done. pdelacruzlopez can now start a fresh login.');
}

main().catch(console.error);
