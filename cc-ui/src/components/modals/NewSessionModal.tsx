import React, { useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import type { PermMode } from '../../store/useAppStore'
import { IClose, ICheck, IShield } from '../primitives/Icons'
import { Kbd } from '../primitives/Kbd'

const fieldLabel: React.CSSProperties = { display: 'block', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.7, color: 'var(--fg-3)', fontWeight: 500, marginBottom: 6 }
const btnPrimary: React.CSSProperties = { background: 'var(--accent)', color: '#1a1410', border: 'none', padding: '7px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)' }
const btnGhost: React.CSSProperties = { background: 'transparent', color: 'var(--fg-1)', border: '1px solid var(--line-strong)', padding: '7px 14px', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-ui)' }

export function NewSessionModal() {
  const { setNewSessionOpen, activeProjectId, addSession, setActiveSession, aliases, setScreen } = useAppStore()
  const [title, setTitle] = useState('')
  const [aliasName, setAliasName] = useState(aliases[0]?.name ?? '')
  const [permMode, setPermMode] = useState<PermMode>('normal')

  const start = () => {
    const id = `s${Date.now()}`
    addSession(activeProjectId, { id, name: title || 'New session', alias: aliasName, status: 'active', permMode, startedAt: Date.now() })
    setActiveSession(id)
    setNewSessionOpen(false)
  }

  const goCreateAlias = () => {
    setNewSessionOpen(false)
    setScreen('settings')
  }

  return (
    <div onClick={() => setNewSessionOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(8,7,5,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 560, maxWidth: '92vw', background: 'var(--bg-1)', border: '1px solid var(--line-strong)', borderRadius: 10, boxShadow: '0 24px 64px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ height: 38, padding: '0 14px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--line)' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)' }}>New session</span>
          <span style={{ flex: 1 }} />
          <IClose onClick={() => setNewSessionOpen(false)} style={{ color: 'var(--fg-2)', cursor: 'pointer' }} />
        </div>

        <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={fieldLabel}>Session title</label>
            <input
              autoFocus
              style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--line-strong)', borderRadius: 6, background: 'var(--bg-2)', color: 'var(--fg-0)', fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none', boxSizing: 'border-box' }}
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && start()}
              placeholder="e.g. refactor retries"
            />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ ...fieldLabel, marginBottom: 0 }}>Choose alias</label>
              <span style={{ flex: 1 }} />
              <button onClick={goCreateAlias} style={{ background: 'transparent', border: 'none', color: 'var(--accent)', fontSize: 10.5, cursor: 'pointer', fontFamily: 'var(--font-ui)', padding: 0 }}>+ New alias</button>
            </div>
            {aliases.length === 0 ? (
              <div style={{ padding: '14px', border: '1px dashed var(--line-strong)', borderRadius: 6, textAlign: 'center', color: 'var(--fg-3)', fontSize: 11.5 }}>
                No aliases yet.{' '}
                <button onClick={goCreateAlias} style={{ background: 'transparent', border: 'none', color: 'var(--accent)', fontSize: 11.5, cursor: 'pointer', fontFamily: 'var(--font-ui)', padding: 0 }}>Create one in Settings</button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {aliases.map(a => (
                  <div key={a.name} onClick={() => setAliasName(a.name)} style={{ padding: '10px 12px', borderRadius: 6, border: `1px solid ${aliasName === a.name ? 'var(--accent)' : 'var(--line-strong)'}`, background: aliasName === a.name ? 'var(--accent-soft)' : 'var(--bg-2)', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: aliasName === a.name ? 'var(--accent)' : 'var(--fg-0)' }}>{a.name}</span>
                      {aliasName === a.name && <ICheck style={{ color: 'var(--accent)', marginLeft: 'auto' }} />}
                    </div>
                    <div className="mono" style={{ fontSize: 10.5, color: 'var(--fg-2)' }}>{a.cmd} {a.args}</div>
                    <div style={{ fontSize: 10.5, color: a.permMode === 'dangerous' ? 'var(--danger)' : 'var(--fg-3)', marginTop: 4 }}>
                      {a.permMode === 'dangerous' ? '⚠ dangerous' : 'ask each time'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label style={fieldLabel}>Permission mode</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['normal', 'dangerous'] as PermMode[]).map((mode) => {
                const isDanger = mode === 'dangerous'
                const sel = permMode === mode
                return (
                  <div key={mode} onClick={() => setPermMode(mode)} style={{ flex: 1, padding: '10px 12px', borderRadius: 6, border: `1px solid ${sel ? (isDanger ? 'var(--danger)' : 'var(--accent)') : 'var(--line-strong)'}`, background: sel ? (isDanger ? 'var(--danger-soft)' : 'var(--accent-soft)') : 'var(--bg-2)', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <IShield style={{ color: isDanger ? 'var(--danger)' : 'var(--ok)' }} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)' }}>{isDanger ? 'Dangerous' : 'Normal'}</span>
                      {sel && <ICheck style={{ color: isDanger ? 'var(--danger)' : 'var(--accent)', marginLeft: 'auto' }} />}
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--fg-2)', lineHeight: 1.5 }}>
                      {isDanger ? 'Skip every permission prompt. Agent can write & exec freely.' : 'Ask before writes, exec, or destructive ops.'}
                    </div>
                    {isDanger && <div className="mono" style={{ marginTop: 6, fontSize: 9.5, color: 'var(--danger)' }}>--dangerously-skip-permissions</div>}
                  </div>
                )
              })}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', paddingTop: 12, borderTop: '1px solid var(--line)' }}>
            <span style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>Opens in new tab · <Kbd>⌘T</Kbd></span>
            <span style={{ flex: 1 }} />
            <button style={{ ...btnGhost, marginRight: 8 }} onClick={() => setNewSessionOpen(false)}>Cancel</button>
            <button style={{ ...btnPrimary, opacity: aliases.length === 0 ? 0.5 : 1 }} disabled={aliases.length === 0} onClick={start}>Start session</button>
          </div>
        </div>
      </div>
    </div>
  )
}
