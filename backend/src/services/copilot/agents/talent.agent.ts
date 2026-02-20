/**
 * Talent Agent — Explorer + Study modes
 * Returns AgentConfig for native Anthropic SDK execution
 */

import { MODEL_AGENT } from '../../ai/models';
import { AgentConfig } from '../tools/tool-helper';
import type { ToolDefinition } from '../tools/tool-helper';
import { TalentContext } from '../types';
import { vectorQueryTool } from '../tools/vector-query.tool';
import { createSqlQueryTool } from '../tools/sql-query.tool';
import { youtubeSearchTool } from '../tools/youtube-search.tool';
import { analyzeYoutubeVideoTool } from '../tools/youtube-analyze.tool';
import { createGenerateDocumentTool } from '../tools/generate-document.tool';
import { generateImageTool } from '../tools/generate-image.tool';
import { generateDiagramTool } from '../tools/generate-diagram.tool';
import { createFileReaderTool } from '../tools/file-read.tool';
import { webSearchAsTool } from '../tools/web-search.tool';
import { createManageSkillsTool } from '../tools/manage-skills.tool';
import { createExecuteActionTool } from '../tools/execute-action.tool';
import { buildTalentExplorerPrompt } from '../prompts/talent-explorer.prompt';
import { buildTalentStudyPrompt } from '../prompts/talent-study.prompt';

export function createTalentAgent(
  context: TalentContext
): AgentConfig {
  const mode = context.session?.currentMode || 'explore';
  const authorizedOrgIds = context.organizations?.organizations?.map(
    (org) => org.organizationId
  );

  // Create SQL tool with authenticated talentId (SECURITY: prevents IDOR)
  const secureSqlTool = createSqlQueryTool(context.profile.id, authorizedOrgIds);

  // Direct file reader tool (no sub-agent)
  const fileReaderTool = createFileReaderTool(context.profile.id);

  let tools: ToolDefinition[];
  let instructions: string;

  if (mode === 'study') {
    // STUDY MODE: restricted sql_query (profile/skills/documents only), youtube_search, generate_image, generate_diagram + manage_skills
    const studySqlTool = createSqlQueryTool(
      context.profile.id,
      authorizedOrgIds,
      ['my_profile', 'my_skills', 'my_documents', 'my_triggers', 'my_community_feed', 'my_community_members'] as const
    );
    tools = [
      studySqlTool,
      youtubeSearchTool,
      analyzeYoutubeVideoTool,
      generateImageTool,
      generateDiagramTool,
      fileReaderTool,
      webSearchAsTool,
      createManageSkillsTool(context.profile.id),
      createExecuteActionTool(context.profile.id),
    ];
    instructions = buildTalentStudyPrompt(context);
  } else {
    // EXPLORER MODE (default): vector_query, sql_query, generate_document + execute_action
    tools = [
      vectorQueryTool,
      secureSqlTool,
      createGenerateDocumentTool(context.profile.id, context.profile.avatarUrl),
      fileReaderTool,
      webSearchAsTool,
      createExecuteActionTool(context.profile.id),
    ];
    instructions = buildTalentExplorerPrompt(context);
  }

  return {
    name: `Talent Agent (${mode})`,
    model: MODEL_AGENT,
    systemPrompt: instructions,
    tools,
  };
}
