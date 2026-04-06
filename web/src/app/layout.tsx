import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '../contexts/ThemeContext';

export const metadata: Metadata = {
  title: 'Etudesk - Opportunités, Communautés, Espaces en Afrique de l\'Ouest',
  description: 'Etudesk connecte les talents aux opportunités, communautés et espaces de travail en Afrique de l\'Ouest. Disponible sur iOS et Android.',
  icons: {
    icon: '/images/etudesk_squared_icon.png',
    apple: '/images/etudesk_squared_icon.png',
  },
  openGraph: {
    title: 'Etudesk - Ton talent mérite une plateforme à sa hauteur',
    description: 'Opportunités, communautés, espaces de travail — un assistant intelligent pour tout relier. Disponible sur App Store et Google Play.',
    type: 'website',
    siteName: 'Etudesk',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
