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

    // Try to open the mobile app via deep link
    const deepLink = `etudesk://billing/callback?reference=${encodeURIComponent(reference)}`;
    window.location.href = deepLink;
  }, [reference]);

  return (
    <main style={styles.container}>
      <div style={styles.card}>
        <div style={styles.checkmark}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#4A6741" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
    backgroundColor: '#FAF9F7',
    fontFamily: '"DM Sans", system-ui, sans-serif',
  },
  card: {
    maxWidth: 400,
    width: '100%',
    textAlign: 'center',
    padding: '2.5rem 2rem',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
  },
  checkmark: {
    marginBottom: '1rem',
  },
  title: {
    fontSize: '1.25rem',
    fontWeight: 600,
    color: '#1F1C18',
    marginBottom: '0.5rem',
  },
  message: {
    fontSize: '0.938rem',
    color: '#6E675C',
    lineHeight: 1.5,
    marginBottom: '1.5rem',
  },
  button: {
    display: 'inline-block',
    padding: '0.75rem 2rem',
    backgroundColor: '#3B2416',
    color: '#FFFFFF',
    borderRadius: 8,
    textDecoration: 'none',
    fontSize: '0.938rem',
    fontWeight: 600,
  },
  ref: {
    marginTop: '1rem',
    fontSize: '0.75rem',
    color: '#B8B2A8',
  },
};
