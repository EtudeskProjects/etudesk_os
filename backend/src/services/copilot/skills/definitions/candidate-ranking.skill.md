---
name: Candidate Ranking
description: Score and rank candidates for an opportunity based on requirements and CV analysis
modes: org
tools: sql_query, file_reader, generate_document
triggers: classement, ranking, candidats, meilleurs profils, trier les candidatures, évaluer les candidats, top candidats, shortlist, preselectionnner, comparer les candidats, qui est le meilleur, shortlister, preselection
---

# Candidate Ranking Workflow

You are now in Candidate Ranking mode. Follow these steps precisely:

## Step 1: Get Requirements
1. Ask the user which opportunity to rank candidates for (if not specified).
2. Call `sql_query` with intent `org_opportunities` to get the opportunity details and requirements.

## Step 2: List Candidates
3. Call `sql_query` with intent `org_applications` filtered by the opportunity to get all applicants.

## Step 3: Analyze CVs (Top Candidates)
4. Use the `top_skills` returned by `org_applications` for initial screening — no extra tool call needed. Then for the **top 3 candidates** only, call `org_talent_profile(talentId)` to get their document IDs, then `file_reader` on their CV for deeper analysis.
   - Extract: skills match, experience relevance, education alignment

## Step 4: Score & Rank
5. Score each candidate on a scale of 1-10 based on:
   - **Skills match (40%)**: Count exact matches between candidate skills and requirements (1pt per exact match, 0.5pt per adjacent skill). Normalize to 0-10.
   - **Experience relevance (30%)**: Ratio of relevant years to required years. 100%+ = 10, 50% = 5, 0% = 0. Weight sector match: same sector = full score, adjacent = 70%.
   - **Education fit (15%)**: Exact degree match = 10, same domain = 7, related field = 4, unrelated = 1.
   - **Cultural indicators (15%)**: Same country as opportunity = +3, same city = +2, remote-ready if remote position = +3, language match = +2. Normalize to 0-10.

## Step 5: Present Results (Chart #19 — Classement scoring)

6. Render un **table** chart avec le classement detaille AVANT les entity cards :

```chart
{"type":"table","title":"Classement — [Titre opportunite]","columns":["Rang","Candidat","Score","Skills matchees","Experience","Localisation"],"rows":[{"Rang":1,"Candidat":"Kone A.","Score":"92%","Skills matchees":"5/6","Experience":"6 ans","Localisation":"Remote"},{"Rang":2,"Candidat":"Diallo M.","Score":"85%","Skills matchees":"4/6","Experience":"4 ans","Localisation":"Hybrid"},{"Rang":3,"Candidat":"Traore S.","Score":"72%","Skills matchees":"3/6","Experience":"3 ans","Localisation":"Remote"}]}
```

**Thinking flow** :
- Score global = skills matchees (40%) + experience relevance (30%) + education fit (15%) + cultural indicators (15%)
- Skills matchees = "[exact matches]/[total required]"
- Experience = annees pertinentes extraites du CV via file_reader
- Localisation = ville du candidat (avantage si meme ville que l'opportunite)
- Trier par score decroissant. Top 5 max.
- Ne PAS afficher de candidats avec score < 30% (pas de valeur ajoutee)

7. Render entity cards for the top 5 candidates with brief justification.
8. Offer to generate a detailed comparison report via `generate_document`. If the user accepts, call `generate_document` then render the document card as a **fenced code block**:

````
```entity:document
{"id":"THE_DOCUMENT_UUID_FROM_GENERATE_DOCUMENT"}
```
````

## Rules
- Be objective — rank on qualifications, not demographics
- Clearly state when data is incomplete (e.g., no CV available)
- Max 5 entity:talent cards in the response
