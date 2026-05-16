import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useAppStore, DEFAULT_DOC_TEMPLATES } from '../../store/useAppStore'
import type { Alias, RepoToken, DocTemplate, Template } from '../../store/useAppStore'
import { IPlus, IDrag, IEdit, ITrash, ISpark, ICheck, IBookmark, IGit, IStar, IMoon, ISun, IChevDown, IChevUp, IKeyboard, ICpu, IFileText, IDatabase, ILink, ICloud, ICloudUpload, IShield, IUsers, ILock, ISquareTerminal, IMic } from '../primitives/Icons'
import { Pill } from '../primitives/Pill'
import { ACCENT_PRESETS, TERMINAL_THEMES, applyPreset } from '../../theme/presets'
import type { AIProvider, TerminalShortcut, ClaudeProvider } from '../../store/useAppStore'
import { useOpenRouterModels } from '../../utils/useOpenRouterModels'
import { sanitizeKey } from '../../utils/orProvider'
import { saveGlobalTemplates, saveGlobalCliConfig, saveGlobalPrompts } from '../../lib/useSupabaseSync'
import { getSupabase } from '../../lib/supabase'
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

const NAV = ['Agents', 'API Credentials', 'KI-Funktionen', 'GitHub Integration', 'Aussehen', 'Vorlagen', 'Kontext Management']
// Note: 'Integrationen' and 'Admin: Voice/Groq' are intentionally admin-only — app-level credentials are baked in

const NAV_DESC: Record<string, string> = {
  'Agents':                'Terminal-Aliases & KI-Modelle',
  'API Credentials':       'OpenRouter.AI',
  'KI-Funktionen':         'Modellzuweisung für Funktionen',
  'GitHub Integration':    'Repos, Tokens, Git-Anbindung',
  'Prompt templates':      'AI-Prompts & User Stories',
  'Aussehen':              'Themes, Schrift, Farben',
  'Terminal-Befehle':      'Tastenkürzel im Terminal',
  'Large Language Models': 'API-Keys & KI-Funktionen',
  'Vorlagen':              'Dok- & Story-Vorlagen',
  'Kontext Management':    'Referenz-IDs, Kontext-Fenster',
  'Integrationen':         'Supabase, Cloudflare R2',
  // Admin
  'Admin: Übersicht':           'Statistiken & Systemstatus',
  'Admin: Benutzer':            'Rollen & Zugangsverwaltung',
  'Admin: Integrationen':       'Supabase, Cloudflare R2',
  'Admin: Claude CLI Konfig':   'tweakcc, Themes, Optionen',
  'Admin: Vorlagen':            'System-Prompts & Standard-Vorlagen',
  'Admin: Voice/Groq':          'Groq / OpenAI API-Key für Sprachaufnahme',
  'Admin: System':              'Version, Daten, Feature-Flags',
}

const NAV_ICONS: Record<string, React.ReactNode> = {
  'Agents':                <ISpark   style={{ width: 13, height: 13, flexShrink: 0 }} />,
  'API Credentials':       <ILock    style={{ width: 13, height: 13, flexShrink: 0 }} />,
  'KI-Funktionen':         <ICpu     style={{ width: 13, height: 13, flexShrink: 0 }} />,
  'GitHub Integration':    <IGit style={{ width: 13, height: 13, flexShrink: 0 }} />,
  'Prompt templates':      <IStar style={{ width: 13, height: 13, flexShrink: 0 }} />,
  'Aussehen':              <IMoon style={{ width: 13, height: 13, flexShrink: 0 }} />,
  'Terminal-Befehle':      <IKeyboard style={{ width: 13, height: 13, flexShrink: 0 }} />,
  'Large Language Models': <ICpu style={{ width: 13, height: 13, flexShrink: 0 }} />,
  'Vorlagen':              <IFileText style={{ width: 13, height: 13, flexShrink: 0 }} />,
  'Kontext Management':    <IDatabase style={{ width: 13, height: 13, flexShrink: 0 }} />,
  'Integrationen':         <ILink style={{ width: 13, height: 13, flexShrink: 0 }} />,
  // Admin
  'Admin: Übersicht':           <IShield      style={{ width: 13, height: 13, flexShrink: 0 }} />,
  'Admin: Benutzer':            <IUsers       style={{ width: 13, height: 13, flexShrink: 0 }} />,
  'Admin: Integrationen':       <ILink        style={{ width: 13, height: 13, flexShrink: 0 }} />,
  'Admin: Claude CLI Konfig':   <ISquareTerminal style={{ width: 13, height: 13, flexShrink: 0 }} />,
  'Admin: Vorlagen':            <IFileText    style={{ width: 13, height: 13, flexShrink: 0 }} />,
  'Admin: Voice/Groq':          <IMic         style={{ width: 13, height: 13, flexShrink: 0 }} />,
  'Admin: System':              <IDatabase    style={{ width: 13, height: 13, flexShrink: 0 }} />,
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
    <div style={{ height: 51, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 14px 0 88px', background: 'var(--bg-1)', borderBottom: '1px solid var(--line)', userSelect: 'none', WebkitAppRegion: 'drag' } as React.CSSProperties}>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)', pointerEvents: 'none' }}>Einstellungen</span>
    </div>
  )
}

// ── Root component ────────────────────────────────────────────────────────────
const ADMIN_NAV = ['Admin: Benutzer', 'Admin: Vorlagen', 'Admin: Voice/Groq', 'Admin: Integrationen', 'Admin: Claude CLI Konfig']

export function AliasSettings() {
  const { aliases, addAlias, updateAlias, removeAlias, reorderAliases, setScreen, currentUser, adminEmails } = useAppStore()
  const [activeNav, setActiveNav] = useState('Agents')
  const isAdmin = !!currentUser?.email && adminEmails.map(e => e.toLowerCase()).includes(currentUser.email.toLowerCase())
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
        <aside style={{ width: 220, background: 'var(--bg-1)', borderRight: '1px solid var(--line)', padding: '12px 0', flexShrink: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {/* User settings */}
          <div style={{ padding: '2px 14px 6px', fontSize: 8.5, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--fg-3)', fontWeight: 700, opacity: 0.6 }}>Einstellungen</div>
          {NAV.map(label => (
            <NavItem key={label} label={label} active={activeNav === label} onClick={() => { setActiveNav(label); setEditMode(null) }} />
          ))}

          {/* Admin section */}
          {isAdmin && <>
            <div style={{ margin: '10px 14px 6px', height: 1, background: 'var(--line)' }} />
            <div style={{ padding: '2px 14px 6px', display: 'flex', alignItems: 'center', gap: 5 }}>
              <IShield style={{ width: 9, height: 9, color: 'var(--accent)' }} />
              <span style={{ fontSize: 8.5, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--accent)', fontWeight: 700 }}>Admin</span>
            </div>
            {ADMIN_NAV.map(label => (
              <NavItem key={label} label={label} active={activeNav === label} onClick={() => { setActiveNav(label); setEditMode(null) }} isAdmin />
            ))}
          </>}

          <div style={{ flex: 1 }} />
          <div style={{ margin: '0 16px 4px', height: 1, background: 'var(--line)' }} />
          <div onClick={() => setScreen('workspace')} style={{ padding: '8px 16px', fontSize: 12, color: 'var(--fg-3)', cursor: 'pointer' }}>← Back</div>
        </aside>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {activeNav === 'API Credentials'    && <AIPanel hideTabs={['provider', 'functions']} />}
          {activeNav === 'KI-Funktionen'      && <AIPanel hideTabs={['keys', 'provider']} />}
          {activeNav === 'Agents' && (
            <AgentsPanel
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
          {activeNav === 'Vorlagen'           && <DocTemplatesPanel isAdmin={false} />}
          {activeNav === 'Admin: Vorlagen'    && <DocTemplatesPanel isAdmin={true} />}
          {activeNav === 'Kontext Management' && <KontextMgmtPanel />}
          {activeNav === 'Admin: Übersicht'      && <AdminOverviewPanel />}
          {activeNav === 'Admin: Benutzer'          && <AdminUsersPanel />}
          {activeNav === 'Admin: Voice/Groq'        && <VoiceGroqPanel />}
          {activeNav === 'Admin: Integrationen'     && <IntegrationenPanel />}
          {activeNav === 'Admin: Claude CLI Konfig' && <ClaudeCLIAdminPanel />}
          {activeNav === 'Admin: System'            && <AdminSystemPanel />}
        </div>
      </div>
    </div>
  )
}

// ── Shared NavItem ────────────────────────────────────────────────────────────
function NavItem({ label, active, onClick, isAdmin }: { label: string; active: boolean; onClick: () => void; isAdmin?: boolean }) {
  const displayLabel = label.startsWith('Admin: ') ? label.replace('Admin: ', '') : label
  const accentColor  = isAdmin ? 'var(--accent)' : 'var(--accent)'
  return (
    <div onClick={onClick} style={{
      padding: '5px 12px 5px 14px', cursor: 'pointer',
      background: active ? 'var(--bg-2)' : 'transparent',
      borderLeft: active ? `2px solid ${accentColor}` : '2px solid transparent',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: active ? accentColor : 'var(--fg-3)' }}>
        {NAV_ICONS[label]}
        <span style={{ fontSize: 11.5, color: active ? 'var(--fg-0)' : 'var(--fg-1)', fontWeight: active ? 600 : 400 }}>{displayLabel}</span>
      </div>
      <div style={{ fontSize: 9.5, color: 'var(--fg-3)', marginTop: 1, paddingLeft: 19 }}>{NAV_DESC[label]}</div>
    </div>
  )
}

// ── Admin: Übersicht ──────────────────────────────────────────────────────────
function AdminOverviewPanel() {
  const { projects, aliases, currentUser } = useAppStore()
  const totalSessions = projects.reduce((n, p) => n + p.sessions.length, 0)
  const totalTasks    = projects.reduce((n, p) => n + p.sessions.reduce((m, s) => m + (s.userStories?.length ?? 0), 0), 0)
  const stats = [
    { label: 'Projekte',  value: projects.length },
    { label: 'Sessions',  value: totalSessions },
    { label: 'Aliases',   value: aliases.length },
    { label: 'Tasks',     value: totalTasks },
  ]
  return (
    <div style={{ padding: '16px 20px', maxWidth: 680, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)', marginBottom: 2 }}>Übersicht</div>
        <div style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>Systemstatus & Statistiken</div>
      </div>

      {/* Aktiver Benutzer */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--fg-3)', fontWeight: 600, marginBottom: 8 }}>Eingeloggt als</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--bg-2)', border: '0.5px solid var(--line-strong)', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
            {(currentUser?.firstName?.charAt(0) ?? '') + (currentUser?.lastName?.charAt(0) ?? '')}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)' }}>{currentUser?.firstName} {currentUser?.lastName}</div>
            <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>{currentUser?.email}</div>
          </div>
          <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 700, letterSpacing: 0.5, color: 'var(--accent)', background: 'var(--accent-soft)', border: '1px solid var(--accent-line)', borderRadius: 4, padding: '2px 7px', textTransform: 'uppercase' }}>Admin</span>
        </div>
      </div>

      {/* Statistiken */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--fg-3)', fontWeight: 600, marginBottom: 8 }}>Statistiken</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {stats.map(({ label, value }) => (
            <div key={label} style={{ padding: '14px 10px', background: 'var(--bg-2)', border: '0.5px solid var(--line-strong)', borderRadius: 10, textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{value}</div>
              <div style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 3 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Admin: Benutzer & Zugang ──────────────────────────────────────────────────
function AdminUsersPanel() {
  const { adminEmails, addAdminEmail, removeAdminEmail, currentUser } = useAppStore()
  const [newEmail, setNewEmail] = useState('')
  const [emailError, setEmailError] = useState('')

  const handleAdd = () => {
    const email = newEmail.trim().toLowerCase()
    if (!email) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setEmailError('Ungültige E-Mail-Adresse'); return }
    addAdminEmail(email)
    setNewEmail('')
    setEmailError('')
  }

  return (
    <div style={{ padding: '16px 20px', maxWidth: 680, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)', marginBottom: 2 }}>Benutzer & Zugang</div>
        <div style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>Verwalte Admin-Rechte und Zugänge</div>
      </div>

      <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--fg-3)', fontWeight: 600, marginBottom: 8 }}>Administratoren</div>
      <div style={{ background: 'var(--bg-2)', border: '0.5px solid var(--line-strong)', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: 14 }}>
        {adminEmails.map((email, i) => (
          <div key={email} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
            borderBottom: i < adminEmails.length - 1 ? '1px solid var(--line)' : 'none',
          }}>
            <IUsers style={{ width: 13, height: 13, color: 'var(--fg-3)', flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--fg-0)' }}>{email}</span>
            {email === currentUser?.email?.toLowerCase() && (
              <span style={{ fontSize: 9, color: 'var(--accent)', fontWeight: 600, background: 'var(--accent-soft)', padding: '1px 6px', borderRadius: 4, border: '1px solid var(--accent-line)' }}>Du</span>
            )}
            <button
              onClick={() => removeAdminEmail(email)}
              disabled={adminEmails.length <= 1}
              title={adminEmails.length <= 1 ? 'Letzter Admin — kann nicht entfernt werden' : 'Entfernen'}
              style={{ background: 'none', border: 'none', cursor: adminEmails.length <= 1 ? 'not-allowed' : 'pointer', color: 'var(--err)', padding: 2, display: 'flex', opacity: adminEmails.length <= 1 ? 0.25 : 1 }}
            >
              <ITrash style={{ width: 12, height: 12 }} />
            </button>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--fg-3)', fontWeight: 600, marginBottom: 8 }}>Admin hinzufügen</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <input
            value={newEmail}
            onChange={e => { setNewEmail(e.target.value); setEmailError('') }}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
            placeholder="admin@beispiel.com"
            style={{
              width: '100%', padding: '7px 10px', borderRadius: 6, boxSizing: 'border-box',
              border: `1px solid ${emailError ? 'var(--err)' : 'var(--line-strong)'}`,
              background: 'var(--bg-2)', color: 'var(--fg-0)', fontSize: 12,
              fontFamily: 'var(--font-mono)', outline: 'none',
            }}
          />
          {emailError && <div style={{ fontSize: 10, color: 'var(--err)', marginTop: 4 }}>{emailError}</div>}
        </div>
        <button
          onClick={handleAdd}
          style={{ background: 'var(--accent)', color: 'var(--accent-fg)', border: 'none', borderRadius: 6, padding: '0 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, flexShrink: 0 }}
        >
          <IPlus style={{ width: 12, height: 12 }} />Hinzufügen
        </button>
      </div>
    </div>
  )
}

// ── Admin: Voice/Groq ────────────────────────────────────────────────────────
function VoiceGroqPanel() {
  const { groqApiKey, setGroqApiKey, voiceProvider, setVoiceProvider } = useAppStore()
  const [showKey, setShowKey] = useState(false)
  const [draft, setDraft]     = useState(groqApiKey)
  const [saved, setSaved]     = useState(false)

  const save = () => {
    setGroqApiKey(draft.trim())
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  const mask = (k: string) => k.length < 8 ? '••••••••' : k.slice(0, 6) + '••••••••' + k.slice(-4)

  return (
    <div style={{ padding: '16px 20px', maxWidth: 560, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)', marginBottom: 2 }}>Voice / Groq</div>
        <div style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>API-Key für Sprachaufnahme & Transkription im Terminal (Whisper-Modell)</div>
      </div>

      {/* Provider selector */}
      <div style={{ border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden', background: 'var(--bg-1)' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--line)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-0)', marginBottom: 8 }}>Anbieter</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['groq', 'openai'] as const).map(p => (
              <button
                key={p}
                onClick={() => setVoiceProvider(p)}
                style={{
                  padding: '5px 16px', border: '1px solid', borderRadius: 6, fontSize: 11.5,
                  cursor: 'pointer', fontFamily: 'var(--font-ui)', fontWeight: voiceProvider === p ? 600 : 400,
                  background: voiceProvider === p ? 'var(--accent-soft)' : 'var(--bg-2)',
                  borderColor: voiceProvider === p ? 'var(--accent)' : 'var(--line)',
                  color: voiceProvider === p ? 'var(--accent)' : 'var(--fg-2)',
                }}
              >
                {p === 'groq' ? 'Groq (kostenlos)' : 'OpenAI'}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 6, fontSize: 10.5, color: 'var(--fg-3)' }}>
            {voiceProvider === 'groq'
              ? 'Groq nutzt Whisper Large v3 Turbo — schnell & kostenlos im Free-Tier.'
              : 'OpenAI nutzt Whisper-1 — kostenpflichtig pro Minute.'}
          </div>
        </div>

        {/* API Key */}
        <div style={{ padding: '10px 14px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-0)', marginBottom: 6 }}>
            {voiceProvider === 'groq' ? 'Groq' : 'OpenAI'} API-Key
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type={showKey ? 'text' : 'password'}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder={voiceProvider === 'groq' ? 'gsk_…' : 'sk-…'}
              style={{ flex: 1, padding: '7px 10px', border: '1px solid var(--line-strong)', borderRadius: 6, background: 'var(--bg-2)', color: 'var(--fg-0)', fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none' }}
            />
            <button onClick={() => setShowKey(v => !v)} style={{ padding: '6px 10px', border: '1px solid var(--line)', borderRadius: 6, background: 'var(--bg-2)', color: 'var(--fg-2)', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-ui)', whiteSpace: 'nowrap' }}>
              {showKey ? 'Verbergen' : 'Anzeigen'}
            </button>
            <button onClick={save} style={{ padding: '6px 14px', border: 'none', borderRadius: 6, background: saved ? 'var(--ok, #22c55e)' : 'var(--accent)', color: 'var(--accent-fg)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)', whiteSpace: 'nowrap' }}>
              {saved ? '✓ Gespeichert' : 'Speichern'}
            </button>
          </div>
          {groqApiKey && (
            <div style={{ marginTop: 6, fontSize: 10.5, color: 'var(--fg-3)' }}>
              Aktuell: <span className="mono">{mask(groqApiKey)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Info */}
      <div style={{ padding: '10px 12px', background: 'var(--bg-2)', borderRadius: 6, border: '1px solid var(--line)', fontSize: 10.5, color: 'var(--fg-3)', lineHeight: 1.6 }}>
        <strong style={{ color: 'var(--fg-1)' }}>Hinweis:</strong> Der Mikrofon-Button im Terminal-Eingabefeld nutzt diesen Key. Ohne Key ist der Button deaktiviert.
        {voiceProvider === 'groq' && (
          <> Groq-Keys sind kostenlos unter <span style={{ color: 'var(--accent)' }}>console.groq.com</span> erhältlich.</>
        )}
      </div>
    </div>
  )
}

// ── Admin: System ─────────────────────────────────────────────────────────────
function AdminSystemPanel() {
  const { projects, aliases, customUiColors, customTerminalColors } = useAppStore()
  const totalSessions = projects.reduce((n, p) => n + p.sessions.length, 0)

  const infoRows: Array<{ label: string; value: string }> = [
    { label: 'App-Version',        value: '0.1.0' },
    { label: 'Vite',               value: '6.x' },
    { label: 'React',              value: '19.x' },
    { label: 'Projekte gesamt',    value: String(projects.length) },
    { label: 'Sessions gesamt',    value: String(totalSessions) },
    { label: 'Aliases gesamt',     value: String(aliases.length) },
    { label: 'UI-Farb-Overrides',  value: String(Object.keys(customUiColors).length) },
    { label: 'Terminal-Overrides', value: String(Object.keys(customTerminalColors).length) },
  ]

  const exportData = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      projects, aliases,
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href = url
    a.download = `codera-export-${Date.now()}.json`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ padding: '16px 20px', maxWidth: 680, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)', marginBottom: 2 }}>System</div>
        <div style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>Version, Daten & Diagnose</div>
      </div>

      <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--fg-3)', fontWeight: 600, marginBottom: 8 }}>System-Info</div>
      <div style={{ background: 'var(--bg-2)', border: '0.5px solid var(--line-strong)', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: 20 }}>
        {infoRows.map(({ label, value }, i) => (
          <div key={label} style={{
            display: 'flex', alignItems: 'center', padding: '8px 14px',
            borderBottom: i < infoRows.length - 1 ? '1px solid var(--line)' : 'none',
          }}>
            <span style={{ flex: 1, fontSize: 11.5, color: 'var(--fg-2)' }}>{label}</span>
            <span style={{ fontSize: 11.5, fontFamily: 'var(--font-mono)', color: 'var(--fg-0)', fontWeight: 600 }}>{value}</span>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--fg-3)', fontWeight: 600, marginBottom: 8 }}>Daten-Export</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={exportData}
          style={{ background: 'var(--accent)', color: 'var(--accent-fg)', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-ui)', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <ICloud style={{ width: 13, height: 13 }} />Daten exportieren (JSON)
        </button>
      </div>
    </div>
  )
}

// ── Agents panel (wrapper: Terminal + Agent Chat tabs) ────────────────────────
type AgentsPanelProps = {
  aliases: Alias[]; cmdChecks: Record<string, boolean>; activeId: string | null
  editMode: EditMode; form: { name: string; cmd: string; args: string }
  setForm: React.Dispatch<React.SetStateAction<{ name: string; cmd: string; args: string }>>
  openEdit: (a: Alias) => void; openNew: () => void; save: () => void
  setEditMode: (m: EditMode) => void; removeAlias: (id: string) => void
  reorderAliases: (ids: string[]) => void
}

function AgentsPanel(props: AgentsPanelProps) {
  const [agentTab, setAgentTab] = useState<'terminal' | 'agent-chat'>('agent-chat')
  const openAddRef = useRef<(() => void) | null>(null)

  const tabBtn = (t: 'terminal' | 'agent-chat'): React.CSSProperties => ({
    padding: '5px 22px', border: 'none', borderRadius: 6, fontSize: 11.5, cursor: 'pointer',
    fontFamily: 'var(--font-ui)', fontWeight: agentTab === t ? 600 : 400,
    background: agentTab === t ? 'var(--accent-soft)' : 'transparent',
    color: agentTab === t ? 'var(--accent)' : 'var(--fg-2)',
  })

  return (
    <div style={{ padding: '16px 20px', maxWidth: 680, margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)', marginBottom: 2 }}>Agents</div>
          <div style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>Terminal-Aliases & KI-Modelle</div>
        </div>
        <span style={{ flex: 1 }} />
        {agentTab === 'terminal'    && <button style={btnPrimary} onClick={props.openNew}><IPlus />Neu</button>}
        {agentTab === 'agent-chat'  && <button style={btnPrimary} onClick={() => openAddRef.current?.()}><IPlus style={{ width: 13, height: 13 }} /> Agent hinzufügen</button>}
      </div>

      {/* Centered tab bar */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 2, padding: 3, background: 'var(--bg-2)', borderRadius: 6, border: '1px solid var(--line)' }}>
          <button style={tabBtn('agent-chat')} onClick={() => setAgentTab('agent-chat')}>Agent Chat</button>
          <button style={tabBtn('terminal')}   onClick={() => setAgentTab('terminal')}>Terminal</button>
        </div>
      </div>

      {agentTab === 'terminal'   && <AliasesPanel {...props} />}
      {agentTab === 'agent-chat' && <ClaudeProviderTab openAddRef={openAddRef} />}
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
  const dragIdRef = useRef<string | null>(null)

  return (
    <div>
      <div style={{ fontSize: 9.5, color: 'var(--fg-3)', marginBottom: 10, lineHeight: 1.5 }}>
        Die ersten 4 werden als Schnellstart im leeren Workspace angezeigt. Reihenfolge per Drag ändern.
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
              dragIdRef.current = a.id
              setTimeout(() => setDragging(a.id), 0)
            }}
            onDragEnd={() => { setDragging(null); setDragOver(null); dragIdRef.current = null }}
            onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (dragOver !== a.id) setDragOver(a.id) }}
            onDragLeave={() => setDragOver(v => v === a.id ? null : v)}
            onDrop={e => {
              e.preventDefault()
              const from = dragIdRef.current ?? e.dataTransfer.getData('text/plain')
              dragIdRef.current = null
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
                color: 'var(--accent)',
                background: 'var(--accent-soft)',
                border: '1px solid var(--accent-line)',
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
                <div style={{ marginTop: 5, padding: '5px 10px', background: 'rgba(244,195,101,0.12)', border: '1px solid rgba(244,195,101,0.4)', borderRadius: 6, fontSize: 11, color: 'var(--warn)', display: 'flex', alignItems: 'center', gap: 6 }}>
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
    <div style={{ padding: '16px 20px', maxWidth: 680, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)', marginBottom: 2 }}>GitHub Integration</div>
          <div style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>Zugangs-Tokens für Git-Hosts — Clone, Push, Pull</div>
        </div>
        <span style={{ flex: 1 }} />
        <button style={btnPrimary} onClick={openAdd}><IPlus />Token hinzufügen</button>
      </div>

      {/* ── Git-Host Tokens ── */}
      <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--fg-3)', fontWeight: 600, marginBottom: 8 }}>Git-Host Tokens</div>

      {/* Token list */}
      {tokens.length === 0 && !adding ? (
        <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--fg-3)', fontSize: 12, border: '1px dashed var(--line)', borderRadius: 6, marginBottom: 20 }}>
          Noch kein Token gespeichert.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {tokens.map((t) => (
            <div key={t.id} style={{ border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden', background: 'var(--bg-1)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 14, padding: '10px 14px', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)' }}>{t.label}</span>
                    <span className="mono" style={{ fontSize: 10, color: 'var(--fg-3)', background: 'var(--bg-3)', padding: '1px 6px', borderRadius: 4 }}>{t.host}</span>
                  </div>
                  <span className="mono" style={{ fontSize: 10.5, color: 'var(--fg-3)', letterSpacing: showIds.has(t.id) ? 0 : 1 }}>
                    {showIds.has(t.id) ? t.token : mask(t.token)}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                  <button onClick={() => toggleShow(t.id)} style={{ ...btnGhost, fontSize: 11 }}>
                    {showIds.has(t.id) ? 'Verbergen' : 'Anzeigen'}
                  </button>
                  <button onClick={() => openEdit(t)} style={{ ...btnGhost, fontSize: 11 }}>Bearbeiten</button>
                  <button onClick={() => { if (confirm(`Token „${t.label}" löschen?`)) removeToken(t.id) }} style={{ background: 'none', border: '1px solid var(--line)', borderRadius: 6, color: 'var(--err)', cursor: 'pointer', padding: '4px 10px', fontSize: 11, fontFamily: 'var(--font-ui)' }}>Löschen</button>
                </div>
              </div>
              {t.id === editId && (
                <div style={{ borderTop: '1px solid var(--line)', padding: '12px 14px', background: 'var(--bg-0)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={fieldLabel}>Bezeichnung</label>
                    <input style={fieldInput} value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} />
                  </div>
                  <div>
                    <label style={fieldLabel}>Git-Host</label>
                    <input style={fieldInput} value={form.host} onChange={e => setForm(f => ({ ...f, host: e.target.value }))} list="host-list" />
                    <datalist id="host-list">{HOSTS.map(h => <option key={h} value={h} />)}</datalist>
                  </div>
                  <div style={{ gridColumn: '1 / span 2' }}>
                    <label style={fieldLabel}>Token</label>
                    <input style={fieldInput} type="password" value={form.token} onChange={e => setForm(f => ({ ...f, token: e.target.value }))} autoComplete="new-password" />
                  </div>
                  <div style={{ gridColumn: '1 / span 2', display: 'flex', gap: 8 }}>
                    <button onClick={save} style={btnPrimary}>Speichern</button>
                    <button onClick={cancel} style={btnGhost}>Abbrechen</button>
                  </div>
                </div>
              )}
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

// Static accent family definitions — each has a dark and light variant
const ACCENT_FAMILIES = [
  { id: 'ember',    name: 'Ember',    darkColor: '#ff7f4d', lightColor: '#d95f2a' },
  { id: 'cobalt',   name: 'Cobalt',   darkColor: '#0073ff', lightColor: '#1e40ff' },
  { id: 'forest',   name: 'Forest',   darkColor: '#00e229', lightColor: '#1a9e5c' },
  { id: 'midnight', name: 'Midnight', darkColor: '#9d6fff', lightColor: '#8249ff' },
  { id: 'rose',     name: 'Rose',     darkColor: '#ff47a6', lightColor: '#e01e8c' },
  { id: 'crimson',  name: 'Rot',      darkColor: '#ff3b4e', lightColor: '#c0192e' },
]

function AussehenpPanel() {
  const [tab, setTab]           = useState<AussehTab>('themes')
  const [advancedOpen, setAdvancedOpen]         = useState(false)
  const [termAdvancedOpen, setTermAdvancedOpen] = useState(false)
  const {
    accent: _ac, accentFg: _afg, preset: _pr,
    terminalTheme: _tt, uiFont: _uf, uiFontSize: _ufs, uiFontWeight: _ufw,
    terminalFontFamily: _tff, terminalFontSize: _tfs,
    setAccent, setAccentFg, setPreset, setTerminalTheme,
    setUiFont, setUiFontSize, setUiFontWeight, setTheme,
    setTerminalFontFamily, setTerminalFontSize,
    customTerminalColors, setCustomTerminalColor, resetCustomTerminalColors,
    customUiColors, setCustomUiColor, setCustomUiColors, resetCustomUiColors,
  } = useAppStore()

  const accent           = _ac ?? '#ff8a5b'
  const accentFg         = _afg ?? '#1a1410'
  const preset           = _pr ?? 'ember'
  const terminalTheme    = _tt ?? 'default'
  const uiFont           = _uf ?? 'system'
  const uiFontSize       = _ufs ?? 13
  const uiFontWeight     = _ufw ?? 400
  const terminalFontFamily = _tff ?? 'jetbrains'
  const terminalFontSize   = _tfs ?? 13

  const applyFull = (p: typeof ACCENT_PRESETS[0]) => {
    setPreset(p.id); setAccent(p.accent); setAccentFg(p.accentFg)
    setTheme(p.dark ? 'dark' : 'light')
    applyPreset(p, p.accent, p.accentFg)
    // After applyPreset has written CSS vars inline, read them all back and
    // persist into customUiColors so every color field updates instantly.
    // Preserve any manually-set syntax overrides the user had before.
    const css = getComputedStyle(document.documentElement)
    const get = (k: string) => css.getPropertyValue(k).trim()
    const SYNTAX_KEYS = ['--tok-keyword','--tok-string','--tok-number','--tok-comment','--tok-type','--tok-fn']
    const preservedSyntax: Record<string,string> = {}
    SYNTAX_KEYS.forEach(k => { if (customUiColors[k]) preservedSyntax[k] = customUiColors[k] })
    setCustomUiColors({
      ...preservedSyntax,
      '--accent':       p.accent,
      '--accent-fg':    p.accentFg,
      '--bg-0':         get('--bg-0'),
      '--bg-1':         get('--bg-1'),
      '--bg-2':         get('--bg-2'),
      '--bg-3':         get('--bg-3'),
      '--bg-4':         get('--bg-4'),
      '--line':         get('--line'),
      '--line-strong':  get('--line-strong'),
      '--fg-0':         get('--fg-0'),
      '--fg-1':         get('--fg-1'),
      '--fg-2':         get('--fg-2'),
      '--fg-3':         get('--fg-3'),
      '--orbit':        get('--orbit'),
      '--ok':           get('--ok'),
      '--warn':         get('--warn'),
      '--err':          get('--err'),
      '--info':         get('--info'),
    })
  }

  // ── Base + accent helpers ────────────────────────────────────────────────
  const currentFamily = preset.replace(/-light$/, '')
  const isDarkBase    = ACCENT_PRESETS.find(p => p.id === preset)?.dark ?? true
  const applyBase = (dark: boolean) => {
    const id = dark ? currentFamily : `${currentFamily}-light`
    const p  = ACCENT_PRESETS.find(x => x.id === id)
    if (p) applyFull(p)
  }
  const applyAccent = (familyId: string) => {
    const id = isDarkBase ? familyId : `${familyId}-light`
    const p  = ACCENT_PRESETS.find(x => x.id === id)
    if (p) applyFull(p)
  }

  const tabStyle = (t: AussehTab): React.CSSProperties => ({
    padding: '5px 14px', borderRadius: 6, fontSize: 11.5, fontFamily: 'var(--font-ui)',
    border: 'none', cursor: 'pointer',
    background: tab === t ? 'var(--accent-soft)' : 'transparent',
    color: tab === t ? 'var(--accent)' : 'var(--fg-2)',
    fontWeight: tab === t ? 600 : 400,
  })

  return (
    <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 680, margin: '0 auto' }}>
      {/* Page header */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)', marginBottom: 2 }}>Aussehen</div>
        <div style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>Themes, Schrift, Farben</div>
      </div>

      {/* Inner tab bar */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ display: 'flex', gap: 2, padding: '3px', background: 'var(--bg-2)', borderRadius: 6, border: '1px solid var(--line)' }}>
          <button style={tabStyle('themes')}   onClick={() => setTab('themes')}>Themes</button>
          <button style={tabStyle('terminal')} onClick={() => setTab('terminal')}>Terminal</button>
        </div>
      </div>

      {/* ── Themes ── */}
      {tab === 'themes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ── Base: Dunkel / Hell ── */}
          <div>
            <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--fg-3)', fontWeight: 600, marginBottom: 6 }}>Basis</div>
            <div style={{ display: 'flex', gap: 0, padding: 3, background: 'var(--bg-2)', borderRadius: 7, border: '1px solid var(--line)' }}>
              {([{ dark: true, icon: <IMoon style={{ width: 12, height: 12 }} />, label: 'Dunkel' }, { dark: false, icon: <ISun style={{ width: 12, height: 12 }} />, label: 'Hell' }] as const).map(({ dark, icon, label }) => (
                <button
                  key={String(dark)}
                  onClick={() => applyBase(dark)}
                  style={{
                    flex: 1, padding: '7px 0', borderRadius: 5, cursor: 'pointer', border: 'none',
                    fontSize: 12, fontFamily: 'var(--font-ui)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                    background: isDarkBase === dark ? 'var(--accent)' : 'transparent',
                    color:      isDarkBase === dark ? 'var(--accent-fg)' : 'var(--fg-2)',
                    fontWeight: isDarkBase === dark ? 600 : 400,
                    transition: 'background 0.12s, color 0.12s',
                  }}
                >{icon}{label}</button>
              ))}
            </div>
          </div>

          {/* ── Akzentfarbe ── */}
          <div>
            <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--fg-3)', fontWeight: 600, marginBottom: 8 }}>Akzentfarbe</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {ACCENT_FAMILIES.map(f => {
                const active      = currentFamily === f.id
                const swatchColor = isDarkBase ? f.darkColor : f.lightColor
                return (
                  <button
                    key={f.id}
                    onClick={() => applyAccent(f.id)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                      padding: '10px 6px', borderRadius: 8, cursor: 'pointer',
                      background: active ? `${swatchColor}18` : 'var(--bg-2)',
                      border: `1.5px solid ${active ? swatchColor : 'var(--line-strong)'}`,
                      boxShadow: active ? `0 0 0 2px ${swatchColor}33` : 'none',
                      transition: 'all 0.12s',
                    }}
                  >
                    <div style={{
                      width: 24, height: 24, borderRadius: '50%', background: swatchColor,
                      boxShadow: active ? `0 0 8px ${swatchColor}80` : 'none',
                      flexShrink: 0,
                    }} />
                    <span style={{
                      fontSize: 10, fontWeight: active ? 600 : 400,
                      color: active ? swatchColor : 'var(--fg-2)',
                      fontFamily: 'var(--font-ui)', lineHeight: 1,
                    }}>{f.name}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* UI Font + Size + Weight — compact 3-column dropdowns */}
          {(() => {
            const lbl: React.CSSProperties = {
              fontSize: 9, textTransform: 'uppercase' as const, letterSpacing: 0.6,
              color: 'var(--fg-3)', fontWeight: 600, marginBottom: 4, display: 'block',
            }
            return (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 90px', gap: 8 }}>
                <div>
                  <span style={lbl}>Schriftart</span>
                  <SingleCombobox
                    value={uiFont}
                    onChange={setUiFont}
                    options={UI_FONTS.map(f => ({ value: f.id, label: f.label }))}
                    placeholder="Schrift wählen…"
                  />
                </div>
                <div>
                  <span style={lbl}>Größe</span>
                  <SingleCombobox
                    value={String(uiFontSize)}
                    onChange={v => setUiFontSize(Number(v))}
                    options={[10,11,12,13,14,15,16,17,18].map(n => ({ value: String(n), label: `${n} px` }))}
                    placeholder="Größe…"
                  />
                </div>
                <div>
                  <span style={lbl}>Dicke</span>
                  <SingleCombobox
                    value={String(uiFontWeight)}
                    onChange={v => setUiFontWeight(Number(v) as 300|400|500|600)}
                    options={[
                      { value: '300', label: 'Dünn' },
                      { value: '400', label: 'Normal' },
                      { value: '500', label: 'Mittel' },
                      { value: '600', label: 'Fett' },
                    ]}
                    placeholder="Dicke…"
                  />
                </div>
              </div>
            )
          })()}

          <section>
            {/* ── Advanced Settings header ── */}
            <div
              onClick={() => setAdvancedOpen(o => !o)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none', marginBottom: advancedOpen ? 10 : 0 }}
            >
              {advancedOpen ? <IChevUp style={{ width: 11, height: 11, color: 'var(--fg-3)', flexShrink: 0 }} /> : <IChevDown style={{ width: 11, height: 11, color: 'var(--fg-3)', flexShrink: 0 }} />}
              <span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--fg-3)', fontWeight: 600, flex: 1 }}>Advanced Settings</span>
              {advancedOpen && (
                <button
                  onClick={e => { e.stopPropagation(); resetCustomUiColors() }}
                  style={{ background: 'none', border: 'none', fontSize: 10, color: 'var(--fg-3)', cursor: 'pointer', fontFamily: 'var(--font-ui)', padding: 0 }}
                >Zurücksetzen</button>
              )}
            </div>
            {!advancedOpen ? null : <>
            {/* Helper for reading current value */}
            {(() => {
              const css = getComputedStyle(document.documentElement)
              const cv = (key: string, fallback: string) =>
                customUiColors[key] || css.getPropertyValue(key).trim() || fallback
              const row = (label: string, key: string, fallback: string, extra?: (v: string) => void) => (
                <ColorRow key={key} label={label} hint={key}
                  value={cv(key, fallback)}
                  onChange={v => { setCustomUiColor(key, v); document.documentElement.style.setProperty(key, v); extra?.(v) }} />
              )
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

                  {/* ── Hintergründe ── */}
                  <div>
                    <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--fg-3)', fontWeight: 600, marginBottom: 5, opacity: 0.6 }}>Hintergründe</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
                      {row('Haupt (--bg-0)',      '--bg-0', '#0e0d0b')}
                      {row('Sidebar (--bg-1)',    '--bg-1', '#16140f')}
                      {row('Felder (--bg-2)',     '--bg-2', '#1e1c17')}
                      {row('Erhöht (--bg-3)',     '--bg-3', '#272420')}
                      {row('Hochgestellt (--bg-4)','--bg-4','#302d28')}
                    </div>
                  </div>

                  {/* ── Text ── */}
                  <div>
                    <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--fg-3)', fontWeight: 600, marginBottom: 5, opacity: 0.6 }}>Text</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
                      {row('Primär (--fg-0)',     '--fg-0', '#f8f2e8')}
                      {row('Sekundär (--fg-1)',   '--fg-1', '#ddd5c8')}
                      {row('Tertiär (--fg-2)',    '--fg-2', '#a89e94')}
                      {row('Subtil (--fg-3)',     '--fg-3', '#7a7268')}
                    </div>
                  </div>

                  {/* ── Linien ── */}
                  <div>
                    <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--fg-3)', fontWeight: 600, marginBottom: 5, opacity: 0.6 }}>Linien & Rahmen</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
                      {row('Linie (--line)',          '--line',        '#333028')}
                      {row('Stark (--line-strong)',   '--line-strong', '#4a4640')}
                    </div>
                  </div>

                  {/* ── Akzent & Marken ── */}
                  <div>
                    <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--fg-3)', fontWeight: 600, marginBottom: 5, opacity: 0.6 }}>Akzent & Marken</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
                      {row('Akzent (--accent)',       '--accent',    '#ff8a5b', v => setAccent(v))}
                      {row('Text auf Akzent',         '--accent-fg', '#1a1410', v => setAccentFg(v))}
                      {row('Orbit / KI (--orbit)',    '--orbit',     '#8b6cf7', v => {
                        // also update derived orbit-soft/line
                        const m = v.match(/^#(..)(..)(..)$/)
                        if (m) {
                          const [r,g,b] = m.slice(1).map(h => parseInt(h,16))
                          document.documentElement.style.setProperty('--orbit-soft', `rgba(${r},${g},${b},0.14)`)
                          document.documentElement.style.setProperty('--orbit-line', `rgba(${r},${g},${b},0.45)`)
                        }
                      })}
                    </div>
                  </div>

                  {/* ── Status ── */}
                  <div>
                    <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--fg-3)', fontWeight: 600, marginBottom: 5, opacity: 0.6 }}>Status</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
                      {row('Erfolg (--ok)',     '--ok',   '#7cd9a8')}
                      {row('Warnung (--warn)',  '--warn', '#f4c365')}
                      {row('Fehler (--err)',    '--err',  '#ef7a7a')}
                      {row('Info (--info)',     '--info', '#8ab4ff')}
                    </div>
                  </div>

                  {/* ── Code-Syntax ── */}
                  <div>
                    <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--fg-3)', fontWeight: 600, marginBottom: 5, opacity: 0.6 }}>Code-Syntax</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
                      {row('Keyword',    '--tok-keyword', '#c792ea')}
                      {row('String',     '--tok-string',  '#98c379')}
                      {row('Zahl',       '--tok-number',  '#d19a66')}
                      {row('Kommentar',  '--tok-comment', '#7c8396')}
                      {row('Typ',        '--tok-type',    '#4ec9b0')}
                      {row('Funktion',   '--tok-fn',      '#dcdcaa')}
                    </div>
                    <div style={{ marginTop: 6, fontSize: 9.5, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', background: 'var(--bg-2)', borderRadius: 6, padding: '6px 10px', lineHeight: 1.7 }}>
                      <span style={{ color: 'var(--tok-keyword)' }}>const </span>
                      <span style={{ color: 'var(--tok-fn)' }}>greet</span>
                      <span style={{ color: 'var(--fg-2)' }}> = (</span>
                      <span style={{ color: 'var(--fg-0)' }}>name</span>
                      <span style={{ color: 'var(--tok-type)' }}>: string</span>
                      <span style={{ color: 'var(--fg-2)' }}>) </span>
                      <span style={{ color: 'var(--tok-keyword)' }}>=&gt; </span>
                      <span style={{ color: 'var(--tok-string)' }}>`Hello, </span>
                      <span style={{ color: 'var(--fg-0)' }}>{'${'}</span>
                      <span style={{ color: 'var(--fg-0)' }}>name</span>
                      <span style={{ color: 'var(--fg-0)' }}>{'}'}</span>
                      <span style={{ color: 'var(--tok-string)' }}>!`</span>
                      <span style={{ color: 'var(--fg-2)' }}>  </span>
                      <span style={{ color: 'var(--tok-comment)' }}>// {42} Zeichen</span>
                    </div>
                  </div>

                </div>
              )
            })()}
            </>}
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
            <div
              onClick={() => setTermAdvancedOpen(o => !o)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none', marginBottom: termAdvancedOpen ? 10 : 0 }}
            >
              {termAdvancedOpen ? <IChevUp style={{ width: 11, height: 11, color: 'var(--fg-3)', flexShrink: 0 }} /> : <IChevDown style={{ width: 11, height: 11, color: 'var(--fg-3)', flexShrink: 0 }} />}
              <span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--fg-3)', fontWeight: 600, flex: 1 }}>Erweiterte Einstellungen</span>
              {termAdvancedOpen && (
                <button
                  onClick={e => { e.stopPropagation(); resetCustomTerminalColors() }}
                  style={{ background: 'none', border: 'none', fontSize: 10, color: 'var(--fg-3)', cursor: 'pointer', fontFamily: 'var(--font-ui)', padding: 0 }}
                >Zurücksetzen</button>
              )}
            </div>
            {termAdvancedOpen && <>
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
            </>}
          </section>
        </div>
      )}

      {/* ── Nur CLI (tweakcc) ── */}
    </div>
  )
}

// ── Claude CLI / tweakcc tab ──────────────────────────────────────────────────

interface TweakccMisc {
  expandThinkingBlocks?: boolean
  hideStartupBanner?: boolean
  enableSessionMemory?: boolean
  autoAcceptPlanMode?: boolean
  showTweakccVersion?: boolean
  enableConversationTitle?: boolean
  [key: string]: unknown
}

interface TweakccConfig {
  ccVersion?: string
  ccInstallationPath?: string
  changesApplied?: boolean
  settings?: {
    misc?: TweakccMisc
    themes?: Array<{ id: string; name: string }>
    [key: string]: unknown
  }
  [key: string]: unknown
}

// ── Admin: Claude CLI Konfig wrapper ─────────────────────────────────────────
function ClaudeCLIAdminPanel() {
  return (
    <div style={{ padding: '16px 20px', maxWidth: 680, margin: '0 auto' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)', marginBottom: 2 }}>Claude CLI Konfig</div>
      <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginBottom: 20 }}>tweakcc-Einstellungen, Themes & CLI-Optionen</div>
      <ClaudeCLITab />
    </div>
  )
}

function ClaudeCLITab() {
  const { currentUser, supabaseUrl, supabaseAnonKey } = useAppStore()
  const [config, setConfig]       = useState<TweakccConfig | null>(null)
  const [loading, setLoading]     = useState(true)
  const [applying, setApplying]   = useState(false)
  const [systemPrompt, setSystemPrompt] = useState('')
  const [status, setStatus]       = useState<{ ok: boolean; msg: string } | null>(null)
  const [notInstalled, setNotInstalled] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/tweakcc/config').then(r => r.json() as Promise<{ ok: boolean; config: TweakccConfig | null }>),
      fetch('/api/tweakcc/system-prompt').then(r => r.json() as Promise<{ ok: boolean; content: string }>),
    ]).then(([cfg, sp]) => {
      if (cfg.config) setConfig(cfg.config)
      else setNotInstalled(true)
      setSystemPrompt(sp.content ?? '')
    }).catch(() => setNotInstalled(true))
      .finally(() => setLoading(false))
  }, [])

  const setMisc = (key: keyof TweakccMisc, val: boolean) => {
    setConfig(prev => {
      if (!prev) return prev
      const settings = prev.settings ?? {}
      return { ...prev, settings: { ...settings, misc: { ...(settings.misc ?? {}), [key]: val } } }
    })
  }

  const save = async () => {
    setApplying(true)
    setStatus(null)
    try {
      await fetch('/api/tweakcc/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config }) })
      await fetch('/api/tweakcc/system-prompt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: systemPrompt }) })
      const r = await fetch('/api/tweakcc/apply', { method: 'POST' }).then(x => x.json() as Promise<{ ok: boolean; error?: string }>)
      setStatus(r.ok ? { ok: true, msg: 'Angewendet ✓' } : { ok: false, msg: r.error ?? 'Fehler beim Anwenden' })
      // Push to global_config so all users receive this config on next login
      if (currentUser?.id) {
        const sb = getSupabase(supabaseUrl, supabaseAnonKey)
        if (sb) void saveGlobalCliConfig(sb, currentUser.id, { tweakccConfig: config, systemPrompt })
      }
    } catch (e) {
      setStatus({ ok: false, msg: String(e) })
    } finally {
      setApplying(false)
    }
  }

  const sectionLabel: React.CSSProperties = { fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--fg-3)', fontWeight: 600, marginBottom: 6 }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, color: 'var(--fg-3)', fontSize: 12 }}>
      Lade tweakcc Konfiguration…
    </div>
  )

  if (notInstalled || !config) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '32px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)' }}>tweakcc nicht konfiguriert</div>
      <div style={{ fontSize: 12, color: 'var(--fg-3)', maxWidth: 340, lineHeight: 1.6 }}>
        Führe <code style={{ background: 'var(--bg-2)', padding: '1px 5px', borderRadius: 4, fontFamily: 'var(--font-mono)' }}>npx tweakcc</code> im Terminal aus, um tweakcc einzurichten, und lade diese Seite dann neu.
      </div>
    </div>
  )

  const misc = config.settings?.misc ?? {}
  const themes = config.settings?.themes ?? []
  const builtinThemes = [
    { id: 'dark',             label: 'Dark (Standard)' },
    { id: 'light',            label: 'Light' },
    { id: 'monochrome',       label: 'Monochrome' },
    { id: 'light-ansi',       label: 'Light ANSI' },
    { id: 'dark-ansi',        label: 'Dark ANSI' },
    { id: 'light-daltonized', label: 'Light (Farbenblind)' },
    { id: 'dark-daltonized',  label: 'Dark (Farbenblind)' },
  ]
  const allThemes = [...builtinThemes, ...themes.filter(t => !builtinThemes.some(b => b.id === t.id)).map(t => ({ id: t.id, label: t.name ?? t.id }))]

  const ToggleRow = ({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) => (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
      <div>
        <div style={{ fontSize: 12, color: 'var(--fg-0)', fontWeight: 500, marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 10.5, color: 'var(--fg-3)', lineHeight: 1.4 }}>{desc}</div>
      </div>
      <div
        onClick={() => onChange(!checked)}
        style={{
          flexShrink: 0, width: 30, height: 16, borderRadius: 8, cursor: 'pointer',
          background: checked ? 'var(--accent)' : 'var(--bg-2)', border: `1px solid ${checked ? 'var(--accent)' : 'var(--line-strong)'}`,
          position: 'relative', transition: 'background 0.2s',
        }}
      >
        <div style={{
          position: 'absolute', top: 2, left: checked ? 14 : 2, width: 10, height: 10,
          borderRadius: '50%', background: checked ? 'var(--accent-fg)' : 'var(--fg-3)', transition: 'left 0.2s',
        }} />
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Info bar */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '7px 12px', background: 'var(--bg-2)', borderRadius: 6, border: '1px solid var(--line)', fontSize: 11 }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: config.changesApplied ? 'var(--ok)' : 'var(--fg-3)', flexShrink: 0 }} />
        <span style={{ color: 'var(--fg-1)' }}>
          {config.changesApplied ? 'Patches aktiv' : 'Patches nicht angewendet'}
          {config.ccVersion && <span style={{ color: 'var(--fg-3)', marginLeft: 6 }}>· Claude Code {config.ccVersion}</span>}
        </span>
      </div>

      {/* Theme */}
      <div>
        <div style={sectionLabel}>Aktives Theme</div>
        <SingleCombobox
          value={(config.settings as { activeTheme?: string } | undefined)?.activeTheme ?? 'dark'}
          onChange={v => setConfig(prev => prev ? { ...prev, settings: { ...(prev.settings ?? {}), activeTheme: v } } : prev)}
          options={allThemes.map(t => ({ value: t.id, label: t.label }))}
          placeholder="Theme wählen…"
        />
        <div style={{ marginTop: 5, fontSize: 10, color: 'var(--fg-3)' }}>Wirkt sich auf die Claude CLI UI aus (nicht Codera).</div>
      </div>

      {/* Toggles */}
      <div>
        <div style={sectionLabel}>Optionen</div>
        <ToggleRow
          label="Thinking Blocks aufgeklappt" desc="Zeigt Denkprozesse standardmäßig ausgeklappt an."
          checked={misc.expandThinkingBlocks ?? true}
          onChange={v => setMisc('expandThinkingBlocks', v)}
        />
        <ToggleRow
          label="Startup-Banner ausblenden" desc="Entfernt den ASCII-Banner beim Starten von Claude Code."
          checked={misc.hideStartupBanner ?? false}
          onChange={v => setMisc('hideStartupBanner', v)}
        />
        <ToggleRow
          label="Session Memory aktivieren" desc="Aktiviert das automatische Session-Gedächtnis."
          checked={misc.enableSessionMemory ?? true}
          onChange={v => setMisc('enableSessionMemory', v)}
        />
        <ToggleRow
          label="Auto-Accept Plan Mode" desc="Bestätigt Plan-Mode automatisch ohne Rückfrage."
          checked={misc.autoAcceptPlanMode ?? false}
          onChange={v => setMisc('autoAcceptPlanMode', v)}
        />
        <ToggleRow
          label="Gesprächstitel aktivieren" desc="Ermöglicht das Benennen von Sitzungen mit /title."
          checked={misc.enableConversationTitle ?? true}
          onChange={v => setMisc('enableConversationTitle', v)}
        />
      </div>

      {/* System prompt */}
      <div>
        <div style={sectionLabel}>System-Prompt Zusatz (codera.md)</div>
        <textarea
          value={systemPrompt}
          onChange={e => setSystemPrompt(e.target.value)}
          placeholder="Zusätzliche Anweisungen für Claude Code…"
          style={{
            width: '100%', minHeight: 100, padding: '8px 10px', boxSizing: 'border-box',
            border: '1px solid var(--line-strong)', borderRadius: 6, background: 'var(--bg-2)',
            color: 'var(--fg-0)', fontSize: 11.5, fontFamily: 'var(--font-mono)',
            outline: 'none', resize: 'vertical', lineHeight: 1.55,
          }}
        />
        <div style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 3 }}>Wird in den Claude Code System-Prompt eingefügt.</div>
      </div>

      {/* Apply button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 4 }}>
        <button onClick={save} disabled={applying} style={{ ...btnPrimary, opacity: applying ? 0.6 : 1 }}>
          {applying ? 'Wird angewendet…' : 'Speichern & Anwenden'}
        </button>
        {status && (
          <span style={{ fontSize: 11.5, color: status.ok ? 'var(--ok)' : 'var(--err)' }}>{status.msg}</span>
        )}
      </div>
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
        display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px', borderRadius: 6,
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
        borderRadius: 6, padding: '2px 7px', textAlign: 'center', flexShrink: 0,
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
    <section style={{ marginBottom: 6 }}>
      <SectionLabel>{label}</SectionLabel>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {presets.map(p => <PresetCard key={p.id} preset={p} active={activeId === p.id} onApply={() => onApply(p)} />)}
      </div>
    </section>
  )
}

// PresetCard — compact chip: sidebar strip + accent dot + name
function PresetCard({ preset, active, onApply }: { preset: typeof ACCENT_PRESETS[0]; active: boolean; onApply: () => void }) {
  const nameColor = preset.dark ? '#b0a898' : '#555'
  return (
    <div onClick={onApply} title={preset.name} style={{
      display: 'inline-flex', alignItems: 'center', gap: 0,
      height: 22, borderRadius: 5, overflow: 'hidden', cursor: 'pointer',
      border: `1.5px solid ${active ? preset.accent : 'var(--line-strong)'}`,
      boxShadow: active ? `0 0 0 2px ${preset.accent}33` : 'none',
      transition: 'border-color 0.12s, box-shadow 0.12s',
    }}>
      {/* Sidebar strip */}
      <div style={{ width: 8, height: '100%', background: preset.bg1, flexShrink: 0 }} />
      {/* Accent dot */}
      <div style={{ width: 6, height: '100%', background: preset.accent, flexShrink: 0 }} />
      {/* Main bg + name */}
      <div style={{ background: preset.bg0, height: '100%', display: 'flex', alignItems: 'center', padding: '0 6px', gap: 4 }}>
        <span style={{ fontSize: 9.5, fontWeight: active ? 600 : 400, color: active ? preset.accent : nameColor, whiteSpace: 'nowrap', letterSpacing: 0.1 }}>
          {preset.name}
        </span>
        {active && <span style={{ width: 3.5, height: 3.5, borderRadius: '50%', background: preset.accent, flexShrink: 0 }} />}
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, border: '1px solid var(--line-strong)', borderRadius: 6, background: 'var(--bg-2)', padding: '4px 7px', position: 'relative' }}>
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
  openai:    { label: 'OpenAI (ChatGPT)', model: 'gpt-4o',                  placeholder: 'sk-…',      docUrl: 'https://platform.openai.com/api-keys' },
  anthropic: { label: 'Anthropic (Claude)', model: 'claude-sonnet-4-6',    placeholder: 'sk-ant-…', docUrl: 'https://console.anthropic.com/account/keys' },
  groq:      { label: 'Groq (kostenlos)', model: 'llama-3.3-70b-versatile', placeholder: 'gsk_…',    docUrl: 'https://console.groq.com/keys' },
  deepseek:  { label: 'DeepSeek',          model: 'deepseek-chat',  placeholder: 'sk-…',         docUrl: 'https://platform.deepseek.com/api_keys' },
}

const AI_FUNCTIONS: { key: string; label: string; description: string }[] = [
  { key: 'terminal',      label: 'Terminal Textbox',      description: 'KI-Überarbeitung im Eingabefeld der Terminalsitzung' },
  { key: 'kanban',        label: 'Kanban User Story',     description: 'User Story generieren & überarbeiten im Kanban-Board' },
  { key: 'devDetect',     label: 'App-Start Erkennung',   description: 'Start-Befehl & Port ermitteln wenn Heuristik versagt (Play ▶ → Fallback). Liest package.json, requirements.txt usw. lokal aus und sendet sie als Text-Kontext — kein Laufwerkszugriff durch das Modell.' },
  { key: 'docUpdate',     label: 'Docu Update',           description: 'Dokumentation mit AI aktualisieren (Rechtsklick → Docu aktualisieren)' },
  { key: 'contextSearch', label: 'AI Search',             description: 'KI durchsucht die komplette Projekt-Historie und erstellt Zusammenfassungen (Tab "AI Search" im rechten Panel)' },
]

type AITab = 'keys' | 'functions' | 'provider'

const OR_REVIEW_MODELS = [
  { label: 'Claude Sonnet 4.6',  value: 'anthropic/claude-sonnet-4-6' },
  { label: 'Claude Opus 4.7',    value: 'anthropic/claude-opus-4-7' },
  { label: 'Claude Haiku 4.5',   value: 'anthropic/claude-haiku-4-5' },
  { label: 'GPT-4o',             value: 'openai/gpt-4o' },
  { label: 'GPT-4o mini',        value: 'openai/gpt-4o-mini' },
  { label: 'Gemini 2.5 Pro',     value: 'google/gemini-2.5-pro-preview' },
  { label: 'Gemini 2.5 Flash',   value: 'google/gemini-2.5-flash-preview' },
  { label: 'DeepSeek R1',        value: 'deepseek/deepseek-r1' },
  { label: 'DeepSeek V3',        value: 'deepseek/deepseek-chat' },
  { label: 'Qwen3 235B',         value: 'qwen/qwen3-235b-a22b' },
]

function AIPanel({ hideTabs = [] }: { hideTabs?: AITab[] } = {}) {
  const { aiFunctionMap, setAiFunctionMap, openrouterKey, setOpenrouterKey, codeReviewModel, setCodeReviewModel, orbitCompressModel, setOrbitCompressModel, agentCompressModel, setAgentCompressModel } = useAppStore()
  const { models, loading: orLoading } = useOpenRouterModels()
  const ALL_TABS: AITab[] = ['keys', 'functions', 'provider']
  const visibleTabs = ALL_TABS.filter(t => !hideTabs.includes(t))
  const firstVisible = visibleTabs[0] ?? 'keys'
  const [activeTab, setActiveTab] = useState<AITab>(firstVisible)
  const [editingOrKey, setEditingOrKey]   = useState(false)
  const [orKeyDraft, setOrKeyDraft]       = useState(openrouterKey)

  const tabStyle = (t: AITab): React.CSSProperties => ({
    padding: '5px 20px', border: 'none', borderRadius: 6, fontSize: 11.5, cursor: 'pointer',
    fontFamily: 'var(--font-ui)', fontWeight: activeTab === t ? 600 : 400,
    background: activeTab === t ? 'var(--accent-soft)' : 'transparent',
    color: activeTab === t ? 'var(--accent)' : 'var(--fg-2)',
  })

  const readonlyField: React.CSSProperties = {
    padding: '5px 10px', background: 'var(--bg-2)', border: '1px solid var(--line)',
    borderRadius: 6, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)',
    userSelect: 'all' as const,
  }

  const pageTitle    = firstVisible === 'functions' ? 'KI-Funktionen' : 'API Credentials'
  const pageSubtitle = firstVisible === 'functions' ? 'Modellzuweisung für interne Funktionen' : 'OpenRouter.AI'

  return (
    <div style={{ padding: '16px 20px', maxWidth: 680, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Page header */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)', marginBottom: 2 }}>{pageTitle}</div>
        <div style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>{pageSubtitle}</div>
      </div>

      {/* Centered tab bar — only if more than one tab is visible */}
      {visibleTabs.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{ display: 'flex', gap: 2, padding: 3, background: 'var(--bg-2)', borderRadius: 6, border: '1px solid var(--line)' }}>
            {!hideTabs.includes('keys')      && <button style={tabStyle('keys')}      onClick={() => setActiveTab('keys')}>API-Keys</button>}
            {!hideTabs.includes('functions') && <button style={tabStyle('functions')} onClick={() => setActiveTab('functions')}>KI-Funktionen</button>}
            {!hideTabs.includes('provider')  && <button style={tabStyle('provider')}  onClick={() => setActiveTab('provider')}>Claude Provider</button>}
          </div>
        </div>
      )}

      {/* ── Tab 1: API-Keys ─────────────────────────────────────────────── */}
      {activeTab === 'keys' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          <div style={{ border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden', background: 'var(--bg-1)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 14, padding: '10px 14px', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)' }}>OpenRouter API-Key</span>
                  {openrouterKey && !editingOrKey && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <ICheck style={{ color: 'var(--ok)', width: 12, height: 12 }} />
                      <span className="mono" style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>{openrouterKey.slice(0, 10)}···</span>
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--fg-3)', lineHeight: 1.45 }}>
                  KI-Plattform mit 300+ Modellen — wird für alle KI-Funktionen genutzt.
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                {editingOrKey ? (
                  <>
                    <input
                      style={{ width: 220, padding: '6px 10px', border: '1px solid var(--line-strong)', borderRadius: 6, background: 'var(--bg-2)', color: 'var(--fg-0)', fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none' }}
                      type="password" value={orKeyDraft} onChange={e => setOrKeyDraft(e.target.value)}
                      placeholder="sk-or-v1-..." autoFocus
                    />
                    <button onClick={() => { setOpenrouterKey(orKeyDraft.trim().replace(/[^\x20-\x7E]/g, '')); setEditingOrKey(false) }} style={btnPrimary}>Speichern</button>
                    <button onClick={() => setEditingOrKey(false)} style={btnGhost}>Abbrechen</button>
                  </>
                ) : (
                  <button onClick={() => { setEditingOrKey(true); setOrKeyDraft(openrouterKey) }} style={{ ...btnGhost, fontSize: 11.5 }}>
                    {openrouterKey ? 'Key ändern' : '+ Key hinterlegen'}
                  </button>
                )}
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ── Tab 2: KI-Funktionen ────────────────────────────────────────── */}
      {activeTab === 'functions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Function assignment — all OR-based */}
          <section>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)', marginBottom: 3 }}>Funktionszuweisung</div>
            <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginBottom: 10, lineHeight: 1.45 }}>Welches OpenRouter-Modell soll für welche interne Funktion verwendet werden? (Erfordert OpenRouter API-Key)</div>
            {!openrouterKey && (
              <div style={{ padding: '10px 14px', background: 'color-mix(in srgb, var(--warn, #f59e0b) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--warn, #f59e0b) 30%, transparent)', borderRadius: 6, fontSize: 11, color: 'var(--fg-1)', marginBottom: 12 }}>
                OpenRouter API-Key erforderlich. Bitte unter „API Credentials" → OpenRouter Key eintragen.
              </div>
            )}
            <div style={{ border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden', background: 'var(--bg-1)' }}>
              {AI_FUNCTIONS.map((fn, i) => {
                const selected = aiFunctionMap[fn.key] || ''
                return (
                  <div key={fn.key} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, padding: '10px 14px', alignItems: 'center', borderBottom: i < AI_FUNCTIONS.length - 1 ? '1px solid var(--line)' : 'none' }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)' }}>{fn.label}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginTop: 2 }}>{fn.description}</div>
                    </div>
                    <SingleCombobox
                      value={selected}
                      onChange={v => setAiFunctionMap(fn.key, v)}
                      options={orLoading ? [{ value: '', label: 'Modelle laden…' }] : models.map(m => ({ value: m.value, label: m.label, desc: m.value }))}
                      placeholder="OR-Modell wählen…"
                      searchable
                    />
                  </div>
                )
              })}
              {/* KI-Code-Review row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, padding: '10px 14px', alignItems: 'center', borderTop: '1px solid var(--line)' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)' }}>KI-Code-Review</div>
                  <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginTop: 2 }}>Modell für Code-Reviews im GitHub-Tab (Analyse, Sicherheit, Performance, Stil)</div>
                </div>
                <SingleCombobox
                  value={codeReviewModel}
                  onChange={v => setCodeReviewModel(v)}
                  options={orLoading ? [{ value: '', label: 'Modelle laden…' }] : models.map(m => ({ value: m.value, label: m.label, desc: m.value }))}
                  placeholder="OR-Modell wählen…"
                  searchable
                />
              </div>
              {/* Kontext-Komprimierung row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, padding: '10px 14px', alignItems: 'center', borderTop: '1px solid var(--line)' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)' }}>Kontext-Komprimierung (Chat)</div>
                  <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginTop: 2 }}>Verdichtet den Orbit-Chat-Verlauf beim neuen Chat automatisch auf das Wesentliche</div>
                </div>
                <SingleCombobox
                  value={orbitCompressModel}
                  onChange={v => setOrbitCompressModel(v)}
                  options={orLoading ? [{ value: '', label: 'Modelle laden…' }] : models.map(m => ({ value: m.value, label: m.label, desc: m.value }))}
                  placeholder="OR-Modell wählen…"
                  searchable
                />
              </div>
              {/* Coding Agent Komprimierung row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, padding: '10px 14px', alignItems: 'center', borderTop: '1px solid var(--line)' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)' }}>Kontext-Komprimierung (Coding Agent)</div>
                  <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginTop: 2 }}>Komprimiert Agent-Nachrichten beim Session-Neustart als Kontext — Standard: DeepSeek v4 Flash</div>
                </div>
                <SingleCombobox
                  value={agentCompressModel}
                  onChange={v => setAgentCompressModel(v)}
                  options={orLoading ? [{ value: '', label: 'Modelle laden…' }] : models.map(m => ({ value: m.value, label: m.label, desc: m.value }))}
                  placeholder="OR-Modell wählen…"
                  searchable
                />
              </div>
            </div>
          </section>

          <div style={{ padding: '10px 12px', background: 'var(--bg-2)', borderRadius: 6, border: '1px solid var(--line)', fontSize: 10.5, color: 'var(--fg-3)', lineHeight: 1.55 }}>
            <strong style={{ color: 'var(--fg-1)' }}>Hinweis:</strong> Alle KI-Funktionen laufen über OpenRouter. Klicke im Terminal-Eingabefeld auf <span style={{ fontWeight: 600, color: 'var(--accent)' }}>✦ KI</span> um Text automatisch zu überarbeiten. Keys werden lokal in <span className="mono">~/.cc-ui-data.json</span> gespeichert.
          </div>
        </div>
      )}

      {/* ── Tab 3: Claude Provider ───────────────────────────────────────── */}
      {activeTab === 'provider' && <ClaudeProviderTab />}

    </div>
  )
}

// ── Claude Provider Tab ───────────────────────────────────────────────────────

function ClaudeProviderTab({ openAddRef }: { openAddRef?: React.MutableRefObject<(() => void) | null> }) {
  const { claudeProviders, addClaudeProvider, updateClaudeProvider, removeClaudeProvider, aliases, addAlias, updateAlias, addToast } = useAppStore()
  const { models: orModels, loading: orLoading } = useOpenRouterModels()

  const emptyForm = (): Omit<ClaudeProvider, 'id' | 'endpointOk'> => ({
    name: '', baseUrl: '', authToken: '', modelName: '', orModelId: '',
  })
  const [form, setForm]         = useState(emptyForm)
  const [editId, setEditId]     = useState<string | null>(null)
  const [adding, setAdding]     = useState(false)
  const [checking, setChecking] = useState(false)
  const [endpointStatus, setEndpointStatus] = useState<boolean | null>(null)
  const [showToken, setShowToken] = useState(false)
  const [jsonDraft, setJsonDraft] = useState('')
  const [jsonError, setJsonError] = useState('')
  const [savedCmd, setSavedCmd] = useState<string | null>(null)
  const [homeDir, setHomeDir]   = useState<string>('')

  React.useEffect(() => {
    fetch('/api/home').then(r => r.json() as Promise<{ home: string }>).then(d => setHomeDir(d.home)).catch(() => {})
  }, [])

  const buildJson = (f: typeof form) => {
    const cleanUrl = (f.baseUrl || 'https://example.com').replace(/\/+$/, '')
    return JSON.stringify({
      model: 'sonnet',
      enabledPlugins: {
        'code-review@claude-plugins-official': true,
        'code-simplifier@claude-plugins-official': true,
        'commit-commands@claude-plugins-official': true,
        'context7@claude-plugins-official': true,
        'frontend-design@claude-plugins-official': true,
        'superpowers@claude-plugins-official': true,
        'typescript-lsp@claude-plugins-official': true,
        'security-guidance@claude-plugins-official': true,
      },
      env: {
        ENABLE_TOOL_SEARCH: 'true',
        CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: '1',
        ANTHROPIC_BASE_URL: cleanUrl,
        ANTHROPIC_API_KEY: f.authToken || '<your-token>',
        API_TIMEOUT_MS: '3000000',
        CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
        ANTHROPIC_MODEL: f.modelName || '<model>',
        ANTHROPIC_SMALL_FAST_MODEL: f.modelName || '<model>',
        ANTHROPIC_DEFAULT_SONNET_MODEL: f.modelName || '<model>',
        ANTHROPIC_DEFAULT_OPUS_MODEL: f.modelName || '<model>',
        ANTHROPIC_DEFAULT_HAIKU_MODEL: f.modelName || '<model>',
      },
    }, null, 2)
  }

  const syncJson = (f: typeof form) => { setJsonDraft(buildJson(f)); setJsonError('') }

  const updateForm = (patch: Partial<typeof form>) => {
    const next = { ...form, ...patch }
    setForm(next)
    syncJson(next)
  }

  const openAdd = () => {
    setAdding(true); setEditId(null)
    const f = emptyForm(); setForm(f); syncJson(f); setEndpointStatus(null)
  }
  if (openAddRef) openAddRef.current = openAdd
  const openEdit = (p: ClaudeProvider) => {
    setEditId(p.id); setAdding(false)
    const f = { name: p.name, baseUrl: p.baseUrl, authToken: p.authToken, modelName: p.modelName, orModelId: p.orModelId ?? '' }
    setForm(f)
    setJsonDraft(p.settingsJson ?? buildJson(f))
    setJsonError('')
    setEndpointStatus(p.endpointOk ?? null)
  }
  const cancel = () => { setAdding(false); setEditId(null); setEndpointStatus(null); setJsonError('') }

  const save = async () => {
    if (!form.name.trim()) return
    try { JSON.parse(jsonDraft) } catch { setJsonError('Ungültiges JSON'); return }

    const providerId = editId ?? `cp${Date.now()}`
    const jsonPath   = `~/cc-ui-providers/${providerId}.json`
    const shellName  = 'cc-' + form.name.trim().toLowerCase().replace(/[^a-z0-9]/g, '')

    const fullJsonPath = `${homeDir || '~'}/cc-ui-providers/${providerId}.json`
    const envPrefix = [
      form.baseUrl.trim()    ? `ANTHROPIC_BASE_URL=${form.baseUrl.trim().replace(/\/+$/, '')}` : '',
      form.authToken.trim()  ? `ANTHROPIC_API_KEY=${form.authToken.trim()}` : '',
      form.modelName.trim()  ? `ANTHROPIC_MODEL=${form.modelName.trim()}` : '',
      'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1',
    ].filter(Boolean).join(' ')
    const aliasCmd = `${envPrefix} claude --bare --settings ${fullJsonPath}`

    try {
      // Write JSON settings file
      await fetch('/api/file-write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: jsonPath, content: jsonDraft }),
      })

      // Write alias directly into ~/.zshrc
      await fetch('/api/zshrc-alias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aliasName: shellName, aliasCmd }),
      })
    } catch (e) {
      setJsonError(`Fehler beim Speichern: ${String(e)}`)
      return
    }

    const data: Omit<ClaudeProvider, 'id'> = {
      name: form.name.trim(),
      baseUrl: form.baseUrl.trim(),
      authToken: form.authToken.trim(),
      modelName: form.modelName.trim(),
      orModelId: form.orModelId || undefined,
      endpointOk: endpointStatus ?? undefined,
      settingsJson: jsonDraft,
    }

    if (adding) {
      addClaudeProvider({ id: providerId, ...data })
    } else if (editId) {
      updateClaudeProvider(editId, data)
    }

    // Sync Terminal alias — create or update so it appears in the Aliases list
    const displayName = form.name.trim()
    const existingAlias = aliases.find(a => a.cmd === shellName || a.id === `alias-${providerId}`)
    if (existingAlias) {
      updateAlias(existingAlias.id, { name: displayName, cmd: shellName, args: '' })
    } else {
      addAlias({
        id: `alias-${providerId}`,
        name: displayName,
        cmd: shellName,
        args: '',
        permMode: 'normal',
        status: 'ok',
      })
    }

    const savedAliasCmd = `alias ${shellName}='${aliasCmd}'`
    setSavedCmd(savedAliasCmd)
    setAdding(false); setEditId(null); setEndpointStatus(null); setJsonError('')
    addToast({ type: 'success', title: 'Provider gespeichert', body: savedAliasCmd, duration: 5000 })
  }

  const checkEndpoint = async () => {
    if (!form.baseUrl.trim()) return
    setChecking(true)
    setEndpointStatus(null)
    const cleanUrl = form.baseUrl.replace(/\/+$/, '')
    try {
      const r = await fetch(`${cleanUrl}/v1/models`, {
        headers: form.authToken ? { 'Authorization': `Bearer ${form.authToken}` } : {},
        signal: AbortSignal.timeout(5000),
      })
      setEndpointStatus(r.status < 500)
    } catch {
      setEndpointStatus(false)
    } finally {
      setChecking(false)
    }
  }

  // When OrModel picked, auto-fill name + modelName from OpenRouter label
  const handleOrModelChange = (v: string) => {
    const m = orModels.find(m => m.value === v)
    const autoName = m ? m.label : v.split('/').pop() ?? v
    updateForm({ orModelId: v, modelName: autoName, name: form.name || autoName })
  }

  const showForm = adding || editId !== null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 10.5, color: 'var(--fg-3)', lineHeight: 1.55 }}>
        Definiere einen LLM-Provider mit eigenem API-Endpunkt. Die generierte <span className="mono">claude.json</span>-Config setzt Env-Vars, die claude CLI beim Start liest. Provider tauchen beim Erstellen einer Session als Modell-Option auf.
      </div>

      {/* Provider list */}
      {!showForm && (
        <>
          <div style={{ border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden', background: 'var(--bg-1)' }}>
            {claudeProviders.length === 0 && (
              <div style={{ padding: '16px', textAlign: 'center', color: 'var(--fg-3)', fontSize: 11.5 }}>
                Noch kein Provider angelegt.
              </div>
            )}
            {claudeProviders.map((p, i) => (
              <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 14, padding: '10px 14px', alignItems: 'center', borderBottom: i < claudeProviders.length - 1 ? '1px solid var(--line)' : 'none' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)' }}>{p.name}</span>
                    {p.endpointOk === true  && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 99, background: 'rgba(100,200,100,0.12)', border: '1px solid rgba(100,200,100,0.4)', color: '#6dc87a', fontWeight: 600 }}>✓ online</span>}
                    {p.endpointOk === false && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 99, background: 'rgba(239,120,120,0.12)', border: '1px solid rgba(239,120,120,0.4)', color: '#ef7a7a', fontWeight: 600 }}>✕ offline</span>}
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>{p.baseUrl} · {p.modelName}</div>
                  <div style={{ fontSize: 10, color: 'var(--accent)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{'cc-' + p.name.trim().toLowerCase().replace(/[^a-z0-9]/g, '')}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                  <button onClick={() => openEdit(p)} style={{ ...btnGhost, fontSize: 11, padding: '4px 10px' }}>Bearbeiten</button>
                  <button onClick={() => removeClaudeProvider(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-3)', padding: 4 }}><ITrash style={{ width: 13, height: 13 }} /></button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Form */}
      {showForm && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* 1. Model from OpenRouter — first */}
          <div>
            <label style={fieldLabel}>Modell (OpenRouter-Referenz)</label>
            <SingleCombobox
              value={form.orModelId ?? ''}
              onChange={handleOrModelChange}
              searchable
              loading={orLoading}
              options={orModels.length > 0 ? orModels.map(m => ({ value: m.value, label: m.label })) : []}
              placeholder="Modell aus OpenRouter wählen…"
            />
            <div style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 4 }}>Wähle ein Modell — Name und API-Name werden automatisch befüllt.</div>
          </div>

          {/* 2. Name — auto-filled from OR selection */}
          <div>
            <label style={fieldLabel}>Name</label>
            <input style={fieldInput} value={form.name} onChange={e => updateForm({ name: e.target.value })} placeholder="z.B. MiniMax M2.7" />
          </div>

          {/* 3. Base URL + endpoint check */}
          <div>
            <label style={fieldLabel}>Base URL</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                style={{ ...fieldInput, flex: 1 }}
                value={form.baseUrl}
                onChange={e => { updateForm({ baseUrl: e.target.value }); setEndpointStatus(null) }}
                placeholder="https://api.minimax.io"
              />
              <button
                onClick={() => { void checkEndpoint() }}
                disabled={checking || !form.baseUrl.trim()}
                style={{ ...btnGhost, padding: '5px 12px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, opacity: !form.baseUrl.trim() ? 0.5 : 1 }}
              >
                {checking
                  ? <span style={{ fontSize: 10 }}>…</span>
                  : endpointStatus === true  ? <span style={{ color: '#6dc87a', fontWeight: 700 }}>✓ online</span>
                  : endpointStatus === false ? <span style={{ color: '#ef7a7a', fontWeight: 700 }}>✕ offline</span>
                  : 'Prüfen'}
              </button>
            </div>
          </div>

          {/* 4. Auth token */}
          <div>
            <label style={fieldLabel}>Auth Token</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                style={{ ...fieldInput, flex: 1, fontFamily: showToken ? 'var(--font-mono)' : 'monospace' }}
                type={showToken ? 'text' : 'password'}
                value={form.authToken}
                onChange={e => updateForm({ authToken: e.target.value })}
                placeholder="sk-…"
              />
              <button onClick={() => setShowToken(s => !s)} style={{ ...btnGhost, padding: '5px 10px', fontSize: 11 }}>{showToken ? 'Verstecken' : 'Anzeigen'}</button>
            </div>
          </div>

          {/* 5. Model name for API */}
          <div>
            <label style={fieldLabel}>Modell-Name für API <span style={{ color: 'var(--accent)', fontWeight: 400 }}>(füllt ANTHROPIC_MODEL_* Felder)</span></label>
            <input
              style={fieldInput}
              value={form.modelName}
              onChange={e => updateForm({ modelName: e.target.value })}
              placeholder="z.B. kimi-k2"
            />
          </div>

          {/* 6. Editable JSON */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
              <label style={{ ...fieldLabel, marginBottom: 0 }}>claude.json — direkt bearbeitbar</label>
              <button
                onClick={() => navigator.clipboard.writeText(jsonDraft)}
                style={{ ...btnGhost, padding: '2px 8px', fontSize: 9.5, marginLeft: 'auto' }}
              >Kopieren</button>
            </div>
            <textarea
              value={jsonDraft}
              onChange={e => { setJsonDraft(e.target.value); setJsonError('') }}
              spellCheck={false}
              style={{ ...fieldInput, fontFamily: 'var(--font-mono)', fontSize: 10.5, lineHeight: 1.55, minHeight: 260, resize: 'vertical', whiteSpace: 'pre', overflowX: 'auto', color: jsonError ? 'var(--err)' : 'var(--fg-1)' }}
            />
            {jsonError && <div style={{ fontSize: 10, color: 'var(--err)', marginTop: 3 }}>{jsonError}</div>}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={btnGhost} onClick={cancel}>Abbrechen</button>
            <button
              style={{ ...btnPrimary, opacity: !form.name.trim() ? 0.5 : 1 }}
              disabled={!form.name.trim()}
              onClick={save}
            >
              <ICheck style={{ width: 13, height: 13 }} /> Speichern
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Vorlagen Panel (Doc Templates + AI Prompts + User Stories) ───────────────

type VorlagenTab = 'docs' | 'prompts' | 'template-prompts'

// Where each built-in template is actively used — shown in the list as a usage badge
const TEMPLATE_USAGE: Record<string, { screen: string; element: string }> = {
  'ai-prompt-doc-update':        { screen: 'Workspace',  element: 'Docs-Button (neben Play ▶)' },
  'ai-prompt-text-refine':       { screen: 'Workspace',  element: 'AI ✦ im Eingabefeld (Terminal)' },
  'ai-prompt-user-story-format': { screen: 'Kanban',     element: 'AI-Button „Als User Story"' },
  'ai-prompt-start-detect':      { screen: 'Workspace',  element: 'Play ▶ → AI erkennt Start-Befehl' },
  'user-story-analyse':          { screen: 'Kanban',     element: 'AI-Button „Mit Docs analysieren" ⚡' },
  'ai-prompt-context-search':    { screen: 'Utility-Panel', element: 'Tab „Research" → Suchen' },
  'prompt-support':              { screen: 'Workspace',  element: 'AI ⚡ im Eingabefeld (Implementierungsauftrag)' },
}

const VORLAGEN_TABS: { key: VorlagenTab; label: string; hint: string; pathLabel: string; contentLabel: string; pathPlaceholder: string; contentPlaceholder: string; needsPath: boolean; defaultCategory: string; adminOnly?: boolean }[] = [
  { key: 'docs',             label: 'Dokumentationen', hint: 'Dateien die beim Erstellen eines Projekts angelegt werden.',                              pathLabel: 'Pfad im Projekt', contentLabel: 'Inhalt (Markdown)', pathPlaceholder: 'z.B. Docs/RULES.md', contentPlaceholder: '# Regeln\n…',                     needsPath: true,  defaultCategory: 'doc' },
  { key: 'prompts',          label: 'System Prompts',  hint: 'System-Prompts für AI-Funktionen sowie User-Story-Vorlagen im Kanban.',                   pathLabel: 'Kürzel / Label',  contentLabel: 'System-Prompt',    pathPlaceholder: 'z.B. formal-de',    contentPlaceholder: 'Du bist ein professioneller Texter…', needsPath: false, defaultCategory: 'ai-prompt' },
  { key: 'template-prompts', label: 'Prompt-Vorlagen', hint: 'Global-Prompts die Nutzer beim ersten Login als persönliche Kopien erhalten (⌘1–⌘6).', pathLabel: '',                contentLabel: 'Prompt-Text',      pathPlaceholder: '',                  contentPlaceholder: 'Analysiere zuerst alle relevanten Dateien…', needsPath: false, defaultCategory: '', adminOnly: true },
]

function DocTemplatesPanel({ isAdmin = false }: { isAdmin?: boolean }) {
  const { docTemplates, addDocTemplate, updateDocTemplate, removeDocTemplate, setDocTemplates, currentUser, supabaseUrl, supabaseAnonKey, templates, addTemplate, updateTemplate, removeTemplate,
    orbitCompressPrompt, setOrbitCompressPrompt,
    agentCompressPrompt, setAgentCompressPrompt,
    brainUpdatePrompt, setBrainUpdatePrompt,
  } = useAppStore()
  const [activeTab, setActiveTab] = useState<VorlagenTab>('docs')
  const [editId, setEditId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  // Template-prompts form state
  const [tplEditId, setTplEditId] = useState<string | null>(null)
  const [tplAdding, setTplAdding] = useState(false)
  type TplForm = { name: string; hint: string; body: string; tag: string; favorite: boolean }
  const emptyTplForm = (): TplForm => ({ name: '', hint: '', body: '', tag: '', favorite: false })
  const [tplForm, setTplForm] = useState<TplForm>(emptyTplForm())

  // Non-admins only see the 'docs' tab; admins see all tabs
  const visibleTabs = isAdmin ? VORLAGEN_TABS : VORLAGEN_TABS.filter(t => t.key === 'docs')

  const tabCfg = VORLAGEN_TABS.find(t => t.key === activeTab)!
  const emptyForm = (): Omit<DocTemplate, 'id'> => ({ name: '', relativePath: '', content: '', enabled: true, category: tabCfg.defaultCategory as DocTemplate['category'] })
  const [form, setForm] = useState<Omit<DocTemplate, 'id'>>(emptyForm())

  const filtered = activeTab === 'docs'
    ? docTemplates.filter(t => (t.category ?? 'doc') === 'doc')
    : docTemplates.filter(t => t.category === 'ai-prompt' || t.category === 'user-story' || t.category === 'prompt-support')

  const tabCount = (tab: VorlagenTab) => {
    if (tab === 'docs') return docTemplates.filter(t => (t.category ?? 'doc') === 'doc').length
    if (tab === 'prompts') return docTemplates.filter(t => t.category === 'ai-prompt' || t.category === 'user-story' || t.category === 'prompt-support').length
    return templates.length
  }

  // After any admin mutation, push to global_config
  const pushGlobal = (tmpl: DocTemplate[]) => {
    if (!isAdmin || !currentUser?.id) return
    const sb = getSupabase(supabaseUrl, supabaseAnonKey)
    if (sb) void saveGlobalTemplates(sb, currentUser.id, tmpl)
  }

  const pushGlobalPrompts = (tmpl: Template[]) => {
    if (!isAdmin || !currentUser?.id) return
    const sb = getSupabase(supabaseUrl, supabaseAnonKey)
    if (sb) void saveGlobalPrompts(sb, currentUser.id, tmpl)
  }

  const switchTab = (tab: VorlagenTab) => { setActiveTab(tab); cancel() }
  const openAdd  = () => {
    if (activeTab === 'template-prompts') { setTplAdding(true); setTplEditId(null); setTplForm(emptyTplForm()); return }
    setAdding(true); setEditId(null); setForm(emptyForm())
  }
  const openEdit = (t: DocTemplate) => { setEditId(t.id); setAdding(false); setForm({ name: t.name, relativePath: t.relativePath, content: t.content, enabled: t.enabled, category: t.category ?? 'doc' }) }
  const cancel   = () => { setAdding(false); setEditId(null); setTplAdding(false); setTplEditId(null) }

  const handleReset = () => {
    const nonDocTemplates = docTemplates.filter(t => t.category === 'ai-prompt' || t.category === 'user-story' || t.category === 'prompt-support')
    const defaultDocTemplates = DEFAULT_DOC_TEMPLATES.filter(t => (t.category ?? 'doc') === 'doc')
    const next = [...defaultDocTemplates, ...nonDocTemplates]
    setDocTemplates(next)
    if (isAdmin) pushGlobal(next)
    setShowResetConfirm(false)
    cancel()
  }

  const canSave = form.name.trim() && (tabCfg.needsPath ? form.relativePath.trim() : true) && form.content.trim()

  const save = () => {
    if (!canSave) return
    const entry = { ...form, name: form.name.trim(), relativePath: form.relativePath.trim(), category: form.category }
    let next: DocTemplate[]
    if (adding) {
      const newDoc = { id: `dt${Date.now()}`, ...entry }
      addDocTemplate(newDoc)
      next = [...docTemplates, newDoc]
    } else if (editId) {
      updateDocTemplate(editId, entry)
      next = docTemplates.map(t => t.id === editId ? { ...t, ...entry } : t)
    } else { cancel(); return }
    if (isAdmin) pushGlobal(next)
    cancel()
  }

  const tabStyle = (t: VorlagenTab): React.CSSProperties => ({
    padding: '5px 20px', border: 'none', borderRadius: 6, fontSize: 11.5, cursor: 'pointer',
    fontFamily: 'var(--font-ui)', fontWeight: activeTab === t ? 600 : 400,
    background: activeTab === t ? 'var(--accent-soft)' : 'transparent',
    color: activeTab === t ? 'var(--accent)' : 'var(--fg-2)',
  })

  return (
    <div style={{ padding: '16px 20px', maxWidth: 680, margin: '0 auto' }}>
      {/* Reset confirmation dialog */}
      {showResetConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg-1)', border: '1px solid var(--line-strong)', borderRadius: 10, padding: '24px 28px', maxWidth: 380, width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.28)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-0)', marginBottom: 10 }}>Vorlagen zurücksetzen?</div>
            <p style={{ fontSize: 12.5, color: 'var(--fg-2)', lineHeight: 1.6, margin: '0 0 20px' }}>
              Alle deine Dokumentations-Vorlagen werden durch die Standard-Vorlagen überschrieben. Deine Änderungen gehen dabei verloren.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={btnGhost} onClick={() => setShowResetConfirm(false)}>Abbrechen</button>
              <button style={{ ...btnPrimary, background: 'var(--err, #ef4444)', width: 'auto', padding: '8px 16px' }} onClick={handleReset}>Zurücksetzen</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)', marginBottom: 2 }}>Vorlagen</div>
          <div style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>{tabCfg.hint}</div>
        </div>
        <span style={{ flex: 1 }} />
        {activeTab === 'docs' && (
          <button style={{ ...btnGhost, marginRight: 8, fontSize: 11.5 }} onClick={() => setShowResetConfirm(true)}>↺ Zurücksetzen</button>
        )}
        <button style={btnPrimary} onClick={openAdd}><IPlus />Neu</button>
      </div>

      {/* Centered tab bar — only shown for admins (non-admins only have 'docs') */}
      {visibleTabs.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 2, padding: 3, background: 'var(--bg-2)', borderRadius: 6, border: '1px solid var(--line)' }}>
            {visibleTabs.map(tab => (
              <button key={tab.key} onClick={() => switchTab(tab.key)} style={tabStyle(tab.key)}>
                {tab.label}
                {tabCount(tab.key) > 0 && (
                  <span style={{ marginLeft: 5, fontSize: 10, background: activeTab === tab.key ? 'var(--accent-soft)' : 'var(--bg-3)', color: activeTab === tab.key ? 'var(--accent)' : 'var(--fg-3)', borderRadius: 6, padding: '1px 5px' }}>
                    {tabCount(tab.key)}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── System-Prompt-Editoren (nur Admin, nur prompts-Tab) ── */}
      {isAdmin && activeTab === 'prompts' && (
        <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--fg-3)', marginBottom: 2 }}>
            System-Prompts — Komprimierung &amp; Brain
          </div>

          {/* Orbit Chat Komprimierung */}
          <div style={{ background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 6, padding: '14px 16px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)', marginBottom: 2 }}>Orbit Chat — Kontext-Komprimierung</div>
            <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginBottom: 10, lineHeight: 1.5 }}>
              Verdichtet den Chat-Verlauf beim Start eines neuen Orbit-Chats. Modell: <b>KI-Funktionen → Kontext-Komprimierung (Chat)</b>
            </div>
            <textarea
              value={orbitCompressPrompt}
              onChange={e => setOrbitCompressPrompt(e.target.value)}
              rows={7}
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid var(--line-strong)', borderRadius: 5, background: 'var(--bg-2)', color: 'var(--fg-0)', fontSize: 11, fontFamily: 'var(--font-mono)', lineHeight: 1.55, outline: 'none', resize: 'vertical' }}
            />
          </div>

          {/* Coding Agent Komprimierung */}
          <div style={{ background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 6, padding: '14px 16px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)', marginBottom: 2 }}>Coding Agent — Kontext-Komprimierung</div>
            <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginBottom: 10, lineHeight: 1.5 }}>
              Komprimiert Agent-Nachrichten beim Session-Neustart. Modell: <b>KI-Funktionen → Kontext-Komprimierung (Coding Agent)</b>
            </div>
            <textarea
              value={agentCompressPrompt}
              onChange={e => setAgentCompressPrompt(e.target.value)}
              rows={5}
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid var(--line-strong)', borderRadius: 5, background: 'var(--bg-2)', color: 'var(--fg-0)', fontSize: 11, fontFamily: 'var(--font-mono)', lineHeight: 1.55, outline: 'none', resize: 'vertical' }}
            />
          </div>

          {/* Project Brain Update */}
          <div style={{ background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 6, padding: '14px 16px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)', marginBottom: 2 }}>Project Brain — Update-Prompt</div>
            <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginBottom: 6, lineHeight: 1.5 }}>
              Wird alle 5 Orbit-Antworten aufgerufen um den Projekt-Kontext zu aktualisieren. Leer = Standard-Prompt.
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {['{brain}', '{messages}', '{n}', '{date}', '{projectName}'].map(ph => (
                <span key={ph} style={{ fontSize: 10, fontFamily: 'var(--font-mono)', background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 4, padding: '1px 6px', color: 'var(--accent)', cursor: 'pointer' }}
                  title={`Platzhalter: ${ph}`}>{ph}</span>
              ))}
              <span style={{ fontSize: 10, color: 'var(--fg-3)', alignSelf: 'center' }}>→ Platzhalter die ersetzt werden</span>
            </div>
            <textarea
              value={brainUpdatePrompt}
              onChange={e => setBrainUpdatePrompt(e.target.value)}
              rows={10}
              placeholder="Leer lassen um den Standard-Prompt zu nutzen…"
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid var(--line-strong)', borderRadius: 5, background: 'var(--bg-2)', color: 'var(--fg-0)', fontSize: 11, fontFamily: 'var(--font-mono)', lineHeight: 1.55, outline: 'none', resize: 'vertical' }}
            />
          </div>

          <div style={{ height: 1, background: 'var(--line)', marginTop: 4 }} />
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--fg-3)', marginBottom: 2 }}>
            Weitere System Prompts
          </div>
        </div>
      )}

      {/* ── DocTemplate list + form (docs / prompts tabs) ── */}
      {activeTab !== 'template-prompts' && (<>
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
                        <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 6, background: 'var(--accent-soft)', color: 'var(--accent)', fontWeight: 600, whiteSpace: 'nowrap' }}>{usage.screen}</span>
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
                      <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 6, border: '1px solid var(--line)', color: 'var(--fg-3)', whiteSpace: 'nowrap' }}>built-in</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <IEdit style={{ color: 'var(--fg-3)', cursor: 'pointer' }} onClick={() => openEdit(t)} />
                    <ITrash style={{ color: 'var(--err)', cursor: 'pointer' }} onClick={() => { if (confirm(`"${t.name}" löschen?`)) { removeDocTemplate(t.id); if (isAdmin) pushGlobal(docTemplates.filter(d => d.id !== t.id)) } }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}

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
      </>)}

      {/* ── Prompt-Vorlagen list + form (template-prompts tab, admin-only) ── */}
      {activeTab === 'template-prompts' && (<>
        {templates.length === 0 && !tplAdding && (
          <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--fg-3)', fontSize: 12, border: '1px dashed var(--line)', borderRadius: 6 }}>
            Keine Prompt-Vorlagen vorhanden.
          </div>
        )}

        {templates.length > 0 && (
          <div style={{ border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden', background: 'var(--bg-1)', marginBottom: 16 }}>
            {templates.map((t, i) => (
              <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto 44px', padding: '9px 14px', alignItems: 'center', gap: 12, fontSize: 12, borderBottom: i < templates.length - 1 ? '1px solid var(--line)' : 'none', background: t.id === tplEditId ? 'var(--accent-soft)' : 'transparent' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontWeight: 600, color: 'var(--fg-0)' }}>{t.name}</span>
                    {t.hint && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 6, background: 'var(--bg-3)', color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>{t.hint}</span>}
                    {t.tag && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 6, background: 'var(--accent-soft)', color: 'var(--accent)', fontWeight: 600 }}>{t.tag}</span>}
                    {t.favorite && <IStar style={{ width: 11, height: 11, color: 'var(--accent)' }} />}
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.body}</div>
                </div>
                <span style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>{t.uses}×</span>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <IEdit style={{ color: 'var(--fg-3)', cursor: 'pointer' }} onClick={() => { setTplEditId(t.id); setTplAdding(false); setTplForm({ name: t.name, hint: t.hint, body: t.body, tag: t.tag, favorite: !!t.favorite }) }} />
                  <ITrash style={{ color: 'var(--err)', cursor: 'pointer' }} onClick={() => { if (confirm(`"${t.name}" löschen?`)) { const next = templates.filter(p => p.id !== t.id); removeTemplate(t.id); pushGlobalPrompts(next) } }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {(tplAdding || tplEditId) && (
          <div style={{ border: '1px solid var(--line)', borderRadius: 6, padding: 16, background: 'var(--bg-1)', marginTop: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)', marginBottom: 14 }}>{tplAdding ? 'Neue Prompt-Vorlage' : 'Bearbeiten'}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={fieldLabel}>Name</label>
                <input style={fieldInput} value={tplForm.name} onChange={e => setTplForm(f => ({ ...f, name: e.target.value }))} placeholder="z.B. Analyze first" autoFocus />
              </div>
              <div>
                <label style={fieldLabel}>Shortcut-Hint</label>
                <input style={fieldInput} value={tplForm.hint} onChange={e => setTplForm(f => ({ ...f, hint: e.target.value }))} placeholder="z.B. ⌘1" />
              </div>
              <div>
                <label style={fieldLabel}>Tag</label>
                <input style={fieldInput} value={tplForm.tag} onChange={e => setTplForm(f => ({ ...f, tag: e.target.value }))} placeholder="z.B. planning, safety, debug" />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                <label style={{ fontSize: 12, color: 'var(--fg-1)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 2 }}>
                  <input type="checkbox" checked={tplForm.favorite} onChange={e => setTplForm(f => ({ ...f, favorite: e.target.checked }))} />
                  Favorit
                </label>
              </div>
              <div style={{ gridColumn: '1 / span 2' }}>
                <label style={fieldLabel}>Prompt-Text</label>
                <textarea style={{ ...fieldInput, minHeight: 200, resize: 'vertical', lineHeight: 1.5 }} value={tplForm.body} onChange={e => setTplForm(f => ({ ...f, body: e.target.value }))} placeholder="Analysiere zuerst alle relevanten Dateien…" spellCheck={false} />
              </div>
              <div style={{ gridColumn: '1 / span 2', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button style={btnGhost} onClick={cancel}>Abbrechen</button>
                <button
                  style={{ ...btnPrimary, opacity: tplForm.name.trim() && tplForm.body.trim() ? 1 : 0.5 }}
                  disabled={!tplForm.name.trim() || !tplForm.body.trim()}
                  onClick={() => {
                    if (!tplForm.name.trim() || !tplForm.body.trim()) return
                    let next: Template[]
                    if (tplAdding) {
                      const newT: Template = { id: `tp${Date.now()}`, name: tplForm.name.trim(), hint: tplForm.hint.trim(), body: tplForm.body.trim(), tag: tplForm.tag.trim(), uses: 0, favorite: tplForm.favorite }
                      addTemplate(newT)
                      next = [...templates, newT]
                    } else {
                      updateTemplate(tplEditId!, { name: tplForm.name.trim(), hint: tplForm.hint.trim(), body: tplForm.body.trim(), tag: tplForm.tag.trim(), favorite: tplForm.favorite })
                      next = templates.map(p => p.id === tplEditId ? { ...p, name: tplForm.name.trim(), hint: tplForm.hint.trim(), body: tplForm.body.trim(), tag: tplForm.tag.trim(), favorite: tplForm.favorite } : p)
                    }
                    pushGlobalPrompts(next)
                    cancel()
                  }}
                >
                  {tplAdding ? 'Speichern' : 'Aktualisieren'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div style={{ marginTop: 16, padding: 12, background: 'var(--bg-2)', borderRadius: 6, border: '1px solid var(--line)', fontSize: 11, color: 'var(--fg-3)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--fg-1)' }}>Hinweis:</strong> Neue Nutzer erhalten diese Prompt-Vorlagen beim ersten Login als persönliche Kopien. Änderungen durch den Admin betreffen nur neue Nutzer — bestehende Nutzer behalten ihre eigenen Versionen.
        </div>
      </>)}

      {activeTab === 'docs' && (
        <div style={{ marginTop: 16, padding: 12, background: 'var(--bg-2)', borderRadius: 6, border: '1px solid var(--line)', fontSize: 11, color: 'var(--fg-3)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--fg-1)' }}>Hinweis:</strong> Aktivierte Vorlagen werden beim Anlegen neuer Projekte automatisch erstellt. Der Docs-Refresh-Button (↑) im Projekt-Header aktualisiert bestehende Dateien mit AI.
        </div>
      )}
    </div>
  )
}

// ── Kontext Management panel ──────────────────────────────────────────────────
function KontextMgmtPanel() {
  const {
    orbitCtxBefore, orbitCtxAfter, setOrbitCtxBefore, setOrbitCtxAfter,
    orbitCompressModel, setOrbitCompressModel,
    openrouterKey, orbitMessages, activeOrbitChatId, setOrbitMessages,
    agentContextMsgCount, setAgentContextMsgCount,
    agentAutoCompressOnStart, setAgentAutoCompressOnStart,
    agentTailMessageCount, setAgentTailMessageCount,
    addToast: addToastKontext,
  } = useAppStore()
  const { models: orModels, loading: orLoading } = useOpenRouterModels()

  const [tab, setTab] = useState<'chat' | 'agent' | 'verdichten'>('chat')
  const [compressing, setCompressing] = useState(false)
  const [compressResult, setCompressResult] = useState<string | null>(null)
  const [applied, setApplied] = useState(false)

  const numInput: React.CSSProperties = {
    width: 72, padding: '6px 10px', border: '1px solid var(--line-strong)',
    borderRadius: 6, background: 'var(--bg-2)', color: 'var(--fg-0)',
    fontSize: 13, fontFamily: 'var(--font-mono)', outline: 'none',
  }
  const tabBtn = (active: boolean): React.CSSProperties => ({
    padding: '5px 16px', borderRadius: 6, border: 'none', cursor: 'pointer',
    fontSize: 11.5, fontFamily: 'var(--font-ui)', fontWeight: active ? 600 : 400,
    background: active ? 'var(--accent-soft)' : 'transparent',
    color: active ? 'var(--accent)' : 'var(--fg-2)',
  })

  const activeChatId = Object.values(activeOrbitChatId)[0] ?? ''
  const chatMsgs = orbitMessages[activeChatId] ?? []

  const runCompress = async () => {
    if (!openrouterKey || chatMsgs.length === 0) return
    setCompressing(true)
    setCompressResult(null)
    setCompressError(null)
    setApplied(false)
    try {
      const history = chatMsgs
        .map(m => `[${m.role === 'user' ? 'User' : 'AI'}]: ${m.content}`)
        .join('\n\n')
      const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sanitizeKey(openrouterKey)}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
        },
        body: JSON.stringify({
          model: orbitCompressModel,
          stream: false,
          messages: [
            { role: 'user', content: `${orbitCompressPrompt}\n\n---\n\n${history}` },
          ],
        }),
      })
      if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`)
      const json = await resp.json() as { choices?: { message?: { content?: string } }[] }
      const result = json.choices?.[0]?.message?.content ?? ''
      if (!result) throw new Error('Leere Antwort vom Modell')
      setCompressResult(result)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      addToastKontext({ type: 'error', title: 'Komprimierung fehlgeschlagen', body: msg })
    } finally {
      setCompressing(false)
    }
  }

  const applyCompression = () => {
    if (!compressResult || !activeChatId) return
    const summaryMsg = {
      id: `om-compress-${Date.now()}`,
      role: 'assistant' as const,
      content: `**[Kontext-Zusammenfassung]**\n\n${compressResult}`,
      ts: Date.now(),
    }
    setOrbitMessages(activeChatId, [summaryMsg])
    setApplied(true)
  }

  const card: React.CSSProperties = {
    background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 8,
    padding: '16px 18px', marginBottom: 12,
  }
  const cardTitle: React.CSSProperties = {
    fontSize: 13, fontWeight: 600, color: 'var(--fg-0)', marginBottom: 4,
  }
  const cardSub: React.CSSProperties = {
    fontSize: 11, color: 'var(--fg-3)', lineHeight: 1.6, marginBottom: 14,
  }

  return (
    <div style={{ padding: '16px 20px', maxWidth: 680, margin: '0 auto' }}>
      {/* Page header — same as AgentsPanel */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)', marginBottom: 2 }}>Kontext Management</div>
          <div style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>Referenz-IDs, Kontext-Fenster</div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 2, padding: 3, background: 'var(--bg-2)', borderRadius: 6, border: '1px solid var(--line)' }}>
          <button style={tabBtn(tab === 'chat')} onClick={() => setTab('chat')}>ID-Kontext</button>
          <button style={tabBtn(tab === 'agent')} onClick={() => setTab('agent')}>Coding Agent</button>
          <button style={tabBtn(tab === 'verdichten')} onClick={() => setTab('verdichten')}>Orbit Chat</button>
        </div>
      </div>

      {tab === 'chat' && (
        <>
          <div style={{ fontSize: 11.5, color: 'var(--fg-3)', marginBottom: 16, lineHeight: 1.6 }}>
            Wenn du in einer Orbit-Nachricht eine Referenz-ID verwendest (<code style={{ fontFamily: 'var(--font-mono)', background: 'var(--bg-2)', padding: '1px 5px', borderRadius: 3, fontSize: 11 }}>#msg:om-…</code> oder <code style={{ fontFamily: 'var(--font-mono)', background: 'var(--bg-2)', padding: '1px 5px', borderRadius: 3, fontSize: 11 }}>#chat:oc-…</code>), wird der Kontext automatisch an die KI mitgegeben.
          </div>

          <div style={card}>
            <div style={cardTitle}>Kontext-Fenster</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={fieldLabel}>Nachrichten davor</label>
                <input type="number" min={0} max={20} value={orbitCtxBefore}
                  onChange={e => setOrbitCtxBefore(Math.max(0, Math.min(20, Number(e.target.value))))}
                  style={numInput} />
                <span style={{ fontSize: 10, color: 'var(--fg-3)' }}>Nachrichten vor der Referenz-Nachricht</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={fieldLabel}>Nachrichten danach</label>
                <input type="number" min={0} max={20} value={orbitCtxAfter}
                  onChange={e => setOrbitCtxAfter(Math.max(0, Math.min(20, Number(e.target.value))))}
                  style={numInput} />
                <span style={{ fontSize: 10, color: 'var(--fg-3)' }}>Nachrichten nach der Referenz-Nachricht</span>
              </div>
            </div>
          </div>

          <div style={card}>
            <div style={cardTitle}>ID-Schema</div>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--fg-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Orbit</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11, marginBottom: 14 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
                <code style={{ color: 'var(--orbit)', minWidth: 90, fontFamily: 'var(--font-mono)' }}>#chat:oc-…</code>
                <span style={{ color: 'var(--fg-3)' }}>Orbit-Chat — kopierbar im Chat-Header oben rechts</span>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
                <code style={{ color: 'var(--accent)', minWidth: 90, fontFamily: 'var(--font-mono)' }}>#msg:om-…</code>
                <span style={{ color: 'var(--fg-3)' }}>Einzelne Nachricht — kopierbar unter jeder Antwort</span>
              </div>
            </div>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--fg-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Coding Agent</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
                <code style={{ color: 'var(--fg-2)', minWidth: 90, fontFamily: 'var(--font-mono)' }}>#proj:pr-…</code>
                <span style={{ color: 'var(--fg-3)' }}>Workspace — kopierbar per Hover in der Sidebar</span>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
                <code style={{ color: 'var(--fg-2)', minWidth: 90, fontFamily: 'var(--font-mono)' }}>#sess:ss-…</code>
                <span style={{ color: 'var(--fg-3)' }}>Session — embeds projRand6, kopierbar per Hover</span>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
                <code style={{ color: 'var(--accent)', minWidth: 90, fontFamily: 'var(--font-mono)' }}>#msg:am-…</code>
                <span style={{ color: 'var(--fg-3)' }}>Agent-Nachricht — embeds sessRand4 → O(1) tree lookup</span>
              </div>
            </div>
          </div>
        </>
      )}

      {tab === 'agent' && (
        <>
          <div style={{ fontSize: 11.5, color: 'var(--fg-3)', marginBottom: 16, lineHeight: 1.6 }}>
            Steuert wie viele Agent-Nachrichten pro Workspace gespeichert und beim Neustart einer Session als Kontext komprimiert übergeben werden.
          </div>

          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <div style={cardTitle}>Auto-Komprimierung beim Session-Start</div>
                <div style={{ fontSize: 11, color: 'var(--fg-3)', lineHeight: 1.6 }}>
                  Wenn neue Nachrichten seit der letzten Komprimierung vorhanden sind, wird beim Start einer Session im Hintergrund neu komprimiert — damit der Kontext beim nächsten Start aktuell ist.
                </div>
              </div>
              <button
                onClick={() => setAgentAutoCompressOnStart(!agentAutoCompressOnStart)}
                style={{
                  flexShrink: 0, width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
                  background: agentAutoCompressOnStart ? 'var(--accent)' : 'var(--bg-3)',
                  position: 'relative', transition: 'background 0.2s',
                  boxShadow: agentAutoCompressOnStart ? '0 0 0 1px var(--accent)' : '0 0 0 1px var(--line)',
                }}
              >
                <span style={{
                  position: 'absolute', top: 4, width: 14, height: 14, borderRadius: '50%',
                  left: agentAutoCompressOnStart ? 22 : 4,
                  background: agentAutoCompressOnStart ? 'var(--accent-fg, #fff)' : 'var(--fg-3)',
                  transition: 'left 0.2s',
                }} />
              </button>
            </div>
          </div>

          <div style={card}>
            <div style={cardTitle}>Session-Gedächtnis</div>
            <div style={cardSub}>Die letzten N Nachrichten (user + assistant) werden beim Neustart komprimiert und als Kontext injiziert.</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input
                type="number" min={1} max={100} value={agentContextMsgCount}
                onChange={e => setAgentContextMsgCount(Math.max(1, Math.min(100, Number(e.target.value))))}
                style={numInput}
              />
              <label style={{ fontSize: 11, color: 'var(--fg-2)' }}>Nachrichten für Komprimierung</label>
            </div>
          </div>

          <div style={card}>
            <div style={cardTitle}>Tail-Nachrichten (Klartext)</div>
            <div style={cardSub}>Die letzten N Nachrichten nach der letzten Komprimierung werden zusätzlich ungekürzt mitgegeben (0 = deaktiviert, max 10).</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input
                type="number" min={0} max={10} value={agentTailMessageCount}
                onChange={e => setAgentTailMessageCount(Math.max(0, Math.min(10, Number(e.target.value))))}
                style={numInput}
              />
              <label style={{ fontSize: 11, color: 'var(--fg-2)' }}>Anzahl Klartext-Nachrichten</label>
            </div>
          </div>
        </>
      )}

      {tab === 'verdichten' && (
        <>
          <div style={{ fontSize: 11.5, color: 'var(--fg-3)', marginBottom: 16, lineHeight: 1.6 }}>
            Sendet den aktuellen Chat-Verlauf an das konfigurierte Modell und erhält eine komprimierte Zusammenfassung — nur entwicklungsrelevante Infos, stichpunktartig, ideal als Kontext für eine neue Session.
          </div>

          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={cardTitle}>Aktuelles Modell</div>
                <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>Modell wechseln unter dem Tab <b>Chat</b> → LLM für Komprimierung</div>
              </div>
              <span style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>{orbitCompressModel}</span>
            </div>
          </div>

          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: !openrouterKey ? 12 : 0 }}>
              <div>
                <div style={cardTitle}>Aktueller Chat</div>
                <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>
                  {chatMsgs.length} Nachrichten{activeChatId ? ` · ${activeChatId}` : ' · kein Chat aktiv'}
                </div>
              </div>
              <button
                onClick={runCompress}
                disabled={compressing || !openrouterKey || chatMsgs.length === 0}
                style={{
                  padding: '7px 16px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: 'var(--orbit)', color: '#fff', fontSize: 12, fontWeight: 600,
                  opacity: (compressing || !openrouterKey || chatMsgs.length === 0) ? 0.5 : 1,
                  display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
                }}
              >
                <ISpark style={{ width: 13, height: 13, ...(compressing ? { animation: 'cc-pulse 0.5s ease-in-out infinite' } : {}) }} />
                {compressing ? 'Verdichtet…' : 'Jetzt verdichten'}
              </button>
            </div>
            {!openrouterKey && (
              <div style={{ fontSize: 11, color: 'var(--err)', padding: '8px 12px', background: 'color-mix(in srgb, var(--err) 10%, transparent)', borderRadius: 6 }}>
                OpenRouter API-Key fehlt — unter Large Language Models hinterlegen.
              </div>
            )}
          </div>

          {compressResult && (
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={cardTitle}>Ergebnis</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => navigator.clipboard.writeText(compressResult)}
                    style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'var(--fg-1)', fontSize: 11, cursor: 'pointer' }}
                  >
                    Kopieren
                  </button>
                  <button
                    onClick={applyCompression}
                    disabled={applied}
                    style={{
                      padding: '4px 12px', borderRadius: 6, border: 'none',
                      background: applied ? 'var(--ok)' : 'var(--accent)', color: applied ? '#fff' : 'var(--accent-fg)',
                      fontSize: 11, fontWeight: 600, cursor: applied ? 'default' : 'pointer',
                    }}
                  >
                    {applied ? '✓ Angewendet' : 'Chat ersetzen'}
                  </button>
                </div>
              </div>
              <pre style={{
                margin: 0, padding: '12px 14px', background: 'var(--bg-2)',
                border: '1px solid var(--line)', borderRadius: 6,
                fontSize: 11.5, fontFamily: 'var(--font-mono)', color: 'var(--fg-1)',
                whiteSpace: 'pre-wrap', lineHeight: 1.65, maxHeight: 360, overflowY: 'auto',
              }}>{compressResult}</pre>
              {applied && (
                <div style={{ marginTop: 10, fontSize: 11, color: 'var(--ok)' }}>
                  Chat-Verlauf wurde durch die Zusammenfassung ersetzt.
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Integrationen panel ───────────────────────────────────────────────────────
function IntegrationenPanel() {
  const {
    supabaseUrl, setSupabaseUrl,
    supabaseAnonKey, setSupabaseAnonKey,
    supabaseServiceRoleKey, setSupabaseServiceRoleKey,
    cloudflareAccountId, setCloudflareAccountId,
    cloudflareR2AccessKeyId, setCloudflareR2AccessKeyId,
    cloudflareR2SecretAccessKey, setCloudflareR2SecretAccessKey,
    cloudflareR2BucketName, setCloudflareR2BucketName,
    cloudflareR2Endpoint, setCloudflareR2Endpoint,
    cloudflareR2PublicUrl, setCloudflareR2PublicUrl,
  } = useAppStore()

  const [tab, setTab] = useState<'datenbank' | 'storage'>('datenbank')
  const [showSbService, setShowSbService] = useState(false)
  const [showR2Secret, setShowR2Secret] = useState(false)

  const inp: React.CSSProperties = {
    width: '100%', padding: '8px 12px', border: '1px solid var(--line-strong)',
    borderRadius: 6, background: 'var(--bg-2)', color: 'var(--fg-0)',
    fontSize: 12.5, fontFamily: 'var(--font-mono)', outline: 'none',
    boxSizing: 'border-box',
  }
  const lbl: React.CSSProperties = { fontSize: 11.5, color: 'var(--fg-2)', marginBottom: 5, display: 'block', fontWeight: 500 }
  const fieldWrap: React.CSSProperties = { marginBottom: 16 }
  const tabBtn = (active: boolean): React.CSSProperties => ({
    padding: '5px 20px', borderRadius: 6, border: 'none', cursor: 'pointer',
    fontSize: 12, fontWeight: 600,
    background: active ? 'var(--accent)' : 'transparent',
    color: active ? 'var(--accent-fg)' : 'var(--fg-2)',
    transition: 'background 0.15s, color 0.15s',
  })
  const eyeBtn: React.CSSProperties = {
    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-3)',
    padding: 0, fontSize: 11, lineHeight: 1,
  }

  const derivedEndpoint = cloudflareAccountId.trim()
    ? `https://${cloudflareAccountId.trim()}.r2.cloudflarestorage.com`
    : ''

  return (
    <div style={{ padding: '28px 36px', maxWidth: 560 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg-0)', marginBottom: 4, letterSpacing: -0.3 }}>Integrationen</div>
        <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>Verbinde externe Dienste mit Codera AI</div>
      </div>

      {/* Centered tab bar */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg-2)', padding: 4, borderRadius: 6, border: '1px solid var(--line)' }}>
          <button style={tabBtn(tab === 'datenbank')} onClick={() => setTab('datenbank')}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <IDatabase style={{ width: 12, height: 12 }} />
              Datenbank
            </span>
          </button>
          <button style={tabBtn(tab === 'storage')} onClick={() => setTab('storage')}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <ICloudUpload style={{ width: 12, height: 12 }} />
              Storage
            </span>
          </button>
        </div>
      </div>

      {/* ── Datenbank tab (Supabase) ── */}
      {tab === 'datenbank' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <div style={{ width: 32, height: 32, borderRadius: 6, background: 'rgba(62,207,142,0.12)', border: '1px solid rgba(62,207,142,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <IDatabase style={{ width: 15, height: 15, color: '#3ecf8e' }} />
            </div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--fg-0)', letterSpacing: -0.2 }}>Supabase</div>
              <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>Postgres-Datenbank & Auth</div>
            </div>
            <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer"
              style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--fg-3)', textDecoration: 'none' }}>
              Dashboard →
            </a>
          </div>

          <div style={fieldWrap}>
            <span style={lbl}>Project URL</span>
            <input style={inp} placeholder="https://xxxx.supabase.co"
              value={supabaseUrl} onChange={e => setSupabaseUrl(e.target.value)} spellCheck={false} />
          </div>

          <div style={fieldWrap}>
            <span style={lbl}>Anon Key (öffentlich)</span>
            <input style={inp} placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…"
              value={supabaseAnonKey} onChange={e => setSupabaseAnonKey(e.target.value)} spellCheck={false} />
            <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginTop: 4 }}>Sicher für den Browser — kein Schreibzugriff auf geschützte Tabellen</div>
          </div>

          <div style={fieldWrap}>
            <span style={lbl}>Service Role Key <span style={{ color: 'var(--err)', fontWeight: 400, fontSize: 10 }}>(privat)</span></span>
            <div style={{ position: 'relative' }}>
              <input style={{ ...inp, paddingRight: 36 }}
                type={showSbService ? 'text' : 'password'}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…"
                value={supabaseServiceRoleKey} onChange={e => setSupabaseServiceRoleKey(e.target.value)} spellCheck={false} />
              <button style={eyeBtn} onClick={() => setShowSbService(v => !v)}>
                {showSbService ? '🙈' : '👁'}
              </button>
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--err)', marginTop: 4 }}>Niemals im Frontend verwenden — nur für serverseitige Operationen</div>
          </div>

          {supabaseUrl.trim() && (
            <div style={{ marginTop: 8, padding: '10px 14px', background: 'rgba(62,207,142,0.07)', border: '1px solid rgba(62,207,142,0.2)', borderRadius: 6 }}>
              <div style={{ fontSize: 11, color: '#3ecf8e', fontWeight: 600, marginBottom: 4 }}>Verbunden</div>
              <div style={{ fontSize: 10.5, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>{supabaseUrl}</div>
            </div>
          )}
        </div>
      )}

      {/* ── Storage tab (Cloudflare R2) ── */}
      {tab === 'storage' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <div style={{ width: 32, height: 32, borderRadius: 6, background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ICloud style={{ width: 15, height: 15, color: '#f97316' }} />
            </div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--fg-0)', letterSpacing: -0.2 }}>Cloudflare R2</div>
              <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>S3-kompatibler Object Storage</div>
            </div>
            <a href="https://dash.cloudflare.com" target="_blank" rel="noopener noreferrer"
              style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--fg-3)', textDecoration: 'none' }}>
              Dashboard →
            </a>
          </div>

          <div style={fieldWrap}>
            <span style={lbl}>Account ID</span>
            <input style={inp} placeholder="abc123def456…"
              value={cloudflareAccountId} onChange={e => setCloudflareAccountId(e.target.value)} spellCheck={false} />
            <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginTop: 4 }}>Cloudflare Dashboard → rechte Seitenleiste</div>
          </div>

          <div style={fieldWrap}>
            <span style={lbl}>Bucket Name</span>
            <input style={inp} placeholder="mein-bucket"
              value={cloudflareR2BucketName} onChange={e => setCloudflareR2BucketName(e.target.value)} spellCheck={false} />
          </div>

          <div style={fieldWrap}>
            <span style={lbl}>Access Key ID</span>
            <input style={inp} placeholder="abc123…"
              value={cloudflareR2AccessKeyId} onChange={e => setCloudflareR2AccessKeyId(e.target.value)} spellCheck={false} />
          </div>

          <div style={fieldWrap}>
            <span style={lbl}>Secret Access Key</span>
            <div style={{ position: 'relative' }}>
              <input style={{ ...inp, paddingRight: 36 }}
                type={showR2Secret ? 'text' : 'password'}
                placeholder="••••••••••••••••••••"
                value={cloudflareR2SecretAccessKey} onChange={e => setCloudflareR2SecretAccessKey(e.target.value)} spellCheck={false} />
              <button style={eyeBtn} onClick={() => setShowR2Secret(v => !v)}>
                {showR2Secret ? '🙈' : '👁'}
              </button>
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginTop: 4 }}>R2 API-Token → Berechtigung: Object Read & Write</div>
          </div>

          <div style={fieldWrap}>
            <span style={lbl}>
              Endpoint
              <span style={{ fontWeight: 400, color: 'var(--fg-3)', marginLeft: 4 }}>(optional — wird aus Account ID abgeleitet)</span>
            </span>
            <input style={{ ...inp, color: cloudflareR2Endpoint.trim() ? 'var(--fg-0)' : 'var(--fg-3)' }}
              placeholder={derivedEndpoint || 'https://<account-id>.r2.cloudflarestorage.com'}
              value={cloudflareR2Endpoint} onChange={e => setCloudflareR2Endpoint(e.target.value)} spellCheck={false} />
          </div>

          <div style={fieldWrap}>
            <span style={lbl}>
              Public URL
              <span style={{ fontWeight: 400, color: 'var(--fg-3)', marginLeft: 4 }}>(optional — für direkte Datei-URLs)</span>
            </span>
            <input style={{ ...inp, color: cloudflareR2PublicUrl.trim() ? 'var(--fg-0)' : 'var(--fg-3)' }}
              placeholder="https://pub-xxx.r2.dev  oder  https://files.meine-domain.de"
              value={cloudflareR2PublicUrl} onChange={e => setCloudflareR2PublicUrl(e.target.value.trim())} spellCheck={false} />
            <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginTop: 4 }}>
              Cloudflare Dashboard → R2 → Bucket → Settings → Public Access. Wenn gesetzt, werden Dateien direkt über diese URL verlinkt — kein localhost-Proxy.
            </div>
          </div>

          {cloudflareAccountId.trim() && cloudflareR2BucketName.trim() && (
            <div style={{ marginTop: 8, padding: '10px 14px', background: 'rgba(249,115,22,0.07)', border: '1px solid rgba(249,115,22,0.2)', borderRadius: 6 }}>
              <div style={{ fontSize: 11, color: '#f97316', fontWeight: 600, marginBottom: 4 }}>Konfiguriert</div>
              <div style={{ fontSize: 10.5, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
                {cloudflareR2Endpoint.trim() || derivedEndpoint}/{cloudflareR2BucketName}
              </div>
              {cloudflareR2PublicUrl.trim() && (
                <div style={{ fontSize: 10.5, color: 'var(--ok)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
                  ✓ Public URL: {cloudflareR2PublicUrl}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
