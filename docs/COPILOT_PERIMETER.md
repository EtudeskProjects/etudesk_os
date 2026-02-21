# Copilot Perimeter — Guide des Cas d'Usage

> Definition exacte du perimetre de chaque mode avec exemples, processus de decision (tool routing) et reponses ideales.
> Mis a jour : 21 Fevrier 2026
> **Voir aussi** : [COPILOT_ARCHITECTURE.md](./COPILOT_ARCHITECTURE.md) (architecture technique), [COPILOT_TOOLS.md](./COPILOT_TOOLS.md) (reference tools)

---

## REGLE CRITIQUE : Rendu des Entites

### Format Obligatoire

```
```entity:<type>
{"id":"<uuid>"}
```
```

**L'agent retourne UNIQUEMENT :**
- Le **type** d'entite (`opportunity`, `community`, `space`, `talent`, `organization`, `document`)
- L'**ID** (UUID) provenant des resultats des tools

**L'agent ne genere JAMAIS :**
- Titre, nom, description
- Localisation, prix, dates
- Statistiques, scores
- Aucune autre donnee

### Pourquoi ?

| Raison | Explication |
|--------|-------------|
| **Anti-hallucination** | L'IA ne peut pas inventer de donnees — elle retourne ce que les tools renvoient |
| **Coherence** | Les donnees affichees sont toujours fraiches (recuperees de la DB au rendu) |
| **Securite** | Pas de fuite de donnees via le modele IA |
| **Performance** | Payload SSE minimal, rendu optimise cote client |

### Flow de Rendu

```
1. Agent appelle tool (smart_search, sql_query)
2. Tool retourne des resultats avec IDs
3. Agent genere: ```entity:type {"id":"uuid"}```
4. Frontend parse le markdown
5. Frontend fetch GET /api/<entity>/<id>
6. Frontend affiche la carte avec donnees fraiches
```

---

## REGLE CRITIQUE : Tableaux et Charts (tous agents)

### Principe

Les **tableaux** et **visualisations** ne sont **pas des tools**. Ils sont rendus directement par le client mobile via des blocs:

```
```chart
{...json...}
```
```

**Regle absolue:** si tu dois afficher un tableau, utilise **toujours** `chart.type="table"` (pas un tableau markdown, pas une liste “quasi-tableau”).

### Types supportes

| Type | Usage | Schema minimal |
|------|-------|----------------|
| `bar` | Distribution / scores | `{"type":"bar","title":"...","data":[{"label":"A","value":10}]}` |
| `donut` | Parts d'un total | `{"type":"donut","title":"...","data":[{"label":"A","value":30}],"total_label":"Total"}` |
| `stacked_bar` | Funnel / segments | `{"type":"stacked_bar","title":"...","data":[{"label":"X","segments":[{"key":"a","value":1,"color":"primary"}]}]}` |
| `metric` | KPI unique | `{"type":"metric","title":"...","value":23.5,"unit":"%","trend":{"direction":"up","delta":5.2,"period":"vs mois precedent"}}` |
| `table` | Tableau de donnees | `{"type":"table","title":"...","columns":["Col A","Col B"],"rows":[["A",1],["B",2]]}` |
| `radar` | RH / bilan de competences | `{"type":"radar","title":"...","axes":["Hard","Soft","Knowledge"],"max":5,"series":[{"name":"Actuel","values":[3,2,4]}]}` |

### Exemple RH : bilan de competences en radar

```
```chart
{"type":"radar","title":"Bilan de competences (RH)","axes":["Hard skills","Soft skills","Knowledge","Profondeur","Seniorite"],"max":5,"series":[{"name":"Actuel","values":[3,2,3,3,2]}]}
```
```

---

## Entites de la Plateforme

### Types d'Entites Supportes

| Type | Table DB | Endpoint API | Description |
|------|----------|--------------|-------------|
| `talent` | `talents` | `/api/talents/:id` | Profil utilisateur |
| `organization` | `organizations` | `/api/organizations/:id` | Organisation/entreprise |
| `opportunity` | `opportunities` | `/api/opportunities/:id` | Offre (emploi, stage, freelance) |
| `community` | `communities` | `/api/communities/:id` | Communaute |
| `space` | `spaces` | `/api/spaces/:id` | Espace reservable |
| `document` | `talent_documents` | `/api/talents/documents/:id` | Document genere (CV, rapport) |

### Entites NON Rendues en Carte

| Type | Raison | Comment les afficher |
|------|--------|---------------------|
| `publication` | Contenu contextuel | Lien ou citation inline |
| `application` | Relation, pas ressource | Chart table (`type:"table"`) ou liste texte |
| `booking` | Relation, pas ressource | Chart table (`type:"table"`) ou liste texte |
| `notification` | Ephemere | Liste texte |

---

## Vue d'ensemble des 3 Modes

| Mode | Agent | Objectif | Entites Affichables |
|------|-------|----------|---------------------|
| **Explore** | TalentAgent | Decouverte plateforme + actions talent | `opportunity`, `community`, `space`, `talent`, `organization`, `document` |
| **Study** | TalentAgent | Apprentissage + gestion competences | Aucune (mode pedagogique) |
| **Organization** | OrgAgent | Gestion organisation + creation d'entites | `talent`, `opportunity`, `document` |

### Allocation des 12 Tools par Mode (source : [COPILOT_TOOLS.md](./COPILOT_TOOLS.md))

| Tool | Explorer (6) | Study (9) | Org (6) |
|------|:-:|:-:|:-:|
| `smart_search` | x | | x |
| `sql_query` | x (all my_*) | x (4 intents: my_profile, my_triggers, my_community_feed, my_community_members) | x (org_* only) |
| `youtube_search` | | x | |
| `analyze_youtube_video` | | x | |
| `generate_document` | x | | x |
| `generate_image` | | x | |
| `generate_diagram` | | x | |
| `manage_skills` | | x | |
| `execute_action` | x | | x |
| `file_reader` | x | x | x |
| `web_search` | x | x | x |
| `cv_generation` | x | | |

**Modeles LLM** : Voir [AI_MODELS.md](./AI_MODELS.md) pour les constantes, providers et pricing.

---

## Mode 1 : EXPLORE

### Perimetre

| Categorie | Accessible | Non Accessible |
|-----------|------------|----------------|
| **Opportunites** | Recherche, details, recommandations, candidature | Creation, modification |
| **Communautes** | Recherche, details, adhesion | Creation, moderation |
| **Espaces** | Recherche, disponibilites, reservation | Creation |
| **Talents** | Recherche profils publics | Donnees privees |
| **Documents perso** | Lecture, analyse, generation CV | Suppression |
| **Candidatures** | Statut, historique, soumission | — |
| **Invitations** | Accepter, decliner | — |
| **Creation d'entites** | Via confirmation (si admin org) | Creation directe |
| **Communautes (activites)** | Feed d'activites, membres (communautes rejointes) | Creation, moderation |

### Tools Disponibles (6 tools + cv_generation)

| Tool | Usage |
|------|-------|
| `smart_search` | Recherche semantique 3 phases (Pinecone → PostgreSQL → keyword fallback) |
| `sql_query` | Tous les intents my_* (11 intents) — donnees personnelles |
| `generate_document` | Generation PDF/DOCX/CSV/XLS/TXT + CV brande |
| `file_reader` | Lecture directe d'UN document (PDF/texte). Cache par session. |
| `web_search` | Recherche web externe (OpenAI Responses API) |
| `execute_action` | 7 actions : apply, join, book, accept/decline, create/update_agenda_trigger |
| `cv_generation` | Sub-agent generation CV avec timeout 30s |

### Skills Disponibles (Explore — 5 skills)

| Skill | Declencheur | Description |
|-------|-------------|-------------|
| **CV Generation** | "genere mon CV", "cree un CV" | Workflow complet de generation CV PDF |
| **Interview Preparation** | "entretien", "interview", "preparer mon entretien" | Guide de preparation personnalise |
| **Career & Compensation Guide** | "salaire", "remuneration", "benchmark", "negocier", "freelance", "TJM" | Analyse salariale + negociation + freelance |
| **Application Tracker** | "candidatures", "suivi", "postuler", "stage", "freelance" | Suivi candidatures et recherche |
| **Onboarding** | "c'est parti", "bienvenue", "premiere fois", "comment commencer" | Accueil nouveaux utilisateurs |

---

### Exemples — Mode Explore

#### Exemple 1 : Recherche d'opportunites

| Element | Detail |
|---------|--------|
| **Question** | "Trouve-moi des stages en developpement web a Dakar" |
| **Processus** | Recherche semantique opportunites -> `smart_search` |
| **Tool call** | `smart_search(query: "stage developpement web Dakar", entity: "opportunities", limit: 5)` |

**Reponse ideale :**
```
J'ai trouve 2 offres de stage en developpement web a Dakar :

```entity:opportunity
{"id":"550e8400-e29b-41d4-a716-446655440001"}
```

```entity:opportunity
{"id":"6ba7b810-9dad-11d1-80b4-00c04fd430c8"}
```

Tu veux que je t'aide a preparer ta candidature ?
```

---

#### Exemple 2 : Candidature assistee avec confirmation

| Element | Detail |
|---------|--------|
| **Question** | "Postule pour moi a l'offre Wave que j'ai en favoris" |
| **Processus** | 1. Trouver l'offre -> `sql_query` (bookmarks)<br>2. Verifier CV disponible -> `sql_query`<br>3. Confirmation -> bloc `confirmation` |

**Reponse ideale :**
```
J'ai trouve l'offre **Backend Developer** chez Wave dans tes favoris.

## Verification pre-candidature
- CV disponible (mis a jour il y a 2 semaines)
- Profil complet

```entity:opportunity
{"id":"opp-wave-backend-001"}
```

```confirmation
{"action":"apply_opportunity","entity_id":"opp-wave-backend-001","title":"Postuler a cette offre ?","description":"Backend Developer chez Wave - Dakar","confirm_label":"Postuler","cancel_label":"Annuler"}
```
```

---

#### Exemple 3 : Generation de CV

| Element | Detail |
|---------|--------|
| **Question** | "Genere-moi un CV" |
| **Processus** | Skill CV Generation -> sql_query (bookmarks, documents) -> file_reader -> generate_document |

**Reponse ideale :**
```
J'ai analyse ton profil et tes favoris pour creer un CV adapte.

```entity:document
{"id":"doc-uuid-new-cv-001"}
```

Tu veux que je modifie quelque chose ?
```

*(Retourne UNIQUEMENT l'ID du document genere)*

---

### Retours reels des tools (voir [COPILOT_TOOLS.md](./COPILOT_TOOLS.md) pour tous les details)

**smart_search retourne :** `{ results: [{ id, title, summary, type, matchScore, source, ... }], totalFound: N }`
**sql_query retourne :** `{ applications: [...] }`, `{ skills: [...] }`, `{ documents: [...] }`, etc. (cle = type d'entite)
**generate_document retourne :** `{ success: true, id: "uuid", documentType, downloadUrl, filename, metadata }`
**execute_action retourne :** `{ success: true/false, message: "...", applicationId/membershipId/bookingId }`
**manage_skills retourne :** `{ success: true/false, message: "...", skill: { name, level, origin } }`
**generate_diagram retourne :** `{ success: true, title, diagramType, mermaidCode, renderHint: "client-side" }`

### Composant Confirmation d'Action (Explore)

```confirmation
{"action":"apply_opportunity","entity_id":"opp-uuid","title":"Postuler a cette offre ?","description":"Dev Full-Stack chez Wave","confirm_label":"Postuler","cancel_label":"Annuler"}
```

**Actions supportees — Explore :**

| Action | Description | `entity_id` | `data` |
|--------|-------------|-------------|--------|
| `apply_opportunity` | Candidature a une offre | ID opportunite | — |
| `join_community` | Adhesion a une communaute | ID communaute | — |
| `book_space` | Reservation d'un espace | ID espace | `{"startDatetime":"...","endDatetime":"..."}` |
| `accept_invitation` | Accepter une invitation | ID invitation | — |
| `decline_invitation` | Decliner une invitation | ID invitation | — |
| `publish_opportunity` | Publier une offre (admin org) | ID organisation | Champs de l'offre + `organization_id` |
| `create_community` | Creer une communaute (admin org) | ID organisation | Champs communaute + `organization_id` |
| `create_space` | Creer un espace (admin org) | ID organisation | Champs espace + `organization_id` |

**Champs obligatoires :** `action`, `entity_id`, `title`, `description`, `confirm_label`, `cancel_label`
**Pour les actions de creation :** ajouter un champ `data` contenant tous les champs de l'entite + `organization_id`

**IMPORTANT :** Les actions de creation (`publish_opportunity`, `create_community`, `create_space`) ne sont disponibles que pour les utilisateurs qui sont admin d'une organisation (verifie via le contexte `user_data.org_admin`).

### REGLE DE PREVISUALISATION (CRITIQUE)

**TOUJOURS afficher une previsualisation structuree AVANT le bloc confirmation.** JAMAIS de bloc confirmation sans preview au-dessus.

#### Previsualisation par type d'action

| Action | Contenu de la preview |
|--------|----------------------|
| `apply_opportunity` | 1. Carte entite de l'offre<br>2. Statut CV (disponible ou manquant)<br>3. Questions de candidature avec reponses generees<br>4. Completude du profil |
| `join_community` | 1. Carte entite de la communaute<br>2. Type d'acces, payante ou non, nombre de membres<br>3. Regles de la communaute<br>4. Questions d'adhesion avec reponses generees |
| `book_space` | 1. Carte entite de l'espace<br>2. Creneau demande (date, heures)<br>3. Tarif horaire et cout total estime<br>4. Confirmation de disponibilite<br>5. Capacite, equipement, commodites |
| `accept/decline_invitation` | 1. Type d'invitation (communaute/organisation)<br>2. Nom de l'entite<br>3. Role propose |
| `publish_opportunity` | Resume structure : titre, contrat, lieu, remuneration, description, exigences |
| `create_community` | Resume structure : nom, type, acces, secteurs, lieu, description |
| `create_space` | Resume structure : nom, type, surface, capacite, tarifs, equipement |

#### Exemples de preview detaillee

**Candidature (`apply_opportunity`) :**
```
```entity:opportunity
{"id":"opp-uuid"}
```

## Verification pre-candidature
- **CV** : CV_Amadou_2025.pdf (mis a jour il y a 2 semaines)
- **Profil** : Complet (bio, competences, contact)
- **Questions de candidature** :
  1. "Decrivez votre experience avec les APIs de paiement"
     → Reponse : "3 ans d'experience en integration Wave/MTN Money..."
  2. "Pourquoi ce poste ?"
     → Reponse : "Passionne par l'inclusion financiere en Afrique..."

```confirmation
{"action":"apply_opportunity",...}
```
```

**Adhesion communaute (`join_community`) :**
```
```entity:community
{"id":"comm-uuid"}
```

## Details de la communaute
- **Acces** : Sur candidature | **Membres** : 1 200
- **Type** : Professionnel | **Gratuite**
- **Regles** : Code de conduite tech, participation mensuelle requise
- **Questions d'adhesion** :
  1. "Votre domaine d'expertise ?"
     → Reponse : "Developpeur Full-Stack, Node.js/React, 3 ans fintech"

```confirmation
{"action":"join_community",...}
```
```

**Reservation espace (`book_space`) :**
```
```entity:space
{"id":"space-uuid"}
```

## Details de la reservation
- **Creneau** : Lundi 10 fev 2026, 9h00 - 17h00 (8h)
- **Tarif** : 5 000 XOF/h → **Total estime : 40 000 XOF**
- **Disponibilite** : Creneau libre
- **Capacite** : 30 pers. | **Equipement** : Wifi, Projecteur, Tableau blanc
- **Commodites** : Climatisation, Parking, Cuisine

```confirmation
{"action":"book_space","data":{"startDatetime":"...","endDatetime":"..."},...}
```
```

---

## Mode 2 : STUDY

### Fondements Pedagogiques

Le mode Study s'appuie sur 4 principes des sciences de l'education :

| Principe | Application |
|----------|-------------|
| **Apprentissage actif** (Bloom) | Quizzes > explications passives. Le learner FAIT avant de lire. |
| **Zone proximale de developpement** (Vygotsky) | Adapter la difficulte au niveau actuel + 1 cran. Ni trop facile, ni trop dur. |
| **Repetition espacee** (Ebbinghaus) | Flashcards pour ancrer les concepts. Revenir sur les erreurs. |
| **Differenciation pedagogique** (Tomlinson) | Adapter style, rythme et profondeur au contexte de l'apprenant (skills, niveau, historique de conversation). Le LLM infere naturellement le bon format. |

### Perimetre

| Categorie | Accessible | Non Accessible |
|-----------|------------|----------------|
| **Mes competences** | Lecture, ajout, mise a jour niveau | Suppression |
| **Mes documents** | Analyse, extraction competences | Modification, generation |
| **YouTube** | Recherche (si demande ou style AUDITORY) | — |
| **Images** | Generation pedagogique | — |
| **Diagrammes** | Generation Mermaid | — |
| **Quiz/Flashcards** | Generation directe | — |
| **Opportunites** | — | Toute recherche |
| **Communautes** | — | Toute recherche |
| **Espaces** | — | Toute recherche |
| **Actions** | — | Toute action (postuler, rejoindre, reserver, creer) |

### Tools Disponibles (9 tools)

| Tool | Usage |
|------|-------|
| `sql_query` (restreint) | 4 intents : my_profile, my_triggers, my_community_feed, my_community_members. Skills et documents sont deja dans le contexte. |
| `youtube_search` | YouTube Data API v3 (maxResults 1-5, priorite francophone UEMOA) |
| `analyze_youtube_video` | Analyse pedagogique video via Gemini 2.5 Flash |
| `generate_image` | gpt-image-1 (1024x1024, 1536x1024, 1024x1536) |
| `generate_diagram` | Mermaid : flowchart, sequence, class, mindmap, timeline, gantt, pie, ER |
| `file_reader` | Lecture directe d'UN document (PDF/texte). Cache par session. |
| `web_search` | Recherche web externe (OpenAI Responses API) |
| `manage_skills` | Actions add/update competences (BEGINNER → MASTER) |
| `execute_action` | create/update_agenda_trigger uniquement |

**Tools NON disponibles en Study (3 bloques) :**
- `smart_search` — pas de recherche d'entites
- `generate_document` — pas de generation de documents
- `cv_generation` — pas de generation CV

### Skills Disponibles (Study — 8 skills)

| Skill | Declencheur | Description |
|-------|-------------|-------------|
| **Deep Dive Lesson** | "cours", "lecon", "apprends-moi", "socratique", "projet", "mini-projet" | Cours structure 6 etapes + methode socratique + projet guide |
| **Exam & Revision** | "examen", "teste-moi", "revision", "certification", "spaced repetition" | Simulation examen + revision espacee + certification skill |
| **Document Study Session** | "etudier ce document", "analyser ce PDF", "etudier cette video" | Analyse document/video → resume + flashcards + quiz |
| **Weekly Recap** | "recap", "bilan semaine", "progression", "mon avancement" | Bilan hebdo skills + chart + recommandations |
| **Autodiagnostic Talent** | "autodiagnostic", "bilan competences", "mes lacunes" | Diagnostic competences + plan developpement |
| **HR Skill Radar** | "radar", "radar competences", "spider chart" | Bilan competences en radar chart (partage avec org) |
| **Learning Path Generator** | (fusionne dans deep-dive-lesson) | Roadmap apprentissage avec gap analysis |
| **Code Review Mentor** | (fusionne dans deep-dive-lesson) | Review pedagogique + quiz |

### REGLE CRITIQUE : UN SEUL COMPOSANT PAR OUTPUT

| Composants | Interdit de combiner |
|------------|---------------------|
| `youtube` | + diagram, + quiz, + flashcard |
| `diagram` | + youtube, + quiz, + flashcard |
| `quiz` | + youtube, + diagram, + flashcard |
| `flashcard` | + youtube, + diagram, + quiz |
| `image` | + youtube, + diagram, + quiz |
| `chart` | + youtube, + diagram, + quiz, + flashcard |

**Choisir UN SEUL composant par message.**

### Selection de Composant

Le choix du composant depend d'abord du **sujet** et de la **demande**, puis le learning style depart les cas ambigus :

| Intent utilisateur | Composant par defaut | Le style peut orienter vers... |
|-------------------|---------------------|-------------------------------|
| "Explique X" (theorie) | flashcard | diagram (VISUAL), quiz (INTERACTIVE) |
| "Montre-moi" (demo) | code block ou youtube | diagram (VISUAL) |
| "Exercice" / "Pratique" | quiz ou code block | — (quiz dans tous les cas) |
| "Schema" / "Architecture" | diagram | — (diagram dans tous les cas) |
| "Teste-moi" | quiz | — (quiz dans tous les cas) |

**PRATIQUE > VIDEO** : Pour un sujet pratique (code, algorithmes), generer un `quiz` ou un bloc `code` — PAS une video.

### Protocole d'Evaluation Rapide (3 Questions)

Utilise ce protocole pour evaluer un sujet et ajuster les competences :

```
Q1 (Rappel)     → Teste la memorisation basique
   ↓ feedback
Q2 (Application) → Teste la capacite a appliquer
   ↓ feedback
Q3 (Analyse)     → Teste la comprehension profonde
   ↓ bilan

Score 3/3 → proposer manage_skills (add/update, origin=inferred, type adapte) + ressource avancee
Score 2/3 → flashcard sur le point faible + suggestion approfondissement
Score 1/3 → cours fondamental (youtube/web_search)
Score 0/3 → encouragement + demarrage session d'apprentissage
```

**IMPORTANT** : Une seule question par message. C'est une CONVERSATION, pas un examen.

### Gestion des Competences (manage_skills)

| Action | Declencheur | Tool |
|--------|-------------|------|
| **Ajouter** | Assessment 3/3 ou 2/3 | `manage_skills` (add, BEGINNER ou INTERMEDIATE) |
| **Monter niveau** | User montre maitrise au-dela du niveau actuel | `manage_skills` (update) |
| **Extraire** | file_reader trouve skill dans CV/certificat | `manage_skills` (add, origin=extracted) |
| **Inferer** | Quiz/performance ou indices conversationnels solides | `manage_skills` (add/update, origin=inferred) |
| **Declare** | User dit "je connais X" | `manage_skills` (add/update, origin=declared) |

**Niveaux (backend) :** BEGINNER -> INTERMEDIATE -> EXPERT -> MASTER
**Origins (backend) :** declared | inferred | extracted
**Types (backend) :** HARD_SKILL | SOFT_SKILL | KNOWLEDGE
**Champs requis :** action, skillName, proficiencyLevel, origin, type (toujours demander confirmation avant l'appel).
**INTERDIT :** Suppression de competence (pas d'action "remove" disponible)

### Entites en Mode Study

**AUCUNE carte entite.** Ce mode est purement pedagogique.

---

### Exemples — Mode Study

#### Exemple 1 : Apprentissage adapte au style VISUAL

| Element | Detail |
|---------|--------|
| **Question** | "Explique-moi le pattern MVC" |
| **Preferences** | style=VISUAL, interaction=DIRECT, depth=BALANCED, difficulty=STANDARD |
| **Skills** | JavaScript (intermediate), aucune skill "architecture" |
| **Processus** | 1. Pas de skill architecture → niveau debutant<br>2. Style VISUAL → diagram, pas flashcard<br>3. DIRECT → explication concise, pas de questions guidees<br>4. Tool: `generate_diagram` |

**Reponse ideale :**
```
Le MVC separe une application en 3 couches distinctes.

**Model** — les donnees et la logique metier (ex: classe `User` qui gere la DB).
**View** — l'interface utilisateur (ex: page HTML, composant React).
**Controller** — le chef d'orchestre qui recoit les requetes et coordonne Model et View.

Exemple concret : quand tu cliques "Ajouter au panier", le Controller recoit l'action, demande au Model de mettre a jour le stock, puis dit a la View d'afficher le nouveau total.

```diagram
{"type":"flowchart","title":"Pattern MVC","code":"flowchart LR\n  U[Utilisateur] -->|Action| C[Controller]\n  C -->|Lit/Ecrit| M[Model]\n  M -->|Notifie| V[View]\n  V -->|Affiche| U"}
```

Tu veux un quiz pour verifier ta comprehension ?
```

*(Style VISUAL → diagramme. DIRECT → pas de question socratique. BALANCED → theorie + exemple concret.)*

---

#### Exemple 2 : Apprentissage SOCRATIQUE + INTERACTIVE

| Element | Detail |
|---------|--------|
| **Question** | "Je veux comprendre les closures en JavaScript" |
| **Preferences** | style=INTERACTIVE, interaction=SOCRATIC, depth=PRACTICAL, difficulty=STANDARD |
| **Skills** | JavaScript (beginner) |
| **Processus** | 1. JS beginner → adapter la difficulte<br>2. INTERACTIVE → commencer par un quiz, pas une explication<br>3. SOCRATIC → poser une question guidee avant de reveler<br>4. Pas de tool necessaire |

**Reponse ideale :**
```
Les closures sont un concept central en JavaScript.

Avant d'expliquer, regarde ce code et dis-moi ce que `counter()` affiche :

```javascript
function createCounter() {
  let count = 0;
  return function() {
    count++;
    return count;
  };
}
const counter = createCounter();
console.log(counter()); // ?
console.log(counter()); // ?
```

```quiz
{"topic":"JavaScript Closures","question":"Que retourne le deuxieme appel a counter() ?","options":["0","1","2","undefined"]}
```
```

*(INTERACTIVE → quiz d'emblee. SOCRATIC → "dis-moi ce que..." avant de reveler. PRACTICAL → code concret.)*

**Message suivant (apres reponse "2" de l'utilisateur) :**
```
Exact ! counter() retourne 2 au deuxieme appel.

C'est une **closure** : la fonction interne "se souvient" de la variable `count` meme apres que `createCounter()` a termine. La variable survit dans la portee lexicale.

**Cas pratique** : les closures sont partout — event handlers, callbacks, React hooks (useState utilise une closure en interne).

```flashcard
{"topic":"JavaScript Closures","front":"Qu'est-ce qu'une closure ?","back":"Une fonction qui garde acces aux variables de sa portee parente, meme apres que celle-ci a termine son execution.","difficulty":"medium"}
```

On passe aux cas avances (closures dans les boucles) ?
```

---

#### Exemple 3 : Evaluation rapide (3 questions) → ajout competence

| Element | Detail |
|---------|--------|
| **Question** | "Teste-moi sur Python" |
| **Preferences** | style=TEXT_BASED, interaction=DIRECT, depth=BALANCED, difficulty=STANDARD |
| **Skills** | Aucune skill Python declaree |
| **Processus** | 1. Skill Assessment activee → protocole 3 questions<br>2. Pas de skill Python → commencer par Rappel (easy)<br>3. TEXT_BASED + DIRECT → questions directes et claires |

**Message 1 — Q1 Rappel :**
```
Evaluons ton niveau Python en 3 questions.

**Question 1/3 — Rappel :**

```quiz
{"topic":"Python","question":"Quelle est la difference entre une liste et un tuple en Python ?","options":["Les listes sont immuables, les tuples mutables","Les listes sont mutables, les tuples immuables","Il n'y a aucune difference","Les tuples ne peuvent contenir que des nombres"]}
```
```

**Message 2 (apres bonne reponse) — Q2 Application :**
```
Correct ! Les listes sont mutables (`append`, `remove`), les tuples immuables (plus rapides, hashables).

**Question 2/3 — Application :**

```quiz
{"topic":"Python","question":"Quel est le resultat de : [x**2 for x in range(5) if x % 2 == 0] ?","options":["[0, 4, 16]","[1, 9, 25]","[0, 2, 4]","[4, 16]"]}
```
```

**Message 3 (apres bonne reponse) — Q3 Analyse :**
```
Exact ! La list comprehension filtre les pairs puis eleve au carre : [0, 4, 16].

**Question 3/3 — Analyse :**

```quiz
{"topic":"Python","question":"Pourquoi 'a = [1,2]; b = a; b.append(3)' modifie aussi 'a' ?","options":["Bug Python","a et b pointent vers le meme objet en memoire","append() modifie toutes les listes","Les listes sont immuables"]}
```
```

**Message 4 (apres bonne reponse) — Bilan :**
```
Parfait ! 3/3 — tu maitrises les fondamentaux Python.

```chart
{"type":"bar","title":"Evaluation Python","data":[{"label":"Rappel","value":1},{"label":"Application","value":1},{"label":"Analyse","value":1}]}
```

Tu as demontre une bonne comprehension des structures de donnees et de la gestion memoire. J'ajoute **Python** a tes competences au niveau **intermediaire** ?
```

**Si confirmation :** `manage_skills({action:"add", skillName:"Python", proficiencyLevel:"INTERMEDIATE", origin:"inferred", type:"HARD_SKILL"})`

**Ensuite :** "Tu veux explorer les decorateurs Python ou passer a un autre sujet ?"

---

#### Exemple 4 : Analyse de CV → inference de competences → parcours

| Element | Detail |
|---------|--------|
| **Question** | "Analyse mon CV" (avec piece jointe) |
| **Preferences** | style=TEXT_BASED, interaction=DIRECT |
| **Skills** | JavaScript (beginner) |
| **Processus** | 1. Piece jointe → `file_reader` immediatement<br>2. Extraire competences du document<br>3. Comparer avec skills declarees → proposer ajouts<br>4. Suggerer un parcours d'approfondissement |

**Reponse ideale :**
```
J'ai analyse ton CV. Voici les competences detectees :

**Deja declarees :**
- JavaScript (beginner) — ton CV mentionne 3 ans d'experience → je suggere **intermediate**

**Nouvelles competences detectees :**
- React (2 projets mentionnes)
- Node.js (backend API)
- PostgreSQL (gestion de base de donnees)

Tu veux que je mette a jour JavaScript a **intermediate** et que j'ajoute React, Node.js et PostgreSQL ?
```

**Si confirmation :**
1. `manage_skills({action:"update", skillName:"JavaScript", proficiencyLevel:"INTERMEDIATE", origin:"inferred", type:"HARD_SKILL"})`
2. `manage_skills({action:"add", skillName:"React", proficiencyLevel:"BEGINNER", origin:"extracted", type:"HARD_SKILL"})`
3. `manage_skills({action:"add", skillName:"Node.js", proficiencyLevel:"BEGINNER", origin:"extracted", type:"HARD_SKILL"})`
4. `manage_skills({action:"add", skillName:"PostgreSQL", proficiencyLevel:"BEGINNER", origin:"extracted", type:"HARD_SKILL"})`

**Message suivant :** "Ton profil est enrichi. Tu veux approfondir React ou Node.js ? Je peux te faire un assessment rapide."

---

#### Exemple 5 : Apprentissage style AUDITORY + parcours de decouverte

| Element | Detail |
|---------|--------|
| **Question** | "Je veux apprendre le machine learning" |
| **Preferences** | style=AUDITORY, interaction=EXPLORATORY, depth=THEORETICAL, difficulty=GENTLE |
| **Skills** | Python (beginner), aucune skill ML |
| **Processus** | 1. AUDITORY → youtube video preferee<br>2. EXPLORATORY → connecter a d'autres sujets<br>3. GENTLE → vocabulaire simple, pas de formules complexes<br>4. THEORETICAL → expliquer le "pourquoi" avant le "comment"<br>5. Tool: `youtube_search("machine learning introduction debutant")` |

**Reponse ideale :**
```
Le machine learning, c'est apprendre a un ordinateur a trouver des patterns dans les donnees.

**L'idee cle** : au lieu de programmer des regles ("si temperature > 30 → chaud"), on donne des exemples au programme et il deduit les regles tout seul. C'est comme apprendre a un enfant en lui montrant des photos : "ca c'est un chat, ca c'est un chien" — apres 1000 photos, il sait distinguer sans qu'on lui explique les regles.

Ca se connecte a ce que tu connais deja en Python — les librairies comme scikit-learn et TensorFlow sont ecrites en Python.

```youtube
{"videoId":"ukzFI9rgwfU","title":"Machine Learning pour les debutants","channelName":"3Blue1Brown","description":"Introduction visuelle et intuitive au ML"}
```

Tu veux qu'on explore les 3 types de ML (supervise, non-supervise, renforcement) ?
```

*(AUDITORY → video. GENTLE → analogie enfant/photos. THEORETICAL → explique le concept avant la pratique. EXPLORATORY → propose d'explorer les branches connexes.)*

---

#### Exemple 6 : Evaluation echouee → parcours de rattrapage

| Element | Detail |
|---------|--------|
| **Question** | "Teste-moi sur SQL" |
| **Preferences** | style=INTERACTIVE, interaction=DIRECT, difficulty=STANDARD |
| **Skills** | Aucune skill SQL |
| **Resultat** | 1/3 correct (Q1 bonne, Q2 et Q3 fausses) |

**Message final (apres les 3 questions) :**
```
Les bases SQL meritent d'etre renforcees. Tu maitrises les SELECT basiques, mais les JOINs et les sous-requetes demandent plus de pratique.

```chart
{"type":"bar","title":"Evaluation SQL","data":[{"label":"Rappel","value":1},{"label":"Application","value":0},{"label":"Analyse","value":0}]}
```

Le point cle a travailler : les **JOINs** — c'est la base pour combiner des tables.

```flashcard
{"topic":"SQL JOINs","front":"Quelle est la difference entre INNER JOIN et LEFT JOIN ?","back":"INNER JOIN retourne uniquement les lignes avec correspondance dans les 2 tables. LEFT JOIN retourne TOUTES les lignes de la table gauche, meme sans correspondance.","difficulty":"medium"}
```

Je te propose un mini-cours sur les JOINs avec des exercices pratiques ?
```

*(1/3 → pas d'ajout de competence. Flashcard sur le point faible. Proposition de parcours de rattrapage.)*

---

## Mode 3 : ORGANIZATION

### Perimetre

| Categorie | Accessible | Non Accessible |
|-----------|------------|----------------|
| **Membres** | Liste, roles, stats | Suppression, changement role |
| **Candidatures recues** | Liste, details, filtrage | Accept/reject automatique |
| **Opportunites propres** | Liste, stats, **creation via confirmation** | Modification, suppression |
| **Communautes propres** | Liste, stats, **creation via confirmation** | Modification, suppression |
| **Espaces propres** | Liste, stats, **creation via confirmation** | Modification, suppression |
| **Recherche talents** | Profils, competences | Contact direct |
| **Rapports** | Generation PDF | — |
| **Documents** | Liste, lecture, analyse (PDF, contrats, fiches de poste) | Suppression, modification |
| **Talents CRM** | Vue agregee 4 sources, profil detaille, skills | Contact direct |
| **Activites communautes** | Feed (posts, events, polls), membres | Creation, moderation |
| **Donnees personnelles** | — | my_profile, my_documents, my_skills (rediriger vers Explorer) |
| **Autres organisations** | — | Tout acces |

### Tools Disponibles (6 tools)

| Tool | Usage |
|------|-------|
| `smart_search` | Recherche semantique (talents, opportunites marche) |
| `sql_query` (restreint org) | org_* intents uniquement (13 + 6 analytics = 19 intents) |
| `generate_document` | Fiches de poste, rapports, exports PDF/DOCX/CSV/XLS/TXT (brande org) |
| `file_reader` | Lecture documents org + documents talents avec interaction verifiee (CVs candidats) |
| `web_search` | Benchmark marche, tendances secteur (OpenAI Responses API) |
| `execute_action` | Actions talent + create/update_agenda_trigger |

**Tools NON disponibles en Organization (6 bloques) :**
- `manage_skills` — pas de gestion de competences
- `youtube_search` — pas de recherche video
- `analyze_youtube_video` — pas d'analyse video
- `generate_image` — pas de generation d'images
- `generate_diagram` — pas de generation de diagrammes
- `cv_generation` — pas de generation CV

**Intents SQL autorises en mode Org (19 intents) :**
```
org_members, org_applications, org_stats, org_opportunities, org_communities, org_spaces,
org_invitations, org_triggers, org_documents, org_talents, org_talent_profile,
org_community_feed, org_community_members,
org_skills_analytics, org_application_funnel, org_talent_cohorts,
org_geo_distribution, org_community_engagement, org_opportunity_performance
```

**Intents SQL bloques en mode Org (IDOR par design) :**
Tous les `my_*` intents — rediriger l'utilisateur vers le mode Explorer.

### Skills Disponibles (Organization — 10 skills)

| Skill | Declencheur | Description |
|-------|-------------|-------------|
| **Candidate Ranking** | "classe les candidats", "meilleurs profils", "shortlist" | Scoring et classement des candidatures |
| **Opportunity Publishing** | "publie une offre", "cree un poste", "recrute", "CDI", "CDD" | Creation d'une offre sur la plateforme |
| **Community Creation** | "cree une communaute", "nouvelle communaute" | Creation d'une communaute |
| **Space Creation** | "cree un espace", "nouvel espace", "coworking" | Creation d'un espace/lieu |
| **Job Description Generation** | "fiche de poste", "job description", "profil de poste" | Generation fiche de poste PDF brandee |
| **Org Analytics** | "cohorte", "dashboard", "funnel", "rapport PDF", "tableau de bord" | Analytics cohortes + rapports PDF |
| **Talent Outreach** | "trouver talents", "sourcing", "chercher candidats", "profils tech" | Sourcing proactif de talents |
| **HR Skill Radar** | "radar", "radar competences", "bilan rh" | Bilan competences en radar chart |

### Entites Affichables (Organization)

| Type | Quand |
|------|-------|
| `talent` | Recherche de profils, candidats |
| `opportunity` | Opportunites de l'organisation uniquement |
| `document` | Documents generes (fiches de poste, rapports) |

**INTERDIT en mode Org :** `entity:community`, `entity:space`, `entity:organization`
**NOTE :** L'agent peut rechercher communautes/espaces via sql_query (org_communities, org_spaces, search_*), mais les resultats sont affiches en **chart table** (`type:"table"`) ou en texte, jamais en cartes entites.

---

### DISTINCTION CRITIQUE : Generer vs Creer

Cette distinction est la plus importante du mode Organization. Elle determine si l'agent produit un **document PDF** ou **cree une entite dans la base de donnees**.

| Intention utilisateur | Action agent | Tool/Bloc | Resultat |
|----------------------|-------------|-----------|----------|
| "Genere une fiche de poste" | PDF | `generate_document` | Document PDF telechargeable |
| "Fais un rapport" | PDF | `generate_document` | Document PDF telechargeable |
| "**Publie** une offre" | Creation DB | `confirmation` block (`publish_opportunity`) | Opportunite creee sur Etudesk |
| "**Cree** un poste" | Creation DB | `confirmation` block (`publish_opportunity`) | Opportunite creee sur Etudesk |
| "**Recrute** un dev" | Creation DB | `confirmation` block (`publish_opportunity`) | Opportunite creee sur Etudesk |
| "**Cree** une communaute" | Creation DB | `confirmation` block (`create_community`) | Communaute creee sur Etudesk |
| "**Cree** un espace" | Creation DB | `confirmation` block (`create_space`) | Espace cree sur Etudesk |

**Mots-cles PDF :** genere, redige, ecris, fiche, rapport, export
**Mots-cles Creation :** publie, cree, lance, poste, recrute, ouvre

---

### Composant Confirmation d'Action (Organization)

**Actions supportees — Organization :**

| Action | Description | `entity_id` | `data` requis |
|--------|-------------|-------------|---------------|
| `publish_opportunity` | Publier une offre d'emploi | ID organisation | Oui (voir ci-dessous) |
| `create_community` | Creer une communaute | ID organisation | Oui (voir ci-dessous) |
| `create_space` | Creer un espace | ID organisation | Oui (voir ci-dessous) |

#### Schema `data` pour `publish_opportunity`

| Champ | Requis | Type | Exemple |
|-------|--------|------|---------|
| `organization_id` | Oui | UUID | ID de l'organisation |
| `title` | Oui | string | "Directeur Commercial" |
| `summary` | Oui | string | Description du poste |
| `contract_type` | Oui | enum | CDI, CDD, STAGE, FREELANCE, ALTERNANCE, INTERIM, BENEVOLAT |
| `type` | Non | enum | JOB, INTERNSHIP, FREELANCE, VOLUNTEER, APPRENTICESHIP |
| `work_rhythm` | Non | enum | FULL_TIME, PART_TIME, FLEXIBLE |
| `location_type` | Non | enum | ON_SITE, REMOTE, HYBRID |
| `locations` | Non | array | `[{"city":"Abidjan","country":"CI"}]` |
| `requirements` | Non | string | Qualifications requises |
| `nice_to_have` | Non | string | Qualifications souhaitees |
| `compensation_min` | Non | number | 500000 |
| `compensation_max` | Non | number | 800000 |
| `currency` | Non | enum | XOF (defaut), EUR, USD |
| `compensation_frequency` | Non | enum | MONTHLY, HOURLY, DAILY, ANNUAL |
| `deadline` | Non | ISO date | "2026-03-31" |

**Validations backend :**
- Le talent doit etre OWNER ou ADMIN de l'organisation
- `title`, `summary`, `contract_type` sont requis
- L'offre est creee avec `status=OPEN`, `visibility=PUBLIC`
- Slug genere automatiquement, embedding Pinecone asynchrone

#### Schema `data` pour `create_community`

| Champ | Requis | Type | Exemple |
|-------|--------|------|---------|
| `organization_id` | Oui | UUID | ID de l'organisation |
| `name` | Oui | string | "Tech Leaders Abidjan" |
| `description` | Oui | string | Description de la communaute |
| `type` | Non | enum | PROFESSIONAL (defaut), ACADEMIC, SOCIAL, INDUSTRY, ALUMNI, RESEARCH |
| `access_type` | Non | enum | OPEN (defaut), APPROVAL_REQUIRED, INVITE_ONLY |
| `visibility` | Non | enum | PUBLIC (defaut), PRIVATE |
| `sectors` | Non | array | `["TECHNOLOGY","FINANCE"]` |
| `city` | Non | string | "Abidjan" |
| `country` | Non | string | "CI" (defaut) |

**Validations backend :**
- Le talent doit etre membre de l'organisation (tout role)
- `name`, `description` sont requis
- Le createur est automatiquement ajoute comme ADMIN de la communaute
- Slug unique genere automatiquement

#### Schema `data` pour `create_space`

| Champ | Requis | Type | Exemple |
|-------|--------|------|---------|
| `organization_id` | Oui | UUID | ID de l'organisation |
| `name` | Oui | string | "Salle Innovation" |
| `type` | Oui | enum | COWORKING, MEETING_ROOM, CONFERENCE, OFFICE, EVENT_SPACE, WORKSHOP, STUDIO, CLASSROOM, LAB, LIBRARY, OTHER |
| `surface_m2` | Oui | number | 120 |
| `description` | Non | string | Description de l'espace |
| `capacity` | Non | number | 30 |
| `city` | Non | string | "Abidjan" |
| `country` | Non | string | "CI" (defaut) |
| `equipment` | Non | array | `["Wifi","Projecteur","Tableau blanc"]` |
| `amenities` | Non | array | `["Climatisation","Parking","Cuisine"]` |
| `hourly_rate` | Non | number | 5000 |
| `daily_rate` | Non | number | 25000 |
| `is_bookable` | Non | boolean | true (defaut) |
| `visibility` | Non | enum | PUBLIC (defaut), PRIVATE |

**Validations backend :**
- Le talent doit etre OWNER ou ADMIN de l'organisation
- `name`, `type`, `surface_m2` sont requis

---

### Exemples — Mode Organization

#### Exemple 1 : Dashboard candidatures

| Element | Detail |
|---------|--------|
| **Question** | "Combien de candidatures ce mois-ci ?" |
| **Processus** | Donnees structurees -> `sql_query` FIRST |

**Reponse ideale :**
```
Bilan candidatures **fevrier 2026** :

| Opportunite | Candidatures |
|-------------|--------------|
| ```entity:opportunity
{"id":"opp-uuid-1"}
``` | 18 |
| ```entity:opportunity
{"id":"opp-uuid-2"}
``` | 15 |

**Total : 33 candidatures**

Tu veux voir les candidats preselectionnes ?
```

---

#### Exemple 2 : Recherche de talents

| Element | Detail |
|---------|--------|
| **Question** | "Trouve des developpeurs Python 3+ ans d'experience" |
| **Processus** | Recherche semantique talents -> `smart_search` |

**Reponse ideale :**
```
J'ai trouve 5 developpeurs Python experimentes :

```entity:talent
{"id":"talent-uuid-1"}
```

```entity:talent
{"id":"talent-uuid-2"}
```

```entity:talent
{"id":"talent-uuid-3"}
```

Le premier profil a 5 ans d'experience Django. Tu veux voir son CV ?
```

---

#### Exemple 3 : Generation de fiche de poste (PDF)

| Element | Detail |
|---------|--------|
| **Question** | "**Genere** une fiche de poste pour un DevOps Senior" |
| **Processus** | Mot-cle "genere" -> PDF via `generate_document`, PAS creation DB |
| **Tool** | `sql_query` (offres similaires) -> `web_search` (benchmark) -> `generate_document` |

**Reponse ideale :**
```
Voici la fiche de poste DevOps Senior :

```entity:document
{"id":"doc-job-desc-devops-001"}
```

Optimisations : salaire au-dessus du marche, remote mentionne, budget formation inclus.

Tu veux publier cette offre sur Etudesk ?
```

*(C'est un PDF telechargeable, pas une offre publiee)*

---

#### Exemple 4 : Publication d'une offre (creation DB)

| Element | Detail |
|---------|--------|
| **Question** | "Aide moi a creer une offre d'emploi dans commercial chez nous CDD a partir de mars 2026" |
| **Processus** | Mot-cle "creer une offre" -> creation DB via `confirmation` block, PAS PDF. Extraire: commercial, CDD, mars 2026. Inferer: titre pro, summary, requirements. Org connue du contexte. |
| **Tool** | Optionnel: `sql_query` (offres similaires pour ton/style) -> preview + bloc `confirmation` |

**Reponse ideale :**
```
Voici l'offre prete a publier.

**Commercial·e B2B**
- **Contrat** : CDD | **Rythme** : Temps plein
- **Lieu** : Abidjan, CI (sur site)
- **Description** : Developper le portefeuille clients B2B, piloter le cycle de vente de la prospection a la signature, assurer le reporting commercial et atteindre les objectifs trimestriels.
- **Profil recherche** : 2+ ans en vente B2B, maitrise CRM, sens de la negociation, autonomie et orientation resultats
- **Atouts** : Anglais professionnel, experience secteur tech

```confirmation
{"action":"publish_opportunity","entity_id":"<org-id>","title":"Publier cette offre ?","description":"Commercial·e B2B - CDD","confirm_label":"Publier","cancel_label":"Modifier","data":{"organization_id":"<org-id>","title":"Commercial·e B2B","summary":"Developper le portefeuille clients B2B, piloter le cycle de vente...","contract_type":"CDD","type":"JOB","work_rhythm":"FULL_TIME","location_type":"ON_SITE","locations":[{"city":"Abidjan","country":"CI"}],"requirements":"2+ ans en vente B2B, maitrise CRM, sens de la negociation","nice_to_have":"Anglais professionnel, experience secteur tech"}}
```
```

**Points cles :**
- Organisation jamais questionnee (connue du contexte)
- Aucun "(a confirmer/valider/definir)" — valeurs concretes ou champ omis
- Summary et requirements specifiques au role, pas generiques
- Remuneration omise (non mentionnee par l'utilisateur)
- cancel_label = "Modifier" pour inviter l'utilisateur a ajuster

*(Apres confirmation, l'offre est creee dans la DB avec status OPEN)*

---

#### Exemple 5 : Creation d'une communaute

| Element | Detail |
|---------|--------|
| **Question** | "Cree une communaute pour les developpeurs fintech" |
| **Processus** | Mot-cle "cree" -> creation DB via `confirmation` block |

**Reponse ideale :**
```
Voici la communaute a creer :

**Dev Fintech UEMOA**
- Type : Professionnel
- Acces : Ouvert
- Secteurs : Technologie, Finance

```confirmation
{"action":"create_community","entity_id":"<org-id>","title":"Creer cette communaute ?","description":"Dev Fintech UEMOA - Communaute professionnelle","confirm_label":"Creer","cancel_label":"Annuler","data":{"organization_id":"<org-id>","name":"Dev Fintech UEMOA","description":"Communaute pour les developpeurs fintech de la zone UEMOA","type":"PROFESSIONAL","access_type":"OPEN","visibility":"PUBLIC","sectors":["TECHNOLOGY","FINANCE"]}}
```
```

---

#### Exemple 6 : Creation d'un espace

| Element | Detail |
|---------|--------|
| **Question** | "Cree un espace de coworking de 120m2" |

**Reponse ideale :**
```
Voici l'espace a creer :

**Espace Coworking**
- Type : Coworking
- Surface : 120 m2
- Reservable : Oui

```confirmation
{"action":"create_space","entity_id":"<org-id>","title":"Creer cet espace ?","description":"Espace Coworking - 120m2","confirm_label":"Creer","cancel_label":"Annuler","data":{"organization_id":"<org-id>","name":"Espace Coworking","type":"COWORKING","surface_m2":120,"description":"Espace de coworking moderne","city":"Abidjan","country":"CI","is_bookable":true,"visibility":"PUBLIC"}}
```
```

---

#### Exemple 7 : Scoring et classement des candidats

| Element | Detail |
|---------|--------|
| **Question** | "Classe les candidats pour le poste de Product Manager" |
| **Processus** | Skill Candidate Ranking -> `sql_query` (candidatures) -> analyse |

**Reponse ideale :**
```
Classement des **8 candidats** pour Product Manager :

## Top 3 recommandes

| Rang | Candidat | Points forts |
|------|----------|--------------|
| 1 | ```entity:talent
{"id":"talent-001"}
``` | 5 ans PM fintech, ex-Wave, MBA |
| 2 | ```entity:talent
{"id":"talent-002"}
``` | 4 ans PM, certification Scrum, bilingue |
| 3 | ```entity:talent
{"id":"talent-003"}
``` | 3 ans PM, startup experience |

Tu veux que je prepare les questions d'entretien pour le Top 3 ?
```

---

## Protocole de Confirmation — Architecture Technique

### Deux mecanismes d'action (source : [COPILOT_TOOLS.md](./COPILOT_TOOLS.md) + action.handler.ts)

| Mecanisme | Declencheur | Backend | Actions supportees |
|-----------|------------|---------|-------------------|
| **`execute_action` tool** | L'agent appelle le tool apres confirmation verbale dans le chat | execute-action.tool.ts | 5 actions talent : apply, join, book, accept/decline |
| **Bloc `confirmation`** | L'agent genere un bloc markdown, le frontend l'affiche | action.handler.ts (POST /api/copilot/confirm) | 8 actions : 5 talent + 3 creation (publish, create_community, create_space) |

**IMPORTANT :** Les actions de creation (publish_opportunity, create_community, create_space) passent UNIQUEMENT par le bloc confirmation → action.handler.ts. Elles ne sont PAS dans le tool execute_action.

### Flow du bloc confirmation

```
1. Agent genere un bloc ```confirmation {...}``` dans sa reponse
2. Frontend parse et rend le composant ConfirmationBlock
3. Utilisateur clique "Confirmer" ou "Annuler"
4. Frontend appelle POST /api/copilot/confirm avec {action, entityId, sessionId, data}
5. action.handler.ts valide (action.validators.ts) et execute l'action
6. Resultat affiche dans le ConfirmationBlock (succes/erreur)
7. Message systeme sauvegarde dans copilot_messages
```

### Flow du tool execute_action

```
1. Utilisateur confirme verbalement dans le chat ("oui, postule")
2. Agent appelle execute_action(action, entityId, dataJson)
3. execute_action.tool.ts verifie (entite existe, pas deja fait, etc.)
4. INSERT/UPDATE en base
5. Retour {success, message} → agent reformule pour l'utilisateur
```

### Toutes les actions supportees (8 totales)

| Action | Type | Modes | Mecanisme | Validation (backend) |
|--------|------|-------|-----------|---------------------|
| `apply_opportunity` | Talent | Explore | execute_action + confirmation | Offre OPEN, pas deja postule, deadline non depassee |
| `join_community` | Talent | Explore | execute_action + confirmation | Communaute ACTIVE, pas deja membre |
| `book_space` | Talent | Explore | execute_action + confirmation | Espace ACTIVE, creneau disponible, calcul duration*hourly_rate |
| `accept_invitation` | Talent | Explore | execute_action + confirmation | Invitation PENDING pour ce talent (community ou organization) |
| `decline_invitation` | Talent | Explore | execute_action + confirmation | Invitation PENDING pour ce talent |
| `publish_opportunity` | Org | Explore, Org | confirmation UNIQUEMENT | OWNER/ADMIN de l'org, title+summary+contract_type requis, embedding Pinecone async |
| `create_community` | Org | Explore, Org | confirmation UNIQUEMENT | Membre de l'org, name+description requis, slug unique, createur = ADMIN |
| `create_space` | Org | Explore, Org | confirmation UNIQUEMENT | OWNER/ADMIN de l'org, name+type+surface_m2 requis, embedding Pinecone async |

---

## Securite — Patterns IDOR (source : [COPILOT_TOOLS.md](./COPILOT_TOOLS.md))

7 tools utilisent le pattern **factory avec injection de `authenticatedTalentId`** :

```typescript
createSqlQueryTool(talentId, authorizedOrgIds?, allowedIntents?)
createExecuteActionTool(talentId)
createManageSkillsTool(talentId)
createGenerateDocumentTool(talentId, avatarUrl?, orgId?)
createFileReaderTool(talentId)       // direct tool, verifie document ownership
createOrgFileReaderTool(orgId)       // direct tool, verifie ownership org + interaction talents
createCvGenerationTool(talentId, avatarUrl?)
```

**5 tools static (pas de factory) :** smartSearchTool, youtubeSearchTool, analyzeYoutubeVideoTool, generateImageTool, generateDiagramTool, webSearchAsTool

**Garanties :**
- L'agent ne peut pas usurper l'identite d'un autre utilisateur
- Les queries SQL sont filtrees par `authenticatedTalentId` (IDOR impossible)
- `allowedIntents` restreint les intents par mode
- `authorizedOrgIds` limite l'acces aux organisations du user
- Les actions de creation verifient le role (OWNER/ADMIN) cote backend
- `file_reader` verifie que le document appartient au talent avant lecture
- L'agent n'a pas acces au talentId — il est injecte dans le tool

---

## Guardrails

### Input Safety (claude-haiku-4-5, Anthropic)

Classifie chaque message utilisateur :
- `safe` -> traitement normal
- `unsafe` -> `InputGuardrailTripwireTriggered` -> message de refus poli

### Output Format

Validation post-reponse (log, ne bloque pas) :
- Entity cards : uniquement `{"id":"uuid"}`, pas de champs supplementaires
- Longueur : max 800 caracteres hors entity cards (exception : analyse de document jusqu'a 2000)

---

## Tableau Recapitulatif

### Capacites par Mode

| Capacite | Explore | Study | Organization |
|----------|:-------:|:-----:|:------------:|
| Recherche opportunites | oui | non | oui (propres + marche) |
| Recherche communautes | oui | non | oui (propres + marche) |
| Recherche espaces | oui | non | oui (propres + marche) |
| Recherche talents | oui | non | oui |
| Mes candidatures | oui | non | — |
| Candidatures recues | — | — | oui |
| Mes competences (lecture) | oui | oui | — |
| Mes competences (ajout/maj) | non | oui | — |
| Mes documents (analyse) | oui | oui | — |
| YouTube search | non | oui (si demande) | non |
| Generation images | non | oui | non |
| Generation diagrammes | non | oui | non |
| Quiz/Flashcards | non | oui | non |
| Generation documents (PDF) | oui | non | oui |
| Recherche web | oui | oui | oui |
| **Publier une offre** | oui (admin org) | non | oui |
| **Creer une communaute** | oui (admin org) | non | oui |
| **Creer un espace** | oui (admin org) | non | oui |
| Documents organisation (lecture) | — | non | oui |
| Talents CRM (agregé) | — | non | oui |
| Activites communautaires | oui (via my_community_feed) | non | oui (via org_community_feed) |
| Membres communaute | oui (via my_community_members) | non | oui (via org_community_members) |

### Cartes Entites par Mode

| Type Entite | Explore | Study | Organization |
|-------------|:-------:|:-----:|:------------:|
| `opportunity` | oui | non | oui |
| `community` | oui | non | non |
| `space` | oui | non | non |
| `talent` | oui | non | oui |
| `organization` | oui | non | non |
| `document` | oui | non | oui |

### Skills par Mode (17 totales — chargees depuis services/copilot/skills/definitions/*.skill.md)

| Skill | Explore | Study | Org | Tools principaux |
|-------|:-------:|:-----:|:---:|-----------------|
| CV Generation | oui | | | sql_query, file_reader, generate_document |
| Interview Preparation | oui | | | sql_query, file_reader, web_search, generate_document |
| Career & Compensation Guide | oui | | | smart_search, sql_query, web_search, generate_document |
| Application Tracker | oui | | | sql_query, smart_search |
| Onboarding | oui | | | sql_query, file_reader, generate_document |
| Deep Dive Lesson | | oui | | youtube_search, analyze_youtube_video, manage_skills, generate_diagram, web_search |
| Exam & Revision | | oui | | manage_skills, youtube_search, web_search |
| Document Study Session | | oui | | sql_query, file_reader, manage_skills, analyze_youtube_video |
| Weekly Recap | | oui | | manage_skills |
| Autodiagnostic Talent | | oui | | file_reader, manage_skills |
| HR Skill Radar | | oui | oui | sql_query, file_reader |
| Candidate Ranking | | | oui | sql_query, file_reader, generate_document |
| Opportunity Publishing | | | oui | sql_query |
| Community Creation | | | oui | execute_action |
| Space Creation | | | oui | execute_action |
| Job Description Generation | | | oui | sql_query, generate_document, web_search |
| Org Analytics | | | oui | sql_query, generate_document |
| Talent Outreach | | | oui | sql_query, smart_search |

---

## SSE Streaming — Tool Events

Voir [COPILOT_ARCHITECTURE.md](./COPILOT_ARCHITECTURE.md) pour le protocole SSE complet.

| Event | Description |
|-------|-------------|
| `tool_start` | Debut d'un tool call (name, args) |
| `tool_end` | Fin d'un tool call (summary, result, duration, status) |
| `text_delta` | Texte genere par l'agent (streaming, buffered 50ms) |
| `audio_ready` | Audio TTS genere (study mode) |
| `limit_reached` | Limite atteinte (max 20 tools, 2 minutes, ou tool loop) |
| `content_corrected` | Contenu canonique apres sanitization |
| `done` | Fin de la reponse |

### Summaries affiches dans le UI (tool_summary.ts)

| Tool | Exemple de summary |
|------|--------------------|
| smart_search | "3 resultats · opportunites (semantic)" |
| sql_query | "30 elements · Mes competences" |
| youtube_search | "1 video trouvee" |
| generate_document | "Document genere · CV Lamine Barro (sauvegarde)" |
| generate_image | "Image generee" |
| generate_diagram | "Diagramme genere" |
| manage_skills | "Ajoutee · Python" |
| execute_action | "Candidature soumise" |
| file_reader | "Lu · Curriculum Vitae" |
| web_search | "Recherche web terminee" |

---

## Bugs corriges dans l'audit du 09 Fevrier 2026

| Bug | Fichier | Fix |
|-----|---------|-----|
| `search_organizations` crash : `column o.city does not exist` | sql-query.tool.ts | `o.city` → `o.headquarters_city as city` |
| `smart_search` organizations : meme bug `o.city` | smart-search.tool.ts | Idem |
| `book_space` crash : `organization_id NOT NULL` | execute-action.tool.ts | Ajout organization_id + calcul duration * hourly_rate |
| `search_talents` ignore le param `skills` | sql-query.tool.ts | Ajout JOIN talent_skills avec filtre |
| `tool_summary` sql_query : toujours "Donnees chargees" | tool-summary.ts | Recherche du premier array dans l'objet de retour |

---

## Anti-Patterns

### Ce que l'agent ne doit JAMAIS faire

| Anti-Pattern | Exemple Incorrect | Pourquoi |
|--------------|-------------------|----------|
| **Micro-analyses par carte** | Texte entre chaque entity card | Ecrire UNE synthese globale AVANT les cartes groupees |
| **Generer des donnees** | `{"id":"...", "title":"Dev React"}` | Le frontend fetch les donnees |
| **Inventer un ID** | `{"id":"generated-123"}` | ID doit venir des tools |
| **Carte sans ID** | `{"title":"Stage Marketing"}` | Inutilisable pour le rendu |
| **Carte en mode Study** | Afficher une opportunite | Hors perimetre |
| **Donnees autres orgs** | Afficher candidatures d'une autre org | Violation isolation |
| **2 composants Study** | youtube + quiz dans meme message | UN composant par output |
| **Video pour exercice** | youtube_search pour "donne-moi un exercice" | Pratique > Video |
| **youtube_search systematique** | Appeler youtube_search a chaque reponse | Utiliser seulement si demande |
| **PDF au lieu de creation** | `generate_document` quand l'user dit "publie une offre" | Utiliser bloc `confirmation` avec `publish_opportunity` |
| **Creation au lieu de PDF** | Bloc `confirmation` quand l'user dit "genere une fiche de poste" | Utiliser `generate_document` |
| **Supprimer competence** | manage_skills remove en Study | Suppression non autorisee |
| **Donnees perso en mode Org** | sql_query my_profile en Organization | Rediriger vers Explorer |

### Format Correct vs Incorrect

**INCORRECT :**
```
```entity:opportunity
{"id":"550e8400-...", "title":"Dev React", "organization":"Wave", "location":"Dakar", "salary":"1.5M FCFA"}
```
```

**CORRECT :**
```
```entity:opportunity
{"id":"550e8400-e29b-41d4-a716-446655440001"}
```
```

---

## Tool Chaining (Best Practices)

```
0. Minimiser les tools : si une reponse peut etre produite sans tool, ne pas appeler de tool.
1. Donnees internes d'abord : sql_query/smart_search/file_reader avant web_search.
2. Parallele quand possible : regrouper les tool calls independants.
3. smart_search = decouverte (fuzzy, semantic) ; sql_query = donnees structurees (listes, stats, feed, candidats).
4. file_reader : utiliser seulement si un document est necessaire. Lire chaque document UNE seule fois.
5. web_search : dernier recours (benchmarks, tendances, infos externes recentes). Toujours citer les sources.
6. generate_* : uniquement apres collecte des infos. Jamais pour "creer" une entite (DB).
7. Actions : toujours preview + confirmation avant execute_action / bloc confirmation.
```

### Recettes de chaining (operatoires)

| Cas | Mode | Chaine recommandee |
|-----|------|--------------------|
| Recherche d'entites (opportunites, communautes, espaces, talents) | Explore/Org | `smart_search` → grouper les entity cards (IDs seulement) |
| Donnees personnelles (profil, skills, documents, feed) | Explore/Study | `sql_query(my_*)` → synthese courte → (optionnel) file_reader si un doc doit etre lu |
| Analyse d'un CV / document | Explore/Study/Org | `sql_query(my_documents|org_documents|org_talent_profile)` → `file_reader(documentId)` → extraction → next step |
| Benchmarks (salaires, tendances marche, entreprises) | Explore/Study/Org | `web_search` → synthese avec sources → (optionnel) `generate_document` pour livrable |
| Candidature / adhesion / reservation | Explore | `sql_query` (entity + contexte) → preview → confirmation → `execute_action` |
| Creation d'offre / communaute / espace | Explore/Org | `sql_query` (optionnel: references) → preview structuree → bloc `confirmation` (le backend cree l'entite) |

---

## Checklist Validation Reponse

### Tous les modes

- [ ] Les IDs proviennent des resultats des tools (jamais generes)
- [ ] Les cartes entites contiennent UNIQUEMENT `{"id":"<uuid>"}`
- [ ] Le type d'entite est dans la liste autorisee pour ce mode
- [ ] Aucune donnee n'est incluse dans la carte (titre, prix, etc.)
- [ ] Les entites non-affichables sont mentionnees en texte uniquement
- [ ] Max 800 caracteres de texte hors entity cards (exception : analyse doc 2000)
- [ ] Max 1 question par reponse
- [ ] Quick Ack avant les tool calls (1 phrase, max 12 mots)

### Mode Study specifiquement

- [ ] UN SEUL composant par message (youtube OU diagram OU quiz OU flashcard OU image OU chart)
- [ ] Composant choisi selon le sujet et la demande, learning style en guidance souple
- [ ] youtube_search appele seulement si l'utilisateur demande explicitement ou si le sujet le justifie
- [ ] Pour les sujets pratiques (code, algorithmes) : quiz ou code block, PAS video
- [ ] Assessment = 3 questions en conversation (Rappel → Application → Analyse), UNE par message
- [ ] Ajout competence apres assessment 2/3 ou 3/3 (via manage_skills, avec confirmation)
- [ ] Extraction des competences lors de l'analyse de CV/certificats
- [ ] Learning preferences utilises comme tendance (pas de mapping rigide style → composant)
- [ ] AUCUNE carte entite (pas d'opportunity, community, space)
- [ ] file_reader appele au plus une fois par documentId

### Mode Organization specifiquement

- [ ] Distinction generer (PDF) vs creer (DB) respectee
- [ ] Bloc confirmation avec champ `data` complet pour les actions de creation
- [ ] `organization_id` present dans le champ `data`
- [ ] `entity_id` = ID de l'organisation pour les actions de creation
- [ ] Pas de donnees personnelles (my_profile, my_documents) — rediriger vers Explorer
- [ ] Uniquement `entity:talent`, `entity:opportunity`, `entity:document` comme cartes

---

> **Document mis a jour** : 21 Fevrier 2026
> **Regle critique** : IDs seulement, jamais de donnees generees
> **Reference technique** : Voir [COPILOT_TOOLS.md](./COPILOT_TOOLS.md) pour les parametres et retours de chaque tool
