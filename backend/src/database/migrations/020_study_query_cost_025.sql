-- Normalize Study query cost to 1 credit.
UPDATE credit_action_catalog
SET credits = 1
WHERE action_code = 'TALENT_ASSISTANT_STUDY_QUERY';
