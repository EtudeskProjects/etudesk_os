/**
 * Skills Routes
 * CRUD for talent skills management
 */

import { Router, Response } from 'express';
import { pool } from '../services/database';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { isValidSkillType, isValidProficiencyLevel } from '../constants/skills';
import { mergeExtractedSkills } from '../services/skills/skill-merge.service';

const router = Router();

// All routes require auth
router.use(authMiddleware);

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
              context, origin, created_at
       FROM talent_skills
       WHERE talent_id = $1
       ORDER BY proficiency_level DESC, canonical_name ASC`,
      [talentId]
    );

    return res.json({ data: result.rows });
  } catch (error) {
    console.error('Error fetching skills:', error);
    return res.status(500).json({ error: 'Erreur lors du chargement des compétences' });
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
      return res.status(400).json({ error: 'Profil talent requis' });
    }

    const { skillName, proficiencyLevel, type, context } = req.body;

    if (!proficiencyLevel || !isValidProficiencyLevel(proficiencyLevel)) {
      return res.status(400).json({ error: 'Niveau de compétence invalide' });
    }

    if (!skillName) {
      return res.status(400).json({ error: 'skillName requis' });
    }

    if (!type || !isValidSkillType(type)) {
      return res.status(400).json({ error: 'Le type de compétence est requis (KNOWLEDGE, HARD_SKILL, SOFT_SKILL)' });
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

    const result = await pool.query(
      `INSERT INTO talent_skills (talent_id, canonical_name, type, proficiency_level${context ? ', context' : ''})
       VALUES ($1, $2, $3, $4${context ? ', $5' : ''}) RETURNING id`,
      context ? [talentId, canonicalName, type, proficiencyLevel, context] : [talentId, canonicalName, type, proficiencyLevel]
    );

    return res.status(201).json({ data: { id: result.rows[0].id } });
  } catch (error) {
    console.error('Error adding skill:', error);
    return res.status(500).json({ error: "Erreur lors de l'ajout de la compétence" });
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
      return res.status(400).json({ error: 'Profil talent requis' });
    }

    const { proficiencyLevel } = req.body;
    if (!proficiencyLevel || !isValidProficiencyLevel(proficiencyLevel)) {
      return res.status(400).json({ error: 'Niveau de compétence invalide' });
    }

    const result = await pool.query(
      `UPDATE talent_skills SET proficiency_level = $1
       WHERE id = $2 AND talent_id = $3
       RETURNING id`,
      [proficiencyLevel, req.params.id, talentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Compétence non trouvée' });
    }

    return res.json({ data: { id: result.rows[0].id } });
  } catch (error) {
    console.error('Error updating skill:', error);
    return res.status(500).json({ error: 'Erreur lors de la mise à jour' });
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
      return res.status(400).json({ error: 'Profil talent requis' });
    }

    const result = await pool.query(
      `DELETE FROM talent_skills WHERE id = $1 AND talent_id = $2 RETURNING id`,
      [req.params.id, talentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Compétence non trouvée' });
    }

    return res.json({ data: { deleted: true } });
  } catch (error) {
    console.error('Error deleting skill:', error);
    return res.status(500).json({ error: 'Erreur lors de la suppression' });
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
      return res.status(400).json({ error: 'Profil talent requis' });
    }

    const report = await mergeExtractedSkills(talentId);
    return res.json({ data: report });
  } catch (error) {
    console.error('Error merging skills:', error);
    return res.status(500).json({ error: 'Erreur lors de la fusion des compétences' });
  }
});

export default router;
