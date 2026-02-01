/**
 * Organization Agent — Explorer mode only
 * Uses OpenAI Agents SDK with GPT-5-mini
 */

import { Agent, webSearchTool } from '@openai/agents';
import { OrgContext } from '../types';
import { vectorQueryTool } from '../tools/vector-query.tool';
import { graphQueryTool } from '../tools/graph-query.tool';
import { sqlQueryTool } from '../tools/sql-query.tool';
import { buildOrgExplorerPrompt } from '../prompts/org-explorer.prompt';

export function createOrgAgent(context: OrgContext): Agent {
  return new Agent({
    name: 'Organization Explorer',
    model: 'gpt-5-mini',
    instructions: buildOrgExplorerPrompt(context),
    tools: [
      vectorQueryTool,
      graphQueryTool,
      sqlQueryTool,
      webSearchTool(),
    ],
    modelSettings: {
      temperature: 0.4,
    },
  });
}
