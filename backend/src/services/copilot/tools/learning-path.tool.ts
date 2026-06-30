/**
 * Learning Path Tool — auto-generates a certifying curriculum from the DAG.
 *
 * Given a target catalog skill, it closes the prerequisite DAG backward toward
 * the skills the authenticated talent already has, topologically orders the
 * missing skills (foundations first, hubs anchored), and returns the ordered
 * path with the distance-to-target. This is the runtime form of finding #3 in
 * STATISTICAL_ANALYSIS.md: the 13-level curriculum already exists implicitly in
 * the graph, so Etudesk can sequence parcours without manual authoring.
 *
 * The agent must NOT improvise prerequisite order from memory — it reads it here.
 */

import { z } from 'zod';
import { defineTool } from './tool-helper';
import * as catalog from '../../skills/catalog.service';
import {
  isHub,
  isFoundationSink,
  isBetweennessBridge,
  isDataGovernanceCore,
  FRONTIER_MIN_LEVEL,
  MAX_LEARNING_CHAIN,
} from '../../skills/graph-strategy';
import { pool } from '../../database';

// Closure bounds — keep the tool cheap (one getNeighbors query per expanded node).
const MAX_NODES = 60;
const PREREQ_LIMIT = 8;

type Kind = 'foundation' | 'hub' | 'governance_core' | 'standard';

interface PathStep {
  order: number;
  level: number; // longest prerequisite distance within the missing sub-DAG (0 = start here)
  slug: string;
  name: string;
  name_fr: string;
  family: string;
  type: string;
  kind: Kind;
  is_bridge: boolean;
}

async function loadKnownSlugs(talentId?: string): Promise<Set<string>> {
  const out = new Set<string>();
  if (!talentId) return out;
  const { rows } = await pool.query(
    `SELECT competency_slug
     FROM talent_skills
     WHERE talent_id = $1 AND decay_state <> 'archived' AND is_visible = true`,
    [talentId]
  );
  for (const r of rows) out.add(r.competency_slug);
  return out;
}

function classify(slug: string): Kind {
  if (isFoundationSink(slug)) return 'foundation';
  if (isHub(slug)) return 'hub';
  if (isDataGovernanceCore(slug)) return 'governance_core';
  return 'standard';
}

export function createLearningPathTool(authenticatedTalentId?: string) {
  return defineTool({
    name: 'learning_path',
    description:
      'Generate the ordered learning path from the talent\'s CURRENT skills to a TARGET catalog skill. Closes the prerequisite DAG, places foundations first and anchors hubs, and returns the ordered steps plus the distance-to-target (how many skills are missing). Use this for "how do I become X", "fastest path to learn X", roadmaps, study plans, and gap-to-role analysis. Always prefer this over inventing a prerequisite order from memory.',
    parameters: z.object({
      target: z
        .string()
        .min(1)
        .max(120)
        .describe('The target skill label or slug to reach, e.g. "Retrieval-Augmented Generation", "Data Analytics", "React".'),
    }),
    normalize: (raw: any) => ({
      target: raw.target || raw.query || raw.skill || raw.goal || raw.skillQuery || raw.label,
    }),
    execute: async ({ target }) => {
      const resolved = await catalog.resolveLabel(target);
      if (!resolved) {
        const suggestions = await catalog.suggestCompetencies(target, 5);
        return {
          target,
          in_catalog: false,
          competency: null,
          suggestions: suggestions.map((s) => ({
            slug: s.slug,
            name: s.name,
            name_fr: s.name_fr,
            family: s.family,
            type: s.type,
          })),
        };
      }

      const known = await loadKnownSlugs(authenticatedTalentId);
      const targetKnown = known.has(resolved.slug);

      // --- Close the prerequisite DAG backward toward known skills ----------
      // Edge semantics: getNeighbors(S, prerequisite) returns the prerequisites
      // of S (learn P before S). We collect edges P -> S among MISSING skills.
      const missing = new Set<string>(); // unknown slugs the talent must learn
      const edges: Array<[string, string]> = []; // [prereq, dependent], both candidates
      const knownFoundations = new Set<string>(); // prerequisites already satisfied
      const visited = new Set<string>();
      const queue: string[] = [];

      if (!targetKnown) {
        missing.add(resolved.slug);
        queue.push(resolved.slug);
        visited.add(resolved.slug);
      }

      while (queue.length > 0 && missing.size < MAX_NODES) {
        const s = queue.shift()!;
        const prereqs = await catalog.getNeighbors(s, { relations: ['prerequisite'], limit: PREREQ_LIMIT });
        for (const p of prereqs) {
          edges.push([p.slug, s]);
          if (known.has(p.slug)) {
            knownFoundations.add(p.slug);
            continue; // satisfied boundary — do not expand further
          }
          if (!visited.has(p.slug) && missing.size < MAX_NODES) {
            visited.add(p.slug);
            missing.add(p.slug);
            queue.push(p.slug);
          }
        }
      }

      // --- Topological order over the MISSING sub-DAG (Kahn) ----------------
      const adj = new Map<string, string[]>(); // prereq -> [dependents]
      const indegree = new Map<string, number>();
      for (const slug of missing) indegree.set(slug, 0);
      for (const [from, to] of edges) {
        if (!missing.has(from) || !missing.has(to)) continue; // only intra-missing edges
        const deps = adj.get(from);
        if (deps) deps.push(to);
        else adj.set(from, [to]);
        indegree.set(to, (indegree.get(to) ?? 0) + 1);
      }

      // Priority: teach foundations and hubs first, then bridges, then by slug.
      const priority = (slug: string): number => {
        if (isFoundationSink(slug)) return 0;
        if (isHub(slug)) return 1;
        if (isBetweennessBridge(slug)) return 2;
        return 3;
      };
      const ready: string[] = [...missing].filter((s) => (indegree.get(s) ?? 0) === 0);
      const pickNext = (): string => {
        ready.sort((a, b) => priority(a) - priority(b) || a.localeCompare(b));
        return ready.shift()!;
      };

      const ordered: string[] = [];
      const level = new Map<string, number>();
      for (const s of missing) level.set(s, 0);
      while (ready.length > 0) {
        const s = pickNext();
        ordered.push(s);
        for (const dep of adj.get(s) ?? []) {
          level.set(dep, Math.max(level.get(dep) ?? 0, (level.get(s) ?? 0) + 1));
          const d = (indegree.get(dep) ?? 0) - 1;
          indegree.set(dep, d);
          if (d === 0) ready.push(dep);
        }
      }
      // Cycle guard (the catalog DAG is acyclic, but never trust unbounded input):
      // any node not ordered is appended deterministically so nothing is dropped.
      if (ordered.length < missing.size) {
        for (const s of missing) if (!ordered.includes(s)) ordered.push(s);
      }

      // --- Hydrate metadata + build steps ----------------------------------
      const metas = await Promise.all(ordered.map((s) => catalog.getCompetency(s)));
      const steps: PathStep[] = [];
      ordered.forEach((slug, i) => {
        const c = metas[i];
        if (!c) return;
        steps.push({
          order: steps.length + 1,
          level: level.get(slug) ?? 0,
          slug: c.slug,
          name: c.name,
          name_fr: c.name_fr,
          family: c.family,
          type: c.type,
          kind: classify(slug),
          is_bridge: isBetweennessBridge(slug),
        });
      });

      const depth = steps.reduce((m, s) => Math.max(m, s.level), 0) + (steps.length ? 1 : 0);
      const anchorHubs = steps.filter((s) => s.kind === 'hub' || s.kind === 'foundation').map((s) => s.name);
      const targetLevel = level.get(resolved.slug) ?? 0;

      return {
        target,
        in_catalog: true,
        competency: {
          slug: resolved.slug,
          name: resolved.name,
          name_fr: resolved.name_fr,
          family: resolved.family,
          type: resolved.type,
          already_known: targetKnown,
        },
        summary: {
          already_known: targetKnown,
          missing_count: steps.length,
          path_depth: depth, // ordered learning levels (>= ~9 means a frontier target)
          is_frontier_target: targetLevel >= FRONTIER_MIN_LEVEL || depth >= FRONTIER_MIN_LEVEL,
          truncated: missing.size >= MAX_NODES, // closure hit the node cap; path is partial
          chain_cap: MAX_LEARNING_CHAIN,
          anchor_hubs: anchorHubs,
          satisfied_foundations: [...knownFoundations],
          next_steps: steps.slice(0, 3).map((s) => s.name), // start here
        },
        path: steps,
        note: targetKnown
          ? 'The talent already has the target skill. Use competency_graph for next_steps to deepen or branch out.'
          : steps.length === 0
            ? 'No missing prerequisites in the graph: the target is a foundation the talent can start directly.'
            : 'Teach in order. Foundations and hubs come first; the target is the last step.',
      };
    },
  });
}
