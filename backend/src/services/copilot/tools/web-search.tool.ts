/**
 * Web Search Tool — direct Brave Search API.
 *
 * Hosted web-search tools are provider-specific. We keep external search on a
 * dedicated search API while model calls run through the configured AI provider.
 */

import { z } from 'zod';
import { defineTool } from './tool-helper';
import { logger } from '../../../utils';

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

async function executeWebSearch(query: string): Promise<Array<{ title: string; url: string; description: string; age?: string }>> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) throw new Error('BRAVE_SEARCH_API_KEY not configured');

  const url = new URL('https://api.search.brave.com/res/v1/web/search');
  url.searchParams.set('q', query);
  url.searchParams.set('count', '5');
  url.searchParams.set('country', 'CI');
  url.searchParams.set('search_lang', 'fr');

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'X-Subscription-Token': apiKey,
    },
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Brave Search failed (${response.status}): ${body.slice(0, 300)}`);
  }

  const data: any = await response.json();
  return (data.web?.results || []).map((r: any) => ({
    title: r.title || r.url,
    url: r.url,
    description: r.description || '',
    age: r.age,
  }));
}

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
        return { success: false, error: 'Missing query. Provide a concrete search request with topic and region.' };
      }

      logger.info(`[web_search] Executing Brave search: "${normalizedQuery.slice(0, 100)}"`);
      const results = await executeWebSearch(normalizedQuery);
      if (results.length === 0) return buildNoResultsResponse(normalizedQuery);

      const content = results
        .map((r, i) => `${i + 1}. **${r.title}**${r.age ? ` — ${r.age}` : ''}\n${r.url}\n${r.description}`)
        .join('\n\n');

      return { success: true, query: normalizedQuery, results, content };
    } catch (error: any) {
      logger.error(`[web_search] Error: ${error.message}`);
      return { success: false, error: error.message };
    }
  },
});

export const webSearchAgent = null;
