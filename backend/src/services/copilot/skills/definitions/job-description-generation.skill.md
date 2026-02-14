---
name: Job Description Generation
description: Generate a professional PDF job description (fiche de poste) branded with the organization's logo
modes: org
tools: sql_query, generate_document, web_search
triggers: fiche de poste, générer une fiche de poste, job description, description de poste, fiche métier, profil de poste, fiche de poste PDF, rediger une offre, descriptif du poste
priority: 7
---

# Job Description Generation Workflow

You are now in Job Description PDF Generation mode. Your goal: produce a branded, professional PDF fiche de poste with the organization's logo.

**CRITICAL: This skill generates a PDF document. If the user wants to PUBLISH an opportunity on the platform, use the opportunity-publishing skill instead.**

## Step 1: Gather Organization Context
1. Call `sql_query` with intent `org_stats` to retrieve the organization's `logo_url`, `city`, and `country`.
2. Store `logo_url`, `city`, `country` for the PDF header.

## Step 2: Gather Role Details
3. From the user's message, extract:
   - **Job title** (required)
   - **Contract type** (CDI, CDD, Stage, Freelance, etc.)
   - **Location / remote policy**
   - **Department / team**
   - **Key responsibilities**
   - **Required qualifications**
   - **Nice-to-have skills**
   - **Compensation range** (only if mentioned)
4. If the user referenced an existing opportunity, call `sql_query` with `org_opportunities` to get its details.
5. Optionally call `web_search` for market benchmarks on the role (salary ranges, typical requirements in UEMOA region).

## Step 3: Draft & Confirm
6. Present a structured preview of the fiche de poste content:
   - Titre du Poste
   - Type de Contrat / Rythme
   - Lieu de Travail
   - Missions principales (5-8 bullet points)
   - Profil recherché (4-6 bullet points)
   - Atouts appréciés (2-3 bullet points)
   - Conditions (rémunération, avantages — only if provided)
   - Comment postuler
7. Ask for confirmation: "Voulez-vous que je génère le PDF ?"

## Step 4: Generate Branded PDF
8. After confirmation, call `generate_document` with format "PDF" and the **Org Document JSON format**:

```
{
  "organizationName": "<org name from context>",
  "organizationCity": "<city from org_stats>",
  "organizationCountry": "<country from org_stats>",
  "logoUrl": "<logo_url from org_stats>",
  "documentDate": "<today's date YYYY-MM-DD>",
  "sections": [
    {"heading": "Titre du Poste", "body": "<job title>\n<contract type> | <location>"},
    {"heading": "Présentation de l'Organisation", "body": "<1-2 sentences about the org>"},
    {"heading": "Missions Principales", "body": "- Mission 1\n- Mission 2\n- Mission 3\n- Mission 4\n- Mission 5"},
    {"heading": "Profil Recherché", "body": "- Qualification 1\n- Qualification 2\n- Qualification 3\n- Qualification 4"},
    {"heading": "Atouts Appréciés", "body": "- Atout 1\n- Atout 2"},
    {"heading": "Conditions", "body": "- Type de contrat : CDI\n- Lieu : Abidjan\n- Rémunération : selon profil"},
    {"heading": "Comment Postuler", "body": "Envoyez votre candidature via la plateforme Etudesk."}
  ]
}
```

**CRITICAL: Use the Org Document format (with organizationName + sections), NOT the sections-only format. The Org Document format includes the logo in the PDF header.**

## Step 5: Present Result
9. Render the document card. **Format (exact):** `entity:document {"id":"uuid"}` — use the document id returned by generate_document.
10. Offer to also publish this as an opportunity on the platform.

## Rules
- **Separation from opportunity-publishing**: "generer une fiche de poste" / "fiche PDF" = this skill (PDF output). "publier une offre" / "creer une offre" = opportunity-publishing (platform publish). Never confuse the two.
- ALWAYS use the Org Document JSON format for PDF generation — never the plain sections format
- ALWAYS fetch org_stats FIRST to get logo_url, city, country
- Write content in professional French appropriate for the UEMOA job market
- Use bullet points for responsibilities and qualifications
- Never invent salary data — only include if the user mentioned it
- Default currency: XOF, default compensation_frequency: mensuel
- If logo_url is null, still use the Org Document format (the generator handles missing logos gracefully)
