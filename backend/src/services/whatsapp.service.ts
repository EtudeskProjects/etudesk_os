import { logger } from '../utils';

const ULTRAMSG_BASE_URL = 'https://api.ultramsg.com';
const ULTRAMSG_INSTANCE_ID = process.env.ULTRAMSG_INSTANCE_ID;
const ULTRAMSG_TOKEN = process.env.ULTRAMSG_TOKEN;

function normalizeDigits(phone: string): string {
  return phone.replace(/[^\d+]/g, '').trim();
}

const UEMOA_COUNTRY_CODES = ['221', '223', '225', '226', '227', '228', '229', '245'] as const;

/**
 * Normalize phone to E.164 (UEMOA-friendly).
 *
 * Rules:
 * - Accept already-E164 numbers: +[8..15 digits]
 * - Accept digits starting with a known UEMOA country code.
 * - If number has no country code, use DEFAULT_PHONE_COUNTRY_CODE (env) or provided defaultCountryCode.
 * - If local format starts with 0, strip it when adding country code.
 */
export function formatPhoneToE164(phone: string, defaultCountryCode: string = process.env.DEFAULT_PHONE_COUNTRY_CODE || '225'): string | null {
  const normalized = normalizeDigits(phone);

  if (!normalized) return null;

  if (normalized.startsWith('+')) {
    const digits = normalized.slice(1);
    return /^\d{8,15}$/.test(digits) ? `+${digits}` : null;
  }

  // Digits only
  if (!/^\d{7,15}$/.test(normalized)) return null;

  // If it already starts with a UEMOA country code, accept it.
  if (UEMOA_COUNTRY_CODES.some((cc) => normalized.startsWith(cc)) && normalized.length >= 10) {
    return `+${normalized}`;
  }

  // Fallback: local number without country code (requires a default country code).
  const cc = String(defaultCountryCode || '').replace(/[^\d]/g, '');
  if (!cc) return null;

  const local = normalized.startsWith('0') ? normalized.slice(1) : normalized;
  if (!/^\d{6,12}$/.test(local)) return null;
  return `+${cc}${local}`;
}

export async function sendWhatsAppMessage(phone: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!ULTRAMSG_INSTANCE_ID || !ULTRAMSG_TOKEN) {
    logger.warn('WhatsApp UltraMsg is not configured');
    return { success: false, error: 'WhatsApp service not configured' };
  }

  try {
    const target = phone.includes('@c.us') ? phone : `${phone.replace('+', '')}@c.us`;

    const formData = new URLSearchParams();
    formData.append('token', ULTRAMSG_TOKEN);
    formData.append('to', target);
    formData.append('body', message);
    formData.append('priority', '10');

    const response = await fetch(`${ULTRAMSG_BASE_URL}/${ULTRAMSG_INSTANCE_ID}/messages/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const text = await response.text();
    let payload: any = null;

    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = { raw: text };
    }

    if (!response.ok) {
      logger.error('WhatsApp send failed', undefined, {
        status: response.status,
        payload,
        target,
      });
      return { success: false, error: payload?.error || 'WhatsApp send failed' };
    }

    return {
      success: true,
      messageId: payload?.id || payload?.msgId || payload?.messageId,
    };
  } catch (error: any) {
    logger.error('WhatsApp service error', error);
    return { success: false, error: String(error?.message || error) };
  }
}

export async function sendWhatsAppOtp(phone: string, code: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const message = [
    `Votre code de verification Etudesk est: *${code}*`,
    '',
    'Ce code expire dans 10 minutes.',
    'Ne partagez jamais ce code avec personne.',
  ].join('\n');

  return sendWhatsAppMessage(phone, message);
}
