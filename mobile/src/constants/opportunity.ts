// Données pour les opportunités - synchronisées avec les modèles

import {
  OPPORTUNITY_TYPE_LABELS,
  CONTRACT_TYPE_LABELS,
  WORK_RHYTHM_LABELS,
  LOCATION_TYPE_LABELS,
  COMPENSATION_FREQUENCY_LABELS,
  VISIBILITY_LABELS,
  OpportunityType,
  ContractType,
  WorkRhythm,
  LocationType,
  CompensationFrequency,
  Visibility,
} from '../types/models';

// ═══════════════════════════════════════════════════════════════
// OPTIONS FORMATÉES POUR LES FORMULAIRES
// ═══════════════════════════════════════════════════════════════

export const OPPORTUNITY_TYPE_DATA: Array<{ id: OpportunityType; label: string }> = [
  { id: 'EMPLOYMENT', label: OPPORTUNITY_TYPE_LABELS.EMPLOYMENT },
  { id: 'INTERNSHIP', label: OPPORTUNITY_TYPE_LABELS.INTERNSHIP },
  { id: 'ENTREPRENEURSHIP', label: OPPORTUNITY_TYPE_LABELS.ENTREPRENEURSHIP },
  { id: 'ALTERNATION', label: OPPORTUNITY_TYPE_LABELS.ALTERNATION },
  { id: 'FREELANCE', label: OPPORTUNITY_TYPE_LABELS.FREELANCE },
  { id: 'VOLUNTEER', label: OPPORTUNITY_TYPE_LABELS.VOLUNTEER },
];

export const CONTRACT_TYPE_DATA: Array<{ id: ContractType; label: string }> = [
  { id: 'CDI', label: CONTRACT_TYPE_LABELS.CDI },
  { id: 'CDD', label: CONTRACT_TYPE_LABELS.CDD },
  { id: 'APPRENTICESHIP', label: CONTRACT_TYPE_LABELS.APPRENTICESHIP },
  { id: 'INTERNSHIP', label: CONTRACT_TYPE_LABELS.INTERNSHIP },
  { id: 'FREELANCE', label: CONTRACT_TYPE_LABELS.FREELANCE },
  { id: 'SERVICE', label: CONTRACT_TYPE_LABELS.SERVICE },
  { id: 'INTERIM', label: CONTRACT_TYPE_LABELS.INTERIM },
];

export const WORK_RHYTHM_DATA: Array<{ id: WorkRhythm; label: string; description: string }> = [
  { id: 'FULL_TIME', label: WORK_RHYTHM_LABELS.FULL_TIME, description: 'Engagement à temps complet' },
  { id: 'PART_TIME', label: WORK_RHYTHM_LABELS.PART_TIME, description: 'Quelques heures par semaine' },
  { id: 'FLEXIBLE', label: WORK_RHYTHM_LABELS.FLEXIBLE, description: 'Horaires adaptables' },
  { id: 'OCCASIONAL', label: WORK_RHYTHM_LABELS.OCCASIONAL, description: 'Missions ponctuelles' },
];

export const LOCATION_TYPE_DATA: Array<{ id: LocationType; label: string; description: string }> = [
  { id: 'ON_SITE', label: LOCATION_TYPE_LABELS.ON_SITE, description: 'Présence requise au bureau' },
  { id: 'HYBRID', label: LOCATION_TYPE_LABELS.HYBRID, description: 'Mix bureau et télétravail' },
  { id: 'REMOTE', label: LOCATION_TYPE_LABELS.REMOTE, description: 'Travail à distance uniquement' },
];

// Note: COMPENSATION_TYPE_DATA removed - use only min/max/frequency/currency

export const COMPENSATION_FREQUENCY_DATA: Array<{ id: CompensationFrequency; label: string }> = [
  { id: 'MONTHLY', label: COMPENSATION_FREQUENCY_LABELS.MONTHLY },
  { id: 'YEARLY', label: COMPENSATION_FREQUENCY_LABELS.YEARLY },
  { id: 'HOURLY', label: COMPENSATION_FREQUENCY_LABELS.HOURLY },
  { id: 'PROJECT', label: COMPENSATION_FREQUENCY_LABELS.PROJECT },
];

// ═══════════════════════════════════════════════════════════════
// DEVISES SUPPORTÉES
// ═══════════════════════════════════════════════════════════════

export type Currency = 'XOF' | 'EUR' | 'USD' | 'GHS' | 'NGN';

export const CURRENCY_DATA: Array<{ id: Currency; label: string; symbol: string }> = [
  { id: 'XOF', label: 'Franc CFA (FCFA)', symbol: 'FCFA' },
  { id: 'EUR', label: 'Euro (€)', symbol: '€' },
  { id: 'USD', label: 'Dollar US ($)', symbol: '$' },
  { id: 'GHS', label: 'Cedi ghanéen (₵)', symbol: '₵' },
  { id: 'NGN', label: 'Naira (₦)', symbol: '₦' },
];

// Note: EXPERIENCE_LEVEL_DATA removed - no longer used

// ═══════════════════════════════════════════════════════════════
// VISIBILITY
// ═══════════════════════════════════════════════════════════════

export const OPPORTUNITY_VISIBILITY_DATA: Array<{ id: Visibility; label: string; description: string }> = [
  { id: 'PUBLIC', label: VISIBILITY_LABELS.PUBLIC, description: 'Visible dans l\'exploration et la recherche' },
  { id: 'PRIVATE', label: VISIBILITY_LABELS.PRIVATE, description: 'Accessible uniquement via invitation' },
];

// ═══════════════════════════════════════════════════════════════
// UTILITAIRE - GÉNÉRATION DE SLUG
// ═══════════════════════════════════════════════════════════════

/**
 * Génère un slug unique à partir du titre de l'opportunité
 * @param title - Le titre de l'opportunité
 * @returns Un slug URL-friendly avec un suffixe unique
 */
export const generateOpportunitySlug = (title: string): string => {
  const baseSlug = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/-+/g, '-') // Replace multiple - with single -
    .replace(/^-|-$/g, '') // Remove leading/trailing -
    .slice(0, 50); // Limit length

  // Add unique suffix (timestamp + random)
  const uniqueSuffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  return `${baseSlug}-${uniqueSuffix}`;
};
