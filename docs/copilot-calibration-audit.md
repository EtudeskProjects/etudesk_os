# Copilot Calibration Report

> Generated: 2026-02-13T20:52:09.417Z
> Tests: 1 | Passed: 1 | Failed: 0

## Calibration Summary

| Test | Agent | Chars | Questions | Tools | Verbosity | Proactivity | Quick Ack | Cards |
|------|-------|-------|-----------|-------|-----------|-------------|-----------|-------|
| ✅ Org — Talents CRM | org | 510 | 1 | 1 | ok | proactive | ✅ | 1 |

## Calibration Issues

---

## Detailed Results

### Org Agent

#### ✅ Org — Talents CRM (8737ms)

**Prompt:** `Montre-moi les talents qui ont interagi avec mon organisation`

**Calibration:** Verbosity=ok, Proactivity=proactive, Chars=510, Questions=1, Tools=1

**Tool: `sql_query`** (28ms)
```json
{
  "intent": "org_talents",
  "paramsJson": "{\"organizationId\":\"6a80d332-9d56-489c-8314-b65746b4cd78\"}"
}
```

**Agent Output:**
```markdown
Voici les talents connectés à votre organisation.```entity:talent
{"id":"689f7929-7c13-4103-b119-09a806836347"}
```

**1 talent identifié — membre de votre équipe (MEMBER)**

Lamine Barro est basé à Abobo, Côte d'Ivoire, spécialisé dans le digital, l'éducation, tourisme et transport. Profil entrepreneur avec une approche multi-sectorielle — intégré comme membre le 6 février.

Souhaitez-vous consulter son profil détaillé avec ses compétences, ou rechercher d'autres talents via candidatures et communautés ?
```

---

## Prompt Tuning Recommendations

- **Average response length:** 510 chars (target: 300-800)
- **Average questions per response:** 1.0 (target: 0-1)
- **Average tool calls per response:** 1.0 (target: 1-3)

