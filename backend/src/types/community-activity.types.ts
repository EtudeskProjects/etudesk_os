// COMMUNITY ACTIVITY TYPES
// Updated: 2026-01-25
// --- Enums & Constants ---

// Simplified roles: ADMIN (org members) or MEMBER (regular users)
export type CommunityRole = 'ADMIN' | 'MEMBER';

export type ActivityType = 'POST' | 'EVENT' | 'POLL';

export type ModerationStatus = 'APPROVED' | 'FLAGGED' | 'PENDING' | 'REJECTED';

export type EventLocationType = 'ONLINE' | 'PHYSICAL';

// --- Notification Types ---

export type CommunityNotificationType =
  | 'MENTION'
  | 'COMMENT_REPLY'
  | 'NEW_ACTIVITY'
  | 'EVENT_REMINDER_1D'
  | 'EVENT_REMINDER_1H'
  | 'MEMBERSHIP_APPROVED'
  | 'MEMBERSHIP_REJECTED';

// --- Activity Metadata ---

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

// --- Activity Interfaces ---

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

  // Draft / Scheduling
  is_draft: boolean;
  scheduled_at?: Date | null;  // NULL = immediate publication
  published_at?: Date | null;  // Actual publication time

  // Counters (denormalized)
  reactions_count: number;     // Likes count
  comments_count: number;

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

// --- Poll Interfaces ---

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

// --- Comment Interfaces ---

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

// --- Bookmark Interface ---

export interface ActivityBookmark {
  activity_id: string;
  user_id: string;
  created_at: Date;
}

// --- Like Interface Simplified From Reactions ---

export interface ActivityLike {
  activity_id: string;
  user_id: string;
  created_at: Date;
}

// --- Notification Interfaces ---

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

// --- Dtos Data Transfer Objects ---

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

export interface VotePollDTO {
  activity_id: string;
  option_id: string;
  user_id: string;
}

// --- Query Filters ---

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

// --- Validation Constants ---

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
