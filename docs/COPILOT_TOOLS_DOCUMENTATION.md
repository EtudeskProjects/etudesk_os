# Copilot Tools Documentation

> **Audit complet des 11 tools du Copilot Etudesk**
> Date: 2026-02-09 | Tests: 65/67 passed, 2 skipped (100% hors skip)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     COPILOT TOOLS ARCHITECTURE                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │             MAIN AGENTS (claude-sonnet-4-5)              │   │
│  │  TalentAgent (explore) │ TalentAgent (study) │ OrgAgent │   │
│  └───────────────────────────┬─────────────────────────────┘   │
│                              │                                  │
│         ┌────────────────────┴────────────────────┐            │
│         │                                          │            │
│  ┌──────┴──────────┐                      ┌───────┴───────┐   │
│  │    9 TOOLS      │                      │ 2 SUB-AGENTS  │   │
│  ├─────────────────┤                      ├───────────────┤   │
│  │ vector_query    │ ← Pinecone semantic  │ file_reader   │   │
│  │ sql_query       │ ← PostgreSQL (IDOR)  │ (haiku-4-5)   │   │
│  │ youtube_search  │ ← YouTube Data API   │ web_search    │   │
│  │                 │                      └───────────────┘   │
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

### Allocation par mode

| Tool | Explorer (talent) | Study (talent) | Org Explorer |
|------|:-:|:-:|:-:|
| vector_query | x | | x |
| sql_query | x (28 intents) | x (my_profile, my_skills, my_documents) | x (org_* + search_* = 18 intents) |
| youtube_search | | x | |
| generate_document | x | | x |
| generate_image | | x | |
| generate_diagram | | x | |
| manage_skills | | x | |
| execute_action | x | | x |
| file_reader | x | x | x |
| web_search | x | x | x |

---

## Resume des Performances (audit reel 2026-02-09)

| Tool | Tests | Pass | Avg Time | Description |
|------|-------|------|----------|-------------|
| **vector_query** | 6 | 6 | 1,533ms | Recherche semantique Pinecone |
| **sql_query** | 23 | 23 | 2ms | Requetes PostgreSQL avec IDOR |
| **youtube_search** | 3 | 3 | 801ms | Videos educatives YouTube |
| **generate_document** | 6 | 6 | 26ms | Generation PDF/DOCX/CSV/XLS/TXT |
| **generate_image** | 1 | skip | ~60s | Images via gpt-image-1 |
| **generate_diagram** | 5 | 5 | <1ms | Diagrammes Mermaid |
| **manage_skills** | 4 | 4 | 2ms | Ajout/MAJ competences |
| **execute_action** | 5 | 5 | 5ms | Actions utilisateur |
| **file_reader** | 1 | 1 | <1ms | Lecture documents |
| **web_search** | 1 | skip | - | Recherche web (sub-agent) |
| **tool_summary** | 12 | 12 | <1ms | Validation des resumes |

---

## 1. vector_query

**Fichier:** `services/copilot/tools/vector-query.tool.ts`
**Description:** Recherche semantique dans Pinecone. Convertit la query en embedding, interroge Pinecone, puis enrichit les resultats via PostgreSQL.

### Parametres

```typescript
{
  query: string;          // Texte de recherche en langage naturel
  namespace: 'opportunities' | 'communities' | 'spaces' | 'talents' | 'organizations';
  topK: number;           // 1-30, default 10
  filtersJson: string | null;  // Filtres Pinecone optionnels, JSON string. Ex: '{"contract_type":"CDI"}'
}
```

### Retours reels

#### Succes (opportunities)
```json
// Input: { query: "developpeur React Node.js Abidjan", namespace: "opportunities", topK: 5, filtersJson: null }
// Output (4423ms):
{
  "results": [
    {
      "id": "54b2990b-f5a2-49c1-8cfd-83c3ccb2e678",
      "title": "Developpeur Frontend React",
      "summary": "Opportunite CDI pour un(e) Developpeur Frontend React passionne(e). Stack: Docker, Azure, Figma...",
      "type": "EMPLOYMENT",
      "contractType": "CDI",
      "locationType": "REMOTE",
      "location": "Ziguinchor",
      "organization": "Digital Solutions CI",
      "slug": "developpeur-frontend-react-ziguinchor-54b2990b",
      "matchScore": 67
    }
  ],
  "totalFound": 3
}
```

#### Succes (talents)
```json
// Input: { query: "developpeur fullstack Python Django", namespace: "talents", topK: 5 }
// Output (1569ms):
{
  "results": [
    {
      "id": "ab20a1ac-2c2e-4389-9d1d-dea650142dd5",
      "name": "Oumar Sow",
      "bio": "Developpeur passionne avec 8 ans d'experience en Django, Machine Learning, CI/CD. Base a Sokode, TG.",
      "location": "Sokode, TG",
      "matchScore": 59
    }
  ],
  "totalFound": 1
}
```

#### Succes (communities)
```json
// Input: { query: "communaute startup tech innovation", namespace: "communities", topK: 5 }
// Output (1655ms):
{
  "results": [
    {
      "id": "e0000001-0005-4000-e000-000000000005",
      "name": "Dakar Startup Community",
      "description": "L'ecosysteme startup de Dakar au complet...",
      "type": "HYBRID",
      "memberCount": 3,
      "organization": "Dakar Digital Hub",
      "slug": "dakar-startup-community",
      "matchScore": 61
    }
  ],
  "totalFound": 3
}
```

#### Succes (spaces)
```json
// Input: { query: "espace coworking salle reunion", namespace: "spaces", topK: 5 }
// Output (1532ms):
{
  "results": [
    {
      "id": "f0000001-0006-4000-f000-000000000006",
      "name": "Salle de Reunion Mermoz",
      "description": "Salle de reunion premium au quartier Mermoz...",
      "type": "MEETING_ROOM",
      "capacity": 12,
      "hourlyRate": "10000.00",
      "city": "Dakar",
      "organization": "Dakar Digital Hub",
      "slug": "salle-reunion-mermoz-dakar",
      "matchScore": 59
    }
  ],
  "totalFound": 2
}
```

#### Aucun resultat
```json
{
  "results": [],
  "message": "Aucun resultat trouve pour cette recherche."
}
```

#### Erreur
```json
{
  "results": [],
  "error": "message d'erreur"
}
```

---

## 2. sql_query

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
          'search_opportunities' | 'search_communities' | 'search_spaces' |
          'search_organizations' | 'search_talents';
  paramsJson: string;  // JSON string. Ex: '{"status":"PENDING"}', '{"organizationId":"uuid"}', '{"query":"React","limit":5}'
}
```

### Retours reels par intent

#### my_profile
```json
// Output (2ms):
{
  "id": "689f7929-...",
  "first_name": "Lamine",
  "last_name": "Barro",
  "display_name": "Lamine Barro",
  "bio": "Etudiant et entrepreneur...",
  "city": "abobo",
  "country": "CI",
  "email": "succes1@gmail.com",
  "phone": "+2250574631148",
  "slug": "lamine-barro",
  "remote_ready": true,
  "willing_to_relocate": true,
  "sectors": ["DIGITAL", "EDUCATION", "TOURISM", "TRANSPORT"],
  "goals": ["LEARN_NEW_SKILLS", "BUILD_NETWORK_OR_VISIBILITY"],
  "profile_tags": ["STUDENT", "ENTREPRENEUR", "CONSULTANT"]
}
```

#### my_applications
```json
// Output (7ms):
{
  "applications": [
    {
      "id": "b1c98c64-...",
      "status": "SUBMITTED",
      "applied_at": "2026-02-07T01:30:15.499Z",
      "updated_at": "2026-02-07T01:30:15.499Z",
      "opportunity_title": "Responsable Marketing Digital",
      "type": "EMPLOYMENT",
      "opportunity_slug": "resp-marketing-digital-afritech",
      "organization_name": null
    }
  ],
  "totalCount": 1
}
```

#### my_skills
```json
// Output (2ms):
{
  "skills": [
    { "name": "Analyse De Donnees Biologiques", "type": "HARD_SKILL", "proficiency_level": "EXPERT", "origin": "extracted" },
    { "name": "Communication", "type": "SOFT_SKILL", "proficiency_level": "EXPERT", "origin": "extracted" },
    { "name": "Intelligence Artificielle", "type": "HARD_SKILL", "proficiency_level": "EXPERT", "origin": "extracted" }
  ]
}
```

#### my_documents
```json
// Output (2ms):
{
  "documents": [
    {
      "id": "04bcd6cb-...",
      "document_type": "CV",
      "category": "PROFESSIONAL",
      "title": "Curriculum Vitae - Mohamed Lamine Barro",
      "original_filename": "Curriculum_Vitae___Lamine_Barro.pdf",
      "status": "PROCESSED",
      "description": "Document generated by copilot...",
      "created_at": "2026-02-07T02:36:08.989Z"
    }
  ]
}
```

#### my_communities / my_bookmarks / my_reservations / my_invitations
```json
{ "communities": [] }
{ "bookmarks": [] }
{ "reservations": [] }
{ "invitations": [], "pendingCount": 0 }
```

#### org_stats
```json
// Input: paramsJson: '{"organizationId":"uuid"}'
// Output (3ms):
{
  "member_count": "1",
  "open_opportunities": "0",
  "community_count": "0",
  "space_count": "0"
}
```

#### org_members
```json
{ "members": [{ "role": "OWNER", "created_at": "...", "display_name": "Lamine Barro", "bio": "...", "avatar_url": null }] }
```

#### org_revenue
```json
{ "total_revenue": "0", "total_bookings": "0", "confirmed_bookings": "0" }
```

#### search_opportunities
```json
// Input: paramsJson: '{"query":"React","limit":5}'
// Output (1ms):
{
  "opportunities": [
    { "id": "...", "title": "Developpeur Frontend React", "summary": "...", "type": "EMPLOYMENT", "contract_type": "CDI", "slug": "..." }
  ]
}
```

#### search_talents (avec skills)
```json
// Input: paramsJson: '{"skills":["python","react"],"limit":5}'
// Filtre par talent_skills.canonical_name
{
  "talents": [
    { "id": "...", "display_name": "Oumar Sow", "bio": "...", "city": "Sokode", "country": "TG" }
  ]
}
```

#### Edge: org intent sans organizationId
```json
{ "error": "organizationId requis pour les requetes organisation" }
```

#### Edge: intent bloque (study mode)
```json
{ "error": "L'intent 'my_applications' n'est pas disponible dans ce mode. Intents autorises : my_profile, my_skills, my_documents" }
```

#### org_documents
```json
// Input: paramsJson: '{"organizationId":"uuid","type":"CONTRACT"}'
// Output:
{
  "documents": [
    {
      "id": "...",
      "title": "Contrat de prestation",
      "original_filename": "contrat_prestation.pdf",
      "document_type": "CONTRACT",
      "category": "LEGAL",
      "status": "PROCESSED",
      "description": "Contrat de prestation de services",
      "tags": [],
      "created_at": "2026-02-10T10:00:00.000Z",
      "uploader_name": "Lamine Barro"
    }
  ]
}
```

#### org_talents
```json
// Input: paramsJson: '{"organizationId":"uuid","source":"APPLICATION","limit":5}'
// Output:
{
  "talents": [
    {
      "id": "...",
      "display_name": "Amadou Diallo",
      "bio": "Developpeur Full-Stack...",
      "city": "Abidjan",
      "country": "CI",
      "sources": ["APPLICATION", "COMMUNITY"],
      "first_interaction": "2026-01-15T08:00:00.000Z",
      "last_interaction": "2026-02-10T14:00:00.000Z",
      "is_favorite": true
    }
  ]
}
```

#### org_talent_profile
```json
// Input: paramsJson: '{"organizationId":"uuid","talentId":"talent-uuid"}'
// Output:
{
  "profile": {
    "id": "talent-uuid",
    "display_name": "Amadou Diallo",
    "bio": "Developpeur Full-Stack...",
    "city": "Abidjan",
    "country": "CI",
    "sectors": ["TECHNOLOGY"],
    "goals": ["FIND_JOB"]
  },
  "skills": [
    { "name": "React", "type": "HARD_SKILL", "proficiency_level": "ADVANCED" },
    { "name": "Node.js", "type": "HARD_SKILL", "proficiency_level": "INTERMEDIATE" }
  ]
}
```

#### Edge: talent sans interaction avec l'org
```json
{ "error": "Ce talent n'a aucune interaction avec votre organisation" }
```

#### org_community_feed
```json
// Input: paramsJson: '{"organizationId":"uuid","communityId":"comm-uuid","type":"EVENT","limit":5}'
// Output:
{
  "activities": [
    {
      "id": "...",
      "type": "EVENT",
      "content": "Meetup Tech Abidjan #12",
      "metadata": {"date":"2026-03-01","location":"Hub Cocody"},
      "reactions_count": 15,
      "comments_count": 3,
      "is_pinned": false,
      "author_name": "Lamine Barro",
      "published_at": "2026-02-10T12:00:00.000Z"
    }
  ]
}
```

#### org_community_members
```json
// Input: paramsJson: '{"organizationId":"uuid","communityId":"comm-uuid","role":"ADMIN"}'
// Output:
{
  "members": [
    {
      "id": "...",
      "display_name": "Lamine Barro",
      "role": "ADMIN",
      "bio": "Entrepreneur tech...",
      "city": "Abidjan",
      "country": "CI",
      "joined_at": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

#### Edge: communaute n'appartient pas a l'org
```json
{ "error": "Communaute non trouvee ou n'appartient pas a votre organisation" }
```

#### my_community_feed
```json
// Input: paramsJson: '{"communityId":"comm-uuid","limit":5}'
// Output:
{
  "activities": [
    {
      "id": "...",
      "type": "POST",
      "content": "Bienvenue aux nouveaux membres !",
      "metadata": {},
      "reactions_count": 8,
      "comments_count": 2,
      "is_pinned": true,
      "author_name": "Hasma Gbane",
      "published_at": "2026-02-09T09:00:00.000Z"
    }
  ]
}
```

#### my_community_members
```json
// Input: paramsJson: '{"communityId":"comm-uuid","role":"MEMBER","limit":10}'
// Output:
{
  "members": [
    {
      "id": "...",
      "display_name": "Wilfried Dali",
      "role": "MEMBER",
      "bio": "DGA Etudesk...",
      "joined_at": "2026-01-15T00:00:00.000Z"
    }
  ]
}
```

#### Edge: pas membre de la communaute
```json
{ "error": "Tu n'es pas membre de cette communaute" }
```

---

## 3. youtube_search

**Fichier:** `services/copilot/tools/youtube-search.tool.ts`
**Mode:** Study uniquement.

### Parametres

```typescript
{
  query: string;        // Recherche en francais, ajouter "Afrique francophone" pour sujets business/finance
  maxResults: number;   // 1-3 (recommande: 1)
}
```

### Retours reels

```json
// Input: { query: "React hooks tutoriel francais", maxResults: 1 }
// Output (1131ms):
{
  "videos": [
    {
      "videoId": "dpw9EHDh2bM",
      "title": "REACT HOOKS en 30 minutes !",
      "description": "React hooks tutoriel pour apprendre...",
      "channelName": "Melvynx",
      "thumbnailUrl": "https://i.ytimg.com/vi/dpw9EHDh2bM/mqdefault.jpg"
    }
  ]
}
```

#### API non configuree
```json
{ "videos": [], "message": "YouTube API non configuree" }
```

---

## 4. generate_document

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
  instructions: string;
}
```

### Retours reels

#### PDF Sections
```json
// Input: format: "PDF", title: "Lettre de Motivation", contentJson: '{"sections":[...]}'
// Output (30ms):
{
  "success": true,
  "id": "3d265f5b-0dd2-47c1-9bd5-b3268fe05673",
  "documentType": "PDF",
  "downloadUrl": "https://storage.example.com/documents/.../uuid.pdf",
  "filename": "Lettre_de_Motivation.pdf",
  "metadata": {
    "generatedAt": "2026-02-09T16:39:30.391Z",
    "sizeBytes": 1566,
    "title": "Lettre de Motivation"
  }
}
```

#### PDF CV (format structure)
```json
// Input: format: "PDF", contentJson: '{"firstName":"Lamine","lastName":"Barro","skills":[...],...}'
// Output (14ms):
{
  "success": true,
  "id": "edf06878-1f43-42be-9270-1dd385e896b7",
  "documentType": "PDF",
  "downloadUrl": "...",
  "filename": "CV_Lamine_Barro.pdf",
  "metadata": { "generatedAt": "...", "sizeBytes": 3181, "title": "CV Lamine Barro" }
}
```

#### DOCX Table
```json
// Output (34ms):
{ "success": true, "id": "...", "documentType": "DOCX", "filename": "Export_Talents.docx", "metadata": { "sizeBytes": 7888 } }
```

#### CSV
```json
// Output (16ms):
{ "success": true, "id": "...", "documentType": "CSV", "filename": "Export_CSV.csv", "metadata": { "sizeBytes": 61 } }
```

#### XLS
```json
// Output (25ms):
{ "success": true, "id": "...", "documentType": "XLS", "filename": "Stats_Opportunites.xlsx", "metadata": { "sizeBytes": 6578 } }
```

#### TXT
```json
// Output (2ms):
{ "success": true, "id": "...", "documentType": "TXT", "filename": "Notes_reunion.txt", "metadata": { "sizeBytes": 92 } }
```

#### Erreur
```json
{ "success": false, "error": "Erreur lors de la generation du document: ..." }
```

---

## 5. generate_image

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

### Retour

```json
// Output (~60s):
{
  "success": true,
  "downloadUrl": "https://storage.example.com/generated/image-1707498765432.png",
  "filename": "image-1707498765432.png",
  "metadata": {
    "generatedAt": "2026-02-09T16:40:00.000Z",
    "sizeBytes": 1911998,
    "dimensions": "1024x1024",
    "quality": "medium",
    "model": "gpt-image-1"
  }
}
```

#### Erreur content policy
```json
{ "success": false, "error": "The requested image cannot be generated due to content policy restrictions." }
```

---

## 6. generate_diagram

**Fichier:** `services/copilot/tools/generate-diagram.tool.ts`
**Mode:** Study uniquement.
**Rendu:** Client-side (l'app mobile rend le Mermaid via WebView).

### Parametres

```typescript
{
  title: string;
  diagramType: 'flowchart' | 'sequenceDiagram' | 'classDiagram' | 'mindmap' | 'timeline' | 'gantt' | 'pie' | 'erDiagram';
  mermaidCode: string;  // Code Mermaid valide. Regles: pas de <br/>, pas de () dans [], labels courts.
}
```

### Retours reels

#### Flowchart
```json
// Input: { title: "Processus de Recrutement", diagramType: "flowchart", mermaidCode: "flowchart TD\n    A[Offre publiee] --> B{Candidatures?}..." }
// Output (<1ms):
{
  "success": true,
  "title": "Processus de Recrutement",
  "diagramType": "flowchart",
  "mermaidCode": "flowchart TD\n    A[Offre publiee] --> B{Candidatures?}\n    B -->|Oui| C[Tri des CV]...",
  "renderHint": "client-side"
}
```

#### Code invalide (mauvais prefix)
```json
{
  "success": false,
  "error": "Le code Mermaid doit commencer par \"flowchart\" ou \"graph\" pour un diagramme de type flowchart"
}
```

#### Sanitize <br/> et parentheses
Le tool sanitize automatiquement: `<br/>` → `\n`, `(` dans `[]` → `&#40;`

---

## 7. manage_skills

**Fichier:** `services/copilot/tools/manage-skills.tool.ts`
**Pattern:** Factory — `createManageSkillsTool(authenticatedTalentId)`
**Mode:** Study uniquement.

### Parametres

```typescript
{
  action: 'add' | 'update';
  skillName: string;          // Nom canonique (ex: "React", "Python")
  proficiencyLevel: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
  origin: 'SELF_DECLARED' | 'AI_INFERRED' | 'DOCUMENT_EXTRACTED' | 'QUIZ_VALIDATED';
}
```

### Retours reels

#### Ajout reussi
```json
// Input: { action: "add", skillName: "Rust_Audit_Test", proficiencyLevel: "BEGINNER", origin: "AI_INFERRED" }
// Output (3ms):
{
  "success": true,
  "message": "Competence \"Rust_Audit_Test\" ajoutee avec le niveau BEGINNER.",
  "skill": { "name": "Rust_Audit_Test", "level": "BEGINNER", "origin": "AI_INFERRED" }
}
```

#### Update reussi
```json
// Output (1ms):
{
  "success": true,
  "message": "Competence \"Rust_Audit_Test\" mise a jour au niveau INTERMEDIATE.",
  "skill": { "id": "...", "canonical_name": "Rust_Audit_Test", "proficiency_level": "INTERMEDIATE" }
}
```

#### Doublon (add sur skill existante)
```json
{
  "success": false,
  "error": "La competence \"Rust_Audit_Test\" existe deja (niveau: INTERMEDIATE). Utilise l'action \"update\" pour changer le niveau."
}
```

#### Update inexistante
```json
{
  "success": false,
  "error": "La competence \"CompetenceQuiExistePas\" n'existe pas. Utilise l'action \"add\" pour l'ajouter."
}
```

---

## 8. execute_action

**Fichier:** `services/copilot/tools/execute-action.tool.ts`
**Pattern:** Factory — `createExecuteActionTool(authenticatedTalentId)`
**Securite:** Verifications metier avant chaque action (existe? ouvert? deja fait?).

### Parametres

```typescript
{
  action: 'apply_opportunity' | 'join_community' | 'book_space' | 'accept_invitation' | 'decline_invitation';
  entityId: string;   // UUID de l'entite cible
  dataJson: string;   // Donnees supplementaires. Pour book_space: '{"startDatetime":"...","endDatetime":"..."}'
}
```

### Retours reels

#### apply_opportunity — deja postule
```json
// Output (4ms):
{ "success": false, "error": "Tu as deja postule a cette opportunite." }
```

#### join_community — succes
```json
// Output (4ms):
{
  "success": true,
  "message": "Tu as rejoint la communaute \"BTP & Construction Cote d'Ivoire\".",
  "membershipId": "d5e4e..."
}
```

#### book_space — sans dates (edge)
```json
{ "success": false, "error": "Les dates de debut et de fin sont requises (startDatetime, endDatetime)." }
```

#### book_space — succes
```json
// Input: dataJson: '{"startDatetime":"2026-03-01T09:00:00Z","endDatetime":"2026-03-01T12:00:00Z"}'
// Output (12ms):
{
  "success": true,
  "message": "Reservation de \"Salle de Conference Le Plateau\" soumise (3h - 75000 FCFA).",
  "bookingId": "a1b2c..."
}
```

#### accept_invitation — non trouvee
```json
{ "success": false, "error": "Invitation non trouvee ou deja traitee." }
```

---

## 9. file_reader (FileReaderAgent via asTool)

**Fichier:** `services/copilot/tools/file-read.tool.ts`
**Pattern:** Factory → sub-agent asTool. `createFileReaderTool(talentId)`
**Modele sub-agent:** claude-haiku-4-5 (Anthropic, MODEL_FAST)
**Securite:** Le read_document interne verifie que le document appartient au talent (IDOR).

### Parametres (asTool — message libre)

Le main agent passe un message texte contenant le documentId. Exemple:
```
"Lis et analyse le document avec documentId: 483bdc16-fba3-4a10-aa4e-79b716595fcc"
```

### Retour interne (read_document)

```json
// Document PDF:
{
  "success": true,
  "document": {
    "id": "483bdc16-...",
    "title": "Curriculum Vitae de Lamine Barro",
    "type": "CV",
    "mimeType": "application/pdf",
    "pageCount": 2
  },
  "content": "Mohamed Lamine Barro - Entrepreneur...\nCompetences: IA, Strategie, Entrepreneuriat..."
}
```

### Types supportes

| Type MIME | Traitement |
|-----------|-----------|
| `text/*`, `application/json`, `application/xml` | Extraction directe UTF-8 |
| `application/pdf` | Extraction via pdf-parse |
| `image/*` | Metadata uniquement (vision dans le main agent) |
| Autres | Metadata uniquement |

### file_reader pour documents organisation

**Disponible dans:** Organization (en plus de Explore et Study pour les documents talent)
**Pattern:** Factory → sub-agent asTool. `createOrgFileReaderTool(orgId)`
**Securite:** Le read_document interne verifie que le document appartient a l'organisation (IDOR).

Le file_reader en mode org fonctionne de la meme maniere que pour les talents, mais interroge la table `organization_documents` au lieu de `talent_documents`.

**Workflow type (mode Org):**
1. `sql_query` intent `org_documents` → liste des documents
2. `file_reader` avec documentId → lecture du contenu
3. Agent analyse et propose des actions (ex: creer une opportunite depuis une fiche de poste)

---

## 10. web_search (WebSearchAgent via asTool)

**Fichier:** `services/copilot/tools/web-search.tool.ts`
**Pattern:** Sub-agent asTool. `webSearchAgent.asTool({...})`
**Modele sub-agent:** gpt-4.1-mini (OpenAI, MODEL_SEARCH — toujours OpenAI pour Responses API)
**Outil interne:** `webSearchTool()` (SDK OpenAI Agents)

### Parametres (asTool — message libre)

Le main agent passe une query en texte libre. Exemple:
```
"Recherche les salaires developpeur senior en Cote d'Ivoire 2026"
```

### Retour

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
```

### Summaries generes par tool_summary.ts

| Tool | Exemple de summary |
|------|--------------------|
| vector_query | "3 resultats . opportunites" |
| sql_query | "30 elements . Mes competences" |
| sql_query (org_documents) | "5 documents . Documents organisation" |
| sql_query (org_talents) | "12 talents . Talents organisation" |
| sql_query (org_talent_profile) | "Profil talent . Amadou Diallo" |
| sql_query (org_community_feed) | "8 activites . Feed communaute" |
| sql_query (org_community_members) | "15 membres . Membres communaute" |
| sql_query (my_community_feed) | "6 activites . Mon feed communaute" |
| sql_query (my_community_members) | "10 membres . Membres communaute" |
| youtube_search | "1 video trouvee" |
| generate_document | "Document genere . CV Lamine Barro (sauvegarde)" |
| generate_image | "Image generee" |
| generate_diagram | "Diagramme genere" |
| manage_skills | "Ajoutee . Python" |
| execute_action | "Candidature soumise" |
| file_reader | "Lu . Curriculum Vitae" |
| web_search | "Recherche web terminee" |

---

## Fichiers Source

| Tool | Fichier | Pattern |
|------|---------|---------|
| vector_query | `services/copilot/tools/vector-query.tool.ts` | Static export |
| sql_query | `services/copilot/tools/sql-query.tool.ts` | Factory (talentId, orgIds, intents) — 28 intents |
| youtube_search | `services/copilot/tools/youtube-search.tool.ts` | Static export |
| generate_document | `services/copilot/tools/generate-document.tool.ts` | Factory (talentId, avatarUrl) |
| generate_image | `services/copilot/tools/generate-image.tool.ts` | Static export |
| generate_diagram | `services/copilot/tools/generate-diagram.tool.ts` | Static export |
| manage_skills | `services/copilot/tools/manage-skills.tool.ts` | Factory (talentId) |
| execute_action | `services/copilot/tools/execute-action.tool.ts` | Factory (talentId) |
| file_reader | `services/copilot/tools/file-read.tool.ts` | Factory → asTool (talentId, claude-haiku-4-5) |
| web_search | `services/copilot/tools/web-search.tool.ts` | Agent asTool (gpt-4.1-mini, OpenAI) |
| cv_pdf_generator | `services/copilot/tools/cv-pdf-generator.ts` | Internal (called by generate_document) |
| tool_summary | `services/copilot/stream/tool-summary.ts` | Static function |

---

## Modeles LLM (architecture multi-provider)

| Constante | Modele | Provider | Utilisation |
|-----------|--------|----------|-------------|
| MODEL_AGENT | claude-sonnet-4-5 | Anthropic | Agents principaux (talent, org) |
| MODEL_FAST | claude-haiku-4-5 | Anthropic | Guardrails, titres, summaries, file_reader |
| MODEL_SUGGESTION | gemini-2.5-flash-lite | Google | Suggestions, objectifs, bio |
| MODEL_SEARCH | gpt-4.1-mini | OpenAI | web_search (Responses API), vision/extraction |
| MODEL_MATCH | gpt-4.1-nano | OpenAI | Recommendations candidats |
| MODEL_IMAGE | gpt-image-1 | OpenAI | Generation d'images |
| MODEL_STT | whisper-1 | OpenAI | Speech-to-text |
| MODEL_EMBEDDING | text-embedding-3-small | OpenAI | Embeddings pour Pinecone |
| — | omni-moderation-latest | OpenAI | Auto-moderation contenu (direct `new OpenAI()`, timeout 5s) |

---

## Bugs corriges dans cet audit (2026-02-09)

| Bug | Fichier | Fix |
|-----|---------|-----|
| `search_organizations` crash: `column o.city does not exist` | sql-query.tool.ts | `o.city` → `o.headquarters_city as city` |
| `vector_query` organizations: meme bug `o.city` | vector-query.tool.ts | Idem |
| `book_space` crash: `organization_id NOT NULL` | execute-action.tool.ts | Ajout organization_id + calcul duration * hourly_rate |
| `search_talents` ignore le param `skills` | sql-query.tool.ts | Ajout JOIN talent_skills avec filtre |
| `tool_summary` sql_query: toujours "Donnees chargees" | tool-summary.ts | Recherche du premier array dans l'objet de retour |

---

## Donnees de Test (UEMOA)

L'audit a ete realise sur une base de donnees reelle:

| Entite | Count |
|--------|-------|
| Talents | 57 |
| Organizations | 31 |
| Opportunities | 55 |
| Communities | 27 |
| Spaces | 24 |
| Talent Skills | 486 |
| Talent Documents | 14 |
| Applications | 165 |
| Community Members | 261 |

Pays couverts: Benin, Burkina Faso, Cote d'Ivoire, Guinee-Bissau, Mali, Niger, Senegal, Togo.
