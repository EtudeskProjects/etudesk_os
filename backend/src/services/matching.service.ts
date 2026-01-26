/**
 * Matching Service - Algorithmic scoring for candidate-opportunity matching
 *
 * Scoring weights (total = 100):
 * - Location: 25 points
 * - Skills: 30 points
 * - Experience: 20 points
 * - Sectors: 15 points
 * - Work Type: 10 points
 */

import { pool } from './database';

// ═══════════════════════════════════════════════════════════════
// TYPES & CONSTANTS
// ═══════════════════════════════════════════════════════════════

export interface MatchingScore {
  totalScore: number;
  breakdown: {
    location: number;
    skills: number;
    experience: number;
    sectors: number;
    workType: number;
  };
  semanticBoost: number;
  finalScore: number;
}

export interface RankedApplication {
  id: string;
  talent_id: string;
  opportunity_id: string;
  status: string;
  applied_at: string;
  cover_letter?: string;
  resume_url?: string;
  rating?: number;
  internal_notes?: string;
  viewed_at?: string;
  talent: {
    id: string;
    display_name: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    city?: string;
    region?: string;
    country?: string;
    bio?: string;
    current_role?: string;
    years_experience?: number;
    skills?: string[];
    sectors?: string[];
    remote_ready?: boolean;
    profile_picture_url?: string;
  };
  opportunity?: {
    id: string;
    title: string;
    location_type?: string;
    contract_type?: string;
    work_rhythm?: string;
    type?: string;
  };
  rank: number;
  matchCategory: 'excellent' | 'good' | 'average' | 'low';
}

const WEIGHTS = {
  location: 25,
  skills: 30,
  experience: 20,
  sectors: 15,
  workType: 10,
};

// Experience level mapping to years
const EXPERIENCE_YEARS: Record<string, { min: number; max: number }> = {
  ENTRY: { min: 0, max: 1 },
  JUNIOR: { min: 1, max: 3 },
  MID: { min: 3, max: 5 },
  SENIOR: { min: 5, max: 10 },
  LEAD: { min: 8, max: 15 },
  EXECUTIVE: { min: 10, max: 30 },
};

// Proficiency level mapping
const PROFICIENCY_ORDER = ['A', 'A+', 'B', 'B+', 'C', 'C+'];

// ═══════════════════════════════════════════════════════════════
// LOCATION SCORING (25 points)
// ═══════════════════════════════════════════════════════════════

/**
 * Calculate location match score
 * Geolocation > ville > region > pays > international
 */
function calculateLocationScore(
  talent: {
    city?: string;
    region?: string;
    country?: string;
    remote_ready?: boolean;
    coordinates?: { x: number; y: number };
  },
  opportunity: {
    location_type?: string;
    locations?: Array<{
      city?: string;
      region?: string;
      country?: string;
      coordinates?: { x: number; y: number };
    }>;
  }
): number {
  const maxScore = WEIGHTS.location;

  // If opportunity is fully remote and talent is remote ready
  if (opportunity.location_type === 'REMOTE') {
    return talent.remote_ready ? maxScore : maxScore * 0.7;
  }

  // Get primary location from opportunity
  const oppLocation = opportunity.locations?.[0];
  if (!oppLocation) {
    return talent.remote_ready ? maxScore * 0.8 : maxScore * 0.5;
  }

  // Exact city match
  if (talent.city && oppLocation.city &&
      talent.city.toLowerCase() === oppLocation.city.toLowerCase()) {
    return maxScore; // 25/25 = 100%
  }

  // Same region
  if (talent.region && oppLocation.region &&
      talent.region.toLowerCase() === oppLocation.region.toLowerCase()) {
    return maxScore * 0.8; // 20/25 = 80%
  }

  // Same country
  if (talent.country && oppLocation.country &&
      talent.country.toLowerCase() === oppLocation.country.toLowerCase()) {
    // Hybrid opportunity with same country
    if (opportunity.location_type === 'HYBRID') {
      return maxScore * 0.72; // 18/25 = 72%
    }
    return maxScore * 0.6; // 15/25 = 60%
  }

  // Remote ready for hybrid/on-site
  if (talent.remote_ready && opportunity.location_type === 'HYBRID') {
    return maxScore * 0.5; // 12.5/25 = 50%
  }

  // International (different country)
  return maxScore * 0.4; // 10/25 = 40%
}

// ═══════════════════════════════════════════════════════════════
// SKILLS SCORING (30 points)
// ═══════════════════════════════════════════════════════════════

/**
 * Calculate skills match score
 */
async function calculateSkillsScore(
  talentId: string,
  opportunityId: string,
  talentSkills?: string[]
): Promise<number> {
  const maxScore = WEIGHTS.skills;

  try {
    // Get opportunity required skills
    const oppSkillsResult = await pool.query(`
      SELECT os.skill_id, os.is_required, os.proficiency_level, s.canonical_name
      FROM opportunity_skills os
      JOIN skills s ON os.skill_id = s.id
      WHERE os.opportunity_id = $1
    `, [opportunityId]);

    const oppSkills = oppSkillsResult.rows;

    if (oppSkills.length === 0) {
      // No specific skills required, use talent skills array if available
      if (talentSkills && talentSkills.length > 0) {
        return maxScore * 0.7; // Has skills, but can't match specifically
      }
      return maxScore * 0.5; // No skills defined
    }

    // Get talent skills with proficiency
    const talentSkillsResult = await pool.query(`
      SELECT ts.skill_id, ts.proficiency_level, s.canonical_name
      FROM talent_skills ts
      JOIN skills s ON ts.skill_id = s.id
      WHERE ts.talent_id = $1
    `, [talentId]);

    const talentSkillMap = new Map(
      talentSkillsResult.rows.map(s => [s.skill_id, s])
    );

    let totalPoints = 0;
    let requiredSkillsCount = 0;
    let niceToHaveMatches = 0;

    for (const oppSkill of oppSkills) {
      const talentSkill = talentSkillMap.get(oppSkill.skill_id);

      if (oppSkill.is_required) {
        requiredSkillsCount++;
        if (talentSkill) {
          // Check proficiency level
          const talentLevel = PROFICIENCY_ORDER.indexOf(talentSkill.proficiency_level);
          const requiredLevel = PROFICIENCY_ORDER.indexOf(oppSkill.proficiency_level || 'B');

          if (talentLevel >= requiredLevel) {
            totalPoints += 1.0; // Full match
          } else if (talentLevel >= requiredLevel - 1) {
            totalPoints += 0.7; // Close match
          } else {
            totalPoints += 0.3; // Has skill but lower level
          }
        }
      } else {
        // Nice to have skill
        if (talentSkill) {
          niceToHaveMatches++;
        }
      }
    }

    // Calculate base score from required skills
    let score = requiredSkillsCount > 0
      ? (totalPoints / requiredSkillsCount) * maxScore
      : maxScore * 0.5;

    // Bonus for nice-to-have skills (max 5 extra points)
    const niceToHaveBonus = Math.min(niceToHaveMatches * 1.5, 5);
    score = Math.min(maxScore, score + niceToHaveBonus);

    // If no structured skills, try text matching with talent.skills array
    if (requiredSkillsCount === 0 && talentSkills && talentSkills.length > 0) {
      // Simple text matching as fallback
      const oppSkillNames = oppSkills.map(s => s.canonical_name.toLowerCase());
      const matches = talentSkills.filter(s =>
        oppSkillNames.some(os => os.includes(s.toLowerCase()) || s.toLowerCase().includes(os))
      );
      score = (matches.length / Math.max(oppSkills.length, 1)) * maxScore;
    }

    return Math.round(score * 10) / 10;
  } catch (error) {
    console.error('Error calculating skills score:', error);
    // Fallback: if talent has skills array, give partial credit
    if (talentSkills && talentSkills.length > 0) {
      return maxScore * 0.5;
    }
    return maxScore * 0.3;
  }
}

// ═══════════════════════════════════════════════════════════════
// EXPERIENCE SCORING (20 points)
// ═══════════════════════════════════════════════════════════════

/**
 * Calculate experience level match score
 */
function calculateExperienceScore(
  talentYears: number | undefined,
  requiredLevel: string | undefined
): number {
  const maxScore = WEIGHTS.experience;

  if (!requiredLevel) {
    return maxScore * 0.7; // No specific requirement
  }

  const required = EXPERIENCE_YEARS[requiredLevel];
  if (!required) {
    return maxScore * 0.5;
  }

  const years = talentYears || 0;

  // Perfect match (within range)
  if (years >= required.min && years <= required.max) {
    return maxScore; // 20/20 = 100%
  }

  // Slightly under-qualified (within 1 level)
  if (years >= required.min - 2 && years < required.min) {
    return maxScore * 0.75; // 15/20 = 75%
  }

  // Over-qualified (might be okay)
  if (years > required.max && years <= required.max + 3) {
    return maxScore * 0.85; // 17/20 = 85%
  }

  // Significantly over-qualified
  if (years > required.max + 3) {
    return maxScore * 0.6; // 12/20 = 60%
  }

  // Under-qualified by more than 1 level
  if (years < required.min - 2) {
    return maxScore * 0.4; // 8/20 = 40%
  }

  return maxScore * 0.5;
}

// ═══════════════════════════════════════════════════════════════
// SECTORS SCORING (15 points)
// ═══════════════════════════════════════════════════════════════

/**
 * Calculate sector alignment score
 */
function calculateSectorsScore(
  talentSectors: string[] | undefined,
  organizationSectors: string[] | undefined
): number {
  const maxScore = WEIGHTS.sectors;

  if (!talentSectors || talentSectors.length === 0) {
    return maxScore * 0.4; // No sectors defined
  }

  if (!organizationSectors || organizationSectors.length === 0) {
    return maxScore * 0.6; // Organization has no sectors, give benefit
  }

  const talentSet = new Set(talentSectors.map(s => s.toUpperCase()));
  const orgSet = new Set(organizationSectors.map(s => s.toUpperCase()));

  // Count matches
  let matches = 0;
  for (const sector of orgSet) {
    if (talentSet.has(sector)) {
      matches++;
    }
  }

  if (matches === 0) {
    // Check for adjacent/related sectors
    const adjacentSectors: Record<string, string[]> = {
      'DIGITAL': ['MEDIA', 'COMMERCE', 'FINANCE'],
      'FINANCE': ['DIGITAL', 'COMMERCE', 'PROFESSIONAL_SERVICES'],
      'HEALTH': ['RESEARCH', 'SOCIAL_IMPACT', 'EDUCATION'],
      'EDUCATION': ['RESEARCH', 'DIGITAL', 'PROFESSIONAL_SERVICES'],
      'INDUSTRY': ['CONSTRUCTION', 'TRANSPORT', 'ENERGY'],
    };

    for (const orgSector of orgSet) {
      const adjacent = adjacentSectors[orgSector] || [];
      for (const adj of adjacent) {
        if (talentSet.has(adj)) {
          return maxScore * 0.4; // Adjacent sector match
        }
      }
    }

    return maxScore * 0.2; // No match at all
  }

  // Primary sector match (first match)
  if (matches >= 1) {
    const matchRatio = matches / orgSet.size;
    return maxScore * Math.min(1, 0.6 + matchRatio * 0.4);
  }

  return maxScore * 0.5;
}

// ═══════════════════════════════════════════════════════════════
// WORK TYPE SCORING (10 points)
// ═══════════════════════════════════════════════════════════════

/**
 * Calculate work type compatibility score
 * Uses contract_type and work_rhythm instead of deprecated work_type
 */
function calculateWorkTypeScore(
  talentTags: string[] | undefined,
  talentCurrentRole: string | undefined,
  opportunityContractType: string | undefined,
  opportunityWorkRhythm: string | undefined,
  opportunityType: string | undefined
): number {
  const maxScore = WEIGHTS.workType;

  if (!opportunityContractType && !opportunityWorkRhythm && !opportunityType) {
    return maxScore * 0.7;
  }

  // Contract type compatibility matrix
  const contractCompatibility: Record<string, string[]> = {
    'CDI': ['JOB_SEEKER', 'SALARIED'],
    'CDD': ['JOB_SEEKER', 'SALARIED', 'STUDENT'],
    'FREELANCE': ['CONSULTANT', 'FREELANCE', 'ENTREPRENEUR', 'CONTENT_CREATOR'],
    'INTERNSHIP': ['STUDENT', 'PUPIL', 'JOB_SEEKER'],
    'APPRENTICESHIP': ['STUDENT', 'PUPIL'],
  };

  // Work rhythm compatibility
  const rhythmCompatibility: Record<string, string[]> = {
    'FULL_TIME': ['JOB_SEEKER', 'SALARIED'],
    'PART_TIME': ['STUDENT', 'SALARIED', 'ENTREPRENEUR', 'CONTENT_CREATOR'],
    'FLEXIBLE': ['STUDENT', 'ENTREPRENEUR', 'CONTENT_CREATOR', 'SALARIED'],
    'OCCASIONAL': ['STUDENT', 'ENTREPRENEUR', 'CONTENT_CREATOR'],
  };

  // Check contract type compatibility
  if (opportunityContractType) {
    const compatibleTags = contractCompatibility[opportunityContractType] || [];
    if (talentTags && talentTags.length > 0) {
      const hasCompatibleTag = talentTags.some(tag => compatibleTags.includes(tag));
      if (hasCompatibleTag) {
        return maxScore; // Perfect match
      }
    }
  }

  // Check work rhythm compatibility
  if (opportunityWorkRhythm) {
    const compatibleTags = rhythmCompatibility[opportunityWorkRhythm] || [];
    if (talentTags && talentTags.length > 0) {
      const hasCompatibleTag = talentTags.some(tag => compatibleTags.includes(tag));
      if (hasCompatibleTag) {
        return maxScore * 0.9; // Good match
      }
    }
  }

  // Check if talent has current role (indicates employment experience)
  if (talentCurrentRole) {
    if (opportunityContractType === 'CDI' || opportunityContractType === 'CDD') {
      return maxScore * 0.8;
    }
  }

  // Internship/Apprenticeship for students
  if ((opportunityType === 'INTERNSHIP' || opportunityType === 'ALTERNATION') &&
      talentTags?.includes('STUDENT')) {
    return maxScore;
  }

  return maxScore * 0.5;
}

// ═══════════════════════════════════════════════════════════════
// MAIN SCORING FUNCTION
// ═══════════════════════════════════════════════════════════════

/**
 * Calculate complete matching score for a talent-opportunity pair
 */
export async function calculateMatchingScore(
  application: {
    id: string;
    talent_id: string;
    opportunity_id: string;
    talent: {
      city?: string;
      region?: string;
      country?: string;
      remote_ready?: boolean;
      years_experience?: number;
      skills?: string[];
      sectors?: string[];
      profile_tags?: string[];
      current_role?: string;
    };
    opportunity: {
      location_type?: string;
      locations?: Array<{ city?: string; region?: string; country?: string }>;
      contract_type?: string;
      work_rhythm?: string;
      type?: string;
    };
    organization?: {
      sectors?: string[];
    };
  },
  semanticBoost: number = 0
): Promise<MatchingScore> {
  const { talent, opportunity, organization } = application;

  // Calculate individual scores
  const locationScore = calculateLocationScore(talent, opportunity);

  const skillsScore = await calculateSkillsScore(
    application.talent_id,
    application.opportunity_id,
    talent.skills
  );

  // Experience scoring removed - experience_level field is deprecated
  const experienceScore = WEIGHTS.experience * 0.7; // Neutral score when no requirement

  const sectorsScore = calculateSectorsScore(
    talent.sectors,
    organization?.sectors
  );

  const workTypeScore = calculateWorkTypeScore(
    talent.profile_tags,
    talent.current_role,
    opportunity.contract_type,
    opportunity.work_rhythm,
    opportunity.type
  );

  // Calculate total algorithmic score
  const totalScore = locationScore + skillsScore + experienceScore + sectorsScore + workTypeScore;

  // Apply semantic boost (clamped to -20 to +20)
  const clampedBoost = Math.max(-20, Math.min(20, semanticBoost));
  const finalScore = Math.max(0, Math.min(100, totalScore + clampedBoost));

  return {
    totalScore: Math.round(totalScore * 10) / 10,
    breakdown: {
      location: Math.round(locationScore * 10) / 10,
      skills: Math.round(skillsScore * 10) / 10,
      experience: Math.round(experienceScore * 10) / 10,
      sectors: Math.round(sectorsScore * 10) / 10,
      workType: Math.round(workTypeScore * 10) / 10,
    },
    semanticBoost: Math.round(clampedBoost * 10) / 10,
    finalScore: Math.round(finalScore * 10) / 10,
  };
}

/**
 * Get match category based on score
 */
export function getMatchCategory(score: number): 'excellent' | 'good' | 'average' | 'low' {
  if (score >= 75) return 'excellent';
  if (score >= 55) return 'good';
  if (score >= 35) return 'average';
  return 'low';
}

/**
 * Rank applications for an opportunity by matching score
 */
export async function rankApplications(
  opportunityId: string,
  status?: string,
  getSemanticBoost?: (talentId: string, opportunityId: string) => Promise<number>
): Promise<RankedApplication[]> {
  // Fetch applications with talent and opportunity data
  const query = `
    SELECT
      a.id,
      a.talent_id,
      a.opportunity_id,
      a.status,
      a.applied_at,
      a.cover_letter,
      a.resume_url,
      a.rating,
      a.internal_notes,
      a.viewed_at,
      json_build_object(
        'id', t.id,
        'display_name', t.display_name,
        'first_name', t.first_name,
        'last_name', t.last_name,
        'email', t.email,
        'phone', t.phone,
        'city', t.city,
        'region', t.region,
        'country', t.country,
        'bio', t.bio,
        'current_role', (SELECT te.job_title FROM talent_experiences te WHERE te.talent_id = t.id ORDER BY te.ended_at DESC NULLS FIRST, te.started_at DESC LIMIT 1),
        'years_experience', EXTRACT(YEAR FROM AGE(NOW(), (SELECT MIN(te.started_at) FROM talent_experiences te WHERE te.talent_id = t.id)))::INTEGER,
        'skills', (SELECT ARRAY_AGG(s.canonical_name) FROM talent_skills ts JOIN skills s ON ts.skill_id = s.id WHERE ts.talent_id = t.id),
        'sectors', t.sectors,
        'remote_ready', t.remote_ready,
        'profile_tags', t.profile_tags,
        'profile_picture_url', t.avatar_url
      ) as talent,
      json_build_object(
        'id', o.id,
        'title', o.title,
        'location_type', o.location_type,
        'contract_type', o.contract_type,
        'work_rhythm', o.work_rhythm,
        'type', o.type,
        'locations', o.locations
      ) as opportunity,
      json_build_object(
        'sectors', org.sectors
      ) as organization
    FROM opportunity_applications a
    JOIN talents t ON a.talent_id = t.id
    JOIN opportunities o ON a.opportunity_id = o.id
    LEFT JOIN opportunity_posters op ON o.id = op.opportunity_id
    LEFT JOIN organizations org ON op.poster_organization_id = org.id
    WHERE a.opportunity_id = $1
    ${status ? 'AND a.status = $2' : ''}
    AND o.deleted_at IS NULL
  `;

  const params = status ? [opportunityId, status] : [opportunityId];
  const result = await pool.query(query, params);

  // Calculate scores for each application
  const scoredApplications = await Promise.all(
    result.rows.map(async (row) => {
      // Get semantic boost if function provided
      let semanticBoost = 0;
      if (getSemanticBoost) {
        try {
          semanticBoost = await getSemanticBoost(row.talent_id, opportunityId);
        } catch (error) {
          console.error('Error getting semantic boost:', error);
        }
      }

      const score = await calculateMatchingScore({
        id: row.id,
        talent_id: row.talent_id,
        opportunity_id: row.opportunity_id,
        talent: row.talent,
        opportunity: row.opportunity,
        organization: row.organization,
      }, semanticBoost);

      return {
        ...row,
        _score: score.finalScore,
        _matchCategory: getMatchCategory(score.finalScore),
      };
    })
  );

  // Sort by score (descending), then by rating as tiebreaker
  scoredApplications.sort((a, b) => {
    // If scores are very close (within 5 points), use rating
    if (Math.abs(a._score - b._score) < 5) {
      return (b.rating || 0) - (a.rating || 0);
    }
    return b._score - a._score;
  });

  // Add rank and remove internal score, normalize field names for API
  return scoredApplications.map((app, index) => {
    const { _score, _matchCategory, ...rest } = app;
    return {
      ...rest,
      rank: index + 1,
      matchCategory: _matchCategory,
    } as RankedApplication;
  });
}
