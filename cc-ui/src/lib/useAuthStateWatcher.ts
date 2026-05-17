/**
 * useAuthStateWatcher — Supabase auth event handler + 2-hour inactivity lock
 *
 * Responsibilities:
 *  - Tracks user activity (mouse, keyboard, scroll) and persists to localStorage
 *  - Proactively signs out after 2 h of inactivity (15-min interval check)
 *  - Subscribes to Supabase onAuthStateChange:
 *      INITIAL_SESSION → marks hydration complete (prevents false logout on reload)
 *      SIGNED_IN       → syncs display fields (name/avatar) from user_metadata
 *      SIGNED_OUT      → verifies session is truly gone, attempts token refresh if user was active
 */

import { useEffect } from 'react'
import type { MutableRefObject } from 'react'
import { getSupabase } from './supabase'
import { useAppStore } from '../store/useAppStore'

interface AuthStateWatcherOptions {
  supabaseUrl:      string
  supabaseKey:      string
  rehydratedRef:    MutableRefObject<boolean>
  userIdRef:        MutableRefObject<string | null>
  loadedRef:        MutableRefObject<boolean>
  loadingRef:       MutableRefObject<boolean>
  lastActivityRef:  MutableRefObject<number>
  INACTIVITY_MS:    number
  clearUserState:   (skipSignOut?: boolean) => void
  /** Called with the Supabase signOut fn once the subscription is ready. */
  onSignOutReady:   (fn: () => void) => void
  /** Called when the auth subscription is torn down. */
  onSignOutCleared: () => void
}

export function useAuthStateWatcher({
  supabaseUrl, supabaseKey,
  rehydratedRef, userIdRef, loadedRef, loadingRef,
  lastActivityRef, INACTIVITY_MS,
  clearUserState, onSignOutReady, onSignOutCleared,
}: AuthStateWatcherOptions) {

  // ── Activity tracking — update lastActivity on any user interaction ────────
  useEffect(() => {
    const touch = () => {
      const now = Date.now()
      lastActivityRef.current = now
      localStorage.setItem('cc-last-activity', String(now))
    }
    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'] as const
    events.forEach(ev => window.addEventListener(ev, touch, { passive: true }))
    return () => events.forEach(ev => window.removeEventListener(ev, touch))
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Proactive inactivity check every 15 minutes ───────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      if (!userIdRef.current) return
      const idle = Date.now() - lastActivityRef.current
      if (idle < INACTIVITY_MS) return
      loadedRef.current  = false
      loadingRef.current = false
      userIdRef.current  = null
      clearUserState()
    }, 15 * 60 * 1000)
    return () => clearInterval(id)
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Supabase onAuthStateChange subscription ───────────────────────────────
  useEffect(() => {
    const sb = getSupabase(supabaseUrl, supabaseKey)
    if (!sb) return
    onSignOutReady(() => sb.auth.signOut().catch(() => {}))

    const { data: { subscription } } = sb.auth.onAuthStateChange((event, session) => {
      // INITIAL_SESSION fires once on init — mark hydration complete so SIGNED_OUT
      // events that fire before this are ignored (prevents false logout on reload).
      if (event === 'INITIAL_SESSION') {
        rehydratedRef.current = true
        return
      }

      if (event === 'SIGNED_IN') {
        // Sync display fields from Supabase (name/avatar may have changed on another device).
        // SECURITY: user_metadata is user-editable — used here for display only, never authorization.
        const sbUser = session?.user
        if (sbUser && sbUser.id === useAppStore.getState().currentUser?.id) {
          const meta = sbUser.user_metadata ?? {}
          useAppStore.setState({
            currentUser: {
              id:            sbUser.id,
              email:         sbUser.email ?? useAppStore.getState().currentUser?.email ?? '',
              firstName:     (meta['first_name']      as string) ?? useAppStore.getState().currentUser?.firstName  ?? '',
              lastName:      (meta['last_name']       as string) ?? useAppStore.getState().currentUser?.lastName   ?? '',
              avatarDataUrl: (meta['avatar_data_url'] as string) ?? useAppStore.getState().currentUser?.avatarDataUrl,
            },
          })
        }
        return
      }

      if (event === 'SIGNED_OUT') {
        // Guard: ignore SIGNED_OUT before INITIAL_SESSION fires (reload race condition)
        if (!rehydratedRef.current) return

        // Double-check: SIGNED_OUT can be spurious under race conditions
        sb.auth.getSession().then(({ data: { session: live } }) => {
          if (live) return  // session still alive — spurious event, ignore

          // Session is genuinely gone
          const logout = () => {
            loadedRef.current  = false
            loadingRef.current = false
            userIdRef.current  = null
            clearUserState(true)  // skipSignOut=true — Supabase already terminated it (calling again → 403)
          }

          const idle = Date.now() - lastActivityRef.current
          if (idle >= INACTIVITY_MS) {
            logout()
          } else {
            // User was active — attempt a silent token refresh before giving up
            sb.auth.refreshSession()
              .then(({ data: { session: refreshed } }) => { if (!refreshed) logout() })
              .catch(logout)
          }
        }).catch(() => {
          // getSession failed → treat as logged out to be safe
          loadedRef.current  = false
          loadingRef.current = false
          userIdRef.current  = null
          clearUserState(true)
        })
      }
    })

    return () => {
      subscription.unsubscribe()
      onSignOutCleared()
    }
  }, [supabaseUrl, supabaseKey])  // eslint-disable-line react-hooks/exhaustive-deps
}
