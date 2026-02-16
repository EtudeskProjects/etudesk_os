import express, { Request, Response } from 'express';
import { communityActivityService } from '../services/community-activity.service';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { communityMemberMiddleware } from '../middleware/community-access.middleware';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

import { logger } from '../utils';
import { debitWalletForAction } from '../services/billing/credit.service';
const router = express.Router();

// File upload configuration
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${uuidv4()}${ext}`);
    },
});

const upload = multer({
    storage,
    limits: {
        fileSize: 20 * 1024 * 1024, // 20MB limit (per spec)
        files: 5
    }
});

// GET /api/communities/:communityId/activities
router.get('/:communityId/activities', authMiddleware, communityMemberMiddleware, async (req: any, res: Response) => {
    try {
        const { communityId } = req.params;
        const { limit, cursor } = req.query;
        // req is AuthRequest, so it has talentId and userId
        const userId = req.talentId || req.userId;

        logger.info(`[Activities] Fetching for community: ${communityId}, user: ${userId}`);

        const result = await communityActivityService.getCommunityFeed(
            communityId,
            userId,
            limit ? parseInt(limit as string) : 20,
            cursor as string
        );

        logger.info(`[Activities] Found ${result.data.length} activities`);

        res.json(result);
    } catch (error: any) {
        logger.error('Error fetching activities:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/communities/:communityId/activities
router.post('/:communityId/activities', authMiddleware, upload.array('attachments', 5), async (req: any, res: Response) => {
    try {
        const { communityId } = req.params;
        const userId = req.talentId || req.userId;
        const { type, content, metadata, scheduled_at, is_draft } = req.body;
        const isDraft = is_draft === true || is_draft === 'true';

        logger.info(`[Activities] Creating activity - community: ${communityId}, author: ${userId}, type: ${type}, is_draft: ${is_draft}`);

        // Process attachments
        const files = req.files as Express.Multer.File[];
        const attachmentUrls = files ? files.map(f => `/uploads/${f.filename}`) : [];

        // Handle metadata: can be string (from FormData) or object (from JSON)
        // BUG FIX: Reject invalid JSON explicitly instead of using as-is
        let parsedMetadata = undefined;
        if (metadata) {
            if (typeof metadata === 'string') {
                try {
                    parsedMetadata = JSON.parse(metadata);
                } catch (parseError) {
                    return res.status(400).json({ error: req.t('communities:invalidMetadataFormat') });
                }
            } else {
                parsedMetadata = metadata; // Already an object
            }
        }

        // Credit rule: if user schedules a publication (scheduled_at), charge TALENT_SCHEDULED_TASK.
        // If wallet has insufficient credits, DO NOT create the activity.
        if (scheduled_at && !isDraft) {
            const idempotencyHeader = req.headers['x-idempotency-key'];
            const idempotencyValue = Array.isArray(idempotencyHeader)
                ? idempotencyHeader[0]
                : idempotencyHeader;

            const contentHash = crypto
                .createHash('sha1')
                .update(String(content || ''))
                .digest('hex')
                .slice(0, 12);

            const debitKey = idempotencyValue
                ? `scheduled_activity_${idempotencyValue}`
                : `scheduled_activity_${userId}_${communityId}_${scheduled_at}_${type}_${contentHash}`;

            try {
                await debitWalletForAction({
                    scope: 'TALENT',
                    ownerId: userId,
                    actionCode: 'TALENT_SCHEDULED_TASK',
                    idempotencyKey: debitKey,
                    metadata: {
                        channel: 'community_activity',
                        communityId,
                        type,
                        scheduled_at,
                    },
                    createdBy: userId,
                });
            } catch (debitError: any) {
                if (String(debitError?.message || '').includes('INSUFFICIENT_CREDITS')) {
                    return res.status(402).json({
                        error: req.t('billing:insufficientCreditsForPublication'),
                        code: 'INSUFFICIENT_CREDITS',
                    });
                }
                throw debitError;
            }
        }

        const activity = await communityActivityService.createActivity({
            community_id: communityId,
            author_id: userId,
            type,
            content,
            metadata: parsedMetadata,
            attachments: attachmentUrls,
            scheduled_at: scheduled_at || null,
            is_draft: isDraft
        });

        logger.info(`[Activities] Created activity: ${activity.id}, moderation_status: ${activity.moderation_status}, is_draft: ${activity.is_draft}`);

        res.status(201).json(activity);
    } catch (error: any) {
        logger.error('Error creating activity:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/activities/bookmarks - Get all bookmarked activities (MUST be before :activityId routes)
router.get('/activities/bookmarks', authMiddleware, async (req: any, res: Response) => {
    try {
        const userId = req.talentId || req.userId;

        const bookmarkedActivities = await communityActivityService.getMyBookmarkedActivities(userId);

        res.json({ data: bookmarkedActivities });
    } catch (error: any) {
        logger.error('Error fetching bookmarked activities:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/activities/:activityId/reaction (now just likes)
// Note: Route mounted at /api so full path is /api/activities/:activityId/reaction
router.post('/activities/:activityId/reaction', authMiddleware, async (req: any, res: Response) => {
    try {
        const { activityId } = req.params;
        const userId = req.talentId || req.userId;

        const isLiked = await communityActivityService.toggleLike(activityId, userId);

        res.json({ success: true, isLiked });
    } catch (error: any) {
        logger.error('Error toggling like:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/activities/:activityId/like - Alias for /reaction (frontend uses /like)
router.post('/activities/:activityId/like', authMiddleware, async (req: any, res: Response) => {
    try {
        const { activityId } = req.params;
        const userId = req.talentId || req.userId;

        const isLiked = await communityActivityService.toggleLike(activityId, userId);

        res.json({ success: true, isLiked });
    } catch (error: any) {
        logger.error('Error toggling like:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/activities/:activityId/comments
router.post('/activities/:activityId/comments', authMiddleware, async (req: any, res: Response) => {
    try {
        const { activityId } = req.params;
        const userId = req.talentId || req.userId;
        const { content, parentId, mentions } = req.body;

        const comment = await communityActivityService.addComment({
            activity_id: activityId,
            author_id: userId,
            content,
            parent_id: parentId,
            mentions
        });

        res.status(201).json(comment);
    } catch (error: any) {
        logger.error('Error adding comment:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/activities/:activityId/comments/:commentId - Update a comment
router.put('/activities/:activityId/comments/:commentId', authMiddleware, async (req: any, res: Response) => {
    try {
        const { commentId } = req.params;
        const { content, mentions } = req.body;
        const userId = req.talentId || req.userId;

        const comment = await communityActivityService.updateComment(commentId, userId, {
            content,
            mentions
        });

        res.json({ data: comment });
    } catch (error: any) {
        logger.error('Error updating comment:', error);
        res.status(400).json({ error: error.message });
    }
});

// DELETE /api/activities/:activityId/comments/:commentId - Delete a comment
router.delete('/activities/:activityId/comments/:commentId', authMiddleware, async (req: any, res: Response) => {
    try {
        const { commentId } = req.params;
        const userId = req.talentId || req.userId;

        await communityActivityService.deleteComment(commentId, userId);

        res.json({ success: true });
    } catch (error: any) {
        logger.error('Error deleting comment:', error);
        res.status(400).json({ error: error.message });
    }
});

// POST /api/activities/:activityId/vote
router.post('/activities/:activityId/vote', authMiddleware, async (req: any, res: Response) => {
    try {
        const { activityId } = req.params;
        const userId = req.talentId || req.userId;
        const { optionId } = req.body;

        await communityActivityService.votePoll(activityId, userId, optionId);

        res.json({ success: true });
    } catch (error: any) {
        logger.error('Error voting on poll:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/activities/:activityId/bookmark
router.post('/activities/:activityId/bookmark', authMiddleware, async (req: any, res: Response) => {
    try {
        const { activityId } = req.params;
        const userId = req.talentId || req.userId;

        const isBookmarked = await communityActivityService.toggleBookmark(activityId, userId);

        res.json({ success: true, isBookmarked });
    } catch (error: any) {
        logger.error('Error toggling bookmark:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/activities/:activityId/bookmark
router.delete('/activities/:activityId/bookmark', authMiddleware, async (req: any, res: Response) => {
    try {
        const { activityId } = req.params;
        const userId = req.talentId || req.userId;

        await communityActivityService.toggleBookmark(activityId, userId);

        res.json({ success: true, isBookmarked: false });
    } catch (error: any) {
        logger.error('Error removing bookmark:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/activities/:activityId/bookmark
router.get('/activities/:activityId/bookmark', authMiddleware, async (req: any, res: Response) => {
    try {
        const { activityId } = req.params;
        const userId = req.talentId || req.userId;

        // Check bookmark status via activity details
        const { activity } = await communityActivityService.getActivityDetails(activityId, userId);

        res.json({ isBookmarked: activity.is_bookmarked || false });
    } catch (error: any) {
        logger.error('Error checking bookmark status:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/activities/:activityId
router.delete('/activities/:activityId', authMiddleware, async (req: any, res: Response) => {
    try {
        const { activityId } = req.params;
        const userId = req.talentId || req.userId;
        await communityActivityService.deleteActivity(activityId, userId);
        res.json({ success: true });
    } catch (error: any) {
        logger.error('Error deleting activity:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/activities/:activityId/pin
router.post('/activities/:activityId/pin', authMiddleware, async (req: any, res: Response) => {
    try {
        const { activityId } = req.params;
        const userId = req.talentId || req.userId;
        const isPinned = await communityActivityService.togglePin(activityId, userId);
        res.json({ success: true, isPinned });
    } catch (error: any) {
        logger.error('Error pinning activity:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/activities/:activityId
router.get('/activities/:activityId', authMiddleware, async (req: any, res: Response) => {
    try {
        const { activityId } = req.params;
        const userId = req.talentId || req.userId;
        const details = await communityActivityService.getActivityDetails(activityId, userId);
        res.json(details);
    } catch (error: any) {
        logger.error('Error getting activity details:', error);
        res.status(500).json({ error: error.message });
    }
});

// --- Drafts Routes ---

// GET /api/:communityId/activities/drafts - Get user's drafts for a community
// Query params: ?type=POST|EVENT|POLL (optional)
router.get('/:communityId/activities/drafts', authMiddleware, async (req: any, res: Response) => {
    try {
        const { communityId } = req.params;
        const { type } = req.query;
        const userId = req.talentId || req.userId;

        // Validate type if provided
        const validTypes = ['POST', 'EVENT', 'POLL'];
        if (type && !validTypes.includes(type)) {
            return res.status(400).json({ error: req.t('communities:invalidTypeError', { types: validTypes.join(', ') }) });
        }

        const drafts = await communityActivityService.getDrafts(communityId, userId, type);

        res.json({ data: drafts });
    } catch (error: any) {
        logger.error('Error fetching drafts:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/:communityId/activities/draft/:type - Get a single draft by type (for pre-filling forms)
router.get('/:communityId/activities/draft/:type', authMiddleware, async (req: any, res: Response) => {
    try {
        const { communityId, type } = req.params;
        const userId = req.talentId || req.userId;

        // Validate type
        const validTypes = ['POST', 'EVENT', 'POLL'];
        if (!validTypes.includes(type)) {
            return res.status(400).json({ error: req.t('communities:invalidTypeError', { types: validTypes.join(', ') }) });
        }

        const draft = await communityActivityService.getDraftByType(communityId, userId, type);

        // Returns null if no draft exists (not an error)
        res.json({ data: draft });
    } catch (error: any) {
        logger.error('Error fetching draft by type:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/activities/:activityId/publish - Publish a draft
router.put('/activities/:activityId/publish', authMiddleware, async (req: any, res: Response) => {
    try {
        const { activityId } = req.params;
        const userId = req.talentId || req.userId;

        const activity = await communityActivityService.publishDraft(activityId, userId);

        res.json({ data: activity });
    } catch (error: any) {
        logger.error('Error publishing draft:', error);
        res.status(400).json({ error: error.message });
    }
});

export default router;
