import React, { useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { ITerminal, IShield, IGit, ISend, IChev, IWarn } from '../primitives/Icons'

type Variant = 'default' | 'token' | 'error'

export function LoginScreen() {
  const [variant, setVariant] = useState<Variant>('default')
  const setScreen = useAppStore(s => s.setScreen)

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{
            width: 28, height: 28, borderRadius: 6, background: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-fg)',
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 5l3 3-3 3M9 11h4"/>
            </svg>
          </span>
          <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--fg-0)', letterSpacing: -0.2 }}>Codera AI</span>
        </div>
        <span style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 40, marginLeft: 38 }}>v0.1.0 · macOS · arm64</span>

        <div style={{ flex: 1 }} />
        <div style={{ maxWidth: 360 }}>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 600, letterSpacing: -0.6, color: 'var(--fg-0)', lineHeight: 1.15 }}>
            A workbench for<br/>
            <span style={{ color: 'var(--accent)' }}>CLI coding agents.</span>
          </h1>
          <p style={{ margin: '14px 0 0', color: 'var(--fg-2)', fontSize: 13, lineHeight: 1.55 }}>
            Wrap claude, codex, aider, minimax — any CLI agent — in one terminal-forward UI. Sessions, aliases, permission modes, prompt templates.
          </p>
          <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <FeatureRow icon={<ITerminal />} label="Native terminal output · color-coded turns" />
            <FeatureRow icon={<IShield />} label="Per-session permission modes" />
            <FeatureRow icon={<IGit />} label="Worktree-aware project tree" />
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 10.5, color: 'var(--fg-3)' }}>
          <span>© Codera AI</span>
          <span>·</span>
          <a style={loginLink} href="#">Docs</a>
          <a style={loginLink} href="#">GitHub</a>
          <a style={loginLink} href="#">Privacy</a>
        </div>
      </div>

      {/* Right form panel */}
      <div style={{
        width: 440, padding: '56px 44px', display: 'flex', flexDirection: 'column',
        background: 'var(--bg-1)', position: 'relative', zIndex: 1,
      }}>
        <div style={{ flex: 1 }} />
        <div>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--fg-3)', fontWeight: 500, marginBottom: 8 }}>Sign in</div>
          <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 600, letterSpacing: -0.3, color: 'var(--fg-0)' }}>
            Welcome back.
          </h2>
          <p style={{ margin: '0 0 26px', fontSize: 12, color: 'var(--fg-2)' }}>
            Sign in to sync aliases, prompt templates, and history across machines.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <ProviderButton tone="primary" label="Continue with Anthropic" sub="user@example.com" onClick={() => setScreen('workspace')} />
            <ProviderButton label="Continue with GitHub" icon={<GhMark />} onClick={() => setScreen('workspace')} />
            <ProviderButton label="Continue with Google" icon={<GoogleMark />} onClick={() => setScreen('workspace')} />
          </div>

          <Divider>or</Divider>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={fieldLabel}>Email</label>
              <input style={fieldInput} placeholder="you@example.com" />
            </div>

            {variant === 'token' && (
              <div>
                <label style={fieldLabel}>
                  CLI token&nbsp;
                  <span style={{ color: 'var(--fg-3)', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>
                    · paste from <span className="mono">claude auth print-token</span>
                  </span>
                </label>
                <input style={fieldInput} placeholder="cct_live_…" />
              </div>
            )}

            {variant === 'error' && (
              <div style={{
                display: 'flex', gap: 8, alignItems: 'flex-start',
                padding: '8px 10px', borderRadius: 6,
                background: 'rgba(239,122,122,0.08)', border: '1px solid rgba(239,122,122,0.30)',
                color: 'var(--err)', fontSize: 11.5,
              }}>
                <IWarn style={{ flexShrink: 0, marginTop: 1 }} />
                <span>Token rejected. Run <span className="mono">claude auth login</span> in your terminal and paste the new token.</span>
              </div>
            )}

            <button
              onClick={() => setScreen('workspace')}
              style={{ ...btnPrimary, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              {variant === 'token' ? 'Verify token' : 'Send magic link'}
              <ISend />
            </button>

            <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--fg-2)' }}>
              {variant === 'token'
                ? <button style={textLink} onClick={() => setVariant('default')}>Back to email sign-in</button>
                : <button style={textLink} onClick={() => setVariant('token')}>Sign in with CLI token instead</button>
              }
            </div>
          </div>
        </div>
        <div style={{ flex: 1 }} />

        {/* Skip — local mode */}
        <div style={{
          marginTop: 28, padding: '12px 14px', borderRadius: 6,
          background: 'var(--bg-2)', border: '1px dashed var(--line-strong)',
        }}>
          <div style={{ fontSize: 11.5, color: 'var(--fg-1)', marginBottom: 4, fontWeight: 500 }}>Skip — work locally</div>
          <div style={{ fontSize: 11, color: 'var(--fg-2)', marginBottom: 8, lineHeight: 1.5 }}>
            All projects, sessions and aliases stay on this machine. You can sign in any time.
          </div>
          <button onClick={() => setScreen('workspace')} style={{
            background: 'transparent', color: 'var(--fg-0)',
            border: '1px solid var(--line-strong)', padding: '5px 10px',
            borderRadius: 5, fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-ui)',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            Continue offline <IChev />
          </button>
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

function ProviderButton({ tone, label, sub, icon, onClick }: { tone?: string; label: string; sub?: string; icon?: React.ReactNode; onClick?: () => void }) {
  const isPrimary = tone === 'primary'
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '9px 12px', borderRadius: 6, cursor: 'pointer',
      fontFamily: 'var(--font-ui)', fontSize: 12, textAlign: 'left', width: '100%',
      background: isPrimary ? 'var(--accent-soft)' : 'var(--bg-2)',
      border: `1px solid ${isPrimary ? 'var(--accent-line)' : 'var(--line-strong)'}`,
      color: isPrimary ? 'var(--accent)' : 'var(--fg-0)',
    }}>
      <span style={{ width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', color: isPrimary ? 'var(--accent)' : 'var(--fg-1)' }}>
        {icon || (
          <span style={{ width: 14, height: 14, borderRadius: 3, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-fg)' }}>
            <svg width="9" height="9" viewBox="0 0 12 12" fill="currentColor"><path d="M6 1L7.5 4.5 11 6 7.5 7.5 6 11 4.5 7.5 1 6 4.5 4.5z"/></svg>
          </span>
        )}
      </span>
      <span style={{ flex: 1, fontWeight: isPrimary ? 600 : 500 }}>{label}</span>
      {sub && <span className="mono" style={{ fontSize: 11, color: isPrimary ? 'var(--accent)' : 'var(--fg-2)', opacity: 0.8 }}>{sub}</span>}
    </button>
  )
}

function Divider({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '20px 0', color: 'var(--fg-3)' }}>
      <span style={{ flex: 1, height: 1, background: 'var(--line)' }}/>
      <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8 }}>{children}</span>
      <span style={{ flex: 1, height: 1, background: 'var(--line)' }}/>
    </div>
  )
}

function GhMark() {
  return <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 0 0-2.2 13.6c.35.06.48-.15.48-.34v-1.2c-1.95.42-2.36-.94-2.36-.94-.32-.81-.78-1.03-.78-1.03-.64-.43.05-.42.05-.42.7.05 1.07.72 1.07.72.62 1.07 1.64.76 2.04.58.06-.45.24-.76.44-.94-1.55-.18-3.19-.78-3.19-3.45 0-.76.27-1.39.72-1.88-.07-.18-.31-.9.07-1.87 0 0 .58-.19 1.91.72A6.5 6.5 0 0 1 8 4.5c.6 0 1.2.08 1.76.24 1.33-.91 1.91-.72 1.91-.72.38.97.14 1.69.07 1.87.45.49.72 1.12.72 1.88 0 2.68-1.64 3.27-3.2 3.45.25.22.48.65.48 1.31v1.95c0 .19.13.41.49.34A7 7 0 0 0 8 1z"/></svg>
}

function GoogleMark() {
  return <svg width="14" height="14" viewBox="0 0 16 16"><path fill="#EA4335" d="M8 6.5v3.1h4.4c-.2 1.05-1.5 3.1-4.4 3.1-2.65 0-4.8-2.2-4.8-4.9s2.15-4.9 4.8-4.9c1.5 0 2.5.6 3.1 1.2l2.1-2.05C11.85 1 10.05.2 8 .2 3.95.2.7 3.45.7 7.5S3.95 14.8 8 14.8c4.6 0 7.65-3.25 7.65-7.8 0-.5-.05-.9-.15-1.3H8z"/></svg>
}

const loginLink: React.CSSProperties = { color: 'var(--fg-1)', borderBottom: '1px dotted var(--line-strong)', paddingBottom: 1 }
const textLink: React.CSSProperties = { background: 'transparent', border: 'none', color: 'var(--fg-2)', cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font-ui)', textDecoration: 'underline' }
const fieldLabel: React.CSSProperties = { display: 'block', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.7, color: 'var(--fg-3)', fontWeight: 500, marginBottom: 6 }
const fieldInput: React.CSSProperties = { width: '100%', padding: '7px 10px', border: '1px solid var(--line-strong)', borderRadius: 6, background: 'var(--bg-2)', color: 'var(--fg-0)', fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none' }
const btnPrimary: React.CSSProperties = { background: 'var(--accent)', color: 'var(--accent-fg)', border: 'none', padding: '9px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)', width: '100%' }
