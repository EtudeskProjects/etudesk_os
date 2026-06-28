/**
 * TTS Service — Text-to-Speech via provider inference.
 * Generates MP3 audio from text for study mode responses.
 * Voice/instructions are passed through best-effort; model support varies.
 */

import { MODEL_TTS } from './models';
import { recordUsage } from './usage.service';
import { logger } from '../../utils';
import { textToSpeechWithProvider } from './media.client';

const MAX_WORDS = 150; // ~1 min of audio

type TTSVoice = string;

/**
 * Default voice instructions for UEMOA French educational context.
 * Structured per OpenAI best practices: Voice Affect → Tone → Pacing → Emotion → Pronunciation.
 */
const DEFAULT_INSTRUCTIONS = `Voice Affect: Warm, clear, and gently encouraging — like a trusted mentor.
Tone: Patient, supportive, and natural — never robotic or condescending.
Pacing: Moderate and steady. Slow down slightly on key terms, corrections, and new vocabulary.
Emotion: Friendly and positive. Celebrate small wins. Be empathetic on errors.
Pronunciation: Speak standard French clearly. When pronouncing proper nouns, technical terms, or English loanwords, articulate them distinctly.
Language: French is the primary language. If the text contains English technical terms, pronounce them with a natural French-English blend.`;

/**
 * Generate TTS audio from text.
 * @param text - The text to convert to speech
 * @param voice - TTS voice hint. The selected model may ignore unsupported voices.
 * @param instructions - Style instructions for voice control (uses UEMOA-optimized default)
 * @returns Buffer containing MP3 audio data
 */
export async function generateTTS(
  text: string,
  voice: TTSVoice = 'coral',
  instructions?: string
): Promise<Buffer> {
  // Truncate to ~150 words (~1 min audio)
  const words = text.split(/\s+/);
  const truncated = words.length > MAX_WORDS
    ? words.slice(0, MAX_WORDS).join(' ') + '...'
    : text;

  const finalInstructions = instructions || DEFAULT_INSTRUCTIONS;

  logger.info(`[TTS] Generating audio: ${truncated.length} chars, voice=${voice}`);

  const buffer = await textToSpeechWithProvider({
    text: truncated,
    voice,
    instructions: finalInstructions,
  });

  void recordUsage({ feature: 'tts', model: MODEL_TTS, usage: null, metadata: { chars: truncated.length, bytes: buffer.length, voice } });

  logger.info(`[TTS] Generated ${buffer.length} bytes MP3`);
  return buffer;
}
