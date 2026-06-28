---
name: Bilan Competences (RH)
description: Bilan RH des competences (par talent ou profil) sous forme de cartes (bloc skills) + synthese courte
modes: study, org
tools: sql_query, file_reader
triggers: bilan competences, bilan rh, profil de competences, mes competences, radar competences, bilan competences radar
priority: 9
---

# Bilan Competences (RH) — Workflow

Objectif: produire un bilan lisible (RH) qui resume un profil de competences. **JAMAIS de radar** : on rend le bloc `skills` (cartes de competences).

## Sortie attendue

Rendre un bloc `skills` (cartes), chaque carte = une competence du talent avec son `type` et son `level` (referentiel) :

```skills
{"title":"Bilan de competences","skills":[{"name":"Strategie d'entreprise","type":"hard_skill","level":"advanced"},{"name":"Economie numerique","type":"knowledge","level":"advanced"},{"name":"Communication","type":"soft_skill","level":"intermediate"},{"name":"Python","type":"language","level":"intermediate"}]}
```

Types du referentiel : `knowledge`, `hard_skill`, `soft_skill`, `tool_platform`, `language`. Niveaux : `beginner`, `intermediate`, `advanced`, `master`. Une competence **validated** (prouvee par participation) prime sur une simple **declared**.

## Mode STUDY (Talent)

1. Utiliser `<skills>` du contexte (ne pas appeler sql_query pour relire les skills).
2. Si un CV existe dans le contexte et qu'il est utile pour enrichir: appeler `file_reader` UNE seule fois avec UN documentId.
3. Selectionner les 5-8 competences les plus avancees (tous types confondus).
4. Render le bloc `skills` puis 3 puces max: forces (type/famille dominant), lacunes (type faible ou famille absente), prochaine action (competence du referentiel a travailler en mode Etudier).

## Mode ORG (RH)

Cas A: si la requete mentionne un talent/candidat specifique (ID ou carte talent deja visible)
1. `sql_query` intent `org_talent_profile` (params: organizationId, talentId) pour recuperer `skills`.
2. Optionnel: si document CV existe dans `documents`, `file_reader` sur le CV pour verifier coherence.
3. Render le bloc `skills` du talent puis une synthese RH courte (max 5 lignes).

Cas B: si la requete est "bilan global" (org)
1. `sql_query` intent `org_skills_analytics` (params: organizationId).
2. Render un `donut`/`bar` de **distribution par type** ou **par niveau** (cf. Catalog #3 / #13) — JAMAIS un radar — puis 2 recommandations (type ou **famille** sous-represente(e) dans le vivier → cibler le recrutement/la formation sur ces competences du referentiel).

## Regles

- Pour un profil individuel, le bloc `skills` est le composant principal. Ne pas rendre d'autres composants interactifs dans le meme message.
- Tous les nombres doivent venir du contexte ou des tools.
- En org mode: ne jamais acceder aux intents my_*.
