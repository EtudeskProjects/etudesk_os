'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  GraduationCap, Compass, ArrowRight, ChevronDown, Globe, Smartphone,
  Boxes, Mic, ListChecks, FileText, Layers,
  Shuffle, TrendingUp,
} from 'lucide-react';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import StoreButtons from '@/components/StoreButtons';
import LearningPathGraph from '@/components/LearningPathGraph';
import { competencies, FAMILIES } from '@/data/taxonomy';
import type { Lang } from '@/lib/i18n';
import { homeCopy as copy } from '@/content/home';

// Nombre de relations typees du referentiel. Fige ici (et non importe de
// relations.ts) pour ne pas charger edges.json ~175KB sur la landing : le public
// est sensible au cout de la data. A resynchroniser avec RELATION_COUNT a chaque
// release du referentiel (2026-Q2 : 8893).
const RELATIONS = 8893;

const LinkedInIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/></svg>
);

const TEAM = [
  { name: 'Lamine BARRO', photo: '/images/team-lamine-barro.jpg', roleFr: 'Co-fondateur & CEO', roleEn: 'Co-founder & CEO',
    bioFr: 'Executive-MBA HEC Paris, Founder Institute (Silicon Valley). 10 ans à la tête d\'Etudesk, expérience terrain dans 36 pays.',
    bioEn: 'Executive MBA, HEC Paris. Founder Institute (Silicon Valley). 10 years leading Etudesk, field experience across 36 countries.', linkedin: 'https://www.linkedin.com/in/laminebarro/' },
  { name: 'Wilfried DALI', photo: '/images/team-wilfried-dali.jpg', roleFr: 'Co-fondateur & DGA', roleEn: 'Co-founder & Deputy CEO',
    bioFr: 'Master en ingénierie pédagogique. 6 ans chez Etudesk, expert du déploiement de plateformes d\'apprentissage : 60+ écoles, des projets pour Orange et la Société Générale.',
    bioEn: 'Master\'s in instructional design. 6 years at Etudesk, expert in deploying learning platforms: 60+ schools and projects for Orange and Société Générale.', linkedin: 'https://www.linkedin.com/in/wilfried-dali-898018109/' },
  { name: 'Eddy ASSOHOUN', photo: '/images/team-eddy-assohoun.jpg', roleFr: 'CTO', roleEn: 'CTO',
    bioFr: 'Ingénieur full-stack et Certified Ethical Hacker, formé à Bangalore. Expérience internationale (Inde, USA, Ghana) et plusieurs startups tech avant de diriger la technique d\'Etudesk.',
    bioEn: 'Full-stack engineer and Certified Ethical Hacker, trained in Bangalore. International experience (India, USA, Ghana) and several tech startups before leading Etudesk\'s engineering.', linkedin: 'https://www.linkedin.com/in/yoann-eddy-assohoun-85a361a9/' },
  { name: 'Hasma GBANE', photo: '/images/team-hasma-gbane.jpg', roleFr: 'Assistante des Opérations', roleEn: 'Operations Assistant',
    bioFr: 'Licence en multimédias et arts numériques. Pilote les opérations, le support et la coordination de l\'équipe. Co-fondatrice de Kada Agency (design web & marketing digital).',
    bioEn: 'Degree in multimedia and digital arts. Runs operations, support and team coordination. Co-founder of Kada Agency (web design & digital marketing).', linkedin: 'https://www.linkedin.com/in/hasma-gban%C3%A9-0a9360373/' },
];


export default function HomeView({ lang }: { lang: Lang }) {
  const t = copy[lang];

  const heroStats = [
    { n: '3 000 000+', l: lang === 'fr' ? 'formés' : 'trained' },
    { n: '600+', l: lang === 'fr' ? 'organisations accompagnées' : 'organisations supported' },
    { n: '53', l: lang === 'fr' ? 'pays' : 'countries' },
    { n: lang === 'fr' ? '10 ans' : '10 years', l: lang === 'fr' ? 'au service de l\'éducation' : 'serving education' },
  ];

  const why = [
    [<Shuffle key="w1" size={22} strokeWidth={1.25} />, t.why1t, t.why1d, 'knowledge'],
    [<Globe key="w2" size={22} strokeWidth={1.25} />, t.why2t, t.why2d, 'hard'],
    [<TrendingUp key="w3" size={22} strokeWidth={1.25} />, t.why3t, t.why3d, 'soft'],
    [<Smartphone key="w4" size={22} strokeWidth={1.25} />, t.why4t, t.why4d, 'tool'],
  ];

  const feats = [
    [<Boxes key="1" size={20} strokeWidth={1.25} />, t.f1t, t.f1d],
    [<ListChecks key="2" size={20} strokeWidth={1.25} />, t.f2t, t.f2d],
    [<FileText key="3" size={20} strokeWidth={1.25} />, t.f3t, t.f3d],
    [<Mic key="4" size={20} strokeWidth={1.25} />, t.f4t, t.f4d],
    [<Globe key="5" size={20} strokeWidth={1.25} />, t.f5t, t.f5d],
    [<Smartphone key="6" size={20} strokeWidth={1.25} />, t.f6t, t.f6d],
  ];

  return (
    <main>
      <SiteHeader />

      {/* Hero + bande de stats : ensemble = hauteur d'ecran sous le menu (desktop) */}
      <div className="hero-wrap">
      {/* Hero */}
      <section className="hero">
        <video className="hero-video" autoPlay muted loop playsInline>
          <source src="/images/hero-bg.mp4" type="video/mp4" />
        </video>
        <div className="hero-overlay" />
        <div className="hero-content">
          <h1>{t.heroTitle}</h1>
          <p className="sub">{t.heroSub}</p>
          <div className="hero-actions">
            <div className="hero-ctas">
              <Link href={`/${lang}/digital-skills`} className="ghost-cta">{t.heroExplore}<ArrowRight size={16} strokeWidth={1.25} /></Link>
            </div>
            <div className="hero-downloads">
              <StoreButtons variant="brand" size="lg" />
            </div>
          </div>
        </div>
      </section>

      {/* Bande de stats, juste sous le hero */}
      <section className="hero-stats">
        <div className="hero-stats-inner">
          {heroStats.map((s, i) => (
            <div key={i} className="hstat">
              <b>{s.n}</b>
              <span>{s.l}</span>
            </div>
          ))}
        </div>
      </section>
      </div>

      {/* Pourquoi les competences du numerique : chaine de competences a gauche, le why a droite */}
      <section className="why">
        <div className="why-inner">
          <div className="why-visual">
            <LearningPathGraph lang={lang} />
          </div>
          <div className="why-content">
            <div className="head why-head">
              <h2>{t.whyTitle}</h2>
              <p>{t.whySub}</p>
            </div>
            <div className="why-grid">
              {why.map((w, i) => (
                <div key={i} className="why-card">
                  <span className={`wic ${w[3]}`}>{w[0]}</span>
                  <h4>{w[1]}</h4>
                  <p>{w[2]}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Le produit : les 2 agents, chacun avec son illustration smartphone */}
      <section id="produit" className="agents">
        <div className="head">
          <h2>{t.loopTitle}</h2>
          <p>{t.loopLead}</p>
        </div>

        {/* Agent 1 - Tuteur IA (Apprendre) */}
        <div className="agent-row">
          <div className="agent-copy">
            <span className="agent-eyebrow learn"><span className="ae-ico"><GraduationCap size={14} strokeWidth={1.25} /></span>{t.agent1Eyebrow}</span>
            <h3>{t.learnTitle}</h3>
            <p>{t.learnDesc}</p>
            <div className="agent-acc">
              {t.learnList.map((f) => (
                <details key={f.t} name="agent-learn" className="acc-item">
                  <summary>{f.t}<ChevronDown size={16} strokeWidth={1.25} /></summary>
                  <p>{f.d}</p>
                </details>
              ))}
            </div>
          </div>
          <div className="agent-device learn">
            <div className="phone">
              <span className="phone-notch" />
              <div className="phone-screen">
                <Image src="/images/agent-learn.png" alt={t.agent1Eyebrow} width={260} height={540} className="phone-img" />
              </div>
            </div>
          </div>
        </div>

        {/* Agent 2 - Guide carriere IA (Avancer) */}
        <div className="agent-row reverse">
          <div className="agent-device advance">
            <div className="phone">
              <span className="phone-notch" />
              <div className="phone-screen">
                <Image src="/images/agent-advance.png" alt={t.agent2Eyebrow} width={260} height={540} className="phone-img" />
              </div>
            </div>
          </div>
          <div className="agent-copy">
            <span className="agent-eyebrow advance"><span className="ae-ico"><Compass size={14} strokeWidth={1.25} /></span>{t.agent2Eyebrow}</span>
            <h3>{t.advanceTitle}</h3>
            <p>{t.advanceDesc}</p>
            <div className="agent-acc">
              {t.advanceList.map((f) => (
                <details key={f.t} name="agent-advance" className="acc-item">
                  <summary>{f.t}<ChevronDown size={16} strokeWidth={1.25} /></summary>
                  <p>{f.d}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Le referentiel vivant : la colonne vertebrale qui alimente les 2 agents */}
      <section id="referentiel" className="ref-band">
        <div className="ref-inner">
          <div className="ref-copy">
            <h2>{t.refTitle}</h2>
            <p className="ref-desc">{t.refDesc}</p>
            <div className="stats">
              <div className="stat"><span className="num">{competencies.length}</span><span className="lbl">{t.refSkills}</span></div>
              <span className="sep" />
              <div className="stat"><span className="num">{FAMILIES.length}</span><span className="lbl">{t.refFamilies}</span></div>
              <span className="sep" />
              <div className="stat"><span className="num">{RELATIONS.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')}</span><span className="lbl">{t.refRelations}</span></div>
            </div>
            <div className="ref-points">
              <div className="ref-point">
                <span className="rp-ic"><Layers size={18} strokeWidth={1.25} /></span>
                <div><h4>{t.refPoint1T}</h4><p><strong>{t.refPoint1B}</strong>{t.refPoint1D}</p></div>
              </div>
            </div>
            <Link href={`/${lang}/digital-skills`} className="ref-cta">{t.refCta}<ArrowRight size={16} strokeWidth={1.25} /></Link>
          </div>
          <div className="ref-visual">
            <Link href={`/${lang}/digital-skills`} className="ref-graph" aria-label={t.refCta}>
              <Image src="/images/skills-graph.png" alt={t.refTitle} fill sizes="(max-width: 880px) 100vw, 560px" className="ref-graph-img" />
            </Link>
          </div>
        </div>
      </section>

      {/* Fonctionnalites */}
      <section className="section alt">
        <div className="head"><h2>{t.featsTitle}</h2></div>
        <div className="feat-grid">
          {feats.map((f, i) => (
            <div key={i} className="feat">
              <span className="feat-ic">{f[0]}</span>
              <h4>{f[1]}</h4><p>{f[2]}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Tarifs */}
      <section id="tarifs" className="section">
        <div className="credits">
          <div className="credits-text">
            <img src="/images/illustration-tarifs.svg" alt="" className="credits-ill" />
            <h2>{t.creditsT}</h2>
            <p>{t.creditsD}</p>
          </div>
          <div className="credits-table">
            {t.creditsRows.map((r) => (
              <div key={r[0]} className="crow"><span>{r[0]}</span><b>{r[1]}</b></div>
            ))}
          </div>
        </div>
      </section>

      {/* L'equipe : les humains derriere l'IA (cible de "Qui sommes-nous") */}
      <section id="qui-sommes-nous" className="section">
        <div className="head"><h2>{t.teamTitle}</h2></div>
        <div className="team">
          {TEAM.map((m) => (
            <div key={m.name} className="member">
              <Image src={m.photo} alt={m.name} width={96} height={96} className="avatar" />
              <h3>{m.name}</h3>
              <span className="role">{lang === 'fr' ? m.roleFr : m.roleEn}</span>
              <p>{lang === 'fr' ? m.bioFr : m.bioEn}</p>
              <a href={m.linkedin} target="_blank" rel="noopener noreferrer" className="li" aria-label="LinkedIn"><LinkedInIcon size={18} /></a>
            </div>
          ))}
        </div>
      </section>

      {/* Notre histoire */}
      <section className="hist">
        <div className="hist-inner">
          <div className="hist-visual">
            <figure className="hist-img hist-img-1">
              <Image src="/images/hist-2016.jpg" alt="Etudesk 2016" fill sizes="(max-width: 880px) 80vw, 360px" style={{ objectFit: 'cover' }} />
              <span className="hist-tag">2016</span>
            </figure>
            <figure className="hist-img hist-img-2">
              <Image src="/images/hist-2026.jpg" alt="Etudesk 2026" fill sizes="(max-width: 880px) 80vw, 360px" style={{ objectFit: 'cover' }} />
              <span className="hist-tag">2026</span>
            </figure>
          </div>
          <div className="hist-main">
            <div className="hist-text">
              <h2>{t.histTitle}</h2>
              <p>{t.histBody.map((s, i) => (s.b ? <strong key={i}>{s.t}</strong> : s.t))}</p>
            </div>
            <div className="hist-stats">
              <div><b>3 000 000+</b><span>{t.stat1}</span></div>
              <div><b>600+</b><span>{t.stat2}</span></div>
              <div><b>53</b><span>{t.stat3}</span></div>
              <div><b>{lang === 'fr' ? '10 ans' : '10 years'}</b><span>{t.stat4}</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="cta-final">
        <h2>{t.ctaTitle}</h2>
        <p>{t.ctaSub}</p>
        <StoreButtons variant="primary" size="lg" />
      </section>

      <SiteFooter />

      <style jsx>{`
        h2 { font-size: var(--font-size-xxl); font-weight: var(--font-weight-bold); color: var(--text-primary); letter-spacing: var(--letter-spacing-tight); }
        h3 { font-size: var(--font-size-lg); font-weight: var(--font-weight-bold); color: var(--text-primary); }
        h4 { font-size: var(--font-size-md); font-weight: var(--font-weight-bold); color: var(--text-primary); }
        #produit, #referentiel, #tarifs, #qui-sommes-nous { scroll-margin-top: 72px; }

        .hero-wrap { display: flex; flex-direction: column; }
        .hero { position: relative; display: flex; align-items: center; justify-content: center; text-align: center; min-height: calc(100vh - 60px); min-height: calc(100svh - 60px); padding: 5rem 1.5rem; overflow: hidden; }
        /* Desktop : hero + barre de stats = une hauteur d'ecran sous le menu */
        @media (min-width: 769px) {
          .hero-wrap { height: calc(100vh - 60px); height: calc(100svh - 60px); }
          .hero { min-height: 0; flex: 1 1 auto; }
        }
        .hero-video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0; }
        .hero-overlay { position: absolute; inset: 0; background: rgba(9,9,11,0.68); z-index: 1; }
        .hero-content { position: relative; z-index: 2; max-width: 780px; display: flex; flex-direction: column; align-items: center; gap: 1.25rem; }
        .hero h1 { font-size: clamp(2.4rem, 6.5vw, 3.6rem); font-weight: var(--font-weight-bold); line-height: 1.08; letter-spacing: var(--letter-spacing-tight); color: #fff; white-space: pre-line; }
        .hero .sub { font-size: var(--font-size-lg); line-height: var(--line-height-relaxed); color: rgba(255,255,255,0.85); max-width: 640px; }
        .hero-actions { display: flex; flex-direction: column; align-items: center; gap: 0.6rem; margin-top: 0.25rem; }
        .hero-ctas { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; justify-content: center; }
        .hero-downloads { display: flex; justify-content: center; }
        :global(.ghost-cta) { display: inline-flex; align-items: center; gap: 0.45rem; padding: 0.85rem 1.4rem; border: 2px solid rgba(255,255,255,0.9); border-radius: var(--radius-sm); background: rgba(9,9,11,0.5); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); color: #fff; font-size: var(--font-size-sm); font-weight: var(--font-weight-bold); white-space: nowrap; box-shadow: 0 2px 12px rgba(0,0,0,0.3); transition: all var(--transition-fast); }
        :global(.ghost-cta:hover) { background: rgba(255,255,255,0.95); border-color: #fff; color: #18181B; text-decoration: none; }
        /* Bande de stats sous le hero : 3 parties */
        .hero-stats { background: var(--background-secondary); border-bottom: 1px solid var(--border-color); }
        .hero-stats-inner { max-width: var(--max-width-content); margin: 0 auto; display: grid; grid-template-columns: repeat(4, 1fr); }
        .hstat { display: flex; flex-direction: column; align-items: center; gap: 0.3rem; padding: 1.75rem 1rem; text-align: center; }
        .hstat + .hstat { border-left: 1px solid var(--border-color); }
        .hstat b { font-size: clamp(1.6rem, 4.5vw, 2.4rem); font-weight: var(--font-weight-black); color: var(--text-primary); line-height: 1; }
        .hstat span { font-size: var(--font-size-sm); color: var(--text-tertiary); text-transform: uppercase; letter-spacing: var(--letter-spacing-wide); }

        /* Bande partenaires : logos sans fond, en niveaux de gris */
        .partners { max-width: var(--max-width-content); margin: 0 auto; padding: 3.5rem 1.5rem; }
        .partners-label { text-align: center; font-size: var(--font-size-xs); font-weight: var(--font-weight-bold); text-transform: uppercase; letter-spacing: var(--letter-spacing-wide); color: var(--text-tertiary); margin-bottom: 2rem; }
        .partners-row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 2.75rem 2rem; align-items: center; justify-items: center; }
        .partner { display: inline-flex; align-items: center; justify-content: center; height: 56px; }
        .partner :global(img) { height: 100%; width: auto; max-width: 170px; object-fit: contain; filter: grayscale(1); opacity: 0.6; mix-blend-mode: multiply; transition: filter var(--transition-fast), opacity var(--transition-fast); }
        .partner:hover :global(img) { filter: grayscale(0); opacity: 1; }
        .partner-text { font-size: var(--font-size-sm); font-weight: var(--font-weight-bold); color: var(--text-tertiary); text-align: center; max-width: 160px; line-height: var(--line-height-snug); opacity: 0.75; transition: color var(--transition-fast), opacity var(--transition-fast); }
        .partner-text:hover { color: var(--text-secondary); opacity: 1; }
        :global([data-theme='dark']) .partner :global(img) { filter: grayscale(1) invert(1); mix-blend-mode: screen; opacity: 0.6; }
        :global([data-theme='dark']) .partner:hover :global(img) { filter: none; mix-blend-mode: normal; opacity: 1; }

        .section { max-width: var(--max-width-content); margin: 0 auto; padding: 4.5rem 1.5rem; }
        .section.alt { background: var(--background-secondary); max-width: none; }
        .section.alt > .head, .section.alt > .feat-grid { max-width: var(--max-width-content); margin-left: auto; margin-right: auto; }
        .head { text-align: center; max-width: 720px; margin: 0 auto 2.5rem; }
        .head p { margin-top: 0.85rem; color: var(--text-secondary); font-size: var(--font-size-md); line-height: var(--line-height-relaxed); }

        /* --- Pourquoi les competences du numerique : chaine a gauche, 4 raisons (2x2) a droite --- */
        .why { max-width: var(--max-width-content); margin: 0 auto; padding: 4.5rem 1.5rem 1rem; }
        .why-inner { display: grid; grid-template-columns: 1fr 1.05fr; gap: 4rem; align-items: center; }
        .why-visual { position: relative; }
        .why-content { display: flex; flex-direction: column; gap: 1.75rem; }
        .why-head { text-align: left; max-width: none; margin: 0; }
        .why-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; }
        .why-card { position: relative; overflow: hidden; display: flex; flex-direction: column; gap: 0.85rem; padding: 1.5rem; border: 1px solid var(--border-color); border-radius: var(--radius-lg); background: var(--surface); transition: border-color var(--transition-fast), transform var(--transition-fast); }
        .why-card:hover { border-color: var(--border-strong); transform: translateY(-3px); }
        /* Icone en filigrane gris : grosse, tout en bas a droite, qui deborde du coin */
        .wic { position: absolute; right: -0.85rem; bottom: -2.1rem; z-index: 0; padding: 0; background: none; color: var(--text-tertiary); opacity: 0.16; pointer-events: none; transition: opacity var(--transition-fast); }
        .wic :global(svg) { width: 7rem; height: 7rem; }
        .why-card:hover .wic { opacity: 0.24; }
        .why-card h4 { position: relative; z-index: 1; font-size: var(--font-size-md); }
        .why-card p { position: relative; z-index: 1; font-size: var(--font-size-sm); color: var(--text-secondary); line-height: var(--line-height-snug); }

        .loop-chips { display: flex; align-items: center; justify-content: center; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 2.75rem; }
        .chip { padding: 0.55rem 1.25rem; border-radius: var(--radius-full); background: var(--surface); border: 1px solid var(--border-strong); font-size: var(--font-size-sm); font-weight: var(--font-weight-bold); color: var(--text-primary); }
        .loop-chips :global(.chip-arrow) { color: var(--text-tertiary); }
        .loop-chips :global(.chip-loop) { color: var(--primary); }

        .ic { display: inline-flex; padding: 0.7rem; border-radius: var(--radius-md); margin-bottom: 1rem; }
        .ic.learn { color: var(--skill-knowledge); background: var(--skill-knowledge-bg); }
        .ic.advance { color: var(--skill-tool-platform); background: var(--skill-tool-platform-bg); }

        /* --- Les 2 agents : showcase alterne avec illustration smartphone --- */
        .agents { max-width: var(--max-width-content); margin: 0 auto; padding: 4.5rem 1.5rem; }
        .eyebrow { display: inline-block; font-size: var(--font-size-xs); font-weight: var(--font-weight-bold); text-transform: uppercase; letter-spacing: var(--letter-spacing-wide); color: var(--text-tertiary); margin-bottom: 0.85rem; }

        .agent-row { display: grid; grid-template-columns: 1.05fr 0.95fr; gap: 3.5rem; align-items: center; max-width: 980px; margin: 0 auto; }
        .agent-row.reverse { margin-top: 4.5rem; }
        .agent-row.reverse .agent-device { order: -1; }

        /* Tag agent : chip clair borde avec badge circulaire colore portant l'icone */
        .agent-eyebrow { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.28rem 0.9rem 0.28rem 0.3rem; border-radius: var(--radius-full); font-size: var(--font-size-xs); font-weight: var(--font-weight-bold); text-transform: uppercase; letter-spacing: var(--letter-spacing-wide); margin-bottom: 1.1rem; background: var(--surface); color: var(--text-primary); border: 1px solid var(--border-color); box-shadow: 0 1px 2px rgba(9,9,11,0.05); }
        .agent-eyebrow .ae-ico { display: inline-flex; align-items: center; justify-content: center; width: 1.55rem; height: 1.55rem; border-radius: var(--radius-full); color: #fff; flex: none; }
        .agent-eyebrow.learn .ae-ico { background: var(--skill-knowledge); }
        .agent-eyebrow.advance .ae-ico { background: var(--skill-tool-platform); }
        .agent-copy { position: relative; z-index: 1; }
        .agent-copy h3 { font-size: var(--font-size-xxl); letter-spacing: var(--letter-spacing-tight); }
        .agent-copy p { color: var(--text-secondary); font-size: var(--font-size-md); line-height: var(--line-height-relaxed); margin: 0.75rem 0 1.5rem; }
        .agent-acc { border-top: 1px solid var(--border-color); }
        .agent-acc :global(.acc-item) { border-bottom: 1px solid var(--border-color); }
        .agent-acc :global(.acc-item summary) { list-style: none; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0.85rem 0; font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--text-primary); }
        .agent-acc :global(.acc-item summary::-webkit-details-marker) { display: none; }
        .agent-acc :global(.acc-item summary svg) { color: var(--text-tertiary); flex: none; transition: transform var(--transition-fast); }
        .agent-acc :global(.acc-item[open] summary svg) { transform: rotate(180deg); }
        .agent-acc :global(.acc-item[open] summary) { color: var(--accent, var(--primary)); }
        .agent-acc :global(.acc-item p) { margin: 0; padding: 0 0 0.95rem; font-size: var(--font-size-sm); color: var(--text-secondary); line-height: var(--line-height-relaxed); }

        /* Mockup smartphone (couleur du bezel figee : c'est un objet physique, pas une surface du theme) */
        .agent-device { position: relative; width: fit-content; margin: 0 auto; }
        .agent-device.learn { --accent: var(--skill-knowledge); }
        .agent-device.advance { --accent: var(--skill-tool-platform); }
        .phone { position: relative; z-index: 1; width: 248px; aspect-ratio: 9 / 18.5; padding: 0.5rem; background: #18181B; border-radius: 2.5rem; border: 1px solid rgba(255,255,255,0.06); box-shadow: var(--shadow-lg); }
        .phone-notch { position: absolute; top: 0.85rem; left: 50%; transform: translateX(-50%); width: 34%; height: 1.05rem; background: #09090B; border-radius: var(--radius-full); z-index: 2; }
        .phone-screen { position: relative; width: 100%; height: 100%; border-radius: 2rem; overflow: hidden; background: var(--surface); }
        .agent-device :global(.phone-img) { width: 100%; height: 100%; object-fit: cover; }

        .ref-band { background: var(--background-secondary); border-top: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color); }
        .ref-inner { max-width: var(--max-width-content); margin: 0 auto; padding: 5rem 1.5rem; display: grid; grid-template-columns: 1fr 1.05fr; gap: 4rem; align-items: center; }
        .ref-copy { display: flex; flex-direction: column; align-items: flex-start; }
        .ref-copy h2 { margin-bottom: 1rem; }
        .ref-desc { color: var(--text-secondary); font-size: var(--font-size-md); line-height: var(--line-height-relaxed); }
        .stats { display: flex; align-items: center; gap: 1.75rem; margin: 1.5rem 0; }
        .stat { display: flex; flex-direction: column; }
        .num { font-size: var(--font-size-xxl); font-weight: var(--font-weight-black); color: var(--text-primary); line-height: 1; }
        .lbl { font-size: var(--font-size-xs); color: var(--text-tertiary); text-transform: uppercase; letter-spacing: var(--letter-spacing-wide); margin-top: 0.3rem; }
        .sep { width: 1px; height: 2rem; background: var(--border-strong); }
        .ref-points { display: flex; flex-direction: column; gap: 0.75rem; width: 100%; margin-bottom: 1.75rem; text-align: left; }
        .ref-point { display: flex; gap: 0.75rem; padding: 1.1rem 1.25rem; border: 1px solid var(--border-color); border-radius: var(--radius-md); background: var(--surface); }
        .rp-ic { flex: none; color: var(--primary); display: inline-flex; }
        .ref-point h4 { margin-bottom: 0.3rem; }
        .ref-point p { font-size: var(--font-size-sm); color: var(--text-secondary); line-height: var(--line-height-snug); }
        :global(.ref-cta) { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.85rem 1.6rem; background: var(--primary); color: var(--text-on-primary); border-radius: var(--radius-sm); font-size: var(--font-size-sm); font-weight: var(--font-weight-bold); transition: opacity var(--transition-fast); }
        :global(.ref-cta:hover) { opacity: 0.9; color: var(--text-on-primary); text-decoration: none; }

        /* Visualisation du referentiel : le graphe vivant (carte sombre) */
        .ref-visual { position: relative; }
        :global(.ref-graph) { position: relative; display: block; aspect-ratio: 1.1 / 1; border-radius: var(--radius-xl); overflow: hidden; background: #09090B; border: 1px solid var(--border-strong); box-shadow: var(--shadow-lg); transition: transform var(--transition-slow), box-shadow var(--transition-slow); }
        :global(.ref-graph:hover) { transform: translateY(-4px); box-shadow: 0 16px 32px rgba(9,9,11,0.18); text-decoration: none; }
        :global(.ref-graph-img) { object-fit: cover; object-position: center; }

        .feat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.25rem; }
        .feat { padding: 1.5rem; border: 1px solid var(--border-color); border-radius: var(--radius-lg); background: var(--surface); }
        .feat-ic { display: inline-flex; color: var(--text-primary); margin-bottom: 0.75rem; }
        .feat p { color: var(--text-secondary); font-size: var(--font-size-sm); line-height: var(--line-height-relaxed); margin-top: 0.4rem; }

        .credits { display: grid; grid-template-columns: 1fr 1fr; gap: 2.5rem; align-items: center; padding: 2.5rem; border: 1px solid var(--border-color); border-radius: var(--radius-xl); background: var(--surface); }
        .credits-text p { color: var(--text-secondary); font-size: var(--font-size-md); line-height: var(--line-height-relaxed); margin-top: 0.75rem; }
        .credits-ill { display: block; width: 100%; max-width: 360px; height: auto; margin-bottom: 1.5rem; }
        .credits-table { display: flex; flex-direction: column; }
        .crow { display: flex; justify-content: space-between; align-items: center; padding: 0.85rem 0; border-bottom: 1px solid var(--border-color); font-size: var(--font-size-sm); }
        .crow:last-child { border-bottom: none; }
        .crow span { color: var(--text-secondary); }
        .crow b { color: var(--skill-language); font-weight: var(--font-weight-bold); }

        .cta-final { max-width: 640px; margin: 0 auto; padding: 4.5rem 1.5rem 5.5rem; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 0.75rem; }
        .cta-final p { color: var(--text-secondary); font-size: var(--font-size-lg); margin-bottom: 1rem; }

        .hist { background: var(--background-secondary); border-top: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color); }
        .hist-inner { max-width: var(--max-width-content); margin: 0 auto; padding: 4rem 1.5rem; display: grid; grid-template-columns: 0.85fr 1.15fr; gap: 3.5rem; align-items: center; }
        .hist-main { display: flex; flex-direction: column; gap: 2rem; }
        .hist-text p { margin-top: 1rem; color: var(--text-secondary); font-size: var(--font-size-md); line-height: var(--line-height-relaxed); }
        /* Deux illustrations empilees (2016 derriere, 2026 devant) */
        .hist-visual { position: relative; padding: 1.5rem 2rem 3rem 0; }
        .hist-img { position: relative; margin: 0; width: 80%; aspect-ratio: 3 / 2; border-radius: var(--radius-lg); overflow: hidden; border: 1px solid var(--border-color); box-shadow: var(--shadow-lg); background: var(--surface); }
        .hist-img :global(img) { display: block; width: 100%; height: 100%; object-fit: cover; }
        .hist-img-1 { transform: rotate(-3deg); }
        .hist-img-2 { transform: rotate(3deg); margin-top: -16%; margin-left: 36%; z-index: 2; }
        .hist-tag { position: absolute; top: 0.7rem; left: 0.7rem; background: var(--primary); color: var(--text-on-primary); font-size: var(--font-size-xs); font-weight: var(--font-weight-bold); letter-spacing: var(--letter-spacing-wide); padding: 0.3rem 0.7rem; border-radius: var(--radius-full); }
        .hist-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
        .hist-stats > div { display: flex; flex-direction: column; }
        .hist-stats b { font-size: var(--font-size-xxxl); font-weight: var(--font-weight-black); color: var(--text-primary); line-height: 1; }
        .hist-stats span { font-size: var(--font-size-sm); color: var(--text-tertiary); margin-top: 0.3rem; }

        .team { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.25rem; }
        .member { position: relative; padding: 1.75rem 1.5rem; border: 1px solid var(--border-color); border-radius: var(--radius-lg); background: var(--surface); text-align: center; display: flex; flex-direction: column; align-items: center; }
        :global(.member .avatar) { width: 5rem; height: 5rem; border-radius: var(--radius-full); object-fit: cover; object-position: center top; border: 1px solid var(--border-color); margin-bottom: 1rem; }
        .member h3 { font-size: var(--font-size-md); }
        .role { font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold); color: var(--text-tertiary); text-transform: uppercase; letter-spacing: var(--letter-spacing-wide); margin: 0.3rem 0 0.75rem; }
        .member p { color: var(--text-secondary); font-size: var(--font-size-sm); line-height: var(--line-height-snug); flex: 1; }
        .li { display: inline-flex; margin-top: 1rem; color: var(--text-tertiary); }
        .li:hover { color: var(--text-primary); }

        @media (max-width: 1024px) { .team { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 880px) { .partners-row { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 560px) { .partners-row { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 880px) {
          .agent-row { grid-template-columns: 1fr; gap: 2.25rem; justify-items: center; text-align: center; max-width: 460px; }
          .agent-row .agent-copy { order: 1; display: flex; flex-direction: column; align-items: center; width: 100%; max-width: 420px; }
          .agent-row .agent-device,
          .agent-row.reverse .agent-device { order: 2; }
          .agent-acc { text-align: left; width: 100%; max-width: 360px; }
          .credits { grid-template-columns: 1fr; }
          .ref-inner { grid-template-columns: 1fr; gap: 2.5rem; max-width: 560px; }
          .ref-visual { order: -1; }
          .why-inner { grid-template-columns: 1fr; gap: 2.5rem; max-width: 560px; }
          .why-visual { order: -1; }
          .why-head { text-align: center; max-width: 720px; }
          .why-content { gap: 1.5rem; align-items: center; }
          .hist-inner { grid-template-columns: 1fr; gap: 2.5rem; }
          .hist-visual { max-width: 440px; margin: 0 auto; padding: 1rem 1.5rem 2.5rem 0; }
        }
        @media (max-width: 768px) {
          .hero { padding: 4rem 1.25rem; }
          .hero-stats-inner { grid-template-columns: repeat(2, 1fr); }
          .hstat { padding: 1.35rem 0.5rem; }
          .hstat:nth-child(odd) { border-left: none; }
          .hstat:nth-child(n+3) { border-top: 1px solid var(--border-color); }
          .section { padding: 3rem 1.25rem; }
          .why { padding: 3rem 1.25rem 0.5rem; }
          .why-grid { grid-template-columns: repeat(2, 1fr); }
          .agents { padding: 3rem 1.25rem; }
          .ref-inner { padding: 3rem 1.25rem; }
          .agent-row.reverse { margin-top: 3.25rem; }
          .phone { width: 216px; }
          .feat-grid { grid-template-columns: 1fr; max-width: 460px; margin: 0 auto; }
          .team { grid-template-columns: 1fr; max-width: 420px; margin: 0 auto; }
          .credits { padding: 1.5rem; }
          .stats { gap: 1.25rem; }
        }
      `}</style>
    </main>
  );
}
