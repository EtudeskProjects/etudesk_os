import assert from 'node:assert/strict';
import { selectToolsForMessage } from '../agentic-policy';
import { sanitizeOutput } from '../guardrails/output.guardrail';
import { buildTalentExplorerPrompt } from '../prompts/talent-explorer.prompt';
import type { ToolDefinition } from '../tools/tool-helper';
import type { TalentContext } from '../types';

const tools: ToolDefinition[] = [
  { definition: { name: 'smart_search', input_schema: {} }, execute: async () => ({}) },
  { definition: { name: 'sql_query', input_schema: {} }, execute: async () => ({}) },
];

const baseContext: TalentContext = {
  talentId: 'talent-test',
  talentName: 'Test User',
  language: 'fr',
  useCompactExplorerPrompt: true,
  contextLoadedAt: new Date().toISOString(),
  contextVersion: 'test',
  profile: {
    id: 'talent-test',
    firstName: 'Test',
    email: 'test@example.com',
    skills: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
};

const guidance = selectToolsForMessage('explore', 'Explique-moi comment préparer un entretien', tools);
assert.equal(guidance.reason, 'explore_guidance');
assert.equal(guidance.tools.length, 0);

const discovery = selectToolsForMessage('explore', 'Trouve-moi des offres data', tools);
assert.equal(discovery.reason, 'explore_discovery');
assert.ok(discovery.tools.length > 0);

const compactPrompt = buildTalentExplorerPrompt(baseContext);
assert.ok(compactPrompt.length < 10_000, `compact explorer prompt too large: ${compactPrompt.length}`);
assert.ok(!compactPrompt.includes('<ontology>'));

const malformed = 'Voici le résultat.\n\n```quiz\n{"topic":"IA",}\n```\n\nTexte conservé.';
assert.equal(sanitizeOutput(malformed, 'study').includes('```quiz'), false);
assert.ok(sanitizeOutput(malformed, 'study').includes('Texte conservé.'));

const valid = '```quiz\n{"topic":"IA","question":"?","options":["a"],"correctAnswer":0}\n```';
assert.equal(sanitizeOutput(valid, 'study'), valid);

console.log('Copilot runtime contracts: OK');
