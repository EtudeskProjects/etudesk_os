'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

const translations = {
  fr: {
    title: 'Conditions Générales d\'Utilisation',
    lastUpdated: 'Dernière mise à jour',
    backToHome: 'Retour à l\'accueil',
    sections: [
      {
        title: '1. Acceptation des conditions',
        content: `En accédant et en utilisant la plateforme Etudesk et ses services (ci-après "la Plateforme"), vous acceptez d'être lié par les présentes Conditions Générales d'Utilisation (ci-après "CGU"). Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser la Plateforme.

Etudesk se réserve le droit de modifier ces CGU à tout moment. Les modifications entrent en vigueur dès leur publication sur la Plateforme. Il vous appartient de consulter régulièrement les CGU.`,
      },
      {
        title: '2. Description des services',
        content: `Etudesk est une plateforme intelligente qui propose :
- Un assistant IA personnel pour accompagner votre carrière (modes Explorer, Étudier et Gérer)
- Un accès à des opportunités professionnelles (emplois, stages, missions freelance)
- Des communautés professionnelles pour développer votre réseau
- Des outils de gestion pour les organisations (recrutement, formation, communautés)

Les services sont accessibles via l'application mobile Etudesk disponible sur iOS et Android.`,
      },
      {
        title: '3. Inscription et compte utilisateur',
        content: `Pour utiliser la Plateforme, vous devez créer un compte en fournissant des informations exactes et complètes. Vous êtes responsable de :
- La confidentialité de vos identifiants de connexion
- Toutes les activités effectuées depuis votre compte
- La mise à jour de vos informations personnelles

Vous devez avoir au moins 16 ans pour créer un compte. L'utilisation de faux profils ou l'usurpation d'identité est strictement interdite et peut entraîner la suspension immédiate du compte.`,
      },
      {
        title: '4. Utilisation acceptable',
        content: `En utilisant la Plateforme, vous vous engagez à :
- Respecter les lois et réglementations applicables
- Ne pas publier de contenu illégal, offensant, diffamatoire ou trompeur
- Ne pas utiliser la Plateforme à des fins frauduleuses ou malveillantes
- Ne pas tenter de contourner les mesures de sécurité
- Ne pas collecter les données d'autres utilisateurs sans autorisation
- Ne pas utiliser de robots, scrapers ou autres outils automatisés
- Respecter les droits de propriété intellectuelle

Etudesk se réserve le droit de suspendre ou supprimer tout compte en cas de violation de ces règles.`,
      },
      {
        title: '5. Crédits et paiements',
        content: `Etudesk fonctionne sur un système de crédits prépayés :
- Chaque utilisateur (talent ou organisation) dispose d'un portefeuille de crédits
- Les crédits sont achetés à l'avance via paiement sécurisé (Paystack) en FCFA
- Montant minimum : 2 000 FCFA (talent) / 10 000 FCFA (organisation)
- Les crédits sont consommés à l'usage (interactions avec l'assistant IA, génération de documents, etc.)

Les prix sont indiqués en FCFA. Les paiements sont traités de manière sécurisée par Paystack. Les crédits achetés ne sont pas remboursables sauf disposition légale contraire.

Les crédits n'expirent pas tant que votre compte est actif.`,
      },
      {
        title: '6. Propriété intellectuelle',
        content: `Tout le contenu de la Plateforme (textes, images, logos, code, algorithmes IA) est la propriété exclusive d'Etudesk ou de ses partenaires et est protégé par les lois sur la propriété intellectuelle.

Vous conservez la propriété de tout contenu que vous publiez sur la Plateforme, mais vous accordez à Etudesk une licence mondiale, non exclusive et gratuite pour utiliser, reproduire et afficher ce contenu dans le cadre du fonctionnement de la Plateforme.`,
      },
      {
        title: '7. Protection des données',
        content: `Etudesk s'engage à protéger vos données personnelles conformément à notre Politique de Confidentialité et aux réglementations applicables en matière de protection des données.

Vos données sont utilisées pour fournir et améliorer nos services, personnaliser votre expérience et vous envoyer des communications pertinentes. Vous disposez de droits d'accès, de rectification et de suppression de vos données.`,
      },
      {
        title: '8. Limitation de responsabilité',
        content: `La Plateforme est fournie "en l'état". Etudesk ne garantit pas :
- La disponibilité ininterrompue des services
- L'exactitude des informations fournies par l'IA ou les autres utilisateurs
- Les résultats obtenus grâce à l'utilisation de la Plateforme

Etudesk ne peut être tenu responsable des dommages directs ou indirects résultant de l'utilisation de la Plateforme, sauf en cas de faute grave ou intentionnelle.`,
      },
      {
        title: '9. Résiliation',
        content: `Vous pouvez supprimer votre compte à tout moment depuis les paramètres de l'application. La suppression désactive votre profil et supprime vos données conformément à notre Politique de Confidentialité. Si vous êtes administrateur unique d'une organisation avec d'autres membres, vous devez transférer les droits d'administration au préalable.

Etudesk peut suspendre ou supprimer votre compte en cas de violation des CGU, avec ou sans préavis. En cas de résiliation, vous perdez l'accès à vos données et contenus associés au compte.`,
      },
      {
        title: '10. Droit applicable et juridiction',
        content: `Les présentes CGU sont régies par le droit ivoirien. Tout litige relatif à l'interprétation ou à l'exécution des CGU sera soumis aux tribunaux compétents d'Abidjan, Côte d'Ivoire.

En cas de traduction, la version française prévaut.`,
      },
      {
        title: '11. Contact',
        content: `Pour toute question concernant ces CGU, vous pouvez nous contacter à :

Email : hello@etudesk.org
Etudesk SAS
Résidences Aghien Bloc A Villa 8, Cocody II Plateau
Abidjan, Côte d'Ivoire`,
      },
    ],
  },
  en: {
    title: 'Terms of Service',
    lastUpdated: 'Last updated',
    backToHome: 'Back to home',
    sections: [
      {
        title: '1. Acceptance of Terms',
        content: `By accessing and using the Etudesk platform and its services (hereinafter "the Platform"), you agree to be bound by these Terms of Service (hereinafter "Terms"). If you do not accept these terms, please do not use the Platform.

Etudesk reserves the right to modify these Terms at any time. Changes take effect upon publication on the Platform. It is your responsibility to regularly review the Terms.`,
      },
      {
        title: '2. Description of Services',
        content: `Etudesk is an intelligent platform that offers:
- A personal AI assistant to support your career (Explore, Study and Manage modes)
- Access to professional opportunities (jobs, internships, freelance missions)
- Professional communities to expand your network
- Management tools for organizations (recruitment, training, communities)

Services are accessible via the Etudesk mobile application available on iOS and Android.`,
      },
      {
        title: '3. Registration and User Account',
        content: `To use the Platform, you must create an account by providing accurate and complete information. You are responsible for:
- The confidentiality of your login credentials
- All activities carried out from your account
- Keeping your personal information up to date

You must be at least 16 years old to create an account. The use of fake profiles or identity theft is strictly prohibited and may result in immediate account suspension.`,
      },
      {
        title: '4. Acceptable Use',
        content: `By using the Platform, you agree to:
- Comply with applicable laws and regulations
- Not post illegal, offensive, defamatory or misleading content
- Not use the Platform for fraudulent or malicious purposes
- Not attempt to circumvent security measures
- Not collect data from other users without authorization
- Not use bots, scrapers or other automated tools
- Respect intellectual property rights

Etudesk reserves the right to suspend or delete any account in case of violation of these rules.`,
      },
      {
        title: '5. Credits and Payments',
        content: `Etudesk operates on a prepaid credit system:
- Each user (talent or organization) has a credit wallet
- Credits are purchased in advance via secure payment (Paystack) in FCFA
- Minimum purchase: 2,000 FCFA (talent) / 10,000 FCFA (organization)
- Credits are consumed on usage (AI assistant interactions, document generation, etc.)

Prices are indicated in FCFA. Payments are processed securely by Paystack. Purchased credits are non-refundable except as required by law.

Credits do not expire as long as your account is active.`,
      },
      {
        title: '6. Intellectual Property',
        content: `All content on the Platform (texts, images, logos, code, AI algorithms) is the exclusive property of Etudesk or its partners and is protected by intellectual property laws.

You retain ownership of any content you post on the Platform, but you grant Etudesk a worldwide, non-exclusive, royalty-free license to use, reproduce and display such content for the operation of the Platform.`,
      },
      {
        title: '7. Data Protection',
        content: `Etudesk is committed to protecting your personal data in accordance with our Privacy Policy and applicable data protection regulations.

Your data is used to provide and improve our services, personalize your experience, and send you relevant communications. You have rights to access, rectify, and delete your data.`,
      },
      {
        title: '8. Limitation of Liability',
        content: `The Platform is provided "as is". Etudesk does not guarantee:
- Uninterrupted availability of services
- Accuracy of information provided by AI or other users
- Results obtained through use of the Platform

Etudesk cannot be held liable for direct or indirect damages resulting from use of the Platform, except in cases of gross negligence or intentional misconduct.`,
      },
      {
        title: '9. Termination',
        content: `You may delete your account at any time from the app settings. Deletion deactivates your profile and removes your data in accordance with our Privacy Policy. If you are the sole administrator of an organization with other members, you must transfer admin rights beforehand.

Etudesk may suspend or delete your account in case of Terms violation, with or without notice. Upon termination, you lose access to your data and content associated with the account.`,
      },
      {
        title: '10. Governing Law and Jurisdiction',
        content: `These Terms are governed by Ivorian law. Any dispute relating to the interpretation or execution of the Terms shall be submitted to the competent courts of Abidjan, Ivory Coast.

In case of translation, the French version prevails.`,
      },
      {
        title: '11. Contact',
        content: `For any questions regarding these Terms, you can contact us at:

Email: hello@etudesk.org
Etudesk SAS
Résidences Aghien Bloc A Villa 8, Cocody II Plateau
Abidjan, Ivory Coast`,
      },
    ],
  },
};

type Lang = 'fr' | 'en';

export default function TermsPage() {
  const [lang, setLang] = useState<Lang>('fr');
  const t = translations[lang];
  const updateDate = '2026-02-21';

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
              {section.content.split('\n').map((paragraph, pIndex) => (
                <p key={pIndex}>{paragraph}</p>
              ))}
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

        .footer {
          background: var(--gray-100);
          padding: 1.5rem;
          text-align: center;
          color: var(--text-secondary);
          font-size: 0.875rem;
        }

        /* Tablet */
        @media (max-width: 1024px) {
          h1 {
            font-size: 2rem;
          }
        }

        /* Mobile */
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

        /* Small phones */
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
