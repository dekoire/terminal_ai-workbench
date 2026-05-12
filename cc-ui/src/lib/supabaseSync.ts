/**
 * supabaseSync.ts — Codera AI cloud sync
 *
 * Syncs the Zustand store to/from Supabase.
 *
 * Save:  saveSettingsToSupabase()  — debounced, called on every store change
 *        saveOrbitMessagesToSupabase() — called when orbit messages change
 *
 * Load:  loadFromSupabase() — called once after login
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  AppState,
  Project,
  Session,
  Alias,
  Template,
  DocTemplate,
  ClaudeProvider,
  AIProvider,
  RepoToken,
  TerminalShortcut,
  OrbitMessage,
  OrbitChatMeta,
  OrbitFavorite,
  KanbanTicket,
  ProjectBrainEntry,
} from '../store/useAppStore'

// ─── helpers ──────────────────────────────────────────────────────────────────

function safe<T>(v: T): T { return v ?? (null as unknown as T) }

// ─── Save settings ────────────────────────────────────────────────────────────

export interface SettingsPayload {
  // Appearance
  theme: string
  accent: string
  accent_fg: string
  preset: string
  terminal_theme: string
  terminal_font_family: string
  terminal_font_size: number
  ui_font: string
  ui_font_size: number
  logo_size: number
  show_title_bar: boolean
  custom_terminal_colors: Record<string, string>
  custom_ui_colors: Record<string, string>
  // Orbit
  orbit_ctx_before: number
  orbit_ctx_after: number
  orbit_compress_prompt: string
  orbit_compress_model: string
  default_manager_model: string
  // Keys
  openrouter_key: string
  // Integrations
  supabase_url: string
  supabase_anon_key: string
  supabase_service_role_key: string
  cloudflare_account_id: string
  cloudflare_r2_access_key_id: string
  cloudflare_r2_secret_access_key: string
  cloudflare_r2_bucket_name: string
  cloudflare_r2_endpoint: string
  cloudflare_r2_public_url: string
  // Meta
  active_project_id: string
  last_project_path: string
  danger_mode: boolean
  playwright_check: boolean
  localhost_check: boolean
  active_ai_provider: string
  // JSON blobs
  projects_json: Project[]
  aliases_json: Alias[]
  templates_json: Template[]
  doc_templates_json: DocTemplate[]
  claude_providers_json: ClaudeProvider[]
  ai_providers_json: AIProvider[]
  repo_tokens_json: RepoToken[]
  terminal_shortcuts_json: TerminalShortcut[]
  kanban_json: Record<string, KanbanTicket[]>
  notes_json: Record<string, string>
  ai_function_map_json: Record<string, string>
  orbit_chats_json: Record<string, string[]>       // projectId → chatIds
  active_orbit_chat_json: Record<string, string>   // sessionId → chatId
  orbit_favorites_json: Record<string, OrbitFavorite[]>
  // Timestamps
  updated_at: string
}

export function buildSettingsPayload(s: AppState): SettingsPayload {
  return {
    theme:                          s.theme,
    accent:                         s.accent,
    accent_fg:                      s.accentFg,
    preset:                         s.preset,
    terminal_theme:                 s.terminalTheme,
    terminal_font_family:           s.terminalFontFamily,
    terminal_font_size:             s.terminalFontSize,
    ui_font:                        s.uiFont,
    ui_font_size:                   s.uiFontSize,
    logo_size:                      s.logoSize,
    show_title_bar:                 s.showTitleBar,
    custom_terminal_colors:         s.customTerminalColors,
    custom_ui_colors:               s.customUiColors,
    orbit_ctx_before:               s.orbitCtxBefore,
    orbit_ctx_after:                s.orbitCtxAfter,
    orbit_compress_prompt:          s.orbitCompressPrompt,
    orbit_compress_model:           s.orbitCompressModel,
    default_manager_model:          s.defaultManagerModel,
    openrouter_key:                 s.openrouterKey,
    supabase_url:                   s.supabaseUrl,
    supabase_anon_key:              s.supabaseAnonKey,
    supabase_service_role_key:      s.supabaseServiceRoleKey,
    cloudflare_account_id:          s.cloudflareAccountId,
    cloudflare_r2_access_key_id:    s.cloudflareR2AccessKeyId,
    cloudflare_r2_secret_access_key: s.cloudflareR2SecretAccessKey,
    cloudflare_r2_bucket_name:      s.cloudflareR2BucketName,
    cloudflare_r2_endpoint:         s.cloudflareR2Endpoint,
    cloudflare_r2_public_url:       s.cloudflareR2PublicUrl,
    active_project_id:              s.activeProjectId,
    last_project_path:              s.lastProjectPath,
    danger_mode:                    s.dangerMode,
    playwright_check:               s.playwrightCheck,
    localhost_check:                s.localhostCheck,
    active_ai_provider:             s.activeAiProvider,
    projects_json:                  s.projects,
    aliases_json:                   s.aliases,
    templates_json:                 s.templates,
    doc_templates_json:             s.docTemplates,
    claude_providers_json:          s.claudeProviders,
    ai_providers_json:              s.aiProviders,
    repo_tokens_json:               s.tokens,
    terminal_shortcuts_json:        s.terminalShortcuts,
    kanban_json:                    s.kanban,
    notes_json:                     s.notes,
    ai_function_map_json:           s.aiFunctionMap,
    orbit_chats_json:               s.orbitChats,
    active_orbit_chat_json:         s.activeOrbitChatId,
    orbit_favorites_json:           s.orbitFavorites,
    updated_at:                     new Date().toISOString(),
  }
}

export async function saveSettingsToSupabase(
  sb: SupabaseClient,
  userId: string,
  state: AppState,
): Promise<void> {
  // The Supabase client recovers its session asynchronously from localStorage
  // on startup. Guard every write so we never hit a 401 / RLS violation while
  // the session is still being restored.
  const { data: { session } } = await sb.auth.getSession()
  if (!session) { console.warn('[supabaseSync] saveSettings skipped — no active session'); return }

  const payload = { user_id: userId, ...buildSettingsPayload(state) }
  const { error } = await sb.from('user_settings').upsert(payload, { onConflict: 'user_id' })
  if (error) console.error('[supabaseSync] saveSettings error:', error.message)
}

// ─── Save orbit messages for a single chat ────────────────────────────────────

export async function saveOrbitChatToSupabase(
  sb: SupabaseClient,
  userId: string,
  projectId: string,
  chatId: string,
  messages: OrbitMessage[],
  meta: OrbitChatMeta,
): Promise<void> {
  const { data: { session } } = await sb.auth.getSession()
  if (!session) { console.warn('[supabaseSync] saveOrbitChat skipped — no active session'); return }

  // 1. Upsert the chat row (project_id is stored as-is, no FK constraint after migration 002)
  const { error: chatErr } = await sb.from('orbit_chats').upsert({
    id: chatId,
    project_id: projectId || null,
    user_id: userId,
    title: safe(meta.title ?? null),
    pinned: meta.pinned ?? false,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' })

  if (chatErr) {
    console.error('[supabaseSync] saveOrbitChat chat error:', chatErr.message)
    return
  }

  // 2. Upsert every message (insert + ignore duplicates by id)
  if (!messages.length) return

  const rows = messages
    .filter(m => m.id)
    .map(m => ({
      id: m.id!,
      chat_id: chatId,
      user_id: userId,
      role: m.role,
      content: m.content,
      model: safe(m.model ?? null),
      tokens: safe(m.tokens ?? null),
      images: m.images ?? [],
      ts: m.ts,
    }))

  if (!rows.length) return

  const { error: msgErr } = await sb
    .from('orbit_messages')
    .upsert(rows, { onConflict: 'id', ignoreDuplicates: true })

  if (msgErr) console.error('[supabaseSync] saveOrbitChat messages error:', msgErr.message)
}

// ─── Load from Supabase → partial store state ─────────────────────────────────

export interface LoadedState {
  settings: Partial<AppState> | null
  orbitMeta: Record<string, OrbitChatMeta>
  projectBrains: Record<string, ProjectBrainEntry>
}

export async function loadFromSupabase(
  sb: SupabaseClient,
  userId: string,
): Promise<LoadedState> {
  const result: LoadedState = { settings: null, orbitMeta: {}, projectBrains: {} }

  // ── 1. Load user_settings ────────────────────────────────────────────────────
  const { data: row, error: settErr } = await sb
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (settErr) {
    console.error('[supabaseSync] loadSettings error:', settErr.message)
  } else if (row) {
    result.settings = {
      theme:                          row.theme          ?? undefined,
      accent:                         row.accent         ?? undefined,
      accentFg:                       row.accent_fg      ?? undefined,
      preset:                         row.preset         ?? undefined,
      terminalTheme:                  row.terminal_theme ?? undefined,
      terminalFontFamily:             row.terminal_font_family  ?? undefined,
      terminalFontSize:               row.terminal_font_size    ?? undefined,
      uiFont:                         row.ui_font        ?? undefined,
      uiFontSize:                     row.ui_font_size   ?? undefined,
      logoSize:                       row.logo_size      ?? undefined,
      showTitleBar:                   row.show_title_bar ?? undefined,
      customTerminalColors:           row.custom_terminal_colors ?? undefined,
      customUiColors:                 row.custom_ui_colors       ?? undefined,
      orbitCtxBefore:                 row.orbit_ctx_before   ?? undefined,
      orbitCtxAfter:                  row.orbit_ctx_after    ?? undefined,
      orbitCompressPrompt:            row.orbit_compress_prompt ?? undefined,
      orbitCompressModel:             row.orbit_compress_model  ?? undefined,
      defaultManagerModel:            row.default_manager_model ?? undefined,
      openrouterKey:                  row.openrouter_key     ?? undefined,
      supabaseUrl:                    row.supabase_url       ?? undefined,
      supabaseAnonKey:                row.supabase_anon_key  ?? undefined,
      supabaseServiceRoleKey:         row.supabase_service_role_key ?? undefined,
      cloudflareAccountId:            row.cloudflare_account_id ?? undefined,
      cloudflareR2AccessKeyId:        row.cloudflare_r2_access_key_id ?? undefined,
      cloudflareR2SecretAccessKey:    row.cloudflare_r2_secret_access_key ?? undefined,
      cloudflareR2BucketName:         row.cloudflare_r2_bucket_name ?? undefined,
      cloudflareR2Endpoint:           row.cloudflare_r2_endpoint ?? undefined,
      cloudflareR2PublicUrl:          row.cloudflare_r2_public_url ?? undefined,
      activeProjectId:                row.active_project_id  ?? undefined,
      lastProjectPath:                row.last_project_path  ?? undefined,
      dangerMode:                     row.danger_mode        ?? undefined,
      playwrightCheck:                row.playwright_check   ?? undefined,
      localhostCheck:                 row.localhost_check    ?? undefined,
      activeAiProvider:               row.active_ai_provider ?? undefined,
      projects:                       (row.projects_json as Project[])                 || undefined,
      aliases:                        (row.aliases_json as Alias[])                    || undefined,
      templates:                      (row.templates_json as Template[])               || undefined,
      docTemplates:                   (row.doc_templates_json as DocTemplate[])        || undefined,
      claudeProviders:                (row.claude_providers_json as ClaudeProvider[])  || undefined,
      aiProviders:                    (row.ai_providers_json as AIProvider[])          || undefined,
      tokens:                         (row.repo_tokens_json as RepoToken[])            || undefined,
      terminalShortcuts:              (row.terminal_shortcuts_json as TerminalShortcut[]) || undefined,
      kanban:                         (row.kanban_json as Record<string, KanbanTicket[]>) || undefined,
      notes:                          (row.notes_json as Record<string, string>)       || undefined,
      aiFunctionMap:                  (row.ai_function_map_json as Record<string, string>) || undefined,
      orbitChats:                     (row.orbit_chats_json as Record<string, string[]>)  || undefined,
      activeOrbitChatId:              (row.active_orbit_chat_json as Record<string, string>) || undefined,
      orbitFavorites:                 (row.orbit_favorites_json as Record<string, OrbitFavorite[]>) || undefined,
    }
    // strip undefined keys so we don't accidentally overwrite with undefined
    for (const k of Object.keys(result.settings) as (keyof AppState)[]) {
      if (result.settings[k] === undefined) delete (result.settings as Record<string, unknown>)[k]
    }
  }

  // ── 2. Load orbit chat metadata only (messages are lazy-loaded per chat) ─────
  const { data: chats, error: chatsErr } = await sb
    .from('orbit_chats')
    .select('id, title, pinned')
    .eq('user_id', userId)

  if (chatsErr) {
    console.error('[supabaseSync] loadOrbitChats error:', chatsErr.message)
  } else if (chats?.length) {
    for (const chat of chats) {
      const cid = chat.id as string
      result.orbitMeta[cid] = {
        title:  (chat.title as string | undefined) ?? undefined,
        pinned: (chat.pinned as boolean | undefined) ?? undefined,
      }
    }
  }

  // ── 3. Load all project brains ───────────────────────────────────────────────
  const { data: brains, error: brainsErr } = await sb
    .from('project_brain')
    .select('*')
    .eq('user_id', userId)

  if (brainsErr) {
    console.error('[supabaseSync] loadProjectBrains error:', brainsErr.message)
  } else if (brains?.length) {
    for (const b of brains) {
      const pid = b.project_id as string
      result.projectBrains[pid] = {
        projectId:     pid,
        summary:       (b.summary as string) ?? '',
        architecture:  (b.architecture as string) ?? '',
        recentWork:    (b.recent_work as ProjectBrainEntry['recentWork']) ?? [],
        openTasks:     (b.open_tasks as string[]) ?? [],
        keyFiles:      (b.key_files as ProjectBrainEntry['keyFiles']) ?? [],
        brainTokens:   (b.brain_tokens as number) ?? 0,
        lastUpdatedAt: (b.last_updated_at as string) ?? new Date().toISOString(),
      }
    }
  }

  // ── 4. Load global_config — infra credentials shared across all users ─────────
  // Only populate fields that are absent/empty in the user's own settings
  const { data: gc } = await sb.from('global_config').select('*').eq('id', 'singleton').maybeSingle()
  if (gc) {
    if (!result.settings) result.settings = {}
    const s = result.settings as Record<string, unknown>
    if (!s['supabaseUrl']               && gc.supabase_url)                    s['supabaseUrl']               = gc.supabase_url
    if (!s['supabaseAnonKey']           && gc.supabase_anon_key)               s['supabaseAnonKey']           = gc.supabase_anon_key
    if (!s['cloudflareAccountId']       && gc.cloudflare_account_id)           s['cloudflareAccountId']       = gc.cloudflare_account_id
    if (!s['cloudflareR2AccessKeyId']   && gc.cloudflare_r2_access_key_id)     s['cloudflareR2AccessKeyId']   = gc.cloudflare_r2_access_key_id
    if (!s['cloudflareR2SecretAccessKey'] && gc.cloudflare_r2_secret_access_key) s['cloudflareR2SecretAccessKey'] = gc.cloudflare_r2_secret_access_key
    if (!s['cloudflareR2BucketName']    && gc.cloudflare_r2_bucket_name)       s['cloudflareR2BucketName']    = gc.cloudflare_r2_bucket_name
    if (!s['cloudflareR2Endpoint']      && gc.cloudflare_r2_endpoint)          s['cloudflareR2Endpoint']      = gc.cloudflare_r2_endpoint
    if (!s['cloudflareR2PublicUrl']     && gc.cloudflare_r2_public_url)        s['cloudflareR2PublicUrl']     = gc.cloudflare_r2_public_url
  }

  return result
}

// ─── Global config sync (admin only) — keeps global_config in sync with admin's infra settings ──
export async function syncGlobalConfig(sb: SupabaseClient, userId: string, state: AppState): Promise<void> {
  // Only admin@codera.com syncs global_config
  const ADMIN_ID = 'f2af2003-6789-4150-b6b6-cc420373b447'
  if (userId !== ADMIN_ID) return
  await sb.from('global_config').upsert({
    id: 'singleton',
    supabase_url:                    state.supabaseUrl                   ?? '',
    supabase_anon_key:               state.supabaseAnonKey               ?? '',
    cloudflare_account_id:           state.cloudflareAccountId           ?? '',
    cloudflare_r2_access_key_id:     state.cloudflareR2AccessKeyId       ?? '',
    cloudflare_r2_secret_access_key: state.cloudflareR2SecretAccessKey   ?? '',
    cloudflare_r2_bucket_name:       state.cloudflareR2BucketName        ?? '',
    cloudflare_r2_endpoint:          state.cloudflareR2Endpoint          ?? '',
    cloudflare_r2_public_url:        state.cloudflareR2PublicUrl         ?? '',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' })
}

// ─── Project Brain ────────────────────────────────────────────────────────────

export async function saveProjectBrainToSupabase(
  sb: SupabaseClient,
  userId: string,
  brain: ProjectBrainEntry,
): Promise<void> {
  const { error } = await sb.from('project_brain').upsert({
    project_id:      brain.projectId,
    user_id:         userId,
    summary:         brain.summary,
    architecture:    brain.architecture,
    recent_work:     brain.recentWork,
    open_tasks:      brain.openTasks,
    key_files:       brain.keyFiles,
    brain_tokens:    brain.brainTokens,
    last_updated_at: brain.lastUpdatedAt,
  }, { onConflict: 'project_id, user_id' })
  if (error) console.error('[supabaseSync] saveProjectBrain error:', error.message)
}

export async function loadProjectBrainFromSupabase(
  sb: SupabaseClient,
  userId: string,
  projectId: string,
): Promise<ProjectBrainEntry | null> {
  const { data, error } = await sb
    .from('project_brain')
    .select('*')
    .eq('user_id', userId)
    .eq('project_id', projectId)
    .maybeSingle()
  if (error) { console.error('[supabaseSync] loadProjectBrain error:', error.message); return null }
  if (!data) return null
  return {
    projectId:      data.project_id as string,
    summary:        (data.summary as string) ?? '',
    architecture:   (data.architecture as string) ?? '',
    recentWork:     (data.recent_work as ProjectBrainEntry['recentWork']) ?? [],
    openTasks:      (data.open_tasks as string[]) ?? [],
    keyFiles:       (data.key_files as ProjectBrainEntry['keyFiles']) ?? [],
    brainTokens:    (data.brain_tokens as number) ?? 0,
    lastUpdatedAt:  (data.last_updated_at as string) ?? new Date().toISOString(),
  }
}

export async function fetchOrbitMessagesForChat(
  sb: SupabaseClient,
  chatId: string,
): Promise<OrbitMessage[]> {
  const { data, error } = await sb
    .from('orbit_messages')
    .select('id, chat_id, role, content, model, tokens, images, ts')
    .eq('chat_id', chatId)
    .order('ts', { ascending: true })
  if (error) { console.error('[supabaseSync] fetchOrbitMessages error:', error.message); return [] }
  return (data ?? []).map(m => ({
    id:      m.id as string,
    role:    m.role as 'user' | 'assistant',
    content: m.content as string,
    ts:      m.ts as number,
    model:   (m.model as string | undefined) ?? undefined,
    tokens:  (m.tokens as number | undefined) ?? undefined,
    images:  (m.images as string[] | undefined) ?? undefined,
  }))
}

export async function upsertSingleOrbitMessage(
  sb: SupabaseClient,
  chatId: string,
  msg: OrbitMessage,
  userId: string,
  projectId = '',
): Promise<void> {
  if (!msg.id) return
  const { data: { session } } = await sb.auth.getSession()
  if (!session) { console.warn('[supabaseSync] upsertSingleOrbitMessage skipped — no active session'); return }

  // Ensure the parent orbit_chats row exists before inserting the message.
  // The debounced full-sync runs 2 s later; without this the FK constraint fires.
  const { error: chatErr } = await sb.from('orbit_chats').upsert({
    id:         chatId,
    user_id:    userId,
    project_id: projectId || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' })
  if (chatErr) { console.error('[supabaseSync] upsertSingleOrbitMessage chat error:', chatErr.message); return }

  const { error } = await sb.from('orbit_messages').upsert({
    id:      msg.id,
    chat_id: chatId,
    user_id: userId,
    role:    msg.role,
    content: msg.content,
    model:   safe(msg.model ?? null),
    tokens:  safe(msg.tokens ?? null),
    images:  msg.images ?? [],
    ts:      msg.ts,
  }, { onConflict: 'id', ignoreDuplicates: true })
  if (error) console.error('[supabaseSync] upsertSingleOrbitMessage error:', error.message)
}

// ─── Debounce helper ──────────────────────────────────────────────────────────

export function debounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  ms: number,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
}
