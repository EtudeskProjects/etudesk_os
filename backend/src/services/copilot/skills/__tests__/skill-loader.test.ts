/**
 * Skill Loader Integration Tests
 * Verifies that skills load without error and triggers match correctly.
 *
 * Usage: npx tsx src/services/copilot/skills/__tests__/skill-loader.test.ts
 */

import {
  loadAllSkillMetadata,
  getSkillsForMode,
  getSkillBody,
  detectSkillFromMessage,
  detectSkillFromMessageStatic,
  reloadSkills,
} from '../skill.loader';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (e: any) {
    console.error(`  ✗ ${name}`);
    throw e;
  }
}

async function testAsync(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
  } catch (e: any) {
    console.error(`  ✗ ${name}`);
    throw e;
  }
}

async function main(): Promise<void> {
  console.log('\n=== Skill Loader Integration Tests ===\n');

  // Force reload to clear cache
  reloadSkills();

  test('loadAllSkillMetadata returns non-empty array', () => {
    const metadata = loadAllSkillMetadata();
    assert(Array.isArray(metadata), 'metadata should be array');
    assert(metadata.length >= 25, `expected >= 25 skills, got ${metadata.length}`);
  });

  test('all skills have required metadata fields', () => {
    const metadata = loadAllSkillMetadata();
    for (const m of metadata) {
      assert(!!m.id, `skill ${m.id} missing id`);
      assert(!!m.name, `skill ${m.id} missing name`);
      assert(!!m.description, `skill ${m.id} missing description`);
      assert(m.modes.length >= 1, `skill ${m.id} must have at least 1 mode`);
    }
  });

  test('getSkillBody returns instructions for known skill', () => {
    const body = getSkillBody('cv-generation');
    assert(body !== null, 'cv-generation should have instructions');
    assert(body!.includes('CV') || body!.includes('Workflow'), 'instructions should contain workflow content');
  });

  test('getSkillsForMode returns skills for each mode', () => {
    const explore = getSkillsForMode('explore');
    const study = getSkillsForMode('study');
    const org = getSkillsForMode('org');
    assert(explore.length >= 5, `explore should have >= 5 skills, got ${explore.length}`);
    assert(study.length >= 5, `study should have >= 5 skills, got ${study.length}`);
    assert(org.length >= 5, `org should have >= 5 skills, got ${org.length}`);
  });

  // --- Static (substring) detection tests ---

  test('detectSkillFromMessageStatic matches cv-generation for CV trigger', () => {
    const result = detectSkillFromMessageStatic('Je veux generer mon CV en PDF', 'explore');
    assert(result !== null, 'should match a skill');
    assert(result!.skillId === 'cv-generation', `expected cv-generation, got ${result!.skillId}`);
  });

  test('detectSkillFromMessageStatic matches autodiagnostic for bilan competences', () => {
    const result = detectSkillFromMessageStatic('Je veux un bilan competences', 'study');
    assert(result !== null, 'should match a skill');
    assert(result!.skillId === 'autodiagnostic-talent', `expected autodiagnostic-talent, got ${result!.skillId}`);
  });

  test('detectSkillFromMessageStatic matches opportunity-publishing for publier offre', () => {
    const result = detectSkillFromMessageStatic('Je veux publier une offre CDI', 'org');
    assert(result !== null, 'should match a skill');
    assert(result!.skillId === 'opportunity-publishing', `expected opportunity-publishing, got ${result!.skillId}`);
  });

  test('detectSkillFromMessageStatic returns null for unrelated message', () => {
    const result = detectSkillFromMessageStatic('Quel temps fait-il aujourd hui?', 'explore');
    assert(result === null, 'unrelated message should not match any skill');
  });

  // --- Async (embedding) detection tests — falls back to static when no embeddings are pre-computed ---

  await testAsync('detectSkillFromMessage (async) falls back to static when no embeddings', async () => {
    const result = await detectSkillFromMessage('Je veux generer mon CV en PDF', 'explore');
    assert(result !== null, 'should match a skill via static fallback');
    assert(result!.skillId === 'cv-generation', `expected cv-generation, got ${result!.skillId}`);
  });

  await testAsync('detectSkillFromMessage (async) returns null for unrelated message', async () => {
    const result = await detectSkillFromMessage('Quel temps fait-il aujourd hui?', 'explore');
    assert(result === null, 'unrelated message should not match any skill');
  });

  test('loadAllSkillMetadata returns lightweight metadata', () => {
    const metadata = loadAllSkillMetadata();
    for (const m of metadata) {
      assert(!!m.id && !!m.name && !!m.description, 'metadata must have id, name, description');
      assert(Array.isArray(m.modes), 'modes must be array');
    }
  });

  console.log('\nAll tests passed.\n');
}

main();
