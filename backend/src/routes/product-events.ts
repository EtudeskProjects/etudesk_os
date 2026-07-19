import { Router } from 'express';
import { pool } from '../services/database';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';

const router = Router();
const ALLOWED = new Set(['onboarding_completed', 'welcome_started', 'first_goal_selected', 'community_joined', 'challenge_started', 'challenge_completed', 'opportunity_opened', 'application_started', 'application_submitted', 'credit_checkout_started']);

router.post('/', authMiddleware, async (req: AuthRequest, res) => {
  const name = String(req.body?.name || '');
  const properties = req.body?.properties;
  if (!ALLOWED.has(name) || (properties !== undefined && (typeof properties !== 'object' || Array.isArray(properties)))) {
    return res.status(400).json({ success: false, error: 'INVALID_PRODUCT_EVENT' });
  }
  await pool.query(`INSERT INTO product_events (user_id,talent_id,name,properties) VALUES ($1,$2,$3,$4)`, [req.userId, req.talentId ?? null, name, JSON.stringify(properties ?? {})]);
  return res.status(201).json({ success: true });
});

export default router;
