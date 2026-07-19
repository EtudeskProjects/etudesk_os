/** Runtime ontology cache.
 *
 * The previous implementation maintained several lossy variants of a long
 * implementation document. The agents now consume one concise contract, so a
 * single immutable cache is both clearer and cheaper.
 */
import fs from 'fs';
import path from 'path';
import { logger } from '../../utils';

let cachedOntology: string | null = null;

export function getOntology(): string {
  if (cachedOntology) return cachedOntology;

  const ontologyPath = path.resolve(__dirname, '../../../../docs/ONTOLOGY.md');
  try {
    cachedOntology = fs.readFileSync(ontologyPath, 'utf-8').trim();
    logger.info(`[ontology.cache] Loaded runtime contract (${cachedOntology.length} chars)`);
    return cachedOntology;
  } catch (error: any) {
    // A missing runtime contract is a deployment defect, not a reason to invent
    // behaviour from an outdated fallback document.
    throw new Error(`Unable to load runtime ontology: ${error.message}`);
  }
}

export const getOntologySlim = getOntology;
export const getOntologyForStudy = getOntology;
export const getOntologyForExplore = getOntology;
export const getOntologyForOrg = getOntology;

export function reloadOntology(): void {
  cachedOntology = null;
  getOntology();
}
