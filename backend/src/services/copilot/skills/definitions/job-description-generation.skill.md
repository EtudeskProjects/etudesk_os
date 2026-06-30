---
name: Job Description Generation
description: Generate a professional PDF job description (fiche de poste) branded with the organization's logo
modes: org
tools: sql_query, generate_document, web_search
triggers: fiche de poste, générer une fiche de poste, generer une fiche de poste, job description, description de poste, fiche métier, profil de poste, fiche de poste PDF, rédiger une offre, rediger une offre, descriptif du poste
priority: 7
---

# Job Description Generation Workflow

You are now in Job Description PDF Generation mode. Your goal: produce a branded, professional PDF fiche de poste with the organization's logo.

**CRITICAL: This skill generates a PDF document. If the user wants to PUBLISH an opportunity on the platform, use the opportunity-publishing skill instead.**

## Step 1: Gather Role Details
1. Use `logo_url`, `city`, `country` from the `<organization>` context block (pre-loaded, no tool call needed).
2. From the user's message, extract:
   - **Job title** (required)
   - **Contract type** (CDI, CDD, Stage, Freelance, etc.)
   - **Location / remote policy**
   - **Department / team**
   - **Key responsibilities**
   - **Required qualifications**
   - **Nice-to-have skills**
   - **Compensation range** (only if mentioned)
3. If the user referenced an existing opportunity, call `sql_query` with `org_opportunities` to get its details.
4. Optionally call `web_search` for market benchmarks on the role when a market is specified (salary ranges, typical requirements).

## Step 2: Draft & Confirm
5. Present a structured preview of the fiche de poste content:
   - Titre du Poste
   - Type de Contrat / Rythme
   - Lieu de Travail
   - Missions principales (5-8 bullet points)
   - Profil recherché (4-6 bullet points)
   - Atouts appréciés (2-3 bullet points)
   - Conditions (rémunération, avantages — only if provided)
   - Comment postuler
6. Ask for confirmation: "Voulez-vous que je génère le PDF ?"

## Step 3: Generate Branded PDF
7. After confirmation, call `generate_document` with format "PDF" and the **Org Document JSON format**:

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
    {"heading": "Conditions", "body": "- Type de contrat : CDI\n- Lieu : selon contexte\n- Rémunération : selon profil"},
    {"heading": "Comment Postuler", "body": "Envoyez votre candidature via la plateforme Etudesk."}
  ]
}
```

**CRITICAL: Use the Org Document format (with organizationName + sections), NOT the sections-only format. The Org Document format includes the logo in the PDF header.**

## Step 4: Present Result
8. Render the document card as a **fenced code block**:

````
```entity:document
{"id":"THE_DOCUMENT_UUID_FROM_GENERATE_DOCUMENT"}
```
````
9. Offer to also publish this as an opportunity on the platform.

## Rules
- **Separation from opportunity-publishing**: "générer une fiche de poste" / "fiche PDF" = this skill (PDF output). "publier une offre" / "créer une offre" = opportunity-publishing (platform publish). Never confuse the two.
- ALWAYS use the Org Document JSON format for PDF generation — never the plain sections format
- Use logo_url, city, country from `<organization>` context (pre-loaded, no org_stats call needed)
- Write content in professional language appropriate for the requested market
- Use bullet points for responsibilities and qualifications
- Never invent salary data — only include if the user mentioned it
- Default currency: explicit offer or organization currency, default compensation_frequency: mensuel
- If logo_url is null, still use the Org Document format (the generator handles missing logos gracefully)
