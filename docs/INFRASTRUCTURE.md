# Infrastructure Etudesk OS

> Architecture cible : PostgreSQL + pgvector, provider IA generique compatible OpenAI pour les modeles open-source, OpenAI conserve uniquement pour la moderation gratuite si activee.

## Services actifs

| Service | Usage |
|---------|-------|
| LWS / VPS | Backend Node.js + PostgreSQL |
| PostgreSQL + pgvector | Base relationnelle et recherche vectorielle locale |
| Resend / SMTP | OTP email et emails transactionnels |
| Paystack | Paiements FCFA |
| Expo Push | Notifications mobiles |
| Provider IA generique | LLM, vision, embeddings, image, STT, TTS via variables `AI_*` |
| OpenAI Moderation | Moderation gratuite uniquement, si configuree |

## Variables IA

```env
AI_API_KEY=
AI_BASE_URL=
AI_INFERENCE_BASE_URL=
AI_MODEL_AGENT=
AI_MODEL_FAST=
AI_MODEL_SUGGESTION=
AI_MODEL_MATCH=
AI_MODEL_VISION=
AI_MODEL_IMAGE=
AI_MODEL_STT=
AI_MODEL_TTS=
AI_MODEL_EMBEDDING=
EMBEDDING_DIMENSION=1024
```

## Notes

- Les embeddings sont stockes dans PostgreSQL via pgvector.
- Aucun provider proprietaire n'est requis dans le chemin produit, hors moderation gratuite optionnelle.
- Les modeles applicatifs doivent rester configurables par env et provider-neutres.
