#!/usr/bin/env node
'use strict';

const { Pool } = require('pg');
const { generate } = require('otplib');
const { getPgPool } = require('../src/main/database');
const auth = require('../src/main/auth');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL environment variable not set');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });
// Inject pool into auth module's expected global via database.js if it's not initialized
require('../src/main/database').initDatabase(DATABASE_URL, 'test.json');

async function runTests() {
  const client = await pool.connect();
  console.log('=== Passwordless Auth Flow Regression Tests ===\n');

  try {
    // 0. Setup Test Data
    const testUsername = 'test_totp_user_' + Date.now();
    const testAdmin = 'test_totp_admin_' + Date.now();
    const cardUid = 'TEST-CARD-' + Date.now();
    const wrongCardUid = 'WRONG-CARD-' + Date.now();

    console.log('Step 0: Setting up test users and cards...');
    await client.query("INSERT INTO app_roles (name) VALUES ('admin'), ('encoder') ON CONFLICT DO NOTHING");
    const roleRes = await client.query("SELECT id FROM app_roles WHERE name = 'encoder'");
    const adminRoleRes = await client.query("SELECT id FROM app_roles WHERE name = 'admin'");
    
    // Create test user
    const userRes = await client.query(
      `INSERT INTO app_users (username, password_hash, full_name, is_active) 
       VALUES ($1, 'dummy', 'Test User', true) RETURNING id`,
      [testUsername]
    );
    const userId = userRes.rows[0].id;
    await client.query('INSERT INTO app_user_roles (user_id, role_id) VALUES ($1, $2)', [userId, roleRes.rows[0].id]);

    // Create admin user
    const adminRes = await client.query(
      `INSERT INTO app_users (username, password_hash, full_name, is_active) 
       VALUES ($1, 'dummy', 'Test Admin', true) RETURNING id`,
      [testAdmin]
    );
    const adminId = adminRes.rows[0].id;
    await client.query('INSERT INTO app_user_roles (user_id, role_id) VALUES ($1, $2)', [adminId, adminRoleRes.rows[0].id]);

    // Setup cards
    // Assigned correctly
    await client.query('INSERT INTO cards (card_uid, status, assigned_username) VALUES ($1, $2, $3)', [cardUid, 'assigned', testUsername]);
    // Assigned to someone else or unassigned
    await client.query('INSERT INTO cards (card_uid, status) VALUES ($1, $2)', [wrongCardUid, 'available']);

    // 1. Begin Login
    console.log('\nStep 1: Test beginLogin');
    const beginRes = await auth.beginLogin(testUsername);
    if (!beginRes.challengeId) throw new Error('beginLogin failed to return challengeId');
    console.log('  ✓ Successfully created login challenge.');

    // 2. Mismatched Card
    console.log('\nStep 2: Test Card Verification (Mismatch)');
    try {
      await auth.verifyCardStep(beginRes.challengeId, wrongCardUid);
      throw new Error('Should have failed card verification');
    } catch (e) {
      if (e.message.includes('not assigned to this user')) {
        console.log('  ✓ Correctly rejected unassigned/mismatched card.');
      } else {
        throw e;
      }
    }

    // 3. Matched Card -> Pending Enrollment
    console.log('\nStep 3: Test Card Verification (Match)');
    const cardVerRes = await auth.verifyCardStep(beginRes.challengeId, cardUid);
    if (cardVerRes.status !== 'pending_enrollment') {
      throw new Error(`Expected pending_enrollment, got ${cardVerRes.status}`);
    }
    console.log('  ✓ Successfully verified card, advanced to enrollment.');

    // 4. Enroll TOTP
    console.log('\nStep 4: Test TOTP Enrollment');
    const enrollRes = await auth.enrollTotp(beginRes.challengeId);
    if (!enrollRes.secret || !enrollRes.qrCodeDataUrl) throw new Error('Enrollment failed to return secret/qr');
    console.log('  ✓ Successfully generated TOTP secret.');

    // 5. Verify TOTP (Wrong Code)
    console.log('\nStep 5: Test TOTP Verification (Wrong Code)');
    try {
      await auth.verifyTotpStep(beginRes.challengeId, '000000');
      throw new Error('Should have rejected wrong code');
    } catch (e) {
      if (e.message.includes('Invalid or expired')) {
        console.log('  ✓ Correctly rejected wrong OTP code.');
      } else {
        throw e;
      }
    }

    // 6. Verify TOTP (Correct Code)
    console.log('\nStep 6: Test TOTP Verification (Correct Code)');
    const validToken = await generate({ secret: enrollRes.secret });
    const sessionRes = await auth.verifyTotpStep(beginRes.challengeId, validToken);
    if (!sessionRes.user || sessionRes.user.username !== testUsername) {
      throw new Error('Session creation failed or user mismatch');
    }
    console.log('  ✓ Successfully verified OTP and finalized session.');

    // 7. Test Next Login (Should ask for TOTP directly, no enrollment)
    console.log('\nStep 7: Test Subsequent Login Flow (TOTP Required)');
    const beginRes2 = await auth.beginLogin(testUsername);
    const cardVerRes2 = await auth.verifyCardStep(beginRes2.challengeId, cardUid);
    if (cardVerRes2.status !== 'pending_totp') {
      throw new Error(`Expected pending_totp, got ${cardVerRes2.status}`);
    }
    console.log('  ✓ Successfully bypassed enrollment on subsequent login.');

    // 8. Admin Reset TOTP
    console.log('\nStep 8: Test Admin TOTP Reset');
    await auth.adminResetTotp(adminId, userId);
    console.log('  ✓ Admin successfully reset TOTP for user.');

    // 9. Login After Reset (Should require enrollment again)
    console.log('\nStep 9: Test Login After Admin Reset');
    const beginRes3 = await auth.beginLogin(testUsername);
    const cardVerRes3 = await auth.verifyCardStep(beginRes3.challengeId, cardUid);
    if (cardVerRes3.status !== 'pending_enrollment') {
      throw new Error(`Expected pending_enrollment after reset, got ${cardVerRes3.status}`);
    }
    console.log('  ✓ Successfully required enrollment after admin reset.');

    // Cleanup
    console.log('\nStep 10: Cleaning up test data...');
    await client.query('DELETE FROM cards WHERE card_uid IN ($1, $2)', [cardUid, wrongCardUid]);
    await client.query('DELETE FROM app_users WHERE id IN ($1, $2)', [userId, adminId]);
    console.log('  ✓ Test data removed.');

    console.log('\n✨ ALL PASSWORDLESS AUTH FLOW TESTS PASSED');

  } catch (e) {
    console.error('\n❌ TESTS FAILED:', e.message);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

runTests();