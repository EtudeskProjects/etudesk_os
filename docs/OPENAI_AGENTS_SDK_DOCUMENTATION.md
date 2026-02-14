# OpenAI Agents SDK for TypeScript — Documentation

> Documentation compilée en Février 2026 pour le projet Etudesk
> Mise à jour: 14 Février 2026 — Ajout patterns multi-provider (Anthropic + Gemini + OpenAI)

## Installation

```bash
npm install @openai/agents zod
```

**Environnements supportés**: Node.js 22+, Deno, Bun, Cloudflare Workers (expérimental)

---

## Core Primitives

Le SDK repose sur **4 primitives fondamentales**:

| Primitive | Description |
|-----------|-------------|
| **Agents** | LLMs configurés avec instructions, tools, guardrails et handoffs |
| **Handoffs** | Tool calls spécialisés pour transférer le contrôle entre agents |
| **Guardrails** | Validations de sécurité sur les inputs/outputs |
| **Tracing** | Tracking intégré pour debug et optimisation |

---

## Agent Creation

### Agent Basique

```typescript
import { Agent, run } from '@openai/agents';

const agent = new Agent({
  name: 'Assistant',
  instructions: 'You are a helpful assistant',
});

const result = await run(agent, 'Your prompt here');
console.log(result.finalOutput);
```

### Agent avec Tools et Handoffs

```typescript
const agent = Agent.create({
  name: 'Main agent',
  instructions: 'You are a coordinator',
  tools: [myTool1, myTool2],
  handoffs: [specialistAgent],
});
```

---

## Tools Definition

Les tools utilisent des schemas Zod pour la validation:

```typescript
import { z } from 'zod';
import { tool } from '@openai/agents';

const getWeatherTool = tool({
  name: 'get_weather',
  description: 'Get the weather for a given city',
  parameters: z.object({ city: z.string() }),
  execute: async (input) => {
    return `The weather in ${input.city} is sunny`;
  },
});
```

### Types de Tools

| Type | Description |
|------|-------------|
| **Hosted tools** | Code interpreter, file search, image generation |
| **Local built-in** | Web search, shell, computer use |
| **Function tools** | Custom tools avec Zod schema |
| **Agent-as-tool** | Agent encapsulé comme tool |
| **MCP tools** | Model Context Protocol servers |
| **Codex tools** | Pour exécution de code |

---

## Handoffs (Délégation entre Agents)

Les handoffs permettent à un agent de déléguer à un autre:

```typescript
import { handoff } from '@openai/agents';

// Agent spécialisé
const fileReaderAgent = new Agent({
  name: 'FileReader',
  instructions: 'You read and analyze files',
  handoffDescription: 'Expert at reading and parsing documents',
  tools: [readFileTool],
});

// Agent principal avec handoff
const mainAgent = Agent.create({
  name: 'Coordinator',
  instructions: 'Coordinate tasks between specialists',
  handoffs: [fileReaderAgent],
});
```

### handoff() Function

Pour encapsuler un agent en Handoff avec configuration:

```typescript
import { handoff } from '@openai/agents';

const wrappedHandoff = handoff(specialistAgent, {
  toolNameOverride: 'delegate_to_specialist',
  toolDescriptionOverride: 'Use when specialized analysis needed',
  inputFilter: (input) => sanitize(input), // Filtre l'input avant délégation
});
```

**RECOMMENDED_PROMPT_PREFIX**: Instruction standard pour les agents qui reçoivent des handoffs:
```
You are a specialized agent. Focus on your specific task and return control when complete.
```

---

## Agent Loop Behavior

Quand `run()` est appelé, le SDK exécute en boucle jusqu'à un output final:

```
1. Agent invoqué avec input
2. LLM retourne réponse (peut inclure tool calls ou handoffs)
3. Si output final détecté → fin
4. Si handoff demandé → switch d'agent, continue
5. Si tool calls présents → exécution tools, continue
```

**Output final** quand:
- Agent a `outputType` (structured) et réponse matching retournée, OU
- Pas de `outputType` et première réponse sans tool calls/handoffs

**Contrôle des itérations**:
```typescript
const result = await run(agent, input, { maxTurns: 10 });
```

---

## Memory Management

### Approche 1: State-Based (RunContextWrapper)

Pour un état persistant structuré qui évolue entre les runs:

```typescript
import { RunContextWrapper } from '@openai/agents';

interface UserContext {
  userId: string;
  preferences: {
    language: string;
    timezone: string;
  };
  sessionNotes: string[];
  globalMemory: string[];
}

// Création du contexte
const context: UserContext = {
  userId: 'user123',
  preferences: { language: 'fr', timezone: 'Europe/Paris' },
  sessionNotes: [],
  globalMemory: ['User prefers concise answers'],
};

// Utilisation dans run()
const result = await run(agent, input, {
  context: new RunContextWrapper(context),
});
```

**Séparation des scopes**:
- **Session notes**: Staging area, valide uniquement pour la session courante
- **Global memory**: Persistant, affecte toutes les futures sessions

### Approche 2: Sessions (Short-Term Memory)

Pour l'historique de conversation automatique:

```typescript
import { TrimmingSession, SummarizingSession, SQLiteSession } from '@openai/agents';

// Session qui tronque les anciens messages
const session = new TrimmingSession({ maxTokens: 4000 });

// Session qui résume les anciens messages
const session = new SummarizingSession({
  summarizeAfterTokens: 3000,
  summaryModel: 'gpt-4.1-mini'
});

// Session persistante en SQLite
const session = new SQLiteSession({ dbPath: './memory.db' });

// Utilisation
const result = await run(agent, input, { session });
```

### Memory Layers (Pattern Recommandé)

| Layer | Description | Persistance |
|-------|-------------|-------------|
| **State Management** | État structuré via RunContextWrapper | Entre runs |
| **Memory Injection** | Injection des portions pertinentes au début | Par session |
| **Memory Distillation** | Capture d'insights via tool dédié | Pendant session |
| **Memory Consolidation** | Merge des session notes en global memory | Post-session |

**Important**: Le contexte n'est PAS envoyé au LLM. C'est un objet local pour lecture/écriture.

---

## Streaming

Pour des réponses en temps réel:

```typescript
const stream = await run(agent, input, { stream: true });

for await (const event of stream) {
  if (event.type === 'raw_model_stream_event') {
    // Deltas de texte
    const delta = event.data?.delta?.content;
    if (delta) process.stdout.write(delta);
  }

  if (event.type === 'run_item_stream_event') {
    // Tool calls et outputs
    if (event.name === 'tool_called') {
      console.log('Tool:', event.item.rawItem.name);
    }
    if (event.name === 'tool_output') {
      console.log('Output:', event.item.output);
    }
  }
}
```

### Event Types

| Event Type | Description |
|------------|-------------|
| `raw_model_stream_event` | Deltas de texte du modèle |
| `run_item_stream_event` | Tool calls, outputs, messages |

### Event Names (run_item_stream_event)

- `tool_called` — Tool invoqué
- `tool_output` — Résultat du tool
- `message_output_created` — Message final créé

---

## Guardrails

Validations de sécurité exécutées en parallèle avec l'agent:

```typescript
import { inputGuardrail, outputGuardrail } from '@openai/agents';

const piiGuardrail = inputGuardrail({
  name: 'pii_check',
  validate: async (input) => {
    if (containsPII(input)) {
      return { valid: false, reason: 'Input contains PII' };
    }
    return { valid: true };
  },
});

const agent = new Agent({
  name: 'Secure Agent',
  instructions: '...',
  inputGuardrails: [piiGuardrail],
  outputGuardrails: [toxicityGuardrail],
});
```

**Comportement**: Les guardrails s'exécutent en parallèle avec l'agent et déclenchent un **fail-fast** si la validation échoue (`GuardrailTripwireTriggered`).

---

## Tracing

Tracing intégré pour debug et monitoring:

```typescript
import { withTrace } from '@openai/agents';

const result = await withTrace('my-workflow', async () => {
  return await run(agent, input);
});
```

Le tracing permet:
- Visualisation des workflows agentic
- Debug des tool calls
- Monitoring des performances
- Support pour évaluation, fine-tuning et distillation

---

## Error Handling

```typescript
import { MaxTurnsExceededError, GuardrailTripwireTriggered } from '@openai/agents';

try {
  const result = await run(agent, input, { maxTurns: 5 });
} catch (error) {
  if (error instanceof MaxTurnsExceededError) {
    console.log('Agent exceeded max turns');
  }
  if (error instanceof GuardrailTripwireTriggered) {
    console.log('Guardrail failed:', error.reason);
  }
}
```

---

## Patterns pour Etudesk Copilot

### 1. Architecture Multi-Provider (Anthropic + Gemini + OpenAI)

Etudesk utilise 3 providers AI simultanément via le SDK OpenAI Agents :

| Provider | Modèles | Usage |
|----------|---------|-------|
| **Anthropic** (claude-sonnet-4-5, claude-haiku-4-5) | Agents principaux, guardrails, titres, summaries, file_reader | Via `AnthropicProvider` custom adapter |
| **Google** (gemini-2.5-flash-lite) | Suggestions, objectifs quotidiens, bio | Via `OpenAIProvider` wrappant endpoint OpenAI-compatible Gemini |
| **OpenAI** (gpt-4.1-mini, gpt-4.1-nano, gpt-image-1, whisper-1, omni-moderation-latest) | Web search, vision/extraction, images, STT, embeddings, moderation | Via `OpenAIProvider` natif (moderation: direct `new OpenAI()`) |

**Routing par défaut :** `setDefaultModelProvider(anthropicProvider)` — les agents principaux utilisent Anthropic.

**Override par provider :**
```typescript
// Suggestions → Gemini
const geminiRunner = new Runner({ modelProvider: geminiProvider });
await geminiRunner.run(suggestionsAgent, 'Génère les suggestions.');

// Recommendations → OpenAI
const openaiRunner = new Runner({ modelProvider: openaiProvider });
await openaiRunner.run(recommendationAgent, prompt);

// Web search → toujours OpenAI (Responses API requis)
// Le WebSearchAgent utilise openaiResponsesProvider hardcodé
```

### 2. Architecture Multi-Agent Actuelle

```
TalentAgent (explore) ── model: claude-sonnet-4-5 (Anthropic)
                         tools: vector_query, sql_query, generate_document,
                                file_reader (asTool, claude-haiku-4-5),
                                web_search (asTool, gpt-4.1-mini), execute_action

TalentAgent (study)   ── model: claude-sonnet-4-5 (Anthropic)
                         tools: sql_query (restreint), youtube_search, generate_image,
                                generate_diagram, file_reader (asTool, claude-haiku-4-5),
                                web_search (asTool, gpt-4.1-mini), manage_skills

OrgAgent              ── model: claude-sonnet-4-5 (Anthropic)
                         tools: vector_query, sql_query (org_* + search_*),
                                generate_document, file_reader (asTool, claude-haiku-4-5),
                                web_search (asTool, gpt-4.1-mini), execute_action
```

> **Note:** Etudesk utilise `asTool()` (sub-agent encapsulé comme tool), PAS `handoff()`.
> FileReaderAgent est un agent claude-haiku-4-5 wrappé via `agent.asTool()`.
> WebSearchAgent est un agent gpt-4.1-mini wrappé via `agent.asTool()` (toujours OpenAI — Responses API).

**Services hors-copilot utilisant les providers :**

```
Suggestions formulaires ── model: gemini-2.5-flash-lite (Google)
                           via getGeminiClient().chat.completions.create()
                           services: space-gen, community-gen, opportunity-gen,
                                     daily-objective, bio, whatsapp-assistant

Vision/Extraction     ── model: gpt-4.1-mini (OpenAI)
                         via getOpenAIClient().chat.completions.create(vision)
                         services: extraction CV, KYC, org-documents

Recommendations       ── model: gpt-4.1-nano (OpenAI)
                         via Runner({ modelProvider: openaiProvider })
                         service: recommendation.service.ts

Transcription audio   ── model: whisper-1 (OpenAI)
                         via getOpenAIClient().audio.transcriptions.create()
                         route: copilot.ts (POST /chat avec audio)

Embeddings            ── model: text-embedding-3-small (OpenAI)
                         via getEmbeddingClient().embeddings.create()
                         service: embedding.service.ts → Pinecone

Auto-moderation       ── model: omni-moderation-latest (OpenAI)
                         via direct new OpenAI() (timeout 5s)
                         service: auto-moderation.service.ts
                         Note: seule exception — n'utilise PAS provider.ts
```

### 3. Memory Pattern Recommandé

```typescript
// Contexte talent injecté à chaque run
interface TalentContext {
  talentId: string;
  language: 'fr' | 'en';
  profile: { name, role, skills };
  sessionNotes: string[];
  // ...autres données pertinentes
}

const result = await run(talentAgent, message, {
  context: new RunContextWrapper(talentContext),
  session: existingSession, // Pour historique conversation
});
```

### 4. Tool Sequencing (Best Practice)

1. **vector_query** FIRST — Discovery dans Pinecone
2. **sql_query** — Données structurées/personnelles
3. **web_search** — SEULEMENT si données internes insuffisantes

### 5. Streaming SSE (Pattern Actuel)

```typescript
const stream = await run(agent, message, { stream: true });

for await (const event of stream) {
  if (event.type === 'raw_model_stream_event') {
    res.write(`data: ${JSON.stringify({ type: 'delta', content: delta })}\n\n`);
  }
  if (event.type === 'run_item_stream_event' && event.name === 'tool_called') {
    res.write(`data: ${JSON.stringify({ type: 'tool', name: event.item.rawItem.name })}\n\n`);
  }
}
```

---

## Features Supportées

| Feature | Status |
|---------|--------|
| Multi-agent workflows | ✓ |
| Tool integration | ✓ |
| Handoffs | ✓ |
| Structured outputs | ✓ |
| Streaming | ✓ |
| Tracing | ✓ |
| Input/output guardrails | ✓ |
| Parallelization | ✓ |
| Human-in-the-loop | ✓ |
| Realtime voice agents | ✓ |
| MCP server support | ✓ |
| Non-OpenAI models (custom ModelProvider) | ✓ (Etudesk: AnthropicProvider, GeminiProvider) |

---

## Custom ModelProvider (Pattern Etudesk)

Le SDK OpenAI Agents supporte des providers non-OpenAI via l'interface `ModelProvider` :

```typescript
import { ModelProvider, Model } from '@openai/agents-core';
import Anthropic from '@anthropic-ai/sdk';

// AnthropicModel implémente l'interface Model du SDK
class AnthropicModel implements Model {
  async getResponse(request: ModelRequest): Promise<ModelResponse> {
    // Traduit ModelRequest → Anthropic messages.create()
    // Mappe tools[].parameters → Anthropic input_schema
    // Mappe AgentInputItem[] → Anthropic messages[]
  }

  async getStreamedResponse(request: ModelRequest): Promise<AsyncIterable<StreamEvent>> {
    // Traduit en stream Anthropic → AsyncIterable<StreamEvent>
    // Mappe content_block_delta → SDK StreamEvent
    // Mappe tool_use → SDK tool call output items
  }
}

// AnthropicProvider implémente ModelProvider
class AnthropicProvider implements ModelProvider {
  getModel(modelName: string): Model {
    return new AnthropicModel(this.client, modelName);
  }
}

// Usage avec le SDK
import { setDefaultModelProvider, Runner } from '@openai/agents';

setDefaultModelProvider(anthropicProvider);  // run() utilise Anthropic par défaut

// Override pour un runner spécifique
const geminiRunner = new Runner({ modelProvider: geminiProvider });
const openaiRunner = new Runner({ modelProvider: openaiProvider });
```

**Fichiers Etudesk :**
- `src/services/ai/anthropic-provider.ts` — AnthropicModel + AnthropicProvider
- `src/services/ai/provider.ts` — Configuration des 3 providers + exports

---

## Sources

- [OpenAI Agents SDK TypeScript Docs](https://openai.github.io/openai-agents-js/)
- [GitHub Repository](https://github.com/openai/openai-agents-js)
- [Session Memory Cookbook](https://cookbook.openai.com/examples/agents_sdk/session_memory)
- [Context Personalization Cookbook](https://cookbook.openai.com/examples/agents_sdk/context_personalization)
- [Tracing Documentation](https://openai.github.io/openai-agents-python/tracing/)
- [Guardrails Documentation](https://openai.github.io/openai-agents-python/guardrails/)
