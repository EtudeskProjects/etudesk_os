/**
 * Context Tools for Copilot
 * Tools for loading and managing talent context
 */

import { z } from 'zod';
import { pool } from '../../database';
import {
  TalentContext,
  TalentProfile,
  DocumentsContext,
  ApplicationsContext,
  MembershipsContext,
  ReservationsContext,
  NotificationsContext,
  BookmarksContext,
  CalendarContext,
  InvitationsContext,
  OrganizationsContext,
  LearningContext,
  ContextLoadOptions,
  DEFAULT_CONTEXT_OPTIONS,
  EXPLORER_CONTEXT_OPTIONS,
  STUDY_CONTEXT_OPTIONS,
} from '../ontology/context';

// ═══════════════════════════════════════════════════════════════
// GET FULL CONTEXT
// ═══════════════════════════════════════════════════════════════

export const getContextSchema = z.object({
  mode: z.enum(['explore', 'study', 'full']).default('full').describe('Mode pour optimiser le contexte chargé'),
});

export type GetContextParams = z.infer<typeof getContextSchema>;

export async function getContext(
  params: GetContextParams,
  context: { talentId: string }
): Promise<TalentContext> {
  const { talentId } = context;
  const { mode } = params;

  // Select options based on mode
  let options: ContextLoadOptions;
  if (mode === 'explore') {
    options = EXPLORER_CONTEXT_OPTIONS;
  } else if (mode === 'study') {
    options = STUDY_CONTEXT_OPTIONS;
  } else {
    options = DEFAULT_CONTEXT_OPTIONS;
  }

  // Load profile (always)
  const profile = await loadProfile(talentId);

  // Initialize context
  const talentContext: TalentContext = {
    profile,
    contextLoadedAt: new Date().toISOString(),
    contextVersion: '1.0',
  };

  // Load optional sections in parallel
  const promises: Promise<void>[] = [];

  if (options.includeDocuments) {
    promises.push(
      loadDocuments(talentId, options.documentsLimit || 20).then((docs) => {
        talentContext.documents = docs;
      })
    );
  }

  if (options.includeApplications) {
    promises.push(
      loadApplications(talentId, options.applicationsLimit || 10).then((apps) => {
        talentContext.applications = apps;
      })
    );
  }

  if (options.includeMemberships) {
    promises.push(
      loadMemberships(talentId).then((memberships) => {
        talentContext.memberships = memberships;
      })
    );
  }

  if (options.includeReservations) {
    promises.push(
      loadReservations(talentId).then((reservations) => {
        talentContext.reservations = reservations;
      })
    );
  }

  if (options.includeNotifications) {
    promises.push(
      loadNotifications(talentId, options.notificationsLimit || 10).then((notifications) => {
        talentContext.notifications = notifications;
      })
    );
  }

  if (options.includeBookmarks) {
    promises.push(
      loadBookmarks(talentId).then((bookmarks) => {
        talentContext.bookmarks = bookmarks;
      })
    );
  }

  if (options.includeCalendar) {
    promises.push(
      loadCalendar(talentId, options.calendarDaysAhead || 30).then((calendar) => {
        talentContext.calendar = calendar;
      })
    );
  }

  if (options.includeInvitations) {
    promises.push(
      loadInvitations(talentId).then((invitations) => {
        talentContext.invitations = invitations;
      })
    );
  }

  if (options.includeOrganizations) {
    promises.push(
      loadOrganizations(talentId).then((orgs) => {
        talentContext.organizations = orgs;
      })
    );
  }

  if (options.includeLearning) {
    promises.push(
      loadLearning(talentId).then((learning) => {
        talentContext.learning = learning;
      })
    );
  }

  // Wait for all to complete
  await Promise.all(promises);

  return talentContext;
}

// ═══════════════════════════════════════════════════════════════
// CONTEXT LOADERS
// ═══════════════════════════════════════════════════════════════

async function loadProfile(talentId: string): Promise<TalentProfile> {
  const result = await pool.query(
    `
    SELECT
      t.id, t.display_name, t.first_name, t.last_name, t.email, t.phone,
      t.bio, t.avatar_url, t.city, t.region, t.country,
      t.remote_ready, t.willing_to_relocate,
      t.profile_tags, t.goals,
      t.created_at, t.updated_at
    FROM talents t
    WHERE t.id = $1 AND t.deleted_at IS NULL
  `,
    [talentId]
  );

  if (result.rows.length === 0) {
    throw new Error('Talent non trouvé');
  }

  const t = result.rows[0];

  // Load skills
  const skillsResult = await pool.query(
    `
    SELECT s.canonical_name as name, ts.proficiency_level as level, ts.years_of_experience
    FROM talent_skills ts
    JOIN skills s ON ts.skill_id = s.id
    WHERE ts.talent_id = $1
    ORDER BY ts.endorsed_count DESC
    LIMIT 20
  `,
    [talentId]
  );

  return {
    id: t.id,
    userId: t.id,
    firstName: t.first_name || t.display_name?.split(' ')[0] || '',
    lastName: t.last_name || t.display_name?.split(' ').slice(1).join(' ') || '',
    email: t.email,
    phone: t.phone,
    avatarUrl: t.avatar_url,
    headline: t.profile_tags?.join(' | '),
    bio: t.bio,
    location: [t.city, t.country].filter(Boolean).join(', '),
    city: t.city,
    country: t.country,
    remotePreference: t.remote_ready ? 'REMOTE' : 'ON_SITE',
    skills: skillsResult.rows.map((s) => ({
      name: s.name,
      level: s.level?.toLowerCase(),
      yearsOfExperience: s.years_of_experience,
    })),
    languages: [],
    sectorsOfInterest: t.goals,
    createdAt: t.created_at?.toISOString(),
    updatedAt: t.updated_at?.toISOString(),
  };
}

async function loadDocuments(talentId: string, limit: number): Promise<DocumentsContext> {
  const result = await pool.query(
    `
    SELECT
      id, document_type as type, category, title, original_filename as filename,
      status, extracted_data, created_at
    FROM talent_documents
    WHERE talent_id = $1 AND deleted_at IS NULL
    ORDER BY created_at DESC
    LIMIT $2
  `,
    [talentId, limit]
  );

  const documents = result.rows.map((d) => ({
    id: d.id,
    type: d.type,
    category: d.category,
    title: d.title,
    filename: d.filename,
    status: d.status,
    extractedSkills: d.extracted_data?.skills,
    extractedSummary: d.extracted_data?.summary,
    uploadedAt: d.created_at?.toISOString(),
  }));

  const hasCV = documents.some((d) => d.type === 'CV');
  const hasDiplomas = documents.some((d) => d.type === 'DIPLOMA');
  const hasCertificates = documents.some((d) => d.type === 'CERTIFICATE');

  return {
    totalCount: documents.length,
    documents,
    hasCV,
    hasDiplomas,
    hasCertificates,
  };
}

async function loadApplications(talentId: string, limit: number): Promise<ApplicationsContext> {
  const result = await pool.query(
    `
    SELECT
      a.id, a.opportunity_id, a.status, a.created_at, a.updated_at,
      o.title as opportunity_title,
      org.name as organization_name
    FROM opportunity_applications a
    JOIN opportunities o ON a.opportunity_id = o.id
    LEFT JOIN opportunity_posters op ON o.id = op.opportunity_id
    LEFT JOIN organizations org ON op.poster_organization_id = org.id
    WHERE a.talent_id = $1
    ORDER BY a.created_at DESC
    LIMIT $2
  `,
    [talentId, limit]
  );

  const applications = result.rows.map((a) => ({
    id: a.id,
    opportunityId: a.opportunity_id,
    opportunityTitle: a.opportunity_title,
    organizationName: a.organization_name || 'Organisation',
    status: a.status,
    appliedAt: a.created_at?.toISOString(),
    lastActivityAt: a.updated_at?.toISOString(),
  }));

  const activeCount = applications.filter((a) =>
    ['PENDING', 'REVIEWING', 'SHORTLISTED', 'INTERVIEW_SCHEDULED'].includes(a.status)
  ).length;

  const byStatus: Record<string, number> = {};
  for (const app of applications) {
    byStatus[app.status] = (byStatus[app.status] || 0) + 1;
  }

  return {
    totalCount: applications.length,
    activeCount,
    applications,
    byStatus,
  };
}

async function loadMemberships(talentId: string): Promise<MembershipsContext> {
  const result = await pool.query(
    `
    SELECT
      cm.id, cm.community_id, cm.role, cm.status, cm.joined_at,
      c.name as community_name
    FROM community_members cm
    JOIN communities c ON cm.community_id = c.id
    WHERE cm.talent_id = $1 AND cm.status = 'ACTIVE'
    ORDER BY cm.joined_at DESC
  `,
    [talentId]
  );

  const memberships = result.rows.map((m) => ({
    id: m.id,
    communityId: m.community_id,
    communityName: m.community_name,
    role: m.role,
    joinedAt: m.joined_at?.toISOString(),
    isActive: m.status === 'ACTIVE',
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
      r.id, r.space_id, r.start_datetime, r.end_datetime, r.status,
      s.name as space_name
    FROM space_bookings r
    JOIN spaces s ON r.space_id = s.id
    WHERE r.talent_id = $1
      AND r.start_datetime >= CURRENT_DATE
      AND r.status != 'CANCELLED'
    ORDER BY r.start_datetime ASC
    LIMIT 10
  `,
    [talentId]
  );

  const reservations = result.rows.map((r) => ({
    id: r.id,
    spaceId: r.space_id,
    spaceName: r.space_name,
    date: r.start_datetime?.toISOString().split('T')[0],
    startTime: r.start_datetime?.toISOString(),
    endTime: r.end_datetime?.toISOString(),
    status: r.status,
  }));

  return {
    totalCount: reservations.length,
    upcomingCount: reservations.filter((r) => r.status === 'CONFIRMED').length,
    reservations,
  };
}

async function loadNotifications(talentId: string, _limit: number): Promise<NotificationsContext> {
  // notifications table doesn't exist; return empty
  return { unreadCount: 0, recentNotifications: [] };
}

async function loadBookmarks(talentId: string): Promise<BookmarksContext> {
  const result = await pool.query(
    `
    SELECT id, 'opportunity' as entity_type, opportunity_id as entity_id, created_at
    FROM opportunity_bookmarks
    WHERE talent_id = $1
    ORDER BY created_at DESC
    LIMIT 50
  `,
    [talentId]
  );

  const bookmarks = result.rows.map((b) => ({
    id: b.id,
    entityType: b.entity_type,
    entityId: b.entity_id,
    entityTitle: '', // Would need to join with entity tables
    bookmarkedAt: b.created_at?.toISOString(),
  }));

  const byType: Record<string, number> = {};
  for (const b of bookmarks) {
    byType[b.entityType] = (byType[b.entityType] || 0) + 1;
  }

  return {
    totalCount: bookmarks.length,
    bookmarks,
    byType,
  };
}

async function loadCalendar(talentId: string, daysAhead: number): Promise<CalendarContext> {
  const events: CalendarContext['upcomingEvents'] = [];

  // Get interview events from applications
  const interviewsResult = await pool.query(
    `
    SELECT
      a.id, o.title, a.interview_scheduled_at, a.interview_type
    FROM opportunity_applications a
    JOIN opportunities o ON a.opportunity_id = o.id
    WHERE a.talent_id = $1
      AND a.status = 'INTERVIEW_SCHEDULED'
      AND a.interview_scheduled_at >= CURRENT_DATE
      AND a.interview_scheduled_at <= CURRENT_DATE + $2
  `,
    [talentId, daysAhead]
  );

  for (const i of interviewsResult.rows) {
    events.push({
      id: i.id,
      title: `Entretien: ${i.title}`,
      type: 'interview',
      startDate: i.interview_scheduled_at?.toISOString(),
      relatedEntityType: 'application',
      relatedEntityId: i.id,
    });
  }

  // Get reservation events
  const reservationsResult = await pool.query(
    `
    SELECT r.id, s.name, r.start_datetime
    FROM space_bookings r
    JOIN spaces s ON r.space_id = s.id
    WHERE r.talent_id = $1
      AND r.status = 'CONFIRMED'
      AND r.start_datetime >= CURRENT_DATE
      AND r.start_datetime <= CURRENT_DATE + $2
  `,
    [talentId, daysAhead]
  );

  for (const r of reservationsResult.rows) {
    events.push({
      id: r.id,
      title: `Réservation: ${r.name}`,
      type: 'reservation',
      startDate: r.start_datetime?.toISOString(),
      relatedEntityType: 'reservation',
      relatedEntityId: r.id,
    });
  }

  // Sort by date
  events.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  const today = new Date().toISOString().split('T')[0];
  const todayCount = events.filter((e) => e.startDate?.startsWith(today)).length;

  return {
    upcomingEvents: events,
    todayCount,
    weekCount: events.length,
  };
}

async function loadInvitations(talentId: string): Promise<InvitationsContext> {
  // Load from community and organization invitation tables
  const communityResult = await pool.query(
    `
    SELECT
      ci.id, 'community' as type, ci.status, ci.created_at, ci.expires_at,
      t.display_name as from_name,
      c.name as target_name
    FROM community_invitations ci
    LEFT JOIN talents t ON ci.inviter_talent_id = t.id
    LEFT JOIN communities c ON ci.community_id = c.id
    WHERE ci.invitee_talent_id = $1
      AND ci.status = 'PENDING'
    ORDER BY ci.created_at DESC
    LIMIT 10
  `,
    [talentId]
  );

  const orgResult = await pool.query(
    `
    SELECT
      oi.id, 'organization' as type, oi.status, oi.created_at, oi.expires_at,
      t.display_name as from_name,
      o.name as target_name
    FROM organization_invitations oi
    LEFT JOIN talents t ON oi.inviter_talent_id = t.id
    LEFT JOIN organizations o ON oi.organization_id = o.id
    WHERE oi.invitee_talent_id = $1
      AND oi.status = 'PENDING'
    ORDER BY oi.created_at DESC
    LIMIT 10
  `,
    [talentId]
  );

  const allRows = [...communityResult.rows, ...orgResult.rows];
  const invitations = allRows.map((i) => ({
    id: i.id,
    type: i.type,
    fromName: i.from_name || 'Quelqu\'un',
    targetName: i.target_name || '',
    status: i.status,
    receivedAt: i.created_at?.toISOString(),
    expiresAt: i.expires_at?.toISOString(),
  }));

  return {
    pendingCount: invitations.length,
    invitations,
  };
}

async function loadOrganizations(talentId: string): Promise<OrganizationsContext> {
  const result = await pool.query(
    `
    SELECT
      om.organization_id, om.role, om.permissions,
      o.name as organization_name
    FROM organization_members om
    JOIN organizations o ON om.organization_id = o.id
    WHERE om.talent_id = $1
  `,
    [talentId]
  );

  const organizations = result.rows.map((o) => ({
    organizationId: o.organization_id,
    organizationName: o.organization_name,
    role: o.role,
    permissions: o.permissions || [],
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
  // Get learning stats
  const statsResult = await pool.query(
    `
    SELECT
      (SELECT COUNT(*) FROM learning_topics WHERE talent_id = $1) as total_topics,
      (SELECT COUNT(*) FROM learning_flashcards WHERE talent_id = $1 AND NOT is_suspended AND NOT is_archived) as total_flashcards,
      (SELECT COUNT(*) FROM learning_flashcards WHERE talent_id = $1 AND NOT is_suspended AND NOT is_archived AND next_review_at <= CURRENT_TIMESTAMP) as due_flashcards
  `,
    [talentId]
  );

  const stats = statsResult.rows[0];

  // Get recent topics
  const topicsResult = await pool.query(
    `
    SELECT
      lt.id, lt.topic_name, lt.mastery_level,
      (SELECT COUNT(*) FROM learning_flashcards lf WHERE lf.topic_id = lt.id AND NOT lf.is_suspended AND NOT lf.is_archived) as flashcard_count,
      (SELECT COUNT(*) FROM learning_flashcards lf WHERE lf.topic_id = lt.id AND NOT lf.is_suspended AND NOT lf.is_archived AND lf.next_review_at <= CURRENT_TIMESTAMP) as due_count,
      lt.last_studied_at
    FROM learning_topics lt
    WHERE lt.talent_id = $1
    ORDER BY lt.last_studied_at DESC NULLS LAST
    LIMIT 10
  `,
    [talentId]
  );

  const topics = topicsResult.rows.map((t) => ({
    id: t.id,
    name: t.topic_name,
    masteryLevel: t.mastery_level || 0,
    flashcardCount: parseInt(t.flashcard_count) || 0,
    dueFlashcardCount: parseInt(t.due_count) || 0,
    lastStudiedAt: t.last_studied_at?.toISOString(),
  }));

  // Get preferences
  const prefsResult = await pool.query(
    `
    SELECT daily_goal_minutes, reminder_enabled
    FROM learning_preferences
    WHERE talent_id = $1
  `,
    [talentId]
  );

  const prefs = prefsResult.rows[0];

  // Calculate streak (simplified)
  const streakResult = await pool.query(
    `
    SELECT COUNT(DISTINCT DATE(started_at)) as streak_days
    FROM learning_sessions
    WHERE talent_id = $1
      AND started_at >= CURRENT_DATE - INTERVAL '30 days'
  `,
    [talentId]
  );

  return {
    totalTopics: parseInt(stats.total_topics) || 0,
    totalFlashcards: parseInt(stats.total_flashcards) || 0,
    dueFlashcards: parseInt(stats.due_flashcards) || 0,
    streakDays: parseInt(streakResult.rows[0]?.streak_days) || 0,
    totalStudyTime: 0, // Would need to calculate from sessions
    topics,
    preferences: prefs
      ? {
          dailyGoal: prefs.daily_goal_minutes,
          notificationsEnabled: prefs.reminder_enabled,
        }
      : undefined,
  };
}

// ═══════════════════════════════════════════════════════════════
// EXPORT TOOL DEFINITIONS
// ═══════════════════════════════════════════════════════════════

export const contextToolDefinitions = {
  get_context: {
    name: 'get_context',
    description:
      "Charge le contexte complet de l'utilisateur incluant profil, documents, candidatures, memberships, etc. Utilise 'mode' pour optimiser les données chargées.",
    parameters: getContextSchema,
    execute: getContext,
  },
};
