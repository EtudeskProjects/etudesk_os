---
name: Bilan Compétences (RH)
description: Bilan RH des compétences (par talent ou profil) sous forme de cartes (bloc skills) + synthèse courte
modes: study, org
tools: sql_query, file_reader
triggers: bilan compétences, bilan competences, bilan rh, profil de compétences, profil de competences, mes compétences, mes competences, radar compétences, radar competences, bilan compétences radar, bilan competences radar
priority: 9
---

# Bilan Compétences (RH) — Workflow

Objectif: produire un bilan lisible (RH) qui résume un profil de compétences. **JAMAIS de radar** : on rend le bloc `skills` (cartes de compétences).

## Sortie attendue

Rendre un bloc `skills` (cartes), chaque carte = une compétence du talent avec son `type` et son `level` (référentiel) :

```skills
{"title":"Bilan de compétences","skills":[{"name":"Stratégie d'entreprise","type":"hard_skill","level":"advanced"},{"name":"Économie numérique","type":"knowledge","level":"advanced"},{"name":"Communication","type":"soft_skill","level":"intermediate"},{"name":"Python","type":"language","level":"intermediate"}]}
```

Types du référentiel : `knowledge`, `hard_skill`, `soft_skill`, `tool_platform`, `language`. Niveaux : `beginner`, `intermediate`, `advanced`, `master`. Une compétence **validated** (prouvée par participation) prime sur une simple **declared**.

## Mode STUDY (Talent)

1. Utiliser `<skills>` du contexte (ne pas appeler sql_query pour relire les skills).
2. Si un CV existe dans le contexte et qu'il est utile pour enrichir: appeler `file_reader` UNE seule fois avec UN documentId.
3. Sélectionner les 5-8 compétences les plus avancées (tous types confondus).
4. Render le bloc `skills` puis 3 puces max: forces (type/famille dominant), lacunes (type faible ou famille absente), prochaine action (compétence du référentiel à travailler en mode Étudier).

## Mode ORG (RH)

Cas A: si la requête mentionne un talent/candidat spécifique (ID ou carte talent déjà visible)
1. `sql_query` intent `org_talent_profile` (params: organizationId, talentId) pour récupérer `skills`.
2. Optionnel: si document CV existe dans `documents`, `file_reader` sur le CV pour vérifier cohérence.
3. Render le bloc `skills` du talent puis une synthèse RH courte (max 5 lignes).

Cas B: si la requete est "bilan global" (org)
1. `sql_query` intent `org_skills_analytics` (params: organizationId).
2. Render un `donut`/`bar` de **distribution par type** ou **par niveau** (cf. Catalog #3 / #13) — JAMAIS un radar — puis 2 recommandations (type ou **famille** sous-représenté(e) dans le vivier → cibler le recrutement/la formation sur ces compétences du référentiel).

## Regles

- Pour un profil individuel, le bloc `skills` est le composant principal. Ne pas rendre d'autres composants interactifs dans le même message.
- Tous les nombres doivent venir du contexte ou des tools.
- En org mode: ne jamais accéder aux intents my_*.
