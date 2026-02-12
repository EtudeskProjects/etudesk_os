/**
 * Ontology Cache — Loads docs/ontology.md once at startup and caches in memory
 * Injected into all copilot agent prompts so agents know the platform's
 * entities, enums, relationships, permissions, and business rules.
 */

import fs from 'fs';
import path from 'path';
import { logger } from '../../utils';

let cachedOntology: string | null = null;
let cachedOntologySlim: string | null = null;

/**
 * Returns the ontology content, loading from disk only on first call.
 * Subsequent calls return the cached string.
 */
export function getOntology(): string {
  if (cachedOntology !== null) {
    return cachedOntology;
  }

  try {
    const ontologyPath = path.resolve(__dirname, '../../../../docs/ontology.md');
    cachedOntology = fs.readFileSync(ontologyPath, 'utf-8');
    logger.info(`[ontology.cache] Loaded ontology (${cachedOntology.length} chars)`);
  } catch (error: any) {
    logger.error(`[ontology.cache] Failed to load ontology: ${error.message}`);
    cachedOntology = '(Ontologie non disponible)';
  }

  return cachedOntology;
}

/**
 * Returns a slimmed-down ontology with sections 5 (Action Ontology) and
 * 8 (Copilot Agent Mapping) removed. These sections are reference material
 * not needed by agents at runtime. Saves ~3,400 tokens per request.
 */
export function getOntologySlim(): string {
  if (cachedOntologySlim !== null) {
    return cachedOntologySlim;
  }

  const full = getOntology();
  const lines = full.split('\n');
  const filtered: string[] = [];
  let skip = false;

  for (const line of lines) {
    if (line.startsWith('## 5. Action Ontology') || line.startsWith('## 8. Copilot Agent Mapping')) {
      skip = true;
      continue;
    }
    if (skip && line.startsWith('## ')) {
      skip = false;
    }
    if (!skip) {
      filtered.push(line);
    }
  }

  cachedOntologySlim = filtered.join('\n');
  logger.info(`[ontology.cache] Slim ontology: ${cachedOntologySlim.length} chars (was ${full.length})`);
  return cachedOntologySlim;
}

/**
 * Force reload the ontology from disk (useful for dev/hot-reload)
 */
export function reloadOntology(): void {
  cachedOntology = null;
  cachedOntologySlim = null;
  getOntology();
}
