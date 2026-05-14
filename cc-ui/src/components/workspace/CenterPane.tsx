import React, { useRef, useEffect, useState, useCallback } from 'react'
import { useAppStore } from '../../store/useAppStore'
import type { TurnMessage, Template, TerminalShortcut, Session } from '../../store/useAppStore'
import { IGit, IBranch, IPlus, IClose, IChev, IShield, IFile, ISpark, IBolt, ISend, IWarn, ITerminal, IFolder, ISearch, IMic, IAiWand, IDocAI, IImage, IKeyboard, IShieldPlus, IOrbit, IPaperclip, IEdit, IBell } from '../primitives/Icons'
import { useFileAttachments, useDragDrop, usePasteFiles, FileAttachmentBar, DragOverlay } from '../primitives/FileAttachmentArea'
import { ImageAnnotator } from '../primitives/ImageAnnotator'
import simpleLogo from '../../assets/simple_logo.svg'
import { TERMINAL_THEMES } from '../../theme/presets'
import { updateDocsWithAI, refreshProjectDocs } from '../../utils/updateDocs'
import { aiDetectStartCmd } from '../../utils/aiDetect'
import { Pill } from '../primitives/Pill'
import { Kbd } from '../primitives/Kbd'
import { Avatar } from '../primitives/Avatar'
import { DiffBlock } from '../terminal/DiffBlock'
import { AgentView } from '../agent/AgentView'
import { OrbitView } from '../agent/OrbitView'
import { XTermPane } from '../terminal/XTermPane'
import { resolveRefs } from '../../lib/resolveRefs'


interface CenterPaneProps {
  fileTabs: string[]
  activeFilePath: string | null
  setActiveFilePath: (p: string | null) => void
  closeFileTab: (p: string) => void
}

export function CenterPane({ fileTabs, activeFilePath, setActiveFilePath, closeFileTab }: CenterPaneProps) {
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

interface DevConfig { port?: number; startCmd?: string; appUrl?: string }

function useProjectConfig(projectPath: string | undefined): DevConfig | null {
  const [cfg, setCfg] = useState<DevConfig | null>(null)
  useEffect(() => {
    if (!projectPath) { setCfg(null); return }
    const load = async () => {
      // 1. Try project.config.json first
      try {
        const r = await fetch(`/api/file-read?path=${encodeURIComponent(projectPath + '/project.config.json')}`)
        const d = await r.json() as { ok: boolean; content?: string }
        if (d.ok && d.content) { setCfg(JSON.parse(d.content) as DevConfig); return }
      } catch { /* fall through */ }
      // 2. Fallback: detect from package.json
      try {
        const r = await fetch(`/api/file-read?path=${encodeURIComponent(projectPath + '/package.json')}`)
        const d = await r.json() as { ok: boolean; content?: string }
        if (d.ok && d.content) {
          const pkg = JSON.parse(d.content) as { scripts?: Record<string, string> }
          const key = ['dev', 'start', 'serve', 'preview'].find(k => pkg.scripts?.[k])
          if (key) { setCfg({ startCmd: `npm run ${key}` }); return }
        }
      } catch { /* ignore */ }
      setCfg(null)
    }
    load()
  }, [projectPath])
  return cfg
}

function ProjectHeader() {
  const { projects, activeProjectId, activeSessionId, docApplying, updateProject, aiProviders, aiFunctionMap } = useAppStore()
  const project = projects.find(p => p.id === activeProjectId)
  const git = useGitInfo(project?.path)
  const [launching, setLaunching] = useState(false)
  const [started, setStarted] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)
  const [cfgPort, setCfgPort] = useState('')
  const [cfgCmd, setCfgCmd] = useState('')
  const [detecting, setDetecting] = useState(false)
  const [refreshingDocs, setRefreshingDocs] = useState(false)
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null)
  const gearRef = useRef<HTMLButtonElement>(null)
  const fileCfg = useProjectConfig(project?.path)

  const noGit  = git !== null && !git?.hasGit
  const branch = git?.branch    ?? project?.branch ?? '…'
  const dirty  = git?.dirty     ?? 0
  const lastCommit = git?.lastCommit ?? ''
  const isDocApplying = project ? (docApplying[project.id] ?? false) : false

  const devPort = project?.appPort    ?? fileCfg?.port    ?? undefined
  const devCmd  = project?.appStartCmd ?? fileCfg?.startCmd ?? undefined
  const hasDevServer = !!devCmd

  // Sync file config back to store once
  useEffect(() => {
    if (!project || !fileCfg) return
    if (!project.appPort && fileCfg.port) updateProject(project.id, { appPort: fileCfg.port })
    if (!project.appStartCmd && fileCfg.startCmd) updateProject(project.id, { appStartCmd: fileCfg.startCmd })
  }, [project?.id, fileCfg?.port, fileCfg?.startCmd]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset started state when switching projects
  useEffect(() => { setStarted(false) }, [activeProjectId])

  const detectWithAI = async () => {
    if (!project?.path || detecting) return
    const provId = aiFunctionMap['devDetect']
    const provider = aiProviders.find(p => p.id === provId) ?? aiProviders[0]
    if (!provider) return
    setDetecting(true)
    try {
      const port = parseInt(cfgPort, 10) || project.appPort
      const cmd = await aiDetectStartCmd(project.path, port, provider)
      if (cmd) setCfgCmd(cmd)
    } finally { setDetecting(false) }
  }

  // ── Port heuristic from start command ──────────────────────────────────────
  const guessPort = (cmd: string, knownPort?: number): number | undefined => {
    if (knownPort) return knownPort
    const m = cmd.match(/(?:--port[= ]|PORT=|:)(\d{4,5})/)
    if (m) return parseInt(m[1])
    if (/vite|npm run dev|yarn dev|pnpm dev/.test(cmd)) return 5173
    if (/next(js)?|next dev/.test(cmd)) return 3000
    if (/react-scripts|react-app/.test(cmd)) return 3000
    if (/flask/.test(cmd)) return 5000
    if (/manage\.py|django/.test(cmd)) return 8000
    if (/uvicorn|fastapi/.test(cmd)) return 8000
    if (/rails/.test(cmd)) return 3000
    if (/cargo run/.test(cmd)) return 3000
    return undefined
  }

  // ── Detect extra ports (backend) from package.json proxy field ──────────────
  const detectExtraPorts = async (projectPath: string): Promise<number[]> => {
    const extras: number[] = []
    try {
      const r = await fetch(`/api/file-read?path=${encodeURIComponent(projectPath + '/package.json')}`)
      const d = await r.json() as { ok: boolean; content?: string }
      if (d.ok && d.content) {
        const pkg = JSON.parse(d.content) as Record<string, unknown>
        // CRA proxy: "proxy": "http://localhost:3001"
        if (typeof pkg.proxy === 'string') {
          const m = pkg.proxy.match(/:(\d{4,5})/)
          if (m) extras.push(parseInt(m[1]))
        }
      }
    } catch { /* ignore */ }
    // Also check vite.config for proxy targets
    try {
      for (const cfgFile of ['vite.config.ts', 'vite.config.js', 'vite.config.mjs']) {
        const r = await fetch(`/api/file-read?path=${encodeURIComponent(projectPath + '/' + cfgFile)}`)
        const d = await r.json() as { ok: boolean; content?: string }
        if (d.ok && d.content) {
          // Extract ports from proxy targets: 'http://localhost:3001' or 'http://127.0.0.1:8000'
          const matches = d.content.matchAll(/['"]https?:\/\/(?:localhost|127\.0\.0\.1):(\d{4,5})['"]/g)
          for (const m of matches) extras.push(parseInt(m[1]))
          break
        }
      }
    } catch { /* ignore */ }
    return [...new Set(extras)]
  }

  const runLaunch = async (cmd: string, port: number | undefined) => {
    if (!project?.path) return
    setLaunching(true)
    try {
      const extraPorts = await detectExtraPorts(project.path)
      const r = await fetch('/api/start-app', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath: project.path, port, startCmd: cmd, extraPorts }),
      })
      const d = await r.json() as { ok: boolean; pid?: number }
      if (d.ok) setStarted(true)
      // server already does exec('open http://...') via macOS 'open' — window.open fallback for non-macOS
      if (d.ok && port && !navigator.userAgent.includes('Electron')) {
        setTimeout(() => window.open(`http://localhost:${port}`, '_blank'), 3000)
      }
    } finally {
      setLaunching(false)
    }
  }

  const launchDevServer = async () => {
    if (!devCmd || launching) return
    await runLaunch(devCmd, devPort)
  }

  // ── Smart launch: auto-detect if no cmd configured ──────────────────────────
  const smartLaunch = async () => {
    if (launching || detecting) return
    if (!project?.path) return

    // Already configured — launch directly
    if (devCmd) { await runLaunch(devCmd, devPort); return }

    // Auto-detect via AI
    const provId = aiFunctionMap['devDetect']
    const provider = aiProviders.find(p => p.id === provId) ?? aiProviders[0]
    if (!provider) { openConfig(); return }

    setDetecting(true)
    try {
      const cmd = await aiDetectStartCmd(project.path, project.appPort, provider)
      if (!cmd) { openConfig(); return }

      const port = guessPort(cmd, project.appPort)
      // Persist so next click is instant
      updateProject(project.id, { appStartCmd: cmd, ...(port ? { appPort: port } : {}) })
      await runLaunch(cmd, port)
    } finally {
      setDetecting(false)
    }
  }

  const doRefreshDocs = async () => {
    if (!project?.path || refreshingDocs) return
    setRefreshingDocs(true)
    try { await refreshProjectDocs(project.path) }
    finally { setRefreshingDocs(false) }
  }

  const openConfig = () => {
    setCfgPort(String(devPort ?? ''))
    setCfgCmd(devCmd ?? '')
    if (gearRef.current) {
      const r = gearRef.current.getBoundingClientRect()
      setPopoverPos({ top: r.bottom + 6, left: r.left })
    }
    setConfigOpen(true)
  }

  const saveConfig = async () => {
    if (!project) return
    const port = parseInt(cfgPort, 10) || undefined
    const cmd  = cfgCmd.trim() || undefined
    updateProject(project.id, { appPort: port, appStartCmd: cmd })
    if (port || cmd) {
      const cfg = { port: port ?? null, startCmd: cmd ?? null, appUrl: port ? `http://localhost:${port}` : null }
      await fetch('/api/file-write', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: `${project.path}/project.config.json`, content: JSON.stringify(cfg, null, 2) }) })
    }
    setConfigOpen(false)
  }

  // Listen to events from Workspace titlebar buttons
  useEffect(() => {
    const onPlay   = () => { smartLaunch() }
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
  }, [launching, detecting, devCmd, devPort, project, aiProviders, aiFunctionMap]) // eslint-disable-line react-hooks/exhaustive-deps

  void activeSessionId

  // Render nothing visible — just the config modal when open
  return (
    <>
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
                    disabled={detecting || aiProviders.length === 0}
                    title={aiProviders.length === 0 ? 'Kein AI-Anbieter konfiguriert' : 'Start-Befehl per AI ermitteln'}
                    style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, border: '1px solid var(--line-strong)', borderRadius: 6, background: 'var(--bg-1)', color: detecting ? 'var(--accent)' : aiProviders.length === 0 ? 'var(--fg-3)' : 'var(--accent)', cursor: (detecting || aiProviders.length === 0) ? 'not-allowed' : 'pointer', opacity: aiProviders.length === 0 ? 0.4 : 1 }}
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
    border: '1px solid var(--line-strong)', background: 'var(--bg-2)',
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
      gap: 22, padding: '32px 28px', minHeight: 0,
    }}>
      {/* Logo + heading */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <img src={simpleLogo} alt="Codera AI" style={{ width: 52, height: 52, opacity: 0.55 }} />
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-0)' }}>Kein Projekt angelegt</div>
      </div>

      <div style={{ width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Workspace section */}
        <div>
          <div
            style={card}
            onClick={() => setNewProjectOpen(true)}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--line-strong)')}
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
        </div>

        {/* Setup section — only when not yet configured */}
        {!isConfigured && (
          <div>
            <div style={sectionLabel}>Einrichtung</div>
            <div
              style={card}
              onClick={() => window.dispatchEvent(new CustomEvent('cc:open-getting-started'))}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--line-strong)')}
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
          </div>
        )}

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
    border: '1px solid var(--line-strong)', background: 'var(--bg-2)',
    cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8,
    transition: 'border-color 0.15s',
  }

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 22, padding: '32px 28px', minHeight: 0,
    }}>
      {/* Logo + heading */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <img src={simpleLogo} alt="Codera AI" style={{ width: 52, height: 52 }} />
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-0)' }}>Keine aktive Session</div>
      </div>

      {/* Session-Typ Karten */}
      <div style={{ width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* Coding row: Terminal + Coding Agent */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div
            style={card}
            onClick={() => openKind('single')}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--line-strong)')}
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
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--line-strong)')}
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
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--line-strong)')}
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
          <img src={simpleLogo} alt="" style={{ width: 11, height: 11, filter: hovered ? 'brightness(0) invert(1)' : 'none', transition: 'filter 0.15s' }} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{alias.name}</span>
      </div>
      <div style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginLeft: 26 }}>
        {alias.cmd}{alias.args ? ' ' + alias.args : ''}
      </div>
    </div>
  )
}

function TerminalPane() {
  const { turns, allowTool, denyTool } = useAppStore()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [turns])

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px 22px', fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.55, color: 'var(--fg-1)', minHeight: 0 }}>
      {turns.map(turn => <Turn key={turn.id} turn={turn} onAllow={allowTool} onDeny={denyTool} />)}
      <div ref={bottomRef} />
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

// ── Template context-menu row ─────────────────────────────────────────────────

function TplCtxItem({ label, onClick }: { label: string; onClick: () => void }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ padding: '6px 14px', cursor: 'pointer', fontSize: 11.5, color: 'var(--fg-0)', background: hov ? 'var(--accent-soft)' : 'transparent', userSelect: 'none' }}
    >
      {label}
    </div>
  )
}

// ── Edit template modal ───────────────────────────────────────────────────────

function EditTemplateModal({ template, onClose }: { template: Template; onClose: () => void }) {
  const { updateTemplate } = useAppStore()
  const [name, setName] = useState(template.name)
  const [body, setBody] = useState(template.body)
  const [hint, setHint] = useState(template.hint ?? '')

  const save = () => {
    if (!name.trim() || !body.trim()) return
    updateTemplate(template.id, { name: name.trim(), body: body.trim(), hint: hint.trim() })
    onClose()
  }

  const fl: React.CSSProperties = { display: 'block', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.7, color: 'var(--fg-3)', fontWeight: 500, marginBottom: 5 }
  const fi: React.CSSProperties = { width: '100%', padding: '7px 10px', border: '1px solid var(--line-strong)', borderRadius: 6, background: 'var(--bg-2)', color: 'var(--fg-0)', fontSize: 12, fontFamily: 'var(--font-ui)', outline: 'none', boxSizing: 'border-box' }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'var(--bg-1)', border: '1px solid var(--line-strong)', borderRadius: 6, boxShadow: '0 16px 48px rgba(0,0,0,0.4)', width: 440, padding: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg-0)', marginBottom: 18 }}>Template bearbeiten</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
          <div>
            <label style={fl}>Name</label>
            <input style={fi} value={name} onChange={e => setName(e.target.value)} autoFocus />
          </div>
          <div>
            <label style={fl}>Inhalt</label>
            <textarea style={{ ...fi, resize: 'vertical', minHeight: 90, fontFamily: 'var(--font-mono)', lineHeight: 1.5 }} value={body} onChange={e => setBody(e.target.value)} />
          </div>
          <div>
            <label style={fl}>Hint (optional)</label>
            <input style={fi} value={hint} onChange={e => setHint(e.target.value)} placeholder="z.B. /check" />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--line-strong)', borderRadius: 6, padding: '6px 14px', color: 'var(--fg-1)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-ui)' }}>
            Abbrechen
          </button>
          <button onClick={save} disabled={!name.trim() || !body.trim()} style={{ background: 'var(--accent)', border: 'none', borderRadius: 6, padding: '6px 14px', color: 'var(--accent-fg)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)', opacity: (!name.trim() || !body.trim()) ? 0.5 : 1 }}>
            Speichern
          </button>
        </div>
      </div>
    </div>
  )
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
  return (
    <div ref={wrapRef} style={{ flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
      <InputArea containerWidth={width} />
    </div>
  )
}

function InputArea({ containerWidth = 9999 }: { containerWidth?: number }) {
  const {
    inputValue, setInputValue, sendMessage, templates, updateTemplate,
    projects, activeProjectId, activeSessionId,
    playwrightCheck, setPlaywrightCheck,
    localhostCheck, setLocalhostCheck,
    aiProviders, activeAiProvider, aiFunctionMap,
    terminalShortcuts, docTemplates,
    terminalTheme, theme: appTheme,
    currentUser,
    orbitCtxBefore, orbitCtxAfter,
    supabaseUrl, supabaseAnonKey,
    pendingWorkshopTransfer, clearWorkshopTransfer,
  } = useAppStore()
  const [attachments, setAttachments]   = useState<string[]>([])
  const [picking, setPicking]           = useState(false)
  const [recording, setRecording]       = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const mediaRef  = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const [editTemplate, setEditTemplate] = useState<Template | null>(null)
  const [tplMenu, setTplMenu]           = useState<{ x: number; y: number; tpl: Template } | null>(null)
  const [aiRefining, setAiRefining]     = useState(false)
  const [aiAnalysing, setAiAnalysing]   = useState(false)
  const [aiError, setAiError]           = useState('')
  const [pathInput, setPathInput]       = useState<'file' | 'image' | null>(null)
  const [pathInputVal, setPathInputVal] = useState('')
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [focused, setFocused] = useState(false)
  const isOrbit = projects.flatMap(p => p.sessions).find(s => s.id === activeSessionId)?.kind === 'orbit'
  const [attachPreviewSrc, setAttachPreviewSrc] = useState<string | null>(null)
  const borderWrapRef = useRef<HTMLDivElement>(null)
  // ── Chat history (ArrowUp/Down to cycle through last 20 sent messages) ───────
  const chatHistoryRef  = useRef<string[]>([])
  const historyIndexRef = useRef(-1)   // -1 = not navigating


  // ── R2 file attachments ────────────────────────────────────────────────────
  const userId = currentUser?.id
  const { files: pendingFiles, addFiles, removeFile: removePendingFile, replaceFile, clearFiles, buildUrlSuffix, hasUploading } = useFileAttachments(userId, 'image-text-context')
  const [annotatingFileId, setAnnotatingFileId] = useState<string | null>(null)
  const annotatingFile = annotatingFileId ? pendingFiles.find(f => f.id === annotatingFileId) ?? null : null
  const isDragOver = useDragDrop(addFiles, 6, pendingFiles.length)
  usePasteFiles(addFiles)

  // Derived session state — computed early so the ref-detection useEffect can use them
  const project       = projects.find(p => p.id === activeProjectId)
  const activeSession = project?.sessions.find(s => s.id === activeSessionId)
  const isTerminal    = !!activeSession

  // ── Orbit reference detection ──────────────────────────────────────────────
  type RefStatus = 'checking' | 'found' | 'missing'
  const [orbitRefs, setOrbitRefs] = useState<Map<string, RefStatus>>(new Map())
  const refTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // Ref detection runs for orbit and agent sessions — skip only for PTY terminal sessions
    if (isTerminal && !isOrbit) return
    const REF_RE = /#(msg|chat|amsg):([a-z0-9-]{6,})/gi
    const matches = [...inputValue.matchAll(REF_RE)]
    const found = matches.map(m => `${m[1]}:${m[2]}`)
    const unique = [...new Set(found)]

    // Trim refs no longer in text
    setOrbitRefs(prev => {
      const next = new Map<string, RefStatus>()
      for (const ref of unique) next.set(ref, prev.get(ref) ?? 'checking')
      return next
    })

    // Debounced resolution for any 'checking' refs
    if (refTimerRef.current) clearTimeout(refTimerRef.current)
    refTimerRef.current = setTimeout(async () => {
      for (const ref of unique) {
        const [type, id] = ref.split(':')
        try {
          const body: Record<string, unknown> = { ref: `${type}:${id}`, ctxBefore: 0, ctxAfter: 0 }
          if (type === 'amsg' && supabaseUrl && supabaseAnonKey && currentUser?.id) {
            body.supabaseUrl = supabaseUrl
            body.supabaseKey = supabaseAnonKey
            body.userId      = currentUser.id
          }
          const r = await fetch('/api/orbit/resolve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
          const data = await r.json() as { ok: boolean }
          setOrbitRefs(prev => {
            const next = new Map(prev)
            next.set(ref, data.ok ? 'found' : 'missing')
            return next
          })
        } catch {
          setOrbitRefs(prev => { const n = new Map(prev); n.set(ref, 'missing'); return n })
        }
      }
    }, 450)

    return () => { if (refTimerRef.current) clearTimeout(refTimerRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputValue, isTerminal, isOrbit, supabaseUrl, supabaseAnonKey, currentUser?.id])

  const taRef      = useRef<HTMLTextAreaElement>(null)
  const termBg = (TERMINAL_THEMES.find(t => t.id === terminalTheme)?.theme.background)
    ?? (appTheme === 'dark' ? '#0e0d0b' : '#faf8f4')
  const recRef     = useRef<SpeechRecognition | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // drag-drop + paste handled by useDragDrop / usePasteFiles hooks above

  const imageFiles = pendingFiles.filter(f => f.isImage)
  useEffect(() => {
    if (!attachPreviewSrc) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setAttachPreviewSrc(null) }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [attachPreviewSrc])

  // Insert a #msg: / #chat: reference into the input (fired by clicking ID badges in AgentView / OrbitView)
  useEffect(() => {
    const onInsertRef = (e: Event) => {
      const ref = (e as CustomEvent<string>).detail
      if (!ref) return
      setInputValue(prev => prev ? prev + ' ' + ref : ref)
    }
    window.addEventListener('cc:insert-ref', onInsertRef)
    return () => window.removeEventListener('cc:insert-ref', onInsertRef)
  }, [])

  // Auto-grow textarea + sync outer container (re-runs when files are added/removed)
  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    const next = Math.min(Math.max(ta.scrollHeight, 68), 600)
    ta.style.height = next + 'px'
  }, [inputValue, pendingFiles.length])

  // ── Workshop transfer: inject text + element refs + images on return ────────
  useEffect(() => {
    if (!pendingWorkshopTransfer) return
    const { text, elementRefs, imageDataUrls } = pendingWorkshopTransfer
    // Build element-ref appendix
    const refLines = elementRefs.map(r => {
      const lines: string[] = []
      const selector = r.tag + (r.id ? '#'+r.id : r.classes[0] ? '.'+r.classes[0] : '')
      lines.push(`Komponente: ${r.component ?? selector}`)
      if (r.page)      lines.push(`  Seite: ${r.page}`)
      if (r.position)  lines.push(`  Position: ${r.position}`)
      if (r.hierarchy) lines.push(`  Pfad: ${r.hierarchy}`)
      if (r.selector && r.selector !== selector) lines.push(`  Selektor: ${r.selector}`)
      if (r.text)      lines.push(`  Text: "${r.text}"`)
      return lines.join('\n')
    })
    const appendix = refLines.length
      ? `\n\n── Erfasste UI-Elemente ──\n${refLines.join('\n\n')}`
      : ''
    setInputValue(text + appendix)

    // Convert dataUrls to File objects and add them as pending files
    if (imageDataUrls.length > 0) {
      void Promise.all(
        imageDataUrls.map(async (url, i) => {
          const res  = await fetch(url)
          const blob = await res.blob()
          return new File([blob], `workshop_${i+1}.png`, { type: 'image/png' })
        })
      ).then(files => addFiles(files))
    }

    clearWorkshopTransfer()
  }, [pendingWorkshopTransfer]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    setAttachments(prev => [...prev, ...files.map(f => f.name)])
    e.target.value = ''
  }

  const removeAttachment = (name: string) => {
    setAttachments(prev => prev.filter(a => a !== name))
  }

  const insertFullPath = (fullPath: string, mode: 'file' | 'image') => {
    const p = fullPath.trim()
    if (!p) return
    const quoted = p.includes(' ') ? `"${p}"` : p
    const insert = mode === 'image' ? `--image ${quoted}` : quoted
    setInputValue(prev => prev ? prev + ' ' + insert : insert)
  }

  const confirmPathInput = () => {
    if (pathInput && pathInputVal.trim()) {
      insertFullPath(pathInputVal.trim(), pathInput)
    }
    setPathInput(null)
    setPathInputVal('')
    // DOM layout change can disrupt xterm canvas — force repaint after React flushes
    setTimeout(() => window.dispatchEvent(new CustomEvent('cc:terminal-refresh')), 50)
  }

  const toBase64 = (file: File): Promise<string> => new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = rej
    r.readAsDataURL(file)
  })

  const dispatchOrbit = (fullMsg: string, images: { dataUrl: string; mimeType: string }[]) => {
    window.dispatchEvent(new CustomEvent('cc:orbit-send', { detail: { sessionId: activeSessionId, text: fullMsg, images } }))
    setInputValue('')
    setAttachments([])
    clearFiles()
  }

  const send = () => {
    const favBodies = templates.filter(t => t.favorite).map(t => t.body)
    if (!inputValue.trim() && attachments.length === 0 && favBodies.length === 0 && pendingFiles.length === 0) return
    if (hasUploading) return  // wait for uploads to finish

    // Save to history (max 20, no duplicates at top)
    if (inputValue.trim()) {
      const h = chatHistoryRef.current
      if (h[0] !== inputValue.trim()) {
        chatHistoryRef.current = [inputValue.trim(), ...h].slice(0, 20)
      }
      historyIndexRef.current = -1
    }

    let fullMsg = inputValue
    if (favBodies.length > 0) fullMsg += (fullMsg ? '\n\n' : '') + favBodies.join('\n\n')

    if (activeSession?.kind === 'orbit') {
      // Orbit: send images as base64 directly so the AI can see them
      // Also append R2 URLs for non-image files
      const imageFiles = pendingFiles.filter(f => f.isImage && f.file)
      const docFiles   = pendingFiles.filter(f => !f.isImage && f.status === 'done' && f.url)
      if (docFiles.length > 0) {
        fullMsg += '\n\n' + docFiles.map(f => `[Datei: ${f.name}](${f.url})`).join('\n')
      }
      if (imageFiles.length === 0) {
        dispatchOrbit(fullMsg, [])
      } else {
        Promise.all(imageFiles.map(img =>
          toBase64(img.file).then(dataUrl => ({ dataUrl, mimeType: img.mimeType }))
        )).then(images => dispatchOrbit(fullMsg, images))
      }
    } else if (isTerminal) {
      // Terminal: write images to local temp files → --image "/tmp/..." (CLI needs a local path)
      // Docs keep their proxy URL as reference text
      const imageFiles = pendingFiles.filter(f => f.isImage && f.file)
      const doneDocs   = pendingFiles.filter(f => !f.isImage && f.status === 'done' && f.url)
      if (doneDocs.length > 0) fullMsg += '\n' + doneDocs.map(f => `[${f.name}]: ${f.url}`).join('\n')

      const writeTempAndSend = async () => {
        let msg = await resolveRefs(fullMsg, orbitCtxBefore, orbitCtxAfter)
        if (imageFiles.length > 0) {
          const paths = await Promise.all(imageFiles.map(async f => {
            try {
              const res = await fetch('/api/write-temp-image', {
                method: 'POST',
                headers: {
                  'Content-Type': f.mimeType || 'application/octet-stream',
                  'X-File-Name': encodeURIComponent(f.name),
                },
                body: f.file,
              })
              const data = await res.json() as { ok: boolean; path?: string }
              return data.ok && data.path ? data.path : null
            } catch { return null }
          }))
          const valid = paths.filter(Boolean) as string[]
          if (valid.length > 0) msg += ' ' + valid.map(p => `--image "${p}"`).join(' ')
        }
        window.dispatchEvent(new CustomEvent('cc:terminal-paste', { detail: { sessionId: activeSessionId, data: msg } }))
        setInputValue('')
        clearFiles()
      }

      void writeTempAndSend()
      return // async path handles setInputValue/clearFiles
    } else {
      // Agent session: resolve any embedded #msg:/#chat:/#amsg: refs before sending
      const sendWithRefs = async () => {
        const resolved = await resolveRefs(fullMsg, orbitCtxBefore, orbitCtxAfter, supabaseUrl, supabaseAnonKey, currentUser?.id)
        sendMessage(attachments, resolved)
        setAttachments([])
        setInputValue('')
        clearFiles()
      }
      void sendWithRefs()
      return // async path handles setInputValue/clearFiles
    }
  }

  const refineWithAI = async () => {
    if (!inputValue.trim()) return
    const terminalProviderId = aiFunctionMap['terminal'] || activeAiProvider
    const provider = aiProviders.find(p => p.id === terminalProviderId) ?? aiProviders[0]
    if (!provider) { setAiError('Kein AI-Anbieter konfiguriert. Bitte unter Settings → AI einrichten.'); return }
    setAiRefining(true)
    setAiError('')
    const textRefinePrompt = docTemplates.find(t => t.id === 'ai-prompt-text-refine')?.content
    try {
      const r = await fetch('/api/ai-refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: provider.provider, apiKey: provider.apiKey, model: provider.model, text: inputValue, ...(textRefinePrompt ? { systemPrompt: textRefinePrompt } : {}) }),
      })
      const d = await r.json() as { ok: boolean; text?: string; error?: string }
      if (d.ok && d.text) setInputValue(d.text)
      else setAiError(d.error ?? 'Fehler beim Überarbeiten')
    } catch (e) { setAiError(String(e)) }
    setAiRefining(false)
  }

  const analyseWithAI = async () => {
    if (!inputValue.trim()) return
    const terminalProviderId = aiFunctionMap['terminal'] || activeAiProvider
    const provider = aiProviders.find(p => p.id === terminalProviderId) ?? aiProviders[0]
    if (!provider) { setAiError('Kein AI-Anbieter konfiguriert. Bitte unter Settings → AI einrichten.'); return }
    setAiAnalysing(true)
    setAiError('')
    const analysePrompt = docTemplates.find(t => t.id === 'user-story-analyse')?.content
    try {
      let userMsg = inputValue
      if (project?.path) {
        try {
          const docsRes = await fetch(`/api/read-docs?path=${encodeURIComponent(project.path)}`)
          const docsData = await docsRes.json() as { ok: boolean; files?: { filename: string; content: string }[] }
          if (docsData.ok && docsData.files?.length) {
            const docsContext = docsData.files.map(f => `### ${f.filename}\n${f.content}`).join('\n\n---\n\n')
            userMsg = `${inputValue}\n\n---\n\nPROJEKT-DOKUMENTATION:\n${docsContext}`
          }
        } catch { /* no docs — proceed without */ }
      }
      const r = await fetch('/api/ai-refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: provider.provider, apiKey: provider.apiKey, model: provider.model, text: userMsg, ...(analysePrompt ? { systemPrompt: analysePrompt } : {}) }),
      })
      const d = await r.json() as { ok: boolean; text?: string; error?: string }
      if (d.ok && d.text) setInputValue(d.text)
      else setAiError(d.error ?? 'Fehler bei der Analyse')
    } catch (e) { setAiError(String(e)) }
    setAiAnalysing(false)
  }

  const toggleVoice = async () => {
    if (recording) {
      mediaRef.current?.stop()
      recRef.current?.stop()
      setRecording(false)
      return
    }

    // Prefer Whisper via Groq (free) or OpenAI
    const openAiProv = aiProviders.find(p => (p.provider === 'groq' || p.provider === 'openai') && p.apiKey)

    if (openAiProv) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus' : 'audio/webm'
        const recorder = new MediaRecorder(stream, { mimeType })
        chunksRef.current = []
        recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
        recorder.onstop = async () => {
          stream.getTracks().forEach(t => t.stop())
          setTranscribing(true)
          try {
            const blob = new Blob(chunksRef.current, { type: mimeType })
            const r = await fetch('/api/transcribe', {
              method: 'POST', body: blob,
              headers: { 'x-api-key': openAiProv.apiKey, 'x-provider': openAiProv.provider, 'x-language': 'de', 'Content-Type': mimeType },
            })
            const d = await r.json() as { ok: boolean; text?: string }
            if (d.ok && d.text) setInputValue(prev => prev ? prev + ' ' + d.text : d.text!)
          } catch {}
          setTranscribing(false)
        }
        recorder.start()
        mediaRef.current = recorder
        setRecording(true)
      } catch { setRecording(false) }
      return
    }

    // Fallback: Web Speech API
    const SR = (window as unknown as { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition
      ?? (window as unknown as { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition
    if (!SR) return
    const rec = new SR()
    rec.continuous = false; rec.interimResults = false; rec.lang = 'de-DE'
    rec.onresult = (e: SpeechRecognitionEvent) => {
      const t = Array.from(e.results).map(r => r[0].transcript).join('')
      setInputValue(prev => prev ? prev + ' ' + t : t)
    }
    rec.onend = () => setRecording(false)
    rec.onerror = () => setRecording(false)
    rec.start(); recRef.current = rec; setRecording(true)
  }

  const sendRaw = (signal: string) => {
    window.dispatchEvent(new CustomEvent('cc:terminal-send-raw', { detail: { sessionId: activeSessionId, data: signal } }))
  }

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter (no shift) → send command
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); return }

    if (!isTerminal) return

    const ta = e.currentTarget

    // Tab → send completion signal
    const tabSc = terminalShortcuts.find(s => s.id === 'tab' && s.enabled)
    if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey && tabSc) {
      e.preventDefault()
      sendRaw(tabSc.signal)
      return
    }

    // Arrow Up/Down → chat message history (when input is empty or navigating)
    if (e.key === 'ArrowUp' && !e.ctrlKey && !e.metaKey && !isTerminal) {
      const h = chatHistoryRef.current
      if (h.length > 0 && (ta.value === '' || historyIndexRef.current >= 0)) {
        e.preventDefault()
        const next = Math.min(historyIndexRef.current + 1, h.length - 1)
        historyIndexRef.current = next
        setInputValue(h[next])
        setTimeout(() => { ta.selectionStart = ta.selectionEnd = ta.value.length }, 0)
        return
      }
    }
    if (e.key === 'ArrowDown' && !e.ctrlKey && !e.metaKey && !isTerminal && historyIndexRef.current >= 0) {
      e.preventDefault()
      const next = historyIndexRef.current - 1
      historyIndexRef.current = next
      setInputValue(next < 0 ? '' : chatHistoryRef.current[next])
      setTimeout(() => { ta.selectionStart = ta.selectionEnd = ta.value.length }, 0)
      return
    }

    // Arrow Up/Down → history navigation (only when textarea is single-line or cursor at edge)
    if (e.key === 'ArrowUp' && !e.ctrlKey && !e.metaKey) {
      const sc = terminalShortcuts.find(s => s.id === 'arrow-up' && s.enabled)
      if (sc && (ta.value === '' || ta.selectionStart === 0)) {
        e.preventDefault()
        sendRaw(sc.signal)
        return
      }
    }
    if (e.key === 'ArrowDown' && !e.ctrlKey && !e.metaKey) {
      const sc = terminalShortcuts.find(s => s.id === 'arrow-down' && s.enabled)
      if (sc && (ta.value === '' || ta.selectionStart === ta.value.length)) {
        e.preventDefault()
        sendRaw(sc.signal)
        return
      }
    }

    // Ctrl+X shortcuts → send control characters
    if (e.ctrlKey && !e.metaKey) {
      const k = e.key.toLowerCase()
      const sc = terminalShortcuts.find(s => s.ctrl && s.key.toLowerCase() === k && s.enabled)
      if (sc) {
        e.preventDefault()
        sendRaw(sc.signal)
      }
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: `0px ${containerWidth < 680 ? '16px' : '100px'} 36px`, background: 'var(--bg-0)', position: 'relative' }}>
      <style>{`
        @property --orbit-angle {
          syntax: '<angle>';
          initial-value: 0deg;
          inherits: false;
        }
        @keyframes orbit-angle-spin {
          to { --orbit-angle: 360deg; }
        }
      `}</style>
      <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={handleAttach} />

      {/* Drag overlay — always in DOM so drop events always fire; visibility toggled via opacity/pointer-events */}
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 999,
          background: 'rgba(249,115,22,0.07)',
          border: '2px dashed rgba(249,115,22,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12,
          opacity: isDragOver ? 1 : 0,
          pointerEvents: 'none',
          transition: 'opacity 0.15s',
        }}
      >
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(249,115,22,0.85)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        <span style={{ fontSize: 14, color: 'rgba(249,115,22,0.9)', fontWeight: 600 }}>Bilder hier ablegen</span>
      </div>

      {/* Attachment image preview — floats above textbox, not fullscreen */}
      {attachPreviewSrc && (() => {
        const rect = borderWrapRef.current?.getBoundingClientRect()
        const bottom = rect ? window.innerHeight - rect.top + 8 : 200
        const previewFile = pendingFiles.find(f => f.previewUrl === attachPreviewSrc || f.url === attachPreviewSrc)
        return (
          <div
            onClick={() => setAttachPreviewSrc(null)}
            style={{
              position: 'fixed', left: 0, right: 0,
              bottom, zIndex: 200,
              display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
              cursor: 'zoom-out',
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                position: 'relative', borderRadius: 8,
                boxShadow: '0 8px 40px rgba(0,0,0,0.55)',
                overflow: 'hidden', cursor: 'default', maxWidth: '80vw',
              }}
            >
              <img
                src={attachPreviewSrc}
                style={{ display: 'block', maxWidth: '80vw', maxHeight: '62vh', objectFit: 'contain' }}
                alt=""
              />
              {/* Top bar with buttons */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 10px',
                background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 100%)',
              }}>
                {/* Bild bearbeiten — only if it's a pending file */}
                {previewFile ? (
                  <button
                    onClick={() => { setAttachPreviewSrc(null); setAnnotatingFileId(previewFile.id) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '5px 12px', borderRadius: 6,
                      background: 'var(--accent)', border: 'none',
                      cursor: 'pointer', color: '#fff',
                      fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-ui)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                    }}
                  >
                    <IEdit style={{ width: 12, height: 12 }} />
                    Bild bearbeiten
                  </button>
                ) : <div />}
                {/* Close */}
                <button
                  onClick={() => setAttachPreviewSrc(null)}
                  style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.2)',
                    cursor: 'pointer', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                  }}
                >
                  <IClose style={{ width: 12, height: 12 }} />
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Inline path input — shown when Pfad/Bild button is active */}
      {isTerminal && pathInput && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, padding: '5px 8px', background: 'var(--bg-3)', border: '1px solid var(--accent)', borderRadius: 6 }}>
          <IFile style={{ color: 'var(--accent)', flexShrink: 0, width: 11, height: 11 }} />
          <input
            autoFocus
            value={pathInputVal}
            onChange={e => setPathInputVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') confirmPathInput(); if (e.key === 'Escape') { setPathInput(null); setPathInputVal(''); setTimeout(() => window.dispatchEvent(new CustomEvent('cc:terminal-refresh')), 50) } }}
            onDrop={e => { e.preventDefault(); const txt = e.dataTransfer.getData('text/plain'); const file = Array.from(e.dataTransfer.files)[0] as (File & { path?: string }) | undefined; const p = txt || file?.path || file?.name || ''; if (p) setPathInputVal(p) }}
            onDragOver={e => e.preventDefault()}
            placeholder={pathInput === 'image' ? 'Pfad eintippen oder Bild aus Finder hier reinziehen…' : 'Pfad eintippen oder Datei aus Finder hier reinziehen…'}
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 11.5, color: 'var(--fg-0)', fontFamily: 'var(--font-mono)' }}
          />
          <button onClick={confirmPathInput} disabled={!pathInputVal.trim()} style={{ background: 'var(--accent)', border: 'none', borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 600, color: 'var(--accent-fg, #1a1410)', cursor: pathInputVal.trim() ? 'pointer' : 'default', opacity: pathInputVal.trim() ? 1 : 0.4 }}>
            Einfügen
          </button>
          <button onClick={() => { setPathInput(null); setPathInputVal(''); setTimeout(() => window.dispatchEvent(new CustomEvent('cc:terminal-refresh')), 50) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-3)', display: 'flex', padding: 2 }}>
            <IClose style={{ width: 10, height: 10 }} />
          </button>
        </div>
      )}

      {/* ── Border wrapper ── */}
      <div ref={borderWrapRef} style={{
        flexShrink: 0, borderRadius: 6, padding: isOrbit ? 1 : 0,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)', position: 'relative', overflow: 'hidden',
        border: isOrbit ? 'none' : `1px solid ${focused ? 'var(--accent)' : 'var(--line-strong)'}`,
        ...(isOrbit ? {
          background: 'conic-gradient(from var(--orbit-angle), #3b82f6, #8b5cf6, #a855f7, #6366f1, #818cf8, #60a5fa, #7c3aed, #3b82f6)',
          animation: 'orbit-angle-spin 3s linear infinite',
        } : {}),
      }}>
        {/* Inner content */}
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', borderRadius: isOrbit ? 6 : 6, background: 'var(--bg-1)', padding: '8px 12px 6px', overflow: 'visible' }}>
        {/* File attachments (images + documents) */}
        <DragOverlay visible={isDragOver} maxReached={pendingFiles.length >= 6} />
        <FileAttachmentBar files={pendingFiles} onRemove={removePendingFile} onPreview={setAttachPreviewSrc} onAnnotate={setAnnotatingFileId} />
        {attachments.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 6 }}>
            {attachments.map(p => {
              const label = isTerminal ? p.split('/').pop() ?? p : p
              const title = isTerminal ? p : undefined
              return (
                <span key={p} title={title} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 6px 2px 7px', background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 6, fontSize: 10.5, color: 'var(--fg-1)', fontFamily: 'var(--font-mono)', maxWidth: 280 }}>
                  <IFile style={{ color: 'var(--accent)', flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
                  <IClose style={{ color: 'var(--fg-3)', cursor: 'pointer', marginLeft: 2, flexShrink: 0 }} onClick={() => removeAttachment(p)} />
                </span>
              )
            })}
          </div>
        )}

        <textarea
          ref={taRef}
          value={inputValue}
          onChange={e => { historyIndexRef.current = -1; setInputValue(e.target.value) }}
          onKeyDown={handleKey}
          // Prevent binary file drops into the terminal — they cause xterm to go black
          onDragOver={isTerminal ? e => e.preventDefault() : undefined}
          onDrop={isTerminal ? e => e.preventDefault() : undefined}
          placeholder={isTerminal ? 'Befehl eingeben oder Text tippen…' : isOrbit ? 'Schreib etwas an Orbit… · ⏎ Senden · ⇧⏎ Neue Zeile' : 'Nachricht an den Agenten… · ⏎ Senden · ⇧⏎ Neue Zeile'}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-0)', background: 'transparent', border: 'none', outline: 'none', resize: 'vertical', width: '100%', minHeight: 68, maxHeight: 600 }}
        />


        {/* ── Reference pills (orbit + agent sessions, not PTY terminal) ── */}
        {!(isTerminal && !isOrbit) && orbitRefs.size > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, padding: '5px 0 2px' }}>
            {[...orbitRefs.entries()].map(([ref, status]) => {
              const [type, id] = ref.split(':')
              const short = id.slice(-8)
              const isChecking = status === 'checking'
              const isFound    = status === 'found'
              const color      = isChecking ? 'var(--fg-3)' : isFound ? 'var(--ok)' : 'var(--err)'
              const bg         = isChecking ? 'var(--bg-3)' : isFound ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)'
              const border     = isChecking ? 'var(--line-strong)' : isFound ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)'
              const dot        = isChecking ? '···' : isFound ? '✓' : '✗'
              const typeColor  = type === 'chat' ? 'var(--orbit)' : type === 'amsg' ? 'var(--fg-2)' : 'var(--accent)'
              return (
                <span key={ref} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px 2px 7px', background: bg, border: `1px solid ${border}`, borderRadius: 99, fontSize: 10, fontFamily: 'var(--font-mono)', color, transition: 'background 0.2s, border-color 0.2s, color 0.2s', whiteSpace: 'nowrap' }}>
                  <span style={{ opacity: 0.6 }}>#</span>
                  <span style={{ color: typeColor, opacity: 0.9 }}>{type}:</span>
                  <span>{short}</span>
                  <span style={{ marginLeft: 2, fontFamily: 'var(--font-ui)', fontWeight: isChecking ? 400 : 600, opacity: isChecking ? 0.5 : 1 }}>{dot}</span>
                </span>
              )
            })}
          </div>
        )}

        {/* Favorite templates — always auto-included on send */}
        {templates.some(t => t.favorite) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, padding: '5px 0 4px', borderTop: '1px solid var(--line)', alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: 'var(--fg-3)', letterSpacing: 0.3, userSelect: 'none' }}>auto:</span>
            {templates.filter(t => t.favorite).map(t => (
              <span
                key={t.id}
                title={t.body}
                onContextMenu={e => { e.preventDefault(); setTplMenu({ x: e.clientX, y: e.clientY, tpl: t }) }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px 2px 6px', background: 'var(--accent-soft)', border: '1px solid var(--accent-line)', borderRadius: 99, color: 'var(--accent)', fontSize: 10.5, userSelect: 'none' }}
              >
                <span style={{ fontSize: 10 }}>★</span>
                {t.name}
                <span
                  title="Aus Favoriten entfernen"
                  onClick={() => updateTemplate(t.id, { favorite: false })}
                  style={{ marginLeft: 2, lineHeight: 1, cursor: 'pointer', opacity: 0.6, fontSize: 11, display: 'flex', alignItems: 'center' }}
                >×</span>
              </span>
            ))}
          </div>
        )}
        {/* Template context menu */}
        {tplMenu && (
          <div
            onClick={() => setTplMenu(null)}
            style={{ position: 'fixed', inset: 0, zIndex: 1000 }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{ position: 'fixed', left: tplMenu.x, top: tplMenu.y, zIndex: 1001, background: 'var(--bg-1)', border: '1px solid var(--line-strong)', borderRadius: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.3)', minWidth: 160, padding: '3px 0' }}
            >
              {[
                { label: 'Bearbeiten', action: () => { setEditTemplate(tplMenu.tpl); setTplMenu(null) } },
                { label: 'Aus Favoriten entfernen', action: () => { updateTemplate(tplMenu.tpl.id, { favorite: false }); setTplMenu(null) } },
              ].map(item => (
                <TplCtxItem key={item.label} label={item.label} onClick={item.action} />
              ))}
            </div>
          </div>
        )}
        {editTemplate && (
          <EditTemplateModal template={editTemplate} onClose={() => setEditTemplate(null)} />
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 5, borderTop: '1px solid var(--line)' }}>
          {isTerminal && !isOrbit ? (
            <>
              <button
                style={{ ...chip, background: pathInput ? 'var(--accent-soft)' : 'var(--bg-2)', border: `1px solid ${pathInput ? 'var(--accent)' : 'var(--line)'}`, color: pathInput ? 'var(--accent)' : 'var(--fg-2)', padding: '5px 8px' }}
                onClick={() => { setPathInput(p => p ? null : 'file'); setPathInputVal('') }}
                title="Datei oder Pfad einfügen"
              >
                <IPaperclip style={{ width: 13, height: 13, flexShrink: 0 }} />
              </button>
              <button
                style={{ ...chip, background: showShortcuts ? 'var(--accent-soft)' : 'var(--bg-2)', border: `1px solid ${showShortcuts ? 'var(--accent)' : 'var(--line)'}`, color: showShortcuts ? 'var(--accent)' : 'var(--fg-2)', padding: '5px 8px' }}
                onClick={() => setShowShortcuts(v => !v)}
                title="Terminal-Tastenkürzel anzeigen"
              >
                <IKeyboard style={{ width: 13, height: 13, flexShrink: 0 }} />
              </button>
            </>
          ) : (
            <button
              style={{ ...chip, background: 'var(--bg-2)', border: '1px solid var(--line)', color: 'var(--fg-2)', padding: '5px 8px' }}
              onClick={() => fileInputRef.current?.click()}
              title="Datei oder Bild anhängen"
            >
              <IPaperclip style={{ width: 13, height: 13, flexShrink: 0 }} />
            </button>
          )}
          <span style={{ flex: 1 }} />
          <button
            onClick={transcribing ? undefined : toggleVoice}
            disabled={transcribing}
            title={transcribing ? 'Transkribiere…' : recording ? 'Aufnahme stoppen' : 'Spracheingabe starten'}
            style={{ ...chip, padding: '5px 8px',
              color:      transcribing ? 'var(--accent)' : recording ? 'var(--err)' : 'var(--fg-2)',
              border:     `1px solid ${transcribing ? 'var(--accent)' : recording ? 'var(--err)' : 'var(--line)'}`,
              background: transcribing ? 'var(--accent-soft)' : recording ? 'rgba(239,122,122,0.1)' : 'var(--bg-2)',
            }}
          >
            {transcribing
              ? <ISpinner size={13} />
              : <IMic style={{ width: 13, height: 13, color: recording ? 'var(--err)' : 'var(--fg-3)', flexShrink: 0, ...(recording ? { animation: 'cc-pulse 1s ease-in-out infinite' } : {}) }} />}
          </button>
          <button
            onClick={refineWithAI}
            disabled={aiRefining || aiAnalysing || !inputValue.trim()}
            title={(() => {
              if (aiProviders.length === 0) return 'AI-Anbieter in Settings → AI einrichten'
              const tid = aiFunctionMap['terminal'] || activeAiProvider
              const p = aiProviders.find(p => p.id === tid) ?? aiProviders[0]
              return `Text mit ${p.name} überarbeiten`
            })()}
            style={{ ...chip, padding: '5px 8px', color: 'var(--accent)', border: '1px solid var(--accent-line)', background: 'var(--accent-soft)', opacity: (aiRefining || aiAnalysing || !inputValue.trim()) ? 0.5 : 1 }}
          >
            <ISpark style={{ flexShrink: 0, width: 13, height: 13, ...(aiRefining ? { animation: 'cc-pulse 0.5s ease-in-out infinite' } : {}) }} />
          </button>
          <button
            onClick={analyseWithAI}
            disabled={aiAnalysing || aiRefining || !inputValue.trim()}
            title={(() => {
              if (aiProviders.length === 0) return 'AI-Anbieter in Settings → AI einrichten'
              const tid = aiFunctionMap['terminal'] || activeAiProvider
              const p = aiProviders.find(p => p.id === tid) ?? aiProviders[0]
              return `Implementierungsauftrag mit ${p.name} generieren`
            })()}
            style={{ ...chip, padding: '5px 8px', color: 'var(--ok)', border: '1px solid color-mix(in srgb, var(--ok) 35%, transparent)', background: 'color-mix(in srgb, var(--ok) 12%, transparent)', opacity: (aiAnalysing || aiRefining || !inputValue.trim()) ? 0.5 : 1 }}
          >
            <IBolt style={{ flexShrink: 0, width: 13, height: 13, ...(aiAnalysing ? { animation: 'cc-pulse 0.5s ease-in-out infinite' } : {}) }} />
          </button>
          {(() => {
            const canSend = !!(inputValue.trim() || pendingFiles.length > 0 || attachments.length > 0 || templates.some(t => t.favorite))
            const sendDisabled = hasUploading || !canSend
            return (
              <button
                onClick={send}
                disabled={sendDisabled}
                title={hasUploading ? 'Dateien werden hochgeladen…' : !canSend ? 'Nachricht eingeben' : undefined}
                style={{ ...primaryBtn, display: 'flex', alignItems: 'center', gap: 5, opacity: sendDisabled ? 0.45 : 1, ...(isOrbit ? { background: 'var(--orbit)', color: '#fff' } : {}) }}
              >
                {hasUploading
                  ? <span style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid #fff4', borderTopColor: isOrbit ? '#fff' : 'var(--accent-fg)', animation: 'cc-spin 0.7s linear infinite', display: 'inline-block', flexShrink: 0 }} />
                  : isOrbit ? <ISend style={{ color: '#fff' }} /> : <ITerminal style={{ color: 'var(--accent-fg)' }} />
                }
                {hasUploading ? 'Uploading…' : 'Senden'}
              </button>
            )
          })()}
        </div>
        {aiError && (
          <div style={{ padding: '4px 10px 6px', fontSize: 10.5, color: 'var(--err)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>✗</span> {aiError}
            <span onClick={() => setAiError('')} style={{ marginLeft: 'auto', cursor: 'pointer', opacity: 0.6 }}>×</span>
          </div>
        )}
        </div>{/* end inner content */}
      </div>{/* end animated border wrapper */}

      {/* Terminal shortcuts reference modal */}
      {showShortcuts && isTerminal && (
        <TerminalShortcutsModal shortcuts={terminalShortcuts} onClose={() => setShowShortcuts(false)} />
      )}

      {/* Image annotation modal */}
      {annotatingFile && (
        <ImageAnnotator
          src={annotatingFile.previewUrl ?? annotatingFile.url ?? ''}
          fileName={annotatingFile.name}
          onDone={(newFile) => {
            replaceFile(annotatingFileId!, newFile)
            setAnnotatingFileId(null)
          }}
          onCancel={() => setAnnotatingFileId(null)}
        />
      )}

    </div>
  )
}

// ── Terminal Shortcuts Modal ──────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  control:    'Prozesssteuerung',
  editing:    'Zeile bearbeiten',
  navigation: 'Navigation & History',
}

function TerminalShortcutsModal({ shortcuts, onClose }: { shortcuts: TerminalShortcut[]; onClose: () => void }) {
  const { setScreen } = useAppStore()
  const categories = ['control', 'navigation', 'editing'] as const
  return (
    /* Full-screen backdrop — click outside closes */
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1500, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--bg-1)', border: '1px solid var(--line-strong)', borderRadius: 6, boxShadow: '0 20px 60px rgba(0,0,0,0.5)', width: 380, maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--line)', background: 'var(--bg-2)', flexShrink: 0 }}>
          <IKeyboard style={{ width: 13, height: 13, color: 'var(--accent)' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)', flex: 1 }}>Terminal-Tastenkürzel</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-3)', display: 'flex', padding: 4, fontSize: 16, lineHeight: 1 }}>×</button>
        </div>

        {/* Shortcut list */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '8px 0' }}>
          {categories.map(cat => {
            const items = shortcuts.filter(s => s.category === cat)
            if (!items.length) return null
            return (
              <div key={cat}>
                <div style={{ padding: '6px 16px 3px', fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--fg-3)' }}>
                  {CATEGORY_LABELS[cat]}
                </div>
                {items.map(sc => (
                  <div key={sc.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 16px', opacity: sc.enabled ? 1 : 0.38 }}>
                    <span style={{ minWidth: 64, fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: sc.enabled ? 'var(--accent)' : 'var(--fg-3)', background: sc.enabled ? 'var(--accent-soft)' : 'var(--bg-3)', border: `1px solid ${sc.enabled ? 'var(--accent-line)' : 'var(--line)'}`, borderRadius: 6, padding: '2px 7px', textAlign: 'center', flexShrink: 0 }}>
                      {sc.label}
                    </span>
                    <span style={{ fontSize: 11.5, color: 'var(--fg-1)', flex: 1 }}>{sc.description}</span>
                    {!sc.enabled && <span style={{ fontSize: 9.5, color: 'var(--fg-3)', flexShrink: 0 }}>aus</span>}
                  </div>
                ))}
              </div>
            )
          })}
        </div>

        {/* Footer with settings link */}
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--line)', background: 'var(--bg-2)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>Aktivieren / deaktivieren unter:</span>
          <button
            onClick={() => { onClose(); setScreen('settings') }}
            style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent-line)', borderRadius: 6, padding: '3px 10px', fontSize: 11, color: 'var(--accent)', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)' }}
          >
            Einstellungen →
          </button>
        </div>
      </div>
    </div>
  )
}

// ── File Tab Viewer ───────────────────────────────────────────────────────────

function FileTabViewer({ path }: { path: string }) {
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
      else alert(`Fehler beim Speichern: ${d.error}`)
    } catch (e) {
      alert(`Fehler: ${String(e)}`)
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
