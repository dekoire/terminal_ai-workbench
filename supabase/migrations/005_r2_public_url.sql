-- =============================================================================
-- Codera AI — Migration 005: Cloudflare R2 Public URL
-- Project: fpphqkuizptypeawclsx
-- Run in Supabase Dashboard → SQL Editor
-- =============================================================================

-- Add public URL field to user_settings
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS cloudflare_r2_public_url TEXT DEFAULT '';

-- Add public URL field to global_config
ALTER TABLE global_config
  ADD COLUMN IF NOT EXISTS cloudflare_r2_public_url TEXT DEFAULT '';
