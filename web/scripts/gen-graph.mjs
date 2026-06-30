import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { forceSimulation, forceManyBody, forceLink, forceX, forceY, forceCollide } from 'd3-force';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'src/data');
const CSV = path.resolve(ROOT, '../datasets/etudesk_digital_skills/competency_edges.csv');

const competencies = JSON.parse(fs.readFileSync(path.join(DATA, 'competencies.json'), 'utf8'));
const index = new Map(competencies.map((c, i) => [c.slug, i]));

function parseCSV(t) {
  const rows = []; let i = 0, f = '', row = [], q = false;
  while (i < t.length) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i += 2; continue; } q = false; i++; continue; } f += c; i++; continue; }
    if (c === '"') { q = true; i++; continue; }
    if (c === ',') { row.push(f); f = ''; i++; continue; }
    if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; i++; continue; }
    if (c === '\r') { i++; continue; }
    f += c; i++;
  }
  if (f.length || row.length) { row.push(f); rows.push(row); }
  return rows;
}

const rows = parseCSV(fs.readFileSync(CSV, 'utf8')).filter((r) => r.length >= 4 && r[0] && r[0] !== 'from_slug');
const seen = new Set();
const edges = [];
for (const [from, to] of rows) {
  const a = index.get(from), b = index.get(to);
  if (a === undefined || b === undefined || a === b) continue;
  const key = a < b ? a + '_' + b : b + '_' + a;
  if (seen.has(key)) continue; seen.add(key);
  edges.push([Math.min(a, b), Math.max(a, b)]);
}

const deg = new Array(competencies.length).fill(0);
for (const [a, b] of edges) { deg[a]++; deg[b]++; }

const nodes = competencies.map((c, i) => ({ index: i }));
const links = edges.map(([s, t]) => ({ source: s, target: t }));

const sim = forceSimulation(nodes)
  .force('charge', forceManyBody().strength(-46).distanceMax(560))
  .force('link', forceLink(links).id((d) => d.index).distance(36).strength(0.3))
  .force('x', forceX(0).strength(0.013))
  .force('y', forceY(0).strength(0.013))
  .force('collide', forceCollide().radius((d) => 5 + Math.sqrt(deg[d.index]) * 1.6).iterations(2))
  .stop();

for (let i = 0; i < 500; i++) sim.tick();

let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
for (const n of nodes) { minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x); minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y); }
const W = 1700, H = 1200;
const s = Math.min((W - 80) / (maxX - minX), (H - 80) / (maxY - minY));
const ox = (W - (maxX - minX) * s) / 2 - minX * s, oy = (H - (maxY - minY) * s) / 2 - minY * s;
const pos = nodes.map((n) => [Math.round((n.x * s + ox) * 10) / 10, Math.round((n.y * s + oy) * 10) / 10]);

fs.writeFileSync(path.join(DATA, 'graph.json'), JSON.stringify({ w: W, h: H, pos, edges }));
console.log('nodes:', nodes.length, 'edges:', edges.length, 'KB:', Math.round(fs.statSync(path.join(DATA, 'graph.json')).size / 1024));
