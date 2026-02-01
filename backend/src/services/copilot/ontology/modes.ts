/**
 * Copilot Modes Definition
 * Defines the available modes and their configurations
 */

// ═══════════════════════════════════════════════════════════════
// MODE DEFINITIONS
// ═══════════════════════════════════════════════════════════════

export const COPILOT_MODES = {
  EXPLORE: 'explore',
  STUDY: 'study',
} as const;

export type CopilotMode = (typeof COPILOT_MODES)[keyof typeof COPILOT_MODES];

// Sub-modes for specialized functionality
export const EXPLORE_SUB_MODES = {
  SEARCH: 'search', // Search opportunities, communities, spaces
  GENERATE: 'generate', // Generate documents (PDF, DOCX, CSV)
  ADMIN: 'admin', // Organization management (for admins)
} as const;

export const STUDY_SUB_MODES = {
  LEARN: 'learn', // Interactive learning
  ASSESS: 'assess', // Quiz and evaluation
  REVIEW: 'review', // Spaced repetition review
} as const;

export type ExploreSubMode = (typeof EXPLORE_SUB_MODES)[keyof typeof EXPLORE_SUB_MODES];
export type StudySubMode = (typeof STUDY_SUB_MODES)[keyof typeof STUDY_SUB_MODES];

// ═══════════════════════════════════════════════════════════════
// ACTION TYPES PER MODE
// ═══════════════════════════════════════════════════════════════

export const EXPLORE_ACTIONS = {
  // Search actions
  SEARCH_OPPORTUNITIES: 'search_opportunities',
  SEARCH_COMMUNITIES: 'search_communities',
  SEARCH_SPACES: 'search_spaces',
  SEARCH_ORGANIZATIONS: 'search_organizations',
  WEB_SEARCH: 'web_search', // Brave search

  // Document generation
  GENERATE_PDF: 'generate_pdf',
  GENERATE_DOCX: 'generate_docx',
  GENERATE_CSV: 'generate_csv',

  // Document reading
  READ_DOCUMENT: 'read_document',
  ANALYZE_DOCUMENT: 'analyze_document',

  // Navigation
  NAVIGATE_TO: 'navigate_to',
  APPLY_TO: 'apply_to',
  JOIN_COMMUNITY: 'join_community',
  RESERVE_SPACE: 'reserve_space',

  // Admin actions
  LIST_ORG_MEMBERS: 'list_org_members',
  MANAGE_ORG_OPPORTUNITY: 'manage_org_opportunity',
  VIEW_ORG_STATS: 'view_org_stats',
} as const;

export const STUDY_ACTIONS = {
  // Learning actions
  START_TOPIC: 'start_topic',
  EXPLAIN_CONCEPT: 'explain_concept',
  SHOW_EXAMPLE: 'show_example',
  PROVIDE_EXERCISE: 'provide_exercise',

  // Assessment actions
  CREATE_QUIZ: 'create_quiz',
  CREATE_FLASHCARD: 'create_flashcard',
  EVALUATE_ANSWER: 'evaluate_answer',

  // Review actions
  GET_DUE_CARDS: 'get_due_cards',
  RECORD_REVIEW: 'record_review',
  GET_PROGRESS: 'get_progress',

  // Resource actions
  SHOW_DIAGRAM: 'show_diagram',
  SHOW_VIDEO: 'show_video',
  SHOW_ARTICLE: 'show_article',
  SHOW_CODE: 'show_code',
} as const;

export type ExploreAction = (typeof EXPLORE_ACTIONS)[keyof typeof EXPLORE_ACTIONS];
export type StudyAction = (typeof STUDY_ACTIONS)[keyof typeof STUDY_ACTIONS];
export type CopilotAction = ExploreAction | StudyAction;

// ═══════════════════════════════════════════════════════════════
// MODE BEHAVIOR CONFIGURATION
// ═══════════════════════════════════════════════════════════════

export interface ModeBehavior {
  name: string;
  nameFr: string;
  description: string;
  descriptionFr: string;
  allowedActions: CopilotAction[];
  personality: {
    tone: string;
    style: string;
    approach: string;
  };
  systemPromptAdditions: string;
}

export const MODE_BEHAVIORS: Record<CopilotMode, ModeBehavior> = {
  [COPILOT_MODES.EXPLORE]: {
    name: 'Explorer',
    nameFr: 'Explorateur',
    description: 'Discovery assistant for opportunities, communities, spaces and document generation',
    descriptionFr: 'Assistant de découverte pour opportunités, communautés, espaces et génération de documents',
    allowedActions: Object.values(EXPLORE_ACTIONS),
    personality: {
      tone: 'professionnel et engageant',
      style: 'concis et informatif',
      approach: 'proactif dans les suggestions basées sur le profil',
    },
    systemPromptAdditions: `
CAPACITÉS EXPLORER:
1. Recherche intelligente:
   - Opportunités professionnelles (emplois, stages, freelance, alternance)
   - Communautés et réseaux pertinents
   - Espaces de travail et formation
   - Recherche web externe via Brave

2. Génération de documents:
   - CV professionnels en PDF
   - Lettres de motivation en DOCX
   - Exports de données en CSV
   - Rapports personnalisés

3. Lecture et analyse de documents:
   - Accès aux documents uploadés par l'utilisateur
   - Extraction d'informations pertinentes
   - Suggestions basées sur le contenu

4. Gestion d'organisation (pour admins):
   - Consultation des membres
   - Gestion des opportunités publiées
   - Statistiques de l'organisation

RÈGLES EXPLORER:
- Utilise le profil et les préférences pour personnaliser les résultats
- Limite les résultats à 5 éléments par défaut, sauf demande contraire
- Explique toujours pourquoi un résultat correspond au profil
- Pour les documents générés, fournis un lien de téléchargement
- Vérifie les permissions avant les actions admin`,
  },

  [COPILOT_MODES.STUDY]: {
    name: 'Study',
    nameFr: 'Étudier',
    description: 'Pedagogical assistant for skill development with spaced repetition',
    descriptionFr: 'Assistant pédagogique pour le développement de compétences avec répétition espacée',
    allowedActions: Object.values(STUDY_ACTIONS),
    personality: {
      tone: 'encourageant et pédagogue',
      style: 'clair, structuré et interactif',
      approach: 'méthode socratique avec adaptation au niveau',
    },
    systemPromptAdditions: `
CAPACITÉS ÉTUDIER:
1. Apprentissage interactif:
   - Flashcards avec répétition espacée (SM-2)
   - Mini-quiz adaptatifs
   - Exercices de code interactifs
   - Diagrammes et visualisations

2. Ressources multimédia:
   - Vidéos YouTube intégrées
   - Articles Wikipedia
   - Images explicatives
   - Éditeur de code en direct

3. Suivi de progression:
   - Mémorisation des sujets étudiés
   - Statistiques de révision
   - Cartes dues à réviser
   - Historique d'apprentissage

APPROCHE PÉDAGOGIQUE:
1. Évaluation initiale:
   - Pose 2-3 questions pour cerner le niveau
   - Adapte le vocabulaire et la complexité

2. Enseignement:
   - Décompose les concepts en petites unités
   - Utilise des analogies et exemples concrets
   - Propose des exercices pratiques progressifs

3. Validation:
   - Quiz courts pour vérifier la compréhension
   - Feedback détaillé sur les erreurs
   - Célèbre les progrès

4. Révision:
   - Propose les cartes dues selon SM-2
   - Adapte l'intervalle selon la performance
   - Maintient un rythme optimal de révision

RÈGLES ÉTUDIER:
- Utilise TOUJOURS la mémoire d'apprentissage pour personnaliser
- Crée des flashcards pour les concepts importants
- Propose des révisions quand des cartes sont dues
- Encourage sans être condescendant
- Adapte la difficulté en temps réel`,
  },
};

// ═══════════════════════════════════════════════════════════════
// MODE VALIDATION HELPERS
// ═══════════════════════════════════════════════════════════════

export function isValidMode(mode: string): mode is CopilotMode {
  return Object.values(COPILOT_MODES).includes(mode as CopilotMode);
}

export function isActionAllowed(mode: CopilotMode, action: CopilotAction): boolean {
  return MODE_BEHAVIORS[mode].allowedActions.includes(action);
}

export function getModeActions(mode: CopilotMode): CopilotAction[] {
  return MODE_BEHAVIORS[mode].allowedActions;
}

export function getModeBehavior(mode: CopilotMode): ModeBehavior {
  return MODE_BEHAVIORS[mode];
}
