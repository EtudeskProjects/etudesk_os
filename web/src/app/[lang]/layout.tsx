import { notFound } from 'next/navigation';
import { locales, isLocale } from '@/lib/i18n';

// Seules les locales connues (fr, en) sont valides : toute autre -> 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return children;
}
