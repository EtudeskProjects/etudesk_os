/**
 * KYC (Know Your Customer) Routes
 * Handles identity verification document uploads with AI vision verification
 */

import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../services/database';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { logger } from '../utils';
import {
  verifyKYCDocument,
  DocumentType,
  VerificationResult,
} from '../services/kyc-verification.service';

const router = Router();

// Valid document types for KYC
const VALID_DOCUMENT_TYPES: DocumentType[] = ['ID_CARD', 'PASSPORT', 'DRIVER_LICENSE'];

// Valid verification statuses
const VERIFICATION_STATUSES = ['PENDING', 'VERIFIED', 'REJECTED'];

/**
 * GET /api/kyc/status
 * Get current KYC verification status
 */
router.get('/status', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.talentId) {
      return res.status(404).json({ error: req.t('talents:profileNotFound') });
    }

    const result = await pool.query(`
      SELECT
        kv.id, kv.document_type, kv.status, kv.rejection_reason,
        kv.front_image_url, kv.back_image_url,
        kv.submitted_at, kv.verified_at, kv.created_at
      FROM kyc_verifications kv
      WHERE kv.talent_id = $1
      ORDER BY kv.created_at DESC
      LIMIT 1
    `, [req.talentId]);

    if (result.rows.length === 0) {
      return res.json({
        data: {
          status: 'NONE',
          hasSubmission: false,
        }
      });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    logger.error('Error fetching KYC status:', error);
    res.status(500).json({ error: req.t('kyc:fetchStatusError') });
  }
});

/**
 * POST /api/kyc/submit
 * Submit KYC verification documents with AI verification
 */
router.post('/submit', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.talentId) {
      return res.status(404).json({ error: req.t('talents:profileNotFound') });
    }

    const {
      document_type,
      front_image_url,
      back_image_url,
    } = req.body;

    // Validation
    if (!document_type || !VALID_DOCUMENT_TYPES.includes(document_type)) {
      return res.status(400).json({
        error: req.t('kyc:invalidDocumentType'),
        validTypes: VALID_DOCUMENT_TYPES
      });
    }

    if (!front_image_url) {
      return res.status(400).json({ error: req.t('kyc:frontImageRequired') });
    }

    // SECURITY: Only allow /uploads/ paths and data: URIs — reject file://, http(s)://, absolute paths
    const isAllowedUrl = (url: string) => url.startsWith('/uploads/') || url.startsWith('data:');
    if (!isAllowedUrl(front_image_url)) {
      return res.status(400).json({ error: 'Invalid image URL format. Only uploaded images are accepted.' });
    }
    if (back_image_url && !isAllowedUrl(back_image_url)) {
      return res.status(400).json({ error: 'Invalid image URL format. Only uploaded images are accepted.' });
    }

    // Check if already verified
    const existingVerified = await pool.query(`
      SELECT id FROM kyc_verifications
      WHERE talent_id = $1 AND status = 'VERIFIED'
    `, [req.talentId]);

    if (existingVerified.rows.length > 0) {
      return res.status(400).json({
        error: req.t('kyc:alreadyVerified')
      });
    }

    logger.info(`📋 KYC submission received for talent ${req.talentId}`);

    // Verify document with OpenAI vision
    let verificationResult: VerificationResult;
    try {
      verificationResult = await verifyKYCDocument(
        req.talentId,
        document_type as DocumentType,
        front_image_url,
        back_image_url
      );
    } catch (verifyError) {
      logger.error('Verification service error:', verifyError);
      // If verification service fails, set to pending for manual review
      verificationResult = {
        success: false,
        is_verified: false,
        verification_score: 0,
        document_analysis: {
          detected_document_type: 'UNKNOWN',
          document_type_confidence: 0,
          is_valid_document: false,
          document_quality: 'POOR',
          extracted_info: {
            first_name: null,
            last_name: null,
            full_name: null,
            document_number: null,
            expiry_date: null,
            country: null,
          },
          front_analysis: {
            is_front_side: false,
            has_photo: false,
            is_readable: false,
            issues: ['Vérification automatique indisponible'],
          },
        },
        profile_match: {
          names_match: false,
          match_confidence: 0,
          extracted_name: null,
          profile_name: null,
        },
        rejection_reasons: [],
        warnings: ['Vérification automatique indisponible, révision manuelle requise'],
      };
    }

    // Determine status based on verification (only VERIFIED or REJECTED)
    let status: 'VERIFIED' | 'REJECTED';
    let rejectionReason: string | null = null;

    if (verificationResult.success && verificationResult.is_verified) {
      status = 'VERIFIED';
      logger.info(`✅ KYC verified for talent ${req.talentId} (score: ${verificationResult.verification_score})`);
    } else {
      status = 'REJECTED';
      rejectionReason = verificationResult.rejection_reasons.length > 0
        ? verificationResult.rejection_reasons.join('; ')
        : 'Document non conforme ou illisible';
      logger.info(`❌ KYC rejected for talent ${req.talentId}: ${rejectionReason}`);
    }

    // Create KYC verification record
    const id = uuidv4();
    const result = await pool.query(`
      INSERT INTO kyc_verifications (
        id, talent_id, document_type, front_image_url, back_image_url,
        status, rejection_reason, verification_score, verification_details,
        submitted_at, verified_at, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        NOW(), ${status === 'VERIFIED' ? 'NOW()' : 'NULL'}, NOW()
      ) RETURNING *
    `, [
      id,
      req.talentId,
      document_type,
      front_image_url,
      back_image_url || null,
      status,
      rejectionReason,
      verificationResult.verification_score,
      JSON.stringify({
        document_analysis: verificationResult.document_analysis,
        profile_match: verificationResult.profile_match,
        warnings: verificationResult.warnings,
      }),
    ]);

    // Return response with verification details
    res.status(201).json({
      data: {
        ...result.rows[0],
        verification_result: {
          is_verified: verificationResult.is_verified,
          verification_score: verificationResult.verification_score,
          document_type_detected: verificationResult.document_analysis.detected_document_type,
          document_quality: verificationResult.document_analysis.document_quality,
          names_match: verificationResult.profile_match.names_match,
          extracted_name: verificationResult.profile_match.extracted_name,
          rejection_reasons: verificationResult.rejection_reasons,
          warnings: verificationResult.warnings,
        },
      },
    });
  } catch (error) {
    logger.error('Error submitting KYC:', error);
    res.status(500).json({ error: req.t('kyc:submitError') });
  }
});

/**
 * POST /api/kyc/upload-url
 * Get a pre-signed URL for uploading KYC documents
 * In production, this would return a signed S3/Cloud Storage URL
 */
router.post('/upload-url', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.talentId) {
      return res.status(404).json({ error: req.t('talents:profileNotFound') });
    }

    const { filename, content_type } = req.body;

    if (!filename || !content_type) {
      return res.status(400).json({ error: req.t('common:filenameAndContentTypeRequired') });
    }

    // Validate content type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(content_type)) {
      return res.status(400).json({
        error: req.t('common:invalidFileTypeAllowed'),
        allowedTypes
      });
    }

    // In production, generate a pre-signed URL for S3/Cloud Storage
    // For now, we'll return a placeholder URL structure
    const fileId = uuidv4();
    const extension = filename.split('.').pop() || 'jpg';
    const storedFilename = `kyc/${req.talentId}/${fileId}.${extension}`;

    // In development, use local image upload endpoint
    // In production, this would be a cloud storage URL
    const uploadUrl = process.env.NODE_ENV === 'production'
      ? `${process.env.STORAGE_URL}/upload/${storedFilename}`
      : `/api/images/upload`;

    const publicUrl = process.env.NODE_ENV === 'production'
      ? `${process.env.CDN_URL}/${storedFilename}`
      : `/uploads/${storedFilename}`;

    res.json({
      data: {
        uploadUrl,
        publicUrl,
        fileId,
        expiresIn: 3600, // 1 hour
      }
    });
  } catch (error) {
    logger.error('Error generating upload URL:', error);
    res.status(500).json({ error: req.t('kyc:uploadUrlError') });
  }
});

/**
 * GET /api/kyc/history
 * Get KYC verification history
 */
router.get('/history', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.talentId) {
      return res.status(404).json({ error: req.t('talents:profileNotFound') });
    }

    const result = await pool.query(`
      SELECT
        id, document_type, status, rejection_reason,
        submitted_at, verified_at, created_at
      FROM kyc_verifications
      WHERE talent_id = $1
      ORDER BY created_at DESC
    `, [req.talentId]);

    res.json({ data: result.rows, count: result.rowCount });
  } catch (error) {
    logger.error('Error fetching KYC history:', error);
    res.status(500).json({ error: req.t('kyc:fetchHistoryError') });
  }
});

export default router;
