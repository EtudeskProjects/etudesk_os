/**
 * Generate Image Tool — AI image generation via OpenAI gpt-image-1
 * Generates an image and saves locally for persistent access
 * Replaces DALL-E 3 (deprecated May 2026) with gpt-image-1 (autoregressive, better text rendering)
 */

import { tool } from '@openai/agents';
import { z } from 'zod';
import OpenAI from 'openai';
import { uploadFile } from '../../storage.service';
import { logger } from '../../../utils';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const generateImageTool = tool({
  name: 'generate_image',
  description:
    'Generate an image from a text description. Uses gpt-image-1 to create illustrations, visual diagrams, infographics, and educational visuals. Returns a persistent download URL. Use AFTER explaining a concept, as supplementary visual material.',
  parameters: z.object({
    prompt: z
      .string()
      .describe(
        'Detailed description of the image to generate. Be specific about style, content, colors, and composition. For educational content, describe the concept visually.'
      ),
    size: z
      .enum(['1024x1024', '1536x1024', '1024x1536'])
      .default('1024x1024')
      .describe('Image dimensions: 1024x1024 (square), 1536x1024 (landscape), 1024x1536 (portrait)'),
    quality: z
      .enum(['low', 'medium', 'high'])
      .default('medium')
      .describe('Image quality: low (~$0.01), medium (~$0.04), high (~$0.17). Use medium for most cases.'),
  }),
  execute: async ({ prompt, size, quality }) => {
    try {
      // Generate image via gpt-image-1
      const response = await openai.images.generate({
        model: 'gpt-image-1',
        prompt,
        size,
        quality,
      });

      const imageData = response.data?.[0];
      const b64 = imageData?.b64_json;
      if (!b64) {
        return { success: false, error: 'No image was generated.' };
      }

      // Decode base64 to buffer
      const imageBuffer = Buffer.from(b64, 'base64');
      const timestamp = Date.now();
      const filename = `image-${timestamp}.png`;
      const storagePath = `generated/${filename}`;

      // Save locally for persistent access
      const downloadUrl = await uploadFile(imageBuffer, storagePath, 'image/png');

      logger.info(`[generate_image] Generated image: ${filename} (${imageBuffer.length} bytes)`);

      return {
        success: true,
        downloadUrl,
        filename,
        metadata: {
          generatedAt: new Date().toISOString(),
          sizeBytes: imageBuffer.length,
          dimensions: size,
          quality,
          model: 'gpt-image-1',
        },
      };
    } catch (error: any) {
      logger.error(`[generate_image] Error: ${error.message}`);

      if (error?.code === 'content_policy_violation') {
        return {
          success: false,
          error: 'The requested image cannot be generated due to content policy restrictions.',
        };
      }

      return {
        success: false,
        error: `Image generation error: ${error.message}`,
      };
    }
  },
});
