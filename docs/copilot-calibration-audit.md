# Copilot Calibration Report

> Generated: 2026-02-09T17:34:00.512Z
> Tests: 14 | Passed: 14 | Failed: 0

## Calibration Summary

| Test | Agent | Chars | Questions | Tools | Verbosity | Proactivity | Quick Ack | Cards |
|------|-------|-------|-----------|-------|-----------|-------------|-----------|-------|
| ✅ Explorer — Opportunites matching profil | explorer | 784 | 1 | 2 | ok | proactive | ✅ | 6 |
| ✅ Explorer — Espaces coworking Abidjan | explorer | 493 | 1 | 1 | ok | proactive | ✅ | 3 |
| ✅ Explorer — Communautes tech | explorer | 687 | 1 | 1 | ok | proactive | ✅ | 5 |
| ✅ Explorer — Generer CV a jour | explorer | 350 | 1 | 6 | ok | proactive | ✅ | 1 |
| ✅ Explorer — Actualites communautes | explorer | 234 | 1 | 1 | concise | proactive | ✅ | 1 |
| ✅ Study — Debuter marketing digital | study | 1007 | 1 | 0 | ok | passive | N/A | 0 |
| ✅ Study — Diagnostic competences finance | study | 722 | 0 | 0 | ok | passive | N/A | 0 |
| ✅ Study — Expliquer le machine learning | study | 1027 | 1 | 0 | ok | passive | N/A | 0 |
| ✅ Study — Schema cycle de Krebs | study | 1030 | 1 | 1 | ok | proactive | ✅ | 0 |
| ✅ Study — Video YouTube agriculture durable | study | 644 | 1 | 1 | ok | proactive | ✅ | 0 |
| ✅ Org — Recruter profils marketing | org | 553 | 1 | 6 | ok | proactive | ✅ | 1 |
| ✅ Org — Dashboard organisation | org | 585 | 1 | 1 | ok | proactive | ✅ | 0 |
| ✅ Org — Generer fiche de poste | org | 868 | 1 | 3 | ok | proactive | ✅ | 0 |
| ✅ Org — Publier offre stage | org | 1500 | 0 | 0 | ok | passive | N/A | 0 |

## Calibration Issues

### Not Proactive Enough
- **Study — Debuter marketing digital**: 0 tool calls, 1 questions asked
- **Study — Diagnostic competences finance**: 0 tool calls, 0 questions asked
- **Study — Expliquer le machine learning**: 0 tool calls, 1 questions asked
- **Org — Publier offre stage**: 0 tool calls, 0 questions asked

---

## Detailed Results

### Explorer Agent

#### ✅ Explorer — Opportunites matching profil (149396ms)

**Prompt:** `Quels postes correspondent a mon profil en ce moment ?`

**Calibration:** Verbosity=ok, Proactivity=proactive, Chars=784, Questions=1, Tools=2

**Tool: `vector_query`** (10292ms)
```json
{
  "query": "opportunites emploi direction commerciale, business development, go-to-market, key account management, CRM, vente complexe, pricing, SaaS, innovation, IA, consulting; egalement gestion de projet biomedical/biotech et bio-informatique; leadership et management d’equipe; francophone; base a Abobo/Abidjan, Cote d’Ivoire; ouvert au remote; secteurs: digital, sante, biotech, fintech; postes: Head of Sales, Sales Manager, Country Manager, Growth Lead, Business Development Manager, Strategic Partnerships, Product Marketing, Healthtech Project Manager, Bioinformatics Analyst (management), Public Policy Strategy; niveau senior/manager; immediatement disponibles",
  "namespace": "opportunities",
  "topK": 20,
  "filtersJson": null
}
```

**Tool: `sql_query`** (5ms)
```json
{
  "intent": "search_opportunities",
  "paramsJson": "{\"q\":\"commercial business development head of sales partenariats marketing go-to-market Abidjan remote CDI\"}"
}
```

**Agent Output:**
```markdown
Voici des opportunites alignees avec votre profil.Votre trajectoire conjugue stratégie commerciale, innovation et pilotage de projets. Voici une sélection d’opportunités en phase avec vos forces (GTM, CRM, négociation, leadership), à Abidjan et/ou ouvertes au remote.

```entity:opportunity
{"id":"c0000001-0002-4000-c000-000000000002"}
```

```entity:opportunity
{"id":"c0000004-0003-4000-c000-000000000003"}
```

```entity:opportunity
{"id":"c0000004-0002-4000-c000-000000000002"}
```

```entity:opportunity
{"id":"943d7a09-d777-40b7-a3b5-8c7b88e89ed1"}
```

```entity:opportunity
{"id":"38905324-f54d-41c8-837d-4674365fb7b3"}
```

```entity:opportunity
{"id":"c0000001-0003-4000-c000-000000000003"}
```

Souhaitez-vous privilégier Santé/Biotech, Digital/Fintech, ou rester ouvert ?
```

---

#### ✅ Explorer — Espaces coworking Abidjan (37973ms)

**Prompt:** `Je cherche un espace de travail calme sur Abidjan avec wifi`

**Calibration:** Verbosity=ok, Proactivity=proactive, Chars=493, Questions=1, Tools=1

**Tool: `vector_query`** (2890ms)
```json
{
  "query": "espace de travail calme wifi Abidjan coworking open space salle de reunion silencieux Plateau Cocody Riviera Adjame Treichville",
  "namespace": "spaces",
  "topK": 12,
  "filtersJson": null
}
```

**Agent Output:**
```markdown
Voici des espaces calmes avec wifi à Abidjan.Excellente idée : un lieu calme décuple votre clarté d’esprit. Sélection à Abidjan avec wifi fiable pour concentration et rendez-vous: Cocody (fibre), Plateau (très calme), Zone 4 (bureau privé).

```entity:space
{"id":"f0000001-0001-4000-f000-000000000001"}
```

```entity:space
{"id":"f0000001-0002-4000-f000-000000000002"}
```

```entity:space
{"id":"f0000001-0004-4000-f000-000000000004"}
```

Quel quartier et créneau souhaitez-vous réserver ?
```

---

#### ✅ Explorer — Communautes tech (66246ms)

**Prompt:** `Quelles communautes tech actives existent a Abidjan ?`

**Calibration:** Verbosity=ok, Proactivity=proactive, Chars=687, Questions=1, Tools=1

**Tool: `vector_query`** (1478ms)
```json
{
  "query": "communautés tech actives Abidjan Côte d'Ivoire IA data science cloud dev web mobile entrepreneuriat startups innovation networking francophone",
  "namespace": "communities",
  "topK": 15,
  "filtersJson": null
}
```

**Agent Output:**
```markdown
Voyons les communautes tech a Abidjan.Voici une sélection de communautés tech actives à Abidjan et en Côte d’Ivoire, alignées avec l’IA, la data, l’innovation et l’entrepreneuriat. Elles offrent rencontres régulières, mentorat et networking au service de votre impact.

```entity:community
{"id":"e0000001-0001-4000-e000-000000000001"}
```

```entity:community
{"id":"9c535835-20c7-4689-8555-b59dd2be7509"}
```

```entity:community
{"id":"b825f144-5fc6-4a79-af5d-dc3d28235bfc"}
```

```entity:community
{"id":"e0000001-0004-4000-e000-000000000004"}
```

```entity:community
{"id":"15df926d-07b8-409d-ba93-35eb53fe414c"}
```

Souhaitez-vous que je prépare votre adhésion à l’une d’elles ?
```

---

#### ✅ Explorer — Generer CV a jour (169944ms)

**Prompt:** `Fais-moi un CV a jour stp`

**Calibration:** Verbosity=ok, Proactivity=proactive, Chars=350, Questions=1, Tools=6

**Tool: `sql_query`** (11ms)
```json
{
  "intent": "my_profile",
  "paramsJson": "{}"
}
```

**Tool: `sql_query`** (11ms)
```json
{
  "intent": "my_bookmarks",
  "paramsJson": "{}"
}
```

**Tool: `sql_query`** (11ms)
```json
{
  "intent": "my_documents",
  "paramsJson": "{}"
}
```

**Tool: `sql_query`** (11ms)
```json
{
  "intent": "my_skills",
  "paramsJson": "{}"
}
```

**Tool: `file_reader`** (48879ms)
```json
{
  "input": "04bcd6cb-70bc-4c85-90df-c31ff0a55cfb"
}
```

**Tool: `generate_document`** (5063ms)
```json
{
  "format": "PDF",
  "title": "CV — Lamine Barro",
  "contentJson": "{\"firstName\":\"Mohamed Lamine\",\"lastName\":\"Barro\",\"email\":\"succes1@gmail.com\",\"phone\":\"+2250574631148\",\"city\":\"Abobo\",\"country\":\"Côte d’Ivoire\",\"bio\":\"Étudiant et entrepreneur spécialisé dans le digital, l'éducation, le tourisme et le transport. Orienté impact, data et innovation, je développe des stratégies et des produits soutenus par l’IA pour accélérer l’employabilité et la performance des organisations.\",\"skills\":[{\"name\":\"Analyse De Données Biologiques\",\"type\":\"hard\",\"level\":\"expert\"},{\"name\":\"Analyse De Données Commerciales\",\"type\":\"knowledge\",\"level\":\"expert\"},{\"name\":\"Bio-informatique\",\"type\":\"hard\",\"level\":\"intermediate\"},{\"name\":\"Communication\",\"type\":\"soft\",\"level\":\"expert\"},{\"name\":\"Communication En Français\",\"type\":\"soft\",\"level\":\"expert\"},{\"name\":\"Communication Scientifique\",\"type\":\"soft\",\"level\":\"expert\"},{\"name\":\"Consulting\",\"type\":\"soft\",\"level\":\"expert\"},{\"name\":\"Développement De Comptes Clés\",\"type\":\"hard\",\"level\":\"master\"},{\"name\":\"Développement De Solutions Numériques\",\"type\":\"hard\",\"level\":\"expert\"},{\"name\":\"Entrepreneuriat\",\"type\":\"hard\",\"level\":\"master\"},{\"name\":\"Forecasting Des Ventes\",\"type\":\"hard\",\"level\":\"expert\"},{\"name\":\"Gestion De Crm\",\"type\":\"hard\",\"level\":\"expert\"},{\"name\":\"Gestion De Projet\",\"type\":\"hard\",\"level\":\"expert\"},{\"name\":\"Gestion De Projet Biomédical\",\"type\":\"hard\",\"level\":\"expert\"},{\"name\":\"Go-to-market\",\"type\":\"knowledge\",\"level\":\"expert\"},{\"name\":\"Innovation\",\"type\":\"knowledge\",\"level\":\"expert\"},{\"name\":\"Intelligence Artificielle\",\"type\":\"hard\",\"level\":\"expert\"},{\"name\":\"Leadership\",\"type\":\"soft\",\"level\":\"expert\"},{\"name\":\"Management D'équipe\",\"type\":\"soft\",\"level\":\"master\"},{\"name\":\"Mobilisation De Fonds\",\"type\":\"hard\",\"level\":\"expert\"},{\"name\":\"Négociation Grands Comptes\",\"type\":\"hard\",\"level\":\"expert\"},{\"name\":\"Pilotage Du Pipeline\",\"type\":\"hard\",\"level\":\"expert\"},{\"name\":\"Pricing\",\"type\":\"hard\",\"level\":\"master\"},{\"name\":\"Réseautage\",\"type\":\"soft\",\"level\":\"expert\"},{\"name\":\"Stratégie Commerciale\",\"type\":\"knowledge\",\"level\":\"expert\"},{\"name\":\"Stratégie Des Politiques Publiques\",\"type\":\"knowledge\",\"level\":\"master\"},{\"name\":\"Stratégie Go-to-market\",\"type\":\"hard\",\"level\":\"expert\"},{\"name\":\"Stratégie Numérique\",\"type\":\"knowledge\",\"level\":\"expert\"},{\"name\":\"Suivi Des Kpi\",\"type\":\"hard\",\"level\":\"expert\"},{\"name\":\"Vente Complexe\",\"type\":\"hard\",\"level\":\"expert\"}],\"languages\":[{\"language\":\"Français\",\"level\":\"natif\"}],\"interests\":[\"Digital\",\"Éducation\",\"Tourisme\",\"Transport\"],\"goals\":[\"Acquérir de nouvelles compétences\",\"Développer mon réseau et ma visibilité\",\"Appui à la recherche\"],\"experiences\":[{\"title\":\"Président / Directeur général\",\"company\":\"Etudesk\",\"location\":\"Abidjan\",\"period\":\"Mai 2016 – Présent\",\"description\":\"Direction stratégique et produit ; partenariats institutionnels ; levées de fonds ; management transverse ; industrialisation de l’employabilité via l’IA avec ministères et bailleurs internationaux.\"},{\"title\":\"Consultant & Ambassadeur de l’Innovation\",\"company\":\"Gouvernement de la République de Côte d’Ivoire\",\"location\":\"Abidjan\",\"period\":\"Déc. 2021 – Présent\",\"description\":\"Conseil à la Présidence, Primature et ministères sur innovation, économie numérique et entrepreneuriat des jeunes ; cadrage de politiques publiques et programmes structurants.\"},{\"title\":\"Membre du conseil scientifique\",\"company\":\"Mission laïque française\",\"location\":\"International\",\"period\":\"Fév. 2021 – Présent\",\"description\":\"Contribution aux orientations scientifiques et éducatives ; évaluation de projets et innovation pédagogique.\"},{\"title\":\"Vice-président & Membre fondateur\",\"company\":\"#CI20 (Écosystème startups CI)\",\"location\":\"Abidjan\",\"period\":\"Oct. 2020 – Présent\",\"description\":\"Plaidoyer et représentation de l’écosystème ; coordination d’initiatives pour la croissance des startups ivoiriennes.\"},{\"title\":\"Président\",\"company\":\"Club informatique de l’UPGC\",\"location\":\"Korhogo\",\"period\":\"Déc. 2013 – Mars 2015\",\"description\":\"Animation de communauté ; encadrement de projets étudiants en informatique ; organisation d’événements tech.\"},{\"title\":\"MSP / Évangéliste technologiste\",\"company\":\"Microsoft WCA\",\"location\":\"Côte d’Ivoire\",\"period\":\"Janv. 2013 – Déc. 2014\",\"description\":\"Promotion des technologies Microsoft ; interventions universitaires et auprès des communautés développeurs.\"},{\"title\":\"Président intérimaire\",\"company\":\"Interact Club Bietry\",\"location\":\"Abidjan\",\"period\":\"Juin 2010 – Août 2011\",\"description\":\"Leadership associatif ; conception et mise en œuvre d’actions citoyennes.\"}],\"education\":[{\"degree\":\"Executive MBA (HEC Challenge Plus Afrique)\",\"institution\":\"HEC Paris\",\"location\":\"Paris / Abidjan\",\"period\":\"Mai 2022\",\"description\":\"Programme exécutif axé sur croissance, stratégie et innovation.\"},{\"degree\":\"Licence Sciences biologiques, spécialisation Bio-informatique\",\"institution\":\"Université Péléforo Gon Coulibaly (UPGC)\",\"location\":\"Korhogo\",\"period\":\"2015\",\"description\":\"Parcours orienté data, bio-informatique et communication scientifique.\"}],\"certifications\":[{\"name\":\"Founder Institute\",\"issuer\":\"Founder Institute (Silicon Valley)\",\"date\":\"Juil. 2016\"}]}",
  "instructions": "Générer un CV PDF élégant, moderne, deux colonnes, en français, optimisé ATS. Mettre en avant leadership, stratégie, IA, éducation et impact public. Structurer clairement compétences (barres de niveau), expériences (timeline), formations et certifications. Utiliser la photo de profil par défaut de l’utilisateur si disponible. Prioriser clarté, concision et résultats mesurables. Adapter le ton pour candidatures direction/innovation/commercial/IA."
}
```

**Agent Output:**
```markdown
Préparons votre CV professionnel à jour.Votre CV est prêt, actualisé et percutant.

```entity:document
{"id":"c0e8acef-dd7d-4330-953a-e8c9cf47da02"}
```

Inclus: vos expériences clés (Etudesk, Gouvernement CI, #CI20), MBA HEC, compétences stratégiques/IA/commerce, et langue.  
Souhaitez-vous une version ciblée pour un poste précis (titre/secteur) ?
```

---

#### ✅ Explorer — Actualites communautes (53095ms)

**Prompt:** `Quoi de neuf dans mes communautes cette semaine ?`

**Calibration:** Verbosity=concise, Proactivity=proactive, Chars=234, Questions=1, Tools=1

**Tool: `sql_query`** (12ms)
```json
{
  "intent": "my_communities",
  "paramsJson": "{}"
}
```

**Agent Output:**
```markdown
Voyons les nouveautés dans vos communautés.Voici les nouveautés de vos communautés.

```entity:community
{"id":"e0000001-0002-4000-e000-000000000002"}
```

Souhaitez-vous que j’affiche les publications et événements de cette semaine ?
```

---

### Study Agent

#### ✅ Study — Debuter marketing digital (40595ms)

**Prompt:** `Je debute en marketing digital, par ou commencer ?`

**Calibration:** Verbosity=ok, Proactivity=passive, Chars=1007, Questions=1, Tools=0

**Agent Output:**
```markdown
Le marketing digital repose sur des fondamentaux simples. 
Commence par un objectif SMART lié au business (ex: 100 leads en 60 jours). Clarifie ton audience avec 1-2 personas et leur douleur prioritaire. Mets en place la base: landing claire, aimant à prospects (ebook, checklist ou mini-cours WhatsApp), et suivi (GA4, Meta Pixel). Choisis 1-2 canaux au départ: SEO de base + Instagram/TikTok ou Email; ajoute de petits tests publicitaires si besoin. Mesure 3 KPI: conversion, CPL, ROAS, puis itère chaque semaine. Exemple Afrique: une marque de beurre de karité à Abidjan capte des emails via WhatsApp et teste 20 000 FCFA/semaine en Ads.

```flashcard
{"topic":"Marketing digital — bases","front":"Quelles sont les 3 premières étapes pour démarrer efficacement ?","back":"1) Définir un objectif SMART. 2) Décrire 1-2 personas. 3) Poser la base technique: landing + aimant à prospects + analytics (GA4/Pixel).","difficulty":"medium"}
```

Souhaites-tu un plan d’action sur 4 semaines adapté à ton projet ?
```

---

#### ✅ Study — Diagnostic competences finance (25187ms)

**Prompt:** `Fais-moi un diagnostic de mes competences en finance d'entreprise`

**Calibration:** Verbosity=ok, Proactivity=passive, Chars=722, Questions=0, Tools=0

**Agent Output:**
```markdown
Diagnostic finance d'entreprise, commençons par les bases.
Je te propose un mini test en 3 étapes: rappel, application, analyse. Réponds et je corrige au fur et à mesure, puis j’en déduis ton niveau et des next steps. Première question :

```quiz
{"topic":"Finance d'entreprise — Diagnostic","question":"Quel est l'objectif principal de la gestion de trésorerie en entreprise ?","options":["Assurer la rentabilité à long terme","Garantir la liquidité pour honorer les engagements à court terme","Maximiser le chiffre d'affaires","Réduire l'impôt sur les sociétés"],"correctAnswer":1,"explanation":"La trésorerie vise d'abord à assurer la liquidité immédiate pour payer fournisseurs, salaires et dettes à court terme."}
```
```

---

#### ✅ Study — Expliquer le machine learning (22488ms)

**Prompt:** `Explique-moi le machine learning simplement`

**Calibration:** Verbosity=ok, Proactivity=passive, Chars=1027, Questions=1, Tools=0

**Agent Output:**
```markdown
Le machine learning apprend des modèles à partir des données.

L’apprentissage automatique regroupe des algorithmes qui détectent des motifs dans des données pour prédire ou décider sans écrire toutes les règles à la main. Étapes clés: collecter/nettoyer les données, sélectionner des variables, entraîner le modèle, évaluer, déployer et surveiller. Types majeurs: supervisé (prédire une étiquette), non supervisé (regrouper/détecter anomalies), renforcement (apprendre par essais/erreurs). Exemple Afrique: sur le mobile money, un modèle supervisé classe des transactions comme frauduleuses ou légitimes; en agriculture, un modèle de vision repère des maladies de feuilles depuis des photos. Données de qualité, bonnes métriques et évitement du surapprentissage sont essentiels.

```flashcard
{"topic":"Apprentissage automatique","front":"Nomme les 3 grandes familles du machine learning.","back":"Supervisé, non supervisé et par renforcement.","difficulty":"easy"}
```

Souhaites-tu un schéma du pipeline ML ou un mini-quiz ?
```

---

#### ✅ Study — Schema cycle de Krebs (61877ms)

**Prompt:** `Dessine-moi le cycle de Krebs en biologie`

**Calibration:** Verbosity=ok, Proactivity=proactive, Chars=1030, Questions=1, Tools=1

**Tool: `generate_diagram`** (?ms)
```json
{
  "title": "Cycle de Krebs",
  "diagramType": "flowchart",
  "mermaidCode": "flowchart TD\n  A[Acetyl CoA] --> C[Citrate]\n  B[Oxaloacetate] --> C\n  C --> D[Isocitrate]\n  D --> E[Alpha cetoglutarate]\n  E --> F[Succinyl CoA]\n  F --> G[Succinate]\n  G --> H[Fumarate]\n  H --> I[Malate]\n  I --> B[Oxaloacetate]\n  D --> X1[NADH]\n  D --> X2[CO2]\n  E --> X3[NADH]\n  E --> X4[CO2]\n  F --> X5[GTP]\n  G --> X6[FADH2]\n  I --> X7[NADH]"
}
```

**Agent Output:**
```markdown
Visualisons le cycle de Krebs.Le cycle de Krebs produit des coenzymes riches en energie.

Le cycle de Krebs oxyde l’acetyl-CoA dans la matrice mitochondriale et regenera l’oxaloacetate en boucle. Les etapes clefs: citrate, isocitrate, alpha cetoglutarate, succinyl CoA, succinate, fumarate, malate, puis retour a l’oxaloacetate. Par tour: 3 NADH, 1 FADH2, 1 GTP et 2 CO2 liberes. Ces coenzymes alimentent la chaine respiratoire pour synthétiser beaucoup d’ATP, essentiel par exemple dans les tissus a forte demande energetique.

```diagram
{"type":"flowchart","title":"Cycle de Krebs","code":"flowchart TD\n  A[Acetyl CoA] --> C[Citrate]\n  B[Oxaloacetate] --> C\n  C --> D[Isocitrate]\n  D --> E[Alpha cetoglutarate]\n  E --> F[Succinyl CoA]\n  F --> G[Succinate]\n  G --> H[Fumarate]\n  H --> I[Malate]\n  I --> B[Oxaloacetate]\n  D --> X1[NADH]\n  D --> X2[CO2]\n  E --> X3[NADH]\n  E --> X4[CO2]\n  F --> X5[GTP]\n  G --> X6[FADH2]\n  I --> X7[NADH]"}
```

Souhaitez-vous une version annotee avec enzymes et bilans par etape ?
```

---

#### ✅ Study — Video YouTube agriculture durable (30867ms)

**Prompt:** `Trouve-moi une bonne video YouTube sur l'agriculture durable`

**Calibration:** Verbosity=ok, Proactivity=proactive, Chars=644, Questions=1, Tools=1

**Tool: `youtube_search`** (846ms)
```json
{
  "query": "agriculture durable Afrique de l'Ouest",
  "maxResults": 1
}
```

**Agent Output:**
```markdown
Cherchons une excellente vidéo sur l’agriculture durable.Excellente idée pour explorer l’agriculture durable.

```youtube
{"videoId":"7R_vVJlUFwY","title":"Engrais et fertilité des sols en Afrique de l’Ouest : tout comprendre","channelName":"Fondation FARM","description":"Vidéo pédagogique en français sur la fertilité des sols, les engrais et les bonnes pratiques adaptées au contexte ouest-africain."}
```

Solide ressource francophone, centrée sur la fertilité des sols et des pratiques durables adaptées à l’Afrique de l’Ouest — clé pour la résilience et les rendements. Besoin d’une autre vidéo plus axée agroécologie ou gestion de l’eau?
```

---

### Org Agent

#### ✅ Org — Recruter profils marketing (89023ms)

**Prompt:** `Trouve-moi 5 profils marketing digital seniors disponibles sur Abidjan`

**Calibration:** Verbosity=ok, Proactivity=proactive, Chars=553, Questions=1, Tools=6

**Tool: `vector_query`** (2810ms)
```json
{
  "query": "talents marketing digital senior Abidjan Côte d’Ivoire SEO SEA Social Media Growth H/F 7+ ans disponible immédiatement freelance ou CDI",
  "namespace": "talents",
  "topK": 15,
  "filtersJson": null
}
```

**Tool: `vector_query`** (2117ms)
```json
{
  "query": "\"marketing digital\" senior Abidjan CI Côte d’Ivoire SEO SEA SEM Social Media Manager Growth Hacker Content Marketing Performance Marketing PPC Email Marketing CRM HubSpot Meta Ads Google Ads Analytics 8-12 ans disponible maintenant",
  "namespace": "talents",
  "topK": 30,
  "filtersJson": null
}
```

**Tool: `sql_query`** (2117ms)
```json
{
  "intent": "search_talents",
  "paramsJson": "{\"q\":\"marketing digital senior Abidjan CI Côte d’Ivoire SEO SEA Growth Meta Ads Google Ads\",\"limit\":30}"
}
```

**Tool: `vector_query`** (1663ms)
```json
{
  "query": "responsable marketing digital senior Abidjan CI Côte d’Ivoire SEO SEA Social Ads Google Ads Meta Ads CRM HubSpot 8 ans 10 ans disponible",
  "namespace": "talents",
  "topK": 30,
  "filtersJson": null
}
```

**Tool: `vector_query`** (1663ms)
```json
{
  "query": "social media manager senior Abidjan CI community manager lead paid media content strategist disponible",
  "namespace": "talents",
  "topK": 30,
  "filtersJson": null
}
```

**Tool: `vector_query`** (1663ms)
```json
{
  "query": "growth marketer senior Abidjan CI performance marketing PPC acquisition data-driven analytics disponible",
  "namespace": "talents",
  "topK": 30,
  "filtersJson": null
}
```

**Agent Output:**
```markdown
Recherchons des seniors marketing digital à Abidjan.Voici les meilleurs profils disponibles à Abidjan alignés sur votre besoin. L’offre est limitée sur des seniors stricts; je propose le plus pertinent identifié et peux élargir le vivier si souhaité.
- Fatou Traoré — Consultante marketing digital/communication, 6 ans d’expérience, basée à Abidjan.

```entity:talent
{"id":"a1b2c3d4-3333-4000-a000-000000000003"}
```

Souhaitez-vous que j’élargisse aux profils Abidjan/Grand Abidjan ou que je publie une offre ciblée pour attirer davantage de seniors ?
```

---

#### ✅ Org — Dashboard organisation (15937ms)

**Prompt:** `Comment se porte mon organisation ?`

**Calibration:** Verbosity=ok, Proactivity=proactive, Chars=585, Questions=1, Tools=1

**Tool: `sql_query`** (29ms)
```json
{
  "intent": "org_stats",
  "paramsJson": "{\"organizationId\":\"6a80d332-9d56-489c-8314-b65746b4cd78\"}"
}
```

**Agent Output:**
```markdown
Voici l'état de votre organisation.Votre organisation est opérationnelle, avec une base d’équipe minimale. Aucun recrutement en cours, ni communauté ou espace actif pour animer l’écosystème. Démarrer une première offre ou une communauté amplifiera rapidement la traction.

```chart
{"type":"bar","title":"Vue d'ensemble — Organisation Test","data":[{"label":"Membres","value":1},{"label":"Offres ouvertes","value":0},{"label":"Communautés","value":0},{"label":"Espaces","value":0}]}
```

Souhaitez-vous que je publie une première offre ou crée une communauté pour lancer la dynamique ?
```

---

#### ✅ Org — Generer fiche de poste (142731ms)

**Prompt:** `Redige une fiche de poste pour un developpeur fullstack junior Node.js`

**Calibration:** Verbosity=ok, Proactivity=proactive, Chars=868, Questions=1, Tools=3

**Tool: `sql_query`** (5ms)
```json
{
  "intent": "org_opportunities",
  "paramsJson": "{\"organizationId\":\"6a80d332-9d56-489c-8314-b65746b4cd78\"}"
}
```

**Tool: `sql_query`** (6ms)
```json
{
  "intent": "search_opportunities",
  "paramsJson": "{\"query\":\"developpeur fullstack junior Node.js\",\"status\":\"OPEN\",\"limit\":8}"
}
```

**Tool: `web_search`** (96311ms)
```json
{
  "input": "fiche de poste développeur fullstack junior Node.js responsabilités missions compétences salaire Afrique de l’Ouest XOF"
}
```

**Agent Output:**
```markdown
Préparons une fiche de poste complète et percutante.Voici une fiche de poste concise et opérationnelle.

Titre: Développeur Fullstack Junior (Node.js)
Mission: Concevoir, développer et maintenir des fonctionnalités web (backend Node.js, frontend React/Next.js), assurer la qualité, les tests et des déploiements fiables.
Responsabilités: Dév. fonctionnalités; tests unitaires/intégration; correction de bugs; revues de code; CI/CD basique; documentation.
Compétences requises: JavaScript/TypeScript; Node.js (Express/Nest); React/Next ou Vue; SQL/NoSQL; Git; Docker; Jest.
Atouts: GraphQL; AWS/DO; sécurité; monitoring; Next.js/NestJS avancé.
Profil: Bac+2/3 ou équivalent; 0–2 ans; portfolio/GitHub apprécié.
Rémunération indicative: 300 000–600 000 XOF/mois selon pays/secteur.

Souhaitez-vous que je génère cette fiche en PDF avec une mise en page professionnelle ?
```

---

#### ✅ Org — Publier offre stage (50061ms)

**Prompt:** `Publie une offre de stage en communication digitale a Abidjan, 3 mois`

**Calibration:** Verbosity=ok, Proactivity=passive, Chars=1500, Questions=0, Tools=0

**Agent Output:**
```markdown
Proposition d’offre de stage prête.

Stagiaire Communication Digitale
- Contrat : INTERNSHIP | Rythme : FULL_TIME
- Lieu : Abidjan, Côte d’Ivoire (ON_SITE)
- Description : Stage de 3 mois pour produire des contenus, animer les réseaux, piloter des campagnes et suivre la performance.
- Profil recherché : Licence/Master com/marketing, excellente rédaction, maîtrise réseaux sociaux, Canva/Adobe, notions analytics, rigueur.
- Atouts : SEO/SEA, montage vidéo, motion design, email marketing, HTML/CSS.

```confirmation
{"action":"publish_opportunity","entity_id":"6a80d332-9d56-489c-8314-b65746b4cd78","title":"Publier cette offre ?","description":"Stagiaire Communication Digitale - INTERNSHIP","confirm_label":"Publier","cancel_label":"Modifier","data":{"organization_id":"6a80d332-9d56-489c-8314-b65746b4cd78","title":"Stagiaire Communication Digitale","type":"INTERNSHIP","contract_type":"INTERNSHIP","work_rhythm":"FULL_TIME","location_type":"ON_SITE","locations":[{"city":"Abidjan","country":"CI"}],"summary":"Stage de 3 mois pour renforcer notre présence digitale : contenus, animation des réseaux, campagnes et reporting.","requirements":"Licence/Master communication ou marketing, excellente rédaction, réseaux sociaux, Canva/Adobe, notions analytics, rigueur.","nice_to_have":"SEO/SEA, montage vidéo, motion design, email marketing, HTML/CSS.","compensation_currency":"XOF","compensation_frequency":"MONTHLY","cv_required":true,"visibility":"PUBLIC","status":"OPEN","duration":"3 mois"}}
```
```

---

## Prompt Tuning Recommendations

- **Average response length:** 749 chars (target: 300-800)
- **Average questions per response:** 0.9 (target: 0-1)
- **Average tool calls per response:** 1.6 (target: 1-3)

