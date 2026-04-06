-- Reduce Study query cost from 0.50 to 0.25 credits
UPDATE credit_action_catalog
SET credits = 0.25
WHERE action_code = 'TALENT_ASSISTANT_STUDY_QUERY';
