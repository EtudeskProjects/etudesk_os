---
name: Practice Validation
description: Convert a successful diagnostic into applied practice before any skill update; validates autonomy through exercises, playgrounds, scenarios, or reflection.
modes: study
tools: manage_skills, competency_graph, find_competency
triggers: exercice pratique pour confirmer, pratique pour valider, confirmer mon niveau, valider mon niveau, preuve pratique, exercice appliqué, exercice applique, mise en pratique, confirme ma competence, confirmer la competence, update apres pratique, mettre a jour apres pratique
priority: 10
---

# Practice Validation Workflow

Use this workflow when the learner has just passed a diagnostic, asks to confirm a level, or asks for an exercise before updating a skill.

Goal: convert diagnostic success into applied evidence. A quiz is not enough to update a level.

---

## Step 1: Identify The Skill

1. If the topic is obvious from the conversation, use it.
2. If the topic is ambiguous, call `find_competency(query)` once.
3. If the skill is already in `<skills>`, read its current level and type from context. Do not call a tool to read skills.
4. If useful for the next task order, call `competency_graph(skill)` once and use its next steps or nearby concepts.

---

## Step 2: Choose The Validation Component By Type

Render exactly ONE component.

| type | Best validation |
|---|---|
| knowledge | case analysis, compare/critique task, `steps` or `exercise` |
| hard_skill | `playground`, project-like `exercise`, debugging task |
| soft_skill | role-play scenario, pressure/conflict case, reflection |
| tool_platform | workflow `steps`, ordering task, troubleshooting scenario |
| language | spoken/written production sample; for formal languages like Python/SQL, use hard-skill validation |

Rules:
- Coding/formal language tasks should prefer `playground` or `exercise`.
- Foundation/knowledge tasks should use a realistic professional scenario, not another definition quiz.
- Do not use YouTube for validation unless the user explicitly asks for a video.

---

## Step 3: Evaluate Completion

When the learner says they completed the task:

1. Give concise feedback on what was demonstrated.
2. Identify the evidence in plain language:
   - autonomy,
   - standard-case application,
   - quality of reasoning,
   - explanation/reflection.
3. If evidence supports beginner -> intermediate, ask explicit confirmation before `manage_skills`:
   "Je peux mettre à jour [skill] au niveau intermédiaire avec cette preuve pratique. Tu confirmes ?"
4. If evidence is insufficient, give one smaller remediation task instead of updating.

---

## Step 4: Profile Update

Only after explicit confirmation:

Call `manage_skills` with:
- `skillQuery`: catalog label
- `level`: `intermediate`
- `origin`: `inferred`
- `axisA`: 2
- `axisC`: 2
- `axisI`: 2
- `axisT`: 2

Why T=2: the learner explained/reflected on their method in chat. Never pass T=1 for an intermediate update.

Never set or propose `master`.

---

## Output Rules

- One component per response.
- Do not expose A/C/I/T, confidence, framework internals, graph internals, or tool names.
- If `manage_skills` returns a lower level than requested, explain naturally that more evidence is needed.
