#!/usr/bin/env node
'use strict';

/**
 * Database Connection Test Script
 *
 * Verifies that the PostgreSQL database is properly configured and accessible
 *
 * Usage:
 *   $env:DATABASE_URL = "postgresql://USER:PASSWORD@HOST:PORT/DBNAME"
 *   node scripts/db/test-database-connection.js
 */

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

console.log('=== APOLLO Personnel Database - Connection Test ===\n');

if (!DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL environment variable not set');
  console.error('\nExample:');
  console.error('  $env:DATABASE_URL = "postgresql://USER:PASSWORD@HOST:PORT/DBNAME"');
  process.exit(1);
}

console.log('📍 Testing connection to:', DATABASE_URL.replace(/:[^:]*@/, ':****@'));
console.log('');

const pool = new Pool({ connectionString: DATABASE_URL });

async function testConnection() {
  const client = await pool.connect();
  try {
    // Test 1: Basic connection
    console.log('✓ Test 1: Connected to PostgreSQL server');

    // Test 2: Query version
    const versionResult = await client.query('SELECT version()');
    console.log('✓ Test 2: Server version -', versionResult.rows[0].version.split(',')[0]);

    // Test 3: Check personnel table
    const tableCheck = await client.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'personnel'
      )`
    );

    if (tableCheck.rows[0].exists) {
      console.log('✓ Test 3: Personnel table exists');

      // Test 4: Count records
      const countResult = await client.query('SELECT COUNT(*) as count FROM personnel WHERE deleted_at IS NULL');
      console.log(`✓ Test 4: Personnel records - ${countResult.rows[0].count} active records`);

      // Test 5: Check child tables
      const tables = ['personnel_children', 'personnel_places_of_residence', 'personnel_employment_history', 'personnel_seminars_training', 'personnel_foreign_countries', 'personnel_banks_credit', 'personnel_credit_references', 'personnel_character_refs', 'personnel_neighbors', 'personnel_organizations', 'personnel_languages'];
      let allTablesExist = true;
      const tableStatus = [];

      for (const table of tables) {
        const check = await client.query(
          `SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
          )`,
          [table]
        );
        if (check.rows[0].exists) {
          const countRes = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
          tableStatus.push(`  ✓ ${table}: ${countRes.rows[0].count} records`);
        } else {
          tableStatus.push(`  ✗ ${table}: MISSING`);
          allTablesExist = false;
        }
      }

      console.log('✓ Test 5: Child tables status:');
      tableStatus.forEach(status => console.log(status));

      if (!allTablesExist) {
        console.warn('\n⚠️  WARNING: Some child tables are missing. Schema may not be fully initialized.');
        console.warn('   Run: node scripts/db/init-database-schema.js');
      }
    } else {
      console.error('✗ Test 3: Personnel table does NOT exist');
      console.error('  Run the schema setup:');
      console.error('    psql -h <host> -U <user> -d apollo_db -f config/apollo-postgres-schema.sql');
      process.exit(1);
    }

    // Test 6: Write permission
    console.log('\n✓ Test 6: Testing write permission...');
    const testId = 'test-' + Date.now();
    const testRecord = {
      id: testId,
      fullName: 'Test User',
      updatedAt: new Date().toISOString()
    };

    try {
      const insertResult = await client.query(
        `INSERT INTO personnel (id, full_name, updated_at) 
         VALUES ($1, $2, $3) 
         RETURNING id`,
        [testRecord.id, testRecord.fullName, testRecord.updatedAt]
      );
      console.log('  ✓ Can insert records');

      // Clean up test record
      await client.query('DELETE FROM personnel WHERE id = $1', [testId]);
      console.log('  ✓ Can delete records');
    } catch (e) {
      console.error('  ✗ Write test failed:', e.message);
      throw e;
    }

    console.log('\n✅ All tests passed! Database is ready.');
    console.log('\nConfiguration:');
    console.log('  DATABASE_URL is set correctly');
    console.log('  Connection successful');
    console.log('  Schema appears complete');
    console.log('  Read/Write permissions verified');

  } catch (e) {
    console.error('\n❌ Test failed:', e.message);
    if (e.code === 'ECONNREFUSED') {
      console.error('\nPossible causes:');
      console.error('  - PostgreSQL server is not running');
      console.error('  - Server address/port is incorrect');
      console.error('  - Firewall is blocking the connection');
    } else if (e.code === '28P01') {
      console.error('\nPossible causes:');
      console.error('  - Database username/password is incorrect');
    } else if (e.code === '3D000') {
      console.error('\nPossible causes:');
      console.error('  - Database name does not exist');
      console.error('  - Check that database is named "apollo_db"');
    }
    process.exit(1);
  } finally {
    client.release();
  }
}

async function shutdown() {
  await pool.end();
  process.exit(0);
}

testConnection()
  .then(() => shutdown())
  .catch(err => {
    console.error('Unexpected error:', err);
    process.exit(1);
  });

process.on('SIGINT', () => shutdown());