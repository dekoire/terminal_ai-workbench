import React, { useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import type { Project, Session } from '../../store/useAppStore'
import { IChev, IFolder, IFolderOpen, IBranch, ITerminal, IPlus, ISpark, IHistory, ISettings, IClose, ITrash } from '../primitives/Icons'
import { Pill } from '../primitives/Pill'
import { Kbd } from '../primitives/Kbd'

export function ProjectSidebar() {
  const { projects, templates, activeProjectId, activeSessionId, setActiveProject, setActiveSession, setScreen, setNewProjectOpen, setNewSessionOpen, removeProject, removeSession, inputValue, setInputValue } = useAppStore()

  return (
    <aside style={{
      width: 248, flexShrink: 0, background: 'var(--bg-1)',
      borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column',
    }}>
      {/* Workspace switcher */}
      <div style={{
        padding: '10px 12px', borderBottom: '1px solid var(--line)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{
          width: 22, height: 22, borderRadius: 5, background: 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1a1410', flexShrink: 0,
        }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d="M2 2h3v3H2zM7 2h3v3H7zM2 7h3v3H2zM7 7h3v3H7z"/>
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)' }}>Personal</div>
          <div style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>{projects.length} projects</div>
        </div>
        <IChev style={{ color: 'var(--fg-2)', transform: 'rotate(90deg)' }} />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
        {/* Projects */}
        <SidebarSection label="Projects" action={
          <button onClick={() => setNewProjectOpen(true)} style={iconBtn}>
            <IPlus />
          </button>
        }>
          {projects.map((p) => (
            <ProjectRow
              key={p.id}
              project={p}
              active={p.id === activeProjectId}
              activeSessionId={activeSessionId}
              onSelectProject={setActiveProject}
              onSelectSession={(sid) => { setActiveProject(p.id); setActiveSession(sid) }}
              onNewSession={() => { setActiveProject(p.id); setNewSessionOpen(true) }}
              onDeleteProject={() => removeProject(p.id)}
              onCloseSession={(sid) => removeSession(p.id, sid)}
            />
          ))}
        </SidebarSection>

        {/* Prompt templates */}
        <TemplatesSection
          templates={templates}
          onAdd={() => setScreen('templates')}
          onPick={(body) => setInputValue(inputValue ? inputValue + '\n' + body : body)}
        />

        {/* Recent sessions */}
        <CollapsibleSection label="Recent sessions" defaultOpen={false} action={
          <button onClick={() => setScreen('history')} style={iconBtn}>
            <IHistory />
          </button>
        }>
          {[
            { title: 'reduce p99 latency on /charges', when: '2h', alias: 'claude-code' },
            { title: 'port redux store to zustand', when: 'yest', alias: 'minimax' },
            { title: 'audit dependencies', when: '3d', alias: 'aider' },
          ].map((r, i) => (
            <div key={i} style={{ padding: '5px 10px 5px 14px', margin: '0 6px', borderRadius: 5, cursor: 'pointer' }}>
              <div style={{ fontSize: 11.5, color: 'var(--fg-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
              <div style={{ fontSize: 10, color: 'var(--fg-3)', display: 'flex', gap: 6, marginTop: 1 }}>
                <span className="mono">{r.alias}</span>·<span>{r.when} ago</span>
              </div>
            </div>
          ))}
        </CollapsibleSection>
      </div>

      <div style={{
        borderTop: '1px solid var(--line)', padding: '8px 12px',
        display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--fg-2)',
        cursor: 'pointer',
      }} onClick={() => setScreen('settings')}>
        <ISettings />
        <span style={{ flex: 1 }}>Aliases · Settings</span>
        <Kbd>⌘,</Kbd>
      </div>
    </aside>
  )
}

function ProjectRow({ project, active, activeSessionId, onSelectProject, onSelectSession, onNewSession, onDeleteProject, onCloseSession }: {
  project: Project; active: boolean; activeSessionId: string
  onSelectProject: (id: string) => void
  onSelectSession: (id: string) => void
  onNewSession: () => void
  onDeleteProject: () => void
  onCloseSession: (id: string) => void
}) {
  const [open, setOpen] = useState(active)
  const [hovered, setHovered] = useState(false)

  return (
    <div>
      <div
        onClick={() => { setOpen(o => !o); onSelectProject(project.id) }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px 5px 10px',
          margin: '0 6px', borderRadius: 5, cursor: 'pointer',
          background: active ? 'var(--bg-3)' : 'transparent',
          color: active ? 'var(--fg-0)' : 'var(--fg-1)',
        }}
      >
        <IChev style={{ transform: open ? 'rotate(90deg)' : 'none', color: 'var(--fg-3)', flexShrink: 0 }} />
        {open
          ? <IFolderOpen style={{ color: active ? 'var(--accent)' : 'var(--fg-2)', flexShrink: 0 }} />
          : <IFolder style={{ color: 'var(--fg-2)', flexShrink: 0 }} />}
        <span style={{ flex: 1, fontSize: 12, fontWeight: active ? 500 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {project.name}
        </span>
        {project.dirty != null && (
          <span className="mono" style={{ fontSize: 9.5, color: 'var(--warn)', background: 'rgba(244,195,101,0.10)', padding: '1px 5px', borderRadius: 3 }}>
            {project.dirty}
          </span>
        )}
        {hovered && (
          <ITrash
            style={{ color: 'var(--fg-3)', flexShrink: 0, opacity: 0.7 }}
            onClick={(e: React.MouseEvent) => { e.stopPropagation(); onDeleteProject() }}
          />
        )}
      </div>

      {open && (
        <div style={{ paddingLeft: 24, marginTop: 2, marginBottom: 4 }}>
          <div style={{ fontSize: 10, color: 'var(--fg-3)', display: 'flex', alignItems: 'center', gap: 5, padding: '2px 14px 6px 6px' }}>
            <IBranch /><span className="mono">{project.branch}</span>
          </div>
          {project.sessions.map((s) => (
            <SessionRow key={s.id} session={s} active={s.id === activeSessionId} onSelect={() => onSelectSession(s.id)} onClose={() => onCloseSession(s.id)} />
          ))}
          <div
            onClick={onNewSession}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '4px 14px 4px 6px',
              margin: '0 6px', borderRadius: 5, color: 'var(--fg-3)', fontSize: 11.5, cursor: 'pointer',
            }}
          >
            <IPlus /><span>New session</span>
          </div>
        </div>
      )}
    </div>
  )
}

function SessionRow({ session, active, onSelect, onClose }: { session: Session; active: boolean; onSelect: () => void; onClose: () => void }) {
  const [hovered, setHovered] = useState(false)
  const dotColor = session.status === 'active' ? 'var(--accent)' : session.status === 'error' ? 'var(--err)' : 'var(--fg-3)'
  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 7, padding: '4px 8px 4px 6px',
        margin: '0 6px', borderRadius: 5, cursor: 'pointer',
        background: active ? 'var(--accent-soft)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--fg-1)',
        borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
      }}
    >
      <ITerminal style={{ color: active ? 'var(--accent)' : 'var(--fg-3)', flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 11.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {session.name}
      </span>
      <span className="mono" style={{ fontSize: 9, color: 'var(--fg-3)' }}>{session.alias}</span>
      {hovered
        ? <IClose style={{ width: 9, height: 9, color: 'var(--fg-3)', flexShrink: 0, opacity: 0.8 }} onClick={(e: React.MouseEvent) => { e.stopPropagation(); onClose() }} />
        : <span style={{ width: 5, height: 5, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
      }
    </div>
  )
}

const TEMPLATES_COLLAPSED = 6

function TemplatesSection({
  templates, onAdd, onPick,
}: {
  templates: { id: string; name: string; hint?: string; body: string }[]
  onAdd: () => void
  onPick: (body: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [sectionOpen, setSectionOpen] = useState(true)
  const visible = expanded ? templates : templates.slice(0, TEMPLATES_COLLAPSED)
  const hidden  = templates.length - TEMPLATES_COLLAPSED

  return (
    <div style={{ marginBottom: 14 }}>
      {/* Header — click label to collapse section */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 14px 6px', textTransform: 'uppercase', fontSize: 10,
        letterSpacing: 0.7, color: 'var(--fg-3)', fontWeight: 500, cursor: 'pointer',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }} onClick={() => setSectionOpen(o => !o)}>
          <IChev style={{ transform: sectionOpen ? 'rotate(90deg)' : 'none', width: 8, height: 8, transition: 'transform 0.1s' }} />
          Prompt templates
          <span style={{ fontWeight: 400, opacity: 0.7 }}>({templates.length})</span>
        </span>
        <button onClick={onAdd} style={iconBtn}><IPlus /></button>
      </div>

      {sectionOpen && (
        <>
          {visible.map((t) => (
            <div
              key={t.id}
              onClick={() => onPick(t.body)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px',
                margin: '0 6px 1px', borderRadius: 5, cursor: 'pointer', color: 'var(--fg-1)', fontSize: 11.5,
              }}
            >
              <ISpark style={{ color: 'var(--accent)', flexShrink: 0 }} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
              {t.hint && <Kbd>{t.hint}</Kbd>}
            </div>
          ))}

          {/* Show more / less toggle */}
          {templates.length > TEMPLATES_COLLAPSED && (
            <div
              onClick={() => setExpanded(e => !e)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px',
                margin: '2px 6px 0', borderRadius: 5, cursor: 'pointer',
                color: 'var(--fg-3)', fontSize: 10.5,
              }}
            >
              <IChev style={{ transform: expanded ? 'rotate(90deg)' : 'none', width: 8, height: 8 }} />
              {expanded ? 'Show less' : `${hidden} more template${hidden !== 1 ? 's' : ''}`}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function SidebarSection({ label, action, children }: { label: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 14px 6px', textTransform: 'uppercase', fontSize: 10,
        letterSpacing: 0.7, color: 'var(--fg-3)', fontWeight: 500,
      }}>
        <span>{label}</span>
        {action && <span style={{ display: 'flex', alignItems: 'center', color: 'var(--fg-2)' }}>{action}</span>}
      </div>
      {children}
    </div>
  )
}

function CollapsibleSection({ label, action, children, defaultOpen = true }: { label: string; action?: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 14px 6px', textTransform: 'uppercase', fontSize: 10,
        letterSpacing: 0.7, color: 'var(--fg-3)', fontWeight: 500,
      }}>
        <span
          onClick={() => setOpen(o => !o)}
          style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}
        >
          <IChev style={{ transform: open ? 'rotate(90deg)' : 'none', width: 8, height: 8, transition: 'transform 0.1s' }} />
          {label}
        </span>
        {action && <span style={{ display: 'flex', alignItems: 'center', color: 'var(--fg-2)' }}>{action}</span>}
      </div>
      {open && children}
    </div>
  )
}

const iconBtn: React.CSSProperties = {
  background: 'transparent', border: 'none', color: 'var(--fg-2)',
  display: 'flex', alignItems: 'center', padding: 0, cursor: 'pointer',
}
