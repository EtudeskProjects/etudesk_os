'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronRight } from 'lucide-react';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import StoreButtons from '@/components/StoreButtons';
import type { Lang } from '@/lib/i18n';
import type { SkillContent, RelatedSkill } from '@/lib/skill-content';

interface Props {
  lang: Lang;
  content: SkillContent;
}

export default function SkillView({ lang, content }: Props) {
  const fr = lang === 'fr';
  const skillUrl = (slug: string) => `/${lang}/digital-skills/${slug}`;

  const groups: { key: string; label: string; items: RelatedSkill[] }[] = [
    { key: 'pre', label: fr ? 'Prérequis' : 'Prerequisites', items: content.pre },
    { key: 'leads', label: fr ? 'Mène vers' : 'Leads to', items: content.leads },
    { key: 'sib', label: fr ? 'Compétences voisines' : 'Neighbouring skills', items: content.sib },
    { key: 'rel', label: fr ? 'Souvent associées' : 'Often associated', items: content.rel },
  ].filter((g) => g.items.length > 0);

  return (
    <main>
      <SiteHeader />

      <article className="skill">
        <nav className="crumb" aria-label="Breadcrumb">
          <Link href={`/${lang}/digital-skills`}>{fr ? 'Référentiel' : 'Referential'}</Link>
          <ChevronRight size={14} strokeWidth={1.25} />
          <Link href={`/${lang}/digital-skills`}>{content.familyLabel}</Link>
          <ChevronRight size={14} strokeWidth={1.25} />
          <span aria-current="page">{content.name}</span>
        </nav>

        <header className="skill-head">
          <div className="skill-tags">
            <span className="tag tag-type">{content.typeLabel}</span>
            <span className="tag">{content.familyLabel}</span>
          </div>
          <h1>{content.name}</h1>
          <p className="lede">{content.intro}</p>
          <div className="skill-cta">
            <StoreButtons variant="brand" size="lg" />
          </div>
        </header>

        {content.paragraphs.length > 0 && (
          <section className="skill-body">
            {content.paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </section>
        )}

        {groups.length > 0 && (
          <section className="skill-rel">
            {groups.map((g) => (
              <div key={g.key} className="rel-group">
                <h2>{g.label}</h2>
                <div className="rel-chips">
                  {g.items.map((s) => (
                    <Link key={s.slug} href={skillUrl(s.slug)} className="rel-chip">
                      {s.name}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}

        <section className="skill-foot-cta">
          <h2>{fr ? `Apprends ${content.name} avec ton tuteur IA` : `Learn ${content.name} with your AI tutor`}</h2>
          <p>
            {fr
              ? 'Quiz, flashcards, exercices résolus et explications multimodales. Sans abonnement, 30 crédits offerts.'
              : 'Quizzes, flashcards, solved exercises and multimodal explanations. No subscription, 30 free credits.'}
          </p>
          <div className="foot-actions">
            <StoreButtons variant="brand" size="lg" />
            <Link href={`/${lang}/digital-skills`} className="ghost-link">
              {fr ? 'Explorer le référentiel' : 'Explore the referential'}
              <ArrowRight size={16} strokeWidth={1.25} />
            </Link>
          </div>
        </section>
      </article>

      <SiteFooter />

      <style jsx>{`
        .skill { max-width: 820px; margin: 0 auto; padding: 3rem 1.5rem 4rem; }
        .crumb { display: flex; align-items: center; flex-wrap: wrap; gap: 0.4rem; font-size: var(--font-size-sm); color: var(--text-tertiary); margin-bottom: 1.75rem; }
        .crumb :global(a) { color: var(--text-tertiary); text-decoration: none; }
        .crumb :global(a:hover) { color: var(--text-primary); }
        .crumb :global(svg) { color: var(--text-tertiary); flex: none; }
        .crumb span { color: var(--text-secondary); }

        .skill-head { border-bottom: 1px solid var(--border-color); padding-bottom: 2rem; margin-bottom: 2rem; }
        .skill-tags { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem; }
        .tag { display: inline-flex; align-items: center; padding: 0.3rem 0.75rem; border-radius: var(--radius-full); font-size: var(--font-size-xs); font-weight: var(--font-weight-bold); text-transform: uppercase; letter-spacing: var(--letter-spacing-wide); background: var(--background-tertiary); color: var(--text-secondary); border: 1px solid var(--border-color); }
        .tag-type { background: var(--skill-knowledge-bg); color: var(--skill-knowledge); border-color: transparent; }
        .skill-head h1 { font-size: clamp(2rem, 5vw, 3rem); font-weight: var(--font-weight-bold); letter-spacing: var(--letter-spacing-tight); line-height: 1.1; }
        .lede { margin-top: 1rem; font-size: var(--font-size-lg); line-height: var(--line-height-relaxed); color: var(--text-secondary); }
        .skill-cta { margin-top: 1.75rem; }

        .skill-body p { font-size: var(--font-size-md); line-height: var(--line-height-relaxed); color: var(--text-secondary); margin-bottom: 1rem; }

        .skill-rel { display: flex; flex-direction: column; gap: 1.75rem; margin-top: 2.5rem; }
        .rel-group h2 { font-size: var(--font-size-sm); text-transform: uppercase; letter-spacing: var(--letter-spacing-wide); color: var(--text-tertiary); font-weight: var(--font-weight-bold); margin-bottom: 0.85rem; }
        .rel-chips { display: flex; flex-wrap: wrap; gap: 0.5rem; }
        .rel-chips :global(.rel-chip) { display: inline-flex; align-items: center; padding: 0.45rem 0.9rem; border-radius: var(--radius-full); font-size: var(--font-size-sm); font-weight: var(--font-weight-medium); color: var(--text-primary); background: var(--surface); border: 1px solid var(--border-color); text-decoration: none; transition: border-color var(--transition-fast), transform var(--transition-fast); }
        .rel-chips :global(.rel-chip:hover) { border-color: var(--text-primary); transform: translateY(-2px); text-decoration: none; }

        .skill-foot-cta { margin-top: 3rem; padding: 2.5rem; border: 1px solid var(--border-color); border-radius: var(--radius-xl); background: var(--background-secondary); text-align: center; }
        .skill-foot-cta h2 { font-size: var(--font-size-xl); font-weight: var(--font-weight-bold); letter-spacing: var(--letter-spacing-tight); }
        .skill-foot-cta p { margin-top: 0.75rem; color: var(--text-secondary); font-size: var(--font-size-md); }
        .foot-actions { display: flex; flex-direction: column; align-items: center; gap: 1rem; margin-top: 1.75rem; }
        .foot-actions :global(.ghost-link) { display: inline-flex; align-items: center; gap: 0.4rem; font-size: var(--font-size-sm); font-weight: var(--font-weight-bold); color: var(--text-primary); text-decoration: none; }
        .foot-actions :global(.ghost-link:hover) { text-decoration: underline; }
      `}</style>
    </main>
  );
}
