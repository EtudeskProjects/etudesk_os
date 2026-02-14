# Audit Copilot Skills & Prompts — 14 fevrier 2026

## Perimetre audite

| Composant | Quantite | Fichiers |
|---|---|---|
| Skills (.skill.md) | 24 | definitions/*.skill.md |
| Prompts systeme | 3 | talent-study, talent-explorer, org-explorer |
| Tools | 12 | sql_query, vector_query, web_search, file_reader, generate_document, generate_image, generate_diagram, youtube_search, execute_action, manage_skills, cv-pdf-generator, org-document-pdf-generator |
| Context/Types | 4 | context.ts, context-options.ts, types.ts, ontology.cache.ts |
| Agents | 3 | talent.agent.ts, org.agent.ts, uemoa-knowledge.ts |

---

## A. BUGS CRITIQUES (P0) — A corriger immediatement

### BUG 1 : interview-prep — generate_document manquant dans frontmatter
**Fichier** : `definitions/interview-prep.skill.md`
**Probleme** : Les instructions appellent `generate_document` (PDF guide de preparation) mais le frontmatter ne liste que `sql_query, file_reader, web_search`.
**Impact** : L'agent peut echouer a generer le PDF car le tool n'est pas declare.
**Fix** : Ajouter `generate_document` aux tools du frontmatter.

### BUG 2 : cv-generation — triggers "lettre de motivation" sans workflow
**Fichier** : `definitions/cv-generation.skill.md`
**Probleme** : Les triggers incluent `lettre de motivation, cover letter, lettre` mais aucune instruction de generation de lettre n'existe dans le workflow. L'agent declenche cv-generation au lieu de generer une lettre.
**Impact** : Mauvaise experience user — "genere ma lettre de motivation" → recoit un CV.
**Fix** : Option A (recommandee) — Creer un skill `cover-letter-generation` dedie en mode explore. Option B — Retirer les triggers lettre de cv-generation.

### BUG 3 : space-creation + community-creation — sql_query inutile dans frontmatter
**Fichier** : `definitions/space-creation.skill.md`, `definitions/community-creation.skill.md`
**Probleme** : `sql_query` est liste dans le frontmatter mais n'est jamais appele dans le workflow (l'agent genere un confirmation block directement).
**Impact** : Confusion pour l'agent, token waste dans le tool listing.
**Fix** : Retirer `sql_query` du frontmatter des deux skills.

### BUG 4 : learning-path-generator — contradiction generate_document
**Fichier** : `definitions/learning-path-generator.skill.md`
**Probleme** : Step 6 dit "generate_document pour export PDF" mais une regle dit "generate_document NOT available in Study mode". Le frontmatter liste `generate_document`.
**Impact** : L'agent peut tenter d'appeler un tool non disponible en study.
**Fix** : Retirer `generate_document` du frontmatter ET supprimer la reference Step 6 export PDF. Le learning path reste textuel + chart.

---

## B. CORRECTIONS PROMPT (P1) — Coherence & Clarte

### P1-1 : Prompt Study — Contradiction quiz batching
**Fichier** : `talent-study.prompt.ts`
**Probleme** : Ligne ~340 dit "Output exactly ONE quiz question per message" mais l'Assessment Protocol (lignes 193-206) decrit un chain de 3 questions.
**Fix** : Clarifier — "ONE quiz block per message. Le chain de 3 questions se fait sur 3 messages successifs."

### P1-2 : Prompt Org — 20+ sql_query intents sans arbre de decision
**Fichier** : `org-explorer.prompt.ts`
**Probleme** : 20+ intents listes (org_applications, org_members, org_stats, search_talents, etc.) sans guidance sur quand utiliser lequel.
**Fix** : Ajouter un arbre de decision compact :
```
ANALYTICS → org_talent_cohorts, org_application_funnel, org_skills_analytics, org_geo_distribution, org_community_engagement, org_revenue_analytics, org_opportunity_performance
GESTION → org_members, org_applications, org_opportunities, org_communities, org_spaces, org_revenue, org_invitations, org_documents
RECHERCHE → search_talents, search_opportunities, search_communities, search_spaces
TALENT DETAIL → org_talent_profile, org_talents
CONTEXTE → org_stats (TOUJOURS en premier)
```

### P1-3 : Prompt Org — chart_hint non explique
**Fichier** : `org-explorer.prompt.ts`
**Probleme** : Les resultats sql_query contiennent `chart_hint` (bar, donut, table, stacked_bar, metric) mais le prompt n'explique pas comment l'utiliser.
**Fix** : Ajouter : "Si sql_query retourne un champ `chart_hint`, utilise le type de chart correspondant dans ta reponse."

### P1-4 : Prompt Org — DATA BOUNDARY ambigu
**Fichier** : `org-explorer.prompt.ts`
**Probleme** : "You do NOT have access to admin's personal data" est ambigu — semble interdire toutes les donnees personnelles.
**Fix** : Reformuler : "Accede UNIQUEMENT aux donnees ORGANISATION via org_*. Les intents personnels (my_profile, my_documents, my_skills) sont interdits en mode org."

### P1-5 : Tous prompts — Active Skill injection passive
**Fichier** : 3 prompts
**Probleme** : Les instructions skill sont injectees comme texte brut sans guidance d'execution.
**Fix** : Renforcer le header d'injection :
```
# ACTIVE SKILL — OVERRIDE MODE
The user's message triggered skill "${skillId}". You MUST:
1. Follow the step-by-step workflow below EXACTLY
2. Call tools in the ORDER specified
3. Do NOT improvise or skip steps
4. If a step fails, state the failure and continue to next step
```

### P1-6 : Prompt Org — Org maturity guidance sous-utilise
**Fichier** : `org-explorer.prompt.ts`
**Probleme** : Situation block donne des hints maturity (<10/10-50/>50 members) mais le prompt ne les reference jamais.
**Fix** : Ajouter dans Core Behavior : "Adapte tes recommendations a la maturite de l'organisation (Situation block). Org < 10 membres : quick wins, templates. 10-50 : process, analytics. > 50 : strategie, benchmark."

---

## C. OPTIMISATIONS TOKENS (P2) — ~1000-1500 tokens/turn economises

### P2-1 : Extraire les sections dupliquees dans un shared utility
**Sections identiques dans les 3 prompts :**
- Language Instructions (~200 tokens × 3) → `getLanguageBlock(language)`
- BANNED PHRASES (~50 tokens × 3) → `getBannedPhrasesBlock()`
- Active Skill Injection (~50 tokens × 3) → `getActiveSkillBlock(instructions)`
- UEMOA Priority examples (~80 tokens × 3) → deja partage via getUEMOAKnowledgeBlock

**Economie** : ~350 tokens/prompt (en creant des helpers partages dans un fichier `prompt-shared.ts`)

### P2-2 : Condenser Tool Sequencing sections
| Prompt | Tokens actuels | Tokens cibles | Methode |
|---|---|---|---|
| Study | ~800 | ~400 | Fusionner rules similaires, supprimer exemples redondants |
| Explore | ~1200 | ~600 | Compresser fallback chain en 3 lignes, supprimer exemples |
| Org | ~1500 | ~800 | Remplacer par arbre de decision (P1-2) + regles courtes |

**Economie** : ~400-700 tokens/prompt

### P2-3 : Supprimer exemples illustratifs verbose
- Study prompt : exemples GOOD vs BAD explanation (~100 tokens) → condenser en 1 ligne
- Explore prompt : exemples de vector_query queries → deplacer dans ontology ou supprimer
- Org prompt : exemples de paramsJson → deplacer dans sql_query tool description

**Economie** : ~100-200 tokens/prompt

---

## D. SKILLS A CORRIGER/AMELIORER (P3)

### P3-1 : salary-analysis — Trop de triggers (23)
**Probleme** : 23 triggers dont des generiques ("FDFP", "demission", "preavis") qui peuvent matcher des requetes non-salaire.
**Fix** : Reduire a ~12 triggers specifiques. Deplacer triggers generiques (FDFP, charges patronales) vers un futur skill `uemoa-compliance-guide`.

### P3-2 : candidate-ranking — Scoring rubric peu guide
**Probleme** : Scoring 40/30/15/15 (skills/experience/education/cultural) mais pas de guidance sur comment obtenir chaque score.
**Fix** : Ajouter des rules concretes :
```
Skills match : comparer les skills du candidat vs requirements (1 point par match exact, 0.5 par match partiel)
Experience : annees pertinentes / annees requises (ratio 0-1)
Education : match exact diplome = 1, domaine adjacent = 0.5, autre = 0.2
Cultural fit : meme pays/ville = bonus 0.2, remote-ready si remote = bonus 0.3
```

### P3-3 : cohort-report-generation — 7 appels SQL sequentiels
**Probleme** : Le skill demande 7 sql_query appels successifs (org_stats, org_talent_cohorts, org_skills_analytics, org_geo_distribution, org_application_funnel, org_community_engagement, org_revenue_analytics).
**Fix** : L'agent peut appeler plusieurs tools en parallele (OpenAI Agents SDK supporte). Regrouper en 2 batches :
```
Batch 1 : org_stats (toujours premier)
Batch 2 (parallele) : org_talent_cohorts + org_skills_analytics + org_geo_distribution + org_application_funnel + org_community_engagement + org_revenue_analytics
```

### P3-4 : weekly-recap — Interdit sql_query(my_skills) sans raison
**Probleme** : L'instruction interdit explicitement d'appeler sql_query(my_skills) mais ne justifie pas pourquoi. Les skills sont deja dans le contexte.
**Fix** : Reformuler : "Les skills sont deja disponibles dans `<user_profile>`. DO NOT call sql_query(my_skills) — utilise les skills du contexte."

### P3-5 : exam-simulation — learning_preferences non defini
**Probleme** : Refere `learning_preferences` dans le contexte mais ce champ n'existe ni dans TalentContext ni dans le profil DB.
**Fix** : Retirer la reference ou creer le champ dans le profil.

---

## E. NOUVEAUX SKILLS PROPOSES (P4) — ROI eleve pour UEMOA

### P4-1 : cover-letter-generation (explore, priority 7)
**Justification** : Les triggers "lettre de motivation" sont actuellement dead-end vers cv-generation. Un etudiant/talent UEMOA qui postule a besoin d'une lettre personnalisee + PDF brande.
**Workflow** :
1. Utiliser profil + skills du contexte
2. Si opportunite specifiee : sql_query(my_applications) → details offre
3. Si CV dispo : file_reader(documentId) → extraire experiences cles
4. Generer lettre structuree (objet, intro, corps, conclusion)
5. generate_document(PDF, sections format)
**Tools** : sql_query, file_reader, generate_document
**Triggers** : lettre de motivation, cover letter, lettre de candidature, lettre spontanee, candidature spontanee
**ROI** : TRES ELEVE — usage quotidien par talents en recherche

### P4-2 : negotiate-offer (explore, priority 5)
**Justification** : Le talent UEMOA reçoit une offre mais ne sait pas negocier (salaire, avantages, preavis, clauses). salary-analysis donne les benchmarks mais pas les tactiques.
**Workflow** :
1. Identifier l'offre recue (montant, contract type, entreprise)
2. Si UEMOA : injecter SMIG + benchmarks secteur + charges patronales
3. web_search("negociation salaire [secteur] [pays]") pour tactiques locales
4. Generer un guide de negociation : points forts du profil, fourchette cible, arguments, contre-offres, red flags
5. Optionnel : generate_document(PDF) avec guide structure
**Tools** : sql_query, web_search, generate_document
**Triggers** : negocier, negociation, offre recue, contre-proposition, ameliorer mon offre, preavis, clause non-concurrence
**ROI** : ELEVE — moment critique dans le parcours talent

### P4-3 : freelance-guide (explore, priority 4)
**Justification** : Beaucoup de talents UEMOA sont freelance (developpeurs, designers, consultants). Pas de skill pour les guider sur : tarification, contrats, plateformes, fiscalite.
**Workflow** :
1. Identifier le domaine freelance + pays
2. Si UEMOA : injecter grille tarifaire locale + regime fiscal
3. web_search("tarif freelance [domaine] [pays] 2026")
4. Generer un plan : positionnement, tarification (jour/mission/retainer), plateformes recommandees, modele contrat, obligations fiscales
**Tools** : sql_query, web_search, generate_document
**Triggers** : freelance, independant, consultant, tarif journalier, TJM, travailler en freelance, facturation, auto-entrepreneur
**ROI** : ELEVE — segment en croissance en UEMOA

---

## F. OPTIMISATIONS PROMPT ENGINEERING (P5)

### P5-1 : Restructurer les prompts en 3 niveaux
**Actuellement** : Tout est un long texte plat (~5000-6500 tokens).
**Propose** : Structure hierarchique qui aide l'agent a prioriser :

```
LEVEL 1 — IDENTITY (toujours lu) : ~500 tokens
  Persona, Language, Mode, User Context

LEVEL 2 — RULES (lu a chaque tour) : ~1500 tokens
  Output limits, Banned phrases, Tool sequencing, UEMOA priority

LEVEL 3 — REFERENCE (lu quand pertinent) : ~2000 tokens
  Ontology, Skill catalog, UEMOA knowledge block, Entity card format
```

**Avantage** : L'agent traite Level 1-2 pour chaque message (~2000 tokens). Level 3 est de la reference (~2000 tokens). Total ~4000 tokens au lieu de ~6000 tokens de texte plat.

### P5-2 : Renforcer le "Insight-First" pattern
**Probleme actuel** : Les prompts disent "ne donne pas de raw data" mais n'expliquent pas comment generer de l'insight.
**Propose** : Ajouter un pattern explicite dans Level 2 :

```
INSIGHT-FIRST PROTOCOL:
Pour chaque resultat de tool, tu DOIS :
1. INTERPRETER — Que signifie ce resultat pour le user ?
2. COMPARER — Comment se situe-t-il vs son profil/marche/objectifs ?
3. RECOMMANDER — Quelle action concrete le user doit prendre ?
Ne presente JAMAIS un resultat sans interpretation.
Exemple : "3 offres trouvees" → "3 offres matchent ton profil React, dont 1 remote a 850K FCFA/mois — au-dessus du marche Abidjan (650K). Je recommande de postuler en priorite."
```

### P5-3 : Ajouter un "Context Freshness" indicator
**Probleme** : L'agent ne sait pas si les donnees du contexte sont fraiches ou stale.
**Propose** : Ajouter `lastProfileUpdate`, `lastApplicationDate`, `lastSkillUpdate` dans le contexte.
L'agent peut alors :
- Si lastProfileUpdate > 30j : "Ton profil n'a pas ete mis a jour depuis 30 jours. Veux-tu le completer ?"
- Si lastApplicationDate > 14j : "Ta derniere candidature date de 2 semaines. De nouvelles offres sont disponibles."

### P5-4 : Skill Chaining automatique base sur le contexte
**Actuellement** : Skill chaining est une table statique (cv-generation → application-tracker).
**Propose** : Chaining dynamique base sur le profil :
```
SI profileCompleteness < 50% ALORS toujours suggerer profile-completion-guide
SI hasCV = false ET mode = explore ALORS suggerer cv-generation apres toute recherche
SI derniere_candidature > 14j ALORS suggerer application-tracker
SI 0 skills ALORS suggerer autodiagnostic-talent
```

---

## G. RESUME PRIORITES

| Phase | Nb items | Impact | Effort |
|---|---|---|---|
| **P0 — Bugs critiques** | 4 | CRITICAL — empeche le fonctionnement correct | 30min |
| **P1 — Corrections prompt** | 6 | HIGH — ameliore la coherence agent | 1h |
| **P2 — Optimisation tokens** | 3 | MEDIUM — economise ~1000-1500 tokens/turn | 2h |
| **P3 — Amelioration skills** | 5 | MEDIUM — ameliore la qualite des outputs | 1h |
| **P4 — Nouveaux skills** | 3 | HIGH — couvre les gaps critiques UEMOA | 3h |
| **P5 — Prompt engineering** | 4 | HIGH — ameliore structurellement le ROI agent | 3h |

**Ordre recommande** : P0 → P1 → P3 → P5-2 → P4-1 → P2 → P4-2 → P4-3 → P5-1 → P5-3 → P5-4

---

## H. METRIQUES ATTENDUES

| Metrique | Avant | Apres (estime) |
|---|---|---|
| Tokens/turn (prompt) | ~5500-6500 | ~4000-5000 |
| Faux positifs skill detection | ~15% (triggers generiques) | ~3% (embeddings + triggers nettoyes) |
| Skills couverture UEMOA | 23 skills, 3 gaps critiques | 26 skills, 0 gap critique |
| Tool call errors (wrong tool) | ~5% (frontmatter incoherents) | ~0% (P0 fixes) |
| Insight quality | Variable (pas de protocol) | Constant (Insight-First protocol P5-2) |
| Time-to-value (1er resultat utile) | 2-3 tool calls | 1-2 tool calls (arbre decision + skill instructions renforcees) |
