import { useEffect } from 'react'
import { useAppStore } from './store/useAppStore'
import { LoginScreen } from './components/screens/LoginScreen'
import { Workspace } from './components/workspace/Workspace'
import { AliasSettings } from './components/screens/AliasSettings'
import { PromptTemplates } from './components/screens/PromptTemplates'
import { HistoryBrowser } from './components/screens/HistoryBrowser'
import { NewProjectModal } from './components/modals/NewProjectModal'
import { NewSessionModal } from './components/modals/NewSessionModal'

export default function App() {
  const { screen, theme, accent, newProjectOpen, newSessionOpen } = useAppStore()

  // Apply theme class + accent CSS var to root
  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('theme-light', theme === 'light')
    root.style.setProperty('--accent', accent)
    const m = accent.match(/#(..)(..)(..)/)
    if (m) {
      const [r, g, b] = [m[1], m[2], m[3]].map(h => parseInt(h, 16))
      root.style.setProperty('--accent-soft', `rgba(${r},${g},${b},0.14)`)
      root.style.setProperty('--accent-line', `rgba(${r},${g},${b},0.45)`)
    }
  }, [theme, accent])

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-0)' }}>
      {screen === 'login' && <LoginScreen />}
      {screen === 'workspace' && <Workspace />}
      {screen === 'settings' && <AliasSettings />}
      {screen === 'templates' && <PromptTemplates />}
      {screen === 'history' && <HistoryBrowser />}

      {newProjectOpen && <NewProjectModal />}
      {newSessionOpen && <NewSessionModal />}
    </div>
  )
}
