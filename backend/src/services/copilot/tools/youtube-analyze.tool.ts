/**
 * YouTube Video Analyzer Tool — Gemini-powered pedagogical video analysis
 * Uses @google/genai SDK to analyze YouTube videos natively (audio + visual)
 * Analyzes each video individually then compares scores server-side
 * Study mode only
 */

import { defineTool } from './tool-helper';
import { z } from 'zod';
import { GoogleGenAI } from '@google/genai';
import { logger } from '../../../utils';

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

interface VideoAnalysis {
  videoId: string;
  resume: string;
  concepts_cles: Array<{ concept: string; explanation: string }>;
  moments_importants: Array<{ timestamp: string; description: string }>;
  niveau: string;
  competences: string[];
  elements_visuels: string[];
  quality_score?: number;
}

/** Analyze a single video with Gemini */
async function analyzeSingleVideo(
  genai: GoogleGenAI,
  videoId: string,
  focusTopics: string | undefined,
  lang: string,
  needsScore: boolean
): Promise<VideoAnalysis | null> {
  const topicContext = focusTopics ? `Focus topic: "${focusTopics}". ` : '';
  const scoreInstruction = needsScore
    ? `\n  "quality_score": <1-10 integer rating: relevance to topic (40%), pedagogical clarity (30%), production quality (30%)>,`
    : '';

  const prompt = `${topicContext}Analyze this YouTube video for educational purposes. Respond in ${lang}.

Return a JSON object with EXACTLY this structure:
{
  "resume": "150-200 word pedagogical summary of the video content",
  "concepts_cles": [{"concept": "Name", "explanation": "1-2 sentence explanation"}],
  "moments_importants": [{"timestamp": "MM:SS", "description": "What happens at this point"}],
  "niveau": "debutant|intermediaire|avance",
  "competences": ["skill1", "skill2", "skill3"],
  "elements_visuels": ["Notable visual elements, demos, or diagrams shown"]${scoreInstruction}
}

Rules:
- concepts_cles: 5-10 items
- moments_importants: 3-7 timestamps
- competences: 3-5 skills covered
- resume must be pedagogically focused (what the viewer will LEARN, not just a description)
- Return ONLY the JSON, no markdown fences`;

  try {
    const response = await genai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              fileData: {
                fileUri: `https://www.youtube.com/watch?v=${videoId}`,
                mimeType: 'video/mp4',
              },
            },
            { text: prompt },
          ],
        },
      ],
    });

    const responseText = response.text?.trim() || '';
    const cleanJson = responseText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    const parsed = JSON.parse(cleanJson);
    return { videoId, ...parsed };
  } catch (error: any) {
    // Gemini token limit exceeded — video is too long
    if (error.message?.includes('token count exceeds') || error.message?.includes('1048576')) {
      logger.warn(`[analyze_youtube_video] Video ${videoId} too long for Gemini (>1M tokens)`);
      return null;
    }
    logger.warn(`[analyze_youtube_video] Failed to analyze video ${videoId}: ${error.message}`);
    return null;
  }
}

export const analyzeYoutubeVideoTool = defineTool({
  name: 'analyze_youtube_video',
  description:
    'Analyze 1-3 YouTube videos with Gemini AI (audio + visual). Only call this tool when: (1) the user explicitly asks to analyze/explain a video, or (2) the user shares a YouTube URL. Do NOT call automatically after youtube_search.',
  parameters: z.object({
    urls: z
      .array(z.string())
      .min(1)
      .max(3)
      .describe('1-3 YouTube URLs to analyze and compare'),
    focusTopics: z
      .string()
      .optional()
      .describe('Topic focus for relevance comparison'),
    language: z.enum(['fr', 'en', 'es', 'ar', 'it', 'de', 'zh']).default('en'),
  }),
  execute: async ({ urls, focusTopics, language }) => {
    const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || '';
    if (!GOOGLE_API_KEY) {
      return { success: false, error: 'Google API non configurée' };
    }

    // 1. Validate URLs and extract video IDs
    const videos: { url: string; videoId: string }[] = [];
    for (const url of urls) {
      const videoId = extractVideoId(url);
      if (!videoId) {
        return {
          success: false,
          error: `URL YouTube invalide : ${url}. Format attendu : https://youtube.com/watch?v=... ou https://youtu.be/...`,
        };
      }
      videos.push({ url, videoId });
    }

    const languageNames: Record<string, string> = {
      fr: 'French',
      en: 'English',
      es: 'Spanish',
      ar: 'Arabic',
      it: 'Italian',
      de: 'German',
      zh: 'Chinese (Simplified)',
    };
    const lang = languageNames[language] || 'English';
    const needsScore = videos.length > 1;

    try {
      const genai = new GoogleGenAI({ apiKey: GOOGLE_API_KEY });

      // 2. Analyze each video individually in parallel
      const results = await Promise.allSettled(
        videos.map((v) => analyzeSingleVideo(genai, v.videoId, focusTopics, lang, needsScore))
      );

      // 3. Collect successful analyses
      const analyses: VideoAnalysis[] = [];
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          analyses.push(result.value);
        }
      }

      if (analyses.length === 0) {
        return {
          success: false,
          error:
            language === 'fr'
              ? 'Aucune vidéo n\'a pu être analysée. Les vidéos sont peut-être trop longues (max ~45 min), privées ou indisponibles. Essaie avec une vidéo plus courte.'
              : 'No video could be analyzed. Videos may be too long (max ~45 min), private, or unavailable. Try a shorter video.',
        };
      }

      // 4. Pick the best video
      let best: VideoAnalysis;
      if (analyses.length === 1) {
        best = analyses[0];
      } else {
        // Sort by quality_score descending, fallback to first
        best = analyses.sort((a, b) => (b.quality_score || 5) - (a.quality_score || 5))[0];
      }

      const selectionReason =
        analyses.length > 1
          ? (language === 'fr'
              ? `Sélectionnée parmi ${analyses.length} vidéos analysées (score: ${best.quality_score || 'N/A'}/10).`
              : `Selected from ${analyses.length} analyzed videos (score: ${best.quality_score || 'N/A'}/10).`)
          : undefined;

      return {
        success: true,
        bestVideoId: best.videoId,
        videoUrl: `https://www.youtube.com/watch?v=${best.videoId}`,
        analysis: {
          resume: best.resume || '',
          concepts_cles: best.concepts_cles || [],
          moments_importants: best.moments_importants || [],
          niveau: best.niveau || 'intermediaire',
          competences: best.competences || [],
          elements_visuels: best.elements_visuels || [],
          selection_reason: selectionReason,
        },
      };
    } catch (error: any) {
      logger.error('[analyze_youtube_video] Error:', error);

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
