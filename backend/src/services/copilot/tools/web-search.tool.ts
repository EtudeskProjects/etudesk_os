/**
 * Web Search Tool — OpenAI webSearchTool() wrapped for Anthropic agents
 * Uses OpenAI Agents SDK webSearchTool() via a sub-agent internally.
 * Always runs on OpenAI Responses API (webSearchTool is a HostedTool).
 * Exposed as a defineTool() for the native Anthropic agent loop.
 */

import { Agent, webSearchTool } from '@openai/agents';
import { z } from 'zod';
import { defineTool } from './tool-helper';
import { openaiResponsesProvider } from '../../ai/provider';
import { Runner } from '@openai/agents';
import { logger } from '../../../utils';

const SEARCH_INSTRUCTIONS = `# Role and Objective

You are a web search specialist for the Etudesk platform. Use the web_search tool to find current, reliable information and return structured results.

# Context

Etudesk is a talent development, employment, and training platform serving French-speaking Africa. Users are:
- **Talents**: job seekers, students, professionals looking for opportunities
- **Organizations**: companies, universities, NGOs posting opportunities

Common search topics: job offers, training programs, skills development, market trends, company profiles, salary benchmarks, tech ecosystem news.

# Instructions

- Search in both French AND English to maximize coverage.
- Return results in the same language as the user's query. If unclear, default to English.
- Prioritize reliable, recent sources: official websites, news articles, industry reports, government data.
- For salary and employment data: prioritize French-speaking African market data (Côte d'Ivoire, Senegal, Cameroon, etc.).
- CRITICAL: For any salary, employment, or market data: French-speaking African data takes absolute priority. If African data is unavailable, clearly state that the data is from another market and may not apply locally.
- For training resources: include online courses accessible from Africa (MOOCs, free certifications).
- Structure results clearly with:
  - Source name and URL
  - Publication date (so the user knows if it is recent)
  - Key findings summarized in 2-3 sentences
- If no relevant results are found, say so clearly instead of making up information.

# Output Format

Return results as a structured list:
1. **[Source Title](URL)** — date
   Summary of key information.

Always cite your sources.`;

/**
 * WebSearchAgent — Always on OpenAI Responses API.
 * Uses gpt-4.1-mini (hardcode) because this sub-agent
 * always runs on OpenAI, regardless of the global provider.
 */
const webSearchAgent = new Agent({
  name: 'WebSearchAgent',
  model: 'gpt-4.1-mini',
  instructions: SEARCH_INSTRUCTIONS,
  tools: [webSearchTool()],
});

/**
 * Execute a web search query via the OpenAI sub-agent.
 * Returns the text result.
 */
async function executeWebSearch(query: string): Promise<string> {
  const runner = new Runner({ modelProvider: openaiResponsesProvider });
  const result = await runner.run(webSearchAgent, query, { maxTurns: 2 });
  return result.finalOutput?.trim() || 'No relevant results found.';
}

function buildNoResultsResponse(query: string) {
  return {
    success: true,
    results: [],
    query,
    content: `Aucune source fiable trouvee pour "${query}".`,
    message: 'Aucune source exploitable n a ete trouvee avec cette requete.',
    suggestion: 'Precise le pays, l organisation, ou la periode recherchee avant de relancer la recherche.',
  };
}

/**
 * Web search as a native Anthropic tool.
 * Internally delegates to the OpenAI sub-agent for actual web search.
 */
export const webSearchAsTool = defineTool({
  name: 'web_search',
  description:
    'Search the web for current information (salary benchmarks, company info, market trends, training resources). Use ONLY when internal data is insufficient.',
  parameters: z.object({
    query: z.string().describe('The search query in natural language. Be specific and include context (e.g., "salaire moyen développeur React Côte d\'Ivoire 2026").'),
  }),
  normalize: (raw) => ({
    ...raw,
    query: raw.query || (typeof raw.input === 'string' ? raw.input : raw.query),
  }),
  execute: async ({ query }) => {
    try {
      const normalizedQuery = query.trim().replace(/\s+/g, ' ');
      if (!normalizedQuery) {
        return {
          success: false,
          error: 'Missing query. Provide a concrete search request with topic and region.',
        };
      }

      logger.info(`[web_search] Executing search: "${normalizedQuery.slice(0, 100)}"`);
      const result = await executeWebSearch(normalizedQuery);

      if (/^no relevant results found\.?$/i.test(result)) {
        return buildNoResultsResponse(normalizedQuery);
      }

      return { success: true, query: normalizedQuery, content: result };
    } catch (error: any) {
      logger.error(`[web_search] Error: ${error.message}`);
      return { success: false, error: error.message };
    }
  },
});

// Re-export for backward compatibility
export { webSearchAgent };
