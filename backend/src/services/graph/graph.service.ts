/**
 * Graph Service - Main service for Talent Graph operations
 */

import { neo4jClient } from './neo4j.client';
import { NodeLabels, RelationshipTypes } from './ontology';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface GraphStats {
  nodes: {
    talents: number;
    skills: number;
    organizations: number;
    opportunities: number;
    communities: number;
    spaces: number;
    learningTopics: number;
    documents: number;
  };
  relationships: {
    total: number;
    byType: Record<string, number>;
  };
}

export interface EgoNetworkResult {
  talent: any;
  skills: Array<{ skill: any; relationship: any }>;
  experiences: Array<{ organization: any; relationship: any }>;
  applications: Array<{ opportunity: any; relationship: any }>;
  memberships: Array<{ community: any; relationship: any }>;
  learningTopics: Array<{ topic: any; relationship: any }>;
  documents: Array<{ document: any; relationship: any }>;
  connections: Array<{ talent: any; relationship: any }>;
  inferences: {
    interests: Array<{ target: any; relationship: any }>;
    skillsToLearn: Array<{ skill: any; relationship: any }>;
  };
}

// ═══════════════════════════════════════════════════════════════
// GRAPH SERVICE
// ═══════════════════════════════════════════════════════════════

export const graphService = {
  /**
   * Initialize the graph service
   */
  async initialize(): Promise<void> {
    await neo4jClient.initialize();
  },

  /**
   * Check if the service is connected
   */
  isConnected(): boolean {
    return neo4jClient.isConnected();
  },

  /**
   * Get graph statistics
   */
  async getStats(): Promise<GraphStats> {
    const nodeCounts = await neo4jClient.read(`
      MATCH (n)
      RETURN labels(n)[0] as label, count(n) as count
    `);

    const relCounts = await neo4jClient.read(`
      MATCH ()-[r]->()
      RETURN type(r) as type, count(r) as count
    `);

    const nodeStats: GraphStats['nodes'] = {
      talents: 0,
      skills: 0,
      organizations: 0,
      opportunities: 0,
      communities: 0,
      spaces: 0,
      learningTopics: 0,
      documents: 0,
    };

    for (const record of nodeCounts.records) {
      const label = record.get('label');
      const count = record.get('count').toNumber();

      switch (label) {
        case NodeLabels.TALENT:
          nodeStats.talents = count;
          break;
        case NodeLabels.SKILL:
          nodeStats.skills = count;
          break;
        case NodeLabels.ORGANIZATION:
          nodeStats.organizations = count;
          break;
        case NodeLabels.OPPORTUNITY:
          nodeStats.opportunities = count;
          break;
        case NodeLabels.COMMUNITY:
          nodeStats.communities = count;
          break;
        case NodeLabels.SPACE:
          nodeStats.spaces = count;
          break;
        case NodeLabels.LEARNING_TOPIC:
          nodeStats.learningTopics = count;
          break;
        case NodeLabels.DOCUMENT:
          nodeStats.documents = count;
          break;
      }
    }

    const relStats: Record<string, number> = {};
    let totalRels = 0;

    for (const record of relCounts.records) {
      const type = record.get('type');
      const count = record.get('count').toNumber();
      relStats[type] = count;
      totalRels += count;
    }

    return {
      nodes: nodeStats,
      relationships: {
        total: totalRels,
        byType: relStats,
      },
    };
  },

  /**
   * Get the complete ego network for a talent
   */
  async getTalentEgoNetwork(talentId: string): Promise<EgoNetworkResult | null> {
    const result = await neo4jClient.read(
      `
      MATCH (t:Talent {id: $talentId})

      // Skills
      OPTIONAL MATCH (t)-[r_skill:POSSEDE_COMPETENCE]->(skill:Skill)

      // Experiences (current and past)
      OPTIONAL MATCH (t)-[r_exp:TRAVAILLE_CHEZ|A_TRAVAILLE_CHEZ|A_ETUDIE_A]->(org:Organization)

      // Applications
      OPTIONAL MATCH (t)-[r_app:A_POSTULE_A]->(opp:Opportunity)

      // Communities
      OPTIONAL MATCH (t)-[r_comm:EST_MEMBRE_DE]->(comm:Community)

      // Learning topics
      OPTIONAL MATCH (t)-[r_topic:ETUDIE_SUJET]->(topic:LearningTopic)

      // Documents
      OPTIONAL MATCH (t)-[r_doc:POSSEDE_DOCUMENT]->(doc:Document)

      // Connections
      OPTIONAL MATCH (t)-[r_conn:CONNECTE_AVEC]-(other:Talent)

      // Inferred interests
      OPTIONAL MATCH (t)-[r_int:INTERESSE_PAR]->(interest)

      // Skills to learn
      OPTIONAL MATCH (t)-[r_learn:DEVRAIT_APPRENDRE]->(toLearn:Skill)

      RETURN t as talent,
             collect(DISTINCT {skill: skill, rel: properties(r_skill)}) as skills,
             collect(DISTINCT {org: org, rel: properties(r_exp), type: type(r_exp)}) as experiences,
             collect(DISTINCT {opp: opp, rel: properties(r_app)}) as applications,
             collect(DISTINCT {comm: comm, rel: properties(r_comm)}) as memberships,
             collect(DISTINCT {topic: topic, rel: properties(r_topic)}) as learningTopics,
             collect(DISTINCT {doc: doc, rel: properties(r_doc)}) as documents,
             collect(DISTINCT {talent: other, rel: properties(r_conn)}) as connections,
             collect(DISTINCT {target: interest, rel: properties(r_int)}) as interests,
             collect(DISTINCT {skill: toLearn, rel: properties(r_learn)}) as skillsToLearn
      `,
      { talentId }
    );

    if (result.records.length === 0) {
      return null;
    }

    const record = result.records[0];
    const talent = record.get('talent');

    if (!talent) {
      return null;
    }

    // Helper to filter out null entries
    const filterNulls = <T extends { [key: string]: any }>(arr: T[], key: string): T[] =>
      arr.filter(item => item[key] !== null);

    return {
      talent: talent.properties,
      skills: filterNulls(record.get('skills'), 'skill').map(s => ({
        skill: s.skill?.properties,
        relationship: s.rel,
      })),
      experiences: filterNulls(record.get('experiences'), 'org').map(e => ({
        organization: e.org?.properties,
        relationship: { ...e.rel, type: e.type },
      })),
      applications: filterNulls(record.get('applications'), 'opp').map(a => ({
        opportunity: a.opp?.properties,
        relationship: a.rel,
      })),
      memberships: filterNulls(record.get('memberships'), 'comm').map(m => ({
        community: m.comm?.properties,
        relationship: m.rel,
      })),
      learningTopics: filterNulls(record.get('learningTopics'), 'topic').map(l => ({
        topic: l.topic?.properties,
        relationship: l.rel,
      })),
      documents: filterNulls(record.get('documents'), 'doc').map(d => ({
        document: d.doc?.properties,
        relationship: d.rel,
      })),
      connections: filterNulls(record.get('connections'), 'talent').map(c => ({
        talent: c.talent?.properties,
        relationship: c.rel,
      })),
      inferences: {
        interests: filterNulls(record.get('interests'), 'target').map(i => ({
          target: i.target?.properties,
          relationship: i.rel,
        })),
        skillsToLearn: filterNulls(record.get('skillsToLearn'), 'skill').map(s => ({
          skill: s.skill?.properties,
          relationship: s.rel,
        })),
      },
    };
  },

  /**
   * Find opportunities that match a talent's skills
   */
  async findOpportunityMatches(
    talentId: string,
    options: {
      limit?: number;
      minMatchScore?: number;
      includeApplied?: boolean;
    } = {}
  ): Promise<
    Array<{
      opportunity: any;
      matchedSkills: string[];
      matchScore: number;
      totalRequired: number;
      missingSkills: string[];
    }>
  > {
    const { limit = 10, minMatchScore = 0.3, includeApplied = false } = options;

    const result = await neo4jClient.read(
      `
      MATCH (t:Talent {id: $talentId})-[:POSSEDE_COMPETENCE]->(s:Skill)
            <-[:REQUIERT_COMPETENCE]-(op:Opportunity)
      WHERE op.status = 'published'
        ${includeApplied ? '' : 'AND NOT EXISTS((t)-[:A_POSTULE_A]->(op))'}

      WITH op, t, collect(DISTINCT s.canonical_name) as matchedSkills, count(DISTINCT s) as matchCount

      MATCH (op)-[:REQUIERT_COMPETENCE]->(req:Skill)
      WITH op, t, matchedSkills, matchCount, collect(DISTINCT req.canonical_name) as allRequired

      WITH op, matchedSkills, matchCount, allRequired, size(allRequired) as totalRequired,
           [skill IN allRequired WHERE NOT skill IN matchedSkills] as missingSkills,
           toFloat(matchCount) / size(allRequired) as matchScore

      WHERE matchScore >= $minMatchScore

      RETURN op as opportunity,
             matchedSkills,
             matchScore,
             totalRequired,
             missingSkills
      ORDER BY matchScore DESC
      LIMIT $limit
      `,
      { talentId, minMatchScore, limit: neo4jClient.int(limit) }
    );

    return result.records.map(record => ({
      opportunity: record.get('opportunity').properties,
      matchedSkills: record.get('matchedSkills'),
      matchScore: record.get('matchScore'),
      totalRequired: record.get('totalRequired').toNumber?.() ?? record.get('totalRequired'),
      missingSkills: record.get('missingSkills'),
    }));
  },

  /**
   * Find talents with similar skill profiles
   */
  async findSimilarTalents(
    talentId: string,
    options: {
      limit?: number;
      minCommonSkills?: number;
    } = {}
  ): Promise<
    Array<{
      talent: any;
      commonSkills: string[];
      commonSkillsCount: number;
      similarityScore: number;
    }>
  > {
    const { limit = 10, minCommonSkills = 3 } = options;

    const result = await neo4jClient.read(
      `
      MATCH (t1:Talent {id: $talentId})-[:POSSEDE_COMPETENCE]->(s:Skill)
            <-[:POSSEDE_COMPETENCE]-(t2:Talent)
      WHERE t1 <> t2

      WITH t1, t2, collect(s.canonical_name) as commonSkills, count(s) as commonCount
      WHERE commonCount >= $minCommonSkills

      // Get total skills for both talents
      MATCH (t1)-[:POSSEDE_COMPETENCE]->(s1:Skill)
      WITH t1, t2, commonSkills, commonCount, count(DISTINCT s1) as t1Skills

      MATCH (t2)-[:POSSEDE_COMPETENCE]->(s2:Skill)
      WITH t2, commonSkills, commonCount, t1Skills, count(DISTINCT s2) as t2Skills

      // Jaccard similarity: intersection / union
      WITH t2, commonSkills, commonCount,
           toFloat(commonCount) / (t1Skills + t2Skills - commonCount) as similarity

      RETURN t2 as talent,
             commonSkills,
             commonCount as commonSkillsCount,
             similarity as similarityScore
      ORDER BY similarity DESC
      LIMIT $limit
      `,
      {
        talentId,
        minCommonSkills: neo4jClient.int(minCommonSkills),
        limit: neo4jClient.int(limit),
      }
    );

    return result.records.map(record => ({
      talent: record.get('talent').properties,
      commonSkills: record.get('commonSkills'),
      commonSkillsCount: record.get('commonSkillsCount').toNumber?.() ?? record.get('commonSkillsCount'),
      similarityScore: record.get('similarityScore'),
    }));
  },

  /**
   * Get skill gaps for a talent (skills they're missing for opportunities they're interested in)
   */
  async getSkillGaps(
    talentId: string,
    options: { limit?: number } = {}
  ): Promise<
    Array<{
      skill: any;
      demandCount: number;
      opportunities: string[];
      priority: 'low' | 'medium' | 'high' | 'critical';
    }>
  > {
    const { limit = 10 } = options;

    const result = await neo4jClient.read(
      `
      // Get skills the talent doesn't have but are required by opportunities
      MATCH (t:Talent {id: $talentId})
      MATCH (op:Opportunity)-[:REQUIERT_COMPETENCE]->(s:Skill)
      WHERE op.status = 'published'
        AND NOT EXISTS((t)-[:POSSEDE_COMPETENCE]->(s))

      // Count how many opportunities need this skill
      WITH s, collect(DISTINCT op.title) as opportunities, count(DISTINCT op) as demandCount

      // Prioritize by demand
      WITH s, opportunities, demandCount,
           CASE
             WHEN demandCount >= 5 THEN 'critical'
             WHEN demandCount >= 3 THEN 'high'
             WHEN demandCount >= 2 THEN 'medium'
             ELSE 'low'
           END as priority

      RETURN s as skill,
             demandCount,
             opportunities[0..5] as opportunities,
             priority
      ORDER BY demandCount DESC
      LIMIT $limit
      `,
      { talentId, limit: neo4jClient.int(limit) }
    );

    return result.records.map(record => ({
      skill: record.get('skill').properties,
      demandCount: record.get('demandCount').toNumber?.() ?? record.get('demandCount'),
      opportunities: record.get('opportunities'),
      priority: record.get('priority') as 'low' | 'medium' | 'high' | 'critical',
    }));
  },

  /**
   * Find learning path from current skills to target skill
   */
  async findLearningPath(
    talentId: string,
    targetSkill: string,
    options: { maxSteps?: number } = {}
  ): Promise<
    Array<{
      path: string[];
      steps: number;
    }>
  > {
    const { maxSteps = 5 } = options;

    const result = await neo4jClient.read(
      `
      MATCH (t:Talent {id: $talentId})-[:POSSEDE_COMPETENCE]->(current:Skill)
      MATCH (target:Skill)
      WHERE target.canonical_name = $targetSkill OR target.id = $targetSkill

      // Find shortest paths through prerequisites
      MATCH path = shortestPath((current)-[:PREREQUIS_POUR*1..${maxSteps}]->(target))

      RETURN [n IN nodes(path) | n.canonical_name] as learningPath,
             length(path) as steps
      ORDER BY steps ASC
      LIMIT 3
      `,
      { talentId, targetSkill }
    );

    return result.records.map(record => ({
      path: record.get('learningPath'),
      steps: record.get('steps').toNumber?.() ?? record.get('steps'),
    }));
  },

  /**
   * Get learning progress from the graph
   */
  async getLearningProgress(talentId: string): Promise<{
    topics: Array<{
      topic: any;
      masteryLevel: number;
      lastStudied: string | null;
      streakDays: number;
    }>;
    averageMastery: number;
    totalTopics: number;
    recentActivity: Array<{ topic: string; date: string }>;
  }> {
    const result = await neo4jClient.read(
      `
      MATCH (t:Talent {id: $talentId})-[r:ETUDIE_SUJET]->(topic:LearningTopic)

      WITH topic, r
      ORDER BY r.last_studied_at DESC

      WITH collect({
        topic: topic,
        mastery: r.mastery_level,
        lastStudied: r.last_studied_at,
        streak: r.streak_days
      }) as topics

      RETURN topics,
             reduce(sum = 0.0, t IN topics | sum + t.mastery) / size(topics) as avgMastery,
             size(topics) as totalTopics
      `,
      { talentId }
    );

    if (result.records.length === 0) {
      return {
        topics: [],
        averageMastery: 0,
        totalTopics: 0,
        recentActivity: [],
      };
    }

    const record = result.records[0];
    const topics = record.get('topics') || [];

    return {
      topics: topics.map((t: any) => ({
        topic: t.topic?.properties,
        masteryLevel: t.mastery,
        lastStudied: t.lastStudied,
        streakDays: t.streak,
      })),
      averageMastery: record.get('avgMastery') ?? 0,
      totalTopics: record.get('totalTopics')?.toNumber?.() ?? record.get('totalTopics') ?? 0,
      recentActivity: topics.slice(0, 5).map((t: any) => ({
        topic: t.topic?.properties?.name,
        date: t.lastStudied,
      })),
    };
  },

  /**
   * Close the graph service connection
   */
  async close(): Promise<void> {
    await neo4jClient.close();
  },
};
