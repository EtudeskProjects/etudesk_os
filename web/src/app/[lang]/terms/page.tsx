import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { locales, isLocale, type Locale } from '@/lib/i18n';
import TermsView from '@/components/views/TermsView';

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

const META: Record<Locale, { title: string; description: string }> = {
  fr: { title: 'Conditions d\'utilisation', description: 'Les conditions d\'utilisation du service Etudesk.' },
  en: { title: 'Terms of Service', description: 'The terms of service for the Etudesk product.' },
};

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const l: Locale = isLocale(lang) ? lang : 'fr';
  return {
    title: META[l].title,
    description: META[l].description,
    alternates: {
      canonical: `/${l}/terms`,
      languages: { fr: '/fr/terms', en: '/en/terms', 'x-default': '/fr/terms' },
    },
  };
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return <TermsView lang={lang} />;
}
