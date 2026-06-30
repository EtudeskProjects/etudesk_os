# Analyse statistique - Referentiel etudesk_digital_skills

> Analyse du catalogue de competences et du graphe d'adjacence.
> Catalog version : `2026-Q2` - Date d'analyse : 27 juin 2026.
> Source : `competency_catalog.csv` (1687 skills) + `competency_edges.csv` (8933 edges).
> Methode : pandas / numpy / networkx (degres, DAG, PageRank, betweenness, Louvain, Gini).

---

## Perimetre

| Mesure | Valeur |
|---|---:|
| Competences (skills) | 1 687 |
| Familles | 16 |
| Types | 5 |
| Relations (edges diriges) | 8 933 |
| Ratio edges/skill | 5,30 |
| Densite du reseau | 0,00314 |
| Orphelins (degre 0) | 0 |
| Prerequis acyclique (DAG) | Oui (valide) |

---

## Les 5 decouvertes les plus marquantes

### 1. Un vrai reseau "scale-free", pas un catalogue plat

La distribution des connexions suit une loi de puissance nette :

- Top 5% des competences = **24,6%** de toutes les liaisons
- Top 10% = **34,6%** ; Top 20% = **49,0%**
- Coefficient de **Gini = 0,42** (mediane de seulement 5 connexions, mais le hub max en porte 176)
- Assortativite de degre **negative (-0,08)** : les hubs se connectent aux petites competences, pas entre eux - signature exacte d'un reseau de connaissances naturel (type Wikipedia / web).

Conclusion : ce n'est pas une taxonomie fabriquee, c'est un ecosysteme.

### 2. Le noyau gravitationnel tient en ~10 competences (maths + software, pas l'IA)

PageRank et in-degree convergent sur le meme socle.

| Rang | Competence | Pointee par | Type |
|---|---|---:|---|
| 1 | Python | 171 | language |
| 2 | Machine Learning Fundamentals | 149 | knowledge |
| 3 | Statistics | 143 | knowledge |
| 4 | Cryptography | 104 | knowledge |
| 5 | SQL | 101 | language |
| 6 | Data Analytics | 98 | hard_skill |
| 7 | Networking Fundamentals | 90 | knowledge |
| 8 | Data Modeling | 89 | hard_skill |
| 9 | Clean Code Principles | 83 | knowledge |
| 10 | Software Architecture | 80 | knowledge |

En PageRank pur, **Linear Algebra, Statistics et Probability Theory** dominent : la colonne vertebrale reelle du catalogue est la donnee et les maths, pas les outils a la mode.

### 3. La plus longue chaine d'apprentissage fait 13 niveaux

Le DAG des prerequis revele un parcours pedagogique profond :

> Git -> Version Control Workflows -> Python -> Data Analytics -> Bayesian Analysis -> Linear Algebra -> Machine Learning Fundamentals -> Deep Learning Model Training -> Neural Network Architectures -> Transformer -> Foundation Models -> Model Fine-tuning -> Low-Rank Adaptation (LoRA)

Un curriculum sequence de 13 paliers existe deja implicitement dans le graphe : Etudesk peut generer des parcours certifiants sans travail manuel.

### 4. 60% de ce qu'on doit apprendre en premier est du knowledge, pas des outils

Decomposition des 1 833 prerequis par type de la cible (to_slug) :

| Type prerequis | Part |
|---|---:|
| knowledge | 60% |
| hard_skill | 19% |
| language | 14% |
| tool_platform | 7% |

Insight strategique : les outils (Docker, SaaS) sont des feuilles, jamais des fondations. Le referentiel valorise les concepts durables avant les technologies perissables - argument de vente fort face aux bootcamps "outils".

### 5. Le graphe se separe proprement en 15 communautes (modularite 0,747)

La detection Louvain retrouve quasiment les familles metier sans les connaitre (assortativite famille = 0,75).

| Communaute | Taille | Purete | Famille dominante |
|---|---:|---:|---|
| C01 | 195 | 83% | ai_ml_automation |
| C02 | 180 | 72% | marketing_sales_content |
| C03 | 172 | 93% | software_engineering |
| C04 | 135 | 95% | cybersecurity_digital_trust |
| C05 | 135 | 88% | data_analytics_bi |
| C06 | 127 | 62% | sustainability + industry/hardware (hybride) |
| C07 | 122 | 48% | business_operations + industry/hardware (hybride) |
| C08 | 109 | 41% | product_ux + marketing (hybride) |

Deux communautes hybrides signalent des metiers emergents : la greentech/agritech materielle (sustainability + hardware) et le profil growth/product moderne (UX + marketing).

---

## Insights structurels complementaires

### Repartition par type

| Type | Nombre | Part |
|---|---:|---:|
| hard_skill | 636 | 37,7% |
| tool_platform | 558 | 33,1% |
| knowledge | 321 | 19,0% |
| soft_skill | 92 | 5,5% |
| language | 80 | 4,7% |

### Repartition par famille (top)

| Famille | Skills | Part |
|---|---:|---:|
| ai_ml_automation | 180 | 10,7% |
| software_engineering | 178 | 10,6% |
| marketing_sales_content | 162 | 9,6% |
| cybersecurity_digital_trust | 133 | 7,9% |
| industry_hardware_mobility | 132 | 7,8% |
| data_analytics_bi | 130 | 7,7% |
| (... 10 autres familles) | | |
| health_biotech_medtech | 32 | 1,9% |

### Relations du graphe

| Relation | Edges | Part | Strength moyen |
|---|---:|---:|---:|
| co_occurrence | 4 260 | 47,7% | 0,581 |
| sibling | 2 840 | 31,8% | 0,605 |
| prerequisite | 1 833 | 20,5% | 0,693 |

### Ponts inter-familles (ou naissent les metiers hybrides)

22,5% des liens sont inter-familles. Les plus charges :

| Edges | Familles connectees |
|---:|---|
| 120 | data_analytics_bi <-> software_engineering |
| 110 | cloud_devops <-> cybersecurity |
| 97 | ai_ml_automation <-> software_engineering |
| 88 | ai_ml_automation <-> data_analytics_bi |
| 88 | data_analytics_bi <-> law_compliance (signal data governance) |
| 76 | cloud_devops <-> software_engineering |

### Familles les plus ouvertes (transversales) vs silos

| Famille | % liens sortants vers d'autres familles |
|---|---:|
| law_compliance_governance | 40,7% (infuse partout) |
| ai_ml_automation | 35,9% |
| business_operations_management | 33,9% |
| ... | |
| marketing_sales_content | 15,3% (silo) |
| cloud_devops_infrastructure | 14,2% (silo) |

### Densite de relations par famille

Data/BI est la mieux connectee (13,2 liens/skill, au-dessus de la moyenne de 10,6) : le tissu conjonctif du referentiel. IA/ML est parmi les moins denses (6,5) malgre sa taille de premiere famille - beaucoup de competences de pointe specialisees et terminales.

### Competences-pont critiques (betweenness)

Celles qui gardent les passages entre univers - les retirer fragmenterait le graphe : Python (0,155), Machine Learning Fundamentals (0,095), Statistics (0,092), Cryptography, Networking Fundamentals, Threat Modeling.

### Socles fondamentaux (sinks du DAG de prerequis)

Competences requises par le plus grand nombre d'autres : Networking Fundamentals (82), Cryptography (80), SQL (75), Software Architecture (67), Clean Code Principles (66), Git (64), Design Patterns (61).

### Frontiere d'innovation (competences terminales de pointe)

Dominees a ~77% par l'IA/ML : Low-Rank Adaptation (profondeur 12), Model Fine-tuning, Retrieval-Augmented Generation, LLM Evaluation & Benchmarking, Foundation Models (niveau 10-11). Le referentiel pousse vers l'IA generative comme aboutissement.

---

## Lecture business pour Etudesk

1. Le catalogue est mur et coherent (DAG valide, 0 orphelin, modularite 0,75) - defendable face a ESCO / SFIA / Lightcast lors d'une levee ou d'un partenariat institutionnel.
2. Argument differenciant : "concepts avant outils" (60% de prerequis = knowledge) - positionnement premium contre les bootcamps.
3. Produit immediat : les 13 paliers de prerequis = generateur de parcours certifiants automatique.
4. Angle CI20 / souverainete : le socle reel (maths + data + Python) est universel et peu couteux a enseigner - adapte au deploiement des hubs communaux (ADA / Abobo).

---

---

## Annexe - Analyse de graphe avancee

> k-core, robustesse, profondeur pedagogique, redondance, detection de liens manquants, anomalies structurelles.

### A. K-core : le coeur irreductible est la gouvernance de la donnee

Decomposition en k-cores (un k-core = sous-graphe ou chaque noeud a au moins k voisins eux-memes dans le coeur). k-core maximal = **12**.

| Core | Skills | Familles dominantes |
|---|---:|---|
| 12-core | 21 | data_analytics_bi (18), law_compliance (2) |
| 11-core | 55 | data_analytics_bi (34), cybersecurity (17) |
| 10-core | 86 | data_analytics_bi (39), cybersecurity (20), software_eng (19) |

Decouverte forte : le **12-core (coeur irreductible) est presque entierement de la data engineering / gouvernance** : Data Modeling, Data Catalog Management, Data Governance, Data Contract Design, Data Quality Engineering, Data Lakehouse Architecture, Data Pipeline Engineering... Le coeur le plus dense du referentiel n'est ni l'IA ni le code applicatif, mais **l'infrastructure et la gouvernance de la donnee** - exactement la couche qui rend une economie data-driven gouvernable. Cadre parfaitement avec un positionnement institutionnel (Etat / CI20).

### B. Robustesse : reseau resilient mais vulnerable aux attaques ciblees

Composante geante initiale = 100%. Test de retrait :

| Action | Composante geante restante |
|---|---:|
| Retrait 1% plus gros hubs (17) | 98,3% |
| Retrait 5% plus gros hubs (84) | 90,6% |
| Retrait 10% plus gros hubs (169) | 83,0% |
| Retrait 10% **aleatoire** | 89,9% |

Le graphe encaisse les pannes aleatoires (a 10% retire au hasard, 99,9% des noeuds restants tiennent dans la composante geante) mais se fragmente nettement plus sous attaque ciblee des hubs (~7 points de plus perdus) - signature classique d'un reseau scale-free. Traduction produit : **maitriser une poignee de competences-socles donne acces a la quasi-totalite du referentiel.**

### C. Cohesion locale

- Clustering moyen : **0,397** | Transitivite globale : 0,170 | **7 725 triangles fermes**.
- Clustering eleve = les prerequis se recoupent en grappes coherentes : les parcours d'apprentissage ne sont pas des chaines isolees mais des reseaux qui se renforcent.

### D. Profondeur pedagogique (rang topologique dans le DAG des prerequis)

Niveau 0 = socle fondamental (rien en dessous), niveau croissant = a apprendre plus tard. 775 competences participent au DAG des prerequis.

| Niveau | Skills | |
|---:|---:|---|
| 0 (socles) | 124 | fondations directes |
| 1 | 217 | pic de distribution |
| 2-4 | 303 | competences intermediaires |
| 5-8 | 119 | specialisation |
| 9-12 | 12 | pointe (IA generative) |

Les 12 skills les plus profonds sont quasi tous en **ai_ml_automation** : LoRA (niveau 12), Model Fine-tuning, RAG, LLM Evaluation, Foundation Models (niveau 10-11). Le referentiel a une structure pyramidale claire : large base de fondamentaux, sommet etroit d'IA de pointe.

### E. Redondance : 39% des prerequis sont transitifs

Reduction transitive du DAG : **1 833 prerequis directs -> 1 122 apres reduction = 711 aretes transitives (38,8%)**.

Exemples : `A/B Testing -> Python` est redondant car A/B Testing -> Statistics -> Python existe deja. Ces 711 aretes sont impliquees par transitivite. Decision a prendre : les **garder** (raccourcis explicites, utiles a l'inference directe et a l'UX d'apprentissage) ou les **elaguer** (graphe minimal, prerequis "immediats" seulement). Recommandation : garder, car l'inference deterministe du runtime beneficie des raccourcis - mais documenter le choix.

### F. Liens manquants suggeres (gaps structurels)

180 paires intra-famille fortement similaires (skills de degre >=8 des deux cotes, >=6 voisins communs, Jaccard >=0,40) mais **non reliees**. Les plus probables a ajouter :

| Jaccard | Voisins communs | Paire suggeree |
|---:|---:|---|
| 0,79 | 11 | People Analytics <-> Web Analytics |
| 0,73 | 61 | Design Patterns <-> Version Control Workflows |
| 0,73 | 11 | Inventory Analytics <-> Web Analytics |
| 0,71 | 12 | Data Cleaning & Wrangling <-> Marine Data Acquisition |
| 0,69 | 62 | Software Architecture <-> Version Control Workflows |
| 0,69 | 9 | Grid Analytics <-> Web Analytics |

Que Software Architecture et Design Patterns partagent ~60 voisins avec Version Control Workflows sans etre directement relies est l'anomalie la plus probable (relation `sibling` manquante en software engineering). Candidats concrets pour enrichir `competency_edges.csv`. NB : a valider a la main - certaines absences sont voulues (sinks fondamentaux non relies entre eux).

### G. Anomalies structurelles

- **Skills a 1 seule connexion (fragiles)** : aucun dans tout le catalogue - couverture excellente.
- **Ponts critiques** (aretes dont le retrait deconnecterait le graphe) : 1 seul -> `Circular Design -- Life Cycle Assessment`. Cette niche greentech tient a un fil unique : a renforcer.
- **Points d'articulation** (5) : Cross-cultural Communication, Circular Design, Life Cycle Assessment, Drone Flight Operations, Generative AI Content Production. Ces noeuds connectent des sous-domaines entiers au reste du graphe - a surveiller en priorite lors des mises a jour.

### Synthese de l'annexe

Le graphe est **dense au coeur (data governance), pyramidal en profondeur (fondamentaux -> IA), resilient aux pannes mais sensible aux hubs**, avec une qualite de couverture remarquable (0 skill fragile, 1 seul pont critique). Les leviers d'amelioration sont cibles : quelques liens `sibling` evidents a ajouter en software engineering, et la niche greentech (Circular Design / Life Cycle Assessment) a desenclaver.

---

## Reproductibilite

Scripts d'analyse (pandas + networkx) generes pour cette etude :
- Niveau 1 (volumetrie, degres, DAG, PageRank, betweenness, Louvain, Gini) ;
- Niveau 2 (k-core, robustesse, profondeur topologique, reduction transitive, gaps Jaccard, ponts/articulations).

Metriques recalculables a chaque release. A relancer apres toute mise a jour de `competency_edges.csv` ou `competency_catalog.csv`, idealement en complement de `validate_edges.py`.
