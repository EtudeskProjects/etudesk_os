/**
 * Organization Agent — Explorer mode only
 * Uses OpenAI Agents SDK with GPT-5-mini
 */

import { Agent, webSearchTool } from '@openai/agents';
import { OrgContext } from '../types';
import { vectorQueryTool } from '../tools/vector-query.tool';
import { graphQueryTool } from '../tools/graph-query.tool';
import { createSqlQueryTool } from '../tools/sql-query.tool';
import { buildOrgExplorerPrompt } from '../prompts/org-explorer.prompt';

export function createOrgAgent(context: OrgContext): Agent {
  // Create SQL tool with authenticated talentId (SECURITY: prevents IDOR)
  // User is authorized to access this specific organization
  const secureSqlTool = createSqlQueryTool(context.talentId, [context.organizationId]);

  return new Agent({
    name: 'Organization Explorer',
    model: 'gpt-4o',
    instructions: buildOrgExplorerPrompt(context),
    tools: [
      vectorQueryTool,
      graphQueryTool,
      secureSqlTool,
      webSearchTool(),
    ],
  });
}
