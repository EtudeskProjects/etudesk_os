---
name: Candidate Ranking
description: Score and rank candidates for an opportunity based on requirements and CV analysis
modes: org
tools: sql_query, file_reader
triggers: classement, ranking, candidats, meilleurs profils, trier les candidatures, évaluer les candidats
---

# Candidate Ranking Workflow

You are now in Candidate Ranking mode. Follow these steps precisely:

## Step 1: Get Requirements
1. Ask the user which opportunity to rank candidates for (if not specified).
2. Call `sql_query` with intent `org_opportunities` to get the opportunity details and requirements.

## Step 2: List Candidates
3. Call `sql_query` with intent `org_applications` filtered by the opportunity to get all applicants.

## Step 3: Analyze CVs (Top Candidates)
4. For the top 5-10 candidates (by application date or initial screening):
   - Call `file_reader` for each candidate's CV document (if available)
   - Extract: skills match, experience relevance, education alignment

## Step 4: Score & Rank
5. Score each candidate on a scale of 1-10 based on:
   - Skills match (40%): How well their skills align with requirements
   - Experience relevance (30%): Years and type of relevant experience
   - Education fit (15%): Degree and specialization alignment
   - Cultural indicators (15%): Location, language, community involvement

## Step 5: Present Results
6. Render entity cards for the top 5 candidates with brief justification.
7. Offer to generate a detailed comparison report via `generate_document`.

## Rules
- Be objective — rank on qualifications, not demographics
- Clearly state when data is incomplete (e.g., no CV available)
- Max 5 entity:talent cards in the response
