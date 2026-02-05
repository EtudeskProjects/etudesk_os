/**
 * Generate Document Tool — PDF, DOCX, XLS, CSV, TXT generation
 * Uses pdfkit, docx, exceljs, csv-stringify for real document generation
 */

import { tool } from '@openai/agents';
import { z } from 'zod';
import PDFDocument from 'pdfkit';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType } from 'docx';
import ExcelJS from 'exceljs';
import { stringify } from 'csv-stringify/sync';
import { uploadFile } from '../../storage.service';
import { logger } from '../../../utils';

// Content JSON structure types
interface SectionContent {
  sections: Array<{ heading: string; body: string }>;
}

interface TableContent {
  headers: string[];
  rows: string[][];
}

function isSectionContent(data: any): data is SectionContent {
  return data && Array.isArray(data.sections);
}

function isTableContent(data: any): data is TableContent {
  return data && Array.isArray(data.headers) && Array.isArray(data.rows);
}

/**
 * Generate a PDF buffer from structured content
 */
async function generatePDF(title: string, data: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Title
    doc.fontSize(22).font('Helvetica-Bold').text(title, { align: 'center' });
    doc.moveDown(1.5);

    if (isSectionContent(data)) {
      for (const section of data.sections) {
        doc.fontSize(14).font('Helvetica-Bold').text(section.heading);
        doc.moveDown(0.5);
        doc.fontSize(11).font('Helvetica').text(section.body, { lineGap: 4 });
        doc.moveDown(1);
      }
    } else if (isTableContent(data)) {
      // Simple table rendering
      const colWidth = (doc.page.width - 100) / data.headers.length;

      // Header row
      doc.fontSize(10).font('Helvetica-Bold');
      let x = 50;
      for (const header of data.headers) {
        doc.text(header, x, doc.y, { width: colWidth, continued: false });
        x += colWidth;
      }
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
      doc.moveDown(0.5);

      // Data rows
      doc.font('Helvetica').fontSize(10);
      for (const row of data.rows) {
        const startY = doc.y;
        x = 50;
        for (const cell of row) {
          doc.text(String(cell ?? ''), x, startY, { width: colWidth });
          x += colWidth;
        }
        doc.moveDown(0.3);
      }
    } else {
      // Plain text fallback
      doc.fontSize(11).font('Helvetica').text(JSON.stringify(data, null, 2));
    }

    doc.end();
  });
}

/**
 * Generate a DOCX buffer from structured content
 */
async function generateDOCX(title: string, data: any): Promise<Buffer> {
  const children: any[] = [
    new Paragraph({
      text: title,
      heading: HeadingLevel.TITLE,
      spacing: { after: 400 },
    }),
  ];

  if (isSectionContent(data)) {
    for (const section of data.sections) {
      children.push(
        new Paragraph({
          text: section.heading,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 150 },
        })
      );
      // Split body by newlines for proper paragraphs
      const lines = section.body.split('\n');
      for (const line of lines) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: line, size: 22 })],
            spacing: { after: 100 },
          })
        );
      }
    }
  } else if (isTableContent(data)) {
    const headerRow = new TableRow({
      children: data.headers.map(
        (h: string) =>
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })],
            width: { size: Math.floor(9000 / data.headers.length), type: WidthType.DXA },
          })
      ),
    });

    const dataRows = data.rows.map(
      (row: string[]) =>
        new TableRow({
          children: row.map(
            (cell: string) =>
              new TableCell({
                children: [new Paragraph({ text: String(cell ?? '') })],
                width: { size: Math.floor(9000 / data.headers.length), type: WidthType.DXA },
              })
          ),
        })
    );

    children.push(
      new Table({
        rows: [headerRow, ...dataRows],
        width: { size: 9000, type: WidthType.DXA },
      })
    );
  } else {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: JSON.stringify(data, null, 2), size: 22 })],
      })
    );
  }

  const doc = new Document({
    sections: [{ children }],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

/**
 * Generate an XLSX buffer from structured content
 */
async function generateXLSX(title: string, data: any): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(title.slice(0, 31)); // Excel sheet name max 31 chars

  if (isTableContent(data)) {
    // Add header row with styling
    const headerRow = sheet.addRow(data.headers);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    });

    // Add data rows
    for (const row of data.rows) {
      sheet.addRow(row);
    }

    // Auto-fit columns
    sheet.columns.forEach((col) => {
      col.width = 20;
    });
  } else if (isSectionContent(data)) {
    // Convert sections to rows
    sheet.addRow(['Section', 'Contenu']);
    sheet.getRow(1).font = { bold: true };
    for (const section of data.sections) {
      sheet.addRow([section.heading, section.body]);
    }
    sheet.columns.forEach((col) => {
      col.width = 40;
    });
  } else {
    // Raw data
    sheet.addRow(['Données']);
    sheet.addRow([JSON.stringify(data, null, 2)]);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Generate a CSV string from structured content
 */
function generateCSV(data: any): string {
  if (isTableContent(data)) {
    return stringify([data.headers, ...data.rows]);
  }
  if (isSectionContent(data)) {
    const rows = data.sections.map((s) => [s.heading, s.body]);
    return stringify([['Section', 'Contenu'], ...rows]);
  }
  return stringify([[JSON.stringify(data)]]);
}

/**
 * Generate a TXT string from structured content
 */
function generateTXT(title: string, data: any): string {
  const lines: string[] = [title, '='.repeat(title.length), ''];

  if (isSectionContent(data)) {
    for (const section of data.sections) {
      lines.push(section.heading);
      lines.push('-'.repeat(section.heading.length));
      lines.push(section.body);
      lines.push('');
    }
  } else if (isTableContent(data)) {
    lines.push(data.headers.join('\t'));
    for (const row of data.rows) {
      lines.push(row.map((c) => String(c ?? '')).join('\t'));
    }
  } else {
    lines.push(JSON.stringify(data, null, 2));
  }

  return lines.join('\n');
}

const FORMAT_EXTENSIONS: Record<string, string> = {
  PDF: 'pdf',
  DOCX: 'docx',
  XLS: 'xlsx',
  CSV: 'csv',
  TXT: 'txt',
};

const FORMAT_MIMETYPES: Record<string, string> = {
  PDF: 'application/pdf',
  DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  XLS: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  CSV: 'text/csv',
  TXT: 'text/plain',
};

export const generateDocumentTool = tool({
  name: 'generate_document',
  description:
    'Generate a downloadable document (CV, cover letter, report, data export). Supports PDF, DOCX, XLS, CSV, TXT formats. Use AFTER gathering data via sql_query or vector_query. Returns a persistent download URL.',
  parameters: z.object({
    format: z
      .enum(['PDF', 'DOCX', 'XLS', 'CSV', 'TXT'])
      .default('PDF')
      .describe('Output format: PDF (default, good for CVs/letters), DOCX (editable), XLS (spreadsheets), CSV (data export), TXT (plain text)'),
    title: z.string().describe('Document title displayed at the top of the generated file'),
    contentJson: z
      .string()
      .describe(
        'Content as JSON string. Two formats supported: (1) Sections: {"sections":[{"heading":"Section Title","body":"Section content text"}]} — for CVs, letters, reports. (2) Table: {"headers":["Column A","Column B"],"rows":[["row1a","row1b"],["row2a","row2b"]]} — for data exports, spreadsheets.'
      ),
    instructions: z.string().describe('Generation instructions describing the purpose and style of the document'),
  }),
  execute: async ({ format, title, contentJson, instructions }) => {
    try {
      const data = JSON.parse(contentJson);
      const timestamp = Date.now();
      const safeTitle = title.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50);
      const extension = FORMAT_EXTENSIONS[format];
      const mimeType = FORMAT_MIMETYPES[format];
      const filename = `${safeTitle}-${timestamp}.${extension}`;
      const storagePath = `generated/${filename}`;

      let buffer: Buffer;

      switch (format) {
        case 'PDF':
          buffer = await generatePDF(title, data);
          break;
        case 'DOCX':
          buffer = await generateDOCX(title, data);
          break;
        case 'XLS':
          buffer = await generateXLSX(title, data);
          break;
        case 'CSV': {
          const csv = generateCSV(data);
          buffer = Buffer.from(csv, 'utf-8');
          break;
        }
        case 'TXT': {
          const txt = generateTXT(title, data);
          buffer = Buffer.from(txt, 'utf-8');
          break;
        }
        default:
          return { success: false, error: `Format non supporté: ${format}` };
      }

      const downloadUrl = await uploadFile(buffer, storagePath, mimeType);

      logger.info(`[generate_document] Generated ${format} document: ${filename} (${buffer.length} bytes)`);

      return {
        success: true,
        documentType: format,
        downloadUrl,
        filename,
        metadata: {
          generatedAt: new Date().toISOString(),
          sizeBytes: buffer.length,
          title,
        },
      };
    } catch (error: any) {
      logger.error(`[generate_document] Error: ${error.message}`);
      return {
        success: false,
        error: `Erreur lors de la génération du document: ${error.message}`,
      };
    }
  },
});
