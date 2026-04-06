import { Router, Request, Response } from 'express';
import { pool } from '../services/database';
import { logger } from '../utils';

const router = Router();

// Secret key for backoffice access (set in .env)
const BACKOFFICE_SECRET = process.env.BACKOFFICE_SECRET || 'etudesk-bo-2026';

/**
 * Simple token-based auth for backoffice
 * Pass ?token=xxx or Authorization: Bearer xxx
 */
function backofficeAuth(req: Request, res: Response, next: Function) {
  const token = (req.query.token as string) || req.headers.authorization?.replace('Bearer ', '');
  if (token !== BACKOFFICE_SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

router.use(backofficeAuth);

/**
 * GET /api/v1/backoffice/stats
 * Real-time dashboard stats
 */
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    // Run all queries in parallel
    const [
      usersResult,
      talentsResult,
      orgsResult,
      waitlistResult,
      communitiesResult,
      opportunitiesResult,
      copilotResult,
      billingResult,
      signupsToday,
      signupsWeek,
      shortLinksResult,
    ] = await Promise.all([
      // Total users
      pool.query('SELECT COUNT(*) AS total FROM users WHERE deleted_at IS NULL'),
      // Total talents
      pool.query('SELECT COUNT(*) AS total FROM talents WHERE deleted_at IS NULL'),
      // Total organizations
      pool.query('SELECT COUNT(*) AS total FROM organizations WHERE deleted_at IS NULL'),
      // Waitlist count
      pool.query('SELECT COUNT(*) AS total FROM waitlist'),
      // Communities
      pool.query('SELECT COUNT(*) AS total FROM communities WHERE deleted_at IS NULL'),
      // Opportunities
      pool.query('SELECT COUNT(*) AS total FROM opportunities WHERE deleted_at IS NULL'),
      // Copilot sessions & token usage
      pool.query(`
        SELECT
          COUNT(DISTINCT cs.id) AS total_sessions,
          COUNT(ct.id) AS total_traces,
          COALESCE(SUM(ct.input_tokens), 0) AS total_input_tokens,
          COALESCE(SUM(ct.output_tokens), 0) AS total_output_tokens,
          COALESCE(SUM(ct.input_tokens + ct.output_tokens), 0) AS total_tokens
        FROM copilot_sessions cs
        LEFT JOIN copilot_traces ct ON ct.session_id = cs.id
      `),
      // Billing / Revenue (table may not exist yet)
      pool.query(`
        SELECT
          COUNT(*) AS total_transactions,
          COALESCE(SUM(CASE WHEN status = 'success' THEN amount ELSE 0 END), 0) AS total_revenue,
          COALESCE(SUM(CASE WHEN status = 'success' AND created_at >= NOW() - INTERVAL '30 days' THEN amount ELSE 0 END), 0) AS revenue_30d,
          COALESCE(SUM(CASE WHEN status = 'success' AND created_at >= NOW() - INTERVAL '7 days' THEN amount ELSE 0 END), 0) AS revenue_7d
        FROM billing_transactions
      `).catch(() => ({ rows: [{ total_transactions: 0, total_revenue: 0, revenue_30d: 0, revenue_7d: 0 }] })),
      // Signups today
      pool.query("SELECT COUNT(*) AS total FROM users WHERE created_at >= CURRENT_DATE AND deleted_at IS NULL"),
      // Signups this week
      pool.query("SELECT COUNT(*) AS total FROM users WHERE created_at >= DATE_TRUNC('week', CURRENT_DATE) AND deleted_at IS NULL"),
      // Short links stats
      pool.query(`
        SELECT COUNT(*) AS total_links,
               COALESCE(SUM(clicks), 0) AS total_clicks
        FROM short_links
      `),
    ]);

    const copilot = copilotResult.rows[0];
    const billing = billingResult.rows[0];

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: {
        users: {
          total: parseInt(usersResult.rows[0].total),
          talents: parseInt(talentsResult.rows[0].total),
          organizations: parseInt(orgsResult.rows[0].total),
          waitlist: parseInt(waitlistResult.rows[0].total),
          signups_today: parseInt(signupsToday.rows[0].total),
          signups_this_week: parseInt(signupsWeek.rows[0].total),
        },
        content: {
          communities: parseInt(communitiesResult.rows[0].total),
          opportunities: parseInt(opportunitiesResult.rows[0].total),
        },
        copilot: {
          total_sessions: parseInt(copilot.total_sessions),
          total_traces: parseInt(copilot.total_traces),
          total_tokens: parseInt(copilot.total_tokens),
          total_input_tokens: parseInt(copilot.total_input_tokens),
          total_output_tokens: parseInt(copilot.total_output_tokens),
        },
        revenue: {
          total_transactions: parseInt(billing.total_transactions),
          total_revenue_fcfa: parseInt(billing.total_revenue),
          revenue_30d_fcfa: parseInt(billing.revenue_30d),
          revenue_7d_fcfa: parseInt(billing.revenue_7d),
        },
        short_links: {
          total_links: parseInt(shortLinksResult.rows[0].total_links),
          total_clicks: parseInt(shortLinksResult.rows[0].total_clicks),
        },
      },
    });
  } catch (error) {
    logger.error('Backoffice stats error', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * GET /api/v1/backoffice/users
 * Recent user signups
 */
router.get('/users', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await pool.query(
      `SELECT u.id, u.email, u.phone, u.created_at, u.last_login_at,
              t.first_name, t.last_name, t.slug AS talent_slug
       FROM users u
       LEFT JOIN talents t ON t.id = u.id AND t.deleted_at IS NULL
       WHERE u.deleted_at IS NULL
       ORDER BY u.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    );

    const countResult = await pool.query('SELECT COUNT(*) AS total FROM users WHERE deleted_at IS NULL');

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].total),
        limit,
        offset,
      },
    });
  } catch (error) {
    logger.error('Backoffice users error', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * GET /api/v1/backoffice/copilot/usage
 * Copilot token usage over time (daily)
 */
router.get('/copilot/usage', async (req: Request, res: Response) => {
  try {
    const days = Math.min(parseInt(req.query.days as string) || 30, 90);

    const result = await pool.query(
      `SELECT DATE(ct.created_at) AS day,
              COUNT(DISTINCT cs.id) AS sessions,
              COUNT(ct.id) AS traces,
              COALESCE(SUM(ct.input_tokens), 0) AS input_tokens,
              COALESCE(SUM(ct.output_tokens), 0) AS output_tokens,
              COALESCE(SUM(ct.input_tokens + ct.output_tokens), 0) AS total_tokens
       FROM copilot_traces ct
       JOIN copilot_sessions cs ON cs.id = ct.session_id
       WHERE ct.created_at >= NOW() - ($1 || ' days')::INTERVAL
       GROUP BY DATE(ct.created_at)
       ORDER BY day DESC`,
      [days],
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Backoffice copilot usage error', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * GET /api/v1/backoffice/organizations
 */
router.get('/organizations', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const result = await pool.query(
      `SELECT o.id, o.name, o.slug, o.industry, o.country, o.created_at,
              (SELECT COUNT(*) FROM organization_members om WHERE om.organization_id = o.id) AS member_count
       FROM organizations o
       WHERE o.deleted_at IS NULL
       ORDER BY o.created_at DESC
       LIMIT $1`,
      [limit],
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Backoffice orgs error', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * GET /api/v1/backoffice/short-links
 */
router.get('/short-links', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT sl.*,
              (SELECT COUNT(*) FROM short_link_clicks WHERE link_id = sl.id) AS total_clicks
       FROM short_links sl
       ORDER BY sl.created_at DESC`,
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Backoffice short links error', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * GET /api/v1/backoffice/logs
 */
router.get('/logs', async (req: Request, res: Response) => {
  try {
    const lines = Math.min(parseInt(req.query.lines as string) || 50, 200);
    const { execFileSync } = require('child_process');
    let logs = '';
    try {
      logs = execFileSync('pm2', ['logs', 'etudesk-api', '--lines', String(lines), '--nostream', '--err'], { timeout: 5000 }).toString();
    } catch {
      logs = 'Unable to read PM2 logs';
    }
    res.json({ success: true, data: logs });
  } catch (error) {
    logger.error('Backoffice logs error', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

export default router;
