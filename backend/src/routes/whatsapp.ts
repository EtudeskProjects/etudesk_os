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

  for (const entry of whitelist) {
    if (entry.includes('/')) {
      // CIDR support
      const [subnet, bits] = entry.split('/');
      const mask = ~(2 ** (32 - Number(bits)) - 1) >>> 0;
      const ipNum = ipToNum(normalized);
      const subnetNum = ipToNum(subnet);
      if (ipNum !== null && subnetNum !== null && (ipNum & mask) === (subnetNum & mask)) return true;
    } else if (entry === normalized) {
      return true;
    }
  }

  logger.warn('WhatsApp webhook: IP not in whitelist', { ipAddress: normalized });
  return false;
}

function ipToNum(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  const nums = parts.map(Number);
  if (nums.some((n) => isNaN(n) || n < 0 || n > 255)) return null;
  return ((nums[0] << 24) | (nums[1] << 16) | (nums[2] << 8) | nums[3]) >>> 0;
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
    const payload = req.body?.data ?? req.body ?? {};

    // Validate: IP whitelist OR matching UltraMSG token in payload
    const tokenMatch = payload.token === process.env.ULTRAMSG_TOKEN;
    if (!isAllowedIp(ipAddress) && !tokenMatch) {
      logger.warn('WhatsApp webhook unauthorized', { ipAddress, tokenPresent: Boolean(payload.token) });
      return res.status(403).json({ success: false, error: req.t('common:unauthorized') });
    }

    // Log source IP for whitelist tuning
    if (tokenMatch && !isAllowedIp(ipAddress)) {
      logger.info('WhatsApp webhook: token-authenticated request from new IP — consider adding to whitelist', { ipAddress });
    }
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
