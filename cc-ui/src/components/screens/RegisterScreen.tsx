import { useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { IShield, IGit, ITerminal, ISpark, ISpinner, IEye, IEyeOff } from '../primitives/Icons'
import { getSupabase } from '../../lib/supabase'

export function RegisterScreen() {
  const [firstName, setFirstName] = useState('')
  const [lastName,  setLastName]  = useState('')
  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [password2, setPassword2] = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [success,   setSuccess]   = useState(false)
  const [showPw,    setShowPw]    = useState(false)
  const [showPw2,   setShowPw2]   = useState(false)

  const setScreen      = useAppStore(s => s.setScreen)
  const setCurrentUser = useAppStore(s => s.setCurrentUser)

  const supabaseUrl    = useAppStore(s => s.supabaseUrl)
  const supabaseKey    = useAppStore(s => s.supabaseAnonKey)

  const handleRegister = async () => {
    setError('')
    if (!firstName.trim())             { setError('Bitte Vorname eingeben.'); return }
    if (!lastName.trim())              { setError('Bitte Nachname eingeben.'); return }
    if (!email.trim())                 { setError('Bitte E-Mail-Adresse eingeben.'); return }
    if (!password)                     { setError('Bitte Passwort eingeben.'); return }
    if (password.length < 8)           { setError('Passwort muss mindestens 8 Zeichen lang sein.'); return }
    if (password !== password2)        { setError('Passwörter stimmen nicht überein.'); return }

    const sb = getSupabase(supabaseUrl, supabaseKey)
    if (!sb) { setError('Supabase nicht konfiguriert.'); return }

    setLoading(true)
    try {
      const { data, error: sbErr } = await sb.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            first_name: firstName.trim(),
            last_name:  lastName.trim(),
          },
        },
      })
      if (sbErr) { setError(sbErr.message); return }

      // If session is returned immediately (no email confirmation required)
      if (data.session && data.user) {
        const user = data.user
        const meta = user.user_metadata ?? {}
        setCurrentUser({
          id:            user.id,
          email:         user.email ?? email,
          firstName:     (meta['first_name'] as string) ?? firstName,
          lastName:      (meta['last_name']  as string) ?? lastName,
          avatarDataUrl: undefined,
        })
        sessionStorage.setItem('cc-active-session', '1')
        setScreen('workspace')
      } else {
        // Email confirmation required
        setSuccess(true)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter') handleRegister() }

  const pwMatch = password2.length > 0 && password === password2
  const pwMismatch = password2.length > 0 && password !== password2

  return (
    <div style={{ flex: 1, display: 'flex', background: 'var(--bg-0)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 70, zIndex: 10, WebkitAppRegion: 'drag' } as React.CSSProperties} />

      {/* ── Background pattern ── */}
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <defs>
          <pattern id="dots-r" width="28" height="28" patternUnits="userSpaceOnUse">
            <circle cx="1.5" cy="1.5" r="1.2" fill="var(--line)" opacity="0.6" />
          </pattern>
          <radialGradient id="fade-r" cx="50%" cy="50%" r="70%">
            <stop offset="0%"   stopColor="var(--bg-0)" stopOpacity="0" />
            <stop offset="100%" stopColor="var(--bg-0)" stopOpacity="1" />
          </radialGradient>
          <pattern id="diag-r" width="60" height="60" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
            <line x1="0" y1="0" x2="0" y2="60" stroke="var(--accent)" strokeWidth="0.3" opacity="0.18" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dots-r)" />
        <rect width="100%" height="100%" fill="url(#diag-r)" />
        <rect width="100%" height="100%" fill="url(#fade-r)" />
      </svg>

      {/* ── Left brand panel ── */}
      <div style={{
        flex: 1, padding: '48px 56px', display: 'flex', flexDirection: 'column',
        position: 'relative', zIndex: 1, borderRight: '1px solid var(--line)',
      }}>
        <div style={{ marginBottom: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <ISpinner spin={false} size={34} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: 26, fontWeight: 700, color: 'var(--fg-0)', fontFamily: 'var(--font-ui)', letterSpacing: -0.3, lineHeight: 1 }}>Codera</span>
          </span>
        </div>

        <div style={{ flex: 1 }} />
        <div style={{ maxWidth: 380 }}>
          <h1 style={{ margin: '0 0 16px', fontSize: 32, fontWeight: 700, letterSpacing: -0.8, color: 'var(--fg-0)', lineHeight: 1.15 }}>
            KI-Coding.<br/>
            <span style={{ color: 'var(--accent)' }}>Zentral gesteuert.</span>
          </h1>
          <p style={{ margin: '0 0 28px', color: 'var(--fg-2)', fontSize: 13, lineHeight: 1.65 }}>
            Arbeite mit Claude Code, DeepSeek und weiteren Agenten in einer Oberfläche — inklusive Terminal, Projektkontext, Session-Verlauf, Prompt-Vorlagen und Git-Integration.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <FeatureRow icon={<ISpark />}    label="KI-Chat im Projektkontext" />
            <FeatureRow icon={<ITerminal />} label="Terminal mit Session-Verlauf" />
            <FeatureRow icon={<IShield />}   label="Modelle, Aliases & Templates verwalten" />
            <FeatureRow icon={<IGit />}      label="Git-Workflow direkt im Workspace" />
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>© 2025 Codera AI</span>
      </div>

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
                  <input
                    style={fieldInput}
                    type="text"
                    placeholder="Max"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    autoFocus
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={fieldLabel}>Nachname</label>
                  <input
                    style={fieldInput}
                    type="text"
                    placeholder="Mustermann"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    onKeyDown={handleKeyDown}
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label style={fieldLabel}>E-Mail</label>
                <input
                  style={fieldInput}
                  type="email"
                  placeholder="du@beispiel.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
              </div>

              {/* Password */}
              <div>
                <label style={fieldLabel}>Passwort</label>
                <div style={{ position: 'relative' }}>
                  <input
                    style={{ ...fieldInput, paddingRight: 36 }}
                    type={showPw ? 'text' : 'password'}
                    placeholder="Mindestens 8 Zeichen"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onKeyDown={handleKeyDown}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-3)', padding: 2, display: 'flex', alignItems: 'center' }}
                    tabIndex={-1}
                  >
                    {showPw ? <IEyeOff style={{ width: 15, height: 15 }} /> : <IEye style={{ width: 15, height: 15 }} />}
                  </button>
                </div>
              </div>

              {/* Password repeat */}
              <div>
                <label style={{ ...fieldLabel, display: 'flex', alignItems: 'center', gap: 6 }}>
                  Passwort wiederholen
                  {pwMatch    && <span style={{ color: 'var(--ok)',  fontSize: 10, fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>✓ Übereinstimmend</span>}
                  {pwMismatch && <span style={{ color: 'var(--err)', fontSize: 10, fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>✗ Stimmt nicht überein</span>}
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    style={{
                      ...fieldInput,
                      paddingRight: 36,
                      borderColor: pwMismatch ? 'var(--err)' : pwMatch ? 'var(--ok)' : undefined,
                      outline: 'none',
                    }}
                    type={showPw2 ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password2}
                    onChange={e => setPassword2(e.target.value)}
                    onKeyDown={handleKeyDown}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw2(v => !v)}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-3)', padding: 2, display: 'flex', alignItems: 'center' }}
                    tabIndex={-1}
                  >
                    {showPw2 ? <IEyeOff style={{ width: 15, height: 15 }} /> : <IEye style={{ width: 15, height: 15 }} />}
                  </button>
                </div>
              </div>

              {error && (
                <div style={{ fontSize: 11.5, color: 'var(--err)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, padding: '8px 10px' }}>
                  {error}
                </div>
              )}

              <button
                onClick={handleRegister}
                disabled={loading}
                style={{ ...btnPrimary, marginTop: 4, opacity: loading ? 0.7 : 1 }}
              >
                {loading ? 'Erstelle Account…' : 'Account erstellen'}
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', marginTop: 2 }}>
                <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>Bereits ein Konto?</span>
                <button
                  onClick={() => setScreen('login')}
                  style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: 0 }}
                >
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

function FeatureRow({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: 'var(--fg-1)' }}>
      <span style={{
        width: 24, height: 24, borderRadius: 6, background: 'var(--bg-2)', flexShrink: 0,
        border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)',
      }}>{icon}</span>
      {label}
    </div>
  )
}

const fieldLabel: React.CSSProperties = { display: 'block', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.7, color: 'var(--fg-3)', fontWeight: 500, marginBottom: 6 }
const fieldInput: React.CSSProperties = { width: '100%', padding: '9px 11px', border: '1px solid var(--line-strong)', borderRadius: 6, background: 'var(--bg-2)', color: 'var(--fg-0)', fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none', boxSizing: 'border-box' }
const btnPrimary: React.CSSProperties = { background: 'var(--accent)', color: 'var(--accent-fg)', border: 'none', padding: '11px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)', width: '100%' }
