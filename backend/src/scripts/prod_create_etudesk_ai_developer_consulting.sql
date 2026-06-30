\pset pager off

BEGIN;

WITH etudesk AS (
    SELECT id
    FROM organizations
    WHERE slug = 'etudesk-sas'
      AND deleted_at IS NULL
    LIMIT 1
),
upsert_opp AS (
    INSERT INTO opportunities (
        title,
        slug,
        type,
        contract_type,
        work_rhythm,
        summary,
        requirements,
        nice_to_have,
        organization_id,
        sectors,
        cv_required,
        application_questions,
        cover_image_url,
        images,
        compensation_min,
        compensation_max,
        currency,
        compensation_frequency,
        location_type,
        locations,
        visibility,
        posted_at,
        deadline,
        start_date,
        status,
        application_mode,
        external_apply_email,
        external_apply_url,
        source_url,
        source_name,
        ideal_candidate_summary,
        created_at,
        updated_at
    )
    SELECT
        'AI developer consultant',
        'etudesk-ai-developer-consultant-2026',
        'MISSION',
        'CONSULTING',
        'FLEXIBLE',
        'Etudesk recherche un AI developer consultant pour accélérer le développement de fonctionnalités IA utiles aux talents et organisations: agents applicatifs, recherche augmentée, workflows de productivité, instrumentation et intégrations LLM.',
        'Mission: concevoir et livrer des modules IA en production pour Etudesk OS. Responsabilités: prototyper des agents et outils LLM, intégrer des APIs IA, améliorer la recherche et le matching, brancher les traces d''usage, écrire des tests, documenter les décisions techniques et travailler avec l''équipe produit sur des itérations courtes. Compétences attendues: TypeScript/Node.js, PostgreSQL, APIs LLM, prompt engineering, RAG ou embeddings, appels de fonctions/outils, sécurité des données, qualité logicielle et autonomie de livraison.',
        'Bonus: expérience mobile React Native/Expo, pgvector, évaluation de modèles, automatisation de workflows, design produit, expérience EdTech/TalentTech ou contexte Afrique francophone.',
        etudesk.id,
        ARRAY['DIGITAL', 'EDUCATION', 'PROFESSIONAL_SERVICES'],
        TRUE,
        '[
            {"id":"portfolio","label":"Lien vers portfolio, GitHub ou projets IA livrés","type":"TEXT","required":true},
            {"id":"availability","label":"Disponibilité hebdomadaire et date de démarrage possible","type":"TEXT","required":true},
            {"id":"approach","label":"Décris une fonctionnalité IA que tu construirais pour Etudesk en 2 semaines","type":"TEXTAREA","required":true},
            {"id":"rate","label":"TJM ou budget mensuel souhaité en XOF","type":"TEXT","required":false}
        ]'::jsonb,
        'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=1600&q=80',
        ARRAY['https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=1600&q=80'],
        NULL,
        NULL,
        'XOF',
        'PROJECT',
        'HYBRID',
        '[{"city":"Abidjan","region":"Abidjan","country":"CI"},{"city":"Remote","region":null,"country":"CI"}]'::jsonb,
        'PUBLIC',
        NOW(),
        (NOW() + INTERVAL '45 days'),
        CURRENT_DATE,
        'OPEN',
        'IN_APP',
        NULL,
        NULL,
        NULL,
        'Etudesk',
        'Profil autonome capable de transformer un besoin produit en fonctionnalité IA testée, observable et utilisable rapidement en production.',
        NOW(),
        NOW()
    FROM etudesk
    ON CONFLICT (slug) DO UPDATE SET
        title = EXCLUDED.title,
        type = EXCLUDED.type,
        contract_type = EXCLUDED.contract_type,
        work_rhythm = EXCLUDED.work_rhythm,
        summary = EXCLUDED.summary,
        requirements = EXCLUDED.requirements,
        nice_to_have = EXCLUDED.nice_to_have,
        organization_id = EXCLUDED.organization_id,
        sectors = EXCLUDED.sectors,
        cv_required = EXCLUDED.cv_required,
        application_questions = EXCLUDED.application_questions,
        cover_image_url = EXCLUDED.cover_image_url,
        images = EXCLUDED.images,
        compensation_min = EXCLUDED.compensation_min,
        compensation_max = EXCLUDED.compensation_max,
        currency = EXCLUDED.currency,
        compensation_frequency = EXCLUDED.compensation_frequency,
        location_type = EXCLUDED.location_type,
        locations = EXCLUDED.locations,
        visibility = EXCLUDED.visibility,
        posted_at = COALESCE(opportunities.posted_at, EXCLUDED.posted_at),
        deadline = EXCLUDED.deadline,
        start_date = EXCLUDED.start_date,
        status = EXCLUDED.status,
        application_mode = EXCLUDED.application_mode,
        external_apply_email = NULL,
        external_apply_url = NULL,
        source_url = NULL,
        source_name = EXCLUDED.source_name,
        ideal_candidate_summary = EXCLUDED.ideal_candidate_summary,
        deleted_at = NULL,
        updated_at = NOW()
    RETURNING id, organization_id
)
INSERT INTO opportunity_posters (
    opportunity_id,
    poster_organization_id,
    role,
    posted_at
)
SELECT
    id,
    organization_id,
    'POSTER',
    NOW()
FROM upsert_opp
ON CONFLICT (opportunity_id, poster_organization_id) DO UPDATE SET
    role = EXCLUDED.role,
    posted_at = COALESCE(opportunity_posters.posted_at, EXCLUDED.posted_at);

COMMIT;

SELECT org.name AS organization, o.title, o.slug, o.status, o.application_mode, o.external_apply_email, o.deadline
FROM opportunities o
JOIN organizations org ON org.id = o.organization_id
WHERE o.slug = 'etudesk-ai-developer-consultant-2026';
