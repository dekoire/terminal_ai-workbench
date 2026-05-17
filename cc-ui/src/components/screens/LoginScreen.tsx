import { useState } from 'react'
import { useAppStore, setActiveStorageUser } from '../../store/useAppStore'
import { IShield, IGit, ITerminal, ISpark, IChev, ISpinner, IEye, IEyeOff } from '../primitives/Icons'
import { getSupabase } from '../../lib/supabase'

export function LoginScreen() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [showLogin, setShowLogin] = useState(true)
  const [showPw, setShowPw]     = useState(false)

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
      const meta = user?.user_metadata ?? {}
      // Switch file storage to this user's personal file — all writes from here go there
      setActiveStorageUser(user!.id)
      // Persist user ID in localStorage so the file-storage bootstrap can find the
      // user-specific file on the next page reload (shared file may have null currentUser)
      localStorage.setItem('cc-user-id', user!.id)
      // Re-hydrate the store from the user-specific file (Zustand only reads storage once on
      // startup, so without this the user's saved config is never applied after login)
      await useAppStore.persist.rehydrate()
      // Mark session active BEFORE setCurrentUser so the Supabase watcher
      // doesn't immediately sign us back out when it sees the new session
      sessionStorage.setItem('cc-active-session', '1')
      localStorage.setItem('cc-active-session', '1')
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
          <pattern id="dots" width="28" height="28" patternUnits="userSpaceOnUse">
            <circle cx="1.5" cy="1.5" r="1.4" fill="var(--fg-3)" opacity="0.75" />
          </pattern>
          <radialGradient id="fade" cx="50%" cy="50%" r="65%">
            <stop offset="0%"   stopColor="var(--bg-0)" stopOpacity="0" />
            <stop offset="60%"  stopColor="var(--bg-0)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="var(--bg-0)" stopOpacity="1" />
          </radialGradient>
          <radialGradient id="inner" cx="30%" cy="50%" r="45%">
            <stop offset="50%"  stopColor="var(--bg-0)" stopOpacity="0" />
            <stop offset="100%" stopColor="var(--bg-0)" stopOpacity="0.55" />
          </radialGradient>
          <filter id="glow-l" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="6" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <rect width="100%" height="100%" fill="url(#dots)" />
        {/* Accent dots */}
        {([
          { cx: 85.5,   cy: 141.5, dur: '3.2s', begin: '0s'   },
          { cx: 477.5,  cy: 85.5,  dur: '2.8s', begin: '1.4s' },
          { cx: 925.5,  cy: 477.5, dur: '3.6s', begin: '0.3s' },
          { cx: 365.5,  cy: 589.5, dur: '2.5s', begin: '2.5s' },
          { cx: 813.5,  cy: 365.5, dur: '3.3s', begin: '3.2s' },
          { cx: 141.5,  cy: 477.5, dur: '4.2s', begin: '2.8s' },
          { cx: 477.5,  cy: 813.5, dur: '5.2s', begin: '3.5s' },
          { cx: 701.5,  cy: 57.5,  dur: '2.6s', begin: '1.6s' },
          { cx: 253.5,  cy: 701.5, dur: '4.6s', begin: '4.5s' },
          { cx: 1093.5, cy: 421.5, dur: '3.8s', begin: '1.0s' },
          { cx: 589.5,  cy: 309.5, dur: '4.0s', begin: '5.5s' },
        ] as const).map((d, i) => (
          <circle key={`a${i}`} cx={d.cx} cy={d.cy} r="2.5" fill="var(--accent)" opacity="0" filter="url(#glow-l)">
            <animate attributeName="opacity" values="0;1;0" dur={d.dur} begin={d.begin} repeatCount="indefinite" />
          </circle>
        ))}
        {/* Blue dots */}
        {([
          { cx: 253.5,  cy: 365.5, dur: '4.1s', begin: '0.7s' },
          { cx: 701.5,  cy: 253.5, dur: '5.0s', begin: '2.1s' },
          { cx: 1149.5, cy: 141.5, dur: '4.4s', begin: '1.8s' },
          { cx: 1037.5, cy: 589.5, dur: '2.9s', begin: '1.2s' },
          { cx: 57.5,   cy: 253.5, dur: '4.0s', begin: '2.2s' },
          { cx: 925.5,  cy: 813.5, dur: '3.9s', begin: '4.0s' },
          { cx: 533.5,  cy: 533.5, dur: '3.4s', begin: '6.0s' },
          { cx: 1205.5, cy: 673.5, dur: '4.7s', begin: '0.4s' },
        ] as const).map((d, i) => (
          <circle key={`b${i}`} cx={d.cx} cy={d.cy} r="2.5" fill="#3b82f6" opacity="0" filter="url(#glow-l)">
            <animate attributeName="opacity" values="0;1;0" dur={d.dur} begin={d.begin} repeatCount="indefinite" />
          </circle>
        ))}
        {/* Orange dots */}
        {([
          { cx: 589.5,  cy: 701.5, dur: '4.8s', begin: '0.9s' },
          { cx: 1261.5, cy: 365.5, dur: '3.7s', begin: '0.5s' },
          { cx: 1373.5, cy: 589.5, dur: '3.1s', begin: '3.8s' },
          { cx: 1037.5, cy: 253.5, dur: '4.3s', begin: '5.1s' },
          { cx: 365.5,  cy: 141.5, dur: '3.5s', begin: '1.9s' },
          { cx: 729.5,  cy: 673.5, dur: '5.4s', begin: '3.3s' },
          { cx: 197.5,  cy: 813.5, dur: '3.0s', begin: '4.8s' },
          { cx: 869.5,  cy: 197.5, dur: '4.5s', begin: '2.6s' },
        ] as const).map((d, i) => (
          <circle key={`o${i}`} cx={d.cx} cy={d.cy} r="2.5" fill="#f97316" opacity="0" filter="url(#glow-l)">
            <animate attributeName="opacity" values="0;1;0" dur={d.dur} begin={d.begin} repeatCount="indefinite" />
          </circle>
        ))}
        {/* Red dots */}
        {([
          { cx: 169.5,  cy: 309.5, dur: '3.6s', begin: '1.3s' },
          { cx: 645.5,  cy: 449.5, dur: '4.9s', begin: '3.7s' },
          { cx: 1093.5, cy: 729.5, dur: '3.2s', begin: '0.6s' },
          { cx: 421.5,  cy: 757.5, dur: '5.1s', begin: '2.9s' },
          { cx: 869.5,  cy: 533.5, dur: '2.7s', begin: '5.8s' },
          { cx: 1317.5, cy: 197.5, dur: '4.2s', begin: '1.5s' },
          { cx: 309.5,  cy: 197.5, dur: '3.8s', begin: '4.3s' },
        ] as const).map((d, i) => (
          <circle key={`r${i}`} cx={d.cx} cy={d.cy} r="2.5" fill="#ef4444" opacity="0" filter="url(#glow-l)">
            <animate attributeName="opacity" values="0;1;0" dur={d.dur} begin={d.begin} repeatCount="indefinite" />
          </circle>
        ))}
        {/* Green dots */}
        {([
          { cx: 421.5,  cy: 253.5, dur: '4.3s', begin: '2.0s' },
          { cx: 757.5,  cy: 589.5, dur: '3.5s', begin: '0.8s' },
          { cx: 1205.5, cy: 449.5, dur: '5.0s', begin: '3.1s' },
          { cx: 533.5,  cy: 757.5, dur: '2.9s', begin: '5.4s' },
          { cx: 981.5,  cy: 141.5, dur: '4.6s', begin: '1.7s' },
          { cx: 113.5,  cy: 645.5, dur: '3.3s', begin: '4.6s' },
          { cx: 1317.5, cy: 757.5, dur: '4.8s', begin: '6.2s' },
        ] as const).map((d, i) => (
          <circle key={`g${i}`} cx={d.cx} cy={d.cy} r="2.5" fill="#22c55e" opacity="0" filter="url(#glow-l)">
            <animate attributeName="opacity" values="0;1;0" dur={d.dur} begin={d.begin} repeatCount="indefinite" />
          </circle>
        ))}
        <rect width="100%" height="100%" fill="url(#inner)" />
        <rect width="100%" height="100%" fill="url(#fade)" />
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
            Codera AI
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
                <div style={{ position: 'relative' }}>
                  <input
                    style={{ ...fieldInput, paddingRight: 36 }}
                    type={showPw ? 'text' : 'password'}
                    placeholder="••••••••"
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
