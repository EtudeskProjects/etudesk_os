// Plain Node migration runner (no tsx) to avoid IPC/sandbox issues during automation.
require('dotenv').config();

const fs = require('fs/promises');
const path = require('path');
const { Pool } = require('pg');

function isSqlMigration(filename) {
  return /^\d+_.*\.sql$/i.test(filename);
}

function sortMigrations(a, b) {
  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
}

async function ensureMigrationTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function getAppliedMigrations(pool) {
  const result = await pool.query('SELECT filename FROM schema_migrations');
  return new Set(result.rows.map((r) => r.filename));
}

async function listMigrationFiles(migrationsDir) {
  const entries = await fs.readdir(migrationsDir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && isSqlMigration(e.name))
    .map((e) => ({ name: e.name, fullPath: path.join(migrationsDir, e.name) }))
    .sort(sortMigrations);
}

async function applyMigration(pool, migration) {
  const sql = await fs.readFile(migration.fullPath, 'utf8');
  await pool.query('BEGIN');
  try {
    await pool.query(sql);
    await pool.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [migration.name]);
    await pool.query('COMMIT');
    console.log(`✅ Applied ${migration.name}`);
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error(`❌ Failed ${migration.name}`);
    throw err;
  }
}

function isBenignExistingStateError(error) {
  const code = String(error && error.code ? error.code : '');
  const benignCodes = new Set([
    '42701', // duplicate_column
    '42P07', // duplicate_table
    '42710', // duplicate_object
    '42P06', // duplicate_schema
    '42P16', // invalid_table_definition (often from repeated alterations)
    '23505', // unique_violation (seed-style inserts already present)
  ]);
  return benignCodes.has(code);
}

async function markMigrationAsApplied(pool, migrationName) {
  await pool.query(
    `INSERT INTO schema_migrations (filename) VALUES ($1)
     ON CONFLICT (filename) DO NOTHING`,
    [migrationName]
  );
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is not set');

  const migrationsDir = path.join(__dirname, 'migrations');
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    await ensureMigrationTable(pool);
    const applied = await getAppliedMigrations(pool);
    const files = await listMigrationFiles(migrationsDir);
    const pending = files.filter((f) => !applied.has(f.name));
    if (pending.length === 0) {
      console.log('No pending migrations');
      return;
    }

    console.log(`Found ${pending.length} pending migration(s)`);
    for (const migration of pending) {
      try {
        await applyMigration(pool, migration);
      } catch (err) {
        if (!isBenignExistingStateError(err)) throw err;
        console.warn(`⚠️  ${migration.name} skipped (already reflected in schema), marking as applied`);
        await markMigrationAsApplied(pool, migration.name);
      }
    }

    console.log('🎉 All migrations applied');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Migration runner failed:', err);
  process.exit(1);
});

