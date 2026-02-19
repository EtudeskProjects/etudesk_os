/**
 * TTS Service — Text-to-Speech via OpenAI
 * Generates MP3 audio from text for study mode responses.
 * Uses gpt-4o-mini-tts for natural voice output.
 */

import { getOpenAIClient } from './provider';
import { MODEL_TTS } from './models';
import { logger } from '../../utils';

const MAX_WORDS = 150; // ~1 min of audio

type TTSVoice = 'alloy' | 'ash' | 'coral' | 'echo' | 'fable' | 'nova' | 'onyx' | 'sage' | 'shimmer';

/**
 * Generate TTS audio from text.
 * @param text - The text to convert to speech
 * @param voice - OpenAI TTS voice (default: nova — natural, works well for French)
 * @param instructions - Style instructions (e.g. "Parle lentement et clairement")
 * @returns Buffer containing MP3 audio data
 */
export async function generateTTS(
  text: string,
  voice: TTSVoice = 'nova',
  instructions?: string
): Promise<Buffer> {
  const openai = getOpenAIClient();

  // Truncate to ~150 words (~1 min audio)
  const words = text.split(/\s+/);
  const truncated = words.length > MAX_WORDS
    ? words.slice(0, MAX_WORDS).join(' ') + '...'
    : text;

  logger.info(`[TTS] Generating audio: ${truncated.length} chars, voice=${voice}`);

  const response = await openai.audio.speech.create({
    model: MODEL_TTS,
    voice,
    input: truncated,
    response_format: 'mp3',
    ...(instructions ? { instructions } : {}),
  } as any);

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  logger.info(`[TTS] Generated ${buffer.length} bytes MP3`);
  return buffer;
}
