/**
 * Email Service
 *
 * Uses Nodemailer with Mailhog for development
 * Production-ready: just update SMTP settings for production
 */

import nodemailer from 'nodemailer';
import type Mail from 'nodemailer/lib/mailer';

// Email configuration
const EMAIL_CONFIG = {
  // Mailhog defaults (development)
  host: process.env.SMTP_HOST || 'localhost',
  port: parseInt(process.env.SMTP_PORT || '1025', 10),
  secure: process.env.SMTP_SECURE === 'true',
  // Auth (optional for Mailhog, required for production)
  auth: process.env.SMTP_USER ? {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  } : undefined,
};

// Create transporter
const transporter = nodemailer.createTransport(EMAIL_CONFIG);

// Default sender
const DEFAULT_FROM = process.env.EMAIL_FROM || 'Etudesk <noreply@etudesk.com>';

// Brand colors
const BRAND_BLUE = '#26449F';
const BRAND_BLUE_LIGHT = '#3a5bc7';

// Email templates
export const EmailTemplates = {
  /**
   * OTP Login Email Template - Minimalist Design
   */
  otpLogin: (code: string, expiresInMinutes: number = 10): { subject: string; html: string; text: string } => ({
    subject: `${code} - Code de connexion`,
    html: `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Code de connexion</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #ffffff;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 48px 24px;">
        <table role="presentation" style="width: 100%; max-width: 400px; border-collapse: collapse;">

          <!-- Logo -->
          <tr>
            <td style="padding-bottom: 40px; text-align: center;">
              <img src="https://etudesk.com/etudesk_logo_blue.png" alt="Etudesk" style="height: 32px; width: auto;" />
            </td>
          </tr>

          <!-- Code Section -->
          <tr>
            <td style="text-align: center;">
              <p style="margin: 0 0 24px; font-size: 15px; color: #6b7280;">
                Votre code de connexion
              </p>

              <!-- OTP Code -->
              <div style="margin-bottom: 24px;">
                <span style="font-family: 'SF Mono', 'Roboto Mono', monospace; font-size: 32px; font-weight: 600; letter-spacing: 6px; color: ${BRAND_BLUE};">
                  ${code}
                </span>
              </div>

              <p style="margin: 0 0 40px; font-size: 13px; color: #9ca3af;">
                Valide ${expiresInMinutes} min
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
                Ne partagez jamais ce code
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
Code de connexion Etudesk: ${code}

Valide ${expiresInMinutes} minutes.

Ne partagez jamais ce code.
    `.trim(),
  }),

  /**
   * Welcome Email Template (after onboarding)
   */
  welcome: (displayName: string): { subject: string; html: string; text: string } => ({
    subject: `Bienvenue sur Etudesk, ${displayName}! 🎉`,
    html: `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bienvenue sur Etudesk</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <img src="https://etudesk.com/etudesk_logo_blue.png" alt="Etudesk" style="height: 40px; width: auto;" />
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 20px 40px;">
              <h1 style="margin: 0 0 20px; font-size: 28px; font-weight: 600; color: #1a1a1a; text-align: center;">
                Bienvenue sur Etudesk! 🎉
              </h1>
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #666666;">
                Bonjour <strong>${displayName}</strong>,
              </p>
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #666666;">
                Félicitations! Votre profil talent est maintenant créé sur Etudesk. Vous pouvez désormais:
              </p>

              <ul style="margin: 0 0 30px; padding-left: 20px; font-size: 16px; line-height: 1.8; color: #666666;">
                <li>Découvrir des opportunités d'emploi, stages et missions</li>
                <li>Rejoindre des communautés de professionnels</li>
                <li>Trouver des espaces de coworking et incubateurs</li>
                <li>Développer votre réseau professionnel</li>
              </ul>

              <!-- CTA Button -->
              <div style="text-align: center; margin-bottom: 30px;">
                <a href="https://etudesk.com/explore" style="display: inline-block; background-color: #E63946; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                  Explorer Etudesk
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f8f9fa; border-radius: 0 0 12px 12px;">
              <p style="margin: 0 0 10px; font-size: 12px; color: #999999; text-align: center;">
                © ${new Date().getFullYear()} Etudesk. Tous droits réservés.
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
Bienvenue sur Etudesk, ${displayName}!

Félicitations! Votre profil talent est maintenant créé sur Etudesk.

Vous pouvez désormais:
- Découvrir des opportunités d'emploi, stages et missions
- Rejoindre des communautés de professionnels
- Trouver des espaces de coworking et incubateurs
- Développer votre réseau professionnel

Explorez Etudesk: https://etudesk.com/explore

© ${new Date().getFullYear()} Etudesk. Tous droits réservés.
    `.trim(),
  }),
};

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

/**
 * Send an email
 */
export async function sendEmail(options: SendEmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const mailOptions: Mail.Options = {
      from: options.from || DEFAULT_FROM,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    };

    const info = await transporter.sendMail(mailOptions);

    console.log(`📧 Email sent to ${options.to}: ${info.messageId}`);

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error('❌ Failed to send email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send OTP login email
 */
export async function sendOTPEmail(email: string, code: string): Promise<{ success: boolean; error?: string }> {
  const template = EmailTemplates.otpLogin(code);
  return sendEmail({
    to: email,
    ...template,
  });
}

/**
 * Send welcome email after onboarding
 */
export async function sendWelcomeEmail(email: string, displayName: string): Promise<{ success: boolean; error?: string }> {
  const template = EmailTemplates.welcome(displayName);
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
  token: string
): Promise<{ success: boolean; error?: string }> {
  const roleLabels: Record<string, string> = {
    OWNER: 'Propriétaire',
    ADMIN: 'Administrateur',
    MANAGER: 'Manager',
    OBSERVATEUR: 'Observateur',
  };
  const roleLabel = roleLabels[role] || role;
  const appUrl = process.env.APP_URL || 'https://etudesk.com';
  const inviteLink = `${appUrl}/invitation/${token}`;

  const template = {
    subject: `${inviterName} vous invite à rejoindre ${organizationName} sur Etudesk`,
    html: `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invitation à rejoindre ${organizationName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 500px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">

          <!-- Logo -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <img src="https://etudesk.com/etudesk_logo_blue.png" alt="Etudesk" style="height: 36px; width: auto;" />
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 20px 40px;">
              <h1 style="margin: 0 0 24px; font-size: 22px; font-weight: 600; color: #1a1a1a; text-align: center;">
                Vous êtes invité(e)!
              </h1>

              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #4a4a4a; text-align: center;">
                <strong>${inviterName}</strong> vous invite à rejoindre l'organisation
              </p>

              <!-- Organization Card -->
              <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
                <p style="margin: 0 0 8px; font-size: 20px; font-weight: 600; color: ${BRAND_BLUE};">
                  ${organizationName}
                </p>
                <p style="margin: 0; font-size: 14px; color: #6b7280;">
                  en tant que <strong>${roleLabel}</strong>
                </p>
              </div>

              <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.6; color: #6b7280; text-align: center;">
                Connectez-vous à Etudesk pour accepter cette invitation et commencer à collaborer.
              </p>

              <!-- CTA Button -->
              <div style="text-align: center; margin-bottom: 20px;">
                <a href="${inviteLink}" style="display: inline-block; background-color: ${BRAND_BLUE}; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                  Voir l'invitation
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #f8f9fa; border-radius: 0 0 12px 12px;">
              <p style="margin: 0 0 8px; font-size: 12px; color: #9ca3af; text-align: center;">
                Cette invitation expire dans 7 jours.
              </p>
              <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center;">
                © ${new Date().getFullYear()} Etudesk. Tous droits réservés.
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
${inviterName} vous invite à rejoindre ${organizationName} sur Etudesk!

Vous êtes invité(e) en tant que ${roleLabel}.

Connectez-vous à Etudesk pour accepter cette invitation:
${inviteLink}

Cette invitation expire dans 7 jours.

© ${new Date().getFullYear()} Etudesk. Tous droits réservés.
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
  invitationToken: string | null
): Promise<{ success: boolean; error?: string }> {
  const roleLabels: Record<string, string> = {
    ADMIN: 'Administrateur',
    MEMBER: 'Membre',
  };
  const roleLabel = roleLabels[role] || 'Membre';
  const appUrl = process.env.APP_URL || 'https://etudesk.com';
  const inviteLink = invitationToken
    ? `${appUrl}/community-invitation/${invitationToken}`
    : `${appUrl}/invitations`;

  const displayName = inviteeName || email.split('@')[0];

  const template = {
    subject: `${inviterName} vous invite à rejoindre ${communityName}`,
    html: `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invitation à rejoindre ${communityName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 500px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">

          <!-- Logo -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <img src="https://etudesk.com/etudesk_logo_blue.png" alt="Etudesk" style="height: 36px; width: auto;" />
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 20px 40px;">
              <h1 style="margin: 0 0 24px; font-size: 22px; font-weight: 600; color: #1a1a1a; text-align: center;">
                Vous êtes invité(e)!
              </h1>

              <p style="margin: 0 0 10px; font-size: 16px; line-height: 1.6; color: #4a4a4a;">
                Bonjour <strong>${displayName}</strong>,
              </p>

              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #4a4a4a;">
                <strong>${inviterName}</strong> vous invite à rejoindre la communauté
              </p>

              <!-- Community Card -->
              <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
                <p style="margin: 0 0 8px; font-size: 20px; font-weight: 600; color: ${BRAND_BLUE};">
                  ${communityName}
                </p>
                <p style="margin: 0; font-size: 14px; color: #6b7280;">
                  en tant que <strong>${roleLabel}</strong>
                </p>
              </div>

              ${message ? `
              <div style="background-color: #fefce8; border-left: 4px solid #facc15; padding: 12px 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
                <p style="margin: 0; font-size: 14px; color: #713f12; font-style: italic;">
                  "${message}"
                </p>
              </div>
              ` : ''}

              <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.6; color: #6b7280; text-align: center;">
                Connectez-vous à Etudesk pour accepter cette invitation et rejoindre la communauté.
              </p>

              <!-- CTA Button -->
              <div style="text-align: center; margin-bottom: 20px;">
                <a href="${inviteLink}" style="display: inline-block; background-color: ${BRAND_BLUE}; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                  Voir l'invitation
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #f8f9fa; border-radius: 0 0 12px 12px;">
              <p style="margin: 0 0 8px; font-size: 12px; color: #9ca3af; text-align: center;">
                Cette invitation expire dans 7 jours.
              </p>
              <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center;">
                © ${new Date().getFullYear()} Etudesk. Tous droits réservés.
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
Bonjour ${displayName},

${inviterName} vous invite à rejoindre la communauté "${communityName}" sur Etudesk!

Vous êtes invité(e) en tant que ${roleLabel}.
${message ? `\nMessage: "${message}"\n` : ''}
Connectez-vous à Etudesk pour accepter cette invitation:
${inviteLink}

Cette invitation expire dans 7 jours.

© ${new Date().getFullYear()} Etudesk. Tous droits réservés.
    `.trim(),
  };

  return sendEmail({
    to: email,
    ...template,
  });
}

/**
 * Verify email connection (health check)
 */
export async function verifyEmailConnection(): Promise<boolean> {
  try {
    await transporter.verify();
    console.log('✅ Email service connected');
    return true;
  } catch (error) {
    console.error('❌ Email service connection failed:', error);
    return false;
  }
}
