/**
 * Talent Agent — Explorer + Study modes
 * Uses OpenAI Agents SDK with GPT-4.1
 */

import { Agent, handoff } from '@openai/agents';
import { TalentContext } from '../types';
import { vectorQueryTool } from '../tools/vector-query.tool';
import { createSqlQueryTool } from '../tools/sql-query.tool';
import { youtubeSearchTool } from '../tools/youtube-search.tool';
import { generateDocumentTool } from '../tools/generate-document.tool';
import { generateImageTool } from '../tools/generate-image.tool';
import { generateDiagramTool } from '../tools/generate-diagram.tool';
import { createFileReaderAgent } from '../tools/file-read.tool';
import { webSearchAgent } from '../tools/web-search.tool';
import { buildTalentExplorerPrompt } from '../prompts/talent-explorer.prompt';
import { buildTalentStudyPrompt } from '../prompts/talent-study.prompt';

export function createTalentAgent(
  context: TalentContext
): Agent {
  const mode = context.session?.currentMode || 'explore';
  const authorizedOrgIds = context.organizations?.organizations?.map(
    (org) => org.organizationId
  );

  // Create SQL tool with authenticated talentId (SECURITY: prevents IDOR)
  const secureSqlTool = createSqlQueryTool(context.profile.id, authorizedOrgIds);

  // Handoffs (sub-agents for file reading and web search)
  const handoffs = [
    handoff(createFileReaderAgent(context.profile.id)),
    handoff(webSearchAgent),
  ];

  let tools: any[];
  let instructions: string;

  if (mode === 'study') {
    // STUDY MODE: restricted sql_query (profile/skills/documents only), youtube_search, generate_image, generate_diagram + handoffs
    // NO vector_query, NO access to opportunities/communities/spaces
    const studySqlTool = createSqlQueryTool(
      context.profile.id,
      authorizedOrgIds,
      ['my_profile', 'my_skills', 'my_documents'] as const
    );
    tools = [
      studySqlTool,
      youtubeSearchTool,
      generateImageTool,
      generateDiagramTool,
    ];
    instructions = buildTalentStudyPrompt(context);
  } else {
    // EXPLORER MODE (default): vector_query, sql_query, generate_document + handoffs
    tools = [
      vectorQueryTool,
      secureSqlTool,
      generateDocumentTool,
    ];
    instructions = buildTalentExplorerPrompt(context);
  }

  return new Agent({
    name: `Talent Agent (${mode})`,
    model: 'gpt-4.1',
    instructions,
    tools,
    handoffs,
  });
}
