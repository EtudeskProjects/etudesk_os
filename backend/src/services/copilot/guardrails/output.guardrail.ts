/**
 * Output Format Guardrail
 * Validates entity cards (only valid UUIDs), mode restrictions, and character count.
 * Logs violations for monitoring — does NOT block responses.
 */

import type { OutputGuardrail } from '@openai/agents';
import { logger } from '../../../utils';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ENTITY_CARD_REGEX = /```entity:\w+\s*\n\s*(\{[^}]*\})\s*\n\s*```/g;

interface OutputValidationResult {
  violations: string[];
  entityCardCount: number;
  textCharCount: number;
}

function validateOutput(text: string, mode?: string): OutputValidationResult {
  const violations: string[] = [];
  let entityCardCount = 0;

  // 1. Validate entity cards contain only valid UUIDs
  const cardMatches = [...text.matchAll(ENTITY_CARD_REGEX)];
  entityCardCount = cardMatches.length;

  for (const match of cardMatches) {
    try {
      const json = JSON.parse(match[1]);
      if (!json.id || !UUID_REGEX.test(json.id)) {
        violations.push(`Invalid entity card ID: ${JSON.stringify(json).slice(0, 100)}`);
      }
      // Check for extra fields beyond 'id'
      const extraKeys = Object.keys(json).filter((k) => k !== 'id');
      if (extraKeys.length > 0) {
        violations.push(`Entity card has extra fields: ${extraKeys.join(', ')}`);
      }
    } catch {
      violations.push(`Malformed entity card JSON: ${match[1].slice(0, 100)}`);
    }
  }

  // 2. Study mode: NO entity cards at all (purely pedagogical)
  if (mode === 'study') {
    const blockedCards = text.match(/```entity:\w+/g);
    if (blockedCards) {
      violations.push(`Study mode: entity cards not allowed: ${blockedCards.join(', ')}`);
    }
  }

  // 3. Org mode: only talent and opportunity entity cards allowed
  if (mode === 'org') {
    const blockedOrgCards = text.match(/```entity:(?!talent|opportunity|document)\w+/g);
    if (blockedOrgCards) {
      violations.push(`Org mode: blocked entity types: ${blockedOrgCards.join(', ')}`);
    }
  }

  // 4. Character count (text outside code blocks)
  const textOnly = text.replace(/```[\s\S]*?```/g, '').trim();
  const maxChars = mode === 'study' ? 1200 : 800;
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
