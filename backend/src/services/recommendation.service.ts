/**
 * Recommendation Service - AI-powered candidate recommendations using GPT-5 nano
 *
 * Generates concise 30-word recommendations for each application
 * Uses GPT-5 nano for cost-effective inference
 */

import OpenAI from 'openai';
import { pool } from './database';

// ═══════════════════════════════════════════════════════════════
// CLIENT INITIALIZATION
// ═══════════════════════════════════════════════════════════════

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Use GPT-4.1 nano for fast, cheap inference
const MODEL_NAME = 'gpt-4.1-nano';

// In-memory cache for recommendations
const recommendationCache = new Map<string, { text: string; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface ApplicationForRecommendation {
  id: string;
  talent: {
    display_name?: string;
    first_name?: string;
    last_name?: string;
    current_role?: string;
    years_experience?: number;
    skills?: string[];
    sectors?: string[];
    city?: string;
    country?: string;
    bio?: string;
  };
  opportunity: {
    title?: string;
    location_type?: string;
    contract_type?: string;
    work_rhythm?: string;
    requirements?: string;
  };
  matchCategory?: 'excellent' | 'good' | 'average' | 'low';
}

// ═══════════════════════════════════════════════════════════════
// RECOMMENDATION GENERATION
// ═══════════════════════════════════════════════════════════════

/**
 * Generate a 30-word recommendation for an application
 */
export async function generateRecommendation(
  application: ApplicationForRecommendation
): Promise<string> {
  // Check cache first
  const cacheKey = `reco:${application.id}`;
  const cached = recommendationCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.text;
  }

  // Also check database cache
  try {
    const dbCache = await pool.query(
      `SELECT ai_recommendation, ai_recommendation_at
       FROM opportunity_applications
       WHERE id = $1 AND ai_recommendation IS NOT NULL
       AND ai_recommendation_at > NOW() - INTERVAL '24 hours'`,
      [application.id]
    );

    if (dbCache.rows.length > 0 && dbCache.rows[0].ai_recommendation) {
      const text = dbCache.rows[0].ai_recommendation;
      recommendationCache.set(cacheKey, { text, timestamp: Date.now() });
      return text;
    }
  } catch (error) {
    // DB cache check failed, continue with generation
  }

  const { talent, opportunity, matchCategory } = application;

  // Build the prompt
  const prompt = buildRecommendationPrompt(talent, opportunity, matchCategory);

  try {
    const response = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: [
        {
          role: 'system',
          content: 'Tu es un recruteur expert. Génère des recommandations concises en français.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_completion_tokens: 80,
    });

    let text = response.choices[0]?.message?.content?.trim() || '';

    // Ensure it's not too long (max ~40 words for safety)
    const words = text.split(/\s+/);
    if (words.length > 40) {
      text = words.slice(0, 38).join(' ') + '...';
    }

    // Cache in memory
    recommendationCache.set(cacheKey, { text, timestamp: Date.now() });

    // Cache in database
    try {
      await pool.query(
        `UPDATE opportunity_applications
         SET ai_recommendation = $1, ai_recommendation_at = NOW()
         WHERE id = $2`,
        [text, application.id]
      );
    } catch (error) {
      // DB update failed, but we have the recommendation
      console.error('Failed to cache recommendation in DB:', error);
    }

    return text;
  } catch (error) {
    console.error('Error generating recommendation:', error);
    // Return a fallback recommendation based on match category
    return generateFallbackRecommendation(talent, matchCategory);
  }
}

/**
 * Build the prompt for recommendation generation
 */
function buildRecommendationPrompt(
  talent: ApplicationForRecommendation['talent'],
  opportunity: ApplicationForRecommendation['opportunity'],
  matchCategory?: string
): string {
  const candidateName = talent.first_name || talent.display_name?.split(' ')[0] || 'Ce candidat';

  return `Tu es un recruteur expert. Génère une recommandation CONCISE en 30 mots MAXIMUM.

CANDIDAT:
- Nom: ${candidateName}
- Poste actuel: ${talent.current_role || 'Non spécifié'}
- Expérience: ${talent.years_experience || 0} ans
- Compétences: ${talent.skills?.slice(0, 6).join(', ') || 'Non spécifiées'}
- Localisation: ${[talent.city, talent.country].filter(Boolean).join(', ') || 'Non spécifiée'}

POSTE:
- Titre: ${opportunity.title || 'Non spécifié'}
- Contrat: ${opportunity.contract_type || 'Non spécifié'}
- Rythme: ${opportunity.work_rhythm || 'Non spécifié'}
- Mode: ${opportunity.location_type || 'Non spécifié'}

CATÉGORIE DE MATCH: ${matchCategory || 'average'}

Règles:
1. Commence par le prénom du candidat
2. Maximum 30 mots
3. Mentionne 1-2 points forts spécifiques
4. Termine par une recommandation claire (entretien recommandé / à considérer / profil à approfondir)
5. Sois direct et professionnel
6. Écris en français

Recommandation:`;
}

/**
 * Generate a fallback recommendation when AI fails
 */
function generateFallbackRecommendation(
  talent: ApplicationForRecommendation['talent'],
  matchCategory?: string
): string {
  const name = talent.first_name || talent.display_name?.split(' ')[0] || 'Ce candidat';
  const role = talent.current_role || 'professionnel';
  const years = talent.years_experience || 0;

  switch (matchCategory) {
    case 'excellent':
      return `${name}, ${role} avec ${years} ans d'expérience, présente un profil très aligné avec les exigences du poste. Entretien fortement recommandé.`;

    case 'good':
      return `${name} possède une solide expérience de ${years} ans. Son profil correspond bien aux attentes. Un entretien permettrait d'évaluer sa motivation.`;

    case 'average':
      return `${name} présente un profil intéressant avec ${years} ans d'expérience. Quelques lacunes à vérifier. Entretien à considérer selon disponibilité.`;

    case 'low':
    default:
      return `${name} ne correspond pas pleinement au profil recherché. ${years > 0 ? `${years} ans d'expérience mais` : 'Expérience limitée,'} compétences à approfondir.`;
  }
}

/**
 * Get recommendation for an application (with lazy loading)
 */
export async function getApplicationRecommendation(applicationId: string): Promise<string | null> {
  try {
    // Fetch application with talent and opportunity data
    const result = await pool.query(`
      SELECT
        a.id,
        a.ai_recommendation,
        json_build_object(
          'display_name', t.display_name,
          'first_name', t.first_name,
          'last_name', t.last_name,
          'current_role', (SELECT te.job_title FROM talent_experiences te WHERE te.talent_id = t.id ORDER BY te.ended_at DESC NULLS FIRST, te.started_at DESC LIMIT 1),
          'years_experience', EXTRACT(YEAR FROM AGE(NOW(), (SELECT MIN(te.started_at) FROM talent_experiences te WHERE te.talent_id = t.id)))::INTEGER,
          'skills', (SELECT ARRAY_AGG(s.canonical_name) FROM talent_skills ts JOIN skills s ON ts.skill_id = s.id WHERE ts.talent_id = t.id),
          'sectors', t.sectors,
          'city', t.city,
          'country', t.country,
          'bio', t.bio
        ) as talent,
        json_build_object(
          'title', o.title,
          'location_type', o.location_type,
          'contract_type', o.contract_type,
          'work_rhythm', o.work_rhythm,
          'requirements', o.requirements
        ) as opportunity
      FROM opportunity_applications a
      JOIN talents t ON a.talent_id = t.id
      JOIN opportunities o ON a.opportunity_id = o.id
      WHERE a.id = $1
    `, [applicationId]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];

    // If we have a recent cached recommendation, return it
    if (row.ai_recommendation) {
      return row.ai_recommendation;
    }

    // Generate new recommendation
    const recommendation = await generateRecommendation({
      id: row.id,
      talent: row.talent,
      opportunity: row.opportunity,
    });

    return recommendation;
  } catch (error) {
    console.error('Error getting application recommendation:', error);
    return null;
  }
}

/**
 * Batch generate recommendations for multiple applications
 * Useful for pre-generating recommendations
 */
export async function batchGenerateRecommendations(
  applicationIds: string[],
  concurrency: number = 3
): Promise<Map<string, string>> {
  const results = new Map<string, string>();

  // Process in batches
  for (let i = 0; i < applicationIds.length; i += concurrency) {
    const batch = applicationIds.slice(i, i + concurrency);

    await Promise.all(
      batch.map(async (id) => {
        const recommendation = await getApplicationRecommendation(id);
        if (recommendation) {
          results.set(id, recommendation);
        }
      })
    );

    // Small delay between batches to avoid rate limiting
    if (i + concurrency < applicationIds.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  return results;
}

/**
 * Clear recommendation cache for an application
 * Call this when application data changes
 */
export function clearRecommendationCache(applicationId: string): void {
  recommendationCache.delete(`reco:${applicationId}`);
}

/**
 * Clear all recommendation caches
 */
export function clearAllRecommendationCaches(): void {
  recommendationCache.clear();
}
