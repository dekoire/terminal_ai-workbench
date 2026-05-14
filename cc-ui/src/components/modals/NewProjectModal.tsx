import React, { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '../../store/useAppStore'
import type { DocTemplate } from '../../store/useAppStore'
import { IClose, IFolderOpen, IDrive, ISpark } from '../primitives/Icons'
import { aiDetectStartCmd } from '../../utils/aiDetect'

// ── Styles ────────────────────────────────────────────────────────────────────
const fl: React.CSSProperties = { display: 'block', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.7, color: 'var(--fg-3)', fontWeight: 500, marginBottom: 6 }
const fi: React.CSSProperties = { width: '100%', padding: '7px 10px', border: '1px solid var(--line-strong)', borderRadius: 6, background: 'var(--bg-2)', color: 'var(--fg-0)', fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none', boxSizing: 'border-box' as const }
const btnPrimary: React.CSSProperties = { background: 'var(--accent)', color: 'var(--accent-fg)', border: 'none', padding: '7px 16px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)' }
const btnGhost: React.CSSProperties = { background: 'transparent', color: 'var(--fg-1)', border: '1px solid var(--line-strong)', padding: '7px 14px', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-ui)' }

// ── Doc template apply (same as before) ──────────────────────────────────────
async function applyDocTemplates(projectId: string, projectPath: string, appPort: number | undefined, appStartCmd: string) {
  const store = useAppStore.getState()
  const { docTemplates } = store
  store.setDocApplying(projectId, true)
  const enabled = docTemplates.filter(t => t.enabled)
  if (enabled.length === 0) { store.setDocApplying(projectId, false); return }
  for (const tpl of enabled) {
    const fullPath = `${projectPath}/${tpl.relativePath}`
    const checkRes = await fetch(`/api/file-read?path=${encodeURIComponent(fullPath)}`)
    const checkData = await checkRes.json() as { ok: boolean }
    if (checkData.ok) continue
    let content = tpl.content
    if (appPort) content = content.replaceAll('[port]', String(appPort))
    if (appStartCmd) content = content.replaceAll('[startCmd]', appStartCmd).replaceAll('[start command]', appStartCmd)
    await fetch('/api/file-write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: fullPath, content }),
    })
  }
  if (appPort || appStartCmd) {
    const config = { port: appPort ?? null, startCmd: appStartCmd || null, appUrl: appPort ? `http://localhost:${appPort}` : null }
    await fetch('/api/file-write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: `${projectPath}/project.config.json`, content: JSON.stringify(config, null, 2) }),
    })
  }
  useAppStore.getState().setDocApplying(projectId, false)
}

// ── Step indicator ────────────────────────────────────────────────────────────
function StepDots({ step, total }: { step: number; total: number }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{
          width: i + 1 === step ? 18 : 6, height: 6, borderRadius: 99,
          background: i + 1 === step ? 'var(--accent)' : i + 1 < step ? 'var(--accent)' : 'var(--bg-3)',
          opacity: i + 1 < step ? 0.4 : 1,
          transition: 'all 0.2s',
        }} />
      ))}
    </div>
  )
}

// ── Toggle switch ─────────────────────────────────────────────────────────────
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      style={{ width: 34, height: 18, borderRadius: 9, border: 'none', cursor: 'pointer', background: on ? 'var(--accent)' : 'var(--bg-3)', position: 'relative', flexShrink: 0, transition: 'background 0.2s', boxShadow: on ? '0 0 0 1px var(--accent)' : '0 0 0 1px var(--line)' }}
    >
      <div style={{ position: 'absolute', top: 2, left: on ? 16 : 2, width: 14, height: 14, borderRadius: '50%', background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
    </button>
  )
}

// ── Main modal ────────────────────────────────────────────────────────────────
export function NewProjectModal() {
  const {
    setNewProjectOpen, addProject, setScreen, setActiveProject, setNewSessionOpen,
    openrouterKey, docTemplates, updateDocTemplate, lastProjectPath, setLastProjectPath,
    tokens, addToken,
  } = useAppStore()

  const [step, setStep] = useState<1 | 2 | 3>(1)

  // Step 1
  const [path, setPath]         = useState(lastProjectPath || '')
  const [name, setName]         = useState('')
  const [startCmd, setStartCmd] = useState('')
  const [hasCode, setHasCode]   = useState(false)
  const [picking, setPicking]   = useState(false)
  const [detecting, setDetecting] = useState(false)

  // Step 2
  const [editingDoc, setEditingDoc] = useState<DocTemplate | null>(null)
  const [editContent, setEditContent] = useState('')
  const [runGraphify, setRunGraphify] = useState(false)
  const [graphifyStatus, setGraphifyStatus] = useState<'unknown' | 'installed' | 'missing'>('unknown')
  const [refreshDocs, setRefreshDocs] = useState(true)
  // selectedAiId removed — doc refresh now uses OpenRouter directly

  // Step 3
  const [repoUrl, setRepoUrl]       = useState('')
  const [hasGit, setHasGit]         = useState(false)
  const [selectedTokenId, setSelectedTokenId] = useState('')
  const [newTokenLabel, setNewTokenLabel] = useState('')
  const [newTokenValue, setNewTokenValue] = useState('')
  const [addingToken, setAddingToken] = useState(false)

  const [applying, setApplying] = useState(false)

  // ── Derive platform info from repo URL ──────────────────────────────────────
  const repoHost = (() => {
    try { return new URL(repoUrl).hostname } catch { return '' }
  })()

  const platformInfo = (() => {
    if (repoHost.includes('github.com'))    return { name: 'GitHub',    tokenUrl: 'https://github.com/settings/tokens/new?scopes=repo,workflow&description=Codera+AI',    tokenPath: 'Settings → Developer settings → Personal access tokens → Fine-grained tokens' }
    if (repoHost.includes('gitlab.com'))    return { name: 'GitLab',    tokenUrl: 'https://gitlab.com/-/profile/personal_access_tokens',                                   tokenPath: 'Profile → Access Tokens' }
    if (repoHost.includes('bitbucket.org')) return { name: 'Bitbucket', tokenUrl: 'https://bitbucket.org/account/settings/app-passwords/new',                              tokenPath: 'Personal settings → App passwords' }
    return null
  })()

  const matchingTokens = tokens.filter(t => repoHost && t.host === repoHost)

  // ── Auto-find a free port starting from 3000 ─────────────────────────────────
  const findFreePort = async (): Promise<number | undefined> => {
    for (let p = 3000; p <= 3099; p++) {
      try {
        const r = await fetch(`/api/check-port?port=${p}`)
        const d = await r.json() as { inUse: boolean }
        if (!d.inUse) return p
      } catch { /* skip */ }
    }
    return undefined
  }

  // ── Check graphify on mount ──────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/which?cmd=graphify')
      .then(r => r.json())
      .then((d: { ok: boolean }) => setGraphifyStatus(d.ok ? 'installed' : 'missing'))
      .catch(() => setGraphifyStatus('missing'))
  }, [])

  // ── Detect code & git when path changes ──────────────────────────────────────
  const checkPath = useCallback(async (p: string) => {
    if (!p.trim()) { setHasCode(false); setHasGit(false); return }
    // Check for package.json / go.mod / Cargo.toml / pyproject.toml / pom.xml
    const codeFiles = ['package.json', 'go.mod', 'Cargo.toml', 'pyproject.toml', 'pom.xml', 'requirements.txt']
    let foundCode = false
    for (const f of codeFiles) {
      try {
        const r = await fetch(`/api/file-read?path=${encodeURIComponent(p + '/' + f)}`)
        const d = await r.json() as { ok: boolean; content?: string }
        if (d.ok) {
          foundCode = true
          // Auto-detect start cmd from package.json
          if (f === 'package.json' && d.content && !startCmd) {
            try {
              const pkg = JSON.parse(d.content) as { scripts?: Record<string, string> }
              const key = Object.keys(pkg.scripts ?? {}).find(k => ['dev', 'start', 'serve'].includes(k))
              if (key) setStartCmd(`npm run ${key}`)
            } catch { /* ignore */ }
          }
          break
        }
      } catch { /* ignore */ }
    }
    setHasCode(foundCode)
    // Check for .git
    try {
      const r = await fetch(`/api/file-read?path=${encodeURIComponent(p + '/.git/HEAD')}`)
      const d = await r.json() as { ok: boolean }
      setHasGit(d.ok)
    } catch { setHasGit(false) }
  }, [startCmd])

  useEffect(() => { void checkPath(path) }, [path]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Folder picker ───────────────────────────────────────────────────────────
  const pickFolder = async () => {
    setPicking(true)
    try {
      const r = await fetch(`/api/pick-folder?path=${encodeURIComponent(path || lastProjectPath || '~')}`)
      const d = await r.json() as { ok: boolean; path: string | null }
      if (d.ok && d.path) {
        setPath(d.path)
        if (!name.trim()) setName(d.path.split('/').pop() ?? '')
      }
    } finally { setPicking(false) }
  }

  // ── AI detect start cmd ─────────────────────────────────────────────────────
  // provider now resolved inside aiDetectStartCmd via getOrModel
  const detectWithAI = async () => {
    if (!path.trim()) return
    setDetecting(true)
    try {
      const cmd = await aiDetectStartCmd(path.trim(), undefined)
      if (cmd) setStartCmd(cmd)
    } finally { setDetecting(false) }
  }

  // ── Create project ──────────────────────────────────────────────────────────
  const create = async () => {
    if (!name.trim() || !path.trim()) return
    setApplying(true)
    try {
      const { newProjectId } = await import('../../lib/ids')
      const id = newProjectId()
      const port = await findFreePort()
      addProject({ id, name: name.trim(), path: path.trim(), branch: '', sessions: [], appPort: port, appStartCmd: startCmd.trim() || undefined })
      setLastProjectPath(path.trim())
      setActiveProject(id)
      await applyDocTemplates(id, path.trim(), port, startCmd.trim())
      setNewProjectOpen(false)
      setScreen('workspace')
    } finally { setApplying(false) }
  }

  const step1Valid = !!(name.trim() && path.trim())

  const docOnly = docTemplates.filter(t => (t.category ?? 'doc') === 'doc')

  return (
    <Backdrop onClick={() => setNewProjectOpen(false)}>
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: '70vw', height: '70vh', maxWidth: 900, background: 'var(--bg-1)', border: '1px solid var(--line-strong)', borderRadius: 6, boxShadow: '0 28px 72px rgba(0,0,0,0.55)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        {/* Header */}
        <div style={{ padding: '16px 20px 14px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)', marginBottom: 4 }}>
                {step === 1 && 'Workspace einrichten'}
                {step === 2 && 'Dokumentation & Tools'}
                {step === 3 && 'Git-Konfiguration'}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>
                {step === 1 && 'Pfad, Name und App-Start festlegen'}
                {step === 2 && 'Welche Dateien sollen angelegt werden?'}
                {step === 3 && 'Repository verbinden — optional'}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <StepDots step={step} total={3} />
              <IClose onClick={() => setNewProjectOpen(false)} style={{ color: 'var(--fg-2)', cursor: 'pointer' }} />
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

          {/* ── Step 1 ────────────────────────────────────────────────────── */}
          {step === 1 && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Name */}
              <div>
                <label style={fl}>Workspace-Name</label>
                <input autoFocus style={fi} value={name} onChange={e => setName(e.target.value)} placeholder="z.B. payments-api" />
              </div>

              {/* Path */}
              <div>
                <label style={fl}>Workspace-Ordner</label>
                <div style={{ display: 'flex', alignItems: 'stretch', border: '1px solid var(--line-strong)', borderRadius: 6, background: 'var(--bg-2)', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', padding: '0 10px', color: 'var(--fg-3)', borderRight: '1px solid var(--line)' }}>
                    <IFolderOpen />
                  </div>
                  <input
                    style={{ ...fi, border: 'none', borderRadius: 0, background: 'transparent', flex: 1 }}
                    value={path}
                    placeholder="/Users/…/mein-projekt"
                    onChange={e => {
                      setPath(e.target.value)
                      if (!name.trim()) setName(e.target.value.split('/').pop() ?? '')
                    }}
                  />
                  <button
                    onClick={pickFolder}
                    disabled={picking}
                    style={{ border: 'none', borderLeft: '1px solid var(--line)', background: 'var(--bg-3)', color: 'var(--fg-1)', padding: '0 14px', fontSize: 11.5, cursor: picking ? 'wait' : 'pointer', fontFamily: 'var(--font-ui)', display: 'flex', alignItems: 'center', gap: 6, opacity: picking ? 0.6 : 1, whiteSpace: 'nowrap' }}
                  >
                    <IFolderOpen style={{ color: 'var(--accent)' }} />
                    {picking ? 'Wähle…' : 'Auswählen'}
                  </button>
                </div>
                {path && <FolderPreview path={path} />}
              </div>

              {/* App config — start command only when code detected */}
              {hasCode && (
                <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-2)', marginBottom: 10 }}>App-Konfiguration</div>
                  <div>
                    <label style={fl}>
                      Start-Befehl
                      <span style={{ marginLeft: 6, color: 'var(--accent)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                        (Code erkannt)
                      </span>
                    </label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        style={{ ...fi, flex: 1 }}
                        value={startCmd}
                        onChange={e => setStartCmd(e.target.value)}
                        placeholder="z.B. npm run dev"
                        disabled={detecting}
                      />
                      <button
                        onClick={detectWithAI}
                        disabled={detecting || !path.trim() || !openrouterKey}
                        title={!openrouterKey ? 'OpenRouter API-Key fehlt' : 'Per AI ermitteln'}
                        style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, border: '1px solid var(--line-strong)', borderRadius: 6, background: 'var(--bg-2)', color: 'var(--accent)', cursor: (detecting || !path.trim() || !openrouterKey) ? 'not-allowed' : 'pointer', opacity: (!path.trim() || !openrouterKey) ? 0.4 : 1 }}
                      >
                        <ISpark className={detecting ? 'anim-pulse' : ''} style={{ width: 14, height: 14 }} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            </div>
          )}

          {/* ── Step 2 ────────────────────────────────────────────────────── */}
          {step === 2 && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {/* Doc templates */}
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--fg-3)', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 }}>Dokumente anlegen</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 12 }}>
                {docOnly.map(tpl => (
                  <div key={tpl.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', borderRadius: 6, background: 'var(--bg-2)', border: '1px solid var(--line)' }}>
                    <Toggle on={tpl.enabled} onChange={v => updateDocTemplate(tpl.id, { enabled: v })} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 11.5, color: 'var(--fg-0)', fontWeight: 500 }}>{tpl.name}</span>
                      <span style={{ marginLeft: 8, fontSize: 9.5, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>{tpl.relativePath}</span>
                    </div>
                    <button
                      onClick={() => { setEditingDoc(tpl); setEditContent(tpl.content) }}
                      style={{ fontSize: 10, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', borderRadius: 6, fontFamily: 'var(--font-ui)', flexShrink: 0 }}
                    >
                      Bearbeiten
                    </button>
                  </div>
                ))}
                {docOnly.length === 0 && (
                  <div style={{ fontSize: 11, color: 'var(--fg-3)', padding: '8px 0' }}>Keine Dokument-Vorlagen konfiguriert.</div>
                )}
              </div>

              {/* Docs refresh */}
              <div style={{ borderTop: '1px solid var(--line)', paddingTop: 10, marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Toggle on={refreshDocs} onChange={setRefreshDocs} />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 11.5, color: 'var(--fg-0)', fontWeight: 500 }}>Dokumentation einmalig aktualisieren</span>
                    <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--fg-3)' }}>AI ergänzt vorhandene Docs</span>
                  </div>
                  {refreshDocs && !openrouterKey && (
                    <span style={{ fontSize: 10, color: 'var(--fg-3)' }}>
                      <span style={{ color: 'var(--accent)', cursor: 'pointer' }} onClick={() => { setNewProjectOpen(false); setScreen('settings') }}>OpenRouter-Key konfigurieren →</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Graphify */}
              <div style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Toggle
                    on={runGraphify && graphifyStatus === 'installed'}
                    onChange={v => { if (graphifyStatus === 'installed') setRunGraphify(v) }}
                  />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 11.5, color: graphifyStatus === 'missing' ? 'var(--fg-3)' : 'var(--fg-0)', fontWeight: 500 }}>Graphify ausführen</span>
                    <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--fg-3)' }}>Erstellt einen Abhängigkeitsgraphen</span>
                  </div>
                  {graphifyStatus === 'installed' && (
                    <span style={{ fontSize: 10, color: 'var(--ok)' }}>✓ installiert</span>
                  )}
                  {graphifyStatus === 'missing' && (
                    <span style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>pip install graphifyy</span>
                  )}
                </div>
              </div>
            </div>
            </div>
          )}

          {/* ── Step 3 ────────────────────────────────────────────────────── */}
          {step === 3 && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {hasGit ? (
                <div style={{ padding: '10px 14px', borderRadius: 6, background: 'rgba(124,217,168,0.08)', border: '1px solid rgba(124,217,168,0.25)', fontSize: 12, color: 'var(--ok)' }}>
                  ✓ Git-Repository bereits im Ordner vorhanden.
                </div>
              ) : (
                <>
                  {/* Repo URL */}
                  <div>
                    <label style={fl}>Repository-URL <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--fg-3)' }}>(optional)</span></label>
                    <input
                      autoFocus
                      style={fi}
                      value={repoUrl}
                      onChange={e => setRepoUrl(e.target.value)}
                      placeholder="https://github.com/dein-user/dein-repo.git"
                    />
                    {platformInfo && (
                      <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 10, color: 'var(--fg-3)' }}>{platformInfo.name} erkannt —</span>
                        <a href={platformInfo.tokenUrl} target="_blank" rel="noreferrer"
                          style={{ fontSize: 10, color: 'var(--accent)', textDecoration: 'none' }}>
                          Token erstellen →
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Token section — only show if URL entered */}
                  {repoUrl.trim() && (
                    <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--fg-3)', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 }}>Zugriffstoken</div>

                      {/* Existing matching tokens */}
                      {matchingTokens.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                          {matchingTokens.map(t => (
                            <div
                              key={t.id}
                              onClick={() => setSelectedTokenId(selectedTokenId === t.id ? '' : t.id)}
                              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6, background: selectedTokenId === t.id ? 'var(--accent-soft)' : 'var(--bg-2)', border: `1px solid ${selectedTokenId === t.id ? 'var(--accent-line)' : 'var(--line)'}`, cursor: 'pointer', transition: 'all 0.15s' }}
                            >
                              <div style={{ width: 7, height: 7, borderRadius: '50%', background: selectedTokenId === t.id ? 'var(--accent)' : 'var(--bg-3)', border: '1px solid var(--line-strong)', flexShrink: 0 }} />
                              <span style={{ fontSize: 11.5, color: 'var(--fg-0)', fontWeight: 500 }}>{t.label}</span>
                              <span style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>{t.token.slice(0, 8)}…</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add new token */}
                      {!addingToken ? (
                        <button
                          onClick={() => setAddingToken(true)}
                          style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: '1px dashed var(--accent-line)', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', width: '100%', fontFamily: 'var(--font-ui)' }}
                        >
                          + Token hinterlegen
                        </button>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 12px', background: 'var(--bg-2)', borderRadius: 6, border: '1px solid var(--line-strong)' }}>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <div style={{ flex: 1 }}>
                              <label style={fl}>Bezeichnung</label>
                              <input style={fi} value={newTokenLabel} onChange={e => setNewTokenLabel(e.target.value)} placeholder={platformInfo ? `${platformInfo.name} Token` : 'Mein Git-Token'} />
                            </div>
                            <div style={{ flex: 2 }}>
                              <label style={fl}>Token</label>
                              <input
                                style={{ ...fi, fontFamily: 'var(--font-mono)', letterSpacing: 0.5 }}
                                type="password"
                                value={newTokenValue}
                                onChange={e => setNewTokenValue(e.target.value)}
                                placeholder="ghp_… / glpat-… / …"
                              />
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              onClick={() => {
                                if (!newTokenLabel.trim() || !newTokenValue.trim()) return
                                const id = `tok${Date.now()}`
                                addToken({ id, label: newTokenLabel.trim(), host: repoHost || 'github.com', token: newTokenValue.trim() })
                                setSelectedTokenId(id)
                                setAddingToken(false)
                                setNewTokenLabel('')
                                setNewTokenValue('')
                              }}
                              disabled={!newTokenLabel.trim() || !newTokenValue.trim()}
                              style={{ ...btnPrimary, fontSize: 11, padding: '5px 12px', opacity: (!newTokenLabel.trim() || !newTokenValue.trim()) ? 0.45 : 1 }}
                            >Speichern</button>
                            <button onClick={() => setAddingToken(false)} style={{ ...btnGhost, fontSize: 11, padding: '5px 10px' }}>Abbrechen</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
            </div>
          )}
        </div>

        {/* Doc editor sub-panel */}
        {editingDoc && (
          <div style={{ borderTop: '1px solid var(--line)', background: 'var(--bg-0)', padding: '14px 24px', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-1)', flex: 1 }}>{editingDoc.name} bearbeiten</span>
              <button
                onClick={() => { updateDocTemplate(editingDoc.id, { content: editContent }); setEditingDoc(null) }}
                style={{ ...btnPrimary, padding: '4px 12px', fontSize: 11, marginRight: 6 }}
              >Speichern</button>
              <button onClick={() => setEditingDoc(null)} style={{ ...btnGhost, padding: '4px 10px', fontSize: 11 }}>Abbrechen</button>
            </div>
            <textarea
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              style={{ width: '100%', height: 140, padding: '8px 10px', background: 'var(--bg-2)', border: '1px solid var(--line-strong)', borderRadius: 6, color: 'var(--fg-0)', fontSize: 11, fontFamily: 'var(--font-mono)', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
            />
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 24px', gap: 8, flexShrink: 0, borderTop: '1px solid var(--line)' }}>
          {step > 1 && (
            <button style={btnGhost} onClick={() => setStep((step - 1) as 1 | 2 | 3)}>← Zurück</button>
          )}
          <button style={btnGhost} onClick={() => setNewProjectOpen(false)}>Abbrechen</button>
          <div style={{ flex: 1 }} />

          {step === 1 && (
            <button
              style={{ ...btnPrimary, opacity: step1Valid ? 1 : 0.45 }}
              disabled={!step1Valid}
              onClick={() => setStep(2)}
            >
              Weiter →
            </button>
          )}

          {step === 2 && (
            <button style={btnPrimary} onClick={() => setStep(3)}>
              Weiter →
            </button>
          )}

          {step === 3 && (
            <>
              <button style={btnGhost} onClick={create} disabled={applying}>
                {applying ? 'Wird angelegt…' : 'Überspringen & anlegen'}
              </button>
              <button
                style={{ ...btnPrimary, opacity: applying ? 0.6 : 1 }}
                disabled={applying}
                onClick={create}
              >
                {applying ? 'Wird angelegt…' : 'Workspace anlegen'}
              </button>
            </>
          )}
        </div>
      </div>
    </Backdrop>
  )
}

function FolderPreview({ path }: { path: string }) {
  const parts = path.replace(/^\/Users\/[^/]+/, '~').split('/')
  return (
    <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 5, padding: '5px 8px', borderRadius: 6, background: 'var(--bg-2)', border: '1px solid var(--line)' }}>
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
