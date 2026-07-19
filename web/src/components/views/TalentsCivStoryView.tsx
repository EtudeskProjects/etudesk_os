'use client';

import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  BriefcaseBusiness,
  Database,
  Globe2,
  GraduationCap,
  MapPin,
  Search,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import SiteHeader from '@/components/SiteHeader';
import type { Lang } from '@/lib/i18n';
import story from '@/data/civ-talents-story.json';

type CountShare = { name: string; count: number; share: number };
type Region = CountShare & {
  rank: number;
  x: number;
  y: number;
  femaleShare: number;
  maleShare: number;
  medianAge: number | null;
  superiorShare: number;
  topCities: CountShare[];
  topSectors: CountShare[];
};
type Sector = {
  name: string;
  rank: number;
  mentions: number;
  profileShare: number;
  mentionShare: number;
  femaleShare: number;
  maleShare: number;
  medianAge: number | null;
  superiorShare: number;
  secondaryShare: number;
  topRegions: CountShare[];
};
type StoryData = {
  generatedAt: string;
  source: string;
  summary: {
    profiles: number;
    completeRows: number;
    medianFilledFields: number;
    sectorMentions: number;
    averageSectorsPerProfile: number;
    regionsKnown: number;
    abidjanCount: number;
    abidjanShareKnownRegions: number;
    top5RegionShare: number;
    femaleCount: number;
    maleCount: number;
    femaleShare: number;
    medianAge: number;
    diasporaCount: number;
    diasporaShareKnownCountries: number;
  };
  quality: {
    missing: CountShare[];
    duplicateSignals: CountShare[];
    jan1Birthdates: { count: number; share: number };
  };
  gender: CountShare[];
  ageDistribution: CountShare[];
  education: CountShare[];
  regions: Region[];
  cities: CountShare[];
  sectors: Sector[];
  sectorSelectionCounts: CountShare[];
  diasporaCountries: CountShare[];
  diasporaCities: CountShare[];
  applicantStatus: CountShare[];
  registrationReason: CountShare[];
  applicantCategory: CountShare[];
  emailDomains: CountShare[];
};

const data = story as StoryData;

const sectorColors = ['#2563EB', '#0E7490', '#16A34A', '#D97706', '#BE185D', '#6D28D9'];

function formatNumber(value: number) {
  return new Intl.NumberFormat('fr-FR').format(value);
}

function formatPct(value: number) {
  return `${value.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}%`;
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function statCopy(lang: Lang) {
  return {
    title: lang === 'fr' ? 'Talents CIV' : 'CIV Talents',
    subtitle:
      lang === 'fr'
        ? 'Lecture territoriale, sectorielle et inclusive des profils talents captés par le dispositif.'
        : 'Territorial, sector and inclusion analysis of talent profiles captured by the program.',
    source: lang === 'fr' ? 'Source agrégée' : 'Aggregated source',
    profiles: lang === 'fr' ? 'Profils talents' : 'Talent profiles',
    sectors: lang === 'fr' ? 'Mentions sectorielles' : 'Sector mentions',
    abidjan: lang === 'fr' ? 'Part Abidjan' : 'Abidjan share',
    female: lang === 'fr' ? 'Femmes' : 'Women',
    medianAge: lang === 'fr' ? 'Âge médian' : 'Median age',
    diaspora: lang === 'fr' ? 'Diaspora' : 'Diaspora',
  };
}

function Meter({ value, color = 'var(--primary)' }: { value: number; color?: string }) {
  return (
    <span className="meter" aria-hidden="true">
      <span style={{ width: `${Math.max(1, Math.min(100, value))}%`, background: color }} />
    </span>
  );
}

function BarList({
  items,
  valueKey = 'count',
  max,
  limit = 8,
  onSelect,
  active,
}: {
  items: CountShare[];
  valueKey?: 'count' | 'share';
  max?: number;
  limit?: number;
  onSelect?: (name: string) => void;
  active?: string;
}) {
  const shown = items.slice(0, limit);
  const localMax = max ?? Math.max(...shown.map((item) => (valueKey === 'count' ? item.count : item.share)), 1);
  return (
    <div className="bar-list">
      {shown.map((item, index) => {
        const value = valueKey === 'count' ? item.count : item.share;
        const color = sectorColors[index % sectorColors.length];
        const content = (
          <>
            <span className="bar-meta">
              <span className="bar-name">{item.name}</span>
              <span className="bar-value">{valueKey === 'count' ? formatNumber(item.count) : formatPct(item.share)}</span>
            </span>
            <span className="bar-track">
              <span style={{ width: `${Math.max(1, (value / localMax) * 100)}%`, background: color }} />
            </span>
          </>
        );
        return onSelect ? (
          <button key={item.name} className={`bar-row ${active === item.name ? 'active' : ''}`} onClick={() => onSelect(item.name)}>
            {content}
          </button>
        ) : (
          <div key={item.name} className="bar-row">
            {content}
          </div>
        );
      })}
    </div>
  );
}

export default function TalentsCivStoryView({ lang }: { lang: Lang }) {
  const t = statCopy(lang);
  const [selectedRegionName, setSelectedRegionName] = useState('Abidjan');
  const [sectorQuery, setSectorQuery] = useState('');
  const [selectedSectorName, setSelectedSectorName] = useState(data.sectors[0]?.name ?? '');

  const selectedRegion = data.regions.find((region) => region.name === selectedRegionName) ?? data.regions[0];
  const selectedSector = data.sectors.find((sector) => sector.name === selectedSectorName) ?? data.sectors[0];
  const maxRegionCount = Math.max(...data.regions.map((region) => region.count));
  const maxSectorMentions = Math.max(...data.sectors.map((sector) => sector.mentions));
  const filteredSectors = useMemo(() => {
    const query = normalize(sectorQuery.trim());
    if (!query) return data.sectors.slice(0, 16);
    return data.sectors.filter((sector) => normalize(sector.name).includes(query)).slice(0, 16);
  }, [sectorQuery]);

  return (
    <main className="talents-story">
      <SiteHeader />

      <section className="story-hero">
        <div className="hero-copy">
          <span className="eyebrow">
            <Database size={15} strokeWidth={1.25} />
            {t.source} · {data.generatedAt}
          </span>
          <h1>{t.title}</h1>
          <p>{t.subtitle}</p>
        </div>
        <div className="hero-metrics" aria-label="Indicateurs clés">
          <div className="metric">
            <Users size={18} strokeWidth={1.25} />
            <strong>{formatNumber(data.summary.profiles)}</strong>
            <span>{t.profiles}</span>
          </div>
          <div className="metric">
            <BriefcaseBusiness size={18} strokeWidth={1.25} />
            <strong>{formatNumber(data.summary.sectorMentions)}</strong>
            <span>{t.sectors}</span>
          </div>
          <div className="metric">
            <MapPin size={18} strokeWidth={1.25} />
            <strong>{formatPct(data.summary.abidjanShareKnownRegions)}</strong>
            <span>{t.abidjan}</span>
          </div>
          <div className="metric">
            <Users size={18} strokeWidth={1.25} />
            <strong>{formatPct(data.summary.femaleShare)}</strong>
            <span>{t.female}</span>
          </div>
          <div className="metric">
            <BarChart3 size={18} strokeWidth={1.25} />
            <strong>{data.summary.medianAge.toFixed(1)}</strong>
            <span>{t.medianAge}</span>
          </div>
          <div className="metric">
            <Globe2 size={18} strokeWidth={1.25} />
            <strong>{formatNumber(data.summary.diasporaCount)}</strong>
            <span>{t.diaspora}</span>
          </div>
        </div>
      </section>

      <section className="map-band">
        <div className="section-head">
          <span className="kicker">Territoires</span>
          <h2>La demande talent est massive, mais très concentrée.</h2>
          <p>
            Abidjan porte plus de la moitié des profils localisés. Le top 5 régions concentre {formatPct(data.summary.top5RegionShare)} des talents avec région
            renseignée.
          </p>
        </div>

        <div className="map-layout">
          <div className="map-panel">
            <svg className="ci-map" viewBox="0 0 100 100" role="img" aria-label="Carte-bulles des régions de Côte d’Ivoire">
              <path
                d="M31 10 L48 5 L66 10 L82 24 L86 43 L78 59 L80 76 L66 91 L49 95 L32 90 L18 80 L14 62 L18 44 L14 27 Z"
                fill="var(--background-secondary)"
                stroke="var(--border-strong)"
                strokeWidth="0.8"
              />
              <path d="M30 83 C41 89 55 91 70 84" fill="none" stroke="var(--border-strong)" strokeWidth="0.7" strokeDasharray="2 2" />
              {data.regions.map((region) => {
                const radius = 2.6 + 10.5 * Math.sqrt(region.count / maxRegionCount);
                const active = selectedRegion.name === region.name;
                return (
                  <g key={region.name}>
                    <g
                      className="map-hit"
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedRegionName(region.name)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') setSelectedRegionName(region.name);
                      }}
                      aria-label={`${region.name}: ${formatNumber(region.count)} profils`}
                    >
                      <circle
                        cx={region.x}
                        cy={region.y}
                        r={radius}
                        fill={active ? '#2563EB' : 'var(--surface)'}
                        stroke={active ? '#1D4ED8' : 'var(--text-tertiary)'}
                        strokeWidth={active ? 1.4 : 0.8}
                      />
                      <circle cx={region.x} cy={region.y} r={Math.max(1.4, radius * 0.28)} fill={active ? '#FFFFFF' : '#2563EB'} opacity="0.95" />
                    </g>
                    {(active || region.rank <= 8) && (
                      <text x={region.x + radius + 1.4} y={region.y + 1.2} className="map-label">
                        {region.name}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
            <div className="legend">
              <span><i className="legend-dot" /> Volume talents</span>
              <span>Carte-bulles régionale, coordonnées simplifiées</span>
            </div>
          </div>

          <aside className="region-detail">
            <span className="rank">#{selectedRegion.rank} région</span>
            <h3>{selectedRegion.name}</h3>
            <div className="region-number">{formatNumber(selectedRegion.count)}</div>
            <p>{formatPct(selectedRegion.share)} des profils avec région renseignée.</p>
            <div className="split-metrics">
              <span><b>{formatPct(selectedRegion.femaleShare)}</b> femmes</span>
              <span><b>{selectedRegion.medianAge?.toFixed(1) ?? 'n/a'}</b> âge médian</span>
              <span><b>{formatPct(selectedRegion.superiorShare)}</b> supérieur</span>
            </div>
            <h4>Secteurs dominants</h4>
            <BarList items={selectedRegion.topSectors} limit={5} />
            <h4>Villes repères</h4>
            <div className="chips">
              {selectedRegion.topCities.map((city) => (
                <span key={city.name}>{city.name} · {formatNumber(city.count)}</span>
              ))}
            </div>
          </aside>
        </div>
      </section>

      <section className="sector-band">
        <div className="section-head">
          <span className="kicker">Secteurs</span>
          <h2>Les talents déclarent en moyenne {data.summary.averageSectorsPerProfile.toFixed(2)} secteurs d’intérêt.</h2>
          <p>
            Le champ multi-secteurs révèle la demande réelle: services professionnels, administration, commerce, éducation et industrie dominent largement les
            orientations.
          </p>
        </div>

        <div className="sector-layout">
          <div className="sector-picker">
            <label className="searchbox">
              <Search size={16} strokeWidth={1.25} />
              <input value={sectorQuery} onChange={(event) => setSectorQuery(event.target.value)} placeholder="Chercher un secteur" />
              {sectorQuery && (
                <button type="button" onClick={() => setSectorQuery('')} aria-label="Effacer">
                  <X size={14} strokeWidth={1.25} />
                </button>
              )}
            </label>
            <div className="sector-results">
              {filteredSectors.map((sector) => (
                <button
                  key={sector.name}
                  className={selectedSector.name === sector.name ? 'active' : ''}
                  onClick={() => setSelectedSectorName(sector.name)}
                >
                  <span>{sector.name}</span>
                  <b>{formatNumber(sector.mentions)}</b>
                  <Meter value={(sector.mentions / maxSectorMentions) * 100} color={sectorColors[(sector.rank - 1) % sectorColors.length]} />
                </button>
              ))}
            </div>
          </div>

          <div className="sector-detail">
            <span className="rank">#{selectedSector.rank} secteur</span>
            <h3>{selectedSector.name}</h3>
            <div className="sector-kpis">
              <span><b>{formatNumber(selectedSector.mentions)}</b> mentions</span>
              <span><b>{formatPct(selectedSector.profileShare)}</b> mentions / profils</span>
              <span><b>{formatPct(selectedSector.femaleShare)}</b> femmes</span>
              <span><b>{selectedSector.medianAge?.toFixed(1) ?? 'n/a'}</b> âge médian</span>
            </div>
            <div className="dual">
              <div>
                <h4>Régions leaders</h4>
                <BarList items={selectedSector.topRegions} limit={5} />
              </div>
              <div>
                <h4>Structure du secteur</h4>
                <div className="insight-list">
                  <span><GraduationCap size={16} strokeWidth={1.25} /> {formatPct(selectedSector.superiorShare)} niveau supérieur</span>
                  <span><Users size={16} strokeWidth={1.25} /> {formatPct(selectedSector.maleShare)} hommes</span>
                  <span><BarChart3 size={16} strokeWidth={1.25} /> {formatPct(selectedSector.mentionShare)} des mentions sectorielles</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid-band">
        <div className="story-panel">
          <span className="panel-icon"><Users size={18} strokeWidth={1.25} /></span>
          <h2>Lecture inclusion</h2>
          <p>Les femmes représentent {formatPct(data.summary.femaleShare)} de la base. Les écarts deviennent plus nets dans certains secteurs opérationnels.</p>
          <BarList items={data.gender} limit={2} />
          <div className="mini-bars">
            {data.ageDistribution.map((age) => (
              <span key={age.name} title={`${age.name}: ${formatNumber(age.count)}`}>
                <i style={{ height: `${Math.max(8, age.share * 2.4)}px` }} />
                <b>{age.name}</b>
              </span>
            ))}
          </div>
        </div>

        <div className="story-panel">
          <span className="panel-icon"><GraduationCap size={18} strokeWidth={1.25} /></span>
          <h2>Capital formation</h2>
          <p>Le niveau supérieur domine parmi les niveaux renseignés, mais l’éducation reste un champ incomplet pour 42,1% des profils.</p>
          <BarList items={data.education} limit={6} />
        </div>

        <div className="story-panel">
          <span className="panel-icon"><Globe2 size={18} strokeWidth={1.25} /></span>
          <h2>Diaspora</h2>
          <p>{formatNumber(data.summary.diasporaCount)} profils résident hors Côte d’Ivoire. La lecture diaspora doit être séparée de la carte nationale.</p>
          <BarList items={data.diasporaCountries} limit={7} />
        </div>
      </section>

      <section className="quality-band">
        <div className="section-head">
          <span className="kicker">Fiabilité</span>
          <h2>La data story doit afficher ses limites.</h2>
          <p>
            Une visualisation publique doit rester agrégée: pas de données personnelles, pas de petits effectifs sensibles, et un indicateur de complétude visible.
          </p>
        </div>
        <div className="quality-grid">
          <div className="quality-item strong">
            <ShieldCheck size={22} strokeWidth={1.25} />
            <strong>{formatPct((data.summary.completeRows / data.summary.profiles) * 100)}</strong>
            <span>profils totalement complets</span>
          </div>
          <div className="quality-item">
            <AlertTriangle size={22} strokeWidth={1.25} />
            <strong>{formatPct(data.quality.jan1Birthdates.share)}</strong>
            <span>dates de naissance au 1er janvier</span>
          </div>
          {data.quality.duplicateSignals.map((signal) => (
            <div className="quality-item" key={signal.name}>
              <Database size={22} strokeWidth={1.25} />
              <strong>{formatNumber(signal.count)}</strong>
              <span>{signal.name} dans doublons</span>
            </div>
          ))}
        </div>
      </section>

      <section className="recommendations">
        <h2>Angles prêts pour la prochaine vue carte</h2>
        <div className="rec-grid">
          <p><b>Carte régionale.</b> Volume talents, top secteur, part femmes, âge médian et complétude par région.</p>
          <p><b>Abidjan vs intérieur.</b> Comparaison des besoins métiers, niveaux d’éducation et bureaux AEJ.</p>
          <p><b>Explorateur sectoriel.</b> Filtres région, genre, âge, éducation, diaspora/local et seuil petits effectifs.</p>
          <p><b>Couche diaspora.</b> Carte monde séparée avec pays de résidence et secteurs demandés.</p>
        </div>
      </section>

      <style jsx>{`
        .talents-story { min-height: 100vh; background: var(--background); color: var(--text-primary); }
        .story-hero,
        .map-band,
        .sector-band,
        .grid-band,
        .quality-band,
        .recommendations {
          max-width: 1320px;
          margin: 0 auto;
          padding: 3rem 1.5rem;
        }
        .story-hero { display: grid; grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr); gap: 2rem; align-items: end; min-height: calc(100vh - 68px); }
        .hero-copy { min-width: 0; }
        .eyebrow,
        .kicker,
        .rank {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          color: var(--text-tertiary);
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-bold);
          text-transform: uppercase;
          letter-spacing: 0;
        }
        h1 { max-width: 780px; margin-top: 1rem; font-size: clamp(2.6rem, 7vw, 6rem); line-height: 0.95; letter-spacing: 0; }
        h2 { font-size: clamp(1.7rem, 3vw, 2.65rem); letter-spacing: 0; }
        h3 { font-size: clamp(1.35rem, 2vw, 2rem); letter-spacing: 0; }
        h4 { margin-top: 1.25rem; margin-bottom: 0.75rem; font-size: var(--font-size-sm); letter-spacing: 0; text-transform: uppercase; color: var(--text-tertiary); }
        .hero-copy p,
        .section-head p { max-width: 720px; margin-top: 1rem; font-size: var(--font-size-lg); }
        .hero-metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.75rem; }
        .metric,
        .story-panel,
        .region-detail,
        .sector-detail,
        .sector-picker,
        .map-panel,
        .quality-item {
          border: 1px solid var(--border-color);
          border-radius: var(--radius-sm);
          background: var(--surface);
        }
        .metric { min-height: 136px; padding: 1rem; display: flex; flex-direction: column; justify-content: space-between; gap: 0.75rem; }
        .metric svg,
        .panel-icon,
        .quality-item svg { color: var(--text-tertiary); }
        .metric strong { display: block; font-size: clamp(1.35rem, 2.6vw, 2rem); line-height: 1; letter-spacing: 0; overflow-wrap: anywhere; }
        .metric span { color: var(--text-secondary); font-size: var(--font-size-sm); }
        .section-head { margin-bottom: 1.5rem; }
        .map-layout,
        .sector-layout { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(340px, 0.65fr); gap: 1rem; align-items: stretch; }
        .map-panel { min-height: 620px; padding: 1rem; display: flex; flex-direction: column; }
        .ci-map { width: 100%; min-height: 540px; flex: 1; }
        .map-hit { cursor: pointer; }
        .map-label { fill: var(--text-primary); font-size: 3px; font-weight: 700; letter-spacing: 0; pointer-events: none; paint-order: stroke; stroke: var(--surface); stroke-width: 0.8px; }
        .legend { display: flex; justify-content: space-between; gap: 1rem; color: var(--text-tertiary); font-size: var(--font-size-xs); }
        .legend-dot { display: inline-block; width: 0.65rem; height: 0.65rem; margin-right: 0.35rem; border-radius: var(--radius-full); background: #2563EB; }
        .region-detail,
        .sector-picker,
        .sector-detail,
        .story-panel { padding: 1.25rem; }
        .region-number { margin: 1rem 0 0.25rem; font-size: clamp(2rem, 5vw, 4rem); line-height: 1; font-weight: 900; letter-spacing: 0; overflow-wrap: anywhere; }
        .split-metrics,
        .sector-kpis { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.6rem; margin-top: 1rem; }
        .sector-kpis { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        .split-metrics span,
        .sector-kpis span,
        .insight-list span {
          border: 1px solid var(--border-color);
          border-radius: var(--radius-sm);
          padding: 0.75rem;
          color: var(--text-secondary);
          font-size: var(--font-size-xs);
          min-width: 0;
        }
        .split-metrics b,
        .sector-kpis b { display: block; color: var(--text-primary); font-size: var(--font-size-lg); overflow-wrap: anywhere; }
        .bar-list { display: flex; flex-direction: column; gap: 0.65rem; }
        .bar-row { width: 100%; display: flex; flex-direction: column; gap: 0.35rem; padding: 0; border: 0; background: transparent; color: inherit; font-family: var(--font-family); text-align: left; cursor: default; }
        button.bar-row { cursor: pointer; }
        .bar-row.active .bar-name { color: var(--info); }
        .bar-meta { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; min-width: 0; }
        .bar-name { color: var(--text-primary); font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .bar-value { flex: none; color: var(--text-tertiary); font-size: var(--font-size-xs); font-weight: var(--font-weight-bold); }
        .bar-track,
        .meter { display: block; width: 100%; height: 0.42rem; border-radius: var(--radius-full); background: var(--background-tertiary); overflow: hidden; }
        .bar-track span,
        .meter span { display: block; height: 100%; border-radius: inherit; }
        .chips { display: flex; flex-wrap: wrap; gap: 0.45rem; }
        .chips span { padding: 0.45rem 0.6rem; border: 1px solid var(--border-color); border-radius: var(--radius-sm); color: var(--text-secondary); font-size: var(--font-size-xs); }
        .sector-layout { grid-template-columns: minmax(300px, 0.55fr) minmax(0, 1fr); }
        .searchbox { display: flex; align-items: center; gap: 0.55rem; height: 2.8rem; padding: 0 0.75rem; border: 1px solid var(--border-strong); border-radius: var(--radius-sm); color: var(--text-tertiary); }
        .searchbox input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; color: var(--text-primary); font: inherit; font-size: var(--font-size-sm); }
        .searchbox button { display: flex; border: 0; background: transparent; color: var(--text-tertiary); cursor: pointer; }
        .sector-results { margin-top: 1rem; display: flex; flex-direction: column; gap: 0.55rem; max-height: 610px; overflow: auto; padding-right: 0.25rem; }
        .sector-results button { display: grid; gap: 0.4rem; width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: var(--radius-sm); background: var(--background); color: var(--text-primary); font-family: var(--font-family); text-align: left; cursor: pointer; }
        .sector-results button.active { border-color: var(--info); background: var(--info-light); }
        .sector-results span { font-weight: var(--font-weight-semibold); line-height: 1.35; }
        .sector-results b { color: var(--text-tertiary); font-size: var(--font-size-xs); }
        .dual { display: grid; grid-template-columns: minmax(0, 1fr) minmax(240px, 0.65fr); gap: 1rem; margin-top: 1.5rem; }
        .insight-list { display: grid; gap: 0.7rem; }
        .insight-list span { display: flex; align-items: center; gap: 0.55rem; }
        .grid-band { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; }
        .story-panel { min-height: 460px; }
        .story-panel h2 { margin-top: 0.75rem; font-size: var(--font-size-xxl); }
        .story-panel p { margin: 0.75rem 0 1.25rem; }
        .panel-icon { display: inline-flex; width: 2.3rem; height: 2.3rem; align-items: center; justify-content: center; border: 1px solid var(--border-color); border-radius: var(--radius-sm); }
        .mini-bars { display: grid; grid-template-columns: repeat(9, minmax(0, 1fr)); align-items: end; gap: 0.35rem; margin-top: 1.5rem; min-height: 96px; }
        .mini-bars span { display: flex; flex-direction: column; align-items: center; justify-content: end; gap: 0.35rem; min-width: 0; }
        .mini-bars i { width: 100%; max-width: 1.3rem; background: #0E7490; border-radius: var(--radius-xs) var(--radius-xs) 0 0; }
        .mini-bars b { color: var(--text-tertiary); font-size: 0.56rem; font-weight: var(--font-weight-semibold); writing-mode: vertical-rl; transform: rotate(180deg); }
        .quality-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 0.75rem; }
        .quality-item { min-height: 156px; padding: 1rem; display: flex; flex-direction: column; justify-content: space-between; }
        .quality-item.strong { border-color: var(--success); }
        .quality-item strong { font-size: clamp(1.4rem, 3vw, 2.4rem); letter-spacing: 0; overflow-wrap: anywhere; }
        .quality-item span { color: var(--text-secondary); font-size: var(--font-size-sm); }
        .recommendations { padding-top: 1rem; padding-bottom: 4rem; }
        .rec-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.75rem; margin-top: 1rem; }
        .rec-grid p { min-height: 150px; padding: 1rem; border: 1px solid var(--border-color); border-radius: var(--radius-sm); background: var(--surface); font-size: var(--font-size-sm); }
        .rec-grid b { color: var(--text-primary); }
        @media (max-width: 1080px) {
          .story-hero,
          .map-layout,
          .sector-layout,
          .dual { grid-template-columns: 1fr; }
          .grid-band,
          .quality-grid,
          .rec-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .story-hero { min-height: auto; align-items: start; }
        }
        @media (max-width: 720px) {
          .story-hero,
          .map-band,
          .sector-band,
          .grid-band,
          .quality-band,
          .recommendations { padding: 2rem 1rem; }
          .hero-metrics,
          .grid-band,
          .quality-grid,
          .rec-grid,
          .split-metrics,
          .sector-kpis { grid-template-columns: 1fr; }
          .metric { min-height: 112px; }
          .map-panel { min-height: 430px; }
          .ci-map { min-height: 360px; }
          .legend { flex-direction: column; }
          .sector-results { max-height: 440px; }
          .story-panel { min-height: auto; }
        }
      `}</style>
    </main>
  );
}
