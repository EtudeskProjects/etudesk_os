/**
 * Ontology Cache — Loads docs/ontology.md once at startup and caches in memory
 * Injected into all copilot agent prompts so agents know the platform's
 * entities, enums, relationships, permissions, and business rules.
 */

import fs from 'fs';
import path from 'path';
import { logger } from '../../utils';

let cachedOntology: string | null = null;
let cachedOntologySlim: string | null = null;
let cachedOntologyStudy: string | null = null;
let cachedOntologyExplore: string | null = null;
let cachedOntologyOrg: string | null = null;

/**
 * Returns the ontology content, loading from disk only on first call.
 * Subsequent calls return the cached string.
 */
export function getOntology(): string {
  if (cachedOntology !== null) {
    return cachedOntology;
  }

  try {
    const ontologyPath = path.resolve(__dirname, '../../../../docs/ontology.md');
    cachedOntology = fs.readFileSync(ontologyPath, 'utf-8');
    logger.info(`[ontology.cache] Loaded ontology (${cachedOntology.length} chars)`);
  } catch (error: any) {
    logger.error(`[ontology.cache] Failed to load ontology: ${error.message}`);
    cachedOntology = '(Ontologie non disponible)';
  }

  return cachedOntology;
}

/**
 * Returns a slimmed-down ontology with sections 5 (Action Ontology) and
 * 8 (Copilot Agent Mapping) removed. These sections are reference material
 * not needed by agents at runtime. Saves ~3,400 tokens per request.
 */
export function getOntologySlim(): string {
  if (cachedOntologySlim !== null) {
    return cachedOntologySlim;
  }

  const full = getOntology();
  const lines = full.split('\n');
  const filtered: string[] = [];
  let skip = false;

  for (const line of lines) {
    if (line.startsWith('## 5. Action Ontology') || line.startsWith('## 8. Copilot Agent Mapping')) {
      skip = true;
      continue;
    }
    if (skip && line.startsWith('## ')) {
      skip = false;
    }
    if (!skip) {
      filtered.push(line);
    }
  }

  cachedOntologySlim = filtered.join('\n');
  logger.info(`[ontology.cache] Slim ontology: ${cachedOntologySlim.length} chars (was ${full.length})`);
  return cachedOntologySlim;
}

/**
 * Returns a study-mode-optimized ontology. Keeps only what the study agent needs:
 * - Section 1.1 Core Actors, 1.2 (TalentDocument, TalentSkill only), 1.3 trimmed
 * - Section 2.1 Talent, 2.6 TalentDocument, 2.7 TalentSkill
 * - Section 3 Enums (trimmed: skills + documents + actor enums only)
 * - Section 4.2 (hasSkill, extractedFrom)
 * - Section 6.1 Study Mode rules L1-L5, 6.2 Talent restrictions
 * Strips: Organization/Community/Opportunity/Space properties, Action Ontology,
 * Capability Matrix, Agent Mapping, org/subscription/community/space rules.
 * Saves ~1,500 tokens vs slim.
 */
export function getOntologyForStudy(): string {
  if (cachedOntologyStudy !== null) {
    return cachedOntologyStudy;
  }

  const slim = getOntologySlim();
  const lines = slim.split('\n');
  const filtered: string[] = [];
  let skip = false;

  // Subsections to exclude for study mode
  const skipSections = [
    '### 1.3 Relationship Objects',
    '### 2.2 Organization',
    '### 2.3 Community',
    '### 2.4 Opportunity',
    '### 2.5 Space',
    '### 2.8 Publication',
    '## 4. Object Properties',
    '### 6.3 Organization Restrictions',
    '### 6.4 Subscription Rules',
    '### 6.5 Community Rules',
    '### 6.6 Space Booking Rules',
    '## 7. Capability Matrix',
  ];

  // Enum blocks to strip from section 3.2 (keep only Skill*, Document* enums)
  const skipEnumPatterns = [
    /^Community\w+\s*:=/,
    /^Opportunity\w+\s*:=/,
    /^OpportunityStatus/,
    /^ContractType/,
    /^WorkRhythm/,
    /^CompensationFrequency/,
    /^LocationType/,
    /^ApplicationStatus/,
    /^Space\w+\s*:=/,
    /^BookingStatus/,
    /^PricingType/,
    /^Publication\w+\s*:=/,
    /^ModerationStatus/,
    /^Notification\w+\s*:=/,
    /^Subscription\w+\s*:=/,
    /^Invitation\w+\s*:=/,
    /^Membership\w+\s*:=/,
    /^MembershipType/,
    /^AccessType/,
    /^Visibility\s*:=/,
    /^CommunityRole/,
    /^OrgRole/,
    /^OrgMemberStatus/,
    /^OrgType/,
    /^VerificationStatus/,
    /^PollVote/,
  ];

  let inEnumBlock = false;
  let skipEnum = false;

  for (const line of lines) {
    // Check if we're entering a skip section
    if (skipSections.some((s) => line.startsWith(s))) {
      skip = true;
      continue;
    }

    // Check if a new section starts (stop skipping)
    if (skip) {
      if (line.startsWith('## ') || line.startsWith('### ')) {
        skip = false;
      } else {
        continue;
      }
    }

    // Track enum code blocks for selective stripping
    const trimmed = line.trim();
    if (trimmed === '```' && inEnumBlock) {
      inEnumBlock = false;
      if (skipEnum) {
        skipEnum = false;
        continue;
      }
    }
    if (trimmed.startsWith('```') && !inEnumBlock) {
      inEnumBlock = true;
    }

    // Inside enum block, check if current line starts a skip-worthy enum
    if (inEnumBlock && skipEnumPatterns.some((p) => p.test(trimmed))) {
      skipEnum = true;
    }

    if (!skipEnum) {
      filtered.push(line);
    }
  }

  cachedOntologyStudy = filtered.join('\n');
  logger.info(`[ontology.cache] Study ontology: ${cachedOntologyStudy.length} chars (slim was ${slim.length})`);
  return cachedOntologyStudy;
}

/**
 * Returns an explore-mode-optimized ontology. Keeps all entities/enums/relationships
 * needed for discovery, but strips study-specific rules and Capability Matrix.
 * Strips: Section 6.1 Study Mode rules (L1-L5), Section 2.7 TalentSkill details,
 * Section 7 Capability Matrix (already in slim: sections 5+8 removed).
 * Saves ~300 tokens vs slim.
 */
export function getOntologyForExplore(): string {
  if (cachedOntologyExplore !== null) {
    return cachedOntologyExplore;
  }

  const slim = getOntologySlim();
  const lines = slim.split('\n');
  const filtered: string[] = [];
  let skip = false;

  const skipSections = [
    '### 6.1 Study Mode',
    '### 2.7 TalentSkill',
    '## 7. Capability Matrix',
  ];

  for (const line of lines) {
    if (skipSections.some((s) => line.startsWith(s))) {
      skip = true;
      continue;
    }
    if (skip && (line.startsWith('## ') || line.startsWith('### '))) {
      skip = false;
    }
    if (!skip) {
      filtered.push(line);
    }
  }

  cachedOntologyExplore = filtered.join('\n');
  logger.info(`[ontology.cache] Explore ontology: ${cachedOntologyExplore.length} chars (slim was ${slim.length})`);
  return cachedOntologyExplore;
}

/**
 * Returns an org-mode-optimized ontology. Keeps all entity properties, enums,
 * and business rules needed for organization management. Strips study-specific
 * rules and skill attributes not relevant to org admins.
 * Strips: Section 6.1 Study Mode rules (L1-L5), Section 2.7 TalentSkill details,
 * Section 7 Capability Matrix (already in slim: sections 5+8 removed).
 * Saves ~300 tokens vs slim.
 */
export function getOntologyForOrg(): string {
  if (cachedOntologyOrg !== null) {
    return cachedOntologyOrg;
  }

  const slim = getOntologySlim();
  const lines = slim.split('\n');
  const filtered: string[] = [];
  let skip = false;

  const skipSections = [
    '### 6.1 Study Mode',
    '### 2.7 TalentSkill',
    '## 7. Capability Matrix',
  ];

  for (const line of lines) {
    if (skipSections.some((s) => line.startsWith(s))) {
      skip = true;
      continue;
    }
    if (skip && (line.startsWith('## ') || line.startsWith('### '))) {
      skip = false;
    }
    if (!skip) {
      filtered.push(line);
    }
  }

  cachedOntologyOrg = filtered.join('\n');
  logger.info(`[ontology.cache] Org ontology: ${cachedOntologyOrg.length} chars (slim was ${slim.length})`);
  return cachedOntologyOrg;
}

/**
 * Force reload the ontology from disk (useful for dev/hot-reload)
 */
export function reloadOntology(): void {
  cachedOntology = null;
  cachedOntologySlim = null;
  cachedOntologyStudy = null;
  cachedOntologyExplore = null;
  cachedOntologyOrg = null;
  getOntology();
}
