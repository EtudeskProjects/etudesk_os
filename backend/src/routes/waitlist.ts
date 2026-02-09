import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../services/database';
import { waitlistLimiter } from '../middleware/rateLimit.middleware';
import { logger } from '../utils';

const router = Router();

const waitlistSchema = z.object({
  type: z.enum(['TALENT', 'ORGANIZATION']),
  country: z.string().min(1).max(100),
  contactType: z.enum(['EMAIL', 'WHATSAPP']),
  contactValue: z.string().min(1).max(255),
});

/**
 * POST /api/waitlist
 * Public endpoint — no auth required
 */
router.post('/', waitlistLimiter, async (req: Request, res: Response) => {
  try {
    const parsed = waitlistSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid data', details: parsed.error.flatten().fieldErrors });
    }

    const { type, country, contactType, contactValue } = parsed.data;

    // Basic email validation
    if (contactType === 'EMAIL' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactValue)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    // Basic WhatsApp validation (digits, optional +, 7-15 chars)
    if (contactType === 'WHATSAPP' && !/^\+?\d{7,15}$/.test(contactValue)) {
      return res.status(400).json({ error: 'Invalid WhatsApp number' });
    }

    await pool.query(
      `INSERT INTO waitlist (type, country, contact_type, contact_value)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (contact_value)
       DO UPDATE SET type = EXCLUDED.type, country = EXCLUDED.country, contact_type = EXCLUDED.contact_type`,
      [type, country, contactType, contactValue],
    );

    logger.info('Waitlist signup', { type, country, contactType });

    res.status(201).json({ success: true });
  } catch (error) {
    logger.error('Waitlist error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
