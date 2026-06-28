/**
 * Space Generation Service
 * Uses Agents SDK with GPT-4.1-nano for AI-powered space form generation
 */

import { MODEL_SUGGESTION } from './ai/models';
import { getSuggestionClient } from './ai/provider';
import { recordUsage } from './ai/usage.service';
import { pool } from './database';
import {
  Sector,
  SECTORS,
} from '../types/models';
import { SpaceType, SPACE_TYPES } from '../types/space.types';
import { buildSpaceGenPrompt, buildSpaceGenSystemPrompt } from './ai/prompts/space-gen.prompt';
import { resolveSkillSuggestions, type ResolvedSkillSuggestion } from './skills/catalog.service';
import { FALLBACK_LANGUAGE, SupportedLanguage } from '../i18n';
import { getLanguageDisplayName } from './language-preference.service';

import { logger } from '../utils';

export interface GenerationInput {
  name: string;
  type: SpaceType;
  organization_id: string;
  language?: SupportedLanguage;
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
  // Catalog-resolved hard skills / tools the space enables (role: validates)
  skills?: ResolvedSkillSuggestion[];
}

interface OrganizationContext {
  name: string;
  types?: string[];
  sectors?: string[];
  description?: string;
  headquarters_city?: string;
  headquarters_region?: string;
  headquarters_country?: string;
}

// --- Helper Functions ---

async function getOrganizationContext(organizationId: string): Promise<OrganizationContext | null> {
  try {
    const result = await pool.query(
      `SELECT name, types, sectors, description,
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
    logger.error('Error fetching organization context:', error);
    return null;
  }
}

// --- Main Service Function ---

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
  const language = input.language || FALLBACK_LANGUAGE;
  const languageName = getLanguageDisplayName(language);
  const spaceTypeLabel = input.type.replace(/_/g, ' ').toLowerCase();
  const orgLocation = [organization.headquarters_city, organization.headquarters_region, organization.headquarters_country].filter(Boolean).join(', ') || 'Non spécifié';
  const prompt = buildSpaceGenPrompt({
    spaceName: input.name,
    spaceTypeLabel,
    orgName: organization.name,
    orgType: organization.types?.join(', ') || 'N/A',
    orgSectors: organization.sectors?.join(', ') || 'Non spécifié',
    orgDescription: organization.description || '',
    orgLocation,
    sectorsList: Object.values(SECTORS).join(','),
    languageName,
  });

  try {
    logger.info('[SpaceGeneration] Starting generation', { name: input.name });
    const startTime = Date.now();

    const openai = getSuggestionClient();
    const completion = await openai.chat.completions.create({
      model: MODEL_SUGGESTION,
      messages: [
        { role: 'system', content: buildSpaceGenSystemPrompt(languageName) },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
    });

    logger.info(`[SpaceGeneration] Completed in ${Date.now() - startTime}ms`);

    void recordUsage({ feature: 'form_suggestion', model: MODEL_SUGGESTION, usage: completion.usage, scopeOrganizationId: input.organization_id });

    const generatedText = completion.choices[0]?.message?.content;
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

    // Resolve suggested skills to the referential (catalog = single source of truth).
    generatedData.skills = await resolveSkillSuggestions(generatedData.skills as any);

    return { success: true, data: generatedData };
  } catch (error) {
    logger.error('Error generating space suggestion:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Generation failed',
    };
  }
}
