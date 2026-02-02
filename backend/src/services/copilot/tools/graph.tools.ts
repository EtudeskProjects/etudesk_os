/**
 * Graph Tools for Copilot
 * Tools for querying and updating the Talent Graph
 */

import { z } from 'zod';
import {
  graphService,
  talentQueries,
  opportunityQueries,
  learningQueries,
  inferenceMutations,
  relationshipMutations,
  getMasteryLabel,
  explainRelationship,
  RelationshipTypes,
} from '../../graph';

// ═══════════════════════════════════════════════════════════════
// READING TOOLS SCHEMAS
// ═══════════════════════════════════════════════════════════════

export const queryTalentGraphSchema = z.object({
  includeInferences: z
    .boolean()
    .optional()
    .default(true)
    .describe("Inclure les relations inférées par l'agent (intérêts, suggestions)"),
  includeNetwork: z
    .boolean()
    .optional()
    .default(false)
    .describe('Inclure le réseau de connexions du talent'),
});

export const findOpportunityMatchesSchema = z.object({
  minMatchScore: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .default(0.3)
    .describe('Score de correspondance minimum (0-1)'),
  types: z
    .array(z.string())
    .optional()
    .describe("Types d'opportunités à inclure (EMPLOYMENT, INTERNSHIP, etc.)"),
  locationTypes: z
    .array(z.string())
    .optional()
    .describe('Types de localisation (REMOTE, ON_SITE, HYBRID)'),
  limit: z.number().min(1).max(20).optional().default(10).describe('Nombre maximum de résultats'),
});

export const findSimilarTalentsSchema = z.object({
  minCommonSkills: z
    .number()
    .min(1)
    .optional()
    .default(3)
    .describe('Nombre minimum de compétences communes'),
  limit: z.number().min(1).max(20).optional().default(10).describe('Nombre maximum de résultats'),
});

export const exploreSkillPathSchema = z.object({
  targetSkill: z
    .string()
    .describe("Nom de la compétence cible à atteindre"),
  maxSteps: z
    .number()
    .min(1)
    .max(10)
    .optional()
    .default(5)
    .describe("Nombre maximum d'étapes dans le parcours"),
});

export const getLearningProgressSchema = z.object({
  includeRecommendations: z
    .boolean()
    .optional()
    .default(true)
    .describe('Inclure les recommandations de compétences à apprendre'),
});

export const getSkillGapsSchema = z.object({
  limit: z
    .number()
    .min(1)
    .max(20)
    .optional()
    .default(10)
    .describe('Nombre maximum de lacunes à identifier'),
});

// ═══════════════════════════════════════════════════════════════
// WRITING TOOLS SCHEMAS
// ═══════════════════════════════════════════════════════════════

export const addInferredInterestSchema = z.object({
  targetName: z.string().describe("Nom de la cible (compétence, organisation, communauté)"),
  targetType: z
    .enum(['Skill', 'Organization', 'Community', 'Opportunity'])
    .describe('Type de la cible'),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Niveau de confiance de l'inférence (0-1)"),
  reason: z.string().describe("Raison de l'intérêt détecté"),
  evidence: z
    .array(z.string())
    .optional()
    .describe('Preuves ou signaux ayant mené à cette inférence'),
});

export const suggestSkillToLearnSchema = z.object({
  skillName: z.string().describe('Nom de la compétence suggérée'),
  priority: z
    .enum(['low', 'medium', 'high', 'critical'])
    .describe('Priorité de la suggestion'),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe('Niveau de confiance de la suggestion (0-1)'),
  reason: z.string().describe('Raison de la suggestion'),
  relatedOpportunities: z
    .array(z.string())
    .optional()
    .describe('Titres des opportunités liées'),
});

export const recordLearningActivitySchema = z.object({
  topicName: z.string().describe("Nom du sujet d'étude"),
  minutesStudied: z.number().min(1).describe("Durée d'étude en minutes"),
  activityType: z
    .enum(['flashcard_review', 'quiz', 'reading', 'video', 'exercise'])
    .optional()
    .describe("Type d'activité d'apprentissage"),
});

export const addSkillToProfileSchema = z.object({
  skillName: z.string().describe('Nom de la compétence à ajouter au profil'),
  type: z
    .enum(['KNOWLEDGE', 'HARD_SKILL', 'SOFT_SKILL'])
    .describe('Type de compétence'),
  proficiencyLevel: z
    .enum(['BEGINNER', 'INTERMEDIATE', 'EXPERT', 'MASTER'])
    .describe("Niveau de maîtrise évalué par l'agent"),
  context: z
    .string()
    .optional()
    .describe("Contexte d'évaluation (ex: 'Démontré lors du quiz sur les design patterns')"),
});

export const updateMasteryLevelSchema = z.object({
  topicName: z.string().describe("Nom du sujet d'étude"),
  newMasteryLevel: z
    .number()
    .min(0)
    .max(100)
    .describe('Nouveau niveau de maîtrise (0-100)'),
  reason: z.string().optional().describe('Raison de la mise à jour'),
});

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export type QueryTalentGraphParams = z.infer<typeof queryTalentGraphSchema>;
export type FindOpportunityMatchesParams = z.infer<typeof findOpportunityMatchesSchema>;
export type FindSimilarTalentsParams = z.infer<typeof findSimilarTalentsSchema>;
export type ExploreSkillPathParams = z.infer<typeof exploreSkillPathSchema>;
export type GetLearningProgressParams = z.infer<typeof getLearningProgressSchema>;
export type GetSkillGapsParams = z.infer<typeof getSkillGapsSchema>;
export type AddInferredInterestParams = z.infer<typeof addInferredInterestSchema>;
export type SuggestSkillToLearnParams = z.infer<typeof suggestSkillToLearnSchema>;
export type RecordLearningActivityParams = z.infer<typeof recordLearningActivitySchema>;
export type AddSkillToProfileParams = z.infer<typeof addSkillToProfileSchema>;
export type UpdateMasteryLevelParams = z.infer<typeof updateMasteryLevelSchema>;

// ═══════════════════════════════════════════════════════════════
// READING TOOLS IMPLEMENTATIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Query the talent's complete graph (ego network)
 */
export async function queryTalentGraph(
  params: QueryTalentGraphParams,
  context: { talentId: string }
): Promise<{
  summary: any;
  skills: any[];
  experiences: any[];
  communities: any[];
  inferences?: any;
  network?: any;
}> {
  const { includeInferences, includeNetwork } = params;

  // Get talent summary
  const summary = await talentQueries.getTalentSummary(context.talentId);

  if (!summary) {
    return {
      summary: null,
      skills: [],
      experiences: [],
      communities: [],
    };
  }

  // Get detailed skills
  const skills = await talentQueries.getTalentSkills(context.talentId);

  // Get career timeline
  const experiences = await talentQueries.getCareerTimeline(context.talentId);

  // Get communities
  const communities = await talentQueries.getTalentCommunities(context.talentId);

  const result: any = {
    summary,
    skills: skills.slice(0, 15), // Limit for context
    experiences,
    communities,
  };

  // Include inferences if requested
  if (includeInferences) {
    result.inferences = await talentQueries.getTalentInferences(context.talentId);
  }

  // Include network if requested
  if (includeNetwork) {
    result.network = await talentQueries.getTalentNetwork(context.talentId);
  }

  return result;
}

/**
 * Find opportunities matching the talent's skills via the graph
 */
export async function findOpportunityMatches(
  params: FindOpportunityMatchesParams,
  context: { talentId: string }
): Promise<{
  matches: any[];
  totalFound: number;
  averageMatchScore: number;
}> {
  const matches = await opportunityQueries.findMatchingOpportunities(context.talentId, {
    minMatchScore: params.minMatchScore,
    types: params.types,
    locationTypes: params.locationTypes,
    limit: params.limit,
  });

  const avgScore =
    matches.length > 0
      ? matches.reduce((sum, m) => sum + m.matchScore, 0) / matches.length
      : 0;

  return {
    matches: matches.map(m => ({
      opportunity: m.opportunity,
      organization: m.organization,
      matchedSkills: m.matchedSkills,
      missingSkills: m.missingSkills,
      matchScore: Math.round(m.matchScore * 100),
      matchScoreLabel: getMatchScoreLabel(m.matchScore),
    })),
    totalFound: matches.length,
    averageMatchScore: Math.round(avgScore * 100),
  };
}

/**
 * Find talents with similar skill profiles
 */
export async function findSimilarTalents(
  params: FindSimilarTalentsParams,
  context: { talentId: string }
): Promise<{
  similarTalents: any[];
  totalFound: number;
}> {
  const similar = await opportunityQueries.findSimilarTalents(context.talentId, {
    minCommonSkills: params.minCommonSkills,
    limit: params.limit,
  });

  return {
    similarTalents: similar.map(s => ({
      talent: s.talent,
      commonSkills: s.commonSkills,
      commonSkillsCount: s.commonSkillsCount,
      similarityScore: Math.round(s.similarityScore * 100),
    })),
    totalFound: similar.length,
  };
}

/**
 * Explore learning paths to reach a target skill
 */
export async function exploreSkillPath(
  params: ExploreSkillPathParams,
  context: { talentId: string }
): Promise<{
  paths: any[];
  targetSkill: string;
  hasPath: boolean;
  recommendations: string[];
  error?: string;
}> {
  if (!params.targetSkill) {
    return { paths: [], targetSkill: '', hasPath: false, recommendations: [], error: 'targetSkill est requis pour explorer un chemin d\'apprentissage' };
  }

  const paths = await learningQueries.findLearningPath(
    context.talentId,
    params.targetSkill,
    { maxSteps: params.maxSteps }
  );

  // Get related skills for recommendations
  const relatedSkills = await learningQueries.getRelatedSkills(params.targetSkill);

  return {
    paths: paths.map(p => ({
      learningPath: p.path,
      steps: p.steps,
      prerequisites: p.prerequisites,
    })),
    targetSkill: params.targetSkill,
    hasPath: paths.length > 0,
    recommendations: relatedSkills
      .filter(s => s.relationship === 'prerequisite')
      .map(s => s.skill.name)
      .slice(0, 5),
  };
}

/**
 * Get learning progress from the graph
 */
export async function getLearningProgress(
  params: GetLearningProgressParams,
  context: { talentId: string }
): Promise<{
  progress: any;
  recommendations?: any[];
  topicsNeedingReview?: any[];
}> {
  const progress = await learningQueries.getLearningProgress(context.talentId);

  const result: any = {
    progress: {
      topics: progress.topics.map(t => ({
        ...t,
        masteryLabel: getMasteryLabel(t.masteryLevel),
      })),
      averageMastery: Math.round(progress.averageMastery),
      averageMasteryLabel: getMasteryLabel(progress.averageMastery),
      totalTopics: progress.totalTopics,
      totalStudyTimeHours: Math.round(progress.totalStudyTime / 60 * 10) / 10,
      currentStreak: progress.currentStreak,
      longestStreak: progress.longestStreak,
    },
  };

  if (params.includeRecommendations) {
    const recommendations = await learningQueries.getSkillRecommendations(context.talentId, {
      limit: 5,
    });
    result.recommendations = recommendations.map(r => ({
      skill: r.skill.name,
      priority: r.priority,
      reason: r.reason,
      prerequisitesMet: r.prerequisitesMet,
    }));

    const needsReview = await learningQueries.getTopicsForReview(context.talentId);
    result.topicsNeedingReview = needsReview;
  }

  return result;
}

/**
 * Get skill gaps based on opportunity requirements
 */
export async function getSkillGaps(
  params: GetSkillGapsParams,
  context: { talentId: string }
): Promise<{
  gaps: any[];
  totalGaps: number;
  criticalGaps: number;
}> {
  const gaps = await opportunityQueries.getSkillGaps(context.talentId, {
    limit: params.limit,
  });

  return {
    gaps: gaps.map(g => ({
      skill: g.skill,
      demandCount: g.demandCount,
      opportunities: g.opportunities.slice(0, 3),
      priority: g.priority,
      priorityExplanation: getPriorityExplanation(g.priority),
    })),
    totalGaps: gaps.length,
    criticalGaps: gaps.filter(g => g.priority === 'critical' || g.priority === 'high').length,
  };
}

// ═══════════════════════════════════════════════════════════════
// WRITING TOOLS IMPLEMENTATIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Add an inferred interest based on conversation analysis
 */
export async function addInferredInterest(
  params: AddInferredInterestParams,
  context: { talentId: string }
): Promise<{
  success: boolean;
  message: string;
  relationship?: string;
}> {
  // First, we need to find or create the target
  // For simplicity, we'll use the name to find existing entities
  const result = await inferenceMutations.addInferredInterest(
    context.talentId,
    params.targetName, // This should be the ID, but we're using name for now
    params.targetType as 'Skill' | 'Organization' | 'Community' | 'Opportunity',
    {
      confidence: params.confidence,
      reason: params.reason,
      evidence: params.evidence,
    }
  );

  if (result.success) {
    return {
      success: true,
      message: `Intérêt enregistré: ${params.targetName} (confiance: ${Math.round(params.confidence * 100)}%)`,
      relationship: explainRelationship(RelationshipTypes.INTERESSE_PAR),
    };
  }

  return {
    success: false,
    message: result.message || 'Impossible d\'enregistrer l\'intérêt',
  };
}

/**
 * Suggest a skill for the talent to learn
 */
export async function suggestSkillToLearn(
  params: SuggestSkillToLearnParams,
  context: { talentId: string }
): Promise<{
  success: boolean;
  message: string;
  skillName?: string;
  priority?: string;
}> {
  const result = await inferenceMutations.suggestSkillToLearnByName(context.talentId, params.skillName, {
    confidence: params.confidence,
    priority: params.priority,
    reason: params.reason,
    relatedOpportunities: params.relatedOpportunities,
  });

  if (result.success) {
    return {
      success: true,
      message: `Suggestion enregistrée: apprendre "${params.skillName}" (priorité: ${params.priority})`,
      skillName: params.skillName,
      priority: params.priority,
    };
  }

  return {
    success: false,
    message: result.message || 'Impossible de créer la suggestion',
  };
}

/**
 * Record a learning activity in the graph
 */
export async function recordLearningActivity(
  params: RecordLearningActivityParams,
  context: { talentId: string }
): Promise<{
  success: boolean;
  message: string;
  topicName?: string;
  totalTimeMinutes?: number;
}> {
  try {
    // Find or create the topic and add study time
    const { nodeMutations } = await import('../../graph/mutations');
    const topicId = await nodeMutations.findOrCreateLearningTopic(context.talentId, params.topicName);

    await relationshipMutations.addStudyTime(context.talentId, topicId, params.minutesStudied);

    return {
      success: true,
      message: `Activité enregistrée: ${params.minutesStudied} minutes sur "${params.topicName}"`,
      topicName: params.topicName,
      totalTimeMinutes: params.minutesStudied,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Erreur lors de l\'enregistrement',
    };
  }
}

/**
 * Update the mastery level of a learning topic
 */
export async function updateMasteryLevel(
  params: UpdateMasteryLevelParams,
  context: { talentId: string }
): Promise<{
  success: boolean;
  message: string;
  newLevel?: number;
  newLevelLabel?: string;
}> {
  try {
    const { nodeMutations } = await import('../../graph/mutations');
    const topicId = await nodeMutations.findOrCreateLearningTopic(context.talentId, params.topicName);

    await relationshipMutations.updateLearningProgress(context.talentId, topicId, {
      masteryLevel: params.newMasteryLevel,
    });

    return {
      success: true,
      message: `Niveau de maîtrise mis à jour: "${params.topicName}" → ${params.newMasteryLevel}%`,
      newLevel: params.newMasteryLevel,
      newLevelLabel: getMasteryLabel(params.newMasteryLevel),
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Erreur lors de la mise à jour',
    };
  }
}

/**
 * Add a skill to the talent's profile (used by copilot after evaluation)
 */
export async function addSkillToProfile(
  params: AddSkillToProfileParams,
  context: { talentId: string }
): Promise<{
  success: boolean;
  message: string;
  skillName?: string;
}> {
  try {
    const { pool } = await import('../../database');
    const canonicalName = params.skillName.trim();

    // Upsert into talent_skills with origin='inferred'
    const existingLink = await pool.query(
      `SELECT id FROM talent_skills WHERE talent_id = $1 AND canonical_name = $2`,
      [context.talentId, canonicalName]
    );

    if (existingLink.rows.length > 0) {
      await pool.query(
        `UPDATE talent_skills SET proficiency_level = $1, origin = 'inferred'${params.context ? ', context = $3' : ''} WHERE id = $2`,
        params.context
          ? [params.proficiencyLevel, existingLink.rows[0].id, params.context]
          : [params.proficiencyLevel, existingLink.rows[0].id]
      );
    } else {
      await pool.query(
        `INSERT INTO talent_skills (talent_id, canonical_name, type, proficiency_level, origin${params.context ? ', context' : ''})
         VALUES ($1, $2, $3, $4, 'inferred'${params.context ? ', $5' : ''})`,
        params.context
          ? [context.talentId, canonicalName, params.type, params.proficiencyLevel, params.context]
          : [context.talentId, canonicalName, params.type, params.proficiencyLevel]
      );
    }

    return {
      success: true,
      message: `Compétence "${params.skillName}" ajoutée au profil (niveau: ${params.proficiencyLevel}, origine: inférée)`,
      skillName: params.skillName,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Erreur lors de l'ajout de la compétence",
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function getMatchScoreLabel(score: number): string {
  if (score >= 0.8) return 'Excellent';
  if (score >= 0.6) return 'Bon';
  if (score >= 0.4) return 'Moyen';
  return 'Partiel';
}

function getPriorityExplanation(priority: string): string {
  switch (priority) {
    case 'critical':
      return 'Compétence très demandée par de nombreuses opportunités';
    case 'high':
      return 'Compétence importante pour plusieurs opportunités';
    case 'medium':
      return 'Compétence utile pour quelques opportunités';
    default:
      return 'Compétence complémentaire';
  }
}

// ═══════════════════════════════════════════════════════════════
// TOOL DEFINITIONS EXPORT
// ═══════════════════════════════════════════════════════════════

export const graphToolDefinitions = {
  // Reading tools
  query_talent_graph: {
    name: 'query_talent_graph',
    description:
      "Récupère le graphe complet du talent (ego network) incluant ses compétences, expériences, communautés, et optionnellement les inférences de l'agent et son réseau de connexions.",
    parameters: queryTalentGraphSchema,
    execute: queryTalentGraph,
  },
  find_opportunity_matches: {
    name: 'find_opportunity_matches',
    description:
      "Trouve les opportunités correspondant au profil du talent en analysant les correspondances de compétences dans le graphe. Retourne un score de correspondance et les compétences manquantes.",
    parameters: findOpportunityMatchesSchema,
    execute: findOpportunityMatches,
  },
  find_similar_talents: {
    name: 'find_similar_talents',
    description:
      "Trouve des talents ayant des profils de compétences similaires. Utile pour le networking et les recommandations de mentors.",
    parameters: findSimilarTalentsSchema,
    execute: findSimilarTalents,
  },
  explore_skill_path: {
    name: 'explore_skill_path',
    description:
      "Explore les parcours d'apprentissage possibles pour atteindre une compétence cible à partir des compétences actuelles du talent.",
    parameters: exploreSkillPathSchema,
    execute: exploreSkillPath,
  },
  get_learning_progress: {
    name: 'get_learning_progress',
    description:
      "Récupère la progression d'apprentissage du talent incluant les sujets étudiés, niveaux de maîtrise, streaks, et optionnellement les recommandations.",
    parameters: getLearningProgressSchema,
    execute: getLearningProgress,
  },
  get_skill_gaps: {
    name: 'get_skill_gaps',
    description:
      "Identifie les lacunes de compétences du talent par rapport aux opportunités disponibles. Priorise les compétences les plus demandées.",
    parameters: getSkillGapsSchema,
    execute: getSkillGaps,
  },

  // Writing tools
  add_inferred_interest: {
    name: 'add_inferred_interest',
    description:
      "Enregistre un intérêt détecté chez le talent basé sur l'analyse de la conversation. L'agent utilise cet outil pour mémoriser les centres d'intérêt du talent.",
    parameters: addInferredInterestSchema,
    execute: addInferredInterest,
  },
  suggest_skill_to_learn: {
    name: 'suggest_skill_to_learn',
    description:
      "Crée une suggestion de compétence à apprendre pour le talent. La suggestion est enregistrée dans le graphe pour personnaliser les recommandations futures.",
    parameters: suggestSkillToLearnSchema,
    execute: suggestSkillToLearn,
  },
  record_learning_activity: {
    name: 'record_learning_activity',
    description:
      "Enregistre une activité d'apprentissage dans le graphe (temps d'étude, sujet). Met à jour les statistiques de progression du talent.",
    parameters: recordLearningActivitySchema,
    execute: recordLearningActivity,
  },
  update_mastery_level: {
    name: 'update_mastery_level',
    description:
      "Met à jour le niveau de maîtrise d'un sujet d'apprentissage après évaluation (quiz, exercice). Le niveau va de 0 à 100.",
    parameters: updateMasteryLevelSchema,
    execute: updateMasteryLevel,
  },
  add_skill_to_profile: {
    name: 'add_skill_to_profile',
    description:
      "Ajoute une compétence au profil du talent après évaluation (quiz, exercice). Nécessite une évaluation préalable du niveau. La compétence est enregistrée avec origin='inferred'.",
    parameters: addSkillToProfileSchema,
    execute: addSkillToProfile,
  },
};

// Tools for Explore mode
export const graphExplorerTools = {
  query_talent_graph: graphToolDefinitions.query_talent_graph,
  find_opportunity_matches: graphToolDefinitions.find_opportunity_matches,
  find_similar_talents: graphToolDefinitions.find_similar_talents,
  get_skill_gaps: graphToolDefinitions.get_skill_gaps,
  add_inferred_interest: graphToolDefinitions.add_inferred_interest,
  suggest_skill_to_learn: graphToolDefinitions.suggest_skill_to_learn,
};

// Tools for Study mode
export const graphStudyTools = {
  query_talent_graph: graphToolDefinitions.query_talent_graph,
  explore_skill_path: graphToolDefinitions.explore_skill_path,
  get_learning_progress: graphToolDefinitions.get_learning_progress,
  get_skill_gaps: graphToolDefinitions.get_skill_gaps,
  suggest_skill_to_learn: graphToolDefinitions.suggest_skill_to_learn,
  record_learning_activity: graphToolDefinitions.record_learning_activity,
  update_mastery_level: graphToolDefinitions.update_mastery_level,
  add_skill_to_profile: graphToolDefinitions.add_skill_to_profile,
};
