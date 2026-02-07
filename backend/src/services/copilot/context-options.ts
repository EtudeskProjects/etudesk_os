/**
 * Mode-Specific Context Options
 * Controls what data is loaded for each copilot mode to optimize token usage.
 */

import { ContextLoadOptions, EXPLORER_CONTEXT_OPTIONS } from './context';

/**
 * STUDY mode: Only profile, skills, and documents.
 * ~60% less data than Explorer — the student doesn't need applications, reservations, etc.
 */
export const STUDY_CONTEXT_OPTIONS: ContextLoadOptions = {
  includeDocuments: true,
  includeApplications: false,
  includeMemberships: false,
  includeReservations: false,
  includeNotifications: false,
  includeBookmarks: false,
  includeCalendar: false,
  includeInvitations: false,
  includeOrganizations: false,

  documentsLimit: 5,
};

/**
 * ORG mode: Only profile and organizations.
 * Org-specific data is fetched via sql_query tool on demand.
 */
export const ORG_CONTEXT_OPTIONS: ContextLoadOptions = {
  includeDocuments: false,
  includeApplications: false,
  includeMemberships: false,
  includeReservations: false,
  includeNotifications: false,
  includeBookmarks: false,
  includeCalendar: false,
  includeInvitations: false,
  includeOrganizations: true,
};

// Re-export for convenience
export { EXPLORER_CONTEXT_OPTIONS };
