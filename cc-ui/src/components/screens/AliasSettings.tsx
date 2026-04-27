import React, { useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import type { Alias, PermMode } from '../../store/useAppStore'
import { IPlus, IDrag, IEdit, ITrash } from '../primitives/Icons'
import { Pill } from '../primitives/Pill'

const fieldLabel: React.CSSProperties = { display: 'block', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.7, color: 'var(--fg-3)', fontWeight: 500, marginBottom: 6 }
const fieldInput: React.CSSProperties = { width: '100%', padding: '7px 10px', border: '1px solid var(--line-strong)', borderRadius: 6, background: 'var(--bg-2)', color: 'var(--fg-0)', fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none', boxSizing: 'border-box' as const }
const btnPrimary: React.CSSProperties = { background: 'var(--accent)', color: '#1a1410', border: 'none', padding: '7px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)', display: 'flex', alignItems: 'center', gap: 6 }
const btnGhost: React.CSSProperties = { background: 'transparent', color: 'var(--fg-1)', border: '1px solid var(--line-strong)', padding: '7px 14px', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-ui)' }

const NAV = ['General', 'Aliases', 'Permissions', 'Prompt templates', 'Keyboard', 'Appearance', 'Telemetry', 'Advanced']

type EditMode = { kind: 'new' } | { kind: 'edit'; id: string } | null

const emptyForm = () => ({ name: '', cmd: 'claude', args: '--model sonnet-4.6', permMode: 'normal' as PermMode })

export function AliasSettings() {
  const { aliases, addAlias, updateAlias, removeAlias, setScreen } = useAppStore()
  const [editMode, setEditMode] = useState<EditMode>(aliases.length > 0 ? { kind: 'edit', id: aliases[0].id } : { kind: 'new' })
  const [form, setForm] = useState(() => {
    const first = aliases[0]
    return first ? { name: first.name, cmd: first.cmd, args: first.args, permMode: first.permMode } : emptyForm()
  })

  const openEdit = (a: Alias) => {
    setEditMode({ kind: 'edit', id: a.id })
    setForm({ name: a.name, cmd: a.cmd, args: a.args, permMode: a.permMode })
  }

  const openNew = () => {
    setEditMode({ kind: 'new' })
    setForm(emptyForm())
  }

  const save = () => {
    if (!form.name.trim()) return
    if (editMode?.kind === 'new') {
      addAlias({ id: `a${Date.now()}`, name: form.name.trim(), cmd: form.cmd, args: form.args, permMode: form.permMode, status: 'ok' })
      setEditMode({ kind: 'edit', id: `a${Date.now() - 1}` })
    } else if (editMode?.kind === 'edit') {
      updateAlias(editMode.id, { name: form.name.trim(), cmd: form.cmd, args: form.args, permMode: form.permMode })
    }
  }

  const activeId = editMode?.kind === 'edit' ? editMode.id : null

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-0)' }}>
      {/* Titlebar */}
      <div style={{ height: 36, display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px', background: 'var(--bg-1)', borderBottom: '1px solid var(--line)', userSelect: 'none' }}>
        <div style={{ display: 'flex', gap: 7 }}>
          {['#3a3631', '#3a3631', '#3a3631'].map((c, i) => <span key={i} style={{ width: 11, height: 11, borderRadius: '50%', background: c }} />)}
        </div>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 11, color: 'var(--fg-2)' }}>Settings — Aliases</div>
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Sidebar nav */}
        <aside style={{ width: 200, background: 'var(--bg-1)', borderRight: '1px solid var(--line)', padding: '14px 0' }}>
          {NAV.map((label) => (
            <div key={label} style={{
              padding: '6px 16px', fontSize: 12, cursor: 'pointer',
              color: label === 'Aliases' ? 'var(--accent)' : 'var(--fg-1)',
              background: label === 'Aliases' ? 'var(--accent-soft)' : 'transparent',
              borderLeft: label === 'Aliases' ? '2px solid var(--accent)' : '2px solid transparent',
            }}>{label}</div>
          ))}
          <div style={{ margin: '24px 16px 0', height: 1, background: 'var(--line)' }} />
          <div onClick={() => setScreen('workspace')} style={{ padding: '8px 16px', fontSize: 12, color: 'var(--fg-2)', cursor: 'pointer', marginTop: 8 }}>← Back to workspace</div>
        </aside>

        {/* Main content */}
        <div style={{ flex: 1, padding: '20px 24px', overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--fg-0)' }}>Aliases</h2>
            <span style={{ flex: 1 }} />
            <button style={btnPrimary} onClick={openNew}><IPlus />New alias</button>
          </div>
          <p style={{ margin: '0 0 16px', color: 'var(--fg-2)', fontSize: 12, maxWidth: 540 }}>
            Aliases wrap a CLI agent with default arguments and a permission mode. Sessions launch with the alias of your choice.
          </p>

          {/* Table */}
          <div style={{ border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden', background: 'var(--bg-1)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '24px 150px 100px 1fr 130px 100px 50px', padding: '8px 12px', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.7, color: 'var(--fg-3)', borderBottom: '1px solid var(--line)', background: 'var(--bg-2)', gap: 10 }}>
              <span /><span>Name</span><span>Command</span><span>Arguments</span><span>Permission</span><span>Status</span><span />
            </div>
            {aliases.length === 0 && (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--fg-3)', fontSize: 12 }}>
                No aliases yet. Create one below.
              </div>
            )}
            {aliases.map((a, i) => (
              <div key={a.id} onClick={() => openEdit(a)} style={{ display: 'grid', gridTemplateColumns: '24px 150px 100px 1fr 130px 100px 50px', padding: '9px 12px', alignItems: 'center', fontSize: 11.5, borderBottom: i < aliases.length - 1 ? '1px solid var(--line)' : 'none', background: a.id === activeId ? 'var(--accent-soft)' : 'transparent', gap: 10, cursor: 'pointer' }}>
                <IDrag style={{ color: 'var(--fg-3)' }} />
                <span className="mono" style={{ color: a.id === activeId ? 'var(--accent)' : 'var(--fg-0)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {a.name}
                </span>
                <span className="mono" style={{ color: 'var(--fg-1)' }}>{a.cmd}</span>
                <span className="mono" style={{ color: 'var(--fg-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.args}</span>
                {a.permMode === 'normal' ? <Pill tone="ok" dot>ask each time</Pill> : <Pill tone="danger" dot>dangerous</Pill>}
                {a.status === 'ok' ? <Pill tone="ok" dot>ready</Pill> : <Pill tone="warn" dot>cli missing</Pill>}
                <div style={{ display: 'flex', gap: 8, color: 'var(--fg-3)' }}>
                  <IEdit style={{ cursor: 'pointer' }} onClick={(e: React.MouseEvent) => { e.stopPropagation(); openEdit(a) }} />
                  <ITrash style={{ cursor: 'pointer', color: 'var(--err)' }} onClick={(e: React.MouseEvent) => {
                    e.stopPropagation()
                    if (confirm(`Alias "${a.name}" löschen?`)) {
                      removeAlias(a.id)
                      if (activeId === a.id) setEditMode(aliases.length > 1 ? { kind: 'edit', id: aliases.find(x => x.id !== a.id)!.id } : { kind: 'new' })
                    }
                  }} />
                </div>
              </div>
            ))}
          </div>

          {/* Editor */}
          {editMode !== null && (
            <div style={{ marginTop: 22 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--fg-0)' }}>
                {editMode.kind === 'new'
                  ? 'New alias'
                  : <>Edit · <span className="mono" style={{ color: 'var(--accent)' }}>{form.name}</span></>
                }
              </h3>
              <div style={{ border: '1px solid var(--line)', borderRadius: 6, padding: 16, background: 'var(--bg-1)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={fieldLabel}>Display name</label>
                  <input style={fieldInput} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="claude-code" autoFocus={editMode.kind === 'new'} />
                </div>
                <div>
                  <label style={fieldLabel}>Binary / command</label>
                  <input style={fieldInput} value={form.cmd} onChange={e => setForm(f => ({ ...f, cmd: e.target.value }))} placeholder="/usr/local/bin/claude" />
                </div>
                <div style={{ gridColumn: '1 / span 2' }}>
                  <label style={fieldLabel}>Arguments</label>
                  <input style={fieldInput} value={form.args} onChange={e => setForm(f => ({ ...f, args: e.target.value }))} placeholder="--model sonnet-4.6 --output-format stream-json" />
                </div>
                <div>
                  <label style={fieldLabel}>Permission mode</label>
                  <select style={{ ...fieldInput, cursor: 'pointer' }} value={form.permMode} onChange={e => setForm(f => ({ ...f, permMode: e.target.value as PermMode }))}>
                    <option value="normal">ask each time</option>
                    <option value="dangerous">dangerous</option>
                  </select>
                </div>
                <div>
                  <label style={fieldLabel}>Working dir</label>
                  <select style={{ ...fieldInput, cursor: 'pointer' }}>
                    <option>$PROJECT_ROOT</option>
                    <option>$HOME</option>
                  </select>
                </div>
                <div style={{ gridColumn: '1 / span 2', display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
                  <span style={{ flex: 1 }} />
                  <button style={btnGhost} onClick={() => setEditMode(null)}>Cancel</button>
                  <button style={{ ...btnPrimary, opacity: !form.name.trim() ? 0.5 : 1 }} disabled={!form.name.trim()} onClick={save}>
                    {editMode.kind === 'new' ? 'Create alias' : 'Save changes'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
