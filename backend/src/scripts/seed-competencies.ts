/**
 * Seed Competencies — load the digital skills referential into Postgres.
 *
 * Source of truth: datasets/etudesk_digital_skills/
 *   - competency_catalog.csv  -> competencies
 *   - competency_edges.csv     -> competency_edges
 *   - competency_manifest.json -> catalog_version + checksums + expected counts
 *
 * Idempotent and transactional. Verifies CSV checksums against the manifest
 * (same discipline as validate_edges.py), then upserts the catalog and replaces
 * the edge set wholesale (the CSV is the single source of truth).
 *
 * Run AFTER migrations, BEFORE any talent_skills / *_skills seed (FK order):
 *   npx tsx src/scripts/seed-competencies.ts
 *
 * Dataset path resolves from the repo by default; override with
 * COMPETENCIES_DATASET_DIR for non-standard deploy layouts (e.g. VPS).
 */

import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { pool } from '../services/database';

const DEFAULT_DATASET_DIR = path.resolve(
  __dirname,
  '../../../datasets/etudesk_digital_skills'
);
const DATASET_DIR = process.env.COMPETENCIES_DATASET_DIR || DEFAULT_DATASET_DIR;

const CATALOG_CSV = path.join(DATASET_DIR, 'competency_catalog.csv');
const EDGES_CSV = path.join(DATASET_DIR, 'competency_edges.csv');
const MANIFEST_JSON = path.join(DATASET_DIR, 'competency_manifest.json');

/** Minimal RFC-4180-ish CSV parser: handles quoted fields, commas and "" escapes. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch === '\r') {
      // ignore; handled by \n
    } else {
      field += ch;
    }
  }
  // last field / row (if file does not end with newline)
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ''));
}

function sha256(filePath: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

async function main() {
  console.log(`[seed-competencies] dataset dir: ${DATASET_DIR}`);

  for (const f of [CATALOG_CSV, EDGES_CSV, MANIFEST_JSON]) {
    if (!fs.existsSync(f)) {
      throw new Error(`Missing referential file: ${f}`);
    }
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_JSON, 'utf8')) as {
    catalog_version: string;
    competency_count: number;
    edge_count: number;
    files: Record<string, string>;
  };
  const catalogVersion = manifest.catalog_version;
  console.log(`[seed-competencies] catalog_version: ${catalogVersion}`);

  // Verify checksums (fail fast on drift)
  const catalogHash = sha256(CATALOG_CSV);
  const edgesHash = sha256(EDGES_CSV);
  const expCatalog = manifest.files['competency_catalog.csv'];
  const expEdges = manifest.files['competency_edges.csv'];
  if (expCatalog && expCatalog !== catalogHash) {
    throw new Error(
      `competency_catalog.csv checksum mismatch (manifest ${expCatalog}, file ${catalogHash}). Run validate_edges.py to refresh the manifest.`
    );
  }
  if (expEdges && expEdges !== edgesHash) {
    throw new Error(
      `competency_edges.csv checksum mismatch (manifest ${expEdges}, file ${edgesHash}). Run validate_edges.py to refresh the manifest.`
    );
  }

  // Parse catalog
  const catalogRows = parseCsv(fs.readFileSync(CATALOG_CSV, 'utf8'));
  const catalogHeader = catalogRows.shift();
  const requiredCatalogHeader = ['slug', 'family', 'type', 'name', 'name_fr'];
  if (
    !catalogHeader ||
    requiredCatalogHeader.some((column, index) => catalogHeader[index] !== column)
  ) {
    throw new Error(`Unexpected catalog header: ${catalogHeader?.join(',')}`);
  }
  const competencies = catalogRows.map(([slug, family, type, name, name_fr]) => ({
    slug: slug.trim(),
    family: family.trim(),
    type: type.trim(),
    name: name.trim(),
    name_fr: name_fr.trim(),
  }));

  // Parse edges
  const edgeRows = parseCsv(fs.readFileSync(EDGES_CSV, 'utf8'));
  const edgeHeader = edgeRows.shift();
  if (!edgeHeader || edgeHeader.join(',') !== 'from_slug,to_slug,relation,strength,reason') {
    throw new Error(`Unexpected edges header: ${edgeHeader?.join(',')}`);
  }
  const edges = edgeRows.map(([from_slug, to_slug, relation, strength, reason]) => ({
    from_slug: from_slug.trim(),
    to_slug: to_slug.trim(),
    relation: relation.trim(),
    strength: parseFloat(strength),
    reason: (reason || '').trim() || null,
  }));

  console.log(
    `[seed-competencies] parsed ${competencies.length} competencies, ${edges.length} edges`
  );

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Upsert competencies in batches
    const BATCH = 200;
    for (let i = 0; i < competencies.length; i += BATCH) {
      const slice = competencies.slice(i, i + BATCH);
      const values: any[] = [];
      const tuples = slice
        .map((c, j) => {
          const b = j * 6;
          values.push(c.slug, c.family, c.type, c.name, c.name_fr, catalogVersion);
          return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6})`;
        })
        .join(',');
      await client.query(
        `INSERT INTO competencies (slug, family, type, name, name_fr, catalog_version)
         VALUES ${tuples}
         ON CONFLICT (slug) DO UPDATE SET
           family = EXCLUDED.family,
           type = EXCLUDED.type,
           name = EXCLUDED.name,
           name_fr = EXCLUDED.name_fr,
           catalog_version = EXCLUDED.catalog_version,
           updated_at = NOW()`,
        values
      );
    }

    // Remove competencies that are no longer in the catalog (retired skills).
    const slugs = competencies.map((c) => c.slug);
    await client.query(
      `DELETE FROM competencies WHERE slug <> ALL($1::text[])`,
      [slugs]
    );

    // Replace edge set wholesale (CSV is the single source of truth).
    await client.query('DELETE FROM competency_edges');
    for (let i = 0; i < edges.length; i += BATCH) {
      const slice = edges.slice(i, i + BATCH);
      const values: any[] = [];
      const tuples = slice
        .map((e, j) => {
          const b = j * 5;
          values.push(e.from_slug, e.to_slug, e.relation, e.strength, e.reason);
          return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5})`;
        })
        .join(',');
      await client.query(
        `INSERT INTO competency_edges (from_slug, to_slug, relation, strength, reason)
         VALUES ${tuples}
         ON CONFLICT (from_slug, to_slug) DO UPDATE SET
           relation = EXCLUDED.relation,
           strength = EXCLUDED.strength,
           reason = EXCLUDED.reason`,
        values
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // Assert counts match the manifest
  const { rows: cCount } = await pool.query(`SELECT COUNT(*)::int AS n FROM competencies`);
  const { rows: eCount } = await pool.query(`SELECT COUNT(*)::int AS n FROM competency_edges`);
  console.log(
    `[seed-competencies] loaded competencies=${cCount[0].n} (manifest ${manifest.competency_count}), edges=${eCount[0].n} (manifest ${manifest.edge_count})`
  );
  if (cCount[0].n !== manifest.competency_count) {
    throw new Error(
      `Competency count mismatch: loaded ${cCount[0].n}, manifest ${manifest.competency_count}`
    );
  }
  if (eCount[0].n !== manifest.edge_count) {
    throw new Error(`Edge count mismatch: loaded ${eCount[0].n}, manifest ${manifest.edge_count}`);
  }

  console.log('[seed-competencies] ✅ done');
  await pool.end();
}

main().catch((err) => {
  console.error('[seed-competencies] ❌', err);
  process.exit(1);
});
