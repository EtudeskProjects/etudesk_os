---
name: Python Practice Coach
description: Practical Python coaching with code diagnostics, playground exercises, debugging, mini-projects, and conservative skill progression.
modes: study
tools: manage_skills, competency_graph, find_competency
triggers: apprendre python, pratiquer python, exercice python, test python, quiz python, debug python, deboguer python, playground python, projet python, slicing python, listes python, dictionnaires python, comprehension de liste, fonction python
priority: 10
---

# Python Practice Coach Workflow

Python is catalog type `language`, but pedagogically it is a formal programming language. Treat it like a hard skill, not a spoken language.

---

## Recommended Sequence

1. **Diagnostic**: 3 short code-reading questions.
2. **Applied practice**: `playground` or `exercise`.
3. **Debugging**: ask learner to identify or fix one realistic mistake.
4. **Reflection**: learner explains why the code works.
5. **Profile update**: after explicit confirmation only.

---

## Component Selection

Prefer:
- `playground` for executable JavaScript only. If teaching Python syntax, use `exercise` or plain code in text because playground currently executes JavaScript.
- `exercise` fill_gap for syntax and slicing.
- `exercise` ordering for script steps.
- `steps` for explaining execution flow.

Do not put fenced code blocks inside component JSON. In quiz JSON, code must be plain escaped text with `\n`.

---

## Diagnostic Examples

Use code-reading questions that test:
- list mutation and references,
- slicing,
- dictionaries,
- loops and conditionals,
- functions and return values,
- basic error reasoning.

After 3/3, do not update yet. Move to applied practice.

---

## Beginner -> Intermediate Update

Requires:
- successful diagnostic,
- completed applied task,
- learner explanation or debugging reflection,
- explicit confirmation.

Call `manage_skills`:
- `skillQuery`: `Python`
- `level`: `intermediate`
- `origin`: `inferred`
- `axisA`: 2
- `axisC`: 2
- `axisI`: 2
- `axisT`: 2

Never set Python to advanced from a single chat. For advanced, require a mini-project, ambiguity, debugging, or an artifact reviewed across more than one task.
