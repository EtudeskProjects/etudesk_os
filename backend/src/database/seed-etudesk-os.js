// Seed runner for Etudesk OS realistic dataset.
// Uses node-postgres directly (reads .env via dotenv) to avoid relying on psql.

require('dotenv').config();

const fs = require('fs/promises');
const path = require('path');
const { Client } = require('pg');

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }

  const seedPath = path.join(__dirname, 'seed_etudesk_os_realistic.sql');
  const sql = await fs.readFile(seedPath, 'utf8');

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(sql);
    console.log('✅ Seed applied:', seedPath);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

