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

// --- Chart Palette (same order as mobile) ---

const CHART_PALETTE = ['#3B2416', '#4A6741', '#A67C52', '#8B4A3C', '#5E6B52', '#6B525E', '#52656B'];

// --- Data Structure ---

export interface ChartData {
  type: 'bar' | 'donut' | 'line' | 'table' | 'metric';
  title?: string;
  data: any;
  // donut-specific
  total_label?: string;
  // metric-specific
  value?: number;
  unit?: string;
  trend?: { direction: 'up' | 'down'; delta: number; period?: string };
  // table-specific
  columns?: string[];
  rows?: any[][];
}

export interface OrgDocumentData {
  organizationName: string;
  organizationCity?: string;
  organizationCountry?: string;
  logoUrl?: string;
  documentDate?: string;
  sections: Array<{ heading: string; body: string; chart?: ChartData }>;
}

/** Detect OrgDocumentData-structured content */
export function isOrgDocumentContent(data: any): data is OrgDocumentData {
  return data && typeof data.organizationName === 'string' && Array.isArray(data.sections);
}

// --- Helpers ---

function needsNewPage(currentY: number, neededHeight: number): boolean {
  return currentY + neededHeight > PAGE.height - FOOTER_HEIGHT - 20;
}

/** Parse hex color to RGB components (0-1 range) */
function hexToRGB(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16) / 255,
    parseInt(h.substring(2, 4), 16) / 255,
    parseInt(h.substring(4, 6), 16) / 255,
  ];
}

/** Get palette color by index (cycles) */
function paletteColor(i: number): string {
  return CHART_PALETTE[i % CHART_PALETTE.length];
}

// --- Chart Drawing Functions ---

/**
 * Draw a horizontal bar chart.
 * data: Array<{ label: string; value: number }>
 * Returns new Y position after chart.
 */
function drawBarChart(doc: PDFKit.PDFDocument, chart: ChartData, x: number, y: number, w: number): number {
  const items: Array<{ label: string; value: number }> = Array.isArray(chart.data) ? chart.data : [];
  if (items.length === 0) return y;

  const LABEL_WIDTH = 80;
  const BAR_HEIGHT = 18;
  const GAP = 6;
  const barAreaWidth = w - LABEL_WIDTH - 40; // space for value text
  const maxVal = Math.max(...items.map((d) => d.value), 1);

  // Title
  if (chart.title) {
    doc.fontSize(9).font(F.bold).fillColor(C.primary);
    doc.text(chart.title, x, y, { width: w });
    y += doc.heightOfString(chart.title, { width: w }) + 8;
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const label = (item.label || '').slice(0, 18);
    const barWidth = Math.max(2, (item.value / maxVal) * barAreaWidth);
    const color = paletteColor(i);

    // Label (left)
    doc.fontSize(8).font(F.regular).fillColor(C.textSecondary);
    doc.text(label, x, y + 3, { width: LABEL_WIDTH, lineBreak: false });

    // Bar
    const barX = x + LABEL_WIDTH;
    doc.roundedRect(barX, y, barWidth, BAR_HEIGHT, 3).fillColor(color).fill();

    // Value (right of bar)
    doc.fontSize(8).font(F.bold).fillColor(C.textPrimary);
    doc.text(String(item.value), barX + barWidth + 6, y + 3, { width: 40, lineBreak: false });

    y += BAR_HEIGHT + GAP;
  }

  return y + 6;
}

/**
 * Draw a donut chart with legend.
 * data: Array<{ label: string; value: number }>
 * Returns new Y position after chart.
 */
function drawDonutChart(doc: PDFKit.PDFDocument, chart: ChartData, x: number, y: number, _w: number): number {
  const items: Array<{ label: string; value: number }> = Array.isArray(chart.data) ? chart.data : [];
  if (items.length === 0) return y;

  const total = items.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) return y;

  const OUTER_R = 55;
  const INNER_R = 35;
  const cx = x + OUTER_R + 10;
  const cy = y + OUTER_R + (chart.title ? 20 : 0);

  // Title
  if (chart.title) {
    doc.fontSize(9).font(F.bold).fillColor(C.primary);
    doc.text(chart.title, x, y, { width: _w });
    y += doc.heightOfString(chart.title, { width: _w }) + 8;
  }

  const startY = y;

  // Draw arc segments using PDFKit path with SVG-style arcs
  let startAngle = -Math.PI / 2; // start from top
  for (let i = 0; i < items.length; i++) {
    const fraction = items[i].value / total;
    const endAngle = startAngle + fraction * 2 * Math.PI;
    const color = paletteColor(i);

    // Calculate arc points
    const x1 = cx + OUTER_R * Math.cos(startAngle);
    const y1 = cy + OUTER_R * Math.sin(startAngle);
    const x2 = cx + OUTER_R * Math.cos(endAngle);
    const y2 = cy + OUTER_R * Math.sin(endAngle);
    const x3 = cx + INNER_R * Math.cos(endAngle);
    const y3 = cy + INNER_R * Math.sin(endAngle);
    const x4 = cx + INNER_R * Math.cos(startAngle);
    const y4 = cy + INNER_R * Math.sin(startAngle);

    const largeArc = fraction > 0.5 ? 1 : 0;

    // Draw the segment: outer arc → line to inner → inner arc back → close
    doc.save();
    doc.path(
      `M ${x1} ${y1} A ${OUTER_R} ${OUTER_R} 0 ${largeArc} 1 ${x2} ${y2} ` +
      `L ${x3} ${y3} A ${INNER_R} ${INNER_R} 0 ${largeArc} 0 ${x4} ${y4} Z`
    ).fillColor(color).fill();
    doc.restore();

    startAngle = endAngle;
  }

  // Center: white circle + total
  doc.circle(cx, cy, INNER_R - 1).fillColor(C.white).fill();
  const totalStr = String(total);
  doc.fontSize(16).font(F.bold).fillColor(C.primary);
  const tw = doc.widthOfString(totalStr);
  doc.text(totalStr, cx - tw / 2, cy - 10, { lineBreak: false });
  if (chart.total_label) {
    doc.fontSize(7).font(F.regular).fillColor(C.textTertiary);
    const lw = doc.widthOfString(chart.total_label);
    doc.text(chart.total_label, cx - lw / 2, cy + 6, { lineBreak: false });
  }

  // Legend (right of donut)
  const legendX = cx + OUTER_R + 24;
  let legendY = startY + 10;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const color = paletteColor(i);
    const pct = Math.round((item.value / total) * 100);

    // Color swatch
    doc.roundedRect(legendX, legendY, 10, 10, 2).fillColor(color).fill();

    // Label + percentage
    doc.fontSize(8).font(F.regular).fillColor(C.textPrimary);
    doc.text(`${(item.label || '').slice(0, 20)} (${pct}%)`, legendX + 16, legendY + 1, {
      width: 160,
      lineBreak: false,
    });

    legendY += 16;
  }

  return Math.max(cy + OUTER_R + 10, legendY + 6);
}

/**
 * Draw a line chart.
 * data: Array<{ label: string; value: number }>
 * Returns new Y position after chart.
 */
function drawLineChart(doc: PDFKit.PDFDocument, chart: ChartData, x: number, y: number, w: number): number {
  const items: Array<{ label: string; value: number }> = Array.isArray(chart.data) ? chart.data : [];
  if (items.length < 2) return y;

  const PLOT_HEIGHT = 120;
  const LEFT_MARGIN = 35;
  const BOTTOM_MARGIN = 20;
  const plotW = w - LEFT_MARGIN - 10;
  const plotH = PLOT_HEIGHT - BOTTOM_MARGIN;

  // Title
  if (chart.title) {
    doc.fontSize(9).font(F.bold).fillColor(C.primary);
    doc.text(chart.title, x, y, { width: w });
    y += doc.heightOfString(chart.title, { width: w }) + 8;
  }

  const plotX = x + LEFT_MARGIN;
  const plotY = y;
  const maxVal = Math.max(...items.map((d) => d.value), 1);

  // Grid lines (3 horizontal)
  for (let g = 0; g <= 2; g++) {
    const gy = plotY + (plotH * g) / 2;
    const gridVal = Math.round(maxVal * (1 - g / 2));
    doc.moveTo(plotX, gy).lineTo(plotX + plotW, gy)
      .lineWidth(0.3).strokeColor(C.borderLight).dash(3, { space: 3 }).stroke().undash();
    doc.fontSize(7).font(F.regular).fillColor(C.textTertiary);
    doc.text(String(gridVal), x, gy - 4, { width: LEFT_MARGIN - 6, align: 'right', lineBreak: false });
  }

  // Plot line + points
  const points: Array<{ px: number; py: number }> = items.map((item, i) => ({
    px: plotX + (i / (items.length - 1)) * plotW,
    py: plotY + plotH - (item.value / maxVal) * plotH,
  }));

  // Line
  doc.moveTo(points[0].px, points[0].py);
  for (let i = 1; i < points.length; i++) {
    doc.lineTo(points[i].px, points[i].py);
  }
  doc.lineWidth(2).strokeColor(C.primary).stroke();

  // Points
  for (const p of points) {
    doc.circle(p.px, p.py, 3).fillColor(C.accent).fill();
  }

  // X labels (max 6)
  const step = Math.max(1, Math.ceil(items.length / 6));
  const labelY = plotY + plotH + 4;
  for (let i = 0; i < items.length; i += step) {
    const label = (items[i].label || '').slice(0, 8);
    doc.fontSize(7).font(F.regular).fillColor(C.textTertiary);
    doc.text(label, points[i].px - 20, labelY, { width: 40, align: 'center', lineBreak: false });
  }

  return plotY + PLOT_HEIGHT + 10;
}

/**
 * Draw a data table.
 * chart.columns: string[], chart.rows: any[][] (or chart.data with columns/rows)
 * Returns new Y position after table.
 */
function drawTable(doc: PDFKit.PDFDocument, chart: ChartData, x: number, y: number, w: number): number {
  const columns: string[] = chart.columns || (chart.data?.columns) || [];
  const rows: any[][] = chart.rows || (chart.data?.rows) || (Array.isArray(chart.data) ? [] : []);
  if (columns.length === 0) return y;

  const nCols = columns.length;
  const colWidth = Math.max(60, w / nCols);
  const ROW_HEIGHT = 20;
  const HEADER_HEIGHT_T = 22;

  // Title
  if (chart.title) {
    doc.fontSize(9).font(F.bold).fillColor(C.primary);
    doc.text(chart.title, x, y, { width: w });
    y += doc.heightOfString(chart.title, { width: w }) + 8;
  }

  // Header row
  doc.rect(x, y, Math.min(colWidth * nCols, w), HEADER_HEIGHT_T).fillColor(C.surface).fill();
  for (let c = 0; c < nCols; c++) {
    doc.fontSize(7).font(F.bold).fillColor(C.primary);
    doc.text((columns[c] || '').toUpperCase(), x + c * colWidth + 4, y + 5, {
      width: colWidth - 8,
      lineBreak: false,
    });
  }
  y += HEADER_HEIGHT_T;

  // Data rows
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];

    // Alternating row bg
    if (r % 2 === 1) {
      doc.rect(x, y, Math.min(colWidth * nCols, w), ROW_HEIGHT).fillColor(C.surface).fill();
    }

    // Bottom border
    doc.moveTo(x, y + ROW_HEIGHT).lineTo(x + Math.min(colWidth * nCols, w), y + ROW_HEIGHT)
      .lineWidth(0.3).strokeColor(C.borderLight).stroke();

    for (let c = 0; c < nCols; c++) {
      const cellVal = row[c] != null ? String(row[c]) : '';
      doc.fontSize(8).font(F.regular).fillColor(C.textPrimary);
      doc.text(cellVal.slice(0, 30), x + c * colWidth + 4, y + 5, {
        width: colWidth - 8,
        lineBreak: false,
      });
    }
    y += ROW_HEIGHT;
  }

  return y + 8;
}

/**
 * Draw a metric card (single KPI).
 * chart.value: number, chart.unit: string, chart.trend: { direction, delta, period }
 * Returns new Y position after card.
 */
function drawMetricCard(doc: PDFKit.PDFDocument, chart: ChartData, x: number, y: number, w: number): number {
  const CARD_HEIGHT = 70;
  const PADDING = 12;

  // Card background
  doc.roundedRect(x, y, w, CARD_HEIGHT, 6).fillColor(C.surface).fill();
  doc.roundedRect(x, y, w, CARD_HEIGHT, 6).lineWidth(0.5).strokeColor(C.border).stroke();

  const innerX = x + PADDING;
  let innerY = y + PADDING;

  // Title
  if (chart.title) {
    doc.fontSize(8).font(F.regular).fillColor(C.textTertiary);
    doc.text(chart.title.toUpperCase(), innerX, innerY, { width: w - PADDING * 2, characterSpacing: 0.5 });
    innerY += 14;
  }

  // Value + unit
  const displayValue = chart.value != null ? String(chart.value) : (chart.data?.value != null ? String(chart.data.value) : '—');
  const unit = chart.unit || chart.data?.unit || '';
  doc.fontSize(22).font(F.bold).fillColor(C.primary);
  doc.text(displayValue + (unit ? ` ${unit}` : ''), innerX, innerY, { width: w - PADDING * 2, lineBreak: false });

  // Trend indicator
  const trend = chart.trend || chart.data?.trend;
  if (trend) {
    const isUp = trend.direction === 'up';
    const trendColor = isUp ? C.success : '#8B4A3C';
    const arrow = isUp ? '\u25B2' : '\u25BC'; // ▲ or ▼
    const trendText = `${arrow} ${trend.delta}%${trend.period ? ' ' + trend.period : ''}`;

    doc.fontSize(8).font(F.bold).fillColor(trendColor);
    doc.text(trendText, innerX + 160, innerY + 6, { width: w - PADDING * 2 - 160, lineBreak: false });
  }

  return y + CARD_HEIGHT + 10;
}

/**
 * Router: draw any chart type. Returns new Y position.
 */
function drawChart(doc: PDFKit.PDFDocument, chart: ChartData, x: number, y: number, w: number): number {
  switch (chart.type) {
    case 'bar':
      return drawBarChart(doc, chart, x, y, w);
    case 'donut':
      return drawDonutChart(doc, chart, x, y, w);
    case 'line':
      return drawLineChart(doc, chart, x, y, w);
    case 'table':
      return drawTable(doc, chart, x, y, w);
    case 'metric':
      return drawMetricCard(doc, chart, x, y, w);
    default:
      logger.warn(`[org-doc-pdf] Unknown chart type: ${(chart as any).type}`);
      return y;
  }
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

        // --- CHART (if present in section) ---
        if (section.chart) {
          y += 4;
          // Estimate chart height for pagination
          const chartHeight = section.chart.type === 'metric' ? 80
            : section.chart.type === 'table' ? 30 + ((section.chart.rows || section.chart.data?.rows || []).length + 1) * 20
            : section.chart.type === 'donut' ? 130
            : section.chart.type === 'line' ? 140
            : 24 * (Array.isArray(section.chart.data) ? section.chart.data.length : 3) + 30;

          if (needsNewPage(y, chartHeight)) {
            doc.addPage({ size: 'A4', margin: PAGE.marginX });
            y = PAGE.marginTop;
          }
          y = drawChart(doc, section.chart, PAGE.marginX, y, CONTENT_WIDTH);
        }

        y += 14;
      }

      // --- FOOTER on every page ---
      const range = doc.bufferedPageRange();
      const totalPages = range.count;
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);

        const footerY = PAGE.height - FOOTER_HEIGHT;
        doc.moveTo(PAGE.marginX, footerY)
          .lineTo(PAGE.width - PAGE.marginX, footerY)
          .lineWidth(0.3).strokeColor(C.borderLight).stroke();

        // Use doc.page.write via _fragment helper to avoid auto-pagination
        // Position cursor exactly and write with lineBreak: false + height: FOOTER_HEIGHT
        doc.fontSize(6.5).font(F.oblique).fillColor(C.textTertiary);
        doc.text(`${data.organizationName} — Etudesk`, PAGE.marginX, footerY + 8, {
          width: CONTENT_WIDTH / 2,
          height: FOOTER_HEIGHT,
          align: 'left',
          lineBreak: false,
        });

        if (totalPages > 1) {
          doc.fontSize(6.5).font(F.regular).fillColor(C.textTertiary);
          doc.text(`${i + 1} / ${totalPages}`, PAGE.marginX + CONTENT_WIDTH / 2, footerY + 8, {
            width: CONTENT_WIDTH / 2,
            height: FOOTER_HEIGHT,
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
