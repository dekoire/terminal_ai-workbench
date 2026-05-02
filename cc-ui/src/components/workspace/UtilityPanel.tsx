import React, { useState, useEffect, useRef } from 'react'
import { useAppStore, DEFAULT_AGENT_ROLES } from '../../store/useAppStore'
import type { AgentRole } from '../../store/useAppStore'
import { SingleCombobox } from '../primitives/SingleCombobox'
import { IMore, IEdit, IChev, IChevDown, IFolder, IFolderOpen, IFile, IClose, IBranch, IGitFork, IPlus, ITrash, ICheck, ISpark, ITable, IFilePlus, ICopy, IExternalLink, IDownload, IFileText, ISearch, ICrew, IDatabase, ITerminal, IKanban, IUser, ICpu, IPlay, IShipWheel, ICircleCheckBig, IWarn, IBug, IStar } from '../primitives/Icons'
import { KanbanBoard } from './KanbanBoard'
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

function LiveTreeNode({ node, depth }: { node: LiveNode; depth: number }) {
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
          cursor: 'pointer', userSelect: 'none', borderRadius: 4,
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
          {/* Öffnen mit — files only, based on extension */}
          {!node.isDir && (() => {
            const ext = node.name.includes('.') ? node.name.split('.').pop()!.toLowerCase() : ''
            const apps = OPEN_WITH[ext] ?? []
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
        <LiveTreeNode key={child.path} node={child} depth={depth + 1} />
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 5, background: 'var(--bg-2)', border: '1px solid var(--line)', flexShrink: 0 }}>
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
      <div style={{ background: 'var(--bg-1)', border: '1px solid var(--line-strong)', borderRadius: 10, boxShadow: '0 16px 48px rgba(0,0,0,0.4)', width: 380, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--danger-soft)', border: '1px solid var(--danger-line)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
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
            <div>Erstelle das Projekt mit einem echten Pfad oder stelle sicher, dass der Ordner existiert.</div>
          </div>
        )}
        {!error && !notFound && !root && (
          <div style={{ padding: 12, color: 'var(--fg-3)', fontSize: 11 }}>Lade…</div>
        )}
        {root && <LiveTreeNode node={root} depth={0} />}
      </div>

    </div>
  )
}

// ── Git tab ───────────────────────────────────────────────────────────────────

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
      <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--line)', flexShrink: 0, background: 'var(--bg-0)' }}>
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
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 6px', borderRadius: 4, cursor: b.current ? 'default' : 'pointer', background: b.current ? 'var(--accent-soft)' : 'transparent', marginBottom: 1 }}
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
              style={{ flex: 1, padding: '4px 7px', border: '1px solid var(--line)', borderRadius: 4, background: 'var(--bg-2)', color: 'var(--fg-0)', fontSize: 11, fontFamily: 'var(--font-mono)', outline: 'none' }}
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
            style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--line)', borderRadius: 4, background: 'var(--bg-2)', color: 'var(--fg-0)', fontSize: 11, fontFamily: 'var(--font-ui)', resize: 'none', outline: 'none', boxSizing: 'border-box' }}
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
              <button onClick={() => run('push', { branch: currentBranch?.name })} disabled={!!busy} style={{ ...smallBtn, flex: 1 }}>
                {busy === 'push' ? '…' : '↑ Push'}
              </button>
            </div>
          </section>
        )}

        {/* Action log */}
        {log && (
          <section>
            <SectionLabel>Output</SectionLabel>
            <pre style={{ margin: 0, padding: '6px 8px', background: 'var(--bg-0)', border: '1px solid var(--line)', borderRadius: 4, fontSize: 10, color: 'var(--fg-1)', fontFamily: 'var(--font-mono)', whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 80, overflowY: 'auto' }}>{log}</pre>
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
  padding: '4px 9px', border: '1px solid var(--line-strong)', borderRadius: 4,
  background: 'var(--bg-3)', color: 'var(--fg-1)', fontSize: 10.5,
  cursor: 'pointer', fontFamily: 'var(--font-ui)', whiteSpace: 'nowrap',
}

// ── Crew Agents card (live status) ───────────────────────────────────────────

type AgentLiveStatus = 'idle' | 'active' | 'done'
const AGENT_PALETTE = ['#ef4444','#3b82f6','#22c55e','#a855f7','#eab308','#ec4899','#06b6d4','#6366f1','#14b8a6','#e879f9']

function CrewAgentsCard({ session, agentStatus, startTimes }: {
  session: { id: string; crew?: { agents: { id: string; name: string; model: string }[]; orchestration?: string } }
  agentStatus: Record<string, AgentLiveStatus>
  startTimes: React.MutableRefObject<Record<string, number>>
}) {
  if (!session.crew) return null

  const agents = [...session.crew.agents].sort((a, b) => {
    const rank = (s: AgentLiveStatus) => s === 'active' ? 0 : s === 'idle' ? 1 : 2
    return rank(agentStatus[a.name] ?? 'idle') - rank(agentStatus[b.name] ?? 'idle')
  })

  return (
    <Card title="Agenten" collapsible>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {agents.map((agent) => {
          const origIdx = session.crew!.agents.findIndex(a => a.name === agent.name)
          const color = AGENT_PALETTE[Math.max(0, origIdx) % AGENT_PALETTE.length]
          const status = agentStatus[agent.name] ?? 'idle'
          const isActive = status === 'active'
          const isDone = status === 'done'
          const elapsed = isActive && startTimes.current[agent.name]
            ? Math.floor((Date.now() - startTimes.current[agent.name]) / 1000)
            : null
          return (
            <div key={agent.id} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderRadius: 5,
              background: isActive ? `color-mix(in srgb, ${color} 14%, var(--bg-2))` : isDone ? 'color-mix(in srgb, var(--fg-3) 8%, var(--bg-2))' : 'var(--bg-2)',
              border: `1px solid ${isActive ? color : isDone ? 'color-mix(in srgb, var(--fg-3) 20%, var(--line))' : 'var(--line)'}`,
              boxShadow: isActive ? `0 0 8px 1px ${color}55` : 'none',
              opacity: isDone ? 0.55 : 1,
              transition: 'all 0.3s',
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: isActive ? color : isDone ? 'var(--fg-3)' : color, flexShrink: 0, opacity: isDone ? 0.5 : 1, boxShadow: isActive ? `0 0 6px 2px ${color}` : 'none', animation: isActive ? 'cc-pulse 1.2s ease-in-out infinite' : 'none' }} />
              <span style={{ fontSize: 11, fontWeight: isActive ? 700 : 500, color: isActive ? color : isDone ? 'var(--fg-3)' : 'var(--fg-1)', flex: 1 }}>{agent.name}</span>
              {!isActive && <span className="mono" style={{ fontSize: 9, color: 'var(--fg-3)' }}>{agent.model.split('/').pop()}</span>}
              {isActive && elapsed !== null && <span className="mono" style={{ fontSize: 9, color: color, opacity: 0.85 }}>{elapsed}s</span>}
              {isDone && <span style={{ fontSize: 9, color: 'var(--fg-3)' }}>✓</span>}
            </div>
          )
        })}
      </div>
    </Card>
  )
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

function UserStoriesCard({ projectId: _projectId }: { projectId?: string }) {
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
      <Card title={`User Stories${allTickets.length > 0 ? ` (${allTickets.length})` : ''}`} collapsible action={
        <IKanban style={{ color: 'var(--fg-3)', width: 12, height: 12 }} />
      }>
        {allTickets.length === 0 ? (
          <div style={{ fontSize: 11, color: 'var(--fg-3)', fontStyle: 'italic' }}>Keine User Stories</div>
        ) : (
          allTickets.slice(0, 8).map(({ ticket: t, project: p }) => (
            <div key={t.id} onClick={() => setOpenTicket({ projectId: p.id, projectName: p.name, projectPath: p.path, ticketId: t.id })}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', cursor: 'pointer', borderBottom: '1px solid var(--line)' }}>
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
          borderRadius: 4,
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

function triggerDownload(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ── AgentTab ─────────────────────────────────────────────────────────────────

function AgentTab() {
  const { agentRoles, addAgentRole, updateAgentRole, removeAgentRole, openrouterKey, setOpenrouterKey } = useAppStore()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingKey, setEditingKey] = useState(false)
  const [keyDraft, setKeyDraft] = useState(openrouterKey)

  const fl: React.CSSProperties = { display: 'block', fontSize: 9.5, textTransform: 'uppercase', letterSpacing: 0.7, color: 'var(--fg-3)', fontWeight: 500, marginBottom: 4 }
  const inp: React.CSSProperties = { width: '100%', padding: '5px 8px', border: '1px solid var(--line-strong)', borderRadius: 5, background: 'var(--bg-2)', color: 'var(--fg-0)', fontSize: 11, fontFamily: 'var(--font-mono)', outline: 'none', boxSizing: 'border-box' }

  const handleAddRole = () => {
    const newRole: AgentRole = {
      id: `ar-${Date.now()}`,
      name: 'Neuer Agent',
      model: 'anthropic/claude-sonnet-4-6',
      strengths: [],
      systemPrompt: '',
      tools: ['Read', 'Bash'],
    }
    addAgentRole(newRole)
    setExpandedId(newRole.id)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* OpenRouter key */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
          <ISpark style={{ color: 'var(--accent)', marginRight: 5 }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-0)' }}>OpenRouter API Key</span>
          <span style={{ flex: 1 }} />
          {!editingKey && (
            <button onClick={() => { setEditingKey(true); setKeyDraft(openrouterKey) }} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 10.5, cursor: 'pointer', fontFamily: 'var(--font-ui)', padding: 0 }}>
              {openrouterKey ? 'Ändern' : 'Hinterlegen'}
            </button>
          )}
        </div>
        {editingKey ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <input style={inp} type="password" value={keyDraft} onChange={e => setKeyDraft(e.target.value)} placeholder="sk-or-v1-..." autoFocus />
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => { setOpenrouterKey(keyDraft); setEditingKey(false) }} style={{ padding: '4px 10px', background: 'var(--accent)', color: 'var(--accent-fg)', border: 'none', borderRadius: 5, fontSize: 10.5, cursor: 'pointer', fontFamily: 'var(--font-ui)', fontWeight: 600 }}>Speichern</button>
              <button onClick={() => setEditingKey(false)} style={{ padding: '4px 10px', background: 'transparent', color: 'var(--fg-2)', border: '1px solid var(--line-strong)', borderRadius: 5, fontSize: 10.5, cursor: 'pointer', fontFamily: 'var(--font-ui)' }}>Abbrechen</button>
            </div>
          </div>
        ) : (
          <div style={{ padding: '6px 8px', background: 'var(--bg-2)', borderRadius: 5, border: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 6 }}>
            {openrouterKey
              ? <><ICheck style={{ color: 'var(--ok)', flexShrink: 0 }} /><span className="mono" style={{ fontSize: 10.5, color: 'var(--fg-2)' }}>{openrouterKey.slice(0, 12)}···</span></>
              : <span style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>Nicht hinterlegt — für Agenten-Crew benötigt</span>
            }
          </div>
        )}
      </div>

      {/* Agent roles list */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-0)' }}>Agenten-Rollen</span>
          <span style={{ flex: 1 }} />
          <button
            onClick={() => { if (confirm('Standard-Rollen wiederherstellen? Eigene Änderungen gehen verloren.')) { agentRoles.forEach(r => removeAgentRole(r.id)); DEFAULT_AGENT_ROLES.forEach(r => addAgentRole({ ...r })) } }}
            style={{ background: 'none', border: 'none', color: 'var(--fg-3)', fontSize: 10, cursor: 'pointer', fontFamily: 'var(--font-ui)', marginRight: 8 }}
          >
            Zurücksetzen
          </button>
          <button onClick={handleAddRole} style={{ background: 'none', border: '1px solid var(--line-strong)', borderRadius: 4, padding: '3px 8px', cursor: 'pointer', color: 'var(--accent)', fontSize: 10.5, display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-ui)' }}>
            <IPlus /> Hinzufügen
          </button>
        </div>
        <p style={{ fontSize: 10.5, color: 'var(--fg-3)', margin: '0 0 10px', lineHeight: 1.5 }}>
          Standard-Rollen für neue Agenten-Crew-Sessions. Beim Anlegen einer Session anpassbar.
        </p>
        {agentRoles.map(role => (
          <div key={role.id} style={{ border: '1px solid var(--line-strong)', borderRadius: 6, marginBottom: 6, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: 'var(--bg-2)', cursor: 'pointer' }} onClick={() => setExpandedId(expandedId === role.id ? null : role.id)}>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--fg-0)', minWidth: 72 }}>{role.name}</span>
              <span className="mono" style={{ fontSize: 10, color: 'var(--fg-3)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{role.model.split('/').pop()}</span>
              <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                {role.strengths.slice(0, 2).map(s => (
                  <span key={s} style={{ fontSize: 9, color: 'var(--accent)', background: 'var(--accent-soft)', borderRadius: 3, padding: '1px 4px' }}>{s}</span>
                ))}
              </div>
              <button onClick={e => { e.stopPropagation(); removeAgentRole(role.id) }} style={{ background: 'none', border: 'none', color: 'var(--fg-3)', cursor: 'pointer', padding: '2px', borderRadius: 3, flexShrink: 0 }}>
                <ITrash />
              </button>
            </div>
            {expandedId === role.id && (
              <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 7, background: 'var(--bg-1)', borderTop: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', gap: 7 }}>
                  <div style={{ flex: 1 }}>
                    <label style={fl}>Name</label>
                    <input style={inp} value={role.name} onChange={e => updateAgentRole(role.id, { name: e.target.value })} />
                  </div>
                  <div style={{ flex: 2 }}>
                    <label style={fl}>Modell</label>
                    <select
                      style={{ ...inp, cursor: 'pointer' }}
                      value={OPENROUTER_MODELS.find(m => m.value === role.model) ? role.model : '__custom__'}
                      onChange={e => updateAgentRole(role.id, { model: e.target.value })}
                    >
                      {OPENROUTER_MODELS.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                      {!OPENROUTER_MODELS.find(m => m.value === role.model) && (
                        <option value={role.model}>{role.model}</option>
                      )}
                    </select>
                  </div>
                </div>
                <div>
                  <label style={fl}>Stärken (kommagetrennt)</label>
                  <input style={inp} value={role.strengths.join(', ')} onChange={e => updateAgentRole(role.id, { strengths: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} placeholder="TypeScript, React, Bugfixes" />
                </div>
                <div>
                  <label style={fl}>System-Prompt</label>
                  <textarea style={{ ...inp, height: 60, resize: 'vertical', fontFamily: 'var(--font-mono)' }} value={role.systemPrompt} onChange={e => updateAgentRole(role.id, { systemPrompt: e.target.value })} />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export function UtilityPanel() {
  const [tab, setTab] = useState(0)
  const [exportFmt, setExportFmt] = useState<ExportFmt>('txt')
  const [exporting, setExporting]  = useState(false)
  const { aliases, activeSessionId, projects, activeProjectId } = useAppStore()
  const project = projects.find(p => p.id === activeProjectId)
  const session = project?.sessions.find(s => s.id === activeSessionId)
  // Find the crew session to mirror: prefer the active session if it's a crew session,
  // otherwise fall back to the most recently started crew session in this project
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
  const handleExport = () => {
    if (!session) return
    setExporting(true)

    const onText = (e: Event) => {
      const raw = (e as CustomEvent<string>).detail
      window.removeEventListener('cc:terminal-text', onText)
      setExporting(false)

      const ts = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-')
      const base = `${session.name.replace(/[^a-z0-9]/gi, '_')}_${ts}`

      if (exportFmt === 'txt') {
        triggerDownload(raw, `${base}.txt`)
      } else if (exportFmt === 'md') {
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

    // Timeout fallback — if no terminal responds within 2 s
    setTimeout(() => {
      window.removeEventListener('cc:terminal-text', onText)
      setExporting(false)
    }, 2000)
  }

  // ── Live crew agent status (lifted so it survives tab switches) ──────────────
  const [liveAgentStatus, setLiveAgentStatus] = useState<Record<string, AgentLiveStatus>>({})
  const [, setLiveTick] = useState(0)
  const liveStartTimes = useRef<Record<string, number>>({})

  useEffect(() => {
    const handler = (e: Event) => {
      const { sessionId: sid, agent, status } = (e as CustomEvent<{ sessionId: string; agent: string; model: string; status: string }>).detail
      if (sid !== activeSessionId) return
      setLiveAgentStatus(prev => {
        const next = { ...prev }
        if (status === 'start') {
          Object.keys(next).forEach(k => { if (next[k] === 'active') next[k] = 'done' })
          next[agent] = 'active'
          liveStartTimes.current[agent] = Date.now()
        } else {
          next[agent] = 'done'
        }
        return next
      })
    }
    window.addEventListener('cc:crew-event', handler)
    return () => window.removeEventListener('cc:crew-event', handler)
  }, [activeSessionId])

  // Reset status when session changes
  useEffect(() => {
    setLiveAgentStatus({})
    liveStartTimes.current = {}
  }, [activeSessionId])

  const liveHasActive = Object.values(liveAgentStatus).some(s => s === 'active')
  useEffect(() => {
    if (!liveHasActive) return
    const id = setInterval(() => setLiveTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [liveHasActive])

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
    setTab(3)
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

  // Jump to Git tab when sidebar git icon is clicked
  useEffect(() => {
    const handler = () => setTab(1)
    window.addEventListener('cc:goto-git-tab', handler)
    return () => window.removeEventListener('cc:goto-git-tab', handler)
  }, [])

  // Crew monitor state: runs per session (newest appended, displayed reversed)
  type CrewAgentStatus = { agent: string; model: string; status: 'idle' | 'active' | 'done'; startedAt?: number; doneAt?: number }
  type DelegationEntry = { agent: string; model: string; startedAt: number; doneAt: number; tokens?: number; output?: string; task?: string }
  type CrewRun = { id: string; title: string; startedAt: number; goal?: string; managerModel?: string; collapsed: boolean; agents: CrewAgentStatus[]; history: DelegationEntry[]; totalTokens?: number; error?: string; errorTraceback?: string }
  const AGENT_PALETTE = ['#ef4444','#3b82f6','#22c55e','#a855f7','#eab308','#ec4899','#06b6d4','#6366f1','#14b8a6','#e879f9']
  const crewAgentList = project?.sessions.find(s => s.id === activeSessionId && s.kind === 'crew')?.crew?.agents ?? []
  const [crewRunsBySession, setCrewRunsBySession] = useState<Record<string, CrewRun[]>>({})
  const [expandedHistoryIdx, setExpandedHistoryIdx] = useState<Set<string>>(new Set())
  const [expandedSummaryIds, setExpandedSummaryIds] = useState<Set<string>>(new Set())
  const currentRuns = crewRunsBySession[activeSessionId ?? ''] ?? []
  const latestRun = currentRuns[currentRuns.length - 1]
  const agentColor = (name: string) => {
    const idx = crewAgentList.findIndex(a => a.name === name)
    const fallback = latestRun?.agents.findIndex(a => a.agent === name) ?? -1
    return AGENT_PALETTE[Math.max(0, idx >= 0 ? idx : fallback) % AGENT_PALETTE.length]
  }
  const crewActiveCount = latestRun?.agents.filter(a => a.status === 'active').length ?? 0

  const generateTitleRef = useRef<((runId: string, sid: string, context: string) => Promise<void>) | null>(null)
  generateTitleRef.current = async (runId: string, sid: string, context: string) => {
    const { openrouterKey: key, crewRunTitleModel: model } = useAppStore.getState()
    if (!key) return
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: 'Gib dieser Crew-AI-Anfrage einen prägnanten Titel auf Deutsch. Maximal 6 Wörter, kein Punkt. Antworte NUR mit dem Titel.' },
            { role: 'user', content: context },
          ],
          max_tokens: 40,
        }),
      })
      const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
      const title = data.choices?.[0]?.message?.content?.trim()
      if (title) {
        setCrewRunsBySession(prev => ({
          ...prev,
          [sid]: (prev[sid] ?? []).map(r => r.id === runId ? { ...r, title } : r),
        }))
      }
    } catch { /* ignore */ }
  }

  useEffect(() => {
    const handler = (e: Event) => {
      const { sessionId: sid, agent, model, status, tokens, output, task } = (e as CustomEvent<{ sessionId: string; agent: string; model: string; status: string; tokens?: number; output?: string; task?: string }>).detail
      const crewSess = useAppStore.getState().projects.flatMap(p => p.sessions).find(s => s.id === sid && s.kind === 'crew')
      const goal = crewSess?.crew?.goal
      const managerModel = crewSess?.crew?.managerModel
      setCrewRunsBySession(prev => {
        const runs = prev[sid] ?? []
        const latest = runs[runs.length - 1]
        if (status === 'start') {
          if (!latest) {
            // Fallback: no run yet (cc:crew-run-start wasn't detected) — create one
            const newRun: CrewRun = {
              id: `run-${Date.now()}`,
              title: '',
              startedAt: Date.now(),
              goal,
              managerModel,
              collapsed: false,
              agents: [{ agent, model, status: 'active', startedAt: Date.now() }],
              history: [],
            }
            return { ...prev, [sid]: [newRun] }
          }
          // Always add to the latest run — cc:crew-run-start is the sole new-run signal
          const agentIdx = latest.agents.findIndex(a => a.agent === agent)
          const updatedAgent: CrewAgentStatus = { agent, model, status: 'active', startedAt: Date.now() }
          const updatedAgents = agentIdx !== -1
            ? latest.agents.map((a, i) => i === agentIdx ? updatedAgent : a)
            : [...latest.agents, updatedAgent]
          return { ...prev, [sid]: [...runs.slice(0, -1), { ...latest, agents: updatedAgents }] }
        } else {
          if (!latest) return prev
          const existingAgent = latest.agents.find(a => a.agent === agent)
          const histEntry: DelegationEntry | null = existingAgent?.startedAt
            ? { agent, model, startedAt: existingAgent.startedAt, doneAt: Date.now(), tokens, output, task }
            : null
          const updatedAgents = latest.agents.map(a => a.agent === agent ? { ...a, status: 'done' as const, doneAt: Date.now() } : a)
          const updatedHistory = histEntry ? [...latest.history, histEntry] : latest.history
          const updatedRun = { ...latest, agents: updatedAgents, history: updatedHistory }
          const allDone = updatedAgents.length > 0 && updatedAgents.every(a => a.status === 'done')
          if (allDone) {
            const ctx = goal || task || agent
            void generateTitleRef.current?.(updatedRun.id, sid, ctx)
          }
          return { ...prev, [sid]: [...runs.slice(0, -1), updatedRun] }
        }
      })
      setTab(4)
    }
    window.addEventListener('cc:crew-event', handler)
    return () => window.removeEventListener('cc:crew-event', handler)
  }, [])

  // New run starts unconditionally when ###CREW_RUN_START### marker is detected
  useEffect(() => {
    const handler = (e: Event) => {
      const { sessionId: sid, userInput } = (e as CustomEvent<{ sessionId: string; userInput?: string }>).detail
      const crewSess = useAppStore.getState().projects.flatMap(p => p.sessions).find(s => s.id === sid && s.kind === 'crew')
      setCrewRunsBySession(prev => {
        const runs = prev[sid] ?? []
        const newRun: CrewRun = {
          id: `run-${Date.now()}`,
          title: '',
          startedAt: Date.now(),
          goal: userInput || crewSess?.crew?.goal,
          managerModel: crewSess?.crew?.managerModel,
          collapsed: false,
          agents: [],
          history: [],
        }
        const updated = runs.map(r => ({ ...r, collapsed: true }))
        const trimmed = updated.length >= 29 ? updated.slice(updated.length - 29) : updated
        return { ...prev, [sid]: [...trimmed, newRun] }
      })
      setTab(4)
    }
    window.addEventListener('cc:crew-run-start', handler)
    return () => window.removeEventListener('cc:crew-run-start', handler)
  }, [])

  // Total tokens (from Python after kickoff) → derive manager tokens
  useEffect(() => {
    const handler = (e: Event) => {
      const { sessionId: sid, totalTokens } = (e as CustomEvent<{ sessionId: string; totalTokens: number }>).detail
      setCrewRunsBySession(prev => {
        const runs = prev[sid]
        if (!runs?.length) return prev
        const latest = runs[runs.length - 1]
        return { ...prev, [sid]: [...runs.slice(0, -1), { ...latest, totalTokens }] }
      })
    }
    window.addEventListener('cc:crew-total-tokens', handler)
    return () => window.removeEventListener('cc:crew-total-tokens', handler)
  }, [])

  useEffect(() => {
    const handler = (e: Event) => {
      const { sessionId: sid, message, traceback } = (e as CustomEvent<{ sessionId: string; message: string; traceback: string }>).detail
      setCrewRunsBySession(prev => {
        const runs = prev[sid]
        if (!runs?.length) return prev
        const latest = runs[runs.length - 1]
        return { ...prev, [sid]: [...runs.slice(0, -1), { ...latest, error: message, errorTraceback: traceback }] }
      })
    }
    window.addEventListener('cc:crew-error', handler)
    return () => window.removeEventListener('cc:crew-error', handler)
  }, [])

  // Tick every second so active-agent elapsed timers update live
  const [, setTick] = useState(0)
  useEffect(() => {
    if (crewActiveCount === 0) return
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [crewActiveCount])

  // Dirty file count for Git tab badge
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

  // Auto-switch away from Data tab when files are closed
  useEffect(() => {
    if (tab === 3 && dataFiles.length === 0) setTab(0)
  }, [dataFiles.length, tab])

  // Auto-switch away from Crew tab when active session is not a crew session
  useEffect(() => {
    if (tab === 4 && session?.kind !== 'crew') setTab(0)
  }, [tab, session?.kind])

  // Tab order: Session | Git | Files | Data (only if files open) | Agenten
  const tabs = ['Session', 'Git', 'Files', 'Data', 'Agenten']
  const noPadding = [1, 2, 3, 4]

  return (
    <aside style={{ width: '100%', flexShrink: 0, background: 'var(--bg-1)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', flexShrink: 0 }}>
        {tabs.map((t, i) => {
          if (t === 'Data' && dataFiles.length === 0) return null
          if (t === 'Agenten' && session?.kind !== 'crew') return null
          return (
            <div key={t} onClick={() => setTab(i)} style={{
              flex: 1, padding: '8px 0', textAlign: 'center', fontSize: 10.5,
              color: i === tab ? 'var(--fg-0)' : 'var(--fg-2)',
              borderBottom: i === tab ? '2px solid var(--accent)' : '2px solid transparent',
              cursor: 'pointer', fontWeight: i === tab ? 600 : 400, marginBottom: -1,
              position: 'relative',
            }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 10.5 }}>{t}</span>
                {t === 'Git' && gitDirty > 0 && (
                  <span title={`${gitDirty} geänderte Dateien`} style={{ position: 'absolute', top: 4, right: 4, fontSize: 8, fontWeight: 700, minWidth: 12, height: 12, borderRadius: 99, background: 'rgba(244,195,101,0.18)', border: '1px solid rgba(244,195,101,0.4)', color: 'var(--warn)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 2px', lineHeight: 1 }}>{gitDirty}</span>
                )}
              </span>
            </div>
          )
        })}
      </div>

      <div style={{ flex: 1, overflowY: noPadding.includes(tab) ? 'hidden' : 'auto', padding: noPadding.includes(tab) ? 0 : 14, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

        {/* ── Tab 0: Session ── */}
        {tab === 0 && (
          <>
            {session?.kind === 'crew' && <CrewAgentsCard session={session} agentStatus={liveAgentStatus} startTimes={liveStartTimes} />}
            <div style={{ marginBottom: 14, paddingTop: 14 }}>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)', marginBottom: 3 }}>
                  {session?.alias ?? project?.name ?? '—'}
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>{modelLabel}</div>
              </div>
              <Field label="Gestartet" value={startedLabel} />
              <Field label="Pfad" value={project?.path ?? '—'} mono />
              <Field label="Branch" value={project?.branch ?? '—'} mono accent />
            </div>
            <UserStoriesCard projectId={project?.id} />
          </>
        )}

        {/* ── Tab 1: Git ── */}
        {tab === 1 && project && <GitTab projectPath={project.path} />}
        {tab === 1 && !project && (
          <div style={{ textAlign: 'center', color: 'var(--fg-3)', fontSize: 12, marginTop: 40 }}>Kein Projekt ausgewählt</div>
        )}

        {/* ── Tab 2: Files ── */}
        {tab === 2 && project && <FilesTab projectName={project.name} projectPath={project.path} />}
        {tab === 2 && !project && (
          <div style={{ textAlign: 'center', color: 'var(--fg-3)', fontSize: 12, marginTop: 40 }}>Kein Projekt ausgewählt</div>
        )}

        {/* ── Tab 3: Data Viewer ── */}
        {tab === 3 && (
          <DataViewer
            files={dataFiles}
            activeIdx={dataActive}
            onSelect={(i) => setDataActiveByProject(p => ({ ...p, [projId]: i }))}
            onClose={closeDataFile}
          />
        )}

        {/* ── Tab 4: Crew Verlauf — run history ── */}
        {tab === 4 && (() => {
          const hasAny = currentRuns.length > 0
          const displayRuns = [...currentRuns].reverse()

          const PRICE_PER_1M: Record<string, number> = {
            'claude-opus-4': 15.0, 'claude-3-opus': 15.0,
            'claude-sonnet-4-6': 3.0, 'claude-3-5-sonnet': 3.0, 'claude-3-sonnet': 3.0,
            'claude-3-5-haiku': 0.8, 'claude-3-haiku': 0.4,
            'gpt-4o': 5.0, 'gpt-4o-mini': 0.15, 'gpt-4-turbo': 10.0,
            'o3-mini': 2.0, 'o3': 10.0, 'o1-mini': 1.5, 'o1': 15.0,
            'gemini-2.5-pro': 7.0, 'gemini-2.0-flash': 0.1, 'gemini-1.5-pro': 3.5,
            'deepseek-r1': 0.5, 'deepseek-chat': 0.3,
          }
          const modelRate = (mdl: string) => {
            const k = Object.keys(PRICE_PER_1M).find(key => mdl.toLowerCase().includes(key))
            return k ? PRICE_PER_1M[k] : 3.0
          }
          const entryCost = (h: { model: string; tokens?: number }) =>
            ((h.tokens ?? 0) / 1_000_000) * modelRate(h.model)

          const fmtSecs = (s: number) => s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`
          const fmtTok  = (t: number) => t > 9999 ? `${(t / 1000).toFixed(0)}k` : t > 999 ? `${(t / 1000).toFixed(1)}k` : `${t}`
          const fmtCost = (c: number) => c < 0.0005 ? '<$0.001' : c < 0.01 ? `$${c.toFixed(4)}` : `$${c.toFixed(3)}`
          const fmtDateTime = (ts: number) => {
            const d = new Date(ts)
            return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
              + ' ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
          }

          const GY1 = '#e2e2e2'
          const GY2 = '#b8b8b8'
          const line = <div style={{ flex: 1, width: 1, background: 'var(--line)', margin: '2px 0 0' }} />
          const dot = (icon: React.ReactNode, withLine = true) => (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 18, flexShrink: 0 }}>
              {icon}
              {withLine && line}
            </div>
          )
          const agentCircle = (color: string, animated = false, size = 10) => (
            <div style={{
              width: size, height: size, borderRadius: '50%', background: color, flexShrink: 0,
              ...(animated ? { animation: 'cc-pulse 1.2s ease-in-out infinite' } : {}),
            }} />
          )

          const toggleCollapse = (runId: string) =>
            setCrewRunsBySession(prev => ({
              ...prev,
              [activeSessionId ?? '']: (prev[activeSessionId ?? ''] ?? []).map(r =>
                r.id === runId ? { ...r, collapsed: !r.collapsed } : r
              ),
            }))

          const deleteRun = (runId: string) =>
            setCrewRunsBySession(prev => ({
              ...prev,
              [activeSessionId ?? '']: (prev[activeSessionId ?? ''] ?? []).filter(r => r.id !== runId),
            }))

          return (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>

              {/* Header */}
              <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px 6px' }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--fg-3)', letterSpacing: 0.5, textTransform: 'uppercase' }}>Agenten Verlauf</span>
                {hasAny && (
                  <button
                    onClick={() => setCrewRunsBySession(prev => ({ ...prev, [activeSessionId ?? '']: [] }))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--fg-3)', display: 'flex', alignItems: 'center' }}
                  ><IClose style={{ width: 11, height: 11 }} /></button>
                )}
              </div>

              {/* Body */}
              {!hasAny ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ textAlign: 'center', color: 'var(--fg-3)', fontSize: 10, opacity: 0.5 }}>
                    <ICrew style={{ width: 20, height: 20, display: 'block', margin: '0 auto 8px', opacity: 0.35 }} />
                    Keine Crew-Session aktiv
                  </div>
                </div>
              ) : (
                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                  {displayRuns.map((run, displayIdx) => {
                    const runNumber      = currentRuns.length - displayIdx
                    const sortedHistory  = [...run.history].sort((a, b) => a.startedAt - b.startedAt)
                    const activeAgents   = run.agents.filter(a => a.status === 'active')
                    const allDone        = run.agents.length > 0 && run.agents.every(a => a.status === 'done')
                    const isRunning      = activeAgents.length > 0
                    const currentActive  = activeAgents[0]
                    const activeColor    = currentActive ? agentColor(currentActive.agent) : 'var(--accent)'
                    const totalTokens    = sortedHistory.reduce((s, h) => s + (h.tokens ?? 0), 0)
                    const totalCost      = sortedHistory.reduce((s, h) => s + entryCost(h), 0)
                    const totalSecs      = sortedHistory.reduce((s, h) => s + Math.floor((h.doneAt - h.startedAt) / 1000), 0)
                    const lastHistory    = sortedHistory[sortedHistory.length - 1]
                    const summaryExpanded = expandedSummaryIds.has(run.id)
                    const toggleSummary   = () => setExpandedSummaryIds(prev => {
                      const next = new Set(prev); next.has(run.id) ? next.delete(run.id) : next.add(run.id); return next
                    })
                    const orchColor = 'var(--accent)'
                    const cardColor = isRunning ? activeColor : orchColor
                    const cardBg    = allDone ? 'rgba(255,255,255,0.03)' : isRunning ? `${activeColor}14` : 'var(--accent-soft)'
                    const cardBorder = allDone ? '1px solid var(--line-strong)' : isRunning ? `1px solid ${activeColor}44` : '1px solid var(--accent-line)'
                    const numColor  = allDone ? GY2 : cardColor
                    const elapsedSecs = isRunning && currentActive?.startedAt
                      ? totalSecs + Math.floor((Date.now() - currentActive.startedAt) / 1000)
                      : totalSecs

                    const pillTextColor = '#fff'
                    const stripColor   = allDone ? GY1 : isRunning ? activeColor : 'var(--accent)'

                    return (
                      <div key={run.id} style={{ padding: '8px 8px 0' }}>
                        {displayIdx > 0 && (
                          <div style={{ borderTop: '1px solid var(--line-strong)', margin: '4px 4px 12px', opacity: 0.7 }} />
                        )}

                        {/* ── Run header card ── */}
                        <div style={{
                          background: cardBg, border: cardBorder, borderRadius: 8,
                          overflow: 'hidden', transition: 'background 0.4s, border-color 0.4s',
                        }}>
                          {/* Info row */}
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, padding: '11px 12px 10px' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              {/* Row 1: #N pill + title or live status */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                                <span style={{
                                  fontSize: 9, fontWeight: 800, color: pillTextColor,
                                  background: numColor, borderRadius: 4, padding: '2px 6px',
                                  flexShrink: 0, letterSpacing: 0.2,
                                }}>#{runNumber}</span>
                                {run.title || run.goal ? (
                                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-0)', lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {run.title || run.goal}
                                  </div>
                                ) : isRunning && currentActive ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: activeColor, flexShrink: 0, animation: 'cc-pulse 1.2s ease-in-out infinite' }} />
                                    <span style={{ fontSize: 13, fontWeight: 700, color: activeColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentActive.agent} arbeitet</span>
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <IShipWheel style={{ width: 12, height: 12, flexShrink: 0, animation: 'cc-orch-pulse 1.2s ease-in-out infinite' }} />
                                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-2)' }}>Orchestrator arbeitet</span>
                                  </div>
                                )}
                              </div>

                              {/* Model row */}
                              {(isRunning && currentActive) || (!allDone && !isRunning && run.agents.length > 0) || (!allDone && run.agents.length === 0) ? (
                                <div style={{ fontSize: 10, color: GY2, fontFamily: 'var(--font-mono)', paddingLeft: 30, marginBottom: 3 }}>
                                  {isRunning && currentActive
                                    ? currentActive.model.split('/').pop()
                                    : run.managerModel ? run.managerModel.split('/').pop() : null}
                                </div>
                              ) : null}

                              {/* Orchestrator koordiniert (between delegations) */}
                              {!allDone && !isRunning && run.agents.length > 0 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 30, marginBottom: 3 }}>
                                  <IShipWheel style={{ width: 11, height: 11, flexShrink: 0, animation: 'cc-orch-pulse 1.2s ease-in-out infinite' }} />
                                  <span style={{ fontSize: 11, color: 'var(--fg-2)' }}>Orchestrator koordiniert</span>
                                </div>
                              )}

                              {/* Date + elapsed */}
                              <div style={{ display: 'flex', alignItems: 'center', paddingLeft: 30 }}>
                                <span style={{ fontSize: 10, color: GY2, fontFamily: 'var(--font-mono)' }}>{fmtDateTime(run.startedAt)}</span>
                                {elapsedSecs > 0 && (
                                  <span style={{ marginLeft: 'auto', fontSize: 10, color: GY1, fontFamily: 'var(--font-mono)' }}>{fmtSecs(elapsedSecs)}</span>
                                )}
                              </div>
                            </div>

                            <button
                              onClick={() => deleteRun(run.id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 2px', color: 'var(--fg-3)', display: 'flex', borderRadius: 3, marginTop: 2 }}
                            ><IClose style={{ width: 10, height: 10 }} /></button>
                          </div>

                          {/* Expand/collapse strip */}
                          <div
                            onClick={() => toggleCollapse(run.id)}
                            style={{ cursor: 'pointer', borderTop: '1px solid rgba(255,255,255,0.07)', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 4, userSelect: 'none' }}
                          >
                            <IChevDown style={{ width: 9, height: 9, color: stripColor, transform: run.collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 0.15s' }} />
                            <span style={{ fontSize: 10, color: stripColor }}>{run.collapsed ? 'Details anzeigen' : 'Details ausblenden'}</span>
                          </div>
                        </div>

                        {/* ── Run body (expanded) ── */}
                        {!run.collapsed && (
                          <div style={{ padding: '14px 12px 18px' }}>

                            {/* Anfrage gestartet */}
                            {(() => {
                              const aKey = `${run.id}-anfrage`
                              const aExp = expandedHistoryIdx.has(aKey)
                              const toggleA = () => setExpandedHistoryIdx(prev => {
                                const next = new Set(prev); next.has(aKey) ? next.delete(aKey) : next.add(aKey); return next
                              })
                              return (
                                <div style={{ marginBottom: 16, borderRadius: 7, border: '1px solid var(--line)', overflow: 'hidden' }}>
                                  <div
                                    onClick={run.goal ? toggleA : undefined}
                                    style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px', cursor: run.goal ? 'pointer' : 'default', userSelect: 'none' }}
                                  >
                                    <IPlay style={{ width: 12, height: 12, color: GY1, flexShrink: 0 }} />
                                    <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--fg-0)' }}>Anfrage gestartet</span>
                                    {run.goal && (
                                      <IChevDown style={{ width: 9, height: 9, color: GY1, marginLeft: 'auto', transform: aExp ? 'none' : 'rotate(-90deg)', transition: 'transform 0.15s' }} />
                                    )}
                                  </div>
                                  {run.goal && aExp && (
                                    <div style={{ padding: '8px 12px 10px', borderTop: '1px solid var(--line)' }}>
                                      <pre style={{ margin: 0, fontSize: 10, color: 'var(--fg-1)', fontFamily: 'var(--font-mono)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5 }}>{run.goal}</pre>
                                    </div>
                                  )}
                                </div>
                              )
                            })()}

                            {/* Orchestrator */}
                            {(() => {
                              const agentTok = sortedHistory.reduce((s, h) => s + (h.tokens ?? 0), 0)
                              const managerTok = run.totalTokens != null ? Math.max(0, run.totalTokens - agentTok) : undefined
                              const orchKey = `${run.id}-orch-start`
                              const orchExpanded = expandedHistoryIdx.has(orchKey)
                              const toggleOrch = () => setExpandedHistoryIdx(prev => {
                                const next = new Set(prev); next.has(orchKey) ? next.delete(orchKey) : next.add(orchKey); return next
                              })
                              const orchPlanning = !allDone && sortedHistory.length === 0 && activeAgents.length === 0
                              return (
                                <div style={{ display: 'flex', gap: 8 }}>
                                  {dot(<IShipWheel style={{ width: 20, height: 20, ...(orchPlanning ? { animation: 'cc-orch-pulse 1.2s ease-in-out infinite' } : { color: 'var(--accent)' }) }} />)}
                                  <div style={{ flex: 1, paddingBottom: 16 }}>
                                    <div style={{ borderRadius: 8, background: 'var(--accent-soft)', overflow: 'hidden' }}>
                                      <div style={{ padding: '8px 10px' }}>
                                        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--fg-0)' }}>Orchestrator</div>
                                        {run.managerModel && <div style={{ fontSize: 10, color: GY2, fontFamily: 'var(--font-mono)', marginTop: 1 }}>{run.managerModel.split('/').pop()}</div>}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                                          <span style={{ fontSize: 10.5, color: 'var(--accent)' }}>Auftrag erhalten · plant Delegation</span>
                                          {sortedHistory[0] && (
                                            <span style={{ fontSize: 10, color: GY2, fontFamily: 'var(--font-mono)', marginLeft: 'auto' }}>
                                              {fmtSecs(Math.floor((sortedHistory[0].startedAt - run.startedAt) / 1000))}
                                            </span>
                                          )}
                                        </div>
                                        {managerTok != null && managerTok > 0 && (() => {
                                          const mCost = run.managerModel ? entryCost({ model: run.managerModel, tokens: managerTok }) : 0
                                          return (
                                            <div style={{ fontSize: 10, color: GY2, fontFamily: 'var(--font-mono)', marginTop: 4 }}>
                                              {fmtTok(managerTok)} tok{mCost > 0 ? ` · ${fmtCost(mCost)}` : ''}
                                            </div>
                                          )
                                        })()}
                                      </div>
                                      {run.goal && (
                                        <div onClick={toggleOrch} style={{ cursor: 'pointer', borderTop: '1px solid rgba(255,138,91,0.18)', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 4, userSelect: 'none' }}>
                                          <IChevDown style={{ width: 9, height: 9, color: 'var(--accent)', transform: orchExpanded ? 'none' : 'rotate(-90deg)', transition: 'transform 0.15s' }} />
                                          <span style={{ fontSize: 10, color: 'var(--accent)' }}>{orchExpanded ? 'Details ausblenden' : 'Details anzeigen'}</span>
                                        </div>
                                      )}
                                      {orchExpanded && run.goal && (
                                        <div style={{ padding: '8px 10px', borderTop: '1px solid var(--accent-line)' }}>
                                          <div style={{ fontSize: 9, fontWeight: 700, color: GY1, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>Aufgabe</div>
                                          <pre style={{ margin: 0, fontSize: 10, color: 'var(--fg-1)', fontFamily: 'var(--font-mono)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5 }}>{run.goal}</pre>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )
                            })()}

                            {/* Completed agents */}
                            {sortedHistory.map((h, i) => {
                              const color   = agentColor(h.agent)
                              const dur     = Math.floor((h.doneAt - h.startedAt) / 1000)
                              const cost    = entryCost(h)
                              const eKey    = `${run.id}-hist-${i}`
                              const expanded = expandedHistoryIdx.has(eKey)
                              const toggle  = () => setExpandedHistoryIdx(prev => {
                                const next = new Set(prev); next.has(eKey) ? next.delete(eKey) : next.add(eKey); return next
                              })
                              const isLast = i === sortedHistory.length - 1 && activeAgents.length === 0 && allDone
                              return (
                                <React.Fragment key={`${run.id}-${i}`}>
                                  <div style={{ display: 'flex', gap: 8 }}>
                                    {dot(<span style={{ width: 7, height: 7, borderRadius: '50%', background: GY2, flexShrink: 0, display: 'block' }} />)}
                                    <div style={{ paddingBottom: 16 }}>
                                      <div style={{ fontSize: 11, color: GY2 }}>Orchestrator delegiert</div>
                                      {h.task && (
                                        <div style={{ fontSize: 10, color: GY2, marginTop: 1, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 186 }}>
                                          „{h.task.length > 70 ? h.task.slice(0, 70) + '…' : h.task}"
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', gap: 8 }}>
                                    {dot(agentCircle(color), !isLast)}
                                    <div style={{ flex: 1, minWidth: 0, paddingBottom: isLast ? 0 : 16 }}>
                                      <div style={{ borderRadius: 8, background: `${color}10`, overflow: 'hidden' }}>
                                        {/* Card header — info only, no expand control */}
                                        <div style={{ padding: '8px 10px' }}>
                                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)' }}>{h.agent}</div>
                                          <div style={{ fontSize: 10, color: GY2, fontFamily: 'var(--font-mono)', marginTop: 1 }}>{h.model.split('/').pop()}</div>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                                            <span style={{ fontSize: 11, color }}>erledigt</span>
                                            <span style={{ marginLeft: 'auto', fontSize: 10, color: GY2, fontFamily: 'var(--font-mono)' }}>{fmtSecs(dur)}</span>
                                          </div>
                                          {h.tokens ? (
                                            <div style={{ fontSize: 10, color: GY2, fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                                              {fmtTok(h.tokens)} tok{cost > 0 ? ` · ${fmtCost(cost)}` : ''}
                                            </div>
                                          ) : null}
                                        </div>
                                        {/* Details toggle — only when there is content */}
                                        {(h.task || h.output) && (
                                          <div
                                            onClick={toggle}
                                            style={{ cursor: 'pointer', borderTop: `1px solid ${color}22`, padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 4, userSelect: 'none' }}
                                          >
                                            <IChevDown style={{ width: 9, height: 9, color, transform: expanded ? 'none' : 'rotate(-90deg)', transition: 'transform 0.15s' }} />
                                            <span style={{ fontSize: 10, color }}>{expanded ? 'Details ausblenden' : 'Details anzeigen'}</span>
                                          </div>
                                        )}
                                      </div>
                                      {expanded && (
                                        <div style={{ marginTop: 6, borderRadius: 6, border: `1px solid ${color}44`, overflow: 'hidden', background: 'var(--bg-1)' }}>
                                          {h.task && (
                                            <div style={{ padding: '8px 10px', borderBottom: `1px solid ${color}22` }}>
                                              <div style={{ fontSize: 9, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>Anweisung</div>
                                              <pre style={{ margin: 0, fontSize: 10, color: 'var(--fg-1)', fontFamily: 'var(--font-mono)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5 }}>{h.task}</pre>
                                            </div>
                                          )}
                                          <div style={{ padding: '8px 10px', maxHeight: 200, overflowY: 'auto' }}>
                                            <div style={{ fontSize: 9, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>Ergebnis</div>
                                            {h.output
                                              ? <pre style={{ margin: 0, fontSize: 10, color: 'var(--fg-1)', fontFamily: 'var(--font-mono)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5 }}>{h.output}</pre>
                                              : <span style={{ fontSize: 10, color: GY2, fontStyle: 'italic' }}>Kein Output aufgezeichnet</span>
                                            }
                                          </div>
                                          <div style={{ padding: '5px 10px 7px', display: 'flex', gap: 12, flexWrap: 'wrap', borderTop: `1px solid ${color}22` }}>
                                            <span style={{ fontSize: 9, color: GY2 }}>Dauer <span style={{ color: 'var(--fg-1)', fontFamily: 'var(--font-mono)' }}>{fmtSecs(dur)}</span></span>
                                            {h.tokens ? <span style={{ fontSize: 9, color: GY2 }}>Token <span style={{ color, fontFamily: 'var(--font-mono)' }}>{fmtTok(h.tokens)}</span></span> : null}
                                            {cost > 0 ? <span style={{ fontSize: 9, color: GY2 }}>Kosten <span style={{ color: 'var(--fg-1)', fontFamily: 'var(--font-mono)' }}>{fmtCost(cost)}</span></span> : null}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  {!isLast && i < sortedHistory.length - 1 && (() => {
                                    const bKey = `${run.id}-orch-${i}`
                                    const bExp = expandedHistoryIdx.has(bKey)
                                    const toggleB = () => setExpandedHistoryIdx(prev => {
                                      const next = new Set(prev); next.has(bKey) ? next.delete(bKey) : next.add(bKey); return next
                                    })
                                    const nextAgent = sortedHistory[i + 1]
                                    return (
                                      <div style={{ display: 'flex', gap: 8 }}>
                                        {dot(<IShipWheel style={{ width: 20, height: 20, color: 'var(--accent)' }} />)}
                                        <div style={{ flex: 1, paddingBottom: 16 }}>
                                          <div style={{ borderRadius: 8, background: 'var(--accent-soft)', overflow: 'hidden' }}>
                                            <div style={{ padding: '8px 10px' }}>
                                              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--fg-0)' }}>Orchestrator</div>
                                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                                                <span style={{ fontSize: 10.5, color: GY1 }}>koordiniert nächsten Schritt</span>
                                                {nextAgent && (
                                                  <span style={{ fontSize: 10, color: GY2, fontFamily: 'var(--font-mono)', marginLeft: 'auto' }}>
                                                    {fmtSecs(Math.floor((nextAgent.startedAt - h.doneAt) / 1000))}
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                            {nextAgent?.task && (
                                              <div onClick={toggleB} style={{ cursor: 'pointer', borderTop: '1px solid rgba(255,138,91,0.18)', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 4, userSelect: 'none' }}>
                                                <IChevDown style={{ width: 9, height: 9, color: 'var(--accent)', transform: bExp ? 'none' : 'rotate(-90deg)', transition: 'transform 0.15s' }} />
                                                <span style={{ fontSize: 10, color: 'var(--accent)' }}>{bExp ? 'Details ausblenden' : 'Details anzeigen'}</span>
                                              </div>
                                            )}
                                            {bExp && nextAgent?.task && (
                                              <div style={{ padding: '8px 10px', borderTop: '1px solid var(--accent-line)' }}>
                                                <div style={{ fontSize: 9, fontWeight: 700, color: GY1, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>Nächste Aufgabe</div>
                                                <pre style={{ margin: 0, fontSize: 10, color: 'var(--fg-1)', fontFamily: 'var(--font-mono)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5 }}>{nextAgent.task}</pre>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    )
                                  })()}
                                </React.Fragment>
                              )
                            })}

                            {/* Active agents */}
                            {activeAgents.map((a, ai) => {
                              const color = agentColor(a.agent)
                              return (
                                <React.Fragment key={`${run.id}-active-${ai}`}>
                                  <div style={{ display: 'flex', gap: 8 }}>
                                    {dot(<span style={{ width: 7, height: 7, borderRadius: '50%', background: GY2, flexShrink: 0, display: 'block' }} />)}
                                    <div style={{ paddingBottom: 16 }}>
                                      <div style={{ fontSize: 11, color: GY2 }}>Orchestrator delegiert</div>
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 18, flexShrink: 0, paddingTop: 9 }}>
                                      {agentCircle(color, true)}
                                    </div>
                                    <div style={{ flex: 1, padding: '10px 14px 12px', borderRadius: 10, background: `${color}18`, margin: '0 0 16px' }}>
                                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg-0)' }}>{a.agent}</div>
                                      <div style={{ fontSize: 10.5, color: GY2, fontFamily: 'var(--font-mono)', marginTop: 3 }}>{a.model.split('/').pop()}</div>
                                      <div style={{ fontSize: 11, color, marginTop: 6, fontWeight: 500 }}>arbeitet…</div>
                                    </div>
                                  </div>
                                </React.Fragment>
                              )
                            })}

                            {/* Orchestrator waiting between agents */}
                            {!allDone && activeAgents.length === 0 && run.agents.length > 0 && (
                              <div style={{ display: 'flex', gap: 8 }}>
                                {dot(<IShipWheel style={{ width: 15, height: 15, animation: 'cc-orch-pulse 1.2s ease-in-out infinite' }} />)}
                                <div style={{ paddingBottom: 10 }}>
                                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--fg-0)' }}>Orchestrator</div>
                                  {run.managerModel && <div style={{ fontSize: 10, color: GY2, fontFamily: 'var(--font-mono)', marginTop: 1 }}>{run.managerModel.split('/').pop()}</div>}
                                  <div style={{ fontSize: 11, color: GY1, marginTop: 2 }}>koordiniert nächsten Schritt…</div>
                                </div>
                              </div>
                            )}

                            {/* Error box */}
                            {run.error && (() => {
                              const eKey = `${run.id}-error`
                              const eExp = expandedHistoryIdx.has(eKey)
                              const toggleE = () => setExpandedHistoryIdx(prev => {
                                const next = new Set(prev); next.has(eKey) ? next.delete(eKey) : next.add(eKey); return next
                              })
                              const errContent = [run.error, run.errorTraceback].filter(Boolean).join('\n\n')
                              return (
                                <div style={{ marginTop: 16, borderRadius: 7, border: '1px solid var(--danger-line)', background: 'var(--danger-soft)', overflow: 'hidden' }}>
                                  {/* Compact header row */}
                                  <div
                                    onClick={toggleE}
                                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', userSelect: 'none' }}
                                  >
                                    <IWarn style={{ width: 11, height: 11, color: 'var(--err)', flexShrink: 0 }} />
                                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--err)', flexShrink: 0 }}>Fehler</span>
                                    <span style={{ fontSize: 9.5, color: 'var(--err)', opacity: 0.7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{run.error}</span>
                                    <IChevDown style={{ width: 8, height: 8, color: 'var(--err)', flexShrink: 0, transform: eExp ? 'none' : 'rotate(-90deg)', transition: 'transform 0.15s' }} />
                                  </div>
                                  {eExp && (
                                    <div style={{ borderTop: '1px solid var(--danger-line)' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '4px 10px', borderBottom: '1px solid var(--danger-line)' }}>
                                        <button
                                          onClick={e => { e.stopPropagation(); void navigator.clipboard.writeText(errContent) }}
                                          style={{ background: 'none', border: '1px solid var(--danger-line)', borderRadius: 4, padding: '2px 8px', fontSize: 9.5, color: 'var(--err)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, fontFamily: 'var(--font-ui)' }}
                                        >
                                          <ICopy style={{ width: 9, height: 9 }} /> Kopieren
                                        </button>
                                      </div>
                                      <pre style={{ margin: 0, padding: '8px 10px', fontSize: 9.5, color: 'var(--err)', opacity: 0.85, fontFamily: 'var(--font-mono)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5, maxHeight: 240, overflowY: 'auto' }}>{run.errorTraceback || run.error}</pre>
                                    </div>
                                  )}
                                </div>
                              )
                            })()}

                            {/* Abgeschlossen */}
                            {allDone && run.history.length > 0 && (
                              <div style={{ marginTop: 16, borderRadius: 7, border: '1px solid var(--line)', overflow: 'hidden' }}>
                                {/* Info header — not clickable */}
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '8px 12px' }}>
                                  <ICircleCheckBig style={{ width: 14, height: 14, color: GY1, flexShrink: 0, marginTop: 1 }} />
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-0)' }}>Abgeschlossen</span>
                                      <span style={{ marginLeft: 'auto', fontSize: 10, color: GY2, fontFamily: 'var(--font-mono)' }}>{fmtSecs(totalSecs)}</span>
                                    </div>
                                    {totalTokens > 0 && (
                                      <div style={{ fontSize: 10, color: GY2, fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                                        {fmtTok(totalTokens)} Token{totalCost > 0 ? ` · ≈ ${fmtCost(totalCost)}` : ''}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                {/* Details toggle strip */}
                                <div
                                  onClick={toggleSummary}
                                  style={{ cursor: 'pointer', borderTop: '1px solid var(--line)', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 4, userSelect: 'none' }}
                                >
                                  <IChevDown style={{ width: 9, height: 9, color: GY1, transform: summaryExpanded ? 'none' : 'rotate(-90deg)', transition: 'transform 0.15s' }} />
                                  <span style={{ fontSize: 10, color: GY1 }}>{summaryExpanded ? 'Details ausblenden' : 'Details anzeigen'}</span>
                                </div>
                                {summaryExpanded && lastHistory?.output && (
                                  <div style={{ padding: '8px 12px 10px', borderTop: '1px solid var(--line)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                                      <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: 0.4, flex: 1 }}>Ergebnis</span>
                                      <button
                                        onClick={e => { e.stopPropagation(); void navigator.clipboard.writeText(lastHistory.output ?? '') }}
                                        style={{ background: 'none', border: '1px solid var(--line-strong)', borderRadius: 4, padding: '1px 7px', fontSize: 9.5, color: 'var(--fg-3)', cursor: 'pointer', fontFamily: 'var(--font-ui)', display: 'flex', alignItems: 'center', gap: 3 }}
                                      >
                                        <ICopy style={{ width: 9, height: 9 }} /> Kopieren
                                      </button>
                                    </div>
                                    <pre style={{ margin: 0, fontSize: 10.5, color: 'var(--fg-1)', fontFamily: 'var(--font-mono)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5, maxHeight: 200, overflowY: 'auto' }}>
                                      {lastHistory.output}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            )}

                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })()}

      </div>

      {/* ── Git info bar ── */}
      <GitInfoBar projectPath={project?.path} />

      {/* ── Export bottom bar ── */}
      <div style={{ padding: '8px 12px 16px', display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
        {/* Export icon */}
        <IDownload style={{ width: 13, height: 13, color: 'var(--fg-3)' }} />
        <span style={{ fontSize: 11, color: 'var(--fg-3)', flexShrink: 0 }}>Export</span>
        <div style={{ flex: 1 }}>
          <SingleCombobox
            value={exportFmt}
            onChange={v => setExportFmt(v as ExportFmt)}
            options={[
              { value: 'txt',  label: 'Terminal .txt' },
              { value: 'md',   label: 'Markdown .md' },
              { value: 'json', label: 'JSON .json' },
            ]}
            maxHeight={180}
          />
        </div>
        <button
          onClick={handleExport}
          disabled={!session || exporting}
          style={{ padding: '3px 8px', border: '1px solid var(--line)', borderRadius: 4, background: 'transparent', color: session && !exporting ? 'var(--fg-2)' : 'var(--fg-3)', fontSize: 10.5, cursor: session && !exporting ? 'pointer' : 'default', fontFamily: 'var(--font-ui)', flexShrink: 0, transition: 'color 0.15s, border-color 0.15s', opacity: exporting ? 0.5 : 1 }}
        >
          {exporting ? '…' : '↓'}
        </button>
      </div>
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
        <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--bg-2)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
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
            <div key={ext} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', borderRadius: 7, background: 'var(--bg-2)', border: '1px solid var(--line)' }}>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, border: '1px solid var(--line)', borderRadius: 4, background: 'var(--bg-2)', padding: '2px 6px', flexShrink: 0 }}>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, border: '1px solid var(--line)', borderRadius: 4, background: 'var(--bg-2)', padding: '2px 6px', flex: 1 }}>
            <ISearch style={{ width: 10, height: 10, color: 'var(--fg-3)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Suchen…" style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 10.5, color: 'var(--fg-0)', fontFamily: 'var(--font-ui)', width: '100%' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, border: '1px solid var(--line)', borderRadius: 4, background: 'var(--bg-2)', padding: '2px 6px', flex: 1 }}>
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
    <div style={{ marginBottom: 14, paddingTop: 14 }}>
      <div
        onClick={collapsible ? () => setOpen(o => !o) : undefined}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: open ? 8 : 0, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.7, color: 'var(--fg-3)', fontWeight: 500, cursor: collapsible ? 'pointer' : 'default', userSelect: 'none' }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {collapsible && <IChev style={{ width: 8, height: 8, transition: 'transform 0.15s', transform: open ? 'rotate(90deg)' : 'none', flexShrink: 0 }} />}
          {title}
        </span>
        {action && <span style={{ color: 'var(--fg-2)', cursor: 'pointer' }} onClick={e => e.stopPropagation()}>{action}</span>}
      </div>
      {open && children}
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

const chip: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px',
  background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 99,
  color: 'var(--fg-1)', fontSize: 10.5, cursor: 'pointer', fontFamily: 'var(--font-ui)',
}
