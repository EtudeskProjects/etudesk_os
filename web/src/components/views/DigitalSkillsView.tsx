'use client';

import React, { useState, useMemo, useCallback, useContext } from 'react';
import dynamic from 'next/dynamic';
import { ExternalLink, Search, X } from 'lucide-react';
import SiteHeader from '@/components/SiteHeader';
import StoreButtons from '@/components/StoreButtons';
import { ThemeContext } from '@/contexts/ThemeContext';
import type { Lang } from '@/lib/i18n';
import {
  competencies, FAMILIES, FAMILY_MAP, FAMILY_COUNTS, FAMILY_HEX, TYPES, TYPE_MAP, TYPE_HEX, TYPE_COUNTS,
  type Competency, type FamilyKey, type CompetencyType,
} from '@/data/taxonomy';

const MAX_FAM = Math.max(...Object.values(FAMILY_COUNTS));
const MAX_TYPE = Math.max(...Object.values(TYPE_COUNTS));
const FAMILIES_SORTED = [...FAMILIES].sort((a, b) => FAMILY_COUNTS[b.key] - FAMILY_COUNTS[a.key]);
const TYPES_SORTED = [...TYPES].sort((a, b) => TYPE_COUNTS[b.key] - TYPE_COUNTS[a.key]);
import { getRelations, getDegree, resolve, SKILLS_BY_DEGREE, RELATION_COUNT } from '@/data/relations';
import { RELATION_COLORS } from '@/lib/relation-colors';
import { digitalSkillsCopy as copy } from '@/content/digital-skills';

const SkillsMap = dynamic(() => import('../../components/SkillsMap'), { ssr: false });

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');


const HUBS = SKILLS_BY_DEGREE.slice(0, 10);

export default function DigitalSkillsView({ lang }: { lang: Lang }) {
  const { isDark } = useContext(ThemeContext);
  const t = copy[lang];
  const [query, setQuery] = useState('');
  const [type, setType] = useState<CompetencyType | null>(null);
  const [family, setFamily] = useState<FamilyKey | null>(null);
  const [colorBy, setColorBy] = useState<'family' | 'type'>('family');
  const [selected, setSelected] = useState<string | null>(null);

  const label = useCallback((c: Competency) => (lang === 'fr' ? c.name_fr : c.name), [lang]);
  const description = useCallback((c: Competency) => (lang === 'fr' ? c.description_fr : c.description_en) || c.description_en || c.description_fr, [lang]);
  const q = norm(query.trim());
  const searching = q.length >= 2;

  const match = useCallback((c: Competency) => {
    if (type && c.type !== type) return false;
    if (family && c.family !== family) return false;
    if (searching && !(norm(c.name).includes(q) || norm(c.name_fr).includes(q))) return false;
    return true;
  }, [type, family, searching, q]);

  const filtering = !!(type || family || searching);
  const colorHex = (c: Competency) => (colorBy === 'family' ? FAMILY_HEX[c.family] : TYPE_HEX[c.type])[isDark ? 'dark' : 'light'];
  // Icone Lucide du TYPE de la competence, coloree (remplace les pastilles).
  const typeIcon = (c: Competency) => {
    const I = TYPE_MAP[c.type].Icon;
    return <span className="tic"><I size={15} strokeWidth={1.25} color={colorHex(c)} /></span>;
  };
  const relTone = (k: 'pre' | 'sib' | 'rel') => RELATION_COLORS[k][isDark ? 'dark' : 'light'];

  const sel = selected ? competencies.find((c) => c.slug === selected) || null : null;
  const relations = selected ? getRelations(selected) : null;

  // resultats de recherche (liste deroulante quand on cherche)
  const searchResults = useMemo(
    () => (searching ? competencies.filter(match).slice(0, 40) : []),
    [searching, match]
  );

  const relGroups = relations
    ? [
        { title: t.pre, slugs: relations.pre, tone: relTone('pre') },
        { title: t.leads, slugs: relations.leads, tone: relTone('pre') },
        { title: t.sib, slugs: relations.sib, tone: relTone('sib') },
        { title: t.rel, slugs: relations.rel, tone: relTone('rel') },
      ]
    : [];

  // Categorie active (famille ou type) : titre + liste triee par nombre de connexions
  const catTitle = family
    ? (lang === 'fr' ? FAMILY_MAP[family].fr : FAMILY_MAP[family].en)
    : type
    ? (lang === 'fr' ? TYPE_MAP[type].fr : TYPE_MAP[type].en)
    : '';
  const catList = useMemo(() => {
    if (!family && !type) return [];
    return competencies
      .filter((c) => (!family || c.family === family) && (!type || c.type === type))
      .map((c) => ({ c, deg: getDegree(c.slug) }))
      .sort((a, b) => b.deg - a.deg);
  }, [family, type]);

  return (
    <main className="obs">
      {/* Menu partage (identique a la landing) */}
      <SiteHeader />

      <div className="body">
        {/* Left: filters */}
        <aside className="left">
          <div className="search">
            <span className="si"><Search size={17} strokeWidth={1.25} /></span>
            <input value={query} onChange={(e) => { setQuery(e.target.value); }} placeholder={t.search} aria-label={t.search} />
            {query && <button className="clear" onClick={() => setQuery('')}><X size={15} strokeWidth={1.25} /></button>}
            {searching && searchResults.length > 0 && (
              <div className="sresults">
                {searchResults.map((c) => (
                  <button key={c.slug} onClick={() => { setSelected(c.slug); setQuery(''); }}>
                    {typeIcon(c)}
                    <span className="sr-name">{label(c)}</span>
                    <span className="sr-fam">{lang === 'fr' ? FAMILY_MAP[c.family].fr : FAMILY_MAP[c.family].en}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="cby">
            <div className="seg">
              <button className={colorBy === 'family' ? 'on' : ''} onClick={() => { setColorBy('family'); setType(null); }}>{t.family}</button>
              <button className={colorBy === 'type' ? 'on' : ''} onClick={() => { setColorBy('type'); setFamily(null); }}>{t.type}</button>
            </div>
          </div>

          {colorBy === 'family' ? (
            <div className="grp">
              <div className="grp-h"><span>{t.families} · {FAMILIES.length}</span>{family && <button className="reset" onClick={() => setFamily(null)}>{t.all}</button>}</div>
              <div className="list">
                {FAMILIES_SORTED.map((f) => (
                  <button key={f.key} className={`row ${family === f.key ? 'active' : ''} ${family && family !== f.key ? 'dim' : ''}`}
                    onClick={() => setFamily(family === f.key ? null : f.key)}>
                    <span className="bar" style={{ width: `${(FAMILY_COUNTS[f.key] / MAX_FAM) * 100}%`, background: FAMILY_HEX[f.key][isDark ? 'dark' : 'light'] }} />
                    <span className="ric"><f.Icon size={16} strokeWidth={1.25} color={FAMILY_HEX[f.key][isDark ? 'dark' : 'light']} /></span>
                    <span className="rname" title={lang === 'fr' ? f.fr : f.en}>{lang === 'fr' ? f.fr : f.en}</span>
                    <span className="rcount">{FAMILY_COUNTS[f.key]}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="grp">
              <div className="grp-h"><span>{t.types} · {TYPES.length}</span>{type && <button className="reset" onClick={() => setType(null)}>{t.all}</button>}</div>
              <div className="list">
                {TYPES_SORTED.map((ty) => (
                  <button key={ty.key} className={`row ${type === ty.key ? 'active' : ''} ${type && type !== ty.key ? 'dim' : ''}`}
                    onClick={() => setType(type === ty.key ? null : ty.key)}>
                    <span className="bar" style={{ width: `${(TYPE_COUNTS[ty.key] / MAX_TYPE) * 100}%`, background: TYPE_HEX[ty.key][isDark ? 'dark' : 'light'] }} />
                    <span className="ric"><ty.Icon size={16} strokeWidth={1.25} color={TYPE_HEX[ty.key][isDark ? 'dark' : 'light']} /></span>
                    <span className="rname" title={lang === 'fr' ? ty.fr : ty.en}>{lang === 'fr' ? ty.fr : ty.en}</span>
                    <span className="rcount">{TYPE_COUNTS[ty.key]}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* Center: graph */}
        <section className="center">
          <SkillsMap match={match} filtering={filtering} selected={selected} onSelect={setSelected} lang={lang} colorBy={colorBy} />
          <div className="cstat" role="group" aria-label={lang === 'fr' ? 'Statistiques du référentiel' : 'Referential statistics'}>
            <span className="cstat-i"><b>{competencies.length}</b><i>{lang === 'fr' ? 'compétences' : 'skills'}</i></span>
            <span className="cstat-sep" aria-hidden="true" />
            <span className="cstat-i"><b>{FAMILIES.length}</b><i>{t.families.toLowerCase()}</i></span>
            <span className="cstat-sep" aria-hidden="true" />
            <span className="cstat-i"><b>{RELATION_COUNT}</b><i>{t.relations}</i></span>
          </div>
        </section>

        {/* Right: overview / detail */}
        <aside className="right">
          {sel && relations ? (
            <div className="detail">
              <button className="back" onClick={() => setSelected(null)}>← {t.back}</button>
              <span className="d-meta">
                <span className="type-chip" style={{ color: `var(${TYPE_MAP[sel.type].colorVar})`, background: `var(${TYPE_MAP[sel.type].bgVar})` }}>
                  {(() => { const I = TYPE_MAP[sel.type].Icon; return <I size={12} strokeWidth={1.25} />; })()}{lang === 'fr' ? TYPE_MAP[sel.type].fr : TYPE_MAP[sel.type].en}
                </span>
                <span className="d-fam">{lang === 'fr' ? FAMILY_MAP[sel.family].fr : FAMILY_MAP[sel.family].en}</span>
              </span>
              <h2 className="d-title">{label(sel)}</h2>
              {(description(sel) || sel.official_url) && (
                <section className="d-info" aria-label={lang === 'fr' ? 'Description de la compétence' : 'Skill description'}>
                  {description(sel) && <p className="d-desc">{description(sel)}</p>}
                  {sel.official_url && (
                    <a className="d-official" href={sel.official_url} target="_blank" rel="noreferrer">
                      {lang === 'fr' ? 'Source officielle' : 'Official source'}<ExternalLink size={13} strokeWidth={1.5} />
                    </a>
                  )}
                </section>
              )}
              <div className="rels">
                {relGroups.map((g, gi) => {
                  const items = resolve(g.slugs);
                  if (!items.length) return null;
                  return (
                    <div className="relg" key={gi}>
                      <span className="relg-t" style={{ color: g.tone }}><span className="relg-bar" style={{ background: g.tone }} />{g.title} <span className="relg-n">{items.length}</span></span>
                      <div className="relg-items">
                        {items.map((c) => (
                          <button key={c.slug} className="rel-chip" title={label(c)} onClick={() => setSelected(c.slug)}>
                            {typeIcon(c)}<span className="rc-name">{label(c)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="d-cta">
                <p>{t.trainHint}</p>
                <StoreButtons variant="primary" full />
              </div>
            </div>
          ) : (family || type) ? (
            <div className="catview">
              <button className="back" onClick={() => { setFamily(null); setType(null); }}>← {t.back}</button>
              <h2 className="o-title">{catTitle}</h2>
              <span className="hub-h">{catList.length} {lang === 'fr' ? 'compétences' : 'skills'} · {t.hubsTitle}</span>
              <div className="hubs">
                {catList.map(({ c, deg }) => (
                  <button key={c.slug} className="hub" onClick={() => setSelected(c.slug)}>
                    {typeIcon(c)}
                    <span className="hub-name" title={label(c)}>{label(c)}</span>
                    <span className="hub-deg">{deg}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="overview">
              <h2 className="o-title">{t.mapTitle}</h2>
              <p className="hub-intro">{t.hubs}</p>
              <span className="hub-h">{t.hubsTitle}</span>
              <div className="hubs">
                {HUBS.map((slug) => {
                  const c = competencies.find((x) => x.slug === slug);
                  if (!c) return null;
                  return (
                    <button key={slug} className="hub" onClick={() => setSelected(slug)}>
                      {typeIcon(c)}
                      <span className="hub-name" title={label(c)}>{label(c)}</span>
                      <span className="hub-deg">{getDegree(slug)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </aside>
      </div>

      <style jsx>{`
        .obs { display: flex; flex-direction: column; height: 100vh; height: 100dvh; overflow: hidden; }

        /* Recherche (haut de la sidebar) */
        .search { position: relative; width: 100%; margin-bottom: 1.5rem; display: flex; align-items: center; }
        .si { position: absolute; left: 0.85rem; top: 50%; transform: translateY(-50%); display: flex; color: var(--text-tertiary); pointer-events: none; z-index: 1; }
        .search input { width: 100%; height: 2.5rem; padding: 0 2.4rem; border: 1px solid var(--border-strong); border-radius: var(--radius-full); background: var(--surface); color: var(--text-primary); font-family: var(--font-family); font-size: var(--font-size-sm); }
        .search input:focus { outline: none; border-color: var(--primary); }
        .clear { position: absolute; right: 0.7rem; background: none; border: none; color: var(--text-tertiary); cursor: pointer; display: flex; }
        .sresults { position: absolute; top: calc(100% + 6px); left: 0; right: 0; background: var(--surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); box-shadow: var(--shadow-lg); max-height: 320px; overflow-y: auto; z-index: var(--z-dropdown); padding: 0.35rem; }
        .sresults button { display: flex; align-items: center; gap: 0.6rem; width: 100%; padding: 0.5rem 0.6rem; background: none; border: none; border-radius: var(--radius-sm); cursor: pointer; text-align: left; font-family: var(--font-family); }
        .sresults button:hover { background: var(--hover); }
        .sr-name { font-size: var(--font-size-sm); color: var(--text-primary); flex: 1; }
        .sr-fam { font-size: var(--font-size-xs); color: var(--text-tertiary); }

        /* Body 3 columns */
        .body { flex: 1; display: grid; grid-template-columns: 280px 1fr 340px; min-height: 0; }
        .left, .right { overflow-y: auto; padding: 1.25rem; }
        .left { border-right: 1px solid var(--border-color); }
        .right { border-left: 1px solid var(--border-color); }

        .cby { margin-bottom: 1.5rem; }
        .cap { display: block; font-size: var(--font-size-xxs); font-weight: var(--font-weight-bold); text-transform: uppercase; letter-spacing: var(--letter-spacing-wide); color: var(--text-tertiary); margin-bottom: 0.5rem; }
        .seg { display: flex; border: 1px solid var(--border-color); border-radius: var(--radius-sm); overflow: hidden; }
        .seg button { flex: 1; padding: 0.5rem; background: var(--surface); border: none; font-family: var(--font-family); font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--text-tertiary); cursor: pointer; }
        .seg button.on { background: var(--primary); color: var(--text-on-primary); }

        .grp { margin-bottom: 1.5rem; }
        .grp-h { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
        .grp-h span { font-size: var(--font-size-xxs); font-weight: var(--font-weight-bold); text-transform: uppercase; letter-spacing: var(--letter-spacing-wide); color: var(--text-tertiary); }
        .reset { background: none; border: none; font-size: var(--font-size-xs); color: var(--text-secondary); cursor: pointer; font-family: var(--font-family); }
        .reset:hover { color: var(--text-primary); }
        .list { display: flex; flex-direction: column; gap: 0.1rem; }
        .row { position: relative; overflow: hidden; display: flex; align-items: center; gap: 0.6rem; width: 100%; padding: 0.45rem 0.5rem; background: none; border: none; border-radius: var(--radius-sm); cursor: pointer; text-align: left; font-family: var(--font-family); transition: background var(--transition-fast); }
        .row:hover { background: var(--hover); }
        .bar { position: absolute; left: 0; top: 0; bottom: 0; border-radius: var(--radius-sm); opacity: 0.14; pointer-events: none; z-index: 0; }
        .row > .ric, .row > .rname, .row > .rcount { position: relative; z-index: 1; }
        .row.active { background: var(--hover); }
        .row.active .rname { font-weight: var(--font-weight-bold); color: var(--text-primary); }
        .row.dim { opacity: 0.4; }
        .dot { width: 0.6rem; height: 0.6rem; border-radius: var(--radius-full); flex: none; }
        .tic { flex: none; display: inline-flex; align-items: center; }
        .ric { display: flex; align-items: center; justify-content: center; flex: none; width: 1.1rem; }
        .rname { flex: 1; min-width: 0; font-size: var(--font-size-sm); color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .rcount { font-size: var(--font-size-xs); color: var(--text-tertiary); }

        /* Center */
        .center { position: relative; display: flex; flex-direction: column; min-width: 0; }
        .center :global(.map) { flex: 1; }

        /* Carte de stats superposee sur le graphe */
        .cstat {
          position: absolute; left: 1rem; top: 1rem; z-index: 5;
          display: flex; align-items: center; gap: 1rem;
          padding: 0.65rem 1.1rem;
          background: color-mix(in srgb, var(--surface) 80%, transparent);
          backdrop-filter: blur(12px) saturate(1.4); -webkit-backdrop-filter: blur(12px) saturate(1.4);
          border: 1px solid var(--border-color); border-radius: var(--radius-lg);
          box-shadow: var(--shadow-md);
          pointer-events: none;
        }
        .cstat-i { display: flex; flex-direction: column; line-height: 1.1; }
        .cstat-i b { font-size: var(--font-size-md); color: var(--text-primary); font-weight: var(--font-weight-bold); letter-spacing: var(--letter-spacing-tight); font-variant-numeric: tabular-nums; }
        .cstat-i i { font-style: normal; margin-top: 0.15rem; font-size: var(--font-size-xxs); color: var(--text-tertiary); text-transform: uppercase; letter-spacing: var(--letter-spacing-wide); }
        .cstat-sep { width: 1px; align-self: stretch; margin: 0.1rem 0; background: var(--border-color); flex: none; }

        /* Right overview */
        .o-title { font-size: var(--font-size-xl); font-weight: var(--font-weight-bold); color: var(--text-primary); margin: 0.4rem 0 0.6rem; letter-spacing: var(--letter-spacing-tight); }
        .o-desc { font-size: var(--font-size-sm); color: var(--text-secondary); line-height: var(--line-height-relaxed); margin-bottom: 1.5rem; }
        .hub-h { display: block; font-size: var(--font-size-xxs); font-weight: var(--font-weight-bold); text-transform: uppercase; letter-spacing: var(--letter-spacing-wide); color: var(--text-tertiary); margin-bottom: 0.6rem; }
        .hub-intro { font-size: var(--font-size-sm); color: var(--text-secondary); line-height: var(--line-height-relaxed); margin: 0 0 1.4rem; }
        .hubs { display: flex; flex-direction: column; gap: 0.4rem; }
        .hub { display: flex; align-items: center; gap: 0.6rem; padding: 0.7rem 0.75rem; background: var(--surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); cursor: pointer; text-align: left; font-family: var(--font-family); transition: all var(--transition-fast); }
        .hub:hover { border-color: var(--border-strong); }
        .hub-name { flex: 1; min-width: 0; font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .hub-deg { font-size: var(--font-size-sm); font-weight: var(--font-weight-bold); color: var(--warning); }

        /* Right detail */
        .back { background: none; border: none; color: var(--text-secondary); font-family: var(--font-family); font-size: var(--font-size-sm); cursor: pointer; padding: 0; margin-bottom: 1rem; }
        .back:hover { color: var(--text-primary); }
        .d-meta { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; }
        .type-chip { display: inline-flex; align-items: center; gap: 0.3rem; font-size: var(--font-size-xxs); font-weight: var(--font-weight-semibold); padding: 0.18rem 0.5rem; border-radius: var(--radius-xs); }
        .d-fam { font-size: var(--font-size-xxs); color: var(--text-tertiary); }
        .d-title { font-size: var(--font-size-xxl); font-weight: var(--font-weight-bold); color: var(--text-primary); margin: 0.5rem 0 0.85rem; line-height: 1.15; }
        .d-info { margin: 0 0 1.35rem; padding: 0.85rem 0 1rem; border-top: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color); }
        .d-desc { margin: 0; color: var(--text-secondary); font-size: var(--font-size-sm); line-height: var(--line-height-relaxed); }
        .d-official { display: inline-flex; align-items: center; gap: 0.35rem; margin-top: 0.75rem; color: var(--primary); font-size: var(--font-size-sm); font-weight: var(--font-weight-bold); text-decoration: none; overflow-wrap: anywhere; }
        .d-official:hover { text-decoration: underline; }
        .rels { display: flex; flex-direction: column; gap: 1.4rem; }
        .relg-t { display: flex; align-items: center; gap: 0.45rem; font-size: var(--font-size-xxs); font-weight: var(--font-weight-bold); text-transform: uppercase; letter-spacing: var(--letter-spacing-wide); margin-bottom: 0.7rem; }
        .relg-bar { width: 0.9rem; height: 0.2rem; border-radius: var(--radius-xs); flex: none; }
        .relg-n { color: var(--text-disabled); font-weight: var(--font-weight-semibold); }
        .relg-items { display: flex; flex-wrap: wrap; gap: 0.45rem; }
        .rel-chip { display: inline-flex; align-items: center; gap: 0.45rem; max-width: 100%; padding: 0.42rem 0.75rem 0.42rem 0.6rem; border: 1px solid var(--border-color); border-radius: var(--radius-full); background: var(--surface); color: var(--text-primary); font-family: var(--font-family); font-size: var(--font-size-xs); font-weight: var(--font-weight-medium); cursor: pointer; transition: all var(--transition-fast); }
        .rc-name { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .rel-chip:hover { border-color: var(--text-tertiary); background: var(--background-tertiary); transform: translateY(-1px); box-shadow: var(--shadow-xs); }
        .rel-chip .dot { width: 0.5rem; height: 0.5rem; border-radius: var(--radius-full); flex: none; }
        .d-cta { margin-top: 1.5rem; padding-top: 1.25rem; border-top: 1px solid var(--border-color); }
        .d-cta p { font-size: var(--font-size-sm); color: var(--text-secondary); margin-bottom: 0.85rem; }

        @media (max-width: 1100px) {
          .body { grid-template-columns: 240px 1fr 300px; }
        }
        @media (max-width: 900px) {
          .obs { height: auto; overflow: visible; }
          .body { display: flex; flex-direction: column; }
          .center { order: 1; height: 60vh; min-height: 360px; border-bottom: 1px solid var(--border-color); }
          .left { order: 2; overflow: visible; border-right: none; }
          .right { order: 3; overflow: visible; border-left: none; border-top: 1px solid var(--border-color); }
          .search { margin-bottom: 1.1rem; }
          /* La carte de stats reste superposee mais plus compacte */
          .cstat { left: 0.75rem; top: 0.75rem; gap: 0.8rem; padding: 0.55rem 0.85rem; }
        }
        @media (max-width: 600px) {
          .center { height: 52vh; min-height: 320px; }
          .left, .right { padding: 1rem; }
          /* Stats centrees en haut, pleine largeur */
          .cstat {
            left: 0.6rem; right: 0.6rem; top: 0.6rem;
            justify-content: space-around; gap: 0.5rem;
            padding: 0.55rem 0.6rem; border-radius: var(--radius-md);
          }
          .cstat-i { align-items: center; text-align: center; }
          .cstat-i b { font-size: var(--font-size-sm); }
        }
      `}</style>
    </main>
  );
}
