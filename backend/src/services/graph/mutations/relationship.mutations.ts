/**
 * Relationship Mutations
 *
 * CRUD operations for graph relationships
 */

import { neo4jClient } from '../neo4j.client';
import { RelationshipTypes, type RelationshipType } from '../ontology';

// ═══════════════════════════════════════════════════════════════
// TALENT-SKILL RELATIONSHIPS
// ═══════════════════════════════════════════════════════════════

export const relationshipMutations = {
  /**
   * Add or update a skill for a talent
   */
  async addTalentSkill(
    talentId: string,
    skillId: string,
    properties: {
      proficiencyLevel: string;
      source?: string;
    }
  ): Promise<void> {
    await neo4jClient.write(
      `
      MATCH (t:Talent {id: $talentId})
      MATCH (s:Skill {id: $skillId})
      MERGE (t)-[r:POSSEDE_COMPETENCE]->(s)
      SET r.proficiency_level = $proficiencyLevel,
          r.source = $source,
          r.updated_at = datetime()
      `,
      {
        talentId,
        skillId,
        proficiencyLevel: properties.proficiencyLevel,
        source: properties.source ?? 'profile',
      }
    );
  },

  /**
   * Add a skill by name (creates skill if doesn't exist)
   */
  async addTalentSkillByName(
    talentId: string,
    skillName: string,
    properties: {
      proficiencyLevel: string;
    }
  ): Promise<string> {
    const result = await neo4jClient.write(
      `
      MATCH (t:Talent {id: $talentId})
      MERGE (s:Skill {canonical_name: $skillName})
      ON CREATE SET s.id = randomUUID(),
                    s.type = 'technical'
      MERGE (t)-[r:POSSEDE_COMPETENCE]->(s)
      SET r.proficiency_level = $proficiencyLevel
      RETURN s.id as skillId
      `,
      {
        talentId,
        skillName: skillName.toLowerCase(),
        proficiencyLevel: properties.proficiencyLevel,
      }
    );

    return result.records[0].get('skillId');
  },

  /**
   * Remove a skill from a talent
   */
  async removeTalentSkill(talentId: string, skillId: string): Promise<void> {
    await neo4jClient.write(
      `
      MATCH (t:Talent {id: $talentId})-[r:POSSEDE_COMPETENCE]->(s:Skill {id: $skillId})
      DELETE r
      `,
      { talentId, skillId }
    );
  },

  // ═══════════════════════════════════════════════════════════════
  // WORK EXPERIENCE RELATIONSHIPS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Add current work experience
   */
  async addCurrentWork(
    talentId: string,
    organizationId: string,
    properties: {
      jobTitle: string;
      startedAt: string;
      department?: string;
    }
  ): Promise<void> {
    await neo4jClient.write(
      `
      MATCH (t:Talent {id: $talentId})
      MATCH (o:Organization {id: $organizationId})
      MERGE (t)-[r:TRAVAILLE_CHEZ]->(o)
      SET r.job_title = $jobTitle,
          r.started_at = $startedAt,
          r.department = $department,
          r.is_current = true
      `,
      {
        talentId,
        organizationId,
        jobTitle: properties.jobTitle,
        startedAt: properties.startedAt,
        department: properties.department,
      }
    );
  },

  /**
   * Add past work experience
   */
  async addPastWork(
    talentId: string,
    organizationId: string,
    properties: {
      jobTitle: string;
      startedAt: string;
      endedAt: string;
      department?: string;
      achievements?: string[];
    }
  ): Promise<void> {
    await neo4jClient.write(
      `
      MATCH (t:Talent {id: $talentId})
      MATCH (o:Organization {id: $organizationId})
      MERGE (t)-[r:A_TRAVAILLE_CHEZ]->(o)
      SET r.job_title = $jobTitle,
          r.started_at = $startedAt,
          r.ended_at = $endedAt,
          r.department = $department,
          r.achievements = $achievements
      `,
      {
        talentId,
        organizationId,
        jobTitle: properties.jobTitle,
        startedAt: properties.startedAt,
        endedAt: properties.endedAt,
        department: properties.department,
        achievements: properties.achievements,
      }
    );
  },

  /**
   * End current work (convert to past work)
   */
  async endCurrentWork(
    talentId: string,
    organizationId: string,
    endedAt: string
  ): Promise<void> {
    await neo4jClient.write(
      `
      MATCH (t:Talent {id: $talentId})-[r:TRAVAILLE_CHEZ]->(o:Organization {id: $organizationId})
      CREATE (t)-[past:A_TRAVAILLE_CHEZ]->(o)
      SET past = r,
          past.ended_at = $endedAt
      DELETE r
      `,
      { talentId, organizationId, endedAt }
    );
  },

  // ═══════════════════════════════════════════════════════════════
  // EDUCATION RELATIONSHIPS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Add education record
   */
  async addEducation(
    talentId: string,
    organizationId: string,
    properties: {
      degreeType?: string;
      fieldOfStudy?: string;
      startedAt?: string;
      endedAt?: string;
      graduated?: boolean;
    }
  ): Promise<void> {
    await neo4jClient.write(
      `
      MATCH (t:Talent {id: $talentId})
      MATCH (o:Organization {id: $organizationId})
      MERGE (t)-[r:A_ETUDIE_A]->(o)
      SET r.degree_type = $degreeType,
          r.field_of_study = $fieldOfStudy,
          r.started_at = $startedAt,
          r.ended_at = $endedAt,
          r.graduated = $graduated
      `,
      {
        talentId,
        organizationId,
        degreeType: properties.degreeType,
        fieldOfStudy: properties.fieldOfStudy,
        startedAt: properties.startedAt,
        endedAt: properties.endedAt,
        graduated: properties.graduated ?? false,
      }
    );
  },

  // ═══════════════════════════════════════════════════════════════
  // APPLICATION RELATIONSHIPS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Record a job application
   */
  async addApplication(
    talentId: string,
    opportunityId: string,
    properties: {
      status?: string;
      matchScore?: number;
      cvId?: string;
    }
  ): Promise<void> {
    await neo4jClient.write(
      `
      MATCH (t:Talent {id: $talentId})
      MATCH (o:Opportunity {id: $opportunityId})
      MERGE (t)-[r:A_POSTULE_A]->(o)
      SET r.status = $status,
          r.applied_at = datetime(),
          r.match_score = $matchScore,
          r.cv_id = $cvId
      `,
      {
        talentId,
        opportunityId,
        status: properties.status ?? 'submitted',
        matchScore: properties.matchScore,
        cvId: properties.cvId,
      }
    );
  },

  /**
   * Update application status
   */
  async updateApplicationStatus(
    talentId: string,
    opportunityId: string,
    status: string
  ): Promise<void> {
    await neo4jClient.write(
      `
      MATCH (t:Talent {id: $talentId})-[r:A_POSTULE_A]->(o:Opportunity {id: $opportunityId})
      SET r.status = $status,
          r.updated_at = datetime()
      `,
      { talentId, opportunityId, status }
    );
  },

  // ═══════════════════════════════════════════════════════════════
  // COMMUNITY MEMBERSHIP RELATIONSHIPS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Add community membership
   */
  async addCommunityMembership(
    talentId: string,
    communityId: string,
    properties: {
      role?: string;
      contributionScore?: number;
    }
  ): Promise<void> {
    await neo4jClient.write(
      `
      MATCH (t:Talent {id: $talentId})
      MATCH (c:Community {id: $communityId})
      MERGE (t)-[r:EST_MEMBRE_DE]->(c)
      SET r.role = $role,
          r.joined_at = datetime(),
          r.is_active = true,
          r.contribution_score = $contributionScore
      `,
      {
        talentId,
        communityId,
        role: properties.role ?? 'member',
        contributionScore: properties.contributionScore ?? 0,
      }
    );
  },

  /**
   * Update community membership
   */
  async updateCommunityMembership(
    talentId: string,
    communityId: string,
    properties: { role?: string; isActive?: boolean; contributionScore?: number }
  ): Promise<void> {
    const updates: string[] = [];
    if (properties.role !== undefined) updates.push('r.role = $role');
    if (properties.isActive !== undefined) updates.push('r.is_active = $isActive');
    if (properties.contributionScore !== undefined)
      updates.push('r.contribution_score = $contributionScore');

    if (updates.length === 0) return;

    await neo4jClient.write(
      `
      MATCH (t:Talent {id: $talentId})-[r:EST_MEMBRE_DE]->(c:Community {id: $communityId})
      SET ${updates.join(', ')}
      `,
      {
        talentId,
        communityId,
        ...properties,
      }
    );
  },

  /**
   * Remove community membership
   */
  async removeCommunityMembership(talentId: string, communityId: string): Promise<void> {
    await neo4jClient.write(
      `
      MATCH (t:Talent {id: $talentId})-[r:EST_MEMBRE_DE]->(c:Community {id: $communityId})
      DELETE r
      `,
      { talentId, communityId }
    );
  },

  // ═══════════════════════════════════════════════════════════════
  // LEARNING RELATIONSHIPS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Update learning progress for a topic
   */
  async updateLearningProgress(
    talentId: string,
    topicId: string,
    properties: {
      masteryLevel?: number;
      streakDays?: number;
      totalTimeMinutes?: number;
      flashcardsCount?: number;
      quizzesCompleted?: number;
    }
  ): Promise<void> {
    const updates: string[] = ['r.last_studied_at = datetime()'];
    if (properties.masteryLevel !== undefined) updates.push('r.mastery_level = $masteryLevel');
    if (properties.streakDays !== undefined) updates.push('r.streak_days = $streakDays');
    if (properties.totalTimeMinutes !== undefined)
      updates.push('r.total_time_minutes = $totalTimeMinutes');
    if (properties.flashcardsCount !== undefined)
      updates.push('r.flashcards_count = $flashcardsCount');
    if (properties.quizzesCompleted !== undefined)
      updates.push('r.quizzes_completed = $quizzesCompleted');

    await neo4jClient.write(
      `
      MATCH (t:Talent {id: $talentId})-[r:ETUDIE_SUJET]->(lt:LearningTopic {id: $topicId})
      SET ${updates.join(', ')}
      `,
      {
        talentId,
        topicId,
        ...properties,
      }
    );
  },

  /**
   * Add study time to a topic
   */
  async addStudyTime(
    talentId: string,
    topicId: string,
    minutesStudied: number
  ): Promise<void> {
    await neo4jClient.write(
      `
      MATCH (t:Talent {id: $talentId})-[r:ETUDIE_SUJET]->(lt:LearningTopic {id: $topicId})
      SET r.total_time_minutes = COALESCE(r.total_time_minutes, 0) + $minutes,
          r.last_studied_at = datetime()
      `,
      { talentId, topicId, minutes: minutesStudied }
    );
  },

  // ═══════════════════════════════════════════════════════════════
  // TALENT-TALENT RELATIONSHIPS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Add a connection between talents
   */
  async addConnection(
    talentId1: string,
    talentId2: string,
    properties: {
      relationshipType?: string;
      context?: string;
    }
  ): Promise<void> {
    await neo4jClient.write(
      `
      MATCH (t1:Talent {id: $talentId1})
      MATCH (t2:Talent {id: $talentId2})
      WHERE t1 <> t2
      MERGE (t1)-[r:CONNECTE_AVEC]-(t2)
      SET r.relationship_type = $relationshipType,
          r.connected_at = datetime(),
          r.context = $context
      `,
      {
        talentId1,
        talentId2,
        relationshipType: properties.relationshipType ?? 'professional',
        context: properties.context,
      }
    );
  },

  /**
   * Add a recommendation
   */
  async addRecommendation(
    recommenderId: string,
    recommendedId: string,
    properties: {
      recommendationText?: string;
      highlightedSkills: string[];
      relationshipContext?: string;
    }
  ): Promise<void> {
    await neo4jClient.write(
      `
      MATCH (recommender:Talent {id: $recommenderId})
      MATCH (recommended:Talent {id: $recommendedId})
      WHERE recommender <> recommended
      MERGE (recommended)-[r:RECOMMANDE_PAR]->(recommender)
      SET r.recommendation_text = $recommendationText,
          r.highlighted_skills = $highlightedSkills,
          r.relationship_context = $relationshipContext,
          r.recommended_at = datetime()
      `,
      {
        recommenderId,
        recommendedId,
        recommendationText: properties.recommendationText,
        highlightedSkills: properties.highlightedSkills,
        relationshipContext: properties.relationshipContext,
      }
    );
  },

  // ═══════════════════════════════════════════════════════════════
  // SKILL-SKILL RELATIONSHIPS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Add prerequisite relationship between skills
   */
  async addSkillPrerequisite(
    prerequisiteSkillId: string,
    targetSkillId: string,
    isStrict: boolean = true
  ): Promise<void> {
    await neo4jClient.write(
      `
      MATCH (prereq:Skill {id: $prereqId})
      MATCH (target:Skill {id: $targetId})
      MERGE (prereq)-[r:PREREQUIS_POUR]->(target)
      SET r.is_strict = $isStrict
      `,
      {
        prereqId: prerequisiteSkillId,
        targetId: targetSkillId,
        isStrict,
      }
    );
  },

  /**
   * Add complementary relationship between skills
   */
  async addComplementarySkills(
    skillId1: string,
    skillId2: string,
    synergyScore: number = 0.8
  ): Promise<void> {
    await neo4jClient.write(
      `
      MATCH (s1:Skill {id: $skillId1})
      MATCH (s2:Skill {id: $skillId2})
      WHERE s1 <> s2
      MERGE (s1)-[r:COMPLEMENTAIRE_A]-(s2)
      SET r.synergy_score = $synergyScore
      `,
      { skillId1, skillId2, synergyScore }
    );
  },

  // ═══════════════════════════════════════════════════════════════
  // GENERIC RELATIONSHIP OPERATIONS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Delete a relationship between two nodes
   */
  async deleteRelationship(
    fromLabel: string,
    fromId: string,
    relationshipType: RelationshipType,
    toLabel: string,
    toId: string
  ): Promise<void> {
    await neo4jClient.write(
      `
      MATCH (from:${fromLabel} {id: $fromId})-[r:${relationshipType}]->(to:${toLabel} {id: $toId})
      DELETE r
      `,
      { fromId, toId }
    );
  },
};
