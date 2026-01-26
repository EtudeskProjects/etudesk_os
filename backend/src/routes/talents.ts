/**
 * Talents Routes
 * Handles talent profile CRUD operations
 */

import { Router, Response } from 'express';
import { pool } from '../services/database';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { onTalentProfileUpdate } from '../services/embedding.service';
import { autoModerationService } from '../services/auto-moderation.service';

// Type for SQL query parameters
type QueryParam = string | number | boolean | null | Date | string[];

const router = Router();

/**
 * GET /api/talents/me
 * Get current user's talent profile
 */
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.talentId) {
      return res.status(404).json({ error: 'Talent profile not found' });
    }

    const result = await pool.query(`
      SELECT t.*,
        (SELECT COUNT(*) FROM talent_skills WHERE talent_id = t.id) as skill_count,
        (SELECT COUNT(*) FROM talent_experiences WHERE talent_id = t.id) as experience_count,
        (SELECT COUNT(*) FROM talent_educations WHERE talent_id = t.id) as education_count,
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
      return res.status(404).json({ error: 'Talent profile not found' });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error('Error fetching talent profile:', error);
    res.status(500).json({ error: 'Failed to fetch talent profile' });
  }
});

/**
 * PUT /api/talents/me
 * Update current user's talent profile
 */
router.put('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.talentId) {
      return res.status(404).json({ error: 'Talent profile not found' });
    }

    const {
      display_name,
      first_name,
      last_name,
      bio,
      avatar_url,
      phone,
      gender,
      birthday,
      city,
      region,
      country,
      remote_ready,
      willing_to_relocate,
      profile_tags,
      goals,
    } = req.body;

    // Content moderation for user-generated text fields
    try {
      await autoModerationService.assertContentApproved({
        display_name,
        bio,
      });
    } catch (moderationError: any) {
      console.log(`[Moderation] Talent profile update rejected for ${req.talentId}: ${moderationError.message}`);
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
    if (display_name !== undefined) {
      if (typeof display_name !== 'string' || display_name.length < 2) {
        return res.status(400).json({ error: 'Display name must be at least 2 characters' });
      }
      updates.push(`display_name = $${paramIndex++}`);
      params.push(display_name.trim());
    }

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

    if (birthday !== undefined) {
      updates.push(`birthday = $${paramIndex++}`);
      params.push(birthday ? new Date(birthday) : null);
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
      if (country && country.length !== 2) {
        return res.status(400).json({ error: 'Country must be a 2-letter ISO code' });
      }
      updates.push(`country = $${paramIndex++}`);
      params.push(country?.toUpperCase() || null);
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
      if (!Array.isArray(profile_tags)) {
        return res.status(400).json({ error: 'profile_tags must be an array' });
      }
      updates.push(`profile_tags = $${paramIndex++}`);
      params.push(profile_tags);
    }

    if (goals !== undefined) {
      if (!Array.isArray(goals)) {
        return res.status(400).json({ error: 'goals must be an array' });
      }
      if (goals.length > 3) {
        return res.status(400).json({ error: 'Maximum 3 goals allowed' });
      }
      updates.push(`goals = $${paramIndex++}`);
      params.push(goals);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
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
      return res.status(404).json({ error: 'Talent profile not found' });
    }

    console.log(`✅ Talent profile updated: ${req.talentId}`);

    // Generate/update embedding for semantic search (async, non-blocking)
    onTalentProfileUpdate(req.talentId).catch(err =>
      console.error('Failed to update talent embedding:', err)
    );

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error('Error updating talent profile:', error);
    res.status(500).json({ error: 'Failed to update talent profile' });
  }
});

/**
 * GET /api/talents/:id
 * Get a specific talent profile (public view)
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT
        t.id, t.slug, t.display_name, t.bio, t.avatar_url,
        t.city, t.region, t.country, t.remote_ready, t.willing_to_relocate,
        t.profile_tags, t.goals, t.created_at,
        (SELECT COUNT(*) FROM talent_skills WHERE talent_id = t.id) as skill_count
      FROM talents t
      WHERE (t.id = $1 OR t.slug = $1) AND t.deleted_at IS NULL
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Talent not found' });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error('Error fetching talent:', error);
    res.status(500).json({ error: 'Failed to fetch talent' });
  }
});

export default router;
