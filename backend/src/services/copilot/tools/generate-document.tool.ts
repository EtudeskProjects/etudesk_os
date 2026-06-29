/**
 * Generate Document Tool — PDF, DOCX, XLS, CSV, TXT generation
 * Uses pdfkit, docx, exceljs, csv-stringify for real document generation
 * Factory pattern: injects talentId for auto-save to user's documents library
 */

import { defineTool } from './tool-helper';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import PDFDocument from 'pdfkit';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType } from 'docx';
import ExcelJS from 'exceljs';
import { stringify } from 'csv-stringify/sync';
import { uploadFile } from '../../storage.service';
import { pool } from '../../database';
import { logger } from '../../../utils';
import { i18next } from '../../../i18n';
import { generateCVPDF, CVData } from './cv-pdf-generator';
import { generateOrgDocumentPDF, isOrgDocumentContent, OrgDocumentData, ChartData } from './org-document-pdf-generator';
import { toTOON } from '../../ai/toon';
import { debitWalletForAction } from '../../billing/credit.service';
import { canonicalCatalogType, CATALOG_TYPES } from '../../../constants/skills';

/** Resolve any incoming skill type label to a catalog type, or undefined when
 *  it cannot be mapped (the CV renderer then uses neutral ink — never a wrong color). */
function skillType(raw?: string): string | undefined {
  return canonicalCatalogType(raw);
}

// Content JSON structure types
interface SectionContent {
  sections: Array<{ heading: string; body: string; chart?: ChartData }>;
}

interface TableContent {
  headers: string[];
  rows: string[][];
}

const CV_CONTENT_CONTRACT = {
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  phone: '+1...',
  city: 'Remote',
  country: 'Global',
  bio: 'Profile summary...',
  skills: [{ name: 'Python', type: 'hard_skill', level: 'advanced' }],
  languages: [{ language: 'Francais', level: 'native' }],
  interests: ['AI', 'Fintech'],
  goals: ['Lead developer'],
  experiences: [{ title: 'Senior Developer', company: 'Acme', location: 'Remote', period: '2022 - Present', description: 'Led team of 5...' }],
  education: [{ degree: 'Master Informatique', institution: 'Global Tech University', location: 'Remote', period: '2018 - 2020', description: 'Specialisation IA' }],
  certifications: [{ name: 'AWS Solutions Architect', issuer: 'Amazon', date: '2023' }],
  references: [{ name: 'M. Dupont', title: 'CEO, Acme', phone: '+221...' }],
};

const ORG_DOCUMENT_CONTRACT = {
  organizationName: 'Acme Corp',
  sections: [{ heading: 'Section title', body: 'Section body' }],
};

const SECTIONS_CONTRACT = {
  sections: [{ heading: 'Section title', body: 'Section content text' }],
};

const TABLE_CONTRACT = {
  headers: ['Column A', 'Column B'],
  rows: [['row1a', 'row1b'], ['row2a', 'row2b']],
};

function isSectionContent(data: any): data is SectionContent {
  return data && Array.isArray(data.sections);
}

function isTableContent(data: any): data is TableContent {
  return data && Array.isArray(data.headers) && Array.isArray(data.rows);
}

/** Detect CVData-structured content — supports canonical, agent-alternate, personal, wrapper, and JSON Resume formats */
function isCVContent(data: any): boolean {
  // Wrapper format: { type: "cv", profile: { firstName, lastName, ... } }
  if (data?.type === 'cv' && data?.profile && typeof data.profile.firstName === 'string') {
    return true;
  }
  // Canonical format: { firstName, lastName, skills: [{name}] }
  if (data && typeof data.firstName === 'string' && typeof data.lastName === 'string' && Array.isArray(data.skills)) {
    return true;
  }
  // Agent alternate format: { personalInfo: { firstName, lastName }, skills/experience }
  if (data?.personalInfo && typeof data.personalInfo.firstName === 'string' && typeof data.personalInfo.lastName === 'string') {
    return true;
  }
  // Agent "personal" shorthand: { personal: { firstName, lastName }, experiences/skills }
  if (data?.personal && typeof data.personal.firstName === 'string' && typeof data.personal.lastName === 'string') {
    return true;
  }
  // JSON Resume format: { basics: { name: "..." }, work/education/skills arrays }
  if (data?.basics && typeof data.basics.name === 'string') {
    return true;
  }
  return false;
}

/**
 * Normalize JSON Resume format to canonical CVData.
 * JSON Resume: { basics: { name, label, email, phone, location: { city, region, countryCode }, summary },
 *   work: [{ company, position, startDate, endDate, summary, highlights }],
 *   education: [{ institution, area, studyType, startDate, endDate, description }],
 *   skills: [{ name, level, keywords }],
 *   languages: [{ language, fluency }],
 *   volunteer: [{ organization, position, startDate, endDate, summary }],
 *   awards: [{ title, awarder, date, summary }] }
 */
function normalizeJsonResume(data: any, language?: string): CVData {
  const tr = (key: string) => i18next.t(key, { lng: language });
  const basics = data.basics || {};
  const nameParts = (basics.name || '').trim().split(/\s+/);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';
  const loc = basics.location || {};

  // Skills: JSON Resume has { name, level, keywords[] } — flatten keywords as sub-skills
  let skills: CVData['skills'] = [];
  if (Array.isArray(data.skills)) {
    for (const s of data.skills) {
      if (s.name) {
        skills.push({ name: s.name, level: s.level });
      }
      // Also add keywords as individual skills if present
      if (Array.isArray(s.keywords)) {
        for (const kw of s.keywords) {
          if (kw && !skills.some((sk) => sk.name.toLowerCase() === kw.toLowerCase())) {
            skills.push({ name: kw, type: CATALOG_TYPES.HARD_SKILL });
          }
        }
      }
    }
  }

  // Work → experiences
  let experiences: CVData['experiences'] = undefined;
  if (Array.isArray(data.work) && data.work.length > 0) {
    experiences = data.work.map((w: any) => ({
      title: w.position || '',
      company: w.company || w.name || '',
      location: w.location,
      period: `${w.startDate || ''}${w.endDate ? ' - ' + w.endDate : ' - Present'}`,
      description: Array.isArray(w.highlights) && w.highlights.length > 0
        ? w.highlights.join('\n')
        : (w.summary || ''),
    }));
  }

  // Education
  let education: CVData['education'] = undefined;
  if (Array.isArray(data.education) && data.education.length > 0) {
    education = data.education.map((e: any) => ({
      degree: [e.studyType, e.area].filter(Boolean).join(' — ') || '',
      institution: e.institution || '',
      location: e.location,
      period: `${e.startDate || ''}${e.endDate ? ' - ' + e.endDate : ''}`,
      description: e.description || '',
    }));
  }

  // Languages: JSON Resume has { language, fluency }
  let languages: CVData['languages'] = undefined;
  if (Array.isArray(data.languages) && data.languages.length > 0) {
    languages = data.languages.map((l: any) => ({
      language: l.language || '',
      level: l.fluency || '',
    }));
  }

  // Certifications from awards
  let certifications: CVData['certifications'] = undefined;
  if (Array.isArray(data.awards) && data.awards.length > 0) {
    certifications = data.awards.map((a: any) => ({
      name: a.title || '',
      issuer: a.awarder || '',
      date: a.date || '',
    }));
  }

  // Volunteer → other sections
  let other: CVData['other'] = undefined;
  if (Array.isArray(data.volunteer) && data.volunteer.length > 0) {
    other = [{
      heading: tr('copilot:docHeadingVolunteerEngagement'),
      content: data.volunteer.map((v: any) =>
        `${v.position || ''} — ${v.organization || ''} (${v.startDate || ''}${v.endDate ? ' - ' + v.endDate : ' - ' + tr('copilot:docLabelPresent')})${v.summary ? '\n' + v.summary : ''}`
      ).join('\n\n'),
    }];
  }

  return {
    firstName,
    lastName,
    email: basics.email || '',
    phone: basics.phone,
    city: loc.city || loc.region,
    country: loc.countryCode,
    bio: basics.summary || basics.label,
    skills,
    languages,
    experiences,
    education,
    certifications,
    other,
  };
}

/**
 * Normalize agent-alternate CV format to canonical CVData.
 * Agent often sends: { personalInfo: { firstName, lastName, title, email, ... }, experience: [...], skills: [{category, items}], ... }
 * We need: { firstName, lastName, email, skills: [{name, type, level}], experiences: [{title, company, period, description}], ... }
 */
function normalizeCVData(data: any, language?: string): CVData {
  const tr = (key: string) => i18next.t(key, { lng: language });
  // Wrapper format: { type: "cv", profile: { firstName, lastName, ... } }
  // Unwrap and recurse — the profile object may be canonical, alternate, or any other format
  if (data?.type === 'cv' && data?.profile && typeof data.profile === 'object') {
    return normalizeCVData(data.profile, language);
  }

  // Canonical-like format: has firstName + lastName at top level
  // Still needs normalization for field name variants (experience→experiences, summary→bio, location→city/country)
  if (typeof data.firstName === 'string' && typeof data.lastName === 'string') {
    // Normalize experience/experiences
    const rawExp = data.experience || data.experiences;
    let experiences: CVData['experiences'] = undefined;
    if (Array.isArray(rawExp)) {
      experiences = rawExp.map((e: any) => ({
        title: e.position || e.title || '',
        company: e.company || e.organization || '',
        location: e.location,
        period: e.period || `${e.startDate || ''}${e.endDate ? ' - ' + e.endDate : e.current ? ' - ' + tr('copilot:docLabelPresent') : ''}`,
        description: Array.isArray(e.highlights) ? e.highlights.join('\n') : Array.isArray(e.bullets) ? e.bullets.join('\n') : (e.description || ''),
      }));
    }

    // Normalize education
    let education: CVData['education'] = undefined;
    if (Array.isArray(data.education)) {
      education = data.education.map((e: any) => ({
        degree: e.degree || '',
        institution: e.institution || e.school || '',
        location: e.location,
        period: e.period || `${e.startDate || ''}${e.endDate ? ' - ' + e.endDate : ''}`,
        description: Array.isArray(e.highlights) ? e.highlights.join('\n') : (e.description || ''),
      }));
    }

    // Normalize skills (handle string arrays, grouped, or flat objects)
    let skills = data.skills || [];
    if (Array.isArray(skills)) {
      skills = skills.map((s: any) => {
        if (typeof s === 'string') return { name: s };
        if (s.category && Array.isArray(s.items)) {
          return s.items.map((item: string) => ({ name: item, type: skillType(s.category) }));
        }
        if (s && typeof s === 'object' && s.name) return { ...s, type: skillType(s.type) };
        return s;
      }).flat();
    }

    // Normalize location string → city/country
    let city = data.city;
    let country = data.country;
    if (!city && typeof data.location === 'string') {
      const parts = data.location.split(',').map((p: string) => p.trim());
      city = parts[0];
      country = parts[1] || country;
    }

    // Normalize languages: [{name, level}] → [{language, level}]
    let languages: CVData['languages'] = undefined;
    if (Array.isArray(data.languages)) {
      languages = data.languages.map((l: any) => ({
        language: l.language || l.name || '',
        level: l.level || '',
      }));
    }

    // Normalize certifications: [{name, issuer, year/date}]
    let certifications: CVData['certifications'] = undefined;
    if (Array.isArray(data.certifications)) {
      certifications = data.certifications.map((c: any) => ({
        name: c.name || '',
        issuer: c.issuer,
        date: c.date || c.year,
      }));
    }

    // Convert references → other section
    let other: CVData['other'] = undefined;
    if (Array.isArray(data.references) && data.references.length > 0) {
      other = [{
        heading: tr('copilot:docHeadingReferences'),
        content: data.references.map((r: any) =>
          `${r.name || ''}${r.title ? ' — ' + r.title : ''}${r.contact ? ' | ' + r.contact : ''}${r.phone ? ' | ' + r.phone : ''}${r.email ? ' | ' + r.email : ''}`
        ).join('\n'),
      }];
    }

    return {
      ...data,
      bio: data.bio || data.summary,
      city,
      country,
      skills,
      experiences,
      education,
      languages,
      certifications,
      other: other || data.other,
    };
  }

  // JSON Resume format: { basics: { name, label, email, phone, location, summary }, work, education, skills, languages, volunteer, awards }
  if (data.basics && typeof data.basics.name === 'string') {
    return normalizeJsonResume(data, language);
  }

  const pi = data.personalInfo || data.personal || {};

  // Flatten skills from various formats → [{name, type?, level?}]
  let flatSkills: Array<{ name: string; type?: string; level?: string }> = [];
  if (Array.isArray(data.skills)) {
    for (const s of data.skills) {
      if (s.category && Array.isArray(s.items)) {
        // Grouped format: {category: "Tech", items: ["Python", "Node.js"]}
        for (const item of s.items) {
          flatSkills.push({ name: item, type: skillType(s.category) });
        }
      } else if (s.name) {
        // Already flat format — canonicalize the type label
        flatSkills.push({ ...s, type: skillType(s.type) });
      }
    }
  } else if (data.skills && typeof data.skills === 'object' && !Array.isArray(data.skills)) {
    // Object format: {hard: ["Skill1", ...], soft: ["Skill2", ...]}
    for (const [type, items] of Object.entries(data.skills)) {
      if (Array.isArray(items)) {
        for (const item of items) {
          if (typeof item === 'string') {
            flatSkills.push({ name: item, type: skillType(type) });
          } else if (item && typeof item === 'object' && item.name) {
            flatSkills.push({ name: item.name, type: skillType(item.type || type), level: item.level });
          }
        }
      }
    }
  }

  // Normalize experiences: {position, company, startDate, endDate, highlights/bullets} → {title, company, period, description}
  let experiences: CVData['experiences'] = undefined;
  const rawExp = data.experience || data.experiences;
  if (Array.isArray(rawExp)) {
    experiences = rawExp.map((e: any) => ({
      title: e.position || e.title || '',
      company: e.company || e.organization || '',
      location: e.location,
      period: e.period || `${e.startDate || ''}${e.endDate ? ' - ' + e.endDate : e.current ? ' - ' + tr('copilot:docLabelPresent') : ''}`,
      description: Array.isArray(e.highlights) ? e.highlights.join('\n') : Array.isArray(e.bullets) ? e.bullets.join('\n') : (e.description || ''),
    }));
  }

  // Normalize education: {institution, degree/school, startDate, endDate, highlights} → {institution, degree, period, description}
  let education: CVData['education'] = undefined;
  if (Array.isArray(data.education)) {
    education = data.education.map((e: any) => ({
      degree: e.degree || '',
      institution: e.institution || e.school || '',
      location: e.location,
      period: e.period || `${e.startDate || ''}${e.endDate ? ' - ' + e.endDate : ''}`,
      description: Array.isArray(e.highlights) ? e.highlights.join('\n') : (e.description || ''),
    }));
  }

  // Normalize certifications
  let certifications: CVData['certifications'] = undefined;
  if (Array.isArray(data.certifications)) {
    certifications = data.certifications.map((c: any) => ({
      name: c.name || '',
      issuer: c.issuer,
      date: c.date,
    }));
  }

  // Normalize languages
  let languages: CVData['languages'] = undefined;
  if (Array.isArray(data.languages)) {
    languages = data.languages.map((l: any) => ({
      language: l.language || l.name || '',
      level: l.level || '',
    }));
  }

  // Volunteer/other sections
  let otherSections: CVData['other'] = undefined;
  const volunteerData = data.volunteerWork || data.volunteer;
  if (Array.isArray(volunteerData) && volunteerData.length > 0) {
    otherSections = [{
      heading: tr('copilot:docHeadingVolunteerEngagement'),
      content: volunteerData.map((v: any) =>
        `${v.role || v.position || ''} — ${v.organization || ''} (${v.startDate || v.period || ''}${v.current ? ' - ' + tr('copilot:docLabelPresent') : v.endDate ? ' - ' + v.endDate : ''})`
      ).join('\n'),
    }];
  }

  // References section (if provided)
  if (Array.isArray(data.references) && data.references.length > 0) {
    const refSection = {
      heading: tr('copilot:docHeadingReferences'),
      content: data.references.map((r: any) =>
        `${r.name || ''}${r.title ? ' — ' + r.title : ''}${r.phone ? ' | ' + r.phone : ''}${r.email ? ' | ' + r.email : ''}`
      ).join('\n'),
    };
    otherSections = [...(otherSections || []), refSection];
  }

  return {
    firstName: pi.firstName || data.firstName || '',
    lastName: pi.lastName || data.lastName || '',
    email: pi.email || data.email || '',
    phone: pi.phone || data.phone,
    city: pi.location?.split(',')[0]?.trim() || pi.city || data.city,
    country: pi.location?.split(',')[1]?.trim() || pi.country || data.country,
    bio: pi.summary || pi.bio || data.bio || data.summary,
    skills: flatSkills,
    languages,
    interests: data.interests,
    goals: data.goals,
    experiences,
    education,
    certifications,
    other: otherSections,
  };
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
async function generateXLSX(title: string, data: any, language?: string): Promise<Buffer> {
  const tr = (key: string) => i18next.t(key, { lng: language });
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
    sheet.addRow([tr('copilot:docColumnSection'), tr('copilot:docColumnContent')]);
    sheet.getRow(1).font = { bold: true };
    for (const section of data.sections) {
      sheet.addRow([section.heading, section.body]);
    }
    sheet.columns.forEach((col) => {
      col.width = 40;
    });
  } else {
    // Raw data
    sheet.addRow([tr('copilot:docLabelData')]);
    sheet.addRow([JSON.stringify(data, null, 2)]);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Generate a CSV string from structured content
 */
function generateCSV(data: any, language?: string): string {
  const tr = (key: string) => i18next.t(key, { lng: language });
  if (isTableContent(data)) {
    return stringify([data.headers, ...data.rows]);
  }
  if (isSectionContent(data)) {
    const rows = data.sections.map((s) => [s.heading, s.body]);
    return stringify([[tr('copilot:docColumnSection'), tr('copilot:docColumnContent')], ...rows]);
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

/**
 * Factory: create generate_document tool with injected talentId
 * The generated document is auto-saved to the user's documents library
 * and triggers the extraction + skill merge pipeline.
 */
export function createGenerateDocumentTool(talentId: string, avatarUrl?: string, organizationId?: string, language?: string) {
  const contentJsonDescription = [
    'Content as JSON object or JSON string.',
    'STRICT CV/resume canonical contract (root fields only, no wrappers):',
    toTOON(CV_CONTENT_CONTRACT),
    'IMPORTANT CV RULES: (a) Use "bio" not "summary", "experiences" not "experience", "institution" not "school", "period" not "startDate/endDate", "description" not "bullets", "language" not "name" in languages. Each skill MUST carry its catalog "type" (one of: knowledge, hard_skill, soft_skill, tool_platform, language) and "level" (one of: beginner, intermediate, advanced, master) exactly as returned by sql_query(my_skills) — these drive the CV color coding and proficiency bars. Do NOT invent a type or use legacy labels like "hard"/"soft".',
    '(b) Use ONLY real data from sql_query/file_reader — NEVER invent or modify personal info. If email is null in profile, OMIT the email field. If no LinkedIn in source data, OMIT it. NEVER fabricate emails, URLs, certifications, or dates.',
    '(c) Do NOT wrap in {type:"cv", profile:{...}} — put fields at root level.',
    'Other supported contracts:',
    'Org document:',
    toTOON(ORG_DOCUMENT_CONTRACT),
    'Sections:',
    toTOON(SECTIONS_CONTRACT),
    'Table:',
    toTOON(TABLE_CONTRACT),
  ].join('\n');

  return defineTool({
    name: 'generate_document',
    description:
      'Generate a downloadable document (CV, report, job description, data export). Supports PDF, DOCX, XLS, CSV, TXT formats. Use AFTER gathering data via sql_query or smart_search. Returns a persistent download URL and document ID. The document is automatically saved to the user documents library. For CV generation, use the CV JSON format (see contentJson description).',
    parameters: z.object({
      format: z
        .string()
        .default('PDF')
        .describe('Output format: PDF (default, good for CVs/reports), DOCX (editable), XLS (spreadsheets), CSV (data export), TXT (plain text)'),
      title: z.string().describe('Document title displayed at the top of the generated file'),
      contentJson: z
        .union([z.string(), z.record(z.string(), z.unknown())])
        .describe(contentJsonDescription),
      instructions: z.string().optional().describe('Generation instructions describing the purpose and style of the document'),
    }),
    normalize: (raw) => {
      // Handle aliases: content → contentJson, content_json → contentJson, type → format
      return {
        ...raw,
        format: raw.format || raw.type || raw.output_format || 'PDF',
        title: raw.title || raw.name || raw.documentTitle || 'Document',
        contentJson: raw.contentJson || raw.content_json || raw.content || raw.data || '',
        instructions: raw.instructions || raw.instruction || raw.description,
      };
    },
    execute: async ({ format: rawFormat, title, contentJson, instructions }) => {
      const tr = (key: string, options?: Record<string, any>) => i18next.t(key, { lng: language, ...(options || {}) });
      try {
        // Debit credits for document generation
        const isOrgScope = !!organizationId;
        const debitActionCode = isOrgScope ? 'ORG_DOCUMENT_GENERATION' : 'TALENT_DOCUMENT_GENERATION';
        const debitOwnerId = isOrgScope ? organizationId! : talentId;
        const debitIdempotencyKey = `docgen_${debitOwnerId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        try {
          await debitWalletForAction({
            scope: isOrgScope ? 'ORGANIZATION' : 'TALENT',
            ownerId: debitOwnerId,
            actionCode: debitActionCode,
            idempotencyKey: debitIdempotencyKey,
            metadata: { title, format: rawFormat },
            createdBy: talentId,
          });
        } catch (debitError: any) {
          if (String(debitError?.message || '').includes('INSUFFICIENT_CREDITS')) {
            return { success: false, error: tr('billing:insufficientCredits') };
          }
          throw debitError;
        }

        // Normalize format to uppercase (some providers may send lowercase)
        const format = typeof rawFormat === 'string' ? rawFormat.toUpperCase() : 'PDF';
        if (!FORMAT_EXTENSIONS[format]) {
          return { success: false, error: tr('copilot:toolFormatUnsupported', { format: rawFormat }) };
        }
        // Accept contentJson as object or string
        let data: any;
        try {
          data = typeof contentJson === 'object' ? contentJson : JSON.parse(contentJson);
        } catch (parseErr) {
          return { success: false, error: tr('copilot:toolInvalidContentJson') };
        }
        const documentId = uuidv4();
        const extension = FORMAT_EXTENSIONS[format];
        const mimeType = FORMAT_MIMETYPES[format];
        const safeTitle = title.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50);
        const storedFilename = `${documentId}.${extension}`;
        const filename = `${safeTitle}.${extension}`;

        // Store in user's document folder (same path as uploaded documents)
        const storagePath = `documents/${talentId}/${storedFilename}`;

        let buffer: Buffer;
        let isCV = false;

        switch (format) {
          case 'PDF':
            // Route CV-structured content to the specialized elegant generator
            if (isCVContent(data)) {
              isCV = true;
              const cvData = normalizeCVData(data, language);
              // Inject user's avatar if available, not already provided, and not explicitly excluded
              if (avatarUrl && !cvData.avatarUrl && cvData.includePhoto !== false) {
                cvData.avatarUrl = avatarUrl;
              }
              buffer = await generateCVPDF(cvData);
            } else if (isOrgDocumentContent(data)) {
              // Route org-branded documents (fiche de poste, rapport) to org generator
              buffer = await generateOrgDocumentPDF(title, data);
            } else {
              buffer = await generatePDF(title, data);
            }
            break;
          case 'DOCX':
            buffer = await generateDOCX(title, data);
            break;
          case 'XLS':
            buffer = await generateXLSX(title, data, language);
            break;
          case 'CSV': {
            const csv = generateCSV(data, language);
            buffer = Buffer.from(csv, 'utf-8');
            break;
          }
          case 'TXT': {
            const txt = generateTXT(title, data);
            buffer = Buffer.from(txt, 'utf-8');
            break;
          }
          default:
            return { success: false, error: tr('copilot:toolFormatUnsupported', { format }) };
        }

        // Upload to storage
        const isOrgDoc = !!organizationId && isOrgDocumentContent(data);
        const storagePath2 = isOrgDoc
          ? `documents/org/${organizationId}/${storedFilename}`
          : storagePath;
        const fileUrl = await uploadFile(buffer, storagePath2, mimeType);

        if (isOrgDoc) {
          // Save to organization_documents (NOT talent_documents)
          await pool.query(
            `INSERT INTO organization_documents (
              id, organization_id, uploaded_by, original_filename, stored_filename, mime_type,
              file_size, file_url, document_type, category, status,
              title, description, is_public
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
            [
              documentId,
              organizationId,
              talentId,
              filename,
              storedFilename,
              mimeType,
              buffer.length,
              fileUrl,
              'REPORT',
              'OTHER',
              'PROCESSED',
              title,
              `Document generated by copilot${instructions ? ': ' + instructions.slice(0, 200) : ''}`,
              false,
            ]
          );
        } else {
          // Save to talent_documents (personal library)
          await pool.query(
            `INSERT INTO talent_documents (
              id, talent_id, original_filename, stored_filename, mime_type,
              file_size, file_url, document_type, category, status,
              title, description, is_public
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
            [
              documentId,
              talentId,
              filename,
              storedFilename,
              mimeType,
              buffer.length,
              fileUrl,
              isCV ? 'CV' : 'OTHER',
              'PROFESSIONAL',
              'PENDING',
              title,
              `Document generated by copilot${instructions ? ': ' + instructions.slice(0, 200) : ''}`,
              false,
            ]
          );

          // Copilot-GENERATED documents are derived from the talent's existing
          // profile, not new evidence — do NOT run skill extraction on them. Doing
          // so inflated the profile with whatever the agent wrote (e.g. tools named
          // in an interview guide became "skills"). Just mark processed so the file
          // stays available to file_reader and downloads. Skill extraction remains
          // for genuinely user-uploaded documents (separate upload pipeline).
          pool.query(
            `UPDATE talent_documents SET status = 'PROCESSED', processed_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [documentId]
          ).catch(() => {});
        }

        logger.info(`[generate_document] Generated & saved ${format} document: ${filename} (${buffer.length} bytes) → ${documentId}`);

        return {
          success: true,
          id: documentId,
          documentType: format,
          downloadUrl: fileUrl,
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
          error: tr('copilot:toolDocumentGenerationError', { error: error.message }),
        };
      }
    },
  });
}
