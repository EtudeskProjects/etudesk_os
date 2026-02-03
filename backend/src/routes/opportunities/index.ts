/**
 * Opportunities Routes - Modular Structure
 * Aggregates all opportunity-related routes
 */

import { Router } from 'express';
import readRoutes from './read.routes';
import writeRoutes from './write.routes';
import applicationsRoutes from './applications.routes';

const router = Router();

// Mount sub-routers
router.use('/', readRoutes);
router.use('/', writeRoutes);
router.use('/', applicationsRoutes);

export default router;
