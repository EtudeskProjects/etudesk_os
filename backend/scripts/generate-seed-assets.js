#!/usr/bin/env node
/**
 * Generates local SVG assets for seed data (African-only stylized avatars + covers).
 *
 * Output:
 * - uploads/seed/avatars/<slug>.svg
 * - uploads/seed/covers/<name>.svg
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const AVATAR_DIR = path.join(ROOT, 'uploads', 'seed', 'avatars');
const COVER_DIR = path.join(ROOT, 'uploads', 'seed', 'covers');

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function writeFileSafe(filePath, content) {
  fs.writeFileSync(filePath, content, 'utf8');
}

function svgWrap({ width, height, content }) {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">\n` +
    content +
    `\n</svg>\n`
  );
}

function avatarSvg({ seed, label }) {
  // Dark skin palette (stylized). Keep it clearly African-coded without using real photos.
  const skins = ['#7A4A2A', '#6B3F27', '#8B5A2B', '#5A341F', '#9A6A3B'];
  const hair = ['#1A1A1A', '#101010', '#2A1B14'];
  const fabrics = ['#C45A2B', '#1F7A6D', '#D2A02E', '#6D2C91', '#2B5BC4', '#B11E3B'];
  const bg = ['#0F172A', '#1B2A2F', '#2A1F2D', '#1A2B1F', '#2B241A'];

  const skin = skins[seed % skins.length];
  const hairC = hair[seed % hair.length];
  const fabric = fabrics[seed % fabrics.length];
  const bgC = bg[seed % bg.length];

  // Geometric pattern inspired by West African textile motifs (abstract).
  const pattern = `
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${bgC}"/>
        <stop offset="1" stop-color="#0B1020"/>
      </linearGradient>
      <pattern id="p" width="24" height="24" patternUnits="userSpaceOnUse">
        <rect width="24" height="24" fill="none"/>
        <path d="M0 12h24M12 0v24" stroke="rgba(255,255,255,0.06)" stroke-width="2"/>
        <path d="M0 0l24 24M24 0L0 24" stroke="rgba(255,255,255,0.04)" stroke-width="2"/>
        <circle cx="12" cy="12" r="3" fill="rgba(255,255,255,0.06)"/>
      </pattern>
      <filter id="s" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="rgba(0,0,0,0.35)"/>
      </filter>
    </defs>
  `;

  const content = `
    ${pattern}
    <rect width="400" height="400" fill="url(#g)"/>
    <rect width="400" height="400" fill="url(#p)"/>

    <!-- shoulders -->
    <g filter="url(#s)">
      <path d="M90 360c18-70 82-110 110-110h40c28 0 92 40 110 110" fill="${fabric}" opacity="0.95"/>
      <path d="M90 360c18-70 82-110 110-110h40c28 0 92 40 110 110" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="2"/>
    </g>

    <!-- neck -->
    <rect x="185" y="220" width="30" height="40" rx="10" fill="${skin}"/>

    <!-- head -->
    <g filter="url(#s)">
      <circle cx="200" cy="165" r="62" fill="${skin}"/>
      <!-- hair -->
      <path d="M140 165c0-46 28-82 60-82s60 36 60 82c0 0-12-30-60-30s-60 30-60 30z" fill="${hairC}"/>
      <!-- simple highlight -->
      <circle cx="178" cy="150" r="10" fill="rgba(255,255,255,0.10)"/>
    </g>

    <!-- label (subtle, for uniqueness) -->
    <text x="20" y="382" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="14" fill="rgba(255,255,255,0.55)">${escapeXml(label)}</text>
  `;

  return svgWrap({ width: 400, height: 400, content });
}

function coverSvg({ seed, title, subtitle }) {
  const palettes = [
    { a: '#0B1020', b: '#1F7A6D', c: '#D2A02E' },
    { a: '#0B1020', b: '#B11E3B', c: '#C45A2B' },
    { a: '#0B1020', b: '#2B5BC4', c: '#D2A02E' },
    { a: '#0B1020', b: '#6D2C91', c: '#1F7A6D' },
  ];
  const p = palettes[seed % palettes.length];

  const content = `
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${p.a}"/>
        <stop offset="1" stop-color="#050712"/>
      </linearGradient>
      <pattern id="k" width="56" height="56" patternUnits="userSpaceOnUse">
        <rect width="56" height="56" fill="none"/>
        <path d="M0 28h56" stroke="rgba(255,255,255,0.06)" stroke-width="3"/>
        <path d="M28 0v56" stroke="rgba(255,255,255,0.05)" stroke-width="3"/>
        <path d="M0 0l56 56M56 0L0 56" stroke="rgba(255,255,255,0.03)" stroke-width="3"/>
      </pattern>
    </defs>

    <rect width="1200" height="630" fill="url(#bg)"/>
    <rect width="1200" height="630" fill="url(#k)"/>

    <path d="M0 520c220-140 420-60 600-120s380-240 600-160v390H0z" fill="${p.b}" opacity="0.40"/>
    <path d="M0 560c280-120 420 0 620-80s320-240 580-140v290H0z" fill="${p.c}" opacity="0.30"/>

    <g>
      <text x="64" y="280" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial" font-size="56" font-weight="800" fill="rgba(255,255,255,0.92)">${escapeXml(title)}</text>
      <text x="64" y="340" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial" font-size="26" font-weight="500" fill="rgba(255,255,255,0.72)">${escapeXml(subtitle)}</text>
    </g>
  `;

  return svgWrap({ width: 1200, height: 630, content });
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const TALENTS = [
  { slug: 'lamine-barro', label: 'Lamine' },
  { slug: 'aminata-kone', label: 'Aminata' },
  { slug: 'moussa-diallo', label: 'Moussa' },
  { slug: 'fatou-traore', label: 'Fatou' },
  { slug: 'awa-diop', label: 'Awa' },
  { slug: 'ibrahim-oue', label: 'Ibrahim' },
  { slug: 'kadiatou-coulibaly', label: 'Kadiatou' },
  { slug: 'ousmane-gueye', label: 'Ousmane' },
  { slug: 'adjoua-bamba', label: 'Adjoua' },
  { slug: 'cheick-sanogo', label: 'Cheick' },
  { slug: 'mariama-faye', label: 'Mariama' },
  { slug: 'konan-yao', label: 'Konan' },
  { slug: 'ndeye-ndiaye', label: 'Ndeye' },
  { slug: 'sekou-keita', label: 'Sékou' },
  { slug: 'aicha-sow', label: 'Aïcha' },
  { slug: 'jeanne-ouattara', label: 'Jeanne' },
  { slug: 'tidiane-cisse', label: 'Tidiane' },
  { slug: 'estelle-zongo', label: 'Estelle' },
  { slug: 'boubacar-diarra', label: 'Boubacar' },
  { slug: 'coumba-fall', label: 'Coumba' },
];

const COVERS = [
  { name: 'org-etudesk-sas', title: 'Etudesk SAS', subtitle: 'Organisation de test, contenu realiste' },
  { name: 'community-tech-data', title: 'Tech & Data CI', subtitle: 'Partage, mentoring, opportunites' },
  { name: 'community-entrepreneurs', title: 'Entrepreneurs CI', subtitle: 'Marche, vente, financement' },
  { name: 'opp-fullstack', title: 'Offre: Full Stack', subtitle: 'React, Node.js, PostgreSQL' },
  { name: 'opp-data', title: 'Offre: Data Analyst', subtitle: 'SQL, Power BI, produit' },
  { name: 'opp-community', title: 'Offre: Community', subtitle: 'Contenu, moderation, croissance' },
  { name: 'opp-ux', title: 'Offre: UX/UI', subtitle: 'Mobile, accessibilite, design system' },
  { name: 'opp-devops', title: 'Offre: DevOps', subtitle: 'CI/CD, Docker, monitoring' },
  { name: 'opp-trainer', title: 'Offre: Formateur', subtitle: 'Excel, employabilite, ateliers' },
  { name: 'opp-program', title: 'Offre: Programme', subtitle: 'Impact, suivi, operations' },
  { name: 'space-formation', title: 'Salle Formation', subtitle: 'Plateau, Abidjan' },
  { name: 'space-studio', title: 'Studio', subtitle: 'Podcast, video, creation' },
];

function main() {
  ensureDir(AVATAR_DIR);
  ensureDir(COVER_DIR);

  TALENTS.forEach((t, idx) => {
    const file = path.join(AVATAR_DIR, `${t.slug}.svg`);
    writeFileSafe(file, avatarSvg({ seed: idx + 1, label: t.label }));
  });

  COVERS.forEach((c, idx) => {
    const file = path.join(COVER_DIR, `${c.name}.svg`);
    writeFileSafe(file, coverSvg({ seed: idx + 10, title: c.title, subtitle: c.subtitle }));
  });

  console.log(`Wrote ${TALENTS.length} avatars to ${path.relative(ROOT, AVATAR_DIR)}`);
  console.log(`Wrote ${COVERS.length} covers to ${path.relative(ROOT, COVER_DIR)}`);
}

main();
