/**
 * Ontology Cache — Loads docs/ontology.md once at startup and caches in memory
 * Injected into all copilot agent prompts so agents know the platform's
 * entities, enums, relationships, permissions, and business rules.
 */

import fs from 'fs';
import path from 'path';
import { logger } from '../../utils';

let cachedOntology: string | null = null;

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
 * Force reload the ontology from disk (useful for dev/hot-reload)
 */
export function reloadOntology(): void {
  cachedOntology = null;
  getOntology();
}
