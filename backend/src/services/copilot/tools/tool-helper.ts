/**
 * Tool Helper — provider-neutral tool definition.
 * Zod schemas are converted to JSON Schema for the model tool input schema via
 * Zod v4's built-in `z.toJSONSchema` (the standalone `zod-to-json-schema` package
 * is v3-only and silently collapses v4 schemas to `{type:'object'}`, stripping all
 * parameters from the tool definition).
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ToolDefinition {
  /** Tool definition (name, description, input_schema). */
  definition: {
    name: string;
    description?: string;
    input_schema: Record<string, any>;
  };
  /** Execute the tool with parsed & validated input */
  execute: (input: any) => Promise<any>;
}

export interface AgentConfig {
  name: string;
  mode: 'explore' | 'study' | 'org';
  model: string;
  /** Per-user / dynamic part of the system prompt (situation, profile, context). */
  systemPrompt: string;
  /**
   * Static, user-independent part of the system prompt (persona, rules, tool
   * sequencing, ontology). When present, sse.handler caches it as a SEPARATE
   * prefix block so it is shared across ALL users in the same mode/language,
   * instead of paying a per-user cache write. Built via splitSystemPrompt().
   */
  systemPromptStatic?: string;
  tools: ToolDefinition[];
}

/**
 * Split a full system prompt into a static (shared) prefix and a dynamic
 * (per-user) suffix at the `--- DYNAMIC CONTEXT BELOW ---` marker. No content is
 * reordered or changed — static + dynamic reconstitutes the original prompt, so
 * model behaviour is identical. The only effect is a better prompt-cache layout:
 * the large static prefix becomes a globally shared cache entry.
 */
const DYNAMIC_CONTEXT_MARKER = '--- DYNAMIC CONTEXT BELOW ---';
export function splitSystemPrompt(full: string): { staticPrompt?: string; dynamicPrompt: string } {
  const idx = full.indexOf(DYNAMIC_CONTEXT_MARKER);
  if (idx === -1) return { dynamicPrompt: full };
  const staticPrompt = full.slice(0, idx).trimEnd();
  const dynamicPrompt = full.slice(idx);
  // The static prefix must be large enough to be cacheable (Sonnet min ~1024
  // tokens ≈ a few thousand chars). If it is too small, keep one block.
  if (staticPrompt.length < 2000) return { dynamicPrompt: full };
  return { staticPrompt, dynamicPrompt };
}

// ---------------------------------------------------------------------------
// defineTool — local tool definition helper
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
  // Tool schemas omit `$schema` for broad provider compatibility.
  const { $schema, ...jsonSchema } = z.toJSONSchema(opts.parameters, {
    target: 'draft-7',
    io: 'input',
  }) as Record<string, any>;

  // Tool schemas require type: 'object' at the root.
  if (!jsonSchema.type) {
    jsonSchema.type = 'object';
  }

  const inputSchema = jsonSchema;

  return {
    definition: {
      name: opts.name,
      description: opts.description,
      input_schema: inputSchema,
    },
    execute: async (input: any) => {
      // Unwrap nested {input: {...}} that some providers send
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
