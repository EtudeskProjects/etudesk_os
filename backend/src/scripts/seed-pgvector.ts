/**
 * Seed pgvector — vectorize platform entities into local PostgreSQL.
 *
 * Usage: npx tsx src/scripts/seed-pgvector.ts [--only talents|opportunities|communities|spaces]
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

const BATCH_LIMIT = 200;

function parseOnlyArg(): string | null {
  return process.argv.find((a) => a.startsWith('--only='))?.split('=')[1]
    || (process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null)
    || null;
}

async function seedPgvector() {
  const only = parseOnlyArg();
  const targets = only ? [only] : ['talents', 'opportunities', 'communities', 'spaces'];

  console.log('═══════════════════════════════════════════════');
  console.log(' Seed pgvector — Vectorization');
  console.log('═══════════════════════════════════════════════');
  console.log(`Model: ${MODEL_EMBEDDING}`);
  console.log(`Dimension: ${EMBEDDING_DIMENSION}`);
  console.log(`Targets: ${targets.join(', ')}`);
  console.log('');

  await pool.query('SELECT 1');
  if (!process.env.AI_API_KEY) throw new Error('AI_API_KEY not set');

  const results: Record<string, number> = {};
  for (const target of targets) {
    switch (target) {
      case 'talents':
        console.log('── Talents ──');
        results.talents = await batchUpdateTalentEmbeddings(BATCH_LIMIT);
        break;
      case 'opportunities':
        console.log('── Opportunities ──');
        results.opportunities = await batchUpdateOpportunityEmbeddings(BATCH_LIMIT);
        break;
      case 'communities':
        console.log('── Communities ──');
        results.communities = await batchUpdateCommunityEmbeddings(BATCH_LIMIT);
        break;
      case 'spaces':
        console.log('── Spaces ──');
        results.spaces = await batchUpdateSpaceEmbeddings(BATCH_LIMIT);
        break;
      default:
        console.warn(`Unknown target: ${target}`);
    }
    if (results[target] !== undefined) console.log(`   ${results[target]} rows vectorized`);
    console.log('');
  }

  const total = Object.values(results).reduce((a, b) => a + b, 0);
  console.log('═══════════════════════════════════════════════');
  console.log(`TOTAL: ${total} local vectors written`);
  console.log('═══════════════════════════════════════════════');
  await pool.end();
}

seedPgvector().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
