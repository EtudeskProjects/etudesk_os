---
name: Bilan Competences Radar (RH)
description: Bilan RH des competences sous forme de radar (par talent ou profil) + synthese courte
modes: study, org
tools: sql_query, file_reader
triggers: radar, radar competences, bilan competences radar, bilan rh radar, spider chart, toile d araignee, radar skills
priority: 9
---

# Bilan Competences Radar (RH) — Workflow

Objectif: produire un **radar** lisible (RH) qui resume un profil de competences.

## Sortie attendue

Toujours rendre un bloc. Les axes suivent les **5 types du référentiel** (catalogue) :

```chart
{
  "type":"radar",
  "title":"Radar competences",
  "axes":["Savoir","Savoir-faire","Savoir-être","Outils","Langues"],
  "max":5,
  "series":[{"name":"Actuel","values":[3,4,2,3,2]}]
}
```

Les 5 axes correspondent aux types catalogue : Savoir = `knowledge`, Savoir-faire = `hard_skill`, Savoir-être = `soft_skill`, Outils = `tool_platform`, Langues = `language`.

## Echelle

- `max = 5`
- Mapping niveaux (lowercase, référentiel) -> score:
  - beginner = 2
  - intermediate = 3
  - advanced = 4
  - master = 5
- Pondère par la confiance/origine quand disponible : une compétence **validated** (prouvée par participation) pèse plus qu'une simple **declared**.

## Mode STUDY (Talent)

1. Utiliser `<skills>` du contexte (ne pas appeler sql_query pour relire les skills).
2. Si un CV existe dans le contexte et qu'il est utile pour enrichir: appeler `file_reader` UNE seule fois avec UN documentId.
3. Construire les 5 axes (un par type catalogue), chaque valeur = moyenne des scores des compétences de ce type (sinon 1) :
   - Savoir = `knowledge` · Savoir-faire = `hard_skill` · Savoir-être = `soft_skill` · Outils = `tool_platform` · Langues = `language`
4. Render le radar puis 3 puces max: forces (type/famille dominant), lacunes (type faible ou famille absente), prochaine action (compétence du référentiel à travailler en mode Étudier).

## Mode ORG (RH)

Cas A: si la requete mentionne un talent/candidat specifique (ID ou carte talent deja visible)
1. `sql_query` intent `org_talent_profile` (params: organizationId, talentId) pour recuperer `skills`.
2. Optionnel: si document CV existe dans `documents`, `file_reader` sur le CV pour verifier coherence.
3. Calculer les 5 axes comme en mode study (a partir de la liste `skills`).
4. Render le radar puis une synthese RH courte (max 5 lignes).

Cas B: si la requete est "radar global" (org)
1. `sql_query` intent `org_skills_analytics` (params: organizationId) et construire un radar "maturite globale" sur les 5 types catalogue (Savoir / Savoir-faire / Savoir-être / Outils / Langues) : score basé sur la distribution des niveaux par type (plus de advanced/master => score haut).
2. Render radar + 2 recommandations (ex: type ou **famille** sous-représenté(e) dans le vivier → cibler le recrutement/la formation sur ces compétences du référentiel).

## Regles

- Le radar est le composant principal. Ne pas rendre d'autres composants interactifs dans le meme message.
- Tous les nombres doivent venir du contexte ou des tools.
- En org mode: ne jamais acceder aux intents my_*.

