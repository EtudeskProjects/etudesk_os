/**
 * Opportunities Routes - Modular Structure
 *
 * Migration Status:
 * - [x] POST /generate - migrated to opportunities/write.routes.ts
 * - [x] GET /can-generate - migrated to opportunities/read.routes.ts
 * - [x] GET / - migrated
 * - [x] GET /organization/:orgId - migrated
 * - [x] GET /:id - migrated
 * - [x] POST / - migrated to opportunities/write.routes.ts
 * - [x] PUT /:id - migrated
 * - [x] DELETE /:id - migrated
 * - [x] GET /:id/applications - migrated to opportunities/applications.routes.ts
 * - [x] GET /:id/applications/counts - migrated
 */

// Migration complete - using new modular structure
export { default } from './opportunities/index';
