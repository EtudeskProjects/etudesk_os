/**
 * Generateur de contenu editorial par competence (vague 5 SEO).
 * Produit, pour un slug + une langue, un contenu UNIQUE derive du graphe de
 * relations (prerequis / mene-vers / voisines / associees) + taxonomie.
 * But : des pages /digital-skills/[slug] indexables et non "thin content",
 * chaque page differant par ses relations reelles.
 *
 * Decouple volontairement des contextes (pas d'import de LangContext/i18n) pour
 * rester stable. Depend uniquement des donnees (taxonomy + relations).
 */

import { BY_SLUG, FAMILY_MAP, TYPE_MAP, type Competency } from '../data/taxonomy';
import { getRelations, getDegree, resolve } from '../data/relations';

type Lang = 'fr' | 'en';

export interface RelatedSkill {
  slug: string;
  name: string;
}

export interface SkillContent {
  slug: string;
  name: string;
  familyKey: string;
  familyLabel: string;
  typeKey: string;
  typeLabel: string;
  intro: string;
  paragraphs: string[];
  metaTitle: string;
  metaDescription: string;
  degree: number;
  pre: RelatedSkill[];
  leads: RelatedSkill[];
  sib: RelatedSkill[];
  rel: RelatedSkill[];
}

const localName = (c: Competency, lang: Lang) => (lang === 'fr' ? c.name_fr : c.name) || c.name;

/** Liste lisible : "A, B et C" (FR) / "A, B and C" (EN), plafonnee. */
function readableList(names: string[], lang: Lang, max = 6): string {
  const items = names.slice(0, max);
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  const last = items[items.length - 1];
  const head = items.slice(0, -1).join(', ');
  return `${head} ${lang === 'fr' ? 'et' : 'and'} ${last}`;
}

function toRelated(slugs: string[], lang: Lang, max = 8): RelatedSkill[] {
  return resolve(slugs)
    .slice(0, max)
    .map((c) => ({ slug: c.slug, name: localName(c, lang) }));
}

export function getSkillContent(slug: string, lang: Lang): SkillContent | null {
  const c = BY_SLUG[slug];
  if (!c) return null;

  const name = localName(c, lang);
  const fam = FAMILY_MAP[c.family];
  const typ = TYPE_MAP[c.type];
  const familyLabel = fam ? (lang === 'fr' ? fam.fr : fam.en) : c.family;
  const typeLabel = typ ? (lang === 'fr' ? typ.fr : typ.en) : c.type;

  const r = getRelations(slug);
  const pre = toRelated(r.pre, lang);
  const leads = toRelated(r.leads, lang);
  const sib = toRelated(r.sib, lang);
  const rel = toRelated(r.rel, lang);
  const degree = getDegree(slug);

  const N = (arr: RelatedSkill[]) => arr.map((x) => x.name);

  const paragraphs: string[] = [];
  let intro: string;

  if (lang === 'fr') {
    intro = `${name} fait partie du référentiel des compétences du digital d'Etudesk, dans la famille « ${familyLabel} » (catégorie ${typeLabel}). Apprends ${name} avec ton tuteur IA, à ton rythme, et transforme cette compétence en opportunités concrètes avec ton guide carrière IA.`;
    if (pre.length) paragraphs.push(`Pour bien aborder ${name}, il est utile de maîtriser d'abord ${readableList(N(pre), lang)}. Le référentiel ordonne ces prérequis pour t'éviter les trous dans les fondations.`);
    if (leads.length) paragraphs.push(`Une fois ${name} acquise, tu peux progresser vers ${readableList(N(leads), lang)}. Ton tuteur te propose toujours le prochain pas le plus pertinent.`);
    if (sib.length) paragraphs.push(`Compétences voisines, dans la même famille : ${readableList(N(sib), lang)}.`);
    if (rel.length) paragraphs.push(`Sur le terrain, ${name} est souvent mobilisée avec ${readableList(N(rel), lang)}.`);
    if (!pre.length && !leads.length && !sib.length && !rel.length) {
      paragraphs.push(`${name} s'apprend pas à pas avec ton tuteur IA : quiz, flashcards, exercices résolus et explications multimodales, sans abonnement et avec 20 crédits offerts pour démarrer.`);
    }
  } else {
    intro = `${name} is part of Etudesk's digital skills referential, in the "${familyLabel}" family (${typeLabel}). Learn ${name} with your AI tutor, at your own pace, and turn it into real opportunities with your AI career guide.`;
    if (pre.length) paragraphs.push(`To get started with ${name}, it helps to first master ${readableList(N(pre), lang)}. The referential orders these prerequisites so you never have gaps in your foundations.`);
    if (leads.length) paragraphs.push(`Once you have ${name}, you can move on to ${readableList(N(leads), lang)}. Your tutor always suggests the most relevant next step.`);
    if (sib.length) paragraphs.push(`Neighbouring skills, in the same family: ${readableList(N(sib), lang)}.`);
    if (rel.length) paragraphs.push(`In practice, ${name} is often used together with ${readableList(N(rel), lang)}.`);
    if (!pre.length && !leads.length && !sib.length && !rel.length) {
      paragraphs.push(`${name} is learned step by step with your AI tutor: quizzes, flashcards, solved exercises and multimodal explanations, no subscription and 20 free credits to start.`);
    }
  }

  const metaTitle = lang === 'fr'
    ? `Apprendre ${name} - ${familyLabel}`
    : `Learn ${name} - ${familyLabel}`;

  const metaDescription = lang === 'fr'
    ? `${name} : ${typeLabel.toLowerCase()} de la famille ${familyLabel}. Apprends-la avec le tuteur IA Etudesk${leads.length ? ` et débloque ${readableList(N(leads), lang, 3)}` : ''}. Sans abonnement, 20 crédits offerts.`.slice(0, 158)
    : `${name}: ${typeLabel.toLowerCase()} in the ${familyLabel} family. Learn it with the Etudesk AI tutor${leads.length ? ` and unlock ${readableList(N(leads), lang, 3)}` : ''}. No subscription, 20 free credits.`.slice(0, 158);

  return {
    slug,
    name,
    familyKey: c.family,
    familyLabel,
    typeKey: c.type,
    typeLabel,
    intro,
    paragraphs,
    metaTitle,
    metaDescription,
    degree,
    pre,
    leads,
    sib,
    rel,
  };
}

/** Tous les slugs (pour generateStaticParams de la vague 5). */
export function allSkillSlugs(): string[] {
  return Object.keys(BY_SLUG);
}
