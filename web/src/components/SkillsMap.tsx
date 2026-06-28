'use client';

import React, { useRef, useEffect, useMemo, useState, useContext } from 'react';
import { forceSimulation, forceManyBody, forceLink, forceCollide, forceX, forceY, type Simulation } from 'd3-force';
import { ThemeContext } from '../contexts/ThemeContext';
import { competencies, TYPE_HEX, FAMILY_HEX, type Competency } from '../data/taxonomy';
import { getRelations, getDegree } from '../data/relations';
import graphRaw from '../data/graph.json';
import { RELATION_COLORS as REL_COLOR, type RelationKind as RelKind } from '@/lib/relation-colors';

const GRAPH = graphRaw as { w: number; h: number; pos: [number, number][]; edges: [number, number][] };
const SLUG_TO_IDX = new Map(competencies.map((c, i) => [c.slug, i]));
const DEG = competencies.map((c) => getDegree(c.slug));

// Noeuds de simulation (positions persistantes, seedees depuis le layout aere)
interface SimNode { idx: number; x: number; y: number; vx?: number; vy?: number; fx?: number | null; fy?: number | null; }
const NODES: SimNode[] = competencies.map((c, i) => ({ idx: i, x: GRAPH.pos[i][0], y: GRAPH.pos[i][1] }));

function arrow(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, size: number, backoff: number) {
  const a = Math.atan2(y1 - y0, x1 - x0);
  const tx = x1 - Math.cos(a) * backoff, ty = y1 - Math.sin(a) * backoff;
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.lineTo(tx - size * Math.cos(a - Math.PI / 7), ty - size * Math.sin(a - Math.PI / 7));
  ctx.lineTo(tx - size * Math.cos(a + Math.PI / 7), ty - size * Math.sin(a + Math.PI / 7));
  ctx.closePath(); ctx.fill();
}

interface Props {
  match: (c: Competency) => boolean;
  filtering: boolean;
  selected: string | null;
  onSelect: (slug: string) => void;
  lang: 'fr' | 'en';
  colorBy: 'family' | 'type';
}

export default function SkillsMap({ match, filtering, selected, onSelect, lang, colorBy }: Props) {
  const { isDark } = useContext(ThemeContext);
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<Simulation<SimNode, undefined> | null>(null);
  const viewRef = useRef({ scale: 0.6, x: 0, y: 0 });
  const drawRef = useRef<() => void>(() => {});
  const rafRef = useRef(0);
  const [hover, setHover] = useState<number | null>(null);

  // gesture state
  const gesture = useRef<{ mode: 'none' | 'pan' | 'node'; node: SimNode | null; sx: number; sy: number; vx: number; vy: number; moved: boolean }>(
    { mode: 'none', node: null, sx: 0, sy: 0, vx: 0, vy: 0, moved: false }
  );

  const selIdx = useMemo(() => (selected ? competencies.findIndex((c) => c.slug === selected) : -1), [selected]);

  const requestDraw = () => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => { rafRef.current = 0; drawRef.current(); });
  };

  // --- dessin (lit viewRef + NODES + props courantes) ---
  drawRef.current = () => {
    const canvas = canvasRef.current, wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const dpr = window.devicePixelRatio || 1;
    const w = wrap.clientWidth, h = wrap.clientHeight;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) { canvas.width = w * dpr; canvas.height = h * dpr; canvas.style.width = w + 'px'; canvas.style.height = h + 'px'; }
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const { scale, x: tx, y: ty } = viewRef.current;
    const sx = (i: number) => NODES[i].x * scale + tx;
    const sy = (i: number) => NODES[i].y * scale + ty;
    const hi = selIdx >= 0 ? selIdx : (hover ?? -1);

    // 1. toutes les aretes (faibles)
    ctx.lineWidth = Math.max(0.4, 0.55 * scale);
    ctx.strokeStyle = isDark ? 'rgba(250,250,250,0.10)' : 'rgba(9,9,11,0.09)';
    ctx.beginPath();
    for (const [a, b] of GRAPH.edges) {
      if (hi >= 0 && (a === hi || b === hi)) continue;
      ctx.moveTo(sx(a), sy(a)); ctx.lineTo(sx(b), sy(b));
    }
    ctx.stroke();

    const baseR = Math.max(1.5, 2 * scale);
    const nodeR = (i: number) => baseR * (1 + Math.min(2.4, Math.sqrt(DEG[i]) * 0.14));

    // 2. aretes du noeud actif : couleur par relation + sens
    const neigh = new Set<number>();
    const relOf = new Map<number, RelKind>();
    if (hi >= 0) {
      const rels = getRelations(competencies[hi].slug);
      for (const s of rels.pre) { const j = SLUG_TO_IDX.get(s); if (j !== undefined) relOf.set(j, 'pre'); }
      for (const s of rels.leads) { const j = SLUG_TO_IDX.get(s); if (j !== undefined && !relOf.has(j)) relOf.set(j, 'leads'); }
      for (const s of rels.sib) { const j = SLUG_TO_IDX.get(s); if (j !== undefined && !relOf.has(j)) relOf.set(j, 'sib'); }
      for (const s of rels.rel) { const j = SLUG_TO_IDX.get(s); if (j !== undefined && !relOf.has(j)) relOf.set(j, 'rel'); }
      ctx.lineWidth = Math.max(1, 1.3 * scale);
      for (const [a, b] of GRAPH.edges) {
        const other = a === hi ? b : (b === hi ? a : -1);
        if (other < 0) continue;
        neigh.add(other);
        const rk = relOf.get(other);
        const col = rk ? REL_COLOR[rk][isDark ? 'dark' : 'light'] : (isDark ? 'rgba(250,250,250,0.4)' : 'rgba(9,9,11,0.35)');
        ctx.strokeStyle = col;
        ctx.beginPath(); ctx.moveTo(sx(a), sy(a)); ctx.lineTo(sx(b), sy(b)); ctx.stroke();
        if (rk === 'pre' || rk === 'leads') {
          const depHi = rk === 'pre';
          const tipI = depHi ? hi : other, srcI = depHi ? other : hi;
          ctx.fillStyle = col;
          arrow(ctx, sx(srcI), sy(srcI), sx(tipI), sy(tipI), Math.max(5, 6 * scale), nodeR(tipI) + 2);
        }
      }
    }

    // 3. noeuds (taille ~ nombre de liens)
    for (let i = 0; i < NODES.length; i++) {
      const x = sx(i), y = sy(i);
      if (x < -16 || x > w + 16 || y < -16 || y > h + 16) continue;
      const c = competencies[i];
      const isMatch = !filtering || match(c);
      const isSel = i === selIdx, isHov = i === hover, isNeigh = neigh.has(i);
      let r = nodeR(i);
      if (isSel) r *= 1.5; else if (isHov || isNeigh) r *= 1.25;
      ctx.globalAlpha = isMatch ? 1 : 0.06;
      ctx.fillStyle = (colorBy === 'family' ? FAMILY_HEX[c.family] : TYPE_HEX[c.type])[isDark ? 'dark' : 'light'];
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      if (isSel) { ctx.globalAlpha = 1; ctx.lineWidth = 2; ctx.strokeStyle = isDark ? '#FAFAFA' : '#18181B'; ctx.stroke(); }
    }
    ctx.globalAlpha = 1;

    // 3b. noms des hubs (priorite aux plus connectes, sans chevauchement)
    if (scale > 0.3) {
      ctx.font = '600 12px Montserrat, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      const hubs: number[] = [];
      for (let i = 0; i < NODES.length; i++) if (DEG[i] >= 90 && i !== hi) hubs.push(i);
      hubs.sort((a, b) => DEG[b] - DEG[a]);
      const placed: { x0: number; y0: number; x1: number; y1: number }[] = [];
      for (const i of hubs) {
        const x = sx(i), y = sy(i);
        if (x < 0 || x > w || y < 0 || y > h) continue;
        const name = lang === 'fr' ? competencies[i].name_fr : competencies[i].name;
        const tw = ctx.measureText(name).width, ly = y + nodeR(i) + 4;
        const box = { x0: x - tw / 2 - 3, y0: ly - 2, x1: x + tw / 2 + 3, y1: ly + 15 };
        if (placed.some((p) => !(box.x1 < p.x0 || box.x0 > p.x1 || box.y1 < p.y0 || box.y0 > p.y1))) continue;
        placed.push(box);
        ctx.lineWidth = 3; ctx.strokeStyle = isDark ? 'rgba(9,9,11,0.85)' : 'rgba(255,255,255,0.92)';
        ctx.fillStyle = isDark ? '#E4E4E7' : '#27272A';
        ctx.strokeText(name, x, ly); ctx.fillText(name, x, ly);
      }
    }

    // 4. libelle du noeud actif (popover)
    if (hi >= 0) {
      const name = lang === 'fr' ? competencies[hi].name_fr : competencies[hi].name;
      const x = sx(hi), y = sy(hi);
      ctx.font = '600 13px Montserrat, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const tw = ctx.measureText(name).width, padX = 10, padY = 6;
      const bw = tw + padX * 2, bh = 14 + padY * 2, bx = x - bw / 2, by = y - 26 - bh, rr = 8;
      ctx.fillStyle = isDark ? '#FAFAFA' : '#18181B';
      ctx.beginPath();
      ctx.moveTo(bx + rr, by); ctx.arcTo(bx + bw, by, bx + bw, by + bh, rr);
      ctx.arcTo(bx + bw, by + bh, bx, by + bh, rr); ctx.arcTo(bx, by + bh, bx, by, rr);
      ctx.arcTo(bx, by, bx + bw, by, rr); ctx.closePath(); ctx.fill();
      ctx.fillStyle = isDark ? '#18181B' : '#FFFFFF';
      ctx.fillText(name, x, by + bh / 2);
    }
  };

  // --- simulation d3-force (vivante, statique au repos, rechauffee au drag) ---
  useEffect(() => {
    const links = GRAPH.edges.map(([s, t]) => ({ source: s, target: t }));
    const deg = DEG;
    const sim = forceSimulation<SimNode>(NODES)
      .force('charge', forceManyBody<SimNode>().strength(-46).distanceMax(560))
      .force('link', forceLink<SimNode, { source: number; target: number }>(links).id((d: SimNode) => d.idx).distance(36).strength(0.3))
      .force('collide', forceCollide<SimNode>().radius((d: SimNode) => 5 + Math.sqrt(deg[d.idx]) * 1.6).iterations(2))
      .force('x', forceX<SimNode>(0).strength(0.013))
      .force('y', forceY<SimNode>(0).strength(0.013))
      .alpha(0).stop();
    sim.on('tick', () => requestDraw());
    simRef.current = sim;

    // cadrage initial sur la bounding box
    const el = wrapRef.current;
    if (el) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const n of NODES) { minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x); minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y); }
      const w = el.clientWidth, h = el.clientHeight, pad = 50;
      const s = Math.min((w - 2 * pad) / (maxX - minX), (h - 2 * pad) / (maxY - minY));
      viewRef.current = { scale: s, x: (w - (maxX - minX) * s) / 2 - minX * s, y: (h - (maxY - minY) * s) / 2 - minY * s };
    }
    requestDraw();
    return () => { sim.stop(); };
  }, []);

  // redessiner quand l'apparence ou le filtre change (match change a chaque filtre)
  useEffect(() => { requestDraw(); }, [selIdx, hover, isDark, lang, colorBy, filtering, match]);
  useEffect(() => {
    const on = () => requestDraw();
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);

  const ptr = (e: React.PointerEvent) => {
    const r = wrapRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const world = (px: number, py: number) => {
    const v = viewRef.current;
    return { x: (px - v.x) / v.scale, y: (py - v.y) / v.scale };
  };
  const nodeAt = (px: number, py: number): SimNode | null => {
    const v = viewRef.current;
    let best: SimNode | null = null, bestD = 14 * 14;
    for (let i = 0; i < NODES.length; i++) {
      if (filtering && !match(competencies[i])) continue;
      const dx = NODES[i].x * v.scale + v.x - px, dy = NODES[i].y * v.scale + v.y - py;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = NODES[i]; }
    }
    return best;
  };

  return (
    <div className="map" ref={wrapRef}
      onPointerDown={(e) => {
        (e.target as Element).setPointerCapture(e.pointerId);
        const p = ptr(e);
        const n = nodeAt(p.x, p.y);
        const v = viewRef.current;
        if (n) { gesture.current = { mode: 'node', node: n, sx: p.x, sy: p.y, vx: 0, vy: 0, moved: false }; n.fx = n.x; n.fy = n.y; }
        else { gesture.current = { mode: 'pan', node: null, sx: p.x, sy: p.y, vx: v.x, vy: v.y, moved: false }; }
      }}
      onPointerMove={(e) => {
        const p = ptr(e);
        const g = gesture.current;
        if (g.mode === 'node' && g.node) {
          if (!g.moved && Math.abs(p.x - g.sx) + Math.abs(p.y - g.sy) > 3) { g.moved = true; simRef.current?.alphaTarget(0.3).restart(); }
          const wp = world(p.x, p.y);
          g.node.fx = wp.x; g.node.fy = wp.y;
          requestDraw();
        } else if (g.mode === 'pan') {
          const dx = p.x - g.sx, dy = p.y - g.sy;
          if (Math.abs(dx) + Math.abs(dy) > 3) g.moved = true;
          viewRef.current = { ...viewRef.current, x: g.vx + dx, y: g.vy + dy };
          requestDraw();
        } else {
          const n = nodeAt(p.x, p.y);
          const idx = n ? n.idx : null;
          setHover(idx);
          if (wrapRef.current) wrapRef.current.style.cursor = n ? 'grab' : 'default';
        }
      }}
      onPointerUp={(e) => {
        const p = ptr(e);
        const g = gesture.current;
        if (g.mode === 'node' && g.node) {
          if (g.moved) {
            // deplace : on epingle le noeud a l'endroit depose
            simRef.current?.alphaTarget(0);
          } else {
            // simple clic : on selectionne et on relache
            g.node.fx = null; g.node.fy = null;
            onSelect(competencies[g.node.idx].slug);
          }
        }
        gesture.current = { mode: 'none', node: null, sx: 0, sy: 0, vx: 0, vy: 0, moved: false };
        void p;
      }}
      onPointerLeave={() => { setHover(null); gesture.current = { mode: 'none', node: null, sx: 0, sy: 0, vx: 0, vy: 0, moved: false }; }}
      onWheel={(e) => {
        const p = ptr(e as unknown as React.PointerEvent);
        const v = viewRef.current;
        const f = e.deltaY < 0 ? 1.12 : 1 / 1.12;
        const ns = Math.min(6, Math.max(0.15, v.scale * f)), k = ns / v.scale;
        viewRef.current = { scale: ns, x: p.x - (p.x - v.x) * k, y: p.y - (p.y - v.y) * k };
        requestDraw();
      }}
    >
      <canvas ref={canvasRef} />
      <div className="zoom">
        <button onClick={() => { const v = viewRef.current; viewRef.current = { ...v, scale: Math.min(6, v.scale * 1.25) }; requestDraw(); }} aria-label="Zoom +">+</button>
        <button onClick={() => { const v = viewRef.current; viewRef.current = { ...v, scale: Math.max(0.15, v.scale / 1.25) }; requestDraw(); }} aria-label="Zoom -">&minus;</button>
      </div>
      <div className="legend">
        <span><i style={{ background: REL_COLOR.pre[isDark ? 'dark' : 'light'] }} />{lang === 'fr' ? 'Prérequis' : 'Prerequisite'}</span>
        <span><i style={{ background: REL_COLOR.sib[isDark ? 'dark' : 'light'] }} />{lang === 'fr' ? 'Voisines' : 'Neighbours'}</span>
        <span><i style={{ background: REL_COLOR.rel[isDark ? 'dark' : 'light'] }} />{lang === 'fr' ? 'Co-occurrence' : 'Co-occurrence'}</span>
      </div>
      {hover !== null && gesture.current.mode === 'none' && (
        <div className="tip">{lang === 'fr' ? competencies[hover].name_fr : competencies[hover].name}</div>
      )}
      <style jsx>{`
        .map { position: relative; width: 100%; height: 100%; cursor: default; touch-action: none; overflow: hidden; background: var(--background); }
        canvas { display: block; }
        .zoom { position: absolute; right: 14px; bottom: 14px; display: flex; flex-direction: column; gap: 0.4rem; }
        .zoom button { width: 2rem; height: 2rem; display: flex; align-items: center; justify-content: center; background: var(--surface); border: 1px solid var(--border-color); border-radius: var(--radius-sm); color: var(--text-primary); font-size: 1.1rem; cursor: pointer; box-shadow: var(--shadow-sm); }
        .zoom button:hover { border-color: var(--border-strong); background: var(--hover); }
        .legend { position: absolute; left: 14px; bottom: 14px; display: flex; flex-direction: column; gap: 0.3rem; background: var(--surface); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 0.55rem 0.7rem; box-shadow: var(--shadow-sm); }
        .legend span { display: flex; align-items: center; gap: 0.4rem; font-size: var(--font-size-xxs); color: var(--text-secondary); }
        .legend i { width: 0.9rem; height: 0.18rem; border-radius: var(--radius-xs); flex: none; }
        .tip { position: absolute; left: 50%; bottom: 12px; transform: translateX(-50%); background: var(--primary); color: var(--text-on-primary); padding: 0.4rem 0.8rem; border-radius: var(--radius-full); font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold); pointer-events: none; white-space: nowrap; max-width: 70%; overflow: hidden; text-overflow: ellipsis; }
      `}</style>
    </div>
  );
}
