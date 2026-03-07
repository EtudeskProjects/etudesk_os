import { getGeminiClient } from './ai/provider';
import { sendWhatsAppMessage } from './whatsapp.service';
import { logger } from '../utils';
import { MODEL_SUGGESTION } from './ai/models';
import { pool } from './database';

const SYSTEM_PROMPT = `Tu es l'assistant WhatsApp d'Etudesk, la plateforme de gestion des talents en Afrique.

Ton role: aider les utilisateurs sur connexion, profil, candidatures, communautes et credits.

Regles:
- Francais naturel, ton chaleureux, tutoiement. Pas de jargon technique.
- Messages courts (max 400 caracteres). Va droit au but.
- Si tu connais le prenom de l'utilisateur, utilise-le.
- Donne des etapes concretes quand on te demande une action.
- N'invente JAMAIS de donnees utilisateur (email, profil, etc.).
- Si la demande depasse ton perimetre, note le probleme et dis que l'equipe reviendra vers eux.
- N'ajoute PAS de lien de telechargement sauf si l'utilisateur demande ou c'est pertinent (ex: premiere interaction, demande d'inscription).
- Ne demande JAMAIS de verification d'identite (email, OTP) sauf si l'utilisateur a un probleme de connexion specifique.`;

const APP_URL = 'https://etudesk.com';

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

type DbUserByTalent = {
  id: string;
  email: string | null;
};

type DbUserByEmail = {
  id: string;
  email: string | null;
  talent_id: string | null;
};

type DbTalent = {
  id: string;
  email: string;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
};

function getPhoneDigitsCandidates(phoneE164: string): string[] {
  const digits = phoneE164.replace(/[^\d]/g, '');
  const candidates = new Set<string>();
  if (digits) candidates.add(digits);

  // Support local formats stored without country code
  const countryCodes = ['221', '223', '225', '226', '227', '228', '229', '245'];
  for (const cc of countryCodes) {
    if (!digits.startsWith(cc) || digits.length <= cc.length) continue;
    const local = digits.slice(cc.length);
    candidates.add(local);
    if (local.startsWith('0') && local.length > 1) {
      candidates.add(local.slice(1));
    }

    // Legacy CI format support: old 8 digits <-> new 10 digits with prefix
    if (cc === '225') {
      const ciPrefixes = ['01', '05', '07'];
      if (local.length === 8) {
        for (const prefix of ciPrefixes) {
          candidates.add(`${prefix}${local}`);
        }
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

    // 1) Fast path: existing user already linked to a talent matched by phone or stored directly on users.phone
    const userMatch = await client.query<{
      user_id: string;
      user_email: string | null;
      talent_id: string | null;
      talent_phone: string | null;
      first_name: string | null;
      last_name: string | null;
    }>(
      `SELECT u.id AS user_id,
              u.email AS user_email,
              t.id AS talent_id,
              t.phone AS talent_phone,
              t.first_name,
              t.last_name
       FROM users u
       LEFT JOIN talents t ON t.id = u.talent_id AND t.deleted_at IS NULL
       WHERE u.deleted_at IS NULL
         AND (
           (u.phone IS NOT NULL AND regexp_replace(u.phone, '[^0-9]', '', 'g') = ANY($1::text[]))
           OR
           (t.phone IS NOT NULL AND regexp_replace(t.phone, '[^0-9]', '', 'g') = ANY($1::text[]))
         )
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
        linkAction: row.talent_id ? 'none' : 'none',
      };
    }

    // 2) Find talent by phone and try to attach an existing user
    const talentMatch = await client.query<DbTalent>(
      `SELECT t.id, t.email, t.phone, t.first_name, t.last_name
       FROM talents t
       WHERE t.deleted_at IS NULL
         AND t.phone IS NOT NULL
         AND regexp_replace(t.phone, '[^0-9]', '', 'g') = ANY($1::text[])
       ORDER BY t.updated_at DESC
       LIMIT 1`,
      [candidates]
    );

    if (talentMatch.rows.length === 0) {
      return {
        linked: false,
        userId: null,
        userEmail: null,
        talentId: null,
        talentFirstName: null,
        talentLastName: null,
        talentPhone: null,
        linkAction: 'none',
      };
    }

    const talent = talentMatch.rows[0];

    // Existing user linked to this talent
    const userByTalent = await client.query<DbUserByTalent>(
      `SELECT id, email
       FROM users
       WHERE deleted_at IS NULL AND talent_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [talent.id]
    );

    if (userByTalent.rows.length > 0) {
      const user = userByTalent.rows[0];
      return {
        linked: true,
        userId: user.id,
        userEmail: user.email,
        talentId: talent.id,
        talentFirstName: talent.first_name,
        talentLastName: talent.last_name,
        talentPhone: talent.phone,
        linkAction: 'user_by_talent',
      };
    }

    // Attempt safe link by exact email match
    const userByEmail = await client.query<DbUserByEmail>(
      `SELECT id, email, talent_id
       FROM users
       WHERE deleted_at IS NULL AND email = $1
       LIMIT 1`,
      [talent.email]
    );

    if (userByEmail.rows.length > 0) {
      const user = userByEmail.rows[0];
      if (!user.talent_id) {
        await client.query(`UPDATE users SET talent_id = $1, updated_at = NOW() WHERE id = $2`, [talent.id, user.id]);
        logger.info('WhatsApp support linked existing user to matched talent by phone', {
          userId: user.id,
          talentId: talent.id,
          phone: phoneE164,
        });
      }
      return {
        linked: true,
        userId: user.id,
        userEmail: user.email,
        talentId: talent.id,
        talentFirstName: talent.first_name,
        talentLastName: talent.last_name,
        talentPhone: talent.phone,
        linkAction: 'linked_user_to_talent',
      };
    }

    // Talent found but no user relation possible right now
    return {
      linked: false,
      userId: null,
      userEmail: null,
      talentId: talent.id,
      talentFirstName: talent.first_name,
      talentLastName: talent.last_name,
      talentPhone: talent.phone,
      linkAction: 'none',
    };
  } catch (error) {
    logger.error('WhatsApp support account-link resolution failed', error, { phone: phoneE164 });
    return {
      linked: false,
      userId: null,
      userEmail: null,
      talentId: null,
      talentFirstName: null,
      talentLastName: null,
      talentPhone: null,
      linkAction: 'none',
    };
  } finally {
    client.release();
  }
}

function buildContextPrompt(account: LinkedAccountContext): string {
  const lines: string[] = [];
  lines.push(`Compte lie: ${account.linked ? 'oui' : 'non'}`);
  if (account.userEmail) lines.push(`Email compte: ${account.userEmail}`);
  if (account.talentFirstName || account.talentLastName) {
    lines.push(`Nom profil: ${[account.talentFirstName, account.talentLastName].filter(Boolean).join(' ')}`);
  }
  if (account.talentPhone) lines.push(`Telephone profil: ${account.talentPhone}`);
  if (account.linkAction !== 'none') lines.push(`Action de liaison: ${account.linkAction}`);

  if (!account.linked) {
    lines.push('Le compte WhatsApp n\'est pas lie a un profil Etudesk. Ne pas demander de verification sauf si l\'utilisateur a un probleme de connexion.');
  }

  return lines.join('\n');
}

function detectSupportIntent(message: string): {
  category: SupportIntentCategory;
  priority: SupportPriority;
  tags: string[];
} {
  const text = (message || '').toLowerCase();
  const tags = new Set<string>();

  const issueWords = [
    'bug', 'erreur', 'probleme', 'problème', 'panne', 'bloque', 'bloqué', 'crash',
    'doesn\'t work', 'not working', 'issue', 'incident', 'failed', 'failure',
  ];
  const feedbackWords = [
    'feedback', 'suggestion', 'idee', 'idée', 'amélioration', 'amelioration',
    'avis', 'recommendation', 'feature request', 'proposer',
  ];
  const supportWords = [
    'aide', 'help', 'comment', 'how', 'otp', 'connexion', 'login',
    'compte', 'profil', 'candidature', 'credit', 'crédit', 'app',
  ];
  const criticalWords = ['urgent', 'urgence', 'impossible', 'down', 'bloque', 'bloqué', 'crash'];

  const hasIssue = issueWords.some((w) => text.includes(w));
  const hasFeedback = feedbackWords.some((w) => text.includes(w));
  const hasSupport = supportWords.some((w) => text.includes(w));
  const isCritical = criticalWords.some((w) => text.includes(w));

  if (hasIssue) tags.add('issue');
  if (hasFeedback) tags.add('feedback');
  if (hasSupport) tags.add('support');
  if (text.includes('otp')) tags.add('otp');
  if (text.includes('connexion') || text.includes('login')) tags.add('auth');
  if (text.includes('candidature')) tags.add('application');

  if (hasIssue) {
    return { category: 'issue', priority: isCritical ? 'critical' : 'high', tags: Array.from(tags) };
  }
  if (hasFeedback) {
    return { category: 'feedback', priority: 'medium', tags: Array.from(tags) };
  }
  if (hasSupport) {
    return { category: 'support_request', priority: isCritical ? 'high' : 'medium', tags: Array.from(tags) };
  }
  return { category: 'other', priority: 'low', tags: Array.from(tags) };
}

function appendAppLinkIfNeeded(reply: string): string {
  const trimmed = (reply || '').trim();
  const lower = trimmed.toLowerCase();
  // Only add link if the reply already mentions downloading, inscription, or the URL
  const mentionsApp = lower.includes('telecharge') || lower.includes('télécharge')
    || lower.includes('inscription') || lower.includes('inscrire')
    || lower.includes('etudesk.com');
  if (!mentionsApp) return trimmed;
  if (lower.includes(APP_URL.toLowerCase())) return trimmed;
  return `${trimmed}\n${APP_URL}`;
}

async function storeWhatsAppSupportMessage(params: {
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
      `INSERT INTO whatsapp_support_messages (
         phone_e164, direction, status, message_text,
         channel_message_id, linked_user_id, linked_talent_id, link_action, metadata
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)`,
      [
        params.phoneE164,
        params.direction,
        params.status,
        params.messageText,
        params.channelMessageId || null,
        params.linked.userId,
        params.linked.talentId,
        params.linked.linkAction,
        JSON.stringify(params.metadata || {}),
      ]
    );
  } catch (error) {
    logger.error('Failed to persist WhatsApp support message', error, {
      phone: params.phoneE164,
      direction: params.direction,
      status: params.status,
    });
  }
}

async function storeWhatsAppSupportReport(params: {
  phoneE164: string;
  messageText: string;
  linked: LinkedAccountContext;
  category: SupportIntentCategory;
  priority: SupportPriority;
  tags: string[];
}): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO whatsapp_support_reports (
         phone_e164, linked_user_id, linked_talent_id,
         category, priority, message_text, tags, status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'NEW')`,
      [
        params.phoneE164,
        params.linked.userId,
        params.linked.talentId,
        params.category,
        params.priority,
        params.messageText,
        JSON.stringify(params.tags),
      ]
    );
  } catch (error) {
    logger.error('Failed to persist WhatsApp support report', error, {
      phone: params.phoneE164,
      category: params.category,
      priority: params.priority,
    });
  }
}

export async function generateWhatsAppAssistantReply(message: string, account: LinkedAccountContext): Promise<string> {
  const trimmed = message.trim();

  if (!trimmed) {
    return 'Je n\'ai pas recu de message. Tu peux me decrire ton besoin en une phrase.';
  }

  const lower = trimmed.toLowerCase();

  if (lower.includes('otp') || lower.includes('code')) {
    const name = account.talentFirstName ? ` ${account.talentFirstName}` : '';
    return `Pour recevoir ton code OTP${name}, ouvre l'app Etudesk et choisis "Connexion WhatsApp". Le code arrive en quelques secondes. S'il tarde, attends 60s puis redemande.\n${APP_URL}`;
  }

  if (lower.includes('bonjour') || lower.includes('salut') || lower.includes('hello') || lower.includes('hi')) {
    const name = account.talentFirstName || '';
    return name
      ? `Salut ${name} ! Comment je peux t'aider aujourd'hui ?`
      : `Salut ! Je suis l'assistant Etudesk. Comment je peux t'aider ?`;
  }

  try {
    const contextPrompt = buildContextPrompt(account);
    const client = getGeminiClient();
    const completion = await client.chat.completions.create({
      model: process.env.WHATSAPP_ASSISTANT_MODEL || MODEL_SUGGESTION,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'system', content: `Contexte compte WhatsApp:\n${contextPrompt}` },
        { role: 'user', content: trimmed },
      ],
    });

    const content = completion.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return 'Je peux t\'aider sur Etudesk (connexion, profil, candidatures, credits). Dis-moi ton besoin precis.';
    }

    return appendAppLinkIfNeeded(content);
  } catch (error) {
    const err: any = error;
    logger.error('Failed to generate WhatsApp assistant reply', err, {
      message: String(err?.message || err),
      status: err?.status,
      code: err?.code,
    });
    return appendAppLinkIfNeeded('Je rencontre un souci temporaire. Reessaie dans quelques instants.');
  }
}

export async function handleWhatsAppAssistantMessage(phoneToReply: string, incomingMessage: string): Promise<{ success: boolean; reply: string; error?: string }> {
  const account = await resolveLinkedAccountContext(phoneToReply);
  const intent = detectSupportIntent(incomingMessage);
  await storeWhatsAppSupportMessage({
    phoneE164: phoneToReply,
    direction: 'inbound',
    status: 'received',
    messageText: incomingMessage,
    linked: account,
    metadata: {
      intentCategory: intent.category,
      intentPriority: intent.priority,
      intentTags: intent.tags,
    },
  });

  if (intent.category === 'issue' || intent.category === 'feedback') {
    await storeWhatsAppSupportReport({
      phoneE164: phoneToReply,
      messageText: incomingMessage,
      linked: account,
      category: intent.category,
      priority: intent.priority,
      tags: intent.tags,
    });
  }

  const reply = await generateWhatsAppAssistantReply(incomingMessage, account);
  await storeWhatsAppSupportMessage({
    phoneE164: phoneToReply,
    direction: 'outbound',
    status: 'generated',
    messageText: reply,
    linked: account,
  });

  const sent = await sendWhatsAppMessage(phoneToReply, reply);

  if (!sent.success) {
    await storeWhatsAppSupportMessage({
      phoneE164: phoneToReply,
      direction: 'outbound',
      status: 'failed',
      messageText: reply,
      linked: account,
      metadata: { sendError: sent.error || 'unknown_error' },
    });
    return { success: false, reply, error: sent.error };
  }

  await storeWhatsAppSupportMessage({
    phoneE164: phoneToReply,
    direction: 'outbound',
    status: 'sent',
    messageText: reply,
    linked: account,
    channelMessageId: sent.messageId || null,
  });

  return { success: true, reply };
}
