#!/usr/bin/env python3
"""
Audit and enrich competency_edges.csv with deterministic inter-family and
inter-type bridges.

The script is intentionally conservative:
- existing edges are never deleted or rewritten;
- generated edges are co_occurrence except same-family low-degree siblings;
- every generated reason is explicit, so additions can be reviewed or filtered.

Usage:
    python3 recluster_edges.py          # audit / dry-run
    python3 recluster_edges.py --apply  # append generated edges and write audit
"""

from __future__ import annotations

import argparse
import collections
import csv
import itertools
import json
import math
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parent
CATALOG_PATH = ROOT / "competency_catalog.csv"
EDGES_PATH = ROOT / "competency_edges.csv"
AUDIT_JSON = ROOT / "edge_recluster_audit.json"
AUDIT_MD = ROOT / "EDGE_RECLUSTER_AUDIT.md"

EDGE_FIELDS = ["from_slug", "to_slug", "relation", "strength", "reason"]
MIN_DEGREE = 4
MAX_LOW_DEGREE_ADDS_PER_SKILL = 4
MAX_CROSS_TYPE_ADDS_PER_SKILL = 2
MAX_FAMILY_PAIR_ADDS = 2

STOPWORDS = {
    "a",
    "and",
    "api",
    "app",
    "apps",
    "as",
    "based",
    "by",
    "cloud",
    "digital",
    "for",
    "in",
    "of",
    "on",
    "online",
    "platform",
    "platforms",
    "system",
    "systems",
    "the",
    "tool",
    "tools",
    "with",
}

# Topic clusters are cross-domain bridges that pure string matching misses.
# Missing slugs are ignored, so the list is safe across catalog revisions.
TOPIC_CLUSTERS = {
    "ai_governance_risk": [
        "ai-governance",
        "ai-act-implementation",
        "eu-ai-act-compliance",
        "responsible-ai",
        "ethical-ai",
        "ai-risk-management",
        "model-risk-management",
        "ai-bias-and-fairness",
        "data-ethics",
        "risk-management",
    ],
    "ai_security": [
        "ai-ml-security",
        "ai-agent-security",
        "ai-security-testing",
        "ai-red-teaming",
        "prompt-injection-defense",
        "guardrails",
        "ai-safety",
        "threat-modeling",
        "adversarial-defense",
    ],
    "ai_product_growth": [
        "ai-powered-product-discovery",
        "ai-product-management",
        "product-discovery",
        "product-analytics",
        "product-led-growth",
        "product-marketing",
        "growth-marketing",
        "a-b-testing",
    ],
    "ai_education": [
        "generative-ai-in-education",
        "intelligent-tutoring-systems",
        "adaptive-learning-personalization",
        "learning-analytics",
        "knowledge-tracing",
        "automated-assessment",
        "machine-learning-fundamentals",
    ],
    "ai_health": [
        "clinical-ai",
        "ai-driven-drug-discovery",
        "diagnostic-modeling",
        "health-informatics",
        "health-data-interoperability",
        "machine-learning-fundamentals",
        "data-privacy",
    ],
    "ai_sustainability": [
        "computer-vision-for-crop-monitoring",
        "precision-agriculture-data-analysis",
        "energy-demand-forecasting",
        "climate-risk-assessment",
        "predictive-modeling",
        "time-series-forecasting",
        "sensor-data-engineering",
    ],
    "automation_operations": [
        "business-process-automation-design",
        "workflow-automation",
        "robotic-process-automation",
        "marketing-automation",
        "finance-operations-automation",
        "accounting-process-automation",
        "secure-pipeline-automation",
        "legal-document-automation",
        "automation-anywhere",
    ],
    "data_governance_privacy": [
        "data-governance",
        "data-lineage",
        "data-quality-engineering",
        "data-catalog-management",
        "master-data-management",
        "data-privacy",
        "privacy-engineering",
        "privacy-by-design",
        "gdpr",
        "data-protection-law",
        "consent-management",
    ],
    "customer_growth_data": [
        "customer-segmentation",
        "customer-data-platform-management",
        "customer-data-platforms",
        "crm-management",
        "customer-success",
        "retention-and-lifecycle-marketing",
        "marketing-attribution",
        "marketing-measurement",
    ],
    "finance_risk_fraud": [
        "risk-modeling",
        "risk-management",
        "anti-fraud-modeling",
        "fraud-detection",
        "transaction-monitoring",
        "aml-kyc-automation",
        "kyc-aml-workflow-design",
        "regtech",
    ],
    "supply_chain_industry_data": [
        "supply-chain-optimization",
        "supply-chain-management",
        "supply-chain-analytics",
        "fleet-data-analytics",
        "warehouse-automation",
        "predictive-maintenance-analytics",
        "predictive-maintenance-modeling",
        "iot-platform-engineering",
    ],
    "accessibility_inclusion": [
        "digital-accessibility",
        "wcag-accessibility-standards",
        "digital-accessibility-mindset",
        "learning-accessibility",
        "inclusive-education",
        "inclusive-collaboration",
        "plain-language",
    ],
    "communication_content_learning": [
        "communication",
        "written-communication",
        "storytelling",
        "content-marketing",
        "content-production",
        "instructional-design",
        "online-course-creation",
        "learning-experience-design",
        "plain-language",
    ],
    "software_data_platforms": [
        "python",
        "sql",
        "database-design",
        "data-modeling",
        "data-pipeline-engineering",
        "api-design",
        "backend-engineering",
        "apache-kafka",
        "apache-airflow",
        "dbt",
    ],
    "cloud_security_devops": [
        "cloud-security-architecture",
        "cloud-security-posture-management",
        "container-security",
        "kubernetes",
        "docker",
        "terraform",
        "ci-cd-pipeline-engineering",
        "secure-pipeline-automation",
        "networking-fundamentals",
    ],
    "web3_finance_security": [
        "blockchain",
        "blockchain-protocol-engineering",
        "smart-contract-development",
        "web3-security",
        "cryptography",
        "solidity",
        "cairo",
        "chainalysis",
        "on-chain-analytics",
    ],
    "energy_finance_climate": [
        "climate-finance",
        "climate-risk-assessment",
        "energy-demand-forecasting",
        "renewable-energy-system-design",
        "energy-audit",
        "sustainability-strategy",
        "risk-modeling",
    ],
}


def read_rows(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def write_rows(path: Path, rows: list[dict[str, str]]) -> None:
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=EDGE_FIELDS)
        writer.writeheader()
        writer.writerows(rows)


def tokens(row: dict[str, str]) -> set[str]:
    text = f"{row['slug']} {row['name']} {row['name_fr']}".lower()
    raw = re.findall(r"[a-z0-9]+", text)
    out = set()
    for t in raw:
        if len(t) < 3 or t in STOPWORDS:
            continue
        if t.endswith("s") and len(t) > 4:
            t = t[:-1]
        out.add(t)
    return out


def strength(value: float) -> str:
    return f"{max(0.35, min(0.72, value)):.2f}"


def pair_key(a: str, b: str) -> tuple[str, str]:
    return (a, b)


def add_candidate(
    candidates: dict[tuple[str, str], dict[str, str]],
    existing_pairs: set[tuple[str, str]],
    src: str,
    dst: str,
    relation: str,
    score: float,
    reason: str,
) -> None:
    if src == dst or pair_key(src, dst) in existing_pairs:
        return
    key = pair_key(src, dst)
    row = {
        "from_slug": src,
        "to_slug": dst,
        "relation": relation,
        "strength": strength(score),
        "reason": reason,
    }
    prior = candidates.get(key)
    if prior is None or float(row["strength"]) > float(prior["strength"]):
        candidates[key] = row


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="append generated edges")
    args = parser.parse_args()

    catalog = read_rows(CATALOG_PATH)
    edges = read_rows(EDGES_PATH)
    by_slug = {r["slug"]: r for r in catalog}
    existing_pairs = {(e["from_slug"], e["to_slug"]) for e in edges}

    token_map = {r["slug"]: tokens(r) for r in catalog}
    doc_freq = collections.Counter(t for ts in token_map.values() for t in ts)
    idf = {
        t: math.log((len(catalog) + 1) / (df + 1)) + 1.0
        for t, df in doc_freq.items()
    }
    token_weight = {
        s: sum(idf[t] for t in ts)
        for s, ts in token_map.items()
    }

    def similarity(a: str, b: str) -> float:
        shared = token_map[a] & token_map[b]
        if not shared:
            return 0.0
        shared_weight = sum(idf[t] for t in shared)
        denom = math.sqrt(max(token_weight[a], 0.01) * max(token_weight[b], 0.01))
        return shared_weight / denom

    degree = collections.Counter()
    cross_type_degree = collections.Counter()
    family_pairs = collections.Counter()
    relation_counts = collections.Counter()
    for e in edges:
        src, dst = e["from_slug"], e["to_slug"]
        degree[src] += 1
        degree[dst] += 1
        relation_counts[e["relation"]] += 1
        a, b = by_slug[src], by_slug[dst]
        if a["type"] != b["type"]:
            cross_type_degree[src] += 1
            cross_type_degree[dst] += 1
        if a["family"] != b["family"]:
            family_pairs[tuple(sorted((a["family"], b["family"])))] += 1

    candidates: dict[tuple[str, str], dict[str, str]] = {}

    # 1. Curated topic bridges, bidirectional because co_occurrence is symmetric
    # for discovery and inference.
    for topic, slugs in TOPIC_CLUSTERS.items():
        present = [s for s in slugs if s in by_slug]
        for a, b in itertools.combinations(present, 2):
            if (
                by_slug[a]["family"] == by_slug[b]["family"]
                and by_slug[a]["type"] == by_slug[b]["type"]
            ):
                continue
            score = 0.58
            add_candidate(candidates, existing_pairs, a, b, "co_occurrence", score, f"inter_domain_recluster:{topic}")
            add_candidate(candidates, existing_pairs, b, a, "co_occurrence", score, f"inter_domain_recluster:{topic}")

    # Precompute lexical candidates for sparse nodes and family-pair coverage.
    lexical: list[tuple[float, str, str]] = []
    slugs = [r["slug"] for r in catalog]
    for i, a in enumerate(slugs):
        for b in slugs[i + 1 :]:
            if (a, b) in existing_pairs and (b, a) in existing_pairs:
                continue
            score = similarity(a, b)
            if score < 0.22:
                continue
            lexical.append((score, a, b))
    lexical.sort(reverse=True)

    # 2. Ensure every family pair has at least a small number of bridges when a
    # meaningful lexical or topic candidate exists.
    family_pair_adds = collections.Counter()
    all_families = sorted({r["family"] for r in catalog})
    for score, a, b in lexical:
        fa, fb = by_slug[a]["family"], by_slug[b]["family"]
        if fa == fb:
            continue
        fkey = tuple(sorted((fa, fb)))
        if family_pairs[fkey] + family_pair_adds[fkey] >= MAX_FAMILY_PAIR_ADDS:
            continue
        if (a, b) not in existing_pairs:
            add_candidate(candidates, existing_pairs, a, b, "co_occurrence", 0.42 + score * 0.18, "inter_family_recluster")
            family_pair_adds[fkey] += 1
        if family_pairs[fkey] + family_pair_adds[fkey] >= MAX_FAMILY_PAIR_ADDS:
            continue
        if (b, a) not in existing_pairs:
            add_candidate(candidates, existing_pairs, b, a, "co_occurrence", 0.42 + score * 0.18, "inter_family_recluster")
            family_pair_adds[fkey] += 1

    # 3. Give skills with no cross-type neighbor a typed bridge inside their
    # family first, then across families.
    cross_type_adds = collections.Counter()
    for score, a, b in lexical:
        if by_slug[a]["type"] == by_slug[b]["type"]:
            continue
        same_family = by_slug[a]["family"] == by_slug[b]["family"]
        if cross_type_degree[a] + cross_type_adds[a] < 1 or (
            same_family and cross_type_adds[a] < MAX_CROSS_TYPE_ADDS_PER_SKILL
        ):
            add_candidate(candidates, existing_pairs, a, b, "co_occurrence", 0.40 + score * 0.18, "inter_type_recluster")
            cross_type_adds[a] += 1
        if cross_type_degree[b] + cross_type_adds[b] < 1 or (
            same_family and cross_type_adds[b] < MAX_CROSS_TYPE_ADDS_PER_SKILL
        ):
            add_candidate(candidates, existing_pairs, b, a, "co_occurrence", 0.40 + score * 0.18, "inter_type_recluster")
            cross_type_adds[b] += 1

    # 4. Lift very sparse nodes to a minimum degree. Same-family peers can be
    # siblings; cross-family/type peers remain co_occurrence.
    low_degree_adds = collections.Counter()
    for score, a, b in lexical:
        for src, dst in ((a, b), (b, a)):
            if degree[src] + low_degree_adds[src] >= MIN_DEGREE:
                continue
            if low_degree_adds[src] >= MAX_LOW_DEGREE_ADDS_PER_SKILL:
                continue
            same_family = by_slug[src]["family"] == by_slug[dst]["family"]
            relation = "sibling" if same_family else "co_occurrence"
            reason = "low_degree_recluster"
            add_candidate(candidates, existing_pairs, src, dst, relation, 0.38 + score * 0.20, reason)
            low_degree_adds[src] += 1

    generated = sorted(
        candidates.values(),
        key=lambda r: (r["reason"], r["from_slug"], r["to_slug"], r["relation"]),
    )

    new_family_pairs = collections.Counter(family_pairs)
    new_degree = collections.Counter(degree)
    new_cross_type = collections.Counter(cross_type_degree)
    for e in generated:
        src, dst = e["from_slug"], e["to_slug"]
        new_degree[src] += 1
        new_degree[dst] += 1
        if by_slug[src]["type"] != by_slug[dst]["type"]:
            new_cross_type[src] += 1
        if by_slug[src]["family"] != by_slug[dst]["family"]:
            new_family_pairs[tuple(sorted((by_slug[src]["family"], by_slug[dst]["family"])))] += 1

    zero_family_pairs_before = [
        pair for pair in itertools.combinations(all_families, 2) if family_pairs[pair] == 0
    ]
    zero_family_pairs_after = [
        pair for pair in itertools.combinations(all_families, 2) if new_family_pairs[pair] == 0
    ]
    audit = {
        "applied": args.apply,
        "competency_count": len(catalog),
        "edge_count_before": len(edges),
        "generated_edge_count": len(generated),
        "edge_count_after": len(edges) + len(generated),
        "relation_counts_before": dict(sorted(relation_counts.items())),
        "generated_by_reason": dict(collections.Counter(e["reason"] for e in generated).most_common()),
        "low_degree_before": sum(1 for s in slugs if degree[s] <= 2),
        "low_degree_after": sum(1 for s in slugs if new_degree[s] <= 2),
        "skills_without_cross_type_before": sum(1 for s in slugs if cross_type_degree[s] == 0),
        "skills_without_cross_type_after": sum(1 for s in slugs if new_cross_type[s] == 0),
        "covered_family_pairs_before": len(family_pairs),
        "covered_family_pairs_after": len(new_family_pairs),
        "zero_family_pairs_before": zero_family_pairs_before,
        "zero_family_pairs_after": zero_family_pairs_after,
        "sample_generated_edges": generated[:50],
    }

    AUDIT_JSON.write_text(json.dumps(audit, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    AUDIT_MD.write_text(
        "\n".join(
            [
                "# Edge Recluster Audit",
                "",
                f"- Applied: `{args.apply}`",
                f"- Competencies: `{len(catalog)}`",
                f"- Edges before: `{len(edges)}`",
                f"- Generated edges: `{len(generated)}`",
                f"- Edges after: `{len(edges) + len(generated)}`",
                f"- Family pairs covered: `{len(family_pairs)}` -> `{len(new_family_pairs)}` / `120`",
                f"- Zero family pairs: `{len(zero_family_pairs_before)}` -> `{len(zero_family_pairs_after)}`",
                f"- Skills degree <= 2: `{audit['low_degree_before']}` -> `{audit['low_degree_after']}`",
                f"- Skills without cross-type neighbor: `{audit['skills_without_cross_type_before']}` -> `{audit['skills_without_cross_type_after']}`",
                "",
                "## Generated By Reason",
                "",
                *[
                    f"- `{reason}`: `{count}`"
                    for reason, count in audit["generated_by_reason"].items()
                ],
                "",
                "## Remaining Zero Family Pairs",
                "",
                *[
                    f"- `{a}` x `{b}`"
                    for a, b in zero_family_pairs_after
                ],
                "",
            ]
        ),
        encoding="utf-8",
    )

    if args.apply and generated:
        write_rows(EDGES_PATH, edges + generated)

    print(json.dumps(audit, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
