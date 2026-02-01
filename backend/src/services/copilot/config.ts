/**
 * Copilot Configuration
 * Model assignments and agent configurations
 */

// ═══════════════════════════════════════════════════════════════
// OPENAI MODEL CONFIGURATIONS
// ═══════════════════════════════════════════════════════════════

export const MODELS = {
  // Fast, efficient model for simple tasks and routing
  NANO: 'gpt-4.1-nano',

  // Capable model for complex reasoning
  MINI: 'gpt-4.1-mini',

  // Default fallback
  DEFAULT: 'gpt-4.1-nano',
} as const;

export type ModelType = (typeof MODELS)[keyof typeof MODELS];

// ═══════════════════════════════════════════════════════════════
// AGENT MODEL ASSIGNMENTS
// ═══════════════════════════════════════════════════════════════

export const AGENT_MODELS: Record<string, ModelType> = {
  // Triage - fast routing
  triage: MODELS.NANO,

  // Explorer Hub and sub-agents
  explorer_hub: MODELS.MINI,
  search: MODELS.NANO,
  web_search: MODELS.NANO,
  document_generator: MODELS.MINI, // Complex document generation
  document_reader: MODELS.NANO,
  admin: MODELS.NANO,

  // Study Hub and sub-agents
  study_hub: MODELS.MINI, // Complex pedagogical reasoning
  learn: MODELS.MINI, // Teaching requires complex reasoning
  quiz: MODELS.MINI, // Quiz generation needs creativity
  flashcard: MODELS.NANO, // Simple CRUD operations
  code: MODELS.MINI, // Code analysis
  resource: MODELS.NANO, // Simple lookup
};

// ═══════════════════════════════════════════════════════════════
// MODEL PARAMETERS
// ═══════════════════════════════════════════════════════════════

export interface ModelParams {
  temperature: number;
  maxTokens: number;
  topP?: number;
}

export const MODEL_PARAMS: Record<string, ModelParams> = {
  // Triage - deterministic
  triage: {
    temperature: 0.1,
    maxTokens: 500,
  },

  // Explorer Hub
  explorer_hub: {
    temperature: 0.5,
    maxTokens: 2000,
  },
  search: {
    temperature: 0.1,
    maxTokens: 1000,
  },
  web_search: {
    temperature: 0.3,
    maxTokens: 1500,
  },
  document_generator: {
    temperature: 0.7,
    maxTokens: 4000,
  },
  document_reader: {
    temperature: 0.2,
    maxTokens: 2000,
  },
  admin: {
    temperature: 0.2,
    maxTokens: 1000,
  },

  // Study Hub
  study_hub: {
    temperature: 0.6,
    maxTokens: 3000,
  },
  learn: {
    temperature: 0.7,
    maxTokens: 3000,
  },
  quiz: {
    temperature: 0.8, // More creative for varied questions
    maxTokens: 2000,
  },
  flashcard: {
    temperature: 0.4,
    maxTokens: 1000,
  },
  code: {
    temperature: 0.3,
    maxTokens: 2000,
  },
  resource: {
    temperature: 0.3,
    maxTokens: 1500,
  },
};

// ═══════════════════════════════════════════════════════════════
// AGENT TOOL ASSIGNMENTS
// ═══════════════════════════════════════════════════════════════

export const AGENT_TOOLS: Record<string, string[]> = {
  triage: ['handoff_to_explorer', 'handoff_to_study'],

  explorer_hub: [
    'handoff_to_search',
    'handoff_to_web_search',
    'handoff_to_document_generator',
    'handoff_to_document_reader',
    'handoff_to_admin',
    'get_context',
    // Graph tools for exploration
    'query_talent_graph',
    'find_opportunity_matches',
    'find_similar_talents',
    'get_skill_gaps',
    'add_inferred_interest',
    'suggest_skill_to_learn',
  ],

  search: [
    'search_opportunities',
    'search_communities',
    'search_spaces',
    'search_organizations',
    'get_talent_profile',
    'get_talent_preferences',
    // Graph-powered search
    'find_opportunity_matches',
    'get_skill_gaps',
  ],

  web_search: ['brave_web_search'],

  document_generator: ['generate_pdf', 'generate_docx', 'generate_csv', 'get_talent_profile'],

  document_reader: ['list_documents', 'read_document', 'analyze_document'],

  admin: [
    'list_org_members',
    'get_org_stats',
    'list_org_opportunities',
    'check_admin_permissions',
  ],

  study_hub: [
    'handoff_to_learn',
    'handoff_to_quiz',
    'handoff_to_flashcard',
    'handoff_to_code',
    'handoff_to_resource',
    'get_learning_context',
    // Graph tools for learning
    'query_talent_graph',
    'explore_skill_path',
    'get_learning_progress',
    'get_skill_gaps',
    'suggest_skill_to_learn',
  ],

  learn: [
    'explain_concept',
    'create_flashcards',
    'get_learning_progress',
    'get_due_cards',
    // Graph-powered learning
    'explore_skill_path',
    'record_learning_activity',
    'update_mastery_level',
  ],

  quiz: [
    'create_quiz',
    'evaluate_quiz_answer',
    'save_quiz_result',
    'create_flashcards_from_errors',
    // Update mastery after quiz
    'update_mastery_level',
  ],

  flashcard: [
    'get_due_cards',
    'record_review',
    'create_flashcard',
    'get_topic_stats',
    // Track learning activity
    'record_learning_activity',
  ],

  code: ['create_code_exercise', 'evaluate_code', 'get_hints'],

  resource: ['search_youtube', 'search_wikipedia', 'generate_diagram'],
};

// ═══════════════════════════════════════════════════════════════
// HANDOFF CONFIGURATIONS
// ═══════════════════════════════════════════════════════════════

export interface HandoffConfig {
  from: string;
  to: string;
  condition: string;
  description: string;
}

export const HANDOFFS: HandoffConfig[] = [
  // Triage handoffs
  {
    from: 'triage',
    to: 'explorer_hub',
    condition: 'intent_explore',
    description: 'Requête de recherche, découverte ou génération de documents',
  },
  {
    from: 'triage',
    to: 'study_hub',
    condition: 'intent_study',
    description: "Requête d'apprentissage, quiz, ou révisions",
  },

  // Explorer Hub handoffs
  {
    from: 'explorer_hub',
    to: 'search',
    condition: 'intent_search',
    description: "Recherche d'opportunités, communautés ou espaces",
  },
  {
    from: 'explorer_hub',
    to: 'web_search',
    condition: 'intent_web_search',
    description: 'Recherche externe sur le web',
  },
  {
    from: 'explorer_hub',
    to: 'document_generator',
    condition: 'intent_generate_document',
    description: 'Génération de CV, lettres ou exports',
  },
  {
    from: 'explorer_hub',
    to: 'document_reader',
    condition: 'intent_read_document',
    description: "Lecture ou analyse de documents de l'utilisateur",
  },
  {
    from: 'explorer_hub',
    to: 'admin',
    condition: 'intent_admin',
    description: "Gestion d'organisation (si admin)",
  },

  // Study Hub handoffs
  {
    from: 'study_hub',
    to: 'learn',
    condition: 'intent_learn',
    description: "Explication ou enseignement d'un concept",
  },
  {
    from: 'study_hub',
    to: 'quiz',
    condition: 'intent_quiz',
    description: 'Création ou passage de quiz',
  },
  {
    from: 'study_hub',
    to: 'flashcard',
    condition: 'intent_flashcard',
    description: 'Gestion des flashcards et révisions',
  },
  {
    from: 'study_hub',
    to: 'code',
    condition: 'intent_code',
    description: 'Exercice de programmation',
  },
  {
    from: 'study_hub',
    to: 'resource',
    condition: 'intent_resource',
    description: 'Recherche de ressources (vidéos, articles)',
  },
];

// ═══════════════════════════════════════════════════════════════
// RATE LIMITING
// ═══════════════════════════════════════════════════════════════

export const RATE_LIMITS = {
  // Messages per minute per user
  messagesPerMinute: 20,

  // Max tokens per request
  maxTokensPerRequest: 4000,

  // Max conversation history to include
  maxHistoryMessages: 20,

  // Max tools calls per turn
  maxToolCalls: 10,
};

// ═══════════════════════════════════════════════════════════════
// EXTERNAL API KEYS
// ═══════════════════════════════════════════════════════════════

export const EXTERNAL_APIS = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  BRAVE_API_KEY: process.env.BRAVE_API_KEY || '',
  YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY || '',
};

// ═══════════════════════════════════════════════════════════════
// FEATURE FLAGS
// ═══════════════════════════════════════════════════════════════

export const FEATURES = {
  // Enable web search
  enableWebSearch: !!EXTERNAL_APIS.BRAVE_API_KEY,

  // Enable YouTube search
  enableYouTubeSearch: !!EXTERNAL_APIS.YOUTUBE_API_KEY,

  // Enable document generation
  enableDocumentGeneration: true,

  // Enable admin features
  enableAdminFeatures: true,

  // Enable code execution (sandbox)
  enableCodeExecution: false, // Not implemented yet

  // Enable Talent Graph features (requires Neo4j)
  enableTalentGraph: !!process.env.NEO4J_URI,

  // Enable graph-based opportunity matching
  enableGraphMatching: !!process.env.NEO4J_URI,

  // Enable agent inferences (interests, suggestions)
  enableAgentInferences: !!process.env.NEO4J_URI,
};

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

export function getAgentModel(agentType: string): ModelType {
  return AGENT_MODELS[agentType] || MODELS.DEFAULT;
}

export function getAgentParams(agentType: string): ModelParams {
  return (
    MODEL_PARAMS[agentType] || {
      temperature: 0.5,
      maxTokens: 2000,
    }
  );
}

export function getAgentTools(agentType: string): string[] {
  return AGENT_TOOLS[agentType] || [];
}

export function getHandoffsFrom(agentType: string): HandoffConfig[] {
  return HANDOFFS.filter((h) => h.from === agentType);
}

export function getHandoffsTo(agentType: string): HandoffConfig[] {
  return HANDOFFS.filter((h) => h.to === agentType);
}
