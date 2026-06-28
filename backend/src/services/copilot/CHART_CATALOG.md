# CHART CATALOG — Etudesk Copilot

Reference des 20 visualisations metier. L'agent DOIT utiliser ce catalogue pour choisir le bon chart au bon moment.

## Regles generales

- Min 2 items non-zero pour bar/donut/stacked_bar/line (sinon metric)
- Exclure les valeurs a 0 — pas de barres vides
- Labels lisibles — jamais d'enums bruts ou d'IDs
- Values = quantites uniquement (counts, %, montants) — pas de niveaux ordinaux dans bar/donut
- Currency FCFA (XOF) par defaut en zone UEMOA
- Nombres formates locale FR (espace milliers, virgule decimales)

---

## MODE EXPLORER — 7 visualisations

### #1 Profil de competences (bloc `skills`)
- **Skill** : autodiagnostic-talent, hr-skill-radar, weekly-recap
- **Quand** : profil, bilan, "mes competences"
- **Source** : `<skills>` contexte → lister les competences du talent (nom, type, niveau)
- **Intelligence** : Top 5-8 skills max. Si < 3 skills → metric "Complete ton profil". JAMAIS de radar.
- **Format** : bloc `skills` (cartes de competences, pas un chart) :
```skills
{"title":"Mon profil de competences","skills":[{"name":"Strategie d'entreprise","type":"hard_skill","level":"advanced"},{"name":"Economie numerique","type":"knowledge","level":"advanced"},{"name":"Communication","type":"soft_skill","level":"intermediate"},{"name":"Python","type":"language","level":"intermediate"}]}
```

### #2 Funnel candidatures personnel
- **Skill** : application-tracker
- **Quand** : "mes candidatures", "ou j'en suis", suivi
- **Source** : `my_applications` → grouper par mois (applied_at) + status
- **Intelligence** : Si 0 candidatures → skip chart, proposer smart_search. Exclure colonnes a 0.
- **Format** :
```json
{"type":"stacked_bar","title":"Mes candidatures par statut","data":[{"label":"Jan 2026","segments":[{"key":"submitted","label":"Soumises","value":3,"color":"primary"},{"key":"in_review","label":"En revue","value":1,"color":"warning"},{"key":"accepted","label":"Acceptees","value":1,"color":"success"},{"key":"rejected","label":"Refusees","value":0,"color":"error"}]}]}
```
- **Fallback** : Si toutes les candidatures sont du meme mois → utiliser bar simple par statut au lieu de stacked_bar

### #3 Repartition skills par type
- **Skill** : autodiagnostic-talent, weekly-recap
- **Quand** : "analyse mon profil", bilan competences
- **Source** : `<skills>` contexte → count par type (HARD_SKILL, SOFT_SKILL, KNOWLEDGE)
- **Intelligence** : Si un type = 0, le mentionner en texte ("Tu n'as aucun soft skill declare"). Si seulement 1 type → metric au lieu de donut.
- **Format** :
```json
{"type":"donut","title":"Repartition de mes competences","data":[{"label":"Hard Skills","value":8},{"label":"Soft Skills","value":4},{"label":"Connaissances","value":3}],"total_label":"15 competences"}
```

### #4 Progression apprentissage
- **Skill** : weekly-recap
- **Quand** : "ma progression", retour apres inactivite
- **Source** : `<skills>` contexte → count cumule par semaine (updated_at)
- **Intelligence** : Min 2 semaines de donnees, sinon metric simple. Montrer tendance.
- **Format** :
```json
{"type":"line","title":"Competences acquises par semaine","data":[{"label":"Sem 1","value":2},{"label":"Sem 2","value":5},{"label":"Sem 3","value":7},{"label":"Sem 4","value":12}]}
```

### #5 Grille salariale marche
- **Skill** : career-compensation-guide
- **Quand** : salary-analysis, "combien gagne un..."
- **Source** : UEMOA knowledge block + `smart_search(opportunities)` compensation_min/max + web_search
- **Intelligence** : Adapter au pays/ville detecte. FCFA par defaut UEMOA. Contexte CDI/CDD/Freelance.
- **Format** :
```json
{"type":"table","title":"Grille salariale — Developpeur Web, Abidjan","columns":["Niveau","Min (FCFA)","Max (FCFA)","Mediane"],"rows":[{"Niveau":"Junior (0-2 ans)","Min (FCFA)":"150 000","Max (FCFA)":"300 000","Mediane":"200 000"},{"Niveau":"Confirme (3-5 ans)","Min (FCFA)":"350 000","Max (FCFA)":"600 000","Mediane":"450 000"},{"Niveau":"Senior (5+ ans)","Min (FCFA)":"600 000","Max (FCFA)":"1 200 000","Mediane":"800 000"}]}
```

### #6 Opportunites par contrat
- **Skill** : application-tracker
- **Quand** : "cherche un emploi", recherche active, phase decouverte
- **Source** : `smart_search(opportunities)` → grouper par contract_type
- **Intelligence** : Filtrer par secteurs/skills du talent. Pas le total plateforme — ce qui MATCH le profil.
- **Format** :
```json
{"type":"bar","title":"Opportunites disponibles par contrat","data":[{"label":"CDI","value":23},{"label":"CDD","value":15},{"label":"Stage","value":31},{"label":"Freelance","value":8}]}
```

### #7 Score completude profil
- **Skill** : onboarding, profile-completion-guide
- **Quand** : premier acces, profile-completion-guide
- **Source** : profileCompleteness calcule dans loadProfile (bio, skills, documents, city, goals, sectors)
- **Intelligence** : < 40% → onboarding force. 40-70% → suggestions ciblees. > 70% → felicitations + tips avances.
- **Format** :
```json
{"type":"metric","title":"Completude de ton profil","value":65,"unit":"%","trend":{"direction":"up","delta":15,"period":"cette semaine"}}
```

---

## MODE STUDY — 6 visualisations

### #8 Resultat d'evaluation par sous-domaine (bar)
- **Skill** : exam-simulation (resultat), deep-dive-lesson (fin de cours)
- **Quand** : fin d'evaluation ou de cours
- **Source** : score quiz par sous-domaine de la skill evaluee
- **Intelligence** : Labels = sous-domaines de la skill evaluee, pas des skills random. Valeurs = % reussite. JAMAIS de radar — un `bar` suffit (cf. #9).
- **Format** :
```json
{"type":"bar","title":"Evaluation — Python","data":[{"label":"Syntaxe","value":80},{"label":"POO","value":60},{"label":"Librairies","value":40},{"label":"Algo","value":70},{"label":"Debug","value":50}]}
```

### #9 Score examen par categorie
- **Skill** : exam-simulation (fin)
- **Quand** : fin d'examen 10 questions
- **Source** : Scoring par categorie des 10 questions (Rappel Q1-3, Application Q4-6, Analyse Q7-9, Synthese Q10)
- **Intelligence** : Valeurs = % reussite. Trier du meilleur au plus faible. Identifier axes de travail.
- **Format** :
```json
{"type":"bar","title":"Resultats — Examen Marketing Digital","data":[{"label":"Rappel (Q1-3)","value":100},{"label":"Application (Q4-6)","value":67},{"label":"Analyse (Q7-9)","value":33},{"label":"Synthese (Q10)","value":0}]}
```
- **Thinking** : Calculer score par bloc — (correct/total)*100 par categorie. Exclure blocs a 0% si un seul.

### #10 Gap Analysis — niveau actuel vs requis (bloc `skill_match`)
- **Skill** : deep-dive-lesson (learning-path context), autodiagnostic-talent, talent-explorer
- **Quand** : "je veux devenir...", reconversion, learning path
- **Source** : `<skills>` (actuel) + find_competency (resolution) + requis du metier cible
- **Intelligence** : Skills cles du metier cible. Mettre en evidence les gaps critiques. JAMAIS de radar.
- **Format** : bloc `skill_match` (scope "talent", Actuel vs Cible) :
```skill_match
{"scope":"talent","subject":"Product Manager","skills":[{"name":"Agile/Scrum","type":"hard_skill","current":"beginner","target":"advanced"},{"name":"UX Research","type":"hard_skill","current":null,"target":"advanced"},{"name":"Data Analysis","type":"hard_skill","current":"intermediate","target":"advanced"},{"name":"Communication","type":"soft_skill","current":"advanced","target":"advanced"}],"insights":["Gap prioritaire : UX Research (absent → avance)","Tu couvres deja Communication","Comble Agile/Scrum en mode Etudier"]}
```

### #11 Parcours apprentissage — progression etapes
- **Skill** : deep-dive-lesson (project flow)
- **Quand** : mini-projet, suivi parcours, learning path
- **Source** : manage_skills + historique sessions study
- **Intelligence** : Chaque barre = un module. Segments = sous-competences maitrisees/en cours/a faire.
- **Format** :
```json
{"type":"stacked_bar","title":"Mon parcours — Data Science","data":[{"label":"Statistiques","segments":[{"key":"mastered","label":"Maitrise","value":3,"color":"success"},{"key":"in_progress","label":"En cours","value":1,"color":"warning"},{"key":"todo","label":"A faire","value":0,"color":"primary"}]},{"label":"Python","segments":[{"key":"mastered","label":"Maitrise","value":2,"color":"success"},{"key":"in_progress","label":"En cours","value":2,"color":"warning"},{"key":"todo","label":"A faire","value":1,"color":"primary"}]},{"label":"ML","segments":[{"key":"mastered","label":"Maitrise","value":0,"color":"success"},{"key":"in_progress","label":"En cours","value":1,"color":"warning"},{"key":"todo","label":"A faire","value":4,"color":"primary"}]}]}
```

### #12 Bilan hebdo — activite apprentissage
- **Skill** : weekly-recap
- **Quand** : weekly-recap
- **Source** : CopilotTrace + manage_skills (delta semaine) + conversation context
- **Intelligence** : Comparer a la semaine precedente via metric trend. Si inactif 7j+ → message re-motivation.
- **Format** :
```json
{"type":"bar","title":"Activite cette semaine","data":[{"label":"Quiz passes","value":5},{"label":"Cours termines","value":2},{"label":"Skills ameliorees","value":3},{"label":"Documents etudies","value":1}]}
```

### #13 Distribution skills par niveau de maitrise
- **Skill** : weekly-recap, autodiagnostic-talent
- **Quand** : "mon bilan", diagnostic, recap
- **Source** : `<skills>` contexte → count par niveau
- **Intelligence** : Si trop de BEGINNER (>60%) → suggerer deep-dive. Si beaucoup d'EXPERT → suggerer exam pour MASTER.
- **Format** :
```json
{"type":"donut","title":"Tes competences par niveau","data":[{"label":"Debutant","value":5},{"label":"Intermediaire","value":8},{"label":"Avance","value":3},{"label":"Master","value":1}],"total_label":"17 competences"}
```

---

## MODE ORG — 7 visualisations

### #14 Funnel recrutement par opportunite
- **Skill** : org-analytics (Recruitment Funnel)
- **Quand** : "performance recrutement", "nos candidatures", funnel
- **Source** : `org_application_funnel`
- **Intelligence** : Trier par acceptance_rate croissant (problemes en premier). Alerter si ratio refus > 80%.
- **Format** :
```json
{"type":"stacked_bar","title":"Funnel recrutement","data":[{"label":"Dev Frontend","segments":[{"key":"submitted","label":"Soumises","value":45,"color":"primary"},{"key":"in_review","label":"En revue","value":12,"color":"warning"},{"key":"accepted","label":"Acceptees","value":3,"color":"success"},{"key":"rejected","label":"Refusees","value":18,"color":"error"}]},{"label":"UX Designer","segments":[{"key":"submitted","label":"Soumises","value":28,"color":"primary"},{"key":"in_review","label":"En revue","value":8,"color":"warning"},{"key":"accepted","label":"Acceptees","value":2,"color":"success"},{"key":"rejected","label":"Refusees","value":10,"color":"error"}]}]}
```

### #15 Distribution geographique talents
- **Skill** : org-analytics (Talent Cohorts), talent-outreach
- **Quand** : "d'ou viennent nos talents", geo, distribution
- **Source** : `org_geo_distribution`
- **Intelligence** : Si > 80% un seul pays → suggerer diversification. Grouper les < 3% en "Autres".
- **Format** :
```json
{"type":"donut","title":"Talents par pays","data":[{"label":"Cote d'Ivoire","value":45},{"label":"Senegal","value":12},{"label":"Cameroun","value":8},{"label":"Mali","value":5},{"label":"Autres","value":10}],"total_label":"80 talents"}
```

### #16 Top skills vivier talents
- **Skill** : org-analytics (Talent Cohorts), talent-outreach
- **Quand** : "competences vivier", planification recrutement
- **Source** : `org_skills_analytics` → top 10 par talent_count
- **Intelligence** : Croiser avec skills demandees dans org_opportunities. Mettre en evidence les gaps (skills demandees mais absentes du vivier).
- **Format** :
```json
{"type":"bar","title":"Top competences — Vivier talents","data":[{"label":"JavaScript","value":34},{"label":"Python","value":28},{"label":"Management","value":22},{"label":"Marketing Digital","value":18},{"label":"Communication","value":15}]}
```

### #17 Croissance vivier — cohortes mensuelles
- **Skill** : org-analytics (Talent Cohorts)
- **Quand** : "evolution", "croissance", tendance
- **Source** : `org_talent_cohorts`
- **Intelligence** : Montrer tendance. Si baisse 2 mois consecutifs → alerter. Annoter les pics.
- **Format** :
```json
{"type":"line","title":"Nouveaux talents par mois","data":[{"label":"Sep 2025","value":5},{"label":"Oct 2025","value":8},{"label":"Nov 2025","value":12},{"label":"Dec 2025","value":15},{"label":"Jan 2026","value":22},{"label":"Fev 2026","value":18}]}
```

### #18 Engagement communautes
- **Skill** : org-analytics (Engagement)
- **Quand** : "nos communautes", "engagement"
- **Source** : `org_community_engagement`
- **Intelligence** : Calculer taux activite = actifs_30j/total_members. Trier par taux decroissant. Alerter si < 20%.
- **Format** :
```json
{"type":"table","title":"Engagement des communautes","columns":["Communaute","Membres","Actifs 30j","Taux activite","Posts","Reactions"],"rows":[{"Communaute":"Tech Abidjan","Membres":120,"Actifs 30j":45,"Taux activite":"38%","Posts":23,"Reactions":156},{"Communaute":"RH Connect","Membres":80,"Actifs 30j":12,"Taux activite":"15%","Posts":5,"Reactions":18}]}
```

### #19 Classement candidats — scoring
- **Skill** : candidate-ranking
- **Quand** : shortlist, evaluation candidats
- **Source** : `org_applications` + `org_talent_profile` + file_reader (CV)
- **Intelligence** : Score = skills matchees (40%) + experience (30%) + education (15%) + cultural fit (15%). Top 5 max.
- **Format** :
```json
{"type":"table","title":"Classement — Dev Backend Senior","columns":["Rang","Candidat","Score","Skills matchees","Experience","Localisation"],"rows":[{"Rang":1,"Candidat":"Kone A.","Score":"92%","Skills matchees":"5/6","Experience":"6 ans","Localisation":"Abidjan"},{"Rang":2,"Candidat":"Diallo M.","Score":"85%","Skills matchees":"4/6","Experience":"4 ans","Localisation":"Dakar"}]}
```

### #20 Dashboard KPI organisation
- **Skill** : org-analytics (Engagement, tous)
- **Quand** : "tableau de bord", "resume", premier acces org
- **Source** : `org_stats` + `org_opportunity_performance` + `org_community_engagement`
- **Intelligence** : Toujours montrer trend (delta vs periode precedente). Combiner 3-4 MetricCards en serie.
- **Format** : Enchainer 3-4 metrics :
```json
{"type":"metric","title":"Taux d'acceptation global","value":12,"unit":"%","trend":{"direction":"up","delta":3,"period":"vs mois dernier"}}
```
```json
{"type":"metric","title":"Candidatures recues","value":156,"unit":"total","trend":{"direction":"up","delta":23,"period":"ce mois"}}
```
```json
{"type":"metric","title":"Temps moyen 1ere candidature","value":4.2,"unit":"heures","trend":{"direction":"down","delta":1.5,"period":"vs mois dernier"}}
```
```json
{"type":"metric","title":"Opportunites ouvertes","value":8,"unit":"postes"}
```

---

## Matrice Skill → Chart

| Skill | Charts applicables |
|-------|--------------------|
| application-tracker | #2 (funnel perso), #6 (opportunites par contrat) |
| career-compensation-guide | #5 (grille salariale) |
| onboarding | #7 (completude profil) |
| autodiagnostic-talent | #1 (profil `skills`), #3 (repartition type), #10 (gap `skill_match`), #13 (distribution niveau) |
| hr-skill-radar | #1 (profil `skills`) |
| weekly-recap | #1 (profil `skills`), #3 (repartition type), #4 (progression), #12 (activite hebdo), #13 (distribution niveau) |
| deep-dive-lesson | #8 (eval `bar`), #10 (gap `skill_match`), #11 (parcours etapes) |
| exam-simulation | #8 (eval `bar`), #9 (score par categorie) |
| document-study-session | — (pas de chart, seulement flashcards + quiz) |
| org-analytics | #14 (funnel), #15 (geo), #16 (top skills), #17 (cohortes), #18 (engagement), #20 (KPIs) |
| candidate-ranking | #19 (classement scoring) |
| talent-outreach | #15 (geo), #16 (top skills) |
