/**
 * Applications Routes - Modular Structure
 * Aggregates all application-related routes
 */

import { Router } from 'express';
import talentRoutes from './talent.routes';
import organizationRoutes from './organization.routes';
import messagesRoutes from './messages.routes';

const router = Router();

// Mount sub-routers
router.use('/', talentRoutes);
router.use('/', organizationRoutes);
router.use('/', messagesRoutes);

export default router;
