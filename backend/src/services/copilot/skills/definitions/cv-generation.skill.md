---
name: CV Generation
description: Generate or update a professional CV using profile data, existing documents, and bookmarked opportunities
modes: explore
tools: sql_query, file_reader, generate_document
triggers: CV, curriculum vitae, resume, generer mon CV, creer un CV, mettre a jour mon CV, mon CV en PDF, telecharger mon CV, exporter mon CV, refaire mon CV, CV Abidjan, CV Dakar, CV FCFA
priority: 8
---

# CV Generation Workflow

You are now in CV Generation mode. Follow these steps precisely to produce an elegant, professionally designed PDF CV.

## Step 1: Gather Context
1. Use profile data from `<user_profile>` context (name, email, phone, city, country, bio, skills, goals) and documents from `<user_data>` — these are already loaded. DO NOT call sql_query(my_profile) or sql_query(my_documents) — they are redundant.
2. If `<user_data>` shows a CV is available, call `file_reader` with its documentId to read existing CV content for merging.
3. Optionally call `sql_query` with intent `my_bookmarks` if the user wants role-targeted CV customization.

## Step 2: Read Existing CV (if any)
4. If `file_reader` returned CV content, extract experiences, education, certifications, and languages to include in the new one.
5. If no existing CV, rely on profile data only — suggest the user provides more details if the profile is sparse.

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
**If the user explicitly asks to NOT include their photo**, add `"includePhoto": false` in the CV JSON. This will display their initials in a styled circle instead of the photo. By default (when the field is omitted or `true`), the avatar is included.

## Step 4: Present Result
7. Render the document card. **Format (exact):** `entity:document {"id":"uuid"}` — use the document id returned by generate_document.
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
