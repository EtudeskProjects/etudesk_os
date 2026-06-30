'use client';

import React from 'react';

/** Rendu markdown léger : ## titres, - listes, paragraphes, **gras**. */
function inline(text: string, key: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith('**') && p.endsWith('**')
      ? <strong key={`${key}-${i}`}>{p.slice(2, -2)}</strong>
      : <React.Fragment key={`${key}-${i}`}>{p}</React.Fragment>
  );
}

export default function Markdown({ source }: { source: string }) {
  const blocks = source.split(/\n\n+/);
  return (
    <div className="md">
      {blocks.map((b, i) => {
        const lines = b.split('\n');
        if (lines.every((l) => l.startsWith('- '))) {
          return <ul key={i}>{lines.map((l, j) => <li key={j}>{inline(l.slice(2), `${i}-${j}`)}</li>)}</ul>;
        }
        if (b.startsWith('## ')) return <h2 key={i}>{inline(b.slice(3), `${i}`)}</h2>;
        if (b.startsWith('# ')) return <h2 key={i}>{inline(b.slice(2), `${i}`)}</h2>;
        return <p key={i}>{inline(b, `${i}`)}</p>;
      })}
      <style jsx>{`
        .md :global(h2) { font-size: var(--font-size-xl); font-weight: var(--font-weight-bold); color: var(--text-primary); margin: 2rem 0 0.75rem; letter-spacing: var(--letter-spacing-tight); }
        .md :global(p) { color: var(--text-secondary); font-size: var(--font-size-md); line-height: var(--line-height-relaxed); margin-bottom: 1rem; }
        .md :global(ul) { margin: 0 0 1rem 0; padding-left: 1.2rem; display: flex; flex-direction: column; gap: 0.4rem; }
        .md :global(li) { color: var(--text-secondary); font-size: var(--font-size-md); line-height: var(--line-height-relaxed); }
        .md :global(strong) { color: var(--text-primary); font-weight: var(--font-weight-bold); }
      `}</style>
    </div>
  );
}
