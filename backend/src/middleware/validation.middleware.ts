import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError } from 'zod';

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
      console.error('Validation error:', error);
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

// Schedule interview schema
export const scheduleInterviewSchema = z.object({
  interview_scheduled_at: z.string().refine(
    (val) => !isNaN(Date.parse(val)),
    'Date d\'entretien invalide'
  ),
  interview_type: z.enum(['PHONE', 'VIDEO', 'IN_PERSON'], {
    message: 'Type d\'entretien invalide'
  }).optional(),
  interview_location: z.string().max(500, 'L\'adresse ne doit pas dépasser 500 caractères').optional(),
  interview_notes: z.string().max(2000, 'Les notes ne doivent pas dépasser 2000 caractères').optional()
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
  organization_id: z.string().uuid('ID d\'organisation invalide').optional()
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
