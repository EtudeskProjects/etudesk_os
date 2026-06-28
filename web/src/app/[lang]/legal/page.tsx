import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { locales, isLocale, type Locale } from '@/lib/i18n';
import LegalView from '@/components/views/LegalView';

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

const META: Record<Locale, { title: string; description: string }> = {
  fr: { title: 'Mentions légales', description: 'Mentions légales et informations sur l\'éditeur d\'Etudesk.' },
  en: { title: 'Legal Notice', description: 'Legal notice and publisher information for Etudesk.' },
};

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const l: Locale = isLocale(lang) ? lang : 'fr';
  return {
    title: META[l].title,
    description: META[l].description,
    alternates: {
      canonical: `/${l}/legal`,
      languages: { fr: '/fr/legal', en: '/en/legal', 'x-default': '/fr/legal' },
    },
  };
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return <LegalView lang={lang} />;
}
