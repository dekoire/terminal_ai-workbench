import { useState } from 'react'
import { useAppStore, setActiveStorageUser } from '../../store/useAppStore'
import { getSupabase } from '../../lib/supabase'
import { AuthBackground, AuthBrandPanel, PasswordInput, fieldLabel, fieldInput, btnPrimary } from './AuthShared'

export function RegisterScreen() {
  const [firstName, setFirstName] = useState('')
  const [lastName,  setLastName]  = useState('')
  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [password2, setPassword2] = useState('')
  const [loading,   setLoading]   = useState(false)
  const [success,   setSuccess]   = useState(false)

  const setScreen      = useAppStore(s => s.setScreen)
  const setCurrentUser = useAppStore(s => s.setCurrentUser)
  const addToast       = useAppStore(s => s.addToast)
  const supabaseUrl    = useAppStore(s => s.supabaseUrl)
  const supabaseKey    = useAppStore(s => s.supabaseAnonKey)

  const handleRegister = async () => {
    if (!firstName.trim())      { addToast({ type: 'error', title: 'Bitte Vorname eingeben.' }); return }
    if (!lastName.trim())       { addToast({ type: 'error', title: 'Bitte Nachname eingeben.' }); return }
    if (!email.trim())          { addToast({ type: 'error', title: 'Bitte E-Mail-Adresse eingeben.' }); return }
    if (!password)              { addToast({ type: 'error', title: 'Bitte Passwort eingeben.' }); return }
    if (password.length < 8)    { addToast({ type: 'error', title: 'Passwort muss mindestens 8 Zeichen lang sein.' }); return }
    if (password !== password2) { addToast({ type: 'error', title: 'Passwörter stimmen nicht überein.' }); return }

    const sb = getSupabase(supabaseUrl, supabaseKey)
    if (!sb) { addToast({ type: 'error', title: 'Supabase nicht konfiguriert.' }); return }

    setLoading(true)
    try {
      const { data, error: sbErr } = await sb.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { first_name: firstName.trim(), last_name: lastName.trim() } },
      })
      if (sbErr) { addToast({ type: 'error', title: 'Registrierung fehlgeschlagen', body: sbErr.message }); return }

      // Session returned immediately (no email confirmation required)
      if (data.session && data.user) {
        const user = data.user
        // user_metadata is user-editable — used here for display only, not for authorization
        const meta = user.user_metadata ?? {}
        // Mirror the same session-establishment flow as LoginScreen to prevent reload-logout
        setActiveStorageUser(user.id)
        await useAppStore.persist.rehydrate()
        localStorage.setItem('cc-active-session', '1')
        sessionStorage.setItem('cc-active-session', '1')
        setCurrentUser({
          id:            user.id,
          email:         user.email ?? email,
          firstName:     (meta['first_name'] as string) ?? firstName,
          lastName:      (meta['last_name']  as string) ?? lastName,
          avatarDataUrl: undefined,
        })
        setScreen('workspace')
      } else {
        // Email confirmation required
        setSuccess(true)
        addToast({ type: 'success', title: 'Fast geschafft!', body: 'Bestätigungs-E-Mail wurde gesendet. Bitte E-Mail prüfen.', duration: 0 })
      }
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter') handleRegister() }

  const pwMatch    = password2.length > 0 && password === password2
  const pwMismatch = password2.length > 0 && password !== password2

  return (
    <div style={{ flex: 1, display: 'flex', background: 'var(--bg-0)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 70, zIndex: 10, WebkitAppRegion: 'drag' } as React.CSSProperties} />
      <AuthBackground id="register" />
      <AuthBrandPanel headline={<>KI-Coding.<br /><span style={{ color: 'var(--accent)' }}>Zentral gesteuert.</span></>} />

      {/* ── Right panel ── */}
      <div style={{
        width: 460, padding: '56px 44px', display: 'flex', flexDirection: 'column',
        position: 'relative', zIndex: 1,
        background: 'linear-gradient(180deg, var(--bg-1) 0%, var(--bg-0) 100%)',
      }}>
        <div style={{ flex: 1 }} />

        {success ? (
          /* ── Success state ── */
          <div>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--accent-soft)', border: '1px solid var(--accent-line)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, fontSize: 22 }}>
              ✉️
            </div>
            <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 700, letterSpacing: -0.4, color: 'var(--fg-0)' }}>
              Fast geschafft.
            </h2>
            <p style={{ margin: '0 0 24px', fontSize: 13, color: 'var(--fg-2)', lineHeight: 1.65 }}>
              Wir haben dir eine Bestätigungs-E-Mail an <strong style={{ color: 'var(--fg-0)' }}>{email}</strong> geschickt. Bitte klick den Link darin, um deinen Account zu aktivieren.
            </p>
            <button onClick={() => setScreen('login')} style={{ ...btnPrimary }}>
              Zum Login
            </button>
          </div>
        ) : (
          /* ── Registration form ── */
          <div>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--fg-3)', fontWeight: 500, marginBottom: 8 }}>Neues Konto</div>
            <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 600, letterSpacing: -0.3, color: 'var(--fg-0)' }}>
              Account erstellen.
            </h2>
            <p style={{ margin: '0 0 22px', fontSize: 12, color: 'var(--fg-2)' }}>
              Kostenlos · synchronisiert Aliases, Templates und Verlauf.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {/* Name row */}
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={fieldLabel}>Vorname</label>
                  <input style={fieldInput} type="text" placeholder="Max" value={firstName} onChange={e => setFirstName(e.target.value)} onKeyDown={handleKeyDown} autoFocus />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={fieldLabel}>Nachname</label>
                  <input style={fieldInput} type="text" placeholder="Mustermann" value={lastName} onChange={e => setLastName(e.target.value)} onKeyDown={handleKeyDown} />
                </div>
              </div>

              {/* Email */}
              <div>
                <label style={fieldLabel}>E-Mail</label>
                <input style={fieldInput} type="email" placeholder="du@beispiel.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={handleKeyDown} />
              </div>

              {/* Password */}
              <div>
                <label style={fieldLabel}>Passwort</label>
                <PasswordInput value={password} onChange={e => setPassword(e.target.value)} onKeyDown={handleKeyDown} placeholder="Mindestens 8 Zeichen" />
              </div>

              {/* Password confirm */}
              <div>
                <label style={{ ...fieldLabel, display: 'flex', alignItems: 'center', gap: 6 }}>
                  Passwort wiederholen
                  {pwMatch    && <span style={{ color: 'var(--ok)',  fontSize: 10, fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>✓ Übereinstimmend</span>}
                  {pwMismatch && <span style={{ color: 'var(--err)', fontSize: 10, fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>✗ Stimmt nicht überein</span>}
                </label>
                <PasswordInput
                  value={password2}
                  onChange={e => setPassword2(e.target.value)}
                  onKeyDown={handleKeyDown}
                  style={{ borderColor: pwMismatch ? 'var(--err)' : pwMatch ? 'var(--ok)' : 'var(--line-strong)' }}
                />
              </div>

              <button onClick={handleRegister} disabled={loading} style={{ ...btnPrimary, marginTop: 4, opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Erstelle Account…' : 'Account erstellen'}
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', marginTop: 2 }}>
                <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>Bereits ein Konto?</span>
                <button onClick={() => setScreen('login')} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                  Anmelden
                </button>
              </div>
            </div>
          </div>
        )}

        <div style={{ flex: 1 }} />
      </div>
    </div>
  )
}
