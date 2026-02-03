/**
 * Payment Methods Routes
 * Handles CRUD operations for user payment methods
 */

import { Router, Response } from 'express';
import { pool } from '../services/database';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { v4 as uuidv4 } from 'uuid';

import { logger } from '../utils';
const router = Router();

type PaymentProvider = 'orange_money' | 'mtn_money' | 'moov_money' | 'wave' | 'push' | 'djamo';

interface PaymentMethod {
  id: string;
  provider: PaymentProvider;
  phone: string;
  isDefault: boolean;
}

const VALID_PROVIDERS: PaymentProvider[] = ['orange_money', 'mtn_money', 'moov_money', 'wave', 'push', 'djamo'];

/**
 * GET /api/payment-methods
 * Get all payment methods for current user
 */
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.talentId) {
      return res.status(404).json({ error: 'Talent profile not found' });
    }

    const result = await pool.query(
      `SELECT payment_methods FROM talents WHERE id = $1 AND deleted_at IS NULL`,
      [req.talentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Talent profile not found' });
    }

    const paymentMethods = result.rows[0].payment_methods || [];
    res.json({ data: paymentMethods });
  } catch (error) {
    logger.error('Error fetching payment methods:', error);
    res.status(500).json({ error: 'Failed to fetch payment methods' });
  }
});

/**
 * POST /api/payment-methods
 * Add a new payment method
 */
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.talentId) {
      return res.status(404).json({ error: 'Talent profile not found' });
    }

    const { provider, phone } = req.body;

    // Validate input
    if (!provider || !VALID_PROVIDERS.includes(provider)) {
      return res.status(400).json({ error: 'Invalid payment provider' });
    }

    if (!phone || typeof phone !== 'string' || phone.trim().length < 8) {
      return res.status(400).json({ error: 'Invalid phone number' });
    }

    // Get current payment methods
    const result = await pool.query(
      `SELECT payment_methods FROM talents WHERE id = $1 AND deleted_at IS NULL`,
      [req.talentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Talent profile not found' });
    }

    const paymentMethods: PaymentMethod[] = result.rows[0].payment_methods || [];

    // Check if this provider + phone combo already exists
    const exists = paymentMethods.some(
      (m) => m.provider === provider && m.phone === phone.trim()
    );
    if (exists) {
      return res.status(400).json({ error: 'This payment method already exists' });
    }

    // Create new payment method
    const newMethod: PaymentMethod = {
      id: uuidv4(),
      provider,
      phone: phone.trim(),
      isDefault: paymentMethods.length === 0, // First one is default
    };

    paymentMethods.push(newMethod);

    // Update database
    await pool.query(
      `UPDATE talents SET payment_methods = $1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(paymentMethods), req.talentId]
    );

    logger.info(`✅ Payment method added for talent: ${req.talentId}`);
    res.status(201).json({ data: newMethod });
  } catch (error) {
    logger.error('Error adding payment method:', error);
    res.status(500).json({ error: 'Failed to add payment method' });
  }
});

/**
 * PUT /api/payment-methods/:id/default
 * Set a payment method as default
 */
router.put('/:id/default', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.talentId) {
      return res.status(404).json({ error: 'Talent profile not found' });
    }

    const { id } = req.params;

    // Get current payment methods
    const result = await pool.query(
      `SELECT payment_methods FROM talents WHERE id = $1 AND deleted_at IS NULL`,
      [req.talentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Talent profile not found' });
    }

    const paymentMethods: PaymentMethod[] = result.rows[0].payment_methods || [];

    // Find the method
    const methodIndex = paymentMethods.findIndex((m) => m.id === id);
    if (methodIndex === -1) {
      return res.status(404).json({ error: 'Payment method not found' });
    }

    // Update defaults
    paymentMethods.forEach((m) => {
      m.isDefault = m.id === id;
    });

    // Update database
    await pool.query(
      `UPDATE talents SET payment_methods = $1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(paymentMethods), req.talentId]
    );

    logger.info(`✅ Default payment method set: ${id} for talent: ${req.talentId}`);
    res.json({ data: paymentMethods });
  } catch (error) {
    logger.error('Error setting default payment method:', error);
    res.status(500).json({ error: 'Failed to set default payment method' });
  }
});

/**
 * DELETE /api/payment-methods/:id
 * Delete a payment method
 */
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.talentId) {
      return res.status(404).json({ error: 'Talent profile not found' });
    }

    const { id } = req.params;

    // Get current payment methods
    const result = await pool.query(
      `SELECT payment_methods FROM talents WHERE id = $1 AND deleted_at IS NULL`,
      [req.talentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Talent profile not found' });
    }

    let paymentMethods: PaymentMethod[] = result.rows[0].payment_methods || [];

    // Find the method
    const methodIndex = paymentMethods.findIndex((m) => m.id === id);
    if (methodIndex === -1) {
      return res.status(404).json({ error: 'Payment method not found' });
    }

    const wasDefault = paymentMethods[methodIndex].isDefault;

    // Remove the method
    paymentMethods = paymentMethods.filter((m) => m.id !== id);

    // If deleted was default and there are still methods, set first as default
    if (wasDefault && paymentMethods.length > 0) {
      paymentMethods[0].isDefault = true;
    }

    // Update database
    await pool.query(
      `UPDATE talents SET payment_methods = $1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(paymentMethods), req.talentId]
    );

    logger.info(`✅ Payment method deleted: ${id} for talent: ${req.talentId}`);
    res.json({ data: paymentMethods });
  } catch (error) {
    logger.error('Error deleting payment method:', error);
    res.status(500).json({ error: 'Failed to delete payment method' });
  }
});

export default router;
