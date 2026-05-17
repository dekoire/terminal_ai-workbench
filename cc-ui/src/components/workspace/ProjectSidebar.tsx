import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useAppStore, setActiveStorageUser, DEFAULT_SIDEBAR_SECTIONS, DEFAULT_LAYOUT_SECTIONS } from '../../store/useAppStore'
import type { Project, Session, SidebarSection, SidebarSectionId, LayoutSection, AllSectionId } from '../../store/useAppStore'
import { idAddress } from '../../lib/ids'
import { IChev, IChevUp, IChevDown, IFolder, IFolderOpen, ITerminal, IPlus, ISpark, IHistory, ISettings, IClose, ITrash, ICopy, IEdit, IGit, IKanban, ILoader, IMoon, ISun, ILogout, IBug, IStar, IUser, IShieldPlus, IShield, IOrbit, IBell, ISliders, ITag, IExternalLink, IBrain, ILayers, IDrag } from '../primitives/Icons'
import { CtxLogButton, CompactGitCard, QuickLinksWidget, UserStoriesCard, SessionInfoCard } from './UtilityPanel'
import { AdminPanel } from '../screens/AdminPanel'
import avatarDefault from '../../assets/avatar.jpg'
import { KanbanBoard, GlobalKanbanBoard } from './KanbanBoard'
import { Kbd } from '../primitives/Kbd'
import { updateDocsWithAI } from '../../utils/updateDocs'
import { writeClipboard } from '../../lib/clipboard'
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
      style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 9999, background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6, padding: 4, minWidth: 172, boxShadow: '0 8px 28px rgba(0,0,0,0.35)' }}
    >
      {items.map((item, i) =>
        item === null
          ? <div key={i} style={{ height: 1, background: 'var(--line)', margin: '3px 0' }} />
          : (
            <div
              key={i}
              onClick={() => { item.action(); onClose() }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', fontSize: 11.5, borderRadius: 6, cursor: 'pointer', color: item.danger ? 'var(--err)' : 'var(--fg-0)' }}
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
  const { theme, setTheme, preset, setPreset, setAccent, setAccentFg, terminalTheme, setTerminalTheme, customUiColors, setCustomUiColors } = useAppStore()
  const toggle = () => {
    const cur    = DESIGN_PRESETS.find(d => d.id === preset) ?? DESIGN_PRESETS[0]
    // Keep the current accent family — only flip dark ↔ light
    const family = cur.id.replace(/-light$/, '')
    const nextId = cur.dark ? `${family}-light` : family
    const next   = DESIGN_PRESETS.find(d => d.id === nextId) ?? DESIGN_PRESETS[0]
    setPreset(next.id); setTheme(next.dark ? 'dark' : 'light')
    setAccent(next.accent); setAccentFg(next.accentFg)
    applyPreset(next, next.accent, next.accentFg)
    // Sync customUiColors so App.tsx's override pass uses the new preset values.
    // Preserve only syntax-token overrides the user set manually.
    const SYNTAX_KEYS = ['--tok-keyword','--tok-string','--tok-number','--tok-comment','--tok-type','--tok-fn']
    const preservedSyntax: Record<string, string> = {}
    SYNTAX_KEYS.forEach(k => { if (customUiColors[k]) preservedSyntax[k] = customUiColors[k] })
    const css = getComputedStyle(document.documentElement)
    const g = (k: string) => css.getPropertyValue(k).trim()
    setCustomUiColors({
      ...preservedSyntax,
      '--accent': next.accent, '--accent-fg': next.accentFg,
      '--accent-soft': g('--accent-soft'), '--accent-line': g('--accent-line'),
      '--bg-0': g('--bg-0'), '--bg-1': g('--bg-1'), '--bg-2': g('--bg-2'),
      '--bg-3': g('--bg-3'), '--bg-4': g('--bg-4'),
      '--fg-0': g('--fg-0'), '--fg-1': g('--fg-1'), '--fg-2': g('--fg-2'), '--fg-3': g('--fg-3'),
      '--line': g('--line'), '--line-strong': g('--line-strong'),
    })
    if (next.dark  && terminalTheme === 'github-light') setTerminalTheme('default')
    if (!next.dark && terminalTheme === 'default')      setTerminalTheme('github-light')
  }
  return (
    <button onClick={toggle} title={theme === 'dark' ? 'Zu hell wechseln' : 'Zu dunkel wechseln'} style={{ background: 'none', border: '1px solid transparent', cursor: 'pointer', color: 'var(--fg-3)', display: 'flex', alignItems: 'center', padding: '4px 5px', borderRadius: 6 }}>
      {theme === 'dark' ? <IMoon style={{ width: 16, height: 16 }} /> : <ISun style={{ width: 16, height: 16 }} />}
    </button>
  )
}

function AvatarPopoverBtn() {
  const { setScreen, setCurrentUser, currentUser } = useAppStore()
  const [open, setOpen] = useState(false)
  const [popPos, setPopPos] = useState({ left: 0, bottom: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)

  const firstName = currentUser?.firstName ?? ''
  const lastName  = currentUser?.lastName  ?? ''
  const fullName  = (firstName || lastName) ? `${firstName} ${lastName}`.trim() : null
  const initials  = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || (currentUser?.email?.charAt(0) ?? 'U').toUpperCase()
  const avatarSrc = currentUser?.avatarDataUrl ?? avatarDefault

  const handleToggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPopPos({ left: r.left, bottom: window.innerHeight - r.top + 6 })
    }
    setOpen(o => !o)
  }

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node) && e.target !== btnRef.current) setOpen(false)
    }
    setTimeout(() => window.addEventListener('mousedown', h), 0)
    return () => window.removeEventListener('mousedown', h)
  }, [open])

  const [hovered, setHovered] = useState(false)
  const hasCustomAvatar = !!currentUser?.avatarDataUrl

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleToggle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        title={fullName ?? 'Profil'}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: open || hovered ? 'var(--bg-3)' : 'none',
          border: '1px solid transparent',
          borderRadius: 99, cursor: 'pointer', padding: '4px 10px 4px 4px',
          transition: 'background 0.12s, border-color 0.12s', maxWidth: 160, overflow: 'hidden',
        }}
      >
        {/* Avatar circle — custom image or white initials */}
        <div style={{
          width: 26, height: 26, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
          background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9.5, fontWeight: 700, color: '#fff',
        }}>
          {hasCustomAvatar ? (
            <img
              src={avatarSrc}
              alt={initials}
              onError={e => { e.currentTarget.style.display = 'none' }}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <span>{initials}</span>
          )}
        </div>
        {/* Name */}
        {fullName && (
          <span style={{ fontSize: 12, color: 'var(--fg-0)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {fullName}
          </span>
        )}
      </button>

      {open && (
        <div ref={popRef} style={{ position: 'fixed', left: popPos.left, bottom: popPos.bottom, zIndex: 9999, background: 'var(--bg-2)', border: '1px solid var(--line-strong)', borderRadius: 8, boxShadow: '0 10px 30px rgba(0,0,0,0.4)', overflow: 'hidden', minWidth: 220 }}>
          {/* User info header */}
          {(fullName || currentUser?.email) && (
            <>
              <div style={{ padding: '12px 16px 10px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, overflow: 'hidden', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff' }}>
                  {hasCustomAvatar
                    ? <img src={avatarSrc} alt={initials} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.currentTarget.style.display = 'none' }} />
                    : <span>{initials}</span>
                  }
                </div>
                <div style={{ overflow: 'hidden' }}>
                  {fullName && <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fullName}</div>}
                  {currentUser?.email && <div style={{ fontSize: 11, color: 'var(--fg-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>{currentUser.email}</div>}
                </div>
              </div>
              <div style={{ height: 1, background: 'var(--line)', margin: '0 0 4px' }} />
            </>
          )}
          <PopMenuItem icon={<IUser style={{ width: 13, height: 13 }} />} label="Profil" onClick={() => { setOpen(false); setScreen('profile') }} />
          <PopMenuItem icon={<ISliders style={{ width: 13, height: 13 }} />} label="Einrichten" onClick={() => { setOpen(false); window.dispatchEvent(new CustomEvent('cc:open-getting-started')) }} />
          <PopMenuItem icon={<ISettings style={{ width: 13, height: 13 }} />} label="Einstellungen" onClick={() => { setOpen(false); setScreen('settings') }} />
          <div style={{ height: 1, background: 'var(--line)', margin: '4px 0' }} />
          <PopMenuItem
            icon={<ILogout style={{ width: 13, height: 13 }} />}
            label="Ausloggen"
            onClick={() => { setOpen(false); setActiveStorageUser(''); setCurrentUser(null); setScreen('login'); useAppStore.getState().resetUserData() }}
          />
          <div style={{ height: 6 }} />
        </div>
      )}
    </>
  )
}

function PopMenuItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', cursor: 'pointer', fontSize: 12.5, color: 'var(--fg-0)' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-3)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <span style={{ color: 'var(--fg-3)', display: 'flex' }}>{icon}</span>
      {label}
    </div>
  )
}

const PROJECTS_COLLAPSED = 5

export function ProjectSidebar() {
  const {
    projects, templates, activeProjectId, activeSessionId,
    setActiveProject, setActiveSession, setScreen, setNewProjectOpen, setNewSessionOpen,
    removeProject, removeSession, inputValue, setInputValue,
    currentUser, adminEmails,
    sidebarSections, setSidebarSections,
    layoutSections, setLayoutSections,
    reorderProjects,
  } = useAppStore()
  const isAdmin = !!currentUser?.email && adminEmails.map(e => e.toLowerCase()).includes(currentUser.email.toLowerCase())
  const [projectsExpanded, setProjectsExpanded] = useState(false)
  const [openProjectId, setOpenProjectId] = useState<string | null>(activeProjectId)

  // ── Project drag-and-drop ────────────────────────────────────────────────────
  const dragProjectIdx = useRef<number>(-1)
  const [dragOverProjectIdx, setDragOverProjectIdx] = useState<number>(-1)
  const toggleProject = (id: string) => setOpenProjectId(prev => prev === id ? null : id)

  // Left-panel sections from the unified layout system
  const allLayout = layoutSections ?? DEFAULT_LAYOUT_SECTIONS
  const sections: LayoutSection[] = allLayout.filter(s => s.panel === 'left')

  const SECTION_LABELS: Record<AllSectionId, string> = {
    workspaces:          'Workspaces',
    prompts:             'Prompts',
    github:              'GitHub',
    quicklinks:          'Quick Links',
    tasks:               'Tasks',
    kontextlog:          'Kontext Log',
    'projekt-terminal':  'Session Card',
  }

  // Active project/session for sidebar renderers
  const activeProject = projects.find(p => p.id === activeProjectId)
  const activeSession = activeProject?.sessions.find(s => s.id === activeSessionId)

  const renderSection = (id: AllSectionId) => {
    switch (id) {
      case 'workspaces': return (
        <CollapsibleSection label="Workspaces" count={projects.length} defaultOpen action={
          <button onClick={() => setNewProjectOpen(true)} style={iconBtn}><IPlus /></button>
        }>
          {(projectsExpanded ? projects : projects.slice(0, PROJECTS_COLLAPSED)).map((p, idx) => (
            <div
              key={p.id}
              draggable
              onDragStart={() => { dragProjectIdx.current = idx }}
              onDragOver={e => { e.preventDefault(); setDragOverProjectIdx(idx) }}
              onDragLeave={() => setDragOverProjectIdx(-1)}
              onDrop={e => {
                e.preventDefault()
                const from = dragProjectIdx.current
                if (from === idx || from < 0) { setDragOverProjectIdx(-1); return }
                const list = projectsExpanded ? [...projects] : [...projects.slice(0, PROJECTS_COLLAPSED), ...projects.slice(PROJECTS_COLLAPSED)]
                const reordered = [...list]
                const [moved] = reordered.splice(from, 1)
                reordered.splice(idx, 0, moved)
                reorderProjects(reordered.map(p => p.id))
                dragProjectIdx.current = -1
                setDragOverProjectIdx(-1)
              }}
              onDragEnd={() => { dragProjectIdx.current = -1; setDragOverProjectIdx(-1) }}
              onMouseEnter={e => { const h = e.currentTarget.querySelector('.proj-drag-handle') as HTMLElement | null; if (h) h.style.opacity = '1' }}
              onMouseLeave={e => { const h = e.currentTarget.querySelector('.proj-drag-handle') as HTMLElement | null; if (h) h.style.opacity = '0' }}
              style={{
                position: 'relative',
                borderTop: dragOverProjectIdx === idx && dragProjectIdx.current > idx ? '2px solid var(--accent)' : '2px solid transparent',
                borderBottom: dragOverProjectIdx === idx && dragProjectIdx.current < idx ? '2px solid var(--accent)' : '2px solid transparent',
              }}
            >
              <div style={{ position: 'absolute', left: 2, top: 18, transform: 'translateY(-50%)', opacity: 0, transition: 'opacity 0.15s', zIndex: 1, cursor: 'grab', color: 'var(--fg-3)', pointerEvents: 'none' }}
                className="proj-drag-handle">
                <IDrag style={{ width: 10, height: 10 }} />
              </div>
              <ProjectRow
                project={p}
                active={p.id === activeProjectId}
                open={openProjectId === p.id}
                onToggleOpen={() => toggleProject(p.id)}
                activeSessionId={activeSessionId}
                onSelectProject={setActiveProject}
                onSelectSession={(sid) => { setActiveProject(p.id); setActiveSession(sid) }}
                onNewSession={() => { setActiveProject(p.id); setNewSessionOpen(true) }}
                onDeleteProject={() => removeProject(p.id)}
                onCloseSession={(sid) => removeSession(p.id, sid)}
              />
            </div>
          ))}
          {projects.length > PROJECTS_COLLAPSED && (
            <div
              onClick={() => setProjectsExpanded(e => !e)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '5px 0 8px', cursor: 'pointer', color: 'var(--fg-3)', fontSize: 11, fontFamily: 'var(--font-ui)', fontWeight: 300, width: '100%' }}
            >
              {projectsExpanded ? <IChevUp style={{ width: 8, height: 8 }} /> : <IChevDown style={{ width: 8, height: 8 }} />}
              {projectsExpanded ? 'Weniger anzeigen' : `${projects.length - PROJECTS_COLLAPSED} weitere`}
            </div>
          )}
        </CollapsibleSection>
      )
      case 'prompts': return projects.length > 0 ? (
        <TemplatesSection
          templates={templates}
          onAdd={() => setScreen('templates')}
          onPick={(body) => setInputValue(inputValue ? inputValue + '\n' + body : body)}
        />
      ) : null
      case 'github': return activeProject?.path
        ? <div style={{ padding: '0 10px 10px' }}><CompactGitCard projectPath={activeProject.path} onOpenGitTab={() => {}} /></div>
        : null
      case 'quicklinks': return <div style={{ padding: '0 10px' }}><QuickLinksWidget /></div>
      case 'tasks': return <div style={{ padding: '0 10px' }}><UserStoriesCard projectId={activeProject?.id} sessionId={activeSession?.id ?? ''} /></div>
      case 'kontextlog': return activeProject ? (
        <div style={{ padding: '0 10px 10px' }}>
          <CtxLogButton projectId={activeProject.id} />
        </div>
      ) : null
      case 'projekt-terminal': return (
        <div style={{ padding: '0 10px 10px' }}>
          <SessionInfoCard />
        </div>
      )
      default: return null
    }
  }

  return (
    <aside style={{
      width: '100%', flexShrink: 0, background: 'var(--bg-1)',
      color: 'var(--fg-0)',
      display: 'flex', flexDirection: 'column',
    }}>
      <style>{`
        @keyframes perm-bell {
          0%, 100% { transform: rotate(0deg); }
          20%       { transform: rotate(-18deg); }
          40%       { transform: rotate(18deg); }
          60%       { transform: rotate(-10deg); }
          80%       { transform: rotate(10deg); }
        }
      `}</style>
      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 0 12px' }}>
        {/* Visible sections in stored order */}
        {sections.filter(s => s.visible).map(s => (
          <div key={s.id}>{renderSection(s.id as AllSectionId)}</div>
        ))}
      </div>

      <div style={{ padding: '8px 10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
        <AvatarPopoverBtn />
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <ThemeToggleBtn />
        </div>
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

// ── Remove-Workspace confirmation dialog ──────────────────────────────────────
function RemoveWorkspaceDialog({ projectName, onConfirm, onCancel }: {
  projectName: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const theme = useAppStore(s => s.theme)
  const deleteBtnBg = theme === 'dark' ? '#ff3b4e' : '#c0192e'
  const deleted = [
    'Alle Chat-Verläufe und Nachrichten',
    'Agent-Sessions und deren Kontext',
    'Orbit-Chats und KI-Antworten',
    'Kanban-Tickets und Notizen',
    'Projekt-Erinnerungen (Brain)',
  ]

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)' }}
      onClick={onCancel}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: 400, background: 'var(--bg-2)', border: '1px solid var(--line-strong)', borderRadius: 14, boxShadow: '0 24px 64px rgba(0,0,0,0.55)', overflow: 'hidden' }}
      >
        {/* Header */}
        <div style={{ padding: '22px 24px 16px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg-0)' }}>Workspace entfernen</div>
          <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 3 }}>„{projectName}"</div>
        </div>

        {/* Body */}
        <div style={{ padding: '18px 24px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Safe info */}
          <div style={{ background: 'var(--bg-0)', borderRadius: 8, padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <IFolder style={{ width: 16, height: 16, marginTop: 1, flexShrink: 0, color: 'var(--accent)' }} />
            <span style={{ fontSize: 11.5, color: 'var(--fg-1)', lineHeight: 1.55 }}>
              Deine <strong>lokalen Dateien</strong> und das <strong>GitHub-Repository</strong> bleiben vollständig erhalten — es wird nichts vom Laufwerk gelöscht.
            </span>
          </div>

          {/* What gets deleted */}
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--fg-3)', marginBottom: 9 }}>
              Folgende Projektdaten werden entfernt
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {deleted.map(item => (
                <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5.2L4 7.2L8 3" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--fg-1)' }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex' }}>
          <button
            onClick={onCancel}
            style={{ flex: 1, padding: '14px 0', border: 'none', borderTop: '1px solid var(--line)', background: 'var(--bg-2)', color: 'var(--fg-1)', fontSize: 13, fontWeight: 500, cursor: 'pointer', borderRadius: '0 0 0 14px' }}
          >
            Abbrechen
          </button>
          <button
            onClick={onConfirm}
            style={{ flex: 1, padding: '14px 0', border: 'none', borderTop: '1px solid var(--line)', background: deleteBtnBg, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', borderRadius: '0 0 14px 0' }}
          >
            Workspace entfernen
          </button>
        </div>
      </div>
    </div>
  )
}

function ProjectRow({ project, active, open, onToggleOpen, activeSessionId, onSelectProject, onSelectSession, onNewSession, onDeleteProject, onCloseSession }: {
  project: Project; active: boolean; open: boolean; activeSessionId: string
  onToggleOpen: () => void
  onSelectProject: (id: string) => void
  onSelectSession: (id: string) => void
  onNewSession: () => void
  onDeleteProject: () => void
  onCloseSession: (id: string) => void
}) {
  const [sessionsExpanded, setSessionsExpanded] = useState(false)
  const SESSIONS_COLLAPSED = 4
  const [hovered, setHovered] = useState(false)
  const [kanbanOpen, setKanbanOpen] = useState(false)
  const [docUpdating, setDocUpdating] = useState(false)
  const [removeConfirm, setRemoveConfirm] = useState(false)
  const isDocApplying = useAppStore(s => s.docApplying[project.id] ?? false)
  const hasGit = useHasGit(project.path)
  const remoteUrl = useGitRemote(project.path)

  const handleDocUpdate = async () => {
    setDocUpdating(true)
    try { await updateDocsWithAI(project.path) } finally { setDocUpdating(false) }
  }
  const githubUrl = remoteUrl ? toRepoUrl(remoteUrl) : null
  const { open: openCtx, menu: ctxMenu } = useCtxMenu()

  const copyPath = () => writeClipboard(project.path)
  const copyName = () => writeClipboard(project.name)
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
    { label: 'Workspace entfernen', icon: <ITrash />, danger: true, action: () => setRemoveConfirm(true) },
  ])

  return (
    <div>
      {ctxMenu}
      {removeConfirm && (
        <RemoveWorkspaceDialog
          projectName={project.name}
          onConfirm={() => { setRemoveConfirm(false); onDeleteProject() }}
          onCancel={() => setRemoveConfirm(false)}
        />
      )}
      {kanbanOpen && (
        <KanbanBoard
          projectId={project.id}
          projectName={project.name}
          projectPath={project.path}
          onClose={() => setKanbanOpen(false)}
        />
      )}
      <div
        onClick={() => { onToggleOpen(); onSelectProject(project.id) }}
        onContextMenu={handleContextMenu}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '3px 8px',
          margin: '1px 6px', borderRadius: 6, cursor: 'pointer',
          background: active ? 'var(--bg-2)' : hovered ? 'var(--bg-2)' : 'transparent',
          color: active ? 'var(--fg-0)' : 'var(--fg-1)',
          transition: 'background 0.1s',
        }}
      >
        <IChev style={{ transform: open ? 'rotate(90deg)' : 'none', color: 'var(--fg-3)', flexShrink: 0 }} />
        {open
          ? <IFolderOpen style={{ color: active ? 'var(--fg-2)' : 'var(--fg-2)', flexShrink: 0 }} />
          : <IFolder style={{ color: 'var(--fg-2)', flexShrink: 0 }} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 12, fontWeight: active ? 500 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
            {project.name}
          </span>
        </div>
        {isDocApplying && (
          <ILoader className="anim-spin" style={{ color: 'var(--accent)', flexShrink: 0, width: 11, height: 11 }} title="Docu wird angelegt…" />
        )}
        {project.dirty != null && hasGit && (
          <span className="mono" style={{ fontSize: 9.5, color: 'var(--warn)', background: 'rgba(244,195,101,0.10)', padding: '1px 5px', borderRadius: 3 }}>
            {project.dirty}
          </span>
        )}
      </div>

      {open && (
        <>
          <div style={{ paddingLeft: 24, marginTop: 1, marginBottom: 1 }}>
            {(sessionsExpanded ? project.sessions : project.sessions.slice(0, SESSIONS_COLLAPSED)).map((s) => (
              <SessionRow key={s.id} session={s} active={s.id === activeSessionId} project={project} onSelect={() => onSelectSession(s.id)} onClose={() => onCloseSession(s.id)} />
            ))}
            <div
              onClick={onNewSession}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '4px 14px 4px 6px',
                margin: '0 6px', borderRadius: 6, color: 'var(--fg-3)', fontSize: 11.5, cursor: 'pointer',
              }}
            >
              <IPlus /><span>New session</span>
            </div>
          </div>
          {project.sessions.length > SESSIONS_COLLAPSED && (
            <div
              onClick={() => setSessionsExpanded(e => !e)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '2px 0', cursor: 'pointer', color: 'var(--fg-3)', fontSize: 11, fontFamily: 'var(--font-ui)', fontWeight: 300, width: '100%', marginBottom: 2 }}
            >
              {sessionsExpanded ? <IChevUp style={{ width: 8, height: 8 }} /> : <IChevDown style={{ width: 8, height: 8 }} />}
              {sessionsExpanded ? 'Weniger anzeigen' : `${project.sessions.length - SESSIONS_COLLAPSED} weitere`}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function SessionRow({ session, active, project, onSelect, onClose }: { session: Session; active: boolean; project: Project; onSelect: () => void; onClose: () => void }) {
  const { aliases, updateSession } = useAppStore()
  const [hovered, setHovered] = useState(false)
  const [permPending, setPermPending] = useState(false)
  const { open: openCtx, menu: ctxMenu } = useCtxMenu()

  useEffect(() => {
    const onPending = (e: Event) => {
      const { sessionId, pending } = (e as CustomEvent).detail as { sessionId: string; pending: boolean }
      if (sessionId === session.id) setPermPending(pending)
    }
    const onDecision = () => setPermPending(false)
    window.addEventListener('cc:permission-pending', onPending)
    window.addEventListener('cc:permission-decision', onDecision)
    return () => {
      window.removeEventListener('cc:permission-pending', onPending)
      window.removeEventListener('cc:permission-decision', onDecision)
    }
  }, [session.id])

  const alias = aliases.find(a => a.name === session.alias)
  const isOrbit  = session.kind === 'orbit'
  const isAgent  = session.kind === 'openrouter-claude'
  const isDangerous = session.permMode === 'dangerous' || alias?.args?.includes('--dangerously-skip-permissions') || alias?.permMode === 'dangerous'

  const handleContextMenu = (e: React.MouseEvent) => openCtx(e, [
    { label: 'Umbenennen', icon: <IEdit />, action: () => {
      const name = window.prompt('Neuer Name:', session.name)
      if (name?.trim()) updateSession(session.id, { name: name.trim() })
    }},
    null,
    { label: 'Session schließen', icon: <IClose />, danger: true, action: onClose },
  ])

  const isExited   = session.status === 'exited'
  const isOffline  = isAgent && (isExited || session.status === 'error' || !session.status)

  // Ampel: status dot color
  const dotColor = isDangerous
    ? 'var(--err)'
    : isOrbit  ? 'var(--orbit)'
    : session.status === 'active' ? 'var(--ok)'
    : session.status === 'error'  ? 'var(--err)'
    : isOffline ? 'var(--warn)'
    : 'var(--fg-3)'

  const bgColor   = isDangerous && active ? 'rgba(239,122,122,0.1)' : isOrbit && active ? 'rgba(139,108,247,0.10)' : active ? 'var(--accent-soft)' : 'transparent'
  const textColor = isDangerous ? (active ? 'var(--err)' : 'var(--fg-1)') : isOrbit && active ? 'var(--orbit)' : isOffline ? 'var(--fg-2)' : active ? 'var(--fg-0)' : 'var(--fg-1)'

  // Type icon color
  const iconColor = isDangerous ? 'var(--err)' : isOrbit ? (active ? 'var(--orbit)' : 'var(--fg-3)') : isAgent ? (isOffline ? 'var(--warn)' : active ? 'var(--accent)' : 'var(--fg-3)') : (active ? 'var(--fg-2)' : 'var(--fg-3)')

  return (
    <div>
      {ctxMenu}
    <div
      onClick={onSelect}
      onContextMenu={handleContextMenu}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 7, padding: '5px 10px 5px 14px',
        margin: '1px 6px', borderRadius: 6, cursor: 'pointer',
        background: active ? bgColor || 'var(--accent-soft)' : hovered ? 'var(--bg-2)' : 'transparent',
        color: textColor,
        opacity: isOffline && !active ? 0.55 : 1,
        transition: 'background 0.1s',
      }}
    >
      {/* ── Typ-Icon links ── */}
      {isDangerous
        ? <IShieldPlus title="--dangerously-skip-permissions" style={{ width: 11, height: 11, color: 'var(--err)', flexShrink: 0 }} />
        : isOrbit
          ? <IOrbit  style={{ width: 11, height: 11, color: iconColor, flexShrink: 0 }} />
          : isAgent
            ? <ISpark  style={{ width: 11, height: 11, color: iconColor, flexShrink: 0 }} />
            : <ITerminal style={{ width: 11, height: 11, color: iconColor, flexShrink: 0 }} />
      }

      {/* ── Name (once) ── */}
      <span style={{ flex: 1, fontSize: 11.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: isExited ? 'line-through' : 'none' }}>
        {session.name}
      </span>

      {/* ── Rechts: Bell → Ampel-Dot → Close on hover ── */}
      {permPending && !hovered && (
        <IBell style={{ width: 10, height: 10, color: 'var(--accent)', flexShrink: 0, animation: 'perm-bell 1s ease-in-out infinite' }} />
      )}
      {hovered
        ? <IClose style={{ width: 9, height: 9, color: 'var(--fg-3)', flexShrink: 0, opacity: 0.8 }} onClick={(e: React.MouseEvent) => { e.stopPropagation(); onClose() }} />
        : (
          <span style={{
            width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
            background: dotColor,
            ...(session.status === 'active' && !isDangerous ? { animation: 'cc-pulse 1.4s ease-in-out infinite' } : {}),
          }} />
        )
      }
    </div>
    </div>
  )
}

const TEMPLATES_COLLAPSED = 4

function TemplateRow({
  t, onPick, onToggleFavorite, onDelete, onEditDone,
}: {
  t: { id: string; name: string; hint?: string; body: string; favorite?: boolean }
  onPick: () => void
  onToggleFavorite: () => void
  onDelete: () => void
  onEditDone: (name: string) => void
}) {
  const [hovered, setHovered] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(t.name)
  const inputRef = useRef<HTMLInputElement>(null)
  const { open: openCtx, menu: ctxMenu } = useCtxMenu()

  const startEdit = () => { setDraft(t.name); setEditing(true); setTimeout(() => inputRef.current?.select(), 0) }
  const commitEdit = () => { if (draft.trim()) onEditDone(draft.trim()); setEditing(false) }

  const handleContextMenu = (e: React.MouseEvent) => openCtx(e, [
    { label: 'Bearbeiten', icon: <IEdit />, action: startEdit },
    { label: t.favorite ? 'Als Favorit entfernen' : 'Als Favorit speichern', icon: <IStar />, action: onToggleFavorite },
    null,
    { label: 'Löschen', icon: <ITrash />, danger: true, action: onDelete },
  ])

  return (
    <div>
      {ctxMenu}
      <div
        onClick={() => { if (!editing) onPick() }}
        onContextMenu={handleContextMenu}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px',
          cursor: editing ? 'default' : 'pointer', color: 'var(--fg-1)', fontSize: 11.5,
          background: hovered && !editing ? 'var(--bg-3)' : 'transparent',
          borderRadius: 6, transition: 'background 0.1s', margin: '0 4px',
        }}
      >
        {/* Left icon: always tag */}
        <ITag style={{ color: t.favorite ? 'var(--warn)' : 'var(--fg-3)', flexShrink: 0, width: 12, height: 12 }} />

        {/* Name — inline editable */}
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(false) }}
            onClick={e => e.stopPropagation()}
            style={{
              flex: 1, background: 'var(--bg-1)', border: '1px solid var(--accent)',
              borderRadius: 4, padding: '1px 6px', fontSize: 11.5, color: 'var(--fg-0)',
              outline: 'none',
            }}
          />
        ) : (
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
        )}

        {/* Right side: star on hover, hint/favorite indicator otherwise */}
        {!editing && (
          hovered
            ? <IStar
                onClick={e => { e.stopPropagation(); onToggleFavorite() }}
                style={{ width: 11, height: 11, color: t.favorite ? 'var(--warn)' : 'var(--fg-3)', flexShrink: 0, cursor: 'pointer', transition: 'color 0.1s' }}
                title={t.favorite ? 'Favorit entfernen' : 'Als Favorit speichern'}
              />
            : t.hint
              ? <Kbd>{t.hint}</Kbd>
              : t.favorite
                ? <span style={{ fontSize: 9, color: 'var(--warn)' }}>★</span>
                : null
        )}
      </div>
    </div>
  )
}

function TemplatesSection({
  templates, onAdd, onPick,
}: {
  templates: { id: string; name: string; hint?: string; body: string; favorite?: boolean }[]
  onAdd: () => void
  onPick: (body: string) => void
}) {
  const { updateTemplate, removeTemplate } = useAppStore()
  const [expanded, setExpanded] = useState(false)
  const [sectionOpen, setSectionOpen] = useState(false)
  const visible = expanded ? templates : templates.slice(0, TEMPLATES_COLLAPSED)
  const hidden  = templates.length - TEMPLATES_COLLAPSED

  return (
    <div style={{ marginBottom: 20, padding: '0 10px' }}>
      <div
        onClick={() => setSectionOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 4px', paddingBottom: sectionOpen ? 6 : 0, cursor: 'pointer', userSelect: 'none' }}
      >
        <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--fg-3)', fontWeight: 500, flex: 1, display: 'flex', alignItems: 'center', gap: 5 }}>
          Prompts
          <span style={{ fontWeight: 400, letterSpacing: 0 }}>({templates.length})</span>
        </span>
        <button onClick={e => { e.stopPropagation(); onAdd() }} style={iconBtn}><IPlus /></button>
        {sectionOpen
          ? <IChevUp   style={{ width: 11, height: 11, color: 'var(--fg-3)', flexShrink: 0 }} />
          : <IChevDown style={{ width: 11, height: 11, color: 'var(--fg-3)', flexShrink: 0 }} />
        }
      </div>

      {sectionOpen && (
        <div style={{ background: 'var(--bg-2)', border: '0.5px solid var(--line-strong)', borderRadius: 10, overflow: 'hidden', padding: '4px 0', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          {visible.map((t) => (
            <TemplateRow
              key={t.id}
              t={t}
              onPick={() => onPick(t.body)}
              onToggleFavorite={() => updateTemplate(t.id, { favorite: !t.favorite })}
              onDelete={() => removeTemplate(t.id)}
              onEditDone={(name) => updateTemplate(t.id, { name })}
            />
          ))}
          {templates.length > TEMPLATES_COLLAPSED && (
            <div
              onClick={() => setExpanded(e => !e)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '3px 0', cursor: 'pointer', color: 'var(--fg-3)', fontSize: 11, fontFamily: 'var(--font-ui)', fontWeight: 300, width: '100%' }}
            >
              {expanded ? <IChevUp style={{ width: 8, height: 8 }} /> : <IChevDown style={{ width: 8, height: 8 }} />}
              {expanded ? 'Weniger anzeigen' : `${hidden} weitere`}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── User Stories Section ───────────────────────────────────────────────────────

const STORIES_COLLAPSED = 3

// Inline type icons (mirrors KanbanBoard TypeIcon)
function typeColor(type?: string) {
  if (type === 'bug') return 'var(--err)'
  if (type === 'nfc') return '#5b9cf6'
  return 'var(--ok)'
}

function SidebarTypeIcon({ type }: { type?: string }) {
  const s: React.CSSProperties = { width: 10, height: 10, flexShrink: 0 }
  if (type === 'bug') return <IBug style={{ ...s, color: typeColor(type) }} />
  if (type === 'nfc') return <IStar style={{ ...s, color: typeColor(type) }} />
  return <IUser style={{ ...s, color: typeColor(type) }} />
}

function UserStoriesSection() {
  const { kanban, projects } = useAppStore()
  const [globalOpen, setGlobalOpen]   = useState(false)
  const [sectionOpen, setSectionOpen] = useState(false)
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
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 16, height: 16, padding: '0 5px', borderRadius: 99, background: 'var(--accent-soft)', border: '1px solid var(--accent-line)', color: 'var(--accent)', fontSize: 9.5, fontWeight: 700, letterSpacing: 0, lineHeight: 1 }}>
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
                  margin: '1px 6px 0', borderRadius: 6, cursor: 'pointer',
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
        margin: '0 6px 1px', borderRadius: 6, cursor: 'pointer',
        background: hovered ? 'var(--bg-3)' : 'transparent',
        color: 'var(--fg-1)',
      }}
    >
      {/* Type icon */}
      <SidebarTypeIcon type={ticket.type} />

      {/* ID badge — same color as type icon */}
      {ticket.ticketNumber != null && (
        <span style={{ fontSize: 9.5, fontWeight: 700, color: typeColor(ticket.type), flexShrink: 0, letterSpacing: 0.2 }}>
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

// ── Compact GitHub section ────────────────────────────────────────────────────

function CompactGitHubSection() {
  const { projects, activeProjectId } = useAppStore()
  const project = projects.find(p => p.id === activeProjectId)
  const remoteUrl = useGitRemote(project?.path ?? '')
  const repoUrl = remoteUrl ? toRepoUrl(remoteUrl) : null

  // Extract slug (owner/repo) from the full URL
  const slug = repoUrl ? repoUrl.replace(/^https?:\/\/[^/]+\//, '') : null

  if (!project) return null
  return (
    <div style={{ marginBottom: 14, padding: '0 10px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--fg-3)', padding: '0 4px', marginBottom: 6 }}>GitHub</div>
      <div style={{ background: 'var(--bg-2)', border: '0.5px solid var(--line-strong)', borderRadius: 8, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--fg-2)">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
        </svg>
        {slug && repoUrl
          ? <a href={repoUrl} target="_blank" rel="noreferrer" style={{ flex: 1, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--fg-1)', textDecoration: 'none' }}>{slug}</a>
          : <span style={{ flex: 1, fontSize: 11, color: 'var(--fg-3)' }}>Kein Remote</span>
        }
      </div>
    </div>
  )
}

// ── Compact Quick Links section ───────────────────────────────────────────────

function CompactQuickLinksSection() {
  const { quickLinks } = useAppStore()
  if (quickLinks.length === 0) return null
  const openLink = (url: string) => { try { window.open(url, '_blank') } catch { /* ignore */ } }
  return (
    <div style={{ marginBottom: 14, padding: '0 10px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--fg-3)', padding: '0 4px', marginBottom: 6 }}>Quick Links</div>
      <div style={{ background: 'var(--bg-2)', border: '0.5px solid var(--line-strong)', borderRadius: 8, overflow: 'hidden' }}>
        {quickLinks.slice(0, 6).map((link, i) => (
          <button
            key={link.id}
            onClick={() => openLink(link.url)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left', borderTop: i > 0 ? '0.5px solid var(--line)' : 'none' }}
          >
            <img
              src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(link.url)}&sz=32`}
              style={{ width: 13, height: 13, borderRadius: 2, flexShrink: 0 }}
              onError={e => { (e.target as HTMLImageElement).src = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="%23888"/></svg>` }}
            />
            <span style={{ fontSize: 11.5, color: 'var(--fg-0)', flex: 1 }}>{link.title}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Collapsible section ───────────────────────────────────────────────────────

function CollapsibleSection({ label, count, action, children, defaultOpen = true }: { label: string; count?: number; action?: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ marginBottom: 20, padding: '0 10px' }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 4px', paddingBottom: open ? 6 : 0, cursor: 'pointer', userSelect: 'none' }}
      >
        <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--fg-3)', fontWeight: 500, flex: 1, display: 'flex', alignItems: 'center', gap: 5 }}>
          {label}
          {count != null && <span style={{ fontWeight: 400, letterSpacing: 0 }}>({count})</span>}
        </span>
        {action && <span onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', color: 'var(--fg-2)' }}>{action}</span>}
        {open
          ? <IChevUp   style={{ width: 11, height: 11, color: 'var(--fg-3)', flexShrink: 0 }} />
          : <IChevDown style={{ width: 11, height: 11, color: 'var(--fg-3)', flexShrink: 0 }} />
        }
      </div>
      {open && React.Children.count(children) > 0 && (
        <div style={{ background: 'var(--bg-2)', border: '0.5px solid var(--line-strong)', borderRadius: 10, overflow: 'hidden' }}>
          {children}
        </div>
      )}
    </div>
  )
}

const iconBtn: React.CSSProperties = {
  background: 'transparent', border: 'none', color: 'var(--fg-2)',
  display: 'flex', alignItems: 'center', padding: 0, cursor: 'pointer',
}
