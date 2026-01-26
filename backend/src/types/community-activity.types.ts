// ═══════════════════════════════════════════════════════════════
// COMMUNITY ACTIVITY TYPES
// Updated: 2026-01-25
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────
// ENUMS & CONSTANTS
// ─────────────────────────────────────────────────────────────────

// Simplified roles: ADMIN (org members) or MEMBER (regular users)
export type CommunityRole = 'ADMIN' | 'MEMBER';

export type ActivityType = 'POST' | 'EVENT' | 'POLL';

export type ModerationStatus = 'APPROVED' | 'FLAGGED' | 'PENDING' | 'REJECTED';

export type EventLocationType = 'ONLINE' | 'PHYSICAL';

// Trial period options (in days)
export type TrialPeriodDays = 0 | 1 | 3 | 7 | 30;

// ─────────────────────────────────────────────────────────────────
// SUBSCRIPTION & PAYMENT TYPES
// ─────────────────────────────────────────────────────────────────

export type SubscriptionStatus = 'ACTIVE' | 'CANCELLED' | 'EXPIRED' | 'TRIAL' | 'PAST_DUE';

export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';

export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PAID' | 'VOID';

// ─────────────────────────────────────────────────────────────────
// NOTIFICATION TYPES
// ─────────────────────────────────────────────────────────────────

export type CommunityNotificationType =
  | 'MENTION'
  | 'COMMENT_REPLY'
  | 'NEW_ACTIVITY'
  | 'EVENT_REMINDER_1D'
  | 'EVENT_REMINDER_1H'
  | 'SUBSCRIPTION_EXPIRING'
  | 'SUBSCRIPTION_EXPIRED'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_SUCCESS'
  | 'MEMBERSHIP_APPROVED'
  | 'MEMBERSHIP_REJECTED';

// ─────────────────────────────────────────────────────────────────
// ACTIVITY METADATA
// ─────────────────────────────────────────────────────────────────

export interface EventMetadata {
  start_date: string;
  end_date?: string;
  location_type: EventLocationType;
  location?: string;        // Physical address or venue name
  meeting_url?: string;     // Zoom, Meet, etc. (for ONLINE events)
}

export interface PollMetadata {
  multiple_choice: boolean;  // true = multiple selections allowed
  poll_end_date?: string;    // ISO date string
  show_results: boolean;     // true = results visible, false = hidden until poll ends
  options?: string[];        // Used during creation only
}

export interface CommunityActivityMetadata {
  // Event specific
  start_date?: string;
  end_date?: string;
  location_type?: EventLocationType;
  location?: string;
  meeting_url?: string;

  // Poll specific
  multiple_choice?: boolean;
  poll_end_date?: string;
  show_results?: boolean;
  options?: string[];
}

// ─────────────────────────────────────────────────────────────────
// ACTIVITY INTERFACES
// ─────────────────────────────────────────────────────────────────

export interface CommunityActivity {
  id: string;
  community_id: string;
  author_id: string;
  type: ActivityType;
  content: string;
  metadata: CommunityActivityMetadata;
  attachments: string[]; // URLs, max 5 files, max 20MB each

  // Status
  is_pinned: boolean;
  moderation_status: ModerationStatus;
  moderation_reason?: string;

  // Scheduling
  scheduled_at?: Date | null;  // NULL = immediate publication
  published_at?: Date | null;  // Actual publication time

  // Counters (denormalized)
  reactions_count: number;     // Likes count
  comments_count: number;
  bookmarks_count: number;
  views_count: number;

  // Timestamps
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date | null;

  // Joined fields (from queries)
  author?: ActivityAuthor;
  has_liked?: boolean;           // Current user has liked
  user_vote_id?: string | null;  // Current user's vote option id (for polls)
  is_bookmarked?: boolean;       // Current user has bookmarked
  poll_options?: PollOption[];   // For polls
}

export interface ActivityAuthor {
  id: string;
  display_name: string;
  avatar_url: string;
  headline?: string;
}

// ─────────────────────────────────────────────────────────────────
// POLL INTERFACES
// ─────────────────────────────────────────────────────────────────

export interface PollOption {
  id: string;
  activity_id: string;
  text: string;
  order_index: number;
  votes_count: number;
  is_voted_by_user?: boolean;
}

export interface PollVote {
  activity_id: string;
  option_id: string;
  user_id: string;
  created_at: Date;
}

// ─────────────────────────────────────────────────────────────────
// COMMENT INTERFACES
// ─────────────────────────────────────────────────────────────────

export interface ActivityComment {
  id: string;
  activity_id: string;
  author_id: string;
  content: string;
  parent_id?: string | null;

  // Mentions
  mentions?: string[];  // Array of talent UUIDs mentioned (@pseudo)

  // Status
  moderation_status: ModerationStatus;

  // Counters
  replies_count: number;

  // Timestamps
  created_at: Date;
  updated_at: Date;
  edited_at?: Date | null;  // NULL = never edited
  deleted_at?: Date | null;

  // Joined fields
  author?: ActivityAuthor;
  replies?: ActivityComment[];
}

// ─────────────────────────────────────────────────────────────────
// BOOKMARK INTERFACE
// ─────────────────────────────────────────────────────────────────

export interface ActivityBookmark {
  activity_id: string;
  user_id: string;
  created_at: Date;
}

// ─────────────────────────────────────────────────────────────────
// LIKE INTERFACE (simplified from reactions)
// ─────────────────────────────────────────────────────────────────

export interface ActivityLike {
  activity_id: string;
  user_id: string;
  created_at: Date;
}

// ─────────────────────────────────────────────────────────────────
// SUBSCRIPTION INTERFACES
// ─────────────────────────────────────────────────────────────────

export interface CommunitySubscription {
  id: string;
  community_id: string;
  talent_id: string;

  status: SubscriptionStatus;

  // Dates
  started_at: Date;
  trial_ends_at?: Date | null;
  current_period_start: Date;
  current_period_end: Date;
  cancelled_at?: Date | null;

  // Pricing
  amount: number;
  currency: string;

  // Paystack
  paystack_subscription_code?: string;
  paystack_customer_code?: string;
  paystack_email_token?: string;
  paystack_plan_code?: string;

  auto_renew: boolean;

  created_at: Date;
  updated_at: Date;
}

export interface CommunityPayment {
  id: string;
  subscription_id: string;

  amount: number;
  currency: string;
  status: PaymentStatus;

  // Paystack
  paystack_reference?: string;
  paystack_transaction_id?: string;
  paystack_authorization_code?: string;

  // Period
  period_start: Date;
  period_end: Date;

  // Failure handling
  failure_reason?: string;
  failure_code?: string;
  retry_count: number;
  next_retry_at?: Date | null;

  metadata?: Record<string, unknown>;

  paid_at?: Date | null;
  created_at: Date;
}

export interface CommunityInvoice {
  id: string;
  payment_id: string;
  subscription_id: string;
  talent_id: string;
  community_id: string;

  invoice_number: string;

  amount: number;
  currency: string;

  community_name: string;  // Snapshot

  period_start: Date;
  period_end: Date;

  pdf_url?: string;
  pdf_generated_at?: Date | null;

  status: InvoiceStatus;

  issued_at: Date;
  created_at: Date;
}

// ─────────────────────────────────────────────────────────────────
// NOTIFICATION INTERFACES
// ─────────────────────────────────────────────────────────────────

export interface CommunityNotification {
  id: string;
  talent_id: string;
  community_id: string;

  type: CommunityNotificationType;

  // References
  activity_id?: string | null;
  comment_id?: string | null;
  actor_id?: string | null;

  // Content
  title: string;
  body?: string;
  data?: Record<string, unknown>;

  // Status
  read_at?: Date | null;

  // For scheduled notifications
  scheduled_for?: Date | null;
  sent_at?: Date | null;

  created_at: Date;

  // Joined fields
  actor?: ActivityAuthor;
  activity?: Partial<CommunityActivity>;
  community?: {
    id: string;
    name: string;
    slug: string;
  };
}

// ─────────────────────────────────────────────────────────────────
// DTOs (Data Transfer Objects)
// ─────────────────────────────────────────────────────────────────

export interface CreateActivityDTO {
  community_id: string;
  author_id: string;
  type: ActivityType;
  content: string;
  metadata?: CommunityActivityMetadata;
  attachments?: string[];
  scheduled_at?: string | null;  // ISO date string for scheduled posts
  is_draft?: boolean;  // Save as draft without publishing
}

export interface UpdateActivityDTO {
  content?: string;
  metadata?: Partial<CommunityActivityMetadata>;
  attachments?: string[];
  scheduled_at?: string | null;
}

export interface CreateCommentDTO {
  activity_id: string;
  author_id: string;
  content: string;
  parent_id?: string | null;
  mentions?: string[];  // Array of talent UUIDs
}

export interface UpdateCommentDTO {
  content: string;
  mentions?: string[];
}

export interface CreateSubscriptionDTO {
  community_id: string;
  talent_id: string;
  paystack_reference: string;
}

export interface VotePollDTO {
  activity_id: string;
  option_id: string;
  user_id: string;
}

// ─────────────────────────────────────────────────────────────────
// QUERY FILTERS
// ─────────────────────────────────────────────────────────────────

export interface ActivityFilters {
  community_id: string;
  type?: ActivityType;
  author_id?: string;
  moderation_status?: ModerationStatus;
  is_pinned?: boolean;
  include_scheduled?: boolean;  // Include future scheduled posts (for admins)
  limit?: number;
  offset?: number;
}

export interface CommentFilters {
  activity_id: string;
  parent_id?: string | null;  // NULL = top-level comments only
  limit?: number;
  offset?: number;
}

export interface NotificationFilters {
  talent_id: string;
  community_id?: string;
  type?: CommunityNotificationType;
  unread_only?: boolean;
  limit?: number;
  offset?: number;
}

// ─────────────────────────────────────────────────────────────────
// VALIDATION CONSTANTS
// ─────────────────────────────────────────────────────────────────

export const ACTIVITY_VALIDATION = {
  MAX_CONTENT_LENGTH: 2500,      // ~500 words
  MAX_ATTACHMENTS: 5,
  MAX_ATTACHMENT_SIZE_MB: 20,
  MAX_POLL_OPTIONS: 10,
  MIN_POLL_OPTIONS: 2,
} as const;

export const COMMENT_VALIDATION = {
  MAX_CONTENT_LENGTH: 1000,
  MAX_MENTIONS: 10,
} as const;
