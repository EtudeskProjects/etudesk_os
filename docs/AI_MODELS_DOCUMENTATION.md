# Documentation des Modeles AI - Etudesk OS

> **Derniere mise a jour:** 14 fevrier 2026
> **Architecture:** Multi-provider (Anthropic + Google Gemini + OpenAI)

---

## Table des Matieres

1. [Resume Executif](#resume-executif)
2. [Architecture Multi-Provider](#architecture-multi-provider)
3. [Anthropic Claude (Agents Principaux)](#anthropic-claude-agents-principaux)
4. [Google Gemini (Suggestions)](#google-gemini-suggestions)
5. [OpenAI (Images, Vision, Search, Embeddings)](#openai-images-vision-search-embeddings)
6. [Mapping Modeles → Services](#mapping-modeles--services)
7. [Configuration (provider.ts / models.ts)](#configuration)
8. [Estimations de Couts](#estimations-de-couts)
9. [Plan de Migration](#plan-de-migration)
10. [Guide de Prompting](#guide-de-prompting)
11. [Modeles de Reference (non utilises)](#modeles-de-reference-non-utilises)
12. [Sources](#sources)

---

## Resume Executif

Etudesk OS utilise **3 providers AI simultanement**, chacun pour ses forces :

| Provider | Role | Modeles | Pourquoi |
|----------|------|---------|----------|
| **Anthropic Claude** | Agents copilot, guardrails, summaries, titres, file reader | Sonnet 4.5, Haiku 4.5 | Meilleur suivi d'instructions, tool calling fiable, francais natif |
| **Google Gemini** | Suggestions formulaires, objectifs quotidiens, bio | Flash Lite 2.5 | Ultra-rapide, cout minimal |
| **OpenAI** | Images, STT, web search, embeddings, vision/extraction, recommendations | gpt-image-1, whisper-1, gpt-4.1-mini, gpt-4.1-nano, text-embedding-3-small | Capabilities uniques (image gen, STT, Responses API web search) |

### Modeles en production (Feb 2026)

| Constante | Modele | Provider | Utilisation | Cout (1M tokens) |
|-----------|--------|----------|-------------|-------------------|
| `MODEL_AGENT` | claude-sonnet-4-5 | Anthropic | Agents Copilot principaux | $3.00 / $15.00 |
| `MODEL_FAST` | claude-haiku-4-5 | Anthropic | Guardrails, titres, summaries, file reader | $0.80 / $4.00 |
| `MODEL_SUGGESTION` | gemini-2.5-flash-lite | Google | Suggestions, objectifs, bio | ~$0.075 / $0.30 |
| `MODEL_MATCH` | gpt-4.1-nano | OpenAI | Recommendations candidats | $0.10 / $0.40 |
| `MODEL_SEARCH` | gpt-4.1-mini | OpenAI | Vision/extraction, web search agent | $0.40 / $1.60 |
| `MODEL_IMAGE` | gpt-image-1 | OpenAI | Generation d'images | $0.02-$0.19/image |
| `MODEL_STT` | whisper-1 | OpenAI | Transcription audio | $0.006/min |
| `MODEL_EMBEDDING` | text-embedding-3-small | OpenAI | Embeddings vectoriels | $0.02/1M tokens |

---

## Architecture Multi-Provider

```
+-----------------------------------------------------------------------------+
|                        COPILOT ARCHITECTURE (Multi-Provider)                  |
+-----------------------------------------------------------------------------+
|                                                                               |
|  ANTHROPIC CLAUDE (default provider — agents, guardrails, summaries)          |
|  ┌───────────────────┐  ┌───────────────────┐  ┌────────────────────┐       |
|  │  TalentAgent      │  │   OrgAgent        │  │  FileReaderAgent   │       |
|  │  (Sonnet 4.5)     │  │  (Sonnet 4.5)     │  │  (Haiku 4.5)      │       |
|  │  6-7 tools        │  │  6 tools          │  │  asTool sub-agent  │       |
|  └───────────────────┘  └───────────────────┘  └────────────────────┘       |
|                                                                               |
|  ┌───────────────────┐  ┌───────────────────┐  ┌────────────────────┐       |
|  │ Input Guardrail   │  │ Session Summarizer│  │  Title Agent       │       |
|  │ (Haiku 4.5)       │  │ (Haiku 4.5)       │  │  (Haiku 4.5)      │       |
|  └───────────────────┘  └───────────────────┘  └────────────────────┘       |
|                                                                               |
+-----------------------------------------------------------------------------+
|  OPENAI (images, STT, embeddings, vision, web search, recommendations)       |
+-----------------------------------------------------------------------------+
|  ┌────────────────┐  ┌────────────────┐  ┌─────────────────────────────┐    |
|  │ WebSearchAgent │  │ Recommendation │  │ Vision/Extraction           │    |
|  │ gpt-4.1-mini   │  │ gpt-4.1-nano  │  │ gpt-4.1-mini               │    |
|  │ Responses API  │  │ openaiProvider │  │ KYC, docs, org-docs         │    |
|  └────────────────┘  └────────────────┘  └─────────────────────────────┘    |
|                                                                               |
|  ┌────────────────┐  ┌────────────────┐  ┌─────────────────────────────┐    |
|  │ Image Gen      │  │ Transcribe     │  │ Embedding Service           │    |
|  │ gpt-image-1    │  │ whisper-1      │  │ text-embedding-3-small      │    |
|  └────────────────┘  └────────────────┘  │ → Pinecone Vector DB        │    |
|                                           └─────────────────────────────┘    |
+-----------------------------------------------------------------------------+
|  GOOGLE GEMINI (suggestions formulaires, objectifs, bio)                     |
+-----------------------------------------------------------------------------+
|  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐                 |
|  │ Space Gen      │  │ Community Gen  │  │ Opportunity Gen │                 |
|  │ Flash Lite 2.5 │  │ Flash Lite 2.5 │  │ Flash Lite 2.5 │                 |
|  └────────────────┘  └────────────────┘  └────────────────┘                 |
|                                                                               |
|  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐                 |
|  │ Daily Object.  │  │ Bio Gen        │  │ Suggestions    │                 |
|  │ Flash Lite 2.5 │  │ Flash Lite 2.5 │  │ Flash Lite 2.5 │                 |
|  └────────────────┘  └────────────────┘  └────────────────┘                 |
|                                                                               |
+-----------------------------------------------------------------------------+
```

### Provider Routing (provider.ts)

```typescript
// 3 providers simultanes — chaque run() utilise le bon provider
import { setDefaultModelProvider } from '@openai/agents';

// Anthropic = default pour run() / agents principaux
setDefaultModelProvider(anthropicProvider);

// OpenAI = pour web search, recommendations, vision
const openaiRunner = new Runner({ modelProvider: openaiProvider });

// Gemini = pour suggestions formulaires
const geminiRunner = new Runner({ modelProvider: geminiProvider });
```

### Variables d'environnement requises

```bash
# Les 3 cles sont requises pour le fonctionnement complet
OPENAI_API_KEY=sk-...          # Images, STT, embeddings, web search, vision
GOOGLE_API_KEY=AIza...          # Suggestions formulaires (Gemini)
ANTHROPIC_API_KEY=sk-ant-...    # Agents copilot principaux
```

---

## Anthropic Claude (Agents Principaux)

### Claude Sonnet 4.5

> **Role:** Agents Copilot principaux (TalentAgent, OrgAgent)
> **Model ID:** `claude-sonnet-4-5-20250514`
> **Constante:** `MODEL_AGENT`

| Caracteristique | Valeur |
|-----------------|--------|
| **Context Window** | 200,000 tokens |
| **Max Output Tokens** | 8,192 tokens (defaut) |
| **Knowledge Cutoff** | Avril 2025 |
| **Vision** | Oui (images base64 + URL) |
| **Tool Use** | Oui (natif) |

| Type | Cout / 1M tokens |
|------|-------------------|
| Input | $3.00 |
| Output | $15.00 |
| Prompt Caching (write) | $3.75 |
| Prompt Caching (read) | $0.30 (90% discount) |

**Utilisation dans Etudesk:**

| Fichier | Service |
|---------|---------|
| `services/copilot/agents/talent.agent.ts` | Agent principal Talent (Explorer + Study) |
| `services/copilot/agents/organization.agent.ts` | Agent Organisation |

**Pourquoi Anthropic pour les agents principaux:**
- Meilleur suivi d'instructions complexes (system prompts longs)
- Tool calling fiable et previsible
- Francais natif de haute qualite
- Prompt caching reduit les couts de 90% sur le system prompt

---

### Claude Haiku 4.5

> **Role:** Guardrails, titres, summaries, sub-agent file_reader
> **Model ID:** `claude-haiku-4-5-20251001`
> **Constante:** `MODEL_FAST`

| Caracteristique | Valeur |
|-----------------|--------|
| **Context Window** | 200,000 tokens |
| **Max Output Tokens** | 8,192 tokens |
| **Knowledge Cutoff** | Avril 2025 |
| **Latence** | Ultra-rapide |
| **Vision** | Oui |
| **Tool Use** | Oui |

| Type | Cout / 1M tokens |
|------|-------------------|
| Input | $0.80 |
| Output | $4.00 |
| Prompt Caching (write) | $1.00 |
| Prompt Caching (read) | $0.08 (90% discount) |

**Utilisation dans Etudesk:**

| Fichier | Service |
|---------|---------|
| `services/copilot/guardrails/input.guardrail.ts` | Input safety guardrail |
| `services/copilot/session-summarizer.ts` | Summarization historique conversation |
| `services/copilot/stream/sse.handler.ts` | Generation titres sessions |
| `services/copilot/tools/file-read.tool.ts` | Sub-agent FileReaderAgent (asTool) |
| `services/ai/agent-factory.ts` | TitleAgent |

---

## Google Gemini (Suggestions)

### Gemini 2.5 Flash Lite

> **Role:** Suggestions formulaires, objectifs quotidiens, bio
> **Model ID:** `gemini-2.5-flash-lite`
> **Constante:** `MODEL_SUGGESTION`
> **Acces:** Via endpoint OpenAI-compatible (`generativelanguage.googleapis.com/v1beta/openai/`)

| Caracteristique | Valeur |
|-----------------|--------|
| **Context Window** | 1,000,000 tokens |
| **Max Output Tokens** | 65,536 tokens |
| **Latence** | Tres rapide |
| **Cout** | Le moins cher des 3 providers |

| Type | Cout / 1M tokens |
|------|-------------------|
| Input | ~$0.075 |
| Output | ~$0.30 |

**Utilisation dans Etudesk:**

| Fichier | Service |
|---------|---------|
| `services/space-generation.service.ts` | Suggestions espaces |
| `services/community-generation.service.ts` | Suggestions communautes |
| `services/opportunity-generation.service.ts` | Suggestions opportunites |
| `services/daily-objective.service.ts` | Objectifs quotidiens talents + orgs |
| `services/whatsapp-assistant.service.ts` | Assistant WhatsApp |
| `routes/talents.ts` | Generation bio talent |
| `routes/copilot.ts` | Suggestions intent copilot |
| `services/copilot/stream/sse.handler.ts` | Suggestions prompts copilot |
| `services/ai/agent-factory.ts` | SpaceGenAgent, CommunityGenAgent, OpportunityGenAgent, SuggestionsAgent, IntentSuggestionsAgent |

**Pourquoi Gemini pour les suggestions:**
- Cout ultra-bas (ideal pour des taches simples, repetitives)
- Rapide (latence minimale pour l'UX formulaire)
- Contexte 1M tokens (pas un avantage ici, mais pratique)

---

## OpenAI (Images, Vision, Search, Embeddings)

### GPT-4.1-mini (Vision/Extraction)

> **Role:** Extraction documents, KYC, web search agent
> **Model ID:** `gpt-4.1-mini`
> **Constante:** `MODEL_SEARCH`

| Caracteristique | Valeur |
|-----------------|--------|
| **Context Window** | 1,047,576 tokens (1M) |
| **Max Output Tokens** | 32,768 tokens |
| **Vision** | Oui |
| **Structured Outputs** | Oui (response_format: json_object) |

| Type | Cout / 1M tokens |
|------|-------------------|
| Input | $0.40 |
| Cached Input | $0.10 |
| Output | $1.60 |

**Utilisation dans Etudesk:**

| Fichier | Service |
|---------|---------|
| `services/documents/extraction.service.ts` | Extraction CV/documents (vision) |
| `services/kyc-verification.service.ts` | Verification identite (vision) |
| `services/org-documents/org-document.service.ts` | Analyse docs organisation (vision) |
| `services/copilot/tools/web-search.tool.ts` | WebSearchAgent (Responses API, toujours OpenAI) |

**Note:** OpenAI est utilise pour la vision/extraction car `response_format: json_object` est plus fiable qu'Anthropic pour les structured outputs.

---

### Omni-Moderation-Latest (Content Moderation)

> **Role:** Moderation automatique du contenu utilisateur (messages, bio, posts)
> **Model ID:** `omni-moderation-latest`
> **Acces:** Direct `new OpenAI()` avec timeout custom (pas via provider.ts)

| Type | Cout |
|------|------|
| Input | $0.00 (gratuit) |

**Utilisation dans Etudesk:**

| Fichier | Service |
|---------|---------|
| `services/auto-moderation.service.ts` | Screening automatique du contenu (texte + images) |

**Note technique:** Ce service utilise son propre client OpenAI (`new OpenAI()`) avec un timeout custom de 5 secondes, et non le client partage via `provider.ts`. C'est la seule exception a l'architecture multi-provider centralisee.

---

### GPT-4.1-nano (Recommendations)

> **Role:** Recommendations candidats (matching)
> **Model ID:** `gpt-4.1-nano`
> **Constante:** `MODEL_MATCH`

| Type | Cout / 1M tokens |
|------|-------------------|
| Input | $0.10 |
| Cached Input | $0.025 |
| Output | $0.40 |

**Utilisation dans Etudesk:**

| Fichier | Service |
|---------|---------|
| `services/recommendation.service.ts` | Recommendations IA candidats |
| `services/ai/agent-factory.ts` | RecommendationAgent |

---

### GPT-Image-1

> **Role:** Generation d'images educatives, diagrammes, infographies
> **Model ID:** `gpt-image-1`
> **Constante:** `MODEL_IMAGE`

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
> **Constante:** `MODEL_STT`

| Type | Cout |
|------|------|
| Transcription | $0.006/minute ($0.36/heure) |

> 99+ langues, 25 MB max, 5-10x temps reel.

---

### Text-Embedding-3-Small

> **Role:** Embeddings semantiques pour matching talent-opportunite
> **Model ID:** `text-embedding-3-small`
> **Constante:** `MODEL_EMBEDDING`

| Type | Cout / 1M tokens |
|------|-------------------|
| Standard | $0.02 |
| Batch | $0.01 |

> 1536 dimensions, stockage Pinecone + PostgreSQL fallback.

---

## Mapping Modeles → Services

### Par Fichier

| Fichier | Modele | Provider |
|---------|--------|----------|
| `copilot/agents/talent.agent.ts` | **claude-sonnet-4-5** | Anthropic |
| `copilot/agents/organization.agent.ts` | **claude-sonnet-4-5** | Anthropic |
| `copilot/tools/file-read.tool.ts` | **claude-haiku-4-5** | Anthropic |
| `copilot/guardrails/input.guardrail.ts` | **claude-haiku-4-5** | Anthropic |
| `copilot/session-summarizer.ts` | **claude-haiku-4-5** | Anthropic |
| `copilot/stream/sse.handler.ts` (title) | **claude-haiku-4-5** | Anthropic |
| `copilot/stream/sse.handler.ts` (suggestions) | **gemini-2.5-flash-lite** | Google |
| `copilot/tools/web-search.tool.ts` | **gpt-4.1-mini** | OpenAI (Responses API) |
| `copilot/tools/generate-image.tool.ts` | **gpt-image-1** | OpenAI |
| `recommendation.service.ts` | **gpt-4.1-nano** | OpenAI |
| `space-generation.service.ts` | **gemini-2.5-flash-lite** | Google |
| `community-generation.service.ts` | **gemini-2.5-flash-lite** | Google |
| `opportunity-generation.service.ts` | **gemini-2.5-flash-lite** | Google |
| `daily-objective.service.ts` | **gemini-2.5-flash-lite** | Google |
| `whatsapp-assistant.service.ts` | **gemini-2.5-flash-lite** | Google |
| `documents/extraction.service.ts` | **gpt-4.1-mini** | OpenAI (vision) |
| `kyc-verification.service.ts` | **gpt-4.1-mini** | OpenAI (vision) |
| `org-documents/org-document.service.ts` | **gpt-4.1-mini** | OpenAI (vision) |
| `embedding.service.ts` | **text-embedding-3-small** | OpenAI |
| `routes/copilot.ts` (STT) | **whisper-1** | OpenAI |
| `routes/copilot.ts` (suggestions) | **gemini-2.5-flash-lite** | Google |
| `routes/talents.ts` (bio) | **gemini-2.5-flash-lite** | Google |
| `auto-moderation.service.ts` | **omni-moderation-latest** | OpenAI (direct `new OpenAI()`) |

### Par Provider

| Provider | Services | Pattern d'utilisation |
|----------|----------|----------------------|
| **Anthropic** | Agents copilot, guardrails, summaries, titres, file reader | Default provider via `setDefaultModelProvider()` — `run(agent, input)` utilise Anthropic automatiquement |
| **Google Gemini** | Suggestions, objectifs, bio, WhatsApp | Via `new Runner({ modelProvider: geminiProvider })` ou `getGeminiClient()` directement |
| **OpenAI** | Images, STT, embeddings, web search, vision, recommendations | Via `new Runner({ modelProvider: openaiProvider })` ou `getOpenAIClient()` directement |

---

## Configuration

### models.ts — Constantes par usage

```typescript
// Anthropic (agents principaux + fast tasks)
export const MODEL_AGENT = 'claude-sonnet-4-5-20250514';   // Agents copilot
export const MODEL_FAST = 'claude-haiku-4-5-20251001';     // Guardrails, titles, summaries, file reader

// Google Gemini (suggestions formulaires — le moins cher)
export const MODEL_SUGGESTION = 'gemini-2.5-flash-lite';

// OpenAI (capabilities specialisees)
export const MODEL_IMAGE = 'gpt-image-1';
export const MODEL_SEARCH = 'gpt-4.1-mini';                // Vision, extraction, web search
export const MODEL_MATCH = 'gpt-4.1-nano';                 // Recommendations
export const MODEL_STT = 'whisper-1';
export const MODEL_EMBEDDING = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';

// Backward compat (deprecated — utiliser les constantes par usage)
export const MODEL_T1 = MODEL_AGENT;
export const MODEL_T2 = MODEL_FAST;
export const MODEL_T3 = MODEL_SUGGESTION;
```

### provider.ts — 3 clients simultanes

```typescript
// OpenAI client (images, STT, embeddings, vision, web search)
const openaiClient = new OpenAI({ apiKey: OPENAI_API_KEY });

// Gemini client (via endpoint OpenAI-compatible)
const geminiClient = new OpenAI({
  apiKey: GOOGLE_API_KEY,
  baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
});

// Anthropic provider (custom ModelProvider pour @openai/agents)
const anthropicProvider = new AnthropicProvider();

// ModelProviders pour @openai/agents Runner
export const openaiProvider = new OpenAIProvider({ openAIClient: openaiClient });
export const geminiProvider = new OpenAIProvider({ openAIClient: geminiClient });
export const openaiResponsesProvider = new OpenAIProvider({ openAIClient: openaiClient, useResponses: true });

// Default = Anthropic pour tous les run() sans override
setDefaultModelProvider(anthropicProvider);
```

### anthropic-provider.ts — Adapter custom

Fichier `src/services/ai/anthropic-provider.ts` implemente `Model` et `ModelProvider` de `@openai/agents-core` pour traduire les appels vers l'API native Anthropic :

- `getResponse()` : traduit `ModelRequest` → `Anthropic.messages.create()`
- `getStreamedResponse()` : stream Anthropic → `AsyncIterable<StreamEvent>`
- Gere: system instructions, tools, images base64, function calls/results
- Fusionne les messages consecutifs de meme role (exigence Anthropic)

---

## Estimations de Couts

### Cout par Requete Copilot (Estime — Anthropic)

| Composant | Tokens estimes | Cout (Anthropic) |
|-----------|----------------|-------------------|
| Agent principal (2K in, 1K out) | ~3K | ~$0.021 |
| Agent principal (avec prompt caching) | ~3K | ~$0.016 |
| Guardrail input (500 in, 100 out) | ~600 | ~$0.0008 |
| Titre session (200 in, 50 out) | ~250 | ~$0.0004 |
| Embedding | ~500 tokens | ~$0.00001 |
| **Total moyen (sans caching)** | | **~$0.022** |
| **Total moyen (avec caching)** | | **~$0.017** |

### Cout Mensuel Estime (par utilisateur actif)

| Usage | Requetes/mois | Cout (Anthropic) |
|-------|---------------|-------------------|
| Leger | 50 | ~$1.10 |
| Moyen | 200 | ~$4.40 |
| Intensif | 500 | ~$11.00 |

### Couts Additionnels (OpenAI / Gemini)

| Service | Provider | Unite | Cout |
|---------|----------|-------|------|
| Suggestion formulaire | Gemini | par generation | ~$0.0005 |
| Objectif quotidien | Gemini | par generation | ~$0.0005 |
| Generation image | OpenAI | par image | $0.02-$0.19 |
| Transcription audio | OpenAI | par minute | $0.006 |
| Extraction CV (vision) | OpenAI | par document | ~$0.005 |
| Recommendation candidat | OpenAI | par recommendation | ~$0.0005 |
| Web search | OpenAI | par recherche | ~$0.005 |

---

## Plan de Migration

### Migration effectuee (14 Feb 2026): Single-provider → Multi-provider

**Avant (13 Feb 2026):** `AI_PROVIDER=openai` — tout route vers OpenAI (GPT-5/GPT-5-mini/GPT-5-nano)

**Apres (14 Feb 2026):** 3 providers simultanes, chacun pour ses forces

| Composant | Avant | Apres | Justification |
|-----------|-------|-------|---------------|
| Agents principaux | GPT-5 (OpenAI) | claude-sonnet-4-5 (Anthropic) | Meilleur tool calling, francais |
| Guardrails/summaries | GPT-5-nano (OpenAI) | claude-haiku-4-5 (Anthropic) | Coherence avec agents principaux |
| File reader | GPT-5-mini (OpenAI) | claude-haiku-4-5 (Anthropic) | Coherence provider |
| Suggestions | GPT-5-nano (OpenAI) | gemini-2.5-flash-lite (Google) | 5x moins cher |
| Web search | GPT-5-mini (OpenAI) | gpt-4.1-mini (OpenAI) | Responses API requiert OpenAI |
| Vision/extraction | GPT-5-mini (OpenAI) | gpt-4.1-mini (OpenAI) | json_object format fiable |
| Recommendations | GPT-5-nano (OpenAI) | gpt-4.1-nano (OpenAI) | Cout minimal |
| Images | gpt-image-1 | gpt-image-1 | Pas d'alternative |
| STT | whisper-1 | whisper-1 | Pas d'alternative |
| Embeddings | text-embedding-3-small | text-embedding-3-small | Pas de changement |

### Changements techniques cles

1. **Nouveau fichier `anthropic-provider.ts`** : Adapter `Model`/`ModelProvider` de `@openai/agents-core` vers API native Anthropic
2. **`provider.ts` reecrit** : 3 clients simultanes + 3 ModelProviders
3. **`models.ts` reecrit** : Constantes par usage au lieu de MODEL_MAP par provider
4. **Pattern `Runner`** : `new Runner({ modelProvider }).run(agent, input)` pour overrider le provider par run
5. **`setDefaultModelProvider(anthropicProvider)`** : Anthropic est le defaut pour `run()`
6. **OPENAI_API_KEY toujours requis** : meme avec Anthropic/Gemini, car STT/images/embeddings/web search restent OpenAI

---

## Guide de Prompting

### Anthropic Claude (Agents)

Claude est concu pour suivre les instructions systeme de facon precise. Les bonnes pratiques :

1. **Structure claire avec sections markdown** : `# Role`, `# Instructions`, `# Tool Sequencing`, `# Output Format`
2. **Instructions explicites** : Claude execute litteralement — etre specifique
3. **Tool calling** : Claude est excellent pour choisir les bons outils et les enchainer
4. **Francais natif** : Pas besoin de "Respond in French" — Claude produit du francais naturellement

### Gemini Flash Lite (Suggestions)

Gemini Flash Lite est optimise pour les taches simples et rapides :

1. **Prompts courts et directs** : Pas besoin de system prompts elabores
2. **JSON output** : Efficace pour generer des suggestions structurees
3. **Pas de tool calling** : Utilise en mode chat.completions simple

### OpenAI GPT-4.1 (Vision/Search)

GPT-4.1 family suit les instructions de facon tres litterale :

1. **Persistence** : "Continue jusqu'a resolution complete"
2. **Tool-Calling** : "Planifie avant chaque appel de fonction"
3. **Structured Outputs** : `response_format: { type: "json_object" }` pour extraction vision

---

## Modeles de Reference (non utilises)

### Modeles disponibles mais non utilises en production

| Provider | Modele | Raison |
|----------|--------|--------|
| OpenAI | GPT-5 | Remplace par Claude Sonnet (meilleur tool calling) |
| OpenAI | GPT-5-mini | Remplace par Claude Haiku (coherence provider) |
| OpenAI | GPT-5-nano | Remplace par Gemini Flash Lite (moins cher) |
| OpenAI | GPT-5.2 | Cout trop eleve pour usage courant |
| OpenAI | o1, o3 | Reasoning models — pas necessaire pour le copilot |
| Google | Gemini 2.5 Pro | Trop cher pour les suggestions |
| Google | Gemini 2.5 Flash | Flash Lite suffit pour les taches simples |
| Anthropic | Claude Opus 4 | Trop cher / lent pour le copilot |

### GPT-5 Family (reference)

| Modele | Cout (1M tokens) | Contexte | Statut Etudesk |
|--------|-------------------|----------|----------------|
| GPT-5 | $1.25 / $10.00 | 400K | **Non utilise** (remplace par Claude Sonnet) |
| GPT-5-mini | $0.25 / $2.00 | 400K | **Non utilise** (remplace par Claude Haiku) |
| GPT-5-nano | $0.05 / $0.40 | 400K | **Non utilise** (remplace par Gemini Flash Lite) |

### Claude Family (reference complete)

| Modele | Cout (1M tokens) | Contexte | Statut Etudesk |
|--------|-------------------|----------|----------------|
| Claude Opus 4 | $15.00 / $75.00 | 200K | Non utilise (trop cher) |
| Claude Sonnet 4.5 | $3.00 / $15.00 | 200K | **EN PRODUCTION** (agents) |
| Claude Haiku 4.5 | $0.80 / $4.00 | 200K | **EN PRODUCTION** (fast tasks) |

---

## Sources

### Documentation Officielle

**Anthropic Claude:**
- [Claude Sonnet 4.5](https://docs.anthropic.com/en/docs/about-claude/models#claude-sonnet-4-5)
- [Claude Haiku 4.5](https://docs.anthropic.com/en/docs/about-claude/models#claude-haiku-4-5)
- [Anthropic API Pricing](https://www.anthropic.com/pricing)
- [Tool Use](https://docs.anthropic.com/en/docs/build-with-claude/tool-use)
- [Prompt Caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)

**Google Gemini:**
- [Gemini 2.5 Flash Lite](https://ai.google.dev/gemini-api/docs/models#gemini-2.5-flash-lite)
- [OpenAI Compatibility](https://ai.google.dev/gemini-api/docs/openai)
- [Gemini Pricing](https://ai.google.dev/pricing)

**OpenAI:**
- [GPT-4.1 Models](https://platform.openai.com/docs/models/gpt-4.1)
- [GPT-Image-1](https://platform.openai.com/docs/models/gpt-image-1)
- [Whisper](https://platform.openai.com/docs/models/whisper-1)
- [Embeddings](https://platform.openai.com/docs/models/text-embedding-3-small)
- [OpenAI Pricing](https://openai.com/api/pricing/)
- [Agents SDK](https://platform.openai.com/docs/guides/agents-sdk)

---

*Document mis a jour le 14 fevrier 2026 — Architecture multi-provider (Anthropic + Gemini + OpenAI)*
