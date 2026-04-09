/**
 * Etudesk WhatsApp Agent — Agent-Native Support
 *
 * Powered by Claude (Anthropic) with full company context.
 * Replaces the legacy Gemini-based bot.
 *
 * Features:
 * - Claude Haiku for fast, intelligent responses
 * - Full Etudesk product knowledge
 * - Conversation history (last 10 messages per user)
 * - Smart escalation to human team
 * - Multi-language (FR/EN auto-detect)
 */

import { getAnthropicClient } from './ai/provider';
import { MODEL_FAST } from './ai/models';
import { sendWhatsAppMessage } from './whatsapp.service';
import { logger } from '../utils';
import { pool } from './database';

// ─── ETUDESK COMPANY CONTEXT ────────────────────────────────────────────────

const ETUDESK_CONTEXT = `# ETUDESK — Contexte Complet

## A propos
Etudesk est le copilote IA de gestion de carriere pour les talents africains. Fondee en mai 2016 par Lamine BARRO, la plateforme aide les jeunes a construire leur carriere grace a l'intelligence artificielle.

## Chiffres cles
- 10 ans d'existence (mai 2026)
- 3M+ talents touches a travers la plateforme historique
- 600+ organisations partenaires
- Presence dans 23 pays africains
- 36 pays visites par le fondateur pour comprendre les realites du terrain

## Le produit: Etudesk OS
Application mobile (iOS + Android) + web (www.etudesk.com) qui offre:

1. **Copilote IA de carriere** — un assistant IA personnel qui:
   - Analyse ton profil, tes competences, tes objectifs
   - Te recommande des formations, des opportunites, des parcours
   - T'aide a rediger ton CV, ta lettre de motivation
   - Te prepare aux entretiens
   - Repond a toutes tes questions de carriere 24/7

2. **Profil talent** — ton profil professionnel augmente par l'IA:
   - Competences validees
   - Experiences
   - Objectifs de carriere
   - Score d'employabilite

3. **Opportunites** — acces a des offres d'emploi, stages, formations:
   - Matching IA avec ton profil
   - Candidatures simplifiees
   - Suivi des candidatures

4. **Communautes** — rejoins des groupes thematiques:
   - Echange avec d'autres talents
   - Mentorat
   - Evenements

5. **Espaces organisations** — pour les entreprises et institutions:
   - Gestion de talents
   - Publication d'opportunites
   - Tableaux de bord

## Comment s'inscrire
1. Telecharger l'app Etudesk sur App Store ou Google Play
2. Ou aller sur www.etudesk.com
3. S'inscrire avec son numero WhatsApp (OTP) ou email
4. Completer son profil
5. Commencer a utiliser le copilote IA

## Authentification
- WhatsApp OTP: on recoit un code a 6 chiffres par WhatsApp, valable 10 minutes
- Email OTP: meme principe par email
- Si le code ne vient pas: verifier le numero, attendre 60 secondes, redemander

## Equipe de support
- Hasma GBANE — Responsable Operations (hello@etudesk.org)
- Lamine BARRO — PDG et Fondateur (lamine.barro@etudesk.org)
- Eddy ASSOHOUN — CTO
- Wilfried DALI — DGA et Co-fondateur

## Partenaires et references
- Gouvernement de Cote d'Ivoire (consultant officiel)
- Banque Mondiale, BAD, AFD, Nations Unies, Fondation Mastercard, UNICEF, BOAD
- Forbes Top 10 African EdTech Startups
- Prix national d'excellence 2019 et 2022
- HEC Paris, Founder Institute (Silicon Valley)

## Langues supportees
- Francais (principal)
- Anglais

## Tarification
- L'inscription et le profil de base sont GRATUITS
- Des fonctionnalites premium existent (credits)
- Les organisations ont des plans specifiques

## Contact
- WhatsApp: +225 05 84 40 13 13 (ce numero, le support)
- Email: hello@etudesk.org
- Site: www.etudesk.com
`;

// ─── SYSTEM PROMPT ──────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Tu es l'agent de support WhatsApp d'Etudesk. Tu es un assistant IA intelligent, chaleureux et professionnel.

${ETUDESK_CONTEXT}

## Regles de comportement

### Ton et style
- Francais par defaut. Si le message est en anglais, reponds en anglais.
- Tutoiement naturel, ton chaleureux mais professionnel
- Messages clairs et structures (max 800 caracteres)
- Utilise le prenom de l'utilisateur quand tu le connais
- Sois direct et utile — pas de blabla

### Ce que tu PEUX faire
- Expliquer Etudesk, ses fonctionnalites, comment s'inscrire
- Aider avec les problemes de connexion (OTP, compte bloque)
- Guider sur l'utilisation de l'app (profil, copilote, opportunites)
- Repondre aux questions sur les competences, la carriere, les formations
- Donner des infos generales sur l'equipe et les partenaires
- Orienter vers les bons contacts selon le besoin

### Ce que tu NE PEUX PAS faire
- Donner des conseils financiers ou juridiques
- Modifier des comptes utilisateurs (tu n'as pas acces)
- Promettre des emplois ou des resultats specifiques
- Partager des donnees personnelles d'autres utilisateurs
- Inventer des informations que tu ne connais pas

### Escalation humaine
Si la demande depasse tes capacites ou concerne:
- Un bug technique complexe
- Une question financiere/juridique/contractuelle
- Une plainte formelle
- Un partenariat ou une collaboration
Dis: "Je transmets ta demande a notre equipe. Hasma (hello@etudesk.org) te recontactera rapidement."

### Format WhatsApp
- Utilise *gras* pour les mots importants
- Utilise des retours a la ligne pour la lisibilite
- Pas d'emoji excessif (1-2 max par message)
- Inclus le lien www.etudesk.com seulement quand c'est pertinent (inscription, telechargement)
`;

// ─── CONVERSATION HISTORY ───────────────────────────────────────────────────

async function getConversationHistory(
  phoneE164: string,
  limit = 10
): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
  try {
    const result = await pool.query(
      `SELECT direction, message_text, created_at
       FROM whatsapp_support_messages
       WHERE phone_e164 = $1
         AND status IN ('received', 'sent')
         AND message_text IS NOT NULL
         AND message_text != ''
       ORDER BY created_at DESC
       LIMIT $2`,
      [phoneE164, limit]
    );

    return result.rows
      .reverse()
      .map((row: any) => ({
        role: row.direction === 'inbound' ? ('user' as const) : ('assistant' as const),
        content: row.message_text,
      }));
  } catch (error) {
    logger.error('Failed to fetch WhatsApp conversation history', error, { phone: phoneE164 });
    return [];
  }
}

// ─── TYPES ──────────────────────────────────────────────────────────────────

type LinkedAccountContext = {
  linked: boolean;
  userId: string | null;
  userEmail: string | null;
  talentId: string | null;
  talentFirstName: string | null;
  talentLastName: string | null;
  talentPhone: string | null;
  linkAction: 'none' | 'user_by_talent' | 'linked_user_to_talent';
};

type WhatsappMessageDirection = 'inbound' | 'outbound';
type WhatsappMessageStatus = 'received' | 'generated' | 'sent' | 'failed';
type SupportIntentCategory = 'issue' | 'feedback' | 'support_request' | 'other';
type SupportPriority = 'low' | 'medium' | 'high' | 'critical';

// ─── ACCOUNT RESOLUTION ────────────────────────────────────────────────────

function getPhoneDigitsCandidates(phoneE164: string): string[] {
  const digits = phoneE164.replace(/[^\d]/g, '');
  const candidates = new Set<string>();
  if (digits) candidates.add(digits);
  const countryCodes = ['221', '223', '225', '226', '227', '228', '229', '245'];
  for (const cc of countryCodes) {
    if (!digits.startsWith(cc) || digits.length <= cc.length) continue;
    const local = digits.slice(cc.length);
    candidates.add(local);
    if (local.startsWith('0') && local.length > 1) candidates.add(local.slice(1));
    if (cc === '225') {
      const ciPrefixes = ['01', '05', '07'];
      if (local.length === 8) {
        for (const prefix of ciPrefixes) candidates.add(`${prefix}${local}`);
      } else if (local.length === 10 && ciPrefixes.includes(local.slice(0, 2))) {
        candidates.add(local.slice(2));
      }
    }
  }
  return Array.from(candidates);
}

async function resolveLinkedAccountContext(phoneE164: string): Promise<LinkedAccountContext> {
  const client = await pool.connect();
  try {
    const candidates = getPhoneDigitsCandidates(phoneE164);

    const userMatch = await client.query(
      `SELECT u.id AS user_id, u.email AS user_email,
              t.id AS talent_id, t.phone AS talent_phone, t.first_name, t.last_name
       FROM users u
       LEFT JOIN talents t ON t.id = u.talent_id AND t.deleted_at IS NULL
       WHERE u.deleted_at IS NULL
         AND ((u.phone IS NOT NULL AND regexp_replace(u.phone, '[^0-9]', '', 'g') = ANY($1::text[]))
           OR (t.phone IS NOT NULL AND regexp_replace(t.phone, '[^0-9]', '', 'g') = ANY($1::text[])))
       ORDER BY (u.talent_id IS NOT NULL) DESC, u.created_at DESC
       LIMIT 1`,
      [candidates]
    );

    if (userMatch.rows.length > 0) {
      const row = userMatch.rows[0];
      return {
        linked: Boolean(row.talent_id),
        userId: row.user_id,
        userEmail: row.user_email,
        talentId: row.talent_id,
        talentFirstName: row.first_name,
        talentLastName: row.last_name,
        talentPhone: row.talent_phone,
        linkAction: 'none',
      };
    }

    const talentMatch = await client.query(
      `SELECT id, email, phone, first_name, last_name FROM talents
       WHERE deleted_at IS NULL AND phone IS NOT NULL
         AND regexp_replace(phone, '[^0-9]', '', 'g') = ANY($1::text[])
       ORDER BY updated_at DESC LIMIT 1`,
      [candidates]
    );

    if (talentMatch.rows.length === 0) {
      return {
        linked: false, userId: null, userEmail: null, talentId: null,
        talentFirstName: null, talentLastName: null, talentPhone: null, linkAction: 'none',
      };
    }

    const talent = talentMatch.rows[0];

    const userByTalent = await client.query(
      `SELECT id, email FROM users WHERE deleted_at IS NULL AND talent_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [talent.id]
    );

    if (userByTalent.rows.length > 0) {
      return {
        linked: true, userId: userByTalent.rows[0].id, userEmail: userByTalent.rows[0].email,
        talentId: talent.id, talentFirstName: talent.first_name, talentLastName: talent.last_name,
        talentPhone: talent.phone, linkAction: 'user_by_talent',
      };
    }

    const userByEmail = await client.query(
      `SELECT id, email, talent_id FROM users WHERE deleted_at IS NULL AND email = $1 LIMIT 1`,
      [talent.email]
    );

    if (userByEmail.rows.length > 0 && !userByEmail.rows[0].talent_id) {
      await client.query(`UPDATE users SET talent_id = $1, updated_at = NOW() WHERE id = $2`, [talent.id, userByEmail.rows[0].id]);
      return {
        linked: true, userId: userByEmail.rows[0].id, userEmail: userByEmail.rows[0].email,
        talentId: talent.id, talentFirstName: talent.first_name, talentLastName: talent.last_name,
        talentPhone: talent.phone, linkAction: 'linked_user_to_talent',
      };
    }

    return {
      linked: false, userId: null, userEmail: null, talentId: talent.id,
      talentFirstName: talent.first_name, talentLastName: talent.last_name,
      talentPhone: talent.phone, linkAction: 'none',
    };
  } catch (error) {
    logger.error('WhatsApp account resolution failed', error, { phone: phoneE164 });
    return {
      linked: false, userId: null, userEmail: null, talentId: null,
      talentFirstName: null, talentLastName: null, talentPhone: null, linkAction: 'none',
    };
  } finally {
    client.release();
  }
}

// ─── DB PERSISTENCE ─────────────────────────────────────────────────────────

async function storeMessage(params: {
  phoneE164: string;
  direction: WhatsappMessageDirection;
  status: WhatsappMessageStatus;
  messageText: string;
  linked: LinkedAccountContext;
  channelMessageId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO whatsapp_support_messages (phone_e164, direction, status, message_text,
         channel_message_id, linked_user_id, linked_talent_id, link_action, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)`,
      [
        params.phoneE164, params.direction, params.status, params.messageText,
        params.channelMessageId || null, params.linked.userId, params.linked.talentId,
        params.linked.linkAction, JSON.stringify(params.metadata || {}),
      ]
    );
  } catch (error) {
    logger.error('Failed to store WhatsApp message', error, { phone: params.phoneE164, direction: params.direction });
  }
}

async function storeReport(params: {
  phoneE164: string;
  messageText: string;
  linked: LinkedAccountContext;
  category: SupportIntentCategory;
  priority: SupportPriority;
  tags: string[];
}): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO whatsapp_support_reports (phone_e164, linked_user_id, linked_talent_id,
         category, priority, message_text, tags, status) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'NEW')`,
      [
        params.phoneE164, params.linked.userId, params.linked.talentId,
        params.category, params.priority, params.messageText, JSON.stringify(params.tags),
      ]
    );
  } catch (error) {
    logger.error('Failed to store WhatsApp report', error, { phone: params.phoneE164 });
  }
}

// ─── INTENT DETECTION ───────────────────────────────────────────────────────

function detectIntent(message: string): {
  category: SupportIntentCategory;
  priority: SupportPriority;
  tags: string[];
} {
  const text = (message || '').toLowerCase();
  const tags = new Set<string>();

  const issueWords = ['bug', 'erreur', 'probleme', 'panne', 'bloque', 'crash', 'not working', 'issue', 'failed'];
  const feedbackWords = ['feedback', 'suggestion', 'idee', 'amelioration', 'avis', 'feature request'];
  const supportWords = ['aide', 'help', 'comment', 'how', 'otp', 'connexion', 'login', 'compte', 'profil', 'candidature', 'credit', 'app'];
  const criticalWords = ['urgent', 'impossible', 'down', 'crash'];

  const hasIssue = issueWords.some((w) => text.includes(w));
  const hasFeedback = feedbackWords.some((w) => text.includes(w));
  const hasSupport = supportWords.some((w) => text.includes(w));
  const isCritical = criticalWords.some((w) => text.includes(w));

  if (hasIssue) {
    tags.add('issue');
    return { category: 'issue', priority: isCritical ? 'critical' : 'high', tags: Array.from(tags) };
  }
  if (hasFeedback) {
    tags.add('feedback');
    return { category: 'feedback', priority: 'medium', tags: Array.from(tags) };
  }
  if (hasSupport) {
    tags.add('support');
    return { category: 'support_request', priority: isCritical ? 'high' : 'medium', tags: Array.from(tags) };
  }
  return { category: 'other', priority: 'low', tags: Array.from(tags) };
}

// ─── CLAUDE RESPONSE GENERATION ─────────────────────────────────────────────

async function generateReply(
  message: string,
  account: LinkedAccountContext,
  phoneE164: string
): Promise<string> {
  if (!message.trim()) {
    return "Je n'ai pas recu de message. Tu peux me decrire ton besoin ?";
  }

  try {
    const anthropic = getAnthropicClient();
    const history = await getConversationHistory(phoneE164);

    // Build user context
    const userContext: string[] = [];
    if (account.linked) {
      const name = [account.talentFirstName, account.talentLastName].filter(Boolean).join(' ') || 'Inconnu';
      userContext.push(`Utilisateur identifie: ${name}`);
      if (account.userEmail) userContext.push(`Email: ${account.userEmail}`);
      userContext.push('Compte lie a Etudesk: oui');
    } else if (account.talentFirstName) {
      userContext.push(`Profil talent trouve: ${account.talentFirstName} (pas encore lie a un compte utilisateur)`);
    } else {
      userContext.push('Utilisateur non identifie (pas encore inscrit ou numero non lie)');
    }

    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    // Add conversation history for context continuity
    for (const msg of history) {
      messages.push(msg);
    }

    // Add current message
    messages.push({ role: 'user', content: message.trim() });

    const response = await anthropic.messages.create({
      model: MODEL_FAST,
      max_tokens: 500,
      system: `${SYSTEM_PROMPT}\n\n## Contexte utilisateur actuel\n${userContext.join('\n')}`,
      messages,
    });

    const content = response.content[0];
    if (content.type === 'text' && content.text.trim()) {
      return content.text.trim();
    }

    return "Je suis la pour t'aider avec Etudesk. Dis-moi ton besoin !";
  } catch (error: any) {
    logger.error('Claude WhatsApp reply generation failed', error, {
      message: String(error?.message || error),
      status: error?.status,
    });
    return 'Je rencontre un souci temporaire. Reessaie dans quelques instants, ou contacte-nous a hello@etudesk.org';
  }
}

// ─── MAIN HANDLER ───────────────────────────────────────────────────────────

export async function handleWhatsAppAssistantMessage(
  phoneToReply: string,
  incomingMessage: string
): Promise<{ success: boolean; reply: string; error?: string }> {
  const account = await resolveLinkedAccountContext(phoneToReply);
  const intent = detectIntent(incomingMessage);

  // Store inbound message
  await storeMessage({
    phoneE164: phoneToReply,
    direction: 'inbound',
    status: 'received',
    messageText: incomingMessage,
    linked: account,
    metadata: {
      intentCategory: intent.category,
      intentPriority: intent.priority,
      intentTags: intent.tags,
      engine: 'claude',
    },
  });

  // Store report for issues/feedback
  if (intent.category === 'issue' || intent.category === 'feedback') {
    await storeReport({
      phoneE164: phoneToReply,
      messageText: incomingMessage,
      linked: account,
      category: intent.category,
      priority: intent.priority,
      tags: intent.tags,
    });
  }

  // Generate response with Claude
  const reply = await generateReply(incomingMessage, account, phoneToReply);

  // Store generated reply
  await storeMessage({
    phoneE164: phoneToReply,
    direction: 'outbound',
    status: 'generated',
    messageText: reply,
    linked: account,
  });

  // Send via UltraMSG
  const sent = await sendWhatsAppMessage(phoneToReply, reply);

  if (!sent.success) {
    await storeMessage({
      phoneE164: phoneToReply,
      direction: 'outbound',
      status: 'failed',
      messageText: reply,
      linked: account,
      metadata: { sendError: sent.error || 'unknown' },
    });
    return { success: false, reply, error: sent.error };
  }

  await storeMessage({
    phoneE164: phoneToReply,
    direction: 'outbound',
    status: 'sent',
    messageText: reply,
    linked: account,
    channelMessageId: sent.messageId || null,
  });

  logger.info('WhatsApp agent replied', {
    phone: phoneToReply,
    intent: intent.category,
    priority: intent.priority,
    linked: account.linked,
    engine: 'claude',
    model: MODEL_FAST,
  });

  return { success: true, reply };
}

// Legacy export compatibility
export { generateReply as generateWhatsAppAssistantReply };
