import React, { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '../../store/useAppStore'
import type { Project, Session } from '../../store/useAppStore'
import { IChev, IFolder, IFolderOpen, IBranch, ITerminal, IPlus, ISpark, IHistory, ISettings, IClose, ITrash, ICopy, IEdit, IGit } from '../primitives/Icons'
import { Kbd } from '../primitives/Kbd'

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

export function ProjectSidebar() {
  const { projects, templates, activeProjectId, activeSessionId, setActiveProject, setActiveSession, setScreen, setNewProjectOpen, setNewSessionOpen, removeProject, removeSession, inputValue, setInputValue } = useAppStore()

  return (
    <aside style={{
      width: '100%', flexShrink: 0, background: 'var(--bg-1)',
      borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column',
    }}>
      {/* App header */}
      <div style={{
        padding: '10px 12px', borderBottom: '1px solid var(--line)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{
          width: 24, height: 24, borderRadius: 6, background: 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--accent-fg, #1a1410)', flexShrink: 0,
        }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 5l3 3-3 3M9 11h4"/>
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)', lineHeight: 1.2 }}>Claude Code UI</div>
          <div style={{ fontSize: 10, color: 'var(--fg-3)' }}>{projects.length} projects</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
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

        {/* Recent sessions */}
        <CollapsibleSection label="Recent sessions" count={0} defaultOpen={false} action={
          <button onClick={() => setScreen('history')} style={iconBtn}><IHistory /></button>
        }>
          <div style={{ padding: '8px 14px', fontSize: 11, color: 'var(--fg-3)' }}>Keine Einträge</div>
        </CollapsibleSection>
      </div>

      <div style={{
        borderTop: '1px solid var(--line)', padding: '8px 12px',
        display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: 'var(--fg-2)',
        cursor: 'pointer',
      }} onClick={() => setScreen('settings')}>
        <ISettings style={{ flexShrink: 0 }} />
        <span style={{ flex: 1 }}>Settings</span>
        <Kbd>⌘,</Kbd>
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
  const hasGit = useHasGit(project.path)
  const remoteUrl = useGitRemote(project.path)
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
    { label: 'Projekt löschen', icon: <ITrash />, danger: true, action: onDeleteProject },
  ])

  return (
    <div>
      {ctxMenu}
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
        {hovered ? (
          hasGit && githubUrl ? (
            <span
              onClick={(e: React.MouseEvent) => { e.stopPropagation(); window.open(githubUrl, '_blank') }}
              title="Zum Git-Repository ↗"
              style={{ fontSize: 9.5, color: 'var(--accent)', cursor: 'pointer', flexShrink: 0 }}
            >↗</span>
          ) : null
        ) : (
          <>
            {hasGit && (
              <IBranch
                style={{ color: 'var(--fg-3)', flexShrink: 0, width: 10, height: 10, cursor: 'pointer' }}
                onClick={(e: React.MouseEvent) => { e.stopPropagation(); window.dispatchEvent(new CustomEvent('cc:goto-git-tab')) }}
              />
            )}
            {!hasGit && (
              <IFolder
                style={{ color: 'var(--fg-3)', flexShrink: 0, width: 10, height: 10, cursor: 'pointer' }}
                onClick={(e: React.MouseEvent) => { e.stopPropagation(); openFolder() }}
              />
            )}
            {project.dirty != null && hasGit && (
              <span className="mono" style={{ fontSize: 9.5, color: 'var(--warn)', background: 'rgba(244,195,101,0.10)', padding: '1px 5px', borderRadius: 3 }}>
                {project.dirty}
              </span>
            )}
          </>
        )}
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
        margin: '0 6px', borderRadius: 5, cursor: 'pointer',
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
    <div style={{ marginBottom: 14 }}>
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

function CollapsibleSection({ label, count, action, children, defaultOpen = true }: { label: string; count?: number; action?: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ marginBottom: 14 }}>
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
