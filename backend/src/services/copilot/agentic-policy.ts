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
  maxCostUsdPerQuery: Number(process.env.COPILOT_MAX_COST_USD || 0.029),
  maxCompletionTokens: Number(process.env.COPILOT_MAX_COMPLETION_TOKENS || 1800),
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

/** Flat function schema required by the Responses API. */
export function buildResponsesTools(tools: ToolDefinition[]): Array<Record<string, unknown>> {
  return tools.map((t) => ({
    type: 'function',
    name: t.definition.name,
    description: t.definition.description,
    parameters: (t.definition.input_schema as Record<string, unknown>) ?? { type: 'object', properties: {} },
    strict: false,
  }));
}

type ToolProfile = {
  tools: ToolDefinition[];
  reason: string;
};

function byNames(tools: ToolDefinition[], names: string[]): ToolDefinition[] {
  const wanted = new Set(names);
  const selected = tools.filter((tool) => wanted.has(tool.definition.name));
  return selected.length > 0 ? selected : tools;
}

/**
 * Keep the full agent behavior available for ambiguous requests, but send a
 * smaller tool schema set for clear intents. This reduces prompt size and
 * makes tool choice faster without changing the model or business prompt.
 */
export function selectToolsForMessage(
  mode: AgentConfig['mode'],
  message: string,
  tools: ToolDefinition[]
): ToolProfile {
  const m = message.toLowerCase();
  const hasAttachmentMarker = /\[(pièces jointes|pieces jointes|attachments?|uploaded_document)/i.test(message);

  if (hasAttachmentMarker) {
    return {
      tools: byNames(tools, ['file_reader', 'generate_document', 'sql_query']),
      reason: 'attachment',
    };
  }

  if (mode === 'explore') {
    if (/\b(explique(?:-moi)?|conseil(?:s)?|définition|definition|c.?est quoi|comment (?:me )?préparer|aide-moi|aide moi)\b/.test(m)) {
      return { tools: [], reason: 'explore_guidance' };
    }
    if (/\b(opportunit\w*|offres?|postes?|emplois?|stages?|jobs?|espaces?|coworking|salles?|studios?|réserver|reserver)\b/.test(m)) {
      return {
        tools: byNames(tools, ['smart_search', 'sql_query', 'execute_action']),
        reason: 'explore_discovery',
      };
    }
    if (/\b(communaut\w*|groupes?|networks?|réseaux?|reseaux?)\b/.test(m) && !/\b(mes|actualit\w*|quoi de neuf|feed|activit\w*)\b/.test(m)) {
      return {
        tools: byNames(tools, ['smart_search', 'sql_query', 'execute_action']),
        reason: 'explore_community_discovery',
      };
    }
    if (/\b(cv|curriculum|resume|résumé)\b/.test(m)) {
      return {
        tools: byNames(tools, ['sql_query', 'generate_document', 'file_reader']),
        reason: 'explore_document_generation',
      };
    }
    if (/\b(comment devenir|devenir|roadmap|parcours|manque|gaps?|écarts?|ecarts?)\b/.test(m)) {
      return {
        tools: byNames(tools, ['learning_path', 'competency_graph', 'find_competency', 'smart_search']),
        reason: 'explore_learning_path',
      };
    }
    if (/\b(bilan|diagnostic|profil|profile|compétence|competence|compétences|competences)\b/.test(m)) {
      return {
        tools: byNames(tools, ['sql_query', 'learning_path', 'find_competency', 'competency_graph']),
        reason: 'explore_profile_diagnostic',
      };
    }
  }

  if (mode === 'study') {
    if (/\b(image|illustration|schéma|schema|diagramme|diagram)\b/.test(m)) {
      return {
        tools: byNames(tools, ['generate_image', 'generate_diagram', 'file_reader']),
        reason: 'study_visual',
      };
    }
    if (/\b(video|youtube|cours vidéo|cours video)\b/.test(m)) {
      return {
        tools: byNames(tools, ['youtube_search', 'web_search', 'learning_path']),
        reason: 'study_video',
      };
    }
    if (/\b(compétence|competence|skill|niveau|valide|valider|ajoute|ajouter)\b/.test(m)) {
      return {
        tools: byNames(tools, ['manage_skills', 'find_competency', 'competency_graph', 'learning_path']),
        reason: 'study_skills',
      };
    }
    if (/\b(quiz|qcm|flashcards?|questionnaire|explique(?:-moi)?|définition|definition|c.?est quoi)\b/.test(m)) {
      // These assets are emitted directly in the answer. Supplying the complete
      // tool catalogue only wastes context and encourages needless tool calls.
      return { tools: [], reason: 'study_inline_asset' };
    }
  }

  if (mode === 'org') {
    if (/\b(fiche de poste|job description|description de poste)\b/.test(m)) {
      return {
        tools: byNames(tools, ['sql_query', 'generate_document', 'find_competency']),
        reason: 'org_document_generation',
      };
    }
    if (/\b(recrut|profil|profils|candidat|candidats|shortlist|talent|talents|dashboard|tableau de bord|comment se porte|état|etat|stats|statistiques)\b/.test(m)) {
      return {
        tools: byNames(tools, ['sql_query', 'smart_search', 'execute_action']),
        reason: 'org_structured',
      };
    }
  }

  return { tools, reason: 'full' };
}

export function buildAgentSystemText(agentConfig: Pick<AgentConfig, 'systemPrompt' | 'systemPromptStatic'>): string {
  return agentConfig.systemPromptStatic
    ? `${agentConfig.systemPromptStatic}\n\n${agentConfig.systemPrompt}`
    : agentConfig.systemPrompt;
}

export function getAgentCompletionOptions(): {
  max_completion_tokens: number;
  temperature?: number;
  parallel_tool_calls: boolean;
  reasoning_effort?: 'none';
} {
  const model = process.env.AI_MODEL_AGENT || 'gpt-5.6-terra';
  const isOpenAIGpt5 = !process.env.AI_BASE_URL && model.startsWith('gpt-5');
  const options: {
    max_completion_tokens: number;
    temperature?: number;
    parallel_tool_calls: boolean;
    reasoning_effort?: 'none';
  } = {
    max_completion_tokens: AGENTIC_LIMITS.maxCompletionTokens,
    // Sequential tools are easier to cache, summarize, and debug. The model can
    // still call several tools across turns when the result of one determines the next.
    parallel_tool_calls: false,
  };

  // GPT-5.6 Chat Completions supports function tools only with effective
  // reasoning set to none. Tool reasoning migration to Responses is separate.
  if (isOpenAIGpt5) options.reasoning_effort = 'none';

  // OpenAI GPT-5 Chat Completions rejects non-default temperature. Other
  // OpenAI-compatible providers still benefit from the explicit low setting.
  if (!isOpenAIGpt5) {
    options.temperature = Number(process.env.COPILOT_AGENT_TEMPERATURE || 0.2);
  }

  return options;
}

export function buildToolPreface(toolName: string, language: AgentConfig['language'] = 'en'): string {
  const isFrench = language === 'fr';
  const labels: Record<string, { fr: string; en: string }> = {
    smart_search: {
      fr: 'Je vérifie les résultats disponibles.',
      en: 'Checking available results.',
    },
    sql_query: {
      fr: 'Je consulte les données disponibles.',
      en: 'Checking the available data.',
    },
    file_reader: {
      fr: 'Je lis le document avant de répondre.',
      en: 'Reading the document first.',
    },
    web_search: {
      fr: 'Je vérifie les sources externes utiles.',
      en: 'Checking useful external sources.',
    },
  };
  const fallback = isFrench ? 'Je vérifie les données utiles.' : 'Checking the useful data.';
  return `${labels[toolName]?.[isFrench ? 'fr' : 'en'] || fallback}\n\n`;
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
    if (/\b(cv|curriculum|resume|résumé)\b/.test(m)) {
      return { type: 'function', function: { name: 'sql_query' } };
    }
    if (/\b(comment devenir|devenir|roadmap|parcours|manque|gaps?|écarts?|ecarts?)\b/.test(m)) {
      return { type: 'function', function: { name: 'learning_path' } };
    }
    if (/\b(bilan|diagnostic|profil|profile|compétence|competence|compétences|competences)\b/.test(m)) {
      return { type: 'function', function: { name: 'sql_query' } };
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

  const asksForCvDocument = /\b(cv|curriculum|resume|résumé)\b/.test(m)
    && /\b(génère|genere|crée|cree|prépare|prepare|construis|build|generate|create|rédige|redige)\b/.test(m);

  if (mode === 'explore' && asksForCvDocument) {
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
