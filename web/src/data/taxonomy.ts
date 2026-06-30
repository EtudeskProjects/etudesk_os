/**
 * Taxonomie de l'observatoire des competences digitales Etudesk.
 * Source : referentiel proprietaire etudesk_digital_skills (catalog_version 2026-Q2).
 *
 * Convention design (alignee app mobile) :
 *  - la COULEUR encode le TYPE de competence (5 teintes joyau, via variables CSS).
 *  - les FAMILLES sont monochromes, differenciees par une icone Lucide.
 * Le slug reste la cle stable. Les relations (prerequis / voisines / associees)
 * viennent du graphe d'edges (edges.json).
 */

import {
  BookOpen, Wrench, Users, Boxes, Languages,
  BrainCircuit, Database, Code2, CloudCog, ShieldCheck, PenTool,
  Megaphone, Landmark, Scale, BriefcaseBusiness, HeartHandshake,
  Factory, Leaf, GraduationCap, Laptop, Stethoscope, type LucideIcon,
} from 'lucide-react';
import competenciesRaw from './competencies.json';

export type CompetencyType =
  | 'knowledge' | 'hard_skill' | 'soft_skill' | 'tool_platform' | 'language';

export type FamilyKey =
  | 'digital_foundations' | 'human_communication_languages' | 'ai_ml_automation'
  | 'data_analytics_bi' | 'software_engineering' | 'cloud_devops_infrastructure'
  | 'cybersecurity_digital_trust' | 'product_ux_design' | 'marketing_sales_content'
  | 'business_operations_management' | 'finance_fintech_digital_assets'
  | 'law_compliance_governance' | 'education_learning_tech'
  | 'health_biotech_medtech' | 'industry_hardware_mobility'
  | 'sustainability_climate_energy_agri';

export interface Competency {
  slug: string;
  family: FamilyKey;
  type: CompetencyType;
  name: string;
  name_fr: string;
  description_en: string;
  description_fr: string;
  official_url: string;
}

export const competencies = competenciesRaw as Competency[];
export const CATALOG_VERSION = '2026-Q2';

/** Resolution slug -> competence, O(1). */
export const BY_SLUG: Record<string, Competency> = competencies.reduce(
  (acc, c) => { acc[c.slug] = c; return acc; },
  {} as Record<string, Competency>,
);

// Types (couleur = sens)

export interface TypeMeta {
  key: CompetencyType;
  fr: string;
  en: string;
  Icon: LucideIcon;
  colorVar: string; // variable CSS (clair + sombre geres dans globals.css)
  bgVar: string;
}

export const TYPES: TypeMeta[] = [
  { key: 'knowledge', fr: 'Savoir', en: 'Knowledge', Icon: BookOpen, colorVar: '--skill-knowledge', bgVar: '--skill-knowledge-bg' },
  { key: 'hard_skill', fr: 'Savoir-faire', en: 'Hard skill', Icon: Wrench, colorVar: '--skill-hard-skill', bgVar: '--skill-hard-skill-bg' },
  { key: 'soft_skill', fr: 'Savoir-être', en: 'Soft skill', Icon: Users, colorVar: '--skill-soft-skill', bgVar: '--skill-soft-skill-bg' },
  { key: 'language', fr: 'Langage', en: 'Language', Icon: Languages, colorVar: '--skill-language', bgVar: '--skill-language-bg' },
  { key: 'tool_platform', fr: 'Outils', en: 'Tools', Icon: Boxes, colorVar: '--skill-tool-platform', bgVar: '--skill-tool-platform-bg' },
];

export const TYPE_MAP: Record<CompetencyType, TypeMeta> = TYPES.reduce(
  (acc, t) => { acc[t.key] = t; return acc; },
  {} as Record<CompetencyType, TypeMeta>,
);

/** Couleur de type (hex statique, pour le canvas du graphe ou aucun var CSS n'est resolu). */
export const TYPE_HEX: Record<CompetencyType, { light: string; dark: string }> = {
  knowledge: { light: '#1D4ED8', dark: '#60A5FA' },
  hard_skill: { light: '#0E7490', dark: '#22D3EE' },
  soft_skill: { light: '#BE185D', dark: '#F472B6' },
  tool_platform: { light: '#6D28D9', dark: '#A78BFA' },
  language: { light: '#047857', dark: '#34D399' },
};

// Palette des 16 familles (couleur "par famille" du graphe). Teintes reparties
// sur la roue chromatique, lisibles en clair et en sombre.
function hslHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const c = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

const FAMILY_HUES: Record<FamilyKey, number> = {
  digital_foundations: 64,
  human_communication_languages: 320,
  ai_ml_automation: 340,
  data_analytics_bi: 28,
  software_engineering: 222,
  cloud_devops_infrastructure: 198,
  cybersecurity_digital_trust: 4,
  product_ux_design: 280,
  marketing_sales_content: 16,
  business_operations_management: 236,
  finance_fintech_digital_assets: 168,
  law_compliance_governance: 44,
  education_learning_tech: 84,
  health_biotech_medtech: 352,
  industry_hardware_mobility: 184,
  sustainability_climate_energy_agri: 140,
};

export const FAMILY_HEX = Object.fromEntries(
  (Object.keys(FAMILY_HUES) as FamilyKey[]).map((k) => [
    k, { light: hslHex(FAMILY_HUES[k], 64, 46), dark: hslHex(FAMILY_HUES[k], 70, 66) },
  ])
) as Record<FamilyKey, { light: string; dark: string }>;

// Familles (monochromes, icone Lucide)

export interface FamilyMeta {
  key: FamilyKey;
  fr: string;
  en: string;
  descFr: string;
  descEn: string;
  Icon: LucideIcon;
}

export const FAMILIES: FamilyMeta[] = [
  { key: 'digital_foundations', fr: 'Fondamentaux numériques', en: 'Digital Foundations', Icon: Laptop,
    descFr: 'Maîtriser les bases, la productivité et les usages numériques courants.',
    descEn: 'Master core digital, productivity and everyday tool practices.' },
  { key: 'human_communication_languages', fr: 'Humain, communication & langues', en: 'Human Skills, Communication & Languages', Icon: HeartHandshake,
    descFr: 'Collaborer, communiquer, apprendre et travailler avec les autres.',
    descEn: 'Collaborate, communicate, learn and work with others.' },
  { key: 'ai_ml_automation', fr: 'IA, ML & automatisation', en: 'AI, ML & Automation', Icon: BrainCircuit,
    descFr: 'Concevoir, entraîner, évaluer et intégrer des systèmes intelligents.',
    descEn: 'Design, train, evaluate and integrate intelligent systems.' },
  { key: 'data_analytics_bi', fr: 'Données, analytics & BI', en: 'Data, Analytics & BI', Icon: Database,
    descFr: 'Collecter, structurer, analyser et valoriser la donnée.',
    descEn: 'Collect, structure, analyse and turn data into value.' },
  { key: 'software_engineering', fr: 'Développement logiciel', en: 'Software Engineering', Icon: Code2,
    descFr: 'Construire des applications, API et systèmes fiables.',
    descEn: 'Build reliable applications, APIs and software systems.' },
  { key: 'cloud_devops_infrastructure', fr: 'Cloud, infrastructure & DevOps', en: 'Cloud, Infrastructure & DevOps', Icon: CloudCog,
    descFr: 'Déployer, automatiser, observer et opérer à l\'échelle.',
    descEn: 'Deploy, automate, observe and operate at scale.' },
  { key: 'cybersecurity_digital_trust', fr: 'Cybersécurité & confiance numérique', en: 'Cybersecurity & Digital Trust', Icon: ShieldCheck,
    descFr: 'Protéger les systèmes, les identités, les données et les usages.',
    descEn: 'Protect systems, identities, data and digital usage.' },
  { key: 'product_ux_design', fr: 'Produit, UX/UI & design', en: 'Product, UX/UI & Design', Icon: PenTool,
    descFr: 'Concevoir des produits, services et expériences utiles.',
    descEn: 'Design useful products, services and experiences.' },
  { key: 'marketing_sales_content', fr: 'Marketing, vente & contenu', en: 'Marketing, Sales & Content', Icon: Megaphone,
    descFr: 'Acquérir, convertir, fidéliser et produire du contenu.',
    descEn: 'Acquire, convert, retain and produce content.' },
  { key: 'business_operations_management', fr: 'Business, opérations & management', en: 'Business, Operations & Management', Icon: BriefcaseBusiness,
    descFr: 'Piloter les projets, les équipes, les processus et la performance.',
    descEn: 'Run projects, teams, processes and performance.' },
  { key: 'finance_fintech_digital_assets', fr: 'Finance, fintech & actifs numériques', en: 'Finance, Fintech & Digital Assets', Icon: Landmark,
    descFr: 'Gérer la finance, les paiements, les risques et les actifs numériques.',
    descEn: 'Manage finance, payments, risk and digital assets.' },
  { key: 'law_compliance_governance', fr: 'Droit, conformité & gouvernance', en: 'Law, Compliance & Governance', Icon: Scale,
    descFr: 'Encadrer les usages numériques, réglementaires et publics.',
    descEn: 'Frame digital, regulatory and public-sector practices.' },
  { key: 'education_learning_tech', fr: 'Éducation, formation & learning tech', en: 'Education, Training & Learning Tech', Icon: GraduationCap,
    descFr: 'Concevoir, évaluer et outiller les apprentissages.',
    descEn: 'Design, assess and support learning experiences.' },
  { key: 'health_biotech_medtech', fr: 'Santé, biotech & medtech', en: 'Health, Biotech & Medtech', Icon: Stethoscope,
    descFr: 'Appliquer le numérique à la santé, au vivant et aux dispositifs médicaux.',
    descEn: 'Apply digital technology to health, life sciences and medical devices.' },
  { key: 'industry_hardware_mobility', fr: 'Industrie, hardware & mobilité', en: 'Industry, Hardware & Mobility', Icon: Factory,
    descFr: 'Concevoir et opérer des systèmes physiques, industriels et mobiles.',
    descEn: 'Design and operate physical, industrial and mobility systems.' },
  { key: 'sustainability_climate_energy_agri', fr: 'Durabilité, climat, énergie & agriculture', en: 'Sustainability, Climate, Energy & Agriculture', Icon: Leaf,
    descFr: 'Agir sur le climat, les ressources, l\'énergie et les systèmes agricoles.',
    descEn: 'Act on climate, resources, energy and agricultural systems.' },
];

export const FAMILY_MAP: Record<FamilyKey, FamilyMeta> = FAMILIES.reduce(
  (acc, f) => { acc[f.key] = f; return acc; },
  {} as Record<FamilyKey, FamilyMeta>,
);

export const FAMILY_COUNTS: Record<FamilyKey, number> = competencies.reduce(
  (acc, c) => { acc[c.family] = (acc[c.family] || 0) + 1; return acc; },
  {} as Record<FamilyKey, number>,
);

export const TYPE_COUNTS: Record<CompetencyType, number> = competencies.reduce(
  (acc, c) => { acc[c.type] = (acc[c.type] || 0) + 1; return acc; },
  {} as Record<CompetencyType, number>,
);
