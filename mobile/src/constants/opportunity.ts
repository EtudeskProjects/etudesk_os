// Données pour les opportunités - synchronisées avec les modèles

import {
  getOpportunityTypeLabel,
  getContractTypeLabel,
  getWorkRhythmLabel,
  getLocationTypeLabel,
  getCompensationFrequencyLabel,
  getVisibilityLabel,
  OpportunityType,
  ContractType,
  WorkRhythm,
  LocationType,
  CompensationFrequency,
  Visibility,
} from '../types/models';
import { getLabel } from '../utils/labels';

// --- Options FormatéEs Pour Les Formulaires ---
// Functions instead of static arrays so labels resolve at render time (i18n-aware)

export function getOpportunityTypeData(): Array<{ id: OpportunityType; label: string }> {
  return [
    { id: 'EMPLOYMENT', label: getOpportunityTypeLabel('EMPLOYMENT') },
    { id: 'INTERNSHIP', label: getOpportunityTypeLabel('INTERNSHIP') },
    { id: 'ENTREPRENEURSHIP', label: getOpportunityTypeLabel('ENTREPRENEURSHIP') },
    { id: 'ALTERNATION', label: getOpportunityTypeLabel('ALTERNATION') },
    { id: 'FREELANCE', label: getOpportunityTypeLabel('FREELANCE') },
    { id: 'VOLUNTEER', label: getOpportunityTypeLabel('VOLUNTEER') },
  ];
}

export function getContractTypeData(): Array<{ id: ContractType; label: string }> {
  return [
    { id: 'CDI', label: getContractTypeLabel('CDI') },
    { id: 'CDD', label: getContractTypeLabel('CDD') },
    { id: 'APPRENTICESHIP', label: getContractTypeLabel('APPRENTICESHIP') },
    { id: 'INTERNSHIP', label: getContractTypeLabel('INTERNSHIP') },
    { id: 'FREELANCE', label: getContractTypeLabel('FREELANCE') },
    { id: 'SERVICE', label: getContractTypeLabel('SERVICE') },
    { id: 'INTERIM', label: getContractTypeLabel('INTERIM') },
  ];
}

export function getWorkRhythmData(): Array<{ id: WorkRhythm; label: string; description: string }> {
  return [
    { id: 'FULL_TIME', label: getWorkRhythmLabel('FULL_TIME'), description: getLabel('workRhythms', 'FULL_TIME') },
    { id: 'PART_TIME', label: getWorkRhythmLabel('PART_TIME'), description: getLabel('workRhythms', 'PART_TIME') },
    { id: 'FLEXIBLE', label: getWorkRhythmLabel('FLEXIBLE'), description: getLabel('workRhythms', 'FLEXIBLE') },
    { id: 'OCCASIONAL', label: getWorkRhythmLabel('OCCASIONAL'), description: getLabel('workRhythms', 'OCCASIONAL') },
  ];
}

export function getLocationTypeData(): Array<{ id: LocationType; label: string; description: string }> {
  return [
    { id: 'ON_SITE', label: getLocationTypeLabel('ON_SITE'), description: getLabel('locationTypeDescriptions', 'ON_SITE') },
    { id: 'HYBRID', label: getLocationTypeLabel('HYBRID'), description: getLabel('locationTypeDescriptions', 'HYBRID') },
    { id: 'REMOTE', label: getLocationTypeLabel('REMOTE'), description: getLabel('locationTypeDescriptions', 'REMOTE') },
  ];
}

// Note: COMPENSATION_TYPE_DATA removed - use only min/max/frequency/currency

export function getCompensationFrequencyData(): Array<{ id: CompensationFrequency; label: string }> {
  return [
    { id: 'MONTHLY', label: getCompensationFrequencyLabel('MONTHLY') },
    { id: 'YEARLY', label: getCompensationFrequencyLabel('YEARLY') },
    { id: 'HOURLY', label: getCompensationFrequencyLabel('HOURLY') },
    { id: 'PROJECT', label: getCompensationFrequencyLabel('PROJECT') },
  ];
}

/**
 * Retourne le symbole d'affichage pour un code devise (optionnel).
 * Utiliser un champ texte libre pour la devise dans les formulaires.
 */
export function getCurrencySymbol(code: string): string {
  if (!code) return '';
  const symbols: Record<string, string> = { XOF: 'FCFA', EUR: '€', USD: '$', GHS: '₵', NGN: '₦' };
  return symbols[code.toUpperCase()] || code;
}

// Note: EXPERIENCE_LEVEL_DATA removed - no longer used

// --- Visibility ---

export function getOpportunityVisibilityData(): Array<{ id: Visibility; label: string; description: string }> {
  return [
    { id: 'PUBLIC', label: getVisibilityLabel('PUBLIC'), description: getLabel('opportunityVisibility', 'PUBLIC') },
    { id: 'PRIVATE', label: getVisibilityLabel('PRIVATE'), description: getLabel('opportunityVisibility', 'PRIVATE') },
  ];
}

// --- Utilitaire - GéNéRation De Slug ---

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

