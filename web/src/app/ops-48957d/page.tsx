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
  const [dark, setDark] = useState(true);
  const t = theme(dark);

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
      <div style={t.loginWrap}>
        <form onSubmit={e => { e.preventDefault(); refresh(); }} style={t.loginCard}>
          <div style={t.loginLogo}>E</div>
          <h1 style={t.loginTitle}>Etudesk</h1>
          <p style={t.loginSub}>Backoffice</p>
          <input type="password" value={token} onChange={e => setToken(e.target.value)} placeholder="Token d'acces" style={t.input} autoFocus />
          <button type="submit" style={t.btn} disabled={loading}>{loading ? '...' : 'Acceder'}</button>
          {error && <p style={t.err}>{error}</p>}
        </form>
      </div>
    );
  }

  // ─── Dashboard ───
  const d = stats;

  return (
    <div style={t.shell}>
      {/* Sidebar */}
      <aside style={{ ...t.sidebar, width: sidebarOpen ? 220 : 56 }}>
        <div style={t.sidebarHead}>
          {sidebarOpen && <span style={t.sidebarLogo}>Etudesk</span>}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={t.sidebarToggle}>{sidebarOpen ? '◀' : '▶'}</button>
        </div>
        <nav style={t.nav}>
          {NAV.map(n => (
            <button key={n.key} onClick={() => setPage(n.key)} style={{ ...t.navItem, ...(page === n.key ? S.navActive : {}) }}>
              <span style={t.navIcon}>{n.icon}</span>
              {sidebarOpen && <span>{n.label}</span>}
            </button>
          ))}
        </nav>
        <div style={t.sidebarFoot}>
          <button onClick={logout} style={t.navItem}>
            <span style={t.navIcon}>⏻</span>
            {sidebarOpen && <span>Deconnexion</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={t.main}>
        {/* Header */}
        <header style={t.header}>
          <div>
            <h1 style={t.pageTitle}>{NAV.find(n => n.key === page)?.label}</h1>
            {lastRefresh && <span style={t.meta}>Mis a jour {fmtDate(lastRefresh.toISOString())}</span>}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => setDark(!dark)} style={t.themeBtn}>{dark ? '☀' : '☾'}</button>
            <button onClick={refresh} style={t.btnSm} disabled={loading}>{loading ? '...' : 'Rafraichir'}</button>
          </div>
        </header>

        {error && <p style={t.err}>{error}</p>}

        {/* ── DASHBOARD ── */}
        {page === 'dashboard' && d && (
          <div style={t.content}>
            <div style={t.grid6}>
              <Kpi s={t} label="Users" value={fmt(d.users.total)} sub={`+${d.users.signups_today} auj.`} accent="#3B2416" />
              <Kpi s={t} label="Talents" value={fmt(d.users.talents)} accent="#4A6741" />
              <Kpi s={t} label="Organisations" value={fmt(d.users.organizations)} accent="#6B5E52" />
              <Kpi s={t} label="Communautes" value={fmt(d.content.communities)} accent="#A67C52" />
              <Kpi s={t} label="Opportunites" value={fmt(d.content.opportunities)} accent="#4A6741" />
              <Kpi s={t} label="Short Links" value={fmt(d.short_links.total_links)} sub={`${fmt(d.short_links.total_clicks)} clics`} accent="#6B5E52" />
            </div>
            <h2 style={t.sectionTitle}>Copilot</h2>
            <div style={t.grid5}>
              <Kpi s={t} label="Sessions" value={fmt(d.copilot.total_sessions)} accent="#3B2416" />
              <Kpi s={t} label="Traces" value={fmt(d.copilot.total_traces)} accent="#6B5E52" />
              <Kpi s={t} label="Input tokens" value={fmt(d.copilot.total_input_tokens)} accent="#4A6741" />
              <Kpi s={t} label="Output tokens" value={fmt(d.copilot.total_output_tokens)} accent="#A67C52" />
              <Kpi s={t} label="Total tokens" value={fmt(d.copilot.total_tokens)} sub={`~$${(d.copilot.total_tokens * 0.003 / 1000).toFixed(2)}`} accent="#3B2416" />
            </div>
          </div>
        )}

        {/* ── USERS ── */}
        {page === 'users' && (
          <div style={t.content}>
            <div style={t.grid3}>
              <Kpi s={t} label="Total" value={fmt(d?.users.total || 0)} accent="#3B2416" />
              <Kpi s={t} label="Aujourd'hui" value={fmt(d?.users.signups_today || 0)} accent="#4A6741" />
              <Kpi s={t} label="Cette semaine" value={fmt(d?.users.signups_this_week || 0)} accent="#A67C52" />
            </div>
            <Table s={t}
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
          <div style={t.content}>
            <Kpi s={t} label="Total organisations" value={fmt(d?.users.organizations || 0)} accent="#6B5E52" />
            <div style={{ marginTop: 24 }}>
              <Table
                cols={['Nom', 'Secteurs', 'Pays', 'Membres', 'Date']}
                rows={orgs.map(o => [
                  o.name || '—',
                  Array.isArray(o.sectors) ? o.sectors.join(', ') : (o.sectors || '—'),
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
          <div style={t.content}>
            <div style={t.grid5}>
              <Kpi s={t} label="Sessions" value={fmt(d?.copilot.total_sessions || 0)} accent="#3B2416" />
              <Kpi s={t} label="Traces" value={fmt(d?.copilot.total_traces || 0)} accent="#6B5E52" />
              <Kpi s={t} label="Input" value={fmt(d?.copilot.total_input_tokens || 0)} accent="#4A6741" />
              <Kpi s={t} label="Output" value={fmt(d?.copilot.total_output_tokens || 0)} accent="#A67C52" />
              <Kpi s={t} label="Total" value={fmt(d?.copilot.total_tokens || 0)} sub={`~$${((d?.copilot.total_tokens || 0) * 0.003 / 1000).toFixed(2)}`} accent="#3B2416" />
            </div>
            <h2 style={t.sectionTitle}>Usage quotidien (30j)</h2>
            <Table s={t}
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
          <div style={t.content}>
            <div style={t.grid2}>
              <Kpi s={t} label="Liens" value={fmt(d?.short_links.total_links || 0)} accent="#3B2416" />
              <Kpi s={t} label="Clics totaux" value={fmt(d?.short_links.total_clicks || 0)} accent="#4A6741" />
            </div>

            {/* Create form */}
            <div style={t.formCard}>
              <h3 style={t.formTitle}>Nouveau lien</h3>
              <div style={t.formRow}>
                <input style={t.formInput} placeholder="Slug (optionnel)" value={linkForm.slug} onChange={e => setLinkForm(p => ({ ...p, slug: e.target.value }))} />
                <input style={{ ...t.formInput, flex: 2 }} placeholder="URL de destination *" value={linkForm.target_url} onChange={e => setLinkForm(p => ({ ...p, target_url: e.target.value }))} />
                <input style={t.formInput} placeholder="Label" value={linkForm.label} onChange={e => setLinkForm(p => ({ ...p, label: e.target.value }))} />
                <button style={t.btnSm} onClick={createLink}>Creer</button>
              </div>
            </div>

            {/* Links list */}
            <div style={t.tableWrap}>
              <table style={t.table}>
                <thead>
                  <tr>
                    <th style={t.th}>Slug</th>
                    <th style={t.th}>Destination</th>
                    <th style={t.th}>Label</th>
                    <th style={t.th}>Clics</th>
                    <th style={t.th}>Actif</th>
                    <th style={t.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {links.length === 0 ? (
                    <tr><td colSpan={6} style={{ ...t.td, textAlign: 'center', color: '#918A7E' }}>Aucun lien</td></tr>
                  ) : links.map(l => editingLink === l.id ? (
                    <tr key={l.id} style={{ background: '#FAF9F7' }}>
                      <td style={t.td}><input style={t.cellInput} value={editForm.slug} onChange={e => setEditForm(p => ({ ...p, slug: e.target.value }))} /></td>
                      <td style={t.td}><input style={{ ...t.cellInput, width: '100%' }} value={editForm.target_url} onChange={e => setEditForm(p => ({ ...p, target_url: e.target.value }))} /></td>
                      <td style={t.td}><input style={t.cellInput} value={editForm.label} onChange={e => setEditForm(p => ({ ...p, label: e.target.value }))} /></td>
                      <td style={t.tdMuted}>{l.total_clicks || l.clicks || 0}</td>
                      <td style={t.td}>{l.is_active ? 'Oui' : 'Non'}</td>
                      <td style={t.td}>
                        <span style={t.actions}>
                          <button style={t.actBtn} onClick={() => updateLink(l.id)}>Sauver</button>
                          <button style={t.actBtnMuted} onClick={() => setEditingLink(null)}>Annuler</button>
                        </span>
                      </td>
                    </tr>
                  ) : (
                    <tr key={l.id}>
                      <td style={t.td}>
                        <code style={{ ...t.code, cursor: 'pointer' }} onClick={() => { navigator.clipboard.writeText(`https://etudesk.com/link/${l.slug}`); setCopiedSlug(l.id); setTimeout(() => setCopiedSlug(null), 1500); }}>
                          {copiedSlug === l.id ? 'Copie !' : `/link/${l.slug}`}
                        </code>
                      </td>
                      <td style={t.td} title={l.target_url}>{(l.target_url || '').substring(0, 45)}{(l.target_url || '').length > 45 ? '...' : ''}</td>
                      <td style={t.td}>{l.label || '—'}</td>
                      <td style={t.td}>{fmt(l.total_clicks || l.clicks || 0)}</td>
                      <td style={t.td}>
                        <button style={{ ...t.toggleBtn, background: l.is_active ? '#E8EFE6' : '#F5EBE8', color: l.is_active ? '#4A6741' : '#8B4A3C' }} onClick={() => toggleLink(l.id, l.is_active)}>
                          {l.is_active ? 'Actif' : 'Inactif'}
                        </button>
                      </td>
                      <td style={t.td}>
                        <span style={t.actions}>
                          <button style={t.actBtn} onClick={() => startEdit(l)}>Modifier</button>
                          <button style={t.actBtnDanger} onClick={() => { if (confirm(`Supprimer /link/${l.slug} ?`)) deleteLink(l.id); }}>Supprimer</button>
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
          <div style={t.content}>
            <div style={t.logHeader}>
              <span style={t.logLabel}>Erreurs backend (80 dernieres lignes)</span>
              <button style={t.logCopy} onClick={() => { navigator.clipboard.writeText(logs); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
                {copied ? 'Copie !' : 'Copier'}
              </button>
            </div>
            <pre style={t.logBlock}>{logs || 'Aucun log disponible'}</pre>
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Components ───
function Kpi({ label, value, sub, accent, s }: { label: string; value: string; sub?: string; accent: string; s: Record<string, React.CSSProperties> }) {
  return (
    <div style={s.kpi}>
      <span style={s.kpiLabel}>{label}</span>
      <span style={{ ...s.kpiValue, color: accent }}>{value}</span>
      {sub && <span style={s.kpiSub}>{sub}</span>}
    </div>
  );
}

function Table({ cols, rows, s }: { cols: string[]; rows: string[][]; s: Record<string, React.CSSProperties> }) {
  return (
    <div style={s.tableWrap}>
      <table style={s.table}>
        <thead><tr>{cols.map((c, i) => <th key={i} style={s.th}>{c}</th>)}</tr></thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={cols.length} style={{ ...s.td, textAlign: 'center', color: '#918A7E' }}>Aucune donnée</td></tr>
          ) : (
            rows.map((row, i) => (
              <tr key={i} style={i % 2 === 0 ? {} : s.rowAlt}>
                {row.map((cell, j) => <td key={j} style={j === cols.length - 1 ? s.tdMuted : s.td}>{cell}</td>)}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── Theme ───
function theme(dark: boolean): Record<string, React.CSSProperties> {
  const bg = dark ? '#0F0F0F' : '#F5F3F0';
  const card = dark ? '#1A1A1A' : '#FFFFFF';
  const border = dark ? '#2A2A2A' : '#EBE8E4';
  const borderSoft = dark ? '#222' : '#F5F3F0';
  const text = dark ? '#E8E6E3' : '#1F1C18';
  const textMuted = dark ? '#888' : '#918A7E';
  const textDim = dark ? '#666' : '#B8B2A8';
  const sidebarBg = dark ? '#141414' : '#1F1C18';
  const sidebarBorder = dark ? '#222' : '#332F2A';
  const sidebarHover = dark ? '#1E1E1E' : '#332F2A';
  const inputBg = dark ? '#141414' : '#FAF9F7';
  const accent = '#3B2416';
  const accentBtn = dark ? '#5C3D2E' : '#3B2416';
  const rowAlt = dark ? '#151515' : '#FAF9F7';
  const codeBg = dark ? '#222' : '#F5F3F0';
  const f = "'Outfit', sans-serif";
  const mono = "'SF Mono', 'Fira Code', monospace";

  return {
    // Login
    loginWrap: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg, fontFamily: f },
    loginCard: { background: card, border: `1px solid ${border}`, borderRadius: 16, padding: '3rem 2.5rem', width: '100%', maxWidth: 360, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12 },
    loginLogo: { width: 48, height: 48, borderRadius: 12, background: accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, margin: '0 auto 4px' },
    loginTitle: { fontSize: '1.25rem', fontWeight: 700, color: text, margin: 0 },
    loginSub: { fontSize: '0.8rem', color: textMuted, margin: 0 },
    input: { padding: '0.7rem 0.9rem', border: `1px solid ${border}`, borderRadius: 8, fontSize: '0.85rem', fontFamily: f, outline: 'none', width: '100%', boxSizing: 'border-box', background: inputBg, color: text },
    btn: { padding: '0.7rem', background: accentBtn, color: '#fff', border: 'none', borderRadius: 8, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', fontFamily: f },
    btnSm: { padding: '0.45rem 1rem', background: accentBtn, color: '#fff', border: 'none', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', fontFamily: f },
    themeBtn: { padding: '0.4rem 0.6rem', background: 'none', border: `1px solid ${border}`, borderRadius: 6, fontSize: '0.85rem', cursor: 'pointer', color: textMuted },
    err: { color: '#e55', fontSize: '0.8rem', margin: 0 },

    // Shell
    shell: { display: 'flex', minHeight: '100vh', fontFamily: f, background: bg },

    // Sidebar
    sidebar: { background: sidebarBg, color: '#D9D5CF', display: 'flex', flexDirection: 'column', transition: 'width 0.2s', overflow: 'hidden', flexShrink: 0 },
    sidebarHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 0.75rem 1rem', borderBottom: `1px solid ${sidebarBorder}` },
    sidebarLogo: { fontSize: '1rem', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' },
    sidebarToggle: { background: 'none', border: 'none', color: '#918A7E', cursor: 'pointer', fontSize: '0.7rem', padding: 4 },
    nav: { flex: 1, display: 'flex', flexDirection: 'column', gap: 2, padding: '0.75rem 0.5rem' },
    navItem: { display: 'flex', alignItems: 'center', gap: 10, padding: '0.55rem 0.65rem', borderRadius: 6, background: 'none', border: 'none', color: '#B8B2A8', fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer', fontFamily: f, textAlign: 'left', whiteSpace: 'nowrap', transition: 'all 0.15s' },
    navActive: { background: sidebarHover, color: '#fff' },
    navIcon: { fontSize: '0.9rem', width: 20, textAlign: 'center', flexShrink: 0 },
    sidebarFoot: { padding: '0.5rem', borderTop: `1px solid ${sidebarBorder}` },

    // Main
    main: { flex: 1, overflow: 'auto', padding: '0 2rem 3rem' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem 0 1.25rem', borderBottom: `1px solid ${border}`, marginBottom: '1.5rem' },
    pageTitle: { fontSize: '1.1rem', fontWeight: 700, color: text, margin: 0 },
    meta: { fontSize: '0.7rem', color: textMuted },
    content: { },

    // Grids
    grid6: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 24 },
    grid5: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, marginBottom: 24 },
    grid3: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 24 },
    grid2: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 24 },
    sectionTitle: { fontSize: '0.8rem', fontWeight: 600, color: textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', margin: '24px 0 12px' },

    // KPI
    kpi: { background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '1rem 1.1rem', display: 'flex', flexDirection: 'column', gap: 2 },
    kpiLabel: { fontSize: '0.65rem', fontWeight: 600, color: textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' },
    kpiValue: { fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.1 },
    kpiSub: { fontSize: '0.65rem', color: textMuted },

    // Table
    tableWrap: { overflowX: 'auto', background: card, border: `1px solid ${border}`, borderRadius: 10 },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' },
    th: { textAlign: 'left', padding: '0.6rem 0.9rem', fontWeight: 600, color: textMuted, borderBottom: `1px solid ${border}`, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.03em' },
    td: { padding: '0.55rem 0.9rem', borderBottom: `1px solid ${borderSoft}`, color: text },
    tdMuted: { padding: '0.55rem 0.9rem', borderBottom: `1px solid ${borderSoft}`, color: textMuted, fontSize: '0.75rem' },
    rowAlt: { background: rowAlt },

    // Forms
    formCard: { background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '1rem 1.1rem', marginBottom: 16 },
    formTitle: { fontSize: '0.75rem', fontWeight: 600, color: textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 10px' },
    formRow: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
    formInput: { flex: 1, minWidth: 120, padding: '0.5rem 0.7rem', border: `1px solid ${border}`, borderRadius: 6, fontSize: '0.8rem', fontFamily: f, outline: 'none', background: inputBg, color: text },
    cellInput: { padding: '0.35rem 0.5rem', border: `1px solid ${dark ? '#444' : '#D9D5CF'}`, borderRadius: 4, fontSize: '0.8rem', fontFamily: f, outline: 'none', width: 100, background: inputBg, color: text },

    // Actions
    actions: { display: 'flex', gap: 6 },
    actBtn: { padding: '3px 8px', background: accentBtn, color: '#fff', border: 'none', borderRadius: 4, fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer', fontFamily: f },
    actBtnMuted: { padding: '3px 8px', background: dark ? '#2A2A2A' : '#EBE8E4', color: textMuted, border: 'none', borderRadius: 4, fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer', fontFamily: f },
    actBtnDanger: { padding: '3px 8px', background: dark ? '#3a1a1a' : '#F5EBE8', color: dark ? '#f77' : '#8B4A3C', border: 'none', borderRadius: 4, fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer', fontFamily: f },
    toggleBtn: { padding: '2px 8px', border: 'none', borderRadius: 4, fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer', fontFamily: f },
    code: { fontSize: '0.75rem', background: codeBg, color: text, padding: '2px 6px', borderRadius: 3, fontFamily: mono },

    // Misc
    empty: { color: textMuted, fontSize: '0.85rem', textAlign: 'center', padding: '2rem 0' },
    logHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    logLabel: { fontSize: '0.75rem', fontWeight: 600, color: textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' },
    logCopy: { padding: '4px 12px', background: accentBtn, color: '#fff', border: 'none', borderRadius: 5, fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer', fontFamily: f },
    logBlock: { background: dark ? '#111' : '#1F1C18', color: '#D9D5CF', padding: '1.25rem', borderRadius: 10, fontSize: '0.7rem', lineHeight: 1.6, overflow: 'auto', maxHeight: '70vh', whiteSpace: 'pre-wrap', fontFamily: mono, margin: 0 },
  };
}
