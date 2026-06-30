---
name: Opportunity Publishing
description: Create and publish a job opportunity directly on the platform from a conversation
modes: org
tools: sql_query
triggers: publier une offre, créer une offre, creer une offre, poster un emploi, publish opportunity, créer un poste, creer un poste, publier un poste, recruter, CDI, CDD, stage, alternance, offre emploi, recruter un dev, recruter un stagiaire
priority: 8
---

# Opportunity Publishing Workflow

You are now in Opportunity Publishing mode. Your goal: generate a COMPLETE preview + confirmation block on the FIRST response.

**Skill separation (CRITICAL):** This skill PUBLISHES opportunities on the platform (confirmation block). If the user wants only a PDF document ("générer une fiche de poste", "rédiger une offre PDF"), use the job-description-generation skill instead. Triggers: "publier", "créer une offre", "poster" = this skill. Triggers: "fiche de poste PDF", "générer une fiche" = job-description-generation.

## Step 1: Extract and Infer

From the user's message, extract everything you can:
- **title** (REQUIRED): Infer a professional job title from context (e.g., "commercial" → "Commercial·e B2B")
- **summary** (REQUIRED): Write a 3-4 sentence professional description based on what the user described. Be specific and relevant to the role.
- **contract_type** (REQUIRED): CDI, CDD, STAGE, FREELANCE, ALTERNANCE, INTERIM, BENEVOLAT
- **type**: JOB, INTERNSHIP, FREELANCE, VOLUNTEER, APPRENTICESHIP (infer from contract_type)
- **work_rhythm**: FULL_TIME, PART_TIME, FLEXIBLE (default: FULL_TIME)
- **location_type**: ON_SITE, REMOTE, HYBRID (default: ON_SITE)
- **locations**: Array of {city, country} — use org's known city, or omit
- **requirements**: Write 3-5 bullet points of realistic qualifications based on the role
- **nice_to_have**: Write 2-3 bonus qualifications if relevant
- **compensation_min/max**: ONLY include if the user mentioned it. Do NOT invent or guess.
- **currency**: devise explicite de l'offre ou de l'organisation (sinon omit)
- **compensation_frequency**: MONTHLY (default)
- **deadline**: ONLY include if the user mentioned it

**RULES:**
- The organization is ALWAYS known from context — never question it.
- If the user gives minimal info ("crée une offre commercial CDD"), you MUST still generate a complete, professional summary and requirements. You are the expert — draft it.
- Optionally call `sql_query` (org_opportunities) to check similar existing opportunities for tone and style reference.

## Step 2: Preview + Confirmation Block (SAME response)

Show the structured preview, then IMMEDIATELY the confirmation block. Do NOT ask questions first.

**Preview format (show ONLY fields with real values):**

**[Title]**
- **Contrat** : [contract_type] | **Rythme** : Temps plein
- **Lieu** : [city], [country] ([location_type])
- **Rémunération** : [min] - [max] [currency]/mois
- **Description** : [summary — 2-3 sentences]
- **Profil recherché** : [requirements — 3-5 points]
- **Atouts** : [nice_to_have — if any]

Omit any line where the value is unknown. No placeholders.

Then:

```confirmation
{"action":"publish_opportunity","entity_id":"<org-id>","title":"Publier cette offre ?","description":"[Title] - [contract_type]","confirm_label":"Publier","cancel_label":"Modifier","data":{"organization_id":"<org-id>","title":"...","summary":"...","contract_type":"...","type":"...","work_rhythm":"FULL_TIME","location_type":"ON_SITE","locations":[...],"requirements":"...","nice_to_have":"..."}}
```

## Rules

- NEVER generate a PDF document when the user asks to "publier", "créer", or "poster" an opportunity — use the confirmation block
- "générer une fiche de poste" = PDF, "créer/publier une offre" = confirmation block
- Always set `organization_id` in the data to the current organization's ID
- The `entity_id` in the confirmation block = organization ID
- Default values: location_type=ON_SITE, work_rhythm=FULL_TIME, type=JOB
- Write the summary and requirements in professional language. Be specific to the role, not generic.
- The cancel_label should be "Modifier" (not "Annuler") — the user can request changes before confirming
