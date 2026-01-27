BEGIN;

-- Clean up legacy hub artifacts (replaced by spaces)
DROP VIEW IF EXISTS active_hubs;

DROP TABLE IF EXISTS hub_skills CASCADE;
DROP TABLE IF EXISTS organization_hubs CASCADE;
DROP TABLE IF EXISTS hub_bookings CASCADE;
DROP TABLE IF EXISTS hubs CASCADE;

COMMIT;
