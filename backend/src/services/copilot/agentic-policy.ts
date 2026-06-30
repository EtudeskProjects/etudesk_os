/**
 * Shared agentic runtime policy.
 *
 * OpenAI-compatible open models are strongest when tool use is explicit,
 * sequential, and bounded. Keep this file as the single source of truth for
 * production SSE runs and calibration harnesses.
 */

import OpenAI from 'openai';
import type { AgentConfig, ToolDefinition } from './tools/tool-helper';

export const AGENTIC_LIMITS = {
  maxTurns: Number(process.env.COPILOT_MAX_TURNS || 15),
  maxToolCalls: Number(process.env.COPILOT_MAX_TOOL_CALLS || 20),
  maxSameToolCalls: Number(process.env.COPILOT_MAX_SAME_TOOL_CALLS || 3),
  maxTurnDurationMs: Number(process.env.COPILOT_MAX_TURN_DURATION_MS || 120_000),
  maxOutputTokensPerQuery: Number(process.env.COPILOT_MAX_OUTPUT_TOKENS || 12_000),
  maxCompletionTokens: Number(process.env.COPILOT_MAX_COMPLETION_TOKENS || 1600),
} as const;

export const PER_TOOL_CALL_LIMITS: Record<string, number> = {
  smart_search: 2,
  web_search: 1,
  find_competency: 3,
};

export const SQL_INTENT_CALL_LIMITS: Record<string, number> = {
  org_talent_profile: 3,
};

export function buildChatCompletionTools(tools: ToolDefinition[]): OpenAI.Chat.ChatCompletionTool[] {
  return tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.definition.name,
      description: t.definition.description,
      parameters: (t.definition.input_schema as Record<string, unknown>) ?? { type: 'object', properties: {} },
    },
  }));
}

export function buildAgentSystemText(agentConfig: Pick<AgentConfig, 'systemPrompt' | 'systemPromptStatic'>): string {
  return agentConfig.systemPromptStatic
    ? `${agentConfig.systemPromptStatic}\n\n${agentConfig.systemPrompt}`
    : agentConfig.systemPrompt;
}

export function getAgentCompletionOptions(): {
  max_tokens: number;
  temperature: number;
  parallel_tool_calls: boolean;
} {
  return {
    max_tokens: AGENTIC_LIMITS.maxCompletionTokens,
    // Low temperature improves JSON/function-call determinism. Keep top_p at the
    // provider default; combining both controls tends to make open tool callers
    // brittle without improving answer quality.
    temperature: Number(process.env.COPILOT_AGENT_TEMPERATURE || 0.2),
    // Sequential tools are easier to cache, summarize, and debug. The model can
    // still call several tools across turns when the result of one determines the next.
    parallel_tool_calls: false,
  };
}

export function buildToolPreface(toolName: string): string {
  switch (toolName) {
    case 'smart_search':
      return 'Je vérifie les résultats disponibles.\n\n';
    case 'sql_query':
      return 'Je consulte les données disponibles.\n\n';
    case 'file_reader':
      return 'Je lis le document avant de répondre.\n\n';
    case 'web_search':
      return 'Je vérifie les sources externes utiles.\n\n';
    default:
      return 'Je vérifie les données utiles.\n\n';
  }
}

export function inferInitialToolChoice(
  mode: AgentConfig['mode'],
  message: string
): OpenAI.Chat.ChatCompletionToolChoiceOption | undefined {
  const m = message.toLowerCase();

  if (mode === 'explore') {
    if (/\b(espaces?|coworking|salles?|studios?|réserver|reserver)\b/.test(m)) {
      return { type: 'function', function: { name: 'smart_search' } };
    }
    if (/\b(opportunit\w*|offres?|postes?|emplois?|stages?|jobs?)\b/.test(m)) {
      return { type: 'function', function: { name: 'smart_search' } };
    }
    if (/\b(communaut\w*|groupes?|networks?|réseaux?|reseaux?)\b/.test(m) && !/\b(mes|actualit\w*|quoi de neuf|feed|activit\w*)\b/.test(m)) {
      return { type: 'function', function: { name: 'smart_search' } };
    }
  }

  if (mode === 'org') {
    if (/\b(recrut|profil|profils|candidat|candidats|shortlist|talent|talents)\b/.test(m)) {
      return { type: 'function', function: { name: 'sql_query' } };
    }
    if (/\b(dashboard|tableau de bord|comment se porte|état|etat|stats|statistiques)\b/.test(m)) {
      return { type: 'function', function: { name: 'sql_query' } };
    }
  }

  return undefined;
}

export function inferRequiredCompletionTool(mode: AgentConfig['mode'], message: string): string | undefined {
  const m = message.toLowerCase();

  if (mode === 'explore' && /\b(cv|curriculum|resume|résumé)\b/.test(m)) {
    return 'generate_document';
  }

  if (mode === 'org' && /\b(fiche de poste|job description|description de poste)\b/.test(m)) {
    return 'generate_document';
  }

  return undefined;
}

export function buildMissingRequiredToolMessage(toolName: string): string {
  return `The requested task is not complete. You must call ${toolName} now and only then provide the final answer with the returned entity id.`;
}

export function enforceToolCallLimit(args: {
  toolName: string;
  toolInput: any;
  toolNameCount: number;
  sqlIntentCounts: Map<string, number>;
}): { limited: false } | { limited: true; output: Record<string, unknown> } {
  const perToolLimit = PER_TOOL_CALL_LIMITS[args.toolName];
  if (perToolLimit && args.toolNameCount > perToolLimit) {
    return {
      limited: true,
      output: {
        _tool_limit: true,
        _cached: true,
        message: `${args.toolName} call limit reached for this run. Synthesize the answer from previous tool results and do not call this tool again.`,
      },
    };
  }

  if (args.toolName !== 'sql_query') {
    return { limited: false };
  }

  const sqlIntent = args.toolInput?.intent;
  const sqlIntentLimit = sqlIntent ? SQL_INTENT_CALL_LIMITS[sqlIntent] : undefined;
  const sqlIntentCount = sqlIntent ? (args.sqlIntentCounts.get(sqlIntent) || 0) + 1 : 0;
  if (sqlIntent) args.sqlIntentCounts.set(sqlIntent, sqlIntentCount);

  if (sqlIntentLimit && sqlIntentCount > sqlIntentLimit) {
    return {
      limited: true,
      output: {
        _tool_limit: true,
        _cached: true,
        message: `${sqlIntent} call limit reached for this run. Rank/synthesize from org_talents and the profiles already loaded; do not inspect more profiles.`,
      },
    };
  }

  return { limited: false };
}
