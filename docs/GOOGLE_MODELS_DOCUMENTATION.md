# Documentation des Modeles Google (Gemini) - Reference Etudesk

> **Derniere mise a jour:** 13 fevrier 2026
> **Sources:** [Gemini Models](https://ai.google.dev/gemini-api/docs/models), [Gemini Pricing](https://ai.google.dev/gemini-api/docs/pricing)

---

## Table des Matieres

1. [Resume Executif](#resume-executif)
2. [Architecture des Modeles Gemini](#architecture-des-modeles-gemini)
3. [Gemini 3 Family (Latest)](#gemini-3-family-latest)
   - [Gemini 3 Pro](#gemini-3-pro)
   - [Gemini 3 Flash](#gemini-3-flash)
4. [Gemini 2.5 Family](#gemini-25-family)
   - [Gemini 2.5 Pro](#gemini-25-pro)
   - [Gemini 2.5 Flash](#gemini-25-flash)
   - [Gemini 2.5 Flash-Lite](#gemini-25-flash-lite)
5. [Gemini 2.0 Flash (Legacy)](#gemini-20-flash-legacy)
6. [Gemini Nano (On-Device)](#gemini-nano-on-device)
7. [Modeles d'Embeddings](#modeles-dembeddings)
   - [gemini-embedding-001](#gemini-embedding-001)
   - [text-embedding-004 (Deprecated)](#text-embedding-004-deprecated)
8. [Modeles Specialises](#modeles-specialises)
9. [Comparatif Google vs OpenAI vs Anthropic](#comparatif-google-vs-openai-vs-anthropic)
10. [Fonctionnalites Cles](#fonctionnalites-cles)
11. [Optimisation des Couts](#optimisation-des-couts)
12. [Pertinence pour Etudesk](#pertinence-pour-etudesk)
13. [Sources](#sources)

---

## Resume Executif

### Gamme Gemini complete (fev 2026)

| Modele | Model ID | Cout Input/Output (1M) | Cached Input | Contexte | Max Output | Sortie |
|--------|----------|------------------------|-------------|----------|------------|--------|
| **Gemini 3 Pro** | `gemini-3-pro-preview` | $2.00 / $12.00 | $0.20 (90%) | 1M | 65K | Nov 2025 |
| **Gemini 3 Flash** | `gemini-3-flash-preview` | $0.50 / $3.00 | $0.05 (90%) | 1M | 65K | Dec 2025 |
| **Gemini 2.5 Pro** | `gemini-2.5-pro` | $1.25 / $10.00 | $0.125 (90%) | 1M | 65K | Jun 2025 |
| **Gemini 2.5 Flash** | `gemini-2.5-flash` | $0.30 / $2.50 | $0.03 (90%) | 1M | 65K | Jun 2025 |
| **Gemini 2.5 Flash-Lite** | `gemini-2.5-flash-lite` | $0.10 / $0.40 | $0.01 (90%) | 1M | 65K | Jul 2025 |
| **Gemini 2.0 Flash** | `gemini-2.0-flash` | $0.10 / $0.40 | $0.025 (75%) | 1M | 8K | Fev 2025 |
| **Gemini Nano** | On-device | Gratuit | — | Local | — | 2024+ |
| **gemini-embedding-001** | `gemini-embedding-001` | $0.15 / — | — | 2K | 3072 dim | Jul 2025 |

### Positionnement

| Tier | Google | OpenAI (Etudesk actuel) | Anthropic |
|------|--------|-------------------------|-----------|
| **Flagship/Reasoning** | Gemini 3 Pro ($2/$12) | GPT-5 ($1.25/$10) | Opus 4.6 ($5/$25) |
| **Balanced** | Gemini 2.5 Pro ($1.25/$10) | GPT-5 ($1.25/$10) | Sonnet 4.5 ($3/$15) |
| **Fast** | Gemini 3 Flash ($0.50/$3) | GPT-5-mini ($0.25/$2) | Haiku 4.5 ($1/$5) |
| **Ultra-cheap** | Gemini 2.5 Flash-Lite ($0.10/$0.40) | GPT-5-nano ($0.05/$0.40) | — |
| **Embedding** | gemini-embedding-001 ($0.15) | text-embedding-3-small ($0.02) | — |

---

## Architecture des Modeles Gemini

```
+----------------------------------------------------------------------------+
|                      GOOGLE GEMINI FAMILY (Feb 2026)                       |
+----------------------------------------------------------------------------+
|                                                                            |
|  GENERATION 3 (Latest, Preview)                                           |
|  +-------------------+  +-------------------+                              |
|  | Gemini 3 Pro      |  | Gemini 3 Flash    |                             |
|  | Best reasoning    |  | Fast + thinking   |                             |
|  | $2/$12 per MTok   |  | $0.50/$3 per MTok |                             |
|  | 1M context        |  | 1M context        |                             |
|  | 65K max output    |  | 65K max output    |                             |
|  +-------------------+  +-------------------+                              |
|                                                                            |
|  GENERATION 2.5 (Stable, Production-ready)                                |
|  +-------------------+  +-------------------+  +--------------------+     |
|  | Gemini 2.5 Pro    |  | Gemini 2.5 Flash  |  | Gemini 2.5         |     |
|  | SOTA thinking     |  | Price-performance |  | Flash-Lite         |     |
|  | $1.25/$10 per MTok|  | $0.30/$2.50       |  | Ultra-cheap        |     |
|  | 1M context        |  | 1M context        |  | $0.10/$0.40        |     |
|  +-------------------+  +-------------------+  | 1M context         |     |
|                                                 +--------------------+     |
|                                                                            |
|  GENERATION 2.0 (Legacy — shutdown 31 mars 2026)                          |
|  +-------------------+  +-------------------+                              |
|  | Gemini 2.0 Flash  |  | Gemini 2.0        |                             |
|  | $0.10/$0.40       |  | Flash-Lite         |                             |
|  | 1M / 8K output    |  | $0.075/$0.30       |                             |
|  +-------------------+  +-------------------+                              |
|                                                                            |
|  ON-DEVICE                              EMBEDDINGS                         |
|  +-------------------+                  +-------------------+              |
|  | Gemini Nano       |                  | gemini-embedding  |              |
|  | Android ML Kit    |                  | -001              |              |
|  | 0 cout cloud      |                  | $0.15/1M tokens   |              |
|  +-------------------+                  | 3072 dimensions   |              |
|                                         +-------------------+              |
|                                                                            |
+----------------------------------------------------------------------------+
```

---

## Gemini 3 Family (Latest)

> **Release:** Novembre-Decembre 2025 (Preview)
> **Knowledge Cutoff:** Janvier 2025
> **Contexte:** 1,048,576 tokens (toute la famille)
> **Max Output:** 65,536 tokens (toute la famille)

La generation Gemini 3 apporte des ameliorations significatives en reasoning, comprehension multimodale, fiabilite et capacites agentiques par rapport a Gemini 2.5.

### Gemini 3 Pro

> **Role:** Modele de reasoning le plus avance de Google
> **Model ID:** `gemini-3-pro-preview`
> **Release:** 18 novembre 2025

| Caracteristique | Valeur |
|-----------------|--------|
| **Context Window** | 1,048,576 tokens (1M) |
| **Max Output Tokens** | 65,536 tokens |
| **Knowledge Cutoff** | Janvier 2025 |
| **Thinking** | Oui (configurable) |
| **Multimodal** | Texte, images, video, audio, PDF |

| Type | Cout / 1M tokens |
|------|-------------------|
| Input (≤200K) | $2.00 |
| Input (>200K) | $4.00 (2x) |
| Cached Input (≤200K) | $0.20 (90% reduction) |
| Cached Input (>200K) | $0.40 (90% reduction) |
| Cache Storage | $4.50/1M/heure |
| Output (≤200K) | $12.00 |
| Output (>200K) | $18.00 (1.5x) |
| Batch Input | $1.00 (50%) |
| Batch Output | $6.00 (50%) |

**Fonctionnalites:**
- Thinking configurable (raisonnement profond)
- Function calling, structured outputs
- Code execution, file search
- Grounding (Google Search: $14/1K requetes, 5K/mois gratuit)
- URL context
- Batch API (50% reduction)

**Ameliorations vs Gemini 2.5 Pro:**
- Raisonnement significativement ameliore
- Instructions complexes mieux suivies
- Tool use et workflows agentiques ameliores
- Meilleur long context
- Plus cher (+60% input, +20% output standard)

---

### Gemini 3 Flash

> **Role:** Modele rapide avec thinking — workflows agentiques, chat, coding
> **Model ID:** `gemini-3-flash-preview`
> **Release:** 17 decembre 2025

| Caracteristique | Valeur |
|-----------------|--------|
| **Context Window** | 1,048,576 tokens (1M) |
| **Max Output Tokens** | 65,536 tokens |
| **Knowledge Cutoff** | Janvier 2025 |
| **Thinking** | Oui (minimal, low, medium, high — default: high) |
| **Multimodal** | Texte, images, video, audio, PDF |

| Type | Cout / 1M tokens |
|------|-------------------|
| Input (texte/image/video) | $0.50 |
| Input (audio) | $1.00 |
| Cached Input | $0.05 (90% reduction) |
| Cache Storage | $1.00/1M/heure |
| Output | $3.00 |
| Batch Input | $0.25 (50%) |
| Batch Output | $1.50 (50%) |

**Points forts:**
- Thinking configurable via `thinking_level` (minimal/low/medium/high)
- Ameliorations larges en reasoning, multimodal, fiabilite vs 2.5 Flash
- Context caching automatique (90% reduction)
- Free tier disponible
- Pricing plat (pas de surcharge long contexte)

**Cas d'usage:**
- Workflows agentiques multi-turn
- Chat conversationnel rapide
- Coding assistance
- Analyse multimodale

---

## Gemini 2.5 Family

> **Release:** Juin-Juillet 2025 (Stable)
> **Knowledge Cutoff:** Janvier 2025
> **Contexte:** 1,048,576 tokens (toute la famille)
> **Max Output:** 65,536 tokens

### Gemini 2.5 Pro

> **Role:** Modele de thinking state-of-the-art — problemes complexes
> **Model ID:** `gemini-2.5-pro`
> **Release:** 17 juin 2025

| Caracteristique | Valeur |
|-----------------|--------|
| **Context Window** | 1,048,576 tokens (1M) |
| **Max Output Tokens** | 65,536 tokens |
| **Knowledge Cutoff** | Janvier 2025 |
| **Thinking** | Oui |
| **Multimodal** | Texte, images, video, audio, PDF |

| Type | Cout / 1M tokens |
|------|-------------------|
| Input (≤200K) | $1.25 |
| Input (>200K) | $2.50 (2x) |
| Cached Input (≤200K) | $0.125 (90% reduction) |
| Cached Input (>200K) | $0.25 (90% reduction) |
| Cache Storage | $4.50/1M/heure |
| Output (≤200K) | $10.00 |
| Output (>200K) | $15.00 (1.5x) |
| Batch Input | $0.625 (50%) |
| Batch Output | $5.00 (50%) |

**Fonctionnalites:** Thinking, code execution, file search, function calling, Google Maps grounding, Google Search grounding, structured outputs, batch API, caching, URL context

**Note:** Meme prix que GPT-5 ($1.25/$10) pour les prompts ≤200K, plus cher au-dela.

---

### Gemini 2.5 Flash

> **Role:** Meilleur rapport prix-performance — usage general
> **Model ID:** `gemini-2.5-flash`
> **Release:** 25 juin 2025

| Caracteristique | Valeur |
|-----------------|--------|
| **Context Window** | 1,048,576 tokens (1M) |
| **Max Output Tokens** | 65,536 tokens |
| **Knowledge Cutoff** | Janvier 2025 |
| **Thinking** | Oui (configurable) |
| **Multimodal** | Texte, images, video, audio, PDF |

| Type | Cout / 1M tokens |
|------|-------------------|
| Input (texte/image/video) | $0.30 |
| Input (audio) | $1.00 |
| Cached Input | $0.03 (90% reduction) |
| Cache Storage | $1.00/1M/heure |
| Output | $2.50 |
| Batch Input | $0.15 (50%) |
| Batch Output | $1.25 (50%) |

**Points forts:**
- Meilleur modele Google en rapport prix-performance
- Thinking hybrid configurable
- Free tier disponible
- Pricing plat (pas de surcharge long contexte)

**Comparaison directe avec GPT-5-mini:**
- Input: $0.30 vs $0.25 (20% plus cher)
- Output: $2.50 vs $2.00 (25% plus cher)
- Contexte: 1M vs 400K (2.5x plus grand)
- Max output: 65K vs 128K (2x plus petit)
- Thinking: Oui vs Non (avantage Gemini)

---

### Gemini 2.5 Flash-Lite

> **Role:** Le plus economique — classification, guardrails, taches simples
> **Model ID:** `gemini-2.5-flash-lite`
> **Release:** 22 juillet 2025

| Caracteristique | Valeur |
|-----------------|--------|
| **Context Window** | 1,048,576 tokens (1M) |
| **Max Output Tokens** | 65,536 tokens |
| **Knowledge Cutoff** | Janvier 2025 |
| **Thinking** | Oui (configurable) |
| **Vitesse** | ~406 tokens/sec |
| **Multimodal** | Texte, images, video, audio, PDF |

| Type | Cout / 1M tokens |
|------|-------------------|
| Input (texte/image/video) | $0.10 |
| Input (audio) | $0.30 |
| Cached Input | $0.01 (90% reduction) |
| Cache Storage | $1.00/1M/heure |
| Output | $0.40 |
| Batch Input | $0.05 (50%) |
| Batch Output | $0.20 (50%) |

**Points forts:**
- Modele le plus economique de la gamme 2.5
- Thinking disponible meme a ce prix
- 406 tokens/sec (ultra-rapide)
- Free tier disponible
- Pricing identique a Gemini 2.0 Flash mais avec thinking + 65K output

**Comparaison directe avec GPT-5-nano:**
- Input: $0.10 vs $0.05 (2x plus cher)
- Output: $0.40 vs $0.40 (identique)
- Contexte: 1M vs 400K (2.5x plus grand)
- Thinking: Oui vs Non (avantage Gemini)
- Max output: 65K vs 128K (2x plus petit)

---

## Gemini 2.0 Flash (Legacy)

> **ATTENTION:** Arret programme le 31 mars 2026. Migrer vers Gemini 2.5 Flash ou 3 Flash.
> **Model ID:** `gemini-2.0-flash`
> **Release:** Fevrier 2025

| Caracteristique | Valeur |
|-----------------|--------|
| **Context Window** | 1,048,576 tokens (1M) |
| **Max Output Tokens** | 8,192 tokens |
| **Knowledge Cutoff** | Aout 2024 |
| **Thinking** | Experimental |

| Type | Cout / 1M tokens |
|------|-------------------|
| Input (texte/image/video) | $0.10 |
| Input (audio) | $0.70 |
| Cached Input | $0.025 (75% reduction) |
| Output | $0.40 |

**Raisons de migrer:** Max output 8x plus petit (8K vs 65K), thinking experimental vs stable, knowledge cutoff ancien.

---

## Gemini Nano (On-Device)

> **Role:** Inference on-device (Android) — zero cout cloud, zero latence reseau
> **Disponibilite:** ML Kit GenAI APIs (Android)
> **Derniere version:** nano-v3 (Pixel 10 series)

| Caracteristique | Valeur |
|-----------------|--------|
| **Execution** | On-device (Android) |
| **Cout cloud** | $0 (tout local) |
| **Latence reseau** | 0ms |
| **Confidentialite** | Donnees jamais quittent l'appareil |
| **API** | ML Kit GenAI APIs (AICore) |
| **Appareils** | Pixel 10 Pro+, Samsung Galaxy S25+ |

**APIs disponibles:**
- Summarization (resume de texte)
- Proofreading (correction)
- Rewriting (reformulation)
- Image description
- Speech recognition

**Architecture:** Gemini Nano comme fondation + LoRA adapters specifiques par API

**Limites:**
- Android uniquement (pas d'API cloud directe)
- Pas de function calling
- Appareils haut de gamme requis
- Pas utilisable pour backend/serveur

**Pertinence Etudesk:** Faible — modele on-device, pas compatible avec l'architecture backend d'Etudesk. Potentiellement interessant pour une future app mobile native.

---

## Modeles d'Embeddings

### gemini-embedding-001

> **Role:** Embeddings semantiques nouvelle generation
> **Model ID:** `gemini-embedding-001`
> **Release:** Juillet 2025

| Caracteristique | Valeur |
|-----------------|--------|
| **Max Input Tokens** | 2,048 tokens |
| **Dimensions par defaut** | 3,072 |
| **Dimensions configurables** | 768, 1,536, 3,072 (MRL) |
| **Langues** | 100+ |
| **Technique** | Matryoshka Representation Learning (MRL) |

| Type | Cout / 1M tokens |
|------|-------------------|
| Standard | $0.15 |
| Batch | $0.075 (50%) |
| Free Tier | Disponible |

**Avantages vs text-embedding-004:**
- Dimensions 4x plus grandes par defaut (3072 vs 768)
- Dimensions configurables via MRL
- 100+ langues (vs non specifie)
- Model actif (vs deprecated)

**Comparaison avec OpenAI text-embedding-3-small (Etudesk actuel):**
- Cout: $0.15 vs $0.02 (7.5x plus cher)
- Dimensions: 3072 vs 1536 (2x plus)
- Max input: 2048 vs 8191 (4x plus petit)
- Langues: 100+ vs ~50

---

### text-embedding-004 (Deprecated)

> **DEPRECATED:** Arret le 14 janvier 2026. Remplace par gemini-embedding-001.
> **Model ID:** `text-embedding-004`

| Caracteristique | Valeur |
|-----------------|--------|
| **Max Input Tokens** | 3,000 tokens |
| **Dimensions** | 768 (configurable) |
| **Cout** | Gratuit |

**Ne plus utiliser** — migrer vers gemini-embedding-001.

---

## Modeles Specialises

### Generation d'images

| Modele | Model ID | Cout/image | Notes |
|--------|----------|------------|-------|
| **Imagen 4 Ultra** | `imagen-4.0-ultra-generate-001` | $0.06 | Meilleure qualite |
| **Imagen 4** | `imagen-4.0-generate-001` | $0.04 | Standard |
| **Imagen 4 Fast** | `imagen-4.0-fast-generate-001` | $0.02 | Rapide, economique |
| **Gemini 2.5 Flash Image** | `gemini-2.5-flash-image` | $0.039 | Multimodal |

### Text-to-Speech

| Modele | Model ID | Input/Output (1M) |
|--------|----------|-------------------|
| **Gemini 2.5 Flash TTS** | `gemini-2.5-flash-preview-tts` | $0.50 / $10.00 |
| **Gemini 2.5 Pro TTS** | `gemini-2.5-pro-preview-tts` | $1.00 / $20.00 |

### Generation video

| Modele | Model ID | Cout/seconde |
|--------|----------|-------------|
| **Veo 3.1** | `veo-3.1-generate-preview` | $0.40 (720p/1080p), $0.60 (4K) |
| **Veo 3.1 Fast** | `veo-3.1-fast-generate-preview` | $0.15 (720p/1080p), $0.35 (4K) |
| **Veo 3** | `veo-3.0-generate-001` | $0.40 |
| **Veo 2** | `veo-2.0-generate-001` | $0.35 |

### Open Source (Gemma)

| Modele | Cout | Notes |
|--------|------|-------|
| **Gemma 3** | Gratuit | Open source, deploiement local |
| **Gemma 3n** | Gratuit | Version nano, on-device |

---

## Comparatif Google vs OpenAI vs Anthropic

### Modeles Flagship (Raisonnement avance)

| | Gemini 3 Pro | GPT-5.2 | Claude Opus 4.6 |
|--|--------------|---------|-----------------|
| **Input $/1M** | $2.00 | $1.75 | $5.00 |
| **Output $/1M** | $12.00 | $14.00 | $25.00 |
| **Contexte** | 1M | 400K | 200K (1M beta) |
| **Max Output** | 65K | 128K | 128K |
| **Thinking** | Oui (configurable) | Oui (none→xhigh) | Adaptive |
| **Cached Input** | $0.20 (90%) | $0.18 (90%) | $0.50 (90%) |

### Modeles Principaux (Usage general)

| | Gemini 2.5 Pro | GPT-5 (Etudesk) | Claude Sonnet 4.5 |
|--|----------------|------------------|-------------------|
| **Input $/1M** | $1.25 | $1.25 | $3.00 |
| **Output $/1M** | $10.00 | $10.00 | $15.00 |
| **Contexte** | 1M | 400K | 200K (1M beta) |
| **Max Output** | 65K | 128K | 64K |
| **Thinking** | Oui | Non | Oui |

### Modeles Rapides (Sub-agents, chat)

| | Gemini 3 Flash | GPT-5-mini | Claude Haiku 4.5 |
|--|----------------|------------|------------------|
| **Input $/1M** | $0.50 | $0.25 | $1.00 |
| **Output $/1M** | $3.00 | $2.00 | $5.00 |
| **Contexte** | 1M | 400K | 200K |
| **Max Output** | 65K | 128K | 64K |
| **Thinking** | Oui | Non | Oui |

### Modeles Economiques (Guardrails, classification)

| | Gemini 2.5 Flash-Lite | GPT-5-nano (Etudesk) | Claude Haiku 3 |
|--|----------------------|----------------------|----------------|
| **Input $/1M** | $0.10 | $0.05 | $0.25 |
| **Output $/1M** | $0.40 | $0.40 | $1.25 |
| **Contexte** | 1M | 400K | 200K |
| **Max Output** | 65K | 128K | 4K |
| **Thinking** | Oui | Non | Non |

### Embeddings

| | gemini-embedding-001 | text-embedding-3-small (Etudesk) |
|--|---------------------|----------------------------------|
| **Cout/1M** | $0.15 | $0.02 |
| **Dimensions** | 3072 (configurable) | 1536 |
| **Max Input** | 2,048 tokens | 8,191 tokens |
| **Langues** | 100+ | ~50 |

---

## Fonctionnalites Cles

### Thinking (Raisonnement configurable)

Tous les modeles Gemini 2.5+ et 3 supportent le thinking configurable. Les niveaux disponibles (Gemini 3 Flash):
- `minimal` — Raisonnement minimal, reponse rapide
- `low` — Raisonnement leger
- `medium` — Raisonnement modere
- `high` — Raisonnement profond (defaut)

Les tokens de thinking sont factures au tarif output.

### Context Caching

- **Cache read:** 10% du prix input (90% reduction)
- **Cache storage:** $1.00-$4.50 / 1M tokens / heure selon le modele
- Cache automatique sur les prefixes identiques
- Seuils de tokens minimums pour activer le caching

### Grounding (Google Search)

- **Google Search:** $14/1K requetes (5K requetes/mois gratuites pour Gemini 3)
- **Google Maps:** $25/1K requetes (10K/mois gratuites pour 2.5 Pro)
- Permet au modele d'acceder a des infos en temps reel

### Multimodal

Tous les modeles 2.5+ supportent:
- **Input:** Texte, images, video, audio, PDF
- **Output:** Texte (+ images pour certains modeles)

### Batch API

50% de reduction sur tous les modeles, traitement asynchrone.

### Free Tier

Gemini 2.5 Flash, 2.5 Flash-Lite, 3 Flash et les embeddings offrent un free tier (tokens gratuits avec limites de rate).

---

## Optimisation des Couts

### Cout par requete Copilot (hypothetique — si Etudesk utilisait Gemini)

| Composant | Gemini 2.5 Pro | Gemini 3 Flash | GPT-5 (actuel) |
|-----------|----------------|----------------|-----------------|
| Agent principal (2K in, 1K out) | ~$0.0125 | ~$0.004 | ~$0.0125 |
| Sub-agent (1K in, 500 out) | ~$0.00625 | ~$0.002 | ~$0.00125 |
| Guardrail (500 in, 100 out) | ~$0.000665 | ~$0.00055 | ~$0.000065 |
| **Total moyen** | **~$0.019** | **~$0.007** | **~$0.014** |

### Cout mensuel estime (par utilisateur actif, 200 req/mois)

| Configuration | Cout mensuel | vs GPT-5 actuel |
|---------------|-------------|-----------------|
| Gemini 2.5 Pro (partout) | ~$3.80 | +36% |
| Gemini 3 Flash (partout) | ~$1.40 | -50% |
| Mix Gemini 3 Flash + 2.5 Flash-Lite | ~$1.00 | -64% |
| GPT-5 + GPT-5-nano (actuel) | ~$2.80 | baseline |

### Configuration la plus economique (Google)

```
Agent principal: Gemini 3 Flash ($0.50/$3.00) — thinking + rapide
Sub-agents:      Gemini 2.5 Flash ($0.30/$2.50) — bon prix-performance
Guardrails:      Gemini 2.5 Flash-Lite ($0.10/$0.40) — ultra-cheap
Embeddings:      gemini-embedding-001 ($0.15) — plus cher que OpenAI
```

---

## Pertinence pour Etudesk

### Pourquoi rester sur OpenAI (recommandation actuelle)

1. **Infrastructure existante:** OpenAI Agents SDK, tools, guardrails — tout est deja integre
2. **GPT-5-nano imbattable:** $0.05/$0.40 pour guardrails/classification (Gemini 2.5 Flash-Lite: $0.10/$0.40)
3. **Max output 128K:** GPT-5 offre 128K partout (Gemini: 65K max)
4. **Ecosysteme complet:** Whisper, GPT-Image-1, embeddings — tout en un
5. **Embeddings 7.5x moins cher:** text-embedding-3-small ($0.02) vs gemini-embedding-001 ($0.15)

### Cas ou Gemini serait pertinent

1. **Contexte 1M natif:** Tous les modeles Gemini offrent 1M de contexte (vs 400K GPT-5, 200K Claude)
2. **Thinking configurable:** Gemini 3 Flash offre thinking a $0.50/$3.00 (le moins cher du marche avec reasoning)
3. **Free tier:** Pour du prototypage ou des tests, Gemini offre des tokens gratuits
4. **Grounding Google Search:** Acces natif a Google Search et Maps depuis le modele
5. **Gemini 3 Flash comme alternative economique:** 50% moins cher que GPT-5 actuel en configuration mixte
6. **Multi-provider resilience:** Fallback si OpenAI a des problemes de disponibilite
7. **Gemini Nano pour mobile:** Si Etudesk developpe une app native Android, inference gratuite on-device

### Migration potentielle (non recommandee actuellement)

```typescript
// Hypothetique — NE PAS implementer sans evaluation approfondie
// import { GoogleGenAI } from '@google/genai';
//
// const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
//
// const response = await ai.models.generateContent({
//   model: 'gemini-3-flash-preview',
//   contents: [{ role: 'user', parts: [{ text: userMessage }] }],
//   config: {
//     thinkingConfig: { thinkingLevel: 'medium' },
//     systemInstruction: systemPrompt,
//   },
// });
```

### Scenario multi-provider (futur possible)

```
                    +------------------+
                    |  Router/Fallback |
                    +--------+---------+
                             |
           +-----------------+-----------------+
           |                 |                 |
    +------+------+   +------+------+   +------+------+
    | OpenAI      |   | Google      |   | Anthropic   |
    | GPT-5       |   | Gemini 3    |   | Claude      |
    | (Principal) |   | (Fallback)  |   | (Fallback)  |
    +-------------+   +-------------+   +-------------+
```

---

## Sources

### Documentation Officielle Google

**Gemini 3 Family:**
- [Gemini 3 Developer Guide](https://ai.google.dev/gemini-api/docs/gemini-3)
- [Gemini 3 Pro](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/3-pro)
- [Gemini 3 Flash](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/3-flash)
- [Introducing Gemini 3](https://blog.google/products/gemini/gemini-3/)
- [Build with Gemini 3 Flash](https://blog.google/technology/developers/build-with-gemini-3-flash/)

**Gemini 2.5 Family:**
- [Gemini Models Overview](https://ai.google.dev/gemini-api/docs/models)
- [Gemini 2.5 Pro](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/2-5-pro) (non lié ici mais disponible sur Vertex AI docs)
- [Gemini 2.5 Flash](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/2-5-flash)
- [Gemini 2.5 Flash-Lite GA](https://developers.googleblog.com/en/gemini-25-flash-lite-is-now-stable-and-generally-available/)

**Embeddings:**
- [Embeddings Guide](https://ai.google.dev/gemini-api/docs/embeddings)
- [gemini-embedding-001 GA](https://developers.googleblog.com/gemini-embedding-available-gemini-api/)

**Gemini Nano:**
- [Gemini Nano Android](https://developer.android.com/ai/gemini-nano)
- [ML Kit GenAI APIs](https://developers.google.com/ml-kit/genai)

**Pricing & General:**
- [Gemini API Pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Vertex AI Pricing](https://cloud.google.com/vertex-ai/generative-ai/pricing)
- [Release Notes](https://ai.google.dev/gemini-api/docs/changelog)

### Analyses et Comparatifs

- [Google Gemini API Pricing 2026 (MetaCTO)](https://www.metacto.com/blogs/the-true-cost-of-google-gemini-a-guide-to-api-pricing-and-integration)
- [AI API Pricing Comparison 2026 (IntuitionLabs)](https://intuitionlabs.ai/articles/ai-api-pricing-comparison-grok-gemini-openai-claude)
- [Gemini API Pricing Calculator (CostGoat)](https://costgoat.com/pricing/gemini-api)

### Modeles NON pertinents pour Etudesk

- Gemini 2.0 Flash / Flash-Lite (deprecated 31 mars 2026)
- Gemini 1.5 Pro / Flash (obsoletes)
- Gemini 1.0 (obsolete)
- PaLM 2 (obsolete, remplace par Gemini)
- text-embedding-004 (deprecated 14 janvier 2026)

---

*Document cree le 13 fevrier 2026 — Reference pour evaluation comparative des fournisseurs AI*
