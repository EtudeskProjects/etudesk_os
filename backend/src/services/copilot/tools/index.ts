/**
 * Copilot Tools Index
 * Central export for all tool definitions
 */

// Search tools
export * from './search.tools';
export { searchToolDefinitions } from './search.tools';

// Profile tools
export * from './profile.tools';
export { profileToolDefinitions } from './profile.tools';

// Context tools
export * from './context.tools';
export { contextToolDefinitions } from './context.tools';

// Document tools
export * from './document.tools';
export { documentToolDefinitions } from './document.tools';

// Learning tools
export * from './learning.tools';
export { learningToolDefinitions } from './learning.tools';

// External tools
export * from './external.tools';
export { externalToolDefinitions } from './external.tools';

// Admin tools
export * from './admin.tools';
export { adminToolDefinitions } from './admin.tools';

// Graph tools
export * from './graph.tools';
export { graphToolDefinitions, graphExplorerTools, graphStudyTools } from './graph.tools';

// ═══════════════════════════════════════════════════════════════
// COMBINED TOOL REGISTRY
// ═══════════════════════════════════════════════════════════════

import { searchToolDefinitions } from './search.tools';
import { profileToolDefinitions } from './profile.tools';
import { contextToolDefinitions } from './context.tools';
import { documentToolDefinitions } from './document.tools';
import { learningToolDefinitions } from './learning.tools';
import { externalToolDefinitions } from './external.tools';
import { adminToolDefinitions } from './admin.tools';
import { graphToolDefinitions, graphExplorerTools, graphStudyTools } from './graph.tools';

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: any; // Zod schema
  execute: (params: any, context: { talentId: string }) => Promise<any>;
}

// All available tools
export const ALL_TOOLS: Record<string, ToolDefinition> = {
  ...searchToolDefinitions,
  ...profileToolDefinitions,
  ...contextToolDefinitions,
  ...documentToolDefinitions,
  ...learningToolDefinitions,
  ...externalToolDefinitions,
  ...adminToolDefinitions,
  ...graphToolDefinitions,
};

// Tools by category
export const TOOLS_BY_CATEGORY = {
  search: searchToolDefinitions,
  profile: profileToolDefinitions,
  context: contextToolDefinitions,
  document: documentToolDefinitions,
  learning: learningToolDefinitions,
  external: externalToolDefinitions,
  admin: adminToolDefinitions,
  graph: graphToolDefinitions,
};

// Tools for Explorer mode
export const EXPLORER_TOOLS = {
  ...searchToolDefinitions,
  ...profileToolDefinitions,
  ...contextToolDefinitions,
  ...documentToolDefinitions,
  ...externalToolDefinitions,
  ...adminToolDefinitions,
  ...graphExplorerTools,
};

// Tools for Study mode
export const STUDY_TOOLS = {
  ...profileToolDefinitions,
  ...contextToolDefinitions,
  ...documentToolDefinitions,
  ...learningToolDefinitions,
  ...externalToolDefinitions,
  ...graphStudyTools,
};

// ═══════════════════════════════════════════════════════════════
// TOOL HELPERS
// ═══════════════════════════════════════════════════════════════

export function getTool(name: string): ToolDefinition | undefined {
  return ALL_TOOLS[name];
}

export function getToolNames(): string[] {
  return Object.keys(ALL_TOOLS);
}

export function getToolsByMode(mode: 'explore' | 'study'): Record<string, ToolDefinition> {
  return mode === 'explore' ? EXPLORER_TOOLS : STUDY_TOOLS;
}

export function getToolsForAgent(agentType: string, toolNames: string[]): Record<string, ToolDefinition> {
  const tools: Record<string, ToolDefinition> = {};
  for (const name of toolNames) {
    const tool = ALL_TOOLS[name];
    if (tool) {
      tools[name] = tool;
    }
  }
  return tools;
}

// ═══════════════════════════════════════════════════════════════
// TOOL EXECUTION
// ═══════════════════════════════════════════════════════════════

export async function executeTool(
  toolName: string,
  params: Record<string, unknown>,
  context: { talentId: string }
): Promise<{ success: boolean; result?: any; error?: string }> {
  const tool = ALL_TOOLS[toolName];

  if (!tool) {
    return { success: false, error: `Tool '${toolName}' not found` };
  }

  try {
    // Validate parameters
    const validatedParams = tool.parameters.parse(params);

    // Execute tool
    const result = await tool.execute(validatedParams, context);

    return { success: true, result };
  } catch (error) {
    console.error(`Tool execution error (${toolName}):`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
