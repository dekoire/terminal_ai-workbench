/**
 * useSupabaseSync — orchestrates Supabase auth, data loading, and cloud sync
 *
 * This is the public entry point — call it once in App.tsx.
 * Internally delegates to three focused sub-hooks:
 *
 *  useAuthStateWatcher  → Supabase auth events (INITIAL_SESSION, SIGNED_IN, SIGNED_OUT)
 *                          + 2-hour inactivity lock
 *  useUserDataLoader    → fetches all user data on login, merges into Zustand store
 *  useCloudSync         → debounced sync of store changes back to Supabase
 *
 * Shared coordination refs (loadedRef, userIdRef, etc.) are created here and
 * passed to each sub-hook so they can coordinate without direct coupling.
 */

import { useRef, useCallback } from 'react'
import { useAppStore, setActiveStorageUser } from '../store/useAppStore'
import { useAuthStateWatcher } from './useAuthStateWatcher'
import { useUserDataLoader }   from './useUserDataLoader'
import { useCloudSync }        from './useCloudSync'
import {
  saveGlobalTemplates,
  saveGlobalCliConfig,
  saveGlobalPrompts,
  saveSessionsToSupabase,
  deleteSessionFromSupabase,
  upsertOrbitFavoriteToSupabase,
  deleteOrbitFavoriteFromSupabase,
} from './supabaseSync'

// Re-export Supabase helpers that other modules import from this file
export {
  saveGlobalTemplates,
  saveGlobalCliConfig,
  saveGlobalPrompts,
  saveSessionsToSupabase,
  deleteSessionFromSupabase,
  upsertOrbitFavoriteToSupabase,
  deleteOrbitFavoriteFromSupabase,
}

// Module-level sign-out function registered by useAuthStateWatcher.
// Kept here so triggerSupabaseSignOut() is a stable, importable module-level function.
let _signOutFn: (() => void) | null = null

/** Fire-and-forget Supabase sign-out — safe to call from anywhere in the app. */
export function triggerSupabaseSignOut() { _signOutFn?.() }

export function useSupabaseSync() {
  const currentUser = useAppStore(s => s.currentUser)
  const supabaseUrl = useAppStore(s => s.supabaseUrl)
  const supabaseKey = useAppStore(s => s.supabaseAnonKey)

  // ── Shared coordination refs ──────────────────────────────────────────────
  // Passed to sub-hooks so they can coordinate without direct coupling.
  const loadedRef     = useRef(false)              // true once initial DB load completes
  const loadingRef    = useRef(false)              // true while DB load is in progress
  const userIdRef     = useRef<string | null>(null) // currently loaded user ID
  const rehydratedRef = useRef(false)              // true after INITIAL_SESSION fires

  // Restored from localStorage so the inactivity check survives page reloads
  const lastActivityRef = useRef(
    parseInt(localStorage.getItem('cc-last-activity') ?? String(Date.now()), 10),
  )
  const INACTIVITY_MS = 2 * 60 * 60 * 1000  // 2 hours

  // Message sync refs — survive Effect re-fires so state isn't lost on supabaseUrl/Key change
  const prevMessagesRef = useRef<Record<string, unknown[]>>({})
  const prevLengthsRef  = useRef<Record<string, number>>({})

  // ── clearUserState — resets refs + clears the Zustand session ─────────────
  // skipSignOut=true when called from a SIGNED_OUT handler — Supabase already
  // terminated the session, calling signOut() again would return 403.
  const clearUserState = useCallback((skipSignOut = false) => {
    if (!skipSignOut) _signOutFn?.()
    _signOutFn     = null
    loadedRef.current  = false
    loadingRef.current = false
    userIdRef.current  = null
    setActiveStorageUser('')
    useAppStore.setState({
      currentUser: null,
      screen: 'login',
    } as Partial<ReturnType<typeof useAppStore.getState>>)
    useAppStore.getState().resetUserData()
  }, [])

  // ── Sub-hooks ─────────────────────────────────────────────────────────────
  useAuthStateWatcher({
    supabaseUrl, supabaseKey,
    rehydratedRef, userIdRef, loadedRef, loadingRef,
    lastActivityRef, INACTIVITY_MS,
    clearUserState,
    onSignOutReady:   (fn) => { _signOutFn = fn },
    onSignOutCleared: ()   => { _signOutFn = null },
  })

  useUserDataLoader({
    currentUser, supabaseUrl, supabaseKey,
    loadedRef, loadingRef, userIdRef,
  })

  useCloudSync({
    supabaseUrl, supabaseKey,
    loadedRef, userIdRef,
    prevMessagesRef, prevLengthsRef,
  })
}
