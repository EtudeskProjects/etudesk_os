# Documentation des Modeles AI - Etudesk VF

> **Derniere mise a jour:** 12 fevrier 2026
> **Audit realise sur:** Backend Etudesk VF

---

## Table des Matieres

1. [Resume Executif](#resume-executif)
2. [Architecture AI](#architecture-ai)
3. [Modeles en Production (GPT-4.1)](#modeles-en-production-gpt-41)
4. [GPT-5 Family (Upgrade Path)](#gpt-5-family-upgrade-path)
   - [GPT-5](#gpt-5)
   - [GPT-5-mini](#gpt-5-mini)
   - [GPT-5-nano](#gpt-5-nano)
5. [GPT-5.2 Family (Latest)](#gpt-52-family-latest)
   - [GPT-5.2 (Thinking)](#gpt-52-thinking)
   - [GPT-5.2 Instant (Chat)](#gpt-52-instant-chat)
   - [GPT-5.2 Pro](#gpt-52-pro)
   - [GPT-5.2-Codex](#gpt-52-codex)
6. [Autres Modeles en Production](#autres-modeles-en-production)
   - [GPT-4o-mini](#gpt-4o-mini)
   - [GPT-Image-1](#gpt-image-1)
   - [Whisper-1](#whisper-1)
   - [Text-Embedding-3-Small](#text-embedding-3-small)
7. [Mapping Modeles → Services](#mapping-modeles--services)
8. [Comparatif GPT-4.1 vs GPT-5 vs GPT-5.2](#comparatif-gpt-41-vs-gpt-5-vs-gpt-52)
9. [Plan de Migration](#plan-de-migration)
10. [Guide de Prompting GPT-4.1](#guide-de-prompting-gpt-41)
11. [Estimations de Couts](#estimations-de-couts)
12. [Sources](#sources)

---

## Resume Executif

### Modeles en production (Etudesk — GPT-5 family, Feb 2026)

| Modele | Utilisation | Cout (1M tokens) | Contexte | Latence |
|--------|-------------|------------------|----------|---------|
| **GPT-5** | Agents Copilot principaux | $1.25 / $10.00 | 400K tokens | Fast |
| **GPT-5-mini** | Sub-agents, vision, document analysis | $0.25 / $2.00 | 400K tokens | Fast |
| **GPT-5-nano** | Guardrails, titres, suggestions, summarizer | $0.05 / $0.40 | 400K tokens | Ultra-rapide |
| **GPT-Image-1** | Generation d'images | $0.02-$0.19/image | N/A | Variable |
| **Whisper-1** | Transcription audio | $0.006/min | 25MB max | 5-10x temps reel |
| **text-embedding-3-small** | Embeddings vectoriels | $0.02/1M tokens | N/A | Rapide |

### GPT-5 Family (EN PRODUCTION)

| Modele | Model ID | Cout Input/Output (1M) | Cached Input | Contexte | Max Output | Sortie |
|--------|----------|------------------------|-------------|----------|------------|--------|
| **GPT-5** | `gpt-5` | $1.25 / $10.00 | — | 400K | 128K | 7 aout 2025 |
| **GPT-5-mini** | `gpt-5-mini` | $0.25 / $2.00 | $0.03 | 400K | 128K | 7 aout 2025 |
| **GPT-5-nano** | `gpt-5-nano` | $0.05 / $0.40 | $0.01 | 400K | 128K | 7 aout 2025 |

### GPT-5.2 Family (latest, flagship)

| Modele | Model ID | Cout Input/Output (1M) | Cached Input | Contexte | Max Output | Sortie |
|--------|----------|------------------------|-------------|----------|------------|--------|
| **GPT-5.2** (Thinking) | `gpt-5.2` | $1.75 / $14.00 | $0.18 (90%) | 400K | 128K | 11 dec 2025 |
| **GPT-5.2 Instant** (Chat) | `gpt-5.2-chat-latest` | $1.75 / $14.00 | $0.18 (90%) | 400K | 128K | 11 dec 2025 |
| **GPT-5.2 Pro** | `gpt-5.2-pro` | $1.75 / $14.00 | $0.175 | 400K | 128K | 11 dec 2025 |
| **GPT-5.2-Codex** | `gpt-5.2-codex` | — | — | 400K | 128K | 11 dec 2025 |

---

## Architecture AI

```
+---------------------------------------------------------------------------+
|                        COPILOT ARCHITECTURE                                |
+----------------------------------------------------------------------------+
|                                                                            |
|  +-------------------+    +-------------------+    +--------------------+  |
|  |  TalentAgent      |    |   OrgAgent        |    |  Intent Agent      |  |
|  |  (GPT-5)          |    |  (GPT-5)          |    | (GPT-5-nano)       |  |
|  +--------+----------+    +--------+----------+    +--------------------+  |
|           |                        |                                       |
|           v                        v                                       |
|  +---------------------------------------------------------------------+  |
|  |                    SUB-AGENTS (GPT-5-mini)                           |  |
|  |  +----------------+  +----------------+  +------------------------+  |  |
|  |  | FileReader     |  | WebSearch      |  | Daily Objectives       |  |  |
|  |  | Agent          |  | Agent          |  | Agent                  |  |  |
|  |  +----------------+  +----------------+  +------------------------+  |  |
|  +---------------------------------------------------------------------+  |
|                                                                            |
+----------------------------------------------------------------------------+
|                      GENERATION SERVICES (GPT-5-nano)                      |
+----------------------------------------------------------------------------+
|  +----------------+  +----------------+  +----------------+                |
|  | Space Gen      |  | Community Gen  |  | Opportunity    |                |
|  | Service        |  | Service        |  | Gen Service    |                |
|  +----------------+  +----------------+  +----------------+                |
|                                                                            |
|  +----------------+  +----------------+  +----------------+  GPT-5-mini    |
|  | Bio Gen        |  | KYC Verif      |  | Doc Extract    |  + Vision     |
|  | (talents.ts)   |  | Service        |  | Service        |               |
|  +----------------+  +----------------+  +----------------+               |
|                                                                            |
+----------------------------------------------------------------------------+
|                      MEDIA & EMBEDDINGS                                    |
+----------------------------------------------------------------------------+
|  +----------------+  +----------------+  +----------------------------+    |
|  | Image Gen      |  | Transcribe     |  | Embedding Service          |    |
|  | GPT-Image-1    |  | Whisper-1      |  | text-embedding-3-small     |    |
|  +----------------+  +----------------+  | -> Pinecone Vector DB      |    |
|                                          +----------------------------+    |
+----------------------------------------------------------------------------+
```

---

## Modeles en Production (GPT-4.1)

### GPT-4.1

> **Role:** Agents Copilot principaux (Talent Explorer/Study, Organization Explorer)
> **Model ID:** `gpt-4.1`

| Caracteristique | Valeur |
|-----------------|--------|
| **Context Window** | 1,047,576 tokens (1M) |
| **Max Output Tokens** | 32,768 tokens |
| **Knowledge Cutoff** | 1er juin 2024 |
| **Latence TTFT** | ~0.39s (33% plus rapide que GPT-4o) |

| Type | Cout / 1M tokens |
|------|-------------------|
| Input | $2.00 |
| Cached Input | $0.50 |
| Output | $8.00 |

**Utilisation dans Etudesk:**

| Fichier | Service |
|---------|---------|
| `services/copilot/agents/talent.agent.ts` | Agent principal Talent (Explorer + Study) |
| `services/copilot/agents/organization.agent.ts` | Agent Organisation |

---

### GPT-4.1 Mini

> **Role:** Sub-agents, objectifs quotidiens
> **Model ID:** `gpt-4.1-mini`

| Caracteristique | Valeur |
|-----------------|--------|
| **Context Window** | 1,047,576 tokens (1M) |
| **Max Output Tokens** | 32,768 tokens |
| **Knowledge Cutoff** | 1er juin 2024 |
| **Latence** | ~50% plus rapide que GPT-4o |

| Type | Cout / 1M tokens |
|------|-------------------|
| Input | $0.40 |
| Cached Input | $0.10 |
| Output | $1.60 |

**Utilisation dans Etudesk:**

| Fichier | Service |
|---------|---------|
| `services/daily-objective.service.ts` | Objectifs quotidiens talents + organisations |
| `services/copilot/tools/file-read.tool.ts` | Analyse de documents (asTool) |
| `services/copilot/tools/web-search.tool.ts` | Recherche web et synthese |

---

### GPT-4.1 Nano

> **Role:** Guardrails, titres de sessions, suggestions
> **Model ID:** `gpt-4.1-nano`

| Caracteristique | Valeur |
|-----------------|--------|
| **Context Window** | 1,047,576 tokens (1M) |
| **Latence** | Ultra-rapide (<5s pour 128K tokens) |

| Type | Cout / 1M tokens |
|------|-------------------|
| Input | $0.10 |
| Cached Input | $0.025 |
| Output | $0.40 |

**Utilisation dans Etudesk:**

| Fichier | Service |
|---------|---------|
| `services/ai/agent-factory.ts` | Predictions intentions utilisateur, titres sessions |
| `services/copilot/guardrails/input.guardrail.ts` | Input safety guardrail |
| `services/copilot/session-summarizer.ts` | Summarization historique conversation |

---

## GPT-5 Family (Upgrade Path)

> **Disponible depuis:** 7 aout 2025
> **Knowledge Cutoff:** 31 mai 2024
> **Contexte:** 400,000 tokens (toute la famille)
> **Max Output:** 128,000 tokens (toute la famille)

La famille GPT-5 est le successeur direct de GPT-4.1. Les trois modeles (GPT-5, GPT-5-mini, GPT-5-nano) sont des remplacements drop-in pour GPT-4.1, GPT-4.1-mini et GPT-4.1-nano respectivement. Ils supportent tous les memes features: streaming, function calling, structured outputs, fine-tuning, distillation, predicted outputs, et image input.

### GPT-5

> **Model ID:** `gpt-5`
> **Remplace:** GPT-4.1 (agents principaux)

| Caracteristique | Valeur |
|-----------------|--------|
| **Context Window** | 400,000 tokens |
| **Max Output Tokens** | 128,000 tokens |
| **Knowledge Cutoff** | 31 mai 2024 |
| **Release** | 7 aout 2025 |

| Type | Cout / 1M tokens |
|------|-------------------|
| Input | $1.25 |
| Output | $10.00 |

**Features:** Streaming, function calling, structured outputs, fine-tuning, distillation, predicted outputs, image input, reasoning

**Ameliorations vs GPT-4.1:**
- Intelligence generale significativement amelioree
- Meilleur suivi long-contexte
- Tool calling plus fiable
- Vision amelioree
- Max output 4x plus grand (128K vs 32K)
- Input 37% moins cher ($1.25 vs $2.00)
- Output 25% plus cher ($10 vs $8) mais qualite superieure

**Mapping Etudesk (migration):**
- `MODEL_T1 = 'gpt-5'` — Agents Copilot principaux (TalentAgent, OrgAgent)

---

### GPT-5-mini

> **Model ID:** `gpt-5-mini`
> **Remplace:** GPT-4.1-mini (sub-agents)

| Caracteristique | Valeur |
|-----------------|--------|
| **Context Window** | 400,000 tokens |
| **Max Output Tokens** | 128,000 tokens |
| **Knowledge Cutoff** | 31 mai 2024 |
| **Release** | 7 aout 2025 |

| Type | Cout / 1M tokens |
|------|-------------------|
| Input | $0.25 |
| Cached Input | $0.03 |
| Output | $2.00 |

**Features:** Streaming, function calling, structured outputs, fine-tuning, distillation, predicted outputs

**Ameliorations vs GPT-4.1-mini:**
- Plus rapide et plus cost-efficient
- Ideal pour taches bien definies et prompts precis
- Input 37% moins cher ($0.25 vs $0.40)
- Output 25% plus cher ($2.00 vs $1.60)
- Max output 4x plus grand (128K vs 32K)

**Mapping Etudesk (migration):**
- `MODEL_T2 = 'gpt-5-mini'` — Sub-agents (FileReader, WebSearch), objectifs quotidiens

---

### GPT-5-nano

> **Model ID:** `gpt-5-nano`
> **Remplace:** GPT-4.1-nano (guardrails, classification)

| Caracteristique | Valeur |
|-----------------|--------|
| **Context Window** | 400,000 tokens |
| **Max Output Tokens** | 128,000 tokens |
| **Knowledge Cutoff** | 31 mai 2024 |
| **Release** | 7 aout 2025 |

| Type | Cout / 1M tokens |
|------|-------------------|
| Input | $0.05 |
| Cached Input | $0.01 |
| Output | $0.40 |

**Features:** Streaming, function calling, structured outputs, fine-tuning, distillation, predicted outputs, image input

**Ideal pour:** Summarization, classification, guardrails, titres de sessions, predictions rapides

**Ameliorations vs GPT-4.1-nano:**
- 2x moins cher en input ($0.05 vs $0.10)
- Meme cout output ($0.40)
- Image input supporte (pas le cas sur 4.1-nano)
- Max output 4x plus grand (128K vs 32K)

**Mapping Etudesk (migration):**
- `MODEL_T3 = 'gpt-5-nano'` — Guardrails, titres, suggestions, session summarizer (migre fev 2026)

---

## GPT-5.2 Family (Latest)

> **Disponible depuis:** 11 decembre 2025
> **Knowledge Cutoff:** 31 aout 2025
> **Contexte:** 400,000 tokens (toute la famille)
> **Max Output:** 128,000 tokens (toute la famille)

GPT-5.2 est le modele flagship d'OpenAI pour le coding et les taches agentiques. Il apporte des ameliorations significatives en intelligence generale, comprehension long-contexte, tool-calling agentique et vision. C'est le premier modele a supporter le niveau de reasoning `xhigh`.

### GPT-5.2 (Thinking)

> **Model ID:** `gpt-5.2`
> **Type:** Reasoning model (thinking mode par defaut)

| Caracteristique | Valeur |
|-----------------|--------|
| **Context Window** | 400,000 tokens |
| **Max Output Tokens** | 128,000 tokens |
| **Knowledge Cutoff** | 31 aout 2025 |
| **Release** | 11 decembre 2025 |
| **APIs** | Responses API, Chat Completions API |

| Type | Cout / 1M tokens |
|------|-------------------|
| Input | $1.75 |
| Cached Input | $0.18 (90% discount) |
| Output | $14.00 |
| Batch Input | $0.875 (50%) |
| Batch Output | $7.00 (50%) |

**Reasoning Effort:** `none` (default), `low`, `medium`, `high`, `xhigh`

**Nouveautes GPT-5.2:**
- Niveau `xhigh` reasoning effort (puissance maximale)
- Concise reasoning summaries
- Context management via compaction
- Excellence en spreadsheets, presentations, code, vision
- 98.7% accuracy sur Tau2-bench Telecom (tool-use)
- State of the art en long-context reasoning (MRCRv2)

**Cas d'usage potentiel Etudesk:**
- Agent principal Copilot (remplacement GPT-4.1 / GPT-5)
- Analyse de documents complexes avec reasoning
- Workflows multi-tools avec reasoning chain

---

### GPT-5.2 Instant (Chat)

> **Model ID:** `gpt-5.2-chat-latest`
> **Type:** Mode rapide, sans reasoning par defaut

| Caracteristique | Valeur |
|-----------------|--------|
| **Context Window** | 400,000 tokens |
| **Max Output Tokens** | 128,000 tokens |
| **Knowledge Cutoff** | 31 aout 2025 |
| **Reasoning default** | `none` (basse latence) |

**Meme pricing que GPT-5.2 Thinking.**

Optimise pour les interactions chat a faible latence. Le reasoning est desactive par defaut (`none`), ce qui le rend comparable en vitesse a GPT-5 mais avec l'intelligence de la famille 5.2.

**Cas d'usage potentiel Etudesk:**
- Remplacement direct de GPT-4.1 pour les agents Copilot
- Ideal si on veut l'intelligence 5.2 sans le cout du reasoning

---

### GPT-5.2 Pro

> **Model ID:** `gpt-5.2-pro`
> **Type:** Maximum quality, reasoning avance

| Caracteristique | Valeur |
|-----------------|--------|
| **Context Window** | 400,000 tokens |
| **Max Output Tokens** | 128,000 tokens |
| **Knowledge Cutoff** | 31 aout 2025 |
| **APIs** | Responses API uniquement |
| **Reasoning Effort** | `medium`, `high`, `xhigh` |

**Meme pricing que GPT-5.2 Thinking.**

Supporte les interactions multi-turn avant de repondre. Reserve aux taches ou la qualite est primordiale.

---

### GPT-5.2-Codex

> **Model ID:** `gpt-5.2-codex`
> **Type:** Optimise coding agentique

| Caracteristique | Valeur |
|-----------------|--------|
| **APIs** | Responses API uniquement |
| **Reasoning Effort** | `low`, `medium`, `high`, `xhigh` |
| **Features** | Function calling, structured outputs, streaming, prompt caching |

Version de GPT-5.2 optimisee pour le coding agentique dans Codex:
- Amelioration des changements de code a grande echelle (refactors, migrations)
- Context compaction pour le travail long-horizon
- Cybersecurite significativement amelioree

---

## Autres Modeles en Production

### GPT-4o-mini

> **Role:** Historiquement utilise pour generation de formulaires, extraction de donnees, vision
> **Model ID:** `gpt-4o-mini`

| Caracteristique | Valeur |
|-----------------|--------|
| **Context Window** | 128,000 tokens |
| **Max Output Tokens** | 16,384 tokens |
| **Knowledge Cutoff** | Octobre 2023 |
| **Modalites** | Texte + Vision (images) |

| Type | Cout / 1M tokens |
|------|-------------------|
| Input | $0.15 |
| Output | $0.60 |

**Utilisation dans Etudesk:** Aucune — remplace par MODEL_T3 (gpt-5-nano) dans tous les services.
Historiquement utilise pour: form generation, bio generation, KYC verification, extraction CV.

---

### GPT-Image-1

> **Role:** Generation d'images educatives, diagrammes, infographies
> **Model ID:** `gpt-image-1`

| Qualite | Resolution | Cout approx. |
|---------|------------|--------------|
| Low | 1024x1024 | ~$0.02 |
| Medium | 1024x1024 | ~$0.07 |
| High | 1024x1024 | ~$0.19 |

> Remplace DALL-E 3 (deprecated mai 2026). Meilleur rendu du texte dans les images.

---

### Whisper-1

> **Role:** Transcription audio pour input vocal Copilot
> **Model ID:** `whisper-1`

| Type | Cout |
|------|------|
| Transcription | $0.006/minute ($0.36/heure) |

> 99+ langues, 25 MB max, 5-10x temps reel.

---

### Text-Embedding-3-Small

> **Role:** Embeddings semantiques pour matching talent-opportunite
> **Model ID:** `text-embedding-3-small`

| Type | Cout / 1M tokens |
|------|-------------------|
| Standard | $0.02 |
| Batch | $0.01 |

> 1536 dimensions, stockage Pinecone + PostgreSQL fallback.

---

## Mapping Modeles → Services

### Par Fichier

| Fichier | Modele(s) |
|---------|-----------|
| `services/copilot/agents/talent.agent.ts` | **GPT-5** |
| `services/copilot/agents/organization.agent.ts` | **GPT-5** |
| `services/copilot/tools/file-read.tool.ts` | **GPT-5-mini** |
| `services/copilot/tools/web-search.tool.ts` | **GPT-5-mini** |
| `services/copilot/tools/generate-image.tool.ts` | GPT-Image-1 |
| `services/copilot/guardrails/input.guardrail.ts` | **GPT-5-nano** |
| `services/copilot/session-summarizer.ts` | **GPT-5-nano** |
| `services/daily-objective.service.ts` | **GPT-5-nano** |
| `services/ai/agent-factory.ts` | **GPT-5-nano** |
| `services/space-generation.service.ts` | **GPT-5-nano** |
| `services/community-generation.service.ts` | **GPT-5-nano** |
| `services/opportunity-generation.service.ts` | **GPT-5-nano** |
| `services/kyc-verification.service.ts` | **GPT-5-mini** (Vision) |
| `services/documents/extraction.service.ts` | **GPT-5-mini** (Vision) |
| `services/embedding.service.ts` | text-embedding-3-small |
| `routes/copilot.ts` | Whisper-1 |
| `routes/talents.ts` | **GPT-5-nano** |

### Par Cas d'Usage

| Cas d'Usage | Modele Actuel | Upgrade GPT-5 | Justification |
|-------------|---------------|---------------|---------------|
| Agent conversationnel complexe | GPT-4.1 | `gpt-5` ou `gpt-5.2` | Meilleur tool calling, intelligence generale |
| Sub-agent / Tache deleguee | GPT-4.1 Mini | `gpt-5-mini` | -37% input, qualite superieure |
| Guardrails, classification | GPT-4.1 Nano | `gpt-5-nano` | -50% input, image input supporte |
| Generation formulaire JSON | GPT-4o-mini | `gpt-5-nano` | Plus capable, cout similaire |
| Analyse vision (documents) | GPT-4o-mini | `gpt-5-nano` | Vision + structured outputs |
| Generation d'images | GPT-Image-1 | GPT-Image-1 | Pas de successeur annonce |
| Transcription audio | Whisper-1 | Whisper-1 | Standard industrie |
| Embeddings semantiques | text-embedding-3-small | text-embedding-3-small | Pas de changement necessaire |

---

## Comparatif GPT-4.1 vs GPT-5 vs GPT-5.2

### Specifications

| | GPT-4.1 | GPT-5 | GPT-5.2 |
|--|---------|-------|---------|
| **Context** | 1M | 400K | 400K |
| **Max Output** | 32K | 128K | 128K |
| **Knowledge Cutoff** | Juin 2024 | Mai 2024 | Aout 2025 |
| **Input $/1M** | $2.00 | $1.25 | $1.75 |
| **Output $/1M** | $8.00 | $10.00 | $14.00 |
| **Reasoning** | Non | Non | Oui (none→xhigh) |
| **Vision** | Oui | Oui | Oui (amelioree) |
| **Function calling** | Oui | Oui | Oui (ameliore) |
| **Structured outputs** | Oui | Oui | Oui |

### Mini

| | GPT-4.1-mini | GPT-5-mini |
|--|--------------|------------|
| **Context** | 1M | 400K |
| **Max Output** | 32K | 128K |
| **Input $/1M** | $0.40 | $0.25 |
| **Output $/1M** | $1.60 | $2.00 |
| **Cached Input** | $0.10 | $0.03 |

### Nano

| | GPT-4.1-nano | GPT-5-nano |
|--|--------------|------------|
| **Context** | 1M | 400K |
| **Max Output** | 32K | 128K |
| **Input $/1M** | $0.10 | $0.05 |
| **Output $/1M** | $0.40 | $0.40 |
| **Cached Input** | $0.025 | $0.01 |
| **Image Input** | Non | Oui |

---

## Plan de Migration

### Migration effectuee (Feb 2026): GPT-4.1 → GPT-5

```typescript
// backend/src/services/ai/models.ts — EN PRODUCTION
export const MODEL_T1 = 'gpt-5';       // was: 'gpt-4.1'
export const MODEL_T2 = 'gpt-5-mini';  // was: 'gpt-4.1-mini'
export const MODEL_T3 = 'gpt-5-nano';  // Migre fev 2026 — 2x moins cher en input, image input supporte

// FUTURE OPTION: Migration vers GPT-5.2 (flagship, reasoning)
// export const MODEL_T1 = 'gpt-5.2';          // ou 'gpt-5.2-chat-latest' pour instant
// export const MODEL_T2 = 'gpt-5-mini';       // pas de 5.2-mini
// export const MODEL_T3 = 'gpt-5-nano';       // pas de 5.2-nano
```

### Notes de migration

1. **GPT-5 family est un drop-in replacement** pour GPT-4.1 family. Memes features, meme API, model ID change suffit.
2. **Context window reduit** de 1M a 400K. Pour Etudesk, ce n'est pas un probleme car nos prompts + history ne depassent jamais ~50K tokens.
3. **Max output augmente** de 32K a 128K. Benefique pour la generation de documents longs (CV, rapports).
4. **GPT-5.2 n'a pas de variantes mini/nano.** Il faudrait mixer: GPT-5.2 pour T1, GPT-5-mini pour T2, GPT-5-nano pour T3.
5. **GPT-5.2 avec reasoning `none`** (via `gpt-5.2-chat-latest`) est le meilleur compromis vitesse/intelligence pour un agent conversationnel.
6. **Tests de calibration relances** avec GPT-5 (`copilot-agents.test.ts`) — prompts ajustes si necessaire.
7. **OpenAI Agents SDK** (`@openai/agents`) est compatible avec tous les modeles GPT-5 et GPT-5.2.

### Impact cout estime (GPT-4.1 → GPT-5)

| Composant | Avant (GPT-4.1) | Apres (GPT-5) | Delta |
|-----------|-------------------|---------------|-------|
| Agent principal (2K in, 1K out) | ~$0.012 | ~$0.0125 | +4% |
| Sub-agent (1K in, 500 out) | ~$0.001 | ~$0.00125 | +25% |
| Guardrail/titre (500 in, 100 out) | ~$0.00009 | ~$0.000065 | -28% |
| **Total moyen par requete** | **~$0.013** | **~$0.014** | **+7%** |

---

## Guide de Prompting GPT-4.1

### Principes Cles

GPT-4.1 est entraine pour suivre les instructions **plus litteralement** que ses predecesseurs. Il est hautement dirigeable et reactif aux prompts bien specifies.

### Les 3 Instructions Agentiques Essentielles

Pour utiliser pleinement les capacites agentiques de GPT-4.1, incluez ces 3 types de rappels dans tous les prompts d'agent:

#### 1. Persistence
```
Tu dois continuer jusqu'a ce que la requete de l'utilisateur soit completement resolue.
Ne rends pas le controle prematurement.
```

#### 2. Tool-Calling
```
Tu DOIS planifier extensivement avant chaque appel de fonction.
Tu DOIS reflechir extensivement aux resultats des appels precedents.
Utilise pleinement tes outils - ne devine jamais une reponse.
```

#### 3. Planning & Reflection
```
Avant chaque action, explique ton raisonnement.
Apres chaque resultat d'outil, analyse ce que tu as appris.
```

### Structure de Prompt Recommandee

```markdown
# Role
[Description claire du role de l'agent]

# Instructions
[Instructions detaillees et explicites]

# Tool Sequencing
1. Utilise d'abord vector_query pour la decouverte
2. Utilise sql_query pour les donnees structurees/personnelles
3. Utilise web_search SEULEMENT si les donnees internes sont insuffisantes

# Output Format
[Format de sortie attendu avec exemples]

# Context
[Contexte utilisateur injecte dynamiquement]

# Final Reminder
- Ne jamais halluciner - utilise les outils
- Persiste jusqu'a resolution complete
- Reponds en francais (ou langue configuree)
```

### Impact Performance

L'adherence a ces 3 instructions simples augmente le score SWE-bench Verified de **pres de 20%**.

> **Note:** Ces principes s'appliquent aussi a GPT-5 et GPT-5.2. GPT-5.2 ajoute le reasoning natif via `reasoning_effort`, ce qui peut reduire le besoin de prompts de "planning" explicites.

---

## Estimations de Couts

### Cout par Requete Copilot (Estime)

| Composant | Tokens estimes | Cout (GPT-4.1) | Cout (GPT-5) |
|-----------|----------------|-----------------|---------------|
| Agent principal | ~2K in, ~1K out | ~$0.012 | ~$0.0125 |
| Sub-agent | ~1K in, ~500 out | ~$0.001 | ~$0.00125 |
| Embedding | ~500 tokens | ~$0.00001 | ~$0.00001 |
| **Total moyen** | | **~$0.013** | **~$0.014** |

### Cout Mensuel Estime (par utilisateur actif)

| Usage | Requetes/mois | Cout (GPT-4.1) | Cout (GPT-5) |
|-------|---------------|-----------------|---------------|
| Leger | 50 | ~$0.65 | ~$0.70 |
| Moyen | 200 | ~$2.60 | ~$2.80 |
| Intensif | 500 | ~$6.50 | ~$7.00 |

### Couts Additionnels

| Service | Unite | Cout |
|---------|-------|------|
| Generation image | par image | $0.02-$0.19 |
| Transcription audio | par minute | $0.006 |
| Objectif quotidien | par generation | ~$0.001 |
| Generation formulaire | par formulaire | ~$0.002 |

---

## Sources

### Documentation Officielle OpenAI

**GPT-5 Family:**
- [GPT-5 Model](https://platform.openai.com/docs/models/gpt-5)
- [GPT-5 mini Model](https://platform.openai.com/docs/models/gpt-5-mini)
- [GPT-5 nano Model](https://platform.openai.com/docs/models/gpt-5-nano)
- [GPT-5 Announcement](https://openai.com/gpt-5/)
- [GPT-5, GPT-5-mini, GPT-5-nano API Announcement](https://community.openai.com/t/gpt-5-gpt-5-mini-and-gpt-5-nano-now-available-in-the-api/1337048)

**GPT-5.2 Family:**
- [GPT-5.2 Model](https://platform.openai.com/docs/models/gpt-5.2)
- [GPT-5.2 Chat (Instant)](https://platform.openai.com/docs/models/gpt-5.2-chat-latest)
- [GPT-5.2 Pro](https://platform.openai.com/docs/models/gpt-5.2-pro)
- [Introducing GPT-5.2](https://openai.com/index/introducing-gpt-5-2/)
- [Introducing GPT-5.2-Codex](https://openai.com/index/introducing-gpt-5-2-codex/)
- [Using GPT-5.2 Guide](https://platform.openai.com/docs/guides/latest-model)

**GPT-4.1 Family (actuel):**
- [GPT-4.1 Model](https://platform.openai.com/docs/models/gpt-4.1)
- [GPT-4.1 Mini Model](https://platform.openai.com/docs/models/gpt-4.1-mini)
- [GPT-4.1 Nano Model](https://platform.openai.com/docs/models/gpt-4.1-nano)

**Autres:**
- [GPT-4o-mini Model](https://platform.openai.com/docs/models/gpt-4o-mini)
- [GPT-Image-1 Model](https://platform.openai.com/docs/models/gpt-image-1)
- [Whisper Model](https://platform.openai.com/docs/models/whisper-1)
- [Text-Embedding-3-Small Model](https://platform.openai.com/docs/models/text-embedding-3-small)
- [OpenAI Pricing](https://openai.com/api/pricing/)
- [Compare Models](https://platform.openai.com/docs/models/compare)

### Guides de Prompting
- [GPT-4.1 Prompting Guide](https://cookbook.openai.com/examples/gpt4-1_prompting_guide)
- [Prompt Engineering Best Practices](https://platform.openai.com/docs/guides/prompt-engineering)
- [Agents SDK Documentation](https://platform.openai.com/docs/guides/agents-sdk)

### Modeles NON Utilises

- GPT-4 (remplace par GPT-4.1)
- GPT-4o (remplace par GPT-4.1)
- GPT-3.5-turbo (obsolete)
- o1, o3 (reasoning models — utiliser GPT-5.2 avec reasoning_effort a la place)
- DALL-E 2/3 (remplace par GPT-Image-1)
- GPT-5.1, GPT-5.1-Codex-mini (intermediaires, utiliser GPT-5.2)

---

*Document mis a jour le 12 fevrier 2026 — inclut GPT-5, GPT-5-mini, GPT-5-nano (MODEL_T3 migre), GPT-5.2, GPT-5.2-Pro, GPT-5.2-Codex*
