/**
 * PostgreSQL to Neo4j Sync Service
 *
 * Synchronizes data from PostgreSQL to Neo4j graph database
 */

import { pool } from '../../database';
import { neo4jClient } from '../neo4j.client';
import { NodeLabels, RelationshipTypes } from '../ontology';

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

    console.log('[GraphSync] Starting full sync...');

    try {
      // Sync nodes in order (dependencies first)
      const skillsResult = await this.syncSkills(batchSize);
      nodesCreated += skillsResult.count;
      errors.push(...skillsResult.errors);

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

      const oppSkillsRel = await this.syncOpportunitySkills(batchSize);
      relationshipsCreated += oppSkillsRel.count;
      errors.push(...oppSkillsRel.errors);

      const skillRelationsRel = await this.syncSkillRelations(batchSize);
      relationshipsCreated += skillRelationsRel.count;
      errors.push(...skillRelationsRel.errors);

      const learningRel = await this.syncLearningRelations(batchSize);
      relationshipsCreated += learningRel.count;
      errors.push(...learningRel.errors);

      console.log(
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
      console.error('[GraphSync] Full sync failed:', error);
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
   * Sync skills from PostgreSQL
   */
  async syncSkills(
    batchSize: number
  ): Promise<{ count: number; errors: string[] }> {
    const errors: string[] = [];
    let count = 0;

    try {
      const { rows: skills } = await pool.query(`
        SELECT id, canonical_name, slug, type, domain, aliases
        FROM skills
        WHERE deleted_at IS NULL
      `);

      for (let i = 0; i < skills.length; i += batchSize) {
        const batch = skills.slice(i, i + batchSize);

        await neo4jClient.write(
          `
          UNWIND $skills AS skill
          MERGE (s:Skill {id: skill.id})
          SET s.canonical_name = skill.canonical_name,
              s.slug = skill.slug,
              s.type = skill.type,
              s.domain = skill.domain,
              s.aliases = skill.aliases
          `,
          { skills: batch }
        );

        count += batch.length;
      }

      console.log(`[GraphSync] Synced ${count} skills`);
    } catch (error: any) {
      errors.push(`Skills sync error: ${error.message}`);
    }

    return { count, errors };
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
        SELECT id, name, slug, type, sectors, size,
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
              o.type = org.type,
              o.sectors = org.sectors,
              o.size = org.size,
              o.city = org.city,
              o.country = org.country
          `,
          { orgs: batch }
        );

        count += batch.length;
      }

      console.log(`[GraphSync] Synced ${count} organizations`);
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
        SELECT id, display_name as name, email, bio as headline,
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

      console.log(`[GraphSync] Synced ${count} talents`);
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

      console.log(`[GraphSync] Synced ${count} opportunities`);
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

      console.log(`[GraphSync] Synced ${count} communities`);
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
               hourly_rate, daily_rate, city, country
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
          `,
          { spaces: batch }
        );

        count += batch.length;
      }

      console.log(`[GraphSync] Synced ${count} spaces`);
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

      console.log(`[GraphSync] Synced ${count} learning topics`);
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
                 d.extracted_data->>'skills' as extracted_skills,
                 d.uploaded_at, d.is_verified
          FROM talent_documents d
          WHERE d.deleted_at IS NULL
        `);
      } catch {
        // Fall back to old documents table
        docsResult = await pool.query(`
          SELECT d.id, td.talent_id, d.type, d.title as filename, d.title,
                 d.summary as extracted_skills, d.created_at as uploaded_at,
                 (d.verification_status = 'VERIFIED') as is_verified
          FROM documents d
          JOIN talent_documents td ON d.id = td.document_id
          WHERE d.deleted_at IS NULL
        `);
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

      console.log(`[GraphSync] Synced ${count} documents`);
    } catch (error: any) {
      errors.push(`Documents sync error: ${error.message}`);
    }

    return { count, errors };
  },

  /**
   * Sync talent-skill relationships
   */
  async syncTalentSkills(
    batchSize: number
  ): Promise<{ count: number; errors: string[] }> {
    const errors: string[] = [];
    let count = 0;

    try {
      const { rows: relations } = await pool.query(`
        SELECT ts.talent_id, ts.skill_id, ts.proficiency_level,
               ts.years_of_experience, ts.endorsed_count,
               ts.self_assessed as verified
        FROM talent_skills ts
        JOIN talents t ON ts.talent_id = t.id AND t.deleted_at IS NULL
        JOIN skills s ON ts.skill_id = s.id AND s.deleted_at IS NULL
      `);

      for (let i = 0; i < relations.length; i += batchSize) {
        const batch = relations.slice(i, i + batchSize).map(r => ({
          ...r,
          years_experience: r.years_of_experience
            ? parseFloat(r.years_of_experience)
            : null,
          verified: !r.verified, // self_assessed = false means verified by document
        }));

        await neo4jClient.write(
          `
          UNWIND $relations AS rel
          MATCH (t:Talent {id: rel.talent_id})
          MATCH (s:Skill {id: rel.skill_id})
          MERGE (t)-[r:POSSEDE_COMPETENCE]->(s)
          SET r.proficiency_level = rel.proficiency_level,
              r.years_experience = rel.years_experience,
              r.endorsed_count = rel.endorsed_count,
              r.verified = rel.verified
          `,
          { relations: batch }
        );

        count += batch.length;
      }

      console.log(`[GraphSync] Synced ${count} talent-skill relationships`);
    } catch (error: any) {
      errors.push(`Talent-skills sync error: ${error.message}`);
    }

    return { count, errors };
  },

  /**
   * Sync work experiences (talent-organization)
   */
  async syncExperiences(
    batchSize: number
  ): Promise<{ count: number; errors: string[] }> {
    const errors: string[] = [];
    let count = 0;

    try {
      const { rows: experiences } = await pool.query(`
        SELECT te.talent_id, te.organization_id, te.job_title,
               te.started_at, te.ended_at, te.is_current
        FROM talent_experiences te
        JOIN talents t ON te.talent_id = t.id AND t.deleted_at IS NULL
        JOIN organizations o ON te.organization_id = o.id AND o.deleted_at IS NULL
      `);

      for (let i = 0; i < experiences.length; i += batchSize) {
        const batch = experiences.slice(i, i + batchSize).map(e => ({
          ...e,
          started_at: e.started_at?.toISOString(),
          ended_at: e.ended_at?.toISOString(),
        }));

        await neo4jClient.write(
          `
          UNWIND $experiences AS exp
          MATCH (t:Talent {id: exp.talent_id})
          MATCH (o:Organization {id: exp.organization_id})

          FOREACH (_ IN CASE WHEN exp.is_current THEN [1] ELSE [] END |
            MERGE (t)-[r:TRAVAILLE_CHEZ]->(o)
            SET r.job_title = exp.job_title,
                r.started_at = exp.started_at,
                r.is_current = true
          )

          FOREACH (_ IN CASE WHEN NOT exp.is_current THEN [1] ELSE [] END |
            MERGE (t)-[r:A_TRAVAILLE_CHEZ]->(o)
            SET r.job_title = exp.job_title,
                r.started_at = exp.started_at,
                r.ended_at = exp.ended_at
          )
          `,
          { experiences: batch }
        );

        count += batch.length;
      }

      console.log(`[GraphSync] Synced ${count} work experiences`);
    } catch (error: any) {
      errors.push(`Experiences sync error: ${error.message}`);
    }

    return { count, errors };
  },

  /**
   * Sync education records (talent-organization)
   */
  async syncEducations(
    batchSize: number
  ): Promise<{ count: number; errors: string[] }> {
    const errors: string[] = [];
    let count = 0;

    try {
      const { rows: educations } = await pool.query(`
        SELECT te.talent_id, te.organization_id, te.degree_type,
               te.field_of_study, te.started_at, te.ended_at, te.graduated
        FROM talent_educations te
        JOIN talents t ON te.talent_id = t.id AND t.deleted_at IS NULL
        JOIN organizations o ON te.organization_id = o.id AND o.deleted_at IS NULL
      `);

      for (let i = 0; i < educations.length; i += batchSize) {
        const batch = educations.slice(i, i + batchSize).map(e => ({
          ...e,
          started_at: e.started_at?.toISOString(),
          ended_at: e.ended_at?.toISOString(),
        }));

        await neo4jClient.write(
          `
          UNWIND $educations AS edu
          MATCH (t:Talent {id: edu.talent_id})
          MATCH (o:Organization {id: edu.organization_id})
          MERGE (t)-[r:A_ETUDIE_A]->(o)
          SET r.degree_type = edu.degree_type,
              r.field_of_study = edu.field_of_study,
              r.started_at = edu.started_at,
              r.ended_at = edu.ended_at,
              r.graduated = edu.graduated
          `,
          { educations: batch }
        );

        count += batch.length;
      }

      console.log(`[GraphSync] Synced ${count} educations`);
    } catch (error: any) {
      errors.push(`Educations sync error: ${error.message}`);
    }

    return { count, errors };
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

      console.log(`[GraphSync] Synced ${count} applications`);
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

      console.log(`[GraphSync] Synced ${count} community memberships`);
    } catch (error: any) {
      errors.push(`Memberships sync error: ${error.message}`);
    }

    return { count, errors };
  },

  /**
   * Sync opportunity-skill requirements
   */
  async syncOpportunitySkills(
    batchSize: number
  ): Promise<{ count: number; errors: string[] }> {
    const errors: string[] = [];
    let count = 0;

    try {
      const { rows: oppSkills } = await pool.query(`
        SELECT os.opportunity_id, os.skill_id, os.is_required,
               os.proficiency_level
        FROM opportunity_skills os
        JOIN opportunities o ON os.opportunity_id = o.id AND o.deleted_at IS NULL
        JOIN skills s ON os.skill_id = s.id AND s.deleted_at IS NULL
      `);

      for (let i = 0; i < oppSkills.length; i += batchSize) {
        const batch = oppSkills.slice(i, i + batchSize);

        await neo4jClient.write(
          `
          UNWIND $oppSkills AS os
          MATCH (o:Opportunity {id: os.opportunity_id})
          MATCH (s:Skill {id: os.skill_id})
          MERGE (o)-[r:REQUIERT_COMPETENCE]->(s)
          SET r.is_mandatory = os.is_required,
              r.level_required = os.proficiency_level
          `,
          { oppSkills: batch }
        );

        count += batch.length;
      }

      console.log(`[GraphSync] Synced ${count} opportunity-skill requirements`);
    } catch (error: any) {
      errors.push(`Opportunity skills sync error: ${error.message}`);
    }

    return { count, errors };
  },

  /**
   * Sync skill-to-skill relations (prerequisites, complementary)
   */
  async syncSkillRelations(
    batchSize: number
  ): Promise<{ count: number; errors: string[] }> {
    const errors: string[] = [];
    let count = 0;

    try {
      // Sync skill relations (COMPLEMENTAIRE_A)
      const { rows: relations } = await pool.query(`
        SELECT sr.from_skill_id, sr.to_skill_id, sr.relationship_type, sr.strength
        FROM skill_relations sr
        JOIN skills s1 ON sr.from_skill_id = s1.id AND s1.deleted_at IS NULL
        JOIN skills s2 ON sr.to_skill_id = s2.id AND s2.deleted_at IS NULL
      `);

      for (let i = 0; i < relations.length; i += batchSize) {
        const batch = relations.slice(i, i + batchSize);

        await neo4jClient.write(
          `
          UNWIND $relations AS rel
          MATCH (s1:Skill {id: rel.from_skill_id})
          MATCH (s2:Skill {id: rel.to_skill_id})
          MERGE (s1)-[r:COMPLEMENTAIRE_A]->(s2)
          SET r.synergy_score = rel.strength
          `,
          { relations: batch }
        );

        count += batch.length;
      }

      // Sync skill evolutions (PREREQUIS_POUR)
      const { rows: evolutions } = await pool.query(`
        SELECT se.from_skill_id, se.to_skill_id
        FROM skill_evolutions se
        JOIN skills s1 ON se.from_skill_id = s1.id AND s1.deleted_at IS NULL
        JOIN skills s2 ON se.to_skill_id = s2.id AND s2.deleted_at IS NULL
      `);

      for (let i = 0; i < evolutions.length; i += batchSize) {
        const batch = evolutions.slice(i, i + batchSize);

        await neo4jClient.write(
          `
          UNWIND $evolutions AS evo
          MATCH (s1:Skill {id: evo.from_skill_id})
          MATCH (s2:Skill {id: evo.to_skill_id})
          MERGE (s1)-[r:PREREQUIS_POUR]->(s2)
          SET r.is_strict = true
          `,
          { evolutions: batch }
        );

        count += batch.length;
      }

      console.log(`[GraphSync] Synced ${count} skill relations`);
    } catch (error: any) {
      errors.push(`Skill relations sync error: ${error.message}`);
    }

    return { count, errors };
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

      console.log(`[GraphSync] Synced ${count} learning relations`);
    } catch (error: any) {
      errors.push(`Learning relations sync error: ${error.message}`);
    }

    return { count, errors };
  },

  /**
   * Sync a single talent (for real-time updates)
   */
  async syncTalent(talentId: string): Promise<void> {
    const { rows: [talent] } = await pool.query(
      `SELECT id, display_name as name, email, bio as headline,
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
