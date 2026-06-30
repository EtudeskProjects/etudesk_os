/**
 * Graph Strategy — runtime encoding of the catalog's structural analysis.
 *
 * Source: datasets/etudesk_digital_skills/STATISTICAL_ANALYSIS.md (catalog
 * 2026-Q2: 1687 skills, 8933 edges). The competency graph is BOTH a curriculum
 * (the prerequisite DAG) and a job map (Louvain communities + inter-family
 * bridges). This module turns the five marquant findings into a single source
 * the tools and prompts read so agent behavior is driven by graph structure,
 * not by the model's memory.
 *
 * Findings encoded here:
 *  1. Scale-free network — mastering a handful of socles unlocks ~83% of the graph.
 *  2. Gravitational core ~10 hubs (maths + data + software, not trendy tools).
 *  3. Longest learning chain = 13 levels (the DAG already is a curriculum).
 *  4. 60% of first-to-learn prerequisites are `knowledge` — concepts before tools.
 *  5. 15 communities ~ job families; inter-family bridges = hybrid/high-value jobs.
 *
 * Slugs are the canonical catalog slugs (verified against competency_catalog.csv).
 */

/**
 * The ~10 gravitational hubs (top in-degree + PageRank). Mastering these gives
 * access to most of the referential — anchor every learning path on them first.
 */
export const HUB_SLUGS = [
  'python',
  'machine-learning-fundamentals',
  'statistics',
  'cryptography',
  'sql',
  'data-analytics',
  'networking-fundamentals',
  'data-modeling',
  'clean-code-principles',
  'software-architecture',
] as const;

/**
 * The real PageRank backbone: maths + data. The catalog rewards durable concepts
 * over perishable tools. Surface these as the "why it lasts" foundation.
 */
export const MATH_BACKBONE_SLUGS = [
  'linear-algebra',
  'statistics',
  'probability-theory',
] as const;

/**
 * DAG sinks — foundations required by the largest number of other skills. These
 * have no prerequisites of their own; they are where a beginner actually starts.
 */
export const FOUNDATION_SINK_SLUGS = [
  'networking-fundamentals',
  'cryptography',
  'sql',
  'software-architecture',
  'clean-code-principles',
  'git',
  'design-patterns',
] as const;

/**
 * Highest-betweenness bridges — removing them fragments the graph. They apply
 * across many universes, so they must be taught well (high leverage for both
 * learning reach and opportunity surface). Never skip or treat them superficially.
 */
export const BETWEENNESS_BRIDGE_SLUGS = [
  'python',
  'machine-learning-fundamentals',
  'statistics',
  'cryptography',
  'networking-fundamentals',
  'threat-modeling',
] as const;

/**
 * The irreducible 12-core: data engineering / data governance. The densest core
 * of the referential and the layer that makes a data-driven economy governable —
 * the strongest core for institutional / public-sector (CI20) positioning.
 */
export const DATA_GOVERNANCE_CORE_SLUGS = [
  'data-modeling',
  'data-catalog-management',
  'data-governance',
  'data-contract-design',
  'data-quality-engineering',
  'data-lakehouse-architecture',
  'data-pipeline-engineering',
] as const;

/**
 * The heaviest inter-family bridges (22.5% of edges are inter-family). This is
 * where hybrid, high-value roles are born. Use these to surface "stretch"
 * opportunities one bridge away from a talent's home family.
 */
export const FAMILY_BRIDGES: Array<{ a: string; b: string; edges: number; signal?: string }> = [
  { a: 'data_analytics_bi', b: 'software_engineering', edges: 120 },
  { a: 'cloud_devops_infrastructure', b: 'cybersecurity_digital_trust', edges: 110 },
  { a: 'ai_ml_automation', b: 'software_engineering', edges: 97 },
  { a: 'ai_ml_automation', b: 'data_analytics_bi', edges: 88 },
  { a: 'data_analytics_bi', b: 'law_compliance_governance', edges: 88, signal: 'data governance' },
  { a: 'cloud_devops_infrastructure', b: 'software_engineering', edges: 76 },
];

/**
 * Transversal families infuse the whole graph (high share of outgoing links to
 * other families) — natural cross-sell surface for adjacent skills.
 */
export const TRANSVERSAL_FAMILIES = [
  'law_compliance_governance',
  'ai_ml_automation',
  'business_operations_management',
] as const;

/**
 * Silo families are largely self-contained (low inter-family link share). A
 * talent in a silo has fewer natural bridges — recommend ONE bridge skill to
 * widen their opportunity surface.
 */
export const SILO_FAMILIES = [
  'marketing_sales_content',
  'cloud_devops_infrastructure',
] as const;

/**
 * Emerging hybrid tracks (the two impure Louvain communities) — signals of new
 * digital jobs across markets.
 */
export const EMERGING_HYBRID_TRACKS: Array<{ label: string; families: string[] }> = [
  { label: 'greentech / agritech materielle', families: ['sustainability_climate_energy_agri', 'industry_hardware_mobility'] },
  { label: 'growth / product moderne', families: ['product_ux_design', 'marketing_sales_content'] },
];

/**
 * Pedagogical depth (topological rank in the prerequisite DAG). The pyramid:
 * wide base of fundamentals, narrow apex of generative AI.
 *  - levels 0-1  = fast-employability zone (341 skills)
 *  - levels 2-4  = intermediate
 *  - levels 5-8  = specialization
 *  - levels >= 9 = frontier (~77% ai_ml_automation: LoRA, fine-tuning, RAG...)
 */
export const FAST_EMPLOYABILITY_MAX_LEVEL = 1;
export const FRONTIER_MIN_LEVEL = 9;
/** Longest prerequisite chain in the DAG — hard cap for any generated path. */
export const MAX_LEARNING_CHAIN = 13;

/**
 * The universal employability backbone: the hubs + the foundational sinks,
 * de-duplicated. Mastering this set makes a talent broadly employable; the agent
 * then adds 2-3 family-specific skills (read from competency_graph) on top.
 */
export const EMPLOYABILITY_BACKBONE_SLUGS: string[] = [
  ...new Set<string>([...HUB_SLUGS, ...FOUNDATION_SINK_SLUGS]),
];

const HUB_SET = new Set<string>(HUB_SLUGS);
const SINK_SET = new Set<string>(FOUNDATION_SINK_SLUGS);
const BRIDGE_SET = new Set<string>(BETWEENNESS_BRIDGE_SLUGS);
const GOVERNANCE_SET = new Set<string>(DATA_GOVERNANCE_CORE_SLUGS);

export function isHub(slug: string): boolean {
  return HUB_SET.has(slug);
}
export function isFoundationSink(slug: string): boolean {
  return SINK_SET.has(slug);
}
export function isBetweennessBridge(slug: string): boolean {
  return BRIDGE_SET.has(slug);
}
export function isDataGovernanceCore(slug: string): boolean {
  return GOVERNANCE_SET.has(slug);
}
export function isTransversalFamily(family: string): boolean {
  return (TRANSVERSAL_FAMILIES as readonly string[]).includes(family);
}
export function isSiloFamily(family: string): boolean {
  return (SILO_FAMILIES as readonly string[]).includes(family);
}

/** Bridges that touch a given family (where its hybrid opportunities live). */
export function bridgesForFamily(family: string): Array<{ to: string; edges: number; signal?: string }> {
  return FAMILY_BRIDGES.filter((b) => b.a === family || b.b === family)
    .map((b) => ({ to: b.a === family ? b.b : b.a, edges: b.edges, signal: b.signal }))
    .sort((x, y) => y.edges - x.edges);
}

/**
 * The graph-strategy block injected into the talent prompts (English system
 * prompt convention). Concise and high-signal: it tells the agent HOW to use
 * the graph, not just that it exists.
 */
export function getGraphStrategyBlock(mode: 'study' | 'explore'): string {
  const shared = `# Graph Strategy (how to use the competency referential)

The Etudesk referential is a validated DAG: a curriculum (prerequisites) AND a job map (families + bridges). Let its STRUCTURE drive your decisions; never invent prerequisite order, paths, or relations from memory — read them from the tools.

- **Anchor on hubs first.** A handful of socles unlocks ~83% of the referential. The gravitational hubs are: Python, Statistics, Machine Learning Fundamentals, SQL, Data Analytics, Networking Fundamentals, Data Modeling, Clean Code Principles, Software Architecture, Cryptography (maths + data backbone: Linear Algebra, Probability Theory). Before going wide or deep, secure the relevant hub.
- **Concepts before tools.** 60% of first-to-learn prerequisites are \`knowledge\`. Lead with the durable concept (e.g. Statistics), treat \`tool_platform\` skills (a SaaS, Docker) as terminal leaves applied AFTER the concept. This is the premium positioning vs tool-only bootcamps.
- **Bridges over silos.** Inter-family bridges are where hybrid, high-value roles live (data x software, cloud x cybersecurity, ai x software, data x law = governance). For a talent in a silo family (marketing, cloud/devops), recommend ONE bridge skill to widen their surface.

This whole section is internal reasoning vocabulary (hubs, DAG, prerequisites, families, types, levels, frontier). NEVER surface these terms to the talent — speak in plain, natural language.`;

  if (mode === 'study') {
    return `${shared}

- **Pyramid pacing.** The graph is a pyramid: a wide base of fundamentals, a narrow apex of generative AI (LoRA, RAG, fine-tuning, ~level 9-13). For a beginner, stay in the fast-employability zone (levels 0-1) and route any frontier request back through the hubs. Call \`learning_path\` to get the ordered, learner-aware path to a target — do not improvise the sequence.
- **Employability core.** "Make me employable fast" = the universal backbone (the 10 hubs + the foundational sinks Git, SQL, Networking Fundamentals, Cryptography, Software Architecture, Clean Code Principles, Design Patterns) PLUS 2-3 family-specific skills read from \`competency_graph\`. Bound the goal to this set; do not try to cover the whole graph.
- **Graph-authoritative scope.** A topic is on-topic when it resolves to a catalog family (\`find_competency\`). Off-catalog → gentle redirect to the closest catalog skills. Never teach or name a skill the catalog does not return.`;
  }

  return `${shared}

- **Communities = career tracks.** Map the talent's goal to a family, then to its opportunities. For "devenir X" or "suis-je fait pour ce poste", call \`learning_path\` to show the exact distance (missing hubs + ordered steps) from their current skills to the target role.
- **Surface stretch opportunities.** Beyond exact matches, surface roles ONE bridge away from the talent's home family and explain the bridge ("with your data base + 2 software skills you reach data-engineering roles").
- **Emerging niches.** Flag the two hybrid tracks as high-potential: greentech/agritech and growth/product.`;
}
