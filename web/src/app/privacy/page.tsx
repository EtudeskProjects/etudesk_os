'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

const translations = {
  fr: {
    title: 'Politique de Confidentialité',
    lastUpdated: 'Dernière mise à jour',
    backToHome: 'Retour à l\'accueil',
    sections: [
      {
        title: '1. Introduction',
        content: `Chez Etudesk, nous accordons une importance primordiale à la protection de vos données personnelles. Cette Politique de Confidentialité explique comment nous collectons, utilisons, stockons et protégeons vos informations lorsque vous utilisez notre plateforme et nos services.

En utilisant Etudesk, vous acceptez les pratiques décrites dans cette politique. Nous vous encourageons à la lire attentivement.`,
      },
      {
        title: '2. Données collectées',
        content: `Nous collectons les types de données suivants :

**Données d'identification :**
- Nom, prénom, adresse email
- Numéro de téléphone
- Photo de profil
- Pièces d'identité (pour la vérification KYC)

**Données professionnelles :**
- CV et documents de carrière
- Compétences et qualifications
- Expériences professionnelles
- Objectifs de carrière
- Secteurs d'activité d'intérêt

**Données d'utilisation :**
- Interactions avec l'assistant IA
- Historique de navigation sur la plateforme
- Candidatures et conversations
- Préférences et paramètres

**Données techniques :**
- Adresse IP
- Type d'appareil et système d'exploitation
- Identifiants d'appareil
- Données de géolocalisation (si autorisé)`,
      },
      {
        title: '3. Utilisation des données',
        content: `Vos données sont utilisées pour :

**Fournir nos services :**
- Créer et gérer votre compte
- Personnaliser l'assistant IA selon votre profil
- Vous proposer des opportunités pertinentes
- Faciliter vos interactions avec les communautés et organisations

**Améliorer nos services :**
- Analyser l'utilisation de la plateforme
- Développer de nouvelles fonctionnalités
- Améliorer les algorithmes d'IA et de recommandation

**Communications :**
- Notifications relatives à vos candidatures
- Alertes sur les nouvelles opportunités
- Informations sur les mises à jour de service
- Communications marketing (avec votre consentement)

**Sécurité et conformité :**
- Prévenir les fraudes et abus
- Respecter nos obligations légales
- Vérifier l'identité des utilisateurs (KYC)`,
      },
      {
        title: '4. Intelligence artificielle et vos données',
        content: `Notre assistant IA utilise vos données pour vous fournir une expérience personnalisée :

**Mode Explorer :** L'IA analyse votre profil, vos compétences et vos objectifs pour vous recommander des opportunités, des communautés et des formations pertinentes.

**Mode Study :** Vos documents et préférences sont utilisés pour personnaliser votre parcours de formation et vous proposer des contenus adaptés.

**Traitement des données IA :**
- Les conversations avec l'IA sont traitées de manière sécurisée
- Les modèles IA sont hébergés chez nos partenaires (Anthropic, OpenAI) avec des garanties contractuelles
- Vos données ne sont pas utilisées pour entraîner les modèles IA sans votre consentement explicite

Vous pouvez supprimer votre historique de conversations IA à tout moment depuis les paramètres de l'application.`,
      },
      {
        title: '5. Partage des données',
        content: `Nous partageons vos données uniquement dans les cas suivants :

**Avec votre consentement :**
- Lorsque vous postulez à une opportunité, vos informations sont partagées avec l'organisation concernée
- Lorsque vous rejoignez une communauté, certaines informations de profil sont visibles aux autres membres

**Avec nos prestataires :**
- Hébergement cloud (LWS)
- Services d'IA (Anthropic, OpenAI)
- Services de paiement
- Services d'envoi d'emails

Ces prestataires sont contractuellement tenus de protéger vos données.

**Pour des raisons légales :**
- En réponse à une demande légale valide
- Pour protéger nos droits ou ceux de nos utilisateurs
- En cas de fusion ou acquisition (avec notification préalable)

Nous ne vendons jamais vos données personnelles à des tiers.`,
      },
      {
        title: '6. Stockage et sécurité',
        content: `**Durée de conservation :**
- Données de compte : conservées pendant la durée de votre inscription, puis 3 ans après suppression du compte
- Données de candidature : 2 ans après la fin du processus
- Données d'utilisation : 1 an glissant
- Données de paiement : conformément aux obligations fiscales (10 ans)

**Mesures de sécurité :**
- Chiffrement des données en transit (TLS) et au repos (AES-256)
- Authentification sécurisée avec support 2FA
- Surveillance continue des systèmes
- Audits de sécurité réguliers
- Accès restreint aux données sur le principe du besoin d'en connaître

**Localisation des données :**
Vos données sont hébergées sur des serveurs sécurisés situés dans l'Union Européenne et en Afrique de l'Ouest.`,
      },
      {
        title: '7. Vos droits',
        content: `Conformément aux réglementations applicables, vous disposez des droits suivants :

**Droit d'accès :** Obtenir une copie de vos données personnelles que nous détenons.

**Droit de rectification :** Corriger les données inexactes ou incomplètes.

**Droit à l'effacement :** Demander la suppression de vos données (dans les limites légales).

**Droit à la portabilité :** Recevoir vos données dans un format structuré et lisible par machine.

**Droit d'opposition :** Vous opposer au traitement de vos données à des fins marketing.

**Droit de limitation :** Demander la limitation du traitement dans certaines circonstances.

Pour exercer ces droits, contactez-nous à : hello@etudesk.org

Nous répondrons à votre demande dans un délai de 30 jours.`,
      },
      {
        title: '8. Cookies et technologies similaires',
        content: `Nous utilisons des cookies et technologies similaires pour :

**Cookies essentiels :** Permettre le fonctionnement de la plateforme (authentification, préférences).

**Cookies analytiques :** Comprendre comment vous utilisez la plateforme pour l'améliorer.

**Cookies marketing :** Vous proposer des contenus et publicités pertinents (avec votre consentement).

Vous pouvez gérer vos préférences de cookies depuis les paramètres de votre navigateur ou de l'application.`,
      },
      {
        title: '9. Transferts internationaux',
        content: `Certaines de vos données peuvent être transférées vers des pays hors de votre juridiction (notamment vers les États-Unis pour les services d'IA).

Ces transferts sont encadrés par :
- Des clauses contractuelles types approuvées
- Des certifications (Privacy Shield, SOC 2)
- Votre consentement explicite quand requis

Nous nous assurons que le niveau de protection de vos données reste équivalent à celui prévu par les réglementations applicables.`,
      },
      {
        title: '10. Protection des mineurs',
        content: `Etudesk n'est pas destiné aux personnes de moins de 16 ans. Nous ne collectons pas sciemment de données auprès de mineurs.

Si vous êtes parent ou tuteur et pensez que votre enfant nous a fourni des données personnelles, veuillez nous contacter immédiatement à hello@etudesk.org pour que nous puissions supprimer ces informations.`,
      },
      {
        title: '11. Modifications de cette politique',
        content: `Nous pouvons mettre à jour cette Politique de Confidentialité périodiquement. En cas de modification substantielle, nous vous en informerons par :
- Notification dans l'application
- Email à l'adresse associée à votre compte
- Affichage visible sur notre site web

Nous vous encourageons à consulter régulièrement cette page pour rester informé de nos pratiques en matière de confidentialité.`,
      },
      {
        title: '12. Contact',
        content: `Pour toute question concernant cette Politique de Confidentialité ou vos données personnelles :

**Email :** hello@etudesk.org

**Adresse postale :**
Etudesk SAS
Résidences Aghien Bloc A Villa 8, Cocody II Plateau
Abidjan, Côte d'Ivoire

Si vous n'êtes pas satisfait de notre réponse, vous avez le droit de déposer une plainte auprès de l'autorité de protection des données compétente (ARTCI en Côte d'Ivoire).`,
      },
    ],
  },
  en: {
    title: 'Privacy Policy',
    lastUpdated: 'Last updated',
    backToHome: 'Back to home',
    sections: [
      {
        title: '1. Introduction',
        content: `At Etudesk, we place the utmost importance on protecting your personal data. This Privacy Policy explains how we collect, use, store and protect your information when you use our platform and services.

By using Etudesk, you accept the practices described in this policy. We encourage you to read it carefully.`,
      },
      {
        title: '2. Data Collected',
        content: `We collect the following types of data:

**Identification data:**
- First name, last name, email address
- Phone number
- Profile photo
- Identity documents (for KYC verification)

**Professional data:**
- CV and career documents
- Skills and qualifications
- Professional experience
- Career goals
- Industries of interest

**Usage data:**
- Interactions with AI assistant
- Platform browsing history
- Applications and conversations
- Preferences and settings

**Technical data:**
- IP address
- Device type and operating system
- Device identifiers
- Geolocation data (if authorized)`,
      },
      {
        title: '3. Use of Data',
        content: `Your data is used to:

**Provide our services:**
- Create and manage your account
- Personalize the AI assistant based on your profile
- Suggest relevant opportunities
- Facilitate your interactions with communities and organizations

**Improve our services:**
- Analyze platform usage
- Develop new features
- Improve AI and recommendation algorithms

**Communications:**
- Notifications about your applications
- Alerts about new opportunities
- Service update information
- Marketing communications (with your consent)

**Security and compliance:**
- Prevent fraud and abuse
- Meet our legal obligations
- Verify user identity (KYC)`,
      },
      {
        title: '4. Artificial Intelligence and Your Data',
        content: `Our AI assistant uses your data to provide you with a personalized experience:

**Explorer mode:** AI analyzes your profile, skills and goals to recommend relevant opportunities, communities and training.

**Study mode:** Your documents and preferences are used to customize your learning path and suggest tailored content.

**AI data processing:**
- Conversations with AI are processed securely
- AI models are hosted with our partners (Anthropic, OpenAI) with contractual guarantees
- Your data is not used to train AI models without your explicit consent

You can delete your AI conversation history at any time from the app settings.`,
      },
      {
        title: '5. Data Sharing',
        content: `We share your data only in the following cases:

**With your consent:**
- When you apply for an opportunity, your information is shared with the relevant organization
- When you join a community, certain profile information is visible to other members

**With our service providers:**
- Cloud hosting (LWS)
- AI services (Anthropic, OpenAI)
- Payment services
- Email delivery services

These providers are contractually required to protect your data.

**For legal reasons:**
- In response to a valid legal request
- To protect our rights or those of our users
- In case of merger or acquisition (with prior notice)

We never sell your personal data to third parties.`,
      },
      {
        title: '6. Storage and Security',
        content: `**Retention period:**
- Account data: kept for the duration of your registration, then 3 years after account deletion
- Application data: 2 years after the end of the process
- Usage data: 1 rolling year
- Payment data: in accordance with tax obligations (10 years)

**Security measures:**
- Encryption of data in transit (TLS) and at rest (AES-256)
- Secure authentication with 2FA support
- Continuous system monitoring
- Regular security audits
- Restricted data access on a need-to-know basis

**Data location:**
Your data is hosted on secure servers located in the European Union and West Africa.`,
      },
      {
        title: '7. Your Rights',
        content: `In accordance with applicable regulations, you have the following rights:

**Right of access:** Obtain a copy of the personal data we hold about you.

**Right of rectification:** Correct inaccurate or incomplete data.

**Right to erasure:** Request deletion of your data (within legal limits).

**Right to portability:** Receive your data in a structured, machine-readable format.

**Right to object:** Object to the processing of your data for marketing purposes.

**Right to restriction:** Request restriction of processing in certain circumstances.

To exercise these rights, contact us at: hello@etudesk.org

We will respond to your request within 30 days.`,
      },
      {
        title: '8. Cookies and Similar Technologies',
        content: `We use cookies and similar technologies to:

**Essential cookies:** Enable platform operation (authentication, preferences).

**Analytics cookies:** Understand how you use the platform to improve it.

**Marketing cookies:** Offer you relevant content and advertising (with your consent).

You can manage your cookie preferences from your browser or app settings.`,
      },
      {
        title: '9. International Transfers',
        content: `Some of your data may be transferred to countries outside your jurisdiction (notably to the United States for AI services).

These transfers are governed by:
- Approved standard contractual clauses
- Certifications (Privacy Shield, SOC 2)
- Your explicit consent when required

We ensure that the level of protection of your data remains equivalent to that provided by applicable regulations.`,
      },
      {
        title: '10. Protection of Minors',
        content: `Etudesk is not intended for persons under 16 years of age. We do not knowingly collect data from minors.

If you are a parent or guardian and believe your child has provided us with personal data, please contact us immediately at hello@etudesk.org so we can delete this information.`,
      },
      {
        title: '11. Changes to This Policy',
        content: `We may update this Privacy Policy periodically. In case of substantial changes, we will notify you by:
- In-app notification
- Email to the address associated with your account
- Visible notice on our website

We encourage you to regularly review this page to stay informed of our privacy practices.`,
      },
      {
        title: '12. Contact',
        content: `For any questions regarding this Privacy Policy or your personal data:

**Email:** hello@etudesk.org

**Mailing address:**
Etudesk SAS
Résidences Aghien Bloc A Villa 8, Cocody II Plateau
Abidjan, Ivory Coast

If you are not satisfied with our response, you have the right to file a complaint with the competent data protection authority (ARTCI in Ivory Coast).`,
      },
    ],
  },
};

type Lang = 'fr' | 'en';

export default function PrivacyPage() {
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
                // Handle bold markdown **text**
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
