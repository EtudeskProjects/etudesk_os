import dotenv from 'dotenv';
import { Client } from 'pg';

dotenv.config();

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

async function main(): Promise<void> {
  const databaseUrl = requireEnv('DATABASE_URL');
  const url = new URL(databaseUrl);

  const dbName = url.pathname.replace(/^\//, '');
  if (!dbName) throw new Error('DATABASE_URL must include a database name');

  // Connect to maintenance DB (postgres) to be able to drop/create the target DB.
  url.pathname = '/postgres';

  const admin = new Client({ connectionString: url.toString() });
  await admin.connect();
  try {
    // Terminate existing connections to the target DB.
    await admin.query(
      `SELECT pg_terminate_backend(pid)
       FROM pg_stat_activity
       WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [dbName]
    );

    await admin.query(`DROP DATABASE IF EXISTS "${dbName}"`);
    await admin.query(`CREATE DATABASE "${dbName}"`);
    console.log(`✅ Recreated database ${dbName}`);
  } finally {
    await admin.end();
  }
}

main().catch((err) => {
  console.error('db:recreate failed:', err);
  process.exit(1);
});

