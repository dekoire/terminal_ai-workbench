import React, { useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import type { PermMode } from '../../store/useAppStore'
import { IClose, IFolderOpen, IDrive } from '../primitives/Icons'
import { Pill } from '../primitives/Pill'

const fieldLabel: React.CSSProperties = { display: 'block', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.7, color: 'var(--fg-3)', fontWeight: 500, marginBottom: 6 }
const fieldInput: React.CSSProperties = { width: '100%', padding: '7px 10px', border: '1px solid var(--line-strong)', borderRadius: 6, background: 'var(--bg-2)', color: 'var(--fg-0)', fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none' }
const btnPrimary: React.CSSProperties = { background: 'var(--accent)', color: '#1a1410', border: 'none', padding: '7px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)' }
const btnGhost: React.CSSProperties = { background: 'transparent', color: 'var(--fg-1)', border: '1px solid var(--line-strong)', padding: '7px 14px', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-ui)' }

export function NewProjectModal() {
  const { setNewProjectOpen, addProject, setScreen, setActiveProject, setNewSessionOpen, aliases } = useAppStore()
  const [name, setName]               = useState('')
  const [path, setPath]               = useState('')
  const [defaultAlias, setDefaultAlias] = useState(aliases[0]?.name ?? 'claude-code')
  const [permMode, setPermMode]       = useState<PermMode>('normal')
  const [picking, setPicking]         = useState(false)

  // Öffnet den nativen macOS-Ordnerdialog über den Vite-API-Endpunkt
  const pickFolder = async () => {
    setPicking(true)
    try {
      const r = await fetch(`/api/pick-folder?path=${encodeURIComponent(path || '~')}`)
      const data = await r.json() as { ok: boolean; path: string | null }
      if (data.ok && data.path) {
        setPath(data.path)
        // Projektname automatisch aus dem Ordnernamen ableiten wenn noch leer
        if (!name.trim()) {
          setName(data.path.split('/').pop() ?? '')
        }
      }
    } finally {
      setPicking(false)
    }
  }

  const create = () => {
    if (!name.trim() || !path.trim()) return
    const id = `p${Date.now()}`
    addProject({ id, name: name.trim(), path: path.trim(), branch: 'main', sessions: [] })
    setActiveProject(id)
    setNewProjectOpen(false)
    setScreen('workspace')
    setNewSessionOpen(true)
  }

  return (
    <Backdrop onClick={() => setNewProjectOpen(false)}>
      <Modal title="Neues Projekt" onClose={() => setNewProjectOpen(false)}>
        <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
          <Stepper step={1} />

          <div>
            <label style={fieldLabel}>Projektname</label>
            <input autoFocus style={fieldInput} value={name} onChange={e => setName(e.target.value)} placeholder="z.B. payments-api" />
          </div>

          <div>
            <label style={fieldLabel}>Lokaler Pfad</label>
            <div style={{ display: 'flex', alignItems: 'stretch', border: '1px solid var(--line-strong)', borderRadius: 6, background: 'var(--bg-2)', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', padding: '0 10px', color: 'var(--fg-2)', borderRight: '1px solid var(--line)' }}>
                <IFolderOpen />
              </div>
              <input
                style={{ ...fieldInput, border: 'none', borderRadius: 0, background: 'transparent', flex: 1 }}
                value={path}
                onChange={e => setPath(e.target.value)}
                placeholder="/Users/…/mein-projekt"
              />
              <button
                onClick={pickFolder}
                disabled={picking}
                style={{ border: 'none', borderLeft: '1px solid var(--line)', background: 'var(--bg-3)', color: 'var(--fg-1)', padding: '0 14px', fontSize: 11.5, cursor: picking ? 'wait' : 'pointer', fontFamily: 'var(--font-ui)', display: 'flex', alignItems: 'center', gap: 6, opacity: picking ? 0.6 : 1 }}
              >
                <IFolderOpen style={{ color: 'var(--accent)' }} />
                {picking ? 'Wähle…' : 'Ordner wählen'}
              </button>
            </div>
            {path && <FolderPreviewSimple path={path} />}
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={fieldLabel}>Default alias</label>
              <select style={{ ...fieldInput, cursor: 'pointer' }} value={defaultAlias} onChange={e => setDefaultAlias(e.target.value)}>
                {aliases.length === 0
                  ? <option value="">no aliases yet</option>
                  : aliases.map(a => <option key={a.id} value={a.name}>{a.name}</option>)
                }
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={fieldLabel}>Permission mode</label>
              <select style={{ ...fieldInput, cursor: 'pointer' }} value={permMode} onChange={e => setPermMode(e.target.value as PermMode)}>
                <option value="normal">ask each time</option>
                <option value="dangerous">dangerous</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 'auto', paddingTop: 12, borderTop: '1px solid var(--line)' }}>
            <span style={{ flex: 1 }} />
            <button style={btnGhost} onClick={() => setNewProjectOpen(false)}>Abbrechen</button>
            <button
              style={{ ...btnPrimary, opacity: (!name.trim() || !path.trim()) ? 0.5 : 1 }}
              disabled={!name.trim() || !path.trim()}
              onClick={create}
            >
              Projekt anlegen
            </button>
          </div>
        </div>
      </Modal>
    </Backdrop>
  )
}

function FolderPreviewSimple({ path }: { path: string }) {
  const displayPath = path.replace(/^~/, 'Home')
  return (
    <div style={{ marginTop: 8, border: '1px solid var(--line)', borderRadius: 6, background: 'var(--bg-2)', padding: '8px 10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, color: 'var(--fg-1)', fontFamily: 'var(--font-mono)' }}>
        <IDrive style={{ color: 'var(--fg-3)' }} />
        <span>{displayPath}</span>
      </div>
    </div>
  )
}

function Stepper({ step }: { step: number }) {
  const steps = ['Source', 'Settings', 'Confirm']
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
      {steps.map((s, i) => (
        <React.Fragment key={s}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: i + 1 === step ? 'var(--accent)' : i + 1 < step ? 'var(--fg-1)' : 'var(--fg-3)' }}>
            <span style={{ width: 18, height: 18, borderRadius: 9, fontSize: 10, fontWeight: 600, border: `1px solid ${i + 1 === step ? 'var(--accent)' : 'var(--line-strong)'}`, background: i + 1 === step ? 'var(--accent-soft)' : 'transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              {i + 1 < step ? '✓' : i + 1}
            </span>
            <span style={{ fontWeight: i + 1 === step ? 600 : 400 }}>{s}</span>
          </div>
          {i < steps.length - 1 && <span style={{ flex: 1, height: 1, background: 'var(--line)', maxWidth: 30 }} />}
        </React.Fragment>
      ))}
    </div>
  )
}

function Backdrop({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <div onClick={onClick} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(8,7,5,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()}>{children}</div>
    </div>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ width: 620, maxWidth: '92vw', height: 460, background: 'var(--bg-1)', border: '1px solid var(--line-strong)', borderRadius: 10, boxShadow: '0 24px 64px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ height: 38, padding: '0 14px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--line)' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)' }}>{title}</span>
        <span style={{ flex: 1 }} />
        <IClose onClick={onClose} style={{ color: 'var(--fg-2)', cursor: 'pointer' }} />
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
    </div>
  )
}
