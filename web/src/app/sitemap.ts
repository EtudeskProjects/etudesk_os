import type { MetadataRoute } from 'next';
import { locales } from '@/lib/i18n';
import { allSkillSlugs } from '@/lib/skill-content';

const BASE = 'https://etudesk.com';

// Routes publiques indexables, declinees par langue (/fr, /en) avec hreflang.
// Les pages par competence (/digital-skills/[slug]) seront ajoutees a la vague 5.
const ROUTES = [
  { path: '', priority: 1, changeFrequency: 'weekly' },
  { path: '/digital-skills', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/terms', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/privacy', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/legal', priority: 0.3, changeFrequency: 'yearly' },
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];
  for (const r of ROUTES) {
    for (const lang of locales) {
      entries.push({
        url: `${BASE}/${lang}${r.path}`,
        lastModified: now,
        changeFrequency: r.changeFrequency,
        priority: r.priority,
        alternates: {
          languages: {
            fr: `${BASE}/fr${r.path}`,
            en: `${BASE}/en${r.path}`,
          },
        },
      });
    }
  }
  // Pages par competence : /[lang]/digital-skills/[slug] (hreflang fr/en).
  for (const slug of allSkillSlugs()) {
    for (const lang of locales) {
      entries.push({
        url: `${BASE}/${lang}/digital-skills/${slug}`,
        lastModified: now,
        changeFrequency: 'monthly',
        priority: 0.6,
        alternates: {
          languages: {
            fr: `${BASE}/fr/digital-skills/${slug}`,
            en: `${BASE}/en/digital-skills/${slug}`,
          },
        },
      });
    }
  }

  return entries;
}
