import { useState } from 'react'
import { useAppStore, setActiveStorageUser } from '../../store/useAppStore'
import { getSupabase } from '../../lib/supabase'
import { AuthBackground, AuthBrandPanel, PasswordInput, fieldLabel, fieldInput, btnPrimary } from './AuthShared'

export function LoginScreen() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)

  const setScreen      = useAppStore(s => s.setScreen)
  const setCurrentUser = useAppStore(s => s.setCurrentUser)
  const addToast       = useAppStore(s => s.addToast)
  const supabaseUrl    = useAppStore(s => s.supabaseUrl)
  const supabaseKey    = useAppStore(s => s.supabaseAnonKey)

  const handleLogin = async () => {
    if (!email.trim() || !password) { addToast({ type: 'error', title: 'Bitte E-Mail und Passwort eingeben.' }); return }
    const sb = getSupabase(supabaseUrl, supabaseKey)
    if (!sb) { addToast({ type: 'error', title: 'Supabase nicht konfiguriert.' }); return }

    setLoading(true)
    try {
      const { data, error: sbErr } = await sb.auth.signInWithPassword({ email: email.trim(), password })
      if (sbErr) { addToast({ type: 'error', title: 'Login fehlgeschlagen', body: sbErr.message }); return }
      const user = data.user
      // user_metadata is user-editable — used here for display only, not for authorization
      const meta = user?.user_metadata ?? {}
      // Switch file storage to this user's personal file and persist the user ID
      // in localStorage — setActiveStorageUser handles both atomically.
      setActiveStorageUser(user!.id)
      // Re-hydrate the store from the user-specific file (Zustand only reads storage once on
      // startup, so without this the user's saved config is never applied after login)
      await useAppStore.persist.rehydrate()
      // Mark session active BEFORE setCurrentUser so the Supabase watcher
      // doesn't immediately sign us back out when it sees the new session
      sessionStorage.setItem('cc-active-session', '1')
      localStorage.setItem('cc-active-session', '1')
      setCurrentUser({
        id:            user!.id,
        email:         user!.email ?? email,
        firstName:     (meta['first_name'] as string) ?? '',
        lastName:      (meta['last_name']  as string) ?? '',
        avatarDataUrl: (meta['avatar_data_url'] as string) ?? undefined,
      })
      setScreen('workspace')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter') handleLogin() }

  return (
    <div style={{ flex: 1, display: 'flex', background: 'var(--bg-0)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 70, zIndex: 10, WebkitAppRegion: 'drag' } as React.CSSProperties} />
      <AuthBackground id="login" />
      <AuthBrandPanel headline="Codera AI" />

      {/* ── Right panel ── */}
      <div style={{
        width: 420, padding: '56px 44px', display: 'flex', flexDirection: 'column',
        position: 'relative', zIndex: 1,
        background: 'linear-gradient(180deg, var(--bg-1) 0%, var(--bg-0) 100%)',
      }}>
        <div style={{ flex: 1 }} />

        <div>
          <h2 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 700, letterSpacing: -0.4, color: 'var(--fg-0)' }}>
            Willkommen zurück.
          </h2>
          <p style={{ margin: '0 0 24px', fontSize: 13, color: 'var(--fg-2)', lineHeight: 1.6 }}>
            Melde dich an und arbeite dort weiter, wo du aufgehört hast.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={fieldLabel}>E-Mail</label>
              <input
                style={fieldInput}
                type="email"
                placeholder="du@beispiel.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
              />
            </div>
            <div>
              <label style={fieldLabel}>Passwort</label>
              <PasswordInput
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
            <button onClick={handleLogin} disabled={loading} style={{ ...btnPrimary, marginTop: 4, opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Anmelden…' : 'Anmelden'}
            </button>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 2 }}>
              <button onClick={() => setScreen('register')} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                Konto erstellen
              </button>
            </div>
          </div>
        </div>

        <div style={{ flex: 1 }} />
      </div>
    </div>
  )
}
