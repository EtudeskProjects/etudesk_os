/**
 * Etudesk Database Seeder
 *
 * Ce fichier crée des données réalistes pour l'application Etudesk.
 * Les données sont focalisées sur l'Afrique francophone (Côte d'Ivoire principalement).
 *
 * Usage: npx ts-node src/database/seed.ts
 */

import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const randomElement = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const randomElements = <T>(arr: T[], count: number): T[] => {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, arr.length));
};

const randomInt = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const randomDate = (start: Date, end: Date): Date => {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
};

const formatDate = (date: Date): string => date.toISOString().split('T')[0];

// ============================================================================
// SEED DATA - LOCATIONS
// ============================================================================

const LOCATIONS = {
  CI: {
    country: 'CI',
    cities: [
      { city: 'Abidjan', region: 'Lagunes', coordinates: '(5.3600, -4.0083)' },
      { city: 'Bouake', region: 'Vallee du Bandama', coordinates: '(7.6833, -5.0333)' },
      { city: 'Yamoussoukro', region: 'Lacs', coordinates: '(6.8206, -5.2767)' },
      { city: 'San-Pedro', region: 'Bas-Sassandra', coordinates: '(4.7485, -6.6363)' },
      { city: 'Korhogo', region: 'Savanes', coordinates: '(9.4500, -5.6333)' },
    ],
  },
  SN: {
    country: 'SN',
    cities: [
      { city: 'Dakar', region: 'Dakar', coordinates: '(14.6928, -17.4467)' },
      { city: 'Thies', region: 'Thies', coordinates: '(14.7886, -16.9260)' },
    ],
  },
  ML: {
    country: 'ML',
    cities: [
      { city: 'Bamako', region: 'Bamako', coordinates: '(12.6392, -8.0029)' },
    ],
  },
  BF: {
    country: 'BF',
    cities: [
      { city: 'Ouagadougou', region: 'Centre', coordinates: '(12.3714, -1.5197)' },
    ],
  },
};

// ============================================================================
// SEED DATA - SKILLS
// ============================================================================

const SKILLS_DATA = [
  // Hard Skills - Tech
  { name: 'React', type: 'HARD_SKILL', domain: 'Frontend Development', aliases: ['React.js', 'ReactJS'] },
  { name: 'React Native', type: 'HARD_SKILL', domain: 'Mobile Development', aliases: ['RN'] },
  { name: 'TypeScript', type: 'HARD_SKILL', domain: 'Programming Languages', aliases: ['TS'] },
  { name: 'JavaScript', type: 'HARD_SKILL', domain: 'Programming Languages', aliases: ['JS', 'ECMAScript'] },
  { name: 'Python', type: 'HARD_SKILL', domain: 'Programming Languages', aliases: [] },
  { name: 'Node.js', type: 'HARD_SKILL', domain: 'Backend Development', aliases: ['NodeJS', 'Node'] },
  { name: 'PostgreSQL', type: 'HARD_SKILL', domain: 'Databases', aliases: ['Postgres', 'PG'] },
  { name: 'MongoDB', type: 'HARD_SKILL', domain: 'Databases', aliases: ['Mongo'] },
  { name: 'GraphQL', type: 'HARD_SKILL', domain: 'API Development', aliases: ['GQL'] },
  { name: 'REST API', type: 'HARD_SKILL', domain: 'API Development', aliases: ['RESTful API'] },
  { name: 'Docker', type: 'HARD_SKILL', domain: 'DevOps', aliases: [] },
  { name: 'Kubernetes', type: 'HARD_SKILL', domain: 'DevOps', aliases: ['K8s'] },
  { name: 'AWS', type: 'HARD_SKILL', domain: 'Cloud Computing', aliases: ['Amazon Web Services'] },
  { name: 'Git', type: 'HARD_SKILL', domain: 'Version Control', aliases: ['GitHub', 'GitLab'] },
  { name: 'CI/CD', type: 'HARD_SKILL', domain: 'DevOps', aliases: ['Continuous Integration'] },

  // Hard Skills - Design
  { name: 'UI Design', type: 'HARD_SKILL', domain: 'Design', aliases: ['User Interface Design'] },
  { name: 'UX Design', type: 'HARD_SKILL', domain: 'Design', aliases: ['User Experience Design'] },
  { name: 'Figma', type: 'HARD_SKILL', domain: 'Design Tools', aliases: [] },
  { name: 'Adobe XD', type: 'HARD_SKILL', domain: 'Design Tools', aliases: ['XD'] },
  { name: 'Photoshop', type: 'HARD_SKILL', domain: 'Design Tools', aliases: ['Adobe Photoshop', 'PS'] },

  // Hard Skills - Data
  { name: 'Machine Learning', type: 'HARD_SKILL', domain: 'Data Science', aliases: ['ML'] },
  { name: 'Data Analysis', type: 'HARD_SKILL', domain: 'Data Science', aliases: ['Data Analytics'] },
  { name: 'SQL', type: 'HARD_SKILL', domain: 'Databases', aliases: [] },
  { name: 'Excel', type: 'HARD_SKILL', domain: 'Productivity', aliases: ['Microsoft Excel'] },
  { name: 'Power BI', type: 'HARD_SKILL', domain: 'Business Intelligence', aliases: [] },

  // Hard Skills - Business
  { name: 'Marketing Digital', type: 'HARD_SKILL', domain: 'Marketing', aliases: ['Digital Marketing'] },
  { name: 'SEO', type: 'HARD_SKILL', domain: 'Marketing', aliases: ['Search Engine Optimization'] },
  { name: 'Google Analytics', type: 'HARD_SKILL', domain: 'Analytics', aliases: ['GA', 'GA4'] },
  { name: 'Gestion de projet', type: 'HARD_SKILL', domain: 'Management', aliases: ['Project Management'] },
  { name: 'Comptabilite', type: 'HARD_SKILL', domain: 'Finance', aliases: ['Accounting'] },

  // Soft Skills
  { name: 'Leadership', type: 'SOFT_SKILL', domain: 'Management', aliases: [] },
  { name: 'Communication', type: 'SOFT_SKILL', domain: 'Interpersonal', aliases: [] },
  { name: 'Travail en equipe', type: 'SOFT_SKILL', domain: 'Collaboration', aliases: ['Teamwork'] },
  { name: 'Resolution de problemes', type: 'SOFT_SKILL', domain: 'Critical Thinking', aliases: ['Problem Solving'] },
  { name: 'Creativite', type: 'SOFT_SKILL', domain: 'Innovation', aliases: ['Creativity'] },
  { name: 'Adaptabilite', type: 'SOFT_SKILL', domain: 'Personal Development', aliases: ['Adaptability'] },
  { name: 'Gestion du temps', type: 'SOFT_SKILL', domain: 'Productivity', aliases: ['Time Management'] },
  { name: 'Negociation', type: 'SOFT_SKILL', domain: 'Business', aliases: ['Negotiation'] },
  { name: 'Presentation', type: 'SOFT_SKILL', domain: 'Communication', aliases: ['Public Speaking'] },
  { name: 'Esprit critique', type: 'SOFT_SKILL', domain: 'Critical Thinking', aliases: ['Critical Thinking'] },

  // Knowledge
  { name: 'Droit du travail', type: 'KNOWLEDGE', domain: 'Legal', aliases: ['Labor Law'] },
  { name: 'Finance d\'entreprise', type: 'KNOWLEDGE', domain: 'Finance', aliases: ['Corporate Finance'] },
  { name: 'Economie', type: 'KNOWLEDGE', domain: 'Economics', aliases: ['Economics'] },
  { name: 'Ressources humaines', type: 'KNOWLEDGE', domain: 'HR', aliases: ['Human Resources', 'RH'] },
  { name: 'Supply Chain', type: 'KNOWLEDGE', domain: 'Operations', aliases: ['Chaine d\'approvisionnement'] },
];

// ============================================================================
// SEED DATA - TALENTS
// ============================================================================

const TALENTS_DATA = [
  {
    first_name: 'Lamine',
    last_name: 'Barro',
    bio: 'Developpeur Full Stack passionne par l\'innovation technologique en Afrique. Expert React Native et TypeScript avec 5 ans d\'experience.',
    profile_tags: ['ENTREPRENEUR', 'CONSULTANT'],
    goals: ['ADVANCE_CAREER', 'TEACH_OR_MENTOR'],
    remote_ready: true,
    willing_to_relocate: false,
  },
  {
    first_name: 'Aminata',
    last_name: 'Diallo',
    bio: 'CTO avec 15 ans d\'experience dans le secteur technologique. Passionnee par le mentorat et l\'accompagnement des jeunes talents africains.',
    profile_tags: ['MANAGER', 'COACH', 'ENTREPRENEUR'],
    goals: ['TEACH_OR_MENTOR', 'ADVANCE_CAREER'],
    remote_ready: true,
    willing_to_relocate: false,
  },
  {
    first_name: 'Moussa',
    last_name: 'Kone',
    bio: 'Designer UX/UI avec une passion pour creer des experiences utilisateur exceptionnelles. Specialise dans le design mobile-first.',
    profile_tags: ['SALARIED', 'CONTENT_CREATOR'],
    goals: ['LEARN_NEW_SKILLS', 'ADVANCE_CAREER'],
    remote_ready: true,
    willing_to_relocate: true,
  },
  {
    first_name: 'Fatou',
    last_name: 'Toure',
    bio: 'Data Scientist specialisee en Machine Learning. Diplome de Polytechnique Paris, je travaille sur des projets d\'IA pour l\'agriculture.',
    profile_tags: ['SALARIED', 'CONSULTANT'],
    goals: ['RESEARCH_SUPPORT', 'LEARN_NEW_SKILLS'],
    remote_ready: true,
    willing_to_relocate: false,
  },
  {
    first_name: 'Kouadio',
    last_name: 'Yao',
    bio: 'Chef de projet digital avec 8 ans d\'experience dans la gestion d\'equipes agiles. Certifie PMP et Scrum Master.',
    profile_tags: ['MANAGER', 'CONSULTANT'],
    goals: ['ADVANCE_CAREER', 'TEACH_OR_MENTOR'],
    remote_ready: false,
    willing_to_relocate: false,
  },
  {
    first_name: 'Mariama',
    last_name: 'Camara',
    bio: 'Etudiante en derniere annee d\'informatique a l\'INPHB. Passionnee par le developpement web et l\'entrepreneuriat social.',
    profile_tags: ['STUDENT', 'JOB_SEEKER'],
    goals: ['FIND_JOB', 'LEARN_NEW_SKILLS', 'PREPARE_EXAMS'],
    remote_ready: true,
    willing_to_relocate: true,
  },
  {
    first_name: 'Ibrahim',
    last_name: 'Sangare',
    bio: 'Expert en cybersecurite avec 10 ans d\'experience. Consultant pour les grandes entreprises et institutions financieres.',
    profile_tags: ['CONSULTANT', 'COACH'],
    goals: ['TEACH_OR_MENTOR', 'RESEARCH_SUPPORT'],
    remote_ready: true,
    willing_to_relocate: false,
  },
  {
    first_name: 'Awa',
    last_name: 'Ndiaye',
    bio: 'Specialiste Marketing Digital et Growth Hacking. J\'aide les startups africaines a scaler leurs acquisitions.',
    profile_tags: ['ENTREPRENEUR', 'CONSULTANT'],
    goals: ['ADVANCE_CAREER', 'COLLABORATIVE_LEARNING'],
    remote_ready: true,
    willing_to_relocate: true,
  },
  {
    first_name: 'Sekou',
    last_name: 'Traore',
    bio: 'Developpeur Backend senior specialise Node.js et Python. Contributeur open source et formateur technique.',
    profile_tags: ['SALARIED', 'CONTENT_CREATOR', 'COACH'],
    goals: ['TEACH_OR_MENTOR', 'IMPROVE_PRODUCTIVITY'],
    remote_ready: true,
    willing_to_relocate: false,
  },
  {
    first_name: 'Aissatou',
    last_name: 'Ba',
    bio: 'Product Manager avec experience dans les fintechs. Passionnee par l\'inclusion financiere en Afrique.',
    profile_tags: ['MANAGER', 'ENTREPRENEUR'],
    goals: ['ADVANCE_CAREER', 'COLLABORATIVE_LEARNING'],
    remote_ready: true,
    willing_to_relocate: false,
  },
  {
    first_name: 'Oumar',
    last_name: 'Diop',
    bio: 'Jeune diplome en gestion, je recherche ma premiere experience professionnelle dans le domaine de la finance.',
    profile_tags: ['JOB_SEEKER', 'STUDENT'],
    goals: ['FIND_JOB', 'LEARN_NEW_SKILLS'],
    remote_ready: false,
    willing_to_relocate: true,
  },
  {
    first_name: 'Kadiatou',
    last_name: 'Keita',
    bio: 'DevOps Engineer avec expertise AWS et Kubernetes. Je construis des infrastructures cloud scalables.',
    profile_tags: ['SALARIED', 'CONSULTANT'],
    goals: ['ADVANCE_CAREER', 'LEARN_NEW_SKILLS'],
    remote_ready: true,
    willing_to_relocate: false,
  },
];

// ============================================================================
// SEED DATA - ORGANIZATIONS
// ============================================================================

const ORGANIZATIONS_DATA = [
  {
    name: 'TechCorp Africa',
    type: 'STARTUP',
    sectors: ['DIGITAL', 'FINANCE'],
    size: 'MEDIUM',
    description: 'Startup innovante developpant des solutions fintech pour l\'Afrique de l\'Ouest. Notre mission est de democratiser l\'acces aux services financiers.',
    website_url: 'https://techcorp.africa',
    culture_summary: 'Culture remote-first, equipe diverse et inclusive. Nous valorisons l\'innovation, l\'autonomie et l\'impact social.',
  },
  {
    name: 'Etudesk',
    type: 'STARTUP',
    sectors: ['DIGITAL', 'EDUCATION'],
    size: 'SMALL',
    description: 'Plateforme connectant talents, mentors et opportunites en Afrique francophone. Nous construisons le futur du travail en Afrique.',
    website_url: 'https://etudesk.com',
    culture_summary: 'Startup a impact social, equipe passionnee par l\'education et l\'employabilite des jeunes africains.',
  },
  {
    name: 'Orange Cote d\'Ivoire',
    type: 'COMPANY',
    sectors: ['DIGITAL', 'MEDIA'],
    size: 'ENTERPRISE',
    description: 'Leader des telecommunications en Cote d\'Ivoire. Nous connectons les Ivoiriens aux services numeriques.',
    website_url: 'https://orange.ci',
    culture_summary: 'Grande entreprise avec des opportunites de carriere internationales. Focus sur l\'innovation et la transformation digitale.',
  },
  {
    name: 'Wave Mobile Money',
    type: 'STARTUP',
    sectors: ['FINANCE', 'DIGITAL'],
    size: 'LARGE',
    description: 'Service de mobile money revolutionnant les paiements en Afrique de l\'Ouest avec des frais parmi les plus bas du marche.',
    website_url: 'https://wave.com',
    culture_summary: 'Startup americano-africaine en hypercroissance. Culture d\'excellence et d\'impact.',
  },
  {
    name: 'Societe Generale Cote d\'Ivoire',
    type: 'COMPANY',
    sectors: ['FINANCE'],
    size: 'ENTERPRISE',
    description: 'Banque de premier plan en Cote d\'Ivoire offrant une gamme complete de services financiers aux particuliers et entreprises.',
    website_url: 'https://societegenerale.ci',
    culture_summary: 'Institution financiere solide avec des valeurs d\'integrite et de professionnalisme.',
  },
  {
    name: 'Africa Tech Hub',
    type: 'ASSOCIATION',
    sectors: ['DIGITAL', 'EDUCATION'],
    size: 'SMALL',
    description: 'Association promouvant l\'ecosysteme tech en Afrique a travers des evenements, formations et networking.',
    website_url: 'https://africatechhub.org',
    culture_summary: 'Communaute collaborative ouverte a tous les acteurs de la tech africaine.',
  },
  {
    name: 'INPHB',
    type: 'EDUCATIONAL_INSTITUTION',
    sectors: ['EDUCATION', 'RESEARCH'],
    size: 'LARGE',
    description: 'Institut National Polytechnique Felix Houphouet-Boigny, premiere ecole d\'ingenieurs de Cote d\'Ivoire.',
    website_url: 'https://inphb.ci',
    culture_summary: 'Excellence academique et recherche appliquee au service du developpement.',
  },
  {
    name: 'GreenTech Solutions',
    type: 'STARTUP',
    sectors: ['ENVIRONMENT', 'DIGITAL'],
    size: 'SMALL',
    description: 'Startup developpant des solutions technologiques pour l\'agriculture durable et la gestion des ressources naturelles.',
    website_url: 'https://greentech-solutions.ci',
    culture_summary: 'Equipe engagee pour un developpement durable en Afrique.',
  },
  {
    name: 'HealthPlus Afrique',
    type: 'STARTUP',
    sectors: ['HEALTH', 'DIGITAL'],
    size: 'MEDIUM',
    description: 'Plateforme de telemedicine connectant patients et professionnels de sante en Afrique francophone.',
    website_url: 'https://healthplus.africa',
    culture_summary: 'Mission d\'ameliorer l\'acces aux soins de sante pour tous les Africains.',
  },
  {
    name: 'Djamo',
    type: 'STARTUP',
    sectors: ['FINANCE', 'DIGITAL'],
    size: 'MEDIUM',
    description: 'Neobanque africaine offrant des services bancaires modernes et accessibles via mobile.',
    website_url: 'https://djamo.com',
    culture_summary: 'Fintech innovante avec une equipe jeune et dynamique.',
  },
];

// ============================================================================
// SEED DATA - OPPORTUNITIES
// ============================================================================

const OPPORTUNITIES_DATA = [
  {
    title: 'Developpeur React Native Senior',
    type: 'EMPLOYMENT',
    contract_type: 'CDI',
    work_rhythm: 'FULL_TIME',
    location_type: 'HYBRID',
    compensation_min: 800000,
    compensation_max: 1500000,
    currency: 'XOF',
    compensation_frequency: 'MONTHLY',
    summary: 'Nous recherchons un developpeur React Native senior pour rejoindre notre equipe mobile. Vous serez responsable du developpement de nouvelles fonctionnalites et de l\'amelioration de notre application.',
    requirements: '• 5+ ans d\'experience en developpement mobile\n• Maitrise de React Native et TypeScript\n• Experience avec les APIs REST et GraphQL\n• Connaissance des bonnes pratiques de developpement',
    nice_to_have: '• Experience avec Expo\n• Contribution a des projets open source\n• Experience en fintech',
    status: 'OPEN',
  },
  {
    title: 'UI/UX Designer',
    type: 'EMPLOYMENT',
    contract_type: 'CDI',
    work_rhythm: 'FULL_TIME',
    location_type: 'ON_SITE',
    compensation_min: 500000,
    compensation_max: 900000,
    currency: 'XOF',
    compensation_frequency: 'MONTHLY',
    summary: 'Rejoignez notre equipe design pour creer des experiences utilisateur exceptionnelles pour nos applications mobiles et web.',
    requirements: '• 3+ ans d\'experience en design UI/UX\n• Maitrise de Figma\n• Portfolio demonstrant vos realisations\n• Sensibilite mobile-first',
    nice_to_have: '• Experience en design system\n• Connaissances en motion design',
    status: 'OPEN',
  },
  {
    title: 'Stage Developpeur Backend',
    type: 'INTERNSHIP',
    contract_type: 'INTERNSHIP',
    work_rhythm: 'FULL_TIME',
    location_type: 'ON_SITE',
    compensation_min: 100000,
    compensation_max: 150000,
    currency: 'XOF',
    compensation_frequency: 'MONTHLY',
    summary: 'Stage de 6 mois pour decouvrir le developpement backend dans un environnement startup dynamique.',
    requirements: '• Etudiant en informatique (Bac+3 minimum)\n• Connaissances de base en programmation\n• Motivation et curiosite',
    nice_to_have: '• Connaissances Node.js ou Python\n• Projets personnels a presenter',
    status: 'OPEN',
  },
  {
    title: 'Data Analyst',
    type: 'EMPLOYMENT',
    contract_type: 'CDI',
    work_rhythm: 'FULL_TIME',
    location_type: 'REMOTE',
    compensation_min: 600000,
    compensation_max: 1000000,
    currency: 'XOF',
    compensation_frequency: 'MONTHLY',
    summary: 'Analysez nos donnees pour generer des insights business et aider a la prise de decision strategique.',
    requirements: '• 2+ ans d\'experience en analyse de donnees\n• Maitrise de SQL et Excel\n• Experience avec des outils de BI (Power BI, Tableau)\n• Capacite a communiquer des insights complexes',
    nice_to_have: '• Connaissances Python/R\n• Experience en fintech ou e-commerce',
    status: 'OPEN',
  },
  {
    title: 'Chef de Projet Digital',
    type: 'EMPLOYMENT',
    contract_type: 'CDI',
    work_rhythm: 'FULL_TIME',
    location_type: 'HYBRID',
    compensation_min: 700000,
    compensation_max: 1200000,
    currency: 'XOF',
    compensation_frequency: 'MONTHLY',
    summary: 'Gerez des projets digitaux de A a Z en coordonnant les equipes techniques et business.',
    requirements: '• 4+ ans d\'experience en gestion de projet\n• Certification Agile/Scrum appreciee\n• Excellentes competences en communication\n• Experience avec des outils de gestion de projet',
    nice_to_have: '• Certification PMP\n• Experience en startup',
    status: 'OPEN',
  },
  {
    title: 'Community Manager',
    type: 'EMPLOYMENT',
    contract_type: 'CDI',
    work_rhythm: 'FULL_TIME',
    location_type: 'ON_SITE',
    compensation_min: 300000,
    compensation_max: 500000,
    currency: 'XOF',
    compensation_frequency: 'MONTHLY',
    summary: 'Animez notre communaute sur les reseaux sociaux et creez du contenu engageant.',
    requirements: '• 2+ ans d\'experience en community management\n• Excellente maitrise des reseaux sociaux\n• Creativite et sens de la communication\n• Maitrise du francais et de l\'anglais',
    nice_to_have: '• Competences en creation de contenu video\n• Experience dans le secteur tech',
    status: 'OPEN',
  },
  {
    title: 'DevOps Engineer',
    type: 'EMPLOYMENT',
    contract_type: 'CDI',
    work_rhythm: 'FULL_TIME',
    location_type: 'REMOTE',
    compensation_min: 900000,
    compensation_max: 1600000,
    currency: 'XOF',
    compensation_frequency: 'MONTHLY',
    summary: 'Construisez et maintenez notre infrastructure cloud pour supporter notre croissance.',
    requirements: '• 3+ ans d\'experience DevOps\n• Expertise AWS ou GCP\n• Maitrise de Docker et Kubernetes\n• Experience avec CI/CD',
    nice_to_have: '• Certifications cloud\n• Experience avec Terraform',
    status: 'OPEN',
  },
  {
    title: 'Consultant Cybersecurite',
    type: 'FREELANCE',
    contract_type: 'FREELANCE',
    work_rhythm: 'FULL_TIME',
    location_type: 'HYBRID',
    compensation_min: 50000,
    compensation_max: 100000,
    currency: 'XOF',
    compensation_frequency: 'HOURLY',
    summary: 'Mission de 3 mois pour auditer et renforcer la securite de nos systemes.',
    requirements: '• 5+ ans d\'experience en cybersecurite\n• Certifications (CISSP, CEH) appreciees\n• Experience en audit de securite\n• Connaissance des normes ISO 27001',
    nice_to_have: '• Experience dans le secteur financier\n• Expertise en pentest',
    status: 'OPEN',
  },
  {
    title: 'Product Manager Junior',
    type: 'EMPLOYMENT',
    contract_type: 'CDI',
    work_rhythm: 'FULL_TIME',
    location_type: 'ON_SITE',
    compensation_min: 450000,
    compensation_max: 700000,
    currency: 'XOF',
    compensation_frequency: 'MONTHLY',
    summary: 'Rejoignez l\'equipe produit pour definir la roadmap et prioriser les fonctionnalites.',
    requirements: '• 1-2 ans d\'experience en product management ou domaine connexe\n• Capacite d\'analyse et de synthese\n• Excellente communication\n• Connaissance des methodologies agiles',
    nice_to_have: '• Background technique\n• Experience utilisateur d\'apps fintech',
    status: 'OPEN',
  },
  {
    title: 'Formateur Developpement Web',
    type: 'FREELANCE',
    contract_type: 'FREELANCE',
    work_rhythm: 'FLEXIBLE',
    location_type: 'HYBRID',
    compensation_min: 30000,
    compensation_max: 50000,
    currency: 'XOF',
    compensation_frequency: 'HOURLY',
    summary: 'Formez la prochaine generation de developpeurs web africains.',
    requirements: '• 3+ ans d\'experience en developpement web\n• Experience en formation ou mentorat\n• Pedagogie et patience\n• Disponibilite les week-ends',
    nice_to_have: '• Experience avec des bootcamps\n• Creation de contenu pedagogique',
    status: 'OPEN',
  },
];

// ============================================================================
// SEED DATA - COMMUNITIES
// ============================================================================

const COMMUNITIES_DATA = [
  {
    name: 'Dev Community CI',
    type: 'HYBRID',
    description: 'La plus grande communaute de developpeurs en Cote d\'Ivoire. Meetups mensuels, partage de connaissances et networking.',
    rules: '• Respect mutuel\n• Pas de spam\n• Entraide et bienveillance\n• Partage de connaissances encourage',
  },
  {
    name: 'Women in Tech Abidjan',
    type: 'HYBRID',
    description: 'Communaute dediee aux femmes dans la tech. Mentorat, formations et soutien pour plus de diversite dans le secteur.',
    rules: '• Espace safe pour les femmes\n• Mentorat encourage\n• Pas de discrimination',
  },
  {
    name: 'Startup Weekend Alumni',
    type: 'ONLINE',
    description: 'Reseau des alumni Startup Weekend en Afrique francophone. Echanges et opportunites de collaboration.',
    rules: '• Membres verifies uniquement\n• Partage d\'opportunites encourage',
  },
  {
    name: 'Data Science Afrique',
    type: 'ONLINE',
    description: 'Communaute pan-africaine de data scientists. Projets collaboratifs, competitions Kaggle et partage de ressources.',
    rules: '• Niveau minimum requis\n• Participation active attendue',
  },
  {
    name: 'UX Design Francophone',
    type: 'ONLINE',
    description: 'Designers UX d\'Afrique francophone reunis pour partager pratiques, portfolios et opportunites.',
    rules: '• Critiques constructives\n• Respect des droits d\'auteur',
  },
  {
    name: 'Agile Cote d\'Ivoire',
    type: 'HYBRID',
    description: 'Communaute de praticiens agiles. Scrum, Kanban, SAFe - echanges sur les methodologies et retours d\'experience.',
    rules: '• Partage d\'experience encourage\n• Respect des opinions differentes',
  },
];

// ============================================================================
// MAIN SEED FUNCTION
// ============================================================================

async function seed() {
  const client = await pool.connect();

  try {
    console.log('🌱 Starting database seed...\n');

    await client.query('BEGIN');

    // ========================================================================
    // 1. SEED SKILLS
    // ========================================================================
    console.log('📚 Seeding skills...');
    const skillIds: Record<string, string> = {};

    for (const skill of SKILLS_DATA) {
      const id = uuidv4();
      const slug = generateSlug(skill.name);
      skillIds[skill.name] = id;

      await client.query(
        `INSERT INTO skills (id, canonical_name, slug, aliases, type, domain, growth_trend, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'STABLE', NOW(), NOW())
         ON CONFLICT (slug) DO NOTHING`,
        [id, skill.name, slug, skill.aliases, skill.type, skill.domain]
      );
    }
    console.log(`   ✓ ${SKILLS_DATA.length} skills created\n`);

    // ========================================================================
    // 2. SEED TALENTS
    // ========================================================================
    console.log('👥 Seeding talents...');
    const talentIds: string[] = [];

    for (const talent of TALENTS_DATA) {
      const id = uuidv4();
      talentIds.push(id);

      const location = randomElement(LOCATIONS.CI.cities);
      const email = `${talent.first_name.toLowerCase()}.${talent.last_name.toLowerCase()}@example.com`;
      const slug = generateSlug(`${talent.first_name}-${talent.last_name}`);
      const displayName = `${talent.first_name} ${talent.last_name}`;

      await client.query(
        `INSERT INTO talents (id, slug, display_name, bio, email, city, region, country, coordinates,
         remote_ready, willing_to_relocate, profile_tags, goals, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
         ON CONFLICT (email) DO NOTHING`,
        [
          id, slug, displayName, talent.bio, email,
          location.city, location.region, LOCATIONS.CI.country, location.coordinates,
          talent.remote_ready, talent.willing_to_relocate,
          talent.profile_tags, talent.goals
        ]
      );
    }
    console.log(`   ✓ ${TALENTS_DATA.length} talents created\n`);

    // ========================================================================
    // 3. SEED TALENT_SKILLS (Relations)
    // ========================================================================
    console.log('🔗 Seeding talent skills...');
    let talentSkillCount = 0;

    const proficiencyLevels = ['A', 'A+', 'B', 'B+', 'C', 'C+'];
    const skillNames = Object.keys(skillIds);

    for (const talentId of talentIds) {
      const numSkills = randomInt(5, 12);
      const selectedSkills = randomElements(skillNames, numSkills);

      for (const skillName of selectedSkills) {
        const skillId = skillIds[skillName];
        const proficiency = randomElement(proficiencyLevels);
        const yearsOfExperience = randomInt(1, 10);

        await client.query(
          `INSERT INTO talent_skills (talent_id, skill_id, proficiency_level, self_assessed, endorsed_count, years_of_experience)
           VALUES ($1, $2, $3, TRUE, $4, $5)
           ON CONFLICT (talent_id, skill_id) DO NOTHING`,
          [talentId, skillId, proficiency, randomInt(0, 20), yearsOfExperience]
        );
        talentSkillCount++;
      }
    }
    console.log(`   ✓ ${talentSkillCount} talent-skill relations created\n`);

    // ========================================================================
    // 4. SEED ORGANIZATIONS
    // ========================================================================
    console.log('🏢 Seeding organizations...');
    const organizationIds: string[] = [];

    for (let i = 0; i < ORGANIZATIONS_DATA.length; i++) {
      const org = ORGANIZATIONS_DATA[i];
      const id = uuidv4();
      organizationIds.push(id);

      const location = randomElement(LOCATIONS.CI.cities);
      const slug = generateSlug(org.name);
      const createdBy = talentIds[i % talentIds.length];

      await client.query(
        `INSERT INTO organizations (id, name, slug, type, sectors, size, description, website_url,
         headquarters_city, headquarters_region, headquarters_country, headquarters_coordinates,
         verification_status, culture_summary, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
         ON CONFLICT (slug) DO NOTHING`,
        [
          id, org.name, slug, org.type, org.sectors, org.size, org.description, org.website_url,
          location.city, location.region, LOCATIONS.CI.country, location.coordinates,
          'VERIFIED', org.culture_summary, createdBy
        ]
      );
    }
    console.log(`   ✓ ${ORGANIZATIONS_DATA.length} organizations created\n`);

    // ========================================================================
    // 5. SEED OPPORTUNITIES
    // ========================================================================
    console.log('💼 Seeding opportunities...');
    const opportunityIds: string[] = [];

    for (let i = 0; i < OPPORTUNITIES_DATA.length; i++) {
      const opp = OPPORTUNITIES_DATA[i];
      const id = uuidv4();
      opportunityIds.push(id);

      const location = randomElement(LOCATIONS.CI.cities);
      const slug = generateSlug(opp.title);
      const postedAt = randomDate(new Date('2024-12-01'), new Date('2025-01-15'));
      const deadline = new Date(postedAt);
      deadline.setDate(deadline.getDate() + randomInt(30, 90));

      const locations = JSON.stringify([{
        city: location.city,
        region: location.region,
        country: LOCATIONS.CI.country,
        is_primary: true
      }]);

      await client.query(
        `INSERT INTO opportunities (id, title, slug, type, contract_type, work_rhythm, summary, requirements, nice_to_have,
         compensation_min, compensation_max, currency, compensation_frequency,
         location_type, locations, posted_at, deadline, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW(), NOW())
         ON CONFLICT (slug) DO NOTHING`,
        [
          id, opp.title, slug, opp.type, opp.contract_type || null, opp.work_rhythm || null, opp.summary, opp.requirements, opp.nice_to_have,
          opp.compensation_min, opp.compensation_max, opp.currency, opp.compensation_frequency,
          opp.location_type, locations, postedAt, deadline, opp.status
        ]
      );
    }
    console.log(`   ✓ ${OPPORTUNITIES_DATA.length} opportunities created\n`);

    // ========================================================================
    // 6. SEED OPPORTUNITY_POSTERS (Relations)
    // ========================================================================
    console.log('🔗 Seeding opportunity posters...');

    for (let i = 0; i < opportunityIds.length; i++) {
      const opportunityId = opportunityIds[i];
      const organizationId = organizationIds[i % organizationIds.length];
      const posterId = talentIds[i % talentIds.length];

      // Organization posts the opportunity
      await client.query(
        `INSERT INTO opportunity_posters (opportunity_id, poster_organization_id, role, posted_at)
         VALUES ($1, $2, 'POSTER', NOW())
         ON CONFLICT (opportunity_id, poster_organization_id) DO NOTHING`,
        [opportunityId, organizationId]
      );

      // Talent as recruiter
      await client.query(
        `INSERT INTO opportunity_posters (opportunity_id, poster_talent_id, role, posted_at)
         VALUES ($1, $2, 'RECRUITER', NOW())
         ON CONFLICT (opportunity_id, poster_talent_id) DO NOTHING`,
        [opportunityId, posterId]
      );
    }
    console.log(`   ✓ ${opportunityIds.length * 2} opportunity-poster relations created\n`);

    // ========================================================================
    // 7. SEED OPPORTUNITY_SKILLS (Relations)
    // ========================================================================
    console.log('🔗 Seeding opportunity skills...');
    let oppSkillCount = 0;

    for (const opportunityId of opportunityIds) {
      const numSkills = randomInt(3, 8);
      const selectedSkills = randomElements(skillNames, numSkills);

      for (let i = 0; i < selectedSkills.length; i++) {
        const skillName = selectedSkills[i];
        const skillId = skillIds[skillName];
        const isRequired = i < 3; // First 3 skills are required
        const proficiency = randomElement(['B', 'B+', 'C', 'C+']);

        await client.query(
          `INSERT INTO opportunity_skills (opportunity_id, skill_id, is_required, proficiency_level, relevance_score, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())
           ON CONFLICT (opportunity_id, skill_id) DO NOTHING`,
          [opportunityId, skillId, isRequired, proficiency, Math.random()]
        );
        oppSkillCount++;
      }
    }
    console.log(`   ✓ ${oppSkillCount} opportunity-skill relations created\n`);

    // ========================================================================
    // 8. SEED COMMUNITIES
    // ========================================================================
    console.log('👥 Seeding communities...');
    const communityIds: string[] = [];

    for (let i = 0; i < COMMUNITIES_DATA.length; i++) {
      const comm = COMMUNITIES_DATA[i];
      const id = uuidv4();
      communityIds.push(id);

      const location = randomElement(LOCATIONS.CI.cities);
      const slug = generateSlug(comm.name);
      const createdBy = talentIds[i % talentIds.length];

      await client.query(
        `INSERT INTO communities (id, name, slug, type, description, rules, city, region, country,
         coordinates, status, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'ACTIVE', $11, NOW(), NOW())
         ON CONFLICT (slug) DO NOTHING`,
        [
          id, comm.name, slug, comm.type, comm.description, comm.rules,
          location.city, location.region, LOCATIONS.CI.country, location.coordinates, createdBy
        ]
      );
    }
    console.log(`   ✓ ${COMMUNITIES_DATA.length} communities created\n`);

    // ========================================================================
    // 9. SEED COMMUNITY_MEMBERS (Relations)
    // ========================================================================
    console.log('🔗 Seeding community members...');
    let memberCount = 0;

    for (const communityId of communityIds) {
      const numMembers = randomInt(5, talentIds.length);
      const selectedTalents = randomElements(talentIds, numMembers);

      for (let i = 0; i < selectedTalents.length; i++) {
        const talentId = selectedTalents[i];
        const membershipType = i === 0 ? 'STAFF' : randomElement(['MEMBER', 'MEMBER', 'MEMBER', 'ALUMNI']);

        await client.query(
          `INSERT INTO community_members (community_id, talent_id, membership_type, joined_at, is_active)
           VALUES ($1, $2, $3, CURRENT_DATE, TRUE)
           ON CONFLICT (talent_id, community_id) DO NOTHING`,
          [communityId, talentId, membershipType]
        );
        memberCount++;
      }
    }
    console.log(`   ✓ ${memberCount} community-member relations created\n`);

    // ========================================================================
    // talent_experiences and talent_educations removed in migration 051

    // ========================================================================
    // 17. SEED MENTORSHIPS
    // ========================================================================
    console.log('🎯 Seeding mentorships...');
    let mentorshipCount = 0;

    // Select some talents as mentors (senior ones)
    const mentorIds = talentIds.slice(0, 5);
    const menteeIds = talentIds.slice(5);

    for (const mentorId of mentorIds) {
      const numMentees = randomInt(1, 3);
      const selectedMentees = randomElements(menteeIds, numMentees);

      for (const menteeId of selectedMentees) {
        const startedAt = randomDate(new Date('2024-01-01'), new Date('2025-01-01'));
        const focusSkills = randomElements(Object.values(skillIds), randomInt(1, 3));
        const status = randomElement(['ACTIVE', 'ACTIVE', 'COMPLETED']);

        await client.query(
          `INSERT INTO mentorships (mentor_id, mentee_id, focus_area_skill_ids, status, started_at)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (mentor_id, mentee_id) DO NOTHING`,
          [mentorId, menteeId, focusSkills, status, formatDate(startedAt)]
        );
        mentorshipCount++;
      }
    }
    console.log(`   ✓ ${mentorshipCount} mentorships created\n`);

    // ========================================================================
    // 18. SEED CONNECTIONS
    // ========================================================================
    console.log('🤝 Seeding connections...');
    let connectionCount = 0;

    const relationshipTypes = ['COLLEAGUE', 'CLASSMATE', 'MET_AT_EVENT', 'ONLINE'];

    for (let i = 0; i < talentIds.length; i++) {
      const numConnections = randomInt(2, 5);
      const potentialConnections = talentIds.filter((_, idx) => idx !== i);
      const selectedConnections = randomElements(potentialConnections, numConnections);

      for (const targetId of selectedConnections) {
        await client.query(
          `INSERT INTO connections (from_talent_id, to_talent_id, relationship_type, connected_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (from_talent_id, to_talent_id) DO NOTHING`,
          [talentIds[i], targetId, randomElement(relationshipTypes)]
        );
        connectionCount++;
      }
    }
    console.log(`   ✓ ${connectionCount} connections created\n`);

    // ========================================================================
    // 19. SEED OPPORTUNITY_APPLICATIONS
    // ========================================================================
    console.log('📝 Seeding opportunity applications...');
    let applicationCount = 0;

    const applicationStatuses = ['SUBMITTED', 'IN_REVIEW', 'ACCEPTED', 'REJECTED'];

    for (const opportunityId of opportunityIds) {
      const numApplications = randomInt(3, 8);
      const selectedTalents = randomElements(talentIds, numApplications);

      for (const talentId of selectedTalents) {
        const status = randomElement(applicationStatuses);

        await client.query(
          `INSERT INTO opportunity_applications (opportunity_id, talent_id, status, cover_letter, applied_at)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT (talent_id, opportunity_id) DO NOTHING`,
          [opportunityId, talentId, status, 'Je suis tres interesse par cette opportunite...']
        );
        applicationCount++;
      }
    }
    console.log(`   ✓ ${applicationCount} applications created\n`);

    // ========================================================================
    // 20. SEED OPPORTUNITY_BOOKMARKS
    // ========================================================================
    console.log('🔖 Seeding opportunity bookmarks...');
    let bookmarkCount = 0;

    for (const talentId of talentIds) {
      const numBookmarks = randomInt(2, 5);
      const selectedOpportunities = randomElements(opportunityIds, numBookmarks);

      for (const opportunityId of selectedOpportunities) {
        await client.query(
          `INSERT INTO opportunity_bookmarks (talent_id, opportunity_id, created_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (talent_id, opportunity_id) DO NOTHING`,
          [talentId, opportunityId]
        );
        bookmarkCount++;
      }
    }
    console.log(`   ✓ ${bookmarkCount} bookmarks created\n`);

    // ========================================================================
    // COMMIT
    // ========================================================================
    await client.query('COMMIT');

    console.log('✅ Database seeded successfully!\n');
    console.log('Summary:');
    console.log(`   • ${SKILLS_DATA.length} skills`);
    console.log(`   • ${TALENTS_DATA.length} talents`);
    console.log(`   • ${ORGANIZATIONS_DATA.length} organizations`);
    console.log(`   • ${OPPORTUNITIES_DATA.length} opportunities`);
    console.log(`   • ${COMMUNITIES_DATA.length} communities`);
    console.log(`   • Multiple relations created`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the seed
seed().catch(console.error);
