/**
 * Audio Analysis Service — Gemini 2.5 Flash
 * Analyzes audio directly (no Whisper fallback) for all copilot modes.
 * - Study mode: transcription + pronunciation analysis + correction + encouragement
 * - Explore/Org mode: faithful transcription + user intent summary
 */

import { logger } from '../../utils';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const STUDY_PROMPT = `Tu es un assistant pédagogique. Analyse cet audio vocal envoyé par un apprenant.

Fais les étapes suivantes:
1. **Transcription fidèle** : Transcris exactement ce que la personne dit.
2. **Langue détectée** : Indique la langue parlée.
3. **Analyse de prononciation** : Note les erreurs de prononciation, grammaire orale, ou hésitations.
4. **Corrections** : Propose la version corrigée des phrases mal formulées.
5. **Encouragement** : Termine par un encouragement constructif.

Formate ta réponse ainsi:
📝 **Transcription:** [texte exact]

🗣️ **Langue:** [langue détectée]

🔍 **Analyse:** [observations sur la prononciation et la fluidité]

✅ **Corrections:** [phrases corrigées si nécessaire]

💪 **Encouragement:** [message positif]

---
**Message de l'utilisateur à traiter par l'assistant:** [transcription]`;

const DEFAULT_PROMPT = `Tu es un assistant. Transcris fidèlement cet audio vocal et résume l'intention de l'utilisateur.

Formate ta réponse ainsi:
📝 **Transcription:** [texte exact de ce que la personne dit]

🎯 **Intention:** [résumé en 1-2 phrases de ce que l'utilisateur demande ou veut faire]

---
**Message de l'utilisateur à traiter par l'assistant:** [transcription]`;

/**
 * Analyze audio using Gemini 2.5 Flash native audio understanding.
 * @param audioBase64 - Base64-encoded audio data
 * @param mimeType - Audio MIME type (e.g. 'audio/mp4', 'audio/webm')
 * @param mode - Copilot mode ('study' | 'explore' | 'org')
 * @returns Analysis text to inject into the user message
 */
export async function analyzeAudio(
  audioBase64: string,
  mimeType: string,
  mode: 'study' | 'explore' | 'org'
): Promise<string> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY is required for audio analysis');
  }

  const prompt = mode === 'study' ? STUDY_PROMPT : DEFAULT_PROMPT;

  logger.info(`[AudioAnalysis] Analyzing audio (${mimeType}, mode=${mode})`);

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType,
                data: audioBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1024,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error(`[AudioAnalysis] Gemini API error: ${response.status} — ${errorText}`);
    throw new Error(`Audio analysis failed: ${response.status}`);
  }

  const data: any = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('No analysis result from Gemini');
  }

  logger.info(`[AudioAnalysis] Result: ${text.slice(0, 100)}...`);
  return text;
}
