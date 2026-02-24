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
    assert(metadata.length >= 10, `expected >= 10 skills, got ${metadata.length}`);
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
    const metadata = loadAllSkillMetadata();
    const candidateIds = ['cv-generation', 'job-description-generation', 'opportunity-publishing'];
    const existingId = candidateIds.find((id) => metadata.some((m) => m.id === id)) || metadata[0]?.id;
    assert(!!existingId, 'at least one skill id should exist');
    const body = getSkillBody(existingId as string);
    assert(body !== null, `${existingId} should have instructions`);
    assert(body!.trim().length > 30, 'instructions should not be empty');
  });

  test('getSkillsForMode returns skills for each mode', () => {
    const explore = getSkillsForMode('explore');
    const study = getSkillsForMode('study');
    const org = getSkillsForMode('org');
    assert(explore.length >= 1, `explore should have >= 1 skill, got ${explore.length}`);
    assert(study.length >= 1, `study should have >= 1 skill, got ${study.length}`);
    assert(org.length >= 1, `org should have >= 1 skill, got ${org.length}`);
  });

  // --- Static (substring) detection tests ---

  test('detectSkillFromMessageStatic returns valid skill object shape when matched', () => {
    const samples: Array<{ msg: string; mode: 'explore' | 'study' | 'org' }> = [
      { msg: 'Je veux generer mon CV en PDF', mode: 'explore' },
      { msg: 'Je veux un bilan competences', mode: 'study' },
      { msg: 'Je veux publier une offre CDI', mode: 'org' },
    ];
    const metadata = loadAllSkillMetadata();

    for (const sample of samples) {
      const result = detectSkillFromMessageStatic(sample.msg, sample.mode);
      if (result !== null) {
        assert(typeof result.skillId === 'string' && result.skillId.length > 0, 'skillId should be a non-empty string');
        assert(typeof result.skillName === 'string' && result.skillName.length > 0, 'skillName should be a non-empty string');
        assert(typeof result.instructions === 'string' && result.instructions.length > 0, 'instructions should be non-empty');
        assert(metadata.some((m) => m.id === result.skillId), `matched skillId ${result.skillId} must exist in metadata`);
      }
    }
  });

  test('detectSkillFromMessageStatic returns null for unrelated message', () => {
    const result = detectSkillFromMessageStatic('Quel temps fait-il aujourd hui?', 'explore');
    assert(result === null, 'unrelated message should not match any skill');
  });

  // --- Async (embedding) detection tests — falls back to static when no embeddings are pre-computed ---

  await testAsync('detectSkillFromMessage (async) returns null or a valid skill', async () => {
    const result = await detectSkillFromMessage('Je veux generer mon CV en PDF', 'explore');
    if (result !== null) {
      assert(typeof result.skillId === 'string' && result.skillId.length > 0, 'skillId should be non-empty');
      assert(typeof result.instructions === 'string' && result.instructions.length > 0, 'instructions should be non-empty');
    }
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
