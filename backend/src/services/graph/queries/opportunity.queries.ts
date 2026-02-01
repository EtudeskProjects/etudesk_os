/**
 * Opportunity Graph Queries
 *
 * Queries for matching talents with opportunities
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
   * Find opportunities matching a talent's skills
   */
  async findMatchingOpportunities(
    talentId: string,
    options: {
      limit?: number;
      minMatchScore?: number;
      includeApplied?: boolean;
      types?: string[];
      locationTypes?: string[];
    } = {}
  ): Promise<OpportunityMatch[]> {
    const { limit = 10, minMatchScore = 0.3, includeApplied = false, types, locationTypes } = options;

    let typeFilter = '';
    if (types && types.length > 0) {
      typeFilter = 'AND op.type IN $types';
    }

    let locationFilter = '';
    if (locationTypes && locationTypes.length > 0) {
      locationFilter = 'AND op.location_type IN $locationTypes';
    }

    const result = await neo4jClient.read(
      `
      MATCH (t:Talent {id: $talentId})-[:POSSEDE_COMPETENCE]->(s:Skill)
            <-[:REQUIERT_COMPETENCE]-(op:Opportunity)
      WHERE op.status = 'published'
        ${includeApplied ? '' : 'AND NOT EXISTS((t)-[:A_POSTULE_A]->(op))'}
        ${typeFilter}
        ${locationFilter}

      WITH op, t, collect(DISTINCT s.canonical_name) as matchedSkills, count(DISTINCT s) as matchCount

      // Get all required skills
      MATCH (op)-[:REQUIERT_COMPETENCE]->(req:Skill)
      WITH op, t, matchedSkills, matchCount, collect(DISTINCT req.canonical_name) as allRequired

      // Calculate missing skills and match score
      WITH op, matchedSkills, matchCount, allRequired, size(allRequired) as totalRequired,
           [skill IN allRequired WHERE NOT skill IN matchedSkills] as missingSkills,
           toFloat(matchCount) / size(allRequired) as matchScore

      WHERE matchScore >= $minMatchScore

      // Get organization
      OPTIONAL MATCH (op)-[:PUBLIE_PAR]->(org:Organization)

      RETURN op as opportunity,
             org as organization,
             matchedSkills,
             missingSkills,
             matchScore,
             totalRequired
      ORDER BY matchScore DESC
      LIMIT $limit
      `,
      {
        talentId,
        minMatchScore,
        limit: neo4jClient.int(limit),
        types: types || [],
        locationTypes: locationTypes || [],
      }
    );

    return result.records.map(record => {
      const opp = record.get('opportunity').properties;
      const org = record.get('organization');

      return {
        opportunity: {
          id: opp.id,
          title: opp.title,
          type: opp.type,
          contractType: opp.contract_type,
          status: opp.status,
          salaryMin: opp.salary_min,
          salaryMax: opp.salary_max,
          locationType: opp.location_type,
          city: opp.city,
          country: opp.country,
          deadline: opp.deadline,
        },
        organization: org
          ? {
              id: org.properties.id,
              name: org.properties.name,
            }
          : undefined,
        matchedSkills: record.get('matchedSkills'),
        missingSkills: record.get('missingSkills'),
        matchScore: record.get('matchScore'),
        totalRequired: this.toNumber(record.get('totalRequired')),
      };
    });
  },

  /**
   * Get skill gaps for a talent based on available opportunities
   */
  async getSkillGaps(
    talentId: string,
    options: { limit?: number } = {}
  ): Promise<SkillGap[]> {
    const { limit = 10 } = options;

    const result = await neo4jClient.read(
      `
      MATCH (t:Talent {id: $talentId})
      MATCH (op:Opportunity)-[req:REQUIERT_COMPETENCE]->(s:Skill)
      WHERE op.status = 'published'
        AND NOT EXISTS((t)-[:POSSEDE_COMPETENCE]->(s))

      // Count how many opportunities need this skill
      WITH s, collect(DISTINCT {id: op.id, title: op.title}) as opportunities, count(DISTINCT op) as demandCount

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
             opportunities[0..5] as topOpportunities,
             priority
      ORDER BY demandCount DESC
      LIMIT $limit
      `,
      { talentId, limit: neo4jClient.int(limit) }
    );

    return result.records.map(record => {
      const skill = record.get('skill').properties;

      return {
        skill: {
          id: skill.id,
          name: skill.canonical_name,
          type: skill.type,
          domain: skill.domain,
        },
        demandCount: this.toNumber(record.get('demandCount')),
        opportunities: record.get('topOpportunities').map((o: any) => ({
          id: o.id,
          title: o.title,
        })),
        priority: record.get('priority') as 'low' | 'medium' | 'high' | 'critical',
      };
    });
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
   * Get opportunity details with skill requirements
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
      OPTIONAL MATCH (op)-[req:REQUIERT_COMPETENCE]->(s:Skill)
      OPTIONAL MATCH (t:Talent)-[:A_POSTULE_A]->(op)

      WITH op, org,
           collect(DISTINCT {name: s.canonical_name, level: req.level_required, mandatory: req.is_mandatory}) as skills,
           count(DISTINCT t) as applicants

      RETURN op as opportunity,
             org as organization,
             skills as requiredSkills,
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
      requiredSkills: (record.get('requiredSkills') || [])
        .filter((s: any) => s.name)
        .map((s: any) => ({
          name: s.name,
          level: s.level || 'intermediaire',
          isMandatory: s.mandatory ?? true,
        })),
      applicantCount: this.toNumber(record.get('applicantCount')),
    };
  },

  /**
   * Recommend opportunities based on inferred interests
   */
  async getRecommendedOpportunities(
    talentId: string,
    options: { limit?: number } = {}
  ): Promise<OpportunityMatch[]> {
    const { limit = 5 } = options;

    const result = await neo4jClient.read(
      `
      MATCH (t:Talent {id: $talentId})

      // Get opportunities from skills the talent should learn
      OPTIONAL MATCH (t)-[learn:DEVRAIT_APPRENDRE]->(learnSkill:Skill)
                     <-[:REQUIERT_COMPETENCE]-(op:Opportunity)
      WHERE op.status = 'published'
        AND NOT EXISTS((t)-[:A_POSTULE_A]->(op))

      WITH t, op, collect(DISTINCT learnSkill.canonical_name) as targetSkills
      WHERE op IS NOT NULL

      // Also consider opportunities from interests
      OPTIONAL MATCH (t)-[:INTERESSE_PAR]->(interest:Skill)
                     <-[:REQUIERT_COMPETENCE]-(op)

      WITH op, targetSkills, collect(DISTINCT interest.canonical_name) as interestSkills

      // Get skills the talent already has
      MATCH (t:Talent {id: $talentId})-[:POSSEDE_COMPETENCE]->(has:Skill)
            <-[:REQUIERT_COMPETENCE]-(op)
      WITH op, targetSkills, interestSkills,
           collect(DISTINCT has.canonical_name) as matchedSkills

      // Get organization
      OPTIONAL MATCH (op)-[:PUBLIE_PAR]->(org:Organization)

      // Get all required skills
      MATCH (op)-[:REQUIERT_COMPETENCE]->(req:Skill)
      WITH op, org, targetSkills, interestSkills, matchedSkills,
           collect(DISTINCT req.canonical_name) as allRequired

      WITH op, org, matchedSkills, allRequired,
           [s IN allRequired WHERE NOT s IN matchedSkills] as missingSkills,
           toFloat(size(matchedSkills)) / size(allRequired) as matchScore,
           size(targetSkills) + size(interestSkills) as relevanceBoost

      RETURN op as opportunity,
             org as organization,
             matchedSkills,
             missingSkills,
             matchScore,
             size(allRequired) as totalRequired
      ORDER BY relevanceBoost DESC, matchScore DESC
      LIMIT $limit
      `,
      { talentId, limit: neo4jClient.int(limit) }
    );

    return result.records.map(record => {
      const opp = record.get('opportunity').properties;
      const org = record.get('organization');

      return {
        opportunity: {
          id: opp.id,
          title: opp.title,
          type: opp.type,
          contractType: opp.contract_type,
          status: opp.status,
          salaryMin: opp.salary_min,
          salaryMax: opp.salary_max,
          locationType: opp.location_type,
          city: opp.city,
          country: opp.country,
          deadline: opp.deadline,
        },
        organization: org
          ? { id: org.properties.id, name: org.properties.name }
          : undefined,
        matchedSkills: record.get('matchedSkills'),
        missingSkills: record.get('missingSkills'),
        matchScore: record.get('matchScore'),
        totalRequired: this.toNumber(record.get('totalRequired')),
      };
    });
  },

  // Helper
  toNumber(value: any): number {
    if (!value) return 0;
    return value.toNumber?.() ?? value;
  },
};
