/**
 * Base Agent
 * Common infrastructure for all copilot agents
 */

import OpenAI from 'openai';
import { getAgentModel, getAgentParams, getAgentTools, ModelType, RATE_LIMITS } from '../config';
import { getAgentSystemPrompt, AgentType } from '../ontology/behaviors';
import { TalentContext } from '../ontology/context';
import { executeTool, ToolDefinition, ALL_TOOLS } from '../tools';

// ═══════════════════════════════════════════════════════════════
// OPENAI CLIENT
// ═══════════════════════════════════════════════════════════════

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface AgentMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: string;
  }>;
  toolCallId?: string;
}

export interface AgentInput {
  message: string;
  history: AgentMessage[];
  context: {
    talentId: string;
    talentContext?: TalentContext;
  };
}

export interface AgentOutput {
  content: string;
  outputType?: string;
  outputData?: unknown;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }>;
  toolResults?: Array<{
    toolCallId: string;
    result: unknown;
  }>;
  handoff?: {
    targetAgent: AgentType;
    reason: string;
  };
}

// ═══════════════════════════════════════════════════════════════
// TOOL SCHEMA CONVERTER
// ═══════════════════════════════════════════════════════════════

function zodToJsonSchema(zodSchema: any): Record<string, unknown> {
  // Simple conversion for common Zod types
  // In production, use zod-to-json-schema library
  if (!zodSchema || !zodSchema._def) {
    return { type: 'object', properties: {} };
  }

  const def = zodSchema._def;
  const typeName = def.typeName;

  switch (typeName) {
    case 'ZodObject': {
      const properties: Record<string, unknown> = {};
      const required: string[] = [];

      for (const [key, value] of Object.entries(def.shape() || {})) {
        const propSchema = value as any;
        properties[key] = zodToJsonSchema(propSchema);

        // Check if required
        if (propSchema._def?.typeName !== 'ZodOptional') {
          // Skip adding to required if it has a default
          if (!propSchema._def?.defaultValue) {
            required.push(key);
          }
        }
      }

      return {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined,
      };
    }
    case 'ZodString':
      return { type: 'string', description: def.description };
    case 'ZodNumber':
      return { type: 'number', description: def.description };
    case 'ZodBoolean':
      return { type: 'boolean', description: def.description };
    case 'ZodArray':
      return { type: 'array', items: zodToJsonSchema(def.type), description: def.description };
    case 'ZodEnum':
      return { type: 'string', enum: def.values, description: def.description };
    case 'ZodOptional':
      return zodToJsonSchema(def.innerType);
    case 'ZodDefault':
      const inner = zodToJsonSchema(def.innerType);
      return { ...inner, default: def.defaultValue() };
    default:
      return { type: 'string' };
  }
}

function buildToolDefinition(tool: ToolDefinition): OpenAI.Chat.Completions.ChatCompletionTool {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: zodToJsonSchema(tool.parameters),
    },
  };
}

// ═══════════════════════════════════════════════════════════════
// BASE AGENT RUNNER
// ═══════════════════════════════════════════════════════════════

export async function runAgent(
  agentType: AgentType,
  input: AgentInput,
  customTools?: string[]
): Promise<AgentOutput> {
  const model = getAgentModel(agentType);
  const params = getAgentParams(agentType);
  const toolNames = customTools || getAgentTools(agentType);

  // Build system prompt
  const systemPrompt = getAgentSystemPrompt(agentType, input.context.talentContext);

  // Build tool definitions
  const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [];
  for (const toolName of toolNames) {
    const tool = ALL_TOOLS[toolName];
    if (tool) {
      tools.push(buildToolDefinition(tool));
    }
  }

  // Add handoff tools if this is a hub agent
  if (agentType === 'explorer_hub' || agentType === 'study_hub' || agentType === 'triage') {
    const handoffTargets = getHandoffTargets(agentType);
    for (const target of handoffTargets) {
      tools.push({
        type: 'function',
        function: {
          name: `handoff_to_${target}`,
          description: `Transfère la conversation à l'agent ${target} spécialisé`,
          parameters: {
            type: 'object',
            properties: {
              reason: {
                type: 'string',
                description: 'Raison du transfert',
              },
            },
            required: ['reason'],
          },
        },
      });
    }
  }

  // Build messages array
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
  ];

  // Add history
  for (const msg of input.history.slice(-RATE_LIMITS.maxHistoryMessages)) {
    if (msg.role === 'user') {
      messages.push({ role: 'user', content: msg.content });
    } else if (msg.role === 'assistant') {
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        messages.push({
          role: 'assistant',
          content: msg.content || null,
          tool_calls: msg.toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function' as const,
            function: { name: tc.name, arguments: tc.arguments },
          })),
        });
      } else {
        messages.push({ role: 'assistant', content: msg.content });
      }
    } else if (msg.role === 'tool' && msg.toolCallId) {
      messages.push({
        role: 'tool',
        content: msg.content,
        tool_call_id: msg.toolCallId,
      });
    }
  }

  // Add current message
  messages.push({ role: 'user', content: input.message });

  // Initial completion
  let response = await openai.chat.completions.create({
    model,
    messages,
    tools: tools.length > 0 ? tools : undefined,
    tool_choice: tools.length > 0 ? 'auto' : undefined,
    temperature: params.temperature,
    max_tokens: params.maxTokens,
  });

  let assistantMessage = response.choices[0].message;
  const allToolCalls: AgentOutput['toolCalls'] = [];
  const allToolResults: AgentOutput['toolResults'] = [];
  let finalOutputType: string | undefined;
  let finalOutputData: unknown;
  let handoff: AgentOutput['handoff'];

  // Process tool calls
  let iterations = 0;
  const maxIterations = RATE_LIMITS.maxToolCalls;

  while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0 && iterations < maxIterations) {
    iterations++;

    // Add assistant message with tool calls
    messages.push({
      role: 'assistant',
      content: assistantMessage.content || null,
      tool_calls: assistantMessage.tool_calls,
    });

    // Execute each tool call
    for (const toolCall of assistantMessage.tool_calls) {
      const toolName = toolCall.function.name;
      const args = JSON.parse(toolCall.function.arguments || '{}');

      // Check for handoff
      if (toolName.startsWith('handoff_to_')) {
        const targetAgent = toolName.replace('handoff_to_', '') as AgentType;
        handoff = {
          targetAgent,
          reason: args.reason || 'Transfert de conversation',
        };

        // Add tool result for handoff
        messages.push({
          role: 'tool',
          content: JSON.stringify({ success: true, handoff: targetAgent }),
          tool_call_id: toolCall.id,
        });

        continue;
      }

      // Execute regular tool
      try {
        const result = await executeTool(toolName, args, {
          talentId: input.context.talentId,
        });

        allToolCalls.push({
          id: toolCall.id,
          name: toolName,
          arguments: args,
        });

        allToolResults.push({
          toolCallId: toolCall.id,
          result: result.result,
        });

        // Extract output type from result
        if (result.result && typeof result.result === 'object' && 'type' in result.result) {
          finalOutputType = (result.result as any).type;
          finalOutputData = result.result;
        }

        messages.push({
          role: 'tool',
          content: JSON.stringify(result.result),
          tool_call_id: toolCall.id,
        });
      } catch (error) {
        console.error(`Error executing tool ${toolName}:`, error);
        messages.push({
          role: 'tool',
          content: JSON.stringify({
            error: `Erreur: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }),
          tool_call_id: toolCall.id,
        });
      }
    }

    // If handoff detected, don't continue with more tool calls
    if (handoff) {
      break;
    }

    // Get next response
    response = await openai.chat.completions.create({
      model,
      messages,
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: tools.length > 0 ? 'auto' : undefined,
      temperature: params.temperature,
      max_tokens: params.maxTokens,
    });

    assistantMessage = response.choices[0].message;
  }

  return {
    content: assistantMessage.content || '',
    outputType: finalOutputType,
    outputData: finalOutputData,
    toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
    toolResults: allToolResults.length > 0 ? allToolResults : undefined,
    handoff,
  };
}

// ═══════════════════════════════════════════════════════════════
// HANDOFF CONFIGURATION
// ═══════════════════════════════════════════════════════════════

function getHandoffTargets(agentType: AgentType): AgentType[] {
  switch (agentType) {
    case 'triage':
      return ['explorer_hub', 'study_hub'];
    case 'explorer_hub':
      return ['search', 'web_search', 'document_generator', 'document_reader', 'admin', 'invitation', 'application', 'activity', 'org_manager'];
    case 'study_hub':
      return ['learn', 'quiz', 'flashcard', 'code'];
    default:
      return [];
  }
}

export function canHandoff(fromAgent: AgentType, toAgent: AgentType): boolean {
  const targets = getHandoffTargets(fromAgent);
  return targets.includes(toAgent);
}
