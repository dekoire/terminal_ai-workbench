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
import { GettingStartedModal } from './components/modals/GettingStartedModal'
import { DESIGN_PRESETS, applyPreset } from './theme/presets'
import { useSupabaseSync } from './lib/useSupabaseSync'
import { ISpinner } from './components/primitives/Icons'
import { ToastContainer } from './components/primitives/ToastContainer'

export default function App() {
  const { screen: rawScreen, theme, accent, accentFg, preset, uiFont, uiFontSize, uiFontWeight, newProjectOpen, newSessionOpen, customUiColors, projects, activeProjectId, setupWizardDone, currentUser, dataLoaded, setScreen, addToast } = useAppStore()
  // Guarantee screen is always a valid value — null/undefined causes a total black screen
  const screen = rawScreen || (currentUser ? 'workspace' : 'login')

  useEffect(() => {
    if (!rawScreen) setScreen(currentUser ? 'workspace' : 'login')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [kanbanOpen, setKanbanOpen] = useState(false)
  const [showGettingStarted, setShowGettingStarted] = useState(false)

  useEffect(() => {
    const handler = () => setKanbanOpen(true)
    window.addEventListener('cc:open-kanban', handler)
    return () => window.removeEventListener('cc:open-kanban', handler)
  }, [])

  // Show wizard when not done; hide it as soon as setupWizardDone flips to true
  // (e.g. after Zustand persist rehydrates from localStorage on initial load)
  useEffect(() => {
    setShowGettingStarted(!setupWizardDone)
  }, [setupWizardDone])

  useEffect(() => {
    const handler = () => setShowGettingStarted(true)
    window.addEventListener('cc:open-getting-started', handler)
    return () => window.removeEventListener('cc:open-getting-started', handler)
  }, [])

  // cc:permission-pending → warning toast with Allow/Skip action buttons
  useEffect(() => {
    const handler = (e: Event) => {
      const { sessionId, message } = (e as CustomEvent).detail as { sessionId: string; message?: string }
      addToast({
        type: 'warning',
        title: 'Erlaubnis erforderlich',
        body: message ?? 'Claude möchte eine Aktion ausführen.',
        duration: 0,
        actions: [
          { label: 'Erlauben', variant: 'primary', onClick: () => window.dispatchEvent(new CustomEvent('cc:permission-decision', { detail: { sessionId, decision: 'allow' } })) },
          { label: 'Ablehnen', variant: 'ghost', onClick: () => window.dispatchEvent(new CustomEvent('cc:permission-decision', { detail: { sessionId, decision: 'deny' } })) },
        ],
      })
    }
    window.addEventListener('cc:permission-pending', handler)
    return () => window.removeEventListener('cc:permission-pending', handler)
  }, [addToast])

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
  const overlayScreen   = screen !== 'workspace' && screen !== 'login' && screen !== 'register' && screen !== 'workshop' && screen !== 'getting-started'

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-0)', position: 'relative' }}>
      {screen === 'login'    && <LoginScreen />}
      {screen === 'register' && <RegisterScreen />}

      {/* Keep Workspace alive at all times (except login/register) so terminals never restart */}
      {screen !== 'login' && screen !== 'register' && (
        <div style={{ position: 'absolute', inset: 0, display: workspaceActive ? 'flex' : 'none', flexDirection: 'column' }}>
          {currentUser && !dataLoaded ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-0)' }}>
              <ISpinner size={24} style={{ color: 'var(--fg-3)' }} />
            </div>
          ) : (
            <Workspace />
          )}
        </div>
      )}

      {/* Overlay screens rendered on top of the hidden workspace */}
      {overlayScreen && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 10, background: 'var(--bg-0)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {screen === 'settings'  && <AliasSettings />}
          {screen === 'templates' && <PromptTemplates />}
          {screen === 'history'   && <HistoryBrowser />}
          {screen === 'profile'   && <ProfileSettings />}
          {screen === 'getting-started' && <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-2)', fontSize: 14 }}>Getting Started — coming soon</div>}
        </div>
      )}

      {/* Workshop — fixed overlay modal, workspace stays alive behind it */}
      {screen === 'workshop' && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9000,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <UIWorkshop />
        </div>
      )}

      {newProjectOpen && <NewProjectModal />}
      {newSessionOpen && <NewSessionModal />}
      {showGettingStarted && <GettingStartedModal onClose={() => setShowGettingStarted(false)} />}

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

      <ToastContainer />
    </div>
  )
}
