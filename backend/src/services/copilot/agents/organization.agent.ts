/**
 * Organization Agent — Explorer mode only
 * Returns AgentConfig for native Anthropic SDK execution
 */

import { MODEL_AGENT } from '../../ai/models';
import { AgentConfig } from '../tools/tool-helper';
import { OrgContext } from '../types';
import { vectorQueryTool } from '../tools/vector-query.tool';
import { createSqlQueryTool } from '../tools/sql-query.tool';
import { createGenerateDocumentTool } from '../tools/generate-document.tool';
import { webSearchAsTool } from '../tools/web-search.tool';
import { createExecuteActionTool } from '../tools/execute-action.tool';
import { createOrgFileReaderTool } from '../tools/file-read.tool';
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
  'search_opportunities',
  'search_communities',
  'search_spaces',
  'search_organizations',
  'search_talents',
] as const;

export function createOrgAgent(context: OrgContext): AgentConfig {
  // Create SQL tool with authenticated talentId, authorized orgs, and RESTRICTED intents
  // SECURITY: blocks my_profile, my_documents, my_skills, etc. — no access to admin's personal data
  const secureSqlTool = createSqlQueryTool(context.talentId, [context.organizationId], ORG_ALLOWED_INTENTS);

  const orgFileReaderTool = createOrgFileReaderTool(context.organizationId);

  return {
    name: 'Organization Explorer',
    model: MODEL_AGENT,
    systemPrompt: buildOrgExplorerPrompt(context),
    tools: [
      vectorQueryTool,
      secureSqlTool,
      createGenerateDocumentTool(context.talentId, undefined, context.organizationId),
      webSearchAsTool,
      createExecuteActionTool(context.talentId),
      orgFileReaderTool,
    ],
  };
}
