import React, { useState, useEffect } from 'react'
import { useAppStore } from '../../store/useAppStore'
import type { PermMode, SessionKind } from '../../store/useAppStore'
import { newSessionId } from '../../lib/ids'
import { IClose, ICheck, IShield, ITerminal, ISpark, IOrbit } from '../primitives/Icons'
import { SingleCombobox } from '../primitives/SingleCombobox'
import { useOpenRouterModels } from '../../utils/useOpenRouterModels'

// ── Shared styles ─────────────────────────────────────────────────────────────
const fieldLabel: React.CSSProperties = { display: 'block', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--fg-3)', fontWeight: 600, marginBottom: 8 }
const btnPrimary: React.CSSProperties = { background: 'var(--accent)', color: 'var(--accent-fg)', border: 'none', padding: '9px 18px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)' }
const btnGhost: React.CSSProperties = { background: 'transparent', color: 'var(--fg-1)', border: '1px solid var(--line-strong)', padding: '9px 18px', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-ui)' }
const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid var(--line-strong)', borderRadius: 6, background: 'var(--bg-2)', color: 'var(--fg-0)', fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none', boxSizing: 'border-box' }

// ── Main modal ────────────────────────────────────────────────────────────────
export function NewSessionModal() {
  const {
    setNewSessionOpen, activeProjectId, projects, addSession, setActiveSession,
    aliases, setScreen,
    newSessionPreKind, setNewSessionPreKind, claudeProviders,
    createOrbitChat,
  } = useAppStore()

  // mode selection — pre-seeded from EmptyState quick-pick
  const [kind, setKind] = useState<SessionKind | null>(() => newSessionPreKind)

  useEffect(() => {
    if (newSessionPreKind) { setKind(newSessionPreKind); setNewSessionPreKind(null) }
  }, [])

  // single-session fields
  const [title, setTitle] = useState('')
  const [aliasName, setAliasName] = useState(aliases[0]?.name ?? '')
  const [permMode, setPermMode] = useState<PermMode>('normal')

  const { models: orModels, loading: orLoading } = useOpenRouterModels()

  // ── OpenRouter-Claude session ────────────────────────────────────────────
  const [orClaudeTitle, setOrClaudeTitle] = useState('')
  const [orClaudePermMode, setOrClaudePermMode] = useState<PermMode>('normal')
  // Value is "provider:<id>" for custom providers — auto-select kimi on mount
  const [orClaudeModel, setOrClaudeModel] = useState('anthropic/claude-sonnet-4-6')
  useEffect(() => {
    if (claudeProviders.length > 0) {
      const kimi = claudeProviders.find(p => p.name.toLowerCase().includes('kimi'))
      const target = kimi ?? claudeProviders[0]
      setOrClaudeModel(`provider:${target.id}`)
    }
  }, [])

  const startOpenRouterClaude = () => {
    const id = newSessionId(activeProjectId)
    const isProvider = orClaudeModel.startsWith('provider:')
    const provider = isProvider ? claudeProviders.find(p => `provider:${p.id}` === orClaudeModel) : null

    const sessionName = orClaudeTitle || (provider ? provider.name : orClaudeModel.split('/').pop()) || 'Claude via OpenRouter'
    const dangerFlag  = orClaudePermMode === 'dangerous' ? '--dangerously-skip-permissions' : ''

    if (provider) {
      const matchAlias = aliases.find(a => a.name === provider.name)
      // Build the settings JSON from current provider fields, merging over any stored
      // settingsJson so that plugin/advanced settings are preserved but auth is always
      // fresh (settingsJson can be stale if authToken was updated after initial save).
      const cleanUrl = provider.baseUrl.replace(/\/+$/, '')
      let mergedSettings: Record<string, unknown> = {}
      try {
        if (provider.settingsJson) mergedSettings = JSON.parse(provider.settingsJson) as Record<string, unknown>
      } catch { /* ignore */ }
      // Always override auth env vars from current provider fields.
      // Use ANTHROPIC_AUTH_TOKEN (Bearer header) — custom providers like Moonshot/DeepSeek
      // only accept Bearer, not x-api-key (ANTHROPIC_API_KEY).
      const existingEnv = (mergedSettings.env ?? {}) as Record<string, string>
      mergedSettings.env = {
        ...existingEnv,
        ANTHROPIC_BASE_URL: cleanUrl,
        ANTHROPIC_AUTH_TOKEN: provider.authToken,
        ANTHROPIC_API_KEY: '',           // must be empty string, not missing
        ANTHROPIC_MODEL: provider.modelName,
        ANTHROPIC_SMALL_FAST_MODEL: provider.modelName,
        ANTHROPIC_DEFAULT_SONNET_MODEL: provider.modelName,
        CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
      }
      const providerSettingsJson = JSON.stringify(mergedSettings)

      addSession(activeProjectId, {
        id, kind: 'openrouter-claude',
        name: sessionName,
        alias: provider.name,
        cmd: matchAlias?.cmd ?? 'claude',
        args: dangerFlag,
        status: 'active', permMode: orClaudePermMode,
        providerSettingsJson,
        startedAt: Date.now(),
      })
    } else {
      addSession(activeProjectId, {
        id, kind: 'openrouter-claude',
        name: sessionName,
        alias: 'claude', cmd: 'claude',
        args: `--model ${orClaudeModel}${dangerFlag ? ' ' + dangerFlag : ''}`,
        status: 'active', permMode: orClaudePermMode,
        orModel: orClaudeModel,
        startedAt: Date.now(),
      })
    }
    setActiveSession(id)
    setNewSessionOpen(false)
  }

  // ── Orbit session creation ──────────────────────────────────────────────
  const startOrbit = () => {
    // Reuse existing orbit session for this project — open a new chat in it instead
    const project = projects.find(p => p.id === activeProjectId)
    const existing = project?.sessions.find(s => s.kind === 'orbit')
    if (existing) {
      setActiveSession(existing.id)
      createOrbitChat(activeProjectId!, existing.id)
      setNewSessionOpen(false)
      return
    }
    const id = newSessionId(activeProjectId)
    addSession(activeProjectId, {
      id, kind: 'orbit',
      name: 'Orbit',
      alias: '', cmd: '', args: '',
      status: 'active', permMode: 'normal',
      startedAt: Date.now(),
    })
    setActiveSession(id)
    setNewSessionOpen(false)
  }

  // ── Single session creation ──────────────────────────────────────────────
  const startSingle = () => {
    const id = newSessionId(activeProjectId)
    const selectedAlias = aliases.find(a => a.name === aliasName)
    const baseCmd = (selectedAlias?.cmd ?? aliasName) || 'zsh'
    let baseArgs = selectedAlias?.args ?? ''
    const isDangerous = permMode === 'dangerous' || selectedAlias?.permMode === 'dangerous'
    if (isDangerous && !baseArgs.includes('--dangerously-skip-permissions')) {
      baseArgs = baseArgs ? baseArgs + ' --dangerously-skip-permissions' : '--dangerously-skip-permissions'
    }
    addSession(activeProjectId, {
      id, kind: 'single',
      name: title || aliasName || 'New session',
      alias: aliasName, cmd: baseCmd, args: baseArgs,
      status: 'active', permMode: isDangerous ? 'dangerous' : permMode,
      startedAt: Date.now(),
    })
    setActiveSession(id)
    setNewSessionOpen(false)
  }

  // ── Render helpers ───────────────────────────────────────────────────────
  const close = () => setNewSessionOpen(false)

  return (
    <div onClick={close} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(8,7,5,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '70vw', height: '70vh', maxWidth: 900, background: 'var(--bg-1)', border: '1px solid var(--line-strong)', borderRadius: 6, boxShadow: '0 24px 64px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ height: 38, padding: '0 14px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--line)' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)' }}>
            {kind === null ? 'Neue Session' : kind === 'orbit' ? 'Orbit Direct Chat' : kind === 'single' ? 'Terminal Session' : 'Coding Agent'}
          </span>
          <span style={{ flex: 1 }} />
          <IClose onClick={close} style={{ color: 'var(--fg-2)', cursor: 'pointer', marginLeft: 8 }} />
        </div>

        {/* Body — flex column, content scrolls, footer pins to bottom */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

          {/* ── Step 0: Mode selection ─────────────────────────────────── */}
          {kind === null && (
            <>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '24px 28px', gap: 20 }}>

                {/* ── Coding row ── */}
                <div>
                  <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fg-3)', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 8px 2px' }}>Coding</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

                    {/* Terminal */}
                    <div onClick={() => setKind('single')} style={{ padding: '24px 22px', borderRadius: 8, border: '1px solid var(--line-strong)', background: 'var(--bg-2)', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 10, transition: 'border-color 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--line-strong)')}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <ITerminal style={{ color: 'var(--accent)', width: 17, height: 17 }} />
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg-0)' }}>Terminal</span>
                      </div>
                      <p style={{ fontSize: 12, color: 'var(--fg-2)', margin: 0, lineHeight: 1.55 }}>Rohe PTY-Session. Alias wählen und direkt loslegen — für zsh, aider, deepseek und alles andere.</p>
                      <span style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 2 }}>PTY · Alias · Shell</span>
                    </div>

                    {/* Coding Agent */}
                    <div onClick={() => setKind('openrouter-claude')} style={{ padding: '24px 22px', borderRadius: 8, border: '1px solid var(--line-strong)', background: 'var(--bg-2)', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 10, transition: 'border-color 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--line-strong)')}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <ISpark style={{ color: 'var(--accent)', width: 17, height: 17 }} />
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg-0)' }}>Coding Agent</span>
                      </div>
                      <p style={{ fontSize: 12, color: 'var(--fg-2)', margin: 0, lineHeight: 1.55 }}>Interaktive Coding-Oberfläche mit jedem LLM. Tool-Calls, Diffs und Genehmigungen als strukturierte UI.</p>
                      <span style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 2 }}>OpenRouter · claude CLI · AgentView</span>
                    </div>

                  </div>
                </div>

                {/* ── Research row ── */}
                <div>
                  <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fg-3)', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 8px 2px' }}>Research</p>
                  <div onClick={startOrbit} style={{ padding: '20px 22px', borderRadius: 8, border: '1px solid var(--line-strong)', background: 'var(--bg-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, transition: 'border-color 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--line-strong)')}>
                    <IOrbit style={{ color: 'var(--accent)', width: 18, height: 18, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg-0)' }}>Research Chat</span>
                      <p style={{ fontSize: 12, color: 'var(--fg-2)', margin: '4px 0 0', lineHeight: 1.5 }}>Direkt-Chat mit 200+ KI-Modellen. GPT, Gemini, Kimi, DeepSeek und mehr — sofort, kein Setup.</p>
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--fg-3)', flexShrink: 0 }}>OpenRouter · Streaming</span>
                  </div>
                </div>

              </div>
              <div style={{ padding: '12px 28px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'flex-end' }}>
                <button style={btnGhost} onClick={close}>Abbrechen</button>
              </div>
            </>
          )}

          {/* ── OpenRouter-Claude session ──────────────────────────────── */}
          {kind === 'openrouter-claude' && (
            <>
              <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>

                {/* LLMs / Provider picker — first, with orange border */}
                <div style={{ border: '1px solid var(--accent)', borderRadius: 8, padding: '14px 14px 10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <label style={{ ...fieldLabel, marginBottom: 0, color: 'var(--accent)' }}>LLMs</label>
                    {claudeProviders.length > 0 && <span style={{ fontSize: 9, color: 'var(--fg-3)' }}>{claudeProviders.length} verfügbar</span>}
                  </div>
                  <SingleCombobox
                    value={orClaudeModel}
                    onChange={setOrClaudeModel}
                    searchable
                    options={claudeProviders.map(p => ({
                      value: `provider:${p.id}`,
                      label: p.name,
                      desc: `${p.baseUrl}/anthropic · ${p.modelName}`,
                    }))}
                    placeholder="Provider auswählen…"
                    triggerStyle={{ padding: '10px 12px', fontSize: 12 }}
                  />
                  {orClaudeModel.startsWith('provider:') && (() => {
                    const p = claudeProviders.find(cp => `provider:${cp.id}` === orClaudeModel)
                    if (!p) return null
                    const shellName = 'cc-' + p.name.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
                    return (
                      <div style={{ marginTop: 8, fontSize: 10.5, color: 'var(--fg-3)', opacity: 0.75 }}>
                        ✓ <strong>{p.baseUrl}/anthropic</strong> · Modell: <strong>{p.modelName}</strong>
                        <span style={{ marginLeft: 8, fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontSize: 10 }}>{shellName}</span>
                      </div>
                    )
                  })()}
                  <p style={{ fontSize: 10, color: 'var(--fg-3)', margin: '6px 0 0', lineHeight: 1.5, opacity: 0.7 }}>
                    Claude Provider aus den Einstellungen erscheinen hier oben. OpenRouter-Modelle via <strong>Einstellungen → LLM → Claude Provider</strong> anlegen.
                  </p>
                </div>

                {/* Name — after LLMs */}
                <div>
                  <label style={fieldLabel}>Name (Optional)</label>
                  <input
                    autoFocus
                    style={inputStyle}
                    value={orClaudeTitle}
                    onChange={e => setOrClaudeTitle(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && startOpenRouterClaude()}
                    placeholder="z.B. Refactor mit Sonnet"
                  />
                </div>

                {/* Permission mode — comes second */}
                <div>
                  <label style={fieldLabel}>Permission Mode</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(['normal', 'dangerous'] as PermMode[]).map(mode => {
                      const isDanger = mode === 'dangerous'
                      const sel = orClaudePermMode === mode
                      return (
                        <div key={mode} onClick={() => setOrClaudePermMode(mode)} style={{ flex: 1, padding: '10px 12px', borderRadius: 6, border: `1px solid ${sel ? (isDanger ? 'var(--danger)' : 'var(--accent)') : 'var(--line-strong)'}`, background: sel ? (isDanger ? 'var(--danger-soft)' : 'var(--accent-soft)') : 'var(--bg-2)', cursor: 'pointer' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <IShield style={{ color: isDanger ? 'var(--danger)' : 'var(--ok)' }} />
                            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)' }}>{isDanger ? 'Dangerous' : 'Normal'}</span>
                            {sel && <ICheck style={{ color: isDanger ? 'var(--danger)' : 'var(--accent)', marginLeft: 'auto' }} />}
                          </div>
                          <div style={{ fontSize: 10.5, color: 'var(--fg-2)', lineHeight: 1.5 }}>{isDanger ? 'Skip every permission prompt. Agent can write & exec freely.' : 'Ask before writes, exec, or destructive ops.'}</div>
                          {isDanger && <div className="mono" style={{ marginTop: 6, fontSize: 9.5, color: 'var(--danger)' }}>--dangerously-skip-permissions</div>}
                        </div>
                      )
                    })}
                  </div>
                </div>

              </div>
              <div style={{ padding: '12px 28px', borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center' }}>
                <button style={btnGhost} onClick={() => setKind(null)}>Zurück</button>
                <span style={{ flex: 1 }} />
                <button style={btnPrimary} onClick={startOpenRouterClaude}>Session starten</button>
              </div>
            </>
          )}

          {/* ── Single session ─────────────────────────────────────────── */}
          {kind === 'single' && (
            <>
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={fieldLabel}>Session-Titel</label>
                <input autoFocus style={inputStyle} value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && startSingle()} placeholder="z.B. refactor retries" />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ ...fieldLabel, marginBottom: 0 }}>Alias wählen</label>
                  <span style={{ flex: 1 }} />
                  <button onClick={() => { setNewSessionOpen(false); setScreen('settings') }} style={{ background: 'transparent', border: 'none', color: 'var(--accent)', fontSize: 10.5, cursor: 'pointer', fontFamily: 'var(--font-ui)', padding: 0 }}>+ Neuer Alias</button>
                </div>
                {aliases.length === 0 ? (
                  <div style={{ padding: 14, border: '1px dashed var(--line-strong)', borderRadius: 6, textAlign: 'center', color: 'var(--fg-3)', fontSize: 11.5 }}>
                    Noch keine Aliases.{' '}
                    <button onClick={() => { setNewSessionOpen(false); setScreen('settings') }} style={{ background: 'transparent', border: 'none', color: 'var(--accent)', fontSize: 11.5, cursor: 'pointer', fontFamily: 'var(--font-ui)', padding: 0 }}>In Settings anlegen</button>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                    {aliases.map((a, idx) => {
                      const isSelected = aliasName === a.name
                      const isShellAlias = a.cmd ? !a.cmd.startsWith('/') : false
                      return (
                        <div key={a.name} onClick={() => setAliasName(a.name)} style={{ padding: '7px 10px', borderRadius: 6, border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--line-strong)'}`, background: isSelected ? 'var(--accent-soft)' : 'var(--bg-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                          {/* Number badge */}
                          <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-soft)', border: '1px solid var(--accent)', borderRadius: 3, padding: '0 4px', lineHeight: '15px', flexShrink: 0 }}>{idx + 1}</span>
                          {/* Name */}
                          <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: isSelected ? 'var(--accent)' : 'var(--fg-0)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
                          {/* Command */}
                          <span className="mono" style={{ fontSize: 10.5, color: 'var(--fg-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 1 }}>{a.cmd}{a.args ? ` ${a.args}` : ''}</span>
                          {/* Badges */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 'auto', flexShrink: 0 }}>
                            {a.permMode === 'dangerous' && <span style={{ fontSize: 9.5, color: 'var(--danger)' }}>⚠ dangerous</span>}
                            {isShellAlias && <span style={{ fontSize: 9, color: 'var(--warn, #e6a817)', background: 'rgba(230,168,23,0.1)', border: '1px solid rgba(230,168,23,0.3)', borderRadius: 3, padding: '0 4px', lineHeight: '15px' }}>shell alias</span>}
                            {isSelected && <ICheck style={{ color: 'var(--accent)', width: 12, height: 12 }} />}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
              <div>
                <label style={fieldLabel}>Permission Mode</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['normal', 'dangerous'] as PermMode[]).map(mode => {
                    const isDanger = mode === 'dangerous'
                    const sel = permMode === mode
                    return (
                      <div key={mode} onClick={() => setPermMode(mode)} style={{ flex: 1, padding: '10px 12px', borderRadius: 6, border: `1px solid ${sel ? (isDanger ? 'var(--danger)' : 'var(--accent)') : 'var(--line-strong)'}`, background: sel ? (isDanger ? 'var(--danger-soft)' : 'var(--accent-soft)') : 'var(--bg-2)', cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <IShield style={{ color: isDanger ? 'var(--danger)' : 'var(--ok)' }} />
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)' }}>{isDanger ? 'Dangerous' : 'Normal'}</span>
                          {sel && <ICheck style={{ color: isDanger ? 'var(--danger)' : 'var(--accent)', marginLeft: 'auto' }} />}
                        </div>
                        <div style={{ fontSize: 10.5, color: 'var(--fg-2)', lineHeight: 1.5 }}>{isDanger ? 'Skip every permission prompt. Agent can write & exec freely.' : 'Ask before writes, exec, or destructive ops.'}</div>
                        {isDanger && <div className="mono" style={{ marginTop: 6, fontSize: 9.5, color: 'var(--danger)' }}>--dangerously-skip-permissions</div>}
                      </div>
                    )
                  })}
                </div>
              </div>
              </div>
              <div style={{ padding: '12px 28px', borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center' }}>
                <button style={btnGhost} onClick={() => setKind(null)}>Zurück</button>
                <span style={{ flex: 1 }} />
                <button style={{ ...btnPrimary, opacity: aliases.length === 0 ? 0.5 : 1 }} disabled={aliases.length === 0} onClick={startSingle}>Session starten</button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  )
}
