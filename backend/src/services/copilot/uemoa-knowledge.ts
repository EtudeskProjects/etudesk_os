/**
 * UEMOA Knowledge Base — Static reference data for agent prompts
 * Injected into system prompts when the user is in a UEMOA country.
 * Zero DB calls — pure static knowledge.
 */

const UEMOA_COUNTRIES = ['CI', 'SN', 'ML', 'BF', 'TG', 'BN', 'NE', 'GW'];

const UEMOA_COUNTRY_NAMES: Record<string, string> = {
  CI: "Côte d'Ivoire",
  SN: 'Sénégal',
  ML: 'Mali',
  BF: 'Burkina Faso',
  TG: 'Togo',
  BN: 'Bénin',
  NE: 'Niger',
  GW: 'Guinée-Bissau',
};

/**
 * Check if a country code or name is in UEMOA zone
 */
export function isUEMOACountry(country?: string): boolean {
  if (!country) return false;
  const normalized = country.trim().toUpperCase();
  if (UEMOA_COUNTRIES.includes(normalized)) return true;
  // Also check full names
  const fullNames = Object.values(UEMOA_COUNTRY_NAMES).map((n) => n.toUpperCase());
  return fullNames.includes(normalized) || normalized.includes('IVOIRE') || normalized.includes('COTE D');
}

/** UEMOA-relevant trigger keywords — if the message contains any of these, inject the block */
const UEMOA_TRIGGERS_REGEX = /salaire|fcfa|smig|cotisation|cnps|css|ipres|inps|cdi|cdd|remuneration|charges|net\b|brut\b|preavis|emploi|embauche|recrut|licenciement|fdfp|financement formation|demission|cout employeur|charges patronales|contrat de travail|droit du travail/i;

/** Skill IDs that need UEMOA data */
const UEMOA_SKILL_IDS = new Set([
  'career-compensation-guide',
  'interview-prep',
  'opportunity-publishing',
  'job-description-generation',
  'autodiagnostic-talent',
  'candidate-ranking',
  'org-analytics',
]);

/**
 * Determine if the UEMOA knowledge block should be injected.
 * Returns true when: an active skill needs UEMOA data, OR the message contains salary/employment/legal triggers.
 */
export function shouldInjectUEMOA(message: string, activeSkillId?: string): boolean {
  if (activeSkillId && UEMOA_SKILL_IDS.has(activeSkillId)) return true;
  const normalizedMsg = message.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return UEMOA_TRIGGERS_REGEX.test(normalizedMsg);
}

/**
 * Get the UEMOA knowledge block for injection into prompts.
 * Returns block only if the user is in a UEMOA country and shouldInject is true.
 * ~2500 tokens — high ROI reference data: SMIG 8 pays, salary grids 20 sectors × 3 countries, cotisations sociales CI/SN/ML, droit du travail. Eliminates web_search for salary/legal benchmarks.
 * When shouldInject is false (default), skips injection to save ~2500 tokens on irrelevant requests.
 */
export function getUEMOAKnowledgeBlock(userCountry?: string, _language?: string, shouldInject: boolean = true): string {
  if (!shouldInject) return '';
  const inUEMOA = isUEMOACountry(userCountry);
  if (!inUEMOA) return '';

  const locationLabel = UEMOA_COUNTRY_NAMES[userCountry?.trim().toUpperCase() || ''] || userCountry || 'Zone UEMOA';

  return `
# UEMOA Reference Data (${locationLabel})

<uemoa_knowledge>
## Currency & Economy
- Currency: FCFA (XOF). 1 EUR ≈ 656 FCFA (fixed peg).
- Payment platforms: Orange Money, Wave, MTN Money, Moov Money, CinetPay, FedaPay.

## SMIG par pays (FCFA/mois, en vigueur 2025-2026)
| Pays | SMIG | Dernière révision |
|------|------|-------------------|
| Côte d'Ivoire | 75 000 | 2023 (+25%) |
| Sénégal | 64 223 | 2019 |
| Bénin | 52 000 | 2023 (+30%) |
| Togo | 52 500 | 2023 (+50%) |
| Burkina Faso | 45 000 | 2023 (+47%) |
| Niger | 42 000 | 2026 (+40%) |
| Mali | 40 000 | 2016 |
| Guinée-Bissau | ~19 030 | — |

## Salary Benchmarks (FCFA brut/mois, données 2024-2025)
Niveaux: Junior (<5 ans) | Confirmé (5-10 ans) | Senior (>10 ans)

### Mapping secteurs plateforme → grille salariale
PERSONAL_SERVICES → Accueil & Services | TRANSPORT → Achats & Supply Chain | PROFESSIONAL_SERVICES → Administratif, Juridique & Fiscal, RH | COMMERCE → Commercial, ADV, Distribution & Retail | FINANCE → Banque, Finance & Comptabilité, Assurance, Audit | CONSTRUCTION → Construction & BTP | DIGITAL,MEDIA → Digital, Marketing & Communication | DIGITAL → Systèmes d'Information & Tech | TOURISM → Hôtellerie & Tourisme | INDUSTRY → Industrie & Ingénieurs, Mécanique & Automobile

### Côte d'Ivoire (20 secteurs)
| Secteur | Junior | Confirmé | Senior |
|---------|--------|----------|--------|
| Accueil & Services | 75K–410K | 109K–780K | 132K–759K |
| Achats & Supply Chain | 60K–1.8M | 80K–2.4M | 150K–8.2M |
| Administratif & Office Mgmt | 80K–900K | 115K–1.7M | 132K–2.3M |
| ADV & Relation Clients | 80K–749K | 125K–1.5M | 300K–1.9M |
| Assurance | 115K–1.2M | 260K–1.75M | 485K–4M |
| Audit, Conseil & Expertise | 77K–2.9M | 174K–3.6M | 720K–3.5M |
| Banque | 70K–2.7M | 130K–4.8M | 309K–7.5M |
| Commercial | 65K–2.5M | 100K–4M | 115K–5.9M |
| Construction & BTP | 110K–1.2M | 186K–3.2M | 230K–7.7M |
| Digital, Marketing & Communication | 80K–3M | 110K–4M | 166K–5M |
| Distribution & Retail | 85K–480K | 100K–1.8M | 122K–4M |
| Finance & Comptabilité | 90K–1.5M | 110K–4M | 200K–10M |
| Hôtellerie & Tourisme | 140K–645K | 150K–2.5M | 200K–4.7M |
| Industrie & Ingénieurs | 105K–2.4M | 148K–6M | 200K–9.5M |
| Juridique & Fiscal | 100K–900K | 150K–2.3M | 200K–11.7M |
| Mécanique & Automobile | 150K–750K | 190K–1.3M | 211K–2.1M |
| Ressources Humaines | 70K–1.85M | 96K–3M | 300K–5.2M |
| Systèmes d'Information & Tech | 94K–1.4M | 155K–2.1M | 223K–13.5M |
| Top Management | — | — | 1M–10.5M |

### Sénégal (fourchettes globales)
| Secteur | Min–Max |
|---------|---------|
| Achats & Supply Chain | 74K–9M |
| Administratif & Office Mgmt | 116K–1.5M |
| Audit, Conseil & Expertise | 93K–3.7M |
| Banque | 162K–6.8M |
| Commercial | 77K–7M |
| Digital, Marketing & Communication | 138K–3.5M |
| Finance & Comptabilité | 130K–4.8M |
| Industrie & Ingénieurs | 101K–7.6M |
| Ressources Humaines | 116K–3.8M |
| Systèmes d'Information & Tech | 215K–3.8M |

### Bénin (fourchettes globales)
| Secteur | Min–Max |
|---------|---------|
| Achats & Supply Chain | 88K–2.8M |
| Commercial | 75K–3.8M |
| Digital, Marketing & Communication | 88K–1.3M |
| Finance & Comptabilité | 132K–1.7M |
| Logistique & Supply Chain | 84K–1.3M |
| Ressources Humaines | 132K–4.4M |

### Burkina Faso (fourchettes globales)
| Secteur | Min–Max |
|---------|---------|
| Commercial | 60K–2M |
| Digital, Marketing & Communication | 75K–1.5M |
| Finance & Comptabilité | 80K–2M |
| Industrie & Ingénieurs | 70K–2.5M |
| Systèmes d'Information & Tech | 100K–2M |
| Ressources Humaines | 80K–1.8M |

### Togo (fourchettes globales)
| Secteur | Min–Max |
|---------|---------|
| Commercial | 55K–1.5M |
| Digital, Marketing & Communication | 65K–1.2M |
| Finance & Comptabilité | 70K–1.5M |
| Systèmes d'Information & Tech | 80K–1.8M |
| Ressources Humaines | 65K–1.5M |

*Note: NE et GW ont des marchés de l'emploi formel très réduits — utiliser les fourchettes SMIG + secteur informel comme référence.*

## Key Companies (employers & references)
- **Telecom**: Orange CI/SN, MTN CI, Moov Africa, Wave, Togocel
- **Fintech**: Wave, CinetPay, FedaPay, Julaya, Djamo, Bridge (Baobab)
- **Tech/Digital**: Etudesk, Jumia, Glovo, Ivoirian Digital Agency, Oolu Solar
- **Banks**: SGCI, BICICI, Ecobank, BOA, Coris Bank, NSIA
- **Conseil/Audit**: Deloitte Afrique, KPMG CI, EY CI, PwC CI
- **Industrie**: SODECI, CIE, Bolloré, CFAO, Compagnie Fruitière

## Universities & Schools
- CI: INP-HB (Yamoussoukro), UCAO, Université FHB, ESATIC, Sup'Management, IAM
- SN: ESP Dakar, UCAD, ISM, BEM Dakar, ENSA, SUP DE CO
- BF: 2iE (Ouagadougou), Université Joseph Ki-Zerbo, ISTIC
- BN: EPITECH Bénin, IFRI, UAC (Abomey-Calavi), ENEAM
- TG: Université de Lomé, ESAG-NDE, UCAO Lomé
- ML: Université de Bamako, IPR/IFRA, SUP'Management Bamako
- NE: Université Abdou Moumouni (Niamey), EMIG
- Regional: ESMT (SN), CESAG (SN)

## Hubs & Incubators
- CI: Seedstars Abidjan, Orange Fab, VITIB, Akendewa, CIV Hub
- SN: CTIC Dakar, Jokkolabs, Orange Fab SN, Concree
- BF: Ouaga Lab, Yaam Digital, La Fabrique, SIRA Labs
- BN: Sèmè City, Blolab, Etrilabs, CIPMEN
- TG: Lomé Tech Hub, Innov Hub, WoeLab
- ML: Impact Hub Bamako, Jokkolabs Bamako
- Regional: AfricInvest, Seedstars Africa, Impact Hub, GSMA Innovation Fund

## Cotisations sociales (charges sur salaire brut)
### Côte d'Ivoire (CNPS)
| Branche | Employeur | Salarié | Plafond mensuel |
|---------|-----------|---------|-----------------|
| Retraite | 7.70% | 6.30% | 3 375 000 |
| Prestations familiales | 5.00% | — | 70 000 |
| Assurance maternité | 0.75% | — | 70 000 |
| Accidents du travail | 2–5%* | — | 70 000 |
| CMU (couverture santé) | 500 F/pers | 500 F/pers | forfait |
*Taux AT variable selon secteur d'activité

### Sénégal (CSS + IPRES)
| Branche | Employeur | Salarié | Plafond mensuel |
|---------|-----------|---------|-----------------|
| Retraite IPRES général | 8.40% | 5.60% | 432 000 |
| Retraite IPRES cadres | 3.60% | 2.40% | 1 296 000 |
| Prestations familiales | 7.00% | — | 63 000 |
| Accidents du travail | 1–5%* | — | 63 000 |
| Assurance maladie | 2–7.5% | 2–7.5% | 250 000 |

### Mali (INPS)
| Branche | Employeur | Salarié |
|---------|-----------|---------|
| Prestations familiales | 8.00% | — |
| AMO (assurance maladie) | 3.50% | 3.06% |
| Accidents du travail | 1–4%* | — |
| Retraite/invalidité/décès | 5.40% | 3.60% |
| Taxe ANPE | 1.00% | — |

### Burkina Faso (CNSS) — plafond 800 000 FCFA/mois
| Branche | Employeur | Salarié |
|---------|-----------|---------|
| Prestations familiales | 6.00% | — |
| Accidents du travail | 1.50% | — |
| Retraite (vieillesse) | 8.50% | 5.50% |
| **Total** | **16.00%** | **5.50%** |

### Togo (CNSS)
| Branche | Employeur | Salarié |
|---------|-----------|---------|
| Prestations familiales | 3.00% | — |
| Accidents du travail | 2.00% | — |
| Pensions (vieillesse/invalidité) | 12.50% | 4.00% |
| **Total** | **17.50%** | **4.00%** |

### Bénin (CNSS)
| Branche | Employeur | Salarié |
|---------|-----------|---------|
| Prestations familiales | 9.00% | — |
| Accidents du travail | 1–4%* | — |
| Pensions (vieillesse/invalidité) | 6.40% | 3.60% |

### Niger (CNSS) — plafond 500 000 FCFA/mois
| Branche | Employeur | Salarié |
|---------|-----------|---------|
| Prestations familiales & maternité | 8.40% | — |
| Accidents du travail | 1.75% | — |
| Retraite/invalidité/décès | 6.25% | 5.25% |
| Taxe ANPE | 1.00% | — |
| **Total** | **17.40%** | **5.25%** |

### Guinée-Bissau (INSS) — données limitées
| Branche | Employeur | Salarié |
|---------|-----------|---------|
| Régime général (estimation) | ~15% | ~5% |
*Système en cours de modernisation — consulter INSS pour taux à jour.

## Droit du travail (règles communes UEMOA)
### Durée légale du travail
- CI: 40h/semaine (48h agriculture). SN: 40h/semaine (agricole: dérogation). ML: 40h/semaine.
- Heures sup majorées: +15% (41e-46e h), +50% (au-delà), +75% (nuit), +100% (dimanche/férié).

### Congés payés
- CI: 2.2 jours ouvrables/mois travaillé ≈ 26 jours/an. SN: 24 jours/an (+1j/enfant <14 ans).
- Congé maternité: 14 semaines (6 avant + 8 après accouchement). Maintien 100% salaire.

### Préavis de licenciement (CDI)
- CI: 8j (<6 mois), 15j (6-12 mois), 1 mois (1-6 ans), 2 mois (6-11 ans), 3 mois (11-16 ans).
- SN: 1 mois (non-cadres), 3 mois (cadres). Indemnité: 25% salaire/an (0-5 ans), 30% (5-10 ans), 40% (>10 ans).
- Faute lourde = licenciement sans préavis ni indemnité.

### Période d'essai
- CDI: 1-3 mois (renouvelable 1 fois) selon catégorie. Cadres: jusqu'à 6 mois.
- CDD: max 1 mois.

## Contrats de travail
- **CDI** (permanent, forme par défaut). **CDD** (durée déterminée, max 2 ans renouvelable 1 fois). **Stage** (3-6 mois, convention obligatoire). **Freelance/Prestation** (contrat commercial, pas de subordination).
- Requalification automatique: CDD > 2 renouvellements → CDI.
- Remote/hybrid en croissance mais ON_SITE encore dominant en UEMOA.

## Job Market Specifics
- French is mandatory. English is a strong differentiator.
- Most hiring via networks, LinkedIn, and platforms like Etudesk.
- FDFP (CI) funds corporate training — key for B2B org proposals.
- Organismes clés: CNPS (CI), CSS/IPRES (SN), INPS (ML), CNSS (BF/TG/BN/NE), INSS (GW).
</uemoa_knowledge>
`;
}
