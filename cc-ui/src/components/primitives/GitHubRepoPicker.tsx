import React, { useState, useEffect, useRef } from 'react'
import { useAppStore } from '../../store/useAppStore'
import type { RepoToken } from '../../store/useAppStore'
import { ISearch, IClose, IChevDown, IPlus, ILock, ICheck } from './Icons'

interface GhRepo {
  fullName:    string
  cloneUrl:    string
  private:     boolean
  description: string
  org:         string | null
}

interface Props {
  tokens:              RepoToken[]
  preselectedTokenId?: string
  onSelect:            (cloneUrlWithToken: string, tokenId: string) => void
  onCancel:            () => void
}

type Screen = 'repo-list' | 'create-repo'

function injectToken(url: string, tok: string): string {
  return url.replace('https://github.com/', `https://${tok}@github.com/`)
}

export function GitHubRepoPicker({ tokens, preselectedTokenId, onSelect, onCancel }: Props) {
  const { addToken } = useAppStore()
  const ghTokens = tokens.filter(t => t.host === 'github.com')

  const defaultToken = ghTokens.find(t => t.id === preselectedTokenId) ?? ghTokens[0]
  const [selectedToken, setSelectedToken] = useState<RepoToken | undefined>(defaultToken)
  const [repos,         setRepos]         = useState<GhRepo[]>([])
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState<string | null>(null)
  const [search,        setSearch]        = useState('')
  const [screen,        setScreen]        = useState<Screen>('repo-list')
  const [tokenDropdown, setTokenDropdown] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  // Inline token-add state
  const [addingToken,    setAddingToken]    = useState(false)
  const [newTokLabel,    setNewTokLabel]    = useState('')
  const [newTokValue,    setNewTokValue]    = useState('')

  // Create-repo state
  const [newName,    setNewName]    = useState('')
  const [newPrivate, setNewPrivate] = useState(true)
  const [newOrg,     setNewOrg]    = useState<string>('')
  const [creating,   setCreating]  = useState(false)
  const [createErr,  setCreateErr] = useState<string | null>(null)

  const orgs = Array.from(new Set(repos.filter(r => r.org).map(r => r.org as string)))

  useEffect(() => {
    if (!selectedToken) return
    setLoading(true)
    setError(null)
    setRepos([])
    fetch(`/api/github/repos?token=${encodeURIComponent(selectedToken.token)}`)
      .then(r => r.json())
      .then((d: { ok: boolean; repos: GhRepo[]; error?: string }) => {
        if (d.ok) setRepos(d.repos)
        else setError(d.error ?? 'Repos konnten nicht geladen werden.')
      })
      .catch(() => setError('Netzwerkfehler beim Laden der Repos.'))
      .finally(() => setLoading(false))
  }, [selectedToken])

  useEffect(() => {
    if (screen === 'repo-list') setTimeout(() => searchRef.current?.focus(), 50)
  }, [screen])

  const filtered = repos.filter(r =>
    r.fullName.toLowerCase().includes(search.toLowerCase()) ||
    r.description.toLowerCase().includes(search.toLowerCase())
  )

  const handleSelect = (repo: GhRepo) => {
    if (!selectedToken) return
    onSelect(injectToken(repo.cloneUrl, selectedToken.token), selectedToken.id)
  }

  const handleCreate = async () => {
    if (!selectedToken || !newName.trim()) return
    setCreating(true)
    setCreateErr(null)
    try {
      const r = await fetch('/api/github/create-repo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: selectedToken.token, name: newName.trim(), private: newPrivate, org: newOrg || undefined }),
      })
      const d = await r.json() as { ok: boolean; cloneUrl?: string; error?: string }
      if (d.ok && d.cloneUrl) {
        onSelect(injectToken(d.cloneUrl, selectedToken.token), selectedToken.id)
      } else {
        setCreateErr(d.error ?? 'Repo konnte nicht erstellt werden.')
      }
    } finally {
      setCreating(false)
    }
  }

  // Styles
  const overlay: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }
  const box: React.CSSProperties     = { background: 'var(--bg-1)', border: '1px solid var(--line-strong)', borderRadius: 12, width: 640, maxWidth: '92vw', maxHeight: '62vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.55)', overflow: 'hidden' }
  const inp: React.CSSProperties     = { width: '100%', padding: '8px 10px', border: '1px solid var(--line-strong)', borderRadius: 6, background: 'var(--bg-2)', color: 'var(--fg-0)', fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none', boxSizing: 'border-box' }
  const btnPri: React.CSSProperties  = { background: 'var(--accent)', color: 'var(--accent-fg)', border: 'none', padding: '8px 18px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)' }
  const btnSec: React.CSSProperties  = { background: 'transparent', color: 'var(--fg-2)', border: '1px solid var(--line-strong)', padding: '8px 14px', borderRadius: 7, fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-ui)' }

  if (!ghTokens.length) {
    return (
      <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
        <div style={{ ...box, padding: 28, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-0)', textAlign: 'center' }}>Kein GitHub-Token hinterlegt</div>
          <div style={{ fontSize: 12, color: 'var(--fg-3)', textAlign: 'center', lineHeight: 1.6 }}>Bitte zuerst einen GitHub-Token unter Einstellungen → API Credentials hinzufügen.</div>
          <button onClick={onCancel} style={btnSec}>Schließen</button>
        </div>
      </div>
    )
  }

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div style={box}>

        {/* ── Header ── */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)', marginBottom: 6 }}>
              {screen === 'create-repo' ? 'Neues Repo erstellen' : 'GitHub-Repo wählen'}
            </div>
            {/* Token selector — always visible */}
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <button
                onClick={() => setTokenDropdown(v => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-2)', border: '1px solid var(--line-strong)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 11.5, color: 'var(--fg-1)', fontFamily: 'var(--font-ui)' }}
              >
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, display: 'inline-block' }} />
                {selectedToken?.label ?? 'Token wählen'}
                <IChevDown style={{ width: 11, height: 11, color: 'var(--fg-3)' }} />
              </button>
              {tokenDropdown && (
                <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: 'var(--bg-2)', border: '1px solid var(--line-strong)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.3)', zIndex: 100, minWidth: 220, overflow: 'hidden' }}>
                  {ghTokens.map(t => (
                    <div
                      key={t.id}
                      onClick={() => { setSelectedToken(t); setTokenDropdown(false); setAddingToken(false) }}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', cursor: 'pointer', fontSize: 12, color: 'var(--fg-1)', background: t.id === selectedToken?.id ? 'var(--accent-soft)' : 'transparent' }}
                      onMouseEnter={e => { if (t.id !== selectedToken?.id) (e.currentTarget as HTMLElement).style.background = 'var(--bg-3)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = t.id === selectedToken?.id ? 'var(--accent-soft)' : 'transparent' }}
                    >
                      {t.id === selectedToken?.id && <ICheck style={{ width: 11, height: 11, color: 'var(--accent)', flexShrink: 0 }} />}
                      <span style={{ flex: 1 }}>{t.label}</span>
                    </div>
                  ))}
                  {/* Add new token inline */}
                  <div style={{ borderTop: '1px solid var(--line)', padding: '6px 8px' }}>
                    {!addingToken ? (
                      <button
                        onClick={() => setAddingToken(true)}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', background: 'none', border: 'none', color: 'var(--accent)', fontSize: 11.5, cursor: 'pointer', padding: '4px 4px', fontFamily: 'var(--font-ui)' }}
                      >
                        <IPlus style={{ width: 11, height: 11 }} /> Token hinzufügen
                      </button>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <input
                          autoFocus
                          value={newTokLabel}
                          onChange={e => setNewTokLabel(e.target.value)}
                          placeholder="Bezeichnung (z.B. Firma)"
                          style={{ width: '100%', padding: '5px 8px', background: 'var(--bg-1)', border: '1px solid var(--line-strong)', borderRadius: 5, color: 'var(--fg-0)', fontSize: 11, fontFamily: 'var(--font-ui)', outline: 'none', boxSizing: 'border-box' }}
                        />
                        <input
                          value={newTokValue}
                          onChange={e => setNewTokValue(e.target.value)}
                          placeholder="ghp_..."
                          type="password"
                          style={{ width: '100%', padding: '5px 8px', background: 'var(--bg-1)', border: '1px solid var(--line-strong)', borderRadius: 5, color: 'var(--fg-0)', fontSize: 11, fontFamily: 'var(--font-mono)', outline: 'none', boxSizing: 'border-box' }}
                          onKeyDown={e => {
                            if (e.key !== 'Enter' || !newTokLabel.trim() || !newTokValue.trim()) return
                            const id = `tok${Date.now()}`
                            const newTok: RepoToken = { id, label: newTokLabel.trim(), host: 'github.com', token: newTokValue.trim() }
                            addToken(newTok)
                            setSelectedToken(newTok)
                            setNewTokLabel(''); setNewTokValue(''); setAddingToken(false); setTokenDropdown(false)
                          }}
                        />
                        <div style={{ display: 'flex', gap: 5 }}>
                          <button
                            disabled={!newTokLabel.trim() || !newTokValue.trim()}
                            onClick={() => {
                              const id = `tok${Date.now()}`
                              const newTok: RepoToken = { id, label: newTokLabel.trim(), host: 'github.com', token: newTokValue.trim() }
                              addToken(newTok)
                              setSelectedToken(newTok)
                              setNewTokLabel(''); setNewTokValue(''); setAddingToken(false); setTokenDropdown(false)
                            }}
                            style={{ flex: 1, padding: '4px 8px', background: 'var(--accent)', color: 'var(--accent-fg)', border: 'none', borderRadius: 5, fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-ui)', opacity: (!newTokLabel.trim() || !newTokValue.trim()) ? 0.5 : 1 }}
                          >Speichern</button>
                          <button onClick={() => setAddingToken(false)} style={{ padding: '4px 8px', background: 'transparent', color: 'var(--fg-3)', border: '1px solid var(--line)', borderRadius: 5, fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-ui)' }}>✕</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-3)', padding: 4, display: 'flex' }}>
            <IClose style={{ width: 14, height: 14 }} />
          </button>
        </div>

        {/* ── Repo List ── */}
        {screen === 'repo-list' && (
          <>
            {/* Search */}
            <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
              <div style={{ position: 'relative' }}>
                <ISearch style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: 'var(--fg-3)', pointerEvents: 'none' }} />
                <input
                  ref={searchRef}
                  style={{ ...inp, paddingLeft: 30 }}
                  placeholder="Repo suchen…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {loading && (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--fg-3)', fontSize: 12 }}>Lade Repos…</div>
              )}
              {error && (
                <div style={{ padding: 20, color: 'var(--err)', fontSize: 12, textAlign: 'center', lineHeight: 1.6 }}>{error}</div>
              )}
              {!loading && !error && filtered.map(repo => (
                <div
                  key={repo.fullName}
                  onClick={() => handleSelect(repo)}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid var(--line)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-2)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--fg-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{repo.fullName}</span>
                      {repo.private && <ILock style={{ width: 11, height: 11, color: 'var(--fg-3)', flexShrink: 0 }} />}
                      {repo.org && <span style={{ fontSize: 10, background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 4, padding: '1px 5px', color: 'var(--fg-3)', flexShrink: 0 }}>{repo.org}</span>}
                    </div>
                    {repo.description && (
                      <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{repo.description}</div>
                    )}
                  </div>
                </div>
              ))}
              {!loading && !error && filtered.length === 0 && repos.length > 0 && (
                <div style={{ padding: 28, textAlign: 'center', color: 'var(--fg-3)', fontSize: 12 }}>Keine Repos gefunden.</div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--line)', flexShrink: 0 }}>
              <button
                onClick={() => { setScreen('create-repo'); setNewOrg(orgs[0] ?? '') }}
                style={{ display: 'flex', alignItems: 'center', gap: 6, ...btnSec, width: '100%', justifyContent: 'center' }}
              >
                <IPlus style={{ width: 13, height: 13 }} />
                Neues Repo erstellen
              </button>
            </div>
          </>
        )}

        {/* ── Create Repo ── */}
        {screen === 'create-repo' && (
          <div style={{ padding: '20px 20px', display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
            <div>
              <label style={{ display: 'block', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--fg-3)', fontWeight: 500, marginBottom: 6 }}>Repo-Name</label>
              <input
                style={inp}
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="mein-projekt"
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
              />
            </div>
            {orgs.length > 0 && (
              <div>
                <label style={{ display: 'block', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--fg-3)', fontWeight: 500, marginBottom: 6 }}>Organisation (optional)</label>
                <select
                  value={newOrg}
                  onChange={e => setNewOrg(e.target.value)}
                  style={{ ...inp, cursor: 'pointer' }}
                >
                  <option value="">Persönliches Konto</option>
                  {orgs.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                onClick={() => setNewPrivate(v => !v)}
                style={{ width: 36, height: 20, borderRadius: 99, border: 'none', background: newPrivate ? 'var(--accent)' : 'var(--line-strong)', cursor: 'pointer', position: 'relative', transition: 'background 0.15s', flexShrink: 0 }}
              >
                <span style={{ position: 'absolute', top: 2, left: newPrivate ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.15s' }} />
              </button>
              <span style={{ fontSize: 12, color: 'var(--fg-1)' }}>{newPrivate ? 'Privat' : 'Öffentlich'}</span>
            </div>
            {createErr && <div style={{ fontSize: 11.5, color: 'var(--err)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, padding: '7px 10px' }}>{createErr}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 'auto' }}>
              <button onClick={() => { setScreen('repo-list'); setCreateErr(null) }} style={btnSec}>Zurück</button>
              <button onClick={handleCreate} disabled={creating || !newName.trim()} style={{ ...btnPri, opacity: (creating || !newName.trim()) ? 0.5 : 1 }}>
                {creating ? 'Wird erstellt…' : 'Repo erstellen'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
