# Documentation des Modeles AI - Etudesk OS

> **Derniere mise a jour:** 22 juin 2026
> **Architecture:** Multi-provider (Anthropic + OpenAI)

---

## Table des Matieres

1. [Resume Executif](#resume-executif)
2. [Architecture Multi-Provider](#architecture-multi-provider)
3. [Anthropic Claude](#anthropic-claude)
4. [OpenAI](#openai)
5. [Mapping Modeles → Services](#mapping-modeles--services)
6. [Configuration](#configuration)
7. [Comparatif Cross-Provider](#comparatif-cross-provider)
8. [Estimations de Couts](#estimations-de-couts)
9. [Historique de Migration](#historique-de-migration)
10. [Guide de Prompting](#guide-de-prompting)
11. [Sources](#sources)

---

## Resume Executif

Etudesk OS utilise **2 providers AI simultanement**, chacun pour ses forces :

| Provider | Role | Modeles en prod | Pourquoi |
|----------|------|-----------------|----------|
| **Anthropic Claude** | Agents copilot, guardrails, summaries, titres, file reader | Sonnet 4.6, Haiku 4.5 | Meilleur suivi d'instructions, tool calling fiable, francais natif |
| **OpenAI** | Suggestions formulaires, objectifs quotidiens, bio, images, STT, TTS, web search, embeddings, vision/extraction, recommendations | gpt-5.4-nano, gpt-5.4-mini, gpt-image-2, gpt-4o-mini-transcribe, gpt-4o-mini-tts, text-embedding-3-small (web search agent: gpt-4.1-mini) | Couverture large, capabilities uniques (image gen, STT, Responses API web search), cout maitrise |

### Modeles en production (Juin 2026)

| Constante | Modele | Provider | Utilisation | Cout (Input/Output 1M tokens) |
|-----------|--------|----------|-------------|-------------------------------|
| `MODEL_AGENT` | claude-sonnet-4-6 | Anthropic | Agents Copilot principaux | $3.00 / $15.00 |
| `MODEL_FAST` | claude-haiku-4-5 | Anthropic | Guardrails, titres, summaries, file reader | $1.00 / $5.00 |
| `MODEL_SUGGESTION` | gpt-5.4-nano | OpenAI | Suggestions, objectifs, bio | voir tarifs OpenAI |
| `MODEL_MATCH` | gpt-5.4-nano | OpenAI | Recommendations candidats | voir tarifs OpenAI |
| `MODEL_SEARCH` | gpt-5.4-mini | OpenAI | Vision/extraction, KYC | voir tarifs OpenAI |
| `MODEL_IMAGE` | gpt-image-2 | OpenAI | Generation d'images (tuteur) | voir tarifs OpenAI |
| `MODEL_STT` | gpt-4o-mini-transcribe | OpenAI | Transcription audio | $0.006/min |
| `MODEL_TTS` | gpt-4o-mini-tts | OpenAI | Synthese vocale (steerable) | ~$0.015/min |
| `MODEL_EMBEDDING` | text-embedding-3-small | OpenAI | Embeddings vectoriels | $0.02/1M tokens |

### Variables d'environnement requises

```bash
OPENAI_API_KEY=sk-...          # Suggestions, images, STT, TTS, embeddings, web search, vision
ANTHROPIC_API_KEY=sk-ant-...    # Agents copilot principaux
YOUTUBE_API_KEY=AIza...         # YouTube Data API v3 (search)
```

---

## Architecture Multi-Provider

```
+-----------------------------------------------------------------------------+
|                        COPILOT ARCHITECTURE (Multi-Provider)                  |
+-----------------------------------------------------------------------------+
|                                                                               |
|  ANTHROPIC CLAUDE (Anthropic SDK natif — agents, guardrails, summaries)      |
|  ┌───────────────────┐  ┌───────────────────┐  ┌────────────────────┐       |
|  │  TalentAgent      │  │   OrgAgent        │  │  FileReaderAgent   │       |
|  │  (Sonnet 4.6)     │  │  (Sonnet 4.6)     │  │  (Haiku 4.5)      │       |
|  │  6-7 tools        │  │  6 tools          │  │  sub-agent         │       |
|  └───────────────────┘  └───────────────────┘  └────────────────────┘       |
|                                                                               |
|  ┌───────────────────┐  ┌───────────────────┐  ┌────────────────────┐       |
|  │ Input Guardrail   │  │ Session Summarizer│  │  Title Agent       │       |
|  │ (Haiku 4.5)       │  │ (Haiku 4.5)       │  │  (Haiku 4.5)      │       |
|  └───────────────────┘  └───────────────────┘  └────────────────────┘       |
|                                                                               |
+-----------------------------------------------------------------------------+
|  OPENAI (suggestions, images, STT, TTS, embeddings, vision, web search, reco)|
+-----------------------------------------------------------------------------+
|  ┌────────────────┐  ┌────────────────┐  ┌─────────────────────────────┐    |
|  │ WebSearchAgent │  │ Recommendation │  │ Vision/Extraction           │    |
|  │ gpt-4.1-mini   │  │ gpt-5.4-nano  │  │ gpt-5.4-mini               │    |
|  │ Responses API  │  │ openaiProvider │  │ KYC, docs, org-docs         │    |
|  └────────────────┘  └────────────────┘  └─────────────────────────────┘    |
|                                                                               |
|  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐                 |
|  │ Image Gen      │  │ STT + TTS      │  │ Embedding Svc  │                 |
|  │ gpt-image-2    │  │ 4o-mini-transc │  │ emb-3-small    │                 |
|  └────────────────┘  │ gpt-4o-mini-tts│  │ → Pinecone     │                 |
|                       └────────────────┘  └────────────────┘                 |
|                                                                               |
|  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐                 |
|  │ Suggestions    │  │ Daily Objectif │  │ Bio Gen        │                 |
|  │ gpt-4.1-nano   │  │ gpt-4.1-nano   │  │ gpt-4.1-nano   │                 |
|  └────────────────┘  └────────────────┘  └────────────────┘                 |
|                                                                               |
|  ┌────────────────┐                                                          |
|  │ WhatsApp Asst  │                                                          |
|  │ gpt-4.1-nano   │                                                          |
|  └────────────────┘                                                          |
+-----------------------------------------------------------------------------+
```

---

## Anthropic Claude

### Gamme Claude complete (Fev 2026)

| Modele | Model ID | Input/Output (1M) | Cached Input | Contexte | Max Output |
|--------|----------|-------------------|-------------|----------|------------|
| **Claude Opus 4.6** | `claude-opus-4-6` | $5.00 / $25.00 | $0.50 (90%) | 200K (1M beta) | 128K |
| **Claude Sonnet 4.5** | `claude-sonnet-4-5` | $3.00 / $15.00 | $0.30 (90%) | 200K (1M beta) | 64K |
| **Claude Haiku 4.5** | `claude-haiku-4-5-20251001` | $1.00 / $5.00 | $0.10 (90%) | 200K | 64K |

Legacy: Opus 4.5 ($5/$25), Opus 4.1 ($15/$75), Sonnet 4 ($3/$15), Sonnet 3.7 ($3/$15), Haiku 3 ($0.25/$1.25)

### Claude Sonnet 4.6 — MODEL_AGENT (en production)

> Agents Copilot principaux (TalentAgent, OrgAgent)

| Caracteristique | Valeur |
|-----------------|--------|
| **Context Window** | 200,000 tokens |
| **Max Output** | 8,192 tokens (defaut) |
| **Knowledge Cutoff** | Avril 2025 |
| **Vision** | Oui |
| **Tool Use** | Oui (natif) |
| **Extended Thinking** | Oui |

**Fichiers:** `talent.agent.ts`, `organization.agent.ts`

**Pourquoi pour les agents:**
- Meilleur suivi d'instructions complexes (system prompts longs)
- Tool calling fiable et previsible
- Francais natif de haute qualite
- Prompt caching reduit les couts de 90% sur le system prompt

### Claude Haiku 4.5 — MODEL_FAST (en production)

> Guardrails, titres, summaries, sub-agent file_reader

| Caracteristique | Valeur |
|-----------------|--------|
| **Context Window** | 200,000 tokens |
| **Max Output** | 64,000 tokens |
| **Latence** | Ultra-rapide |
| **Extended Thinking** | Oui |
| **Computer Use** | Oui |

**Fichiers:** `input.guardrail.ts`, `session-summarizer.ts`, `sse.handler.ts` (titres), `file-read.tool.ts`

### Claude Opus 4.6 (reference, non utilise)

> Modele le plus intelligent — agents, coding, raisonnement complexe

| Caracteristique | Valeur |
|-----------------|--------|
| **Context Window** | 200K (1M beta) |
| **Max Output** | 128,000 tokens |
| **Adaptive Thinking** | Oui (unique a Opus) |
| **Cout** | $5.00 / $25.00 |

**Fonctionnalites distinctives:**
- Adaptive Thinking (decide automatiquement la profondeur de raisonnement)
- Context Compaction automatique
- 76% accuracy MRCR v2 1M tokens

### Fonctionnalites Anthropic

- **Prompt Caching:** 90% reduction (read), 1.25x (write 5min TTL), 2x (write 1h TTL)
- **Extended Thinking:** Tous les modeles actuels. Tokens de thinking factures au tarif output.
- **Vision:** Tous les modeles actuels (images base64 + URL)
- **Audio:** Claude ne supporte PAS l'audio natif. Pipeline Etudesk: Whisper STT → texte → Claude.
- **Batch API:** 50% reduction, traitement asynchrone sous 24h.

---

## OpenAI

### Modeles en production

#### GPT-4.1-mini — MODEL_SEARCH

> Vision/extraction, web search agent

| Caracteristique | Valeur |
|-----------------|--------|
| **Context Window** | 1,047,576 tokens (1M) |
| **Max Output** | 32,768 tokens |
| **Vision** | Oui |
| **Cout** | $0.40 / $1.60 |

**Fichiers:** `extraction.service.ts`, `kyc-verification.service.ts`, `org-document.service.ts`, `web-search.tool.ts`

#### GPT-4.1-nano — MODEL_MATCH + MODEL_SUGGESTION

> Recommendations candidats (matching) + suggestions formulaires, objectifs quotidiens, bio, assistant WhatsApp

| Cout | $0.10 / $0.40 |

**Fichiers:** `recommendation.service.ts`, `space-generation.service.ts`, `community-generation.service.ts`, `opportunity-generation.service.ts`, `daily-objective.service.ts`, `whatsapp-assistant.service.ts`, `routes/talents.ts` (bio), `routes/copilot.ts` (suggestions), `sse.handler.ts` (suggestions)

#### GPT-Image-1 — MODEL_IMAGE

> Generation d'images educatives

| Qualite | Cout approx. |
|---------|-------------|
| Low (1024x1024) | ~$0.02 |
| Medium (1024x1024) | ~$0.07 |
| High (1024x1024) | ~$0.19 |

#### GPT-4o-mini-transcribe — MODEL_STT

> Transcription audio pour input vocal Copilot

| Cout | $0.006/minute |
| Formats | m4a, mp3, wav, etc. |
| Langues | 99+ |

#### GPT-4o-mini-TTS — MODEL_TTS

> Synthese vocale steerable (ton, emotion, accent via instructions)

| Cout | ~$0.015/min |
| Voix | 13 (alloy, ash, coral, echo, etc.) |
| Streaming | Oui |

```typescript
// Exemple TTS steerable
const response = await openai.audio.speech.create({
  model: 'gpt-4o-mini-tts',
  voice: 'coral',
  input: 'Bonjour, bienvenue sur Etudesk.',
  instructions: 'Ton chaleureux et professionnel, accent francophone ouest-africain.',
});
```

#### Text-Embedding-3-Small — MODEL_EMBEDDING

> Embeddings semantiques → Pinecone + PostgreSQL

| Cout | $0.02/1M tokens |
| Dimensions | 1536 |

#### Omni-Moderation-Latest

> Moderation automatique du contenu (gratuit)

**Fichier:** `auto-moderation.service.ts` — utilise son propre client OpenAI (pas via provider.ts)

### Modeles OpenAI de reference (non utilises)

| Modele | Cout (1M tokens) | Notes |
|--------|-------------------|-------|
| GPT-5 | $1.25 / $10.00 | Remplace par Claude Sonnet |
| GPT-5-mini | $0.25 / $2.00 | Remplace par Claude Haiku |
| GPT-5-nano | $0.05 / $0.40 | gpt-4.1-nano prefere pour suggestions |
| GPT-5.2 | $1.75 / $14.00 | Cout trop eleve |
| gpt-audio / gpt-audio-mini | Variable | Audio natif (ton, emotion) — non utilise |
| gpt-realtime | Variable | Conversations vocales <200ms — non utilise |
| tts-1 / tts-1-hd | $15-$30/1M chars | TTS classique — remplace par gpt-4o-mini-tts |

---

## Mapping Modeles → Services

### Par Fichier

| Fichier | Modele | Provider |
|---------|--------|----------|
| `copilot/agents/talent.agent.ts` | claude-sonnet-4-6 | Anthropic |
| `copilot/agents/organization.agent.ts` | claude-sonnet-4-6 | Anthropic |
| `copilot/tools/file-read.tool.ts` | claude-haiku-4-5 | Anthropic |
| `copilot/guardrails/input.guardrail.ts` | claude-haiku-4-5 | Anthropic |
| `copilot/session-summarizer.ts` | claude-haiku-4-5 | Anthropic |
| `copilot/stream/sse.handler.ts` (title) | claude-haiku-4-5 | Anthropic |
| `copilot/stream/sse.handler.ts` (suggestions) | gpt-4.1-nano | OpenAI |
| `copilot/tools/web-search.tool.ts` | gpt-4.1-mini | OpenAI |
| `copilot/tools/generate-image.tool.ts` | gpt-image-1 | OpenAI |
| `recommendation.service.ts` | gpt-4.1-nano | OpenAI |
| `space-generation.service.ts` | gpt-4.1-nano | OpenAI |
| `community-generation.service.ts` | gpt-4.1-nano | OpenAI |
| `opportunity-generation.service.ts` | gpt-4.1-nano | OpenAI |
| `daily-objective.service.ts` | gpt-4.1-nano | OpenAI |
| `whatsapp-assistant.service.ts` | gpt-4.1-nano | OpenAI |
| `documents/extraction.service.ts` | gpt-4.1-mini | OpenAI |
| `kyc-verification.service.ts` | gpt-4.1-mini | OpenAI |
| `org-documents/org-document.service.ts` | gpt-4.1-mini | OpenAI |
| `embedding.service.ts` | text-embedding-3-small | OpenAI |
| `routes/copilot.ts` (STT) | gpt-4o-mini-transcribe | OpenAI |
| `routes/copilot.ts` (TTS) | gpt-4o-mini-tts | OpenAI |
| `routes/copilot.ts` (suggestions) | gpt-4.1-nano | OpenAI |
| `routes/talents.ts` (bio) | gpt-4.1-nano | OpenAI |
| `auto-moderation.service.ts` | omni-moderation-latest | OpenAI |

### Par Provider

| Provider | Pattern d'utilisation |
|----------|----------------------|
| **Anthropic** | SDK natif `@anthropic-ai/sdk` — `client.messages.stream()` + boucle agentic manuelle |
| **OpenAI** | Via `@openai/agents` Runner (`openaiProvider`) ou `getOpenAIClient()` directement |

---

## Configuration

### models.ts

```typescript
// Anthropic (agents principaux + fast tasks)
export const MODEL_AGENT = 'claude-sonnet-4-6';
export const MODEL_FAST = 'claude-haiku-4-5';

// OpenAI (suggestions — le moins cher)
export const MODEL_SUGGESTION = 'gpt-4.1-nano';

// OpenAI (capabilities specialisees)
export const MODEL_IMAGE = 'gpt-image-1';
export const MODEL_SEARCH = 'gpt-4.1-mini';
export const MODEL_MATCH = 'gpt-4.1-nano';
export const MODEL_STT = 'gpt-4o-mini-transcribe';
export const MODEL_TTS = 'gpt-4o-mini-tts';
export const MODEL_EMBEDDING = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
```

### provider.ts

```typescript
// Anthropic = SDK natif pour agents copilot
import Anthropic from '@anthropic-ai/sdk';
const anthropicClient = new Anthropic();

// OpenAI = suggestions, images, STT, TTS, embeddings, vision, web search
const openaiClient = new OpenAI({ apiKey: OPENAI_API_KEY });

// @openai/agents Runner pour suggestions, recommendations
export const openaiProvider = new OpenAIProvider({ openAIClient: openaiClient });
```

---

## Comparatif Cross-Provider

### Par Tier

| Tier | Anthropic | OpenAI |
|------|-----------|--------|
| **Flagship** | Opus 4.6 ($5/$25) | GPT-5 ($1.25/$10) |
| **Balanced** | Sonnet 4.5 ($3/$15) | GPT-5-mini ($0.25/$2) |
| **Fast** | Haiku 4.5 ($1/$5) | GPT-5-nano ($0.05/$0.40) |
| **Ultra-cheap** | — | gpt-4.1-nano ($0.10/$0.40) |

### Capacites Audio/TTS

| Capacite | Anthropic | OpenAI |
|----------|-----------|--------|
| **Audio natif input** | Non | Oui (WAV, MP3) |
| **STT** | Non | Oui (gpt-4o-mini-transcribe) |
| **TTS** | Non | Oui (13 voix, steerable) |
| **Temps reel** | Non | gpt-realtime |

### Contexte et Output

| | Anthropic | OpenAI |
|--|-----------|--------|
| **Max contexte** | 200K (1M beta) | 400K |
| **Max output** | 128K (Opus) / 64K | 128K |
| **Prompt caching** | 90% reduction | Variable |

**Conclusion pricing:** OpenAI est 4-20x moins cher par token selon le tier (gpt-4.1-nano pour les taches legeres). L'avantage Claude: meilleur tool calling et francais natif sur les agents copilot.

---

## Estimations de Couts

### Cout par Requete Copilot

| Composant | Tokens estimes | Cout |
|-----------|----------------|------|
| Agent principal Anthropic (2K in, 1K out) | ~3K | ~$0.021 |
| Agent avec prompt caching | ~3K | ~$0.016 |
| Guardrail input Haiku (500 in, 100 out) | ~600 | ~$0.001 |
| Titre session Haiku (200 in, 50 out) | ~250 | ~$0.0005 |
| Embedding | ~500 | ~$0.00001 |
| **Total moyen (avec caching)** | | **~$0.017** |

### Couts Additionnels

| Service | Provider | Cout |
|---------|----------|------|
| Suggestion formulaire | OpenAI | ~$0.0005 |
| Objectif quotidien | OpenAI | ~$0.0005 |
| Generation image | OpenAI | $0.02-$0.19 |
| Transcription audio (STT) | OpenAI | $0.006/min |
| Synthese vocale (TTS) | OpenAI | ~$0.015/min |
| Extraction CV (vision) | OpenAI | ~$0.005 |
| Recommendation candidat | OpenAI | ~$0.0005 |
| Web search | OpenAI | ~$0.005 |

### Cout Mensuel par Utilisateur Actif

| Usage | Requetes/mois | Cout Anthropic |
|-------|---------------|----------------|
| Leger | 50 | ~$1.10 |
| Moyen | 200 | ~$4.40 |
| Intensif | 500 | ~$11.00 |

---

## Historique de Migration

### 14 Feb 2026: Single-provider → Multi-provider

| Composant | Avant (OpenAI seul) | Apres (Multi-provider) |
|-----------|---------------------|------------------------|
| Agents principaux | GPT-5 | claude-sonnet-4-6 (Anthropic) |
| Guardrails/summaries | GPT-5-nano | claude-haiku-4-5 (Anthropic) |
| Suggestions | GPT-5-nano | gpt-4.1-nano (OpenAI) |
| Web search | GPT-5-mini | gpt-4.1-mini (OpenAI Responses API) |
| Vision/extraction | GPT-5-mini | gpt-4.1-mini (OpenAI) |
| Recommendations | GPT-5-nano | gpt-4.1-nano (OpenAI) |
| Images/STT/Embeddings | Inchange | Inchange |

### 15 Feb 2026: @openai/agents → Anthropic SDK natif

- Boucle agentic manuelle : `client.messages.stream()` + while loop
- `defineTool()` remplace `tool()` de `@openai/agents`
- `AgentConfig` remplace `Agent` class
- `@openai/agents` conserve uniquement pour suggestions/recommendations (OpenAI provider)

### 22 Juin 2026: Retrait de Google Gemini

- `MODEL_SUGGESTION` migre de `gemini-2.5-flash-lite` vers `gpt-4.1-nano` (OpenAI). Suggestions formulaires, objectifs quotidiens, bio et assistant WhatsApp passent sur OpenAI.
- Tool `analyze_youtube_video` (analyse video native Gemini) supprime. `youtube_search` (YouTube Data API) conserve.
- Variable `GOOGLE_API_KEY` retiree. Architecture reduite a 2 providers (Anthropic + OpenAI).

---

## Guide de Prompting

### Anthropic Claude (Agents)

- Structure claire avec sections markdown (`# Role`, `# Instructions`, `# Tool Sequencing`, `# Output Format`)
- Instructions explicites — Claude execute litteralement
- Francais natif — pas besoin de "Respond in French"
- Tool calling fiable — enchainement d'outils previsible

### OpenAI GPT-4.1-nano (Suggestions)

- Prompts courts et directs
- JSON output efficace
- Pas de tool calling — mode chat.completions simple

### OpenAI GPT-4.1 (Vision/Search)

- `response_format: { type: "json_object" }` pour extraction vision
- Responses API pour web search
- Persistence: "Continue jusqu'a resolution complete"

---

## Sources

### Anthropic
- [Models Overview](https://platform.claude.com/docs/en/about-claude/models/overview)
- [Pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- [Tool Use](https://docs.anthropic.com/en/docs/build-with-claude/tool-use)
- [Prompt Caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)
- [Extended Thinking](https://platform.claude.com/docs/en/build-with-claude/extended-thinking)

### OpenAI
- [GPT-4.1 Models](https://platform.openai.com/docs/models/gpt-4.1)
- [GPT-Image-1](https://platform.openai.com/docs/models/gpt-image-1)
- [Whisper](https://platform.openai.com/docs/models/whisper-1)
- [Embeddings](https://platform.openai.com/docs/models/text-embedding-3-small)
- [OpenAI Pricing](https://openai.com/api/pricing/)

---

*Document mis a jour le 22 juin 2026 - Retrait de Google Gemini, architecture reduite a 2 providers (Anthropic + OpenAI)*
