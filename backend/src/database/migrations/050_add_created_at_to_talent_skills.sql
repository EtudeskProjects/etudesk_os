-- Add created_at timestamp to talent_skills
ALTER TABLE talent_skills ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
