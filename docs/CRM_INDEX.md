# CRM Etudesk OS 2026 - Index et Dashboard
## Pipeline B2B - Zone UEMOA - Fevrier 2026

## LIEN DEMO ETUDESK OS
**https://youtu.be/hhJ2ClQb2sQ**
> A envoyer a chaque prospect lors du premier contact.

---

## AUDIT DU DOSSIER (9 fevrier 2026)

### Fichiers source (avant restructuration)
| Fichier | Contenu | Entrees | Problemes identifies |
|---|---|---|---|
| `PROSPECTS_B2B_UEMOA.md` | Prospects mixtes (gov, telecoms, banques, etc.) | 48 | Pas de champs CRM, melange de segments |
| `PROSPECTS_B2B_ETUDESK_OS_UEMOA.md` | Bootcamps, cabinets, corporate, gov | 39 | Doublons avec fichier ci-dessus |
| `PROSPECTS_B2B_UEMOA_Universities.csv` | Universites/Grandes Ecoles UEMOA | 45 | Pas de champs CRM (pipeline, priorite, owner) |
| `PROSPECTS_B2B_UEMOA_HUBS.csv` | Hubs/Incubateurs/Accelerateurs | 40 | Pas de champs CRM |
| `contacts.csv` | Contacts individuels (Africa CEO Forum) | 812 | Non segmente, non relie aux prospects |

### Problemes corriges
1. **Champs CRM ajoutes** : Priorite (P1/P2/P3), Statut Pipeline, Owner, Derniere/Prochaine Action, Dates
2. **Doublons elimines** : prospects unifies par segment (pas de doublon entre fichiers CRM)
3. **Segmentation claire** : 4 fichiers CRM dedies aux 4 segments cibles
4. **Cabinets enrichis** : segment elargi de 6 a 20 entrees (cabinets conseil, recrutement, audit ajoutes depuis contacts.csv)
5. **Bootcamps integres** : les ecoles de code et bootcamps sont dans CRM_HUBS (sous-segment Bootcamp/Ecole de code)

---

## FICHIERS CRM PAR SEGMENT

### 1. Universites et Grandes Ecoles
- **Fichier** : `CRM_UNIVERSITES_GRANDES_ECOLES.csv`
- **Entrees** : 45
- **Champs** : ID, Nom, Acronyme, Sous-Segment, Pays, Ville, Site Web, Taille Etudiants, Contact Principal, Titre, Email, Telephone, Priorite, Statut Pipeline, Owner, Pertinence Etudesk, Derniere/Prochaine Action, Dates, Notes

| Sous-Segment | Nombre |
|---|---|
| Universite Publique | 22 |
| Universite Publique Numerique | 2 |
| Grande Ecole Publique | 9 |
| Business School Privee | 6 |
| Universite Privee Catholique | 3 |
| Grande Ecole Privee | 3 |

| Pays | Nombre | P1 | P2 | P3 |
|---|---|---|---|---|
| Cote d'Ivoire | 14 | 5 | 6 | 3 |
| Senegal | 10 | 4 | 5 | 1 |
| Burkina Faso | 4 | 2 | 1 | 1 |
| Mali | 3 | 0 | 2 | 1 |
| Togo | 6 | 2 | 2 | 2 |
| Benin | 5 | 1 | 3 | 1 |
| Niger | 1 | 1 | 0 | 0 |
| Guinee-Bissau | 1 | 0 | 0 | 1 |
| **TOTAL** | **45** | **15** | **19** | **10** |

**Top 5 Universites prioritaires :**
1. **UFHB** (CI) - 50 000+ etudiants, plus grande universite CI
2. **UCAD** (SN) - 80 000+ etudiants, 1ere francophone Afrique
3. **UN-CHK** (SN) - 60 000+ etudiants, universite numerique, concurrent/partenaire
4. **UVCI** (CI) - Universite numerique, integration naturelle
5. **CESAG** (SN) - Institution UEMOA/BCEAO, porte d'entree regionale

---

### 2. Hubs (Incubateurs, Accelerateurs, Corporate Innovation, Startup Studios, Bootcamps)
- **Fichier** : `CRM_HUBS.csv`
- **Entrees** : 46
- **Champs** : ID, Nom, Sous-Segment, Pays, Ville, Site Web, Directeur/CEO, Email, Telephone, Priorite, Statut Pipeline, Owner, Programmes Cles, Pertinence Etudesk, Derniere/Prochaine Action, Dates, Notes

| Sous-Segment | Nombre |
|---|---|
| Incubateur | 11 |
| Accelerateur | 4 |
| Hub Digital / Accelerateur | 5 |
| Bootcamp / Ecole de code | 7 |
| Coworking / Hub | 7 |
| FabLab / Tech Hub | 4 |
| Fonds / Accelerateur | 1 |
| Startup Studio | 1 |
| Reseau / Divers | 6 |

| Pays | Nombre | P1 | P2 | P3 |
|---|---|---|---|---|
| Cote d'Ivoire | 14 | 6 | 5 | 3 |
| Senegal | 11 | 5 | 3 | 3 |
| Burkina Faso | 5 | 1 | 3 | 1 |
| Togo | 5 | 1 | 2 | 2 |
| Benin | 3 | 2 | 1 | 0 |
| Mali | 5 | 1 | 2 | 2 |
| Niger | 1 | 1 | 0 | 0 |
| Pan-africain | 2 | 2 | 0 | 0 |
| **TOTAL** | **46** | **19** | **16** | **11** |

**Top 5 Hubs prioritaires :**
1. **Comoe Capital** (CI) - Sponsorise par I&P (actionnaire Etudesk) - lien direct
2. **CGECI Academy** (CI) - Lien patronat ivoirien, Tremplin UEMOA
3. **Concree** (SN) - 1ere plateforme incubation virtuelle Afrique, 700+ entrepreneurs
4. **Simplon CI** (CI) - Formation gratuite, gestion cohortes, partenariat MTN
5. **Bakeli/Volkeno** (SN) - Modele former-puis-placer, alignement direct

---

### 3. Agences Gouvernementales (Ministeres, Agences emploi, Institutions regionales, Organisations internationales)
- **Fichier** : `CRM_AGENCES_GOUVERNEMENTALES.csv`
- **Entrees** : 35
- **Champs** : ID, Nom, Acronyme, Sous-Segment, Pays, Ville, Site Web, Contact Principal, Titre, Email, Telephone, Adresse, Priorite, Statut Pipeline, Owner, Pertinence Etudesk, Derniere/Prochaine Action, Dates, Notes

| Sous-Segment | Nombre |
|---|---|
| Ministere | 8 |
| Agence gouvernementale | 8 |
| Organisme public | 4 |
| Plateforme numerique | 1 |
| Institution financiere regionale | 3 |
| Cooperation internationale | 2 |
| Institution multilaterale | 3 |
| Nations Unies | 1 |
| Fondation philanthropique | 2 |
| Hub Innovation Gouvernemental | 1 |
| Organisation regionale | 2 |

| Pays/Zone | Nombre | P1 | P2 | P3 |
|---|---|---|---|---|
| Cote d'Ivoire | 14 | 7 | 7 | 0 |
| Senegal | 5 | 3 | 2 | 0 |
| Burkina Faso | 2 | 0 | 2 | 0 |
| Mali | 2 | 0 | 1 | 1 |
| Togo | 2 | 1 | 1 | 0 |
| Benin | 2 | 1 | 1 | 0 |
| Regional/International | 8 | 3 | 5 | 0 |
| **TOTAL** | **35** | **15** | **19** | **1** |

**Top 5 Agences gouvernementales prioritaires :**
1. **FDFP** (CI) - 27 000+ plans formation, 600+ structures, noeud central ecosysteme
2. **Mastercard Foundation** (Regional) - 30M jeunes cible, alignement parfait
3. **AEJ** (CI) - 142 000 beneficiaires PNSAR, coeur de cible
4. **3FPT** (SN) - Equivalent FDFP Senegal, 700 000 jeunes objectif
5. **METFPA** (CI) - Tutelle FDFP/DIGIFOP/AGEFOP, 60 etablissements publics

---

### 4. Cabinets de Formation, Recrutement et Conseil
- **Fichier** : `CRM_CABINETS_FORMATION_RECRUTEMENT_CONSEIL.csv`
- **Entrees** : 20
- **Champs** : ID, Nom, Sous-Segment, Pays, Ville, Site Web, Directeur/Contact, Email, Telephone, Agree FDFP, Priorite, Statut Pipeline, Owner, Specialites, Pertinence Etudesk, Derniere/Prochaine Action, Dates, Notes

| Sous-Segment | Nombre |
|---|---|
| Cabinet Formation (FDFP) | 7 |
| Cabinet Conseil / Audit (Big 4) | 4 |
| Cabinet Conseil Strategie | 2 |
| Cabinet Recrutement | 2 |
| Cabinet Tech / Data | 1 |
| Ecole Management / Conseil | 2 |
| Centre d'appels / Outsourcing | 1 |
| Conseil Finance / RH | 1 |

| Agree FDFP | Nombre |
|---|---|
| Oui | 7 |
| Non | 13 |

**Top 5 Cabinets prioritaires :**
1. **PANESS CI** - 25+ ans, Dale Carnegie, couverture UEMOA, agree FDFP
2. **Ivoire Formations** - 5 villes CI, centaines de programmes, agree FDFP
3. **AFRIBEX** - Leader ingenierie pedagogique Afrique, triple certification
4. **SAER Group** (Mali) - Cabinet recrutement/interim, besoin direct matching
5. **Data354** - Partenaire tech potentiel, IA pour Etudesk OS

---

## CONTACTS INDIVIDUELS (NON SEGMENTES)

- **Fichier** : `contacts.csv` (existant, non modifie)
- **Entrees** : 812
- **Source** : Africa CEO Forum
- **Usage** : Base de contacts pour introductions et networking, pas un CRM de prospects directement
- **Action recommandee** : Croiser avec les CRM segmentes pour identifier les contacts cles chez les prospects P1

### Contacts cles identifies dans contacts.csv lies aux prospects CRM :
| Contact | Entreprise | Lien CRM |
|---|---|---|
| Djibril OUATTARA (DG MTN CI) | MTN | Lien ODC et MTN Academy (H04) |
| Sabina VIGANI | Jacobs Foundation | G34 |
| Fabio SEGURA (Co-CEO) | Jacobs Foundation | G34 |
| Solange AMICHIA (DG) | CEPICI | G12 |
| Diadie SANKARE (PDG) | SAER Group | C08 |
| Fadel KANE (MD) | Societe Generale | Corporate (non CRM) |
| Marc GIUGNI (DGA) | Societe Generale CI | Corporate (non CRM) |
| Guillaume FANDJINOU (Deputy GM) | MDE Business School | C16 |
| Alexis JOHN AHYEE (DG) | HEC Paris Afrique | C17 |
| Fabrice ZAPFACK (CEO) | Data354 | C18 |
| Julien CAPGRAS (Co-founder) | Data354 | C18 |
| Georges N'GUESSAN (DG Afrique) | Capital B. Solutions | C19 |
| Bunmi BAJOMO | Ecobank | Corporate |
| Korede ODJO-BELLA (Dir. Banque Particuliers) | Ecobank CI | Corporate |
| Habib BLEDOU (DGA Retail) | Banque Atlantique | Corporate |
| Isadora BIGOURDAN (Acting CEO) | Digital Africa | Partenaire potentiel |

---

## PIPELINE GLOBAL - SYNTHESE

| Segment | Total | P1 | P2 | P3 |
|---|---|---|---|---|
| Universites / Grandes Ecoles | 45 | 15 | 19 | 10 |
| Hubs (Incubateurs, Accelerateurs, Bootcamps) | 46 | 19 | 16 | 11 |
| Agences Gouvernementales | 35 | 15 | 19 | 1 |
| Cabinets Formation / Recrutement / Conseil | 20 | 4 | 10 | 6 |
| **TOTAL PROSPECTS CRM** | **146** | **53** | **64** | **28** |

### Repartition par pays (tous segments confondus)
| Pays | Total | P1 |
|---|---|---|
| Cote d'Ivoire | 52 | 22 |
| Senegal | 28 | 13 |
| Burkina Faso | 12 | 3 |
| Togo | 13 | 4 |
| Benin | 10 | 4 |
| Mali | 12 | 1 |
| Niger | 3 | 2 |
| Guinee-Bissau | 1 | 0 |
| Regional / Pan-africain | 13 | 5 |
| Autres (Maroc, France) | 2 | 0 |
| **TOTAL** | **146** | **53** |

---

## STATUTS PIPELINE - DEFINITION

| Statut | Description |
|---|---|
| **Prospect** | Identifie, pas encore contacte |
| **Contact Initial** | Premier contact effectue (email, appel, LinkedIn) |
| **Qualification** | RDV effectue, besoin confirme, budget identifie |
| **Proposition** | Offre/demo envoyee |
| **Negociation** | Discussion tarifaire / contractuelle en cours |
| **Client** | Contrat signe |
| **Perdu** | Opportunite perdue (raison a documenter) |
| **En veille** | Pas de besoin immediat, a recontacter plus tard |

## PRIORITES - DEFINITION

| Priorite | Criteres |
|---|---|
| **P1** | Fort alignement Etudesk OS + volume significatif + budget identifie/probable + acces au decideur possible |
| **P2** | Bon alignement + volume moyen ou cycle de vente plus long |
| **P3** | Alignement partiel ou exploration strategique |

## OWNERS - EQUIPE COMMERCIALE

| Owner | Role | Segments principaux |
|---|---|---|
| **Lamine** | DG | P1 tous segments, agences gouvernementales, institutions regionales |
| **Wilfried** | DGA | Universites, grandes ecoles, business schools |
| **Hasma** | Ops | Hubs, bootcamps, cabinets formation |

---

## PROCHAINES ETAPES RECOMMANDEES

### Semaine 1 (10-14 fevrier 2026)
1. [ ] **Valider les priorites P1** - Revoir les 53 prospects P1 et ajuster si necessaire
2. [ ] **Assigner les owners** - Repartir les P1 non assignes entre Lamine, Wilfried, Hasma
3. [ ] **Preparer les emails de prise de contact** - Templates par segment

### Semaine 2 (17-21 fevrier 2026)
4. [ ] **Contact initial P1** - Premiers emails/appels sur les 15 prospects P1 prioritaires
5. [ ] **Croiser contacts.csv** - Identifier les introductions possibles via les 812 contacts Africa CEO Forum
6. [ ] **Mettre a jour les statuts** - Passer les contactes en "Contact Initial"

### En continu
7. [ ] **Enrichir le segment Cabinets** - Ajouter les cabinets recrutement manquants (RH Partners, Adecco, Michael Page, Korn Ferry si presents UEMOA)
8. [ ] **Tracker les telecoms et banques** - Creer un 5eme CRM si necessaire pour les corporates (Orange, MTN, Ecobank, SGCI, etc.)

---

*CRM restructure le 9 fevrier 2026*
*146 prospects actifs dans le pipeline*
*53 prospects prioritaires (P1)*
