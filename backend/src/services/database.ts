import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Keep connections alive during long-running operations (agent workflows, tests)
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  max: 20,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10_000,
});

export const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};
