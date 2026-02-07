---
name: Space Creation
description: Create a workspace or venue for the organization directly on the platform
modes: org
tools: sql_query
triggers: creer un espace, nouvel espace, create space, ajouter un espace, enregistrer un espace
---

# Space Creation Workflow

Your goal: generate a COMPLETE preview + confirmation block on the FIRST response.

## Step 1: Extract and Infer

From the user's request, extract as many fields as possible:
- **name** (REQUIRED): Space name — infer a professional name if user gives only a type
- **type** (REQUIRED): COWORKING, MEETING_ROOM, CONFERENCE, OFFICE, EVENT_SPACE, WORKSHOP, STUDIO, CLASSROOM, LAB, LIBRARY, OTHER
- **surface_m2** (REQUIRED): Surface area in square meters (number)
- **description**: Write 1-2 professional sentences
- **capacity**: Maximum number of people (infer from surface if not given: ~1 person per 3-4m2)
- **city**: Use org's city if known, or omit
- **country**: CI (default)
- **equipment**: Array of equipment — infer basics from type (e.g., MEETING_ROOM → ["Wifi", "Ecran", "Tableau blanc"])
- **amenities**: Array of amenities — infer basics (e.g., ["Climatisation"])
- **hourly_rate**: Only include if user mentioned it
- **daily_rate**: Only include if user mentioned it
- **is_bookable**: true (default)
- **visibility**: PUBLIC (default)

**CRITICAL:** NEVER write "a confirmer/valider/definir". Use concrete values or omit the field. If name, type, or surface_m2 is missing, ask ONE question to get them.

## Step 2: Preview + Confirmation Block (SAME response)

**Preview format (show ONLY fields with real values):**

**[Name]**
- **Type** : [type] | **Surface** : [surface_m2] m2
- **Capacite** : [capacity] personnes
- **Equipement** : [equipment list]
- **Tarifs** : [hourly_rate] XOF/h | [daily_rate] XOF/jour
- **Description** : [description — 1-2 sentences]

Omit any line where the value is unknown. No placeholders.

Then IMMEDIATELY the confirmation block:

```confirmation
{"action":"create_space","entity_id":"<org-id>","title":"Creer cet espace ?","description":"[Name] - [type] - [surface]m2","confirm_label":"Creer","cancel_label":"Modifier","data":{"organization_id":"<org-id>","name":"...","type":"...","surface_m2":...,"capacity":...,"description":"...","city":"...","country":"CI","equipment":[...],"amenities":[...],"is_bookable":true,"visibility":"PUBLIC"}}
```

## Rules

- NEVER generate a PDF document when the user asks to "creer" a space — use the confirmation block
- Always set `organization_id` in the data to the current organization's ID
- The `entity_id` in the confirmation block = organization ID
- Default to country=CI, is_bookable=true, visibility=PUBLIC
