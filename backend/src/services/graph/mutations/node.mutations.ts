/**
 * Node Mutations
 *
 * CRUD operations for graph nodes
 */

import { neo4jClient } from '../neo4j.client';
import { NodeLabels, type NodeLabel } from '../ontology';

// ═══════════════════════════════════════════════════════════════
// GENERIC NODE OPERATIONS
// ═══════════════════════════════════════════════════════════════

export const nodeMutations = {
  /**
   * Create or update a node
   */
  async upsertNode(
    label: NodeLabel,
    id: string,
    properties: Record<string, any>
  ): Promise<void> {
    const setClause = Object.keys(properties)
      .map(key => `n.${key} = $props.${key}`)
      .join(', ');

    await neo4jClient.write(
      `
      MERGE (n:${label} {id: $id})
      SET ${setClause}
      `,
      { id, props: properties }
    );
  },

  /**
   * Delete a node and all its relationships
   */
  async deleteNode(label: NodeLabel, id: string): Promise<void> {
    await neo4jClient.write(
      `MATCH (n:${label} {id: $id}) DETACH DELETE n`,
      { id }
    );
  },

  /**
   * Update specific properties of a node
   */
  async updateNodeProperties(
    label: NodeLabel,
    id: string,
    properties: Record<string, any>
  ): Promise<boolean> {
    const result = await neo4jClient.write(
      `
      MATCH (n:${label} {id: $id})
      SET n += $props
      RETURN n
      `,
      { id, props: properties }
    );

    return result.records.length > 0;
  },

  // ═══════════════════════════════════════════════════════════════
  // TALENT-SPECIFIC OPERATIONS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Create or update a talent node
   */
  async upsertTalent(talent: {
    id: string;
    name: string;
    email: string;
    headline?: string;
    city?: string;
    country?: string;
    goals?: string[];
  }): Promise<void> {
    await neo4jClient.write(
      `
      MERGE (t:Talent {id: $id})
      SET t.name = $name,
          t.email = $email,
          t.headline = $headline,
          t.city = $city,
          t.country = $country,
          t.goals = $goals,
          t.updated_at = datetime()
      `,
      talent
    );
  },

  /**
   * Delete a talent and all relationships
   */
  async deleteTalent(talentId: string): Promise<void> {
    await neo4jClient.write(
      `MATCH (t:Talent {id: $talentId}) DETACH DELETE t`,
      { talentId }
    );
  },

  // ═══════════════════════════════════════════════════════════════
  // SKILL OPERATIONS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Create or update a skill node
   */
  async upsertSkill(skill: {
    id: string;
    canonical_name: string;
    type: string;
  }): Promise<void> {
    await neo4jClient.write(
      `
      MERGE (s:Skill {id: $id})
      SET s.canonical_name = $canonical_name,
          s.type = $type
      `,
      skill
    );
  },

  /**
   * Find or create a skill by name
   */
  async findOrCreateSkill(name: string, type: string = 'technical'): Promise<string> {
    const result = await neo4jClient.write(
      `
      MERGE (s:Skill {canonical_name: $name})
      ON CREATE SET s.id = randomUUID(),
                    s.type = $type,
                    s.created_at = datetime()
      RETURN s.id as id
      `,
      { name: name.toLowerCase(), type }
    );

    return result.records[0].get('id');
  },

  // ═══════════════════════════════════════════════════════════════
  // ORGANIZATION OPERATIONS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Create or update an organization node
   */
  async upsertOrganization(org: {
    id: string;
    name: string;
    types?: string[];
    sectors?: string[];
    city?: string;
    country?: string;
  }): Promise<void> {
    await neo4jClient.write(
      `
      MERGE (o:Organization {id: $id})
      SET o.name = $name,
          o.types = $types,
          o.sectors = $sectors,
          o.city = $city,
          o.country = $country
      `,
      org
    );
  },

  // ═══════════════════════════════════════════════════════════════
  // OPPORTUNITY OPERATIONS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Create or update an opportunity node
   */
  async upsertOpportunity(opp: {
    id: string;
    title: string;
    type: string;
    status: string;
    contractType?: string;
    locationType?: string;
    city?: string;
    country?: string;
    deadline?: string;
    salaryMin?: number;
    salaryMax?: number;
    organizationId?: string;
  }): Promise<void> {
    await neo4jClient.write(
      `
      MERGE (o:Opportunity {id: $id})
      SET o.title = $title,
          o.type = $type,
          o.status = $status,
          o.contract_type = $contractType,
          o.location_type = $locationType,
          o.city = $city,
          o.country = $country,
          o.deadline = $deadline,
          o.salary_min = $salaryMin,
          o.salary_max = $salaryMax

      WITH o
      WHERE $organizationId IS NOT NULL
      MATCH (org:Organization {id: $organizationId})
      MERGE (o)-[:PUBLIE_PAR]->(org)
      `,
      {
        id: opp.id,
        title: opp.title,
        type: opp.type,
        status: opp.status,
        contractType: opp.contractType,
        locationType: opp.locationType,
        city: opp.city,
        country: opp.country,
        deadline: opp.deadline,
        salaryMin: opp.salaryMin,
        salaryMax: opp.salaryMax,
        organizationId: opp.organizationId,
      }
    );
  },

  // ═══════════════════════════════════════════════════════════════
  // LEARNING TOPIC OPERATIONS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Create or update a learning topic node
   */
  async upsertLearningTopic(topic: {
    id: string;
    name: string;
    slug?: string;
    masteryLevel?: number;
  }): Promise<void> {
    await neo4jClient.write(
      `
      MERGE (t:LearningTopic {id: $id})
      SET t.name = $name,
          t.slug = $slug,
          t.mastery_level = $masteryLevel
      `,
      topic
    );
  },

  /**
   * Find or create a learning topic by name
   */
  async findOrCreateLearningTopic(
    talentId: string,
    topicName: string
  ): Promise<string> {
    const result = await neo4jClient.write(
      `
      MATCH (t:Talent {id: $talentId})
      MERGE (lt:LearningTopic {name: $topicName})
      ON CREATE SET lt.id = randomUUID(),
                    lt.slug = toLower(replace($topicName, ' ', '-')),
                    lt.mastery_level = 0,
                    lt.first_studied_at = datetime()
      MERGE (t)-[r:ETUDIE_SUJET]->(lt)
      ON CREATE SET r.started_at = datetime(),
                    r.mastery_level = 0,
                    r.streak_days = 0,
                    r.total_time_minutes = 0
      RETURN lt.id as id
      `,
      { talentId, topicName }
    );

    return result.records[0].get('id');
  },

  // ═══════════════════════════════════════════════════════════════
  // DOCUMENT OPERATIONS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Create or update a document node
   */
  async upsertDocument(doc: {
    id: string;
    type: string;
    filename: string;
    title?: string;
    extractedSkills?: string[];
    uploadedAt?: string;
    isVerified?: boolean;
    talentId?: string;
  }): Promise<void> {
    await neo4jClient.write(
      `
      MERGE (d:Document {id: $id})
      SET d.type = $type,
          d.filename = $filename,
          d.title = $title,
          d.extracted_skills = $extractedSkills,
          d.uploaded_at = $uploadedAt,
          d.is_verified = $isVerified

      WITH d
      WHERE $talentId IS NOT NULL
      MATCH (t:Talent {id: $talentId})
      MERGE (t)-[:POSSEDE_DOCUMENT]->(d)
      `,
      {
        id: doc.id,
        type: doc.type,
        filename: doc.filename,
        title: doc.title,
        extractedSkills: doc.extractedSkills,
        uploadedAt: doc.uploadedAt,
        isVerified: doc.isVerified ?? false,
        talentId: doc.talentId,
      }
    );
  },

  // ═══════════════════════════════════════════════════════════════
  // COMMUNITY OPERATIONS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Create or update a community node
   */
  async upsertCommunity(community: {
    id: string;
    name: string;
    type?: string;
    sectors?: string[];
    isPaid?: boolean;
    memberCount?: number;
    organizationId?: string;
  }): Promise<void> {
    await neo4jClient.write(
      `
      MERGE (c:Community {id: $id})
      SET c.name = $name,
          c.type = $type,
          c.sectors = $sectors,
          c.is_paid = $isPaid,
          c.member_count = $memberCount

      WITH c
      WHERE $organizationId IS NOT NULL
      MATCH (org:Organization {id: $organizationId})
      MERGE (c)-[:APPARTIENT_A]->(org)
      `,
      {
        id: community.id,
        name: community.name,
        type: community.type,
        sectors: community.sectors,
        isPaid: community.isPaid ?? false,
        memberCount: community.memberCount ?? 0,
        organizationId: community.organizationId,
      }
    );
  },

  // ═══════════════════════════════════════════════════════════════
  // SPACE OPERATIONS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Create or update a space node
   */
  async upsertSpace(space: {
    id: string;
    name: string;
    type?: string;
    capacity?: number;
    hourlyRate?: number;
    dailyRate?: number;
    city?: string;
    country?: string;
  }): Promise<void> {
    await neo4jClient.write(
      `
      MERGE (s:Space {id: $id})
      SET s.name = $name,
          s.type = $type,
          s.capacity = $capacity,
          s.hourly_rate = $hourlyRate,
          s.daily_rate = $dailyRate,
          s.city = $city,
          s.country = $country
      `,
      space
    );
  },
};
