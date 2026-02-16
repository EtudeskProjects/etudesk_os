/**
 * Reset Pinecone and re-vectorize all entities from PostgreSQL.
 *
 * WARNING: This deletes ALL vectors in the configured index (default namespace).
 *
 * Usage:
 *   npx tsx src/scripts/pinecone-reset-and-seed.ts
 *   npx tsx src/scripts/pinecone-reset-and-seed.ts --only talents|opportunities|communities|spaces
 */

import dotenv from 'dotenv';
dotenv.config();

import { Pinecone } from '@pinecone-database/pinecone';
import { pool } from '../services/database';
import {
  batchUpdateTalentEmbeddings,
  batchUpdateOpportunityEmbeddings,
  batchUpdateCommunityEmbeddings,
  batchUpdateSpaceEmbeddings,
} from '../services/embedding.service';

function parseOnlyArg(): string | null {
  const onlyArg = process.argv.find((a) => a.startsWith('--only='))?.split('=')[1]
    || (process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null);
  return onlyArg || null;
}

async function main(): Promise<void> {
  if (!process.env.PINECONE_API_KEY) throw new Error('PINECONE_API_KEY not set');
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');

  const indexName = process.env.PINECONE_INDEX || 'etudesk';
  const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  const index = pinecone.index(indexName);

  const only = parseOnlyArg();
  const targets = only ? [only] : ['talents', 'opportunities', 'communities', 'spaces'];

  console.log('═══════════════════════════════════════════════');
  console.log(' Pinecone RESET + Vectorization');
  console.log('═══════════════════════════════════════════════');
  console.log(`Index: ${indexName}`);
  console.log(`Targets: ${targets.join(', ')}`);
  console.log('');

  // Reset vectors
  console.log('Deleting all vectors in Pinecone index (default namespace)...');
  await index.deleteAll();
  console.log('✓ Pinecone cleared');
  console.log('');

  // Vectorize from DB (use actual counts to set limits)
  const results: Record<string, number> = {};

  for (const target of targets) {
    switch (target) {
      case 'talents': {
        const c = await pool.query('SELECT COUNT(*) FROM talents WHERE deleted_at IS NULL');
        const limit = parseInt(c.rows[0].count, 10) || 0;
        console.log(`── Talents (${limit}) ──`);
        results.talents = await batchUpdateTalentEmbeddings(Math.max(limit, 1));
        console.log(`   ✓ ${results.talents} talents vectorized`);
        break;
      }
      case 'opportunities': {
        const c = await pool.query('SELECT COUNT(*) FROM opportunities WHERE deleted_at IS NULL');
        const limit = parseInt(c.rows[0].count, 10) || 0;
        console.log(`── Opportunities (${limit}) ──`);
        results.opportunities = await batchUpdateOpportunityEmbeddings(Math.max(limit, 1));
        console.log(`   ✓ ${results.opportunities} opportunities vectorized`);
        break;
      }
      case 'communities': {
        const c = await pool.query("SELECT COUNT(*) FROM communities WHERE deleted_at IS NULL AND status = 'ACTIVE'");
        const limit = parseInt(c.rows[0].count, 10) || 0;
        console.log(`── Communities (${limit}) ──`);
        results.communities = await batchUpdateCommunityEmbeddings(Math.max(limit, 1));
        console.log(`   ✓ ${results.communities} communities vectorized`);
        break;
      }
      case 'spaces': {
        const c = await pool.query("SELECT COUNT(*) FROM spaces WHERE deleted_at IS NULL AND status = 'ACTIVE'");
        const limit = parseInt(c.rows[0].count, 10) || 0;
        console.log(`── Spaces (${limit}) ──`);
        results.spaces = await batchUpdateSpaceEmbeddings(Math.max(limit, 1));
        console.log(`   ✓ ${results.spaces} spaces vectorized`);
        break;
      }
      default:
        console.warn(`Unknown target: ${target}`);
    }
    console.log('');
  }

  const total = Object.values(results).reduce((a, b) => a + b, 0);
  console.log('═══════════════════════════════════════════════');
  console.log(' Summary');
  console.log('═══════════════════════════════════════════════');
  for (const [k, v] of Object.entries(results)) console.log(`  ${k}: ${v}`);
  console.log(`  TOTAL: ${total}`);
  console.log('═══════════════════════════════════════════════');

  await pool.end();
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});

