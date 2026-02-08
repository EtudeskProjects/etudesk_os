/**
 * YouTube Search Tool — Educational video search
 * Study mode only
 */

import { tool } from '@openai/agents';
import { z } from 'zod';

import { logger } from '../../../utils';
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || '';

export const youtubeSearchTool = tool({
  name: 'youtube_search',
  description:
    'Search YouTube for educational videos on a topic. Study mode only. Returns the most relevant French-language video tutorials, prioritizing West African francophone creators. Use this when the learner needs video explanations or visual demonstrations of a concept.',
  parameters: z.object({
    query: z.string().describe('Search query for educational videos. ALWAYS write the query in French. Prioritize West African francophone (UEMOA) creators: append "Afrique francophone" or "Afrique de l\'Ouest" to queries when the topic allows it (business, marketing, entrepreneuriat, droit, finance, etc.). For universal tech topics (coding, frameworks), French is enough. Examples: "marketing digital Afrique francophone", "entrepreneuriat UEMOA", "tutoriel React hooks en francais"'),
    maxResults: z.number().min(1).max(5).default(3).describe('Number of videos to return. Default 3.'),
  }),
  execute: async ({ query, maxResults }) => {
    if (!YOUTUBE_API_KEY) {
      return { videos: [], message: 'YouTube API non configurée' };
    }

    try {
      const url = new URL('https://www.googleapis.com/youtube/v3/search');
      url.searchParams.set('part', 'snippet');
      url.searchParams.set('q', query);
      url.searchParams.set('maxResults', maxResults.toString());
      url.searchParams.set('type', 'video');
      url.searchParams.set('relevanceLanguage', 'fr');
      url.searchParams.set('key', YOUTUBE_API_KEY);

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`YouTube API error: ${response.status}`);
      }

      const data = (await response.json()) as {
        items?: Array<{
          id: { videoId: string };
          snippet: {
            title: string;
            description?: string;
            channelTitle?: string;
            thumbnails?: { medium?: { url: string } };
          };
        }>;
      };

      const videos = (data.items || []).map((item) => ({
        videoId: item.id.videoId,
        title: item.snippet.title,
        description: item.snippet.description?.slice(0, 200),
        channelName: item.snippet.channelTitle,
        thumbnailUrl: item.snippet.thumbnails?.medium?.url,
      }));

      return { videos };
    } catch (error: any) {
      logger.error('YouTube search error:', error);
      return { videos: [], error: error.message };
    }
  },
});
