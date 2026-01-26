/**
 * Opportunity Generation Service
 * Uses GPT-4.1 nano for AI-powered opportunity form generation
 * with structured outputs
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
  type?: string;
  sectors?: string[];
  size?: string;
  description?: string;
  headquarters_city?: string;
  headquarters_region?: string;
  headquarters_country?: string;
  culture_summary?: string;
}

// ═══════════════════════════════════════════════════════════════
// OPENAI API (GPT-4.1 nano)
// ═══════════════════════════════════════════════════════════════

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MODEL_NAME = 'gpt-4.1-nano';

// JSON Schema for structured output
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
      description: 'Type de contrat (CDI, CDD, Stage, Freelance, etc.)',
    },
    work_rhythm: {
      type: 'string',
      enum: Object.values(WORK_RHYTHM),
      description: 'Rythme de travail (Temps plein, Temps partiel, Flexible, Ponctuel)',
    },
    sectors: {
      type: 'array',
      items: {
        type: 'string',
        enum: Object.values(SECTORS),
      },
      minItems: 2,
      maxItems: 5,
      description: 'Secteurs d\'activité pertinents (2-5 secteurs obligatoires)',
    },
    compensation_min: {
      type: 'number',
      description: 'Salaire minimum (en XOF par défaut)',
    },
    compensation_max: {
      type: 'number',
      description: 'Salaire maximum (en XOF par défaut)',
    },
    currency: {
      type: 'string',
      description: 'Code devise ISO 4217 (défaut: XOF)',
    },
    compensation_frequency: {
      type: 'string',
      enum: Object.values(COMPENSATION_FREQUENCY),
      description: 'Fréquence de paiement',
    },
    location_type: {
      type: 'string',
      enum: Object.values(LOCATION_TYPE),
      description: 'Type de lieu de travail',
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
      description: 'Lieux de travail possibles',
    },
    duration: {
      type: 'string',
      description: 'Durée du contrat si applicable (ex: "6 mois", "1 an")',
    },
    deadline_days: {
      type: 'number',
      description: 'Nombre de jours à partir d\'aujourd\'hui pour la date limite de candidature (14-60 jours selon le type)',
    },
    cv_required: {
      type: 'boolean',
      description: 'CV requis pour postuler',
    },
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
      description: 'Questions personnalisées pour les candidats (max 3)',
    },
    target_profiles: {
      type: 'array',
      items: {
        type: 'string',
        enum: Object.values(PROFILE_TAG),
      },
      maxItems: 4,
      description: 'Profils cibles pour cette opportunité',
    },
    ideal_candidate_summary: {
      type: 'string',
      description: 'Description du candidat idéal (2-3 phrases)',
    },
  },
  required: [
    'suggested_title',
    'summary',
    'requirements',
    'nice_to_have',
    'contract_type',
    'work_rhythm',
    'sectors',
    'currency',
    'compensation_frequency',
    'location_type',
    'deadline_days',
    'cv_required',
    'application_questions',
    'target_profiles',
    'ideal_candidate_summary',
  ],
};

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

async function getOrganizationContext(organizationId: string): Promise<OrganizationContext | null> {
  try {
    const result = await pool.query(
      `SELECT name, type, sectors, size, description,
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
    console.error('Error fetching organization context:', error);
    return null;
  }
}

function buildPrompt(
  input: GenerationInput,
  organization: OrganizationContext
): string {
  const opportunityTypeLabels: Record<OpportunityType, string> = {
    EMPLOYMENT: 'Emploi',
    INTERNSHIP: 'Stage',
    ENTREPRENEURSHIP: 'Entrepreneuriat',
    ALTERNATION: 'Alternance',
    FREELANCE: 'Freelance',
    VOLUNTEER: 'Bénévolat',
  };

  const existingDataContext = input.existing_data
    ? `\n\nDonnées existantes du formulaire à prendre en compte:\n${JSON.stringify(input.existing_data, null, 2)}`
    : '';

  return `Tu es un expert en recrutement en Afrique francophone. Génère des données CONCISES.

ORGANISATION:
- Nom: ${organization.name}
- Type: ${organization.type || 'Non spécifié'}
- Secteurs: ${organization.sectors?.join(', ') || 'Non spécifié'}
- Localisation: ${[organization.headquarters_city, organization.headquarters_region, organization.headquarters_country].filter(Boolean).join(', ') || 'Non spécifié'}

OPPORTUNITÉ:
- Titre brut: "${input.title}"
- Type: ${opportunityTypeLabels[input.type]} (${input.type})
${existingDataContext}

INSTRUCTIONS CRITIQUES:
1. suggested_title: Corrige/améliore le titre (professionnel, max 60 car.)
2. summary: Description COURTE (150-300 car. MAX)
3. requirements: 3-5 points COURTS avec "• " (max 250 car.)
4. nice_to_have: 2-3 points COURTS avec "• " (max 150 car.)
5. sectors: Sélectionne 2-5 secteurs pertinents (OBLIGATOIRE)
6. deadline_days: Nombre de jours pour la deadline (Stage: 14-21j, Emploi: 30-45j, Consultation: 21-30j)
7. Questions de candidature: 2-3 questions courtes et pertinentes
8. Contenu en français, concis et professionnel

SALAIRES (XOF/mois) - Génère TOUJOURS compensation_min ET compensation_max:
- Stage/Apprentissage: min 50,000 - max 150,000
- Junior: min 150,000 - max 400,000
- Mid: min 400,000 - max 800,000
- Senior: min 800,000 - max 1,500,000

IMPORTANT: 
- Génère TOUJOURS compensation_min ET compensation_max (jamais seulement le minimum)
- Garde les textes COURTS et DIRECTS.`;
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

  // Build prompt with JSON schema instructions
  const prompt = buildPrompt(input, organization) + `\n\nIMPORTANT: Réponds UNIQUEMENT avec un JSON valide respectant ce schéma:
${JSON.stringify(OPPORTUNITY_SCHEMA, null, 2)}`;

  try {
    const response = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: [
        {
          role: 'system',
          content: 'Tu es un expert en recrutement. Réponds toujours en JSON valide.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_completion_tokens: 4096,
      response_format: { type: 'json_object' },
    });

    const generatedText = response.choices[0]?.message?.content;
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
    console.error('Error generating opportunity suggestion:', error);
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
