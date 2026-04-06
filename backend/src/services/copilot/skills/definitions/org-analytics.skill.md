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

### Step TC1: Talent Cohorts Over Time (Chart #17)

1. Use member_count and org_sectors from `<organization>` context for the overview.
2. Call `sql_query` with intent `org_talent_cohorts` (params: `{"months": 12}`) to get monthly new talent acquisition.
3. Render un **line** chart montrant l'evolution :

```chart
{"type":"line","title":"Nouveaux talents par mois","data":[{"label":"Sep 2025","value":5},{"label":"Oct 2025","value":8},{"label":"Nov 2025","value":12},{"label":"Dec 2025","value":15},{"label":"Jan 2026","value":22},{"label":"Fev 2026","value":18}]}
```

**Thinking flow** : Utiliser line (pas bar) pour montrer la tendance temporelle. Labels = mois abreges. Si baisse 2 mois consecutifs → alerter ("Ralentissement observe — envisagez une campagne de sourcing"). Annoter les pics si un evenement est connu.

4. Identify trends: growth, plateau, or decline.

### Step TC2: Skills Distribution (Chart #16)

5. Call `sql_query` with intent `org_skills_analytics` (params: `{"limit": 15}`) to get top skills in the talent pool.
6. Render un **bar** chart des top skills :

```chart
{"type":"bar","title":"Top competences — Vivier talents","data":[{"label":"JavaScript","value":34},{"label":"Python","value":28},{"label":"Management","value":22},{"label":"Marketing Digital","value":18},{"label":"Communication","value":15}]}
```

**Thinking flow** : Top 10 max par talent_count. Labels = noms de skills lisibles (pas d'enums). Croiser avec les skills demandees dans org_opportunities : si une skill est tres demandee mais absente du vivier → le mentionner explicitement ("JavaScript est tres demande mais sous-represente dans votre vivier").

7. Highlight skill gaps or concentrations.

### Step TC3: Geographic Distribution (Chart #15)

8. Call `sql_query` with intent `org_geo_distribution` (params: `{"groupBy": "country"}`) for country view.
9. Render un **donut** de distribution geographique :

```chart
{"type":"donut","title":"Talents par pays","data":[{"label":"Cote d'Ivoire","value":45},{"label":"Senegal","value":12},{"label":"Cameroun","value":8},{"label":"Mali","value":5},{"label":"Autres","value":10}],"total_label":"80 talents"}
```

**Thinking flow** : Grouper les pays < 3% du total en "Autres". Si > 80% dans un seul pays → recommander diversification geographique. total_label = somme de toutes les valeurs + " talents".

10. Comment on geographic diversity and potential for expansion.

### Step TC4: Synthesis

11. Provide a strategic synthesis with:
    - Key trends (growing/declining talent segments)
    - Top 3 strengths of the talent pool
    - Top 3 gaps or risks
    - 2-3 actionable recommendations

---

## Engagement Dashboard

### Step E1: Community Engagement (Chart #18)

1. Call `sql_query` with intent `org_community_engagement` to get engagement metrics for all communities.
2. Render un **table** chart avec taux d'activite calcule :

```chart
{"type":"table","title":"Engagement des communautes","columns":["Communaute","Membres","Actifs 30j","Taux activite","Posts","Reactions"],"rows":[{"Communaute":"Tech Abidjan","Membres":120,"Actifs 30j":45,"Taux activite":"38%","Posts":23,"Reactions":156},{"Communaute":"RH Connect","Membres":80,"Actifs 30j":12,"Taux activite":"15%","Posts":5,"Reactions":18}]}
```

**Thinking flow** : Calculer taux activite = (active_30d / total_members) * 100, arrondi. Trier par taux decroissant. Si taux < 20% → marquer la communaute comme "faible engagement". Si taux > 50% → "communaute tres active".

3. Identify the most and least engaged communities.

### Step E2: Key Metrics (Chart #20 — Dashboard KPIs)

4. Render 3-4 **metric** cards enchaines :

```chart
{"type":"metric","title":"Taux d'acceptation global","value":12,"unit":"%","trend":{"direction":"up","delta":3,"period":"vs mois dernier"}}
```
```chart
{"type":"metric","title":"Candidatures recues","value":156,"unit":"total","trend":{"direction":"up","delta":23,"period":"ce mois"}}
```
```chart
{"type":"metric","title":"Temps moyen 1ere candidature","value":4.2,"unit":"heures","trend":{"direction":"down","delta":1.5,"period":"vs mois dernier"}}
```
```chart
{"type":"metric","title":"Opportunites ouvertes","value":8,"unit":"postes"}
```

**Thinking flow** : Calculer depuis org_stats + org_opportunity_performance. Taux acceptation = total accepted / total applications * 100. Temps moyen = moyenne hours_to_first_application. Toujours inclure trend quand les donnees historiques le permettent (delta vs mois precedent). Direction "down" est positive pour le temps (plus rapide = mieux). Max 4 metrics. Ne pas inventer de chiffres — utiliser uniquement les donnees retournees par les tools.

5. Provide strategic synthesis with 2-3 recommendations to improve engagement.

---

## Recruitment Funnel Dashboard

### Step RF1: Application Funnel (Chart #14)

1. Call `sql_query` with intent `org_application_funnel` to get the full funnel across all opportunities.
2. Render un **stacked_bar** du funnel de recrutement :

```chart
{"type":"stacked_bar","title":"Funnel recrutement","data":[{"label":"Dev Frontend","segments":[{"key":"submitted","label":"Soumises","value":45,"color":"primary"},{"key":"in_review","label":"En revue","value":12,"color":"warning"},{"key":"accepted","label":"Acceptees","value":3,"color":"success"},{"key":"rejected","label":"Refusees","value":18,"color":"error"}]},{"label":"UX Designer","segments":[{"key":"submitted","label":"Soumises","value":28,"color":"primary"},{"key":"in_review","label":"En revue","value":8,"color":"warning"},{"key":"accepted","label":"Acceptees","value":2,"color":"success"},{"key":"rejected","label":"Refusees","value":10,"color":"error"}]}]}
```

**Thinking flow** : Une barre par opportunite, segments = statuts de candidature. Labels : SUBMITTED→"Soumises", IN_REVIEW→"En revue", ACCEPTED→"Acceptees", REJECTED→"Refusees". Trier par acceptance_rate croissant (les opportunites problematiques en premier). Si ratio refus > 80% → alerter. Exclure les segments a 0.

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

### Step PR1: Gather Analytics Data

Use `logo_url`, `city`, `country`, `member_count` from `<organization>` context (pre-loaded, no org_stats call needed).

Execute ALL 5 analytics queries in PARALLEL (call all tools at once — do not wait for each result sequentially):

1. `sql_query` intent `org_talent_cohorts` (params: `{"months": 12}`) — monthly new talent acquisition
2. `sql_query` intent `org_skills_analytics` (params: `{"limit": 15}`) — top skills distribution
3. `sql_query` intent `org_geo_distribution` (params: `{"groupBy": "country"}`) — geographic repartition
4. `sql_query` intent `org_application_funnel` — recruitment funnel
5. `sql_query` intent `org_community_engagement` — community engagement metrics

**IMPORTANT**: These 5 calls are independent — call them ALL in a single tool-use turn for speed.

### Step PR2: Generation Decision

6. Present a brief summary of available data:
   - "X talents dans le pool, Y candidatures, Z communautes actives"
   - "Donnees couvrant les 12 derniers mois"
7. Decision rule:
   - If the user explicitly requested PDF generation/export: call `generate_document` immediately (no confirmation question).
   - If the request was generic ("analyse", "tableau de bord", no explicit PDF generation intent): ask one confirmation question before generating the PDF.

### Step PR3: Generate Branded PDF

8. After confirmation, call `generate_document` with format "PDF" and the **Org Document JSON format**:

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

### Step PR4: Present Result

9. Render the document card as a **fenced code block**:

````
```entity:document
{"id":"THE_DOCUMENT_UUID_FROM_GENERATE_DOCUMENT"}
```
````
10. Also render key charts inline for immediate visual feedback (bar for cohorts, donut for geo).
11. Offer follow-up: "Souhaitez-vous approfondir un aspect specifique ?"

---

## Rules
- Use charts for every data visualization step
- Keep text concise between charts — max 2 sentences per section
- All insights must come from tool results, never invented
- Use table for engagement data, bar for trends, donut for distribution, stacked_bar for funnels
- Never exceed 3 metric cards per dashboard
- Focus on actionable insights, not raw data
- ALWAYS use the Org Document JSON format for PDF reports — never the plain sections format
- Use logo_url, city, country from `<organization>` context (pre-loaded, no org_stats call needed)
- Format numbers with French locale (espace pour les milliers, virgule pour les decimales)
- Currency: XOF / FCFA
- Write analysis and recommendations in professional French
- If a data source returns empty results, mention it as "Donnees insuffisantes" rather than omitting the section
- Keep reports executive-friendly: insights over raw data
