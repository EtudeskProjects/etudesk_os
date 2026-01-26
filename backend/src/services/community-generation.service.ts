/**
 * Community Generation Service
 * Uses GPT-4.1 nano for AI-powered community form generation
 * with structured outputs
 */

import OpenAI from 'openai';
import { pool } from './database';
import {
  CommunityType,
  Visibility,
  Sector,
  COMMUNITY_TYPE,
  VISIBILITY,
  SECTORS,
} from '../types/models';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface GenerationInput {
  name: string;
  organization_id: string;
  // Optional existing form data for context
  existing_data?: Partial<GeneratedCommunity>;
}

export interface GeneratedCommunity {
  suggested_name?: string;
  description?: string;
  tags?: string[];
  sectors?: Sector[];
  rules?: string;
  visibility?: Visibility;
  is_paid?: boolean;
  monthly_price?: number;
  currency?: string;
  application_questions?: string[];
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

// Community tags (from mobile constants - these match the frontend)
const COMMUNITY_TAGS = [
  'PROFESSIONAL',
  'STUDENT',
  'ENTREPRENEUR',
  'TECH',
  'CREATIVE',
  'SOCIAL_IMPACT',
  'ALUMNI',
  'WOMEN',
  'YOUTH',
  'CLUB_ASSOCIATION',
];

// JSON Schema for structured output
const COMMUNITY_SCHEMA = {
  type: 'object',
  properties: {
    suggested_name: {
      type: 'string',
      description: 'Nom amélioré pour la communauté (max 60 caractères)',
    },
    description: {
      type: 'string',
      description: 'Description de la communauté (500-1000 caractères)',
    },
    tags: {
      type: 'array',
      items: {
        type: 'string',
        enum: COMMUNITY_TAGS,
      },
      minItems: 1,
      maxItems: 3,
      description: 'Tags de la communauté (1-3 tags obligatoires)',
    },
    sectors: {
      type: 'array',
      items: {
        type: 'string',
        enum: Object.values(SECTORS),
      },
      minItems: 1,
      maxItems: 5,
      description: 'Secteurs d\'activité pertinents (1-5 secteurs)',
    },
    rules: {
      type: 'string',
      description: 'Règles de la communauté (3-5 points avec "• " comme puce, séparés par un retour à la ligne \\n, max 500 caractères)',
    },
    visibility: {
      type: 'string',
      enum: Object.values(VISIBILITY),
      description: 'Visibilité de la communauté (PUBLIC ou PRIVATE)',
    },
    is_paid: {
      type: 'boolean',
      description: 'Indique si la communauté est payante',
    },
    monthly_price: {
      type: 'number',
      description: 'Prix mensuel de l\'abonnement si is_paid est true (en XOF par défaut)',
    },
    currency: {
      type: 'string',
      description: 'Code devise ISO 4217 (défaut: XOF)',
    },
    application_questions: {
      type: 'array',
      items: {
        type: 'string',
      },
      maxItems: 5,
      description: 'Questions complémentaires pour les candidats (max 5 questions courtes)',
    },
  },
  required: ['description', 'tags', 'sectors', 'visibility'],
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
  // Prompt optimisé pour réduire les tokens et accélérer la génération
  const sectorsList = Object.values(SECTORS).join(',');
  return `Génère une communauté pour "${input.name}" (org: ${organization.name}, ${organization.type || 'N/A'}).

REQUIS en JSON:
- suggested_name: nom amélioré (max 60 car)
- description: 500-800 car, objectifs/mission
- tags: 1-3 parmi [PROFESSIONAL,STUDENT,ENTREPRENEUR,TECH,CREATIVE,SOCIAL_IMPACT,ALUMNI,WOMEN,YOUTH,CLUB_ASSOCIATION]
- sectors: 1-5 parmi [${sectorsList}]
- rules: 3-5 règles avec "• " comme puce, séparées par \\n
- visibility: PUBLIC ou PRIVATE
- is_paid: boolean (généralement false)
- monthly_price: si payant, 5000-50000 XOF
- application_questions: 2-4 questions courtes

Français, concis, professionnel.`;
}

// ═══════════════════════════════════════════════════════════════
// MAIN SERVICE FUNCTION
// ═══════════════════════════════════════════════════════════════

export async function generateCommunitySuggestion(
  input: GenerationInput
): Promise<{
  success: boolean;
  data?: GeneratedCommunity;
  error?: string;
}> {
  if (!process.env.OPENAI_API_KEY) {
    return { success: false, error: 'OPENAI_API_KEY not configured' };
  }

  // Validate required fields
  if (!input.name || input.name.length < 3) {
    return { success: false, error: 'Name must be at least 3 characters' };
  }

  // Get organization context
  const organization = await getOrganizationContext(input.organization_id);
  if (!organization) {
    return { success: false, error: 'Organization not found' };
  }

  // Build prompt (optimisé sans schéma JSON complet pour réduire les tokens)
  const prompt = buildPrompt(input, organization);

  try {
    console.log('[CommunityGeneration] Starting generation for:', input.name);
    const startTime = Date.now();

    const response = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: [
        {
          role: 'system',
          content: 'Tu es un expert en création de communautés en ligne. Réponds toujours en JSON valide.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_completion_tokens: 1500, // Réduit de 4096 - suffisant pour la réponse
      response_format: { type: 'json_object' },
    });

    console.log(`[CommunityGeneration] Completed in ${Date.now() - startTime}ms`);

    const generatedText = response.choices[0]?.message?.content;
    if (!generatedText) {
      return { success: false, error: 'No response from AI model' };
    }

    const generatedData: GeneratedCommunity = JSON.parse(generatedText);

    // Set default currency if not provided
    if (!generatedData.currency) {
      generatedData.currency = 'XOF';
    }

    // Ensure monthly_price is set if is_paid is true
    if (generatedData.is_paid && !generatedData.monthly_price) {
      generatedData.monthly_price = 10000; // Default 10,000 XOF
    }

    return { success: true, data: generatedData };
  } catch (error) {
    console.error('Error generating community suggestion:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Generation failed',
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// VALIDATION HELPER
// ═══════════════════════════════════════════════════════════════

export function canGenerate(name?: string): boolean {
  return !!(name && name.length >= 3);
}
