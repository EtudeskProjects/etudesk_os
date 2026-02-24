// Données de localisation — UEMOA (communes.json) + mondial (countries.json + regions/)
import communesData from '../data/communes.json';
import americasData from '../data/regions/americas.json';
import asiaData from '../data/regions/asia.json';
import centralAfricaData from '../data/regions/central-africa.json';
import eastAfricaData from '../data/regions/east-africa.json';
import europeData from '../data/regions/europe.json';
import middleEastData from '../data/regions/middle-east.json';
import northAfricaData from '../data/regions/north-africa.json';
import southernAfricaData from '../data/regions/southern-africa.json';
import westAfricaData from '../data/regions/west-africa.json';

// Types
export interface Country {
  id: string;
  label: string;
  zone?: string;
  currency?: string;
}

export interface Region {
  id: string;
  label: string;
}

export interface Commune {
  id: string;
  label: string;
}

// Structure du JSON communes (UEMOA)
interface CommunesRegion {
  nom: string;
  communes: string[];
}

interface CommunesPays {
  nom: string;
  code_iso: string;
  regions: CommunesRegion[];
}

interface CommunesData {
  pays: CommunesPays[];
}

// Structure du JSON countries (mondial)
interface CountryEntry {
  code: string;
  name: string;
  nameEn: string;
  zone: string;
  currency: string;
  dialCode: string;
  flag: string;
}

interface CountriesData {
  countries: CountryEntry[];
}

const uemoaData = communesData as CommunesData;

// UEMOA country codes for priority sorting
const UEMOA_CODES = new Set(['BJ', 'BF', 'CI', 'GW', 'ML', 'NE', 'SN', 'TG']);

// ── Country list ─────────────────────────────────────────────────────────────

// Cache for global countries list
let _globalCountries: Country[] | null = null;

/** Get all countries (lazy-loaded from countries.json if available, fallback to UEMOA) */
export const getCountries = (): Country[] => {
  if (_globalCountries) return _globalCountries;

  try {
    // Try loading global countries dataset
    const countriesJson = require('../data/countries.json') as CountriesData;
    const uemoaCountries: Country[] = [];
    const otherCountries: Country[] = [];

    for (const c of countriesJson.countries) {
      const entry: Country = {
        id: c.code,
        label: `${c.flag} ${c.name}`,
        zone: c.zone,
        currency: c.currency,
      };
      if (UEMOA_CODES.has(c.code)) {
        uemoaCountries.push(entry);
      } else {
        otherCountries.push(entry);
      }
    }

    // UEMOA first (CI at top), then rest alphabetically
    uemoaCountries.sort((a, b) => {
      if (a.id === 'CI') return -1;
      if (b.id === 'CI') return 1;
      return a.label.localeCompare(b.label, 'fr');
    });
    otherCountries.sort((a, b) => a.label.localeCompare(b.label, 'fr'));

    _globalCountries = [...uemoaCountries, ...otherCountries];
  } catch {
    // Fallback to UEMOA-only from communes.json
    _globalCountries = uemoaData.pays
      .map((pays) => ({
        id: pays.code_iso,
        label: pays.nom,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'fr'));
  }

  return _globalCountries;
};

// Legacy compat: expose the global list so existing screens get all countries.
export const COUNTRIES: Country[] = getCountries();

// ── Zone-based region loading ────────────────────────────────────────────────

// Map country codes to their zone file for lazy loading
const ZONE_FILE_MAP: Record<string, string> = {};

// UEMOA countries → loaded from communes.json (already in memory)
for (const p of uemoaData.pays) {
  ZONE_FILE_MAP[p.code_iso] = 'uemoa';
}

// Other zones → loaded on demand from regions/*.json
const ZONE_COUNTRIES: Record<string, string[]> = {
  'west-africa': ['GH', 'NG', 'GN', 'SL', 'LR', 'CV', 'GM', 'MR'],
  'central-africa': ['CM', 'GA', 'CG', 'CD', 'TD', 'CF', 'GQ', 'ST'],
  'east-africa': ['KE', 'TZ', 'UG', 'RW', 'ET', 'DJ', 'ER', 'SO', 'BI', 'SS', 'KM', 'SC'],
  'north-africa': ['MA', 'DZ', 'TN', 'EG', 'LY', 'SD'],
  'southern-africa': ['ZA', 'BW', 'ZW', 'MZ', 'MG', 'MU', 'NA', 'ZM', 'MW', 'AO', 'SZ', 'LS', 'RE'],
  americas: ['US', 'CA', 'BR', 'MX', 'AR', 'CO', 'CL', 'PE', 'EC', 'VE', 'HT', 'DO', 'CU', 'JM', 'TT', 'PA', 'CR', 'UY', 'PY', 'BO', 'GT', 'HN', 'SV', 'NI'],
  europe: ['FR', 'GB', 'DE', 'ES', 'IT', 'PT', 'NL', 'BE', 'CH', 'AT', 'SE', 'NO', 'DK', 'FI', 'IE', 'PL', 'RO', 'GR', 'CZ', 'HU', 'UA', 'RU', 'TR', 'LU'],
  asia: ['CN', 'IN', 'JP', 'KR', 'ID', 'TH', 'VN', 'PH', 'MY', 'SG', 'PK', 'BD', 'LK', 'NP', 'MM', 'KH', 'HK', 'TW'],
  'middle-east': ['AE', 'SA', 'QA', 'KW', 'BH', 'OM', 'JO', 'LB', 'IQ', 'IR', 'IL', 'PS', 'SY', 'YE'],
};

for (const [zone, codes] of Object.entries(ZONE_COUNTRIES)) {
  for (const code of codes) {
    ZONE_FILE_MAP[code] = zone;
  }
}

// Cache loaded zone data
const _zoneCache: Record<string, CommunesPays[]> = {
  uemoa: uemoaData.pays,
};

const REGION_ZONE_DATA: Record<string, CommunesData> = {
  americas: americasData as CommunesData,
  asia: asiaData as CommunesData,
  'central-africa': centralAfricaData as CommunesData,
  'east-africa': eastAfricaData as CommunesData,
  europe: europeData as CommunesData,
  'middle-east': middleEastData as CommunesData,
  'north-africa': northAfricaData as CommunesData,
  'southern-africa': southernAfricaData as CommunesData,
  'west-africa': westAfricaData as CommunesData,
};

function loadZoneData(zone: string): CommunesPays[] {
  if (_zoneCache[zone]) return _zoneCache[zone];

  const zoneData = REGION_ZONE_DATA[zone];
  if (!zoneData) return [];

  _zoneCache[zone] = zoneData.pays;
  return zoneData.pays;
}

function findCountryInZone(countryCode: string): CommunesPays | null {
  const zone = ZONE_FILE_MAP[countryCode];
  if (!zone) return null;

  const zoneData = loadZoneData(zone);
  return zoneData.find((p) => p.code_iso === countryCode) || null;
}

// ── Region & Commune functions ───────────────────────────────────────────────

export const getRegionsByCountry = (countryCode: string): Region[] => {
  const pays = findCountryInZone(countryCode);
  if (!pays) return [];

  const regions = pays.regions.map((region) => ({
    id: region.nom.toLowerCase().replace(/\s+/g, '-'),
    label: region.nom,
  }));

  // Pour la Côte d'Ivoire, mettre District Abidjan en premier
  if (countryCode === 'CI') {
    const abidjanIndex = regions.findIndex((r) => r.label.toLowerCase().includes('abidjan'));
    if (abidjanIndex > 0) {
      const [abidjan] = regions.splice(abidjanIndex, 1);
      regions.unshift(abidjan);
    }
    const [first, ...rest] = regions;
    return [first, ...rest.sort((a, b) => a.label.localeCompare(b.label, 'fr'))];
  }

  return regions.sort((a, b) => a.label.localeCompare(b.label, 'fr'));
};

export const getCommunesByRegion = (countryCode: string, regionId: string): Commune[] => {
  const pays = findCountryInZone(countryCode);
  if (!pays) return [];

  const region = pays.regions.find(
    (r) => r.nom.toLowerCase().replace(/\s+/g, '-') === regionId
  );
  if (!region) return [];

  return region.communes
    .map((commune) => ({
      id: commune.toLowerCase().replace(/\s+/g, '-'),
      label: commune,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'fr'));
};

export const getCountryLabel = (countryCode: string): string => {
  const countries = getCountries();
  const country = countries.find((c) => c.id === countryCode);
  return country?.label || countryCode;
};

export const getRegionLabel = (countryCode: string, regionId: string): string => {
  const regions = getRegionsByCountry(countryCode);
  const region = regions.find((r) => r.id === regionId);
  return region?.label || regionId;
};

export const getCommuneLabel = (countryCode: string, regionId: string, communeId: string): string => {
  const communes = getCommunesByRegion(countryCode, regionId);
  const commune = communes.find((c) => c.id === communeId);
  return commune?.label || communeId;
};

/** Get default currency for a country */
export const getCurrencyForCountry = (countryCode: string): 'XOF' | 'USD' => {
  return UEMOA_CODES.has(countryCode) ? 'XOF' : 'USD';
};

// Types de codes pays
export type CountryCode = string;

// Genres (statique)
export const GENDERS = [
  { id: 'M', label: 'Homme' },
  { id: 'F', label: 'Femme' },
] as const;

export type Gender = (typeof GENDERS)[number]['id'];
