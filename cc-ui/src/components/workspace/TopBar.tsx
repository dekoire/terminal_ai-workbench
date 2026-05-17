import { useState, useCallback } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { ISpinner, ICompass, ISquareTerminal, IPlay, IKanban, IAppLayout, IBot } from '../primitives/Icons'
import { ModelBrowserModal } from '../modals/ModelBrowserModal'
import { LayoutEditorModal } from '../modals/LayoutEditorModal'

// ── TopBar ────────────────────────────────────────────────────────────────────
// Window chrome: logo + action buttons (Workshop, Terminal, Play, Kanban, Layout, Models).
// Reads all state from the store directly — no props drilling needed.
// Conditionally hidden when showTitleBar === false (user preference).

export function TopBar() {
  const showTitleBar   = useAppStore(s => s.showTitleBar)
  const logoSize       = useAppStore(s => s.logoSize)
  const projects       = useAppStore(s => s.projects)
  const activeProjectId = useAppStore(s => s.activeProjectId)
  const openWorkshop   = useAppStore(s => s.openWorkshop)

  const [playBlink,        setPlayBlink]        = useState(false)
  const [modelBrowserOpen, setModelBrowserOpen] = useState(false)
  const [layoutEditorOpen, setLayoutEditorOpen] = useState(false)

  const isElectron   = navigator.userAgent.includes('Electron')
  const activeProject = projects.find(p => p.id === activeProjectId)

  const triggerPlay = useCallback(() => {
    window.dispatchEvent(new CustomEvent('cc:hdr-play'))
    setPlayBlink(true)
    setTimeout(() => setPlayBlink(false), 1200)
  }, [])

  if (!(showTitleBar ?? true)) return null

  const iconBtn = {
    background: 'none', border: 'none', padding: 0,
    cursor: 'pointer', color: 'var(--fg-2)',
    display: 'flex', alignItems: 'center',
  } as const

  return (
    <div style={{
      flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10,
      padding: isElectron ? '20px 12px 20px 88px' : '20px 12px',
      background: 'var(--bg-1)', borderBottom: '1px solid var(--line)',
      userSelect: 'none', WebkitAppRegion: 'drag',
    } as React.CSSProperties}>

      {/* Logo — not draggable so text stays selectable */}
      <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, marginLeft: 10, WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <ISpinner spin={false} size={Math.round(logoSize * 0.635)} style={{ color: 'var(--accent)' }} />
          <span style={{ fontSize: Math.round(logoSize * 0.5), fontWeight: 700, color: 'var(--fg-0)', fontFamily: 'var(--font-ui)', letterSpacing: -0.3, lineHeight: 1 }}>
            Codera
          </span>
        </span>
      </div>

      <div style={{ flex: 1 }} />

      {/* Action buttons — only visible when a project is open */}
      {activeProject && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0, WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <button onClick={openWorkshop} title="UI Workshop — Browser, Inspect & Annotate" style={iconBtn}>
            <ICompass style={{ width: 15, height: 15 }} />
          </button>

          <button
            onClick={() => window.dispatchEvent(new CustomEvent('cc:open-project-terminal'))}
            title="Projekt-Terminal öffnen"
            style={iconBtn}
          >
            <ISquareTerminal style={{ width: 15, height: 15 }} />
          </button>

          <button
            onClick={triggerPlay}
            title="Dev Server starten"
            style={{
              ...iconBtn,
              color: playBlink ? '#22c55e' : 'var(--fg-2)',
              transition: 'color 0.15s',
              animation: playBlink ? 'cc-blink-green 0.4s ease-in-out 3' : 'none',
            }}
          >
            <IPlay style={{ width: 15, height: 15 }} />
          </button>

          <button
            onClick={() => window.dispatchEvent(new CustomEvent('cc:open-kanban'))}
            title="Kanban Board"
            style={iconBtn}
          >
            <IKanban style={{ width: 15, height: 15 }} />
          </button>

          <button onClick={() => setLayoutEditorOpen(true)} title="Layout-Editor" style={iconBtn}>
            <IAppLayout style={{ width: 15, height: 15 }} />
          </button>

          <button onClick={() => setModelBrowserOpen(true)} title="Modell-Browser" style={iconBtn}>
            <IBot style={{ width: 15, height: 15 }} />
          </button>
        </div>
      )}

      {modelBrowserOpen && <ModelBrowserModal onClose={() => setModelBrowserOpen(false)} />}
      {layoutEditorOpen && <LayoutEditorModal onClose={() => setLayoutEditorOpen(false)} />}
    </div>
  )
}
