import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

// Table to track executed migrations
const MIGRATIONS_TABLE = 'schema_migrations';

async function ensureMigrationsTable(): Promise<void> {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
            id SERIAL PRIMARY KEY,
            filename VARCHAR(255) UNIQUE NOT NULL,
            executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    `);
}

async function getExecutedMigrations(): Promise<string[]> {
    const result = await pool.query(
        `SELECT filename FROM ${MIGRATIONS_TABLE} ORDER BY id`
    );
    return result.rows.map(row => row.filename);
}

async function recordMigration(filename: string): Promise<void> {
    await pool.query(
        `INSERT INTO ${MIGRATIONS_TABLE} (filename) VALUES ($1)`,
        [filename]
    );
}

async function getMigrationFiles(): Promise<string[]> {
    const files = fs.readdirSync(MIGRATIONS_DIR);
    return files
        .filter(f => f.endsWith('.sql'))
        .sort(); // Sort alphabetically (which works for numbered migrations)
}

async function runMigration(filename: string): Promise<void> {
    const filepath = path.join(MIGRATIONS_DIR, filename);
    const sql = fs.readFileSync(filepath, 'utf8');

    console.log(`Running migration: ${filename}`);

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(sql);
        await recordMigration(filename);
        await client.query('COMMIT');
        console.log(`  ✓ Migration ${filename} completed`);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`  ✗ Migration ${filename} failed:`, error);
        throw error;
    } finally {
        client.release();
    }
}

async function runPendingMigrations(): Promise<void> {
    await ensureMigrationsTable();

    const executedMigrations = await getExecutedMigrations();
    const allMigrations = await getMigrationFiles();

    const pendingMigrations = allMigrations.filter(
        m => !executedMigrations.includes(m)
    );

    if (pendingMigrations.length === 0) {
        console.log('No pending migrations.');
        return;
    }

    console.log(`Found ${pendingMigrations.length} pending migration(s):`);
    pendingMigrations.forEach(m => console.log(`  - ${m}`));
    console.log('');

    for (const migration of pendingMigrations) {
        await runMigration(migration);
    }

    console.log('\nAll migrations completed successfully!');
}

async function runSpecificMigration(filename: string): Promise<void> {
    await ensureMigrationsTable();

    const executedMigrations = await getExecutedMigrations();

    if (executedMigrations.includes(filename)) {
        console.log(`Migration ${filename} has already been executed.`);
        return;
    }

    await runMigration(filename);
}

async function rollbackMigration(filename: string): Promise<void> {
    // Note: This is a simple rollback that just removes the migration record
    // For actual rollback, you'd need a separate rollback SQL file
    await pool.query(
        `DELETE FROM ${MIGRATIONS_TABLE} WHERE filename = $1`,
        [filename]
    );
    console.log(`Removed migration record: ${filename}`);
}

async function listMigrations(): Promise<void> {
    await ensureMigrationsTable();

    const executedMigrations = await getExecutedMigrations();
    const allMigrations = await getMigrationFiles();

    console.log('Migration Status:\n');

    for (const migration of allMigrations) {
        const status = executedMigrations.includes(migration) ? '✓' : '○';
        console.log(`  ${status} ${migration}`);
    }
}

// CLI
const command = process.argv[2];
const arg = process.argv[3];

async function main() {
    try {
        switch (command) {
            case 'run':
                if (arg) {
                    await runSpecificMigration(arg);
                } else {
                    await runPendingMigrations();
                }
                break;

            case 'list':
                await listMigrations();
                break;

            case 'rollback':
                if (!arg) {
                    console.error('Please specify migration filename to rollback');
                    process.exit(1);
                }
                await rollbackMigration(arg);
                break;

            default:
                console.log('Usage:');
                console.log('  npm run db:migrate              - Run all pending migrations');
                console.log('  npm run db:migrate run          - Run all pending migrations');
                console.log('  npm run db:migrate run <file>   - Run specific migration');
                console.log('  npm run db:migrate list         - List all migrations');
                console.log('  npm run db:migrate rollback <file> - Remove migration record');
                await runPendingMigrations();
        }
    } catch (error) {
        console.error('Migration error:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();
