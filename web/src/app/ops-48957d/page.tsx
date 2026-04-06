'use client';

import React, { useState, useEffect, useCallback } from 'react';

export const dynamic = 'force-dynamic';

type Page = 'dashboard' | 'users' | 'orgs' | 'copilot' | 'links' | 'logs';

const NAV: { key: Page; label: string; icon: string }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: '▦' },
  { key: 'users', label: 'Users', icon: '◉' },
  { key: 'orgs', label: 'Organisations', icon: '◫' },
  { key: 'copilot', label: 'Usage IA', icon: '◈' },
  { key: 'links', label: 'Short Links', icon: '◊' },
  { key: 'logs', label: 'Logs', icon: '▤' },
];

// ─── Helpers ───
const fmt = (n: number) => n.toLocaleString('fr-FR');
const fmtDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const fmtDay = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });

// ─── Main ───
export default function BackofficePage() {
  const [token, setToken] = useState('');
  const [auth, setAuth] = useState(false);
  const [page, setPage] = useState<Page>('dashboard');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Data
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [copilotUsage, setCopilotUsage] = useState<any[]>([]);
  const [links, setLinks] = useState<any[]>([]);
  const [logs, setLogs] = useState('');

  // Link CRUD
  const [linkForm, setLinkForm] = useState({ slug: '', target_url: '', label: '' });
  const [editingLink, setEditingLink] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ slug: '', target_url: '', label: '' });
  const [copied, setCopied] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  const api = useCallback(async (path: string) => {
    const res = await fetch(`/api/v1/backoffice${path}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const data = await res.json();
    if (!data.success && res.status === 403) throw new Error('Acces refuse');
    return data;
  }, [token]);

  const apiMutate = useCallback(async (path: string, method: string, body?: any) => {
    const res = await fetch(`/api/v1/backoffice${path}`, {
      method,
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    return res.json();
  }, [token]);

  const createLink = async () => {
    if (!linkForm.target_url) return;
    const r = await apiMutate('/short-links', 'POST', linkForm);
    if (r.success) {
      setLinks(prev => [r.data, ...prev]);
      setLinkForm({ slug: '', target_url: '', label: '' });
    } else {
      setError(r.error || 'Erreur creation');
    }
  };

  const updateLink = async (id: string) => {
    const r = await apiMutate(`/short-links/${id}`, 'PATCH', editForm);
    if (r.success) {
      setLinks(prev => prev.map(l => l.id === id ? { ...l, ...r.data } : l));
      setEditingLink(null);
    } else {
      setError(r.error || 'Erreur modification');
    }
  };

  const deleteLink = async (id: string) => {
    const r = await apiMutate(`/short-links/${id}`, 'DELETE');
    if (r.success) setLinks(prev => prev.filter(l => l.id !== id));
  };

  const toggleLink = async (id: string, active: boolean) => {
    const r = await apiMutate(`/short-links/${id}`, 'PATCH', { is_active: !active });
    if (r.success) setLinks(prev => prev.map(l => l.id === id ? { ...l, is_active: !active } : l));
  };

  const startEdit = (l: any) => {
    setEditingLink(l.id);
    setEditForm({ slug: l.slug, target_url: l.target_url, label: l.label || '' });
  };

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [s, u, o, c, l, lg] = await Promise.all([
        api('/stats'),
        api('/users?limit=50'),
        api('/organizations'),
        api('/copilot/usage?days=30'),
        api('/short-links'),
        api('/logs?lines=80'),
      ]);
      setStats(s.data);
      setUsers(u.data || []);
      setOrgs(o.data || []);
      setCopilotUsage(c.data || []);
      setLinks(l.data || []);
      setLogs(lg.data || '');
      setLastRefresh(new Date());
      setAuth(true);
    } catch (e: any) {
      setError(e.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (!auth) return;
    const t = setInterval(refresh, 30000);
    return () => clearInterval(t);
  }, [auth, refresh]);

  const logout = () => { setAuth(false); setToken(''); setStats(null); };

  // ─── Login ───
  if (!auth) {
    return (
      <div style={S.loginWrap}>
        <form onSubmit={e => { e.preventDefault(); refresh(); }} style={S.loginCard}>
          <div style={S.loginLogo}>E</div>
          <h1 style={S.loginTitle}>Etudesk</h1>
          <p style={S.loginSub}>Backoffice</p>
          <input type="password" value={token} onChange={e => setToken(e.target.value)} placeholder="Token d'acces" style={S.input} autoFocus />
          <button type="submit" style={S.btn} disabled={loading}>{loading ? '...' : 'Acceder'}</button>
          {error && <p style={S.err}>{error}</p>}
        </form>
      </div>
    );
  }

  // ─── Dashboard ───
  const d = stats;

  return (
    <div style={S.shell}>
      {/* Sidebar */}
      <aside style={{ ...S.sidebar, width: sidebarOpen ? 220 : 56 }}>
        <div style={S.sidebarHead}>
          {sidebarOpen && <span style={S.sidebarLogo}>Etudesk</span>}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={S.sidebarToggle}>{sidebarOpen ? '◀' : '▶'}</button>
        </div>
        <nav style={S.nav}>
          {NAV.map(n => (
            <button key={n.key} onClick={() => setPage(n.key)} style={{ ...S.navItem, ...(page === n.key ? S.navActive : {}) }}>
              <span style={S.navIcon}>{n.icon}</span>
              {sidebarOpen && <span>{n.label}</span>}
            </button>
          ))}
        </nav>
        <div style={S.sidebarFoot}>
          <button onClick={logout} style={S.navItem}>
            <span style={S.navIcon}>⏻</span>
            {sidebarOpen && <span>Deconnexion</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={S.main}>
        {/* Header */}
        <header style={S.header}>
          <div>
            <h1 style={S.pageTitle}>{NAV.find(n => n.key === page)?.label}</h1>
            {lastRefresh && <span style={S.meta}>Mis a jour {fmtDate(lastRefresh.toISOString())}</span>}
          </div>
          <button onClick={refresh} style={S.btnSm} disabled={loading}>{loading ? '...' : 'Rafraichir'}</button>
        </header>

        {error && <p style={S.err}>{error}</p>}

        {/* ── DASHBOARD ── */}
        {page === 'dashboard' && d && (
          <div style={S.content}>
            <div style={S.grid6}>
              <Kpi label="Users" value={fmt(d.users.total)} sub={`+${d.users.signups_today} auj.`} accent="#3B2416" />
              <Kpi label="Talents" value={fmt(d.users.talents)} accent="#4A6741" />
              <Kpi label="Organisations" value={fmt(d.users.organizations)} accent="#6B5E52" />
              <Kpi label="Communautes" value={fmt(d.content.communities)} accent="#A67C52" />
              <Kpi label="Opportunites" value={fmt(d.content.opportunities)} accent="#4A6741" />
              <Kpi label="Short Links" value={fmt(d.short_links.total_links)} sub={`${fmt(d.short_links.total_clicks)} clics`} accent="#6B5E52" />
            </div>
            <h2 style={S.sectionTitle}>Copilot</h2>
            <div style={S.grid5}>
              <Kpi label="Sessions" value={fmt(d.copilot.total_sessions)} accent="#3B2416" />
              <Kpi label="Traces" value={fmt(d.copilot.total_traces)} accent="#6B5E52" />
              <Kpi label="Input tokens" value={fmt(d.copilot.total_input_tokens)} accent="#4A6741" />
              <Kpi label="Output tokens" value={fmt(d.copilot.total_output_tokens)} accent="#A67C52" />
              <Kpi label="Total tokens" value={fmt(d.copilot.total_tokens)} sub={`~$${(d.copilot.total_tokens * 0.003 / 1000).toFixed(2)}`} accent="#3B2416" />
            </div>
          </div>
        )}

        {/* ── USERS ── */}
        {page === 'users' && (
          <div style={S.content}>
            <div style={S.grid3}>
              <Kpi label="Total" value={fmt(d?.users.total || 0)} accent="#3B2416" />
              <Kpi label="Aujourd'hui" value={fmt(d?.users.signups_today || 0)} accent="#4A6741" />
              <Kpi label="Cette semaine" value={fmt(d?.users.signups_this_week || 0)} accent="#A67C52" />
            </div>
            <Table
              cols={['Nom', 'Contact', 'Inscription']}
              rows={users.map(u => [
                `${u.first_name || ''} ${u.last_name || ''}`.trim() || '—',
                u.email || u.phone || '—',
                fmtDate(u.created_at),
              ])}
            />
          </div>
        )}

        {/* ── ORGS ── */}
        {page === 'orgs' && (
          <div style={S.content}>
            <Kpi label="Total organisations" value={fmt(d?.users.organizations || 0)} accent="#6B5E52" />
            <div style={{ marginTop: 24 }}>
              <Table
                cols={['Nom', 'Secteur', 'Pays', 'Membres', 'Date']}
                rows={orgs.map(o => [
                  o.name || '—',
                  o.industry || '—',
                  o.country || '—',
                  String(o.member_count || 0),
                  fmtDate(o.created_at),
                ])}
              />
            </div>
          </div>
        )}

        {/* ── COPILOT ── */}
        {page === 'copilot' && (
          <div style={S.content}>
            <div style={S.grid5}>
              <Kpi label="Sessions" value={fmt(d?.copilot.total_sessions || 0)} accent="#3B2416" />
              <Kpi label="Traces" value={fmt(d?.copilot.total_traces || 0)} accent="#6B5E52" />
              <Kpi label="Input" value={fmt(d?.copilot.total_input_tokens || 0)} accent="#4A6741" />
              <Kpi label="Output" value={fmt(d?.copilot.total_output_tokens || 0)} accent="#A67C52" />
              <Kpi label="Total" value={fmt(d?.copilot.total_tokens || 0)} sub={`~$${((d?.copilot.total_tokens || 0) * 0.003 / 1000).toFixed(2)}`} accent="#3B2416" />
            </div>
            <h2 style={S.sectionTitle}>Usage quotidien (30j)</h2>
            <Table
              cols={['Jour', 'Sessions', 'Traces', 'Input', 'Output', 'Total']}
              rows={copilotUsage.map(r => [
                fmtDay(r.day),
                String(r.sessions),
                String(r.traces),
                fmt(parseInt(r.input_tokens)),
                fmt(parseInt(r.output_tokens)),
                fmt(parseInt(r.total_tokens)),
              ])}
            />
          </div>
        )}

        {/* ── SHORT LINKS ── */}
        {page === 'links' && (
          <div style={S.content}>
            <div style={S.grid2}>
              <Kpi label="Liens" value={fmt(d?.short_links.total_links || 0)} accent="#3B2416" />
              <Kpi label="Clics totaux" value={fmt(d?.short_links.total_clicks || 0)} accent="#4A6741" />
            </div>

            {/* Create form */}
            <div style={S.formCard}>
              <h3 style={S.formTitle}>Nouveau lien</h3>
              <div style={S.formRow}>
                <input style={S.formInput} placeholder="Slug (optionnel)" value={linkForm.slug} onChange={e => setLinkForm(p => ({ ...p, slug: e.target.value }))} />
                <input style={{ ...S.formInput, flex: 2 }} placeholder="URL de destination *" value={linkForm.target_url} onChange={e => setLinkForm(p => ({ ...p, target_url: e.target.value }))} />
                <input style={S.formInput} placeholder="Label" value={linkForm.label} onChange={e => setLinkForm(p => ({ ...p, label: e.target.value }))} />
                <button style={S.btnSm} onClick={createLink}>Creer</button>
              </div>
            </div>

            {/* Links list */}
            <div style={S.tableWrap}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>Slug</th>
                    <th style={S.th}>Destination</th>
                    <th style={S.th}>Label</th>
                    <th style={S.th}>Clics</th>
                    <th style={S.th}>Actif</th>
                    <th style={S.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {links.length === 0 ? (
                    <tr><td colSpan={6} style={{ ...S.td, textAlign: 'center', color: '#918A7E' }}>Aucun lien</td></tr>
                  ) : links.map(l => editingLink === l.id ? (
                    <tr key={l.id} style={{ background: '#FAF9F7' }}>
                      <td style={S.td}><input style={S.cellInput} value={editForm.slug} onChange={e => setEditForm(p => ({ ...p, slug: e.target.value }))} /></td>
                      <td style={S.td}><input style={{ ...S.cellInput, width: '100%' }} value={editForm.target_url} onChange={e => setEditForm(p => ({ ...p, target_url: e.target.value }))} /></td>
                      <td style={S.td}><input style={S.cellInput} value={editForm.label} onChange={e => setEditForm(p => ({ ...p, label: e.target.value }))} /></td>
                      <td style={S.tdMuted}>{l.total_clicks || l.clicks || 0}</td>
                      <td style={S.td}>{l.is_active ? 'Oui' : 'Non'}</td>
                      <td style={S.td}>
                        <span style={S.actions}>
                          <button style={S.actBtn} onClick={() => updateLink(l.id)}>Sauver</button>
                          <button style={S.actBtnMuted} onClick={() => setEditingLink(null)}>Annuler</button>
                        </span>
                      </td>
                    </tr>
                  ) : (
                    <tr key={l.id}>
                      <td style={S.td}>
                        <code style={{ ...S.code, cursor: 'pointer' }} onClick={() => { navigator.clipboard.writeText(`https://etudesk.com/link/${l.slug}`); setCopiedSlug(l.id); setTimeout(() => setCopiedSlug(null), 1500); }}>
                          {copiedSlug === l.id ? 'Copie !' : `/link/${l.slug}`}
                        </code>
                      </td>
                      <td style={S.td} title={l.target_url}>{(l.target_url || '').substring(0, 45)}{(l.target_url || '').length > 45 ? '...' : ''}</td>
                      <td style={S.td}>{l.label || '—'}</td>
                      <td style={S.td}>{fmt(l.total_clicks || l.clicks || 0)}</td>
                      <td style={S.td}>
                        <button style={{ ...S.toggleBtn, background: l.is_active ? '#E8EFE6' : '#F5EBE8', color: l.is_active ? '#4A6741' : '#8B4A3C' }} onClick={() => toggleLink(l.id, l.is_active)}>
                          {l.is_active ? 'Actif' : 'Inactif'}
                        </button>
                      </td>
                      <td style={S.td}>
                        <span style={S.actions}>
                          <button style={S.actBtn} onClick={() => startEdit(l)}>Modifier</button>
                          <button style={S.actBtnDanger} onClick={() => { if (confirm(`Supprimer /link/${l.slug} ?`)) deleteLink(l.id); }}>Supprimer</button>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── LOGS ── */}
        {page === 'logs' && (
          <div style={S.content}>
            <div style={S.logHeader}>
              <span style={S.logLabel}>Erreurs backend (80 dernieres lignes)</span>
              <button style={S.logCopy} onClick={() => { navigator.clipboard.writeText(logs); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
                {copied ? 'Copie !' : 'Copier'}
              </button>
            </div>
            <pre style={S.logBlock}>{logs || 'Aucun log disponible'}</pre>
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Components ───
function Kpi({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent: string }) {
  return (
    <div style={S.kpi}>
      <span style={S.kpiLabel}>{label}</span>
      <span style={{ ...S.kpiValue, color: accent }}>{value}</span>
      {sub && <span style={S.kpiSub}>{sub}</span>}
    </div>
  );
}

function Table({ cols, rows }: { cols: string[]; rows: string[][] }) {
  return (
    <div style={S.tableWrap}>
      <table style={S.table}>
        <thead><tr>{cols.map((c, i) => <th key={i} style={S.th}>{c}</th>)}</tr></thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={cols.length} style={{ ...S.td, textAlign: 'center', color: '#918A7E' }}>Aucune donnee</td></tr>
          ) : (
            rows.map((row, i) => (
              <tr key={i} style={i % 2 === 0 ? {} : { background: '#FAF9F7' }}>
                {row.map((cell, j) => <td key={j} style={j === cols.length - 1 ? S.tdMuted : S.td}>{cell}</td>)}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── Styles ───
const S: Record<string, React.CSSProperties> = {
  // Login
  loginWrap: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F5F3F0', fontFamily: "'Outfit', sans-serif" },
  loginCard: { background: '#fff', border: '1px solid #EBE8E4', borderRadius: 16, padding: '3rem 2.5rem', width: '100%', maxWidth: 360, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12 },
  loginLogo: { width: 48, height: 48, borderRadius: 12, background: '#3B2416', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, margin: '0 auto 4px' },
  loginTitle: { fontSize: '1.25rem', fontWeight: 700, color: '#1F1C18', margin: 0 },
  loginSub: { fontSize: '0.8rem', color: '#918A7E', margin: 0 },
  input: { padding: '0.7rem 0.9rem', border: '1px solid #EBE8E4', borderRadius: 8, fontSize: '0.85rem', fontFamily: "'Outfit', sans-serif", outline: 'none', width: '100%', boxSizing: 'border-box' },
  btn: { padding: '0.7rem', background: '#3B2416', color: '#fff', border: 'none', borderRadius: 8, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', fontFamily: "'Outfit', sans-serif" },
  btnSm: { padding: '0.45rem 1rem', background: '#3B2416', color: '#fff', border: 'none', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', fontFamily: "'Outfit', sans-serif" },
  err: { color: '#8B4A3C', fontSize: '0.8rem', margin: 0 },

  // Shell
  shell: { display: 'flex', minHeight: '100vh', fontFamily: "'Outfit', sans-serif", background: '#F5F3F0' },

  // Sidebar
  sidebar: { background: '#1F1C18', color: '#D9D5CF', display: 'flex', flexDirection: 'column', transition: 'width 0.2s', overflow: 'hidden', flexShrink: 0 },
  sidebarHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 0.75rem 1rem', borderBottom: '1px solid #332F2A' },
  sidebarLogo: { fontSize: '1rem', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' },
  sidebarToggle: { background: 'none', border: 'none', color: '#918A7E', cursor: 'pointer', fontSize: '0.7rem', padding: 4 },
  nav: { flex: 1, display: 'flex', flexDirection: 'column', gap: 2, padding: '0.75rem 0.5rem' },
  navItem: { display: 'flex', alignItems: 'center', gap: 10, padding: '0.55rem 0.65rem', borderRadius: 6, background: 'none', border: 'none', color: '#B8B2A8', fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer', fontFamily: "'Outfit', sans-serif", textAlign: 'left', whiteSpace: 'nowrap', transition: 'all 0.15s' },
  navActive: { background: '#332F2A', color: '#fff' },
  navIcon: { fontSize: '0.9rem', width: 20, textAlign: 'center', flexShrink: 0 },
  sidebarFoot: { padding: '0.5rem', borderTop: '1px solid #332F2A' },

  // Main
  main: { flex: 1, overflow: 'auto', padding: '0 2rem 3rem' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem 0 1.25rem', borderBottom: '1px solid #EBE8E4', marginBottom: '1.5rem' },
  pageTitle: { fontSize: '1.1rem', fontWeight: 700, color: '#1F1C18', margin: 0 },
  meta: { fontSize: '0.7rem', color: '#918A7E' },
  content: { },

  // Grids
  grid6: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 24 },
  grid5: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, marginBottom: 24 },
  grid3: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 24 },
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 24 },
  sectionTitle: { fontSize: '0.8rem', fontWeight: 600, color: '#6E675C', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '24px 0 12px' },

  // KPI
  kpi: { background: '#fff', border: '1px solid #EBE8E4', borderRadius: 10, padding: '1rem 1.1rem', display: 'flex', flexDirection: 'column', gap: 2 },
  kpiLabel: { fontSize: '0.65rem', fontWeight: 600, color: '#918A7E', textTransform: 'uppercase', letterSpacing: '0.04em' },
  kpiValue: { fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.1 },
  kpiSub: { fontSize: '0.65rem', color: '#918A7E' },

  // Table
  tableWrap: { overflowX: 'auto', background: '#fff', border: '1px solid #EBE8E4', borderRadius: 10 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' },
  th: { textAlign: 'left', padding: '0.6rem 0.9rem', fontWeight: 600, color: '#6E675C', borderBottom: '1px solid #EBE8E4', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.03em' },
  td: { padding: '0.55rem 0.9rem', borderBottom: '1px solid #F5F3F0', color: '#1F1C18' },
  tdMuted: { padding: '0.55rem 0.9rem', borderBottom: '1px solid #F5F3F0', color: '#918A7E', fontSize: '0.75rem' },

  // Forms
  formCard: { background: '#fff', border: '1px solid #EBE8E4', borderRadius: 10, padding: '1rem 1.1rem', marginBottom: 16 },
  formTitle: { fontSize: '0.75rem', fontWeight: 600, color: '#6E675C', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 10px' },
  formRow: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  formInput: { flex: 1, minWidth: 120, padding: '0.5rem 0.7rem', border: '1px solid #EBE8E4', borderRadius: 6, fontSize: '0.8rem', fontFamily: "'Outfit', sans-serif", outline: 'none', background: '#FAF9F7' },
  cellInput: { padding: '0.35rem 0.5rem', border: '1px solid #D9D5CF', borderRadius: 4, fontSize: '0.8rem', fontFamily: "'Outfit', sans-serif", outline: 'none', width: 100 },

  // Actions
  actions: { display: 'flex', gap: 6 },
  actBtn: { padding: '3px 8px', background: '#3B2416', color: '#fff', border: 'none', borderRadius: 4, fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer', fontFamily: "'Outfit', sans-serif" },
  actBtnMuted: { padding: '3px 8px', background: '#EBE8E4', color: '#6E675C', border: 'none', borderRadius: 4, fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer', fontFamily: "'Outfit', sans-serif" },
  actBtnDanger: { padding: '3px 8px', background: '#F5EBE8', color: '#8B4A3C', border: 'none', borderRadius: 4, fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer', fontFamily: "'Outfit', sans-serif" },
  toggleBtn: { padding: '2px 8px', border: 'none', borderRadius: 4, fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer', fontFamily: "'Outfit', sans-serif" },
  code: { fontSize: '0.75rem', background: '#F5F3F0', padding: '2px 6px', borderRadius: 3, fontFamily: "'SF Mono', 'Fira Code', monospace" },

  // Misc
  empty: { color: '#918A7E', fontSize: '0.85rem', textAlign: 'center', padding: '2rem 0' },
  logHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  logLabel: { fontSize: '0.75rem', fontWeight: 600, color: '#6E675C', textTransform: 'uppercase', letterSpacing: '0.04em' },
  logCopy: { padding: '4px 12px', background: '#3B2416', color: '#fff', border: 'none', borderRadius: 5, fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer', fontFamily: "'Outfit', sans-serif" },
  logBlock: { background: '#1F1C18', color: '#D9D5CF', padding: '1.25rem', borderRadius: 10, fontSize: '0.7rem', lineHeight: 1.6, overflow: 'auto', maxHeight: '70vh', whiteSpace: 'pre-wrap', fontFamily: "'SF Mono', 'Fira Code', monospace", margin: 0 },
};
