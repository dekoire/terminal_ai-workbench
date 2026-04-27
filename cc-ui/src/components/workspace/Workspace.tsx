import { useAppStore } from '../../store/useAppStore'
import { ProjectSidebar } from './ProjectSidebar'
import { CenterPane } from './CenterPane'
import { UtilityPanel } from './UtilityPanel'
import { Pill } from '../primitives/Pill'
import { ISettings, IMoon, ISun } from '../primitives/Icons'

export function Workspace() {
  const { theme, setTheme, setScreen, projects } = useAppStore()
  const totalSessions = projects.reduce((n, p) => n + p.sessions.length, 0)

  return (
    <div className={theme === 'light' ? 'theme-light' : ''} style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-0)' }}>
      {/* Window chrome */}
      <div style={{ height: 36, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px', background: 'var(--bg-1)', borderBottom: '1px solid var(--line)', userSelect: 'none' }}>
        <div style={{ display: 'flex', gap: 7 }}>
          <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#ff5f57', cursor: 'pointer' }} title="Close" />
          <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#ffbd2e', cursor: 'pointer' }} title="Minimize" />
          <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#28c941', cursor: 'pointer' }} title="Fullscreen" />
        </div>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 11, color: 'var(--fg-2)', letterSpacing: 0.2 }}>
          claude code ui — feat/payment-retries
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <Pill tone="neutral" dot>{totalSessions} sessions</Pill>
          <span style={{ width: 1, height: 16, background: 'var(--line-strong)', margin: '0 4px' }} />
          {theme === 'dark'
            ? <IMoon style={{ color: 'var(--fg-2)', cursor: 'pointer' }} onClick={() => setTheme('light')} title="Switch to light mode" />
            : <ISun  style={{ color: 'var(--fg-2)', cursor: 'pointer' }} onClick={() => setTheme('dark')}  title="Switch to dark mode"  />
          }
          <ISettings style={{ color: 'var(--fg-2)', cursor: 'pointer' }} onClick={() => setScreen('settings')} />
        </div>
      </div>

      {/* 3-pane body */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <ProjectSidebar />
        <CenterPane />
        <UtilityPanel />
      </div>
    </div>
  )
}
