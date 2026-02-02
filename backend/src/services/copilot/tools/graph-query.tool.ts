/**
 * Graph Query Tool — Neo4j relationship queries
 * Wraps existing graph tools into a unified intent-based interface
 */

import { tool } from '@openai/agents';
import { z } from 'zod';
import {
  queryTalentGraph,
  findOpportunityMatches,
  findSimilarTalents,
  exploreSkillPath,
  getLearningProgress,
  getSkillGaps,
  addInferredInterest,
  suggestSkillToLearn,
  recordLearningActivity,
  addSkillToProfile,
  updateMasteryLevel,
} from './graph.tools';

export const graphQueryTool = tool({
  name: 'graph_query',
  description:
    "Exécute une requête sur le graphe de connaissances Neo4j. Utilise pour explorer les relations entre talents, compétences, organisations, communautés. Peut trouver des chemins d'apprentissage, des skill gaps, des recommandations.",
  parameters: z.object({
    intent: z.enum([
      'talent_skills',
      'skill_gaps',
      'opportunity_matches',
      'similar_talents',
      'learning_path',
      'skill_prerequisites',
      'community_network',
      'learning_progress',
      'add_interest',
      'suggest_skill',
      'record_activity',
      'add_skill',
      'update_mastery',
    ]),
    paramsJson: z.string().describe("Paramètres spécifiques à l'intent en JSON string (ex: '{\"talentId\":\"uuid\"}')"),
  }),
  execute: async ({ intent, paramsJson }) => {
    // Parse params from JSON string
    const params: Record<string, unknown> = paramsJson ? JSON.parse(paramsJson) : {};
    const talentId = params.talentId as string;
    if (!talentId) {
      return { error: 'talentId est requis dans params' };
    }
    const context = { talentId };

    try {
      switch (intent) {
        case 'talent_skills':
          return await queryTalentGraph(
            {
              includeInferences: (params.includeInferences as boolean) ?? true,
              includeNetwork: (params.includeNetwork as boolean) ?? false,
            },
            context
          );

        case 'skill_gaps':
          return await getSkillGaps(
            { limit: (params.limit as number) ?? 10 },
            context
          );

        case 'opportunity_matches':
          return await findOpportunityMatches(
            {
              minMatchScore: (params.minMatchScore as number) ?? 0.3,
              types: params.types as string[] | undefined,
              locationTypes: params.locationTypes as string[] | undefined,
              limit: (params.limit as number) ?? 10,
            },
            context
          );

        case 'similar_talents':
          return await findSimilarTalents(
            {
              minCommonSkills: (params.minCommonSkills as number) ?? 3,
              limit: (params.limit as number) ?? 10,
            },
            context
          );

        case 'learning_path':
        case 'skill_prerequisites':
          return await exploreSkillPath(
            {
              targetSkill: params.targetSkill as string,
              maxSteps: (params.maxSteps as number) ?? 5,
            },
            context
          );

        case 'learning_progress':
          return await getLearningProgress(
            {
              includeRecommendations: (params.includeRecommendations as boolean) ?? true,
            },
            context
          );

        case 'add_interest':
          return await addInferredInterest(
            {
              targetName: params.targetName as string,
              targetType: params.targetType as 'Skill' | 'Organization' | 'Community' | 'Opportunity',
              confidence: params.confidence as number,
              reason: params.reason as string,
              evidence: params.evidence as string[] | undefined,
            },
            context
          );

        case 'suggest_skill':
          return await suggestSkillToLearn(
            {
              skillName: params.skillName as string,
              priority: params.priority as 'low' | 'medium' | 'high' | 'critical',
              confidence: params.confidence as number,
              reason: params.reason as string,
              relatedOpportunities: params.relatedOpportunities as string[] | undefined,
            },
            context
          );

        case 'record_activity':
          return await recordLearningActivity(
            {
              topicName: params.topicName as string,
              minutesStudied: params.minutesStudied as number,
              activityType: params.activityType as any,
            },
            context
          );

        case 'add_skill':
          return await addSkillToProfile(
            {
              skillName: params.skillName as string,
              type: params.type as 'KNOWLEDGE' | 'HARD_SKILL' | 'SOFT_SKILL',
              proficiencyLevel: params.proficiencyLevel as 'BEGINNER' | 'INTERMEDIATE' | 'EXPERT' | 'MASTER',
              context: params.context as string | undefined,
            },
            context
          );

        case 'update_mastery':
          return await updateMasteryLevel(
            {
              topicName: params.topicName as string,
              newMasteryLevel: params.newMasteryLevel as number,
              reason: params.reason as string | undefined,
            },
            context
          );

        default:
          return { error: `Intent '${intent}' non reconnu` };
      }
    } catch (error: any) {
      console.error(`Graph query error (${intent}):`, error);
      return { error: error.message };
    }
  },
});
