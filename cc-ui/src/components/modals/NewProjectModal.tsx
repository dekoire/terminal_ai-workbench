import React, { useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { IClose, IFolderOpen, IDrive } from '../primitives/Icons'

const fieldLabel: React.CSSProperties = { display: 'block', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.7, color: 'var(--fg-3)', fontWeight: 500, marginBottom: 6 }
const fieldInput: React.CSSProperties = { width: '100%', padding: '7px 10px', border: '1px solid var(--line-strong)', borderRadius: 6, background: 'var(--bg-2)', color: 'var(--fg-0)', fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none' }
const btnPrimary: React.CSSProperties = { background: 'var(--accent)', color: 'var(--accent-fg, #1a1410)', border: 'none', padding: '7px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)' }
const btnGhost: React.CSSProperties = { background: 'transparent', color: 'var(--fg-1)', border: '1px solid var(--line-strong)', padding: '7px 14px', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-ui)' }

export function NewProjectModal() {
  const { setNewProjectOpen, addProject, setScreen, setActiveProject, setNewSessionOpen } = useAppStore()
  const [name, setName]     = useState('')
  const [path, setPath]     = useState('')
  const [picking, setPicking] = useState(false)

  const pickFolder = async () => {
    setPicking(true)
    try {
      const r = await fetch(`/api/pick-folder?path=${encodeURIComponent(path || '~')}`)
      const data = await r.json() as { ok: boolean; path: string | null }
      if (data.ok && data.path) {
        setPath(data.path)
        if (!name.trim()) setName(data.path.split('/').pop() ?? '')
      }
    } finally {
      setPicking(false)
    }
  }

  const create = () => {
    if (!name.trim() || !path.trim()) return
    const id = `p${Date.now()}`
    addProject({ id, name: name.trim(), path: path.trim(), branch: '', sessions: [] })
    setActiveProject(id)
    setNewProjectOpen(false)
    setScreen('workspace')
    setNewSessionOpen(true)
  }

  const canCreate = name.trim() && path.trim()

  return (
    <Backdrop onClick={() => setNewProjectOpen(false)}>
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: 540, maxWidth: '92vw', background: 'var(--bg-1)', border: '1px solid var(--line-strong)', borderRadius: 10, boxShadow: '0 24px 64px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        {/* Header */}
        <div style={{ height: 44, padding: '0 16px', display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--line)' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)' }}>Projektordner auswählen</div>
            <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginTop: 1 }}>Wähle einen lokalen Ordner und vergib einen Namen</div>
          </div>
          <IClose onClick={() => setNewProjectOpen(false)} style={{ color: 'var(--fg-2)', cursor: 'pointer' }} />
        </div>

        {/* Body */}
        <div style={{ padding: '20px 20px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Path picker — primary action */}
          <div>
            <label style={fieldLabel}>Lokaler Pfad</label>
            <div style={{ display: 'flex', alignItems: 'stretch', border: '1px solid var(--line-strong)', borderRadius: 6, background: 'var(--bg-2)', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', padding: '0 10px', color: 'var(--fg-3)', borderRight: '1px solid var(--line)' }}>
                <IFolderOpen />
              </div>
              <input
                style={{ ...fieldInput, border: 'none', borderRadius: 0, background: 'transparent', flex: 1 }}
                value={path}
                onChange={e => {
                  setPath(e.target.value)
                  if (!name.trim()) setName(e.target.value.split('/').pop() ?? '')
                }}
                placeholder="/Users/…/mein-projekt"
              />
              <button
                onClick={pickFolder}
                disabled={picking}
                style={{ border: 'none', borderLeft: '1px solid var(--line)', background: 'var(--bg-3)', color: 'var(--fg-1)', padding: '0 14px', fontSize: 11.5, cursor: picking ? 'wait' : 'pointer', fontFamily: 'var(--font-ui)', display: 'flex', alignItems: 'center', gap: 6, opacity: picking ? 0.6 : 1, whiteSpace: 'nowrap' }}
              >
                <IFolderOpen style={{ color: 'var(--accent)' }} />
                {picking ? 'Wähle…' : 'Ordner wählen'}
              </button>
            </div>
            {path && <FolderPreview path={path} />}
          </div>

          {/* Project name */}
          <div>
            <label style={fieldLabel}>Projektname</label>
            <input
              autoFocus
              style={fieldInput}
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && canCreate && create()}
              placeholder="z.B. payments-api"
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, padding: '12px 20px', borderTop: '1px solid var(--line)' }}>
          <button style={btnGhost} onClick={() => setNewProjectOpen(false)}>Abbrechen</button>
          <button
            style={{ ...btnPrimary, opacity: canCreate ? 1 : 0.45 }}
            disabled={!canCreate}
            onClick={create}
          >
            Projekt anlegen
          </button>
        </div>
      </div>
    </Backdrop>
  )
}

function FolderPreview({ path }: { path: string }) {
  const parts = path.replace(/^\/Users\/[^/]+/, '~').split('/')
  return (
    <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 5, padding: '5px 8px', borderRadius: 4, background: 'var(--bg-2)', border: '1px solid var(--line)' }}>
      <IDrive style={{ color: 'var(--fg-3)', flexShrink: 0 }} />
      <span style={{ fontSize: 10.5, color: 'var(--fg-2)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {parts.join(' / ')}
      </span>
    </div>
  )
}

function Backdrop({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(8,7,5,0.65)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      {children}
    </div>
  )
}
