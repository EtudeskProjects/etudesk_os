'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * Paystack payment callback page.
 * After payment, Paystack redirects here with ?trxref=xxx&reference=xxx.
 * This page attempts to open the Etudesk mobile app via deep link,
 * then shows a fallback message if the app doesn't open.
 */
export default function BillingCallback() {
  const searchParams = useSearchParams();
  const reference = searchParams.get('reference') || searchParams.get('trxref') || '';

  useEffect(() => {
    if (!reference) return;
    const deepLink = `etudesk://billing/callback?reference=${encodeURIComponent(reference)}`;
    window.location.href = deepLink;
  }, [reference]);

  return (
    <main style={styles.container}>
      <div style={styles.card}>
        <div style={styles.checkmark}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--skill-language)" strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>
        <h1 style={styles.title}>Paiement traité</h1>
        <p style={styles.message}>
          {reference
            ? 'Ton paiement a été reçu. Retourne dans l\'application Etudesk pour voir ton solde mis à jour.'
            : 'Retourne dans l\'application Etudesk.'}
        </p>
        {reference && (
          <a
            href={`etudesk://billing/callback?reference=${encodeURIComponent(reference)}`}
            style={styles.button}
          >
            Ouvrir Etudesk
          </a>
        )}
        <p style={styles.ref}>
          {reference && `Réf: ${reference}`}
        </p>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '1.5rem',
    backgroundColor: 'var(--background-secondary)',
    fontFamily: 'var(--font-family)',
  },
  card: {
    maxWidth: 400,
    width: '100%',
    textAlign: 'center',
    padding: '2.5rem 2rem',
    borderRadius: 'var(--radius-xl)',
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--border-color)',
    boxShadow: 'var(--shadow-md)',
  },
  checkmark: {
    marginBottom: '1rem',
  },
  title: {
    fontSize: 'var(--font-size-xl)',
    fontWeight: 'var(--font-weight-bold)' as React.CSSProperties['fontWeight'],
    color: 'var(--text-primary)',
    marginBottom: '0.5rem',
  },
  message: {
    fontSize: 'var(--font-size-md)',
    color: 'var(--text-secondary)',
    lineHeight: 'var(--line-height-relaxed)' as React.CSSProperties['lineHeight'],
    marginBottom: '1.5rem',
  },
  button: {
    display: 'inline-block',
    padding: '0.85rem 1.6rem',
    backgroundColor: 'var(--primary)',
    color: 'var(--text-on-primary)',
    borderRadius: 'var(--radius-sm)',
    textDecoration: 'none',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 'var(--font-weight-bold)' as React.CSSProperties['fontWeight'],
  },
  ref: {
    marginTop: '1rem',
    fontSize: 'var(--font-size-xs)',
    color: 'var(--text-tertiary)',
  },
};
