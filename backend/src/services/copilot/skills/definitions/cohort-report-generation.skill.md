---
name: Cohort Report Generation
description: Generate a branded PDF analytics report with talent cohorts, skills distribution, geographic data, and recruitment funnel
modes: org
tools: sql_query, generate_document
triggers: rapport cohortes, rapport PDF, générer un rapport, rapport analytics, rapport talents, export rapport, bilan talents
---

# Cohort Report Generation Workflow

You are now in Cohort Report PDF Generation mode. Your goal: produce a branded, comprehensive PDF analytics report with the organization's logo.

## Step 1: Gather Organization Context
1. Call `sql_query` with intent `org_stats` to retrieve:
   - Organization stats (member_count, open_opportunities, community_count, space_count)
   - `logo_url`, `city`, `country` for the PDF header

## Step 2: Gather Analytics Data
Execute ALL 6 analytics queries in PARALLEL (call all tools at once — do not wait for each result sequentially):

2. `sql_query` intent `org_talent_cohorts` (params: `{"months": 12}`) — monthly new talent acquisition
3. `sql_query` intent `org_skills_analytics` (params: `{"limit": 15}`) — top skills distribution
4. `sql_query` intent `org_geo_distribution` (params: `{"groupBy": "country"}`) — geographic repartition
5. `sql_query` intent `org_application_funnel` — recruitment funnel
6. `sql_query` intent `org_community_engagement` — community engagement metrics
7. `sql_query` intent `org_revenue_analytics` (params: `{"groupBy": "month"}`) — revenue trends

**IMPORTANT**: These 6 calls are independent — call them ALL in a single tool-use turn for speed.

## Step 3: Confirm Generation
8. Present a brief summary of available data:
   - "X talents dans le pool, Y candidatures, Z communautés actives"
   - "Données couvrant les 12 derniers mois"
9. Ask for confirmation: "Voulez-vous que je génère le rapport PDF ?"

## Step 4: Generate Branded PDF
10. After confirmation, call `generate_document` with format "PDF" and the **Org Document JSON format**:

```
{
  "organizationName": "<org name>",
  "organizationCity": "<city>",
  "organizationCountry": "<country>",
  "logoUrl": "<logo_url>",
  "documentDate": "<today YYYY-MM-DD>",
  "sections": [
    {"heading": "Résumé Exécutif", "body": "Ce rapport présente l'analyse du talent pool de [Org] sur les 12 derniers mois.\n\n- X membres actifs\n- Y opportunités ouvertes\n- Z communautés\n- W espaces"},
    {"heading": "Cohortes de Talents — Acquisition Mensuelle", "body": "Évolution mensuelle des nouveaux talents :\n- [Mois 1] : X nouveaux\n- [Mois 2] : Y nouveaux\n...\n\nTendance : [croissance/stagnation/déclin]. [Analyse en 2-3 phrases]."},
    {"heading": "Distribution des Compétences", "body": "Top 10 compétences du talent pool :\n- [Skill 1] : X talents\n- [Skill 2] : Y talents\n...\n\n[Analyse des forces et lacunes]."},
    {"heading": "Répartition Géographique", "body": "Distribution par pays :\n- [Pays 1] : X talents (XX%)\n- [Pays 2] : Y talents (YY%)\n...\n\n[Commentaire sur la diversité géographique]."},
    {"heading": "Entonnoir de Recrutement", "body": "Performance des opportunités :\n- Total candidatures : X\n- En revue : Y\n- Acceptées : Z (taux : XX%)\n- Rejetées : W\n\n[Analyse des goulots d'étranglement]."},
    {"heading": "Engagement Communautaire", "body": "Métriques par communauté :\n- [Communauté 1] : X membres, Y actifs 30j, Z posts\n...\n\n[Recommandations pour améliorer l'engagement]."},
    {"heading": "Revenus — Espaces", "body": "Évolution mensuelle des revenus :\n- [Mois 1] : X FCFA\n- [Mois 2] : Y FCFA\n...\n\nTotal période : Z FCFA. Taux de complétion : XX%."},
    {"heading": "Recommandations Stratégiques", "body": "Sur la base de cette analyse :\n- [Recommandation 1]\n- [Recommandation 2]\n- [Recommandation 3]"}
  ]
}
```

**CRITICAL: Use the Org Document format (with organizationName + sections). Replace ALL bracketed values with real data from tool results. Never leave placeholders.**

## Step 5: Present Result
11. Render the document card. **Format (exact):** `entity:document {"id":"uuid"}` — use the document id returned by generate_document.
12. Also render key charts inline for immediate visual feedback (bar for cohorts, donut for geo).
13. Offer follow-up: "Souhaitez-vous approfondir un aspect spécifique ?"

## Rules
- ALWAYS use the Org Document JSON format — never the plain sections format
- ALWAYS fetch org_stats FIRST to get logo_url
- ALL data in the report MUST come from tool results — never invented
- Format numbers with French locale (espace pour les milliers, virgule pour les décimales)
- Currency: XOF / FCFA
- Write analysis and recommendations in professional French
- If a data source returns empty results, mention it as "Données insuffisantes" rather than omitting the section
- Keep the report executive-friendly: insights over raw data
