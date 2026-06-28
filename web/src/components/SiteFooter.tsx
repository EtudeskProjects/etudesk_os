'use client';

import React, { useContext } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ThemeContext } from '../contexts/ThemeContext';
import { useLang } from '../contexts/LangContext';
import { SOCIALS, IOS_URL, NAV } from '../lib/site';

export default function SiteFooter() {
  const { isDark } = useContext(ThemeContext);
  const { lang } = useLang();
  const t = lang === 'fr'
    ? { dl: 'Télécharger', tagline: 'Prépare-toi aux compétences de demain.', rights: 'Tous droits réservés.',
        privacy: 'Confidentialité', terms: 'Conditions', legalNotice: 'Mentions légales' }
    : { dl: 'Download', tagline: 'Get ready for tomorrow\'s skills.', rights: 'All rights reserved.',
        privacy: 'Privacy', terms: 'Terms', legalNotice: 'Legal notice' };

  return (
    <footer className="footer">
      <div className="inner">
        <div className="main">
          <div className="brand">
            <Image src={isDark ? '/images/etudesk_logo_white.png' : '/images/etudesk_logo_black.png'} alt="Etudesk" width={116} height={32} style={{ objectFit: 'contain' }} />
            <p className="tag">{t.tagline}</p>
            <div className="socials">
              <a href={SOCIALS.linkedin} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/></svg></a>
              <a href={SOCIALS.x} target="_blank" rel="noopener noreferrer" aria-label="X"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg></a>
              <a href={SOCIALS.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2m-.2 2A3.6 3.6 0 0 0 4 7.6v8.8C4 18.39 5.61 20 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6C20 5.61 18.39 4 16.4 4H7.6m9.65 1.5a1.25 1.25 0 0 1 1.25 1.25A1.25 1.25 0 0 1 17.25 8 1.25 1.25 0 0 1 16 6.75a1.25 1.25 0 0 1 1.25-1.25M12 7a5 5 0 0 1 5 5 5 5 0 0 1-5 5 5 5 0 0 1-5-5 5 5 0 0 1 5-5m0 2a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3z"/></svg></a>
              <a href={SOCIALS.youtube} target="_blank" rel="noopener noreferrer" aria-label="YouTube"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M10 15l5.19-3L10 9v6m11.56-7.83c.13.47.22 1.1.28 1.9.07.8.1 1.49.1 2.09L22 12c0 2.19-.16 3.8-.44 4.83-.25.9-.83 1.48-1.73 1.73-.47.13-1.33.22-2.65.28-1.3.07-2.49.1-3.59.1L12 19c-4.19 0-6.8-.16-7.83-.44-.9-.25-1.48-.83-1.73-1.73-.13-.47-.22-1.1-.28-1.9-.07-.8-.1-1.49-.1-2.09L2 12c0-2.19.16-3.8.44-4.83.25-.9.83-1.48 1.73-1.73.47-.13 1.33-.22 2.65-.28 1.3-.07 2.49-.1 3.59-.1L12 5c4.19 0 6.8.16 7.83.44.9.25 1.48.83 1.73 1.73z"/></svg></a>
              <a href={SOCIALS.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95z"/></svg></a>
            </div>
          </div>

          <nav className="links" aria-label="Footer">
            {NAV.map((n) => (
              <Link key={n.href} href={`/${lang}${n.href}`}>{lang === 'fr' ? n.fr : n.en}</Link>
            ))}
            <a href={IOS_URL} target="_blank" rel="noopener noreferrer">{t.dl}</a>
          </nav>
        </div>

        <div className="bottom">
          <p className="copy">&copy; {new Date().getFullYear()} Etudesk. {t.rights}</p>
          <div className="legal">
            <Link href={`/${lang}/privacy`}>{t.privacy}</Link>
            <Link href={`/${lang}/terms`}>{t.terms}</Link>
            <Link href={`/${lang}/legal`}>{t.legalNotice}</Link>
          </div>
        </div>
      </div>

      <style jsx>{`
        .footer { border-top: 1px solid var(--border-color); background: var(--background-secondary); }
        .inner { max-width: var(--max-width-content); margin: 0 auto; padding: 3.5rem 1.5rem 1.75rem; }
        .main { display: flex; justify-content: space-between; align-items: flex-start; gap: 3rem; flex-wrap: wrap; padding-bottom: 2.5rem; }
        .brand { display: flex; flex-direction: column; gap: 1rem; max-width: 300px; }
        .tag { font-size: var(--font-size-sm); color: var(--text-secondary); line-height: var(--line-height-relaxed); }
        .socials { display: flex; gap: 1rem; margin-top: 0.25rem; }
        .socials a { color: var(--text-tertiary); transition: color var(--transition-fast); display: flex; }
        .socials a:hover { color: var(--text-primary); }
        .links { display: flex; flex-wrap: wrap; align-items: center; gap: 0.85rem 1.75rem; }
        .links :global(a) { font-size: var(--font-size-sm); font-weight: var(--font-weight-medium); color: var(--text-secondary); transition: color var(--transition-fast); }
        .links :global(a:hover) { color: var(--text-primary); text-decoration: none; }
        .bottom { display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; padding-top: 1.5rem; border-top: 1px solid var(--border-color); }
        .copy { font-size: var(--font-size-xs); color: var(--text-tertiary); }
        .legal { display: flex; gap: 1.5rem; }
        .legal :global(a) { font-size: var(--font-size-xs); color: var(--text-tertiary); transition: color var(--transition-fast); }
        .legal :global(a:hover) { color: var(--text-primary); text-decoration: none; }
        @media (max-width: 768px) {
          .inner { padding: 2.5rem 1.25rem 1.5rem; }
          .main { flex-direction: column; gap: 2rem; padding-bottom: 2rem; }
          .bottom { flex-direction: column; align-items: flex-start; gap: 0.85rem; }
        }
      `}</style>
    </footer>
  );
}
