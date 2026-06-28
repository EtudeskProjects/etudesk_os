/**
 * Opportunity Generation Service
 * Uses Agents SDK with GPT-4.1-nano for AI-powered opportunity form generation
 */

import { MODEL_SUGGESTION } from './ai/models';
import { getSuggestionClient } from './ai/provider';
import { recordUsage } from './ai/usage.service';
import { pool } from './database';
import {
  OpportunityType,
  ContractType,
  WorkRhythm,
  CompensationFrequency,
  LocationType,
  ProfileTag,
  Sector,
  OPPORTUNITY_TYPES,
  CONTRACT_TYPE,
  WORK_RHYTHM,
  COMPENSATION_FREQUENCY,
  LOCATION_TYPE,
  PROFILE_TAG,
  SECTORS,
  OpportunityLocation,
} from '../types/models';
import { buildOpportunityGenPrompt, buildOpportunityGenSystemPrompt } from './ai/prompts/opportunity-gen.prompt';
import { resolveSkillSuggestions, getNeighbors, getCompetency, type ResolvedSkillSuggestion } from './skills/catalog.service';

const MIN_SUGGESTED_SKILLS = 10;

/**
 * Guarantee at least `min` catalog skill suggestions. Backfills from the
 * competency graph (co-occurrence / sibling / prerequisite neighbors of the
 * already-resolved skills) as nice_to_have, so the form's "suggest" button
 * always proposes a rich list. Referential only — never fabricated.
 */
async function ensureMinSkills(skills: ResolvedSkillSuggestion[], min = MIN_SUGGESTED_SKILLS): Promise<ResolvedSkillSuggestion[]> {
  const out = [...skills];
  const seen = new Set(out.map((s) => s.slug));
  for (const base of skills) {
    if (out.length >= min) break;
    const neighbors = await getNeighbors(base.slug, { relations: ['co_occurrence', 'sibling', 'prerequisite'], limit: 8 });
    for (const n of neighbors) {
      if (out.length >= min) break;
      if (seen.has(n.slug)) continue;
      const c = await getCompetency(n.slug);
      if (!c) continue;
      seen.add(n.slug);
      out.push({ slug: c.slug, name: c.name, name_fr: c.name_fr, type: c.type, family: c.family, requirement: 'nice_to_have' });
    }
  }
  return out;
}
import { toTOON } from './ai/toon';
import { FALLBACK_LANGUAGE, SupportedLanguage } from '../i18n';
import { getLanguageDisplayName } from './language-preference.service';

import { logger } from '../utils';

export interface GenerationInput {
  title: string;
  type: OpportunityType;
  organization_id: string;
  language?: SupportedLanguage;
  // Optional existing form data for context
  existing_data?: Partial<GeneratedOpportunity>;
}

export interface ApplicationQuestion {
  id: string;
  question: string;
  required: boolean;
  max_length?: number;
}

export interface GeneratedOpportunity {
  suggested_title: string;
  summary: string;
  requirements: string;
  nice_to_have: string;
  contract_type: ContractType;
  work_rhythm: WorkRhythm;
  sectors: Sector[];
  compensation_min?: number;
  compensation_max?: number;
  currency: string;
  compensation_frequency: CompensationFrequency;
  location_type: LocationType;
  locations?: OpportunityLocation[];
  duration?: string;
  deadline_days: number;
  cv_required: boolean;
  application_questions: ApplicationQuestion[];
  target_profiles: ProfileTag[];
  ideal_candidate_summary: string;
  // Catalog-resolved skills (only referential competencies; required/nice_to_have)
  skills?: ResolvedSkillSuggestion[];
}

interface OrganizationContext {
  name: string;
  types?: string[];
  sectors?: string[];
  size?: string;
  description?: string;
  headquarters_city?: string;
  headquarters_region?: string;
  headquarters_country?: string;
  culture_summary?: string;
}

// --- Json Schema For Structured Output ---

const OPPORTUNITY_SCHEMA = {
  type: 'object',
  properties: {
    suggested_title: {
      type: 'string',
      description: 'Titre professionnel amélioré/corrigé pour le poste (max 60 caractères)',
    },
    summary: {
      type: 'string',
      description: 'Description concise de l\'opportunité (150-300 caractères max)',
    },
    requirements: {
      type: 'string',
      description: 'Compétences requises, 3-5 points avec "• " comme puce (max 250 caractères)',
    },
    nice_to_have: {
      type: 'string',
      description: 'Atouts appréciés, 2-3 points avec "• " comme puce (max 150 caractères)',
    },
    contract_type: {
      type: 'string',
      enum: Object.values(CONTRACT_TYPE),
    },
    work_rhythm: {
      type: 'string',
      enum: Object.values(WORK_RHYTHM),
    },
    sectors: {
      type: 'array',
      items: { type: 'string', enum: Object.values(SECTORS) },
      minItems: 2,
      maxItems: 5,
    },
    compensation_min: { type: 'number' },
    compensation_max: { type: 'number' },
    currency: { type: 'string' },
    compensation_frequency: {
      type: 'string',
      enum: Object.values(COMPENSATION_FREQUENCY),
    },
    location_type: {
      type: 'string',
      enum: Object.values(LOCATION_TYPE),
    },
    locations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          city: { type: 'string' },
          region: { type: 'string' },
          country: { type: 'string' },
          is_primary: { type: 'boolean' },
        },
      },
    },
    duration: { type: 'string' },
    deadline_days: { type: 'number' },
    cv_required: { type: 'boolean' },
    application_questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          question: { type: 'string' },
          required: { type: 'boolean' },
          max_length: { type: 'number' },
        },
        required: ['id', 'question', 'required'],
      },
      maxItems: 3,
    },
    target_profiles: {
      type: 'array',
      items: { type: 'string', enum: Object.values(PROFILE_TAG) },
      maxItems: 4,
    },
    skills: {
      type: 'array',
      description: 'Compétences clés concrètes et standards (noms réels, ex: "React", "Gestion de projet", "SQL"). 12-16 items (au moins 12), mappées au référentiel Etudesk.',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          requirement: { type: 'string', enum: ['required', 'nice_to_have'] },
        },
        required: ['name', 'requirement'],
      },
      minItems: 12,
      maxItems: 16,
    },
    ideal_candidate_summary: { type: 'string' },
  },
  required: [
    'suggested_title', 'summary', 'requirements', 'nice_to_have',
    'contract_type', 'work_rhythm', 'sectors', 'currency',
    'compensation_frequency', 'location_type', 'deadline_days',
    'cv_required', 'application_questions', 'target_profiles',
    'ideal_candidate_summary',
  ],
};

// --- Helper Functions ---

async function getOrganizationContext(organizationId: string): Promise<OrganizationContext | null> {
  try {
    const result = await pool.query(
      `SELECT name, types, sectors, description,
              headquarters_city, headquarters_region, headquarters_country,
              culture_summary
       FROM organizations
       WHERE id = $1 AND deleted_at IS NULL`,
      [organizationId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  } catch (error) {
    logger.error('Error fetching organization context:', error);
    return null;
  }
}

// --- Main Service Function ---

export async function generateOpportunitySuggestion(
  input: GenerationInput
): Promise<{
  success: boolean;
  data?: GeneratedOpportunity;
  error?: string;
}> {
  if (!process.env.AI_API_KEY) {
    return { success: false, error: 'AI_API_KEY not configured' };
  }

  // Validate required fields
  if (!input.title || input.title.length < 3) {
    return { success: false, error: 'Title must be at least 3 characters' };
  }

  if (!input.type || !Object.values(OPPORTUNITY_TYPES).includes(input.type)) {
    return { success: false, error: 'Invalid opportunity type' };
  }

  // Get organization context
  const organization = await getOrganizationContext(input.organization_id);
  if (!organization) {
    return { success: false, error: 'Organization not found' };
  }

  const opportunityTypeLabels: Record<OpportunityType, string> = {
    EMPLOYMENT: 'Emploi',
    INTERNSHIP: 'Stage',
    ENTREPRENEURSHIP: 'Entrepreneuriat',
    ALTERNATION: 'Alternance',
    FREELANCE: 'Freelance',
    VOLUNTEER: 'Bénévolat',
  };

  const existingDataContext = input.existing_data
    ? `\nDonnées existantes (format TOON) :\n${toTOON(input.existing_data)}`
    : '';

  const language = input.language || FALLBACK_LANGUAGE;
  const languageName = getLanguageDisplayName(language);

  const prompt = buildOpportunityGenPrompt({
    title: input.title,
    typeLabel: opportunityTypeLabels[input.type],
    type: input.type,
    orgName: organization.name,
    orgType: organization.types?.join(', ') || 'Non spécifié',
    orgSectors: organization.sectors?.join(', ') || 'Non spécifié',
    orgLocation: [organization.headquarters_city, organization.headquarters_region, organization.headquarters_country].filter(Boolean).join(', ') || 'Non spécifié',
    existingDataContext,
    schemaJson: toTOON(OPPORTUNITY_SCHEMA),
    languageName,
  });

  try {
    const openai = getSuggestionClient();
    const completion = await openai.chat.completions.create({
      model: MODEL_SUGGESTION,
      messages: [
        { role: 'system', content: buildOpportunityGenSystemPrompt(languageName) },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
    });

    void recordUsage({ feature: 'form_suggestion', model: MODEL_SUGGESTION, usage: completion.usage, scopeOrganizationId: input.organization_id });

    const generatedText = completion.choices[0]?.message?.content;
    if (!generatedText) {
      return { success: false, error: 'No response from AI model' };
    }

    const generatedData: GeneratedOpportunity = JSON.parse(generatedText);

    // Ensure application_questions have unique IDs
    if (generatedData.application_questions) {
      generatedData.application_questions = generatedData.application_questions.map(
        (q, index) => ({
          ...q,
          id: q.id || `q_${Date.now()}_${index}`,
          max_length: q.max_length || 500,
        })
      );
    }

    // Set default currency if not provided
    if (!generatedData.currency) {
      generatedData.currency = 'XOF';
    }

    // Resolve suggested skills to the catalog (referential = single source of truth).
    // Anything not in the catalog is dropped — suggestions are always catalog-valid.
    const resolvedSkills = await resolveSkillSuggestions(generatedData.skills as any);
    // Always propose at least 10 skills: backfill from the competency graph if needed.
    generatedData.skills = await ensureMinSkills(resolvedSkills, MIN_SUGGESTED_SKILLS);

    return { success: true, data: generatedData };
  } catch (error) {
    logger.error('Error generating opportunity suggestion:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Generation failed',
    };
  }
}

// --- Validation Helper ---

export function canGenerate(title?: string, type?: string): boolean {
  return !!(
    title &&
    title.length >= 3 &&
    type &&
    Object.values(OPPORTUNITY_TYPES).includes(type as OpportunityType)
  );
}
