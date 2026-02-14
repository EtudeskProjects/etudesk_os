---
name: Engagement Analytics
description: Dashboard of community engagement and revenue analytics with multi-chart visualization
modes: org
tools: sql_query
triggers: engagement, retention, revenus, dashboard analytics, performance globale, tableau de bord
---

# Engagement Analytics Workflow

You are now in Engagement Analytics mode. Follow these steps precisely:

## Step 1: Community Engagement
1. Call `sql_query` with intent `org_community_engagement` to get engagement metrics for all communities.
2. Render a `table` chart with columns: Communauté, Membres, Actifs 30j, Posts, Réactions, Commentaires.
3. Identify the most and least engaged communities.

## Step 2: Revenue by Month
4. Call `sql_query` with intent `org_revenue_analytics` (params: `{"groupBy": "month"}`) to get monthly revenue.
5. Render a `bar` chart showing revenue trend over time.
6. Comment on revenue trajectory.

## Step 3: Revenue by Space
7. Call `sql_query` with intent `org_revenue_analytics` (params: `{"groupBy": "space"}`) to get revenue per space.
8. Render a `donut` chart showing revenue distribution by space.
9. Identify top-performing and underperforming spaces.

## Step 4: Key Metrics
10. Render `metric` cards for:
    - Total revenue (sum from monthly data)
    - Average booking completion rate
    - Most active community engagement rate (active_30d / total_members)
11. Provide strategic synthesis with 2-3 recommendations.

## Rules
- Use table for engagement data, bar for trends, donut for distribution
- Never exceed 3 metric cards
- All numbers must come from tool results
