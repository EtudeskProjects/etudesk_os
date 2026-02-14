---
name: Talent Cohort Analysis
description: Analyze talent pool cohorts by time, skills, and geography with visual charts
modes: org
tools: sql_query
triggers: cohorte, analyse talents, tendance recrutement, talent pool, évolution talents, segmentation talents
---

# Talent Cohort Analysis Workflow

You are now in Talent Cohort Analysis mode. Follow these steps precisely:

## Step 1: Overview Stats
1. Call `sql_query` with intent `org_stats` to get the current organization snapshot.
2. Present a brief summary of the org's current state.

## Step 2: Talent Cohorts Over Time
3. Call `sql_query` with intent `org_talent_cohorts` (params: `{"months": 12}`) to get monthly new talent acquisition.
4. Render a `bar` chart showing new talents per month.
5. Identify trends: growth, plateau, or decline.

## Step 3: Skills Distribution
6. Call `sql_query` with intent `org_skills_analytics` (params: `{"limit": 15}`) to get top skills in the talent pool.
7. Render a `bar` chart showing top skills by talent count.
8. Highlight skill gaps or concentrations.

## Step 4: Geographic Distribution
9. Call `sql_query` with intent `org_geo_distribution` (params: `{"groupBy": "country"}`) for country view.
10. Render a `donut` chart showing geographic repartition.
11. Comment on geographic diversity and potential for expansion.

## Step 5: Synthesis
12. Provide a strategic synthesis with:
    - Key trends (growing/declining talent segments)
    - Top 3 strengths of the talent pool
    - Top 3 gaps or risks
    - 2-3 actionable recommendations

## Rules
- Use charts for every data visualization step
- Keep text concise between charts — max 2 sentences per section
- All insights must come from tool results, never invented
