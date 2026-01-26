// Données pour les communautés - synchronisées avec les modèles

import {
  COMMUNITY_TYPES,
  COMMUNITY_TYPE_LABELS,
  CommunityType,
  Visibility,
  VISIBILITY_LABELS,
} from '../types/models';

// ═══════════════════════════════════════════════════════════════
// OPTIONS FORMATÉES POUR LES FORMULAIRES
// ═══════════════════════════════════════════════════════════════

export const COMMUNITY_TYPE_DATA: Array<{ id: CommunityType; label: string; description: string }> = [
  { id: 'HYBRID', label: COMMUNITY_TYPE_LABELS.HYBRID, description: 'Mix événements en ligne et physiques' },
  { id: 'ONLINE', label: COMMUNITY_TYPE_LABELS.ONLINE, description: 'Communauté 100% virtuelle' },
];

export const VISIBILITY_DATA: Array<{ id: Visibility; label: string; description: string }> = [
  { id: 'PUBLIC', label: VISIBILITY_LABELS.PUBLIC, description: 'Tout le monde peut voir et rejoindre' },
  { id: 'PRIVATE', label: VISIBILITY_LABELS.PRIVATE, description: 'Seuls les membres peuvent voir le contenu' },
];

// ═══════════════════════════════════════════════════════════════
// TAGS DE COMMUNAUTÉS (remplace les catégories)
// ═══════════════════════════════════════════════════════════════

export const COMMUNITY_TAGS = {
  PROFESSIONAL: 'PROFESSIONAL',
  STUDENT: 'STUDENT',
  ENTREPRENEUR: 'ENTREPRENEUR',
  TECH: 'TECH',
  CREATIVE: 'CREATIVE',
  SOCIAL_IMPACT: 'SOCIAL_IMPACT',
  ALUMNI: 'ALUMNI',
  WOMEN: 'WOMEN',
  YOUTH: 'YOUTH',
  CLUB_ASSOCIATION: 'CLUB_ASSOCIATION',
} as const;

export type CommunityTag = (typeof COMMUNITY_TAGS)[keyof typeof COMMUNITY_TAGS];

export const COMMUNITY_TAG_DATA: Array<{ id: CommunityTag; label: string }> = [
  { id: 'PROFESSIONAL', label: 'Professionnels' },
  { id: 'STUDENT', label: 'Étudiants' },
  { id: 'ENTREPRENEUR', label: 'Entrepreneurs' },
  { id: 'TECH', label: 'Tech & Innovation' },
  { id: 'CREATIVE', label: 'Créatifs & Artistes' },
  { id: 'SOCIAL_IMPACT', label: 'Impact social' },
  { id: 'ALUMNI', label: 'Alumni / Anciens' },
  { id: 'WOMEN', label: 'Femmes' },
  { id: 'YOUTH', label: 'Jeunes' },
  { id: 'CLUB_ASSOCIATION', label: 'Club / Association' },
];

export const MAX_COMMUNITY_TAGS = 3;

// ═══════════════════════════════════════════════════════════════
// QUESTIONS D'ADHÉSION PRÉDÉFINIES
// ═══════════════════════════════════════════════════════════════

export const DEFAULT_MEMBERSHIP_QUESTIONS: Array<{ id: string; question: string }> = [
  { id: 'motivation', question: 'Pourquoi souhaitez-vous rejoindre cette communauté ?' },
  { id: 'contribution', question: 'Comment pensez-vous contribuer à la communauté ?' },
  { id: 'background', question: 'Quel est votre parcours professionnel ?' },
  { id: 'referral', question: 'Comment avez-vous entendu parler de nous ?' },
  { id: 'expectations', question: 'Quelles sont vos attentes vis-à-vis de cette communauté ?' },
];

export const MAX_MEMBERSHIP_QUESTIONS = 5;
