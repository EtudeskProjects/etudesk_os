import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale, locales, type Locale } from '@/lib/i18n';
import TalentsCivStoryView from '@/components/views/TalentsCivStoryView';

const META: Record<Locale, { title: string; description: string }> = {
  fr: {
    title: 'Talents CIV - Data storytelling Etudesk',
    description:
      'Lecture interactive des 844 918 profils talents: régions, secteurs, diaspora, inclusion, âge, éducation et qualité des données.',
  },
  en: {
    title: 'CIV Talents - Etudesk data story',
    description:
      'Interactive view of 844,918 talent profiles: regions, sectors, diaspora, inclusion, age, education and data quality.',
  },
};

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const l: Locale = isLocale(lang) ? lang : 'fr';
  return {
    title: { absolute: META[l].title },
    description: META[l].description,
    alternates: {
      canonical: `/${l}/talents-civ`,
      languages: { fr: '/fr/talents-civ', en: '/en/talents-civ', 'x-default': '/fr/talents-civ' },
    },
  };
}

export default async function TalentsCivPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return <TalentsCivStoryView lang={lang} />;
}
