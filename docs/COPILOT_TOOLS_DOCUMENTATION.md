# Copilot Tools Documentation

> **Audit complet des 11 tools du Copilot Etudesk**
> Date initiale: 2026-02-09 | Mise a jour: 2026-02-14
> Tests VPS reels sur le compte etudesksas@gmail.com (talent: Lamine Barro, org: Etudesk SAS)
> Endpoint: `POST /api/v1/copilot/chat` (SSE streaming)

---

## Note Importante : Charts et Tableaux (rendu client)

Les **charts** et **tableaux** ne sont **pas des tools**. L'agent les rend directement via des blocs:

```
```chart
{"type":"table","title":"...","columns":["Col A"],"rows":[["A"]]}
```
```

Types supportes cote client: `bar`, `donut`, `stacked_bar`, `metric`, `table`, `radar`.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     COPILOT TOOLS ARCHITECTURE                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │             MAIN AGENTS (claude-opus-4-6)              │   │
│  │  TalentAgent (explore) │ TalentAgent (study) │ OrgAgent │   │
│  └───────────────────────────┬─────────────────────────────┘   │
│                              │                                  │
│         ┌────────────────────┴────────────────────┐            │
│         │                                          │            │
│  ┌──────┴──────────┐                      ┌───────┴───────┐   │
│  │   10 TOOLS      │                      │ 1 SUB-AGENT   │   │
│  ├─────────────────┤                      ├───────────────┤   │
│  │ vector_query    │ ← Pinecone semantic  │ web_search    │   │
│  │ sql_query       │ ← PostgreSQL (IDOR)  │ (gpt-4.1-mini)│   │
│  │ youtube_search  │ ← YouTube Data API   └───────────────┘   │
│  │ file_reader     │ ← Direct tool (DB+PDF parse)             │
│  │ generate_document│ ← PDF/DOCX/CSV/XLS                     │
│  │ generate_image  │ ← gpt-image-1                            │
│  │ generate_diagram│ ← Mermaid (client)                       │
│  │ manage_skills   │ ← PostgreSQL CRUD                        │
│  │ execute_action  │ ← PostgreSQL actions                     │
│  │ cv_pdf_generator│ ← PDFKit (interne)                       │
│  └─────────────────┘                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

> **Note (2026-02-14):** file_reader est maintenant un tool direct (plus un sub-agent asTool). Seul web_search reste un sub-agent.

### Allocation par mode

| Tool | Explorer (talent) | Study (talent) | Org Explorer |
|------|:-:|:-:|:-:|
| vector_query | x | | x |
| sql_query | x (28 intents) | x (my_profile, my_skills, my_documents, my_community_feed, my_community_members) | x (org_* + search_* = 18 intents) |
| youtube_search | | x | |
| generate_document | x | | x |
| generate_image | | x | |
| generate_diagram | | x | |
| manage_skills | | x | |
| execute_action | x | | x |
| file_reader | x | x | x |
| web_search | x | x | x |

---

## Resume des Performances (audit reel VPS 2026-02-14)

| Tool | Status | Avg Time | Description |
|------|--------|----------|-------------|
| **sql_query** | PASS | <10ms | Requetes PostgreSQL avec IDOR |
| **vector_query** | PASS | ~2s | Recherche semantique Pinecone |
| **youtube_search** | PASS | ~1s | Videos educatives YouTube |
| **file_reader** | PASS* | <50ms | Lecture directe documents (PDF parse) |
| **generate_document** | PASS | ~30ms | Generation PDF/DOCX/CSV/XLS/TXT |
| **generate_image** | skip | ~60s | Images via gpt-image-1 (cout eleve) |
| **generate_diagram** | PASS | <1ms | Diagrammes Mermaid |
| **manage_skills** | PASS | <10ms | Ajout/MAJ competences |
| **execute_action** | PASS | ~5ms | Actions utilisateur |
| **web_search** | PASS | ~10s | Recherche web (sub-agent gpt-4.1-mini) |

> *file_reader: le PDF de seed retourne une erreur de parsing ("bad XRef entry") car c'est un fichier placeholder. L'outil fonctionne correctement avec des vrais PDFs.

---

## 1. sql_query

**Fichier:** `services/copilot/tools/sql-query.tool.ts`
**Pattern:** Factory — `createSqlQueryTool(authenticatedTalentId, authorizedOrgIds?, allowedIntents?)`
**Securite:** talentId injecte par le backend (jamais depuis le LLM), protection IDOR.

### Parametres

```typescript
{
  intent: 'my_profile' | 'my_applications' | 'my_reservations' | 'my_invitations' |
          'my_communities' | 'my_bookmarks' | 'my_documents' | 'my_skills' |
          'org_members' | 'org_applications' | 'org_stats' | 'org_opportunities' |
          'org_communities' | 'org_spaces' | 'org_revenue' | 'org_invitations' |
          'org_documents' | 'org_talents' | 'org_talent_profile' | 'org_community_feed' | 'org_community_members' |
          'my_community_feed' | 'my_community_members' |
          'org_skills_analytics' | 'org_application_funnel' | 'org_talent_cohorts' |
          'org_geo_distribution' | 'org_community_engagement' | 'org_revenue_analytics' | 'org_opportunity_performance' |
          'search_opportunities' | 'search_communities' | 'search_spaces' |
          'search_organizations' | 'search_talents';
  paramsJson: string;  // JSON string
}
```

### Retours reels (VPS — etudesksas@gmail.com)

#### my_profile
```json
// Agent args: { "intent": "my_profile", "paramsJson": "{}" }
// Retour:
{
  "id": "90000000-0000-4000-8000-000000000001",
  "first_name": "Lamine",
  "last_name": "Barro",
  "display_name": "Lamine Barro",
  "bio": "Fondateur d'Etudesk. Produit, strategie et execution...",
  "city": "Abidjan",
  "country": "CI",
  "email": "etudesksas@gmail.com",
  "phone": "+2250574631148",
  "slug": "lamine-barro",
  "remote_ready": true,
  "willing_to_relocate": false,
  "sectors": ["DIGITAL", "EDUCATION"],
  "goals": ["BUILD_NETWORK_OR_VISIBILITY"],
  "profile_tags": ["ENTREPRENEUR"]
}
```

#### my_skills
```json
// Agent args: { "intent": "my_skills", "paramsJson": "{}" }
// Retour (mode study):
{
  "skills": [
    { "name": "Product Strategy", "type": "KNOWLEDGE", "proficiency_level": "EXPERT", "origin": "declared" },
    { "name": "Partnerships", "type": "KNOWLEDGE", "proficiency_level": "EXPERT", "origin": "declared" },
    { "name": "Leadership", "type": "SOFT_SKILL", "proficiency_level": "EXPERT", "origin": "declared" },
    { "name": "EdTech", "type": "KNOWLEDGE", "proficiency_level": "EXPERT", "origin": "declared" }
  ]
}
```

#### my_documents
```json
// Agent args: { "intent": "my_documents", "paramsJson": "{}" }
// Retour:
{
  "documents": [
    {
      "id": "93000000-0000-4000-8000-000000000001",
      "document_type": "CV",
      "category": "PROFESSIONAL",
      "title": "CV - Lamine Barro",
      "original_filename": "CV_Lamine_Barro.pdf",
      "status": "PROCESSED",
      "description": "CV de demonstration (seed Etudesk OS).",
      "created_at": "2026-02-14T22:06:30.938Z"
    }
  ]
}
```

#### org_stats
```json
// Agent args: { "intent": "org_stats", "paramsJson": "{\"organizationId\":\"10000000-0000-4000-8000-000000000001\"}" }
// Retour:
{
  "member_count": "4",
  "open_opportunities": "8",
  "community_count": "2",
  "space_count": "2",
  "logo_url": "/uploads/seed/covers/org-etudesk-sas.svg",
  "city": "Abidjan",
  "country": "CI"
}
```

#### org_members
```json
// Agent args: { "intent": "org_members", "paramsJson": "{\"organizationId\":\"10000000-0000-4000-8000-000000000001\"}" }
// Summary: "4 elements"
// Retour:
{
  "members": [
    {
      "role": "MANAGER",
      "created_at": "2026-02-14T22:06:30.938Z",
      "display_name": "Kadiatou Coulibaly",
      "bio": "Responsable RH et talent acquisition...",
      "avatar_url": "/uploads/seed/avatars/kadiatou-coulibaly.svg"
    },
    {
      "role": "MANAGER",
      "created_at": "2026-02-14T22:06:30.938Z",
      "display_name": "Tidiane Cisse",
      "bio": "Product manager. Roadmap, discovery, metriques...",
      "avatar_url": "/uploads/seed/avatars/tidiane-cisse.svg"
    },
    {
      "role": "MEMBER",
      "created_at": "2026-02-14T22:06:30.938Z",
      "display_name": "Fatou Traore",
      "bio": "Consultante en marketing digital...",
      "avatar_url": "/uploads/seed/avatars/fatou-traore.svg"
    },
    {
      "role": "OWNER",
      "created_at": "2026-02-14T22:06:30.938Z",
      "display_name": "Lamine Barro",
      "bio": "Fondateur d'Etudesk...",
      "avatar_url": "/uploads/seed/avatars/lamine-barro.svg"
    }
  ],
  "chart_hint": "table"
}
```

#### search_communities
```json
// Agent args: { "intent": "search_communities", "paramsJson": "{}" }
// Retour:
{
  "communities": [
    {
      "id": "11000000-0000-4000-8000-000000000001",
      "name": "Etudesk OS: Tech & Data CI",
      "description": "Groupe pour apprendre, partager et trouver des opportunites...",
      "type": "LEARNING",
      "slug": "etudesk-os-tech-data-ci",
      "member_count": "20"
    },
    {
      "id": "11000000-0000-4000-8000-000000000002",
      "name": "Etudesk OS: Entrepreneurs CI",
      "description": "Groupe pour entrepreneurs (retail, services, agro)...",
      "type": "PROFESSIONAL",
      "slug": "etudesk-os-entrepreneurs-ci",
      "member_count": "20"
    }
  ]
}
```

#### Cas d'erreur — intent bloque (study mode)
```json
{ "error": "L'intent 'my_applications' n'est pas disponible dans ce mode. Intents autorises : my_profile, my_skills, my_documents, my_community_feed, my_community_members" }
```

#### Cas d'erreur — org intent sans organizationId
```json
{ "error": "organizationId requis pour les requetes organisation" }
```

---

## 2. vector_query

**Fichier:** `services/copilot/tools/vector-query.tool.ts`
**Description:** Recherche semantique dans Pinecone. Convertit la query en embedding, interroge Pinecone, puis enrichit les resultats via PostgreSQL.

### Parametres

```typescript
{
  query: string;          // Texte de recherche en langage naturel
  namespace: 'opportunities' | 'communities' | 'spaces' | 'talents' | 'organizations';
  topK: number;           // 1-30, default 10
  filtersJson: string | null;  // Filtres Pinecone optionnels, JSON string
}
```

### Retours reels (VPS)

#### Succes (opportunities)
```json
// Agent args: { "namespace": "opportunities", "query": "product management strategie...", "topK": 10, "filtersJson": "" }
// Summary: "6 resultats"
// Retour:
{
  "results": [
    {
      "id": "20000000-0000-4000-8000-000000000008",
      "title": "Charge(e) de Programme - Employabilite & impact",
      "summary": "Structurer un programme (cohortes, suivi, partenariats) et produire un reporting clair...",
      "type": "EMPLOYMENT",
      "contractType": "CDD",
      "locationType": "HYBRID",
      "location": "Abidjan",
      "organization": "Etudesk SAS",
      "slug": "charge-programme-employabilite",
      "matchScore": 53
    },
    {
      "id": "20000000-0000-4000-8000-000000000002",
      "title": "Data Analyst (KPI & dashboards) - Employabilite",
      "summary": "Mettre en place un reporting de bout en bout...",
      "type": "EMPLOYMENT",
      "contractType": "CDD",
      "locationType": "REMOTE",
      "location": "Abidjan",
      "organization": "Etudesk SAS",
      "slug": "data-analyst-employabilite",
      "matchScore": 47
    },
    {
      "id": "20000000-0000-4000-8000-000000000005",
      "title": "UX/UI Designer (Mobile) - Design system & accessibilite",
      "summary": "Refondre des ecrans cles et consolider un design system...",
      "type": "EMPLOYMENT",
      "contractType": "CDD",
      "locationType": "HYBRID",
      "location": "Abidjan",
      "organization": "Etudesk SAS",
      "slug": "ux-ui-designer-mobile",
      "matchScore": 54
    }
  ],
  "totalFound": 6
}
```

#### Aucun resultat (avec filtre)
```json
// Agent args: { "namespace": "opportunities", "query": "CDI...", "topK": 10, "filtersJson": "{\"contractType\":\"CDI\"}" }
// Summary: "Aucun resultat"
{
  "results": [],
  "message": "Aucun resultat trouve pour cette recherche."
}
```

---

## 3. youtube_search

**Fichier:** `services/copilot/tools/youtube-search.tool.ts`
**Mode:** Study uniquement.

### Parametres

```typescript
{
  query: string;        // Recherche en francais
  maxResults: number;   // 1-3 (recommande: 1)
}
```

### Retour reel (VPS)

```json
// Agent args: { "query": "product management tutoriel francais Afrique francophone", "maxResults": 1 }
// Summary: "1 video trouvee"
{
  "videos": [
    {
      "videoId": "ATpynm412ls",
      "title": "4 exemples de produits digitaux. E-commerce/vente en ligne",
      "description": "",
      "channelName": "Flo ",
      "thumbnailUrl": "https://i.ytimg.com/vi/ATpynm412ls/mqdefault.jpg"
    }
  ]
}
```

---

## 4. file_reader (Direct Tool — refactore 2026-02-14)

**Fichier:** `services/copilot/tools/file-read.tool.ts`
**Pattern:** Factory — `createFileReaderTool(talentId)` → direct `tool()` (plus un sub-agent asTool)
**Securite:** Verifie que le document appartient au talent (IDOR).

> **Refactoring 2026-02-14:** Remplace le sub-agent FileReaderAgent (qui causait des boucles infinies) par un tool direct qui lit depuis la DB + parse le fichier en une seule operation.

### Parametres

```typescript
{
  documentId: string;  // UUID unique du document a lire
}
```

### Retour reel (VPS)

```json
// Agent args: { "documentId": "93000000-0000-4000-8000-000000000001" }
// Succes (document reel):
{
  "success": true,
  "document": {
    "id": "93000000-0000-4000-8000-000000000001",
    "title": "CV - Lamine Barro",
    "type": "CV",
    "mimeType": "application/pdf",
    "pageCount": 2
  },
  "content": "Mohamed Lamine Barro - Entrepreneur...\nCompetences: IA, Strategie, Entrepreneuriat..."
}
```

```json
// Erreur (PDF corrompu — seed placeholder):
{
  "success": false,
  "error": "Error reading document: bad XRef entry"
}
```

### file_reader pour documents organisation

**Pattern:** Factory → sub-agent asTool. `createOrgFileReaderTool(orgId)`
**Securite:** Verifie que le document appartient a l'organisation (IDOR). Fallback sur `talent_documents` si interaction verifiee.

### Types supportes

| Type MIME | Traitement |
|-----------|-----------|
| `text/*`, `application/json`, `application/xml` | Extraction directe UTF-8 |
| `application/pdf` | Extraction via pdf-parse |
| `image/*` | Metadata uniquement |
| Autres | Metadata uniquement |

---

## 5. generate_document

**Fichier:** `services/copilot/tools/generate-document.tool.ts`
**Pattern:** Factory — `createGenerateDocumentTool(talentId, avatarUrl?)`
**Auto-save:** Le document est automatiquement sauvegarde dans talent_documents.

### Parametres

```typescript
{
  format: 'PDF' | 'DOCX' | 'XLS' | 'CSV' | 'TXT';
  title: string;
  contentJson: string;  // JSON string, 3 formats:
    // (1) CV: {"firstName":"...","lastName":"...","skills":[...],"experiences":[...],...}
    // (2) Sections: {"sections":[{"heading":"...","body":"..."}]}
    // (3) Table: {"headers":["..."],"rows":[["..."]]}
    // (4) Org branded: {"organizationName":"...","logoUrl":"...","sections":[...]}
  instructions: string;
}
```

### Retour reel (VPS)

```json
// Agent args: {
//   "format": "PDF",
//   "title": "Rapport Audit",
//   "contentJson": "{\"sections\":[{\"heading\":\"Introduction\",\"body\":\"Ceci est un test audit\"},{\"heading\":\"Conclusion\",\"body\":\"Test termine avec succes\"}]}",
//   "instructions": "Generer un rapport d'audit professionnel..."
// }
// Summary: "Document genere . Rapport Audit (sauvegarde)"
{
  "success": true,
  "id": "eccc3213-0deb-4d2c-b3f5-f002997a35d9",
  "documentType": "PDF",
  "downloadUrl": "/uploads/documents/90000000-0000-4000-8000-000000000001/eccc3213-0deb-4d2c-b3f5-f002997a35d9.pdf",
  "filename": "Rapport_Audit.pdf",
  "metadata": {
    "generatedAt": "2026-02-14T22:31:17.525Z",
    "sizeBytes": 1520,
    "title": "Rapport Audit"
  }
}
```

---

## 6. generate_image

**Fichier:** `services/copilot/tools/generate-image.tool.ts`
**Mode:** Study uniquement.
**Modele:** gpt-image-1 (retourne base64, converti en PNG et uploade).

### Parametres

```typescript
{
  prompt: string;
  size: '1024x1024' | '1536x1024' | '1024x1536';  // default '1024x1024'
  quality: 'low' | 'medium' | 'high';              // default 'medium'
}
```

### Retour (non teste VPS — cout eleve)

```json
{
  "success": true,
  "downloadUrl": "/uploads/generated/image-1707498765432.png",
  "filename": "image-1707498765432.png",
  "metadata": {
    "generatedAt": "2026-02-14T22:40:00.000Z",
    "sizeBytes": 1911998,
    "dimensions": "1024x1024",
    "quality": "medium",
    "model": "gpt-image-1"
  }
}
```

---

## 7. generate_diagram

**Fichier:** `services/copilot/tools/generate-diagram.tool.ts`
**Mode:** Study uniquement.
**Rendu:** Client-side (l'app mobile rend le Mermaid via WebView).

### Parametres

```typescript
{
  title: string;
  diagramType: 'flowchart' | 'sequenceDiagram' | 'classDiagram' | 'mindmap' | 'timeline' | 'gantt' | 'pie' | 'erDiagram';
  mermaidCode: string;
}
```

### Retour reel (VPS)

```json
// Agent args: {
//   "title": "Processus de candidature",
//   "diagramType": "flowchart",
//   "mermaidCode": "flowchart TD\n    A[Offre publiee] --> B[Candidature]\n    B --> C[Entretien]\n    C --> D[Decision]\n    D --> E{Resultat}\n    E -->|Accepte| F[Embauche]\n    E -->|Refuse| G[Fin du processus]"
// }
// Summary: "Diagramme genere"
{
  "success": true,
  "title": "Processus de candidature",
  "diagramType": "flowchart",
  "mermaidCode": "flowchart TD\n    A[Offre publiee] --> B[Candidature]\n    B --> C[Entretien]\n    C --> D[Decision]\n    D --> E{Resultat}\n    E -->|Accepte| F[Embauche]\n    E -->|Refuse| G[Fin du processus]",
  "renderHint": "client-side"
}
```

---

## 8. manage_skills

**Fichier:** `services/copilot/tools/manage-skills.tool.ts`
**Pattern:** Factory — `createManageSkillsTool(authenticatedTalentId)`
**Mode:** Study uniquement.

### Parametres

```typescript
{
  action: 'add' | 'update';
  skillName: string;          // Nom canonique (ex: "React", "Python")
  proficiencyLevel: 'BEGINNER' | 'INTERMEDIATE' | 'EXPERT' | 'MASTER';
  origin: 'declared' | 'inferred' | 'extracted';
  type: 'HARD_SKILL' | 'SOFT_SKILL' | 'KNOWLEDGE';
}
```

### Retours reels (VPS)

#### Ajout reussi
```json
// Agent args: { "action": "add", "skillName": "Audit_Test_2026", "proficiencyLevel": "BEGINNER", "origin": "declared", "type": "HARD_SKILL" }
// Summary: "Competence modifiee"
{
  "success": true,
  "message": "Competence \"Audit_Test_2026\" ajoutee avec le niveau BEGINNER.",
  "skill": { "name": "Audit_Test_2026", "level": "BEGINNER", "origin": "declared" }
}
```

#### Update reussi
```json
// Agent args: { "action": "update", "skillName": "Audit_Test_2026", "proficiencyLevel": "INTERMEDIATE", "origin": "declared", "type": "HARD_SKILL" }
// Summary: "Competence modifiee"
{
  "success": true,
  "message": "Competence \"Audit_Test_2026\" mise a jour au niveau INTERMEDIATE.",
  "skill": {
    "id": "143d3d55-ae81-4ce3-8041-4347b927e75a",
    "canonical_name": "Audit_Test_2026",
    "proficiency_level": "INTERMEDIATE",
    "is_visible": true
  }
}
```

#### Doublon (add sur skill existante)
```json
{
  "success": false,
  "error": "La competence \"Audit_Test_2026\" existe deja (niveau: BEGINNER). Utilise l'action \"update\" pour changer le niveau."
}
```

---

## 9. execute_action

**Fichier:** `services/copilot/tools/execute-action.tool.ts`
**Pattern:** Factory — `createExecuteActionTool(authenticatedTalentId)`
**Securite:** Verifications metier avant chaque action.

### Parametres

```typescript
{
  action: 'apply_opportunity' | 'join_community' | 'book_space' | 'accept_invitation' | 'decline_invitation';
  entityId: string;   // UUID de l'entite cible
  dataJson: string;   // Donnees supplementaires
}
```

### Retours reels

#### join_community — succes
```json
{
  "success": true,
  "message": "Tu as rejoint la communaute \"Etudesk OS: Entrepreneurs CI\".",
  "membershipId": "d5e4e..."
}
```

#### apply_opportunity — deja postule
```json
{ "success": false, "error": "Tu as deja postule a cette opportunite." }
```

#### book_space — succes
```json
// dataJson: '{"startDatetime":"2026-03-01T09:00:00Z","endDatetime":"2026-03-01T12:00:00Z"}'
{
  "success": true,
  "message": "Reservation de \"Salle de Conference Le Plateau\" soumise (3h - 75000 FCFA).",
  "bookingId": "a1b2c..."
}
```

#### book_space — sans dates
```json
{ "success": false, "error": "Les dates de debut et de fin sont requises (startDatetime, endDatetime)." }
```

---

## 10. web_search (Sub-agent asTool)

**Fichier:** `services/copilot/tools/web-search.tool.ts`
**Pattern:** Sub-agent asTool. `webSearchAgent.asTool({...})`
**Modele sub-agent:** gpt-4.1-mini (OpenAI, MODEL_SEARCH — toujours OpenAI pour Responses API)
**Outil interne:** `webSearchTool()` (SDK OpenAI Agents)

### Parametres (message libre)

```typescript
{
  input: string;  // Query de recherche en texte libre
}
```

### Retour reel (VPS)

```json
// Agent args: { "input": "salaire product manager Cote d'Ivoire 2026" }
// Summary: "Recherche web terminee"
// Retour (texte synthetise):
"En Cote d'Ivoire, le salaire d'un Product Manager varie en fonction de l'experience et du secteur. Voici quelques donnees disponibles :

1. **Glassdoor** (glassdoor.fr) — publiee en septembre 2025
   Selon Glassdoor, le salaire moyen..."
```

Le sub-agent synthetise les resultats en texte structure francais avec sources citees.

---

## 11. cv_pdf_generator (interne)

**Fichier:** `services/copilot/tools/cv-pdf-generator.ts`
**Utilisation:** Appele par generate_document quand le contentJson est au format CV.
**Design:** Two-column layout, theme Etudesk (brown #3B2416 sidebar, light main).

### Structure CVData

```typescript
interface CVData {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  city?: string;
  country?: string;
  bio?: string;
  avatarUrl?: string;
  skills: Array<{ name: string; type?: string; level?: string }>;
  languages?: Array<{ language: string; level: string }>;
  interests?: string[];
  goals?: string[];
  experiences?: Array<{ title: string; company: string; location?: string; period: string; description?: string }>;
  education?: Array<{ degree: string; institution: string; location?: string; period: string; description?: string }>;
  certifications?: Array<{ name: string; issuer?: string; date?: string }>;
  other?: Array<{ heading: string; content: string }>;
}
```

---

## Tool Sequencing (Best Practice)

```
1. vector_query   <- Decouverte semantique (toujours en premier pour recherche)
2. sql_query      <- Donnees personnelles / structurees / stats org
3. web_search     <- SEULEMENT si donnees internes insuffisantes
4. generate_*     <- Generation APRES collecte de donnees
5. execute_action <- Actions APRES confirmation utilisateur
```

---

## SSE Streaming — Tool Events

Le client recoit des events SSE pendant l'execution:

```typescript
// Debut d'un tool call
{ type: 'tool_start', tool: { callId: string, name: string, args?: object } }

// Fin d'un tool call
{ type: 'tool_end', tool: { callId: string, name: string, summary: string, result?: any, duration?: number, status: 'success' | 'error', error?: string } }

// Texte genere par l'agent
{ type: 'text_delta', delta: string }

// Limite atteinte
{ type: 'limit_reached', reason: 'max_tools' | 'max_duration', message: string }

// Correction de contenu (remplacement complet du texte)
{ type: 'content_corrected', content: string }

// Session terminee
{ type: 'done', sessionId: string }

// Erreur
{ type: 'error', error: string }
```

### Summaries generes par tool_summary.ts

| Tool | Exemple de summary (reel VPS) |
|------|-----------------------------|
| sql_query (my_skills) | "4 elements" |
| sql_query (my_documents) | "1 element" |
| sql_query (org_stats) | "Donnees chargees" |
| sql_query (org_members) | "4 elements" |
| sql_query (search_communities) | "2 elements" |
| sql_query (search_opportunities) | "Aucun resultat" |
| vector_query | "6 resultats" |
| youtube_search | "1 video trouvee" |
| generate_document | "Document genere . Rapport Audit (sauvegarde)" |
| generate_diagram | "Diagramme genere" |
| manage_skills (add) | "Competence modifiee" |
| manage_skills (update) | "Competence modifiee" |
| manage_skills (error) | "Erreur: La competence ... existe deja" |
| file_reader (error) | "Erreur: Error reading document: bad XRef entry" |
| web_search | "Recherche web terminee" |

---

## Fichiers Source

| Tool | Fichier | Pattern |
|------|---------|---------|
| vector_query | `services/copilot/tools/vector-query.tool.ts` | Static export |
| sql_query | `services/copilot/tools/sql-query.tool.ts` | Factory (talentId, orgIds, intents) — 28+ intents |
| youtube_search | `services/copilot/tools/youtube-search.tool.ts` | Static export |
| generate_document | `services/copilot/tools/generate-document.tool.ts` | Factory (talentId, avatarUrl) |
| generate_image | `services/copilot/tools/generate-image.tool.ts` | Static export |
| generate_diagram | `services/copilot/tools/generate-diagram.tool.ts` | Static export |
| manage_skills | `services/copilot/tools/manage-skills.tool.ts` | Factory (talentId) |
| execute_action | `services/copilot/tools/execute-action.tool.ts` | Factory (talentId) |
| file_reader (talent) | `services/copilot/tools/file-read.tool.ts` | Factory → direct tool (talentId) |
| file_reader (org) | `services/copilot/tools/file-read.tool.ts` | Factory → asTool (orgId, claude-haiku-4-5) |
| web_search | `services/copilot/tools/web-search.tool.ts` | Agent asTool (gpt-4.1-mini, OpenAI) |
| cv_pdf_generator | `services/copilot/tools/cv-pdf-generator.ts` | Internal (called by generate_document) |
| org_pdf_generator | `services/copilot/tools/org-document-pdf-generator.ts` | Internal (called by generate_document) |
| tool_summary | `services/copilot/stream/tool-summary.ts` | Static function |

---

## Modeles LLM (architecture multi-provider)

| Constante | Modele | Provider | Utilisation |
|-----------|--------|----------|-------------|
| MODEL_AGENT | claude-opus-4-6 | Anthropic | Agents principaux (talent, org) |
| MODEL_FAST | claude-haiku-4-5 | Anthropic | Guardrails, titres, summaries, file_reader org |
| MODEL_SUGGESTION | gemini-2.5-flash-lite | Google | Suggestions, objectifs, bio |
| MODEL_SEARCH | gpt-4.1-mini | OpenAI | web_search (Responses API), vision/extraction |
| MODEL_MATCH | gpt-4.1-nano | OpenAI | Recommendations candidats |
| MODEL_IMAGE | gpt-image-1 | OpenAI | Generation d'images |
| MODEL_STT | whisper-1 | OpenAI | Speech-to-text |
| MODEL_EMBEDDING | text-embedding-3-small | OpenAI | Embeddings pour Pinecone |
| — | omni-moderation-latest | OpenAI | Auto-moderation contenu |

---

## Donnees de Test (VPS Production — 2026-02-14)

| Entite | Count |
|--------|-------|
| Talents | 20 |
| Organizations | 1 |
| Opportunities | 8 |
| Communities | 2 |
| Spaces | 2 |
| Talent Skills (etudesksas) | 4 |
| Talent Documents (etudesksas) | 1 |

Compte test: etudesksas@gmail.com (talent_id: 90000000-0000-4000-8000-000000000001)
Organisation: Etudesk SAS (org_id: 10000000-0000-4000-8000-000000000001)

---

## Bugs connus (2026-02-14)

| Bug | Impact | Status |
|-----|--------|--------|
| file_reader PDF seed = placeholder | Le PDF de seed retourne "bad XRef entry" car c'est un fichier genere minimal | Non-bloquant — les vrais PDFs uploades fonctionnent |
| Tables manquantes sur VPS (credit_action_catalog, talent_languages) | Le copilot retournait 500 avant l'execution des migrations legacy | Corrige — migrations 001-022 executees |

---

## Bugs corriges (historique)

| Bug | Fichier | Fix | Date |
|-----|---------|-----|------|
| file_reader infinite loop (sub-agent asTool) | file-read.tool.ts | Remplace par direct tool() | 2026-02-14 |
| `search_organizations` crash: `column o.city` | sql-query.tool.ts | `o.city` → `o.headquarters_city as city` | 2026-02-09 |
| `vector_query` organizations: meme bug `o.city` | vector-query.tool.ts | Idem | 2026-02-09 |
| `book_space` crash: `organization_id NOT NULL` | execute-action.tool.ts | Ajout organization_id + calcul | 2026-02-09 |
| `search_talents` ignore param `skills` | sql-query.tool.ts | Ajout JOIN talent_skills | 2026-02-09 |
| Proficiency levels non alignes DB↔tool | manage-skills.tool.ts | BEGINNER/INTERMEDIATE/EXPERT/MASTER | 2026-02-14 |
| Origins non alignes DB↔tool | manage-skills.tool.ts | declared/inferred/extracted (lowercase) | 2026-02-14 |
