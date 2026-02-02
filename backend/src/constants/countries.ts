/**
 * Country name to ISO 2-letter code mapping
 */

// Map country names to ISO 2-letter codes
export const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  'côte d\'ivoire': 'CI',
  'cote d\'ivoire': 'CI',
  'ivory coast': 'CI',
  'senegal': 'SN',
  'sénégal': 'SN',
  'mali': 'ML',
  'burkina faso': 'BF',
  'guinea': 'GN',
  'guinée': 'GN',
  'benin': 'BJ',
  'bénin': 'BJ',
  'togo': 'TG',
  'niger': 'NE',
  'cameroon': 'CM',
  'cameroun': 'CM',
  'ghana': 'GH',
  'nigeria': 'NG',
  'nigéria': 'NG',
  'morocco': 'MA',
  'maroc': 'MA',
  'tunisia': 'TN',
  'tunisie': 'TN',
  'france': 'FR',
  'canada': 'CA',
  'united states': 'US',
  'états-unis': 'US',
  'etats-unis': 'US',
};

// Convert country name to ISO code (returns uppercase code or null)
export function normalizeCountryCode(input: string | undefined | null): string | null {
  if (!input) return null;

  const trimmed = input.trim();
  if (!trimmed) return null;

  // If already 2-letter code, return uppercase
  if (trimmed.length === 2) {
    return trimmed.toUpperCase();
  }

  // Try to find in mapping (case-insensitive)
  const normalized = trimmed.toLowerCase();
  const code = COUNTRY_NAME_TO_CODE[normalized];

  return code || null;
}
