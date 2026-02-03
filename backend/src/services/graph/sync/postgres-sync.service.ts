/**
 * PostgreSQL to Neo4j Sync Service
 *
 * Synchronizes data from PostgreSQL to Neo4j graph database
 */

import { pool } from '../../database';
import { neo4jClient } from '../neo4j.client';
import { NodeLabels, RelationshipTypes } from '../ontology';

import { logger } from '../../../utils';
// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface SyncResult {
  success: boolean;
  nodesCreated: number;
  relationshipsCreated: number;
  errors: string[];
  duration: number;
}

export interface SyncOptions {
  fullSync?: boolean;
  since?: Date;
  batchSize?: number;
}

// ═══════════════════════════════════════════════════════════════
// POSTGRES SYNC SERVICE
// ═══════════════════════════════════════════════════════════════

export const postgresSyncService = {
  /**
   * Run a full sync of all data from PostgreSQL to Neo4j
   */
  async runFullSync(options: SyncOptions = {}): Promise<SyncResult> {
    const startTime = Date.now();
    const batchSize = options.batchSize ?? 100;
    const errors: string[] = [];
    let nodesCreated = 0;
    let relationshipsCreated = 0;

    logger.info('[GraphSync] Starting full sync...');

    try {
      // Sync nodes in order (dependencies first)
      const orgsResult = await this.syncOrganizations(batchSize);
      nodesCreated += orgsResult.count;
      errors.push(...orgsResult.errors);

      const talentsResult = await this.syncTalents(batchSize);
      nodesCreated += talentsResult.count;
      errors.push(...talentsResult.errors);

      const oppsResult = await this.syncOpportunities(batchSize);
      nodesCreated += oppsResult.count;
      errors.push(...oppsResult.errors);

      const commResult = await this.syncCommunities(batchSize);
      nodesCreated += commResult.count;
      errors.push(...commResult.errors);

      const spacesResult = await this.syncSpaces(batchSize);
      nodesCreated += spacesResult.count;
      errors.push(...spacesResult.errors);

      const topicsResult = await this.syncLearningTopics(batchSize);
      nodesCreated += topicsResult.count;
      errors.push(...topicsResult.errors);

      const docsResult = await this.syncDocuments(batchSize);
      nodesCreated += docsResult.count;
      errors.push(...docsResult.errors);

      const projectsResult = await this.syncProjects(batchSize);
      nodesCreated += projectsResult.count;
      errors.push(...projectsResult.errors);

      const sectorsResult = await this.syncSectors(batchSize);
      nodesCreated += sectorsResult.count;
      errors.push(...sectorsResult.errors);

      // Sync relationships
      const talentSkillsRel = await this.syncTalentSkills(batchSize);
      relationshipsCreated += talentSkillsRel.count;
      errors.push(...talentSkillsRel.errors);

      const experiencesRel = await this.syncExperiences(batchSize);
      relationshipsCreated += experiencesRel.count;
      errors.push(...experiencesRel.errors);

      const educationsRel = await this.syncEducations(batchSize);
      relationshipsCreated += educationsRel.count;
      errors.push(...educationsRel.errors);

      const applicationsRel = await this.syncApplications(batchSize);
      relationshipsCreated += applicationsRel.count;
      errors.push(...applicationsRel.errors);

      const membershipsRel = await this.syncCommunityMemberships(batchSize);
      relationshipsCreated += membershipsRel.count;
      errors.push(...membershipsRel.errors);


      const learningRel = await this.syncLearningRelations(batchSize);
      relationshipsCreated += learningRel.count;
      errors.push(...learningRel.errors);

      const connectionsRel = await this.syncConnections(batchSize);
      relationshipsCreated += connectionsRel.count;
      errors.push(...connectionsRel.errors);

      const mentorshipsRel = await this.syncMentorships(batchSize);
      relationshipsCreated += mentorshipsRel.count;
      errors.push(...mentorshipsRel.errors);

      const recommendationsRel = await this.syncRecommendations(batchSize);
      relationshipsCreated += recommendationsRel.count;
      errors.push(...recommendationsRel.errors);

      const bookmarksRel = await this.syncBookmarks(batchSize);
      relationshipsCreated += bookmarksRel.count;
      errors.push(...bookmarksRel.errors);

      const spaceBookingsRel = await this.syncSpaceBookings(batchSize);
      relationshipsCreated += spaceBookingsRel.count;
      errors.push(...spaceBookingsRel.errors);

      const sectorRel = await this.syncSectorRelations(batchSize);
      relationshipsCreated += sectorRel.count;
      errors.push(...sectorRel.errors);

      logger.info(
        `[GraphSync] Full sync completed: ${nodesCreated} nodes, ${relationshipsCreated} relationships`
      );

      return {
        success: errors.length === 0,
        nodesCreated,
        relationshipsCreated,
        errors,
        duration: Date.now() - startTime,
      };
    } catch (error: any) {
      logger.error('[GraphSync] Full sync failed:', error);
      errors.push(error.message);
      return {
        success: false,
        nodesCreated,
        relationshipsCreated,
        errors,
        duration: Date.now() - startTime,
      };
    }
  },

  /**
   * Sync skills — table removed in migration 053, skills are now inline in talent_skills
   */
  async syncSkills(
    _batchSize: number
  ): Promise<{ count: number; errors: string[] }> {
    return { count: 0, errors: [] };
  },

  /**
   * Sync organizations from PostgreSQL
   */
  async syncOrganizations(
    batchSize: number
  ): Promise<{ count: number; errors: string[] }> {
    const errors: string[] = [];
    let count = 0;

    try {
      const { rows: orgs } = await pool.query(`
        SELECT id, name, slug, types, sectors, size,
               headquarters_city as city, headquarters_country as country
        FROM organizations
        WHERE deleted_at IS NULL
      `);

      for (let i = 0; i < orgs.length; i += batchSize) {
        const batch = orgs.slice(i, i + batchSize);

        await neo4jClient.write(
          `
          UNWIND $orgs AS org
          MERGE (o:Organization {id: org.id})
          SET o.name = org.name,
              o.slug = org.slug,
              o.types = org.types,
              o.sectors = org.sectors,
              o.size = org.size,
              o.city = org.city,
              o.country = org.country
          `,
          { orgs: batch }
        );

        count += batch.length;
      }

      logger.info(`[GraphSync] Synced ${count} organizations`);
    } catch (error: any) {
      errors.push(`Organizations sync error: ${error.message}`);
    }

    return { count, errors };
  },

  /**
   * Sync talents from PostgreSQL
   */
  async syncTalents(
    batchSize: number
  ): Promise<{ count: number; errors: string[] }> {
    const errors: string[] = [];
    let count = 0;

    try {
      const { rows: talents } = await pool.query(`
        SELECT id, COALESCE(first_name || ' ' || last_name, email) as name, email, bio as headline,
               city, country, goals, created_at, updated_at
        FROM talents
        WHERE deleted_at IS NULL
      `);

      for (let i = 0; i < talents.length; i += batchSize) {
        const batch = talents.slice(i, i + batchSize).map(t => ({
          ...t,
          created_at: t.created_at?.toISOString(),
          updated_at: t.updated_at?.toISOString(),
        }));

        await neo4jClient.write(
          `
          UNWIND $talents AS talent
          MERGE (t:Talent {id: talent.id})
          SET t.name = talent.name,
              t.email = talent.email,
              t.headline = talent.headline,
              t.city = talent.city,
              t.country = talent.country,
              t.goals = talent.goals,
              t.created_at = talent.created_at,
              t.updated_at = talent.updated_at
          `,
          { talents: batch }
        );

        count += batch.length;
      }

      logger.info(`[GraphSync] Synced ${count} talents`);
    } catch (error: any) {
      errors.push(`Talents sync error: ${error.message}`);
    }

    return { count, errors };
  },

  /**
   * Sync opportunities from PostgreSQL
   */
  async syncOpportunities(
    batchSize: number
  ): Promise<{ count: number; errors: string[] }> {
    const errors: string[] = [];
    let count = 0;

    try {
      const { rows: opps } = await pool.query(`
        SELECT o.id, o.title, o.slug, o.type, o.contract_type, o.status,
               o.deadline, o.compensation_min as salary_min, o.compensation_max as salary_max,
               o.location_type, o.organization_id,
               (o.locations->>0)::jsonb->>'city' as city,
               (o.locations->>0)::jsonb->>'country' as country
        FROM opportunities o
        WHERE o.deleted_at IS NULL
      `);

      for (let i = 0; i < opps.length; i += batchSize) {
        const batch = opps.slice(i, i + batchSize).map(o => ({
          ...o,
          deadline: o.deadline?.toISOString(),
          salary_min: o.salary_min ? parseFloat(o.salary_min) : null,
          salary_max: o.salary_max ? parseFloat(o.salary_max) : null,
        }));

        await neo4jClient.write(
          `
          UNWIND $opps AS opp
          MERGE (o:Opportunity {id: opp.id})
          SET o.title = opp.title,
              o.slug = opp.slug,
              o.type = opp.type,
              o.contract_type = opp.contract_type,
              o.status = opp.status,
              o.deadline = opp.deadline,
              o.salary_min = opp.salary_min,
              o.salary_max = opp.salary_max,
              o.location_type = opp.location_type,
              o.city = opp.city,
              o.country = opp.country

          // Create relationship to organization
          WITH o, opp
          WHERE opp.organization_id IS NOT NULL
          MATCH (org:Organization {id: opp.organization_id})
          MERGE (o)-[:PUBLIE_PAR]->(org)
          `,
          { opps: batch }
        );

        count += batch.length;
      }

      logger.info(`[GraphSync] Synced ${count} opportunities`);
    } catch (error: any) {
      errors.push(`Opportunities sync error: ${error.message}`);
    }

    return { count, errors };
  },

  /**
   * Sync communities from PostgreSQL
   */
  async syncCommunities(
    batchSize: number
  ): Promise<{ count: number; errors: string[] }> {
    const errors: string[] = [];
    let count = 0;

    try {
      const { rows: communities } = await pool.query(`
        SELECT c.id, c.name, c.slug, c.type, c.sectors, c.is_paid,
               c.organization_id,
               (SELECT COUNT(*) FROM community_members cm
                WHERE cm.community_id = c.id AND cm.status = 'ACTIVE') as member_count
        FROM communities c
        WHERE c.deleted_at IS NULL
      `);

      for (let i = 0; i < communities.length; i += batchSize) {
        const batch = communities.slice(i, i + batchSize).map(c => ({
          ...c,
          sectors: c.sectors ? (typeof c.sectors === 'string' ? JSON.parse(c.sectors) : c.sectors) : [],
          member_count: parseInt(c.member_count) || 0,
        }));

        await neo4jClient.write(
          `
          UNWIND $communities AS comm
          MERGE (c:Community {id: comm.id})
          SET c.name = comm.name,
              c.slug = comm.slug,
              c.type = comm.type,
              c.sectors = comm.sectors,
              c.is_paid = comm.is_paid,
              c.member_count = comm.member_count

          // Create relationship to organization if exists
          WITH c, comm
          WHERE comm.organization_id IS NOT NULL
          MATCH (org:Organization {id: comm.organization_id})
          MERGE (c)-[:APPARTIENT_A]->(org)
          `,
          { communities: batch }
        );

        count += batch.length;
      }

      logger.info(`[GraphSync] Synced ${count} communities`);
    } catch (error: any) {
      errors.push(`Communities sync error: ${error.message}`);
    }

    return { count, errors };
  },

  /**
   * Sync spaces from PostgreSQL
   */
  async syncSpaces(
    batchSize: number
  ): Promise<{ count: number; errors: string[] }> {
    const errors: string[] = [];
    let count = 0;

    try {
      const { rows: spaces } = await pool.query(`
        SELECT id, name, slug, type, capacity,
               hourly_rate, daily_rate, city, country, organization_id
        FROM spaces
        WHERE deleted_at IS NULL
      `);

      for (let i = 0; i < spaces.length; i += batchSize) {
        const batch = spaces.slice(i, i + batchSize).map(s => ({
          ...s,
          hourly_rate: s.hourly_rate ? parseFloat(s.hourly_rate) : null,
          daily_rate: s.daily_rate ? parseFloat(s.daily_rate) : null,
        }));

        await neo4jClient.write(
          `
          UNWIND $spaces AS space
          MERGE (s:Space {id: space.id})
          SET s.name = space.name,
              s.slug = space.slug,
              s.type = space.type,
              s.capacity = space.capacity,
              s.hourly_rate = space.hourly_rate,
              s.daily_rate = space.daily_rate,
              s.city = space.city,
              s.country = space.country

          WITH s, space
          WHERE space.organization_id IS NOT NULL
          MATCH (org:Organization {id: space.organization_id})
          MERGE (org)-[:HEBERGE]->(s)
          `,
          { spaces: batch }
        );

        count += batch.length;
      }

      logger.info(`[GraphSync] Synced ${count} spaces`);
    } catch (error: any) {
      errors.push(`Spaces sync error: ${error.message}`);
    }

    return { count, errors };
  },

  /**
   * Sync learning topics from PostgreSQL
   */
  async syncLearningTopics(
    batchSize: number
  ): Promise<{ count: number; errors: string[] }> {
    const errors: string[] = [];
    let count = 0;

    try {
      const { rows: topics } = await pool.query(`
        SELECT id, talent_id, topic_name as name, topic_slug as slug,
               mastery_level, first_studied_at, last_studied_at
        FROM learning_topics
      `);

      for (let i = 0; i < topics.length; i += batchSize) {
        const batch = topics.slice(i, i + batchSize).map(t => ({
          ...t,
          first_studied_at: t.first_studied_at?.toISOString(),
          last_studied_at: t.last_studied_at?.toISOString(),
        }));

        await neo4jClient.write(
          `
          UNWIND $topics AS topic
          MERGE (lt:LearningTopic {id: topic.id})
          SET lt.name = topic.name,
              lt.slug = topic.slug,
              lt.mastery_level = topic.mastery_level,
              lt.first_studied_at = topic.first_studied_at,
              lt.last_studied_at = topic.last_studied_at
          `,
          { topics: batch }
        );

        count += batch.length;
      }

      logger.info(`[GraphSync] Synced ${count} learning topics`);
    } catch (error: any) {
      errors.push(`Learning topics sync error: ${error.message}`);
    }

    return { count, errors };
  },

  /**
   * Sync documents from PostgreSQL
   */
  async syncDocuments(
    batchSize: number
  ): Promise<{ count: number; errors: string[] }> {
    const errors: string[] = [];
    let count = 0;

    try {
      // Try the new talent_documents table first, fall back to old structure
      let docsResult;
      try {
        docsResult = await pool.query(`
          SELECT d.id, d.talent_id, d.document_type as type,
                 d.original_filename as filename, d.title,
                 d.uploaded_at, d.is_verified
          FROM talent_documents d
          WHERE d.deleted_at IS NULL
        `);
      } catch {
        // No documents table available
        docsResult = { rows: [] };
      }

      const docs = docsResult.rows;

      for (let i = 0; i < docs.length; i += batchSize) {
        const batch = docs.slice(i, i + batchSize).map(d => ({
          ...d,
          uploaded_at: d.uploaded_at?.toISOString(),
          extracted_skills: d.extracted_skills
            ? typeof d.extracted_skills === 'string'
              ? JSON.parse(d.extracted_skills)
              : d.extracted_skills
            : [],
        }));

        await neo4jClient.write(
          `
          UNWIND $docs AS doc
          MERGE (d:Document {id: doc.id})
          SET d.type = doc.type,
              d.filename = doc.filename,
              d.title = doc.title,
              d.extracted_skills = doc.extracted_skills,
              d.uploaded_at = doc.uploaded_at,
              d.is_verified = doc.is_verified
          `,
          { docs: batch }
        );

        count += batch.length;
      }

      logger.info(`[GraphSync] Synced ${count} documents`);
    } catch (error: any) {
      errors.push(`Documents sync error: ${error.message}`);
    }

    return { count, errors };
  },

  /**
   * Sync talent-skill relationships (skills are now inline in talent_skills)
   */
  async syncTalentSkills(
    batchSize: number
  ): Promise<{ count: number; errors: string[] }> {
    const errors: string[] = [];
    let count = 0;

    try {
      const { rows: relations } = await pool.query(`
        SELECT ts.talent_id, ts.canonical_name, ts.type, ts.proficiency_level
        FROM talent_skills ts
        JOIN talents t ON ts.talent_id = t.id AND t.deleted_at IS NULL
      `);

      for (let i = 0; i < relations.length; i += batchSize) {
        const batch = relations.slice(i, i + batchSize);

        await neo4jClient.write(
          `
          UNWIND $relations AS rel
          MATCH (t:Talent {id: rel.talent_id})
          MERGE (s:Skill {canonical_name: rel.canonical_name})
          ON CREATE SET s.type = rel.type
          MERGE (t)-[r:POSSEDE_COMPETENCE]->(s)
          SET r.proficiency_level = rel.proficiency_level
          `,
          { relations: batch }
        );

        count += batch.length;
      }

      logger.info(`[GraphSync] Synced ${count} talent-skill relationships`);
    } catch (error: any) {
      errors.push(`Talent-skills sync error: ${error.message}`);
    }

    return { count, errors };
  },

  /**
   * Sync work experiences — table removed in migration 051
   */
  async syncExperiences(
    _batchSize: number
  ): Promise<{ count: number; errors: string[] }> {
    return { count: 0, errors: [] };
  },

  /**
   * Sync education records — table removed in migration 051
   */
  async syncEducations(
    _batchSize: number
  ): Promise<{ count: number; errors: string[] }> {
    return { count: 0, errors: [] };
  },

  /**
   * Sync job applications (talent-opportunity)
   */
  async syncApplications(
    batchSize: number
  ): Promise<{ count: number; errors: string[] }> {
    const errors: string[] = [];
    let count = 0;

    try {
      const { rows: applications } = await pool.query(`
        SELECT oa.talent_id, oa.opportunity_id, oa.status,
               oa.applied_at, oa.cv_url
        FROM opportunity_applications oa
        JOIN talents t ON oa.talent_id = t.id AND t.deleted_at IS NULL
        JOIN opportunities o ON oa.opportunity_id = o.id AND o.deleted_at IS NULL
      `);

      for (let i = 0; i < applications.length; i += batchSize) {
        const batch = applications.slice(i, i + batchSize).map(a => ({
          ...a,
          applied_at: a.applied_at?.toISOString(),
        }));

        await neo4jClient.write(
          `
          UNWIND $applications AS app
          MATCH (t:Talent {id: app.talent_id})
          MATCH (o:Opportunity {id: app.opportunity_id})
          MERGE (t)-[r:A_POSTULE_A]->(o)
          SET r.status = app.status,
              r.applied_at = app.applied_at,
              r.cv_id = app.cv_url
          `,
          { applications: batch }
        );

        count += batch.length;
      }

      logger.info(`[GraphSync] Synced ${count} applications`);
    } catch (error: any) {
      errors.push(`Applications sync error: ${error.message}`);
    }

    return { count, errors };
  },

  /**
   * Sync community memberships
   */
  async syncCommunityMemberships(
    batchSize: number
  ): Promise<{ count: number; errors: string[] }> {
    const errors: string[] = [];
    let count = 0;

    try {
      const { rows: memberships } = await pool.query(`
        SELECT cm.talent_id, cm.community_id, cm.role,
               cm.joined_at, cm.is_active
        FROM community_members cm
        JOIN talents t ON cm.talent_id = t.id AND t.deleted_at IS NULL
        JOIN communities c ON cm.community_id = c.id AND c.deleted_at IS NULL
        WHERE cm.status = 'ACTIVE'
      `);

      for (let i = 0; i < memberships.length; i += batchSize) {
        const batch = memberships.slice(i, i + batchSize).map(m => ({
          ...m,
          joined_at: m.joined_at?.toISOString(),
        }));

        await neo4jClient.write(
          `
          UNWIND $memberships AS mem
          MATCH (t:Talent {id: mem.talent_id})
          MATCH (c:Community {id: mem.community_id})
          MERGE (t)-[r:EST_MEMBRE_DE]->(c)
          SET r.role = mem.role,
              r.joined_at = mem.joined_at,
              r.is_active = mem.is_active
          `,
          { memberships: batch }
        );

        count += batch.length;
      }

      logger.info(`[GraphSync] Synced ${count} community memberships`);
    } catch (error: any) {
      errors.push(`Memberships sync error: ${error.message}`);
    }

    return { count, errors };
  },

  /**
   * Sync opportunity-skill requirements — table removed in migration 053
   */
  async syncOpportunitySkills(
    _batchSize: number
  ): Promise<{ count: number; errors: string[] }> {
    return { count: 0, errors: [] };
  },

  /**
   * Sync skill-to-skill relations — tables removed
   */
  async syncSkillRelations(
    _batchSize: number
  ): Promise<{ count: number; errors: string[] }> {
    return { count: 0, errors: [] };
  },

  /**
   * Sync learning topic relations (talent-topic)
   */
  async syncLearningRelations(
    batchSize: number
  ): Promise<{ count: number; errors: string[] }> {
    const errors: string[] = [];
    let count = 0;

    try {
      const { rows: topics } = await pool.query(`
        SELECT lt.id as topic_id, lt.talent_id, lt.mastery_level,
               lt.first_studied_at as started_at, lt.last_studied_at,
               lt.current_streak_days as streak_days,
               COALESCE(
                 (SELECT SUM(duration_minutes) FROM learning_sessions
                  WHERE topic_id = lt.id), 0
               ) as total_time_minutes,
               lt.flashcards_created as flashcards_count,
               lt.quizzes_taken as quizzes_completed
        FROM learning_topics lt
        JOIN talents t ON lt.talent_id = t.id AND t.deleted_at IS NULL
      `);

      for (let i = 0; i < topics.length; i += batchSize) {
        const batch = topics.slice(i, i + batchSize).map(t => ({
          ...t,
          started_at: t.started_at?.toISOString(),
          last_studied_at: t.last_studied_at?.toISOString(),
          total_time_minutes: parseInt(t.total_time_minutes) || 0,
        }));

        await neo4jClient.write(
          `
          UNWIND $topics AS topic
          MATCH (t:Talent {id: topic.talent_id})
          MATCH (lt:LearningTopic {id: topic.topic_id})
          MERGE (t)-[r:ETUDIE_SUJET]->(lt)
          SET r.mastery_level = topic.mastery_level,
              r.started_at = topic.started_at,
              r.last_studied_at = topic.last_studied_at,
              r.streak_days = topic.streak_days,
              r.total_time_minutes = topic.total_time_minutes,
              r.flashcards_count = topic.flashcards_count,
              r.quizzes_completed = topic.quizzes_completed
          `,
          { topics: batch }
        );

        count += batch.length;
      }

      // Sync document ownership
      const { rows: talentDocs } = await pool.query(`
        SELECT td.talent_id, td.id as document_id, td.uploaded_at, td.is_verified
        FROM talent_documents td
        JOIN talents t ON td.talent_id = t.id AND t.deleted_at IS NULL
        WHERE td.deleted_at IS NULL
      `);

      for (let i = 0; i < talentDocs.length; i += batchSize) {
        const batch = talentDocs.slice(i, i + batchSize).map(d => ({
          ...d,
          uploaded_at: d.uploaded_at?.toISOString(),
        }));

        await neo4jClient.write(
          `
          UNWIND $docs AS doc
          MATCH (t:Talent {id: doc.talent_id})
          MATCH (d:Document {id: doc.document_id})
          MERGE (t)-[r:POSSEDE_DOCUMENT]->(d)
          SET r.uploaded_at = doc.uploaded_at,
              r.is_verified = doc.is_verified
          `,
          { docs: batch }
        );

        count += talentDocs.length;
      }

      logger.info(`[GraphSync] Synced ${count} learning relations`);
    } catch (error: any) {
      errors.push(`Learning relations sync error: ${error.message}`);
    }

    return { count, errors };
  },

  /**
   * Sync projects — table removed in migration 040
   */
  async syncProjects(
    _batchSize: number
  ): Promise<{ count: number; errors: string[] }> {
    return { count: 0, errors: [] };
  },

  /**
   * Sync sectors as proper nodes from organization/community sector arrays
   */
  async syncSectors(
    batchSize: number
  ): Promise<{ count: number; errors: string[] }> {
    const errors: string[] = [];
    let count = 0;

    try {
      // Extract unique sectors from organizations and communities
      const { rows: sectorRows } = await pool.query(`
        SELECT DISTINCT unnest(sectors) as name
        FROM (
          SELECT sectors FROM organizations WHERE deleted_at IS NULL AND sectors IS NOT NULL
          UNION ALL
          SELECT sectors FROM communities WHERE deleted_at IS NULL AND sectors IS NOT NULL
        ) sub
        WHERE unnest(sectors) IS NOT NULL
      `);

      if (sectorRows.length > 0) {
        const sectors = sectorRows.map(r => ({
          name: r.name,
          slug: r.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        }));

        for (let i = 0; i < sectors.length; i += batchSize) {
          const batch = sectors.slice(i, i + batchSize);

          await neo4jClient.write(
            `
            UNWIND $sectors AS sector
            MERGE (s:Sector {name: sector.name})
            SET s.slug = sector.slug
            `,
            { sectors: batch }
          );

          count += batch.length;
        }
      }

      logger.info(`[GraphSync] Synced ${count} sectors`);
    } catch (error: any) {
      errors.push(`Sectors sync error: ${error.message}`);
    }

    return { count, errors };
  },

  /**
   * Sync talent connections (CONNECTE_AVEC)
   */
  async syncConnections(
    batchSize: number
  ): Promise<{ count: number; errors: string[] }> {
    const errors: string[] = [];
    let count = 0;

    try {
      const { rows: connections } = await pool.query(`
        SELECT c.from_talent_id, c.to_talent_id, c.relationship_type,
               c.connected_at
        FROM connections c
        JOIN talents t1 ON c.from_talent_id = t1.id AND t1.deleted_at IS NULL
        JOIN talents t2 ON c.to_talent_id = t2.id AND t2.deleted_at IS NULL
      `);

      for (let i = 0; i < connections.length; i += batchSize) {
        const batch = connections.slice(i, i + batchSize).map(c => ({
          ...c,
          connected_at: c.connected_at?.toISOString(),
        }));

        await neo4jClient.write(
          `
          UNWIND $connections AS conn
          MATCH (t1:Talent {id: conn.from_talent_id})
          MATCH (t2:Talent {id: conn.to_talent_id})
          MERGE (t1)-[r:CONNECTE_AVEC]->(t2)
          SET r.relationship_type = conn.relationship_type,
              r.connected_at = conn.connected_at
          `,
          { connections: batch }
        );

        count += batch.length;
      }

      logger.info(`[GraphSync] Synced ${count} connections`);
    } catch (error: any) {
      errors.push(`Connections sync error: ${error.message}`);
    }

    return { count, errors };
  },

  /**
   * Sync mentorships (MENTOR_DE)
   */
  async syncMentorships(
    batchSize: number
  ): Promise<{ count: number; errors: string[] }> {
    const errors: string[] = [];
    let count = 0;

    try {
      const { rows: mentorships } = await pool.query(`
        SELECT m.mentor_id, m.mentee_id, m.status, m.started_at, m.ended_at,
               '{}' as focus_areas
        FROM mentorships m
        JOIN talents t1 ON m.mentor_id = t1.id AND t1.deleted_at IS NULL
        JOIN talents t2 ON m.mentee_id = t2.id AND t2.deleted_at IS NULL
      `);

      for (let i = 0; i < mentorships.length; i += batchSize) {
        const batch = mentorships.slice(i, i + batchSize).map(m => ({
          ...m,
          started_at: m.started_at?.toISOString(),
          ended_at: m.ended_at?.toISOString(),
        }));

        await neo4jClient.write(
          `
          UNWIND $mentorships AS m
          MATCH (mentor:Talent {id: m.mentor_id})
          MATCH (mentee:Talent {id: m.mentee_id})
          MERGE (mentor)-[r:MENTOR_DE]->(mentee)
          SET r.focus_areas = m.focus_areas,
              r.started_at = m.started_at,
              r.status = m.status
          `,
          { mentorships: batch }
        );

        count += batch.length;
      }

      logger.info(`[GraphSync] Synced ${count} mentorships`);
    } catch (error: any) {
      errors.push(`Mentorships sync error: ${error.message}`);
    }

    return { count, errors };
  },

  /**
   * Sync recommendations (RECOMMANDE_PAR)
   */
  async syncRecommendations(
    batchSize: number
  ): Promise<{ count: number; errors: string[] }> {
    const errors: string[] = [];
    let count = 0;

    try {
      const { rows: recs } = await pool.query(`
        SELECT r.recommender_id, r.recommended_id, r.recommendation_text,
               r.relationship as relationship_context, r.created_at,
               '{}' as highlighted_skills
        FROM recommendations r
        JOIN talents t1 ON r.recommender_id = t1.id AND t1.deleted_at IS NULL
        JOIN talents t2 ON r.recommended_id = t2.id AND t2.deleted_at IS NULL
      `);

      for (let i = 0; i < recs.length; i += batchSize) {
        const batch = recs.slice(i, i + batchSize).map(r => ({
          ...r,
          created_at: r.created_at?.toISOString(),
        }));

        await neo4jClient.write(
          `
          UNWIND $recs AS rec
          MATCH (recommender:Talent {id: rec.recommender_id})
          MATCH (recommended:Talent {id: rec.recommended_id})
          MERGE (recommended)-[r:RECOMMANDE_PAR]->(recommender)
          SET r.recommendation_text = rec.recommendation_text,
              r.highlighted_skills = rec.highlighted_skills,
              r.recommended_at = rec.created_at,
              r.relationship_context = rec.relationship_context
          `,
          { recs: batch }
        );

        count += batch.length;
      }

      logger.info(`[GraphSync] Synced ${count} recommendations`);
    } catch (error: any) {
      errors.push(`Recommendations sync error: ${error.message}`);
    }

    return { count, errors };
  },

  /**
   * Sync opportunity bookmarks (A_MIS_EN_FAVORIS)
   */
  async syncBookmarks(
    batchSize: number
  ): Promise<{ count: number; errors: string[] }> {
    const errors: string[] = [];
    let count = 0;

    try {
      const { rows: bookmarks } = await pool.query(`
        SELECT ob.talent_id, ob.opportunity_id, ob.created_at, ob.notes
        FROM opportunity_bookmarks ob
        JOIN talents t ON ob.talent_id = t.id AND t.deleted_at IS NULL
        JOIN opportunities o ON ob.opportunity_id = o.id AND o.deleted_at IS NULL
      `);

      for (let i = 0; i < bookmarks.length; i += batchSize) {
        const batch = bookmarks.slice(i, i + batchSize).map(b => ({
          ...b,
          created_at: b.created_at?.toISOString(),
        }));

        await neo4jClient.write(
          `
          UNWIND $bookmarks AS bm
          MATCH (t:Talent {id: bm.talent_id})
          MATCH (o:Opportunity {id: bm.opportunity_id})
          MERGE (t)-[r:A_MIS_EN_FAVORIS]->(o)
          SET r.created_at = bm.created_at,
              r.notes = bm.notes
          `,
          { bookmarks: batch }
        );

        count += batch.length;
      }

      logger.info(`[GraphSync] Synced ${count} bookmarks`);
    } catch (error: any) {
      errors.push(`Bookmarks sync error: ${error.message}`);
    }

    return { count, errors };
  },

  /**
   * Sync space bookings (A_RESERVE)
   */
  async syncSpaceBookings(
    batchSize: number
  ): Promise<{ count: number; errors: string[] }> {
    const errors: string[] = [];
    let count = 0;

    try {
      const { rows: bookings } = await pool.query(`
        SELECT sb.talent_id, sb.space_id, sb.start_datetime, sb.end_datetime,
               sb.status, sb.total_amount as total_price
        FROM space_bookings sb
        JOIN talents t ON sb.talent_id = t.id AND t.deleted_at IS NULL
        JOIN spaces s ON sb.space_id = s.id AND s.deleted_at IS NULL
        WHERE sb.talent_id IS NOT NULL
      `);

      for (let i = 0; i < bookings.length; i += batchSize) {
        const batch = bookings.slice(i, i + batchSize).map(b => ({
          ...b,
          date: b.start_datetime?.toISOString()?.split('T')[0],
          start_time: b.start_datetime?.toISOString(),
          end_time: b.end_datetime?.toISOString(),
          total_price: b.total_price ? parseFloat(b.total_price) : null,
        }));

        await neo4jClient.write(
          `
          UNWIND $bookings AS bk
          MATCH (t:Talent {id: bk.talent_id})
          MATCH (s:Space {id: bk.space_id})
          MERGE (t)-[r:A_RESERVE]->(s)
          SET r.date = bk.date,
              r.start_time = bk.start_time,
              r.end_time = bk.end_time,
              r.status = bk.status,
              r.total_price = bk.total_price
          `,
          { bookings: batch }
        );

        count += batch.length;
      }

      logger.info(`[GraphSync] Synced ${count} space bookings`);
    } catch (error: any) {
      errors.push(`Space bookings sync error: ${error.message}`);
    }

    return { count, errors };
  },

  /**
   * Sync document-skill relationships — table removed in migration 053
   */
  async syncDocumentSkills(
    _batchSize: number
  ): Promise<{ count: number; errors: string[] }> {
    return { count: 0, errors: [] };
  },

  /**
   * Sync organization-skill relationships — table removed in migration 053
   */
  async syncOrganizationSkills(
    _batchSize: number
  ): Promise<{ count: number; errors: string[] }> {
    return { count: 0, errors: [] };
  },

  /**
   * Sync project-skill relationships — table removed in migration 053
   */
  async syncProjectSkills(
    _batchSize: number
  ): Promise<{ count: number; errors: string[] }> {
    return { count: 0, errors: [] };
  },

  /**
   * Sync sector relationships (Organization/Community → Sector via DANS_SECTEUR)
   */
  async syncSectorRelations(
    batchSize: number
  ): Promise<{ count: number; errors: string[] }> {
    const errors: string[] = [];
    let count = 0;

    try {
      // Organizations → Sectors
      const { rows: orgSectors } = await pool.query(`
        SELECT o.id as entity_id, unnest(o.sectors) as sector_name, 'Organization' as label
        FROM organizations o
        WHERE o.deleted_at IS NULL AND o.sectors IS NOT NULL
      `);

      for (let i = 0; i < orgSectors.length; i += batchSize) {
        const batch = orgSectors.slice(i, i + batchSize);

        await neo4jClient.write(
          `
          UNWIND $rels AS rel
          MATCH (o:Organization {id: rel.entity_id})
          MATCH (s:Sector {name: rel.sector_name})
          MERGE (o)-[:DANS_SECTEUR]->(s)
          `,
          { rels: batch }
        );

        count += batch.length;
      }

      // Communities → Sectors
      const { rows: commSectors } = await pool.query(`
        SELECT c.id as entity_id, unnest(c.sectors) as sector_name
        FROM communities c
        WHERE c.deleted_at IS NULL AND c.sectors IS NOT NULL
      `);

      for (let i = 0; i < commSectors.length; i += batchSize) {
        const batch = commSectors.slice(i, i + batchSize);

        await neo4jClient.write(
          `
          UNWIND $rels AS rel
          MATCH (c:Community {id: rel.entity_id})
          MATCH (s:Sector {name: rel.sector_name})
          MERGE (c)-[:DANS_SECTEUR]->(s)
          `,
          { rels: batch }
        );

        count += batch.length;
      }

      logger.info(`[GraphSync] Synced ${count} sector relations`);
    } catch (error: any) {
      errors.push(`Sector relations sync error: ${error.message}`);
    }

    return { count, errors };
  },

  /**
   * Sync a single talent (for real-time updates)
   */
  async syncTalent(talentId: string): Promise<void> {
    const { rows: [talent] } = await pool.query(
      `SELECT id, COALESCE(first_name || ' ' || last_name, email) as name, email, bio as headline,
              city, country, goals, created_at, updated_at
       FROM talents WHERE id = $1`,
      [talentId]
    );

    if (!talent) return;

    await neo4jClient.write(
      `
      MERGE (t:Talent {id: $id})
      SET t.name = $name,
          t.email = $email,
          t.headline = $headline,
          t.city = $city,
          t.country = $country,
          t.goals = $goals,
          t.created_at = $created_at,
          t.updated_at = $updated_at
      `,
      {
        id: talent.id,
        name: talent.name,
        email: talent.email,
        headline: talent.headline,
        city: talent.city,
        country: talent.country,
        goals: talent.goals,
        created_at: talent.created_at?.toISOString(),
        updated_at: talent.updated_at?.toISOString(),
      }
    );
  },

  /**
   * Delete a talent from the graph
   */
  async deleteTalent(talentId: string): Promise<void> {
    await neo4jClient.write(
      `MATCH (t:Talent {id: $talentId}) DETACH DELETE t`,
      { talentId }
    );
  },
};
