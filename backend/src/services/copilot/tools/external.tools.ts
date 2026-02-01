/**
 * External Tools for Copilot
 * Tools for external API integrations (Brave Search, YouTube, Wikipedia)
 */

import { z } from 'zod';
import {
  WebSearchResultsOutput,
  YouTubePlayerOutput,
  WikipediaArticleOutput,
  DiagramViewerOutput,
} from '../ontology/outputs';
import { EXTERNAL_APIS, FEATURES } from '../config';

// ═══════════════════════════════════════════════════════════════
// BRAVE WEB SEARCH
// ═══════════════════════════════════════════════════════════════

export const braveWebSearchSchema = z.object({
  query: z.string().describe('Requête de recherche'),
  count: z.number().min(1).max(20).default(5).describe('Nombre de résultats'),
  freshness: z
    .enum(['pd', 'pw', 'pm', 'py'])
    .optional()
    .describe('Fraîcheur: pd=jour, pw=semaine, pm=mois, py=année'),
  safesearch: z.enum(['off', 'moderate', 'strict']).default('moderate'),
});

export type BraveWebSearchParams = z.infer<typeof braveWebSearchSchema>;

export async function braveWebSearch(
  params: BraveWebSearchParams,
  context: { talentId: string }
): Promise<WebSearchResultsOutput> {
  const { query, count, freshness, safesearch } = params;

  if (!FEATURES.enableWebSearch || !EXTERNAL_APIS.BRAVE_API_KEY) {
    return {
      type: 'web_search_results',
      query,
      results: [],
      totalResults: 0,
    };
  }

  try {
    const url = new URL('https://api.search.brave.com/res/v1/web/search');
    url.searchParams.set('q', query);
    url.searchParams.set('count', count.toString());
    url.searchParams.set('safesearch', safesearch);
    if (freshness) {
      url.searchParams.set('freshness', freshness);
    }

    const response = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': EXTERNAL_APIS.BRAVE_API_KEY,
      },
    });

    if (!response.ok) {
      throw new Error(`Brave API error: ${response.status}`);
    }

    const data = await response.json() as {
      web?: {
        results?: Array<{
          title: string;
          url: string;
          description?: string;
          profile?: { img?: string };
        }>;
        total_results?: number;
      };
    };

    const results = (data.web?.results || []).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.description || '',
      favicon: r.profile?.img || undefined,
    }));

    return {
      type: 'web_search_results',
      query,
      results,
      totalResults: data.web?.total_results || results.length,
    };
  } catch (error) {
    console.error('Brave search error:', error);
    return {
      type: 'web_search_results',
      query,
      results: [],
      totalResults: 0,
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// YOUTUBE SEARCH
// ═══════════════════════════════════════════════════════════════

export const searchYouTubeSchema = z.object({
  query: z.string().describe('Requête de recherche'),
  maxResults: z.number().min(1).max(10).default(3),
  type: z.enum(['video', 'playlist', 'channel']).default('video'),
  duration: z.enum(['short', 'medium', 'long']).optional().describe('Durée: short<4min, medium 4-20min, long>20min'),
  language: z.string().default('fr').describe('Code langue (fr, en, etc.)'),
});

export type SearchYouTubeParams = z.infer<typeof searchYouTubeSchema>;

export async function searchYouTube(
  params: SearchYouTubeParams,
  context: { talentId: string }
): Promise<YouTubePlayerOutput[]> {
  const { query, maxResults, type, duration, language } = params;

  if (!FEATURES.enableYouTubeSearch || !EXTERNAL_APIS.YOUTUBE_API_KEY) {
    return [];
  }

  try {
    const url = new URL('https://www.googleapis.com/youtube/v3/search');
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('q', query);
    url.searchParams.set('maxResults', maxResults.toString());
    url.searchParams.set('type', type);
    url.searchParams.set('relevanceLanguage', language);
    url.searchParams.set('key', EXTERNAL_APIS.YOUTUBE_API_KEY);

    if (duration) {
      url.searchParams.set('videoDuration', duration);
    }

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`YouTube API error: ${response.status}`);
    }

    const data = await response.json() as {
      items?: Array<{
        id: { videoId: string };
        snippet: { title: string; description?: string };
      }>;
    };

    return (data.items || []).map((item) => ({
      type: 'study_youtube_player' as const,
      videoId: item.id.videoId,
      title: item.snippet.title,
      description: item.snippet.description,
    }));
  } catch (error) {
    console.error('YouTube search error:', error);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════
// WIKIPEDIA SEARCH
// ═══════════════════════════════════════════════════════════════

export const searchWikipediaSchema = z.object({
  query: z.string().describe('Terme à rechercher'),
  language: z.string().default('fr').describe('Code langue (fr, en, etc.)'),
  sentences: z.number().min(1).max(10).default(5).describe("Nombre de phrases pour l'extrait"),
});

export type SearchWikipediaParams = z.infer<typeof searchWikipediaSchema>;

export async function searchWikipedia(
  params: SearchWikipediaParams,
  context: { talentId: string }
): Promise<WikipediaArticleOutput | null> {
  const { query, language, sentences } = params;

  try {
    // Search for the page
    const searchUrl = new URL(`https://${language}.wikipedia.org/w/api.php`);
    searchUrl.searchParams.set('action', 'query');
    searchUrl.searchParams.set('list', 'search');
    searchUrl.searchParams.set('srsearch', query);
    searchUrl.searchParams.set('srlimit', '1');
    searchUrl.searchParams.set('format', 'json');
    searchUrl.searchParams.set('origin', '*');

    const searchResponse = await fetch(searchUrl.toString());
    const searchData = await searchResponse.json() as {
      query?: { search?: Array<{ title: string }> };
    };

    if (!searchData.query?.search?.length) {
      return null;
    }

    const pageTitle = searchData.query.search[0].title;

    // Get page content
    const contentUrl = new URL(`https://${language}.wikipedia.org/w/api.php`);
    contentUrl.searchParams.set('action', 'query');
    contentUrl.searchParams.set('titles', pageTitle);
    contentUrl.searchParams.set('prop', 'extracts|pageimages|info');
    contentUrl.searchParams.set('exsentences', sentences.toString());
    contentUrl.searchParams.set('explaintext', 'true');
    contentUrl.searchParams.set('piprop', 'thumbnail');
    contentUrl.searchParams.set('pithumbsize', '400');
    contentUrl.searchParams.set('inprop', 'url');
    contentUrl.searchParams.set('format', 'json');
    contentUrl.searchParams.set('origin', '*');

    const contentResponse = await fetch(contentUrl.toString());
    const contentData = await contentResponse.json() as {
      query?: {
        pages?: Record<string, {
          title: string;
          extract?: string;
          thumbnail?: { source: string };
          fullurl?: string;
          missing?: boolean;
        }>;
      };
    };

    const pages = contentData.query?.pages;
    if (!pages) return null;

    const page = Object.values(pages)[0] as any;
    if (page.missing) return null;

    return {
      type: 'study_wikipedia_article',
      title: page.title,
      summary: page.extract || '',
      url: page.fullurl || `https://${language}.wikipedia.org/wiki/${encodeURIComponent(pageTitle)}`,
      imageUrl: page.thumbnail?.source,
    };
  } catch (error) {
    console.error('Wikipedia search error:', error);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// DIAGRAM GENERATION (Mermaid)
// ═══════════════════════════════════════════════════════════════

export const generateDiagramSchema = z.object({
  diagramType: z.enum(['flowchart', 'sequence', 'classDiagram', 'stateDiagram', 'erDiagram', 'mindmap']),
  title: z.string(),
  description: z.string().describe('Description du concept à visualiser'),
  nodes: z.array(z.string()).optional().describe('Nœuds principaux du diagramme'),
  relationships: z
    .array(
      z.object({
        from: z.string(),
        to: z.string(),
        label: z.string().optional(),
      })
    )
    .optional()
    .describe('Relations entre les nœuds'),
});

export type GenerateDiagramParams = z.infer<typeof generateDiagramSchema>;

export async function generateDiagram(
  params: GenerateDiagramParams,
  context: { talentId: string }
): Promise<DiagramViewerOutput> {
  const { diagramType, title, description, nodes, relationships } = params;

  let mermaidCode = '';

  // Generate Mermaid code based on diagram type
  if (diagramType === 'flowchart') {
    mermaidCode = 'flowchart TD\n';
    if (nodes) {
      nodes.forEach((node, i) => {
        const nodeId = `N${i}`;
        mermaidCode += `    ${nodeId}["${node}"]\n`;
      });
    }
    if (relationships) {
      relationships.forEach((rel) => {
        const label = rel.label ? `|${rel.label}|` : '';
        mermaidCode += `    ${rel.from} -->${label} ${rel.to}\n`;
      });
    }
  } else if (diagramType === 'mindmap') {
    mermaidCode = 'mindmap\n';
    mermaidCode += `  root((${title}))\n`;
    if (nodes) {
      nodes.forEach((node) => {
        mermaidCode += `    ${node}\n`;
      });
    }
  } else if (diagramType === 'sequence') {
    mermaidCode = 'sequenceDiagram\n';
    if (relationships) {
      relationships.forEach((rel) => {
        const label = rel.label || 'message';
        mermaidCode += `    ${rel.from}->>${rel.to}: ${label}\n`;
      });
    }
  } else if (diagramType === 'classDiagram') {
    mermaidCode = 'classDiagram\n';
    if (nodes) {
      nodes.forEach((node) => {
        mermaidCode += `    class ${node.replace(/\s+/g, '')} {\n    }\n`;
      });
    }
    if (relationships) {
      relationships.forEach((rel) => {
        const label = rel.label || '';
        mermaidCode += `    ${rel.from.replace(/\s+/g, '')} --> ${rel.to.replace(/\s+/g, '')}: ${label}\n`;
      });
    }
  } else {
    // Default simple diagram
    mermaidCode = `flowchart TD\n    A["${title}"]\n    A --> B["${description.slice(0, 50)}..."]\n`;
  }

  return {
    type: 'study_diagram_viewer',
    diagramType: 'mermaid',
    title,
    description,
    content: mermaidCode,
    caption: `Diagramme: ${title}`,
  };
}

// ═══════════════════════════════════════════════════════════════
// EXPORT TOOL DEFINITIONS
// ═══════════════════════════════════════════════════════════════

export const externalToolDefinitions = {
  brave_web_search: {
    name: 'brave_web_search',
    description:
      'Effectue une recherche sur le web via l\'API Brave. Utile pour trouver des informations actuelles non présentes dans la base de données.',
    parameters: braveWebSearchSchema,
    execute: braveWebSearch,
  },
  search_youtube: {
    name: 'search_youtube',
    description:
      'Recherche des vidéos YouTube éducatives sur un sujet donné. Retourne les vidéos les plus pertinentes.',
    parameters: searchYouTubeSchema,
    execute: searchYouTube,
  },
  search_wikipedia: {
    name: 'search_wikipedia',
    description:
      "Recherche et récupère un article Wikipedia sur un sujet. Idéal pour obtenir des définitions et explications de concepts.",
    parameters: searchWikipediaSchema,
    execute: searchWikipedia,
  },
  generate_diagram: {
    name: 'generate_diagram',
    description:
      "Génère un diagramme Mermaid pour visualiser un concept, un processus ou des relations. Types: flowchart, sequence, classDiagram, mindmap.",
    parameters: generateDiagramSchema,
    execute: generateDiagram,
  },
};
