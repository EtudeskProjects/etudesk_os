/**
 * Audio Analysis Service — provider STT + chat analysis.
 */

import { logger } from '../../utils';
import { getAIClient } from './provider';
import { MODEL_SUGGESTION, MODEL_STT } from './models';
import { estimateAudioSecondsFromBytes, recordUsage } from './usage.service';
import { transcribeWithProvider } from './media.client';

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
 * Analyze audio: transcribe with provider STT, then analyze with chat.
 * @param audioBase64 - Base64-encoded audio data
 * @param mimeType - Audio MIME type (e.g. 'audio/mp4', 'audio/webm')
 * @param mode - Copilot mode ('study' | 'explore' | 'org')
 * @returns Analysis text to inject into the user message
 */
export async function analyzeAudio(
  audioBase64: string,
  mimeType: string,
  mode: 'study' | 'explore' | 'org',
  usageContext?: { billedActionCode?: string | null; scopeTalentId?: string | null; scopeOrganizationId?: string | null; sessionId?: string | null }
): Promise<string> {
  const aiClient = getAIClient();

  logger.info(`[AudioAnalysis] Analyzing audio (${mimeType}, mode=${mode}) via AI provider`);

  // Step 1: Transcribe with provider STT
  const audioBuffer = Buffer.from(audioBase64, 'base64');
  const normalizedMime = (mimeType || '').toLowerCase();
  let ext: string;
  if (normalizedMime.includes('mp4') || normalizedMime.includes('m4a') || normalizedMime.includes('aac')) {
    ext = 'm4a';
  } else if (normalizedMime.includes('webm')) {
    ext = 'webm';
  } else if (normalizedMime.includes('ogg') || normalizedMime.includes('oga') || normalizedMime.includes('opus')) {
    ext = 'ogg';
  } else if (normalizedMime.includes('mpeg') || normalizedMime.includes('mp3')) {
    ext = 'mp3';
  } else if (normalizedMime.includes('flac')) {
    ext = 'flac';
  } else if (normalizedMime.includes('wav') || normalizedMime.includes('wave') || normalizedMime.includes('x-wav')) {
    ext = 'wav';
  } else {
    logger.warn(`[AudioAnalysis] Unknown mime "${mimeType}", defaulting to m4a`);
    ext = 'm4a';
  }
  const safeMime = ext === 'm4a' ? 'audio/mp4' : ext === 'mp3' ? 'audio/mpeg' : `audio/${ext}`;
  const transcribedText = await transcribeWithProvider({
    buffer: audioBuffer,
    filename: `audio.${ext}`,
    mimeType: safeMime,
  });
  void recordUsage({
    feature: 'audio_stt',
    model: MODEL_STT,
    audioSeconds: estimateAudioSecondsFromBytes(audioBuffer.length, safeMime),
    scopeTalentId: usageContext?.scopeTalentId ?? null,
    scopeOrganizationId: usageContext?.scopeOrganizationId ?? null,
    sessionId: usageContext?.sessionId ?? null,
    billedActionCode: usageContext?.billedActionCode ?? null,
    metadata: { mode, bytes: audioBuffer.length, mimeType: safeMime },
  });
  if (!transcribedText) {
    throw new Error('No transcription result from AI provider STT');
  }

  logger.info(`[AudioAnalysis] Transcribed: ${transcribedText.slice(0, 100)}...`);

  // Step 2: Analyze transcription
  const prompt = mode === 'study' ? STUDY_PROMPT : DEFAULT_PROMPT;

  const completion = await aiClient.chat.completions.create({
    model: MODEL_SUGGESTION,
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: transcribedText },
    ],
    max_completion_tokens: 1024,
  });

  void recordUsage({
    feature: 'audio_analysis',
    model: MODEL_SUGGESTION,
    usage: completion.usage,
    scopeTalentId: usageContext?.scopeTalentId ?? null,
    scopeOrganizationId: usageContext?.scopeOrganizationId ?? null,
    sessionId: usageContext?.sessionId ?? null,
    billedActionCode: usageContext?.billedActionCode ?? null,
  });

  const text = completion.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error('No analysis result from AI provider');
  }

  logger.info(`[AudioAnalysis] Result: ${text.slice(0, 100)}...`);
  return text;
}
