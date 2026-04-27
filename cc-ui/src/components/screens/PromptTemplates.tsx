import React, { useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import type { Template } from '../../store/useAppStore'
import { IPlus, ISpark, ISearch, IClose, IEdit, ITrash } from '../primitives/Icons'
import { Pill } from '../primitives/Pill'
import { Kbd } from '../primitives/Kbd'

const TAGS = ['planning', 'safety', 'context', 'quality', 'review', 'debug', 'other']

const fieldLabel: React.CSSProperties = { display: 'block', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.7, color: 'var(--fg-3)', fontWeight: 500, marginBottom: 6 }
const fieldInput: React.CSSProperties = { width: '100%', padding: '7px 10px', border: '1px solid var(--line-strong)', borderRadius: 6, background: 'var(--bg-2)', color: 'var(--fg-0)', fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none', boxSizing: 'border-box' as const }
const btnPrimary: React.CSSProperties = { background: 'var(--accent)', color: '#1a1410', border: 'none', padding: '7px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)', display: 'flex', alignItems: 'center', gap: 6 }
const btnGhost: React.CSSProperties = { background: 'transparent', color: 'var(--fg-1)', border: '1px solid var(--line-strong)', padding: '7px 14px', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-ui)' }

type EditState = { kind: 'new' } | { kind: 'edit'; id: string } | null

const emptyForm = () => ({ name: '', hint: '', body: '', tag: 'planning' })

export function PromptTemplates() {
  const { templates, setScreen, addTemplate, updateTemplate } = useAppStore()
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<EditState>(null)
  const [form, setForm] = useState(emptyForm)

  const openNew = () => {
    setForm(emptyForm())
    setEditing({ kind: 'new' })
  }

  const openEdit = (t: Template) => {
    setForm({ name: t.name, hint: t.hint, body: t.body, tag: t.tag })
    setEditing({ kind: 'edit', id: t.id })
  }

  const save = () => {
    if (!form.name.trim() || !form.body.trim()) return
    if (editing?.kind === 'new') {
      addTemplate({ id: `tp${Date.now()}`, name: form.name.trim(), hint: form.hint, body: form.body.trim(), tag: form.tag, uses: 0 })
    } else if (editing?.kind === 'edit') {
      updateTemplate(editing.id, { name: form.name.trim(), hint: form.hint, body: form.body.trim(), tag: form.tag })
    }
    setEditing(null)
  }

  const filtered = templates.filter(t =>
    search === '' || t.name.toLowerCase().includes(search.toLowerCase()) || t.body.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-0)' }}>
      <div style={{ height: 36, display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px', background: 'var(--bg-1)', borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', gap: 7 }}>
          {['#3a3631', '#3a3631', '#3a3631'].map((c, i) => <span key={i} style={{ width: 11, height: 11, borderRadius: '50%', background: c }} />)}
        </div>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 11, color: 'var(--fg-2)' }}>Prompt templates</div>
        <button onClick={() => setScreen('workspace')} style={{ background: 'transparent', border: 'none', color: 'var(--fg-2)', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>← Back</button>
      </div>

      <div style={{ flex: 1, padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: 'var(--fg-0)' }}>Templates</h2>
          <Pill tone="neutral">{templates.length}</Pill>
          <span style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', border: '1px solid var(--line-strong)', borderRadius: 6, background: 'var(--bg-2)', width: 220 }}>
            <ISearch style={{ color: 'var(--fg-2)' }} />
            <input style={{ border: 'none', background: 'transparent', color: 'var(--fg-0)', fontSize: 12, outline: 'none', width: '100%' }} placeholder="Search templates…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button style={btnPrimary} onClick={openNew}><IPlus />New template</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, alignContent: 'start' }}>
          {filtered.map((t) => (
            <TemplateCard key={t.id} template={t} onEdit={() => openEdit(t)} />
          ))}
          <div
            onClick={openNew}
            style={{ padding: 14, borderRadius: 8, background: 'transparent', border: '1px dashed var(--line-strong)', display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', justifyContent: 'center', minHeight: 130, color: 'var(--fg-2)', cursor: 'pointer' }}
          >
            <IPlus />
            <span style={{ fontSize: 12 }}>New template</span>
          </div>
        </div>
      </div>

      {/* Editor modal */}
      {editing !== null && (
        <div onClick={() => setEditing(null)} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(8,7,5,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 540, maxWidth: '92vw', background: 'var(--bg-1)', border: '1px solid var(--line-strong)', borderRadius: 10, boxShadow: '0 24px 64px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
            <div style={{ height: 38, padding: '0 14px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--line)' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)' }}>{editing.kind === 'new' ? 'New template' : 'Edit template'}</span>
              <span style={{ flex: 1 }} />
              <IClose onClick={() => setEditing(null)} style={{ color: 'var(--fg-2)', cursor: 'pointer' }} />
            </div>
            <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={fieldLabel}>Name</label>
                  <input autoFocus style={fieldInput} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Analyze first" />
                </div>
                <div style={{ width: 90 }}>
                  <label style={fieldLabel}>Shortcut</label>
                  <input style={fieldInput} value={form.hint} onChange={e => setForm(f => ({ ...f, hint: e.target.value }))} placeholder="⌘1" />
                </div>
              </div>

              <div>
                <label style={fieldLabel}>Body</label>
                <textarea
                  style={{ ...fieldInput, resize: 'vertical', minHeight: 100, lineHeight: 1.55 }}
                  value={form.body}
                  onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                  placeholder="Before making any changes, analyze the relevant files and explain your plan…"
                />
              </div>

              <div>
                <label style={fieldLabel}>Tag</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {TAGS.map(tag => (
                    <button key={tag} onClick={() => setForm(f => ({ ...f, tag }))} style={{ padding: '3px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-ui)', border: `1px solid ${form.tag === tag ? 'var(--accent)' : 'var(--line-strong)'}`, background: form.tag === tag ? 'var(--accent-soft)' : 'var(--bg-2)', color: form.tag === tag ? 'var(--accent)' : 'var(--fg-1)' }}>
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
                <button style={btnGhost} onClick={() => setEditing(null)}>Cancel</button>
                <button style={{ ...btnPrimary, opacity: (!form.name.trim() || !form.body.trim()) ? 0.5 : 1 }} disabled={!form.name.trim() || !form.body.trim()} onClick={save}>
                  {editing.kind === 'new' ? 'Create template' : 'Save changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TemplateCard({ template: t, onEdit }: { template: Template; onEdit: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ padding: 14, borderRadius: 8, background: 'var(--bg-1)', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 8, cursor: 'pointer', minHeight: 130, position: 'relative' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <ISpark style={{ color: 'var(--accent)' }} />
        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--fg-0)' }}>{t.name}</span>
        <span style={{ flex: 1 }} />
        {t.hint && <Kbd>{t.hint}</Kbd>}
      </div>
      <div style={{ fontSize: 11, color: 'var(--fg-1)', lineHeight: 1.5, flex: 1 }}>{t.body}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--fg-3)' }}>
        <Pill tone="neutral">{t.tag}</Pill>
        <span style={{ flex: 1 }} />
        <span>{t.uses} uses</span>
      </div>
      {hovered && (
        <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 4 }}>
          <button onClick={e => { e.stopPropagation(); onEdit() }} style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 4, padding: '3px 6px', cursor: 'pointer', color: 'var(--fg-2)', display: 'flex', alignItems: 'center' }}><IEdit /></button>
        </div>
      )}
    </div>
  )
}
