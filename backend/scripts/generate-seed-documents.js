#!/usr/bin/env node
/**
 * Generate realistic PDF documents (CV, certificates) for seed talents.
 * Output under uploads/seed/documents/<talentSlug>/...
 *
 * No external network. Uses pdfkit already in dependencies.
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const PDFDocument = require('pdfkit');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'uploads', 'seed', 'documents');

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function writePdf(filePath, buildFn) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const stream = fs.createWriteStream(filePath);
    stream.on('finish', resolve);
    stream.on('error', reject);
    doc.pipe(stream);
    try {
      buildFn(doc);
      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

function header(doc, title, subtitle) {
  doc
    .fillColor('#111827')
    .fontSize(20)
    .text(title, { align: 'left' })
    .moveDown(0.2);

  if (subtitle) {
    doc
      .fillColor('#374151')
      .fontSize(11)
      .text(subtitle)
      .moveDown(1);
  } else {
    doc.moveDown(1);
  }

  doc
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .lineWidth(1)
    .strokeColor('#E5E7EB')
    .stroke()
    .moveDown(1);
}

function section(doc, name) {
  doc.fillColor('#111827').fontSize(12).text(name).moveDown(0.3);
  doc.strokeColor('#F3F4F6').lineWidth(1);
}

function bullet(doc, text) {
  doc.fillColor('#111827').fontSize(11).text(`• ${text}`, { indent: 16 });
}

const TALENTS = [
  {
    slug: 'lamine-barro',
    name: 'Lamine Barro',
    email: 'etudesksas@gmail.com',
    phone: '+2250574631148',
    city: 'Abidjan',
    country: 'CI',
    title: 'Founder / Product & Strategy',
    skills: ['Product Strategy', 'Execution', 'Partnerships', 'Leadership', 'EdTech'],
  },
  {
    slug: 'aminata-kone',
    name: 'Aminata Koné',
    email: 'aminata.kone@etudesk.demo',
    phone: '+2250701010101',
    city: 'Abidjan',
    country: 'CI',
    title: 'Développeuse Full Stack',
    skills: ['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'Testing'],
  },
  {
    slug: 'awa-diop',
    name: 'Awa Diop',
    email: 'awa.diop@etudesk.demo',
    phone: '+221770404040',
    city: 'Dakar',
    country: 'SN',
    title: 'Data Analyst',
    skills: ['SQL', 'Power BI', 'KPI', 'Cohorts', 'Storytelling data'],
  },
  {
    slug: 'ousmane-gueye',
    name: 'Ousmane Gueye',
    email: 'ousmane.gueye@etudesk.demo',
    phone: '+221780808080',
    city: 'Thiès',
    country: 'SN',
    title: 'DevOps Engineer',
    skills: ['Docker', 'CI/CD', 'Linux', 'Observability', 'Cloud basics'],
  },
  {
    slug: 'kadiatou-coulibaly',
    name: 'Kadiatou Coulibaly',
    email: 'kadiatou.coulibaly@etudesk.demo',
    phone: '+2250707070707',
    city: 'Abidjan',
    country: 'CI',
    title: 'Talent Acquisition / HR',
    skills: ['Recruiting', 'People Ops', 'Process', 'Interviewing', 'Culture'],
  },
  {
    slug: 'estelle-zongo',
    name: 'Estelle Zongo',
    email: 'estelle.zongo@etudesk.demo',
    phone: '+226700181818',
    city: 'Bobo-Dioulasso',
    country: 'BF',
    title: 'UX/UI Designer',
    skills: ['Figma', 'UX Research', 'Design systems', 'Mobile UX', 'Accessibility'],
  },
  {
    slug: 'moussa-diallo',
    name: 'Moussa Diallo',
    email: 'moussa.diallo@etudesk.demo',
    phone: '+2250702020202',
    city: 'Yamoussoukro',
    country: 'CI',
    title: 'Assistant Ops (Stage)',
    skills: ['Excel', 'Planning', 'Reporting', 'Coordination', 'Field operations'],
  },
  {
    slug: 'mariama-faye',
    name: 'Mariama Faye',
    email: 'mariama.faye@etudesk.demo',
    phone: '+221760111111',
    city: 'Dakar',
    country: 'SN',
    title: 'Community Builder',
    skills: ['Community', 'Moderation', 'Writing', 'Events', 'Content'],
  },
];

async function main() {
  ensureDir(OUT_DIR);

  for (const t of TALENTS) {
    const dir = path.join(OUT_DIR, t.slug);
    ensureDir(dir);

    const cvFile = path.join(dir, `CV_${t.slug}.pdf`);
    await writePdf(cvFile, (doc) => {
      header(doc, `CV - ${t.name}`, `${t.title} • ${t.city}, ${t.country}`);

      doc.fillColor('#111827').fontSize(11).text(`Email: ${t.email}`);
      doc.text(`Téléphone: ${t.phone}`);
      doc.moveDown(1);

      section(doc, 'Résumé');
      doc.fillColor('#374151').fontSize(11).text(
        `Profil seed Etudesk OS (démonstration). Orientation impact, exécution et apprentissage continu. ` +
          `Disponible pour des missions pertinentes.`
      );
      doc.moveDown(1);

      section(doc, 'Compétences clés');
      t.skills.forEach((s) => bullet(doc, s));
      doc.moveDown(1);

      section(doc, 'Expérience (exemples)');
      bullet(doc, 'Projet: amélioration onboarding (analyse + itérations).');
      bullet(doc, 'Livraison d’un livrable clair (dashboard, API, atelier, etc.).');
      bullet(doc, 'Collaboration multi-profils (tech, ops, contenu).');
      doc.moveDown(1);

      section(doc, 'Formation');
      doc.fillColor('#374151').fontSize(11).text('Détails volontairement simplifiés pour le seed.');
      doc.moveDown(1);

      doc
        .fillColor('#9CA3AF')
        .fontSize(9)
        .text('Document généré automatiquement pour dataset de démonstration (Etudesk OS).', {
          align: 'left',
        });
    });

    // Optional certificate (only for a subset)
    if (['aminata-kone', 'awa-diop', 'estelle-zongo'].includes(t.slug)) {
      const certFile = path.join(dir, `CERT_${t.slug}.pdf`);
      await writePdf(certFile, (doc) => {
        header(doc, 'Attestation', 'Dataset de démonstration');
        doc
          .fillColor('#111827')
          .fontSize(13)
          .text(`Attestation de participation (seed)`, { align: 'center' })
          .moveDown(1);
        doc
          .fillColor('#374151')
          .fontSize(11)
          .text(
            `Nous attestons que ${t.name} a participé à un atelier de démonstration ` +
              `dans Etudesk OS (contenu: employabilité, data, ou produit).`,
            { align: 'left' }
          )
          .moveDown(2);
        doc.fillColor('#111827').text('Fait à Abidjan, le ' + new Date().toISOString().slice(0, 10));
        doc.moveDown(2);
        doc.fillColor('#111827').text('Etudesk SAS');
      });
    }
  }

  // quick summary
  const files = await fsp.readdir(OUT_DIR, { recursive: true });
  const pdfs = files.filter((f) => String(f).toLowerCase().endsWith('.pdf'));
  console.log(`Wrote ${pdfs.length} PDFs under uploads/seed/documents`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

