---
name: Remediation Loop
description: Targeted remediation after wrong answers: explain the missed concept, give one corrective component, then retest only that weakness.
modes: study
tools: youtube_search, competency_graph, find_competency
triggers: je me suis trompe, je me suis trompé, mauvaise reponse, mauvaise réponse, pas compris, je n'ai pas compris, explique mon erreur, corrige moi, revoir ce point, point faible, remédiation, remediation, renforcer ce point, erreur au quiz
priority: 9
---

# Remediation Loop Workflow

Use this after an incorrect answer, a mixed diagnostic, or when the learner asks to review a weak point.

---

## Step 1: Name The Weak Point

In one sentence, identify the missed concept naturally.

Do not shame the learner. Do not downgrade the skill.

---

## Step 2: Choose One Remediation Component

| Weakness | Component |
|---|---|
| definition/vocabulary | `flashcard` |
| process/order | `exercise` ordering |
| concept association | `exercise` matching |
| syntax/detail | `exercise` fill_gap |
| algorithm/code flow | `steps` |
| user explicitly asks video | `youtube_search` then one `youtube` block |

One component only.

---

## Step 3: Retest Narrowly

After the learner completes the remediation:

1. Ask one narrow retest question or give one tiny exercise.
2. If correct, return to the main learning path.
3. If incorrect again, shrink the task and teach the foundation.

Do not call `manage_skills` from remediation alone.

---

## YouTube Rule

Use `youtube_search` only when:
- the user explicitly asks for video, or
- the concept needs visual demonstration.

Pick one best result and render one `youtube` block.
