/**
 * Organization Agent — Explorer mode only
 * Uses OpenAI Agents SDK with GPT-4.1
 */

import { Agent, handoff } from '@openai/agents';
import { OrgContext } from '../types';
import { vectorQueryTool } from '../tools/vector-query.tool';
import { createSqlQueryTool } from '../tools/sql-query.tool';
import { generateDocumentTool } from '../tools/generate-document.tool';
import { createFileReaderAgent } from '../tools/file-read.tool';
import { webSearchAgent } from '../tools/web-search.tool';
import { buildOrgExplorerPrompt } from '../prompts/org-explorer.prompt';

export function createOrgAgent(context: OrgContext): Agent {
  // Create SQL tool with authenticated talentId (SECURITY: prevents IDOR)
  const secureSqlTool = createSqlQueryTool(context.talentId, [context.organizationId]);

  return new Agent({
    name: 'Organization Explorer',
    model: 'gpt-4.1',
    instructions: buildOrgExplorerPrompt(context),
    tools: [
      vectorQueryTool,
      secureSqlTool,
      generateDocumentTool,
    ],
    handoffs: [
      handoff(createFileReaderAgent(context.talentId)),
      handoff(webSearchAgent),
    ],
  });
}
