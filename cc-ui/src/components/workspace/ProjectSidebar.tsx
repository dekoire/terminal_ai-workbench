import React, { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '../../store/useAppStore'
import type { Project, Session } from '../../store/useAppStore'
import { IChev, IFolder, IFolderOpen, IBranch, ITerminal, IPlus, ISpark, IHistory, ISettings, IClose, ITrash, ICopy, IEdit, IGit, IKanban, ISpinner, IMoon, ISun } from '../primitives/Icons'
import { KanbanBoard, GlobalKanbanBoard } from './KanbanBoard'
import { Kbd } from '../primitives/Kbd'
import { updateDocsWithAI } from '../../utils/updateDocs'
import { DESIGN_PRESETS, applyPreset } from '../../theme/presets'

// ── ContextMenu ───────────────────────────────────────────────────────────────
type CtxItem = { label: string; icon?: React.ReactNode; danger?: boolean; action: () => void } | null

function ContextMenu({ items, pos, onClose }: { items: CtxItem[]; pos: { x: number; y: number }; onClose: () => void }) {
  useEffect(() => {
    const h = () => onClose()
    window.addEventListener('click', h)
    window.addEventListener('contextmenu', h)
    return () => { window.removeEventListener('click', h); window.removeEventListener('contextmenu', h) }
  }, [onClose])

  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 9999, background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 7, padding: 4, minWidth: 172, boxShadow: '0 8px 28px rgba(0,0,0,0.35)' }}
    >
      {items.map((item, i) =>
        item === null
          ? <div key={i} style={{ height: 1, background: 'var(--line)', margin: '3px 0' }} />
          : (
            <div
              key={i}
              onClick={() => { item.action(); onClose() }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', fontSize: 11.5, borderRadius: 4, cursor: 'pointer', color: item.danger ? 'var(--err)' : 'var(--fg-0)' }}
            >
              {item.icon && <span style={{ color: item.danger ? 'var(--err)' : 'var(--fg-3)', display: 'flex' }}>{item.icon}</span>}
              {item.label}
            </div>
          )
      )}
    </div>
  )
}

function useCtxMenu() {
  const [ctx, setCtx] = useState<{ pos: { x: number; y: number }; items: CtxItem[] } | null>(null)
  const open = useCallback((e: React.MouseEvent, items: CtxItem[]) => {
    e.preventDefault(); e.stopPropagation()
    setCtx({ pos: { x: e.clientX, y: e.clientY }, items })
  }, [])
  const close = useCallback(() => setCtx(null), [])
  const menu = ctx ? <ContextMenu items={ctx.items} pos={ctx.pos} onClose={close} /> : null
  return { open, menu }
}

function ThemeToggleBtn() {
  const { theme, setTheme, preset, setPreset, setAccent, setAccentFg, terminalTheme, setTerminalTheme } = useAppStore()
  const toggle = () => {
    const cur = DESIGN_PRESETS.find(d => d.id === preset) ?? DESIGN_PRESETS[0]
    const nextId = cur.dark ? 'light-' + cur.id : cur.id.replace(/^light-/, '')
    const next = DESIGN_PRESETS.find(d => d.id === nextId) ?? cur
    setPreset(next.id); setTheme(next.dark ? 'dark' : 'light')
    setAccent(next.accent); setAccentFg(next.accentFg); applyPreset(next)
    if (next.dark && terminalTheme === 'github-light') setTerminalTheme('default')
    if (!next.dark && terminalTheme === 'default') setTerminalTheme('github-light')
  }
  return (
    <button onClick={toggle} title={theme === 'dark' ? 'Zu hell wechseln' : 'Zu dunkel wechseln'} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-3)', display: 'flex', alignItems: 'center', padding: '2px 3px', borderRadius: 4 }}>
      {theme === 'dark' ? <IMoon style={{ width: 13, height: 13 }} /> : <ISun style={{ width: 13, height: 13 }} />}
    </button>
  )
}

function SidebarLogoutBtn() {
  const { setScreen } = useAppStore()
  return (
    <button onClick={() => setScreen('login')} title="Zurück zum Login" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-3)', display: 'flex', alignItems: 'center', padding: '2px 3px', borderRadius: 4 }}>
      <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 2H3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h2"/>
        <path d="M10 10l3-3-3-3"/>
        <path d="M13 7H6"/>
      </svg>
    </button>
  )
}

export function ProjectSidebar() {
  const { projects, templates, activeProjectId, activeSessionId, setActiveProject, setActiveSession, setScreen, setNewProjectOpen, setNewSessionOpen, removeProject, removeSession, inputValue, setInputValue } = useAppStore()

  return (
    <aside style={{
      width: '100%', flexShrink: 0, background: 'var(--bg-1)',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 0 12px' }}>
        {/* Projects */}
        <CollapsibleSection label="Projects" count={projects.length} defaultOpen action={
          <button onClick={() => setNewProjectOpen(true)} style={iconBtn}><IPlus /></button>
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
        </CollapsibleSection>

        {/* Prompt templates */}
        <TemplatesSection
          templates={templates}
          onAdd={() => setScreen('templates')}
          onPick={(body) => setInputValue(inputValue ? inputValue + '\n' + body : body)}
        />

        {/* User Stories */}
        <UserStoriesSection />
      </div>

      <div style={{
        padding: '8px 12px 16px',
        display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: 'var(--fg-2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', flex: 1 }} onClick={() => setScreen('settings')}>
          <ISettings style={{ flexShrink: 0 }} />
          <span>Settings</span>
        </div>
        <ThemeToggleBtn />
        <SidebarLogoutBtn />
      </div>
    </aside>
  )
}

function useHasGit(path: string): boolean {
  const [hasGit, setHasGit] = useState(false)
  useEffect(() => {
    if (!path) return
    fetch(`/api/git?path=${encodeURIComponent(path)}`)
      .then(r => r.json())
      .then((d: { hasGit?: boolean }) => setHasGit(!!d.hasGit))
      .catch(() => setHasGit(false))
  }, [path])
  return hasGit
}

function useGitRemote(path: string): string | null {
  const [remoteUrl, setRemoteUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!path) return
    fetch(`/api/git-remote?path=${encodeURIComponent(path)}`)
      .then(r => r.json())
      .then((d: { ok: boolean; url: string | null }) => setRemoteUrl(d.ok ? d.url : null))
      .catch(() => setRemoteUrl(null))
  }, [path])
  return remoteUrl
}

function toRepoUrl(remoteUrl: string): string | null {
  const patterns: [RegExp, string][] = [
    [/git@github\.com:(.+?)(?:\.git)?$/, 'https://github.com/'],
    [/https?:\/\/github\.com\/(.+?)(?:\.git)?$/, 'https://github.com/'],
    [/git@gitlab\.com:(.+?)(?:\.git)?$/, 'https://gitlab.com/'],
    [/https?:\/\/gitlab\.com\/(.+?)(?:\.git)?$/, 'https://gitlab.com/'],
    [/git@bitbucket\.org:(.+?)(?:\.git)?$/, 'https://bitbucket.org/'],
    [/https?:\/\/bitbucket\.org\/(.+?)(?:\.git)?$/, 'https://bitbucket.org/'],
  ]
  for (const [re, base] of patterns) {
    const m = remoteUrl.match(re)
    if (m) return base + m[1]
  }
  return null
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
  const [kanbanOpen, setKanbanOpen] = useState(false)
  const [docUpdating, setDocUpdating] = useState(false)
  const isDocApplying = useAppStore(s => s.docApplying[project.id] ?? false)
  const hasGit = useHasGit(project.path)
  const remoteUrl = useGitRemote(project.path)

  const handleDocUpdate = async () => {
    setDocUpdating(true)
    try { await updateDocsWithAI(project.path) } finally { setDocUpdating(false) }
  }
  const githubUrl = remoteUrl ? toRepoUrl(remoteUrl) : null
  const { open: openCtx, menu: ctxMenu } = useCtxMenu()

  const copyPath = () => navigator.clipboard.writeText(project.path)
  const copyName = () => navigator.clipboard.writeText(project.name)
  const openFolder = () => fetch(`/api/open?path=${encodeURIComponent(project.path)}`)

  const handleContextMenu = (e: React.MouseEvent) => openCtx(e, [
    { label: 'Pfad kopieren', icon: <ICopy />, action: copyPath },
    { label: 'Name kopieren', icon: <ICopy />, action: copyName },
    null,
    { label: 'In Finder öffnen', icon: <IFolder />, action: openFolder },
    ...(hasGit && githubUrl ? [
      null as null,
      { label: 'Zum Git-Repository ↗', icon: <IGit />, action: () => window.open(githubUrl, '_blank') },
    ] : []),
    null,
    { label: docUpdating ? 'Docu wird aktualisiert…' : 'Docu aktualisieren', icon: <IEdit />, action: () => { if (!docUpdating) handleDocUpdate() } },
    null,
    { label: 'Projekt löschen', icon: <ITrash />, danger: true, action: onDeleteProject },
  ])

  return (
    <div>
      {ctxMenu}
      {kanbanOpen && (
        <KanbanBoard
          projectId={project.id}
          projectName={project.name}
          projectPath={project.path}
          onClose={() => setKanbanOpen(false)}
        />
      )}
      <div
        onClick={() => { setOpen(o => !o); onSelectProject(project.id) }}
        onContextMenu={handleContextMenu}
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
        {isDocApplying && (
          <ISpinner className="anim-spin" style={{ color: 'var(--accent)', flexShrink: 0, width: 11, height: 11 }} title="Docu wird angelegt…" />
        )}
        <>
          {hasGit && (
            <IGit
              style={{
                color: githubUrl ? 'var(--accent)' : 'var(--fg-3)',
                flexShrink: 0, width: 12, height: 12, cursor: 'pointer',
                opacity: hovered ? 1 : 0.7,
                transition: 'opacity 0.12s',
              }}
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation()
                if (githubUrl) window.open(githubUrl, '_blank')
                else window.dispatchEvent(new CustomEvent('cc:goto-git-tab'))
              }}
              title={githubUrl ? `Zum Repository ↗ ${githubUrl}` : 'Git-Details'}
            />
          )}
          {!hasGit && (
            <IFolder
              style={{ color: 'var(--fg-3)', flexShrink: 0, width: 10, height: 10, cursor: 'pointer' }}
              onClick={(e: React.MouseEvent) => { e.stopPropagation(); openFolder() }}
            />
          )}
          <IKanban
            style={{ color: 'var(--fg-3)', flexShrink: 0, width: 11, height: 11, cursor: 'pointer' }}
            onClick={(e: React.MouseEvent) => { e.stopPropagation(); setKanbanOpen(true) }}
            title="Kanban Board"
          />
          {project.dirty != null && hasGit && (
            <span className="mono" style={{ fontSize: 9.5, color: 'var(--warn)', background: 'rgba(244,195,101,0.10)', padding: '1px 5px', borderRadius: 3 }}>
              {project.dirty}
            </span>
          )}
        </>
      </div>

      {open && (
        <div style={{ paddingLeft: 24, marginTop: 2, marginBottom: 4 }}>
          {project.sessions.map((s) => (
            <SessionRow key={s.id} session={s} active={s.id === activeSessionId} project={project} onSelect={() => onSelectSession(s.id)} onClose={() => onCloseSession(s.id)} />
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

function SessionRow({ session, active, project, onSelect, onClose }: { session: Session; active: boolean; project: Project; onSelect: () => void; onClose: () => void }) {
  const { aliases, updateSession } = useAppStore()
  const [hovered, setHovered] = useState(false)
  const { open: openCtx, menu: ctxMenu } = useCtxMenu()

  const alias = aliases.find(a => a.name === session.alias)
  const isDangerous = session.permMode === 'dangerous' || alias?.args?.includes('--dangerously-skip-permissions') || alias?.permMode === 'dangerous'

  const handleContextMenu = (e: React.MouseEvent) => openCtx(e, [
    { label: 'Umbenennen', icon: <IEdit />, action: () => {
      const name = window.prompt('Neuer Name:', session.name)
      if (name?.trim()) updateSession(session.id, { name: name.trim() })
    }},
    null,
    { label: 'Session schließen', icon: <IClose />, danger: true, action: onClose },
  ])

  const dotColor = isDangerous ? 'var(--err)' : session.status === 'active' ? 'var(--ok)' : session.status === 'error' ? 'var(--err)' : 'var(--fg-3)'
  const isExited = session.status === 'exited'
  const borderColor = isDangerous ? 'var(--err)' : active ? 'var(--accent)' : 'transparent'
  const bgColor = isDangerous && active ? 'rgba(239,122,122,0.1)' : active ? 'var(--accent-soft)' : 'transparent'
  const textColor = isDangerous ? (active ? 'var(--err)' : 'var(--fg-1)') : active ? 'var(--accent)' : 'var(--fg-1)'

  return (
    <div>
      {ctxMenu}
    <div
      onClick={onSelect}
      onContextMenu={handleContextMenu}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 7, padding: '4px 8px 4px 6px',
        margin: '0 6px', borderRadius: 0, cursor: 'pointer',
        background: bgColor,
        color: textColor,
        borderLeft: `2px solid ${borderColor}`,
      }}
    >
      <ITerminal style={{ color: isDangerous ? 'var(--err)' : active ? 'var(--accent)' : 'var(--fg-3)', flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 11.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {session.name}
      </span>
      {/* Badges */}
      {isDangerous && (
        <span title="--dangerously-skip-permissions" style={{ fontSize: 8.5, color: 'var(--err)', background: 'rgba(239,122,122,0.15)', border: '1px solid rgba(239,122,122,0.35)', borderRadius: 3, padding: '1px 4px', letterSpacing: 0.2, flexShrink: 0 }}>YOLO</span>
      )}
      {hovered
        ? <IClose style={{ width: 9, height: 9, color: 'var(--fg-3)', flexShrink: 0, opacity: 0.8 }} onClick={(e: React.MouseEvent) => { e.stopPropagation(); onClose() }} />
        : isExited
          ? <span style={{ width: 8, height: 2, borderRadius: 1, background: 'var(--fg-3)', flexShrink: 0, opacity: 0.5 }} />
          : <span style={{ width: 5, height: 5, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
      }
    </div>
    </div>
  )
}

const TEMPLATES_COLLAPSED = 6

function TemplatesSection({
  templates, onAdd, onPick,
}: {
  templates: { id: string; name: string; hint?: string; body: string; favorite?: boolean }[]
  onAdd: () => void
  onPick: (body: string) => void
}) {
  const { updateTemplate, removeTemplate } = useAppStore()
  const [expanded, setExpanded] = useState(false)
  const [sectionOpen, setSectionOpen] = useState(true)
  const { open: openCtx, menu: ctxMenu } = useCtxMenu()
  const visible = expanded ? templates : templates.slice(0, TEMPLATES_COLLAPSED)
  const hidden  = templates.length - TEMPLATES_COLLAPSED

  return (
    <div style={{ marginBottom: 14, paddingTop: 0, paddingBottom: 14 }}>
      {ctxMenu}
      {/* Header — click label to collapse section */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 10px 6px 14px', textTransform: 'uppercase', fontSize: 10,
        letterSpacing: 0.7, color: 'var(--fg-3)', fontWeight: 500, cursor: 'pointer',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, userSelect: 'none' }} onClick={() => setSectionOpen(o => !o)}>
          <IChev style={{ transform: sectionOpen ? 'rotate(90deg)' : 'none', width: 8, height: 8, transition: 'transform 0.1s', flexShrink: 0 }} />
          Prompt templates
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 16, height: 16, padding: '0 5px', borderRadius: 99, background: 'var(--bg-3)', border: '1px solid var(--line)', color: 'var(--fg-3)', fontSize: 9.5, fontWeight: 600, letterSpacing: 0, lineHeight: 1 }}>
            {templates.length}
          </span>
        </span>
        <button onClick={onAdd} style={iconBtn}><IPlus /></button>
      </div>

      {sectionOpen && (
        <>
          {visible.map((t) => (
            <div
              key={t.id}
              onClick={() => onPick(t.body)}
              onContextMenu={e => openCtx(e, [
                { label: t.favorite ? '★ Als Favorit entfernen' : '☆ Als Favorit markieren', icon: <ISpark />, action: () => updateTemplate(t.id, { favorite: !t.favorite }) },
                null,
                { label: 'Löschen', icon: <ITrash />, danger: true, action: () => removeTemplate(t.id) },
              ])}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px',
                margin: '0 6px 1px', borderRadius: 5, cursor: 'pointer', color: 'var(--fg-1)', fontSize: 11.5,
              }}
            >
              <ISpark style={{ color: t.favorite ? 'var(--warn)' : 'var(--accent)', flexShrink: 0 }} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
              {t.favorite && <span style={{ fontSize: 9, color: 'var(--warn)' }}>★</span>}
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

// ── User Stories Section ───────────────────────────────────────────────────────

const STORIES_COLLAPSED = 3

// Inline type icons (mirrors KanbanBoard TypeIcon)
function SidebarTypeIcon({ type }: { type?: string }) {
  const s: React.CSSProperties = { width: 10, height: 10, flexShrink: 0 }
  if (type === 'bug') return (
    <svg viewBox="0 0 12 12" fill="none" stroke="var(--err)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={s}>
      <path d="M6 9a3 3 0 0 1-3-3V5a3 3 0 0 1 6 0v1a3 3 0 0 1-3 3z"/>
      <path d="M3 5H1M9 5h2M3 7.5H1M9 7.5h2M4.5 3L3.5 2M7.5 3L8.5 2M6 9v2.5"/>
    </svg>
  )
  if (type === 'nfc') return (
    <svg viewBox="0 0 12 12" fill="none" stroke="#5b9cf6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={s}>
      <path d="M6 1l1.5 3h3L8 6.5l1 3.5L6 8.5 3 10l1-3.5L1.5 4h3z"/>
    </svg>
  )
  return (
    <svg viewBox="0 0 12 12" fill="none" stroke="var(--ok)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={s}>
      <circle cx="6" cy="3.5" r="2"/>
      <path d="M2 11c0-2.2 1.8-4 4-4s4 1.8 4 4"/>
    </svg>
  )
}

function UserStoriesSection() {
  const { kanban, projects } = useAppStore()
  const [globalOpen, setGlobalOpen]   = useState(false)
  const [sectionOpen, setSectionOpen] = useState(true)
  const [expanded, setExpanded]       = useState(false)
  // open a specific ticket directly in its project's KanbanBoard
  const [openTicket, setOpenTicket]   = useState<{
    projectId: string; projectName: string; projectPath: string; ticketId: string
  } | null>(null)

  // Flatten all tickets across projects, newest first
  const allTickets = projects.flatMap(p =>
    (kanban[p.id] ?? []).map(t => ({ ticket: t, project: p }))
  ).sort((a, b) => {
    const da = a.ticket.createdAt ? new Date(a.ticket.createdAt).getTime() : 0
    const db = b.ticket.createdAt ? new Date(b.ticket.createdAt).getTime() : 0
    return db - da
  })

  const totalCount = allTickets.length
  const visible = expanded ? allTickets : allTickets.slice(0, STORIES_COLLAPSED)
  const hidden = totalCount - STORIES_COLLAPSED

  return (
    <>
      {globalOpen && <GlobalKanbanBoard onClose={() => setGlobalOpen(false)} />}
      {openTicket && (
        <KanbanBoard
          projectId={openTicket.projectId}
          projectName={openTicket.projectName}
          projectPath={openTicket.projectPath}
          initialDetailId={openTicket.ticketId}
          onClose={() => setOpenTicket(null)}
        />
      )}

      <div style={{ marginBottom: 14, paddingTop: 0, paddingBottom: 14 }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 10px 6px 14px',
        }}>
          <span
            onClick={() => setSectionOpen(o => !o)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', userSelect: 'none' }}
          >
            <IChev style={{ transform: sectionOpen ? 'rotate(90deg)' : 'none', width: 8, height: 8, transition: 'transform 0.1s', flexShrink: 0, color: 'var(--fg-3)' }} />
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.7, color: 'var(--fg-3)' }}>
              User Stories
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 16, height: 16, padding: '0 5px', borderRadius: 99, background: 'var(--bg-3)', border: '1px solid var(--line)', color: 'var(--fg-3)', fontSize: 9.5, fontWeight: 600, letterSpacing: 0, lineHeight: 1 }}>
              {totalCount}
            </span>
          </span>
          <button
            onClick={e => { e.stopPropagation(); setGlobalOpen(true) }}
            style={iconBtn}
            title="Alle User Stories öffnen"
          >
            <IKanban style={{ width: 11, height: 11 }} />
          </button>
        </div>

        {/* Story rows */}
        {sectionOpen && (
          <>
            {visible.map(({ ticket, project }) => (
              <StoryRow
                key={ticket.id}
                ticket={ticket}
                projectName={project.name}
                onOpen={() => setOpenTicket({
                  projectId: project.id,
                  projectName: project.name,
                  projectPath: project.path,
                  ticketId: ticket.id,
                })}
              />
            ))}

            {totalCount === 0 && (
              <div style={{ padding: '3px 10px 3px 14px', fontSize: 11, color: 'var(--fg-3)', fontStyle: 'italic' }}>
                Keine User Stories
              </div>
            )}

            {/* Show more / less toggle */}
            {totalCount > STORIES_COLLAPSED && (
              <div
                onClick={() => setExpanded(e => !e)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '3px 10px',
                  margin: '1px 6px 0', borderRadius: 5, cursor: 'pointer',
                  color: 'var(--fg-3)', fontSize: 10.5,
                }}
              >
                <IChev style={{ transform: expanded ? 'rotate(90deg)' : 'none', width: 8, height: 8 }} />
                {expanded ? 'Weniger anzeigen' : `${hidden} weitere`}
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}

function StoryRow({ ticket, projectName, onOpen }: {
  ticket: { id: string; ticketNumber?: number; title: string; text?: string; createdAt?: string; type?: string }
  projectName: string
  onOpen: () => void
}) {
  const [hovered, setHovered] = useState(false)

  const dateStr = ticket.createdAt
    ? new Date(ticket.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
    : ''

  return (
    <div
      onClick={onOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '5px 10px',
        margin: '0 6px 1px', borderRadius: 5, cursor: 'pointer',
        background: hovered ? 'var(--bg-3)' : 'transparent',
        color: 'var(--fg-1)',
      }}
    >
      {/* Type icon */}
      <SidebarTypeIcon type={ticket.type} />

      {/* ID badge */}
      {ticket.ticketNumber != null && (
        <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--accent)', flexShrink: 0, letterSpacing: 0.2 }}>
          #{ticket.ticketNumber}
        </span>
      )}

      {/* Title */}
      <span style={{ flex: 1, fontSize: 11.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {ticket.title}
      </span>

      {/* Project name + date on hover */}
      {hovered ? (
        <span style={{ fontSize: 9.5, color: 'var(--accent)', flexShrink: 0, opacity: 0.85 }}>→</span>
      ) : (
        <>
          <span style={{ fontSize: 9.5, color: 'var(--fg-3)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 60, whiteSpace: 'nowrap' }}>
            {projectName}
          </span>
          {dateStr && (
            <span style={{ fontSize: 9, color: 'var(--fg-3)', flexShrink: 0, opacity: 0.6 }}>{dateStr}</span>
          )}
        </>
      )}
    </div>
  )
}

// ── Collapsible section ───────────────────────────────────────────────────────

function CollapsibleSection({ label, count, action, children, defaultOpen = true }: { label: string; count?: number; action?: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ marginBottom: 14, paddingTop: 0, paddingBottom: 14 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 10px 6px 14px', textTransform: 'uppercase', fontSize: 10,
        letterSpacing: 0.7, color: 'var(--fg-3)', fontWeight: 500,
      }}>
        <span
          onClick={() => setOpen(o => !o)}
          style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', userSelect: 'none' }}
        >
          <IChev style={{ transform: open ? 'rotate(90deg)' : 'none', width: 8, height: 8, transition: 'transform 0.1s', flexShrink: 0 }} />
          {label}
          {count != null && (
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 16, height: 16, padding: '0 5px', borderRadius: 99, background: 'var(--bg-3)', border: '1px solid var(--line)', color: 'var(--fg-3)', fontSize: 9.5, fontWeight: 600, letterSpacing: 0, lineHeight: 1 }}>
              {count}
            </span>
          )}
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
