# Infrastructure Etudesk OS — Budget Recurrent

> Derniere mise a jour : 13 fevrier 2026
> Taux de change : 1 USD = 555 FCFA | 1 EUR = 656 FCFA

---

## 1. Couts Fixes Mensuels

| Service | Plan | Usage | Prix original | FCFA / mois |
|---------|------|-------|---------------|------------:|
| LWS / Infra | Cloud VPS M | Backend Node.js + PostgreSQL | 19,99 EUR HT/mois | 13 115 |
| Google Workspace | Business Starter x5 | 5 emails @etudesk.com | — | 25 000 |
| UltraMsg | WhatsApp API | Notifications WhatsApp | 39 USD/mois | 21 645 |
| Autres tools | Divers | Outils internes, licences | — | 100 000 |
| **Sous-total fixe** | | | | **159 760** |

## 2. Couts Variables Mensuels (AI)

| Service | Plan | Modeles | Estimation | FCFA / mois |
|---------|------|---------|------------|------------:|
| OpenAI API | Pay-as-you-go | GPT-5, GPT-5-mini, GPT-4.1-nano, Embeddings, Whisper, GPT-Image | Phase lancement (< 500 users) | 55 500 — 165 000 |
| | | | Phase croissance (500-5000 users) | 165 000 — 555 000 |

**Detail tarifs OpenAI (par 1M tokens) :**

| Modele | Input | Output | Usage Etudesk |
|--------|------:|-------:|---------------|
| GPT-5 (MODEL_T1) | 0,69 FCFA/1K tokens | 5,55 FCFA/1K tokens | Agents principaux (Explorer, Study, Org) |
| GPT-5-mini (MODEL_T2) | 0,14 FCFA/1K tokens | 1,11 FCFA/1K tokens | Sub-agents (FileReader, WebSearch) |
| GPT-4.1-nano (MODEL_T3) | 0,03 FCFA/1K tokens | 0,22 FCFA/1K tokens | Guardrails, classification, resumes |
| text-embedding-3-small | 0,01 FCFA/1K tokens | — | Embeddings Pinecone |
| GPT-Image-1 | 11 — 105 FCFA/image | — | Generation d'images (Study) |
| Whisper-1 | 3,33 FCFA/minute | — | Transcription audio |

**Cout moyen par utilisateur/mois :**

| Profil | Requetes/mois | Cout/utilisateur |
|--------|--------------|------------------:|
| Leger (Discover) | ~50 | 360 — 390 FCFA |
| Moyen (Talent) | ~200 | 1 440 — 1 555 FCFA |
| Intensif (Pro) | ~500 | 3 600 — 3 885 FCFA |

## 3. Services Gratuits (Plans Starter/Free)

| Service | Plan | Limite gratuite | Upgrade si necessaire |
|---------|------|-----------------|----------------------:|
| GitHub | Free | Repos prives illimites, 2000 min Actions/mois | Team : 2 220 FCFA/user/mois |
| Pinecone | Starter | 2 Go stockage, 1M reads/mois, 5 index | Standard : 27 750 FCFA/mois |
| Cloudflare | Free | DNS + CDN + SSL + protection DDoS basique | Pro : 11 100 FCFA/mois |
| Resend | Free | 3 000 emails/mois | Pro : 11 100 FCFA/mois |
| **Sous-total gratuit** | | | **0** |

## 4. Couts Annuels

| Service | Detail | Prix original | FCFA / an | FCFA / mois (amorti) |
|---------|--------|---------------|----------:|---------------------:|
| Vename | Nom de domaine etudesk.com | — | 10 000 | 833 |
| App Store | Compte developpeur Apple (hello@etudesk.org, Organisation ETUDESK) | 99 USD/an | 54 945 | 4 579 | **ACTIF** — paye 13/02/2026, Enrollment 9FU4GSGGX3, D-U-N-S 851758402 |
| Play Store | Compte developpeur Google (Organisation ETUDESK) | 25 USD (unique) | 13 875 | — | **ACTIF** — paye 13/02/2026, Developer ID 5706324467393602295 |
| **Sous-total annuel** | | | **78 820** | **5 412** |

---

## 5. Synthese Budget Mensuel

### Phase Lancement (< 500 utilisateurs actifs)

| Categorie | FCFA / mois |
|-----------|------------:|
| Fixes mensuels | 159 760 |
| AI API (estimation basse) | 55 500 |
| Annuels amortis | 5 412 |
| Services gratuits | 0 |
| **TOTAL MENSUEL** | **220 672** |

### Phase Croissance (500 — 5 000 utilisateurs actifs)

| Categorie | FCFA / mois |
|-----------|------------:|
| Fixes mensuels | 159 760 |
| AI API (estimation moyenne) | 277 500 |
| Upgrades services (Pinecone Standard + Resend Pro) | 38 850 |
| Annuels amortis | 5 412 |
| **TOTAL MENSUEL** | **481 522** |

---

## 6. Synthese Budget Annuel

| Scenario | FCFA / an |
|----------|----------:|
| Lancement (< 500 users) | ~2 650 000 |
| Croissance (500-5000 users) | ~5 780 000 |

---

## 7. Notes

1. **AI API** represente le poste le plus variable (25-60% du budget total). Le cout evolue lineairement avec le nombre d'utilisateurs actifs.
2. **LWS** : Le VPS M (2 CPU, 4 Go RAM, 160 Go SSD) est suffisant pour le lancement. Passer au VPS L (29,99 EUR/mois = 19 675 FCFA) si > 1000 users concurrents.
3. **Pinecone Starter** est gratuit jusqu'a 2 Go / 1M reads. Suffisant pour < 5000 talents indexes. Au-dela, passer au Standard ($50/mois).
4. **Resend Free** supporte 3 000 emails/mois. Pour un produit avec OTP + notifications, cela couvre ~1 000 utilisateurs actifs. Au-dela, passer au Pro ($20/mois).
5. **GitHub Free** est suffisant pour une equipe de 4. Le plan Team ($4/user/mois) ajoute les branches protegees et les reviews obligatoires.
6. **Play Store** : frais unique de $25 (pas de renouvellement annuel). **App Store** : $99/an renouvelable.
7. **UltraMsg** : integration WhatsApp pour les notifications. Alternative possible : WhatsApp Business API directe (plus cher mais plus fiable a grande echelle).

---

*Document de reference — Etudesk SAS*
