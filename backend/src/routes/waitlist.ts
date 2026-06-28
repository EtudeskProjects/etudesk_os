import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../services/database';
import { waitlistLimiter } from '../middleware/rateLimit.middleware';
import { sendEmail } from '../services/email.service';
import { logger } from '../utils';

const router = Router();
const WAITLIST_NOTIFY_EMAIL = process.env.WAITLIST_NOTIFY_EMAIL || 'etudesksas@gmail.com';

const waitlistSchema = z.object({
  type: z.enum(['TALENT', 'ORGANIZATION']),
  country: z.string().min(1).max(100),
  contactType: z.enum(['EMAIL']).default('EMAIL'),
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
      return res.status(400).json({ error: req.t('validation:validationFailed'), details: parsed.error.flatten().fieldErrors });
    }

    const { type, country, contactType, contactValue } = parsed.data;

    // Normalize inputs for common mobile copy/paste/autocorrect issues
    const cleanedEmail = contactValue.trim().toLowerCase().replace(/\s+/g, '').replace(/[,\.;]+$/, '');

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanedEmail)) {
      return res.status(400).json({ error: req.t('common:invalidEmail') });
    }

    const storedContactValue = cleanedEmail;

    await pool.query(
      `INSERT INTO waitlist (type, country, contact_type, contact_value)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (contact_value)
       DO UPDATE SET type = EXCLUDED.type, country = EXCLUDED.country, contact_type = EXCLUDED.contact_type`,
      [type, country, 'EMAIL', storedContactValue],
    );

    const escapeHtml = (value: string): string =>
      value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    // Notify admin on each new waitlist signup (non-blocking)
    sendEmail({
      to: WAITLIST_NOTIFY_EMAIL,
      subject: `[Waitlist] Nouvelle inscription ${type}`,
      html: `
        <h2>Nouvelle inscription waitlist</h2>
        <p><strong>Type:</strong> ${escapeHtml(type)}</p>
        <p><strong>Pays:</strong> ${escapeHtml(country)}</p>
        <p><strong>Canal:</strong> ${escapeHtml(contactType)}</p>
        <p><strong>Contact:</strong> ${escapeHtml(storedContactValue)}</p>
        <p><strong>Date:</strong> ${new Date().toISOString()}</p>
      `.trim(),
      text: [
        'Nouvelle inscription waitlist',
        `Type: ${type}`,
        `Pays: ${country}`,
        `Canal: ${contactType}`,
        `Contact: ${storedContactValue}`,
        `Date: ${new Date().toISOString()}`,
      ].join('\n'),
    }).then((result) => {
      if (!result.success) {
        logger.warn('Waitlist notification email failed', { error: result.error });
      }
    }).catch((emailError) => {
      logger.warn('Waitlist notification email exception', { error: String(emailError) });
    });

    logger.info('Waitlist signup', { type, country, contactType });

    res.status(201).json({ success: true });
  } catch (error) {
    logger.error('Waitlist error:', error);
    res.status(500).json({ error: req.t('common:internalError') });
  }
});

export default router;
