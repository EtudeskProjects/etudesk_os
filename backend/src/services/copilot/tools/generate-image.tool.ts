/**
 * Generate Image Tool — AI image generation via OpenAI gpt-image-1
 * Generates an image and saves locally for persistent access.
 * Made asynchronous to prevent blocking the agent loop.
 */

import { defineTool } from './tool-helper';
import { MODEL_IMAGE } from '../../ai/models';
import { getImageClient } from '../../ai/provider';
import { z } from 'zod';
import { uploadFile } from '../../storage.service';
import { logger } from '../../../utils';

const openai = getImageClient();

export const generateImageTool = defineTool({
  name: 'generate_image',
  description:
    'Generate an image from a text description. The generation is slow (60s), so this tool responds immediately with status "processing" and a job_id. You MUST output a placeholder image block using this job_id: ```image\n{"id":"job_id_here","status":"processing"}\n```. Use AFTER explaining a concept, as supplementary visual material.',
  parameters: z.object({
    prompt: z
      .string()
      .describe(
        'Detailed description of the image to generate. Be specific about style, content, colors, and composition. For educational content, describe the concept visually.'
      ),
    size: z
      .string()
      .default('1024x1024')
      .describe('Image dimensions: 1024x1024 (square), 1536x1024 (landscape), 1024x1536 (portrait)'),
    quality: z
      .string()
      .default('medium')
      .describe('Image quality: low (~$0.01), medium (~$0.04), high (~$0.17). Use medium for most cases.'),
  }),
  normalize: (raw) => {
    // Handle aliases: description → prompt, dimensions → size
    return {
      ...raw,
      prompt: raw.prompt || raw.description || raw.text || '',
      size: raw.size || raw.dimensions || raw.resolution || '1024x1024',
      quality: raw.quality || raw.level || 'medium',
    };
  },
  execute: async ({ prompt, size: rawSize, quality: rawQuality }) => {
    const jobId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const size = rawSize.toLowerCase() as '1024x1024' | '1536x1024' | '1024x1536';
    const quality = rawQuality.toLowerCase() as 'low' | 'medium' | 'high';

    // Background execution
    (async () => {
      try {
        const response = await openai.images.generate({
          model: MODEL_IMAGE,
          prompt,
          size,
          quality,
        });

        const imageData = response.data?.[0];
        const b64 = imageData?.b64_json;
        if (!b64) return;

        const imageBuffer = Buffer.from(b64, 'base64');
        const filename = `image-${Date.now()}.png`;
        const storagePath = `generated/${filename}`;

        await uploadFile(imageBuffer, storagePath, 'image/png');
        logger.info(`[generate_image] Background job ${jobId} completed: ${filename} (${imageBuffer.length} bytes)`);
      } catch (err: any) {
        logger.error(`[generate_image] Background job ${jobId} failed: ${err.message}`);
      }
    })();

    // Immediate return
    return {
      success: true,
      status: 'processing',
      job_id: jobId,
      message: 'Image generation is processing in the background. Please output the image block placeholder.',
    };
  },
});
