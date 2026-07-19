import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { locales, isLocale, type Locale } from '@/lib/i18n';
import HomeView from '@/components/views/HomeView';

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

const META: Record<Locale, { title: string; description: string }> = {
  fr: {
    title: 'Etudesk - Les compétences numériques qui font avancer votre travail',
    description:
      'Découvrez, pratiquez et valorisez les compétences numériques qui améliorent votre travail et ouvrent de nouvelles opportunités.',
  },
  en: {
    title: 'Etudesk - Digital skills that move your work forward',
    description:
      'Discover, practise and showcase digital skills that improve your work and open new opportunities.',
  },
};
const SKILLS_GRAPH_IMAGE = '/images/skills-graph.png';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const l: Locale = isLocale(lang) ? lang : 'fr';
  return {
    title: { absolute: META[l].title },
    description: META[l].description,
    openGraph: {
      title: META[l].title,
      description: META[l].description,
      url: `https://etudesk.com/${l}`,
      type: 'website',
      images: [{ url: SKILLS_GRAPH_IMAGE, width: 1252, height: 1148, alt: l === 'fr' ? 'Carte des compétences digitales Etudesk' : 'Etudesk digital skills map' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: META[l].title,
      description: META[l].description,
      images: [SKILLS_GRAPH_IMAGE],
    },
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
