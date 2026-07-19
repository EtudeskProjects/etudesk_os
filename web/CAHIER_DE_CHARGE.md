# Cahier de charge - Site vitrine Etudesk

> Site marketing multi-pages de **Etudesk** et de son application **Etudesk OS**.
> Version 2.0 - 26 juin 2026.
> Stack : Next.js 15 (App Router) + styled-jsx, dans `web/`.
> Cible business : jeunes talents d'Afrique de l'Ouest francophone (etudiants, jeunes professionnels, autodidactes).

---

## 1. Vision et positionnement

### La promesse

> **Forme-toi aux competences du digital a la vitesse du marche, et transforme-les en opportunites.**

Etudesk n'est ni un catalogue de cours, ni un simple chatbot. C'est une **carte vivante des competences du digital** - un referentiel proprietaire, mis a jour en continu - sur laquelle deux intelligences accompagnent chaque talent : une pour **apprendre**, une pour **avancer**. Le marche bouge vite (l'IA l'a prouve) ; les programmes classiques arrivent toujours en retard, en anglais, en presentiel, deconnectes du debouche local. Etudesk prend le contre-pied.

### L'insight : le marche est coupe en deux, nous le recousons

Aujourd'hui, apprendre et trouver un emploi sont deux mondes separes : d'un cote les plateformes de cours et tuteurs IA, de l'autre les outils de matching et de carriere. Par ailleurs, les **graphes de competences** les plus riches existent deja - mais ils sont enfermes dans des logiciels RH vendus aux grandes entreprises pour la mobilite interne. **Personne ne met cette carte entre les mains du talent lui-meme.**

Etudesk fait les deux a la fois, sur une seule colonne vertebrale : le referentiel. Une competence apprise avec le tuteur devient immediatement un critere d'opportunite pour le guide carriere. C'est la **boucle fermee** competence -> maitrise -> opportunite. C'est ce que personne d'autre ne propose au grand public, et encore moins en francais, sur mobile, pour l'Afrique de l'Ouest.

### Pourquoi nous sommes sur la bonne voie (a transmettre implicitement, jamais en attaque frontale)

- **A jour, quand les autres sont figes.** Les standards mondiaux se rafraichissent sur des cycles longs et institutionnels ; notre referentiel suit la vitesse de sortie des outils et des metiers.
- **Pedagogique, quand les autres sont administratifs.** Notre graphe ne se contente pas d'etiqueter une competence : il sait ce qui vient avant, a cote et avec. Il donne toujours un prochain pas.
- **Pour le talent, quand les autres servent les RH.** La carte des competences est mise dans la poche du jeune, pas dans le tableau de bord d'un DRH.
- **Africain et francophone par conception, pas par traduction.** L'offre de reference est anglophone et pensee pour des marches occidentaux. Nous encodons la realite du marche ivoirien et regional, langue comprise.
- **Continu et sans barriere, quand les autres sont des bootcamps selectifs.** Pas de test d'admission, pas de cohorte, pas de diplome requis. On commence gratuitement, depuis son telephone.

### Heritage qui credibilise

Depuis **2016**, Etudesk a forme **plus de 50 000 personnes dans plus de 17 pays**, pour **400+ organisations** (PME, grands groupes, gouvernements, institutions). D'abord connu comme "l'universite des entreprises" (plateforme e-learning), Etudesk est devenu une plateforme de **competences et d'employabilite augmentee par l'IA**. Le site doit ancrer cette continuite : une marque eprouvee qui prend le virage de l'IA, pas une promesse sortie de nulle part.

---

## 2. Cible et insights marche (contexte pour la redaction)

### Le talent vise

Talents francophones et internationaux qui veulent progresser dans les competences numeriques : etudiants, jeunes professionnels, autodidactes et personnes en reconversion. Ambitieux, mobiles, sensibles a la valeur concrete des apprentissages, en quete d'employabilite mesurable. Ton attendu : **tutoiement**, direct, fier, aspirationnel. **Eviter** le registre ONG / charite : parler reussite, autonomie, vitesse, opportunite.

### Les frictions reelles a lever

- **L'emploi manque** : environ 12 millions de jeunes arrivent chaque annee sur le marche du travail africain pour ~3 millions d'emplois formels ; plus de 230 millions d'emplois exigeront des competences numeriques d'ici 2030.
- **L'inadequation formation/marche** est massive (sous-qualification, sous-education pour le poste occupe).
- **Le mobile est le seul ecran** et la data coute cher : la legerete et le **gratuit pour demarrer** sont decisifs.
- **L'offre de reference est anglophone** (les grands programmes panafricains exigent souvent un test d'anglais), en **cohortes longues et selectives**, **deconnectee de l'opportunite locale** et du **paiement en FCFA**.

### Ce qui nous differencie reellement

Aucun acteur ne combine : **mobile-first + francais natif + IA personnalisee (tuteur + guide carriere) + referentiel local vivant + lien direct vers l'opportunite + paiement FCFA + demarrage gratuit**. C'est le creneau a occuper.

---

## 3. Le referentiel Etudesk (notre socle et notre preuve)

Le referentiel `etudesk_digital_skills` (version `2026-Q2`) est le coeur de credibilite de la marque. A exposer publiquement (page Digital Skills) comme preuve de serieux.

- **1211 competences**, **16 familles**, **5 types** : `knowledge` (Savoir), `hard_skill` (Competence technique), `soft_skill` (Savoir-etre), `tool_platform` (Outil / Plateforme), `language` (Langage).
- **Un graphe de 4009 relations typees** entre competences : `prerequisite` (prerequis), `sibling` (voisines, meme famille), `co_occurrence` (souvent associees). C'est ce graphe qui transforme un catalogue en **parcours d'apprentissage**.
- **Une evaluation rigoureuse** : chaque competence d'un talent est notee sur 4 axes (Autonomie, Complexite, Impact, Transmission), sur 4 niveaux (debutant -> maitre). Le niveau Maitre ne s'auto-declare pas : il s'obtient par la pratique. Les competences ont un etat de fraicheur (active / a rafraichir / archivee).
- **Mis a jour en continu**, au rythme du marche (nouvelles competences IA, nouveaux outils, nouveaux metiers).

### Positionnement face aux referentiels existants (contexte interne, a traduire en wording sobre)

Les standards mondiaux existent et sont respectables - mais structurellement differents de ce qu'un jeune talent africain a besoin :

- Les classifications institutionnelles (type ESCO, O*NET) sont ancrees sur les metiers et rafraichies sur des cycles longs ; pensees pour des marches occidentaux, en anglais.
- Les bibliotheques de competences issues des offres d'emploi (type Lightcast) sont vastes mais minees sur un signal de marche occidental, anglophone, et servent le matching, pas la pedagogie.
- Les graphes de competences les plus riches (cote intelligence RH) sont fermes et vendus aux entreprises.

**Notre angle** : un referentiel **granulaire, vivant, structure en graphe d'apprentissage, africain et francophone par conception, et place entre les mains du talent**. Interoperable plutot qu'antagoniste : on peut faire correspondre nos identifiants aux standards mondiaux pour la lisibilite internationale, tout en gardant notre graphe comme couche locale, vivante et orientee apprentissage que les standards ne peuvent pas etre.

---

## 4. L'experience produit (ce que le site doit faire comprendre)

L'application **Etudesk OS** met le referentiel en action via une experience IA, structuree autour de deux gestes complementaires :

- **Apprendre - le tuteur.** Il explique, contextualise sur ton profil, et te fait pratiquer (quiz, flashcards, exercices, resolution pas a pas, playground de code, diagrammes, audio, recommandations video). Il ne se contente pas de donner la reponse : il te guide jusqu'a la comprehension.
- **Avancer - le guide carriere.** Il relie tes competences a de vraies opportunites (emplois, stages, missions, formations), genere ton CV, te prepare aux entretiens, te recommande communautes et espaces. Le matching score la compatibilite reelle (competences, localisation, experience, secteur, type de travail).

> Le site presente l'experience par ce qu'elle **permet** (apprendre, avancer), sans la reduire a une liste figee d'agents, et **sans evoquer la partie organisations / recruteurs** (hors perimetre du pivot talent).

### Acces et modele

- **Les 30 premiers credits sont offerts** a l'inscription : c'est le principal levier de conversion. Combine aux actions gratuites, cela represente un large volume de formation offert (voir section 9).
- **Recharge prepayee en FCFA** (Mobile Money / Paystack), a son rythme, sans abonnement impose.
- **Etudesk OS n'est accessible que sur les stores** (iOS / Android). Le site presente, explique et renvoie vers les stores ; il n'y a aucune application web fonctionnelle. Seule exception interactive publique : l'observatoire **Digital Skills**.

---

## 5. Objectifs du site

1. **Affirmer la promesse** : se former aux competences du digital a la vitesse du marche, et les transformer en opportunites.
2. **Faire comprendre la boucle** : un meme referentiel, un tuteur pour apprendre, un guide pour avancer.
3. **Prouver le serieux** : exposer le referentiel vivant (Digital Skills) et l'heritage (50 000+ formes, 17 pays).
4. **Convertir** : telechargements de l'app, portes par l'argument des 30 credits offerts.
5. **Referencer (SEO)** : pages competences et Stories pour capter la recherche organique des jeunes talents francophones.
6. **Incarner la marque** : epure, accessible, moderne, grand public.

**Cible** : talents francophones d'Afrique de l'Ouest (FR prioritaire, EN disponible).

---

## 6. Arborescence et menu

### Menu principal (header, sticky)

```
[Logo Etudesk]   Digital Skills   Etudesk OS   Stories   Qui sommes-nous     [FR/EN] [theme] [Telecharger]
```

- **Digital Skills** -> `/digital-skills` (observatoire du referentiel)
- **Etudesk OS** -> `/etudesk-os` (l'application, accessible sur les stores)
- **Stories** -> `/stories` (blog)
- **Qui sommes-nous** -> `/qui-sommes-nous`
- CTA **Telecharger** : bouton primaire vers les stores.
- Toggles **FR/EN** et **clair/sombre** (via `ThemeContext`).

### Arborescence

```
/                  Accueil
/digital-skills    Observatoire des competences (referentiel + relations)
/etudesk-os        Presentation de l'application (store-only)
/stories           Liste des articles (blog)
/stories/[slug]    Article
/qui-sommes-nous   Marque, mission, equipe
/privacy           Politique de confidentialite
/terms             Conditions d'utilisation
/mentions-legales  Mentions legales
/billing/callback  Callback paiement Paystack (technique)
/ops-48957d        Backoffice interne (hors menu)
```

Redirection `308 /observatoire -> /digital-skills`.

### Footer (global)

- **Produit** : Digital Skills, Etudesk OS, Telecharger.
- **Entreprise** : Qui sommes-nous, Stories, Contact.
- **Legal** : Confidentialite, Conditions, Mentions legales.
- Bandeau : logo, baseline, reseaux (Facebook, LinkedIn, X, Instagram, YouTube, TikTok), copyright.

---

## 7. Design system

Esthetique **noir & blanc, grand public, accessible, minimaliste, aeree**. Source de verite : le design system de l'application (`mobile/src/constants/theme.ts`), porte en variables CSS dans `web/src/app/globals.css`.

### Philosophie

- **Canvas strictement monochrome** : echelle de gris "zinc" (neutre, sans sous-ton chaud) + noir + blanc.
- **La couleur ne porte que du sens**, jamais de decoration :
  1. les etats semantiques (succes / erreur / alerte / info) ;
  2. les **5 types de competences** (la seule "couleur metier", signature du produit).
- **Pas d'ombres lourdes, pas de degrades.**
- **Regle de lecture** : la couleur dit **quoi** (type / etat), l'intensite de gris dit **combien** (niveau de maitrise).

### Couleurs

- **Primaire** : noir encre `#18181B` (clair) / `#FAFAFA` (sombre).
- **Neutres (zinc)** : `#FAFAFA #F4F4F5 #E4E4E7 #D4D4D8 #A1A1AA #71717A #52525B #3F3F46 #27272A #18181B`, inversees en sombre.
- **Semantiques** : succes `#16A34A`, erreur `#DC2626`, alerte `#D97706`, info `#2563EB`.
- **5 types de competences** (la couleur metier, utilisee pour les badges de type partout) :

| Type | Libelle | Couleur (clair / sombre) | Fond (clair) |
|------|---------|--------------------------|--------------|
| `knowledge` | Savoir | `#1D4ED8` / `#60A5FA` | `#EAF1FE` |
| `hard_skill` | Competence technique | `#0E7490` / `#22D3EE` | `#E4F5F9` |
| `soft_skill` | Savoir-etre | `#BE185D` / `#F472B6` | `#FCE9F1` |
| `tool_platform` | Outil / Plateforme | `#6D28D9` / `#A78BFA` | `#F1EAFD` |
| `language` | Langage | `#047857` / `#34D399` | `#E3F4ED` |

La couleur encode le **type**, jamais la famille. Les familles sont monochromes, differenciees par une **icone**.

### Typographie, espacement, formes

- **Police** : Montserrat (400/500/600/700), partagee mobile + web.
- **Tailles** (lisibilite grand public) : base ~17px, captions 13px, labels 15px, sous-titres 22px, titres de section 26px, titres de page 34px, hero 44px.
- **Espacement** : grille 4px, sections aerees (28 / 36 / 48 / 64).
- **Rayons** : 4 / 8 / 12 / 16 / 20 / 24 / pill.

### Icones

- **Lucide uniquement**, inline SVG, **`strokeWidth="1.25"`** systematique (`fill="none"`, jointures arrondies). Exceptions : logos de marque (Apple/App Store, Google Play, reseaux, moyens de paiement), qui restent des glyphes pleins.

### Composants partages a creer

`SiteHeader`, `SiteFooter`, `StoreButtons`, `Section`, et un module i18n centralise (FR/EN) - pour eviter la duplication de la navigation et des dictionnaires entre pages.

---

## 8. Specifications page par page

### 8.1 Accueil `/`

**Objectif** : poser la promesse (apprendre + avancer sur une carte vivante) et pousser le telechargement avec les 30 credits offerts.

1. **Hero** : video de fond + overlay.
   - Titre : la promesse, par exemple "Les competences du digital, a la vitesse du marche."
   - Sous-titre : ton tuteur IA t'explique, ton guide carriere IA te trouve l'opportunite.
   - Badge : **"30 credits offerts a l'inscription"**.
   - CTA stores.
2. **La boucle** (coeur du message) : un meme referentiel, deux gestes.
   - **Apprendre - le tuteur** : explications, quiz, exercices, contextualises sur ton profil.
   - **Avancer - le guide carriere** : tes competences reliees a de vraies opportunites.
   - Visuel : la meme carte de competences qui relie les deux.
3. **Le referentiel vivant** : bandeau de preuve (1211 competences, 16 familles, 5 types, mis a jour en continu), apercu, CTA "Explorer l'observatoire" -> `/digital-skills`.
4. **Comment ca marche** : 3 etapes (Cree ton profil -> Forme-toi sur les competences du marche -> Avance vers des opportunites).
5. **Preuve et confiance** : heritage (50 000+ formes, 17 pays depuis 2016), demarrage gratuit, francais natif, paiement FCFA, rigueur d'evaluation.
6. **CTA final stores** + rappel des 30 credits offerts.
7. **Footer**.

### 8.2 Digital Skills `/digital-skills`

**Objectif** : faire decouvrir l'univers des competences du digital. Le talent doit ressortir **impressionne par la qualite de l'information**, dans une experience **sobre, claire, minimaliste et optimisee mobile**. Toute intention de formation renvoie a l'app.

**Principes directeurs**

1. **Clarte** : une chose a la fois, hierarchie nette, beaucoup de blanc.
2. **Navigation evidente** : on sait toujours ou on est (famille / type / recherche / detail) et comment revenir.
3. **Filtres clairs et minimalistes**, accessibles au pouce sur mobile.
4. **Mobile-first** : une colonne et filtres compacts sur petit ecran, enrichi en 2-3 colonnes et panneau lateral sur grand ecran.
5. **La qualite impressionne par les relations**, pas par la decoration.

**Couleurs et icones (referentiel mobile)**

- La couleur encode le **type**, avec son icone Lucide : `knowledge` BookOpen (bleu), `hard_skill` Wrench (cyan), `soft_skill` Users (rose), `tool_platform` Boxes (violet), `language` Languages (emeraude).
- Les **familles** sont monochromes, differenciees par une icone Lucide. Proposition : IA `BrainCircuit`, Donnees `Database`, Dev `Code2`, Cloud `Cloud`, Cyber `ShieldCheck`, Produit/Design `PenTool`, Growth `TrendingUp`, Media `Clapperboard`, Fintech `Landmark`, Web3 `Blocks`, Emergentes `Atom`, Business `Briefcase`, Humaines `HeartHandshake`, Secteurs `Factory`, Durabilite `Leaf`, Litteratie `GraduationCap`.

**Structure**

1. **Hero sobre** : titre court, une phrase, stats discretes (1211 / 16 / 5, version 2026-Q2).
2. **Recherche + filtres** (sticky) : recherche plein texte accent-insensible et instantanee ; filtre **Type** (5 pastilles icone + couleur) ; filtre **Famille** (chips defilantes sur mobile). Sur mobile, filtres en barre compacte ou bottom-sheet.
3. **Vue par defaut - les 16 familles** : grille de cartes monochromes (icone + nom + compteur + courte description).
4. **Vue competences** (famille selectionnee ou recherche active) : cartes avec nom (FR/EN), **chip de type colore avec icone**, famille ; compteur ; pagination propre.
5. **Detail d'une competence** (la piece maitresse - panneau lateral sur grand ecran, plein ecran sur mobile) : nom, type, famille, puis les relations issues du graphe :
   - **Prerequis** (a apprendre avant), **Mene vers** (ce que ca debloque), **Voisines** (meme famille), **Souvent associees**.
   - Chaque competence reliee est une puce cliquable (icone de son type) qui recentre le detail : navigation par exploration, sans graphe illisible.
   - Phrase pedagogique ("Pour maitriser X, commence par ses prerequis ; ces competences vont souvent ensemble") = parcours d'apprentissage rendu visible.
   - **CTA "Me former" -> stores**.

**Donnees** : `competencies.json` (1687, depuis `competency_catalog.csv`) et `edges.json` (index par slug : prerequis / mene-vers / voisines / associees, depuis `competency_edges.csv`, ~304KB, charge en lazy sur cette page). Generation branchee en `prebuild` pour rester synchrone avec le referentiel.

**Option (v1.1, non bloquante)** : une visualisation graphe canvas ego-centree (jamais les 1687 noeuds d'un coup), avec la vue liste comme equivalent accessible.

### 8.3 Etudesk OS `/etudesk-os`

**Objectif** : presenter l'application. Aucune fonctionnalite web : chaque bloc se termine par un CTA store.

1. **Hero produit** : mockups, "Disponible sur iOS et Android", 30 credits offerts.
2. **L'experience IA, branchee sur le referentiel** (section phare), presentee par ce qu'elle permet :
   - **Apprendre (tuteur)** : plans d'apprentissage, explications, certifications utiles. Pratique riche : quiz, flashcards, exercices, resolution pas a pas, playground de code (JS/Python), diagrammes, audio, recommandations video.
   - **Avancer (guide carriere)** : opportunites adaptees, generation de CV, preparation d'entretiens, recommandations de communautes et d'espaces. Matching sur compatibilite reelle.
3. **Decouvrir l'ecosysteme** : opportunites (emplois, stages, missions, formations), communautes, espaces ; tri par pertinence/proximite/recence, recherche, favoris.
4. **Tes competences** : declaration depuis le referentiel, niveaux debutant -> maitre, suivi de progression, validation par la pratique.
5. **Ton profil et ta carriere** : profil, documents (CV, certificats), candidatures, reservations, invitations.
6. **Multimodal** : texte, voix (transcription), pieces jointes (PDF/images).
7. **Multilingue** : plusieurs langues (FR, EN et au-dela).
8. **Onboarding express** : connexion email + code, profil en quelques etapes.
9. **Modele simple** : les 30 credits offerts, recharge en FCFA (voir section 9).
10. **CTA stores final** + QR code (desktop -> mobile).

### 8.4 Stories `/stories`

**Objectif** : SEO, pedagogie et preuve sociale (parcours de talents, guides competences, conseils carriere).

- **Liste** : grille de cartes (image, categorie, titre, extrait, date, temps de lecture), filtre par categorie (Apprentissage, Carriere, Competences, Temoignages, Produit).
- **Article** `/stories/[slug]` : titre, meta, couverture, corps, **CTA store en fin d'article**, articles relies.
- **Contenu** : **MDX local** (`web/src/content/stories/*.mdx`, frontmatter `title, slug, excerpt, cover, category, author, date, lang`). Versionne avec le code, SSG, zero infra. Bilingue via `lang` + `translationKey`. Sitemap et Open Graph par article.

### 8.5 Qui sommes-nous `/qui-sommes-nous`

**Objectif** : incarner la marque et creer la confiance par l'heritage.

1. **Manifeste** : democratiser les competences numeriques ; mettre un tuteur et un guide carriere dans la poche de chaque talent.
2. **Notre histoire** : depuis 2016, "l'universite des entreprises" ; 50 000+ personnes formees, 400+ organisations, 17 pays ; aujourd'hui une plateforme de competences et d'employabilite augmentee par l'IA.
3. **Notre approche** : le referentiel vivant comme socle, les agents IA comme experience.
4. **Reconnaissance** (a verifier avant publication) : Seedstars (2016), Digital Africa (2017), finaliste du Next Billion EdTech Prize (Dubai, 2019), societe en portefeuille I&P, collaborations avec la Fondation Mastercard. **Mention "finaliste"** pour le Next Billion, pas "laureat".
5. **Equipe** : grille de 4 cartes (photo, nom, role, bio courte, lien LinkedIn).

| Nom | Role | Bio courte (site) | LinkedIn |
|-----|------|-------------------|----------|
| **Lamine BARRO** | Co-fondateur & CEO | 10 ans a la tete d'Etudesk. Executive-MBA HEC Paris. Consultant innovation du Gouvernement ivoirien. Experience terrain dans 36 pays. | _a fournir_ |
| **Wilfried DALI** | Co-fondateur & DGA | Expert du deploiement de plateformes d'apprentissage : 60+ ecoles en Afrique de l'Ouest. | _a fournir_ |
| **Eddy ASSOHOUN** | CTO | Ingenieur full-stack, experience internationale. Architecte technique d'Etudesk OS. | _a fournir_ |
| **Hasma GBANE** | Assistante des Operations | Flux operationnels, support et coordination de l'equipe. | _a fournir_ |

6. **Valeurs** : clarte, sobriete, exigence, accessibilite, communaute.
7. **CTA** : rejoindre l'aventure (stores) + lien Stories.

> **Confidentialite** : ne pas publier les contacts directs (telephones, emails personnels) ni la repartition du capital. **Partenaires a ne pas afficher sans source verifiee.** Photos d'equipe a exporter vers `web/public/images/team/`.

### 8.6 Pages legales

`/privacy`, `/terms`, `/mentions-legales` : conserver et harmoniser au design system. `/billing/callback` (technique) et `/ops-48957d` (backoffice, hors menu) inchanges.

---

## 9. Modele de credits (valeurs reelles a refleter)

- **30 credits offerts** a l'inscription.
- **Recharge prepayee en FCFA** (Mobile Money / Paystack), sans abonnement.

Cout par action (talent) :

| Action | Cout (credits) |
|--------|---------------|
| Apprendre - tuteur (requete) | **1** |
| Avancer - guide carriere (requete) | 1 |
| Generation de document (CV, etc.) | 1 |
| Generation d'image | 1 |
| Recherche web / video | **0** |
| Quiz / Flashcards / Diagrammes | **0** |
| Instruction vocale | **0** |
| Postuler / Reserver / Adherer | **0** |

**Argument cle** : 30 credits offerts + requete IA a 1 credit + quiz, flashcards et diagrammes gratuits = un large volume de formation offert des l'inscription. A mettre en avant. La grille de recharge chiffree sera publiee une fois figee.

---

## 10. Composants transverses et responsive

- **Header / Footer / StoreButtons** partages ; CTA stores present sur chaque page (hero + fin de page).
- **Cookies / consentement** : option la plus respectueuse par defaut si analytics.
- **Etats vides / erreurs** : degradation propre (ex. Digital Skills sans `edges.json` -> vue liste).

### Responsive : optimise grand ecran ET mobile (sur toutes les pages)

Chaque page doit etre **pleinement optimisee sur grand ecran comme sur mobile**. Aucune page "desktop only" ni "mobile only".

- **Mobile-first**, puis enrichissement.
- **Breakpoints** : mobile < 768px (1 colonne), tablette 768-1024px (2 colonnes), grand ecran > 1024px (2-3 colonnes, contenu max ~1200px centre).
- **Grilles** : familles 1 -> 2 -> 4 colonnes ; cartes 1 -> 2 -> 3 colonnes.
- **Navigation mobile** : menu en bottom-sheet, filtres compacts, cibles tactiles >= 44px.
- **Detail competence** : panneau lateral sur grand ecran, feuille plein ecran sur mobile.
- **Typographie fluide** (`clamp()`), **medias** `next/image` responsives, video hero allegee sur mobile.
- **Aucun scroll horizontal** ; teste de 360px a >= 1440px.
- **Verification** : capture clair + sombre, mobile + grand ecran, avant livraison de chaque page.

---

## 11. Technique, donnees, SEO, performance

### Donnees (statiques, generees depuis les datasets)

- `competencies.json` : depuis `competency_catalog.csv` (1687).
- `edges.json` : depuis `competency_edges.csv` (8892) ; index par slug `{ prerequis, mene-vers, voisines, associees }`, trie par force, cape a 12 par categorie.
- Script de generation branche en `prebuild` pour rester synchrone avec le referentiel (version `2026-Q2`).

### i18n

- Dictionnaires FR/EN centralises dans `web/src/i18n/`, toggle conserve. Pas de librairie lourde necessaire.

### SEO / performance

- **SSG** par defaut ; observatoire et graphe en composants client charges en dynamic import.
- Metadonnees par page (title, description, Open Graph, Twitter).
- `sitemap.xml` + `robots.txt` (inclure Stories).
- `next/image`, formats optimises, lazy ; `edges.json` charge uniquement sur Digital Skills.
- Cible Lighthouse >= 90 (perf / SEO / accessibilite).
- Redirection `308 /observatoire -> /digital-skills`.

---

## 12. Bibliotheque de wording (FR)

Accroches et formulations qui resonnent avec la cible. A piocher selon l'emplacement, en gardant un ton **tutoyant, direct, fier, aspirationnel** (jamais ONG / charite).

**Promesse / hero**
- "Les competences du digital, a la vitesse du marche."
- "Forme-toi aux competences du digital, et transforme-les en opportunites."
- "Ton tuteur IA t'explique. Ton guide carriere IA te trouve l'opportunite."

**Differenciation (implicite)**
- "Pas un bootcamp. Un coach qui ne dort jamais."
- "Une meme carte des competences, du premier cours a l'opportunite."
- "Le referentiel des competences qui comptent vraiment - mis a jour en continu."
- "Forme-toi en francais, a la vitesse du marche."

**Acces / friction zero**
- "Commence gratuitement, depuis ton telephone."
- "30 credits offerts. Aucune carte requise."
- "Paie en FCFA, a ton rythme. Sans abonnement."

**Cible / aspiration**
- "De l'autodidacte au talent recherche."
- "Des competences numeriques aux vraies opportunites, partout."
- "Pas de test d'admission. Pas de cohorte. Juste toi et ton prochain pas."

**Preuve / confiance**
- "Depuis 2016, plus de 50 000 personnes formees dans 17 pays."

**A eviter** : jargon RH ("mobilite interne", "upskilling de la workforce"), ton institutionnel ou caritatif, promesses d'emploi garanti, comparaisons frontales nommant les concurrents.

---

## 13. Lots de livraison et priorisation

| Lot | Contenu | Priorite |
|-----|---------|---------|
| **L0 - Socle** | `globals.css` (design system monochrome + 5 couleurs de type), composants partages (Header, Footer, StoreButtons), i18n centralise, redirection `/observatoire`. | P1 |
| **L1 - Accueil** | Landing autour de la boucle (apprendre + avancer) et des 30 credits offerts. | P1 |
| **L2 - Digital Skills** | Observatoire `/digital-skills` : couleurs + icones par type, familles monochromes, decouvrabilite via les relations (prerequis / voisines / associees), filtres clairs, mobile-first. `edges.json` + script de generation. | P1 |
| **L3 - Etudesk OS** | Page produit (experience IA, ecosysteme, credits, store-only). | P2 |
| **L4 - Stories** | Blog MDX (liste, article, SEO, sitemap). | P2 |
| **L5 - Qui sommes-nous** | Marque, histoire, equipe (contenu et liens fournis par Lamine). | P3 |

Dependances : L0 avant tout. L2 depend du script de generation des donnees.

---

## 14. Criteres de succes (KPI)

- Taux de clic vers les stores (CTA) par page.
- Telechargements attribues au site (UTM sur les liens stores).
- Trafic organique sur `/digital-skills` et `/stories`.
- Profondeur d'exploration sur Digital Skills (relations parcourues).
- Conversion visiteur -> inscription app.
