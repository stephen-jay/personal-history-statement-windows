#!/usr/bin/env node
'use strict';

require('dotenv').config({ override: true });
const { Pool } = require('pg');

function prefix(value, size) {
  return String(value || '').slice(0, size || 80);
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const result = await pool.query(`
      SELECT
        id,
        name_last,
        name_first,
        name_middle,
        photo_data_url,
        signature_data_url,
        left_thumb_mark_data_url,
        right_thumb_mark_data_url
      FROM personnel
      WHERE deleted_at IS NULL
      ORDER BY updated_at DESC
    `);

    result.rows.forEach(function (row) {
      console.log(JSON.stringify({
        id: row.id,
        name: [row.name_last, row.name_first, row.name_middle].filter(Boolean).join(', '),
        photo: prefix(row.photo_data_url, 90),
        signature: prefix(row.signature_data_url, 70),
        leftThumb: prefix(row.left_thumb_mark_data_url, 70),
        rightThumb: prefix(row.right_thumb_mark_data_url, 70),
      }));
    });
  } finally {
    await pool.end();
  }
}

main().catch(function (error) {
  console.error(error && error.message ? error.message : error);
  process.exit(1);
});
