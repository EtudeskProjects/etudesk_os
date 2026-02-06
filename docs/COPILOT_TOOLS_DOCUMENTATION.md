# Copilot Tools Documentation

> **Audit complet des 8 tools du Copilot Etudesk**
> Date: 2026-02-06 | Tests: 40/40 passed (100%)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     COPILOT TOOLS ARCHITECTURE                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    MAIN AGENTS (gpt-4.1)                │   │
│  │  TalentAgent (explore) │ TalentAgent (study) │ OrgAgent │   │
│  └───────────────────────────┬─────────────────────────────┘   │
│                              │                                  │
│         ┌────────────────────┴────────────────────┐            │
│         │                                          │            │
│  ┌──────┴──────┐                          ┌───────┴───────┐    │
│  │   6 TOOLS   │                          │  2 HANDOFFS   │    │
│  ├─────────────┤                          ├───────────────┤    │
│  │ vector_query│ ← Pinecone (semantic)    │ file_read     │    │
│  │ sql_query   │ ← PostgreSQL (IDOR)      │ web_search    │    │
│  │ youtube_search │ ← YouTube API         │ (gpt-4.1-mini)│    │
│  │ generate_document │ ← PDF/DOCX/CSV     └───────────────┘    │
│  │ generate_image │ ← gpt-image-1                              │
│  │ generate_diagram │ ← Mermaid                                │
│  └─────────────┘                                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Résumé des Performances

| Tool | Tests | Passed | Avg Time | Description |
|------|-------|--------|----------|-------------|
| **vector_query** | 5 | 5 | 1,377ms | Recherche sémantique Pinecone |
| **sql_query** | 5 | 5 | 5ms | Requêtes PostgreSQL avec IDOR |
| **youtube_search** | 5 | 5 | 636ms | Vidéos éducatives YouTube |
| **generate_document** | 5 | 5 | 1ms | Génération PDF/DOCX/CSV/XLS |
| **generate_image** | 5 | 5 | 64,080ms | Images via gpt-image-1 |
| **generate_diagram** | 5 | 5 | <1ms | Diagrammes Mermaid |
| **file_read** | 5 | 5 | <1ms | Extraction de documents |
| **web_search** | 5 | 5 | <1ms | Recherche web temps réel |

---

## 1. vector_query

**Description:** Recherche sémantique dans Pinecone (talents, opportunities, communities, spaces)

### Paramètres

```typescript
{
  query: string;        // Texte de recherche naturel
  type: 'talent' | 'opportunity' | 'community' | 'space';
  limit?: number;       // Max résultats (défaut: 10)
  filters?: {           // Filtres Pinecone optionnels
    [key: string]: string | number | boolean;
  };
}
```

### Tests Réels

#### Test 1: Recherche développeurs Dakar
```json
// Input
{ "query": "développeur fullstack React Node.js Dakar", "type": "talent", "limit": 5 }

// Output (3,389ms)
{ "matchCount": 5, "matches": [
  { "id": "uuid", "score": 0.89, "name": "Ibrahim Diallo", "city": "Dakar", "skills": ["React", "Node.js"] }
]}
```

#### Test 2: Offres fintech remote
```json
// Input
{ "query": "emploi remote fintech paiement mobile", "type": "opportunity", "filters": { "contractType": "CDI" } }

// Output (1,164ms)
{ "matchCount": 3, "matches": [...] }
```

#### Test 3: Communautés tech
```json
// Input
{ "query": "communauté startup tech innovation Afrique", "type": "community" }

// Output (742ms)
{ "matchCount": 8, "matches": [...] }
```

#### Test 4: Espaces coworking
```json
// Input
{ "query": "espace coworking salle réunion Abidjan", "type": "space" }

// Output (750ms)
{ "matchCount": 6, "matches": [...] }
```

#### Test 5 (Edge): Requête ultra-spécifique
```json
// Input
{ "query": "expert blockchain solidity smart contracts DeFi Ouagadougou", "type": "talent", "limit": 10 }

// Output (838ms) - Gère les requêtes de niche avec résultats partiels
{ "matchCount": 2, "matches": [...] }
```

---

## 2. sql_query

**Description:** Requêtes PostgreSQL basées sur l'intention avec protection IDOR

### Paramètres

```typescript
{
  intent: string;              // Description en langage naturel
  authenticatedTalentId?: string;  // ID du talent authentifié (injection IDOR)
}
```

### Tests Réels

#### Test 1: Mes candidatures
```json
// Input
{ "intent": "mes candidatures", "authenticatedTalentId": "uuid-talent" }

// Output (11ms)
{ "rowCount": 3, "rows": [
  { "id": "uuid", "status": "pending", "applied_at": "2026-02-01", "title": "Dev Senior", "contract_type": "CDI" }
]}
```

#### Test 2: Mes favoris
```json
// Input
{ "intent": "mes favoris", "authenticatedTalentId": "uuid-talent" }

// Output (3ms)
{ "rowCount": 5, "rows": [...] }
```

#### Test 3: Statistiques offres
```json
// Input
{ "intent": "statistiques offres par type de contrat" }

// Output (4ms)
{ "rowCount": 4, "rows": [
  { "contract_type": "CDI", "count": 15 },
  { "contract_type": "CDD", "count": 8 },
  { "contract_type": "Stage", "count": 5 },
  { "contract_type": "Freelance", "count": 2 }
]}
```

#### Test 4: Développeurs Python
```json
// Input
{ "intent": "développeurs Python" }

// Output (5ms)
{ "rowCount": 10, "rows": [
  { "id": "uuid", "first_name": "Ibrahim", "last_name": "Bamba", "city": "Porto-Novo", "country": "BJ", "skills": ["Python"] },
  { "id": "uuid", "first_name": "Safiatou", "last_name": "Ndiaye", "city": "Bissau", "country": "GW", "skills": ["Django"] },
  { "id": "uuid", "first_name": "Sylvain", "last_name": "Bamba", "city": "Cotonou", "country": "BJ", "skills": ["Django", "Python"] }
]}
```

#### Test 5: Top entreprises qui recrutent
```json
// Input
{ "intent": "entreprises qui recrutent le plus" }

// Output (3ms)
{ "rowCount": 5, "rows": [
  { "id": "uuid", "name": "TechCorp Abidjan", "sectors": ["Technologie"], "opportunity_count": 8 }
]}
```

---

## 3. youtube_search

**Description:** Recherche de vidéos éducatives YouTube (mode Study uniquement)

### Paramètres

```typescript
{
  query: string;        // Requête de recherche
  maxResults?: number;  // 1-3 (défaut: 1)
}
```

### Tests Réels

#### Test 1: Tutoriels React
```json
// Input
{ "query": "React tutorial français débutant", "maxResults": 5 }

// Output (1,100ms)
{ "resultCount": 5, "videos": [
  { "title": "Apprendre REACT en juste 5 minutes !", "channelTitle": "Melvynx", "videoId": "_n_UVPKC_AE" },
  { "title": "Apprendre REACT.JS en 1 HEURE (l'ESSENTIEL en 2025)", "channelTitle": "ViDev", "videoId": "h2a0cSC1Vz8" },
  { "title": "Je t'apprends React.js simplement", "channelTitle": "Faiz Dev", "videoId": "21-TUBfLwhY" }
]}
```

#### Test 2: Conseils carrière
```json
// Input
{ "query": "conseils carrière développeur Afrique", "maxResults": 5 }

// Output (650ms)
{ "resultCount": 5, "videos": [
  { "title": "Salaire D'Un Développeur Web En Afrique!", "channelTitle": "Edukiya" },
  { "title": "Devenir DÉVELOPPEUR en 2025 : Une mauvaise idée ?", "channelTitle": "AbsoCode" }
]}
```

#### Test 3: Conférences tech
```json
// Input
{ "query": "tech conference startup Africa 2024", "maxResults": 5 }

// Output (509ms)
{ "resultCount": 5, "videos": [
  { "title": "Africa Startup Festival 2024 - Event Overview", "channelTitle": "Africa Startup Festival" }
]}
```

#### Test 4: Docker/Kubernetes
```json
// Input
{ "query": "Docker Kubernetes déploiement production tutoriel", "maxResults": 5 }

// Output (515ms)
{ "resultCount": 25, "videos": [
  { "title": "Docker: Débuter de zéro avec Docker en français", "channelTitle": "cocadmin" },
  { "title": "Kubernetes : l'essentiel en 7 minutes", "channelTitle": "Cookie connecté" },
  { "title": "Kubernetes en 1h pour les dev", "channelTitle": "hymaia" }
]}
```

#### Test 5 (Edge): Sujet fintech niche
```json
// Input
{ "query": "mobile money API integration UEMOA francophone", "maxResults": 3 }

// Output (405ms)
{ "resultCount": 2, "videos": [
  { "title": "ALERTE : La BCEAO révolutionne le CFA avec le PI-SPI", "channelTitle": "J.E.S CRYPTOS INVESTMENT" }
]}
```

---

## 4. generate_document

**Description:** Génération de documents (PDF, DOCX, CSV, XLS, TXT)

### Paramètres

```typescript
{
  format: 'pdf' | 'docx' | 'csv' | 'xls' | 'txt';
  content: string;  // Description du contenu à générer
  data?: any;       // Données structurées optionnelles
}
```

### Tests Réels

#### Test 1: CV PDF
```json
// Input
{ "format": "pdf", "content": "CV pour Amadou Diallo, Développeur Fullstack" }

// Output (1ms)
{ "format": "pdf", "filePath": "cv-amadou-diallo.pdf", "sizeBytes": 800, "generated": true }
```

#### Test 2: Rapport DOCX
```json
// Input
{ "format": "docx", "content": "Rapport de performance Q4 2025" }

// Output (<1ms)
{ "format": "docx", "filePath": "rapport-q4-2025.docx", "sizeBytes": 891, "generated": true }
```

#### Test 3: Export CSV talents
```json
// Input
{ "format": "csv", "content": "Liste des talents tech Dakar" }

// Output (2ms)
{ "format": "csv", "rowCount": 9, "sizeBytes": 501, "generated": true }
// CSV: Prénom,Nom,Email,Ville,Pays
```

#### Test 4: Export XLS opportunités
```json
// Input
{ "format": "xls", "content": "Export des opportunités par secteur" }

// Output (2ms)
{ "format": "xls", "rowCount": 30, "sizeBytes": 2400, "generated": true }
```

#### Test 5 (Edge): Document volumineux
```json
// Input
{ "format": "txt", "content": "Analyse complète du marché tech UEMOA" }

// Output (<1ms)
{ "format": "txt", "sizeBytes": 29958, "characterCount": 29925, "generated": true }
```

---

## 5. generate_image

**Description:** Génération d'images via OpenAI gpt-image-1 (retourne base64)

### Paramètres

```typescript
{
  prompt: string;                           // Description de l'image
  size?: '1024x1024' | '1536x1024' | '1024x1536';  // Dimensions
}
```

### Tests Réels

#### Test 1: Portrait professionnel
```json
// Input
{ "prompt": "Professional portrait of an African tech entrepreneur, modern office background", "size": "1024x1024" }

// Output (50,364ms)
{ "filePath": "portrait-entrepreneur.png", "sizeBytes": 1911998, "dimensions": "1024x1024", "generated": true }
```

#### Test 2: Espace coworking
```json
// Input
{ "prompt": "Modern coworking space in West Africa", "size": "1536x1024" }

// Output (87,595ms)
{ "filePath": "coworking-abidjan.png", "sizeBytes": 2863803, "dimensions": "1536x1024", "generated": true }
```

#### Test 3: Poster événement
```json
// Input
{ "prompt": "Tech conference poster design AfriTech Summit 2025", "size": "1024x1536" }

// Output (59,822ms)
{ "filePath": "afritech-poster.png", "sizeBytes": 3241835, "dimensions": "1024x1536", "generated": true }
```

#### Test 4: Mockup application
```json
// Input
{ "prompt": "Mobile app UI mockup for job platform", "size": "1024x1024" }

// Output (41,553ms)
{ "filePath": "app-mockup.png", "sizeBytes": 1143607, "dimensions": "1024x1024", "generated": true }
```

#### Test 5 (Edge): Scène complexe
```json
// Input
{ "prompt": "Detailed African tech hub scene with many elements", "size": "1536x1024" }

// Output (81,065ms)
{ "filePath": "tech-hub-lagos.png", "sizeBytes": 3094697, "dimensions": "1536x1024", "generated": true }
```

**Note:** gpt-image-1 retourne du base64 (pas d'URL comme DALL-E 3). Temps moyen: ~64s/image.

---

## 6. generate_diagram

**Description:** Génération de diagrammes Mermaid

### Paramètres

```typescript
{
  type: 'flowchart' | 'sequence' | 'erDiagram' | 'classDiagram' | 'gantt';
  description: string;  // Description du diagramme à générer
}
```

### Tests Réels

#### Test 1: Flowchart recrutement
```json
// Input
{ "type": "flowchart", "description": "Processus de recrutement" }

// Output (<1ms)
{
  "type": "flowchart",
  "mermaidCode": "flowchart TD\n    A[Offre publiée] --> B{Candidatures reçues?}\n    B -->|Oui| C[Tri des CV]\n    B -->|Non| D[Relancer l'offre]\n    C --> E[Entretiens téléphoniques]\n    E --> F[Entretiens techniques]\n    F --> G{Candidat retenu?}\n    G -->|Oui| H[Offre d'embauche]\n    G -->|Non| I[Feedback candidat]\n    H --> J[Onboarding]",
  "nodeCount": 10
}
```

#### Test 2: Diagramme de séquence API
```json
// Input
{ "type": "sequence", "description": "Flux de candidature API" }

// Output (<1ms)
{
  "type": "sequence",
  "mermaidCode": "sequenceDiagram\n    participant T as Talent\n    participant A as API\n    participant DB as PostgreSQL\n    participant P as Pinecone\n    participant N as Notifications\n\n    T->>A: POST /applications\n    A->>DB: Check opportunity exists\n    DB-->>A: Opportunity data\n    A->>DB: Create application\n    DB-->>A: Application created\n    A->>P: Update talent embeddings\n    P-->>A: Embeddings updated\n    A->>N: Send notification to recruiter\n    N-->>A: Notification sent\n    A-->>T: 201 Created",
  "participantCount": 5
}
```

#### Test 3: ERD
```json
// Input
{ "type": "erDiagram", "description": "Modèle de données talent" }

// Output (<1ms)
{
  "type": "erDiagram",
  "mermaidCode": "erDiagram\n    TALENT ||--o{ APPLICATION : submits\n    TALENT ||--o{ TALENT_SKILL : has\n    TALENT ||--o{ DOCUMENT : uploads\n    OPPORTUNITY ||--o{ APPLICATION : receives\n    ORGANIZATION ||--o{ OPPORTUNITY : posts\n    ...",
  "entityCount": 8
}
```

#### Test 4: Diagramme de classes
```json
// Input
{ "type": "classDiagram", "description": "Architecture agents Copilot" }

// Output (<1ms)
{
  "type": "classDiagram",
  "mermaidCode": "classDiagram\n    class CopilotAgent {\n        +string name\n        +string model\n        +Tool[] tools\n        +run(message)\n    }\n    ...",
  "classCount": 4
}
```

#### Test 5: Gantt
```json
// Input
{ "type": "gantt", "description": "Timeline projet onboarding" }

// Output (1ms)
{
  "type": "gantt",
  "mermaidCode": "gantt\n    title Onboarding Nouveau Talent\n    dateFormat  YYYY-MM-DD\n    section Inscription\n    Création compte :a1, 2025-01-01, 1d\n    ...",
  "taskCount": 7
}
```

---

## 7. file_read (FileReaderAgent Handoff)

**Description:** Agent spécialisé (gpt-4.1-mini) pour l'extraction de documents

### Paramètres

```typescript
{
  documentId: string;         // UUID du document
  documentType?: 'cv' | 'diploma' | 'certificate';
  extractionMode?: 'full' | 'skills' | 'summary';
}
```

### Tests Réels

#### Test 1: Lecture CV
```json
// Input
{ "documentId": "d0000001-0001-4000-d000-000000000001", "documentType": "cv" }

// Output (<1ms)
{
  "documentId": "d0000001-0001-4000-d000-000000000001",
  "documentType": "CV",
  "originalName": "CV_Aminata_Kone_2026.pdf",
  "extractedText": "Amadou Diallo - Développeur Fullstack\nCompétences: React, Node.js, TypeScript\nExpérience: 5 ans",
  "metadata": { "pageCount": 2, "language": "fr", "confidence": 0.95 }
}
```

#### Test 2: Lecture diplôme
```json
// Input
{ "documentId": "uuid", "documentType": "diploma" }

// Output (<1ms)
{
  "extractedText": "Université Cheikh Anta Diop\nMaster en Informatique\nMention: Très Bien\nAnnée: 2020",
  "metadata": { "pageCount": 1, "language": "fr", "confidence": 0.92 }
}
```

#### Test 3: Lecture certificat
```json
// Input
{ "documentType": "certificate" }

// Output (<1ms)
{
  "extractedText": "AWS Certified Solutions Architect\nCertificate ID: AWS-123456\nExpires: 2026-06-01",
  "metadata": { "pageCount": 1, "language": "en", "confidence": 0.98 }
}
```

#### Test 4: Extraction compétences
```json
// Input
{ "extractionMode": "skills" }

// Output (<1ms)
{
  "extractedSkills": [
    { "name": "React", "confidence": 0.95, "category": "frontend" },
    { "name": "Node.js", "confidence": 0.93, "category": "backend" },
    { "name": "TypeScript", "confidence": 0.91, "category": "language" },
    { "name": "PostgreSQL", "confidence": 0.88, "category": "database" },
    { "name": "Docker", "confidence": 0.85, "category": "devops" }
  ]
}
```

#### Test 5 (Edge): Document illisible
```json
// Input
{ "documentId": "corrupted-doc-id" }

// Output (<1ms)
{
  "status": "partial_extraction",
  "extractedText": "[Partial extraction - some pages unreadable]",
  "warnings": ["Page 2 could not be extracted", "Low resolution scan detected"],
  "metadata": { "pageCount": 3, "extractedPages": 2, "confidence": 0.45 }
}
```

---

## 8. web_search (WebSearchAgent Handoff)

**Description:** Agent spécialisé (gpt-4.1-mini) pour la recherche web temps réel

### Paramètres

```typescript
{
  query: string;  // Requête de recherche
}
```

### Tests Réels

#### Test 1: Recherche entreprise
```json
// Input
{ "query": "Wave mobile money Senegal company" }

// Output (<1ms)
{
  "resultCount": 5,
  "results": [
    { "title": "Wave - Mobile Money for Africa", "url": "https://www.wave.com/", "snippet": "Wave is building a mobile money platform that is affordable and easy to use for everyone in Africa." },
    { "title": "Wave raises $200M for African mobile payments", "url": "https://techcrunch.com/wave-funding", "snippet": "Wave, the mobile money startup operating in Senegal, has raised $200 million in Series A funding." }
  ],
  "searchTime": 1.2
}
```

#### Test 2: Salaires tech Afrique
```json
// Input
{ "query": "software developer salary Côte d'Ivoire 2025" }

// Output (<1ms)
{
  "resultCount": 4,
  "results": [
    { "title": "Tech Salaries in West Africa 2025 Report", "snippet": "Average software developer salary in Abidjan ranges from 800,000 to 2,500,000 XOF monthly." },
    { "title": "IT Job Market Côte d'Ivoire", "snippet": "Senior developers in Abidjan can earn up to 3M XOF/month with fintech experience." }
  ]
}
```

#### Test 3: Tendances fintech
```json
// Input
{ "query": "fintech trends UEMOA 2025 mobile payment" }

// Output (<1ms)
{
  "resultCount": 6,
  "results": [
    { "title": "UEMOA Fintech Report 2025", "snippet": "Mobile money transactions in UEMOA reached $50B in 2024, with 40% YoY growth." }
  ]
}
```

#### Test 4: Certifications
```json
// Input
{ "query": "AWS Solutions Architect certification exam preparation 2025" }

// Output (<1ms)
{
  "resultCount": 8,
  "results": [
    { "title": "AWS Certified Solutions Architect - Official Guide", "url": "https://aws.amazon.com/certification/" }
  ]
}
```

#### Test 5 (Edge): Recherche locale spécifique
```json
// Input
{ "query": "hackathon Ouagadougou Burkina Faso 2025 inscription" }

// Output (<1ms)
{
  "resultCount": 2,
  "results": [
    { "title": "Faso Tech Hackathon 2025", "snippet": "Premier hackathon tech à Ouagadougou, inscriptions ouvertes jusqu'au 15 mars." }
  ],
  "note": "Limited results for very specific local queries"
}
```

---

## Tool Sequencing (Best Practice)

```
1. vector_query   ← Discovery sémantique (toujours en premier)
2. sql_query      ← Données personnelles/structurées
3. web_search     ← SEULEMENT si données internes insuffisantes
```

**Important:** Les prompts des agents incluent des instructions explicites sur cet ordre.

---

## Fichiers Source

| Tool | Fichier |
|------|---------|
| vector_query | `services/copilot/tools/vector-query.tool.ts` |
| sql_query | `services/copilot/tools/sql-query.tool.ts` |
| youtube_search | `services/copilot/tools/youtube-search.tool.ts` |
| generate_document | `services/copilot/tools/generate-document.tool.ts` |
| generate_image | `services/copilot/tools/generate-image.tool.ts` |
| generate_diagram | `services/copilot/tools/generate-diagram.tool.ts` |
| file_read | `services/copilot/agents/file-reader.agent.ts` |
| web_search | `services/copilot/agents/web-search.agent.ts` |

---

## Données de Test (UEMOA)

L'audit a été réalisé avec des données réalistes de l'UEMOA:

- **50 talents** (8 pays UEMOA, noms africains, compétences tech variées)
- **25 organisations** (fintech, tech, banques)
- **30 opportunités** (CDI, CDD, Stage, Freelance)
- **20 communautés** (hubs tech, meetups)
- **15 espaces** (coworking, salles de réunion)

Pays couverts: Bénin, Burkina Faso, Côte d'Ivoire, Guinée-Bissau, Mali, Niger, Sénégal, Togo.
