-- Migration: 005_add_space_payment_collection_info
-- Adds payment_collection_info text column to spaces table
-- Describes how the hub collects payment on-site (e.g., "Espèces", "Mobile Money", etc.)

ALTER TABLE spaces
ADD COLUMN IF NOT EXISTS payment_collection_info TEXT;
