/**
 * Repositories Index
 *
 * Exports all repository instances for use across the application.
 * Repositories handle all database operations, keeping routes and services clean.
 *
 * Usage:
 * ```typescript
 * import { talentRepository, organizationRepository } from '../repositories';
 *
 * // Find a talent
 * const talent = await talentRepository.findByEmail('user@example.com');
 *
 * // Create an organization
 * const org = await organizationRepository.create({ name: 'Acme', slug: 'acme', types: ['COMPANY'] });
 * ```
 */

// Base
export {
  BaseRepository,
  type PaginationOptions,
  type PaginatedResult,
  type QueryParam,
  type DbQueryResult,
} from './base.repository';

// Talent
export {
  talentRepository,
  type Talent,
  type TalentWithStats,
  type CreateTalentDTO,
  type UpdateTalentDTO,
  type TalentFilters,
} from './talent.repository';

// Organization
export {
  organizationRepository,
  type Organization,
  type OrganizationWithStats,
  type OrganizationType,
  type CreateOrganizationDTO,
  type UpdateOrganizationDTO,
  type OrganizationFilters,
  type OrganizationMember,
} from './organization.repository';

// Opportunity
export {
  opportunityRepository,
  type Opportunity,
  type OpportunityWithOrgs,
  type OpportunityType,
  type OpportunityStatus,
  type LocationType,
  type Visibility,
  type CreateOpportunityDTO,
  type UpdateOpportunityDTO,
  type OpportunityFilters,
} from './opportunity.repository';

// Community
export {
  communityRepository,
  type Community,
  type CommunityWithStats,
  type CommunityVisibility,
  type CommunityMembership,
  type MembershipStatus,
  type MemberRole,
  type CreateCommunityDTO,
  type UpdateCommunityDTO,
  type CommunityFilters,
} from './community.repository';

// Space
export {
  spaceRepository,
  type Space,
  type SpaceWithStats,
  type SpaceType,
  type SpaceVisibility,
  type SpaceBooking,
  type CreateSpaceDTO,
  type UpdateSpaceDTO,
  type SpaceFilters,
} from './space.repository';

// Notification
export {
  notificationRepository,
  type Notification,
  type NotificationType,
  type CreateNotificationDTO,
  type NotificationFilters,
} from './notification.repository';

// Bookmark
export {
  bookmarkRepository,
  type Bookmark,
  type BookmarkWithTarget,
  type BookmarkTargetType,
  type CreateBookmarkDTO,
} from './bookmark.repository';

// Application
export {
  applicationRepository,
  type Application,
  type ApplicationStatus,
  type CreateApplicationDTO,
  type UpdateApplicationDTO,
  type ApplicationWithDetails,
} from './application.repository';
