import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError } from 'zod';

import { logger } from '../utils';
/**
 * Validation middleware factory
 * Creates a middleware that validates request body/params/query against a Zod schema
 *
 * Zod messages are translation keys (e.g., 'validation:opportunity.titleMinLength')
 * The validate() middleware translates them using req.t()
 */
export const validate = (schema: ZodSchema, target: 'body' | 'params' | 'query' = 'body') => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req[target];
      const result = schema.safeParse(data);

      if (!result.success) {
        const zodError = result.error as ZodError;
        const errors = zodError.issues.map((issue) => ({
          field: issue.path.join('.'),
          // Translate the message key if it looks like a translation key
          message: issue.message.includes(':') ? req.t(issue.message) : issue.message
        }));

        return res.status(400).json({
          error: req.t('validation:validationFailed'),
          details: errors
        });
      }

      // Replace request data with parsed/transformed data
      req[target] = result.data;
      next();
    } catch (error) {
      logger.error('Validation error:', error);
      res.status(500).json({ error: req.t('validation:internalError') });
    }
  };
};

// --- Application Schemas ---

// Application answer schema
const applicationAnswerSchema = z.object({
  question_id: z.string().min(1, 'validation:application.questionIdRequired'),
  answer: z.string().max(2000, 'validation:application.answerMaxLength')
});

// Create application schema
export const createApplicationSchema = z.object({
  opportunity_id: z.string().uuid('validation:application.invalidOpportunityId'),
  cover_letter: z.string().max(5000, 'validation:application.coverLetterMaxLength').optional(),
  custom_answers: z.array(applicationAnswerSchema).optional(),
  answers: z.array(applicationAnswerSchema).optional(), // Accept both "answers" and "custom_answers"
  resume_url: z.string().optional() // Accept any string (URL or file:// URI for mobile)
});

// Update application status schema
export const updateApplicationStatusSchema = z.object({
  status: z.enum(['SUBMITTED', 'IN_REVIEW', 'ACCEPTED', 'REJECTED'], {
    message: 'validation:application.invalidStatus'
  })
});

// Update application notes schema
export const updateApplicationNotesSchema = z.object({
  notes: z.string().max(10000, 'validation:application.notesMaxLength').nullable()
});

// Update application rating schema
export const updateApplicationRatingSchema = z.object({
  rating: z.number()
    .int('validation:application.ratingMustBeInt')
    .min(1, 'validation:application.ratingMin')
    .max(5, 'validation:application.ratingMax')
    .nullable()
});

// Bulk update status schema
export const bulkUpdateStatusSchema = z.object({
  application_ids: z.array(z.string().uuid('validation:application.invalidApplicationId'))
    .min(1, 'validation:application.atLeastOne')
    .max(100, 'validation:application.maxBulk'),
  status: z.enum(['SUBMITTED', 'IN_REVIEW', 'ACCEPTED', 'REJECTED'], {
    message: 'validation:application.invalidStatus'
  })
});

// --- Opportunity Schemas ---

// Opportunity location schema
const opportunityLocationSchema = z.object({
  city: z.string().max(100).optional(),
  region: z.string().max(100).optional(),
  country: z.string().length(2, 'validation:common.countryCodeFormat').optional(),
  is_primary: z.boolean().optional()
});

// Custom question schema
const customQuestionSchema = z.object({
  id: z.string(),
  question: z.string().max(500, 'validation:opportunity.questionMaxLength'),
  required: z.boolean(),
  max_length: z.number().int().min(50).max(5000).optional()
});

// Base opportunity schema (without refinements for .partial() compatibility in Zod v4)
const baseOpportunitySchema = z.object({
  title: z.string()
    .min(3, 'validation:opportunity.titleMinLength')
    .max(200, 'validation:opportunity.titleMaxLength'),
  type: z.enum(['EMPLOYMENT', 'INTERNSHIP', 'ENTREPRENEURSHIP', 'ALTERNATION', 'FREELANCE', 'VOLUNTEER']).optional(),
  contract_type: z.enum(['CDI', 'CDD', 'APPRENTICESHIP', 'INTERNSHIP', 'FREELANCE', 'SERVICE', 'INTERIM']).optional(),
  work_rhythm: z.enum(['FULL_TIME', 'PART_TIME', 'FLEXIBLE', 'OCCASIONAL']).optional(),
  summary: z.string().max(5000, 'validation:opportunity.summaryMaxLength').optional(),
  requirements: z.string().max(10000, 'validation:opportunity.requirementsMaxLength').optional(),
  nice_to_have: z.string().max(5000, 'validation:opportunity.niceToHaveMaxLength').optional(),
  compensation_min: z.number().min(0).optional(),
  compensation_max: z.number().min(0).optional(),
  currency: z.string().length(3, 'validation:common.currencyFormat').optional(),
  compensation_frequency: z.enum(['HOURLY', 'MONTHLY', 'YEARLY', 'PROJECT']).optional(),
  location_type: z.enum(['ON_SITE', 'REMOTE', 'HYBRID']).optional(),
  locations: z.array(opportunityLocationSchema).max(10).optional(),
  deadline: z.string().optional(),
  start_date: z.string().optional(),
  duration: z.string().max(100).optional(),
  status: z.enum(['DRAFT', 'OPEN', 'PAUSED', 'FILLED', 'EXPIRED']).optional(),
  cv_required: z.boolean().optional(),
  application_questions: z.array(customQuestionSchema).max(10, 'validation:opportunity.maxQuestions').optional(),
  organization_id: z.string().uuid('validation:common.invalidOrgId').optional(),
  visibility: z.enum(['PUBLIC', 'PRIVATE']).optional(),
  // Media (illustrations et pièces jointes)
  cover_image_url: z.string().max(2000).optional(),
  images: z.array(z.string().max(2000)).max(20).optional(),
  attachments: z.array(z.object({
    name: z.string().max(255),
    url: z.string().max(2000),
    type: z.string().max(100).optional(),
    size: z.number().int().min(0).optional(),
  })).max(20).optional(),
});

// Compensation refinement function
const compensationRefinement = (data: any) =>
  !data.compensation_min || !data.compensation_max || data.compensation_min <= data.compensation_max;

// Create opportunity schema with refinements
export const createOpportunitySchema = baseOpportunitySchema
  .refine(
    (data) => !!data.deadline,
    { message: 'validation:opportunity.deadlineRequired', path: ['deadline'] }
  )
  .refine(
    compensationRefinement,
    { message: 'validation:opportunity.compensationRange', path: ['compensation_min'] }
  );

// Update opportunity schema (all fields optional, with refinements)
export const updateOpportunitySchema = baseOpportunitySchema.partial().refine(
  compensationRefinement,
  { message: 'validation:opportunity.compensationRange', path: ['compensation_min'] }
);

// --- Uuid Param Schema ---

export const uuidParamSchema = z.object({
  id: z.string().uuid('validation:common.invalidId')
});

export const opportunityIdParamSchema = z.object({
  opportunityId: z.string().uuid('validation:application.invalidOpportunityId')
});

// --- Auth Schemas ---

export const requestOtpSchema = z.object({
  email: z.string()
    .email('validation:auth.invalidEmail')
    .max(255, 'validation:auth.emailTooLong')
    .transform((v) => v.toLowerCase().trim())
});

export const requestWhatsAppOtpSchema = z.object({
  phone: z.string()
    .min(8, 'validation:auth.invalidPhone')
    .max(30, 'validation:auth.invalidPhone')
    .transform((v) => v.trim())
});

export const verifyOtpSchema = z.object({
  email: z.string()
    .email('validation:auth.invalidEmail')
    .transform((v) => v.toLowerCase().trim()),
  code: z.string()
    .length(6, 'validation:auth.codeLength')
    .regex(/^\d{6}$/, 'validation:auth.codeDigits')
});

export const verifyWhatsAppOtpSchema = z.object({
  phone: z.string()
    .min(8, 'validation:auth.invalidPhone')
    .max(30, 'validation:auth.invalidPhone')
    .transform((v) => v.trim()),
  code: z.string()
    .length(6, 'validation:auth.codeLength')
    .regex(/^\d{6}$/, 'validation:auth.codeDigits')
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'validation:auth.refreshTokenRequired')
});

export const googleAuthSchema = z.object({
  idToken: z.string().min(100, 'validation:auth.invalidToken'),
});

// --- Onboarding Schemas ---

const VALID_PROFILE_TAGS = [
  'STUDENT', 'PUPIL', 'JOB_SEEKER', 'SALARIED', 'ENTREPRENEUR',
  'CIVIL_SERVANT', 'MANAGER', 'CONSULTANT', 'INVESTOR',
  'CONTENT_CREATOR', 'COACH', 'RETIRED',
] as const;

const VALID_GOALS = [
  'LEARN_NEW_SKILLS', 'PREPARE_EXAMS', 'FIND_JOB', 'ADVANCE_CAREER',
  'RESEARCH_SUPPORT', 'IMPROVE_PRODUCTIVITY', 'COLLABORATIVE_LEARNING',
  'TEACH_OR_MENTOR', 'BUILD_NETWORK_OR_VISIBILITY', 'CONTRIBUTE_OR_GIVE_BACK',
] as const;

const VALID_SECTORS = [
  'AGRICULTURE', 'RESOURCES', 'ENERGY', 'ENVIRONMENT', 'INDUSTRY',
  'CONSTRUCTION', 'TRANSPORT', 'COMMERCE', 'FINANCE', 'DIGITAL',
  'MEDIA', 'TOURISM', 'HEALTH', 'EDUCATION', 'PROFESSIONAL_SERVICES',
  'RESEARCH', 'PUBLIC', 'SECURITY', 'SOCIAL_IMPACT', 'PERSONAL_SERVICES',
  'CRAFTS',
  // Legacy values (backward compat)
  'TECH', 'RETAIL', 'SERVICES', 'HOSPITALITY', 'OTHER'
] as const;

export const onboardingSchema = z.object({
  firstName: z.string()
    .min(1, 'validation:onboarding.firstNameRequired')
    .max(100, 'validation:onboarding.firstNameTooLong')
    .transform((v) => v.trim()),
  lastName: z.string()
    .max(100, 'validation:onboarding.lastNameTooLong')
    .optional(),
  bio: z.string()
    .max(2000, 'validation:onboarding.bioTooLong')
    .optional(),
  phone: z.string()
    .min(8, 'validation:onboarding.phoneMinLength')
    .max(20, 'validation:onboarding.phoneTooLong'),
  city: z.string()
    .max(100, 'validation:onboarding.cityTooLong')
    .optional(),
  region: z.string()
    .max(100, 'validation:onboarding.regionTooLong')
    .optional(),
  country: z.string()
    .length(2, 'validation:common.countryCodeFormat')
    .optional(),
  profileTags: z.array(z.enum(VALID_PROFILE_TAGS))
    .max(3, 'validation:onboarding.maxProfileTags')
    .optional(),
  goals: z.array(z.enum(VALID_GOALS))
    .max(3, 'validation:onboarding.maxGoals')
    .optional(),
  sectors: z.array(z.enum(VALID_SECTORS))
    .max(5, 'validation:onboarding.maxSectors')
    .optional(),
  gender: z.string().max(20).optional(),
  remoteReady: z.boolean().optional(),
  willingToRelocate: z.boolean().optional()
});

// --- Community Schemas ---

const COMMUNITY_TYPES = [
  'GENERAL', 'PROFESSIONAL', 'ALUMNI',
  'INTEREST', 'LOCAL', 'LEARNING',
  // Meeting mode types (used by mobile)
  'ONLINE', 'OFFLINE', 'HYBRID',
] as const;

const COMMUNITY_ACCESS_TYPES = [
  'OPEN', 'APPROVAL', 'INVITE_ONLY', 'PAID'
] as const;

export const createCommunitySchema = z.object({
  name: z.string()
    .min(3, 'validation:community.nameMinLength')
    .max(100, 'validation:community.nameMaxLength'),
  description: z.string()
    .max(5000, 'validation:community.descriptionMaxLength')
    .optional(),
  type: z.enum(COMMUNITY_TYPES).optional(),
  access_type: z.enum(COMMUNITY_ACCESS_TYPES).optional(),
  visibility: z.enum(['PUBLIC', 'PRIVATE']).optional(),
  organization_id: z.string().uuid('validation:common.invalidOrgId'),
  is_paid: z.boolean().optional(),
  monthly_price: z.number().min(0).optional(),
  currency: z.string().length(3, 'validation:common.currencyFormat').optional(),
  trial_days: z.number().int().min(0).max(90).optional(),
  sectors: z.array(z.string()).max(10).optional(),
  rules: z.string().max(10000).optional(),
  tags: z.array(z.string()).max(10).optional(),
  application_questions: z.unknown().optional(),
  city: z.string().max(100).optional(),
  region: z.string().max(100).optional(),
  country: z.string().length(2, 'validation:common.countryCodeFormat').optional(),
  cover_image_url: z.string().max(2000).optional(),
  images: z.array(z.string().max(2000)).max(20).optional(),
  default_member_permissions: z.object({
    can_post: z.boolean().optional(),
    can_create_event: z.boolean().optional(),
    can_create_poll: z.boolean().optional(),
  }).optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'INACTIVE']).optional(),
});

export const updateCommunitySchema = createCommunitySchema.partial();

export const joinCommunitySchema = z.object({
  join_reason: z.string().max(1000, 'validation:community.joinReasonMaxLength').optional()
});

// --- Organization Schemas ---

const ORGANIZATION_TYPES = [
  'COMPANY', 'STARTUP', 'NGO', 'ASSOCIATION',
  'EDUCATIONAL_INSTITUTION', 'PUBLIC_ADMINISTRATION',
  'TRAINING_CENTER', 'CONSULTING_FIRM', 'RECRUITMENT_AGENCY',
  'FINANCIAL_INSTITUTION', 'RESEARCH_CENTER',
  'COOPERATIVE', 'SOCIAL_ENTERPRISE'
] as const;

const MAX_ORG_TYPES = 3;

export const createOrganizationSchema = z.object({
  name: z.string()
    .min(2, 'validation:organization.nameMinLength')
    .max(200, 'validation:organization.nameMaxLength'),
  types: z.array(z.enum(ORGANIZATION_TYPES))
    .max(MAX_ORG_TYPES, 'validation:organization.typesMaxItems')
    .optional(),
  description: z.string()
    .max(5000, 'validation:organization.descriptionMaxLength')
    .optional(),
  logo_url: z.string().max(2000).optional(),
  website_url: z.string().max(2000).optional(),
  contact_email: z.string().email('validation:auth.invalidEmail').optional().or(z.literal('')),
  contact_phone: z.string().max(30).optional(),
  headquarters_city: z.string().max(100).optional(),
  headquarters_region: z.string().max(100).optional(),
  headquarters_country: z.string().max(10).optional(),
  headquarters_coordinates: z.object({
    longitude: z.number(),
    latitude: z.number(),
  }).optional(),
  sectors: z.array(z.string()).max(10).optional(),
  goals: z.array(z.string()).max(10).optional(),
});

export const updateOrganizationSchema = createOrganizationSchema.partial();

// --- Kyc Schemas ---

const DOCUMENT_TYPES = [
  'NATIONAL_ID', 'PASSPORT', 'DRIVER_LICENSE', 'RESIDENCE_PERMIT'
] as const;

export const kycSubmitSchema = z.object({
  document_type: z.enum(DOCUMENT_TYPES, {
    message: 'validation:kyc.invalidDocumentType'
  }),
  front_image_url: z.string().min(1, 'validation:kyc.frontImageRequired'),
  back_image_url: z.string().optional()
});

// --- Talent Schemas ---

export const updateTalentSchema = z.object({
  first_name: z.string().min(1).max(100).optional(),
  last_name: z.string().min(1).max(100).optional(),
  bio: z.string().max(2000).optional(),
  avatar_url: z.string().max(2000).optional(),
  email: z.string().email().max(255).optional().nullable(),
  phone: z.string().max(20).optional(),
  gender: z.string().max(20).optional(),
  city: z.string().max(100).optional(),
  region: z.string().max(100).optional(),
  country: z.string().max(10).optional(),
  profile_tags: z.array(z.enum(VALID_PROFILE_TAGS)).max(3).optional(),
  goals: z.array(z.enum(VALID_GOALS)).max(3).optional(),
  sectors: z.array(z.enum(VALID_SECTORS)).max(5).optional(),
  remote_ready: z.boolean().optional(),
  willing_to_relocate: z.boolean().optional(),
  learning_preferences: z.record(z.string(), z.unknown()).optional(),
});

// --- Pagination Schemas ---

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0)
});

// --- Booking / Space Schemas ---

export const createBookingSchema = z.object({
  space_id: z.string().uuid('validation:space.invalidSpaceId'),
  date: z.string().refine((v) => !isNaN(Date.parse(v)), 'validation:common.invalidDate'),
  start_time: z.string().regex(/^\d{2}:\d{2}$/, 'validation:space.invalidTimeFormat'),
  end_time: z.string().regex(/^\d{2}:\d{2}$/, 'validation:space.invalidTimeFormat'),
  purpose: z.string().max(500).optional(),
  attendees_count: z.number().int().min(1).optional()
});

// --- Invitation Schemas ---

export const communityInvitationSchema = z.object({
  email: z.string().email('validation:auth.invalidEmail').optional(),
  invitee_talent_id: z.string().uuid().optional(),
  role: z.enum(['MEMBER', 'MODERATOR', 'ADMIN']).optional(),
  message: z.string().max(500).optional()
}).refine(
  (data) => data.email || data.invitee_talent_id,
  { message: 'validation:invitation.emailOrTalentRequired' }
);

export const organizationInvitationSchema = z.object({
  email: z.string().email('validation:auth.invalidEmail'),
  role: z.enum(['MEMBER', 'ADMIN', 'OWNER']),
  message: z.string().max(500).optional()
});
