# Copilot Calibration Report

> Generated: 2026-06-29T13:14:47.504Z
> Tests: 1 | Passed: 1 | Failed: 0

## Calibration Summary

| Test | Agent | Chars | Questions | Tools | Tokens In | Tokens Out | Cached | Verbosity | Proactivity | Quick Ack | Cards |
|------|-------|-------|-----------|-------|-----------|------------|--------|-----------|-------------|-----------|-------|
| ✅ Org — Recruter profils marketing | org | 2469 | 1 | 4 | 16249 | 1187 | 9920 | verbose | proactive | ❌ | 0 |

## Calibration Issues

### Too Verbose (>1500 chars)
- **Org — Recruter profils marketing**: 2469 chars, 20 sentences

### ❌ Missing Quick Acknowledgment (slow time-to-first-token)
- **Org — Recruter profils marketing**: No text before first tool call — user sees nothing until tool completes

---

## Detailed Results

### Org Agent

#### ✅ Org — Recruter profils marketing (47890ms)

**Prompt:** `Trouve-moi 5 profils marketing digital seniors disponibles en remote`

**Calibration:** Verbosity=verbose, Proactivity=proactive, Chars=2469, Questions=1, Tools=4

**Usage:** Requests=4, Input=16249, Output=1187, Cached=9920

**Tool: `smart_search`** (902ms)
```json
{
  "query": "marketing digital senior remote",
  "entity": "talents",
  "topK": 10
}
```

**Tool: `smart_search`** (386ms)
```json
{
  "query": "marketing digital senior experience remote freelance",
  "entity": "talents",
  "topK": 15
}
```

**Tool: `smart_search`** (?ms)
```json
{
  "query": "digital marketing manager strategist senior remote",
  "entity": "talents",
  "topK": 15
}
```

**Tool: `sql_query`** (28ms)
```json
{
  "intent": "org_talents",
  "params": {
    "organizationId": "10000000-0000-4000-8000-000000000001"
  },
  "query": "marketing digital senior remote"
}
```

**Agent Output:**
```markdown
J'ai parcouru l'ensemble du vivier de talents d'Etudesk SAS (20 profils) à la recherche de profils marketing digital seniors. Voici mon analyse :

---

## 🔍 Résultat de la recherche

### ✅ Profil directement pertinent (1)

| # | Nom | Bio | Ville | Source |
|---|-----|-----|-------|--------|
| 1 | **Fatou Traoré** | Consultante en marketing digital. Spécialisée en **acquisition, contenu et partenariats**. A accompagné des PME et des programmes d'incubation. | Abidjan, CI | Application, Community, Member, Space |

### 🟡 Profils adjacents / marketing-adjacent (4)

| # | Nom | Bio | Ville | Pourquoi |
|---|-----|-----|-------|----------|
| 2 | **Mariama Faye** | Community builder. Animation de groupes, modération, programme d'événements et **contenus pédagogiques**. | Dakar, SN | Création de contenu & animation de communauté = marketing digital |
| 3 | **Tidiane Cissé** | Product manager. Roadmap, discovery, métriques, **go-to-market**. | Abidjan, CI | Go-to-market et métriques produit = overlap marketing stratégique |
| 4 | **Aïcha Sow** | Entrepreneure agro. Structuration des filières, **marketing**, distribution. | Ziguinchor, SN | Marketing mais orienté agro, pas digital |
| 5 | **Cheick Sanogo** | Entrepreneur retail. Mise en place de points de vente, mobile money, formation vendeurs. | Abidjan, CI | Distribution & vente, marketing terrain mais pas digital |

---

## 📊 Diagnostic & recommandations

**Le constat :** Votre vivier actuel est dominé par des profils **tech** (DevOps, Full Stack, Mobile, Backend) et **RH/formation**. Seule **Fatou Traoré** correspond précisément à un profil marketing digital senior.

### Actions recommandées :

1. **Prioriser Fatou Traoré** → C'est votre meilleur match. Elle a postulé, est membre de communautés et a déjà réservé un espace — signe d'engagement fort. Je peux consulter son profil détaillé si tu le souhaites.

2. **Élargir le recrutement** → Ton vivier ne contient pas assez de profils marketing digital. Je peux :
   - 📌 **Publier une opportunité** marketing digital senior en remote pour attirer de nouveaux candidats
   - 🔎 **Rechercher sur le web** des benchmarks de profils marketing digital senior en Afrique de l'Ouest pour affiner tes critères
   - 🏘️ **Identifier des communautés** marketing/digital sur la plateforme où recruter ces profils

Veux-tu que je creuse le profil de Fatou Traoré ou que je lance une recherche de communautés marketing digital pour élargir ton vivier ?
```

---

## Prompt Tuning Recommendations

- **Average response length:** 2469 chars (target: 300-800)
- **Average questions per response:** 1.0 (target: 0-1)
- **Average tool calls per response:** 4.0 (target: 1-3)

- **Total tokens:** input=16249, output=1187, cached=9920

> **ACTION: Reduce verbosity.** Add explicit length constraint to prompts: "Keep responses between 3-5 sentences plus entity cards."

