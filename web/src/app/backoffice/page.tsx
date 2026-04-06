'use client';

import React, { useState, useEffect, useCallback } from 'react';

// Non-indexed: tell search engines to skip this page
export const dynamic = 'force-dynamic';

const VPS_API = 'https://31.207.33.69';

interface Stats {
  users: number;
  talents: number;
  organizations: number;
  communities: number;
  opportunities: number;
  waitlist: number;
  copilot_sessions: number;
  copilot_traces: number;
  tokens_input: number;
  tokens_output: number;
  tokens_total: number;
  signups_today: number;
  signups_week: number;
}

interface RecentUser {
  id: string;
  email: string;
  phone: string;
  created_at: string;
  first_name: string;
  last_name: string;
}

interface WaitlistEntry {
  id: string;
  type: string;
  country: string;
  contact_type: string;
  contact_value: string;
  created_at: string;
}

export default function BackofficePage() {
  const [token, setToken] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchData = useCallback(async (secret: string) => {
    setLoading(true);
    setError('');
    try {
      const headers = { 'Authorization': `Bearer ${secret}` };

      const [statsRes, usersRes, waitlistRes] = await Promise.all([
        fetch(`${VPS_API}/api/v1/backoffice/stats`, { headers }).then(r => r.json()),
        fetch(`${VPS_API}/api/v1/backoffice/users?limit=20`, { headers }).then(r => r.json()),
        fetch(`${VPS_API}/api/v1/backoffice/waitlist?limit=50`, { headers }).then(r => r.json()),
      ]);

      if (!statsRes.success) throw new Error('Acces refuse');

      const d = statsRes.data;
      setStats({
        users: d.users.total,
        talents: d.users.talents,
        organizations: d.users.organizations,
        communities: d.content.communities,
        opportunities: d.content.opportunities,
        waitlist: d.users.waitlist,
        copilot_sessions: d.copilot.total_sessions,
        copilot_traces: d.copilot.total_traces,
        tokens_input: d.copilot.total_input_tokens,
        tokens_output: d.copilot.total_output_tokens,
        tokens_total: d.copilot.total_tokens,
        signups_today: d.users.signups_today,
        signups_week: d.users.signups_this_week,
      });
      setRecentUsers(usersRes.data || []);
      setWaitlist(waitlistRes.data || []);
      setLastRefresh(new Date());
      setAuthenticated(true);
    } catch (err: any) {
      setError(err.message || 'Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-refresh every 30s
  useEffect(() => {
    if (!authenticated || !token) return;
    const interval = setInterval(() => fetchData(token), 30000);
    return () => clearInterval(interval);
  }, [authenticated, token, fetchData]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (token.trim()) fetchData(token.trim());
  };

  const fmt = (n: number) => n.toLocaleString('fr-FR');
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  if (!authenticated) {
    return (
      <main style={styles.loginPage}>
        <div style={styles.loginCard}>
          <h1 style={styles.loginTitle}>Etudesk Backoffice</h1>
          <p style={styles.loginSub}>Entrez votre token d'acces</p>
          <form onSubmit={handleLogin} style={styles.loginForm}>
            <input
              type="password"
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="Token secret"
              style={styles.input}
              autoFocus
            />
            <button type="submit" style={styles.btnPrimary} disabled={loading}>
              {loading ? 'Connexion...' : 'Acceder'}
            </button>
          </form>
          {error && <p style={styles.error}>{error}</p>}
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <div>
          <h1 style={styles.headerTitle}>Etudesk Backoffice</h1>
          {lastRefresh && <span style={styles.headerSub}>Mis a jour {fmtDate(lastRefresh.toISOString())} — auto-refresh 30s</span>}
        </div>
        <button onClick={() => fetchData(token)} style={styles.btnRefresh} disabled={loading}>
          {loading ? 'Chargement...' : 'Rafraichir'}
        </button>
      </header>

      {error && <p style={styles.error}>{error}</p>}

      {stats && (
        <>
          {/* KPI Cards */}
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Vue d'ensemble</h2>
            <div style={styles.kpiGrid}>
              <KpiCard label="Users" value={fmt(stats.users)} sub={`+${stats.signups_today} aujourd'hui / +${stats.signups_week} cette semaine`} color="#3B2416" />
              <KpiCard label="Talents" value={fmt(stats.talents)} color="#4A6741" />
              <KpiCard label="Organisations" value={fmt(stats.organizations)} color="#6B5E52" />
              <KpiCard label="Waitlist" value={fmt(stats.waitlist)} color="#A67C52" />
              <KpiCard label="Communautes" value={fmt(stats.communities)} color="#4A6741" />
              <KpiCard label="Opportunites" value={fmt(stats.opportunities)} color="#6B5E52" />
            </div>
          </section>

          {/* Copilot */}
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Copilot (IA)</h2>
            <div style={styles.kpiGrid}>
              <KpiCard label="Sessions" value={fmt(stats.copilot_sessions)} color="#3B2416" />
              <KpiCard label="Traces" value={fmt(stats.copilot_traces)} color="#6B5E52" />
              <KpiCard label="Tokens input" value={fmt(stats.tokens_input)} color="#4A6741" />
              <KpiCard label="Tokens output" value={fmt(stats.tokens_output)} color="#A67C52" />
              <KpiCard label="Tokens total" value={fmt(stats.tokens_total)} sub={`~${(stats.tokens_total * 0.003 / 1000).toFixed(2)} USD estime`} color="#3B2416" />
            </div>
          </section>

          {/* Recent Users */}
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Inscriptions recentes ({recentUsers.length})</h2>
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Nom</th>
                    <th style={styles.th}>Email / Tel</th>
                    <th style={styles.th}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentUsers.map(u => (
                    <tr key={u.id}>
                      <td style={styles.td}>{u.first_name || ''} {u.last_name || ''}</td>
                      <td style={styles.td}>{u.email || u.phone || '—'}</td>
                      <td style={styles.tdMuted}>{fmtDate(u.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Waitlist */}
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Waitlist ({fmt(stats.waitlist)})</h2>
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Type</th>
                    <th style={styles.th}>Pays</th>
                    <th style={styles.th}>Contact</th>
                    <th style={styles.th}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {waitlist.map(w => (
                    <tr key={w.id}>
                      <td style={styles.td}><span style={{...styles.badge, background: w.type === 'TALENT' ? '#E8EFE6' : '#F7F0E8', color: w.type === 'TALENT' ? '#4A6741' : '#A67C52'}}>{w.type}</span></td>
                      <td style={styles.td}>{w.country}</td>
                      <td style={styles.td}>{w.contact_value}</td>
                      <td style={styles.tdMuted}>{fmtDate(w.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div style={styles.kpiCard}>
      <span style={styles.kpiLabel}>{label}</span>
      <span style={{...styles.kpiValue, color}}>{value}</span>
      {sub && <span style={styles.kpiSub}>{sub}</span>}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  // Login
  loginPage: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAF9F7', fontFamily: "'Outfit', sans-serif" },
  loginCard: { background: '#fff', border: '1px solid #EBE8E4', borderRadius: 12, padding: '2.5rem', width: '100%', maxWidth: 380, textAlign: 'center' },
  loginTitle: { fontSize: '1.5rem', fontWeight: 700, color: '#1F1C18', marginBottom: 4 },
  loginSub: { fontSize: '0.875rem', color: '#918A7E', marginBottom: '1.5rem' },
  loginForm: { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  input: { padding: '0.75rem', border: '1px solid #EBE8E4', borderRadius: 8, fontSize: '0.875rem', fontFamily: "'Outfit', sans-serif", outline: 'none' },
  btnPrimary: { padding: '0.75rem', background: '#3B2416', color: '#fff', border: 'none', borderRadius: 8, fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', fontFamily: "'Outfit', sans-serif" },
  error: { color: '#8B4A3C', fontSize: '0.8rem', marginTop: '0.75rem' },

  // Dashboard
  page: { minHeight: '100vh', background: '#FAF9F7', fontFamily: "'Outfit', sans-serif", padding: '0 1.5rem 3rem' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem 0', borderBottom: '1px solid #EBE8E4', marginBottom: '2rem' },
  headerTitle: { fontSize: '1.25rem', fontWeight: 700, color: '#1F1C18', margin: 0 },
  headerSub: { fontSize: '0.75rem', color: '#918A7E' },
  btnRefresh: { padding: '0.5rem 1rem', background: '#3B2416', color: '#fff', border: 'none', borderRadius: 8, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', fontFamily: "'Outfit', sans-serif" },

  // Sections
  section: { marginBottom: '2.5rem' },
  sectionTitle: { fontSize: '1rem', fontWeight: 600, color: '#4D4840', marginBottom: '1rem', textTransform: 'uppercase' as const, letterSpacing: '0.025em' },

  // KPI
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' },
  kpiCard: { background: '#fff', border: '1px solid #EBE8E4', borderRadius: 12, padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: 4 },
  kpiLabel: { fontSize: '0.75rem', fontWeight: 500, color: '#918A7E', textTransform: 'uppercase' as const, letterSpacing: '0.03em' },
  kpiValue: { fontSize: '2rem', fontWeight: 700, lineHeight: 1.1 },
  kpiSub: { fontSize: '0.7rem', color: '#918A7E', marginTop: 2 },

  // Tables
  tableWrap: { overflowX: 'auto' as const, background: '#fff', border: '1px solid #EBE8E4', borderRadius: 12 },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '0.85rem' },
  th: { textAlign: 'left' as const, padding: '0.75rem 1rem', fontWeight: 600, color: '#6E675C', borderBottom: '1px solid #EBE8E4', fontSize: '0.75rem', textTransform: 'uppercase' as const, letterSpacing: '0.03em' },
  td: { padding: '0.625rem 1rem', borderBottom: '1px solid #F5F3F0', color: '#1F1C18' },
  tdMuted: { padding: '0.625rem 1rem', borderBottom: '1px solid #F5F3F0', color: '#918A7E', fontSize: '0.8rem' },
  badge: { display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 600 },
};
