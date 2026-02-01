/**
 * Profile Tools for Copilot
 * Tools for accessing and analyzing talent profile information
 */

import { z } from 'zod';
import { pool } from '../../database';

// ═══════════════════════════════════════════════════════════════
// GET TALENT PROFILE
// ═══════════════════════════════════════════════════════════════

export const getTalentProfileSchema = z.object({
  includeSkills: z.boolean().default(true).describe('Inclure les compétences'),
  includeExperiences: z.boolean().default(true).describe('Inclure les expériences professionnelles'),
  includeEducation: z.boolean().default(false).describe('Inclure la formation'),
  includeProjects: z.boolean().default(false).describe('Inclure les projets'),
});

export type GetTalentProfileParams = z.infer<typeof getTalentProfileSchema>;

export interface TalentProfile {
  id: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  email: string;
  phone?: string;
  city?: string;
  region?: string;
  country?: string;
  remoteReady?: boolean;
  willingToRelocate?: boolean;
  profileTags?: string[];
  goals?: string[];
  skills?: Array<{
    id: string;
    name: string;
    type: string;
    proficiencyLevel: string;
    yearsOfExperience?: number;
    endorsedCount: number;
  }>;
  experiences?: Array<{
    id: string;
    jobTitle: string;
    organizationName: string;
    workType?: string;
    startedAt: string;
    endedAt?: string;
    isCurrent: boolean;
    city?: string;
    country?: string;
    remote?: boolean;
  }>;
  education?: Array<{
    id: string;
    organizationName: string;
    degreeType?: string;
    fieldOfStudy?: string;
    startedAt?: string;
    endedAt?: string;
    graduated?: boolean;
  }>;
  projects?: Array<{
    id: string;
    title: string;
    description?: string;
    role?: string;
    url?: string;
  }>;
  summary: {
    totalExperienceYears: number;
    skillsCount: number;
    mainSectors: string[];
    mainSkillDomains: string[];
  };
}

export async function getTalentProfile(
  params: GetTalentProfileParams,
  context: { talentId: string }
): Promise<TalentProfile> {
  const { includeSkills, includeExperiences, includeEducation, includeProjects } = params;
  const { talentId } = context;

  // Get base talent info
  const talentResult = await pool.query(
    `
    SELECT
      t.id, t.display_name, t.bio, t.avatar_url, t.email, t.phone,
      t.city, t.region, t.country, t.remote_ready, t.willing_to_relocate,
      t.profile_tags, t.goals
    FROM talents t
    WHERE t.id = $1 AND t.deleted_at IS NULL
  `,
    [talentId]
  );

  if (talentResult.rows.length === 0) {
    throw new Error('Talent non trouvé');
  }

  const talent = talentResult.rows[0];

  const profile: TalentProfile = {
    id: talent.id,
    displayName: talent.display_name,
    bio: talent.bio,
    avatarUrl: talent.avatar_url,
    email: talent.email,
    phone: talent.phone,
    city: talent.city,
    region: talent.region,
    country: talent.country,
    remoteReady: talent.remote_ready,
    willingToRelocate: talent.willing_to_relocate,
    profileTags: talent.profile_tags,
    goals: talent.goals,
    summary: {
      totalExperienceYears: 0,
      skillsCount: 0,
      mainSectors: [],
      mainSkillDomains: [],
    },
  };

  // Get skills
  if (includeSkills) {
    const skillsResult = await pool.query(
      `
      SELECT
        s.id, s.canonical_name as name, s.type, s.domain,
        ts.proficiency_level, ts.years_of_experience, ts.endorsed_count
      FROM talent_skills ts
      JOIN skills s ON ts.skill_id = s.id
      WHERE ts.talent_id = $1 AND s.deleted_at IS NULL
      ORDER BY ts.endorsed_count DESC, ts.proficiency_level DESC
    `,
      [talentId]
    );

    profile.skills = skillsResult.rows.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      proficiencyLevel: row.proficiency_level,
      yearsOfExperience: row.years_of_experience,
      endorsedCount: row.endorsed_count || 0,
    }));

    profile.summary.skillsCount = profile.skills.length;

    // Extract main skill domains
    const domains = skillsResult.rows.map((r) => r.domain).filter(Boolean);
    profile.summary.mainSkillDomains = Array.from(new Set(domains)).slice(0, 5);
  }

  // Get experiences
  if (includeExperiences) {
    const experiencesResult = await pool.query(
      `
      SELECT
        e.id, e.job_title, e.work_type, e.started_at, e.ended_at, e.is_current,
        e.city, e.country, e.remote,
        o.name as organization_name, o.sectors
      FROM talent_experiences e
      LEFT JOIN organizations o ON e.organization_id = o.id
      WHERE e.talent_id = $1
      ORDER BY e.is_current DESC, e.started_at DESC
    `,
      [talentId]
    );

    profile.experiences = experiencesResult.rows.map((row) => ({
      id: row.id,
      jobTitle: row.job_title,
      organizationName: row.organization_name || 'Organisation',
      workType: row.work_type,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      isCurrent: row.is_current || false,
      city: row.city,
      country: row.country,
      remote: row.remote,
    }));

    // Calculate total experience years
    let totalMonths = 0;
    for (const exp of experiencesResult.rows) {
      const start = new Date(exp.started_at);
      const end = exp.is_current ? new Date() : new Date(exp.ended_at || new Date());
      totalMonths += (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30);
    }
    profile.summary.totalExperienceYears = Math.round(totalMonths / 12);

    // Extract main sectors
    const sectors = experiencesResult.rows.flatMap((r) => r.sectors || []);
    profile.summary.mainSectors = Array.from(new Set(sectors)).slice(0, 5);
  }

  // Get education
  if (includeEducation) {
    const educationResult = await pool.query(
      `
      SELECT
        ed.id, ed.degree_type, ed.field_of_study, ed.started_at, ed.ended_at, ed.graduated,
        o.name as organization_name
      FROM talent_educations ed
      LEFT JOIN organizations o ON ed.organization_id = o.id
      WHERE ed.talent_id = $1
      ORDER BY ed.ended_at DESC NULLS FIRST
    `,
      [talentId]
    );

    profile.education = educationResult.rows.map((row) => ({
      id: row.id,
      organizationName: row.organization_name || 'Établissement',
      degreeType: row.degree_type,
      fieldOfStudy: row.field_of_study,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      graduated: row.graduated,
    }));
  }

  // Get projects
  if (includeProjects) {
    const projectsResult = await pool.query(
      `
      SELECT id, title, description, role
      FROM talent_projects
      WHERE talent_id = $1
      ORDER BY created_at DESC
      LIMIT 10
    `,
      [talentId]
    );

    profile.projects = projectsResult.rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      role: row.role,
    }));
  }

  return profile;
}

// ═══════════════════════════════════════════════════════════════
// GET TALENT PREFERENCES
// ═══════════════════════════════════════════════════════════════

export const getTalentPreferencesSchema = z.object({});

export interface TalentPreferences {
  opportunityTypes: string[];
  contractTypes: string[];
  locationTypes: string[];
  preferredLocations: string[];
  sectors: string[];
  compensationExpectation?: {
    min?: number;
    max?: number;
    currency?: string;
    frequency?: string;
  };
  availability?: {
    isAvailable: boolean;
    availableFrom?: string;
  };
}

export async function getTalentPreferences(
  _params: z.infer<typeof getTalentPreferencesSchema>,
  context: { talentId: string }
): Promise<TalentPreferences> {
  const { talentId } = context;

  // Get talent with their preferences and infer from profile
  const talentResult = await pool.query(
    `
    SELECT
      t.remote_ready, t.willing_to_relocate, t.city, t.country, t.goals, t.profile_tags
    FROM talents t
    WHERE t.id = $1 AND t.deleted_at IS NULL
  `,
    [talentId]
  );

  if (talentResult.rows.length === 0) {
    throw new Error('Talent non trouvé');
  }

  const talent = talentResult.rows[0];

  // Infer preferences from profile and history
  const preferences: TalentPreferences = {
    opportunityTypes: [],
    contractTypes: [],
    locationTypes: [],
    preferredLocations: [],
    sectors: [],
  };

  // Infer from profile tags
  const profileTags = talent.profile_tags || [];
  if (profileTags.includes('STUDENT') || profileTags.includes('PUPIL')) {
    preferences.opportunityTypes.push('INTERNSHIP', 'ALTERNATION');
    preferences.contractTypes.push('INTERNSHIP', 'APPRENTICESHIP');
  }
  if (profileTags.includes('JOB_SEEKER')) {
    preferences.opportunityTypes.push('EMPLOYMENT');
    preferences.contractTypes.push('CDI', 'CDD');
  }
  if (profileTags.includes('ENTREPRENEUR') || profileTags.includes('CONSULTANT')) {
    preferences.opportunityTypes.push('FREELANCE', 'ENTREPRENEURSHIP');
    preferences.contractTypes.push('FREELANCE', 'SERVICE');
  }

  // Location preferences
  if (talent.remote_ready) {
    preferences.locationTypes.push('REMOTE', 'HYBRID');
  }
  if (talent.city || !talent.remote_ready) {
    preferences.locationTypes.push('ON_SITE');
  }
  if (talent.city) {
    preferences.preferredLocations.push(talent.city);
  }
  if (talent.country) {
    preferences.preferredLocations.push(talent.country);
  }

  // Get sectors from experiences
  const sectorsResult = await pool.query(
    `
    SELECT DISTINCT unnest(o.sectors) as sector
    FROM talent_experiences te
    JOIN organizations o ON te.organization_id = o.id
    WHERE te.talent_id = $1 AND o.sectors IS NOT NULL
  `,
    [talentId]
  );

  preferences.sectors = sectorsResult.rows.map((r) => r.sector);

  return preferences;
}

// ═══════════════════════════════════════════════════════════════
// EXPORT TOOL DEFINITIONS
// ═══════════════════════════════════════════════════════════════

export const profileToolDefinitions = {
  get_talent_profile: {
    name: 'get_talent_profile',
    description:
      "Récupère le profil complet de l'utilisateur actuel incluant ses informations, compétences, expériences, etc. Utilise cette fonction pour personnaliser les recommandations.",
    parameters: getTalentProfileSchema,
    execute: getTalentProfile,
  },
  get_talent_preferences: {
    name: 'get_talent_preferences',
    description:
      "Récupère les préférences de l'utilisateur en termes de type d'opportunités, localisation, secteurs, etc. Déduit des informations de son profil.",
    parameters: getTalentPreferencesSchema,
    execute: getTalentPreferences,
  },
};
