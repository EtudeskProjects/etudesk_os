/**
 * CV PDF Generator — Minimaliste, noir & blanc, grand public
 * Mise en page deux colonnes, encre noire sur fond blanc.
 * La SEULE couleur = les barres de competences, colorees par TYPE de
 * competence (aligne sur le design system de l'app Etudesk).
 * Palette : echelle zinc neutre (aucun ton brun).
 */

import PDFDocument from 'pdfkit';
import { getFileBuffer } from '../../storage.service';
import { logger } from '../../../utils';

// --- Etudesk Design Tokens — Monochrome ---

const C = {
  ink: '#18181B',          // Encre principale (quasi noir)
  inkSoft: '#3F3F46',      // Titres / emphase secondaire
  textPrimary: '#18181B',
  textSecondary: '#52525B',
  textTertiary: '#71717A',
  background: '#FFFFFF',
  sidebar: '#FAFAFA',      // Barre laterale neutre tres claire
  surface: '#FAFAFA',
  surfaceAlt: '#F4F4F5',
  border: '#E4E4E7',
  borderLight: '#F4F4F5',
  track: '#E4E4E7',        // Fond des barres de competences
  white: '#FFFFFF',
  accent: '#18181B',       // Accent par defaut = encre (monochrome)
};

// Palette par TYPE de competence — seule touche de couleur du document.
const SKILL_TYPE_COLOR: Record<string, string> = {
  knowledge: '#1D4ED8',       // Connaissance — bleu
  hard_skill: '#0E7490',      // Competence technique — cyan
  soft_skill: '#BE185D',      // Competence comportementale — rose
  tool_platform: '#6D28D9',   // Outil / plateforme — violet
  language: '#047857',        // Langue — emeraude
};

/** Couleur d'une competence selon son type (defaut: encre). */
function skillColor(type?: string): string {
  const t = (type || '').toLowerCase().trim();
  return SKILL_TYPE_COLOR[t] || C.ink;
}

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

// --- Cv Data Structure ---

export interface CVData {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  city?: string;
  country?: string;
  bio?: string;
  avatarUrl?: string;
  includePhoto?: boolean; // default true — set to false to show initials only

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

// --- Helpers ---

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
  const color = options?.color || C.ink;
  const lineColor = options?.lineColor || C.ink;

  doc.fontSize(9.5).font(F.bold).fillColor(color);
  doc.text(title.toUpperCase(), x, y, { width: maxWidth, characterSpacing: 1.5 });
  const h = doc.heightOfString(title.toUpperCase(), { width: maxWidth, characterSpacing: 1.5 });
  const lineY = y + h + 4;
  doc.moveTo(x, lineY).lineTo(x + Math.min(40, maxWidth), lineY)
    .lineWidth(1.5).strokeColor(lineColor).stroke();
  return lineY + 10;
}

/** Draw sidebar section title — dark ink text, ink underline */
function sidebarSectionTitle(doc: PDFKit.PDFDocument, title: string, y: number): number {
  return sectionTitle(doc, title, SIDEBAR_CONTENT_X, y, SIDEBAR_CONTENT_WIDTH, {
    color: C.ink,
    lineColor: C.ink,
  });
}

/** Check if we need a new page in the main column */
function needsNewPage(_doc: PDFKit.PDFDocument, neededHeight: number, currentY: number): boolean {
  return currentY + neededHeight > PAGE.height - FOOTER_HEIGHT - 20;
}

/** Draw the neutral sidebar background + hairline divider */
function drawSidebar(doc: PDFKit.PDFDocument): void {
  doc.rect(0, 0, SIDEBAR_WIDTH, PAGE.height).fillColor(C.sidebar).fill();
  doc.moveTo(SIDEBAR_WIDTH, 0).lineTo(SIDEBAR_WIDTH, PAGE.height)
    .lineWidth(0.5).strokeColor(C.border).stroke();
}

/** Add a new page and draw the sidebar background */
function addPageWithSidebar(doc: PDFKit.PDFDocument): void {
  doc.addPage({ size: 'A4', margin: 0 });
  drawSidebar(doc);
}

// --- Main Cv Generator ---

export async function generateCVPDF(cvData: CVData): Promise<Buffer> {
  // Pre-load avatar before creating the PDF stream (avoids async-in-Promise-constructor antipattern)
  let avatarBuffer: Buffer | null = null;
  const ALLOWED_AVATAR_PREFIXES = [process.env.STORAGE_BASE_URL, 'https://storage.googleapis.com/'].filter(Boolean);
  const isAvatarUrlSafe = cvData.avatarUrl && ALLOWED_AVATAR_PREFIXES.some(p => cvData.avatarUrl!.startsWith(p!));
  const showPhoto = cvData.includePhoto !== false;
  if (showPhoto && cvData.avatarUrl && isAvatarUrlSafe) {
    try {
      avatarBuffer = await getFileBuffer(cvData.avatarUrl);
      if (avatarBuffer && avatarBuffer.length === 0) avatarBuffer = null;
    } catch (err: any) {
      logger.warn(`[cv-pdf] Could not pre-load avatar: ${err.message}`);
    }
  }

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

  return new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    try {

      // SIDEBAR BACKGROUND (full page height, left column) + hairline divider
      drawSidebar(doc);

      // HEADER AREA — Avatar + Name + Contact
      // Subtle header background on main area
      doc.rect(SIDEBAR_WIDTH, 0, PAGE.width - SIDEBAR_WIDTH, HEADER_HEIGHT)
        .fillColor(C.surface).fill();

      // Avatar in sidebar header
      const avatarSize = 80;
      const avatarX = (SIDEBAR_WIDTH - avatarSize) / 2;
      const avatarY = 30;

      let avatarLoaded = false;
      if (avatarBuffer) {
        try {
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
        } catch (err: any) {
          logger.warn(`[cv-pdf] Could not render avatar: ${err.message}`);
        }
      }

      // If no avatar, show initials circle
      if (!avatarLoaded) {
        const cx = avatarX + avatarSize / 2;
        const cy = avatarY + avatarSize / 2;
        doc.circle(cx, cy, avatarSize / 2).fillColor(C.ink).fill();
        const initials = `${(cvData.firstName?.[0] || '').toUpperCase()}${(cvData.lastName?.[0] || '').toUpperCase()}`;
        doc.fontSize(28).font(F.bold).fillColor(C.white);
        const initialsWidth = doc.widthOfString(initials);
        doc.text(initials, cx - initialsWidth / 2, cy - 12, { lineBreak: false });
      }

      // Name in main header area
      const nameX = MAIN_X;
      const nameY = 32;
      doc.fontSize(24).font(F.bold).fillColor(C.ink);
      doc.text(cvData.firstName.toUpperCase(), nameX, nameY, { width: MAIN_WIDTH, continued: false });
      const firstNameH = doc.heightOfString(cvData.firstName.toUpperCase(), { width: MAIN_WIDTH });
      doc.fontSize(24).font(F.regular).fillColor(C.textSecondary);
      doc.text(cvData.lastName.toUpperCase(), nameX, nameY + firstNameH + 2, {
        width: MAIN_WIDTH,
        characterSpacing: 2,
      });

      // Thin accent line separating header from content
      const headerLineY = HEADER_HEIGHT - 0.5;
      doc.moveTo(SIDEBAR_WIDTH, headerLineY).lineTo(PAGE.width, headerLineY)
        .lineWidth(0.5).strokeColor(C.border).stroke();

      // SIDEBAR CONTENT (below avatar)
      let sideY = avatarY + avatarSize + 24;

      // --- CONTACT DETAILS in sidebar ---
      sideY = sidebarSectionTitle(doc, 'Contact', sideY);

      const contactItems: Array<{ label: string; value: string }> = [];
      if (cvData.email) contactItems.push({ label: 'Email', value: cvData.email });
      if (cvData.phone) contactItems.push({ label: 'Tel', value: cvData.phone });
      const loc = [cvData.city, cvData.country].filter(Boolean).join(', ');
      if (loc) contactItems.push({ label: 'Lieu', value: loc });

      for (const item of contactItems) {
        doc.fontSize(7).font(F.bold).fillColor(C.textTertiary);
        doc.text(item.label.toUpperCase(), SIDEBAR_CONTENT_X, sideY, { width: SIDEBAR_CONTENT_WIDTH });
        sideY += 10;
        doc.fontSize(8).font(F.regular).fillColor(C.textPrimary);
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
          doc.fontSize(7.5).font(F.regular).fillColor(C.textPrimary);
          doc.text(skill.name, SIDEBAR_CONTENT_X, sideY, { width: SIDEBAR_CONTENT_WIDTH });
          const nameH = doc.heightOfString(skill.name, { width: SIDEBAR_CONTENT_WIDTH });

          // Progress bar
          const barY = sideY + nameH + 2;
          const barWidth = SIDEBAR_CONTENT_WIDTH;
          const barHeight = 3;
          const fillPercent = skillLevelToPercent(skill.level);
          const barColor = skillColor(skill.type); // couleur = type de competence

          // Background track
          doc.roundedRect(SIDEBAR_CONTENT_X, barY, barWidth, barHeight, 1.5)
            .fillColor(C.track).fill();
          // Filled portion — coloree selon le type de competence
          if (fillPercent > 0) {
            doc.roundedRect(SIDEBAR_CONTENT_X, barY, barWidth * fillPercent, barHeight, 1.5)
              .fillColor(barColor).fill();
          }

          // Level label (right-aligned, subtle)
          const levelStr = formatLevel(skill.level);
          if (levelStr) {
            doc.fontSize(6).font(F.oblique).fillColor(C.textTertiary);
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
          doc.fontSize(8).font(F.regular).fillColor(C.textPrimary);
          doc.text(lang.language, SIDEBAR_CONTENT_X, sideY, { width: SIDEBAR_CONTENT_WIDTH });
          const langH = doc.heightOfString(lang.language, { width: SIDEBAR_CONTENT_WIDTH });

          const levelText = langLevel(lang.level);
          if (levelText) {
            doc.fontSize(7).font(F.oblique).fillColor(C.textTertiary);
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
          doc.fontSize(7.5).font(F.regular).fillColor(C.textPrimary);
          const text = `  ${interest}`;
          // Small dot
          doc.circle(SIDEBAR_CONTENT_X + 3, sideY + 4, 1.5).fillColor(C.ink).fill();
          doc.text(text, SIDEBAR_CONTENT_X + 8, sideY, { width: SIDEBAR_CONTENT_WIDTH - 8 });
          sideY += doc.heightOfString(text, { width: SIDEBAR_CONTENT_WIDTH - 8 }) + 4;
        }
        sideY += 6;
      }

      // --- GOALS ---
      if (cvData.goals && cvData.goals.length > 0) {
        sideY = sidebarSectionTitle(doc, 'Objectifs', sideY);
        for (const goal of cvData.goals) {
          doc.fontSize(7.5).font(F.regular).fillColor(C.textPrimary);
          doc.circle(SIDEBAR_CONTENT_X + 3, sideY + 4, 1.5).fillColor(C.ink).fill();
          doc.text(goal, SIDEBAR_CONTENT_X + 8, sideY, { width: SIDEBAR_CONTENT_WIDTH - 8 });
          sideY += doc.heightOfString(goal, { width: SIDEBAR_CONTENT_WIDTH - 8 }) + 4;
        }
      }

      // MAIN CONTENT — Right column
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
          doc.circle(dotX, dotY, 3).fillColor(C.ink).fill();
          doc.circle(dotX, dotY, 3).lineWidth(1).strokeColor(C.white).stroke();

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
          doc.fontSize(8.5).font(F.bold).fillColor(C.inkSoft);
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
          doc.circle(dotX, dotY, 3).fillColor(C.ink).fill();
          doc.circle(dotX, dotY, 3).lineWidth(1).strokeColor(C.white).stroke();

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
          doc.fontSize(8.5).font(F.bold).fillColor(C.inkSoft);
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

      // FOOTER — Etudesk branding on every page
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
