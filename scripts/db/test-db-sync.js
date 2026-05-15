// Manual smoke-test for the db-sync module.
// Boots the manager against the configured primary + Supabase, waits for the
// initial probe, then runs a single sync pass and prints the result.

require('dotenv').config();
const dbManager = require('../../src/main/db-manager');
const dbSync = require('../../src/main/db-sync');

(async function () {
  const primary = process.env.DATABASE_URL || '';
  const supabase = process.env.SUPABASE_DB_URL || '';
  if (!primary) { console.error('DATABASE_URL is not set'); process.exit(1); }
  if (!supabase) { console.error('SUPABASE_DB_URL is not set'); process.exit(1); }

  dbManager.initDbManager(primary, supabase);

  // Wait briefly for initial probe to settle.
  await new Promise(function (resolve) { setTimeout(resolve, 3000); });
  console.log('[TEST] active tier after probe:', dbManager.getActiveTier());

  const result = await dbSync.runSync();
  console.log('[TEST] sync result:', JSON.stringify(result, null, 2));

  await dbManager.closeDbManager();
  process.exit(result && result.ok ? 0 : 1);
})();
