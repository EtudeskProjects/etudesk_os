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

### Donnees actuelles (2026-02-14)

| Entite | Count |
|--------|-------|
| Talents | 20 |
| Organizations | 1 (Etudesk SAS) |
| Opportunities | 8 |
| Communities | 2 |
| Spaces | 2 |

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

*Derniere mise a jour : 16 fevrier 2026*
