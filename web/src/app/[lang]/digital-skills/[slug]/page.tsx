import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { locales, isLocale, type Locale } from '@/lib/i18n';
import { getSkillContent, allSkillSlugs } from '@/lib/skill-content';
import SkillView from '@/components/views/SkillView';

const BASE = 'https://etudesk.com';

// Toutes les compétences sont pré-générées pour les 2 langues : chaque page doit
// être indexable (le segment parent [lang] impose dynamicParams=false).
export function generateStaticParams() {
  const slugs = allSkillSlugs();
  return locales.flatMap((lang) => slugs.map((slug) => ({ lang, slug })));
}

export async function generateMetadata(
  { params }: { params: Promise<{ lang: string; slug: string }> },
): Promise<Metadata> {
  const { lang, slug } = await params;
  const l: Locale = isLocale(lang) ? lang : 'fr';
  const content = getSkillContent(slug, l);
  if (!content) return { title: 'Etudesk' };

  const path = `/${l}/digital-skills/${slug}`;
  return {
    title: content.metaTitle,
    description: content.metaDescription,
    alternates: {
      canonical: path,
      languages: {
        fr: `/fr/digital-skills/${slug}`,
        en: `/en/digital-skills/${slug}`,
        'x-default': `/fr/digital-skills/${slug}`,
      },
    },
    openGraph: {
      title: content.metaTitle,
      description: content.metaDescription,
      url: `${BASE}${path}`,
      type: 'article',
    },
  };
}

export default async function Page(
  { params }: { params: Promise<{ lang: string; slug: string }> },
) {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();
  const content = getSkillContent(slug, lang);
  if (!content) notFound();

  const path = `/${lang}/digital-skills/${slug}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'DefinedTerm',
        '@id': `${BASE}${path}#term`,
        name: content.name,
        description: content.intro,
        url: `${BASE}${path}`,
        inDefinedTermSet: {
          '@type': 'DefinedTermSet',
          name: lang === 'fr' ? 'Référentiel des compétences digitales Etudesk' : 'Etudesk Digital Skills Referential',
          url: `${BASE}/${lang}/digital-skills`,
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: lang === 'fr' ? 'Référentiel' : 'Referential', item: `${BASE}/${lang}/digital-skills` },
          { '@type': 'ListItem', position: 2, name: content.name, item: `${BASE}${path}` },
        ],
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SkillView lang={lang} content={content} />
    </>
  );
}
