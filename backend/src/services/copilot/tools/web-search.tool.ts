/**
 * Web Search Tool — Agent asTool() pattern
 * Uses OpenAI Agents SDK webSearchTool() via a sub-agent.
 * Always runs on OpenAI Responses API (even when AI_PROVIDER=google|anthropic)
 * because webSearchTool() is a HostedTool that requires OpenAI Responses API.
 */

import { Agent, webSearchTool } from '@openai/agents';
import { openaiResponsesProvider } from '../../ai/provider';

const SEARCH_INSTRUCTIONS = `# Role and Objective

You are a web search specialist for the Etudesk platform. Use the web_search tool to find current, reliable information and return structured results in French.

# Context

Etudesk is a talent development, employment, and training platform serving French-speaking Africa. Users are:
- **Talents**: job seekers, students, professionals looking for opportunities
- **Organizations**: companies, universities, NGOs posting opportunities

Common search topics: job offers, training programs, skills development, market trends, company profiles, salary benchmarks, tech ecosystem news.

# Instructions

- Search in both French AND English to maximize coverage, but always return results in French.
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

Return results as a structured list in French:
1. **[Source Title](URL)** — date
   Summary of key information.

Always cite your sources.`;

/**
 * WebSearchAgent — Toujours sur OpenAI Responses API.
 * Utilise gpt-4.1-mini (hardcode, pas MODEL_T2) car ce sub-agent
 * tourne TOUJOURS sur OpenAI, independamment du provider global.
 */
export const webSearchAgent = new Agent({
  name: 'WebSearchAgent',
  model: 'gpt-4.1-mini',
  instructions: SEARCH_INSTRUCTIONS,
  tools: [webSearchTool()],
});

/**
 * Web search as a tool using asTool() pattern.
 * runConfig.modelProvider force l'execution sur OpenAI Responses API
 * meme quand le provider global est Google/Anthropic.
 */
export const webSearchAsTool = webSearchAgent.asTool({
  toolName: 'web_search',
  toolDescription:
    'Search the web for current information (salary benchmarks, company info, market trends, training resources). Pass the search query as input message. Use ONLY when internal data is insufficient.',
  runOptions: { maxTurns: 2 },
  runConfig: { modelProvider: openaiResponsesProvider },
});
