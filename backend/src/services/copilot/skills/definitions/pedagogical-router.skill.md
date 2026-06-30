---
name: Pedagogical Router
description: Route a Study Mode request by catalog edges, competency type, family rhythm, and evidence requirements before choosing a learning component.
modes: study
tools: find_competency, competency_graph, youtube_search, web_search, file_reader, manage_skills
triggers: parcours pedagogique, parcours pédagogique, progression competence, progression compétence, plan de formation, chemin d'apprentissage, quoi apprendre ensuite, par ou commencer, par où commencer, roadmap, referentiel, référentiel, exploiter le graphe, prerequis, prérequis, composant pedagogique, composant pédagogique, workflow pedagogique, workflow pédagogique
priority: 9
---

# Pedagogical Router Workflow

Use this workflow when the learner asks what to learn next, how to progress, how to structure a course, or when the agent must choose the right Study Mode component.

Principle: the graph decides **what comes before what**; the competency type decides **how to teach it**.

---

## Step 1: Resolve The Catalog Skill

1. If the target skill is obvious and already present in `<skills>`, use that label and type.
2. If it is not obvious, call `find_competency(query)` once.
3. If the result is outside the catalog, redirect gently to 2-3 catalog suggestions. Do not invent custom skills.
4. For progression, prerequisites, or next steps, call `competency_graph(skill)` once and use its prerequisites, roadmap, siblings, related skills, and next steps.

---

## Step 2: Sequence With Edges

Use edges in this order:

1. `prerequisite` edges define the teaching order. Teach foundations first.
2. `sibling` edges provide lateral practice or nearby alternatives after the foundation.
3. `co_occurrence` edges provide real-work combinations, projects, or portfolio evidence.

If a target is advanced or frontier-like and the learner is beginner, teach the nearest prerequisite/hub first and name the target as the horizon.

---

## Step 3: Choose The Component By Type

Render exactly ONE component.

| type | Pedagogical route | Preferred component |
|---|---|---|
| knowledge | flashcard -> case analysis -> critique/arbitrage -> evidence portfolio | `flashcard`, `steps`, analysis `exercise` |
| hard_skill | guided practice -> debugging -> mini-project -> practice validation | `playground`, `exercise`, `steps` |
| tool_platform | guided workflow -> ordering -> troubleshooting -> autonomous workflow | `steps`, `youtube` only for visual demo, `exercise` |
| soft_skill | role-play -> pressure scenario -> feedback/reflection -> repeat | scenario text, `audio_tts` when spoken delivery matters |
| language | vocal-first drills -> spoken production -> correction -> spaced repetition | `audio_tts`, short vocab `flashcard`; formal languages use hard_skill |

Do not let user intent override the type when it would weaken learning. Example: for Python, prefer `playground` or `exercise` over video unless the user explicitly asks for video.

For non-assessment teaching, use these richer formats:

- `knowledge`: include one misconception and one decision tradeoff. The learner should leave with a mental model, not only a definition.
- `hard_skill`: include one executable or inspectable production move: implement, debug, refactor, trace, or test.
- `tool_platform`: include "how to know it worked" and one likely failure mode.
- `soft_skill`: include a realistic professional constraint: time pressure, disagreement, unclear request, stakeholder tension, or feedback.
- `language`: handled by the vocal coach unless it is a formal language.

---

## Step 4: Adapt By Family Rhythm

- Fast-changing families (`ai_ml_automation`, `cloud_devops_infrastructure`, `cybersecurity_digital_trust`): use current practice, short explanations, and `web_search` only if freshness matters.
- Medium families (`software_engineering`, `data_analytics_bi`, `industry_hardware_mobility`, `finance_fintech_digital_assets`, `product_ux_design`, `marketing_sales_content`, `education_learning_tech`): use deliverables, mini-projects, and measurable outputs.
- Slow/stable families (`digital_foundations`, `human_communication_languages`, `law_compliance_governance`, `health_biotech_medtech`, `sustainability_climate_energy_agri`, `business_operations_management`): use concrete cases, repetition, mentoring, and careful evidence.

---

## Step 5: Evidence And Skill Updates

Never update a skill from explanation or a short quiz alone.

Before `manage_skills`, require:

1. diagnostic signal,
2. applied production or scenario,
3. learner reflection,
4. explicit consent.

For beginner -> intermediate, call `manage_skills` only after consent and pass `axisA=2`, `axisC=2`, `axisI=2`, `axisT=2`.

For language skills, require a spoken or written production sample plus correction loop before any update. Do not promote from listen-and-repeat alone.
