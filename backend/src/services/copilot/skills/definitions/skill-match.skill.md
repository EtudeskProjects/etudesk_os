---
name: Skill Match (Actuel vs Cible)
description: Analyse de couverture de competences vs un poste/objectif (talent ou cohorte) avec le block skill_match
modes: explore, org
tools: sql_query, smart_search
triggers: analyse mes competences, suis-je fait pour ce poste, suis-je fait pour cette offre, qu'est-ce qui me manque, competences manquantes, gap de competences, ecart de competences, pret pour ce job, match avec l'offre, mon profil correspond, devenir, me former pour, ma cohorte couvre, mon vivier couvre, mon equipe a-t-elle les competences, couverture de la cohorte, couverture des competences, besoins du poste couverts, skill gap, actuel vs cible
priority: 8
---

# Skill Match (Actuel vs Cible) — Workflow

Objectif : rendre UN block `skill_match` qui compare des niveaux ACTUELS a des CIBLES (compétences du référentiel uniquement), avec une couverture globale et des insights actionnables.

Detecte le scope :
- **talent** (mode Explorer) : les compétences du talent vs un poste/métier qui l'intéresse.
- **cohort** (mode Gérer) : l'agrégat des compétences du vivier/cohorte vs une cible.

## Scope TALENT (mode Explorer)

1. Identifie l'offre/le métier visé. Si une offre précise est mentionnée, obtiens son id via `smart_search` si besoin.
2. CIBLES : `sql_query` intent `opportunity_skills` (params `{"opportunityId":"<id>"}`) → compétences requises (`requirement`, `min_level`). Si aucun poste précis (métier générique), déduis 5-8 compétences clés du référentiel pour ce métier.
3. ACTUELS : les compétences du talent dans `<skills>` (NE PAS rappeler sql_query my_skills).
4. Rends UN block `skill_match` scope "talent" : pour chaque compétence cible, `current` (niveau du talent ou null) + `target` (= `min_level`, sinon required→advanced / nice_to_have→intermediate). Ajoute des `insights` (forces, gaps prioritaires) et propose le mode Étudier pour combler les gaps.

## Scope COHORT (mode Gérer)

1. DISTRIBUTION : `sql_query` intent `org_skills_analytics` (params `{"organizationId":"<id>"}`) → `{skill_name, level, talent_count}`.
2. CIBLES : si un poste est visé, `opportunity_skills` (`min_level`) ; sinon cible raisonnable par compétence.
3. Par compétence cible : `coverage` = % du vivier au niveau cible ou au-dessus ; `current` = niveau agrégé (dominant/médian).
4. Rends UN block `skill_match` scope "cohort" avec `coverage` (0-100) par compétence + `summary` + `insights` (bien couvert / déficit critique / reco recrutement ou formation ciblée).

## Format du block

```skill_match
{"scope":"talent","subject":"<poste>","skills":[{"name":"React","type":"tool_platform","current":"advanced","target":"advanced"},{"name":"TypeScript","type":"hard_skill","current":"beginner","target":"advanced"}],"insights":["...","..."]}
```

Champs : `scope` ("talent"|"cohort"), `subject` (poste/objectif), `title?`, `coverage?` (0-100, sinon calculé), `summary?`, `insights?` (string[]). Chaque skill : `name`, `type` (knowledge|hard_skill|soft_skill|tool_platform|language), `current` (niveau|null), `target` (niveau), `coverage?` (cohorte, % au niveau cible).

## Regles

- Le block `skill_match` est le composant principal de la reponse. Un seul block par message.
- Compétences du **référentiel uniquement** (issues de `opportunity_skills` / `org_skills_analytics` / `<skills>`). Ne jamais inventer une compétence.
- Tous les niveaux en minuscules : beginner | intermediate | advanced | master.
- Termine par 2-4 insights concrets et UNE prochaine action (talent → mode Étudier ; org → recrutement/formation ciblée).
