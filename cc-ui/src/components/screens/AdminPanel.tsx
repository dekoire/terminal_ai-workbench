/**
 * AdminPanel — modal overlay, only visible to users in adminEmails list.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { IShield, IClose, IUsers, IPlus, ITrash, IEdit, ICheck, ILoader, IUser } from '../primitives/Icons'

interface ManagedUser {
  id: string
  email: string
  firstName: string
  lastName: string
  createdAt: string
  lastSignIn: string | null
  isAdmin: boolean
}

export function AdminPanel({ onClose }: { onClose: () => void }) {
  const {
    currentUser, adminEmails, addAdminEmail, removeAdminEmail,
    projects, aliases, supabaseUrl, supabaseServiceRoleKey,
  } = useAppStore()

  const [tab, setTab] = useState<'overview' | 'users'>('overview')

  // Close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const totalSessions = projects.reduce((n, p) => n + p.sessions.length, 0)

  const sectionLabel: React.CSSProperties = {
    fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.7,
    color: 'var(--fg-3)', fontWeight: 600, marginBottom: 10,
  }
  const card: React.CSSProperties = {
    background: 'var(--bg-2)', border: '0.5px solid var(--line-strong)',
    borderRadius: 10, padding: '12px 14px', marginBottom: 14,
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9990,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 520, maxHeight: '90vh', display: 'flex', flexDirection: 'column',
          background: 'var(--bg-0)', borderRadius: 12,
          border: '0.5px solid var(--line-strong)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '14px 18px', borderBottom: '1px solid var(--line)',
          background: 'var(--bg-1)', flexShrink: 0,
        }}>
          <IShield style={{ width: 15, height: 15, color: 'var(--accent)' }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-0)', flex: 1, fontFamily: 'var(--font-ui)' }}>
            Admin Panel
          </span>
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: 0.5,
            color: 'var(--accent)', background: 'var(--accent-soft)',
            border: '1px solid var(--accent-line)', borderRadius: 4,
            padding: '2px 6px', textTransform: 'uppercase',
          }}>Admin</span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-3)', display: 'flex', padding: 4, borderRadius: 5, marginLeft: 4 }}
          >
            <IClose style={{ width: 14, height: 14 }} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--line)', background: 'var(--bg-1)', flexShrink: 0 }}>
          {(['overview', 'users'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '8px 16px', fontSize: 11, fontWeight: tab === t ? 600 : 400,
                color: tab === t ? 'var(--accent)' : 'var(--fg-2)',
                borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
                marginBottom: -1, transition: 'color 0.15s',
                fontFamily: 'var(--font-ui)',
              }}
            >
              {t === 'overview' ? 'Übersicht' : 'Benutzer'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 18px 8px' }}>
          {tab === 'overview' && (
            <OverviewTab
              currentUser={currentUser}
              adminEmails={adminEmails}
              addAdminEmail={addAdminEmail}
              removeAdminEmail={removeAdminEmail}
              projects={projects}
              aliases={aliases}
              totalSessions={totalSessions}
              sectionLabel={sectionLabel}
              card={card}
            />
          )}
          {tab === 'users' && (
            <UsersTab
              currentUser={currentUser}
              supabaseUrl={supabaseUrl}
              serviceRoleKey={supabaseServiceRoleKey}
              adminEmails={adminEmails}
              addAdminEmail={addAdminEmail}
              removeAdminEmail={removeAdminEmail}
              sectionLabel={sectionLabel}
              card={card}
            />
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '10px 18px', borderTop: '1px solid var(--line)',
          display: 'flex', justifyContent: 'flex-end', flexShrink: 0,
          background: 'var(--bg-1)',
        }}>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: '1px solid var(--line-strong)',
              borderRadius: 6, padding: '6px 16px', cursor: 'pointer',
              color: 'var(--fg-1)', fontSize: 12, fontFamily: 'var(--font-ui)',
            }}
          >Schließen</button>
        </div>
      </div>
    </div>
  )
}

// ── Overview tab (original content) ──────────────────────────────────────────

function OverviewTab({ currentUser, adminEmails, addAdminEmail, removeAdminEmail, projects, aliases, totalSessions, sectionLabel, card }: {
  currentUser: ReturnType<typeof useAppStore>['currentUser']
  adminEmails: string[]
  addAdminEmail: (e: string) => void
  removeAdminEmail: (e: string) => void
  projects: ReturnType<typeof useAppStore>['projects']
  aliases: ReturnType<typeof useAppStore>['aliases']
  totalSessions: number
  sectionLabel: React.CSSProperties
  card: React.CSSProperties
}) {
  const [newEmail, setNewEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleAdd = () => {
    const email = newEmail.trim().toLowerCase()
    if (!email) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setEmailError('Ungültige E-Mail'); return }
    addAdminEmail(email)
    setNewEmail('')
    setEmailError('')
  }

  return (
    <>
      <div style={sectionLabel}>Aktueller Benutzer</div>
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
            background: 'var(--accent)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff',
          }}>
            {(currentUser?.firstName?.charAt(0) ?? '') + (currentUser?.lastName?.charAt(0) ?? '') || '?'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)' }}>
              {currentUser?.firstName} {currentUser?.lastName}
            </div>
            <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 1 }}>{currentUser?.email}</div>
          </div>
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: 0.5,
            color: 'var(--accent)', background: 'var(--accent-soft)',
            border: '1px solid var(--accent-line)', borderRadius: 4,
            padding: '2px 7px', textTransform: 'uppercase', flexShrink: 0,
          }}>Admin</span>
        </div>
      </div>

      <div style={sectionLabel}>System-Übersicht</div>
      <div style={{ ...card, padding: '10px 14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {[
            { label: 'Projekte', value: projects.length },
            { label: 'Sessions', value: totalSessions },
            { label: 'Aliases',  value: aliases.length },
          ].map(({ label, value }) => (
            <div key={label} style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{value}</div>
              <div style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={sectionLabel}>Admin-Zugang</div>
      <div style={card}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
          {adminEmails.map(email => (
            <div key={email} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 10px', borderRadius: 7,
              background: 'var(--bg-3)', border: '0.5px solid var(--line)',
            }}>
              <IUsers style={{ width: 12, height: 12, color: 'var(--fg-3)', flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--fg-0)' }}>{email}</span>
              {email === currentUser?.email?.toLowerCase() && (
                <span style={{ fontSize: 9, color: 'var(--accent)', fontWeight: 600 }}>Du</span>
              )}
              <button
                onClick={() => removeAdminEmail(email)}
                disabled={adminEmails.length <= 1}
                title={adminEmails.length <= 1 ? 'Letzter Admin kann nicht entfernt werden' : 'Entfernen'}
                style={{
                  background: 'none', border: 'none', cursor: adminEmails.length <= 1 ? 'not-allowed' : 'pointer',
                  color: adminEmails.length <= 1 ? 'var(--fg-3)' : 'var(--err)',
                  padding: 2, display: 'flex', opacity: adminEmails.length <= 1 ? 0.3 : 1,
                }}
              >
                <ITrash style={{ width: 11, height: 11 }} />
              </button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ flex: 1 }}>
            <input
              ref={inputRef}
              value={newEmail}
              onChange={e => { setNewEmail(e.target.value); setEmailError('') }}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
              placeholder="neue@email.com"
              style={{
                width: '100%', padding: '6px 10px', borderRadius: 6, boxSizing: 'border-box',
                border: `1px solid ${emailError ? 'var(--err)' : 'var(--line-strong)'}`,
                background: 'var(--bg-2)', color: 'var(--fg-0)', fontSize: 12,
                fontFamily: 'var(--font-mono)', outline: 'none',
              }}
            />
            {emailError && <div style={{ fontSize: 10, color: 'var(--err)', marginTop: 3 }}>{emailError}</div>}
          </div>
          <button
            onClick={handleAdd}
            style={{
              background: 'var(--accent)', color: 'var(--accent-fg)', border: 'none',
              borderRadius: 6, padding: '0 12px', cursor: 'pointer', display: 'flex',
              alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, flexShrink: 0,
            }}
          >
            <IPlus style={{ width: 12, height: 12 }} /> Hinzufügen
          </button>
        </div>
      </div>
    </>
  )
}

// ── Users tab ─────────────────────────────────────────────────────────────────

function UsersTab({ currentUser, supabaseUrl, serviceRoleKey, adminEmails, addAdminEmail, removeAdminEmail, sectionLabel, card }: {
  currentUser: ReturnType<typeof useAppStore>['currentUser']
  supabaseUrl: string
  serviceRoleKey: string
  adminEmails: string[]
  addAdminEmail: (e: string) => void
  removeAdminEmail: (e: string) => void
  sectionLabel: React.CSSProperties
  card: React.CSSProperties
}) {
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const hasCredentials = !!(supabaseUrl && serviceRoleKey)

  const loadUsers = useCallback(async () => {
    if (!hasCredentials) return
    setLoading(true); setError('')
    try {
      const r = await fetch(`/api/admin/users?supabaseUrl=${encodeURIComponent(supabaseUrl)}&serviceRoleKey=${encodeURIComponent(serviceRoleKey)}`)
      const d = await r.json() as { ok: boolean; users?: ManagedUser[]; error?: string }
      if (d.ok) setUsers(d.users ?? [])
      else setError(d.error ?? 'Fehler beim Laden')
    } catch (e) { setError(String(e)) }
    finally { setLoading(false) }
  }, [supabaseUrl, serviceRoleKey, hasCredentials])

  useEffect(() => { void loadUsers() }, [loadUsers])

  const toggleAdmin = async (user: ManagedUser) => {
    if (!hasCredentials) return
    if (user.isAdmin) {
      await fetch(`/api/admin/users/${user.id}/admin?supabaseUrl=${encodeURIComponent(supabaseUrl)}&serviceRoleKey=${encodeURIComponent(serviceRoleKey)}`, { method: 'DELETE' })
      removeAdminEmail(user.email)
    } else {
      await fetch(`/api/admin/users/${user.id}/admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supabaseUrl, serviceRoleKey, grantedBy: currentUser?.id }),
      })
      addAdminEmail(user.email)
    }
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, isAdmin: !u.isAdmin } : u))
  }

  const deleteUser = async (user: ManagedUser) => {
    if (!hasCredentials) return
    if (!window.confirm(`Benutzer "${user.email}" wirklich löschen?`)) return
    await fetch(`/api/admin/users/${user.id}?supabaseUrl=${encodeURIComponent(supabaseUrl)}&serviceRoleKey=${encodeURIComponent(serviceRoleKey)}`, { method: 'DELETE' })
    setUsers(prev => prev.filter(u => u.id !== user.id))
  }

  if (!hasCredentials) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '40px 20px', color: 'var(--fg-3)', textAlign: 'center' }}>
        <IShield style={{ width: 32, height: 32, opacity: 0.4 }} />
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-2)' }}>Supabase-Zugangsdaten fehlen</div>
        <div style={{ fontSize: 11, lineHeight: 1.6 }}>Bitte Supabase URL und Service Role Key in den Einstellungen hinterlegen.</div>
      </div>
    )
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ ...sectionLabel, marginBottom: 0, flex: 1 }}>Alle Benutzer ({users.length})</div>
        <button
          onClick={() => setShowCreate(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600,
            background: 'var(--accent)', color: 'var(--accent-fg)', border: 'none',
            borderRadius: 6, padding: '5px 10px', cursor: 'pointer',
          }}
        >
          <IPlus style={{ width: 11, height: 11 }} /> Neuer Benutzer
        </button>
      </div>

      {showCreate && (
        <CreateUserForm
          supabaseUrl={supabaseUrl}
          serviceRoleKey={serviceRoleKey}
          card={card}
          onCreated={u => { setUsers(prev => [u, ...prev]); setShowCreate(false) }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 16, color: 'var(--fg-3)', fontSize: 12 }}>
          <ILoader style={{ width: 14, height: 14 }} /> Benutzer werden geladen…
        </div>
      )}
      {error && <div style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid var(--err)', borderRadius: 7, fontSize: 11, color: 'var(--err)', marginBottom: 10 }}>{error}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {users.map(user => (
          editingId === user.id
            ? <EditUserRow
                key={user.id}
                user={user}
                supabaseUrl={supabaseUrl}
                serviceRoleKey={serviceRoleKey}
                onSaved={updated => { setUsers(prev => prev.map(u => u.id === user.id ? { ...u, ...updated } : u)); setEditingId(null) }}
                onCancel={() => setEditingId(null)}
              />
            : <UserRow
                key={user.id}
                user={user}
                isSelf={user.email.toLowerCase() === currentUser?.email?.toLowerCase()}
                adminEmails={adminEmails}
                onToggleAdmin={() => void toggleAdmin(user)}
                onEdit={() => setEditingId(user.id)}
                onDelete={() => void deleteUser(user)}
              />
        ))}
      </div>
    </>
  )
}

function UserRow({ user, isSelf, onToggleAdmin, onEdit, onDelete }: {
  user: ManagedUser
  isSelf: boolean
  adminEmails: string[]
  onToggleAdmin: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const initials = (user.firstName.charAt(0) + user.lastName.charAt(0)) || user.email.charAt(0).toUpperCase()
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 12px', borderRadius: 8,
      background: 'var(--bg-2)', border: '0.5px solid var(--line)',
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
        background: user.isAdmin ? 'var(--accent)' : 'var(--bg-3)',
        border: '1px solid var(--line-strong)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 700, color: user.isAdmin ? '#fff' : 'var(--fg-2)',
      }}>
        {initials}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user.firstName} {user.lastName}
            {!user.firstName && !user.lastName && <span style={{ color: 'var(--fg-3)', fontStyle: 'italic' }}>Kein Name</span>}
          </span>
          {isSelf && <span style={{ fontSize: 9, color: 'var(--accent)', fontWeight: 600, flexShrink: 0 }}>Du</span>}
          {user.isAdmin && (
            <span style={{
              fontSize: 8, fontWeight: 700, letterSpacing: 0.5, flexShrink: 0,
              color: 'var(--accent)', background: 'var(--accent-soft)',
              border: '1px solid var(--accent-line)', borderRadius: 3,
              padding: '1px 5px', textTransform: 'uppercase',
            }}>Admin</span>
          )}
        </div>
        <div style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
      </div>
      {/* Admin toggle */}
      <button
        onClick={onToggleAdmin}
        title={user.isAdmin ? 'Admin-Rechte entziehen' : 'Zum Admin machen'}
        style={{
          background: user.isAdmin ? 'var(--accent-soft)' : 'var(--bg-3)',
          border: `1px solid ${user.isAdmin ? 'var(--accent-line)' : 'var(--line)'}`,
          borderRadius: 5, padding: '3px 7px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 4,
          fontSize: 10, color: user.isAdmin ? 'var(--accent)' : 'var(--fg-3)',
          flexShrink: 0,
        }}
      >
        <IShield style={{ width: 10, height: 10 }} />
        {user.isAdmin ? 'Admin' : 'User'}
      </button>
      <button onClick={onEdit} title="Bearbeiten"
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-3)', padding: 4, display: 'flex', borderRadius: 4 }}>
        <IEdit style={{ width: 12, height: 12 }} />
      </button>
      <button onClick={onDelete} title="Löschen"
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--err)', padding: 4, display: 'flex', borderRadius: 4, opacity: isSelf ? 0.3 : 1 }}
        disabled={isSelf}>
        <ITrash style={{ width: 12, height: 12 }} />
      </button>
    </div>
  )
}

function EditUserRow({ user, supabaseUrl, serviceRoleKey, onSaved, onCancel }: {
  user: ManagedUser
  supabaseUrl: string
  serviceRoleKey: string
  onSaved: (u: Partial<ManagedUser>) => void
  onCancel: () => void
}) {
  const [firstName, setFirstName] = useState(user.firstName)
  const [lastName, setLastName]   = useState(user.lastName)
  const [email, setEmail]         = useState(user.email)
  const [password, setPassword]   = useState('')
  const [saving, setSaving]       = useState(false)
  const [err, setErr]             = useState('')

  const save = async () => {
    setSaving(true); setErr('')
    try {
      const r = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supabaseUrl, serviceRoleKey, firstName, lastName, email, password }),
      })
      const d = await r.json() as { ok: boolean; error?: string }
      if (d.ok) onSaved({ firstName, lastName, email })
      else setErr(d.error ?? 'Speichern fehlgeschlagen')
    } catch (e) { setErr(String(e)) }
    finally { setSaving(false) }
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '5px 8px', borderRadius: 5, boxSizing: 'border-box',
    border: '1px solid var(--line-strong)', background: 'var(--bg-1)',
    color: 'var(--fg-0)', fontSize: 11, fontFamily: 'var(--font-ui)', outline: 'none',
  }

  return (
    <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bg-2)', border: '1px solid var(--accent-line)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
        <input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Vorname" style={inp} />
        <input value={lastName}  onChange={e => setLastName(e.target.value)}  placeholder="Nachname" style={inp} />
        <input value={email}     onChange={e => setEmail(e.target.value)}     placeholder="E-Mail"   style={inp} type="email" />
        <input value={password}  onChange={e => setPassword(e.target.value)}  placeholder="Neues Passwort (optional)" style={inp} type="password" />
      </div>
      {err && <div style={{ fontSize: 10, color: 'var(--err)', marginBottom: 6 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={{ background: 'none', border: '1px solid var(--line-strong)', borderRadius: 5, padding: '4px 10px', cursor: 'pointer', fontSize: 11, color: 'var(--fg-2)' }}>Abbrechen</button>
        <button onClick={() => void save()} disabled={saving}
          style={{ background: 'var(--accent)', color: 'var(--accent-fg)', border: 'none', borderRadius: 5, padding: '4px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
          {saving ? <ILoader style={{ width: 11, height: 11 }} /> : <ICheck style={{ width: 11, height: 11 }} />} Speichern
        </button>
      </div>
    </div>
  )
}

function CreateUserForm({ supabaseUrl, serviceRoleKey, card, onCreated, onCancel }: {
  supabaseUrl: string
  serviceRoleKey: string
  card: React.CSSProperties
  onCreated: (u: ManagedUser) => void
  onCancel: () => void
}) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName]   = useState('')
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [saving, setSaving]       = useState(false)
  const [err, setErr]             = useState('')

  const create = async () => {
    if (!email || !password) { setErr('E-Mail und Passwort sind erforderlich'); return }
    setSaving(true); setErr('')
    try {
      const r = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supabaseUrl, serviceRoleKey, firstName, lastName, email, password }),
      })
      const d = await r.json() as { ok: boolean; user?: Record<string, unknown>; error?: string }
      if (d.ok && d.user) {
        onCreated({
          id: d.user.id as string,
          email: d.user.email as string,
          firstName, lastName,
          createdAt: d.user.created_at as string,
          lastSignIn: null, isAdmin: false,
        })
      } else setErr(d.error ?? 'Erstellen fehlgeschlagen')
    } catch (e) { setErr(String(e)) }
    finally { setSaving(false) }
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '6px 9px', borderRadius: 6, boxSizing: 'border-box',
    border: '1px solid var(--line-strong)', background: 'var(--bg-2)',
    color: 'var(--fg-0)', fontSize: 12, fontFamily: 'var(--font-ui)', outline: 'none',
  }

  return (
    <div style={{ ...card, marginBottom: 14 }}>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--fg-3)', fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
        <IUser style={{ width: 10, height: 10 }} /> Neuer Benutzer
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginBottom: 7 }}>
        <input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Vorname" style={inp} />
        <input value={lastName}  onChange={e => setLastName(e.target.value)}  placeholder="Nachname" style={inp} />
        <input value={email}    onChange={e => setEmail(e.target.value)}    placeholder="E-Mail *"  style={inp} type="email" />
        <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Passwort *" style={inp} type="password" />
      </div>
      {err && <div style={{ fontSize: 10, color: 'var(--err)', marginBottom: 7 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={{ background: 'none', border: '1px solid var(--line-strong)', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 11, color: 'var(--fg-2)' }}>Abbrechen</button>
        <button onClick={() => void create()} disabled={saving}
          style={{ background: 'var(--accent)', color: 'var(--accent-fg)', border: 'none', borderRadius: 6, padding: '5px 14px', cursor: 'pointer', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
          {saving ? <ILoader style={{ width: 11, height: 11 }} /> : <IPlus style={{ width: 11, height: 11 }} />} Erstellen
        </button>
      </div>
    </div>
  )
}
