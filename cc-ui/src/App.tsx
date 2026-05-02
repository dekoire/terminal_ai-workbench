import { useEffect } from 'react'
import { useAppStore } from './store/useAppStore'
import { LoginScreen } from './components/screens/LoginScreen'
import { Workspace } from './components/workspace/Workspace'
import { AliasSettings } from './components/screens/AliasSettings'
import { PromptTemplates } from './components/screens/PromptTemplates'
import { HistoryBrowser } from './components/screens/HistoryBrowser'
import { NewProjectModal } from './components/modals/NewProjectModal'
import { NewSessionModal } from './components/modals/NewSessionModal'
import { DESIGN_PRESETS, applyPreset } from './theme/presets'

export default function App() {
  const { screen, theme, accent, accentFg, preset, uiFont, uiFontSize, newProjectOpen, newSessionOpen, customUiColors } = useAppStore()

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
    document.documentElement.style.setProperty('--ui-font-size', `${uiFontSize}px`)
    document.documentElement.style.fontSize = `${uiFontSize}px`
  }, [uiFont, uiFontSize])

  // Workspace stays mounted permanently so PTY WebSocket connections survive
  // screen switches. Non-workspace screens render on top via absolute overlay.
  const workspaceActive = screen === 'workspace'
  const overlayScreen   = screen !== 'workspace' && screen !== 'login'

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-0)', position: 'relative' }}>
      {screen === 'login' && <LoginScreen />}

      {/* Keep Workspace alive at all times (except login) so terminals never restart */}
      {screen !== 'login' && (
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
        </div>
      )}

      {newProjectOpen && <NewProjectModal />}
      {newSessionOpen && <NewSessionModal />}
    </div>
  )
}
