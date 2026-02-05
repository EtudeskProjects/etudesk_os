-- Add is_visible column to talents and organizations tables

ALTER TABLE talents 
ADD COLUMN IF NOT EXISTS is_visible BOOLEAN DEFAULT TRUE;

ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS is_visible BOOLEAN DEFAULT TRUE;

-- Update existing records to match default
UPDATE talents SET is_visible = TRUE WHERE is_visible IS NULL;
UPDATE organizations SET is_visible = TRUE WHERE is_visible IS NULL;
