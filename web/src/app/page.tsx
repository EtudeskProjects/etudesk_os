'use client';

import React, { useState, useContext } from 'react';
import Image from 'next/image';
import { ThemeContext } from '../contexts/ThemeContext';

const translations = {
  fr: {
    tagline: 'Opportunités  /  Communautés  /  Espaces',
    badge: 'Disponible sur iOS et Android',
    title: 'Ton talent mérite\nune plateforme à sa hauteur',
    subtitle:
      'Etudesk connecte les talents aux opportunités, communautés et espaces de travail en Afrique de l\'Ouest. Un assistant intelligent t\'accompagne au quotidien.',
    demoEyebrow: 'Démo complète',
    demoTitle: 'Découvre Etudesk en action',
    demoSubtitle: 'Une visite guidée claire de l\'expérience talent, du copilote IA et des parcours d\'usage dans l\'app.',
    downloadIOS: 'App Store',
    downloadAndroid: 'Google Play',
    getOnAppStore: 'Télécharger sur',
    getOnPlayStore: 'Disponible sur',
    featuresTitle: 'Tout ce qu\'il te faut, au même endroit',
    feature1Title: 'Opportunités sur mesure',
    feature1Desc: 'Stages, emplois, projets — trouvés par ton assistant personnel qui comprend ton profil, tes compétences et tes ambitions.',
    feature2Title: 'Espaces de travail partagés',
    feature2Desc: 'Collabore avec d\'autres talents, partage des ressources et travaille dans des espaces dédiés à ta productivité.',
    feature3Title: 'Communautés actives',
    feature3Desc: 'Rejoins des communautés de professionnels, échange, participe à des événements et développe ton réseau.',
    howTitle: 'Comment ça marche',
    howTalent: 'Talent',
    howOrg: 'Organisation',
    talentStep1Title: 'Crée ton profil',
    talentStep1Desc: 'Inscris-toi en 2 minutes. Renseigne tes compétences, ton parcours et ce que tu recherches.',
    talentStep2Title: 'Explore et connecte-toi',
    talentStep2Desc: 'Découvre des opportunités, rejoins des communautés et accède à des espaces de travail adaptés.',
    talentStep3Title: 'Avance avec ton assistant',
    talentStep3Desc: 'Ton assistant t\'aide à postuler, préparer tes entretiens et suivre ta progression au quotidien.',
    orgStep1Title: 'Créez votre espace',
    orgStep1Desc: 'Inscrivez votre organisation en quelques clics. Ajoutez votre équipe et configurez votre profil.',
    orgStep2Title: 'Publiez et recrutez',
    orgStep2Desc: 'Publiez des opportunités, créez des communautés et trouvez les talents qui correspondent à vos besoins.',
    orgStep3Title: 'Pilotez avec votre assistant',
    orgStep3Desc: 'Votre assistant vous aide à trier les candidatures, gérer vos événements et animer vos communautés.',
    ctaTitle: 'Prêt à commencer ?',
    ctaSubtitle: 'Télécharge l\'application et rejoins la communauté.',
    followUs: 'Suivez-nous',
    terms: 'Conditions d\'utilisation',
    privacy: 'Politique de confidentialité',
    legalNotice: 'Mentions légales',
    rights: 'Tous droits réservés.',
  },
  en: {
    tagline: 'Opportunities  /  Communities  /  Spaces',
    badge: 'Available on iOS and Android',
    title: 'Your talent deserves\na platform that matches it',
    subtitle:
      'Etudesk connects talents to opportunities, communities and workspaces across West Africa. A smart assistant supports you every step of the way.',
    demoEyebrow: 'Full demo',
    demoTitle: 'See Etudesk in action',
    demoSubtitle: 'A clear guided walkthrough of the talent experience, the AI copilot, and the main flows inside the app.',
    downloadIOS: 'App Store',
    downloadAndroid: 'Google Play',
    getOnAppStore: 'Download on',
    getOnPlayStore: 'Get it on',
    featuresTitle: 'Everything you need, in one place',
    feature1Title: 'Tailored opportunities',
    feature1Desc: 'Internships, jobs, projects — found by your personal assistant that understands your profile, skills and ambitions.',
    feature2Title: 'Shared workspaces',
    feature2Desc: 'Collaborate with other talents, share resources and work in spaces designed for your productivity.',
    feature3Title: 'Active communities',
    feature3Desc: 'Join professional communities, exchange ideas, attend events and grow your network.',
    howTitle: 'How it works',
    howTalent: 'Talent',
    howOrg: 'Organization',
    talentStep1Title: 'Create your profile',
    talentStep1Desc: 'Sign up in 2 minutes. Add your skills, background and what you\'re looking for.',
    talentStep2Title: 'Explore and connect',
    talentStep2Desc: 'Discover opportunities, join communities and access workspaces tailored to you.',
    talentStep3Title: 'Move forward with your assistant',
    talentStep3Desc: 'Your assistant helps you apply, prepare interviews and track your daily progress.',
    orgStep1Title: 'Set up your workspace',
    orgStep1Desc: 'Register your organization in a few clicks. Add your team and configure your profile.',
    orgStep2Title: 'Publish and recruit',
    orgStep2Desc: 'Post opportunities, create communities and find the talents that match your needs.',
    orgStep3Title: 'Manage with your assistant',
    orgStep3Desc: 'Your assistant helps you sort applications, manage events and engage your communities.',
    ctaTitle: 'Ready to start?',
    ctaSubtitle: 'Download the app and join the community.',
    followUs: 'Follow us',
    terms: 'Terms of Service',
    privacy: 'Privacy Policy',
    legalNotice: 'Legal Notice',
    rights: 'All rights reserved.',
  },
};

type Lang = 'fr' | 'en';

const IOS_URL = 'https://etudesk.com/link/ios';
const ANDROID_URL = 'https://etudesk.com/link/android';

const AppleIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
);
const PlayIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z"/></svg>
);

export default function Home() {
  const [lang, setLang] = useState<Lang>('fr');
  const [howTab, setHowTab] = useState<'talent' | 'org'>('talent');
  const { isDark, toggleTheme } = useContext(ThemeContext);
  const t = translations[lang];

  const features = [
    { title: t.feature1Title, desc: t.feature1Desc, img: '/images/explore_opportunities.jpg', alt: 'Opportunites professionnelles' },
    { title: t.feature2Title, desc: t.feature2Desc, img: '/images/explore_spaces.jpg', alt: 'Espaces de travail' },
    { title: t.feature3Title, desc: t.feature3Desc, img: '/images/explore_communities.jpg', alt: 'Communautes actives' },
  ];

  return (
    <main className="landing">
      {/* ─── Nav ─── */}
      <nav className="top-bar">
        <div className="top-bar-inner">
          <div className="logo">
            <Image
              src={isDark ? '/images/etudesk_logo_white.png' : '/images/etudesk_logo_black.png'}
              alt="Etudesk"
              width={130}
              height={38}
              style={{ objectFit: 'contain' }}
              priority
            />
          </div>
          <div className="top-bar-right">
            <button className="theme-toggle" onClick={toggleTheme} aria-label={isDark ? 'Light mode' : 'Dark mode'}>
              {isDark ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              )}
            </button>
            <div className="lang-toggle">
              <button className={lang === 'fr' ? 'active' : ''} onClick={() => setLang('fr')}>FR</button>
              <button className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>EN</button>
            </div>
          </div>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="hero">
        <video className="hero-video" autoPlay muted loop playsInline>
          <source src="/images/hero-bg.mp4" type="video/mp4" />
        </video>
        <div className="hero-overlay" />
        <h1>{t.title}</h1>
        <p className="subtitle">{t.subtitle}</p>
        <div className="store-buttons">
          <a href={IOS_URL} target="_blank" rel="noopener noreferrer" className="store-btn">
            <AppleIcon />
            <div className="store-btn-text">
              <span className="store-btn-small">{t.getOnAppStore}</span>
              <span className="store-btn-name">{t.downloadIOS}</span>
            </div>
          </a>
          <a href={ANDROID_URL} target="_blank" rel="noopener noreferrer" className="store-btn">
            <PlayIcon />
            <div className="store-btn-text">
              <span className="store-btn-small">{t.getOnPlayStore}</span>
              <span className="store-btn-name">{t.downloadAndroid}</span>
            </div>
          </a>
        </div>
      </section>

      <section className="demo-section">
        <div className="demo-copy">
          <span className="demo-eyebrow">{t.demoEyebrow}</span>
          <h2 className="section-title demo-title">{t.demoTitle}</h2>
          <p className="demo-subtitle">{t.demoSubtitle}</p>
        </div>
        <div className="demo-shell">
          <div className="demo-frame">
            <iframe
              src="https://www.youtube.com/embed/fsTFYSxsTJM?rel=0"
              title="Etudesk full demo"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section className="features">
        <h2 className="section-title">{t.featuresTitle}</h2>
        <div className="features-grid">
          {features.map((f, i) => (
            <div key={i} className="feature-card">
              <div className="feature-img-wrap">
                <Image
                  src={f.img}
                  alt={f.alt}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  style={{ objectFit: 'cover' }}
                />
              </div>
              <div className="feature-text">
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── How it works ─── */}
      <section className="how-section">
        <h2 className="section-title">{t.howTitle}</h2>
        <div className="how-toggle">
          <button className={howTab === 'talent' ? 'active' : ''} onClick={() => setHowTab('talent')}>{t.howTalent}</button>
          <button className={howTab === 'org' ? 'active' : ''} onClick={() => setHowTab('org')}>{t.howOrg}</button>
        </div>
        <div className="steps-grid">
          {(howTab === 'talent' ? [
            { num: '1', title: t.talentStep1Title, desc: t.talentStep1Desc },
            { num: '2', title: t.talentStep2Title, desc: t.talentStep2Desc },
            { num: '3', title: t.talentStep3Title, desc: t.talentStep3Desc },
          ] : [
            { num: '1', title: t.orgStep1Title, desc: t.orgStep1Desc },
            { num: '2', title: t.orgStep2Title, desc: t.orgStep2Desc },
            { num: '3', title: t.orgStep3Title, desc: t.orgStep3Desc },
          ]).map((step, i) => (
            <div key={`${howTab}-${i}`} className="step-card">
              <span className="step-num">{step.num}</span>
              <h3 className="step-title">{step.title}</h3>
              <p className="step-desc">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="cta-section">
        <h2 className="section-title">{t.ctaTitle}</h2>
        <p className="cta-subtitle">{t.ctaSubtitle}</p>
        <div className="store-buttons">
          <a href={IOS_URL} target="_blank" rel="noopener noreferrer" className="store-btn store-btn-lg">
            <AppleIcon size={24} />
            <div className="store-btn-text">
              <span className="store-btn-small">{t.getOnAppStore}</span>
              <span className="store-btn-name">{t.downloadIOS}</span>
            </div>
          </a>
          <a href={ANDROID_URL} target="_blank" rel="noopener noreferrer" className="store-btn store-btn-lg">
            <PlayIcon size={24} />
            <div className="store-btn-text">
              <span className="store-btn-small">{t.getOnPlayStore}</span>
              <span className="store-btn-name">{t.downloadAndroid}</span>
            </div>
          </a>
        </div>
      </section>

      {/* ─── Social ─── */}
      <section className="social-section">
        <p className="social-label">{t.followUs}</p>
        <div className="social-links">
          <a href="https://www.facebook.com/etudesk" target="_blank" rel="noopener noreferrer" aria-label="Facebook"><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95z"/></svg></a>
          <a href="https://www.linkedin.com/company/etudesk" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn"><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/></svg></a>
          <a href="https://x.com/etudesk" target="_blank" rel="noopener noreferrer" aria-label="X"><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg></a>
          <a href="https://www.instagram.com/etudesk" target="_blank" rel="noopener noreferrer" aria-label="Instagram"><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2m-.2 2A3.6 3.6 0 0 0 4 7.6v8.8C4 18.39 5.61 20 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6C20 5.61 18.39 4 16.4 4H7.6m9.65 1.5a1.25 1.25 0 0 1 1.25 1.25A1.25 1.25 0 0 1 17.25 8 1.25 1.25 0 0 1 16 6.75a1.25 1.25 0 0 1 1.25-1.25M12 7a5 5 0 0 1 5 5 5 5 0 0 1-5 5 5 5 0 0 1-5-5 5 5 0 0 1 5-5m0 2a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3z"/></svg></a>
          <a href="https://www.youtube.com/@etudesk" target="_blank" rel="noopener noreferrer" aria-label="YouTube"><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M10 15l5.19-3L10 9v6m11.56-7.83c.13.47.22 1.1.28 1.9.07.8.1 1.49.1 2.09L22 12c0 2.19-.16 3.8-.44 4.83-.25.9-.83 1.48-1.73 1.73-.47.13-1.33.22-2.65.28-1.3.07-2.49.1-3.59.1L12 19c-4.19 0-6.8-.16-7.83-.44-.9-.25-1.48-.83-1.73-1.73-.13-.47-.22-1.1-.28-1.9-.07-.8-.1-1.49-.1-2.09L2 12c0-2.19.16-3.8.44-4.83.25-.9.83-1.48 1.73-1.73.47-.13 1.33-.22 2.65-.28 1.3-.07 2.49-.1 3.59-.1L12 5c4.19 0 6.8.16 7.83.44.9.25 1.48.83 1.73 1.73z"/></svg></a>
          <a href="https://www.tiktok.com/@etudesk" target="_blank" rel="noopener noreferrer" aria-label="TikTok"><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M16.6 5.82s.51.5 0 0A4.278 4.278 0 0 1 15.54 3h-3.09v12.4a2.592 2.592 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3s-1.88.09-3.24-1.48z"/></svg></a>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="footer">
        <div className="footer-links">
          <a href="/terms">{t.terms}</a>
          <span className="footer-dot" aria-hidden="true"/>
          <a href="/privacy">{t.privacy}</a>
          <span className="footer-dot" aria-hidden="true"/>
          <a href="/mentions-legales">{t.legalNotice}</a>
        </div>
        <p className="footer-copy">&copy; {new Date().getFullYear()} Etudesk. {t.rights}</p>
      </footer>

      <style jsx>{`
        .landing {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        /* ── Nav ── */
        .top-bar {
          width: 100%;
          position: sticky;
          top: 0;
          z-index: var(--z-sticky);
          background: var(--background);
          border-bottom: 1px solid var(--border-color);
        }
        .top-bar-inner {
          max-width: var(--max-width-content);
          margin: 0 auto;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 1.5rem;
        }
        .top-bar-right {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .theme-toggle {
          background: none;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-sm);
          color: var(--text-secondary);
          cursor: pointer;
          padding: 0.5rem;
          display: flex;
          align-items: center;
          transition: all var(--transition-fast);
        }
        .theme-toggle:hover { color: var(--primary); border-color: var(--primary); }
        .lang-toggle {
          display: flex;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-sm);
          overflow: hidden;
        }
        .lang-toggle button {
          background: none; border: none;
          padding: 0.5rem 0.75rem;
          font-family: var(--font-family);
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-medium);
          color: var(--text-tertiary);
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        .lang-toggle button.active { background: var(--primary); color: var(--text-on-primary); }
        .lang-toggle button:not(.active):hover { color: var(--text-primary); background: var(--hover); }

        /* ── Hero ── */
        .hero {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 6rem 1.5rem 5rem;
          width: 100%;
          gap: 1rem;
          overflow: hidden;
        }
        .hero-video {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          z-index: 0;
        }
        .hero-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.55);
          z-index: 1;
        }
        .hero > :not(.hero-video):not(.hero-overlay) {
          position: relative;
          z-index: 2;
          max-width: 700px;
        }
        .tagline {
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-semibold);
          color: rgba(255, 255, 255, 0.7);
          letter-spacing: var(--letter-spacing-wide);
          text-transform: uppercase;
        }
        .badge {
          display: inline-block;
          padding: 0.375rem 1rem;
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-semibold);
          letter-spacing: var(--letter-spacing-wide);
          text-transform: uppercase;
          color: #a8e6a3;
          background: rgba(74, 103, 65, 0.3);
          border-radius: var(--radius-full);
        }
        h1 {
          font-size: var(--font-size-display-lg);
          font-weight: var(--font-weight-bold);
          line-height: var(--line-height-tight);
          letter-spacing: var(--letter-spacing-tight);
          color: #FFFFFF;
          white-space: pre-line;
          margin: 0.5rem 0;
        }
        .subtitle {
          font-size: var(--font-size-lg);
          line-height: var(--line-height-relaxed);
          color: rgba(255, 255, 255, 0.8);
          max-width: 560px;
        }

        /* ── Store buttons ── */
        .store-buttons {
          display: flex;
          gap: 0.75rem;
          margin-top: 0.5rem;
          justify-content: center;
        }
        .store-btn {
          display: flex;
          align-items: center;
          gap: 0.625rem;
          padding: 0.75rem 1.5rem;
          background: #FFFFFF;
          color: #1A1A1A;
          border: none;
          border-radius: var(--radius-md);
          text-decoration: none;
          transition: all var(--transition-fast);
        }
        .store-btn:hover { background: #F0F0F0; text-decoration: none; color: #1A1A1A; }
        .cta-section .store-btn {
          background: var(--primary);
          color: var(--text-on-primary);
          border: none;
          backdrop-filter: none;
        }
        .cta-section .store-btn:hover { opacity: 0.9; color: var(--text-on-primary); }
        .store-btn-text { display: flex; flex-direction: column; align-items: flex-start; line-height: 1.2; }
        .store-btn-small { font-size: var(--font-size-xxs); opacity: 0.6; }
        .store-btn-name { font-size: var(--font-size-sm); font-weight: var(--font-weight-bold); }
        .store-btn-lg { padding: 0.75rem 1.75rem; }

        /* ── Section title ── */
        .section-title {
          font-size: var(--font-size-xxl);
          font-weight: var(--font-weight-bold);
          color: var(--text-primary);
          text-align: center;
          margin-bottom: 2.5rem;
        }

        /* ── Demo ── */
        .demo-section {
          width: 100%;
          max-width: var(--max-width-content);
          padding: 3rem 1.5rem 4rem;
        }
        .demo-copy {
          margin: 0 auto 1.5rem;
          max-width: 760px;
          text-align: center;
        }
        .demo-shell {
          width: 100%;
        }
        .demo-eyebrow {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0.35rem 0.85rem;
          border-radius: var(--radius-full);
          background: rgba(47, 74, 191, 0.12);
          color: var(--primary);
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-semibold);
          letter-spacing: var(--letter-spacing-wide);
          text-transform: uppercase;
        }
        .demo-title {
          margin: 1rem 0 0.75rem;
        }
        .demo-subtitle {
          margin: 0 auto;
          max-width: 760px;
          font-size: var(--font-size-md);
          line-height: var(--line-height-relaxed);
          color: var(--text-secondary);
        }
        .demo-frame {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 9;
          overflow: hidden;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          background: #000;
          box-shadow: var(--shadow-sm);
        }
        .demo-frame iframe {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          border: 0;
        }

        /* ── Features ── */
        .features {
          width: 100%;
          max-width: var(--max-width-content);
          padding: 4rem 1.5rem;
        }
        .features-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 2rem;
        }
        .feature-card {
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          overflow: hidden;
          transition: all var(--transition-normal);
          background: var(--surface);
        }
        .feature-card:hover {
          border-color: var(--primary-muted);
          box-shadow: var(--shadow-md);
          transform: translateY(-2px);
        }
        .feature-img-wrap {
          position: relative;
          width: 100%;
          aspect-ratio: 4 / 3;
        }
        .feature-text {
          padding: 1.25rem;
        }
        .feature-text h3 {
          font-size: var(--font-size-md);
          font-weight: var(--font-weight-semibold);
          color: var(--text-primary);
          margin-bottom: 0.5rem;
        }
        .feature-text p {
          font-size: var(--font-size-sm);
          line-height: var(--line-height-relaxed);
          color: var(--text-secondary);
        }

        /* ── How it works ── */
        .how-section {
          width: 100%;
          max-width: var(--max-width-content);
          padding: 3rem 1.5rem 4rem;
        }
        .how-toggle {
          display: flex;
          justify-content: center;
          margin-bottom: 2rem;
          margin-top: -1rem;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-sm);
          overflow: hidden;
          width: fit-content;
          margin-left: auto;
          margin-right: auto;
        }
        .how-toggle button {
          padding: 0.625rem 1.5rem;
          background: none;
          border: none;
          font-family: var(--font-family);
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-semibold);
          color: var(--text-tertiary);
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        .how-toggle button.active {
          background: var(--primary);
          color: var(--text-on-primary);
        }
        .how-toggle button:not(.active):hover {
          color: var(--text-primary);
          background: var(--hover);
        }
        .steps-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 2rem;
        }
        .step-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 2rem 1.5rem;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          background: var(--surface);
        }
        .step-num {
          width: 3rem;
          height: 3rem;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: var(--radius-full);
          background: var(--primary);
          color: var(--text-on-primary);
          font-size: var(--font-size-xl);
          font-weight: var(--font-weight-bold);
          margin-bottom: 1rem;
        }
        .step-title {
          font-size: var(--font-size-md);
          font-weight: var(--font-weight-semibold);
          color: var(--text-primary);
          margin-bottom: 0.5rem;
        }
        .step-desc {
          font-size: var(--font-size-sm);
          line-height: var(--line-height-relaxed);
          color: var(--text-secondary);
        }

        /* ── CTA ── */
        .cta-section {
          width: 100%;
          max-width: 700px;
          padding: 4rem 1.5rem 3rem;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .cta-subtitle {
          font-size: var(--font-size-lg);
          color: var(--text-secondary);
          text-align: center;
          margin-top: -1.5rem;
          margin-bottom: 2rem;
        }

        /* ── Social ── */
        .social-section {
          padding: 2rem 1.5rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
        }
        .social-label {
          font-size: var(--font-size-sm);
          color: var(--text-tertiary);
          font-weight: var(--font-weight-medium);
        }
        .social-links { display: flex; gap: 1rem; }
        .social-links a {
          color: var(--text-tertiary);
          transition: color var(--transition-fast);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .social-links a:hover { color: var(--primary); text-decoration: none; }

        /* ── Footer ── */
        .footer {
          width: 100%;
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          border-top: 1px solid var(--border-color);
        }
        .footer-links {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex-wrap: wrap;
          justify-content: center;
        }
        .footer-links a {
          font-size: var(--font-size-sm);
          color: var(--text-tertiary);
          transition: color var(--transition-fast);
        }
        .footer-links a:hover { color: var(--primary); text-decoration: none; }
        .footer-dot { width: 3px; height: 3px; border-radius: 50%; background: var(--text-disabled); }
        .footer-copy { font-size: var(--font-size-xs); color: var(--text-disabled); }

        /* ── Responsive ── */
        @media (max-width: 768px) {
          .hero { padding: 4rem 1.25rem 3rem; }
          h1 { font-size: var(--font-size-xxxl); }
          .subtitle { font-size: var(--font-size-md); }
          .demo-section { padding: 2rem 1rem 3rem; }
          .demo-copy { margin-bottom: 1rem; }
          .demo-subtitle { font-size: var(--font-size-sm); }
          .features-grid {
            grid-template-columns: 1fr;
            max-width: 420px;
            margin: 0 auto;
          }
          .steps-grid { grid-template-columns: 1fr; max-width: 420px; margin: 0 auto; }
          .store-buttons { flex-direction: column; align-items: center; width: 100%; max-width: 280px; }
          .store-btn { justify-content: center; width: 100%; }
          .section-title { font-size: var(--font-size-xl); }
        }
      `}</style>
    </main>
  );
}
