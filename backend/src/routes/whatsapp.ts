import { Router, Request, Response } from 'express';
import { whatsappWebhookLimiter } from '../middleware/rateLimit.middleware';
import { handleWhatsAppAssistantMessage } from '../services/whatsapp-assistant.service';
import { formatPhoneToE164 } from '../services/whatsapp.service';
import { getClientIp, logger } from '../utils';

const router = Router();
const isWhatsAppSupportAssistantEnabled = process.env.WHATSAPP_SUPPORT_AGENT_ENABLED === 'true';

function isAllowedIp(ipAddress?: string): boolean {
  const whitelist = (process.env.ULTRAMSG_ALLOWED_IPS || '')
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean);

  // SECURITY: Fail-closed — if no whitelist configured, reject all webhook requests
  if (!whitelist.length) {
    logger.warn('WhatsApp webhook: ULTRAMSG_ALLOWED_IPS not configured, rejecting request');
    return false;
  }
  if (!ipAddress) return false;

  const normalized = ipAddress.includes('::ffff:') ? ipAddress.replace('::ffff:', '') : ipAddress;
  return whitelist.includes(normalized);
}

function normalizeIncomingPhone(rawPhone?: string): string | null {
  if (!rawPhone) return null;
  const withoutSuffix = rawPhone.replace('@c.us', '').trim();
  return formatPhoneToE164(withoutSuffix);
}

router.get('/webhook', (_req: Request, res: Response) => {
  return res.status(200).json({
    success: true,
    status: 'ok',
    assistantEnabled: isWhatsAppSupportAssistantEnabled,
  });
});

const handleWebhook = async (req: Request, res: Response) => {
  try {
    if (!isWhatsAppSupportAssistantEnabled) {
      return res.status(200).json({
        success: true,
        status: 'ignored',
        reason: 'assistant_disabled',
      });
    }

    const ipAddress = getClientIp(req);
    if (!isAllowedIp(ipAddress)) {
      logger.warn('WhatsApp webhook unauthorized IP', { ipAddress });
      return res.status(403).json({ success: false, error: req.t('common:unauthorized') });
    }

    const payload = req.body?.data ?? req.body ?? {};
    const fromMe = Boolean(payload.fromMe ?? payload.self);
    const messageType = String(payload.type || 'text').toLowerCase();
    const incomingText = payload.body || payload.message || payload.text || '';
    const rawPhone = payload.from || payload.author || payload.sender;
    const phone = normalizeIncomingPhone(rawPhone);

    if (fromMe) {
      return res.status(200).json({ success: true, status: 'ignored', reason: 'from_me' });
    }

    if (!phone) {
      return res.status(400).json({ success: false, error: req.t('auth:invalidPhone') });
    }

    if (!['text', 'chat'].includes(messageType)) {
      return res.status(200).json({ success: true, status: 'ignored', reason: 'unsupported_type' });
    }

    if (!String(incomingText).trim()) {
      return res.status(200).json({ success: true, status: 'ignored', reason: 'empty_message' });
    }

    const result = await handleWhatsAppAssistantMessage(phone, String(incomingText));
    if (!result.success) {
      logger.error('WhatsApp assistant failed to reply', undefined, {
        phone,
        error: result.error,
      });
      return res.status(500).json({ success: false, error: result.error || req.t('common:serverError') });
    }

    return res.status(200).json({
      success: true,
      status: 'processed',
      reply: result.reply,
    });
  } catch (error) {
    logger.error('WhatsApp webhook processing error', error);
    return res.status(500).json({ success: false, error: req.t('common:serverError') });
  }
};

router.post('/webhook', whatsappWebhookLimiter, handleWebhook);

export default router;
