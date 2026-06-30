#!/usr/bin/env python3
"""
Enrich competency_catalog.csv with LLM-generated descriptions.

Adds/updates:
  - description_en
  - description_fr
  - official_url

The script is intentionally conservative. Descriptions are always capped at
50 words. Official URLs are accepted only when they look plausibly tied to the
skill label; otherwise the CSV value stays empty for later review.

Usage:
  python3 enrich_catalog_descriptions.py --limit 10
  python3 enrich_catalog_descriptions.py --apply
  python3 enrich_catalog_descriptions.py --apply --resume
  python3 enrich_catalog_descriptions.py --mode openai --env-file ../../backend/.env --apply
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import shutil
import sys
import time
from pathlib import Path
from urllib.parse import urlparse

import requests
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer


ROOT = Path(__file__).resolve().parent
CATALOG_PATH = ROOT / "competency_catalog.csv"
DEFAULT_MODEL_PATH = ROOT / "models" / "Qwen3-0.6B"
NEW_FIELDS = ["description_en", "description_fr", "official_url"]
UNSURE = "pas sur"
MAX_WORDS = 50
GENERIC_DESCRIPTION_MARKERS = (
    "is a practical skill used to produce reliable digital deliverables",
    "is conceptual knowledge used to understand, compare, and make informed decisions",
    "is a professional behavior skill used to collaborate, communicate",
    "is a tool or platform competency focused on practical use",
    "is a language competency focused on understanding, communication",
    "est une compétence pratique pour produire des livrables numériques fiables",
    "est une connaissance conceptuelle utile pour comprendre, comparer et décider",
    "est une compétence comportementale utile pour collaborer, communiquer",
    "est une compétence liée à un outil ou une plateforme",
    "est une compétence linguistique centrée sur la compréhension",
)

COMMON_TOKENS = {
    "api", "app", "apps", "cloud", "data", "database", "db", "developer",
    "development", "digital", "framework", "language", "learning", "machine",
    "management", "platform", "service", "services", "software", "studio",
    "system", "tool", "tools", "web", "workflow", "workflows",
}

KNOWN_OFFICIAL_DOMAINS = {
    "adobe": "adobe.com",
    "airflow": "airflow.apache.org",
    "airtable": "airtable.com",
    "android": "developer.android.com",
    "angular": "angular.dev",
    "anthropic": "anthropic.com",
    "apache": "apache.org",
    "apache beam": "beam.apache.org",
    "apache cassandra": "cassandra.apache.org",
    "apache druid": "druid.apache.org",
    "apache flink": "flink.apache.org",
    "apache hudi": "hudi.apache.org",
    "apache iceberg": "iceberg.apache.org",
    "apache kafka": "kafka.apache.org",
    "apache spark": "spark.apache.org",
    "apache superset": "superset.apache.org",
    "aws": "aws.amazon.com",
    "aws cdk": "docs.aws.amazon.com/cdk",
    "aws lambda": "aws.amazon.com/lambda",
    "azure": "azure.microsoft.com",
    "bash": "gnu.org",
    "bitcoin": "bitcoin.org",
    "blender": "blender.org",
    "bootstrap": "getbootstrap.com",
    "canva": "canva.com",
    "chatgpt": "openai.com",
    "claude": "anthropic.com",
    "cloudflare": "cloudflare.com",
    "cloudflare workers": "workers.cloudflare.com",
    "coursera": "coursera.org",
    "css": "developer.mozilla.org",
    "dart": "dart.dev",
    "django": "djangoproject.com",
    "docker": "docker.com",
    "ethereum": "ethereum.org",
    "excel": "microsoft.com",
    "express": "expressjs.com",
    "figma": "figma.com",
    "firebase": "firebase.google.com",
    "flask": "flask.palletsprojects.com",
    "flutter": "flutter.dev",
    "github": "github.com",
    "gitlab": "gitlab.com",
    "go": "go.dev",
    "google": "google.com",
    "google ads": "ads.google.com",
    "google analytics": "analytics.google.com",
    "google bigquery": "cloud.google.com/bigquery",
    "google classroom": "classroom.google.com",
    "google cloud platform": "cloud.google.com",
    "google drive": "drive.google.com",
    "google earth engine": "earthengine.google.com",
    "google earth engine javascript api": "earthengine.google.com",
    "google gemini": "gemini.google.com",
    "google maps platform": "mapsplatform.google.com",
    "google search console": "search.google.com/search-console",
    "google workspace": "workspace.google.com",
    "grafana": "grafana.com",
    "grafana loki": "grafana.com/oss/loki",
    "graphql": "graphql.org",
    "html": "developer.mozilla.org",
    "hubspot": "hubspot.com",
    "ios": "developer.apple.com",
    "java": "oracle.com",
    "javascript": "developer.mozilla.org",
    "jenkins": "jenkins.io",
    "jira": "atlassian.com",
    "kali linux": "kali.org",
    "kafka": "kafka.apache.org",
    "kotlin": "kotlinlang.org",
    "kubernetes": "kubernetes.io",
    "laravel": "laravel.com",
    "linkedin": "linkedin.com",
    "linux": "linux.org",
    "looker": "lookerstudio.google.com",
    "mailchimp": "mailchimp.com",
    "matplotlib": "matplotlib.org",
    "mongodb": "mongodb.com",
    "mysql": "mysql.com",
    "next.js": "nextjs.org",
    "node.js": "nodejs.org",
    "notion": "notion.so",
    "numpy": "numpy.org",
    "openai": "openai.com",
    "pandas": "pandas.pydata.org",
    "pl sql": "oracle.com/database/technologies/appdev/plsql.html",
    "postgresql": "postgresql.org",
    "postgis": "postgis.net",
    "power bi": "powerbi.microsoft.com",
    "power apps": "powerapps.microsoft.com",
    "power automate": "powerautomate.microsoft.com",
    "python": "python.org",
    "pytorch": "pytorch.org",
    "react": "react.dev",
    "react native": "reactnative.dev",
    "redis": "redis.io",
    "ruby": "ruby-lang.org",
    "ruby on rails": "rubyonrails.org",
    "rust": "rust-lang.org",
    "salesforce": "salesforce.com",
    "scikit": "scikit-learn.org",
    "shopify": "shopify.com",
    "slack": "slack.com",
    "snowflake": "snowflake.com",
    "sql": "iso.org",
    "stripe": "stripe.com",
    "supabase": "supabase.com",
    "swift": "swift.org",
    "swiftui": "developer.apple.com",
    "tableau": "tableau.com",
    "tailwind css": "tailwindcss.com",
    "tensorflow": "tensorflow.org",
    "t sql": "learn.microsoft.com/sql/t-sql",
    "typescript": "typescriptlang.org",
    "vue": "vuejs.org",
    "wordpress": "wordpress.org",
    "zapier": "zapier.com",
}


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--input", type=Path, default=CATALOG_PATH)
    p.add_argument("--output", type=Path, default=CATALOG_PATH)
    p.add_argument("--model", type=Path, default=DEFAULT_MODEL_PATH)
    p.add_argument("--apply", action="store_true", help="write output CSV; otherwise dry-run to .preview.csv")
    p.add_argument("--resume", action="store_true", help="skip rows that already have all new fields")
    p.add_argument("--limit", type=int, default=None)
    p.add_argument("--offset", type=int, default=0)
    p.add_argument("--checkpoint-every", type=int, default=25)
    p.add_argument("--device", choices=["auto", "mps", "cpu"], default="auto")
    p.add_argument("--mode", choices=["openai", "llm", "heuristic"], default="openai")
    p.add_argument("--openai-model", default=os.environ.get("OPENAI_MODEL", "gpt-4.1-nano"))
    p.add_argument("--openai-api-key", default=os.environ.get("OPENAI_API_KEY"))
    p.add_argument("--env-file", type=Path, default=None, help="optional .env file containing OPENAI_API_KEY")
    p.add_argument("--batch-size", type=int, default=20)
    p.add_argument("--only-generic", action="store_true", help="only refresh rows with generic descriptions or missing URL")
    p.add_argument("--only-unsure-descriptions", action="store_true", help="only refresh rows with description_en or description_fr equal to pas sur")
    p.add_argument("--max-retries", type=int, default=4)
    return p.parse_args()


def normalize_words(text: str) -> str:
    text = re.sub(r"\s+", " ", (text or "").strip())
    text = text.strip("`\"' ")
    if not text:
        return ""
    words = text.split()
    if len(words) > MAX_WORDS:
        text = " ".join(words[:MAX_WORDS]).rstrip(",;:")
    if text and text[-1] not in ".!?":
        text += "."
    return text[:1].upper() + text[1:]


def is_generic_row(row: dict) -> bool:
    values = f"{row.get('description_en', '')}\n{row.get('description_fr', '')}".lower()
    return (
        not row.get("description_en")
        or not row.get("description_fr")
        or row.get("official_url") == UNSURE
        or any(marker.lower() in values for marker in GENERIC_DESCRIPTION_MARKERS)
    )


def has_unsure_description(row: dict) -> bool:
    return any(UNSURE in (row.get(field) or "").lower() for field in ("description_en", "description_fr"))


def load_env_file(path: Path | None) -> None:
    if not path:
        return
    if not path.exists():
        raise SystemExit(f"Env file not found: {path}")
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("'\"")
        if key and key not in os.environ:
            os.environ[key] = value


def label_tokens(*labels: str) -> set[str]:
    raw = " ".join(labels).lower()
    raw = raw.replace("&", " ")
    parts = re.findall(r"[a-z0-9][a-z0-9.+-]{1,}", raw)
    split_parts = re.findall(r"[a-z0-9]{2,}", raw)
    tokens = {p.strip(".+-") for p in parts if p.strip(".+-")}
    tokens.update(split_parts)
    return {p for p in tokens if p not in COMMON_TOKENS}


def key_matches(key: str, tokens: set[str], phrase_haystack: str) -> bool:
    # Keys such as "t sql" or "pl sql" include one-letter qualifiers that are
    # dropped by tokenization. Require the full phrase so plain "SQL" does not
    # accidentally match a vendor-specific dialect.
    if any(len(part) == 1 for part in key.lower().replace("-", " ").split()):
        return key.lower() in phrase_haystack
    raw_key_tokens = {
        p.strip(".+-")
        for p in re.findall(r"[a-z0-9][a-z0-9.+-]{1,}", key.lower())
        if p.strip(".+-")
    }
    if not raw_key_tokens:
        return False
    if len(raw_key_tokens) == 1:
        token = next(iter(raw_key_tokens))
        return token in tokens
    return key.lower() in phrase_haystack or raw_key_tokens.issubset(tokens)


def known_url(name: str, name_fr: str, typ: str | None = None) -> str | None:
    if typ not in {None, "tool_platform", "language"}:
        return None
    phrase_haystack = f" {name} {name_fr} ".lower()
    tokens = label_tokens(name, name_fr)
    for key, domain in sorted(KNOWN_OFFICIAL_DOMAINS.items(), key=lambda kv: len(kv[0]), reverse=True):
        if key_matches(key, tokens, phrase_haystack):
            return "https://" + domain
    return None


def normalize_url(url: str, name: str, name_fr: str, typ: str) -> str:
    url = (url or "").strip().strip("`\"' ")
    if not url or url.lower() in {"unknown", "unsure", "n/a", "na", "none", UNSURE}:
        return UNSURE
    if not re.match(r"^https?://", url):
        url = "https://" + url
    try:
        parsed = urlparse(url)
    except Exception:
        return UNSURE
    host = (parsed.netloc or "").lower().removeprefix("www.")
    if "." not in host:
        return UNSURE

    tokens = label_tokens(name, name_fr)
    host_tokens = set(re.findall(r"[a-z0-9]+", host))
    if tokens & host_tokens:
        return f"{parsed.scheme}://{host}{parsed.path.rstrip('/')}"

    known = known_url(name, name_fr, typ)
    if known and urlparse(known).netloc.lower().removeprefix("www.") == host:
        return known

    # For non-tool skills, official sources are often standards/docs and hard to
    # verify locally. Prefer "pas sur" over a hallucinated URL.
    if typ != "tool_platform":
        return UNSURE
    return UNSURE


def csv_url(url: str) -> str:
    return "" if (url or "").strip().lower() == UNSURE else (url or "").strip()


def extract_json(text: str) -> dict:
    text = text.strip()
    match = re.search(r"\{[\s\S]*\}", text)
    if not match:
        return {}
    raw = match.group(0)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        raw = re.sub(r",\s*}", "}", raw)
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return {}


def prompt_for(row: dict) -> str:
    return (
        "You enrich a digital skills catalog. Return only compact JSON with keys "
        "description_en, description_fr, official_url.\n"
        "Rules: description_en and description_fr must be sentence case, useful, "
        "plain, and max 50 words each. The French description must be natural "
        "French. Never put \"pas sur\" in a description; write a conservative "
        "generic description when uncertain. official_url must be the official "
        "website/documentation only; if uncertain, use exactly \"pas sur\". Do "
        "not invent URLs.\n\n"
        f"slug: {row['slug']}\n"
        f"family: {row['family']}\n"
        f"type: {row['type']}\n"
        f"name_en: {row['name']}\n"
        f"name_fr: {row['name_fr']}\n"
    )


def clean_description(row: dict, lang: str, text: str) -> str:
    text = normalize_words(text)
    if not text or UNSURE in text.lower():
        return fallback_description(row, lang)
    return text


def openai_payload_for(rows: list[dict], model: str) -> dict:
    compact_rows = [
        {
            "slug": row["slug"],
            "family": row["family"],
            "type": row["type"],
            "name": row["name"],
            "name_fr": row["name_fr"],
        }
        for row in rows
    ]
    return {
        "model": model,
        "temperature": 0,
        "response_format": {"type": "json_object"},
        "messages": [
            {
                "role": "system",
                "content": (
                    "You enrich a digital skills catalog. Return only JSON as "
                    "{\"items\":[...]} with one item per input row. Each item "
                    "must include slug, description_en, description_fr, official_url. "
                    "Descriptions must be natural, specific, sentence case, and max "
                    "50 words each. French must be idiomatic French. Never put "
                    "\"pas sur\" in a description; if the item is ambiguous, write a "
                    "conservative generic description based on its name and type. For "
                    "official_url, use exactly \"pas sur\" when you cannot identify an "
                    "official website or documentation with reasonable confidence. For "
                    "official_url, provide only the official website or documentation, "
                    "especially for tools and platforms; do not invent URLs. The CSV "
                    "writer stores uncertain official_url values as empty strings."
                ),
            },
            {
                "role": "user",
                "content": json.dumps({"rows": compact_rows}, ensure_ascii=False),
            },
        ],
    }


def extract_chat_json(response: dict) -> dict:
    content = response["choices"][0]["message"]["content"]
    data = extract_json(content)
    if not data:
        raise ValueError(f"OpenAI response did not contain JSON: {content[:300]}")
    return data


def call_openai_batch(rows: list[dict], args: argparse.Namespace) -> dict[str, dict]:
    api_key = args.openai_api_key or os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise SystemExit("OPENAI_API_KEY is missing. Pass --openai-api-key or --env-file.")
    url = "https://api.openai.com/v1/chat/completions"
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    payload = openai_payload_for(rows, args.openai_model)
    last_error: Exception | None = None
    for attempt in range(1, args.max_retries + 1):
        try:
            response = requests.post(url, headers=headers, json=payload, timeout=90)
            if response.status_code in {429, 500, 502, 503, 504}:
                raise RuntimeError(f"OpenAI transient status {response.status_code}: {response.text[:300]}")
            response.raise_for_status()
            data = extract_chat_json(response.json())
            items = data.get("items")
            if not isinstance(items, list):
                raise ValueError("OpenAI JSON missing items array")
            return {str(item.get("slug")): item for item in items if isinstance(item, dict)}
        except Exception as exc:
            last_error = exc
            if attempt == args.max_retries:
                break
            time.sleep(min(2 ** attempt, 20))
    raise RuntimeError(f"OpenAI batch failed after {args.max_retries} attempts: {last_error}")


def enrich_openai_batch(rows: list[dict], args: argparse.Namespace) -> list[dict]:
    by_slug = call_openai_batch(rows, args)
    enriched_rows = []
    for row in rows:
        data = by_slug.get(row["slug"], {})
        desc_en = clean_description(row, "en", data.get("description_en") or "")
        desc_fr = clean_description(row, "fr", data.get("description_fr") or "")
        official = data.get("official_url") or known_url(row["name"], row["name_fr"], row["type"]) or UNSURE
        official = normalize_url(official, row["name"], row["name_fr"], row["type"])
        if official == UNSURE:
            known = known_url(row["name"], row["name_fr"], row["type"])
            if known:
                official = known
        enriched_rows.append(
            {
                "description_en": desc_en,
                "description_fr": desc_fr,
                "official_url": csv_url(official),
            }
        )
    return enriched_rows


def load_model(model_path: Path, requested_device: str = "auto"):
    if not model_path.exists():
        raise SystemExit(f"Model path not found: {model_path}")
    tokenizer = AutoTokenizer.from_pretrained(model_path, trust_remote_code=True)
    use_mps = requested_device in {"auto", "mps"} and torch.backends.mps.is_available()
    dtype = torch.float16 if use_mps else torch.float32
    model = AutoModelForCausalLM.from_pretrained(
        model_path,
        dtype=dtype,
        trust_remote_code=True,
        low_cpu_mem_usage=True,
    )
    device = "mps" if use_mps else "cpu"
    model.to(device)
    model.eval()
    return tokenizer, model, device


def generate_one(tokenizer, model, device: str, row: dict) -> dict:
    messages = [
        {"role": "system", "content": "You are a precise catalog enrichment assistant."},
        {"role": "user", "content": prompt_for(row)},
    ]
    if hasattr(tokenizer, "apply_chat_template"):
        try:
            text = tokenizer.apply_chat_template(
                messages,
                tokenize=False,
                add_generation_prompt=True,
                enable_thinking=False,
            )
        except TypeError:
            text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    else:
        text = messages[0]["content"] + "\n\n" + messages[1]["content"] + "\nJSON:"

    inputs = tokenizer(text, return_tensors="pt").to(device)
    with torch.inference_mode():
        out = model.generate(
            **inputs,
            max_new_tokens=120,
            do_sample=False,
            pad_token_id=tokenizer.eos_token_id,
        )
    generated = tokenizer.decode(out[0][inputs["input_ids"].shape[-1]:], skip_special_tokens=True)
    data = extract_json(generated)
    desc_en = clean_description(row, "en", data.get("description_en") or "")
    desc_fr = clean_description(row, "fr", data.get("description_fr") or "")
    official = data.get("official_url") or known_url(row["name"], row["name_fr"], row["type"]) or UNSURE
    official = normalize_url(official, row["name"], row["name_fr"], row["type"])
    if official == UNSURE:
        known = known_url(row["name"], row["name_fr"], row["type"])
        if known:
            official = known
    return {
        "description_en": desc_en,
        "description_fr": desc_fr,
        "official_url": csv_url(official),
    }


def fallback_description(row: dict, lang: str) -> str:
    name = row["name"] if lang == "en" else row["name_fr"]
    typ = row["type"]
    if lang == "en":
        templates = {
            "knowledge": f"{name} is conceptual knowledge used to understand, compare, and make informed decisions in digital work.",
            "hard_skill": f"{name} is a practical skill used to produce reliable digital deliverables, solve tasks, and improve work quality.",
            "soft_skill": f"{name} is a professional behavior skill used to collaborate, communicate, and perform effectively in real situations.",
            "tool_platform": f"{name} is a tool or platform competency focused on practical use, setup, workflows, and troubleshooting.",
            "language": f"{name} is a language competency focused on understanding, communication, production, and professional use.",
        }
    else:
        templates = {
            "knowledge": f"{name} est une connaissance conceptuelle utile pour comprendre, comparer et décider dans les métiers numériques.",
            "hard_skill": f"{name} est une compétence pratique pour produire des livrables numériques fiables, résoudre des tâches et améliorer la qualité du travail.",
            "soft_skill": f"{name} est une compétence comportementale utile pour collaborer, communiquer et agir efficacement en situation professionnelle.",
            "tool_platform": f"{name} est une compétence liée à un outil ou une plateforme, centrée sur l’usage, les workflows et le dépannage.",
            "language": f"{name} est une compétence linguistique centrée sur la compréhension, la communication, la production et l’usage professionnel.",
        }
    return normalize_words(templates.get(typ, templates["hard_skill"]))


def read_rows(path: Path) -> tuple[list[str], list[dict]]:
    with path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        return list(reader.fieldnames or []), list(reader)


def write_rows(path: Path, fieldnames: list[str], rows: list[dict]) -> None:
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def main() -> int:
    args = parse_args()
    load_env_file(args.env_file)
    args.openai_api_key = args.openai_api_key or os.environ.get("OPENAI_API_KEY")
    fieldnames, rows = read_rows(args.input)
    for field in NEW_FIELDS:
        if field not in fieldnames:
            fieldnames.append(field)

    tokenizer = model = device = None
    if args.mode == "openai":
        print(f"mode=openai model={args.openai_model} rows={len(rows)} batch_size={args.batch_size}")
    elif args.mode == "llm":
        tokenizer, model, device = load_model(args.model, args.device)
        print(f"model={args.model} device={device} rows={len(rows)}")
    else:
        print(f"mode=heuristic rows={len(rows)}")

    backup = None
    if args.apply and args.output.exists() and args.input == args.output:
        backup = args.output.with_suffix(args.output.suffix + f".bak-{int(time.time())}")
        shutil.copy2(args.output, backup)
        print(f"backup={backup}")

    start = time.time()
    processed = 0
    target_indices = list(range(args.offset, len(rows)))
    if args.mode == "openai":
        batch: list[tuple[int, dict]] = []
        for idx in target_indices:
            if args.limit is not None and processed >= args.limit:
                break
            row = rows[idx]
            if args.resume and all((row.get(f) or "").strip() for f in NEW_FIELDS):
                continue
            if args.only_unsure_descriptions and not has_unsure_description(row):
                continue
            if args.only_generic and not is_generic_row(row):
                continue
            if args.limit is not None and processed + len(batch) >= args.limit:
                break
            batch.append((idx, row))
            if len(batch) < args.batch_size:
                continue
            enriched_batch = enrich_openai_batch([item[1] for item in batch], args)
            for (row_idx, row_to_update), enriched in zip(batch, enriched_batch):
                rows[row_idx].update(enriched)
                processed += 1
                print(
                    f"[{row_idx+1}/{len(rows)}] {row_to_update['slug']} -> "
                    f"{rows[row_idx]['official_url']} ({processed} processed)",
                    flush=True,
                )
            batch = []
            if args.apply and processed % args.checkpoint_every == 0:
                write_rows(args.output, fieldnames, rows)
        if batch and (args.limit is None or processed < args.limit):
            remaining = batch[: None if args.limit is None else args.limit - processed]
            enriched_batch = enrich_openai_batch([item[1] for item in remaining], args)
            for (row_idx, row_to_update), enriched in zip(remaining, enriched_batch):
                rows[row_idx].update(enriched)
                processed += 1
                print(
                    f"[{row_idx+1}/{len(rows)}] {row_to_update['slug']} -> "
                    f"{rows[row_idx]['official_url']} ({processed} processed)",
                    flush=True,
                )
    else:
        for idx in target_indices:
            if args.limit is not None and processed >= args.limit:
                break
            row = rows[idx]
            if args.resume and all((row.get(f) or "").strip() for f in NEW_FIELDS):
                continue
            if args.only_unsure_descriptions and not has_unsure_description(row):
                continue
            if args.only_generic and not is_generic_row(row):
                continue
            if args.mode == "llm":
                enriched = generate_one(tokenizer, model, device, row)
            else:
                enriched = {
                    "description_en": fallback_description(row, "en"),
                    "description_fr": fallback_description(row, "fr"),
                    "official_url": csv_url(known_url(row["name"], row["name_fr"], row["type"]) or UNSURE),
                }
            row.update(enriched)
            processed += 1
            print(
                f"[{idx+1}/{len(rows)}] {row['slug']} -> "
                f"{row['official_url']} ({processed} processed)",
                flush=True,
            )
            if args.apply and processed % args.checkpoint_every == 0:
                write_rows(args.output, fieldnames, rows)

    if args.apply:
        write_rows(args.output, fieldnames, rows)
        print(f"wrote={args.output}")
    else:
        preview = args.output.with_name(args.output.stem + ".preview.csv")
        write_rows(preview, fieldnames, rows)
        print(f"dry_run_preview={preview}")

    elapsed = time.time() - start
    print(f"processed={processed} elapsed_sec={elapsed:.1f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
