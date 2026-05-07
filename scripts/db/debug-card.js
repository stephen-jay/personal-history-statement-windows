require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const cardUid = '15BE0649';

  // Check the card row
  const cardRes = await pool.query(
    `SELECT c.id, c.card_uid, c.status, c.assigned_username, c.personnel_id,
            p.name_first, p.name_last
     FROM cards c
     LEFT JOIN personnel p ON p.id = c.personnel_id
     WHERE UPPER(REPLACE(c.card_uid, ' ', '')) = UPPER(REPLACE($1, ' ', ''))`,
    [cardUid]
  );

  if (!cardRes.rows.length) {
    console.log('❌ Card not found in DB:', cardUid);
  } else {
    console.log('✅ Card record:');
    console.table(cardRes.rows);
  }

  // Check what user is linked
  if (cardRes.rows.length) {
    const { assigned_username, personnel_id } = cardRes.rows[0];
    if (assigned_username) {
      const userRes = await pool.query(
        'SELECT id, username FROM app_users WHERE username = $1',
        [assigned_username]
      );
      console.log('\n✅ Linked app_user:');
      console.table(userRes.rows);
    } else {
      console.log('\n⚠️  assigned_username is NULL — this is the bug!');
    }

    if (personnel_id) {
      const pRes = await pool.query(
        'SELECT id, name_last, name_first FROM personnel WHERE id = $1',
        [personnel_id]
      );
      console.log('\n✅ Linked personnel:');
      console.table(pRes.rows);
    }
  }

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
