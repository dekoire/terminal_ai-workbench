import { useState, useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '../../../store/useAppStore'
import { readProjectConfig } from '../../../utils/launchUtils'
import type { ProjectConfig } from '../../../utils/launchUtils'
import { useAppLauncher } from '../../../hooks/useAppLauncher'
import { IScrollText, IRefresh, ISearch, IClose, IPlay } from '../../primitives/Icons'

// ── Types ─────────────────────────────────────────────────────────────────────

type Level = 'error' | 'warn' | 'info' | 'debug'
type PortStatus = 'running' | 'stopped' | 'unknown'

interface LogLine {
  id: number
  raw: string
  level: Level
  ts: string | null
  source: string
}

interface LogSource {
  key: string
  label: string
  port: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

let _lineId = 0

function parseLevel(raw: string): Level {
  if (/error|Error|ERROR|ERR!/i.test(raw)) return 'error'
  if (/warn|Warn|WARN|WARNING/i.test(raw)) return 'warn'
  if (/info|Info|INFO|\[vite\]|\[server\]|listening|ready|compiled|success/i.test(raw)) return 'info'
  return 'debug'
}

function parseTs(raw: string): string | null {
  return raw.match(/\d{2}:\d{2}:\d{2}/)?.[0] ?? null
}

function parseContent(text: string, source: string, fallbackTs: string | null = null): LogLine[] {
  return text
    .split('\n')
    .filter(l => l.trim().length > 0)
    .map(raw => ({
      id: ++_lineId,
      raw,
      level: parseLevel(raw),
      ts: parseTs(raw) ?? fallbackTs,
      source,
    }))
}

function hexAlpha(hex: string, a: number) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

function buildLevelStyle(colors: { error: string; warn: string; info: string; debug: string }) {
  return {
    error: { border: colors.error, bg: hexAlpha(colors.error, 0.08), badge: colors.error, text: colors.error },
    warn:  { border: colors.warn,  bg: hexAlpha(colors.warn,  0.07), badge: colors.warn,  text: colors.warn  },
    info:  { border: colors.info,  bg: hexAlpha(colors.info,  0.06), badge: colors.info,  text: 'var(--fg-1)' },
    debug: { border: colors.debug, bg: 'transparent',                 badge: colors.debug, text: 'var(--fg-3)' },
  }
}

const MAX_LINES = 5000

// ── LogsTab ───────────────────────────────────────────────────────────────────

export function LogsTab({ projectId }: { projectId: string | undefined }) {
  const projects   = useAppStore(s => s.projects)
  const logColors  = useAppStore(s => s.logColors)
  const project    = projects.find(p => p.id === projectId)
  const LEVEL_STYLE = buildLevelStyle(logColors)

  // Share the same launcher state as the Play button — no separate port detection needed
  const { state: launcherState } = useAppLauncher(projectId, false)

  const [logs,           setLogs]           = useState<LogLine[]>([])
  const [paused,         setPaused]         = useState(false)
  const [filter,         setFilter]         = useState('')
  const [levelFilter,    setLevelFilter]    = useState<'all' | Level>('all')
  const [timeFrom,       setTimeFrom]       = useState('')
  const [timeTo,         setTimeTo]         = useState('')
  const [autoScroll,     setAutoScroll]     = useState(true)
  const [portStatus,     setPortStatus]     = useState<PortStatus>('unknown')
  const [config,         setConfig]         = useState<ProjectConfig | null>(null)
  const [manualPort,     setManualPort]     = useState('')
  const [sources,        setSources]        = useState<LogSource[]>([])
  const [selectedSource, setSelectedSource] = useState<string>('')

  const listRef    = useRef<HTMLDivElement>(null)
  const prevRawRef = useRef<Record<string, string>>({})  // source → last raw content

  // Reset all state when project changes
  useEffect(() => {
    setLogs([])
    setFilter('')
    setLevelFilter('all')
    setTimeFrom('')
    setTimeTo('')
    setAutoScroll(true)
    setPortStatus('unknown')
    setConfig(null)
    setManualPort('')
    setSources([])
    setSelectedSource('')
    prevRawRef.current = {}
  }, [projectId])

  // Port priority: launcher state (Play button) → config → store → manual input
  const activePort = (() => {
    const src = sources.find(s => s.key === selectedSource)
    if (src) return src.port
    if (launcherState.port) return launcherState.port
    if (config?.port) return config.port
    if (project?.appPort) return project.appPort
    const m = parseInt(manualPort, 10)
    return isNaN(m) ? undefined : m
  })()

  // When launcher says running, trust it immediately — no need to wait for check-port
  useEffect(() => {
    if (launcherState.status === 'running') setPortStatus('running')
    else if (launcherState.status === 'error') setPortStatus('stopped')
  }, [launcherState.status])

  // Build sources list whenever launcher port / config / project changes
  useEffect(() => {
    const seen = new Set<number>()
    const list: LogSource[] = []
    const add = (port: number, label: string) => {
      if (seen.has(port)) return
      seen.add(port)
      list.push({ key: `port:${port}`, label: `Port ${port} — ${label}`, port })
    }
    if (launcherState.port) add(launcherState.port, 'App')
    if (config?.port && config.port !== launcherState.port) add(config.port, 'App')
    if (project?.appPort && project.appPort !== launcherState.port && project.appPort !== config?.port) add(project.appPort, 'App')
    setSources(list)
    if (list.length > 0 && !selectedSource) setSelectedSource(list[0].key)
  }, [launcherState.port, config, project?.appPort, selectedSource])

  // Polling tick
  const tick = useCallback(async () => {
    if (!activePort) return

    // 1. Port status
    try {
      const r = await fetch(`/api/check-port?port=${activePort}`)
      const d = await r.json() as { inUse?: boolean }
      setPortStatus(d.inUse ? 'running' : 'stopped')
    } catch { setPortStatus('unknown') }

    // 2. Logs (50k chars)
    if (!paused) {
      try {
        const r = await fetch(`/api/app-log?port=${activePort}&chars=50000`)
        const d = await r.json() as { ok?: boolean; content?: string }
        const raw = d.content ?? ''
        const prev = prevRawRef.current[selectedSource] ?? ''
        if (raw && raw !== prev) {
          prevRawRef.current[selectedSource] = raw
          const nowTs = new Date().toTimeString().slice(0, 8)
          if (raw.length > prev.length && raw.startsWith(prev)) {
            // Incremental: only new content at the end — apply current time as fallback ts
            const newLines = parseContent(raw.slice(prev.length), selectedSource, nowTs)
            setLogs(old => [...old, ...newLines].slice(-MAX_LINES))
          } else {
            // Full re-parse (rotation / first load) — no fallback ts
            setLogs(parseContent(raw, selectedSource).slice(-MAX_LINES))
          }
        }
      } catch { /* ignore */ }
    }

    // 3. Re-read project.config.json (agent might have updated it)
    if (project?.path) {
      try {
        const cfg = await readProjectConfig(project.path)
        if (cfg) setConfig(cfg)
      } catch { /* ignore */ }
    }
  }, [activePort, paused, selectedSource, project?.path])

  // Auto-start on mount + polling every 3s
  useEffect(() => {
    // Load config once on mount
    if (project?.path) {
      readProjectConfig(project.path).then(cfg => { if (cfg) setConfig(cfg) }).catch(() => {})
    }
    tick()
    const id = setInterval(tick, 3000)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSource, project?.path])

  // Paused state change restarts tick dep
  useEffect(() => {
    if (!paused) tick()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused])

  // Auto-scroll — defer one frame so DOM has rendered new lines
  useEffect(() => {
    if (!autoScroll) return
    const id = requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
    })
    return () => cancelAnimationFrame(id)
  }, [logs, autoScroll])

  // Filtered view
  const visible = logs.filter(l => {
    if (levelFilter !== 'all' && l.level !== levelFilter) return false
    if (filter && !l.raw.toLowerCase().includes(filter.toLowerCase())) return false
    if (timeFrom && l.ts && l.ts < timeFrom) return false
    if (timeTo   && l.ts && l.ts > timeTo)   return false
    return true
  })

  // ── Styles ───────────────────────────────────────────────────────────────────
  const s = {
    root:    { display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-0)', overflow: 'hidden' } as React.CSSProperties,
    header:  { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderBottom: '1px solid var(--line)', flexShrink: 0 } as React.CSSProperties,
    dot:     (status: PortStatus): React.CSSProperties => ({
      width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
      background: status === 'running' ? '#22c55e' : status === 'stopped' ? '#ef4444' : '#94a3b8',
    }),
    toolbar: { display: 'flex', alignItems: 'center', gap: 4, padding: '5px 8px', borderBottom: '1px solid var(--line)', flexShrink: 0, flexWrap: 'wrap' as const } as React.CSSProperties,
    input:   { padding: '3px 6px', borderRadius: 5, border: '1px solid var(--line)', background: 'var(--bg-1)', color: 'var(--fg-1)', fontSize: 11, fontFamily: 'var(--font-ui)', outline: 'none' } as React.CSSProperties,
    btn:     (active?: boolean): React.CSSProperties => ({
      padding: '3px 8px', borderRadius: 5, border: '1px solid var(--line)', cursor: 'pointer', fontSize: 10.5, fontFamily: 'var(--font-ui)', fontWeight: 500,
      background: active ? 'var(--accent)' : 'var(--bg-1)', color: active ? 'var(--accent-fg)' : 'var(--fg-2)',
    }),
    select:  { padding: '3px 6px', borderRadius: 5, border: '1px solid var(--line)', background: 'var(--bg-1)', color: 'var(--fg-1)', fontSize: 11, fontFamily: 'var(--font-ui)', cursor: 'pointer', outline: 'none' } as React.CSSProperties,
  }

  const pidInfo  = config?.pid ? ` · PID ${config.pid}` : ''
  const portLabel = activePort ? `localhost:${activePort}` : '—'
  const isEmpty   = !activePort || (portStatus === 'stopped' && logs.length === 0)

  return (
    <div style={s.root}>

      {/* Status header */}
      <div style={s.header}>
        <div style={s.dot(activePort ? portStatus : 'unknown')} />
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-1)', fontFamily: 'var(--font-ui)', flex: 1 }}>
          {portStatus === 'running' ? 'Running' : portStatus === 'stopped' ? 'Stopped' : 'Unknown'}
          {' · '}<span style={{ fontWeight: 400, color: 'var(--fg-2)' }}>{portLabel}{pidInfo}</span>
        </span>
        <button onClick={tick} style={{ ...s.btn(), padding: '2px 6px', display: 'flex', alignItems: 'center', gap: 3 }} title="Manuell aktualisieren">
          <IRefresh style={{ width: 11, height: 11 }} />
        </button>
        <button onClick={() => { setLogs([]); prevRawRef.current = {} }} style={{ ...s.btn(), padding: '2px 6px', display: 'flex', alignItems: 'center', gap: 3 }} title="Logs leeren">
          <IClose style={{ width: 11, height: 11 }} />
        </button>
      </div>

      {/* Source combobox (only if ≥2 sources) */}
      {sources.length >= 2 && (
        <div style={{ padding: '4px 8px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
          <select value={selectedSource} onChange={e => { setSelectedSource(e.target.value); setLogs([]); prevRawRef.current = {} }} style={{ ...s.select, width: '100%' }}>
            {sources.map(src => <option key={src.key} value={src.key}>{src.label}</option>)}
          </select>
        </div>
      )}

      {/* Filter toolbar */}
      <div style={s.toolbar}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1, minWidth: 80 }}>
          <ISearch style={{ position: 'absolute', left: 5, width: 10, height: 10, color: 'var(--fg-3)', pointerEvents: 'none' }} />
          <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Suchen…"
            style={{ ...s.input, width: '100%', paddingLeft: 18 }} />
        </div>

        <select value={levelFilter} onChange={e => setLevelFilter(e.target.value as typeof levelFilter)} style={s.select}>
          <option value="all">Alle</option>
          <option value="error">Error</option>
          <option value="warn">Warn</option>
          <option value="info">Info</option>
          <option value="debug">Debug</option>
        </select>

        <input value={timeFrom} onChange={e => setTimeFrom(e.target.value)} placeholder="von HH:MM"
          style={{ ...s.input, width: 64 }} title="Zeitfilter von (HH:MM:SS)" />
        <input value={timeTo} onChange={e => setTimeTo(e.target.value)} placeholder="bis HH:MM"
          style={{ ...s.input, width: 64 }} title="Zeitfilter bis (HH:MM:SS)" />

        <button onClick={() => setPaused(p => !p)} style={s.btn(paused)} title={paused ? 'Import fortsetzen' : 'Import pausieren'}>
          {paused ? '▶ Weiter' : '⏸ Pause'}
        </button>

        <button onClick={() => setAutoScroll(a => !a)} style={s.btn(autoScroll)} title="Auto-Scroll ans Ende">
          ↓
        </button>
      </div>

      {/* No port configured */}
      {!activePort && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16 }}>
          <IScrollText style={{ width: 28, height: 28, opacity: 0.25 }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-2)', fontFamily: 'var(--font-ui)' }}>Kein Port konfiguriert</span>
          <span style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-ui)' }}>Starte deine App über den Play-Button</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <input value={manualPort} onChange={e => setManualPort(e.target.value)} placeholder="Port manuell (z.B. 3000)"
              style={{ ...s.input, width: 160 }} onKeyDown={e => e.key === 'Enter' && tick()} />
            <button onClick={tick} style={s.btn()} title="Verbinden">
              <IPlay style={{ width: 10, height: 10 }} />
            </button>
          </div>
        </div>
      )}

      {/* No server running */}
      {activePort && isEmpty && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <IScrollText style={{ width: 28, height: 28, opacity: 0.2 }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-2)', fontFamily: 'var(--font-ui)' }}>Kein Server läuft</span>
          <span style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-ui)' }}>App starten um Logs zu sehen</span>
        </div>
      )}

      {/* No log file (agent-started) */}
      {activePort && portStatus === 'running' && logs.length === 0 && !config?.logFile && (
        <div style={{ padding: '6px 10px', background: 'rgba(245,158,11,0.08)', borderBottom: '1px solid rgba(245,158,11,0.2)', flexShrink: 0 }}>
          <span style={{ fontSize: 10.5, color: '#f59e0b', fontFamily: 'var(--font-ui)' }}>
            Prozess läuft auf Port {activePort} — kein Logfile (manuell / per Agent gestartet)
          </span>
        </div>
      )}

      {/* Log list */}
      {activePort && logs.length > 0 && (
        <div ref={listRef} style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.5 }}>
          {visible.length === 0 ? (
            <div style={{ padding: '20px 12px', textAlign: 'center', color: 'var(--fg-3)', fontSize: 11 }}>
              Keine Zeilen entsprechen dem Filter
            </div>
          ) : visible.map(line => {
            const ls = LEVEL_STYLE[line.level]
            return (
              <div key={line.id} style={{
                borderLeft: `3px solid ${ls.border}`,
                background: ls.bg,
                padding: '1px 8px 1px 6px',
                display: 'flex', gap: 6, alignItems: 'baseline',
                whiteSpace: 'nowrap', minWidth: 'max-content',
              }}>
                {line.ts && (
                  <span style={{ color: 'var(--fg-3)', flexShrink: 0, fontSize: 10, letterSpacing: 0.3 }}>{line.ts}</span>
                )}
                <span style={{ color: ls.badge, fontWeight: 700, flexShrink: 0, fontSize: 9.5, letterSpacing: 0.5, textTransform: 'uppercase', width: 34 }}>
                  {line.level}
                </span>
                <span style={{ color: ls.text, flex: 1 }}>{line.raw}</span>
              </div>
            )
          })}

          {paused && (
            <div style={{ padding: '6px 10px', textAlign: 'center', background: 'rgba(245,158,11,0.1)', color: '#f59e0b', fontSize: 10.5, fontFamily: 'var(--font-ui)', fontWeight: 600 }}>
              ⏸ Import pausiert — {logs.length} Zeilen im Speicher
            </div>
          )}
        </div>
      )}
    </div>
  )
}
