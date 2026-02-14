-- 022: Update credit prices to match 2026 economic model adjustments
-- Date: 2026-02-13
--
-- Changes:
-- - TALENT_DAILY_OBJECTIVE: 1 -> 0.25
-- - TALENT_SCHEDULED_TASK:  1 -> 0.25
-- - ORG_DAILY_OBJECTIVE:    1 -> 0.25
-- - ORG_SCHEDULED_TASK:     1 -> 0.25

UPDATE credit_action_catalog
SET credits = 0.25
WHERE action_code IN (
  'TALENT_DAILY_OBJECTIVE',
  'TALENT_SCHEDULED_TASK',
  'ORG_DAILY_OBJECTIVE',
  'ORG_SCHEDULED_TASK'
);

