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
  'TEACH_OR_MENTOR',
];

interface OnboardingData {
  displayName: string;
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
  phone?: string;
}

/**
 * POST /onboarding/complete
 *
 * Create talent profile and link to user
 */
router.post('/complete', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const data: OnboardingData = req.body;

    // Validate required fields
    if (!data.displayName || typeof data.displayName !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Nom d\'affichage requis',
        field: 'displayName',
      });
    }

    if (data.displayName.length < 2 || data.displayName.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Le nom doit contenir entre 2 et 100 caractères',
        field: 'displayName',
      });
    }

    // Validate profile tags
    if (data.profileTags) {
      if (!Array.isArray(data.profileTags)) {
        return res.status(400).json({
          success: false,
          error: 'profileTags doit être un tableau',
          field: 'profileTags',
        });
      }

      for (const tag of data.profileTags) {
        if (!VALID_PROFILE_TAGS.includes(tag)) {
          return res.status(400).json({
            success: false,
            error: `Tag invalide: ${tag}`,
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
          error: 'goals doit être un tableau',
          field: 'goals',
        });
      }

      if (data.goals.length > 3) {
        return res.status(400).json({
          success: false,
          error: 'Maximum 3 objectifs autorisés',
          field: 'goals',
        });
      }

      for (const goal of data.goals) {
        if (!VALID_GOALS.includes(goal)) {
          return res.status(400).json({
            success: false,
            error: `Objectif invalide: ${goal}`,
            field: 'goals',
            validGoals: VALID_GOALS,
          });
        }
      }
    }

    // Validate country code
    if (data.country && data.country.length !== 2) {
      return res.status(400).json({
        success: false,
        error: 'Le code pays doit être au format ISO 3166-1 alpha-2 (ex: CI, FR, SN)',
        field: 'country',
      });
    }

    // Content moderation for user-generated text fields
    try {
      await autoModerationService.assertContentApproved({
        displayName: data.displayName,
        bio: data.bio,
      });
    } catch (moderationError: any) {
      console.log(`[Moderation] Onboarding rejected: ${moderationError.message}`);
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
          error: 'Utilisateur non trouvé',
        });
      }

      const user = userResult.rows[0];

      if (user.talent_id) {
        return res.status(400).json({
          success: false,
          error: 'Un profil talent existe déjà pour cet utilisateur',
          talentId: user.talent_id,
        });
      }

      // Generate unique slug
      let slug = generateSlug(data.displayName);
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
            id, slug, display_name, first_name, last_name, bio, email, phone,
            city, region, country, remote_ready, willing_to_relocate,
            profile_tags, goals, sectors, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8,
            $9, $10, $11, $12, $13,
            $14, $15, $16, NOW(), NOW()
          )`,
          [
            talentId,
            finalSlug,
            data.displayName.trim(),
            data.firstName?.trim() || null,
            data.lastName?.trim() || null,
            data.bio?.trim() || null,
            user.email,
            data.phone?.trim() || null,
            data.city?.trim() || null,
            data.region?.trim() || null,
            data.country?.toUpperCase() || null,
            data.remoteReady || false,
            data.willingToRelocate || false,
            data.profileTags || [],
            data.goals || [],
            data.sectors || [],
          ]
        );
      } catch (insertError: any) {
        // If columns don't exist, try without them
        if (insertError.message?.includes('column') && insertError.message?.includes('does not exist')) {
          console.log('⚠️ Some columns missing, using fallback INSERT');
          await client.query(
            `INSERT INTO talents (
              id, slug, display_name, bio, email, phone,
              city, region, country, remote_ready, willing_to_relocate,
              profile_tags, goals, created_at, updated_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6,
              $7, $8, $9, $10, $11,
              $12, $13, NOW(), NOW()
            )`,
            [
              talentId,
              finalSlug,
              data.displayName.trim(),
              data.bio?.trim() || null,
              user.email,
              data.phone?.trim() || null,
              data.city?.trim() || null,
              data.region?.trim() || null,
              data.country?.toUpperCase() || null,
              data.remoteReady || false,
              data.willingToRelocate || false,
              data.profileTags || [],
              data.goals || [],
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
      sendWelcomeEmail(user.email, data.displayName).catch(err => {
        console.error('❌ Failed to send welcome email:', err);
      });

      // Generate embedding for semantic search (async, don't wait)
      onTalentProfileUpdate(talentId).catch(err => {
        console.error('❌ Failed to generate talent embedding:', err);
      });

      // Generate new tokens with talent_id
      const tokens = generateTokens(req.userId!, user.email, talentId);

      console.log(`✅ Onboarding completed for ${user.email} (talentId: ${talentId})`);

      return res.status(201).json({
        data: {
          talent: {
            id: talentId,
            slug: finalSlug,
            displayName: data.displayName,
            email: user.email,
          },
          tokens: {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresIn: tokens.expiresIn,
          },
        },
        message: 'Profil créé avec succès',
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('❌ Onboarding error:', error);
    return res.status(500).json({
      success: false,
      error: 'Erreur lors de la création du profil',
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
        t.display_name,
        t.slug
       FROM users u
       LEFT JOIN talents t ON u.talent_id = t.id
       WHERE u.id = $1 AND u.deleted_at IS NULL`,
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utilisateur non trouvé',
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
            displayName: user.display_name,
          } : null,
        },
      },
    });
  } catch (error) {
    console.error('❌ Get onboarding status error:', error);
    return res.status(500).json({
      success: false,
      error: 'Erreur serveur',
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
          label: getProfileTagLabel(tag),
        })),
        goals: VALID_GOALS.map(goal => ({
          value: goal,
          label: getGoalLabel(goal),
        })),
      },
    },
  });
});

/**
 * Helper: Get profile tag label in French
 */
function getProfileTagLabel(tag: string): string {
  const labels: Record<string, string> = {
    STUDENT: 'Étudiant(e)',
    PUPIL: 'Élève',
    JOB_SEEKER: 'En recherche d\'emploi',
    SALARIED: 'Salarié(e)',
    ENTREPRENEUR: 'Entrepreneur(e)',
    CIVIL_SERVANT: 'Fonctionnaire',
    MANAGER: 'Manager',
    CONSULTANT: 'Consultant(e)',
    INVESTOR: 'Investisseur',
    CONTENT_CREATOR: 'Créateur de contenu',
    COACH: 'Coach / Formateur',
    RETIRED: 'Retraité(e)',
  };
  return labels[tag] || tag;
}

/**
 * Helper: Get goal label in French
 */
function getGoalLabel(goal: string): string {
  const labels: Record<string, string> = {
    LEARN_NEW_SKILLS: 'Apprendre de nouvelles compétences',
    PREPARE_EXAMS: 'Préparer des examens',
    FIND_JOB: 'Trouver un emploi',
    ADVANCE_CAREER: 'Faire avancer ma carrière',
    RESEARCH_SUPPORT: 'Support à la recherche',
    IMPROVE_PRODUCTIVITY: 'Améliorer ma productivité',
    COLLABORATIVE_LEARNING: 'Apprentissage collaboratif',
    TEACH_OR_MENTOR: 'Enseigner ou mentorer',
  };
  return labels[goal] || goal;
}

export default router;
