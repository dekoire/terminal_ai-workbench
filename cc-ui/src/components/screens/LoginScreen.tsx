import { useState } from 'react'
import { useAppStore, setActiveStorageUser } from '../../store/useAppStore'
import { IShield, IGit, ITerminal, ISpark, IChev } from '../primitives/Icons'
import { getSupabase } from '../../lib/supabase'
import logoWhite from '../../assets/codera_logo_white.png'
import logoBlack from '../../assets/codera_logo_black.png'

export function LoginScreen() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [showLogin, setShowLogin] = useState(true)

  const setScreen      = useAppStore(s => s.setScreen)
  const setCurrentUser = useAppStore(s => s.setCurrentUser)
  const theme          = useAppStore(s => s.theme)
  const supabaseUrl    = useAppStore(s => s.supabaseUrl)
  const supabaseKey    = useAppStore(s => s.supabaseAnonKey)

  const handleLogin = async () => {
    if (!email.trim() || !password) { setError('Bitte E-Mail und Passwort eingeben.'); return }
    const sb = getSupabase(supabaseUrl, supabaseKey)
    if (!sb) { setError('Supabase nicht konfiguriert.'); return }

    setLoading(true); setError('')
    try {
      const { data, error: sbErr } = await sb.auth.signInWithPassword({ email: email.trim(), password })
      if (sbErr) { setError(sbErr.message); return }
      const user = data.user
      const meta = user?.user_metadata ?? {}
      // Switch file storage to this user's personal file — all writes from here go there
      setActiveStorageUser(user!.id)
      // Mark session active BEFORE setCurrentUser so the Supabase watcher
      // doesn't immediately sign us back out when it sees the new session
      sessionStorage.setItem('cc-active-session', '1')
      setCurrentUser({
        id: user!.id,
        email: user!.email ?? email,
        firstName: (meta['first_name'] as string) ?? '',
        lastName:  (meta['last_name']  as string) ?? '',
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

      {/* ── Background pattern ── */}
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <defs>
          {/* Dot grid */}
          <pattern id="dots" width="28" height="28" patternUnits="userSpaceOnUse">
            <circle cx="1.5" cy="1.5" r="1.2" fill="var(--line)" opacity="0.6" />
          </pattern>
          {/* Radial fade mask — bright center, fades to edges */}
          <radialGradient id="fade" cx="50%" cy="50%" r="70%">
            <stop offset="0%"   stopColor="var(--bg-0)" stopOpacity="0" />
            <stop offset="100%" stopColor="var(--bg-0)" stopOpacity="1" />
          </radialGradient>
          {/* Diagonal accent lines */}
          <pattern id="diag" width="60" height="60" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
            <line x1="0" y1="0" x2="0" y2="60" stroke="var(--accent)" strokeWidth="0.3" opacity="0.18" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dots)" />
        <rect width="100%" height="100%" fill="url(#diag)" />
        <rect width="100%" height="100%" fill="url(#fade)" />
      </svg>

      {/* ── Left brand panel ── */}
      <div style={{
        flex: 1, padding: '48px 56px', display: 'flex', flexDirection: 'column',
        position: 'relative', zIndex: 1, borderRight: '1px solid var(--line)',
      }}>
        <div style={{ marginBottom: 0 }}>
          <img src={theme === 'light' ? logoBlack : logoWhite} alt="Codera AI" style={{ height: 60, width: 'auto', display: 'block' }} />
        </div>
        <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, letterSpacing: 0.3, margin: '-16px 0 0', paddingLeft: 47 }}>AI Development IDE</span>

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

        {/* Bottom left — secret login trigger */}
        <div
          onClick={() => setShowLogin(v => !v)}
          style={{ fontSize: 10.5, color: 'var(--fg-3)', cursor: 'default', userSelect: 'none' }}
        >
          © 2025 Codera AI
        </div>
      </div>

      {/* ── Right panel ── */}
      <div style={{
        width: 420, padding: '56px 44px', display: 'flex', flexDirection: 'column',
        position: 'relative', zIndex: 1,
        background: 'linear-gradient(180deg, var(--bg-1) 0%, var(--bg-0) 100%)',
      }}>
        <div style={{ flex: 1 }} />

        {showLogin ? (
          /* ── Hidden login form ── */
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
                <input style={fieldInput} type="email" placeholder="du@beispiel.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={handleKeyDown} autoFocus />
              </div>
              <div>
                <label style={fieldLabel}>Passwort</label>
                <input style={fieldInput} type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={handleKeyDown} />
              </div>
              {error && (
                <div style={{ fontSize: 11.5, color: 'var(--err)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, padding: '8px 10px' }}>
                  {error}
                </div>
              )}
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
        ) : (
          /* ── Default: localhost start ── */
          <div>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--fg-3)', fontWeight: 500, marginBottom: 10 }}>Bereit</div>
            <h2 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 700, letterSpacing: -0.4, color: 'var(--fg-0)' }}>
              Los geht's.
            </h2>
            <p style={{ margin: '0 0 28px', fontSize: 12.5, color: 'var(--fg-2)', lineHeight: 1.6 }}>
              Starte lokal und arbeite sofort mit deinen Projekten. Alle Daten bleiben auf diesem Gerät.
            </p>

            {/* Localhost badge */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 12px', borderRadius: 8, background: 'var(--bg-2)', border: '1px solid var(--line-strong)', marginBottom: 28 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#28c941', flexShrink: 0, boxShadow: '0 0 6px #28c941aa' }} />
              <span className="mono" style={{ fontSize: 12, color: 'var(--fg-1)' }}>localhost</span>
            </div>

            <button
              onClick={() => setScreen('workspace')}
              style={{ ...btnPrimary, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              Codera AI starten
              <IChev style={{ width: 14, height: 14 }} />
            </button>
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
