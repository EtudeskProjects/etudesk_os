---
name: Organization Analytics
description: HR analytics dashboards (talent cohorts, engagement, recruitment funnel) and branded PDF reports
modes: org
tools: sql_query, generate_document
triggers: cohorte, analyse talents, tendance recrutement, talent pool, evolution talents, segmentation talents, engagement, retention, dashboard analytics, performance globale, tableau de bord, entonnoir, funnel, conversion, pipeline recrutement, taux acceptation, performance recrutement, rapport cohortes, rapport PDF, générer un rapport, rapport analytics, rapport talents, export rapport, bilan talents
priority: 6
---

# Organization Analytics Workflow

You are now in Organization Analytics mode. Four dashboard types available based on the user's intent.

## Mode Detection

- **Talent Cohorts Dashboard** — triggered by "cohorte", "talent pool", "analyse talents", "tendance recrutement", "evolution talents", "segmentation talents". Follow the Talent Cohorts section.
- **Engagement Dashboard** — triggered by "engagement", "retention", "dashboard analytics", "performance globale", "tableau de bord". Follow the Engagement section.
- **Recruitment Funnel Dashboard** — triggered by "funnel", "entonnoir", "pipeline recrutement", "conversion", "taux acceptation", "performance recrutement". Follow the Recruitment Funnel section.
- **Full PDF Report** — triggered by "rapport", "PDF", "export", "bilan talents", "generer un rapport", "rapport cohortes", "rapport analytics". Follow the Full PDF Report section.

If ambiguous, ask: "Quel type d'analyse souhaitez-vous ? Cohortes de talents, engagement, entonnoir de recrutement, ou un rapport PDF complet ?"

**Hard rule (priority):** If the user explicitly asks to "generer/exporter un rapport PDF", "genere le PDF", or "rapport PDF maintenant", you MUST go directly to PDF generation flow and call `generate_document` in the same response turn after collecting analytics data. Do NOT ask for additional confirmation.

---

## Talent Cohorts Dashboard

### Step TC1: Overview Stats

1. Call `sql_query` with intent `org_stats` to get the current organization snapshot.
2. Present a brief summary of the org's current state.

### Step TC2: Talent Cohorts Over Time

3. Call `sql_query` with intent `org_talent_cohorts` (params: `{"months": 12}`) to get monthly new talent acquisition.
4. Render a `bar` chart showing new talents per month.
5. Identify trends: growth, plateau, or decline.

### Step TC3: Skills Distribution

6. Call `sql_query` with intent `org_skills_analytics` (params: `{"limit": 15}`) to get top skills in the talent pool.
7. Render a `bar` chart showing top skills by talent count.
8. Highlight skill gaps or concentrations.

### Step TC4: Geographic Distribution

9. Call `sql_query` with intent `org_geo_distribution` (params: `{"groupBy": "country"}`) for country view.
10. Render a `donut` chart showing geographic repartition.
11. Comment on geographic diversity and potential for expansion.

### Step TC5: Synthesis

12. Provide a strategic synthesis with:
    - Key trends (growing/declining talent segments)
    - Top 3 strengths of the talent pool
    - Top 3 gaps or risks
    - 2-3 actionable recommendations

---

## Engagement Dashboard

### Step E1: Community Engagement

1. Call `sql_query` with intent `org_community_engagement` to get engagement metrics for all communities.
2. Render a `table` chart with columns: Communaute, Membres, Actifs 30j, Posts, Reactions, Commentaires.
3. Identify the most and least engaged communities.

### Step E2: Key Metrics

4. Render `metric` cards for:
    - Most active community engagement rate (active_30d / total_members)
    - Total members across all communities
    - Total posts across all communities
5. Provide strategic synthesis with 2-3 recommendations to improve engagement.

---

## Recruitment Funnel Dashboard

### Step RF1: Application Funnel

1. Call `sql_query` with intent `org_application_funnel` to get the full funnel across all opportunities.
2. Render a `stacked_bar` chart showing SUBMITTED / IN_REVIEW / ACCEPTED / REJECTED per opportunity.
3. Highlight the overall conversion rate and any bottlenecks.

### Step RF2: Opportunity Performance

4. Call `sql_query` with intent `org_opportunity_performance` (params: `{"limit": 10}`) to get KPIs per opportunity.
5. Render a `table` chart with columns: Titre, Candidatures, Acceptes, Taux, Heures avant 1ere candidature.
6. Identify best and worst performing opportunities.

### Step RF3: Bottleneck Analysis

7. Based on the funnel data, identify:
   - Opportunities with high IN_REVIEW count (review bottleneck)
   - Opportunities with high rejection rate (quality mismatch)
   - Opportunities with zero applications (visibility issue)

### Step RF4: Metrics Summary

8. Render `metric` cards for:
   - Overall acceptance rate
   - Average time to first application
   - Total active pipeline
9. Provide 2-3 actionable recommendations to improve the funnel.

---

## Full PDF Report

### Step PR1: Gather Organization Context

1. Call `sql_query` with intent `org_stats` to retrieve:
   - Organization stats (member_count, open_opportunities, community_count, space_count)
   - `logo_url`, `city`, `country` for the PDF header

### Step PR2: Gather Analytics Data

Execute ALL 5 analytics queries in PARALLEL (call all tools at once — do not wait for each result sequentially):

2. `sql_query` intent `org_talent_cohorts` (params: `{"months": 12}`) — monthly new talent acquisition
3. `sql_query` intent `org_skills_analytics` (params: `{"limit": 15}`) — top skills distribution
4. `sql_query` intent `org_geo_distribution` (params: `{"groupBy": "country"}`) — geographic repartition
5. `sql_query` intent `org_application_funnel` — recruitment funnel
6. `sql_query` intent `org_community_engagement` — community engagement metrics

**IMPORTANT**: These 5 calls are independent — call them ALL in a single tool-use turn for speed.

### Step PR3: Generation Decision

7. Present a brief summary of available data:
   - "X talents dans le pool, Y candidatures, Z communautes actives"
   - "Donnees couvrant les 12 derniers mois"
8. Decision rule:
   - If the user explicitly requested PDF generation/export: call `generate_document` immediately (no confirmation question).
   - If the request was generic ("analyse", "tableau de bord", no explicit PDF generation intent): ask one confirmation question before generating the PDF.

### Step PR4: Generate Branded PDF

9. After confirmation, call `generate_document` with format "PDF" and the **Org Document JSON format**:

```
{
  "organizationName": "<org name>",
  "organizationCity": "<city>",
  "organizationCountry": "<country>",
  "logoUrl": "<logo_url>",
  "documentDate": "<today YYYY-MM-DD>",
  "sections": [
    {"heading": "Resume Executif", "body": "Ce rapport presente l'analyse du talent pool de [Org] sur les 12 derniers mois.\n\n- X membres actifs\n- Y opportunites ouvertes\n- Z communautes\n- W espaces"},
    {"heading": "Cohortes de Talents — Acquisition Mensuelle", "body": "Evolution mensuelle des nouveaux talents :\n- [Mois 1] : X nouveaux\n- [Mois 2] : Y nouveaux\n...\n\nTendance : [croissance/stagnation/declin]. [Analyse en 2-3 phrases]."},
    {"heading": "Distribution des Competences", "body": "Top 10 competences du talent pool :\n- [Skill 1] : X talents\n- [Skill 2] : Y talents\n...\n\n[Analyse des forces et lacunes]."},
    {"heading": "Repartition Geographique", "body": "Distribution par pays :\n- [Pays 1] : X talents (XX%)\n- [Pays 2] : Y talents (YY%)\n...\n\n[Commentaire sur la diversite geographique]."},
    {"heading": "Entonnoir de Recrutement", "body": "Performance des opportunites :\n- Total candidatures : X\n- En revue : Y\n- Acceptees : Z (taux : XX%)\n- Rejetees : W\n\n[Analyse des goulots d'etranglement]."},
    {"heading": "Engagement Communautaire", "body": "Metriques par communaute :\n- [Communaute 1] : X membres, Y actifs 30j, Z posts\n...\n\n[Recommandations pour ameliorer l'engagement]."},
    {"heading": "Recommandations Strategiques", "body": "Sur la base de cette analyse :\n- [Recommandation 1]\n- [Recommandation 2]\n- [Recommandation 3]"}
  ]
}
```

**CRITICAL: Use the Org Document format (with organizationName + sections). Replace ALL bracketed values with real data from tool results. Never leave placeholders.**

### Step PR5: Present Result

10. Render the document card. **Format (exact):** `entity:document {"id":"uuid"}` — use the document id returned by generate_document.
11. Also render key charts inline for immediate visual feedback (bar for cohorts, donut for geo).
12. Offer follow-up: "Souhaitez-vous approfondir un aspect specifique ?"

---

## Rules
- Use charts for every data visualization step
- Keep text concise between charts — max 2 sentences per section
- All insights must come from tool results, never invented
- Use table for engagement data, bar for trends, donut for distribution, stacked_bar for funnels
- Never exceed 3 metric cards per dashboard
- Focus on actionable insights, not raw data
- ALWAYS use the Org Document JSON format for PDF reports — never the plain sections format
- ALWAYS fetch org_stats FIRST to get logo_url for PDF reports
- Format numbers with French locale (espace pour les milliers, virgule pour les decimales)
- Currency: XOF / FCFA
- Write analysis and recommendations in professional French
- If a data source returns empty results, mention it as "Donnees insuffisantes" rather than omitting the section
- Keep reports executive-friendly: insights over raw data
