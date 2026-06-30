-- 023_community_activities_scheduling.sql
-- community-activity.service.ts and community-activities.routes.ts (create, update,
-- publishScheduledActivities cron, getDrafts, calendar feed) reference two columns
-- the table was never given: `scheduled_at` (deferred publication; NULL = immediate,
-- reset to NULL once published) and `is_draft` (unpublished drafts). Their absence
-- threw `column ca.scheduled_at does not exist` on the home/daily-objective cron and
-- broke scheduled posting + drafts. Add them to match the code contract.

ALTER TABLE community_activities ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
ALTER TABLE community_activities ADD COLUMN IF NOT EXISTS is_draft BOOLEAN NOT NULL DEFAULT FALSE;

-- Cron publishes due posts: WHERE scheduled_at IS NOT NULL AND scheduled_at <= NOW()
-- AND published_at IS NULL. Partial index keeps that scan cheap as activities grow.
CREATE INDEX IF NOT EXISTS idx_community_activities_scheduled
  ON community_activities (scheduled_at)
  WHERE scheduled_at IS NOT NULL AND published_at IS NULL;
