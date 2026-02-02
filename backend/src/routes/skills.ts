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
 * Get current talent's skills with skill details
 */
router.get('/my', async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    if (!talentId) {
      return res.json({ data: [] });
    }

    const result = await pool.query(
      `SELECT ts.id, ts.skill_id, ts.proficiency_level, ts.self_assessed,
              ts.endorsed_count, ts.years_of_experience, ts.last_used_at,
              ts.context, ts.origin, ts.created_at,
              s.canonical_name, s.slug, s.type, s.domain, s.aliases
       FROM talent_skills ts
       JOIN skills s ON s.id = ts.skill_id
       WHERE ts.talent_id = $1
       ORDER BY ts.proficiency_level DESC, s.canonical_name ASC`,
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

    const { skillId, skillName, proficiencyLevel, type, context } = req.body;

    if (!proficiencyLevel || !isValidProficiencyLevel(proficiencyLevel)) {
      return res.status(400).json({ error: 'Niveau de compétence invalide' });
    }

    let resolvedSkillId = skillId;

    // If no skillId, create or find the skill by name
    if (!resolvedSkillId && skillName) {
      const slug = skillName.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

      // Try to find existing
      const existing = await pool.query(
        `SELECT id FROM skills WHERE slug = $1`,
        [slug]
      );

      if (existing.rows.length > 0) {
        resolvedSkillId = existing.rows[0].id;
      } else {
        // Create new skill - type is required
        if (!type || !isValidSkillType(type)) {
          return res.status(400).json({ error: 'Le type de compétence est requis (KNOWLEDGE, HARD_SKILL, SOFT_SKILL)' });
        }
        const skillType = type;
        const created = await pool.query(
          `INSERT INTO skills (canonical_name, slug, type)
           VALUES ($1, $2, $3) RETURNING id`,
          [skillName.trim(), slug, skillType]
        );
        resolvedSkillId = created.rows[0].id;
      }
    }

    if (!resolvedSkillId) {
      return res.status(400).json({ error: 'skillId ou skillName requis' });
    }

    // Check if already exists
    const existingLink = await pool.query(
      `SELECT id FROM talent_skills WHERE talent_id = $1 AND skill_id = $2`,
      [talentId, resolvedSkillId]
    );

    if (existingLink.rows.length > 0) {
      // Update proficiency and optionally context
      await pool.query(
        `UPDATE talent_skills SET proficiency_level = $1${context ? ', context = $3' : ''} WHERE id = $2`,
        context ? [proficiencyLevel, existingLink.rows[0].id, context] : [proficiencyLevel, existingLink.rows[0].id]
      );
      return res.json({ data: { id: existingLink.rows[0].id, updated: true } });
    }

    const result = await pool.query(
      `INSERT INTO talent_skills (talent_id, skill_id, proficiency_level${context ? ', context' : ''})
       VALUES ($1, $2, $3${context ? ', $4' : ''}) RETURNING id`,
      context ? [talentId, resolvedSkillId, proficiencyLevel, context] : [talentId, resolvedSkillId, proficiencyLevel]
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
