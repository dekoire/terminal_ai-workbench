import { useState, useRef } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { IClose, ICamera, IUser, ILogout, ILock } from '../primitives/Icons'
import { getSupabase } from '../../lib/supabase'
import avatarDefault from '../../assets/avatar.jpg'

const NAV = ['Profil'] as const
type NavItem = typeof NAV[number]

export function ProfileSettings() {
  const { setScreen, currentUser, setCurrentUser, supabaseUrl, supabaseAnonKey } = useAppStore()
  const [activeNav, setActiveNav] = useState<NavItem>('Profil')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-0)', overflow: 'hidden' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px 13px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <IUser style={{ width: 15, height: 15, color: 'var(--accent)' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)' }}>Profil</span>
        </div>
        <button
          onClick={() => setScreen('workspace')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-3)', display: 'flex', alignItems: 'center', padding: 4, borderRadius: 6 }}
        >
          <IClose style={{ width: 14, height: 14 }} />
        </button>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        <div style={{ width: 200, borderRight: '1px solid var(--line)', padding: '12px 8px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {NAV.map(item => (
            <button
              key={item}
              onClick={() => setActiveNav(item)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: activeNav === item ? 500 : 400,
                background: activeNav === item ? 'var(--bg-3)' : 'transparent',
                color: activeNav === item ? 'var(--fg-0)' : 'var(--fg-2)',
                textAlign: 'left', width: '100%',
              }}
            >
              <IUser style={{ width: 13, height: 13, flexShrink: 0 }} />
              {item}
            </button>
          ))}

          <div style={{ flex: 1 }} />

          <button
            onClick={() => { setCurrentUser(null); setScreen('login') }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
              borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12,
              background: 'transparent', color: 'var(--fg-3)', textAlign: 'left', width: '100%',
            }}
          >
            <ILogout style={{ width: 13, height: 13, flexShrink: 0 }} />
            Ausloggen
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '28px 36px' }}>
          {activeNav === 'Profil' && (
            <ProfilPanel
              currentUser={currentUser}
              setCurrentUser={setCurrentUser}
              supabaseUrl={supabaseUrl}
              supabaseAnonKey={supabaseAnonKey}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function ProfilPanel({
  currentUser,
  setCurrentUser,
  supabaseUrl,
  supabaseAnonKey,
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

  const [curPwd, setCurPwd]   = useState('')
  const [newPwd, setNewPwd]   = useState('')
  const [confPwd, setConfPwd] = useState('')
  const [pwdSaved, setPwdSaved] = useState(false)
  const [pwdError, setPwdError] = useState('')

  const fileRef = useRef<HTMLInputElement>(null)

  const [avatarUploading, setAvatarUploading] = useState(false)

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !currentUser) return

    // Show local preview immediately
    const reader = new FileReader()
    reader.onload = ev => {
      const dataUrl = ev.target?.result as string
      setAvatarSrc(dataUrl)
    }
    reader.readAsDataURL(file)

    // Upload to R2 under {userId}/profile/
    setAvatarUploading(true)
    try {
      const res = await fetch('/api/r2-upload', {
        method: 'POST',
        headers: {
          'Content-Type': file.type || 'image/jpeg',
          'X-File-Name': encodeURIComponent(file.name),
          'X-User-Id': currentUser.id,
          'X-Folder': 'profile',
        },
        body: file,
      })
      const data = await res.json() as { ok: boolean; url?: string; error?: string }
      if (data.ok && data.url) {
        setAvatarSrc(data.url)
        setCurrentUser({ ...currentUser, avatarDataUrl: data.url })
      } else {
        // Fall back to data URL stored locally
        const dataUrl = avatarSrc
        setCurrentUser({ ...currentUser, avatarDataUrl: dataUrl })
      }
    } catch {
      // keep local data URL
      setCurrentUser({ ...currentUser, avatarDataUrl: avatarSrc })
    } finally {
      setAvatarUploading(false)
    }
  }

  const handleSaveInfo = async () => {
    setInfoError(''); setInfoSaved(false)
    if (!currentUser) { setInfoError('Nicht eingeloggt.'); return }
    const sb = getSupabase(supabaseUrl, supabaseAnonKey)
    if (!sb) {
      // Local mode — just update store
      setCurrentUser({ ...currentUser, firstName, lastName, email })
      setInfoSaved(true)
      return
    }
    const { error } = await sb.auth.updateUser({
      email: email !== currentUser.email ? email : undefined,
      data: { first_name: firstName, last_name: lastName },
    })
    if (error) { setInfoError(error.message); return }
    setCurrentUser({ ...currentUser, firstName, lastName, email })
    setInfoSaved(true)
    setTimeout(() => setInfoSaved(false), 2500)
  }

  const handleChangePwd = async () => {
    setPwdError(''); setPwdSaved(false)
    if (!newPwd) { setPwdError('Neues Passwort eingeben.'); return }
    if (newPwd !== confPwd) { setPwdError('Passwörter stimmen nicht überein.'); return }
    if (newPwd.length < 6) { setPwdError('Mindestens 6 Zeichen.'); return }
    const sb = getSupabase(supabaseUrl, supabaseAnonKey)
    if (!sb) { setPwdError('Supabase nicht konfiguriert.'); return }
    const { error } = await sb.auth.updateUser({ password: newPwd })
    if (error) { setPwdError(error.message); return }
    setPwdSaved(true)
    setCurPwd(''); setNewPwd(''); setConfPwd('')
    setTimeout(() => setPwdSaved(false), 2500)
  }

  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || (currentUser?.email?.charAt(0) ?? '?').toUpperCase()

  return (
    <div style={{ maxWidth: 520 }}>
      <h2 style={{ margin: '0 0 28px', fontSize: 18, fontWeight: 600, color: 'var(--fg-0)', letterSpacing: -0.3 }}>
        Profil
      </h2>

      {/* Avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 32 }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          {avatarSrc && avatarSrc !== avatarDefault ? (
            <img
              src={avatarSrc}
              alt="Avatar"
              style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover' }}
            />
          ) : (
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: 'var(--accent)', color: 'var(--accent-fg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24, fontWeight: 700,
              overflow: 'hidden',
            }}>
              {currentUser?.avatarDataUrl ? (
                <img src={currentUser.avatarDataUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                initials
              )}
            </div>
          )}
          <button
            onClick={() => fileRef.current?.click()}
            title="Bild ändern"
            style={{
              position: 'absolute', bottom: 0, right: 0,
              width: 24, height: 24, borderRadius: '50%',
              background: avatarUploading ? 'var(--accent)' : 'var(--bg-2)',
              border: '1px solid var(--line-strong)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: avatarUploading ? '#fff' : 'var(--fg-1)',
            }}
          >
            {avatarUploading
              ? <div style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid #fff4', borderTopColor: '#fff', animation: 'cc-spin 0.7s linear infinite' }} />
              : <ICamera style={{ width: 12, height: 12 }} />
            }
          </button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--fg-0)' }}>
            {firstName || lastName ? `${firstName} ${lastName}`.trim() : currentUser?.email ?? 'Kein Name'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 3 }}>{currentUser?.email ?? '—'}</div>
          <button
            onClick={() => fileRef.current?.click()}
            style={{ marginTop: 8, fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            Bild ändern
          </button>
        </div>
      </div>

      {/* Separator */}
      <div style={{ height: 1, background: 'var(--line)', marginBottom: 24 }} />

      {/* User info */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.7, color: 'var(--fg-3)', fontWeight: 600, marginBottom: 14 }}>
          Persönliche Daten
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <FieldGroup label="Vorname" value={firstName} onChange={setFirstName} placeholder="Max" />
          <FieldGroup label="Nachname" value={lastName} onChange={setLastName} placeholder="Mustermann" />
        </div>
        <FieldGroup label="E-Mail" value={email} onChange={setEmail} placeholder="du@beispiel.com" type="email" />

        {infoError && <ErrorMsg msg={infoError} />}
        {infoSaved && <SuccessMsg msg="Gespeichert!" />}

        <button onClick={handleSaveInfo} style={{ ...btnPrimary, marginTop: 14 }}>
          Speichern
        </button>
      </div>

      {/* Separator */}
      <div style={{ height: 1, background: 'var(--line)', marginBottom: 24 }} />

      {/* Password change */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.7, color: 'var(--fg-3)', fontWeight: 600, marginBottom: 14 }}>
          <ILock style={{ width: 12, height: 12 }} />
          Passwort ändern
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <FieldGroup label="Neues Passwort" value={newPwd} onChange={setNewPwd} placeholder="••••••••" type="password" />
          <FieldGroup label="Passwort bestätigen" value={confPwd} onChange={setConfPwd} placeholder="••••••••" type="password" />
        </div>

        {pwdError && <ErrorMsg msg={pwdError} />}
        {pwdSaved && <SuccessMsg msg="Passwort geändert!" />}

        <button onClick={handleChangePwd} style={{ ...btnSecondary, marginTop: 14 }}>
          Passwort ändern
        </button>
      </div>
    </div>
  )
}

function FieldGroup({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <div>
      <label style={fieldLabel}>{label}</label>
      <input
        style={fieldInput}
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
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

const fieldLabel: React.CSSProperties = { display: 'block', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--fg-3)', fontWeight: 500, marginBottom: 5 }
const fieldInput: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid var(--line-strong)', borderRadius: 6, background: 'var(--bg-2)', color: 'var(--fg-0)', fontSize: 12, outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--font-ui)' }
const btnPrimary: React.CSSProperties = { background: 'var(--accent)', color: 'var(--accent-fg)', border: 'none', padding: '8px 16px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)' }
const btnSecondary: React.CSSProperties = { background: 'var(--bg-3)', color: 'var(--fg-1)', border: '1px solid var(--line-strong)', padding: '8px 16px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-ui)' }
