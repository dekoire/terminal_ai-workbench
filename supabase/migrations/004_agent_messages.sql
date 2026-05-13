-- Agent messages: stores individual user/assistant turns
CREATE TABLE IF NOT EXISTS agent_messages (
  id TEXT PRIMARY KEY,                          -- am-ab12-xy34 (tree-structured)
  session_id TEXT NOT NULL,                     -- ss-qkzets-ab12
  project_id TEXT NOT NULL,                     -- pr-qkzets (denormalized for fast project queries)
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  model TEXT,
  tokens INTEGER,
  ts BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agent_messages_project ON agent_messages(project_id, user_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_agent_messages_session ON agent_messages(session_id, ts DESC);
ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent_messages_own" ON agent_messages FOR ALL USING (auth.uid() = user_id);

-- Context summaries: compressed history per project for new session injection
CREATE TABLE IF NOT EXISTS agent_context_summaries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  source_count INTEGER DEFAULT 0,
  last_ts BIGINT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agent_ctx_project ON agent_context_summaries(project_id, user_id, created_at DESC);
ALTER TABLE agent_context_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent_ctx_own" ON agent_context_summaries FOR ALL USING (auth.uid() = user_id);
