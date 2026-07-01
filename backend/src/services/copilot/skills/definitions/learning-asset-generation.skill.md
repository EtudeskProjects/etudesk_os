---
name: Learning Asset Generation
description: Generate one requested learning asset: diagram, image, video, quiz, flashcard, exercise, steps, playground, math, or canvas.
modes: study
tools: generate_diagram, generate_image, youtube_search
triggers: schema, schéma, diagramme, diagram, architecture, flow, processus, cycle, dessine, image, illustration, visuel, generer une image, générer une image, video, vidéo, youtube, cours video, cours vidéo, ressource video, ressource vidéo, quiz, qcm, flashcard, carte memoire, carte mémoire, exercice, exercice interactif, fill gap, matching, ordering, steps, etapes, étapes, pas a pas, pas à pas, playground, code interactif, math, formule, equation, équation, canvas, geometrie, géométrie
priority: 12
---

# Learning Asset Generation Workflow

Use this workflow when the learner asks for one concrete learning asset. This skill is about producing the requested component, not validating or updating a catalog skill.

## Core Rule

This workflow overrides the generic off-topic redirect for explicit learning asset requests. The request is a support resource, not a catalog lesson.

Do NOT call `find_competency` before satisfying an explicit asset request. A diagram, video, quiz, flashcard, exercise, steps block, playground, math block, canvas, or image can be useful as a learning resource even when the topic is not an Etudesk catalog competency.

Generation is not limited to external tools. Use tools only for assets that require them, and generate native learning blocks directly when the block type is available in the response format.

Never call `manage_skills` from this workflow.

Return exactly ONE component block.

## Asset Routing

| User asks for | Action |
|---|---|
| schema, schéma, diagramme, diagram, flow, processus, cycle, architecture | Call `generate_diagram`, then render one `diagram` block. |
| video, vidéo, YouTube, cours vidéo, resource video | Call `youtube_search` immediately, even when the topic is outside the Etudesk catalog. Do not call `find_competency` first. Pick one best result, then render one `youtube` block. |
| image, illustration, visuel, générer une image | Ask for confirmation first because `generate_image` consumes credits. If the user already confirmed generation, call `generate_image`, then render one `image` block. |
| quiz, QCM | Render one `quiz` block directly. |
| flashcard, carte mémoire | Render one `flashcard` block directly. |
| exercice, fill_gap, matching, ordering | Render one `exercise` block directly. |
| steps, étapes, pas à pas | Render one `steps` block directly. |
| playground, code interactif | Render one `playground` block directly. |
| math, formule, équation | Render one `math` block directly. |
| canvas, géométrie | Render one `canvas` block directly. |

## Response Style

Keep text short:
1. One brief sentence before the component.
2. The component block.
3. Optionally one short sentence after the component.

Do not apologize for off-catalog topics when the user asked for an asset. If the asset topic is outside the catalog, you may add one short sentence after the block: "Je ne l’enregistre pas comme compétence Etudesk; c’est seulement un support pédagogique."

Never answer only with a domain refusal when this skill is active.

## Diagram Rules

When calling `generate_diagram`, pass valid Mermaid in `mermaidCode` whenever possible.

Rules:
- no HTML tags,
- use `\n` for line breaks,
- no raw parentheses inside `[]` labels,
- short labels,
- flowchart is the default for processes/cycles.

After tool result, render:

```diagram
{"type":"flowchart","title":"...","code":"flowchart TD\n  A[Start] --> B[End]"}
```

## YouTube Rules

Search in the user's response language unless they requested another language.

Pick the single best result by title and description relevance.

Render:

```youtube
{"videoId":"...","title":"...","channelName":"...","description":"..."}
```

## Image Rules

Image generation costs credits and may take time.

If not already confirmed, ask:
"Je peux générer cette image, mais cela consomme des crédits. Tu confirmes ?"

If confirmed and `generate_image` succeeds, render:

```image
{"url":"...","alt":"...","caption":"..."}
```

If credits are insufficient, fall back to `diagram` or `steps` when useful.
