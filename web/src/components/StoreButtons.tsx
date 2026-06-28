'use client';

import React from 'react';
import { useLang } from '../contexts/LangContext';
import { IOS_URL, ANDROID_URL } from '../lib/site';

const AppleIcon = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
);
// Icone Google Play aux vraies couleurs (bleu / vert / jaune / rouge)
const PlayIcon = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path fill="#00D3FF" d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5Z" />
    <path fill="#00F076" d="M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z" />
    <path fill="#FFCE00" d="M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81Z" />
    <path fill="#FF3A44" d="M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12Z" />
  </svg>
);

interface Props {
  variant?: 'primary' | 'light' | 'brand';
  size?: 'md' | 'lg';
  full?: boolean;
}

export default function StoreButtons({ variant = 'primary', size = 'md', full = false }: Props) {
  const { lang } = useLang();
  const t = lang === 'fr'
    ? { on: 'Télécharger sur', get: 'Disponible sur' }
    : { on: 'Download on', get: 'Get it on' };
  const icon = size === 'lg' ? 24 : 22;

  return (
    <div className={`store-buttons ${full ? 'full' : ''}`}>
      <a href={IOS_URL} target="_blank" rel="noopener noreferrer" className={`store-btn ${variant} ${size}`}>
        <AppleIcon size={icon} />
        <span className="t"><span className="s">{t.on}</span><span className="n">App Store</span></span>
      </a>
      <a href={ANDROID_URL} target="_blank" rel="noopener noreferrer" className={`store-btn ${variant} ${size}`}>
        <PlayIcon size={icon} />
        <span className="t"><span className="s">{t.get}</span><span className="n">Google Play</span></span>
      </a>

      <style jsx>{`
        .store-buttons { display: flex; gap: 0.75rem; flex-wrap: wrap; }
        .store-buttons.full { width: 100%; }
        .store-buttons.full .store-btn { flex: 1; justify-content: center; }
        .store-btn {
          display: inline-flex; align-items: center; gap: 0.625rem;
          padding: 0.7rem 1.4rem; border-radius: var(--radius-sm);
          text-decoration: none; transition: opacity var(--transition-fast), background var(--transition-fast);
          white-space: nowrap;
        }
        .store-btn.lg { padding: 0.85rem 1.6rem; }
        .store-btn.primary { background: var(--primary); color: var(--text-on-primary); }
        .store-btn.primary:hover { opacity: 0.9; color: var(--text-on-primary); text-decoration: none; }
        .store-btn.light { background: #FFFFFF; color: #18181B; }
        .store-btn.light:hover { background: #F4F4F5; color: #18181B; text-decoration: none; }
        .store-btn.brand { background: #000000; color: #FFFFFF; border: 1px solid rgba(255,255,255,0.18); }
        .store-btn.brand:hover { background: #1A1A1A; color: #FFFFFF; text-decoration: none; }
        .t { display: flex; flex-direction: column; align-items: flex-start; line-height: 1.15; }
        .s { font-size: var(--font-size-xxs); opacity: 0.7; }
        .n { font-size: var(--font-size-sm); font-weight: var(--font-weight-bold); }
        @media (max-width: 768px) {
          .store-buttons { width: 100%; max-width: 320px; }
          .store-btn { flex: 1; justify-content: center; }
        }
      `}</style>
    </div>
  );
}
