/**
 * Spaces Routes - Modular Structure
 * Aggregates all space-related routes
 */

import { Router } from 'express';
import readRoutes from './read.routes';
import writeRoutes from './write.routes';
import bookingsRoutes from './bookings.routes';
import messagesRoutes from './messages.routes';

const router = Router();

// Mount sub-routers
router.use('/', readRoutes);
router.use('/', writeRoutes);
router.use('/', bookingsRoutes);
router.use('/', messagesRoutes);

export default router;
