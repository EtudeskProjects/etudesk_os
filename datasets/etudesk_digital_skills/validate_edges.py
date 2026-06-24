#!/usr/bin/env python3
"""
Validate competency_edges.csv (the single source of truth for the graph) and
refresh competency_manifest.json.

competency_edges.csv is hand-maintained. This script does not generate edges; it
checks the file's integrity and writes the release manifest. Run it after any
edit to the catalog or the edges:

    python3 validate_edges.py

It exits non-zero (and writes nothing) if any check fails.
"""

from __future__ import annotations

import csv
import hashlib
import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent
CATALOG_PATH = ROOT / "competency_catalog.csv"
EDGES_PATH = ROOT / "competency_edges.csv"
MANIFEST_PATH = ROOT / "competency_manifest.json"

VALID_RELATIONS = {"prerequisite", "co_occurrence", "sibling"}
EDGE_FIELDS = ["from_slug", "to_slug", "relation", "strength", "reason"]
DEFAULT_CATALOG_VERSION = "2026-Q2"


def read_rows(path: Path) -> list[dict]:
    with path.open(encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def catalog_version() -> str:
    if MANIFEST_PATH.exists():
        try:
            return json.loads(MANIFEST_PATH.read_text(encoding="utf-8")).get(
                "catalog_version", DEFAULT_CATALOG_VERSION
            )
        except (ValueError, OSError):
            pass
    return DEFAULT_CATALOG_VERSION


def _prerequisite_cycle(adj: dict[str, set[str]]) -> list[str]:
    """Return one representative node per prerequisite cycle (empty if acyclic)."""
    WHITE, GRAY, BLACK = 0, 1, 2
    color: dict[str, int] = {}
    offenders: list[str] = []

    def visit(start: str) -> None:
        # Iterative DFS so deep graphs do not overflow the recursion limit.
        stack = [(start, iter(adj.get(start, ())))]
        color[start] = GRAY
        while stack:
            node, children = stack[-1]
            advanced = False
            for nxt in children:
                c = color.get(nxt, WHITE)
                if c == GRAY:
                    offenders.append(nxt)
                elif c == WHITE:
                    color[nxt] = GRAY
                    stack.append((nxt, iter(adj.get(nxt, ()))))
                    advanced = True
                    break
            if not advanced:
                color[node] = BLACK
                stack.pop()

    for n in adj:
        if color.get(n, WHITE) == WHITE:
            visit(n)
    # De-duplicate while keeping order.
    return list(dict.fromkeys(offenders))


def validate() -> int:
    errors: list[str] = []

    catalog = read_rows(CATALOG_PATH)
    slugs = {r["slug"] for r in catalog}
    if len(slugs) != len(catalog):
        errors.append("Duplicate slug(s) in competency_catalog.csv")

    family_of = {r["slug"]: (r.get("family") or "").strip() for r in catalog}

    # Catalog display labels must be unambiguous: no two distinct skills may
    # share an English name or a French name.
    for col, label in (("name", "name"), ("name_fr", "name_fr")):
        counts: dict[str, list[str]] = {}
        for r in catalog:
            counts.setdefault((r.get(col) or "").strip(), []).append(r["slug"])
        for value, owners in counts.items():
            if value and len(owners) > 1:
                errors.append(
                    f"duplicate {label} '{value}' shared by: " + ", ".join(owners)
                )

    edges = read_rows(EDGES_PATH)
    seen: set[tuple[str, str, str]] = set()
    pair_relation: dict[tuple[str, str], str] = {}
    prereq_adj: dict[str, set[str]] = {}
    touched: set[str] = set()

    for i, row in enumerate(edges, start=2):
        src = (row.get("from_slug") or "").strip()
        dst = (row.get("to_slug") or "").strip()
        rel = (row.get("relation") or "").strip()
        strength = (row.get("strength") or "").strip()

        for slug, side in ((src, "from_slug"), (dst, "to_slug")):
            if slug not in slugs:
                errors.append(f"line {i}: unknown {side} '{slug}'")
        if rel not in VALID_RELATIONS:
            errors.append(f"line {i}: invalid relation '{rel}'")
        if src and src == dst:
            errors.append(f"line {i}: self-loop on '{src}'")
        try:
            s = float(strength)
            if not 0.0 < s <= 1.0:
                errors.append(f"line {i}: strength {s} out of range (0, 1]")
        except ValueError:
            errors.append(f"line {i}: strength '{strength}' is not a number")

        key = (src, dst, rel)
        if key in seen:
            errors.append(f"line {i}: duplicate edge {src} -{rel}-> {dst}")
        seen.add(key)

        # An ordered (from, to) pair carries at most one relation: a neighbor
        # must not occupy two slots with conflicting relation types.
        prior = pair_relation.get((src, dst))
        if prior is not None and prior != rel:
            errors.append(
                f"line {i}: pair {src} -> {dst} already has relation "
                f"'{prior}', cannot also be '{rel}'"
            )
        pair_relation[(src, dst)] = rel

        # Siblings are same-family peers by definition; cross-family adjacency
        # must be modeled as co_occurrence instead.
        if (
            rel == "sibling"
            and src in family_of
            and dst in family_of
            and family_of[src] != family_of[dst]
        ):
            errors.append(
                f"line {i}: cross-family sibling {src} ({family_of[src]}) -> "
                f"{dst} ({family_of[dst]}); use co_occurrence"
            )

        if rel == "prerequisite":
            prereq_adj.setdefault(src, set()).add(dst)

        touched.add(src)
        touched.add(dst)

    # The prerequisite relation must be acyclic: "A requires B" and a path back
    # to A is a logical contradiction.
    for node in _prerequisite_cycle(prereq_adj):
        errors.append(f"prerequisite cycle through '{node}'")

    orphans = sorted(slugs - touched)
    if orphans:
        errors.append(
            f"{len(orphans)} catalog skill(s) have no edge (orphans): "
            + ", ".join(orphans[:15])
            + (" ..." if len(orphans) > 15 else "")
        )

    if errors:
        print(f"FAILED: {len(errors)} problem(s) in the edge source.")
        for e in errors:
            print(f"  - {e}")
        return 1

    manifest = {
        "catalog_version": catalog_version(),
        "competency_count": len(catalog),
        "edge_count": len(edges),
        "files": {
            "competency_catalog.csv": sha256_file(CATALOG_PATH),
            "competency_edges.csv": sha256_file(EDGES_PATH),
        },
    }
    MANIFEST_PATH.write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )

    by_relation: dict[str, int] = {}
    for row in edges:
        by_relation[row["relation"]] = by_relation.get(row["relation"], 0) + 1
    print("OK: edge source is valid.")
    print(f"competencies={len(catalog)}")
    print(f"edges={len(edges)}")
    for rel in sorted(by_relation):
        print(f"{rel}={by_relation[rel]}")
    return 0


if __name__ == "__main__":
    sys.exit(validate())
