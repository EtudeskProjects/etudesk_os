-- Canonical space features
--
-- Database identifiers are UPPER_SNAKE_CASE. This migration folds legacy
-- labels and aliases into the current equipment / services-and-amenities
-- taxonomy, and moves WIFI / POWER_OUTLETS out of equipment.

WITH source AS (
  SELECT
    id,
    COALESCE(equipment, ARRAY[]::text[]) || COALESCE(amenities, ARRAY[]::text[]) AS features
  FROM spaces
  WHERE deleted_at IS NULL
), normalized AS (
  SELECT
    source.id,
    CASE regexp_replace(upper(trim(feature)), '[[:space:]-]+', '_', 'g')
      WHEN 'PROJECTOR' THEN 'VIDEOPROJECTOR'
      WHEN 'VIDEO_PROJECTOR' THEN 'VIDEOPROJECTOR'
      WHEN 'DESK' THEN 'DESKS'
      WHEN 'WORK_DESK' THEN 'DESKS'
      WHEN 'COMPUTER' THEN 'COMPUTERS'
      WHEN 'PRINTER' THEN 'PRINTERS'
      WHEN 'SPEAKER' THEN 'SOUND_SYSTEM'
      WHEN 'RESTROOM' THEN 'RESTROOMS'
      WHEN 'TOILETS' THEN 'RESTROOMS'
      WHEN 'WI_FI' THEN 'WIFI'
      WHEN 'INTERNET' THEN 'WIFI'
      WHEN 'ELECTRICAL_OUTLETS' THEN 'POWER_OUTLETS'
      ELSE regexp_replace(upper(trim(feature)), '[[:space:]-]+', '_', 'g')
    END AS feature
  FROM source
  CROSS JOIN LATERAL unnest(source.features) AS feature
), grouped AS (
  SELECT
    id,
    ARRAY_AGG(DISTINCT feature ORDER BY feature) FILTER (
      WHERE feature IN (
        'VIDEOPROJECTOR', 'WHITEBOARD', 'FLIPCHART', 'SCREEN', 'SOUND_SYSTEM',
        'MICROPHONE', 'WEBCAM', 'TV_SCREEN', 'VIDEO_CONFERENCE', 'COMPUTERS',
        'PRINTERS', 'PHONE', 'DESKS'
      )
    ) AS equipment,
    ARRAY_AGG(DISTINCT feature ORDER BY feature) FILTER (
      WHERE feature IN (
        'WIFI', 'POWER_OUTLETS', 'AIR_CONDITIONING', 'HEATING', 'PARKING',
        'CAFETERIA', 'KITCHEN', 'RESTROOMS', 'RECEPTION', 'SECURITY', 'ELEVATOR',
        'NATURAL_LIGHT', 'SOUNDPROOF'
      )
    ) AS amenities
  FROM normalized
  GROUP BY id
)
UPDATE spaces s
SET
  equipment = COALESCE(grouped.equipment, ARRAY[]::text[]),
  amenities = COALESCE(grouped.amenities, ARRAY[]::text[]),
  updated_at = NOW()
FROM grouped
WHERE s.id = grouped.id;
