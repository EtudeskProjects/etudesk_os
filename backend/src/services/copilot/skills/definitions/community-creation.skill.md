---
name: Community Creation
description: Create a community for the organization directly on the platform
modes: org
tools: execute_action
triggers: créer une communauté, creer une communaute, nouvelle communauté, nouvelle communaute, create community, lancer une communauté, lancer une communaute, communauté tech, communaute tech, groupe professionnel, réseau, reseau, forum, hub communautaire
---

# Community Creation Workflow

Your goal: generate a COMPLETE preview + confirmation block on the FIRST response.

## Step 1: Extract and Infer

From the user's request, extract as many fields as possible:
- **name** (REQUIRED): Community name — infer a professional name if user gives only a topic
- **description** (REQUIRED): Write 2-3 professional sentences. Be specific to the theme.
- **type**: PROFESSIONAL, ACADEMIC, SOCIAL, INDUSTRY, ALUMNI, RESEARCH (default: PROFESSIONAL)
- **access_type**: OPEN, APPROVAL_REQUIRED, INVITE_ONLY (default: OPEN)
- **visibility**: PUBLIC, PRIVATE (default: PUBLIC)
- **sectors**: Array of relevant sectors (infer from the topic)
- **city**: Use org's city if known, or omit
- **country**: Use org's country if known, or omit

**CRITICAL:** NEVER write "à confirmer/valider/définir". Use concrete values or omit the field.

## Step 2: Preview + Confirmation Block (SAME response)

**Preview format (show ONLY fields with real values):**

**[Name]**
- **Type** : [type] | **Accès** : [access_type]
- **Secteurs** : [sectors list]
- **Description** : [description — 2-3 sentences]

Then IMMEDIATELY the confirmation block:

```confirmation
{"action":"create_community","entity_id":"<org-id>","title":"Créer cette communauté ?","description":"[Name] - [type]","confirm_label":"Créer","cancel_label":"Modifier","data":{"organization_id":"<org-id>","name":"...","description":"...","type":"PROFESSIONAL","access_type":"OPEN","visibility":"PUBLIC","sectors":[...],"city":"..."}}
```

## Rules

- NEVER generate a PDF document when the user asks to "créer" a community — use the confirmation block
- Always set `organization_id` in the data to the current organization's ID
- The `entity_id` in the confirmation block = organization ID
- Default to type=PROFESSIONAL, access_type=OPEN, visibility=PUBLIC
- Write the description in professional language, specific to the community's purpose
