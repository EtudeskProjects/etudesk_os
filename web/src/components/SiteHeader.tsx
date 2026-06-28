'use client';

import React, { useState, useContext } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sun, Moon, Menu, X } from 'lucide-react';
import { ThemeContext } from '../contexts/ThemeContext';
import { useLang } from '../contexts/LangContext';
import { NAV, IOS_URL, type NavItem } from '../lib/site';

export default function SiteHeader() {
  const { isDark, toggleTheme } = useContext(ThemeContext);
  const { lang, setLang } = useLang();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (n: NavItem) => (n.match ? pathname?.includes(`/${n.match}`) ?? false : false);
  const dl = lang === 'fr' ? 'Télécharger' : 'Download';

  // Lien de nav complet, prefixe par la langue courante (ex: /fr#produit).
  const navHref = (n: NavItem) => `/${lang}${n.href}`;

  // Defilement fluide vers une ancre si elle existe sur la page courante.
  // Sinon, on laisse Next naviguer (chargera la home dans la bonne langue).
  const handleNavClick = (e: React.MouseEvent, href: string) => {
    const hashIdx = href.indexOf('#');
    if (hashIdx >= 0) {
      const el = document.getElementById(href.slice(hashIdx + 1));
      if (el) {
        e.preventDefault();
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        window.history.pushState(null, '', href);
      }
    }
    setOpen(false);
  };

  return (
    <header className="top-bar">
      <div className="inner">
        <Link href={`/${lang}`} className="logo" aria-label="Etudesk" onClick={() => setOpen(false)}>
          <Image
            src={isDark ? '/images/etudesk_logo_white.png' : '/images/etudesk_logo_black.png'}
            alt="Etudesk" width={124} height={36} style={{ objectFit: 'contain' }} priority
          />
        </Link>

        <nav className="links">
          {NAV.map((n) => (
            <Link key={n.href} href={navHref(n)} className={isActive(n) ? 'active' : ''} onClick={(e) => handleNavClick(e, navHref(n))}>
              {lang === 'fr' ? n.fr : n.en}
            </Link>
          ))}
        </nav>

        <div className="right">
          <button className="icon-btn" onClick={toggleTheme} aria-label={isDark ? 'Mode clair' : 'Mode sombre'}>
            {isDark ? <Sun size={18} strokeWidth={1.25} /> : <Moon size={18} strokeWidth={1.25} />}
          </button>
          <div className="lang">
            <button className={lang === 'fr' ? 'on' : ''} onClick={() => setLang('fr')}>FR</button>
            <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>EN</button>
          </div>
          <a href={IOS_URL} target="_blank" rel="noopener noreferrer" className="cta">{dl}</a>
          <button className="icon-btn burger" onClick={() => setOpen((v) => !v)} aria-label="Menu">
            {open ? <X size={20} strokeWidth={1.25} /> : <Menu size={20} strokeWidth={1.25} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="sheet">
          {NAV.map((n) => (
            <Link key={n.href} href={navHref(n)} className={isActive(n) ? 'active' : ''} onClick={(e) => handleNavClick(e, navHref(n))}>
              {lang === 'fr' ? n.fr : n.en}
            </Link>
          ))}
          <a href={IOS_URL} target="_blank" rel="noopener noreferrer" className="sheet-cta">{dl}</a>
        </div>
      )}

      <style jsx>{`
        .top-bar { position: sticky; top: 0; z-index: var(--z-sticky); background: var(--background); border-bottom: 1px solid var(--border-color); }
        .inner { max-width: var(--max-width-content); margin: 0 auto; display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0.7rem 1.5rem; }
        .logo { display: flex; align-items: center; flex: none; }
        .links { display: flex; align-items: center; gap: 1.5rem; }
        :global(.links a) { padding: 0.45rem 0.75rem; border-radius: var(--radius-sm); font-size: var(--font-size-sm); font-weight: var(--font-weight-medium); color: var(--text-secondary); text-decoration: none; transition: all var(--transition-fast); }
        :global(.links a:hover) { color: var(--text-primary); background: var(--hover); text-decoration: none; }
        :global(.links a.active) { color: var(--text-on-primary); font-weight: var(--font-weight-semibold); background: var(--primary); }
        :global(.links a.active:hover) { background: var(--primary); color: var(--text-on-primary); }
        .right { display: flex; align-items: center; gap: 0.6rem; }
        .icon-btn { display: flex; align-items: center; justify-content: center; background: none; border: 1px solid var(--border-color); border-radius: var(--radius-sm); color: var(--text-secondary); cursor: pointer; padding: 0.45rem; transition: all var(--transition-fast); }
        .icon-btn:hover { color: var(--text-primary); border-color: var(--border-strong); }
        .lang { display: flex; border: 1px solid var(--border-color); border-radius: var(--radius-sm); overflow: hidden; }
        .lang button { background: none; border: none; padding: 0.4rem 0.6rem; font-family: var(--font-family); font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold); color: var(--text-tertiary); cursor: pointer; transition: all var(--transition-fast); }
        .lang button.on { background: var(--primary); color: var(--text-on-primary); }
        .lang button:not(.on):hover { color: var(--text-primary); }
        .cta { padding: 0.5rem 1rem; background: var(--primary); color: var(--text-on-primary); border-radius: var(--radius-sm); font-size: var(--font-size-sm); font-weight: var(--font-weight-bold); transition: opacity var(--transition-fast); }
        .cta:hover { opacity: 0.9; color: var(--text-on-primary); text-decoration: none; }
        .burger { display: none; }
        .sheet { display: none; }
        @media (max-width: 880px) {
          .links { display: none; }
          .cta { display: none; }
          .burger { display: flex; }
          .sheet { display: flex; flex-direction: column; gap: 0.25rem; padding: 0.75rem 1.5rem 1.25rem; border-top: 1px solid var(--border-color); background: var(--background); }
          :global(.sheet a) { display: block; padding: 0.7rem 0.6rem; border-radius: var(--radius-sm); font-size: var(--font-size-md); font-weight: var(--font-weight-medium); color: var(--text-secondary); text-decoration: none; }
          :global(.sheet a:hover) { text-decoration: none; }
          :global(.sheet a.active) { color: var(--text-on-primary); background: var(--primary); }
          .sheet-cta { margin-top: 0.75rem; text-align: center; padding: 0.8rem 1rem !important; background: var(--primary); color: var(--text-on-primary) !important; border-radius: var(--radius-sm); font-weight: var(--font-weight-bold); border-bottom: none !important; }
        }
      `}</style>
    </header>
  );
}
