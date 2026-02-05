-- Rating (1-5) and internal notes for community members (org admin only)
ALTER TABLE community_members
ADD COLUMN IF NOT EXISTS star_rating INTEGER CHECK (star_rating IS NULL OR (star_rating >= 1 AND star_rating <= 5));

ALTER TABLE community_members
ADD COLUMN IF NOT EXISTS internal_notes TEXT;
