/**
 * Talents Routes
 * Handles talent profile CRUD operations
 */

import { Router, Response } from 'express';
import { pool } from '../services/database';
import { authMiddleware, optionalAuthMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { validate, updateTalentSchema } from '../middleware/validation.middleware';
import { onTalentProfileUpdate } from '../services/embedding.service';
import { autoModerationService } from '../services/auto-moderation.service';
import { MODEL_SUGGESTION } from '../services/ai/models';
import { getGeminiClient } from '../services/ai/provider';
import { BIO_GEN_SYSTEM_PROMPT } from '../services/ai/prompts/bio-gen.prompt';
import { buildTalentObject, talentObjectToText } from '../services/ai/talent-object';
import { normalizeCountryCode } from '../constants/countries';

import { logger } from '../utils';
// Type for SQL query parameters
type QueryParam = string | number | boolean | null | Date | string[];

const router = Router();

/**
 * GET /api/talents/me/talent-object
 * Get current user's TalentObject (rich profile with skills & documents)
 */
router.get('/me/talent-object', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.talentId) {
      return res.status(404).json({ error: req.t('talents:profileNotFound') });
    }
    const includeHidden = req.query.include_hidden !== 'false';
    const obj = await buildTalentObject(req.talentId, includeHidden);
    if (!obj) {
      return res.status(404).json({ error: req.t('talents:profileNotFound') });
    }
    res.json({ data: obj });
  } catch (error) {
    logger.error('Error fetching talent object:', error);
    res.status(500).json({ error: req.t('talents:fetchObjectError') });
  }
});

/**
 * GET /api/talents/me
 * Get current user's talent profile
 */
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.talentId) {
      return res.status(404).json({ error: req.t('talents:profileNotFound') });
    }

    const result = await pool.query(`
      SELECT t.*,
        (SELECT COUNT(*) FROM talent_skills WHERE talent_id = t.id) as skill_count,
        (SELECT status FROM kyc_verifications WHERE talent_id = t.id ORDER BY created_at DESC LIMIT 1) as kyc_status,
        CASE
          WHEN EXISTS (SELECT 1 FROM kyc_verifications WHERE talent_id = t.id AND status = 'VERIFIED')
          THEN 'VERIFIED'
          ELSE 'UNVERIFIED'
        END as verification_status
      FROM talents t
      WHERE t.id = $1 AND t.deleted_at IS NULL
    `, [req.talentId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: req.t('talents:profileNotFound') });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    logger.error('Error fetching talent profile:', error);
    res.status(500).json({ error: req.t('talents:fetchError') });
  }
});

/**
 * PUT /api/talents/me
 * Update current user's talent profile
 */
router.put('/me', authMiddleware, validate(updateTalentSchema), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.talentId) {
      return res.status(404).json({ error: req.t('talents:profileNotFound') });
    }

    const {
      first_name,
      last_name,
      bio,
      avatar_url,
      phone,
      gender,
      city,
      region,
      country,
      remote_ready,
      willing_to_relocate,
      profile_tags,
      goals,
      sectors,
      learning_preferences,
    } = req.body;

    // Content moderation for user-generated text fields
    try {
      await autoModerationService.assertContentApproved({
        bio,
      });
    } catch (moderationError: any) {
      logger.info(`[Moderation] Talent profile update rejected for ${req.talentId}: ${moderationError.message}`);
      return res.status(400).json({ 
        error: moderationError.message,
        code: 'CONTENT_MODERATION_FAILED',
        field: moderationError.flaggedField,
      });
    }

    // Build dynamic update query
    const updates: string[] = [];
    const params: QueryParam[] = [];
    let paramIndex = 1;

    // Validate and add fields
    if (first_name !== undefined) {
      updates.push(`first_name = $${paramIndex++}`);
      params.push(first_name?.trim() || null);
    }

    if (last_name !== undefined) {
      updates.push(`last_name = $${paramIndex++}`);
      params.push(last_name?.trim() || null);
    }

    if (bio !== undefined) {
      updates.push(`bio = $${paramIndex++}`);
      params.push(bio?.trim() || null);
    }

    if (avatar_url !== undefined) {
      updates.push(`avatar_url = $${paramIndex++}`);
      params.push(avatar_url || null);
    }

    if (phone !== undefined) {
      updates.push(`phone = $${paramIndex++}`);
      params.push(phone?.trim() || null);
    }

    if (gender !== undefined) {
      updates.push(`gender = $${paramIndex++}`);
      params.push(gender || null);
    }

    if (city !== undefined) {
      updates.push(`city = $${paramIndex++}`);
      params.push(city?.trim() || null);
    }

    if (region !== undefined) {
      updates.push(`region = $${paramIndex++}`);
      params.push(region?.trim() || null);
    }

    if (country !== undefined) {
      const countryCode = normalizeCountryCode(country);
      if (country && !countryCode) {
        return res.status(400).json({
          error: req.t('common:countryMustBeIsoCode'),
          provided: country,
        });
      }
      updates.push(`country = $${paramIndex++}`);
      params.push(countryCode);
    }

    if (remote_ready !== undefined) {
      updates.push(`remote_ready = $${paramIndex++}`);
      params.push(!!remote_ready);
    }

    if (willing_to_relocate !== undefined) {
      updates.push(`willing_to_relocate = $${paramIndex++}`);
      params.push(!!willing_to_relocate);
    }

    if (profile_tags !== undefined) {
      updates.push(`profile_tags = $${paramIndex++}`);
      params.push(profile_tags);
    }

    if (sectors !== undefined) {
      updates.push(`sectors = $${paramIndex++}`);
      params.push(sectors);
    }

    if (goals !== undefined) {
      updates.push(`goals = $${paramIndex++}`);
      params.push(goals);
    }

    if (learning_preferences !== undefined) {
      updates.push(`learning_preferences = $${paramIndex++}::jsonb`);
      params.push(JSON.stringify(learning_preferences));
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: req.t('common:noFieldsToUpdate') });
    }

    // Add talent_id to params
    params.push(req.talentId);

    const result = await pool.query(`
      UPDATE talents SET
        ${updates.join(', ')},
        updated_at = NOW()
      WHERE id = $${paramIndex} AND deleted_at IS NULL
      RETURNING *
    `, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: req.t('talents:profileNotFound') });
    }

    // Generate/update embedding for semantic search (async, non-blocking)
    onTalentProfileUpdate(req.talentId).catch(err =>
      logger.error('Failed to update talent embedding:', err)
    );

    res.json({ data: result.rows[0] });
  } catch (error) {
    logger.error('Error updating talent profile:', error);
    res.status(500).json({ error: req.t('talents:updateError') });
  }
});

/**
 * POST /api/talents/generate-bio
 * Generate a bio suggestion based on the user's profile info
 */
router.post('/generate-bio', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    let contextText: string | null = null;

    // If talent exists, use TalentObject
    if (req.talentId) {
      const talentObj = await buildTalentObject(req.talentId, true);
      if (talentObj) contextText = talentObjectToText(talentObj);
    }

    // Fallback: body data (for create-profile before talent exists)
    if (!contextText) {
      const body = req.body || {};
      const parts: string[] = [];
      if (body.first_name || body.last_name) parts.push(`Nom: ${[body.first_name, body.last_name].filter(Boolean).join(' ')}`);
      if (body.profile_tags?.length) parts.push(`Profil: ${body.profile_tags.join(', ')}`);
      if (body.sectors?.length) parts.push(`Secteurs: ${body.sectors.join(', ')}`);
      if (body.goals?.length) parts.push(`Objectifs: ${body.goals.join(', ')}`);
      if (body.country) parts.push(`Localisation: ${[body.city, body.region, body.country].filter(Boolean).join(', ')}`);
      if (parts.length > 0) contextText = parts.join('\n');
    }

    if (!contextText) {
      return res.status(400).json({ error: req.t('common:notEnoughInfoForBio') });
    }

    const openai = getGeminiClient();
    const completion = await openai.chat.completions.create({
      model: MODEL_SUGGESTION,
      messages: [
        { role: 'system', content: BIO_GEN_SYSTEM_PROMPT },
        { role: 'user', content: `Génère une bio pour ce profil :\n${contextText}` },
      ],
    });

    const choice = completion.choices[0];
    const bio = (choice?.message?.content ?? choice?.message?.refusal)?.trim();
    if (!bio) {
      logger.error('Bio generation empty response:', JSON.stringify(choice));
      return res.status(500).json({ error: req.t('common:bioGenerationFailed') });
    }

    res.json({ data: { bio: bio.slice(0, 250) } });
  } catch (error) {
    logger.error('Error generating bio:', error);
    res.status(500).json({ error: req.t('common:bioGenerationError') });
  }
});

/**
 * GET /api/talents/:id
 * Get a specific talent profile (public view)
 */
router.get('/:id', optionalAuthMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const isOwnProfile = req.talentId && (req.talentId === id);

    const skillFilter = isOwnProfile ? '' : 'AND ts.is_visible = true';

    const result = await pool.query(`
      SELECT
        t.id, t.slug, t.first_name, t.last_name,
        COALESCE(t.first_name || ' ' || t.last_name, t.email) as display_name,
        t.email, t.bio, t.avatar_url, t.gender,
        t.city, t.region, t.country,
        t.remote_ready, t.willing_to_relocate,
        t.sectors, t.profile_tags, t.goals, t.created_at,
        COALESCE(
          (SELECT json_agg(json_build_object('name', ts.canonical_name, 'type', ts.type, 'proficiency_level', ts.proficiency_level) ORDER BY ts.proficiency_level DESC, ts.canonical_name ASC)
           FROM talent_skills ts
           WHERE ts.talent_id = t.id ${skillFilter}), '[]'::json
        ) as skills,
        COALESCE(
          (SELECT json_agg(json_build_object('language', tl.language, 'proficiency_level', tl.proficiency_level))
           FROM talent_languages tl
           WHERE tl.talent_id = t.id), '[]'::json
        ) as languages
      FROM talents t
      WHERE (t.id::text = $1 OR t.slug = $1) AND t.deleted_at IS NULL
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: req.t('talents:notFound') });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    logger.error('Error fetching talent:', error);
    res.status(500).json({ error: req.t('talents:fetchError') });
  }
});

export default router;
