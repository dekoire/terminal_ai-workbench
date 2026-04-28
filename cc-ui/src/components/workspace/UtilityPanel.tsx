import React, { useState, useEffect, useRef } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { IMore, IEdit, IChev, IFolder, IFolderOpen, IFile, IClose } from '../primitives/Icons'
import { Pill } from '../primitives/Pill'

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

  return (
    <svg width="11" height="13" viewBox="0 0 11 13" fill="none" style={{ flexShrink: 0 }}>
      <path d="M1 1.5h5.5l2.5 2.5V11.5a.5.5 0 0 1-.5.5H1a.5.5 0 0 1-.5-.5v-10A.5.5 0 0 1 1 1.5z" stroke={color} strokeWidth="1" fill="none"/>
      <path d="M6.5 1.5v2.5H9" stroke={color} strokeWidth="1"/>
    </svg>
  )
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
              icon={<svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--fg-2)', flexShrink: 0 }}><rect x="1" y="2.5" width="10" height="8" rx="1.5"/><path d="M1 5.5h10M4 2.5v3"/></svg>}
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
            icon={<svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--fg-2)', flexShrink: 0 }}><path d="M2 1h5l3 3v7H2V1z"/><path d="M7 1v3h3"/><path d="M5 7v3M3.5 8.5h3"/></svg>}
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
            icon={<svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--fg-2)', flexShrink: 0 }}><rect x="4" y="1" width="7" height="8" rx="1"/><path d="M1 4v7h7"/></svg>}
            onClick={() => { navigator.clipboard.writeText(node.path); setMenu(null) }}
          />
          <CtxItem
            label="Name kopieren"
            icon={<svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--fg-2)', flexShrink: 0 }}><rect x="4" y="1" width="7" height="8" rx="1"/><path d="M1 4v7h7"/></svg>}
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
                    icon={<svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--fg-2)', flexShrink: 0 }}><path d="M7 1h4v4M11 1 5.5 6.5M5 2H2a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V8"/></svg>}
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
            icon={<svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M2 4h12M5 4V2.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 .5.5V4M6 7v5M10 7v5M3 4l1 9.5a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 .5-.5L13 4"/></svg>}
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
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="var(--danger)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 4h12M5 4V2.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 .5.5V4M6 7v5M10 7v5M3 4l1 9.5a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 .5-.5L13 4"/>
            </svg>
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

  useEffect(() => {
    setRoot(null)
    setError('')
    setNotFound(false)
    fetch(`/api/browse?path=${encodeURIComponent(projectPath)}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setNotFound(true)
          return
        }
        const folderName = projectPath.split('/').pop() ?? projectPath
        const children: LiveNode[] = (data.items ?? []).filter((i: LiveNode) => i.name !== '..')
        setRoot({ name: folderName, path: data.currentPath ?? projectPath, isDir: true, children, loaded: true })
      })
      .catch(e => setError(String(e)))
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

      <div style={{ padding: '5px 10px', borderTop: '1px solid var(--line)', fontSize: 10, color: 'var(--fg-3)' }}>
        Ordner anklicken zum Auf-/Zuklappen · Datei anklicken zum Öffnen
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
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 1h4v4M11 1 5.5 6.5M5 2H2a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V8"/>
            </svg>
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
    <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--fg-3)', fontWeight: 500, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
      {children}
    </div>
  )
}

const smallBtn: React.CSSProperties = {
  padding: '4px 9px', border: '1px solid var(--line-strong)', borderRadius: 4,
  background: 'var(--bg-3)', color: 'var(--fg-1)', fontSize: 10.5,
  cursor: 'pointer', fontFamily: 'var(--font-ui)', whiteSpace: 'nowrap',
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

export function UtilityPanel() {
  const [tab, setTab] = useState(0)
  const [exportFmt, setExportFmt] = useState<ExportFmt>('txt')
  const [exporting, setExporting]  = useState(false)
  const { aliases, activeSessionId, projects, activeProjectId } = useAppStore()
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

  // Tab order: Session | Git | Files | Data
  const tabs = ['Session', 'Git', 'Files', 'Data']
  const noPadding = [1, 2, 3]

  return (
    <aside style={{ width: '100%', flexShrink: 0, background: 'var(--bg-1)', borderLeft: '1px solid var(--line)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
        {tabs.map((t, i) => (
          <div key={t} onClick={() => setTab(i)} style={{
            flex: 1, padding: '9px 0', textAlign: 'center', fontSize: 10.5,
            color: i === tab ? 'var(--fg-0)' : 'var(--fg-2)',
            borderBottom: i === tab ? '2px solid var(--accent)' : '2px solid transparent',
            cursor: 'pointer', fontWeight: i === tab ? 600 : 400, marginBottom: -1,
            position: 'relative',
          }}>
            {t}
            {t === 'Data' && dataFiles.length > 0 && (
              <span style={{ position: 'absolute', top: 6, right: 6, width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)' }} />
            )}
          </div>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: noPadding.includes(tab) ? 'hidden' : 'auto', padding: noPadding.includes(tab) ? 0 : 14, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

        {/* ── Tab 0: Session ── */}
        {tab === 0 && (
          <>
            <Card title="Session" action={<IMore />}>
              <Field label="Alias" value={session?.alias ?? '—'} mono accent />
              <Field label="Modell" value={modelLabel} mono />
              <Field label="Gestartet" value={startedLabel} />
              <Field label="Pfad" value={project?.path ?? '—'} mono />
              <Field label="Branch" value={project?.branch ?? '—'} mono accent />
            </Card>
            <NotesCard sessionId={activeSessionId} />
            <Card title="Aliases">
              {aliases.slice(0, 5).map((a) => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px', borderRadius: 4, background: a.name === session?.alias ? 'var(--bg-3)' : 'transparent', marginBottom: 1 }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: a.status === 'ok' ? 'var(--ok)' : 'var(--warn)' }} />
                  <span className="mono" style={{ flex: 1, fontSize: 11, color: a.name === session?.alias ? 'var(--accent)' : 'var(--fg-1)' }}>{a.name}</span>
                  <span className="mono" style={{ fontSize: 10, color: 'var(--fg-3)' }}>{a.cmd}</span>
                  {a.name === session?.alias && <Pill tone="accent">aktiv</Pill>}
                </div>
              ))}
            </Card>
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
      </div>

      {/* ── Export bottom bar ── */}
      <div style={{ borderTop: '1px solid var(--line)', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
        {/* Export icon */}
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="var(--fg-3)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 2v8M5 7l3 3 3-3M3 12h10" />
        </svg>
        <span style={{ fontSize: 11, color: 'var(--fg-3)', flexShrink: 0 }}>Export</span>
        <select
          value={exportFmt}
          onChange={e => setExportFmt(e.target.value as ExportFmt)}
          style={{ flex: 1, padding: '3px 6px', border: '1px solid var(--line)', borderRadius: 4, background: 'var(--bg-2)', color: 'var(--fg-1)', fontSize: 10.5, fontFamily: 'var(--font-ui)', outline: 'none', cursor: 'pointer' }}
        >
          <option value="txt">Terminal .txt</option>
          <option value="md">Markdown .md</option>
          <option value="json">JSON .json</option>
        </select>
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
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 28 }}>
        <div style={{ width: 46, height: 46, borderRadius: 12, background: 'var(--bg-3)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="var(--fg-3)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 2h7l3 3v9H3V2z"/><path d="M10 2v3h3"/><path d="M6 7h4M6 9.5h4M6 12h2"/>
          </svg>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-1)', marginBottom: 6 }}>Keine Datei geöffnet</div>
          <div style={{ fontSize: 11, color: 'var(--fg-3)', lineHeight: 1.7 }}>
            Im <strong style={{ color: 'var(--fg-2)' }}>Files</strong>-Tab mit der<br />
            rechten Maustaste auf eine Datei klicken<br />
            und <em>Im Data Viewer öffnen</em> wählen.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '6px 12px', borderRadius: 6, background: 'var(--bg-3)', border: '1px solid var(--line)', fontSize: 10.5, color: 'var(--fg-3)' }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M5 2v6M2 5h6"/></svg>
          JSON, CSV, Text & Logdateien
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
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="var(--fg-3)" strokeWidth="1.5" strokeLinecap="round"><circle cx="5" cy="5" r="3.5"/><path d="M8 8l2.5 2.5"/></svg>
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
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="var(--fg-3)" strokeWidth="1.5" strokeLinecap="round"><circle cx="5" cy="5" r="3.5"/><path d="M8 8l2.5 2.5"/></svg>
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

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.7, color: 'var(--fg-3)', fontWeight: 500 }}>
        <span>{title}</span>
        {action && <span style={{ color: 'var(--fg-2)', cursor: 'pointer' }}>{action}</span>}
      </div>
      {children}
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
