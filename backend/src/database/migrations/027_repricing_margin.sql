-- Migration 027: Reprice copilot actions to guarantee >=50% margin on tokens sold.
-- The copilot (Sonnet 4.6) is the dominant COGS. At 1 credit (=100 FCFA ~ $0.165)
-- a typical Explorer query cost ~$0.09-0.18 -> margin was ~0% to negative. Study at
-- 0.25 credit was structurally loss-making. New floor = ~2x measured cost.
--   Explorer / Org query : 1   -> 2 credits
--   Study query          : 0.25 -> 1 credit
-- Image generation (1 credit) is kept but quality is capped at 'medium' in code.

UPDATE credit_action_catalog SET credits = 2 WHERE action_code = 'TALENT_ASSISTANT_EXPLORER_QUERY';
UPDATE credit_action_catalog SET credits = 2 WHERE action_code = 'ORG_ASSISTANT_MANAGER_QUERY';
UPDATE credit_action_catalog SET credits = 1 WHERE action_code = 'TALENT_ASSISTANT_STUDY_QUERY';
