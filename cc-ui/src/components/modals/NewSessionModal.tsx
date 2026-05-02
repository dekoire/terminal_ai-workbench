import React, { useState, useEffect } from 'react'
import { useAppStore, CREW_TOOL_GROUPS } from '../../store/useAppStore'
import type { PermMode, AgentRole, CrewConfig, SessionKind } from '../../store/useAppStore'
import { IClose, ICheck, IShield, ITerminal, ISpark, ISpinner, IEdit, ICopy, IChevDown } from '../primitives/Icons'
import { useOpenRouterModels } from '../../utils/useOpenRouterModels'
import { SingleCombobox } from '../primitives/SingleCombobox'

// ── Shared styles ─────────────────────────────────────────────────────────────
const fieldLabel: React.CSSProperties = { display: 'block', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--fg-3)', fontWeight: 600, marginBottom: 8 }
const btnPrimary: React.CSSProperties = { background: 'var(--accent)', color: 'var(--accent-fg)', border: 'none', padding: '9px 18px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)' }
const btnGhost: React.CSSProperties = { background: 'transparent', color: 'var(--fg-1)', border: '1px solid var(--line-strong)', padding: '9px 18px', borderRadius: 7, fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-ui)' }
const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid var(--line-strong)', borderRadius: 7, background: 'var(--bg-2)', color: 'var(--fg-0)', fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none', boxSizing: 'border-box' }

// ── StepDots ─────────────────────────────────────────────────────────────────
function StepDots({ total, current }: { total: number; current: number }) {
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{ width: i === current ? 14 : 6, height: 6, borderRadius: 3, background: i === current ? 'var(--accent)' : i < current ? 'var(--accent)' : 'var(--line-strong)', opacity: i < current ? 0.45 : 1, transition: 'all 0.2s' }} />
      ))}
    </div>
  )
}

// ── CrewAI Status check ───────────────────────────────────────────────────────
type CheckStatus = 'idle' | 'checking' | 'ok' | 'missing'
interface EnvCheck { python: CheckStatus; crewai: CheckStatus; pythonPath?: string }

function useEnvCheck(active: boolean): [EnvCheck, () => void] {
  const [env, setEnv] = useState<EnvCheck>({ python: 'idle', crewai: 'idle' })

  const check = () => {
    setEnv({ python: 'checking', crewai: 'checking' })
    Promise.all([
      fetch('/api/which?cmd=python3').then(r => r.json()).catch(() => ({ ok: false })),
      // First try PATH-based check, fall back to python import check for venv installs
      fetch('/api/which?cmd=crewai').then(r => r.json()).catch(() => ({ ok: false }))
        .then(async (whichResult: { ok: boolean; path?: string }) => {
          if (whichResult.ok) return whichResult
          // Fallback: check if crewai is importable via python3 (catches venv installs)
          return fetch('/api/python-import?pkg=crewai').then(r => r.json()).catch(() => ({ ok: false }))
        }),
    ]).then(([py, crew]) => {
      setEnv({
        python: py.ok ? 'ok' : 'missing',
        crewai: (crew as { ok: boolean }).ok ? 'ok' : 'missing',
        pythonPath: (py as { ok: boolean; path?: string }).path ?? undefined,
      })
    })
  }

  useEffect(() => { if (active) check() }, [active])
  return [env, check]
}

// ── Main modal ────────────────────────────────────────────────────────────────
export function NewSessionModal() {
  const {
    setNewSessionOpen, activeProjectId, addSession, setActiveSession,
    aliases, setScreen, agentRoles, openrouterKey, setOpenrouterKey,
    crewVerbose, crewTelemetryOff, crewQuietLogs, crewWrapperScript,
    projects, activeSessionId, defaultManagerModel,
    newSessionPreKind, setNewSessionPreKind,
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

  // crew wizard state: step 1=env, 2=config, 3=agents
  const [crewStep, setCrewStep] = useState(1)
  const [crewName, setCrewName] = useState('')
  const [crewGoal, setCrewGoal] = useState('')
  const [crewProcess, setCrewProcess] = useState<'sequential' | 'hierarchical'>('hierarchical')
  const [crewManagerModel, setCrewManagerModel] = useState(() => defaultManagerModel || 'anthropic/claude-sonnet-4-6')
  const [orKey, setOrKey] = useState(openrouterKey)
  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(new Set())
  const [roleModels, setRoleModels] = useState<Record<string, string>>({})
  const [roleTools, setRoleTools] = useState<Record<string, string[]>>({})
  const [copied, setCopied] = useState(false)
  const [expandedRoleIds, setExpandedRoleIds] = useState<Set<string>>(new Set())
  const toggleRoleExpand = (id: string) => setExpandedRoleIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  // Tools come from Settings; no per-session toggle needed
  void roleTools // kept in state for startCrew()

  const [env, recheck] = useEnvCheck(kind === 'crew' && crewStep === 1)
  const { models: orModels, loading: orLoading } = useOpenRouterModels()

  // Pre-select all agent roles when entering crew mode — tools come from Settings defaults
  useEffect(() => {
    if (kind === 'crew') {
      setSelectedRoleIds(new Set(agentRoles.map(r => r.id)))
      setRoleModels(Object.fromEntries(agentRoles.map(r => [r.id, r.model])))
      // Pre-load tools from stored role defaults (set in Einstellungen)
      setRoleTools(Object.fromEntries(agentRoles.map(r => [r.id, r.tools ?? []])))
      setCrewName('Neue Crew')
    }
  }, [kind])

  const toggleRole = (id: string) =>
    setSelectedRoleIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const selectedRoles = agentRoles
    .filter(r => selectedRoleIds.has(r.id))
    .map(r => ({ ...r, model: roleModels[r.id] ?? r.model, tools: roleTools[r.id] ?? [] }))

  // ── Single session creation ──────────────────────────────────────────────
  const startSingle = () => {
    const id = `s${Date.now()}`
    const selectedAlias = aliases.find(a => a.name === aliasName)
    const baseCmd = selectedAlias?.cmd ?? 'zsh'
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

  // ── Crew session creation ────────────────────────────────────────────────
  const [crewStarting, setCrewStarting] = useState(false)

  const startCrew = async () => {
    const effectiveKey = orKey || openrouterKey
    if (orKey && orKey !== openrouterKey) setOpenrouterKey(orKey)
    const crew: CrewConfig = {
      name: crewName || 'Neue Crew',
      goal: crewGoal || undefined,
      orchestration: 'auto',
      backend: 'openrouter',
      process: crewProcess,
      agents: selectedRoles,
      managerModel: crewProcess === 'hierarchical' ? crewManagerModel : undefined,
    }
    const id = `s${Date.now()}`

    // Resolve crewai binary path for script generation
    let cmd = ''
    let args = ''
    if (env.crewai === 'ok') {
      try {
        setCrewStarting(true)
        // Get crewai binary path (may be in venv)
        const whichResp = await fetch('/api/which?cmd=crewai').then(r => r.json()).catch(() => ({ ok: false })) as { ok: boolean; path?: string }
        const pythonImportResp = await fetch('/api/python-import?pkg=crewai').then(r => r.json()).catch(() => ({ ok: false })) as { ok: boolean; via?: string }
        const crewaiPath = whichResp.path ?? pythonImportResp.via ?? 'crewai'

        const scriptResp = await fetch('/api/crew-script', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ crew, openrouterKey: effectiveKey, crewaiPath, crewVerbose, crewTelemetryOff, crewQuietLogs, crewWrapperScript }),
        }).then(r => r.json()).catch(() => ({ ok: false })) as { ok: boolean; cmd?: string; args?: string }

        if (scriptResp.ok && scriptResp.cmd) {
          cmd = scriptResp.cmd
          args = scriptResp.args ?? ''
        }
      } catch { /* fallback to plain shell */ }
      finally { setCrewStarting(false) }
    }

    addSession(activeProjectId, {
      id, kind: 'crew',
      name: crew.name,
      alias: '', cmd, args,
      status: 'active', permMode: 'normal',
      startedAt: Date.now(),
      crew,
    })

    // Crew session becomes active in center immediately
    setActiveSession(id)
    setNewSessionOpen(false)
    // Force terminal re-fit after modal overlay closes and layout settles
    setTimeout(() => window.dispatchEvent(new CustomEvent('cc:terminal-refresh')), 200)
    setTimeout(() => window.dispatchEvent(new CustomEvent('cc:terminal-refresh')), 600)
  }

  const copyInstall = () => {
    navigator.clipboard.writeText('pip install crewai crewai-tools').then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) })
  }

  const envAllOk = env.python === 'ok' && env.crewai === 'ok'

  // ── Render helpers ───────────────────────────────────────────────────────
  const close = () => setNewSessionOpen(false)

  // total steps for dots
  const crewTotalSteps = 2 // 1=env, 2=config+agents

  return (
    <div onClick={close} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(8,7,5,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '70vw', height: '70vh', maxWidth: 900, background: 'var(--bg-1)', border: '1px solid var(--line-strong)', borderRadius: 10, boxShadow: '0 24px 64px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ height: 38, padding: '0 14px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--line)' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)' }}>
            {kind === null ? 'Neue Session' : kind === 'single' ? 'Einzelne Session' : `Agenten-Crew${crewStep > 1 ? ' — Team & Orchestrator' : ''}`}
          </span>
          <span style={{ flex: 1 }} />
          {kind === 'crew' && <StepDots total={crewTotalSteps} current={crewStep - 1} />}
          <IClose onClick={close} style={{ color: 'var(--fg-2)', cursor: 'pointer', marginLeft: 8 }} />
        </div>

        {/* Body — flex column, content scrolls, footer pins to bottom */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

          {/* ── Step 0: Mode selection ─────────────────────────────────── */}
          {kind === null && (
            <>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 28px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, width: '100%' }}>
                  <div onClick={() => setKind('single')} style={{ padding: '20px 18px', borderRadius: 8, border: '1px solid var(--line-strong)', background: 'var(--bg-2)', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8, transition: 'border-color 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--line-strong)')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <ITerminal style={{ color: 'var(--accent)', width: 16, height: 16 }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-0)' }}>Einzelne Session</span>
                    </div>
                    <p style={{ fontSize: 11.5, color: 'var(--fg-2)', margin: 0, lineHeight: 1.55 }}>Ein AI-Agent in einem Terminal. Alias wählen, loslegen.</p>
                    <span style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 4 }}>claude-code · aider · deepseek</span>
                  </div>
                  <div onClick={() => setKind('crew')} style={{ padding: '20px 18px', borderRadius: 8, border: '1px solid var(--line-strong)', background: 'var(--bg-2)', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8, transition: 'border-color 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--line-strong)')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <ISpark style={{ color: 'var(--accent)', width: 16, height: 16 }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-0)' }}>Agenten-Crew</span>
                    </div>
                    <p style={{ fontSize: 11.5, color: 'var(--fg-2)', margin: 0, lineHeight: 1.55 }}>Mehrere spezialisierte Agenten — Claude entscheidet wer was übernimmt.</p>
                    <span style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 4 }}>Crew AI · OpenRouter · Multi-Agent</span>
                  </div>
                </div>
              </div>
              <div style={{ padding: '12px 28px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'flex-end' }}>
                <button style={btnGhost} onClick={close}>Abbrechen</button>
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
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {aliases.map((a, idx) => {
                      const isSelected = aliasName === a.name
                      const isShellAlias = a.cmd ? !a.cmd.startsWith('/') : false
                      return (
                        <div key={a.name} onClick={() => setAliasName(a.name)} style={{ padding: '10px 12px', borderRadius: 6, border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--line-strong)'}`, background: isSelected ? 'var(--accent-soft)' : 'var(--bg-2)', cursor: 'pointer' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                            <span style={{ fontSize: 9, fontWeight: 700, color: idx < 4 ? 'var(--accent)' : 'var(--fg-3)', background: idx < 4 ? 'var(--accent-soft)' : 'var(--bg-3)', border: `1px solid ${idx < 4 ? 'var(--accent)' : 'var(--line-strong)'}`, borderRadius: 3, padding: '0 4px', lineHeight: '14px', flexShrink: 0 }}>{idx + 1}</span>
                            <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: isSelected ? 'var(--accent)' : 'var(--fg-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
                            {isSelected && <ICheck style={{ color: 'var(--accent)', marginLeft: 'auto', flexShrink: 0 }} />}
                          </div>
                          <div className="mono" style={{ fontSize: 10.5, color: 'var(--fg-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.cmd} {a.args}</div>
                          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                            <span style={{ fontSize: 10.5, color: a.permMode === 'dangerous' ? 'var(--danger)' : 'var(--fg-3)' }}>{a.permMode === 'dangerous' ? '⚠ dangerous' : 'ask each time'}</span>
                            {isShellAlias && <span style={{ fontSize: 9, color: 'var(--warn, #e6a817)', background: 'rgba(230,168,23,0.1)', border: '1px solid rgba(230,168,23,0.3)', borderRadius: 3, padding: '0 4px', lineHeight: '14px' }}>shell alias</span>}
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

          {/* ── Crew: Step 1 — Env check ───────────────────────────────── */}
          {kind === 'crew' && crewStep === 1 && (
            <>
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 0 }}>
              <div>
                <p style={{ fontSize: 12, color: 'var(--fg-1)', margin: '0 0 16px', lineHeight: 1.6 }}>
                  Agenten-Crew nutzt <strong>Crew AI</strong> — ein Python-Framework für Multi-Agent-Systeme. Überprüfe ob alles bereit ist.
                </p>
                {/* Status rows */}
                {([
                  { label: 'Python 3', status: env.python, detail: env.pythonPath },
                  { label: 'Crew AI', status: env.crewai, detail: undefined },
                ] as { label: string; status: CheckStatus; detail?: string }[]).map(({ label, status, detail }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                    <span style={{ width: 80, fontSize: 12, color: 'var(--fg-1)', fontWeight: 500 }}>{label}</span>
                    {status === 'checking' && <ISpinner style={{ color: 'var(--fg-3)', animation: 'spin 1s linear infinite' }} />}
                    {status === 'ok' && <ICheck style={{ color: 'var(--ok)' }} />}
                    {status === 'missing' && <span style={{ fontSize: 11, color: 'var(--danger)', fontWeight: 600 }}>✕ nicht gefunden</span>}
                    {status === 'idle' && <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>—</span>}
                    {detail && <span className="mono" style={{ fontSize: 10, color: 'var(--fg-3)' }}>{detail}</span>}
                    {status === 'ok' && !detail && <span style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>installiert</span>}
                  </div>
                ))}
                {/* Install hint */}
                {(env.python === 'missing' || env.crewai === 'missing') && (
                  <div style={{ marginTop: 14, padding: '12px 14px', background: 'var(--bg-2)', border: '1px solid var(--line-strong)', borderRadius: 6 }}>
                    <p style={{ fontSize: 11, color: 'var(--fg-2)', margin: '0 0 8px' }}>Im Terminal ausführen:</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <code style={{ flex: 1, fontSize: 11.5, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>pip install crewai crewai-tools</code>
                      <button onClick={copyInstall} style={{ background: 'none', border: '1px solid var(--line-strong)', borderRadius: 4, padding: '3px 8px', cursor: 'pointer', color: 'var(--fg-2)', fontSize: 10, display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-ui)' }}>
                        {copied ? <ICheck style={{ color: 'var(--ok)' }} /> : <ICopy />}
                        {copied ? 'Kopiert' : 'Kopieren'}
                      </button>
                    </div>
                    <button onClick={recheck} style={{ ...btnGhost, marginTop: 10, fontSize: 11, padding: '5px 10px' }}>Erneut prüfen</button>
                  </div>
                )}
                {/* OpenRouter key */}
                <div style={{ marginTop: 16 }}>
                  <label style={fieldLabel}>OpenRouter API Key (für Modell-Zugriff)</label>
                  <input style={inputStyle} type="password" value={orKey} onChange={e => setOrKey(e.target.value)} placeholder="sk-or-v1-..." />
                  <p style={{ fontSize: 10.5, color: 'var(--fg-3)', margin: '5px 0 0' }}>
                    Registrierung auf openrouter.ai → Settings → Keys. Gibt Zugang zu Claude, GPT-4o, DeepSeek u.v.m.
                  </p>
                </div>
              </div>
              </div>
              <div style={{ padding: '12px 28px', borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center' }}>
                <button style={btnGhost} onClick={() => { setKind(null); setCrewStep(1) }}>Zurück</button>
                <span style={{ flex: 1 }} />
                {!envAllOk && <button style={{ ...btnGhost, marginRight: 8 }} onClick={() => setCrewStep(2)}>Überspringen</button>}
                <button style={btnPrimary} onClick={() => setCrewStep(2)}>Weiter →</button>
              </div>
            </>
          )}

          {/* ── Crew: Step 2 — Config + Agents (merged) ───────────────── */}
          {kind === 'crew' && crewStep === 2 && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', flex: 1, padding: '24px 28px', justifyContent: 'center' }}>

                {/* Crew-Name + Prozess + Orchestrator in one compact row */}
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}>
                    <label style={fieldLabel}>Crew-Name</label>
                    <input autoFocus style={{ ...inputStyle, padding: '7px 10px' }} value={crewName} onChange={e => setCrewName(e.target.value)} placeholder="Feature-Entwicklung-Crew" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={fieldLabel}>Prozess</label>
                    <div style={{ display: 'flex', gap: 6, height: 34 }}>
                      {(['sequential', 'hierarchical'] as const).map(p => (
                        <button
                          key={p}
                          onClick={() => setCrewProcess(p)}
                          style={{ flex: 1, padding: '0', borderRadius: 7, border: `1.5px solid ${crewProcess === p ? 'var(--accent)' : 'var(--line-strong)'}`, background: crewProcess === p ? 'color-mix(in srgb, var(--accent) 12%, var(--bg-2))' : 'var(--bg-2)', color: crewProcess === p ? 'var(--accent)' : 'var(--fg-2)', fontSize: 11.5, fontFamily: 'var(--font-ui)', cursor: 'pointer', fontWeight: crewProcess === p ? 600 : 400, transition: 'all 0.15s' }}
                        >
                          {p === 'sequential' ? '→ Sequentiell' : '⬡ Hierarchisch'}
                        </button>
                      ))}
                    </div>
                  </div>
                  {crewProcess === 'hierarchical' && (
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <label style={{ ...fieldLabel, marginBottom: 0 }}>Orchestrator-Modell</label>
                        <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 99, border: '1px solid rgba(100,200,100,0.4)', background: 'rgba(100,200,100,0.1)', color: '#6dc87a', fontWeight: 600 }}>tool-use</span>
                        {orModels.length > 0 && <span style={{ fontSize: 9, color: 'var(--fg-3)' }}>{orModels.filter(m => m.supportsTools).length} Modelle</span>}
                      </div>
                      <SingleCombobox
                        value={crewManagerModel}
                        onChange={setCrewManagerModel}
                        searchable
                        options={orModels.length > 0
                          ? orModels.filter(m => m.supportsTools).map(m => ({ value: m.value, label: m.label }))
                          : [
                            { value: 'anthropic/claude-opus-4',       label: 'Claude Opus 4' },
                            { value: 'anthropic/claude-sonnet-4-6',   label: 'Claude Sonnet 4.6' },
                            { value: 'openai/gpt-4o',                 label: 'GPT-4o' },
                            { value: 'openai/o4-mini',                label: 'o4-mini' },
                            { value: 'google/gemini-2.5-pro-preview', label: 'Gemini 2.5 Pro' },
                            { value: 'deepseek/deepseek-chat',        label: 'DeepSeek V3' },
                          ]}
                        loading={orLoading}
                        placeholder="Modell auswählen…"
                      />
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div style={{ borderTop: '1px solid var(--line)' }} />

                {/* Agent selection */}
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                    <label style={{ ...fieldLabel, marginBottom: 0 }}>Agenten</label>
                    <span style={{ flex: 1 }} />
                    <button
                      onClick={() => setSelectedRoleIds(selectedRoleIds.size === agentRoles.length ? new Set() : new Set(agentRoles.map(r => r.id)))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 11, padding: 0, fontFamily: 'var(--font-ui)' }}
                    >
                      {selectedRoleIds.size === agentRoles.length ? 'Alle abwählen' : 'Alle auswählen'}
                    </button>
                  </div>
                  <div style={{ overflowY: 'auto', flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, alignContent: 'start' }}>
                    {agentRoles.map(role => {
                      const sel = selectedRoleIds.has(role.id)
                      const currentModel = roleModels[role.id] ?? role.model
                      const expanded = expandedRoleIds.has(role.id)
                      return (
                            <div
                              key={role.id}
                              style={{ borderRadius: 7, border: `1px solid ${sel ? 'var(--accent)' : 'var(--line-strong)'}`, background: sel ? 'var(--accent-soft)' : 'var(--bg-2)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
                            >
                              {/* Header row: checkbox + name + expand chevron */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 10px', userSelect: 'none' }}>
                                <div onClick={() => toggleRole(role.id)} style={{ width: 13, height: 13, borderRadius: 3, border: `1.5px solid ${sel ? 'var(--accent)' : 'var(--fg-3)'}`, background: sel ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' }}>
                                  {sel && <ICheck style={{ color: 'var(--accent-fg)', width: 8, height: 8 }} />}
                                </div>
                                <span onClick={() => toggleRoleExpand(role.id)} style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)', flex: 1, cursor: 'pointer' }}>{role.name}</span>
                                {role.strengths.length > 0 && (
                                  <div style={{ display: 'flex', gap: 3 }}>
                                    {role.strengths.slice(0, 2).map(s => (
                                      <span key={s} style={{ fontSize: 9, color: sel ? 'var(--accent)' : 'var(--fg-3)', background: 'var(--bg-3)', borderRadius: 3, padding: '1px 4px' }}>{s}</span>
                                    ))}
                                  </div>
                                )}
                                <IChevDown onClick={() => toggleRoleExpand(role.id)} style={{ width: 10, height: 10, color: 'var(--fg-3)', cursor: 'pointer', flexShrink: 0, transform: expanded ? 'none' : 'rotate(-90deg)', transition: 'transform 0.15s' }} />
                              </div>
                              {/* Expandable details */}
                              {expanded && (
                                <div style={{ padding: '0 7px 7px', display: 'flex', flexDirection: 'column', gap: 4 }} onClick={e => e.stopPropagation()}>
                                  <SingleCombobox
                                    value={currentModel}
                                    onChange={v => setRoleModels(prev => ({ ...prev, [role.id]: v }))}
                                    searchable
                                    loading={orLoading}
                                    options={orModels.length > 0 ? orModels.map(m => ({ value: m.value, label: m.label })) : [{ value: currentModel, label: currentModel }]}
                                    placeholder="Modell auswählen…"
                                    maxHeight={200}
                                  />
                                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                    {CREW_TOOL_GROUPS.map(group => {
                                      const active = group.tools.some(t => (roleTools[role.id] ?? role.tools ?? []).includes(t.id))
                                      if (!active) return null
                                      const activeTools = group.tools.filter(t => (roleTools[role.id] ?? role.tools ?? []).includes(t.id))
                                      return (
                                        <span key={group.id} title={activeTools.map(t => t.label).join(', ')} style={{ fontSize: 9, padding: '1px 6px', borderRadius: 99, border: `1px solid ${group.color}55`, background: group.color + '18', color: group.color, fontWeight: 600 }}>
                                          {group.label}
                                        </span>
                                      )
                                    })}
                                    {(roleTools[role.id] ?? role.tools ?? []).length === 0 && (
                                      <span style={{ fontSize: 9.5, color: 'var(--fg-3)', fontStyle: 'italic' }}>Keine Rechte</span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              <div style={{ padding: '12px 28px', borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center' }}>
                <button style={btnGhost} onClick={() => setCrewStep(1)}>Zurück</button>
                <span style={{ flex: 1 }} />
                <button style={{ ...btnGhost, marginRight: 8 }} onClick={close}>Abbrechen</button>
                <button style={{ ...btnPrimary, opacity: (selectedRoleIds.size === 0 || crewStarting) ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 6 }} disabled={selectedRoleIds.size === 0 || crewStarting} onClick={() => { void startCrew() }}>
                  {crewStarting && <ISpinner style={{ width: 12, height: 12 }} />}
                  {crewStarting ? 'Skript wird generiert…' : 'Crew starten'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
