-- =============================================================================
-- Codera AI — Migration 003: Project Brain
-- Ein kompakter, KI-gepflegter Projektkontex pro Projekt.
-- Wird als System-Prompt in Orbit-Chats injiziert (~500 Token statt 50k+).
-- =============================================================================

CREATE TABLE IF NOT EXISTS project_brain (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id      TEXT        NOT NULL,          -- lokale String-ID, z.B. 'p1' oder UUID
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  summary         TEXT        DEFAULT '',         -- 2 Sätze: was macht das Projekt
  architecture    TEXT        DEFAULT '',         -- Schlüsselkomponenten, 1–2 Sätze
  recent_work     JSONB       DEFAULT '[]',       -- [{date:"YYYY-MM-DD", item:"..."}] max 10
  open_tasks      JSONB       DEFAULT '[]',       -- string[]
  key_files       JSONB       DEFAULT '[]',       -- [{path:"...", purpose:"..."}]
  brain_tokens    INT         DEFAULT 0,          -- geschätzte Token-Zahl des gerenderten Brain
  last_updated_at TIMESTAMPTZ DEFAULT now(),
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, user_id)
);

ALTER TABLE project_brain ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_brain_own"
  ON project_brain FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_project_brain_user
  ON project_brain(user_id);

CREATE INDEX IF NOT EXISTS idx_project_brain_project
  ON project_brain(project_id, user_id);
