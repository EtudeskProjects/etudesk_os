/**
 * Talent Agent — Explorer + Study modes
 * Returns AgentConfig for provider-neutral tool execution
 */

import { MODEL_AGENT } from '../../ai/models';
import { AgentConfig, splitSystemPrompt } from '../tools/tool-helper';
import type { ToolDefinition } from '../tools/tool-helper';
import { TalentContext } from '../types';
import { smartSearchTool } from '../tools/smart-search.tool';
import { createSqlQueryTool } from '../tools/sql-query.tool';
import { youtubeSearchTool } from '../tools/youtube-search.tool';
import { createGenerateDocumentTool } from '../tools/generate-document.tool';
import { createGenerateImageTool } from '../tools/generate-image.tool';
import { generateDiagramTool } from '../tools/generate-diagram.tool';
import { createFileReaderTool } from '../tools/file-read.tool';
import { webSearchAsTool } from '../tools/web-search.tool';
import { createManageSkillsTool } from '../tools/manage-skills.tool';
import { createFindCompetencyTool } from '../tools/find-competency.tool';
import { createCompetencyGraphTool } from '../tools/competency-graph.tool';
import { createLearningPathTool } from '../tools/learning-path.tool';
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
  const secureSqlTool = createSqlQueryTool(context.profile.id, authorizedOrgIds, undefined, context.language);

  // Direct file reader tool (no sub-agent)
  const fileReaderTool = createFileReaderTool(context.profile.id);

  let tools: ToolDefinition[];
  let instructions: string;

  if (mode === 'study') {
    // STUDY MODE: restricted sql_query — my_skills and my_documents are already in the system prompt context
    // (rule 7: skills in context, rule 8: document IDs in context), so they are excluded from the whitelist
    const studySqlTool = createSqlQueryTool(
      context.profile.id,
      authorizedOrgIds,
      ['my_profile', 'my_triggers', 'my_community_feed', 'my_community_members'] as const,
      context.language
    );
    tools = [
      studySqlTool,
      youtubeSearchTool,
      createGenerateImageTool(context.profile.id),
      generateDiagramTool,
      fileReaderTool,
      webSearchAsTool,
      createFindCompetencyTool(),
      createCompetencyGraphTool(context.profile.id),
      createLearningPathTool(context.profile.id),
      createManageSkillsTool(context.profile.id, context.language),
      createExecuteActionTool(context.profile.id, context.language),
    ];
    instructions = buildTalentStudyPrompt(context);
  } else {
    // EXPLORER MODE (default): smart_search, sql_query, generate_document, find_competency, execute_action
    tools = [
      smartSearchTool,
      secureSqlTool,
      createGenerateDocumentTool(context.profile.id, context.profile.avatarUrl, undefined, context.language),
      fileReaderTool,
      webSearchAsTool,
      createFindCompetencyTool(), // validate/resolve catalog skills for skill_match (Actuel vs Cible)
      createCompetencyGraphTool(context.profile.id), // graph-backed roadmaps / gap explanations
      createLearningPathTool(context.profile.id), // ordered gap-to-role path ("devenir X")
      createExecuteActionTool(context.profile.id, context.language),
    ];
    instructions = buildTalentExplorerPrompt(context);
  }

  const { staticPrompt, dynamicPrompt } = splitSystemPrompt(instructions);
  return {
    name: `Talent Agent (${mode})`,
    mode: mode as 'explore' | 'study',
    model: MODEL_AGENT,
    language: context.language,
    systemPrompt: dynamicPrompt,
    systemPromptStatic: staticPrompt,
    tools,
  };
}
