# Etudesk Digital Skills

This folder contains the Etudesk digital skills catalog and the evaluation assets used by AI services.

## Files

| File | Purpose |
| --- | --- |
| `competency_catalog.csv` | Active skill catalog with stable slugs, English labels, and French display labels |
| `competency_edges.csv` | **Single source of truth** for the adjacency graph. Hand-maintained, edited directly. |
| `competency_manifest.json` | Release version, counts, and file checksums (written by `validate_edges.py`) |
| `SCHEMA.md` | Data model and versioning rules |
| `EVALUATION_FRAMEWORK.md` | Runtime evaluation rules |
| `validate_edges.py` | Validates `competency_edges.csv` and refreshes the manifest |
| `recluster_edges.py` | Audits and appends deterministic inter-family / inter-type bridge edges |
| `EDGE_RECLUSTER_AUDIT.md` | Latest human-readable reclustering audit summary |
| `edge_recluster_audit.json` | Latest machine-readable reclustering audit metrics |

Both data files are hand-maintained single sources of truth: `competency_catalog.csv`
(including the `name_fr` column) and `competency_edges.csv` (the graph, with no
generation/merge step). The edge `reason` column records where each edge
originally came from (rules, curation, or adversarial review); set `reason` to
`manual` for new hand-added edges.

## Update Flow

1. Edit `competency_catalog.csv` (keep existing `slug` values stable) and/or
   `competency_edges.csv` directly. Edge columns: `from_slug,to_slug,relation,strength,reason`
   (`relation` is `prerequisite | co_occurrence | sibling`; direction of a
   prerequisite is `from_slug` requires `to_slug`). To retire a skill, remove its
   row and every edge that references its slug.
2. Validate the graph and refresh the manifest (fails on unknown slugs, bad
   relations, out-of-range strengths, self-loops, duplicate edges, conflicting
   relations on the same ordered pair, cross-family siblings, prerequisite
   cycles, orphans, or duplicate `name` / `name_fr` labels):

```bash
python3 validate_edges.py
```

For a broader graph audit and conservative enrichment of weak inter-family or
inter-type coverage, run:

```bash
python3 recluster_edges.py          # dry-run audit
python3 recluster_edges.py --apply  # append generated bridge edges
python3 validate_edges.py           # refresh manifest after applying
```

## Runtime Rule

Production services should use `slug` as the stable key. English and French labels are display fields only and must not be used as persistent identifiers.
