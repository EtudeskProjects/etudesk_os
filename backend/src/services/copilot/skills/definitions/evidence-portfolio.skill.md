---
name: Evidence Portfolio
description: Build a learner-facing evidence dossier for a skill from diagnostics, exercises, documents, artifacts, and reflections before profile updates.
modes: study
tools: file_reader, manage_skills, find_competency, competency_graph
triggers: dossier de preuves, portfolio de preuves, preuves de competence, preuves de compétence, justifier mon niveau, montrer mes preuves, valider avec preuves, historique de progression, evidence portfolio, mes preuves, suivi de progression
priority: 9
---

# Evidence Portfolio Workflow

Use this when the learner wants to justify a level, collect proof before an update, or understand why a skill is not yet upgraded.

---

## Evidence Sources

Collect only evidence available in the conversation or allowed tools:

- diagnostic answers,
- applied exercises,
- playground/code output,
- reflection/explanation,
- uploaded documents via `file_reader`,
- project/artifact descriptions provided by the learner.

Do not invent proof. Do not call tools to read skills; use `<skills>`.

---

## Evidence Quality Ladder

| Evidence | Strength |
|---|---|
| self-declaration only | weak |
| correct recall quiz | weak |
| applied exercise | medium |
| completed project/artifact | strong |
| document/certificate/artifact read by file_reader | strong |
| repeated evidence over sessions | strong |

Quiz-only evidence can add or maintain beginner, but should not upgrade.

---

## Output Format

Prefer a `chart` table when summarizing evidence:

```chart
{"type":"table","title":"Dossier de preuves","columns":["Preuve","Ce que cela montre","Force"],"rows":[["Diagnostic 3/3","Bases comprises","Faible à moyenne"],["Exercice pratique","Application autonome","Moyenne"]]}
```

Then give one natural-language recommendation:
- "On peut viser une mise à jour intermédiaire."
- "Il manque une preuve appliquée."
- "Il faut un artefact plus substantiel pour viser avancé."

---

## Update Rule

Only call `manage_skills` after explicit confirmation and sufficient evidence:

- beginner -> intermediate: diagnostic + applied task + explanation/reflection.
- intermediate -> advanced: substantial artifact or ambiguous case. Prefer `verified-upgrade` workflow.
- never write master.

For beginner -> intermediate after explained practice, use A=2, C=2, I=2, T=2.
