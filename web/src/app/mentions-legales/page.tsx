'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

const translations = {
  fr: {
    title: 'Mentions Légales',
    lastUpdated: 'Dernière mise à jour',
    backToHome: 'Retour à l\'accueil',
    sections: [
      {
        title: '1. Éditeur de la plateforme',
        content: `**Etudesk SAS**
Société par Actions Simplifiée (SAS)
Capital social : 1 334 000 FCFA
Siège social : Résidences Aghien Bloc A Villa 8, Cocody II Plateau, Abidjan, Côte d'Ivoire
RCCM : CI-ABJ-2016-B-14288
DFE : 1740183 C
Date de création : 16 mai 2016
Email : hello@etudesk.org`,
      },
      {
        title: '2. Directeur de la publication',
        content: `Lamine Barro
Directeur Général d'Etudesk SAS`,
      },
      {
        title: '3. Hébergement',
        content: `LWS (Ligne Web Services)
4 rue Galvani
75017 Paris, France
www.lws.fr`,
      },
      {
        title: '4. Propriété intellectuelle',
        content: `L'ensemble des éléments de la plateforme Etudesk (textes, images, logos, vidéos, bases de données, algorithmes d'intelligence artificielle, code source) sont protégés par le droit d'auteur, le droit des marques et tout autre droit de propriété intellectuelle applicable.

Toute reproduction, représentation, modification, publication ou adaptation de tout ou partie des éléments de la plateforme, quel que soit le moyen ou le procédé utilisé, est interdite sans l'autorisation écrite préalable d'Etudesk SAS.`,
      },
      {
        title: '5. Données personnelles',
        content: `Etudesk SAS s'engage à respecter la vie privée de ses utilisateurs et à protéger leurs données personnelles conformément au Règlement Général sur la Protection des Données (RGPD) et aux lois ivoiriennes applicables.

Pour plus d'informations, consultez notre Politique de Confidentialité accessible à l'adresse : https://etudesk.com/privacy`,
      },
      {
        title: '6. Cookies',
        content: `La plateforme Etudesk utilise des cookies essentiels pour le fonctionnement du service (authentification, préférences) et des cookies analytiques pour améliorer l'expérience utilisateur.

Vous pouvez gérer vos préférences de cookies dans les paramètres de votre navigateur ou de l'application.`,
      },
      {
        title: '7. Droit applicable et juridiction',
        content: `Les présentes mentions légales sont régies par le droit ivoirien. En cas de litige, et à défaut de résolution amiable, les tribunaux compétents d'Abidjan, Côte d'Ivoire seront seuls compétents.

En cas de traduction, la version française prévaut.`,
      },
      {
        title: '8. Contact',
        content: `Pour toute question concernant ces mentions légales :

**Email :** hello@etudesk.org

**Adresse postale :**
Etudesk SAS
Résidences Aghien Bloc A Villa 8, Cocody II Plateau
Abidjan, Côte d'Ivoire`,
      },
    ],
  },
  en: {
    title: 'Legal Notice',
    lastUpdated: 'Last updated',
    backToHome: 'Back to home',
    sections: [
      {
        title: '1. Platform Publisher',
        content: `**Etudesk SAS**
Simplified Joint-Stock Company (Société par Actions Simplifiée)
Share capital: 1,334,000 FCFA
Registered office: Résidences Aghien Bloc A Villa 8, Cocody II Plateau, Abidjan, Ivory Coast
Trade Registry (RCCM): CI-ABJ-2016-B-14288
Tax ID (DFE): 1740183 C
Founded: May 16, 2016
Email: hello@etudesk.org`,
      },
      {
        title: '2. Publication Director',
        content: `Lamine Barro
Chief Executive Officer (Directeur Général) of Etudesk SAS`,
      },
      {
        title: '3. Hosting',
        content: `LWS (Ligne Web Services)
4 rue Galvani
75017 Paris, France
www.lws.fr`,
      },
      {
        title: '4. Intellectual Property',
        content: `All elements of the Etudesk platform (texts, images, logos, videos, databases, artificial intelligence algorithms, source code) are protected by copyright, trademark law and all other applicable intellectual property rights.

Any reproduction, representation, modification, publication or adaptation of all or part of the platform elements, by any means or process, is prohibited without prior written authorization from Etudesk SAS.`,
      },
      {
        title: '5. Personal Data',
        content: `Etudesk SAS is committed to respecting the privacy of its users and protecting their personal data in accordance with the General Data Protection Regulation (GDPR) and applicable Ivorian laws.

For more information, please consult our Privacy Policy available at: https://etudesk.com/privacy`,
      },
      {
        title: '6. Cookies',
        content: `The Etudesk platform uses essential cookies for service operation (authentication, preferences) and analytics cookies to improve user experience.

You can manage your cookie preferences in your browser or app settings.`,
      },
      {
        title: '7. Governing Law and Jurisdiction',
        content: `These legal notices are governed by Ivorian law. In case of dispute, and failing amicable resolution, the competent courts of Abidjan, Ivory Coast shall have sole jurisdiction.

In case of translation, the French version prevails.`,
      },
      {
        title: '8. Contact',
        content: `For any questions regarding these legal notices:

**Email:** hello@etudesk.org

**Mailing address:**
Etudesk SAS
Résidences Aghien Bloc A Villa 8, Cocody II Plateau
Abidjan, Ivory Coast`,
      },
    ],
  },
};

type Lang = 'fr' | 'en';

export default function MentionsLegalesPage() {
  const [lang, setLang] = useState<Lang>('fr');
  const t = translations[lang];
  const updateDate = '2026-02-19';

  return (
    <main className="legal-page">
      {/* Navigation */}
      <nav className="nav">
        <div className="nav-container">
          <Link href="/" className="nav-logo">
            <Image src="/images/etudesk_logo_black.png" alt="Etudesk" width={120} height={35} style={{ objectFit: 'contain' }} />
          </Link>
          <div className="nav-lang">
            <button className={lang === 'fr' ? 'active' : ''} onClick={() => setLang('fr')} aria-label="Français">FR</button>
            <button className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')} aria-label="English">EN</button>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="content">
        <Link href="/" className="back-link">&larr; {t.backToHome}</Link>

        <h1>{t.title}</h1>
        <p className="last-updated">{t.lastUpdated}: {updateDate}</p>

        {t.sections.map((section, index) => (
          <section key={index} className="section">
            <h2>{section.title}</h2>
            <div className="section-content">
              {section.content.split('\n').map((paragraph, pIndex) => {
                const formattedText = paragraph.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
                return (
                  <p key={pIndex} dangerouslySetInnerHTML={{ __html: formattedText }} />
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {/* Footer */}
      <footer className="footer">
        <p>&copy; {new Date().getFullYear()} Etudesk. All rights reserved.</p>
      </footer>

      <style jsx>{`
        .legal-page {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }

        .nav {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          z-index: 100;
          border-bottom: 1px solid var(--border-color);
        }

        .nav-container {
          max-width: 900px;
          margin: 0 auto;
          padding: 0.75rem 1.5rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .nav-logo {
          display: flex;
          align-items: center;
        }

        .nav-lang {
          display: flex;
          gap: 0.25rem;
        }

        .nav-lang button {
          padding: 0.5rem 0.75rem;
          border: 1px solid var(--border-color);
          background: transparent;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 500;
          font-size: 0.875rem;
          transition: all 0.2s;
          min-width: 44px;
          min-height: 44px;
        }

        .nav-lang button.active {
          background: var(--primary);
          color: white;
          border-color: var(--primary);
        }

        .content {
          max-width: 900px;
          margin: 0 auto;
          padding: 7rem 1.5rem 3rem;
          flex: 1;
        }

        .back-link {
          display: inline-flex;
          align-items: center;
          color: var(--primary);
          margin-bottom: 1.5rem;
          font-weight: 500;
          padding: 0.5rem 0;
          min-height: 44px;
        }

        .back-link:hover {
          text-decoration: underline;
        }

        h1 {
          font-size: 2.25rem;
          margin-bottom: 0.5rem;
          color: var(--text-primary);
        }

        .last-updated {
          color: var(--text-secondary);
          margin-bottom: 2.5rem;
          font-size: 0.9375rem;
        }

        .section {
          margin-bottom: 2rem;
        }

        .section h2 {
          font-size: 1.125rem;
          color: var(--text-primary);
          margin-bottom: 0.75rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid var(--border-color);
        }

        .section-content p {
          color: var(--text-secondary);
          line-height: 1.7;
          margin-bottom: 0.625rem;
          font-size: 0.9375rem;
        }

        .section-content p:empty {
          display: none;
        }

        .section-content :global(strong) {
          color: var(--text-primary);
          font-weight: 600;
        }

        .footer {
          background: var(--gray-100);
          padding: 1.5rem;
          text-align: center;
          color: var(--text-secondary);
          font-size: 0.875rem;
        }

        @media (max-width: 1024px) {
          h1 {
            font-size: 2rem;
          }
        }

        @media (max-width: 768px) {
          .nav-container {
            padding: 0.5rem 1rem;
          }

          .content {
            padding: 6rem 1rem 2rem;
          }

          h1 {
            font-size: 1.625rem;
          }

          .last-updated {
            margin-bottom: 2rem;
          }

          .section h2 {
            font-size: 1rem;
          }

          .section-content p {
            font-size: 0.875rem;
          }
        }

        @media (max-width: 480px) {
          .nav-lang button {
            padding: 0.375rem 0.5rem;
            font-size: 0.8125rem;
            min-width: 40px;
          }

          h1 {
            font-size: 1.375rem;
          }

          .section-content p {
            font-size: 0.8125rem;
            line-height: 1.6;
          }
        }
      `}</style>
    </main>
  );
}
