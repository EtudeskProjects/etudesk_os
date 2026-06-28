import dotenv from 'dotenv';
import { ModerationStatus } from '../types/community-activity.types';
import { recordUsage } from './ai/usage.service';
import { getChatClient } from './ai/provider';
import { MODEL_FAST } from './ai/models';

import { logger } from '../utils';
dotenv.config();

// Category labels in French for user-facing messages
const CATEGORY_LABELS: Record<string, string> = {
    'hate': 'discours haineux',
    'hate/threatening': 'menaces haineuses',
    'harassment': 'harcèlement',
    'harassment/threatening': 'harcèlement menaçant',
    'self-harm': 'automutilation',
    'self-harm/intent': 'intention d\'automutilation',
    'self-harm/instructions': 'instructions d\'automutilation',
    'sexual': 'contenu sexuel',
    'sexual/minors': 'contenu sexuel impliquant des mineurs',
    'violence': 'violence',
    'violence/graphic': 'violence graphique',
};

// Field labels in French for error messages
const FIELD_LABELS: Record<string, string> = {
    'name': 'nom',
    'display_name': 'nom d\'affichage',
    'displayName': 'nom d\'affichage',
    'title': 'titre',
    'description': 'description',
    'bio': 'bio',
    'summary': 'résumé',
    'requirements': 'prérequis',
    'nice_to_have': 'atouts',
    'rules': 'règles',
    'content': 'contenu',
    'notes': 'notes',
    'answers': 'réponses',
};

export interface ModerationResult {
    status: ModerationStatus;
    reason?: string;
    flaggedField?: string;
}

export class AutoModerationService {
    constructor() {
        if (!process.env.AI_API_KEY) {
            logger.warn('AI_API_KEY is not set. Auto-moderation will be disabled (always APPROVED).');
        }
    }

    /**
     * Screen content using a chat classifier.
     * - Timeout: 3 seconds (fails open on timeout)
     */
    async screenContent(content: string): Promise<ModerationResult> {
        if (!process.env.AI_API_KEY) {
            return { status: 'APPROVED' };
        }

        // Skip empty content
        if (!content || content.trim().length === 0) {
            return { status: 'APPROVED' };
        }

        try {
            // Add timeout to prevent long delays (3 seconds max)
            const MODERATION_TIMEOUT_MS = 3000;
            const timeoutPromise = new Promise<ModerationResult>((_, reject) => {
                setTimeout(() => {
                    reject(new Error('Moderation API timeout'));
                }, MODERATION_TIMEOUT_MS);
            });

            const moderationPromise = getChatClient().chat.completions.create({
                model: MODEL_FAST,
                max_tokens: 120,
                messages: [
                    {
                        role: 'system',
                        content: 'Classify user-submitted platform content for safety. Return strict JSON only: {"flagged":boolean,"categories":["hate|harassment|self-harm|sexual|sexual/minors|violence|violence/graphic|other"]}. Flag only clearly harmful, illegal, sexually explicit, hateful, harassing, or graphic violent content.',
                    },
                    { role: 'user', content: content.slice(0, 4000) },
                ],
                response_format: { type: 'json_object' } as any,
            }).then(response => {
                void recordUsage({ feature: 'moderation', model: MODEL_FAST, usage: response.usage });

                const raw = response.choices[0]?.message?.content || '{}';
                const result = JSON.parse(raw);
                if (result.flagged) {
                    const flaggedCategories = Array.isArray(result.categories)
                        ? result.categories.map((category: string) => CATEGORY_LABELS[category] || category)
                        : [];

                    const reason = flaggedCategories.length > 0
                        ? `Contenu inapproprié détecté: ${flaggedCategories.join(', ')}`
                        : 'Contenu inapproprié détecté';

                    logger.info(`[Moderation] FLAGGED: "${content.substring(0, 50)}..." - ${reason}`);

                    return { status: 'FLAGGED' as ModerationStatus, reason };
                }

                return { status: 'APPROVED' as ModerationStatus };
            });

            // Race between moderation and timeout
            const result = await Promise.race([moderationPromise, timeoutPromise]);
            return result;

        } catch (error) {
            // Handle timeout or other errors
            if (error instanceof Error && error.message === 'Moderation API timeout') {
                logger.warn(`[Moderation] Timeout after 3s for content: "${content.substring(0, 50)}..." - Approving content`);
            } else {
                logger.error('[Moderation] Error:', error);
            }
            // Fail open: approve content but log the error
            // In production, you might want to fail closed (PENDING for manual review)
            return { status: 'APPROVED' };
        }
    }

    /**
     * Screen multiple fields at once for efficiency
     * Returns on first flagged field to provide specific feedback
     * 
     * @param fields - Object with field names as keys and content as values
     * @returns ModerationResult with flaggedField if any field is flagged
     */
    async screenMultipleFields(fields: Record<string, string | undefined | null>): Promise<ModerationResult> {
        if (!process.env.AI_API_KEY) {
            return { status: 'APPROVED' };
        }

        // Filter out empty fields
        const fieldsToCheck = Object.entries(fields).filter(
            ([_, value]) => value && typeof value === 'string' && value.trim().length > 0
        );

        if (fieldsToCheck.length === 0) {
            return { status: 'APPROVED' };
        }

        // For efficiency, combine all content and check once first
        const combinedContent = fieldsToCheck.map(([_, value]) => value).join('\n---\n');
        const quickCheck = await this.screenContent(combinedContent);

        // If combined content is approved, all fields are approved
        if (quickCheck.status === 'APPROVED') {
            return { status: 'APPROVED' };
        }

        // If flagged, check each field individually to identify which one
        for (const [fieldName, content] of fieldsToCheck) {
            const result = await this.screenContent(content!);
            if (result.status === 'FLAGGED') {
                const fieldLabel = FIELD_LABELS[fieldName] || fieldName;
                return {
                    status: 'FLAGGED',
                    reason: `Le champ "${fieldLabel}" contient du contenu inapproprié: ${result.reason}`,
                    flaggedField: fieldName,
                };
            }
        }

        // Fallback (shouldn't reach here normally)
        return quickCheck;
    }

    /**
     * Helper to throw an error if content is flagged
     * Use this in routes to simplify moderation checks
     */
    async assertContentApproved(fields: Record<string, string | undefined | null>): Promise<void> {
        const result = await this.screenMultipleFields(fields);
        if (result.status === 'FLAGGED') {
            const error = new Error(result.reason || 'Contenu inapproprié détecté') as Error & { 
                code: string; 
                flaggedField?: string;
            };
            error.code = 'CONTENT_MODERATION_FAILED';
            error.flaggedField = result.flaggedField;
            throw error;
        }
    }
}

export const autoModerationService = new AutoModerationService();
