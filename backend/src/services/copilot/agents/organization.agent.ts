/**
 * Organization Agent — Explorer mode only
 * Uses OpenAI Agents SDK with GPT-5
 */

import { Agent } from '@openai/agents';
import { MODEL_T1 } from '../../ai/models';
import { OrgContext } from '../types';
import { vectorQueryTool } from '../tools/vector-query.tool';
import { createSqlQueryTool } from '../tools/sql-query.tool';
import { createGenerateDocumentTool } from '../tools/generate-document.tool';
import { webSearchAsTool } from '../tools/web-search.tool';
import { createExecuteActionTool } from '../tools/execute-action.tool';
import { inputSafetyGuardrail } from '../guardrails/input.guardrail';
import { outputFormatGuardrail } from '../guardrails/output.guardrail';
import { buildOrgExplorerPrompt } from '../prompts/org-explorer.prompt';

// Org agent only has access to org_* and search_* intents — NO personal talent data
const ORG_ALLOWED_INTENTS = [
  'org_members',
  'org_applications',
  'org_stats',
  'org_opportunities',
  'org_communities',
  'org_spaces',
  'org_revenue',
  'org_invitations',
  'search_opportunities',
  'search_communities',
  'search_spaces',
  'search_organizations',
  'search_talents',
] as const;

export function createOrgAgent(context: OrgContext): Agent {
  // Create SQL tool with authenticated talentId, authorized orgs, and RESTRICTED intents
  // SECURITY: blocks my_profile, my_documents, my_skills, etc. — no access to admin's personal data
  const secureSqlTool = createSqlQueryTool(context.talentId, [context.organizationId], ORG_ALLOWED_INTENTS);

  return new Agent({
    name: 'Organization Explorer',
    model: MODEL_T1,
    instructions: buildOrgExplorerPrompt(context),
    tools: [
      vectorQueryTool,
      secureSqlTool,
      createGenerateDocumentTool(context.talentId),
      webSearchAsTool,
      createExecuteActionTool(context.talentId),
    ],
    inputGuardrails: [inputSafetyGuardrail],
    outputGuardrails: [outputFormatGuardrail],
  });
}
