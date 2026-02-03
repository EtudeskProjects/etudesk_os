/**
 * Communities Routes - Progressive Migration
 *
 * This file re-exports the legacy routes while we progressively migrate
 * to the new modular structure in ./communities/
 *
 * Migration Status:
 * - [x] GET / - migrated to communities/read.routes.ts
 * - [x] GET /organization/:orgId - migrated
 * - [x] GET /:id - migrated
 * - [x] GET /:id/stats - migrated
 * - [x] POST /generate - migrated to communities/write.routes.ts
 * - [x] POST / - migrated
 * - [x] PUT /:id - migrated
 * - [x] DELETE /:id - migrated
 * - [x] GET /:id/members - migrated to communities/members.routes.ts
 * - [x] GET /:id/recent-members - migrated
 * - [x] POST /:id/join - migrated
 * - [x] DELETE /:id/leave - migrated
 * - [x] PUT /:id/members/:memberId - migrated
 * - [x] DELETE /:id/members/:memberId - migrated
 * - [ ] GET /:id/membership - legacy
 * - [ ] POST /:id/leave (legacy version)
 * - [ ] POST /:id/cancel-request - legacy
 * - [ ] GET /memberships/me - legacy
 * - [ ] GET /members/:membershipId - legacy
 * - [ ] PUT /members/:membershipId/status - legacy
 * - [ ] PUT /members/:membershipId/notes - legacy
 * - [ ] PUT /members/:membershipId/rating - legacy
 * - [ ] GET/PUT permissions routes - legacy
 * - [ ] GET/POST messages routes - legacy
 *
 * Once all routes are migrated, delete this file and communities.legacy.ts,
 * then update index.ts to import from ./communities/
 */

// Migration complete - using new modular structure
export { default } from './communities/index';
