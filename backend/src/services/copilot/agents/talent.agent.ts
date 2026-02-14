/**
 * Talent Agent — Explorer + Study modes
 * Uses OpenAI Agents SDK with GPT-5
 */

import { Agent } from '@openai/agents';
import { MODEL_AGENT } from '../../ai/models';
import { TalentContext } from '../types';
import { vectorQueryTool } from '../tools/vector-query.tool';
import { createSqlQueryTool } from '../tools/sql-query.tool';
import { youtubeSearchTool } from '../tools/youtube-search.tool';
import { createGenerateDocumentTool } from '../tools/generate-document.tool';
import { generateImageTool } from '../tools/generate-image.tool';
import { generateDiagramTool } from '../tools/generate-diagram.tool';
import { createFileReaderTool } from '../tools/file-read.tool';
import { webSearchAsTool } from '../tools/web-search.tool';
import { createManageSkillsTool } from '../tools/manage-skills.tool';
import { createExecuteActionTool } from '../tools/execute-action.tool';
import { inputSafetyGuardrail } from '../guardrails/input.guardrail';
import { outputFormatGuardrail } from '../guardrails/output.guardrail';
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

  // Sub-agent tools (asTool pattern — main agent keeps control and synthesizes results)
  const fileReaderTool = createFileReaderTool(context.profile.id);

  let tools: any[];
  let instructions: string;

  if (mode === 'study') {
    // STUDY MODE: restricted sql_query (profile/skills/documents only), youtube_search, generate_image, generate_diagram + sub-agent tools + manage_skills
    // NO vector_query, NO access to opportunities/communities/spaces
    const studySqlTool = createSqlQueryTool(
      context.profile.id,
      authorizedOrgIds,
      ['my_profile', 'my_skills', 'my_documents', 'my_community_feed', 'my_community_members'] as const
    );
    tools = [
      studySqlTool,
      youtubeSearchTool,
      generateImageTool,
      generateDiagramTool,
      fileReaderTool,
      webSearchAsTool,
      createManageSkillsTool(context.profile.id),
    ];
    instructions = buildTalentStudyPrompt(context);
  } else {
    // EXPLORER MODE (default): vector_query, sql_query, generate_document + sub-agent tools + execute_action
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

  return new Agent({
    name: `Talent Agent (${mode})`,
    model: MODEL_AGENT,
    instructions,
    tools,
    inputGuardrails: [inputSafetyGuardrail],
    outputGuardrails: [outputFormatGuardrail],
  });
}
