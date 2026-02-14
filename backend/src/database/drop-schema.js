// Plain Node script (no tsx) to avoid IPC/sandbox issues during automation.
require('dotenv').config();
const { Client } = require('pg');

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

async function main() {
  const databaseUrl = requireEnv('DATABASE_URL');
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query('DROP SCHEMA IF EXISTS public CASCADE;');
    await client.query('CREATE SCHEMA public;');
    await client.query('COMMIT');
    console.log('✅ Dropped and recreated schema public');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('db:drop-schema failed:', err);
  process.exit(1);
});

