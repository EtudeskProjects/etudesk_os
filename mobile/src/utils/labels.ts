/**
 * Centralized label resolver — uses i18n for all enum/type labels.
 * Replaces hardcoded French _LABELS records throughout the app.
 *
 * Usage: import { getLabel } from '../utils/labels';
 *        getLabel('sectors', 'DIGITAL') → "Digital & Tech" (FR) or "Digital & Tech" (EN)
 */

import i18n from '../i18n';

/**
 * Get a translated label for an enum value.
 * @param category - The label category (e.g. 'sectors', 'orgTypes', 'spaceTypes')
 * @param key - The enum key (e.g. 'DIGITAL', 'COMPANY', 'SALLE_COURS')
 * @returns The translated label, or the key itself as fallback
 */
export function getLabel(category: string, key: string): string {
  const fullKey = `labels.${category}.${key}`;
  const result = i18n.t(fullKey);
  // i18n-js returns "[missing ...]" or the key path when translation is missing
  if (result.includes('missing') || result.includes(fullKey)) return key;
  return result;
}

/** Convenience: get a top-level label (not nested in a category) */
export function getLabelDirect(key: string): string {
  return i18n.t(`labels.${key}`);
}

// --- Typed helpers for common categories ---

export const getOrgTypeLabel = (key: string) => getLabel('orgTypes', key);
export const getSpaceTypeLabel = (key: string) => getLabel('spaceTypes', key);
export const getSectorLabel = (key: string) => getLabel('sectors', key);
export const getProfileTagLabel = (key: string) => getLabel('profileTags', key);
export const getGoalLabel = (key: string) => getLabel('goals', key);
export const getDocumentTypeLabel = (key: string) => getLabel('documentTypes', key);
export const getGenderLabel = (key: string) => getLabel('genders', key);
export const getStatusBadgeLabel = (key: string) => getLabel('statusBadges', key);
export const getOrgRoleLabel = (key: string) => getLabel('orgRoles', key);
export const getOrgRoleDescription = (key: string) => getLabel('orgRoleDescriptions', key);
export const getVisibilityLabel = (key: string) => getLabel('visibility', key);
export const getPricingTypeLabel = (key: string) => getLabel('pricingTypes', key);
export const getAccessTypeLabel = (key: string) => getLabel('accessTypes', key);
export const getCommunityTypeLabel = (key: string) => getLabel('communityTypes', key);
export const getPaymentProviderLabel = (key: string) => getLabel('paymentProviders', key);
export const getSafetyEquipmentLabel = (key: string) => getLabel('safetyEquipment', key);
export const getAccessibilityFeatureLabel = (key: string) => getLabel('accessibilityFeatures', key);
export const getVerificationStatusLabel = (key: string) => getLabel('verificationStatus', key);
export const getOrgDocTypeLabel = (key: string) => getLabel('orgDocumentTypes', key);
export const getOrgDocCategoryLabel = (key: string) => getLabel('orgDocumentCategories', key);
export const getOrgDocStatusLabel = (key: string) => getLabel('orgDocumentStatuses', key);
export const getOrgTalentSourceLabel = (key: string) => getLabel('orgTalentSources', key);
export const getConfirmationLabel = (category: string, key: string) => getLabel(`confirmationLabels.${category}`, key);
export const getOpportunityTypeLabel = (key: string) => getLabel('opportunityTypes', key);
export const getContractTypeLabel = (key: string) => getLabel('contractTypes', key);
export const getLocationTypeLabel = (key: string) => getLabel('locationTypes', key);
export const getCompensationFrequencyLabel = (key: string) => getLabel('compensationFrequencies', key);
export const getOpportunityStatusLabel = (key: string) => getLabel('opportunityStatus', key);
export const getApplicationStatusLabel = (key: string) => getLabel('applicationStatus', key);
export const getMemberStatusLabel = (key: string) => getLabel('memberStatus', key);
export const getSpaceCategoryLabel = (key: string) => getLabel('spaceCategories', key);
export const getSpaceStatusLabel = (key: string) => getLabel('spaceStatus', key);
export const getBookingStatusLabel = (key: string) => getLabel('bookingStatus', key);
export const getPaymentStatusLabel = (key: string) => getLabel('paymentStatus', key);
export const getSpacePricingTypeLabel = (key: string) => getLabel('spacePricingTypes', key);
export const getSpacePricingUnit = (key: string) => getLabel('spacePricingUnits', key);
export const getSpaceEquipmentLabel = (key: string) => getLabel('spaceEquipment', key);
export const getSpaceAmenityLabel = (key: string) => getLabel('spaceAmenities', key);
export const getSpaceAccessibilityLabel = (key: string) => getLabel('spaceAccessibility', key);
export const getCommunityTagLabel = (key: string) => getLabel('communityTags', key);
export const getEntityLabel = (key: string) => getLabel('entityLabels', key);
export const getDocCategoryLabel = (key: string) => getLabel('documentCategories', key);
export const getDocStatusLabel = (key: string) => getLabel('documentStatuses', key);
export const getProfileFieldLabel = (key: string) => getLabel('profileFields', key);
export const getWeekdayLabel = (day: number) => getLabel('weekdays', String(day));
export const getWeekdayShortLabel = (day: number) => getLabel('weekdaysShort', String(day));
