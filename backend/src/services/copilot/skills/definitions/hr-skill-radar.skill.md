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

Toujours rendre un bloc:

```chart
{
  "type":"radar",
  "title":"Radar competences",
  "axes":["Hard skills","Soft skills","Knowledge","Profondeur","Seniorite"],
  "max":5,
  "series":[{"name":"Actuel","values":[3,2,3,3,2]}]
}
```

## Echelle

- `max = 5`
- Mapping niveaux -> score:
  - BEGINNER = 2
  - INTERMEDIATE = 3
  - EXPERT = 4
  - MASTER = 5

## Mode STUDY (Talent)

1. Utiliser `<skills>` du contexte (ne pas appeler sql_query pour relire les skills).
2. Si un CV existe dans le contexte et qu'il est utile pour enrichir: appeler `file_reader` UNE seule fois avec UN documentId.
3. Construire les axes (5 valeurs):
   - Hard skills: moyenne des scores des skills type HARD_SKILL (sinon 1)
   - Soft skills: moyenne des scores des skills type SOFT_SKILL (sinon 1)
   - Knowledge: moyenne des scores des skills type KNOWLEDGE (sinon 1)
   - Profondeur: moyenne globale des scores (cappee a 5)
   - Seniorite: proportion de skills EXPERT+MASTER (0..1) mappee sur 1..5
4. Render le radar puis 3 puces max: forces, lacunes, prochaine action.

## Mode ORG (RH)

Cas A: si la requete mentionne un talent/candidat specifique (ID ou carte talent deja visible)
1. `sql_query` intent `org_talent_profile` (params: organizationId, talentId) pour recuperer `skills`.
2. Optionnel: si document CV existe dans `documents`, `file_reader` sur le CV pour verifier coherence.
3. Calculer les 5 axes comme en mode study (a partir de la liste `skills`).
4. Render le radar puis une synthese RH courte (max 5 lignes).

Cas B: si la requete est "radar global" (org)
1. `sql_query` intent `org_skills_analytics` (params: organizationId) et construire un radar "maturite globale":
   - Hard skills / Soft skills / Knowledge: score base sur la distribution des niveaux (plus de EXPERT/MASTER => score haut)
   - Profondeur: moyenne approx.
   - Seniorite: ratio EXPERT/MASTER
2. Render radar + 2 recommandations.

## Regles

- Le radar est le composant principal. Ne pas rendre d'autres composants interactifs dans le meme message.
- Tous les nombres doivent venir du contexte ou des tools.
- En org mode: ne jamais acceder aux intents my_*.

