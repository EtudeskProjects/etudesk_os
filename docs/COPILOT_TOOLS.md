# Copilot Tools Reference — Etudesk OS

> Reference complete des 12 tools du copilot. Source unique pour noms, parametres, modes et intents SQL.
> Mis a jour : 21 Fevrier 2026

---

## Vue d'ensemble

| # | Tool | Modes | Factory | Backend externe |
|---|------|-------|---------|-----------------|
| 1 | `smart_search` | explore, org | non (singleton) | Pinecone + PostgreSQL |
| 2 | `sql_query` | explore, study, org | oui (talentId/orgId) | PostgreSQL |
| 3 | `youtube_search` | study | non (singleton) | YouTube Data API v3 |
| 4 | `analyze_youtube_video` | study | non (singleton) | Gemini 2.5 Flash |
| 5 | `generate_document` | explore, org | oui (talentId, avatarUrl, orgId) | pdfkit, docx, exceljs |
| 6 | `generate_image` | study | non (singleton) | OpenAI gpt-image-1 |
| 7 | `generate_diagram` | study | non (singleton) | aucun (client-side render) |
| 8 | `file_reader` | explore, study, org | oui (talentId ou orgId) | aucun (pdf-parse) |
| 9 | `web_search` | explore, study, org | non (singleton) | OpenAI gpt-4.1-mini |
| 10 | `manage_skills` | study | oui (talentId) | PostgreSQL |
| 11 | `execute_action` | explore, org | oui (talentId) | PostgreSQL |
| 12 | `cv_generation` | explore | oui (talentId, avatarUrl) | Anthropic (sub-agent) |

### Allocation par mode

| Tool | Explorer | Study | Org |
|------|:--------:|:-----:|:---:|
| `smart_search` | x | | x |
| `sql_query` | x (all my_*) | x (4 intents) | x (org_* only) |
| `youtube_search` | | x | |
| `analyze_youtube_video` | | x | |
| `generate_document` | x | | x |
| `generate_image` | | x | |
| `generate_diagram` | | x | |
| `file_reader` | x | x | x |
| `web_search` | x | x | x |
| `manage_skills` | | x | |
| `execute_action` | x | | x |
| `cv_generation` | x | | |

---

## 1. smart_search

Recherche unifiee 3 phases : Pinecone semantic → PostgreSQL enrichment → keyword fallback.

**Fichier :** `smart-search.tool.ts`

### Parametres

```typescript
{
  query: z.string(),
  entity: z.enum(['opportunities', 'communities', 'spaces', 'talents', 'organizations']),
  filters: z.record(z.string(), z.unknown()).optional(),
  limit: z.number().min(1).max(20).default(10),
}
```

### Pipeline

1. **Pinecone semantic** : embedding query → cosine similarity, seuil `> 0.35`. Retry sans filtres si erreur.
2. **PostgreSQL enrichment** : enrichit les IDs Pinecone via JOINs (opportunities +compensation_min/max/currency, talents +top_skills, communities +member_count).
3. **Keyword fallback** : declenche si `< 3` resultats Pinecone. ILIKE sur title/name/description.

**Source labeling** : `semantic` | `keyword` | `hybrid`

**Securite** : `VALID_FILTER_KEYS` whitelist par entity type. Cles inconnues loguees + ignorees.

**Anti-loop** : cache module-level (`_smartSearchCache`). Retourne `_cached: true` sur appels repetes.

**Retour** : `{ results: [{ id, title, summary, type, matchScore, source, ... }], totalFound, _cached? }`

---

## 2. sql_query

Requetes structurees par intent. Pas de SQL arbitraire — chaque intent est une query pre-construite.

**Fichier :** `sql-query.tool.ts`

### Parametres

```typescript
{
  intent: z.enum([...ALL_INTENTS]),
  params: z.record(z.string(), z.unknown()).optional(),
}
```

### Intents personnels (my_*)

| Intent | Disponible en | Description |
|--------|--------------|-------------|
| `my_profile` | explore, study | Profil complet du talent |
| `my_applications` | explore | Candidatures soumises |
| `my_reservations` | explore | Reservations d'espaces |
| `my_invitations` | explore | Invitations recues |
| `my_communities` | explore | Communautes rejointes |
| `my_bookmarks` | explore | Favoris |
| `my_documents` | explore, study | Documents uploades/generes |
| `my_skills` | explore, study | Competences declarees/inferees |
| `my_triggers` | explore, study | Rappels et declencheurs agenda |
| `my_community_feed` | explore, study | Feed d'activites communautes |
| `my_community_members` | explore, study | Membres des communautes rejointes |

**Study mode restreint (4 intents)** : my_profile, my_triggers, my_community_feed, my_community_members

> `my_skills` et `my_documents` sont exclus — ces donnees sont deja injectees dans le system prompt (skills avec niveaux, document IDs dans la section DOCUMENTS).

### Intents organisation (org_*)

| Intent | chart_hint | Description |
|--------|------------|-------------|
| `org_members` | `table` | Membres de l'organisation |
| `org_applications` | `table` | Candidatures recues |
| `org_stats` | — | Stats globales (logo_url, city, country) |
| `org_opportunities` | — | Offres de l'organisation |
| `org_communities` | — | Communautes de l'organisation |
| `org_spaces` | — | Espaces de l'organisation |
| `org_invitations` | — | Invitations envoyees |
| `org_triggers` | — | Rappels agenda organisation |
| `org_documents` | — | Documents organisation |
| `org_talents` | — | Talents ayant interagi |
| `org_talent_profile` | — | Profil detaille d'un talent (4-source interaction check) |
| `org_community_feed` | — | Feed activites communautes org |
| `org_community_members` | — | Membres communautes org |

### Intents analytics (org_*)

| Intent | chart_hint | Description |
|--------|------------|-------------|
| `org_skills_analytics` | `bar` | Distribution competences |
| `org_application_funnel` | `stacked_bar` | Funnel recrutement |
| `org_talent_cohorts` | `bar` | Cohortes talents |
| `org_geo_distribution` | `donut` | Repartition geographique |
| `org_community_engagement` | `table` | Engagement communautaire |
| `org_opportunity_performance` | `table` | Performance offres |

### Intents action (legacy, dans sql_query)

`apply_opportunity`, `join_community`, `book_space`, `create_activity`, `respond_invitation`, `update_application`

### Securite

- `authenticatedTalentId` injecte a la creation (factory), jamais passe par le LLM
- `authorizedOrgIds` limite l'acces aux orgs du user
- `allowedIntents` restreint les intents par mode
- `org_talent_profile` : verification interaction 4 sources avant exposition

**Anti-loop** : cache instance-level (`resultCache` + `callCounts`). Retourne `_cached: true` sur appels repetes.

---

## 3. youtube_search

Recherche de videos pedagogiques via YouTube Data API v3.

**Fichier :** `youtube-search.tool.ts`

### Parametres

```typescript
{
  query: z.string(),
  maxResults: z.number().min(1).max(5).default(5),
}
```

**Retour** : jusqu'a 5 videos avec `videoId`, `title`, `description` (200 chars), `channelName`, `thumbnailUrl`, `url`.

**Regle agent** : presenter UN seul resultat comme bloc `youtube`. NE PAS appeler `analyze_youtube_video` apres.

---

## 4. analyze_youtube_video

Analyse pedagogique de videos YouTube via Gemini 2.5 Flash.

**Fichier :** `youtube-analyze.tool.ts`

### Parametres

```typescript
{
  urls: z.array(z.string()).min(1).max(3),
  focusTopics: z.string().optional(),
  language: z.enum(['fr', 'en']).default('fr'),
}
```

Analyse 1-3 URLs en parallele. Si multiples, scoring (relevance 40%, pedagogical clarity 30%, production quality 30%).

**Retour** : `bestVideoId`, `resume`, `concepts_cles[]`, `moments_importants[]`, `niveau`, `competences[]`, `elements_visuels[]`

---

## 5. generate_document

Generation de documents multi-format avec sauvegarde automatique.

**Fichier :** `generate-document.tool.ts`

### Parametres

```typescript
{
  format: z.string().default('PDF'),   // PDF | DOCX | XLS | CSV | TXT
  title: z.string(),
  contentJson: z.union([z.string(), z.record(z.string(), z.unknown())]),
  instructions: z.string().optional(),
}
```

### Routage PDF

| Detection | Fonction | Description |
|-----------|----------|-------------|
| `isCVContent()` | `generateCVPDF()` | CV avec layout 2 colonnes + avatar |
| `isOrgDocumentContent()` | `generateOrgDocumentPDF()` | PDF brande org (logo header + sections + footer) |
| Defaut | `generatePDF()` | Sections generiques ou tableau |

### Stockage

- Org docs → `documents/org/{orgId}/` → table `organization_documents`
- Talent docs → `documents/{talentId}/` → table `talent_documents` + extraction pipeline

---

## 6. generate_image

Generation d'images via OpenAI gpt-image-1. **Async fire-and-forget** — retourne immediatement.

**Fichier :** `generate-image.tool.ts`

### Parametres

```typescript
{
  prompt: z.string(),
  size: z.string().default('1024x1024'),     // '1024x1024' | '1536x1024' | '1024x1536'
  quality: z.string().default('medium'),     // 'low' | 'medium' | 'high'
}
```

**Retour immediat** : `{ status: 'processing', job_id }`. L'agent doit generer un bloc `image` placeholder. L'image est uploadee en `generated/` en background.

---

## 7. generate_diagram

Generation de diagrammes Mermaid. **Rendu client-side uniquement** (pas d'API externe).

**Fichier :** `generate-diagram.tool.ts`

### Parametres

```typescript
{
  title: z.string(),
  diagramType: z.string(),   // flowchart | sequenceDiagram | classDiagram | mindmap | timeline | gantt | pie | erDiagram
  mermaidCode: z.string(),
}
```

Validation et sanitization server-side : normalise case, corrige `<br/>` → `\n`, echappe `()` dans `[]`, supprime null bytes.

**Retour** : `{ mermaidCode, renderHint: 'client-side' }`. App mobile rend via WebView + mermaid.js.

---

## 8. file_reader

Lecture directe d'un document. **PAS un sub-agent** — tool direct avec `defineTool()`.

**Fichier :** `file-read.tool.ts`

### Parametres

```typescript
{ documentId: z.string() }   // UN seul UUID
```

### Deux factories

| Factory | Scope | Acces |
|---------|-------|-------|
| `createFileReaderTool(talentId)` | Talent | Documents du talent uniquement |
| `createOrgFileReaderTool(orgId)` | Org | Documents org + documents talents avec interaction verifiee |

### Formats supportes

| Type MIME | Extraction |
|-----------|------------|
| `text/*`, `application/json`, `application/xml` | Texte brut |
| `application/pdf` | pdf-parse → texte |
| `image/*` | Metadonnees uniquement |
| Autre binaire | Metadonnees uniquement |

**Securite** : validation UUID, protection IDOR via factory injection. Cache par session (talent version).

---

## 9. web_search

Recherche web via OpenAI Responses API.

**Fichier :** `web-search.tool.ts`

### Parametres

```typescript
{ query: z.string() }
```

Delegue a un sub-agent OpenAI (`@openai/agents` Runner, gpt-4.1-mini) avec `webSearchTool()` HostedTool. Instructions biaisees UEMOA/Afrique francophone.

---

## 10. manage_skills

Gestion des competences du talent (ajout/mise a jour).

**Fichier :** `manage-skills.tool.ts`

### Parametres

```typescript
{
  action: z.string(),            // 'add' | 'update'
  skillName: z.string(),
  proficiencyLevel: z.string(),  // BEGINNER | INTERMEDIATE | EXPERT | MASTER
  origin: z.string(),            // declared | inferred | extracted
  type: z.string(),              // HARD_SKILL | SOFT_SKILL | KNOWLEDGE
}
```

**Logique** :
- `add` : verification doublon (case-insensitive, smart merge si nouveau niveau superieur), limite 100 skills
- `update` : met a jour level + is_visible
- Normalisation automatique des enums (uppercase/lowercase)

**Interdit** : suppression (pas d'action `remove`)

---

## 11. execute_action

Actions de mutation avec confirmation.

**Fichier :** `execute-action.tool.ts`

### Parametres

```typescript
{
  action: z.enum([
    'apply_opportunity',
    'join_community',
    'book_space',
    'accept_invitation',
    'decline_invitation',
    'create_agenda_trigger',
    'update_agenda_trigger',
  ]),
  entityId: z.string().optional().default(''),
  dataJson: z.union([z.string(), z.record(z.string(), z.unknown())]).default(''),
}
```

### Actions

| Action | Validation | Resultat |
|--------|-----------|----------|
| `apply_opportunity` | Offre OPEN, pas doublon, deadline ok | Insert `opportunity_applications` |
| `join_community` | Communaute ACTIVE, pas deja membre | Insert `community_members` |
| `book_space` | Espace ACTIVE, creneau libre, calcul prix | Insert `space_bookings` |
| `accept_invitation` | Invitation PENDING pour ce talent | Update statut + create membership |
| `decline_invitation` | Invitation PENDING | Update statut |
| `create_agenda_trigger` | Scope TALENT ou ORGANIZATION | Insert `agenda_triggers` |
| `update_agenda_trigger` | Trigger exists, owned | Update `agenda_triggers` |

---

## 12. cv_generation

Sub-agent complet pour generation de CV. Boucle agentic interne avec timeout.

**Fichier :** `cv-generation.tool.ts`

### Parametres

```typescript
{ request: z.string() }
```

**Implementation** : sub-agent Claude (MODEL_AGENT, claude-sonnet-4-6) avec sa propre boucle agentic (jusqu'a 5 iterations). Timeout 30s via AbortController. A acces a `sql_query`, `file_reader`, `generate_document`. Retourne un bloc `entity:document` avec l'ID du CV genere.

---

## Securite — Pattern IDOR

7 tools utilisent le pattern **factory avec injection de `authenticatedTalentId`** :

```
createSqlQueryTool(talentId, authorizedOrgIds?, allowedIntents?)
createExecuteActionTool(talentId)
createManageSkillsTool(talentId)
createGenerateDocumentTool(talentId, avatarUrl?, orgId?)
createFileReaderTool(talentId)
createOrgFileReaderTool(orgId)
createCvGenerationTool(talentId, avatarUrl?)
```

5 tools static (pas de factory) : `smartSearchTool`, `youtubeSearchTool`, `analyzeYoutubeVideoTool`, `generateImageTool`, `generateDiagramTool`, `webSearchAsTool`

**Garanties** : l'agent ne peut pas usurper un autre user, les queries sont filtrees par talentId, les org_* verifient le membership.

---

> **Document cree** : 21 Fevrier 2026
> **Voir aussi** : [COPILOT_ARCHITECTURE.md](./COPILOT_ARCHITECTURE.md) (boucle agentic), [COPILOT_PERIMETER.md](./COPILOT_PERIMETER.md) (modes et examples)
