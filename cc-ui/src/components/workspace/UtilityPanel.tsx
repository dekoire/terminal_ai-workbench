import React, { useState, useEffect } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { IMore, IEdit, IChev, IFolder, IFolderOpen } from '../primitives/Icons'
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

function LiveTreeNode({ node, depth }: { node: LiveNode; depth: number }) {
  // Depth-0 (root) and depth-1 start open; deeper levels are collapsed
  const [open, setOpen]         = useState(depth <= 1)
  const [children, setChildren] = useState<LiveNode[]>(node.children ?? [])
  const [loaded, setLoaded]     = useState(node.loaded ?? false)
  const [flash, setFlash]       = useState(false)
  const indent = depth * 14 + 6

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

  const handleClick = () => {
    if (node.isDir) {
      // Dirs: expand/collapse in tree; don't open Finder (use header button for that)
      if (!open) loadChildren()
      setOpen(o => !o)
    } else {
      // Files: open in OS default application
      setFlash(true)
      setTimeout(() => setFlash(false), 600)
      openInFinder(node.path)
    }
  }

  return (
    <div>
      <div
        onClick={handleClick}
        title={node.isDir ? node.path : `Open ${node.name} in default app`}
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
      {node.isDir && open && children.map(child => (
        <LiveTreeNode key={child.path} node={child} depth={depth + 1} />
      ))}
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
  const [busy, setBusy]         = useState('')   // which action is running
  const [log, setLog]           = useState('')   // last action output
  const [newBranch, setNewBranch] = useState('')

  const refresh = () => {
    setLoading(true)
    fetch(`/api/git?path=${encodeURIComponent(projectPath)}`)
      .then(r => r.json())
      .then(d => { setInfo(d); setLoading(false) })
      .catch(() => setLoading(false))
  }
  useEffect(() => { refresh() }, [projectPath])

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
              style={{ ...smallBtn, background: 'var(--accent)', color: '#1a1410', border: 'none', flex: 1 }}
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

export function UtilityPanel() {
  const [tab, setTab] = useState(0)
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

  const tabs = ['Session', 'Files', 'Git']

  return (
    <aside style={{ width: 280, flexShrink: 0, background: 'var(--bg-1)', borderLeft: '1px solid var(--line)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
        {tabs.map((t, i) => (
          <div key={t} onClick={() => setTab(i)} style={{
            flex: 1, padding: '9px 0', textAlign: 'center', fontSize: 10.5,
            color: i === tab ? 'var(--fg-0)' : 'var(--fg-2)',
            borderBottom: i === tab ? '2px solid var(--accent)' : '2px solid transparent',
            cursor: 'pointer', fontWeight: i === tab ? 600 : 400, marginBottom: -1,
          }}>{t}</div>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: tab === 1 || tab === 2 ? 'hidden' : 'auto', padding: tab === 1 || tab === 2 ? 0 : 14, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

        {/* ── Tab 0: Session (zusammengeführt aus Notes + Metadata) ── */}
        {tab === 0 && (
          <>
            {/* Session-Info */}
            <Card title="Session" action={<IMore />}>
              <Field label="Titel" value={session?.name ?? '—'} />
              <Field label="Alias" value={session?.alias ?? '—'} mono accent />
              <Field label="Modell" value={modelLabel} mono />
              <Field label="Berechtigung" value={session?.permMode === 'dangerous' ? 'dangerous' : 'ask each time'} />
              <Field label="Gestartet" value={startedLabel} />
            </Card>

            {/* Projekt-Info (ehemals Metadata-Tab) */}
            <Card title="Projekt">
              <Field label="Name" value={project?.name ?? '—'} />
              <Field label="Pfad" value={project?.path ?? '—'} mono />
              <Field label="Branch" value={project?.branch ?? '—'} mono accent />
              <Field label="Geändert" value={String(project?.dirty ?? 0) + ' Dateien'} />
            </Card>

            {/* Notizen */}
            <NotesCard sessionId={activeSessionId} />

            {/* Aliases */}
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

            {/* Export */}
            <Card title="Export">
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['Markdown', 'JSON transcript', 'Diff bundle', 'PR description'].map((l) => (
                  <button key={l} style={chip}>{l}</button>
                ))}
              </div>
            </Card>
          </>
        )}

        {/* ── Tab 1: Files ── */}
        {tab === 1 && project && <FilesTab projectName={project.name} projectPath={project.path} />}
        {tab === 1 && !project && (
          <div style={{ textAlign: 'center', color: 'var(--fg-3)', fontSize: 12, marginTop: 40 }}>Kein Projekt ausgewählt</div>
        )}

        {/* ── Tab 2: Git ── */}
        {tab === 2 && project && <GitTab projectPath={project.path} />}
        {tab === 2 && !project && (
          <div style={{ textAlign: 'center', color: 'var(--fg-3)', fontSize: 12, marginTop: 40 }}>Kein Projekt ausgewählt</div>
        )}
      </div>
    </aside>
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
