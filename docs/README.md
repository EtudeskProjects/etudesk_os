# Etudesk Documentation

> Documentation technique centralisée du projet Etudesk

---

## Index

| Document | Description | Taille |
|----------|-------------|--------|
| [ontology.md](./ontology.md) | Ontologie plateforme (entités, relations, permissions, règles métier) | 37KB |
| [COPILOT_AGENT_ARCHITECTURE.md](./COPILOT_AGENT_ARCHITECTURE.md) | **Architecture complète des agents copilot (prompts, tools, context, SSE)** | 25KB |
| [COPILOT_AGENT_PERIMETER.md](./COPILOT_AGENT_PERIMETER.md) | **Périmètre complet: 20 exemples, CV workflow, confirmation actions, UEMOA** | 46KB |
| [COPILOT_TOOLS_DOCUMENTATION.md](./COPILOT_TOOLS_DOCUMENTATION.md) | Documentation des 8 tools copilot avec tests réels et métriques | 15KB |
| [AI_MODELS_DOCUMENTATION.md](./AI_MODELS_DOCUMENTATION.md) | Specs des modèles OpenAI (GPT-4.1, image, embedding, whisper) | 22KB |
| [OPENAI_AGENTS_SDK_DOCUMENTATION.md](./OPENAI_AGENTS_SDK_DOCUMENTATION.md) | SDK Agents TypeScript (tools, handoffs, memory, streaming) | 11KB |
| [AI_AGENT_DESIGN_GUIDE.md](./AI_AGENT_DESIGN_GUIDE.md) | Guide de conception d'agents IA (best practices) | 9KB |

---

## Architecture IA

```
┌─────────────────────────────────────────────────────────────────┐
│                     COPILOT ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │ TalentAgent │    │ TalentAgent │    │  OrgAgent   │         │
│  │  (explore)  │    │   (study)   │    │             │         │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘         │
│         │                  │                  │                 │
│         └──────────────────┼──────────────────┘                 │
│                            │                                    │
│                   ┌────────┴────────┐                           │
│                   │     TOOLS       │                           │
│                   ├─────────────────┤                           │
│                   │ • vector_query  │ ← Pinecone                │
│                   │ • sql_query     │ ← PostgreSQL              │
│                   │ • youtube_search│                           │
│                   │ • generate_doc  │                           │
│                   │ • generate_image│ ← gpt-image-1             │
│                   │ • generate_diag │                           │
│                   └────────┬────────┘                           │
│                            │                                    │
│                   ┌────────┴────────┐                           │
│                   │    HANDOFFS     │                           │
│                   ├─────────────────┤                           │
│                   │ • FileReader    │ ← gpt-4.1-mini            │
│                   │ • WebSearch     │ ← gpt-4.1-mini            │
│                   └─────────────────┘                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Modèles Utilisés

| Modèle | Usage | Context |
|--------|-------|---------|
| **gpt-4.1** | Agents principaux (Talent, Org) | 1M tokens |
| **gpt-4.1-mini** | Sub-agents (FileReader, WebSearch) | 1M tokens |
| **gpt-4.1-nano** | Classification rapide, safety | 1M tokens |
| **gpt-4o-mini** | Génération prompts, summaries | 128K tokens |
| **gpt-image-1** | Génération d'images | — |
| **whisper-1** | Transcription audio | — |
| **text-embedding-3-small** | Embeddings vectoriels | 8K tokens |

---

## Ontologie — Résumé

### Entités Principales

| Classe | Description |
|--------|-------------|
| `Talent` | Utilisateur individuel |
| `Organization` | Entité légale (entreprise, startup, ONG) |
| `Community` | Groupe de talents |
| `Opportunity` | Offre (job, stage, freelance) |
| `Space` | Lieu réservable |
| `TalentDocument` | Fichier du talent (CV, diplôme) |
| `Publication` | Activité communautaire (post, event, poll) |

### Relations Clés

| Relation | De → Vers |
|----------|-----------|
| `Membership` | Talent → Community |
| `OrgMembership` | Talent → Organization |
| `Application` | Talent → Opportunity |
| `Booking` | Talent → Space |
| `Subscription` | Talent → Community (payante) |

→ Voir [ontology.md](./ontology.md) pour la version complète

---

## Références Rapides

### Tool Sequencing (Copilot)

```
1. vector_query   ← Discovery (Pinecone)
2. sql_query      ← Données structurées/personnelles
3. web_search     ← SEULEMENT si interne insuffisant
```

### Memory Layers

```
State Management → Memory Injection → Memory Distillation → Memory Consolidation
```

### GPT-4.1 Prompting

- Instructions explicites (pas d'inférence implicite)
- 3 instructions agentiques: persistence, tool-calling, planning
- Role → Instructions → Tool Sequencing → Output Format → Ontology → Context
