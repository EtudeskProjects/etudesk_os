# Plan d'intégration — Crédits & Billing (Paystack)

> Date: 13 février 2026  
> Scope: Sprint 1 & Sprint 2 (backend-first)  
> Référence business: `ECONOMIC_MODEL_2026.md`

## 1. Objectif

Implémenter un moteur de crédits à l'usage avec:

- wallet Talent et wallet Organisation
- ledger de débit/crédit traçable
- paiement in-app via Paystack
- génération de facture Talent (personnelle) ou Organisation (entreprise)

## 2. Schéma DB (Sprint 1)

Migration proposée:  
`backend/src/database/migrations/019_add_credit_billing_v2.sql`

Tables créées:

1. `talent_credit_wallets`
2. `organization_credit_wallets`
3. `credit_action_catalog`
4. `credit_ledger`
5. `billing_invoices`
6. `billing_invoice_items`
7. `billing_payments`
8. `paystack_webhook_events`

Notes:

- `scope` explicite: `TALENT` ou `ORGANIZATION`
- contraintes d'unicité d'ownership (talent xor organization)
- `idempotency_key` sur ledger/paiement pour éviter double débit/double crédit
- catalogue initial préchargé avec ton barème crédits

## 3. API contracts (V1)

### 3.1 Lire le catalogue

`GET /api/billing/catalog`

Response 200:

```json
{
  "data": {
    "talent": [
      { "action_code": "TALENT_ASSISTANT_EXPLORER_QUERY", "label": "Assistant Explorer (requête)", "credits": 1 }
    ],
    "organization": [
      { "action_code": "ORG_ASSISTANT_MANAGER_QUERY", "label": "Assistant Manager (requête)", "credits": 1 }
    ]
  }
}
```

### 3.2 Solde wallet

`GET /api/billing/balance?scope=talent|organization&id=<uuid>`

Rules:

- `scope=talent`: `id` optionnel, défaut = `req.talentId`
- `scope=organization`: `id` obligatoire + contrôle membership/permission

Response 200:

```json
{
  "data": {
    "scope": "talent",
    "owner_id": "uuid",
    "balance_credits": 124.5,
    "updated_at": "2026-02-13T10:00:00.000Z"
  }
}
```

### 3.3 Historique ledger

`GET /api/billing/ledger?scope=talent|organization&id=<uuid>&limit=50&cursor=<iso>`

Response 200:

```json
{
  "data": [
    {
      "id": "uuid",
      "direction": "DEBIT",
      "source_type": "CONSUMPTION",
      "action_code": "TALENT_DOCUMENT_UPLOAD",
      "credits": 1,
      "amount_fcfa": null,
      "created_at": "2026-02-13T10:01:00.000Z"
    }
  ],
  "next_cursor": "2026-02-13T09:59:59.000Z"
}
```

### 3.4 Init checkout Paystack

`POST /api/billing/checkout/init`

Request:

```json
{
  "scope": "talent",
  "owner_id": "uuid",
  "pack_code": "TALENT_2000",
  "idempotency_key": "b6f7..."
}
```

Response 201:

```json
{
  "data": {
    "payment_id": "uuid",
    "provider": "PAYSTACK",
    "status": "INITIATED",
    "amount_fcfa": 2000,
    "credits_to_credit": 20,
    "paystack_reference": "ETD_...",
    "checkout_url": "https://checkout.paystack.com/..."
  }
}
```

### 3.5 Verify checkout

`POST /api/billing/checkout/verify`

Request:

```json
{
  "paystack_reference": "ETD_..."
}
```

Response 200:

```json
{
  "data": {
    "payment_id": "uuid",
    "status": "SUCCESS",
    "wallet_credited": true,
    "invoice_id": "uuid",
    "new_balance_credits": 144.5
  }
}
```

### 3.6 Webhook Paystack

`POST /api/billing/webhooks/paystack`

Rules:

- vérifier la signature `x-paystack-signature`
- stocker l'event brut dans `paystack_webhook_events`
- idempotence via `event_id`/reference
- transitions autorisées seulement (`INITIATED/PENDING -> SUCCESS/FAILED`)

Response:

- `200 { "ok": true }` si traité
- `200 { "ok": true, "ignored": true }` si doublon

### 3.7 Factures

`GET /api/billing/invoices?scope=talent|organization&id=<uuid>&limit=20`

`GET /api/billing/invoices/:invoiceId`

Response 200:

```json
{
  "data": {
    "id": "uuid",
    "invoice_number": "ETD-2026-000012",
    "scope": "organization",
    "status": "PAID",
    "currency": "FCFA",
    "subtotal_fcfa": 10000,
    "tax_fcfa": 0,
    "total_fcfa": 10000,
    "issued_at": "2026-02-13T10:05:00.000Z",
    "paid_at": "2026-02-13T10:05:03.000Z",
    "items": [
      {
        "description": "Pack crédits Organisation 10 000 FCFA",
        "quantity": 1,
        "unit_price_fcfa": 10000,
        "line_total_fcfa": 10000,
        "credits": 120
      }
    ]
  }
}
```

## 4. Services backend à créer

1. `src/services/billing/credit.service.ts`
2. `src/services/billing/payment.service.ts`
3. `src/services/billing/invoice.service.ts`
4. `src/routes/billing.ts`

Core functions:

- `getOrCreateWallet(scope, ownerId)`
- `debitCredits({ scope, ownerId, actionCode, idempotencyKey, metadata })`
- `creditCredits({ scope, ownerId, amountCredits, sourceType, paymentId, invoiceId, idempotencyKey })`
- `initPaystackCheckout(...)`
- `verifyPaystackPayment(...)`
- `createInvoiceFromPayment(...)`

## 5. Intégration produit (Sprint 3)

Brancher `debitCredits(...)` dans:

- Assistant Explorer (Talent)
- Assistant Study (Talent)
- Génération document/image
- Upload document
- Objectif journalier
- Tâches planifiées
- Scoring application (Organisation)

Actions à 0 crédit:

- loggées (analytics), sans débit.

## 6. Sécurité & intégrité

1. Contrôle d'accès scope org (membership + permission billing).
2. Transaction SQL atomique débit wallet + insert ledger.
3. Interdiction des soldes négatifs.
4. Idempotence obligatoire sur endpoints paiement et débit.
5. Reconciliation quotidienne:
   - somme `CREDIT - DEBIT` du ledger = balance wallet.

## 7. Plan d'exécution immédiat

1. Appliquer migration `019`.
2. Implémenter `credit.service.ts` + tests unitaires.
3. Implémenter init/verify/webhook Paystack.
4. Exposer `GET balance` + `GET ledger`.
5. Brancher d'abord 2 actions pilotes:
   - `TALENT_ASSISTANT_EXPLORER_QUERY`
   - `TALENT_DOCUMENT_UPLOAD`
