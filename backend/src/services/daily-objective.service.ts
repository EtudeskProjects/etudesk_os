/**
 * Daily Objective Service
 * Generates personalized daily objectives for talents and organizations using GPT-4.1-nano
 * Cached for 24h per user/organization for cost efficiency
 */

import { MODEL_SUGGESTION } from './ai/models';
import { getGeminiClient } from './ai/provider';
import { pool } from './database';
import { logger } from '../utils';
import { getLocaleForLanguage, SupportedLanguage } from '../i18n';
import { getLanguageDisplayName } from './language-preference.service';

const openai = getGeminiClient();

const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_OBJECTIVE_LENGTH = 500;

/** Strip markdown formatting (bold, italic, links, headers) — objective is plain text */
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')   // **bold** → bold
    .replace(/\*(.*?)\*/g, '$1')        // *italic* → italic
    .replace(/__(.*?)__/g, '$1')        // __bold__ → bold
    .replace(/_(.*?)_/g, '$1')          // _italic_ → italic
    .replace(/#{1,6}\s?/g, '')          // ### header → header
    .replace(/\[(.*?)\]\(.*?\)/g, '$1') // [text](url) → text
    .replace(/`(.*?)`/g, '$1')          // `code` → code
    .trim();
}

interface DailyObjective {
  objective: string;
  generatedAt: string;
  expiresAt: string;
}

interface TalentContext {
  profile: any;
  recentApplications: any[];
  memberships: any[];
  reservations: any[];
  todayEvents: any[];
  tomorrowEvents: any[];
  recentPublications: any[];
  skills: any[];
}

interface OrganizationContext {
  profile: any;
  recentOpportunities: any[];
  recentCommunities: any[];
  recentSpaces: any[];
  recentApplications: any[];
  memberships: any[];
  reservations: any[];
  todayEvents: any[];
  tomorrowEvents: any[];
  recentPublications: any[];
}

// --- Talent Daily Objective ---

async function getTalentContext(talentId: string): Promise<TalentContext> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfterTomorrow = new Date(tomorrow);
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

  // Fetch all data in parallel
  const [
    profileResult,
    applicationsResult,
    membershipsResult,
    reservationsResult,
    todayEventsResult,
    tomorrowEventsResult,
    publicationsResult,
    skillsResult,
  ] = await Promise.all([
    // Profile
    pool.query(`SELECT * FROM talents WHERE id = $1`, [talentId]),

    // Recent applications (last 7 days)
    pool.query(`
      SELECT oa.*, o.title as opportunity_title, o.type as opportunity_type
      FROM opportunity_applications oa
      JOIN opportunities o ON oa.opportunity_id = o.id
      WHERE oa.talent_id = $1 AND oa.applied_at > NOW() - INTERVAL '7 days'
      ORDER BY oa.applied_at DESC LIMIT 10
    `, [talentId]),

    // Active memberships
    pool.query(`
      SELECT cm.*, c.name as community_name
      FROM community_members cm
      JOIN communities c ON cm.community_id = c.id
      WHERE cm.talent_id = $1 AND cm.status = 'ACTIVE'
      ORDER BY cm.joined_at DESC LIMIT 10
    `, [talentId]),

    // Upcoming reservations
    pool.query(`
      SELECT sb.*, s.name as space_name
      FROM space_bookings sb
      JOIN spaces s ON sb.space_id = s.id
      WHERE sb.talent_id = $1 AND sb.status IN ('CONFIRMED', 'PENDING') AND sb.start_datetime > NOW()
      ORDER BY sb.start_datetime ASC LIMIT 5
    `, [talentId]),

    // Today's events
    pool.query(`
      SELECT ca.*, c.name as community_name
      FROM community_activities ca
      JOIN communities c ON ca.community_id = c.id
      JOIN community_members cm ON c.id = cm.community_id
      WHERE cm.talent_id = $1 AND ca.type = 'EVENT'
        AND ca.scheduled_at >= $2 AND ca.scheduled_at < $3
      ORDER BY ca.scheduled_at ASC
    `, [talentId, today.toISOString(), tomorrow.toISOString()]),

    // Tomorrow's events
    pool.query(`
      SELECT ca.*, c.name as community_name
      FROM community_activities ca
      JOIN communities c ON ca.community_id = c.id
      JOIN community_members cm ON c.id = cm.community_id
      WHERE cm.talent_id = $1 AND ca.type = 'EVENT'
        AND ca.scheduled_at >= $2 AND ca.scheduled_at < $3
      ORDER BY ca.scheduled_at ASC
    `, [talentId, tomorrow.toISOString(), dayAfterTomorrow.toISOString()]),

    // Recent publications in communities
    pool.query(`
      SELECT ca.*, c.name as community_name
      FROM community_activities ca
      JOIN communities c ON ca.community_id = c.id
      JOIN community_members cm ON c.id = cm.community_id
      WHERE cm.talent_id = $1 AND ca.type = 'POST'
        AND ca.created_at > NOW() - INTERVAL '3 days'
      ORDER BY ca.created_at DESC LIMIT 10
    `, [talentId]),

    // Skills ordered by update
    pool.query(`
      SELECT * FROM talent_skills
      WHERE talent_id = $1
      ORDER BY updated_at DESC NULLS LAST, created_at DESC
      LIMIT 20
    `, [talentId]),
  ]);

  return {
    profile: profileResult.rows[0] || null,
    recentApplications: applicationsResult.rows,
    memberships: membershipsResult.rows,
    reservations: reservationsResult.rows,
    todayEvents: todayEventsResult.rows,
    tomorrowEvents: tomorrowEventsResult.rows,
    recentPublications: publicationsResult.rows,
    skills: skillsResult.rows,
  };
}

async function generateTalentObjective(
  context: TalentContext,
  previousObjective: string | null,
  language: SupportedLanguage = 'en'
): Promise<string> {
  const today = new Date();
  const locale = getLocaleForLanguage(language);
  const languageName = getLanguageDisplayName(language);
  const dayOfWeek = today.toLocaleDateString(locale, { weekday: 'long' });
  const dateStr = today.toLocaleDateString(locale, { day: 'numeric', month: 'long' });

  const previousContext = previousObjective
    ? `\nOBJECTIF PRÉCÉDENT (pour continuité, propose quelque chose de différent):\n"${previousObjective.slice(0, 200)}..."\n`
    : '';

  // Map goal codes to descriptions
  const goalDescriptions: Record<string, string> = {
    'FIND_JOB': 'trouver un emploi',
    'FIND_INTERNSHIP': 'trouver un stage',
    'FIND_FREELANCE': 'trouver des missions freelance',
    'LEARN_NEW_SKILLS': 'développer de nouvelles compétences',
    'BUILD_NETWORK_OR_VISIBILITY': 'développer son réseau et sa visibilité',
    'EXPLORE_OPPORTUNITIES': 'explorer les opportunités',
    'RESEARCH_SUPPORT': 'être accompagné dans ses recherches',
  };

  const userGoals = context.profile?.goals?.map((g: string) => goalDescriptions[g] || g).join(', ') || 'Non défini';

  // Generate concrete skill suggestions based on sectors
  const sectorSkillSuggestions: Record<string, string[]> = {
    'DIGITAL': ['marketing digital', 'SEO/SEA', 'développement web', 'data analysis', 'UX design', 'gestion de projet agile'],
    'EDUCATION': ['pédagogie innovante', 'e-learning', 'gestion de classe', 'création de contenus éducatifs'],
    'TOURISM': ['revenue management', 'expérience client', 'marketing touristique', 'gestion hôtelière'],
    'TRANSPORT': ['logistique', 'supply chain', 'gestion de flotte', 'réglementation transport'],
    'HEALTH': ['gestion hospitalière', 'e-santé', 'qualité des soins', 'communication patient'],
    'FINANCE': ['analyse financière', 'gestion de trésorerie', 'conformité bancaire', 'fintech'],
    'AGRICULTURE': ['agriculture durable', 'gestion d\'exploitation', 'agritech', 'certification bio'],
  };

  const userSectors = context.profile?.sectors || [];
  const suggestedSkills = userSectors
    .flatMap((s: string) => sectorSkillSuggestions[s] || [])
    .slice(0, 3)
    .join(', ') || 'gestion de projet, communication professionnelle';

  const prompt = `You MUST output ONLY in ${languageName}.
Tu es un coach carrière proactif sur Etudesk. Génère un objectif du jour CONCRET et ACTIONNABLE.

PROFIL DU TALENT:
- Prénom: ${context.profile?.first_name || 'Talent'}
- Secteurs: ${context.profile?.sectors?.join(', ') || 'Non défini'}
- Objectifs: ${userGoals}
- Compétences actuelles: ${context.skills.slice(0, 5).map(s => s.name).join(', ') || 'Aucune définie'}
- Suggestions de formations pertinentes: ${suggestedSkills}
- Date: ${dayOfWeek} ${dateStr}

ACTIVITÉ SUR ETUDESK:
- Candidatures: ${context.recentApplications.length}
- Communautés: ${context.memberships.length}
- Événements aujourd'hui: ${context.todayEvents.length}
${previousContext}
ACTIONS CONCRÈTES (choisis UNE selon le contexte):

1. FORMATION: Propose UN sujet PRÉCIS parmi: ${suggestedSkills}
   Exemple: "Lance le mode Étudier pour te former sur ${suggestedSkills.split(',')[0]}"

2. OPPORTUNITÉS: Si objectif emploi/stage → "Explore les offres en ${userSectors[0] || 'ton secteur'} et postule à au moins une"

3. COMMUNAUTÉS: Si peu de communautés → "Rejoins une communauté ${userSectors[0] || ''} pour élargir ton réseau"

4. PROFIL: Si compétences vides → "Ajoute tes compétences clés à ton profil pour être visible des recruteurs"

RÈGLES STRICTES:
1. Maximum 500 caractères
2. PAS de salutation (pas de "Bonjour"), commence directement par l'action
3. SOIS PRÉCIS: donne un sujet de formation CONCRET, pas "un sujet qui t'intéresse"
4. Mentionne "mode Étudier" pour les formations
5. Tutoiement
6. Objectif DIFFÉRENT du précédent
7. PAS de markdown (pas de ** ni de # ni de _) — texte brut uniquement

Génère l'objectif (500 caractères max):`;

  try {
    const response = await openai.chat.completions.create({
      model: MODEL_SUGGESTION,
      messages: [{ role: 'user', content: prompt }],
      max_completion_tokens: 200,
    });

    let objective = response.choices[0]?.message?.content?.trim() || '';
    objective = stripMarkdown(objective);

    // Ensure max length
    if (objective.length > MAX_OBJECTIVE_LENGTH) {
      objective = objective.substring(0, MAX_OBJECTIVE_LENGTH - 3) + '...';
    }

    return objective;
  } catch (error) {
    logger.error('[DailyObjective] Error generating talent objective:', error);
    return language === 'fr'
      ? `Explore les opportunités disponibles sur Etudesk et postule à celle qui correspond le mieux à ton profil.`
      : `Explore available opportunities on Etudesk and apply to the one that best matches your profile.`;
  }
}

export async function getTalentDailyObjective(
  talentId: string,
  language: SupportedLanguage = 'en'
): Promise<DailyObjective> {
  // Check cache
  const cacheResult = await pool.query(`
    SELECT objective, generated_at, expires_at
    FROM daily_objectives
    WHERE talent_id = $1 AND expires_at > NOW()
    ORDER BY generated_at DESC LIMIT 1
  `, [talentId]);

  if (cacheResult.rows.length > 0) {
    const cached = cacheResult.rows[0];
    return {
      objective: cached.objective,
      generatedAt: cached.generated_at,
      expiresAt: cached.expires_at,
    };
  }

  // Get previous objective for context continuity
  const previousResult = await pool.query(`
    SELECT objective FROM daily_objectives
    WHERE talent_id = $1
    ORDER BY generated_at DESC LIMIT 1
  `, [talentId]);
  const previousObjective = previousResult.rows[0]?.objective || null;

  // Generate new objective
  const context = await getTalentContext(talentId);
  const objective = await generateTalentObjective(context, previousObjective, language);

  const now = new Date();
  const expiresAt = new Date(now.getTime() + CACHE_DURATION_MS);

  // Save to cache (delete old then insert)
  await pool.query(`DELETE FROM daily_objectives WHERE talent_id = $1`, [talentId]);
  await pool.query(`
    INSERT INTO daily_objectives (talent_id, objective, generated_at, expires_at)
    VALUES ($1, $2, $3, $4)
  `, [talentId, objective, now.toISOString(), expiresAt.toISOString()]);

  return {
    objective,
    generatedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

// --- Organization Daily Objective ---

async function getOrganizationContext(organizationId: string): Promise<OrganizationContext> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfterTomorrow = new Date(tomorrow);
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

  const [
    profileResult,
    opportunitiesResult,
    communitiesResult,
    spacesResult,
    applicationsResult,
    membershipsResult,
    reservationsResult,
    todayEventsResult,
    tomorrowEventsResult,
    publicationsResult,
  ] = await Promise.all([
    // Profile
    pool.query(`SELECT * FROM organizations WHERE id = $1`, [organizationId]),

    // Recent opportunities
    pool.query(`
      SELECT o.* FROM opportunities o
      WHERE o.organization_id = $1 AND o.deleted_at IS NULL
      ORDER BY o.created_at DESC LIMIT 10
    `, [organizationId]),

    // Communities
    pool.query(`
      SELECT c.*, (SELECT COUNT(*) FROM community_members WHERE community_id = c.id AND status = 'ACTIVE') as member_count
      FROM communities c
      WHERE c.organization_id = $1 AND c.deleted_at IS NULL
      ORDER BY c.created_at DESC LIMIT 10
    `, [organizationId]),

    // Spaces
    pool.query(`
      SELECT s.* FROM spaces s
      WHERE s.organization_id = $1 AND s.deleted_at IS NULL
      ORDER BY s.created_at DESC LIMIT 10
    `, [organizationId]),

    // Recent applications on org's opportunities
    pool.query(`
      SELECT oa.*, o.title as opportunity_title, t.first_name as talent_name
      FROM opportunity_applications oa
      JOIN opportunities o ON oa.opportunity_id = o.id
      JOIN talents t ON oa.talent_id = t.id
      WHERE o.organization_id = $1 AND oa.applied_at > NOW() - INTERVAL '7 days'
      ORDER BY oa.applied_at DESC LIMIT 20
    `, [organizationId]),

    // Community memberships (pending)
    pool.query(`
      SELECT cm.*, c.name as community_name, t.first_name as talent_name
      FROM community_members cm
      JOIN communities c ON cm.community_id = c.id
      JOIN talents t ON cm.talent_id = t.id
      WHERE c.organization_id = $1 AND cm.status = 'PENDING'
      ORDER BY cm.joined_at DESC LIMIT 10
    `, [organizationId]),

    // Space reservations
    pool.query(`
      SELECT sb.*, s.name as space_name, t.first_name as talent_name
      FROM space_bookings sb
      JOIN spaces s ON sb.space_id = s.id
      JOIN talents t ON sb.talent_id = t.id
      WHERE s.organization_id = $1 AND sb.status IN ('CONFIRMED', 'PENDING') AND sb.start_datetime > NOW()
      ORDER BY sb.start_datetime ASC LIMIT 10
    `, [organizationId]),

    // Today's events
    pool.query(`
      SELECT ca.*, c.name as community_name
      FROM community_activities ca
      JOIN communities c ON ca.community_id = c.id
      WHERE c.organization_id = $1 AND ca.type = 'EVENT'
        AND ca.scheduled_at >= $2 AND ca.scheduled_at < $3
      ORDER BY ca.scheduled_at ASC
    `, [organizationId, today.toISOString(), tomorrow.toISOString()]),

    // Tomorrow's events
    pool.query(`
      SELECT ca.*, c.name as community_name
      FROM community_activities ca
      JOIN communities c ON ca.community_id = c.id
      WHERE c.organization_id = $1 AND ca.type = 'EVENT'
        AND ca.scheduled_at >= $2 AND ca.scheduled_at < $3
      ORDER BY ca.scheduled_at ASC
    `, [organizationId, tomorrow.toISOString(), dayAfterTomorrow.toISOString()]),

    // Recent publications
    pool.query(`
      SELECT ca.*, c.name as community_name
      FROM community_activities ca
      JOIN communities c ON ca.community_id = c.id
      WHERE c.organization_id = $1 AND ca.type = 'POST'
        AND ca.created_at > NOW() - INTERVAL '3 days'
      ORDER BY ca.created_at DESC LIMIT 10
    `, [organizationId]),
  ]);

  return {
    profile: profileResult.rows[0] || null,
    recentOpportunities: opportunitiesResult.rows,
    recentCommunities: communitiesResult.rows,
    recentSpaces: spacesResult.rows,
    recentApplications: applicationsResult.rows,
    memberships: membershipsResult.rows,
    reservations: reservationsResult.rows,
    todayEvents: todayEventsResult.rows,
    tomorrowEvents: tomorrowEventsResult.rows,
    recentPublications: publicationsResult.rows,
  };
}

async function generateOrganizationObjective(
  context: OrganizationContext,
  previousObjective: string | null,
  language: SupportedLanguage = 'en'
): Promise<string> {
  const today = new Date();
  const locale = getLocaleForLanguage(language);
  const languageName = getLanguageDisplayName(language);
  const dayOfWeek = today.toLocaleDateString(locale, { weekday: 'long' });
  const dateStr = today.toLocaleDateString(locale, { day: 'numeric', month: 'long' });

  const openOpportunities = context.recentOpportunities.filter(o => o.status === 'OPEN').length;
  const pendingApplications = context.recentApplications.filter(a => a.status === 'SUBMITTED').length;
  const pendingMemberships = context.memberships.length;
  const totalMembers = context.recentCommunities.reduce((sum, c) => sum + (parseInt(c.member_count) || 0), 0);

  const previousContext = previousObjective
    ? `\nOBJECTIF PRÉCÉDENT (pour continuité, propose quelque chose de différent):\n"${previousObjective.slice(0, 200)}..."\n`
    : '';

  // Determine priority action based on data
  let priorityAction = '';
  if (pendingApplications > 0) {
    priorityAction = `URGENT: ${pendingApplications} candidature(s) en attente à traiter`;
  } else if (openOpportunities === 0) {
    priorityAction = 'Aucune opportunité active - créer une offre est prioritaire';
  } else if (context.recentCommunities.length === 0) {
    priorityAction = 'Aucune communauté - en créer une pour fédérer les talents';
  } else if (context.recentPublications.length === 0) {
    priorityAction = 'Communauté inactive - publier du contenu engageant';
  }

  // Map sector codes to readable names
  const sectorNames: Record<string, string> = {
    'AGRICULTURE': 'Agriculture',
    'DIGITAL': 'Digital & Tech',
    'EDUCATION': 'Éducation',
    'FINANCE': 'Finance',
    'HEALTH': 'Santé',
    'TOURISM': 'Tourisme',
    'TRANSPORT': 'Transport & Logistique',
    'PROFESSIONAL_SERVICES': 'Services professionnels',
    'RETAIL': 'Commerce',
    'MANUFACTURING': 'Industrie',
    'ENERGY': 'Énergie',
    'CONSTRUCTION': 'BTP',
    'REAL_ESTATE': 'Immobilier',
    'MEDIA': 'Médias & Communication',
    'NGO': 'ONG & Associations',
  };

  const orgSectors = context.profile?.sectors
    ?.slice(0, 2)
    .map((s: string) => sectorNames[s] || s)
    .join(' et ') || 'votre secteur';

  const prompt = `You MUST output ONLY in ${languageName}.
Tu es un conseiller stratégique Etudesk. Génère un objectif CONCRET et ACTIONNABLE pour cette organisation.

ORGANISATION: ${context.profile?.name || 'Organisation'}
SECTEURS: ${orgSectors}
DATE: ${dayOfWeek} ${dateStr}

DONNÉES ACTUELLES SUR ETUDESK:
- Opportunités publiées: ${openOpportunities}
- Candidatures à traiter: ${pendingApplications}
- Communautés créées: ${context.recentCommunities.length}
- Membres total: ${totalMembers}
- Publications récentes: ${context.recentPublications.length}
- Événements prévus: ${context.todayEvents.length + context.tomorrowEvents.length}

PRIORITÉ DÉTECTÉE: ${priorityAction || 'Développer la présence sur Etudesk'}
${previousContext}
ACTIONS CONCRÈTES (UNE seule, la plus pertinente):

SI candidatures en attente → "Traitez les ${pendingApplications} candidature(s) en attente pour ne pas perdre les meilleurs profils"

SI aucune opportunité → "Créez une offre d'emploi/stage en ${orgSectors} avec un titre accrocheur et une description détaillant les missions et avantages"

SI aucune communauté → "Créez votre communauté '${context.profile?.name || 'Nom'} Talents' pour fédérer candidats et collaborateurs autour de votre marque employeur"

SI communauté sans publication → "Publiez dans votre communauté: partagez une actualité, un conseil métier ou annoncez un événement à venir"

SI communauté active → "Organisez un événement (webinaire, session Q&A, atelier) pour engager vos ${totalMembers} membres"

RÈGLES STRICTES:
1. Maximum 500 caractères
2. PAS de salutation - commence par un verbe d'action
3. Action 100% sur ETUDESK (pas de réseaux sociaux externes)
4. Sois SPÉCIFIQUE: mentionne les chiffres, le secteur, le nom de l'org
5. Vouvoiement professionnel
6. Objectif DIFFÉRENT du précédent
7. PAS de markdown (pas de ** ni de # ni de _) — texte brut uniquement

Génère l'objectif (500 caractères max):`;

  try {
    const response = await openai.chat.completions.create({
      model: MODEL_SUGGESTION,
      messages: [{ role: 'user', content: prompt }],
      max_completion_tokens: 200,
    });

    let objective = response.choices[0]?.message?.content?.trim() || '';
    objective = stripMarkdown(objective);

    if (objective.length > MAX_OBJECTIVE_LENGTH) {
      objective = objective.substring(0, MAX_OBJECTIVE_LENGTH - 3) + '...';
    }

    return objective;
  } catch (error) {
    logger.error('[DailyObjective] Error generating org objective:', error);
    return language === 'fr'
      ? `Consultez vos candidatures en attente et engagez votre communauté pour renforcer votre marque employeur.`
      : `Review pending applications and engage your community to strengthen your employer brand.`;
  }
}

export async function getOrganizationDailyObjective(
  organizationId: string,
  language: SupportedLanguage = 'en'
): Promise<DailyObjective> {
  // Check cache
  const cacheResult = await pool.query(`
    SELECT objective, generated_at, expires_at
    FROM daily_objectives
    WHERE organization_id = $1 AND expires_at > NOW()
    ORDER BY generated_at DESC LIMIT 1
  `, [organizationId]);

  if (cacheResult.rows.length > 0) {
    const cached = cacheResult.rows[0];
    return {
      objective: cached.objective,
      generatedAt: cached.generated_at,
      expiresAt: cached.expires_at,
    };
  }

  // Get previous objective for context continuity
  const previousResult = await pool.query(`
    SELECT objective FROM daily_objectives
    WHERE organization_id = $1
    ORDER BY generated_at DESC LIMIT 1
  `, [organizationId]);
  const previousObjective = previousResult.rows[0]?.objective || null;

  // Generate new objective
  const context = await getOrganizationContext(organizationId);
  const objective = await generateOrganizationObjective(context, previousObjective, language);

  const now = new Date();
  const expiresAt = new Date(now.getTime() + CACHE_DURATION_MS);

  // Save to cache (delete old then insert)
  await pool.query(`DELETE FROM daily_objectives WHERE organization_id = $1`, [organizationId]);
  await pool.query(`
    INSERT INTO daily_objectives (organization_id, objective, generated_at, expires_at)
    VALUES ($1, $2, $3, $4)
  `, [organizationId, objective, now.toISOString(), expiresAt.toISOString()]);

  return {
    objective,
    generatedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

export const dailyObjectiveService = {
  getTalentDailyObjective,
  getOrganizationDailyObjective,
};
