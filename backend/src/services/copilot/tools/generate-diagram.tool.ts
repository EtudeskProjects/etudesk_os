/**
 * Generate Diagram Tool — Mermaid code generation (client-side rendering)
 * The LLM generates valid Mermaid code, the mobile app renders it via WebView + mermaid.js
 */

import { defineTool } from './tool-helper';
import { z } from 'zod';
import { logger } from '../../../utils';

const VALID_DIAGRAM_PREFIXES: Record<string, string[]> = {
  flowchart: ['flowchart', 'graph'],
  sequenceDiagram: ['sequenceDiagram'],
  classDiagram: ['classDiagram'],
  mindmap: ['mindmap'],
  timeline: ['timeline'],
  gantt: ['gantt'],
  pie: ['pie'],
  erDiagram: ['erDiagram'],
};

function sanitizeNodeLabel(value: string): string {
  return value
    .replace(/[<>]/g, '')
    .replace(/"/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 48);
}

function buildFallbackMermaidFromDescription(title: string, description: string, diagramType: string): string {
  const cleanTitle = sanitizeNodeLabel(title || 'Diagram');
  const cleanDescription = sanitizeNodeLabel(description || 'Description');
  const parts = cleanDescription
    .split(/[,;:.!?]\s+/)
    .map((p) => sanitizeNodeLabel(p))
    .filter((p) => p.length > 0)
    .slice(0, 4);

  if (diagramType.toLowerCase() === 'mindmap') {
    const branches = parts.length > 0 ? parts : ['Overview'];
    return `mindmap\n  root((${cleanTitle}))\n${branches.map((b) => `    ${b}`).join('\n')}`;
  }

  // Default resilient fallback: flowchart
  const nodes = parts.length > 0 ? parts : [cleanDescription || 'Overview'];
  let code = `flowchart TD\n  A[${cleanTitle}]`;
  nodes.forEach((node, idx) => {
    const id = String.fromCharCode(66 + idx); // B, C, D...
    code += `\n  A --> ${id}[${node}]`;
  });
  return code;
}

/**
 * Sanitize Mermaid code to fix common LLM generation issues
 */
function sanitizeMermaidCode(code: string): string {
  let sanitized = code;
  // Normalize <br/> variants to <br> (Mermaid supports <br> with securityLevel: 'loose')
  sanitized = sanitized.replace(/<br\s*\/?>/gi, '<br>');
  // Convert literal \n (2 chars: backslash + n) to <br> for Mermaid label line breaks
  sanitized = sanitized.replace(/\\n/g, '<br>');
  // Escape parentheses inside square bracket labels [] — they break Mermaid parsing
  sanitized = sanitized.replace(/\[([^\]]*)\]/g, (match, content) => {
    const fixed = content.replace(/\(/g, '&#40;').replace(/\)/g, '&#41;');
    return `[${fixed}]`;
  });
  // Remove any null bytes
  sanitized = sanitized.replace(/\u0000/g, '');
  return sanitized;
}

/**
 * Basic validation of Mermaid code syntax
 */
function validateMermaidCode(code: string, diagramType: string): { valid: boolean; error?: string } {
  const trimmed = code.trim();
  if (!trimmed) {
    return { valid: false, error: 'Le code Mermaid est vide' };
  }

  const prefixes = VALID_DIAGRAM_PREFIXES[diagramType];
  if (prefixes) {
    const firstLine = trimmed.split('\n')[0].trim();
    const hasValidPrefix = prefixes.some((prefix) => firstLine.startsWith(prefix));
    if (!hasValidPrefix) {
      return {
        valid: false,
        error: `Le code Mermaid doit commencer par "${prefixes.join('" ou "')}" pour un diagramme de type ${diagramType}`,
      };
    }
  }

  return { valid: true };
}

export const generateDiagramTool = defineTool({
  name: 'generate_diagram',
  description:
    'Generate a diagram as Mermaid code. The diagram is rendered visually on the client side (mobile app). Use to illustrate architecture, flows, processes, timelines, or data relationships. Supports flowchart, sequence, class, mindmap, timeline, gantt, pie, and ER diagrams.',
  parameters: z.object({
    title: z.string().describe('Title of the diagram, displayed above the rendered visual'),
    diagramType: z
      .string()
      .describe('Mermaid diagram type: flowchart, sequenceDiagram, classDiagram, mindmap, timeline, gantt, pie, erDiagram. Use flowchart for processes, sequenceDiagram for interactions, mindmap for concepts, timeline for history, pie for distributions.'),
    description: z
      .string()
      .optional()
      .describe('Optional textual description used as fallback context if Mermaid code is missing.'),
    mermaidCode: z.string().optional().describe('REQUIRED. Valid Mermaid syntax code — NOT a text description. Must start with the diagram type keyword (e.g., "flowchart TD\\n  A[Start] --> B[End]", "mindmap\\n  root((Topic))\\n    Branch1", "sequenceDiagram\\n  A->>B: msg"). Use French labels. RULES: 1) No <br/> tags — use \\n. 2) No raw parentheses () inside [] labels. 3) Short labels (max 6 words).'),
  }),
  normalize: (raw) => {
    const diagramType = raw.diagramType || raw.type || raw.diagram_type;
    const description = raw.description || raw.prompt || raw.summary;
    // Resolve mermaidCode from multiple possible aliases
    let mermaidCode = raw.mermaidCode || raw.code || raw.content || raw.mermaid_code || raw.mermaid;
    // If still missing, check if 'description' contains actual Mermaid code (starts with a diagram keyword)
    if (!mermaidCode && description) {
      const descTrimmed = description.trim();
      const allPrefixes = Object.values(VALID_DIAGRAM_PREFIXES).flat();
      const looksLikeMermaid = allPrefixes.some((p) => descTrimmed.startsWith(p));
      if (looksLikeMermaid) {
        mermaidCode = description;
      }
    }
    return { ...raw, diagramType, description, mermaidCode };
  },
  execute: async ({ title, description, diagramType: rawDiagramType, mermaidCode }) => {
    try {
      // Normalize diagramType case (Claude native SDK may send "Flowchart" or "FLOWCHART")
      const diagramTypeLower = rawDiagramType.toLowerCase();
      const diagramType = Object.keys(VALID_DIAGRAM_PREFIXES).find(
        (k) => k.toLowerCase() === diagramTypeLower
      ) || rawDiagramType;

      // If mermaidCode is missing, return an instructive error so the LLM retries correctly
      if (!mermaidCode) {
        logger.warn('[generate_diagram] Missing mermaidCode, generating fallback from title/description');
        const fallbackCode = buildFallbackMermaidFromDescription(title, description || title, diagramType);
        return {
          success: true,
          title,
          diagramType: diagramType.toLowerCase() === 'mindmap' ? 'mindmap' : 'flowchart',
          mermaidCode: sanitizeMermaidCode(fallbackCode),
          renderHint: 'client-side',
          autoGenerated: true,
          warning: 'Missing mermaidCode. A fallback diagram was auto-generated from the provided text.',
        };
      }

      const validation = validateMermaidCode(mermaidCode, diagramType);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
        };
      }

      logger.info(`[generate_diagram] Generated ${diagramType} diagram: "${title}"`);

      const cleanCode = sanitizeMermaidCode(mermaidCode.trim());

      return {
        success: true,
        title,
        diagramType,
        mermaidCode: cleanCode,
        renderHint: 'client-side',
        renderConfig: { securityLevel: 'strict' },
      };
    } catch (error: any) {
      logger.error(`[generate_diagram] Error: ${error.message}`);
      return {
        success: false,
        error: `Erreur lors de la génération du diagramme: ${error.message}`,
      };
    }
  },
});
