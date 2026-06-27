/**
 * Articles du blog "Stories". Contenu statique (markdown léger : titres #, **gras**, listes -).
 * Pour la v1, les articles vivent ici ; on pourra basculer en MDX plus tard.
 */

export interface Story {
  slug: string;
  category: string;
  date: string; // ISO
  readMin: number;
  cover: string;
  fr: { title: string; excerpt: string; body: string };
  en: { title: string; excerpt: string; body: string };
}

export const STORIES: Story[] = [
  {
    slug: 'apprendre-a-la-vitesse-du-marche',
    category: 'Apprentissage',
    date: '2026-06-20',
    readMin: 4,
    cover: '/images/explore_opportunities.jpg',
    fr: {
      title: 'Apprendre à la vitesse du marché',
      excerpt: 'Pourquoi les compétences qui comptent changent plus vite que les programmes, et comment garder une longueur d\'avance.',
      body: `Le marché du digital ne ralentit pas. En deux ans, des familles entières de compétences (IA générative, agents, nouveaux outils) sont passées de la marge au centre.

## Le problème des catalogues figés
La plupart des programmes de formation décrivent un monde d'il y a trois ans. Quand tu finis, la compétence a déjà bougé.

## La réponse d'Etudesk
Notre **référentiel vivant** est mis à jour en continu. Quand un outil émerge, il entre dans la carte, avec ses prérequis et ses voisines.

- Apprends ce que le marché demande **maintenant**
- Suis un parcours, pas une liste
- Transforme la compétence en opportunité

Commence gratuitement, depuis ton téléphone.`,
    },
    en: {
      title: 'Learning at market speed',
      excerpt: 'Why the skills that matter change faster than curricula, and how to stay ahead.',
      body: `The digital market does not slow down. In two years, entire families of skills moved from the margin to the center.

## The frozen-catalog problem
Most training programs describe a world from three years ago. By the time you finish, the skill has already moved.

## Etudesk's answer
Our **living referential** is updated continuously. When a tool emerges, it enters the map, with its prerequisites and neighbours.

- Learn what the market wants **now**
- Follow a path, not a list
- Turn skill into opportunity

Start for free, from your phone.`,
    },
  },
  {
    slug: 'des-competences-aux-opportunites',
    category: 'Carrière',
    date: '2026-06-12',
    readMin: 5,
    cover: '/images/explore_communities.jpg',
    fr: {
      title: 'Des compétences aux vraies opportunités',
      excerpt: 'Apprendre, c\'est bien. Décrocher l\'opportunité, c\'est le but. Comment le guide carrière fait le lien.',
      body: `Trop de parcours s'arrêtent au diplôme. Chez Etudesk, la compétence n'est pas une fin : c'est un point de départ vers une opportunité.

## Une même carte, deux IA
Ton tuteur t'aide à apprendre. Ton **guide carrière** relie ce que tu sais à des emplois, stages et missions réels.

## Le matching qui a du sens
La compatibilité est calculée sur les compétences, la localisation, l'expérience et le secteur - pas juste un mot-clé.

De l'autodidacte au talent recherché.`,
    },
    en: {
      title: 'From skills to real opportunities',
      excerpt: 'Learning is good. Landing the opportunity is the goal. How the career guide connects both.',
      body: `Too many journeys stop at the diploma. At Etudesk, a skill is not an end: it is a starting point toward an opportunity.

## One map, two AIs
Your tutor helps you learn. Your **career guide** connects what you know to real jobs, internships and gigs.

## Matching that makes sense
Compatibility is computed on skills, location, experience and sector - not just a keyword.

From self-taught to sought-after talent.`,
    },
  },
  {
    slug: 'comprendre-le-referentiel',
    category: 'Compétences',
    date: '2026-06-04',
    readMin: 6,
    cover: '/images/explore_spaces.jpg',
    fr: {
      title: 'Comprendre le référentiel des compétences',
      excerpt: '1211 compétences, 16 familles, 5 types, un graphe de relations. Ce que ça change pour toi.',
      body: `Un référentiel, ce n'est pas juste une liste. C'est une carte qui dit ce qui existe, comment c'est relié, et par où commencer.

## Familles et types
Chaque compétence appartient à une **famille** (IA, Data, Cybersécurité...) et a un **type** (savoir, technique, savoir-être, outil, langage).

## Le graphe qui guide
4147 relations relient les compétences :
- **Prérequis** : à apprendre avant
- **Voisines** : du même domaine
- **Souvent associées** : qui vont ensemble

C'est ce graphe qui rend ton apprentissage logique, étape après étape.`,
    },
    en: {
      title: 'Understanding the skills referential',
      excerpt: '1211 skills, 16 families, 5 types, a relationship graph. What it changes for you.',
      body: `A referential is not just a list. It is a map that says what exists, how it connects, and where to start.

## Families and types
Each skill belongs to a **family** (AI, Data, Cybersecurity...) and has a **type** (knowledge, hard, soft, tool, language).

## The graph that guides
4147 relations connect the skills:
- **Prerequisites**: learn before
- **Neighbours**: same domain
- **Often paired**: that go together

This graph makes your learning logical, step after step.`,
    },
  },
];

export const storyBySlug = (slug: string) => STORIES.find((s) => s.slug === slug);
