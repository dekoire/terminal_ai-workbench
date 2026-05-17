import { useRef, useState, useCallback, useEffect } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { LeftSidebar } from './LeftSidebar'
import { CenterPanel } from './CenterPanel'
import { RightSidebar } from './RightSidebar'
import { TopBar } from './TopBar'
import { IMoon, ISun, ILogout, ITerminal, IPanelLeftOpen, IPanelLeftClose, IPanelRightOpen, IPanelRightClose } from '../primitives/Icons'
import { DESIGN_PRESETS, applyPreset } from '../../theme/presets'

// ── drag-to-resize hook ───────────────────────────────────────────────────────
function useResizeDrag(
  onMove: (delta: number) => void,
  direction: 'horizontal' | 'vertical' = 'horizontal',
) {
  const dragging = useRef(false)
  const last     = useRef(0)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    last.current = direction === 'horizontal' ? e.clientX : e.clientY

    const move = (ev: MouseEvent) => {
      if (!dragging.current) return
      const pos   = direction === 'horizontal' ? ev.clientX : ev.clientY
      const delta = pos - last.current
      last.current = pos
      onMove(delta)
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
    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize'
    document.body.style.userSelect = 'none'
  }, [direction, onMove])

  return onMouseDown
}

// ── thin drag divider ─────────────────────────────────────────────────────────
function VDivider({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  const [hover, setHover] = useState(false)
  return (
    /* 1px visible line, wider invisible hit area via absolute overlay */
    <div
      style={{ width: 1, flexShrink: 0, position: 'relative', zIndex: 10,
        background: hover ? 'var(--accent)' : 'var(--line)', transition: 'background 0.15s' }}
    >
      <div
        onMouseDown={onMouseDown}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{ position: 'absolute', inset: '0 -5px', cursor: 'col-resize' }}
      />
    </div>
  )
}

export function Workspace() {
  const {
    theme, setTheme, setScreen, preset, setPreset, setAccent, setAccentFg,
    terminalTheme, setTerminalTheme,
    projects, activeProjectId, activeSessionId, setActiveSession, setNewSessionOpen,
  } = useAppStore()

  const isElectron = navigator.userAgent.includes('Electron')
  const activeProject = projects.find(p => p.id === activeProjectId)
  const sessions = activeProject?.sessions ?? []

  const toggleTheme = () => {
    const cur = DESIGN_PRESETS.find(d => d.id === preset) ?? DESIGN_PRESETS[0]
    const nextId = cur.dark ? 'light-' + cur.id : cur.id.replace(/^light-/, '')
    const next = DESIGN_PRESETS.find(d => d.id === nextId) ?? cur
    setPreset(next.id)
    setTheme(next.dark ? 'dark' : 'light')
    setAccent(next.accent)
    setAccentFg(next.accentFg)
    applyPreset(next)
    // Auto-switch terminal theme between default pairs
    if (next.dark && terminalTheme === 'github-light') setTerminalTheme('default')
    if (!next.dark && terminalTheme === 'default') setTerminalTheme('github-light')
  }

  // ── File tabs (lifted from CenterPanel so SessionTabs can live here) ────
  const [fileTabs, setFileTabs] = useState<string[]>([])
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null)

  useEffect(() => {
    const handler = (e: Event) => {
      const path = (e as CustomEvent<string>).detail
      setFileTabs(prev => prev.includes(path) ? prev : [...prev, path])
      setActiveFilePath(path)
    }
    window.addEventListener('cc:open-file-tab', handler)
    return () => window.removeEventListener('cc:open-file-tab', handler)
  }, [])

  const closeFileTab = useCallback((path: string) => {
    setFileTabs(prev => {
      const next = prev.filter(p => p !== path)
      setActiveFilePath(cur => cur === path ? (next.length > 0 ? next[next.length - 1] : null) : cur)
      return next
    })
  }, [])

  const selectSession = useCallback((sid: string) => {
    setActiveFilePath(null)
    setActiveSession(sid)
  }, [setActiveSession])

  // ── Global keyboard shortcuts (capture phase) ─────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey
      if (!meta) return

      if (e.key === 't' || e.key === 'T') {
        e.preventDefault()
        setNewSessionOpen(true)
        return
      }

      if (e.key === 'w') {
        setActiveFilePath(cur => { if (cur) { e.preventDefault(); closeFileTab(cur) } return cur })
        return
      }

      const n = parseInt(e.key, 10)
      if (n >= 1 && n <= 9) {
        e.preventDefault()
        if (n <= sessions.length) {
          selectSession(sessions[n - 1].id)
        } else {
          const fi = n - sessions.length - 1
          setFileTabs(tabs => { if (fi >= 0 && fi < tabs.length) setActiveFilePath(tabs[fi]); return tabs })
        }
      }
    }
    window.addEventListener('keydown', handler, { capture: true })
    return () => window.removeEventListener('keydown', handler, { capture: true })
  }, [sessions, closeFileTab, selectSession, setNewSessionOpen])

  const [sidebarW, setSidebarW] = useState(248)
  const [utilityW, setUtilityW] = useState(280)
  const savedSidebarW = useRef(248)
  const savedUtilityW = useRef(280)

  const [winW, setWinW] = useState(window.innerWidth)
  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)

  useEffect(() => {
    const onResize = () => setWinW(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const compact = winW < 900

  useEffect(() => {
    if (compact) { setLeftOpen(false); setRightOpen(false) }
    else         { setLeftOpen(true);  setRightOpen(true) }
  }, [compact])

  const showLeft  = !compact || leftOpen
  const showRight = !compact || rightOpen

  const dragLeft  = useResizeDrag(useCallback((dx: number) => {
    setSidebarW(w => {
      const next = Math.min(480, Math.max(0, w + dx))
      if (next > 25) savedSidebarW.current = next
      return next
    })
  }, []))

  const dragRight = useResizeDrag(useCallback((dx: number) => {
    setUtilityW(w => {
      const next = Math.min(600, Math.max(0, w - dx))
      if (next > 25) savedUtilityW.current = next
      return next
    })
  }, []))

  // suppress unused-import warnings for theme toggle icons
  void theme; void setScreen; void IMoon; void ISun; void ILogout; void ITerminal; void isElectron

  return (
    <div
      style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-0)' }}
    >
      {/* Window chrome — extracted to TopBar */}
      <TopBar />

      {/* 3-pane body */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, position: 'relative' }}>
        {/* Sidebar */}
        {showLeft && (
          <div style={{ width: sidebarW, flexShrink: 0, display: 'flex', overflow: 'hidden' }}>
            <LeftSidebar />
          </div>
        )}
        {showLeft && <VDivider onMouseDown={dragLeft} />}

        {/* Center — takes all remaining space */}
        <CenterPanel
          fileTabs={fileTabs}
          activeFilePath={activeFilePath}
          setActiveFilePath={setActiveFilePath}
          closeFileTab={closeFileTab}
        />

        {showRight && projects.length > 0 && <VDivider onMouseDown={dragRight} />}

        {/* Utility panel — only visible when at least one workspace exists */}
        {showRight && projects.length > 0 && (
          <div style={{ width: utilityW, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <RightSidebar />
          </div>
        )}

        {/* Panel toggle buttons — compact mode OR manually dragged narrow (≤ 25px) */}
        {(() => {
          const sidebarNarrow = !compact && sidebarW <= 100
          const utilityNarrow = !compact && utilityW <= 100
          const showLeftBtn  = compact || sidebarNarrow
          const showRightBtn = compact || utilityNarrow
          if (!showLeftBtn && !showRightBtn) return null
          const btnStyle = { position: 'absolute' as const, top: 'calc(50% - 20px)', transform: 'translateY(-50%)', zIndex: 30, background: 'var(--bg-2)', border: '1px solid var(--line-strong)', borderRadius: 6, padding: '5px 6px', cursor: 'pointer', color: 'var(--fg-2)', display: 'flex', alignItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }
          return (
            <>
              {showLeftBtn && (
                <button
                  onClick={() => compact ? setLeftOpen(o => !o) : setSidebarW(savedSidebarW.current)}
                  title={compact && leftOpen ? 'Linkes Panel schließen' : 'Linkes Panel öffnen'}
                  style={{ ...btnStyle, left: showLeft ? sidebarW + 8 : 8, transition: 'left 0.2s' }}
                >
                  {compact && leftOpen ? <IPanelLeftClose style={{ width: 15, height: 15 }} /> : <IPanelLeftOpen style={{ width: 15, height: 15 }} />}
                </button>
              )}
              {showRightBtn && (
                <button
                  onClick={() => compact ? setRightOpen(o => !o) : setUtilityW(savedUtilityW.current)}
                  title={compact && rightOpen ? 'Rechtes Panel schließen' : 'Rechtes Panel öffnen'}
                  style={{ ...btnStyle, right: showRight ? utilityW + 8 : 8, transition: 'right 0.2s' }}
                >
                  {compact && rightOpen ? <IPanelRightClose style={{ width: 15, height: 15 }} /> : <IPanelRightOpen style={{ width: 15, height: 15 }} />}
                </button>
              )}
            </>
          )
        })()}
      </div>
    </div>
  )
}
