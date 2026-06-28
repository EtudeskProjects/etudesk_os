/**
 * Output Format Guardrail
 * Validates entity cards (only valid UUIDs), mode restrictions, and character count.
 * Logs violations for monitoring — does NOT block responses.
 */

import { logger } from '../../../utils';

/** Local OutputGuardrail type */
interface OutputGuardrail {
  name: string;
  execute: (params: { agentOutput: any; agent: any }) => Promise<{
    tripwireTriggered: boolean;
    outputInfo: Record<string, any>;
  }>;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ENTITY_CARD_REGEX = /```entity:(\w+)\s*\n\s*(\{[^}]*\})\s*\n\s*```/g;
const SUPPORTED_ENTITY_TYPES = new Set(['opportunity', 'community', 'space', 'organization', 'talent', 'document', 'event', 'skill', 'notification', 'maps']);

function getAllowedEntityTypes(mode?: string): Set<string> {
  if (mode === 'study') return new Set();
  if (mode === 'org') return new Set(['talent', 'opportunity', 'document', 'event', 'skill', 'notification', 'maps']);
  return SUPPORTED_ENTITY_TYPES;
}

function isValidMapsPayload(value: any): boolean {
  if (!value || typeof value !== 'object') return false;
  const latitude = Number(value.latitude ?? value.lat ?? value.coordinates?.latitude ?? value.coordinates?.lat);
  const longitude = Number(value.longitude ?? value.lng ?? value.coordinates?.longitude ?? value.coordinates?.lng);
  const hasCoords = Number.isFinite(latitude) && Number.isFinite(longitude);
  const hasUrl = typeof value.url === 'string' && value.url.trim().length > 0;
  const hasAddress = typeof value.address === 'string' && value.address.trim().length > 0;
  const hasLocation = typeof value.location === 'string' && value.location.trim().length > 0;
  return hasCoords || hasUrl || hasAddress || hasLocation;
}

interface OutputValidationResult {
  violations: string[];
  entityCardCount: number;
  textCharCount: number;
}

function validateOutput(text: string, mode?: string): OutputValidationResult {
  const violations: string[] = [];
  let entityCardCount = 0;
  const allowedEntityTypes = getAllowedEntityTypes(mode);

  // 1. Validate entity cards contain only valid UUIDs
  const cardMatches = [...text.matchAll(ENTITY_CARD_REGEX)];
  entityCardCount = cardMatches.length;

  for (const match of cardMatches) {
    try {
      const entityType = match[1];
      const json = JSON.parse(match[2]);
      if (!allowedEntityTypes.has(entityType)) {
        violations.push(`Unsupported entity card type: ${entityType}`);
      }
      if (entityType === 'maps') {
        if (!isValidMapsPayload(json)) {
          violations.push(`Invalid maps payload: ${JSON.stringify(json).slice(0, 100)}`);
        }
        continue;
      }
      if (!json.id || !UUID_REGEX.test(json.id)) {
        violations.push(`Invalid entity card ID: ${JSON.stringify(json).slice(0, 100)}`);
      }
      // Check for extra fields beyond 'id'
      const extraKeys = Object.keys(json).filter((k) => k !== 'id');
      if (extraKeys.length > 0) {
        violations.push(`Entity card has extra fields: ${extraKeys.join(', ')}`);
      }
    } catch {
      violations.push(`Malformed entity card JSON: ${match[2].slice(0, 100)}`);
    }
  }

  // 2. Study mode: NO entity cards at all (purely pedagogical)
  if (mode === 'study') {
    const blockedCards = text.match(/```entity:\w+/g);
    if (blockedCards) {
      violations.push(`Study mode: entity cards not allowed: ${blockedCards.join(', ')}`);
    }
  }

  // 3. Org mode: only the org whitelist is allowed
  if (mode === 'org') {
    const blockedOrgCards = text.match(/```entity:(?!talent|opportunity|document|event|skill|notification|maps)\w+/g);
    if (blockedOrgCards) {
      violations.push(`Org mode: blocked entity types: ${blockedOrgCards.join(', ')}`);
    }
  }

  // 4. Character count (text outside code blocks)
  const textOnly = text.replace(/```[\s\S]*?```/g, '').trim();
  const maxChars = mode === 'study' ? 6000 : 5000;
  const textCharCount = textOnly.length;

  if (textCharCount > maxChars) {
    violations.push(`Text exceeds ${maxChars} chars: ${textCharCount} chars`);
  }

  return { violations, entityCardCount, textCharCount };
}

/**
 * Extract mode from agent name:
 * - "Talent Agent (study)" → "study"
 * - "Talent Agent (explore)" → "explore"
 * - "Organization Explorer" → "org"
 */
function extractModeFromAgent(agent: any): string | undefined {
  const name = agent?.name as string | undefined;
  if (!name) return undefined;
  if (name.includes('study')) return 'study';
  if (name.includes('Organization')) return 'org';
  if (name.includes('explore')) return 'explore';
  return undefined;
}

/**
 * Sanitize output text — removes invalid entity cards before sending to client.
 * - Study mode: remove ALL entity cards (purely pedagogical)
 * - Invalid UUID: remove the card
 * - Org mode: remove cards with types not in whitelist
 * - Cleans up triple-newlines after removals
 * Returns the sanitized text (unchanged if no issues).
 */
export function sanitizeOutput(text: string, mode?: string): string {
  if (!text) return text;
  let result = text;
  const allowedEntityTypes = getAllowedEntityTypes(mode);

  // Study mode: remove ALL entity cards
  if (mode === 'study') {
    result = result.replace(/```entity:\w+\s*\n\s*\{[^}]*\}\s*\n\s*```/g, '');
  } else {
    // Remove cards with unsupported entity types for the current mode/frontend.
    result = result.replace(/```entity:(\w+)\s*\n\s*\{[^}]*\}\s*\n\s*```/g, (fullMatch, entityType) => {
      return allowedEntityTypes.has(entityType) ? fullMatch : '';
    });

    // Remove cards with invalid UUIDs
    result = result.replace(/```entity:(\w+)\s*\n\s*(\{[^}]*\})\s*\n\s*```/g, (fullMatch, entityType, jsonStr) => {
      try {
        const json = JSON.parse(jsonStr);
        if (entityType === 'maps') {
          return isValidMapsPayload(json) ? fullMatch : '';
        }
        if (!json.id || !UUID_REGEX.test(json.id)) {
          return '';
        }
      } catch {
        return ''; // Malformed JSON → remove
      }
      return fullMatch;
    });

  }

  // Clean up triple-newlines left by removals
  result = result.replace(/\n{3,}/g, '\n\n');

  return result;
}

export const outputFormatGuardrail: OutputGuardrail = {
  name: 'output_format',
  execute: async ({ agentOutput, agent }) => {
    try {
      const text = typeof agentOutput === 'string'
        ? agentOutput
        : (agentOutput as any)?.value || '';

      if (!text) {
        return { tripwireTriggered: false, outputInfo: { status: 'empty_output' } };
      }

      const mode = extractModeFromAgent(agent);
      const result = validateOutput(text, mode);

      if (result.violations.length > 0) {
        logger.warn(`[output_format] Violations detected: ${result.violations.join(' | ')}`);
      }

      // Log violations but do NOT block (tripwire = false)
      return {
        tripwireTriggered: false,
        outputInfo: {
          violations: result.violations,
          entityCardCount: result.entityCardCount,
          textCharCount: result.textCharCount,
          hasViolations: result.violations.length > 0,
        },
      };
    } catch (error: any) {
      logger.error(`[output_format] Guardrail error: ${error.message}`);
      return { tripwireTriggered: false, outputInfo: { error: error.message } };
    }
  },
};
