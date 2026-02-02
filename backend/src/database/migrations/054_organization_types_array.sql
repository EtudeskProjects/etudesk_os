-- Migration: Convert organizations.type from VARCHAR(50) to TEXT[] to support multiple types (max 3)

-- Step 1: Add new column
ALTER TABLE organizations ADD COLUMN types TEXT[];

-- Step 2: Migrate existing data (single type -> array with one element)
UPDATE organizations SET types = ARRAY[type] WHERE type IS NOT NULL;

-- Step 3: Drop old column and index
DROP INDEX IF EXISTS idx_organizations_type;
ALTER TABLE organizations DROP COLUMN type;

-- Step 4: Create GIN index for array queries
CREATE INDEX idx_organizations_types ON organizations USING GIN (types);
