/**
 * Talent Agent — Explorer + Study modes
 * Uses OpenAI Agents SDK with GPT-5-mini
 */

import { Agent, webSearchTool } from '@openai/agents';
import { TalentContext } from '../types';
import { vectorQueryTool } from '../tools/vector-query.tool';
import { graphQueryTool } from '../tools/graph-query.tool';
import { createSqlQueryTool } from '../tools/sql-query.tool';
import { youtubeSearchTool } from '../tools/youtube-search.tool';
import { buildTalentExplorerPrompt } from '../prompts/talent-explorer.prompt';
import { buildTalentStudyPrompt } from '../prompts/talent-study.prompt';

export function createTalentAgent(
  mode: 'explorer' | 'study',
  context: TalentContext
): Agent {
  // Extract authorized organization IDs from context
  const authorizedOrgIds = context.organizations?.organizations?.map(
    (org) => org.organizationId
  );

  // Create SQL tool with authenticated talentId (SECURITY: prevents IDOR)
  const secureSqlTool = createSqlQueryTool(context.talentId, authorizedOrgIds);

  const sharedTools = [
    vectorQueryTool,
    graphQueryTool,
    secureSqlTool,
    webSearchTool(),
  ];

  const studyTools = [
    ...sharedTools,
    youtubeSearchTool,
  ];

  return new Agent({
    name: mode === 'explorer' ? 'Talent Explorer' : 'Talent Study',
    model: 'gpt-5-mini',
    instructions:
      mode === 'explorer'
        ? buildTalentExplorerPrompt(context)
        : buildTalentStudyPrompt(context),
    tools: mode === 'explorer' ? sharedTools : studyTools,
  });
}
