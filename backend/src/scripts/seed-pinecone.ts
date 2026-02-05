/**
 * Seed Pinecone — Vectorize all entities from PostgreSQL to Pinecone
 *
 * Usage: npx tsx src/scripts/seed-pinecone.ts [--only talents|opportunities|communities|spaces]
 *
 * Reads all entities from PostgreSQL, generates embeddings via OpenAI,
 * and upserts vectors to Pinecone index "etudesk".
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

const BATCH_LIMIT = 200;

async function seedPinecone() {
  const onlyArg = process.argv.find(a => a.startsWith('--only='))?.split('=')[1]
    || (process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null);

  const targets = onlyArg
    ? [onlyArg]
    : ['talents', 'opportunities', 'communities', 'spaces'];

  console.log('═══════════════════════════════════════════════');
  console.log(' Seed Pinecone — Vectorization');
  console.log('═══════════════════════════════════════════════');
  console.log(`Index: ${process.env.PINECONE_INDEX || 'etudesk'}`);
  console.log(`Targets: ${targets.join(', ')}`);
  console.log('');

  // Verify DB connection
  try {
    const res = await pool.query('SELECT 1');
    console.log('[OK] PostgreSQL connected');
  } catch (err: any) {
    console.error('[FAIL] PostgreSQL connection failed:', err.message);
    process.exit(1);
  }

  // Verify env vars
  if (!process.env.OPENAI_API_KEY) {
    console.error('[FAIL] OPENAI_API_KEY not set');
    process.exit(1);
  }
  if (!process.env.PINECONE_API_KEY) {
    console.error('[FAIL] PINECONE_API_KEY not set');
    process.exit(1);
  }
  console.log('[OK] API keys present');
  console.log('');

  const results: Record<string, number> = {};

  for (const target of targets) {
    switch (target) {
      case 'talents': {
        const count = await pool.query('SELECT COUNT(*) FROM talents WHERE deleted_at IS NULL');
        console.log(`── Talents (${count.rows[0].count} in DB) ──`);
        const updated = await batchUpdateTalentEmbeddings(BATCH_LIMIT);
        results.talents = updated;
        console.log(`   ✓ ${updated} talents vectorized`);
        break;
      }

      case 'opportunities': {
        const count = await pool.query('SELECT COUNT(*) FROM opportunities WHERE deleted_at IS NULL');
        console.log(`── Opportunities (${count.rows[0].count} in DB) ──`);
        const updated = await batchUpdateOpportunityEmbeddings(BATCH_LIMIT);
        results.opportunities = updated;
        console.log(`   ✓ ${updated} opportunities vectorized`);
        break;
      }

      case 'communities': {
        const count = await pool.query("SELECT COUNT(*) FROM communities WHERE deleted_at IS NULL AND status = 'ACTIVE'");
        console.log(`── Communities (${count.rows[0].count} in DB) ──`);
        const updated = await batchUpdateCommunityEmbeddings(BATCH_LIMIT);
        results.communities = updated;
        console.log(`   ✓ ${updated} communities vectorized`);
        break;
      }

      case 'spaces': {
        const count = await pool.query("SELECT COUNT(*) FROM spaces WHERE deleted_at IS NULL AND status = 'ACTIVE'");
        console.log(`── Spaces (${count.rows[0].count} in DB) ──`);
        const updated = await batchUpdateSpaceEmbeddings(BATCH_LIMIT);
        results.spaces = updated;
        console.log(`   ✓ ${updated} spaces vectorized`);
        break;
      }

      default:
        console.warn(`Unknown target: ${target}`);
    }

    console.log('');
  }

  // Summary
  console.log('═══════════════════════════════════════════════');
  console.log(' Summary');
  console.log('═══════════════════════════════════════════════');
  const total = Object.values(results).reduce((a, b) => a + b, 0);
  for (const [entity, count] of Object.entries(results)) {
    console.log(`  ${entity}: ${count} vectorized`);
  }
  console.log(`  TOTAL: ${total} vectors upserted to Pinecone`);
  console.log('═══════════════════════════════════════════════');

  await pool.end();
  process.exit(0);
}

seedPinecone().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
