/**
 * Organization Agent — Explorer mode only
 * Returns AgentConfig for native Anthropic SDK execution
 */

import { MODEL_AGENT } from '../../ai/models';
import { AgentConfig } from '../tools/tool-helper';
import { OrgContext } from '../types';
import { smartSearchTool } from '../tools/smart-search.tool';
import { createSqlQueryTool } from '../tools/sql-query.tool';
import { createGenerateDocumentTool } from '../tools/generate-document.tool';
import { webSearchAsTool } from '../tools/web-search.tool';
import { createExecuteActionTool } from '../tools/execute-action.tool';
import { createOrgFileReaderTool } from '../tools/file-read.tool';
import { createFindCompetencyTool } from '../tools/find-competency.tool';
import { createCompetencyGraphTool } from '../tools/competency-graph.tool';
import { buildOrgExplorerPrompt } from '../prompts/org-explorer.prompt';

// Org agent only has access to org_* and search_* intents — NO personal talent data
const ORG_ALLOWED_INTENTS = [
  'org_members',
  'org_applications',
  'org_stats',
  'org_opportunities',
  'org_communities',
  'org_spaces',
  'org_invitations',
  'org_triggers',
  'org_documents',
  'org_talents',
  'org_talent_profile',
  'org_community_feed',
  'org_community_members',
  'org_skills_analytics',
  'org_application_funnel',
  'org_talent_cohorts',
  'org_geo_distribution',
  'org_community_engagement',
  'org_opportunity_performance',
  'opportunity_skills',
] as const;

export function createOrgAgent(context: OrgContext): AgentConfig {
  // Create SQL tool with authenticated talentId, authorized orgs, and RESTRICTED intents
  // SECURITY: blocks my_profile, my_documents, my_skills, etc. — no access to admin's personal data
  const secureSqlTool = createSqlQueryTool(context.talentId, [context.organizationId], ORG_ALLOWED_INTENTS, context.language);

  const orgFileReaderTool = createOrgFileReaderTool(context.organizationId);

  return {
    name: 'Organization Explorer',
    mode: 'org' as const,
    model: MODEL_AGENT,
    systemPrompt: buildOrgExplorerPrompt(context),
    tools: [
      smartSearchTool,
      secureSqlTool,
      createGenerateDocumentTool(context.talentId, undefined, context.organizationId, context.language),
      webSearchAsTool,
      createFindCompetencyTool(),
      createCompetencyGraphTool(context.talentId),
      createExecuteActionTool(context.talentId, context.language),
      orgFileReaderTool,
    ],
  };
}
