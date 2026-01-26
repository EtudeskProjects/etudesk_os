/**
 * Utilitaires pour la gestion des Hubs
 * Fonctions de calcul de capacité, vérification de conformité, etc.
 */

import {
  HubType,
  HubUsageCategory,
  SpaceType,
  SafetyEquipment,
  AccessibilityFeature,
  HUB_TYPE_USAGE_MAP,
  SPACE_TYPE_DENSITY,
  HubSpace,
  Hub,
} from '../types/models';

// ═══════════════════════════════════════════════════════════════
// CALCULS DE CAPACITÉ
// ═══════════════════════════════════════════════════════════════

/**
 * Calcule la capacité d'un espace selon sa surface et son type
 * @param surfaceM2 Surface en mètres carrés
 * @param spaceType Type d'espace
 * @returns Capacité maximale en personnes
 */
export function calculateSpaceCapacity(surfaceM2: number, spaceType: SpaceType): number {
  const density = SPACE_TYPE_DENSITY[spaceType];
  if (!density || density <= 0) return 0;
  return Math.floor(surfaceM2 / density);
}

/**
 * Calcule la capacité totale d'un hub basée sur ses espaces
 * Les espaces communs (accueil, cafétéria, détente) ne sont pas comptabilisés
 * @param spaces Liste des espaces du hub
 * @returns Capacité totale en personnes
 */
export function calculateHubCapacity(spaces: HubSpace[]): number {
  const nonCountedTypes: SpaceType[] = ['ACCUEIL', 'CAFETERIA', 'ESPACE_DETENTE'];

  return spaces.reduce((total, space) => {
    if (nonCountedTypes.includes(space.type)) return total;
    return total + space.capacity;
  }, 0);
}

/**
 * Détermine la catégorie d'usage selon le type de hub
 * @param hubType Type de hub
 * @returns Catégorie d'usage ou null pour les hubs virtuels
 */
export function getUsageCategoryFromType(hubType: HubType): HubUsageCategory | null {
  return HUB_TYPE_USAGE_MAP[hubType] || null;
}

// ═══════════════════════════════════════════════════════════════
// ÉQUIPEMENTS DE SÉCURITÉ
// ═══════════════════════════════════════════════════════════════

/**
 * Seuils de capacité pour les équipements de sécurité requis
 */
export const SAFETY_EQUIPMENT_THRESHOLDS: Record<SafetyEquipment, number> = {
  EXTINCTEUR: 0,           // Toujours requis
  DETECTEUR_FUMEE: 0,      // Toujours requis
  PLAN_EVACUATION: 0,      // Toujours requis
  ALARME_INCENDIE: 50,     // > 50 personnes
  SORTIE_SECOURS: 50,      // > 50 personnes
  ECLAIRAGE_SECOURS: 100,  // > 100 personnes
  DESENFUMAGE: 300,        // > 300 personnes
  PORTE_COUPE_FEU: 300,    // > 300 personnes
  SPRINKLER: 700,          // > 700 personnes
};

/**
 * Retourne les équipements de sécurité requis pour une capacité donnée
 * @param maxCapacity Capacité maximale
 * @returns Liste des équipements requis
 */
export function getRequiredSafetyEquipment(maxCapacity: number): SafetyEquipment[] {
  return (Object.entries(SAFETY_EQUIPMENT_THRESHOLDS) as [SafetyEquipment, number][])
    .filter(([_, threshold]) => maxCapacity >= threshold)
    .map(([equipment]) => equipment);
}

// ═══════════════════════════════════════════════════════════════
// VÉRIFICATION DE CONFORMITÉ
// ═══════════════════════════════════════════════════════════════

export interface ComplianceCheckResult {
  isCompliant: boolean;
  warnings: string[];
  errors: string[];
  score: number; // Score de conformité 0-100
}

/**
 * Labels français pour les équipements de sécurité
 */
const SAFETY_EQUIPMENT_LABELS: Record<SafetyEquipment, string> = {
  EXTINCTEUR: 'Extincteurs',
  DETECTEUR_FUMEE: 'Détecteurs de fumée',
  ALARME_INCENDIE: 'Alarme incendie',
  SORTIE_SECOURS: 'Sorties de secours',
  PLAN_EVACUATION: "Plan d'évacuation",
  ECLAIRAGE_SECOURS: 'Éclairage de secours',
  SPRINKLER: 'Sprinklers',
  DESENFUMAGE: 'Désenfumage',
  PORTE_COUPE_FEU: 'Portes coupe-feu',
};

/**
 * Vérifie la conformité d'un hub
 * @param hub Données du hub à vérifier
 * @returns Résultat de la vérification avec erreurs et avertissements
 */
export function checkHubCompliance(hub: Partial<Hub>): ComplianceCheckResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  let totalChecks = 0;
  let passedChecks = 0;

  // 1. Surface obligatoire
  totalChecks++;
  if (!hub.surface_m2 || hub.surface_m2 <= 0) {
    errors.push('Surface non renseignée ou invalide');
  } else {
    passedChecks++;
  }

  // 2. Capacité obligatoire
  totalChecks++;
  if (!hub.max_capacity || hub.max_capacity <= 0) {
    errors.push('Capacité maximale non définie ou invalide');
  } else {
    passedChecks++;
  }

  // 3. Cohérence surface/capacité (si les deux sont définis)
  if (hub.surface_m2 && hub.max_capacity && hub.usage_category) {
    totalChecks++;
    // Densité minimale recommandée: 2m² par personne
    const minSurface = hub.max_capacity * 2;
    if (hub.surface_m2 < minSurface) {
      warnings.push(`Surface potentiellement insuffisante: ${hub.surface_m2}m² pour ${hub.max_capacity} personnes (min recommandé: ${minSurface}m²)`);
    } else {
      passedChecks++;
    }
  }

  // 4. Sécurité selon capacité
  if (hub.max_capacity) {
    const required = getRequiredSafetyEquipment(hub.max_capacity);
    const current = hub.safety_equipment || [];
    const missing = required.filter(eq => !current.includes(eq));

    totalChecks += required.length;
    passedChecks += required.length - missing.length;

    missing.forEach(eq => {
      errors.push(`Équipement de sécurité requis manquant: ${SAFETY_EQUIPMENT_LABELS[eq] || eq}`);
    });
  }

  // 5. Accessibilité (obligatoire depuis 2015)
  totalChecks++;
  if (!hub.is_accessible) {
    warnings.push('Établissement déclaré non accessible aux personnes handicapées');
  } else {
    passedChecks++;

    // Vérifier les équipements d'accessibilité de base
    totalChecks++;
    const baseAccessibility: AccessibilityFeature[] = ['RAMPE_ACCES', 'WC_ACCESSIBLE'];
    const currentAccessibility = hub.accessibility_features || [];
    const hasBasicAccessibility = baseAccessibility.some(f => currentAccessibility.includes(f));

    if (!hasBasicAccessibility) {
      warnings.push("Accessibilité déclarée mais équipements de base non listés (rampe d'accès, WC accessible)");
    } else {
      passedChecks++;
    }
  }

  // 6. Inspection récente (recommandé tous les 3 ans)
  totalChecks++;
  if (hub.last_inspection_date) {
    const threeYearsAgo = new Date();
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);

    const inspectionDate = new Date(hub.last_inspection_date);
    if (inspectionDate < threeYearsAgo) {
      warnings.push('Dernière inspection de sécurité date de plus de 3 ans');
    } else {
      passedChecks++;
    }
  } else {
    warnings.push('Date de dernière inspection de sécurité non renseignée');
  }

  // Calcul du score
  const score = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 0;

  return {
    isCompliant: errors.length === 0,
    warnings,
    errors,
    score,
  };
}

// ═══════════════════════════════════════════════════════════════
// UTILITAIRES DIVERS
// ═══════════════════════════════════════════════════════════════

/**
 * Génère un résumé textuel des caractéristiques d'un hub
 * @param hub Données du hub
 * @returns Résumé en français
 */
export function generateHubSummary(hub: Partial<Hub>): string {
  const parts: string[] = [];

  if (hub.usage_category) {
    const usageLabels: Record<HubUsageCategory, string> = {
      FORMATION: 'espace de formation',
      TRAVAIL: 'espace de travail',
      REUNION: 'espace de réunion',
      ATELIER: 'atelier',
      MIXTE: 'espace polyvalent',
    };
    parts.push(usageLabels[hub.usage_category] || 'espace');
  }

  if (hub.surface_m2) {
    parts.push(`${hub.surface_m2} m²`);
  }

  if (hub.max_capacity) {
    parts.push(`capacité ${hub.max_capacity} personnes`);
  }

  if (hub.is_accessible) {
    parts.push('accessible PMR');
  }

  if (hub.spaces && hub.spaces.length > 0) {
    parts.push(`${hub.spaces.length} espace(s) interne(s)`);
  }

  return parts.length > 0 ? parts.join(' • ') : 'Informations non disponibles';
}

/**
 * Valide la structure d'un HubSpace
 * @param space Espace à valider
 * @returns true si valide
 */
export function isValidHubSpace(space: Partial<HubSpace>): space is HubSpace {
  return (
    typeof space.id === 'string' &&
    typeof space.name === 'string' &&
    typeof space.type === 'string' &&
    typeof space.surface_m2 === 'number' &&
    space.surface_m2 > 0 &&
    typeof space.capacity === 'number' &&
    space.capacity > 0 &&
    typeof space.floor === 'number' &&
    typeof space.is_accessible === 'boolean' &&
    typeof space.is_bookable === 'boolean'
  );
}

/**
 * Calcule automatiquement les champs dérivés d'un hub
 * @param hub Hub à compléter
 * @returns Hub avec champs calculés
 */
export function computeHubDerivedFields(hub: Partial<Hub>): Partial<Hub> {
  const computed: Partial<Hub> = { ...hub };

  // Calculer usage_category depuis type si non défini
  if (!computed.usage_category && computed.type) {
    const category = getUsageCategoryFromType(computed.type);
    if (category) {
      computed.usage_category = category;
    }
  }

  // Calculer max_capacity depuis les espaces si non défini
  if (!computed.max_capacity && computed.spaces && computed.spaces.length > 0) {
    computed.max_capacity = calculateHubCapacity(computed.spaces);
  }

  // Calculer floors_count depuis les espaces si non défini
  if (!computed.floors_count && computed.spaces && computed.spaces.length > 0) {
    const floors = new Set(computed.spaces.map(s => s.floor));
    computed.floors_count = floors.size;
  }

  return computed;
}
