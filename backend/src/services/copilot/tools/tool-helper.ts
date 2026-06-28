/**
 * Tool Helper — Native Anthropic SDK tool definition
 * Replaces @openai/agents tool() with a format compatible with Anthropic messages API.
 * Zod schemas are converted to JSON Schema for Anthropic's input_schema field via
 * Zod v4's built-in `z.toJSONSchema` (the standalone `zod-to-json-schema` package
 * is v3-only and silently collapses v4 schemas to `{type:'object'}`, stripping all
 * parameters from the tool definition).
 */

import { z } from 'zod';
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
  mode: 'explore' | 'study' | 'org';
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
  /** Optional normalizer applied BEFORE Zod parsing — use to remap common LLM param aliases */
  normalize?: (raw: Record<string, any>) => Record<string, any>;
  execute: (input: z.infer<T>) => Promise<any>;
}): ToolDefinition {
  // Convert Zod schema to JSON Schema. `io: 'input'` makes fields with a default
  // optional (the tool caller may omit them); `target: 'draft-7'` is the dialect
  // Anthropic's input_schema expects. Strip `$schema` — Anthropic rejects it.
  const { $schema, ...jsonSchema } = z.toJSONSchema(opts.parameters, {
    target: 'draft-7',
    io: 'input',
  }) as Record<string, any>;

  // Anthropic REQUIRES type: 'object' at the root of input_schema.
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
      let unwrapped = (input && typeof input === 'object' && 'input' in input && Object.keys(input).length === 1)
        ? input.input
        : input;
      // Apply normalizer if provided (remap LLM param aliases before Zod parsing)
      if (opts.normalize && unwrapped && typeof unwrapped === 'object') {
        unwrapped = opts.normalize(unwrapped);
      }
      const parsed = opts.parameters.parse(unwrapped);
      return opts.execute(parsed);
    },
  };
}
