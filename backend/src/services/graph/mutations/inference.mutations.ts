/**
 * Inference Mutations
 *
 * Operations for agent-inferred relationships
 */

import { neo4jClient } from '../neo4j.client';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface InferenceResult {
  success: boolean;
  relationshipId?: string;
  message?: string;
}

// ═══════════════════════════════════════════════════════════════
// INFERENCE MUTATIONS
// ═══════════════════════════════════════════════════════════════

export const inferenceMutations = {
  /**
   * Add an inferred interest for a talent
   * Can be toward a Skill, Organization, Community, or other entity
   */
  async addInferredInterest(
    talentId: string,
    targetId: string,
    targetType: 'Skill' | 'Organization' | 'Community' | 'Opportunity',
    properties: {
      confidence: number; // 0.0 - 1.0
      reason: string;
      evidence?: string[];
    }
  ): Promise<InferenceResult> {
    try {
      // Validate confidence score
      if (properties.confidence < 0 || properties.confidence > 1) {
        return {
          success: false,
          message: 'Confidence must be between 0 and 1',
        };
      }

      const result = await neo4jClient.write(
        `
        MATCH (t:Talent {id: $talentId})
        MATCH (target:${targetType} {id: $targetId})

        // Check if relationship already exists
        OPTIONAL MATCH (t)-[existing:INTERESSE_PAR]->(target)

        // Only create/update if confidence is higher or relationship doesn't exist
        WITH t, target, existing
        WHERE existing IS NULL OR existing.confidence < $confidence

        MERGE (t)-[r:INTERESSE_PAR]->(target)
        SET r.confidence = $confidence,
            r.reason = $reason,
            r.evidence = $evidence,
            r.inferred_at = datetime(),
            r.source = 'agent'

        RETURN elementId(r) as relationshipId
        `,
        {
          talentId,
          targetId,
          confidence: properties.confidence,
          reason: properties.reason,
          evidence: properties.evidence || [],
        }
      );

      if (result.records.length === 0) {
        return {
          success: false,
          message: 'Relationship not created - may already exist with higher confidence',
        };
      }

      return {
        success: true,
        relationshipId: result.records[0].get('relationshipId'),
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
      };
    }
  },

  /**
   * Suggest a skill for a talent to learn
   */
  async suggestSkillToLearn(
    talentId: string,
    skillId: string,
    properties: {
      confidence: number;
      priority: 'low' | 'medium' | 'high' | 'critical';
      reason: string;
      relatedOpportunities?: string[];
      skillGapFor?: string; // Target role or opportunity
    }
  ): Promise<InferenceResult> {
    try {
      if (properties.confidence < 0 || properties.confidence > 1) {
        return {
          success: false,
          message: 'Confidence must be between 0 and 1',
        };
      }

      // Check if talent already has this skill
      const checkResult = await neo4jClient.read(
        `
        MATCH (t:Talent {id: $talentId})-[:POSSEDE_COMPETENCE]->(s:Skill {id: $skillId})
        RETURN s
        `,
        { talentId, skillId }
      );

      if (checkResult.records.length > 0) {
        return {
          success: false,
          message: 'Talent already possesses this skill',
        };
      }

      const result = await neo4jClient.write(
        `
        MATCH (t:Talent {id: $talentId})
        MATCH (s:Skill {id: $skillId})

        MERGE (t)-[r:DEVRAIT_APPRENDRE]->(s)
        SET r.confidence = $confidence,
            r.priority = $priority,
            r.reason = $reason,
            r.related_opportunities = $relatedOpportunities,
            r.skill_gap_for = $skillGapFor,
            r.inferred_at = datetime(),
            r.source = 'agent'

        RETURN elementId(r) as relationshipId
        `,
        {
          talentId,
          skillId,
          confidence: properties.confidence,
          priority: properties.priority,
          reason: properties.reason,
          relatedOpportunities: properties.relatedOpportunities || [],
          skillGapFor: properties.skillGapFor,
        }
      );

      return {
        success: true,
        relationshipId: result.records[0]?.get('relationshipId'),
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
      };
    }
  },

  /**
   * Suggest a skill to learn by skill name (creates skill if needed)
   */
  async suggestSkillToLearnByName(
    talentId: string,
    skillName: string,
    properties: {
      confidence: number;
      priority: 'low' | 'medium' | 'high' | 'critical';
      reason: string;
      relatedOpportunities?: string[];
    }
  ): Promise<InferenceResult> {
    try {
      const result = await neo4jClient.write(
        `
        MATCH (t:Talent {id: $talentId})

        // Find or create the skill
        MERGE (s:Skill {canonical_name: $skillName})
        ON CREATE SET s.id = randomUUID(),
                      s.type = 'technical'

        // Check talent doesn't already have it
        WITH t, s
        WHERE NOT EXISTS((t)-[:POSSEDE_COMPETENCE]->(s))

        MERGE (t)-[r:DEVRAIT_APPRENDRE]->(s)
        SET r.confidence = $confidence,
            r.priority = $priority,
            r.reason = $reason,
            r.related_opportunities = $relatedOpportunities,
            r.inferred_at = datetime(),
            r.source = 'agent'

        RETURN s.id as skillId, elementId(r) as relationshipId
        `,
        {
          talentId,
          skillName: skillName.toLowerCase(),
          confidence: properties.confidence,
          priority: properties.priority,
          reason: properties.reason,
          relatedOpportunities: properties.relatedOpportunities || [],
        }
      );

      if (result.records.length === 0) {
        return {
          success: false,
          message: 'Talent already has this skill or suggestion could not be created',
        };
      }

      return {
        success: true,
        relationshipId: result.records[0].get('relationshipId'),
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
      };
    }
  },

  /**
   * Mark two talents as similar based on skill overlap
   */
  async markSimilarTalents(
    talentId1: string,
    talentId2: string,
    properties: {
      commonSkills: string[];
      similarityScore: number;
    }
  ): Promise<InferenceResult> {
    try {
      const result = await neo4jClient.write(
        `
        MATCH (t1:Talent {id: $talentId1})
        MATCH (t2:Talent {id: $talentId2})
        WHERE t1 <> t2

        MERGE (t1)-[r:SIMILAIRE_A]->(t2)
        SET r.common_skills = $commonSkills,
            r.common_skills_count = size($commonSkills),
            r.similarity_score = $similarityScore,
            r.confidence = $similarityScore,
            r.computed_at = datetime()

        RETURN elementId(r) as relationshipId
        `,
        {
          talentId1,
          talentId2,
          commonSkills: properties.commonSkills,
          similarityScore: properties.similarityScore,
        }
      );

      return {
        success: true,
        relationshipId: result.records[0]?.get('relationshipId'),
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
      };
    }
  },

  /**
   * Compute and store similar talents for a given talent
   */
  async computeSimilarTalents(
    talentId: string,
    options: { minCommonSkills?: number; limit?: number } = {}
  ): Promise<{ success: boolean; count: number }> {
    const { minCommonSkills = 3, limit = 10 } = options;

    try {
      const result = await neo4jClient.write(
        `
        MATCH (t1:Talent {id: $talentId})-[:POSSEDE_COMPETENCE]->(s:Skill)
              <-[:POSSEDE_COMPETENCE]-(t2:Talent)
        WHERE t1 <> t2

        WITH t1, t2, collect(s.canonical_name) as commonSkills, count(s) as commonCount
        WHERE commonCount >= $minCommonSkills

        // Calculate Jaccard similarity
        MATCH (t1)-[:POSSEDE_COMPETENCE]->(s1:Skill)
        WITH t1, t2, commonSkills, commonCount, count(DISTINCT s1) as t1Skills

        MATCH (t2)-[:POSSEDE_COMPETENCE]->(s2:Skill)
        WITH t1, t2, commonSkills, commonCount, t1Skills, count(DISTINCT s2) as t2Skills

        WITH t1, t2, commonSkills, commonCount,
             toFloat(commonCount) / (t1Skills + t2Skills - commonCount) as similarity

        ORDER BY similarity DESC
        LIMIT $limit

        MERGE (t1)-[r:SIMILAIRE_A]->(t2)
        SET r.common_skills = commonSkills,
            r.common_skills_count = commonCount,
            r.similarity_score = similarity,
            r.confidence = similarity,
            r.computed_at = datetime()

        RETURN count(r) as created
        `,
        {
          talentId,
          minCommonSkills: neo4jClient.int(minCommonSkills),
          limit: neo4jClient.int(limit),
        }
      );

      return {
        success: true,
        count: result.records[0]?.get('created')?.toNumber?.() ?? 0,
      };
    } catch (error: any) {
      return {
        success: false,
        count: 0,
      };
    }
  },

  /**
   * Remove an inferred interest
   */
  async removeInferredInterest(talentId: string, targetId: string): Promise<void> {
    await neo4jClient.write(
      `
      MATCH (t:Talent {id: $talentId})-[r:INTERESSE_PAR]->(target {id: $targetId})
      DELETE r
      `,
      { talentId, targetId }
    );
  },

  /**
   * Remove a skill suggestion
   */
  async removeSkillSuggestion(talentId: string, skillId: string): Promise<void> {
    await neo4jClient.write(
      `
      MATCH (t:Talent {id: $talentId})-[r:DEVRAIT_APPRENDRE]->(s:Skill {id: $skillId})
      DELETE r
      `,
      { talentId, skillId }
    );
  },

  /**
   * Convert a skill suggestion to an actual skill when learned
   */
  async convertSuggestionToSkill(
    talentId: string,
    skillId: string,
    proficiencyLevel: string = 'debutant'
  ): Promise<InferenceResult> {
    try {
      const result = await neo4jClient.write(
        `
        MATCH (t:Talent {id: $talentId})-[sug:DEVRAIT_APPRENDRE]->(s:Skill {id: $skillId})

        // Create the skill relationship
        MERGE (t)-[r:POSSEDE_COMPETENCE]->(s)
        SET r.proficiency_level = $proficiencyLevel,
            r.acquired_at = datetime(),
            r.source = 'learning',
            r.verified = false

        // Delete the suggestion
        DELETE sug

        RETURN s.canonical_name as skillName
        `,
        { talentId, skillId, proficiencyLevel }
      );

      if (result.records.length === 0) {
        return {
          success: false,
          message: 'No skill suggestion found to convert',
        };
      }

      return {
        success: true,
        message: `Skill "${result.records[0].get('skillName')}" added to profile`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
      };
    }
  },

  /**
   * Get all inferences for a talent
   */
  async getTalentInferences(talentId: string): Promise<{
    interests: Array<{
      targetId: string;
      targetType: string;
      targetName: string;
      confidence: number;
      reason: string;
      inferredAt: string;
    }>;
    skillSuggestions: Array<{
      skillId: string;
      skillName: string;
      priority: string;
      confidence: number;
      reason: string;
      inferredAt: string;
    }>;
    similarTalents: Array<{
      talentId: string;
      talentName: string;
      commonSkillsCount: number;
      similarityScore: number;
    }>;
  }> {
    const result = await neo4jClient.read(
      `
      MATCH (t:Talent {id: $talentId})

      // Get interests
      OPTIONAL MATCH (t)-[int:INTERESSE_PAR]->(interest)
      WITH t, collect(DISTINCT {
        targetId: interest.id,
        targetType: labels(interest)[0],
        targetName: COALESCE(interest.canonical_name, interest.name, interest.title),
        confidence: int.confidence,
        reason: int.reason,
        inferredAt: int.inferred_at
      }) as interests

      // Get skill suggestions
      OPTIONAL MATCH (t)-[sug:DEVRAIT_APPRENDRE]->(skill:Skill)
      WITH t, interests, collect(DISTINCT {
        skillId: skill.id,
        skillName: skill.canonical_name,
        priority: sug.priority,
        confidence: sug.confidence,
        reason: sug.reason,
        inferredAt: sug.inferred_at
      }) as skillSuggestions

      // Get similar talents
      OPTIONAL MATCH (t)-[sim:SIMILAIRE_A]->(similar:Talent)
      WITH t, interests, skillSuggestions, collect(DISTINCT {
        talentId: similar.id,
        talentName: similar.name,
        commonSkillsCount: sim.common_skills_count,
        similarityScore: sim.similarity_score
      }) as similarTalents

      RETURN interests, skillSuggestions, similarTalents
      `,
      { talentId }
    );

    if (result.records.length === 0) {
      return { interests: [], skillSuggestions: [], similarTalents: [] };
    }

    const record = result.records[0];

    return {
      interests: (record.get('interests') || []).filter((i: any) => i.targetId),
      skillSuggestions: (record.get('skillSuggestions') || []).filter((s: any) => s.skillId),
      similarTalents: (record.get('similarTalents') || []).filter((s: any) => s.talentId),
    };
  },
};
