/**
 * Opportunity Generation Service
 * Uses Agents SDK with GPT-4.1-nano for AI-powered opportunity form generation
 */

import OpenAI from 'openai';
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
import { OPPORTUNITY_GEN_SYSTEM_PROMPT, buildOpportunityGenPrompt } from './ai/prompts/opportunity-gen.prompt';

import { logger } from '../utils';
// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface GenerationInput {
  title: string;
  type: OpportunityType;
  organization_id: string;
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

// ═══════════════════════════════════════════════════════════════
// JSON Schema for structured output
// ═══════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

async function getOrganizationContext(organizationId: string): Promise<OrganizationContext | null> {
  try {
    const result = await pool.query(
      `SELECT name, types, sectors, size, description,
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

// ═══════════════════════════════════════════════════════════════
// MAIN SERVICE FUNCTION
// ═══════════════════════════════════════════════════════════════

export async function generateOpportunitySuggestion(
  input: GenerationInput
): Promise<{
  success: boolean;
  data?: GeneratedOpportunity;
  error?: string;
}> {
  if (!process.env.OPENAI_API_KEY) {
    return { success: false, error: 'OPENAI_API_KEY not configured' };
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
    ? `\nDonnées existantes : ${JSON.stringify(input.existing_data, null, 2)}`
    : '';

  const prompt = buildOpportunityGenPrompt({
    title: input.title,
    typeLabel: opportunityTypeLabels[input.type],
    type: input.type,
    orgName: organization.name,
    orgType: organization.types?.join(', ') || 'Non spécifié',
    orgSectors: organization.sectors?.join(', ') || 'Non spécifié',
    orgLocation: [organization.headquarters_city, organization.headquarters_region, organization.headquarters_country].filter(Boolean).join(', ') || 'Non spécifié',
    existingDataContext,
    schemaJson: JSON.stringify(OPPORTUNITY_SCHEMA, null, 2),
  });

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: OPPORTUNITY_GEN_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
    });

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

    return { success: true, data: generatedData };
  } catch (error) {
    logger.error('Error generating opportunity suggestion:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Generation failed',
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// VALIDATION HELPER
// ═══════════════════════════════════════════════════════════════

export function canGenerate(title?: string, type?: string): boolean {
  return !!(
    title &&
    title.length >= 3 &&
    type &&
    Object.values(OPPORTUNITY_TYPES).includes(type as OpportunityType)
  );
}
