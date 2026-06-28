/**
 * Seed competency embeddings — embeds the skills referential ONCE into
 * competencies.embedding (pgvector, provider embedding model).
 *
 * The catalog is the single gate (catalog.service) used by every service
 * (find_competency, CV/document extraction, matching, manage_skills), so a
 * one-time embedding gives semantic skill resolution everywhere.
 *
 * Idempotent: only embeds rows where embedding IS NULL (pass --all to re-embed).
 * Run AFTER seed:competencies:  npx tsx src/scripts/seed-competency-embeddings.ts
 */

import dotenv from 'dotenv';
dotenv.config();

import { pool } from '../services/database';
import { getEmbeddingClient } from '../services/ai/provider';
import { EMBEDDING_DIMENSION, MODEL_EMBEDDING } from '../services/ai/models';

const BATCH = 96;

function embedText(c: { name: string; name_fr: string; family: string; type: string }): string {
  // Name-first (queries are skill names) + family/type context for disambiguation.
  return `${c.name}. ${c.name_fr}. Famille: ${c.family}. Type: ${c.type}.`;
}

async function main() {
  const reembedAll = process.argv.includes('--all');
  const embeddings = getEmbeddingClient();

  const { rows } = await pool.query(
    `SELECT slug, name, name_fr, family, type FROM competencies
     ${reembedAll ? '' : 'WHERE embedding IS NULL'}
     ORDER BY slug`
  );
  if (rows.length === 0) {
    console.log('[competency-embeddings] nothing to embed (all up to date).');
    await pool.end();
    return;
  }
  console.log(`[competency-embeddings] embedding ${rows.length} competencies (model ${MODEL_EMBEDDING})...`);

  let done = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const resp = await embeddings.embeddings.create({
      model: MODEL_EMBEDDING,
      input: chunk.map(embedText),
      dimensions: EMBEDDING_DIMENSION,
    } as any);
    // Persist each vector (pgvector accepts a JSON-style array string).
    await Promise.all(
      chunk.map((c, j) => {
        const vec = `[${resp.data[j].embedding.join(',')}]`;
        return pool.query(`UPDATE competencies SET embedding = $1::vector WHERE slug = $2`, [vec, c.slug]);
      })
    );
    done += chunk.length;
    console.log(`  ${done}/${rows.length}`);
  }

  const { rows: cnt } = await pool.query(
    `SELECT count(*) FILTER (WHERE embedding IS NOT NULL) AS embedded, count(*) AS total FROM competencies`
  );
  console.log(`[competency-embeddings] ✅ done — ${cnt[0].embedded}/${cnt[0].total} competencies embedded.`);
  await pool.end();
}

main().catch((err) => {
  console.error('[competency-embeddings] ❌', err);
  process.exit(1);
});
