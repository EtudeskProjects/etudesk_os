/**
 * Talent Graph Ontology - Relationship Definitions
 *
 * Defines all relationship types and their properties
 */

// ═══════════════════════════════════════════════════════════════
// RELATIONSHIP TYPES
// ═══════════════════════════════════════════════════════════════

export const RelationshipTypes = {
  // Talent → Skill
  POSSEDE_COMPETENCE: 'POSSEDE_COMPETENCE',

  // Talent → Organization
  TRAVAILLE_CHEZ: 'TRAVAILLE_CHEZ',
  A_TRAVAILLE_CHEZ: 'A_TRAVAILLE_CHEZ',
  A_ETUDIE_A: 'A_ETUDIE_A',

  // Talent → Opportunity
  A_POSTULE_A: 'A_POSTULE_A',
  A_MIS_EN_FAVORIS: 'A_MIS_EN_FAVORIS',

  // Talent → Community
  EST_MEMBRE_DE: 'EST_MEMBRE_DE',

  // Talent → Space
  A_RESERVE: 'A_RESERVE',

  // Talent → Document
  POSSEDE_DOCUMENT: 'POSSEDE_DOCUMENT',

  // Talent → LearningTopic
  ETUDIE_SUJET: 'ETUDIE_SUJET',

  // Talent → Event
  A_EVENEMENT: 'A_EVENEMENT',

  // Talent ↔ Talent
  CONNECTE_AVEC: 'CONNECTE_AVEC',
  MENTOR_DE: 'MENTOR_DE',
  RECOMMANDE_PAR: 'RECOMMANDE_PAR',

  // Agent-Inferred Relations
  INTERESSE_PAR: 'INTERESSE_PAR',
  DEVRAIT_APPRENDRE: 'DEVRAIT_APPRENDRE',
  SIMILAIRE_A: 'SIMILAIRE_A',

  // Entity Relations
  PUBLIE_PAR: 'PUBLIE_PAR',
  APPARTIENT_A: 'APPARTIENT_A',
  PREREQUIS_POUR: 'PREREQUIS_POUR',
  COMPLEMENTAIRE_A: 'COMPLEMENTAIRE_A',

  // Organization → Space
  HEBERGE: 'HEBERGE',

  // Entity → Sector
  DANS_SECTEUR: 'DANS_SECTEUR',
} as const;

export type RelationshipType = (typeof RelationshipTypes)[keyof typeof RelationshipTypes];

// ═══════════════════════════════════════════════════════════════
// RELATIONSHIP PROPERTY TYPES
// ═══════════════════════════════════════════════════════════════

export interface PossedeCompetenceProps {
  proficiency_level: 'debutant' | 'intermediaire' | 'avance' | 'expert';
  source?: 'profile' | 'cv' | 'linkedin' | 'certificate' | 'inferred';
  acquired_at?: string;
}

export interface TravailleChez_Props {
  job_title: string;
  started_at: string;
  is_current: boolean;
  department?: string;
}

export interface ATravailleChezProps {
  job_title: string;
  started_at: string;
  ended_at: string;
  department?: string;
  achievements?: string[];
}

export interface AEtudieAProps {
  degree_type?: 'licence' | 'master' | 'doctorat' | 'diplome' | 'certificat' | 'formation';
  field_of_study?: string;
  started_at?: string;
  ended_at?: string;
  graduated: boolean;
}

export interface APostuleAProps {
  status: 'draft' | 'submitted' | 'viewed' | 'shortlisted' | 'interview' | 'offered' | 'accepted' | 'rejected' | 'withdrawn';
  applied_at: string;
  match_score?: number;
  cover_letter_id?: string;
  cv_id?: string;
}

export interface AMisEnFavorisProps {
  created_at: string;
  notes?: string;
}

export interface EstMembreDeProps {
  role: 'member' | 'moderator' | 'admin' | 'owner';
  joined_at: string;
  is_active: boolean;
  contribution_score?: number;
}

export interface AReserveProps {
  date: string;
  start_time: string;
  end_time: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  total_price?: number;
}

export interface PossedeDocumentProps {
  uploaded_at: string;
  is_verified: boolean;
  verified_at?: string;
}

export interface EtudieSujetProps {
  mastery_level: number; // 0-100
  started_at: string;
  last_studied_at?: string;
  streak_days: number;
  total_time_minutes: number;
  flashcards_count?: number;
  quizzes_completed?: number;
}

export interface AEvenementProps {
  type: 'interview' | 'meeting' | 'deadline' | 'reminder' | 'session';
  reminder_sent: boolean;
}

// Talent ↔ Talent relations
export interface ConnecteAvecProps {
  relationship_type: 'colleague' | 'classmate' | 'mentor' | 'friend' | 'professional';
  connected_at: string;
  met_at?: string; // how/where they met
}

export interface MentorDeProps {
  focus_areas: string[];
  started_at: string;
  status: 'active' | 'paused' | 'completed';
  sessions_count?: number;
}

export interface RecommandeParProps {
  recommendation_text?: string;
  highlighted_skills: string[];
  recommended_at: string;
  relationship_context?: string;
}

// Agent-Inferred Relations
export interface InteresseParProps {
  confidence: number; // 0.0 - 1.0
  reason: string;
  inferred_at: string;
  evidence?: string[];
}

export interface DevraitApprendreProps {
  confidence: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  reason: string;
  inferred_at: string;
  related_opportunities?: string[];
  skill_gap_for?: string;
}

export interface SimilaireAProps {
  common_skills_count: number;
  common_skills: string[];
  confidence: number;
  similarity_score: number;
  computed_at: string;
}

export interface PublieParProps {
  published_at: string;
  contact_person?: string;
}

export interface AppartientAProps {
  since?: string;
  is_official: boolean;
}

export interface PrerequisPourProps {
  is_strict: boolean;
  learning_path_position?: number;
}

export interface ComplementaireAProps {
  synergy_score: number;
  common_use_cases?: string[];
}

export interface HebergeProps {
  since?: string;
  is_official: boolean;
}

export interface DansSecteurProps {
  is_primary?: boolean;
}

// Union type for all relationship properties
export type RelationshipProps =
  | PossedeCompetenceProps
  | TravailleChez_Props
  | ATravailleChezProps
  | AEtudieAProps
  | APostuleAProps
  | AMisEnFavorisProps
  | EstMembreDeProps
  | AReserveProps
  | PossedeDocumentProps
  | EtudieSujetProps
  | AEvenementProps
  | ConnecteAvecProps
  | MentorDeProps
  | RecommandeParProps
  | InteresseParProps
  | DevraitApprendreProps
  | SimilaireAProps
  | PublieParProps
  | AppartientAProps
  | PrerequisPourProps
  | ComplementaireAProps
  | HebergeProps
  | DansSecteurProps;

// ═══════════════════════════════════════════════════════════════
// RELATIONSHIP DIRECTION HELPERS
// ═══════════════════════════════════════════════════════════════

export const RelationshipDirections: Record<RelationshipType, { from: string; to: string }> = {
  POSSEDE_COMPETENCE: { from: 'Talent', to: 'Skill' },
  TRAVAILLE_CHEZ: { from: 'Talent', to: 'Organization' },
  A_TRAVAILLE_CHEZ: { from: 'Talent', to: 'Organization' },
  A_ETUDIE_A: { from: 'Talent', to: 'Organization' },
  A_POSTULE_A: { from: 'Talent', to: 'Opportunity' },
  A_MIS_EN_FAVORIS: { from: 'Talent', to: 'Opportunity' }, // Can also be Community, Space
  EST_MEMBRE_DE: { from: 'Talent', to: 'Community' },
  A_RESERVE: { from: 'Talent', to: 'Space' },
  POSSEDE_DOCUMENT: { from: 'Talent', to: 'Document' },
  ETUDIE_SUJET: { from: 'Talent', to: 'LearningTopic' },
  A_EVENEMENT: { from: 'Talent', to: 'Event' },
  CONNECTE_AVEC: { from: 'Talent', to: 'Talent' },
  MENTOR_DE: { from: 'Talent', to: 'Talent' },
  RECOMMANDE_PAR: { from: 'Talent', to: 'Talent' },
  INTERESSE_PAR: { from: 'Talent', to: 'Skill' }, // Can also be Organization, Community
  DEVRAIT_APPRENDRE: { from: 'Talent', to: 'Skill' },
  SIMILAIRE_A: { from: 'Talent', to: 'Talent' },
  PUBLIE_PAR: { from: 'Opportunity', to: 'Organization' },
  APPARTIENT_A: { from: 'Community', to: 'Organization' },
  PREREQUIS_POUR: { from: 'Skill', to: 'Skill' },
  COMPLEMENTAIRE_A: { from: 'Skill', to: 'Skill' },
  HEBERGE: { from: 'Organization', to: 'Space' },
  DANS_SECTEUR: { from: 'Organization', to: 'Sector' }, // Also Community, Opportunity
};
