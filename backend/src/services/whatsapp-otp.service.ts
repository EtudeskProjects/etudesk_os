import bcrypt from 'bcryptjs';
import https from 'node:https';
import { v4 as uuidv4 } from 'uuid';
import { pool } from './database';
import { logger } from '../utils';

const CONFIG = { expiresInMinutes: 10, maxAttempts: 3, rateLimitMinutes: 1, cooldownMinutes: 30 };

export type WhatsAppOtpResult = {
  success: boolean;
  code?: string;
  expiresAt?: Date;
  error?: string;
  rateLimited?: boolean;
  retryAfter?: number;
};

export type WhatsAppVerifyResult = {
  success: boolean;
  userId?: string;
  email?: string | null;
  isNewUser?: boolean;
  error?: string;
  attemptsRemaining?: number;
};

function normalizePhone(phone: string): string | null {
  const trimmed = phone.trim().replace(/[\s().-]/g, '');
  if (!/^\+[1-9]\d{7,14}$/.test(trimmed)) return null;
  return trimmed;
}

function generateCode(): string {
  return String(100000 + Math.floor(Math.random() * 900000));
}

function sendUltraMsg(phone: string, code: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const instanceId = process.env.ULTRAMSG_INSTANCE_ID;
  const token = process.env.ULTRAMSG_TOKEN;
  if (!instanceId || !token) return Promise.resolve({ success: false, error: 'WHATSAPP_OTP_NOT_CONFIGURED' });

  const body = JSON.stringify({ token, to: phone, body: `Etudesk — votre code de connexion est ${code}. Il expire dans ${CONFIG.expiresInMinutes} minutes. Ne le partagez avec personne.` });
  return new Promise((resolve) => {
    const request = https.request({
      hostname: 'api.ultramsg.com', path: `/${encodeURIComponent(instanceId)}/messages/chat`, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, timeout: 10_000,
    }, (response) => {
      let raw = '';
      response.on('data', (chunk) => { raw += String(chunk); });
      response.on('end', () => {
        try {
          const data = JSON.parse(raw) as { sent?: string; id?: string; error?: string };
          const accepted = response.statusCode !== undefined && response.statusCode >= 200 && response.statusCode < 300 && !data.error;
          resolve(accepted ? { success: true, messageId: data.id } : { success: false, error: data.error || `ULTRAMSG_HTTP_${response.statusCode}` });
        } catch { resolve({ success: false, error: 'ULTRAMSG_INVALID_RESPONSE' }); }
      });
    });
    request.on('timeout', () => request.destroy(new Error('ULTRAMSG_TIMEOUT')));
    request.on('error', (error) => resolve({ success: false, error: error.message }));
    request.write(body);
    request.end();
  });
}

export async function requestWhatsAppOtp(phoneInput: string, ipAddress?: string, userAgent?: string): Promise<WhatsAppOtpResult> {
  const phone = normalizePhone(phoneInput);
  if (!phone) return { success: false, error: 'INVALID_PHONE' };
  const client = await pool.connect();
  try {
    const recent = await client.query(`SELECT created_at FROM whatsapp_otp_codes WHERE phone=$1 AND created_at > NOW() - ($2 || ' minutes')::interval ORDER BY created_at DESC LIMIT 1`, [phone, String(CONFIG.rateLimitMinutes)]);
    if (recent.rows.length) return { success: false, rateLimited: true, retryAfter: 60, error: 'OTP_RATE_LIMITED' };
    const blocked = await client.query(`SELECT 1 FROM whatsapp_otp_codes WHERE phone=$1 AND attempts >= max_attempts AND created_at > NOW() - ($2 || ' minutes')::interval LIMIT 1`, [phone, String(CONFIG.cooldownMinutes)]);
    if (blocked.rows.length) return { success: false, rateLimited: true, retryAfter: CONFIG.cooldownMinutes * 60, error: 'TOO_MANY_FAILED_ATTEMPTS' };
    await client.query(`UPDATE whatsapp_otp_codes SET used_at=NOW() WHERE phone=$1 AND used_at IS NULL`, [phone]);
    const code = generateCode();
    const expiresAt = new Date(Date.now() + CONFIG.expiresInMinutes * 60_000);
    const id = uuidv4();
    await client.query(`INSERT INTO whatsapp_otp_codes (id, phone, code_hash, expires_at, ip_address, user_agent, max_attempts) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [id, phone, await bcrypt.hash(code, 10), expiresAt, ipAddress ?? null, userAgent ?? null, CONFIG.maxAttempts]);
    const delivery = await sendUltraMsg(phone, code);
    if (!delivery.success) {
      await client.query(`UPDATE whatsapp_otp_codes SET used_at=NOW() WHERE id=$1`, [id]);
      logger.error('WhatsApp OTP delivery failed', { phoneSuffix: phone.slice(-4), error: delivery.error });
      return { success: false, error: delivery.error === 'WHATSAPP_OTP_NOT_CONFIGURED' ? delivery.error : 'WHATSAPP_OTP_DELIVERY_FAILED' };
    }
    await client.query(`UPDATE whatsapp_otp_codes SET provider_message_id=$2 WHERE id=$1`, [id, delivery.messageId ?? null]);
    return { success: true, expiresAt };
  } catch (error) {
    logger.error('WhatsApp OTP request failed', error);
    return { success: false, error: 'WHATSAPP_OTP_REQUEST_FAILED' };
  } finally { client.release(); }
}

export async function verifyWhatsAppOtp(phoneInput: string, code: string): Promise<WhatsAppVerifyResult> {
  const phone = normalizePhone(phoneInput);
  if (!phone) return { success: false, error: 'INVALID_PHONE' };
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const otp = await client.query(`SELECT * FROM whatsapp_otp_codes WHERE phone=$1 AND used_at IS NULL AND expires_at>NOW() ORDER BY created_at DESC LIMIT 1 FOR UPDATE`, [phone]);
    if (!otp.rows.length) { await client.query('ROLLBACK'); return { success: false, error: 'OTP_INVALID_OR_EXPIRED' }; }
    const challenge = otp.rows[0];
    if (!(await bcrypt.compare(code, challenge.code_hash))) {
      await client.query(`UPDATE whatsapp_otp_codes SET attempts=attempts+1 WHERE id=$1`, [challenge.id]);
      await client.query('COMMIT');
      return { success: false, error: 'OTP_INVALID_OR_EXPIRED', attemptsRemaining: Math.max(0, challenge.max_attempts - challenge.attempts - 1) };
    }
    await client.query(`UPDATE whatsapp_otp_codes SET used_at=NOW() WHERE id=$1`, [challenge.id]);
    let user = await client.query(`SELECT id,email FROM users WHERE phone=$1 AND deleted_at IS NULL LIMIT 1 FOR UPDATE`, [phone]);
    let isNewUser = false;
    if (!user.rows.length) {
      const talent = await client.query(`SELECT id FROM talents WHERE phone=$1 AND deleted_at IS NULL LIMIT 1`, [phone]);
      const placeholderEmail = `phone-${phone.replace(/\D/g, '')}@phone.etudesk.local`;
      user = await client.query(`INSERT INTO users (email,phone,email_verified,talent_id) VALUES ($1,$2,FALSE,$3) RETURNING id,email`, [placeholderEmail, phone, talent.rows[0]?.id ?? null]);
      isNewUser = true;
    }
    await client.query(`UPDATE users SET last_login_at=NOW(), login_count=login_count+1 WHERE id=$1`, [user.rows[0].id]);
    await client.query('COMMIT');
    return { success: true, userId: user.rows[0].id, email: user.rows[0].email, isNewUser };
  } catch (error) {
    await client.query('ROLLBACK'); logger.error('WhatsApp OTP verification failed', error); return { success: false, error: 'OTP_VERIFICATION_FAILED' };
  } finally { client.release(); }
}
