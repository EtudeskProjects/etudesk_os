/**
 * Communities Routes - Modular Structure
 *
 * This file aggregates all community-related routes.
 * Routes are split by domain for better maintainability.
 */

import { Router } from 'express';
import readRoutes from './read.routes';
import writeRoutes from './write.routes';
import membersRoutes from './members.routes';

const router = Router();

// Mount sub-routers
router.use('/', readRoutes);
router.use('/', writeRoutes);
router.use('/', membersRoutes);

export default router;
