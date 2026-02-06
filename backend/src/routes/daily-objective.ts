/**
 * Daily Objective Routes
 * Endpoints for getting personalized daily objectives for talents and organizations
 */

import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { dailyObjectiveService } from '../services/daily-objective.service';
import { handleRouteError } from '../utils';

const router = Router();

/**
 * GET /api/daily-objective/talent
 * Get daily objective for the authenticated talent
 */
router.get('/talent', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    if (!talentId) {
      return res.status(401).json({ error: req.t('auth:unauthorized') });
    }

    const objective = await dailyObjectiveService.getTalentDailyObjective(talentId);
    res.json({ data: objective });
  } catch (error) {
    handleRouteError(res, error, 'Error fetching talent daily objective');
  }
});

/**
 * GET /api/daily-objective/organization/:orgId
 * Get daily objective for a specific organization
 */
router.get('/organization/:orgId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { orgId } = req.params;
    const talentId = req.talentId;

    if (!talentId) {
      return res.status(401).json({ error: req.t('auth:unauthorized') });
    }

    // Note: We could add a membership check here, but for now we allow any authenticated user
    // to get the objective if they have the org ID (they would need to be in org context)

    const objective = await dailyObjectiveService.getOrganizationDailyObjective(orgId);
    res.json({ data: objective });
  } catch (error) {
    handleRouteError(res, error, 'Error fetching organization daily objective');
  }
});

export default router;
