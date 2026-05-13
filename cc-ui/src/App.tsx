import { useEffect, useState } from 'react'
import { useAppStore } from './store/useAppStore'
import { LoginScreen } from './components/screens/LoginScreen'
import { RegisterScreen } from './components/screens/RegisterScreen'
import { Workspace } from './components/workspace/Workspace'
import { AliasSettings } from './components/screens/AliasSettings'
import { PromptTemplates } from './components/screens/PromptTemplates'
import { HistoryBrowser } from './components/screens/HistoryBrowser'
import { ProfileSettings } from './components/screens/ProfileSettings'
import { UIWorkshop } from './components/workshop/UIWorkshop'
import { KanbanBoard } from './components/workspace/KanbanBoard'
import { NewProjectModal } from './components/modals/NewProjectModal'
import { NewSessionModal } from './components/modals/NewSessionModal'
import { DESIGN_PRESETS, applyPreset } from './theme/presets'
import { useSupabaseSync } from './lib/useSupabaseSync'

export default function App() {
  const { screen, theme, accent, accentFg, preset, uiFont, uiFontSize, uiFontWeight, newProjectOpen, newSessionOpen, customUiColors, projects, activeProjectId } = useAppStore()
  const [kanbanOpen, setKanbanOpen] = useState(false)

  useEffect(() => {
    const handler = () => setKanbanOpen(true)
    window.addEventListener('cc:open-kanban', handler)
    return () => window.removeEventListener('cc:open-kanban', handler)
  }, [])

  // Cloud sync — loads on login, saves debounced on every store change
  useSupabaseSync()

  // Apply preset + accent overrides whenever they change
  useEffect(() => {
    const p = DESIGN_PRESETS.find(d => d.id === preset) ?? DESIGN_PRESETS[0]
    applyPreset(p, accent, accentFg)
    // Re-apply custom overrides on top
    Object.entries(customUiColors).forEach(([k, v]) => document.documentElement.style.setProperty(k, v))
  }, [theme, accent, accentFg, preset, customUiColors])

  // Apply UI font + size
  useEffect(() => {
    const FONT_MAP: Record<string, string> = {
      system:    '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      inter:     '"Inter", "Segoe UI", sans-serif',
      geist:     '"Geist", "Inter", sans-serif',
      sf:        '"SF Pro Text", -apple-system, sans-serif',
      jetbrains: '"JetBrains Mono", monospace',
    }
    const family = FONT_MAP[uiFont] ?? FONT_MAP.system
    document.documentElement.style.setProperty('--font-ui', family)
    document.documentElement.style.setProperty('--ui-font-weight', String(uiFontWeight ?? 400))
    // zoom scales all px-based inline styles proportionally
    const root = document.getElementById('root')
    if (root) (root.style as CSSStyleDeclaration & { zoom: string }).zoom = String(uiFontSize / 13)
  }, [uiFont, uiFontSize, uiFontWeight])

  // Workspace stays mounted permanently so PTY WebSocket connections survive
  // screen switches. Workshop is an overlay modal — workspace stays visible underneath.
  const workspaceActive = screen === 'workspace' || screen === 'workshop'
  const overlayScreen   = screen !== 'workspace' && screen !== 'login' && screen !== 'register' && screen !== 'workshop'

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-0)', position: 'relative' }}>
      {screen === 'login'    && <LoginScreen />}
      {screen === 'register' && <RegisterScreen />}

      {/* Keep Workspace alive at all times (except login/register) so terminals never restart */}
      {screen !== 'login' && screen !== 'register' && (
        <div style={{ position: 'absolute', inset: 0, display: workspaceActive ? 'flex' : 'none', flexDirection: 'column' }}>
          <Workspace />
        </div>
      )}

      {/* Overlay screens rendered on top of the hidden workspace */}
      {overlayScreen && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 10, background: 'var(--bg-0)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {screen === 'settings'  && <AliasSettings />}
          {screen === 'templates' && <PromptTemplates />}
          {screen === 'history'   && <HistoryBrowser />}
          {screen === 'profile'   && <ProfileSettings />}
        </div>
      )}

      {/* Workshop — fixed overlay modal, workspace stays alive behind it */}
      {screen === 'workshop' && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9000,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <UIWorkshop />
        </div>
      )}

      {newProjectOpen && <NewProjectModal />}
      {newSessionOpen && <NewSessionModal />}

      {/* Kanban Board — full-screen modal overlay */}
      {kanbanOpen && (() => {
        const project = projects.find(p => p.id === activeProjectId)
        if (!project) return null
        return (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 8000,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
            onClick={() => setKanbanOpen(false)}
          >
            <div style={{ width: '90vw', height: '88vh', borderRadius: 12, overflow: 'hidden', boxShadow: '0 16px 48px rgba(0,0,0,0.5)' }}
              onClick={e => e.stopPropagation()}
            >
              <KanbanBoard
                projectId={project.id}
                projectName={project.name}
                projectPath={project.path}
                onClose={() => setKanbanOpen(false)}
              />
            </div>
          </div>
        )
      })()}
    </div>
  )
}
