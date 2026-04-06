import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../services/database';
import { logger } from '../utils';
import QRCode from 'qrcode';
import crypto from 'crypto';

const router = Router();

const BASE_URL = process.env.BASE_URL || 'https://etudesk.com';

// --- Schemas ---

const createLinkSchema = z.object({
  slug: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/, 'Slug must be alphanumeric with dashes/underscores').optional(),
  target_url: z.string().url().max(2048),
  label: z.string().max(255).optional(),
  expires_at: z.string().datetime().optional(),
});

const updateLinkSchema = z.object({
  target_url: z.string().url().max(2048).optional(),
  label: z.string().max(255).optional(),
  is_active: z.boolean().optional(),
  expires_at: z.string().datetime().nullable().optional(),
});

function generateSlug(): string {
  return crypto.randomBytes(4).toString('base64url'); // 6 chars URL-safe
}

// --- CRUD (protected by auth in index.ts) ---

/**
 * POST /api/v1/short-links
 * Create a new short link
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const parsed = createLinkSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
    }

    const { target_url, label, expires_at } = parsed.data;
    let slug = parsed.data.slug || generateSlug();

    // Check slug uniqueness
    const existing = await pool.query('SELECT id FROM short_links WHERE slug = $1', [slug]);
    if (existing.rows.length > 0) {
      if (parsed.data.slug) {
        return res.status(409).json({ error: `Slug "${slug}" is already taken` });
      }
      // Auto-generated collision — retry once
      slug = generateSlug();
    }

    const result = await pool.query(
      `INSERT INTO short_links (slug, target_url, label, expires_at, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [slug, target_url, label || null, expires_at || null, 'admin'],
    );

    const link = result.rows[0];
    const short_url = `${BASE_URL}/link/${link.slug}`;

    logger.info('Short link created', { slug, target_url });

    res.status(201).json({
      success: true,
      data: { ...link, short_url },
    });
  } catch (error) {
    logger.error('Short link creation error', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * GET /api/v1/short-links
 * List all short links with click counts
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT sl.*,
              '${BASE_URL}/link/' || sl.slug AS short_url,
              (SELECT COUNT(*) FROM short_link_clicks WHERE link_id = sl.id) AS total_clicks
       FROM short_links sl
       ORDER BY sl.created_at DESC`,
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Short links list error', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * GET /api/v1/short-links/:id
 * Get a specific short link with detailed analytics
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const linkResult = await pool.query(
      `SELECT sl.*,
              '${BASE_URL}/link/' || sl.slug AS short_url
       FROM short_links sl WHERE sl.id = $1`,
      [id],
    );

    if (linkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Link not found' });
    }

    // Last 30 days click stats by day
    const clicksPerDay = await pool.query(
      `SELECT DATE(clicked_at) AS day, COUNT(*) AS clicks
       FROM short_link_clicks
       WHERE link_id = $1 AND clicked_at >= NOW() - INTERVAL '30 days'
       GROUP BY DATE(clicked_at)
       ORDER BY day DESC`,
      [id],
    );

    // Top referers
    const topReferers = await pool.query(
      `SELECT COALESCE(referer, 'Direct') AS referer, COUNT(*) AS clicks
       FROM short_link_clicks
       WHERE link_id = $1
       GROUP BY referer
       ORDER BY clicks DESC
       LIMIT 10`,
      [id],
    );

    res.json({
      success: true,
      data: {
        ...linkResult.rows[0],
        analytics: {
          clicks_per_day: clicksPerDay.rows,
          top_referers: topReferers.rows,
        },
      },
    });
  } catch (error) {
    logger.error('Short link detail error', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * PATCH /api/v1/short-links/:id
 * Update a short link
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const parsed = updateLinkSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
    }

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const [key, value] of Object.entries(parsed.data)) {
      if (value !== undefined) {
        fields.push(`${key} = $${idx}`);
        values.push(value);
        idx++;
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    fields.push(`updated_at = NOW()`);
    values.push(req.params.id);

    const result = await pool.query(
      `UPDATE short_links SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values,
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Link not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('Short link update error', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * DELETE /api/v1/short-links/:id
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      'DELETE FROM short_links WHERE id = $1 RETURNING id',
      [req.params.id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Link not found' });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Short link delete error', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * GET /api/v1/short-links/:id/qr
 * Generate QR code for a short link (returns PNG image)
 */
router.get('/:id/qr', async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT slug FROM short_links WHERE id = $1', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Link not found' });
    }

    const url = `${BASE_URL}/link/${result.rows[0].slug}`;
    const size = Math.min(parseInt(req.query.size as string) || 300, 1000);

    const qrBuffer = await QRCode.toBuffer(url, {
      type: 'png',
      width: size,
      margin: 2,
      color: { dark: '#3B2416', light: '#FFFFFF' }, // Etudesk brand colors
    });

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `inline; filename="qr-${result.rows[0].slug}.png"`);
    res.send(qrBuffer);
  } catch (error) {
    logger.error('QR generation error', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * GET /api/v1/short-links/:id/qr.svg
 * Generate QR code as SVG string
 */
router.get('/:id/qr.svg', async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT slug FROM short_links WHERE id = $1', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Link not found' });
    }

    const url = `${BASE_URL}/link/${result.rows[0].slug}`;

    const svg = await QRCode.toString(url, {
      type: 'svg',
      margin: 2,
      color: { dark: '#3B2416', light: '#FFFFFF' },
    });

    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(svg);
  } catch (error) {
    logger.error('QR SVG generation error', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

export default router;
