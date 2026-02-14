# Skills — Bonnes Pratiques pour les Agents Etudesk

> Documentation des conventions et bonnes pratiques pour créer et maintenir les skills du copilot.
> Référence : [skill.loader.ts](../backend/src/services/copilot/skills/skill.loader.ts) | [manage-skills.tool.ts](../backend/src/services/copilot/tools/manage-skills.tool.ts)

---

## 1. Structure du Frontmatter

Chaque skill doit respecter le format YAML suivant :

```yaml
---
name: Nom lisible
description: Description courte pour le matching (inclut "quand utiliser")
modes: explore, study, org  # au moins un
tools: tool1, tool2  # uniquement les tools disponibles dans le(s) mode(s)
triggers: mot1, phrase2, synonyme3  # mots-clés pour détection
priority: 5  # optionnel, plus élevé = prioritaire en cas de conflit
---
```

### Champs requis

- **name** : Nom humain du skill
- **description** : Utilisée pour le matching — doit inclure ce que fait le skill ET quand l'utiliser
- **modes** : Liste des modes où le skill est disponible
- **tools** : Liste des tools utilisés (doivent exister dans le mode)
- **triggers** : Mots ou phrases déclenchant le skill (détection par `includes` sur le message normalisé)

### Champs optionnels

- **priority** : En cas de conflit (plusieurs skills matchent), le plus élevé gagne. Défaut : 0.

---

## 2. Règles de Cohérence Tools / Mode

| Mode | Tools disponibles |
|------|-------------------|
| **explore** | vector_query, sql_query, generate_document, file_reader, web_search, execute_action |
| **study** | sql_query (my_profile, my_skills, my_documents), youtube_search, generate_image, generate_diagram, file_reader, web_search, manage_skills |
| **org** | vector_query, sql_query, generate_document, file_reader, web_search, execute_action |

Une skill ne doit déclarer que des tools disponibles dans son mode.

---

## 3. Valeurs des Paramètres Tools

### manage_skills

- **origin** : `declared` \| `inferred` \| `extracted` — **PAS** "DOCUMENT_EXTRACTED"
- **type** : `HARD_SKILL` \| `SOFT_SKILL` \| `KNOWLEDGE`
- **proficiencyLevel** : `BEGINNER` \| `INTERMEDIATE` \| `EXPERT` \| `MASTER`

Toujours inclure `type` dans les appels manage_skills.

---

## 4. Conventions d'Instructions

- Utiliser l'impératif / infinitif
- Une seule composante par message (flashcard OU quiz, jamais les deux)
- Référencer les blocs de contexte existants : `<skills>`, `<user_profile>`, `<profile_completeness>`
- Limiter la longueur des réponses (ex. 800-1200 caractères selon le type)
- Contexte UEMOA : salaires XOF, entreprises locales (Orange, Wave, MTN, Jumia)

---

## 5. Format des Outputs

### Entity cards

- Format exact : `entity:document {"id":"uuid"}` — uniquement l'id, pas de données supplémentaires
- Pour les documents générés : utiliser l'id retourné par `generate_document`

### Charts

- Types supportés : `bar`, `stacked_bar`, `table`, `metric`
- Format : `{"type":"...","title":"...","data":[...]}`

---

## 6. Progressive Disclosure

- Garder le corps des instructions sous 500 lignes
- Éviter la duplication : déplacer les détails dans des fichiers `references/` si nécessaire
- Décrire clairement quand lire un fichier de référence

---

## 7. Triggers

- Privilégier des triggers discriminants (éviter les mots trop génériques)
- Éviter les triggers géographiques trop spécifiques ("formation Abidjan", "formation Dakar") — risque de faux positifs
- En cas de chevauchement entre skills : utiliser `priority` pour désambiguïser
- Ajouter des triggers en anglais si la plateforme est bilingue

---

## 8. Séparation des Responsabilités

Quand deux skills ont des périmètres proches, documenter explicitement la frontière :

- **job-description-generation** vs **opportunity-publishing** : "fiche PDF" = job-description ; "publier une offre" = opportunity-publishing
- **cv-generation** vs **profile-completion-guide** : "generer mon CV" = cv-generation (priority 8) ; "completer mon profil" = profile-completion

---

## 9. Edge Cases

Documenter les cas limites dans le corps du skill :

- 0 skills / 1-2 skills / 3+ skills
- Documents très courts (heuristique : "moins de 3 paragraphes" plutôt que "500 mots")
- Données manquantes

---

## 10. Validation

- Le skill loader valide la cohérence tools/mode au chargement
- Un script de validation détecte les occurrences de "DOCUMENT_EXTRACTED" (valeur invalide)
- Tests d'intégration : vérifier que les skills se chargent sans erreur
