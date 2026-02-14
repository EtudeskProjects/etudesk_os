/**
 * Org Document PDF Generator — Branded PDF with organization logo
 * Professional single-column layout with org branding header
 * Color palette: Etudesk warm brown (#3B2416) + neutral grays
 */

import PDFDocument from 'pdfkit';
import { getFileBuffer } from '../../storage.service';
import { logger } from '../../../utils';

// --- Etudesk Design Tokens ---

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
  border: '#E8E4DF',
  borderLight: '#EBE8E4',
  white: '#FFFFFF',
  success: '#4A6741',
};

const F = {
  regular: 'Helvetica',
  bold: 'Helvetica-Bold',
  oblique: 'Helvetica-Oblique',
};

const PAGE = {
  width: 595.28,   // A4
  height: 841.89,  // A4
  marginX: 50,
  marginTop: 50,
  marginBottom: 40,
};

const CONTENT_WIDTH = PAGE.width - PAGE.marginX * 2;
const FOOTER_HEIGHT = 30;

// --- Data Structure ---

export interface OrgDocumentData {
  organizationName: string;
  organizationCity?: string;
  organizationCountry?: string;
  logoUrl?: string;
  documentDate?: string;
  sections: Array<{ heading: string; body: string }>;
}

/** Detect OrgDocumentData-structured content */
export function isOrgDocumentContent(data: any): data is OrgDocumentData {
  return data && typeof data.organizationName === 'string' && Array.isArray(data.sections);
}

// --- Helpers ---

function needsNewPage(currentY: number, neededHeight: number): boolean {
  return currentY + neededHeight > PAGE.height - FOOTER_HEIGHT - 20;
}

// --- Main Generator ---

export async function generateOrgDocumentPDF(title: string, data: OrgDocumentData): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: PAGE.marginX,
        bufferPages: true,
        info: {
          Title: title,
          Author: data.organizationName,
          Creator: 'Etudesk Copilot',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      let y = PAGE.marginTop;

      // --- HEADER: Logo + Org Name + Date ---

      const headerStartY = y;
      let logoLoaded = false;

      // Try to load and render org logo
      if (data.logoUrl) {
        try {
          const logoBuffer = await getFileBuffer(data.logoUrl);
          if (logoBuffer && logoBuffer.length > 0) {
            const logoHeight = 48;
            const logoWidth = 48;
            doc.image(logoBuffer, PAGE.marginX, y, {
              fit: [logoWidth, logoHeight],
              align: 'center',
              valign: 'center',
            });
            logoLoaded = true;
          }
        } catch (err: any) {
          logger.warn(`[org-doc-pdf] Could not load logo: ${err.message}`);
        }
      }

      // Org name + location to the right of logo (or left if no logo)
      const textX = logoLoaded ? PAGE.marginX + 60 : PAGE.marginX;
      const textWidth = CONTENT_WIDTH - (logoLoaded ? 60 : 0);

      doc.fontSize(16).font(F.bold).fillColor(C.primary);
      doc.text(data.organizationName, textX, y, { width: textWidth });
      y += doc.heightOfString(data.organizationName, { width: textWidth }) + 3;

      // Location line
      const location = [data.organizationCity, data.organizationCountry].filter(Boolean).join(', ');
      if (location) {
        doc.fontSize(9).font(F.regular).fillColor(C.textTertiary);
        doc.text(location, textX, y, { width: textWidth });
        y += doc.heightOfString(location, { width: textWidth }) + 2;
      }

      // Date
      if (data.documentDate) {
        doc.fontSize(8).font(F.oblique).fillColor(C.textTertiary);
        doc.text(data.documentDate, textX, y, { width: textWidth });
        y += doc.heightOfString(data.documentDate, { width: textWidth }) + 2;
      }

      // Ensure y is at least past the logo height
      if (logoLoaded) {
        y = Math.max(y, headerStartY + 52);
      }

      // Header separator line
      y += 8;
      doc.moveTo(PAGE.marginX, y).lineTo(PAGE.width - PAGE.marginX, y)
        .lineWidth(1.5).strokeColor(C.accent).stroke();
      y += 16;

      // --- DOCUMENT TITLE ---
      doc.fontSize(20).font(F.bold).fillColor(C.primary);
      doc.text(title, PAGE.marginX, y, { width: CONTENT_WIDTH, align: 'center' });
      y += doc.heightOfString(title, { width: CONTENT_WIDTH }) + 20;

      // --- SECTIONS ---
      for (const section of data.sections) {
        // Estimate height
        const headingHeight = 20;
        const bodyHeight = doc.heightOfString(section.body, { width: CONTENT_WIDTH, lineGap: 4 });
        const totalHeight = headingHeight + bodyHeight + 30;

        if (needsNewPage(y, Math.min(totalHeight, 80))) {
          doc.addPage({ size: 'A4', margin: PAGE.marginX });
          y = PAGE.marginTop;
        }

        // Section heading
        doc.fontSize(12).font(F.bold).fillColor(C.primary);
        doc.text(section.heading.toUpperCase(), PAGE.marginX, y, {
          width: CONTENT_WIDTH,
          characterSpacing: 0.8,
        });
        const headH = doc.heightOfString(section.heading.toUpperCase(), {
          width: CONTENT_WIDTH,
          characterSpacing: 0.8,
        });
        y += headH + 4;

        // Accent underline
        doc.moveTo(PAGE.marginX, y).lineTo(PAGE.marginX + Math.min(50, CONTENT_WIDTH), y)
          .lineWidth(1.2).strokeColor(C.accent).stroke();
        y += 10;

        // Section body — handle bullet points and paragraphs
        const lines = section.body.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) {
            y += 6;
            continue;
          }

          // Check for new page mid-section
          const lineH = doc.heightOfString(trimmed, { width: CONTENT_WIDTH - 16, lineGap: 4 });
          if (needsNewPage(y, lineH + 4)) {
            doc.addPage({ size: 'A4', margin: PAGE.marginX });
            y = PAGE.marginTop;
          }

          // Bullet point detection
          if (trimmed.startsWith('- ') || trimmed.startsWith('• ') || trimmed.startsWith('* ')) {
            const bulletText = trimmed.replace(/^[-•*]\s*/, '');
            doc.circle(PAGE.marginX + 4, y + 5, 2).fillColor(C.accent).fill();
            doc.fontSize(10).font(F.regular).fillColor(C.textPrimary);
            doc.text(bulletText, PAGE.marginX + 14, y, { width: CONTENT_WIDTH - 14, lineGap: 4 });
            y += doc.heightOfString(bulletText, { width: CONTENT_WIDTH - 14, lineGap: 4 }) + 4;
          } else {
            doc.fontSize(10).font(F.regular).fillColor(C.textPrimary);
            doc.text(trimmed, PAGE.marginX, y, { width: CONTENT_WIDTH, lineGap: 4 });
            y += doc.heightOfString(trimmed, { width: CONTENT_WIDTH, lineGap: 4 }) + 4;
          }
        }

        y += 14;
      }

      // --- FOOTER on every page ---
      const totalPages = doc.bufferedPageRange().count;
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);

        const footerY = PAGE.height - FOOTER_HEIGHT;
        doc.moveTo(PAGE.marginX, footerY)
          .lineTo(PAGE.width - PAGE.marginX, footerY)
          .lineWidth(0.3).strokeColor(C.borderLight).stroke();

        // Org name + Etudesk branding
        doc.fontSize(6.5).font(F.oblique).fillColor(C.textTertiary);
        doc.text(`${data.organizationName} — Etudesk`, PAGE.marginX, footerY + 8, {
          width: CONTENT_WIDTH,
          align: 'left',
          lineBreak: false,
        });

        if (totalPages > 1) {
          doc.fontSize(6.5).font(F.regular).fillColor(C.textTertiary);
          doc.text(`${i + 1} / ${totalPages}`, PAGE.marginX, footerY + 8, {
            width: CONTENT_WIDTH,
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
