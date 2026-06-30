/**
 * Find Competency Tool (read-only) — lets the study tutor check whether a topic
 * exists in the Etudesk skills referential and get the closest catalog entries.
 *
 * The tutor teaches ONLY referential competencies. When a learner asks for an
 * off-catalog topic, the tutor calls this to gently redirect to real catalog
 * skills — never inventing a skill.
 */

import { defineTool } from './tool-helper';
import { z } from 'zod';
import * as catalog from '../../skills/catalog.service';

export function createFindCompetencyTool() {
  return defineTool({
    name: 'find_competency',
    description:
      'Look up a learning topic in the Etudesk competency catalog (the referential — the ONLY skills the tutor may teach). Returns whether the topic maps to a catalog competency (with its family + type) and the closest catalog suggestions. Use this when the learner asks to learn something, to confirm it is in the referential, or to propose in-catalog alternatives when it is not. Never teach or name a skill that is not returned here.',
    parameters: z.object({
      query: z.string().min(1).max(120).describe('The topic or skill the learner wants to learn (e.g. "React", "prise de parole", "astrologie").'),
    }),
    normalize: (raw: any) => ({ query: raw.query || raw.topic || raw.skill || raw.label }),
    execute: async ({ query }) => {
      const resolved = await catalog.resolveLabel(query);
      const suggestions = await catalog.suggestCompetencies(query, 5);
      const graph =
        resolved
          ? {
              prerequisites: (
                await catalog.getNeighbors(resolved.slug, { relations: ['prerequisite'], limit: 5 })
              ).map((n) => ({ slug: n.slug, relation: n.relation, strength: n.strength })),
              next_steps: (
                await catalog.getDependents(resolved.slug, { relations: ['prerequisite'], limit: 5 })
              ).map((n) => ({ slug: n.slug, relation: n.relation, strength: n.strength })),
              related: (
                await catalog.getNeighbors(resolved.slug, { relations: ['sibling', 'co_occurrence'], limit: 5 })
              ).map((n) => ({ slug: n.slug, relation: n.relation, strength: n.strength })),
            }
          : null;
      return {
        query,
        in_catalog: !!resolved,
        competency: resolved
          ? { slug: resolved.slug, name: resolved.name, name_fr: resolved.name_fr, family: resolved.family, type: resolved.type }
          : null,
        graph,
        suggestions: suggestions.map((s) => ({ slug: s.slug, name: s.name, name_fr: s.name_fr, family: s.family, type: s.type })),
      };
    },
  });
}
