/**
 * Copilot Context Types
 * Defines the full context available to the copilot for personalization
 */

import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════
// TALENT PROFILE CONTEXT
// ═══════════════════════════════════════════════════════════════

export const TalentProfileSchema = z.object({
  id: z.string(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string(),
  phone: z.string().optional(),
  avatarUrl: z.string().optional(),

  // Professional info
  bio: z.string().optional(),

  // Location
  location: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),

  // Preferences
  remoteReady: z.boolean().optional(),

  // Skills summary
  skills: z.array(
    z.object({
      name: z.string(),
      level: z.enum(['beginner', 'intermediate', 'advanced', 'expert']).optional(),
    })
  ).optional(),

  // Languages
  languages: z.array(
    z.object({
      language: z.string(),
      level: z.enum(['basic', 'conversational', 'fluent', 'native']),
    })
  ).optional(),

  // Sectors of interest
  sectorsOfInterest: z.array(z.string()).optional(),

  createdAt: z.string(),
  updatedAt: z.string(),
});

export type TalentProfile = z.infer<typeof TalentProfileSchema>;

// ═══════════════════════════════════════════════════════════════
// KYC CONTEXT (Verified information)
// ═══════════════════════════════════════════════════════════════

export const KYCContextSchema = z.object({
  isVerified: z.boolean(),
  verificationLevel: z.enum(['none', 'basic', 'advanced', 'complete']).optional(),
  verifiedFields: z.array(z.string()).optional(), // e.g., ['identity', 'education', 'employment']
  verificationDate: z.string().optional(),
});

export type KYCContext = z.infer<typeof KYCContextSchema>;

// ═══════════════════════════════════════════════════════════════
// DOCUMENTS CONTEXT
// ═══════════════════════════════════════════════════════════════

export const DocumentSummarySchema = z.object({
  id: z.string(),
  type: z.enum([
    'CV',
    'CERTIFICATE',
    'DIPLOMA',
    'LICENSE',
    'PORTFOLIO',
    'RECOMMENDATION_LETTER',
    'TRANSCRIPT',
    'PUBLICATION',
    'PATENT',
    'ID_CARD',
    'PASSPORT',
    'DRIVER_LICENSE',
    'PROOF_OF_ADDRESS',
    'OTHER',
  ]),
  category: z.enum(['PROFESSIONAL', 'ACADEMIC', 'IDENTITY', 'OTHER']),
  title: z.string().optional(),
  filename: z.string(),
  status: z.enum(['PENDING', 'PROCESSING', 'PROCESSED', 'FAILED', 'VERIFIED', 'REJECTED']),
  extractedSkills: z.array(z.string()).optional(),
  extractedSummary: z.string().optional(),
  uploadedAt: z.string(),
});

export const DocumentsContextSchema = z.object({
  totalCount: z.number(),
  documents: z.array(DocumentSummarySchema),
  hasCV: z.boolean(),
  hasDiplomas: z.boolean(),
  hasCertificates: z.boolean(),
});

export type DocumentSummary = z.infer<typeof DocumentSummarySchema>;
export type DocumentsContext = z.infer<typeof DocumentsContextSchema>;

// ═══════════════════════════════════════════════════════════════
// APPLICATIONS CONTEXT
// ═══════════════════════════════════════════════════════════════

export const ApplicationSummarySchema = z.object({
  id: z.string(),
  opportunityId: z.string(),
  opportunityTitle: z.string(),
  organizationName: z.string(),
  status: z.enum([
    'PENDING',
    'REVIEWING',
    'SHORTLISTED',
    'INTERVIEW_SCHEDULED',
    'INTERVIEW_COMPLETED',
    'OFFER_MADE',
    'ACCEPTED',
    'REJECTED',
    'WITHDRAWN',
  ]),
  appliedAt: z.string(),
  lastActivityAt: z.string().optional(),
});

export const ApplicationsContextSchema = z.object({
  totalCount: z.number(),
  activeCount: z.number(),
  applications: z.array(ApplicationSummarySchema),
  byStatus: z.record(z.string(), z.number()),
});

export type ApplicationSummary = z.infer<typeof ApplicationSummarySchema>;
export type ApplicationsContext = z.infer<typeof ApplicationsContextSchema>;

// ═══════════════════════════════════════════════════════════════
// MEMBERSHIPS CONTEXT (Communities)
// ═══════════════════════════════════════════════════════════════

export const MembershipSummarySchema = z.object({
  id: z.string(),
  communityId: z.string(),
  communityName: z.string(),
  role: z.enum(['MEMBER', 'MODERATOR', 'ADMIN', 'OWNER']),
  joinedAt: z.string(),
  isActive: z.boolean(),
});

export const MembershipsContextSchema = z.object({
  totalCount: z.number(),
  memberships: z.array(MembershipSummarySchema),
  adminOf: z.array(z.string()), // Community IDs
});

export type MembershipSummary = z.infer<typeof MembershipSummarySchema>;
export type MembershipsContext = z.infer<typeof MembershipsContextSchema>;

// ═══════════════════════════════════════════════════════════════
// RESERVATIONS CONTEXT (Spaces)
// ═══════════════════════════════════════════════════════════════

export const ReservationSummarySchema = z.object({
  id: z.string(),
  spaceId: z.string(),
  spaceName: z.string(),
  date: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED']),
});

export const ReservationsContextSchema = z.object({
  totalCount: z.number(),
  upcomingCount: z.number(),
  reservations: z.array(ReservationSummarySchema),
});

export type ReservationSummary = z.infer<typeof ReservationSummarySchema>;
export type ReservationsContext = z.infer<typeof ReservationsContextSchema>;

// ═══════════════════════════════════════════════════════════════
// NOTIFICATIONS CONTEXT
// ═══════════════════════════════════════════════════════════════

export const NotificationSummarySchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string(),
  message: z.string(),
  isRead: z.boolean(),
  createdAt: z.string(),
});

export const NotificationsContextSchema = z.object({
  unreadCount: z.number(),
  recentNotifications: z.array(NotificationSummarySchema),
});

export type NotificationSummary = z.infer<typeof NotificationSummarySchema>;
export type NotificationsContext = z.infer<typeof NotificationsContextSchema>;

// ═══════════════════════════════════════════════════════════════
// BOOKMARKS CONTEXT
// ═══════════════════════════════════════════════════════════════

export const BookmarkSummarySchema = z.object({
  id: z.string(),
  entityType: z.enum(['opportunity', 'community', 'space', 'organization']),
  entityId: z.string(),
  entityTitle: z.string(),
  bookmarkedAt: z.string(),
});

export const BookmarksContextSchema = z.object({
  totalCount: z.number(),
  bookmarks: z.array(BookmarkSummarySchema),
  byType: z.record(z.string(), z.number()),
});

export type BookmarkSummary = z.infer<typeof BookmarkSummarySchema>;
export type BookmarksContext = z.infer<typeof BookmarksContextSchema>;

// ═══════════════════════════════════════════════════════════════
// CALENDAR CONTEXT
// ═══════════════════════════════════════════════════════════════

export const CalendarEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(['interview', 'reservation', 'community_event', 'deadline', 'other']),
  startDate: z.string(),
  endDate: z.string().optional(),
  location: z.string().optional(),
  relatedEntityType: z.string().optional(),
  relatedEntityId: z.string().optional(),
});

export const CalendarContextSchema = z.object({
  upcomingEvents: z.array(CalendarEventSchema),
  todayCount: z.number(),
  weekCount: z.number(),
});

export type CalendarEvent = z.infer<typeof CalendarEventSchema>;
export type CalendarContext = z.infer<typeof CalendarContextSchema>;

// ═══════════════════════════════════════════════════════════════
// INVITATIONS CONTEXT
// ═══════════════════════════════════════════════════════════════

export const InvitationSummarySchema = z.object({
  id: z.string(),
  type: z.enum(['community', 'organization', 'interview', 'event']),
  fromName: z.string(),
  targetName: z.string(),
  status: z.enum(['PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED']),
  receivedAt: z.string(),
  expiresAt: z.string().optional(),
});

export const InvitationsContextSchema = z.object({
  pendingCount: z.number(),
  invitations: z.array(InvitationSummarySchema),
});

export type InvitationSummary = z.infer<typeof InvitationSummarySchema>;
export type InvitationsContext = z.infer<typeof InvitationsContextSchema>;

// ═══════════════════════════════════════════════════════════════
// ORGANIZATIONS CONTEXT (For admin users)
// ═══════════════════════════════════════════════════════════════

export const OrganizationRoleSchema = z.object({
  organizationId: z.string(),
  organizationName: z.string(),
  role: z.enum(['MEMBER', 'RECRUITER', 'ADMIN', 'OWNER']),
  permissions: z.array(z.string()),
});

export const OrganizationsContextSchema = z.object({
  organizations: z.array(OrganizationRoleSchema),
  isOrgAdmin: z.boolean(), // Has admin role in at least one org
  adminOfCount: z.number(),
});

export type OrganizationRole = z.infer<typeof OrganizationRoleSchema>;
export type OrganizationsContext = z.infer<typeof OrganizationsContextSchema>;

// ═══════════════════════════════════════════════════════════════
// LEARNING CONTEXT (For study mode)
// ═══════════════════════════════════════════════════════════════

export const LearningTopicSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  parentTopic: z.string().optional(),
  masteryLevel: z.number().min(0).max(100),
  flashcardCount: z.number(),
  dueFlashcardCount: z.number(),
  lastStudiedAt: z.string().optional(),
});

export const LearningContextSchema = z.object({
  totalTopics: z.number(),
  totalFlashcards: z.number(),
  dueFlashcards: z.number(),
  streakDays: z.number(),
  totalStudyTime: z.number(), // minutes
  topics: z.array(LearningTopicSummarySchema),
  preferences: z
    .object({
      dailyGoal: z.number().optional(), // cards per day
      preferredStudyTime: z.string().optional(), // e.g., "morning", "evening"
      notificationsEnabled: z.boolean(),
    })
    .optional(),
});

export type LearningTopicSummary = z.infer<typeof LearningTopicSummarySchema>;
export type LearningContext = z.infer<typeof LearningContextSchema>;

// ═══════════════════════════════════════════════════════════════
// GRAPH CONTEXT (Talent Graph insights from Neo4j)
// ═══════════════════════════════════════════════════════════════

export const GraphContextSchema = z.object({
  // Graph stats summary
  stats: z.object({
    skillsCount: z.number(),
    experiencesCount: z.number(),
    applicationsCount: z.number(),
    membershipCount: z.number(),
    connectionsCount: z.number(),
    learningTopicsCount: z.number(),
  }).optional(),

  // Top skills with graph context
  topSkills: z.array(z.object({
    name: z.string(),
    level: z.string(),
    relatedOpportunities: z.number(),
  })).optional(),

  // Skill gaps (in-demand skills the talent doesn't have)
  skillGaps: z.array(z.object({
    skillName: z.string(),
    demandCount: z.number(),
    priority: z.enum(['low', 'medium', 'high', 'critical']),
  })).optional(),

  // Agent-inferred interests
  inferredInterests: z.array(z.object({
    target: z.string(),
    targetType: z.string(),
    confidence: z.number(),
    reason: z.string(),
  })).optional(),

  // Suggested skills to learn
  suggestedSkills: z.array(z.object({
    skillName: z.string(),
    priority: z.string(),
    reason: z.string(),
  })).optional(),

  // Similar talents for networking
  similarTalents: z.array(z.object({
    name: z.string(),
    commonSkillsCount: z.number(),
  })).optional(),

  // Current position from graph
  currentPosition: z.object({
    title: z.string(),
    organization: z.string(),
  }).optional(),

  // Graph available flag
  isGraphAvailable: z.boolean(),
});

export type GraphContext = z.infer<typeof GraphContextSchema>;

// ═══════════════════════════════════════════════════════════════
// FULL TALENT CONTEXT
// ═══════════════════════════════════════════════════════════════

export const TalentContextSchema = z.object({
  // Core profile
  profile: TalentProfileSchema,
  kyc: KYCContextSchema.optional(),

  // User data
  documents: DocumentsContextSchema.optional(),
  applications: ApplicationsContextSchema.optional(),
  memberships: MembershipsContextSchema.optional(),
  reservations: ReservationsContextSchema.optional(),
  notifications: NotificationsContextSchema.optional(),
  bookmarks: BookmarksContextSchema.optional(),
  calendar: CalendarContextSchema.optional(),
  invitations: InvitationsContextSchema.optional(),

  // Admin context
  organizations: OrganizationsContextSchema.optional(),

  // Learning context
  learning: LearningContextSchema.optional(),

  // Graph context (from Neo4j Talent Graph)
  graph: GraphContextSchema.optional(),

  // Session context (current conversation)
  session: z
    .object({
      currentMode: z.enum(['explore', 'study']),
      focusEntities: z.array(
        z.object({
          type: z.string(),
          id: z.string(),
          name: z.string().optional(),
        })
      ).optional(),
      conversationTopic: z.string().optional(),
      recentActions: z.array(z.string()).optional(),
    })
    .optional(),

  // Metadata
  contextLoadedAt: z.string(),
  contextVersion: z.string().default('1.0'),
});

export type TalentContext = z.infer<typeof TalentContextSchema>;

// ═══════════════════════════════════════════════════════════════
// CONTEXT LOADING OPTIONS
// ═══════════════════════════════════════════════════════════════

export interface ContextLoadOptions {
  includeDocuments?: boolean;
  includeApplications?: boolean;
  includeMemberships?: boolean;
  includeReservations?: boolean;
  includeNotifications?: boolean;
  includeBookmarks?: boolean;
  includeCalendar?: boolean;
  includeInvitations?: boolean;
  includeOrganizations?: boolean;
  includeLearning?: boolean;
  includeGraph?: boolean; // Include Talent Graph context from Neo4j

  // Limits
  documentsLimit?: number;
  applicationsLimit?: number;
  notificationsLimit?: number;
  calendarDaysAhead?: number;
}

export const DEFAULT_CONTEXT_OPTIONS: ContextLoadOptions = {
  includeDocuments: true,
  includeApplications: true,
  includeMemberships: true,
  includeReservations: true,
  includeNotifications: true,
  includeBookmarks: true,
  includeCalendar: true,
  includeInvitations: true,
  includeOrganizations: true,
  includeLearning: true,
  includeGraph: true, // Include graph context by default

  documentsLimit: 20,
  applicationsLimit: 10,
  notificationsLimit: 10,
  calendarDaysAhead: 30,
};

// Optimized context for Explorer mode
export const EXPLORER_CONTEXT_OPTIONS: ContextLoadOptions = {
  includeDocuments: true,
  includeApplications: true,
  includeMemberships: true,
  includeReservations: true,
  includeNotifications: false,
  includeBookmarks: true,
  includeCalendar: true,
  includeInvitations: true,
  includeOrganizations: true,
  includeLearning: false,
  includeGraph: true, // Graph is key for exploration

  documentsLimit: 10,
  applicationsLimit: 5,
  calendarDaysAhead: 14,
};

// Optimized context for Study mode
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
  includeLearning: true,
  includeGraph: true, // Graph is key for learning paths

  documentsLimit: 10,
};

// ═══════════════════════════════════════════════════════════════
// CONTEXT HELPERS
// ═══════════════════════════════════════════════════════════════

export function summarizeContext(context: TalentContext): string {
  const parts: string[] = [];

  // Profile summary
  const p = context.profile;
  parts.push(`PROFIL: ${p.firstName} ${p.lastName}`);
  if (p.location) parts.push(`  Localisation: ${p.location}`);

  // Skills
  if (p.skills && p.skills.length > 0) {
    const skillNames = p.skills.slice(0, 10).map((s) => s.name);
    parts.push(`  Compétences: ${skillNames.join(', ')}`);
  }

  // Documents
  if (context.documents) {
    parts.push(`DOCUMENTS: ${context.documents.totalCount} documents`);
    if (context.documents.hasCV) parts.push('  - CV disponible');
    if (context.documents.hasDiplomas) parts.push('  - Diplômes disponibles');
    if (context.documents.hasCertificates) parts.push('  - Certificats disponibles');
  }

  // Applications
  if (context.applications) {
    parts.push(`CANDIDATURES: ${context.applications.totalCount} total, ${context.applications.activeCount} actives`);
  }

  // Memberships
  if (context.memberships && context.memberships.totalCount > 0) {
    parts.push(`COMMUNAUTÉS: ${context.memberships.totalCount} memberships`);
  }

  // Organization admin
  if (context.organizations?.isOrgAdmin) {
    parts.push(`ADMIN ORG: ${context.organizations.adminOfCount} organisations`);
  }

  // Learning
  if (context.learning) {
    parts.push(`APPRENTISSAGE: ${context.learning.totalTopics} sujets, ${context.learning.dueFlashcards} cartes dues`);
    if (context.learning.streakDays > 0) {
      parts.push(`  Série: ${context.learning.streakDays} jours`);
    }
  }

  // Graph insights
  if (context.graph?.isGraphAvailable) {
    parts.push(`TALENT GRAPH:`);
    if (context.graph.stats) {
      parts.push(`  Compétences: ${context.graph.stats.skillsCount}, Expériences: ${context.graph.stats.experiencesCount}`);
      parts.push(`  Connexions: ${context.graph.stats.connectionsCount}, Communautés: ${context.graph.stats.membershipCount}`);
    }
    if (context.graph.skillGaps && context.graph.skillGaps.length > 0) {
      const criticalGaps = context.graph.skillGaps.filter(g => g.priority === 'critical' || g.priority === 'high');
      if (criticalGaps.length > 0) {
        parts.push(`  Lacunes prioritaires: ${criticalGaps.map(g => g.skillName).slice(0, 3).join(', ')}`);
      }
    }
    if (context.graph.suggestedSkills && context.graph.suggestedSkills.length > 0) {
      parts.push(`  Suggestions: ${context.graph.suggestedSkills.slice(0, 3).map(s => s.skillName).join(', ')}`);
    }
  }

  // Calendar
  if (context.calendar && context.calendar.upcomingEvents.length > 0) {
    parts.push(`AGENDA: ${context.calendar.weekCount} événements cette semaine`);
  }

  // Invitations
  if (context.invitations && context.invitations.pendingCount > 0) {
    parts.push(`INVITATIONS: ${context.invitations.pendingCount} en attente`);
  }

  return parts.join('\n');
}

export function getContextForPrompt(context: TalentContext): string {
  return `
=== CONTEXTE UTILISATEUR ===
${summarizeContext(context)}
===========================
`;
}

// ═══════════════════════════════════════════════════════════════
// CONTEXT LOADING FROM DATABASE
// ═══════════════════════════════════════════════════════════════

import { pool } from '../database';

import { logger } from '../../utils';
/**
 * Load full talent context from database
 * This is the main function used by the copilot service
 */
export async function loadTalentContext(
  talentId: string,
  options: ContextLoadOptions = DEFAULT_CONTEXT_OPTIONS
): Promise<TalentContext> {
  // Load profile (required)
  const profile = await loadProfile(talentId);

  const context: Partial<TalentContext> = {
    profile,
    contextLoadedAt: new Date().toISOString(),
    contextVersion: '1.0',
  };

  // Load KYC
  context.kyc = await loadKYC(talentId);

  // Load optional data based on options
  const loaders: Promise<void>[] = [];

  if (options.includeDocuments) {
    loaders.push(
      loadDocuments(talentId, options.documentsLimit).then((d) => {
        context.documents = d;
      })
    );
  }

  if (options.includeApplications) {
    loaders.push(
      loadApplications(talentId, options.applicationsLimit).then((a) => {
        context.applications = a;
      })
    );
  }

  if (options.includeMemberships) {
    loaders.push(
      loadMemberships(talentId).then((m) => {
        context.memberships = m;
      })
    );
  }

  if (options.includeReservations) {
    loaders.push(
      loadReservations(talentId).then((r) => {
        context.reservations = r;
      })
    );
  }

  if (options.includeNotifications) {
    loaders.push(
      loadNotifications(talentId, options.notificationsLimit).then((n) => {
        context.notifications = n;
      })
    );
  }

  if (options.includeBookmarks) {
    loaders.push(
      loadBookmarks(talentId).then((b) => {
        context.bookmarks = b;
      })
    );
  }

  if (options.includeCalendar) {
    loaders.push(
      loadCalendar(talentId, options.calendarDaysAhead).then((c) => {
        context.calendar = c;
      })
    );
  }

  if (options.includeInvitations) {
    loaders.push(
      loadInvitations(talentId).then((i) => {
        context.invitations = i;
      })
    );
  }

  if (options.includeOrganizations) {
    loaders.push(
      loadOrganizations(talentId).then((o) => {
        context.organizations = o;
      })
    );
  }

  if (options.includeLearning) {
    loaders.push(
      loadLearning(talentId).then((l) => {
        context.learning = l;
      })
    );
  }

  if (options.includeGraph) {
    loaders.push(
      loadGraphContext(talentId).then((g) => {
        context.graph = g;
      })
    );
  }

  // Wait for all loaders
  await Promise.all(loaders);

  return context as TalentContext;
}

// ═══════════════════════════════════════════════════════════════
// INDIVIDUAL LOADERS
// ═══════════════════════════════════════════════════════════════

async function loadProfile(talentId: string): Promise<TalentProfile> {
  const result = await pool.query(
    `
    SELECT
      t.id, t.first_name, t.last_name, COALESCE(t.first_name || ' ' || t.last_name, t.email) as display_name,
      t.email, t.phone,
      t.avatar_url, t.bio,
      t.city, t.country,
      t.remote_ready,
      t.created_at, t.updated_at
    FROM talents t
    WHERE t.id = $1
    `,
    [talentId]
  );

  if (result.rows.length === 0) {
    throw new Error(`Talent not found: ${talentId}`);
  }

  const row = result.rows[0];

  // Load skills
  const skillsResult = await pool.query(
    `
    SELECT canonical_name as name, proficiency_level
    FROM talent_skills
    WHERE talent_id = $1
    LIMIT 50
    `,
    [talentId]
  );

  const skills = skillsResult.rows.map((s) => ({
    name: s.name,
    level: mapProficiencyLevel(s.proficiency_level),
  }));

  // Load languages
  const languagesResult = await pool.query(
    `
    SELECT language, proficiency_level
    FROM talent_languages
    WHERE talent_id = $1
    `,
    [talentId]
  );

  const languages = languagesResult.rows.map((l) => ({
    language: l.language,
    level: mapLanguageLevel(l.proficiency_level),
  }));

  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    avatarUrl: row.avatar_url,
    bio: row.bio,
    location: row.city ? `${row.city}, ${row.country || ''}`.trim() : row.country,
    city: row.city,
    country: row.country,
    remoteReady: row.remote_ready,
    skills,
    languages,
    createdAt: row.created_at?.toISOString(),
    updatedAt: row.updated_at?.toISOString(),
  };
}

async function loadKYC(talentId: string): Promise<KYCContext> {
  const result = await pool.query(
    `
    SELECT is_verified, verification_level, verified_fields, verification_date
    FROM kyc_verifications
    WHERE talent_id = $1
    `,
    [talentId]
  );

  if (result.rows.length === 0) {
    return { isVerified: false };
  }

  const row = result.rows[0];
  return {
    isVerified: row.is_verified,
    verificationLevel: row.verification_level,
    verifiedFields: row.verified_fields,
    verificationDate: row.verification_date?.toISOString(),
  };
}

async function loadDocuments(talentId: string, limit = 20): Promise<DocumentsContext> {
  const result = await pool.query(
    `
    SELECT id, type, category, title, filename, status, extracted_skills, extracted_summary, uploaded_at
    FROM talent_documents
    WHERE talent_id = $1 AND deleted_at IS NULL
    ORDER BY uploaded_at DESC
    LIMIT $2
    `,
    [talentId, limit]
  );

  const documents = result.rows.map((row) => ({
    id: row.id,
    type: row.type,
    category: row.category,
    title: row.title,
    filename: row.filename,
    status: row.status,
    extractedSkills: row.extracted_skills,
    extractedSummary: row.extracted_summary,
    uploadedAt: row.uploaded_at?.toISOString(),
  }));

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM talent_documents WHERE talent_id = $1 AND deleted_at IS NULL`,
    [talentId]
  );

  return {
    totalCount: parseInt(countResult.rows[0].count) || 0,
    documents,
    hasCV: documents.some((d) => d.type === 'CV'),
    hasDiplomas: documents.some((d) => d.type === 'DIPLOMA'),
    hasCertificates: documents.some((d) => d.type === 'CERTIFICATE'),
  };
}

async function loadApplications(talentId: string, limit = 10): Promise<ApplicationsContext> {
  const result = await pool.query(
    `
    SELECT
      a.id, a.opportunity_id, o.title as opportunity_title,
      org.name as organization_name,
      a.status, a.created_at, a.updated_at
    FROM opportunity_applications a
    JOIN opportunities o ON a.opportunity_id = o.id
    JOIN organizations org ON o.organization_id = org.id
    WHERE a.talent_id = $1
    ORDER BY a.created_at DESC
    LIMIT $2
    `,
    [talentId, limit]
  );

  const applications = result.rows.map((row) => ({
    id: row.id,
    opportunityId: row.opportunity_id,
    opportunityTitle: row.opportunity_title,
    organizationName: row.organization_name,
    status: row.status,
    appliedAt: row.created_at?.toISOString(),
    lastActivityAt: row.updated_at?.toISOString(),
  }));

  const countResult = await pool.query(
    `SELECT COUNT(*), COUNT(*) FILTER (WHERE status NOT IN ('REJECTED', 'WITHDRAWN', 'ACCEPTED')) as active
     FROM opportunity_applications WHERE talent_id = $1`,
    [talentId]
  );

  const statusResult = await pool.query(
    `SELECT status, COUNT(*) FROM opportunity_applications WHERE talent_id = $1 GROUP BY status`,
    [talentId]
  );

  const byStatus: Record<string, number> = {};
  statusResult.rows.forEach((row) => {
    byStatus[row.status] = parseInt(row.count);
  });

  return {
    totalCount: parseInt(countResult.rows[0].count) || 0,
    activeCount: parseInt(countResult.rows[0].active) || 0,
    applications,
    byStatus,
  };
}

async function loadMemberships(talentId: string): Promise<MembershipsContext> {
  const result = await pool.query(
    `
    SELECT
      cm.id, cm.community_id, c.name as community_name,
      cm.role, cm.created_at, cm.status
    FROM community_members cm
    JOIN communities c ON cm.community_id = c.id
    WHERE cm.talent_id = $1 AND cm.status = 'ACTIVE'
    ORDER BY cm.created_at DESC
    `,
    [talentId]
  );

  const memberships = result.rows.map((row) => ({
    id: row.id,
    communityId: row.community_id,
    communityName: row.community_name,
    role: row.role,
    joinedAt: row.created_at?.toISOString(),
    isActive: row.status === 'ACTIVE',
  }));

  const adminOf = memberships.filter((m) => ['ADMIN', 'OWNER', 'MODERATOR'].includes(m.role)).map((m) => m.communityId);

  return {
    totalCount: memberships.length,
    memberships,
    adminOf,
  };
}

async function loadReservations(talentId: string): Promise<ReservationsContext> {
  const result = await pool.query(
    `
    SELECT
      r.id, r.space_id, s.name as space_name,
      r.date, r.start_time, r.end_time, r.status
    FROM space_bookings r
    JOIN spaces s ON r.space_id = s.id
    WHERE r.talent_id = $1 AND r.date >= CURRENT_DATE
    ORDER BY r.date, r.start_time
    `,
    [talentId]
  );

  const reservations = result.rows.map((row) => ({
    id: row.id,
    spaceId: row.space_id,
    spaceName: row.space_name,
    date: row.date?.toISOString().split('T')[0],
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.status,
  }));

  return {
    totalCount: reservations.length,
    upcomingCount: reservations.filter((r) => r.status === 'CONFIRMED').length,
    reservations,
  };
}

async function loadNotifications(talentId: string, limit = 10): Promise<NotificationsContext> {
  const result = await pool.query(
    `
    SELECT id, type, title, message, is_read, created_at
    FROM notifications
    WHERE talent_id = $1
    ORDER BY created_at DESC
    LIMIT $1
    `,
    [talentId, limit]
  );

  const recentNotifications = result.rows.map((row) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    isRead: row.is_read,
    createdAt: row.created_at?.toISOString(),
  }));

  const unreadResult = await pool.query(
    `SELECT COUNT(*) FROM notifications WHERE talent_id = $1 AND is_read = false`,
    [talentId]
  );

  return {
    unreadCount: parseInt(unreadResult.rows[0].count) || 0,
    recentNotifications,
  };
}

async function loadBookmarks(talentId: string): Promise<BookmarksContext> {
  // OPTIMIZED: Single query with JOIN instead of N+1 queries
  const result = await pool.query(
    `
    SELECT
      ob.id,
      'opportunity' as entity_type,
      ob.opportunity_id as entity_id,
      ob.created_at,
      o.title as entity_title
    FROM opportunity_bookmarks ob
    LEFT JOIN opportunities o ON ob.opportunity_id = o.id
    WHERE ob.talent_id = $1
    ORDER BY ob.created_at DESC
    LIMIT 50
    `,
    [talentId]
  );

  const byType: Record<string, number> = {};
  const bookmarks: BookmarkSummary[] = [];

  for (const row of result.rows) {
    byType[row.entity_type] = (byType[row.entity_type] || 0) + 1;

    bookmarks.push({
      id: row.id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      entityTitle: row.entity_title || 'Unknown',
      bookmarkedAt: row.created_at?.toISOString(),
    });
  }

  return {
    totalCount: bookmarks.length,
    bookmarks,
    byType,
  };
}

async function loadCalendar(talentId: string, daysAhead = 30): Promise<CalendarContext> {
  const events: CalendarEvent[] = [];
  const now = new Date();
  const endDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  // Load interviews
  const interviews = await pool.query(
    `
    SELECT i.id, i.scheduled_at, i.duration_minutes, o.title as opportunity_title
    FROM interviews i
    JOIN applications a ON i.application_id = a.id
    JOIN opportunities o ON a.opportunity_id = o.id
    WHERE a.talent_id = $1 AND i.scheduled_at >= $2 AND i.scheduled_at <= $3
    ORDER BY i.scheduled_at
    `,
    [talentId, now, endDate]
  );

  for (const row of interviews.rows) {
    events.push({
      id: row.id,
      title: `Entretien: ${row.opportunity_title}`,
      type: 'interview',
      startDate: row.scheduled_at?.toISOString(),
      relatedEntityType: 'interview',
      relatedEntityId: row.id,
    });
  }

  // Load reservations
  const reservations = await pool.query(
    `
    SELECT r.id, r.date, r.start_time, r.end_time, s.name as space_name
    FROM space_bookings r
    JOIN spaces s ON r.space_id = s.id
    WHERE r.talent_id = $1 AND r.date >= $2 AND r.date <= $3 AND r.status = 'CONFIRMED'
    ORDER BY r.date, r.start_time
    `,
    [talentId, now, endDate]
  );

  for (const row of reservations.rows) {
    events.push({
      id: row.id,
      title: `Réservation: ${row.space_name}`,
      type: 'reservation',
      startDate: `${row.date.toISOString().split('T')[0]}T${row.start_time}`,
      endDate: `${row.date.toISOString().split('T')[0]}T${row.end_time}`,
      relatedEntityType: 'reservation',
      relatedEntityId: row.id,
    });
  }

  // Sort events by date
  events.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  // Count events
  const today = now.toISOString().split('T')[0];
  const todayCount = events.filter((e) => e.startDate.startsWith(today)).length;

  const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const weekCount = events.filter((e) => e.startDate <= weekEnd).length;

  return {
    upcomingEvents: events,
    todayCount,
    weekCount,
  };
}

async function loadInvitations(talentId: string): Promise<InvitationsContext> {
  const result = await pool.query(
    `
    SELECT id, 'community' as type, inviter_name as from_name, '' as target_name, status, created_at, expires_at
    FROM community_invitations WHERE invitee_talent_id = $1 AND status = 'PENDING'
    UNION ALL
    SELECT id, 'opportunity' as type, inviter_name as from_name, '' as target_name, status, created_at, expires_at
    FROM opportunity_invitations WHERE invitee_talent_id = $1 AND status = 'PENDING'
    UNION ALL
    SELECT id, 'organization' as type, '' as from_name, '' as target_name, status, created_at, expires_at
    FROM organization_invitations WHERE email = (SELECT email FROM talents WHERE id = $1) AND status = 'PENDING'
    ORDER BY created_at DESC
    `,
    [talentId]
  );

  const invitations = result.rows.map((row) => ({
    id: row.id,
    type: row.type,
    fromName: row.from_name,
    targetName: row.target_name,
    status: row.status,
    receivedAt: row.created_at?.toISOString(),
    expiresAt: row.expires_at?.toISOString(),
  }));

  return {
    pendingCount: invitations.length,
    invitations,
  };
}

async function loadOrganizations(talentId: string): Promise<OrganizationsContext> {
  const result = await pool.query(
    `
    SELECT om.organization_id, o.name as organization_name, om.role, om.permissions
    FROM organization_members om
    JOIN organizations o ON om.organization_id = o.id
    WHERE om.talent_id = $1 AND om.status = 'ACTIVE'
    `,
    [talentId]
  );

  const organizations = result.rows.map((row) => ({
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    role: row.role,
    permissions: row.permissions || [],
  }));

  const isOrgAdmin = organizations.some((o) => ['ADMIN', 'OWNER'].includes(o.role));
  const adminOfCount = organizations.filter((o) => ['ADMIN', 'OWNER'].includes(o.role)).length;

  return {
    organizations,
    isOrgAdmin,
    adminOfCount,
  };
}

async function loadLearning(talentId: string): Promise<LearningContext> {
  // Load topics with flashcard counts
  const topicsResult = await pool.query(
    `
    SELECT
      lt.id, lt.topic_name, lt.parent_topic_id,
      lt.mastery_level, lt.last_studied_at,
      COUNT(lf.id) as flashcard_count,
      COUNT(lf.id) FILTER (WHERE lf.next_review_at <= CURRENT_DATE) as due_count
    FROM learning_topics lt
    LEFT JOIN learning_flashcards lf ON lt.id = lf.topic_id
    WHERE lt.talent_id = $1
    GROUP BY lt.id
    ORDER BY lt.topic_name
    `,
    [talentId]
  );

  const topics = topicsResult.rows.map((row) => ({
    id: row.id,
    name: row.topic_name,
    parentTopic: row.parent_topic_id,
    masteryLevel: row.mastery_level || 0,
    flashcardCount: parseInt(row.flashcard_count) || 0,
    dueFlashcardCount: parseInt(row.due_count) || 0,
    lastStudiedAt: row.last_studied_at?.toISOString(),
  }));

  // Total stats
  const statsResult = await pool.query(
    `
    SELECT
      COUNT(DISTINCT lt.id) as total_topics,
      COUNT(lf.id) as total_flashcards,
      COUNT(lf.id) FILTER (WHERE lf.next_review_at <= CURRENT_DATE) as due_flashcards
    FROM learning_topics lt
    LEFT JOIN learning_flashcards lf ON lt.id = lf.topic_id
    WHERE lt.talent_id = $1
    `,
    [talentId]
  );

  // Load streak
  const streakResult = await pool.query(
    `
    SELECT streak_days, total_study_time_minutes
    FROM learning_preferences
    WHERE talent_id = $1
    `,
    [talentId]
  );

  const streak = streakResult.rows[0];

  // Load preferences
  const prefsResult = await pool.query(
    `
    SELECT daily_goal, preferred_study_time, notifications_enabled
    FROM learning_preferences
    WHERE talent_id = $1
    `,
    [talentId]
  );

  const prefs = prefsResult.rows[0];

  return {
    totalTopics: parseInt(statsResult.rows[0]?.total_topics) || 0,
    totalFlashcards: parseInt(statsResult.rows[0]?.total_flashcards) || 0,
    dueFlashcards: parseInt(statsResult.rows[0]?.due_flashcards) || 0,
    streakDays: streak?.streak_days || 0,
    totalStudyTime: streak?.total_study_time_minutes || 0,
    topics,
    preferences: prefs
      ? {
          dailyGoal: prefs.daily_goal,
          preferredStudyTime: prefs.preferred_study_time,
          notificationsEnabled: prefs.notifications_enabled,
        }
      : undefined,
  };
}

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function mapProficiencyLevel(level: string | null): 'beginner' | 'intermediate' | 'advanced' | 'expert' | undefined {
  if (!level) return undefined;
  const mapping: Record<string, 'beginner' | 'intermediate' | 'advanced' | 'expert'> = {
    BEGINNER: 'beginner',
    INTERMEDIATE: 'intermediate',
    ADVANCED: 'advanced',
    EXPERT: 'expert',
  };
  return mapping[level.toUpperCase()];
}

function mapLanguageLevel(level: string | null): 'basic' | 'conversational' | 'fluent' | 'native' {
  if (!level) return 'basic';
  const mapping: Record<string, 'basic' | 'conversational' | 'fluent' | 'native'> = {
    BASIC: 'basic',
    CONVERSATIONAL: 'conversational',
    FLUENT: 'fluent',
    NATIVE: 'native',
  };
  return mapping[level.toUpperCase()] || 'basic';
}

// ═══════════════════════════════════════════════════════════════
// GRAPH CONTEXT LOADER
// ═══════════════════════════════════════════════════════════════

async function loadGraphContext(talentId: string): Promise<GraphContext> {
  try {
    // Dynamic import to avoid circular dependencies and handle optional Neo4j
    const { graphService, talentQueries, opportunityQueries } = await import('../graph');

    if (!graphService.isConnected()) {
      return { isGraphAvailable: false };
    }

    // Load talent summary from graph
    const summary = await talentQueries.getTalentSummary(talentId);

    if (!summary) {
      return { isGraphAvailable: true };
    }

    // Load skill gaps
    const skillGaps = await opportunityQueries.getSkillGaps(talentId, { limit: 5 });

    // Load inferences
    const inferences = await talentQueries.getTalentInferences(talentId);

    return {
      isGraphAvailable: true,
      stats: {
        skillsCount: summary.stats.skillsCount,
        experiencesCount: summary.stats.experiencesCount,
        applicationsCount: summary.stats.applicationsCount,
        membershipCount: summary.stats.membershipCount,
        connectionsCount: summary.stats.connectionsCount,
        learningTopicsCount: summary.stats.learningTopicsCount,
      },
      topSkills: summary.topSkills.slice(0, 5).map(s => ({
        name: s.name,
        level: s.level || 'intermediaire',
        relatedOpportunities: 0, // Would need additional query
      })),
      currentPosition: summary.currentPosition,
      skillGaps: skillGaps.slice(0, 5).map(g => ({
        skillName: g.skill.name,
        demandCount: g.demandCount,
        priority: g.priority,
      })),
      inferredInterests: inferences.interests.slice(0, 5).map(i => ({
        target: i.target,
        targetType: i.targetType,
        confidence: i.confidence,
        reason: i.reason,
      })),
      suggestedSkills: inferences.suggestedSkills.slice(0, 5).map((s: any) => ({
        skillName: s.skill,
        priority: s.priority,
        reason: s.reason,
      })),
      similarTalents: inferences.similarTalents.slice(0, 3).map(t => ({
        name: t.name,
        commonSkillsCount: t.commonSkillsCount,
      })),
    };
  } catch (error) {
    logger.error('[Context] Failed to load graph context:', error);
    return { isGraphAvailable: false };
  }
}
