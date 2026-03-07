# Serveur VPS - Production

| Champ | Valeur |
|-------|--------|
| Hostname | vps117933.serveur-vps.net |
| Adresse IP | 31.207.33.69 |
| Utilisateur | root |
| Mot de passe | R2I7E3b5l6N9z5z |
| OS | Ubuntu 24.04 |
| Node.js | v20.20.0 |

## Connexion SSH

```bash
sshpass -p 'R2I7E3b5l6N9z5z' ssh -o StrictHostKeyChecking=no root@31.207.33.69
```

## Services deployes

| Service | Path | PM2 Process | Port | Status |
|---------|------|-------------|------|--------|
| Etudesk OS API | /var/www/etudesk/backend | etudesk-api | 3000 | actif |
| Etudesk OS Web | /var/www/etudesk/web | etudesk-web | 3001 | actif |

### Paths importants

| Ressource | Path |
|-----------|------|
| Code source backend | /var/www/etudesk/backend |
| Build compile | /var/www/etudesk/backend/dist/ |
| Entry point | /var/www/etudesk/backend/dist/index.js |
| Env vars | /var/www/etudesk/backend/.env |
| Skills definitions | /var/www/etudesk/backend/dist/services/copilot/skills/definitions/ |
| Uploads | /var/www/etudesk/backend/uploads/ |
| PM2 logs | /root/.pm2/logs/etudesk-api-*.log |
| Migrations legacy | /var/www/etudesk/backend/src/database/migrations_legacy/ |
| Code source web | /var/www/etudesk/web |
| PM2 logs web | /root/.pm2/logs/etudesk-web-*.log |
| Reverse proxy | nginx (ports 80/443) |

## Base de donnees

| Champ | Valeur |
|-------|--------|
| Type | PostgreSQL |
| Host | localhost:5432 |
| Database | etudesk-db |
| User | etudesk |
| Password | R2I7E3b5l6N9z5z |
| Connection | `PGPASSWORD='R2I7E3b5l6N9z5z' psql -h localhost -U etudesk -d etudesk-db` |

### Donnees actuelles (2026-03-07)

| Entite | Count |
|--------|-------|
| Talents | 20 |
| Organizations | 1 (Etudesk SAS) |
| Opportunities | 8 |
| Communities | 2 |
| Spaces | 2 |
| **Waitlist** | **49** |

### Waitlist (49 inscrits — maj 2026-03-07)

| # | Type | Pays | Contact | Date |
|---|------|------|---------|------|
| 1 | TALENT | Cote dIvoire | lamteck@gmail.com | 2026-02-17 |
| 2 | TALENT | Cote dIvoire | lamine.barro@etudesk.org | 2026-02-17 |
| 3 | TALENT | Cote dIvoire | +225074631148 | 2026-02-17 |
| 4 | ORGANIZATION | Niger | +2250705005234 | 2026-02-17 |
| 5 | TALENT | Côte d'Ivoire | lamine.barr@etudesk.org | 2026-02-17 |
| 6 | TALENT | Côte d'Ivoire | +2250757684847 | 2026-02-17 |
| 7 | TALENT | Côte d'Ivoire | 0143932231 | 2026-02-17 |
| 8 | ORGANIZATION | Côte d'Ivoire | +2250141112792 | 2026-02-17 |
| 9 | TALENT | Autre | +33766552499 | 2026-02-17 |
| 10 | TALENT | Côte d'Ivoire | +2250709783111 | 2026-02-17 |
| 11 | TALENT | Côte d'Ivoire | +2250153843271 | 2026-02-17 |
| 12 | TALENT | Côte d'Ivoire | 0747313348 | 2026-02-17 |
| 13 | TALENT | Côte d'Ivoire | 0749136359 | 2026-02-17 |
| 14 | TALENT | Bénin | +2290196110323 | 2026-02-17 |
| 15 | ORGANIZATION | Côte d'Ivoire | j.mercy@afdb.org | 2026-02-18 |
| 16 | TALENT | Côte d'Ivoire | +2250505020516 | 2026-02-18 |
| 17 | TALENT | Côte d'Ivoire | 0574852472 | 2026-02-18 |
| 18 | TALENT | Côte d'Ivoire | 0748807810 | 2026-02-18 |
| 19 | TALENT | Côte d'Ivoire | murfieeddy@gmail.com | 2026-02-18 |
| 20 | TALENT | Côte d'Ivoire | +2250747569752 | 2026-02-19 |
| 21 | TALENT | Côte d'Ivoire | 0747086945 | 2026-02-19 |
| 22 | TALENT | Côte d'Ivoire | 0544167776 | 2026-02-19 |
| 23 | TALENT | Côte d'Ivoire | 0705913562 | 2026-02-19 |
| 24 | TALENT | Côte d'Ivoire | +2250799367595 | 2026-02-20 |
| 25 | TALENT | Côte d'Ivoire | 0150269648 | 2026-02-20 |
| 26 | TALENT | Côte d'Ivoire | 0586211047 | 2026-02-23 |
| 27 | TALENT | Côte d'Ivoire | 0172110222 | 2026-02-23 |
| 28 | TALENT | Côte d'Ivoire | 0564921007 | 2026-02-23 |
| 29 | TALENT | Côte d'Ivoire | 0749659254 | 2026-02-24 |
| 30 | TALENT | Côte d'Ivoire | 0747847590 | 2026-02-24 |
| 31 | TALENT | Côte d'Ivoire | a.beugrejean@gmail.com | 2026-02-24 |
| 32 | TALENT | Côte d'Ivoire | 0768763769 | 2026-02-24 |
| 33 | ORGANIZATION | Côte d'Ivoire | 0749084633 | 2026-02-25 |
| 34 | TALENT | Côte d'Ivoire | 0707157167 | 2026-02-26 |
| 35 | TALENT | Côte d'Ivoire | 0173787976 | 2026-02-27 |
| 36 | TALENT | Côte d'Ivoire | 0789965224 | 2026-02-28 |
| 37 | TALENT | Côte d'Ivoire | 0759329484 | 2026-02-28 |
| 38 | TALENT | Côte d'Ivoire | 0758110045 | 2026-02-28 |
| 39 | TALENT | Côte d'Ivoire | 0788799514 | 2026-03-02 |
| 40 | TALENT | Côte d'Ivoire | 0749212721 | 2026-03-02 |
| 41 | TALENT | Côte d'Ivoire | +2250708369405 | 2026-03-02 |
| 42 | TALENT | Côte d'Ivoire | 0768166502 | 2026-03-02 |
| 43 | TALENT | Côte d'Ivoire | 0768600763 | 2026-03-03 |
| 44 | ORGANIZATION | Côte d'Ivoire | 0596814287 | 2026-03-03 |
| 45 | TALENT | Côte d'Ivoire | 0566057166 | 2026-03-04 |
| 46 | ORGANIZATION | Côte d'Ivoire | 0797836313 | 2026-03-04 |
| 47 | ORGANIZATION | Côte d'Ivoire | 0100521960 | 2026-03-05 |
| 48 | TALENT | Côte d'Ivoire | 0555566613 | 2026-03-06 |
| 49 | TALENT | Côte d'Ivoire | 0767202028 | 2026-03-06 |

**Repartition :** 42 Talents, 7 Organizations | 44 CI, 1 Benin, 1 Niger, 1 France, 2 Autre | 44 WhatsApp, 5 Email

### Compte de test principal

| Champ | Valeur |
|-------|--------|
| Email | etudesksas@gmail.com |
| talent_id | 90000000-0000-4000-8000-000000000001 |
| user_id | 91000000-0000-4000-8000-000000000001 |
| org_id | 10000000-0000-4000-8000-000000000001 |
| Nom | Lamine Barro |
| Ville | Abidjan, CI |

## API

| Champ | Valeur |
|-------|--------|
| Base URL | http://localhost:3000 (interne) |
| API prefix | /api/v1 |
| Health check | GET /health |
| Copilot chat | POST /api/v1/copilot/chat |

### Generer un token JWT (pour tests)

```bash
cd /var/www/etudesk/backend && node -e "
const jwt=require('jsonwebtoken');
console.log(jwt.sign({
  userId:'91000000-0000-4000-8000-000000000001',
  talentId:'90000000-0000-4000-8000-000000000001',
  email:'etudesksas@gmail.com',
  type:'access'
}, process.env.JWT_ACCESS_SECRET || 'aa0ae1e71d45f86c74c977b8d1d72d5e0a7b7e59af2b8b4eb6613c140c566afdd74e1a0b42b4654f2bc6389aa350f378aedd063e522680d417510240f189129d', {expiresIn:'1h'}));
"
```

### Test rapide copilot

```bash
TOKEN=$(cd /var/www/etudesk/backend && node -e "const jwt=require('jsonwebtoken');console.log(jwt.sign({userId:'91000000-0000-4000-8000-000000000001',talentId:'90000000-0000-4000-8000-000000000001',email:'etudesksas@gmail.com',type:'access'},'aa0ae1e71d45f86c74c977b8d1d72d5e0a7b7e59af2b8b4eb6613c140c566afdd74e1a0b42b4654f2bc6389aa350f378aedd063e522680d417510240f189129d',{expiresIn:'1h'}))")

curl -X POST http://localhost:3000/api/v1/copilot/chat \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Accept: text/event-stream' \
  -d '{"message":"Bonjour","mode":"explore"}'
```

## Deploiement

```bash
# Depuis la machine locale
cd /Users/laminebarro/Projects/ETUDESK/Etudesk_SAS/produit/etudesk_os
git push origin deploy/production

# Sur le VPS
cd /var/www/etudesk/backend
git pull origin deploy/production
npm run build
pm2 restart etudesk-api

# Web (Next.js)
cd /var/www/etudesk/web
git pull origin deploy/production
npm run build
pm2 restart etudesk-web
```

## Deploiement (2026-02-16)

- Branch backend: `deploy/production` (commit `9822305`) + build OK + `pm2 restart etudesk-api` OK
- Branch web: `deploy/production` (commit `9822305`) + `etudesk-web` online sur le port `3001`

### Logs recents (etudesk-api)

- WARN: guardrails/input_safety a bloque un input classifie `HARMFUL`
- WARN: output_format (reponses > 1200 chars)
- ERROR (2026-02-16 00:30:11): `Error fetching opportunities: could not determine data type of parameter $1`

### Logs recents (etudesk-web)

- ERROR: Next.js `Failed to find Server Action` (souvent lie a un deploy: client/serveur pas synchronises pendant quelques minutes)

### Hotfix VPS (2026-02-16)

- Web: `next start` force sur `127.0.0.1:3001` (evite l'acces direct au port 3001 depuis Internet, nginx reste en frontal)
- API: patch route `GET /api/v1/opportunities` (casts explicites UUID/text + log SQL si l'erreur `could not determine data type` revient)
- DB/API: ajout table `agenda_triggers` (migration `024_add_agenda_triggers.sql`) + agenda organisation via `GET /api/v1/calendar/events?organizationId=...` + endpoints `POST/PATCH /api/v1/calendar/triggers`

## Migrations executees (2026-02-14)

Toutes les migrations legacy 001-022 ont ete executees :

| Migration | Description | Status |
|-----------|-------------|--------|
| 001 | KYC + scheduled activities | OK |
| 002 | Notification prefs + languages | OK |
| 003-012 | Colonnes additionnelles | OK |
| 013 | Preferred language | OK |
| 014 | Daily objectives | OK |
| 015 | Copilot attachments | OK |
| 016 | Copilot sessions mode constraint | OK |
| 017 | Unify notifications | OK |
| 018 | Waitlist | OK |
| 019 | Credit billing v2 | OK |
| 020 | Org talents + org documents | OK |
| 021 | Skill visibility | OK |
| 022 | Credit prices update | OK |

### Wallet credits (test)

Le compte etudesksas@gmail.com a 1000 credits talent + 1000 credits org (ajoutes pour les tests).

---

## Monitoring automatise (depuis le Mac de Lamine)

Un cron job local surveille le VPS et envoie des notifications macOS en cas de probleme.

| Champ | Valeur |
|-------|--------|
| Script | `~/scripts/monitor_vps.sh` |
| Frequence | Toutes les 8h (7h, 15h, 23h) |
| Checks | Ping (2 tentatives, timeout 5s) + HTTP `GET /health` (timeout 10s) |
| Notifications | `terminal-notifier` (macOS) — son Basso si down, Glass si recovery |
| Log | `~/scripts/vps_monitor.log` |
| Etat | `~/scripts/.vps_state` (up/down, evite les alertes repetees) |

### Comportement

| Etat | Ping | HTTP /health | Action |
|------|------|-------------|--------|
| **UP** | OK | 2xx/3xx | Rien (ou notification recovery si etait down) |
| **ALERTE** | OK | 4xx/5xx/timeout | Notification "VPS ALERTE" — serveur accessible mais API down (PM2 crash ?) |
| **DOWN** | FAIL | — | Notification "VPS DOWN" — serveur injoignable |

### Crontab

```bash
# Verifier la config
crontab -l

# Contenu actuel
0 7,15,23 * * * $HOME/scripts/monitor_vps.sh
30 17 * * * $HOME/scripts/backup_filestream.sh
```

### Test manuel

```bash
# Forcer un test immediat
~/scripts/monitor_vps.sh

# Voir les logs
cat ~/scripts/vps_monitor.log

# Reset l'etat (force re-notification au prochain run)
echo "up" > ~/scripts/.vps_state
```

---

*Derniere mise a jour : 07 mars 2026*
