# Copilot Calibration Report

> Generated: 2026-02-07T02:40:54.284Z
> Tests: 14 | Passed: 14 | Failed: 0

## Calibration Summary

| Test | Agent | Chars | Questions | Tools | Verbosity | Proactivity | Quick Ack | Cards |
|------|-------|-------|-----------|-------|-----------|-------------|-----------|-------|
| ✅ Explorer — Opportunites matching profil | explorer | 937 | 1 | 3 | ok | proactive | ✅ | 6 |
| ✅ Explorer — Espaces coworking Abidjan | explorer | 542 | 1 | 1 | ok | proactive | ✅ | 3 |
| ✅ Explorer — Communautes tech | explorer | 766 | 1 | 1 | ok | proactive | ✅ | 5 |
| ✅ Explorer — Generer CV a jour | explorer | 304 | 1 | 5 | ok | proactive | ✅ | 1 |
| ✅ Explorer — Actualites communautes | explorer | 955 | 1 | 2 | ok | proactive | ✅ | 8 |
| ✅ Study — Debuter marketing digital | study | 1100 | 1 | 0 | ok | passive | N/A | 0 |
| ✅ Study — Diagnostic competences finance | study | 855 | 0 | 0 | ok | passive | N/A | 0 |
| ✅ Study — Expliquer le machine learning | study | 1242 | 1 | 0 | ok | passive | N/A | 0 |
| ✅ Study — Schema cycle de Krebs | study | 1250 | 1 | 1 | ok | proactive | ✅ | 0 |
| ✅ Study — Video YouTube agriculture durable | study | 851 | 1 | 1 | ok | proactive | ✅ | 0 |
| ✅ Org — Recruter profils marketing | org | 749 | 1 | 3 | ok | proactive | ✅ | 1 |
| ✅ Org — Dashboard organisation | org | 562 | 1 | 1 | ok | proactive | ✅ | 0 |
| ✅ Org — Generer fiche de poste | org | 692 | 1 | 2 | ok | proactive | ✅ | 0 |
| ✅ Org — Publier offre stage | org | 1657 | 0 | 0 | verbose | passive | N/A | 0 |

## Calibration Issues

### Too Verbose (>1500 chars)
- **Org — Publier offre stage**: 1657 chars, 6 sentences

### Not Proactive Enough
- **Study — Debuter marketing digital**: 0 tool calls, 1 questions asked
- **Study — Diagnostic competences finance**: 0 tool calls, 0 questions asked
- **Study — Expliquer le machine learning**: 0 tool calls, 1 questions asked
- **Org — Publier offre stage**: 0 tool calls, 0 questions asked

---

## Detailed Results

### Explorer Agent

#### ✅ Explorer — Opportunites matching profil (73658ms)

**Prompt:** `Quels postes correspondent a mon profil en ce moment ?`

**Calibration:** Verbosity=ok, Proactivity=proactive, Chars=937, Questions=1, Tools=3

**Tool: `vector_query`** (3261ms)
```json
{
  "query": "opportunités CDI CDD remote Abidjan Côte d’Ivoire Afrique francophone ventes stratégie go-to-market développement commercial key account management CRM pricing forecasting partenariats direction commerciale growth product management innovation IA santé healthtech biomédical bio-informatique gestion de projet consulting leadership management d’équipe francophone",
  "namespace": "opportunities",
  "topK": 15,
  "filtersJson": null
}
```

**Tool: `vector_query`** (2133ms)
```json
{
  "query": "opportunités Abidjan Côte d’Ivoire remote Afrique francophone business development manager key account manager responsable partenariats directeur commercial head of sales growth lead stratégie commerciale go-to-market CRM pipeline forecasting pricing développement de comptes clés consulting stratégie numérique innovation IA santé healthtech chef de projet biomédical responsable programme",
  "namespace": "opportunities",
  "topK": 20,
  "filtersJson": null
}
```

**Tool: `sql_query`** (5ms)
```json
{
  "intent": "search_opportunities",
  "paramsJson": "{\"q\":\"commercial business development partenariats account manager strategie Abidjan remote Cote d'Ivoire\",\"limit\":12}"
}
```

**Agent Output:**
```markdown
Voici des postes adaptés à votre profil.Votre profil rayonne en stratégie, développement commercial, innovation et santé/IA. Voici une sélection d’opportunités actuelles, locales et compatibles avec une ouverture au remote, où votre impact peut être déterminant.

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
{"id":"c0000004-0001-4000-c000-000000000001"}
```

```entity:opportunity
{"id":"c0000006-0001-4000-c000-000000000001"}
```

```entity:opportunity
{"id":"c0000001-0003-4000-c000-000000000003"}
```

Sélection axée go-to-market, développement de comptes clés, leadership entrepreneurial et pilotage de projets, en phase avec vos atouts (CRM, pricing, KPI, négociation) — souhaitez-vous privilégier santé/IA, digital ou secteur public ?
```

---

#### ✅ Explorer — Espaces coworking Abidjan (21201ms)

**Prompt:** `Je cherche un espace de travail calme sur Abidjan avec wifi`

**Calibration:** Verbosity=ok, Proactivity=proactive, Chars=542, Questions=1, Tools=1

**Tool: `vector_query`** (1385ms)
```json
{
  "query": "espace de travail calme wifi Abidjan Cocody Plateau Marcory Riviera coworking salle reunion open space focus silencieux fibre",
  "namespace": "spaces",
  "topK": 12,
  "filtersJson": null
}
```

**Agent Output:**
```markdown
Voici des espaces calmes avec wifi à Abidjan.Un havre de concentration avec wifi fiable est décisif pour réussir. Voici une sélection ciblée à Abidjan, propice au calme et à l’efficacité.

```entity:space
{"id":"f0000001-0001-4000-f000-000000000001"}
```

```entity:space
{"id":"f0000001-0004-4000-f000-000000000004"}
```

```entity:space
{"id":"f0000001-0002-4000-f000-000000000002"}
```

Sélection: fibre, espaces calmes, quartiers accessibles depuis Abobo.

Préférez-vous Cocody, Plateau ou Marcory pour que je vérifie les disponibilités ?
```

---

#### ✅ Explorer — Communautes tech (40582ms)

**Prompt:** `Quelles communautes tech actives existent a Abidjan ?`

**Calibration:** Verbosity=ok, Proactivity=proactive, Chars=766, Questions=1, Tools=1

**Tool: `vector_query`** (1950ms)
```json
{
  "query": "communautés tech actives Abidjan Côte d'Ivoire développeurs data IA startup entrepreneuriat produit growth no-code cybersécurité cloud Abobo",
  "namespace": "communities",
  "topK": 15,
  "filtersJson": null
}
```

**Agent Output:**
```markdown
Voici les meilleures communautés tech à Abidjan.Voici des communautés tech actives et pertinentes à Abidjan, idéales pour élargir votre réseau, croiser IA/data/produit et dynamiser vos projets. Sélection orientée vers IA, data, DevOps et agritech, en phase avec vos atouts en innovation, stratégie et entrepreneuriat.

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
{"id":"794cd334-5bbf-4180-a944-ab9eb428a2f4"}
```

Souhaitez-vous en rejoindre une maintenant ou voir d’autres options (cloud, cybersécurité) ?
```

---

#### ✅ Explorer — Generer CV a jour (94529ms)

**Prompt:** `Fais-moi un CV a jour stp`

**Calibration:** Verbosity=ok, Proactivity=proactive, Chars=304, Questions=1, Tools=5

**Tool: `sql_query`** (27ms)
```json
{
  "intent": "my_profile",
  "paramsJson": "{}"
}
```

**Tool: `sql_query`** (27ms)
```json
{
  "intent": "my_bookmarks",
  "paramsJson": "{}"
}
```

**Tool: `sql_query`** (26ms)
```json
{
  "intent": "my_documents",
  "paramsJson": "{}"
}
```

**Tool: `file_reader`** (24340ms)
```json
{
  "input": "ebb89c86-4144-4751-9bb4-f440cc136df1"
}
```

**Tool: `generate_document`** (103ms)
```json
{
  "format": "PDF",
  "title": "Curriculum Vitae — Lamine Barro",
  "contentJson": "{\"firstName\":\"Mohamed Lamine\",\"lastName\":\"Barro\",\"email\":\"succes1@gmail.com\",\"phone\":\"+2250574631148\",\"city\":\"Abidjan\",\"country\":\"Côte d’Ivoire\",\"bio\":\"Entrepreneur et stratège digital, j’oriente l’impact à l’intersection éducation, IA et politiques publiques. Leader d’écosystèmes, j’ai dirigé Etudesk, conseillé l’État de Côte d’Ivoire et catalysé des partenariats structurants. Profil data-driven, orienté résultats et création de valeur durable.\",\"skills\":[{\"name\":\"Entrepreneuriat\",\"type\":\"soft\",\"level\":\"expert\"},{\"name\":\"Leadership\",\"type\":\"soft\",\"level\":\"expert\"},{\"name\":\"Management d'équipe\",\"type\":\"soft\",\"level\":\"expert\"},{\"name\":\"Négociation grands comptes\",\"type\":\"soft\",\"level\":\"expert\"},{\"name\":\"Stratégie go-to-market\",\"type\":\"hard\",\"level\":\"expert\"},{\"name\":\"Stratégie commerciale\",\"type\":\"hard\",\"level\":\"expert\"},{\"name\":\"Stratégie numérique\",\"type\":\"hard\",\"level\":\"expert\"},{\"name\":\"Gestion de projet\",\"type\":\"soft\",\"level\":\"expert\"},{\"name\":\"Pilotage du pipeline\",\"type\":\"hard\",\"level\":\"intermediate\"},{\"name\":\"Gestion de CRM\",\"type\":\"hard\",\"level\":\"intermediate\"},{\"name\":\"Vente complexe\",\"type\":\"soft\",\"level\":\"expert\"},{\"name\":\"Pricing\",\"type\":\"hard\",\"level\":\"intermediate\"},{\"name\":\"Forecasting des ventes\",\"type\":\"hard\",\"level\":\"expert\"},{\"name\":\"Développement de solutions numériques\",\"type\":\"hard\",\"level\":\"expert\"},{\"name\":\"Analyse de données commerciales\",\"type\":\"hard\",\"level\":\"expert\"},{\"name\":\"Analyse de données biologiques\",\"type\":\"hard\",\"level\":\"expert\"},{\"name\":\"Bio-informatique\",\"type\":\"hard\",\"level\":\"intermediate\"},{\"name\":\"Intelligence artificielle\",\"type\":\"hard\",\"level\":\"intermediate\"},{\"name\":\"Communication\",\"type\":\"soft\",\"level\":\"expert\"},{\"name\":\"Communication scientifique\",\"type\":\"soft\",\"level\":\"expert\"},{\"name\":\"Mobilisation de fonds\",\"type\":\"soft\",\"level\":\"expert\"},{\"name\":\"Réseautage\",\"type\":\"soft\",\"level\":\"expert\"},{\"name\":\"Consulting\",\"type\":\"soft\",\"level\":\"expert\"}],\"languages\":[{\"language\":\"Français\",\"level\":\"natif\"}],\"interests\":[\"IA appliquée à l’éducation\",\"Politiques publiques\",\"Entrepreneuriat africain\"],\"goals\":[\"Apprendre de nouvelles compétences\",\"Développer mon réseau et ma visibilité\",\"Soutenir la recherche\"],\"experiences\":[{\"title\":\"Président / Directeur général\",\"company\":\"Etudesk\",\"location\":\"Abidjan\",\"period\":\"Mai 2016 – Présent\",\"description\":\"Direction stratégique et produit; partenariats institutionnels; levées de fonds; management transverse; industrialisation de l’employabilité via l’IA avec ministères et bailleurs internationaux.\"},{\"title\":\"Consultant & Ambassadeur de l’Innovation\",\"company\":\"Gouvernement de la République de Côte d’Ivoire\",\"location\":\"Abidjan\",\"period\":\"Déc. 2021 – Présent\",\"description\":\"Conseil à la Présidence, Primature et ministères sur l’innovation, économie numérique et entrepreneuriat des jeunes; cadrage de politiques publiques et programmes structurants.\"},{\"title\":\"Membre du conseil scientifique\",\"company\":\"Mission laïque française\",\"location\":\"International\",\"period\":\"Fév. 2021 – Présent\",\"description\":\"Contribution aux orientations scientifiques et éducatives; évaluation de projets et innovation pédagogique.\"},{\"title\":\"Vice-président & Membre fondateur\",\"company\":\"#CI20 (Écosystème startups CI)\",\"location\":\"Abidjan\",\"period\":\"Oct. 2020 – Présent\",\"description\":\"Plaidoyer et représentation de l’écosystème; coordination d’initiatives pour la croissance des startups ivoiriennes.\"},{\"title\":\"Président\",\"company\":\"Club informatique de l’UPGC\",\"location\":\"Korhogo\",\"period\":\"Déc. 2013 – Mars 2015\",\"description\":\"Animation de communauté; encadrement de projets étudiants en informatique; organisation d’événements tech.\"},{\"title\":\"MSP / Évangéliste technologiste\",\"company\":\"Microsoft WCA\",\"location\":\"Côte d’Ivoire\",\"period\":\"Janv. 2013 – Déc. 2014\",\"description\":\"Promotion des technologies Microsoft; interventions universitaires et communautés développeurs.\"},{\"title\":\"Président intérimaire\",\"company\":\"Interact Club Bietry\",\"location\":\"Abidjan\",\"period\":\"Juin 2010 – Août 2011\",\"description\":\"Leadership associatif; conception et mise en œuvre d’actions citoyennes.\"}],\"education\":[{\"degree\":\"Executive MBA (HEC Challenge Plus Afrique)\",\"institution\":\"HEC Paris\",\"location\":\"Paris / Abidjan\",\"period\":\"Mai 2022\",\"description\":\"Programme exécutif de 8 mois axé sur croissance, stratégie et innovation.\"},{\"degree\":\"Licence Sciences biologiques — spécialisation Bio-informatique\",\"institution\":\"Université Péléforo Gon Coulibaly (UPGC)\",\"location\":\"Korhogo\",\"period\":\"Oct. 2015\",\"description\":\"Parcours orienté data, bio-informatique et communication scientifique.\"}],\"certifications\":[{\"name\":\"Founder Institute\",\"issuer\":\"Founder Institute (Silicon Valley)\",\"date\":\"Juil. 2016\"}]}",
  "instructions": "Générer un CV élégant, moderne, 2 colonnes, en français, optimisé ATS. Mettre en avant entrepreneuriat, stratégie, IA, éducation et impact public. Inclure coordonnées complètes, compétences structurées (hard/soft + niveau), frise chronologique des expériences, et rubriques formation et certifications. Ton sobre, orienté résultats avec verbes d’action et indicateurs quantifiables quand disponibles."
}
```

**Agent Output:**
```markdown
Préparons votre CV professionnel.Votre CV est prêt, élégant et complet.

```entity:document
{"id":"04bcd6cb-70bc-4c85-90df-c31ff0a55cfb"}
```

Résumé: coordonnées actualisées, bio percutante, expériences, formation, certifications et compétences structurées. Souhaitez-vous aussi une version en anglais ?
```

---

#### ✅ Explorer — Actualites communautes (34099ms)

**Prompt:** `Quoi de neuf dans mes communautes cette semaine ?`

**Calibration:** Verbosity=ok, Proactivity=proactive, Chars=955, Questions=1, Tools=2

**Tool: `sql_query`** (15ms)
```json
{
  "intent": "my_communities",
  "paramsJson": "{}"
}
```

**Tool: `vector_query`** (1862ms)
```json
{
  "query": "communauté entrepreneuriat startups innovation stratégie numérique IA data Abidjan Côte d'Ivoire Afrique francophone santé numérique bio-informatique business développement commercial leadership réseau",
  "namespace": "communities",
  "topK": 8,
  "filtersJson": null
}
```

**Agent Output:**
```markdown
Voyons l’activité de vos communautés cette semaine.Voyons l’activité de vos communautés cette semaine.
Vous n’êtes membre d’aucune communauté pour l’instant, donc aucun fil cette semaine. Pour nourrir votre réseau en IA, data, entrepreneuriat et stratégie numérique à Abidjan, voici des communautés pertinentes à rejoindre.

```entity:community
{"id":"e0000001-0004-4000-e000-000000000004"}
```

```entity:community
{"id":"e0000001-0008-4000-e000-000000000008"}
```

```entity:community
{"id":"9c535835-20c7-4689-8555-b59dd2be7509"}
```

```entity:community
{"id":"15df926d-07b8-409d-ba93-35eb53fe414c"}
```

```entity:community
{"id":"b825f144-5fc6-4a79-af5d-dc3d28235bfc"}
```

```entity:community
{"id":"bdbc89e0-fff1-4a1c-9d1c-56d325359c3a"}
```

```entity:community
{"id":"e0000001-0001-4000-e000-000000000001"}
```

```entity:community
{"id":"e0000001-0003-4000-e000-000000000003"}
```

Souhaitez-vous que je prépare votre adhésion à l’une d’elles ?
```

---

### Study Agent

#### ✅ Study — Debuter marketing digital (20899ms)

**Prompt:** `Je debute en marketing digital, par ou commencer ?`

**Calibration:** Verbosity=ok, Proactivity=passive, Chars=1100, Questions=1, Tools=0

**Agent Output:**
```markdown
Le marketing digital repose sur quelques fondations essentielles.  
Commence par définir ton audience (persona) et ta proposition de valeur.  
Crée une page d’atterrissage claire avec appel à l’action et installe GA4 + Meta Pixel.  
Produis un contenu utile optimisé SEO, collecte des emails via un petit “lead magnet”.  
Choisis 1–2 canaux principaux (WhatsApp Business/Instagram en B2C, LinkedIn/email en B2B).  
Teste des pubs à 1 000–3 000 FCFA/jour et itère chaque semaine; ex: une boutique à Abidjan lance des reels locaux, offre -10% contre inscription, puis recibler.

```flashcard
{"topic":"Marketing digital — Débuts","front":"Quelles sont 6 étapes pour lancer ton marketing digital ?","back":"1) Persona + proposition de valeur. 2) Page d’atterrissage + tracking (GA4, Meta Pixel). 3) Lead magnet pour capter les emails. 4) Contenu SEO + social (1–2 canaux focus). 5) Email marketing de base (welcome + promo). 6) Tests publicitaires à petit budget + itérations hebdo basées sur les données.","difficulty":"easy"}
```

Quel est ton projet ou secteur pour que je t’adapte un plan 30 jours ?
```

---

#### ✅ Study — Diagnostic competences finance (14912ms)

**Prompt:** `Fais-moi un diagnostic de mes competences en finance d'entreprise`

**Calibration:** Verbosity=ok, Proactivity=passive, Chars=855, Questions=0, Tools=0

**Agent Output:**
```markdown
Diagnostic en finance d’entreprise, excellent choix.

La finance d’entreprise couvre trois piliers: décisions d’investissement (CAPEX, ROI), financement (dette vs equity, WACC) et gestion de trésorerie (liquidité, BFR). L’objectif est de créer de la valeur durable en gérant le risque et le cash. Exemple: une startup SaaS à Abidjan arbitre entre lever en equity ou contracter une dette locale, en comparant le coût du capital et l’impact sur la trésorerie. Pour poser ton diagnostic, on suit une évaluation express en 3 questions.

```quiz
{"topic":"Finance d’entreprise","question":"Quel est l’objectif principal de la finance d’entreprise ?","options":["Maximiser la valeur de l’entreprise à long terme","Maximiser le bénéfice net du prochain trimestre","Minimiser les impôts quel qu’en soit le coût","Augmenter la part de marché coûte que coûte"]}
```
```

---

#### ✅ Study — Expliquer le machine learning (14252ms)

**Prompt:** `Explique-moi le machine learning simplement`

**Calibration:** Verbosity=ok, Proactivity=passive, Chars=1242, Questions=1, Tools=0

**Agent Output:**
```markdown
Le machine learning apprend des modèles à partir des données.
C’est un ensemble d’algorithmes qui découvrent des régularités pour prédire ou décider, sans coder des règles à la main. Trois approches dominent: supervisé (prédire un prix, détecter du spam), non supervisé (segmenter des clients), et par renforcement (apprendre par essais/erreurs). Le cycle typique: collecter/nettoyer les données, les séparer train/test, choisir un modèle, entraîner, évaluer (précision, MAE…), déployer et surveiller le drift. Exemple concret: une fintech à Dakar anticipe le churn ou le risque crédit via l’historique des transactions; une coopérative agricole détecte des maladies des cultures depuis des photos smartphone.

```flashcard
{"topic":"Machine Learning - Bases","front":"Quelles sont les 3 grandes familles d’apprentissage en ML, et à quoi servent-elles ?","back":"• Supervisé: prédire une valeur/étiquette à partir d’exemples étiquetés (prix, fraude).\n• Non supervisé: découvrir des structures cachées (clustering clients, réduction de dimension).\n• Renforcement: apprendre une stratégie par récompenses (recommandations adaptatives, robotique).","difficulty":"medium"}
```

Tu préfères un schéma du cycle ML ou un mini-quiz pour pratiquer ?
```

---

#### ✅ Study — Schema cycle de Krebs (40846ms)

**Prompt:** `Dessine-moi le cycle de Krebs en biologie`

**Calibration:** Verbosity=ok, Proactivity=proactive, Chars=1250, Questions=1, Tools=1

**Tool: `generate_diagram`** (1ms)
```json
{
  "title": "Cycle de Krebs (TCA) — Vue synthétique",
  "diagramType": "flowchart",
  "mermaidCode": "flowchart TD\n  subgraph Cycle_de_Krebs [Cycle de Krebs — Matrice mitochondriale]\n    A[Oxaloacétate]\n    A -- + Acétyl-CoA (Citrate synthase) --> B[Citrate]\n    B -- Aconitase --> C[Isocitrate]\n    C -- NAD+ -> NADH + CO2 (Isocitrate déshydrogénase) --> D[α-cétoglutarate]\n    D -- NAD+ -> NADH + CO2 (α-cétoglutarate déshydrogénase) --> E[Succinyl-CoA]\n    E -- GDP+Pi -> GTP + CoA-SH (Succinyl-CoA synthétase) --> F[Succinate]\n    F -- FAD -> FADH2 (Succinate déshydrogénase) --> G[Fumarate]\n    G -- Hydratation (Fumarase) --> H[Malate]\n    H -- NAD+ -> NADH (Malate déshydrogénase) --> A\n  end\n  Z{{Bilan par tour\\n3 NADH, 1 FADH2,\\n1 GTP(ATP), 2 CO2}}\n  Cycle_de_Krebs -.-> Z"
}
```

**Agent Output:**
```markdown
Voici un schéma clair du cycle de Krebs.Le cycle de Krebs est au cœur du métabolisme énergétique. Il se déroule dans la matrice mitochondriale et oxyde l’acétyl-CoA en CO2. À chaque tour, il produit 3 NADH, 1 FADH2 et 1 GTP, qui alimentent la chaîne respiratoire pour générer de l’ATP. C’est crucial pour l’endurance musculaire et l’activité cérébrale, de l’athlète au chercheur.

```diagram
{"type":"flowchart","title":"Cycle de Krebs (TCA) — Vue synthétique","code":"flowchart TD\n  subgraph Cycle_de_Krebs [Cycle de Krebs — Matrice mitochondriale]\n    A[Oxaloacétate]\n    A -- + Acétyl-CoA (Citrate synthase) --> B[Citrate]\n    B -- Aconitase --> C[Isocitrate]\n    C -- NAD+ -> NADH + CO2 (Isocitrate déshydrogénase) --> D[α-cétoglutarate]\n    D -- NAD+ -> NADH + CO2 (α-cétoglutarate déshydrogénase) --> E[Succinyl-CoA]\n    E -- GDP+Pi -> GTP + CoA-SH (Succinyl-CoA synthétase) --> F[Succinate]\n    F -- FAD -> FADH2 (Succinate déshydrogénase) --> G[Fumarate]\n    G -- Hydratation (Fumarase) --> H[Malate]\n    H -- NAD+ -> NADH (Malate déshydrogénase) --> A\n  end\n  Z{{Bilan par tour\\n3 NADH, 1 FADH2,\\n1 GTP(ATP), 2 CO2}}\n  Cycle_de_Krebs -.-> Z"}
```

Souhaitez-vous aussi un schéma reliant glycolyse, PDH et chaîne respiratoire ?
```

---

#### ✅ Study — Video YouTube agriculture durable (19116ms)

**Prompt:** `Trouve-moi une bonne video YouTube sur l'agriculture durable`

**Calibration:** Verbosity=ok, Proactivity=proactive, Chars=851, Questions=1, Tools=1

**Tool: `youtube_search`** (705ms)
```json
{
  "query": "agriculture durable principes agroécologie tutoriel français débutant",
  "maxResults": 3
}
```

**Agent Output:**
```markdown
Bonne idée d’apprendre via une vidéo en français.L’agriculture durable gagne à être comprise en images. 
Cette vidéo (en français) présente clairement les leviers pour sortir du modèle intensif: agroécologie, rotations, couverts végétaux, santé des sols, et optimisation des intrants. Elle illustre les impacts climatiques et propose des actions concrètes pour démarrer de façon réaliste. Idéale pour un aperçu structuré avant d’aller vers des cas de terrain. Souhaitez-vous plutôt un focus Afrique de l’Ouest après ce visionnage ?

```youtube
{"videoId":"vtjMX5pawJ4","title":"[ LEARN ] - Agriculture durable : quelles pratiques pour sortir d’un modèle intensif ?","channelName":"Carbo","description":"Principes d’agriculture durable expliqués simplement : agroécologie, rotations, santé des sols, réduction des intrants et impacts climatiques."}
```
```

---

### Org Agent

#### ✅ Org — Recruter profils marketing (62960ms)

**Prompt:** `Trouve-moi 5 profils marketing digital seniors disponibles sur Abidjan`

**Calibration:** Verbosity=ok, Proactivity=proactive, Chars=749, Questions=1, Tools=3

**Tool: `vector_query`** (1635ms)
```json
{
  "query": "profils talents marketing digital senior Abidjan disponibilité immédiate SEO SEA Social Ads Facebook Ads Google Ads Analytics contenu growth manager stratégie acquisition CRM email francophone Côte d’Ivoire 8+ ans d’expérience",
  "namespace": "talents",
  "topK": 10,
  "filtersJson": null
}
```

**Tool: `vector_query`** (1696ms)
```json
{
  "query": "Abidjan Côte d’Ivoire talents marketing digital senior confirmé 7-15 ans SEO SEA Google Ads Facebook Ads Social Media Manager Performance Marketing Growth Marketer Content Strategist CRM Email Marketing Analytics GA4 Data Studio disponible immédiatement francophone",
  "namespace": "talents",
  "topK": 30,
  "filtersJson": null
}
```

**Tool: `sql_query`** (3ms)
```json
{
  "intent": "search_talents",
  "paramsJson": "{\"q\":\"marketing digital senior SEO SEA social media growth\",\"city\":\"Abidjan\",\"country\":\"CI\",\"availability\":\"AVAILABLE\",\"limit\":12}"
}
```

**Agent Output:**
```markdown
Recherchons des seniors marketing digital à Abidjan.Affinons la recherche pour plus de correspondances locales.Explorons aussi l’index structuré des talents.Voici les correspondances disponibles à Abidjan.
Notre base actuelle ne remonte qu’un seul profil répondant strictement aux critères (senior marketing digital, Abidjan, disponible). Pour atteindre 5, je peux étendre aux candidats prêts à se relocaliser ou en télétravail.

```entity:talent
{"id":"a1b2c3d4-3333-4000-a000-000000000003"}
```

- Pertinence: consultante marketing digital, 6 ans d’expérience, basée à Abidjan, disponibilité signalée.

Souhaitez-vous que j’élargisse la recherche (relocalisation/télétravail) pour vous proposer 5 à 10 profils seniors supplémentaires aujourd’hui ?
```

---

#### ✅ Org — Dashboard organisation (10148ms)

**Prompt:** `Comment se porte mon organisation ?`

**Calibration:** Verbosity=ok, Proactivity=proactive, Chars=562, Questions=1, Tools=1

**Tool: `sql_query`** (14ms)
```json
{
  "intent": "org_stats",
  "paramsJson": "{\"organizationId\":\"6a80d332-9d56-489c-8314-b65746b4cd78\"}"
}
```

**Agent Output:**
```markdown
Voici l’état de votre organisation.Voici l’état de votre organisation.

Synthèse: 1 membre actif, 0 offres ouvertes, 0 communautés et 0 espaces. La structure est saine mais sous‑exploitée; lancer une première offre ou communauté renforcerait votre dynamique.

```chart
{"type":"bar","title":"Indicateurs clés — Organisation Test","data":[{"label":"Membres","value":1},{"label":"Offres ouvertes","value":0},{"label":"Communautés","value":0},{"label":"Espaces","value":0}]}
```

Souhaitez-vous prioriser la publication d’une offre ou la création d’une communauté ?
```

---

#### ✅ Org — Generer fiche de poste (34756ms)

**Prompt:** `Redige une fiche de poste pour un developpeur fullstack junior Node.js`

**Calibration:** Verbosity=ok, Proactivity=proactive, Chars=692, Questions=1, Tools=2

**Tool: `sql_query`** (38ms)
```json
{
  "intent": "org_opportunities",
  "paramsJson": "{\"organizationId\":\"6a80d332-9d56-489c-8314-b65746b4cd78\"}"
}
```

**Tool: `sql_query`** (38ms)
```json
{
  "intent": "search_opportunities",
  "paramsJson": "{\"query\":\"developpeur fullstack junior Node.js\",\"limit\":8}"
}
```

**Agent Output:**
```markdown
Préparons une fiche de poste percutante.Voici une proposition de fiche de poste structurée.  
Aucune offre similaire trouvée chez Test ni sur la plateforme; je m’appuie sur un standard éprouvé du marché.  
Contenu prévu: Titre, Mission, Responsabilités (développement API REST/GraphQL, front React/Vue, BDD SQL/NoSQL, tests, CI/CD), Stack (Node.js, TypeScript, Express/NestJS, React, PostgreSQL, Git, Docker), Profil (bases solides JS/TS, 0–2 ans ou projets équivalents, logique, autonomie), Soft skills (rigueur, communication, apprentissage), Indicateurs 90j, Modalités (CDI, temps plein, présentiel/hybride), Processus (CV+GitHub, test court).  
Voulez-vous que je génère la fiche en PDF ?
```

---

#### ✅ Org — Publier offre stage (31406ms)

**Prompt:** `Publie une offre de stage en communication digitale a Abidjan, 3 mois`

**Calibration:** Verbosity=verbose, Proactivity=passive, Chars=1657, Questions=0, Tools=0

**Agent Output:**
```markdown
Proposition d’offre prête à publier.

Stagiaire Communication Digitale (3 mois)
- Contrat : Stage | Rythme : Temps plein
- Lieu : Abidjan, Côte d’Ivoire (Sur site)
- Description : Vous renforcerez notre présence en ligne via contenu, campagnes et reporting. Production social media, rédaction, animation de communautés et suivi des performances seront au cœur de la mission.
- Profil recherché : Licence en com/marketing, maîtrise réseaux sociaux, excellente rédaction, Canva/Adobe, bases analytics, rigueur et autonomie.
- Atouts : SEO, montage vidéo mobile, Meta/Google Ads, Figma/No‑code.

```confirmation
{"action":"publish_opportunity","entity_id":"6a80d332-9d56-489c-8314-b65746b4cd78","title":"Publier cette offre ?","description":"Stagiaire Communication Digitale — Stage (3 mois), Abidjan — Temps plein","confirm_label":"Publier","cancel_label":"Modifier","data":{"organization_id":"6a80d332-9d56-489c-8314-b65746b4cd78","title":"Stagiaire Communication Digitale","type":"INTERNSHIP","contract_type":"INTERNSHIP","work_rhythm":"FULL_TIME","location_type":"ON_SITE","locations":[{"city":"Abidjan","country":"Côte d’Ivoire"}],"summary":"Stage de 3 mois pour développer notre communication digitale : création de contenus, animation des réseaux et suivi des performances.","requirements":"Licence en communication/marketing, maîtrise réseaux sociaux, excellente rédaction, Canva/Adobe, notions d’analytics, orthographe irréprochable, autonomie.","nice_to_have":"SEO, montage vidéo mobile, Meta/Google Ads, Figma/No‑code.","duration":"3 mois","compensation_currency":"XOF","compensation_frequency":"MONTHLY","visibility":"PUBLIC","status":"OPEN"}}}
```
```

---

## Prompt Tuning Recommendations

- **Average response length:** 890 chars (target: 300-800)
- **Average questions per response:** 0.9 (target: 0-1)
- **Average tool calls per response:** 1.4 (target: 1-3)

