-- Migration 032: normalize paid AI/user requests to 1 credit and add missing
-- autonomous LLM request billing actions.

INSERT INTO credit_action_catalog (action_code, scope, label, credits, is_active) VALUES
    ('TALENT_PROFILE_BIO_SUGGESTION', 'TALENT', 'Suggestion de bio / profil', 1, TRUE),
    ('TALENT_KYC_VERIFICATION', 'TALENT', 'Vérification KYC assistée par IA', 1, TRUE),
    ('ORG_FORM_SUGGESTION', 'ORGANIZATION', 'Suggestion de formulaire par IA', 1, TRUE),
    ('ORG_APPLICATION_RECOMMENDATION', 'ORGANIZATION', 'Recommandation de candidature par IA', 1, TRUE)
ON CONFLICT (action_code) DO UPDATE SET
    scope = EXCLUDED.scope,
    label = EXCLUDED.label,
    credits = EXCLUDED.credits,
    is_active = EXCLUDED.is_active;

UPDATE credit_action_catalog
SET credits = 1
WHERE credits > 0;

UPDATE credit_action_catalog
SET credits = 1
WHERE action_code IN ('TALENT_VOICE_INSTRUCTION', 'ORG_VOICE_INSTRUCTION');
