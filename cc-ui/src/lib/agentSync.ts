import type { SupabaseClient } from '@supabase/supabase-js'

export interface AgentMessage {
  id: string            // am-xxx-xxx
  session_id: string
  project_id: string
  user_id: string
  role: 'user' | 'assistant'
  content: string
  model?: string
  tokens?: number
  ts: number
}

export interface AgentContextSummary {
  id: string
  project_id: string
  user_id: string
  summary: string
  source_count: number
  last_ts: number | null
  created_at: string
  model?: string | null
  input_tokens?: number | null
  output_tokens?: number | null
}

/** Upsert a single message (fire-and-forget safe) */
export async function saveAgentMessage(sb: SupabaseClient, msg: AgentMessage): Promise<void> {
  await sb.from('agent_messages').upsert({
    id: msg.id,
    session_id: msg.session_id,
    project_id: msg.project_id,
    user_id: msg.user_id,
    role: msg.role,
    content: msg.content,
    model: msg.model ?? null,
    tokens: msg.tokens ?? null,
    ts: msg.ts,
  })
}

/** Load last N messages for a project (all sessions), ordered newest-first.
 *  Pass offset > 0 for pagination (load earlier messages). */
export async function loadLastProjectMessages(
  sb: SupabaseClient,
  userId: string,
  projectId: string,
  limit = 20,
  offset = 0,
): Promise<AgentMessage[]> {
  const { data } = await sb
    .from('agent_messages')
    .select('*')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .order('ts', { ascending: false })
    .range(offset, offset + limit - 1)
  return (data ?? []) as AgentMessage[]
}

/** Load a single agent message by its ID */
export async function loadAgentMessageById(
  sb: SupabaseClient,
  userId: string,
  id: string,
): Promise<AgentMessage | null> {
  const { data } = await sb
    .from('agent_messages')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()
  return data as AgentMessage | null
}

/** Save a compressed context summary for a project */
export async function saveContextSummary(
  sb: SupabaseClient,
  userId: string,
  projectId: string,
  summary: string,
  sourceCount: number,
  lastTs: number,
  model?: string,
  inputTokens?: number,
  outputTokens?: number,
): Promise<void> {
  await sb.from('agent_context_summaries').insert({
    project_id: projectId,
    user_id: userId,
    summary,
    source_count: sourceCount,
    last_ts: lastTs,
    model: model ?? null,
    input_tokens: inputTokens ?? 0,
    output_tokens: outputTokens ?? 0,
  })
}

/** Load all context summaries for a project, newest first */
export async function loadAllContextSummaries(
  sb: SupabaseClient,
  userId: string,
  projectId: string,
  limit = 20,
): Promise<AgentContextSummary[]> {
  const { data } = await sb
    .from('agent_context_summaries')
    .select('*')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data ?? []) as AgentContextSummary[]
}

/** Load the most recent context summary for a project */
export async function loadLatestContextSummary(
  sb: SupabaseClient,
  userId: string,
  projectId: string,
): Promise<AgentContextSummary | null> {
  const { data } = await sb
    .from('agent_context_summaries')
    .select('*')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
  return (data?.[0] ?? null) as AgentContextSummary | null
}

/** Load messages newer than sinceTs for a project (for tail injection).
 *  Returns in chronological order (oldest first). */
export async function loadMessagesSince(
  sb: SupabaseClient,
  userId: string,
  projectId: string,
  sinceTs: number,
  limit = 3,
): Promise<AgentMessage[]> {
  const { data } = await sb
    .from('agent_messages')
    .select('*')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .gt('ts', sinceTs)
    .order('ts', { ascending: false })
    .limit(limit)
  return ((data ?? []) as AgentMessage[]).reverse()
}

/**
 * Compress messages via OpenRouter (default) or Anthropic.
 * Routes through the server-side /api/ai-refine proxy to avoid CORS issues.
 */
export interface CompressResult {
  summary: string
  inputTokens: number
  outputTokens: number
}

export async function compressAgentHistory(
  messages: AgentMessage[],
  systemPrompt: string,
  apiKey: string,
  model = 'deepseek/deepseek-v4-flash:free',
  provider: 'openrouter' | 'anthropic' = 'openrouter',
): Promise<CompressResult> {
  const history = messages
    .slice()
    .sort((a, b) => a.ts - b.ts)
    .map(m => `[${m.role === 'user' ? 'User' : 'Claude'}]: ${m.content}`)
    .join('\n\n')

  const res = await fetch('/api/ai-refine', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider,
      apiKey,
      model,
      systemPrompt,
      text: `Fasse diese Coding-Session zusammen:\n\n${history}`,
    }),
  })
  const data = await res.json() as { ok: boolean; text?: string; inputTokens?: number; outputTokens?: number }
  return {
    summary: data.text ?? '',
    inputTokens: data.inputTokens ?? 0,
    outputTokens: data.outputTokens ?? 0,
  }
}
