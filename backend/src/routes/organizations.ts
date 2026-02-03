/**
 * Organizations Routes - Modular Structure
 *
 * Migration Status:
 * - [x] GET / - migrated to organizations/read.routes.ts
 * - [x] GET /my - migrated
 * - [x] GET /:id - migrated
 * - [x] POST / - migrated to organizations/write.routes.ts
 * - [x] PUT /:id - migrated
 * - [x] DELETE /:id - migrated
 */

// Migration complete - using new modular structure
export { default } from './organizations/index';
