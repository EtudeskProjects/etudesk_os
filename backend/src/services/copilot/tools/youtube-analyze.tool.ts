/**
 * YouTube Video Analyzer Tool — Gemini-powered pedagogical video analysis
 * Uses @google/genai SDK to analyze YouTube videos natively (audio + visual)
 * Study mode only
 */

import { defineTool } from './tool-helper';
import { z } from 'zod';
import { GoogleGenAI } from '@google/genai';
import { logger } from '../../../utils';

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || '';

/** Extract YouTube video ID from various URL formats */
function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export const analyzeYoutubeVideoTool = defineTool({
  name: 'analyze_youtube_video',
  description:
    'Analyze 1-3 YouTube videos in a single call. Compares content quality and returns pedagogical analysis of the best one. MUST be called after every youtube_search. Also use when user pastes a YouTube URL.',
  parameters: z.object({
    videoUrls: z
      .array(z.string())
      .min(1)
      .max(3)
      .describe('1-3 YouTube URLs to analyze and compare'),
    focusTopics: z
      .string()
      .optional()
      .describe('Topic focus for relevance comparison'),
    language: z.enum(['fr', 'en']).default('fr'),
  }),
  execute: async ({ videoUrls, focusTopics, language }) => {
    if (!GOOGLE_API_KEY) {
      return { success: false, error: 'Google API non configurée' };
    }

    // 1. Validate URLs and extract video IDs
    const videos: { url: string; videoId: string }[] = [];
    for (const url of videoUrls) {
      const videoId = extractVideoId(url);
      if (!videoId) {
        return {
          success: false,
          error: `URL YouTube invalide : ${url}. Format attendu : https://youtube.com/watch?v=... ou https://youtu.be/...`,
        };
      }
      videos.push({ url, videoId });
    }

    try {
      const genai = new GoogleGenAI({ apiKey: GOOGLE_API_KEY });

      // 2. Build content parts with fileData for each video + analysis prompt
      const videoParts: Array<{ fileData: { fileUri: string; mimeType: string } }> = videos.map(
        (v) => ({
          fileData: {
            fileUri: `https://www.youtube.com/watch?v=${v.videoId}`,
            mimeType: 'video/mp4',
          },
        })
      );

      const lang = language === 'en' ? 'English' : 'French';
      const topicContext = focusTopics ? `Focus topic: "${focusTopics}". ` : '';

      let analysisPrompt: string;
      if (videos.length === 1) {
        analysisPrompt = `${topicContext}Analyze this YouTube video for educational purposes. Respond in ${lang}.

Return a JSON object with EXACTLY this structure:
{
  "bestVideoId": "${videos[0].videoId}",
  "resume": "150-200 word pedagogical summary of the video content",
  "concepts_cles": [{"concept": "Name", "explanation": "1-2 sentence explanation"}],
  "moments_importants": [{"timestamp": "MM:SS", "description": "What happens at this point"}],
  "niveau": "debutant|intermediaire|avance",
  "competences": ["skill1", "skill2", "skill3"],
  "elements_visuels": ["Notable visual elements, demos, or diagrams shown"]
}

Rules:
- concepts_cles: 5-10 items
- moments_importants: 3-7 timestamps
- competences: 3-5 skills covered
- resume must be pedagogically focused (what the viewer will LEARN, not just a description)
- Return ONLY the JSON, no markdown fences`;
      } else {
        const videoList = videos
          .map((v, i) => `Video ${i + 1}: https://www.youtube.com/watch?v=${v.videoId}`)
          .join('\n');
        analysisPrompt = `${topicContext}Compare these ${videos.length} YouTube videos and select the BEST one for learning. Respond in ${lang}.

${videoList}

Selection criteria (in order of priority):
1. Content relevance to the focus topic
2. Pedagogical quality (clear explanations, structured content, examples)
3. Production quality (audio clarity, visual aids)
4. Depth of coverage

Return a JSON object with EXACTLY this structure:
{
  "bestVideoId": "<videoId of the best video>",
  "selection_reason": "1-2 sentences explaining why this video was selected over the others",
  "resume": "150-200 word pedagogical summary of the BEST video's content",
  "concepts_cles": [{"concept": "Name", "explanation": "1-2 sentence explanation"}],
  "moments_importants": [{"timestamp": "MM:SS", "description": "What happens at this point"}],
  "niveau": "debutant|intermediaire|avance",
  "competences": ["skill1", "skill2", "skill3"],
  "elements_visuels": ["Notable visual elements, demos, or diagrams shown"]
}

Rules:
- bestVideoId MUST be one of: ${videos.map((v) => v.videoId).join(', ')}
- concepts_cles: 5-10 items
- moments_importants: 3-7 timestamps
- competences: 3-5 skills covered
- Analyze ONLY the best video in detail
- Return ONLY the JSON, no markdown fences`;
      }

      // 3. Call Gemini with video(s) + prompt
      const response = await genai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [...videoParts, { text: analysisPrompt }],
          },
        ],
      });

      const responseText = response.text?.trim() || '';

      // 4. Parse JSON response (with fallback)
      let analysis: any;
      try {
        // Remove potential markdown fences
        const cleanJson = responseText
          .replace(/^```(?:json)?\s*/i, '')
          .replace(/\s*```$/i, '')
          .trim();
        analysis = JSON.parse(cleanJson);
      } catch {
        // Fallback: return raw text as summary
        logger.warn('[analyze_youtube_video] Failed to parse JSON, returning raw text');
        return {
          success: true,
          bestVideoId: videos[0].videoId,
          videoUrl: `https://www.youtube.com/watch?v=${videos[0].videoId}`,
          analysis: {
            resume: responseText.slice(0, 1000),
            concepts_cles: [],
            moments_importants: [],
            niveau: 'intermediaire',
            competences: [],
            elements_visuels: [],
          },
          rawText: true,
        };
      }

      const bestVideoId = analysis.bestVideoId || videos[0].videoId;

      return {
        success: true,
        bestVideoId,
        videoUrl: `https://www.youtube.com/watch?v=${bestVideoId}`,
        analysis: {
          resume: analysis.resume || '',
          concepts_cles: analysis.concepts_cles || [],
          moments_importants: analysis.moments_importants || [],
          niveau: analysis.niveau || 'intermediaire',
          competences: analysis.competences || [],
          elements_visuels: analysis.elements_visuels || [],
          selection_reason: analysis.selection_reason,
        },
      };
    } catch (error: any) {
      logger.error('[analyze_youtube_video] Gemini analysis error:', error);

      // Handle specific errors
      if (error.message?.includes('not found') || error.message?.includes('unavailable')) {
        return {
          success: false,
          error:
            language === 'fr'
              ? 'Cette video est privee, supprimee ou indisponible. Essaie avec une autre URL.'
              : 'This video is private, deleted or unavailable. Try another URL.',
        };
      }

      return {
        success: false,
        error:
          language === 'fr'
            ? `Erreur lors de l'analyse video : ${error.message}`
            : `Video analysis error: ${error.message}`,
      };
    }
  },
});
