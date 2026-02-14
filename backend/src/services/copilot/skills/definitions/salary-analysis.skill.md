---
name: Salary Analysis
description: Analyze salary benchmarks by comparing internal platform data with external market trends
modes: explore
tools: sql_query, web_search
triggers: salaire, rémunération, combien gagne, salary, benchmark salarial, grille salariale, salaire FCFA, salaire Abidjan, salaire Dakar, grille UEMOA, fourchette salariale, salaire net, salaire brut, cotisations, charges sociales, CNPS, SMIG, coût employeur
---

# Salary Analysis Workflow

You are now in Salary Analysis mode. Follow these steps precisely:

## Step 1: Understand the Request
1. Identify the role/position, seniority level, and location the user is asking about.
2. Use the user's profile skills and current applications for context.

## Step 2: UEMOA Reference Data (FIRST — no tool call needed)
3. Check `<uemoa_knowledge>` in your system prompt for the user's sector and seniority level. This contains salary benchmarks for 20 sectors × 3 countries (CI/SN/BN), SMIG by country, and social contribution rates. Use this data as your PRIMARY reference — it eliminates the need for web_search in most cases.
4. If the user asks about net salary or employer cost, use the social contribution tables (CNPS for CI, CSS/IPRES for SN, INPS for ML) to calculate:
   - **Net salary** ≈ Gross − employee contributions (retraite + CMU/maladie)
   - **Coût employeur** ≈ Gross + employer contributions (retraite + PF + maternité + AT)

## Step 3: Internal Data
5. Call `sql_query` with intent `search_opportunities` filtered by the relevant role type. If results include compensation_min/max, compare against UEMOA benchmarks.
6. If the user has applications, check their opportunity details for salary info.

## Step 4: External Benchmarks (only if needed)
7. Call `web_search` ONLY if UEMOA reference data doesn't cover the specific role or if the user explicitly asks for external data. Query: "salaire [role] [user's country or 'Afrique francophone'] 2026".
   **CRITICAL:** ALWAYS include the user's country in the web query. Generic queries return US/EU data which is irrelevant.

## Step 5: Present Analysis
8. Create a comparison using a chart block:
   - UEMOA benchmark range for the sector/level
   - Internal platform data (if available)
   - External data (if fetched)
   - SMIG comparison (flag if offer is below SMIG)
9. Provide 2-3 sentences of context:
   - Position vs market (below/within/above range)
   - Negotiation advice referencing the specific sector benchmark
   - If relevant: mention contract type implications (CDD vs CDI), notice periods, or social protection coverage

## Rules
- UEMOA knowledge block is your first source — use it before web_search
- Always cite sources for external data
- Be transparent when data is limited — say "données limitées" rather than guessing
- For net/gross calculations, always state the applicable country and contribution rates used
- Reference SMIG as the legal floor — any offer below SMIG is non-compliant
