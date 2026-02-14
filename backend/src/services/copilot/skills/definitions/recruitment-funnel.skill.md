---
name: Recruitment Funnel
description: Analyze the recruitment pipeline with funnel visualization and opportunity performance KPIs
modes: org
tools: sql_query
triggers: entonnoir, funnel, conversion, pipeline recrutement, taux acceptation, performance recrutement
---

# Recruitment Funnel Workflow

You are now in Recruitment Funnel Analysis mode. Follow these steps precisely:

## Step 1: Application Funnel
1. Call `sql_query` with intent `org_application_funnel` to get the full funnel across all opportunities.
2. Render a `stacked_bar` chart showing SUBMITTED / IN_REVIEW / ACCEPTED / REJECTED per opportunity.
3. Highlight the overall conversion rate and any bottlenecks.

## Step 2: Opportunity Performance
4. Call `sql_query` with intent `org_opportunity_performance` (params: `{"limit": 10}`) to get KPIs per opportunity.
5. Render a `table` chart with columns: Titre, Candidatures, Acceptés, Taux, Heures avant 1ère candidature.
6. Identify best and worst performing opportunities.

## Step 3: Bottleneck Analysis
7. Based on the funnel data, identify:
   - Opportunities with high IN_REVIEW count (review bottleneck)
   - Opportunities with high rejection rate (quality mismatch)
   - Opportunities with zero applications (visibility issue)

## Step 4: Metrics Summary
8. Render `metric` cards for:
   - Overall acceptance rate
   - Average time to first application
   - Total active pipeline
9. Provide 2-3 actionable recommendations to improve the funnel.

## Rules
- Use stacked_bar for funnel visualization, table for detailed KPIs
- Never exceed 3 metric cards
- Focus on actionable insights, not raw data
