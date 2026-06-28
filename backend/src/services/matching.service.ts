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

import { logger } from '../utils';
import * as catalog from './skills/catalog.service';
import { LEVEL_SCORE } from '../constants/skills';
// --- Types & Constants ---

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
  cv_url?: string;
  star_rating?: number;
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
  matchScore: number;
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

// --- Location Scoring 25 Points ---

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

// --- Skills Scoring 30 Points ---

/**
 * Calculate skills match score from the catalog-structured opportunity_skills vs
 * the talent's active catalog competencies. Direct hits score by proficiency
 * relative to the required min_level; missing required skills get partial credit
 * if the talent holds a prerequisite/sibling neighbor (graph). Required skills
 * dominate the weight; nice_to_have contributes a smaller share.
 */
async function calculateSkillsScore(talentId: string, opportunityId: string): Promise<number> {
  const maxScore = WEIGHTS.skills;

  try {
    const oppSkillsResult = await pool.query(
      `SELECT competency_slug, requirement, weight, min_level
       FROM opportunity_skills WHERE opportunity_id = $1`,
      [opportunityId]
    );
    const oppSkills = oppSkillsResult.rows as Array<{
      competency_slug: string;
      requirement: 'required' | 'nice_to_have';
      weight: number;
      min_level: string | null;
    }>;

    // No structured tags -> neutral (encourages tagging)
    if (oppSkills.length === 0) return maxScore * 0.6;

    const talentSkillsResult = await pool.query(
      `SELECT competency_slug, score FROM talent_skills
       WHERE talent_id = $1 AND is_visible = true AND decay_state = 'active'`,
      [talentId]
    );
    const talentScoreBySlug = new Map<string, number>();
    for (const r of talentSkillsResult.rows) talentScoreBySlug.set(r.competency_slug, r.score);

    const REQUIRED_SHARE = 0.7;
    const NICE_SHARE = 0.3;
    const levelScoreOf = (lvl: string | null): number =>
      lvl ? LEVEL_SCORE[lvl as keyof typeof LEVEL_SCORE] || 1 : 1;

    let reqWeight = 0;
    let reqCovered = 0;
    let niceWeight = 0;
    let niceCovered = 0;

    for (const s of oppSkills) {
      const w = s.weight || 1;
      let coverage = 0;
      const direct = talentScoreBySlug.get(s.competency_slug);
      if (direct != null) {
        const need = levelScoreOf(s.min_level);
        coverage = Math.max(0.5, Math.min(1, direct / need)); // meeting min_level = full
      } else {
        // Graph partial credit: does the talent hold a prerequisite, sibling, or
        // weakly related co-occurring skill? Co-occurrence is intentionally
        // capped lower, especially for required skills.
        const neighbors = await catalog.getNeighbors(s.competency_slug, {
          relations: ['prerequisite', 'sibling', 'co_occurrence'],
          limit: 8,
        });
        let best = 0;
        for (const n of neighbors) {
          if (talentScoreBySlug.has(n.slug)) {
            const relationCap =
              n.relation === 'co_occurrence'
                ? s.requirement === 'required' ? 0.35 : 0.45
                : 0.6;
            const base =
              n.relation === 'co_occurrence'
                ? 0.2 + n.strength * 0.2
                : 0.4 + n.strength * 0.2;
            best = Math.max(best, Math.min(relationCap, base));
          }
        }
        coverage = best;
      }
      if (s.requirement === 'required') {
        reqWeight += w;
        reqCovered += w * coverage;
      } else {
        niceWeight += w;
        niceCovered += w * coverage;
      }
    }

    const reqRatio = reqWeight > 0 ? reqCovered / reqWeight : 1;
    const niceRatio = niceWeight > 0 ? niceCovered / niceWeight : 1;
    const ratio = REQUIRED_SHARE * reqRatio + NICE_SHARE * niceRatio;
    return Math.max(0, Math.min(maxScore, maxScore * ratio));
  } catch (error) {
    logger.error('Error calculating skills score:', error);
    return maxScore * 0.3;
  }
}

// --- Experience Scoring 20 Points ---

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

// --- Sectors Scoring 15 Points ---

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

// --- Work Type Scoring 10 Points ---

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

// --- Main Scoring Function ---

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
    application.opportunity_id
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
      a.cv_url,
      a.star_rating,
      a.internal_notes,
      a.viewed_at,
      json_build_object(
        'id', t.id,
        'display_name', COALESCE(t.first_name || ' ' || t.last_name, t.email),
        'first_name', t.first_name,
        'last_name', t.last_name,
        'email', t.email,
        'phone', t.phone,
        'city', t.city,
        'region', t.region,
        'country', t.country,
        'bio', t.bio,
        'skills', (SELECT ARRAY_AGG(c.name ORDER BY ts.score DESC)
                   FROM talent_skills ts JOIN competencies c ON c.slug = ts.competency_slug
                   WHERE ts.talent_id = t.id AND ts.is_visible = true AND ts.decay_state = 'active'),
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
          logger.error('Error getting semantic boost:', error);
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
      return (b.star_rating || 0) - (a.star_rating || 0);
    }
    return b._score - a._score;
  });

  // Add rank and remove internal score, normalize field names for API
  return scoredApplications.map((app, index) => {
    const { _score, _matchCategory, ...rest } = app;
    return {
      ...rest,
      rank: index + 1,
      matchScore: _score,
      matchCategory: _matchCategory,
    } as RankedApplication;
  });
}
