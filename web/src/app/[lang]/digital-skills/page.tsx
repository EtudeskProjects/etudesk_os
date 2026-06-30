import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { locales, isLocale, type Locale } from '@/lib/i18n';
import DigitalSkillsView from '@/components/views/DigitalSkillsView';

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

const META: Record<Locale, { title: string; description: string }> = {
  fr: {
    title: 'Référentiel des compétences digitales',
    description:
      'Un référentiel propriétaire qui agrège les meilleurs cadres mondiaux de compétences numériques et les signaux réels du marché de l\'emploi.',
  },
  en: {
    title: 'Digital Skills Referential',
    description:
      'A proprietary referential aggregating the world\'s leading digital skills frameworks and real job-market signals.',
  },
};
const SKILLS_GRAPH_IMAGE = '/images/skills-graph.png';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const l: Locale = isLocale(lang) ? lang : 'fr';
  return {
    title: META[l].title,
    description: META[l].description,
    openGraph: {
      title: META[l].title,
      description: META[l].description,
      url: `https://etudesk.com/${l}/digital-skills`,
      type: 'website',
      images: [{ url: SKILLS_GRAPH_IMAGE, width: 1252, height: 1148, alt: l === 'fr' ? 'Carte du référentiel des compétences digitales Etudesk' : 'Etudesk digital skills referential map' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: META[l].title,
      description: META[l].description,
      images: [SKILLS_GRAPH_IMAGE],
    },
    alternates: {
      canonical: `/${l}/digital-skills`,
      languages: { fr: '/fr/digital-skills', en: '/en/digital-skills', 'x-default': '/fr/digital-skills' },
    },
  };
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return <DigitalSkillsView lang={lang} />;
}
