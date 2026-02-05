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
router.use('/', membersRoutes); // Must be first to handle specific paths like /memberships/me
router.use('/', readRoutes);
router.use('/', writeRoutes);

export default router;
