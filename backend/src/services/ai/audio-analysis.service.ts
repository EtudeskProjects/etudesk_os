/**
 * Audio Analysis Service — OpenAI gpt-4o-mini-transcribe
 * Transcribes audio via OpenAI Whisper/STT, then analyzes with gpt-4.1-nano.
 * Migrated from Gemini 2.5 Flash (Google API key blocked).
 */

import { logger } from '../../utils';
import { getOpenAIClient } from './provider';
import { MODEL_SUGGESTION, MODEL_STT } from './models';

const STUDY_PROMPT = `Tu es un assistant pédagogique. Analyse cette transcription vocale envoyée par un apprenant.

Fais les étapes suivantes:
1. **Transcription fidèle** : La transcription est fournie ci-dessous.
2. **Langue détectée** : Indique la langue parlée.
3. **Analyse de prononciation** : Note les erreurs de grammaire orale ou hésitations visibles dans la transcription.
4. **Corrections** : Propose la version corrigée des phrases mal formulées.
5. **Encouragement** : Termine par un encouragement constructif.

Formate ta réponse ainsi:
📝 **Transcription:** [texte exact]

🗣️ **Langue:** [langue détectée]

🔍 **Analyse:** [observations sur la fluidité]

✅ **Corrections:** [phrases corrigées si nécessaire]

💪 **Encouragement:** [message positif]

---
**Message de l'utilisateur à traiter par l'assistant:** [transcription]`;

const DEFAULT_PROMPT = `Tu es un assistant. Voici la transcription d'un audio vocal. Résume l'intention de l'utilisateur.

Formate ta réponse ainsi:
📝 **Transcription:** [texte exact de ce que la personne dit]

🎯 **Intention:** [résumé en 1-2 phrases de ce que l'utilisateur demande ou veut faire]

---
**Message de l'utilisateur à traiter par l'assistant:** [transcription]`;

/**
 * Analyze audio: transcribe with OpenAI STT, then analyze with gpt-4.1-nano.
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
  const openai = getOpenAIClient();

  logger.info(`[AudioAnalysis] Analyzing audio (${mimeType}, mode=${mode}) via OpenAI`);

  // Step 1: Transcribe with OpenAI STT
  const audioBuffer = Buffer.from(audioBase64, 'base64');
  const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('webm') ? 'webm' : mimeType.includes('ogg') ? 'ogg' : 'wav';
  const file = new File([audioBuffer], `audio.${ext}`, { type: mimeType });

  const transcription = await openai.audio.transcriptions.create({
    model: MODEL_STT,
    file,
  });

  const transcribedText = transcription.text?.trim();
  if (!transcribedText) {
    throw new Error('No transcription result from OpenAI STT');
  }

  logger.info(`[AudioAnalysis] Transcribed: ${transcribedText.slice(0, 100)}...`);

  // Step 2: Analyze transcription with gpt-4.1-nano
  const prompt = mode === 'study' ? STUDY_PROMPT : DEFAULT_PROMPT;

  const completion = await openai.chat.completions.create({
    model: MODEL_SUGGESTION,
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: transcribedText },
    ],
    max_tokens: 1024,
    temperature: 0.3,
  });

  const text = completion.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error('No analysis result from OpenAI');
  }

  logger.info(`[AudioAnalysis] Result: ${text.slice(0, 100)}...`);
  return text;
}
