# Copilot Calibration Report

> Generated: 2026-06-29T23:25:33.792Z
> Tests: 1 | Passed: 1 | Failed: 0

## Calibration Summary

| Test | Agent | Chars | Questions | Tools | Tokens In | Tokens Out | Cached | Verbosity | Proactivity | Quick Ack | Cards |
|------|-------|-------|-----------|-------|-----------|------------|--------|-----------|-------------|-----------|-------|
| ✅ Study — Video YouTube agriculture durable | study | 599 | 1 | 2 | 58032 | 568 | 56768 | ok | proactive | ✅ | 0 |

## Calibration Issues

---

## Detailed Results

### Study Agent

#### ✅ Study — Video YouTube agriculture durable (41122ms)

**Prompt:** `Trouve-moi une bonne video YouTube sur l'agriculture durable`

**Calibration:** Verbosity=ok, Proactivity=proactive, Chars=599, Questions=1, Tools=2

**Usage:** Requests=3, Input=58032, Output=568, Cached=56768

**Tool: `find_competency`** (528ms)
```json
{
  "query": "sustainable agriculture"
}
```

**Tool: `youtube_search`** (803ms)
```json
{
  "query": "pratiques d'agriculture durable durable farming techniques",
  "maxResults": 5
}
```

**Agent Output:**
```markdown
Bonne question ! Je vérifie d'abord si ce sujet fait partie du référentiel de compétences.Parfait, c'est un sujet du référentiel ! Je cherche une vidéo adaptée.Excellente trouvaille ! Cette vidéo de Carbo aborde justement les pratiques concrètes pour passer d'un modèle intensif à une agriculture durable, ce qui correspond parfaitement au sujet.

```youtube
{"videoId":"vtjMX5pawJ4","title":"Agriculture durable : quelles pratiques pour sortir d'un modèle intensif ?","channelName":"Carbo","description":"Décryptage des pratiques agricoles durables et des alternatives au modèle intensif : régénération des sols, rotation des cultures et agroécologie."}
```

Avec ton profil en **Data Analytics** et **AI Governance**, tu pourrais explorer comment les données et l'IA s'appliquent à l'agriculture de précision, un pont intéressant entre tes compétences actuelles et ce domaine. Veux-tu qu'on creuse ce lien ?
```

---

## Prompt Tuning Recommendations

- **Average response length:** 599 chars (target: 300-800)
- **Average questions per response:** 1.0 (target: 0-1)
- **Average tool calls per response:** 2.0 (target: 1-3)

- **Total tokens:** input=58032, output=568, cached=56768

