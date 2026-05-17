/**
 * useCloudSync — debounced sync of local store changes to Supabase
 *
 * Responsibilities (all guarded by loadedRef to prevent write-during-load):
 *  - Projects:       debounced upsert (3s), immediate delete
 *  - Sessions:       debounced upsert (1s), immediate delete
 *  - Orbit favorites: immediate upsert/delete
 *  - Settings:       debounced save (4s), immediate on project deletion
 *  - Orbit messages: immediate upsert for new messages + 2s full-sync safety-net
 */

import { useEffect } from 'react'
import type { MutableRefObject } from 'react'
import { useAppStore } from '../store/useAppStore'
import { getSupabase } from './supabase'
import {
  saveProjectsToSupabase,
  deleteProjectFromSupabase,
  saveSessionsToSupabase,
  deleteSessionFromSupabase,
  upsertOrbitFavoriteToSupabase,
  deleteOrbitFavoriteFromSupabase,
  saveSettingsToSupabase,
  syncGlobalConfig,
  saveOrbitChatToSupabase,
  upsertSingleOrbitMessage,
  debounce,
} from './supabaseSync'

interface CloudSyncOptions {
  supabaseUrl:     string
  supabaseKey:     string
  loadedRef:       MutableRefObject<boolean>
  userIdRef:       MutableRefObject<string | null>
  /** Refs survive Effect re-fires without resetting (prevents stale-closure bugs). */
  prevMessagesRef: MutableRefObject<Record<string, unknown[]>>
  prevLengthsRef:  MutableRefObject<Record<string, number>>
}

export function useCloudSync({
  supabaseUrl, supabaseKey,
  loadedRef, userIdRef,
  prevMessagesRef, prevLengthsRef,
}: CloudSyncOptions) {
  const getSb = () => getSupabase(supabaseUrl, supabaseKey)

  // ── Projects: debounced upsert, immediate delete ──────────────────────────
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
      if (!state.currentUser) return  // don't write to DB during logout
      if (state.projects === prev.projects) return

      if (state.projects.length < prev.projects.length) {
        saveDebounced.cancel?.()
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
  }, [supabaseUrl, supabaseKey])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sessions within projects: debounced upsert (1s), immediate delete ─────
  useEffect(() => {
    const sessionTimers: Record<string, ReturnType<typeof setTimeout>> = {}

    const unsub = useAppStore.subscribe((state, prev) => {
      if (!loadedRef.current) return
      if (!state.currentUser) return  // don't delete sessions during logout
      if (state.projects === prev.projects) return

      const userId = userIdRef.current
      const sb = getSb()
      if (!sb || !userId) return

      for (const proj of state.projects) {
        const prevProj = prev.projects.find(p => p.id === proj.id)
        if (!prevProj || proj.sessions === prevProj.sessions) continue

        const prevSessIds = new Set(prevProj.sessions.map(s => s.id))
        const newSessIds  = new Set(proj.sessions.map(s => s.id))

        // Removed sessions → immediate delete
        for (const prevSess of prevProj.sessions) {
          if (!newSessIds.has(prevSess.id)) void deleteSessionFromSupabase(sb, userId, prevSess.id)
        }

        // Added/updated sessions → debounced upsert
        const hasChanges = proj.sessions.some(s =>
          !prevSessIds.has(s.id) || prevProj.sessions.find(ps => ps.id === s.id) !== s,
        )
        if (hasChanges) {
          // Capture values NOW so logout can't null out userIdRef before the timer fires
          const capturedUserId   = userId
          const capturedProjId   = proj.id
          const capturedSessions = proj.sessions
          clearTimeout(sessionTimers[proj.id])
          sessionTimers[proj.id] = setTimeout(() => {
            void saveSessionsToSupabase(sb, capturedUserId, capturedProjId, capturedSessions)
          }, 1000)
        }
      }
    })
    return () => { unsub(); Object.values(sessionTimers).forEach(clearTimeout) }
  }, [supabaseUrl, supabaseKey])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Orbit favorites: immediate upsert on add, immediate delete on remove ──
  useEffect(() => {
    const unsub = useAppStore.subscribe((state, prev) => {
      if (!loadedRef.current) return
      if (state.orbitFavorites === prev.orbitFavorites) return

      const userId = userIdRef.current
      const sb = getSb()
      if (!sb || !userId) return

      const allPrev = Object.values(prev.orbitFavorites).flat()
      const allNext = Object.values(state.orbitFavorites).flat()
      const prevIds = new Set(allPrev.map(f => f.id))
      const nextIds = new Set(allNext.map(f => f.id))

      for (const fav of allNext) {
        if (!prevIds.has(fav.id)) void upsertOrbitFavoriteToSupabase(sb, userId, fav)
      }
      for (const fav of allPrev) {
        if (!nextIds.has(fav.id)) void deleteOrbitFavoriteFromSupabase(sb, userId, fav.id)
      }
    })
    return unsub
  }, [supabaseUrl, supabaseKey])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Settings: debounced save (4s), immediate on project deletion ──────────
  useEffect(() => {
    const doSave = async () => {
      if (!loadedRef.current) return
      const userId = userIdRef.current
      if (!userId) return
      if (!useAppStore.getState().currentUser) return
      const sb = getSb()
      if (!sb) return
      const state = useAppStore.getState()
      await saveSettingsToSupabase(sb, userId, state)
      await syncGlobalConfig(sb, userId, state).catch(() => {})
      try {
        if (state.quickLinks?.length) {
          localStorage.setItem(`ql_backup_${userId}`, JSON.stringify(state.quickLinks))
        }
      } catch { /* non-fatal */ }
    }

    const saveDebounced = debounce(doSave, 4000)
    const unsub = useAppStore.subscribe((state, prev) => {
      if (state.projects.length < prev.projects.length) {
        saveDebounced.cancel?.()
        void doSave()
      } else {
        saveDebounced()
      }
    })
    return unsub
  }, [supabaseUrl, supabaseKey])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Orbit messages: immediate upsert for new msgs, 2s full-sync safety-net ─
  useEffect(() => {
    const timers: Record<string, ReturnType<typeof setTimeout>> = {}

    const unsub = useAppStore.subscribe((state) => {
      if (!loadedRef.current) return
      const userId = userIdRef.current
      if (!userId) return
      const sb = getSb()
      if (!sb) return

      const messages = state.orbitMessages
      for (const chatId of Object.keys(messages)) {
        const msgs = messages[chatId]
        const prev = prevMessagesRef.current[chatId] as typeof msgs | undefined
        if (msgs === prev) continue

        const prevLen = prevLengthsRef.current[chatId] ?? 0
        const newLen  = msgs?.length ?? 0

        // Immediate upsert for newly appended message
        if (newLen > prevLen && msgs?.length) {
          const newMsg = msgs[msgs.length - 1]
          if (newMsg?.id && !newMsg.id.endsWith('-err')) {
            let projectId = ''
            for (const [pid, chatIds] of Object.entries(state.orbitChats)) {
              if ((chatIds as string[]).includes(chatId)) { projectId = pid; break }
            }
            void upsertSingleOrbitMessage(sb, chatId, newMsg, userId, projectId)
          }
        }

        // Debounced full-sync safety-net
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
            (current.orbitMessages[chatId] ?? []).filter(m => !m.id?.endsWith('-err')),
            current.orbitMeta[chatId] ?? {},
          )
        }, 2000)

        prevLengthsRef.current[chatId] = newLen
      }
      prevMessagesRef.current = messages as Record<string, unknown[]>
    })

    return () => { unsub(); Object.values(timers).forEach(clearTimeout) }
  }, [supabaseUrl, supabaseKey])  // eslint-disable-line react-hooks/exhaustive-deps
}
