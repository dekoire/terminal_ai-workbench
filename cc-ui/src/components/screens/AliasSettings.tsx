import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useAppStore, DEFAULT_AGENT_ROLES, CREW_TOOL_GROUPS } from '../../store/useAppStore'
import type { Alias, RepoToken, DocTemplate, AgentRole } from '../../store/useAppStore'
import { IPlus, IDrag, IEdit, ITrash, ISpark, ICheck, IBookmark, IGit, IStar, IMoon, IKeyboard, ICpu, IFileText, ICrew } from '../primitives/Icons'
import { Pill } from '../primitives/Pill'
import { ACCENT_PRESETS, TERMINAL_THEMES, applyPreset } from '../../theme/presets'
import type { AIProvider, TerminalShortcut } from '../../store/useAppStore'
import { useOpenRouterModels } from '../../utils/useOpenRouterModels'
import { MultiCombobox } from '../primitives/MultiCombobox'
import { SingleCombobox } from '../primitives/SingleCombobox'

// Predefined strength options for agent roles
const STRENGTH_OPTIONS = [
  { id: 'TypeScript',              label: 'TypeScript' },
  { id: 'React',                   label: 'React' },
  { id: 'Python',                  label: 'Python' },
  { id: 'SQL',                     label: 'SQL' },
  { id: 'APIs',                    label: 'APIs' },
  { id: 'Unit Tests',              label: 'Unit Tests' },
  { id: 'E2E Tests',               label: 'E2E Tests' },
  { id: 'Code Review',             label: 'Code Review' },
  { id: 'Implementierung',         label: 'Implementierung' },
  { id: 'Planung',                 label: 'Planung' },
  { id: 'Architektur',             label: 'Architektur' },
  { id: 'Technische Entscheidungen', label: 'Techn. Entscheidungen' },
  { id: 'Bugfixes',                label: 'Bugfixes' },
  { id: 'Debugging',               label: 'Debugging' },
  { id: 'Root-Cause-Analyse',      label: 'Root-Cause-Analyse' },
  { id: 'Refactoring',             label: 'Refactoring' },
  { id: 'Clean Code',              label: 'Clean Code' },
  { id: 'Performance',             label: 'Performance' },
  { id: 'Sicherheitsanalyse',      label: 'Sicherheitsanalyse' },
  { id: 'Vulnerabilities',         label: 'Vulnerabilities' },
  { id: 'OWASP',                   label: 'OWASP' },
  { id: 'Auth',                    label: 'Auth' },
  { id: 'CI/CD',                   label: 'CI/CD' },
  { id: 'Docker',                  label: 'Docker' },
  { id: 'Kubernetes',              label: 'Kubernetes' },
  { id: 'Deployment',              label: 'Deployment' },
  { id: 'Recherche',               label: 'Recherche' },
  { id: 'Analyse',                 label: 'Analyse' },
  { id: 'Dokumentation',           label: 'Dokumentation' },
  { id: 'Schema Design',           label: 'Schema Design' },
  { id: 'Migrations',              label: 'Migrations' },
  { id: 'UI/UX',                   label: 'UI/UX' },
  { id: 'CSS',                     label: 'CSS' },
  { id: 'Accessibility',           label: 'Accessibility' },
  { id: 'Microservices',           label: 'Microservices' },
  { id: 'Datenanalyse',            label: 'Datenanalyse' },
  { id: 'ML',                      label: 'ML / KI' },
]

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

const NAV = ['Aliases', 'GitHub Integration', 'Prompt templates', 'Aussehen', 'Terminal-Befehle', 'Large Language Models', 'Vorlagen', 'Agenten Team']

const NAV_DESC: Record<string, string> = {
  'Aliases':               'Agenten-Shortcuts & Befehle',
  'GitHub Integration':    'Repos, Tokens, Git-Anbindung',
  'Prompt templates':      'AI-Prompts & User Stories',
  'Aussehen':              'Themes, Schrift, Farben',
  'Terminal-Befehle':      'Tastenkürzel im Terminal',
  'Large Language Models': 'API-Keys & KI-Funktionen',
  'Vorlagen':              'Dok- & Story-Vorlagen',
  'Agenten Team':          'Rollen, Modelle, Crew-Setup',
}

const NAV_ICONS: Record<string, React.ReactNode> = {
  'Aliases':               <IBookmark style={{ width: 13, height: 13, flexShrink: 0 }} />,
  'GitHub Integration':    <IGit style={{ width: 13, height: 13, flexShrink: 0 }} />,
  'Prompt templates':      <IStar style={{ width: 13, height: 13, flexShrink: 0 }} />,
  'Aussehen':              <IMoon style={{ width: 13, height: 13, flexShrink: 0 }} />,
  'Terminal-Befehle':      <IKeyboard style={{ width: 13, height: 13, flexShrink: 0 }} />,
  'Large Language Models': <ICpu style={{ width: 13, height: 13, flexShrink: 0 }} />,
  'Vorlagen':              <IFileText style={{ width: 13, height: 13, flexShrink: 0 }} />,
  'Agenten Team':          <ICrew style={{ width: 13, height: 13, flexShrink: 0 }} />,
}

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

function TitlebarLogo() {
  return (
    <div style={{ height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 14px 0 88px', background: 'var(--bg-1)', borderBottom: '1px solid var(--line)', userSelect: 'none', WebkitAppRegion: 'drag' } as React.CSSProperties}>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)', pointerEvents: 'none' }}>Einstellungen</span>
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
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-0)', minHeight: 0, overflow: 'hidden' }}>
      {/* Titlebar */}
      <TitlebarLogo />

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Sidebar */}
        <aside style={{ width: 180, background: 'var(--bg-1)', borderRight: '1px solid var(--line)', padding: '12px 0', flexShrink: 0, overflowY: 'auto' }}>
          {NAV.map(label => (
            <div key={label} onClick={() => { setActiveNav(label); setEditMode(null) }} style={{
              padding: '5px 12px 5px 14px', cursor: 'pointer',
              background: label === activeNav ? 'var(--bg-2)' : 'transparent',
              borderLeft: label === activeNav ? '2px solid var(--accent)' : '2px solid transparent',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: label === activeNav ? 'var(--accent)' : 'var(--fg-3)' }}>
                {NAV_ICONS[label]}
                <span style={{ fontSize: 11.5, color: label === activeNav ? 'var(--fg-0)' : 'var(--fg-1)', fontWeight: label === activeNav ? 600 : 400 }}>{label}</span>
              </div>
              <div style={{ fontSize: 9.5, color: 'var(--fg-3)', marginTop: 1, paddingLeft: 19 }}>{NAV_DESC[label]}</div>
            </div>
          ))}
          <div style={{ margin: '16px 16px 0', height: 1, background: 'var(--line)' }} />
          <div onClick={() => setScreen('workspace')} style={{ padding: '8px 16px', fontSize: 12, color: 'var(--fg-3)', cursor: 'pointer', marginTop: 4 }}>← Back</div>
        </aside>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
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
          {activeNav === 'GitHub Integration' && <TokensPanel />}
          {activeNav === 'Prompt templates'  && <TemplatesPanel />}
          {activeNav === 'Darstellung'        && <AppearancePanel />}
          {activeNav === 'Aussehen'           && <AussehenpPanel />}
          {activeNav === 'Terminal-Befehle'   && <TerminalCommandsPanel />}
          {activeNav === 'Large Language Models' && <AIPanel />}
          {activeNav === 'Vorlagen'           && <DocTemplatesPanel />}
          {activeNav === 'Agenten Team'       && <AgentTeamPanel />}
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

type AussehTab = 'themes' | 'terminal'

function AussehenpPanel() {
  const [tab, setTab] = useState<AussehTab>('themes')
  const {
    accent: _ac, accentFg: _afg, preset: _pr,
    terminalTheme: _tt, uiFont: _uf, uiFontSize: _ufs,
    terminalFontFamily: _tff, terminalFontSize: _tfs,
    setAccent, setAccentFg, setPreset, setTerminalTheme,
    setUiFont, setUiFontSize, setTheme,
    setTerminalFontFamily, setTerminalFontSize,
    customTerminalColors, setCustomTerminalColor, resetCustomTerminalColors,
    customUiColors, setCustomUiColor, resetCustomUiColors,
  } = useAppStore()

  const accent           = _ac ?? '#ff8a5b'
  const accentFg         = _afg ?? '#1a1410'
  const preset           = _pr ?? 'ember'
  const terminalTheme    = _tt ?? 'default'
  const uiFont           = _uf ?? 'system'
  const uiFontSize       = _ufs ?? 13
  const terminalFontFamily = _tff ?? 'jetbrains'
  const terminalFontSize   = _tfs ?? 13

  const applyFull = (p: typeof ACCENT_PRESETS[0]) => {
    setPreset(p.id); setAccent(p.accent); setAccentFg(p.accentFg)
    setTheme(p.dark ? 'dark' : 'light'); applyPreset(p, p.accent, p.accentFg)
  }

  const tabStyle = (t: AussehTab): React.CSSProperties => ({
    padding: '5px 14px', borderRadius: 6, fontSize: 11.5, fontFamily: 'var(--font-ui)',
    border: 'none', cursor: 'pointer',
    background: tab === t ? 'var(--accent-soft)' : 'transparent',
    color: tab === t ? 'var(--accent)' : 'var(--fg-2)',
    fontWeight: tab === t ? 600 : 400,
  })

  return (
    <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Inner tab bar */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ display: 'flex', gap: 2, padding: '3px', background: 'var(--bg-2)', borderRadius: 8, border: '1px solid var(--line)' }}>
          <button style={tabStyle('themes')}   onClick={() => setTab('themes')}>Themes</button>
          <button style={tabStyle('terminal')} onClick={() => setTab('terminal')}>Terminal</button>
        </div>
      </div>

      {/* ── Themes ── */}
      {tab === 'themes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <PresetGroup label="Dark"  presets={ACCENT_PRESETS.filter(p => p.dark)}  activeId={preset} onApply={applyFull} />
          <PresetGroup label="Light" presets={ACCENT_PRESETS.filter(p => !p.dark)} activeId={preset} onApply={applyFull} />

          {/* UI Font */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--fg-3)', fontWeight: 600, marginBottom: 4 }}>UI Schrift</div>
              <SingleCombobox
                value={uiFont}
                onChange={setUiFont}
                options={UI_FONTS.map(f => ({ value: f.id, label: f.label }))}
                placeholder="Schrift wählen…"
              />
            </div>
            <div>
              <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--fg-3)', fontWeight: 600, marginBottom: 4 }}>Schriftgröße (px)</div>
              <input
                type="number" min={10} max={20} value={uiFontSize}
                onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 10 && v <= 20) setUiFontSize(v) }}
                style={{ width: '100%', padding: '6px 10px', border: '1px solid var(--line-strong)', borderRadius: 6, background: 'var(--bg-2)', color: 'var(--fg-0)', fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none', boxSizing: 'border-box' as const }}
              />
            </div>
          </div>

          <section>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--fg-3)', fontWeight: 600 }}>Individuelle UI-Farben</span>
              <button onClick={resetCustomUiColors} style={{ background: 'none', border: 'none', fontSize: 10, color: 'var(--fg-3)', cursor: 'pointer', fontFamily: 'var(--font-ui)', padding: 0 }}>Zurücksetzen</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
              {[
                { label: 'Akzent', hint: '--accent', key: '--accent', fallback: '#d96a3a', extra: (v: string) => { setAccent(v) } },
                { label: 'Text auf Akzent', hint: '--accent-fg', key: '--accent-fg', fallback: '#fff8f4', extra: (v: string) => { setAccentFg(v) } },
                { label: 'Hintergrund', hint: '--bg-0', key: '--bg-0', fallback: '#faf8f4' },
                { label: 'Sidebar', hint: '--bg-1', key: '--bg-1', fallback: '#f3efe7' },
                { label: 'Karten / Felder', hint: '--bg-2', key: '--bg-2', fallback: '#ece7dc' },
                { label: 'Trennlinien', hint: '--line-strong', key: '--line-strong', fallback: '#c8c0ad' },
                { label: 'Text primär', hint: '--fg-0', key: '--fg-0', fallback: '#1c1814' },
                { label: 'Text sekundär', hint: '--fg-2', key: '--fg-2', fallback: '#7a7368' },
                { label: 'Erfolg / OK', hint: '--ok', key: '--ok', fallback: '#3d9b6c' },
              ].map(({ label, hint, key, fallback, extra }) => (
                <ColorRow key={key} label={label} hint={hint}
                  value={customUiColors[key] || getComputedStyle(document.documentElement).getPropertyValue(key).trim() || fallback}
                  onChange={v => { setCustomUiColor(key, v); document.documentElement.style.setProperty(key, v); extra?.(v) }} />
              ))}
            </div>
          </section>
        </div>
      )}

      {/* ── Terminal ── */}
      {tab === 'terminal' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Terminal Font */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--fg-3)', fontWeight: 600, marginBottom: 4 }}>Terminal Schrift</div>
              <SingleCombobox
                value={terminalFontFamily}
                onChange={setTerminalFontFamily}
                options={TERMINAL_FONTS.map(f => ({ value: f.id, label: f.label, desc: f.sample }))}
                placeholder="Schrift wählen…"
              />
            </div>
            <div>
              <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--fg-3)', fontWeight: 600, marginBottom: 4 }}>Schriftgröße (px)</div>
              <input
                type="number" min={8} max={24} value={terminalFontSize}
                onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 8 && v <= 24) setTerminalFontSize(v) }}
                style={{ width: '100%', padding: '6px 10px', border: '1px solid var(--line-strong)', borderRadius: 6, background: 'var(--bg-2)', color: 'var(--fg-0)', fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none', boxSizing: 'border-box' as const }}
              />
            </div>
          </div>

          <section>
            <SectionLabel>Terminal Farbschema</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 5 }}>
              {TERMINAL_THEMES.map(t => (
                <TerminalCard key={t.id} theme={t} active={terminalTheme === t.id} onApply={() => setTerminalTheme(t.id)} />
              ))}
            </div>
            <p style={{ marginTop: 5, fontSize: 10, color: 'var(--fg-3)' }}>Gilt für neue Terminal-Sessions.</p>
          </section>

          <section>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--fg-3)', fontWeight: 600 }}>Individuelle Terminal-Farben</span>
              <button onClick={resetCustomTerminalColors} style={{ background: 'none', border: 'none', fontSize: 10, color: 'var(--fg-3)', cursor: 'pointer', fontFamily: 'var(--font-ui)', padding: 0 }}>Zurücksetzen</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 7, marginBottom: 10 }}>
              {[
                { label: 'Hintergrund', key: 'background', fallback: '#0e0d0b' },
                { label: 'Text / Vordergrund', key: 'foreground', fallback: '#c9c0b3' },
                { label: 'Cursor', key: 'cursor', fallback: '#ff8a5b' },
                { label: 'Selektion', key: 'selectionBackground', fallback: '#ff8a5b44' },
              ].map(({ label, key, fallback }) => (
                <ColorRow key={key} label={label} hint={`terminal.${key}`}
                  value={customTerminalColors[key] || fallback}
                  onChange={v => setCustomTerminalColor(key, v)} />
              ))}
            </div>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--fg-3)', fontWeight: 600, marginBottom: 6 }}>ANSI Farben</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5 }}>
              {[
                { label: 'Schwarz', key: 'black', fallback: '#1a1a1a' },
                { label: 'Rot', key: 'red', fallback: '#ef7a7a' },
                { label: 'Grün', key: 'green', fallback: '#7cd9a8' },
                { label: 'Gelb', key: 'yellow', fallback: '#f4c365' },
                { label: 'Blau', key: 'blue', fallback: '#6ea8d8' },
                { label: 'Magenta', key: 'magenta', fallback: '#c09fd8' },
                { label: 'Cyan', key: 'cyan', fallback: '#7dd0c8' },
                { label: 'Weiß', key: 'white', fallback: '#c9c0b3' },
                { label: 'H-Schwarz', key: 'brightBlack', fallback: '#5e5950' },
                { label: 'H-Rot', key: 'brightRed', fallback: '#f4a0a0' },
                { label: 'H-Grün', key: 'brightGreen', fallback: '#a0e8c0' },
                { label: 'H-Gelb', key: 'brightYellow', fallback: '#f8d88c' },
                { label: 'H-Blau', key: 'brightBlue', fallback: '#96c0e8' },
                { label: 'H-Magenta', key: 'brightMagenta', fallback: '#d4b8e8' },
                { label: 'H-Cyan', key: 'brightCyan', fallback: '#a0e0d8' },
                { label: 'H-Weiß', key: 'brightWhite', fallback: '#f3ece2' },
              ].map(({ label, key, fallback }) => (
                <ColorRow key={key} label={label} hint={key}
                  value={customTerminalColors[key] || fallback}
                  onChange={v => setCustomTerminalColor(key, v)} />
              ))}
            </div>
          </section>
        </div>
      )}
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
    <div style={{ padding: '14px 18px' }}>
      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)', marginBottom: 2 }}>Terminal-Befehle</div>
          <div style={{ color: 'var(--fg-3)', fontSize: 11 }}>
            Tastenkürzel im Eingabefeld.&nbsp;
            <span style={{ color: 'var(--accent)' }}>{enabledCount} / {terminalShortcuts.length} aktiv</span>
          </div>
        </div>
        <button onClick={resetTerminalShortcuts} style={{ ...btnGhost, fontSize: 10.5, padding: '4px 10px', flexShrink: 0 }}>
          Zurücksetzen
        </button>
      </div>

      {/* Shortcut groups */}
      {categories.map(cat => {
        const items = terminalShortcuts.filter(s => s.category === cat)
        if (!items.length) return null
        return (
          <section key={cat} style={{ marginBottom: 14 }}>
            <SectionLabel>{SHORTCUT_CATEGORY_LABELS[cat]}</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {items.map(sc => (
                <ShortcutRow key={sc.id} sc={sc} onToggle={() => updateTerminalShortcut(sc.id, { enabled: !sc.enabled })} />
              ))}
            </div>
          </section>
        )
      })}

      {/* Info box */}
      <div style={{ padding: '8px 12px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6, fontSize: 10.5, color: 'var(--fg-3)', lineHeight: 1.55 }}>
        <div style={{ fontWeight: 600, color: 'var(--fg-2)', marginBottom: 3 }}>Hinweise</div>
        <div>• <b>Tab</b> sendet Autovervollständigungs-Signal</div>
        <div>• <b>↑ / ↓</b> navigiert History wenn Eingabefeld leer</div>
        <div>• <b>Ctrl-Kürzel</b> werden als Steuerzeichen ans Terminal gesendet</div>
        <div>• <b>Enter</b> sendet, <b>Shift+Enter</b> neue Zeile</div>
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
        display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px', borderRadius: 5,
        background: hov ? 'var(--bg-3)' : 'transparent',
        transition: 'background 0.12s',
      }}
    >
      {/* Key badge */}
      <span style={{
        minWidth: 60, fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
        color: sc.enabled ? 'var(--accent)' : 'var(--fg-3)',
        background: sc.enabled ? 'var(--accent-soft)' : 'var(--bg-3)',
        border: `1px solid ${sc.enabled ? 'var(--accent-line)' : 'var(--line)'}`,
        borderRadius: 4, padding: '2px 7px', textAlign: 'center', flexShrink: 0,
        transition: 'all 0.15s',
      }}>
        {sc.label}
      </span>
      {/* Description */}
      <span style={{ flex: 1, fontSize: 11.5, color: sc.enabled ? 'var(--fg-1)' : 'var(--fg-3)' }}>
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
    <section style={{ marginBottom: 8 }}>
      <SectionLabel>{label}</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(82px, 1fr))', gap: 5 }}>
        {presets.map(p => <PresetCard key={p.id} preset={p} active={activeId === p.id} onApply={() => onApply(p)} />)}
      </div>
    </section>
  )
}

// PresetCard — square with name overlay
function PresetCard({ preset, active, onApply }: { preset: typeof ACCENT_PRESETS[0]; active: boolean; onApply: () => void }) {
  const isDark = preset.dark
  const textColor = isDark ? '#c9c0b3' : '#4a443c'
  const dimColor  = isDark ? '#5e5950' : '#a09889'
  const mainBg    = isDark ? '#0e0d0b' : '#faf8f4'

  return (
    <div onClick={onApply} style={{
      border: `2px solid ${active ? preset.accent : 'var(--line-strong)'}`,
      borderRadius: 6, overflow: 'hidden', cursor: 'pointer', position: 'relative',
      aspectRatio: '4/3',
      boxShadow: active ? `0 0 0 2px ${preset.accent}44` : 'none',
      transition: 'border-color 0.15s',
    }}>
      <div style={{ background: mainBg, padding: 4, display: 'flex', gap: 3, height: '100%', boxSizing: 'border-box' }}>
        <div style={{ width: 14, background: preset.sidebarBg, borderRadius: 2, padding: '3px 2px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ height: 1.5, borderRadius: 1, background: preset.accent, width: '90%' }} />
          <div style={{ height: 1.5, borderRadius: 1, background: dimColor, width: '70%' }} />
          <div style={{ height: 1.5, borderRadius: 1, background: dimColor, width: '55%' }} />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 1 }}>
          <div style={{ height: 1.5, borderRadius: 1, background: textColor, width: '75%' }} />
          <div style={{ height: 1.5, borderRadius: 1, background: dimColor, width: '50%' }} />
          <div style={{ marginTop: 2, background: preset.sidebarBg2, borderRadius: 1.5, padding: '2px 3px', display: 'flex', alignItems: 'center', gap: 2 }}>
            <div style={{ flex: 1, height: 1, background: dimColor, borderRadius: 1 }} />
            <div style={{ width: 8, height: 4, background: preset.accent, borderRadius: 1 }} />
          </div>
        </div>
      </div>
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: preset.sidebarBg + 'cc',
        padding: '2px 5px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 9, fontWeight: 600, color: textColor }}>{preset.name}</span>
        {active && <span style={{ width: 4, height: 4, borderRadius: '50%', background: preset.accent, flexShrink: 0 }} />}
      </div>
    </div>
  )
}

function TerminalCard({ theme, active, onApply }: { theme: typeof TERMINAL_THEMES[0]; active: boolean; onApply: () => void }) {
  const t = theme.theme
  return (
    <div onClick={onApply} style={{
      border: `2px solid ${active ? 'var(--accent)' : 'var(--line-strong)'}`,
      borderRadius: 6, overflow: 'hidden', cursor: 'pointer', position: 'relative',
      aspectRatio: '4/3',
      boxShadow: active ? '0 0 0 2px var(--accent-soft)' : 'none',
      transition: 'border-color 0.15s',
    }}>
      <div style={{ background: t.background, padding: '5px 6px', fontFamily: 'var(--font-mono)', fontSize: 8, lineHeight: 1.4, height: '100%', boxSizing: 'border-box' }}>
        <div><span style={{ color: t.green }}>✓ </span><span style={{ color: t.foreground }}>claude</span></div>
        <div style={{ display: 'flex', gap: 2, marginTop: 4 }}>
          {[t.red, t.green, t.yellow, t.blue, t.magenta, t.cyan].map((c, i) => (
            <div key={i} style={{ width: 7, height: 7, borderRadius: 2, background: c }} />
          ))}
        </div>
      </div>
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: t.background + 'dd', borderTop: `1px solid rgba(128,128,128,0.15)`,
        padding: '2px 5px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 9, fontWeight: 600, color: t.foreground }}>{theme.name}</span>
        {active && <span style={{ width: 4, height: 4, borderRadius: '50%', background: t.cursor }} />}
      </div>
    </div>
  )
}

function ColorRow({ label, hint, value, onChange }: { label: string; hint: string; value: string; onChange: (v: string) => void }) {
  const colorRef = useRef<HTMLInputElement>(null)
  const [hex, setHex] = useState(value)
  useEffect(() => { setHex(value) }, [value])
  const commit = (v: string) => { setHex(v); if (/^#[0-9a-fA-F]{6}$/.test(v)) onChange(v) }
  return (
    <div>
      <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--fg-3)', marginBottom: 2 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, border: '1px solid var(--line-strong)', borderRadius: 5, background: 'var(--bg-2)', padding: '4px 7px', position: 'relative' }}>
        <input value={hex} onChange={e => commit(e.target.value)}
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--fg-0)', fontSize: 10.5, fontFamily: 'var(--font-mono)' }}
          placeholder="#ff8a5b" maxLength={7} />
        <div onClick={() => colorRef.current?.click()}
          style={{ width: 16, height: 16, borderRadius: 3, background: value, border: '1px solid var(--line)', flexShrink: 0, cursor: 'pointer' }} />
        <input ref={colorRef} type="color" value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : '#888888'}
          onChange={e => commit(e.target.value)}
          style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }} />
      </div>
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

const CREW_TITLE_MODELS = [
  { value: 'deepseek/deepseek-chat',              label: 'DeepSeek V3 (Standard)', desc: 'Günstig & schnell' },
  { value: 'deepseek/deepseek-r1',                label: 'DeepSeek R1',            desc: 'Reasoning' },
  { value: 'anthropic/claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5',       desc: 'Sehr schnell' },
  { value: 'openai/gpt-4o-mini',                  label: 'GPT-4o mini',            desc: 'Günstig' },
  { value: 'google/gemini-2.5-flash-preview',     label: 'Gemini 2.5 Flash',       desc: 'Schnell' },
]

type AITab = 'keys' | 'functions'

function AIPanel() {
  const { aiProviders, activeAiProvider, addAiProvider, updateAiProvider, removeAiProvider, setActiveAiProvider, aiFunctionMap, setAiFunctionMap, crewRunTitleModel, setCrewRunTitleModel, openrouterKey, setOpenrouterKey } = useAppStore()
  const [activeTab, setActiveTab] = useState<AITab>('keys')
  const [editId, setEditId]   = useState<string | null>(null)
  const [adding, setAdding]   = useState(false)
  const [showKeys, setShowKeys] = useState<Set<string>>(new Set())
  const [editingOrKey, setEditingOrKey] = useState(false)
  const [orKeyDraft, setOrKeyDraft]     = useState(openrouterKey)
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

  const tabStyle = (t: AITab): React.CSSProperties => ({
    padding: '5px 20px', border: 'none', borderRadius: 5, fontSize: 11.5, cursor: 'pointer',
    fontFamily: 'inherit', fontWeight: activeTab === t ? 600 : 400,
    background: activeTab === t ? 'var(--bg-0)' : 'transparent',
    color: activeTab === t ? 'var(--fg-0)' : 'var(--fg-3)',
    boxShadow: activeTab === t ? '0 1px 4px rgba(0,0,0,0.3)' : 'none',
    transition: 'all 0.15s',
  })

  const readonlyField: React.CSSProperties = {
    padding: '5px 10px', background: 'var(--bg-2)', border: '1px solid var(--line)',
    borderRadius: 5, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)',
    userSelect: 'all' as const,
  }

  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Centered tab bar */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ display: 'flex', gap: 2, padding: 3, background: 'var(--bg-2)', borderRadius: 7, border: '1px solid var(--line)' }}>
          <button style={tabStyle('keys')}      onClick={() => setActiveTab('keys')}>API-Keys</button>
          <button style={tabStyle('functions')} onClick={() => setActiveTab('functions')}>KI-Funktionen</button>
        </div>
      </div>

      {/* ── Tab 1: API-Keys ─────────────────────────────────────────────── */}
      {activeTab === 'keys' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* OpenRouter */}
          <section style={{ border: '1px solid var(--line-strong)', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', background: 'var(--bg-2)', borderBottom: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <ISpark style={{ color: 'var(--accent)', width: 13, height: 13 }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)' }}>OpenRouter</span>
                <span style={{ flex: 1 }} />
                {!editingOrKey && (
                  <button onClick={() => { setEditingOrKey(true); setOrKeyDraft(openrouterKey) }}
                    style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-ui)', padding: 0 }}>
                    {openrouterKey ? 'Ändern' : 'Hinterlegen'}
                  </button>
                )}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--fg-3)', lineHeight: 1.45 }}>
                KI-Plattform mit 300+ Modellen über eine einzige API — empfohlen für Agenten-Crew &amp; Modell-Browser.
              </div>
            </div>
            <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* API Key */}
              {editingOrKey ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--fg-3)', fontWeight: 600 }}>API Key</div>
                  <input style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--line-strong)', borderRadius: 6, background: 'var(--bg-2)', color: 'var(--fg-0)', fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none', boxSizing: 'border-box' }} type="password" value={orKeyDraft} onChange={e => setOrKeyDraft(e.target.value)} placeholder="sk-or-v1-..." autoFocus />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => { setOpenrouterKey(orKeyDraft); setEditingOrKey(false) }} style={btnPrimary}>Speichern</button>
                    <button onClick={() => setEditingOrKey(false)} style={btnGhost}>Abbrechen</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--bg-2)', borderRadius: 6, border: '1px solid var(--line)' }}>
                  {openrouterKey
                    ? <><ICheck style={{ color: 'var(--ok)', flexShrink: 0, width: 13, height: 13 }} /><span className="mono" style={{ fontSize: 11, color: 'var(--fg-2)' }}>{openrouterKey.slice(0, 12)}···</span></>
                    : <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>Kein Key — für Crew &amp; Modell-Browser benötigt</span>
                  }
                </div>
              )}
              {/* Read-only metadata */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 2 }}>
                {[
                  { label: 'Endpunkt', value: 'https://openrouter.ai/api/v1' },
                  { label: 'Protokoll', value: 'OpenAI-kompatibel (REST)' },
                  { label: 'Modell-Katalog', value: 'openrouter.ai/models' },
                  { label: 'Abrechnung', value: 'Pay-per-Token, pro Modell' },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--fg-3)', marginBottom: 2 }}>{label}</div>
                    <div style={readonlyField}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Direct API Keys */}
          <section style={{ border: '1px solid var(--line-strong)', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', background: 'var(--bg-2)', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)', marginBottom: 2 }}>Direkte Hersteller-Keys</div>
                <div style={{ fontSize: 10.5, color: 'var(--fg-3)', lineHeight: 1.45 }}>
                  API-Keys direkt vom LLM-Anbieter (OpenAI, Anthropic, DeepSeek) — Alternative zu OpenRouter für einzelne Anbieter. Wird für KI-Textüberarbeitung im Editor genutzt.
                </div>
              </div>
              <button style={{ ...btnPrimary, flexShrink: 0 }} onClick={openAdd}><IPlus />Hinzufügen</button>
            </div>
            <div style={{ padding: '10px 14px' }}>
              {aiProviders.length === 0 && !adding && (
                <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--fg-3)', fontSize: 11, border: '1px dashed var(--line)', borderRadius: 6 }}>
                  Noch kein Anbieter konfiguriert.
                </div>
              )}
              {aiProviders.length > 0 && (
                <div style={{ border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden', background: 'var(--bg-1)', marginBottom: adding || editId ? 12 : 0 }}>
                  {aiProviders.map((p, i) => (
                    <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '14px 1fr 110px 1fr 52px', padding: '8px 12px', alignItems: 'center', gap: 10, fontSize: 11.5, borderBottom: i < aiProviders.length - 1 ? '1px solid var(--line)' : 'none', background: p.id === editId ? 'var(--accent-soft)' : 'transparent' }}>
                      <span title={p.id === activeAiProvider ? 'Aktiv' : 'Als aktiv setzen'} onClick={() => setActiveAiProvider(p.id)}
                        style={{ width: 9, height: 9, borderRadius: '50%', background: p.id === activeAiProvider ? 'var(--accent)' : 'var(--bg-4)', border: '1px solid var(--line-strong)', cursor: 'pointer', flexShrink: 0 }} />
                      <span style={{ fontWeight: 600, color: 'var(--fg-0)' }}>{p.name}</span>
                      <span style={{ fontSize: 10, color: 'var(--fg-3)', background: 'var(--bg-3)', borderRadius: 4, padding: '2px 6px', textAlign: 'center' }}>{PROVIDER_DEFAULTS[p.provider]?.label ?? p.provider}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span className="mono" style={{ fontSize: 10, color: 'var(--fg-3)' }}>{showKeys.has(p.id) ? p.apiKey : mask(p.apiKey)}</span>
                        <button onClick={() => toggleShow(p.id)} style={{ background: 'none', border: 'none', color: 'var(--fg-3)', cursor: 'pointer', fontSize: 9.5, padding: '1px 3px', fontFamily: 'inherit' }}>{showKeys.has(p.id) ? 'hide' : 'show'}</button>
                      </div>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <IEdit style={{ color: 'var(--fg-3)', cursor: 'pointer' }} onClick={() => openEdit(p)} />
                        <ITrash style={{ color: 'var(--err)', cursor: 'pointer' }} onClick={() => { if (confirm(`"${p.name}" löschen?`)) removeAiProvider(p.id) }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {(adding || editId) && (
                <div style={{ border: '1px solid var(--line)', borderRadius: 6, padding: 14, background: 'var(--bg-1)' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)', marginBottom: 12 }}>{adding ? 'Anbieter hinzufügen' : 'Anbieter bearbeiten'}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={fieldLabel}>Name</label>
                      <input style={fieldInput} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Mein ChatGPT" autoFocus />
                    </div>
                    <div>
                      <label style={fieldLabel}>Anbieter</label>
                      <select value={form.provider} onChange={e => { const pr = e.target.value as AIProvider['provider']; setForm(f => ({ ...f, provider: pr, model: PROVIDER_DEFAULTS[pr]?.model ?? '' })) }} style={{ ...fieldInput, cursor: 'pointer' }}>
                        <option value="openai">OpenAI (ChatGPT)</option>
                        <option value="anthropic">Anthropic (Claude)</option>
                        <option value="deepseek">DeepSeek</option>
                      </select>
                    </div>
                    <div style={{ gridColumn: '1 / span 2' }}>
                      <label style={fieldLabel}>API Key — <a href={PROVIDER_DEFAULTS[form.provider]?.docUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Key holen ↗</a></label>
                      <input style={fieldInput} type="password" value={form.apiKey} onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))} placeholder={PROVIDER_DEFAULTS[form.provider]?.placeholder ?? 'sk-…'} autoComplete="new-password" />
                    </div>
                    <div style={{ gridColumn: '1 / span 2' }}>
                      <label style={fieldLabel}>Modell</label>
                      <input style={fieldInput} value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} placeholder={PROVIDER_DEFAULTS[form.provider]?.model} />
                    </div>
                    <div style={{ gridColumn: '1 / span 2', display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 2 }}>
                      <button style={btnGhost} onClick={cancel}>Abbrechen</button>
                      <button style={{ ...btnPrimary, opacity: (!form.name.trim() || !form.apiKey.trim()) ? 0.5 : 1 }} disabled={!form.name.trim() || !form.apiKey.trim()} onClick={save}>
                        {adding ? 'Speichern' : 'Aktualisieren'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {/* ── Tab 2: KI-Funktionen ────────────────────────────────────────── */}
      {activeTab === 'functions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Function assignment */}
          <section>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)', marginBottom: 3 }}>Funktionszuweisung</div>
            <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginBottom: 10, lineHeight: 1.45 }}>Welcher Anbieter oder welches Modell soll für welche interne Funktion verwendet werden?</div>
            <div style={{ border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden', background: 'var(--bg-1)' }}>
              {/* Agenten Team Titel */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, padding: '10px 14px', alignItems: 'center', borderBottom: '1px solid var(--line)' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)' }}>Agenten Team Titel</div>
                  <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginTop: 2 }}>OpenRouter-Modell für die Titelgenerierung in der Agenten Team Historie</div>
                </div>
                <SingleCombobox value={crewRunTitleModel} onChange={setCrewRunTitleModel} options={CREW_TITLE_MODELS} maxHeight={220} placeholder="Modell wählen…" />
              </div>
              {/* Direct provider functions */}
              {aiProviders.length === 0 ? (
                <div style={{ padding: '12px 14px', color: 'var(--fg-3)', fontSize: 10.5, fontStyle: 'italic' }}>
                  Hersteller-Keys → „API-Keys" hinzufügen um weitere Funktionen zuzuweisen.
                </div>
              ) : (
                AI_FUNCTIONS.map((fn, i) => {
                  const selected = aiFunctionMap[fn.key] || activeAiProvider || aiProviders[0]?.id || ''
                  return (
                    <div key={fn.key} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, padding: '10px 14px', alignItems: 'center', borderBottom: i < AI_FUNCTIONS.length - 1 ? '1px solid var(--line)' : 'none' }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)' }}>{fn.label}</div>
                        <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginTop: 2 }}>{fn.description}</div>
                      </div>
                      <SingleCombobox value={selected} onChange={v => setAiFunctionMap(fn.key, v)} options={aiProviders.map(p => ({ value: p.id, label: p.name, desc: p.model }))} placeholder="Anbieter wählen…" />
                    </div>
                  )
                })
              )}
            </div>
          </section>

          <div style={{ padding: '10px 12px', background: 'var(--bg-2)', borderRadius: 6, border: '1px solid var(--line)', fontSize: 10.5, color: 'var(--fg-3)', lineHeight: 1.55 }}>
            <strong style={{ color: 'var(--fg-1)' }}>Hinweis:</strong> Klicke im Terminal-Eingabefeld auf <span style={{ fontWeight: 600, color: 'var(--accent)' }}>✦ KI</span> um Text automatisch zu überarbeiten. Keys werden lokal in <span className="mono">~/.cc-ui-data.json</span> gespeichert.
          </div>
        </div>
      )}
    </div>
  )
}

// ── Vorlagen Panel (Doc Templates + AI Prompts + User Stories) ───────────────

type VorlagenTab = 'docs' | 'prompts'

// Where each built-in template is actively used — shown in the list as a usage badge
const TEMPLATE_USAGE: Record<string, { screen: string; element: string }> = {
  'ai-prompt-doc-update':        { screen: 'Workspace',  element: 'Docs-Button (neben Play ▶)' },
  'ai-prompt-text-refine':       { screen: 'Workspace',  element: 'AI ✦ im Eingabefeld (Terminal)' },
  'ai-prompt-user-story-format': { screen: 'Kanban',     element: 'AI-Button „Als User Story"' },
  'ai-prompt-start-detect':      { screen: 'Workspace',  element: 'Play ▶ → AI erkennt Start-Befehl' },
  'user-story-analyse':          { screen: 'Kanban',     element: 'AI-Button „Mit Docs analysieren" ⚡' },
}

const VORLAGEN_TABS: { key: VorlagenTab; label: string; hint: string; pathLabel: string; contentLabel: string; pathPlaceholder: string; contentPlaceholder: string; needsPath: boolean; defaultCategory: string }[] = [
  { key: 'docs',    label: 'Dokumentationen', hint: 'Dateien die beim Erstellen eines Projekts angelegt werden.',         pathLabel: 'Pfad im Projekt', contentLabel: 'Inhalt (Markdown)', pathPlaceholder: 'z.B. Docs/RULES.md', contentPlaceholder: '# Regeln\n…',                     needsPath: true,  defaultCategory: 'doc' },
  { key: 'prompts', label: 'System Prompts',  hint: 'System-Prompts für AI-Funktionen sowie User-Story-Vorlagen im Kanban.', pathLabel: 'Kürzel / Label',  contentLabel: 'System-Prompt',    pathPlaceholder: 'z.B. formal-de',    contentPlaceholder: 'Du bist ein professioneller Texter…', needsPath: false, defaultCategory: 'ai-prompt' },
]

function DocTemplatesPanel() {
  const { docTemplates, addDocTemplate, updateDocTemplate, removeDocTemplate } = useAppStore()
  const [activeTab, setActiveTab] = useState<VorlagenTab>('docs')
  const [editId, setEditId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const tabCfg = VORLAGEN_TABS.find(t => t.key === activeTab)!
  const emptyForm = (): Omit<DocTemplate, 'id'> => ({ name: '', relativePath: '', content: '', enabled: true, category: tabCfg.defaultCategory as DocTemplate['category'] })
  const [form, setForm] = useState<Omit<DocTemplate, 'id'>>(emptyForm())

  const filtered = activeTab === 'docs'
    ? docTemplates.filter(t => (t.category ?? 'doc') === 'doc')
    : docTemplates.filter(t => t.category === 'ai-prompt' || t.category === 'user-story')

  const tabCount = (tab: VorlagenTab) => tab === 'docs'
    ? docTemplates.filter(t => (t.category ?? 'doc') === 'doc').length
    : docTemplates.filter(t => t.category === 'ai-prompt' || t.category === 'user-story').length

  const switchTab = (tab: VorlagenTab) => { setActiveTab(tab); cancel() }
  const openAdd  = () => { setAdding(true); setEditId(null); setForm(emptyForm()) }
  const openEdit = (t: DocTemplate) => { setEditId(t.id); setAdding(false); setForm({ name: t.name, relativePath: t.relativePath, content: t.content, enabled: t.enabled, category: t.category ?? 'doc' }) }
  const cancel   = () => { setAdding(false); setEditId(null) }

  const canSave = form.name.trim() && (tabCfg.needsPath ? form.relativePath.trim() : true) && form.content.trim()

  const save = () => {
    if (!canSave) return
    const entry = { ...form, name: form.name.trim(), relativePath: form.relativePath.trim(), category: form.category }
    if (adding) addDocTemplate({ id: `dt${Date.now()}`, ...entry })
    else if (editId) updateDocTemplate(editId, entry)
    cancel()
  }

  const tabStyle = (t: VorlagenTab): React.CSSProperties => ({
    padding: '5px 28px', border: 'none', borderRadius: 5, fontSize: 11.5, cursor: 'pointer',
    fontFamily: 'inherit', fontWeight: activeTab === t ? 600 : 400,
    background: activeTab === t ? 'var(--bg-0)' : 'transparent',
    color: activeTab === t ? 'var(--fg-0)' : 'var(--fg-3)',
    boxShadow: activeTab === t ? '0 1px 4px rgba(0,0,0,0.3)' : 'none',
    transition: 'all 0.15s',
  })

  return (
    <div style={{ padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)', marginBottom: 2 }}>Vorlagen</div>
          <div style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>{tabCfg.hint}</div>
        </div>
        <span style={{ flex: 1 }} />
        <button style={btnPrimary} onClick={openAdd}><IPlus />Neu</button>
      </div>

      {/* Centered tab bar */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 2, padding: 3, background: 'var(--bg-2)', borderRadius: 7, border: '1px solid var(--line)' }}>
          {VORLAGEN_TABS.map(tab => (
            <button key={tab.key} onClick={() => switchTab(tab.key)} style={tabStyle(tab.key)}>
              {tab.label}
              {tabCount(tab.key) > 0 && (
                <span style={{ marginLeft: 5, fontSize: 10, background: activeTab === tab.key ? 'var(--accent-soft)' : 'var(--bg-3)', color: activeTab === tab.key ? 'var(--accent)' : 'var(--fg-3)', borderRadius: 8, padding: '1px 5px' }}>
                  {tabCount(tab.key)}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 && !adding && (
        <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--fg-3)', fontSize: 12, border: '1px dashed var(--line)', borderRadius: 6 }}>
          Keine {tabCfg.label} vorhanden.
        </div>
      )}

      {filtered.length > 0 && (
        <div style={{ border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden', background: 'var(--bg-1)', marginBottom: 16 }}>
          {filtered.map((t, i) => {
            const usage = TEMPLATE_USAGE[t.id]
            const isBuiltin = !!usage
            return (
              <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '36px 1fr auto 44px', padding: '9px 14px', alignItems: 'center', gap: 12, fontSize: 12, borderBottom: i < filtered.length - 1 ? '1px solid var(--line)' : 'none', background: t.id === editId ? 'var(--accent-soft)' : 'transparent' }}>
                <button onClick={() => updateDocTemplate(t.id, { enabled: !t.enabled })} style={{ width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer', background: t.enabled ? 'var(--accent)' : 'var(--bg-3)', position: 'relative', flexShrink: 0, transition: 'background 0.2s', boxShadow: t.enabled ? '0 0 0 1px var(--accent)' : '0 0 0 1px var(--line)' }}>
                  <span style={{ position: 'absolute', top: 3, left: t.enabled ? 18 : 3, width: 14, height: 14, borderRadius: '50%', background: t.enabled ? 'var(--accent-fg, #fff)' : 'var(--fg-3)', transition: 'left 0.2s' }} />
                </button>
                <div style={{ minWidth: 0 }}>
                  <span style={{ fontWeight: 600, color: t.enabled ? 'var(--fg-0)' : 'var(--fg-3)' }}>{t.name}</span>
                  {activeTab !== 'docs' && usage && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
                      <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'var(--accent-soft)', color: 'var(--accent)', fontWeight: 600, whiteSpace: 'nowrap' }}>{usage.screen}</span>
                      <span style={{ fontSize: 10, color: 'var(--fg-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{usage.element}</span>
                    </div>
                  )}
                  {activeTab !== 'docs' && !usage && t.relativePath && (
                    <div style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 2 }}>{t.relativePath}</div>
                  )}
                  {activeTab === 'docs' && (
                    <div className="mono" style={{ fontSize: 10.5, color: 'var(--fg-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>{t.relativePath}</div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {isBuiltin && (
                    <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, border: '1px solid var(--line)', color: 'var(--fg-3)', whiteSpace: 'nowrap' }}>built-in</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <IEdit style={{ color: 'var(--fg-3)', cursor: 'pointer' }} onClick={() => openEdit(t)} />
                  <ITrash style={{ color: 'var(--err)', cursor: 'pointer' }} onClick={() => { if (confirm(`"${t.name}" löschen?`)) removeDocTemplate(t.id) }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add / Edit form */}
      {(adding || editId) && (
        <div style={{ border: '1px solid var(--line)', borderRadius: 6, padding: 16, background: 'var(--bg-1)', marginTop: 4 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)', marginBottom: 14 }}>
            {adding ? `Neue ${tabCfg.label.replace(/en$/, '')}` : 'Bearbeiten'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: tabCfg.needsPath ? '1fr 1fr' : '1fr', gap: 12 }}>
            <div>
              <label style={fieldLabel}>Name</label>
              <input style={fieldInput} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="z.B. API-Dokumentation" autoFocus />
            </div>
            {tabCfg.needsPath && (
              <div>
                <label style={fieldLabel}>{tabCfg.pathLabel}</label>
                <input style={fieldInput} value={form.relativePath} onChange={e => setForm(f => ({ ...f, relativePath: e.target.value }))} placeholder={tabCfg.pathPlaceholder} />
              </div>
            )}
            <div style={{ gridColumn: tabCfg.needsPath ? '1 / span 2' : '1' }}>
              <label style={fieldLabel}>{tabCfg.contentLabel}</label>
              <textarea style={{ ...fieldInput, minHeight: 260, resize: 'vertical', lineHeight: 1.5 }} value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} placeholder={tabCfg.contentPlaceholder} spellCheck={false} />
            </div>
            <div style={{ gridColumn: tabCfg.needsPath ? '1 / span 2' : '1', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={btnGhost} onClick={cancel}>Abbrechen</button>
              <button style={{ ...btnPrimary, opacity: canSave ? 1 : 0.5 }} disabled={!canSave} onClick={save}>
                {adding ? 'Speichern' : 'Aktualisieren'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'docs' && (
        <div style={{ marginTop: 16, padding: 12, background: 'var(--bg-2)', borderRadius: 6, border: '1px solid var(--line)', fontSize: 11, color: 'var(--fg-3)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--fg-1)' }}>Hinweis:</strong> Aktivierte Vorlagen werden beim Anlegen neuer Projekte automatisch erstellt. Der Docs-Refresh-Button (↑) im Projekt-Header aktualisiert bestehende Dateien mit AI.
        </div>
      )}
    </div>
  )
}

// ── Agenten Team Panel ────────────────────────────────────────────────────────
type AgentTeamTab = 'rollen' | 'einstellungen'

function AgentTeamPanel() {
  const {
    agentRoles, addAgentRole, updateAgentRole, removeAgentRole,
    defaultManagerModel, setDefaultManagerModel,
    crewVerbose, setCrewVerbose,
    crewTelemetryOff, setCrewTelemetryOff,
    crewQuietLogs, setCrewQuietLogs,
    crewWrapperScript, setCrewWrapperScript,
  } = useAppStore()
  const { models: orModels, loading: orLoading } = useOpenRouterModels()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<AgentTeamTab>('rollen')

  const inp: React.CSSProperties = { width: '100%', padding: '7px 10px', border: '1px solid var(--line-strong)', borderRadius: 6, background: 'var(--bg-2)', color: 'var(--fg-0)', fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none', boxSizing: 'border-box' as const }
  const fl: React.CSSProperties = { display: 'block', fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: 0.7, color: 'var(--fg-3)', fontWeight: 500, marginBottom: 5 }

  const tabStyle = (t: AgentTeamTab): React.CSSProperties => ({
    flex: 1, padding: '6px 0', border: 'none', borderRadius: 5, fontSize: 11.5, cursor: 'pointer',
    fontFamily: 'inherit', fontWeight: activeTab === t ? 600 : 400,
    background: activeTab === t ? 'var(--bg-0)' : 'transparent',
    color: activeTab === t ? 'var(--fg-0)' : 'var(--fg-3)',
    boxShadow: activeTab === t ? '0 1px 4px rgba(0,0,0,0.3)' : 'none',
    transition: 'all 0.15s',
  })

  const handleAddRole = () => {
    const newRole: AgentRole = { id: `ar-${Date.now()}`, name: 'Neuer Agent', model: 'anthropic/claude-sonnet-4-6', strengths: [], systemPrompt: '', tools: ['Read', 'Bash'] }
    addAgentRole(newRole)
    setExpandedId(newRole.id)
  }

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Centered tab bar */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ display: 'flex', gap: 2, padding: 3, background: 'var(--bg-2)', borderRadius: 7, border: '1px solid var(--line)' }}>
          <button style={{ ...tabStyle('rollen'), width: 148 }} onClick={() => setActiveTab('rollen')}>Agenten-Rollen</button>
          <button style={{ ...tabStyle('einstellungen'), width: 148 }} onClick={() => setActiveTab('einstellungen')}>Einstellungen</button>
        </div>
      </div>

      {/* ── Tab 1: Agenten-Rollen ──────────────────────────────────────── */}
      {activeTab === 'rollen' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Standard Orchestrator Rolle */}
          <section style={{ padding: '10px 12px', background: 'var(--bg-2)', borderRadius: 7, border: '1px solid var(--line-strong)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <ISpark style={{ color: 'var(--accent)', width: 13, height: 13 }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)' }}>Standard Orchestrator-Modell</span>
            </div>
            <p style={{ fontSize: 10.5, color: 'var(--fg-3)', margin: '0 0 8px', lineHeight: 1.5 }}>
              Manager-Agent der das Team koordiniert. Empfohlen: <em>Claude Opus</em>, <em>GPT-4o</em> oder <em>Gemini 2.5 Pro</em>.
            </p>
            <SingleCombobox
              value={defaultManagerModel || 'anthropic/claude-sonnet-4-6'}
              onChange={setDefaultManagerModel}
              searchable
              loading={orLoading}
              options={orModels.length > 0
                ? orModels.map(m => ({ value: m.value, label: m.label }))
                : [
                    { value: 'anthropic/claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
                    { value: 'anthropic/claude-opus-4',     label: 'Claude Opus 4' },
                    { value: 'openai/gpt-4o',               label: 'GPT-4o' },
                    { value: 'google/gemini-2.5-pro-preview', label: 'Gemini 2.5 Pro' },
                  ]
              }
              placeholder="Orchestrator-Modell auswählen…"
            />
          </section>

          {/* Agenten-Rollen */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)' }}>Agenten-Rollen</span>
              <span style={{ flex: 1 }} />
              <button onClick={() => { if (confirm('Standard-Rollen wiederherstellen? Eigene Änderungen gehen verloren.')) { agentRoles.forEach(r => removeAgentRole(r.id)); DEFAULT_AGENT_ROLES.forEach(r => addAgentRole({ ...r })) } }}
                style={{ background: 'none', border: 'none', color: 'var(--fg-3)', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-ui)', marginRight: 10 }}>
                Zurücksetzen
              </button>
              <button onClick={handleAddRole} style={btnPrimary}>Hinzufügen</button>
            </div>
        {agentRoles.map(role => (
          <div key={role.id} style={{ border: '1px solid var(--line-strong)', borderRadius: 7, marginBottom: 8, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: 'var(--bg-2)', cursor: 'pointer' }}
              onClick={() => setExpandedId(expandedId === role.id ? null : role.id)}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)', minWidth: 80 }}>{role.name}</span>
              <span className="mono" style={{ fontSize: 10.5, color: 'var(--fg-3)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{role.model.split('/').pop()}</span>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                {role.strengths.slice(0, 3).map(s => (
                  <span key={s} style={{ fontSize: 9.5, color: 'var(--accent)', background: 'var(--accent-soft)', borderRadius: 3, padding: '2px 5px' }}>{s}</span>
                ))}
              </div>
              <button onClick={e => { e.stopPropagation(); removeAgentRole(role.id) }}
                style={{ background: 'none', border: 'none', color: 'var(--fg-3)', cursor: 'pointer', padding: 2, borderRadius: 3, flexShrink: 0 }}>
                <ITrash />
              </button>
            </div>
            {expandedId === role.id && (
              <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--bg-1)', borderTop: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <label style={fl}>Name</label>
                    <input style={inp} value={role.name} onChange={e => updateAgentRole(role.id, { name: e.target.value })} />
                  </div>
                  <div style={{ flex: 2 }}>
                    <label style={fl}>Modell</label>
                    <SingleCombobox
                      value={role.model}
                      onChange={v => updateAgentRole(role.id, { model: v })}
                      searchable
                      loading={orLoading}
                      options={orModels.length > 0
                        ? orModels.map(m => ({ value: m.value, label: m.label }))
                        : [{ value: role.model, label: role.model }]
                      }
                      placeholder="Modell auswählen…"
                      maxHeight={220}
                    />
                  </div>
                </div>
                <div>
                  <label style={fl}>Stärken</label>
                  <MultiCombobox
                    placeholder="Stärken auswählen…"
                    dropdownLabel="Stärken"
                    align="left"
                    value={role.strengths}
                    onChange={id => {
                      const next = role.strengths.includes(id)
                        ? role.strengths.filter(s => s !== id)
                        : [...role.strengths, id]
                      updateAgentRole(role.id, { strengths: next })
                    }}
                    onClear={() => updateAgentRole(role.id, { strengths: [] })}
                    options={[
                      // predefined pool + any existing custom strengths not in pool
                      ...STRENGTH_OPTIONS,
                      ...role.strengths
                        .filter(s => !STRENGTH_OPTIONS.find(o => o.id === s))
                        .map(s => ({ id: s, label: s })),
                    ]}
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={fl}>System-Prompt</label>
                  <textarea style={{ ...inp, height: 72, resize: 'vertical' as const }} value={role.systemPrompt} onChange={e => updateAgentRole(role.id, { systemPrompt: e.target.value })} />
                </div>
                {/* ── Tool rights (3 groups) ─────────────────────────── */}
                <div>
                  <label style={fl}>Rechte / Tools</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {CREW_TOOL_GROUPS.map(group => {
                      const allActive = group.tools.every(t => role.tools.includes(t.id))
                      const anyActive = group.tools.some(t => role.tools.includes(t.id))
                      return (
                        <div key={group.id} style={{ flex: 1, border: `1px solid ${anyActive ? group.color + '55' : 'var(--line-strong)'}`, borderRadius: 7, overflow: 'hidden', background: anyActive ? group.color + '0d' : 'var(--bg-2)' }}>
                          {/* Group header — click to toggle all tools in group */}
                          <div
                            onClick={() => {
                              const next = allActive
                                ? role.tools.filter(t => !group.tools.map(gt => gt.id).includes(t))
                                : [...new Set([...role.tools, ...group.tools.map(gt => gt.id)])]
                              updateAgentRole(role.id, { tools: next })
                            }}
                            style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', background: anyActive ? group.color + '18' : 'transparent', borderBottom: '1px solid var(--line)' }}
                          >
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: anyActive ? group.color : 'var(--fg-3)', flexShrink: 0 }} />
                            <span style={{ fontSize: 11, fontWeight: 700, color: anyActive ? group.color : 'var(--fg-2)', flex: 1 }}>{group.label}</span>
                            <div style={{ width: 14, height: 14, borderRadius: 3, border: `1.5px solid ${allActive ? group.color : anyActive ? group.color + '88' : 'var(--fg-3)'}`, background: allActive ? group.color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              {allActive && <ICheck style={{ color: '#fff', width: 9, height: 9 }} />}
                              {anyActive && !allActive && <div style={{ width: 6, height: 2, background: group.color, borderRadius: 1 }} />}
                            </div>
                          </div>
                          {/* Individual tools */}
                          <div style={{ padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {group.tools.map(tool => {
                              const active = role.tools.includes(tool.id)
                              return (
                                <div
                                  key={tool.id}
                                  onClick={() => {
                                    const next = active
                                      ? role.tools.filter(t => t !== tool.id)
                                      : [...role.tools, tool.id]
                                    updateAgentRole(role.id, { tools: next })
                                  }}
                                  style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '2px 2px' }}
                                >
                                  <div style={{ width: 12, height: 12, borderRadius: 3, border: `1.5px solid ${active ? group.color : 'var(--fg-3)'}`, background: active ? group.color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    {active && <ICheck style={{ color: '#fff', width: 8, height: 8 }} />}
                                  </div>
                                  <span style={{ fontSize: 10.5, color: active ? 'var(--fg-0)' : 'var(--fg-3)' }}>{tool.label}</span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
          </section>
        </div>
      )}

      {/* ── Tab 2: Einstellungen ───────────────────────────────────────── */}
      {activeTab === 'einstellungen' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Output & Logging */}
          <section>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-1)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>Output &amp; Logging</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, borderRadius: 7, border: '1px solid var(--line)', overflow: 'hidden' }}>
              {([
                { key: 'telemetryOff', label: 'Telemetry deaktivieren', sub: 'OTEL_SDK_DISABLED=true · CREWAI_TELEMETRY_OPT_OUT=1', value: crewTelemetryOff, set: setCrewTelemetryOff },
                { key: 'quietLogs',    label: 'Ruhige Logs',            sub: 'Log-Level → WARNING für crewai, litellm, opentelemetry', value: crewQuietLogs, set: setCrewQuietLogs },
                { key: 'verbose',      label: 'Verbose-Modus',          sub: 'verbose=True auf Agents & Crew', value: crewVerbose, set: setCrewVerbose },
              ] as const).map(row => (
                <div key={row.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', background: 'var(--bg-2)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11.5, color: 'var(--fg-0)', fontWeight: 500 }}>{row.label}</div>
                    <div style={{ fontSize: 9.5, color: 'var(--fg-3)', marginTop: 1, fontFamily: 'var(--font-mono)' }}>{row.sub}</div>
                  </div>
                  <button onClick={() => row.set(!row.value)}
                    style={{ width: 34, height: 18, borderRadius: 9, border: 'none', cursor: 'pointer', background: row.value ? 'var(--accent)' : 'var(--bg-3)', position: 'relative', flexShrink: 0, transition: 'background 0.2s', boxShadow: row.value ? '0 0 0 1px var(--accent)' : '0 0 0 1px var(--line)' }}>
                    <div style={{ position: 'absolute', top: 2, left: row.value ? 16 : 2, width: 14, height: 14, borderRadius: '50%', background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* CLI-Wrapper-Script */}
          <section>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-1)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>CLI-Wrapper-Script</div>
            <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginBottom: 6, lineHeight: 1.45 }}>
              Python-Code der vor dem generierten Crew-Script eingefügt wird (Formatter, Patches).
            </div>
            <textarea
              value={crewWrapperScript}
              onChange={e => setCrewWrapperScript(e.target.value)}
              placeholder={'# Beispiel:\nimport logging\nlogging.getLogger("litellm").setLevel(logging.ERROR)'}
              rows={4}
              style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--line-strong)', borderRadius: 6, background: 'var(--bg-2)', color: 'var(--fg-0)', fontSize: 11, fontFamily: 'var(--font-mono)', outline: 'none', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.55 }}
              spellCheck={false}
            />
          </section>
        </div>
      )}

    </div>
  )
}
