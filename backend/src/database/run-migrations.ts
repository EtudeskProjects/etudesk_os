import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

interface MigrationFile {
  name: string;
  fullPath: string;
}

function isSqlMigration(filename: string): boolean {
  return /^\d+_.*\.sql$/i.test(filename);
}

function sortMigrations(a: MigrationFile, b: MigrationFile): number {
  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
}

async function ensureMigrationTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function getAppliedMigrations(pool: Pool): Promise<Set<string>> {
  const result = await pool.query(`SELECT filename FROM schema_migrations`);
  return new Set(result.rows.map((row) => row.filename as string));
}

async function listMigrationFiles(migrationsDir: string): Promise<MigrationFile[]> {
  const entries = await fs.readdir(migrationsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && isSqlMigration(entry.name))
    .map((entry) => ({
      name: entry.name,
      fullPath: path.join(migrationsDir, entry.name),
    }))
    .sort(sortMigrations);
}

async function applyMigration(pool: Pool, migration: MigrationFile): Promise<void> {
  const sql = await fs.readFile(migration.fullPath, 'utf8');

  await pool.query('BEGIN');
  try {
    await pool.query(sql);
    await pool.query(
      `INSERT INTO schema_migrations (filename) VALUES ($1)`,
      [migration.name]
    );
    await pool.query('COMMIT');
    console.log(`✅ Applied ${migration.name}`);
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error(`❌ Failed ${migration.name}`);
    throw error;
  }
}

function isBenignExistingStateError(error: any): boolean {
  const code = String(error?.code || '');
  // Common PostgreSQL conflict codes when schema objects already exist
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

async function markMigrationAsApplied(pool: Pool, migrationName: string): Promise<void> {
  await pool.query(
    `INSERT INTO schema_migrations (filename) VALUES ($1)\n     ON CONFLICT (filename) DO NOTHING`,
    [migrationName]
  );
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }

  const migrationsDir = path.join(__dirname, 'migrations');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    await ensureMigrationTable(pool);

    const applied = await getAppliedMigrations(pool);
    const files = await listMigrationFiles(migrationsDir);

    const pending = files.filter((file) => !applied.has(file.name));

    if (pending.length === 0) {
      console.log('No pending migrations');
      return;
    }

    console.log(`Found ${pending.length} pending migration(s)`);

    for (const migration of pending) {
      try {
        await applyMigration(pool, migration);
      } catch (error: any) {
        if (!isBenignExistingStateError(error)) {
          throw error;
        }

        console.warn(`⚠️  ${migration.name} skipped (already reflected in schema), marking as applied`);
        await markMigrationAsApplied(pool, migration.name);
      }
    }

    console.log('🎉 All migrations applied');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Migration runner failed:', error);
  process.exit(1);
});
