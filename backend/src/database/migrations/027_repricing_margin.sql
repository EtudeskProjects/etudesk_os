-- Migration 027: historical copilot repricing. The current production rule is
-- one credit per paid AI request; migration 032 enforces that globally.

UPDATE credit_action_catalog SET credits = 1 WHERE action_code = 'TALENT_ASSISTANT_EXPLORER_QUERY';
UPDATE credit_action_catalog SET credits = 1 WHERE action_code = 'ORG_ASSISTANT_MANAGER_QUERY';
UPDATE credit_action_catalog SET credits = 1 WHERE action_code = 'TALENT_ASSISTANT_STUDY_QUERY';
