# Skills — Bonnes Pratiques pour les Agents Etudesk

> Documentation des conventions et bonnes pratiques pour creer et maintenir les skills du copilot.
> Reference : [skill.loader.ts](../backend/src/services/copilot/skills/skill.loader.ts) | [manage-skills.tool.ts](../backend/src/services/copilot/tools/manage-skills.tool.ts)
> Mis a jour : 21 Fevrier 2026 — 17 skills actifs

---

## 1. Structure du Frontmatter

Chaque skill doit respecter le format YAML suivant :

```yaml
---
name: Nom lisible
description: Description courte pour le matching (inclut "quand utiliser")
modes: explore, study, org  # au moins un
tools: tool1, tool2  # uniquement les tools disponibles dans le(s) mode(s)
triggers: mot1, phrase2, synonyme3  # mots-cles pour detection
priority: 5  # optionnel, plus eleve = prioritaire en cas de conflit
---
```

### Champs requis

- **name** : Nom humain du skill
- **description** : Utilisee pour le matching semantique (embeddings) ET statique (triggers) — doit inclure ce que fait le skill ET quand l'utiliser
- **modes** : Liste des modes ou le skill est disponible
- **tools** : Liste des tools utilises (doivent exister dans le mode)
- **triggers** : Mots ou phrases declenchant le skill (detection par substring match sur le message normalise, min 3 chars)

### Champs optionnels

- **priority** : En cas de conflit (plusieurs skills matchent), le plus eleve gagne. Defaut : 0.

---

## 2. Regles de Coherence Tools / Mode

| Mode | Tools disponibles |
|------|-------------------|
| **explore** | smart_search, sql_query, generate_document, file_reader, web_search, execute_action |
| **study** | sql_query, youtube_search, generate_image, generate_diagram, file_reader, web_search, manage_skills, execute_action |
| **org** | smart_search, sql_query, generate_document, file_reader, web_search, execute_action |

Une skill ne doit declarer que des tools disponibles dans son mode.

---

## 3. Valeurs des Parametres Tools

### manage_skills

- **skillQuery** : LABEL de competence (resolu au catalogue Etudesk ; un label hors catalogue est rejete avec des suggestions)
- **level** : `beginner` \| `intermediate` \| `advanced` \| `master` — l'agent est plafonne a `advanced` (master = evaluation verifiee uniquement)
- **origin** : `declared` \| `inferred` \| `extracted` (jamais `validated` — reserve a la validation par participation)
- **axisA/axisC/axisI/axisT** (optionnels, 1-4) : Autonomy / Complexity / Impact / Transmission, pour un grading par le framework

---

## 4. Conventions d'Instructions

- Utiliser l'imperatif / infinitif
- Une seule composante par message (flashcard OU quiz, jamais les deux)
- Referencer les blocs de contexte existants : `<skills>`, `<user_profile>`, `<profile_completeness>`
- Limiter la longueur des reponses (ex. 800-1200 caracteres selon le type)
- Contexte UEMOA : salaires XOF, entreprises locales (Orange, Wave, MTN, Jumia)

---

## 5. Format des Outputs

### Entity cards

- Format exact : `entity:document {"id":"uuid"}` — uniquement l'id, pas de donnees supplementaires
- Pour les documents generes : utiliser l'id retourne par `generate_document`

### Charts

- Types supportes : `bar`, `stacked_bar`, `table`, `metric`, `donut`, `radar`
- Format : `{"type":"...","title":"...","data":[...]}`

---

## 6. Progressive Disclosure

- Garder le corps des instructions sous 500 lignes
- Eviter la duplication : deplacer les details dans des fichiers `references/` si necessaire
- Decrire clairement quand lire un fichier de reference

---

## 7. Triggers

- Privilegier des triggers discriminants (eviter les mots trop generiques, min 3 chars)
- Eviter les triggers geographiques trop specifiques ("formation Abidjan") — risque de faux positifs
- En cas de chevauchement entre skills : utiliser `priority` pour desambiguiser
- Ajouter des triggers en anglais si la plateforme est bilingue
- Les triggers UEMOA (Abidjan, Dakar, FCFA, Wave, etc.) donnent un bonus +1 dans le matching statique

---

## 8. Separation des Responsabilites

Quand deux skills ont des perimetres proches, documenter explicitement la frontiere :

- **job-description-generation** vs **opportunity-publishing** : "fiche PDF" = job-description ; "publier une offre" = opportunity-publishing
- **cv-generation** vs **onboarding** : "generer mon CV" = cv-generation ; "c'est parti / bienvenue" = onboarding
- **deep-dive-lesson** vs **exam-simulation** : "cours/lecon/apprends-moi" = deep-dive ; "teste-moi/examen/certification" = exam-simulation
- **autodiagnostic-talent** vs **weekly-recap** : "bilan competences" = autodiagnostic ; "bilan semaine/progression" = weekly-recap

---

## 9. Detection de Skill

Le skill loader utilise un algorithme a 2 niveaux :

1. **Semantic** (si embeddings pre-calcules) : cosine similarity >= 0.45
2. **Static fallback** : substring match sur triggers normalises (Unicode, lowercase)

Les embeddings sont pre-calcules au startup via `precomputeSkillEmbeddings()` (cache 24h).

---

## 10. Edge Cases

Documenter les cas limites dans le corps du skill :

- 0 skills / 1-2 skills / 3+ skills
- Documents tres courts (heuristique : "moins de 3 paragraphes" plutot que "500 mots")
- Donnees manquantes
- Bail-out apres N iterations sans progres (ex: socratique apres 4 questions)

---

## 11. Validation

- Le skill loader valide la coherence tools/mode au chargement
- Tests d'integration : verifier que les skills se chargent sans erreur
- Grep `DOCUMENT_EXTRACTED|SELF_DECLARED|ADVANCED` dans les skills → 0 resultats
