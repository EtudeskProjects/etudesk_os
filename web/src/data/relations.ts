/**
 * Graphe d'edges du referentiel (prerequis / mene-vers / voisines / associees).
 * Isole de taxonomy.ts pour ne charger edges.json (~175KB) que sur la page
 * Digital Skills, et pas sur les autres pages qui importent la taxonomie.
 */

import edgesRaw from './edges.json';
import { BY_SLUG, type Competency } from './taxonomy';

export interface SlugRelations {
  pre: string[];   // prerequis : a apprendre avant
  leads: string[]; // mene vers : ce que cette competence debloque
  sib: string[];   // voisines : competences soeurs (meme famille)
  rel: string[];   // souvent associees : co-occurrence
  d: number;       // degre total (nombre de relations, non plafonne)
}

const EDGES = edgesRaw as Record<string, SlugRelations>;
const EMPTY: SlugRelations = { pre: [], leads: [], sib: [], rel: [], d: 0 };

/** Nombre total de relations (lignes d'edges dirigees) = prerequis + voisines +
 *  co-occurrences cote source ('leads' est l'inverse des prerequis, exclu pour ne
 *  pas double-compter). Dynamique -> reste juste quand le referentiel evolue. */
export const RELATION_COUNT = Object.values(EDGES).reduce(
  (n, r) => n + r.pre.length + r.sib.length + r.rel.length,
  0
);

export function getRelations(slug: string): SlugRelations {
  return EDGES[slug] || EMPTY;
}

export function getDegree(slug: string): number {
  return EDGES[slug]?.d || 0;
}

/** Resout une liste de slugs en competences (ignore les inconnus). */
export function resolve(slugs: string[]): Competency[] {
  return slugs.map((s) => BY_SLUG[s]).filter(Boolean);
}

/** Competences classees par degre de connexion (les "hubs" du referentiel). */
export const SKILLS_BY_DEGREE: string[] = Object.keys(EDGES)
  .sort((a, b) => (EDGES[b].d || 0) - (EDGES[a].d || 0));
