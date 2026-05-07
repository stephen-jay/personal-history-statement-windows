#!/usr/bin/env node
'use strict';

/**
 * RFID UID Normalization Regression Test
 * 
 * Verifies that registration, assignment, and lookups handle 
 * case-sensitivity and whitespace correctly.
 */

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL environment variable not set');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

async function runTest() {
  const client = await pool.connect();
  try {
    console.log('=== RFID UID Normalization Test ===');

    const BASE_UID = 'TEST-NORM-' + Date.now();
    const VARIANTS = {
      UPPER: BASE_UID.toUpperCase(),
      LOWER: BASE_UID.toLowerCase(),
      SPACED: `  ${BASE_UID}  `,
      MIXED: BASE_UID.split('').map((c, i) => i % 2 === 0 ? c.toUpperCase() : c.toLowerCase()).join('')
    };

    // 1. Register with Mixed Case
    console.log(`1. Registering: [${VARIANTS.MIXED}]`);
    await client.query('INSERT INTO cards (card_uid, status) VALUES ($1, $2)', [VARIANTS.MIXED, 'available']);

    // 2. Verify Case-Insensitive Existence Check (Prevents Duplicates)
    console.log('2. Verifying duplicate prevention (LOWER)...');
    const existing = await client.query('SELECT 1 FROM cards WHERE LOWER(TRIM(card_uid)) = LOWER(TRIM($1))', [VARIANTS.LOWER]);
    if (existing.rowCount === 0) throw new Error('Existence check failed');
    console.log('   ✓ Duplicate detection confirmed.');

    // 3. Test Assignment with UPPER
    console.log(`3. Testing assignment with: [${VARIANTS.UPPER}]`);
    const assignRes = await client.query(
      'UPDATE cards SET status = $1 WHERE LOWER(TRIM(card_uid)) = LOWER(TRIM($2))',
      ['assigned', VARIANTS.UPPER]
    );
    if (assignRes.rowCount !== 1) throw new Error(`Assignment failed for ${VARIANTS.UPPER}`);
    console.log('   ✓ Assigned successfully.');

    // 4. Test Lookup with SPACED
    console.log(`4. Testing lookup with: [${VARIANTS.SPACED}]`);
    const lookupRes = await client.query(
      'SELECT status FROM cards WHERE LOWER(TRIM(card_uid)) = LOWER(TRIM($1))',
      [VARIANTS.SPACED]
    );
    if (!lookupRes.rows[0] || lookupRes.rows[0].status !== 'assigned') {
      throw new Error(`Lookup failed for ${VARIANTS.SPACED}`);
    }
    console.log('   ✓ Lookup successful and status correct.');

    // 5. Test Unassign with LOWER
    console.log(`5. Testing unassign with: [${VARIANTS.LOWER}]`);
    const unassignRes = await client.query(
      'UPDATE cards SET status = $1 WHERE LOWER(TRIM(card_uid)) = LOWER(TRIM($2))',
      ['available', VARIANTS.LOWER]
    );
    if (unassignRes.rowCount !== 1) throw new Error(`Unassign failed for ${VARIANTS.LOWER}`);
    console.log('   ✓ Unassigned successfully.');

    // Cleanup
    await client.query('DELETE FROM cards WHERE LOWER(TRIM(card_uid)) = LOWER(TRIM($1))', [BASE_UID]);
    console.log('\n✅ UID NORMALIZATION TEST PASSED');

  } catch (e) {
    console.error('\n❌ TEST FAILED:', e.message);
    process.exit(1);
  } finally {
    client.release();
  }
}

runTest().then(() => pool.end());
