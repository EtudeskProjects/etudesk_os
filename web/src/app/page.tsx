'use client';

import React, { useState, useContext } from 'react';
import Image from 'next/image';
import { ThemeContext } from '../contexts/ThemeContext';

const UEMOA_COUNTRIES = [
  'Bénin', 'Burkina Faso', 'Côte d\'Ivoire', 'Guinée-Bissau',
  'Mali', 'Niger', 'Sénégal', 'Togo',
];

const translations = {
  fr: {
    tagline: 'Opportunités, communautés, espaces — un copilote IA pour tout relier',
    comingSoon: 'Bientôt disponible',
    title: 'Votre talent mérite\nune plateforme à sa hauteur',
    subtitle:
      'Etudesk connecte les talents aux opportunités, communautés et espaces de travail en Afrique de l\'Ouest. Avec un copilote IA qui t\'accompagne au quotidien.',
    storesSoon: 'Bientôt sur les stores',
    downloadIOS: 'App Store',
    downloadAndroid: 'Google Play',
    followUs: 'Suivez-nous',
    terms: 'Conditions d\'utilisation',
    privacy: 'Politique de confidentialité',
    rights: 'Tous droits réservés.',
    // Waitlist
    waitlistTitle: 'Sois parmi les premiers',
    typeTalent: 'Talent',
    typeOrg: 'Organisation',
    country: 'Pays',
    countryPlaceholder: 'Ton pays',
    countryOther: 'Autre',
    contactEmail: 'Email',
    contactWhatsapp: 'WhatsApp',
    emailPlaceholder: 'ton@email.com',
    whatsappPlaceholder: '+225 07 00 00 00 00',
    submit: 'Rejoindre la liste',
    submitting: 'Inscription...',
    successMessage: 'Tu es inscrit ! On te contacte dès le lancement.',
    errorMessage: 'Une erreur est survenue. Réessaie.',
    errorRate: 'Trop de demandes. Réessaie dans 1 heure.',
    errorInvalidEmail: 'Adresse email invalide.',
    errorInvalidWhatsapp: 'Numéro WhatsApp invalide.',
  },
  en: {
    tagline: 'Opportunities, communities, spaces — one AI copilot to connect them all',
    comingSoon: 'Coming Soon',
    title: 'Your talent deserves\na platform that matches it',
    subtitle:
      'Etudesk connects talents to opportunities, communities and workspaces across West Africa. With an AI copilot that supports you every step of the way.',
    storesSoon: 'Coming soon to app stores',
    downloadIOS: 'App Store',
    downloadAndroid: 'Google Play',
    followUs: 'Follow us',
    terms: 'Terms of Service',
    privacy: 'Privacy Policy',
    rights: 'All rights reserved.',
    // Waitlist
    waitlistTitle: 'Be among the first',
    typeTalent: 'Talent',
    typeOrg: 'Organization',
    country: 'Country',
    countryPlaceholder: 'Your country',
    countryOther: 'Other',
    contactEmail: 'Email',
    contactWhatsapp: 'WhatsApp',
    emailPlaceholder: 'your@email.com',
    whatsappPlaceholder: '+225 07 00 00 00 00',
    submit: 'Join the list',
    submitting: 'Signing up...',
    successMessage: 'You\'re in! We\'ll reach out when we launch.',
    errorMessage: 'Something went wrong. Please try again.',
    errorRate: 'Too many requests. Try again in 1 hour.',
    errorInvalidEmail: 'Invalid email address.',
    errorInvalidWhatsapp: 'Invalid WhatsApp number.',
  },
};

type Lang = 'fr' | 'en';
type UserType = 'TALENT' | 'ORGANIZATION';
type ContactType = 'EMAIL' | 'WHATSAPP';
type FormStatus = 'idle' | 'loading' | 'success' | 'error';

const API_URL = 'https://api.etudesk.com/api/waitlist';

export default function Home() {
  const [lang, setLang] = useState<Lang>('fr');
  const { isDark, toggleTheme } = useContext(ThemeContext);
  const t = translations[lang];

  // Waitlist form state
  const [userType, setUserType] = useState<UserType>('TALENT');
  const [country, setCountry] = useState('');
  const [contactType, setContactType] = useState<ContactType>('EMAIL');
  const [contactValue, setContactValue] = useState('');
  const [status, setStatus] = useState<FormStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setErrorMsg('');

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: userType,
          country,
          contactType,
          contactValue: contactType === 'WHATSAPP'
            ? contactValue.replace(/[\s\-\(\)]/g, '').trim()
            : contactValue.trim(),
        }),
      });

      if (res.status === 429) {
        setStatus('error');
        setErrorMsg(t.errorRate);
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        setStatus('error');
        if (data.error?.includes('email') || data.error?.includes('Email')) {
          setErrorMsg(t.errorInvalidEmail);
        } else if (data.error?.includes('WhatsApp') || data.error?.includes('whatsapp')) {
          setErrorMsg(t.errorInvalidWhatsapp);
        } else {
          setErrorMsg(t.errorMessage);
        }
        return;
      }

      setStatus('success');
    } catch {
      setStatus('error');
      setErrorMsg(t.errorMessage);
    }
  };

  return (
    <main className="coming-soon">
      {/* Top bar: theme toggle (left) + lang toggle (right) */}
      <div className="top-bar">
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={isDark ? 'Light mode' : 'Dark mode'}
        >
          {isDark ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>

        <div className="lang-toggle">
          <button
            className={lang === 'fr' ? 'active' : ''}
            onClick={() => setLang('fr')}
            aria-label="Francais"
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
      </div>

      {/* Main content */}
      <div className="content">
        {/* Logo */}
        <div className="logo">
          <Image
            src={isDark ? '/images/etudesk_logo_white.png' : '/images/etudesk_logo_black.png'}
            alt="Etudesk"
            width={160}
            height={46}
            style={{ objectFit: 'contain' }}
            priority
          />
        </div>

        {/* Tagline */}
        <p className="tagline">{t.tagline}</p>

        {/* Coming Soon badge */}
        <span className="badge">{t.comingSoon}</span>

        {/* Title */}
        <h1>{t.title}</h1>

        {/* Subtitle */}
        <p className="subtitle">{t.subtitle}</p>

        {/* Store buttons */}
        <div className="store-buttons">
          <a href="#" className="store-btn" title={t.storesSoon}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
            </svg>
            <div className="store-btn-text">
              <span className="store-btn-small">{t.storesSoon}</span>
              <span className="store-btn-name">{t.downloadIOS}</span>
            </div>
          </a>
          <a href="#" className="store-btn" title={t.storesSoon}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z" />
            </svg>
            <div className="store-btn-text">
              <span className="store-btn-small">{t.storesSoon}</span>
              <span className="store-btn-name">{t.downloadAndroid}</span>
            </div>
          </a>
        </div>

        {/* Waitlist Form */}
        <div className="waitlist-section">
          <h2 className="waitlist-title">{t.waitlistTitle}</h2>

          {status === 'success' ? (
            <div className="waitlist-success">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <p>{t.successMessage}</p>
            </div>
          ) : (
            <form className="waitlist-form" onSubmit={handleSubmit}>
              {/* Type toggle */}
              <div className="pill-toggle">
                <button
                  type="button"
                  className={userType === 'TALENT' ? 'active' : ''}
                  onClick={() => setUserType('TALENT')}
                >
                  {t.typeTalent}
                </button>
                <button
                  type="button"
                  className={userType === 'ORGANIZATION' ? 'active' : ''}
                  onClick={() => setUserType('ORGANIZATION')}
                >
                  {t.typeOrg}
                </button>
              </div>

              {/* Country select */}
              <select
                className="waitlist-select"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                required
              >
                <option value="" disabled>{t.countryPlaceholder}</option>
                {UEMOA_COUNTRIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
                <option value="Autre">{t.countryOther}</option>
              </select>

              {/* Contact type toggle + input */}
              <div className="contact-row">
                <div className="pill-toggle pill-toggle-sm">
                  <button
                    type="button"
                    className={contactType === 'EMAIL' ? 'active' : ''}
                    onClick={() => { setContactType('EMAIL'); setContactValue(''); }}
                  >
                    {t.contactEmail}
                  </button>
                  <button
                    type="button"
                    className={contactType === 'WHATSAPP' ? 'active' : ''}
                    onClick={() => { setContactType('WHATSAPP'); setContactValue(''); }}
                  >
                    {t.contactWhatsapp}
                  </button>
                </div>
                <input
                  className="waitlist-input"
                  type={contactType === 'EMAIL' ? 'email' : 'tel'}
                  placeholder={contactType === 'EMAIL' ? t.emailPlaceholder : t.whatsappPlaceholder}
                  value={contactValue}
                  onChange={(e) => setContactValue(e.target.value)}
                  required
                />
              </div>

              {errorMsg && <p className="waitlist-error">{errorMsg}</p>}

              <button
                type="submit"
                className="waitlist-submit"
                disabled={status === 'loading'}
              >
                {status === 'loading' ? t.submitting : t.submit}
              </button>
            </form>
          )}
        </div>

        {/* Social links */}
        <div className="social-section">
          <p className="social-label">{t.followUs}</p>
          <div className="social-links">
            <a href="https://www.facebook.com/etudesk" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95z" /></svg>
            </a>
            <a href="https://www.linkedin.com/company/etudesk" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" /></svg>
            </a>
            <a href="https://x.com/etudesk" target="_blank" rel="noopener noreferrer" aria-label="X">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
            </a>
            <a href="https://www.instagram.com/etudesk" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2m-.2 2A3.6 3.6 0 0 0 4 7.6v8.8C4 18.39 5.61 20 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6C20 5.61 18.39 4 16.4 4H7.6m9.65 1.5a1.25 1.25 0 0 1 1.25 1.25A1.25 1.25 0 0 1 17.25 8 1.25 1.25 0 0 1 16 6.75a1.25 1.25 0 0 1 1.25-1.25M12 7a5 5 0 0 1 5 5 5 5 0 0 1-5 5 5 5 0 0 1-5-5 5 5 0 0 1 5-5m0 2a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3z" /></svg>
            </a>
            <a href="https://www.youtube.com/@etudesk" target="_blank" rel="noopener noreferrer" aria-label="YouTube">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M10 15l5.19-3L10 9v6m11.56-7.83c.13.47.22 1.1.28 1.9.07.8.1 1.49.1 2.09L22 12c0 2.19-.16 3.8-.44 4.83-.25.9-.83 1.48-1.73 1.73-.47.13-1.33.22-2.65.28-1.3.07-2.49.1-3.59.1L12 19c-4.19 0-6.8-.16-7.83-.44-.9-.25-1.48-.83-1.73-1.73-.13-.47-.22-1.1-.28-1.9-.07-.8-.1-1.49-.1-2.09L2 12c0-2.19.16-3.8.44-4.83.25-.9.83-1.48 1.73-1.73.47-.13 1.33-.22 2.65-.28 1.3-.07 2.49-.1 3.59-.1L12 5c4.19 0 6.8.16 7.83.44.9.25 1.48.83 1.73 1.73z" /></svg>
            </a>
            <a href="https://www.tiktok.com/@etudesk" target="_blank" rel="noopener noreferrer" aria-label="TikTok">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M16.6 5.82s.51.5 0 0A4.278 4.278 0 0 1 15.54 3h-3.09v12.4a2.592 2.592 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3s-1.88.09-3.24-1.48z" /></svg>
            </a>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-links">
          <a href="/terms">{t.terms}</a>
          <span className="footer-dot" aria-hidden="true" />
          <a href="/privacy">{t.privacy}</a>
        </div>
        <p className="footer-copy">&copy; {new Date().getFullYear()} Etudesk. {t.rights}</p>
      </footer>

      <style jsx>{`
        .coming-soon {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        /* Top bar */
        .top-bar {
          width: 100%;
          max-width: 1200px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.5rem;
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
          justify-content: center;
          transition: all var(--transition-fast);
        }

        .theme-toggle:hover {
          color: var(--primary);
          border-color: var(--primary);
        }

        .lang-toggle {
          display: flex;
          gap: 0;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-sm);
          overflow: hidden;
        }

        .lang-toggle button {
          background: none;
          border: none;
          padding: 0.5rem 0.75rem;
          font-family: var(--font-family);
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-medium);
          color: var(--text-tertiary);
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .lang-toggle button.active {
          background: var(--primary);
          color: var(--text-on-primary);
        }

        .lang-toggle button:not(.active):hover {
          color: var(--text-primary);
          background: var(--hover);
        }

        /* Main content */
        .content {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 2rem 1.5rem;
          max-width: 640px;
          gap: 1.25rem;
        }

        .logo {
          margin-bottom: 0.5rem;
        }

        .tagline {
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-medium);
          color: var(--text-tertiary);
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
          color: var(--primary);
          background: var(--pressed);
          border-radius: var(--radius-full);
        }

        h1 {
          font-size: var(--font-size-display);
          font-weight: var(--font-weight-bold);
          line-height: var(--line-height-tight);
          letter-spacing: var(--letter-spacing-tight);
          color: var(--text-primary);
          white-space: pre-line;
        }

        .subtitle {
          font-size: var(--font-size-lg);
          line-height: var(--line-height-relaxed);
          color: var(--text-secondary);
          max-width: 520px;
        }

        /* Store buttons */
        .store-buttons {
          display: flex;
          gap: 0.75rem;
          margin-top: 0.5rem;
        }

        .store-btn {
          display: flex;
          align-items: center;
          gap: 0.625rem;
          padding: 0.625rem 1.25rem;
          background: var(--primary);
          color: var(--text-on-primary);
          border-radius: var(--radius-md);
          text-decoration: none;
          transition: all var(--transition-fast);
          cursor: default;
          opacity: 0.85;
        }

        .store-btn:hover {
          opacity: 1;
          text-decoration: none;
          color: var(--text-on-primary);
        }

        .store-btn svg {
          flex-shrink: 0;
        }

        .store-btn-text {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          line-height: 1.2;
        }

        .store-btn-small {
          font-size: var(--font-size-xxs);
          opacity: 0.8;
        }

        .store-btn-name {
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-semibold);
        }

        /* Waitlist section */
        .waitlist-section {
          width: 100%;
          max-width: 420px;
          margin-top: 2rem;
          padding: 1.5rem;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg, 12px);
          background: var(--surface, var(--bg-secondary, transparent));
        }

        .waitlist-title {
          font-size: var(--font-size-lg);
          font-weight: var(--font-weight-semibold);
          color: var(--text-primary);
          margin-bottom: 1.25rem;
        }

        .waitlist-form {
          display: flex;
          flex-direction: column;
          gap: 0.875rem;
        }

        /* Pill toggle */
        .pill-toggle {
          display: flex;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-sm);
          overflow: hidden;
        }

        .pill-toggle button {
          flex: 1;
          padding: 0.5rem 0.75rem;
          background: none;
          border: none;
          font-family: var(--font-family);
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-medium);
          color: var(--text-tertiary);
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .pill-toggle button.active {
          background: var(--primary);
          color: var(--text-on-primary);
        }

        .pill-toggle button:not(.active):hover {
          color: var(--text-primary);
          background: var(--hover);
        }

        .pill-toggle-sm {
          flex-shrink: 0;
        }

        .pill-toggle-sm button {
          padding: 0.5rem 0.625rem;
          font-size: var(--font-size-xs);
        }

        /* Select */
        .waitlist-select {
          width: 100%;
          padding: 0.625rem 0.75rem;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-sm);
          background: var(--bg-primary, #fff);
          color: var(--text-primary);
          font-family: var(--font-family);
          font-size: var(--font-size-sm);
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg width='10' height='6' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23999'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 0.75rem center;
          cursor: pointer;
        }

        .waitlist-select:focus {
          outline: none;
          border-color: var(--primary);
        }

        /* Contact row */
        .contact-row {
          display: flex;
          gap: 0.5rem;
          align-items: stretch;
        }

        .waitlist-input {
          flex: 1;
          min-width: 0;
          padding: 0.625rem 0.75rem;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-sm);
          background: var(--bg-primary, #fff);
          color: var(--text-primary);
          font-family: var(--font-family);
          font-size: var(--font-size-sm);
        }

        .waitlist-input:focus {
          outline: none;
          border-color: var(--primary);
        }

        .waitlist-input::placeholder {
          color: var(--text-disabled);
        }

        /* Error */
        .waitlist-error {
          font-size: var(--font-size-xs);
          color: var(--error, #e53e3e);
        }

        /* Submit */
        .waitlist-submit {
          padding: 0.75rem 1.5rem;
          background: var(--primary);
          color: var(--text-on-primary);
          border: none;
          border-radius: var(--radius-sm);
          font-family: var(--font-family);
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-semibold);
          cursor: pointer;
          transition: opacity var(--transition-fast);
        }

        .waitlist-submit:hover:not(:disabled) {
          opacity: 0.9;
        }

        .waitlist-submit:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        /* Success */
        .waitlist-success {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem 0;
          color: var(--success, #38a169);
        }

        .waitlist-success p {
          font-size: var(--font-size-sm);
          color: var(--text-secondary);
          text-align: center;
        }

        /* Social */
        .social-section {
          margin-top: 1.5rem;
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

        .social-links {
          display: flex;
          gap: 1rem;
        }

        .social-links a {
          color: var(--text-tertiary);
          transition: color var(--transition-fast);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .social-links a:hover {
          color: var(--primary);
          text-decoration: none;
        }

        /* Footer */
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

        .footer-links a:hover {
          color: var(--primary);
          text-decoration: none;
        }

        .footer-dot {
          width: 3px;
          height: 3px;
          border-radius: 50%;
          background: var(--text-disabled);
        }

        .footer-copy {
          font-size: var(--font-size-xs);
          color: var(--text-disabled);
        }

        /* Responsive */
        @media (max-width: 640px) {
          h1 {
            font-size: var(--font-size-xxxl);
          }

          .subtitle {
            font-size: var(--font-size-md);
          }

          .store-buttons {
            flex-direction: column;
            width: 100%;
          }

          .store-btn {
            justify-content: center;
          }

          .content {
            padding: 1.5rem 1.25rem;
          }

          .contact-row {
            flex-direction: column;
          }

          .waitlist-section {
            padding: 1.25rem;
          }
        }
      `}</style>
    </main>
  );
}
