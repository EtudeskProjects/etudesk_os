import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '../contexts/ThemeContext';
import { LangProvider } from '../contexts/LangContext';

const BASE = 'https://etudesk.com';
const TITLE = 'Etudesk - Les compétences du digital, à la vitesse du marché';
const DESC =
  'Forme-toi aux compétences du digital avec ton tuteur IA, et transforme-les en opportunités avec ton guide carrière IA. Référentiel vivant de 1687 compétences, sans abonnement, 20 crédits offerts. Sur iOS et Android.';

export const metadata: Metadata = {
  metadataBase: new URL(BASE),
  title: {
    default: TITLE,
    template: '%s · Etudesk',
  },
  description: DESC,
  applicationName: 'Etudesk',
  category: 'education',
  keywords: [
    'compétences du digital',
    'digital skills',
    'apprendre en ligne',
    'tuteur IA',
    'AI tutor',
    'formation IA',
    'référentiel des compétences',
    'reconversion numérique',
    'emploi tech',
    'compétences numériques',
    'apprendre la programmation',
    'data, IA, machine learning',
    'Afrique',
    'Côte d\'Ivoire',
  ],
  authors: [{ name: 'Etudesk' }],
  creator: 'Etudesk',
  publisher: 'Etudesk',
  alternates: { canonical: '/' },
  formatDetection: { telephone: false, address: false, email: false },
  icons: {
    icon: '/images/etudesk_squared_icon.png',
    apple: '/images/etudesk_squared_icon.png',
  },
  openGraph: {
    title: TITLE,
    description:
      'Ton tuteur IA t\'explique, ton guide carrière IA te trouve l\'opportunité, sur un référentiel vivant. 20 crédits offerts. Sur App Store et Google Play.',
    url: BASE,
    type: 'website',
    siteName: 'Etudesk',
    locale: 'fr_FR',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description:
      'Apprends les compétences du digital avec ton tuteur IA, décroche avec ton guide carrière IA. Sans abonnement.',
    site: '@etudesk',
    creator: '@etudesk',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
};

const JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'EducationalOrganization',
      '@id': `${BASE}/#organization`,
      name: 'Etudesk',
      url: BASE,
      logo: `${BASE}/images/etudesk_logo_black.png`,
      description: DESC,
      foundingDate: '2016',
      sameAs: [
        'https://www.linkedin.com/company/etudesk',
        'https://x.com/etudesk',
        'https://www.facebook.com/etudesk',
        'https://www.instagram.com/etudesk',
        'https://www.youtube.com/@etudesk',
      ],
    },
    {
      '@type': 'WebSite',
      '@id': `${BASE}/#website`,
      url: BASE,
      name: 'Etudesk',
      inLanguage: 'fr',
      publisher: { '@id': `${BASE}/#organization` },
    },
    {
      '@type': 'MobileApplication',
      name: 'Etudesk',
      operatingSystem: 'iOS, Android',
      applicationCategory: 'EducationApplication',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      publisher: { '@id': `${BASE}/#organization` },
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
        <ThemeProvider>
          <LangProvider>{children}</LangProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
