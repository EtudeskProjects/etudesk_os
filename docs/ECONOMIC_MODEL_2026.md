# Modèle Économique Etudesk OS (V2)

> Date: 13 février 2026  
> Statut: Référence produit/commerciale active

## 1. Principe

Etudesk passe d'un modèle d'abonnement à un modèle **crédits à l'usage**.

- Les actions IA/produit consomment un nombre fixe de crédits.
- Les recettes sont rattachées à:
  - un **Talent** (facture personnelle), ou
  - une **Organisation** (facture entreprise, crédits mutualisés).
- Le paiement se fait **in-app via Paystack**.

## 2. Barème crédits

### Talents

| Action | Crédits |
|---|---:|
| Assistant Explorer (requête) | 1 |
| Assistant Study (requête) | 0,25 |
| Génération de document | 1 |
| Génération d'image | 1 |
| Upload de document | 1 |
| Objectif journalier | 1 |
| Tâche planifiée / trigger | 1 |
| Recherche YouTube | 0 |
| Recherche web | 0 |
| Quiz / Flashcards / Diagrammes | 0 |
| Instruction vocale | 0 |
| Postuler / Réserver / Adhérer | 0 |

### Organisations

| Action | Crédits |
|---|---:|
| Assistant Manager (requête) | 1 |
| Upload de document | 1 |
| Génération de document | 1 |
| Objectif journalier | 1 |
| Tâche planifiée / trigger | 1 |
| Analyse et scoring d'application | 0,5 |
| Recherche web | 0 |
| Instruction vocale | 0 |
| Modération de contenu communauté | 0 |

## 3. Règles de facturation

### Talent (B2C)

- Porteur de facture: **talent_id**
- Montant minimum de facture: **2 000 FCFA**
- La facture est émise au nom de l'utilisateur (facture personnelle).
- Les crédits achetés sont consommables uniquement par ce talent.

### Organisation (B2B)

- Porteur de facture: **organization_id**
- Montant minimum de facture: **10 000 FCFA**
- La facture est émise à l'entreprise.
- Les crédits achetés sont **mutualisés** et utilisables par tous les sous-admins/membres autorisés de l'organisation.

## 4. Paiement in-app (Paystack)

- Provider unique: **Paystack**
- Flux cible:
  1. L'utilisateur (talent ou org admin) sélectionne un pack crédit
  2. Initialisation transaction in-app (API backend)
  3. Paiement Paystack (mobile money/carte selon pays)
  4. Vérification backend + webhook
  5. Crédit du wallet concerné (talent ou organisation)
  6. Génération facture (personnelle ou entreprise)

## 5. Gouvernance produit

- Toute nouvelle action doit:
  - être rattachée à `scope = talent|organization`,
  - définir son coût crédit explicitement,
  - être documentée ici avant mise en production.
- Les actions à `0` crédit restent loggées pour analytics.

## 6. Notes d'implémentation (prochaine phase)

- Wallet séparés:
  - `talent_credit_wallet`
  - `organization_credit_wallet`
- Ledger des mouvements (achat, consommation, ajustement, remboursement)
- Pricing pack FCFA configurable
- Contrôles d'autorisation org avant débit mutualisé

Blueprint technique détaillé:
`Etudesk_SAS/produit/etudesk_os/docs/CREDITS_BILLING_INTEGRATION_PLAN.md`
