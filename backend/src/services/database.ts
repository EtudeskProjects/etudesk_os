import { Pool } from 'pg';
import dotenv from 'dotenv';
import { logger } from '../utils';

dotenv.config();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Keep connections alive during long-running operations (agent workflows, tests)
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  max: parseInt(process.env.DB_POOL_MAX || '50'),
  keepAlive: true,
  keepAliveInitialDelayMillis: 10_000,
});

pool.on('error', (err) => {
  logger.error('Database pool error', err);
});

pool.on('connect', () => {
  logger.debug('New database connection established', {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
  });
});

export const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};
