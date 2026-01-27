/**
 * Space Generation Service
 * Uses GPT-4.1 nano for AI-powered space form generation
 * with structured outputs
 */

import OpenAI from 'openai';
import { pool } from './database';
import {
  Sector,
  SECTORS,
} from '../types/models';
import { SpaceType, SPACE_TYPES } from '../types/space.types';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface GenerationInput {
  name: string;
  type: SpaceType;
  organization_id: string;
  // Optional existing form data for context
  existing_data?: Partial<GeneratedSpace>;
}

export interface GeneratedSpace {
  suggested_name?: string;
  description?: string;
  sectors?: Sector[];
  equipment?: string[];
  amenities?: string[];
  surface_m2?: number;
  capacity?: number;
  rules?: string;
  hourly_rate?: number;
  daily_rate?: number;
  weekly_rate?: number;
  monthly_rate?: number;
  questions?: string[];
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
}

// ═══════════════════════════════════════════════════════════════
// OPENAI API (GPT-4.1 nano)
// ═══════════════════════════════════════════════════════════════

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MODEL_NAME = 'gpt-4.1-nano';

// Space equipment types (from space types)
const SPACE_EQUIPMENT = [
  'VIDEOPROJECTOR',
  'WHITEBOARD',
  'SCREEN',
  'MICROPHONE',
  'SPEAKER',
  'COMPUTER',
  'PRINTER',
  'WEBCAM',
  'WIFI',
  'AIR_CONDITIONING',
  'HEATING',
];

// Space amenities
const SPACE_AMENITIES = [
  'WIFI',
  'PARKING',
  'CAFETERIA',
  'RESTROOM',
  'ELEVATOR',
  'SECURITY',
];

// JSON Schema for structured output
const SPACE_SCHEMA = {
  type: 'object',
  properties: {
    suggested_name: {
      type: 'string',
      description: 'Nom amélioré pour l\'espace (max 60 caractères)',
    },
    description: {
      type: 'string',
      description: 'Description de l\'espace (300-500 caractères)',
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
    equipment: {
      type: 'array',
      items: {
        type: 'string',
        enum: SPACE_EQUIPMENT,
      },
      description: 'Équipements suggérés pour ce type d\'espace',
    },
    amenities: {
      type: 'array',
      items: {
        type: 'string',
        enum: SPACE_AMENITIES,
      },
      description: 'Services/commodités suggérés',
    },
    surface_m2: {
      type: 'number',
      description: 'Surface suggérée en m² selon le type d\'espace',
    },
    capacity: {
      type: 'number',
      description: 'Capacité suggérée en nombre de personnes',
    },
    rules: {
      type: 'string',
      description: 'Règlements intérieurs (3-5 points avec "• " comme puce, séparés par \\n, max 1000 caractères)',
    },
    hourly_rate: {
      type: 'number',
      description: 'Tarif horaire suggéré en XOF',
    },
    daily_rate: {
      type: 'number',
      description: 'Tarif journalier suggéré en XOF',
    },
    weekly_rate: {
      type: 'number',
      description: 'Tarif hebdomadaire suggéré en XOF',
    },
    monthly_rate: {
      type: 'number',
      description: 'Tarif mensuel suggéré en XOF',
    },
    questions: {
      type: 'array',
      items: {
        type: 'string',
      },
      maxItems: 5,
      description: 'Questions complémentaires pour les réservations (max 5 questions courtes)',
    },
  },
  required: ['description', 'sectors'],
};

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

async function getOrganizationContext(organizationId: string): Promise<OrganizationContext | null> {
  try {
    const result = await pool.query(
      `SELECT name, type, sectors, size, description,
              headquarters_city, headquarters_region, headquarters_country
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
  const sectorsList = Object.values(SECTORS).join(',');
  const spaceTypeLabel = input.type.replace(/_/g, ' ').toLowerCase();
  
  return `Génère des suggestions pour un espace "${input.name}" de type ${spaceTypeLabel} (org: ${organization.name}, ${organization.type || 'N/A'}).

REQUIS en JSON:
- suggested_name: nom amélioré (max 60 car)
- description: 300-500 car, caractéristiques et usage
- sectors: 1-5 parmi [${sectorsList}]
- equipment: équipements pertinents pour ${spaceTypeLabel}
- amenities: services/commodités (WIFI souvent inclus)
- surface_m2: surface typique en m² pour ce type d'espace
- capacity: capacité typique en nombre de personnes
- rules: règlements intérieurs (3-5 points avec "• " comme puce, séparés par \\n)
- hourly_rate: tarif horaire XOF (suggérer selon type et localisation)
- daily_rate: tarif journalier XOF
- weekly_rate: tarif hebdomadaire XOF (optionnel)
- monthly_rate: tarif mensuel XOF (optionnel)
- questions: 2-4 questions pour réservations (max 5)

Français, concis, professionnel.`;
}

// ═══════════════════════════════════════════════════════════════
// MAIN SERVICE FUNCTION
// ═══════════════════════════════════════════════════════════════

export async function generateSpaceSuggestion(
  input: GenerationInput
): Promise<{
  success: boolean;
  data?: GeneratedSpace;
  error?: string;
}> {
  if (!process.env.OPENAI_API_KEY) {
    return { success: false, error: 'OPENAI_API_KEY not configured' };
  }

  // Validate required fields
  if (!input.name || input.name.length < 3) {
    return { success: false, error: 'Name must be at least 3 characters' };
  }

  if (!input.type || !Object.values(SPACE_TYPES).includes(input.type)) {
    return { success: false, error: 'Invalid space type' };
  }

  // Get organization context
  const organization = await getOrganizationContext(input.organization_id);
  if (!organization) {
    return { success: false, error: 'Organization not found' };
  }

  // Build prompt
  const prompt = buildPrompt(input, organization);

  try {
    console.log('[SpaceGeneration] Starting generation for:', input.name);
    const startTime = Date.now();

    const response = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: [
        {
          role: 'system',
          content: 'Tu es un expert en gestion d\'espaces réservables. Réponds toujours en JSON valide.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_completion_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    console.log(`[SpaceGeneration] Completed in ${Date.now() - startTime}ms`);

    const generatedText = response.choices[0]?.message?.content;
    if (!generatedText) {
      return { success: false, error: 'No response from AI model' };
    }

    const generatedData: GeneratedSpace = JSON.parse(generatedText);

    // Ensure sectors are valid
    if (generatedData.sectors) {
      generatedData.sectors = generatedData.sectors
        .filter(s => Object.values(SECTORS).includes(s as Sector))
        .slice(0, 5) as Sector[];
    }

    return { success: true, data: generatedData };
  } catch (error) {
    console.error('Error generating space suggestion:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Generation failed',
    };
  }
}

// ═══════════════════════════════════════════════════════════════
