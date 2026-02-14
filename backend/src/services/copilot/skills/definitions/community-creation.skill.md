---
name: Community Creation
description: Create a community for the organization directly on the platform
modes: org
tools: execute_action
triggers: creer une communaute, nouvelle communaute, create community, lancer une communaute, communaute tech, groupe professionnel, reseau, forum, hub communautaire
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
- **country**: CI (default)

**CRITICAL:** NEVER write "a confirmer/valider/definir". Use concrete values or omit the field.

## Step 2: Preview + Confirmation Block (SAME response)

**Preview format (show ONLY fields with real values):**

**[Name]**
- **Type** : [type] | **Acces** : [access_type]
- **Secteurs** : [sectors list]
- **Description** : [description — 2-3 sentences]

Then IMMEDIATELY the confirmation block:

```confirmation
{"action":"create_community","entity_id":"<org-id>","title":"Creer cette communaute ?","description":"[Name] - [type]","confirm_label":"Creer","cancel_label":"Modifier","data":{"organization_id":"<org-id>","name":"...","description":"...","type":"PROFESSIONAL","access_type":"OPEN","visibility":"PUBLIC","sectors":[...],"city":"...","country":"CI"}}
```

## Rules

- NEVER generate a PDF document when the user asks to "creer" a community — use the confirmation block
- Always set `organization_id` in the data to the current organization's ID
- The `entity_id` in the confirmation block = organization ID
- Default to type=PROFESSIONAL, access_type=OPEN, visibility=PUBLIC
- Write the description in professional language, specific to the community's purpose
