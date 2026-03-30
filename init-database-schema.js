#!/usr/bin/env node
'use strict';

/**
 * Database Schema Initialization Script
 * 
 * Reads and applies the PostgreSQL schema to initialize the database
 * 
 * Usage:
 *   $env:DATABASE_URL = "postgresql://username:password@10.10.218.144:5432/apollo_db"
 *   node init-database-schema.js
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

console.log('=== APOLLO Personnel Database - Schema Initialization ===\n');

if (!DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL environment variable not set');
  console.error('\nExample:');
  console.error('  $env:DATABASE_URL = "postgresql://username:password@10.10.218.144:5432/apollo_db"');
  process.exit(1);
}

console.log('📍 Initializing database schema...\n');

const pool = new Pool({ connectionString: DATABASE_URL });

async function initializeSchema() {
  const schemaFile = path.join(__dirname, 'config', 'apollo-postgres-schema.sql');
  
  if (!fs.existsSync(schemaFile)) {
    console.error('❌ ERROR: Schema file not found at', schemaFile);
    process.exit(1);
  }

  console.log(`📄 Reading schema from: ${schemaFile}\n`);
  const schema = fs.readFileSync(schemaFile, 'utf8');

  const client = await pool.connect();
  try {
    console.log('Executing schema...\n');
    const result = await client.query(schema);
    
    console.log('✅ Schema initialization successful!\n');

    // Verify tables were created
    console.log('📋 Verifying tables:\n');
    const tableNames = ['personnel', 'personnel_children', 'personnel_places_of_residence', 'personnel_employment_history', 'personnel_seminars_training', 'personnel_foreign_countries', 'personnel_banks_credit', 'personnel_credit_references', 'personnel_character_refs', 'personnel_neighbors', 'personnel_organizations', 'personnel_languages'];
    
    for (const tableName of tableNames) {
      const check = await client.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )`,
        [tableName]
      );

      if (check.rows[0].exists) {
        const countRes = await client.query(`SELECT COUNT(*) as count FROM ${tableName}`);
        console.log(`  ✓ ${tableName}: ${countRes.rows[0].count} records`);
      } else {
        console.log(`  ✗ ${tableName}: NOT FOUND (may not exist in schema)`);
      }
    }

    console.log('\n✅ Database is ready for deployment!');

  } catch (e) {
    console.error('❌ Schema initialization failed:', e.message);
    
    // Check if table already exists
    if (e.message.includes('already exists')) {
      console.log('\n📌 Note: Tables already initialized. No changes required.');
      process.exit(0);
    }
    
    console.error('\nFull error:', e);
    process.exit(1);
  } finally {
    client.release();
  }
}

async function shutdown() {
  await pool.end();
  process.exit(0);
}

initializeSchema()
  .then(() => shutdown())
  .catch(err => {
    console.error('Unexpected error:', err);
    process.exit(1);
  });

process.on('SIGINT', () => shutdown());
