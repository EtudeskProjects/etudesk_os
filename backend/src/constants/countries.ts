/**
 * Global Countries Configuration
 *
 * Supports 195+ countries with UEMOA priority.
 * UEMOA countries use XOF currency, all others default to USD.
 */

import type { SupportedCurrency } from './index';

// ── UEMOA (backward compat) ──────────────────────────────────────────────────

export const UEMOA_COUNTRIES = ['BJ', 'BF', 'CI', 'GW', 'ML', 'NE', 'SN', 'TG'] as const;
export type UEMOACountryCode = typeof UEMOA_COUNTRIES[number];

// ── Zone definitions ─────────────────────────────────────────────────────────

export type GeoZone =
  | 'UEMOA'
  | 'WEST_AFRICA'
  | 'CENTRAL_AFRICA'
  | 'EAST_AFRICA'
  | 'NORTH_AFRICA'
  | 'SOUTHERN_AFRICA'
  | 'AMERICAS'
  | 'EUROPE'
  | 'ASIA'
  | 'MIDDLE_EAST'
  | 'OCEANIA';

// ── All countries (ISO 3166-1 alpha-2) ───────────────────────────────────────

export interface CountryInfo {
  name: string;
  nameEn: string;
  zone: GeoZone;
  currency: SupportedCurrency;
  dialCode: string;
}

export const ALL_COUNTRIES: Record<string, CountryInfo> = {
  // ── UEMOA (XOF) ──
  BJ: { name: 'Bénin', nameEn: 'Benin', zone: 'UEMOA', currency: 'XOF', dialCode: '+229' },
  BF: { name: 'Burkina Faso', nameEn: 'Burkina Faso', zone: 'UEMOA', currency: 'XOF', dialCode: '+226' },
  CI: { name: "Côte d'Ivoire", nameEn: 'Ivory Coast', zone: 'UEMOA', currency: 'XOF', dialCode: '+225' },
  GW: { name: 'Guinée-Bissau', nameEn: 'Guinea-Bissau', zone: 'UEMOA', currency: 'XOF', dialCode: '+245' },
  ML: { name: 'Mali', nameEn: 'Mali', zone: 'UEMOA', currency: 'XOF', dialCode: '+223' },
  NE: { name: 'Niger', nameEn: 'Niger', zone: 'UEMOA', currency: 'XOF', dialCode: '+227' },
  SN: { name: 'Sénégal', nameEn: 'Senegal', zone: 'UEMOA', currency: 'XOF', dialCode: '+221' },
  TG: { name: 'Togo', nameEn: 'Togo', zone: 'UEMOA', currency: 'XOF', dialCode: '+228' },

  // ── West Africa (non-UEMOA) ──
  GH: { name: 'Ghana', nameEn: 'Ghana', zone: 'WEST_AFRICA', currency: 'USD', dialCode: '+233' },
  NG: { name: 'Nigeria', nameEn: 'Nigeria', zone: 'WEST_AFRICA', currency: 'USD', dialCode: '+234' },
  GN: { name: 'Guinée', nameEn: 'Guinea', zone: 'WEST_AFRICA', currency: 'USD', dialCode: '+224' },
  SL: { name: 'Sierra Leone', nameEn: 'Sierra Leone', zone: 'WEST_AFRICA', currency: 'USD', dialCode: '+232' },
  LR: { name: 'Liberia', nameEn: 'Liberia', zone: 'WEST_AFRICA', currency: 'USD', dialCode: '+231' },
  CV: { name: 'Cabo Verde', nameEn: 'Cape Verde', zone: 'WEST_AFRICA', currency: 'USD', dialCode: '+238' },
  GM: { name: 'Gambie', nameEn: 'Gambia', zone: 'WEST_AFRICA', currency: 'USD', dialCode: '+220' },
  MR: { name: 'Mauritanie', nameEn: 'Mauritania', zone: 'WEST_AFRICA', currency: 'USD', dialCode: '+222' },

  // ── Central Africa ──
  CM: { name: 'Cameroun', nameEn: 'Cameroon', zone: 'CENTRAL_AFRICA', currency: 'USD', dialCode: '+237' },
  GA: { name: 'Gabon', nameEn: 'Gabon', zone: 'CENTRAL_AFRICA', currency: 'USD', dialCode: '+241' },
  CG: { name: 'Congo', nameEn: 'Congo', zone: 'CENTRAL_AFRICA', currency: 'USD', dialCode: '+242' },
  CD: { name: 'RD Congo', nameEn: 'DR Congo', zone: 'CENTRAL_AFRICA', currency: 'USD', dialCode: '+243' },
  TD: { name: 'Tchad', nameEn: 'Chad', zone: 'CENTRAL_AFRICA', currency: 'USD', dialCode: '+235' },
  CF: { name: 'Centrafrique', nameEn: 'Central African Republic', zone: 'CENTRAL_AFRICA', currency: 'USD', dialCode: '+236' },
  GQ: { name: 'Guinée équatoriale', nameEn: 'Equatorial Guinea', zone: 'CENTRAL_AFRICA', currency: 'USD', dialCode: '+240' },
  ST: { name: 'São Tomé-et-Príncipe', nameEn: 'São Tomé and Príncipe', zone: 'CENTRAL_AFRICA', currency: 'USD', dialCode: '+239' },

  // ── East Africa ──
  KE: { name: 'Kenya', nameEn: 'Kenya', zone: 'EAST_AFRICA', currency: 'USD', dialCode: '+254' },
  TZ: { name: 'Tanzanie', nameEn: 'Tanzania', zone: 'EAST_AFRICA', currency: 'USD', dialCode: '+255' },
  UG: { name: 'Ouganda', nameEn: 'Uganda', zone: 'EAST_AFRICA', currency: 'USD', dialCode: '+256' },
  RW: { name: 'Rwanda', nameEn: 'Rwanda', zone: 'EAST_AFRICA', currency: 'USD', dialCode: '+250' },
  ET: { name: 'Éthiopie', nameEn: 'Ethiopia', zone: 'EAST_AFRICA', currency: 'USD', dialCode: '+251' },
  DJ: { name: 'Djibouti', nameEn: 'Djibouti', zone: 'EAST_AFRICA', currency: 'USD', dialCode: '+253' },
  ER: { name: 'Érythrée', nameEn: 'Eritrea', zone: 'EAST_AFRICA', currency: 'USD', dialCode: '+291' },
  SO: { name: 'Somalie', nameEn: 'Somalia', zone: 'EAST_AFRICA', currency: 'USD', dialCode: '+252' },
  BI: { name: 'Burundi', nameEn: 'Burundi', zone: 'EAST_AFRICA', currency: 'USD', dialCode: '+257' },
  SS: { name: 'Soudan du Sud', nameEn: 'South Sudan', zone: 'EAST_AFRICA', currency: 'USD', dialCode: '+211' },
  KM: { name: 'Comores', nameEn: 'Comoros', zone: 'EAST_AFRICA', currency: 'USD', dialCode: '+269' },
  SC: { name: 'Seychelles', nameEn: 'Seychelles', zone: 'EAST_AFRICA', currency: 'USD', dialCode: '+248' },

  // ── North Africa ──
  MA: { name: 'Maroc', nameEn: 'Morocco', zone: 'NORTH_AFRICA', currency: 'USD', dialCode: '+212' },
  DZ: { name: 'Algérie', nameEn: 'Algeria', zone: 'NORTH_AFRICA', currency: 'USD', dialCode: '+213' },
  TN: { name: 'Tunisie', nameEn: 'Tunisia', zone: 'NORTH_AFRICA', currency: 'USD', dialCode: '+216' },
  EG: { name: 'Égypte', nameEn: 'Egypt', zone: 'NORTH_AFRICA', currency: 'USD', dialCode: '+20' },
  LY: { name: 'Libye', nameEn: 'Libya', zone: 'NORTH_AFRICA', currency: 'USD', dialCode: '+218' },
  SD: { name: 'Soudan', nameEn: 'Sudan', zone: 'NORTH_AFRICA', currency: 'USD', dialCode: '+249' },

  // ── Southern Africa ──
  ZA: { name: 'Afrique du Sud', nameEn: 'South Africa', zone: 'SOUTHERN_AFRICA', currency: 'USD', dialCode: '+27' },
  BW: { name: 'Botswana', nameEn: 'Botswana', zone: 'SOUTHERN_AFRICA', currency: 'USD', dialCode: '+267' },
  ZW: { name: 'Zimbabwe', nameEn: 'Zimbabwe', zone: 'SOUTHERN_AFRICA', currency: 'USD', dialCode: '+263' },
  MZ: { name: 'Mozambique', nameEn: 'Mozambique', zone: 'SOUTHERN_AFRICA', currency: 'USD', dialCode: '+258' },
  MG: { name: 'Madagascar', nameEn: 'Madagascar', zone: 'SOUTHERN_AFRICA', currency: 'USD', dialCode: '+261' },
  MU: { name: 'Maurice', nameEn: 'Mauritius', zone: 'SOUTHERN_AFRICA', currency: 'USD', dialCode: '+230' },
  NA: { name: 'Namibie', nameEn: 'Namibia', zone: 'SOUTHERN_AFRICA', currency: 'USD', dialCode: '+264' },
  ZM: { name: 'Zambie', nameEn: 'Zambia', zone: 'SOUTHERN_AFRICA', currency: 'USD', dialCode: '+260' },
  MW: { name: 'Malawi', nameEn: 'Malawi', zone: 'SOUTHERN_AFRICA', currency: 'USD', dialCode: '+265' },
  AO: { name: 'Angola', nameEn: 'Angola', zone: 'SOUTHERN_AFRICA', currency: 'USD', dialCode: '+244' },
  SZ: { name: 'Eswatini', nameEn: 'Eswatini', zone: 'SOUTHERN_AFRICA', currency: 'USD', dialCode: '+268' },
  LS: { name: 'Lesotho', nameEn: 'Lesotho', zone: 'SOUTHERN_AFRICA', currency: 'USD', dialCode: '+266' },
  RE: { name: 'La Réunion', nameEn: 'Réunion', zone: 'SOUTHERN_AFRICA', currency: 'USD', dialCode: '+262' },

  // ── Americas ──
  US: { name: 'États-Unis', nameEn: 'United States', zone: 'AMERICAS', currency: 'USD', dialCode: '+1' },
  CA: { name: 'Canada', nameEn: 'Canada', zone: 'AMERICAS', currency: 'USD', dialCode: '+1' },
  BR: { name: 'Brésil', nameEn: 'Brazil', zone: 'AMERICAS', currency: 'USD', dialCode: '+55' },
  MX: { name: 'Mexique', nameEn: 'Mexico', zone: 'AMERICAS', currency: 'USD', dialCode: '+52' },
  AR: { name: 'Argentine', nameEn: 'Argentina', zone: 'AMERICAS', currency: 'USD', dialCode: '+54' },
  CO: { name: 'Colombie', nameEn: 'Colombia', zone: 'AMERICAS', currency: 'USD', dialCode: '+57' },
  CL: { name: 'Chili', nameEn: 'Chile', zone: 'AMERICAS', currency: 'USD', dialCode: '+56' },
  PE: { name: 'Pérou', nameEn: 'Peru', zone: 'AMERICAS', currency: 'USD', dialCode: '+51' },
  EC: { name: 'Équateur', nameEn: 'Ecuador', zone: 'AMERICAS', currency: 'USD', dialCode: '+593' },
  VE: { name: 'Venezuela', nameEn: 'Venezuela', zone: 'AMERICAS', currency: 'USD', dialCode: '+58' },
  HT: { name: 'Haïti', nameEn: 'Haiti', zone: 'AMERICAS', currency: 'USD', dialCode: '+509' },
  DO: { name: 'République dominicaine', nameEn: 'Dominican Republic', zone: 'AMERICAS', currency: 'USD', dialCode: '+1' },
  CU: { name: 'Cuba', nameEn: 'Cuba', zone: 'AMERICAS', currency: 'USD', dialCode: '+53' },
  JM: { name: 'Jamaïque', nameEn: 'Jamaica', zone: 'AMERICAS', currency: 'USD', dialCode: '+1' },
  TT: { name: 'Trinité-et-Tobago', nameEn: 'Trinidad and Tobago', zone: 'AMERICAS', currency: 'USD', dialCode: '+1' },
  PA: { name: 'Panama', nameEn: 'Panama', zone: 'AMERICAS', currency: 'USD', dialCode: '+507' },
  CR: { name: 'Costa Rica', nameEn: 'Costa Rica', zone: 'AMERICAS', currency: 'USD', dialCode: '+506' },
  UY: { name: 'Uruguay', nameEn: 'Uruguay', zone: 'AMERICAS', currency: 'USD', dialCode: '+598' },
  PY: { name: 'Paraguay', nameEn: 'Paraguay', zone: 'AMERICAS', currency: 'USD', dialCode: '+595' },
  BO: { name: 'Bolivie', nameEn: 'Bolivia', zone: 'AMERICAS', currency: 'USD', dialCode: '+591' },
  GT: { name: 'Guatemala', nameEn: 'Guatemala', zone: 'AMERICAS', currency: 'USD', dialCode: '+502' },
  HN: { name: 'Honduras', nameEn: 'Honduras', zone: 'AMERICAS', currency: 'USD', dialCode: '+504' },
  SV: { name: 'El Salvador', nameEn: 'El Salvador', zone: 'AMERICAS', currency: 'USD', dialCode: '+503' },
  NI: { name: 'Nicaragua', nameEn: 'Nicaragua', zone: 'AMERICAS', currency: 'USD', dialCode: '+505' },

  // ── Europe ──
  FR: { name: 'France', nameEn: 'France', zone: 'EUROPE', currency: 'USD', dialCode: '+33' },
  GB: { name: 'Royaume-Uni', nameEn: 'United Kingdom', zone: 'EUROPE', currency: 'USD', dialCode: '+44' },
  DE: { name: 'Allemagne', nameEn: 'Germany', zone: 'EUROPE', currency: 'USD', dialCode: '+49' },
  ES: { name: 'Espagne', nameEn: 'Spain', zone: 'EUROPE', currency: 'USD', dialCode: '+34' },
  IT: { name: 'Italie', nameEn: 'Italy', zone: 'EUROPE', currency: 'USD', dialCode: '+39' },
  PT: { name: 'Portugal', nameEn: 'Portugal', zone: 'EUROPE', currency: 'USD', dialCode: '+351' },
  NL: { name: 'Pays-Bas', nameEn: 'Netherlands', zone: 'EUROPE', currency: 'USD', dialCode: '+31' },
  BE: { name: 'Belgique', nameEn: 'Belgium', zone: 'EUROPE', currency: 'USD', dialCode: '+32' },
  CH: { name: 'Suisse', nameEn: 'Switzerland', zone: 'EUROPE', currency: 'USD', dialCode: '+41' },
  AT: { name: 'Autriche', nameEn: 'Austria', zone: 'EUROPE', currency: 'USD', dialCode: '+43' },
  SE: { name: 'Suède', nameEn: 'Sweden', zone: 'EUROPE', currency: 'USD', dialCode: '+46' },
  NO: { name: 'Norvège', nameEn: 'Norway', zone: 'EUROPE', currency: 'USD', dialCode: '+47' },
  DK: { name: 'Danemark', nameEn: 'Denmark', zone: 'EUROPE', currency: 'USD', dialCode: '+45' },
  FI: { name: 'Finlande', nameEn: 'Finland', zone: 'EUROPE', currency: 'USD', dialCode: '+358' },
  IE: { name: 'Irlande', nameEn: 'Ireland', zone: 'EUROPE', currency: 'USD', dialCode: '+353' },
  PL: { name: 'Pologne', nameEn: 'Poland', zone: 'EUROPE', currency: 'USD', dialCode: '+48' },
  RO: { name: 'Roumanie', nameEn: 'Romania', zone: 'EUROPE', currency: 'USD', dialCode: '+40' },
  GR: { name: 'Grèce', nameEn: 'Greece', zone: 'EUROPE', currency: 'USD', dialCode: '+30' },
  CZ: { name: 'Tchéquie', nameEn: 'Czech Republic', zone: 'EUROPE', currency: 'USD', dialCode: '+420' },
  HU: { name: 'Hongrie', nameEn: 'Hungary', zone: 'EUROPE', currency: 'USD', dialCode: '+36' },
  UA: { name: 'Ukraine', nameEn: 'Ukraine', zone: 'EUROPE', currency: 'USD', dialCode: '+380' },
  RU: { name: 'Russie', nameEn: 'Russia', zone: 'EUROPE', currency: 'USD', dialCode: '+7' },
  TR: { name: 'Turquie', nameEn: 'Turkey', zone: 'EUROPE', currency: 'USD', dialCode: '+90' },
  LU: { name: 'Luxembourg', nameEn: 'Luxembourg', zone: 'EUROPE', currency: 'USD', dialCode: '+352' },

  // ── Middle East ──
  AE: { name: 'Émirats arabes unis', nameEn: 'United Arab Emirates', zone: 'MIDDLE_EAST', currency: 'USD', dialCode: '+971' },
  SA: { name: 'Arabie saoudite', nameEn: 'Saudi Arabia', zone: 'MIDDLE_EAST', currency: 'USD', dialCode: '+966' },
  QA: { name: 'Qatar', nameEn: 'Qatar', zone: 'MIDDLE_EAST', currency: 'USD', dialCode: '+974' },
  KW: { name: 'Koweït', nameEn: 'Kuwait', zone: 'MIDDLE_EAST', currency: 'USD', dialCode: '+965' },
  BH: { name: 'Bahreïn', nameEn: 'Bahrain', zone: 'MIDDLE_EAST', currency: 'USD', dialCode: '+973' },
  OM: { name: 'Oman', nameEn: 'Oman', zone: 'MIDDLE_EAST', currency: 'USD', dialCode: '+968' },
  JO: { name: 'Jordanie', nameEn: 'Jordan', zone: 'MIDDLE_EAST', currency: 'USD', dialCode: '+962' },
  LB: { name: 'Liban', nameEn: 'Lebanon', zone: 'MIDDLE_EAST', currency: 'USD', dialCode: '+961' },
  IQ: { name: 'Irak', nameEn: 'Iraq', zone: 'MIDDLE_EAST', currency: 'USD', dialCode: '+964' },
  IR: { name: 'Iran', nameEn: 'Iran', zone: 'MIDDLE_EAST', currency: 'USD', dialCode: '+98' },
  IL: { name: 'Israël', nameEn: 'Israel', zone: 'MIDDLE_EAST', currency: 'USD', dialCode: '+972' },
  PS: { name: 'Palestine', nameEn: 'Palestine', zone: 'MIDDLE_EAST', currency: 'USD', dialCode: '+970' },
  SY: { name: 'Syrie', nameEn: 'Syria', zone: 'MIDDLE_EAST', currency: 'USD', dialCode: '+963' },
  YE: { name: 'Yémen', nameEn: 'Yemen', zone: 'MIDDLE_EAST', currency: 'USD', dialCode: '+967' },

  // ── Asia ──
  CN: { name: 'Chine', nameEn: 'China', zone: 'ASIA', currency: 'USD', dialCode: '+86' },
  IN: { name: 'Inde', nameEn: 'India', zone: 'ASIA', currency: 'USD', dialCode: '+91' },
  JP: { name: 'Japon', nameEn: 'Japan', zone: 'ASIA', currency: 'USD', dialCode: '+81' },
  KR: { name: 'Corée du Sud', nameEn: 'South Korea', zone: 'ASIA', currency: 'USD', dialCode: '+82' },
  ID: { name: 'Indonésie', nameEn: 'Indonesia', zone: 'ASIA', currency: 'USD', dialCode: '+62' },
  TH: { name: 'Thaïlande', nameEn: 'Thailand', zone: 'ASIA', currency: 'USD', dialCode: '+66' },
  VN: { name: 'Vietnam', nameEn: 'Vietnam', zone: 'ASIA', currency: 'USD', dialCode: '+84' },
  PH: { name: 'Philippines', nameEn: 'Philippines', zone: 'ASIA', currency: 'USD', dialCode: '+63' },
  MY: { name: 'Malaisie', nameEn: 'Malaysia', zone: 'ASIA', currency: 'USD', dialCode: '+60' },
  SG: { name: 'Singapour', nameEn: 'Singapore', zone: 'ASIA', currency: 'USD', dialCode: '+65' },
  PK: { name: 'Pakistan', nameEn: 'Pakistan', zone: 'ASIA', currency: 'USD', dialCode: '+92' },
  BD: { name: 'Bangladesh', nameEn: 'Bangladesh', zone: 'ASIA', currency: 'USD', dialCode: '+880' },
  LK: { name: 'Sri Lanka', nameEn: 'Sri Lanka', zone: 'ASIA', currency: 'USD', dialCode: '+94' },
  NP: { name: 'Népal', nameEn: 'Nepal', zone: 'ASIA', currency: 'USD', dialCode: '+977' },
  MM: { name: 'Myanmar', nameEn: 'Myanmar', zone: 'ASIA', currency: 'USD', dialCode: '+95' },
  KH: { name: 'Cambodge', nameEn: 'Cambodia', zone: 'ASIA', currency: 'USD', dialCode: '+855' },
  HK: { name: 'Hong Kong', nameEn: 'Hong Kong', zone: 'ASIA', currency: 'USD', dialCode: '+852' },
  TW: { name: 'Taïwan', nameEn: 'Taiwan', zone: 'ASIA', currency: 'USD', dialCode: '+886' },

  // ── Oceania ──
  AU: { name: 'Australie', nameEn: 'Australia', zone: 'OCEANIA', currency: 'USD', dialCode: '+61' },
  NZ: { name: 'Nouvelle-Zélande', nameEn: 'New Zealand', zone: 'OCEANIA', currency: 'USD', dialCode: '+64' },
};

// ── Name-to-code mapping (generated from ALL_COUNTRIES) ──────────────────────

const _nameToCode: Record<string, string> = {};
for (const [code, info] of Object.entries(ALL_COUNTRIES)) {
  _nameToCode[info.name.toLowerCase()] = code;
  _nameToCode[info.nameEn.toLowerCase()] = code;
}
// Legacy aliases
_nameToCode['ivory coast'] = 'CI';
_nameToCode['cote d\'ivoire'] = 'CI';
_nameToCode['burkina'] = 'BF';
_nameToCode['guinee-bissau'] = 'GW';
_nameToCode['guinee bissau'] = 'GW';

export const COUNTRY_NAME_TO_CODE: Record<string, string> = _nameToCode;

// Legacy compat: French display names
export const COUNTRY_CODE_TO_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(ALL_COUNTRIES).map(([code, info]) => [code, info.name])
);

// ── Utility functions ────────────────────────────────────────────────────────

/** Accept any valid ISO 2-letter code or country name (FR/EN) */
export function normalizeCountryCode(input: string | undefined | null): string | null {
  if (!input) return null;

  const trimmed = input.trim();
  if (!trimmed) return null;

  // If already 2-letter code, validate it exists in ALL_COUNTRIES
  if (trimmed.length === 2) {
    const upper = trimmed.toUpperCase();
    return ALL_COUNTRIES[upper] ? upper : null;
  }

  // Try name lookup (case-insensitive)
  const normalized = trimmed.toLowerCase();
  return COUNTRY_NAME_TO_CODE[normalized] || null;
}

/** Check if a country code is UEMOA */
export function isUEMOACountry(code: string | undefined | null): boolean {
  if (!code) return false;
  return UEMOA_COUNTRIES.includes(code.toUpperCase() as UEMOACountryCode);
}

/** Get country display name from code */
export function getCountryName(code: string | undefined | null): string | null {
  if (!code) return null;
  return ALL_COUNTRIES[code.toUpperCase()]?.name ?? null;
}

/** Get the default currency for a country (XOF for UEMOA, USD for all others) */
export function getCurrencyForCountry(code: string | undefined | null): SupportedCurrency {
  if (!code) return 'USD';
  return ALL_COUNTRIES[code.toUpperCase()]?.currency ?? 'USD';
}

/** Get country info */
export function getCountryInfo(code: string | undefined | null): CountryInfo | null {
  if (!code) return null;
  return ALL_COUNTRIES[code.toUpperCase()] ?? null;
}

/** Get all country codes as sorted array (UEMOA first, then alphabetical) */
export function getAllCountryCodes(): string[] {
  const uemoa = [...UEMOA_COUNTRIES];
  const rest = Object.keys(ALL_COUNTRIES)
    .filter(c => !UEMOA_COUNTRIES.includes(c as UEMOACountryCode))
    .sort((a, b) => ALL_COUNTRIES[a].name.localeCompare(ALL_COUNTRIES[b].name, 'fr'));
  return [...uemoa, ...rest];
}
