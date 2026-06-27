# Etudesk Digital Skills Schema

> Data model for the skill catalog, the adjacency graph, and talent skill evaluations.
> Current catalog: `competency_catalog.csv` (1261 active skills, 16 families, 5 types, English and French labels).
> Adjacency graph: `competency_edges.csv` (4147 edges, generated + curated, adversarially reviewed).
> Release manifest: `competency_manifest.json` (`catalog_version`: `2026-Q2`).
> Last updated: June 24, 2026.

---

## 1. Competency

One row in `competency_catalog.csv` is one active catalog skill.

```
Competency {
  slug:   string   # stable kebab-case identifier; never rename after publication
  family: enum     # one of the 16 families below
  type:   enum     # knowledge | hard_skill | soft_skill | tool_platform | language
  name:    string   # English display name
  name_fr: string   # French display name
}
```

CSV columns: `slug,family,type,name,name_fr`.

Families:
`ai_ml`, `emerging_tech`, `data`, `software_dev`, `cybersecurity`,
`growth_marketing`, `industry_knowledge`, `human_skills`, `business_management`,
`media_content`, `product_design`, `sustainability_climate`, `fintech_finance`,
`cloud_devops`, `web3_blockchain`, `digital_literacy`.

Types:

| type | Meaning | Examples |
| --- | --- | --- |
| `knowledge` | Conceptual knowledge, not a direct deliverable | AI Governance, Ethical AI |
| `hard_skill` | Practical ability that produces a deliverable | Anomaly Detection, Churn Prediction |
| `soft_skill` | Behavioral or interpersonal skill | Active Listening, Adaptability |
| `tool_platform` | Mastery of a named tool, platform, or product | Apache Kafka, Anthropic Claude API |
| `language` | Natural language or formal language | Arabic, English, SQL, GraphQL |

Stability rules:
- `slug` is the canonical identifier stored in talent history.
- Changing `name` or `name_fr` must never change `slug`.
- To retire a skill, remove its catalog row and every edge that references its
  slug (validated by `validate_edges.py`). Product databases keep history through
  `catalog_version`, `framework_version`, and timestamps.

---

## 2. Catalog Versioning

The catalog is published as a versioned release. Each talent evaluation stores the catalog and framework versions used to produce it.

```
CatalogVersion {
  version:          string   # example: "2026-Q2"
  published_at:     datetime
  competency_count: int
  edge_count:       int
  checksum:         string
}
```

`competency_manifest.json` stores the current version, counts, and file checksums.

---

## 3. UserCompetency

One row is the current evaluated state of one talent on one skill. Historical states should be stored by the product database, not by rewriting catalog files.

```
UserCompetency {
  user_id:           string
  competency_id:     string     # FK -> Competency.slug
  catalog_version:   string
  framework_version: string
  level:             enum       # beginner | intermediate | advanced | master
  score:             int        # 1..4 ordinal level
  confidence:        float      # 0.0..1.0
  context:           string[]   # project, employer, domain, usage context
  source_ref:        string[]   # evidence links or internal evidence IDs
  inferred_from:     string[]   # neighbor slugs used as prior
  evidence_hash:     string     # stable hash for cache and idempotency
  rationale:         string     # short human-readable audit sentence
  last_evidence_at:  datetime
  decay_state:       enum       # active | stale | archived
  evaluated_by:      string
  updated_at:        datetime
}
```

`decay_state` keeps profiles current without deleting history:
- `active`: used normally.
- `stale`: visible, lower confidence, weaker inference weight.
- `archived`: historical only; excluded from matching, recommendations, and inference until new evidence reactivates it.

Level enum:

| score | level |
| ---: | --- |
| 1 | `beginner` |
| 2 | `intermediate` |
| 3 | `advanced` |
| 4 | `master` |

---

## 4. CompetencyEdge

`competency_edges.csv` is the required adjacency graph used for cheap, deterministic inference. If it is missing or invalid, neighbor-based inference is disabled for the request. The runtime LLM must never rebuild adjacency in production.

```
CompetencyEdge {
  from_slug: string
  to_slug:   string
  relation:  enum    # prerequisite | co_occurrence | sibling
  strength:  float   # 0.0..1.0
  reason:    string  # generation audit reason
}
```

The edge is directed. Inference reads evidence from an already evaluated neighbor (`to_slug`) to estimate the target skill (`from_slug`).

Relations:

| relation | Meaning | Typical strength |
| --- | --- | --- |
| `prerequisite` | `from_slug` usually requires `to_slug` | high, often `0.7+` |
| `co_occurrence` | Skills often appear together in practice | medium |
| `sibling` | Similar or adjacent skills in the same family | low to medium |

Current distribution:

| relation | edges |
| --- | ---: |
| `prerequisite` | 2145 |
| `sibling` | 1148 |
| `co_occurrence` | 716 |

Graph invariants (all enforced by `validate_edges.py`):
- the `prerequisite` relation is **acyclic** (a directed acyclic graph): if `A`
  requires `B`, no chain of prerequisites leads back to `A`;
- each ordered `(from_slug, to_slug)` pair carries **at most one** relation, so a
  neighbor never occupies two slots with conflicting relation types;
- `sibling` edges are always **same-family**; cross-family adjacency is modeled
  as `co_occurrence` (which may be hierarchy-compatible and need not be
  symmetric).

`competency_edges.csv` is the **single source of truth** for the graph. It is
hand-maintained and edited directly; there is no generation or merge step at
build time. Run `python3 validate_edges.py` after any edit: it checks every
edge (slugs exist in the catalog, relation is valid, strength in `(0, 1]`, no
self-loops, no duplicate `(from, to, relation)`, no conflicting relation on the
same ordered pair, no cross-family `sibling`, no `prerequisite` cycle, no orphan
skills) plus catalog label uniqueness (`name` and `name_fr` are each unique), and
refreshes `competency_manifest.json`. Validation fails the file rather than
silently accepting a broken edge.

The `reason` column records each edge's provenance and is informational only:
`family_foundation`, `knowledge_foundation`, `knowledge_underpins_skill`,
`same_family_type_similarity`, `same_family_cross_type_similarity`,
`tool_skill_overlap` (edges first produced by the original rule-based pass);
`curated_*` (added by hand); `adversarial_review` / `manual` (later edits). Use
`manual` for new hand-added edges.

Coverage: every catalog skill carries at least one edge (no orphans), enforced
by `validate_edges.py`. About 35 foundational `knowledge` skills (e.g.
`Statistics`, `Cryptography`, `Design Patterns`) are intentional sinks:
everything points to them as prerequisites and they are evaluated from direct
evidence, not inferred from their dependents.
