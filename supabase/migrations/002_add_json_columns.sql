-- =============================================================================
-- Codera AI — Migration 002: JSON columns + schema fixes
-- Project: fpphqkuizptypeawclsx
-- Run in Supabase Dashboard → SQL Editor
-- =============================================================================

-- ─── Fix orbit_chats: project_id is a local string ID, not a UUID FK ─────────
-- Drop the UUID FK constraint so we can store local IDs like 'p1', 'p2'
ALTER TABLE orbit_chats DROP CONSTRAINT IF EXISTS orbit_chats_project_id_fkey;
ALTER TABLE orbit_chats ALTER COLUMN project_id TYPE TEXT USING project_id::TEXT;
ALTER TABLE orbit_chats ALTER COLUMN project_id DROP NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────

-- Add JSONB columns to user_settings for data that is too complex to normalize
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS projects_json         JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS aliases_json          JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS templates_json        JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS doc_templates_json    JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS agent_roles_json      JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS claude_providers_json JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS ai_providers_json     JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS repo_tokens_json      JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS terminal_shortcuts_json JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS kanban_json           JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS notes_json            JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ai_function_map_json  JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS orbit_chats_json      JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS active_orbit_chat_json JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS orbit_favorites_json  JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS active_ai_provider    TEXT  DEFAULT '',
  ADD COLUMN IF NOT EXISTS active_project_id     TEXT  DEFAULT '',
  ADD COLUMN IF NOT EXISTS last_project_path     TEXT  DEFAULT '',
  ADD COLUMN IF NOT EXISTS danger_mode           BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS playwright_check      BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS localhost_check       BOOLEAN DEFAULT false;
