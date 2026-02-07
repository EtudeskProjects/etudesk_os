---
name: Salary Analysis
description: Analyze salary benchmarks by comparing internal platform data with external market trends
modes: explore
tools: sql_query, web_search
triggers: salaire, rémunération, combien, salary, benchmark salarial, grille salariale
---

# Salary Analysis Workflow

You are now in Salary Analysis mode. Follow these steps precisely:

## Step 1: Understand the Request
1. Identify the role/position, seniority level, and location the user is asking about.
2. Use the user's profile skills and current applications for context.

## Step 2: Internal Data
3. Call `sql_query` with intent `search_opportunities` filtered by the relevant role type to find salary ranges posted on the platform.
4. If the user has applications, check their opportunity details for salary info.

## Step 3: External Benchmarks
5. Call `web_search` with a query like: "salaire [role] [location] 2026" targeting:
   - French-speaking Africa salary data (Côte d'Ivoire, Senegal, Cameroon)
   - International remote work salary benchmarks
   - Industry reports (Glassdoor, LinkedIn Salary Insights, local surveys)

## Step 4: Present Analysis
6. Create a comparison using a chart block:
   - Internal platform ranges vs external benchmarks
   - By seniority level if data available
   - By location/market
7. Provide 2-3 sentences of context and negotiation advice.

## Rules
- Always cite sources for external data
- Be transparent when data is limited — say "données limitées" rather than guessing
- Consider cost of living differences between markets
- Prefer data from the last 12 months
