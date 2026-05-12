import { useRef, useState, useCallback, useEffect } from 'react'
import { useAppStore } from '../../store/useAppStore'
import logoWhite from '../../assets/codera_logo_white.png'
import logoBlack from '../../assets/codera_logo_black.png'
import { ProjectSidebar } from './ProjectSidebar'
import { CenterPane } from './CenterPane'
import { UtilityPanel } from './UtilityPanel'
import { IMoon, ISun, ILogout, ITerminal, IPlay, ICpu, IScrollText, ITrophy, IWeb } from '../primitives/Icons'
import { ModelBrowserModal } from '../modals/ModelBrowserModal'
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
    theme, setTheme, setScreen, openWorkshop, preset, setPreset, setAccent, setAccentFg,
    terminalTheme, setTerminalTheme,
    projects, activeProjectId, activeSessionId, setActiveSession, setNewSessionOpen, showTitleBar,
    logoSize,
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

  // ── File tabs (lifted from CenterPane so SessionTabs can live here) ───────
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
  const [playBlink, setPlayBlink] = useState(false)
  const [docsBlink, setDocsBlink] = useState(false)
  const [modelBrowserOpen, setModelBrowserOpen] = useState(false)

  const triggerPlay = useCallback(() => {
    window.dispatchEvent(new CustomEvent('cc:hdr-play'))
    setPlayBlink(true)
    setTimeout(() => setPlayBlink(false), 1200)
  }, [])

  const triggerDocs = useCallback(() => {
    window.dispatchEvent(new CustomEvent('cc:hdr-docs'))
    setDocsBlink(true)
    setTimeout(() => setDocsBlink(false), 1200)
  }, [])

  const dragLeft  = useResizeDrag(useCallback((dx: number) => {
    setSidebarW(w => Math.min(480, Math.max(0, w + dx)))
  }, []))

  const dragRight = useResizeDrag(useCallback((dx: number) => {
    setUtilityW(w => Math.min(600, Math.max(0, w - dx)))
  }, []))

  // suppress unused-import warnings for theme toggle icons
  void theme; void setScreen; void IMoon; void ISun; void ILogout

  return (
    <div
      style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-0)' }}
    >
      {/* Window chrome */}
      {(showTitleBar ?? true) && (
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: isElectron ? '10px 12px 10px 88px' : '10px 12px', background: 'var(--bg-1)', borderBottom: '1px solid var(--line)', userSelect: 'none', WebkitAppRegion: 'drag' } as React.CSSProperties}>
          {/* Logo — links, kein Drag */}
          <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, marginLeft: 10, WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <img src={theme === 'light' ? logoBlack : logoWhite} alt="Codera AI" style={{ height: 42, width: 'auto', display: 'block' }} />
          </div>

          <div style={{ flex: 1 }} />

          {/* Action icons — right (no-drag so buttons stay clickable) */}
          {activeProject && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0, WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
              <button onClick={openWorkshop} title="UI Workshop — Browser, Inspect & Annotate"
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--fg-2)', display: 'flex', alignItems: 'center' }}>
                <IWeb style={{ width: 15, height: 15 }} />
              </button>
              <button onClick={triggerPlay} title="Dev Server starten"
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: playBlink ? '#22c55e' : 'var(--fg-2)', display: 'flex', alignItems: 'center', transition: 'color 0.15s', animation: playBlink ? 'cc-blink-green 0.4s ease-in-out 3' : 'none' }}>
                <IPlay style={{ width: 15, height: 15 }} />
              </button>
              <button onClick={() => window.dispatchEvent(new CustomEvent('cc:hdr-config'))} title="Port / Befehl konfigurieren"
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--fg-2)', display: 'flex', alignItems: 'center' }}>
                <ICpu style={{ width: 15, height: 15 }} />
              </button>
              <button onClick={triggerDocs} title="Docs aktualisieren"
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: docsBlink ? '#3b82f6' : 'var(--fg-2)', display: 'flex', alignItems: 'center', transition: 'color 0.15s', animation: docsBlink ? 'cc-blink-blue 0.4s ease-in-out 3' : 'none' }}>
                <IScrollText style={{ width: 15, height: 15 }} />
              </button>
              <button onClick={() => setModelBrowserOpen(true)} title="Modell-Browser"
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--fg-2)', display: 'flex', alignItems: 'center' }}>
                <ITrophy style={{ width: 15, height: 15 }} />
              </button>
            </div>
          )}
          {modelBrowserOpen && <ModelBrowserModal onClose={() => setModelBrowserOpen(false)} />}
        </div>
      )}

      {/* 3-pane body */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Sidebar */}
        <div style={{ width: sidebarW, flexShrink: 0, display: 'flex', overflow: 'hidden' }}>
          <ProjectSidebar />
        </div>

        <VDivider onMouseDown={dragLeft} />

        {/* Center — takes all remaining space */}
        <CenterPane
          fileTabs={fileTabs}
          activeFilePath={activeFilePath}
          setActiveFilePath={setActiveFilePath}
          closeFileTab={closeFileTab}
        />

        <VDivider onMouseDown={dragRight} />

        {/* Utility panel */}
        <div style={{ width: utilityW, flexShrink: 0, display: 'flex', overflow: 'hidden' }}>
          <UtilityPanel />
        </div>
      </div>
    </div>
  )
}
