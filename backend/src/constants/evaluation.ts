/**
 * Evaluation Framework Constants
 * Encodes the fixed tables from datasets/etudesk_digital_skills/EVALUATION_FRAMEWORK.md
 * (§5 type lenses, §6 family profiles/cycles, §8 confidence guards, §9 decay & caps).
 * These are small, stable reference tables consumed by evaluation.service.ts.
 */

import { CatalogType, Level } from './skills';

// --- §5 Type lenses (the 4 evidence lines per catalog type) ---
// Injected (only the relevant 4 lines) into the Fast-LLM direct-evidence input.

export const TYPE_LENSES: Record<CatalogType, [string, string, string, string]> = {
  knowledge: [
    'Explains or recalls concepts',
    'Applies concepts to concrete decisions',
    'Compares, critiques, evaluates, and arbitrates',
    'Creates doctrine, standards, or frameworks',
  ],
  hard_skill: [
    'Reproduces known procedures',
    'Delivers reliable standard work',
    'Solves new cases and optimizes tradeoffs',
    'Defines reference methods and handles rare expert cases',
  ],
  soft_skill: [
    'Present but inconsistent in easy contexts',
    'Reliable in normal contexts',
    'Holds under pressure, conflict, or novelty',
    'Role model who raises the group',
  ],
  tool_platform: [
    'Basic guided use',
    'Autonomous daily use',
    'Advanced features, integrations, troubleshooting',
    'Organization-level setup, training, or governance',
  ],
  language: [
    'A1-A2 (natural) / reproduces known procedures (formal)',
    'B1 (natural) / delivers reliable standard work (formal)',
    'B2-C1 (natural) / solves new cases (formal)',
    'C2 or native-equivalent (natural) / defines reference methods (formal)',
  ],
};

// --- §6 Family profiles: cycle (freshness/decay) + adjacency strength ---

export type Cycle = 'fast' | 'medium' | 'slow';
export type Adjacency = 'strong' | 'medium' | 'weak';

export interface FamilyProfile {
  cycle: Cycle;
  adjacency: Adjacency;
}

export const FAMILY_PROFILES: Record<string, FamilyProfile> = {
  ai_ml_automation: { cycle: 'fast', adjacency: 'strong' },
  cloud_devops_infrastructure: { cycle: 'fast', adjacency: 'strong' },
  cybersecurity_digital_trust: { cycle: 'fast', adjacency: 'strong' },
  software_engineering: { cycle: 'medium', adjacency: 'strong' },
  data_analytics_bi: { cycle: 'medium', adjacency: 'strong' },
  industry_hardware_mobility: { cycle: 'medium', adjacency: 'strong' },
  finance_fintech_digital_assets: { cycle: 'medium', adjacency: 'medium' },
  product_ux_design: { cycle: 'medium', adjacency: 'medium' },
  marketing_sales_content: { cycle: 'medium', adjacency: 'medium' },
  education_learning_tech: { cycle: 'medium', adjacency: 'medium' },
  health_biotech_medtech: { cycle: 'slow', adjacency: 'medium' },
  law_compliance_governance: { cycle: 'slow', adjacency: 'medium' },
  sustainability_climate_energy_agri: { cycle: 'slow', adjacency: 'medium' },
  business_operations_management: { cycle: 'slow', adjacency: 'weak' },
  human_communication_languages: { cycle: 'slow', adjacency: 'weak' },
  digital_foundations: { cycle: 'slow', adjacency: 'weak' },
};

export function getFamilyProfile(family: string): FamilyProfile {
  const profile = FAMILY_PROFILES[family];
  if (!profile) {
    throw new Error(`Unknown competency family: ${family}`);
  }
  return profile;
}

// tool_platform always uses the fast cycle (framework §9). Natural languages use slow.
export function effectiveCycle(family: string, type: CatalogType): Cycle {
  if (type === 'tool_platform') return 'fast';
  if (type === 'language') return 'slow';
  return getFamilyProfile(family).cycle;
}

// --- §6 Freshness penalty (months thresholds -> confidence delta) ---

export const FRESHNESS_PENALTY: Record<Cycle, { months: number; penalty: number } | null> = {
  fast: { months: 24, penalty: 0.2 },
  medium: { months: 48, penalty: 0.15 },
  slow: null, // no default freshness penalty
};

// --- §9 Decay thresholds (months): active <=, stale <=, archived after ---

export const DECAY_THRESHOLDS: Record<Cycle, { active: number; stale: number; archived: number }> = {
  fast: { active: 12, stale: 24, archived: 36 },
  medium: { active: 24, stale: 48, archived: 72 },
  slow: { active: 36, stale: 72, archived: 120 },
};

// --- §8 Base confidence by strongest source ---

export const BASE_CONFIDENCE = {
  declared: 0.3,
  inference: 0.55, // pure inference or correlated signals
  artifact: 0.8, // artifact or assessment
} as const;

export const CONFIDENCE_GUARDS = {
  MASTER_MIN: 0.8,
  ADVANCED_MIN: 0.6,
  CONFIRMING_SIGNAL_BONUS: 0.15,
  GRAPH_AGREEMENT_BONUS: 0.1,
} as const;

// --- §9 Capacity caps (active profile) ---

export const GLOBAL_ACTIVE_CAPS = {
  master: 7,
  advanced: 35,
  intermediate: 120,
  // beginner: no strict cap
} as const;

export const FAMILY_ACTIVE_CAPS = {
  master: 3,
  advanced: 12,
  advancedTechFamilies: 16, // software_engineering, data_analytics_bi, ai_ml_automation, cloud_devops_infrastructure
} as const;

export const TECH_FAMILIES_HIGH_CAP = new Set([
  'software_engineering',
  'data_analytics_bi',
  'ai_ml_automation',
  'cloud_devops_infrastructure',
]);

// --- §7 Graph inference prior caps ---

export const INFERENCE = {
  CAP_STRONG: 3, // strong prerequisite or strong same-family sibling
  CAP_DEFAULT: 2,
  STRONG_STRENGTH: 0.7,
} as const;

// Participation-validation level ceilings (skill-validation.service)
export const VALIDATION_CAPS: Record<'community' | 'space' | 'opportunity', { level: Level; confidence: number }> = {
  community: { level: 'intermediate', confidence: 0.55 },
  space: { level: 'intermediate', confidence: 0.55 },
  opportunity: { level: 'advanced', confidence: 0.65 },
};
