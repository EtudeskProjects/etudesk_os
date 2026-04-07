import { Router, Request, Response } from 'express';
import { pool } from '../services/database';
import { getClientIp, logger } from '../utils';

const router = Router();

/**
 * GET /link/:slug
 * Public redirect — no auth, no rate limit (fast)
 * Logs click then 302 redirects to target_url
 */
router.get('/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const result = await pool.query(
      `SELECT id, target_url, is_active, expires_at
       FROM short_links
       WHERE slug = $1`,
      [slug],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Link not found' });
    }

    const link = result.rows[0];

    if (!link.is_active) {
      return res.status(410).json({ error: 'Link is no longer active' });
    }

    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Link has expired' });
    }

    // Increment counter (fast, non-blocking)
    pool.query('UPDATE short_links SET clicks = clicks + 1 WHERE id = $1', [link.id]).catch(() => {});

    // Log click details (non-blocking)
    const ip = getClientIp(req) ?? null;
    const userAgent = req.headers['user-agent'] || null;
    const referer = req.headers['referer'] || null;

    pool.query(
      `INSERT INTO short_link_clicks (link_id, ip_address, user_agent, referer)
       VALUES ($1, $2, $3, $4)`,
      [link.id, ip, userAgent, referer],
    ).catch((err) => logger.warn('Click log failed', { error: String(err) }));

    // 302 redirect
    res.redirect(302, link.target_url);
  } catch (error) {
    logger.error('Link redirect error', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

export default router;
