# Documentation des Modèles AI - Etudesk VF

> **Dernière mise à jour:** 6 février 2026
> **Audit réalisé sur:** Backend Etudesk VF

---

## Table des Matières

1. [Résumé Exécutif](#résumé-exécutif)
2. [Architecture AI](#architecture-ai)
3. [Modèles Utilisés](#modèles-utilisés)
   - [GPT-4.1](#gpt-41)
   - [GPT-4.1 Mini](#gpt-41-mini)
   - [GPT-4.1 Nano](#gpt-41-nano)
   - [GPT-4o-mini](#gpt-4o-mini)
   - [GPT-Image-1](#gpt-image-1)
   - [Whisper-1](#whisper-1)
   - [Text-Embedding-3-Small](#text-embedding-3-small)
4. [Mapping Modèles → Services](#mapping-modèles--services)
5. [Guide de Prompting GPT-4.1](#guide-de-prompting-gpt-41)
6. [Estimations de Coûts](#estimations-de-coûts)
7. [Sources](#sources)

---

## Résumé Exécutif

| Modèle | Utilisation | Coût (1M tokens) | Contexte | Latence |
|--------|-------------|------------------|----------|---------|
| **GPT-4.1** | Agents Copilot principaux | $2.00 / $8.00 | 1M tokens | ~0.39s TTFT |
| **GPT-4.1 Mini** | Sub-agents, objectifs quotidiens | $0.40 / $1.60 | 1M tokens | ~50% plus rapide |
| **GPT-4.1 Nano** | Prédictions d'intentions | $0.10 / $0.40 | 1M tokens | Ultra-rapide |
| **GPT-4o-mini** | Génération formulaires, extraction | $0.15 / $0.60 | 128K tokens | Standard |
| **GPT-Image-1** | Génération d'images | $0.02-$0.19/image | N/A | Variable |
| **Whisper-1** | Transcription audio | $0.006/min | 25MB max | 5-10x temps réel |
| **text-embedding-3-small** | Embeddings vectoriels | $0.02/1M tokens | N/A | Rapide |

---

## Architecture AI

```
┌─────────────────────────────────────────────────────────────────────┐
│                        COPILOT ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐    ┌─────────────────┐    ┌────────────────┐  │
│  │  TalentAgent    │    │   OrgAgent      │    │  Intent Agent  │  │
│  │  (GPT-4.1)      │    │  (GPT-4.1)      │    │ (GPT-4.1-nano) │  │
│  └────────┬────────┘    └────────┬────────┘    └────────────────┘  │
│           │                      │                                  │
│           ▼                      ▼                                  │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    SUB-AGENTS (GPT-4.1-mini)                │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │   │
│  │  │ FileReader   │  │ WebSearch    │  │ Daily Objectives │   │   │
│  │  │ Agent        │  │ Agent        │  │ Agent            │   │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                      GENERATION SERVICES                            │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ Space Gen    │  │ Community    │  │ Opportunity  │  GPT-4o-mini │
│  │ Service      │  │ Gen Service  │  │ Gen Service  │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ Bio Gen      │  │ KYC Verif    │  │ Doc Extract  │  GPT-4o-mini │
│  │ (talents.ts) │  │ Service      │  │ Service      │  + Vision    │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                      MEDIA & EMBEDDINGS                             │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ Image Gen    │  │ Transcribe   │  │ Embedding Service        │  │
│  │ GPT-Image-1  │  │ Whisper-1    │  │ text-embedding-3-small   │  │
│  └──────────────┘  └──────────────┘  │ → Pinecone Vector DB     │  │
│                                      └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Modèles Utilisés

### GPT-4.1

> **Rôle:** Agents Copilot principaux (Talent Explorer/Study, Organization Explorer)

#### Spécifications

| Caractéristique | Valeur |
|-----------------|--------|
| **Context Window** | 1,047,576 tokens (1M) |
| **Max Output Tokens** | 32,768 tokens |
| **Knowledge Cutoff** | 1er juin 2024 |
| **Latence TTFT** | ~0.39s (33% plus rapide que GPT-4o) |
| **Latence 128K context** | ~15 secondes |
| **Latence 1M context** | ~1 minute |

#### Pricing (par 1M tokens)

| Type | Coût |
|------|------|
| Input | $2.00 |
| Cached Input | $0.50 |
| Output | $8.00 |

#### Benchmarks

- **SWE-bench Verified:** 54.6%
- **IFEval (instruction compliance):** 87.4%
- Surpasse GPT-4o et GPT-4.5 en coding et multimodal

#### Utilisation dans Etudesk

| Fichier | Service | Description |
|---------|---------|-------------|
| `services/copilot/agents/talent.agent.ts` | `createTalentAgent()` | Agent principal Talent (Explorer + Study modes) |
| `services/copilot/agents/organization.agent.ts` | `createOrgAgent()` | Agent Organisation pour copilot org-scoped |

#### Capacités Clés
- Excellence en suivi d'instructions et tool calling
- Connaissance large multi-domaines
- Support natif de tools/function calling via `@openai/agents` SDK

---

### GPT-4.1 Mini

> **Rôle:** Sub-agents efficaces, génération d'objectifs quotidiens

#### Spécifications

| Caractéristique | Valeur |
|-----------------|--------|
| **Context Window** | 1,047,576 tokens (1M) |
| **Max Output Tokens** | 32,768 tokens |
| **Knowledge Cutoff** | 1er juin 2024 |
| **Latence** | ~50% plus rapide que GPT-4o |
| **Intelligence** | Égale ou supérieure à GPT-4o |

#### Pricing (par 1M tokens)

| Type | Coût |
|------|------|
| Input | $0.40 |
| Cached Input | $0.10 |
| Output | $1.60 |

#### Utilisation dans Etudesk

| Fichier | Service | Description |
|---------|---------|-------------|
| `services/daily-objective.service.ts` | `generateTalentObjective()` | Objectifs quotidiens talents |
| `services/daily-objective.service.ts` | `generateOrganizationObjective()` | Objectifs quotidiens organisations |
| `services/copilot/tools/file-read.tool.ts` | `createFileReaderAgent()` | Analyse de documents (handoff) |
| `services/copilot/tools/web-search.tool.ts` | `webSearchAgent` | Recherche web et synthèse |

---

### GPT-4.1 Nano

> **Rôle:** Prédictions rapides et économiques

#### Spécifications

| Caractéristique | Valeur |
|-----------------|--------|
| **Context Window** | 1,047,576 tokens (1M) |
| **Latence** | Ultra-rapide (<5s pour 128K tokens) |
| **MMLU** | 80.1% |
| **GPQA** | 50.3% |
| **Aider Polyglot Coding** | 9.8% |

#### Pricing (par 1M tokens)

| Type | Coût |
|------|------|
| Input | $0.10 |
| Cached Input | $0.025 |
| Output | $0.40 |

> **Note:** Modèle le moins cher et le plus rapide jamais proposé par OpenAI avec 1M context.

#### Utilisation dans Etudesk

| Fichier | Service | Description |
|---------|---------|-------------|
| `services/ai/agent-factory.ts` | `createIntentSuggestionsAgent()` | Prédiction des intentions utilisateur |

---

### GPT-4o-mini

> **Rôle:** Génération de formulaires, extraction de données, vision

#### Spécifications

| Caractéristique | Valeur |
|-----------------|--------|
| **Context Window** | 128,000 tokens |
| **Max Output Tokens** | 16,384 tokens |
| **Knowledge Cutoff** | Octobre 2023 |
| **Modalités** | Texte + Vision (images) |
| **Date de sortie** | 18 juillet 2024 |

#### Pricing (par 1M tokens)

| Type | Coût |
|------|------|
| Input | $0.15 |
| Output | $0.60 |

> **Note:** 60% moins cher que GPT-3.5 Turbo, ordre de grandeur moins cher que les modèles frontier précédents.

#### Utilisation dans Etudesk

| Fichier | Service | Description |
|---------|---------|-------------|
| `services/ai/agent-factory.ts` | `createSpaceGenAgent()` | Génération formulaire Space |
| `services/ai/agent-factory.ts` | `createCommunityGenAgent()` | Génération formulaire Community |
| `services/ai/agent-factory.ts` | `createOpportunityGenAgent()` | Génération formulaire Opportunity |
| `services/ai/agent-factory.ts` | `createRecommendationAgent()` | Recommandations candidats |
| `services/ai/agent-factory.ts` | `createTitleAgent()` | Titres de sessions |
| `services/ai/agent-factory.ts` | `createSuggestionsAgent()` | Suggestions génériques |
| `services/space-generation.service.ts` | `generateSpaceSuggestion()` | Pré-remplissage formulaire space |
| `services/community-generation.service.ts` | `generateCommunitySuggestion()` | Pré-remplissage formulaire community |
| `services/opportunity-generation.service.ts` | `generateOpportunitySuggestion()` | Pré-remplissage formulaire opportunity |
| `routes/talents.ts` | `POST /api/talents/generate-bio` | Génération de bio |
| `services/kyc-verification.service.ts` | `verifyKYCDocument()` | Vérification KYC (Vision) |
| `services/kyc-verification.service.ts` | `quickCheckDocumentQuality()` | Qualité document (Vision) |
| `services/documents/extraction.service.ts` | `extractDocumentMetadata()` | Extraction métadonnées CV/certificats (Vision) |

---

### GPT-Image-1

> **Rôle:** Génération d'images éducatives, diagrammes, infographies

#### Spécifications

| Caractéristique | Valeur |
|-----------------|--------|
| **Type** | Autorégressif (meilleur rendu texte) |
| **Résolutions** | 1024×1024, 1536×1024, 1024×1536 |
| **Qualités** | Low, Medium, High |
| **Format sortie** | Base64 (pas URL) |

#### Pricing (par image)

| Qualité | Résolution | Coût approx. |
|---------|------------|--------------|
| Low | 1024×1024 | ~$0.02 |
| Medium | 1024×1024 | ~$0.07 |
| High | 1024×1024 | ~$0.19 |

> **Note:** Remplace DALL-E 3 (deprecated mai 2026). Meilleur rendu du texte dans les images.

#### Utilisation dans Etudesk

| Fichier | Service | Description |
|---------|---------|-------------|
| `services/copilot/tools/generate-image.tool.ts` | `generateImageTool` | Génération images via Copilot |

---

### Whisper-1

> **Rôle:** Transcription audio pour input vocal Copilot

#### Spécifications

| Caractéristique | Valeur |
|-----------------|--------|
| **Langues supportées** | 99+ langues |
| **Formats audio** | mp3, mp4, mpeg, mpga, m4a, wav, webm |
| **Taille max fichier** | 25 MB |
| **Vitesse traitement** | 5-10x temps réel |

#### Pricing

| Type | Coût |
|------|------|
| Transcription | $0.006/minute ($0.36/heure) |

> **Note:** Pas de surcharge par langue. Alternatives: GPT-4o Transcribe ($0.006/min), GPT-4o Mini Transcribe ($0.003/min).

#### Utilisation dans Etudesk

| Fichier | Service | Description |
|---------|---------|-------------|
| `routes/copilot.ts` | `POST /api/copilot/transcribe` | Transcription input vocal |

**Configuration:**
```typescript
language: 'fr' // Français par défaut avec auto-detect
```

---

### Text-Embedding-3-Small

> **Rôle:** Embeddings sémantiques pour matching talent-opportunité

#### Spécifications

| Caractéristique | Valeur |
|-----------------|--------|
| **Dimensions par défaut** | 1536 |
| **Dimensions configurables** | Oui (via paramètre `dimensions`) |
| **Stockage** | Pinecone (primaire), PostgreSQL (fallback) |

#### Pricing (par 1M tokens)

| Tier | Coût |
|------|------|
| Standard | $0.02 |
| Batch | $0.01 |

#### Utilisation dans Etudesk

| Fichier | Service | Description |
|---------|---------|-------------|
| `services/embedding.service.ts` | `generateEmbedding()` | Génération embeddings (cache 24h) |
| `services/embedding.service.ts` | `upsertTalentEmbedding()` | Vecteurs profils talents |
| `services/embedding.service.ts` | `upsertOpportunityEmbedding()` | Vecteurs opportunités |
| `services/embedding.service.ts` | `upsertCommunityEmbedding()` | Vecteurs communautés |
| `services/embedding.service.ts` | `upsertSpaceEmbedding()` | Vecteurs espaces |

**Calcul de boost:** Retourne un score de -20 à +20 pour le matching.

---

## Mapping Modèles → Services

### Par Fichier

| Fichier | Modèle(s) |
|---------|-----------|
| `services/copilot/agents/talent.agent.ts` | GPT-4.1 |
| `services/copilot/agents/organization.agent.ts` | GPT-4.1 |
| `services/copilot/tools/file-read.tool.ts` | GPT-4.1 Mini |
| `services/copilot/tools/web-search.tool.ts` | GPT-4.1 Mini |
| `services/copilot/tools/generate-image.tool.ts` | GPT-Image-1 |
| `services/daily-objective.service.ts` | GPT-4.1 Mini |
| `services/ai/agent-factory.ts` | GPT-4o-mini, GPT-4.1 Nano |
| `services/space-generation.service.ts` | GPT-4o-mini |
| `services/community-generation.service.ts` | GPT-4o-mini |
| `services/opportunity-generation.service.ts` | GPT-4o-mini |
| `services/kyc-verification.service.ts` | GPT-4o-mini (Vision) |
| `services/documents/extraction.service.ts` | GPT-4o-mini (Vision) |
| `services/embedding.service.ts` | text-embedding-3-small |
| `routes/copilot.ts` | Whisper-1 |
| `routes/talents.ts` | GPT-4o-mini |

### Par Cas d'Usage

| Cas d'Usage | Modèle Recommandé | Justification |
|-------------|-------------------|---------------|
| Agent conversationnel complexe | GPT-4.1 | Meilleur suivi d'instructions, tool calling |
| Sub-agent / Tâche déléguée | GPT-4.1 Mini | Bon équilibre coût/performance |
| Prédiction rapide | GPT-4.1 Nano | Ultra-rapide, très économique |
| Génération formulaire JSON | GPT-4o-mini | Économique, suffisant pour structured output |
| Analyse vision (documents) | GPT-4o-mini | Support vision natif, économique |
| Génération d'images | GPT-Image-1 | Meilleur rendu texte, autorégressif |
| Transcription audio | Whisper-1 | Standard industrie, multilingue |
| Embeddings sémantiques | text-embedding-3-small | Économique, bonne qualité |

---

## Guide de Prompting GPT-4.1

### Principes Clés

GPT-4.1 est entraîné pour suivre les instructions **plus littéralement** que ses prédécesseurs. Il est hautement dirigeable et réactif aux prompts bien spécifiés.

### Les 3 Instructions Agentiques Essentielles

Pour utiliser pleinement les capacités agentiques de GPT-4.1, incluez ces 3 types de rappels dans tous les prompts d'agent:

#### 1. Persistence
```
Tu dois continuer jusqu'à ce que la requête de l'utilisateur soit complètement résolue.
Ne rends pas le contrôle prématurément.
```

#### 2. Tool-Calling
```
Tu DOIS planifier extensivement avant chaque appel de fonction.
Tu DOIS réfléchir extensivement aux résultats des appels précédents.
Utilise pleinement tes outils - ne devine jamais une réponse.
```

#### 3. Planning & Reflection
```
Avant chaque action, explique ton raisonnement.
Après chaque résultat d'outil, analyse ce que tu as appris.
```

### Structure de Prompt Recommandée

```markdown
# Role
[Description claire du rôle de l'agent]

# Instructions
[Instructions détaillées et explicites]

# Tool Sequencing
1. Utilise d'abord vector_query pour la découverte
2. Utilise sql_query pour les données structurées/personnelles
3. Utilise web_search SEULEMENT si les données internes sont insuffisantes

# Output Format
[Format de sortie attendu avec exemples]

# Context
[Contexte utilisateur injecté dynamiquement]

# Final Reminder
- Ne jamais halluciner - utilise les outils
- Persiste jusqu'à résolution complète
- Réponds en français (ou langue configurée)
```

### Définition des Tools

Pour les outils complexes, créez une section `# Examples` dans le prompt système plutôt que d'ajouter des exemples dans le champ `description` du tool.

### Impact Performance

L'adhérence à ces 3 instructions simples augmente le score SWE-bench Verified de **près de 20%**.

---

## Estimations de Coûts

### Coût par Requête Copilot (Estimé)

| Composant | Tokens estimés | Coût |
|-----------|----------------|------|
| GPT-4.1 (agent principal) | ~2K input, ~1K output | ~$0.012 |
| GPT-4.1 Mini (sub-agent) | ~1K input, ~500 output | ~$0.001 |
| Embedding | ~500 tokens | ~$0.00001 |
| **Total moyen par requête** | | **~$0.013** |

### Coût Mensuel Estimé (par utilisateur actif)

| Usage | Requêtes/mois | Coût estimé |
|-------|---------------|-------------|
| Léger | 50 | ~$0.65 |
| Moyen | 200 | ~$2.60 |
| Intensif | 500 | ~$6.50 |

### Coûts Additionnels

| Service | Unité | Coût |
|---------|-------|------|
| Génération image | par image | $0.02-$0.19 |
| Transcription audio | par minute | $0.006 |
| Objectif quotidien | par génération | ~$0.001 |
| Génération formulaire | par formulaire | ~$0.002 |

---

## Sources

### Documentation Officielle OpenAI
- [GPT-4.1 Model](https://platform.openai.com/docs/models/gpt-4.1)
- [GPT-4.1 Mini Model](https://platform.openai.com/docs/models/gpt-4.1-mini)
- [GPT-4.1 Nano Model](https://platform.openai.com/docs/models/gpt-4.1-nano)
- [GPT-4o-mini Model](https://platform.openai.com/docs/models/gpt-4o-mini)
- [GPT-Image-1 Model](https://platform.openai.com/docs/models/gpt-image-1)
- [Whisper Model](https://platform.openai.com/docs/models/whisper-1)
- [Text-Embedding-3-Small Model](https://platform.openai.com/docs/models/text-embedding-3-small)
- [OpenAI Pricing](https://platform.openai.com/docs/pricing)
- [OpenAI API Pricing](https://openai.com/api/pricing/)

### Guides de Prompting
- [GPT-4.1 Prompting Guide - OpenAI Cookbook](https://cookbook.openai.com/examples/gpt4-1_prompting_guide)
- [Prompt Engineering Best Practices](https://platform.openai.com/docs/guides/prompt-engineering)

### Annonces
- [Introducing GPT-4.1 in the API](https://openai.com/index/gpt-4-1/)
- [GPT-4o mini: Advancing Cost-Efficient Intelligence](https://openai.com/index/gpt-4o-mini-advancing-cost-efficient-intelligence/)
- [Introducing Image Generation API](https://openai.com/index/image-generation-api/)

### Ressources Communautaires
- [GPT-4.1: Benchmarks, Performance, and Migration Guide](https://medium.com/@future_agi/gpt-4-1-benchmarks-performance-and-how-to-safely-migrate-to-production-dc43aadc775f)
- [The Complete Guide to GPT-4.1 - PromptHub](https://www.prompthub.us/blog/the-complete-guide-to-gpt-4-1-models-performance-pricing-and-prompting-tips)

### Calculateurs de Coûts
- [OpenAI Pricing Calculator - Helicone](https://www.helicone.ai/llm-cost/provider/openai/model/gpt-4.1)
- [GPT-4.1 Pricing Calculator - LiveChatAI](https://livechatai.com/gpt-4-1-pricing-calculator)
- [OpenAI Embeddings Pricing Calculator](https://costgoat.com/pricing/openai-embeddings)

---

## Modèles NON Utilisés

Les modèles suivants ne sont **pas** utilisés dans ce projet:
- GPT-4 (remplacé par GPT-4.1)
- GPT-4o (remplacé par GPT-4.1)
- GPT-3.5-turbo (obsolète)
- o1, o3 (reasoning models)
- DALL-E 2/3 (remplacé par GPT-Image-1)

---

*Document généré automatiquement par audit du codebase backend Etudesk VF*
