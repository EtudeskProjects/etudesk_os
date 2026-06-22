/**
 * Community Generation Service
 * Uses Agents SDK with GPT-4.1-nano for AI-powered community form generation
 */

import { MODEL_SUGGESTION } from './ai/models';
import { getSuggestionClient } from './ai/provider';
import { pool } from './database';
import {
  CommunityType,
  Visibility,
  Sector,
  COMMUNITY_TYPE,
  VISIBILITY,
  SECTORS,
} from '../types/models';
import { buildCommunityGenPrompt, buildCommunityGenSystemPrompt } from './ai/prompts/community-gen.prompt';
import { FALLBACK_LANGUAGE, SupportedLanguage } from '../i18n';
import { getLanguageDisplayName } from './language-preference.service';

import { logger } from '../utils';

export interface GenerationInput {
  name: string;
  organization_id: string;
  language?: SupportedLanguage;
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
  application_questions?: string[];
}

interface OrganizationContext {
  name: string;
  types?: string[];
  sectors?: string[];
  description?: string;
  headquarters_city?: string;
  headquarters_region?: string;
  headquarters_country?: string;
  culture_summary?: string;
}

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

  // Build prompt
  const language = input.language || FALLBACK_LANGUAGE;
  const languageName = getLanguageDisplayName(language);
  const orgLocation = [organization.headquarters_city, organization.headquarters_region, organization.headquarters_country].filter(Boolean).join(', ') || 'Non spécifié';
  const prompt = buildCommunityGenPrompt({
    communityName: input.name,
    orgName: organization.name,
    orgType: organization.types?.join(', ') || 'N/A',
    orgSectors: organization.sectors?.join(', ') || 'Non spécifié',
    orgDescription: organization.description || '',
    orgLocation,
    sectorsList: Object.values(SECTORS).join(','),
    languageName,
  });

  try {
    logger.info('[CommunityGeneration] Starting generation', { name: input.name });
    const startTime = Date.now();

    const openai = getSuggestionClient();
    const completion = await openai.chat.completions.create({
      model: MODEL_SUGGESTION,
      messages: [
        { role: 'system', content: buildCommunityGenSystemPrompt(languageName) },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
    });

    logger.info(`[CommunityGeneration] Completed in ${Date.now() - startTime}ms`);

    const generatedText = completion.choices[0]?.message?.content;
    if (!generatedText) {
      return { success: false, error: 'No response from AI model' };
    }

    const generatedData: GeneratedCommunity = JSON.parse(generatedText);

    // Ensure sectors are valid enum values; fallback to org sectors
    if (generatedData.sectors) {
      generatedData.sectors = generatedData.sectors
        .filter(s => Object.values(SECTORS).includes(s as Sector))
        .slice(0, 5) as Sector[];
    }
    if (!generatedData.sectors || generatedData.sectors.length === 0) {
      generatedData.sectors = (organization.sectors || [])
        .filter(s => Object.values(SECTORS).includes(s as Sector))
        .slice(0, 5) as Sector[];
    }

    return { success: true, data: generatedData };
  } catch (error) {
    logger.error('Error generating community suggestion:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Generation failed',
    };
  }
}

// --- Validation Helper ---

export function canGenerate(name?: string): boolean {
  return !!(name && name.length >= 3);
}
