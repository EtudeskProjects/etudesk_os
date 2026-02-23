// Données pour les communautés - synchronisées avec les modèles

import {
  COMMUNITY_TYPES,
  getCommunityTypeLabel,
  CommunityType,
  Visibility,
  getVisibilityLabel,
} from '../types/models';
import { getLabel } from '../utils/labels';

// --- Options FormatéEs Pour Les Formulaires ---
// Functions instead of static arrays so labels resolve at render time (i18n-aware)

export function getCommunityTypeData(): Array<{ id: CommunityType; label: string; description: string }> {
  return [
    { id: 'HYBRID', label: getCommunityTypeLabel('HYBRID'), description: getLabel('communityVisibilityDescriptions', 'PUBLIC') },
    { id: 'ONLINE', label: getCommunityTypeLabel('ONLINE'), description: getLabel('communityVisibilityDescriptions', 'PRIVATE') },
  ];
}

export function getVisibilityData(): Array<{ id: Visibility; label: string; description: string }> {
  return [
    { id: 'PUBLIC', label: getVisibilityLabel('PUBLIC'), description: getLabel('communityVisibilityDescriptions', 'PUBLIC') },
    { id: 'PRIVATE', label: getVisibilityLabel('PRIVATE'), description: getLabel('communityVisibilityDescriptions', 'PRIVATE') },
  ];
}

// --- Tags De CommunautéS Remplace Les CatéGories ---

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

export function getCommunityTagData(): Array<{ id: CommunityTag; label: string }> {
  return Object.values(COMMUNITY_TAGS).map(id => ({
    id,
    label: getLabel('communityTags', id),
  }));
}

export const MAX_COMMUNITY_TAGS = 3;

// --- Questions D'AdhéSion PréDéFinies ---

export function getDefaultMembershipQuestions(): Array<{ id: string; question: string }> {
  return [
    { id: 'motivation', question: getLabel('membershipQuestions', 'motivation') },
    { id: 'contribution', question: getLabel('membershipQuestions', 'contribution') },
    { id: 'background', question: getLabel('membershipQuestions', 'background') },
    { id: 'referral', question: getLabel('membershipQuestions', 'referral') },
    { id: 'expectations', question: getLabel('membershipQuestions', 'expectations') },
  ];
}

export const MAX_MEMBERSHIP_QUESTIONS = 5;
