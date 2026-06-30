'use client';

import React, { useEffect, useId, useState } from 'react';
import { useLang } from '../contexts/LangContext';

interface Props {
  children: React.ReactNode;
  className?: string;
  platform?: 'ios' | 'android' | 'download';
  onClick?: () => void;
}

export default function DownloadSoonLink({ children, className, platform = 'download', onClick }: Props) {
  const { lang } = useLang();
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const bodyId = useId();
  const t = lang === 'fr'
    ? {
        title: 'Bientôt disponible',
        body: platform === 'android'
          ? 'Etudesk arrive bientôt sur Google Play.'
          : platform === 'ios'
            ? 'Etudesk arrive bientôt sur App Store.'
            : 'Le téléchargement sera bientôt disponible.',
        close: 'Fermer',
      }
    : {
        title: 'Coming soon',
        body: platform === 'android'
          ? 'Etudesk is coming soon to Google Play.'
          : platform === 'ios'
            ? 'Etudesk is coming soon to the App Store.'
            : 'The download will be available soon.',
        close: 'Close',
      };

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const showModal = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    onClick?.();
    setOpen(true);
  };

  return (
    <>
      <a href="#" className={className} onClick={showModal}>
        {children}
      </a>
      {open && (
        <div className="soon-backdrop" role="presentation" onMouseDown={() => setOpen(false)}>
          <div
            className="soon-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={bodyId}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="soon-x" onClick={() => setOpen(false)} aria-label={t.close}>x</button>
            <h2 id={titleId}>{t.title}</h2>
            <p id={bodyId}>{t.body}</p>
            <button className="soon-close" onClick={() => setOpen(false)}>{t.close}</button>
          </div>
        </div>
      )}

      <style jsx>{`
        .soon-backdrop {
          position: fixed;
          inset: 0;
          z-index: var(--z-modal);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.25rem;
          background: rgba(9, 9, 11, 0.42);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
        }
        .soon-modal {
          position: relative;
          width: min(100%, 360px);
          padding: 1.5rem;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          background: var(--surface);
          color: var(--text-primary);
          box-shadow: var(--shadow-xl);
          text-align: left;
        }
        .soon-modal h2 {
          margin: 0 2rem 0.5rem 0;
          font-size: var(--font-size-xl);
          letter-spacing: var(--letter-spacing-tight);
        }
        .soon-modal p {
          margin: 0;
          color: var(--text-secondary);
          font-size: var(--font-size-sm);
          line-height: var(--line-height-relaxed);
        }
        .soon-x {
          position: absolute;
          top: 0.8rem;
          right: 0.8rem;
          width: 2rem;
          height: 2rem;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-sm);
          background: var(--surface);
          color: var(--text-secondary);
          font-family: var(--font-family);
          font-size: var(--font-size-md);
          cursor: pointer;
        }
        .soon-x:hover {
          color: var(--text-primary);
          border-color: var(--border-strong);
        }
        .soon-close {
          display: inline-flex;
          justify-content: center;
          margin-top: 1.25rem;
          padding: 0.65rem 1rem;
          border: none;
          border-radius: var(--radius-sm);
          background: var(--primary);
          color: var(--text-on-primary);
          font-family: var(--font-family);
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-bold);
          cursor: pointer;
        }
      `}</style>
    </>
  );
}
