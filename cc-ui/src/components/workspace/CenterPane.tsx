import React, { useRef, useEffect, useState, useCallback } from 'react'
import { useAppStore } from '../../store/useAppStore'
import type { TurnMessage, Template, TerminalShortcut, Session } from '../../store/useAppStore'
import { IGit, IBranch, IPlus, IClose, IChev, IShield, IFile, ISpark, IBolt, ISend, IWarn, ITerminal, IFolder, ISearch, IMic, IAiWand, IDocAI, IImage, IKeyboard, IShieldPlus, ICrew } from '../primitives/Icons'
import simpleLogo from '../../assets/simple_logo.svg'
import { TERMINAL_THEMES } from '../../theme/presets'
import { updateDocsWithAI, refreshProjectDocs } from '../../utils/updateDocs'
import { aiDetectStartCmd } from '../../utils/aiDetect'
import { Pill } from '../primitives/Pill'
import { Kbd } from '../primitives/Kbd'
import { Avatar } from '../primitives/Avatar'
import { DiffBlock } from '../terminal/DiffBlock'
import { XTermPane } from '../terminal/XTermPane'

// ── horizontal drag-to-resize for input panel ─────────────────────────────────
function useRowDrag(onMove: (delta: number) => void) {
  const dragging = useRef(false)
  const lastY    = useRef(0)

  return useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    lastY.current = e.clientY
    const move = (ev: MouseEvent) => {
      if (!dragging.current) return
      const dy = ev.clientY - lastY.current
      lastY.current = ev.clientY
      onMove(dy)
    }
    const up = () => {
      dragging.current = false
      document.removeEventListener('mousemove', move)
      document.removeEventListener('mouseup', up)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
  }, [onMove])
}

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

  // All sessions show in center — crew sessions are first-class tabs
  const activeCrewSession = sessions.find(s => s.id === activeSessionId && s.kind === 'crew')

  const [inputH, setInputH] = useState(130)
  const dragInput = useRowDrag(useCallback((dy: number) => {
    setInputH(h => Math.min(400, Math.max(80, h - dy)))
  }, []))

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
        {sessions.length === 0 && !showFileViewer && <EmptyState onNew={() => setNewSessionOpen(true)} />}

        {sessions.map(s => {
          const isActive = s.id === activeSessionId && !showFileViewer
          return (
            <div key={s.id} style={{ display: isActive ? 'flex' : 'none', flex: 1, minHeight: 0, flexDirection: 'column' }}>
              <XTermPane
                sessionId={s.id}
                cmd={sessionCmd(s)}
                args={sessionArgs(s)}
                cwd={project?.path ?? '~'}
              />
            </div>
          )
        })}
      </div>

      {/* Horizontal drag handle */}
      <HDivider onMouseDown={dragInput} />

      <div style={{ height: inputH, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <InputArea onRequestH={(h) => setInputH(h)} />
      </div>

    </main>
  )
}

// ── Crew Bar — compact agent strip above terminal ─────────────────────────────
type CrewAgentLiveStatus = 'idle' | 'active' | 'done'

function CrewBar({ session }: { session: Session }) {
  const crew = session.crew
  const [agentStatus, setAgentStatus] = useState<Record<string, CrewAgentLiveStatus>>({})
  const [, setTick] = useState(0)
  const startTimes = useRef<Record<string, number>>({})

  useEffect(() => {
    const handler = (e: Event) => {
      const { sessionId: sid, agent, status } = (e as CustomEvent<{ sessionId: string; agent: string; model: string; status: string }>).detail
      if (sid !== session.id) return
      setAgentStatus(prev => {
        const next = { ...prev }
        if (status === 'start') {
          // mark all previous as done
          Object.keys(next).forEach(k => { if (next[k] === 'active') next[k] = 'done' })
          next[agent] = 'active'
          startTimes.current[agent] = Date.now()
        } else {
          next[agent] = 'done'
        }
        return next
      })
    }
    window.addEventListener('cc:crew-event', handler)
    return () => window.removeEventListener('cc:crew-event', handler)
  }, [session.id])

  // Live timer tick while any agent is active
  const hasActive = Object.values(agentStatus).some(s => s === 'active')
  useEffect(() => {
    if (!hasActive) return
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [hasActive])

  if (!crew) return null

  // Color by position in crew.agents → each agent gets a unique color
  const AGENT_PALETTE = ['#ef4444','#3b82f6','#22c55e','#a855f7','#eab308','#ec4899','#06b6d4','#6366f1','#14b8a6','#e879f9']
  const agentColor = (name: string) => {
    const idx = crew!.agents.findIndex(a => a.name === name)
    return AGENT_PALETTE[Math.max(0, idx) % AGENT_PALETTE.length]
  }

  // Sort: active first, idle middle, done last
  const sorted = [...crew.agents].sort((a, b) => {
    const rank = (s: string) => s === 'active' ? 0 : s === 'idle' ? 1 : 2
    return rank(agentStatus[a.name] ?? 'idle') - rank(agentStatus[b.name] ?? 'idle')
  })

  return (
    <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '5px 14px', background: 'var(--bg-1)', borderBottom: '1px solid var(--line)', overflowX: 'auto', scrollbarWidth: 'none' }}>
      {sorted.map((agent) => {
        const color  = agentColor(agent.name)
        const status = agentStatus[agent.name] ?? 'idle'
        const isActive = status === 'active'
        const isDone   = status === 'done'
        const elapsedSec = isActive && startTimes.current[agent.name]
          ? Math.floor((Date.now() - startTimes.current[agent.name]) / 1000)
          : null
        return (
          <div
            key={agent.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '3px 9px', borderRadius: 5, flexShrink: 0,
              background: isActive
                ? `color-mix(in srgb, ${color} 14%, var(--bg-2))`
                : isDone
                  ? 'color-mix(in srgb, var(--fg-3) 8%, var(--bg-2))'
                  : 'var(--bg-2)',
              border: `1px solid ${isActive ? color : isDone ? 'color-mix(in srgb, var(--fg-3) 20%, var(--line))' : 'var(--line)'}`,
              boxShadow: isActive ? `0 0 8px 1px ${color}55, 0 0 2px 0px ${color}99` : 'none',
              transition: 'all 0.3s',
              opacity: isDone ? 0.55 : 1,
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: isActive ? color : isDone ? 'var(--fg-3)' : color, flexShrink: 0, opacity: isDone ? 0.5 : 1, boxShadow: isActive ? `0 0 6px 2px ${color}` : 'none', animation: isActive ? 'cc-pulse 1.2s ease-in-out infinite' : 'none' }} />
            <span style={{ fontSize: 11, fontWeight: isActive ? 700 : 500, color: isActive ? color : isDone ? 'var(--fg-3)' : 'var(--fg-1)' }}>{agent.name}</span>
            {!isActive && <span className="mono" style={{ fontSize: 9.5, color: 'var(--fg-3)' }}>{agent.model.split('/').pop()}</span>}
            {isActive && elapsedSec !== null && <span className="mono" style={{ fontSize: 9.5, color: color, opacity: 0.85 }}>{elapsedSec}s</span>}
            {isDone && <span style={{ fontSize: 9, color: 'var(--fg-3)' }}>✓</span>}
          </div>
        )
      })}
      <span style={{ flex: 1 }} />
      <span style={{ fontSize: 10, color: 'var(--fg-3)', flexShrink: 0 }}>
        {crew.orchestration === 'auto' ? 'Auto' : 'Manuell'}
      </span>
    </div>
  )
}

function HDivider({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  const [hover, setHover] = useState(false)
  return (
    /* 8 px hit area, 1 px visible line centred inside */
    <div
      onMouseDown={onMouseDown}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        height: 8, flexShrink: 0, cursor: 'row-resize',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
      }}
    >
      <div style={{
        height: 1, background: hover ? 'var(--accent)' : 'transparent',
        transition: 'background 0.15s',
      }} />
    </div>
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

  const launchDevServer = async () => {
    if (!devCmd || launching) return
    setLaunching(true)
    try {
      const r = await fetch('/api/start-app', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath: project?.path, port: devPort, startCmd: devCmd }),
      })
      const d = await r.json() as { ok: boolean; pid?: number; logFile?: string }
      if (d.ok) {
        setStarted(true)
        if (devPort) setTimeout(() => window.open(`http://localhost:${devPort}`, '_blank'), 2200)
      }
    } finally {
      setLaunching(false)
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
    const onPlay    = () => { if (hasDevServer) launchDevServer(); else openConfig() }
    const onConfig  = () => openConfig()
    const onDocs    = () => doRefreshDocs()
    window.addEventListener('cc:hdr-play',   onPlay)
    window.addEventListener('cc:hdr-config', onConfig)
    window.addEventListener('cc:hdr-docs',   onDocs)
    return () => {
      window.removeEventListener('cc:hdr-play',   onPlay)
      window.removeEventListener('cc:hdr-config', onConfig)
      window.removeEventListener('cc:hdr-docs',   onDocs)
    }
  }, [hasDevServer, launching, refreshingDocs, devCmd, devPort, project]) // eslint-disable-line react-hooks/exhaustive-deps

  void activeSessionId

  // Render nothing visible — just the config modal when open
  return (
    <>
      {/* Config modal — centered on screen */}
      {configOpen && (
        <>
          <div onClick={() => setConfigOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 998, background: 'rgba(0,0,0,0.45)' }} />
          <div onClick={e => e.stopPropagation()} style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 999, background: 'var(--bg-2)', border: '1px solid var(--line-strong)', borderRadius: 10, padding: 20, display: 'flex', flexDirection: 'column', gap: 14, width: 440, boxShadow: '0 16px 48px rgba(0,0,0,0.6)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)' }}>Port und Serverstart festlegen</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 90, flexShrink: 0, color: 'var(--fg-3)' }}>Port</span>
                <input value={cfgPort} onChange={e => setCfgPort(e.target.value.replace(/\D/g, ''))} placeholder="3000" style={{ width: 100, padding: '5px 8px', background: 'var(--bg-1)', border: '1px solid var(--line-strong)', borderRadius: 5, color: 'var(--fg-0)', fontFamily: 'var(--font-mono)', fontSize: 11, outline: 'none' }} />
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
                    style={{ flex: 1, padding: '5px 8px', background: 'var(--bg-1)', border: '1px solid var(--line-strong)', borderRadius: 5, color: 'var(--fg-0)', fontFamily: 'var(--font-mono)', fontSize: 11, outline: 'none', resize: 'none', lineHeight: 1.6 }}
                  />
                  <button
                    onClick={detectWithAI}
                    disabled={detecting || aiProviders.length === 0}
                    title={aiProviders.length === 0 ? 'Kein AI-Anbieter konfiguriert' : 'Start-Befehl per AI ermitteln'}
                    style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, border: '1px solid var(--line-strong)', borderRadius: 5, background: 'var(--bg-1)', color: detecting ? 'var(--accent)' : aiProviders.length === 0 ? 'var(--fg-3)' : 'var(--accent)', cursor: (detecting || aiProviders.length === 0) ? 'not-allowed' : 'pointer', opacity: aiProviders.length === 0 ? 0.4 : 1 }}
                  >
                    <ISpark className={detecting ? 'anim-pulse' : ''} style={{ width: 12, height: 12 }} />
                  </button>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfigOpen(false)} style={{ background: 'none', border: '1px solid var(--line-strong)', borderRadius: 5, color: 'var(--fg-2)', padding: '4px 12px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Abbrechen</button>
              <button onClick={saveConfig} style={{ background: 'var(--accent)', border: 'none', borderRadius: 5, color: 'var(--accent-fg)', padding: '4px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Speichern</button>
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
  return (
    <div style={{ height: 34, flexShrink: 0, display: 'flex', alignItems: 'flex-end', borderBottom: '1px solid var(--line)', background: 'var(--bg-1)', paddingLeft: 4, gap: 1, overflowX: 'auto', overflowY: 'hidden', scrollbarWidth: 'none' }} className="hide-scrollbar">
      {sessions.map(s => {
        const active = s.id === activeId && activeFilePath === null
        const alias = aliases.find(a => a.name === s.alias)
        const isCrew = s.kind === 'crew'
        const isDangerous = !isCrew && (s.permMode === 'dangerous' || alias?.args?.includes('--dangerously-skip-permissions') || alias?.permMode === 'dangerous')
        const isExited = s.status === 'exited'
        const topBorderColor = isCrew ? (active ? '#3b82f6' : 'transparent') : isDangerous ? 'var(--err)' : active ? 'var(--accent)' : 'transparent'
        const dotColor = isDangerous ? 'var(--err)' : s.status === 'active' ? 'var(--ok)' : s.status === 'error' ? 'var(--err)' : 'var(--fg-3)'
        return (
          <div
            key={s.id}
            onClick={() => onSelectSession(s.id)}
            style={{
              height: 30, padding: '0 10px 0 12px',
              display: 'flex', alignItems: 'center', gap: 7,
              borderRadius: 0,
              background: active ? (isDangerous ? 'rgba(239,122,122,0.07)' : 'var(--bg-0)') : 'transparent',
              borderTop: `2px solid ${topBorderColor}`,
              borderLeft: active ? '1px solid var(--line)' : 'none',
              borderRight: active ? '1px solid var(--line)' : 'none',
              color: isExited ? 'var(--fg-3)' : isDangerous ? (active ? '#ef7a7a' : 'var(--fg-2)') : active ? 'var(--fg-0)' : 'var(--fg-2)',
              fontSize: 11.5, cursor: 'pointer', position: 'relative', marginBottom: -1, maxWidth: 240,
              opacity: isExited && !active ? 0.6 : 1,
            }}
          >
            {/* Left badges: shield (if dangerous), crew icon (if crew) */}
            {isDangerous && (
              <IShieldPlus title="--dangerously-skip-permissions" style={{ width: 10, height: 10, color: 'var(--err)', flexShrink: 0 }} />
            )}
            {isCrew && (
              <ICrew style={{ width: 10, height: 10, color: active ? '#3b82f6' : 'var(--fg-3)', flexShrink: 0 }} />
            )}

            {/* Name */}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: isExited ? 'line-through' : 'none', flex: 1 }}>{s.name}</span>

            {/* Right side: alias sub-label, status dot */}
            {!isCrew && s.alias && s.alias !== s.name && (
              <span className="mono" style={{ fontSize: 9.5, color: active ? '#3b82f6' : 'var(--fg-3)', flexShrink: 0 }}>{s.alias}</span>
            )}
            {isExited && <span style={{ fontSize: 8.5, color: 'var(--fg-3)', background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 3, padding: '1px 4px', flexShrink: 0 }}>ended</span>}
            {!isExited && !isCrew && (
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
              height: 30, padding: '0 8px 0 10px',
              display: 'flex', alignItems: 'center', gap: 6,
              borderRadius: 0,
              background: active ? 'rgba(212,163,72,0.07)' : 'transparent',
              borderTop: `2px solid ${active ? '#d4a348' : 'transparent'}`,
              borderLeft: active ? '1px solid var(--line)' : 'none',
              borderRight: active ? '1px solid var(--line)' : 'none',
              color: active ? '#d4a348' : 'var(--fg-3)',
              fontSize: 11.5, cursor: 'pointer', position: 'relative', marginBottom: -1, maxWidth: 200, flexShrink: 0,
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

      <button onClick={onNew} title="Neue Session (⌘T)" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', margin: '0 4px', marginBottom: 4, background: 'none', border: 'none', borderRadius: 99, color: 'var(--fg-1)', fontSize: 10.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)', flexShrink: 0, alignSelf: 'flex-end' }}>
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
      <button onClick={() => setDangerMode(false)} style={{ background: 'transparent', border: '1px solid var(--danger-line)', color: 'var(--danger)', padding: '2px 8px', borderRadius: 4, fontSize: 10.5, cursor: 'pointer', fontFamily: 'inherit' }}>Disarm</button>
    </div>
  )
}

function EmptyState({ onNew }: { onNew: () => void }) {
  const { aliases, setNewSessionPreKind, setNewSessionOpen } = useAppStore()
  const top4 = aliases.slice(0, 4)

  const startWithKind = (kind: 'single' | 'crew') => {
    setNewSessionPreKind(kind)
    setNewSessionOpen(true)
  }

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 20, padding: '32px 24px', minHeight: 0,
    }}>
      {/* Icon + heading */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <img src={simpleLogo} alt="Codera AI" style={{ width: 52, height: 52, opacity: 0.85 }} />
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-0)' }}>Keine aktive Session</div>
      </div>

      {/* Session type picker */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => startWithKind('single')}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3, padding: '10px 14px', borderRadius: 7, border: '1px solid var(--line-strong)', background: 'var(--bg-1)', cursor: 'pointer', width: 148, textAlign: 'left', transition: 'border-color 0.15s, background 0.15s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLElement).style.background = 'var(--accent-soft)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--line-strong)'; (e.currentTarget as HTMLElement).style.background = 'var(--bg-1)' }}
        >
          <ITerminal style={{ color: 'var(--accent)', width: 13, height: 13 }} />
          <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--fg-0)' }}>Terminal Session</span>
          <span style={{ fontSize: 10, color: 'var(--fg-3)', lineHeight: 1.4 }}>Ein Agent, ein Terminal</span>
        </button>
        <button
          onClick={() => startWithKind('crew')}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3, padding: '10px 14px', borderRadius: 7, border: '1px solid var(--line-strong)', background: 'var(--bg-1)', cursor: 'pointer', width: 148, textAlign: 'left', transition: 'border-color 0.15s, background 0.15s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLElement).style.background = 'var(--accent-soft)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--line-strong)'; (e.currentTarget as HTMLElement).style.background = 'var(--bg-1)' }}
        >
          <ISpark style={{ color: 'var(--accent)', width: 13, height: 13 }} />
          <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--fg-0)' }}>Agenten-Crew</span>
          <span style={{ fontSize: 10, color: 'var(--fg-3)', lineHeight: 1.4 }}>Multi-Agent Team</span>
        </button>
      </div>

      {/* Quick-start alias cards */}
      {top4.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 148px)', gap: 7 }}>
          {top4.map(alias => (
            <AliasCard key={alias.id} alias={alias} onStart={onNew} />
          ))}
        </div>
      )}

      {/* Primary CTA */}
      <button
        onClick={onNew}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          background: 'var(--accent)', color: 'var(--accent-fg, #1a1410)',
          border: 'none', borderRadius: 4, padding: '5px 14px',
          width: 304, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        <IPlus style={{ width: 13, height: 13 }} />
        Neue Session starten
      </button>
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
          width: 20, height: 20, borderRadius: 4, background: hovered ? 'var(--accent)' : 'var(--bg-3)',
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
                <span key={a} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 4, fontSize: 10.5, color: 'var(--fg-2)', fontFamily: 'var(--font-mono)' }}>
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
      <div style={{ marginLeft: 32, marginBottom: 10, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 10px', background: turn.tone === 'accent' ? 'var(--accent-soft)' : 'var(--bg-1)', border: `1px solid ${turn.tone === 'accent' ? 'var(--accent-line)' : 'var(--line)'}`, borderRadius: 5, fontSize: 11 }}>
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
      <div style={{ background: 'var(--bg-1)', border: '1px solid var(--line-strong)', borderRadius: 10, boxShadow: '0 16px 48px rgba(0,0,0,0.4)', width: 440, padding: 24 }}>
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

function InputArea({ onRequestH }: { onRequestH?: (h: number) => void }) {
  const {
    inputValue, setInputValue, sendMessage, templates, updateTemplate,
    projects, activeProjectId, activeSessionId,
    playwrightCheck, setPlaywrightCheck,
    localhostCheck, setLocalhostCheck,
    aiProviders, activeAiProvider, aiFunctionMap,
    terminalShortcuts, docTemplates,
    terminalTheme, theme: appTheme,
  } = useAppStore()
  const [attachments, setAttachments]   = useState<string[]>([])
  const [picking, setPicking]           = useState(false)
  const [recording, setRecording]       = useState(false)
  const [editTemplate, setEditTemplate] = useState<Template | null>(null)
  const [tplMenu, setTplMenu]           = useState<{ x: number; y: number; tpl: Template } | null>(null)
  const [aiRefining, setAiRefining]     = useState(false)
  const [aiAnalysing, setAiAnalysing]   = useState(false)
  const [aiError, setAiError]           = useState('')
  const [pathInput, setPathInput]       = useState<'file' | 'image' | null>(null)
  const [pathInputVal, setPathInputVal] = useState('')
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [focused, setFocused] = useState(false)
  const taRef      = useRef<HTMLTextAreaElement>(null)
  const termBg = (TERMINAL_THEMES.find(t => t.id === terminalTheme)?.theme.background)
    ?? (appTheme === 'dark' ? '#0e0d0b' : '#faf8f4')
  const recRef     = useRef<SpeechRecognition | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const project = projects.find(p => p.id === activeProjectId)
  const activeSession = project?.sessions.find(s => s.id === activeSessionId)
  const isTerminal = !!activeSession

  // Grow/shrink the outer container based on content
  useEffect(() => {
    const lines = (inputValue.match(/\n/g) ?? []).length + 1
    const h = lines > 3 ? Math.min(400, lines * 20 + 160) : 130
    onRequestH?.(h)
  }, [inputValue, onRequestH])

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

  const send = () => {
    const favBodies = templates.filter(t => t.favorite).map(t => t.body)
    if (!inputValue.trim() && attachments.length === 0 && favBodies.length === 0) return

    let fullMsg = inputValue
    if (favBodies.length > 0) fullMsg += (fullMsg ? '\n\n' : '') + favBodies.join('\n\n')

    if (isTerminal) {
      window.dispatchEvent(new CustomEvent('cc:terminal-paste', { detail: { sessionId: activeSessionId, data: fullMsg } }))
    } else {
      sendMessage(attachments)
      setAttachments([])
    }
    setInputValue('')
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

  const toggleVoice = () => {
    const SR = (window as unknown as { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition
      ?? (window as unknown as { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition
    if (!SR) return

    if (recording) {
      recRef.current?.stop()
      setRecording(false)
    } else {
      const rec = new SR()
      rec.continuous = false
      rec.interimResults = false
      rec.lang = 'de-DE'
      rec.onresult = (e: SpeechRecognitionEvent) => {
        const t = Array.from(e.results).map(r => r[0].transcript).join('')
        setInputValue(prev => prev ? prev + ' ' + t : t)
      }
      rec.onend = () => setRecording(false)
      rec.onerror = () => setRecording(false)
      rec.start()
      recRef.current = rec
      setRecording(true)
    }
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
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0px 18px 20px', background: 'var(--bg-0)', overflow: 'hidden' }}>
      <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={handleAttach} />

      {/* Inline path input — shown when Pfad/Bild button is active */}
      {isTerminal && pathInput && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, padding: '5px 8px', background: 'var(--bg-3)', border: '1px solid var(--accent)', borderRadius: 7 }}>
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
          <button onClick={confirmPathInput} disabled={!pathInputVal.trim()} style={{ background: 'var(--accent)', border: 'none', borderRadius: 4, padding: '3px 10px', fontSize: 11, fontWeight: 600, color: 'var(--accent-fg, #1a1410)', cursor: pathInputVal.trim() ? 'pointer' : 'default', opacity: pathInputVal.trim() ? 1 : 0.4 }}>
            Einfügen
          </button>
          <button onClick={() => { setPathInput(null); setPathInputVal(''); setTimeout(() => window.dispatchEvent(new CustomEvent('cc:terminal-refresh')), 50) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-3)', display: 'flex', padding: 2 }}>
            <IClose style={{ width: 10, height: 10 }} />
          </button>
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', border: `1px solid ${focused ? 'var(--accent)' : 'var(--line-strong)'}`, borderRadius: 8, background: 'var(--bg-1)', padding: '16px 18px 10px', boxShadow: focused ? '0 0 0 2px var(--accent-soft), 0 4px 16px rgba(0,0,0,0.12)' : '0 2px 8px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        {attachments.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 6 }}>
            {attachments.map(p => {
              const label = isTerminal ? p.split('/').pop() ?? p : p
              const title = isTerminal ? p : undefined
              return (
                <span key={p} title={title} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 6px 2px 7px', background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 4, fontSize: 10.5, color: 'var(--fg-1)', fontFamily: 'var(--font-mono)', maxWidth: 280 }}>
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
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKey}
          // Prevent binary file drops into the terminal — they cause xterm to go black
          onDragOver={isTerminal ? e => e.preventDefault() : undefined}
          onDrop={isTerminal ? e => e.preventDefault() : undefined}
          placeholder={isTerminal ? 'Befehl oder Text ans Terminal senden…' : 'Nachricht senden… (⏎ senden, ⇧⏎ neue Zeile)'}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-0)', background: 'transparent', border: 'none', outline: 'none', resize: 'none', width: '100%', flex: 1, minHeight: 0 }}
        />


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
          {isTerminal ? (
            <>
              <button
                style={{ ...chip, background: pathInput === 'file' ? 'var(--accent-soft)' : 'var(--bg-2)', border: `1px solid ${pathInput === 'file' ? 'var(--accent)' : 'var(--line)'}`, color: pathInput === 'file' ? 'var(--accent)' : 'var(--fg-1)' }}
                onClick={() => { setPathInput(p => p === 'file' ? null : 'file'); setPathInputVal('') }}
                title="Pfad einfügen — Datei aus dem Finder hier reinziehen oder Pfad eintippen"
              >
                <IFile style={{ color: pathInput === 'file' ? 'var(--accent)' : 'var(--accent)', flexShrink: 0 }} />
                Pfad einfügen
              </button>
              <button
                style={{ ...chip, background: pathInput === 'image' ? 'var(--accent-soft)' : 'var(--bg-2)', border: `1px solid ${pathInput === 'image' ? 'var(--accent)' : 'var(--line)'}`, color: pathInput === 'image' ? 'var(--accent)' : 'var(--fg-1)' }}
                onClick={() => { setPathInput(p => p === 'image' ? null : 'image'); setPathInputVal('') }}
                title="Bild einfügen — fügt --image &quot;/pfad&quot; ein"
              >
                <IImage style={{ width: 11, height: 11, flexShrink: 0 }} />
                Bild einfügen
              </button>
              {/* Shortcuts reference button */}
              <button
                style={{ ...chip, background: showShortcuts ? 'var(--accent-soft)' : 'var(--bg-2)', border: `1px solid ${showShortcuts ? 'var(--accent)' : 'var(--line)'}`, color: showShortcuts ? 'var(--accent)' : 'var(--fg-2)', padding: '3px 7px' }}
                onClick={() => setShowShortcuts(v => !v)}
                title="Terminal-Tastenkürzel anzeigen"
              >
                <IKeyboard style={{ width: 11, height: 11, flexShrink: 0 }} />
              </button>
            </>
          ) : (
            <button style={chip} onClick={() => fileInputRef.current?.click()}>
              <IFile style={{ color: 'var(--accent)', flexShrink: 0 }} />
              Anhang
            </button>
          )}
          <span style={{ flex: 1 }} />
          <button
            onClick={toggleVoice}
            title={recording ? 'Aufnahme stoppen' : 'Spracheingabe starten'}
            style={{ ...chip, padding: '4px 7px', color: recording ? 'var(--err)' : 'var(--fg-2)', border: `1px solid ${recording ? 'var(--err)' : 'var(--line)'}`, background: recording ? 'rgba(239,122,122,0.1)' : 'var(--bg-2)' }}
          >
            <IMic style={{ color: recording ? 'var(--err)' : 'var(--fg-3)', flexShrink: 0, ...(recording ? { animation: 'cc-pulse 1s ease-in-out infinite' } : {}) }} />
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
            style={{ ...chip, padding: '4px 7px', color: 'var(--accent)', border: '1px solid var(--accent-line)', background: 'var(--accent-soft)', opacity: (aiRefining || aiAnalysing || !inputValue.trim()) ? 0.5 : 1 }}
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
            style={{ ...chip, padding: '4px 7px', color: 'var(--ok)', border: '1px solid color-mix(in srgb, var(--ok) 35%, transparent)', background: 'color-mix(in srgb, var(--ok) 12%, transparent)', opacity: (aiAnalysing || aiRefining || !inputValue.trim()) ? 0.5 : 1 }}
          >
            <IBolt style={{ flexShrink: 0, width: 13, height: 13, ...(aiAnalysing ? { animation: 'cc-pulse 0.5s ease-in-out infinite' } : {}) }} />
          </button>
          <button onClick={send} style={{ ...primaryBtn, display: 'flex', alignItems: 'center', gap: 5 }}>
            {isTerminal ? <ITerminal style={{ color: 'var(--accent-fg)' }} /> : <ISend style={{ color: 'var(--accent-fg)' }} />}
            Senden
          </button>
        </div>
        {aiError && (
          <div style={{ padding: '4px 10px 6px', fontSize: 10.5, color: 'var(--err)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>✗</span> {aiError}
            <span onClick={() => setAiError('')} style={{ marginLeft: 'auto', cursor: 'pointer', opacity: 0.6 }}>×</span>
          </div>
        )}
      </div>

      {/* Terminal shortcuts reference modal */}
      {showShortcuts && isTerminal && (
        <TerminalShortcutsModal shortcuts={terminalShortcuts} onClose={() => setShowShortcuts(false)} />
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
        style={{ background: 'var(--bg-1)', border: '1px solid var(--line-strong)', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.5)', width: 380, maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
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
                    <span style={{ minWidth: 64, fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: sc.enabled ? 'var(--accent)' : 'var(--fg-3)', background: sc.enabled ? 'var(--accent-soft)' : 'var(--bg-3)', border: `1px solid ${sc.enabled ? 'var(--accent-line)' : 'var(--line)'}`, borderRadius: 4, padding: '2px 7px', textAlign: 'center', flexShrink: 0 }}>
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
            style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent-line)', borderRadius: 5, padding: '3px 10px', fontSize: 11, color: 'var(--accent)', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)' }}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, border: '1px solid var(--line)', borderRadius: 4, background: 'var(--bg-2)', padding: '2px 7px', flex: 1, minWidth: 0 }}>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, border: '1px solid var(--line)', borderRadius: 4, background: 'var(--bg-2)', padding: '3px 8px', flex: 1 }}>
            <ISearch style={{ color: 'var(--fg-3)', width: 11, height: 11, flexShrink: 0 }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Suchen…" style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 11, color: 'var(--fg-0)', fontFamily: 'var(--font-ui)', width: '100%' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, border: '1px solid var(--line)', borderRadius: 4, background: 'var(--bg-2)', padding: '3px 8px', flex: 1 }}>
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

const primaryBtn: React.CSSProperties = { background: 'var(--accent)', color: 'var(--accent-fg)', border: 'none', padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)' }
const ghostBtn: React.CSSProperties = { background: 'transparent', color: 'var(--fg-1)', border: '1px solid var(--line-strong)', padding: '4px 10px', borderRadius: 4, fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-ui)' }
const chip: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 99, color: 'var(--fg-1)', fontSize: 10.5, cursor: 'pointer', fontFamily: 'var(--font-ui)' }
const ftBtn: React.CSSProperties = { background: 'transparent', border: '1px solid var(--line)', borderRadius: 4, color: 'var(--fg-1)', fontSize: 10.5, padding: '2px 7px', cursor: 'pointer', fontFamily: 'var(--font-ui)', flexShrink: 0 }
