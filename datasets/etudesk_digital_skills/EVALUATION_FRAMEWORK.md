# Talent Skill Evaluation Framework

> Operational framework for AI services that create or update `UserCompetency` rows.
> This is not a human self-assessment form.
>
> Catalog: `competency_catalog.csv` (1211 active skills, English labels + French labels).
> Graph: `competency_edges.csv`.
> Current framework version: `2026-06-24`.

---

## 1. Goal

Evaluate what a person can currently do, not how many topics they have heard about.

Each evaluated skill receives one level:

| score | level | Meaning |
| ---: | --- | --- |
| 1 | `beginner` | Needs guidance on basic tasks |
| 2 | `intermediate` | Works independently on standard cases |
| 3 | `advanced` | Handles complex, ambiguous, or new cases |
| 4 | `master` | Sets standards and is a reference for others |

The service returns the full reconciled skill state for the talent. Historical records must be kept by the product database through `catalog_version`, `framework_version`, and timestamps.

---

## 2. Input And Output

```
EvalBatchInput {
  user_id: string
  catalog_version: string        # example: "2026-Q2"
  to_evaluate: Target[]
  stack: UserCompetency[]        # existing evaluated skills
}

Target {
  competency: { slug, family, type, name, name_fr }
  signals: Signal[]              # may be empty for graph-based inference
}

Signal {
  kind: "declared" | "artifact" | "behavioral" | "assessment"
  source_ref: string
  age_months: int
  note: string
}

EvalBatchOutput {
  competencies: UserCompetency[] # full reconciled state, including stale/archived rows
}
```

Rules:
- Every `competency.slug` must exist in `competency_catalog.csv`.
- `family` and `type` are read from the catalog, never guessed.
- Targets with no signal and no usable active neighbor are not created.
- `archived` skills remain in output as history, but are excluded from matching, recommendations, and inference.

---

## 3. Fast LLM Contract

The runtime LLM only makes the small judgment that cannot be handled deterministically: scoring direct evidence on four axes and selecting the type lens level.

The LLM never receives:
- the full catalog;
- the full talent stack;
- the full adjacency graph;
- free-form adjacency inference work.

Compact input:

```
LLMDirectInput {
  framework_version: "2026-06-24"
  catalog_version: "2026-Q2"
  competency: { slug, family, type, name, name_fr }
  type_lens: string[]              # only the 4 lines for this skill type
  family_profile: { cycle, gold_source, adjacency }
  signals: Signal[]                # max 5 normalized independent signals
  neighbor_summary: Neighbor[]     # max 8 pre-filtered active neighbors
}

Neighbor {
  slug: string
  relation: "prerequisite" | "co_occurrence" | "sibling"
  strength: float
  score: int
  confidence: float
}
```

Required strict JSON output:

```
{
  "items": [
    {
      "competency_id": "catalog-slug",
      "A": 1,
      "C": 1,
      "I": 1,
      "T": 1,
      "lens_level": 1,
      "rationale": "Verified evidence shows independent standard delivery."
    }
  ]
}
```

Validation:
- `A`, `C`, `I`, `T`, and `lens_level` are integers from `1` to `4`.
- `competency_id` must be one of the supplied target slugs.
- `rationale` is one short audit sentence, not advice or marketing copy.
- Invalid JSON is retried once. If it fails again, the target becomes `insufficient_evidence`.

Caching:
- Compute `evidence_hash = hash(framework_version, catalog_version, competency_id, normalized_signals, neighbor_summary)`.
- Reuse valid cached direct readings for the same `evidence_hash`.
- Propagation, decay, capacity caps, and confidence guards never call the LLM.

---

## 4. Universal Axes

| Axis | Question | 1 | 2 | 3 | 4 |
| --- | --- | --- | --- | --- | --- |
| `A` Autonomy | How much supervision is needed? | Step-by-step guidance | Independent on standard work | Fully autonomous on unknown cases | Reference person for others |
| `C` Complexity | How hard are the problems? | Simple, framed tasks | Common variations | Complex or ambiguous cases | Systemic problems and methods |
| `I` Impact | What is the contribution scope? | Own task | Team or local scope | Multiple teams or product area | Organization or ecosystem |
| `T` Transmission | Does the person raise others? | Still learning | Documents practice | Mentors and sets team standards | Teaches, publishes, or defines standards |

Raw level:

```
raw_level = floor(mean(A, C, I, T))
raw_level = min(raw_level, A)
if T < 4: raw_level = min(raw_level, 3)
```

`master` requires `T = 4`.

---

## 5. Type Lenses

The type lens grounds the universal axes in observable evidence.

### `knowledge`

| Level | Evidence |
| ---: | --- |
| 1 | Explains or recalls concepts |
| 2 | Applies concepts to concrete decisions |
| 3 | Compares, critiques, evaluates, and arbitrates |
| 4 | Creates doctrine, standards, or frameworks |

### `hard_skill`

| Level | Evidence |
| ---: | --- |
| 1 | Reproduces known procedures |
| 2 | Delivers reliable standard work |
| 3 | Solves new cases and optimizes tradeoffs |
| 4 | Defines reference methods and handles rare expert cases |

### `soft_skill`

| Level | Evidence |
| ---: | --- |
| 1 | Present but inconsistent in easy contexts |
| 2 | Reliable in normal contexts |
| 3 | Holds under pressure, conflict, or novelty |
| 4 | Role model who raises the group |

### `tool_platform`

| Level | Evidence |
| ---: | --- |
| 1 | Basic guided use |
| 2 | Autonomous daily use |
| 3 | Advanced features, integrations, troubleshooting |
| 4 | Organization-level setup, training, or governance |

### `language`

Natural languages:

| Level | CEFR anchor |
| ---: | --- |
| 1 | A1-A2 |
| 2 | B1 |
| 3 | B2-C1 |
| 4 | C2 or native-equivalent professional fluency |

Formal languages use the `hard_skill` lens.

---

## 6. Family Profiles

| Family | Cycle | Gold evidence | Adjacency |
| --- | --- | --- | --- |
| `ai_ml`, `emerging_tech`, `web3_blockchain` | fast | dated repo, model, or benchmark | strong |
| `tool_platform`, `cloud_devops`, `cybersecurity` | fast | production config, dated certification, resolved incident | strong |
| `software_dev`, `data` | medium | repo, production pipeline, review | strong |
| `fintech_finance`, `industry_knowledge`, `sustainability_climate` | slow | decision, publication, regulatory file | medium |
| `growth_marketing`, `media_content`, `product_design` | medium | published deliverable with impact metric | medium |
| `business_management`, `human_skills` | slow | 360 feedback, team result, held mandate | weak |
| `digital_literacy` | slow | observed usage | weak |

Freshness penalty:
- fast cycle: evidence older than 24 months -> `confidence -0.20`;
- medium cycle: evidence older than 48 months -> `confidence -0.15`;
- slow cycle: no default freshness penalty.

Weak adjacency caps pure inference at `intermediate`.

---

## 7. Graph-Based Inference

Neighbor inference uses `competency_edges.csv` only. The runtime LLM must not derive adjacency.

Relations:
- `prerequisite`: target usually requires the neighbor;
- `co_occurrence`: target and neighbor often appear together;
- `sibling`: adjacent or substitutable skill in the same family.

Prior:

```
neighbors = active evaluated neighbors weighted by strength * confidence
base = max weighted neighbor score
prior = base - 1
cap = 3 for strong prerequisite or strong same-family sibling
cap = 2 otherwise
prior = clamp(prior, 1, min(cap, 3))
```

Pure inference:
- never creates `master`;
- writes `inferred_from`;
- is recomputed when active neighbors change;
- is ignored if no active neighbor exists.

Direct evidence beats inference. Inference only raises confidence when it agrees or lowers confidence when it strongly conflicts.

---

## 8. Confidence Guards

Base confidence:

| strongest source | base confidence |
| --- | ---: |
| `declared` | 0.30 |
| pure inference or correlated signals | 0.55 |
| `artifact` or `assessment` | 0.80 |

Adjustments:
- `+0.15` per independent confirming signal;
- `+0.10` when graph prior agrees;
- freshness penalty from the family profile.

Blocking rules:
- `master` requires `confidence >= 0.80` and recent direct verifiable evidence;
- `advanced` requires `confidence >= 0.60`;
- pure inference is capped at `advanced`.

---

## 9. Profile Capacity And Decay

The active skill profile represents current capacity, not an infinite CV.

Recommended active caps:

| Level | Global active cap |
| --- | ---: |
| `master` | 3 to 7 |
| `advanced` | 15 to 35 |
| `intermediate` | 40 to 120 |
| `beginner` | no strict cap |

Family caps:
- `master`: max 3 per family;
- `advanced`: max 12 per family;
- `advanced`: max 16 for `software_dev`, `data`, `ai_ml`, `cloud_devops`.

When caps are exceeded, keep the strongest rows by:

```
priority = confidence + proof_bonus + recency_bonus + impact_bonus
```

Decay:

| Cycle | active if evidence <= | stale if evidence <= | archived after |
| --- | ---: | ---: | ---: |
| fast | 12 months | 24 months | 36 months |
| medium | 24 months | 48 months | 72 months |
| slow | 36 months | 72 months | 120 months |

Effects:
- `stale`: `confidence -0.15`, max level `advanced`, half inference weight;
- `archived`: historical only, excluded from matching, recommendations, and inference;
- stale `master` becomes `advanced`;
- stale `advanced` stays advanced only if `confidence >= 0.75`, otherwise becomes `intermediate`.

Natural languages use the slow cycle. Formal languages use their technical family cycle. `tool_platform` always uses the fast cycle.

---

## 10. Batch Algorithm

```
def evaluate_batch(input):
    input = resolve_catalog(input)                # slugs, family, type
    state = load_existing_state(input.stack)

    direct_readings = read_direct_evidence_batch(input.to_evaluate, state)
    state = anchor_direct_readings(state, direct_readings)

    state = apply_decay(state, now())

    for pass in range(3):
        changed = False
        for target in inferred_candidates(input, state):
            neighbors = active_graph_neighbors(target, state)
            if not neighbors:
                continue
            prior = calculate_prior(target, neighbors)
            if prior_changes_state(prior, state[target.slug]):
                state[target.slug] = apply_inferred_prior(prior)
                changed = True
        if not changed:
            break

    state = apply_profile_capacity_caps(state)
    state = apply_confidence_guards(state)
    return full_reconciled_state(state)
```

Output keeps `active`, `stale`, and `archived` rows so history is not lost.

---

## 11. Bias And Robustness Rules

- Years of repetition are not expertise by themselves.
- Self-declared confidence never creates `advanced` or `master`.
- Business outcome and skill quality are evaluated separately.
- Pure family halo is allowed only as bounded, traced prior.
- Any `advanced` or `master` row without `rationale` and either `source_ref` or `inferred_from` is invalid.
- Catalog updates never rewrite old evaluations in place.
- New graph edges affect future evaluations only.

---

## 12. Examples

| Skill | Evidence | Result |
| --- | --- | --- |
| SQL | Production analytical queries, index optimization, team review | `advanced`, high confidence |
| Active Listening | Reliable in calm meetings, weak under conflict | `intermediate`, medium confidence |
| AI Governance | Published internal policy used by others | `master`, high confidence |
| AI Tool Use | No direct evidence, strong active neighbors in agent orchestration and prompt engineering | `advanced`, inferred |
| Apache Kafka | Daily use, no advanced integration, old certification | `intermediate`, stale risk |
