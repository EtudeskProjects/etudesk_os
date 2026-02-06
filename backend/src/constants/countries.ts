/**
 * UEMOA Countries Configuration
 * Union Économique et Monétaire Ouest Africaine
 *
 * 8 pays membres : Bénin, Burkina Faso, Côte d'Ivoire, Guinée-Bissau,
 * Mali, Niger, Sénégal, Togo
 */

// UEMOA country codes
export const UEMOA_COUNTRIES = ['BJ', 'BF', 'CI', 'GW', 'ML', 'NE', 'SN', 'TG'] as const;
export type UEMOACountryCode = typeof UEMOA_COUNTRIES[number];

// Map country names (FR/EN variants) to ISO 2-letter codes
export const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  // Bénin
  'bénin': 'BJ',
  'benin': 'BJ',

  // Burkina Faso
  'burkina faso': 'BF',
  'burkina': 'BF',

  // Côte d'Ivoire
  'côte d\'ivoire': 'CI',
  'cote d\'ivoire': 'CI',
  'ivory coast': 'CI',
  'côte-d\'ivoire': 'CI',

  // Guinée-Bissau
  'guinée-bissau': 'GW',
  'guinee-bissau': 'GW',
  'guinea-bissau': 'GW',
  'guinée bissau': 'GW',
  'guinee bissau': 'GW',
  'guinea bissau': 'GW',

  // Mali
  'mali': 'ML',

  // Niger
  'niger': 'NE',

  // Sénégal
  'sénégal': 'SN',
  'senegal': 'SN',

  // Togo
  'togo': 'TG',
};

// Country code to display name (French)
export const COUNTRY_CODE_TO_NAME: Record<string, string> = {
  'BJ': 'Bénin',
  'BF': 'Burkina Faso',
  'CI': 'Côte d\'Ivoire',
  'GW': 'Guinée-Bissau',
  'ML': 'Mali',
  'NE': 'Niger',
  'SN': 'Sénégal',
  'TG': 'Togo',
};

// Convert country name to ISO code (returns uppercase code or null)
export function normalizeCountryCode(input: string | undefined | null): string | null {
  if (!input) return null;

  const trimmed = input.trim();
  if (!trimmed) return null;

  // If already 2-letter code, validate it's UEMOA
  if (trimmed.length === 2) {
    const upper = trimmed.toUpperCase();
    return UEMOA_COUNTRIES.includes(upper as UEMOACountryCode) ? upper : null;
  }

  // Try to find in mapping (case-insensitive)
  const normalized = trimmed.toLowerCase();
  const code = COUNTRY_NAME_TO_CODE[normalized];

  return code || null;
}

// Check if a country code is UEMOA
export function isUEMOACountry(code: string | undefined | null): boolean {
  if (!code) return false;
  return UEMOA_COUNTRIES.includes(code.toUpperCase() as UEMOACountryCode);
}

// Get country display name from code
export function getCountryName(code: string | undefined | null): string | null {
  if (!code) return null;
  return COUNTRY_CODE_TO_NAME[code.toUpperCase()] || null;
}
