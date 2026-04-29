import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '../../store/useAppStore'
import type { Alias, RepoToken, DocTemplate } from '../../store/useAppStore'
import { IPlus, IDrag, IEdit, ITrash } from '../primitives/Icons'
import { Pill } from '../primitives/Pill'
import { ACCENT_PRESETS, TERMINAL_THEMES, applyPreset } from '../../theme/presets'
import type { AIProvider, TerminalShortcut } from '../../store/useAppStore'

// ── Shared styles ─────────────────────────────────────────────────────────────
const fieldLabel: React.CSSProperties = {
  display: 'block', fontSize: 10, textTransform: 'uppercase',
  letterSpacing: 0.7, color: 'var(--fg-3)', fontWeight: 500, marginBottom: 6,
}
const fieldInput: React.CSSProperties = {
  width: '100%', padding: '7px 10px', border: '1px solid var(--line-strong)',
  borderRadius: 6, background: 'var(--bg-2)', color: 'var(--fg-0)',
  fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none', boxSizing: 'border-box' as const,
}
const btnPrimary: React.CSSProperties = {
  background: 'var(--accent)', color: 'var(--accent-fg)', border: 'none',
  padding: '7px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'var(--font-ui)', display: 'flex', alignItems: 'center', gap: 6,
}
const btnGhost: React.CSSProperties = {
  background: 'transparent', color: 'var(--fg-1)', border: '1px solid var(--line-strong)',
  padding: '7px 14px', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-ui)',
}

const NAV = ['Aliases', 'Tokens', 'Prompt templates', 'Appearance', 'Terminal', 'Terminal-Befehle', 'AI', 'Doc Templates']

type EditMode = { kind: 'new' } | { kind: 'edit'; id: string } | null
const emptyAlias = () => ({ name: '', cmd: 'claude', args: '--model sonnet-4.6' })

// ── Binary check ──────────────────────────────────────────────────────────────
async function checkCmd(cmd: string): Promise<{ ok: boolean; path: string | null }> {
  if (!cmd.trim()) return { ok: false, path: null }
  try {
    const r = await fetch(`/api/which?cmd=${encodeURIComponent(cmd.trim())}`)
    return await r.json() as { ok: boolean; path: string | null }
  } catch { return { ok: false, path: null } }
}

function useCmdCheck(cmd: string) {
  const [result, setResult] = useState<{ ok: boolean; path: string | null } | null>(null)
  const [checking, setChecking] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!cmd.trim()) { setResult(null); return }
    setChecking(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      setResult(await checkCmd(cmd)); setChecking(false)
    }, 500)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [cmd])
  return { result, checking }
}

function useAllCmdChecks(aliases: Alias[]) {
  const [checks, setChecks] = useState<Record<string, boolean>>({})
  useEffect(() => {
    aliases.forEach(a => checkCmd(a.cmd).then(r => setChecks(p => ({ ...p, [a.id]: r.ok }))))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aliases.map(a => a.id + a.cmd).join(',')])
  return checks
}

function CmdField({ cmd, onChange }: { cmd: string; onChange: (v: string) => void }) {
  const { result, checking } = useCmdCheck(cmd)
  const border = !cmd.trim() ? 'var(--line-strong)' : checking ? 'var(--line-strong)' : result?.ok ? 'var(--ok)' : 'var(--err)'
  const hint   = !cmd.trim() ? null : checking ? '…' : result?.ok ? result.path : 'command not found'
  return (
    <div>
      <label style={fieldLabel}>Binary / command</label>
      <input style={{ ...fieldInput, border: `1px solid ${border}`, transition: 'border-color 0.2s' }}
        value={cmd} onChange={e => onChange(e.target.value)} placeholder="claude" spellCheck={false} />
      {hint && (
        <div style={{ marginTop: 4, fontSize: 10, color: result?.ok ? 'var(--ok)' : 'var(--err)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {result?.ok ? '✓ ' : '✗ '}{hint}
        </div>
      )}
    </div>
  )
}

// ── Root component ────────────────────────────────────────────────────────────
export function AliasSettings() {
  const { aliases, addAlias, updateAlias, removeAlias, reorderAliases, setScreen } = useAppStore()
  const [activeNav, setActiveNav] = useState('Aliases')
  const [editMode, setEditMode] = useState<EditMode>(null)
  const [form, setForm]         = useState(emptyAlias)
  const cmdChecks = useAllCmdChecks(aliases)

  const openEdit = (a: Alias) => { setEditMode({ kind: 'edit', id: a.id }); setForm({ name: a.name, cmd: a.cmd, args: a.args }) }
  const openNew  = () => { setEditMode({ kind: 'new' }); setForm(emptyAlias()) }
  const save = () => {
    if (!form.name.trim()) return
    if (editMode?.kind === 'new') {
      addAlias({ id: `a${Date.now()}`, name: form.name.trim(), cmd: form.cmd, args: form.args, permMode: 'normal', status: 'ok' })
    } else if (editMode?.kind === 'edit') {
      updateAlias(editMode.id, { name: form.name.trim(), cmd: form.cmd, args: form.args })
    }
    setEditMode(null)
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-0)' }}>
      {/* Titlebar */}
      <div style={{ height: 38, display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', background: 'var(--bg-1)', borderBottom: '1px solid var(--line)' }}>
        <span style={{ width: 22, height: 22, borderRadius: 5, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-fg)', flexShrink: 0 }}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 5l3 3-3 3M9 11h4"/>
          </svg>
        </span>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)' }}>Codera AI</span>
        <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>· Settings</span>
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Sidebar */}
        <aside style={{ width: 180, background: 'var(--bg-1)', borderRight: '1px solid var(--line)', padding: '12px 0', flexShrink: 0 }}>
          {NAV.map(label => (
            <div key={label} onClick={() => { setActiveNav(label); setEditMode(null) }} style={{
              padding: '6px 16px', fontSize: 12, cursor: 'pointer',
              color: label === activeNav ? 'var(--accent)' : 'var(--fg-1)',
              background: label === activeNav ? 'var(--accent-soft)' : 'transparent',
              borderLeft: label === activeNav ? '2px solid var(--accent)' : '2px solid transparent',
            }}>{label}</div>
          ))}
          <div style={{ margin: '16px 16px 0', height: 1, background: 'var(--line)' }} />
          <div onClick={() => setScreen('workspace')} style={{ padding: '8px 16px', fontSize: 12, color: 'var(--fg-3)', cursor: 'pointer', marginTop: 4 }}>← Back</div>
        </aside>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {activeNav === 'Aliases' && (
            <AliasesPanel
              aliases={aliases} cmdChecks={cmdChecks}
              activeId={editMode?.kind === 'edit' ? editMode.id : null}
              editMode={editMode} form={form} setForm={setForm}
              openEdit={openEdit} openNew={openNew} save={save}
              setEditMode={setEditMode} removeAlias={removeAlias}
              reorderAliases={reorderAliases}
            />
          )}
          {activeNav === 'Tokens'           && <TokensPanel />}
          {activeNav === 'Prompt templates' && <TemplatesPanel />}
          {activeNav === 'Appearance'       && <AppearancePanel />}
          {activeNav === 'Terminal'         && <TerminalFontPanel />}
          {activeNav === 'Terminal-Befehle' && <TerminalCommandsPanel />}
          {activeNav === 'AI'               && <AIPanel />}
          {activeNav === 'Doc Templates'    && <DocTemplatesPanel />}
        </div>
      </div>
    </div>
  )
}

// ── Aliases panel ─────────────────────────────────────────────────────────────
function AliasesPanel({ aliases, cmdChecks, activeId, editMode, form, setForm, openEdit, openNew, save, setEditMode, removeAlias, reorderAliases }: {
  aliases: Alias[]; cmdChecks: Record<string, boolean>; activeId: string | null
  editMode: EditMode; form: { name: string; cmd: string; args: string }
  setForm: React.Dispatch<React.SetStateAction<{ name: string; cmd: string; args: string }>>
  openEdit: (a: Alias) => void; openNew: () => void; save: () => void
  setEditMode: (m: EditMode) => void; removeAlias: (id: string) => void
  reorderAliases: (ids: string[]) => void
}) {
  const [dragging, setDragging] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)

  return (
    <div style={{ padding: '20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: '0 0 2px', fontSize: 16, fontWeight: 600, color: 'var(--fg-0)' }}>Aliases</h2>
          <div style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>Die ersten 4 werden als Schnellstart im leeren Projekt angezeigt. Reihenfolge per Drag ändern.</div>
        </div>
        <span style={{ flex: 1 }} />
        <button style={btnPrimary} onClick={openNew}><IPlus />New</button>
      </div>

      <div style={{ border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden', background: 'var(--bg-1)', marginBottom: editMode ? 20 : 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '28px 150px 110px 1fr 100px 44px', padding: '7px 12px', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.7, color: 'var(--fg-3)', borderBottom: '1px solid var(--line)', background: 'var(--bg-2)', gap: 10 }}>
          <span /><span>Name</span><span>Command</span><span>Arguments</span><span>Status</span><span />
        </div>
        {aliases.length === 0 && (
          <div style={{ padding: '18px', textAlign: 'center', color: 'var(--fg-3)', fontSize: 12 }}>No aliases yet.</div>
        )}
        {aliases.map((a, i) => (
          <div
            key={a.id}
            draggable={true}
            onDragStart={e => {
              e.dataTransfer.effectAllowed = 'move'
              e.dataTransfer.setData('text/plain', a.id)
              setTimeout(() => setDragging(a.id), 0)
            }}
            onDragEnd={() => { setDragging(null); setDragOver(null) }}
            onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (dragOver !== a.id) setDragOver(a.id) }}
            onDragLeave={() => setDragOver(v => v === a.id ? null : v)}
            onDrop={e => {
              e.preventDefault()
              const from = e.dataTransfer.getData('text/plain')
              setDragging(null); setDragOver(null)
              if (!from || from === a.id) return
              const ids = aliases.map(x => x.id)
              const fi = ids.indexOf(from); const ti = ids.indexOf(a.id)
              if (fi === -1 || ti === -1) return
              ids.splice(fi, 1); ids.splice(ti, 0, from)
              reorderAliases(ids)
            }}
            onClick={() => openEdit(a)}
            style={{
              display: 'grid', gridTemplateColumns: '42px 150px 110px 1fr 100px 44px',
              padding: '8px 12px', alignItems: 'center', fontSize: 11.5,
              borderBottom: i < aliases.length - 1 ? '1px solid var(--line)' : 'none',
              background: dragOver === a.id ? 'var(--accent-soft)' : a.id === activeId ? 'var(--bg-2)' : 'transparent',
              borderLeft: dragOver === a.id ? '2px solid var(--accent)' : '2px solid transparent',
              gap: 10, cursor: 'pointer', transition: 'background 0.1s',
              opacity: dragging === a.id ? 0.4 : 1,
            }}
          >
            {/* Drag handle + position number (all aliases) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <IDrag style={{ color: 'var(--fg-3)', cursor: 'grab', flexShrink: 0 }} />
              <span style={{
                fontSize: 9.5, fontWeight: 700, minWidth: 16, textAlign: 'center',
                color: i < 4 ? 'var(--accent)' : 'var(--fg-3)',
                background: i < 4 ? 'var(--accent-soft)' : 'var(--bg-3)',
                border: `1px solid ${i < 4 ? 'var(--accent-line)' : 'var(--line)'}`,
                borderRadius: 3, padding: '0 4px', lineHeight: '16px',
              }}>
                {i + 1}
              </span>
            </div>
            <span className="mono" style={{ color: a.id === activeId ? 'var(--accent)' : 'var(--fg-0)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
            <span className="mono" style={{ color: 'var(--fg-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.cmd}</span>
            <span className="mono" style={{ color: 'var(--fg-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.args || '—'}</span>
            {cmdChecks[a.id] === undefined
              ? <Pill tone="neutral">…</Pill>
              : cmdChecks[a.id] ? <Pill tone="ok" dot>ready</Pill> : <Pill tone="warn" dot>shell alias</Pill>
            }
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <IEdit style={{ color: 'var(--fg-3)', cursor: 'pointer' }} onClick={(e: React.MouseEvent) => { e.stopPropagation(); openEdit(a) }} />
              <ITrash style={{ color: 'var(--err)', cursor: 'pointer' }} onClick={(e: React.MouseEvent) => {
                e.stopPropagation()
                if (confirm(`Delete "${a.name}"?`)) removeAlias(a.id)
              }} />
            </div>
          </div>
        ))}
      </div>

      {editMode !== null && (
        <div style={{ marginTop: 20 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--fg-0)' }}>
            {editMode.kind === 'new' ? 'New alias' : <>Edit · <span className="mono" style={{ color: 'var(--accent)' }}>{form.name}</span></>}
          </h3>
          <div style={{ border: '1px solid var(--line)', borderRadius: 6, padding: 16, background: 'var(--bg-1)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={fieldLabel}>Display name</label>
              <input style={fieldInput} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="claude-code" autoFocus={editMode.kind === 'new'} />
            </div>
            <CmdField cmd={form.cmd} onChange={cmd => setForm(f => ({ ...f, cmd }))} />
            <div style={{ gridColumn: '1 / span 2' }}>
              <label style={fieldLabel}>Arguments</label>
              <input style={fieldInput} value={form.args} onChange={e => setForm(f => ({ ...f, args: e.target.value }))} placeholder="--model claude-sonnet-4-5" />
              {/* Warn if old dot-format model name is used */}
              {/--model\s+\S*\d+\.\d+/.test(form.args) && (
                <div style={{ marginTop: 5, padding: '5px 10px', background: 'rgba(244,195,101,0.12)', border: '1px solid rgba(244,195,101,0.4)', borderRadius: 5, fontSize: 11, color: 'var(--warn)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>⚠</span>
                  <span>Altes Modell-Format erkannt. Seit Claude 2.x: <code style={{ fontFamily: 'var(--font-mono)' }}>--model claude-sonnet-4-5</code> oder kurz <code style={{ fontFamily: 'var(--font-mono)' }}>--model sonnet</code></span>
                </div>
              )}
            </div>
            <div style={{ gridColumn: '1 / span 2', display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <button style={btnGhost} onClick={() => setEditMode(null)}>Cancel</button>
              <button style={{ ...btnPrimary, opacity: !form.name.trim() ? 0.5 : 1 }} disabled={!form.name.trim()} onClick={save}>
                {editMode.kind === 'new' ? 'Create' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tokens panel ──────────────────────────────────────────────────────────────
function TokensPanel() {
  const { tokens, addToken, updateToken, removeToken } = useAppStore()
  const [editId, setEditId]   = useState<string | null>(null)
  const [adding, setAdding]   = useState(false)
  const [form, setForm]       = useState({ label: '', host: 'github.com', token: '' })
  const [showIds, setShowIds] = useState<Set<string>>(new Set())

  const toggleShow = (id: string) =>
    setShowIds(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  const openAdd = () => { setAdding(true); setEditId(null); setForm({ label: '', host: 'github.com', token: '' }) }
  const openEdit = (t: RepoToken) => { setEditId(t.id); setAdding(false); setForm({ label: t.label, host: t.host, token: t.token }) }
  const cancel = () => { setAdding(false); setEditId(null) }
  const save = () => {
    if (!form.label.trim() || !form.token.trim()) return
    if (adding) {
      addToken({ id: `tok${Date.now()}`, label: form.label.trim(), host: form.host.trim(), token: form.token.trim() })
    } else if (editId) {
      updateToken(editId, { label: form.label.trim(), host: form.host.trim(), token: form.token.trim() })
    }
    cancel()
  }

  const mask = (t: string) => t.length < 8 ? '••••••••' : t.slice(0, 4) + '••••••••' + t.slice(-4)

  const HOSTS = ['github.com', 'gitlab.com', 'bitbucket.org', 'dev.azure.com']

  return (
    <div style={{ padding: '20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--fg-0)' }}>Tokens</h2>
        <span style={{ flex: 1 }} />
        <button style={btnPrimary} onClick={openAdd}><IPlus />Add token</button>
      </div>
      <p style={{ margin: '0 0 14px', color: 'var(--fg-3)', fontSize: 11.5, maxWidth: 500 }}>
        Personal access tokens for Git hosts. Used for authenticated clone, push, and pull operations.
      </p>

      {/* Token list */}
      {tokens.length === 0 && !adding ? (
        <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--fg-3)', fontSize: 12, border: '1px dashed var(--line)', borderRadius: 6 }}>
          No tokens saved yet. Add one above.
        </div>
      ) : (
        <div style={{ border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden', background: 'var(--bg-1)', marginBottom: 20 }}>
          {tokens.map((t, i) => (
            <div key={t.id} style={{
              display: 'grid', gridTemplateColumns: '1fr 120px 1fr 80px',
              padding: '10px 14px', alignItems: 'center', gap: 12, fontSize: 12,
              borderBottom: i < tokens.length - 1 ? '1px solid var(--line)' : 'none',
              background: t.id === editId ? 'var(--accent-soft)' : 'transparent',
            }}>
              <span style={{ fontWeight: 600, color: 'var(--fg-0)' }}>{t.label}</span>
              <span className="mono" style={{ fontSize: 10.5, color: 'var(--fg-2)' }}>{t.host}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="mono" style={{ fontSize: 10.5, color: 'var(--fg-3)', letterSpacing: showIds.has(t.id) ? 0 : 1 }}>
                  {showIds.has(t.id) ? t.token : mask(t.token)}
                </span>
                <button onClick={() => toggleShow(t.id)} style={{ background: 'none', border: 'none', color: 'var(--fg-3)', cursor: 'pointer', fontSize: 10, padding: '1px 4px', fontFamily: 'inherit' }}>
                  {showIds.has(t.id) ? 'hide' : 'show'}
                </button>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <IEdit style={{ color: 'var(--fg-3)', cursor: 'pointer' }} onClick={() => openEdit(t)} />
                <ITrash style={{ color: 'var(--err)', cursor: 'pointer' }} onClick={() => { if (confirm(`Delete token "${t.label}"?`)) removeToken(t.id) }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit form */}
      {(adding || editId) && (
        <div style={{ border: '1px solid var(--line)', borderRadius: 6, padding: 16, background: 'var(--bg-1)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)', marginBottom: 14 }}>
            {adding ? 'Add token' : 'Edit token'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={fieldLabel}>Label</label>
              <input style={fieldInput} value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="GitHub Personal" autoFocus />
            </div>
            <div>
              <label style={fieldLabel}>Git host</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input style={{ ...fieldInput, flex: 1 }} value={form.host} onChange={e => setForm(f => ({ ...f, host: e.target.value }))} placeholder="github.com" list="host-list" />
                <datalist id="host-list">{HOSTS.map(h => <option key={h} value={h} />)}</datalist>
              </div>
            </div>
            <div style={{ gridColumn: '1 / span 2' }}>
              <label style={fieldLabel}>Token</label>
              <input
                style={fieldInput} type="password" value={form.token}
                onChange={e => setForm(f => ({ ...f, token: e.target.value }))}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                autoComplete="new-password"
              />
              <div style={{ marginTop: 5, fontSize: 10, color: 'var(--fg-3)' }}>
                Stored locally in <span className="mono">~/.cc-ui-data.json</span>. Never sent to any server.
              </div>
            </div>
            <div style={{ gridColumn: '1 / span 2', display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <button style={btnGhost} onClick={cancel}>Cancel</button>
              <button
                style={{ ...btnPrimary, opacity: (!form.label.trim() || !form.token.trim()) ? 0.5 : 1 }}
                disabled={!form.label.trim() || !form.token.trim()} onClick={save}
              >
                {adding ? 'Save token' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Prompt templates panel ────────────────────────────────────────────────────
function TemplatesPanel() {
  const { templates, updateTemplate, setScreen } = useAppStore()

  return (
    <div style={{ padding: '20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--fg-0)', flex: 1 }}>Prompt templates</h2>
        <button style={btnGhost} onClick={() => setScreen('templates')}>Alle verwalten →</button>
      </div>
      <p style={{ color: 'var(--fg-3)', fontSize: 11.5, margin: '0 0 16px' }}>
        Markiere Templates als Favorit ★ — sie erscheinen dann direkt unterhalb des Textfeldes.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {templates.map(t => (
          <div
            key={t.id}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 6, border: `1px solid ${t.favorite ? 'var(--accent-line)' : 'var(--line)'}`, background: t.favorite ? 'var(--accent-soft)' : 'var(--bg-2)' }}
          >
            <button
              onClick={() => updateTemplate(t.id, { favorite: !t.favorite })}
              title={t.favorite ? 'Favorit entfernen' : 'Als Favorit markieren'}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 15, lineHeight: 1, color: t.favorite ? 'var(--accent)' : 'var(--fg-3)', flexShrink: 0 }}
            >
              {t.favorite ? '★' : '☆'}
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: t.favorite ? 600 : 400, color: t.favorite ? 'var(--accent)' : 'var(--fg-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
              <div style={{ fontSize: 10.5, color: 'var(--fg-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>{t.body}</div>
            </div>
            {t.hint && <span style={{ fontSize: 10, color: 'var(--fg-3)', background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 3, padding: '1px 5px', flexShrink: 0 }}>{t.hint}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Appearance panel ──────────────────────────────────────────────────────────
// ── Terminal Font Panel ───────────────────────────────────────────────────────

const TERMINAL_FONTS = [
  { id: 'jetbrains', label: 'JetBrains Mono',  sample: 'fn main() {}' },
  { id: 'cascadia',  label: 'Cascadia Code',    sample: 'const x = 42' },
  { id: 'fira',      label: 'Fira Code',        sample: 'git commit -m' },
  { id: 'menlo',     label: 'Menlo',            sample: 'ls -la ~/code' },
  { id: 'sfmono',    label: 'SF Mono',          sample: 'npm run dev' },
  { id: 'monaco',    label: 'Monaco',           sample: 'echo "hello"' },
  { id: 'courier',   label: 'Courier New',      sample: './deploy.sh' },
  { id: 'system',    label: 'System monospace', sample: 'cd ~/projects' },
]

const TERMINAL_FONT_MAP_UI: Record<string, string> = {
  jetbrains: '"JetBrains Mono", monospace',
  cascadia:  '"Cascadia Code", monospace',
  fira:      '"Fira Code", monospace',
  menlo:     'Menlo, monospace',
  sfmono:    '"SF Mono", monospace',
  monaco:    'Monaco, monospace',
  courier:   '"Courier New", monospace',
  system:    'monospace',
}

function TerminalFontPanel() {
  const { terminalFontFamily: _tff, terminalFontSize: _tfs, setTerminalFontFamily, setTerminalFontSize } = useAppStore()
  const terminalFontFamily = _tff ?? 'jetbrains'
  const terminalFontSize   = _tfs ?? 13

  return (
    <div style={{ padding: '20px 24px' }}>
      <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 600, color: 'var(--fg-0)' }}>Terminal</h2>
      <p style={{ margin: '0 0 24px', color: 'var(--fg-3)', fontSize: 11.5 }}>
        Schriftart und -größe für das Terminal-Fenster (xterm.js). Ändert sich sofort in laufenden Sessions.
      </p>

      {/* Font size */}
      <section style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: 0.7, color: 'var(--fg-3)', fontWeight: 500, marginBottom: 10 }}>
          Schriftgröße · <span style={{ fontFamily: 'var(--font-mono)' }}>{terminalFontSize}px</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 10, color: 'var(--fg-3)', minWidth: 20 }}>10</span>
          <input
            type="range" min={10} max={22} step={1}
            value={terminalFontSize}
            onChange={e => setTerminalFontSize(Number(e.target.value))}
            style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer' }}
          />
          <span style={{ fontSize: 10, color: 'var(--fg-3)', minWidth: 20, textAlign: 'right' }}>22</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, gap: 6 }}>
          {[10, 12, 13, 14, 16, 18, 20, 22].map(sz => (
            <button
              key={sz}
              onClick={() => setTerminalFontSize(sz)}
              style={{ flex: 1, padding: '4px 0', border: `1px solid ${terminalFontSize === sz ? 'var(--accent)' : 'var(--line)'}`, borderRadius: 4, background: terminalFontSize === sz ? 'var(--accent-soft)' : 'var(--bg-2)', color: terminalFontSize === sz ? 'var(--accent)' : 'var(--fg-2)', fontSize: 10.5, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {sz}
            </button>
          ))}
        </div>
      </section>

      {/* Font family */}
      <section>
        <div style={{ fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: 0.7, color: 'var(--fg-3)', fontWeight: 500, marginBottom: 10 }}>Schriftart</div>
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
          {TERMINAL_FONTS.map(f => (
            <div
              key={f.id}
              onClick={() => setTerminalFontFamily(f.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 12px', borderRadius: 6, cursor: 'pointer', border: `1px solid ${terminalFontFamily === f.id ? 'var(--accent)' : 'var(--line)'}`, background: terminalFontFamily === f.id ? 'var(--accent-soft)' : 'var(--bg-2)' }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: terminalFontFamily === f.id ? 'var(--accent)' : 'var(--bg-3)', flexShrink: 0 }} />
              <span style={{ width: 120, fontSize: 11.5, color: terminalFontFamily === f.id ? 'var(--accent)' : 'var(--fg-1)', fontWeight: terminalFontFamily === f.id ? 600 : 400 }}>{f.label}</span>
              <span style={{ flex: 1, fontSize: terminalFontSize, fontFamily: TERMINAL_FONT_MAP_UI[f.id], color: 'var(--fg-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.sample}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

// ── Terminal Commands Panel ───────────────────────────────────────────────────

const SHORTCUT_CATEGORY_LABELS: Record<string, string> = {
  control:    'Prozesssteuerung',
  editing:    'Zeile bearbeiten',
  navigation: 'Navigation & History',
}

function TerminalCommandsPanel() {
  const { terminalShortcuts, updateTerminalShortcut, resetTerminalShortcuts } = useAppStore()

  const categories = ['control', 'navigation', 'editing'] as const
  const enabledCount = terminalShortcuts.filter(s => s.enabled).length

  return (
    <div style={{ padding: '20px 24px' }}>
      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16 }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 600, color: 'var(--fg-0)' }}>Terminal-Befehle</h2>
          <p style={{ margin: 0, color: 'var(--fg-3)', fontSize: 11.5 }}>
            Tastenkürzel im Eingabefeld unterhalb des Terminals. &nbsp;
            <span style={{ color: 'var(--accent)' }}>{enabledCount} / {terminalShortcuts.length} aktiv</span>
          </p>
        </div>
        <button
          onClick={resetTerminalShortcuts}
          style={{ ...btnGhost, fontSize: 11, padding: '5px 12px', flexShrink: 0 }}
          title="Alle Kürzel auf Standard zurücksetzen"
        >
          Zurücksetzen
        </button>
      </div>

      {/* Shortcut groups */}
      {categories.map(cat => {
        const items = terminalShortcuts.filter(s => s.category === cat)
        if (!items.length) return null
        return (
          <section key={cat} style={{ marginBottom: 28 }}>
            <SectionLabel>{SHORTCUT_CATEGORY_LABELS[cat]}</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {items.map(sc => (
                <ShortcutRow key={sc.id} sc={sc} onToggle={() => updateTerminalShortcut(sc.id, { enabled: !sc.enabled })} />
              ))}
            </div>
          </section>
        )
      })}

      {/* Info box */}
      <div style={{ padding: '12px 16px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 11.5, color: 'var(--fg-3)', lineHeight: 1.7 }}>
        <div style={{ fontWeight: 600, color: 'var(--fg-2)', marginBottom: 6 }}>Hinweise</div>
        <div>• <b>Tab</b> sendet das Autovervollständigungs-Signal — nützlich für Shell-Completion</div>
        <div>• <b>↑ / ↓</b> navigiert in der History, wenn das Eingabefeld leer ist oder der Cursor am Anfang/Ende steht</div>
        <div>• Alle <b>Ctrl-Kürzel</b> werden direkt als Steuerzeichen ans Terminal geschickt</div>
        <div>• <b>Shift+Enter</b> erzeugt immer eine neue Zeile im Eingabefeld</div>
        <div>• <b>Enter</b> sendet den aktuellen Inhalt ans Terminal</div>
      </div>
    </div>
  )
}

function ShortcutRow({ sc, onToggle }: { sc: TerminalShortcut; onToggle: () => void }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '7px 10px', borderRadius: 7,
        background: hov ? 'var(--bg-3)' : 'transparent',
        border: '1px solid transparent',
        transition: 'background 0.12s',
      }}
    >
      {/* Key badge */}
      <span style={{
        minWidth: 68, fontFamily: 'var(--font-mono)', fontSize: 11.5, fontWeight: 700,
        color: sc.enabled ? 'var(--accent)' : 'var(--fg-3)',
        background: sc.enabled ? 'var(--accent-soft)' : 'var(--bg-3)',
        border: `1px solid ${sc.enabled ? 'var(--accent-line)' : 'var(--line)'}`,
        borderRadius: 5, padding: '3px 8px', textAlign: 'center', flexShrink: 0,
        transition: 'all 0.15s',
      }}>
        {sc.label}
      </span>
      {/* Description */}
      <span style={{ flex: 1, fontSize: 12, color: sc.enabled ? 'var(--fg-1)' : 'var(--fg-3)' }}>
        {sc.description}
      </span>
      {/* Toggle */}
      <button
        onClick={onToggle}
        style={{
          width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
          background: sc.enabled ? 'var(--accent)' : 'var(--bg-3)',
          position: 'relative', flexShrink: 0, transition: 'background 0.2s',
          boxShadow: sc.enabled ? '0 0 0 1px var(--accent)' : '0 0 0 1px var(--line)',
        }}
        title={sc.enabled ? 'Deaktivieren' : 'Aktivieren'}
      >
        <span style={{
          position: 'absolute', top: 3, left: sc.enabled ? 18 : 3,
          width: 14, height: 14, borderRadius: '50%',
          background: sc.enabled ? 'var(--accent-fg, #fff)' : 'var(--fg-3)',
          transition: 'left 0.2s',
        }} />
      </button>
    </div>
  )
}

const UI_FONTS = [
  { id: 'system',    label: 'System default' },
  { id: 'inter',     label: 'Inter' },
  { id: 'geist',     label: 'Geist' },
  { id: 'sf',        label: 'SF Pro' },
  { id: 'jetbrains', label: 'JetBrains Mono' },
]

function AppearancePanel() {
  const { accent: _ac, accentFg: _afg, preset: _pr, terminalTheme: _tt, uiFont: _uf, uiFontSize: _ufs, setAccent, setAccentFg, setPreset, setTerminalTheme, setUiFont, setUiFontSize, setTheme } = useAppStore()
  const accent = _ac ?? '#ff8a5b'
  const accentFg = _afg ?? '#1a1410'
  const preset = _pr ?? 'ember'
  const terminalTheme = _tt ?? 'default'
  const uiFont = _uf ?? 'system'
  const uiFontSize = _ufs ?? 13

  const applyFull = (p: typeof ACCENT_PRESETS[0]) => {
    setPreset(p.id)
    setAccent(p.accent)
    setAccentFg(p.accentFg)
    setTheme(p.dark ? 'dark' : 'light')
    applyPreset(p, p.accent, p.accentFg)
  }

  const darkPresets  = ACCENT_PRESETS.filter(p => p.dark)
  const lightPresets = ACCENT_PRESETS.filter(p => !p.dark)

  return (
    <div style={{ padding: '20px 24px' }}>
      <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 600, color: 'var(--fg-0)' }}>Appearance</h2>
      <p style={{ margin: '0 0 24px', color: 'var(--fg-3)', fontSize: 11.5 }}>
        Presets change the sidebar and accent colour only — the workspace background stays neutral.
      </p>

      {/* Dark presets */}
      <PresetGroup label="Dark" presets={darkPresets} activeId={preset} onApply={applyFull} />

      {/* Light presets */}
      <PresetGroup label="Light" presets={lightPresets} activeId={preset} onApply={applyFull} />

      {/* Custom accent */}
      <section style={{ marginBottom: 28 }}>
        <SectionLabel>Custom colours</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <ColorRow label="Accent colour" hint="buttons, highlights, active states"
            value={accent} onChange={v => { setAccent(v); document.documentElement.style.setProperty('--accent', v) }} />
          <ColorRow label="Text on accent" hint="text inside accent buttons"
            value={accentFg} onChange={v => { setAccentFg(v); document.documentElement.style.setProperty('--accent-fg', v) }} />
        </div>
      </section>

      {/* Typography */}
      <section style={{ marginBottom: 28 }}>
        <SectionLabel>Typography</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {/* Font family */}
          <div>
            <label style={{ display: 'block', fontSize: 10.5, color: 'var(--fg-3)', marginBottom: 5 }}>UI font</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {UI_FONTS.map(f => (
                <div
                  key={f.id}
                  onClick={() => setUiFont(f.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 5, cursor: 'pointer', border: `1px solid ${uiFont === f.id ? 'var(--accent)' : 'var(--line)'}`, background: uiFont === f.id ? 'var(--accent-soft)' : 'var(--bg-2)' }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: uiFont === f.id ? 'var(--accent)' : 'var(--bg-3)', flexShrink: 0 }} />
                  <span style={{ fontSize: 11.5, color: uiFont === f.id ? 'var(--accent)' : 'var(--fg-1)', fontWeight: uiFont === f.id ? 600 : 400 }}>{f.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Font size */}
          <div>
            <label style={{ display: 'block', fontSize: 10.5, color: 'var(--fg-3)', marginBottom: 5 }}>Base font size · <span style={{ fontFamily: 'var(--font-mono)' }}>{uiFontSize}px</span></label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[11, 12, 13, 14, 15].map(sz => (
                <div
                  key={sz}
                  onClick={() => setUiFontSize(sz)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 5, cursor: 'pointer', border: `1px solid ${uiFontSize === sz ? 'var(--accent)' : 'var(--line)'}`, background: uiFontSize === sz ? 'var(--accent-soft)' : 'var(--bg-2)' }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: uiFontSize === sz ? 'var(--accent)' : 'var(--bg-3)', flexShrink: 0 }} />
                  <span style={{ fontSize: sz, color: uiFontSize === sz ? 'var(--accent)' : 'var(--fg-1)', fontWeight: uiFontSize === sz ? 600 : 400, lineHeight: 1 }}>{sz}px — Aa Bb</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Terminal themes */}
      <section>
        <SectionLabel>Terminal colour scheme</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {TERMINAL_THEMES.map(t => (
            <TerminalCard key={t.id} theme={t} active={terminalTheme === t.id} onApply={() => setTerminalTheme(t.id)} />
          ))}
        </div>
        <p style={{ marginTop: 8, fontSize: 10.5, color: 'var(--fg-3)' }}>Applies to new terminal sessions.</p>
      </section>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.7, color: 'var(--fg-3)', fontWeight: 500, marginBottom: 10 }}>{children}</div>
}

function PresetGroup({ label, presets, activeId, onApply }: {
  label: string
  presets: typeof ACCENT_PRESETS
  activeId: string
  onApply: (p: typeof ACCENT_PRESETS[0]) => void
}) {
  return (
    <section style={{ marginBottom: 24 }}>
      <SectionLabel>{label}</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {presets.map(p => <PresetCard key={p.id} preset={p} active={activeId === p.id} onApply={() => onApply(p)} />)}
      </div>
    </section>
  )
}

// PresetCard — uses AccentPreset (no bg0/fg0 etc.)
function PresetCard({ preset, active, onApply }: { preset: typeof ACCENT_PRESETS[0]; active: boolean; onApply: () => void }) {
  const isDark = preset.dark
  const textColor   = isDark ? '#c9c0b3' : '#4a443c'
  const dimColor    = isDark ? '#5e5950' : '#a09889'
  const mainBg      = isDark ? '#0e0d0b' : '#faf8f4'

  return (
    <div onClick={onApply} style={{
      border: `2px solid ${active ? preset.accent : 'var(--line-strong)'}`,
      borderRadius: 7, overflow: 'hidden', cursor: 'pointer',
      boxShadow: active ? `0 0 0 3px ${preset.accent}33` : 'none',
      transition: 'border-color 0.15s, box-shadow 0.15s',
    }}>
      {/* Mini preview */}
      <div style={{ background: mainBg, padding: 7, display: 'flex', gap: 5 }}>
        {/* Sidebar swatch */}
        <div style={{ width: 22, background: preset.sidebarBg, borderRadius: 3, padding: '5px 4px', display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ height: 2, borderRadius: 1, background: preset.accent, width: '90%' }} />
          <div style={{ height: 2, borderRadius: 1, background: dimColor, width: '70%' }} />
          <div style={{ height: 2, borderRadius: 1, background: dimColor, width: '55%' }} />
        </div>
        {/* Content area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, paddingTop: 2 }}>
          <div style={{ height: 2, borderRadius: 1, background: textColor, width: '75%' }} />
          <div style={{ height: 2, borderRadius: 1, background: dimColor, width: '55%' }} />
          {/* Fake input */}
          <div style={{ marginTop: 3, background: preset.sidebarBg2, borderRadius: 2, padding: '3px 4px', display: 'flex', alignItems: 'center', gap: 3 }}>
            <div style={{ flex: 1, height: 1.5, background: dimColor, borderRadius: 1 }} />
            <div style={{ width: 12, height: 7, background: preset.accent, borderRadius: 1.5 }} />
          </div>
        </div>
      </div>
      {/* Label */}
      <div style={{ background: preset.sidebarBg, padding: '4px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10.5, fontWeight: 600, color: textColor }}>{preset.name}</span>
        {active && <span style={{ width: 5, height: 5, borderRadius: '50%', background: preset.accent }} />}
      </div>
    </div>
  )
}

function TerminalCard({ theme, active, onApply }: { theme: typeof TERMINAL_THEMES[0]; active: boolean; onApply: () => void }) {
  const t = theme.theme
  return (
    <div onClick={onApply} style={{
      border: `2px solid ${active ? 'var(--accent)' : 'var(--line-strong)'}`,
      borderRadius: 7, overflow: 'hidden', cursor: 'pointer',
      boxShadow: active ? '0 0 0 3px var(--accent-soft)' : 'none',
      transition: 'border-color 0.15s, box-shadow 0.15s',
    }}>
      <div style={{ background: t.background, padding: '7px 9px', fontFamily: 'var(--font-mono)', fontSize: 9, lineHeight: 1.5 }}>
        <div><span style={{ color: t.green }}>✓ </span><span style={{ color: t.foreground }}>claude</span></div>
        <div style={{ display: 'flex', gap: 3, marginTop: 5 }}>
          {[t.red, t.green, t.yellow, t.blue, t.magenta, t.cyan].map((c, i) => (
            <div key={i} style={{ width: 9, height: 9, borderRadius: 2, background: c }} />
          ))}
        </div>
      </div>
      <div style={{ background: t.background, borderTop: `1px solid rgba(128,128,128,0.15)`, padding: '3px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: t.foreground }}>{theme.name}</span>
        {active && <span style={{ width: 5, height: 5, borderRadius: '50%', background: t.cursor }} />}
      </div>
    </div>
  )
}

function ColorRow({ label, hint, value, onChange }: { label: string; hint: string; value: string; onChange: (v: string) => void }) {
  const [hex, setHex] = useState(value)
  useEffect(() => { setHex(value) }, [value])
  const commit = (v: string) => { setHex(v); if (/^#[0-9a-fA-F]{6}$/.test(v)) onChange(v) }
  return (
    <div>
      <label style={fieldLabel}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--line-strong)', borderRadius: 6, background: 'var(--bg-2)', padding: '6px 10px' }}>
        <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : '#888888'}
          onChange={e => commit(e.target.value)}
          style={{ width: 26, height: 26, padding: 0, border: 'none', borderRadius: 4, background: 'transparent', cursor: 'pointer', flexShrink: 0 }} />
        <input value={hex} onChange={e => commit(e.target.value)}
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--fg-0)', fontSize: 12, fontFamily: 'var(--font-mono)' }}
          placeholder="#ff8a5b" maxLength={7} />
        <div style={{ width: 22, height: 22, borderRadius: 4, background: value, border: '1px solid var(--line)', flexShrink: 0 }} />
      </div>
      <div style={{ marginTop: 4, fontSize: 10, color: 'var(--fg-3)' }}>{hint}</div>
    </div>
  )
}

// ── AI Panel ──────────────────────────────────────────────────────────────────

const PROVIDER_DEFAULTS: Record<string, { label: string; model: string; placeholder: string; docUrl: string }> = {
  openai:    { label: 'OpenAI (ChatGPT)', model: 'gpt-4o',          placeholder: 'sk-…',         docUrl: 'https://platform.openai.com/api-keys' },
  anthropic: { label: 'Anthropic (Claude)', model: 'claude-sonnet-4-6', placeholder: 'sk-ant-…',  docUrl: 'https://console.anthropic.com/account/keys' },
  deepseek:  { label: 'DeepSeek',          model: 'deepseek-chat',  placeholder: 'sk-…',         docUrl: 'https://platform.deepseek.com/api_keys' },
}

const AI_FUNCTIONS: { key: string; label: string; description: string }[] = [
  { key: 'terminal',   label: 'Terminal Textbox',       description: 'KI-Überarbeitung im Eingabefeld der Terminalsitzung' },
  { key: 'kanban',     label: 'Kanban User Story',      description: 'User Story generieren & überarbeiten im Kanban-Board' },
  { key: 'devDetect',  label: 'Dev Server Erkennung',   description: 'Start-Befehl automatisch aus Projektdateien ableiten (▶ AI-Button im Dev-Server-Dialog)' },
  { key: 'docUpdate',  label: 'Docu Update',            description: 'Dokumentation mit AI aktualisieren (Rechtsklick → Docu aktualisieren)' },
]

function AIPanel() {
  const { aiProviders, activeAiProvider, addAiProvider, updateAiProvider, removeAiProvider, setActiveAiProvider, aiFunctionMap, setAiFunctionMap } = useAppStore()
  const [editId, setEditId]   = useState<string | null>(null)
  const [adding, setAdding]   = useState(false)
  const [showKeys, setShowKeys] = useState<Set<string>>(new Set())
  const emptyForm = () => ({ name: '', provider: 'openai' as AIProvider['provider'], apiKey: '', model: 'gpt-4o' })
  const [form, setForm] = useState(emptyForm)

  const openAdd  = () => { setAdding(true); setEditId(null); setForm(emptyForm()) }
  const openEdit = (p: AIProvider) => { setEditId(p.id); setAdding(false); setForm({ name: p.name, provider: p.provider, apiKey: p.apiKey, model: p.model }) }
  const cancel   = () => { setAdding(false); setEditId(null) }
  const save = () => {
    if (!form.name.trim() || !form.apiKey.trim()) return
    if (adding) {
      const id = `ai${Date.now()}`
      addAiProvider({ id, name: form.name.trim(), provider: form.provider, apiKey: form.apiKey.trim(), model: form.model.trim() || PROVIDER_DEFAULTS[form.provider].model })
    } else if (editId) {
      updateAiProvider(editId, { name: form.name.trim(), provider: form.provider, apiKey: form.apiKey.trim(), model: form.model.trim() || PROVIDER_DEFAULTS[form.provider].model })
    }
    cancel()
  }

  const toggleShow = (id: string) => setShowKeys(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const mask = (k: string) => k.length < 12 ? '••••••••' : k.slice(0, 6) + '••••••••' + k.slice(-4)

  return (
    <div style={{ padding: '20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
        <div>
          <h2 style={{ margin: '0 0 2px', fontSize: 16, fontWeight: 600, color: 'var(--fg-0)' }}>AI-Anbieter</h2>
          <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>Konfiguriere Anbieter für die KI-Textüberarbeitung im Editor.</div>
        </div>
        <span style={{ flex: 1 }} />
        <button style={btnPrimary} onClick={openAdd}><IPlus />Anbieter hinzufügen</button>
      </div>

      {aiProviders.length === 0 && !adding && (
        <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--fg-3)', fontSize: 12, border: '1px dashed var(--line)', borderRadius: 6, marginTop: 12 }}>
          Noch kein Anbieter konfiguriert. Füge einen hinzu.
        </div>
      )}

      {aiProviders.length > 0 && (
        <div style={{ border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden', background: 'var(--bg-1)', marginTop: 12, marginBottom: 16 }}>
          {aiProviders.map((p, i) => (
            <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '18px 1fr 120px 1fr 60px', padding: '10px 14px', alignItems: 'center', gap: 12, fontSize: 12, borderBottom: i < aiProviders.length - 1 ? '1px solid var(--line)' : 'none', background: p.id === editId ? 'var(--accent-soft)' : 'transparent' }}>
              {/* Active indicator */}
              <span
                title={p.id === activeAiProvider ? 'Aktiv' : 'Als aktiv setzen'}
                onClick={() => setActiveAiProvider(p.id)}
                style={{ width: 10, height: 10, borderRadius: '50%', background: p.id === activeAiProvider ? 'var(--accent)' : 'var(--bg-4)', border: '1px solid var(--line-strong)', cursor: 'pointer', flexShrink: 0 }}
              />
              <span style={{ fontWeight: 600, color: 'var(--fg-0)' }}>{p.name}</span>
              <span style={{ fontSize: 10.5, color: 'var(--fg-3)', background: 'var(--bg-3)', borderRadius: 4, padding: '2px 6px', textAlign: 'center' }}>{PROVIDER_DEFAULTS[p.provider]?.label ?? p.provider}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="mono" style={{ fontSize: 10.5, color: 'var(--fg-3)', letterSpacing: showKeys.has(p.id) ? 0 : 1 }}>{showKeys.has(p.id) ? p.apiKey : mask(p.apiKey)}</span>
                <button onClick={() => toggleShow(p.id)} style={{ background: 'none', border: 'none', color: 'var(--fg-3)', cursor: 'pointer', fontSize: 10, padding: '1px 4px', fontFamily: 'inherit' }}>{showKeys.has(p.id) ? 'hide' : 'show'}</button>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <IEdit style={{ color: 'var(--fg-3)', cursor: 'pointer' }} onClick={() => openEdit(p)} />
                <ITrash style={{ color: 'var(--err)', cursor: 'pointer' }} onClick={() => { if (confirm(`"${p.name}" löschen?`)) removeAiProvider(p.id) }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit form */}
      {(adding || editId) && (
        <div style={{ border: '1px solid var(--line)', borderRadius: 6, padding: 16, background: 'var(--bg-1)', marginTop: 4 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)', marginBottom: 14 }}>{adding ? 'Anbieter hinzufügen' : 'Anbieter bearbeiten'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={fieldLabel}>Name</label>
              <input style={fieldInput} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Mein ChatGPT" autoFocus />
            </div>
            <div>
              <label style={fieldLabel}>Anbieter</label>
              <select
                value={form.provider}
                onChange={e => {
                  const pr = e.target.value as AIProvider['provider']
                  setForm(f => ({ ...f, provider: pr, model: PROVIDER_DEFAULTS[pr]?.model ?? '' }))
                }}
                style={{ ...fieldInput, cursor: 'pointer' }}
              >
                <option value="openai">OpenAI (ChatGPT)</option>
                <option value="anthropic">Anthropic (Claude)</option>
                <option value="deepseek">DeepSeek</option>
              </select>
            </div>
            <div style={{ gridColumn: '1 / span 2' }}>
              <label style={fieldLabel}>
                API Key — <a href={PROVIDER_DEFAULTS[form.provider]?.docUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Key holen ↗</a>
              </label>
              <input style={fieldInput} type="password" value={form.apiKey} onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))} placeholder={PROVIDER_DEFAULTS[form.provider]?.placeholder ?? 'sk-…'} autoComplete="new-password" />
            </div>
            <div style={{ gridColumn: '1 / span 2' }}>
              <label style={fieldLabel}>Modell</label>
              <input style={fieldInput} value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} placeholder={PROVIDER_DEFAULTS[form.provider]?.model} />
            </div>
            <div style={{ gridColumn: '1 / span 2', display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <button style={btnGhost} onClick={cancel}>Abbrechen</button>
              <button style={{ ...btnPrimary, opacity: (!form.name.trim() || !form.apiKey.trim()) ? 0.5 : 1 }} disabled={!form.name.trim() || !form.apiKey.trim()} onClick={save}>
                {adding ? 'Speichern' : 'Aktualisieren'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Function assignment */}
      {aiProviders.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)', marginBottom: 4 }}>Funktionszuweisung</div>
          <div style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 12 }}>Welcher Anbieter soll für welche Funktion verwendet werden?</div>
          <div style={{ border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden', background: 'var(--bg-1)' }}>
            {AI_FUNCTIONS.map((fn, i) => {
              const selected = aiFunctionMap[fn.key] || activeAiProvider || aiProviders[0]?.id || ''
              return (
                <div key={fn.key} style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16,
                  padding: '12px 16px', alignItems: 'center',
                  borderBottom: i < AI_FUNCTIONS.length - 1 ? '1px solid var(--line)' : 'none',
                }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)' }}>{fn.label}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginTop: 2 }}>{fn.description}</div>
                  </div>
                  <select
                    value={selected}
                    onChange={e => setAiFunctionMap(fn.key, e.target.value)}
                    style={{ ...fieldInput, cursor: 'pointer', fontSize: 12 }}
                  >
                    {aiProviders.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.model})</option>
                    ))}
                  </select>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div style={{ marginTop: 20, padding: 14, background: 'var(--bg-2)', borderRadius: 6, border: '1px solid var(--line)', fontSize: 11, color: 'var(--fg-3)', lineHeight: 1.6 }}>
        <strong style={{ color: 'var(--fg-1)' }}>Verwendung:</strong> Klicke im Eingabefeld auf den <span style={{ fontWeight: 600, color: 'var(--accent)' }}>✦ KI</span>-Button, um deinen Text vor dem Senden automatisch sprachlich und inhaltlich zu verbessern. API-Keys werden lokal in <span className="mono">~/.cc-ui-data.json</span> gespeichert.
      </div>
    </div>
  )
}

// ── Doc Templates Panel ───────────────────────────────────────────────────────

function DocTemplatesPanel() {
  const { docTemplates, addDocTemplate, updateDocTemplate, removeDocTemplate } = useAppStore()
  const [editId, setEditId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const emptyForm = (): Omit<DocTemplate, 'id'> => ({ name: '', relativePath: '', content: '', enabled: true })
  const [form, setForm] = useState<Omit<DocTemplate, 'id'>>(emptyForm)

  const openAdd  = () => { setAdding(true); setEditId(null); setForm(emptyForm()) }
  const openEdit = (t: DocTemplate) => { setEditId(t.id); setAdding(false); setForm({ name: t.name, relativePath: t.relativePath, content: t.content, enabled: t.enabled }) }
  const cancel   = () => { setAdding(false); setEditId(null) }

  const save = () => {
    if (!form.name.trim() || !form.relativePath.trim()) return
    if (adding) {
      addDocTemplate({ id: `dt${Date.now()}`, ...form, name: form.name.trim(), relativePath: form.relativePath.trim() })
    } else if (editId) {
      updateDocTemplate(editId, { ...form, name: form.name.trim(), relativePath: form.relativePath.trim() })
    }
    cancel()
  }

  return (
    <div style={{ padding: '20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
        <div>
          <h2 style={{ margin: '0 0 2px', fontSize: 16, fontWeight: 600, color: 'var(--fg-0)' }}>Doc Templates</h2>
          <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>Werden beim Erstellen neuer Projekte automatisch angelegt. Per Rechtsklick auf ein Projekt aktualisierbar.</div>
        </div>
        <span style={{ flex: 1 }} />
        <button style={btnPrimary} onClick={openAdd}><IPlus />Neue Vorlage</button>
      </div>

      {docTemplates.length === 0 && !adding && (
        <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--fg-3)', fontSize: 12, border: '1px dashed var(--line)', borderRadius: 6, marginTop: 12 }}>
          Keine Vorlagen vorhanden.
        </div>
      )}

      {docTemplates.length > 0 && (
        <div style={{ border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden', background: 'var(--bg-1)', marginTop: 12, marginBottom: 16 }}>
          {docTemplates.map((t, i) => (
            <div key={t.id} style={{
              display: 'grid', gridTemplateColumns: '36px 1fr 160px 44px',
              padding: '9px 14px', alignItems: 'center', gap: 12, fontSize: 12,
              borderBottom: i < docTemplates.length - 1 ? '1px solid var(--line)' : 'none',
              background: t.id === editId ? 'var(--accent-soft)' : 'transparent',
            }}>
              {/* Toggle */}
              <button
                onClick={() => updateDocTemplate(t.id, { enabled: !t.enabled })}
                style={{ width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer', background: t.enabled ? 'var(--accent)' : 'var(--bg-3)', position: 'relative', flexShrink: 0, transition: 'background 0.2s', boxShadow: t.enabled ? '0 0 0 1px var(--accent)' : '0 0 0 1px var(--line)' }}
              >
                <span style={{ position: 'absolute', top: 3, left: t.enabled ? 18 : 3, width: 14, height: 14, borderRadius: '50%', background: t.enabled ? 'var(--accent-fg, #fff)' : 'var(--fg-3)', transition: 'left 0.2s' }} />
              </button>
              {/* Name */}
              <div>
                <span style={{ fontWeight: 600, color: t.enabled ? 'var(--fg-0)' : 'var(--fg-3)' }}>{t.name}</span>
              </div>
              {/* Path */}
              <span className="mono" style={{ fontSize: 10.5, color: 'var(--fg-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.relativePath}</span>
              {/* Actions */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <IEdit style={{ color: 'var(--fg-3)', cursor: 'pointer' }} onClick={() => openEdit(t)} />
                <ITrash style={{ color: 'var(--err)', cursor: 'pointer' }} onClick={() => { if (confirm(`"${t.name}" löschen?`)) removeDocTemplate(t.id) }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit form */}
      {(adding || editId) && (
        <div style={{ border: '1px solid var(--line)', borderRadius: 6, padding: 16, background: 'var(--bg-1)', marginTop: 4 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)', marginBottom: 14 }}>
            {adding ? 'Neue Vorlage anlegen' : 'Vorlage bearbeiten'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={fieldLabel}>Name</label>
              <input style={fieldInput} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="z.B. CLAUDE.md" autoFocus />
            </div>
            <div>
              <label style={fieldLabel}>Relativer Pfad im Projekt</label>
              <input style={fieldInput} value={form.relativePath} onChange={e => setForm(f => ({ ...f, relativePath: e.target.value }))} placeholder="z.B. Docs/RULES.md" />
            </div>
            <div style={{ gridColumn: '1 / span 2' }}>
              <label style={fieldLabel}>Inhalt (Markdown)</label>
              <textarea
                style={{ ...fieldInput, minHeight: 280, resize: 'vertical', lineHeight: 1.5 }}
                value={form.content}
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                spellCheck={false}
              />
            </div>
            <div style={{ gridColumn: '1 / span 2', display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <button style={btnGhost} onClick={cancel}>Abbrechen</button>
              <button
                style={{ ...btnPrimary, opacity: (!form.name.trim() || !form.relativePath.trim()) ? 0.5 : 1 }}
                disabled={!form.name.trim() || !form.relativePath.trim()}
                onClick={save}
              >
                {adding ? 'Speichern' : 'Aktualisieren'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 16, padding: 14, background: 'var(--bg-2)', borderRadius: 6, border: '1px solid var(--line)', fontSize: 11, color: 'var(--fg-3)', lineHeight: 1.6 }}>
        <strong style={{ color: 'var(--fg-1)' }}>Hinweis:</strong> Aktivierte Vorlagen werden beim Anlegen eines neuen Projekts automatisch in den Projektordner geschrieben — nur wenn die Datei noch nicht existiert. Per Rechtsklick auf ein Projekt kann die Doku mit einem AI-Anbieter (<span className="mono">Initial Docu Check</span>) aktualisiert werden.
      </div>
    </div>
  )
}
