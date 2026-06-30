'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useLang } from '@/contexts/LangContext';
import { termsCopy as translations } from '@/content/terms';


type Lang = 'fr' | 'en';

export default function TermsView({ lang }: { lang: Lang }) {
  const { setLang } = useLang();
  const t = translations[lang];
  const updateDate = '2026-02-21';

  return (
    <main className="legal-page">
      {/* Navigation */}
      <nav className="nav">
        <div className="nav-container">
          <Link href={`/${lang}`} className="nav-logo">
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
        <Link href={`/${lang}`} className="back-link">&larr; {t.backToHome}</Link>

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
          border-radius: var(--radius-sm);
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
