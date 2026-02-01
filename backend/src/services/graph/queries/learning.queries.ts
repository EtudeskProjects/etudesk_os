/**
 * Learning Graph Queries
 *
 * Queries for learning paths, progress tracking, and skill development
 */

import { neo4jClient } from '../neo4j.client';
import { getMasteryLabel } from '../ontology';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface LearningProgress {
  topics: Array<{
    id: string;
    name: string;
    masteryLevel: number;
    masteryLabel: string;
    lastStudied?: string;
    streakDays: number;
    totalTimeMinutes: number;
    flashcardsCount?: number;
    quizzesCompleted?: number;
  }>;
  averageMastery: number;
  totalTopics: number;
  totalStudyTime: number;
  currentStreak: number;
  longestStreak: number;
}

export interface LearningPath {
  targetSkill: string;
  currentSkills: string[];
  path: string[];
  steps: number;
  estimatedTime?: string;
  prerequisites: Array<{
    skill: string;
    isMet: boolean;
  }>;
}

export interface SkillRecommendation {
  skill: {
    id: string;
    name: string;
    type: string;
    domain?: string;
  };
  priority: 'low' | 'medium' | 'high' | 'critical';
  reason: string;
  relatedOpportunities: number;
  prerequisitesMet: boolean;
  suggestedResources?: string[];
}

// ═══════════════════════════════════════════════════════════════
// LEARNING QUERIES
// ═══════════════════════════════════════════════════════════════

export const learningQueries = {
  /**
   * Get learning progress for a talent
   */
  async getLearningProgress(talentId: string): Promise<LearningProgress> {
    const result = await neo4jClient.read(
      `
      MATCH (t:Talent {id: $talentId})-[r:ETUDIE_SUJET]->(topic:LearningTopic)

      WITH topic, r
      ORDER BY r.last_studied_at DESC

      WITH collect({
        id: topic.id,
        name: topic.name,
        mastery: r.mastery_level,
        lastStudied: r.last_studied_at,
        streak: COALESCE(r.streak_days, 0),
        totalTime: COALESCE(r.total_time_minutes, 0),
        flashcards: r.flashcards_count,
        quizzes: r.quizzes_completed
      }) as topics

      WITH topics,
           CASE WHEN size(topics) > 0
             THEN reduce(sum = 0.0, t IN topics | sum + t.mastery) / size(topics)
             ELSE 0
           END as avgMastery,
           reduce(total = 0, t IN topics | total + t.totalTime) as totalTime,
           CASE WHEN size(topics) > 0
             THEN topics[0].streak
             ELSE 0
           END as currentStreak

      RETURN topics,
             avgMastery,
             size(topics) as totalTopics,
             totalTime,
             currentStreak
      `,
      { talentId }
    );

    if (result.records.length === 0) {
      return {
        topics: [],
        averageMastery: 0,
        totalTopics: 0,
        totalStudyTime: 0,
        currentStreak: 0,
        longestStreak: 0,
      };
    }

    const record = result.records[0];
    const topics = record.get('topics') || [];

    return {
      topics: topics.map((t: any) => ({
        id: t.id,
        name: t.name,
        masteryLevel: t.mastery || 0,
        masteryLabel: getMasteryLabel(t.mastery || 0),
        lastStudied: t.lastStudied,
        streakDays: t.streak || 0,
        totalTimeMinutes: t.totalTime || 0,
        flashcardsCount: t.flashcards,
        quizzesCompleted: t.quizzes,
      })),
      averageMastery: record.get('avgMastery') ?? 0,
      totalTopics: this.toNumber(record.get('totalTopics')),
      totalStudyTime: this.toNumber(record.get('totalTime')),
      currentStreak: this.toNumber(record.get('currentStreak')),
      longestStreak: Math.max(...topics.map((t: any) => t.streak || 0), 0),
    };
  },

  /**
   * Find learning path from current skills to target skill
   */
  async findLearningPath(
    talentId: string,
    targetSkillName: string,
    options: { maxSteps?: number } = {}
  ): Promise<LearningPath[]> {
    const { maxSteps = 5 } = options;

    const result = await neo4jClient.read(
      `
      MATCH (t:Talent {id: $talentId})-[:POSSEDE_COMPETENCE]->(current:Skill)
      MATCH (target:Skill)
      WHERE target.canonical_name =~ ('(?i).*' + $targetSkillName + '.*')
         OR target.id = $targetSkillName

      // Check if already has the skill
      WITH t, current, target,
           EXISTS((t)-[:POSSEDE_COMPETENCE]->(target)) as alreadyHasSkill

      // Find shortest paths through prerequisites
      CALL {
        WITH current, target
        MATCH path = shortestPath((current)-[:PREREQUIS_POUR*1..${maxSteps}]->(target))
        RETURN path
        LIMIT 3
      }

      WITH t, target, path, alreadyHasSkill,
           [n IN nodes(path) | n.canonical_name] as learningPath,
           length(path) as steps

      // Check which prerequisites are met
      UNWIND nodes(path) as pathNode
      WITH t, target, learningPath, steps, pathNode, alreadyHasSkill,
           EXISTS((t)-[:POSSEDE_COMPETENCE]->(pathNode)) as isMet

      WITH target, learningPath, steps, alreadyHasSkill,
           collect({skill: pathNode.canonical_name, isMet: isMet}) as prerequisites

      RETURN target.canonical_name as targetSkill,
             learningPath,
             steps,
             prerequisites,
             alreadyHasSkill
      ORDER BY steps ASC
      LIMIT 3
      `,
      { talentId, targetSkillName }
    );

    return result.records.map(record => ({
      targetSkill: record.get('targetSkill'),
      currentSkills: [], // Would need additional query
      path: record.get('learningPath') || [],
      steps: this.toNumber(record.get('steps')),
      prerequisites: (record.get('prerequisites') || []).map((p: any) => ({
        skill: p.skill,
        isMet: p.isMet,
      })),
    }));
  },

  /**
   * Get recommended skills to learn based on career goals
   */
  async getSkillRecommendations(
    talentId: string,
    options: { limit?: number } = {}
  ): Promise<SkillRecommendation[]> {
    const { limit = 10 } = options;

    const result = await neo4jClient.read(
      `
      MATCH (t:Talent {id: $talentId})

      // Find skills the talent doesn't have but are in high demand
      MATCH (op:Opportunity)-[req:REQUIERT_COMPETENCE]->(s:Skill)
      WHERE op.status = 'published'
        AND NOT EXISTS((t)-[:POSSEDE_COMPETENCE]->(s))

      WITH t, s, count(DISTINCT op) as demandCount

      // Check if prerequisites are met
      OPTIONAL MATCH (prereq:Skill)-[:PREREQUIS_POUR]->(s)
      WITH t, s, demandCount,
           collect(prereq) as allPrereqs,
           size([prereq IN collect(prereq) WHERE EXISTS((t)-[:POSSEDE_COMPETENCE]->(prereq))]) as metPrereqs

      WITH s, demandCount,
           size(allPrereqs) = 0 OR metPrereqs = size(allPrereqs) as prerequisitesMet,
           CASE
             WHEN demandCount >= 5 THEN 'critical'
             WHEN demandCount >= 3 THEN 'high'
             WHEN demandCount >= 2 THEN 'medium'
             ELSE 'low'
           END as priority

      // Check if agent already suggested this skill
      OPTIONAL MATCH (t:Talent {id: $talentId})-[sug:DEVRAIT_APPRENDRE]->(s)

      RETURN s as skill,
             priority,
             demandCount,
             prerequisitesMet,
             sug.reason as agentReason
      ORDER BY
        CASE priority
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          ELSE 4
        END,
        prerequisitesMet DESC,
        demandCount DESC
      LIMIT $limit
      `,
      { talentId, limit: neo4jClient.int(limit) }
    );

    return result.records.map(record => {
      const skill = record.get('skill').properties;
      const agentReason = record.get('agentReason');
      const demandCount = this.toNumber(record.get('demandCount'));

      return {
        skill: {
          id: skill.id,
          name: skill.canonical_name,
          type: skill.type,
          domain: skill.domain,
        },
        priority: record.get('priority') as 'low' | 'medium' | 'high' | 'critical',
        reason:
          agentReason ||
          `Cette compétence est requise par ${demandCount} opportunité${demandCount > 1 ? 's' : ''} actuellement publiée${demandCount > 1 ? 's' : ''}.`,
        relatedOpportunities: demandCount,
        prerequisitesMet: record.get('prerequisitesMet'),
      };
    });
  },

  /**
   * Get topics needing review (based on spaced repetition)
   */
  async getTopicsForReview(talentId: string): Promise<
    Array<{
      id: string;
      name: string;
      masteryLevel: number;
      daysSinceReview: number;
      urgency: 'low' | 'medium' | 'high';
    }>
  > {
    const result = await neo4jClient.read(
      `
      MATCH (t:Talent {id: $talentId})-[r:ETUDIE_SUJET]->(topic:LearningTopic)
      WHERE r.last_studied_at IS NOT NULL

      WITH topic, r,
           duration.between(date(r.last_studied_at), date()).days as daysSinceReview

      // Calculate urgency based on mastery and time since review
      WITH topic, r, daysSinceReview,
           CASE
             WHEN r.mastery_level < 50 AND daysSinceReview > 3 THEN 'high'
             WHEN r.mastery_level < 70 AND daysSinceReview > 7 THEN 'high'
             WHEN daysSinceReview > 14 THEN 'medium'
             ELSE 'low'
           END as urgency

      WHERE urgency <> 'low'

      RETURN topic.id as id,
             topic.name as name,
             r.mastery_level as masteryLevel,
             daysSinceReview,
             urgency
      ORDER BY
        CASE urgency WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
        r.mastery_level ASC
      LIMIT 10
      `,
      { talentId }
    );

    return result.records.map(record => ({
      id: record.get('id'),
      name: record.get('name'),
      masteryLevel: record.get('masteryLevel') || 0,
      daysSinceReview: this.toNumber(record.get('daysSinceReview')),
      urgency: record.get('urgency') as 'low' | 'medium' | 'high',
    }));
  },

  /**
   * Get related skills for a topic (for expanding learning)
   */
  async getRelatedSkills(topicName: string): Promise<
    Array<{
      skill: { id: string; name: string; type: string };
      relationship: 'prerequisite' | 'complementary' | 'advanced';
    }>
  > {
    const result = await neo4jClient.read(
      `
      MATCH (s:Skill)
      WHERE s.canonical_name =~ ('(?i).*' + $topicName + '.*')

      // Find prerequisites
      OPTIONAL MATCH (prereq:Skill)-[:PREREQUIS_POUR]->(s)
      WITH s, collect({skill: prereq, rel: 'prerequisite'}) as prereqs

      // Find complementary skills
      OPTIONAL MATCH (s)-[:COMPLEMENTAIRE_A]-(comp:Skill)
      WITH s, prereqs, collect({skill: comp, rel: 'complementary'}) as comps

      // Find advanced skills (where this is a prerequisite)
      OPTIONAL MATCH (s)-[:PREREQUIS_POUR]->(adv:Skill)
      WITH prereqs + comps + collect({skill: adv, rel: 'advanced'}) as allRelated

      UNWIND allRelated as related
      WHERE related.skill IS NOT NULL

      RETURN DISTINCT related.skill as skill, related.rel as relationship
      LIMIT 15
      `,
      { topicName }
    );

    return result.records.map(record => {
      const skill = record.get('skill').properties;
      return {
        skill: {
          id: skill.id,
          name: skill.canonical_name,
          type: skill.type,
        },
        relationship: record.get('relationship') as 'prerequisite' | 'complementary' | 'advanced',
      };
    });
  },

  /**
   * Get learning statistics for a time period
   */
  async getLearningStats(
    talentId: string,
    options: { days?: number } = {}
  ): Promise<{
    totalSessions: number;
    totalTimeMinutes: number;
    flashcardsReviewed: number;
    quizzesCompleted: number;
    averageQuizScore: number;
    topicsStudied: number;
    masteryGained: number;
  }> {
    const { days = 30 } = options;

    const result = await neo4jClient.read(
      `
      MATCH (t:Talent {id: $talentId})-[r:ETUDIE_SUJET]->(topic:LearningTopic)
      WHERE r.last_studied_at >= datetime() - duration({days: $days})

      WITH count(DISTINCT topic) as topicsStudied,
           sum(r.total_time_minutes) as totalTime,
           sum(COALESCE(r.flashcards_count, 0)) as flashcards,
           sum(COALESCE(r.quizzes_completed, 0)) as quizzes,
           avg(r.mastery_level) as avgMastery

      RETURN topicsStudied,
             totalTime,
             flashcards,
             quizzes,
             avgMastery
      `,
      { talentId, days: neo4jClient.int(days) }
    );

    if (result.records.length === 0) {
      return {
        totalSessions: 0,
        totalTimeMinutes: 0,
        flashcardsReviewed: 0,
        quizzesCompleted: 0,
        averageQuizScore: 0,
        topicsStudied: 0,
        masteryGained: 0,
      };
    }

    const record = result.records[0];

    return {
      totalSessions: 0, // Would need session tracking
      totalTimeMinutes: this.toNumber(record.get('totalTime')),
      flashcardsReviewed: this.toNumber(record.get('flashcards')),
      quizzesCompleted: this.toNumber(record.get('quizzes')),
      averageQuizScore: 0, // Would need quiz score tracking
      topicsStudied: this.toNumber(record.get('topicsStudied')),
      masteryGained: record.get('avgMastery') ?? 0,
    };
  },

  // Helper
  toNumber(value: any): number {
    if (!value) return 0;
    return value.toNumber?.() ?? value;
  },
};
