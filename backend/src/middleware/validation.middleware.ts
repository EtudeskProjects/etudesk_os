import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError } from 'zod';

import { logger } from '../utils';
/**
 * Validation middleware factory
 * Creates a middleware that validates request body/params/query against a Zod schema
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
          message: issue.message
        }));

        return res.status(400).json({
          error: 'Validation échouée',
          details: errors
        });
      }

      // Replace request data with parsed/transformed data
      req[target] = result.data;
      next();
    } catch (error) {
      logger.error('Validation error:', error);
      res.status(500).json({ error: 'Erreur de validation interne' });
    }
  };
};

// ═══════════════════════════════════════════════════════════════
// APPLICATION SCHEMAS
// ═══════════════════════════════════════════════════════════════

// Application answer schema
const applicationAnswerSchema = z.object({
  question_id: z.string().min(1, 'ID de question requis'),
  answer: z.string().max(2000, 'La réponse ne doit pas dépasser 2000 caractères')
});

// Create application schema
export const createApplicationSchema = z.object({
  opportunity_id: z.string().uuid('ID d\'opportunité invalide'),
  cover_letter: z.string().max(5000, 'La lettre de motivation ne doit pas dépasser 5000 caractères').optional(),
  custom_answers: z.array(applicationAnswerSchema).optional(),
  answers: z.array(applicationAnswerSchema).optional(), // Accept both "answers" and "custom_answers"
  resume_url: z.string().optional() // Accept any string (URL or file:// URI for mobile)
});

// Update application status schema
export const updateApplicationStatusSchema = z.object({
  status: z.enum(['SUBMITTED', 'IN_REVIEW', 'ACCEPTED', 'REJECTED'], {
    message: 'Statut invalide'
  })
});

// Update application notes schema
export const updateApplicationNotesSchema = z.object({
  notes: z.string().max(10000, 'Les notes ne doivent pas dépasser 10000 caractères').nullable()
});

// Update application rating schema
export const updateApplicationRatingSchema = z.object({
  rating: z.number()
    .int('La note doit être un nombre entier')
    .min(1, 'La note minimum est 1')
    .max(5, 'La note maximum est 5')
    .nullable()
});

// Bulk update status schema
export const bulkUpdateStatusSchema = z.object({
  application_ids: z.array(z.string().uuid('ID de candidature invalide'))
    .min(1, 'Au moins une candidature est requise')
    .max(100, 'Maximum 100 candidatures à la fois'),
  status: z.enum(['SUBMITTED', 'IN_REVIEW', 'ACCEPTED', 'REJECTED'], {
    message: 'Statut invalide'
  })
});

// ═══════════════════════════════════════════════════════════════
// OPPORTUNITY SCHEMAS
// ═══════════════════════════════════════════════════════════════

// Opportunity location schema
const opportunityLocationSchema = z.object({
  city: z.string().max(100).optional(),
  region: z.string().max(100).optional(),
  country: z.string().length(2, 'Le code pays doit être au format ISO 3166-1 alpha-2').optional(),
  is_primary: z.boolean().optional()
});

// Custom question schema
const customQuestionSchema = z.object({
  id: z.string(),
  question: z.string().max(500, 'La question ne doit pas dépasser 500 caractères'),
  required: z.boolean(),
  max_length: z.number().int().min(50).max(5000).optional()
});

// Base opportunity schema (without refinements for .partial() compatibility in Zod v4)
const baseOpportunitySchema = z.object({
  title: z.string()
    .min(3, 'Le titre doit contenir au moins 3 caractères')
    .max(200, 'Le titre ne doit pas dépasser 200 caractères'),
  type: z.enum(['EMPLOYMENT', 'INTERNSHIP', 'ENTREPRENEURSHIP', 'ALTERNATION', 'FREELANCE', 'VOLUNTEER']).optional(),
  contract_type: z.enum(['CDI', 'CDD', 'APPRENTICESHIP', 'INTERNSHIP', 'FREELANCE', 'SERVICE', 'INTERIM']).optional(),
  work_rhythm: z.enum(['FULL_TIME', 'PART_TIME', 'FLEXIBLE', 'OCCASIONAL']).optional(),
  summary: z.string().max(5000, 'Le résumé ne doit pas dépasser 5000 caractères').optional(),
  requirements: z.string().max(10000, 'Les exigences ne doivent pas dépasser 10000 caractères').optional(),
  nice_to_have: z.string().max(5000, 'Les atouts ne doivent pas dépasser 5000 caractères').optional(),
  compensation_min: z.number().min(0).optional(),
  compensation_max: z.number().min(0).optional(),
  currency: z.string().length(3, 'La devise doit être au format ISO 4217').optional(),
  compensation_frequency: z.enum(['HOURLY', 'MONTHLY', 'YEARLY', 'PROJECT']).optional(),
  location_type: z.enum(['ON_SITE', 'REMOTE', 'HYBRID']).optional(),
  locations: z.array(opportunityLocationSchema).max(10).optional(),
  deadline: z.string().optional(),
  start_date: z.string().optional(),
  duration: z.string().max(100).optional(),
  status: z.enum(['DRAFT', 'OPEN', 'PAUSED', 'FILLED', 'EXPIRED']).optional(),
  cv_required: z.boolean().optional(),
  application_questions: z.array(customQuestionSchema).max(10, 'Maximum 10 questions personnalisées').optional(),
  organization_id: z.string().uuid('ID d\'organisation invalide').optional(),
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
    { message: 'La date limite est obligatoire', path: ['deadline'] }
  )
  .refine(
    compensationRefinement,
    { message: 'Le salaire minimum ne peut pas être supérieur au salaire maximum', path: ['compensation_min'] }
  );

// Update opportunity schema (all fields optional, with refinements)
export const updateOpportunitySchema = baseOpportunitySchema.partial().refine(
  compensationRefinement,
  { message: 'Le salaire minimum ne peut pas être supérieur au salaire maximum', path: ['compensation_min'] }
);

// ═══════════════════════════════════════════════════════════════
// UUID PARAM SCHEMA
// ═══════════════════════════════════════════════════════════════

export const uuidParamSchema = z.object({
  id: z.string().uuid('ID invalide')
});

export const opportunityIdParamSchema = z.object({
  opportunityId: z.string().uuid('ID d\'opportunité invalide')
});

// ═══════════════════════════════════════════════════════════════
// AUTH SCHEMAS
// ═══════════════════════════════════════════════════════════════

export const requestOtpSchema = z.object({
  email: z.string()
    .email('Email invalide')
    .max(255, 'Email trop long')
    .transform((v) => v.toLowerCase().trim())
});

export const verifyOtpSchema = z.object({
  email: z.string()
    .email('Email invalide')
    .transform((v) => v.toLowerCase().trim()),
  code: z.string()
    .length(6, 'Le code doit contenir 6 chiffres')
    .regex(/^\d{6}$/, 'Le code doit être composé de 6 chiffres')
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Token de rafraîchissement requis')
});

// ═══════════════════════════════════════════════════════════════
// ONBOARDING SCHEMAS
// ═══════════════════════════════════════════════════════════════

const VALID_PROFILE_TAGS = [
  'STUDENT', 'YOUNG_GRADUATE', 'EXPERIENCED',
  'ENTREPRENEUR', 'FREELANCE', 'IN_TRANSITION'
] as const;

const VALID_GOALS = [
  'FIND_JOB', 'FIND_INTERNSHIP', 'FIND_FREELANCE',
  'BUILD_NETWORK', 'DEVELOP_SKILLS',
  'CREATE_BUSINESS', 'FIND_PARTNERS', 'FIND_FUNDING'
] as const;

const VALID_SECTORS = [
  'TECH', 'FINANCE', 'HEALTH', 'EDUCATION', 'MEDIA',
  'RETAIL', 'SERVICES', 'INDUSTRY', 'AGRICULTURE',
  'TRANSPORT', 'ENERGY', 'HOSPITALITY', 'OTHER'
] as const;

export const onboardingSchema = z.object({
  firstName: z.string()
    .min(1, 'Prénom requis')
    .max(100, 'Prénom trop long')
    .transform((v) => v.trim()),
  lastName: z.string()
    .min(1, 'Nom requis')
    .max(100, 'Nom trop long')
    .transform((v) => v.trim()),
  bio: z.string()
    .max(2000, 'Bio trop longue')
    .optional(),
  phone: z.string()
    .max(20, 'Numéro de téléphone trop long')
    .optional(),
  city: z.string()
    .max(100, 'Ville trop longue')
    .optional(),
  region: z.string()
    .max(100, 'Région trop longue')
    .optional(),
  country: z.string()
    .length(2, 'Le code pays doit être au format ISO 3166-1 alpha-2')
    .optional(),
  profileTags: z.array(z.enum(VALID_PROFILE_TAGS))
    .max(3, 'Maximum 3 tags de profil')
    .optional(),
  goals: z.array(z.enum(VALID_GOALS))
    .max(3, 'Maximum 3 objectifs')
    .optional(),
  sectors: z.array(z.enum(VALID_SECTORS))
    .max(5, 'Maximum 5 secteurs')
    .optional(),
  remoteReady: z.boolean().optional(),
  willingToRelocate: z.boolean().optional()
});

// ═══════════════════════════════════════════════════════════════
// COMMUNITY SCHEMAS
// ═══════════════════════════════════════════════════════════════

const COMMUNITY_TYPES = [
  'GENERAL', 'PROFESSIONAL', 'ALUMNI',
  'INTEREST', 'LOCAL', 'LEARNING'
] as const;

const COMMUNITY_ACCESS_TYPES = [
  'OPEN', 'APPROVAL', 'INVITE_ONLY', 'PAID'
] as const;

export const createCommunitySchema = z.object({
  name: z.string()
    .min(3, 'Le nom doit contenir au moins 3 caractères')
    .max(100, 'Le nom ne doit pas dépasser 100 caractères'),
  description: z.string()
    .max(5000, 'La description ne doit pas dépasser 5000 caractères')
    .optional(),
  type: z.enum(COMMUNITY_TYPES).optional(),
  access_type: z.enum(COMMUNITY_ACCESS_TYPES).optional(),
  organization_id: z.string().uuid('ID d\'organisation invalide').optional(),
  is_paid: z.boolean().optional(),
  monthly_price: z.number().min(0).optional(),
  currency: z.string().length(3, 'La devise doit être au format ISO 4217').optional(),
  trial_days: z.number().int().min(0).max(90).optional(),
  sectors: z.array(z.string()).max(10).optional(),
  rules: z.string().max(10000).optional(),
  tags: z.array(z.string()).max(10).optional()
});

export const updateCommunitySchema = createCommunitySchema.partial();

export const joinCommunitySchema = z.object({
  join_reason: z.string().max(1000, 'La raison ne doit pas dépasser 1000 caractères').optional()
});

// ═══════════════════════════════════════════════════════════════
// ORGANIZATION SCHEMAS
// ═══════════════════════════════════════════════════════════════

const ORGANIZATION_TYPES = [
  'COMPANY', 'STARTUP', 'NGO', 'SCHOOL',
  'GOVERNMENT', 'FREELANCE', 'OTHER'
] as const;

export const createOrganizationSchema = z.object({
  name: z.string()
    .min(2, 'Le nom doit contenir au moins 2 caractères')
    .max(200, 'Le nom ne doit pas dépasser 200 caractères'),
  description: z.string()
    .max(5000, 'La description ne doit pas dépasser 5000 caractères')
    .optional(),
  type: z.enum(ORGANIZATION_TYPES).optional(),
  website: z.string().url('URL invalide').optional().or(z.literal('')),
  city: z.string().max(100).optional(),
  region: z.string().max(100).optional(),
  country: z.string().length(2, 'Le code pays doit être au format ISO 3166-1 alpha-2').optional(),
  sectors: z.array(z.enum(VALID_SECTORS)).max(5).optional(),
  employee_count: z.number().int().min(1).optional(),
  founded_year: z.number().int().min(1800).max(new Date().getFullYear()).optional()
});

export const updateOrganizationSchema = createOrganizationSchema.partial();

// ═══════════════════════════════════════════════════════════════
// KYC SCHEMAS
// ═══════════════════════════════════════════════════════════════

const DOCUMENT_TYPES = [
  'NATIONAL_ID', 'PASSPORT', 'DRIVER_LICENSE', 'RESIDENCE_PERMIT'
] as const;

export const kycSubmitSchema = z.object({
  document_type: z.enum(DOCUMENT_TYPES, {
    message: 'Type de document invalide'
  }),
  front_image_url: z.string().min(1, 'Image recto requise'),
  back_image_url: z.string().optional()
});

// ═══════════════════════════════════════════════════════════════
// TALENT SCHEMAS
// ═══════════════════════════════════════════════════════════════

export const updateTalentSchema = z.object({
  first_name: z.string().min(1).max(100).optional(),
  last_name: z.string().min(1).max(100).optional(),
  bio: z.string().max(2000).optional(),
  phone: z.string().max(20).optional(),
  city: z.string().max(100).optional(),
  region: z.string().max(100).optional(),
  country: z.string().length(2).optional(),
  profile_tags: z.array(z.enum(VALID_PROFILE_TAGS)).max(3).optional(),
  goals: z.array(z.enum(VALID_GOALS)).max(3).optional(),
  sectors: z.array(z.enum(VALID_SECTORS)).max(5).optional(),
  remote_ready: z.boolean().optional(),
  willing_to_relocate: z.boolean().optional()
});

// ═══════════════════════════════════════════════════════════════
// PAGINATION SCHEMAS
// ═══════════════════════════════════════════════════════════════

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0)
});

// ═══════════════════════════════════════════════════════════════
// BOOKING / SPACE SCHEMAS
// ═══════════════════════════════════════════════════════════════

export const createBookingSchema = z.object({
  space_id: z.string().uuid('ID d\'espace invalide'),
  date: z.string().refine((v) => !isNaN(Date.parse(v)), 'Date invalide'),
  start_time: z.string().regex(/^\d{2}:\d{2}$/, 'Format heure invalide (HH:MM)'),
  end_time: z.string().regex(/^\d{2}:\d{2}$/, 'Format heure invalide (HH:MM)'),
  purpose: z.string().max(500).optional(),
  attendees_count: z.number().int().min(1).optional()
});

// ═══════════════════════════════════════════════════════════════
// INVITATION SCHEMAS
// ═══════════════════════════════════════════════════════════════

export const communityInvitationSchema = z.object({
  email: z.string().email('Email invalide').optional(),
  invitee_talent_id: z.string().uuid().optional(),
  role: z.enum(['MEMBER', 'MODERATOR', 'ADMIN']).optional(),
  message: z.string().max(500).optional()
}).refine(
  (data) => data.email || data.invitee_talent_id,
  { message: 'Email ou ID du talent requis' }
);

export const organizationInvitationSchema = z.object({
  email: z.string().email('Email invalide'),
  role: z.enum(['MEMBER', 'ADMIN', 'OWNER']),
  message: z.string().max(500).optional()
});
