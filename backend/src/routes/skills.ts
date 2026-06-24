/**
 * Skills Routes
 * Catalog-constrained CRUD for talent skills. Every write resolves to a
 * competency slug from the referential (datasets/etudesk_digital_skills);
 * non-catalog labels are rejected.
 */

import { Router, Response } from 'express';
import { pool } from '../services/database';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { isValidLevel, Level } from '../constants/skills';
import * as catalog from '../services/skills/catalog.service';
import { evaluateBatch } from '../services/skills/evaluation.service';

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
 * Get current talent's skills (joined to the catalog; excludes archived).
 */
router.get('/my', async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    if (!talentId) {
      return res.json({ data: [] });
    }

    const result = await pool.query(
      `SELECT ts.id, ts.competency_slug, c.name, c.name_fr, c.family, c.type,
              ts.level, ts.score, ts.confidence, ts.origin, ts.decay_state,
              ts.is_visible, ts.created_at
       FROM talent_skills ts
       JOIN competencies c ON c.slug = ts.competency_slug
       WHERE ts.talent_id = $1 AND ts.decay_state <> 'archived'
       ORDER BY ts.score DESC, c.name ASC`,
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
 * Declare a catalog skill for the current talent.
 * Body: { skillOrLabel: string, level: Level, context?: string, is_visible?: boolean }
 */
router.post('/my', async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    if (!talentId) {
      return res.status(400).json({ error: req.t('common:talentProfileRequired') });
    }

    const { skillOrLabel, level, is_visible } = req.body;
    const label = skillOrLabel || req.body.skillName; // accept legacy field name

    if (!label) {
      return res.status(400).json({ error: req.t('skills:skillNameRequired') });
    }
    const requestedLevel: Level = level && isValidLevel(level) ? level : 'beginner';

    const resolved = await catalog.resolveLabel(label);
    if (!resolved) {
      const suggestions = await catalog.suggestCompetencies(label, 3);
      return res.status(400).json({
        error: req.t('skills:notInCatalog', { name: label }) || `"${label}" is not in the skills catalog`,
        suggestions: suggestions.map((s) => ({ slug: s.slug, name: s.name, name_fr: s.name_fr })),
      });
    }

    // Declared skills are anchored at the requested level; the evaluation service
    // applies framework guards (self-declared never exceeds intermediate).
    const [evalResult] = await evaluateBatch({
      talentId,
      targets: [
        {
          slug: resolved.slug,
          origin: 'declared',
          assertedLevel: requestedLevel,
          signals: [{ kind: 'declared', source_ref: 'self:profile' }],
          evaluatedBy: 'rest_api',
        },
      ],
    });

    // Optional visibility override
    if (is_visible === false) {
      await pool.query(
        `UPDATE talent_skills SET is_visible = false WHERE talent_id = $1 AND competency_slug = $2`,
        [talentId, resolved.slug]
      );
    }

    return res.status(201).json({
      data: {
        competency_slug: resolved.slug,
        name: resolved.name,
        level: evalResult?.level ?? requestedLevel,
        confidence: evalResult?.confidence,
      },
    });
  } catch (error) {
    logger.error('Error adding skill:', error);
    return res.status(500).json({ error: req.t('skills:addError') });
  }
});

/**
 * PUT /api/skills/my/:id
 * Update declared level for an existing skill row.
 */
router.put('/my/:id', async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    if (!talentId) {
      return res.status(400).json({ error: req.t('common:talentProfileRequired') });
    }

    const { level } = req.body;
    if (!level || !isValidLevel(level)) {
      return res.status(400).json({ error: req.t('skills:invalidProficiencyLevel') });
    }

    const result = await pool.query(
      `UPDATE talent_skills SET level = $1, score = CASE $1
          WHEN 'beginner' THEN 1 WHEN 'intermediate' THEN 2 WHEN 'advanced' THEN 3 WHEN 'master' THEN 4 ELSE 1 END
       WHERE id = $2 AND talent_id = $3
       RETURNING id`,
      [level, req.params.id, talentId]
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
 */
router.patch('/my/:id/visibility', async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    if (!talentId) {
      return res.status(400).json({ error: req.t('common:talentProfileRequired') });
    }

    const { is_visible } = req.body;
    if (typeof is_visible !== 'boolean') {
      return res.status(400).json({ error: req.t('skills:isVisibleMustBeBoolean') });
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
 * GET /api/skills/catalog/search?q=...
 * Search the catalog (for catalog-constrained skill pickers / agents).
 */
router.get('/catalog/search', async (req: AuthRequest, res: Response) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json({ data: [] });
    const resolved = await catalog.resolveLabel(q);
    const suggestions = await catalog.suggestCompetencies(q, 8);
    const seen = new Set<string>();
    const data = [resolved, ...suggestions]
      .filter((c): c is NonNullable<typeof c> => !!c)
      .filter((c) => (seen.has(c.slug) ? false : (seen.add(c.slug), true)))
      .map((c) => ({ slug: c.slug, name: c.name, name_fr: c.name_fr, family: c.family, type: c.type }));
    return res.json({ data });
  } catch (error) {
    logger.error('Error searching catalog:', error);
    return res.status(500).json({ error: req.t('skills:fetchError') });
  }
});

export default router;
