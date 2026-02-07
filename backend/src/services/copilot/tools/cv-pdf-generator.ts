/**
 * CV PDF Generator — Ultra-elegant, minimal CV with Etudesk Light Theme
 * Professional two-column layout inspired by luxury African minimalism
 * Color palette: Etudesk warm brown (#3B2416) + neutral grays
 */

import PDFDocument from 'pdfkit';
import { getFileBuffer } from '../../storage.service';
import { logger } from '../../../utils';

// ═══════════════════════════════════════════════════════════════
// ETUDESK DESIGN TOKENS — Light Theme
// ═══════════════════════════════════════════════════════════════

const C = {
  primary: '#3B2416',
  primaryLight: '#5C3D2E',
  primaryMuted: '#8B7355',
  accent: '#A67C52',
  textPrimary: '#1F1C18',
  textSecondary: '#6E675C',
  textTertiary: '#918A7E',
  background: '#FFFFFF',
  surface: '#FAF9F7',
  surfaceAlt: '#F5F3F0',
  border: '#E8E4DF',
  borderLight: '#EBE8E4',
  white: '#FFFFFF',
  success: '#4A6741',
};

const F = {
  regular: 'Helvetica',
  bold: 'Helvetica-Bold',
  oblique: 'Helvetica-Oblique',
  boldOblique: 'Helvetica-BoldOblique',
};

const PAGE = {
  width: 595.28,   // A4
  height: 841.89,  // A4
  margin: 0,       // Full bleed — we control layout manually
};

// Layout constants
const SIDEBAR_WIDTH = 195;
const SIDEBAR_PADDING = 24;
const MAIN_PADDING_LEFT = 28;
const MAIN_PADDING_RIGHT = 36;
const HEADER_HEIGHT = 140;
const FOOTER_HEIGHT = 30;

// Derived
const MAIN_X = SIDEBAR_WIDTH + MAIN_PADDING_LEFT;
const MAIN_WIDTH = PAGE.width - SIDEBAR_WIDTH - MAIN_PADDING_LEFT - MAIN_PADDING_RIGHT;
const SIDEBAR_CONTENT_X = SIDEBAR_PADDING;
const SIDEBAR_CONTENT_WIDTH = SIDEBAR_WIDTH - SIDEBAR_PADDING * 2;

// ═══════════════════════════════════════════════════════════════
// CV DATA STRUCTURE
// ═══════════════════════════════════════════════════════════════

export interface CVData {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  city?: string;
  country?: string;
  bio?: string;
  avatarUrl?: string;

  skills: Array<{ name: string; type?: string; level?: string }>;
  languages?: Array<{ language: string; level: string }>;
  interests?: string[];
  goals?: string[];

  experiences?: Array<{
    title: string;
    company: string;
    location?: string;
    period: string;
    description?: string;
  }>;
  education?: Array<{
    degree: string;
    institution: string;
    location?: string;
    period: string;
    description?: string;
  }>;
  certifications?: Array<{
    name: string;
    issuer?: string;
    date?: string;
  }>;
  other?: Array<{
    heading: string;
    content: string;
  }>;
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function skillLevelToPercent(level?: string): number {
  const map: Record<string, number> = {
    expert: 0.95, master: 0.95,
    advanced: 0.80, avance: 0.80,
    intermediate: 0.60, intermediaire: 0.60,
    beginner: 0.35, debutant: 0.35,
  };
  return map[level?.toLowerCase()?.normalize('NFD').replace(/[\u0300-\u036f]/g, '') || ''] || 0.5;
}

function formatLevel(level?: string): string {
  const map: Record<string, string> = {
    expert: 'Expert', master: 'Expert',
    advanced: 'Avance', avance: 'Avance',
    intermediate: 'Intermediaire', intermediaire: 'Intermediaire',
    beginner: 'Debutant', debutant: 'Debutant',
  };
  return map[level?.toLowerCase()?.normalize('NFD').replace(/[\u0300-\u036f]/g, '') || ''] || '';
}

function langLevel(level?: string): string {
  const map: Record<string, string> = {
    native: 'Natif', fluent: 'Courant',
    conversational: 'Conversationnel', basic: 'Elementaire',
    c2: 'Natif (C2)', c1: 'Courant (C1)', b2: 'Avance (B2)',
    b1: 'Intermediaire (B1)', a2: 'Elementaire (A2)', a1: 'Decouverte (A1)',
  };
  return map[level?.toLowerCase() || ''] || level || '';
}

/** Draw a section title with minimal accent line */
function sectionTitle(
  doc: PDFKit.PDFDocument,
  title: string,
  x: number,
  y: number,
  maxWidth: number,
  options?: { color?: string; lineColor?: string }
): number {
  const color = options?.color || C.primary;
  const lineColor = options?.lineColor || C.accent;

  doc.fontSize(9.5).font(F.bold).fillColor(color);
  doc.text(title.toUpperCase(), x, y, { width: maxWidth, characterSpacing: 1.5 });
  const h = doc.heightOfString(title.toUpperCase(), { width: maxWidth, characterSpacing: 1.5 });
  const lineY = y + h + 4;
  doc.moveTo(x, lineY).lineTo(x + Math.min(40, maxWidth), lineY)
    .lineWidth(1.5).strokeColor(lineColor).stroke();
  return lineY + 10;
}

/** Draw sidebar section title — white text, amber underline */
function sidebarSectionTitle(doc: PDFKit.PDFDocument, title: string, y: number): number {
  return sectionTitle(doc, title, SIDEBAR_CONTENT_X, y, SIDEBAR_CONTENT_WIDTH, {
    color: C.white,
    lineColor: C.accent,
  });
}

/** Check if we need a new page in the main column */
function needsNewPage(_doc: PDFKit.PDFDocument, neededHeight: number, currentY: number): boolean {
  return currentY + neededHeight > PAGE.height - FOOTER_HEIGHT - 20;
}

/** Add a new page and draw the sidebar background */
function addPageWithSidebar(doc: PDFKit.PDFDocument): void {
  doc.addPage({ size: 'A4', margin: 0 });
  // Sidebar background on new page
  doc.rect(0, 0, SIDEBAR_WIDTH, PAGE.height).fillColor(C.primary).fill();
}

// ═══════════════════════════════════════════════════════════════
// MAIN CV GENERATOR
// ═══════════════════════════════════════════════════════════════

export async function generateCVPDF(cvData: CVData): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 0,
        bufferPages: true,
        info: {
          Title: `CV - ${cvData.firstName} ${cvData.lastName}`,
          Author: 'Etudesk',
          Creator: 'Etudesk Copilot',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // ─────────────────────────────────────────────────────────
      // SIDEBAR BACKGROUND (full page height, left column)
      // ─────────────────────────────────────────────────────────
      doc.rect(0, 0, SIDEBAR_WIDTH, PAGE.height).fillColor(C.primary).fill();

      // ─────────────────────────────────────────────────────────
      // HEADER AREA — Avatar + Name + Contact
      // ─────────────────────────────────────────────────────────

      // Subtle header background on main area
      doc.rect(SIDEBAR_WIDTH, 0, PAGE.width - SIDEBAR_WIDTH, HEADER_HEIGHT)
        .fillColor(C.surface).fill();

      // Avatar in sidebar header
      const avatarSize = 80;
      const avatarX = (SIDEBAR_WIDTH - avatarSize) / 2;
      const avatarY = 30;

      let avatarLoaded = false;
      if (cvData.avatarUrl) {
        try {
          const avatarBuffer = await getFileBuffer(cvData.avatarUrl);
          if (avatarBuffer && avatarBuffer.length > 0) {
            doc.save();
            doc.circle(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2).clip();
            doc.image(avatarBuffer, avatarX, avatarY, {
              width: avatarSize,
              height: avatarSize,
              fit: [avatarSize, avatarSize],
              align: 'center',
              valign: 'center',
            });
            doc.restore();
            avatarLoaded = true;
          }
        } catch (err: any) {
          logger.warn(`[cv-pdf] Could not load avatar: ${err.message}`);
        }
      }

      // If no avatar, show initials circle
      if (!avatarLoaded) {
        const cx = avatarX + avatarSize / 2;
        const cy = avatarY + avatarSize / 2;
        doc.circle(cx, cy, avatarSize / 2).fillColor(C.primaryLight).fill();
        const initials = `${(cvData.firstName?.[0] || '').toUpperCase()}${(cvData.lastName?.[0] || '').toUpperCase()}`;
        doc.fontSize(28).font(F.bold).fillColor(C.white);
        const initialsWidth = doc.widthOfString(initials);
        doc.text(initials, cx - initialsWidth / 2, cy - 12, { lineBreak: false });
      }

      // Name in main header area
      const nameX = MAIN_X;
      const nameY = 32;
      doc.fontSize(24).font(F.bold).fillColor(C.primary);
      doc.text(cvData.firstName.toUpperCase(), nameX, nameY, { width: MAIN_WIDTH, continued: false });
      const firstNameH = doc.heightOfString(cvData.firstName.toUpperCase(), { width: MAIN_WIDTH });
      doc.fontSize(24).font(F.regular).fillColor(C.primaryLight);
      doc.text(cvData.lastName.toUpperCase(), nameX, nameY + firstNameH + 2, {
        width: MAIN_WIDTH,
        characterSpacing: 2,
      });

      // Thin accent line separating header from content
      const headerLineY = HEADER_HEIGHT - 0.5;
      doc.moveTo(SIDEBAR_WIDTH, headerLineY).lineTo(PAGE.width, headerLineY)
        .lineWidth(0.5).strokeColor(C.border).stroke();

      // ─────────────────────────────────────────────────────────
      // SIDEBAR CONTENT (below avatar)
      // ─────────────────────────────────────────────────────────

      let sideY = avatarLoaded || !cvData.avatarUrl ? avatarY + avatarSize + 24 : avatarY + avatarSize + 24;

      // --- CONTACT DETAILS in sidebar ---
      sideY = sidebarSectionTitle(doc, 'Contact', sideY);

      const contactItems: Array<{ label: string; value: string }> = [];
      if (cvData.email) contactItems.push({ label: 'Email', value: cvData.email });
      if (cvData.phone) contactItems.push({ label: 'Tel', value: cvData.phone });
      const loc = [cvData.city, cvData.country].filter(Boolean).join(', ');
      if (loc) contactItems.push({ label: 'Lieu', value: loc });

      for (const item of contactItems) {
        doc.fontSize(7).font(F.bold).fillColor(C.accent);
        doc.text(item.label.toUpperCase(), SIDEBAR_CONTENT_X, sideY, { width: SIDEBAR_CONTENT_WIDTH });
        sideY += 10;
        doc.fontSize(8).font(F.regular).fillColor(C.white);
        doc.text(item.value, SIDEBAR_CONTENT_X, sideY, { width: SIDEBAR_CONTENT_WIDTH });
        sideY += doc.heightOfString(item.value, { width: SIDEBAR_CONTENT_WIDTH }) + 8;
      }
      sideY += 6;

      // --- SKILLS (Top 10) ---
      const topSkills = cvData.skills.slice(0, 10);
      if (topSkills.length > 0) {
        sideY = sidebarSectionTitle(doc, 'Competences', sideY);

        for (const skill of topSkills) {
          // Skill name
          doc.fontSize(7.5).font(F.regular).fillColor(C.white);
          doc.text(skill.name, SIDEBAR_CONTENT_X, sideY, { width: SIDEBAR_CONTENT_WIDTH });
          const nameH = doc.heightOfString(skill.name, { width: SIDEBAR_CONTENT_WIDTH });

          // Progress bar
          const barY = sideY + nameH + 2;
          const barWidth = SIDEBAR_CONTENT_WIDTH;
          const barHeight = 3;
          const fillPercent = skillLevelToPercent(skill.level);

          // Background track
          doc.roundedRect(SIDEBAR_CONTENT_X, barY, barWidth, barHeight, 1.5)
            .fillColor(C.primaryLight).fill();
          // Filled portion
          if (fillPercent > 0) {
            doc.roundedRect(SIDEBAR_CONTENT_X, barY, barWidth * fillPercent, barHeight, 1.5)
              .fillColor(C.accent).fill();
          }

          // Level label (right-aligned, subtle)
          const levelStr = formatLevel(skill.level);
          if (levelStr) {
            doc.fontSize(6).font(F.oblique).fillColor(C.primaryMuted);
            const labelW = doc.widthOfString(levelStr);
            doc.text(levelStr, SIDEBAR_CONTENT_X + barWidth - labelW, barY + barHeight + 2, {
              width: labelW + 2,
              lineBreak: false,
            });
          }

          sideY = barY + barHeight + (levelStr ? 12 : 8);
        }
        sideY += 6;
      }

      // --- LANGUAGES ---
      if (cvData.languages && cvData.languages.length > 0) {
        sideY = sidebarSectionTitle(doc, 'Langues', sideY);

        for (const lang of cvData.languages) {
          doc.fontSize(8).font(F.regular).fillColor(C.white);
          doc.text(lang.language, SIDEBAR_CONTENT_X, sideY, { width: SIDEBAR_CONTENT_WIDTH });
          const langH = doc.heightOfString(lang.language, { width: SIDEBAR_CONTENT_WIDTH });

          const levelText = langLevel(lang.level);
          if (levelText) {
            doc.fontSize(7).font(F.oblique).fillColor(C.primaryMuted);
            doc.text(levelText, SIDEBAR_CONTENT_X, sideY + langH + 1, { width: SIDEBAR_CONTENT_WIDTH });
            sideY += langH + 14;
          } else {
            sideY += langH + 6;
          }
        }
        sideY += 6;
      }

      // --- INTERESTS ---
      if (cvData.interests && cvData.interests.length > 0) {
        sideY = sidebarSectionTitle(doc, 'Interets', sideY);
        for (const interest of cvData.interests) {
          doc.fontSize(7.5).font(F.regular).fillColor(C.white);
          const text = `  ${interest}`;
          // Small dot
          doc.circle(SIDEBAR_CONTENT_X + 3, sideY + 4, 1.5).fillColor(C.accent).fill();
          doc.text(text, SIDEBAR_CONTENT_X + 8, sideY, { width: SIDEBAR_CONTENT_WIDTH - 8 });
          sideY += doc.heightOfString(text, { width: SIDEBAR_CONTENT_WIDTH - 8 }) + 4;
        }
        sideY += 6;
      }

      // --- GOALS ---
      if (cvData.goals && cvData.goals.length > 0) {
        sideY = sidebarSectionTitle(doc, 'Objectifs', sideY);
        for (const goal of cvData.goals) {
          doc.fontSize(7.5).font(F.regular).fillColor(C.white);
          doc.circle(SIDEBAR_CONTENT_X + 3, sideY + 4, 1.5).fillColor(C.accent).fill();
          doc.text(goal, SIDEBAR_CONTENT_X + 8, sideY, { width: SIDEBAR_CONTENT_WIDTH - 8 });
          sideY += doc.heightOfString(goal, { width: SIDEBAR_CONTENT_WIDTH - 8 }) + 4;
        }
      }

      // ─────────────────────────────────────────────────────────
      // MAIN CONTENT — Right column
      // ─────────────────────────────────────────────────────────

      let mainY = HEADER_HEIGHT + 18;

      // --- BIO / PROFIL ---
      if (cvData.bio) {
        mainY = sectionTitle(doc, 'Profil', MAIN_X, mainY, MAIN_WIDTH);
        doc.fontSize(9).font(F.regular).fillColor(C.textSecondary);
        doc.text(cvData.bio, MAIN_X, mainY, { width: MAIN_WIDTH, lineGap: 3 });
        mainY += doc.heightOfString(cvData.bio, { width: MAIN_WIDTH, lineGap: 3 }) + 18;
      }

      // --- EXPERIENCE PROFESSIONNELLE ---
      if (cvData.experiences && cvData.experiences.length > 0) {
        if (needsNewPage(doc, 80, mainY)) {
          addPageWithSidebar(doc);
          mainY = 36;
        }
        mainY = sectionTitle(doc, 'Experience Professionnelle', MAIN_X, mainY, MAIN_WIDTH);

        for (let i = 0; i < cvData.experiences.length; i++) {
          const exp = cvData.experiences[i];
          const estimatedH = 60 + (exp.description ? 30 : 0);
          if (needsNewPage(doc, estimatedH, mainY)) {
            addPageWithSidebar(doc);
            mainY = 36;
          }

          // Timeline dot
          const dotX = MAIN_X - 14;
          const dotY = mainY + 5;
          doc.circle(dotX, dotY, 3).fillColor(C.accent).fill();
          doc.circle(dotX, dotY, 3).lineWidth(1).strokeColor(C.primary).stroke();

          // Timeline line (connecting dots, except for last item)
          if (i < cvData.experiences.length - 1) {
            doc.moveTo(dotX, dotY + 4).lineTo(dotX, dotY + estimatedH - 5)
              .lineWidth(0.5).strokeColor(C.border).stroke();
          }

          // Title
          doc.fontSize(10).font(F.bold).fillColor(C.textPrimary);
          doc.text(exp.title, MAIN_X, mainY, { width: MAIN_WIDTH });
          mainY += doc.heightOfString(exp.title, { width: MAIN_WIDTH }) + 2;

          // Company + location
          const companyLine = [exp.company, exp.location].filter(Boolean).join(' - ');
          doc.fontSize(8.5).font(F.bold).fillColor(C.accent);
          doc.text(companyLine, MAIN_X, mainY, { width: MAIN_WIDTH });
          mainY += doc.heightOfString(companyLine, { width: MAIN_WIDTH }) + 2;

          // Period
          doc.fontSize(8).font(F.oblique).fillColor(C.textTertiary);
          doc.text(exp.period, MAIN_X, mainY, { width: MAIN_WIDTH });
          mainY += doc.heightOfString(exp.period, { width: MAIN_WIDTH }) + 4;

          // Description
          if (exp.description) {
            doc.fontSize(8.5).font(F.regular).fillColor(C.textSecondary);
            doc.text(exp.description, MAIN_X, mainY, { width: MAIN_WIDTH, lineGap: 2 });
            mainY += doc.heightOfString(exp.description, { width: MAIN_WIDTH, lineGap: 2 }) + 4;
          }

          mainY += 12;
        }
      }

      // --- FORMATION ---
      if (cvData.education && cvData.education.length > 0) {
        if (needsNewPage(doc, 70, mainY)) {
          addPageWithSidebar(doc);
          mainY = 36;
        }
        mainY = sectionTitle(doc, 'Formation', MAIN_X, mainY, MAIN_WIDTH);

        for (let i = 0; i < cvData.education.length; i++) {
          const edu = cvData.education[i];
          const estimatedH = 55 + (edu.description ? 25 : 0);
          if (needsNewPage(doc, estimatedH, mainY)) {
            addPageWithSidebar(doc);
            mainY = 36;
          }

          // Timeline dot
          const dotX = MAIN_X - 14;
          const dotY = mainY + 5;
          doc.circle(dotX, dotY, 3).fillColor(C.success).fill();
          doc.circle(dotX, dotY, 3).lineWidth(1).strokeColor(C.primary).stroke();

          if (i < cvData.education.length - 1) {
            doc.moveTo(dotX, dotY + 4).lineTo(dotX, dotY + estimatedH - 5)
              .lineWidth(0.5).strokeColor(C.border).stroke();
          }

          // Degree
          doc.fontSize(10).font(F.bold).fillColor(C.textPrimary);
          doc.text(edu.degree, MAIN_X, mainY, { width: MAIN_WIDTH });
          mainY += doc.heightOfString(edu.degree, { width: MAIN_WIDTH }) + 2;

          // Institution + location
          const instLine = [edu.institution, edu.location].filter(Boolean).join(' - ');
          doc.fontSize(8.5).font(F.bold).fillColor(C.accent);
          doc.text(instLine, MAIN_X, mainY, { width: MAIN_WIDTH });
          mainY += doc.heightOfString(instLine, { width: MAIN_WIDTH }) + 2;

          // Period
          doc.fontSize(8).font(F.oblique).fillColor(C.textTertiary);
          doc.text(edu.period, MAIN_X, mainY, { width: MAIN_WIDTH });
          mainY += doc.heightOfString(edu.period, { width: MAIN_WIDTH }) + 4;

          // Description
          if (edu.description) {
            doc.fontSize(8.5).font(F.regular).fillColor(C.textSecondary);
            doc.text(edu.description, MAIN_X, mainY, { width: MAIN_WIDTH, lineGap: 2 });
            mainY += doc.heightOfString(edu.description, { width: MAIN_WIDTH, lineGap: 2 }) + 4;
          }

          mainY += 12;
        }
      }

      // --- CERTIFICATIONS ---
      if (cvData.certifications && cvData.certifications.length > 0) {
        if (needsNewPage(doc, 50, mainY)) {
          addPageWithSidebar(doc);
          mainY = 36;
        }
        mainY = sectionTitle(doc, 'Certifications', MAIN_X, mainY, MAIN_WIDTH);

        for (const cert of cvData.certifications) {
          if (needsNewPage(doc, 30, mainY)) {
            addPageWithSidebar(doc);
            mainY = 36;
          }

          doc.fontSize(9).font(F.bold).fillColor(C.textPrimary);
          doc.text(cert.name, MAIN_X, mainY, { width: MAIN_WIDTH });
          mainY += doc.heightOfString(cert.name, { width: MAIN_WIDTH }) + 2;

          const certMeta = [cert.issuer, cert.date].filter(Boolean).join(' — ');
          if (certMeta) {
            doc.fontSize(8).font(F.oblique).fillColor(C.textTertiary);
            doc.text(certMeta, MAIN_X, mainY, { width: MAIN_WIDTH });
            mainY += doc.heightOfString(certMeta, { width: MAIN_WIDTH }) + 2;
          }
          mainY += 8;
        }
      }

      // --- OTHER SECTIONS ---
      if (cvData.other && cvData.other.length > 0) {
        for (const section of cvData.other) {
          if (needsNewPage(doc, 50, mainY)) {
            addPageWithSidebar(doc);
            mainY = 36;
          }
          mainY = sectionTitle(doc, section.heading, MAIN_X, mainY, MAIN_WIDTH);
          doc.fontSize(8.5).font(F.regular).fillColor(C.textSecondary);
          doc.text(section.content, MAIN_X, mainY, { width: MAIN_WIDTH, lineGap: 2 });
          mainY += doc.heightOfString(section.content, { width: MAIN_WIDTH, lineGap: 2 }) + 14;
        }
      }

      // ─────────────────────────────────────────────────────────
      // FOOTER — Etudesk branding on every page
      // ─────────────────────────────────────────────────────────

      const totalPages = doc.bufferedPageRange().count;
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);

        // Footer line
        const footerY = PAGE.height - FOOTER_HEIGHT;
        doc.moveTo(SIDEBAR_WIDTH + 20, footerY)
          .lineTo(PAGE.width - 30, footerY)
          .lineWidth(0.3).strokeColor(C.borderLight).stroke();

        // Branding text
        doc.fontSize(6.5).font(F.oblique).fillColor(C.textTertiary);
        doc.text('Etudesk', SIDEBAR_WIDTH + 20, footerY + 8, {
          width: PAGE.width - SIDEBAR_WIDTH - 50,
          align: 'left',
          lineBreak: false,
        });

        // Page number (if multi-page)
        if (totalPages > 1) {
          doc.fontSize(6.5).font(F.regular).fillColor(C.textTertiary);
          doc.text(`${i + 1} / ${totalPages}`, SIDEBAR_WIDTH + 20, footerY + 8, {
            width: PAGE.width - SIDEBAR_WIDTH - 50,
            align: 'right',
            lineBreak: false,
          });
        }
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
