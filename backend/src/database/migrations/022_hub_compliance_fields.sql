-- Migration: Ajout des champs de conformité et caractéristiques physiques aux hubs
-- Date: 2026-01-25
-- Description: Ajoute les champs pour la gestion des espaces de formation/travail
--              conformes aux réglementations (capacité, accessibilité, sécurité)

-- ═══════════════════════════════════════════════════════════════
-- AJOUT DES NOUVELLES COLONNES À LA TABLE HUBS
-- ═══════════════════════════════════════════════════════════════

-- Caractéristiques physiques
ALTER TABLE hubs
  ADD COLUMN IF NOT EXISTS usage_category VARCHAR(20),
  ADD COLUMN IF NOT EXISTS surface_m2 DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS max_capacity INTEGER,
  ADD COLUMN IF NOT EXISTS floors_count SMALLINT DEFAULT 1;

-- Accessibilité PMR
ALTER TABLE hubs
  ADD COLUMN IF NOT EXISTS is_accessible BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS accessibility_features TEXT[],
  ADD COLUMN IF NOT EXISTS accessibility_info_url TEXT;

-- Sécurité
ALTER TABLE hubs
  ADD COLUMN IF NOT EXISTS safety_equipment TEXT[],
  ADD COLUMN IF NOT EXISTS last_inspection_date DATE,
  ADD COLUMN IF NOT EXISTS safety_certificate_url TEXT;

-- Espaces internes (JSONB pour flexibilité)
ALTER TABLE hubs
  ADD COLUMN IF NOT EXISTS spaces JSONB DEFAULT '[]'::jsonb;

-- ═══════════════════════════════════════════════════════════════
-- INDEX POUR LES NOUVEAUX CHAMPS
-- ═══════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_hubs_usage_category ON hubs(usage_category);
CREATE INDEX IF NOT EXISTS idx_hubs_is_accessible ON hubs(is_accessible);
CREATE INDEX IF NOT EXISTS idx_hubs_max_capacity ON hubs(max_capacity);

-- Index GIN pour les tableaux
CREATE INDEX IF NOT EXISTS idx_hubs_accessibility_features ON hubs USING GIN(accessibility_features);
CREATE INDEX IF NOT EXISTS idx_hubs_safety_equipment ON hubs USING GIN(safety_equipment);

-- Index GIN pour JSONB spaces
CREATE INDEX IF NOT EXISTS idx_hubs_spaces ON hubs USING GIN(spaces);

-- ═══════════════════════════════════════════════════════════════
-- CONTRAINTES DE VALIDATION
-- ═══════════════════════════════════════════════════════════════

-- Contrainte sur usage_category
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_hubs_usage_category'
  ) THEN
    ALTER TABLE hubs
      ADD CONSTRAINT chk_hubs_usage_category
        CHECK (usage_category IS NULL OR usage_category IN ('FORMATION', 'TRAVAIL', 'REUNION', 'ATELIER', 'MIXTE'));
  END IF;
END$$;

-- Contrainte sur max_capacity (doit être positif)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_hubs_max_capacity_positive'
  ) THEN
    ALTER TABLE hubs
      ADD CONSTRAINT chk_hubs_max_capacity_positive
        CHECK (max_capacity IS NULL OR max_capacity > 0);
  END IF;
END$$;

-- Contrainte sur surface_m2 (doit être positive)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_hubs_surface_positive'
  ) THEN
    ALTER TABLE hubs
      ADD CONSTRAINT chk_hubs_surface_positive
        CHECK (surface_m2 IS NULL OR surface_m2 > 0);
  END IF;
END$$;

-- ═══════════════════════════════════════════════════════════════
-- MIGRATION DES DONNÉES EXISTANTES
-- ═══════════════════════════════════════════════════════════════

-- Définir usage_category basé sur le type existant
UPDATE hubs
SET usage_category = CASE
  WHEN type IN ('COWORKING', 'INCUBATOR', 'ACCELERATOR') THEN 'TRAVAIL'
  WHEN type IN ('CERTIFICATION_CENTER', 'TRAINING_CENTER', 'UNIVERSITY') THEN 'FORMATION'
  WHEN type IN ('LAB', 'MAKERSPACE') THEN 'ATELIER'
  WHEN type = 'VIRTUAL_COMMUNITY' THEN NULL
  ELSE 'MIXTE'
END
WHERE usage_category IS NULL AND type IS NOT NULL;

-- Définir is_accessible par défaut à false pour les hubs existants
UPDATE hubs
SET is_accessible = false
WHERE is_accessible IS NULL;

-- ═══════════════════════════════════════════════════════════════
-- COMMENTAIRES SUR LES COLONNES
-- ═══════════════════════════════════════════════════════════════

COMMENT ON COLUMN hubs.usage_category IS 'Catégorie d''usage principal: FORMATION, TRAVAIL, REUNION, ATELIER, MIXTE';
COMMENT ON COLUMN hubs.surface_m2 IS 'Surface totale en mètres carrés';
COMMENT ON COLUMN hubs.max_capacity IS 'Capacité maximale autorisée en personnes';
COMMENT ON COLUMN hubs.floors_count IS 'Nombre d''étages (1 = RDC uniquement)';
COMMENT ON COLUMN hubs.is_accessible IS 'Accessibilité aux personnes à mobilité réduite';
COMMENT ON COLUMN hubs.accessibility_features IS 'Liste des équipements d''accessibilité: RAMPE_ACCES, ASCENSEUR, WC_ACCESSIBLE, etc.';
COMMENT ON COLUMN hubs.accessibility_info_url IS 'URL vers les informations d''accessibilité détaillées';
COMMENT ON COLUMN hubs.safety_equipment IS 'Liste des équipements de sécurité: EXTINCTEUR, DETECTEUR_FUMEE, ALARME_INCENDIE, etc.';
COMMENT ON COLUMN hubs.last_inspection_date IS 'Date de la dernière inspection de sécurité';
COMMENT ON COLUMN hubs.safety_certificate_url IS 'URL vers le certificat de conformité sécurité';
COMMENT ON COLUMN hubs.spaces IS 'Espaces internes du hub (salles, bureaux, etc.) au format JSON';
