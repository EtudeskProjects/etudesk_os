# Etudesk - Documentation Technique Complète

> **Version:** 2.0.0 | **Date:** 14 Février 2026 | **Branche:** deploy/production

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Cibles & Positionnement](#2-cibles--positionnement)
3. [Taille du marché UEMOA](#3-taille-du-marché-uemoa)
4. [Le Grand Dégroupage — Pourquoi maintenant](#4-le-grand-dégroupage--pourquoi-maintenant)
5. [Pricing & Plans d'abonnement](#5-pricing--plans-dabonnement)
6. [Architecture technique](#6-architecture-technique)
7. [Stack technologique](#7-stack-technologique)
8. [Backend — Architecture serveur](#8-backend--architecture-serveur)
9. [Base de données PostgreSQL](#9-base-de-données-postgresql)
10. [API REST — Endpoints complets](#10-api-rest--endpoints-complets)
11. [Authentification & Sécurité](#11-authentification--sécurité)
12. [Copilote IA — Architecture agents](#12-copilote-ia--architecture-agents)
13. [Copilote — Outils (10 tools)](#13-copilote--outils-10-tools)
14. [Copilote — Guardrails](#14-copilote--guardrails)
15. [Copilote — Skills Library](#15-copilote--skills-library)
16. [Copilote — Streaming SSE](#16-copilote--streaming-sse)
17. [Copilote — Actions & Confirmation](#17-copilote--actions--confirmation)
18. [Application mobile React Native](#18-application-mobile-react-native)
19. [Application web Next.js](#19-application-web-nextjs)
20. [Intégrations externes](#20-intégrations-externes)
21. [Infrastructure & Déploiement](#21-infrastructure--déploiement)
22. [Programme d'affiliation](#22-programme-daffiliation)
23. [Annexes](#23-annexes)

---

## 1. Vue d'ensemble

### Qu'est-ce qu'Etudesk ?

**Etudesk** est une plateforme intelligente de gestion de talents et d'opportunités professionnelles, propulsée par l'IA. Elle connecte talents (étudiants, professionnels, chercheurs d'emploi, entrepreneurs) avec des organisations (entreprises, startups, agences gouvernementales) à travers un copilote IA conversationnel.

### Mission

Démocratiser l'accès aux opportunités professionnelles en Afrique de l'Ouest (zone UEMOA) grâce à l'intelligence artificielle.

### Produit

| Composant | Description |
|-----------|-------------|
| **Copilote IA** | Assistant conversationnel multi-agent (Explorer, Etudier, Organisation) |
| **Marketplace** | Offres d'emploi, stages, freelance, communautés, espaces de coworking |
| **Gestion d'organisation** | Dashboard pour recruteurs, publication d'offres, gestion de talents |
| **Apprentissage** | Mode Study avec quiz, flashcards, diagrammes, vidéos YouTube |
| **Documents IA** | Génération de CV, lettres de motivation, fiches de poste |

### Architecture monorepo

```
etudesk-vf/
├── backend/          # API Node.js + Express + TypeScript
├── mobile/           # React Native (Expo) — app principale
├── web/              # Next.js 15 — site vitrine / landing
└── docs/             # Documentation technique
```

---

## 2. Cibles & Positionnement

### Segments de marché

| Segment | Cible | Volume estimé | Profil type |
|---------|-------|---------------|-------------|
| **Discover** | Grand public | 1M utilisateurs | Étudiants, chercheurs d'emploi, curieux |
| **Talent** | Professionnels actifs | 100K utilisateurs | Professionnels, entrepreneurs, freelances |
| **Pro** | PME & Consultants | 10K utilisateurs | Startups, cabinets de conseil, SME |
| **Corporate** | Grandes entreprises | 500 organisations | Multinationales, agences gouvernementales |

### Zones géographiques

- **Primaire :** Zone UEMOA (Côte d'Ivoire, Sénégal, Mali, Burkina Faso, Togo, Bénin, Niger, Guinée-Bissau)
- **Secondaire :** Afrique francophone élargie
- **Langues :** Français (principal), Anglais

---

## 3. Taille du marché UEMOA

### 3.1 Vue macro-économique de la zone UEMOA

La zone UEMOA (Union Economique et Monétaire Ouest Africaine) regroupe **8 pays** partageant le franc CFA : Bénin, Burkina Faso, Côte d'Ivoire, Guinée-Bissau, Mali, Niger, Sénégal et Togo.

| Indicateur | Valeur (2024-2025) | Source |
|------------|-------------------|--------|
| **Population totale** | ~137 millions d'habitants | [UNCTAD 2024](https://unctad.org/news/unctad-charts-path-inclusive-growth-west-african-economic-and-monetary-union) |
| **PIB combiné** | ~175 milliards USD | UNCTAD 2024 |
| **Part du marché subsaharien** | 9% du PIB d'Afrique subsaharienne | UNCTAD 2024 |
| **Croissance PIB moyenne** | 5-6% par an | FMI / Banque Mondiale |
| **IDE (flux entrants)** | 5,5 milliards USD (2022) | UNCTAD World Investment Report 2024 |
| **Age médian** | 15-19 ans selon les pays | Worldometers |
| **Population < 25 ans** | 60%+ | UNFPA |

### 3.2 Données par pays

| Pays | Population (M) | PIB (Mds USD) | Croissance | Age médian |
|------|---------------|---------------|------------|------------|
| **Côte d'Ivoire** | 29,4 | 78,8 | 6,5% | 18,9 |
| **Sénégal** | 18,1 | 31,0 | 8,4% | 19,4 |
| **Mali** | 23,3 | 26,6 | 4,9% | 16,3 |
| **Burkina Faso** | 23,0 | 21,4 | 5,0% | 17,0 |
| **Niger** | 27,2 | 17,1 | 5,2% | 15,1 |
| **Bénin** | 13,7 | 19,2 | 6,0% | 18,4 |
| **Togo** | 9,1 | 9,4 | 5,3% | 19,8 |
| **Guinée-Bissau** | 2,2 | 2,0 | 4,5% | 19,1 |

*Sources : FMI, Banque Mondiale, StatisticsTimes (2024)*

### 3.3 Education & Formation

| Indicateur | Données UEMOA | Source |
|------------|--------------|--------|
| **Taux d'inscription tertiaire** | ~7% en Afrique subsaharienne (vs 32% mondial) | [UNESCO](https://www.unesco.org/en/articles/what-you-need-know-about-higher-education-africa) |
| **Universités publiques & privées** | ~250+ dans la zone UEMOA | Wikipedia / sources nationales |
| **Ecoles (Côte d'Ivoire seule)** | 19 470 établissements, 105 004 salles de classe | Ministère Education CI (2022-2023) |
| **Nouvelles écoles CI (2024-2025)** | +118 préscolaires, +279 primaires, +79 collèges | MENA Côte d'Ivoire |
| **Centres de formation professionnelle** | ~1 500+ dans la zone (estimé) | Sources nationales |
| **Etudiants enseignement supérieur** | ~3-4 millions dans la zone (projeté 2025) | UNESCO / extrapolation |
| **Dépenses éducation (% PIB)** | 3,5%-5,5% selon les pays | [Banque Mondiale](https://data.worldbank.org/indicator/SE.XPD.TOTL.GD.ZS) |
| **Universités francophones (AUF)** | 1 007 universités dans 119 pays | [AUF](https://journals.openedition.org/poldev/1790) |

**Projection critique :** Entre 2020 et 2040, le nombre de jeunes Africains achevant l'enseignement secondaire ou supérieur devrait **doubler de 103M à 240M**. Le systeme universitaire traditionnel ne peut pas absorber cette croissance.

### 3.4 Emploi & Talents

| Indicateur | Données | Source |
|------------|---------|--------|
| **Chômage des jeunes (Afrique)** | ~12,7% (2024), estimation basse | [Banque Mondiale](https://data.worldbank.org/) |
| **Chômage des jeunes (Sénégal)** | >50% | Banque Mondiale |
| **Taux NEET (Sénégal)** | 34,9% | ILO/Banque Mondiale |
| **Jeunes entrant sur le marché/an** | 10-12 millions en Afrique | Forum Economique Mondial |
| **Freelancers Afrique** | Croissance de 55% depuis 2020 | [Brookings](https://www.brookings.edu/articles/africas-growing-gig-economy-what-is-needed-for-success/) |
| **Gig economy** | Croissance de 11% annuel | Brookings |
| **Emplois digitaux (projection 2030)** | +42% de croissance | Banque Mondiale |
| **Potentiel gig economy** | +2,9 milliards USD/an au PIB africain | Banque Mondiale |

### 3.5 Economie numérique & Connectivité

| Indicateur | Données | Source |
|------------|---------|--------|
| **Utilisateurs internet mobile (Afrique)** | 416 millions | [GSMA 2025](https://www.gsma.com/solutions-and-impact/connectivity-for-good/mobile-economy/africa/) |
| **Contribution mobile au PIB (Afrique)** | 7,7% = 220 milliards USD (2024) | GSMA 2025 |
| **Pénétration mobile (Côte d'Ivoire)** | 185% (58,7M abonnés) | GSMA |
| **Couverture 4G (Côte d'Ivoire)** | 88%+ | Opérateurs CI |
| **4G adoption (Afrique subsaharienne)** | Projeté 50% d'ici 2030 | GSMA |
| **Gap d'usage** | 960M de personnes (64%) couvertes mais non connectées | GSMA |
| **Starlink** | Opérationnel dans 25+ pays africains (fin 2025) | [TeleGeography](https://blog.telegeography.com/starlink-expanding-in-africa) |
| **Mobile money** | Adoption massive zone UEMOA (Orange Money, Wave, MTN) | BCEAO |

### 3.6 Startups, Hubs & Innovation

| Indicateur | Données | Source |
|------------|---------|--------|
| **Espaces de coworking (Afrique)** | 500+ espaces vérifiés | [AllWork](https://allwork.space/2025/05/africa-surpasses-500-coworking-spaces-as-remote-work-and-startups-drive-surge/) |
| **Marché coworking africain** | 446,9M USD (2023) → 1,56 Mds USD (2030) | [Coworking Europe](https://coworkingeurope.net/2024/05/24/african-coworking-market-to-triple-in-size-by-2030-from-u446-9-mio-value-in-2023-to-u156-bio/) |
| **Taux d'occupation moyen** | >80% dans les grandes villes | Coworking Europe |
| **Financement tech Afrique (2024)** | 3,2 milliards USD | [Partech](https://partechpartners.com/africa-reports/2024-africa-tech-venture-capital-report) |
| **Financement tech Afrique (2025)** | 4,1 milliards USD (+25% YoY) | [Partech 2025](https://partechpartners.com/africa-reports/2025-africa-tech-venture-capital-report) |
| **Startups Côte d'Ivoire (2024)** | 350M USD levés (+60% YoY) | [StatsAndMarketInsights](https://www.statsandmarketinsights.com/blog/79/ivory-coast-startup-ecosystem-in-2025-a-year-of-resilience-and-transformation) |
| **Afrique francophone** | 55% du volume de financement equity (hors Big 4) | Partech 2025 |
| **Acteurs coworking UEMOA** | AfricaWorks (Abidjan, Dakar), Impact Hub (Abidjan, Dakar) | Sites officiels |

### 3.7 EdTech en Afrique

| Indicateur | Données | Source |
|------------|---------|--------|
| **Marché EdTech Afrique** | 7,33 Mds USD (2025) → 19,25 Mds USD (2034) | [IMARC Group](https://www.imarcgroup.com/africa-edtech-market) |
| **E-learning Afrique** | 3,4 Mds USD (2024) → 7,7 Mds USD (2033) | [IMARC](https://www.imarcgroup.com/africa-e-learning-market) |
| **Etudiants sur plateformes digitales** | 5M (2018) → 50M+ (2024) — x10 en 6 ans | [DigitalDefynd](https://digitaldefynd.com/IQ/africa-edtech-statistics/) |
| **Creator economy Afrique** | 5,10 Mds USD (2025) → 29,84 Mds USD (2032) | [Coherent MI](https://www.coherentmi.com/industry-reports/africa-creator-economy-market) |
| **Marché credentials alternatifs** | 18,83 Mds USD (2024) → 69,88 Mds USD (2032) | [Fortune BI](https://www.fortunebusinessinsights.com/alternative-credentials-market-110785) |
| **Micro-credentials** | 2,1 Mds USD (2024) → 10,6 Mds USD (2033) | [Growth Market Reports](https://growthmarketreports.com/report/micro-credentials-market) |

### 3.8 Marché adressable par Etudesk

| Segment | TAM (UEMOA) | SAM | SOM (an 3) |
|---------|-------------|-----|------------|
| **Discover** (gratuit) | 137M population | ~30M jeunes connectés | 1M utilisateurs |
| **Talent** (5K FCFA) | ~15M professionnels actifs | ~3M avec smartphone | 100K utilisateurs |
| **Pro** (25K FCFA) | ~500K PME/startups | ~100K digitalisées | 10K utilisateurs |
| **Corporate** (500K FCFA) | ~5K grandes entreprises | ~1K avec budget RH digital | 500 organisations |

**Revenu potentiel annuel (an 3) :**
- Talent : 100K x 5 000 FCFA x 12 = **6 milliards FCFA** (~9,1M USD)
- Pro : 10K x 25 000 FCFA x 12 = **3 milliards FCFA** (~4,6M USD)
- Corporate : 500 x 500 000 FCFA x 12 = **3 milliards FCFA** (~4,6M USD)
- **Total potentiel : ~12 milliards FCFA (~18,3M USD/an)**

---

## 4. Le Grand Dégroupage — Pourquoi maintenant

### 4.1 La thèse du dégroupage universitaire

Le "Grand Dégroupage" (*The Great Unbundling*) est la désagrégation progressive de l'université traditionnelle en services indépendants, chacun pouvant être mieux servi par un acteur spécialisé.

**L'université traditionnelle regroupe :**
- Contenus (cours, conférences)
- Accréditation (diplômes, certificats)
- Réseau social (vie de campus, communautés)
- Services carrière (orientation, placement)
- Infrastructure (campus, bibliothèques, logements)
- Services étudiants (santé, restauration, sport)

**Penseurs clés :**
- **Clayton Christensen** (Harvard) : théorie de l'innovation disruptive appliquée à l'éducation — prédit que la moitié des universités américaines pourraient faire faillite en 10-15 ans
- **Scott Galloway** (NYU Stern) : le coût est le problème central — les frais de scolarité ont augmenté de 53% (public) et 32% (privé) entre 2000 et 2025 (ajusté inflation)
- **Ryan Craig** (*College Disrupted*) : documente comment bootcamps, micro-credentials et cours en ligne démantèlent chaque composante de l'université

### 4.2 Pourquoi le dégroupage frappe plus fort en Afrique

- **Taux d'inscription tertiaire : ~7%** en Afrique subsaharienne (vs 32% mondial)
- Les inscriptions ont doublé de 2,3M à 5,2M entre 2000-2010, mais la **qualité s'est détériorée** (sous-financement, surpopulation, ratio étudiants/enseignants)
- D'ici 2040, les jeunes Africains terminant le secondaire/supérieur doubleront de **103M à 240M** — le système traditionnel ne peut pas absorber cette croissance
- Le modèle universitaire traditionnel **ne scale tout simplement pas** pour la demande africaine

### 4.3 Les 7 vecteurs du dégroupage

#### Campus → Espaces de coworking & Hubs

| Ancien modèle | Nouveau modèle | Données |
|--------------|----------------|---------|
| Campus physique fixe | Coworking flexible on-demand | 500+ espaces en Afrique |
| Emploi du temps rigide | Accès 24/7 | Taux d'occupation >80% |
| Investissement immobilier lourd | Modèle asset-light | Marché : 447M → 1,56 Mds USD (2030) |

**Acteurs UEMOA :** AfricaWorks (Abidjan, Dakar — 20+ espaces, 1000+ clients corporate), Impact Hub (Abidjan, Dakar), Regus/IWG (en expansion)

#### Professeurs → Experts indépendants en ligne

| Ancien modèle | Nouveau modèle | Données |
|--------------|----------------|---------|
| Professeur titulaire | Créateur de contenu / expert freelance | Creator economy Afrique : 5,1 Mds → 29,8 Mds USD (2032) |
| Cours magistral | Cours en ligne, YouTube, tutoring IA | 385M utilisateurs réseaux sociaux en Afrique |
| Recherche académique | Expertise pratique à la demande | 51,3% des créateurs africains ont 18-24 ans |

**Dynamique :** Le ratio étudiants/professeur critique dans les universités africaines rend ce dégroupage particulièrement urgent. Un expert en ligne peut toucher 10 000x plus d'étudiants.

#### Communautés éducatives → Communautés digitales

| Ancien modèle | Nouveau modèle | Données |
|--------------|----------------|---------|
| Association étudiante | Groupe WhatsApp/Telegram | +189% croissance communautés Telegram en Afrique (2023-2024) |
| Réseau alumni | LinkedIn / plateforme communautaire | 3M+ utilisateurs dans les groupes Telegram africains |
| Club universitaire | Communauté Discord / Slack | 55%+ des membres ont moins de 25 ans |

**Dynamique en UEMOA :** WhatsApp est la plateforme dominante. Les communautés professionnelles se forment naturellement en ligne, remplaçant les associations d'anciens élèves traditionnelles.

#### Cours et leçons → E-learning & IA

| Ancien modèle | Nouveau modèle | Données |
|--------------|----------------|---------|
| Amphithéâtre | MOOC / plateforme e-learning | 5M → 50M+ étudiants sur plateformes (2018-2024, x10) |
| Manuel scolaire | Contenu interactif IA | EdTech Afrique : 7,33 Mds → 19,25 Mds USD (2034) |
| Enseignant unique | Tuteur IA personnalisé | Nigeria : étudiants avec IA surpassent significativement les pairs ([Banque Mondiale](https://blogs.worldbank.org/en/education/From-chalkboards-to-chatbots-Transforming-learning-in-Nigeria)) |

**Acteurs clés :**
- **ALX** : de 50 étudiants (2020) à ~100 000 récemment, 35% des ingénieurs logiciels d'Afrique
- **Andela** : 150 000+ membres, 135 pays, 70% taux de placement
- **Kabakoo Academies** : #1 app d'upskilling en Côte d'Ivoire et Mali, reconnue UNESCO et WEF
- **Moringa School** : 8 000+ professionnels formés, 85% taux de placement

#### Centre de carrière → Plateforme de talents (type LinkedIn)

| Ancien modèle | Nouveau modèle | Données |
|--------------|----------------|---------|
| Bureau de placement universitaire | Plateforme digitale de matching | LinkedIn : ~74M membres Afrique+Moyen-Orient combinés |
| Bulletin d'offres papier | Job board intelligent + IA | Jobberman : 2,5M+ candidats, 60K+ employeurs |
| Conseiller d'orientation | Copilote IA de carrière | Talent2Africa : seule plateforme pan-africaine francophone |

**Gap critique :** LinkedIn a une faible pénétration en UEMOA, pas d'opérations locales, pas d'approche mobile-first pour le contexte africain. Les plateformes locales (Emploi.ci, Novojob) sont des job boards simples sans intégration d'apprentissage.

#### Bibliothèque → Base de connaissances IA

| Ancien modèle | Nouveau modèle | Données |
|--------------|----------------|---------|
| Bibliothèque physique | Ressources éducatives ouvertes (OER) | 200+ institutions africaines ont adopté des politiques OER |
| Recherche manuelle | Recherche sémantique IA | Google Digital Skills : 10M+ jeunes formés depuis 2017 |
| Encyclopédie | IA conversationnelle | Majorité des OER en anglais — gap critique pour la francophonie |

#### Services étudiants → Plateforme de talents digitale

| Ancien modèle | Nouveau modèle | Données |
|--------------|----------------|---------|
| Guidance universitaire | Assessment digital des compétences | Digital Skills Africa : certifications reconnues par l'industrie |
| Diplôme papier | Credentialing digital + graphe de compétences | Micro-credentials : 2,1 Mds → 10,6 Mds USD (2033) |
| Annuaire alumni | Profil talent enrichi + matching IA | 72% des employeurs préfèrent un candidat avec micro-credential |

### 4.4 Le Re-bundling : la proposition de valeur Etudesk

Le dégroupage crée des services isolés. La vraie valeur vient du **re-bundling** — la réassemblage des composantes les plus précieuses dans une expérience digitale native intégrée :

| Composante universitaire | Dégroupé par | Re-bundlé dans Etudesk |
|-------------------------|-------------|----------------------|
| Campus | Espaces de coworking | **Espaces digitaux + communautés** |
| Professeurs | Créateurs en ligne | **Réseau d'experts + Copilote IA** |
| Communauté étudiante | WhatsApp/Discord | **Communautés digitales intégrées** |
| Cours | MOOCs/bootcamps | **Apprentissage IA + graphe de compétences** |
| Centre de carrière | Job boards | **Matching de talents IA + guidance** |
| Bibliothèque | Google/ChatGPT | **Recherche sémantique + base de connaissances** |
| Diplôme | Micro-certifications | **Credentialing digital + skills graph** |

### 4.5 Pourquoi 2024-2026 est le moment idéal

#### 1. Dividende démographique
- Age médian en Afrique : **19,3 ans** (vs Europe 43, Amérique du Nord 37)
- **60%+ de la population a moins de 25 ans**
- 10-12M de jeunes entrent sur le marché du travail chaque année
- C'est le plus grand et le plus jeune marché du travail de l'histoire humaine

#### 2. Accélération post-COVID
- 42% des employés africains ont travaillé à distance au moins 1 jour/semaine en 2022
- Continuité éducative assurée pour 92 000+ étudiants via outils digitaux pendant les confinements
- Adoption du smartphone en Afrique subsaharienne : quasi-doublement post-pandémie

#### 3. Révolution IA (ère Claude + GPT + Gemini)
- L'IA permet une éducation personnalisée et scalable à une fraction du coût traditionnel
- [25 pays africains francophones et lusophones](https://www.gpekix.org/blog/commitment-action-advancing-use-ai-education-africa-through-regional-collaboration-and) ont participé au séminaire IA+Education de Dakar (octobre 2024)
- Pilote Nigeria : étudiants avec tuteur IA surpassent significativement leurs pairs
- Etudesk est positionné pour être le **premier copilote IA éducatif francophone** à l'échelle

#### 4. Masse critique mobile-first
- **416M d'utilisateurs internet mobile** en Afrique
- Côte d'Ivoire : pénétration mobile de **185%**, couverture 4G de **88%+**
- Technologies mobiles = **7,7% du PIB africain** = 220 milliards USD de valeur économique
- Gap d'usage en réduction rapide (960M de personnes couvertes mais non connectées)

#### 5. Momentum d'investissement
- Financement tech Afrique : **4,1 milliards USD en 2025** (+25% YoY)
- Afrique francophone = **55% du volume de financement** (hors Big 4)
- Startups Côte d'Ivoire : **350M USD levés en 2024** (+60% YoY)

#### 6. Transformation digitale gouvernementale UEMOA

| Pays | Initiative | Détails |
|------|-----------|---------|
| **UEMOA (BCEAO)** | Système de paiement interopérable PI-SPI | Temps réel, 24/7, lancé sept 2025 |
| **Sénégal** | "New Technology Deal" | Plan 5 ans, 90% des services publics dématérialisés d'ici 2034 |
| **Côte d'Ivoire** | Stratégie digitale 2024 | 3,3 Mds USD investissement, 32 réformes, 250 Mds FCFA dans le numérique |
| **Burkina Faso** | PACT DIGITAL | Data center (70% achevé), réseau 500+ localités, budget 150M USD |

#### 7. Starlink & infrastructure Internet
- Starlink opérationnel dans **25+ pays africains** fin 2025
- Lancé dans le Niger et la Guinée-Bissau en 2025
- Partenariats : Orange (fév 2025), Vodacom, Airtel Africa
- Elimine la barrière du dernier kilomètre pour l'éducation digitale en zones rurales

### 4.6 Paysage concurrentiel & gap de marché

| Catégorie | Acteurs existants | Limites |
|-----------|------------------|---------|
| **Job Boards** | Emploi.ci, Educarriere.ci, Novojob | Listing seulement, pas de développement de compétences |
| **Recrutement pan-africain** | Talent2Africa, Jobberman | Focus recrutement, pas d'apprentissage |
| **E-Learning** | Coursera/Udemy (global), Kabakoo (local) | Contenu francophone limité, pas d'intégration carrière |
| **Coworking** | AfricaWorks, Impact Hub | Physique uniquement, pas d'écosystème digital |
| **Réseau professionnel** | LinkedIn | Faible pénétration UEMOA, pas mobile-first, pas d'opérations locales |
| **Skills training** | ALX, Andela | Tech-focused uniquement, anglophone-first |

**Les 5 gaps critiques qu'Etudesk comble :**

1. **Gap linguistique** — La majorité des OER et contenus e-learning sont en anglais. L'Afrique francophone (400M+ locuteurs) est dramatiquement sous-servie
2. **Gap d'intégration** — Aucune plateforme en UEMOA ne combine apprentissage, credentialing, carrière, networking et communauté
3. **Gap IA** — Le tutoring IA est virtuellement absent de l'Afrique francophone
4. **Gap mobile-first** — LinkedIn et les plateformes globales sont desktop-first
5. **Gap emploi-compétences** — Avec 50%+ de chômage des jeunes au Sénégal, aucune plateforme UEMOA ne fait le pont compétences → emploi de bout en bout

---

## 5. Pricing & Crédits (modèle V2)

La référence active est `Etudesk_SAS/produit/etudesk_os/docs/ECONOMIC_MODEL_2026.md`.

Résumé opérationnel:

- Modèle à l'usage (crédits par action), plus de plans d'abonnement comme mécanique principale.
- Deux wallets/facturations:
  - **Talent**: facture personnelle, minimum **2 000 FCFA**
  - **Organisation**: facture entreprise, minimum **10 000 FCFA**, crédits mutualisés pour les sous-admins/membres autorisés
- Paiement **in-app via Paystack** (init transaction, paiement, webhook, crédit wallet, facture).

Barème crédits (extrait):

| Scope | Action | Crédits |
|---|---|---:|
| Talent | Assistant Explorer (requête) | 1 |
| Talent | Assistant Study (requête) | 0,25 |
| Talent | Génération de document / image / upload document | 1 |
| Organisation | Assistant Manager (requête) | 1 |
| Organisation | Analyse et scoring d'application | 0,5 |
| Tous | Recherche web / Instruction vocale | 0 |

---

## 6. Architecture technique

### Diagramme d'architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENTS                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ Mobile (Expo)│  │  Web (Next)  │  │  API externe │              │
│  │ React Native │  │  Next.js 15  │  │  (future)    │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
└─────────┼─────────────────┼─────────────────┼───────────────────────┘
          │                 │                 │
          └────────────┬────┘─────────────────┘
                       │ HTTPS / SSE
┌──────────────────────┼──────────────────────────────────────────────┐
│                      ▼                                              │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    EXPRESS API (v1)                           │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────┐  │   │
│  │  │   Auth   │ │  CRUD    │ │  Files   │ │   Copilot SSE  │  │   │
│  │  │ JWT+OTP  │ │ Routes   │ │ Upload   │ │   Streaming    │  │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                   COPILOT AI ENGINE                           │   │
│  │  ┌────────────────┐  ┌──────────────┐  ┌─────────────────┐  │   │
│  │  │  TalentAgent   │  │   OrgAgent   │  │   Sub-Agents    │  │   │
│  │  │(claude-sonnet) │  │(claude-sonnet)│  │ (haiku/gpt-4.1) │  │   │
│  │  │  Explorer/Study│  │  Org mode    │  │  File/WebSearch  │  │   │
│  │  └────────┬───────┘  └──────┬───────┘  └────────┬────────┘  │   │
│  │           │                 │                    │           │   │
│  │  ┌────────┴─────────────────┴────────────────────┴────────┐  │   │
│  │  │                    10 TOOLS                             │  │   │
│  │  │ vector_query | sql_query | youtube | generate_doc/img  │  │   │
│  │  │ generate_diagram | file_reader | web_search            │  │   │
│  │  │ manage_skills | execute_action                         │  │   │
│  │  └────────────────────────────────────────────────────────┘  │   │
│  │  ┌────────────────────────────────────────────────────────┐  │   │
│  │  │           GUARDRAILS (claude-haiku-4-5)                │  │   │
│  │  │  Input Safety (blocks INJECTION/HARMFUL)               │  │   │
│  │  │  Output Format (validates entity cards, char limits)   │  │   │
│  │  └────────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    DATA LAYER                                │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐                   │   │
│  │  │PostgreSQL│  │ Pinecone │  │ Storage  │                   │   │
│  │  │  (CRUD)  │  │ (Vectors)│  │ (Files)  │                   │   │
│  │  └──────────┘  └──────────┘  └──────────┘                   │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                         BACKEND                                     │
└─────────────────────────────────────────────────────────────────────┘
          │                 │                 │
┌─────────┼─────────────────┼─────────────────┼───────────────────────┐
│         ▼                 ▼                 ▼                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │ Paystack │  │  Resend  │  │Anthropic │  │  Brave   │           │
│  │ Payments │  │  Email   │  │  Claude  │  │  Search  │           │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                        │
│  │  Google  │  │  OpenAI  │  │ YouTube  │                        │
│  │  Gemini  │  │ IMG/STT  │  │  API v3  │                        │
│  └──────────┘  └──────────┘  └──────────┘                        │
│                    SERVICES EXTERNES                                │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 7. Stack technologique

### Backend

| Technologie | Version | Rôle |
|-------------|---------|------|
| **Node.js** | 20+ | Runtime JavaScript |
| **TypeScript** | 5.6.0 | Typage statique |
| **Express** | 4.18+ | Framework HTTP |
| **PostgreSQL** | 15+ | Base de données relationnelle |
| **Pinecone** | 3.0.3 | Base de données vectorielle |
| **Zod** | 4.3.5 | Validation de schémas |
| **jsonwebtoken** | - | Authentification JWT |
| **bcryptjs** | - | Hachage OTP/mots de passe |
| **i18next** | - | Internationalisation (FR/EN) |
| **pg** | 8.13+ | Driver PostgreSQL |
| **tsx** | 4.19 | Exécution TypeScript (dev) |
| **PM2** | - | Process manager (production) |

### IA & Machine Learning (Architecture multi-provider)

3 providers simultanés — chaque provider est utilisé pour ses forces :

| Technologie | Provider | Rôle |
|-------------|----------|------|
| **OpenAI Agents SDK** | - | Framework multi-agents (orchestre les 3 providers) |
| **claude-sonnet-4-5** (MODEL_AGENT) | Anthropic | Agents principaux (TalentAgent, OrgAgent) |
| **claude-haiku-4-5** (MODEL_FAST) | Anthropic | Guardrails, titres, summaries, FileReaderAgent |
| **gemini-2.5-flash-lite** (MODEL_SUGGESTION) | Google | Suggestions, objectifs quotidiens, bio |
| **gpt-4.1-mini** (MODEL_SEARCH) | OpenAI | WebSearchAgent, vision/extraction documents |
| **gpt-4.1-nano** (MODEL_MATCH) | OpenAI | Recommendations candidats |
| **gpt-image-1** (MODEL_IMAGE) | OpenAI | Génération d'images éducatives |
| **text-embedding-3-small** (MODEL_EMBEDDING) | OpenAI | Embeddings vectoriels (1536 dims) |
| **whisper-1** (MODEL_STT) | OpenAI | Transcription audio (voice-to-text) |
| **@anthropic-ai/sdk** | - | SDK natif Anthropic (AnthropicProvider adapter) |

### Mobile

| Technologie | Version | Rôle |
|-------------|---------|------|
| **React Native** | 0.81.5 | Framework mobile cross-platform |
| **Expo** | 54.0.33 | Plateforme de développement mobile |
| **Expo Router** | 6.0.23 | Navigation file-based |
| **React** | 19.1.0 | Bibliothèque UI |
| **Lucide Icons** | 0.460 | Icônes (exclusivement) |
| **Montserrat** | - | Police typographique |
| **i18n-js** | 4.5.1 | Internationalisation |

### Web

| Technologie | Version | Rôle |
|-------------|---------|------|
| **Next.js** | 15.0.0 | Framework React SSR/SSG |
| **React** | 19.0.0 | Bibliothèque UI |

### Services externes

| Service | Rôle |
|---------|------|
| **Paystack** | Paiements (FCFA) |
| **Resend** | Email transactionnel (production) |
| **Mailhog** | Email (développement) |
| **Anthropic Claude** | Agents IA principaux (Sonnet, Haiku) |
| **Google Gemini** | Suggestions formulaires (Flash Lite) |
| **OpenAI** | Images, STT, embeddings, web search, vision |
| **Brave Search** | Recherche web (copilote) |
| **YouTube API** | Recherche de vidéos éducatives |
| **Expo Push** | Notifications push (iOS/Android) |
| **UltraMsg** | WhatsApp (notifications) |

---

## 8. Backend — Architecture serveur

### Structure des fichiers

```
backend/src/
├── index.ts                    # Point d'entrée Express
├── middleware/
│   ├── auth.middleware.ts       # JWT auth (authMiddleware, optionalAuth, requireAdmin)
│   ├── rateLimit.middleware.ts  # Rate limiters (9 limiters différents)
│   ├── validation.middleware.ts # Validation Zod
│   ├── api-version.middleware.ts# Versioning API (v1)
│   └── community-access.middleware.ts
├── routes/
│   ├── auth.ts                 # Authentification (OTP, JWT)
│   ├── talents.ts              # Profils talents
│   ├── organizations/          # CRUD organisations (read/write)
│   ├── opportunities/          # Offres d'emploi (read/write/applications)
│   ├── communities/            # Communautés (read/write/members)
│   ├── spaces/                 # Espaces (read/write/bookings/messages)
│   ├── skills.ts               # Compétences
│   ├── documents.ts            # Documents (upload/CRUD)
│   ├── notifications.ts        # Notifications push
│   ├── bookmarks.ts            # Favoris
│   ├── copilot.ts              # Chat IA (SSE streaming)
│   ├── calendar.ts             # Calendrier
│   ├── kyc.ts                  # Vérification d'identité
│   ├── daily-objective.ts      # Objectifs quotidiens
│   ├── payment-methods.ts      # Moyens de paiement
│   ├── onboarding.ts           # Onboarding
│   ├── files.ts                # Upload fichiers
│   └── images.ts               # Upload/génération images
├── repositories/               # Pattern Repository (accès données)
│   ├── base.repository.ts      # Classe abstraite BaseRepository<T>
│   ├── talent.repository.ts
│   ├── organization.repository.ts
│   ├── opportunity.repository.ts
│   ├── application.repository.ts
│   ├── community.repository.ts
│   ├── space.repository.ts
│   ├── notification.repository.ts
│   └── bookmark.repository.ts
├── services/
│   ├── auth.service.ts         # JWT, sessions, tokens
│   ├── otp.service.ts          # Génération/vérification OTP
│   ├── email.service.ts        # Dual provider (Mailhog/Resend)
│   ├── database.ts             # Pool PostgreSQL
│   ├── storage.service.ts      # Upload fichiers
│   ├── embedding.service.ts    # Embeddings Pinecone
│   ├── notification.service.ts # Push notifications (Expo SDK)
│   ├── matching.service.ts     # Matching talents/opportunités
│   ├── ai/                     # Services IA (multi-provider)
│   │   ├── models.ts           # Constantes modèles par usage (AGENT/FAST/SUGGESTION/MATCH/SEARCH)
│   │   ├── provider.ts         # Config multi-provider (Anthropic, Gemini, OpenAI)
│   │   ├── anthropic-provider.ts # AnthropicProvider adapter pour @openai/agents
│   │   ├── agent-factory.ts    # Création agents (Anthropic pour copilot, Gemini pour suggestions)
│   │   └── talent-object.ts    # Contexte talent enrichi
│   └── copilot/                # Copilote IA complet
│       ├── index.ts            # Orchestration principale
│       ├── agents/             # TalentAgent, OrgAgent
│       ├── tools/              # 10 outils
│       ├── guardrails/         # Input/Output guardrails
│       ├── prompts/            # System prompts dynamiques
│       ├── skills/             # Bibliothèque de skills (.skill.md)
│       ├── actions/            # Protocole de confirmation
│       ├── stream/             # SSE handler
│       ├── session.service.ts  # Sessions & messages
│       ├── session-summarizer.ts# Compression historique
│       ├── context.ts          # Construction contexte
│       ├── context-options.ts  # Options par mode
│       ├── run-context.ts      # CopilotRunContext
│       └── ontology.cache.ts   # Cache ontologie
├── database/
│   ├── schema_final.sql        # Schéma consolidé (état actuel)
│   ├── run-migrations.ts       # Runner migrations
│   ├── recreate-db.ts          # Drop + create DB (optionnel)
│   └── migrations/             # Migrations SQL (baseline)
└── scripts/
    └── seed-pinecone.ts        # Initialisation Pinecone
```

### Pattern architectural

1. **Repository Pattern** — Abstraction accès données via `BaseRepository<T>`
2. **Service Layer** — Logique métier isolée des routes
3. **Middleware Pipeline** — Auth, validation, rate limiting, versioning
4. **Factory Pattern** — Outils copilote avec injection de `talentId` (IDOR protection)
5. **SSE Streaming** — Réponses temps réel du copilote

### Rate Limiting

| Limiter | Fenêtre | Dev | Prod | Cible |
|---------|---------|-----|------|-------|
| `apiLimiter` | 15 min | 500 | 100 | Toutes les routes |
| `authLimiter` | 15 min | 10 | 10 | Login |
| `otpLimiter` | 1 heure | 5 | 5 | Demande OTP |
| `applicationLimiter` | 1 heure | 20 | 20 | Candidatures |
| `writeLimiter` | 15 min | 50 | 50 | Création/modification |
| `searchLimiter` | 1 min | 30 | 30 | Recherche |
| `copilotChatLimiter` | 1 min | 30 | 10 | Chat copilote |
| `copilotGeneralLimiter` | 1 min | 100 | 30 | Autres routes copilote |
| `exportLimiter` | 1 heure | 10 | 10 | Export PDF |

---

## 9. Base de données PostgreSQL

### Tables principales (15+ tables)

#### Authentification & Utilisateurs
| Table | Description |
|-------|-------------|
| `users` | Comptes utilisateurs (email, rôle, statut) |
| `sessions` | Sessions JWT (refresh token hashé, device, IP) |
| `otp_codes` | Codes OTP (hashés, max 3 tentatives, expire 10min) |
| `talents` | Profils professionnels (bio, skills, localisation, embedding) |

#### Organisations
| Table | Description |
|-------|-------------|
| `organizations` | Entreprises/organisations |
| `organization_members` | Membres avec rôles (OWNER, ADMIN, MANAGER, MEMBER) |
| `organization_invitations` | Invitations par email avec token + expiration |

#### Opportunités
| Table | Description |
|-------|-------------|
| `opportunities` | Offres d'emploi/stage/freelance |
| `applications` | Candidatures (statut: SUBMITTED, IN_REVIEW, ACCEPTED, REJECTED) |
| `opportunity_questions` | Questions personnalisées de candidature |
| `opportunity_invitations` | Invitations directes |

#### Communautés
| Table | Description |
|-------|-------------|
| `communities` | Groupes (access_type: PUBLIC, PRIVATE, APPLICATION) |
| `community_members` | Adhésions avec permissions |
| `community_activities` | Posts/publications (publication programmée) |
| `community_activity_comments` | Commentaires avec @mentions |
| `community_notifications` | Notifications d'activité |

#### Espaces
| Table | Description |
|-------|-------------|
| `spaces` | Espaces physiques/virtuels |
| `space_bookings` | Réservations |
| `space_messages` | Messagerie intra-espace |
| `space_payment_info` | Informations de paiement |

#### Copilote IA
| Table | Description |
|-------|-------------|
| `copilot_sessions` | Sessions de chat (modes: EXPLORE, STUDY, ORG) |
| `copilot_messages` | Historique messages + tool_calls + output_data |
| `copilot_message_attachments` | Pièces jointes des messages |

#### Autres
| Table | Description |
|-------|-------------|
| `notifications` | Système unifié de notifications |
| `push_tokens` | Tokens push devices (iOS/Android/Web) |
| `bookmarks` | Favoris (opportunités, communautés, espaces) |
| `talent_documents` | Documents uploadés (CV, portfolio, max 20/talent) |
| `daily_objectives` | Objectifs quotidiens |
| `kyc_verifications` | Vérification d'identité (PENDING, VERIFIED, REJECTED) |

### Migrations (17 fichiers)

| # | Migration | Description |
|---|-----------|-------------|
| 001 | KYC & activités programmées | Table kyc_verifications + scheduling posts |
| 002 | Préférences notification | Préférences push/email + langues |
| 003 | Colonnes visibilité | Public/privé pour entités |
| 004 | Préférences d'apprentissage | Style (VISUAL, AUDITORY, TEXT_BASED, INTERACTIVE) |
| 005 | Paiement espaces | Info paiement pour réservations |
| 006 | Permissions org | Permissions rôle-based pour membres org |
| 007 | Messages membership | Messagerie dans le flux adhésion |
| 008 | Brouillon activités | Statut draft pour publications communautaires |
| 009 | Permissions par défaut | Permissions membres communauté par défaut |
| 010 | Rating/notes membres | Notation et notes sur membres communauté |
| 011 | Recommandations IA | Suggestions IA pour candidatures |
| 012 | Mentions/édition | @mentions dans commentaires + suivi édition |
| 013 | Langue préférée | Paramètre langue utilisateur |
| 014 | Objectifs quotidiens | Suivi des objectifs journaliers |
| 015 | Pièces jointes copilote | Fichiers attachés aux messages copilote |
| 016 | Contrainte mode session | Fix contrainte mode (EXPLORE/STUDY/ORG) |
| 017 | Notifications unifiées | Système de notification unifié |

### Base vectorielle Pinecone

| Config | Valeur |
|--------|--------|
| **Index** | etudesk |
| **Dimension** | 1536 |
| **Métrique** | Cosine |
| **Modèle embedding** | text-embedding-3-small |
| **Namespaces** | `talent`, `opportunity`, `community`, `space` |

Stratégie : mise à jour asynchrone à chaque création/modification d'entité.

---

## 10. API REST — Endpoints complets

### Base URL : `/api/v1`

### Authentification (`/auth`)

| Méthode | Endpoint | Auth | Description |
|---------|----------|------|-------------|
| POST | `/auth/request-otp` | Non | Envoyer OTP par email (5/heure) |
| POST | `/auth/verify-otp` | Non | Vérifier OTP → tokens JWT (10/15min) |
| POST | `/auth/refresh` | Non | Renouveler access token |
| POST | `/auth/logout` | Oui | Révoquer session (ou toutes) |
| GET | `/auth/me` | Oui | Profil utilisateur courant |
| PUT | `/auth/language` | Oui | Changer langue (fr/en) |

### Talents (`/talents`)

| Méthode | Endpoint | Auth | Description |
|---------|----------|------|-------------|
| GET | `/talents/me` | Oui | Mon profil + stats |
| GET | `/talents/me/talent-object` | Oui | Profil enrichi (TalentObject) |
| PUT | `/talents/me` | Oui | Modifier mon profil |

### Organisations (`/organizations`)

| Méthode | Endpoint | Auth | Description |
|---------|----------|------|-------------|
| GET | `/organizations` | Optionnel | Lister (pagination, filtres) |
| GET | `/organizations/my` | Oui | Mes organisations |
| GET | `/organizations/:id` | Non | Détails + membres |
| POST | `/organizations` | Oui | Créer |
| PUT | `/organizations/:id` | Oui | Modifier |
| DELETE | `/organizations/:id` | Oui | Supprimer (soft delete) |
| GET | `/organizations/:id/members` | Non | Lister membres |
| POST | `/organizations/:id/members` | Oui | Ajouter membre |
| PUT | `/organizations/:id/members/:mid` | Oui | Modifier rôle/permissions |
| DELETE | `/organizations/:id/members/:mid` | Oui | Retirer membre |

### Opportunités (`/opportunities`)

| Méthode | Endpoint | Auth | Description |
|---------|----------|------|-------------|
| GET | `/opportunities` | Optionnel | Lister toutes |
| GET | `/opportunities/can-generate` | Non | Vérifier si génération IA possible |
| GET | `/opportunities/organization/:orgId` | Optionnel | Par organisation |
| GET | `/opportunities/:id` | Non | Détails |
| POST | `/opportunities/generate` | Oui | Générer par IA |
| POST | `/opportunities` | Oui | Créer |
| PUT | `/opportunities/:id` | Oui | Modifier |
| DELETE | `/opportunities/:id` | Oui | Supprimer |

### Candidatures (`/applications`)

| Méthode | Endpoint | Auth | Description |
|---------|----------|------|-------------|
| GET | `/applications` | Oui | Mes candidatures |
| POST | `/applications` | Oui | Postuler (20/heure) |
| GET | `/applications/:oppId` | Oui | Candidatures pour une offre (org) |
| PUT | `/applications/:id/status` | Oui | Changer statut |
| PUT | `/applications/:id/rating` | Oui | Noter (1-5) |
| PUT | `/applications/:id/notes` | Oui | Ajouter notes |

### Communautés (`/communities`)

| Méthode | Endpoint | Auth | Description |
|---------|----------|------|-------------|
| GET | `/communities` | Optionnel | Lister |
| GET | `/communities/organization/:orgId` | Non | Par organisation |
| GET | `/communities/:id` | Optionnel | Détails |
| GET | `/communities/:id/membership` | Optionnel | Statut adhésion |
| GET | `/communities/:id/stats` | Oui | Statistiques |
| POST | `/communities` | Oui | Créer |
| PUT | `/communities/:id` | Oui | Modifier |
| DELETE | `/communities/:id` | Oui | Supprimer |
| GET | `/communities/:id/members` | Non | Lister membres |
| POST | `/communities/:id/members` | Oui | Rejoindre |
| PUT | `/communities/:id/members/:mid` | Oui | Modifier rôle |
| DELETE | `/communities/:id/members/:mid` | Oui | Retirer |

### Activités communautaires (`/community-activities`)

| Méthode | Endpoint | Auth | Description |
|---------|----------|------|-------------|
| POST | `/community-activities` | Oui | Créer post (programmation possible) |
| GET | `/:communityId/activities` | Non | Lister activités |
| PUT | `/community-activities/:id` | Oui | Modifier |
| DELETE | `/community-activities/:id` | Oui | Supprimer |
| POST | `/community-activities/:id/comments` | Oui | Commenter (avec @mentions) |

### Espaces (`/spaces`)

| Méthode | Endpoint | Auth | Description |
|---------|----------|------|-------------|
| GET | `/spaces` | Optionnel | Lister |
| GET | `/spaces/organization/:orgId` | Non | Par organisation |
| GET | `/spaces/:id` | Non | Détails + réservations |
| POST | `/spaces` | Oui | Créer |
| PUT | `/spaces/:id` | Oui | Modifier |
| DELETE | `/spaces/:id` | Oui | Supprimer |
| GET | `/spaces/:id/bookings` | Non | Réservations |
| POST | `/spaces/:id/bookings` | Oui | Réserver |
| PUT | `/spaces/:id/bookings/:bid` | Oui | Modifier réservation |
| DELETE | `/spaces/:id/bookings/:bid` | Oui | Annuler |
| POST | `/spaces/:id/messages` | Oui | Envoyer message |
| GET | `/spaces/:id/messages` | Non | Messages |

### Copilote IA (`/copilot`)

| Méthode | Endpoint | Auth | Rate Limit | Description |
|---------|----------|------|------------|-------------|
| POST | `/copilot/chat` | Oui | 10/min | Chat IA (SSE stream) |
| GET | `/copilot/suggestions` | Oui | 30/min | Suggestions de conversation |
| POST | `/copilot/confirm` | Oui | 30/min | Confirmer action |
| POST | `/copilot/upload` | Oui | 30/min | Upload pièce jointe |
| GET | `/copilot/sessions` | Oui | 30/min | Lister sessions |
| POST | `/copilot/sessions` | Oui | 30/min | Créer session |
| GET | `/copilot/sessions/:id` | Oui | 30/min | Détails session |
| DELETE | `/copilot/sessions/:id` | Oui | 30/min | Supprimer session |
| GET | `/copilot/sessions/:id/messages` | Oui | 30/min | Historique messages |

### Autres endpoints

| Route | Méthode | Description |
|-------|---------|-------------|
| `/documents` | GET/POST/PATCH/DELETE | CRUD documents talent |
| `/documents/:id/retry` | POST | Relancer extraction IA |
| `/skills/my` | GET/POST/PUT/DELETE | CRUD compétences |
| `/skills/my/merge` | POST | Fusionner doublons |
| `/notifications` | GET/PUT/DELETE | Notifications |
| `/notifications/push-token` | POST/DELETE | Enregistrer/supprimer token push |
| `/bookmarks/*` | GET/POST/DELETE | Favoris (opportunités/espaces/communautés) |
| `/calendar` | GET | Événements calendrier |
| `/kyc/status` | GET | Statut vérification KYC |
| `/kyc/submit` | POST | Soumettre vérification |
| `/daily-objective/*` | GET | Objectifs du jour |
| `/payment-methods` | GET/POST/DELETE | Moyens de paiement |
| `/onboarding/*` | POST | Compléter profil / préférences |
| `/files/upload` | POST | Upload fichier générique |
| `/images/generate` | POST | Génération image IA |
| `/health` | GET | Santé du serveur |

---

## 11. Authentification & Sécurité

### Flux d'authentification (Passwordless OTP)

```
1. POST /auth/request-otp { email }
   → Génère code 6 chiffres
   → Hash bcrypt → stocke dans otp_codes
   → Envoie par email (Mailhog dev / Resend prod)
   → Expire en 10 minutes, max 3 tentatives

2. POST /auth/verify-otp { email, code }
   → Compare hash avec DB
   → Crée session dans sessions table
   → Retourne { accessToken (15min), refreshToken (30j), user, isNewUser }

3. Authorization: Bearer <accessToken>
   → JWT payload: { userId, email, talentId, type: 'access' }
   → Vérifié par authMiddleware (pas de hit DB)

4. POST /auth/refresh { refreshToken }
   → Vérifie hash dans sessions table
   → Retourne nouveaux tokens

5. POST /auth/logout { refreshToken?, allDevices? }
   → Révoque session(s) dans DB
```

### Middleware de sécurité

| Middleware | Rôle |
|------------|------|
| `authMiddleware` | Vérifie JWT, attache userId/talentId à req |
| `optionalAuthMiddleware` | JWT optionnel (continue si absent) |
| `requireTalentProfile` | Vérifie profil talent complété |
| `requireAdmin` | Vérifie email dans ADMIN_EMAILS |

### Protection IDOR

Toutes les routes copilote utilisent le **Factory Pattern** :

```typescript
// Le talentId vient TOUJOURS de la session authentifiée, JAMAIS du LLM
createSqlQueryTool(authenticatedTalentId, authorizedOrgIds, allowedIntents)
createManageSkillsTool(authenticatedTalentId)
createExecuteActionTool(authenticatedTalentId)
createFileReaderTool(authenticatedTalentId)
createGenerateDocumentTool(talentId, avatarUrl)
```

### Sécurité supplémentaire

- **CORS** : Origines explicites (pas de wildcard en production)
- **Rate Limiting** : 9 limiters par type d'endpoint
- **Validation Zod** : Toutes les entrées validées
- **Soft Delete** : `deleted_at` timestamp (pas de suppression physique)
- **JWT Secrets** : Minimum 64 caractères hex

---

## 12. Copilote IA — Architecture agents

### Vue d'ensemble

Le copilote est un système multi-agents basé sur le **OpenAI Agents SDK** (`@openai/agents`).

### Agents

| Agent | Modèle | Provider | Modes | Rôle |
|-------|--------|----------|-------|------|
| **TalentAgent** | claude-sonnet-4-5 | Anthropic | Explorer, Study | Agent principal pour talents individuels |
| **OrgAgent** | claude-sonnet-4-5 | Anthropic | Organisation | Agent pour administrateurs d'organisations |
| **FileReaderAgent** | claude-haiku-4-5 | Anthropic | Sub-agent | Lecture et analyse de documents (via `asTool()`) |
| **WebSearchAgent** | gpt-4.1-mini | OpenAI | Sub-agent | Recherche web (via `asTool()`, Responses API) |

### Modes de fonctionnement

#### Mode Explorer (par défaut)
- **Persona :** Guide distingué, inspirant, expert
- **Capacités :** Recherche opportunités/communautés/espaces, génération de CV, candidatures, analyse de documents
- **Outils :** Tous les 10 outils
- **Entity cards :** Oui (opportunité, communauté, espace, talent, organisation, document)
- **Limite texte :** 800 caractères (hors cards et blocs)

#### Mode Study
- **Persona :** Pédagogue, encourageant, haute érudition
- **Capacités :** Enseignement structuré, quiz, flashcards, diagrammes, vidéos YouTube
- **Restrictions :** PAS d'entity cards, PAS de vector_query, sql_query limité à (my_profile, my_skills, my_documents)
- **Suppression de skill :** Interdite (uniquement ajout/mise à jour)
- **Limite texte :** 1200 caractères
- **Pédagogie :** UN composant interactif par message (quiz OU flashcard OU diagramme OU vidéo)

#### Mode Organisation
- **Persona :** Homme d'état de l'industrie, partenaire stratégique
- **Capacités :** Dashboard org, gestion talents, publication d'offres, création communautés/espaces
- **Données :** sql_query org_* intents uniquement, PAS d'accès aux données personnelles
- **Entity cards :** Uniquement entity:talent et entity:opportunity
- **Limite texte :** 800 caractères

### Contexte par mode

| Données | Explorer | Study | Organisation |
|---------|----------|-------|--------------|
| Documents | Oui (tous) | Oui (5 max) | Non |
| Candidatures | Oui | Non | Non |
| Adhésions | Oui | Non | Non |
| Réservations | Oui | Non | Non |
| Notifications | Oui | Non | Non |
| Favoris | Oui | Non | Non |
| Calendrier | Oui | Non | Non |
| Invitations | Oui | Non | Non |
| Organisations | Oui | Non | Oui |

### Session & mémoire

- **Historique :** Derniers 50 messages par session
- **Résumé automatique :** claude-haiku-4-5 (Anthropic) résume les messages > 10 (garde les 4 derniers verbatim)
- **Titre auto :** claude-haiku-4-5 (Anthropic) génère un titre après le 1er message
- **Suggestions :** gemini-2.5-flash-lite (Google) propose des amorces de conversation contextuelles

---

## 13. Copilote — Outils (10 tools)

### 1. `vector_query`

| Propriété | Valeur |
|-----------|--------|
| **Type** | Recherche sémantique |
| **Backend** | Pinecone (cosine similarity) |
| **Namespaces** | talent, opportunity, community, space |
| **Usage** | Découverte d'entités par description naturelle |
| **Mode Study** | INTERDIT |

### 2. `sql_query`

| Propriété | Valeur |
|-----------|--------|
| **Type** | Requêtes structurées par intent |
| **Protection** | Factory pattern avec talentId injecté |
| **23 intents** | my_profile, my_applications, my_reservations, my_skills, my_documents, my_bookmarks, my_communities, my_invitations, org_members, org_applications, org_stats, org_opportunities, org_communities, org_spaces, org_revenue, org_invitations, search_opportunities, search_communities, search_spaces, search_organizations, search_talents, apply_opportunity, join_community |

**Restrictions par mode :**
- **Study :** my_profile, my_skills, my_documents uniquement
- **Organisation :** org_* et search_* uniquement

### 3. `youtube_search`

| Propriété | Valeur |
|-----------|--------|
| **API** | YouTube Data API v3 |
| **Langue** | Français prioritaire |
| **Résultats** | 1-5 vidéos (3 par défaut) |
| **Usage** | Mode Study uniquement, vidéos éducatives |

### 4. `generate_document`

| Propriété | Valeur |
|-----------|--------|
| **Formats** | PDF, DOCX, XLS, CSV, TXT |
| **CV spécial** | Layout 2 colonnes élégant avec avatar |
| **Auto-save** | Sauvegardé dans talent_documents + extraction IA |
| **Stockage** | `documents/{talentId}/{documentId}.{ext}` |

### 5. `generate_image`

| Propriété | Valeur |
|-----------|--------|
| **Modèle** | gpt-image-1 |
| **Tailles** | 1024x1024, 1536x1024, 1024x1536 |
| **Qualité** | low (~$0.01), medium (~$0.04), high (~$0.17) |
| **Sortie** | Base64 → PNG persisté |

### 6. `generate_diagram`

| Propriété | Valeur |
|-----------|--------|
| **Format** | Code Mermaid (rendu client-side) |
| **Types** | flowchart, sequenceDiagram, classDiagram, mindmap, timeline, gantt, pie, erDiagram |
| **Rendu** | WebView mermaid.js dans l'app mobile |

### 7. `file_reader`

| Propriété | Valeur |
|-----------|--------|
| **Pattern** | Sub-agent via `asTool()` (claude-haiku-4-5, Anthropic) |
| **Formats** | PDF (pdf-parse), texte (UTF-8), images (métadonnées) |
| **Sécurité** | Vérifie propriété du document avant lecture |
| **Max turns** | 5 |

### 8. `web_search`

| Propriété | Valeur |
|-----------|--------|
| **Pattern** | Sub-agent via `asTool()` (gpt-4.1-mini, OpenAI — Responses API) |
| **API** | OpenAI Agents SDK webSearchTool() + Brave Search |
| **Langues** | FR + EN, résultats en français |
| **Citations** | Obligatoires (URL, date) |

### 9. `manage_skills`

| Propriété | Valeur |
|-----------|--------|
| **Actions** | add, update (pas de remove en Study) |
| **Niveaux** | BEGINNER, INTERMEDIATE, ADVANCED, EXPERT |
| **Origines** | SELF_DECLARED, AI_INFERRED, DOCUMENT_EXTRACTED, QUIZ_VALIDATED |
| **Dédoublonnage** | Vérification case-insensitive avant ajout |

### 10. `execute_action`

| Propriété | Valeur |
|-----------|--------|
| **Actions** | apply_opportunity, join_community, book_space, accept_invitation, decline_invitation |
| **Validation** | Existence entité + statut + permissions + pas de doublon |
| **Transaction** | Atomique (invitation + membership ensemble) |
| **Confirmation** | Requise via bloc confirmation côté frontend |

---

## 14. Copilote — Guardrails

### Input Safety Guardrail

| Propriété | Valeur |
|-----------|--------|
| **Modèle** | claude-haiku-4-5 (Anthropic) |
| **Exécution** | Parallèle avec l'agent principal |
| **Mode** | Fail-open (disponibilité > sécurité) |

**Classifications :**
| Catégorie | Action |
|-----------|--------|
| **SAFE** | Laissé passer |
| **OFF_TOPIC** | Laissé passer (agent gère) |
| **INJECTION** | BLOQUÉ (tentative override instructions) |
| **HARMFUL** | BLOQUÉ (contenu illégal, violence, discrimination) |

### Output Format Guardrail

| Propriété | Valeur |
|-----------|--------|
| **Mode** | Log uniquement (ne bloque PAS) |
| **Validations** | UUID format, champs entity cards, restrictions par mode |

**Règles par mode :**
| Mode | Entity cards | Limite texte |
|------|-------------|--------------|
| Explorer | Tous types | 800 chars |
| Study | AUCUN | 1200 chars |
| Organisation | entity:talent, entity:opportunity uniquement | 800 chars |

**Format entity card obligatoire :**
```
```entity:type {"id":"uuid-v4-format"}```
```

---

## 15. Copilote — Skills Library

### Structure

```
backend/src/services/copilot/skills/
├── skill.loader.ts          # Singleton cache + chargement
├── skill.types.ts           # Interfaces TypeScript
└── definitions/
    ├── cv-generation.skill.md
    ├── opportunity-publishing.skill.md
    ├── community-creation.skill.md
    ├── space-creation.skill.md
    ├── candidate-ranking.skill.md
    ├── salary-analysis.skill.md
    ├── interview-prep.skill.md
    └── skill-assessment.skill.md
```

### Skills disponibles (8)

| Skill | Mode | Déclencheurs | Description |
|-------|------|-------------|-------------|
| **CV Generation** | Explorer | "génère mon CV", "crée un CV" | Workflow complet de génération CV PDF |
| **Opportunity Publishing** | Organisation | "publie une offre", "recrute" | Publication d'offres avec smart defaults |
| **Community Creation** | Organisation | "crée une communauté" | Création communautés avec access types |
| **Space Creation** | Organisation | "crée un espace", "ajoute une salle" | Création espaces avec capacité/tarifs |
| **Candidate Ranking** | Organisation | "classement candidats", "meilleurs profils" | Tri candidats par score de matching |
| **Salary Analysis** | Explorer | "quel salaire", "benchmark salarial" | Recherche salaires marché via web_search |
| **Interview Prep** | Study | "prépare l'entretien" | Préparation entretien structurée + quiz |
| **Skill Assessment** | Study | "évalue-moi", "teste mon niveau" | Évaluation rapide en 3 questions |

### Format .skill.md

```markdown
---
name: Nom du Skill
description: Description courte pour l'agent
modes: explore, study, org
tools: sql_query, file_reader, vector_query
triggers: mot-clé1, mot-clé2, phrase utilisateur
---
# Instructions détaillées (markdown)
Workflow étape par étape...
```

### Chargement

- **Singleton pattern** : Cache en mémoire (comme ontology.cache)
- `loadAllSkillMetadata()` : Liste légère (~100 tokens) injectée dans le prompt
- `getSkillsForMode(mode)` : Filtre par mode
- `getSkillBody(skillId)` : Charge instructions complètes à la demande

---

## 16. Copilote — Streaming SSE

### Headers SSE

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
X-Accel-Buffering: no
```

### Types d'événements

| Événement | Payload | Description |
|-----------|---------|-------------|
| `text_delta` | `{ text }` | Fragment de texte (streaming caractère par caractère) |
| `tool_start` | `{ callId, name, args }` | Début d'appel outil |
| `tool_end` | `{ callId, name, summary, result, duration, status, error }` | Fin d'appel outil |
| `done` | `{ sessionId }` | Agent terminé |
| `error` | `{ error }` | Exception |
| `limit_reached` | `{ reason }` | Limite atteinte (20 tools ou 2 min) |

### Limites

| Limite | Valeur |
|--------|--------|
| Max tool calls par message | 20 |
| Max durée par tour | 120 secondes (2 min) |

### Gestion des pièces jointes

- **Documents :** Passés au FileReaderAgent (claude-haiku-4-5) avec documentId
- **Images :** Embedées en vision content (base64 data:// URLs) pour Claude Sonnet multimodal

---

## 17. Copilote — Actions & Confirmation

### Flux de confirmation

```
1. Agent détecte intention d'action
2. Agent génère un bloc confirmation dans la réponse :
   ```confirmation
   {
     "action": "apply_opportunity",
     "entity_id": "uuid",
     "title": "Titre de l'action",
     "description": "Détails",
     "confirm_label": "Confirmer",
     "cancel_label": "Annuler"
   }
   ```
3. Frontend affiche boutons Confirmer/Annuler
4. Utilisateur clique → POST /api/copilot/confirm
5. Backend valide + exécute la transaction
6. Réponse success + ID généré
```

### Actions supportées (8)

| Action | Validation | Résultat |
|--------|-----------|----------|
| `apply_opportunity` | Offre existe, OPEN, deadline pas dépassée, pas déjà candidat | Crée application (SUBMITTED) |
| `join_community` | Communauté existe, ACTIVE, pas déjà membre | Crée membership (MEMBER) |
| `book_space` | Espace ACTIVE, dates valides, pas de conflit | Crée booking (PENDING) |
| `accept_invitation` | Invitation existe, PENDING | Met à jour statut + crée membership |
| `decline_invitation` | Invitation existe, PENDING | Met à jour statut |
| `publish_opportunity` | Admin org vérifié, champs requis | Crée opportunité + embedding Pinecone |
| `create_community` | Admin org vérifié, nom unique | Crée communauté + admin member + embedding |
| `create_space` | Admin org vérifié, champs requis | Crée espace + embedding |

---

## 18. Application mobile React Native

### Stack mobile

| Technologie | Version |
|-------------|---------|
| React Native | 0.81.5 |
| Expo | 54.0.33 |
| Expo Router | 6.0.23 |
| React | 19.1.0 |
| TypeScript | 5.6.0 |

### Navigation (file-based routing)

```
mobile/app/
├── _layout.tsx                    # Root layout (providers)
├── index.tsx                      # Welcome/onboarding
├── (tabs)/                        # Navigation principale par onglets
│   ├── _layout.tsx
│   ├── home/index.tsx             # Dashboard, objectifs, actions rapides
│   ├── explore/index.tsx          # Browse opportunités/communautés/espaces
│   ├── assistant/index.tsx        # Copilote IA (1500+ lignes)
│   ├── gestion/index.tsx          # Gestion d'organisation
│   └── settings/index.tsx         # Paramètres utilisateur
├── auth/                          # Flux d'authentification
│   ├── welcome.tsx
│   ├── login.tsx                  # Email, Google (coming soon), WhatsApp (coming soon)
│   ├── email-login.tsx
│   ├── verify-otp.tsx
│   └── create-profile.tsx
├── details/                       # Écrans de détail
│   ├── opportunity/[id].tsx
│   ├── community/[id].tsx
│   ├── space/[id].tsx
│   ├── talent/[id].tsx
│   └── organization/[id].tsx
└── settings/                      # Sous-écrans paramètres
    ├── edit-profile.tsx
    ├── skills.tsx
    ├── documents.tsx
    ├── calendar.tsx
    ├── bookmarks.tsx
    ├── notifications.tsx
    ├── preferences.tsx
    ├── kyc.tsx
    ├── payment-methods.tsx
    ├── my-applications/
    ├── my-communities/
    ├── my-reservations/
    └── organization/
```

### State management (Context API)

| Context | Rôle |
|---------|------|
| **AuthContext** | Auth state, user data, tokens, organisation memberships |
| **ThemeContext** | Dark/light mode, palette couleurs |
| **I18nContext** | Langue (fr/en), fonction t() |
| **CopilotContext** | Mode, session, messages, loading state |
| **SpaceContext** | Switching espace organisation |
| **AlertContext** | Modales et alertes globales |

### Design system

- **Style :** Minimalisme africain luxueux
- **Principe :** Pas d'ombres, pas de gradients, couleurs sobres
- **Primaire :** Rich brown (#3B2416)
- **Sémantique :** Forest green (succès), terracotta (erreur), warm amber (warning)
- **Typographie :** Montserrat (400, 500, 600, 700)
- **Icônes :** Lucide React Native exclusivement
- **Dark mode :** Oui (détection système + override)

### Composants copilote (UI)

| Composant | Rôle |
|-----------|------|
| `MarkdownRenderer` | Rendu markdown avec entity cards, liens, tables |
| `EntityCard` | Carte entité cliquable (opportunité, communauté, etc.) |
| `ToolBlock` | Affichage exécution outil (nom, durée, statut) |
| `QuizBlock` | Quiz interactif (1 question) |
| `FlashcardBlock` | Carte mémoire recto/verso |
| `DiagramBlock` | Diagramme Mermaid (WebView) |
| `ImageBlock` | Image générée par IA |
| `CodeBlock` | Bloc de code avec syntaxe highlighting |
| `YouTubeBlock` | Vidéo YouTube intégrée |
| `ChartBlock` | Graphiques et charts |
| `ConfirmationBlock` | Boutons Confirmer/Annuler pour actions |
| `ThinkingIndicator` | Animation de réflexion |
| `PulsingOrb` | Orbe animée pendant le streaming |
| `SuggestionsTooltip` | Suggestions de conversation |
| `CopyButton` | Copier le texte |

### Services mobile (33 services)

- **API client** : Custom HTTP avec auto-refresh token, timeout 30s, FormData
- **Entités** : talent, opportunity, community, space, organization
- **Features** : application, booking, skill, document, payment
- **Communication** : notifications push (Expo SDK), messages
- **IA** : copilot streaming (XMLHttpRequest + SSE parsing)

### Notifications push

- **SDK :** Expo Notifications
- **Canaux :** iOS (APNs), Android (FCM)
- **Types :** MESSAGE, APPLICATION, MEMBERSHIP, BOOKING, REMINDER, MENTION, COMMENT_REPLY
- **Deep linking :** Notification → écran détail correspondant
- **Badge count :** Géré automatiquement

---

## 19. Application web Next.js

### Stack web

| Technologie | Version |
|-------------|---------|
| Next.js | 15.0.0 |
| React | 19.0.0 |
| TypeScript | 5.6.0 |

### Pages actuelles

- Site vitrine / landing page
- Conditions générales d'utilisation
- Politique de confidentialité

> Note : L'application web est actuellement minimale (site vitrine). L'application principale est le mobile React Native.

---

## 20. Intégrations externes

### IA & Machine Learning (3 providers)

| Service | Modèle | Usage | Coût estimé |
|---------|--------|-------|-------------|
| **Anthropic** | claude-sonnet-4-5 | Agents principaux (TalentAgent, OrgAgent) | $3/$15 per 1M tokens |
| **Anthropic** | claude-haiku-4-5 | Guardrails, titres, summaries, file_reader | $0.80/$4 per 1M tokens |
| **Google** | gemini-2.5-flash-lite | Suggestions, objectifs, bio | ~$0.02/$0.07 per 1M tokens |
| **OpenAI** | gpt-4.1-mini | Web search, vision/extraction | $0.40/$1.60 per 1M tokens |
| **OpenAI** | gpt-4.1-nano | Recommendations candidats | $0.10/$0.40 per 1M tokens |
| **OpenAI** | text-embedding-3-small | Embeddings vectoriels | $0.02 per 1M tokens |
| **OpenAI** | gpt-image-1 | Génération d'images | $0.02-$0.19 per image |
| **OpenAI** | whisper-1 | Transcription audio | $0.006 per minute |
| **OpenAI** | omni-moderation-latest | Moderation contenu (auto-moderation) | Gratuit |

### Cartographie complete : Service → Provider → Modele

| Service | Fichier | Provider | Modele | Pattern |
|---------|---------|----------|--------|---------|
| **Copilot — Agents principaux** | | | | |
| TalentAgent (explore) | `copilot/agents/talent.agent.ts` | Anthropic | claude-sonnet-4-5 | `run()` default provider |
| TalentAgent (study) | `copilot/agents/talent.agent.ts` | Anthropic | claude-sonnet-4-5 | `run()` default provider |
| OrgAgent | `copilot/agents/organization.agent.ts` | Anthropic | claude-sonnet-4-5 | `run()` default provider |
| **Copilot — Sub-agents** | | | | |
| FileReaderAgent | `copilot/tools/file-read.tool.ts` | Anthropic | claude-haiku-4-5 | `agent.asTool()` |
| WebSearchAgent | `copilot/tools/web-search.tool.ts` | OpenAI | gpt-4.1-mini | `agent.asTool()` + Responses API |
| **Copilot — Utilitaires** | | | | |
| Input guardrail | `copilot/guardrails/input.guardrail.ts` | Anthropic | claude-haiku-4-5 | `run()` default provider |
| Session summarizer | `copilot/session-summarizer.ts` | Anthropic | claude-haiku-4-5 | `run()` default provider |
| Session title | `copilot/stream/sse.handler.ts` | Anthropic | claude-haiku-4-5 | `run()` default provider |
| Suggestions prompt | `copilot/stream/sse.handler.ts` | Google | gemini-2.5-flash-lite | `Runner({ modelProvider: geminiProvider })` |
| Intent suggestions | `routes/copilot.ts` | Google | gemini-2.5-flash-lite | `Runner({ modelProvider: geminiProvider })` |
| **Copilot — Voice** | | | | |
| Transcription audio (STT) | `routes/copilot.ts` | OpenAI | whisper-1 | `getOpenAIClient().audio.transcriptions` |
| **Copilot — Images** | | | | |
| Generation images | `copilot/tools/generate-image.tool.ts` | OpenAI | gpt-image-1 | `getImageClient().images.generate` |
| **Suggestions formulaires** | | | | |
| Suggestions espaces | `space-generation.service.ts` | Google | gemini-2.5-flash-lite | `getGeminiClient().chat.completions` |
| Suggestions communautes | `community-generation.service.ts` | Google | gemini-2.5-flash-lite | `getGeminiClient().chat.completions` |
| Suggestions opportunites | `opportunity-generation.service.ts` | Google | gemini-2.5-flash-lite | `getGeminiClient().chat.completions` |
| Objectifs quotidiens | `daily-objective.service.ts` | Google | gemini-2.5-flash-lite | `getGeminiClient().chat.completions` |
| Generation bio | `routes/talents.ts` | Google | gemini-2.5-flash-lite | `getGeminiClient().chat.completions` |
| Assistant WhatsApp | `whatsapp-assistant.service.ts` | Google | gemini-2.5-flash-lite | `getGeminiClient().chat.completions` |
| **Vision & Extraction** | | | | |
| Extraction CV/documents | `documents/extraction.service.ts` | OpenAI | gpt-4.1-mini | `getOpenAIClient().chat.completions` (vision) |
| Verification KYC | `kyc-verification.service.ts` | OpenAI | gpt-4.1-mini | `getOpenAIClient().chat.completions` (vision) |
| Analyse docs organisation | `org-documents/org-document.service.ts` | OpenAI | gpt-4.1-mini | `getOpenAIClient().chat.completions` (vision) |
| **Matching & Recommendations** | | | | |
| Recommendations candidats | `recommendation.service.ts` | OpenAI | gpt-4.1-nano | `Runner({ modelProvider: openaiProvider })` |
| **Embeddings & Search** | | | | |
| Embeddings vectoriels | `embedding.service.ts` | OpenAI | text-embedding-3-small | `getEmbeddingClient().embeddings.create` |
| **Moderation** | | | | |
| Auto-moderation contenu | `auto-moderation.service.ts` | OpenAI | omni-moderation-latest | Direct `new OpenAI()` (timeout 5s) |

### Base de données vectorielle

| Service | Config |
|---------|--------|
| Pinecone | 4 namespaces, 1536-dim, cosine, index "etudesk" |

### Email (dual provider)

| Environnement | Provider | Config |
|---------------|----------|--------|
| Développement | Mailhog | SMTP localhost:1025, WebUI :8025 |
| Production | Resend | API key re_xxxxx |

### Paiements

| Service | Monnaie | Config |
|---------|---------|--------|
| Paystack | FCFA | sk_test/pk_test (dev), sk_live/pk_live (prod) |

### Recherche

| Service | Usage |
|---------|-------|
| Brave Search | Recherche web pour copilote |
| YouTube API v3 | Vidéos éducatives (Study mode) |

### Communication

| Service | Usage |
|---------|-------|
| Expo Push | Notifications iOS/Android |
| UltraMsg (WhatsApp) | Notifications WhatsApp (optionnel) |

### Authentification externe (coming soon)

| Service | Statut |
|---------|--------|
| Google OAuth | Configuré mais "coming soon" dans l'app |
| WhatsApp Login | Configuré mais "coming soon" dans l'app |

---

## 21. Infrastructure & Déploiement

### Variables d'environnement requises

```bash
# Application
PORT=3000
NODE_ENV=development|production

# Base de données
DATABASE_URL=postgresql://user:password@host:5432/etudesk

# Authentification
JWT_ACCESS_SECRET=<64+ chars hex>
JWT_REFRESH_SECRET=<64+ chars hex>
ADMIN_EMAILS=admin@etudesk.com

# Anthropic Claude (agents principaux, guardrails, summaries, file_reader)
ANTHROPIC_API_KEY=sk-ant-...

# Google Gemini (suggestions, objectifs, bio)
GOOGLE_API_KEY=AIza...

# OpenAI (images, STT, moderation, embeddings, web search, vision, recommendations)
OPENAI_API_KEY=sk-...

# Pinecone
PINECONE_API_KEY=...
PINECONE_INDEX=etudesk
PINECONE_HOST=https://...svc.pinecone.io

# Recherche
BRAVE_SEARCH_API_KEY=...
YOUTUBE_API_KEY=...

# Email
EMAIL_PROVIDER=smtp|resend
SMTP_HOST=localhost
SMTP_PORT=1025
# RESEND_API_KEY=re_...

# Paiements
PAYSTACK_SECRET_KEY=sk_test_...
PAYSTACK_PUBLIC_KEY=pk_test_...

# CORS
CORS_ORIGIN=http://localhost:5173,http://localhost:8081
```

### Docker (développement)

```yaml
# docker-compose.yml
services:
  mailhog:
    image: mailhog/mailhog:latest
    ports:
      - "1025:1025"    # SMTP
      - "8025:8025"    # WebUI
```

### Scripts

```bash
npm run dev              # Serveur dev avec hot-reload (tsx watch)
npm run build            # Compilation TypeScript
npm run start            # Serveur production
npm run db:drop-schema   # Drop + recreate schema public
npm run db:reset         # Reset complet (drop schema + migrate)
npm run db:recreate      # Supprime et recrée la base (optionnel)
npm run db:migrate       # Exécuter migrations
npm run seed:pinecone    # Initialiser vecteurs Pinecone
```

### Production

- **Process manager :** PM2 (ecosystem.config.js)
- **Branche :** deploy/production
- **Déploiement recommandé :** Node.js + PostgreSQL managé + Pinecone cloud

---

## 22. Programme d'affiliation

### Mécanisme

Chaque utilisateur peut parrainer d'autres talents vers un plan payant :

| Avantage | Détail |
|----------|--------|
| **Bonus crédits** | +10 crédits/jour pendant 1 mois par parrainage |
| **Plafond** | Maximum 100 crédits/jour total |
| **Corporate bonus** | 15% des revenus sur talents parrainés |
| **Éligibilité** | Tous les plans (Discover inclus) |

### Exemple

Un utilisateur Talent (30 crédits/jour) parraine 3 amis qui souscrivent :
- Mois 1 : 30 + (3 x 10) = 60 crédits/jour
- Mois 2+ : Retour à 30 crédits/jour (bonus expire)
- Si 8+ parrainages actifs : plafonné à 100 crédits/jour

---

## 23. Annexes

### A. Documentation existante

| Fichier | Description |
|---------|-------------|
| `docs/ontology.md` | Ontologie complète (entités, relations, enums, règles métier) |
| `docs/COPILOT_AGENT_ARCHITECTURE.md` | Architecture agents, tools, handoffs, SSE |
| `docs/COPILOT_AGENT_PERIMETER.md` | 3 modes, 20+ exemples, 8 use cases |
| `docs/COPILOT_TOOLS_DOCUMENTATION.md` | 8 outils avec cas de test réels |
| `docs/AI_MODELS_DOCUMENTATION.md` | Architecture multi-provider (Anthropic + Gemini + OpenAI) |
| `docs/OPENAI_AGENTS_SDK_DOCUMENTATION.md` | SDK primitives, memory, streaming |
| `docs/AI_AGENT_DESIGN_GUIDE.md` | Best practices design agents |
| `docs/copilot-calibration-audit.md` | 14 tests calibration (100% pass) |

### B. Gotchas critiques

1. **Zod v4.3.5** : Tous les paramètres d'outils DOIVENT être dans `required` (pas de `.optional()` → erreur 400 OpenAI)
2. **Entity cards** : Format `{"id":"uuid"}` UNIQUEMENT — jamais de champs supplémentaires
3. **Mode Study** : AUCUN entity card, AUCUN vector_query, pas de suppression de skills
4. **Template literals** : Éviter les backticks dans les prompts (conflit JS)
5. **IDOR** : talentId TOUJOURS injecté côté serveur, JAMAIS depuis les paramètres LLM

### C. Métriques de calibration copilote

| Métrique | Explorer | Study | Organisation |
|----------|----------|-------|--------------|
| Longueur réponse | 300-950 chars | 850-1250 chars | 560-1660 chars |
| Questions posées | 0-1 | 0-1 | 0 |
| Appels outils | 1-5 | 0-1 | 1-3 |
| Taux de réussite | 5/5 (100%) | 5/5 (100%) | 4/4 (100%) |

### D. Modèles de coûts IA (estimation)

| Usage | Modèle | Provider | Coût/requête (estimé) |
|-------|--------|----------|----------------------|
| Message copilote (Explorer) | claude-sonnet-4-5 | Anthropic | ~$0.03-0.08 |
| Message copilote (Study) | claude-sonnet-4-5 | Anthropic | ~$0.02-0.05 |
| Sub-agent (file_reader) | claude-haiku-4-5 | Anthropic | ~$0.005-0.01 |
| Sub-agent (web_search) | gpt-4.1-mini | OpenAI | ~$0.005-0.01 |
| Guardrail input | claude-haiku-4-5 | Anthropic | ~$0.002 |
| Titre session | claude-haiku-4-5 | Anthropic | ~$0.001 |
| Suggestions | gemini-2.5-flash-lite | Google | ~$0.0005 |
| Recommendations | gpt-4.1-nano | OpenAI | ~$0.001 |
| Embedding | text-embedding-3-small | OpenAI | ~$0.0001 |
| Image | gpt-image-1 | OpenAI | $0.02-0.19 |

---

> **Document mis à jour le 14 Février 2026** — Architecture multi-provider AI (Anthropic + Gemini + OpenAI)
