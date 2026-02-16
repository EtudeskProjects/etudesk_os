/**
 * Skills Routes
 * CRUD for talent skills management
 */

import { Router, Response } from 'express';
import { pool } from '../services/database';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { isValidSkillType, isValidProficiencyLevel } from '../constants/skills';
import { mergeExtractedSkills } from '../services/skills/skill-merge.service';

import { logger } from '../utils';
import { cache } from '../utils/cache';
const router = Router();

// All routes require auth
router.use(authMiddleware);

// Invalidate copilot context cache on any skill mutation
router.use((req: AuthRequest, _res, next) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method) && req.talentId) {
    cache.deleteByPrefix(`ctx:${req.talentId}:`);
  }
  next();
});

/**
 * GET /api/skills/my
 * Get current talent's skills
 */
router.get('/my', async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    if (!talentId) {
      return res.json({ data: [] });
    }

    const result = await pool.query(
      `SELECT id, canonical_name, type, proficiency_level,
              context, origin, is_visible, created_at
       FROM talent_skills
       WHERE talent_id = $1
       ORDER BY proficiency_level DESC, canonical_name ASC`,
      [talentId]
    );

    return res.json({ data: result.rows });
  } catch (error) {
    logger.error('Error fetching skills:', error);
    return res.status(500).json({ error: req.t('skills:fetchError') });
  }
});

/**
 * POST /api/skills/my
 * Add a skill to current talent
 */
router.post('/my', async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    if (!talentId) {
      return res.status(400).json({ error: req.t('common:talentProfileRequired') });
    }

    const { skillName, proficiencyLevel, type, context, is_visible } = req.body;

    if (!proficiencyLevel || !isValidProficiencyLevel(proficiencyLevel)) {
      return res.status(400).json({ error: req.t('skills:invalidProficiencyLevel') });
    }

    if (!skillName) {
      return res.status(400).json({ error: req.t('skills:skillNameRequired') });
    }

    if (!type || !isValidSkillType(type)) {
      return res.status(400).json({ error: req.t('skills:skillTypeRequired') });
    }

    const canonicalName = skillName.trim();

    // Check if already exists
    const existing = await pool.query(
      `SELECT id FROM talent_skills WHERE talent_id = $1 AND canonical_name = $2`,
      [talentId, canonicalName]
    );

    if (existing.rows.length > 0) {
      // Update proficiency and optionally context
      await pool.query(
        `UPDATE talent_skills SET proficiency_level = $1${context ? ', context = $3' : ''} WHERE id = $2`,
        context ? [proficiencyLevel, existing.rows[0].id, context] : [proficiencyLevel, existing.rows[0].id]
      );
      return res.json({ data: { id: existing.rows[0].id, updated: true } });
    }

    const columns = ['talent_id', 'canonical_name', 'type', 'proficiency_level'];
    const values: any[] = [talentId, canonicalName, type, proficiencyLevel];
    if (context) { columns.push('context'); values.push(context); }
    if (is_visible === false) { columns.push('is_visible'); values.push(false); }
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

    const result = await pool.query(
      `INSERT INTO talent_skills (${columns.join(', ')})
       VALUES (${placeholders}) RETURNING id`,
      values
    );

    return res.status(201).json({ data: { id: result.rows[0].id } });
  } catch (error) {
    logger.error('Error adding skill:', error);
    return res.status(500).json({ error: req.t('skills:addError') });
  }
});

/**
 * PUT /api/skills/my/:id
 * Update proficiency level
 */
router.put('/my/:id', async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    if (!talentId) {
      return res.status(400).json({ error: req.t('common:talentProfileRequired') });
    }

    const { proficiencyLevel } = req.body;
    if (!proficiencyLevel || !isValidProficiencyLevel(proficiencyLevel)) {
      return res.status(400).json({ error: req.t('skills:invalidProficiencyLevel') });
    }

    const result = await pool.query(
      `UPDATE talent_skills SET proficiency_level = $1
       WHERE id = $2 AND talent_id = $3
       RETURNING id`,
      [proficiencyLevel, req.params.id, talentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: req.t('skills:notFound') });
    }

    return res.json({ data: { id: result.rows[0].id } });
  } catch (error) {
    logger.error('Error updating skill:', error);
    return res.status(500).json({ error: req.t('skills:updateError') });
  }
});

/**
 * DELETE /api/skills/my/:id
 * Remove a skill from current talent
 */
router.delete('/my/:id', async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    if (!talentId) {
      return res.status(400).json({ error: req.t('common:talentProfileRequired') });
    }

    const result = await pool.query(
      `DELETE FROM talent_skills WHERE id = $1 AND talent_id = $2 RETURNING id`,
      [req.params.id, talentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: req.t('skills:notFound') });
    }

    return res.json({ data: { deleted: true } });
  } catch (error) {
    logger.error('Error deleting skill:', error);
    return res.status(500).json({ error: req.t('skills:deleteError') });
  }
});

/**
 * PATCH /api/skills/my/:id/visibility
 * Toggle skill visibility
 */
router.patch('/my/:id/visibility', async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    if (!talentId) {
      return res.status(400).json({ error: req.t('common:talentProfileRequired') });
    }

    const { is_visible } = req.body;
    if (typeof is_visible !== 'boolean') {
      return res.status(400).json({ error: 'is_visible must be a boolean' });
    }

    const result = await pool.query(
      `UPDATE talent_skills SET is_visible = $1
       WHERE id = $2 AND talent_id = $3
       RETURNING id, is_visible`,
      [is_visible, req.params.id, talentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: req.t('skills:notFound') });
    }

    return res.json({ data: result.rows[0] });
  } catch (error) {
    logger.error('Error toggling skill visibility:', error);
    return res.status(500).json({ error: req.t('skills:updateError') });
  }
});

/**
 * POST /api/skills/my/merge
 * Merge extracted skills with declared skills
 */
router.post('/my/merge', async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    if (!talentId) {
      return res.status(400).json({ error: req.t('common:talentProfileRequired') });
    }

    const report = await mergeExtractedSkills(talentId);
    return res.json({ data: report });
  } catch (error) {
    logger.error('Error merging skills:', error);
    return res.status(500).json({ error: req.t('skills:mergeError') });
  }
});

export default router;
