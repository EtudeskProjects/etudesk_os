'use client';

import React, { useState } from 'react';
import Image from 'next/image';

// Translations
const translations = {
  fr: {
    nav: {
      talents: 'Talents',
      organizations: 'Organisations',
      pricing: 'Tarifs',
      contact: 'Contact',
      menu: 'Menu',
    },
    hero: {
      tagline: 'La plateforme qui travaille pour vous',
      title: 'Votre talent mérite plus qu\'un CV oublié dans une boîte mail',
      subtitle: 'Etudesk connecte votre profil aux bonnes opportunités, aux bonnes personnes et aux bons espaces. Avec un copilote IA qui comprend vos ambitions.',
      downloadIOS: 'Télécharger sur iOS',
      downloadAndroid: 'Télécharger sur Android',
      comingSoon: 'Bientôt sur les stores',
    },
    stats: {
      opportunities: 'Opportunités actives',
      talents: 'Talents inscrits',
      communities: 'Communautés actives',
      spaces: 'Espaces partenaires',
    },
    pillars: {
      title: 'Un écosystème complet',
      subtitle: 'Tout ce qu\'il vous faut pour avancer, au même endroit',
      items: [
        {
          title: 'Opportunités sur mesure',
          description: 'Stages, emplois, missions freelance. Notre IA analyse votre profil et vous présente les offres qui correspondent vraiment à vos compétences et objectifs.',
          image: '/images/onboarding_1.png',
        },
        {
          title: 'Communautés professionnelles',
          description: 'Rejoignez des cercles de professionnels de votre secteur. Partagez, apprenez, collaborez. Le networking authentique, sans les faux-semblants.',
          image: '/images/onboarding_2.png',
        },
        {
          title: 'Espaces de travail & formation',
          description: 'Réservez des bureaux, salles de réunion ou espaces de formation près de chez vous. Travaillez dans un cadre professionnel, quand vous en avez besoin.',
          image: '/images/onboarding_3.png',
        },
        {
          title: 'Copilote IA personnel',
          description: 'Un assistant qui vous connaît. Il explore les opportunités pour vous, vous aide à vous former, génère vos documents et répond à vos questions de carrière.',
          image: '/images/etudesk_squared_icon.png',
        },
      ],
    },
    talents: {
      badge: 'Pour les talents',
      title: 'Arrêtez de chercher.\nLaissez les opportunités vous trouver.',
      subtitle: 'Vous avez des compétences précieuses. Etudesk s\'assure qu\'elles ne restent pas invisibles.',
      features: [
        {
          title: 'Profil intelligent',
          description: 'Importez votre CV, et notre IA extrait automatiquement vos compétences, expériences et formations. Votre profil se construit tout seul.',
        },
        {
          title: 'Match scoring',
          description: 'Chaque opportunité affiche un score de compatibilité. Vous savez immédiatement si ça vaut le coup de postuler.',
        },
        {
          title: 'Mode Study',
          description: 'Votre copilote devient tuteur. Posez vos questions, demandez des explications, générez des quiz. Apprenez à votre rythme.',
        },
        {
          title: 'Candidatures simplifiées',
          description: 'Un clic pour postuler. Votre profil, vos documents, tout est déjà prêt. Plus de formulaires interminables.',
        },
      ],
    },
    orgs: {
      badge: 'Pour les organisations',
      title: 'Recrutez les talents qu\'il vous faut.\nPas ceux qui crient le plus fort.',
      subtitle: 'Cabinets, PME, startups, consultants : accédez à un vivier de talents qualifiés et pré-évalués.',
      features: [
        {
          title: 'Candidatures classées par l\'IA',
          description: 'Notre algorithme analyse chaque candidature et vous présente les profils les plus pertinents en premier. Fini le tri manuel de 200 CVs.',
        },
        {
          title: 'Communautés privées',
          description: 'Créez votre communauté de talents, anciens collaborateurs ou partenaires. Publiez des offres, des événements, des sondages.',
        },
        {
          title: 'Espaces de consultation',
          description: 'Proposez vos bureaux ou salles de formation à la réservation. Générez des revenus complémentaires.',
        },
        {
          title: 'Analytics & export',
          description: 'Suivez vos statistiques de recrutement. Exportez vos données en CSV. Prenez des décisions éclairées.',
        },
      ],
    },
    copilot: {
      badge: 'Intelligence artificielle',
      title: 'Un copilote qui vous comprend',
      subtitle: 'Pas un chatbot générique. Un assistant personnel qui connaît votre profil, vos objectifs et votre parcours.',
      features: [
        {
          icon: '🔍',
          title: 'Mode Explorer',
          description: 'Demandez-lui de trouver des opportunités, des communautés ou des espaces. Il cherche, analyse et vous présente les meilleurs résultats.',
        },
        {
          icon: '📚',
          title: 'Mode Study',
          description: 'Transformez-le en tuteur personnel. Il génère des cours, des exercices, des vidéos YouTube pertinentes et des quiz adaptés à votre niveau.',
        },
        {
          icon: '📄',
          title: 'Génération de documents',
          description: 'CV, lettres de motivation, rapports, présentations. Décrivez ce que vous voulez, il le crée pour vous.',
        },
        {
          icon: '🎨',
          title: 'Création visuelle',
          description: 'Diagrammes, schémas, images. Visualisez vos idées en quelques secondes.',
        },
      ],
    },
    pricing: {
      title: 'Des tarifs adaptés à chaque ambition',
      subtitle: 'Commencez gratuitement. Évoluez quand vous êtes prêt.',
      monthly: '/mois',
      free: 'Gratuit',
      popular: 'Populaire',
      contactUs: 'Nous contacter',
      getStarted: 'Commencer',
      plans: [
        {
          name: 'Discover',
          price: 'Gratuit',
          target: 'Pour démarrer',
          description: 'Parfait pour explorer la plateforme et postuler à vos premières opportunités.',
          features: [
            '5 interactions copilote / jour',
            'Candidatures illimitées',
            '1 document (CV)',
            'Accès aux communautés publiques',
            'Mode Explorer & Study',
          ],
        },
        {
          name: 'Talent',
          price: '5 000 FCFA',
          target: 'Pour se démarquer',
          popular: true,
          description: 'Pour les professionnels qui veulent maximiser leur visibilité et leurs chances.',
          features: [
            '30 interactions copilote / jour',
            '20 documents (CV, certificats, portfolio)',
            'Profil boosté dans les recherches',
            'Parrainage : +10 crédits/jour',
            'Support prioritaire',
          ],
        },
        {
          name: 'Pro',
          price: '25 000 FCFA',
          target: 'Pour recruter',
          description: 'Pour les consultants, PME et startups qui recrutent régulièrement.',
          features: [
            '100 interactions copilote / jour',
            '1 organisation avec 5 membres',
            'Recherche intelligente de talents',
            'Analytics & export CSV',
            'Création de communautés',
          ],
        },
        {
          name: 'Corporate',
          price: 'Sur mesure',
          target: 'Pour scaler',
          description: 'Pour les grandes structures avec des besoins spécifiques.',
          features: [
            '500+ interactions copilote / jour',
            'Organisations & membres illimités',
            'Business Intelligence avancé',
            'Intégration sur mesure',
            'Account manager dédié',
          ],
        },
      ],
    },
    cta: {
      title: 'Prêt à transformer votre carrière ?',
      subtitle: 'Rejoignez des milliers de talents et d\'organisations qui construisent l\'avenir du travail.',
      button: 'Télécharger l\'app',
    },
    footer: {
      description: 'L\'écosystème intelligent pour les talents et les organisations qui veulent aller plus loin.',
      product: 'Produit',
      legal: 'Légal',
      contact: 'Contact',
      followUs: 'Suivez-nous',
      terms: 'Conditions d\'utilisation',
      privacy: 'Politique de confidentialité',
      rights: 'Tous droits réservés.',
    },
  },
  en: {
    nav: {
      talents: 'Talents',
      organizations: 'Organizations',
      pricing: 'Pricing',
      contact: 'Contact',
      menu: 'Menu',
    },
    hero: {
      tagline: 'The platform that works for you',
      title: 'Your talent deserves more than a CV forgotten in an inbox',
      subtitle: 'Etudesk connects your profile to the right opportunities, the right people, and the right spaces. With an AI copilot that understands your ambitions.',
      downloadIOS: 'Download on iOS',
      downloadAndroid: 'Download on Android',
      comingSoon: 'Coming soon to app stores',
    },
    stats: {
      opportunities: 'Active opportunities',
      talents: 'Registered talents',
      communities: 'Active communities',
      spaces: 'Partner spaces',
    },
    pillars: {
      title: 'A complete ecosystem',
      subtitle: 'Everything you need to move forward, in one place',
      items: [
        {
          title: 'Tailored opportunities',
          description: 'Internships, jobs, freelance gigs. Our AI analyzes your profile and shows you offers that truly match your skills and goals.',
          image: '/images/onboarding_1.png',
        },
        {
          title: 'Professional communities',
          description: 'Join circles of professionals in your field. Share, learn, collaborate. Authentic networking, without the pretense.',
          image: '/images/onboarding_2.png',
        },
        {
          title: 'Workspaces & training',
          description: 'Book offices, meeting rooms, or training spaces near you. Work in a professional environment when you need it.',
          image: '/images/onboarding_3.png',
        },
        {
          title: 'Personal AI copilot',
          description: 'An assistant that knows you. It explores opportunities, helps you learn, generates documents, and answers your career questions.',
          image: '/images/etudesk_squared_icon.png',
        },
      ],
    },
    talents: {
      badge: 'For talents',
      title: 'Stop searching.\nLet opportunities find you.',
      subtitle: 'You have valuable skills. Etudesk makes sure they don\'t stay invisible.',
      features: [
        {
          title: 'Smart profile',
          description: 'Upload your CV, and our AI automatically extracts your skills, experiences, and education. Your profile builds itself.',
        },
        {
          title: 'Match scoring',
          description: 'Every opportunity shows a compatibility score. You know immediately if it\'s worth applying.',
        },
        {
          title: 'Study mode',
          description: 'Your copilot becomes a tutor. Ask questions, request explanations, generate quizzes. Learn at your own pace.',
        },
        {
          title: 'Simplified applications',
          description: 'One click to apply. Your profile, your documents, everything is ready. No more endless forms.',
        },
      ],
    },
    orgs: {
      badge: 'For organizations',
      title: 'Recruit the talents you need.\nNot the loudest ones.',
      subtitle: 'Agencies, SMEs, startups, consultants: access a pool of qualified and pre-evaluated talents.',
      features: [
        {
          title: 'AI-ranked applications',
          description: 'Our algorithm analyzes each application and presents the most relevant profiles first. No more manually sorting 200 CVs.',
        },
        {
          title: 'Private communities',
          description: 'Create your community of talents, former collaborators, or partners. Post offers, events, polls.',
        },
        {
          title: 'Consultation spaces',
          description: 'Offer your offices or training rooms for booking. Generate additional revenue.',
        },
        {
          title: 'Analytics & export',
          description: 'Track your recruitment stats. Export your data to CSV. Make informed decisions.',
        },
      ],
    },
    copilot: {
      badge: 'Artificial intelligence',
      title: 'A copilot that understands you',
      subtitle: 'Not a generic chatbot. A personal assistant that knows your profile, goals, and journey.',
      features: [
        {
          icon: '🔍',
          title: 'Explorer mode',
          description: 'Ask it to find opportunities, communities, or spaces. It searches, analyzes, and presents the best results.',
        },
        {
          icon: '📚',
          title: 'Study mode',
          description: 'Turn it into a personal tutor. It generates courses, exercises, relevant YouTube videos, and quizzes adapted to your level.',
        },
        {
          icon: '📄',
          title: 'Document generation',
          description: 'CVs, cover letters, reports, presentations. Describe what you want, it creates it for you.',
        },
        {
          icon: '🎨',
          title: 'Visual creation',
          description: 'Diagrams, charts, images. Visualize your ideas in seconds.',
        },
      ],
    },
    pricing: {
      title: 'Pricing adapted to every ambition',
      subtitle: 'Start for free. Upgrade when you\'re ready.',
      monthly: '/month',
      free: 'Free',
      popular: 'Popular',
      contactUs: 'Contact us',
      getStarted: 'Get started',
      plans: [
        {
          name: 'Discover',
          price: 'Free',
          target: 'To get started',
          description: 'Perfect for exploring the platform and applying to your first opportunities.',
          features: [
            '5 copilot interactions / day',
            'Unlimited applications',
            '1 document (CV)',
            'Access to public communities',
            'Explorer & Study mode',
          ],
        },
        {
          name: 'Talent',
          price: '5,000 FCFA',
          target: 'To stand out',
          popular: true,
          description: 'For professionals who want to maximize their visibility and chances.',
          features: [
            '30 copilot interactions / day',
            '20 documents (CVs, certificates, portfolio)',
            'Boosted profile in searches',
            'Referral: +10 credits/day',
            'Priority support',
          ],
        },
        {
          name: 'Pro',
          price: '25,000 FCFA',
          target: 'To recruit',
          description: 'For consultants, SMEs, and startups that recruit regularly.',
          features: [
            '100 copilot interactions / day',
            '1 organization with 5 members',
            'Smart talent search',
            'Analytics & CSV export',
            'Community creation',
          ],
        },
        {
          name: 'Corporate',
          price: 'Custom',
          target: 'To scale',
          description: 'For large organizations with specific needs.',
          features: [
            '500+ copilot interactions / day',
            'Unlimited organizations & members',
            'Advanced Business Intelligence',
            'Custom integration',
            'Dedicated account manager',
          ],
        },
      ],
    },
    cta: {
      title: 'Ready to transform your career?',
      subtitle: 'Join thousands of talents and organizations building the future of work.',
      button: 'Download the app',
    },
    footer: {
      description: 'The intelligent ecosystem for talents and organizations that want to go further.',
      product: 'Product',
      legal: 'Legal',
      contact: 'Contact',
      followUs: 'Follow us',
      terms: 'Terms of Service',
      privacy: 'Privacy Policy',
      rights: 'All rights reserved.',
    },
  },
};

type Lang = 'fr' | 'en';

export default function Home() {
  const [lang, setLang] = useState<Lang>('fr');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const t = translations[lang];

  return (
    <main className="landing">
      {/* Navigation */}
      <nav className="nav">
        <div className="nav-container">
          <div className="nav-logo">
            <Image src="/images/etudesk_logo_black.png" alt="Etudesk" width={120} height={35} style={{ objectFit: 'contain' }} />
          </div>

          {/* Desktop Nav Links */}
          <div className="nav-links desktop-only">
            <a href="#talents">{t.nav.talents}</a>
            <a href="#organizations">{t.nav.organizations}</a>
            <a href="#pricing">{t.nav.pricing}</a>
            <a href="#contact">{t.nav.contact}</a>
          </div>

          <div className="nav-right">
            <div className="nav-lang">
              <button
                className={lang === 'fr' ? 'active' : ''}
                onClick={() => setLang('fr')}
                aria-label="Français"
              >
                FR
              </button>
              <button
                className={lang === 'en' ? 'active' : ''}
                onClick={() => setLang('en')}
                aria-label="English"
              >
                EN
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button
              className="mobile-menu-btn mobile-only"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={t.nav.menu}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 12h18M3 6h18M3 18h18" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="mobile-menu">
            <a href="#talents" onClick={() => setMobileMenuOpen(false)}>{t.nav.talents}</a>
            <a href="#organizations" onClick={() => setMobileMenuOpen(false)}>{t.nav.organizations}</a>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)}>{t.nav.pricing}</a>
            <a href="#contact" onClick={() => setMobileMenuOpen(false)}>{t.nav.contact}</a>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <span className="hero-tagline">{t.hero.tagline}</span>
          <h1>{t.hero.title}</h1>
          <p>{t.hero.subtitle}</p>
          <div className="hero-buttons">
            <a href="#" className="btn btn-primary" title={t.hero.comingSoon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
              </svg>
              <span>{t.hero.downloadIOS}</span>
            </a>
            <a href="#" className="btn btn-secondary" title={t.hero.comingSoon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z"/>
              </svg>
              <span>{t.hero.downloadAndroid}</span>
            </a>
          </div>
          <p className="hero-coming-soon">{t.hero.comingSoon}</p>
        </div>
        <div className="hero-image">
          <div className="hero-mockup">
            <Image
              src="/images/onboarding_1.png"
              alt="Etudesk App"
              width={280}
              height={560}
              style={{ objectFit: 'contain' }}
              priority
            />
          </div>
        </div>
      </section>

      {/* Pillars Section */}
      <section className="pillars">
        <h2>{t.pillars.title}</h2>
        <p className="pillars-subtitle">{t.pillars.subtitle}</p>
        <div className="pillars-grid">
          {t.pillars.items.map((pillar, index) => (
            <div key={index} className="pillar-card">
              <div className="pillar-image">
                <Image
                  src={pillar.image}
                  alt={pillar.title}
                  width={200}
                  height={200}
                  style={{ objectFit: 'contain' }}
                />
              </div>
              <h3>{pillar.title}</h3>
              <p>{pillar.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Talents Section */}
      <section id="talents" className="audience-section talents-section">
        <div className="audience-content">
          <span className="audience-badge">{t.talents.badge}</span>
          <h2>{t.talents.title}</h2>
          <p className="audience-subtitle">{t.talents.subtitle}</p>
          <div className="features-list">
            {t.talents.features.map((feature, index) => (
              <div key={index} className="feature-item">
                <div className="feature-number">{index + 1}</div>
                <div className="feature-text">
                  <h4>{feature.title}</h4>
                  <p>{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="audience-image">
          <Image
            src="/images/onboarding_2.png"
            alt="Talents"
            width={300}
            height={600}
            style={{ objectFit: 'contain' }}
          />
        </div>
      </section>

      {/* Organizations Section */}
      <section id="organizations" className="audience-section orgs-section">
        <div className="audience-image">
          <Image
            src="/images/onboarding_3.png"
            alt="Organizations"
            width={300}
            height={600}
            style={{ objectFit: 'contain' }}
          />
        </div>
        <div className="audience-content">
          <span className="audience-badge">{t.orgs.badge}</span>
          <h2>{t.orgs.title}</h2>
          <p className="audience-subtitle">{t.orgs.subtitle}</p>
          <div className="features-list">
            {t.orgs.features.map((feature, index) => (
              <div key={index} className="feature-item">
                <div className="feature-number">{index + 1}</div>
                <div className="feature-text">
                  <h4>{feature.title}</h4>
                  <p>{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Copilot Section */}
      <section className="copilot-section">
        <span className="audience-badge">{t.copilot.badge}</span>
        <h2>{t.copilot.title}</h2>
        <p className="copilot-subtitle">{t.copilot.subtitle}</p>
        <div className="copilot-grid">
          {t.copilot.features.map((feature, index) => (
            <div key={index} className="copilot-card">
              <span className="copilot-icon">{feature.icon}</span>
              <h4>{feature.title}</h4>
              <p>{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="pricing">
        <h2>{t.pricing.title}</h2>
        <p className="pricing-subtitle">{t.pricing.subtitle}</p>
        <div className="pricing-grid">
          {t.pricing.plans.map((plan, index) => (
            <div key={index} className={`pricing-card ${plan.popular ? 'popular' : ''}`}>
              {plan.popular && <span className="popular-badge">{t.pricing.popular}</span>}
              <h3>{plan.name}</h3>
              <p className="pricing-target">{plan.target}</p>
              <div className="pricing-price">
                <span className="price">{plan.price}</span>
                {plan.price !== 'Gratuit' && plan.price !== 'Free' && plan.price !== 'Sur mesure' && plan.price !== 'Custom' && (
                  <span className="period">{t.pricing.monthly}</span>
                )}
              </div>
              <p className="pricing-description">{plan.description}</p>
              <ul className="pricing-features">
                {plan.features.map((feature, fIndex) => (
                  <li key={fIndex}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--success)">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
              {plan.name === 'Corporate' && (
                <a
                  href="mailto:hello@etudesk.org"
                  className="btn btn-outline"
                >
                  {t.pricing.contactUs}
                </a>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <h2>{t.cta.title}</h2>
        <p>{t.cta.subtitle}</p>
        <div className="cta-buttons">
          <a href="#" className="btn btn-primary btn-large">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>
            {t.cta.button}
          </a>
          <a href="#" className="btn btn-secondary btn-large">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z"/>
            </svg>
            {t.cta.button}
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="footer">
        <div className="footer-container">
          <div className="footer-brand">
            <Image src="/images/etudesk_logo_white.png" alt="Etudesk" width={120} height={35} style={{ objectFit: 'contain' }} />
            <p>{t.footer.description}</p>
            <div className="footer-social">
              <a href="https://www.facebook.com/etudesk" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95z"/></svg>
              </a>
              <a href="https://www.linkedin.com/company/etudesk" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/></svg>
              </a>
              <a href="https://x.com/etudesk" target="_blank" rel="noopener noreferrer" aria-label="X">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </a>
              <a href="https://www.instagram.com/etudesk" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2m-.2 2A3.6 3.6 0 0 0 4 7.6v8.8C4 18.39 5.61 20 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6C20 5.61 18.39 4 16.4 4H7.6m9.65 1.5a1.25 1.25 0 0 1 1.25 1.25A1.25 1.25 0 0 1 17.25 8 1.25 1.25 0 0 1 16 6.75a1.25 1.25 0 0 1 1.25-1.25M12 7a5 5 0 0 1 5 5 5 5 0 0 1-5 5 5 5 0 0 1-5-5 5 5 0 0 1 5-5m0 2a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3z"/></svg>
              </a>
              <a href="https://www.youtube.com/@etudesk" target="_blank" rel="noopener noreferrer" aria-label="YouTube">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M10 15l5.19-3L10 9v6m11.56-7.83c.13.47.22 1.1.28 1.9.07.8.1 1.49.1 2.09L22 12c0 2.19-.16 3.8-.44 4.83-.25.9-.83 1.48-1.73 1.73-.47.13-1.33.22-2.65.28-1.3.07-2.49.1-3.59.1L12 19c-4.19 0-6.8-.16-7.83-.44-.9-.25-1.48-.83-1.73-1.73-.13-.47-.22-1.1-.28-1.9-.07-.8-.1-1.49-.1-2.09L2 12c0-2.19.16-3.8.44-4.83.25-.9.83-1.48 1.73-1.73.47-.13 1.33-.22 2.65-.28 1.3-.07 2.49-.1 3.59-.1L12 5c4.19 0 6.8.16 7.83.44.9.25 1.48.83 1.73 1.73z"/></svg>
              </a>
              <a href="https://www.tiktok.com/@etudesk" target="_blank" rel="noopener noreferrer" aria-label="TikTok">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M16.6 5.82s.51.5 0 0A4.278 4.278 0 0 1 15.54 3h-3.09v12.4a2.592 2.592 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3s-1.88.09-3.24-1.48z"/></svg>
              </a>
            </div>
          </div>
          <div className="footer-links">
            <div className="footer-column">
              <h4>{t.footer.product}</h4>
              <a href="#talents">{t.nav.talents}</a>
              <a href="#organizations">{t.nav.organizations}</a>
              <a href="#pricing">{t.nav.pricing}</a>
            </div>
            <div className="footer-column">
              <h4>{t.footer.legal}</h4>
              <a href="/terms">{t.footer.terms}</a>
              <a href="/privacy">{t.footer.privacy}</a>
            </div>
            <div className="footer-column">
              <h4>{t.footer.contact}</h4>
              <a href="mailto:hello@etudesk.org">hello@etudesk.org</a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; {new Date().getFullYear()} Etudesk. {t.footer.rights}</p>
        </div>
      </footer>

      <style jsx>{`
        .landing {
          min-height: 100vh;
        }

        /* Utility classes */
        .desktop-only {
          display: flex;
        }

        .mobile-only {
          display: none;
        }

        /* Navigation */
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
          max-width: 1200px;
          margin: 0 auto;
          padding: 0.75rem 1.5rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .nav-links {
          display: flex;
          gap: 2rem;
        }

        .nav-links a {
          color: var(--text-secondary);
          font-weight: 500;
          transition: color 0.2s;
          padding: 0.5rem;
        }

        .nav-links a:hover {
          color: var(--primary);
          text-decoration: none;
        }

        .nav-right {
          display: flex;
          align-items: center;
          gap: 0.75rem;
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
          color: var(--text-on-primary);
          border-color: var(--primary);
        }

        .mobile-menu-btn {
          display: none;
          padding: 0.5rem;
          border: none;
          background: transparent;
          cursor: pointer;
          color: var(--text-primary);
          min-width: 44px;
          min-height: 44px;
          align-items: center;
          justify-content: center;
        }

        .mobile-menu {
          display: none;
          flex-direction: column;
          padding: 1rem 1.5rem 1.5rem;
          border-top: 1px solid var(--border-color);
          background: var(--surface);
        }

        .mobile-menu a {
          padding: 1rem;
          color: var(--text-primary);
          font-weight: 500;
          border-bottom: 1px solid var(--border-color);
        }

        .mobile-menu a:last-child {
          border-bottom: none;
        }

        .mobile-menu a:hover {
          color: var(--primary);
          text-decoration: none;
        }

        /* Hero */
        .hero {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 7rem 1.5rem 3rem;
          max-width: 1200px;
          margin: 0 auto;
          gap: 3rem;
        }

        .hero-content {
          flex: 1;
          max-width: 550px;
        }

        .hero-tagline {
          display: inline-block;
          background: var(--primary-light);
          color: var(--primary);
          padding: 0.5rem 1rem;
          border-radius: 100px;
          font-size: 0.875rem;
          font-weight: 600;
          margin-bottom: 1.5rem;
        }

        .hero-content h1 {
          font-size: 2.75rem;
          font-weight: 700;
          line-height: 1.15;
          margin-bottom: 1.25rem;
          color: var(--text-primary);
        }

        .hero-content p {
          font-size: 1.125rem;
          color: var(--text-secondary);
          margin-bottom: 1.5rem;
          line-height: 1.6;
        }

        .hero-buttons {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .hero-coming-soon {
          font-size: 0.875rem;
          color: var(--text-disabled);
          margin-top: 1rem;
          font-style: italic;
        }

        .hero-image {
          flex: 1;
          display: flex;
          justify-content: center;
          align-items: center;
          max-width: 350px;
        }

        .hero-mockup {
          border-radius: 32px;
          overflow: hidden;
          box-shadow: var(--shadow-lg);
        }

        /* Buttons */
        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.875rem 1.25rem;
          border-radius: 10px;
          font-weight: 600;
          font-size: 0.9375rem;
          transition: all 0.2s;
          text-decoration: none;
          cursor: pointer;
          border: none;
          min-height: 48px;
        }

        .btn-large {
          padding: 1rem 2rem;
          font-size: 1rem;
        }

        .btn-primary {
          background: var(--primary);
          color: var(--text-on-primary);
        }

        .btn-primary:hover {
          background: var(--primary-dark);
          text-decoration: none;
        }

        .btn-secondary {
          background: var(--gray-100);
          color: var(--text-primary);
        }

        .btn-secondary:hover {
          background: var(--gray-200);
          text-decoration: none;
        }

        .btn-outline {
          background: transparent;
          border: 2px solid var(--border-color);
          color: var(--text-primary);
        }

        .btn-outline:hover {
          border-color: var(--primary);
          color: var(--primary);
          text-decoration: none;
        }

        /* Pillars */
        .pillars {
          padding: 5rem 1.5rem;
          background: var(--background-secondary);
          text-align: center;
        }

        .pillars h2 {
          font-size: 2.25rem;
          margin-bottom: 0.5rem;
        }

        .pillars-subtitle {
          color: var(--text-secondary);
          font-size: 1.125rem;
          margin-bottom: 3rem;
        }

        .pillars-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1.5rem;
          max-width: 1200px;
          margin: 0 auto;
        }

        .pillar-card {
          background: var(--surface);
          padding: 2rem 1.5rem;
          border-radius: var(--radius-lg);
          text-align: center;
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .pillar-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-md);
        }

        .pillar-image {
          width: 120px;
          height: 120px;
          margin: 0 auto 1.25rem;
          border-radius: var(--radius-md);
          overflow: hidden;
          background: var(--gray-50);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .pillar-card h3 {
          font-size: 1.125rem;
          margin-bottom: 0.75rem;
          color: var(--text-primary);
        }

        .pillar-card p {
          color: var(--text-secondary);
          font-size: 0.9375rem;
          line-height: 1.5;
        }

        /* Audience Sections */
        .audience-section {
          padding: 5rem 1.5rem;
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          gap: 4rem;
        }

        .audience-content {
          flex: 1;
        }

        .audience-badge {
          display: inline-block;
          background: var(--success-light);
          color: var(--success);
          padding: 0.375rem 0.875rem;
          border-radius: 100px;
          font-size: 0.8125rem;
          font-weight: 600;
          margin-bottom: 1rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .orgs-section .audience-badge {
          background: var(--primary-light);
          color: var(--primary);
        }

        .audience-section h2 {
          font-size: 2rem;
          line-height: 1.2;
          margin-bottom: 1rem;
          white-space: pre-line;
        }

        .audience-subtitle {
          color: var(--text-secondary);
          font-size: 1.125rem;
          margin-bottom: 2rem;
          line-height: 1.5;
        }

        .audience-image {
          flex-shrink: 0;
        }

        .features-list {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .feature-item {
          display: flex;
          gap: 1rem;
          align-items: flex-start;
        }

        .feature-number {
          width: 32px;
          height: 32px;
          background: var(--primary);
          color: var(--text-on-primary);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 0.875rem;
          flex-shrink: 0;
        }

        .orgs-section .feature-number {
          background: var(--success);
        }

        .feature-text h4 {
          font-size: 1rem;
          margin-bottom: 0.25rem;
          color: var(--text-primary);
        }

        .feature-text p {
          color: var(--text-secondary);
          font-size: 0.9375rem;
          line-height: 1.5;
        }

        /* Copilot Section */
        .copilot-section {
          padding: 5rem 1.5rem;
          background: var(--gray-900);
          color: white;
          text-align: center;
        }

        .copilot-section .audience-badge {
          background: rgba(255, 255, 255, 0.1);
          color: white;
        }

        .copilot-section h2 {
          font-size: 2.25rem;
          margin-bottom: 0.5rem;
        }

        .copilot-subtitle {
          color: var(--gray-400);
          font-size: 1.125rem;
          margin-bottom: 3rem;
          max-width: 600px;
          margin-left: auto;
          margin-right: auto;
        }

        .copilot-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1.5rem;
          max-width: 1200px;
          margin: 0 auto;
        }

        .copilot-card {
          background: rgba(255, 255, 255, 0.05);
          padding: 2rem 1.5rem;
          border-radius: var(--radius-lg);
          text-align: left;
          border: 1px solid rgba(255, 255, 255, 0.1);
          transition: background 0.2s;
        }

        .copilot-card:hover {
          background: rgba(255, 255, 255, 0.08);
        }

        .copilot-icon {
          font-size: 2rem;
          display: block;
          margin-bottom: 1rem;
        }

        .copilot-card h4 {
          font-size: 1.125rem;
          margin-bottom: 0.5rem;
          color: white;
        }

        .copilot-card p {
          color: var(--gray-400);
          font-size: 0.9375rem;
          line-height: 1.5;
        }

        /* Pricing */
        .pricing {
          padding: 5rem 1.5rem;
          text-align: center;
        }

        .pricing h2 {
          font-size: 2.25rem;
          margin-bottom: 0.5rem;
        }

        .pricing-subtitle {
          color: var(--text-secondary);
          font-size: 1.125rem;
          margin-bottom: 3rem;
        }

        .pricing-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1.25rem;
          max-width: 1200px;
          margin: 0 auto;
        }

        .pricing-card {
          background: var(--surface);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: 1.75rem 1.5rem;
          text-align: left;
          position: relative;
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .pricing-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-md);
        }

        .pricing-card.popular {
          border-color: var(--primary);
          border-width: 2px;
        }

        .popular-badge {
          position: absolute;
          top: -12px;
          left: 50%;
          transform: translateX(-50%);
          background: var(--primary);
          color: var(--text-on-primary);
          padding: 0.25rem 1rem;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 600;
        }

        .pricing-card h3 {
          font-size: 1.375rem;
          margin-bottom: 0.25rem;
        }

        .pricing-target {
          color: var(--primary);
          font-size: 0.875rem;
          font-weight: 600;
          margin-bottom: 1rem;
        }

        .pricing-price {
          margin-bottom: 0.75rem;
        }

        .pricing-price .price {
          font-size: 1.75rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .pricing-price .period {
          color: var(--text-secondary);
          font-size: 0.9375rem;
        }

        .pricing-description {
          color: var(--text-secondary);
          font-size: 0.875rem;
          line-height: 1.4;
          margin-bottom: 1.25rem;
        }

        .pricing-features {
          list-style: none;
          margin-bottom: 1.25rem;
        }

        .pricing-features li {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          padding: 0.375rem 0;
          font-size: 0.875rem;
          color: var(--text-secondary);
        }

        .pricing-features li svg {
          flex-shrink: 0;
          margin-top: 2px;
        }

        .pricing-card .btn {
          width: 100%;
          justify-content: center;
        }

        /* CTA Section */
        .cta-section {
          padding: 5rem 1.5rem;
          background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
          text-align: center;
          color: white;
        }

        .cta-section h2 {
          font-size: 2.25rem;
          margin-bottom: 0.75rem;
        }

        .cta-section p {
          font-size: 1.125rem;
          opacity: 0.9;
          margin-bottom: 2rem;
          max-width: 500px;
          margin-left: auto;
          margin-right: auto;
        }

        .cta-buttons {
          display: flex;
          gap: 1rem;
          justify-content: center;
          flex-wrap: wrap;
        }

        .cta-section .btn-primary {
          background: white;
          color: var(--primary);
        }

        .cta-section .btn-primary:hover {
          background: var(--gray-100);
        }

        .cta-section .btn-secondary {
          background: rgba(255, 255, 255, 0.15);
          color: white;
          border: 2px solid rgba(255, 255, 255, 0.3);
        }

        .cta-section .btn-secondary:hover {
          background: rgba(255, 255, 255, 0.25);
        }

        /* Footer */
        .footer {
          background: var(--gray-900);
          color: white;
          padding: 3rem 1.5rem 1.5rem;
        }

        .footer-container {
          max-width: 1200px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1.5fr 2.5fr;
          gap: 3rem;
        }

        .footer-brand p {
          color: var(--gray-400);
          margin: 1rem 0;
          font-size: 0.9375rem;
        }

        .footer-social {
          display: flex;
          gap: 0.75rem;
          margin-top: 1.25rem;
          flex-wrap: wrap;
        }

        .footer-social a {
          color: var(--gray-400);
          transition: color 0.2s;
          padding: 0.5rem;
          min-width: 44px;
          min-height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .footer-social a:hover {
          color: white;
        }

        .footer-links {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1.5rem;
        }

        .footer-column h4 {
          font-size: 1rem;
          margin-bottom: 1rem;
          color: white;
        }

        .footer-column a {
          display: block;
          color: var(--gray-400);
          padding: 0.375rem 0;
          font-size: 0.9375rem;
          transition: color 0.2s;
        }

        .footer-column a:hover {
          color: white;
          text-decoration: none;
        }

        .footer-bottom {
          max-width: 1200px;
          margin: 2.5rem auto 0;
          padding-top: 1.5rem;
          border-top: 1px solid var(--gray-700);
          text-align: center;
          color: var(--gray-500);
          font-size: 0.875rem;
        }

        /* Tablet (768px - 1024px) */
        @media (max-width: 1024px) {
          .pillars-grid,
          .copilot-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .pricing-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .hero-content h1 {
            font-size: 2.25rem;
          }

          .audience-section {
            flex-direction: column;
            text-align: center;
          }

          .orgs-section {
            flex-direction: column-reverse;
          }

          .audience-image {
            max-width: 250px;
          }

          .features-list {
            text-align: left;
          }

          .copilot-card {
            text-align: center;
          }
        }

        /* Mobile (max-width: 768px) */
        @media (max-width: 768px) {
          .desktop-only {
            display: none !important;
          }

          .mobile-only {
            display: flex !important;
          }

          .mobile-menu {
            display: flex;
          }

          .nav-container {
            padding: 0.5rem 1rem;
          }

          .hero {
            flex-direction: column;
            text-align: center;
            padding: 6rem 1rem 2rem;
            min-height: auto;
            gap: 2rem;
          }

          .hero-content {
            max-width: 100%;
          }

          .hero-content h1 {
            font-size: 1.875rem;
          }

          .hero-content p {
            font-size: 1rem;
          }

          .hero-buttons {
            justify-content: center;
            flex-direction: column;
            align-items: center;
          }

          .hero-buttons .btn {
            width: 100%;
            max-width: 280px;
          }

          .hero-image {
            max-width: 240px;
          }

          .pillars,
          .pricing,
          .copilot-section {
            padding: 3rem 1rem;
          }

          .pillars h2,
          .pricing h2,
          .copilot-section h2,
          .audience-section h2 {
            font-size: 1.75rem;
          }

          .pillars-grid,
          .copilot-grid {
            grid-template-columns: 1fr;
            gap: 1rem;
          }

          .pricing-grid {
            grid-template-columns: 1fr;
            gap: 1rem;
          }

          .audience-section {
            padding: 3rem 1rem;
            gap: 2rem;
          }

          .cta-section {
            padding: 3rem 1rem;
          }

          .cta-section h2 {
            font-size: 1.75rem;
          }

          .cta-buttons {
            flex-direction: column;
            align-items: center;
          }

          .cta-buttons .btn {
            width: 100%;
            max-width: 280px;
          }

          .footer {
            padding: 2.5rem 1rem 1rem;
          }

          .footer-container {
            grid-template-columns: 1fr;
            gap: 2rem;
          }

          .footer-links {
            grid-template-columns: 1fr;
            gap: 1.5rem;
          }

          .footer-bottom {
            margin-top: 2rem;
            padding-top: 1.25rem;
          }
        }

        /* Small phones (max-width: 480px) */
        @media (max-width: 480px) {
          .nav-lang button {
            padding: 0.375rem 0.5rem;
            font-size: 0.8125rem;
            min-width: 40px;
          }

          .hero-content h1 {
            font-size: 1.5rem;
          }

          .hero-content p {
            font-size: 0.9375rem;
          }

          .btn {
            padding: 0.75rem 1rem;
            font-size: 0.875rem;
          }

          .pillars h2,
          .pricing h2,
          .copilot-section h2,
          .audience-section h2 {
            font-size: 1.5rem;
          }

          .pillar-card h3,
          .copilot-card h4 {
            font-size: 1rem;
          }

          .pillar-card p,
          .copilot-card p {
            font-size: 0.875rem;
          }

          .pricing-card h3 {
            font-size: 1.25rem;
          }

          .pricing-price .price {
            font-size: 1.5rem;
          }

          .footer-social {
            gap: 0.5rem;
          }

          .footer-social a {
            padding: 0.375rem;
            min-width: 40px;
            min-height: 40px;
          }
        }

        /* ═══════════════════════════════════════════════════════════════
           DARK MODE OVERRIDES
           Fix contrast issues for sections that use inverted colors
           ═══════════════════════════════════════════════════════════════ */

        [data-theme="dark"] .copilot-section {
          background: var(--surface);
          color: var(--text-primary);
        }

        [data-theme="dark"] .copilot-section .audience-badge {
          background: rgba(201, 160, 112, 0.15);
          color: var(--primary);
        }

        [data-theme="dark"] .copilot-subtitle {
          color: var(--text-secondary);
        }

        [data-theme="dark"] .copilot-card {
          background: var(--surface-elevated);
          border-color: var(--border-color);
        }

        [data-theme="dark"] .copilot-card h4 {
          color: var(--text-primary);
        }

        [data-theme="dark"] .copilot-card p {
          color: var(--text-secondary);
        }

        [data-theme="dark"] .footer {
          background: var(--surface);
          color: var(--text-primary);
        }

        [data-theme="dark"] .footer-column h4 {
          color: var(--text-primary);
        }

        [data-theme="dark"] .footer-brand p,
        [data-theme="dark"] .footer-column a,
        [data-theme="dark"] .footer-social a {
          color: var(--text-secondary);
        }

        [data-theme="dark"] .footer-social a:hover,
        [data-theme="dark"] .footer-column a:hover {
          color: var(--primary);
        }

        [data-theme="dark"] .footer-bottom {
          color: var(--text-tertiary);
          border-top-color: var(--border-color);
        }

        /* CTA Section in dark mode - use surface with primary accent */
        [data-theme="dark"] .cta-section {
          background: linear-gradient(135deg, var(--surface) 0%, var(--background) 100%);
          border-top: 1px solid var(--border-color);
          border-bottom: 1px solid var(--border-color);
        }

        [data-theme="dark"] .cta-section h2 {
          color: var(--text-primary);
        }

        [data-theme="dark"] .cta-section p {
          color: var(--text-secondary);
          opacity: 1;
        }

        [data-theme="dark"] .cta-section .btn-primary {
          background: var(--primary);
          color: var(--text-on-primary);
        }

        [data-theme="dark"] .cta-section .btn-primary:hover {
          background: var(--primary-light);
        }

        [data-theme="dark"] .cta-section .btn-secondary {
          background: transparent;
          color: var(--primary);
          border: 2px solid var(--primary);
        }

        [data-theme="dark"] .cta-section .btn-secondary:hover {
          background: rgba(201, 160, 112, 0.1);
        }

        /* Fix orgs section badge contrast in dark mode */
        [data-theme="dark"] .orgs-section .audience-badge {
          background: rgba(201, 160, 112, 0.15);
          color: var(--primary);
        }

        /* Fix popular badge in dark mode */
        [data-theme="dark"] .popular-badge {
          background: var(--primary);
          color: var(--text-on-primary);
        }

        /* Fix navigation in dark mode */
        [data-theme="dark"] .nav {
          background: rgba(13, 11, 10, 0.95);
        }

        [data-theme="dark"] .mobile-menu {
          background: var(--surface);
        }

        /* Fix orgs section feature number for dark mode (uses success color) */
        [data-theme="dark"] .orgs-section .feature-number {
          color: var(--text-inverse);
        }
      `}</style>
    </main>
  );
}
