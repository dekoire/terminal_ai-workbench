/**
 * useUserDataLoader — loads all user data from Supabase on login
 *
 * Responsibilities:
 *  - Triggered when currentUser.id changes (login event)
 *  - Resets store to a clean slate, then fetches from Supabase
 *  - Merges Supabase data with local state:
 *      Supabase wins: preferences, API keys, brains, global templates
 *      Local wins:    activeProjectId, live session state, runtime chat IDs
 *  - Migrates local-only projects and sessions to DB (idempotent upsert)
 *  - Lazy-loads orbit chat messages when the active chat changes
 */

import { useEffect, useRef } from 'react'
import type { MutableRefObject } from 'react'
import { useAppStore } from '../store/useAppStore'
import type { CurrentUser } from '../store/useAppStore'
import { getSupabase } from './supabase'
import { devLog, devWarn } from './devLogger'
import {
  loadFromSupabase,
  fetchOrbitMessagesForChat,
  saveProjectsToSupabase,
  saveSessionsToSupabase,
  upsertOrbitFavoriteToSupabase,
} from './supabaseSync'

interface UserDataLoaderOptions {
  currentUser:  CurrentUser | null
  supabaseUrl:  string
  supabaseKey:  string
  loadedRef:    MutableRefObject<boolean>
  loadingRef:   MutableRefObject<boolean>
  userIdRef:    MutableRefObject<string | null>
}

export function useUserDataLoader({
  currentUser, supabaseUrl, supabaseKey,
  loadedRef, loadingRef, userIdRef,
}: UserDataLoaderOptions) {

  // Track which chatIds are currently being fetched to prevent duplicate requests
  const fetchingChatsRef = useRef<Set<string>>(new Set())

  // activeOrbitChatId as a top-level selector so the lazy-load effect re-runs when it changes
  const activeOrbitChatId = useAppStore(s => s.activeOrbitChatId)

  // ── Load all user data from Supabase when logged-in user changes ──────────
  useEffect(() => {
    const userId = currentUser?.id ?? null

    if (!userId) {
      loadedRef.current  = false
      loadingRef.current = false
      userIdRef.current  = null
      return
    }
    if (userId === userIdRef.current) return  // same user, already loaded or loading
    if (loadingRef.current) return

    // Snapshot local projects BEFORE reset so sessions survive the DB merge.
    // resetUserData() clears sessions to [], so we must capture them here.
    const localProjectsSnapshot = useAppStore.getState().projects

    // IMPORTANT: set loadedRef=false BEFORE resetUserData() so sync subscribers
    // see loadedRef=false and bail, preventing stale empty state from overwriting DB data.
    loadedRef.current  = false
    loadingRef.current = true
    userIdRef.current  = userId
    useAppStore.getState().resetUserData()

    const sb = getSupabase(supabaseUrl, supabaseKey)
    if (!sb) {
      devWarn('[dataLoader] Supabase not configured — skipping load')
      loadedRef.current  = true
      loadingRef.current = false
      useAppStore.getState().setDataLoaded(true)
      return
    }

    // Wait for Supabase client to recover the persisted session from localStorage
    // before making any authenticated requests.
    sb.auth.getSession()
      .then(({ data: { session } }) => {
        if (!session) {
          devWarn('[dataLoader] No active session — skipping load')
          loadedRef.current  = true
          loadingRef.current = false
          useAppStore.getState().setDataLoaded(true)
          return
        }
        return loadFromSupabase(sb, userId)
      })
      .then((result) => {
        if (!result) return

        const { settings, orbitMeta, projectBrains } = result
        const local               = useAppStore.getState()
        const localActiveProjectId   = local.activeProjectId
        const localActiveOrbitChatId = local.activeOrbitChatId
        const deletedProjectIds      = new Set(local.deletedProjectIds ?? [])

        // ── Settings (Supabase authoritative for prefs, local wins for runtime) ──
        if (settings && Object.keys(settings).length > 0) {
          // QuickLinks safety-net: fall back to localStorage backup when Supabase returns empty
          if (!settings.quickLinks || (settings.quickLinks as unknown[]).length === 0) {
            try {
              const backup = localStorage.getItem(`ql_backup_${userId}`)
              if (backup) {
                const parsed = JSON.parse(backup)
                if (Array.isArray(parsed) && parsed.length > 0) {
                  settings.quickLinks = parsed
                  devLog('[dataLoader] QuickLinks restored from localStorage backup')
                }
              }
            } catch { /* non-fatal */ }
          }

          // Single setState to avoid transient chatId mismatches
          useAppStore.setState((s) => {
            const next = { ...s, ...settings }
            next.deletedProjectIds = s.deletedProjectIds ?? []
            if (s.setupWizardDone) next.setupWizardDone = true  // once true, never reset
            if (localActiveProjectId) next.activeProjectId = localActiveProjectId
            next.activeOrbitChatId = { ...(settings.activeOrbitChatId ?? {}), ...localActiveOrbitChatId }
            return next
          })

          try {
            const ql = useAppStore.getState().quickLinks
            if (ql?.length) localStorage.setItem(`ql_backup_${userId}`, JSON.stringify(ql))
          } catch { /* non-fatal */ }

          devLog('[dataLoader] ✅ Settings loaded from Supabase')
        }

        // ── Projects (merge DB + local sessions) ─────────────────────────────
        const sbProjects = (result.projects ?? []).filter(p => !deletedProjectIds.has(p.id))
        if (sbProjects.length > 0 || localProjectsSnapshot.length > 0) {
          const sbMap  = new Map(sbProjects.map(p => [p.id, p]))
          const lMap   = new Map(localProjectsSnapshot.map(p => [p.id, p]))
          const merged = sbProjects.map(sp => {
            const lp = lMap.get(sp.id)
            return { ...sp, sessions: (lp && lp.sessions.length > 0) ? lp.sessions : sp.sessions }
          })
          for (const lp of localProjectsSnapshot) {
            if (!sbMap.has(lp.id)) merged.push(lp)  // local-only, not yet in DB
          }
          useAppStore.setState({ projects: merged })
        }
        devLog(`[dataLoader] ✅ ${useAppStore.getState().projects.length} project(s) loaded`)

        // ── Chat metadata (local takes priority for active chats) ─────────────
        if (Object.keys(orbitMeta).length > 0) {
          useAppStore.setState({ orbitMeta: { ...orbitMeta, ...useAppStore.getState().orbitMeta } })
          devLog('[dataLoader] ✅ Chat metadata loaded')
        }

        // ── Project brains (Supabase authoritative, local overrides on top) ───
        if (Object.keys(projectBrains).length > 0) {
          useAppStore.setState({ projectBrains: { ...projectBrains, ...useAppStore.getState().projectBrains } })
          devLog('[dataLoader] ✅ Project brains loaded')
        }

        // ── Global doc templates (admin-managed, replaces built-ins) ─────────
        if (result.globalTemplates?.length) {
          const globalIds    = new Set(result.globalTemplates.map(t => t.id))
          const userPersonal = useAppStore.getState().docTemplates.filter(
            t => !globalIds.has(t.id) && !(t as { builtin?: boolean }).builtin,
          )
          useAppStore.setState({ docTemplates: [...result.globalTemplates, ...userPersonal] })
          devLog(`[dataLoader] ✅ Global doc templates applied (${result.globalTemplates.length})`)
        }

        // ── Global prompt templates (seed new users, merge for existing) ──────
        if (result.globalPrompts?.length) {
          const hasPersonalTemplates = !!(result.settings && 'templates' in result.settings && result.settings.templates)
          const current = useAppStore.getState().templates
          if (!hasPersonalTemplates) {
            useAppStore.setState({ templates: result.globalPrompts })
          } else {
            const existingIds = new Set(current.map(t => t.id))
            const newOnes     = result.globalPrompts.filter(t => !existingIds.has(t.id))
            if (newOnes.length) useAppStore.setState({ templates: [...current, ...newOnes] })
          }
          devLog(`[dataLoader] ✅ Global prompt templates applied (${result.globalPrompts.length})`)
        }

        // ── Global CLI config (tweakcc + system prompt) — fire-and-forget ─────
        if (result.globalCli) {
          void (async () => {
            try {
              const { tweakccConfig, systemPrompt } = result.globalCli!
              await fetch('/api/tweakcc/config',        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config: tweakccConfig }) })
              await fetch('/api/tweakcc/system-prompt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: systemPrompt }) })
              await fetch('/api/tweakcc/apply',         { method: 'POST' })
              devLog('[dataLoader] ✅ Global CLI config applied')
            } catch { /* non-fatal */ }
          })()
        }

        // ── Shell alias auto-provisioning for Claude providers — fire-and-forget
        void (async () => {
          const providers = useAppStore.getState().claudeProviders
          if (!providers.length) return
          const homeDir = await fetch('/api/home')
            .then(r => r.json() as Promise<{ home: string }>)
            .then(d => d.home)
            .catch(() => '~')
          for (const p of providers) {
            try {
              const shellName    = 'cc-' + p.name.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
              const fullJsonPath = `${homeDir}/cc-ui-providers/${p.id}.json`
              const jsonContent  = p.settingsJson ?? JSON.stringify({
                model: 'sonnet',
                env: {
                  ANTHROPIC_BASE_URL:                      p.baseUrl,
                  ANTHROPIC_API_KEY:                        p.authToken || '<your-token>',
                  ANTHROPIC_MODEL:                         p.modelName,
                  ANTHROPIC_SMALL_FAST_MODEL:              p.modelName,
                  ANTHROPIC_DEFAULT_SONNET_MODEL:          p.modelName,
                  ANTHROPIC_DEFAULT_OPUS_MODEL:            p.modelName,
                  ANTHROPIC_DEFAULT_HAIKU_MODEL:           p.modelName,
                  API_TIMEOUT_MS:                          '3000000',
                  CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
                },
              }, null, 2)
              const aliasCmd = `ANTHROPIC_BASE_URL=${p.baseUrl} ANTHROPIC_API_KEY=${p.authToken} ANTHROPIC_MODEL=${p.modelName} CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1 claude --bare --settings ${fullJsonPath}`
              await fetch('/api/file-write', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: `~/cc-ui-providers/${p.id}.json`, content: jsonContent }) })
              await fetch('/api/zshrc-alias', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aliasName: shellName, aliasCmd }) })
            } catch { /* non-fatal — user can re-save manually */ }
          }
          devLog(`[dataLoader] ✅ Shell aliases provisioned for ${providers.length} provider(s)`)
        })()

        // ── Mark loading complete ─────────────────────────────────────────────
        loadedRef.current  = true
        loadingRef.current = false
        useAppStore.getState().setDataLoaded(true)

        // ── Push local-only data to DB (initial migration, idempotent) ────────
        const dbIds    = new Set((result.projects ?? []).map(p => p.id))
        const allProj  = useAppStore.getState().projects
        const newLocal = allProj.filter(p => !dbIds.has(p.id))
        if (allProj.length > 0) {
          void saveProjectsToSupabase(sb, userId, allProj)
          if (newLocal.length) devLog(`[dataLoader] ✅ Synced ${newLocal.length} local project(s) to DB`)
        }
        const dbSessionCounts = new Map((result.projects ?? []).map(p => [p.id, (p.sessions ?? []).length]))
        for (const p of allProj) {
          if (!p.sessions.length) continue
          const dbCount = dbSessionCounts.get(p.id) ?? 0
          if (p.sessions.length > dbCount) {
            void saveSessionsToSupabase(sb, userId, p.id, p.sessions)
            devLog(`[dataLoader] ✅ Pushed ${p.sessions.length} session(s) for project ${p.id} (DB had ${dbCount})`)
          }
        }

        // ── One-time migration: orbit favorites JSON blob → dedicated DB table ─
        void (async () => {
          const { data: existing } = await sb.from('orbit_favorites').select('id').eq('user_id', userId).limit(1)
          if (existing?.length) return
          const allFavs = Object.values(useAppStore.getState().orbitFavorites).flat()
          if (!allFavs.length) return
          for (const fav of allFavs) await upsertOrbitFavoriteToSupabase(sb, userId, fav)
          devLog(`[dataLoader] ✅ Migrated ${allFavs.length} orbit favorite(s) to DB table`)
        })()
      })
      .catch(err => {
        console.error('[dataLoader] load error:', err)
        loadedRef.current  = true
        loadingRef.current = false
        useAppStore.getState().setDataLoaded(true)
      })
  }, [currentUser?.id, supabaseUrl, supabaseKey])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Lazy-load orbit messages when the active chat changes ─────────────────
  // Uses activeOrbitChatId as a top-level selector (not inside the effect dep array)
  // to avoid a Rules-of-Hooks violation.
  useEffect(() => {
    const sb = getSupabase(supabaseUrl, supabaseKey)
    if (!sb || !userIdRef.current) return

    for (const chatId of Object.values(activeOrbitChatId)) {
      if (!chatId) continue
      if (useAppStore.getState().orbitChatsLoaded[chatId]) continue
      if (fetchingChatsRef.current.has(chatId)) continue
      const existing = useAppStore.getState().orbitMessages[chatId] ?? []
      if (existing.length > 0) {
        useAppStore.getState().setOrbitChatLoaded(chatId)
        continue
      }
      fetchingChatsRef.current.add(chatId)
      fetchOrbitMessagesForChat(sb, chatId)
        .then(fetched => {
          useAppStore.setState(s => {
            const local = s.orbitMessages[chatId] ?? []
            // If messages arrived locally while fetching — keep them, just mark as loaded
            if (local.length > 0) {
              return { orbitChatsLoaded: { ...s.orbitChatsLoaded, [chatId]: true } }
            }
            return {
              orbitMessages:    fetched.length > 0 ? { ...s.orbitMessages, [chatId]: fetched } : s.orbitMessages,
              orbitChatsLoaded: { ...s.orbitChatsLoaded, [chatId]: true },
            }
          })
          fetchingChatsRef.current.delete(chatId)
        })
        .catch(err => {
          console.error('[dataLoader] lazy chat load error:', err)
          fetchingChatsRef.current.delete(chatId)
        })
    }
  }, [activeOrbitChatId, supabaseUrl, supabaseKey])  // eslint-disable-line react-hooks/exhaustive-deps
}
