import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { locales, isLocale, type Locale } from '@/lib/i18n';
import HomeView from '@/components/views/HomeView';

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

const META: Record<Locale, { title: string; description: string }> = {
  fr: {
    title: 'Etudesk - Les compétences du digital, à la vitesse du marché',
    description:
      'Etudesk aide chaque talent à découvrir, apprendre et valoriser les compétences numériques qui ouvrent des opportunités locales et internationales.',
  },
  en: {
    title: 'Etudesk - Digital skills, at the speed of the market',
    description:
      'Etudesk helps every talent discover, learn and showcase the digital skills that open local and international opportunities.',
  },
};

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const l: Locale = isLocale(lang) ? lang : 'fr';
  return {
    title: { absolute: META[l].title },
    description: META[l].description,
    alternates: {
      canonical: `/${l}`,
      languages: { fr: '/fr', en: '/en', 'x-default': '/fr' },
    },
  };
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return <HomeView lang={lang} />;
}
