import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { locales, isLocale, type Locale } from '@/lib/i18n';
import PrivacyView from '@/components/views/PrivacyView';

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

const META: Record<Locale, { title: string; description: string }> = {
  fr: { title: 'Politique de confidentialité', description: 'Comment Etudesk collecte, utilise et protège tes données.' },
  en: { title: 'Privacy Policy', description: 'How Etudesk collects, uses and protects your data.' },
};

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const l: Locale = isLocale(lang) ? lang : 'fr';
  return {
    title: META[l].title,
    description: META[l].description,
    alternates: {
      canonical: `/${l}/privacy`,
      languages: { fr: '/fr/privacy', en: '/en/privacy', 'x-default': '/fr/privacy' },
    },
  };
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return <PrivacyView lang={lang} />;
}
