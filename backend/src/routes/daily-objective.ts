/**
 * Daily Objective Routes
 * Endpoints for getting personalized daily objectives for talents and organizations
 */

import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { dailyObjectiveService } from '../services/daily-objective.service';
import { debitWalletForAction } from '../services/billing/credit.service';
import { pool } from '../services/database';
import { handleRouteError } from '../utils';
import { resolveTalentLanguage } from '../services/language-preference.service';

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

    const day = new Date().toISOString().slice(0, 10);
    try {
      await debitWalletForAction({
        scope: 'TALENT',
        ownerId: talentId,
        actionCode: 'TALENT_DAILY_OBJECTIVE',
        idempotencyKey: `daily_objective_${talentId}_${day}`,
        metadata: { day },
        createdBy: talentId,
      });
    } catch (debitError: any) {
      if (String(debitError?.message || '').includes('INSUFFICIENT_CREDITS')) {
        return res.status(402).json({
          error: req.t('billing:insufficientCredits'),
          code: 'INSUFFICIENT_CREDITS',
        });
      }
      throw debitError;
    }

    const language = await resolveTalentLanguage({ talentId, userId: req.userId });
    const objective = await dailyObjectiveService.getTalentDailyObjective(talentId, language);
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

    // Billing guard: prevent any authenticated user from spending org credits.
    const member = await pool.query(
      `SELECT role, status
       FROM organization_members
       WHERE organization_id = $1 AND talent_id = $2
       LIMIT 1`,
      [orgId, talentId]
    );

    if (!member.rows.length || member.rows[0].status !== 'ACTIVE') {
      return res.status(403).json({ error: req.t('billing:noAccessToOrg') });
    }

    const role = String(member.rows[0].role || '').toUpperCase();
    const allowedRoles = new Set(['OWNER', 'ADMIN', 'MANAGER', 'SUB_ADMIN']);
    if (!allowedRoles.has(role)) {
      return res.status(403).json({ error: req.t('billing:insufficientRoleForBilling') });
    }

    const day = new Date().toISOString().slice(0, 10);
    try {
      await debitWalletForAction({
        scope: 'ORGANIZATION',
        ownerId: orgId,
        actionCode: 'ORG_DAILY_OBJECTIVE',
        idempotencyKey: `org_daily_objective_${orgId}_${day}`,
        metadata: { day },
        createdBy: talentId,
      });
    } catch (debitError: any) {
      if (String(debitError?.message || '').includes('INSUFFICIENT_CREDITS')) {
        return res.status(402).json({
          error: req.t('billing:insufficientOrgCredits'),
          code: 'INSUFFICIENT_CREDITS',
        });
      }
      throw debitError;
    }

    const language = await resolveTalentLanguage({ talentId, userId: req.userId });
    const objective = await dailyObjectiveService.getOrganizationDailyObjective(orgId, language);
    res.json({ data: objective });
  } catch (error) {
    handleRouteError(res, error, 'Error fetching organization daily objective');
  }
});

export default router;
