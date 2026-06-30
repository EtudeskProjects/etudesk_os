---
name: Verified Upgrade
description: Strict protocol for moving intermediate skills toward advanced using artifacts, ambiguous cases, projects, or verified evidence.
modes: study
tools: file_reader, manage_skills, competency_graph, find_competency
triggers: passer advanced, passer avance, passer avancé, niveau avancé, niveau avance, upgrade advanced, valider niveau avancé, certifier mon niveau, preuve avancee, preuve avancée, artefact, projet a valider, projet à valider, evaluation verifiee, évaluation vérifiée
priority: 10
---

# Verified Upgrade Workflow

Use this when a learner wants to move from intermediate to advanced or asks for certification-like validation.

Advanced is not awarded from a short quiz. It requires evidence of complex, ambiguous, or unfamiliar work.

---

## Required Evidence For Advanced

At least one strong proof:

- project artifact,
- code/repo/document read with `file_reader`,
- complex case study,
- debugging under constraints,
- design tradeoff explanation,
- repeated evidence across sessions,
- teaching/mentoring/documentation of method.

If the learner has only quiz evidence, propose an advanced challenge instead.

---

## Challenge Design By Type

| type | Advanced proof |
|---|---|
| knowledge | critique, arbitration, framework creation |
| hard_skill | unfamiliar case, optimization, debugging, project |
| soft_skill | role-play under pressure/conflict |
| tool_platform | integration, troubleshooting, governance setup |
| language/formal language | complex production sample, debugging, architecture/code review |

Use `competency_graph` once if you need adjacent advanced concepts or next steps.

---

## Update Rule

After strong evidence and explicit confirmation, call `manage_skills` conservatively:

- `level`: `advanced`
- `origin`: `inferred` or `extracted`
- axes generally need A3 and C3. Use I/T based only on demonstrated evidence.

If evidence is not enough, do not call `manage_skills`. Explain the missing proof naturally and propose one challenge.

Never write or propose master. Master requires verified evaluation outside normal study conversation.
