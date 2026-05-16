import { useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { IExternalLink, ICheck, IChevDown, IChevUp, IClose, IGit, ISpinner } from '../primitives/Icons'
import simpleLogo from '../../assets/simple_logo.svg'
import heroEmber    from '../../assets/onboarding-hero_ember.webp'
import heroCobalt   from '../../assets/onboarding-hero_cobalt.webp'
import heroMidnight from '../../assets/onboarding-hero_midnight.webp'
import heroForest   from '../../assets/onboarding-hero_forest.webp'
import heroRose     from '../../assets/onboarding-hero_rose.webp'
import heroCrimson  from '../../assets/onboarding-hero_crimson.webp'

const HERO_MAP: Record<string, string> = {
  ember:          heroEmber,
  'ember-light':  heroEmber,
  cobalt:         heroCobalt,
  'cobalt-light': heroCobalt,
  midnight:       heroMidnight,
  'midnight-light': heroMidnight,
  forest:         heroForest,
  'forest-light': heroForest,
  rose:           heroRose,
  'rose-light':   heroRose,
  crimson:        heroCrimson,
  'crimson-light': heroCrimson,
}

interface Props {
  onClose: () => void
}

const TOTAL_STEPS = 4

const MODEL_PRESETS = [
  { id: 'anthropic/claude-sonnet-4-6', label: 'Claude Sonnet 4.6', group: 'Anthropic', color: '#d97706' },
  { id: 'openai/gpt-4o',               label: 'GPT-4o',             group: 'OpenAI',    color: '#10a37f' },
  { id: 'google/gemini-2.0-flash-001', label: 'Gemini 2.0 Flash',   group: 'Google',    color: '#4285f4' },
  { id: 'moonshotai/kimi-k2',          label: 'Kimi K2',            group: 'Moonshot',  color: '#7c3aed' },
  { id: 'deepseek/deepseek-r2',        label: 'DeepSeek R2',        group: 'DeepSeek',  color: '#06b6d4' },
  { id: 'x-ai/grok-3',                label: 'Grok 3',             group: 'xAI',       color: '#e11d48' },
  { id: 'meta-llama/llama-4-maverick', label: 'Llama 4 Maverick',   group: 'Meta',      color: '#1d4ed8' },
  { id: 'mistralai/mistral-large',     label: 'Mistral Large',      group: 'Mistral',   color: '#f59e0b' },
] as const

export function GettingStartedModal({ onClose }: Props) {
  const {
    openrouterKey, setOpenrouterKey,
    preferredOrModels, setPreferredOrModels,
    setSetupWizardDone,
    githubToken: storedGhToken, setGithubToken,
    tokens: repoTokens, addToken, updateToken,
    theme, preset,
  } = useAppStore()

  const existingGhTokenEntry = repoTokens.find(t => t.host === 'github.com')
  const existingGhToken = existingGhTokenEntry?.token || storedGhToken

  const [step, setStep] = useState(0)
  const [localKey, setLocalKey] = useState(openrouterKey)
  const [selectedModels, setSelectedModels] = useState<string[]>(
    preferredOrModels.length > 0
      ? preferredOrModels
      : [MODEL_PRESETS[0].id, MODEL_PRESETS[1].id, MODEL_PRESETS[2].id]
  )
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [advancedText, setAdvancedText] = useState('')
  const [ghToken, setGhToken] = useState(existingGhToken)
  const [ghLabel, setGhLabel] = useState(existingGhTokenEntry?.label ?? 'GitHub')

  const isDark = theme === 'dark'
  const heroImg = HERO_MAP[preset] ?? heroEmber

  const toggleModel = (id: string) =>
    setSelectedModels(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id])

  const saveAll = () => {
    setOpenrouterKey(localKey)
    const extra = advancedText.split('\n').map(l => l.trim()).filter(Boolean)
    setPreferredOrModels([...new Set([...selectedModels, ...extra])])
    if (ghToken.trim()) {
      const existing = repoTokens.find(t => t.host === 'github.com')
      const label = ghLabel.trim() || 'GitHub'
      if (existing) updateToken(existing.id, { token: ghToken.trim(), label })
      else addToken({ id: `tok${Date.now()}`, label, host: 'github.com', token: ghToken.trim() })
      setGithubToken(ghToken.trim())
    }
    setSetupWizardDone(true)
    onClose()
  }

  const handleSkip = () => { setSetupWizardDone(true); onClose() }

  // ── Shared styles ────────────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: 8,
    border: '1px solid var(--line-strong)', background: 'var(--bg-2)',
    color: 'var(--fg-0)', fontSize: 13, fontFamily: 'var(--font-ui)',
    outline: 'none', boxSizing: 'border-box',
  }
  const primaryBtn: React.CSSProperties = {
    padding: '9px 22px', borderRadius: 8, border: 'none',
    background: 'var(--accent)', color: 'var(--accent-fg)',
    fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)',
  }
  const ghostBtn: React.CSSProperties = {
    padding: '9px 16px', borderRadius: 8, border: '1px solid var(--line-strong)',
    background: 'transparent', color: 'var(--fg-2)',
    fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-ui)',
  }
  const linkChip: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '6px 12px', borderRadius: 6,
    border: '1px solid var(--line-strong)', background: 'var(--bg-2)',
    color: 'var(--accent)', fontSize: 12, fontFamily: 'var(--font-ui)',
    textDecoration: 'none', cursor: 'pointer', alignSelf: 'flex-start',
  }

  // ── Step 0: Welcome ──────────────────────────────────────────────────────────
  const renderStep0 = () => (
    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, overflow: 'hidden' }}>
      <div style={{ padding: '48px 40px', display: 'flex', flexDirection: 'column', gap: 24, overflowY: 'auto' }}>
        <img src={simpleLogo} alt="Codera AI" style={{ width: 40, height: 40 }} />
        <div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--fg-0)', lineHeight: 1.2, letterSpacing: -0.5, marginBottom: 12 }}>
            Codera AI
          </div>
          <div style={{ fontSize: 13, color: 'var(--fg-2)', lineHeight: 1.65, maxWidth: 320 }}>
            Richte Codera AI in wenigen Schritten ein — verbinde dein KI-Modell und lege dein erstes Projekt an.
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {['OpenRouter API-Key hinterlegen', 'LLM-Modell auswählen', 'GitHub-Token hinterlegen', 'Projekt anlegen'].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: 'var(--accent)' }} />
              <span style={{ fontSize: 13, color: 'var(--fg-1)' }}>{item}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ position: 'relative', overflow: 'hidden', background: 'var(--bg-2)' }}>
        <img
          src={heroImg}
          alt="Codera AI"
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block' }}
        />
        {/* Overlay gradient + logo/slogan */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 50%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: 24, right: 24, display: 'flex', alignItems: 'center', gap: 11 }}>
          <ISpinner size={31} spin={false} style={{ color: '#ffffff' }} />
          <span style={{ fontSize: 22, fontWeight: 700, color: '#ffffff', fontFamily: 'var(--font-ui)', letterSpacing: -0.3, lineHeight: 1 }}>Codera</span>
        </div>
      </div>
    </div>
  )

  // ── Step 1: OpenRouter ───────────────────────────────────────────────────────
  const renderStep1 = () => (
    <div style={{ flex: 1, overflowY: 'auto', padding: '40px 32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ maxWidth: 440, width: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--fg-0)', marginBottom: 8 }}>OpenRouter API-Key</div>
          <div style={{ fontSize: 13, color: 'var(--fg-2)', lineHeight: 1.65 }}>
            Erstelle einen Account auf openrouter.ai und kopiere deinen API-Key hier rein.
          </div>
        </div>
        <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" style={linkChip}>
          <IExternalLink style={{ width: 12, height: 12 }} />
          openrouter.ai/keys
        </a>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, color: 'var(--fg-3)', fontWeight: 500 }}>API-Key</label>
          <input type="password" value={localKey} onChange={e => setLocalKey(e.target.value)}
            placeholder="sk-or-..." style={inputStyle} autoFocus />
        </div>
      </div>
    </div>
  )

  // ── Step 2: Model selection ──────────────────────────────────────────────────
  const renderStep2 = () => (
    <div style={{ flex: 1, overflowY: 'auto', padding: '40px 32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ maxWidth: 560, width: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--fg-0)', marginBottom: 8 }}>Modell wählen</div>
          <div style={{ fontSize: 13, color: 'var(--fg-2)', lineHeight: 1.65 }}>
            Wähle ein oder mehrere Modelle — du kannst sie jederzeit wechseln.
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {MODEL_PRESETS.map(preset => {
            const selected = selectedModels.includes(preset.id)
            return (
              <div key={preset.id} onClick={() => toggleModel(preset.id)} style={{
                padding: '12px 14px', borderRadius: 8,
                border: `1px solid ${selected ? 'var(--accent)' : 'var(--line-strong)'}`,
                background: selected ? 'var(--accent-soft)' : 'var(--bg-2)',
                cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 10,
                transition: 'border-color 0.12s, background 0.12s',
              }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: preset.color, flexShrink: 0, marginTop: 3 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)', marginBottom: 2 }}>{preset.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preset.id}</div>
                </div>
                {selected && <ICheck style={{ width: 14, height: 14, color: 'var(--accent)', flexShrink: 0, marginTop: 1 }} />}
              </div>
            )
          })}
        </div>
        <div>
          <button onClick={() => setShowAdvanced(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'transparent', border: 'none', color: 'var(--fg-3)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-ui)', padding: 0 }}>
            {showAdvanced ? <IChevUp style={{ width: 13, height: 13 }} /> : <IChevDown style={{ width: 13, height: 13 }} />}
            Erweiterte Einstellungen
          </button>
          {showAdvanced && (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, color: 'var(--fg-3)' }}>Weitere Modell-IDs (eine pro Zeile)</label>
              <textarea value={advancedText} onChange={e => setAdvancedText(e.target.value)}
                placeholder="z.B. anthropic/claude-opus-4" rows={4}
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace' }} />
            </div>
          )}
        </div>
      </div>
    </div>
  )

  // ── Step 3: GitHub Token ─────────────────────────────────────────────────────
  const renderStep3 = () => (
    <div style={{ flex: 1, overflowY: 'auto', padding: '40px 32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ maxWidth: 440, width: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--bg-2)', border: '1px solid var(--line-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <IGit style={{ width: 16, height: 16, color: 'var(--accent)' }} />
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--fg-0)' }}>GitHub-Token</div>
            <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 2 }}>Optional — für Clone, Push & Pull</div>
          </div>
        </div>
        <div style={{ fontSize: 13, color: 'var(--fg-2)', lineHeight: 1.65 }}>
          Ein Personal Access Token ermöglicht Codera AI, Git-Repositories direkt zu klonen, pushen und synchronisieren — ohne manuelle Eingabe deiner Zugangsdaten.
        </div>
        <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" style={linkChip}>
          <IExternalLink style={{ width: 12, height: 12 }} />
          github.com/settings/tokens
        </a>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: 140, flexShrink: 0 }}>
            <label style={{ fontSize: 12, color: 'var(--fg-3)', fontWeight: 500 }}>Bezeichnung</label>
            <input value={ghLabel} onChange={e => setGhLabel(e.target.value)}
              placeholder="GitHub" style={inputStyle} autoFocus />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
            <label style={{ fontSize: 12, color: 'var(--fg-3)', fontWeight: 500 }}>Personal Access Token</label>
            <input type="password" value={ghToken} onChange={e => setGhToken(e.target.value)}
              placeholder="ghp_..." style={inputStyle} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { label: 'Token-Typ',        value: 'Fine-grained oder Classic' },
            { label: 'Benötigte Rechte', value: 'repo, read:user' },
          ].map(({ label, value }) => (
            <div key={label} style={{ padding: '8px 12px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 7 }}>
              <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--fg-3)', marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 11.5, fontFamily: 'var(--font-mono)', color: 'var(--fg-2)' }}>{value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  // ── Footer ────────────────────────────────────────────────────────────────────
  const renderFooter = () => (
    <div style={{ padding: '16px 24px', borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ display: 'flex', gap: 6, flex: 1, alignItems: 'center' }}>
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <div key={i} style={{
            width: i === step ? 18 : 7, height: 7, borderRadius: 99,
            background: i === step ? 'var(--accent)' : i < step ? 'var(--accent)' : 'var(--line-strong)',
            opacity: i < step ? 0.4 : 1,
            transition: 'width 0.2s, background 0.15s',
          }} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {step > 0 && (
          <button style={ghostBtn} onClick={() => setStep(s => s - 1)}>Zurück</button>
        )}
        {step < TOTAL_STEPS - 1 && (
          <button style={ghostBtn} onClick={handleSkip}>Überspringen</button>
        )}
        {step < TOTAL_STEPS - 1 ? (
          <button style={primaryBtn} onClick={() => setStep(s => s + 1)}>Weiter</button>
        ) : (
          <button style={primaryBtn} onClick={saveAll}>Fertig</button>
        )}
      </div>
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9500, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 720, maxWidth: '92vw', height: 520, maxHeight: '88vh', borderRadius: 12, background: 'var(--bg-1)', border: '1px solid var(--line-strong)', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
        <button onClick={handleSkip} style={{ position: 'absolute', top: 14, right: 14, zIndex: 1, background: 'transparent', border: 'none', color: 'var(--fg-3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4, borderRadius: 6 }} title="Schließen">
          <IClose style={{ width: 16, height: 16 }} />
        </button>
        {step === 0 && renderStep0()}
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {renderFooter()}
      </div>
    </div>
  )
}
