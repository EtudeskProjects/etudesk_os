import { MODEL_STT, MODEL_TTS } from './models';

const AI_API_KEY = process.env.AI_API_KEY || '';
const AI_INFERENCE_BASE_URL = process.env.AI_INFERENCE_BASE_URL || '';

function inferenceUrl(model: string): string {
  return `${AI_INFERENCE_BASE_URL}/${model}`;
}

async function providerFetch(model: string, init: RequestInit): Promise<Response> {
  if (!AI_API_KEY || !AI_INFERENCE_BASE_URL) throw new Error('AI_API_KEY or AI_INFERENCE_BASE_URL not configured');
  const response = await fetch(inferenceUrl(model), {
    ...init,
    headers: {
      Authorization: `Bearer ${AI_API_KEY}`,
      ...(init.headers || {}),
    },
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`AI provider ${model} failed (${response.status}): ${body.slice(0, 500)}`);
  }
  return response;
}

export async function transcribeWithProvider(params: {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  language?: string;
}): Promise<string> {
  const form = new FormData();
  form.append('audio', new Blob([params.buffer], { type: params.mimeType }), params.filename);
  form.append('file', new Blob([params.buffer], { type: params.mimeType }), params.filename);
  if (params.language) form.append('language', params.language);

  const response = await providerFetch(MODEL_STT, { method: 'POST', body: form });
  const data: any = await response.json();
  const text = data.text || data.transcription || data.result || data.segments?.map((s: any) => s.text).join(' ');
  if (!text?.trim()) throw new Error('AI provider STT returned an empty transcription');
  return text.trim();
}

export async function textToSpeechWithProvider(params: {
  text: string;
  voice?: string;
  instructions?: string;
}): Promise<Buffer> {
  const response = await providerFetch(MODEL_TTS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: params.text,
      input: params.text,
      voice: params.voice,
      instructions: params.instructions,
      response_format: 'mp3',
    }),
  });

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data: any = await response.json();
    const b64 = data.audio || data.audio_base64 || data.output || data.data;
    if (typeof b64 === 'string') return Buffer.from(b64.replace(/^data:audio\/\w+;base64,/, ''), 'base64');
    throw new Error('AI provider TTS returned JSON without audio payload');
  }

  return Buffer.from(await response.arrayBuffer());
}
