import React, { useState, useEffect } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { IClose, IFolderOpen, IDrive, ITerminal, ISpark } from '../primitives/Icons'
import { aiDetectStartCmd } from '../../utils/aiDetect'

const fieldLabel: React.CSSProperties = { display: 'block', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.7, color: 'var(--fg-3)', fontWeight: 500, marginBottom: 6 }
const fieldInput: React.CSSProperties = { width: '100%', padding: '7px 10px', border: '1px solid var(--line-strong)', borderRadius: 6, background: 'var(--bg-2)', color: 'var(--fg-0)', fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none', boxSizing: 'border-box' as const }
const btnPrimary: React.CSSProperties = { background: 'var(--accent)', color: 'var(--accent-fg, #1a1410)', border: 'none', padding: '7px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)' }
const btnGhost: React.CSSProperties = { background: 'transparent', color: 'var(--fg-1)', border: '1px solid var(--line-strong)', padding: '7px 14px', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-ui)' }

async function applyDocTemplates(projectId: string, projectPath: string, appPort: number | undefined, appStartCmd: string) {
  const store = useAppStore.getState()
  const { docTemplates, aiProviders } = store
  store.setDocApplying(projectId, true)
  const enabled = docTemplates.filter(t => t.enabled)
  if (enabled.length === 0) { store.setDocApplying(projectId, false); return }

  for (const tpl of enabled) {
    const fullPath = `${projectPath}/${tpl.relativePath}`
    // Check if file exists
    const checkRes = await fetch(`/api/file-read?path=${encodeURIComponent(fullPath)}`)
    const checkData = await checkRes.json() as { ok: boolean }
    if (checkData.ok) continue  // file already exists — skip on creation

    // Inject port/cmd placeholders
    let content = tpl.content
    if (appPort) content = content.replaceAll('[port]', String(appPort))
    if (appStartCmd) content = content.replaceAll('[startCmd]', appStartCmd).replaceAll('[start command]', appStartCmd)

    await fetch('/api/file-write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: fullPath, content }),
    })
  }

  // Write project.config.json
  if (appPort || appStartCmd) {
    const config = { port: appPort ?? null, startCmd: appStartCmd || null, appUrl: appPort ? `http://localhost:${appPort}` : null }
    await fetch('/api/file-write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: `${projectPath}/project.config.json`, content: JSON.stringify(config, null, 2) }),
    })
  }

  // Find "Initial Docu Check" provider — not used on creation, only on right-click update
  const _provider = aiProviders.find(p => p.name === 'Initial Docu Check')
  void _provider
  useAppStore.getState().setDocApplying(projectId, false)
}

export function NewProjectModal() {
  const { setNewProjectOpen, addProject, setScreen, setActiveProject, setNewSessionOpen, aiProviders, aiFunctionMap } = useAppStore()
  const [name, setName]       = useState('')
  const [path, setPath]       = useState('')
  const [appPort, setAppPort] = useState('')
  const [startCmd, setStartCmd] = useState('')
  const [portStatus, setPortStatus] = useState<'idle' | 'checking' | 'free' | 'busy'>('idle')
  const [applying, setApplying] = useState(false)
  const [picking, setPicking]   = useState(false)
  const [detecting, setDetecting] = useState(false)

  // Check port availability when port changes
  useEffect(() => {
    const n = parseInt(appPort, 10)
    if (!n || n < 1 || n > 65535) { setPortStatus('idle'); return }
    setPortStatus('checking')
    const timer = setTimeout(async () => {
      try {
        const r = await fetch(`/api/check-port?port=${n}`)
        const d = await r.json() as { ok: boolean; inUse: boolean }
        setPortStatus(d.inUse ? 'busy' : 'free')
      } catch { setPortStatus('idle') }
    }, 400)
    return () => clearTimeout(timer)
  }, [appPort])

  const pickFolder = async () => {
    setPicking(true)
    try {
      const r = await fetch(`/api/pick-folder?path=${encodeURIComponent(path || '~')}`)
      const data = await r.json() as { ok: boolean; path: string | null }
      if (data.ok && data.path) {
        setPath(data.path)
        if (!name.trim()) setName(data.path.split('/').pop() ?? '')
        // Auto-detect start command from package.json
        tryDetectStartCmd(data.path)
      }
    } finally { setPicking(false) }
  }

  const tryDetectStartCmd = async (folderPath: string) => {
    try {
      const r = await fetch(`/api/file-read?path=${encodeURIComponent(folderPath + '/package.json')}`)
      const d = await r.json() as { ok: boolean; content?: string }
      if (d.ok && d.content) {
        const pkg = JSON.parse(d.content) as { scripts?: Record<string, string> }
        const devScript = pkg.scripts?.dev ?? pkg.scripts?.start ?? pkg.scripts?.serve
        if (devScript && !startCmd) setStartCmd('npm run ' + (Object.keys(pkg.scripts ?? {}).find(k => pkg.scripts?.[k] === devScript) ?? 'dev'))
      }
    } catch { /* no package.json — ignore */ }
  }

  const detectWithAI = async () => {
    if (!path.trim()) return
    const provId = aiFunctionMap['devDetect']
    const provider = aiProviders.find(p => p.id === provId) ?? aiProviders[0]
    if (!provider) return
    setDetecting(true)
    try {
      const port = parseInt(appPort, 10) || undefined
      const cmd = await aiDetectStartCmd(path.trim(), port, provider)
      if (cmd) setStartCmd(cmd)
    } finally { setDetecting(false) }
  }

  const create = async () => {
    if (!name.trim() || !path.trim()) return
    setApplying(true)
    try {
      const id = `p${Date.now()}`
      const port = parseInt(appPort, 10) || undefined
      addProject({ id, name: name.trim(), path: path.trim(), branch: '', sessions: [], appPort: port, appStartCmd: startCmd.trim() || undefined })
      setActiveProject(id)
      await applyDocTemplates(id, path.trim(), port, startCmd.trim())
      setNewProjectOpen(false)
      setScreen('workspace')
      setNewSessionOpen(true)
    } finally { setApplying(false) }
  }

  const canCreate = name.trim() && path.trim() && !applying

  const portBorderColor = portStatus === 'free' ? 'var(--ok)' : portStatus === 'busy' ? 'var(--warn)' : 'var(--line-strong)'

  return (
    <Backdrop onClick={() => setNewProjectOpen(false)}>
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: 560, maxWidth: '92vw', background: 'var(--bg-1)', border: '1px solid var(--line-strong)', borderRadius: 10, boxShadow: '0 24px 64px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        {/* Header */}
        <div style={{ height: 44, padding: '0 16px', display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--line)' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)' }}>Neues Projekt anlegen</div>
            <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginTop: 1 }}>Ordner wählen, Name und Dev-Server konfigurieren</div>
          </div>
          <IClose onClick={() => setNewProjectOpen(false)} style={{ color: 'var(--fg-2)', cursor: 'pointer' }} />
        </div>

        {/* Body */}
        <div style={{ padding: '20px 20px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Path picker */}
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

          {/* Dev Server section */}
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-2)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <ITerminal style={{ color: 'var(--accent)' }} />
              Dev Server (optional)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {/* Port */}
              <div>
                <label style={fieldLabel}>Port</label>
                <div style={{ position: 'relative' }}>
                  <input
                    style={{ ...fieldInput, border: `1px solid ${portBorderColor}`, transition: 'border-color 0.2s', paddingRight: portStatus !== 'idle' ? 68 : undefined }}
                    value={appPort}
                    onChange={e => setAppPort(e.target.value.replace(/\D/g, ''))}
                    placeholder="z.B. 3000"
                    maxLength={5}
                  />
                  {portStatus === 'checking' && (
                    <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: 'var(--fg-3)' }}>prüfe…</span>
                  )}
                  {portStatus === 'free' && (
                    <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: 'var(--ok)', fontWeight: 600 }}>frei ✓</span>
                  )}
                  {portStatus === 'busy' && (
                    <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: 'var(--warn)', fontWeight: 600 }}>belegt</span>
                  )}
                </div>
              </div>
              {/* Start Command */}
              <div>
                <label style={fieldLabel}>Start-Befehl</label>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    style={{ ...fieldInput, flex: 1 }}
                    value={startCmd}
                    onChange={e => setStartCmd(e.target.value)}
                    placeholder="z.B. npm run dev"
                    disabled={detecting}
                  />
                  <button
                    type="button"
                    onClick={detectWithAI}
                    disabled={detecting || !path.trim() || aiProviders.length === 0}
                    title={aiProviders.length === 0 ? 'Kein AI-Anbieter konfiguriert' : 'Start-Befehl per AI ermitteln'}
                    style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, border: '1px solid var(--line-strong)', borderRadius: 6, background: 'var(--bg-2)', color: detecting ? 'var(--accent)' : aiProviders.length === 0 ? 'var(--fg-3)' : 'var(--accent)', cursor: (detecting || !path.trim() || aiProviders.length === 0) ? 'not-allowed' : 'pointer', opacity: (!path.trim() || aiProviders.length === 0) ? 0.4 : 1, transition: 'all 0.15s' }}
                  >
                    <ISpark className={detecting ? 'anim-pulse' : ''} style={{ width: 13, height: 13 }} />
                  </button>
                </div>
              </div>
            </div>
            {appPort && startCmd && (
              <div style={{ marginTop: 8, fontSize: 10.5, color: 'var(--fg-3)' }}>
                App-URL: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>http://localhost:{appPort}</span>
              </div>
            )}
          </div>

          {applying && (
            <div style={{ fontSize: 11, color: 'var(--fg-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', animation: 'pulse 1s infinite' }} />
              Docu-Templates werden angelegt…
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, padding: '12px 20px', borderTop: '1px solid var(--line)' }}>
          <button style={btnGhost} onClick={() => setNewProjectOpen(false)}>Abbrechen</button>
          <button
            style={{ ...btnPrimary, opacity: canCreate ? 1 : 0.45 }}
            disabled={!canCreate}
            onClick={create}
          >
            {applying ? 'Wird angelegt…' : 'Projekt anlegen'}
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
