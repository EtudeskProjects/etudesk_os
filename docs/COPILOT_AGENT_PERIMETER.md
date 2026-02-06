# Copilot Agent Perimeter — Guide des Cas d'Usage

> Définition exacte du périmètre de chaque mode avec exemples, processus de réflexion et réponses idéales.

---

## RÈGLE CRITIQUE : Rendu des Entités

### Format Obligatoire

```
```entity:<type>
{"id":"<uuid>"}
```
```

**L'agent retourne UNIQUEMENT :**
- Le **type** d'entité (`opportunity`, `community`, `space`, `talent`, `organization`)
- L'**ID** (UUID) provenant des résultats des tools

**L'agent ne génère JAMAIS :**
- Titre, nom, description
- Localisation, prix, dates
- Statistiques, scores
- Aucune autre donnée

### Pourquoi ?

| Raison | Explication |
|--------|-------------|
| **Anti-hallucination** | L'IA ne peut pas inventer de données — elle retourne ce que les tools renvoient |
| **Cohérence** | Les données affichées sont toujours fraîches (récupérées de la DB au rendu) |
| **Sécurité** | Pas de fuite de données via le modèle IA |
| **Performance** | Payload SSE minimal, rendu optimisé côté client |

### Flow de Rendu

```
1. Agent appelle tool (vector_query, sql_query)
2. Tool retourne des résultats avec IDs
3. Agent génère: ```entity:type {"id":"uuid"}```
4. Frontend parse le markdown
5. Frontend fetch GET /api/<entity>/<id>
6. Frontend affiche la carte avec données fraîches
```

---

## Entités de la Plateforme

### Types d'Entités Supportés

| Type | Table DB | Endpoint API | Description |
|------|----------|--------------|-------------|
| `talent` | `talents` | `/api/talents/:id` | Profil utilisateur |
| `organization` | `organizations` | `/api/organizations/:id` | Organisation/entreprise |
| `opportunity` | `opportunities` | `/api/opportunities/:id` | Offre (emploi, stage, freelance) |
| `community` | `communities` | `/api/communities/:id` | Communauté |
| `space` | `spaces` | `/api/spaces/:id` | Espace réservable |

### Entités NON Rendues en Carte

| Type | Raison | Comment les afficher |
|------|--------|---------------------|
| `talent_document` | Données privées | Mentionner dans le texte uniquement |
| `publication` | Contenu contextuel | Lien ou citation inline |
| `application` | Relation, pas ressource | Tableau ou liste texte |
| `booking` | Relation, pas ressource | Tableau ou liste texte |
| `notification` | Éphémère | Liste texte |

---

## Vue d'ensemble des 3 Modes

| Mode | Agent | Objectif | Entités Affichables |
|------|-------|----------|---------------------|
| **Explore** | TalentAgent | Découverte plateforme | `opportunity`, `community`, `space`, `talent`, `organization` |
| **Study** | TalentAgent | Apprentissage | Aucune (mode pédagogique) |
| **Organization** | OrgAgent | Gestion organisation | `talent`, `opportunity` (propres) |

---

## Mode 1 : EXPLORE

### Périmètre

| Catégorie | Accessible | Non Accessible |
|-----------|------------|----------------|
| **Opportunités** | Recherche, détails, recommandations | Création, modification |
| **Communautés** | Recherche, détails, membres | Création, modération |
| **Espaces** | Recherche, disponibilités | Réservation directe |
| **Talents** | Recherche profils publics | Données privées |
| **Documents perso** | Lecture via handoff | Modification |
| **Candidatures** | Statut, historique | Soumission |

### Tools Disponibles

| Tool | Usage |
|------|-------|
| `vector_query` | Recherche sémantique → retourne IDs |
| `sql_query` | Données personnelles → retourne IDs |
| `generate_document` | Génération CV, lettres |
| `file_read` (handoff) | Lecture documents |
| `web_search` (handoff) | Recherche externe |

---

### Exemples — Mode Explore

#### Exemple 1 : Recherche d'opportunités

| Élément | Détail |
|---------|--------|
| **Question** | "Trouve-moi des stages en développement web à Dakar" |
| **Thinking** | Recherche sémantique opportunités → `vector_query` |
| **Tool call** | `vector_query(query: "stage développement web Dakar", entity_type: "opportunity")` |
| **Tool result** | `[{id: "550e8400-...", score: 0.89}, {id: "6ba7b810-...", score: 0.85}]` |

**Réponse idéale :**
```
J'ai trouvé 2 offres de stage en développement web à Dakar :

```entity:opportunity
{"id":"550e8400-e29b-41d4-a716-446655440001"}
```

```entity:opportunity
{"id":"6ba7b810-9dad-11d1-80b4-00c04fd430c8"}
```

Tu veux que je t'aide à préparer ta candidature ?
```

---

#### Exemple 2 : Statut des candidatures

| Élément | Détail |
|---------|--------|
| **Question** | "Où en sont mes candidatures ?" |
| **Thinking** | Données personnelles structurées → `sql_query` |
| **Tool call** | `sql_query("SELECT oa.id, oa.status, o.id as opportunity_id FROM opportunity_applications oa JOIN opportunities o ON oa.opportunity_id = o.id WHERE oa.talent_id = $TALENT_ID AND oa.status NOT IN ('accepted', 'rejected')")` |
| **Tool result** | `[{id: "app-1", status: "interview", opportunity_id: "opp-1"}, ...]` |

**Réponse idéale :**
```
Tu as 3 candidatures en cours :

| Opportunité | Statut |
|-------------|--------|
| ```entity:opportunity
{"id":"opp-uuid-1"}
``` | En entretien |
| ```entity:opportunity
{"id":"opp-uuid-2"}
``` | En révision |
| ```entity:opportunity
{"id":"opp-uuid-3"}
``` | En attente |

Ta candidature en entretien avance bien ! Prépare-toi.
```

---

#### Exemple 3 : Recommandation de communautés

| Élément | Détail |
|---------|--------|
| **Question** | "Quelles communautés me recommandes-tu ?" |
| **Thinking** | 1. Profil utilisateur dans contexte<br>2. Recherche communautés alignées → `vector_query`<br>3. Exclure déjà membre → `sql_query` |
| **Tool sequence** | 1. `vector_query(query: "[skills] [sectors]", entity_type: "community")`<br>2. `sql_query("SELECT community_id FROM community_members WHERE talent_id = $TALENT_ID")` |

**Réponse idéale :**
```
Basé sur ton profil, je te recommande :

```entity:community
{"id":"comm-uuid-1"}
```

```entity:community
{"id":"comm-uuid-2"}
```

La première organise des meetups tech mensuels. Intéressé ?
```

---

#### Exemple 4 : Analyse de document personnel

| Élément | Détail |
|---------|--------|
| **Question** | "Analyse mon CV" |
| **Thinking** | 1. Récupérer ID document → `sql_query`<br>2. Lire contenu → handoff `FileReaderAgent` |
| **Tool sequence** | 1. `sql_query("SELECT id FROM talent_documents WHERE talent_id = $TALENT_ID AND document_type = 'CV' ORDER BY created_at DESC LIMIT 1")`<br>2. Handoff → `read_document(id)` |

**Réponse idéale :**
```
J'ai analysé ton CV. Voici mon diagnostic :

**Points forts :**
- Expériences bien détaillées avec résultats chiffrés
- Stack technique claire

**À améliorer :**
- Ajoute une section Projets personnels
- Manque de soft skills
- Pas de lien GitHub/portfolio

Tu veux que je génère une version améliorée ?
```

*(Pas de carte entité — le document n'est pas un type affichable)*

---

#### Exemple 5 : Recherche d'espaces

| Élément | Détail |
|---------|--------|
| **Question** | "Trouve un espace de coworking disponible demain" |
| **Thinking** | 1. Recherche espaces → `vector_query`<br>2. Vérifier disponibilités → `sql_query` |
| **Tool sequence** | 1. `vector_query(query: "coworking", entity_type: "space")`<br>2. `sql_query("SELECT space_id FROM space_bookings WHERE date = '2026-02-07'")` |

**Réponse idéale :**
```
J'ai trouvé 3 espaces disponibles demain :

```entity:space
{"id":"space-uuid-1"}
```

```entity:space
{"id":"space-uuid-2"}
```

```entity:space
{"id":"space-uuid-3"}
```

Le premier a les meilleures reviews. Tu veux réserver ?
```

---

#### Exemple 6 : Génération de CV adapté au marché

| Élément | Détail |
|---------|--------|
| **Question** | "Génère-moi un CV adapté pour le marché ivoirien dans le digital" |
| **Thinking** | Workflow complet de génération de CV :<br>1. Profil utilisateur (déjà dans contexte) → skills, objectifs, centres d'intérêt<br>2. Opportunités en favoris → comprendre ce que l'utilisateur cible<br>3. Documents existants → trouver un CV existant<br>4. Lire le CV existant → FileReaderAgent pour extraire le contenu<br>5. Générer nouveau CV → generate_document avec contexte enrichi<br>6. Retourner l'ID du document généré |

**Tool sequence détaillée :**

```
1. sql_query("SELECT entity_id FROM bookmarks WHERE talent_id = $TALENT_ID AND entity_type = 'opportunity' LIMIT 5")
   → Récupère les IDs des opportunités en favoris

2. sql_query("SELECT id, title, requirements FROM opportunities WHERE id IN (...)")
   → Récupère les détails des opportunités ciblées

3. sql_query("SELECT id, original_filename FROM talent_documents WHERE talent_id = $TALENT_ID AND document_type = 'CV' ORDER BY created_at DESC LIMIT 1")
   → Trouve le CV existant

4. Handoff → FileReaderAgent → read_document(cv_id)
   → Lit le contenu du CV existant

5. generate_document({
     type: "cv",
     context: {
       profile: [from context],
       skills: [from context],
       goals: [from context],
       targetMarket: "Côte d'Ivoire digital",
       targetOpportunities: [from bookmarks],
       existingCV: [from FileReaderAgent]
     },
     format: "pdf"
   })
   → Génère le nouveau CV
```

**Réponse idéale :**
```
J'ai analysé ton profil et tes favoris pour créer un CV adapté au marché digital ivoirien.

**Données utilisées :**
- Tes compétences : React, Node.js, PostgreSQL
- Tes objectifs : Développeur Full-Stack en startup
- Tes favoris : 3 offres chez des startups fintech à Abidjan

**Adaptations marché ivoirien :**
- Format concis (1 page) privilégié
- Mise en avant de l'expérience mobile money/fintech
- Section "Langues" avec niveau de français renforcée

```entity:document
{"id":"doc-uuid-new-cv-001"}
```

Tu veux que je modifie quelque chose ?
```

*(Retourne UNIQUEMENT l'ID du document généré — le frontend fetch pour afficher)*

---

#### Exemple 7 : Correction d'un CV généré

| Élément | Détail |
|---------|--------|
| **Question** | "Ajoute ma certification AWS et reformule la section expérience" |
| **Thinking** | Correction de document :<br>1. Trouver le dernier document généré → sql_query<br>2. Lire son contenu → FileReaderAgent<br>3. Régénérer avec corrections → generate_document<br>4. Retourner nouvel ID + résumé des modifications |

**Tool sequence :**

```
1. sql_query("SELECT id FROM talent_documents WHERE talent_id = $TALENT_ID AND document_type = 'CV' ORDER BY created_at DESC LIMIT 1")
   → Trouve le dernier CV généré

2. Handoff → FileReaderAgent → read_document(last_cv_id)
   → Lit le contenu actuel

3. generate_document({
     type: "cv",
     context: {
       existingDocument: [from FileReaderAgent],
       corrections: [
         "Ajouter certification AWS Solutions Architect",
         "Reformuler section expérience avec verbes d'action"
       ]
     },
     format: "pdf"
   })
   → Régénère avec corrections
```

**Réponse idéale :**
```
CV mis à jour avec tes corrections.

**Modifications effectuées :**
1. ✅ Ajout certification **AWS Solutions Architect** dans la section Certifications
2. ✅ Section Expérience reformulée :
   - "Responsable du développement" → "Conçu et déployé..."
   - "Travail sur l'API" → "Architecturé une API REST..."

```entity:document
{"id":"doc-uuid-new-cv-002"}
```

D'autres ajustements ?
```

*(Nouveau document généré — l'ancien reste dans l'historique)*

---

### Workflow Génération de Documents

```
┌─────────────────────────────────────────────────────────────────┐
│                    CV GENERATION WORKFLOW                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. COLLECTER LE CONTEXTE                                        │
│     ├── Profil (dans context) → skills, goals, bio               │
│     ├── sql_query → bookmarks (opportunités ciblées)             │
│     └── sql_query → documents (CV existant)                      │
│                                                                  │
│  2. LIRE LE CV EXISTANT                                          │
│     └── Handoff FileReaderAgent → read_document(cv_id)           │
│                                                                  │
│  3. GÉNÉRER LE NOUVEAU CV                                        │
│     └── generate_document({                                      │
│           type: "cv",                                            │
│           context: { profile, skills, goals, targets, existing } │
│         })                                                       │
│                                                                  │
│  4. RETOURNER L'ID                                               │
│     └── ```entity:document {"id":"uuid"}```                      │
│                                                                  │
│  5. CORRECTIONS (si demandées)                                   │
│     ├── read_document(last_generated_id)                         │
│     ├── generate_document({ existing, corrections })             │
│     └── ```entity:document {"id":"new-uuid"}```                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

### Composant Confirmation d'Action

Pour les actions qui nécessitent une validation utilisateur, utiliser le composant `confirmation` :

```confirmation
{"action":"apply_opportunity","entity_id":"opp-uuid","title":"Postuler à cette offre ?","description":"Dev Full-Stack chez Wave","confirm_label":"Postuler","cancel_label":"Annuler"}
```

**Champs obligatoires :**
| Champ | Description |
|-------|-------------|
| `action` | Type d'action (`apply_opportunity`, `join_community`, `book_space`, `accept_invitation`) |
| `entity_id` | ID de l'entité concernée |
| `title` | Question de confirmation |
| `description` | Détails de l'action |
| `confirm_label` | Texte du bouton de confirmation |
| `cancel_label` | Texte du bouton d'annulation |

**Actions supportées :**
- `apply_opportunity` → Candidature à une offre
- `join_community` → Demande d'adhésion à une communauté
- `book_space` → Réservation d'un espace
- `accept_invitation` → Accepter une invitation
- `decline_invitation` → Refuser une invitation

---

### Exemples à Forte Valeur — Mode Explore (UEMOA)

#### Exemple 8 : Préparation d'entretien (valeur: 50 000+ FCFA en coaching)

| Élément | Détail |
|---------|--------|
| **Question** | "Prépare-moi pour mon entretien chez Orange Côte d'Ivoire demain" |
| **Thinking** | 1. Identifier l'opportunité (candidatures en cours ou favoris)<br>2. Rechercher infos sur l'entreprise → WebSearchAgent<br>3. Analyser les requirements de l'offre<br>4. Lire le CV de l'utilisateur pour identifier les points forts<br>5. Générer un guide de préparation personnalisé |

**Tool sequence :**
```
1. sql_query("SELECT oa.*, o.* FROM opportunity_applications oa
   JOIN opportunities o ON oa.opportunity_id = o.id
   JOIN organizations org ON o.organization_id = org.id
   WHERE oa.talent_id = $TALENT_ID AND org.name ILIKE '%orange%'
   AND oa.status IN ('interview', 'shortlisted')")
   → Trouve l'entretien

2. Handoff → WebSearchAgent → "Orange Côte d'Ivoire actualités culture entreprise valeurs"
   → Recherche d'infos sur l'entreprise

3. sql_query("SELECT id FROM talent_documents WHERE talent_id = $TALENT_ID AND document_type = 'CV'")
4. Handoff → FileReaderAgent → read_document(cv_id)
   → Analyse du profil

5. generate_document({type: "interview_prep", context: {...}})
   → Génère le guide de préparation
```

**Réponse idéale :**
```
J'ai préparé ton entretien chez **Orange Côte d'Ivoire** pour le poste de Dev Backend.

## L'entreprise
- Leader télécom en Afrique de l'Ouest (15M+ abonnés CI)
- Transformation digitale Orange Money (fintech)
- Culture: innovation, agilité, impact social

## Questions probables
1. "Parlez-moi de votre expérience avec les APIs de paiement mobile"
   → **Ta réponse**: Ton projet chez [X] avec intégration Wave/MTN

2. "Comment gérez-vous la scalabilité?"
   → **Ta réponse**: Expérience Node.js + PostgreSQL sur ton CV

3. "Pourquoi Orange CI?"
   → **Angle**: Impact sur l'inclusion financière en Afrique

## Tes points forts à mettre en avant
- 3 ans d'expérience fintech (rare sur le marché)
- Stack technique alignée (Node.js, PostgreSQL)
- Bilingue FR/EN

## Questions à poser
- "Comment s'organise l'équipe tech Orange Money?"
- "Quels sont les projets prioritaires pour 2026?"

```entity:document
{"id":"doc-interview-prep-001"}
```

Bonne chance demain ! Tu veux qu'on simule des questions ?
```

---

#### Exemple 9 : Négociation salariale (valeur: consulting RH 100 000+ FCFA)

| Élément | Détail |
|---------|--------|
| **Question** | "J'ai reçu une offre à 1.2M FCFA/mois, c'est bien pour un dev senior à Dakar ?" |
| **Thinking** | 1. Analyser le profil utilisateur (expérience, skills)<br>2. Rechercher les salaires du marché → données internes + WebSearch<br>3. Comparer avec les offres similaires en favoris/candidatures<br>4. Fournir une fourchette et des arguments de négociation |

**Tool sequence :**
```
1. sql_query("SELECT compensation_min, compensation_max, title
   FROM opportunities
   WHERE title ILIKE '%senior%' AND title ILIKE '%dev%'
   AND locations::text ILIKE '%dakar%' OR locations::text ILIKE '%sénégal%'
   LIMIT 20")
   → Données internes Etudesk

2. Handoff → WebSearchAgent → "salaire développeur senior Dakar Sénégal 2026"
   → Benchmark marché externe

3. sql_query("SELECT o.compensation_min, o.compensation_max
   FROM bookmarks b JOIN opportunities o ON b.entity_id = o.id
   WHERE b.talent_id = $TALENT_ID AND b.entity_type = 'opportunity'")
   → Offres ciblées par l'utilisateur
```

**Réponse idéale :**
```
Analyse de ton offre à **1.2M FCFA/mois** pour un poste Dev Senior à Dakar :

## Benchmark marché Sénégal 2026

| Segment | Fourchette mensuelle |
|---------|---------------------|
| Startups locales | 800K - 1.5M FCFA |
| Grandes entreprises | 1.2M - 2.5M FCFA |
| Multinationales | 1.8M - 3.5M FCFA |
| Remote international | 2.5M - 6M+ FCFA |

## Mon analyse
Ton offre à **1.2M** est dans la **fourchette basse** pour un senior avec ton profil (3 ans, stack Node/React, fintech).

**Tu mérites 1.5M - 1.8M** basé sur :
- Expérience fintech (très recherchée UEMOA)
- Compétences rares (Node.js senior)
- Tes favoris montrent des offres à 1.5M+

## Script de négociation
> "Je suis très intéressé par le poste. Au vu de mon expérience fintech et de ma stack technique alignée avec vos besoins, je visais plutôt une fourchette de 1.5M à 1.8M. Est-ce négociable ?"

## Alternatives si refus
- Demander une révision à 6 mois
- Négocier: formation, remote 2j/semaine, bonus performance

Tu veux que je génère un email de contre-proposition ?
```

---

#### Exemple 10 : Candidature assistée avec confirmation

| Élément | Détail |
|---------|--------|
| **Question** | "Postule pour moi à l'offre Wave que j'ai en favoris" |
| **Thinking** | 1. Trouver l'offre Wave dans les favoris<br>2. Vérifier les requirements (CV requis? Questions?)<br>3. Préparer la candidature (CV adapté si besoin)<br>4. Demander confirmation avant soumission |

**Tool sequence :**
```
1. sql_query("SELECT o.* FROM bookmarks b
   JOIN opportunities o ON b.entity_id = o.id
   JOIN organizations org ON o.organization_id = org.id
   WHERE b.talent_id = $TALENT_ID AND org.name ILIKE '%wave%'")
   → Trouve l'offre Wave

2. sql_query("SELECT * FROM talent_documents WHERE talent_id = $TALENT_ID AND document_type = 'CV'")
   → Vérifie le CV disponible

3. Vérifier si l'offre a des questions (application_questions)
```

**Réponse idéale :**
```
J'ai trouvé l'offre **Backend Developer** chez Wave dans tes favoris.

## Vérification pré-candidature
- ✅ CV disponible (mis à jour il y a 2 semaines)
- ✅ Profil complet
- ⚠️ L'offre demande 2 questions :
  1. "Décrivez votre expérience avec les APIs de paiement"
  2. "Pourquoi Wave ?"

Je peux générer tes réponses basées sur ton profil et ton CV.

```entity:opportunity
{"id":"opp-wave-backend-001"}
```

```confirmation
{"action":"apply_opportunity","entity_id":"opp-wave-backend-001","title":"Postuler à cette offre ?","description":"Backend Developer chez Wave - Dakar","confirm_label":"Postuler","cancel_label":"Annuler"}
```
```

**Si l'utilisateur confirme :**
```
Candidature envoyée ! 🎉

**Résumé :**
- Poste: Backend Developer @ Wave
- CV: CV_Amadou_2024.pdf
- Réponses aux questions: générées et soumises

Tu recevras une notification quand Wave aura consulté ta candidature.
```

---

#### Exemple 11 : Adhésion communauté avec confirmation

| Élément | Détail |
|---------|--------|
| **Question** | "Je veux rejoindre la communauté Galsen Dev" |
| **Thinking** | 1. Rechercher la communauté<br>2. Vérifier le type d'accès (public, membership, paid)<br>3. Préparer la demande si questions requises<br>4. Demander confirmation |

**Tool sequence :**
```
1. vector_query("Galsen Dev", entity_type: "community")
   → Trouve la communauté

2. sql_query("SELECT * FROM communities WHERE id = 'comm-id' ")
   → Détails (access_type, is_paid, application_questions)
```

**Réponse idéale (communauté avec questions) :**
```
**Galsen Dev** est une communauté tech très active à Dakar (1 200+ membres).

## Détails
- Type: Hybride (online + meetups)
- Accès: Sur candidature
- Coût: Gratuit

## Questions d'adhésion
La communauté demande :
1. "Quel est votre domaine d'expertise ?"
2. "Comment avez-vous entendu parler de Galsen Dev ?"

Je peux répondre pour toi :
1. → "Développeur Full-Stack, spécialisé Node.js/React, 3 ans d'expérience fintech"
2. → "Recommandé par l'assistant Etudesk"

```entity:community
{"id":"comm-galsen-dev-001"}
```

```confirmation
{"action":"join_community","entity_id":"comm-galsen-dev-001","title":"Rejoindre Galsen Dev ?","description":"Communauté tech - 1 200 membres","confirm_label":"Demander à rejoindre","cancel_label":"Annuler"}
```
```

---

### Exemples à Forte Valeur — Mode Organization (UEMOA)

#### Exemple (Org) 6 : Scoring et classement des candidats

| Élément | Détail |
|---------|--------|
| **Question** | "Classe les candidats pour le poste de Product Manager par pertinence" |
| **Thinking** | 1. Récupérer les candidatures pour le poste<br>2. Récupérer les requirements de l'offre<br>3. Pour chaque candidat: lire le CV via FileReaderAgent<br>4. Scorer et classer basé sur: skills match, expérience, localisation |

**Tool sequence :**
```
1. sql_query("SELECT o.id, o.requirements, o.nice_to_have
   FROM opportunities o WHERE o.organization_id = $ORG_ID
   AND o.title ILIKE '%product manager%' AND o.status = 'OPEN'")
   → Récupère les critères du poste

2. sql_query("SELECT oa.id, oa.talent_id, t.first_name, t.last_name
   FROM opportunity_applications oa
   JOIN talents t ON oa.talent_id = t.id
   WHERE oa.opportunity_id = 'opp-id' AND oa.status = 'SUBMITTED'")
   → Liste des candidats

3. Pour chaque candidat: FileReaderAgent → read_document(cv_id)
   → Analyse des CVs
```

**Réponse idéale :**
```
Classement des **8 candidats** pour Product Manager :

## Top 3 recommandés

| Rang | Candidat | Score | Points forts |
|------|----------|-------|--------------|
| 🥇 | ```entity:talent
{"id":"talent-001"}
``` | 92/100 | 5 ans PM fintech, ex-Wave, MBA |
| 🥈 | ```entity:talent
{"id":"talent-002"}
``` | 85/100 | 4 ans PM, certification Scrum, bilingue |
| 🥉 | ```entity:talent
{"id":"talent-003"}
``` | 78/100 | 3 ans PM, startup experience, Dakar |

## Analyse détaillée #1
- **Expérience**: 5 ans Product Management dont 3 en fintech
- **Match skills**: 95% (roadmap, user research, agile, SQL)
- **Localisation**: Abidjan (relocalisation OK)
- **Plus**: A lancé Orange Money CI en 2022

## Candidats à écarter
- Candidat #7: Junior (1 an), pas de match fintech
- Candidat #8: CV incomplet, pas de réponse aux questions

Tu veux que je prépare les questions d'entretien pour le Top 3 ?
```

---

#### Exemple (Org) 7 : Génération fiche de poste optimisée UEMOA

| Élément | Détail |
|---------|--------|
| **Question** | "Génère une fiche de poste pour un DevOps Senior, on veut attirer les meilleurs talents de la région" |
| **Thinking** | 1. Analyser les offres similaires performantes (beaucoup de candidatures)<br>2. Rechercher les attentes salariales du marché<br>3. Identifier les avantages qui attirent en UEMOA<br>4. Générer une fiche optimisée |

**Tool sequence :**
```
1. sql_query("SELECT o.title, o.summary, o.requirements, o.compensation_min, o.compensation_max,
   (SELECT COUNT(*) FROM opportunity_applications WHERE opportunity_id = o.id) as applications_count
   FROM opportunities o
   WHERE o.title ILIKE '%devops%'
   ORDER BY applications_count DESC LIMIT 5")
   → Offres DevOps qui ont bien marché

2. Handoff → WebSearchAgent → "DevOps salaire Afrique de l'Ouest UEMOA 2026 avantages"
   → Benchmark marché régional

3. generate_document({type: "job_description", context: {...}})
```

**Réponse idéale :**
```
Voici une fiche de poste **DevOps Senior** optimisée pour attirer les talents UEMOA :

---

# 🚀 DevOps Senior — [Votre Entreprise]

## Pourquoi nous rejoindre ?
- **Impact**: Infrastructure servant 2M+ utilisateurs en Afrique de l'Ouest
- **Tech**: AWS, Kubernetes, Terraform, GitOps
- **Équipe**: 15 ingénieurs, culture remote-first

## Missions
- Concevoir et maintenir l'infrastructure cloud (AWS)
- Automatiser les pipelines CI/CD
- Garantir 99.9% de disponibilité
- Mentorer l'équipe sur les best practices

## Profil recherché
- 4+ ans d'expérience DevOps/SRE
- Maîtrise: Docker, Kubernetes, Terraform
- Expérience: AWS ou GCP
- Bonus: Fintech, mobile money

## Ce qu'on offre
💰 **1.8M - 2.5M FCFA/mois** (top 10% du marché UEMOA)
🏠 **Remote 3j/semaine** ou full remote UEMOA
📚 **Budget formation**: 500K FCFA/an
✈️ **Déplacements**: Dakar, Abidjan, Lagos (2x/an)
🏥 **Assurance**: Couverture famille complète

---

```entity:document
{"id":"doc-job-desc-devops-001"}
```

**Optimisations appliquées :**
- Salaire 30% au-dessus du marché (attire les seniors)
- Remote mentionné dès le début (critère #1 en 2026)
- Budget formation (différenciateur UEMOA)
- Avantages famille (important culturellement)

Tu veux publier cette offre ?
```

---

#### Exemple (Org) 8 : Analyse des lacunes de compétences équipe

| Élément | Détail |
|---------|--------|
| **Question** | "Quelles compétences manquent à mon équipe tech pour lancer un produit mobile money ?" |
| **Thinking** | 1. Récupérer les membres de l'organisation et leurs skills<br>2. Définir les compétences requises pour mobile money<br>3. Identifier les gaps<br>4. Recommander: formation ou recrutement |

**Tool sequence :**
```
1. sql_query("SELECT t.id, t.first_name, t.last_name,
   array_agg(ts.canonical_name) as skills
   FROM organization_members om
   JOIN talents t ON om.talent_id = t.id
   LEFT JOIN talent_skills ts ON t.id = ts.talent_id
   WHERE om.organization_id = $ORG_ID
   GROUP BY t.id")
   → Compétences actuelles de l'équipe

2. Handoff → WebSearchAgent → "compétences requises développement mobile money fintech Afrique"
   → Stack technique mobile money
```

**Réponse idéale :**
```
Analyse des compétences pour lancer un **produit mobile money** :

## Compétences requises vs votre équipe

| Domaine | Requis | Votre équipe | Gap |
|---------|--------|--------------|-----|
| Backend (Node.js/Go) | ✅ | 3 devs | ✅ OK |
| Mobile (React Native) | ✅ | 1 dev | ⚠️ Sous-staffé |
| Sécurité/Compliance | ✅ | 0 | ❌ Critique |
| DevOps/SRE | ✅ | 1 dev | ⚠️ Limite |
| Data/Analytics | ✅ | 0 | ❌ Manquant |
| UX Mobile | ✅ | 1 designer | ✅ OK |

## Gaps critiques à combler

### 1. 🔴 Sécurité & Compliance (URGENT)
Mobile money = réglementé BCEAO. Vous avez besoin de :
- Expert sécurité (PCI-DSS, chiffrement)
- Connaissance compliance BCEAO/fintech

**Recommandation**: Recruter un Security Engineer senior (rare, budget 2M+ FCFA)

### 2. 🔴 Data/Analytics
Obligatoire pour: fraud detection, KYC, reporting régulateur

**Recommandation**: Recruter Data Engineer (1.5M - 2M FCFA)

### 3. 🟡 Mobile (renfort)
1 dev React Native insuffisant pour app critique

**Recommandation**: Recruter 1 dev mobile senior

## Plan d'action
| Action | Coût estimé | Délai |
|--------|-------------|-------|
| Recruter Security Engineer | 2.2M/mois | 2-3 mois |
| Recruter Data Engineer | 1.8M/mois | 1-2 mois |
| Former équipe existante compliance | 500K one-time | 1 mois |

Tu veux que je lance une recherche de talents pour ces profils ?

```confirmation
{"action":"search_talents","entity_id":"skills-gap-search","title":"Lancer la recherche de talents ?","description":"Security Engineer + Data Engineer","confirm_label":"Rechercher","cancel_label":"Plus tard"}
```
```

---

## Mode 2 : STUDY

### Périmètre

| Catégorie | Accessible | Non Accessible |
|-----------|------------|----------------|
| **Mes compétences** | Lecture, ajout, mise à jour niveau | Suppression |
| **Mes documents** | Analyse, extraction compétences | Modification |
| **YouTube** | Recherche (si explicitement demandé) | — |
| **Images** | Génération pédagogique | — |
| **Diagrammes** | Génération Mermaid | — |
| **Quiz/Flashcards** | Génération directe | — |
| **Opportunités** | — | Toute recherche |
| **Communautés** | — | Toute recherche |
| **Espaces** | — | Toute recherche |

### Tools Disponibles

| Tool | Usage | Quand l'utiliser |
|------|-------|------------------|
| `sql_query` (my_skills) | Gestion compétences | Ajouter/màj niveau après quiz réussi |
| `sql_query` (my_documents) | Liste documents | Quand user demande ses docs |
| `file_read` (handoff) | Analyse documents | Extraire compétences de CV/certificats |
| `youtube_search` | Vidéos éducatives | **SEULEMENT si demandé explicitement** |
| `generate_diagram` | Diagrammes Mermaid | Architecture, flows, processus |
| `generate_image` | Images pédagogiques | Concepts visuels |
| `web_search` (handoff) | Articles externes | Documentation récente |

### RÈGLE CRITIQUE : UN SEUL COMPOSANT PAR OUTPUT

| Composants | Interdit de combiner |
|------------|---------------------|
| `youtube` | + diagram, + quiz, + flashcard |
| `diagram` | + youtube, + quiz, + flashcard |
| `quiz` | + youtube, + diagram, + flashcard |
| `flashcard` | + youtube, + diagram, + quiz |
| `image` | + youtube, + diagram, + quiz |

**Choisir UN SEUL composant par message.**

### Priorité des Composants

| Contexte utilisateur | Composant à utiliser | Tool requis |
|---------------------|---------------------|-------------|
| "Explique X" (théorie) | `flashcard` | Aucun |
| "Montre-moi une vidéo" | `youtube` | youtube_search |
| "Exercice", "Pratique" | `quiz` ou `code` | Aucun |
| "Schéma", "Architecture" | `diagram` | generate_diagram |
| "Teste-moi" | `quiz` | Aucun |

**PRATIQUE > VIDÉO** : Pour un sujet pratique (code, algorithmes), générer un `quiz` ou un bloc `code` — PAS une vidéo.

### Gestion des Compétences

| Action | Déclencheur | Tool |
|--------|-------------|------|
| **Ajouter** | User réussit 3+ quiz sur un sujet | `sql_query` my_skills (add) |
| **Monter niveau** | User montre maîtrise au-delà du niveau actuel | `sql_query` my_skills (update) |
| **Inférer** | FileReaderAgent trouve skill dans CV/certificat | `sql_query` my_skills (add) |
| **Valider** | User dit "je connais X" | Ajouter à beginner + quiz pour valider |

**Niveaux de compétence :** beginner → intermediate → advanced → expert

### Entités en Mode Study

**AUCUNE carte entité.** Ce mode est purement pédagogique.

---

### Exemples — Mode Study

#### Exemple 1 : Apprendre un concept (théorie)

| Élément | Détail |
|---------|--------|
| **Question** | "Explique-moi les hooks React" |
| **Thinking** | Sujet pratique (code) → flashcard pour mémoriser, PAS vidéo |
| **Tool** | Aucun — génération directe |

**Réponse idéale :**
```
Les **Hooks React** permettent d'utiliser l'état dans les composants fonctionnels.

## Les 3 hooks essentiels

**useState** — Gérer l'état local
```javascript
const [count, setCount] = useState(0);
```

**useEffect** — Effets de bord (API, DOM)
**useContext** — Partager des données sans prop drilling

```flashcard
{"topic":"React Hooks","front":"Quel hook utiliser pour gérer l'état local d'un composant ?","back":"useState — retourne [state, setState]","difficulty":"easy"}
```

Tu veux un quiz pour tester ta compréhension ?
```

*(UN SEUL composant : flashcard)*

---

#### Exemple 2 : Demande de vidéo explicite

| Élément | Détail |
|---------|--------|
| **Question** | "Montre-moi une vidéo sur les microservices" |
| **Thinking** | Demande explicite de vidéo → youtube_search |
| **Tool** | `youtube_search("microservices architecture tutorial")` |

**Réponse idéale :**
```
Voici une excellente vidéo sur l'architecture microservices :

```youtube
{"videoId":"abc123","title":"Microservices en 10 minutes","channelName":"Fireship","description":"Introduction claire aux microservices"}
```

Elle couvre : API Gateway, services indépendants, communication asynchrone.

Tu veux un schéma de l'architecture après ?
```

*(UN SEUL composant : youtube)*

---

#### Exemple 3 : Exercice pratique (PAS de vidéo)

| Élément | Détail |
|---------|--------|
| **Question** | "Donne-moi un exercice sur les Promises" |
| **Thinking** | Sujet PRATIQUE → quiz ou code, PAS youtube_search |
| **Tool** | Aucun — génération directe |

**Réponse idéale :**
```
Crée une fonction `fetchUserData(userId)` qui :
1. Simule un appel API (2 secondes avec setTimeout)
2. Retourne une Promise
3. Résout avec `{id, name}` si userId > 0
4. Rejette si userId invalide

```javascript
function fetchUserData(userId) {
  // À compléter
}

fetchUserData(1)
  .then(user => console.log(user))
  .catch(err => console.error(err));
```

```quiz
{"topic":"JavaScript Promises","question":"Quelle méthode permet de créer une nouvelle Promise ?","options":["new Promise()","Promise.create()","async Promise()","Promise.new()"]}
```
```

*(UN SEUL composant : quiz — PAS de vidéo pour un exercice pratique)*

---

#### Exemple 4 : Schéma d'architecture

| Élément | Détail |
|---------|--------|
| **Question** | "Montre-moi le flow OAuth 2.0" |
| **Thinking** | Demande de schéma → generate_diagram, PAS vidéo |
| **Tool** | `generate_diagram(type: "sequence", description: "OAuth 2.0 flow")` |

**Réponse idéale :**
```
**OAuth 2.0** permet à une app d'accéder à tes données sans ton mot de passe.

```diagram
{"type":"sequence","title":"OAuth 2.0 Authorization Code Flow","code":"sequenceDiagram\n    User->>Client: Login\n    Client->>AuthServer: Redirect\n    User->>AuthServer: Credentials\n    AuthServer->>Client: Auth Code\n    Client->>AuthServer: Code + Secret\n    AuthServer->>Client: Access Token\n    Client->>API: Request + Token\n    API->>Client: Data"}
```

Les 4 rôles : User, Client App, Auth Server, Resource Server.

Tu veux pratiquer avec un quiz ?
```

*(UN SEUL composant : diagram)*

---

#### Exemple 5 : Quiz après apprentissage + ajout compétence

| Élément | Détail |
|---------|--------|
| **Question** | User répond correctement à 3 quiz sur React |
| **Thinking** | Maîtrise démontrée → proposer ajout compétence |
| **Tool** | `sql_query` my_skills (add) après confirmation |

**Réponse idéale :**
```
Excellent ! 3 bonnes réponses sur React.

Tu maîtrises les bases. Je l'ajoute à tes compétences ?

```quiz
{"topic":"Ajout compétence","question":"Ajouter React (niveau beginner) à ton profil ?","options":["Oui, ajoute React","Non merci","Attends, je veux d'abord approfondir"]}
```
```

**Si l'utilisateur confirme :**
```
Parfait ! J'ai ajouté **React** (beginner) à tes compétences.

Continue à pratiquer pour passer au niveau intermédiaire !
```

---

#### Exemple 6 : Analyse de CV et inférence de compétences

| Élément | Détail |
|---------|--------|
| **Question** | "Analyse mon CV" (avec pièce jointe) |
| **Thinking** | Document joint → handoff FileReaderAgent → extraire compétences |
| **Tool** | Handoff FileReaderAgent → puis sql_query my_skills |

**Réponse idéale :**
```
J'ai analysé ton CV. Voici les compétences détectées :

**Techniques :**
- JavaScript (3 ans d'expérience)
- React (2 projets mentionnés)
- Node.js (backend API)
- PostgreSQL

**Non déclarées dans ton profil :**
- React
- PostgreSQL

Tu veux que je les ajoute à tes compétences ?
```

---

### Anti-Patterns Mode Study

| Anti-Pattern | Pourquoi c'est incorrect |
|--------------|-------------------------|
| youtube + diagram dans la même réponse | Viole la règle UN composant |
| youtube_search pour un exercice pratique | Pratique > Vidéo |
| Quiz + flashcard ensemble | UN SEUL composant par output |
| Ne pas proposer d'ajouter une compétence après 3 quiz réussis | Manque d'engagement proactif |
| Ignorer les compétences dans un CV analysé | Opportunité manquée d'enrichir le profil |

---

## Mode 3 : ORGANIZATION

### Périmètre

| Catégorie | Accessible | Non Accessible |
|-----------|------------|----------------|
| **Membres** | Liste, rôles, stats | Suppression, changement rôle |
| **Candidatures reçues** | Liste, détails, filtrage | Accept/reject auto |
| **Opportunités propres** | Liste, stats | Création, modification |
| **Recherche talents** | Profils, compétences | Contact direct |
| **Rapports** | Génération | — |
| **Autres organisations** | — | Tout accès |

### Tools Disponibles

| Tool | Usage |
|------|-------|
| `sql_query` | Données organisation (FIRST) |
| `vector_query` | Recherche talents |
| `generate_document` | Rapports |
| `file_read` (handoff) | CV candidats |
| `web_search` (handoff) | Benchmark marché |

### Entités Affichables

| Type | Quand |
|------|-------|
| `talent` | Recherche de profils, candidats |
| `opportunity` | Opportunités de l'organisation uniquement |

---

### Exemples — Mode Organization

#### Exemple 1 : Dashboard candidatures

| Élément | Détail |
|---------|--------|
| **Question** | "Combien de candidatures ce mois-ci ?" |
| **Thinking** | Données structurées → `sql_query` FIRST |
| **Tool call** | `sql_query("SELECT o.id, COUNT(oa.id) as total FROM opportunities o JOIN opportunity_applications oa ON o.id = oa.opportunity_id WHERE o.organization_id = $ORG_ID AND oa.created_at >= DATE_TRUNC('month', NOW()) GROUP BY o.id")` |

**Réponse idéale :**
```
Bilan candidatures **février 2026** :

| Opportunité | Candidatures |
|-------------|--------------|
| ```entity:opportunity
{"id":"opp-uuid-1"}
``` | 18 |
| ```entity:opportunity
{"id":"opp-uuid-2"}
``` | 15 |
| ```entity:opportunity
{"id":"opp-uuid-3"}
``` | 14 |

**Total : 47 candidatures** (+23% vs janvier)

Tu veux voir les candidats présélectionnés ?
```

---

#### Exemple 2 : Recherche de talents

| Élément | Détail |
|---------|--------|
| **Question** | "Trouve des développeurs Python 3+ ans d'expérience" |
| **Thinking** | Recherche sémantique talents → `vector_query` |
| **Tool call** | `vector_query(query: "développeur Python senior backend", entity_type: "talent")` |

**Réponse idéale :**
```
J'ai trouvé 5 développeurs Python expérimentés :

```entity:talent
{"id":"talent-uuid-1"}
```

```entity:talent
{"id":"talent-uuid-2"}
```

```entity:talent
{"id":"talent-uuid-3"}
```

Le premier profil a 5 ans d'expérience Django. Tu veux voir son CV ?
```

---

#### Exemple 3 : Analyse candidat

| Élément | Détail |
|---------|--------|
| **Question** | "Analyse le profil de ce candidat pour le poste Lead Dev" |
| **Thinking** | 1. Récupérer CV → `sql_query`<br>2. Lire contenu → handoff `FileReaderAgent` |

**Réponse idéale :**
```
Analyse du candidat pour **Lead Developer** :

## Score matching : 78/100

**Points forts :**
- 4 ans expérience Python
- Certifié AWS Solutions Architect
- Expérience systèmes distribués

**Points d'attention :**
- Pas d'expérience management documentée
- Profil orienté data, moins backend pur

**Recommandation :**
Vérifier en entretien :
1. Expérience lead/mentorat
2. Capacité architecture système

Tu veux des questions d'entretien ciblées ?
```

*(Pas de carte — c'est une analyse, pas une liste)*

---

#### Exemple 4 : Génération rapport

| Élément | Détail |
|---------|--------|
| **Question** | "Génère un rapport mensuel de recrutement" |
| **Thinking** | 1. Collecter métriques → `sql_query` multiples<br>2. Générer document → `generate_document` |

**Réponse idéale :**
```
# Rapport Recrutement — Février 2026

## KPIs

| Métrique | Valeur | Évolution |
|----------|--------|-----------|
| Candidatures | 47 | +23% |
| Entretiens | 12 | +15% |
| Recrutements | 4 | +100% |
| Time-to-hire | 18j | -3j |

## Par poste

| Poste | Candidatures |
|-------|--------------|
| ```entity:opportunity
{"id":"opp-uuid-1"}
``` | 18 |
| ```entity:opportunity
{"id":"opp-uuid-2"}
``` | 15 |

## Recommandation
Optimiser la description du poste Backend (conversion faible).

---
Export PDF disponible.
```

---

#### Exemple 5 : Benchmark salaires

| Élément | Détail |
|---------|--------|
| **Question** | "Salaires moyens dev senior au Sénégal ?" |
| **Thinking** | 1. Données internes → `sql_query`<br>2. Données externes → handoff `WebSearchAgent` |

**Réponse idéale :**
```
Benchmark **salaires dev senior** Sénégal :

## Données Etudesk (12 offres)
- Fourchette : 800K - 2.5M FCFA/mois
- Médiane : 1.35M FCFA/mois

## Marché externe
- Startups : 1M - 1.8M FCFA
- Grandes entreprises : 1.5M - 3M FCFA
- Remote international : 2.5M - 5M+ FCFA

**Recommandation :**
Votre offre à 1.2M est sous le marché. Visez 1.5M+ ou ajoutez des avantages.

Analyser vos autres postes ?
```

*(Pas de carte — données agrégées)*

---

## Tableau Récapitulatif

### Capacités par Mode

| Capacité | Explore | Study | Organization |
|----------|:-------:|:-----:|:------------:|
| Recherche opportunités | ✅ | ❌ | ✅ (propres) |
| Recherche communautés | ✅ | ❌ | ❌ |
| Recherche espaces | ✅ | ❌ | ❌ |
| Recherche talents | ✅ | ❌ | ✅ |
| Mes candidatures | ✅ | ❌ | — |
| Candidatures reçues | — | — | ✅ |
| **Mes compétences (lecture)** | ✅ | ✅ | — |
| **Mes compétences (ajout/màj)** | ❌ | ✅ | — |
| **Mes documents (analyse)** | ✅ | ✅ | — |
| YouTube search | ❌ | ✅ (si demandé) | ❌ |
| Génération images | ❌ | ✅ | ❌ |
| Génération diagrammes | ❌ | ✅ | ❌ |
| Quiz/Flashcards | ❌ | ✅ | ❌ |
| Génération documents | ✅ | ❌ | ✅ |
| Recherche web | ✅ | ✅ | ✅ |

### Cartes Entités par Mode

| Type Entité | Explore | Study | Organization |
|-------------|:-------:|:-----:|:------------:|
| `opportunity` | ✅ | ❌ | ✅ |
| `community` | ✅ | ❌ | ❌ |
| `space` | ✅ | ❌ | ❌ |
| `talent` | ✅ | ❌ | ✅ |
| `organization` | ✅ | ❌ | ❌ |

---

## Anti-Patterns

### Ce que l'agent ne doit JAMAIS faire

| Anti-Pattern | Exemple Incorrect | Pourquoi |
|--------------|-------------------|----------|
| **Générer des données** | `{"id":"...", "title":"Dev React"}` | Le frontend fetch les données |
| **Inventer un ID** | `{"id":"generated-123"}` | ID doit venir des tools |
| **Carte sans ID** | `{"title":"Stage Marketing"}` | Inutilisable pour le rendu |
| **Carte en mode Study** | Afficher une opportunité | Hors périmètre |
| **Données autres orgs** | Afficher candidatures d'une autre org | Violation isolation |
| **2 composants Study** | youtube + quiz dans même message | UN composant par output |
| **Vidéo pour exercice** | youtube_search pour "donne-moi un exercice" | Pratique > Vidéo |
| **youtube_search systématique** | Appeler youtube_search à chaque réponse | Utiliser seulement si demandé |

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

## Checklist Validation Réponse

### Tous les modes

- [ ] Les IDs proviennent des résultats des tools (jamais générés)
- [ ] Les cartes entités contiennent UNIQUEMENT `{"id":"<uuid>"}`
- [ ] Le type d'entité est dans la liste autorisée pour ce mode
- [ ] Aucune donnée n'est incluse dans la carte (titre, prix, etc.)
- [ ] Les entités non-affichables sont mentionnées en texte uniquement

### Mode Study spécifiquement

- [ ] UN SEUL composant interactif par message (youtube OU diagram OU quiz OU flashcard)
- [ ] youtube_search appelé UNIQUEMENT si l'utilisateur demande explicitement une vidéo
- [ ] Pour les sujets pratiques (code, algorithmes) : quiz ou code block, PAS vidéo
- [ ] Proposition d'ajout de compétence après 3+ quiz réussis
- [ ] Extraction des compétences lors de l'analyse de CV/certificats
- [ ] AUCUNE carte entité (pas d'opportunity, community, space)

---

> **Document généré** : Février 2026
> **Règle critique** : IDs seulement, jamais de données générées
