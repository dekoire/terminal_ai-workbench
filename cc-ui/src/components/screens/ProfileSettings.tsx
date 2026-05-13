import { useState, useRef } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { ICamera, IUser, ILogout, ILock, ICircleCheckBig } from '../primitives/Icons'
import { getSupabase } from '../../lib/supabase'
import avatarDefault from '../../assets/avatar.jpg'

// ── Nav config ────────────────────────────────────────────────────────────────
type NavKey = 'Profil' | 'Passwort' | 'Lizenzen'

const NAV: NavKey[] = ['Profil', 'Passwort', 'Lizenzen']

const NAV_DESC: Record<NavKey, string> = {
  'Profil':   'Name, E-Mail, Profilbild',
  'Passwort': 'Passwort ändern',
  'Lizenzen': 'Version & Lizenzstatus',
}

const NAV_ICONS: Record<NavKey, React.ReactNode> = {
  'Profil':   <IUser            style={{ width: 13, height: 13, flexShrink: 0 }} />,
  'Passwort': <ILock            style={{ width: 13, height: 13, flexShrink: 0 }} />,
  'Lizenzen': <ICircleCheckBig  style={{ width: 13, height: 13, flexShrink: 0 }} />,
}

// ── Root component ────────────────────────────────────────────────────────────
export function ProfileSettings() {
  const { setScreen, currentUser, setCurrentUser, supabaseUrl, supabaseAnonKey } = useAppStore()
  const [activeNav, setActiveNav] = useState<NavKey>('Profil')

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-0)', minHeight: 0, overflow: 'hidden' }}>
      {/* Titlebar — matches AliasSettings */}
      <div style={{
        height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '0 14px 0 88px', background: 'var(--bg-1)', borderBottom: '1px solid var(--line)',
        userSelect: 'none', WebkitAppRegion: 'drag', flexShrink: 0,
      } as React.CSSProperties}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)', pointerEvents: 'none' }}>Profil</span>
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Sidebar */}
        <aside style={{
          width: 180, background: 'var(--bg-1)', borderRight: '1px solid var(--line)',
          padding: '12px 0', flexShrink: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ padding: '2px 14px 6px', fontSize: 8.5, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--fg-3)', fontWeight: 700, opacity: 0.6 }}>
            Konto
          </div>

          {NAV.map(label => (
            <SidebarNavItem
              key={label}
              label={label}
              desc={NAV_DESC[label]}
              icon={NAV_ICONS[label]}
              active={activeNav === label}
              onClick={() => setActiveNav(label)}
            />
          ))}

          <div style={{ flex: 1 }} />

          {/* Ausloggen */}
          <div style={{ margin: '0 16px 4px', height: 1, background: 'var(--line)' }} />
          <div
            onClick={() => { setCurrentUser(null); setScreen('login') }}
            style={{
              padding: '6px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7,
              color: 'var(--err)', fontSize: 11.5,
            }}
          >
            <ILogout style={{ width: 13, height: 13, flexShrink: 0 }} />
            <span>Ausloggen</span>
          </div>

          {/* Back */}
          <div style={{ margin: '4px 16px', height: 1, background: 'var(--line)' }} />
          <div
            onClick={() => setScreen('workspace')}
            style={{ padding: '8px 16px', fontSize: 12, color: 'var(--fg-3)', cursor: 'pointer' }}
          >
            ← Back
          </div>
        </aside>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {activeNav === 'Profil' && (
            <ProfilPanel
              currentUser={currentUser}
              setCurrentUser={setCurrentUser}
              supabaseUrl={supabaseUrl}
              supabaseAnonKey={supabaseAnonKey}
            />
          )}
          {activeNav === 'Passwort' && (
            <PasswortPanel
              supabaseUrl={supabaseUrl}
              supabaseAnonKey={supabaseAnonKey}
            />
          )}
          {activeNav === 'Lizenzen' && <LizenzenPanel />}
        </div>
      </div>
    </div>
  )
}

// ── Sidebar NavItem ───────────────────────────────────────────────────────────
function SidebarNavItem({ label, desc, icon, active, onClick }: {
  label: string; desc: string; icon: React.ReactNode; active: boolean; onClick: () => void
}) {
  return (
    <div onClick={onClick} style={{
      padding: '5px 12px 5px 14px', cursor: 'pointer',
      background: active ? 'var(--bg-2)' : 'transparent',
      borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: active ? 'var(--accent)' : 'var(--fg-3)' }}>
        {icon}
        <span style={{ fontSize: 11.5, color: active ? 'var(--fg-0)' : 'var(--fg-1)', fontWeight: active ? 600 : 400 }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 9.5, color: 'var(--fg-3)', marginTop: 1, paddingLeft: 19 }}>{desc}</div>
    </div>
  )
}

// ── Profil panel ──────────────────────────────────────────────────────────────
function ProfilPanel({
  currentUser, setCurrentUser, supabaseUrl, supabaseAnonKey,
}: {
  currentUser: { id: string; email: string; firstName: string; lastName: string; avatarDataUrl?: string } | null
  setCurrentUser: (u: { id: string; email: string; firstName: string; lastName: string; avatarDataUrl?: string } | null) => void
  supabaseUrl: string
  supabaseAnonKey: string
}) {
  const [firstName, setFirstName] = useState(currentUser?.firstName ?? '')
  const [lastName,  setLastName]  = useState(currentUser?.lastName ?? '')
  const [email,     setEmail]     = useState(currentUser?.email ?? '')
  const [avatarSrc, setAvatarSrc] = useState(currentUser?.avatarDataUrl ?? avatarDefault)
  const [infoSaved, setInfoSaved] = useState(false)
  const [infoError, setInfoError] = useState('')
  const [avatarUploading, setAvatarUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || (currentUser?.email?.charAt(0) ?? '?').toUpperCase()

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !currentUser) return
    const reader = new FileReader()
    reader.onload = ev => setAvatarSrc(ev.target?.result as string)
    reader.readAsDataURL(file)
    setAvatarUploading(true)
    try {
      const res = await fetch('/api/r2-upload', {
        method: 'POST',
        headers: { 'Content-Type': file.type || 'image/jpeg', 'X-File-Name': encodeURIComponent(file.name), 'X-User-Id': currentUser.id, 'X-Folder': 'profile' },
        body: file,
      })
      const data = await res.json() as { ok: boolean; url?: string }
      if (data.ok && data.url) { setAvatarSrc(data.url); setCurrentUser({ ...currentUser, avatarDataUrl: data.url }) }
      else setCurrentUser({ ...currentUser, avatarDataUrl: avatarSrc })
    } catch { setCurrentUser({ ...currentUser, avatarDataUrl: avatarSrc }) }
    finally { setAvatarUploading(false) }
  }

  const handleSaveInfo = async () => {
    setInfoError(''); setInfoSaved(false)
    if (!currentUser) { setInfoError('Nicht eingeloggt.'); return }
    const sb = getSupabase(supabaseUrl, supabaseAnonKey)
    if (!sb) { setCurrentUser({ ...currentUser, firstName, lastName, email }); setInfoSaved(true); return }
    const { error } = await sb.auth.updateUser({ email: email !== currentUser.email ? email : undefined, data: { first_name: firstName, last_name: lastName } })
    if (error) { setInfoError(error.message); return }
    setCurrentUser({ ...currentUser, firstName, lastName, email })
    setInfoSaved(true); setTimeout(() => setInfoSaved(false), 2500)
  }

  return (
    <div style={{ padding: '16px 20px', maxWidth: 680, margin: '0 auto' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)', marginBottom: 2 }}>Profil</div>
      <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginBottom: 20 }}>Name, E-Mail und Profilbild</div>

      {/* Avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px', background: 'var(--bg-2)', border: '1px solid var(--line-strong)', borderRadius: 10, marginBottom: 20 }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          {avatarSrc && avatarSrc !== avatarDefault ? (
            <img src={avatarSrc} alt="Avatar" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--accent)', color: 'var(--accent-fg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, overflow: 'hidden' }}>
              {currentUser?.avatarDataUrl
                ? <img src={currentUser.avatarDataUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : initials
              }
            </div>
          )}
          <button
            onClick={() => fileRef.current?.click()}
            title="Bild ändern"
            style={{ position: 'absolute', bottom: 0, right: 0, width: 20, height: 20, borderRadius: '50%', background: avatarUploading ? 'var(--accent)' : 'var(--bg-1)', border: '1px solid var(--line-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: avatarUploading ? '#fff' : 'var(--fg-1)' }}
          >
            {avatarUploading
              ? <div style={{ width: 8, height: 8, borderRadius: '50%', border: '2px solid #fff4', borderTopColor: '#fff', animation: 'cc-spin 0.7s linear infinite' }} />
              : <ICamera style={{ width: 10, height: 10 }} />
            }
          </button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)' }}>
            {firstName || lastName ? `${firstName} ${lastName}`.trim() : currentUser?.email ?? 'Kein Name'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>{currentUser?.email ?? '—'}</div>
        </div>
        <button onClick={() => fileRef.current?.click()} style={{ background: 'none', border: '1px solid var(--line-strong)', borderRadius: 6, padding: '5px 12px', fontSize: 11, color: 'var(--fg-1)', cursor: 'pointer', flexShrink: 0 }}>
          Bild ändern
        </button>
      </div>

      {/* Personal data */}
      <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--fg-3)', fontWeight: 600, marginBottom: 10 }}>Persönliche Daten</div>
      <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line-strong)', borderRadius: 10, padding: '14px', marginBottom: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <FieldGroup label="Vorname"  value={firstName} onChange={setFirstName} placeholder="Max" />
          <FieldGroup label="Nachname" value={lastName}  onChange={setLastName}  placeholder="Mustermann" />
        </div>
        <FieldGroup label="E-Mail" value={email} onChange={setEmail} placeholder="du@beispiel.com" type="email" />
      </div>

      {infoError && <ErrorMsg msg={infoError} />}
      {infoSaved && <SuccessMsg msg="Gespeichert!" />}

      <button onClick={handleSaveInfo} style={btnPrimary}>Speichern</button>
    </div>
  )
}

// ── Passwort panel ────────────────────────────────────────────────────────────
function PasswortPanel({ supabaseUrl, supabaseAnonKey }: { supabaseUrl: string; supabaseAnonKey: string }) {
  const [newPwd,  setNewPwd]  = useState('')
  const [confPwd, setConfPwd] = useState('')
  const [pwdSaved, setPwdSaved] = useState(false)
  const [pwdError, setPwdError] = useState('')

  const handleChangePwd = async () => {
    setPwdError(''); setPwdSaved(false)
    if (!newPwd) { setPwdError('Neues Passwort eingeben.'); return }
    if (newPwd !== confPwd) { setPwdError('Passwörter stimmen nicht überein.'); return }
    if (newPwd.length < 6) { setPwdError('Mindestens 6 Zeichen.'); return }
    const sb = getSupabase(supabaseUrl, supabaseAnonKey)
    if (!sb) { setPwdError('Supabase nicht konfiguriert.'); return }
    const { error } = await sb.auth.updateUser({ password: newPwd })
    if (error) { setPwdError(error.message); return }
    setPwdSaved(true); setNewPwd(''); setConfPwd('')
    setTimeout(() => setPwdSaved(false), 2500)
  }

  return (
    <div style={{ padding: '16px 20px', maxWidth: 680, margin: '0 auto' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)', marginBottom: 2 }}>Passwort ändern</div>
      <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginBottom: 20 }}>Lege ein neues Passwort für deinen Account fest</div>

      <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--fg-3)', fontWeight: 600, marginBottom: 10 }}>Neues Passwort</div>
      <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line-strong)', borderRadius: 10, padding: '14px', marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <FieldGroup label="Neues Passwort"     value={newPwd}  onChange={setNewPwd}  placeholder="••••••••" type="password" />
        <FieldGroup label="Passwort bestätigen" value={confPwd} onChange={setConfPwd} placeholder="••••••••" type="password" />
      </div>

      {pwdError && <ErrorMsg msg={pwdError} />}
      {pwdSaved && <SuccessMsg msg="Passwort erfolgreich geändert!" />}

      <button onClick={handleChangePwd} style={btnPrimary}>Passwort ändern</button>
    </div>
  )
}

// ── Lizenzen panel (static, no functionality) ─────────────────────────────────
function LizenzenPanel() {
  const licenseKey = 'CODR-A7F2-XK91-B3M8'
  const maskedKey  = licenseKey.slice(0, 9) + '****-****'

  const infoRows = [
    { label: 'Codera Version', value: '0.1.0' },
    { label: 'Lizenztyp',      value: 'Pro' },
    { label: 'Status',         value: '● Aktiv', color: 'var(--ok)' },
    { label: 'Gültig bis',     value: '31. Dezember 2026' },
  ]

  return (
    <div style={{ padding: '16px 20px', maxWidth: 680, margin: '0 auto' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)', marginBottom: 2 }}>Lizenzen</div>
      <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginBottom: 20 }}>Deine Codera-Version und Lizenzinformationen</div>

      {/* License status */}
      <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--fg-3)', fontWeight: 600, marginBottom: 10 }}>Lizenzstatus</div>
      <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line-strong)', borderRadius: 10, overflow: 'hidden', marginBottom: 20 }}>
        {infoRows.map(({ label, value, color }, i) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', borderBottom: i < infoRows.length - 1 ? '1px solid var(--line)' : 'none' }}>
            <span style={{ flex: 1, fontSize: 12, color: 'var(--fg-2)' }}>{label}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: color ?? 'var(--fg-0)', fontFamily: 'var(--font-mono)' }}>{value}</span>
          </div>
        ))}
      </div>

      {/* License key */}
      <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--fg-3)', fontWeight: 600, marginBottom: 10 }}>Lizenzschlüssel</div>
      <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line-strong)', borderRadius: 10, padding: '12px 14px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ flex: 1, fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--fg-0)', letterSpacing: 0.5 }}>{maskedKey}</span>
        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--accent-line)', fontWeight: 600, letterSpacing: 0.3 }}>PRO</span>
      </div>

      {/* Hint */}
      <div style={{ fontSize: 11, color: 'var(--fg-3)', lineHeight: 1.6, padding: '10px 14px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 8 }}>
        Bei Fragen zur Lizenz wende dich an <span style={{ color: 'var(--accent)' }}>support@codera.com</span>
      </div>
    </div>
  )
}

// ── Shared helpers ────────────────────────────────────────────────────────────
function FieldGroup({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <div>
      <label style={fieldLabel}>{label}</label>
      <input style={fieldInput} type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  )
}

function ErrorMsg({ msg }: { msg: string }) {
  return (
    <div style={{ marginTop: 10, fontSize: 11.5, color: 'var(--err)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, padding: '7px 10px' }}>
      {msg}
    </div>
  )
}

function SuccessMsg({ msg }: { msg: string }) {
  return (
    <div style={{ marginTop: 10, fontSize: 11.5, color: 'var(--ok)', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 6, padding: '7px 10px' }}>
      {msg}
    </div>
  )
}

const fieldLabel: React.CSSProperties = {
  display: 'block', fontSize: 10, textTransform: 'uppercase',
  letterSpacing: 0.7, color: 'var(--fg-3)', fontWeight: 500, marginBottom: 5,
}
const fieldInput: React.CSSProperties = {
  width: '100%', padding: '7px 10px', border: '1px solid var(--line-strong)',
  borderRadius: 6, background: 'var(--bg-2)', color: 'var(--fg-0)',
  fontSize: 12, outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--font-ui)',
}
const btnPrimary: React.CSSProperties = {
  background: 'var(--accent)', color: 'var(--accent-fg)', border: 'none',
  padding: '7px 16px', borderRadius: 6, fontSize: 12, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'var(--font-ui)',
}
