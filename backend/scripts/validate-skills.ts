#!/usr/bin/env npx tsx
/**
 * Skill Validation Script
 * Validates skill definitions: detects invalid origin values (DOCUMENT_EXTRACTED),
 * checks frontmatter format, and reports issues.
 *
 * Usage: npx tsx scripts/validate-skills.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const SKILLS_DIR = path.join(__dirname, '../src/services/copilot/skills/definitions');
const INVALID_ORIGIN = 'DOCUMENT_EXTRACTED';
const VALID_ORIGINS = ['declared', 'inferred', 'extracted'];

interface ValidationResult {
  file: string;
  errors: string[];
  warnings: string[];
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

  // Check for manage_skills without type parameter in instructions
  if (content.includes('manage_skills') && content.includes('origin')) {
    const hasTypeInManageSkills =
      /(HARD_SKILL|SOFT_SKILL|KNOWLEDGE)/i.test(content) &&
      /type\s*[=:"']?\s*(HARD_SKILL|SOFT_SKILL|KNOWLEDGE)/i.test(content);
    if (!hasTypeInManageSkills) {
      result.warnings.push(
        'manage_skills calls should include type (HARD_SKILL, SOFT_SKILL, or KNOWLEDGE).'
      );
    }
  }

  // Check frontmatter exists
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (!frontmatterMatch) {
    result.errors.push('Missing or invalid YAML frontmatter.');
    return result;
  }

  const frontmatter = frontmatterMatch[1];
  const requiredFields = ['name', 'description', 'modes', 'tools', 'triggers'];
  for (const field of requiredFields) {
    const match = frontmatter.match(new RegExp(`^${field}:\\s*(.+)$`, 'm'));
    if (!match || !match[1].trim()) {
      result.errors.push(`Missing or empty required field: ${field}`);
    }
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
