import { getGeminiClient } from './ai/provider';
import { sendWhatsAppMessage } from './whatsapp.service';
import { logger } from '../utils';
import { MODEL_SUGGESTION } from './ai/models';

const SYSTEM_PROMPT = `Tu es Etudesk Support, l'assistant WhatsApp officiel de la plateforme Etudesk OS.

Regles:
- Reponds en francais clair, ton professionnel et chaleureux.
- Message court (max 500 caracteres).
- Donne des etapes concretes si l'utilisateur demande une action.
- Si la demande concerne le compte (OTP, connexion), propose des instructions simples.
- N'invente jamais des donnees privees utilisateur.`;

export async function generateWhatsAppAssistantReply(message: string): Promise<string> {
  const trimmed = message.trim();

  if (!trimmed) {
    return 'Je n\'ai pas recu de message. Tu peux me decrire ton besoin en une phrase.';
  }

  const lower = trimmed.toLowerCase();

  if (lower.includes('otp') || lower.includes('code')) {
    return 'Pour recevoir un code OTP, ouvre Etudesk puis choisis connexion email ou WhatsApp. Si le code tarde, demande un nouveau code apres 60 secondes.';
  }

  if (lower.includes('bonjour') || lower.includes('salut')) {
    return 'Bonjour 👋 Je suis l\'assistant WhatsApp Etudesk. Dis-moi ce que tu veux faire: connexion, profil, candidatures, ou credits.';
  }

  try {
    const client = getGeminiClient();
    const completion = await client.chat.completions.create({
      model: process.env.WHATSAPP_ASSISTANT_MODEL || MODEL_SUGGESTION,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: trimmed },
      ],
    });

    const content = completion.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return 'Je peux t\'aider sur Etudesk (connexion, profil, candidatures, credits). Dis-moi ton besoin precis.';
    }

    return content.length > 500 ? `${content.slice(0, 497)}...` : content;
  } catch (error) {
    const err: any = error;
    logger.error('Failed to generate WhatsApp assistant reply', err, {
      message: String(err?.message || err),
      status: err?.status,
      code: err?.code,
    });
    return 'Je rencontre un souci temporaire. Reessaie dans quelques instants.';
  }
}

export async function handleWhatsAppAssistantMessage(phoneToReply: string, incomingMessage: string): Promise<{ success: boolean; reply: string; error?: string }> {
  const reply = await generateWhatsAppAssistantReply(incomingMessage);
  const sent = await sendWhatsAppMessage(phoneToReply, reply);

  if (!sent.success) {
    return { success: false, reply, error: sent.error };
  }

  return { success: true, reply };
}
