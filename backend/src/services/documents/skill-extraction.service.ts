/**
 * Skill Extraction Service
 * Maps skills extracted from a document (CV / diploma) to the digital skills
 * catalog and records them on the talent through the evaluation service.
 * Skills that cannot be resolved to a catalog competency are dropped (logged).
 */

import { ExtractedSkill } from './extraction.service';
import { logger } from '../../utils';
import * as catalog from '../skills/catalog.service';
import { evaluateBatch, EvalTarget } from '../skills/evaluation.service';
import { Level, isValidLevel } from '../../constants/skills';

export interface SkillExtractionResult {
  added: number;
  skipped: number;
  skills: Array<{ name: string; slug?: string; action: 'added' | 'skipped' }>;
}

function foldSkillLabel(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’']/g, ' ')
    .replace(/[^a-z0-9+#./ -]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const EXTRACTION_ALIAS_RULES: Array<{ match: RegExp; slug: string }> = [
  { match: /\b(strategie numerique|transformation numerique|digital transformation|strategie digitale)\b/, slug: 'digital-transformation' },
  { match: /\b(culture numerique|competences numeriques|fondamentaux numeriques)\b/, slug: 'digital-literacy' },
  { match: /\b(intelligence artificielle appliquee|ia appliquee|artificial intelligence appliquee)\b/, slug: 'ai-literacy' },
  { match: /\b(intelligence artificielle|culture de l ia|ia generative|generative ai)\b/, slug: 'ai-literacy' },
  { match: /\b(gouvernance de l ia|ai governance)\b/, slug: 'ai-governance' },
  { match: /\b(gouvernance numerique|politique publique numerique|politiques publiques numeriques|innovation publique)\b/, slug: 'digital-public-policy' },
  { match: /\b(service public numerique|services publics numeriques|startup4gov|govtech)\b/, slug: 'digital-public-service-design' },
  { match: /\b(e government|e-gov|administration en ligne)\b/, slug: 'e-government' },
  { match: /\b(partenariats institutionnels|relations institutionnelles|gestion des parties prenantes|stakeholder)\b/, slug: 'stakeholder-management' },
  { match: /\b(entrepreneuriat technologique|entrepreneuriat tech|entrepreneuriat startup|esprit entrepreneurial)\b/, slug: 'entrepreneurial-mindset' },
  { match: /\b(lean startup|startup)\b/, slug: 'lean-startup' },
  { match: /\b(r&d en technologie educative|technologie educative|edtech|ia en education|ia generative en education)\b/, slug: 'generative-ai-in-education' },
  { match: /\b(pedagogie|ingenierie pedagogique|formation)\b/, slug: 'pedagogy' },
  { match: /\b(diplomatie technologique|diplomatie)\b/, slug: 'diplomacy' },
  { match: /\b(marketing technologique|marketing augmente par l ia|ai powered marketing)\b/, slug: 'ai-powered-marketing' },
  { match: /\b(fundraising institutionnel|fundraising|levee de fonds|levée de fonds)\b/, slug: 'fundraising' },
  { match: /\b(ecosysteme startup africain|ecosysteme tech|ecosystemes technologiques|marches emergents)\b/, slug: 'emerging-markets-tech-ecosystems' },
  { match: /\b(technologie emergente|technologies emergentes|veille technologique)\b/, slug: 'emerging-markets-tech-ecosystems' },
  { match: /\b(veille reglementaire|reglementaire|regtech)\b/, slug: 'regtech' },
  { match: /\b(redaction de politiques publiques|redaction citoyenne|policy writing)\b/, slug: 'civic-writing' },
  { match: /\b(communication politique|communication institutionnelle)\b/, slug: 'communication' },
  { match: /\b(leadership jeunesse|engagement civique|participation citoyenne)\b/, slug: 'civic-participation' },
  { match: /\b(gestion d equipe|gestion d equipe startup|leadership d equipe|leadership equipe)\b/, slug: 'remote-team-leadership' },
  { match: /\b(strategie d entreprise|business strategy)\b/, slug: 'business-strategy' },
  { match: /\b(pensee strategique|strategic thinking)\b/, slug: 'strategic-thinking' },
  { match: /\b(recherche academique|recherche en ligne|veille informationnelle)\b/, slug: 'online-research' },
  { match: /\b(recherche assistee par ia|ai assisted research)\b/, slug: 'ai-assisted-research' },
];

async function resolveExtractedSkillLabel(label: string): Promise<catalog.ResolveResult | null> {
  const resolved = await catalog.resolveLabel(label);
  if (resolved) return resolved;

  const folded = foldSkillLabel(label);
  const alias = EXTRACTION_ALIAS_RULES.find((rule) => rule.match.test(folded));
  if (!alias) return null;

  const competency = await catalog.getCompetency(alias.slug);
  return competency ? { ...competency, confidence: 0.88 } : null;
}

/**
 * Resolve extracted skills to catalog slugs and persist them as `extracted`
 * UserCompetency rows (level capped at advanced; a document is an artifact).
 */
export async function extractAndSaveSkills(
  talentId: string,
  documentId: string,
  extractedSkills: ExtractedSkill[]
): Promise<SkillExtractionResult> {
  const result: SkillExtractionResult = { added: 0, skipped: 0, skills: [] };

  const targets: EvalTarget[] = [];
  const labelBySlug = new Map<string, string>();

  for (const skill of extractedSkills) {
    if (!skill.name) continue;
    const resolved = await resolveExtractedSkillLabel(skill.name);
    if (!resolved) {
      logger.info(`[skill-extraction] dropped non-catalog skill "${skill.name}" (talent ${talentId})`);
      result.skipped++;
      result.skills.push({ name: skill.name, action: 'skipped' });
      continue;
    }
    const level = mapProficiencyHint(skill.proficiency_hint);
    targets.push({
      slug: resolved.slug,
      origin: 'extracted',
      assertedLevel: level,
      // a CV / diploma is an artifact-strength signal
      signals: [{ kind: 'artifact', source_ref: `doc:${documentId}`, note: skill.context }],
      evaluatedBy: 'document_extraction',
      levelCap: 'advanced', // extracted/document claims never auto-create master
    });
    labelBySlug.set(resolved.slug, resolved.name_fr || resolved.name);
  }

  if (targets.length === 0) return result;

  const evals = await evaluateBatch({ talentId, targets });
  for (const e of evals) {
    if (e.status === 'written') {
      result.added++;
      result.skills.push({ name: labelBySlug.get(e.slug) || e.slug, slug: e.slug, action: 'added' });
    } else {
      result.skipped++;
      result.skills.push({ name: labelBySlug.get(e.slug) || e.slug, slug: e.slug, action: 'skipped' });
    }
  }

  return result;
}

function mapProficiencyHint(hint?: string): Level {
  if (!hint) return 'intermediate';
  const lower = hint.toLowerCase();
  if (isValidLevel(lower)) return lower as Level;
  // legacy uppercase hints
  const legacy: Record<string, Level> = {
    master: 'master',
    expert: 'advanced',
    advanced: 'advanced',
    intermediate: 'intermediate',
    beginner: 'beginner',
  };
  return legacy[lower] || 'intermediate';
}

export default { extractAndSaveSkills };
