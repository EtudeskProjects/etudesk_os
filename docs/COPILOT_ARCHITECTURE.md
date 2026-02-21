# Copilot Architecture — Etudesk OS

> Architecture technique reelle du copilot IA. Source unique pour stack, boucle agentic, streaming et lifecycle.
> Mis a jour : 21 Fevrier 2026

---

## 1. Stack Technique

### Provider principal : Anthropic SDK natif

```typescript
import Anthropic from '@anthropic-ai/sdk';
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
```

Le copilot utilise **Anthropic SDK natif** (`@anthropic-ai/sdk`) pour tous les agents et guardrails. Il n'utilise PAS `@openai/agents` pour les agents copilot.

### Usage residuel de `@openai/agents`

`@openai/agents` est conserve uniquement pour 2 cas non-copilot :

| Cas | Provider | Modele |
|-----|----------|--------|
| Suggestions formulaires (Gemini) | `geminiProvider` (OpenAIProvider wrapping Gemini endpoint) | gemini-2.5-flash-lite |
| Web search tool (OpenAI Responses API) | `openaiResponsesProvider` (useResponses: true) | gpt-4.1-mini |

Voir [AI_MODELS.md](./AI_MODELS.md) pour les constantes et pricing de tous les modeles.

---

## 2. Patterns Fondamentaux

### `defineTool()` — Definition de tools

Remplace `tool()` de `@openai/agents`. Convertit un schema Zod en `Anthropic.Tool` via `zod-to-json-schema`.

```typescript
// tool-helper.ts
interface ToolDefinition {
  definition: Anthropic.Tool;    // { name, description, input_schema }
  execute: (input: any) => Promise<any>;
}

function defineTool<T>(config: {
  name: string;
  description: string;
  parameters: z.ZodSchema<T>;
  execute: (input: T) => Promise<any>;
}): ToolDefinition
```

Garanties :
- Force `type: 'object'` a la racine du JSON Schema (requis par Anthropic)
- Unwrap automatique si Claude envoie `{input: {...}}` au lieu de `{...}`
- Champs `.optional()` Zod acceptes (Claude omet les params optionnels)

### `AgentConfig` — Configuration d'agent

Remplace `Agent` class de `@openai/agents`.

```typescript
interface AgentConfig {
  name: string;
  model: string;           // MODEL_AGENT (claude-sonnet-4-6)
  systemPrompt: string;
  tools: ToolDefinition[];
}
```

Fichiers : `talent.agent.ts` (createTalentAgent), `organization.agent.ts` (createOrgAgent)

---

## 3. Boucle Agentic Manuelle

Le coeur du copilot est une boucle `while` dans `sse.handler.ts` qui appelle `client.messages.stream()` iterativement.

### Limites

| Constante | Valeur | Description |
|-----------|--------|-------------|
| `MAX_TURNS` | 15 | Nombre max d'iterations de la boucle |
| `MAX_TOOL_CALLS` | 20 | Nombre max de tool calls total |
| `MAX_SAME_TOOL_CALLS` | 3 | Detection de boucle (meme tool + memes args) |
| `MAX_TURN_DURATION_MS` | 120 000 | Timeout global (2 minutes) |
| `MAX_PROVIDER_RETRIES` | 2 | Retry sur erreur provider (800ms backoff) |
| `SSE_BUFFER_FLUSH_MS` | 50 | Batching des text deltas avant envoi SSE |
| `HEARTBEAT_INTERVAL_MS` | 30 000 | Heartbeat SSE keep-alive |

### Flow de `runAgentWithSSE()`

```
1. Input guardrail (parallele avec construction du message)
   └─ Haiku classifie: SAFE | OFF_TOPIC | INJECTION | HARMFUL
   └─ Fast-paths: quiz answers (A/B/C/D), messages <= 80 chars → skip LLM

2. Construction messages
   └─ System prompt avec cache_control: ephemeral (prompt caching 90%)
   └─ Images base64 pour vision multimodal
   └─ Historique (derniers 20 messages)

3. Boucle agentic (while: has tool_use blocks)
   │
   ├─ client.messages.stream() → events:
   │   ├─ content_block_start (tool_use detected)
   │   ├─ content_block_delta (text or input_json)
   │   └─ content_block_stop (tool input complete)
   │
   ├─ Text deltas: buffer 50ms → SSE flush
   │
   ├─ Tool execution:
   │   ├─ Loop detection: stableStringify(tool+args) → abort si >3 identiques
   │   ├─ Execute tool → result (trimme a 8000 chars)
   │   └─ SSE: tool_start + tool_end events
   │
   └─ Re-submit tool_results → next iteration

4. Post-processing
   ├─ sanitizeDiagramBlocks() — corrige syntaxe Mermaid
   ├─ Output guardrail (non-bloquant, log only)
   └─ Return { finalOutput, toolTrace, segments, traceMetrics }
```

### Detection de boucle

`stableStringify()` serialise les args d'un tool call de maniere deterministe. Si le meme tool avec les memes args est appele plus de `MAX_SAME_TOOL_CALLS` fois, la boucle est interrompue avec un event `limit_reached` (reason: `tool_loop`).

Les tools implementent aussi un cache interne (module-level pour `smart_search`, instance-level pour `sql_query`) qui retourne `_cached: true` sur les appels repetes.

---

## 4. SSE Streaming Protocol

### Headers

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
X-Accel-Buffering: no
```

### Types d'evenements

| Event | Payload | Description |
|-------|---------|-------------|
| `text_delta` | `{ text }` | Fragment de texte (buffered 50ms) |
| `tool_start` | `{ callId, name, args }` | Debut d'un tool call |
| `tool_end` | `{ callId, name, summary, result, duration, status, error? }` | Fin d'un tool call |
| `audio_ready` | `{ url, mimeType }` | Audio TTS genere (study mode) |
| `content_corrected` | `{ content }` | Contenu canonique apres sanitization |
| `limit_reached` | `{ reason }` | `max_tools` \| `max_duration` \| `tool_loop` |
| `done` | `{ sessionId }` | Fin de la reponse |
| `error` | `{ error }` | Exception |

---

## 5. Guardrails

### Input Guardrail

| Propriete | Valeur |
|-----------|--------|
| Modele | claude-haiku-4-5 (MODEL_FAST) |
| Execution | Parallele avec l'agent |
| Mode | Fail-open (disponibilite > securite) |

Classifications : SAFE, OFF_TOPIC → passent. INJECTION, HARMFUL → bloques.

Fast-paths (skip LLM) : quiz answers (`A)`, `B)`, `C)`, `D)`), messages <= 80 chars.

### Output Guardrail

Mode log-only (ne bloque jamais). Validations :
- Entity cards : uniquement `{"id":"uuid"}` (pas de champs supplementaires)
- Study mode : zero entity cards
- Org mode : uniquement `entity:talent`, `entity:opportunity`, `entity:document`
- Limite texte : 5000 chars (study), 3000 chars (explore/org) hors code blocks

---

## 6. Session Lifecycle

### POST /api/copilot/chat — Flow complet

```
1. Auth + wallet debit (action codes par mode)
2. Init SSE headers

3. Phase 1 (parallele):
   ├─ Session get/create
   ├─ loadTalentContext() (cache 5min per ctx:{talentId}:{mode})
   └─ User language from DB

4. Skill detection: detectSkillFromMessage()
5. DPO examples: getWinningTrajectories()
6. UEMOA check: shouldInjectUEMOA()

7. Build context → create agent (createTalentAgent / createOrgAgent)

8. Phase 2 (parallele):
   ├─ Attachment metadata fetch
   └─ History load (last 20 msgs)

9. summarizeHistoryIfNeeded() + loadCrossSessionMemory()
10. Voice note: analyzeAudio() si voiceNoteUrl

11. runAgentWithSSE() — boucle agentic

12. Post-processing:
    ├─ TTS extraction (study mode, blocs ```audio_tts```)
    ├─ Save message DB (toolTrace + segments)
    ├─ Persist copilot_traces (DPO analytics)
    └─ content_corrected + done SSE events
```

### Autres endpoints copilot

| Endpoint | Description |
|----------|-------------|
| `GET /suggestions` | Gemini suggestions (cache 3min) |
| `PATCH /messages/:id/feedback` | DPO rating (1 ou 3) |
| `POST /confirm` | Action confirmation handler |
| `POST /voice-note` | Upload vocal (5MB limit) |
| `POST /transcribe` | STT via gpt-4o-mini-transcribe |
| `POST /attachments` | Upload document (PDF/images) |
| `GET/POST/DELETE /sessions` | Session CRUD |

### Session Summarizer

Modele : claude-haiku-4-5. Declenche quand l'historique depasse un seuil. Garde les derniers messages verbatim, resume le reste.

### Title Agent

Modele : claude-haiku-4-5. Genere un titre de session apres le premier message.

### Suggestions Agent

Modele : gemini-2.5-flash-lite via `@openai/agents` Runner. Cache 3 minutes.

---

## 7. Skill Detection

Le skill loader detecte le skill le plus pertinent pour chaque message utilisateur.

### Algorithme (async)

1. **Semantic path** (si embeddings pre-calcules) :
   - `generateEmbedding(message)` → cosine similarity avec chaque skill
   - Pick best si `score >= 0.45`

2. **Static fallback** (si pas d'embeddings ou erreur API) :
   - Substring match sur triggers normalises (Unicode, lowercase)
   - Seuil minimum : trigger length >= 3 chars
   - Rang par nombre de hits puis priority
   - Country bonus : termes UEMOA-specifiques donnent +1 hit

### Precomputation

`precomputeSkillEmbeddings()` est appele au startup (non-bloquant). Genere `embedding(description + triggers)` avec cache 24h.

### Injection

Le skill detecte est injecte comme `<active_skill_instructions>` dans le system prompt de l'agent.

Fichier : `skill.loader.ts`

---

## 8. UEMOA Knowledge Injection

Module conditionnel qui injecte ~2500 tokens de contexte UEMOA quand pertinent.

### Declenchement (`shouldInjectUEMOA()`)

Retourne `true` si :
- Le skill actif est dans `UEMOA_SKILL_IDS` (career-compensation-guide, interview-prep, opportunity-publishing, etc.)
- OU le message contient des triggers UEMOA (salaire, FCFA, SMIG, CNPS, CDI, charges, contrat...)

### Contenu du bloc

- FCFA, mobile money (Wave, Orange Money, MTN)
- SMIG par pays (8 pays, valeurs 2025-2026)
- Grilles salariales : CI (20 secteurs x 3 niveaux), SN/BF/BN/TG
- Employeurs cles, universites, hubs/incubateurs par pays
- Cotisations sociales (CNPS, CSS+IPRES, INPS, CNSS)
- Droit du travail (duree, conges, preavis, essai, contrats)

Fichier : `uemoa-knowledge.ts`

---

## 9. Fichiers Cles

| Fichier | Responsabilite |
|---------|----------------|
| `services/copilot/stream/sse.handler.ts` | Boucle agentic, streaming SSE |
| `services/copilot/tools/tool-helper.ts` | defineTool(), AgentConfig, ToolDefinition |
| `services/copilot/agents/talent.agent.ts` | createTalentAgent (study + explore) |
| `services/copilot/agents/organization.agent.ts` | createOrgAgent |
| `services/copilot/guardrails/input.guardrail.ts` | Input safety |
| `services/copilot/guardrails/output.guardrail.ts` | Output validation (log-only) |
| `services/copilot/skills/skill.loader.ts` | Skill detection + loading |
| `services/copilot/uemoa-knowledge.ts` | UEMOA knowledge injection |
| `services/copilot/types.ts` | TalentContext, OrgContext, SSE types |
| `services/ai/models.ts` | Constantes modeles |
| `services/ai/provider.ts` | 3 clients (Anthropic, OpenAI, Gemini) |
| `routes/copilot.ts` | Route principale + endpoints |

---

> **Document cree** : 21 Fevrier 2026 — Reflet de l'architecture reelle (Anthropic SDK natif)
> **Voir aussi** : [COPILOT_TOOLS.md](./COPILOT_TOOLS.md) (reference tools), [COPILOT_PERIMETER.md](./COPILOT_PERIMETER.md) (modes et skills)
