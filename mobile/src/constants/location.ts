// Données de localisation dynamiques depuis communes.json
import communesData from '../data/communes.json';

// Types
export interface Country {
  id: string;
  label: string;
}

export interface Region {
  id: string;
  label: string;
}

export interface Commune {
  id: string;
  label: string;
}

// Structure du JSON
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

const data = communesData as CommunesData;

// Générer la liste des pays
export const COUNTRIES: Country[] = data.pays
  .map((pays) => ({
    id: pays.code_iso,
    label: pays.nom,
  }))
  .sort((a, b) => a.label.localeCompare(b.label, 'fr'));

// Fonction pour obtenir les régions d'un pays
export const getRegionsByCountry = (countryCode: string): Region[] => {
  const pays = data.pays.find((p) => p.code_iso === countryCode);
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
    // Trier le reste alphabétiquement (après Abidjan)
    const [first, ...rest] = regions;
    return [first, ...rest.sort((a, b) => a.label.localeCompare(b.label, 'fr'))];
  }

  return regions.sort((a, b) => a.label.localeCompare(b.label, 'fr'));
};

// Fonction pour obtenir les communes d'une région
export const getCommunesByRegion = (countryCode: string, regionId: string): Commune[] => {
  const pays = data.pays.find((p) => p.code_iso === countryCode);
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

// Fonction pour obtenir le label d'un pays
export const getCountryLabel = (countryCode: string): string => {
  const country = COUNTRIES.find((c) => c.id === countryCode);
  return country?.label || countryCode;
};

// Fonction pour obtenir le label d'une région
export const getRegionLabel = (countryCode: string, regionId: string): string => {
  const regions = getRegionsByCountry(countryCode);
  const region = regions.find((r) => r.id === regionId);
  return region?.label || regionId;
};

// Fonction pour obtenir le label d'une commune
export const getCommuneLabel = (countryCode: string, regionId: string, communeId: string): string => {
  const communes = getCommunesByRegion(countryCode, regionId);
  const commune = communes.find((c) => c.id === communeId);
  return commune?.label || communeId;
};

// Types de codes pays
export type CountryCode = string;

// Genres (statique)
export const GENDERS = [
  { id: 'M', label: 'Homme' },
  { id: 'F', label: 'Femme' },
  { id: 'OTHER', label: 'Autre' },
] as const;

export type Gender = (typeof GENDERS)[number]['id'];
