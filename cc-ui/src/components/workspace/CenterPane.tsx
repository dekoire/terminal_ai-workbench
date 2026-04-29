import React, { useRef, useEffect, useState, useCallback } from 'react'
import { useAppStore } from '../../store/useAppStore'
import type { TurnMessage, Template, TerminalShortcut } from '../../store/useAppStore'
import { IGit, IBranch, IPlus, IClose, IChev, IShield, IFile, ISpark, ISend, IWarn, ITerminal, IFolder, ISearch, IMic, IAiWand } from '../primitives/Icons'
import { updateDocsWithAI } from '../../utils/updateDocs'
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

export function CenterPane() {
  const { dangerMode, projects, activeProjectId, activeSessionId, setActiveSession, setNewSessionOpen, aliases } = useAppStore()
  // setActiveSession used in selectSession below
  const project = projects.find(p => p.id === activeProjectId)
  const sessions = project?.sessions ?? []
  const activeSession = sessions.find(s => s.id === activeSessionId)

  const [inputH, setInputH] = useState(220)
  const dragInput = useRowDrag(useCallback((dy: number) => {
    setInputH(h => Math.min(400, Math.max(80, h - dy)))
  }, []))

  // File tabs — opened via right-click "In Tab öffnen"
  const [fileTabs, setFileTabs] = useState<string[]>([])
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null)

  useEffect(() => {
    const handler = (e: Event) => {
      const path = (e as CustomEvent<string>).detail
      setFileTabs(prev => prev.includes(path) ? prev : [...prev, path])
      setActiveFilePath(path) // show file view; session stays in store
    }
    window.addEventListener('cc:open-file-tab', handler)
    return () => window.removeEventListener('cc:open-file-tab', handler)
  }, [])

  const closeFileTab = (path: string) => {
    setFileTabs(prev => {
      const next = prev.filter(p => p !== path)
      if (activeFilePath === path) {
        if (next.length > 0) setActiveFilePath(next[next.length - 1])
        else { setActiveFilePath(null) }
      }
      return next
    })
  }

  const selectSession = (sid: string) => {
    setActiveFilePath(null)
    setActiveSession(sid)
  }

  const showFileViewer = activeFilePath !== null

  // Keyboard shortcuts: Cmd/Ctrl+T = new session, Cmd+1-9 = switch tab, Cmd+W = close file tab
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      if (e.key === 't') {
        e.preventDefault()
        setNewSessionOpen(true)
      } else if (e.key === 'w' && activeFilePath) {
        e.preventDefault()
        closeFileTab(activeFilePath)
      } else {
        const n = parseInt(e.key)
        if (n >= 1 && n <= 9) {
          e.preventDefault()
          if (n <= sessions.length) {
            selectSession(sessions[n - 1].id)
          } else {
            const fi = n - sessions.length - 1
            if (fi >= 0 && fi < fileTabs.length) setActiveFilePath(fileTabs[fi])
          }
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [sessions, fileTabs, activeFilePath, selectSession, closeFileTab, setNewSessionOpen])

  // Use cmd/args baked into the session at creation time — no stale alias lookup.
  // Fall back to alias lookup for sessions created before this field existed.
  const _fallbackAlias = aliases.find(a => a.name === activeSession?.alias)
  const aliasCmd  = activeSession?.cmd  || _fallbackAlias?.cmd  || 'zsh'
  const aliasArgs = activeSession?.args != null ? activeSession.args : (_fallbackAlias?.args ?? '')

  return (
    <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--bg-0)' }}>
      <ProjectHeader />
      <SessionTabs
        sessions={sessions}
        activeId={showFileViewer ? '' : activeSessionId}
        onNew={() => setNewSessionOpen(true)}
        onSelectSession={selectSession}
        fileTabs={fileTabs}
        activeFilePath={activeFilePath}
        onSelectFileTab={setActiveFilePath}
        onCloseFileTab={closeFileTab}
      />
      {dangerMode && <DangerBanner />}
      {/* Active command indicator */}
      {activeSession && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 14px', background: 'var(--bg-2)', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
          <ITerminal style={{ color: 'var(--fg-3)', width: 10, height: 10, flexShrink: 0 }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--fg-3)' }}>
            <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{aliasCmd}</span>
            {aliasArgs && <span style={{ color: 'var(--fg-2)' }}> {aliasArgs}</span>}
          </span>
          <span style={{ flex: 1 }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-3)', opacity: 0.6 }}>{project?.path ?? '~'}</span>
        </div>
      )}
      {/* flex:1 + minHeight:0 ensures xterm fills remaining space */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {showFileViewer ? (
          <FileTabViewer path={activeFilePath} />
        ) : activeSession ? (
          <XTermPane
            sessionId={activeSession.id}
            cmd={aliasCmd}
            args={aliasArgs}
            cwd={project?.path ?? '~'}
          />
        ) : (
          <EmptyState onNew={() => setNewSessionOpen(true)} />
        )}
      </div>

      {/* Horizontal drag handle */}
      <HDivider onMouseDown={dragInput} />

      <div style={{ height: inputH, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <InputArea onRequestH={(h) => setInputH(ih => Math.max(ih, h))} />
      </div>
    </main>
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
        height: 1, background: hover ? 'var(--accent)' : 'var(--line)',
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
  const [configOpen, setConfigOpen] = useState(false)
  const [cfgPort, setCfgPort] = useState('')
  const [cfgCmd, setCfgCmd] = useState('')
  const [detecting, setDetecting] = useState(false)
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
        console.log(`[launch] PID ${d.pid} | log: ${d.logFile}`)
        if (devPort) setTimeout(() => window.open(`http://localhost:${devPort}`, '_blank'), 2200)
      }
    } finally {
      setLaunching(false)
    }
  }

  const openConfig = () => {
    setCfgPort(String(devPort ?? ''))
    setCfgCmd(devCmd ?? '')
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

  void activeSessionId

  return (
    <div style={{ height: 38, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', borderBottom: '1px solid var(--line)', background: 'var(--bg-1)', position: 'relative' }}>
      {noGit
        ? <IFolder style={{ color: 'var(--fg-3)', flexShrink: 0 }} />
        : <IGit style={{ color: 'var(--fg-2)', flexShrink: 0 }} />
      }

      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)', whiteSpace: 'nowrap' }}>{project?.name ?? '—'}</span>

      {/* Play button — always visible when project is active */}
      {project && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <button
            onClick={hasDevServer ? launchDevServer : openConfig}
            disabled={launching}
            title={hasDevServer ? `${devCmd} → http://localhost:${devPort}` : devPort ? `Befehl fehlt — klicken zum Konfigurieren` : devCmd ? `Port fehlt — klicken zum Konfigurieren` : 'Dev Server konfigurieren'}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: launching ? 'var(--bg-3)' : hasDevServer ? 'var(--ok)' : 'var(--bg-3)',
              border: hasDevServer ? 'none' : '1px solid var(--line-strong)',
              borderRadius: 5, padding: '3px 9px',
              color: launching ? 'var(--fg-3)' : hasDevServer ? '#fff' : (devPort || devCmd) ? 'var(--fg-1)' : 'var(--fg-2)',
              fontSize: 11, fontWeight: 600, cursor: launching ? 'wait' : 'pointer',
              fontFamily: 'var(--font-ui)', transition: 'all 0.15s',
              opacity: launching ? 0.7 : 1,
            }}
          >
            {launching ? '…' : '▶'}&nbsp;
            {launching ? 'Starting…' : hasDevServer ? `localhost:${devPort}` : devPort ? `localhost:${devPort}` : devCmd ? devCmd : 'Dev Server'}
          </button>
          <button onClick={openConfig} title="Port / Befehl konfigurieren" style={{ background: 'none', border: 'none', color: 'var(--fg-3)', cursor: 'pointer', fontSize: 10, padding: '2px 4px', fontFamily: 'inherit', lineHeight: 1 }}>⚙</button>
        </div>
      )}

      {/* Inline config popover */}
      {configOpen && (
        <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: 42, left: 14, zIndex: 200, background: 'var(--bg-2)', border: '1px solid var(--line-strong)', borderRadius: 8, padding: 14, display: 'flex', flexDirection: 'column', gap: 10, width: 320, boxShadow: '0 8px 28px rgba(0,0,0,0.4)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-1)' }}>Dev Server konfigurieren</div>
          <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 8, alignItems: 'center', fontSize: 11 }}>
            <span style={{ color: 'var(--fg-3)' }}>Port</span>
            <input value={cfgPort} onChange={e => setCfgPort(e.target.value.replace(/\D/g, ''))} placeholder="3000" style={{ padding: '5px 8px', background: 'var(--bg-1)', border: '1px solid var(--line-strong)', borderRadius: 5, color: 'var(--fg-0)', fontFamily: 'var(--font-mono)', fontSize: 11, outline: 'none' }} />
            <span style={{ color: 'var(--fg-3)' }}>Start-Befehl</span>
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              <input value={cfgCmd} onChange={e => setCfgCmd(e.target.value)} disabled={detecting} placeholder="npm run dev" style={{ flex: 1, padding: '5px 8px', background: 'var(--bg-1)', border: '1px solid var(--line-strong)', borderRadius: 5, color: 'var(--fg-0)', fontFamily: 'var(--font-mono)', fontSize: 11, outline: 'none', minWidth: 0 }} />
              <button
                onClick={detectWithAI}
                disabled={detecting || aiProviders.length === 0}
                title={aiProviders.length === 0 ? 'Kein AI-Anbieter konfiguriert' : 'Start-Befehl per AI ermitteln'}
                style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4, padding: '4px 7px', border: '1px solid var(--line-strong)', borderRadius: 5, background: detecting ? 'var(--bg-3)' : 'var(--bg-2)', color: detecting ? 'var(--fg-3)' : 'var(--accent)', cursor: (detecting || aiProviders.length === 0) ? 'not-allowed' : 'pointer', fontSize: 10, fontFamily: 'var(--font-ui)', opacity: aiProviders.length === 0 ? 0.4 : 1, whiteSpace: 'nowrap' }}
              >
                <IAiWand style={{ width: 11, height: 11 }} />
                {detecting ? '…' : 'AI'}
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setConfigOpen(false)} style={{ background: 'none', border: '1px solid var(--line-strong)', borderRadius: 5, color: 'var(--fg-2)', padding: '4px 12px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Abbrechen</button>
            <button onClick={saveConfig} style={{ background: 'var(--accent)', border: 'none', borderRadius: 5, color: 'var(--accent-fg)', padding: '4px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Speichern</button>
          </div>
        </div>
      )}

      {/* Doc applying spinner */}
      {isDocApplying && (
        <span className="anim-spin" style={{ display: 'inline-block', fontSize: 10, color: 'var(--fg-3)' }} title="Docu wird angelegt…">⟳</span>
      )}

      <span style={{ flex: 1 }} />

      {noGit ? (
        <span style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>lokal</span>
      ) : (
        <>
          {lastCommit && <span style={{ fontSize: 10.5, color: 'var(--fg-3)', whiteSpace: 'nowrap' }}>{lastCommit}</span>}
          {dirty > 0 && <Pill tone="warn" dot>{dirty} modified</Pill>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 5, background: 'var(--bg-2)', border: '1px solid var(--line)', flexShrink: 0 }}>
            <IBranch style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <span className="mono" style={{ fontSize: 11, color: 'var(--fg-0)' }}>{branch}</span>
          </div>
        </>
      )}
    </div>
  )
}

function SessionTabs({ sessions, activeId, onNew, onSelectSession, fileTabs, activeFilePath, onSelectFileTab, onCloseFileTab }: {
  sessions: { id: string; name: string; alias: string; status: string; permMode: string }[]
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
    <div style={{ height: 34, flexShrink: 0, display: 'flex', alignItems: 'flex-end', borderBottom: '1px solid var(--line)', background: 'var(--bg-1)', paddingLeft: 4, gap: 1, overflowX: 'auto' }}>
      {sessions.map(s => {
        const active = s.id === activeId && activeFilePath === null
        const alias = aliases.find(a => a.name === s.alias)
        const isDangerous = s.permMode === 'dangerous' || alias?.args?.includes('--dangerously-skip-permissions') || alias?.permMode === 'dangerous'
        const isExited = s.status === 'exited'
        const topBorderColor = isDangerous ? 'var(--err)' : active ? 'var(--accent)' : 'transparent'
        const dotColor = isDangerous ? 'var(--err)' : s.status === 'active' ? 'var(--ok)' : s.status === 'error' ? 'var(--err)' : 'var(--fg-3)'
        return (
          <div
            key={s.id}
            onClick={() => onSelectSession(s.id)}
            style={{
              height: 30, padding: '0 10px 0 12px',
              display: 'flex', alignItems: 'center', gap: 7,
              borderRadius: '6px 6px 0 0',
              background: active ? (isDangerous ? 'rgba(239,122,122,0.07)' : 'var(--bg-0)') : 'transparent',
              borderTop: `2px solid ${topBorderColor}`,
              borderLeft: active ? '1px solid var(--line)' : 'none',
              borderRight: active ? '1px solid var(--line)' : 'none',
              color: isExited ? 'var(--fg-3)' : isDangerous ? (active ? '#ef7a7a' : 'var(--fg-2)') : active ? 'var(--fg-0)' : 'var(--fg-2)',
              fontSize: 11.5, cursor: 'pointer', position: 'relative', marginBottom: -1, maxWidth: 240,
              opacity: isExited && !active ? 0.6 : 1,
            }}
          >
            {/* Status indicator: dash for exited, dot for others */}
            {isExited
              ? <span style={{ width: 8, height: 2, borderRadius: 1, background: 'var(--fg-3)', flexShrink: 0 }} />
              : <span style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, flexShrink: 0, ...(s.status === 'active' ? { animation: 'cc-pulse 1.4s ease-in-out infinite' } : {}) }} />
            }
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: isExited ? 'line-through' : 'none' }}>{s.name}</span>
            {isDangerous && (
              <span title="--dangerously-skip-permissions" style={{ fontSize: 8, color: 'var(--err)', background: 'rgba(239,122,122,0.15)', border: '1px solid rgba(239,122,122,0.3)', borderRadius: 3, padding: '1px 3px', letterSpacing: 0.2, flexShrink: 0 }}>YOLO</span>
            )}
            {isExited && <span style={{ fontSize: 8.5, color: 'var(--fg-3)', background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 3, padding: '1px 4px', flexShrink: 0 }}>ended</span>}
            <span className="mono" style={{ fontSize: 9.5, color: 'var(--fg-3)', flexShrink: 0 }}>{s.alias}</span>
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
              borderRadius: '6px 6px 0 0',
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

      <button onClick={onNew} style={{ background: 'transparent', border: 'none', color: 'var(--fg-2)', padding: '0 10px', height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontFamily: 'inherit', flexShrink: 0 }}>
        <IPlus /><span>New</span><Kbd>⌘T</Kbd>
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
  const { aliases, activeProjectId, activeSessionId, setActiveProject, setActiveSession, setNewSessionOpen, projects } = useAppStore()
  const top4 = aliases.slice(0, 4)

  // Start a session with a specific alias by opening the new-session modal
  // We pre-select via a tiny event trick — simpler than threading props
  const start = () => onNew()

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 32, padding: '40px 24px', minHeight: 0,
    }}>
      {/* Icon + heading */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14, background: 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--accent-fg, #1a1410)',
          boxShadow: '0 0 0 8px var(--accent-soft)',
        }}>
          <svg width="26" height="26" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 5l3 3-3 3M9 11h4"/>
          </svg>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--fg-0)', marginBottom: 5 }}>
            Keine aktive Session
          </div>
          <div style={{ fontSize: 12, color: 'var(--fg-3)', maxWidth: 320 }}>
            Wähle einen Agent und starte eine neue Terminal-Session in diesem Projekt.
          </div>
        </div>
      </div>

      {/* Quick-start alias cards */}
      {top4.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 220px)', gap: 10 }}>
          {top4.map(alias => (
            <AliasCard key={alias.id} alias={alias} onStart={onNew} />
          ))}
        </div>
      )}

      {/* Primary CTA */}
      <button
        onClick={onNew}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--accent)', color: 'var(--accent-fg, #1a1410)',
          border: 'none', borderRadius: 8, padding: '9px 20px',
          fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        <IPlus />
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
        borderRadius: 8, padding: '12px 14px', cursor: 'pointer',
        background: hovered ? 'var(--accent-soft)' : 'var(--bg-1)',
        transition: 'border-color 0.15s, background 0.15s',
        display: 'flex', flexDirection: 'column', gap: 6,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 26, height: 26, borderRadius: 6, background: hovered ? 'var(--accent)' : 'var(--bg-3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          transition: 'background 0.15s',
        }}>
          <ITerminal style={{ color: hovered ? 'var(--accent-fg, #1a1410)' : 'var(--fg-2)', width: 12, height: 12 }} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)' }}>{alias.name}</span>
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
    terminalShortcuts,
  } = useAppStore()
  const [attachments, setAttachments]   = useState<string[]>([])
  const [picking, setPicking]           = useState(false)
  const [recording, setRecording]       = useState(false)
  const [editTemplate, setEditTemplate] = useState<Template | null>(null)
  const [tplMenu, setTplMenu]           = useState<{ x: number; y: number; tpl: Template } | null>(null)
  const [aiRefining, setAiRefining]     = useState(false)
  const [aiError, setAiError]           = useState('')
  const [pathInput, setPathInput]       = useState<'file' | 'image' | null>(null)
  const [pathInputVal, setPathInputVal] = useState('')
  const [showShortcuts, setShowShortcuts] = useState(false)
  const taRef      = useRef<HTMLTextAreaElement>(null)
  const recRef     = useRef<SpeechRecognition | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const project = projects.find(p => p.id === activeProjectId)
  const activeSession = project?.sessions.find(s => s.id === activeSessionId)
  const isTerminal = !!activeSession

  // Grow the outer container when content has many lines
  useEffect(() => {
    const lines = (inputValue.match(/\n/g) ?? []).length + 1
    if (lines > 3) onRequestH?.(Math.min(400, lines * 20 + 160))
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
    if (playwrightCheck) fullMsg += '\n\nTeste es mit Playwright aus und fixe Fehler die du beim Testen findest'
    if (localhostCheck)  fullMsg += '\n\nNach dem du fertig bist starte es im Browser unter localhost und dem richtigen Port'

    if (isTerminal) {
      window.dispatchEvent(new CustomEvent('cc:terminal-paste', { detail: fullMsg }))
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
    try {
      const r = await fetch('/api/ai-refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: provider.provider, apiKey: provider.apiKey, model: provider.model, text: inputValue }),
      })
      const d = await r.json() as { ok: boolean; text?: string; error?: string }
      if (d.ok && d.text) setInputValue(d.text)
      else setAiError(d.error ?? 'Fehler beim Überarbeiten')
    } catch (e) { setAiError(String(e)) }
    setAiRefining(false)
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
    window.dispatchEvent(new CustomEvent('cc:terminal-send-raw', { detail: signal }))
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
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '8px 14px 10px', background: 'var(--bg-1)', overflow: 'hidden' }}>
      <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={handleAttach} />

      {/* Terminal-Modus Badge */}
      {isTerminal && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontSize: 10, color: 'var(--accent)', fontWeight: 500, letterSpacing: 0.3, flexWrap: 'wrap' }}>
          <ITerminal style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <span>Terminal-Eingabe → {activeSession.alias}</span>
          <span style={{ color: 'var(--fg-3)' }}>·</span>
          <span style={{ color: 'var(--fg-3)' }}>⏎ sendet direkt</span>
          <span style={{ color: 'var(--fg-3)' }}>·</span>
          <span style={{ color: 'var(--fg-3)' }}>Pfade werden als Text eingefügt — Claude liest Dateien selbst</span>
        </div>
      )}

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

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', border: `1px solid ${isTerminal ? 'var(--accent-line)' : 'var(--line-strong)'}`, borderRadius: 8, background: 'var(--bg-2)', padding: '8px 10px 6px', boxShadow: isTerminal ? '0 0 0 2px var(--accent-soft)' : inputValue ? '0 0 0 3px var(--accent-soft)' : 'none', overflow: 'hidden' }}>
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
          style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-0)', background: 'transparent', border: 'none', outline: 'none', resize: 'none', width: '100%', flex: 1, minHeight: 0 }}
        />

        {/* Automation-Checkboxes (nur im Nicht-Terminal-Modus relevant, aber immer sichtbar) */}
        <div style={{ display: 'flex', gap: 14, padding: '5px 0 4px', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 10.5, color: playwrightCheck ? 'var(--accent)' : 'var(--fg-3)', userSelect: 'none' }}>
            <input type="checkbox" checked={playwrightCheck} onChange={e => setPlaywrightCheck(e.target.checked)} style={{ accentColor: 'var(--accent)', cursor: 'pointer' }} />
            Playwright-Test &amp; Fehler fixen
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 10.5, color: localhostCheck ? 'var(--accent)' : 'var(--fg-3)', userSelect: 'none' }}>
            <input type="checkbox" checked={localhostCheck} onChange={e => setLocalhostCheck(e.target.checked)} style={{ accentColor: 'var(--accent)', cursor: 'pointer' }} />
            Im Browser starten (localhost)
          </label>
        </div>

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
                style={{ ...chip, background: pathInput === 'file' ? 'var(--accent-soft)' : 'var(--bg-3)', border: `1px solid ${pathInput === 'file' ? 'var(--accent)' : 'var(--line)'}`, color: pathInput === 'file' ? 'var(--accent)' : 'var(--fg-1)' }}
                onClick={() => { setPathInput(p => p === 'file' ? null : 'file'); setPathInputVal('') }}
                title="Pfad einfügen — Datei aus dem Finder hier reinziehen oder Pfad eintippen"
              >
                <IFile style={{ color: pathInput === 'file' ? 'var(--accent)' : 'var(--accent)', flexShrink: 0 }} />
                Pfad einfügen
              </button>
              <button
                style={{ ...chip, background: pathInput === 'image' ? 'var(--accent-soft)' : 'var(--bg-3)', border: `1px solid ${pathInput === 'image' ? 'var(--accent)' : 'var(--line)'}`, color: pathInput === 'image' ? 'var(--accent)' : 'var(--fg-1)' }}
                onClick={() => { setPathInput(p => p === 'image' ? null : 'image'); setPathInputVal('') }}
                title="Bild einfügen — fügt --image &quot;/pfad&quot; ein"
              >
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke={pathInput === 'image' ? 'var(--accent)' : 'var(--accent)'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <rect x="1" y="2" width="10" height="8" rx="1.5"/>
                  <circle cx="4" cy="5" r="1"/>
                  <path d="M1 9l3-3 2 2 2-2 3 3"/>
                </svg>
                Bild einfügen
              </button>
              {/* Shortcuts reference button */}
              <button
                style={{ ...chip, background: showShortcuts ? 'var(--accent-soft)' : 'var(--bg-3)', border: `1px solid ${showShortcuts ? 'var(--accent)' : 'var(--line)'}`, color: showShortcuts ? 'var(--accent)' : 'var(--fg-2)', padding: '3px 7px' }}
                onClick={() => setShowShortcuts(v => !v)}
                title="Terminal-Tastenkürzel anzeigen"
              >
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <rect x="1" y="2.5" width="10" height="7" rx="1.5"/>
                  <path d="M3 5h1M5.5 5h1M8 5h1M3 7.5h6"/>
                </svg>
              </button>
            </>
          ) : (
            <button style={chip} onClick={() => fileInputRef.current?.click()}>
              <IFile style={{ color: 'var(--accent)', flexShrink: 0 }} />
              Anhang
            </button>
          )}
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>
            <Kbd>⏎</Kbd>{isTerminal ? ' Terminal' : ' senden'} · <Kbd>⇧⏎</Kbd> Zeile
          </span>
          <button
            onClick={toggleVoice}
            title={recording ? 'Aufnahme stoppen' : 'Spracheingabe starten'}
            style={{ ...chip, padding: '4px 7px', color: recording ? 'var(--err)' : 'var(--fg-2)', border: `1px solid ${recording ? 'var(--err)' : 'var(--line)'}`, background: recording ? 'rgba(239,122,122,0.1)' : 'var(--bg-3)' }}
          >
            <IMic style={{ color: recording ? 'var(--err)' : 'var(--fg-3)', flexShrink: 0, ...(recording ? { animation: 'cc-pulse 1s ease-in-out infinite' } : {}) }} />
          </button>
          <button
            onClick={refineWithAI}
            disabled={aiRefining || !inputValue.trim()}
            title={(() => {
              if (aiProviders.length === 0) return 'AI-Anbieter in Settings → AI einrichten'
              const tid = aiFunctionMap['terminal'] || activeAiProvider
              const p = aiProviders.find(p => p.id === tid) ?? aiProviders[0]
              return `Text mit ${p.name} überarbeiten`
            })()}
            style={{ ...chip, padding: '4px 7px', color: 'var(--accent)', border: '1px solid var(--accent-line)', background: 'var(--accent-soft)', opacity: (aiRefining || !inputValue.trim()) ? 0.5 : 1 }}
          >
            <ISpark style={{ flexShrink: 0, width: 13, height: 13, ...(aiRefining ? { animation: 'cc-pulse 0.5s ease-in-out infinite' } : {}) }} />
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
          <svg width="13" height="13" viewBox="0 0 12 12" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="2.5" width="10" height="7" rx="1.5"/>
            <path d="M3 5h1M5.5 5h1M8 5h1M3 7.5h6"/>
          </svg>
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
const chip: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 99, color: 'var(--fg-1)', fontSize: 10.5, cursor: 'pointer', fontFamily: 'var(--font-ui)' }
const ftBtn: React.CSSProperties = { background: 'transparent', border: '1px solid var(--line)', borderRadius: 4, color: 'var(--fg-1)', fontSize: 10.5, padding: '2px 7px', cursor: 'pointer', fontFamily: 'var(--font-ui)', flexShrink: 0 }
