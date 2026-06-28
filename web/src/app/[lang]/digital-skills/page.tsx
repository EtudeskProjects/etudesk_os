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
      'Explore la carte vivante des compétences du digital : 1687 compétences, leurs prérequis, voisins et débouchés. De zéro à la pointe de l\'IA, étape par étape.',
  },
  en: {
    title: 'Digital Skills Referential',
    description:
      'Explore the living map of digital skills: 1687 skills with their prerequisites, neighbours and outcomes. From zero to the cutting edge of AI, step by step.',
  },
};

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const l: Locale = isLocale(lang) ? lang : 'fr';
  return {
    title: META[l].title,
    description: META[l].description,
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
