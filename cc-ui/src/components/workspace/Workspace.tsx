import { useRef, useState, useCallback, useEffect } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { ProjectSidebar } from './ProjectSidebar'
import { CenterPane } from './CenterPane'
import { UtilityPanel } from './UtilityPanel'
import { IMoon, ISun, ILogout } from '../primitives/Icons'
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
    /* 8 px hit area, 1 px visible line centred inside */
    <div
      onMouseDown={onMouseDown}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 8, flexShrink: 0, cursor: 'col-resize',
        display: 'flex', alignItems: 'stretch', justifyContent: 'center',
        position: 'relative', zIndex: 10,
      }}
    >
      <div style={{
        width: 1, background: hover ? 'var(--accent)' : 'var(--line)',
        transition: 'background 0.15s',
      }} />
    </div>
  )
}

export function Workspace() {
  const {
    theme, setTheme, setScreen, preset, setPreset, setAccent, setAccentFg,
    terminalTheme, setTerminalTheme,
    projects, activeProjectId, setActiveSession, setNewSessionOpen,
  } = useAppStore()

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

  // ── Global keyboard shortcuts (capture phase to beat browser defaults) ────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey
      if (!meta) return

      // Cmd+T — new session
      if (e.key === 't' || e.key === 'T') {
        e.preventDefault()
        setNewSessionOpen(true)
        return
      }

      // Cmd+1..9 — switch to session at index
      const n = parseInt(e.key, 10)
      if (n >= 1 && n <= 9) {
        const project = projects.find(p => p.id === activeProjectId)
        const session = project?.sessions[n - 1]
        if (session) {
          e.preventDefault()
          setActiveSession(session.id)
        }
      }
    }
    window.addEventListener('keydown', handler, { capture: true })
    return () => window.removeEventListener('keydown', handler, { capture: true })
  }, [projects, activeProjectId, setActiveSession, setNewSessionOpen])

  const [sidebarW, setSidebarW] = useState(248)
  const [utilityW, setUtilityW] = useState(280)

  const dragLeft  = useResizeDrag(useCallback((dx: number) => {
    setSidebarW(w => Math.min(400, Math.max(160, w + dx)))
  }, []))

  const dragRight = useResizeDrag(useCallback((dx: number) => {
    setUtilityW(w => Math.min(440, Math.max(180, w - dx)))
  }, []))

  return (
    <div
      style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-0)' }}
    >
      {/* Window chrome */}
      <div style={{ height: 36, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px', background: 'var(--bg-1)', borderBottom: '1px solid var(--line)', userSelect: 'none' }}>
        <div style={{ display: 'flex', gap: 7 }}>
          <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#ff5f57', cursor: 'pointer' }} title="Close" />
          <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#ffbd2e', cursor: 'pointer' }} title="Minimize" />
          <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#28c941', cursor: 'pointer' }} title="Fullscreen" />
        </div>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 11, color: 'var(--fg-2)', letterSpacing: 0.2 }}>
          claude code ui
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {theme === 'dark'
            ? <IMoon style={{ color: 'var(--fg-2)', cursor: 'pointer' }} onClick={toggleTheme} title="Switch to light mode" />
            : <ISun  style={{ color: 'var(--fg-2)', cursor: 'pointer' }} onClick={toggleTheme} title="Switch to dark mode"  />
          }
          <button
            onClick={() => setScreen('login')}
            title="Zurück zum Login"
            style={{ background: 'transparent', border: '1px solid var(--line)', borderRadius: 4, padding: '3px 6px', cursor: 'pointer', color: 'var(--fg-3)', display: 'flex', alignItems: 'center' }}
          >
            <ILogout />
          </button>
        </div>
      </div>

      {/* 3-pane body */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Sidebar */}
        <div style={{ width: sidebarW, flexShrink: 0, display: 'flex', overflow: 'hidden' }}>
          <ProjectSidebar />
        </div>

        <VDivider onMouseDown={dragLeft} />

        {/* Center — takes all remaining space */}
        <CenterPane />

        <VDivider onMouseDown={dragRight} />

        {/* Utility panel */}
        <div style={{ width: utilityW, flexShrink: 0, display: 'flex', overflow: 'hidden' }}>
          <UtilityPanel />
        </div>
      </div>
    </div>
  )
}
