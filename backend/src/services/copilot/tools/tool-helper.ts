/**
 * Tool Helper — Native Anthropic SDK tool definition
 * Replaces @openai/agents tool() with a format compatible with Anthropic messages API.
 * Zod schemas are converted to JSON Schema for Anthropic's input_schema field.
 */

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type Anthropic from '@anthropic-ai/sdk';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ToolDefinition {
  /** Anthropic tool definition (name, description, input_schema) */
  definition: Anthropic.Tool;
  /** Execute the tool with parsed & validated input */
  execute: (input: any) => Promise<any>;
}

export interface AgentConfig {
  name: string;
  model: string;
  systemPrompt: string;
  tools: ToolDefinition[];
}

// ---------------------------------------------------------------------------
// defineTool — drop-in replacement for @openai/agents tool()
// ---------------------------------------------------------------------------

export function defineTool<T extends z.ZodType>(opts: {
  name: string;
  description: string;
  parameters: T;
  execute: (input: z.infer<T>) => Promise<any>;
}): ToolDefinition {
  // Convert Zod schema to JSON Schema (OpenAPI 3 target strips $schema key)
  // Cast needed: zod-to-json-schema may expect Zod v3 types while we use Zod v4
  const jsonSchema = zodToJsonSchema(opts.parameters as any, {
    target: 'openApi3',
    $refStrategy: 'none',
  }) as Record<string, any>;

  // Anthropic REQUIRES type: 'object' at root of input_schema
  // zodToJsonSchema may omit it depending on Zod version / target
  if (!jsonSchema.type) {
    jsonSchema.type = 'object';
  }

  const inputSchema = jsonSchema as Anthropic.Tool['input_schema'];

  return {
    definition: {
      name: opts.name,
      description: opts.description,
      input_schema: inputSchema,
    },
    execute: async (input: any) => {
      // Unwrap nested {input: {...}} that Claude sometimes sends
      const unwrapped = (input && typeof input === 'object' && 'input' in input && Object.keys(input).length === 1)
        ? input.input
        : input;
      const parsed = opts.parameters.parse(unwrapped);
      return opts.execute(parsed);
    },
  };
}
