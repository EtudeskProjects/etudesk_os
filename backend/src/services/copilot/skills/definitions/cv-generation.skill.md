---
name: CV Generation
description: Generate or update a professional CV using profile data, existing documents, and bookmarked opportunities
modes: explore
tools: sql_query, file_reader, generate_document
triggers: CV, curriculum vitae, resume, generer mon CV, creer un CV, mettre a jour mon CV
---

# CV Generation Workflow

You are now in CV Generation mode. Follow these steps precisely to produce an elegant, professionally designed PDF CV.

## Step 1: Gather Context
1. The user's profile data is already in context (name, email, phone, city, country, bio, skills, goals). Use it directly.
2. Call `sql_query` with intent `my_bookmarks` to understand the user's target market and preferred roles.
3. Call `sql_query` with intent `my_documents` to find any existing CV documents.

## Step 2: Read Existing CV (if any)
4. If an existing CV was found, call `file_reader` with its documentId to read the content.
5. Extract experiences, education, certifications, and languages from the existing CV to include in the new one.

## Step 3: Generate the CV (PDF by default)

6. Call `generate_document` with format "PDF" and the **CV JSON format** for contentJson. The CV JSON format produces an elegant two-column PDF with the user's photo, sidebar with skills/languages/interests, and main content with timeline.

**CRITICAL: Use the CV JSON format (NOT the sections format) for CV generation.**

The contentJson MUST be a JSON string with this exact structure:

```
{
  "firstName": "Prenom du profil",
  "lastName": "Nom du profil",
  "email": "email@example.com",
  "phone": "+221 77 000 0000",
  "city": "Dakar",
  "country": "Senegal",
  "bio": "Resume professionnel concis (3-4 phrases) mettant en valeur le parcours, les competences cles et les ambitions.",
  "skills": [
    {"name": "Nom de la competence", "type": "hard", "level": "expert"},
    {"name": "Autre competence", "type": "soft", "level": "advanced"}
  ],
  "languages": [
    {"language": "Francais", "level": "native"},
    {"language": "Anglais", "level": "fluent"}
  ],
  "interests": ["Interet 1", "Interet 2"],
  "goals": ["Objectif professionnel 1", "Objectif 2"],
  "experiences": [
    {
      "title": "Titre du poste",
      "company": "Nom de l'entreprise",
      "location": "Ville, Pays",
      "period": "Jan 2022 - Present",
      "description": "Description des responsabilites et realisations. Utiliser des verbes d'action."
    }
  ],
  "education": [
    {
      "degree": "Diplome obtenu",
      "institution": "Nom de l'etablissement",
      "location": "Ville, Pays",
      "period": "2018 - 2020",
      "description": "Specialisation ou mention notable"
    }
  ],
  "certifications": [
    {"name": "Nom de la certification", "issuer": "Organisme", "date": "2023"}
  ]
}
```

**Field rules:**
- `firstName`, `lastName`, `email` — from user profile (REQUIRED)
- `phone`, `city`, `country`, `bio` — from user profile (include if available)
- `skills` — from user profile skills, TOP 10 most relevant. Valid levels: "expert", "advanced", "intermediate", "beginner"
- `languages` — extract from existing CV or profile. Valid levels: "native", "fluent", "conversational", "basic"
- `interests` — from profile tags or extract from existing CV
- `goals` — from profile goals
- `experiences` — from existing CV content (file_reader). List in reverse chronological order. Include ALL available experiences.
- `education` — from existing CV content (file_reader). List in reverse chronological order.
- `certifications` — from existing CV content or user documents

**The user's avatar photo is automatically included — you do not need to add avatarUrl.**

## Step 4: Present Result
7. Render the document card: ```entity:document {"id":"uuid"}```
8. Provide a brief summary of what was included and any suggestions for improvement.

## Rules
- ALWAYS use the CV JSON format (with firstName, lastName, skills) for CV generation — NEVER the sections format
- NEVER generate a CV without first checking for existing CV data
- Always maintain accuracy — only use data from tools, never invent experience
- If the user has no skills or bio, suggest completing their profile first
- Default format is PDF — only use DOCX if user explicitly requests it
- Order experiences and education in reverse chronological order (most recent first)
- Write the bio as a professional summary, not just a copy of profile data
- Include ALL experiences and education found — do not truncate
