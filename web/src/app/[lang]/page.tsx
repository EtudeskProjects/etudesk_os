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
      'Forme-toi aux compétences du digital avec ton tuteur IA, et transforme-les en opportunités avec ton guide carrière IA. Référentiel vivant, sans abonnement, 20 crédits offerts. Sur iOS et Android.',
  },
  en: {
    title: 'Etudesk - Digital skills, at the speed of the market',
    description:
      'Learn digital skills with your AI tutor, and turn them into opportunities with your AI career guide. A living referential, no subscription, 20 free credits. On iOS and Android.',
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
