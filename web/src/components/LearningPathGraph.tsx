'use client';

import React, { useContext, useEffect, useRef, useState } from 'react';
import { ThemeContext } from '../contexts/ThemeContext';
import { BY_SLUG, FAMILY_HEX, FAMILY_MAP } from '../data/taxonomy';

// Le parcours type "fundamentals -> IA appliquee" du referentiel Etudesk.
// slug = cle stable de la competence dans l'observatoire ; label = affichage.
const STEPS: { slug: string; label: string }[] = [
  { slug: 'git', label: 'Git' },
  { slug: 'version-control-workflows', label: 'Version Control Workflows' },
  { slug: 'python', label: 'Python' },
  { slug: 'data-analytics', label: 'Data Analytics' },
  { slug: 'bayesian-analysis', label: 'Bayesian Analysis' },
  { slug: 'linear-algebra', label: 'Linear Algebra' },
  { slug: 'machine-learning-fundamentals', label: 'Machine Learning Fundamentals' },
  { slug: 'deep-learning-model-training', label: 'Deep Learning Model Training' },
  { slug: 'neural-network-architectures', label: 'Neural Network Architectures' },
  { slug: 'transformer', label: 'Transformer' },
  { slug: 'foundation-models', label: 'Foundation Models' },
  { slug: 'model-fine-tuning', label: 'Model Fine-tuning' },
  { slug: 'low-rank-adaptation', label: 'Low-Rank Adaptation (LoRA)' },
];

const W = 680;
const H = 600;
const N = STEPS.length;

// Geometrie d'une pastille.
const CHAR_W = 7.05;
const PILL_H = 36;
const DOT = 24; // diametre de la pastille couleur portant l'icone
const DOT_PAD = 5; // marge gauche avant le dot
const TEXT_GAP = 9; // espace dot -> texte
const RIGHT_PAD = 16;
const MARGIN = 14;

const leftBlock = DOT_PAD + DOT + TEXT_GAP; // bord gauche -> debut du texte
function pillWidth(label: string) {
  return Math.round(label.length * CHAR_W + leftBlock + RIGHT_PAD);
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// Layout deterministe (meme rendu serveur/client) : une meandre verticale qui
// se replie au lieu d'etre une ligne droite. Chaque noeud est clampe pour ne
// jamais deborder de l'espace.
const BASE = STEPS.map((s, i) => {
  const t = i / (N - 1);
  const w = pillWidth(s.label);
  const half = w / 2;
  const raw = W / 2 + 158 * Math.sin(i * 1.02) + 48 * Math.sin(i * 2.27 + 1.15);
  const x = clamp(raw, MARGIN + half, W - MARGIN - half);
  const y = 44 + t * (H - 88);
  return { x, y, w };
});

// Famille + couleur exacte de l'observatoire (vue par defaut = par famille).
const META = STEPS.map((s) => {
  const c = BY_SLUG[s.slug];
  const family = c?.family;
  return {
    Icon: family ? FAMILY_MAP[family].Icon : null,
    hex: family ? FAMILY_HEX[family] : { light: '#71717A', dark: '#A1A1AA' },
  };
});

interface Props {
  lang?: 'fr' | 'en';
}

export default function LearningPathGraph({ lang = 'fr' }: Props) {
  const { isDark } = useContext(ThemeContext);
  const svgRef = useRef<SVGSVGElement>(null);
  const [pos, setPos] = useState(() => BASE.map((b) => ({ x: b.x, y: b.y })));
  const [now, setNow] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const dragRef = useRef<{ i: number; dx: number; dy: number } | null>(null);

  const iconInk = isDark ? '#0F0F11' : '#FFFFFF'; // icone en negatif sur le dot colore

  // Flottement continu et doux.
  useEffect(() => {
    let raf = 0;
    const loop = (t: number) => {
      setNow(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const toSvg = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };

  const onDown = (i: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const p = toSvg(e.clientX, e.clientY);
    dragRef.current = { i, dx: p.x - pos[i].x, dy: p.y - pos[i].y };
    setActive(i);
  };

  const onMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const p = toSvg(e.clientX, e.clientY);
    const half = BASE[d.i].w / 2;
    const nx = clamp(p.x - d.dx, MARGIN + half, W - MARGIN - half);
    const ny = clamp(p.y - d.dy, MARGIN + PILL_H / 2, H - MARGIN - PILL_H / 2);
    setPos((prev) => prev.map((q, k) => (k === d.i ? { x: nx, y: ny } : q)));
  };

  const onUp = (e: React.PointerEvent) => {
    if (dragRef.current) {
      try {
        (e.currentTarget as Element).releasePointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
    }
    dragRef.current = null;
    setActive(null);
  };

  // Position rendue = position + flottement (sauf le noeud en cours de drag).
  const pts = pos.map((p, i) => {
    const dragging = dragRef.current?.i === i;
    if (dragging) return { x: p.x, y: p.y };
    const fx = 5.5 * Math.sin(now / 1500 + i * 0.7);
    const fy = 4.5 * Math.cos(now / 1750 + i * 0.9);
    return { x: p.x + fx, y: p.y + fy };
  });

  const edgePath = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const my = (a.y + b.y) / 2;
    return `M ${a.x} ${a.y} C ${a.x} ${my}, ${b.x} ${my}, ${b.x} ${b.y}`;
  };

  return (
    <div
      className="lpg"
      role="img"
      aria-label={lang === 'fr' ? 'Parcours de competences du referentiel : de Git a LoRA' : 'Skills path from the referential: from Git to LoRA'}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
      >
        <defs>
          <linearGradient id="lpg-edge" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--skill-knowledge)" />
            <stop offset="1" stopColor="var(--skill-tool-platform)" />
          </linearGradient>
        </defs>

        {/* Aretes : trace doux + flux anime par-dessus */}
        {pts.slice(0, -1).map((p, i) => (
          <g key={`e${i}`}>
            <path d={edgePath(p, pts[i + 1])} className="lpg-link" />
            <path d={edgePath(p, pts[i + 1])} className="lpg-flow" style={{ animationDelay: `${i * -0.45}s` }} />
          </g>
        ))}

        {/* Noeuds */}
        {pts.map((p, i) => {
          const w = BASE[i].w;
          const isActive = active === i;
          const { Icon, hex } = META[i];
          const dotCx = DOT_PAD + DOT / 2;
          const dotCy = PILL_H / 2;
          return (
            <g
              key={`n${i}`}
              transform={`translate(${p.x - w / 2}, ${p.y - PILL_H / 2})`}
              className={`lpg-node${isActive ? ' is-active' : ''}`}
              onPointerDown={onDown(i)}
              style={{ touchAction: 'none', cursor: isActive ? 'grabbing' : 'grab' }}
            >
              <rect width={w} height={PILL_H} rx={PILL_H / 2} className="lpg-pill" />
              <circle cx={dotCx} cy={dotCy} r={DOT / 2} fill={hex[isDark ? 'dark' : 'light']} className="lpg-dot" />
              {Icon && (
                <g transform={`translate(${dotCx - 7}, ${dotCy - 7})`} className="lpg-ic">
                  <Icon width={14} height={14} color={iconInk} strokeWidth={1.25} />
                </g>
              )}
              <text x={leftBlock} y={PILL_H / 2} className="lpg-label" dominantBaseline="central">
                {STEPS[i].label}
              </text>
            </g>
          );
        })}
      </svg>

      <style jsx>{`
        .lpg {
          position: relative;
          width: 100%;
          aspect-ratio: 680 / 600;
          user-select: none;
          -webkit-user-select: none;
        }
        .lpg svg {
          display: block;
          overflow: visible;
        }
        .lpg :global(.lpg-link) {
          fill: none;
          stroke: var(--border-strong);
          stroke-width: 1.4;
          opacity: 0.55;
        }
        .lpg :global(.lpg-flow) {
          fill: none;
          stroke: url(#lpg-edge);
          stroke-width: 1.6;
          stroke-linecap: round;
          stroke-dasharray: 5 150;
          opacity: 0.85;
          animation: lpg-dash 5.5s linear infinite;
        }
        @keyframes lpg-dash {
          to {
            stroke-dashoffset: -310;
          }
        }
        .lpg :global(.lpg-pill) {
          fill: var(--surface);
          stroke: var(--border-color);
          stroke-width: 1;
          transition: stroke var(--transition-fast), filter var(--transition-fast);
        }
        .lpg :global(.lpg-label) {
          fill: var(--text-secondary);
          font-size: 13px;
          font-weight: var(--font-weight-semibold, 600);
          font-family: var(--font-sans, inherit);
          pointer-events: none;
        }
        .lpg :global(.lpg-dot),
        .lpg :global(.lpg-ic) {
          pointer-events: none;
        }
        .lpg :global(.lpg-node:hover .lpg-pill),
        .lpg :global(.lpg-node.is-active .lpg-pill) {
          stroke: var(--text-primary);
          filter: drop-shadow(0 6px 14px rgba(9, 9, 11, 0.12));
        }
        .lpg :global(.lpg-node:hover .lpg-label),
        .lpg :global(.lpg-node.is-active .lpg-label) {
          fill: var(--text-primary);
        }
        @media (prefers-reduced-motion: reduce) {
          .lpg :global(.lpg-flow) {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
