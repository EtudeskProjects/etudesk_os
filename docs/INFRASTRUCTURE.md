# Infrastructure Etudesk OS

> Architecture cible : PostgreSQL + pgvector, OpenAI pour l'agent copilot principal, provider IA generique compatible OpenAI possible pour les autres modeles via variables `AI_*`.

## Services actifs

| Service | Usage |
|---------|-------|
| LWS / VPS | Backend Node.js + PostgreSQL |
| PostgreSQL + pgvector | Base relationnelle et recherche vectorielle locale |
| Resend / SMTP | OTP email et emails transactionnels |
| Paystack | Paiements FCFA |
| Expo Push | Notifications mobiles |
| OpenAI API | Agent copilot principal et moderation si configuree |
| Provider IA generique | Vision, embeddings, image, STT, TTS ou LLM alternatifs via variables `AI_*` |

## Variables IA

```env
AI_API_KEY=
OPENAI_API_KEY=
AI_BASE_URL=
AI_INFERENCE_BASE_URL=
AI_MODEL_AGENT=gpt-5.4-mini
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
- Pour utiliser OpenAI directement, renseigner `AI_API_KEY` ou `OPENAI_API_KEY` et laisser `AI_BASE_URL` vide.
- Les modeles applicatifs doivent rester configurables par env et provider-neutres.
