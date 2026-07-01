#!/usr/bin/env npx tsx
/**
 * Skill Validation Script
 * Validates skill definitions: frontmatter format, invalid origin values,
 * declared tools per mode, and obvious body/frontmatter mismatches.
 *
 * Usage: npx tsx scripts/validate-skills.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const SKILLS_DIR = path.join(__dirname, '../src/services/copilot/skills/definitions');
const INVALID_ORIGIN = 'DOCUMENT_EXTRACTED';
const VALID_MODES = ['explore', 'study', 'org'] as const;
const VALID_TOOLS_BY_MODE: Record<(typeof VALID_MODES)[number], readonly string[]> = {
  explore: [
    'smart_search',
    'sql_query',
    'generate_document',
    'file_reader',
    'web_search',
    'find_competency',
    'competency_graph',
    'learning_path',
    'execute_action',
  ],
  study: [
    'sql_query',
    'youtube_search',
    'generate_image',
    'generate_diagram',
    'file_reader',
    'web_search',
    'manage_skills',
    'find_competency',
    'competency_graph',
    'learning_path',
    'execute_action',
  ],
  org: [
    'smart_search',
    'sql_query',
    'generate_document',
    'file_reader',
    'web_search',
    'find_competency',
    'competency_graph',
    'execute_action',
  ],
};
const ALL_RUNTIME_TOOLS = Array.from(new Set(Object.values(VALID_TOOLS_BY_MODE).flat()));
const KNOWN_COMPONENT_BLOCKS = [
  'chart',
  'confirmation',
  'skills',
  'skill_match',
  'youtube',
  'diagram',
  'image',
  'quiz',
  'flashcard',
  'exercise',
  'playground',
  'audio_tts',
  'canvas',
  'math',
  'steps',
] as const;
const VALID_COMPONENTS_BY_MODE: Record<(typeof VALID_MODES)[number], readonly string[]> = {
  explore: ['chart', 'confirmation', 'skills', 'skill_match'],
  org: ['chart', 'confirmation', 'skills', 'skill_match'],
  study: KNOWN_COMPONENT_BLOCKS,
};

interface ValidationResult {
  file: string;
  errors: string[];
  warnings: string[];
}

function getFrontmatterValue(frontmatter: string, key: string): string {
  const match = frontmatter.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
  return match ? match[1].trim() : '';
}

function getFrontmatterList(frontmatter: string, key: string): string[] {
  const value = getFrontmatterValue(frontmatter, key);
  return value ? value.split(',').map((s) => s.trim()).filter(Boolean) : [];
}

function validateSkillFile(filePath: string): ValidationResult {
  const filename = path.basename(filePath);
  const result: ValidationResult = { file: filename, errors: [], warnings: [] };

  const content = fs.readFileSync(filePath, 'utf-8');

  // Check for invalid DOCUMENT_EXTRACTED
  if (content.includes(INVALID_ORIGIN)) {
    result.errors.push(
      `Invalid origin "${INVALID_ORIGIN}" found. Use "extracted" instead (manage_skills schema).`
    );
  }

  // Check frontmatter exists
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (!frontmatterMatch) {
    result.errors.push('Missing or invalid YAML frontmatter.');
    return result;
  }

  const frontmatter = frontmatterMatch[1];
  const body = content.slice(frontmatterMatch[0].length);
  const requiredFields = ['name', 'description', 'modes', 'tools', 'triggers'];
  for (const field of requiredFields) {
    const value = getFrontmatterValue(frontmatter, field);
    if (!value) {
      result.errors.push(`Missing or empty required field: ${field}`);
    }
  }

  const modes = getFrontmatterList(frontmatter, 'modes');
  const tools = getFrontmatterList(frontmatter, 'tools');

  for (const mode of modes) {
    if (!VALID_MODES.includes(mode as any)) {
      result.errors.push(`Invalid mode "${mode}". Valid modes: ${VALID_MODES.join(', ')}`);
      continue;
    }
    const allowed = VALID_TOOLS_BY_MODE[mode as (typeof VALID_MODES)[number]];
    for (const tool of tools) {
      if (!allowed.includes(tool)) {
        result.errors.push(
          `Tool "${tool}" is not available in mode "${mode}". Allowed: ${allowed.join(', ')}`
        );
      }
    }
  }

  const componentBlocks = [...body.matchAll(/```([a-z_]+)\b/g)].map((match) => match[1]);
  for (const component of componentBlocks) {
    if (!KNOWN_COMPONENT_BLOCKS.includes(component as any)) continue;
    for (const mode of modes) {
      if (!VALID_MODES.includes(mode as any)) continue;
      const allowed = VALID_COMPONENTS_BY_MODE[mode as (typeof VALID_MODES)[number]];
      if (!allowed.includes(component)) {
        result.errors.push(
          `Component block "${component}" is not available in mode "${mode}". Allowed: ${allowed.join(', ')}`
        );
      }
    }
  }

  const declaredTools = new Set(tools);
  for (const tool of ALL_RUNTIME_TOOLS) {
    const escaped = tool.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const positiveUse = new RegExp(
      `\\b(?:call|use|run|after|before|then|with|via)\\s+\`?${escaped}\`?\\b|\`${escaped}\`\\s+(?:with|when|after|before|then|returns|result|results)`,
      'i'
    );
    const negativeUse = new RegExp(`\\b(?:do\\s+not|don't|never)\\s+(?:call|use|run)\\s+\`?${escaped}\`?\\b`, 'i');
    if (positiveUse.test(body) && !negativeUse.test(body) && !declaredTools.has(tool)) {
      result.errors.push(`Body references runtime tool "${tool}" but frontmatter tools does not declare it.`);
    }
  }

  if (/parallel|PARALLEL|single tool-use turn|call all tools at once/i.test(body)) {
    result.warnings.push('Mentions parallel tool calls. Runtime sets parallel_tool_calls=false; prefer sequential wording.');
  }

  return result;
}

function main(): void {
  console.log('Validating skills...\n');

  if (!fs.existsSync(SKILLS_DIR)) {
    console.error(`Skills directory not found: ${SKILLS_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(SKILLS_DIR).filter((f) => f.endsWith('.skill.md'));
  let hasErrors = false;
  let hasWarnings = false;

  for (const file of files) {
    const result = validateSkillFile(path.join(SKILLS_DIR, file));

    if (result.errors.length > 0 || result.warnings.length > 0) {
      console.log(`\n${result.file}`);
      if (result.errors.length > 0) {
        hasErrors = true;
        result.errors.forEach((e) => console.log(`  ERROR: ${e}`));
      }
      if (result.warnings.length > 0) {
        hasWarnings = true;
        result.warnings.forEach((w) => console.log(`  WARN:  ${w}`));
      }
    }
  }

  if (!hasErrors && !hasWarnings) {
    console.log(`All ${files.length} skills passed validation.`);
    process.exit(0);
  }

  if (hasErrors) {
    console.log('\nValidation failed. Fix errors above.');
    process.exit(1);
  }

  console.log('\nValidation completed with warnings.');
  process.exit(0);
}

main();
