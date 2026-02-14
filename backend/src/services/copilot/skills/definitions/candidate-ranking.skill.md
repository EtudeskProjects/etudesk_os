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
4. Limit `file_reader` to the **top 3 candidates** only (by initial screening based on `org_talent_profile` data). For candidates #4-5, use profile data from `org_talent_profile` (skills, bio, location) without reading full CVs — this reduces tool calls and latency.
   - Call `file_reader` for each top 3 candidate's CV document (if available)
   - Extract: skills match, experience relevance, education alignment

## Step 4: Score & Rank
5. Score each candidate on a scale of 1-10 based on:
   - **Skills match (40%)**: Count exact matches between candidate skills and requirements (1pt per exact match, 0.5pt per adjacent skill). Normalize to 0-10.
   - **Experience relevance (30%)**: Ratio of relevant years to required years. 100%+ = 10, 50% = 5, 0% = 0. Weight sector match: same sector = full score, adjacent = 70%.
   - **Education fit (15%)**: Exact degree match = 10, same domain = 7, related field = 4, unrelated = 1.
   - **Cultural indicators (15%)**: Same country as opportunity = +3, same city = +2, remote-ready if remote position = +3, language match = +2. Normalize to 0-10.

## Step 5: Present Results
6. Render entity cards for the top 5 candidates with brief justification.
7. Offer to generate a detailed comparison report via `generate_document`. If the user accepts, call `generate_document` then render: `entity:document {"id":"uuid"}` with the returned document id.

## Rules
- Be objective — rank on qualifications, not demographics
- Clearly state when data is incomplete (e.g., no CV available)
- Max 5 entity:talent cards in the response
