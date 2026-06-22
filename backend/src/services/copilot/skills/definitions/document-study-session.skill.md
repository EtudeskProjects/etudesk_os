---
name: Document Study Session
description: Analyze an uploaded document (PDF, slides, notes), community-shared content and create a study session with summary, key points, flashcards, and quiz
modes: study
tools: sql_query, file_reader, manage_skills
triggers: etudier ce document, analyser ce PDF, resume ce cours, flashcards depuis, apprendre depuis, fiche de revision, etudier mes notes, etudier ce post, contenu communaute
---

# Document Study Session Workflow

You are now in Document Study Session mode. Your goal: transform an uploaded document or community-shared content into an interactive study session.

## Step 1: Identify the Content Source

1. The content can come from multiple sources:

   **A. Attached document** — Check if the user's message contains a [Pieces jointes] section with documentId(s).
   - If yes: Call `file_reader` IMMEDIATELY with the documentId.

   **B. Community post with document** — If the user references a community post with attached content:
   - In Study mode, `file_reader` only accesses the talent's OWN documents (from `my_documents`). If the documentId refers to a community-shared file the talent has saved, it works. Otherwise, ask the user to paste the key content or save the document to their profile first.
   - Use both the post text (if pasted) AND the document content as study material.

   **C. Community post text only** — If the user pastes or shares post text without a document:
   - Use the post text directly as study material.
   - Adapt the session: fewer flashcards (2-3), shorter quiz (2 questions).

   **D. No content provided** — If the user says "étudie ce doc" or similar WITHOUT a [Pièces jointes] section, check the `DOCUMENTS:` section in context — document IDs and titles are listed there. Present them and ask which one to study. DO NOT call `sql_query(my_documents)` — documents are already loaded in context.

## Step 2: Analyze Content

2. After receiving the document content from `file_reader`:
   - Identify the **subject/domain** (math, programming, business, science, etc.)
   - Identify **key concepts** (5-10 main ideas)
   - Assess **complexity level** (introductory, intermediate, advanced)
   - Note any **formulas, definitions, or frameworks** worth memorizing

## Step 3: Executive Summary

3. Present a structured summary:
   - **Sujet** : [Domain and topic]
   - **Niveau** : [Introductory/Intermediate/Advanced]
   - **Points cles** (5-8 bullet points covering the essential ideas)
   - **Concepts a memoriser** : [3-5 key definitions or formulas]

4. Ask: "On passe aux flashcards pour memoriser les points cles ?"

## Step 4: Flashcard Series (3-5 cards, one at a time)

5. Generate flashcards for the most important concepts, ONE per message:

```flashcard
{"topic":"[Document Topic]","front":"[Key concept question from the document]","back":"[Precise answer from the document content]","difficulty":"[based on complexity]"}
```

6. After each flashcard, wait for the user to acknowledge before sending the next.

## Step 5: Comprehension Quiz

7. After all flashcards, announce: "Voyons si tu as bien retenu — 3 questions."

8. Generate quiz questions ONE at a time, based on the document content:

**Question 1 — Recall:**
```quiz
{"topic":"[Document Topic]","question":"[Direct question from the document]","options":["A","B","C","D"],"correctAnswer":X,"explanation":"[Reference to specific part of the document]"}
```

**Question 2 — Application:**
```quiz
{"topic":"[Document Topic]","question":"[Apply a concept from the document to a new scenario]","options":["A","B","C","D"],"correctAnswer":X,"explanation":"[How the document's concept applies]"}
```

**Question 3 — Analysis:**
```quiz
{"topic":"[Document Topic]","question":"[Compare, contrast, or evaluate concepts from the document]","options":["A","B","C","D"],"correctAnswer":X,"explanation":"[Deeper insight from the document]"}
```

## Step 6: Results + Skill Inference

9. After all 3 questions, summarize performance.
10. Identify skills demonstrated by the document content:
    - "Ce document couvre [Skill 1], [Skill 2]. Veux-tu les ajouter a tes competences ?"
    - Call `manage_skills` with action "add", origin "extracted", type "HARD_SKILL" (or SOFT_SKILL/KNOWLEDGE based on document subject) after confirmation.

11. Suggest next steps:
    - "Tu peux reviser ces flashcards demain pour consolider."
    - "Veux-tu approfondir un point specifique ?"

## Rules
- **Study mode scope**: `sql_query` has only `my_profile`, `my_skills`, `my_documents`, `my_community_feed`, `my_community_members`. For community content, the user must paste the text or reference a document they own.
- ONE component per message — flashcard OR quiz, never both
- All flashcard and quiz content MUST come from the document — never invented
- If the document is very short (fewer than 3 substantial paragraphs or key sections), adapt: fewer flashcards (2), fewer quiz questions (2)
- If the document is very long, focus on the most important sections (intro + conclusion + key frameworks)
- Always cite specific parts of the document in explanations
- Skills extracted must genuinely be covered in the document — don't over-infer
- Use `extracted` origin when adding skills from document analysis
- For community posts: treat the post author's insights as expert knowledge, credit them in flashcard context
- When studying a post + document combo, prioritize the document content for flashcards and use the post for contextual introduction
- Community content may be informal — maintain rigor in flashcard answers even if the source is conversational
