/**
 * Services Index
 * Central export for all API services
 */

export { api } from './api';
export type { ApiResponse, ApiError } from './api';

export { opportunityService } from './opportunityService';
export type { OpportunityFilters, CreateOpportunityData, UpdateOpportunityData, GenerateOpportunityInput, GeneratedOpportunityData } from './opportunityService';

export { communityService, DEFAULT_MEMBER_PERMISSIONS } from './communityService';
export type {
  CommunityFilters,
  CreateCommunityData,
  UpdateCommunityData,
  GenerateCommunityInput,
  GeneratedCommunityData,
  MembershipAnswer,
  MembershipStatus,
  JoinCommunityData,
  JoinResult,
  MemberStatus,
  CommunityMember,
  CommunityMemberDetails,
  MemberPermissions
} from './communityService';

export { spaceService } from './spaceService';
export type {
  SpaceType,
  SpaceStatus,
  BookingStatus,
  PaymentStatus as SpacePaymentStatus,
  PricingType,
  PaymentMethod as SpacePaymentMethod,
  SpaceAvailability,
  Space,
  SpaceBooking,
  SpaceFilters,
  CreateSpaceData,
  UpdateSpaceData,
  GenerateSpaceInput,
  GeneratedSpaceData,
  CreateBookingData,
  BookingFilters,
  AvailabilityCheckResult
} from './spaceService';

export { otpService } from './otpService';

export { talentService } from './talentService';
export type { UpdateTalentData } from './talentService';

export { organizationService } from './organizationService';
export type { CreateOrganizationData, UpdateOrganizationData, OrganizationFilters } from './organizationService';

export { organizationMemberService } from './organizationMemberService';
export type { InviteMemberData, UpdateMemberData } from './organizationMemberService';

export { kycService } from './kycService';
export type { KYCDocumentType, KYCStatus, KYCVerification, SubmitKYCData } from './kycService';

export { onboardingService } from './onboardingService';
export type { OnboardingData, OnboardingStatus, OnboardingOptions, OnboardingResult } from './onboardingService';

export { applicationService } from './applicationService';
export type { ApplicationFilters, CreateApplicationData, UpdateApplicationData } from './applicationService';

export { applicationMessageService } from './applicationMessageService';
export type { MessageFilters, SendMessageData } from './applicationMessageService';

export { ecosystemService } from './ecosystemService';
export type { EcosystemData, CalendarEvent } from './ecosystemService';

export { bookmarkService } from './bookmarkService';
export type {
  EntityType as BookmarkEntityType,
  BookmarkedOpportunity,
  BookmarkedSpace,
  BookmarkedCommunity,
  BookmarkIdsResponse,
  BookmarkToggleResponse
} from './bookmarkService';

export { imageService } from './imageService';
export type {
  ImageType,
  OptimizedImage,
  UploadedImage,
  PickImageOptions
} from './imageService';

export { paymentService } from './paymentService';
export type {
  PaymentProvider,
  PaymentMethod,
  AddPaymentMethodData
} from './paymentService';

export { billingService } from './billingService';
export type {
  BillingScope,
  BillingCatalogItem,
  BillingBalance,
  BillingInvoice,
  BillingInvoiceItem,
  CheckoutInitPayload,
  CheckoutInitResult,
  CheckoutVerifyResult,
} from './billingService';

export { notificationService } from './notificationService';
export type {
  NotificationType,
  Notification,
  NotificationPreferences,
  NotificationsResponse
} from './notificationService';

export { communityActivityService } from './communityActivityService';

export { communityNotificationService } from './communityNotificationService';
export type {
  CommunityNotificationType,
  CommunityNotification,
  NotificationFilters as CommunityNotificationFilters,
  UnreadCount as CommunityUnreadCount
} from './communityNotificationService';

export { communityInvitationService } from './communityInvitationService';
export type {
  InvitationStatus,
  InvitationRole,
  CommunityInvitation,
  SendInvitationData,
  SendInvitationsResult,
  AcceptInvitationResult
} from './communityInvitationService';

export { communityMembershipMessageService } from './communityMembershipMessageService';
export type {
  MembershipMessage,
  MessageFilters as MembershipMessageFilters,
  SendMessageData as MembershipSendMessageData
} from './communityMembershipMessageService';

export { spaceBookingService } from './spaceBookingService';
export type {
  SpaceBookingDetails,
  BookingFilters as SpaceBookingFilters,
  UpdateBookingStatusData,
  BookingExportResult
} from './spaceBookingService';

export { spaceBookingMessageService } from './spaceBookingMessageService';
export type {
  BookingMessage,
  BookingMessageAttachment,
  BookingMessageFilters,
  SendBookingMessageData
} from './spaceBookingMessageService';

export { spaceInvitationService } from './spaceInvitationService';
export type {
  SpaceInvitation,
  SendSpaceInvitationData,
  SendSpaceInvitationsResult,
  AcceptSpaceInvitationResult
} from './spaceInvitationService';

export { default as documentService } from './documentService';
export type {
  DocumentType,
  DocumentCategory,
  DocumentStatus,
  TalentDocument,
  DocumentStats,
  UploadDocumentParams,
  UpdateDocumentParams,
  ListDocumentsParams,
} from './documentService';
export {
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_CATEGORY_LABELS,
  DOCUMENT_STATUS_LABELS,
  formatFileSize,
  getFileExtension,
  isAllowedFileType,
  getStatusColor,
  getCategoryIcon,
} from './documentService';

export { dailyObjectiveService } from './dailyObjectiveService';
export type { DailyObjective } from './dailyObjectiveService';

export { orgTalentService } from './orgTalentService';
export type {
  OrgTalent,
  OrgTalentTag,
  OrgTalentFilters,
  OrgTalentListResponse,
  OrgTagDefinition,
} from './orgTalentService';
export { SOURCE_LABELS } from './orgTalentService';

export { orgDocumentService } from './orgDocumentService';
export type {
  OrgDocumentType,
  OrgDocumentCategory,
  OrgDocumentStatus,
  OrgDocument,
  OrgDocumentStats,
  UploadOrgDocumentParams,
  UpdateOrgDocumentParams,
  ListOrgDocumentsParams,
} from './orgDocumentService';
export {
  ORG_DOCUMENT_TYPE_LABELS,
  ORG_DOCUMENT_CATEGORY_LABELS,
  ORG_DOCUMENT_STATUS_LABELS,
  formatFileSize as formatOrgFileSize,
  getOrgDocStatusColor,
  getOrgDocCategoryIcon,
} from './orgDocumentService';
