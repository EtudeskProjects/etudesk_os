/**
 * Onboarding Routes
 *
 * Handles talent profile creation after authentication
 */

import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool, generateSlug } from '../services/database';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { validate, onboardingSchema } from '../middleware/validation.middleware';
import { generateTokens } from '../services/auth.service';
import { sendWelcomeEmail } from '../services/email.service';
import { onTalentProfileUpdate } from '../services/embedding.service';
import { autoModerationService } from '../services/auto-moderation.service';
import { creditWallet } from '../services/billing/credit.service';

import { logger } from '../utils';
const router = Router();

// Valid profile tags (used by GET /options)
const VALID_PROFILE_TAGS = [
  'STUDENT', 'PUPIL', 'JOB_SEEKER', 'SALARIED', 'ENTREPRENEUR',
  'CIVIL_SERVANT', 'MANAGER', 'CONSULTANT', 'INVESTOR',
  'CONTENT_CREATOR', 'COACH', 'RETIRED',
];

// Valid goals (used by GET /options)
const VALID_GOALS = [
  'LEARN_NEW_SKILLS', 'PREPARE_EXAMS', 'FIND_JOB', 'ADVANCE_CAREER',
  'RESEARCH_SUPPORT', 'IMPROVE_PRODUCTIVITY', 'COLLABORATIVE_LEARNING',
  'TEACH_OR_MENTOR', 'BUILD_NETWORK_OR_VISIBILITY', 'CONTRIBUTE_OR_GIVE_BACK',
];

/**
 * POST /onboarding/complete
 *
 * Create talent profile and link to user
 */
router.post('/complete', authMiddleware, validate(onboardingSchema), async (req: AuthRequest, res: Response) => {
  try {
    const data = req.body;

    // Content moderation for user-generated text fields
    try {
      await autoModerationService.assertContentApproved({
        bio: data.bio,
      });
    } catch (moderationError: any) {
      logger.info(`[Moderation] Onboarding rejected: ${moderationError.message}`);
      return res.status(400).json({
        success: false,
        error: moderationError.message,
        code: 'CONTENT_MODERATION_FAILED',
        field: moderationError.flaggedField,
      });
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Check if user already has a talent profile
      const userResult = await client.query(
        `SELECT talent_id, email FROM users WHERE id = $1 AND deleted_at IS NULL`,
        [req.userId]
      );

      if (userResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          error: req.t('auth:userNotFound'),
        });
      }

      const user = userResult.rows[0];

      // Don't propagate placeholder emails (wa_XXX@etudesk.local) to talent profile
      const isPlaceholderEmail = user.email?.endsWith('@etudesk.local');
      const talentEmail = isPlaceholderEmail ? null : user.email;

      if (user.talent_id) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: req.t('onboarding:talentProfileExists'),
          talentId: user.talent_id,
        });
      }

      // Check if email is already used by another talent
      const finalEmailCheck = data.email?.trim() || talentEmail;
      if (finalEmailCheck) {
        const emailCheckResult = await client.query(
          `SELECT id FROM talents WHERE email = $1 AND deleted_at IS NULL`,
          [finalEmailCheck]
        );

        if (emailCheckResult.rows.length > 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            error: req.t('onboarding:emailAlreadyUsed'),
            field: 'email',
          });
        }
      }

      // Check if phone number is already used by another talent (only if phone provided)
      if (data.phone?.trim()) {
        const phoneCheckResult = await client.query(
          `SELECT id FROM talents WHERE phone = $1 AND deleted_at IS NULL`,
          [data.phone.trim()]
        );

        if (phoneCheckResult.rows.length > 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            error: req.t('onboarding:phoneAlreadyUsed'),
            field: 'phone',
          });
        }
      }

      // Generate unique slug
      const displayNameForSlug = [data.firstName, data.lastName].filter(Boolean).join(' ') || 'talent';
      let slug = generateSlug(displayNameForSlug);
      let slugSuffix = 1;
      let finalSlug = slug;

      // Check for slug uniqueness
      while (true) {
        const existingSlug = await client.query(
          `SELECT id FROM talents WHERE slug = $1`,
          [finalSlug]
        );

        if (existingSlug.rows.length === 0) {
          break;
        }

        finalSlug = `${slug}-${slugSuffix}`;
        slugSuffix++;
      }

      // Create talent profile
      const talentId = uuidv4();

      // If user provided a real email during onboarding, use it (overrides placeholder)
      const finalEmail = data.email?.trim() || talentEmail;
      const finalPhone = data.phone?.trim() || null;

      // DB constraint: at least one of email or phone is required
      if (!finalEmail && !finalPhone) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: req.t('onboarding:emailOrPhoneRequired'),
          code: 'EMAIL_OR_PHONE_REQUIRED',
        });
      }

      // Try to insert with all columns, fallback to basic columns if some don't exist
      try {
        await client.query(
          `INSERT INTO talents (
            id, slug, first_name, last_name, bio, email, phone,
            city, region, country, remote_ready, willing_to_relocate,
            profile_tags, goals, sectors, gender, avatar_url, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7,
            $8, $9, $10, $11, $12,
            $13, $14, $15, $16, $17, NOW(), NOW()
          )`,
          [
            talentId,
            finalSlug,
            data.firstName?.trim() || null,
            data.lastName?.trim() || null,
            data.bio?.trim() || null,
            finalEmail,
            data.phone?.trim() || null,
            data.city?.trim() || null,
            data.region?.trim() || null,
            data.country?.toUpperCase() || null,
            data.remoteReady || false,
            data.willingToRelocate || false,
            data.profileTags || [],
            data.goals || [],
            data.sectors || [],
            data.gender || null,
            data.avatarUrl?.trim() || null,
          ]
        );
      } catch (insertError: any) {
        // If columns don't exist, try without them
        if (insertError.message?.includes('column') && insertError.message?.includes('does not exist')) {
          await client.query(
            `INSERT INTO talents (
              id, slug, first_name, last_name, bio, email, phone,
              city, region, country, remote_ready, willing_to_relocate,
              profile_tags, goals, gender, avatar_url, created_at, updated_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7,
              $8, $9, $10, $11, $12,
              $13, $14, $15, $16, NOW(), NOW()
            )`,
            [
              talentId,
              finalSlug,
              data.firstName?.trim() || null,
              data.lastName?.trim() || null,
              data.bio?.trim() || null,
              finalEmail,
              data.phone?.trim() || null,
              data.city?.trim() || null,
              data.region?.trim() || null,
              data.country?.toUpperCase() || null,
              data.remoteReady || false,
              data.willingToRelocate || false,
              data.profileTags || [],
              data.goals || [],
              data.gender || null,
              data.avatarUrl?.trim() || null,
            ]
          );
        } else {
          throw insertError;
        }
      }

      // Link talent to user
      await client.query(
        `UPDATE users SET talent_id = $1, updated_at = NOW() WHERE id = $2`,
        [talentId, req.userId]
      );

      // Grant 20 welcome credits
      await creditWallet({
        scope: 'TALENT',
        ownerId: talentId,
        credits: 20,
        sourceType: 'ADJUSTMENT',
        idempotencyKey: `welcome_bonus_talent_${talentId}`,
        metadata: { reason: 'welcome_bonus' },
      }, client);

      await client.query('COMMIT');

      // Send welcome email (async, don't wait) — skip for WhatsApp-only users
      const fullName = [data.firstName, data.lastName].filter(Boolean).join(' ') || 'Talent';
      if (finalEmail) {
        sendWelcomeEmail(finalEmail, fullName).catch(err => {
          logger.error('❌ Failed to send welcome email:', err);
        });
      }

      // Generate embedding for semantic search (async, don't wait)
      onTalentProfileUpdate(talentId).catch(err => {
        logger.error('❌ Failed to generate talent embedding:', err);
      });

      // Generate new tokens with talent_id
      const tokens = generateTokens(req.userId!, user.email, talentId);

      return res.status(201).json({
        data: {
          talent: {
            id: talentId,
            slug: finalSlug,
            displayName: fullName,
            email: finalEmail || null,
          },
          tokens: {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresIn: tokens.expiresIn,
          },
        },
        message: req.t('onboarding:profileCreated'),
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error: any) {
    logger.error('❌ Onboarding error:', error);
    return res.status(500).json({
      success: false,
      error: req.t('onboarding:profileCreationFailed'),
      details: error?.message || 'Unknown error',
      code: error?.code || null,
    });
  }
});

/**
 * GET /onboarding/status
 *
 * Check onboarding status for current user
 */
router.get('/status', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT
        u.id,
        u.email,
        u.talent_id,
        COALESCE(t.first_name || ' ' || t.last_name, t.email) as display_name,
        t.slug
       FROM users u
       LEFT JOIN talents t ON u.talent_id = t.id
       WHERE u.id = $1 AND u.deleted_at IS NULL`,
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: req.t('auth:userNotFound'),
      });
    }

    const user = result.rows[0];
    const isComplete = !!user.talent_id;

    return res.json({
      data: {
        onboarding: {
          isComplete,
          email: user.email,
          talent: isComplete ? {
            id: user.talent_id,
            slug: user.slug,
            displayName: user.display_name, // computed from SQL COALESCE
          } : null,
        },
      },
    });
  } catch (error) {
    logger.error('❌ Get onboarding status error:', error);
    return res.status(500).json({
      success: false,
      error: req.t('common:serverError'),
    });
  }
});

/**
 * GET /onboarding/options
 *
 * Get available options for onboarding form
 */
router.get('/options', async (req, res) => {
  return res.json({
    data: {
      options: {
        profileTags: VALID_PROFILE_TAGS.map(tag => ({
          value: tag,
          label: req.t(`onboarding:profileTags.${tag}`),
        })),
        goals: VALID_GOALS.map(goal => ({
          value: goal,
          label: req.t(`onboarding:goals.${goal}`),
        })),
      },
    },
  });
});

export default router;
