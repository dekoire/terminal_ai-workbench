import React, { useState, useEffect, useRef, useCallback } from 'react'
import simpleLogo from '../../assets/simple_logo.svg'
import { useAppStore } from '../../store/useAppStore'
import type { OrbitMessage, QuickLink } from '../../store/useAppStore'
import { buildUserStoryPrompt } from '../../lib/projectBrain'
import { getSupabase } from '../../lib/supabase'
import { loadLastProjectMessages } from '../../lib/agentSync'
import { IMore, IEdit, IChev, IChevDown, IChevUp, IFolder, IFolderOpen, IFile, IClose, IBranch, IGitFork, ITrash, ICheck, ISpark, ITable, IFilePlus, ICopy, IExternalLink, IDownload, IFileDown, IFileText, ISearch, IDatabase, ITerminal, IKanban, IUser, ICpu, IPlay, IBug, IStar, IOrbit, IBookmark, ISpinner, ISend, IX, ICloudUpload, ICloudDownload, IHistoryClock, IEye, ISettings, ILink, IKeyboard, IUndo, ISliders, IPlus, IArrowDownLine, IArrowUpLine } from '../primitives/Icons'
import { KanbanBoard } from './KanbanBoard'
import { XTermPane } from '../terminal/XTermPane'
import { Pill } from '../primitives/Pill'

const OPENROUTER_MODELS = [
  { label: 'Claude Opus 4',       value: 'anthropic/claude-opus-4' },
  { label: 'Claude Sonnet 4.6',   value: 'anthropic/claude-sonnet-4-6' },
  { label: 'Claude Haiku 4.5',    value: 'anthropic/claude-haiku-4-5' },
  { label: 'GPT-4o',              value: 'openai/gpt-4o' },
  { label: 'GPT-4o mini',         value: 'openai/gpt-4o-mini' },
  { label: 'o3',                  value: 'openai/o3' },
  { label: 'o4-mini',             value: 'openai/o4-mini' },
  { label: 'Gemini 2.5 Pro',      value: 'google/gemini-2.5-pro-preview' },
  { label: 'Gemini 2.5 Flash',    value: 'google/gemini-2.5-flash-preview' },
  { label: 'DeepSeek R1',         value: 'deepseek/deepseek-r1' },
  { label: 'DeepSeek V3',         value: 'deepseek/deepseek-chat' },
  { label: 'Llama 3.3 70B',       value: 'meta-llama/llama-3.3-70b-instruct' },
  { label: 'Mistral Large',       value: 'mistralai/mistral-large' },
  { label: 'Qwen3 235B',          value: 'qwen/qwen3-235b-a22b' },
]

// ── helpers ──────────────────────────────────────────────────────────────────

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} min ago`
  return `${Math.floor(m / 60)}h ago`
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// ── file tree data ────────────────────────────────────────────────────────────

interface FileNode {
  name: string
  type: 'file' | 'dir'
  children?: FileNode[]
}

const TREES: Record<string, FileNode[]> = {
  'payments-api': [
    { name: 'src', type: 'dir', children: [
      { name: 'charge-handler.ts', type: 'file' },
      { name: 'billing.ts', type: 'file' },
      { name: 'retry.ts', type: 'file' },
      { name: 'index.ts', type: 'file' },
      { name: 'types.ts', type: 'file' },
    ]},
    { name: 'tests', type: 'dir', children: [
      { name: 'charge-handler.test.ts', type: 'file' },
      { name: 'retry.test.ts', type: 'file' },
    ]},
    { name: '.env.example', type: 'file' },
    { name: 'package.json', type: 'file' },
    { name: 'tsconfig.json', type: 'file' },
    { name: 'README.md', type: 'file' },
  ],
  'design-system': [
    { name: 'src', type: 'dir', children: [
      { name: 'components', type: 'dir', children: [
        { name: 'Button.tsx', type: 'file' },
        { name: 'Input.tsx', type: 'file' },
        { name: 'Modal.tsx', type: 'file' },
      ]},
      { name: 'tokens', type: 'dir', children: [
        { name: 'colors.ts', type: 'file' },
        { name: 'spacing.ts', type: 'file' },
      ]},
      { name: 'index.ts', type: 'file' },
    ]},
    { name: 'package.json', type: 'file' },
    { name: 'README.md', type: 'file' },
  ],
  'growth-dash': [
    { name: 'app', type: 'dir', children: [
      { name: 'api', type: 'dir', children: [
        { name: 'cohorts.ts', type: 'file' },
        { name: 'metrics.ts', type: 'file' },
      ]},
      { name: 'pages', type: 'dir', children: [
        { name: 'dashboard.tsx', type: 'file' },
        { name: 'cohorts.tsx', type: 'file' },
      ]},
    ]},
    { name: 'sql', type: 'dir', children: [
      { name: 'cohort_query.sql', type: 'file' },
      { name: 'retention.sql', type: 'file' },
    ]},
    { name: 'package.json', type: 'file' },
    { name: 'README.md', type: 'file' },
  ],
  'infra': [
    { name: 'terraform', type: 'dir', children: [
      { name: 'main.tf', type: 'file' },
      { name: 'variables.tf', type: 'file' },
      { name: 'outputs.tf', type: 'file' },
    ]},
    { name: 'k8s', type: 'dir', children: [
      { name: 'deployment.yaml', type: 'file' },
      { name: 'service.yaml', type: 'file' },
    ]},
    { name: 'scripts', type: 'dir', children: [
      { name: 'deploy.sh', type: 'file' },
      { name: 'rollback.sh', type: 'file' },
    ]},
    { name: 'README.md', type: 'file' },
  ],
}

const DEFAULT_TREE: FileNode[] = [
  { name: 'src', type: 'dir', children: [
    { name: 'index.ts', type: 'file' },
    { name: 'main.ts', type: 'file' },
  ]},
  { name: 'package.json', type: 'file' },
  { name: 'README.md', type: 'file' },
]

function getExt(name: string): string {
  return name.includes('.') ? name.split('.').pop()! : ''
}

function FileIcon({ name }: { name: string }) {
  const ext = getExt(name)
  const color =
    ['ts', 'tsx'].includes(ext) ? '#3b82f6' :
    ['js', 'jsx'].includes(ext) ? '#f59e0b' :
    ext === 'json' ? '#10b981' :
    ext === 'md' ? '#a78bfa' :
    ['yaml', 'yml'].includes(ext) ? '#f97316' :
    ext === 'sql' ? '#06b6d4' :
    ['sh', 'bash'].includes(ext) ? '#84cc16' :
    ext === 'tf' ? '#8b5cf6' :
    'var(--fg-3)'

  return <IFile style={{ width: 11, height: 13, flexShrink: 0, color }} />
}

// ── Live FileTree (fetched from /api/browse) ──────────────────────────────────

interface LiveNode {
  name: string
  path: string
  isDir: boolean
  children?: LiveNode[]
  loaded?: boolean
}

function openInFinder(absPath: string) {
  fetch(`/api/open?path=${encodeURIComponent(absPath)}`)
}

function openWithApp(absPath: string, app: string) {
  fetch(`/api/open-with?path=${encodeURIComponent(absPath)}&app=${encodeURIComponent(app)}`)
}

// Module-level cache — fetched once per session
let _installedApps: Set<string> | null = null
async function fetchInstalledApps(): Promise<Set<string>> {
  if (_installedApps) return _installedApps
  try {
    const r = await fetch('/api/installed-apps')
    const d = await r.json() as { apps: string[] }
    _installedApps = new Set(d.apps)
  } catch { _installedApps = new Set() }
  return _installedApps
}

const OPEN_WITH: Record<string, string[]> = {
  ts:   ['Visual Studio Code', 'Cursor', 'Zed'],
  tsx:  ['Visual Studio Code', 'Cursor', 'Zed'],
  js:   ['Visual Studio Code', 'Cursor', 'Zed'],
  jsx:  ['Visual Studio Code', 'Cursor', 'Zed'],
  json: ['Visual Studio Code', 'Cursor', 'BBEdit'],
  md:   ['Typora', 'BBEdit', 'Visual Studio Code'],
  txt:  ['BBEdit', 'TextEdit', 'Visual Studio Code'],
  pdf:  ['Preview', 'Adobe Acrobat Reader'],
  png:  ['Preview', 'Pixelmator Pro', 'Acorn'],
  jpg:  ['Preview', 'Pixelmator Pro', 'Acorn'],
  jpeg: ['Preview', 'Pixelmator Pro', 'Acorn'],
  gif:  ['Preview', 'Pixelmator Pro'],
  svg:  ['Visual Studio Code', 'Sketch', 'Affinity Designer 2'],
  sh:   ['Visual Studio Code', 'Terminal'],
  py:   ['Visual Studio Code', 'PyCharm'],
  rb:   ['Visual Studio Code', 'RubyMine'],
  sql:  ['TablePlus', 'Visual Studio Code', 'DBngin'],
  yaml: ['Visual Studio Code', 'Cursor'],
  yml:  ['Visual Studio Code', 'Cursor'],
  tf:   ['Visual Studio Code', 'Cursor'],
  csv:  ['Numbers', 'Microsoft Excel', 'TablePlus'],
}

function LiveTreeNode({ node, depth, installedApps }: { node: LiveNode; depth: number; installedApps: Set<string> | null }) {
  const [open, setOpen]           = useState(depth <= 1)
  const [children, setChildren]   = useState<LiveNode[]>(node.children ?? [])
  const [loaded, setLoaded]       = useState(node.loaded ?? false)
  const [flash, setFlash]         = useState(false)
  const [menu, setMenu]           = useState<{ x: number; y: number } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const indent = depth * 14 + 6

  // Close context menu on outside click
  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [menu])

  const loadChildren = (force = false) => {
    if (loaded && !force) return
    fetch(`/api/browse?path=${encodeURIComponent(node.path)}`)
      .then(r => r.json())
      .then(data => {
        const items: LiveNode[] = (data.items ?? []).filter((i: LiveNode) => i.name !== '..')
        setChildren(items)
        setLoaded(true)
      })
  }

  // Auto-load when a dir starts open
  useEffect(() => {
    if (node.isDir && open && !loaded) {
      loadChildren()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reload when a child was deleted
  useEffect(() => {
    if (!node.isDir) return
    const handler = (e: Event) => {
      const parentDir = (e as CustomEvent<string>).detail
      if (parentDir === node.path) loadChildren(true)
    }
    window.addEventListener('cc:fs-deleted', handler)
    return () => window.removeEventListener('cc:fs-deleted', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.path, node.isDir])

  const handleClick = () => {
    if (node.isDir) {
      if (!open) loadChildren()
      setOpen(o => !o)
    } else {
      setFlash(true)
      setTimeout(() => setFlash(false), 600)
      openInFinder(node.path)
    }
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (node.isDir) {
      e.stopPropagation()
      setFlash(true)
      setTimeout(() => setFlash(false), 600)
      openInFinder(node.path)
    }
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setMenu({ x: e.clientX, y: e.clientY })
  }

  const createItem = async (type: 'file' | 'dir') => {
    const parentDir = node.isDir ? node.path : node.path.split('/').slice(0, -1).join('/')
    const label = type === 'file' ? 'Dateiname:' : 'Ordnername:'
    const name = window.prompt(label)
    if (!name?.trim()) return
    const target = parentDir + '/' + name.trim()
    const r = await fetch('/api/fs-create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: target, type }),
    })
    const d = await r.json() as { ok: boolean; error?: string }
    if (d.ok) { loadChildren(true); if (!open) setOpen(true) }
    else alert(`Fehler: ${d.error}`)
  }

  return (
    <div>
      <div
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        title={node.isDir ? `Klick: auf-/zuklappen · Doppelklick: in Finder öffnen` : `Open ${node.name} in default app`}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: `3px 8px 3px ${indent}px`,
          cursor: 'pointer', userSelect: 'none', borderRadius: 6,
          background: flash ? 'var(--accent-soft)' : 'transparent',
          color: flash ? 'var(--accent)' : 'var(--fg-1)',
          transition: 'background 0.2s',
        }}
      >
        {node.isDir
          ? <IChev style={{ color: 'var(--fg-3)', transform: open ? 'rotate(90deg)' : 'none', flexShrink: 0, width: 9, height: 9, transition: 'transform 0.12s' }} />
          : <span style={{ width: 9, flexShrink: 0 }} />
        }
        {node.isDir
          ? (open ? <IFolderOpen style={{ color: 'var(--accent)', flexShrink: 0 }} /> : <IFolder style={{ color: 'var(--fg-3)', flexShrink: 0 }} />)
          : <FileIcon name={node.name} />
        }
        <span style={{ fontSize: 11.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {node.name}
        </span>
      </div>

      {/* Context menu */}
      {menu && (
        <div
          onClick={e => e.stopPropagation()}
          style={{ position: 'fixed', left: menu.x, top: menu.y, zIndex: 999, background: 'var(--bg-1)', border: '1px solid var(--line-strong)', borderRadius: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.3)', minWidth: 180, overflow: 'hidden', padding: '3px 0' }}
        >
          <CtxItem
            label="In Finder öffnen"
            icon={<IFolderOpen style={{ color: 'var(--fg-2)', flexShrink: 0 }} />}
            onClick={() => { openInFinder(node.path); setMenu(null) }}
          />
          {!node.isDir && (
            <CtxItem
              label="Im Data Viewer öffnen"
              icon={<IFile style={{ color: 'var(--fg-2)', flexShrink: 0 }} />}
              onClick={() => {
                window.dispatchEvent(new CustomEvent('cc:open-data-file', { detail: node.path }))
                setMenu(null)
              }}
            />
          )}
          {!node.isDir && (
            <CtxItem
              label="In Tab öffnen"
              icon={<ITable style={{ width: 11, height: 11, color: 'var(--fg-2)', flexShrink: 0 }} />}
              onClick={() => {
                window.dispatchEvent(new CustomEvent('cc:open-file-tab', { detail: node.path }))
                setMenu(null)
              }}
            />
          )}
          {/* New file / folder — always shown */}
          <div style={{ height: 1, background: 'var(--line)', margin: '3px 0' }} />
          <CtxItem
            label="Neue Datei…"
            icon={<IFilePlus style={{ width: 11, height: 11, color: 'var(--fg-2)', flexShrink: 0 }} />}
            onClick={() => { createItem('file'); setMenu(null) }}
          />
          <CtxItem
            label="Neuer Ordner…"
            icon={<IFolder style={{ color: 'var(--fg-2)', flexShrink: 0 }} />}
            onClick={() => { createItem('dir'); setMenu(null) }}
          />
          {/* Copy path / name */}
          <div style={{ height: 1, background: 'var(--line)', margin: '3px 0' }} />
          <CtxItem
            label="Pfad kopieren"
            icon={<ICopy style={{ width: 11, height: 11, color: 'var(--fg-2)', flexShrink: 0 }} />}
            onClick={() => { navigator.clipboard.writeText(node.path); setMenu(null) }}
          />
          <CtxItem
            label="Name kopieren"
            icon={<ICopy style={{ width: 11, height: 11, color: 'var(--fg-2)', flexShrink: 0 }} />}
            onClick={() => { navigator.clipboard.writeText(node.name); setMenu(null) }}
          />
          {/* Öffnen mit — files only, based on extension, filtered to installed apps */}
          {!node.isDir && (() => {
            const ext = node.name.includes('.') ? node.name.split('.').pop()!.toLowerCase() : ''
            const all = OPEN_WITH[ext] ?? []
            const apps = installedApps ? all.filter(a => installedApps.has(a)) : all
            if (apps.length === 0) return null
            return (
              <>
                <div style={{ height: 1, background: 'var(--line)', margin: '3px 0' }} />
                <div style={{ padding: '3px 12px 2px', fontSize: 9.5, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: 0.5, userSelect: 'none' }}>Öffnen mit</div>
                {apps.map(app => (
                  <CtxItem
                    key={app}
                    label={app}
                    icon={<IExternalLink style={{ width: 11, height: 11, color: 'var(--fg-2)', flexShrink: 0 }} />}
                    onClick={() => { openWithApp(node.path, app); setMenu(null) }}
                  />
                ))}
              </>
            )
          })()}
          {/* Delete */}
          <div style={{ height: 1, background: 'var(--line)', margin: '3px 0' }} />
          <CtxItem
            label="Löschen…"
            danger
            icon={<ITrash style={{ width: 11, height: 11, flexShrink: 0 }} />}
            onClick={() => { setDeleteTarget(node.path); setMenu(null) }}
          />
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <DeleteModal
          path={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onDeleted={() => {
            setDeleteTarget(null)
            const parentDir = node.path.split('/').slice(0, -1).join('/')
            window.dispatchEvent(new CustomEvent('cc:fs-deleted', { detail: parentDir }))
          }}
        />
      )}

      {node.isDir && open && children.map(child => (
        <LiveTreeNode key={child.path} node={child} depth={depth + 1} installedApps={installedApps} />
      ))}
    </div>
  )
}

// ── Delete confirm modal ──────────────────────────────────────────────────────

function GitInfoBar({ projectPath }: { projectPath?: string }) {
  const [branch, setBranch] = useState('')
  const [lastCommit, setLastCommit] = useState('')
  useEffect(() => {
    if (!projectPath) return
    fetch(`/api/git?path=${encodeURIComponent(projectPath)}`)
      .then(r => r.json())
      .then((d: { ok?: boolean; hasGit?: boolean; status?: { branch?: string }[]; lastCommit?: string }) => {
        if (!d.ok && !d.hasGit) return
        setBranch(d.status?.[0]?.branch ?? '')
        setLastCommit(d.lastCommit ?? '')
      })
      .catch(() => {})
  }, [projectPath])

  if (!branch) return null
  return (
    <div style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0, justifyContent: 'flex-end' }}>
      {lastCommit && <span style={{ fontSize: 10, color: 'var(--fg-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{lastCommit}</span>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 6, background: 'var(--bg-2)', border: '1px solid var(--line)', flexShrink: 0 }}>
        <IGitFork style={{ color: 'var(--accent)', flexShrink: 0 }} />
        <span className="mono" style={{ fontSize: 11, color: 'var(--fg-0)' }}>{branch}</span>
      </div>
    </div>
  )
}

function DeleteModal({ path, onCancel, onDeleted }: { path: string; onCancel: () => void; onDeleted: () => void }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr]   = useState('')
  const name = path.split('/').pop() ?? path

  const doDelete = async () => {
    setBusy(true)
    try {
      const r = await fetch('/api/fs-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      })
      const d = await r.json() as { ok: boolean; error?: string }
      if (d.ok) onDeleted()
      else { setErr(d.error ?? 'Fehler'); setBusy(false) }
    } catch (e) { setErr(String(e)); setBusy(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)' }}
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div style={{ background: 'var(--bg-1)', border: '1px solid var(--line-strong)', borderRadius: 6, boxShadow: '0 16px 48px rgba(0,0,0,0.4)', width: 380, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span style={{ width: 32, height: 32, borderRadius: 6, background: 'var(--danger-soft)', border: '1px solid var(--danger-line)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ITrash style={{ width: 15, height: 15, color: 'var(--danger)' }} />
          </span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-0)' }}>Löschen bestätigen</div>
            <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 1 }}>Diese Aktion kann nicht rückgängig gemacht werden.</div>
          </div>
        </div>
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6, padding: '8px 12px', marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: 'var(--fg-3)', marginBottom: 2 }}>Zu löschen:</div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--fg-0)', wordBreak: 'break-all' }}>{name}</div>
          <div className="mono" style={{ fontSize: 9.5, color: 'var(--fg-3)', marginTop: 2, wordBreak: 'break-all' }}>{path}</div>
        </div>
        {err && <div style={{ fontSize: 11, color: 'var(--err)', marginBottom: 10 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ background: 'transparent', border: '1px solid var(--line-strong)', borderRadius: 6, padding: '6px 14px', color: 'var(--fg-1)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-ui)' }}>
            Abbrechen
          </button>
          <button onClick={doDelete} disabled={busy} style={{ background: 'var(--danger)', border: 'none', borderRadius: 6, padding: '6px 14px', color: '#fff', fontSize: 12, fontWeight: 600, cursor: busy ? 'wait' : 'pointer', fontFamily: 'var(--font-ui)', opacity: busy ? 0.7 : 1 }}>
            {busy ? 'Lösche…' : 'Löschen'}
          </button>
        </div>
      </div>
    </div>
  )
}

function CtxItem({ label, icon, onClick, danger }: { label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 12px', cursor: 'pointer', fontSize: 11.5, color: danger ? 'var(--danger)' : 'var(--fg-0)', background: hov ? (danger ? 'var(--danger-soft)' : 'var(--accent-soft)') : 'transparent', userSelect: 'none' }}
    >
      {icon}
      {label}
    </div>
  )
}

function FilesTab({ projectPath }: { projectName: string; projectPath: string }) {
  const [root, setRoot]       = useState<LiveNode | null>(null)
  const [error, setError]     = useState('')
  const [notFound, setNotFound] = useState(false)
  const [installedApps, setInstalledApps] = useState<Set<string> | null>(null)

  useEffect(() => {
    fetchInstalledApps().then(setInstalledApps)
  }, [])

  const loadRoot = (reset = false) => {
    if (reset) { setRoot(null); setError(''); setNotFound(false) }
    fetch(`/api/browse?path=${encodeURIComponent(projectPath)}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setNotFound(true); return }
        const folderName = projectPath.split('/').pop() ?? projectPath
        const children: LiveNode[] = (data.items ?? []).filter((i: LiveNode) => i.name !== '..')
        setRoot({ name: folderName, path: data.currentPath ?? projectPath, isDir: true, children, loaded: true })
      })
      .catch(e => setError(String(e)))
  }

  useEffect(() => {
    loadRoot(true)
    const iv = setInterval(() => loadRoot(false), 3000)
    return () => clearInterval(iv)
  }, [projectPath])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header — click to open root in Finder */}
      <div
        onClick={() => openInFinder(root?.path ?? projectPath)}
        title="Open project folder in Finder"
        style={{ padding: '6px 10px', borderBottom: '1px solid var(--line)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
      >
        <IFolderOpen style={{ color: 'var(--accent)', flexShrink: 0 }} />
        <span className="mono" style={{ fontSize: 10, color: 'var(--fg-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{root?.path ?? projectPath}</span>
      </div>

      {/* Tree */}
      <div style={{ flex: 1, overflowY: 'auto', paddingTop: 4, paddingBottom: 8 }}>
        {error && (
          <div style={{ padding: '10px 12px', color: 'var(--err)', fontSize: 11 }}>{error}</div>
        )}
        {notFound && (
          <div style={{ padding: '12px 14px', color: 'var(--fg-3)', fontSize: 11, lineHeight: 1.6 }}>
            <div style={{ color: 'var(--warn)', fontWeight: 600, marginBottom: 4 }}>Ordner nicht gefunden</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-3)', wordBreak: 'break-all', marginBottom: 6 }}>{projectPath}</div>
            <div>Erstelle den Workspace mit einem echten Pfad oder stelle sicher, dass der Ordner existiert.</div>
          </div>
        )}
        {!error && !notFound && !root && (
          <div style={{ padding: 12, color: 'var(--fg-3)', fontSize: 11 }}>Lade…</div>
        )}
        {root && <LiveTreeNode node={root} depth={0} installedApps={installedApps} />}
      </div>

    </div>
  )
}

// ── Shared git state (module-level cache, shared between GitHubTab + CompactGitCard) ──

type GhStatus = 'synced' | 'dirty' | 'error' | 'loading'

interface GhCacheEntry { data: GhDataShared; status: GhStatus; ts: number }
interface GhDataShared {
  hasGit: boolean; branch: string; remote: string | null
  files: Array<{ flag: string; file: string }>
  branches: Array<{ name: string; current: boolean }>
  log: Array<{ hash: string; msg: string; when: string }>
  added: number; removed: number
}

function parseDiffStat(diffStat: string): { added: number; removed: number } {
  const a = parseInt(diffStat.match(/(\d+) insertion/)?.[1] ?? '0')
  const r = parseInt(diffStat.match(/(\d+) deletion/)?.[1] ?? '0')
  return { added: a, removed: r }
}

const _gitCache  = new Map<string, GhCacheEntry>()
const _gitSubs   = new Map<string, Set<() => void>>()

function _gitSubscribe(path: string, fn: () => void) {
  if (!_gitSubs.has(path)) _gitSubs.set(path, new Set())
  _gitSubs.get(path)!.add(fn)
  return () => { _gitSubs.get(path)?.delete(fn) }
}

function _gitInvalidate(path: string) {
  _gitCache.delete(path)
  _gitSubs.get(path)?.forEach(fn => fn())
}

function _flagColor(f: string) {
  return f === 'M' || f === ' M' || f === 'MM' ? 'var(--ok)' : f.includes('A') || f === '??' ? 'var(--warn)' : f.includes('D') ? 'var(--err)' : 'var(--fg-2)'
}
function _flagLabel(f: string) {
  return f.trim().startsWith('A') || f === '??' ? '+' : f.includes('D') ? '−' : 'M'
}

// ── GitHub tab (non-developer friendly) ──────────────────────────────────────

function humanGitError(raw: string): string {
  if (raw.includes('Authentication failed') || raw.includes('could not read Username')) return 'GitHub hat den Zugang abgelehnt. Prüfe deinen Zugangsschlüssel in den Einstellungen.'
  if (raw.includes('Could not resolve host') || raw.includes('Network is unreachable')) return 'Keine Internetverbindung. Versuche es später nochmal.'
  if (raw.includes('Your branch is behind')) return 'Es gibt neuere Updates online. Hole sie zuerst.'
  if (raw.includes('nothing to commit')) return 'Es gibt nichts zum Speichern. Alles ist aktuell.'
  if (raw.includes('permission denied') || raw.includes('Permission denied')) return 'Keine Berechtigung. Hast du Schreibzugriff auf das Projekt?'
  if (raw.includes('merge conflict') || raw.includes('CONFLICT')) return 'Es gibt einen Konflikt mit den Online-Updates. Bitte löse ihn manuell.'
  if (raw.includes('not a git repository')) return 'Dieser Ordner ist noch nicht eingerichtet.'
  return raw.slice(0, 140)
}

type GhFileInfo = { flag: string; file: string }
type GhBranch   = { name: string; current: boolean }
type GhCommit   = { hash: string; msg: string; when: string }
type GhData     = GhDataShared

type ReviewType = 'general' | 'security' | 'performance' | 'style'
type ReviewFinding = { severity: 'info' | 'warn' | 'error'; line?: number; title: string; advice: string; suggestion?: string }

// ── Diff types + parser ───────────────────────────────────────────────────────

type DiffSide = { lineNo: number | null; text: string; type: 'context' | 'added' | 'removed' | 'empty' }
type DiffRow  = { left: DiffSide; right: DiffSide; hunkHeader?: string }

function parseDiff(raw: string): DiffRow[] {
  const rows: DiffRow[] = []
  let leftNo = 0, rightNo = 0
  const pendL: string[] = [], pendR: string[] = []

  function flush() {
    const len = Math.max(pendL.length, pendR.length)
    for (let i = 0; i < len; i++) {
      rows.push({
        left:  pendL[i] !== undefined ? { lineNo: ++leftNo,  text: pendL[i], type: 'removed' } : { lineNo: null, text: '', type: 'empty' },
        right: pendR[i] !== undefined ? { lineNo: ++rightNo, text: pendR[i], type: 'added'   } : { lineNo: null, text: '', type: 'empty' },
      })
    }
    pendL.length = 0; pendR.length = 0
  }

  for (const line of raw.split('\n')) {
    if (/^(diff |index |--- |[+]{3} |Binary )/.test(line)) continue
    if (line.startsWith('@@')) {
      flush()
      const m = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
      if (m) { leftNo = parseInt(m[1]) - 1; rightNo = parseInt(m[2]) - 1 }
      rows.push({ hunkHeader: line, left: { lineNo: null, text: line, type: 'context' }, right: { lineNo: null, text: '', type: 'context' } })
      continue
    }
    if (line.startsWith('-')) { pendL.push(line.slice(1)); continue }
    if (line.startsWith('+')) { pendR.push(line.slice(1)); continue }
    flush()
    rows.push({
      left:  { lineNo: ++leftNo,  text: line.startsWith(' ') ? line.slice(1) : line, type: 'context' },
      right: { lineNo: ++rightNo, text: line.startsWith(' ') ? line.slice(1) : line, type: 'context' },
    })
  }
  flush()
  return rows
}

// ── Diff Modal ────────────────────────────────────────────────────────────────

function DiffModal({ projectPath, files, initialFile, onClose, readOnly = false, onOpenReview, onDiscard }: {
  projectPath: string; files: GhFileInfo[]; initialFile: string; onClose: () => void
  readOnly?: boolean; onOpenReview: (file: string) => void; onDiscard: (file: string) => void
}) {
  const [selFile,         setSelFile]         = useState(initialFile || (files[0]?.file ?? ''))
  const [mode,            setMode]            = useState<'side' | 'inline'>('side')
  const [rows,            setRows]            = useState<DiffRow[]>([])
  const [loading,         setLoading]         = useState(false)
  const [confirmDiscard,  setConfirmDiscard]  = useState(false)

  const fileIdx = files.findIndex(f => f.file === selFile)
  const curFile = files[fileIdx]

  const loadDiff = useCallback((file: string) => {
    if (!file) return
    setLoading(true); setRows([]); setConfirmDiscard(false)
    fetch(`/api/git-diff?path=${encodeURIComponent(projectPath)}&file=${encodeURIComponent(file)}`)
      .then(r => r.json())
      .then((d: { ok: boolean; diff: string }) => setRows(parseDiff(d.diff ?? '')))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [projectPath])

  useEffect(() => { loadDiff(selFile) }, [selFile, loadDiff])

  useEffect(() => {
    if (!files.find(f => f.file === selFile) && files.length > 0) setSelFile(files[0].file)
    else if (files.length === 0) onClose()
  }, [files, selFile, onClose])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowLeft'  && fileIdx > 0)              setSelFile(files[fileIdx - 1].file)
      if (e.key === 'ArrowRight' && fileIdx < files.length - 1) setSelFile(files[fileIdx + 1].file)
      if (e.key === 'Tab') { e.preventDefault(); setMode(m => m === 'side' ? 'inline' : 'side') }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [files, fileIdx, onClose])

  const stats = rows.reduce((a, r) => {
    if (r.right.type === 'added')   a.added++
    if (r.left.type === 'removed')  a.removed++
    return a
  }, { added: 0, removed: 0 })

  const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 11.5 }
  const LINE_H = 20

  function sideColor(t: DiffSide['type']) { return t === 'removed' ? 'var(--err)' : t === 'added' ? 'var(--ok)' : 'var(--fg-3)' }
  function sideBg(t: DiffSide['type'])    { return t === 'removed' ? 'rgba(226,75,74,0.12)' : t === 'added' ? 'rgba(125,201,125,0.12)' : t === 'empty' ? 'var(--bg-3)' : 'transparent' }

  function SideLine({ side }: { side: DiffSide }) {
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', background: sideBg(side.type), minHeight: LINE_H, lineHeight: `${LINE_H}px` }}>
        <span style={{ display: 'inline-block', width: 36, textAlign: 'right', paddingRight: 8, flexShrink: 0, userSelect: 'none', color: sideColor(side.type), fontSize: 10.5 }}>
          {side.lineNo ?? '·'}
        </span>
        <span style={{ ...MONO, color: side.type === 'empty' ? '#555' : 'var(--fg-1)', whiteSpace: 'pre', overflow: 'hidden', flex: 1, textOverflow: 'ellipsis' }}>
          {side.type === 'empty' ? '—' : side.text}
        </span>
      </div>
    )
  }

  const HUNK_ROW: React.CSSProperties = { padding: '3px 12px', background: 'var(--bg-3)', color: 'var(--fg-3)', fontSize: 10.5, borderTop: 'var(--line)', borderBottom: 'var(--line)' }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
    <div style={{ width: '89%', height: '89%', display: 'flex', flexDirection: 'column', background: 'var(--bg-0)', borderRadius: 12, overflow: 'hidden', border: '0.5px solid var(--line-strong)', boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: 'var(--line-strong)', background: 'var(--bg-1)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <IGitFork style={{ width: 14, height: 14, color: 'var(--accent)', flexShrink: 0 }} />
          <span style={{ fontWeight: 500, fontSize: 13 }}>{readOnly ? 'Speicherpunkt' : 'Vergleich anzeigen'}</span>
          <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>·</span>
          <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>{files.length} Datei{files.length !== 1 ? 'en' : ''} geändert</span>
          {stats.added + stats.removed > 0 && (
            <span style={{ fontSize: 11 }}>
              <span style={{ color: 'var(--ok)' }}>+{stats.added}</span>
              {' '}
              <span style={{ color: 'var(--err)' }}>−{stats.removed}</span>
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', background: 'var(--bg-3)', borderRadius: 6, padding: 2 }}>
            {(['side', 'inline'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 4, border: 'none', cursor: 'pointer', background: mode === m ? 'rgba(255,138,76,0.2)' : 'transparent', color: mode === m ? 'var(--accent)' : 'var(--fg-3)', fontFamily: 'var(--font-ui)' }}>
                {m === 'side' ? 'Nebeneinander' : 'Inline'}
              </button>
            ))}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--fg-3)', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
            <IClose style={{ width: 14, height: 14 }} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '200px 1fr', overflow: 'hidden' }}>

        {/* Sidebar */}
        <div style={{ borderRight: 'var(--line-strong)', background: 'var(--bg-1)', overflowY: 'auto', padding: '10px 0' }}>
          <div style={{ fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: 0.5, padding: '0 12px 8px' }}>Dateien</div>
          {files.map(f => {
            const active = f.file === selFile
            const isNew  = f.flag === '??' || f.flag.trim().startsWith('A')
            return (
              <div key={f.file} onClick={() => setSelFile(f.file)} title={f.file}
                style={{ padding: '6px 10px', background: active ? 'rgba(255,138,76,0.1)' : 'transparent', borderLeft: `2px solid ${active ? 'var(--accent)' : 'transparent'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, overflow: 'hidden' }}>
                <span style={{ fontSize: 10, fontWeight: 600, flexShrink: 0, color: isNew ? 'var(--accent)' : _flagColor(f.flag), background: isNew ? 'rgba(255,138,76,0.15)' : `${_flagColor(f.flag)}22`, borderRadius: 3, padding: '1px 4px', lineHeight: 1.4, ...MONO }}>
                  {isNew ? 'A' : f.flag.trim()[0] ?? 'M'}
                </span>
                <span style={{ ...MONO, fontSize: 11, color: active ? 'var(--accent)' : 'var(--fg-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {f.file.split('/').pop()}
                </span>
              </div>
            )
          })}
        </div>

        {/* Diff area */}
        <div style={{ overflow: 'auto', display: 'flex', flexDirection: 'column', background: 'var(--bg-0)' }}>
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--fg-3)', fontSize: 12, gap: 8 }}>
              <ISpinner style={{ width: 14, height: 14 }} /> Wird geladen…
            </div>
          )}

          {!loading && rows.length === 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--fg-3)', fontSize: 12 }}>Kein Diff verfügbar</div>
          )}

          {!loading && rows.length > 0 && mode === 'side' && (
            <>
              {/* Column labels */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: 'var(--line-strong)', background: 'var(--bg-2)', flexShrink: 0 }}>
                <div style={{ padding: '7px 12px', fontSize: 10.5, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: 0.5, borderRight: 'var(--line)', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <IHistoryClock style={{ width: 11, height: 11 }} /> Vorher
                </div>
                <div style={{ padding: '7px 12px', fontSize: 10.5, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <ISpark style={{ width: 11, height: 11 }} /> Nachher (deine Änderungen)
                </div>
              </div>
              {/* Rows */}
              <div style={{ ...MONO, display: 'grid', gridTemplateColumns: '1fr 1fr', flex: 1 }}>
                {rows.map((row, i) =>
                  row.hunkHeader
                    ? <div key={i} style={{ gridColumn: '1 / -1', ...HUNK_ROW }}>{row.hunkHeader}</div>
                    : (
                      <React.Fragment key={i}>
                        <div style={{ borderRight: 'var(--line)', overflow: 'hidden', minWidth: 0 }}><SideLine side={row.left} /></div>
                        <div style={{ overflow: 'hidden', minWidth: 0 }}><SideLine side={row.right} /></div>
                      </React.Fragment>
                    )
                )}
              </div>
            </>
          )}

          {!loading && rows.length > 0 && mode === 'inline' && (
            <div style={{ ...MONO, flex: 1 }}>
              {rows.map((row, i) => {
                if (row.hunkHeader) return <div key={i} style={HUNK_ROW}>{row.hunkHeader}</div>
                return (
                  <React.Fragment key={i}>
                    {row.left.type === 'removed' && (
                      <div style={{ display: 'flex', background: 'rgba(226,75,74,0.12)', minHeight: LINE_H, lineHeight: `${LINE_H}px` }}>
                        <span style={{ width: 36, textAlign: 'right', paddingRight: 8, color: 'var(--err)', fontSize: 10.5, flexShrink: 0, userSelect: 'none' }}>{row.left.lineNo}</span>
                        <span style={{ color: 'var(--err)', paddingRight: 8, flexShrink: 0, userSelect: 'none' }}>−</span>
                        <span style={{ color: 'var(--fg-1)', whiteSpace: 'pre' }}>{row.left.text}</span>
                      </div>
                    )}
                    {row.right.type === 'added' && (
                      <div style={{ display: 'flex', background: 'rgba(125,201,125,0.12)', minHeight: LINE_H, lineHeight: `${LINE_H}px` }}>
                        <span style={{ width: 36, textAlign: 'right', paddingRight: 8, color: 'var(--ok)', fontSize: 10.5, flexShrink: 0, userSelect: 'none' }}>{row.right.lineNo}</span>
                        <span style={{ color: 'var(--ok)', paddingRight: 8, flexShrink: 0, userSelect: 'none' }}>+</span>
                        <span style={{ color: 'var(--fg-1)', whiteSpace: 'pre' }}>{row.right.text}</span>
                      </div>
                    )}
                    {row.left.type === 'context' && row.left.lineNo !== null && (
                      <div style={{ display: 'flex', minHeight: LINE_H, lineHeight: `${LINE_H}px` }}>
                        <span style={{ width: 36, textAlign: 'right', paddingRight: 8, color: 'var(--fg-3)', fontSize: 10.5, flexShrink: 0, userSelect: 'none' }}>{row.left.lineNo}</span>
                        <span style={{ paddingRight: 8, flexShrink: 0, color: 'transparent', userSelect: 'none' }}>·</span>
                        <span style={{ color: 'var(--fg-2)', whiteSpace: 'pre' }}>{row.left.text}</span>
                      </div>
                    )}
                  </React.Fragment>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px', borderTop: 'var(--line-strong)', background: 'var(--bg-1)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--fg-3)' }}>
          <IKeyboard style={{ width: 12, height: 12, flexShrink: 0 }} />
          ← → zwischen Dateien · Esc schließen · Tab Ansicht wechseln
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {!readOnly && curFile && (
            confirmDiscard ? (
              <>
                <span style={{ fontSize: 11, color: 'var(--err)' }}>Wirklich verwerfen?</span>
                <button onClick={() => { onDiscard(selFile); setConfirmDiscard(false) }}
                  style={{ background: 'transparent', color: 'var(--err)', border: '0.5px solid rgba(226,75,74,0.4)', padding: '4px 10px', borderRadius: 5, fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-ui)' }}>
                  Ja, verwerfen
                </button>
                <button onClick={() => setConfirmDiscard(false)}
                  style={{ background: 'transparent', color: 'var(--fg-2)', border: 'var(--line-strong)', padding: '4px 10px', borderRadius: 5, fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-ui)' }}>
                  Abbrechen
                </button>
              </>
            ) : (
              <button onClick={() => setConfirmDiscard(true)}
                style={{ background: 'transparent', color: 'var(--err)', border: '0.5px solid rgba(226,75,74,0.4)', padding: '4px 10px', borderRadius: 5, fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-ui)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <IUndo style={{ width: 11, height: 11 }} /> Änderung verwerfen
              </button>
            )
          )}
          <button onClick={() => { onOpenReview(selFile); onClose() }}
            style={{ background: 'rgba(255,138,76,0.15)', color: 'var(--accent)', border: '0.5px solid rgba(255,138,76,0.3)', padding: '4px 10px', borderRadius: 5, fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-ui)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <ISpark style={{ width: 11, height: 11 }} /> KI-Review dieser Datei
          </button>
        </div>
      </div>
    </div>
    </div>
  )
}

const REVIEW_PROMPTS: Record<ReviewType, string> = {
  general:     'Du bist ein erfahrener Code-Reviewer. Prüfe den Code auf offensichtliche Bugs, fehlerhafte Logik, Tippfehler und Missverständnisse. Antworte ausschließlich als JSON: {"findings":[{"severity":"info|warn|error","line":0,"title":"...","advice":"...","suggestion":"..."}]}. Falls nichts zu beanstanden: {"findings":[]}.',
  security:    'Du bist Security-Reviewer. Suche nach SQL-Injection, XSS, unsicheren Auth-Mustern, exponierten Secrets, fehlender Eingabevalidierung, unsicheren Krypto-Aufrufen. Antworte ausschließlich als JSON: {"findings":[{"severity":"info|warn|error","line":0,"title":"...","advice":"...","suggestion":"..."}]}.',
  performance: 'Du bist Performance-Reviewer. Suche nach N+1 Queries, unnötigen Re-Renders, Speicherlecks, ineffizienten Algorithmen, blockierendem I/O. Antworte ausschließlich als JSON: {"findings":[{"severity":"info|warn|error","line":0,"title":"...","advice":"...","suggestion":"..."}]}.',
  style:       'Du bist Code-Style-Reviewer. Prüfe Lesbarkeit, Benennung, Funktionslänge, Magic Numbers, fehlende Typen, inkonsistente Konventionen. Antworte ausschließlich als JSON: {"findings":[{"severity":"info|warn|error","line":0,"title":"...","advice":"...","suggestion":"..."}]}.',
}

// ── Compact git card (Session tab) ───────────────────────────────────────────

function CompactGitCard({ projectPath, onOpenGitTab }: { projectPath: string; onOpenGitTab: () => void }) {
  const cached = _gitCache.get(projectPath)
  const [data,      setData]      = useState<GhData | null>(cached?.data ?? null)
  const [status,    setStatus]    = useState<GhStatus>(cached?.status ?? 'loading')
  const [open,      setOpen]      = useState(true)
  const [note,      setNote]      = useState('')
  const [busy,      setBusy]      = useState<'save' | 'pull' | null>(null)
  const [toast,     setToast]     = useState<{ msg: string; ok: boolean } | null>(null)
  const [diffOpen,  setDiffOpen]  = useState(false)
  const [diffFile,  setDiffFile]  = useState('')
  const [setupOpen, setSetupOpen] = useState(false)
  const { githubToken: _legacyGhToken, tokens: repoTokens, projects, theme: compactTheme } = useAppStore()
  // Use the first github.com entry from repoTokens; fall back to legacy store field for compat
  const githubToken = repoTokens.find(t => t.host === 'github.com')?.token || _legacyGhToken
  const projectName = projects.find(p => p.path === projectPath)?.name ?? ''

  const load = useCallback(() => {
    const c = _gitCache.get(projectPath)
    if (c && Date.now() - c.ts < 20_000) { setData(c.data); setStatus(c.status); return }
    fetch(`/api/git?path=${encodeURIComponent(projectPath)}`)
      .then(r => r.json())
      .then((d: { hasGit?: boolean; status?: GhFileInfo[]; branches?: GhBranch[]; log?: GhCommit[]; remotes?: string[]; diffStat?: string }) => {
        const files = (d.status ?? []).filter(f => f.flag !== '??')
        const branch = (d.branches ?? []).find(b => b.current)?.name ?? 'main'
        const remote = (d.remotes ?? [])[0] ?? null
        const { added, removed } = parseDiffStat(d.diffStat ?? '')
        const newData: GhData = { hasGit: d.hasGit ?? false, branch, remote, files, branches: d.branches ?? [], log: (d.log ?? []).slice(0, 10), added, removed }
        const newStatus: GhStatus = files.length > 0 ? 'dirty' : 'synced'
        _gitCache.set(projectPath, { data: newData, status: newStatus, ts: Date.now() })
        setData(newData); setStatus(newStatus)
      })
      .catch(() => setStatus('error'))
  }, [projectPath])

  useEffect(() => { load() }, [load])
  useEffect(() => _gitSubscribe(projectPath, load), [projectPath, load])

  // Cmd/Ctrl+S — trigger save
  const handleSaveRef = useRef<() => void>(() => {})
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); handleSaveRef.current() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const gitAction = (action: string, extra?: Record<string, string>) =>
    fetch('/api/git-action', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, path: projectPath, ...extra }),
    }).then(r => r.json()) as Promise<{ ok: boolean; out: string }>

  const showToast = (msg: string, ok: boolean) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000) }

  const handleSave = useCallback(async () => {
    if (!data || status !== 'dirty' || busy) return
    setBusy('save')
    try {
      const autoMsg = data.files.length > 0 ? `Änderungen an ${data.files.length} Datei${data.files.length > 1 ? 'en' : ''}` : 'Update'
      const r1 = await gitAction('stage')
      if (!r1.ok) { showToast(humanGitError(r1.out), false); return }
      const r2 = await gitAction('commit', { message: note.trim() || autoMsg })
      if (!r2.ok && !r2.out.includes('nothing to commit')) { showToast(humanGitError(r2.out), false); return }
      if (data.remote) {
        const r3 = await gitAction('push')
        if (!r3.ok) { showToast(humanGitError(r3.out), false); return }
      }
      setNote(''); showToast('Gespeichert ✓', true)
      _gitInvalidate(projectPath); load()
    } finally { setBusy(null) }
  }, [data, status, busy, note, projectPath])

  handleSaveRef.current = handleSave

  const handlePull = async () => {
    setBusy('pull')
    try {
      const r = await gitAction('pull')
      showToast(r.ok ? 'Updates geholt ✓' : humanGitError(r.out), r.ok)
      if (r.ok) { _gitInvalidate(projectPath); load() }
    } finally { setBusy(null) }
  }

  const handleDiscardFile = async (file: string) => {
    await fetch('/api/git-action', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'discard-file', path: projectPath, message: file }),
    })
    _gitInvalidate(projectPath); load()
  }

  const added   = data?.added   ?? 0
  const removed = data?.removed ?? 0
  const hasDiff = added > 0 || removed > 0
  const statusColor = status === 'synced' ? 'var(--ok)' : status === 'dirty' ? 'var(--warn)' : 'var(--err)'
  const borderColor = 'var(--line-strong)'

  return (
    <div style={{ marginBottom: 14 }}>
      {/* ── Section header — always visible ── */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none', paddingBottom: open ? 6 : 0 }}
      >
        <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--fg-3)', fontWeight: 500, flex: 1, display: 'flex', alignItems: 'center', gap: 5 }}>
          GitHub
          {/* status dot — right next to label */}
          {status !== 'loading' && (
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: statusColor, flexShrink: 0 }} />
          )}
        </span>

        {/* diff stats — always shown, grayed when 0 */}
        <span
          onClick={hasDiff ? e => { e.stopPropagation(); if (data?.files.length) { setDiffFile(data.files[0].file); setDiffOpen(true) } } : undefined}
          style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10.5, background: 'var(--bg-3)', border: 'var(--line-strong)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderRadius: 4, padding: '2px 6px', cursor: hasDiff ? 'pointer' : 'default', flexShrink: 0, transition: 'background 0.12s, border-color 0.12s' }}
          onMouseEnter={hasDiff ? e => { e.currentTarget.style.background = 'var(--bg-2)'; e.currentTarget.style.borderColor = 'var(--line-strong)' } : undefined}
          onMouseLeave={hasDiff ? e => { e.currentTarget.style.background = 'var(--bg-3)'; e.currentTarget.style.borderColor = 'var(--line)' } : undefined}
        >
          {status === 'loading'
            ? <span style={{ color: 'var(--fg-3)' }}>…</span>
            : <>
                <span style={{ color: hasDiff ? 'var(--ok)' : 'var(--fg-3)', fontWeight: hasDiff ? 600 : 400 }}>+{added}</span>
                <span style={{ color: hasDiff ? 'var(--err)' : 'var(--fg-3)', fontWeight: hasDiff ? 600 : 400 }}>−{removed}</span>
              </>
          }
        </span>

        {open
          ? <IChevUp   style={{ width: 11, height: 11, color: 'var(--fg-3)', flexShrink: 0 }} />
          : <IChevDown style={{ width: 11, height: 11, color: 'var(--fg-3)', flexShrink: 0 }} />
        }
      </div>

      {/* ── Section body — only when open ── */}
      {open && (
        <div style={{ background: 'var(--bg-2)', border: `0.5px solid ${borderColor}`, borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>

          {/* DiffModal */}
          {diffOpen && data && data.files.length > 0 && (
            <DiffModal
              projectPath={projectPath}
              files={data.files}
              initialFile={diffFile}
              onClose={() => setDiffOpen(false)}
              onOpenReview={() => { setDiffOpen(false); onOpenGitTab() }}
              onDiscard={handleDiscardFile}
            />
          )}

          {/* Toast */}
          {toast && (
            <div style={{ padding: '6px 12px', background: toast.ok ? 'rgba(125,201,125,0.12)' : 'rgba(226,75,74,0.12)', color: toast.ok ? 'var(--ok)' : 'var(--err)', fontSize: 11, borderBottom: `0.5px solid ${toast.ok ? 'rgba(125,201,125,0.2)' : 'rgba(226,75,74,0.2)'}` }}>
              {toast.msg}
            </div>
          )}

          {/* Loading */}
          {status === 'loading' && (
            <div style={{ padding: '14px 12px', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--fg-3)', fontSize: 11.5 }}>
              <ISpinner style={{ width: 13, height: 13 }} /> Lade…
            </div>
          )}

          {/* No git */}
          {status !== 'loading' && data !== null && !data.hasGit && (
            <div style={{ padding: '14px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--fg-2)', marginBottom: 10 }}>Noch kein Git-Projekt</div>
              <span onClick={() => setSetupOpen(true)} style={{ fontSize: 11, color: 'var(--accent)', cursor: 'pointer' }}>Einrichten →</span>
            </div>
          )}
          {setupOpen && (
            <GitSetupModal
              projectPath={projectPath}
              projectName={projectName}
              githubToken={githubToken}
              onClose={() => setSetupOpen(false)}
              onDone={() => { setSetupOpen(false); _gitInvalidate(projectPath); load() }}
            />
          )}

          {/* Synced */}
          {status === 'synced' && data?.hasGit && (
            <div style={{ padding: '10px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: data.log[0] ? 8 : 0 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: 'var(--fg-1)', flex: 1 }}>Alles gesichert</span>
                <span style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>{data.log[0]?.when ?? ''}</span>
              </div>
              {data.log[0] && (
                <div style={{ background: 'var(--card-bg)', borderRadius: 5, padding: '5px 8px', marginBottom: 8, fontSize: 11 }}>
                  <div style={{ color: 'var(--fg-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{data.log[0].msg}</div>
                  <div style={{ color: 'var(--fg-3)', fontSize: 10, marginTop: 1, fontFamily: 'var(--font-mono)' }}>{data.log[0].hash.slice(0, 7)}</div>
                </div>
              )}
              <button onClick={handlePull} disabled={!!busy} style={{ width: '100%', background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--accent-line)', padding: '7px', borderRadius: 6, fontSize: 11.5, cursor: busy ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'var(--font-ui)', opacity: busy ? 0.6 : 1 }}>
                {busy === 'pull' ? <ISpinner style={{ width: 12, height: 12 }} /> : <ICloudDownload style={{ width: 12, height: 12 }} />}
                Updates holen
              </button>
              <div style={{ textAlign: 'center', marginTop: 7 }}>
                <span onClick={onOpenGitTab} style={{ fontSize: 10.5, color: 'var(--fg-3)', cursor: 'pointer' }}>Alle Details →</span>
              </div>
            </div>
          )}

          {/* Dirty */}
          {status === 'dirty' && data?.hasGit && (
            <div style={{ padding: '10px 12px' }}>
              {/* File list */}
              {data.files.length > 0 && (
                <div style={{ borderRadius: 6, marginBottom: 8 }}>
                  {data.files.slice(0, 4).map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '4px 2px', borderBottom: i < Math.min(data.files.length, 4) - 1 ? '1px solid var(--line)' : 'none', fontSize: 11.5, fontFamily: 'var(--font-mono)', minWidth: 0 }}>
                      <span style={{ color: _flagColor(f.flag), marginRight: 6, fontWeight: 700, flexShrink: 0 }}>{_flagLabel(f.flag)}</span>
                      <span style={{ color: 'var(--fg-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{f.file}</span>
                      <IEye onClick={e => { e.stopPropagation(); setDiffFile(f.file); setDiffOpen(true) }} style={{ width: 11, height: 11, color: 'var(--fg-3)', flexShrink: 0, marginLeft: 6, cursor: 'pointer' }} />
                    </div>
                  ))}
                  {data.files.length > 4 && (
                    <div onClick={onOpenGitTab} style={{ padding: '4px 8px', fontSize: 10.5, color: 'var(--accent)', cursor: 'pointer', textAlign: 'center' }}>
                      + {data.files.length - 4} weitere →
                    </div>
                  )}
                </div>
              )}
              {/* Note */}
              <input
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Was hast du geändert? (optional)"
                style={{ width: '100%', padding: '6px 9px', border: '1px solid var(--line)', borderRadius: 6, background: 'var(--bg-2)', color: 'var(--fg-1)', fontSize: 11.5, fontFamily: 'var(--font-ui)', outline: 'none', marginBottom: 8, boxSizing: 'border-box' as const }}
              />
              {/* Buttons */}
              <div style={{ display: 'flex', gap: 5 }}>
                <button onClick={handleSave} disabled={!!busy} style={{ flex: 1, background: 'var(--accent)', color: '#fff', border: '1px solid var(--accent)', padding: 7, borderRadius: 6, fontWeight: 600, fontSize: 12, cursor: busy ? 'default' : 'pointer', fontFamily: 'var(--font-ui)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, opacity: busy ? 0.7 : 1 }}>
                  {busy === 'save' ? <ISpinner style={{ width: 12, height: 12 }} /> : <IArrowUpLine style={{ width: 13, height: 13, strokeWidth: 2.5 }} />}
                  {busy === 'save' ? 'Wird hochgeladen…' : 'Speichern & Hochladen'}
                </button>
                <button onClick={handlePull} disabled={!!busy} title="Updates holen" style={{ background: compactTheme === 'light' ? '#333333' : 'var(--fg-0)', color: 'var(--bg-0)', border: `1px solid ${compactTheme === 'light' ? '#333333' : 'var(--fg-0)'}`, padding: '7px 9px', borderRadius: 6, cursor: busy ? 'default' : 'pointer', display: 'flex', alignItems: 'center', opacity: busy ? 0.6 : 1 }}>
                  {busy === 'pull' ? <ISpinner style={{ width: 12, height: 12 }} /> : <IArrowDownLine style={{ width: 13, height: 13, strokeWidth: 2.5 }} />}
                </button>
              </div>
              <div style={{ textAlign: 'center', marginTop: 7 }}>
                <span onClick={onOpenGitTab} style={{ fontSize: 10.5, color: 'var(--fg-3)', cursor: 'pointer' }}>Alle Details →</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Git setup modal ───────────────────────────────────────────────────────────

type SetupMode = 'init' | 'clone' | 'connect' | null

function GitSetupModal({
  projectPath, projectName, githubToken, onClose, onDone,
}: { projectPath: string; projectName: string; githubToken: string; onClose: () => void; onDone: () => void }) {
  const [mode,       setMode]       = useState<SetupMode>(null)
  const [remoteUrl,  setRemoteUrl]  = useState('')
  const [busy,       setBusy]       = useState(false)
  const [result,     setResult]     = useState<{ ok: boolean; msg: string } | null>(null)

  const gitAction = (action: string, extra?: Record<string, string>) =>
    fetch('/api/git-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, path: projectPath, ...extra }),
    }).then(r => r.json()) as Promise<{ ok: boolean; out: string }>

  const withToken = (url: string) =>
    githubToken && url.includes('github.com')
      ? url.replace('https://github.com/', `https://${githubToken}@github.com/`)
      : url

  const run = async () => {
    setBusy(true)
    setResult(null)
    try {
      if (mode === 'init') {
        const r = await gitAction('init')
        setResult(r.ok ? { ok: true, msg: 'Projekt eingerichtet ✓' } : { ok: false, msg: 'Fehler beim Einrichten.' })
        if (r.ok) setTimeout(onDone, 1200)
      } else if (mode === 'clone') {
        const r = await gitAction('clone', { remote: withToken(remoteUrl) })
        setResult(r.ok ? { ok: true, msg: 'Erfolgreich geklont ✓' } : { ok: false, msg: r.out.slice(0, 120) })
        if (r.ok) setTimeout(onDone, 1200)
      } else if (mode === 'connect') {
        const r1 = await gitAction('init')
        if (!r1.ok) { setResult({ ok: false, msg: 'Fehler beim Einrichten.' }); return }
        if (remoteUrl.trim()) {
          const r2 = await gitAction('add-remote', { remote: withToken(remoteUrl) })
          if (!r2.ok) { setResult({ ok: false, msg: 'Remote konnte nicht verbunden werden.' }); return }
        }
        setResult({ ok: true, msg: 'Ordner verbunden ✓' })
        setTimeout(onDone, 1200)
      }
    } finally { setBusy(false) }
  }

  const modalBg: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(5px)' }
  const modalBox: React.CSSProperties = { background: 'var(--bg-1)', border: '1px solid var(--line-strong)', borderRadius: 12, padding: 24, width: 420, maxWidth: '90vw', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }
  const optCard: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 8, border: '1px solid var(--line-strong)', background: 'var(--bg-2)', cursor: 'pointer', marginBottom: 8 }
  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid var(--line-strong)', borderRadius: 6, background: 'var(--bg-2)', color: 'var(--fg-0)', fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none', boxSizing: 'border-box' as const, marginBottom: 4 }
  const btnPri: React.CSSProperties = { background: 'var(--accent)', color: 'var(--accent-fg)', border: 'none', padding: '8px 18px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)' }
  const btnSec: React.CSSProperties = { background: 'transparent', color: 'var(--fg-2)', border: '1px solid var(--line-strong)', padding: '8px 14px', borderRadius: 7, fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-ui)' }

  return (
    <div style={modalBg} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={modalBox}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-0)' }}>Projekt einrichten</div>
            <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 3 }}>{projectName}</div>
          </div>
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--fg-3)', cursor: 'pointer', padding: 4, lineHeight: 1 }}>
            <IClose style={{ width: 14, height: 14 }} />
          </button>
        </div>

        {/* Option selection */}
        {!mode && !result && (
          <div>
            <div style={{ fontSize: 11.5, color: 'var(--fg-3)', marginBottom: 14 }}>Wie möchtest du das Projekt einrichten?</div>
            {([
              { m: 'init' as SetupMode,    icon: <IPlay style={{ width: 15, height: 15, color: 'var(--accent)', flexShrink: 0 }} />,          title: 'Neues Projekt starten',    desc: 'Git in diesem Ordner einrichten — Änderungen lokal speichern' },
              { m: 'clone' as SetupMode,   icon: <ICloudDownload style={{ width: 15, height: 15, color: 'var(--accent)', flexShrink: 0 }} />,  title: 'Von GitHub holen',         desc: 'Vorhandenes GitHub-Repo in diesen Ordner klonen' },
              { m: 'connect' as SetupMode, icon: <ILink style={{ width: 15, height: 15, color: 'var(--accent)', flexShrink: 0 }} />,           title: 'Diesen Ordner verbinden',  desc: 'Git einrichten und mit einem GitHub-Repo verknüpfen' },
            ] as const).map(({ m, icon, title, desc }) => (
              <div key={m as string} style={optCard} onClick={() => setMode(m)}>
                {icon}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)', marginBottom: 2 }}>{title}</div>
                  <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>{desc}</div>
                </div>
                <IChev style={{ width: 12, height: 12, color: 'var(--fg-3)', marginLeft: 'auto', flexShrink: 0 }} />
              </div>
            ))}
          </div>
        )}

        {/* Form: init */}
        {mode === 'init' && !result && (
          <div>
            <div style={{ fontSize: 12, color: 'var(--fg-2)', marginBottom: 18, lineHeight: 1.6 }}>
              Git wird in <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-0)' }}>{projectName}</span> eingerichtet. Du kannst danach eine GitHub-Verbindung im GitHub-Tab hinzufügen.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setMode(null)} style={btnSec}>Zurück</button>
              <button onClick={run} disabled={busy} style={{ ...btnPri, opacity: busy ? 0.6 : 1 }}>
                {busy ? 'Wird eingerichtet…' : 'Einrichten'}
              </button>
            </div>
          </div>
        )}

        {/* Form: clone */}
        {mode === 'clone' && !result && (
          <div>
            <label style={{ display: 'block', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--fg-3)', fontWeight: 500, marginBottom: 6 }}>GitHub URL</label>
            <input style={inp} value={remoteUrl} onChange={e => setRemoteUrl(e.target.value)} placeholder="https://github.com/user/repo" autoFocus />
            {githubToken
              ? <div style={{ fontSize: 10.5, color: 'var(--ok)', marginBottom: 14 }}>✓ GitHub Token hinterlegt — authentifizierter Zugriff</div>
              : <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginBottom: 14 }}>Kein GitHub Token — nur öffentliche Repos klonbar</div>
            }
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setMode(null)} style={btnSec}>Zurück</button>
              <button onClick={run} disabled={busy || !remoteUrl.trim()} style={{ ...btnPri, opacity: (busy || !remoteUrl.trim()) ? 0.5 : 1 }}>
                {busy ? 'Wird geklont…' : 'Klonen'}
              </button>
            </div>
          </div>
        )}

        {/* Form: connect */}
        {mode === 'connect' && !result && (
          <div>
            <div style={{ fontSize: 12, color: 'var(--fg-2)', marginBottom: 14, lineHeight: 1.6 }}>
              Git wird in diesem Ordner eingerichtet und optional mit einem GitHub-Repo verbunden.
            </div>
            <label style={{ display: 'block', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--fg-3)', fontWeight: 500, marginBottom: 6 }}>GitHub URL (optional)</label>
            <input style={{ ...inp, marginBottom: 16 }} value={remoteUrl} onChange={e => setRemoteUrl(e.target.value)} placeholder="https://github.com/user/repo" autoFocus />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setMode(null)} style={btnSec}>Zurück</button>
              <button onClick={run} disabled={busy} style={{ ...btnPri, opacity: busy ? 0.6 : 1 }}>
                {busy ? 'Wird verbunden…' : 'Verbinden'}
              </button>
            </div>
          </div>
        )}

        {/* Result */}
        {result && (
          <div style={{ padding: '14px 16px', borderRadius: 8, background: result.ok ? 'rgba(125,201,125,0.1)' : 'rgba(226,75,74,0.1)', border: `1px solid ${result.ok ? 'rgba(125,201,125,0.3)' : 'rgba(226,75,74,0.3)'}`, color: result.ok ? 'var(--ok)' : 'var(--err)', fontSize: 12, textAlign: 'center', lineHeight: 1.5 }}>
            {result.msg}
            {!result.ok && (
              <button onClick={() => { setResult(null) }} style={{ display: 'block', margin: '10px auto 0', ...btnSec, fontSize: 11 }}>Nochmal versuchen</button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function GitHubTab({ projectPath, projectName }: { projectPath: string; projectName: string }) {
  const { openrouterKey, codeReviewModel, setCodeReviewModel, githubToken: _legacyGhToken2, setGithubToken, tokens: repoTokens2, addToken: addRepoToken, updateToken: updateRepoToken, theme } = useAppStore()
  const githubToken = repoTokens2.find(t => t.host === 'github.com')?.token || _legacyGhToken2
  const [data,            setData]          = useState<GhData | null>(null)
  const [showSetupModal,  setShowSetupModal] = useState(false)
  const [status,   setStatus]   = useState<GhStatus>('loading')
  const [note,     setNote]     = useState('')
  const [busy,     setBusy]     = useState<'save' | 'pull' | null>(null)
  const [toast,    setToast]    = useState<{ msg: string; ok: boolean } | null>(null)
  const [sections, setSections] = useState({ versions: false, history: false, settings: false })
  const [showAllFiles,  setShowAllFiles]  = useState(false)
  const [editingToken,  setEditingToken]  = useState(false)
  const [tokenDraft,    setTokenDraft]    = useState(githubToken)
  const [diffOpen,      setDiffOpen]      = useState(false)
  const [diffFile,      setDiffFile]      = useState('')

  // ── Review state ──────────────────────────────────────────────────────────
  const [reviewOpen,     setReviewOpen]     = useState(false)
  const [reviewFile,     setReviewFile]     = useState('')
  const [reviewType,     setReviewType]     = useState<ReviewType>('general')
  const [reviewBusy,     setReviewBusy]     = useState(false)
  const [reviewFindings, setReviewFindings] = useState<ReviewFinding[] | null>(null)
  const [reviewError,    setReviewError]    = useState<string | null>(null)

  const runReview = useCallback(async () => {
    if (!reviewFile || !openrouterKey) return
    setReviewBusy(true)
    setReviewFindings(null)
    setReviewError(null)
    try {
      const fileRes = await fetch(`/api/file-content?path=${encodeURIComponent(projectPath)}&file=${encodeURIComponent(reviewFile)}`)
      const fileData = await fileRes.json() as { ok: boolean; content?: string; error?: string }
      if (!fileData.ok || !fileData.content) { setReviewError('Dateiinhalt konnte nicht gelesen werden.'); return }

      const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openrouterKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://codera.ai',
          'X-Title': 'Codera AI Code Review',
        },
        body: JSON.stringify({
          model: codeReviewModel,
          messages: [
            { role: 'system', content: REVIEW_PROMPTS[reviewType] },
            { role: 'user',   content: `Datei: ${reviewFile}\n\n\`\`\`\n${fileData.content.slice(0, 12000)}\n\`\`\`` },
          ],
          max_tokens: 2048,
        }),
      })
      if (resp.status === 401) { setReviewError('OpenRouter API-Key ungültig. Bitte in den Einstellungen prüfen.'); return }
      if (resp.status === 429) { setReviewError('Zu viele Anfragen — kurz warten und nochmal probieren.'); return }
      if (!resp.ok) { setReviewError(`Fehler vom Modell (${resp.status}). Versuche ein anderes Modell.`); return }

      const json = await resp.json() as { choices?: { message?: { content?: string } }[] }
      const raw = json.choices?.[0]?.message?.content ?? ''
      const match = raw.match(/\{[\s\S]*\}/)
      if (!match) { setReviewError('Antwort konnte nicht gelesen werden. Versuche es nochmal.'); return }
      const parsed = JSON.parse(match[0]) as { findings: ReviewFinding[] }
      setReviewFindings(parsed.findings ?? [])
    } catch { setReviewError('Verbindungsfehler. Ist eine Internetverbindung vorhanden?') }
    finally { setReviewBusy(false) }
  }, [reviewFile, reviewType, openrouterKey, codeReviewModel, projectPath])

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(() => {
    setStatus('loading')
    fetch(`/api/git?path=${encodeURIComponent(projectPath)}`)
      .then(r => r.json())
      .then((d: { hasGit?: boolean; status?: GhFileInfo[]; branches?: GhBranch[]; log?: GhCommit[]; remotes?: string[]; diffStat?: string }) => {
        const files = (d.status ?? []).filter(f => f.flag !== '??')
        const currentBranch = (d.branches ?? []).find(b => b.current)?.name ?? 'main'
        const remote = (d.remotes ?? [])[0] ?? null
        const { added, removed } = parseDiffStat(d.diffStat ?? '')
        const newData: GhData = {
          hasGit: d.hasGit ?? false, branch: currentBranch, remote,
          files, branches: d.branches ?? [], log: (d.log ?? []).slice(0, 10), added, removed,
        }
        const newStatus: GhStatus = files.length > 0 ? 'dirty' : 'synced'
        _gitCache.set(projectPath, { data: newData, status: newStatus, ts: Date.now() })
        setData(newData)
        setStatus(newStatus)
      })
      .catch(() => setStatus('error'))
  }, [projectPath])

  useEffect(() => { load() }, [load])
  useEffect(() => _gitSubscribe(projectPath, load), [projectPath, load])

  const gitAction = (action: string, extra?: Record<string, string>) =>
    fetch('/api/git-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, path: projectPath, ...extra }),
    }).then(r => r.json()) as Promise<{ ok: boolean; out: string }>

  const handleSave = async () => {
    if (!data) return
    setBusy('save')
    try {
      const autoMsg = data.files.length > 0
        ? `Änderungen an ${data.files.length} Datei${data.files.length > 1 ? 'en' : ''} (${data.files.slice(0, 3).map(f => f.file.split('/').pop()).join(', ')}${data.files.length > 3 ? ` +${data.files.length - 3}` : ''})`
        : 'Update'
      const msg = note.trim() || autoMsg
      const r1 = await gitAction('stage')
      if (!r1.ok) { showToast(humanGitError(r1.out), false); return }
      const r2 = await gitAction('commit', { message: msg })
      if (!r2.ok && !r2.out.includes('nothing to commit')) { showToast(humanGitError(r2.out), false); return }
      if (data.remote) {
        const r3 = await gitAction('push')
        if (!r3.ok) { showToast(humanGitError(r3.out), false); return }
      }
      setNote('')
      showToast('Gespeichert & hochgeladen ✓', true)
      _gitInvalidate(projectPath)
      load()
    } finally { setBusy(null) }
  }

  const handlePull = async () => {
    setBusy('pull')
    try {
      const r = await gitAction('pull')
      showToast(r.ok ? 'Updates geholt ✓' : humanGitError(r.out), r.ok)
      if (r.ok) { _gitInvalidate(projectPath); load() }
    } finally { setBusy(null) }
  }

  const handleDiscardFile = async (file: string) => {
    await fetch('/api/git-action', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'discard-file', path: projectPath, message: file }),
    })
    _gitInvalidate(projectPath); load()
  }

  const statusColor = status === 'synced' ? 'var(--ok)' : status === 'dirty' ? 'var(--warn)' : status === 'error' ? 'var(--err)' : 'var(--fg-3)'
  const statusText  = status === 'synced' ? 'Alles gesichert' : status === 'dirty' ? `${data?.files.length ?? 0} ungespeicherte Änderung${(data?.files.length ?? 0) !== 1 ? 'en' : ''}` : status === 'error' ? 'Verbindung getrennt' : 'Wird geladen…'

  const flagColor = _flagColor
  const flagLabel = _flagLabel

  const card: React.CSSProperties = { background: 'var(--bg-0)', border: '1px solid var(--line-strong)', borderRadius: 8, padding: '10px 12px', marginBottom: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.08)' }
  const secBtnBg = theme === 'light' ? '#333333' : 'var(--fg-0)'
  const secBtn: React.CSSProperties = { width: '100%', background: secBtnBg, color: 'var(--bg-0)', border: `1px solid ${secBtnBg}`, padding: '10px', borderRadius: 7, fontSize: 11.5, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'var(--font-ui)', marginBottom: 8, boxShadow: '0 1px 2px rgba(0,0,0,0.08)' }
  const priBtn: React.CSSProperties = { width: '100%', background: 'var(--accent)', color: '#fff', border: '1px solid rgba(249,115,22,0.6)', padding: '10px', borderRadius: 7, fontWeight: 600, fontSize: 12.5, cursor: (status === 'dirty' && !busy) ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'var(--font-ui)', marginBottom: 8, opacity: (status !== 'dirty' || busy === 'save') ? 0.5 : 1, boxShadow: '0 1px 4px rgba(249,115,22,0.18)' }

  const ghUrl = (() => {
    if (!data?.remote) return null
    const m = data.remote.match(/github\.com[:/](.+?)(?:\.git)?$/)
    return m ? `https://github.com/${m[1]}` : null
  })()

  const toggleSection = (k: keyof typeof sections) => setSections(s => ({ ...s, [k]: !s[k] }))
  const collRow = (label: string, icon: React.ReactNode, key: keyof typeof sections): React.ReactNode => (
    <div
      onClick={() => toggleSection(key)}
      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 2px', borderTop: 'var(--line)', fontSize: 11.5, color: 'var(--fg-2)', cursor: 'pointer', userSelect: 'none' }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{icon}{label}</span>
      {sections[key]
        ? <IChevUp   style={{ width: 12, height: 12, color: 'var(--fg-3)' }} />
        : <IChevDown style={{ width: 12, height: 12, color: 'var(--fg-3)' }} />
      }
    </div>
  )

  return (
    <>
      {showSetupModal && (
        <GitSetupModal
          projectPath={projectPath}
          projectName={projectName}
          githubToken={githubToken}
          onClose={() => setShowSetupModal(false)}
          onDone={() => { setShowSetupModal(false); load() }}
        />
      )}
      {diffOpen && (data?.files.length ?? 0) > 0 && (
        <DiffModal
          projectPath={projectPath}
          files={data!.files}
          initialFile={diffFile}
          onClose={() => setDiffOpen(false)}
          onOpenReview={(file) => { setDiffOpen(false); setReviewFile(file); setReviewOpen(true) }}
          onDiscard={handleDiscardFile}
        />
      )}
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, paddingTop: 2 }}>

      {/* Toast */}
      {toast && (
        <div style={{ margin: '0 0 10px', padding: '6px 10px', borderRadius: 6, background: toast.ok ? 'rgba(125,201,125,0.12)' : 'rgba(226,75,74,0.12)', border: `0.5px solid ${toast.ok ? 'rgba(125,201,125,0.35)' : 'rgba(226,75,74,0.35)'}`, color: toast.ok ? 'var(--ok)' : 'var(--err)', fontSize: 11, fontFamily: 'var(--font-ui)' }}>
          {toast.msg}
        </div>
      )}

      {/* No git repo detected */}
      {data !== null && !data.hasGit && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, paddingTop: 24, paddingBottom: 8, textAlign: 'center' }}>
          <div style={{ width: 44, height: 44, borderRadius: 22, background: 'rgba(var(--accent-rgb,255,138,76),0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IFolder style={{ width: 20, height: 20, color: 'var(--accent)' }} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)', marginBottom: 5 }}>Noch kein Git-Projekt</div>
            <div style={{ fontSize: 11.5, color: 'var(--fg-3)', lineHeight: 1.6, maxWidth: 210 }}>
              Richte Git ein, um Änderungen zu speichern und mit GitHub zu synchronisieren.
            </div>
          </div>
          <button
            onClick={() => setShowSetupModal(true)}
            style={{ background: 'var(--accent)', color: 'var(--accent-fg)', border: 'none', padding: '9px 22px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)' }}
          >
            Projekt einrichten
          </button>
        </div>
      )}

      {/* Normal git content — only when repo exists */}
      {(data === null || data.hasGit) && <>

      {/* 1 — Status card */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
          <span style={{ fontSize: 12.5, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 5 }}>
            <IFolder style={{ width: 13, height: 13, color: 'var(--accent)', flexShrink: 0 }} />
            {projectName}
          </span>
          <span style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>{data?.branch ?? '—'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, marginBottom: 3 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor, flexShrink: 0 }} />
          <span style={{ color: statusColor }}>{statusText}</span>
          {status === 'dirty' && (data?.added ?? 0) + (data?.removed ?? 0) > 0 && (
            <span
              onClick={() => { setDiffFile(data!.files[0]?.file ?? ''); setDiffOpen(true) }}
              title="Diff anzeigen"
              style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10.5, cursor: 'pointer', background: 'var(--bg-3)', borderRadius: 4, padding: '1px 5px', marginLeft: 2 }}
            >
              <span style={{ color: 'var(--ok)', fontWeight: 600 }}>+{data!.added}</span>
              <span style={{ color: 'var(--err)', fontWeight: 600 }}>−{data!.removed}</span>
            </span>
          )}
        </div>
        {data?.remote && (
          <div style={{ fontSize: 10.5, color: 'var(--fg-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <IBranch style={{ width: 11, height: 11 }} />
            verbunden mit GitHub
            {ghUrl && (
              <a href={ghUrl} target="_blank" rel="noreferrer" style={{ marginLeft: 'auto', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 3, fontSize: 10.5, textDecoration: 'none' }}>
                Öffnen <IExternalLink style={{ width: 10, height: 10 }} />
              </a>
            )}
          </div>
        )}
      </div>

      {/* 2 — Note */}
      <textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="Was hast du geändert? (optional)"
        rows={2}
        style={{ resize: 'none', background: 'var(--bg-2)', border: '1px solid var(--line-strong)', borderRadius: 6, color: 'var(--fg-1)', fontSize: 11, fontFamily: 'var(--font-ui)', padding: '7px 10px', outline: 'none', marginBottom: 10, lineHeight: 1.5, boxSizing: 'border-box', width: '100%' }}
      />

      {/* 3 — Buttons */}
      <button onClick={handleSave} disabled={status !== 'dirty' || !!busy} style={priBtn}>
        {busy === 'save' ? <ISpinner size={13} /> : <IArrowUpLine style={{ width: 13, height: 13, strokeWidth: 2.5 }} />}
        {busy === 'save' ? 'Wird hochgeladen…' : 'Speichern & Hochladen'}
      </button>
      <button onClick={handlePull} disabled={!!busy} style={{ ...secBtn, opacity: busy === 'pull' ? 0.6 : 1 }}>
        {busy === 'pull' ? <ISpinner size={12} /> : <IArrowDownLine style={{ width: 12, height: 12, strokeWidth: 2 }} />}
        Updates holen
      </button>

      {/* 4 — Changed files (max 5 visible) */}
      {(data?.files.length ?? 0) > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, marginTop: 2 }}>
            <span style={{ fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Was hat sich geändert</span>
            <span onClick={() => { setDiffFile(data!.files[0].file); setDiffOpen(true) }} style={{ fontSize: 10, color: 'var(--accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
              <IGitFork style={{ width: 10, height: 10 }} /> Diff
            </span>
          </div>
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line-strong)', borderRadius: 6, marginBottom: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.08)' }}>
            {(showAllFiles ? data!.files : data!.files.slice(0, 5)).map((f, i, arr) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 10px', borderBottom: i < arr.length - 1 || (!showAllFiles && data!.files.length > 5) ? 'var(--line)' : 'none', fontSize: 11 }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                  <span style={{ color: flagColor(f.flag), fontWeight: 700, marginRight: 5, fontFamily: 'var(--font-mono)' }}>{flagLabel(f.flag)}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-1)' }}>{f.file}</span>
                </span>
                <IEye onClick={() => { setDiffFile(f.file); setDiffOpen(true) }} style={{ width: 11, height: 11, color: 'var(--fg-3)', flexShrink: 0, marginLeft: 6, cursor: 'pointer' }} />
              </div>
            ))}
            {!showAllFiles && data!.files.length > 5 && (
              <div onClick={() => setShowAllFiles(true)} style={{ padding: '5px 10px', fontSize: 10.5, color: 'var(--accent)', cursor: 'pointer', textAlign: 'center' }}>
                + {data!.files.length - 5} weitere anzeigen
              </div>
            )}
          </div>
        </>
      )}

      {/* 5 — KI-Code-Review */}
      <div style={{ background: 'rgba(var(--accent-rgb,255,138,76),0.07)', border: '0.5px solid rgba(var(--accent-rgb,255,138,76),0.25)', borderRadius: 8, marginBottom: 12, overflow: 'hidden' }}>
        {/* Header row */}
        <div
          onClick={() => { setReviewOpen(o => !o); setReviewFindings(null); setReviewError(null) }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 12px', cursor: 'pointer' }}
        >
          <ISpark style={{ width: 13, height: 13, color: 'var(--accent)', flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 12, fontWeight: 500 }}>KI-Code-Review</span>
          {reviewOpen
            ? <IChevUp   style={{ width: 12, height: 12, color: 'var(--fg-3)' }} />
            : <IChevDown style={{ width: 12, height: 12, color: 'var(--fg-3)' }} />
          }
        </div>

        {reviewOpen && (
          <div style={{ padding: '0 12px 12px', borderTop: '0.5px solid rgba(var(--accent-rgb,255,138,76),0.2)', paddingTop: 10 }}>
            {!openrouterKey ? (
              <div style={{ fontSize: 11, color: 'var(--fg-3)', lineHeight: 1.5 }}>
                Kein OpenRouter API-Key hinterlegt.{' '}
                <span style={{ color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => useAppStore.getState().setScreen('settings')}>
                  Jetzt in Einstellungen hinterlegen →
                </span>
              </div>
            ) : (
              <>
                {/* File picker */}
                <select
                  value={reviewFile}
                  onChange={e => { setReviewFile(e.target.value); setReviewFindings(null); setReviewError(null) }}
                  style={{ width: '100%', background: 'var(--bg-2)', border: 'var(--line-strong)', borderRadius: 5, color: 'var(--fg-0)', fontSize: 11, padding: '5px 7px', fontFamily: 'var(--font-mono)', marginBottom: 8, cursor: 'pointer' }}
                >
                  <option value="">Datei wählen…</option>
                  {(data?.files ?? []).map(f => <option key={f.file} value={f.file}>{f.file}</option>)}
                </select>

                {/* Review type tabs */}
                <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                  {(['general','security','performance','style'] as ReviewType[]).map(t => (
                    <button key={t} onClick={() => { setReviewType(t); setReviewFindings(null); setReviewError(null) }} style={{ flex: 1, padding: '4px 0', fontSize: 10, borderRadius: 5, border: 'none', cursor: 'pointer', background: reviewType === t ? 'var(--accent)' : 'var(--bg-3)', color: reviewType === t ? 'var(--accent-fg)' : 'var(--fg-2)', fontWeight: reviewType === t ? 600 : 400, fontFamily: 'var(--font-ui)' }}>
                      {t === 'general' ? 'Allgemein' : t === 'security' ? 'Sicherheit' : t === 'performance' ? 'Speed' : 'Stil'}
                    </button>
                  ))}
                </div>

                {/* Run button */}
                <button
                  onClick={runReview}
                  disabled={!reviewFile || reviewBusy}
                  style={{ width: '100%', padding: '7px', borderRadius: 6, border: 'none', background: reviewFile && !reviewBusy ? 'var(--accent)' : 'var(--bg-3)', color: reviewFile && !reviewBusy ? 'var(--accent-fg)' : 'var(--fg-3)', fontWeight: 600, fontSize: 11.5, cursor: reviewFile && !reviewBusy ? 'pointer' : 'default', fontFamily: 'var(--font-ui)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 8 }}
                >
                  {reviewBusy ? <><ISpinner size={12} />Wird analysiert…</> : 'Review starten'}
                </button>

                {/* Error */}
                {reviewError && (
                  <div style={{ fontSize: 11, color: 'var(--err)', padding: '6px 8px', background: 'rgba(226,75,74,0.08)', borderRadius: 5, marginBottom: 6 }}>{reviewError}</div>
                )}

                {/* Results */}
                {reviewFindings !== null && (
                  reviewFindings.length === 0
                    ? <div style={{ fontSize: 11, color: 'var(--ok)', padding: '6px 8px', background: 'rgba(125,201,125,0.08)', borderRadius: 5 }}>Keine Probleme gefunden ✓</div>
                    : <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {reviewFindings.map((f, i) => {
                          const c = f.severity === 'error' ? 'var(--err)' : f.severity === 'warn' ? 'var(--warn)' : 'var(--fg-2)'
                          return (
                            <div key={i} style={{ padding: '7px 9px', background: 'var(--bg-2)', borderRadius: 6, border: `0.5px solid ${c}44` }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                                <span style={{ fontSize: 9, fontWeight: 700, color: c, textTransform: 'uppercase' }}>{f.severity}</span>
                                {f.line ? <span style={{ fontSize: 9, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>Zeile {f.line}</span> : null}
                              </div>
                              <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--fg-0)', marginBottom: 2 }}>{f.title}</div>
                              <div style={{ fontSize: 11, color: 'var(--fg-2)', lineHeight: 1.45 }}>{f.advice}</div>
                              {f.suggestion && <div style={{ marginTop: 4, fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', background: 'var(--bg-3)', padding: '4px 7px', borderRadius: 4, whiteSpace: 'pre-wrap' }}>{f.suggestion}</div>}
                            </div>
                          )
                        })}
                      </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* 6 — Collapsibles */}
      <div style={{ marginTop: 4 }}>
        {collRow('Versionen', <IBranch style={{ width: 12, height: 12, flexShrink: 0 }} />, 'versions')}
        {sections.versions && data?.branches && data.branches.length > 0 && (
          <div style={{ paddingBottom: 8, paddingLeft: 4 }}>
            {data.branches.map(b => (
              <div key={b.name} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', fontSize: 11, color: b.current ? 'var(--accent)' : 'var(--fg-2)', borderRadius: 4, background: b.current ? 'rgba(var(--accent-rgb,255,138,76),0.07)' : 'transparent' }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: b.current ? 'var(--accent)' : 'var(--fg-3)', flexShrink: 0 }} />
                {b.name}
                {b.current && <span style={{ fontSize: 9, color: 'var(--fg-3)', marginLeft: 'auto' }}>aktiv</span>}
              </div>
            ))}
          </div>
        )}

        {collRow('Verlauf', <IHistoryClock style={{ width: 12, height: 12, flexShrink: 0 }} />, 'history')}
        {sections.history && (
          <div style={{ paddingBottom: 8 }}>
            {data?.log.length === 0 && <div style={{ fontSize: 11, color: 'var(--fg-3)', padding: '4px 6px' }}>Noch keine Speicherpunkte</div>}
            {data?.log.map((c, i) => (
              <div
                key={i}
                onClick={() => { navigator.clipboard.writeText(c.hash).catch(() => {}); showToast(`Hash kopiert: ${c.hash.slice(0, 7)}`, true) }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 6px', borderBottom: i < (data?.log.length ?? 0) - 1 ? 'var(--line)' : 'none', cursor: 'pointer', borderRadius: 4 }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: 'var(--fg-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.msg}</div>
                  <div style={{ fontSize: 10, color: 'var(--fg-3)', display: 'flex', gap: 6, marginTop: 1 }}>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{c.hash.slice(0, 7)}</span>
                    <span>{c.when}</span>
                  </div>
                </div>
                {ghUrl ? (
                  <a href={`${ghUrl}/commit/${c.hash}`} target="_blank" rel="noreferrer"
                    onClick={e => e.stopPropagation()}
                    style={{ color: 'var(--fg-3)', flexShrink: 0, display: 'flex', lineHeight: 1 }}>
                    <IExternalLink style={{ width: 11, height: 11 }} />
                  </a>
                ) : (
                  <ICopy style={{ width: 11, height: 11, color: 'var(--fg-3)', flexShrink: 0 }} />
                )}
              </div>
            ))}
          </div>
        )}

        {collRow('Einstellungen', <ISettings style={{ width: 12, height: 12, flexShrink: 0 }} />, 'settings')}
        {sections.settings && (
          <div style={{ paddingBottom: 8, paddingTop: 6, display: 'flex', flexDirection: 'column', gap: 10 }}>

            {/* GitHub Token inline */}
            <div>
              <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--fg-3)', marginBottom: 5 }}>GitHub Token</div>
              {editingToken ? (
                <div style={{ display: 'flex', gap: 5 }}>
                  <input
                    type="password"
                    value={tokenDraft}
                    onChange={e => setTokenDraft(e.target.value)}
                    placeholder="ghp_..."
                    autoFocus
                    style={{ flex: 1, padding: '5px 8px', border: '1px solid var(--line-strong)', borderRadius: 5, background: 'var(--bg-2)', color: 'var(--fg-0)', fontSize: 11, fontFamily: 'var(--font-mono)', outline: 'none' }}
                  />
                  <button onClick={() => {
                    const existing = repoTokens2.find(t => t.host === 'github.com')
                    if (existing) { updateRepoToken(existing.id, { token: tokenDraft }) }
                    else { addRepoToken({ id: `tok${Date.now()}`, label: 'GitHub', host: 'github.com', token: tokenDraft }) }
                    setGithubToken(tokenDraft) // keep legacy field in sync
                    setEditingToken(false)
                  }} style={{ background: 'var(--accent)', color: 'var(--accent-fg)', border: 'none', padding: '5px 9px', borderRadius: 5, fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-ui)' }}>✓</button>
                  <button onClick={() => setEditingToken(false)} style={{ background: 'transparent', color: 'var(--fg-2)', border: '1px solid var(--line-strong)', padding: '5px 9px', borderRadius: 5, fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-ui)' }}>✕</button>
                </div>
              ) : (
                <div
                  onClick={() => { setEditingToken(true); setTokenDraft(githubToken) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', background: 'var(--bg-2)', borderRadius: 5, border: '1px solid var(--line)', cursor: 'pointer', fontSize: 11 }}
                >
                  {githubToken
                    ? <><ICheck style={{ width: 11, height: 11, color: 'var(--ok)', flexShrink: 0 }} /><span style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-2)' }}>{githubToken.slice(0, 12)}···</span></>
                    : <span style={{ color: 'var(--fg-3)' }}>Kein Token — klicken zum Hinterlegen</span>
                  }
                  <IEdit style={{ width: 10, height: 10, color: 'var(--fg-3)', marginLeft: 'auto', flexShrink: 0 }} />
                </div>
              )}
            </div>

            {/* Code Review model */}
            <div>
              <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--fg-3)', marginBottom: 5 }}>KI-Review Modell</div>
              <select
                value={codeReviewModel}
                onChange={e => setCodeReviewModel(e.target.value)}
                style={{ width: '100%', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 5, color: 'var(--fg-0)', fontSize: 11, padding: '5px 7px', fontFamily: 'var(--font-ui)', cursor: 'pointer' }}
              >
                {OPENROUTER_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>

          </div>
        )}
      </div>

      </> /* end hasGit content */}
    </div>
    </>
  )
}

// ── Git tab (Advanced) ─────────────────────────────────────────────────────────

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

interface GitStatus { flag: string; file: string }
interface GitCommit { hash: string; msg: string; author: string; when: string; date: string }
interface GitBranch { name: string; hash: string; msg: string; current: boolean }
interface GitInfo {
  status: GitStatus[]; log: GitCommit[]; branches: GitBranch[]
  diffStat: string; remotes: string[]; lastCommit: string; error?: string
}

const gitAction = (action: string, path: string, extra?: Record<string, string>) =>
  fetch('/api/git-action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, path, ...extra }),
  }).then(r => r.json()) as Promise<{ ok: boolean; out: string }>

function GitTab({ projectPath }: { projectPath: string }) {
  const [info, setInfo]         = useState<GitInfo | null>(null)
  const [loading, setLoading]   = useState(true)
  const [commitMsg, setCommitMsg] = useState('')
  const [busy, setBusy]         = useState('')
  const [log, setLog]           = useState('')
  const [newBranch, setNewBranch] = useState('')
  const [repoUrl, setRepoUrl]   = useState<string | null>(null)

  const refresh = () => {
    setLoading(true)
    fetch(`/api/git?path=${encodeURIComponent(projectPath)}`)
      .then(r => r.json())
      .then(d => { setInfo(d); setLoading(false) })
      .catch(() => setLoading(false))
  }
  useEffect(() => { refresh() }, [projectPath])

  useEffect(() => {
    fetch(`/api/git-remote?path=${encodeURIComponent(projectPath)}`)
      .then(r => r.json())
      .then((d: { ok: boolean; url: string | null }) => {
        setRepoUrl(d.ok && d.url ? toRepoUrl(d.url) : null)
      })
      .catch(() => setRepoUrl(null))
  }, [projectPath])

  const run = async (action: string, extra?: Record<string, string>) => {
    setBusy(action)
    const r = await gitAction(action, projectPath, extra)
    setLog(r.out)
    setBusy('')
    refresh()
  }

  const flagColor = (f: string) =>
    f === 'M' ? 'var(--warn)' : f === 'A' ? 'var(--ok)' : f === 'D' ? 'var(--err)' : 'var(--fg-3)'

  const currentBranch = info?.branches.find(b => b.current)

  if (loading) return <div style={{ padding: 20, textAlign: 'center', color: 'var(--fg-3)', fontSize: 12 }}>Loading…</div>
  if (!info || info.error) return <div style={{ padding: 14, color: 'var(--err)', fontSize: 11 }}>No git repository found at this path.</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Header bar */}
      <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, background: 'var(--bg-1)', border: '1px solid var(--line-strong)', borderRadius: 8, margin: '10px 12px 0' }}>
        <span className="mono" style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>
          {currentBranch?.name ?? '—'}
        </span>
        <span style={{ flex: 1, fontSize: 10, color: 'var(--fg-3)' }}>
          {info.lastCommit ? `last commit ${info.lastCommit}` : ''}
        </span>
        <button onClick={refresh} disabled={!!busy} style={smallBtn}>↻</button>
        {repoUrl && (
          <button
            onClick={() => window.open(repoUrl, '_blank')}
            title={repoUrl}
            style={{ ...smallBtn, display: 'flex', alignItems: 'center', gap: 5, background: 'var(--accent-soft)', border: '1px solid var(--accent-line)', color: 'var(--accent)' }}
          >
            <IExternalLink style={{ width: 10, height: 10 }} />
            Repository
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Branches */}
        <section>
          <SectionLabel>Branches</SectionLabel>
          {info.branches.map(b => (
            <div
              key={b.name}
              onClick={() => !b.current && run('checkout', { branch: b.name })}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 6px', borderRadius: 6, cursor: b.current ? 'default' : 'pointer', background: b.current ? 'var(--accent-soft)' : 'transparent', marginBottom: 1 }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: b.current ? 'var(--accent)' : 'var(--fg-3)' }} />
              <span className="mono" style={{ flex: 1, fontSize: 11, color: b.current ? 'var(--accent)' : 'var(--fg-1)', fontWeight: b.current ? 600 : 400 }}>{b.name}</span>
              {!b.current && <span style={{ fontSize: 9.5, color: 'var(--fg-3)' }}>switch</span>}
            </div>
          ))}
          {/* New branch */}
          <div style={{ display: 'flex', gap: 5, marginTop: 6 }}>
            <input
              value={newBranch} onChange={e => setNewBranch(e.target.value)}
              placeholder="new-branch-name"
              style={{ flex: 1, padding: '4px 7px', border: '1px solid var(--line)', borderRadius: 6, background: 'var(--bg-2)', color: 'var(--fg-0)', fontSize: 11, fontFamily: 'var(--font-mono)', outline: 'none' }}
            />
            <button
              onClick={() => { if (newBranch.trim()) { run('new-branch', { branch: newBranch.trim() }); setNewBranch('') } }}
              disabled={!newBranch.trim() || !!busy}
              style={smallBtn}
            >+ Branch</button>
          </div>
        </section>

        {/* Changes */}
        <section>
          <SectionLabel>
            Changes {info.status.length > 0 && <span style={{ color: 'var(--warn)', fontWeight: 600 }}>{info.status.length}</span>}
          </SectionLabel>
          {info.status.length === 0
            ? <div style={{ color: 'var(--ok)', fontSize: 11, padding: '2px 0' }}>✓ Working tree clean</div>
            : <>
              {info.status.slice(0, 12).map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 7, padding: '2px 0', fontSize: 11 }}>
                  <span className="mono" style={{ color: flagColor(s.flag), fontWeight: 700, width: 12, flexShrink: 0 }}>{s.flag}</span>
                  <span className="mono" style={{ color: 'var(--fg-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{s.file}</span>
                </div>
              ))}
              {info.status.length > 12 && <div style={{ fontSize: 10, color: 'var(--fg-3)', paddingTop: 2 }}>+{info.status.length - 12} more</div>}
              {info.diffStat && <div style={{ marginTop: 4, fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>{info.diffStat}</div>}
            </>
          }
        </section>

        {/* Commit */}
        <section>
          <SectionLabel>Commit</SectionLabel>
          <textarea
            value={commitMsg}
            onChange={e => setCommitMsg(e.target.value)}
            placeholder="Commit message…"
            rows={2}
            style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--line)', borderRadius: 6, background: 'var(--bg-2)', color: 'var(--fg-0)', fontSize: 11, fontFamily: 'var(--font-ui)', resize: 'none', outline: 'none', boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', gap: 5, marginTop: 5 }}>
            <button onClick={() => run('stage')} disabled={!!busy} style={smallBtn}>
              {busy === 'stage' ? '…' : '+ Stage all'}
            </button>
            <button
              onClick={() => { if (commitMsg.trim()) run('commit', { message: commitMsg }); setCommitMsg('') }}
              disabled={!commitMsg.trim() || !!busy}
              style={{ ...smallBtn, background: 'var(--accent)', color: 'var(--accent-fg)', border: 'none', flex: 1 }}
            >
              {busy === 'commit' ? '…' : '✓ Commit'}
            </button>
          </div>
        </section>

        {/* Remote */}
        {info.remotes.length > 0 && (
          <section>
            <SectionLabel>Remote · {info.remotes.join(', ')}</SectionLabel>
            <div style={{ display: 'flex', gap: 5 }}>
              <button onClick={() => run('pull')} disabled={!!busy} style={{ ...smallBtn, flex: 1 }}>
                {busy === 'pull' ? '…' : '↓ Pull'}
              </button>
              <button onClick={() => run('push', { branch: currentBranch?.name ?? '' })} disabled={!!busy} style={{ ...smallBtn, flex: 1 }}>
                {busy === 'push' ? '…' : '↑ Push'}
              </button>
            </div>
          </section>
        )}

        {/* Action log */}
        {log && (
          <section>
            <SectionLabel>Output</SectionLabel>
            <pre style={{ margin: 0, padding: '6px 8px', background: 'var(--bg-0)', border: '1px solid var(--line)', borderRadius: 6, fontSize: 10, color: 'var(--fg-1)', fontFamily: 'var(--font-mono)', whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 80, overflowY: 'auto' }}>{log}</pre>
          </section>
        )}

        {/* Commit log */}
        <section>
          <SectionLabel>History</SectionLabel>
          {info.log.length === 0 && <div style={{ color: 'var(--fg-3)', fontSize: 11 }}>No commits yet</div>}
          {info.log.map(c => (
            <div key={c.hash} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, padding: '5px 0', borderBottom: '1px solid var(--line)', fontSize: 11 }}>
              <span className="mono" style={{ color: 'var(--accent)', flexShrink: 0, fontSize: 10, paddingTop: 1, minWidth: 44 }}>{c.hash}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: 'var(--fg-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.msg}</div>
                <div style={{ color: 'var(--fg-3)', fontSize: 9.5, marginTop: 1 }}>{c.author} · {c.when}</div>
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--fg-3)', fontWeight: 500, marginBottom: 6, marginTop: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
      {children}
    </div>
  )
}

const smallBtn: React.CSSProperties = {
  padding: '4px 9px', border: '1px solid var(--line-strong)', borderRadius: 6,
  background: 'var(--bg-3)', color: 'var(--fg-1)', fontSize: 10.5,
  cursor: 'pointer', fontFamily: 'var(--font-ui)', whiteSpace: 'nowrap',
}

// ── User Stories card ─────────────────────────────────────────────────────────

function storyTypeColor(type?: string) {
  if (type === 'bug') return 'var(--err)'
  if (type === 'nfc') return '#5b9cf6'
  return 'var(--ok)'
}

function StoryTypeIcon({ type }: { type?: string }) {
  const s: React.CSSProperties = { width: 10, height: 10, flexShrink: 0 }
  if (type === 'bug') return <IBug style={{ ...s, color: storyTypeColor(type) }} />
  if (type === 'nfc') return <IStar style={{ ...s, color: storyTypeColor(type) }} />
  return <IUser style={{ ...s, color: storyTypeColor(type) }} />
}

function GenerateStoryButton({ projectId, sessionId }: { projectId?: string; sessionId: string }) {
  const { projectBrains, openrouterKey, orbitMessages, activeOrbitChatId, projects } = useAppStore()
  const [loading, setLoading] = useState(false)

  const generate = async () => {
    if (!openrouterKey) return
    setLoading(true)
    try {
      const brain = projectId ? projectBrains[projectId] : undefined
      const projectName = projects.find(p => p.id === projectId)?.name ?? projectId ?? 'Projekt'
      const chatId = activeOrbitChatId[sessionId]
      const recentMsgs: OrbitMessage[] = chatId ? (orbitMessages[chatId] ?? []).filter(m => !m.id?.endsWith('-err')).slice(-6) : []
      const prompt = buildUserStoryPrompt(brain, projectName, recentMsgs)
      window.dispatchEvent(new CustomEvent('cc:orbit-send', { detail: { sessionId, text: prompt } }))
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={generate}
      disabled={loading || !openrouterKey}
      title={openrouterKey ? 'User Story aus Projekt-Kontext generieren' : 'OpenRouter-Key erforderlich'}
      style={{
        background: 'none', border: 'none', cursor: openrouterKey ? 'pointer' : 'default',
        color: openrouterKey ? 'var(--accent)' : 'var(--fg-3)',
        display: 'flex', alignItems: 'center', padding: '0 2px',
        opacity: loading ? 0.5 : 1,
      }}
    >
      <ISpark style={{ width: 12, height: 12 }} />
    </button>
  )
}

function UserStoriesCard({ projectId: _projectId, sessionId }: { projectId?: string; sessionId: string }) {
  const { kanban, projects } = useAppStore()
  const [openTicket, setOpenTicket] = useState<{ projectId: string; projectName: string; projectPath: string; ticketId: string } | null>(null)

  const allTickets = projects.flatMap(p =>
    (kanban[p.id] ?? []).map(t => ({ ticket: t, project: p }))
  ).sort((a, b) => {
    const da = a.ticket.createdAt ? new Date(a.ticket.createdAt).getTime() : 0
    const db = b.ticket.createdAt ? new Date(b.ticket.createdAt).getTime() : 0
    return db - da
  })

  return (
    <>
      {openTicket && (
        <KanbanBoard
          projectId={openTicket.projectId}
          projectName={openTicket.projectName}
          projectPath={openTicket.projectPath}
          initialDetailId={openTicket.ticketId}
          onClose={() => setOpenTicket(null)}
        />
      )}
      <Card title={`Tasks${allTickets.length > 0 ? ` (${allTickets.length})` : ''}`} collapsible defaultOpen={false}>
        {allTickets.length === 0 ? (
          <div style={{ fontSize: 11, color: 'var(--fg-3)', fontStyle: 'italic' }}>Keine Tasks</div>
        ) : (
          allTickets.slice(0, 8).map(({ ticket: t, project: p }, i, arr) => (
            <div key={t.id} onClick={() => setOpenTicket({ projectId: p.id, projectName: p.name, projectPath: p.path, ticketId: t.id })}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', cursor: 'pointer', borderBottom: i < arr.length - 1 ? '1px solid var(--line)' : 'none' }}>
              <StoryTypeIcon type={t.type} />
              <span style={{ flex: 1, fontSize: 11, color: 'var(--fg-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
              <span style={{ fontSize: 9.5, color: 'var(--fg-3)', flexShrink: 0, textTransform: 'capitalize' }}>{t.status}</span>
            </div>
          ))
        )}
        {allTickets.length > 8 && (
          <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginTop: 4 }}>+{allTickets.length - 8} weitere</div>
        )}
      </Card>
    </>
  )
}

// ── Notes card ────────────────────────────────────────────────────────────────

function NotesCard({ sessionId }: { sessionId: string }) {
  const { notes, setNote } = useAppStore()
  const text = notes[sessionId] ?? ''

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNote(sessionId, e.target.value)
  }

  return (
    <Card title="Notes" action={<IEdit style={{ color: 'var(--fg-3)' }} />}>
      <textarea
        value={text}
        onChange={handleChange}
        placeholder="Write session notes here…"
        style={{
          width: '100%',
          minHeight: 100,
          background: 'var(--bg-2)',
          border: '1px solid var(--line)',
          borderRadius: 6,
          color: 'var(--fg-0)',
          fontSize: 11.5,
          fontFamily: 'var(--font-ui)',
          lineHeight: 1.55,
          padding: '7px 8px',
          outline: 'none',
          resize: 'vertical',
          boxSizing: 'border-box',
        }}
      />
    </Card>
  )
}

// ── main panel ────────────────────────────────────────────────────────────────

type ExportFmt = 'txt' | 'md' | 'json'

const EXPORT_OPTIONS: { value: ExportFmt; label: string; ext: string }[] = [
  { value: 'txt',  label: 'Terminal',  ext: '.txt' },
  { value: 'md',   label: 'Markdown',  ext: '.md'  },
  { value: 'json', label: 'JSON',      ext: '.json' },
]

function ExportPopover({ onSelect, onClose }: { onSelect: (fmt: ExportFmt) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    setTimeout(() => window.addEventListener('mousedown', h), 0)
    return () => window.removeEventListener('mousedown', h)
  }, [onClose])

  return (
    <div ref={ref} style={{ position: 'absolute', bottom: 'calc(100% + 4px)', left: 0, zIndex: 200, background: 'var(--bg-2)', border: '1px solid var(--line-strong)', borderRadius: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.35)', overflow: 'hidden', minWidth: 148 }}>
      <div style={{ padding: '8px 12px 5px', fontSize: 9.5, fontWeight: 700, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Exportieren als</div>
      {EXPORT_OPTIONS.map(opt => (
        <div
          key={opt.value}
          onClick={() => onSelect(opt.value)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 12px', cursor: 'pointer', fontSize: 12, color: 'var(--fg-0)', gap: 12 }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-3)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <span>{opt.label}</span>
          <span style={{ fontFamily: '"JetBrains Mono","Cascadia Code",Menlo,monospace', fontSize: 10, color: 'var(--fg-3)' }}>{opt.ext}</span>
        </div>
      ))}
      <div style={{ height: 6 }} />
    </div>
  )
}

function triggerDownload(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ── Chat history tab (for Orbit sessions) ─────────────────────────────────────
function formatChatDate(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr'
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Gestern'
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
}

function ChatTab({ projectId, sessionId }: { projectId: string; sessionId: string }) {
  const {
    orbitChats, orbitMessages, orbitMeta, setOrbitMeta,
    setActiveOrbitChat, activeOrbitChatId, removeOrbitChat,
    orbitFavorites, removeOrbitFavorite, createOrbitChat,
  } = useAppStore()

  const [pill, setPill] = useState<'chats' | 'favoriten'>('chats')
  const [query, setQuery] = useState('')
  const [hovered, setHovered] = useState<string | null>(null)

  const chatIds    = orbitChats[projectId] ?? []
  const activeChatId = activeOrbitChatId[sessionId] ?? ''
  const allFavs    = orbitFavorites[projectId] ?? []
  const favCount   = allFavs.length

  // Strip #chat: / #msg: prefix so copied IDs also match
  const normalizeQuery = (raw: string) =>
    raw.trim().toLowerCase().replace(/^#(?:chat|msg):/, '')

  const q = normalizeQuery(query)

  // ── Chats list ────────────────────────────────────────────────────────────
  const byRecent = [...chatIds].sort((a, b) => {
    const aLast = orbitMessages[a]?.at(-1)?.ts ?? orbitMeta[a]?.lastTs ?? 0
    const bLast = orbitMessages[b]?.at(-1)?.ts ?? orbitMeta[b]?.lastTs ?? 0
    return bLast - aLast
  })

  const filteredChats = q ? byRecent.filter(id => {
    const meta  = orbitMeta[id]
    const title = (meta?.title ?? orbitMessages[id]?.[0]?.content ?? '').toLowerCase()
    const body  = (orbitMessages[id] ?? []).map(m => m.content + (m.id ?? '')).join(' ').toLowerCase()
    const idStr = id.toLowerCase()
    return title.includes(q) || body.includes(q) || idStr.includes(q)
  }) : byRecent

  const pinnedChats   = filteredChats.filter(id => orbitMeta[id]?.pinned)
  const unpinnedChats = filteredChats.filter(id => !orbitMeta[id]?.pinned)

  // ── Favorites list ────────────────────────────────────────────────────────
  const chatFavs = allFavs.filter(f => f.kind === 'chat').sort((a, b) => b.ts - a.ts)
  const msgFavs  = allFavs.filter(f => f.kind === 'message').sort((a, b) => b.ts - a.ts)

  const filteredChatFavs = q ? chatFavs.filter(f => {
    const title = (f.chatTitle ?? orbitMeta[f.chatId]?.title ?? '').toLowerCase()
    return title.includes(q) || f.chatId.toLowerCase().includes(q)
  }) : chatFavs

  const filteredMsgFavs = q ? msgFavs.filter(f => {
    const content = (f.messageContent ?? '').toLowerCase()
    const id      = (f.messageId ?? '').toLowerCase()
    return content.includes(q) || id.includes(q) || (f.messageModel ?? '').toLowerCase().includes(q)
  }) : msgFavs

  // ── Render helpers ────────────────────────────────────────────────────────
  const renderChatItem = (chatId: string) => {
    const msgs: OrbitMessage[] = orbitMessages[chatId] ?? []
    const meta      = orbitMeta[chatId]
    const title     = meta?.title ?? msgs[0]?.content ?? 'Neuer Chat'
    const lastTs    = msgs.at(-1)?.ts ?? 0
    const isActive  = chatId === activeChatId
    const isHov     = hovered === chatId
    const isPinned  = meta?.pinned ?? false
    const modelLbl  = msgs.findLast(m => m.role === 'assistant')?.model

    return (
      <div
        key={chatId}
        onMouseEnter={() => setHovered(chatId)}
        onMouseLeave={() => setHovered(null)}
        onClick={() => setActiveOrbitChat(sessionId, chatId)}
        style={{ padding: '8px 10px', background: isActive ? 'var(--orbit)' : isHov ? 'rgba(0,0,0,0.04)' : 'transparent', borderRadius: 6, cursor: 'pointer', transition: 'background 0.1s', marginInline: 6 }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: isActive ? 600 : 400, color: isActive ? '#fff' : 'var(--fg-1)', overflow: 'hidden', whiteSpace: 'nowrap', maskImage: 'linear-gradient(to right, black 75%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to right, black 75%, transparent 100%)' }}>
              {title}
            </div>
            <div style={{ fontSize: 10, color: isActive ? 'rgba(255,255,255,0.7)' : 'var(--fg-3)', marginTop: 3 }}>
              <div>{lastTs ? formatChatDate(lastTs) : 'Neu'}</div>
              {modelLbl && <div style={{ marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{modelLbl}</div>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 2, alignItems: 'center', flexShrink: 0, opacity: isHov ? 1 : 0, transition: 'opacity 0.1s' }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setOrbitMeta(chatId, { pinned: !isPinned })} title={isPinned ? 'Losgelöst' : 'Anpinnen'} style={{ background: 'none', border: 'none', cursor: 'pointer', color: isPinned ? (isActive ? '#fff' : 'var(--orbit)') : (isActive ? 'rgba(255,255,255,0.7)' : 'var(--fg-3)'), padding: '2px 3px', display: 'flex', alignItems: 'center', borderRadius: 6 }}>
              <IBookmark style={{ width: 11, height: 11 }} />
            </button>
            <button onClick={() => removeOrbitChat(projectId, chatId)} title="Chat löschen" style={{ background: 'none', border: 'none', cursor: 'pointer', color: isActive ? 'rgba(255,255,255,0.7)' : 'var(--fg-3)', padding: '2px 3px', display: 'flex', alignItems: 'center', borderRadius: 6 }}>
              <ITrash style={{ width: 11, height: 11 }} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>

      {/* Search */}
      <div style={{ padding: '8px 10px 5px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-2)', border: '1px solid var(--line-strong)', borderRadius: 6, padding: '5px 8px' }}>
          <ISearch style={{ width: 11, height: 11, color: 'var(--fg-3)', flexShrink: 0 }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={pill === 'chats' ? 'Titel, Inhalt, ID…' : 'Inhalt, ID, Modell…'}
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 11.5, color: 'var(--fg-0)', fontFamily: 'var(--font-ui)' }}
          />
          {query && <IClose style={{ width: 10, height: 10, color: 'var(--fg-3)', cursor: 'pointer', flexShrink: 0 }} onClick={() => setQuery('')} />}
        </div>
      </div>

      {/* Pill bar + New Chat button */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 5, padding: '6px 10px 8px', flexShrink: 0, position: 'relative' }}>
        {(['chats', 'favoriten'] as const).map(p => {
          const active = pill === p
          return (
            <button
              key={p}
              onClick={() => setPill(p)}
              style={{ position: 'relative', padding: '3px 14px', borderRadius: 99, border: active ? '1px solid #a78bfa' : '1px solid rgba(167,139,250,0.25)', background: active ? 'rgba(167,139,250,0.18)' : 'transparent', color: active ? '#c4b5fd' : 'rgba(167,139,250,0.5)', fontSize: 10.5, fontWeight: active ? 600 : 400, cursor: 'pointer', fontFamily: 'var(--font-ui)', transition: 'all 0.12s' }}
            >
              {p === 'chats' ? 'Chats' : 'Favoriten'}
              {p === 'favoriten' && favCount > 0 && (
                <span style={{ position: 'absolute', top: -4, right: -4, fontSize: 7.5, fontWeight: 700, minWidth: 13, height: 13, borderRadius: 99, background: 'rgba(167,139,250,0.35)', border: '1px solid rgba(167,139,250,0.6)', color: '#e9d5ff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 2px', lineHeight: 1 }}>{favCount}</span>
              )}
            </button>
          )
        })}
        <button
          onClick={() => createOrbitChat(projectId, sessionId)}
          title="Neuer Chat"
          style={{ position: 'absolute', right: 10, background: 'var(--orbit)', border: 'none', borderRadius: 6, padding: '4px 6px', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center' }}
        >
          <IPlus style={{ width: 12, height: 12 }} />
        </button>
      </div>

      {/* Content */}
      {pill === 'chats' ? (
        chatIds.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--fg-3)', fontSize: 12, padding: 24, textAlign: 'center' }}>
            <IOrbit style={{ width: 28, height: 28, opacity: 0.3 }} />
            <span>Noch keine Orbit-Chats</span>
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', paddingTop: 2 }}>
            {pinnedChats.length > 0 && (
              <>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--fg-3)', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '4px 16px 6px' }}>Pinned</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginBottom: 10 }}>
                  {pinnedChats.map(renderChatItem)}
                </div>
              </>
            )}
            {unpinnedChats.length > 0 && (
              <>
                {pinnedChats.length > 0 && <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--fg-3)', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '4px 16px 6px' }}>Chats</div>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {unpinnedChats.map(renderChatItem)}
                </div>
              </>
            )}
            {filteredChats.length === 0 && q && (
              <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--fg-3)', fontSize: 11 }}>Keine Treffer für „{query}"</div>
            )}
          </div>
        )
      ) : (
        allFavs.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--fg-3)', fontSize: 12, padding: 24, textAlign: 'center' }}>
            <IBookmark style={{ width: 26, height: 26, opacity: 0.3 }} />
            <span>Noch keine Favoriten</span>
            <span style={{ fontSize: 10.5, lineHeight: 1.6, maxWidth: 180 }}>Nachrichten mit dem Stern-Symbol im Orbit-Chat markieren</span>
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', paddingTop: 2 }}>
            {filteredChatFavs.length > 0 && (
              <>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--fg-3)', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '4px 16px 6px' }}>Chats</div>
                {filteredChatFavs.map(fav => {
                  const title = fav.chatTitle ?? orbitMeta[fav.chatId]?.title ?? fav.chatId.slice(-8)
                  return (
                    <div key={fav.id} onClick={() => setActiveOrbitChat(sessionId, fav.chatId)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', marginInline: 6, cursor: 'pointer', borderRadius: 6, borderBottom: '1px solid var(--line)' }}>
                      <IOrbit style={{ width: 11, height: 11, color: 'var(--orbit)', flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: 11.5, color: 'var(--fg-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
                      <button onClick={e => { e.stopPropagation(); removeOrbitFavorite(projectId, fav.id) }} title="Aus Favoriten entfernen" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a78bfa', padding: '2px 3px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                        <IBookmark style={{ width: 11, height: 11 }} />
                      </button>
                    </div>
                  )
                })}
              </>
            )}
            {filteredMsgFavs.length > 0 && (
              <>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--fg-3)', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '4px 16px 6px', marginTop: filteredChatFavs.length > 0 ? 8 : 0 }}>Nachrichten</div>
                {filteredMsgFavs.map(fav => (
                  <div key={fav.id} onClick={() => setActiveOrbitChat(sessionId, fav.chatId)} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '7px 10px', marginInline: 6, cursor: 'pointer', borderRadius: 6, borderBottom: '1px solid var(--line)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 9.5, color: 'var(--fg-3)', marginBottom: 2, display: 'flex', gap: 4, alignItems: 'center' }}>
                        <span style={{ color: fav.messageRole === 'user' ? 'var(--orbit)' : 'var(--accent)', fontWeight: 600, textTransform: 'uppercase' }}>{fav.messageRole}</span>
                        {fav.messageModel && <><span style={{ opacity: 0.4 }}>·</span><span>{fav.messageModel}</span></>}
                        {fav.msgTs && <><span style={{ opacity: 0.4 }}>·</span><span>{formatChatDate(fav.msgTs)}</span></>}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--fg-1)', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                        {fav.messageContent}
                      </div>
                    </div>
                    <button onClick={e => { e.stopPropagation(); removeOrbitFavorite(projectId, fav.id) }} title="Aus Favoriten entfernen" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a78bfa', padding: '2px 3px', display: 'flex', alignItems: 'center', flexShrink: 0, marginTop: 2 }}>
                      <IBookmark style={{ width: 11, height: 11 }} />
                    </button>
                  </div>
                ))}
              </>
            )}
            {filteredChatFavs.length === 0 && filteredMsgFavs.length === 0 && q && (
              <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--fg-3)', fontSize: 11 }}>Keine Treffer für „{query}"</div>
            )}
          </div>
        )
      )}
    </div>
  )
}

// ── AI Search Tab ─────────────────────────────────────────────────────────────
// Approximate token cost per 1K output tokens (for known models)
const CS_PRICE_1K: Record<string, number> = {
  'claude-sonnet-4-6': 0.003, 'claude-opus-4': 0.015, 'claude-haiku-4-5': 0.00025,
  'gpt-4o': 0.005, 'gpt-4o-mini': 0.00015, 'deepseek-chat': 0.00028, 'deepseek-r1': 0.00219,
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--fg-3)', marginBottom: 7, marginTop: 2 }}>
      {label}
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1400) }).catch(() => {})
  }
  return (
    <button onClick={copy} title={copied ? 'Kopiert!' : 'Kopieren'} style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? 'var(--ok)' : 'var(--fg-3)', padding: '2px 4px', display: 'flex', alignItems: 'center', gap: 3, fontSize: 10 }}>
      <ICopy style={{ width: 10, height: 10 }} />
      {copied && <span>Kopiert</span>}
    </button>
  )
}

type SearchResult = { humanSummary: string; detailed: string; agentContext: string; inputTokens: number; outputTokens: number }

function AiSearchTab({ projectId }: { projectId: string }) {
  const { aiProviders, activeAiProvider, aiFunctionMap, supabaseUrl, supabaseAnonKey, currentUser, setInputValue, docTemplates } = useAppStore()
  const [query, setQuery]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [result, setResult]     = useState<SearchResult | null>(null)
  const [error, setError]       = useState('')
  const [msgCount, setMsgCount] = useState(0)
  const taRef    = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Auto-grow textarea
  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 140) + 'px'
  }, [query])

  // Esc → abort running search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && loading) stopSearch() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  const stopSearch = () => {
    abortRef.current?.abort()
    setLoading(false)
  }

  const search = async () => {
    if (!query.trim() || loading) return
    const providerId = aiFunctionMap['contextSearch'] || activeAiProvider || aiProviders[0]?.id
    const provider   = aiProviders.find(p => p.id === providerId) ?? aiProviders[0]
    if (!provider) { setError('Kein KI-Provider konfiguriert. Bitte unter Einstellungen → LLMs → KI Funktionen einrichten.'); return }

    const ctrl = new AbortController()
    abortRef.current = ctrl

    setLoading(true); setError(''); setResult(null)
    try {
      // 1. Load agent messages from Supabase
      type Msg = { role: string; content: string; ts: number; model?: string; source: 'agent' | 'orbit' }
      const msgs: Msg[] = []
      const sb = getSupabase(supabaseUrl, supabaseAnonKey)
      if (sb && currentUser?.id) {
        const agentMsgs = await loadLastProjectMessages(sb, currentUser.id, projectId, 200).catch(() => [])
        for (const m of agentMsgs) msgs.push({ role: m.role, content: m.content, ts: m.ts, model: m.model, source: 'agent' })
      }

      // 2. Load orbit chat messages from JSONL
      const listRes = await fetch(`/api/orbit/list-chats?projectId=${encodeURIComponent(projectId)}`, { signal: ctrl.signal }).catch(() => null)
      if (listRes?.ok) {
        const listData = await listRes.json() as { ok: boolean; chats: { chatId: string }[] }
        if (listData.ok) {
          for (const chat of (listData.chats ?? []).slice(0, 30)) {
            if (ctrl.signal.aborted) break
            const chatRes = await fetch(`/api/orbit/load-chat?projectId=${encodeURIComponent(projectId)}&chatId=${encodeURIComponent(chat.chatId)}`, { signal: ctrl.signal }).catch(() => null)
            if (!chatRes?.ok) continue
            const chatData = await chatRes.json() as { ok: boolean; messages: Array<{ role: string; content: string; ts: number; model?: string }> }
            if (chatData.ok) {
              for (const m of (chatData.messages ?? [])) msgs.push({ role: m.role, content: m.content, ts: m.ts, model: m.model, source: 'orbit' })
            }
          }
        }
      }

      if (ctrl.signal.aborted) return

      // Deduplicate + sort + truncate to 300 messages
      const sorted = msgs
        .filter((m, i, a) => a.findIndex(x => x.ts === m.ts && x.role === m.role && x.source === m.source) === i)
        .sort((a, b) => a.ts - b.ts)
        .slice(-300)
      setMsgCount(sorted.length)

      // 3. Call backend
      const customPrompt = docTemplates.find(t => t.id === 'ai-prompt-context-search')?.content
      const r = await fetch('/api/context-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), messages: sorted, provider: provider.provider, apiKey: provider.apiKey, model: provider.model, systemPromptOverride: customPrompt }),
        signal: ctrl.signal,
      })
      const d = await r.json() as SearchResult & { ok: boolean; error?: string }
      if (!d.ok) { setError(d.error ?? 'Unbekannter Fehler'); return }
      setResult(d)
    } catch (e) {
      if ((e as { name?: string }).name !== 'AbortError') setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  const insertToChatbox = () => {
    if (!result?.agentContext) return
    setInputValue(result.agentContext)
  }

  const costStr = (() => {
    if (!result) return null
    const provider = aiProviders.find(p => p.id === (aiFunctionMap['contextSearch'] || activeAiProvider || aiProviders[0]?.id))
    if (!provider) return null
    const key = Object.keys(CS_PRICE_1K).find(k => provider.model.includes(k))
    if (!key) return null
    const cost = (result.outputTokens / 1000) * CS_PRICE_1K[key]
    return cost < 0.0001 ? '<$0.0001' : `~$${cost.toFixed(4)}`
  })()

  const pill: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', padding: '2px 7px', borderRadius: 99, fontSize: 10, background: 'var(--bg-3)', border: '1px solid var(--line)', color: 'var(--fg-3)' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 12, gap: 10, minHeight: 0 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, paddingBottom: 6 }}>
        <img src={simpleLogo} alt="" style={{ width: 22, height: 22, flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--fg-0)', lineHeight: 1.2 }}>Kontext Search</div>
          <div style={{ fontSize: 9.5, color: 'var(--fg-3)', lineHeight: 1.2 }}>Durchsucht Agent + Orbit Chat-Verlauf</div>
        </div>
      </div>

      {/* Query input + button stacked — no gap, merged borders */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <textarea
          ref={taRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void search() } }}
          placeholder="Frage stellen… (z.B. chatbox, login, welche html seiten wurden aufgerufen)"
          style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', background: 'var(--bg-2)', border: '1px solid var(--line-strong)', borderTop: '1px solid var(--line-strong)', borderBottom: 'none', borderRadius: '4px 4px 0 0', color: 'var(--fg-0)', fontSize: 12, fontFamily: 'var(--font-ui)', outline: 'none', resize: 'none', lineHeight: 1.5, minHeight: 72, overflow: 'hidden' }}
        />
        <button
          onClick={loading ? stopSearch : () => void search()}
          disabled={!loading && !query.trim()}
          title={loading ? 'Abbrechen (Esc)' : 'Suchen (Enter)'}
          style={{ width: '100%', background: loading ? 'rgba(239,122,122,0.12)' : !query.trim() ? 'var(--bg-2)' : 'var(--accent)', border: loading ? '1px solid rgba(239,122,122,0.3)' : '1px solid var(--line-strong)', borderTop: 'none', borderRadius: '0 0 4px 4px', padding: '8px 10px', cursor: loading || query.trim() ? 'pointer' : 'default', color: loading ? 'var(--err)' : !query.trim() ? 'var(--fg-3)' : 'var(--accent-fg)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-ui)', transition: 'background 0.15s', boxSizing: 'border-box' }}
        >
          {loading
            ? <><IX style={{ width: 12, height: 12 }} /> Stopp</>
            : <><img src={simpleLogo} alt="" style={{ width: 13, height: 13, opacity: !query.trim() ? 0.35 : 1, filter: !query.trim() ? 'none' : 'brightness(10)' }} /> Kontext Search</>
          }
        </button>
      </div>

      {error && (
        <div style={{ padding: '7px 10px', background: 'rgba(239,122,122,0.07)', border: '1px solid rgba(239,122,122,0.25)', borderRadius: 6, fontSize: 11, color: 'var(--err)' }}>
          {error}
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--fg-3)', fontSize: 11, padding: '4px 0' }}>
          <ISpinner size={12} />
          <span>Durchsuche {msgCount > 0 ? `${msgCount} Nachrichten` : 'Projekt-Historie'}…</span>
          <span style={{ marginLeft: 'auto', fontSize: 9.5, opacity: 0.6 }}>Esc = Stopp</span>
        </div>
      )}

      {result && (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0 }}>

          {/* Human Summary */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 7 }}>
              <SectionHeader label="Zusammenfassung" />
              <span style={{ flex: 1 }} />
              <CopyButton text={result.humanSummary} />
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.7, color: 'var(--fg-1)', whiteSpace: 'pre-wrap' }}>{result.humanSummary}</div>
          </div>

          {/* Detailed */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 7 }}>
              <SectionHeader label="Detailliert" />
              <span style={{ flex: 1 }} />
              <CopyButton text={result.detailed} />
            </div>
            <div style={{ fontSize: 11.5, lineHeight: 1.7, color: 'var(--fg-2)', whiteSpace: 'pre-wrap', fontFamily: 'var(--font-ui)' }}>{result.detailed}</div>
          </div>

          {/* Agent Context */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
              <SectionHeader label="Für KI-Agent" />
              <span style={{ flex: 1 }} />
              <CopyButton text={result.agentContext} />
              <button
                onClick={insertToChatbox}
                title="Als Entwurf in Chatbox einfügen"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 99, border: '1px solid var(--accent-line)', background: 'var(--accent-soft)', color: 'var(--accent)', fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)' }}
              >
                <ISend style={{ width: 10, height: 10 }} />
                Chatbox
              </button>
            </div>
            <div style={{ padding: '8px 10px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6, fontSize: 11, lineHeight: 1.65, color: 'var(--fg-1)', whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)' }}>
              {result.agentContext}
            </div>
          </div>

          {/* Token stats */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingBottom: 4 }}>
            <span style={pill}>↑ {result.inputTokens.toLocaleString('de-DE')} tk</span>
            <span style={pill}>↓ {result.outputTokens.toLocaleString('de-DE')} tk</span>
            {costStr && <span style={{ ...pill, color: 'var(--ok)' }}>{costStr}</span>}
            <span style={{ ...pill, color: 'var(--fg-3)' }}>{msgCount} Nachrichten durchsucht</span>
          </div>
        </div>
      )}
    </div>
  )
}

export function UtilityPanel() {
  const [tab, setTab] = useState(0)
  const [exporting, setExporting]  = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [tabConfig, setTabConfig] = useState<{ githubMode: 'github' | 'advanced' | 'none'; showFiles: boolean; showResearch: boolean }>({ githubMode: 'github', showFiles: true, showResearch: true })
  const [tabConfigOpen, setTabConfigOpen] = useState(false)
  const tabConfigRef = React.useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!tabConfigOpen) return
    const handler = (e: MouseEvent) => { if (tabConfigRef.current && !tabConfigRef.current.contains(e.target as Node)) setTabConfigOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [tabConfigOpen])
  const { aliases, activeSessionId, projects, activeProjectId, createOrbitChat } = useAppStore()
  const project = projects.find(p => p.id === activeProjectId)
  const session = project?.sessions.find(s => s.id === activeSessionId)
  const activeAlias = aliases.find(a => a.name === session?.alias)

  const modelLabel = (() => {
    if (!activeAlias) return session?.alias ?? '—'
    const m = activeAlias.args.match(/--model\s+(\S+)/)
    return m ? m[1] : activeAlias.cmd
  })()

  const startedLabel = session?.startedAt
    ? `${formatTime(session.startedAt)} · ${formatElapsed(Date.now() - session.startedAt)}`
    : '—'

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExport = (fmt: ExportFmt) => {
    if (!session) return
    setExporting(true)

    const onText = (e: Event) => {
      const raw = (e as CustomEvent<string>).detail
      window.removeEventListener('cc:terminal-text', onText)
      setExporting(false)

      const ts = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-')
      const base = `${session.name.replace(/[^a-z0-9]/gi, '_')}_${ts}`

      if (fmt === 'txt') {
        triggerDownload(raw, `${base}.txt`)
      } else if (fmt === 'md') {
        const md = `# Terminal: ${session.name}\n\n_Alias: ${session.alias} · Exported: ${new Date().toLocaleString()}_\n\n\`\`\`\n${raw}\n\`\`\`\n`
        triggerDownload(md, `${base}.md`)
      } else {
        const obj = {
          session: session.name,
          alias: session.alias,
          project: project?.name,
          path: project?.path,
          branch: project?.branch,
          exportedAt: new Date().toISOString(),
          content: raw,
        }
        triggerDownload(JSON.stringify(obj, null, 2), `${base}.json`)
      }
    }

    window.addEventListener('cc:terminal-text', onText)
    window.dispatchEvent(new CustomEvent('cc:terminal-export', { detail: session.id }))

    setTimeout(() => {
      window.removeEventListener('cc:terminal-text', onText)
      setExporting(false)
    }, 2000)
  }

  // Data Viewer state — per project: map of projectId → list of open file paths
  const [dataFilesByProject, setDataFilesByProject] = useState<Record<string, string[]>>({})
  const [dataActiveByProject, setDataActiveByProject] = useState<Record<string, number>>({})
  const projId = activeProjectId ?? ''
  const dataFiles  = dataFilesByProject[projId]  ?? []
  const dataActive = dataActiveByProject[projId] ?? 0

  const openDataFile = (filePath: string) => {
    setDataFilesByProject(prev => {
      const current = prev[projId] ?? []
      const idx = current.indexOf(filePath)
      if (idx !== -1) {
        setDataActiveByProject(p => ({ ...p, [projId]: idx }))
        return prev
      }
      const next = [...current, filePath]
      setDataActiveByProject(p => ({ ...p, [projId]: next.length - 1 }))
      return { ...prev, [projId]: next }
    })
    setTab(isOrbitSession ? 5 : 4)
  }

  const closeDataFile = (i: number) => {
    setDataFilesByProject(prev => {
      const current = prev[projId] ?? []
      const next = current.filter((_, j) => j !== i)
      setDataActiveByProject(p => ({ ...p, [projId]: Math.min(dataActive, Math.max(0, next.length - 1)) }))
      return { ...prev, [projId]: next }
    })
  }

  // Listen for "open in Data Viewer" events dispatched by the Files tab
  useEffect(() => {
    const handler = (e: Event) => {
      const filePath = (e as CustomEvent<string>).detail
      openDataFile(filePath)
    }
    window.addEventListener('cc:open-data-file', handler)
    return () => window.removeEventListener('cc:open-data-file', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projId])

  // Jump to GitHub tab when sidebar git icon is clicked
  useEffect(() => {
    const handler = () => setTab(isOrbitSession ? 2 : 1)
    window.addEventListener('cc:goto-git-tab', handler)
    return () => window.removeEventListener('cc:goto-git-tab', handler)
  }, [])

  // Dirty file count for GitHub tab badge
  const [gitDirty, setGitDirty] = useState(0)
  useEffect(() => {
    if (!project?.path) { setGitDirty(0); return }
    fetch(`/api/git?path=${encodeURIComponent(project.path)}`)
      .then(r => r.json())
      .then((d: { ok?: boolean; status?: { flag: string }[] }) => {
        setGitDirty(d.ok ? (d.status ?? []).filter(s => s.flag !== '??').length : 0)
      })
      .catch(() => setGitDirty(0))
  }, [project?.path])

  // Check if active session is orbit
  const isOrbitSession = session?.kind === 'orbit'

  // Tab indices:
  // non-orbit: 0=Session 1=GitHub 2=GitAdvanced 3=Files 4=Data 5=Research [6=Terminal]
  // orbit:     0=Chat   1=Session 2=GitHub 3=GitAdvanced 4=Files 5=Data 6=Research [7=Terminal]
  const ghIdx       = isOrbitSession ? 2 : 1
  const gitAdvIdx   = isOrbitSession ? 3 : 2
  const filesIdx    = isOrbitSession ? 4 : 3
  const dataIdx     = isOrbitSession ? 5 : 4
  const researchIdx = isOrbitSession ? 6 : 5

  // Auto-switch away from Data tab when files are closed
  useEffect(() => {
    if (tab === dataIdx && dataFiles.length === 0) setTab(0)
  }, [dataFiles.length, tab, dataIdx])

  // ── Project Terminal tab ──────────────────────────────────────────────────
  const [terminalOpen, setTerminalOpen] = useState(false)
  const termSessionId = `__proj_term_${activeProjectId ?? 'none'}`

  useEffect(() => {
    const handler = () => {
      setTerminalOpen(true)
      setTimeout(() => {
        setTab(isOrbitSession ? 7 : 6)
      }, 0)
    }
    window.addEventListener('cc:open-project-terminal', handler)
    return () => window.removeEventListener('cc:open-project-terminal', handler)
  }, [isOrbitSession])

  // Tab order: Session | GitHub | Git Advanced | Dateien | Data | Research [| Terminal]
  const baseTabs = isOrbitSession
    ? ['Chat', 'Session', 'GitHub', 'Git Advanced', 'Dateien', 'Data', 'Research']
    : ['Session', 'GitHub', 'Git Advanced', 'Dateien', 'Data', 'Research']
  const tabs = terminalOpen ? [...baseTabs, 'Terminal'] : baseTabs

  // Reset tab if it becomes hidden via config
  useEffect(() => {
    const hidden =
      (tab === ghIdx     && tabConfig.githubMode !== 'github') ||
      (tab === gitAdvIdx && tabConfig.githubMode !== 'advanced') ||
      (tab === filesIdx  && !tabConfig.showFiles) ||
      (tab === researchIdx && !tabConfig.showResearch)
    if (hidden) setTab(0)
  }, [tabConfig, tab, ghIdx, gitAdvIdx, filesIdx, researchIdx])
  const terminalTabIdx = terminalOpen ? tabs.length - 1 : -1
  // tabs with no padding (full-bleed): Chat, Files, Data, Terminal
  const noPaddingBase = isOrbitSession ? [0, 4, 5] : [3, 4]
  const noPadding = terminalOpen ? [...noPaddingBase, terminalTabIdx] : noPaddingBase

  return (
    <aside style={{ width: '100%', flexShrink: 0, background: 'var(--bg-1)', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div style={{ display: 'flex', flexShrink: 0, borderBottom: '1px solid var(--line)', position: 'relative' }}>
        {tabs.map((t, i) => {
          if (t === 'Data' && dataFiles.length === 0) return null
          if (t === 'GitHub'      && tabConfig.githubMode !== 'github')   return null
          if (t === 'Git Advanced' && tabConfig.githubMode !== 'advanced') return null
          if (t === 'Dateien'     && !tabConfig.showFiles)                 return null
          if (t === 'Research'    && !tabConfig.showResearch)              return null
          const isTermTab = t === 'Terminal'
          const active = i === tab
          return (
            <div key={t} onClick={() => setTab(i)} style={{
              flex: isTermTab ? 'none' : 1,
              padding: isTermTab ? '8px 6px 8px 10px' : '8px 0',
              textAlign: 'center', fontSize: 10.5,
              color: active ? 'var(--fg-0)' : 'var(--fg-2)',
              borderBottom: active ? `2px solid ${isOrbitSession ? 'var(--orbit)' : 'var(--accent)'}` : '2px solid transparent',
              cursor: 'pointer', fontWeight: active ? 600 : 400, marginBottom: -1,
              position: 'relative',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            }}>
              <span style={{ fontSize: 10.5 }}>{t}</span>
              {t === 'GitHub' && gitDirty > 0 && (
                <span title={`${gitDirty} geänderte Dateien`} style={{ position: 'absolute', top: 4, right: 4, fontSize: 8, fontWeight: 700, minWidth: 12, height: 12, borderRadius: 99, background: 'rgba(244,195,101,0.18)', border: '1px solid rgba(244,195,101,0.4)', color: 'var(--warn)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 2px', lineHeight: 1 }}>{gitDirty}</span>
              )}
              {isTermTab && (
                <button
                  onClick={e => { e.stopPropagation(); setTerminalOpen(false); setTab(0) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-3)', display: 'flex', alignItems: 'center', padding: '1px 2px', borderRadius: 3, flexShrink: 0 }}
                  title="Terminal schließen"
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--fg-1)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--fg-3)')}
                >
                  <IClose style={{ width: 9, height: 9 }} />
                </button>
              )}
            </div>
          )
        })}

        {/* ── Tab visibility settings ── */}
        <div ref={tabConfigRef} style={{ display: 'flex', alignItems: 'center', flexShrink: 0, borderLeft: '1px solid var(--line)', position: 'relative' }}>
          <button
            onClick={() => setTabConfigOpen(o => !o)}
            title="Tabs ein-/ausblenden"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 8px', height: '100%', display: 'flex', alignItems: 'center', gap: 3, color: tabConfigOpen ? 'var(--fg-0)' : 'var(--fg-3)' }}
          >
            <ISliders style={{ width: 12, height: 12 }} />
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, opacity: 0.8 }} />
          </button>

          {tabConfigOpen && (
            <div style={{ position: 'absolute', top: '100%', right: 0, zIndex: 200, background: 'var(--bg-2)', border: '1px solid var(--line-strong)', borderRadius: 8, padding: '12px 14px', minWidth: 190, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--fg-3)', marginBottom: 2 }}>Tabs anzeigen</div>

              {/* Files toggle */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--fg-1)' }}>
                <input type="checkbox" checked={tabConfig.showFiles} onChange={e => setTabConfig(c => ({ ...c, showFiles: e.target.checked }))}
                  style={{ accentColor: 'var(--accent)', width: 13, height: 13, cursor: 'pointer' }} />
                Dateien
              </label>

              <div style={{ height: 1, background: 'var(--line)', margin: '2px 0' }} />

              {/* GitHub — mutually exclusive */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--fg-3)' }}>GitHub</div>
                {(['github', 'advanced', 'none'] as const).map(mode => (
                  <label key={mode} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--fg-1)' }}>
                    <input type="radio" name="githubMode" checked={tabConfig.githubMode === mode}
                      onChange={() => setTabConfig(c => ({ ...c, githubMode: mode }))}
                      style={{ accentColor: 'var(--accent)', width: 13, height: 13, cursor: 'pointer' }} />
                    {mode === 'github' ? 'GitHub' : mode === 'advanced' ? 'Git Advanced' : 'Keines'}
                  </label>
                ))}
              </div>

              <div style={{ height: 1, background: 'var(--line)', margin: '2px 0' }} />

              {/* Research toggle */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--fg-1)' }}>
                <input type="checkbox" checked={tabConfig.showResearch} onChange={e => setTabConfig(c => ({ ...c, showResearch: e.target.checked }))}
                  style={{ accentColor: 'var(--accent)', width: 13, height: 13, cursor: 'pointer' }} />
                Research
              </label>

              {/* Terminal toggle */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--fg-1)' }}>
                <input type="checkbox" checked={terminalOpen}
                  onChange={e => {
                    if (e.target.checked) {
                      setTerminalOpen(true)
                      setTimeout(() => setTab(isOrbitSession ? 7 : 6), 0)
                    } else {
                      if (tab === terminalTabIdx) setTab(0)
                      setTerminalOpen(false)
                    }
                  }}
                  style={{ accentColor: 'var(--accent)', width: 13, height: 13, cursor: 'pointer' }} />
                Terminal
              </label>
            </div>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: noPadding.includes(tab) ? 'hidden' : 'auto', padding: noPadding.includes(tab) ? 0 : 14, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

        {/* ── Tab 0: Chat (orbit only) ── */}
        {isOrbitSession && tab === 0 && project && session && <ChatTab projectId={project.id} sessionId={session.id} />}

        {/* ── Tab Session ── */}
        {tab === (isOrbitSession ? 1 : 0) && (
          <>
            <div style={{ marginBottom: 20, paddingTop: 14 }}>
              {/* ── Session-Header card ── */}
              <div style={{ background: 'var(--bg-2)', border: '0.5px solid var(--line-strong)', borderRadius: 10, padding: '10px 12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                {/* Name row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  {isOrbitSession
                    ? <IOrbit style={{ width: 13, height: 13, color: 'var(--orbit)', flexShrink: 0 }} />
                    : session
                      ? session.kind === 'openrouter-claude'
                        ? <ISpark style={{ width: 13, height: 13, color: 'var(--accent)', flexShrink: 0 }} />
                        : <ITerminal style={{ width: 13, height: 13, color: 'var(--fg-2)', flexShrink: 0 }} />
                      : <IFolder style={{ width: 13, height: 13, color: 'var(--fg-2)', flexShrink: 0 }} />
                  }
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {session?.name ?? project?.name ?? '—'}
                  </span>
                  {session && (
                    <span style={{
                      width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                      background: session.status === 'active' ? 'var(--ok)' : session.status === 'error' ? 'var(--err)' : 'var(--fg-3)',
                      ...(session.status === 'active' ? { animation: 'cc-pulse 1.4s ease-in-out infinite' } : {}),
                    }} />
                  )}
                </div>
                {/* ── Info-Felder ── */}
                <FieldPath label="Pfad" path={project?.path ?? '—'} />
                {session?.startedAt && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', fontSize: 11.5 }}>
                    <span style={{ width: 60, color: 'var(--fg-3)', flexShrink: 0 }}>Aktiv seit</span>
                    <span style={{ color: 'var(--fg-1)' }}>{startedLabel}</span>
                    <button
                      onClick={() => window.dispatchEvent(new CustomEvent('cc:clear-agent-session', { detail: session.id }))}
                      style={{ marginLeft: 'auto', background: 'none', border: '1px solid var(--line-strong)', padding: '2px 8px', borderRadius: 4, fontSize: 10, color: 'var(--fg-3)', cursor: 'pointer', fontFamily: 'var(--font-ui)' }}
                      title="Chat leeren & Kontext zurücksetzen"
                    >clear</button>
                  </div>
                )}
              </div>
            </div>

            {/* ── GitHub Kompakt-Kachel ── */}
            {project?.path && (
              <div style={{ marginBottom: 20 }}>
                <CompactGitCard projectPath={project.path} onOpenGitTab={() => setTab(ghIdx)} />
              </div>
            )}

            {/* ── Quick Links ── */}
            <QuickLinksWidget />

            <UserStoriesCard projectId={project?.id} sessionId={session?.id ?? ''} />
          </>
        )}

        {/* ── Tab GitHub ── */}
        {tab === ghIdx && project && <GitHubTab projectPath={project.path} projectName={project.name} />}
        {tab === ghIdx && !project && (
          <div style={{ textAlign: 'center', color: 'var(--fg-3)', fontSize: 12, marginTop: 40 }}>Kein Workspace ausgewählt</div>
        )}

        {/* ── Tab Git Advanced ── */}
        {tab === gitAdvIdx && project && <GitTab projectPath={project.path} />}
        {tab === gitAdvIdx && !project && (
          <div style={{ textAlign: 'center', color: 'var(--fg-3)', fontSize: 12, marginTop: 40 }}>Kein Workspace ausgewählt</div>
        )}

        {/* ── Tab Files ── */}
        {tab === filesIdx && project && <FilesTab projectName={project.name} projectPath={project.path} />}
        {tab === filesIdx && !project && (
          <div style={{ textAlign: 'center', color: 'var(--fg-3)', fontSize: 12, marginTop: 40 }}>Kein Workspace ausgewählt</div>
        )}

        {/* ── Tab Data Viewer ── */}
        {tab === dataIdx && (
          <DataViewer
            files={dataFiles}
            activeIdx={dataActive}
            onSelect={(i) => setDataActiveByProject(p => ({ ...p, [projId]: i }))}
            onClose={closeDataFile}
          />
        )}

        {/* ── Tab AI Search ── */}
        {tab === researchIdx && project && <AiSearchTab projectId={project.id} />}
        {tab === researchIdx && !project && (
          <div style={{ textAlign: 'center', color: 'var(--fg-3)', fontSize: 12, marginTop: 40 }}>Kein Workspace ausgewählt</div>
        )}

        {/* ── Tab Terminal ── */}
        {terminalOpen && tab === terminalTabIdx && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>
            {project
              ? <XTermPane sessionId={termSessionId} cmd="zsh" args="" cwd={project.path} />
              : <div style={{ textAlign: 'center', color: 'var(--fg-3)', fontSize: 12, marginTop: 40 }}>Kein Workspace ausgewählt</div>
            }
          </div>
        )}

      </div>

      {/* ── Git info bar ── */}
      <GitInfoBar projectPath={project?.path} />

    </aside>
  )
}

// ── Data Viewer ───────────────────────────────────────────────────────────────

const dvBtn: React.CSSProperties = {
  background: 'transparent', border: '1px solid var(--line)', borderRadius: 3,
  color: 'var(--fg-2)', fontSize: 9.5, padding: '2px 5px', cursor: 'pointer',
  fontFamily: 'var(--font-ui)', flexShrink: 0,
}

function DataViewer({ files, activeIdx, onSelect, onClose }: {
  files: string[]
  activeIdx: number
  onSelect: (i: number) => void
  onClose: (i: number) => void
}) {
  const [content, setContent]       = useState<string | null>(null)
  const [error, setError]           = useState('')
  const [mtime, setMtime]           = useState(0)
  const [search, setSearch]         = useState('')
  const [showLineNums, setShowLineNums] = useState(true)
  const [editMode, setEditMode]     = useState(false)
  const [editText, setEditText]     = useState('')
  const [history, setHistory]       = useState<string[]>([])
  const [hIdx, setHIdx]             = useState(0)
  const [dirty, setDirty]           = useState(false)
  const [replaceStr, setReplaceStr] = useState('')
  const [showReplace, setShowReplace] = useState(false)
  const [saving, setSaving]         = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const activeFile = files[activeIdx] ?? null

  const load = (path: string) => {
    fetch(`/api/file-read?path=${encodeURIComponent(path)}`)
      .then(r => r.json())
      .then((d: { ok: boolean; content?: string; mtime?: number; error?: string }) => {
        if (d.ok) { setContent(d.content ?? ''); setMtime(d.mtime ?? 0); setError('') }
        else setError(d.error ?? 'Error')
      })
      .catch(e => setError(String(e)))
  }

  // Load on file change; pause polling while editing
  useEffect(() => {
    if (!activeFile) { setContent(null); setError(''); return }
    setSearch(''); setEditMode(false); setDirty(false); setShowReplace(false)
    load(activeFile)
    const iv = setInterval(() => { if (!editMode) load(activeFile) }, 3000)
    return () => clearInterval(iv)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFile])

  const enterEdit = (initial: string) => {
    setEditText(initial); setHistory([initial]); setHIdx(0); setDirty(false); setEditMode(true)
  }

  const handleEditChange = (val: string) => {
    setEditText(val); setDirty(true)
    const next = [...history.slice(0, hIdx + 1), val].slice(-300)
    setHistory(next); setHIdx(next.length - 1)
  }

  const undo = () => { if (hIdx > 0) { setHIdx(hIdx - 1); setEditText(history[hIdx - 1]) } }
  const redo = () => { if (hIdx < history.length - 1) { setHIdx(hIdx + 1); setEditText(history[hIdx + 1]) } }

  const saveFile = async () => {
    if (!activeFile || saving) return
    setSaving(true)
    try {
      const r = await fetch('/api/file-write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: activeFile, content: editText }),
      })
      const d = await r.json() as { ok: boolean; error?: string }
      if (d.ok) { setDirty(false); setContent(editText) }
      else alert(`Fehler: ${d.error}`)
    } catch (e) { alert(String(e)) }
    finally { setSaving(false) }
  }

  const replaceFirst = () => {
    if (!search || !editMode) return
    const idx = editText.toLowerCase().indexOf(search.toLowerCase())
    if (idx === -1) return
    handleEditChange(editText.slice(0, idx) + replaceStr + editText.slice(idx + search.length))
  }

  const replaceAll = () => {
    if (!search || !editMode) return
    const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
    handleEditChange(editText.replace(regex, replaceStr))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const mod = e.metaKey || e.ctrlKey
    if (mod && e.key === 's') { e.preventDefault(); saveFile() }
    if (mod && !e.shiftKey && e.key === 'z') { e.preventDefault(); undo() }
    if (mod && e.shiftKey && e.key === 'z') { e.preventDefault(); redo() }
  }

  if (files.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px', gap: 0 }}>
        {/* Icon */}
        <div style={{ width: 52, height: 52, borderRadius: 6, background: 'var(--bg-2)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <IFileText style={{ width: 24, height: 24, color: 'var(--accent)' }} />
        </div>

        {/* Heading */}
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)', marginBottom: 8, letterSpacing: -0.2 }}>Keine Datei geöffnet</div>

        {/* Description */}
        <div style={{ fontSize: 11, color: 'var(--fg-3)', lineHeight: 1.75, textAlign: 'center', marginBottom: 20 }}>
          Im <span style={{ color: 'var(--fg-1)', fontWeight: 600 }}>Files</span>-Tab mit der rechten Maustaste<br />
          auf eine Datei klicken und<br />
          <span style={{ color: 'var(--accent)', fontStyle: 'italic' }}>Im Data Viewer öffnen</span> wählen.
        </div>

        {/* Supported types */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
          {[
            { ext: 'JSON', color: '#f0a500' },
            { ext: 'CSV', color: '#28c941' },
            { ext: 'TXT', color: 'var(--fg-2)' },
            { ext: 'LOG', color: 'var(--info)' },
          ].map(({ ext, color }) => (
            <div key={ext} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', borderRadius: 6, background: 'var(--bg-2)', border: '1px solid var(--line)' }}>
              <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 0.5, color, fontFamily: 'var(--font-mono)', minWidth: 28 }}>{ext}</span>
              <span style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>
                {ext === 'JSON' && 'Baumansicht + Suche'}
                {ext === 'CSV' && 'Tabellenansicht'}
                {ext === 'TXT' && 'Text mit Zeilennummern'}
                {ext === 'LOG' && 'Log-Viewer + Filter'}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const ext = activeFile ? activeFile.split('.').pop()?.toLowerCase() ?? '' : ''
  const isJson = ext === 'json'
  const lowerSearch = search.toLowerCase()

  // Try to parse JSON for tree view (only when no active search)
  // Pretty-print JSON for both tree view and text search
  const displayContent = isJson && content
    ? (() => { try { return JSON.stringify(JSON.parse(content), null, 2) } catch { return content } })()
    : content

  let parsedJson: unknown = undefined
  if (isJson && displayContent && !search) {
    try { parsedJson = JSON.parse(displayContent) } catch { /* fall through */ }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* File tabs */}
      <div style={{ display: 'flex', overflowX: 'auto', borderBottom: '1px solid var(--line)', flexShrink: 0, background: 'var(--bg-0)' }}>
        {files.map((f, i) => {
          const name = f.split('/').pop() ?? f
          return (
            <div
              key={f}
              onClick={() => onSelect(i)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', fontSize: 10.5, cursor: 'pointer', whiteSpace: 'nowrap', borderRight: '1px solid var(--line)', background: i === activeIdx ? 'var(--bg-1)' : 'transparent', color: i === activeIdx ? 'var(--fg-0)' : 'var(--fg-3)', borderBottom: i === activeIdx ? '2px solid var(--accent)' : '2px solid transparent' }}
            >
              <FileIcon name={name} />
              <span>{name}</span>
              <IClose
                style={{ width: 9, height: 9, marginLeft: 4, color: 'var(--fg-3)', cursor: 'pointer', flexShrink: 0 }}
                onClick={(e: React.MouseEvent) => { e.stopPropagation(); onClose(i) }}
              />
            </div>
          )
        })}
      </div>

      {/* Toolbar: path + search + line number toggle */}
      {activeFile && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderBottom: '1px solid var(--line)', flexShrink: 0, background: 'var(--bg-0)' }}>
          <span className="mono" style={{ flex: 1, fontSize: 9.5, color: 'var(--fg-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {activeFile}
            {mtime > 0 && <span style={{ marginLeft: 6, opacity: 0.6 }}>· {new Date(mtime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>}
          </span>
          {/* Line number toggle */}
          <button
            onClick={() => setShowLineNums(v => !v)}
            title="Zeilennummern ein/aus"
            style={{ background: showLineNums ? 'var(--accent-soft)' : 'transparent', border: `1px solid ${showLineNums ? 'var(--accent-line)' : 'var(--line)'}`, borderRadius: 3, color: showLineNums ? 'var(--accent)' : 'var(--fg-3)', fontSize: 9.5, padding: '2px 5px', cursor: 'pointer', fontFamily: 'var(--font-mono)', flexShrink: 0 }}
          >#</button>
          {/* Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, border: '1px solid var(--line)', borderRadius: 6, background: 'var(--bg-2)', padding: '2px 6px', flexShrink: 0 }}>
            <ISearch style={{ width: 10, height: 10, color: 'var(--fg-3)' }} />
            <input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Suchen…"
              style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 10.5, color: 'var(--fg-0)', fontFamily: 'var(--font-ui)', width: 80 }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--fg-3)', display: 'flex', alignItems: 'center' }}>
                <IClose style={{ width: 8, height: 8 }} />
              </button>
            )}
          </div>
          {/* S&E toggle */}
          <button
            onClick={() => {
              const next = !showReplace
              setShowReplace(next)
              if (next && !editMode && displayContent != null) enterEdit(displayContent)
            }}
            title="Suchen & Ersetzen"
            style={{ ...dvBtn, background: showReplace ? 'var(--accent-soft)' : 'transparent', border: `1px solid ${showReplace ? 'var(--accent-line)' : 'var(--line)'}`, color: showReplace ? 'var(--accent)' : 'var(--fg-2)' }}
          >S&amp;E</button>
          <span style={{ width: 1, height: 12, background: 'var(--line)', flexShrink: 0 }} />
          {/* Undo */}
          <button onClick={() => { if (!editMode && displayContent != null) enterEdit(displayContent); else undo() }} disabled={editMode && hIdx <= 0} title="Rückgängig (⌘Z)" style={{ ...dvBtn, opacity: editMode && hIdx <= 0 ? 0.35 : 1 }}>↩</button>
          {/* Redo */}
          <button onClick={redo} disabled={!editMode || hIdx >= history.length - 1} title="Wiederholen (⌘⇧Z)" style={{ ...dvBtn, opacity: !editMode || hIdx >= history.length - 1 ? 0.35 : 1 }}>↪</button>
          {/* Save */}
          {dirty && (
            <button onClick={saveFile} disabled={saving} title="Speichern (⌘S)" style={{ ...dvBtn, background: 'var(--accent)', color: 'var(--accent-fg)', border: 'none', fontWeight: 600 }}>
              {saving ? '…' : '↓ Speichern'}
            </button>
          )}
        </div>
      )}

      {/* Search & Replace row */}
      {activeFile && showReplace && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 8px', borderBottom: '1px solid var(--line)', flexShrink: 0, background: 'var(--bg-0)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, border: '1px solid var(--line)', borderRadius: 6, background: 'var(--bg-2)', padding: '2px 6px', flex: 1 }}>
            <ISearch style={{ width: 10, height: 10, color: 'var(--fg-3)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Suchen…" style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 10.5, color: 'var(--fg-0)', fontFamily: 'var(--font-ui)', width: '100%' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, border: '1px solid var(--line)', borderRadius: 6, background: 'var(--bg-2)', padding: '2px 6px', flex: 1 }}>
            <input value={replaceStr} onChange={e => setReplaceStr(e.target.value)} placeholder="Ersetzen durch…" style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 10.5, color: 'var(--fg-0)', fontFamily: 'var(--font-ui)', width: '100%' }} />
          </div>
          <button onClick={replaceFirst} disabled={!search} style={{ ...dvBtn, opacity: !search ? 0.4 : 1 }}>Ersetzen</button>
          <button onClick={replaceAll} disabled={!search} style={{ ...dvBtn, opacity: !search ? 0.4 : 1 }}>Alle</button>
          <IClose style={{ width: 9, height: 9, color: 'var(--fg-3)', cursor: 'pointer', flexShrink: 0 }} onClick={() => setShowReplace(false)} />
        </div>
      )}

      {/* Edit mode indicator */}
      {editMode && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 8px', background: dirty ? 'rgba(244,195,101,0.07)' : 'var(--bg-0)', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
          <span style={{ fontSize: 9.5, color: dirty ? 'var(--warn)' : 'var(--ok)', fontWeight: 500 }}>{dirty ? '● Nicht gespeichert' : '✓ Gespeichert'}</span>
          <span style={{ flex: 1 }} />
          <button onClick={() => { setEditMode(false); setDirty(false); setShowReplace(false) }} style={{ ...dvBtn, fontSize: 9 }}>Vorschau</button>
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
        {error && <div style={{ padding: 14, color: 'var(--err)', fontSize: 11 }}>{error}</div>}
        {!error && content === null && <div style={{ padding: 14, color: 'var(--fg-3)', fontSize: 11 }}>Lade…</div>}
        {!error && content !== null && editMode && (
          <textarea
            value={editText}
            onChange={e => handleEditChange(e.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            style={{ display: 'block', width: '100%', height: '100%', minHeight: '300px', background: 'var(--bg-0)', border: 'none', outline: 'none', resize: 'none', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-0)', lineHeight: 1.6, padding: '8px 12px', boxSizing: 'border-box' }}
          />
        )}
        {!error && content !== null && !editMode && parsedJson !== undefined && (
          <div style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: 10.5, lineHeight: 1.6 }}>
            <JsonNode value={parsedJson} depth={0} />
          </div>
        )}
        {!error && content !== null && !editMode && parsedJson === undefined && (
          <TextViewer content={displayContent ?? ''} search={lowerSearch} showLineNums={showLineNums} ext={ext} />
        )}
      </div>
    </div>
  )
}

// ── JSON tree viewer ──────────────────────────────────────────────────────────

function JsonNode({ value, depth }: { value: unknown; depth: number }): React.ReactElement {
  if (value === null)           return <span style={{ color: 'var(--fg-3)' }}>null</span>
  if (value === undefined)      return <span style={{ color: 'var(--fg-3)' }}>undefined</span>
  if (typeof value === 'boolean') return <span style={{ color: '#3b82f6' }}>{String(value)}</span>
  if (typeof value === 'number')  return <span style={{ color: '#10b981' }}>{value}</span>
  if (typeof value === 'string')  return <span style={{ color: '#a78bfa' }}>"{value}"</span>
  if (Array.isArray(value))       return <JsonArray arr={value} depth={depth} />
  if (typeof value === 'object')  return <JsonObject obj={value as Record<string, unknown>} depth={depth} />
  return <span>{String(value)}</span>
}

function JsonObject({ obj, depth }: { obj: Record<string, unknown>; depth: number }) {
  const [collapsed, setCollapsed] = useState(depth >= 2)
  const keys = Object.keys(obj)
  if (keys.length === 0) return <span style={{ color: 'var(--fg-2)' }}>{'{}'}</span>
  return (
    <span>
      <span
        onClick={() => setCollapsed(c => !c)}
        style={{ cursor: 'pointer', color: 'var(--fg-3)', userSelect: 'none', fontSize: 9 }}
      >{collapsed ? '▶' : '▼'}</span>
      {' '}
      {collapsed ? (
        <span
          onClick={() => setCollapsed(false)}
          style={{ color: 'var(--fg-3)', cursor: 'pointer', fontSize: 10 }}
        >{'{'} {keys.length} {keys.length === 1 ? 'key' : 'keys'} {'}'}</span>
      ) : (
        <>
          {'{'}
          <div style={{ paddingLeft: 16 }}>
            {keys.map((k, i) => (
              <div key={k}>
                <span style={{ color: 'var(--accent)' }}>"{k}"</span>
                <span style={{ color: 'var(--fg-3)' }}>: </span>
                <JsonNode value={obj[k]} depth={depth + 1} />
                {i < keys.length - 1 && <span style={{ color: 'var(--fg-3)' }}>,</span>}
              </div>
            ))}
          </div>
          {'}'}
        </>
      )}
    </span>
  )
}

function JsonArray({ arr, depth }: { arr: unknown[]; depth: number }) {
  const [collapsed, setCollapsed] = useState(depth >= 2)
  if (arr.length === 0) return <span style={{ color: 'var(--fg-2)' }}>{'[]'}</span>
  return (
    <span>
      <span
        onClick={() => setCollapsed(c => !c)}
        style={{ cursor: 'pointer', color: 'var(--fg-3)', userSelect: 'none', fontSize: 9 }}
      >{collapsed ? '▶' : '▼'}</span>
      {' '}
      {collapsed ? (
        <span
          onClick={() => setCollapsed(false)}
          style={{ color: 'var(--fg-3)', cursor: 'pointer', fontSize: 10 }}
        >{'['} {arr.length} items {']'}</span>
      ) : (
        <>
          {'['}
          <div style={{ paddingLeft: 16 }}>
            {arr.map((v, i) => (
              <div key={i}>
                <JsonNode value={v} depth={depth + 1} />
                {i < arr.length - 1 && <span style={{ color: 'var(--fg-3)' }}>,</span>}
              </div>
            ))}
          </div>
          {']'}
        </>
      )}
    </span>
  )
}

// ── Text viewer with line numbers + search highlight ──────────────────────────

function highlightSegments(line: string, query: string): React.ReactNode {
  if (!query) return line
  const parts: React.ReactNode[] = []
  const lower = line.toLowerCase()
  let cursor = 0
  let idx = lower.indexOf(query)
  while (idx !== -1) {
    if (idx > cursor) parts.push(line.slice(cursor, idx))
    parts.push(
      <mark key={idx} style={{ background: 'rgba(255,200,50,0.4)', color: 'inherit', borderRadius: 2 }}>
        {line.slice(idx, idx + query.length)}
      </mark>
    )
    cursor = idx + query.length
    idx = lower.indexOf(query, cursor)
  }
  if (cursor < line.length) parts.push(line.slice(cursor))
  return parts
}

function TextViewer({ content, search, showLineNums, ext }: { content: string; search: string; showLineNums: boolean; ext: string }) {
  const lines = content.split('\n')
  const isMonoExt = !['md', 'txt', 'log'].includes(ext)
  const matchSet = search
    ? new Set(lines.map((l, i) => l.toLowerCase().includes(search) ? i : -1).filter(i => i !== -1))
    : null
  const matchCount = matchSet?.size ?? 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      {search && (
        <div style={{ padding: '3px 10px', fontSize: 10, color: matchCount > 0 ? 'var(--ok)' : 'var(--err)', background: 'var(--bg-0)', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
          {matchCount > 0 ? `${matchCount} Treffer` : 'Keine Treffer'}
        </div>
      )}
      <div style={{ display: 'flex', flex: 1 }}>
        {showLineNums && (
          <div style={{ flexShrink: 0, userSelect: 'none', background: 'var(--bg-0)', borderRight: '1px solid var(--line)', padding: '8px 0', textAlign: 'right' }}>
            {lines.map((_, i) => (
              <div key={i} style={{ padding: '0 8px', lineHeight: '1.6em', fontSize: 10, color: matchSet?.has(i) ? 'var(--accent)' : 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
                {i + 1}
              </div>
            ))}
          </div>
        )}
        <div style={{ flex: 1, padding: '8px 0', overflow: 'hidden' }}>
          {lines.map((line, i) => (
            <div
              key={i}
              style={{
                padding: '0 10px', lineHeight: '1.6em', fontSize: isMonoExt ? 10.5 : 11,
                fontFamily: isMonoExt ? 'var(--font-mono)' : 'var(--font-ui)',
                color: 'var(--fg-1)', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                background: matchSet?.has(i) ? 'rgba(255,200,50,0.07)' : 'transparent',
              }}
            >
              {highlightSegments(line, search)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── shared primitives ─────────────────────────────────────────────────────────

function Card({ title, action, children, collapsible, defaultOpen = true }: { title: string; action?: React.ReactNode; children: React.ReactNode; collapsible?: boolean; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ marginBottom: 20 }}>
      <div
        onClick={collapsible ? () => setOpen(o => !o) : undefined}
        style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: collapsible ? 'pointer' : 'default', userSelect: 'none', paddingBottom: open ? 6 : 0 }}
      >
        <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--fg-3)', fontWeight: 500, flex: 1 }}>{title}</span>
        {action && <span onClick={e => e.stopPropagation()}>{action}</span>}
        {collapsible && (open
          ? <IChevUp   style={{ width: 11, height: 11, color: 'var(--fg-3)', flexShrink: 0 }} />
          : <IChevDown style={{ width: 11, height: 11, color: 'var(--fg-3)', flexShrink: 0 }} />
        )}
      </div>
      {open && (
        <div style={{ background: 'var(--bg-2)', border: '0.5px solid var(--line-strong)', borderRadius: 10, overflow: 'hidden', padding: '10px 12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          {children}
        </div>
      )}
    </div>
  )
}

function Field({ label, value, mono, accent }: { label: string; value: string; mono?: boolean; accent?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '4px 0', fontSize: 11.5, borderBottom: '1px solid var(--line)' }}>
      <span style={{ width: 90, color: 'var(--fg-3)', flexShrink: 0 }}>{label}</span>
      <span className={mono ? 'mono' : ''} style={{ color: accent ? 'var(--accent)' : 'var(--fg-0)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  )
}

function FieldPlain({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '3px 0', fontSize: 11.5 }}>
      <span style={{ width: 90, color: 'var(--fg-3)', flexShrink: 0 }}>{label}</span>
      <span style={{ color: 'var(--fg-1)', flex: 1 }}>{value}</span>
    </div>
  )
}

function FieldPath({ label, path }: { label: string; path: string }) {
  const [copied, setCopied] = React.useState(false)
  const copy = () => {
    navigator.clipboard.writeText(path)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '3px 0', fontSize: 11.5, gap: 6 }}>
      <span style={{ width: 44, color: 'var(--fg-3)', flexShrink: 0 }}>{label}</span>
      <span className="mono" style={{ color: 'var(--fg-1)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{path}</span>
      <button
        onClick={copy}
        title="Pfad kopieren"
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? 'var(--ok)' : 'var(--fg-3)', padding: '2px', display: 'flex', alignItems: 'center', flexShrink: 0, borderRadius: 4 }}
        onMouseEnter={e => { if (!copied) (e.currentTarget as HTMLElement).style.color = 'var(--accent)' }}
        onMouseLeave={e => { if (!copied) (e.currentTarget as HTMLElement).style.color = 'var(--fg-3)' }}
      >
        {copied ? <ICheck style={{ width: 11, height: 11 }} /> : <ICopy style={{ width: 11, height: 11 }} />}
      </button>
    </div>
  )
}

const chip: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px',
  background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 99,
  color: 'var(--fg-1)', fontSize: 10.5, cursor: 'pointer', fontFamily: 'var(--font-ui)',
}

// ── QuickLinks widget ─────────────────────────────────────────────────────────

function QuickLinksModal({ onClose }: { onClose: () => void }) {
  const quickLinks    = useAppStore(s => s.quickLinks)
  const setQuickLinks = useAppStore(s => s.setQuickLinks)

  const [links, setLinks]           = useState<QuickLink[]>(quickLinks)
  const [editId, setEditId]         = useState<string | null>(null)
  const [editTitle, setEditTitle]   = useState('')
  const [editUrl, setEditUrl]       = useState('')
  const [newTitle, setNewTitle]     = useState('')
  const [newUrl, setNewUrl]         = useState('')
  const [dragIdx, setDragIdx]       = useState<number | null>(null)
  const [dragOver, setDragOver]     = useState<number | null>(null)

  const saveAll = (updated: QuickLink[]) => {
    setLinks(updated)
    setQuickLinks(updated)
  }

  const startEdit = (link: QuickLink) => {
    setEditId(link.id)
    setEditTitle(link.title)
    setEditUrl(link.url)
  }

  const commitEdit = () => {
    if (!editId) return
    saveAll(links.map(l => l.id === editId ? { ...l, title: editTitle.trim() || editUrl, url: editUrl.trim() } : l))
    setEditId(null)
  }

  const addLink = () => {
    const url = newUrl.trim()
    if (!url) return
    const id = `ql-${Date.now()}`
    const title = newTitle.trim() || url.replace(/^https?:\/\//, '').split('/')[0]
    saveAll([...links, { id, title, url }])
    setNewTitle('')
    setNewUrl('')
  }

  const removeLink = (id: string) => saveAll(links.filter(l => l.id !== id))

  const handleDrop = (targetIdx: number) => {
    if (dragIdx === null || dragIdx === targetIdx) return
    const arr = [...links]
    const [moved] = arr.splice(dragIdx, 1)
    arr.splice(targetIdx, 0, moved)
    saveAll(arr)
    setDragIdx(null)
    setDragOver(null)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)' }}
      onClick={onClose}>
      <div style={{ width: 480, minHeight: 280, maxHeight: '80vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-1)', border: '1px solid var(--line-strong)', borderRadius: 12, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)' }}>Quick Links verwalten</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-2)', display: 'flex', padding: 2 }}>
            <IClose style={{ width: 14, height: 14 }} />
          </button>
        </div>

        {/* Link list */}
        <div style={{ flex: 1, minHeight: 80, overflowY: 'auto', padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {links.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--fg-3)', textAlign: 'center', padding: '20px 0' }}>Noch keine Links — füge unten einen hinzu.</div>
          )}
          {links.map((link, i) => (
            <div key={link.id}
              draggable
              onDragStart={() => setDragIdx(i)}
              onDragOver={e => { e.preventDefault(); setDragOver(i) }}
              onDrop={() => handleDrop(i)}
              onDragEnd={() => { setDragIdx(null); setDragOver(null) }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, background: dragOver === i ? 'var(--bg-3)' : 'var(--bg-2)', border: `1px solid ${dragOver === i ? 'var(--accent-line)' : 'var(--line)'}`, cursor: 'grab', transition: 'border-color 0.1s' }}>
              {/* Favicon */}
              <img src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(link.url)}&sz=16`}
                style={{ width: 16, height: 16, flexShrink: 0, borderRadius: 3 }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
              {editId === link.id ? (
                <>
                  <input value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="Titel" style={{ flex: '0 0 120px', padding: '3px 7px', borderRadius: 5, border: '1px solid var(--line-strong)', background: 'var(--bg-1)', color: 'var(--fg-0)', fontSize: 11, fontFamily: 'var(--font-ui)', outline: 'none' }} autoFocus />
                  <input value={editUrl} onChange={e => setEditUrl(e.target.value)} placeholder="https://…" style={{ flex: 1, padding: '3px 7px', borderRadius: 5, border: '1px solid var(--line-strong)', background: 'var(--bg-1)', color: 'var(--fg-0)', fontSize: 11, fontFamily: 'var(--font-mono)', outline: 'none' }} onKeyDown={e => e.key === 'Enter' && commitEdit()} />
                  <button onClick={commitEdit} style={{ background: 'var(--accent)', color: 'var(--accent-fg)', border: 'none', borderRadius: 5, padding: '3px 8px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>✓</button>
                  <button onClick={() => setEditId(null)} style={{ background: 'none', border: 'none', color: 'var(--fg-3)', cursor: 'pointer', fontSize: 14, padding: '0 2px' }}>✕</button>
                </>
              ) : (
                <>
                  <span style={{ flex: 1, fontSize: 12, color: 'var(--fg-0)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{link.title}</span>
                  <span style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{link.url.replace(/^https?:\/\//, '')}</span>
                  <button onClick={() => startEdit(link)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-3)', display: 'flex', padding: 2 }} title="Bearbeiten">
                    <IEdit style={{ width: 11, height: 11 }} />
                  </button>
                  <button onClick={() => removeLink(link.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-3)', display: 'flex', padding: 2 }} title="Entfernen">
                    <ITrash style={{ width: 11, height: 11 }} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Add new */}
        <div style={{ padding: '10px 16px 14px', borderTop: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0, background: 'var(--bg-1)' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Titel (optional)" style={{ flex: 1, padding: '7px 10px', borderRadius: 6, border: '1px solid var(--line-strong)', background: 'var(--bg-2)', color: 'var(--fg-0)', fontSize: 11.5, fontFamily: 'var(--font-ui)', outline: 'none' }} />
            <input value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="https://…" style={{ flex: 1, padding: '7px 10px', borderRadius: 6, border: '1px solid var(--line-strong)', background: 'var(--bg-2)', color: 'var(--fg-0)', fontSize: 11.5, fontFamily: 'var(--font-mono)', outline: 'none' }} onKeyDown={e => e.key === 'Enter' && addLink()} />
          </div>
          <button onClick={addLink} style={{ background: 'var(--accent)', color: 'var(--accent-fg)', border: 'none', borderRadius: 6, padding: '8px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)', width: '100%' }}>
            Hinzufügen
          </button>
        </div>
      </div>
    </div>
  )
}

const QL_LIMIT = 5

function QuickLinksWidget() {
  const quickLinks    = useAppStore(s => s.quickLinks)
  const [showModal, setShowModal] = useState(false)
  const [open, setOpen]           = useState(true)
  const [expanded, setExpanded]   = useState(false)

  const openLink = (url: string) => window.open(url, '_blank', 'noopener,noreferrer')

  // ≤ 2 links → icon grid; > 2 links → compact list rows
  const useGrid = quickLinks.length <= 2
  const visibleLinks = quickLinks.length > QL_LIMIT && !expanded
    ? quickLinks.slice(0, QL_LIMIT)
    : quickLinks
  const hiddenCount = quickLinks.length - QL_LIMIT

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        {/* ── Section header ── */}
        <div
          onClick={() => setOpen(o => !o)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none', paddingBottom: open ? 6 : 0 }}
        >
          <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--fg-3)', fontWeight: 500, flex: 1 }}>
            Quick Links
          </span>
          <button
            onClick={e => { e.stopPropagation(); setShowModal(true) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-3)', display: 'flex', alignItems: 'center', padding: '1px 3px', borderRadius: 4 }}
            title="Link hinzufügen"
          >
            <IPlus style={{ width: 12, height: 12 }} />
          </button>
          {open
            ? <IChevUp   style={{ width: 11, height: 11, color: 'var(--fg-3)', flexShrink: 0 }} />
            : <IChevDown style={{ width: 11, height: 11, color: 'var(--fg-3)', flexShrink: 0 }} />
          }
        </div>

        {/* ── Section body ── */}
        {open && (
          <div style={{ background: 'var(--bg-2)', border: '0.5px solid var(--line-strong)', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '10px 12px' }}>
            {quickLinks.length === 0 ? (
              <div style={{ fontSize: 11, color: 'var(--fg-3)', textAlign: 'center', padding: '4px 0' }}>
                Noch keine Quick Links angelegt
              </div>
            ) : useGrid ? (
              /* ── Grid (1–2 links) ── */
              <div style={{ display: 'flex', gap: 8 }}>
                {visibleLinks.map(link => (
                  <button key={link.id} onClick={() => openLink(link.url)} title={link.url}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '7px 6px', borderRadius: 8, background: 'var(--bg-3)', border: 'none', cursor: 'pointer', flex: 1, transition: 'background 0.15s', boxShadow: '0 1px 4px rgba(0,0,0,0.18)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--accent-soft)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-3)' }}>
                    <img src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(link.url)}&sz=32`}
                      style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0 }}
                      onError={e => { (e.target as HTMLImageElement).src = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="%23888"/><text x="12" y="16" text-anchor="middle" fill="white" font-size="12">${encodeURIComponent(link.title.charAt(0).toUpperCase())}</text></svg>` }} />
                    <span style={{ fontSize: 9.5, color: 'var(--fg-1)', fontWeight: 500, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>{link.title}</span>
                  </button>
                ))}
              </div>
            ) : (
              /* ── Compact list (3+ links) ── */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {visibleLinks.map((link, i) => (
                  <button key={link.id} onClick={() => openLink(link.url)} title={link.url}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 6px', borderRadius: 6, background: 'var(--bg-3)', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left', marginBottom: i < visibleLinks.length - 1 ? 4 : 0, transition: 'background 0.12s', boxShadow: '0 1px 4px rgba(0,0,0,0.18)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--accent-soft)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-3)' }}>
                    <img src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(link.url)}&sz=32`}
                      style={{ width: 14, height: 14, borderRadius: 3, flexShrink: 0 }}
                      onError={e => { (e.target as HTMLImageElement).src = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="%23888"/><text x="12" y="16" text-anchor="middle" fill="white" font-size="12">${encodeURIComponent(link.title.charAt(0).toUpperCase())}</text></svg>` }} />
                    <span style={{ flex: 1, fontSize: 11.5, color: 'var(--fg-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{link.title}</span>
                    <span style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120, flexShrink: 0 }}>{link.url.replace(/^https?:\/\//, '').split('/')[0]}</span>
                  </button>
                ))}
              </div>
            )}
            {/* ── Expand / collapse toggle ── */}
            {hiddenCount > 0 && (
              <button
                onClick={() => setExpanded(e => !e)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0 0', fontSize: 11, fontWeight: 600, color: 'var(--accent)', fontFamily: 'var(--font-ui)', display: 'block', width: '100%', textAlign: 'left' }}
              >
                {expanded ? '↑ Weniger anzeigen' : `+${hiddenCount} weitere…`}
              </button>
            )}
          </div>
        )}
      </div>

      {showModal && <QuickLinksModal onClose={() => setShowModal(false)} />}
    </>
  )
}
