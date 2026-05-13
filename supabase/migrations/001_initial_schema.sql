-- =============================================================================
-- Codera AI — Initial Schema
-- Project: fpphqkuizptypeawclsx
-- =============================================================================
-- Run this in Supabase Dashboard → SQL Editor → New Query

-- Enable UUID extension (already enabled by default on Supabase)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 1. ADMIN
-- =============================================================================

CREATE TABLE IF NOT EXISTS admin_users (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  granted_by UUID REFERENCES auth.users(id)
);

-- =============================================================================
-- 2. USER SETTINGS  (1 row per user — all persisted preferences)
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Appearance
  theme               TEXT    DEFAULT 'dark',
  accent              TEXT    DEFAULT '#f97316',
  accent_fg           TEXT    DEFAULT '#ffffff',
  preset              TEXT    DEFAULT 'default',
  terminal_theme      TEXT    DEFAULT 'default',
  terminal_font_family TEXT   DEFAULT 'monospace',
  terminal_font_size  INT     DEFAULT 14,
  ui_font             TEXT    DEFAULT '',
  ui_font_size        INT     DEFAULT 13,
  logo_size           INT     DEFAULT 32,
  show_title_bar      BOOLEAN DEFAULT true,
  custom_terminal_colors JSONB DEFAULT '{}',
  custom_ui_colors    JSONB   DEFAULT '{}',

  -- Orbit / AI Chat
  orbit_ctx_before       INT     DEFAULT 2,
  orbit_ctx_after        INT     DEFAULT 2,
  orbit_compress_prompt  TEXT    DEFAULT 'Du bist ein Kontext-Kompressor für Entwickler-Chats. Fasse den folgenden Chat-Verlauf in präzisen Stichpunkten zusammen. Regeln: Nur entwicklungsrelevante Infos. Bullet-Points (•). Max 25 Punkte.',
  orbit_compress_model   TEXT    DEFAULT 'deepseek/deepseek-chat-v3-0324',

  -- Crew / Agent settings
  crew_verbose            BOOLEAN DEFAULT false,
  crew_telemetry_off      BOOLEAN DEFAULT true,
  crew_quiet_logs         BOOLEAN DEFAULT true,
  crew_wrapper_script     TEXT    DEFAULT '',
  crew_run_title_model    TEXT    DEFAULT 'deepseek/deepseek-chat',
  default_manager_model   TEXT    DEFAULT 'anthropic/claude-sonnet-4-6',

  -- API Keys (stored here; use Vault in production for secrets)
  openrouter_key          TEXT    DEFAULT '',

  -- Integrations
  supabase_url                  TEXT DEFAULT '',
  supabase_anon_key             TEXT DEFAULT '',
  supabase_service_role_key     TEXT DEFAULT '',
  cloudflare_account_id         TEXT DEFAULT '',
  cloudflare_r2_access_key_id   TEXT DEFAULT '',
  cloudflare_r2_secret_access_key TEXT DEFAULT '',
  cloudflare_r2_bucket_name     TEXT DEFAULT '',
  cloudflare_r2_endpoint        TEXT DEFAULT '',

  -- Meta
  last_active_project_id TEXT DEFAULT '',
  last_active_session_id TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 3. PROMPT TEMPLATES  (the "quick-fire" templates injected into messages)
-- =============================================================================

CREATE TABLE IF NOT EXISTS prompt_templates (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID    REFERENCES auth.users(id) ON DELETE CASCADE,
  -- NULL user_id = system default (seeded, visible to all new users)
  name       TEXT    NOT NULL,
  hint       TEXT    DEFAULT '',
  body       TEXT    NOT NULL,
  tag        TEXT    DEFAULT 'general',
  uses       INT     DEFAULT 0,
  favorite   BOOLEAN DEFAULT false,
  is_default BOOLEAN DEFAULT false,   -- true = copied to every new user on signup
  sort_order INT     DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 4. DOC TEMPLATES  (CLAUDE.md, RULES.md, AI-prompts, User Stories)
-- =============================================================================

CREATE TABLE IF NOT EXISTS doc_templates (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID    REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT    NOT NULL,
  relative_path TEXT    DEFAULT '',
  content       TEXT    NOT NULL DEFAULT '',
  enabled       BOOLEAN DEFAULT true,
  category      TEXT    DEFAULT 'doc',   -- 'doc' | 'ai-prompt' | 'user-story'
  is_default    BOOLEAN DEFAULT false,
  sort_order    INT     DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 5. ALIASES  (agent shortcuts like "claude", "cc-ds4pro", etc.)
-- =============================================================================

CREATE TABLE IF NOT EXISTS aliases (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT    NOT NULL,
  cmd        TEXT    NOT NULL DEFAULT 'claude',
  args       TEXT    DEFAULT '',
  perm_mode  TEXT    DEFAULT 'normal',   -- 'normal' | 'dangerous'
  status     TEXT    DEFAULT 'ok',
  sort_order INT     DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 6. AGENT ROLES  (Crew AI team members)
-- =============================================================================

CREATE TABLE IF NOT EXISTS agent_roles (
  id            UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID     REFERENCES auth.users(id) ON DELETE CASCADE,
  role_key      TEXT,    -- canonical id like 'ar-coder' (used for default matching)
  name          TEXT     NOT NULL,
  model         TEXT     NOT NULL,
  strengths     TEXT[]   DEFAULT '{}',
  system_prompt TEXT     DEFAULT '',
  tools         TEXT[]   DEFAULT '{}',
  is_default    BOOLEAN  DEFAULT false,
  sort_order    INT      DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 7. CLAUDE PROVIDERS  (custom LLM provider configs)
-- =============================================================================

CREATE TABLE IF NOT EXISTS claude_providers (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT    NOT NULL,
  base_url        TEXT    NOT NULL,
  auth_token      TEXT    NOT NULL DEFAULT '',
  model_name      TEXT    NOT NULL,
  or_model_id     TEXT    DEFAULT '',
  endpoint_ok     BOOLEAN,
  settings_json   TEXT    DEFAULT '',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 8. AI PROVIDERS  (OpenAI / Anthropic / DeepSeek keys — legacy)
-- =============================================================================

CREATE TABLE IF NOT EXISTS ai_providers (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT    NOT NULL,
  provider   TEXT    NOT NULL,   -- 'openai' | 'anthropic' | 'deepseek'
  api_key    TEXT    NOT NULL DEFAULT '',
  model      TEXT    NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 9. REPO TOKENS  (GitHub / GitLab personal access tokens)
-- =============================================================================

CREATE TABLE IF NOT EXISTS repo_tokens (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label      TEXT    NOT NULL,
  host       TEXT    NOT NULL DEFAULT 'github.com',
  token      TEXT    NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 10. TERMINAL SHORTCUTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS terminal_shortcuts (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID    REFERENCES auth.users(id) ON DELETE CASCADE,
  shortcut_key TEXT    NOT NULL,
  ctrl         BOOLEAN DEFAULT false,
  shift_key    BOOLEAN DEFAULT false,
  label        TEXT    NOT NULL,
  description  TEXT    DEFAULT '',
  signal       TEXT    NOT NULL,
  enabled      BOOLEAN DEFAULT true,
  category     TEXT    DEFAULT 'control',   -- 'control' | 'navigation' | 'editing'
  is_default   BOOLEAN DEFAULT false,
  sort_order   INT     DEFAULT 0
);

-- =============================================================================
-- 11. PROJECTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS projects (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT    NOT NULL,
  path          TEXT    NOT NULL,
  branch        TEXT    DEFAULT 'main',
  app_port      INT,
  app_start_cmd TEXT    DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 12. SESSIONS  (terminal / orbit / agent sessions within a project)
-- =============================================================================

CREATE TABLE IF NOT EXISTS sessions (
  id                    UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            UUID    NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name                  TEXT    NOT NULL,
  alias                 TEXT    DEFAULT '',
  cmd                   TEXT    DEFAULT '',
  args                  TEXT    DEFAULT '',
  status                TEXT    DEFAULT 'idle',   -- 'active'|'idle'|'error'|'exited'
  perm_mode             TEXT    DEFAULT 'normal',
  kind                  TEXT    DEFAULT 'single', -- 'single'|'crew'|'claude'|'orbit'|'openrouter-claude'
  crew_config           JSONB,
  or_model              TEXT    DEFAULT '',
  provider_settings_json TEXT   DEFAULT '',
  started_at            TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 13. SESSION NOTES
-- =============================================================================

CREATE TABLE IF NOT EXISTS session_notes (
  session_id TEXT    PRIMARY KEY,   -- matches local session id
  project_id UUID    REFERENCES projects(id) ON DELETE CASCADE,
  user_id    UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content    TEXT    DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 14. KANBAN TICKETS  (User Stories & Bugs)
-- =============================================================================

CREATE TABLE IF NOT EXISTS kanban_tickets (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID    NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  ticket_number INT     NOT NULL,
  title         TEXT    NOT NULL,
  body          TEXT    DEFAULT '',
  status        TEXT    DEFAULT 'backlog',   -- 'backlog'|'testing'|'done'
  priority      TEXT    DEFAULT 'medium',    -- 'low'|'medium'|'high'|'critical'
  type          TEXT    DEFAULT 'story',     -- 'story'|'nfc'|'bug'
  images        TEXT[]  DEFAULT '{}',        -- base64 data URLs or R2 object keys
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, ticket_number)
);

-- =============================================================================
-- 15. ORBIT CHATS  (AI conversation threads, per project)
-- =============================================================================

CREATE TABLE IF NOT EXISTS orbit_chats (
  id         TEXT    PRIMARY KEY,   -- keeps existing 'oc-xxxx-yyyyyy' format
  project_id UUID    NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id    UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      TEXT,
  pinned     BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 16. ORBIT MESSAGES
-- =============================================================================

CREATE TABLE IF NOT EXISTS orbit_messages (
  id         TEXT    PRIMARY KEY,   -- keeps existing 'om-xxxx-yyyy' format
  chat_id    TEXT    NOT NULL REFERENCES orbit_chats(id) ON DELETE CASCADE,
  role       TEXT    NOT NULL,      -- 'user' | 'assistant'
  content    TEXT    NOT NULL DEFAULT '',
  model      TEXT,
  tokens     INT,
  images     TEXT[]  DEFAULT '{}',
  ts         BIGINT  NOT NULL,      -- unix ms timestamp (preserves existing format)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 17. ORBIT FAVORITES
-- =============================================================================

CREATE TABLE IF NOT EXISTS orbit_favorites (
  id              TEXT    PRIMARY KEY,
  user_id         UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind            TEXT    NOT NULL,   -- 'chat' | 'message'
  project_id      UUID    REFERENCES projects(id) ON DELETE CASCADE,
  chat_id         TEXT    REFERENCES orbit_chats(id) ON DELETE CASCADE,
  chat_title      TEXT,
  message_id      TEXT,
  message_content TEXT,
  message_role    TEXT,
  message_model   TEXT,
  msg_ts          BIGINT,
  ts              BIGINT  NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_prompt_templates_user     ON prompt_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_default  ON prompt_templates(is_default) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_doc_templates_user        ON doc_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_doc_templates_default     ON doc_templates(is_default) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_aliases_user              ON aliases(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_roles_user          ON agent_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_user             ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_project          ON sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_kanban_project            ON kanban_tickets(project_id);
CREATE INDEX IF NOT EXISTS idx_orbit_chats_project       ON orbit_chats(project_id);
CREATE INDEX IF NOT EXISTS idx_orbit_chats_user          ON orbit_chats(user_id);
CREATE INDEX IF NOT EXISTS idx_orbit_messages_chat       ON orbit_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_orbit_favorites_user      ON orbit_favorites(user_id);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE admin_users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_templates     ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc_templates        ENABLE ROW LEVEL SECURITY;
ALTER TABLE aliases              ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_roles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE claude_providers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_providers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE repo_tokens          ENABLE ROW LEVEL SECURITY;
ALTER TABLE terminal_shortcuts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects             ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_notes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE kanban_tickets       ENABLE ROW LEVEL SECURITY;
ALTER TABLE orbit_chats          ENABLE ROW LEVEL SECURITY;
ALTER TABLE orbit_messages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE orbit_favorites      ENABLE ROW LEVEL SECURITY;

-- user_settings: own row only
CREATE POLICY "user_settings_own" ON user_settings
  FOR ALL USING (auth.uid() = user_id);

-- prompt_templates: own rows + system defaults (user_id IS NULL)
CREATE POLICY "prompt_templates_read" ON prompt_templates
  FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "prompt_templates_write" ON prompt_templates
  FOR ALL USING (user_id = auth.uid());

-- doc_templates: own rows + system defaults
CREATE POLICY "doc_templates_read" ON doc_templates
  FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "doc_templates_write" ON doc_templates
  FOR ALL USING (user_id = auth.uid());

-- agent_roles: own rows + system defaults
CREATE POLICY "agent_roles_read" ON agent_roles
  FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "agent_roles_write" ON agent_roles
  FOR ALL USING (user_id = auth.uid());

-- terminal_shortcuts: own rows + system defaults
CREATE POLICY "terminal_shortcuts_read" ON terminal_shortcuts
  FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "terminal_shortcuts_write" ON terminal_shortcuts
  FOR ALL USING (user_id = auth.uid());

-- simple own-only policies
CREATE POLICY "aliases_own"          ON aliases          FOR ALL USING (user_id = auth.uid());
CREATE POLICY "claude_providers_own" ON claude_providers FOR ALL USING (user_id = auth.uid());
CREATE POLICY "ai_providers_own"     ON ai_providers     FOR ALL USING (user_id = auth.uid());
CREATE POLICY "repo_tokens_own"      ON repo_tokens      FOR ALL USING (user_id = auth.uid());
CREATE POLICY "projects_own"         ON projects         FOR ALL USING (user_id = auth.uid());
CREATE POLICY "session_notes_own"    ON session_notes    FOR ALL USING (user_id = auth.uid());
CREATE POLICY "orbit_chats_own"      ON orbit_chats      FOR ALL USING (user_id = auth.uid());
CREATE POLICY "orbit_favorites_own"  ON orbit_favorites  FOR ALL USING (user_id = auth.uid());

-- sessions: via project ownership
CREATE POLICY "sessions_via_project" ON sessions
  FOR ALL USING (
    project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
  );

-- kanban_tickets: via project ownership
CREATE POLICY "kanban_via_project" ON kanban_tickets
  FOR ALL USING (
    project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
  );

-- orbit_messages: via chat → project → user
CREATE POLICY "orbit_messages_via_chat" ON orbit_messages
  FOR ALL USING (
    chat_id IN (SELECT id FROM orbit_chats WHERE user_id = auth.uid())
  );

-- admin_users: only admins can read; only service role can write
CREATE POLICY "admin_read" ON admin_users
  FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM admin_users)
  );

-- =============================================================================
-- UPDATED_AT TRIGGER
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

CREATE TRIGGER trg_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_kanban_updated_at
  BEFORE UPDATE ON kanban_tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_orbit_chats_updated_at
  BEFORE UPDATE ON orbit_chats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- NEW USER BOOTSTRAP TRIGGER
-- Runs when a user signs up → creates settings + copies all default rows
-- =============================================================================

CREATE OR REPLACE FUNCTION bootstrap_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- 1. Create default settings row
  INSERT INTO user_settings (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  -- 2. Copy default prompt templates
  INSERT INTO prompt_templates (user_id, name, hint, body, tag, uses, favorite, is_default, sort_order)
  SELECT NEW.id, name, hint, body, tag, 0, false, false, sort_order
  FROM prompt_templates
  WHERE user_id IS NULL AND is_default = true;

  -- 3. Copy default doc templates
  INSERT INTO doc_templates (user_id, name, relative_path, content, enabled, category, is_default, sort_order)
  SELECT NEW.id, name, relative_path, content, enabled, category, false, sort_order
  FROM doc_templates
  WHERE user_id IS NULL AND is_default = true;

  -- 4. Copy default agent roles
  INSERT INTO agent_roles (user_id, role_key, name, model, strengths, system_prompt, tools, is_default, sort_order)
  SELECT NEW.id, role_key, name, model, strengths, system_prompt, tools, false, sort_order
  FROM agent_roles
  WHERE user_id IS NULL AND is_default = true;

  -- 5. Copy default terminal shortcuts
  INSERT INTO terminal_shortcuts (user_id, shortcut_key, ctrl, shift_key, label, description, signal, enabled, category, is_default, sort_order)
  SELECT NEW.id, shortcut_key, ctrl, shift_key, label, description, signal, enabled, category, false, sort_order
  FROM terminal_shortcuts
  WHERE user_id IS NULL AND is_default = true;

  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION bootstrap_new_user();

-- =============================================================================
-- HELPER: is_admin() — use in RLS policies or app code
-- =============================================================================

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid());
$$;
