/**
 * Applications Routes - Progressive Migration
 *
 * This file re-exports the legacy routes while we progressively migrate
 * to the new modular structure in ./applications/
 *
 * Migration Status:
 * - [x] POST / - migrated to applications/talent.routes.ts
 * - [x] GET /me - migrated
 * - [x] GET /check/:opportunityId - migrated
 * - [x] GET /:id - migrated
 * - [x] PUT /:id/withdraw - migrated
 * - [x] DELETE /:id - migrated
 * - [x] GET /opportunity/:opportunityId - migrated to applications/organization.routes.ts
 * - [x] GET /opportunity/:opportunityId/ranked - migrated
 * - [x] GET /opportunity/:opportunityId/export-csv - migrated
 * - [x] GET /:id/recommendation - migrated
 * - [x] PUT /:id/status - migrated
 * - [x] PUT /:id/notes - migrated
 * - [x] PUT /:id/rating - migrated
 * - [x] PUT /:id/view - migrated
 * - [x] PUT /bulk/status - migrated
 * - [x] DELETE /:id/organization - migrated
 * - [x] GET /:id/messages - migrated to applications/messages.routes.ts
 * - [x] POST /:id/messages - migrated
 * - [x] PUT /:id/messages/read-all - migrated
 *
 * Once all routes are migrated and tested, switch to: export { default } from './applications';
 */

// Migration complete - using new modular structure
export { default } from './applications/index';
