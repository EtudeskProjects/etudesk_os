# Guide de Conception d'Agents IA

> Créer un agent IA n'est pas empiler des prompts. C'est faire de l'ingénierie.

---

## Principe Fondamental

Au cœur de tout agent: **observer → décider → agir → observer**

Mais la performance réelle vient de dizaines de choix subtils combinés avec rigueur, pas de la boucle elle-même.

---

## 1. Contexte: L'Agent est Situé, pas Intelligent

Le modèle ne "comprend" rien par défaut. Tout passe par ce que vous choisissez de lui montrer.

### Règles

| Principe | Application |
|----------|-------------|
| **Visibilité sélective** | Décider ce qui est visible maintenant |
| **Résumé intelligent** | Condenser pour réduire l'ambiguïté |
| **Bon contexte > Plus de contexte** | Le bon contexte, au bon moment |

> Mal présenter l'environnement = donner à un pilote un cockpit brouillé.

---

## 2. Tools: Des Lois Physiques, pas des Fonctions

La conception des tools est le levier le plus sous-estimé.

### Un Tool Canalise le Comportement

```
┌─────────────────────────────────────────────────┐
│  Tool = Micro-Constitution                      │
│  ─────────────────────────────────────────────  │
│  • Nom → Influence quand il est appelé          │
│  • Paramètres → Contraint ce qui est possible   │
│  • Retour → Guide la réponse du LLM             │
└─────────────────────────────────────────────────┘
```

Un agent bien conçu n'a pas besoin d'être "raisonnable" — il est **contraint à bien faire** par la structure de ses tools.

### Best Practices Tools

| Practice | Raison |
|----------|--------|
| **Validation stricte (Zod/Pydantic)** | Le LLM peut mal formater, le code ne doit pas laisser passer |
| **Injection des paramètres sensibles** | Ne pas laisser le LLM passer l'userId — l'injecter côté serveur |
| **Retours clairs** | Plus le retour est explicite, meilleure sera la réponse du LLM |
| **Least privilege extrême** | Lecture seule, sous-ensemble restreint, jamais d'accès global |
| **Jamais d'infos sensibles en retour** | Éviter que le LLM puisse fuiter email/téléphone/tokens |

### Gestion des Erreurs Tools

```
Tool FAIL (mauvais paramètre)
  → Message d'erreur clair
  → Le LLM peut se corriger et réessayer

Tool SUCCESS
  → Retour structuré avec ce que le LLM doit communiquer
  → Pas de données brutes inutiles
```

---

## 3. Répétition et Indices: Amplificateurs de Comportement

Les agents ne "se souviennent" pas — ils **reconnaissent des motifs**.

### Stratégie

| Technique | Effet |
|-----------|-------|
| **Répétition stratégique** | Crée de la stabilité comportementale |
| **Indices contextuels** | Rappels intelligents sans alourdir le contexte |
| **Renforcement ciblé** | Pas un hack, une stratégie délibérée |

> Un bon agent = celui à qui on **rappelle intelligemment** ce qui compte.

---

## 4. Gestion du Contexte: Le Vrai Champ de Bataille

Un agent sérieux fait face rapidement à:
- Fichiers longs
- Historiques de tool calls
- Plans intermédiaires
- Décisions passées

**Si tout est envoyé brut → le système s'écroule.**

### Stratégies de Gestion

```
┌────────────────────────────────────────────────────────┐
│  EXTRACTION    │  Ce qui est encore pertinent          │
├────────────────┼───────────────────────────────────────│
│  COMPACTION    │  Résumer sans perdre le sens          │
├────────────────┼───────────────────────────────────────│
│  CIRCULATION   │  Info efficace entre tools/sub-agents │
├────────────────┼───────────────────────────────────────│
│  OUBLI         │  Éliminer le bruit correctement       │
└────────────────┴───────────────────────────────────────┘
```

> La qualité d'un agent se mesure souvent à ce qu'il **oublie correctement**.

---

## 5. Plans: Objets Vivants, pas Sorties Statiques

Beaucoup d'agents "planifient". Peu savent **gérer** un plan.

### Caractéristiques d'un Plan Utile

| Propriété | Description |
|-----------|-------------|
| **Explicite** | Étapes claires et vérifiables |
| **Réévaluable** | Peut être ajusté en cours de route |
| **Renforcé** | Rappelé au bon moment |

### Séparation Critique

```
┌─────────────────┬────────────────────────────────────┐
│  STRATÉGIE      │  Quoi faire et pourquoi            │
├─────────────────┼────────────────────────────────────┤
│  EXÉCUTION      │  Comment le faire concrètement     │
├─────────────────┼────────────────────────────────────┤
│  MÉTA-RÉFLEXION │  Est-ce que ça marche? Ajuster?    │
└─────────────────┴────────────────────────────────────┘
```

> Sans cette séparation, l'agent **dérive ou s'entête**.

---

## 6. Orchestration: La Performance Émerge de la Combinaison

**Aucun élément n'est magique en soi:**
- Ni le prompt
- Ni la loop
- Ni le modèle
- Ni le RAG
- Ni la mémoire

### Ce qui Fait la Différence

| Facteur | Impact |
|---------|--------|
| Présentation du contexte | Comment l'info arrive au modèle |
| Conception des tools | Contraintes et possibilités |
| Stratégie de cache | Réutilisation intelligente |
| Circulation de l'info | Entre tools et sub-agents |

> Deux agents avec la même boucle peuvent avoir des performances **radicalement différentes**.

---

## 7. Sécurité et Observabilité

### Sécurité

```typescript
// ❌ DANGER: Le LLM contrôle l'ID
const user = await getUser(params.userId);

// ✅ SAFE: ID injecté côté serveur
const user = await getUser(authenticatedUserId);
```

**Règles:**
- Least privilege à l'extrême
- Jamais d'infos sensibles en retour de tool
- Lecture seule quand possible
- Sous-ensemble restreint de la base

### Observabilité (Tracing)

Quand ça plante, savoir exactement:
1. Quel tool appelé
2. Avec quels paramètres
3. Ce qu'il a renvoyé

```typescript
// Log structuré pour chaque tool call
logger.info('tool_call', {
  tool: toolName,
  params: sanitizedParams,
  result: truncatedResult,
  duration: ms,
  success: boolean
});
```

---

## 8. Checklist de Conception

### Avant de Coder

- [ ] Définir le périmètre exact de l'agent
- [ ] Identifier les tools nécessaires (et seulement ceux-là)
- [ ] Déterminer quelles infos doivent être visibles à chaque étape
- [ ] Planifier la gestion du contexte long

### Tools

- [ ] Noms explicites et actionnables
- [ ] Paramètres validés (Zod/Pydantic)
- [ ] Paramètres sensibles injectés (pas passés par le LLM)
- [ ] Retours clairs avec guidance pour le LLM
- [ ] Pas d'infos sensibles dans les retours
- [ ] Least privilege appliqué

### Contexte

- [ ] Extraction du pertinent
- [ ] Compaction sans perte de sens
- [ ] Mécanisme d'oubli délibéré
- [ ] Séparation stratégie/exécution/méta

### Observabilité

- [ ] Logging de tous les tool calls
- [ ] Tracing end-to-end
- [ ] Alertes sur erreurs critiques

---

## Conclusion

> Un agent IA n'est ni un chatbot amélioré, ni une simple automatisation.
> C'est un **système cognitif artificiel**, limité, contraint, mais orienté vers l'action.

Le vrai travail n'est pas de faire "réfléchir" le modèle, mais de **créer un environnement dans lequel il ne peut que bien réfléchir**.

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   La valeur est dans les détails...                     │
│   et dans leur combinaison.                             │
│                                                         │
└─────────────────────────────────────────────────────────┘
```
