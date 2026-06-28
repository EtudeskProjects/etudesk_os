/**
 * Reset local pgvector columns and re-vectorize entities from PostgreSQL.
 *
 * Usage:
 *   npx tsx src/scripts/pgvector-reset-and-seed.ts
 *   npx tsx src/scripts/pgvector-reset-and-seed.ts --only talents|opportunities|communities|spaces
 */

import dotenv from 'dotenv';
dotenv.config();

import { pool } from '../services/database';
import {
  batchUpdateTalentEmbeddings,
  batchUpdateOpportunityEmbeddings,
  batchUpdateCommunityEmbeddings,
  batchUpdateSpaceEmbeddings,
} from '../services/embedding.service';
import { EMBEDDING_DIMENSION, MODEL_EMBEDDING } from '../services/ai/models';

const RESET_SQL: Record<string, string> = {
  talents: 'UPDATE talents SET embedding = NULL WHERE embedding IS NOT NULL',
  opportunities: 'UPDATE opportunities SET embedding = NULL WHERE embedding IS NOT NULL',
  communities: 'UPDATE communities SET embedding = NULL WHERE embedding IS NOT NULL',
  spaces: 'UPDATE spaces SET embedding = NULL WHERE embedding IS NOT NULL',
};

function parseOnlyArg(): string | null {
  return process.argv.find((a) => a.startsWith('--only='))?.split('=')[1]
    || (process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null)
    || null;
}

async function countRows(target: string): Promise<number> {
  const sql: Record<string, string> = {
    talents: 'SELECT COUNT(*) FROM talents WHERE deleted_at IS NULL',
    opportunities: 'SELECT COUNT(*) FROM opportunities WHERE deleted_at IS NULL',
    communities: "SELECT COUNT(*) FROM communities WHERE deleted_at IS NULL AND status = 'ACTIVE'",
    spaces: "SELECT COUNT(*) FROM spaces WHERE deleted_at IS NULL AND status = 'ACTIVE'",
  };
  const { rows } = await pool.query(sql[target]);
  return parseInt(rows[0].count, 10) || 0;
}

async function main(): Promise<void> {
  if (!process.env.AI_API_KEY) throw new Error('AI_API_KEY not set');

  const only = parseOnlyArg();
  const targets = only ? [only] : ['talents', 'opportunities', 'communities', 'spaces'];

  console.log('═══════════════════════════════════════════════');
  console.log(' pgvector RESET + Vectorization');
  console.log('═══════════════════════════════════════════════');
  console.log(`Model: ${MODEL_EMBEDDING}`);
  console.log(`Dimension: ${EMBEDDING_DIMENSION}`);
  console.log(`Targets: ${targets.join(', ')}`);
  console.log('');

  for (const target of targets) {
    if (RESET_SQL[target]) await pool.query(RESET_SQL[target]);
  }
  console.log('Local vector columns cleared');
  console.log('');

  const results: Record<string, number> = {};
  for (const target of targets) {
    const limit = Math.max(await countRows(target), 1);
    switch (target) {
      case 'talents':
        results.talents = await batchUpdateTalentEmbeddings(limit);
        break;
      case 'opportunities':
        results.opportunities = await batchUpdateOpportunityEmbeddings(limit);
        break;
      case 'communities':
        results.communities = await batchUpdateCommunityEmbeddings(limit);
        break;
      case 'spaces':
        results.spaces = await batchUpdateSpaceEmbeddings(limit);
        break;
      default:
        console.warn(`Unknown target: ${target}`);
    }
    if (results[target] !== undefined) console.log(`  ${target}: ${results[target]}`);
  }

  const total = Object.values(results).reduce((a, b) => a + b, 0);
  console.log(`TOTAL: ${total}`);
  await pool.end();
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
