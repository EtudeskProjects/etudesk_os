/**
 * Organizations Routes - Modular Structure
 * Aggregates all organization-related routes
 */

import { Router } from 'express';
import readRoutes from './read.routes';
import writeRoutes from './write.routes';

const router = Router();

// Mount sub-routers
router.use('/', readRoutes);
router.use('/', writeRoutes);

export default router;
