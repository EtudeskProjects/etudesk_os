/**
 * Opportunity Graph Queries
 *
 * Queries for matching talents with opportunities.
 * Note: REQUIERT_COMPETENCE was removed (opportunity_skills table dropped in migration 053).
 * Matching functions now return empty results until a new skill-requirement model is implemented.
 */

import { neo4jClient } from '../neo4j.client';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface OpportunityMatch {
  opportunity: {
    id: string;
    title: string;
    type: string;
    contractType?: string;
    status: string;
    salaryMin?: number;
    salaryMax?: number;
    locationType?: string;
    city?: string;
    country?: string;
    deadline?: string;
  };
  organization?: {
    id: string;
    name: string;
  };
  matchedSkills: string[];
  missingSkills: string[];
  matchScore: number;
  totalRequired: number;
}

export interface SkillGap {
  skill: {
    id: string;
    name: string;
    type: string;
    domain?: string;
  };
  demandCount: number;
  opportunities: Array<{ id: string; title: string }>;
  priority: 'low' | 'medium' | 'high' | 'critical';
  suggestedResources?: string[];
}

// ═══════════════════════════════════════════════════════════════
// OPPORTUNITY QUERIES
// ═══════════════════════════════════════════════════════════════

export const opportunityQueries = {
  /**
   * Find opportunities matching a talent's skills.
   * Returns empty — no skill requirements in graph (opportunity_skills dropped).
   */
  async findMatchingOpportunities(
    _talentId: string,
    _options: {
      limit?: number;
      minMatchScore?: number;
      includeApplied?: boolean;
      types?: string[];
      locationTypes?: string[];
    } = {}
  ): Promise<OpportunityMatch[]> {
    return [];
  },

  /**
   * Get skill gaps for a talent based on available opportunities.
   * Returns empty — no skill requirements in graph (opportunity_skills dropped).
   */
  async getSkillGaps(
    _talentId: string,
    _options: { limit?: number } = {}
  ): Promise<SkillGap[]> {
    return [];
  },

  /**
   * Find similar talents based on skills
   */
  async findSimilarTalents(
    talentId: string,
    options: { limit?: number; minCommonSkills?: number } = {}
  ): Promise<
    Array<{
      talent: { id: string; name: string; headline?: string };
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

      // Get total skills for both talents to compute Jaccard similarity
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

    return result.records.map(record => {
      const talent = record.get('talent').properties;

      return {
        talent: {
          id: talent.id,
          name: talent.name,
          headline: talent.headline,
        },
        commonSkills: record.get('commonSkills'),
        commonSkillsCount: this.toNumber(record.get('commonSkillsCount')),
        similarityScore: record.get('similarityScore'),
      };
    });
  },

  /**
   * Get opportunity details with applicant count
   */
  async getOpportunityDetails(opportunityId: string): Promise<{
    opportunity: any;
    organization?: any;
    requiredSkills: Array<{ name: string; level: string; isMandatory: boolean }>;
    applicantCount: number;
  } | null> {
    const result = await neo4jClient.read(
      `
      MATCH (op:Opportunity {id: $opportunityId})

      OPTIONAL MATCH (op)-[:PUBLIE_PAR]->(org:Organization)
      OPTIONAL MATCH (t:Talent)-[:A_POSTULE_A]->(op)

      WITH op, org, count(DISTINCT t) as applicants

      RETURN op as opportunity,
             org as organization,
             applicants as applicantCount
      `,
      { opportunityId }
    );

    if (result.records.length === 0) {
      return null;
    }

    const record = result.records[0];
    const opp = record.get('opportunity');

    if (!opp) {
      return null;
    }

    const org = record.get('organization');

    return {
      opportunity: opp.properties,
      organization: org?.properties,
      requiredSkills: [], // No skill requirements in graph (opportunity_skills dropped)
      applicantCount: this.toNumber(record.get('applicantCount')),
    };
  },

  /**
   * Recommend opportunities based on inferred interests.
   * Returns empty — no skill requirements in graph (opportunity_skills dropped).
   */
  async getRecommendedOpportunities(
    _talentId: string,
    _options: { limit?: number } = {}
  ): Promise<OpportunityMatch[]> {
    return [];
  },

  // Helper
  toNumber(value: any): number {
    if (!value) return 0;
    return value.toNumber?.() ?? value;
  },
};
