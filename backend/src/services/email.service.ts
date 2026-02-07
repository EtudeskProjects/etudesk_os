/**
 * Email Service
 *
 * Supports two providers:
 * - SMTP (Mailhog for local development)
 * - Resend (for production)
 *
 * Set EMAIL_PROVIDER=smtp or EMAIL_PROVIDER=resend in .env
 */

import nodemailer from 'nodemailer';
import type Mail from 'nodemailer/lib/mailer';
import { Resend } from 'resend';
import i18next from 'i18next';

import { logger } from '../utils';


export type EmailLanguage = 'fr' | 'en';
export type EmailProvider = 'smtp' | 'resend';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

// --- Configuration ---

// Determine which provider to use
const EMAIL_PROVIDER: EmailProvider = (process.env.EMAIL_PROVIDER as EmailProvider) || 'smtp';
const DEFAULT_FROM = process.env.EMAIL_FROM || 'Etudesk <noreply@etudesk.com>';

// SMTP configuration (Mailhog for local dev)
const SMTP_CONFIG = {
  host: process.env.SMTP_HOST || 'localhost',
  port: parseInt(process.env.SMTP_PORT || '1025', 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth: process.env.SMTP_USER ? {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  } : undefined,
};

// Create transporters
const smtpTransporter = nodemailer.createTransport(SMTP_CONFIG);
const resendClient = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Log which provider is active
logger.info(`📧 Email provider: ${EMAIL_PROVIDER.toUpperCase()}${EMAIL_PROVIDER === 'smtp' ? ` (${SMTP_CONFIG.host}:${SMTP_CONFIG.port})` : ''}`);

// --- Helpers ---

// --- Brand Design System - Luxe Africain ---

// Primary - Marron Luxe (Rich Brown)
const BRAND_PRIMARY = '#3B2416';
const BRAND_PRIMARY_LIGHT = '#5C3D2E';
const BRAND_PRIMARY_DARK = '#2A1A10';

// Neutrals - Warm Gray Scale
const BRAND_BLACK = '#1F1C18';
const BRAND_GRAY = '#4D4840';
const BRAND_GRAY_LIGHT = '#918A7E';

// Semantic
const BRAND_SUCCESS = '#4A6741';
const BRAND_ERROR = '#8B4A3C';
const BRAND_WARNING = '#A67C52';

// Backgrounds
const BRAND_BG_LIGHT = '#FAF9F7';
const BRAND_BG_SECONDARY = '#F5F3F0';

// Logo URL (web assets)
const LOGO_URL = 'https://etudesk.org/images/etudesk_logo_black.png';

// Helper to get translation function for a specific language
function getT(language: EmailLanguage = 'fr') {
  return (key: string, options?: Record<string, string | number>) => {
    return i18next.t(key, { lng: language, ...options });
  };
}

// --- Send Email Core Function ---

/**
 * Send an email using the configured provider
 */
export async function sendEmail(options: SendEmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const from = options.from || DEFAULT_FROM;

  try {
    if (EMAIL_PROVIDER === 'resend') {
      // Use Resend API
      if (!resendClient) {
        throw new Error('RESEND_API_KEY not configured');
      }

      const { data, error } = await resendClient.emails.send({
        from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      if (error) {
        throw new Error(error.message);
      }

      logger.info(`📧 Email sent via Resend to ${options.to}: ${data?.id}`);
      return { success: true, messageId: data?.id };

    } else {
      // Use SMTP (Mailhog for local dev)
      const mailOptions: Mail.Options = {
        from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      };

      const info = await smtpTransporter.sendMail(mailOptions);
      logger.info(`📧 Email sent via SMTP to ${options.to}: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    }
  } catch (error) {
    logger.error('❌ Failed to send email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// --- Email Templates ---

export const EmailTemplates = {
  /**
   * OTP Login Email Template - Minimalist Design
   */
  otpLogin: (code: string, expiresInMinutes: number = 10, language: EmailLanguage = 'fr'): { subject: string; html: string; text: string } => {
    const t = getT(language);
    const lang = language === 'en' ? 'en' : 'fr';

    return {
      subject: t('emails:otp.subject', { code }),
      html: `
<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t('emails:otp.title')}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #ffffff;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 48px 24px;">
        <table role="presentation" style="width: 100%; max-width: 400px; border-collapse: collapse;">

          <!-- Logo -->
          <tr>
            <td style="padding-bottom: 40px; text-align: center;">
              <img src="${LOGO_URL}" alt="Etudesk" style="height: 32px; width: auto;" />
            </td>
          </tr>

          <!-- Code Section -->
          <tr>
            <td style="text-align: center;">
              <p style="margin: 0 0 24px; font-size: 15px; color: #6b7280;">
                ${t('emails:otp.yourCode')}
              </p>

              <!-- OTP Code -->
              <div style="margin-bottom: 24px;">
                <span style="font-family: 'SF Mono', 'Roboto Mono', monospace; font-size: 32px; font-weight: 600; letter-spacing: 6px; color: ${BRAND_PRIMARY};">
                  ${code}
                </span>
              </div>

              <p style="margin: 0 0 40px; font-size: 13px; color: #9ca3af;">
                ${t('emails:otp.validFor', { minutes: expiresInMinutes })}
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0;">
              <div style="height: 1px; background-color: #f3f4f6;"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top: 24px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #d1d5db;">
                ${t('emails:otp.neverShare')}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `.trim(),
      text: `
${t('emails:otp.yourCode')}: ${code}

${t('emails:otp.validFor', { minutes: expiresInMinutes })}.

${t('emails:otp.neverShare')}.
      `.trim(),
    };
  },

  /**
   * Welcome Email Template (after onboarding)
   */
  welcome: (displayName: string, language: EmailLanguage = 'fr'): { subject: string; html: string; text: string } => {
    const t = getT(language);
    const lang = language === 'en' ? 'en' : 'fr';
    const year = new Date().getFullYear();

    return {
      subject: t('emails:welcome.subject', { name: displayName }),
      html: `
<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t('emails:welcome.title')}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: ${BRAND_BG_LIGHT};">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <img src="${LOGO_URL}" alt="Etudesk" style="height: 40px; width: auto;" />
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 20px 40px;">
              <h1 style="margin: 0 0 20px; font-size: 28px; font-weight: 600; color: #1a1a1a; text-align: center;">
                ${t('emails:welcome.title')}
              </h1>
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #666666;">
                ${t('emails:welcome.greeting', { name: displayName })}
              </p>
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #666666;">
                ${t('emails:welcome.congratulations')}
              </p>

              <ul style="margin: 0 0 30px; padding-left: 20px; font-size: 16px; line-height: 1.8; color: #666666;">
                <li>${t('emails:welcome.feature1')}</li>
                <li>${t('emails:welcome.feature2')}</li>
                <li>${t('emails:welcome.feature3')}</li>
                <li>${t('emails:welcome.feature4')}</li>
              </ul>

              <!-- CTA Button -->
              <div style="text-align: center; margin-bottom: 30px;">
                <a href="https://etudesk.org/explore" style="display: inline-block; background-color: ${BRAND_PRIMARY}; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                  ${t('emails:welcome.exploreButton')}
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: ${BRAND_BG_SECONDARY}; border-radius: 0 0 12px 12px;">
              <p style="margin: 0 0 10px; font-size: 12px; color: #999999; text-align: center;">
                ${t('emails:welcome.copyright', { year })}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `.trim(),
      text: `
${t('emails:welcome.title')}

${t('emails:welcome.greeting', { name: displayName })}

${t('emails:welcome.congratulations')}
- ${t('emails:welcome.feature1')}
- ${t('emails:welcome.feature2')}
- ${t('emails:welcome.feature3')}
- ${t('emails:welcome.feature4')}

${t('emails:welcome.exploreButton')}: https://etudesk.com/explore

${t('emails:welcome.copyright', { year })}
      `.trim(),
    };
  },
};

// --- Email Functions ---

/**
 * Send OTP login email
 */
export async function sendOTPEmail(email: string, code: string, language: EmailLanguage = 'fr'): Promise<{ success: boolean; error?: string }> {
  const template = EmailTemplates.otpLogin(code, 10, language);
  return sendEmail({
    to: email,
    ...template,
  });
}

/**
 * Send welcome email after onboarding
 */
export async function sendWelcomeEmail(email: string, displayName: string, language: EmailLanguage = 'fr'): Promise<{ success: boolean; error?: string }> {
  const template = EmailTemplates.welcome(displayName, language);
  return sendEmail({
    to: email,
    ...template,
  });
}

/**
 * Send organization invitation email
 */
export async function sendOrganizationInviteEmail(
  email: string,
  organizationName: string,
  inviterName: string,
  role: string,
  token: string,
  language: EmailLanguage = 'fr'
): Promise<{ success: boolean; error?: string }> {
  const t = getT(language);
  const lang = language === 'en' ? 'en' : 'fr';
  const roleLabel = t(`emails:orgInvite.roles.${role}`) || role;
  const appUrl = process.env.APP_URL || 'https://etudesk.com';
  const inviteLink = `${appUrl}/invitation/${token}`;
  const year = new Date().getFullYear();

  const template = {
    subject: t('emails:orgInvite.subject', { inviter: inviterName, organization: organizationName }),
    html: `
<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t('emails:orgInvite.title')}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: ${BRAND_BG_LIGHT};">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 500px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">

          <!-- Logo -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <img src="${LOGO_URL}" alt="Etudesk" style="height: 36px; width: auto;" />
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 20px 40px;">
              <h1 style="margin: 0 0 24px; font-size: 22px; font-weight: 600; color: #1a1a1a; text-align: center;">
                ${t('emails:orgInvite.title')}
              </h1>

              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #4a4a4a; text-align: center;">
                ${t('emails:orgInvite.inviterInvites', { inviter: inviterName })}
              </p>

              <!-- Organization Card -->
              <div style="background-color: ${BRAND_BG_SECONDARY}; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
                <p style="margin: 0 0 8px; font-size: 20px; font-weight: 600; color: ${BRAND_PRIMARY};">
                  ${organizationName}
                </p>
                <p style="margin: 0; font-size: 14px; color: #6b7280;">
                  ${t('emails:orgInvite.asRole', { role: roleLabel })}
                </p>
              </div>

              <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.6; color: #6b7280; text-align: center;">
                ${t('emails:orgInvite.connectToAccept')}
              </p>

              <!-- CTA Button -->
              <div style="text-align: center; margin-bottom: 20px;">
                <a href="${inviteLink}" style="display: inline-block; background-color: ${BRAND_PRIMARY}; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                  ${t('emails:orgInvite.viewInvitation')}
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: ${BRAND_BG_SECONDARY}; border-radius: 0 0 12px 12px;">
              <p style="margin: 0 0 8px; font-size: 12px; color: #9ca3af; text-align: center;">
                ${t('emails:orgInvite.expiresIn')}
              </p>
              <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center;">
                ${t('emails:orgInvite.copyright', { year })}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim(),
    text: `
${t('emails:orgInvite.subject', { inviter: inviterName, organization: organizationName })}

${t('emails:orgInvite.asRole', { role: roleLabel })}.

${t('emails:orgInvite.connectToAccept')}
${inviteLink}

${t('emails:orgInvite.expiresIn')}

${t('emails:orgInvite.copyright', { year })}
    `.trim(),
  };

  return sendEmail({
    to: email,
    ...template,
  });
}

/**
 * Send community invitation email
 */
export async function sendCommunityInviteEmail(
  email: string,
  inviteeName: string | null,
  communityName: string,
  inviterName: string,
  role: string,
  message: string | null,
  invitationToken: string | null,
  language: EmailLanguage = 'fr'
): Promise<{ success: boolean; error?: string }> {
  const t = getT(language);
  const lang = language === 'en' ? 'en' : 'fr';
  const roleLabel = t(`emails:communityInvite.roles.${role}`) || role;
  const appUrl = process.env.APP_URL || 'https://etudesk.com';
  const inviteLink = invitationToken
    ? `${appUrl}/community-invitation/${invitationToken}`
    : `${appUrl}/invitations`;
  const year = new Date().getFullYear();

  const displayName = inviteeName || email.split('@')[0];

  const template = {
    subject: t('emails:communityInvite.subject', { inviter: inviterName, community: communityName }),
    html: `
<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t('emails:communityInvite.title')}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: ${BRAND_BG_LIGHT};">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 500px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">

          <!-- Logo -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <img src="${LOGO_URL}" alt="Etudesk" style="height: 36px; width: auto;" />
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 20px 40px;">
              <h1 style="margin: 0 0 24px; font-size: 22px; font-weight: 600; color: #1a1a1a; text-align: center;">
                ${t('emails:communityInvite.title')}
              </h1>

              <p style="margin: 0 0 10px; font-size: 16px; line-height: 1.6; color: #4a4a4a;">
                ${t('emails:communityInvite.greeting', { name: displayName })}
              </p>

              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #4a4a4a;">
                ${t('emails:communityInvite.inviterInvites', { inviter: inviterName })}
              </p>

              <!-- Community Card -->
              <div style="background-color: ${BRAND_BG_SECONDARY}; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
                <p style="margin: 0 0 8px; font-size: 20px; font-weight: 600; color: ${BRAND_PRIMARY};">
                  ${communityName}
                </p>
                <p style="margin: 0; font-size: 14px; color: #6b7280;">
                  ${t('emails:communityInvite.asRole', { role: roleLabel })}
                </p>
              </div>

              ${message ? `
              <div style="background-color: #F7F0E8; border-left: 4px solid ${BRAND_WARNING}; padding: 12px 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
                <p style="margin: 0; font-size: 14px; color: ${BRAND_GRAY}; font-style: italic;">
                  "${message}"
                </p>
              </div>
              ` : ''}

              <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.6; color: #6b7280; text-align: center;">
                ${t('emails:communityInvite.connectToAccept')}
              </p>

              <!-- CTA Button -->
              <div style="text-align: center; margin-bottom: 20px;">
                <a href="${inviteLink}" style="display: inline-block; background-color: ${BRAND_PRIMARY}; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                  ${t('emails:communityInvite.viewInvitation')}
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: ${BRAND_BG_SECONDARY}; border-radius: 0 0 12px 12px;">
              <p style="margin: 0 0 8px; font-size: 12px; color: #9ca3af; text-align: center;">
                ${t('emails:communityInvite.expiresIn')}
              </p>
              <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center;">
                ${t('emails:communityInvite.copyright', { year })}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim(),
    text: `
${t('emails:communityInvite.greeting', { name: displayName })}

${t('emails:communityInvite.inviterInvites', { inviter: inviterName })} "${communityName}"

${t('emails:communityInvite.asRole', { role: roleLabel })}.
${message ? `\nMessage: "${message}"\n` : ''}
${t('emails:communityInvite.connectToAccept')}
${inviteLink}

${t('emails:communityInvite.expiresIn')}

${t('emails:communityInvite.copyright', { year })}
    `.trim(),
  };

  return sendEmail({
    to: email,
    ...template,
  });
}

/**
 * Send space invitation email
 */
export async function sendSpaceInviteEmail(
  email: string,
  inviteeName: string | null,
  spaceName: string,
  inviterName: string,
  message: string | null,
  invitationToken: string,
  language: EmailLanguage = 'fr'
): Promise<{ success: boolean; error?: string }> {
  const t = getT(language);
  const lang = language === 'en' ? 'en' : 'fr';
  const appUrl = process.env.APP_URL || 'https://etudesk.com';
  const inviteLink = `${appUrl}/space-invitation/${invitationToken}`;
  const displayName = inviteeName || email.split('@')[0];

  const template = {
    subject: t('emails:spaceInvite.subject', { inviter: inviterName, space: spaceName }),
    html: `
<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: ${BRAND_BG_LIGHT};">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 500px; background-color: #ffffff; border-radius: 12px;">
          <tr><td style="padding: 40px 40px 20px; text-align: center;">
            <img src="${LOGO_URL}" alt="Etudesk" style="height: 36px;" />
          </td></tr>
          <tr><td style="padding: 20px 40px;">
            <h1 style="margin: 0 0 24px; font-size: 22px; text-align: center; color: #1a1a1a;">${t('emails:spaceInvite.title')}</h1>
            <p style="margin: 0 0 10px; font-size: 16px; color: #4a4a4a;">${t('emails:spaceInvite.greeting', { name: displayName })}</p>
            <p style="margin: 0 0 20px; font-size: 16px; color: #4a4a4a;">${t('emails:spaceInvite.inviterInvites', { inviter: inviterName })}</p>
            <div style="background-color: ${BRAND_BG_SECONDARY}; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
              <p style="margin: 0; font-size: 20px; font-weight: 600; color: ${BRAND_PRIMARY};">${spaceName}</p>
            </div>
            ${message ? `<div style="background-color: #F7F0E8; border-left: 4px solid ${BRAND_WARNING}; padding: 12px 16px; margin-bottom: 24px;"><p style="margin: 0; font-size: 14px; color: ${BRAND_GRAY}; font-style: italic;">"${message}"</p></div>` : ''}
            <div style="text-align: center; margin-bottom: 20px;">
              <a href="${inviteLink}" style="display: inline-block; background-color: ${BRAND_PRIMARY}; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">${t('emails:spaceInvite.viewInvitation')}</a>
            </div>
          </td></tr>
          <tr><td style="padding: 24px 40px; background-color: ${BRAND_BG_SECONDARY}; border-radius: 0 0 12px 12px;">
            <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center;">${t('emails:spaceInvite.expiresIn')}</p>
          </td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim(),
    text: `${t('emails:spaceInvite.greeting', { name: displayName })}\n\n${t('emails:spaceInvite.inviterInvites', { inviter: inviterName })} "${spaceName}".\n${message ? `Message: "${message}"\n` : ''}\n${t('emails:spaceInvite.viewInvitation')}: ${inviteLink}\n\n${t('emails:spaceInvite.expiresIn')}`.trim(),
  };

  return sendEmail({ to: email, ...template });
}

/**
 * Send opportunity invitation email
 */
export async function sendOpportunityInviteEmail(
  email: string,
  inviteeName: string | null,
  opportunityTitle: string,
  organizationName: string,
  inviterName: string,
  message: string | null,
  invitationToken: string,
  language: EmailLanguage = 'fr'
): Promise<{ success: boolean; error?: string }> {
  const t = getT(language);
  const lang = language === 'en' ? 'en' : 'fr';
  const appUrl = process.env.APP_URL || 'https://etudesk.com';
  const inviteLink = `${appUrl}/opportunity-invitation/${invitationToken}`;
  const displayName = inviteeName || email.split('@')[0];

  const template = {
    subject: t('emails:opportunityInvite.subject', { inviter: inviterName, opportunity: opportunityTitle }),
    html: `
<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: ${BRAND_BG_LIGHT};">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 500px; background-color: #ffffff; border-radius: 12px;">
          <tr><td style="padding: 40px 40px 20px; text-align: center;">
            <img src="${LOGO_URL}" alt="Etudesk" style="height: 36px;" />
          </td></tr>
          <tr><td style="padding: 20px 40px;">
            <h1 style="margin: 0 0 24px; font-size: 22px; text-align: center; color: #1a1a1a;">${t('emails:opportunityInvite.title')}</h1>
            <p style="margin: 0 0 10px; font-size: 16px; color: #4a4a4a;">${t('emails:opportunityInvite.greeting', { name: displayName })}</p>
            <p style="margin: 0 0 20px; font-size: 16px; color: #4a4a4a;">${t('emails:opportunityInvite.inviterInvites', { inviter: inviterName, organization: organizationName })}</p>
            <div style="background-color: ${BRAND_BG_SECONDARY}; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
              <p style="margin: 0; font-size: 20px; font-weight: 600; color: ${BRAND_PRIMARY};">${opportunityTitle}</p>
              <p style="margin: 8px 0 0; font-size: 14px; color: #6b7280;">${organizationName}</p>
            </div>
            ${message ? `<div style="background-color: #F7F0E8; border-left: 4px solid ${BRAND_WARNING}; padding: 12px 16px; margin-bottom: 24px;"><p style="margin: 0; font-size: 14px; color: ${BRAND_GRAY}; font-style: italic;">"${message}"</p></div>` : ''}
            <div style="text-align: center; margin-bottom: 20px;">
              <a href="${inviteLink}" style="display: inline-block; background-color: ${BRAND_PRIMARY}; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">${t('emails:opportunityInvite.viewOpportunity')}</a>
            </div>
          </td></tr>
          <tr><td style="padding: 24px 40px; background-color: ${BRAND_BG_SECONDARY}; border-radius: 0 0 12px 12px;">
            <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center;">${t('emails:opportunityInvite.expiresIn')}</p>
          </td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim(),
    text: `${t('emails:opportunityInvite.greeting', { name: displayName })}\n\n${t('emails:opportunityInvite.inviterInvites', { inviter: inviterName, organization: organizationName })} "${opportunityTitle}".\n${message ? `Message: "${message}"\n` : ''}\n${t('emails:opportunityInvite.viewOpportunity')}: ${inviteLink}\n\n${t('emails:opportunityInvite.expiresIn')}`.trim(),
  };

  return sendEmail({ to: email, ...template });
}

// --- Health Check ---

/**
 * Verify email connection (health check)
 */
export async function verifyEmailConnection(): Promise<boolean> {
  try {
    if (EMAIL_PROVIDER === 'resend') {
      // Resend doesn't have a verify endpoint, just check if API key is set
      if (!resendClient) {
        logger.error('❌ Resend API key not configured');
        return false;
      }
      logger.info('✅ Resend email service ready');
      return true;
    } else {
      // SMTP verification
      await smtpTransporter.verify();
      logger.info('✅ SMTP email service connected');
      return true;
    }
  } catch (error) {
    logger.error('❌ Email service connection failed:', error);
    return false;
  }
}
