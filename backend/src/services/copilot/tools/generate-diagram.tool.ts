/**
 * Generate Diagram Tool — Mermaid code generation (client-side rendering)
 * The LLM generates valid Mermaid code, the mobile app renders it via WebView + mermaid.js
 */

import { tool } from '@openai/agents';
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

export const generateDiagramTool = tool({
  name: 'generate_diagram',
  description:
    'Generate a diagram as Mermaid code. The diagram is rendered visually on the client side (mobile app). Use to illustrate architecture, flows, processes, timelines, or data relationships. Supports flowchart, sequence, class, mindmap, timeline, gantt, pie, and ER diagrams.',
  parameters: z.object({
    title: z.string().describe('Title of the diagram, displayed above the rendered visual'),
    diagramType: z
      .enum([
        'flowchart',
        'sequenceDiagram',
        'classDiagram',
        'mindmap',
        'timeline',
        'gantt',
        'pie',
        'erDiagram',
      ])
      .describe('Mermaid diagram type. Use flowchart for processes, sequenceDiagram for interactions, mindmap for concepts, timeline for history, pie for distributions.'),
    mermaidCode: z.string().describe('Valid Mermaid code. Must start with the correct diagram type keyword (e.g., "flowchart TD", "sequenceDiagram", "mindmap"). Use French labels for user-facing content.'),
  }),
  execute: async ({ title, diagramType, mermaidCode }) => {
    try {
      const validation = validateMermaidCode(mermaidCode, diagramType);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
        };
      }

      logger.info(`[generate_diagram] Generated ${diagramType} diagram: "${title}"`);

      return {
        success: true,
        title,
        diagramType,
        mermaidCode: mermaidCode.trim(),
        renderHint: 'client-side',
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
