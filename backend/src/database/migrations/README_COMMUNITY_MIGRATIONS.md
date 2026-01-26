# Migrations Module Communautés - v2.0

## Vue d'ensemble

Ces migrations implémentent les nouvelles fonctionnalités du module communautés selon les spécifications 2026.

## Ordre d'exécution

```
014_community_monetization.sql       -> Tables abonnements, paiements, factures
015_community_notifications.sql      -> Table notifications communautaires
016_community_activities_updates.sql -> Publications différées, bookmarks, likes uniquement
017_community_comments_updates.sql   -> Mentions @pseudo, édition commentaires
018_community_cleanup_obsolete.sql   -> Suppression tables/colonnes obsolètes
```

## Nouvelles Tables

| Table | Description |
|-------|-------------|
| `community_subscriptions` | Abonnements mensuels via Paystack |
| `community_payments` | Historique des paiements |
| `community_invoices` | Factures téléchargeables |
| `community_notifications` | Notifications (mentions, rappels, etc.) |

## Tables Supprimées

| Table | Raison |
|-------|--------|
| `community_comment_reactions` | Pas de réactions sur commentaires dans les specs |
| `community_membership_messages` | Fonctionnalité non requise |
| `community_skills` | Fonctionnalité non requise |

## Colonnes Ajoutées

### `communities`
- `trial_period_days` (INTEGER) - Période d'essai: 0, 1, 3, 7, 30 jours

### `community_activities`
- `scheduled_at` (TIMESTAMP) - Publication différée
- `published_at` (TIMESTAMP) - Date de publication effective
- `bookmarks_count` (INTEGER) - Compteur de favoris

### `community_activity_comments`
- `mentions` (UUID[]) - IDs des utilisateurs mentionnés
- `edited_at` (TIMESTAMP) - Dernière modification manuelle
- `replies_count` (INTEGER) - Compteur de réponses

## Colonnes Supprimées

### `community_activities`
- `shares_count` - Pas de partage dans les specs

### `community_activity_reactions`
- `type` - Simplifié à likes uniquement

### `community_activity_comments`
- `reactions_count` - Pas de réactions sur commentaires

### `community_members`
- `internal_notes` - Workflow recrutement
- `rating` - Workflow recrutement
- `viewed_at` - Workflow recrutement

## Contraintes Ajoutées

1. **Un seul épinglé par communauté**: Index unique partiel sur `is_pinned = TRUE`
2. **Période d'essai valide**: CHECK constraint `trial_period_days IN (0, 1, 3, 7, 30)`
3. **Contenu non vide**: CHECK constraint sur `community_activities.content`

## Triggers Ajoutés

- `trigger_update_activity_bookmarks_count` - Compteur bookmarks
- `trigger_set_activity_published_at` - Auto-set published_at
- `trigger_update_comment_replies_count` - Compteur réponses

## Fonctions Ajoutées

- `generate_invoice_number()` - Génère numéros de facture (INV-YYYY-NNNNN)
- `mark_community_notifications_read()` - Batch mark as read
- `extract_mentions_from_content()` - Extrait @mentions du texte
- `update_activity_bookmarks_count()` - Met à jour compteur bookmarks
- `update_comment_replies_count()` - Met à jour compteur réponses

## Vues Ajoutées

- `community_feed` - Activités publiées prêtes pour le fil
- `community_notification_counts` - Compteurs de notifications par utilisateur

## Types TypeScript Mis à Jour

Fichier: `src/types/community-activity.types.ts`

### Nouveaux Types
- `SubscriptionStatus`
- `PaymentStatus`
- `InvoiceStatus`
- `TrialPeriodDays`
- `CommunityNotificationType`
- `EventLocationType`

### Interfaces Ajoutées
- `CommunitySubscription`
- `CommunityPayment`
- `CommunityInvoice`
- `CommunityNotification`
- `ActivityLike`
- `ActivityBookmark`

### Interfaces Modifiées
- `CommunityActivity` - +scheduled_at, +published_at, +bookmarks_count, -shares_count
- `ActivityComment` - +mentions, +edited_at, +replies_count, -reactions_count
- `CommunityActivityMetadata` - +show_results (pour sondages)

## Migration des Données

Avant d'exécuter `018_community_cleanup_obsolete.sql`, assurez-vous de:

1. Sauvegarder les données des tables à supprimer si nécessaire
2. Migrer les données utiles vers les nouvelles structures
3. Exécuter `VACUUM ANALYZE` après les suppressions

## Commandes d'Exécution

```bash
# Exécuter toutes les migrations
psql -d votre_db -f 014_community_monetization.sql
psql -d votre_db -f 015_community_notifications.sql
psql -d votre_db -f 016_community_activities_updates.sql
psql -d votre_db -f 017_community_comments_updates.sql
psql -d votre_db -f 018_community_cleanup_obsolete.sql

# Ou via le script de migration (si disponible)
npm run db:migrate
```

## Rollback

Pour annuler les migrations (dans l'ordre inverse):

```sql
-- Rollback 018
-- Recréer les tables supprimées (nécessite backup)

-- Rollback 017
ALTER TABLE community_activity_comments
DROP COLUMN IF EXISTS mentions,
DROP COLUMN IF EXISTS edited_at,
DROP COLUMN IF EXISTS replies_count;

-- Rollback 016
ALTER TABLE community_activities
ADD COLUMN IF NOT EXISTS shares_count INTEGER DEFAULT 0,
DROP COLUMN IF EXISTS scheduled_at,
DROP COLUMN IF EXISTS published_at,
DROP COLUMN IF EXISTS bookmarks_count;

ALTER TABLE community_activity_reactions
ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'LIKE';

-- Rollback 015
DROP TABLE IF EXISTS community_notifications CASCADE;

-- Rollback 014
DROP TABLE IF EXISTS community_invoices CASCADE;
DROP TABLE IF EXISTS community_payments CASCADE;
DROP TABLE IF EXISTS community_subscriptions CASCADE;
ALTER TABLE communities DROP COLUMN IF EXISTS trial_period_days;
```
