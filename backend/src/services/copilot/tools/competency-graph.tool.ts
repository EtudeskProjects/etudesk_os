/**
 * Competency Graph Tool — exposes competency_edges to agents.
 *
 * This is the read-only bridge between the catalog graph and pedagogical flows:
 * prerequisites, next steps, siblings, related skills, and a compact roadmap
 * that can account for the authenticated talent's current skills.
 */

import { z } from 'zod';
import { defineTool } from './tool-helper';
import * as catalog from '../../skills/catalog.service';
import { pool } from '../../database';

type Level = 'beginner' | 'intermediate' | 'advanced' | 'master';

interface SkillState {
  level: Level;
  score: number;
  confidence: number;
}

interface GraphItem {
  slug: string;
  name: string;
  name_fr: string;
  family: string;
  type: string;
  relation: catalog.EdgeRelation;
  strength: number;
  known?: boolean;
  level?: Level;
  score?: number;
  confidence?: number;
}

async function loadTalentSkills(talentId?: string): Promise<Map<string, SkillState>> {
  const out = new Map<string, SkillState>();
  if (!talentId) return out;
  const { rows } = await pool.query(
    `SELECT competency_slug, level, score, confidence
     FROM talent_skills
     WHERE talent_id = $1 AND decay_state <> 'archived' AND is_visible = true`,
    [talentId]
  );
  for (const r of rows) {
    out.set(r.competency_slug, {
      level: r.level,
      score: Number(r.score),
      confidence: Number(r.confidence),
    });
  }
  return out;
}

async function hydrate(
  neighbors: catalog.Neighbor[],
  states: Map<string, SkillState>
): Promise<GraphItem[]> {
  const out: GraphItem[] = [];
  const seen = new Set<string>();
  for (const n of neighbors) {
    if (seen.has(n.slug)) continue;
    seen.add(n.slug);
    const c = await catalog.getCompetency(n.slug);
    if (!c) continue;
    const state = states.get(n.slug);
    out.push({
      slug: c.slug,
      name: c.name,
      name_fr: c.name_fr,
      family: c.family,
      type: c.type,
      relation: n.relation,
      strength: n.strength,
      known: !!state,
      level: state?.level,
      score: state?.score,
      confidence: state?.confidence,
    });
  }
  return out;
}

function mergeByStrength(...lists: catalog.Neighbor[][]): catalog.Neighbor[] {
  const bySlug = new Map<string, catalog.Neighbor>();
  for (const list of lists) {
    for (const n of list) {
      const prior = bySlug.get(n.slug);
      if (!prior || n.strength > prior.strength) bySlug.set(n.slug, n);
    }
  }
  return [...bySlug.values()].sort((a, b) => b.strength - a.strength);
}

function roadmap(
  target: catalog.Competency,
  prerequisites: GraphItem[],
  siblings: GraphItem[],
  related: GraphItem[],
  nextSteps: GraphItem[],
  states: Map<string, SkillState>
) {
  const targetState = states.get(target.slug);
  const missingPrereq = prerequisites.filter((x) => !x.known).slice(0, 4);
  const reinforce = prerequisites.filter((x) => x.known && (x.score || 0) < 3).slice(0, 3);
  const practiceWith = [...siblings, ...related]
    .filter((x) => !x.known)
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 4);
  const advanceTo = nextSteps.filter((x) => !x.known).slice(0, 4);

  const steps: Array<{ phase: string; skills: GraphItem[]; rationale: string }> = [];
  if (missingPrereq.length) {
    steps.push({
      phase: 'start_with_prerequisites',
      skills: missingPrereq,
      rationale: 'These prerequisites are the strongest graph foundations for the target skill.',
    });
  }
  if (reinforce.length) {
    steps.push({
      phase: 'reinforce_existing_foundations',
      skills: reinforce,
      rationale: 'The learner already has these foundations but should consolidate them before advancing.',
    });
  }
  steps.push({
    phase: targetState ? 'deepen_target_skill' : 'learn_target_skill',
    skills: [
      {
        slug: target.slug,
        name: target.name,
        name_fr: target.name_fr,
        family: target.family,
        type: target.type,
        relation: 'sibling',
        strength: 1,
        known: !!targetState,
        level: targetState?.level,
        score: targetState?.score,
        confidence: targetState?.confidence,
      },
    ],
    rationale: targetState
      ? 'The target skill is already in the profile; focus on practice, gaps, and upgrade evidence.'
      : 'The target skill is the requested learning objective.',
  });
  if (practiceWith.length) {
    steps.push({
      phase: 'practice_with_adjacent_skills',
      skills: practiceWith,
      rationale: 'Sibling and co-occurring skills make useful exercises or mini-projects.',
    });
  }
  if (advanceTo.length) {
    steps.push({
      phase: 'next_steps',
      skills: advanceTo,
      rationale: 'These skills depend on or commonly follow the target in the graph.',
    });
  }
  return steps;
}

export function createCompetencyGraphTool(authenticatedTalentId?: string) {
  return defineTool({
    name: 'competency_graph',
    description:
      'Read the Etudesk competency graph for a catalog skill. Returns prerequisites, next steps, sibling skills, related co-occurrences, and a roadmap that can account for the learner current skills. Use this for learning paths, roadmaps, skill-gap explanations, next recommendations, and study sequencing.',
    parameters: z.object({
      query: z.string().min(1).max(120).describe('Catalog skill label or slug, e.g. "Digital Literacy", "React", "Data Analytics".'),
      includeRoadmap: z.boolean().default(true).describe('Whether to include ordered roadmap phases.'),
      limit: z.number().int().min(3).max(12).default(8).describe('Maximum items per relation group.'),
    }),
    normalize: (raw: any) => ({
      query: raw.query || raw.topic || raw.skill || raw.skillQuery || raw.label,
      includeRoadmap: raw.includeRoadmap ?? raw.roadmap ?? true,
      limit: raw.limit ?? 8,
    }),
    execute: async ({ query, includeRoadmap, limit }) => {
      const resolved = await catalog.resolveLabel(query);
      if (!resolved) {
        const suggestions = await catalog.suggestCompetencies(query, 5);
        return {
          query,
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

      const states = await loadTalentSkills(authenticatedTalentId);
      const [prereqRaw, leadsRaw, sibOutRaw, sibInRaw, relOutRaw, relInRaw] = await Promise.all([
        catalog.getNeighbors(resolved.slug, { relations: ['prerequisite'], limit }),
        catalog.getDependents(resolved.slug, { relations: ['prerequisite'], limit }),
        catalog.getNeighbors(resolved.slug, { relations: ['sibling'], limit }),
        catalog.getDependents(resolved.slug, { relations: ['sibling'], limit }),
        catalog.getNeighbors(resolved.slug, { relations: ['co_occurrence'], limit }),
        catalog.getDependents(resolved.slug, { relations: ['co_occurrence'], limit }),
      ]);

      const prerequisites = await hydrate(prereqRaw, states);
      const next_steps = await hydrate(leadsRaw, states);
      const siblings = await hydrate(mergeByStrength(sibOutRaw, sibInRaw).slice(0, limit), states);
      const related = await hydrate(mergeByStrength(relOutRaw, relInRaw).slice(0, limit), states);
      const current = states.get(resolved.slug);

      return {
        query,
        in_catalog: true,
        competency: {
          slug: resolved.slug,
          name: resolved.name,
          name_fr: resolved.name_fr,
          family: resolved.family,
          type: resolved.type,
          known: !!current,
          level: current?.level,
          score: current?.score,
          confidence: current?.confidence,
        },
        graph: {
          prerequisites,
          next_steps,
          siblings,
          related,
        },
        roadmap: includeRoadmap
          ? roadmap(resolved, prerequisites, siblings, related, next_steps, states)
          : undefined,
      };
    },
  });
}
