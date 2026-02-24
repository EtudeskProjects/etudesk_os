-- Fix preferred_language default from 'fr' to 'en' on both tables
-- New users/talents should default to English; the mobile app syncs the actual device language on startup
ALTER TABLE users ALTER COLUMN preferred_language SET DEFAULT 'en';
ALTER TABLE talents ALTER COLUMN preferred_language SET DEFAULT 'en';
