/**
 * Talent Graph Queries
 *
 * Queries centered on the talent node (ego network)
 */

import { neo4jClient } from '../neo4j.client';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface TalentGraphSummary {
  talent: {
    id: string;
    name: string;
    email: string;
    headline?: string;
    city?: string;
    country?: string;
    goals?: string[];
  };
  stats: {
    skillsCount: number;
    experiencesCount: number;
    applicationsCount: number;
    membershipCount: number;
    learningTopicsCount: number;
    documentsCount: number;
    connectionsCount: number;
  };
  topSkills: Array<{
    name: string;
    level: string;
  }>;
  currentPosition?: {
    title: string;
    organization: string;
  };
  recentActivity: Array<{
    type: string;
    description: string;
    date?: string;
  }>;
}

export interface SkillWithContext {
  id: string;
  name: string;
  type: string;
  proficiencyLevel: string;
  relatedOpportunities: number;
  learningTopics: string[];
}

// ═══════════════════════════════════════════════════════════════
// TALENT QUERIES
// ═══════════════════════════════════════════════════════════════

export const talentQueries = {
  /**
   * Get a summary of a talent's graph
   */
  async getTalentSummary(talentId: string): Promise<TalentGraphSummary | null> {
    const result = await neo4jClient.read(
      `
      MATCH (t:Talent {id: $talentId})

      // Count stats
      OPTIONAL MATCH (t)-[:POSSEDE_COMPETENCE]->(s:Skill)
      WITH t, count(DISTINCT s) as skillsCount

      OPTIONAL MATCH (t)-[:TRAVAILLE_CHEZ|A_TRAVAILLE_CHEZ]->(o:Organization)
      WITH t, skillsCount, count(DISTINCT o) as experiencesCount

      OPTIONAL MATCH (t)-[:A_POSTULE_A]->(opp:Opportunity)
      WITH t, skillsCount, experiencesCount, count(DISTINCT opp) as applicationsCount

      OPTIONAL MATCH (t)-[:EST_MEMBRE_DE]->(c:Community)
      WITH t, skillsCount, experiencesCount, applicationsCount, count(DISTINCT c) as membershipCount

      OPTIONAL MATCH (t)-[:ETUDIE_SUJET]->(lt:LearningTopic)
      WITH t, skillsCount, experiencesCount, applicationsCount, membershipCount,
           count(DISTINCT lt) as learningTopicsCount

      OPTIONAL MATCH (t)-[:POSSEDE_DOCUMENT]->(d:Document)
      WITH t, skillsCount, experiencesCount, applicationsCount, membershipCount,
           learningTopicsCount, count(DISTINCT d) as documentsCount

      OPTIONAL MATCH (t)-[:CONNECTE_AVEC]-(other:Talent)
      WITH t, skillsCount, experiencesCount, applicationsCount, membershipCount,
           learningTopicsCount, documentsCount, count(DISTINCT other) as connectionsCount

      // Get top skills
      OPTIONAL MATCH (t)-[r:POSSEDE_COMPETENCE]->(skill:Skill)
      WITH t, skillsCount, experiencesCount, applicationsCount, membershipCount,
           learningTopicsCount, documentsCount, connectionsCount,
           collect({name: skill.canonical_name, level: r.proficiency_level})[0..5] as topSkills

      // Get current position
      OPTIONAL MATCH (t)-[exp:TRAVAILLE_CHEZ]->(org:Organization)
      WITH t, skillsCount, experiencesCount, applicationsCount, membershipCount,
           learningTopicsCount, documentsCount, connectionsCount, topSkills,
           {title: exp.job_title, organization: org.name} as currentPosition

      RETURN t as talent,
             skillsCount, experiencesCount, applicationsCount, membershipCount,
             learningTopicsCount, documentsCount, connectionsCount,
             topSkills, currentPosition
      `,
      { talentId }
    );

    if (result.records.length === 0) {
      return null;
    }

    const record = result.records[0];
    const talentNode = record.get('talent');

    if (!talentNode) {
      return null;
    }

    const talent = talentNode.properties;
    const currentPos = record.get('currentPosition');

    return {
      talent: {
        id: talent.id,
        name: talent.name,
        email: talent.email,
        headline: talent.headline,
        city: talent.city,
        country: talent.country,
        goals: talent.goals,
      },
      stats: {
        skillsCount: this.toNumber(record.get('skillsCount')),
        experiencesCount: this.toNumber(record.get('experiencesCount')),
        applicationsCount: this.toNumber(record.get('applicationsCount')),
        membershipCount: this.toNumber(record.get('membershipCount')),
        learningTopicsCount: this.toNumber(record.get('learningTopicsCount')),
        documentsCount: this.toNumber(record.get('documentsCount')),
        connectionsCount: this.toNumber(record.get('connectionsCount')),
      },
      topSkills: (record.get('topSkills') || []).filter((s: any) => s.name).map((s: any) => ({
        name: s.name,
        level: s.level,
      })),
      currentPosition: currentPos?.title
        ? { title: currentPos.title, organization: currentPos.organization }
        : undefined,
      recentActivity: [], // Would need additional query for activity timeline
    };
  },

  /**
   * Get all skills of a talent with context
   */
  async getTalentSkills(talentId: string): Promise<SkillWithContext[]> {
    const result = await neo4jClient.read(
      `
      MATCH (t:Talent {id: $talentId})-[r:POSSEDE_COMPETENCE]->(s:Skill)

      // Get learning topics for this skill domain
      WITH t, r, s
      OPTIONAL MATCH (t)-[:ETUDIE_SUJET]->(lt:LearningTopic)
      WHERE lt.name CONTAINS s.canonical_name OR s.canonical_name CONTAINS lt.name
      WITH s, r, collect(lt.name) as learningTopics

      RETURN s.id as id,
             s.canonical_name as name,
             s.type as type,
             r.proficiency_level as proficiencyLevel,
             0 as relatedOpportunities,
             learningTopics
      ORDER BY r.proficiency_level DESC
      `,
      { talentId }
    );

    return result.records.map(record => ({
      id: record.get('id'),
      name: record.get('name'),
      type: record.get('type'),
      proficiencyLevel: record.get('proficiencyLevel'),
      relatedOpportunities: this.toNumber(record.get('relatedOpportunities')),
      learningTopics: record.get('learningTopics') || [],
    }));
  },

  /**
   * Get talent's career timeline
   */
  async getCareerTimeline(talentId: string): Promise<
    Array<{
      type: 'work' | 'education';
      organization: { id: string; name: string };
      title: string;
      startedAt?: string;
      endedAt?: string;
      isCurrent: boolean;
      details?: string;
    }>
  > {
    const result = await neo4jClient.read(
      `
      MATCH (t:Talent {id: $talentId})

      // Get work experiences
      OPTIONAL MATCH (t)-[work:TRAVAILLE_CHEZ|A_TRAVAILLE_CHEZ]->(workOrg:Organization)

      // Get education
      OPTIONAL MATCH (t)-[edu:A_ETUDIE_A]->(eduOrg:Organization)

      WITH collect(DISTINCT {
        type: 'work',
        org: workOrg,
        title: work.job_title,
        startedAt: work.started_at,
        endedAt: work.ended_at,
        isCurrent: type(work) = 'TRAVAILLE_CHEZ'
      }) as workExp,
      collect(DISTINCT {
        type: 'education',
        org: eduOrg,
        title: edu.degree_type + COALESCE(' en ' + edu.field_of_study, ''),
        startedAt: edu.started_at,
        endedAt: edu.ended_at,
        isCurrent: false,
        details: edu.field_of_study
      }) as eduExp

      RETURN workExp + eduExp as timeline
      `,
      { talentId }
    );

    if (result.records.length === 0) {
      return [];
    }

    const timeline = result.records[0].get('timeline') || [];

    return timeline
      .filter((item: any) => item.org)
      .map((item: any) => ({
        type: item.type,
        organization: {
          id: item.org.properties.id,
          name: item.org.properties.name,
        },
        title: item.title || '',
        startedAt: item.startedAt,
        endedAt: item.endedAt,
        isCurrent: item.isCurrent,
        details: item.details,
      }))
      .sort((a: any, b: any) => {
        if (a.isCurrent) return -1;
        if (b.isCurrent) return 1;
        return (b.startedAt || '').localeCompare(a.startedAt || '');
      });
  },

  /**
   * Get talent's network (connections)
   */
  async getTalentNetwork(talentId: string): Promise<{
    connections: Array<{ id: string; name: string; relationshipType: string }>;
    mentors: Array<{ id: string; name: string; focusAreas: string[] }>;
    mentees: Array<{ id: string; name: string; focusAreas: string[] }>;
  }> {
    const result = await neo4jClient.read(
      `
      MATCH (t:Talent {id: $talentId})
      OPTIONAL MATCH (t)-[conn:CONNECTE_AVEC]-(connected:Talent)
      WITH t, collect(DISTINCT {
        id: connected.id,
        name: connected.name,
        type: conn.relationship_type
      }) as connections
      RETURN connections
      `,
      { talentId }
    );

    if (result.records.length === 0) {
      return { connections: [], mentors: [], mentees: [] };
    }

    const record = result.records[0];
    const connections = (record.get('connections') || []).filter((c: any) => c.id).map((c: any) => ({
      id: c.id,
      name: c.name,
      relationshipType: c.type || 'professional',
    }));

    return {
      connections,
      mentors: [],
      mentees: [],
    };
  },

  /**
   * Get talent's community memberships
   */
  async getTalentCommunities(talentId: string): Promise<
    Array<{
      id: string;
      name: string;
      type: string;
      role: string;
      joinedAt: string;
      isActive: boolean;
    }>
  > {
    const result = await neo4jClient.read(
      `
      MATCH (t:Talent {id: $talentId})-[r:EST_MEMBRE_DE]->(c:Community)
      RETURN c.id as id,
             c.name as name,
             c.type as type,
             r.role as role,
             r.joined_at as joinedAt,
             r.is_active as isActive
      ORDER BY r.joined_at DESC
      `,
      { talentId }
    );

    return result.records.map(record => ({
      id: record.get('id'),
      name: record.get('name'),
      type: record.get('type'),
      role: record.get('role') || 'member',
      joinedAt: record.get('joinedAt'),
      isActive: record.get('isActive') ?? true,
    }));
  },

  /**
   * Get agent-inferred insights for a talent
   */
  async getTalentInferences(talentId: string): Promise<{
    interests: Array<{ target: string; targetType: string; confidence: number; reason: string }>;
    suggestedSkills: Array<{
      skill: string;
      priority: string;
      confidence: number;
      reason: string;
    }>;
    similarTalents: Array<{ id: string; name: string; commonSkillsCount: number }>;
  }> {
    const result = await neo4jClient.read(
      `
      MATCH (t:Talent {id: $talentId})

      // Get interests
      OPTIONAL MATCH (t)-[int:INTERESSE_PAR]->(interest)
      WITH t, collect(DISTINCT {
        target: COALESCE(interest.canonical_name, interest.name),
        targetType: labels(interest)[0],
        confidence: int.confidence,
        reason: int.reason
      }) as interests

      // Get suggested skills
      OPTIONAL MATCH (t)-[sug:DEVRAIT_APPRENDRE]->(skill:Skill)
      WITH t, interests, collect(DISTINCT {
        skill: skill.canonical_name,
        priority: sug.priority,
        confidence: sug.confidence,
        reason: sug.reason
      }) as suggestedSkills

      // Get similar talents
      OPTIONAL MATCH (t)-[sim:SIMILAIRE_A]->(similar:Talent)
      WITH t, interests, suggestedSkills, collect(DISTINCT {
        id: similar.id,
        name: similar.name,
        commonSkillsCount: sim.common_skills_count
      }) as similarTalents

      RETURN interests, suggestedSkills, similarTalents
      `,
      { talentId }
    );

    if (result.records.length === 0) {
      return { interests: [], suggestedSkills: [], similarTalents: [] };
    }

    const record = result.records[0];

    return {
      interests: (record.get('interests') || []).filter((i: any) => i.target).map((i: any) => ({
        target: i.target,
        targetType: i.targetType,
        confidence: i.confidence,
        reason: i.reason,
      })),
      suggestedSkills: (record.get('suggestedSkills') || [])
        .filter((s: any) => s.skill)
        .map((s: any) => ({
          skill: s.skill,
          priority: s.priority,
          confidence: s.confidence,
          reason: s.reason,
        })),
      similarTalents: (record.get('similarTalents') || [])
        .filter((s: any) => s.id)
        .map((s: any) => ({
          id: s.id,
          name: s.name,
          commonSkillsCount: s.commonSkillsCount,
        })),
    };
  },

  // Helper to convert Neo4j integers
  toNumber(value: any): number {
    if (!value) return 0;
    return value.toNumber?.() ?? value;
  },
};
