import { useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { IShield, IGit, IChev, ITerminal } from '../primitives/Icons'
import logoWhite from '../../assets/codera_logo_white.png'
import logoBlack from '../../assets/codera_logo_black.png'

export function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const setScreen  = useAppStore(s => s.setScreen)
  const theme      = useAppStore(s => s.theme)
  const logoSize   = useAppStore(s => s.logoSize)

  return (
    <div style={{
      flex: 1, display: 'flex', background: 'var(--bg-0)', position: 'relative', overflow: 'hidden',
    }}>
      {/* Grid backdrop */}
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.4, pointerEvents: 'none' }}>
        <defs>
          <pattern id="lg" width="36" height="36" patternUnits="userSpaceOnUse">
            <path d="M36 0H0V36" fill="none" stroke="var(--line)" strokeWidth="0.6"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#lg)"/>
      </svg>

      {/* Left brand panel */}
      <div style={{
        flex: 1, padding: '48px 56px', display: 'flex', flexDirection: 'column',
        position: 'relative', borderRight: '1px solid var(--line)',
        background: 'linear-gradient(180deg, var(--bg-0) 0%, var(--bg-1) 100%)',
      }}>
        <div style={{ marginBottom: 6 }}>
          <img src={theme === 'light' ? logoBlack : logoWhite} alt="Codera AI" style={{ height: 63, width: 'auto', display: 'block' }} />
        </div>
        <span style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 40 }}>v0.1.0 · macOS · arm64</span>

        <div style={{ flex: 1 }} />
        <div style={{ maxWidth: 360 }}>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 600, letterSpacing: -0.6, color: 'var(--fg-0)', lineHeight: 1.15 }}>
            Die Workbench für<br/>
            <span style={{ color: 'var(--accent)' }}>KI-Coding-Agenten.</span>
          </h1>
          <p style={{ margin: '14px 0 0', color: 'var(--fg-2)', fontSize: 13, lineHeight: 1.55 }}>
            Claude Code, aider, DeepSeek und mehr — alle CLI-Agenten in einer terminal-nativen Oberfläche. Sessions, Aliases, Berechtigungsmodi und Prompt-Vorlagen.
          </p>
          <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <FeatureRow icon={<ITerminal />} label="Natives Terminal · farbcodierte Gesprächsrunden" />
            <FeatureRow icon={<IShield />} label="Berechtigungsmodi pro Session" />
            <FeatureRow icon={<IGit />} label="Worktree-bewusster Projektbaum" />
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>© 2025 Codera AI</div>
      </div>

      {/* Right form panel */}
      <div style={{
        width: 440, padding: '56px 44px', display: 'flex', flexDirection: 'column',
        background: 'var(--bg-1)', position: 'relative', zIndex: 1,
      }}>
        <div style={{ flex: 1 }} />

        <div>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--fg-3)', fontWeight: 500, marginBottom: 8 }}>Anmelden</div>
          <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 600, letterSpacing: -0.3, color: 'var(--fg-0)' }}>
            Willkommen zurück.
          </h2>
          <p style={{ margin: '0 0 26px', fontSize: 12, color: 'var(--fg-2)' }}>
            Melde dich an, um Aliases, Prompt-Templates und Verlauf geräteübergreifend zu synchronisieren.
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
              />
            </div>
            <div>
              <label style={fieldLabel}>Passwort</label>
              <input
                style={fieldInput}
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>

            <button
              onClick={() => setScreen('workspace')}
              style={{ ...btnPrimary, marginTop: 4 }}
            >
              Anmelden
            </button>
          </div>
        </div>

        <div style={{ flex: 1 }} />

        {/* Local mode — prominent */}
        <div
          onClick={() => setScreen('workspace')}
          style={{
            marginTop: 32, padding: '16px 18px', borderRadius: 8, cursor: 'pointer',
            background: 'var(--bg-2)', border: '1px solid var(--line-strong)',
            transition: 'border-color 0.15s',
          }}
        >
          {/* Traffic lights + localhost pill */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ display: 'flex', gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f57' }} />
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ffbd2e' }} />
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#28c941' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 4, background: 'var(--bg-3)', border: '1px solid var(--line)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#28c941', flexShrink: 0 }} />
              <span className="mono" style={{ fontSize: 11, color: 'var(--fg-1)' }}>localhost:4321</span>
            </div>
          </div>

          <div style={{ fontSize: 12, color: 'var(--fg-0)', fontWeight: 600, marginBottom: 4 }}>
            Lokal arbeiten
          </div>
          <div style={{ fontSize: 11, color: 'var(--fg-2)', lineHeight: 1.5 }}>
            Alle Projekte, Sessions und Aliases bleiben auf diesem Gerät. Anmelden jederzeit möglich.
          </div>
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--accent)', fontWeight: 500 }}>
            Ohne Anmeldung starten
            <IChev style={{ width: 12, height: 12 }} />
          </div>
        </div>
      </div>
    </div>
  )
}

function FeatureRow({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12, color: 'var(--fg-1)' }}>
      <span style={{
        width: 22, height: 22, borderRadius: 5, background: 'var(--bg-2)',
        border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)',
      }}>{icon}</span>
      {label}
    </div>
  )
}

const fieldLabel: React.CSSProperties = { display: 'block', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.7, color: 'var(--fg-3)', fontWeight: 500, marginBottom: 6 }
const fieldInput: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid var(--line-strong)', borderRadius: 6, background: 'var(--bg-2)', color: 'var(--fg-0)', fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none', boxSizing: 'border-box' }
const btnPrimary: React.CSSProperties = { background: 'var(--accent)', color: 'var(--accent-fg)', border: 'none', padding: '10px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)', width: '100%' }
