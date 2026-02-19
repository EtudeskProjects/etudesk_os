# Documentation des Modeles Anthropic (Claude) - Reference Etudesk

> **Derniere mise a jour:** 19 fevrier 2026
> **Sources:** [Anthropic Models Overview](https://platform.claude.com/docs/en/about-claude/models/overview), [Anthropic Pricing](https://platform.claude.com/docs/en/about-claude/pricing)

---

## Table des Matieres

1. [Resume Executif](#resume-executif)
2. [Architecture des Modeles Claude](#architecture-des-modeles-claude)
3. [Modeles Actuels (Claude 4.5/4.6)](#modeles-actuels-claude-4546)
   - [Claude Opus 4.6](#claude-opus-46)
   - [Claude Sonnet 4.5](#claude-sonnet-45)
   - [Claude Haiku 4.5](#claude-haiku-45)
4. [Modeles Legacy](#modeles-legacy)
5. [Comparatif OpenAI vs Anthropic](#comparatif-openai-vs-anthropic)
6. [Fonctionnalites Cles](#fonctionnalites-cles)
7. [Optimisation des Couts](#optimisation-des-couts)
8. [Pertinence pour Etudesk](#pertinence-pour-etudesk)
9. [Sources](#sources)

---

## Resume Executif

### Modeles Claude en production (fev 2026)

| Modele | Model ID | Cout Input/Output (1M) | Cached Input | Contexte | Max Output | Sortie |
|--------|----------|------------------------|-------------|----------|------------|--------|
| **Claude Opus 4.6** | `claude-opus-4-6` | $5.00 / $25.00 | $0.50 (90%) | 200K (1M beta) | 128K | 5 fev 2026 |
| **Claude Sonnet 4.5** | `claude-sonnet-4-5` | $3.00 / $15.00 | $0.30 (90%) | 200K (1M beta) | 64K | 29 sept 2025 |
| **Claude Haiku 4.5** | `claude-haiku-4-5` | $1.00 / $5.00 | $0.10 (90%) | 200K | 64K | 1 oct 2025 |

### Positionnement

| Tier | Claude | OpenAI (Etudesk actuel) | Avantage |
|------|--------|-------------------------|----------|
| **Flagship** | Opus 4.6 ($5/$25) | GPT-5 ($1.25/$10) | OpenAI 4x moins cher en input, 2.5x en output |
| **Balanced** | Sonnet 4.5 ($3/$15) | GPT-5-mini ($0.25/$2) | OpenAI 12x moins cher en input, 7.5x en output |
| **Fast/Cheap** | Haiku 4.5 ($1/$5) | GPT-5-nano ($0.05/$0.40) | OpenAI 20x moins cher en input, 12.5x en output |

---

## Architecture des Modeles Claude

```
+----------------------------------------------------------------------------+
|                      ANTHROPIC CLAUDE FAMILY                                |
+----------------------------------------------------------------------------+
|                                                                            |
|  CURRENT GENERATION (4.5 / 4.6)                                           |
|  +-------------------+  +-------------------+  +--------------------+     |
|  | Claude Opus 4.6   |  | Claude Sonnet 4.5 |  | Claude Haiku 4.5   |     |
|  | Most intelligent  |  | Balanced speed/   |  | Fastest, near-     |     |
|  | Agents & coding   |  | intelligence      |  | frontier intel.    |     |
|  | $5/$25 per MTok   |  | $3/$15 per MTok   |  | $1/$5 per MTok     |     |
|  | 200K/1M context   |  | 200K/1M context   |  | 200K context       |     |
|  | 128K max output   |  | 64K max output    |  | 64K max output     |     |
|  +-------------------+  +-------------------+  +--------------------+     |
|                                                                            |
|  LEGACY                                                                    |
|  +-------------------+  +-------------------+  +--------------------+     |
|  | Claude Opus 4.5   |  | Claude Sonnet 4   |  | Claude Haiku 3     |     |
|  | $5/$25            |  | $3/$15            |  | $0.25/$1.25        |     |
|  +-------------------+  +-------------------+  +--------------------+     |
|  +-------------------+  +-------------------+                              |
|  | Claude Opus 4.1   |  | Claude Sonnet 3.7 |                             |
|  | $15/$75 (ancien)  |  | $3/$15            |                             |
|  +-------------------+  +-------------------+                              |
|                                                                            |
+----------------------------------------------------------------------------+
```

---

## Modeles Actuels (Claude 4.5/4.6)

### Claude Opus 4.6

> **Role:** Modele le plus intelligent — agents, coding, raisonnement complexe
> **Model ID:** `claude-opus-4-6`
> **Release:** 5 fevrier 2026

| Caracteristique | Valeur |
|-----------------|--------|
| **Context Window** | 200K tokens (1M en beta avec header `context-1m-2025-08-07`) |
| **Max Output Tokens** | 128,000 tokens |
| **Knowledge Cutoff** | Mai 2025 (fiable), Aout 2025 (training data) |
| **Extended Thinking** | Oui |
| **Adaptive Thinking** | Oui (unique a Opus 4.6) |
| **Latence** | Moderee |

| Type | Cout / 1M tokens |
|------|-------------------|
| Input | $5.00 |
| Cached Input (read) | $0.50 (90% reduction) |
| Cache Write (5min) | $6.25 (1.25x) |
| Cache Write (1h) | $10.00 (2x) |
| Output | $25.00 |
| Batch Input | $2.50 (50%) |
| Batch Output | $12.50 (50%) |

**Long Context Pricing (>200K input tokens):**

| Type | Cout / 1M tokens |
|------|-------------------|
| Input | $10.00 (2x) |
| Output | $37.50 (1.5x) |

**Fonctionnalites distinctives:**
- **Adaptive Thinking:** Le modele decide automatiquement quand un raisonnement plus profond est necessaire
- **Context Compaction:** Resume et remplace automatiquement le contexte ancien quand la conversation approche un seuil configurable
- **Agent Teams:** Support natif pour orchestration multi-agents
- **1M Context (beta):** 76% accuracy sur MRCR v2 8-needle 1M (vs 18.5% pour Sonnet 4.5)

**Benchmarks:**
- MRCR v2 256K: 93.0%
- MRCR v2 1M: 76.0%
- SWE-bench Verified: Top-tier

---

### Claude Sonnet 4.5

> **Role:** Equilibre vitesse/intelligence — usage general
> **Model ID:** `claude-sonnet-4-5-20250929` (alias: `claude-sonnet-4-5`)
> **Release:** 29 septembre 2025

| Caracteristique | Valeur |
|-----------------|--------|
| **Context Window** | 200K tokens (1M en beta) |
| **Max Output Tokens** | 64,000 tokens |
| **Knowledge Cutoff** | Janvier 2025 (fiable), Juillet 2025 (training data) |
| **Extended Thinking** | Oui |
| **Adaptive Thinking** | Non |
| **Latence** | Rapide |

| Type | Cout / 1M tokens |
|------|-------------------|
| Input | $3.00 |
| Cached Input (read) | $0.30 (90% reduction) |
| Output | $15.00 |
| Batch Input | $1.50 (50%) |
| Batch Output | $7.50 (50%) |

**Long Context Pricing (>200K input tokens):**

| Type | Cout / 1M tokens |
|------|-------------------|
| Input | $6.00 (2x) |
| Output | $22.50 (1.5x) |

**Cas d'usage:**
- Agent conversationnel polyvalent
- Generation de contenu
- Analyse de documents
- Coding rapide et fiable

---

### Claude Haiku 4.5

> **Role:** Le plus rapide — sub-agents, classification, guardrails
> **Model ID:** `claude-haiku-4-5-20251001` (alias: `claude-haiku-4-5`)
> **Release:** 1 octobre 2025

| Caracteristique | Valeur |
|-----------------|--------|
| **Context Window** | 200,000 tokens |
| **Max Output Tokens** | 64,000 tokens |
| **Knowledge Cutoff** | Fevrier 2025 (training: Juillet 2025) |
| **Extended Thinking** | Oui (premier Haiku avec thinking) |
| **Computer Use** | Oui |
| **Latence** | Ultra-rapide |

| Type | Cout / 1M tokens |
|------|-------------------|
| Input | $1.00 |
| Cached Input (read) | $0.10 (90% reduction) |
| Output | $5.00 |
| Batch Input | $0.50 (50%) |
| Batch Output | $2.50 (50%) |

**Points forts:**
- Performance coding similaire a Sonnet 4 a 1/3 du cout et 2x la vitesse
- SWE-bench Verified >73%
- Support vision (texte + images)
- Ideal pour sub-agents, parallelisation, deploiements a grande echelle
- Extended thinking disponible (controle de la profondeur de raisonnement)

---

## Modeles Legacy

| Modele | Model ID | Input/Output (1M) | Contexte | Max Output | Thinking |
|--------|----------|-------------------|----------|------------|----------|
| **Claude Opus 4.5** | `claude-opus-4-5` | $5 / $25 | 200K | 64K | Oui |
| **Claude Opus 4.1** | `claude-opus-4-1` | $15 / $75 | 200K | 32K | Oui |
| **Claude Opus 4** | `claude-opus-4-0` | $15 / $75 | 200K | 32K | Oui |
| **Claude Sonnet 4** | `claude-sonnet-4-0` | $3 / $15 | 200K (1M beta) | 64K | Oui |
| **Claude Sonnet 3.7** | `claude-3-7-sonnet-latest` | $3 / $15 | 200K | 64K (128K beta) | Oui |
| **Claude Haiku 3** | `claude-3-haiku-20240307` | $0.25 / $1.25 | 200K | 4K | Non |

**Evolution des prix Opus:** $15/$75 (4.1) → $5/$25 (4.5/4.6) = **67% reduction**

---

## Comparatif OpenAI vs Anthropic

### Modeles Flagship (Agents principaux)

| | GPT-5 (Etudesk) | Claude Opus 4.6 | GPT-5.2 |
|--|------------------|-----------------|---------|
| **Input $/1M** | $1.25 | $5.00 | $1.75 |
| **Output $/1M** | $10.00 | $25.00 | $14.00 |
| **Contexte** | 400K | 200K (1M beta) | 400K |
| **Max Output** | 128K | 128K | 128K |
| **Reasoning** | Non | Adaptive Thinking | Oui (none→xhigh) |
| **Cached Input** | — | $0.50 (90%) | $0.18 (90%) |

### Modeles Intermediaires (Sub-agents)

| | GPT-5-mini (Etudesk) | Claude Sonnet 4.5 |
|--|----------------------|-------------------|
| **Input $/1M** | $0.25 | $3.00 |
| **Output $/1M** | $2.00 | $15.00 |
| **Cached Input** | $0.03 | $0.30 |
| **Contexte** | 400K | 200K (1M beta) |
| **Max Output** | 128K | 64K |

### Modeles Rapides/Economiques (Guardrails, classification)

| | GPT-5-nano (Etudesk) | Claude Haiku 4.5 | Claude Haiku 3 |
|--|----------------------|------------------|----------------|
| **Input $/1M** | $0.05 | $1.00 | $0.25 |
| **Output $/1M** | $0.40 | $5.00 | $1.25 |
| **Cached Input** | $0.01 | $0.10 | — |
| **Contexte** | 400K | 200K | 200K |
| **Max Output** | 128K | 64K | 4K |

**Conclusion:** OpenAI reste significativement moins cher (4-20x selon le tier) pour des capacites comparables. L'avantage Claude reside dans l'extended thinking natif, la qualite du coding (Opus 4.6), et le prompt caching a 90% de reduction (vs variable chez OpenAI).

---

## Fonctionnalites Cles

### Extended Thinking
Tous les modeles actuels supportent l'extended thinking. Les tokens de raisonnement interne sont factures au tarif output. Budget minimum: 1,024 tokens.

### Adaptive Thinking (Opus 4.6 uniquement)
Le modele decide automatiquement quand activer le raisonnement profond, sans configuration explicite. Reduit la latence sur les requetes simples tout en maintenant la qualite sur les requetes complexes.

### Prompt Caching
- **Cache read:** 0.1x le prix input de base (90% reduction)
- **Cache write (5min TTL):** 1.25x le prix input
- **Cache write (1h TTL):** 2x le prix input
- Cache automatique sur les prefixes identiques du system prompt

### Vision
Tous les modeles actuels supportent l'input image (texte + images).

### Audio
**Claude ne supporte PAS l'audio natif en input (fev 2026).** Les modalites d'input supportees sont : texte, images, et PDF. L'app mobile Claude a des fonctions vocales, mais elles utilisent un pipeline STT separe avant d'envoyer du texte au modele — ce n'est pas de la comprehension audio native.

Pour le copilot Etudesk, l'audio passe par OpenAI Whisper (STT) avant d'etre envoye a Claude. Si la comprehension audio native (ton, emotion, rythme) est necessaire, utiliser OpenAI `gpt-audio` ou Google Gemini qui supportent l'audio natif.

### Computer Use
Claude Haiku 4.5 et Opus 4.6 supportent computer use (controle d'interface).

### Batch API
50% de reduction sur tous les modeles, traitement asynchrone sous 24h.

---

## Optimisation des Couts

### Cout par requete Copilot (hypothetique — si Etudesk utilisait Claude)

| Composant | Claude Opus 4.6 | GPT-5 (actuel) | Delta |
|-----------|-----------------|-----------------|-------|
| Agent principal (2K in, 1K out) | ~$0.035 | ~$0.0125 | +180% |
| Sub-agent (1K in, 500 out) | ~$0.0105 | ~$0.00125 | +740% |
| Guardrail (500 in, 100 out) | ~$0.001 | ~$0.000065 | +1438% |
| **Total moyen** | **~$0.047** | **~$0.014** | **+235%** |

### Avec Prompt Caching (apres 1ere requete)

| Composant | Claude Opus 4.6 (cached) | GPT-5 (cached) |
|-----------|-------------------------|-----------------|
| Agent principal (10K cached, 1K new, 1K out) | ~$0.030 | ~$0.0125 |

**Note:** Le prompt caching Anthropic est plus agressif (90% reduction vs variable chez OpenAI) mais le prix de base reste plus eleve.

---

## Pertinence pour Etudesk

### Pourquoi rester sur OpenAI (recommandation actuelle)

1. **Cout:** GPT-5 family est 4-20x moins cher que Claude a tous les tiers
2. **OpenAI Agents SDK:** Infrastructure existante, tools, guardrails — migration couteuse
3. **Contexte 400K natif:** Pas besoin de beta header pour le long contexte
4. **Max Output 128K:** Disponible sur tous les tiers (Claude: 64K sauf Opus)
5. **Ecosysteme:** Whisper, GPT-Image-1, embeddings — tout integre

### Cas ou Claude serait pertinent

1. **Coding complexe:** Opus 4.6 excelle en agentic coding (SWE-bench)
2. **Long context retrieval:** 76% accuracy a 1M tokens (MRCR v2)
3. **Extended thinking:** Raisonnement profond natif sans configuration
4. **Multi-provider resilience:** Fallback si OpenAI a des problemes de disponibilite
5. **Evaluation future:** Si Anthropic reduit ses prix (tendance historique: -67% par generation)

### Migration potentielle (non recommandee actuellement)

```typescript
// Hypothetique — NE PAS implementer sans evaluation approfondie
// import Anthropic from '@anthropic-ai/sdk';
// const anthropic = new Anthropic();
//
// const response = await anthropic.messages.create({
//   model: 'claude-opus-4-6',
//   max_tokens: 4096,
//   system: systemPrompt,
//   messages: [{ role: 'user', content: userMessage }],
// });
```

---

## Sources

### Documentation Officielle Anthropic

- [Models Overview](https://platform.claude.com/docs/en/about-claude/models/overview)
- [Pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- [Claude Opus 4.6 Announcement](https://www.anthropic.com/news/claude-opus-4-6)
- [Claude Haiku 4.5 Announcement](https://www.anthropic.com/news/claude-haiku-4-5)
- [Extended Thinking](https://platform.claude.com/docs/en/build-with-claude/extended-thinking)
- [Adaptive Thinking](https://platform.claude.com/docs/en/build-with-claude/adaptive-thinking)
- [Prompt Caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)

### Analyses et Comparatifs

- [Anthropic API Pricing Guide 2026 (nops.io)](https://www.nops.io/blog/anthropic-api-pricing/)
- [Claude API Pricing 2026 (MetaCTO)](https://www.metacto.com/blogs/anthropic-api-pricing-a-full-breakdown-of-costs-and-integration)
- [Claude Opus 4.6 vs 4.5 Benchmarks (Vellum)](https://www.vellum.ai/blog/claude-opus-4-6-benchmarks)
- [Claude Opus 4.6 Features (DataCamp)](https://www.datacamp.com/blog/claude-opus-4-6)
- [Claude Haiku 4.5 Deep Dive (Caylent)](https://caylent.com/blog/claude-haiku-4-5-deep-dive-cost-capabilities-and-the-multi-agent-opportunity)
- [AI API Pricing Comparison 2026 (IntuitionLabs)](https://intuitionlabs.ai/articles/ai-api-pricing-comparison-grok-gemini-openai-claude)

---

*Document mis a jour le 19 fevrier 2026 — Ajout section audio (non supporte par Claude)*
