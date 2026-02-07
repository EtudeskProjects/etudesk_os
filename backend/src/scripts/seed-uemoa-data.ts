/**
 * Seed UEMOA Data — Complete realistic data for West African Economic and Monetary Union
 *
 * Countries: Benin (BJ), Burkina Faso (BF), Côte d'Ivoire (CI), Guinea-Bissau (GW),
 *            Mali (ML), Niger (NE), Senegal (SN), Togo (TG)
 *
 * Usage: npx tsx src/scripts/seed-uemoa-data.ts
 */

import dotenv from 'dotenv';
dotenv.config();

import { pool } from '../services/database';
import { v4 as uuidv4 } from 'uuid';
import {
  batchUpdateTalentEmbeddings,
  batchUpdateOpportunityEmbeddings,
  batchUpdateCommunityEmbeddings,
  batchUpdateSpaceEmbeddings,
} from '../services/embedding.service';

// --- Uemoa Data Constants ---

const UEMOA_CITIES = {
  CI: [
    { city: 'Abidjan', region: 'Lagunes' },
    { city: 'Bouaké', region: 'Vallée du Bandama' },
    { city: 'Yamoussoukro', region: 'Lacs' },
    { city: 'San-Pédro', region: 'Bas-Sassandra' },
  ],
  SN: [
    { city: 'Dakar', region: 'Dakar' },
    { city: 'Thiès', region: 'Thiès' },
    { city: 'Saint-Louis', region: 'Saint-Louis' },
    { city: 'Ziguinchor', region: 'Ziguinchor' },
  ],
  ML: [
    { city: 'Bamako', region: 'Bamako' },
    { city: 'Sikasso', region: 'Sikasso' },
    { city: 'Ségou', region: 'Ségou' },
  ],
  BF: [
    { city: 'Ouagadougou', region: 'Centre' },
    { city: 'Bobo-Dioulasso', region: 'Hauts-Bassins' },
  ],
  BJ: [
    { city: 'Cotonou', region: 'Littoral' },
    { city: 'Porto-Novo', region: 'Ouémé' },
  ],
  TG: [
    { city: 'Lomé', region: 'Maritime' },
    { city: 'Sokodé', region: 'Centrale' },
  ],
  NE: [
    { city: 'Niamey', region: 'Niamey' },
    { city: 'Zinder', region: 'Zinder' },
  ],
  GW: [
    { city: 'Bissau', region: 'Bissau' },
  ],
};

const FIRST_NAMES_MALE = [
  'Amadou', 'Moussa', 'Ibrahim', 'Oumar', 'Sékou', 'Abdoulaye', 'Mamadou', 'Boubacar',
  'Issouf', 'Koffi', 'Yao', 'Konan', 'Dramane', 'Sidiki', 'Cheick', 'Alassane',
  'Tidiane', 'Ousmane', 'Mohamed', 'Adama', 'Jean-Baptiste', 'Fernand', 'Sylvain',
];

const FIRST_NAMES_FEMALE = [
  'Aminata', 'Fatou', 'Awa', 'Mariama', 'Kadiatou', 'Djénéba', 'Aïcha', 'Oumou',
  'Adjoua', 'Akissi', 'Bintou', 'Rokia', 'Safiatou', 'Ndeye', 'Coumba', 'Fatoumata',
  'Marie', 'Christine', 'Estelle', 'Pascaline', 'Jeanne', 'Céline',
];

const LAST_NAMES = [
  'Diallo', 'Traoré', 'Koné', 'Coulibaly', 'Touré', 'Ouattara', 'Sanogo', 'Sylla',
  'Keita', 'Bamba', 'Cissé', 'Diarra', 'Konaté', 'Dembélé', 'Sawadogo', 'Ouédraogo',
  'Kaboré', 'Zongo', 'Sow', 'Diop', 'Ndiaye', 'Fall', 'Gueye', 'Faye',
  'Mensah', 'Agbégnénou', 'Amoussou', 'Dossou', 'Gnassingbé', 'Adéoti',
];

const TECH_SKILLS = [
  'JavaScript', 'TypeScript', 'React', 'React Native', 'Node.js', 'Python', 'Django',
  'FastAPI', 'PostgreSQL', 'MongoDB', 'Redis', 'Docker', 'Kubernetes', 'AWS', 'GCP',
  'Azure', 'Flutter', 'Swift', 'Kotlin', 'Java', 'Spring Boot', 'PHP', 'Laravel',
  'Vue.js', 'Angular', 'Next.js', 'GraphQL', 'REST API', 'Microservices', 'DevOps',
  'CI/CD', 'Git', 'Linux', 'Terraform', 'Ansible', 'Machine Learning', 'Data Science',
  'Power BI', 'Tableau', 'Excel avancé', 'SQL', 'NoSQL', 'Figma', 'Adobe XD',
];

const SOFT_SKILLS = [
  'Communication', 'Leadership', 'Travail en équipe', 'Gestion de projet', 'Résolution de problèmes',
  'Pensée critique', 'Créativité', 'Adaptabilité', 'Gestion du temps', 'Négociation',
  'Présentation', 'Rédaction', 'Anglais professionnel', 'Français professionnel',
];

const SECTORS = [
  'Technologie', 'Finance', 'Banque', 'Assurance', 'Télécommunications', 'E-commerce',
  'Agriculture', 'Agroalimentaire', 'Énergie', 'Mines', 'BTP', 'Immobilier',
  'Santé', 'Éducation', 'Formation', 'Transport', 'Logistique', 'Tourisme',
  'Hôtellerie', 'Commerce', 'Distribution', 'Industrie', 'Textile', 'Média',
  'Marketing', 'Publicité', 'Conseil', 'Audit', 'Juridique', 'RH', 'ONG',
];

const OPPORTUNITY_TYPES = ['EMPLOYMENT', 'INTERNSHIP', 'FREELANCE', 'VOLUNTEER'];
const CONTRACT_TYPES = ['CDI', 'CDD', 'STAGE', 'FREELANCE', 'ALTERNANCE'];
const LOCATION_TYPES = ['ON_SITE', 'REMOTE', 'HYBRID'];

const COMMUNITY_TYPES = ['ONLINE', 'HYBRID', 'IN_PERSON'];

const SPACE_TYPES = [
  'MEETING_ROOM', 'COWORKING', 'TRAINING_ROOM', 'CONFERENCE_ROOM',
  'PRIVATE_OFFICE', 'EVENT_SPACE', 'STUDIO',
];

// --- Image Urls — Contextually Relevant Unsplash Images Per Entity Type ---

const AVATAR_MALE = [
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&q=80',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop&q=80',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop&q=80',
  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&h=400&fit=crop&q=80',
  'https://images.unsplash.com/photo-1506277886164-e25aa3f4ef7f?w=400&h=400&fit=crop&q=80',
  'https://images.unsplash.com/photo-1463453091185-61582044d556?w=400&h=400&fit=crop&q=80',
  'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&h=400&fit=crop&q=80',
];

const AVATAR_FEMALE = [
  'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=400&h=400&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop&q=80',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=400&fit=crop&q=80',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop&q=80',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=400&h=400&fit=crop&q=80',
];

const ORG_COVERS = [
  'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&h=400&fit=crop&q=80', // modern office
  'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=800&h=400&fit=crop&q=80', // coworking
  'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&h=400&fit=crop&q=80', // skyscraper
  'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&h=400&fit=crop&q=80', // construction
  'https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=800&h=400&fit=crop&q=80',   // startup office
  'https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?w=800&h=400&fit=crop&q=80', // solar panels
  'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&h=400&fit=crop&q=80', // team laptops
  'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=800&h=400&fit=crop&q=80', // people meeting
];

const OPPORTUNITY_COVERS = [
  'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&h=400&fit=crop&q=80', // coding laptop
  'https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?w=800&h=400&fit=crop&q=80',   // code editor
  'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&h=400&fit=crop&q=80', // code screen
  'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&h=400&fit=crop&q=80', // laptop code
  'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&h=400&fit=crop&q=80', // team working
  'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=400&fit=crop&q=80', // analytics
  'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=400&fit=crop&q=80',   // dashboard
  'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&h=400&fit=crop&q=80', // team laptops
  'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&h=400&fit=crop&q=80', // construction
  'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800&h=400&fit=crop&q=80',   // design work
  'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&h=400&fit=crop&q=80',   // whiteboard
  'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&h=400&fit=crop&q=80', // cloud/servers
];

const COMMUNITY_COVERS = [
  'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=800&h=400&fit=crop&q=80', // group meeting
  'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=800&h=400&fit=crop&q=80', // discussion
  'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=800&h=400&fit=crop&q=80', // networking
  'https://images.unsplash.com/photo-1573164713714-d95e436ab8d6?w=800&h=400&fit=crop&q=80', // women business
  'https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=800&h=400&fit=crop&q=80',   // startup
  'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&h=400&fit=crop&q=80', // coding
  'https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?w=800&h=400&fit=crop&q=80', // solar
  'https://images.unsplash.com/photo-1500595046743-cd271d694d30?w=800&h=400&fit=crop&q=80', // agriculture
];

const SPACE_COVERS = [
  'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=800&h=400&fit=crop&q=80', // coworking
  'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800&h=400&fit=crop&q=80', // conference
  'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=800&h=400&fit=crop&q=80', // classroom
  'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&h=400&fit=crop&q=80', // office
  'https://images.unsplash.com/photo-1462826303086-329426d1aef5?w=800&h=400&fit=crop&q=80', // meeting room
  'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&h=400&fit=crop&q=80', // event space
  'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&h=400&fit=crop&q=80', // open workspace
  'https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?w=800&h=400&fit=crop&q=80', // solar training
];

// --- Helper Functions ---

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomPicks<T>(arr: T[], min: number, max: number): T[] {
  const count = Math.floor(Math.random() * (max - min + 1)) + min;
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function generatePhone(country: string): string {
  const prefixes: Record<string, string> = {
    CI: '+225', SN: '+221', ML: '+223', BF: '+226',
    BJ: '+229', TG: '+228', NE: '+227', GW: '+245',
  };
  const prefix = prefixes[country] || '+225';
  const num = Math.floor(Math.random() * 90000000 + 10000000);
  return `${prefix}${num}`;
}

function generateEmail(firstName: string, lastName: string, domain: string): string {
  return `${slugify(firstName)}.${slugify(lastName)}@${domain}`.toLowerCase();
}

// --- Seed Functions ---

async function seedTalents(count: number): Promise<string[]> {
  console.log(`\n📌 Seeding ${count} talents...`);
  const talentIds: string[] = [];

  for (let i = 0; i < count; i++) {
    const isMale = Math.random() > 0.45;
    const firstName = randomPick(isMale ? FIRST_NAMES_MALE : FIRST_NAMES_FEMALE);
    const lastName = randomPick(LAST_NAMES);
    const country = randomPick(Object.keys(UEMOA_CITIES)) as keyof typeof UEMOA_CITIES;
    const location = randomPick(UEMOA_CITIES[country]);
    const id = uuidv4();
    const slug = `${slugify(firstName)}-${slugify(lastName)}-${id.slice(0, 8)}`;
    const email = generateEmail(firstName, lastName, 'gmail.com');
    const phone = generatePhone(country);

    const skills = randomPicks(TECH_SKILLS, 3, 8);
    const softSkills = randomPicks(SOFT_SKILLS, 2, 4);
    const sectors = randomPicks(SECTORS, 1, 3);
    const avatarUrl = randomPick(isMale ? AVATAR_MALE : AVATAR_FEMALE);

    const bios = [
      `Développeur passionné avec ${Math.floor(Math.random() * 8 + 2)} ans d'expérience en ${skills.slice(0, 3).join(', ')}. Basé à ${location.city}, ${country}.`,
      `Expert ${skills[0]} et ${skills[1]} cherchant de nouvelles opportunités à ${location.city}. Spécialisé dans le secteur ${sectors[0]}.`,
      `Professionnel ${sectors[0]} avec une solide expertise en ${skills.slice(0, 2).join(' et ')}. Diplômé en informatique, prêt pour de nouveaux défis.`,
      `Ingénieur logiciel basé à ${location.city}, expérimenté en ${skills.slice(0, 3).join(', ')}. Passionné par l'innovation technologique en Afrique.`,
    ];

    try {
      await pool.query(
        `INSERT INTO talents (id, slug, first_name, last_name, email, phone, bio, city, region, country, remote_ready, willing_to_relocate, sectors, profile_tags, goals, is_visible, avatar_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
         ON CONFLICT (email) DO NOTHING`,
        [
          id, slug, firstName, lastName, email, phone,
          randomPick(bios),
          location.city, location.region, country,
          Math.random() > 0.3, Math.random() > 0.6,
          sectors, skills.concat(softSkills),
          ['Trouver un emploi', 'Développer mes compétences', 'Réseauter'],
          true, avatarUrl,
        ]
      );

      // Create user for this talent
      await pool.query(
        `INSERT INTO users (id, email, email_verified, talent_id)
         VALUES ($1, $2, true, $3)
         ON CONFLICT (email) DO NOTHING`,
        [uuidv4(), email, id]
      );

      // Insert skills
      for (const skill of skills) {
        await pool.query(
          `INSERT INTO talent_skills (talent_id, canonical_name, type, proficiency_level, origin)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (talent_id, canonical_name) DO NOTHING`,
          [id, skill, 'TECHNICAL', randomPick(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']), 'declared']
        );
      }
      for (const skill of softSkills) {
        await pool.query(
          `INSERT INTO talent_skills (talent_id, canonical_name, type, proficiency_level, origin)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (talent_id, canonical_name) DO NOTHING`,
          [id, skill, 'SOFT', 'INTERMEDIATE', 'declared']
        );
      }

      talentIds.push(id);
    } catch (err: any) {
      console.error(`  Error seeding talent: ${err.message}`);
    }
  }

  console.log(`  ✓ ${talentIds.length} talents created`);
  return talentIds;
}

async function seedOrganizations(count: number, talentIds: string[]): Promise<string[]> {
  console.log(`\n🏢 Seeding ${count} organizations...`);
  const orgIds: string[] = [];

  const orgNames = [
    'TechHub Africa', 'Digital Solutions CI', 'InnoLab Dakar', 'AfriFintech',
    'Orange Digital Center', 'Jumia Tech', 'Wave Senegal', 'MTN Innovation',
    'Ecobank Digital', 'BCEAO Tech', 'Société Générale Digital', 'Total Energies CI',
    'CIE Solutions', 'SODECI Digital', 'Port Autonome Tech', 'Air Côte d\'Ivoire',
    'Coris Bank Digital', 'UBA Innovation', 'NSIA Tech', 'Atlantique Assurance',
    'Advans CI', 'Bridge Bank', 'Yup Mobile', 'Moov Africa',
    'Glovo Abidjan', 'Afrimarket', 'Kaymu Tech', 'Sénégal Numérique',
    'StartupBamakoLab', 'Niger Tech Hub', 'Ouaga Digital',
  ];

  for (let i = 0; i < count && i < orgNames.length; i++) {
    const name = orgNames[i];
    const country = randomPick(Object.keys(UEMOA_CITIES)) as keyof typeof UEMOA_CITIES;
    const location = randomPick(UEMOA_CITIES[country]);
    const id = uuidv4();
    const slug = slugify(name);
    const sectors = randomPicks(SECTORS, 1, 3);
    const createdBy = randomPick(talentIds);

    const descriptions = [
      `${name} est une entreprise leader dans le secteur ${sectors[0]} en ${country}. Nous accompagnons la transformation digitale des entreprises africaines.`,
      `Fondée à ${location.city}, ${name} développe des solutions innovantes dans le domaine ${sectors[0]}. Notre mission : accélérer le développement numérique en Afrique de l'Ouest.`,
      `${name} est un acteur majeur du ${sectors[0]} dans la zone UEMOA. Nous recrutons les meilleurs talents pour construire l'avenir de l'Afrique.`,
    ];

    try {
      await pool.query(
        `INSERT INTO organizations (id, name, slug, types, sectors, description, headquarters_city, headquarters_region, headquarters_country, verification_status, is_visible, created_by, logo_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (slug) DO NOTHING`,
        [
          id, name, slug,
          randomPicks(['STARTUP', 'PME', 'GRANDE_ENTREPRISE', 'ONG', 'INSTITUTION'], 1, 2),
          sectors, randomPick(descriptions),
          location.city, location.region, country,
          randomPick(['CLAIMED', 'VERIFIED', 'OFFICIAL']),
          true, createdBy, randomPick(ORG_COVERS),
        ]
      );

      // Add creator as OWNER
      await pool.query(
        `INSERT INTO organization_members (organization_id, talent_id, role, status)
         VALUES ($1, $2, 'OWNER', 'ACTIVE')
         ON CONFLICT (organization_id, talent_id) DO NOTHING`,
        [id, createdBy]
      );

      // Add some members
      const members = randomPicks(talentIds.filter(t => t !== createdBy), 2, 5);
      for (const memberId of members) {
        await pool.query(
          `INSERT INTO organization_members (organization_id, talent_id, role, status)
           VALUES ($1, $2, $3, 'ACTIVE')
           ON CONFLICT (organization_id, talent_id) DO NOTHING`,
          [id, memberId, randomPick(['ADMIN', 'MANAGER', 'MEMBER'])]
        );
      }

      orgIds.push(id);
    } catch (err: any) {
      console.error(`  Error seeding org: ${err.message}`);
    }
  }

  console.log(`  ✓ ${orgIds.length} organizations created`);
  return orgIds;
}

async function seedOpportunities(count: number, orgIds: string[], talentIds: string[]): Promise<string[]> {
  console.log(`\n💼 Seeding ${count} opportunities...`);
  const oppIds: string[] = [];

  const jobTitles = [
    'Développeur Full Stack Senior', 'Développeur Frontend React', 'Développeur Backend Node.js',
    'Développeur Mobile React Native', 'Développeur Flutter', 'Data Scientist',
    'Data Engineer', 'DevOps Engineer', 'Cloud Architect AWS', 'Product Manager',
    'Chef de Projet IT', 'Scrum Master', 'UX/UI Designer', 'Business Analyst',
    'Ingénieur Machine Learning', 'Administrateur Système Linux', 'DBA PostgreSQL',
    'Développeur Python/Django', 'Développeur PHP/Laravel', 'Développeur Java Spring',
    'Consultant ERP', 'Analyste Cybersécurité', 'Responsable QA', 'Tech Lead',
    'Architecte Logiciel', 'Ingénieur Intégration', 'Support Technique N2',
    'Développeur API REST', 'Ingénieur Big Data', 'Consultant BI Power BI',
  ];

  for (let i = 0; i < count && i < jobTitles.length; i++) {
    const title = jobTitles[i];
    const orgId = randomPick(orgIds);
    const country = randomPick(Object.keys(UEMOA_CITIES)) as keyof typeof UEMOA_CITIES;
    const location = randomPick(UEMOA_CITIES[country]);
    const id = uuidv4();
    const slug = `${slugify(title)}-${location.city.toLowerCase()}-${id.slice(0, 8)}`;
    const type = randomPick(OPPORTUNITY_TYPES);
    const contractType = randomPick(CONTRACT_TYPES);
    const locationType = randomPick(LOCATION_TYPES);
    const skills = randomPicks(TECH_SKILLS, 3, 6);
    const sectors = randomPicks(SECTORS, 1, 2);

    const salaryMin = Math.floor(Math.random() * 500000 + 300000);
    const salaryMax = salaryMin + Math.floor(Math.random() * 500000 + 200000);

    const summaries = [
      `Nous recherchons un(e) ${title} pour rejoindre notre équipe à ${location.city}. Vous travaillerez sur des projets innovants utilisant ${skills.slice(0, 3).join(', ')}.`,
      `Opportunité ${type === 'EMPLOYMENT' ? 'CDI' : type} pour un(e) ${title} passionné(e). Stack: ${skills.slice(0, 3).join(', ')}. Poste basé à ${location.city}, ${country}.`,
      `Rejoignez une équipe dynamique en tant que ${title}. Nous offrons un environnement de travail stimulant avec des technologies modernes (${skills.slice(0, 3).join(', ')}).`,
    ];

    const requirements = `
- ${Math.floor(Math.random() * 5 + 2)}+ ans d'expérience en développement
- Maîtrise de ${skills.slice(0, 3).join(', ')}
- Bonne connaissance des méthodologies Agile
- Capacité à travailler en équipe
- Français courant, anglais technique
    `.trim();

    try {
      await pool.query(
        `INSERT INTO opportunities (id, title, slug, type, contract_type, summary, requirements, sectors, location_type, locations, compensation_min, compensation_max, currency, compensation_frequency, status, deadline, visibility, cover_image_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
         ON CONFLICT (slug) DO NOTHING`,
        [
          id, title, slug, type, contractType,
          randomPick(summaries), requirements, sectors,
          locationType,
          JSON.stringify([{ city: location.city, country, region: location.region }]),
          salaryMin, salaryMax, 'XOF', 'MONTHLY',
          'OPEN',
          new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000), // Random deadline in next 30 days
          'PUBLIC', randomPick(OPPORTUNITY_COVERS),
        ]
      );

      // Link to organization
      await pool.query(
        `INSERT INTO opportunity_posters (opportunity_id, poster_organization_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [id, orgId]
      );

      // Create some applications
      const applicants = randomPicks(talentIds, 2, 8);
      for (const talentId of applicants) {
        await pool.query(
          `INSERT INTO opportunity_applications (talent_id, opportunity_id, status, cover_letter)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (talent_id, opportunity_id) DO NOTHING`,
          [talentId, id, randomPick(['SUBMITTED', 'IN_REVIEW', 'ACCEPTED', 'REJECTED']), `Je suis très intéressé(e) par ce poste de ${title}.`]
        );
      }

      oppIds.push(id);
    } catch (err: any) {
      console.error(`  Error seeding opportunity: ${err.message}`);
    }
  }

  console.log(`  ✓ ${oppIds.length} opportunities created`);
  return oppIds;
}

async function seedCommunities(count: number, orgIds: string[], talentIds: string[]): Promise<string[]> {
  console.log(`\n👥 Seeding ${count} communities...`);
  const commIds: string[] = [];

  const communityNames = [
    'Tech Abidjan', 'Développeurs Dakar', 'Python CI', 'React Native Africa',
    'DevOps UEMOA', 'Women in Tech Abidjan', 'Startup Weekend Bamako',
    'Femmes Entrepreneures de Côte d\'Ivoire', 'Fintech Africa', 'AI Senegal',
    'UX Design Afrique', 'Data Science Côte d\'Ivoire', 'Cloud Computing UEMOA',
    'Mobile Developers Togo', 'Entrepreneurs Numériques Niger', 'Dakar Startup Community',
    'Ouaga Tech Hub', 'Cotonou Digital', 'Lomé Innovation Lab',
    'Freelancers Africa', 'Remote Workers UEMOA', 'Tech Mentors Afrique',
  ];

  for (let i = 0; i < count && i < communityNames.length; i++) {
    const name = communityNames[i];
    const country = randomPick(Object.keys(UEMOA_CITIES)) as keyof typeof UEMOA_CITIES;
    const location = randomPick(UEMOA_CITIES[country]);
    const id = uuidv4();
    const slug = slugify(name);
    const type = randomPick(COMMUNITY_TYPES);
    const createdBy = randomPick(talentIds);
    const orgId = Math.random() > 0.5 ? randomPick(orgIds) : null;
    const isPaid = Math.random() > 0.7;

    const descriptions = [
      `${name} est une communauté de professionnels passionnés par la technologie et l'innovation. Rejoignez-nous pour networker, apprendre et grandir ensemble.`,
      `Bienvenue dans ${name} ! Nous sommes une communauté active de développeurs, designers et entrepreneurs basés en ${country}. Événements réguliers, mentoring et entraide.`,
      `${name} rassemble les talents tech de ${location.city} et au-delà. Partagez vos connaissances, trouvez des opportunités et construisons l'avenir ensemble.`,
    ];

    try {
      await pool.query(
        `INSERT INTO communities (id, name, slug, type, description, city, region, country, access_type, is_paid, monthly_price, currency, status, created_by, organization_id, cover_image_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         ON CONFLICT (slug) DO NOTHING`,
        [
          id, name, slug, type, randomPick(descriptions),
          location.city, location.region, country,
          randomPick(['PUBLIC', 'PRIVATE', 'INVITE_ONLY']),
          isPaid, isPaid ? Math.floor(Math.random() * 10000 + 5000) : null, 'XOF',
          'ACTIVE', createdBy, orgId, randomPick(COMMUNITY_COVERS),
        ]
      );

      // Add creator as ADMIN
      await pool.query(
        `INSERT INTO community_members (talent_id, community_id, role, status)
         VALUES ($1, $2, 'ADMIN', 'ACTIVE')
         ON CONFLICT (talent_id, community_id) DO NOTHING`,
        [createdBy, id]
      );

      // Add members
      const members = randomPicks(talentIds.filter(t => t !== createdBy), 5, 20);
      for (const memberId of members) {
        await pool.query(
          `INSERT INTO community_members (talent_id, community_id, role, status)
           VALUES ($1, $2, 'MEMBER', 'ACTIVE')
           ON CONFLICT (talent_id, community_id) DO NOTHING`,
          [memberId, id]
        );
      }

      commIds.push(id);
    } catch (err: any) {
      console.error(`  Error seeding community: ${err.message}`);
    }
  }

  console.log(`  ✓ ${commIds.length} communities created`);
  return commIds;
}

async function seedSpaces(count: number, orgIds: string[], talentIds: string[]): Promise<string[]> {
  console.log(`\n🏠 Seeding ${count} spaces...`);
  const spaceIds: string[] = [];

  const spaceNames = [
    'Salle Innovation', 'Espace Coworking Central', 'Studio Digital',
    'Salle de Formation Tech', 'Meeting Room A', 'Salle Conférence Panoramique',
    'Open Space Créatif', 'Bureau Privé Premium', 'Event Space Rooftop',
    'Salle de Réunion Exécutive', 'Lab Innovation', 'Espace Startup',
    'Salle Polyvalente', 'Coworking Flex', 'Bureau Partagé',
  ];

  for (let i = 0; i < count && i < spaceNames.length; i++) {
    const name = spaceNames[i];
    const orgId = randomPick(orgIds);
    const country = randomPick(Object.keys(UEMOA_CITIES)) as keyof typeof UEMOA_CITIES;
    const location = randomPick(UEMOA_CITIES[country]);
    const id = uuidv4();
    const slug = `${slugify(name)}-${location.city.toLowerCase()}-${id.slice(0, 8)}`;
    const type = randomPick(SPACE_TYPES);
    const createdBy = randomPick(talentIds);

    const capacity = Math.floor(Math.random() * 50 + 5);
    const surface = capacity * (Math.random() * 3 + 2);
    const hourlyRate = Math.floor(Math.random() * 20000 + 5000);

    const descriptions = [
      `${name} est un espace moderne et équipé situé au cœur de ${location.city}. Idéal pour vos réunions, formations et événements.`,
      `Espace de ${type.toLowerCase().replace('_', ' ')} à ${location.city}. Équipements: WiFi haut débit, vidéoprojecteur, climatisation. Capacité: ${capacity} personnes.`,
      `Louez ${name} pour vos besoins professionnels à ${location.city}. Espace climatisé, moderne et accessible.`,
    ];

    try {
      await pool.query(
        `INSERT INTO spaces (id, name, slug, description, type, surface_m2, capacity, city, region, country, hourly_rate, daily_rate, equipment, amenities, organization_id, created_by, status, cover_image_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
         ON CONFLICT (slug) DO NOTHING`,
        [
          id, name, slug, randomPick(descriptions), type,
          surface, capacity, location.city, location.region, country,
          hourlyRate, hourlyRate * 8,
          ['WiFi', 'Vidéoprojecteur', 'Tableau blanc', 'Climatisation'],
          ['Café', 'Thé', 'Parking', 'Accueil'],
          orgId, createdBy, 'ACTIVE', randomPick(SPACE_COVERS),
        ]
      );

      spaceIds.push(id);
    } catch (err: any) {
      console.error(`  Error seeding space: ${err.message}`);
    }
  }

  console.log(`  ✓ ${spaceIds.length} spaces created`);
  return spaceIds;
}

// --- Main ---

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('       SEED UEMOA DATA — Etudesk');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Date: ${new Date().toISOString()}`);
  console.log('');

  try {
    // Verify connection
    await pool.query('SELECT 1');
    console.log('[OK] PostgreSQL connected');

    // Seed data
    const talentIds = await seedTalents(50);
    const orgIds = await seedOrganizations(25, talentIds);
    const oppIds = await seedOpportunities(30, orgIds, talentIds);
    const commIds = await seedCommunities(20, orgIds, talentIds);
    const spaceIds = await seedSpaces(15, orgIds, talentIds);

    // Push to Pinecone
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('       VECTORIZING TO PINECONE');
    console.log('═══════════════════════════════════════════════════════════');

    console.log('\n📊 Vectorizing talents...');
    const talentsVectorized = await batchUpdateTalentEmbeddings(100);
    console.log(`  ✓ ${talentsVectorized} talents vectorized`);

    console.log('\n📊 Vectorizing opportunities...');
    const oppsVectorized = await batchUpdateOpportunityEmbeddings(100);
    console.log(`  ✓ ${oppsVectorized} opportunities vectorized`);

    console.log('\n📊 Vectorizing communities...');
    const commsVectorized = await batchUpdateCommunityEmbeddings(100);
    console.log(`  ✓ ${commsVectorized} communities vectorized`);

    console.log('\n📊 Vectorizing spaces...');
    const spacesVectorized = await batchUpdateSpaceEmbeddings(100);
    console.log(`  ✓ ${spacesVectorized} spaces vectorized`);

    // Summary
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('       SUMMARY');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`  Talents:       ${talentIds.length} created, ${talentsVectorized} vectorized`);
    console.log(`  Organizations: ${orgIds.length} created`);
    console.log(`  Opportunities: ${oppIds.length} created, ${oppsVectorized} vectorized`);
    console.log(`  Communities:   ${commIds.length} created, ${commsVectorized} vectorized`);
    console.log(`  Spaces:        ${spaceIds.length} created, ${spacesVectorized} vectorized`);
    console.log('═══════════════════════════════════════════════════════════');

  } catch (err: any) {
    console.error('Fatal error:', err);
  } finally {
    await pool.end();
  }
}

main();
