/**
 * AdminPanel — modal overlay, only visible to users in adminEmails list.
 */

import React, { useState, useRef, useEffect } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { IShield, IClose, IUsers, IPlus, ITrash } from '../primitives/Icons'

export function AdminPanel({ onClose }: { onClose: () => void }) {
  const {
    currentUser, adminEmails, addAdminEmail, removeAdminEmail,
    projects, aliases,
  } = useAppStore()

  const [newEmail, setNewEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const totalSessions = projects.reduce((n, p) => n + p.sessions.length, 0)

  const handleAdd = () => {
    const email = newEmail.trim().toLowerCase()
    if (!email) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setEmailError('Ungültige E-Mail'); return }
    addAdminEmail(email)
    setNewEmail('')
    setEmailError('')
  }

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
    // Backdrop
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9990,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {/* Panel */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 480, maxHeight: '85vh', display: 'flex', flexDirection: 'column',
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

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 18px 8px' }}>

          {/* ── Aktueller Benutzer ── */}
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

          {/* ── System-Übersicht ── */}
          <div style={sectionLabel}>System-Übersicht</div>
          <div style={{ ...card, padding: '10px 14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[
                { label: 'Projekte',  value: projects.length },
                { label: 'Sessions',  value: totalSessions },
                { label: 'Aliases',   value: aliases.length },
              ].map(({ label, value }) => (
                <div key={label} style={{ textAlign: 'center', padding: '8px 0' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{value}</div>
                  <div style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Admin-Verwaltung ── */}
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

            {/* Add new admin */}
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
