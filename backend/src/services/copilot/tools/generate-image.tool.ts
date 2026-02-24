/**
 * Generate Image Tool — AI image generation via OpenAI gpt-image-1
 * Generates an image synchronously and returns the URL for display.
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
    'Generate an image from a text description. This tool takes ~20-60s to complete. After calling it, output the result as an image block: ```image\n{"url":"<returned_url>","alt":"<description>","caption":"<caption>"}\n```. Use AFTER explaining a concept, as supplementary visual material.',
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
    const size = rawSize.toLowerCase() as '1024x1024' | '1536x1024' | '1024x1536';
    const quality = rawQuality.toLowerCase() as 'low' | 'medium' | 'high';

    try {
      const response = await openai.images.generate({
        model: MODEL_IMAGE,
        prompt,
        size,
        quality,
      });

      const imageData = response.data?.[0];
      const b64 = imageData?.b64_json;
      if (!b64) {
        return { success: false, error: 'No image data returned' };
      }

      const imageBuffer = Buffer.from(b64, 'base64');
      const filename = `image-${Date.now()}.png`;
      const storagePath = `generated/${filename}`;

      const url = await uploadFile(imageBuffer, storagePath, 'image/png');
      logger.info(`[generate_image] Completed: ${filename} (${imageBuffer.length} bytes)`);

      return {
        success: true,
        url,
        alt: prompt.slice(0, 120),
        caption: `Generated image`,
      };
    } catch (err: any) {
      logger.error(`[generate_image] Failed: ${err.message}`);
      return { success: false, error: err.message };
    }
  },
});
