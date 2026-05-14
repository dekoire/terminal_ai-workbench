/**
 * useSupabaseSync — React hook that wires up Supabase sync
 *
 * Usage: call once in App.tsx (or top-level component)
 *
 * Priority (Supabase-first):
 *   On login → loadFromSupabase() → Supabase wins for settings + brains
 *   Chat messages → lazy-loaded per chat when Zustand slice is empty
 *   New message  → immediate upsert to Supabase + debounce safety-net
 *   Settings     → debounced 4 s save on any store change
 */

import { useEffect, useRef } from 'react'
import { useAppStore, setActiveStorageUser } from '../store/useAppStore'
import { getSupabase }        from './supabase'
import {
  loadFromSupabase,
  saveSettingsToSupabase,
  saveOrbitChatToSupabase,
  upsertSingleOrbitMessage,
  fetchOrbitMessagesForChat,
  syncGlobalConfig,
  saveGlobalTemplates,
  saveGlobalCliConfig,
  saveGlobalPrompts,
  saveProjectsToSupabase,
  deleteProjectFromSupabase,
  debounce,
} from './supabaseSync'

export { saveGlobalTemplates, saveGlobalCliConfig, saveGlobalPrompts }

export function useSupabaseSync() {
  const currentUser   = useAppStore(s => s.currentUser)
  const supabaseUrl   = useAppStore(s => s.supabaseUrl)
  const supabaseKey   = useAppStore(s => s.supabaseAnonKey)

  // ── Force re-login on every new app/server start ───────────────────────────
  // sessionStorage is cleared when the tab/window closes or the server restarts
  // (page reloads). If the flag is absent but a Supabase session exists in
  // localStorage, the user must log in again rather than being silently resumed.
  useEffect(() => {
    const SESSION_FLAG = 'cc-active-session'
    if (sessionStorage.getItem(SESSION_FLAG)) return   // already running this session

    const sb = getSupabase(supabaseUrl, supabaseKey)
    if (!sb) return

    sb.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        // There's a persisted Supabase token but no sessionStorage flag →
        // this is a fresh start (server restart / page reload). Force sign-out.
        sb.auth.signOut().then(() => {
          setActiveStorageUser(''); useAppStore.setState({ currentUser: null, screen: 'login' } as Partial<ReturnType<typeof useAppStore.getState>>)
        }).catch(() => {
          setActiveStorageUser(''); useAppStore.setState({ currentUser: null, screen: 'login' } as Partial<ReturnType<typeof useAppStore.getState>>)
        })
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])   // run once on mount only

  // track whether initial load is done so we don't re-save what we just loaded
  const loadedRef  = useRef(false)
  const userIdRef  = useRef<string | null>(null)
  // Prevent React Strict Mode double-invoke from firing two parallel loads.
  // Set to true as soon as a load starts; reset only when the user changes.
  const loadingRef = useRef(false)

  // ── helpers ────────────────────────────────────────────────────────────────

  const getSb = () => getSupabase(supabaseUrl, supabaseKey)

  // ── inactivity tracking (2-hour lock) ─────────────────────────────────────

  const lastActivityRef = useRef(Date.now())
  const INACTIVITY_MS   = 2 * 60 * 60 * 1000   // 2 hours

  useEffect(() => {
    const touch = () => { lastActivityRef.current = Date.now() }
    window.addEventListener('mousemove',  touch, { passive: true })
    window.addEventListener('keydown',    touch, { passive: true })
    window.addEventListener('mousedown',  touch, { passive: true })
    window.addEventListener('touchstart', touch, { passive: true })
    window.addEventListener('scroll',     touch, { passive: true })
    return () => {
      window.removeEventListener('mousemove',  touch)
      window.removeEventListener('keydown',    touch)
      window.removeEventListener('mousedown',  touch)
      window.removeEventListener('touchstart', touch)
      window.removeEventListener('scroll',     touch)
    }
  }, [])

  // ── proactive inactivity check every 15 min ───────────────────────────────

  useEffect(() => {
    const id = setInterval(() => {
      if (!userIdRef.current) return
      const inactive = Date.now() - lastActivityRef.current
      if (inactive < INACTIVITY_MS) return
      // Idle ≥ 2 h → sign out proactively (don't wait for Supabase event)
      const sb = getSb()
      if (sb) sb.auth.signOut().catch(() => {})
      loadedRef.current  = false
      loadingRef.current = false
      userIdRef.current  = null
      sessionStorage.removeItem('cc-active-session')
      setActiveStorageUser(''); useAppStore.setState({ currentUser: null, screen: 'login' } as Partial<ReturnType<typeof useAppStore.getState>>)
    }, 15 * 60 * 1000)   // check every 15 minutes
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── auth-state watcher: lock screen after 2 h inactivity ──────────────────

  useEffect(() => {
    const sb = getSb()
    if (!sb) return
    const { data: { subscription } } = sb.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        const inactive = Date.now() - lastActivityRef.current
        if (inactive >= INACTIVITY_MS) {
          // User was idle for ≥ 2 hours → force re-login
          loadedRef.current  = false
          loadingRef.current = false
          userIdRef.current  = null
          setActiveStorageUser(''); useAppStore.setState({ currentUser: null, screen: 'login' } as Partial<ReturnType<typeof useAppStore.getState>>)
        } else {
          // Still active — silently refresh the session so the user stays in
          sb.auth.refreshSession().catch(() => {
            // Refresh failed (e.g. invalid refresh token) → log out anyway
            loadedRef.current  = false
            loadingRef.current = false
            userIdRef.current  = null
            setActiveStorageUser(''); useAppStore.setState({ currentUser: null, screen: 'login' } as Partial<ReturnType<typeof useAppStore.getState>>)
          })
        }
      }
    })
    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabaseUrl, supabaseKey])

  // ── on login: load from Supabase (Supabase-first) ─────────────────────────

  useEffect(() => {
    const userId = currentUser?.id ?? null

    if (!userId) {
      loadedRef.current  = false
      loadingRef.current = false
      userIdRef.current  = null
      return
    }
    // Same user and already loaded or currently loading — skip.
    if (userId === userIdRef.current) return
    if (loadingRef.current) return

    // Different user logged in → wipe all user-specific data before loading new user's data
    if (userIdRef.current !== null && userIdRef.current !== userId) {
      useAppStore.getState().resetUserData()
    }

    userIdRef.current  = userId
    loadedRef.current  = false
    loadingRef.current = true

    const sb = getSb()
    if (!sb) {
      console.warn('[supabaseSync] Supabase not configured — skipping load')
      loadedRef.current  = true
      loadingRef.current = false
      return
    }

    // Wait for the Supabase client to finish async session recovery from
    // localStorage before making any authenticated requests.
    sb.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        console.warn('[supabaseSync] No active session — skipping load')
        loadedRef.current  = true
        loadingRef.current = false
        return
      }
      return loadFromSupabase(sb, userId)
    }).then((result) => {
      if (!result) return   // skipped above
      const { settings, orbitMeta, projectBrains } = result
      // Settings: Supabase is authoritative for preferences & API keys.
      // But runtime state (active project/session/chatId, projects-with-sessions)
      // must be MERGED — not blindly overwritten — to avoid disrupting live work.
      if (settings && Object.keys(settings).length > 0) {
        // Snapshot local runtime state BEFORE the merge so we can restore it.
        const local = useAppStore.getState()
        const localActiveProjectId   = local.activeProjectId
        const localActiveOrbitChatId = local.activeOrbitChatId
        const localProjects          = local.projects
        const deletedProjectIds      = new Set(local.deletedProjectIds ?? [])

        // Apply everything in ONE setState to avoid intermediate states where
        // chatId is briefly wrong (causing in-flight messages to go to wrong chat).
        useAppStore.setState((s) => {
          const next = { ...s, ...settings }

          // Always keep local deletedProjectIds — never let Supabase overwrite it.
          next.deletedProjectIds = s.deletedProjectIds ?? []

          // setupWizardDone: once true locally it stays true — never reset by Supabase.
          if (s.setupWizardDone) next.setupWizardDone = true

          // Supabase is authoritative for preferences (theme, API keys, etc.).
          // Local wins for live session state so active work is never disrupted.

          // Keep local activeProjectId
          if (localActiveProjectId) next.activeProjectId = localActiveProjectId

          // Merge activeOrbitChatId: Supabase fills gaps, local wins for known sessions
          next.activeOrbitChatId = {
            ...(settings.activeOrbitChatId ?? {}),
            ...localActiveOrbitChatId,
          }

          // Merge projects: DB is authoritative for metadata; local sessions (running
          // processes) take priority. Projects the user deleted are never restored.
          const sbProjects = (result.projects ?? []).filter(p => !deletedProjectIds.has(p.id))

          if (sbProjects.length > 0 || localProjects.length > 0) {
            const sbMap = new Map(sbProjects.map(p => [p.id, p]))
            const lMap  = new Map(localProjects.map(p => [p.id, p]))
            // DB project + keep any live local sessions on top
            const merged = sbProjects.map(sp => {
              const lp = lMap.get(sp.id)
              return lp ? { ...sp, sessions: lp.sessions } : sp
            })
            // Local-only projects not yet in DB (new ones created before first sync)
            for (const lp of localProjects) {
              if (!sbMap.has(lp.id)) merged.push(lp)
            }
            next.projects = merged
          } else {
            next.projects = []
          }

          return next
        })
        const projCount = useAppStore.getState().projects.length
        console.info(`[supabaseSync] ✅ Settings + ${projCount} project(s) loaded from Supabase`)
      }

      // Chat metadata: merge (local takes priority for active chats)
      const localMeta = useAppStore.getState().orbitMeta
      const mergedMeta = { ...orbitMeta, ...localMeta }
      if (Object.keys(orbitMeta).length > 0) {
        useAppStore.setState({ orbitMeta: mergedMeta })
        console.info('[supabaseSync] ✅ Chat metadata loaded from Supabase')
      }

      // Project brains: Supabase is authoritative
      if (Object.keys(projectBrains).length > 0) {
        const localBrains = useAppStore.getState().projectBrains
        useAppStore.setState({ projectBrains: { ...projectBrains, ...localBrains } })
        console.info('[supabaseSync] ✅ Project brains loaded from Supabase')
      }

      // Apply global admin templates: replace built-ins, keep user's personal templates
      if (result.globalTemplates && result.globalTemplates.length > 0) {
        const globalIds = new Set(result.globalTemplates.map(t => t.id))
        const userPersonal = useAppStore.getState().docTemplates.filter(t => !globalIds.has(t.id) && !(t as { builtin?: boolean }).builtin)
        useAppStore.setState({ docTemplates: [...result.globalTemplates, ...userPersonal] })
        console.info(`[supabaseSync] ✅ Global templates applied (${result.globalTemplates.length})`)
      }

      // Apply global prompt templates — seed new users, merge for existing users
      if (result.globalPrompts && result.globalPrompts.length > 0) {
        const userHasDBTemplates = !!(result.settings && 'templates' in result.settings && result.settings.templates)
        const currentTemplates = useAppStore.getState().templates
        if (!userHasDBTemplates) {
          // New user — replace DEMO defaults with global prompts
          useAppStore.setState({ templates: result.globalPrompts })
        } else {
          // Existing user — add any global prompts they don't have yet
          const userIds = new Set(currentTemplates.map(t => t.id))
          const newOnes = result.globalPrompts.filter(t => !userIds.has(t.id))
          if (newOnes.length > 0) {
            useAppStore.setState({ templates: [...currentTemplates, ...newOnes] })
          }
        }
        console.info(`[supabaseSync] ✅ Global prompt templates applied (${result.globalPrompts.length})`)
      }

      // Apply global CLI config (tweakcc + system prompt) — fire-and-forget
      if (result.globalCli) {
        void (async () => {
          try {
            const { tweakccConfig, systemPrompt } = result.globalCli!
            await fetch('/api/tweakcc/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config: tweakccConfig }) })
            await fetch('/api/tweakcc/system-prompt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: systemPrompt }) })
            await fetch('/api/tweakcc/apply', { method: 'POST' })
            console.info('[supabaseSync] ✅ Global CLI config applied')
          } catch { /* non-fatal */ }
        })()
      }

      // Auto-provision shell aliases for any loaded Claude providers (fire-and-forget).
      void (async () => {
        const providers = useAppStore.getState().claudeProviders
        if (providers.length === 0) return
        const homeDir = await fetch('/api/home').then(r => r.json() as Promise<{ home: string }>).then(d => d.home).catch(() => '~')
        for (const p of providers) {
          try {
            const shellName    = 'cc-' + p.name.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
            const fullJsonPath = `${homeDir}/cc-ui-providers/${p.id}.json`
            const jsonContent  = p.settingsJson ?? JSON.stringify({
              model: 'sonnet',
              env: {
                ANTHROPIC_BASE_URL:              p.baseUrl,
                ANTHROPIC_API_KEY:               p.authToken || '<your-token>',
                ANTHROPIC_MODEL:                 p.modelName,
                ANTHROPIC_SMALL_FAST_MODEL:      p.modelName,
                ANTHROPIC_DEFAULT_SONNET_MODEL:  p.modelName,
                ANTHROPIC_DEFAULT_OPUS_MODEL:    p.modelName,
                ANTHROPIC_DEFAULT_HAIKU_MODEL:   p.modelName,
                API_TIMEOUT_MS: '3000000',
                CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
              },
            }, null, 2)
            const aliasCmd = `ANTHROPIC_BASE_URL=${p.baseUrl} ANTHROPIC_API_KEY=${p.authToken} ANTHROPIC_MODEL=${p.modelName} CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1 claude --bare --settings ${fullJsonPath}`
            await fetch('/api/file-write', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ path: `~/cc-ui-providers/${p.id}.json`, content: jsonContent }),
            })
            await fetch('/api/zshrc-alias', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ aliasName: shellName, aliasCmd }),
            })
          } catch { /* non-fatal — user can re-save manually */ }
        }
        console.info(`[supabaseSync] ✅ Shell aliases provisioned for ${providers.length} provider(s)`)
      })()

      loadedRef.current  = true
      loadingRef.current = false

      // Push any local-only projects that aren't in the DB yet (initial migration)
      const dbIds    = new Set((result.projects ?? []).map(p => p.id))
      const allProjs = useAppStore.getState().projects
      const newLocal = allProjs.filter(p => !dbIds.has(p.id))
      if (allProjs.length > 0) {
        void saveProjectsToSupabase(sb, userId, allProjs)
        if (newLocal.length > 0)
          console.info(`[supabaseSync] ✅ Synced ${newLocal.length} local project(s) to DB`)
      }
    }).catch(err => {
      console.error('[supabaseSync] load error:', err)
      loadedRef.current  = true
      loadingRef.current = false
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, supabaseUrl, supabaseKey])

  // ── lazy-load messages when active chat changes and Zustand is empty ───────

  // Track which chatIds are currently being fetched to stop double-invocation.
  const fetchingChats = useRef<Set<string>>(new Set())

  useEffect(() => {
    const activeOrbitChatId = useAppStore.getState().activeOrbitChatId
    const sb = getSb()
    if (!sb || !userIdRef.current) return

    for (const chatId of Object.values(activeOrbitChatId)) {
      if (!chatId) continue
      const loaded = useAppStore.getState().orbitChatsLoaded[chatId]
      if (loaded) continue
      if (fetchingChats.current.has(chatId)) continue  // already fetching
      const msgs = useAppStore.getState().orbitMessages[chatId] ?? []
      if (msgs.length > 0) {
        useAppStore.getState().setOrbitChatLoaded(chatId)
        continue
      }
      fetchingChats.current.add(chatId)
      fetchOrbitMessagesForChat(sb, chatId).then(fetched => {
        useAppStore.setState(s => {
          const existing = s.orbitMessages[chatId] ?? []
          // If messages were added locally while the fetch was in flight, keep them.
          // (This prevents the Supabase response from overwriting a message the user
          //  just sent before the initial load completed.)
          if (existing.length > 0) {
            return { orbitChatsLoaded: { ...s.orbitChatsLoaded, [chatId]: true } }
          }
          return {
            orbitMessages: fetched.length > 0
              ? { ...s.orbitMessages, [chatId]: fetched }
              : s.orbitMessages,
            orbitChatsLoaded: { ...s.orbitChatsLoaded, [chatId]: true },
          }
        })
        fetchingChats.current.delete(chatId)
      }).catch(err => {
        console.error('[supabaseSync] lazy load error:', err)
        fetchingChats.current.delete(chatId)
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useAppStore(s => s.activeOrbitChatId), supabaseUrl, supabaseKey])

  // ── on project change: sync to projects table ────────────────────────────────

  useEffect(() => {
    const saveDebounced = debounce(async () => {
      if (!loadedRef.current) return
      const userId = userIdRef.current
      if (!userId) return
      const sb = getSb()
      if (!sb) return
      await saveProjectsToSupabase(sb, userId, useAppStore.getState().projects)
    }, 3000)

    const unsub = useAppStore.subscribe((state, prev) => {
      if (!loadedRef.current) return
      if (state.projects === prev.projects) return

      const shrunk = state.projects.length < prev.projects.length
      if (shrunk) {
        saveDebounced.cancel?.()
        // Delete removed project(s) from DB immediately
        const prevIds = new Set(prev.projects.map(p => p.id))
        const newIds  = new Set(state.projects.map(p => p.id))
        void (async () => {
          const userId = userIdRef.current
          const sb = getSb()
          if (!sb || !userId) return
          for (const id of prevIds) {
            if (!newIds.has(id)) await deleteProjectFromSupabase(sb, userId, id)
          }
          await saveProjectsToSupabase(sb, userId, state.projects)
        })()
      } else {
        saveDebounced()
      }
    })

    return () => { unsub(); saveDebounced.cancel?.() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabaseUrl, supabaseKey])

  // ── on store change: save settings (debounced 4 s, immediate on deletion) ──

  useEffect(() => {
    const doSave = async () => {
      if (!loadedRef.current) return
      const userId = userIdRef.current
      if (!userId) return
      const sb = getSb()
      if (!sb) return
      const state = useAppStore.getState()
      await saveSettingsToSupabase(sb, userId, state)
      await syncGlobalConfig(sb, userId, state).catch(() => {})
    }

    const saveDebounced = debounce(doSave, 4000)

    // Zustand subscribe passes (newState, prevState) — use it to detect deletions
    const unsub = useAppStore.subscribe((state, prev) => {
      const projectsShrank = state.projects.length < prev.projects.length
      if (projectsShrank) {
        // Project was removed — save immediately so reload sees the correct state
        saveDebounced.cancel?.()
        void doSave()
      } else {
        saveDebounced()
      }
    })
    return unsub
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabaseUrl, supabaseKey])

  // ── on orbitMessages change: immediate upsert for new messages ────────────

  useEffect(() => {
    // per-chat debounce for full-sync safety-net
    const timers: Record<string, ReturnType<typeof setTimeout>> = {}
    let prevMessages: Record<string, unknown[]> = {}
    let prevLengths: Record<string, number> = {}

    const unsub = useAppStore.subscribe((state) => {
      if (!loadedRef.current) return
      const userId = userIdRef.current
      if (!userId) return
      const sb = getSb()
      if (!sb) return

      const messages = state.orbitMessages

      for (const chatId of Object.keys(messages)) {
        const msgs = messages[chatId]
        const prev = prevMessages[chatId] as typeof msgs | undefined
        if (msgs === prev) continue

        const prevLen = prevLengths[chatId] ?? 0
        const newLen  = msgs?.length ?? 0

        // Immediate upsert for any newly appended message
        if (newLen > prevLen && msgs?.length) {
          const newMsg = msgs[msgs.length - 1]
          if (newMsg?.id && !newMsg.id.endsWith('-err')) {
            let projectId = ''
            for (const [pid, chatIds] of Object.entries(state.orbitChats)) {
              if ((chatIds as string[]).includes(chatId)) { projectId = pid; break }
            }
            void upsertSingleOrbitMessage(sb, chatId, newMsg, userIdRef.current ?? '', projectId)
          }
        }

        // Also ensure the chat row + full messages are synced (debounced 2s safety-net)
        clearTimeout(timers[chatId])
        timers[chatId] = setTimeout(async () => {
          const current = useAppStore.getState()
          let projectId = ''
          for (const [pid, chatIds] of Object.entries(current.orbitChats)) {
            if (chatIds.includes(chatId)) { projectId = pid; break }
          }
          if (!projectId) return
          await saveOrbitChatToSupabase(
            sb, userId, projectId, chatId,
            // Filter out injected error messages
            (current.orbitMessages[chatId] ?? []).filter(m => !m.id?.endsWith('-err')),
            current.orbitMeta[chatId] ?? {},
          )
        }, 2000)

        prevLengths[chatId] = newLen
      }

      prevMessages = messages as Record<string, unknown[]>
    })

    return () => {
      unsub()
      Object.values(timers).forEach(clearTimeout)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabaseUrl, supabaseKey])
}
