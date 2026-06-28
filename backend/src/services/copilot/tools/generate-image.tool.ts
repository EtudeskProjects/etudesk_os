/**
 * Generate Image Tool — AI image generation via OpenAI gpt-image-1
 * Generates an image synchronously and returns the URL for display.
 * Factory pattern: injects talentId for credit debit.
 */

import { defineTool } from './tool-helper';
import { MODEL_IMAGE } from '../../ai/models';
import { getImageClient } from '../../ai/provider';
import { recordUsage } from '../../ai/usage.service';
import { z } from 'zod';
import { uploadFile } from '../../storage.service';
import { logger } from '../../../utils';
import { debitWalletForAction } from '../../billing/credit.service';

const openai = getImageClient();

export function createGenerateImageTool(talentId: string) {
  return defineTool({
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
      // Margin guardrail: 'high' (~$0.17) exceeds the 1-credit revenue of an image,
      // so it is downgraded to 'medium' unless explicitly allowed via env.
      const requestedQuality = rawQuality.toLowerCase() as 'low' | 'medium' | 'high';
      const quality: 'low' | 'medium' | 'high' =
        requestedQuality === 'high' && process.env.ALLOW_HIGH_QUALITY_IMAGES !== 'true'
          ? 'medium'
          : requestedQuality;

      // Pre-screen prompt for prohibited content (saves API cost on obvious violations)
      const BLOCKED_PATTERNS = /\b(nude|naked|nsfw|porn|sex|violence|gore|weapon|drug|kill|murder)\b/i;
      if (BLOCKED_PATTERNS.test(prompt)) {
        return { success: false, error: 'Image prompt contains prohibited content.' };
      }

      // Debit credits before generating
      const debitIdempotencyKey = `imggen_${talentId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      try {
        await debitWalletForAction({
          scope: 'TALENT',
          ownerId: talentId,
          actionCode: 'TALENT_IMAGE_GENERATION',
          idempotencyKey: debitIdempotencyKey,
          metadata: { prompt: prompt.slice(0, 200), size, quality },
          createdBy: talentId,
        });
      } catch (debitError: any) {
        if (String(debitError?.message || '').includes('INSUFFICIENT_CREDITS')) {
          return { success: false, error: 'Credits insuffisants pour générer une image. Recharge tes crédits.' };
        }
        throw debitError;
      }

      try {
        const response = await openai.images.generate({
          model: MODEL_IMAGE,
          prompt,
          size,
          quality,
        });

        void recordUsage({
          feature: 'image',
          model: MODEL_IMAGE,
          images: { count: response.data?.length ?? 1, quality },
          scopeTalentId: talentId,
          billedActionCode: 'TALENT_IMAGE_GENERATION',
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
}

// Backward-compatible static export (for contexts without talentId — no debit)
export const generateImageTool = createGenerateImageTool('__static__');
