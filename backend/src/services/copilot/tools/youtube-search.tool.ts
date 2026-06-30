/**
 * YouTube Search Tool — Educational video search
 * Study mode only
 */

import { defineTool } from './tool-helper';
import { z } from 'zod';

import { logger } from '../../../utils';

export const youtubeSearchTool = defineTool({
  name: 'youtube_search',
  description:
    'Search YouTube for educational videos. Study mode only. Returns up to 5 results. Present ONLY THE SINGLE BEST video as ONE youtube block — never multiple youtube blocks.',
  parameters: z.object({
    query: z.string().describe('Search query in natural language. Include market/language only when the user explicitly asks for it. Example: "digital marketing training in French"'),
    maxResults: z.number().min(1).max(5).default(5).describe('Max results (always 5).'),
  }),
  execute: async ({ query, maxResults }) => {
    const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || '';
    if (!YOUTUBE_API_KEY) {
      return { videos: [], unavailable: true, retryable: false, message: 'YouTube API non configurée. Ne rappelle pas youtube_search; utilise un fallback texte.' };
    }

    const sanitizedQuery = (query || '').replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, 200);
    if (!sanitizedQuery) {
      return { videos: [], message: 'Query vide' };
    }

    try {
      const url = new URL('https://www.googleapis.com/youtube/v3/search');
      url.searchParams.set('part', 'snippet');
      url.searchParams.set('q', sanitizedQuery);
      url.searchParams.set('maxResults', maxResults.toString());
      url.searchParams.set('type', 'video');
      url.searchParams.set('safeSearch', 'moderate');
      url.searchParams.set('key', YOUTUBE_API_KEY);

      const response = await fetch(url.toString());
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        logger.error(`YouTube API ${response.status} for query "${sanitizedQuery}": ${body.slice(0, 300)}`);
        return {
          videos: [],
          unavailable: true,
          retryable: false,
          message: `YouTube indisponible (${response.status}). Ne rappelle pas youtube_search; utilise un fallback texte, steps, flashcard ou quiz.`,
        };
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
        url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
      }));

      return { videos };
    } catch (error: any) {
      logger.error('YouTube search error:', error);
      return {
        videos: [],
        unavailable: true,
        retryable: false,
        message: `YouTube indisponible. Ne rappelle pas youtube_search; utilise un fallback texte, steps, flashcard ou quiz.`,
      };
    }
  },
});
