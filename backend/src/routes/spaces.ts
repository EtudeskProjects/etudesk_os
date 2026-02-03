/**
 * Spaces Routes - Progressive Migration
 *
 * This file re-exports the legacy routes while we progressively migrate
 * to the new modular structure in ./spaces/
 *
 * Migration Status:
 * - [x] GET / - migrated to spaces/read.routes.ts
 * - [x] GET /organization/:orgId - migrated
 * - [x] GET /slug/:slug - migrated
 * - [x] GET /:id - migrated
 * - [x] GET /:id/availabilities - migrated
 * - [x] GET /:id/availability-check - migrated
 * - [x] GET /:spaceId/bookings/counts - migrated
 * - [x] POST / - migrated to spaces/write.routes.ts
 * - [x] POST /generate - migrated
 * - [x] PUT /:id - migrated
 * - [x] PUT /:id/availabilities - migrated
 * - [x] POST /:id/unavailabilities - migrated
 * - [x] DELETE /:id - migrated
 * - [x] GET /:id/bookings - migrated to spaces/bookings.routes.ts
 * - [x] POST /:id/book - migrated
 * - [x] GET /bookings/my - migrated
 * - [x] GET /bookings/organization/:orgId - migrated
 * - [x] GET /bookings/:id - migrated
 * - [x] POST /bookings/:id/confirm - migrated
 * - [x] POST /bookings/:id/cancel - migrated
 * - [x] POST /bookings/:id/complete - migrated
 * - [x] PUT /bookings/:id/status - migrated
 * - [x] PUT /bookings/:id/notes - migrated
 * - [x] PUT /bookings/:id/rating - migrated
 * - [x] POST /bookings/:id/no-show - migrated
 * - [x] DELETE /bookings/:id - migrated
 * - [x] GET /bookings/:id/messages - migrated to spaces/messages.routes.ts
 * - [x] POST /bookings/:id/messages - migrated
 * - [x] PUT /bookings/:id/messages/read-all - migrated
 * - [x] GET /bookings/:id/messages/unread-count - migrated
 *
 * Once all routes are migrated and tested, switch to: export { default } from './spaces';
 */

// Migration complete - using new modular structure
export { default } from './spaces/index';
