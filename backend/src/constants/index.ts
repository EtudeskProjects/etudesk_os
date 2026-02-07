/**
 * Backend Constants
 * Centralized constants to avoid magic numbers/strings
 */

// --- Pagination ---

export const PAGINATION = {
  DEFAULT_LIMIT: 50,
  MAX_LIMIT: 100,
  DEFAULT_OFFSET: 0,
} as const;

// --- File Upload ---

export const FILE_UPLOAD = {
  MAX_ATTACHMENTS: 5,
  MAX_IMAGES: 10,
  MAX_FILE_SIZE_MB: 10,
  MAX_IMAGE_SIZE_MB: 5,
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  ALLOWED_DOCUMENT_TYPES: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
} as const;

// --- Time Intervals In Milliseconds ---

export const TIME_MS = {
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
  MONTH_30: 30 * 24 * 60 * 60 * 1000,
} as const;

// --- Cron Intervals ---

export const CRON_INTERVALS = {
  OTP_CLEANUP: TIME_MS.HOUR,                    // Every hour
  SUBSCRIPTION_CHECK: TIME_MS.DAY,              // Every 24h
  PAYMENT_RETRY: TIME_MS.DAY,                   // Every 24h
  NOTIFICATION_PROCESS: 10 * TIME_MS.MINUTE,    // Every 10 minutes
  ACTIVITY_PUBLISH: 5 * TIME_MS.MINUTE,         // Every 5 minutes
  NOTIFICATION_CLEANUP: TIME_MS.WEEK,           // Every week
} as const;

// --- Subscription / Payment ---

export const SUBSCRIPTION = {
  MAX_RETRY_COUNT: 3,
  TRIAL_PERIOD_OPTIONS: [0, 1, 3, 7, 30] as const,
  DEFAULT_CURRENCY: 'XOF',
  NOTIFICATION_DAYS_BEFORE_EXPIRY: 7,
  OLD_NOTIFICATIONS_DAYS: 90,
} as const;

// --- Document Limits ---

export const DOCUMENT = {
  MAX_PER_TALENT: 20,
  MAX_FILENAME_LENGTH: 255,
} as const;

// --- Status Values ---

export const MEMBER_STATUS = {
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  REJECTED: 'REJECTED',
  SUSPENDED: 'SUSPENDED',
  ARCHIVED: 'ARCHIVED',
} as const;

export const COMMUNITY_STATUS = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  DELETED: 'DELETED',
} as const;

export const OPPORTUNITY_STATUS = {
  DRAFT: 'DRAFT',
  OPEN: 'OPEN',
  PAUSED: 'PAUSED',
  CLOSED: 'CLOSED',
} as const;

export const APPLICATION_STATUS = {
  SUBMITTED: 'SUBMITTED',
  IN_REVIEW: 'IN_REVIEW',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
} as const;

export const PAYMENT_STATUS = {
  PENDING: 'PENDING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
} as const;

// --- Access Types ---

export const ACCESS_TYPE = {
  PUBLIC: 'PUBLIC',
  PRIVATE: 'PRIVATE',
  MEMBERSHIP: 'MEMBERSHIP',
} as const;

export const VISIBILITY = {
  PUBLIC: 'PUBLIC',
  PRIVATE: 'PRIVATE',
} as const;

// --- Roles ---

export const COMMUNITY_ROLE = {
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
} as const;

export const ORGANIZATION_ROLE = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  MEMBER: 'MEMBER',
} as const;

// --- Learning Preferences Study Mode Analysis ---

export const LEARNING_PREFERENCES = {
  STYLE: ['VISUAL', 'AUDITORY', 'TEXT_BASED', 'INTERACTIVE'],
  INTERACTION: ['SOCRATIC', 'DIRECT', 'EXPLORATORY'],
  DEPTH: ['THEORETICAL', 'PRACTICAL', 'BALANCED'],
  DIFFICULTY: ['GENTLE', 'STANDARD', 'CHALLENGING'],
} as const;
