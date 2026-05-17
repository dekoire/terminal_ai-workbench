import React, { useRef, useEffect, useState, useCallback } from 'react'
import { useAppStore } from '../../store/useAppStore'
import type { TurnMessage, Template, TerminalShortcut, Session } from '../../store/useAppStore'
import { IGit, IBranch, IPlus, IClose, IChev, IShield, IFile, ITerminal, IFolder, ISearch, IBell, ISpinner } from '../primitives/Icons'
import { TERMINAL_THEMES } from '../../theme/presets'
import { useAppLauncher } from '../../hooks/useAppLauncher'
import { SmartLaunchModal } from '../modals/SmartLaunchModal'
import { DiffBlock } from '../terminal/DiffBlock'
import { AgentView } from '../agent/AgentView'
import { OrbitView } from '../agent/OrbitView'
import { XTermPane } from '../terminal/XTermPane'
import { ChatInput } from './ChatInput'


interface CenterPanelProps {
  fileTabs: string[]
  activeFilePath: string | null
  setActiveFilePath: (p: string | null) => void
  closeFileTab: (p: string) => void
}

export function CenterPanel({ fileTabs, activeFilePath, setActiveFilePath, closeFileTab }: CenterPanelProps) {
  const { dangerMode, projects, activeProjectId, activeSessionId, setActiveSession, setNewSessionOpen, aliases, terminalTheme, theme: appTheme } = useAppStore()
  const termBg = (TERMINAL_THEMES.find(t => t.id === terminalTheme)?.theme.background)
    ?? (appTheme === 'dark' ? '#0e0d0b' : '#faf8f4')
  const project = projects.find(p => p.id === activeProjectId)
  const sessions = project?.sessions ?? []


  // ── Popup modal (cc:popup from XTermPane / AgentView) ──────────────────────
  const [popup, setPopup] = useState<PopupPrompt | null>(null)
  useEffect(() => {
    const handler = (e: Event) => {
      setPopup((e as CustomEvent<PopupPrompt>).detail)
    }
    window.addEventListener('cc:popup', handler)
    return () => window.removeEventListener('cc:popup', handler)
  }, [])

  // Lazy-mount: only mount a terminal once it becomes active for the first time.
  // This prevents orphaned sessions from opening WebSocket connections on load.
  const [mountedSessions, setMountedSessions] = useState<Set<string>>(() =>
    activeSessionId ? new Set([activeSessionId]) : new Set()
  )
  useEffect(() => {
    if (activeSessionId) {
      setMountedSessions(prev => prev.has(activeSessionId) ? prev : new Set([...prev, activeSessionId]))
    }
  }, [activeSessionId])

  // Drop mounted state for sessions that no longer exist (e.g. deleted)
  useEffect(() => {
    const ids = new Set(sessions.map(s => s.id))
    setMountedSessions(prev => {
      const next = new Set([...prev].filter(id => ids.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [sessions])

  const selectSession = (sid: string) => {
    setActiveFilePath(null)
    setActiveSession(sid)
  }

  const showFileViewer = activeFilePath !== null

  // Compute cmd/args for a session (baked-in at creation, fall back to alias lookup)
  const sessionCmd  = (s: typeof sessions[0]) => s.cmd  || aliases.find(a => a.name === s.alias)?.cmd  || 'zsh'
  const sessionArgs = (s: typeof sessions[0]) => s.args != null ? s.args : (aliases.find(a => a.name === s.alias)?.args ?? '')

  return (
    <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--bg-0)' }}>
      <ProjectHeader />
      {dangerMode && <DangerBanner />}
      <SessionTabs
        sessions={sessions}
        activeId={showFileViewer ? '' : activeSessionId ?? ''}
        onNew={() => setNewSessionOpen(true)}
        onSelectSession={selectSession}
        fileTabs={fileTabs}
        activeFilePath={activeFilePath}
        onSelectFileTab={setActiveFilePath}
        onCloseFileTab={closeFileTab}
      />
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        {showFileViewer && <FileTabViewer path={activeFilePath} />}
        {(projects.length === 0 || !project) && !showFileViewer && <NoProjectState />}
        {project && sessions.length === 0 && !showFileViewer && <EmptyState onNew={() => setNewSessionOpen(true)} />}

        {sessions.map(s => {
          const isActive    = s.id === activeSessionId && !showFileViewer
          const isAgent     = s.kind === 'openrouter-claude'
          const isOrbit     = s.kind === 'orbit'
          const hasMounted  = mountedSessions.has(s.id)
          return (
            <SessionWrapper key={s.id} isActive={isActive} isOrbit={isOrbit} isAgent={isAgent} hasMounted={hasMounted} s={s} project={project} sessionCmd={sessionCmd} sessionArgs={sessionArgs} />
          )
        })}
      </div>

      {sessions.length > 0 && (
        <InputAreaWrapper />
      )}

      {popup && <PopupDialog popup={popup} onClose={() => setPopup(null)} />}
    </main>
  )
}


interface GitInfo {
  branch: string
  remote: string | null
  dirty: number        // number of changed files
  ahead: number        // commits ahead of remote
  lastCommit: string   // relative time string, e.g. "2 hours ago"
  hasGit: boolean
}

function useGitInfo(projectPath: string | undefined): GitInfo | null {
  const [info, setInfo] = useState<GitInfo | null>(null)

  useEffect(() => {
    if (!projectPath) { setInfo(null); return }
    let cancelled = false

    const load = async () => {
      try {
        const res = await fetch(`/api/git?path=${encodeURIComponent(projectPath)}`)
        const data = await res.json() as {
          hasGit: boolean
          status: { flag: string; file: string }[]
          branches: { name: string; hash: string; msg: string; current: boolean }[]
          remotes: string[]
          lastCommit: string
          error?: string
        }
        if (cancelled) return
        if (!data.hasGit) {
          setInfo({ hasGit: false, branch: '', remote: null, dirty: 0, ahead: 0, lastCommit: '' })
          return
        }
        const branch = data.branches.find(b => b.current)?.name ?? data.branches[0]?.name ?? 'main'
        const remote = data.remotes[0] ?? null
        const dirty  = data.status.filter(s => s.flag !== '??').length
        setInfo({ hasGit: true, branch, remote, dirty, ahead: 0, lastCommit: data.lastCommit ?? '' })
      } catch {
        if (!cancelled) setInfo(null)
      }
    }

    load()
    const timer = setInterval(load, 10_000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [projectPath])

  return info
}


function ProjectHeader() {
  const { projects, activeProjectId, activeSessionId, docApplying, openrouterKey, aiFunctionMap } = useAppStore()
  const project = projects.find(p => p.id === activeProjectId)
  const { state, showModal, triggerDetect, launch, retryWithAI, dismissModal, setManualConfig } = useAppLauncher(activeProjectId)
  const [configOpen, setConfigOpen] = useState(false)
  const [cfgPort, setCfgPort] = useState('')
  const [cfgCmd, setCfgCmd] = useState('')
  const [detecting, setDetecting] = useState(false)
  const [refreshingDocs, setRefreshingDocs] = useState(false)

  void docApplying; void activeSessionId

  const detectWithAI = async () => {
    if (!project?.path || detecting) return
    setDetecting(true)
    try {
      const port = parseInt(cfgPort, 10) || project.appPort
      const cmd = await aiDetectStartCmd(project.path, port)
      if (cmd) setCfgCmd(cmd)
    } finally { setDetecting(false) }
  }

  const doRefreshDocs = async () => {
    if (!project?.path || refreshingDocs) return
    setRefreshingDocs(true)
    try { await refreshProjectDocs(project.path) }
    finally { setRefreshingDocs(false) }
  }

  const openConfig = () => {
    setCfgPort(String(project?.appPort ?? ''))
    setCfgCmd(project?.appStartCmd ?? '')
    setConfigOpen(true)
  }

  const saveConfig = async () => {
    if (!project) return
    const port = parseInt(cfgPort, 10) || undefined
    const cmd  = cfgCmd.trim() || undefined
    setManualConfig(cmd ?? '', port)
    if (port || cmd) {
      const cfg = { port: port ?? null, startCmd: cmd ?? null, appUrl: port ? `http://localhost:${port}` : null }
      await fetch('/api/file-write', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: `${project.path}/project.config.json`, content: JSON.stringify(cfg, null, 2) }) })
    }
    setConfigOpen(false)
  }

  // Listen to events from Workspace titlebar buttons
  useEffect(() => {
    const onPlay   = () => { triggerDetect() }
    const onConfig = () => openConfig()
    const onDocs   = () => doRefreshDocs()
    window.addEventListener('cc:hdr-play',   onPlay)
    window.addEventListener('cc:hdr-config', onConfig)
    window.addEventListener('cc:hdr-docs',   onDocs)
    return () => {
      window.removeEventListener('cc:hdr-play',   onPlay)
      window.removeEventListener('cc:hdr-config', onConfig)
      window.removeEventListener('cc:hdr-docs',   onDocs)
    }
  }, [triggerDetect, openrouterKey, aiFunctionMap]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {showModal && project && (
        <SmartLaunchModal
          projectName={project.name}
          state={state}
          onStart={launch}
          onRetryWithAI={retryWithAI}
          onClose={dismissModal}
        />
      )}

      {/* Config modal — centered on screen */}
      {configOpen && (
        <>
          <div onClick={() => setConfigOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 998, background: 'rgba(0,0,0,0.45)' }} />
          <div onClick={e => e.stopPropagation()} style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 999, background: 'var(--bg-2)', border: '1px solid var(--line-strong)', borderRadius: 6, padding: 20, display: 'flex', flexDirection: 'column', gap: 14, width: 440, boxShadow: '0 16px 48px rgba(0,0,0,0.6)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)' }}>Port und Serverstart festlegen</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 90, flexShrink: 0, color: 'var(--fg-3)' }}>Port</span>
                <input value={cfgPort} onChange={e => setCfgPort(e.target.value.replace(/\D/g, ''))} placeholder="3000" style={{ width: 100, padding: '5px 8px', background: 'var(--bg-1)', border: '1px solid var(--line-strong)', borderRadius: 6, color: 'var(--fg-0)', fontFamily: 'var(--font-mono)', fontSize: 11, outline: 'none' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ width: 90, flexShrink: 0, color: 'var(--fg-3)', paddingTop: 6 }}>Start-Befehl</span>
                <div style={{ flex: 1, display: 'flex', gap: 5, alignItems: 'flex-start' }}>
                  <textarea
                    value={cfgCmd}
                    onChange={e => setCfgCmd(e.target.value)}
                    disabled={detecting}
                    placeholder="npm run dev"
                    rows={2}
                    style={{ flex: 1, padding: '5px 8px', background: 'var(--bg-1)', border: '1px solid var(--line-strong)', borderRadius: 6, color: 'var(--fg-0)', fontFamily: 'var(--font-mono)', fontSize: 11, outline: 'none', resize: 'none', lineHeight: 1.6 }}
                  />
                  <button
                    onClick={detectWithAI}
                    disabled={detecting || !openrouterKey}
                    title={!openrouterKey ? 'OpenRouter API-Key fehlt' : 'Start-Befehl per AI ermitteln'}
                    style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, border: '1px solid var(--line-strong)', borderRadius: 6, background: 'var(--bg-1)', color: detecting ? 'var(--accent)' : !openrouterKey ? 'var(--fg-3)' : 'var(--accent)', cursor: (detecting || !openrouterKey) ? 'not-allowed' : 'pointer', opacity: !openrouterKey ? 0.4 : 1 }}
                  >
                    <ISpark className={detecting ? 'anim-pulse' : ''} style={{ width: 12, height: 12 }} />
                  </button>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfigOpen(false)} style={{ background: 'none', border: '1px solid var(--line-strong)', borderRadius: 6, color: 'var(--fg-2)', padding: '4px 12px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Abbrechen</button>
              <button onClick={saveConfig} style={{ background: 'var(--accent)', border: 'none', borderRadius: 6, color: 'var(--accent-fg)', padding: '4px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Speichern</button>
            </div>
          </div>
        </>
      )}

    </>
  )
}

export function SessionTabs({ sessions, activeId, onNew, onSelectSession, fileTabs, activeFilePath, onSelectFileTab, onCloseFileTab }: {
  sessions: { id: string; name: string; alias: string; status: string; permMode: string; kind?: string }[]
  activeId: string
  onNew: () => void
  onSelectSession: (id: string) => void
  fileTabs: string[]
  activeFilePath: string | null
  onSelectFileTab: (path: string) => void
  onCloseFileTab: (path: string) => void
}) {
  const { activeProjectId, removeSession, aliases } = useAppStore()
  const [pendingBells, setPendingBells] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const onPending = (e: Event) => {
      const { sessionId, pending } = (e as CustomEvent).detail as { sessionId: string; pending: boolean }
      setPendingBells(prev => ({ ...prev, [sessionId]: pending }))
    }
    const onDecision = (e: Event) => {
      const { sessionId } = (e as CustomEvent).detail as { sessionId: string }
      if (sessionId) setPendingBells(prev => ({ ...prev, [sessionId]: false }))
      else setPendingBells({})
    }
    window.addEventListener('cc:permission-pending', onPending)
    window.addEventListener('cc:permission-decision', onDecision)
    return () => {
      window.removeEventListener('cc:permission-pending', onPending)
      window.removeEventListener('cc:permission-decision', onDecision)
    }
  }, [])

  return (
    <div style={{ height: 44, flexShrink: 0, display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--line)', background: 'var(--bg-1)', paddingLeft: 6, paddingRight: 4, gap: 2, overflowX: 'auto', overflowY: 'hidden', scrollbarWidth: 'none' }} className="hide-scrollbar">
      {sessions.map(s => {
        const active = s.id === activeId && activeFilePath === null
        const alias = aliases.find(a => a.name === s.alias)
        const isOrbit = s.kind === 'orbit'
        const isDangerous = !isOrbit && (s.permMode === 'dangerous' || alias?.args?.includes('--dangerously-skip-permissions') || alias?.permMode === 'dangerous')
        const isExited = s.status === 'exited'
        const hasBell = !!pendingBells[s.id]
        const dotColor = isDangerous ? 'var(--err)' : isOrbit ? 'var(--orbit)' : s.status === 'active' ? 'var(--ok)' : s.status === 'error' ? 'var(--err)' : 'var(--fg-3)'
        const accentColor = isOrbit ? 'var(--orbit)' : isDangerous ? 'var(--err)' : 'var(--accent)'
        return (
          <div
            key={s.id}
            onClick={() => onSelectSession(s.id)}
            style={{
              height: 28, padding: '0 12px',
              display: 'flex', alignItems: 'center', gap: 6,
              borderRadius: 99,
              margin: '0 1px',
              background: active ? (isDangerous ? 'rgba(239,122,122,0.12)' : isOrbit ? 'rgba(139,108,247,0.12)' : 'var(--bg-0)') : 'transparent',
              border: active ? `1px solid ${accentColor}` : '1px solid transparent',
              color: isExited ? 'var(--fg-3)' : isDangerous ? (active ? '#ef7a7a' : 'var(--fg-2)') : active ? 'var(--fg-0)' : 'var(--fg-2)',
              fontSize: 11.5, cursor: 'pointer', maxWidth: 220,
              opacity: isExited && !active ? 0.6 : 1,
              transition: 'background 0.12s, border-color 0.12s',
            }}
            onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--bg-2)' }}
            onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          >
            {/* Left badges: shield (if dangerous), orbit icon */}
            {isDangerous && (
              <IShieldPlus title="--dangerously-skip-permissions" style={{ width: 10, height: 10, color: 'var(--err)', flexShrink: 0 }} />
            )}
            {isOrbit && (
              <IOrbit style={{ width: 10, height: 10, color: active ? 'var(--orbit)' : 'var(--fg-3)', flexShrink: 0 }} />
            )}

            {/* Name */}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: isExited ? 'line-through' : 'none', flex: 1 }}>{s.name}</span>

            {/* Bell indicator for pending permission */}
            {hasBell && (
              <IBell style={{ width: 10, height: 10, color: 'var(--accent)', flexShrink: 0, animation: 'perm-bell 1s ease-in-out infinite' }} />
            )}

            {/* Right side: alias sub-label, status dot */}
            {s.alias && s.alias !== s.name && (
              <span className="mono" style={{ fontSize: 9.5, color: active ? 'var(--accent)' : 'var(--fg-3)', flexShrink: 0 }}>{s.alias}</span>
            )}
            {isExited && <span style={{ fontSize: 8.5, color: 'var(--fg-3)', background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 3, padding: '1px 4px', flexShrink: 0 }}>ended</span>}
            {!isExited && (
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, flexShrink: 0, ...(s.status === 'active' ? { animation: 'cc-pulse 1.4s ease-in-out infinite' } : {}) }} />
            )}
            <IClose
              style={{ color: 'var(--fg-3)', opacity: 0.7, marginLeft: 2, flexShrink: 0 }}
              onClick={(e: React.MouseEvent) => { e.stopPropagation(); removeSession(activeProjectId, s.id) }}
            />
          </div>
        )
      })}
      {/* File viewer tabs */}
      {fileTabs.length > 0 && <div style={{ width: 1, height: 18, background: 'var(--line)', alignSelf: 'center', flexShrink: 0 }} />}
      {fileTabs.map(path => {
        const name = path.split('/').pop() ?? path
        const active = path === activeFilePath
        return (
          <div
            key={path}
            onClick={() => onSelectFileTab(path)}
            title={path}
            style={{
              height: 28, padding: '0 10px',
              display: 'flex', alignItems: 'center', gap: 6,
              borderRadius: 99,
              margin: '0 1px',
              background: active ? 'rgba(212,163,72,0.10)' : 'transparent',
              border: active ? '1px solid #d4a348' : '1px solid transparent',
              color: active ? '#d4a348' : 'var(--fg-3)',
              fontSize: 11.5, cursor: 'pointer', maxWidth: 200, flexShrink: 0,
            }}
          >
            <IFile style={{ color: active ? '#d4a348' : 'var(--fg-3)', width: 11, height: 11, flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontStyle: 'italic' }}>{name}</span>
            <IClose
              style={{ color: 'var(--fg-3)', opacity: 0.7, marginLeft: 2, flexShrink: 0 }}
              onClick={(e: React.MouseEvent) => { e.stopPropagation(); onCloseFileTab(path) }}
            />
          </div>
        )
      })}

      <button onClick={onNew} title="Neue Session (⌘T)" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', margin: '0 4px', background: 'none', border: 'none', borderRadius: 99, color: 'var(--fg-1)', fontSize: 10.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)', flexShrink: 0 }}>
        <IPlus style={{ width: 12, height: 12, strokeWidth: 2.5 }} /><span>New</span>
      </button>
    </div>
  )
}

function DangerBanner() {
  const { setDangerMode } = useAppStore()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 14px', background: 'var(--danger-soft)', borderBottom: '1px solid var(--danger-line)', color: 'var(--danger)', fontSize: 11.5 }}>
      <IShield />
      <span style={{ fontWeight: 600 }}>Dangerous mode armed</span>
      <span style={{ color: 'var(--fg-1)' }}>permission prompts skipped — agent can write & execute without confirmation</span>
      <span style={{ flex: 1 }} />
      <span className="mono" style={{ fontSize: 10.5, color: 'var(--fg-2)' }}>--dangerously-skip-permissions</span>
      <button onClick={() => setDangerMode(false)} style={{ background: 'transparent', border: '1px solid var(--danger-line)', color: 'var(--danger)', padding: '2px 8px', borderRadius: 6, fontSize: 10.5, cursor: 'pointer', fontFamily: 'inherit' }}>Disarm</button>
    </div>
  )
}

function NoProjectState() {
  const { setNewProjectOpen, openrouterKey, preferredOrModels } = useAppStore()
  const isConfigured = !!openrouterKey && preferredOrModels.length > 0

  const card: React.CSSProperties = {
    padding: '20px 18px', borderRadius: 8,
    border: '1px solid transparent', background: 'var(--bg-1)',
    cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8,
    transition: 'border-color 0.15s', textAlign: 'left',
  }

  const sectionLabel: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: 0.7, color: 'var(--fg-3)', marginBottom: 6,
  }

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '28px', minHeight: 0,
    }}>
      <div style={{ width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>

        {/* Logo + heading */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <ISpinner size={32} spin={false} style={{ opacity: 0.45 }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg-0)', marginBottom: 4 }}>Bereit zum Coden.</div>
            <div style={{ fontSize: 12, color: 'var(--fg-3)', lineHeight: 1.55 }}>Lege ein Projekt an und starte deine erste Session.</div>
          </div>
        </div>

        {/* Cards */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>

          <div
            style={card}
            onClick={() => setNewProjectOpen(true)}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'transparent')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <IFolder style={{ color: 'var(--accent)', width: 15, height: 15 }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-0)' }}>Workspace anlegen</span>
            </div>
            <span style={{ fontSize: 10.5, color: 'var(--fg-2)', lineHeight: 1.5 }}>
              Neues Projekt mit Ordnerpfad, Sessions und Git-Integration anlegen.
            </span>
            <span style={{ fontSize: 9.5, color: 'var(--fg-3)' }}>Projekt · Sessions · Git</span>
          </div>

          {!isConfigured && (
            <div
              style={card}
              onClick={() => window.dispatchEvent(new CustomEvent('cc:open-getting-started'))}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'transparent')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ISpark style={{ color: 'var(--accent)', width: 15, height: 15 }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-0)' }}>Getting Started</span>
              </div>
              <span style={{ fontSize: 10.5, color: 'var(--fg-2)', lineHeight: 1.5 }}>
                API-Key, Modelle und GitHub in wenigen Schritten einrichten.
              </span>
              <span style={{ fontSize: 9.5, color: 'var(--fg-3)' }}>OpenRouter · Modelle · GitHub</span>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

function EmptyState({ onNew }: { onNew: () => void }) {
  const { setNewSessionPreKind, setNewSessionOpen, activeProjectId, projects, addSession, setActiveSession, createOrbitChat } = useAppStore()

  const openKind = (kind: 'single' | 'openrouter-claude') => {
    setNewSessionPreKind(kind)
    setNewSessionOpen(true)
  }

  const startOrbit = () => {
    if (!activeProjectId) return
    const project = projects.find(p => p.id === activeProjectId)
    const existing = project?.sessions.find(s => s.kind === 'orbit')
    if (existing) {
      setActiveSession(existing.id)
      createOrbitChat(activeProjectId, existing.id)
      return
    }
    const id = crypto.randomUUID()
    addSession(activeProjectId, {
      id, kind: 'orbit', name: 'Orbit',
      alias: '', cmd: '', args: '',
      status: 'active', permMode: 'normal', startedAt: Date.now(),
    })
    setActiveSession(id)
  }

  const card: React.CSSProperties = {
    padding: '20px 18px', borderRadius: 8,
    border: '1px solid transparent', background: 'var(--bg-1)',
    cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8,
    transition: 'border-color 0.15s',
  }

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '28px', minHeight: 0,
    }}>
      <div style={{ width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>

      {/* Logo + heading */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <ISpinner size={32} spin={false} style={{ opacity: 0.45 }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg-0)', marginBottom: 4 }}>Starte deine Session.</div>
          <div style={{ fontSize: 12, color: 'var(--fg-3)', lineHeight: 1.55 }}>Wähle einen Session-Typ und leg direkt los.</div>
        </div>
      </div>

      {/* Session-Typ Karten */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* Coding row: Terminal + Coding Agent */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div
            style={card}
            onClick={() => openKind('single')}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'transparent')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ITerminal style={{ color: 'var(--accent)', width: 15, height: 15 }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-0)' }}>Terminal</span>
            </div>
            <span style={{ fontSize: 10.5, color: 'var(--fg-2)', lineHeight: 1.5 }}>PTY-Session mit Alias — zsh, aider, deepseek u. a.</span>
            <span style={{ fontSize: 9.5, color: 'var(--fg-3)' }}>PTY · Alias · Shell</span>
          </div>

          <div
            style={card}
            onClick={() => openKind('openrouter-claude')}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'transparent')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ISpark style={{ color: 'var(--accent)', width: 15, height: 15 }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-0)' }}>Coding Agent</span>
            </div>
            <span style={{ fontSize: 10.5, color: 'var(--fg-2)', lineHeight: 1.5 }}>Strukturierte UI mit Tool-Calls, Diffs und Genehmigungen.</span>
            <span style={{ fontSize: 9.5, color: 'var(--fg-3)' }}>OpenRouter · AgentView</span>
          </div>
        </div>

        {/* Research row: Orbit full-width */}
        <div
          style={{ ...card, flexDirection: 'row', alignItems: 'center', gap: 14 }}
          onClick={startOrbit}
          onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'transparent')}
        >
          <IOrbit style={{ color: 'var(--accent)', width: 16, height: 16, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-0)' }}>Research Chat</span>
            <p style={{ fontSize: 10.5, color: 'var(--fg-2)', margin: '3px 0 0', lineHeight: 1.5 }}>Direkt-Chat mit 200+ Modellen — GPT, Gemini, Kimi, DeepSeek und mehr.</p>
          </div>
          <span style={{ fontSize: 9.5, color: 'var(--fg-3)', flexShrink: 0 }}>OpenRouter</span>
        </div>

      </div>
      </div>
    </div>
  )
}

function AliasCard({ alias, onStart }: { alias: { id: string; name: string; cmd: string; args: string }; onStart: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onClick={onStart}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        border: `1px solid ${hovered ? 'var(--accent-line)' : 'var(--line-strong)'}`,
        borderRadius: 6, padding: '8px 10px', cursor: 'pointer',
        background: hovered ? 'var(--accent-soft)' : 'var(--bg-1)',
        transition: 'border-color 0.15s, background 0.15s',
        display: 'flex', flexDirection: 'column', gap: 4,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{
          width: 20, height: 20, borderRadius: 6, background: hovered ? 'var(--accent)' : 'var(--bg-3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          transition: 'background 0.15s',
        }}>
          <ISpinner spin={false} size={11} style={{ color: hovered ? '#fff' : 'var(--accent)', transition: 'color 0.15s' }} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{alias.name}</span>
      </div>
      <div style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginLeft: 26 }}>
        {alias.cmd}{alias.args ? ' ' + alias.args : ''}
      </div>
    </div>
  )
}


function Turn({ turn, onAllow, onDeny }: { turn: TurnMessage; onAllow: (id: string) => void; onDeny: (id: string) => void }) {
  if (turn.kind === 'user') {
    return (
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <Avatar kind="user" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-0)', fontFamily: 'var(--font-ui)' }}>You</span>
            <span style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-ui)' }}>now</span>
          </div>
          <div style={{ color: 'var(--fg-0)', whiteSpace: 'pre-wrap' }}>{turn.content}</div>
          {turn.attachments && turn.attachments.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
              {turn.attachments.map(a => (
                <span key={a} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6, fontSize: 10.5, color: 'var(--fg-2)', fontFamily: 'var(--font-mono)' }}>
                  <IFile style={{ color: 'var(--fg-3)' }} />{a}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (turn.kind === 'agent') {
    return (
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <Avatar kind="agent" />
        <div style={{ flex: 1, minWidth: 0 }}>
          {turn.alias && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, fontFamily: 'var(--font-ui)' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)' }}>{turn.alias}</span>
              {turn.model && <Pill tone="neutral">{turn.model}</Pill>}
              {turn.elapsed && <span style={{ fontSize: 10, color: 'var(--fg-3)' }}>· {turn.elapsed}</span>}
              {turn.tokens && <span style={{ fontSize: 10, color: 'var(--fg-3)' }}>· {turn.tokens} tokens</span>}
            </div>
          )}
          {turn.content && <p style={{ color: 'var(--fg-0)', margin: '0 0 8px' }}>{turn.content}</p>}
          {turn.diff && <DiffBlock />}
        </div>
      </div>
    )
  }

  if (turn.kind === 'tool') {
    return (
      <div style={{ marginLeft: 32, marginBottom: 10, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 10px', background: turn.tone === 'accent' ? 'var(--accent-soft)' : 'var(--bg-1)', border: `1px solid ${turn.tone === 'accent' ? 'var(--accent-line)' : 'var(--line)'}`, borderRadius: 6, fontSize: 11 }}>
        <IChev style={{ color: 'var(--fg-3)', transform: 'rotate(90deg)' }} />
        <span style={{ color: turn.tone === 'accent' ? 'var(--accent)' : 'var(--ok)', fontWeight: 600 }}>{turn.toolName}</span>
        <span style={{ color: 'var(--fg-1)' }}>{turn.toolArgs}</span>
        {turn.toolLines && <span style={{ color: 'var(--fg-3)' }}>· {turn.toolLines} lines</span>}
        {turn.toolMatches && <span style={{ color: 'var(--fg-3)' }}>· {turn.toolMatches} matches</span>}
        {turn.pendingApproval && <Pill tone="warn">awaiting approval</Pill>}
      </div>
    )
  }

  if (turn.kind === 'status' && turn.pendingApproval) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'rgba(244,195,101,0.08)', border: '1px solid rgba(244,195,101,0.35)', borderRadius: 6, marginLeft: 32, marginBottom: 12, fontSize: 11.5, color: 'var(--warn)', fontFamily: 'var(--font-ui)' }}>
        <IWarn />
        <span style={{ fontWeight: 600 }}>Permission required</span>
        <span style={{ color: 'var(--fg-2)' }}>to write <span className="mono">src/charge-handler.ts</span></span>
        <span style={{ flex: 1 }} />
        <button onClick={() => onDeny(turn.id)} style={ghostBtn}>Deny</button>
        <button onClick={() => onAllow(turn.id)} style={primaryBtn}>Allow once</button>
        <button onClick={() => onAllow(turn.id)} style={ghostBtn}>Always</button>
      </div>
    )
  }

  return null
}

// ── SessionWrapper — measures stable container width, passes to child ─────────
function SessionWrapper({ isActive, isOrbit, isAgent, hasMounted, s, project, sessionCmd, sessionArgs }: {
  isActive: boolean; isOrbit: boolean; isAgent: boolean; hasMounted: boolean
  s: Session; project: { path: string } | undefined
  sessionCmd: (s: Session) => string; sessionArgs: (s: Session) => string[]
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [paneWidth, setPaneWidth] = useState(9999)
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const e = entries[0]
      const w = e?.borderBoxSize?.[0]?.inlineSize ?? e?.contentRect.width ?? 9999
      if (w > 0) setPaneWidth(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={wrapRef} style={{ display: isActive ? 'flex' : 'none', flex: 1, minHeight: 0, flexDirection: 'column', position: 'relative' }}>
      {hasMounted && (isOrbit
        ? <OrbitView sessionId={s.id} containerWidth={paneWidth} />
        : isAgent
          ? <AgentView sessionId={s.id} kind={s.kind!} cmd={sessionCmd(s)} args={sessionArgs(s)} cwd={project?.path ?? '~'} orModel={s.orModel} providerSettingsJson={s.providerSettingsJson} providerAlias={sessionCmd(s)} containerWidth={paneWidth} />
          : <XTermPane  sessionId={s.id} cmd={sessionCmd(s)} args={sessionArgs(s)} cwd={project?.path ?? '~'} />
      )}
    </div>
  )
}

function InputAreaWrapper() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(9999)
  const { activeProjectId, activeSessionId, projects } = useAppStore()
  const hasSession = !!projects.find(p => p.id === activeProjectId)?.sessions.find(s => s.id === activeSessionId)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const e = entries[0]
      setWidth(e?.borderBoxSize?.[0]?.inlineSize ?? e?.contentRect.width ?? 9999)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  if (!hasSession) return null

  return (
    <div ref={wrapRef} style={{ flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
      <ChatInput containerWidth={width} />
    </div>
  )
}


// ── File Tab Viewer ───────────────────────────────────────────────────────────

function FileTabViewer({ path }: { path: string }) {
  const { addToast } = useAppStore()
  const [content, setContent]       = useState<string | null>(null)
  const [error, setError]           = useState('')
  const [search, setSearch]         = useState('')
  const [showLineNums, setShowLineNums] = useState(true)
  const [editMode, setEditMode]     = useState(false)
  const [editText, setEditText]     = useState('')
  const [history, setHistory]       = useState<string[]>([])
  const [hIdx, setHIdx]             = useState(0)
  const [dirty, setDirty]           = useState(false)
  const [replaceStr, setReplaceStr] = useState('')
  const [showReplace, setShowReplace] = useState(false)
  const [saving, setSaving]         = useState(false)

  useEffect(() => {
    setContent(null); setError(''); setSearch('')
    setEditMode(false); setDirty(false); setShowReplace(false)
    fetch(`/api/file-read?path=${encodeURIComponent(path)}`)
      .then(r => r.json())
      .then((d: { ok: boolean; content?: string; error?: string }) => {
        if (d.ok) setContent(d.content ?? '')
        else setError(d.error ?? 'Fehler')
      })
      .catch(e => setError(String(e)))
  }, [path])

  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  const isJson = ext === 'json'
  const lowerSearch = search.toLowerCase()

  const displayContent = React.useMemo(() => {
    if (!content || !isJson) return content ?? ''
    try { return JSON.stringify(JSON.parse(content), null, 2) } catch { return content }
  }, [content, isJson])

  let parsedJson: unknown = undefined
  if (isJson && content && !search && !editMode) {
    try { parsedJson = JSON.parse(content) } catch { /* raw */ }
  }

  const enterEdit = () => {
    const text = displayContent
    setEditText(text)
    setHistory([text])
    setHIdx(0)
    setDirty(false)
    setEditMode(true)
  }

  const exitEdit = () => { setEditMode(false); setSearch(''); setShowReplace(false) }

  const handleEditChange = (val: string) => {
    setEditText(val)
    setDirty(true)
    const next = [...history.slice(0, hIdx + 1), val].slice(-300)
    setHistory(next)
    setHIdx(next.length - 1)
  }

  const undo = () => {
    if (hIdx > 0) { setHIdx(hIdx - 1); setEditText(history[hIdx - 1]) }
  }
  const redo = () => {
    if (hIdx < history.length - 1) { setHIdx(hIdx + 1); setEditText(history[hIdx + 1]) }
  }

  const saveFile = async (savePath = path) => {
    if (saving) return
    setSaving(true)
    try {
      const r = await fetch('/api/file-write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: savePath, content: editText }),
      })
      const d = await r.json() as { ok: boolean; error?: string }
      if (d.ok) { setDirty(false); setContent(editText) }
      else addToast({ type: 'error', title: 'Speichern fehlgeschlagen', body: d.error })
    } catch (e) {
      addToast({ type: 'error', title: 'Speichern fehlgeschlagen', body: String(e) })
    } finally {
      setSaving(false)
    }
  }

  const saveAs = async () => {
    const newPath = window.prompt('Speichern unter:', path)
    if (newPath?.trim()) await saveFile(newPath.trim())
  }

  const replaceFirst = () => {
    if (!search) return
    const idx = editText.toLowerCase().indexOf(lowerSearch)
    if (idx === -1) return
    handleEditChange(editText.slice(0, idx) + replaceStr + editText.slice(idx + search.length))
  }

  const replaceAll = () => {
    if (!search) return
    const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
    handleEditChange(editText.replace(regex, replaceStr))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const mod = e.metaKey || e.ctrlKey
    if (mod && e.key === 's') { e.preventDefault(); saveFile() }
    if (mod && !e.shiftKey && e.key === 'z') { e.preventDefault(); undo() }
    if (mod && e.shiftKey && e.key === 'z') { e.preventDefault(); redo() }
  }

  const autoEnterEdit = () => { if (!editMode) enterEdit() }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, background: 'var(--bg-0)' }}>

      {/* Row 1 — path */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderBottom: '1px solid var(--line)', flexShrink: 0, background: 'var(--bg-1)' }}>
        <IFile style={{ color: 'var(--accent)', flexShrink: 0 }} />
        <span className="mono" style={{ flex: 1, fontSize: 10.5, color: 'var(--fg-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{path}</span>
        {dirty && <span style={{ fontSize: 9, color: 'var(--warn)', background: 'rgba(244,195,101,0.12)', border: '1px solid rgba(244,195,101,0.35)', borderRadius: 3, padding: '1px 5px', flexShrink: 0 }}>nicht gespeichert</span>}
        {editMode && <span style={{ fontSize: 9, color: 'var(--ok)', letterSpacing: 0.2, flexShrink: 0 }}>● Bearbeiten</span>}
      </div>

      {/* Row 2 — always-visible editor toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 14px', borderBottom: '1px solid var(--line)', flexShrink: 0, background: 'var(--bg-1)' }}>
        {/* Undo / Redo */}
        <button onClick={() => { autoEnterEdit(); undo() }} disabled={editMode && hIdx <= 0} title="Rückgängig (⌘Z)" style={{ ...ftBtn, opacity: editMode && hIdx <= 0 ? 0.35 : 1 }}>↩ Rückgängig</button>
        <button onClick={() => { autoEnterEdit(); redo() }} disabled={!editMode || hIdx >= history.length - 1} title="Wiederholen (⌘⇧Z)" style={{ ...ftBtn, opacity: !editMode || hIdx >= history.length - 1 ? 0.35 : 1 }}>↪ Wiederholen</button>

        <span style={{ width: 1, height: 14, background: 'var(--line)', flexShrink: 0, margin: '0 2px' }} />

        {/* S&E toggle */}
        <button
          onClick={() => { autoEnterEdit(); setShowReplace(v => !v) }}
          title="Suchen & Ersetzen"
          style={{ ...ftBtn, background: showReplace ? 'var(--accent-soft)' : 'transparent', border: `1px solid ${showReplace ? 'var(--accent-line)' : 'var(--line)'}`, color: showReplace ? 'var(--accent)' : 'var(--fg-1)' }}
        >S&amp;E</button>

        <span style={{ width: 1, height: 14, background: 'var(--line)', flexShrink: 0, margin: '0 2px' }} />

        {/* Line numbers + search */}
        <button onClick={() => setShowLineNums(v => !v)} title="Zeilennummern" style={{ ...ftBtn, background: showLineNums ? 'var(--accent-soft)' : 'transparent', border: `1px solid ${showLineNums ? 'var(--accent-line)' : 'var(--line)'}`, color: showLineNums ? 'var(--accent)' : 'var(--fg-3)' }}>#</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, border: '1px solid var(--line)', borderRadius: 6, background: 'var(--bg-2)', padding: '2px 7px', flex: 1, minWidth: 0 }}>
          <ISearch style={{ color: 'var(--fg-3)', width: 11, height: 11, flexShrink: 0 }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Suchen…"
            style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 11, color: 'var(--fg-0)', fontFamily: 'var(--font-ui)', width: '100%', minWidth: 0 }}
          />
          {search && <IClose style={{ width: 9, height: 9, color: 'var(--fg-3)', cursor: 'pointer', flexShrink: 0 }} onClick={() => setSearch('')} />}
        </div>

        <span style={{ width: 1, height: 14, background: 'var(--line)', flexShrink: 0, margin: '0 2px' }} />

        {/* View toggle */}
        {editMode
          ? <button onClick={exitEdit} style={ftBtn}>Vorschau</button>
          : <button onClick={enterEdit} style={{ ...ftBtn, background: 'var(--bg-3)', border: '1px solid var(--line-strong)' }}>Bearbeiten</button>
        }

        {/* Save */}
        <button onClick={saveAs} style={ftBtn} title="Speichern unter…">Speichern unter</button>
        <button
          onClick={() => saveFile()}
          disabled={saving || !editMode}
          title="Speichern (⌘S)"
          style={{ ...ftBtn, background: dirty ? 'var(--accent)' : 'transparent', color: dirty ? '#1a1410' : 'var(--fg-2)', border: dirty ? 'none' : '1px solid var(--line)', fontWeight: dirty ? 600 : 400, opacity: !editMode && !dirty ? 0.4 : 1 }}
        >{saving ? '…' : 'Speichern'}</button>
      </div>

      {/* Row 3 — Search & Replace (visible when S&E active) */}
      {showReplace && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderBottom: '1px solid var(--line)', flexShrink: 0, background: 'var(--bg-0)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, border: '1px solid var(--line)', borderRadius: 6, background: 'var(--bg-2)', padding: '3px 8px', flex: 1 }}>
            <ISearch style={{ color: 'var(--fg-3)', width: 11, height: 11, flexShrink: 0 }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Suchen…" style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 11, color: 'var(--fg-0)', fontFamily: 'var(--font-ui)', width: '100%' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, border: '1px solid var(--line)', borderRadius: 6, background: 'var(--bg-2)', padding: '3px 8px', flex: 1 }}>
            <input value={replaceStr} onChange={e => setReplaceStr(e.target.value)} placeholder="Ersetzen durch…" style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 11, color: 'var(--fg-0)', fontFamily: 'var(--font-ui)', width: '100%' }} />
          </div>
          <button onClick={() => { autoEnterEdit(); replaceFirst() }} disabled={!search} style={{ ...ftBtn, opacity: !search ? 0.4 : 1 }}>Ersetzen</button>
          <button onClick={() => { autoEnterEdit(); replaceAll() }} disabled={!search} style={{ ...ftBtn, opacity: !search ? 0.4 : 1 }}>Alle ersetzen</button>
          <IClose style={{ width: 10, height: 10, color: 'var(--fg-3)', cursor: 'pointer', flexShrink: 0 }} onClick={() => setShowReplace(false)} />
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', minHeight: 0 }}>
        {error && <div style={{ padding: 20, color: 'var(--err)', fontSize: 12 }}>{error}</div>}
        {!error && content === null && <div style={{ padding: 20, color: 'var(--fg-3)', fontSize: 12 }}>Lade…</div>}
        {!error && content !== null && editMode && (
          <textarea
            value={editText}
            onChange={e => handleEditChange(e.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            style={{ display: 'block', width: '100%', height: '100%', minHeight: '400px', background: 'var(--bg-0)', border: 'none', outline: 'none', resize: 'none', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-0)', lineHeight: 1.65, padding: '10px 18px', boxSizing: 'border-box' }}
          />
        )}
        {!error && content !== null && !editMode && parsedJson !== undefined && (
          <div style={{ padding: '12px 20px', fontFamily: 'var(--font-mono)', fontSize: 11.5, lineHeight: 1.65 }}>
            <FtvJsonNode value={parsedJson} depth={0} />
          </div>
        )}
        {!error && content !== null && !editMode && parsedJson === undefined && (
          <FtvTextViewer content={displayContent} search={lowerSearch} showLineNums={showLineNums} ext={ext} />
        )}
      </div>
    </div>
  )
}

// Minimal JSON tree for FileTabViewer (same logic as DataViewer's JsonNode)
function FtvJsonNode({ value, depth }: { value: unknown; depth: number }): React.ReactElement {
  if (value === null)             return <span style={{ color: 'var(--fg-3)' }}>null</span>
  if (typeof value === 'boolean') return <span style={{ color: '#3b82f6' }}>{String(value)}</span>
  if (typeof value === 'number')  return <span style={{ color: '#10b981' }}>{value}</span>
  if (typeof value === 'string')  return <span style={{ color: '#a78bfa' }}>"{value}"</span>
  if (Array.isArray(value))       return <FtvJsonArr arr={value} depth={depth} />
  if (typeof value === 'object' && value !== null) return <FtvJsonObj obj={value as Record<string, unknown>} depth={depth} />
  return <span>{String(value)}</span>
}
function FtvJsonObj({ obj, depth }: { obj: Record<string, unknown>; depth: number }) {
  const [col, setCol] = useState(depth >= 2)
  const keys = Object.keys(obj)
  if (!keys.length) return <span style={{ color: 'var(--fg-2)' }}>{'{}'}</span>
  return (
    <span>
      <span onClick={() => setCol(c => !c)} style={{ cursor: 'pointer', color: 'var(--fg-3)', fontSize: 10 }}>{col ? '▶' : '▼'} </span>
      {col
        ? <span onClick={() => setCol(false)} style={{ color: 'var(--fg-3)', cursor: 'pointer' }}>{'{'} {keys.length} keys {'}'}</span>
        : <>{'{'}
            <div style={{ paddingLeft: 20 }}>{keys.map((k, i) => (
              <div key={k}><span style={{ color: 'var(--accent)' }}>"{k}"</span><span style={{ color: 'var(--fg-3)' }}>: </span><FtvJsonNode value={obj[k]} depth={depth + 1} />{i < keys.length - 1 && <span style={{ color: 'var(--fg-3)' }}>,</span>}</div>
            ))}</div>{'}'}</>
      }
    </span>
  )
}
function FtvJsonArr({ arr, depth }: { arr: unknown[]; depth: number }) {
  const [col, setCol] = useState(depth >= 2)
  if (!arr.length) return <span style={{ color: 'var(--fg-2)' }}>{'[]'}</span>
  return (
    <span>
      <span onClick={() => setCol(c => !c)} style={{ cursor: 'pointer', color: 'var(--fg-3)', fontSize: 10 }}>{col ? '▶' : '▼'} </span>
      {col
        ? <span onClick={() => setCol(false)} style={{ color: 'var(--fg-3)', cursor: 'pointer' }}>{'['} {arr.length} items {']'}</span>
        : <>{'['}
            <div style={{ paddingLeft: 20 }}>{arr.map((v, i) => (
              <div key={i}><FtvJsonNode value={v} depth={depth + 1} />{i < arr.length - 1 && <span style={{ color: 'var(--fg-3)' }}>,</span>}</div>
            ))}</div>{']'}</>
      }
    </span>
  )
}

function FtvHighlight({ line, query }: { line: string; query: string }): React.ReactElement {
  if (!query) return <>{line}</>
  const parts: React.ReactNode[] = []
  const lower = line.toLowerCase()
  let cursor = 0, idx = lower.indexOf(query)
  while (idx !== -1) {
    if (idx > cursor) parts.push(line.slice(cursor, idx))
    parts.push(<mark key={idx} style={{ background: 'rgba(255,200,50,0.4)', color: 'inherit', borderRadius: 2 }}>{line.slice(idx, idx + query.length)}</mark>)
    cursor = idx + query.length
    idx = lower.indexOf(query, cursor)
  }
  if (cursor < line.length) parts.push(line.slice(cursor))
  return <>{parts}</>
}

function FtvTextViewer({ content, search, showLineNums, ext }: { content: string; search: string; showLineNums: boolean; ext: string }) {
  const lines = content.split('\n')
  const isMono = !['md', 'txt', 'log'].includes(ext)
  const matchSet = search ? new Set(lines.map((l, i) => l.toLowerCase().includes(search) ? i : -1).filter(i => i !== -1)) : null
  const matchCount = matchSet?.size ?? 0
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      {search && (
        <div style={{ padding: '3px 14px', fontSize: 10.5, color: matchCount > 0 ? 'var(--ok)' : 'var(--err)', background: 'var(--bg-1)', borderBottom: '1px solid var(--line)' }}>
          {matchCount > 0 ? `${matchCount} Treffer` : 'Keine Treffer'}
        </div>
      )}
      <div style={{ display: 'flex', flex: 1 }}>
        {showLineNums && (
          <div style={{ flexShrink: 0, userSelect: 'none', background: 'var(--bg-1)', borderRight: '1px solid var(--line)', padding: '10px 0', textAlign: 'right' }}>
            {lines.map((_, i) => (
              <div key={i} style={{ padding: '0 10px', lineHeight: '1.65em', fontSize: 11, color: matchSet?.has(i) ? 'var(--accent)' : 'var(--fg-3)', fontFamily: 'var(--font-mono)', minWidth: 48 }}>
                {i + 1}
              </div>
            ))}
          </div>
        )}
        <div style={{ flex: 1, padding: '10px 0', overflow: 'hidden' }}>
          {lines.map((line, i) => (
            <div key={i} style={{ padding: '0 18px', lineHeight: '1.65em', fontSize: isMono ? 12 : 13, fontFamily: isMono ? 'var(--font-mono)' : 'var(--font-ui)', color: 'var(--fg-1)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: matchSet?.has(i) ? 'rgba(255,200,50,0.07)' : 'transparent' }}>
              <FtvHighlight line={line} query={search} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const primaryBtn: React.CSSProperties = { background: 'var(--accent)', color: 'var(--accent-fg)', border: 'none', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)' }
const ghostBtn: React.CSSProperties = { background: 'transparent', color: 'var(--fg-1)', border: '1px solid var(--line-strong)', padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-ui)' }
const chip: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 99, color: 'var(--fg-1)', fontSize: 10.5, cursor: 'pointer', fontFamily: 'var(--font-ui)' }

// ── PopupDialog ───────────────────────────────────────────────────────────────
// Shown as a centered floating modal when a PTY session dispatches cc:popup.
// The [POPUP_REQUIRED] marker format is detected in XTermPane / AgentView.

interface PopupPrompt {
  sessionId: string
  title:    string
  message:  string
  type:     string
  buttons:  string[]
}

function PopupDialog({ popup, onClose }: { popup: PopupPrompt; onClose: () => void }) {
  const sendRaw = (btn: string) => {
    window.dispatchEvent(new CustomEvent('cc:terminal-send-raw', {
      detail: { sessionId: popup.sessionId, data: btn + '\r' },
    }))
    onClose()
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'cc-slide-in 0.15s ease-out',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-1)',
          border: '1px solid var(--line-strong)',
          borderRadius: 6,
          boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
          width: 360,
          maxWidth: 'calc(100vw - 40px)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '12px 16px 10px',
          borderBottom: '1px solid var(--line)',
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: 'var(--accent)', flexShrink: 0,
            animation: 'cc-pulse 1.4s ease-in-out infinite',
          }} />
          <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--fg-0)', fontFamily: 'var(--font-ui)' }}>
            {popup.title}
          </span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-3)', padding: 2, display: 'flex', lineHeight: 1 }}
          >
            <IClose style={{ width: 10, height: 10 }} />
          </button>
        </div>

        {/* Message */}
        {popup.message && (
          <div style={{
            padding: '12px 16px 8px',
            fontSize: 13, lineHeight: 1.55,
            color: 'var(--fg-1)', fontFamily: 'var(--font-ui)',
          }}>
            {popup.message}
          </div>
        )}

        {/* Buttons */}
        <div style={{
          padding: '10px 16px 14px',
          display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap',
        }}>
          {popup.buttons.map((btn, i) => {
            const isFirst = i === 0
            const isLast  = i === popup.buttons.length - 1 && popup.buttons.length > 1
            return (
              <button
                key={btn + i}
                onClick={() => sendRaw(btn)}
                style={{
                  padding: '7px 18px',
                  borderRadius: 6,
                  fontSize: 12, fontWeight: 600,
                  fontFamily: 'var(--font-ui)',
                  cursor: 'pointer',
                  border: isFirst ? 'none' : isLast ? 'none' : '1px solid var(--line-strong)',
                  background: isFirst ? 'var(--accent)' : isLast ? 'var(--bg-3)' : 'transparent',
                  color: isFirst ? 'var(--accent-fg)' : 'var(--fg-0)',
                }}
              >
                {btn}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
const ftBtn: React.CSSProperties = { background: 'transparent', border: '1px solid var(--line)', borderRadius: 6, color: 'var(--fg-1)', fontSize: 10.5, padding: '2px 7px', cursor: 'pointer', fontFamily: 'var(--font-ui)', flexShrink: 0 }
