/**
 * Onboarding Routes
 *
 * Handles talent profile creation after authentication
 */

import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool, generateSlug } from '../services/database';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { generateTokens } from '../services/auth.service';
import { sendWelcomeEmail } from '../services/email.service';
import { onTalentProfileUpdate } from '../services/embedding.service';
import { autoModerationService } from '../services/auto-moderation.service';

import { logger } from '../utils';
const router = Router();

// Valid profile tags
const VALID_PROFILE_TAGS = [
  'STUDENT', 'PUPIL', 'JOB_SEEKER', 'SALARIED', 'ENTREPRENEUR',
  'CIVIL_SERVANT', 'MANAGER', 'CONSULTANT', 'INVESTOR',
  'CONTENT_CREATOR', 'COACH', 'RETIRED',
];

// Valid goals
const VALID_GOALS = [
  'LEARN_NEW_SKILLS', 'PREPARE_EXAMS', 'FIND_JOB', 'ADVANCE_CAREER',
  'RESEARCH_SUPPORT', 'IMPROVE_PRODUCTIVITY', 'COLLABORATIVE_LEARNING',
  'TEACH_OR_MENTOR', 'BUILD_NETWORK_OR_VISIBILITY', 'CONTRIBUTE_OR_GIVE_BACK',
];

interface OnboardingData {
  firstName?: string;
  lastName?: string;
  bio?: string;
  city?: string;
  region?: string;
  country?: string;
  profileTags?: string[];
  goals?: string[];
  sectors?: string[];
  remoteReady?: boolean;
  willingToRelocate?: boolean;
  phone: string;
  gender?: string;
}

/**
 * POST /onboarding/complete
 *
 * Create talent profile and link to user
 */
router.post('/complete', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const data: OnboardingData = req.body;

    // Validate required fields - firstName is now required
    if (!data.firstName || typeof data.firstName !== 'string' || data.firstName.trim().length < 1) {
      return res.status(400).json({
        success: false,
        error: req.t('validation:talent.firstNameRequired'),
        field: 'firstName',
      });
    }

    // Validate profile tags
    if (data.profileTags) {
      if (!Array.isArray(data.profileTags)) {
        return res.status(400).json({
          success: false,
          error: req.t('onboarding:profileTagsMustBeArray'),
          field: 'profileTags',
        });
      }

      for (const tag of data.profileTags) {
        if (!VALID_PROFILE_TAGS.includes(tag)) {
          return res.status(400).json({
            success: false,
            error: req.t('onboarding:invalidTag', { tag }),
            field: 'profileTags',
            validTags: VALID_PROFILE_TAGS,
          });
        }
      }
    }

    // Validate goals (max 3)
    if (data.goals) {
      if (!Array.isArray(data.goals)) {
        return res.status(400).json({
          success: false,
          error: req.t('onboarding:goalsMustBeArray'),
          field: 'goals',
        });
      }

      if (data.goals.length > 3) {
        return res.status(400).json({
          success: false,
          error: req.t('onboarding:goalsMaximum'),
          field: 'goals',
        });
      }

      for (const goal of data.goals) {
        if (!VALID_GOALS.includes(goal)) {
          return res.status(400).json({
            success: false,
            error: req.t('onboarding:invalidGoal', { goal }),
            field: 'goals',
            validGoals: VALID_GOALS,
          });
        }
      }
    }

    // Validate phone (required, min 8 chars)
    if (!data.phone || data.phone.trim().length < 8) {
      return res.status(400).json({
        success: false,
        error: req.t('onboarding:phoneMinLength'),
        field: 'phone',
      });
    }

    // Validate country code
    if (data.country && data.country.length !== 2) {
      return res.status(400).json({
        success: false,
        error: req.t('onboarding:countryCodeInvalid'),
        field: 'country',
      });
    }

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
        return res.status(404).json({
          success: false,
          error: req.t('auth:userNotFound'),
        });
      }

      const user = userResult.rows[0];

      if (user.talent_id) {
        return res.status(400).json({
          success: false,
          error: req.t('onboarding:talentProfileExists'),
          talentId: user.talent_id,
        });
      }

      // Check if phone number is already used by another talent
      const phoneCheckResult = await client.query(
        `SELECT id FROM talents WHERE phone = $1 AND deleted_at IS NULL`,
        [data.phone.trim()]
      );

      if (phoneCheckResult.rows.length > 0) {
        return res.status(400).json({
          success: false,
          error: req.t('onboarding:phoneAlreadyUsed'),
          field: 'phone',
        });
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

      // Try to insert with all columns, fallback to basic columns if some don't exist
      try {
        await client.query(
          `INSERT INTO talents (
            id, slug, first_name, last_name, bio, email, phone,
            city, region, country, remote_ready, willing_to_relocate,
            profile_tags, goals, sectors, gender, created_at, updated_at
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
            user.email,
            data.phone.trim(),
            data.city?.trim() || null,
            data.region?.trim() || null,
            data.country?.toUpperCase() || null,
            data.remoteReady || false,
            data.willingToRelocate || false,
            data.profileTags || [],
            data.goals || [],
            data.sectors || [],
            data.gender || null,
          ]
        );
      } catch (insertError: any) {
        // If columns don't exist, try without them
        if (insertError.message?.includes('column') && insertError.message?.includes('does not exist')) {
          await client.query(
            `INSERT INTO talents (
              id, slug, first_name, last_name, bio, email, phone,
              city, region, country, remote_ready, willing_to_relocate,
              profile_tags, goals, gender, created_at, updated_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7,
              $8, $9, $10, $11, $12,
              $13, $14, $15, NOW(), NOW()
            )`,
            [
              talentId,
              finalSlug,
              data.firstName?.trim() || null,
              data.lastName?.trim() || null,
              data.bio?.trim() || null,
              user.email,
              data.phone.trim(),
              data.city?.trim() || null,
              data.region?.trim() || null,
              data.country?.toUpperCase() || null,
              data.remoteReady || false,
              data.willingToRelocate || false,
              data.profileTags || [],
              data.goals || [],
              data.gender || null,
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

      await client.query('COMMIT');

      // Send welcome email (async, don't wait)
      const fullName = [data.firstName, data.lastName].filter(Boolean).join(' ') || user.email;
      sendWelcomeEmail(user.email, fullName).catch(err => {
        logger.error('❌ Failed to send welcome email:', err);
      });

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
            email: user.email,
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
