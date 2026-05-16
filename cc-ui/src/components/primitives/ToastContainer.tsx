import React, { useEffect, useRef } from 'react'
import { useAppStore } from '../../store/useAppStore'
import type { Toast } from '../../store/useAppStore'
import { ICheck, IWarn, IAlertCircle, IClose } from './Icons'

// ── Per-toast auto-dismiss ────────────────────────────────────────────────────

function ToastItem({ toast }: { toast: Toast }) {
  const removeToast = useAppStore(s => s.removeToast)
  const preset      = useAppStore(s => s.preset)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const defaultDuration = toast.type === 'error' ? 0 : toast.type === 'warning' ? 6000 : 4000
  const duration = toast.duration !== undefined ? toast.duration : defaultDuration

  useEffect(() => {
    if (duration === 0) return
    timerRef.current = setTimeout(() => removeToast(toast.id), duration)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [toast.id, duration, removeToast])

  const isLight = document.documentElement.classList.contains('theme-light')

  const config = {
    success: { color: '#22c55e', tint: 'rgba(34,197,94,0.22)',  Icon: ICheck },
    error:   { color: '#ef4444', tint: 'rgba(239,68,68,0.22)',  Icon: IWarn },
    warning: { color: '#f59e0b', tint: 'rgba(245,158,11,0.22)', Icon: IWarn },
    info:    { color: '#94a3b8', tint: 'rgba(148,163,184,0.2)', Icon: IAlertCircle },
  }[toast.type]

  // Light theme → always dark card; dark theme → colored tint card
  const bg = isLight ? '#18181b' : config.tint

  void preset // read preset so component re-renders when theme changes

  return (
    <div style={{
      position: 'relative',
      background: bg,
      backdropFilter: isLight ? undefined : 'blur(20px)',
      WebkitBackdropFilter: isLight ? undefined : 'blur(20px)',
      border: `1px solid ${config.color}${isLight ? '55' : '40'}`,
      borderLeft: `3px solid ${config.color}`,
      borderRadius: 10,
      boxShadow: `0 8px 32px rgba(0,0,0,${isLight ? '0.55' : '0.4'})`,
      padding: '14px 14px 14px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      minWidth: 0,
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
        <config.Icon style={{ width: 15, height: 15, color: '#fff', flexShrink: 0, marginTop: 1 }} />
        <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: '#fff', lineHeight: 1.35, fontFamily: 'var(--font-ui)' }}>
          {toast.title}
        </span>
        <button
          onClick={() => removeToast(toast.id)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', padding: 0, display: 'flex', alignItems: 'center', flexShrink: 0, marginTop: 1 }}
        >
          <IClose style={{ width: 12, height: 12 }} />
        </button>
      </div>

      {/* Body */}
      {toast.body && (
        <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.7)', lineHeight: 1.45, paddingLeft: 24, fontFamily: 'var(--font-ui)', wordBreak: 'break-word' }}>
          {toast.body}
        </div>
      )}

      {/* Action buttons */}
      {toast.actions && toast.actions.length > 0 && (
        <div style={{ display: 'flex', gap: 6, paddingLeft: 24, marginTop: 2 }}>
          {toast.actions.map((a, i) => (
            <button
              key={i}
              onClick={() => { a.onClick(); removeToast(toast.id) }}
              style={{
                padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 5,
                fontFamily: 'var(--font-ui)', cursor: 'pointer',
                ...(a.variant === 'ghost'
                  ? { background: 'rgba(255,255,255,0.1)', border: `1px solid rgba(255,255,255,0.2)`, color: '#fff' }
                  : { background: config.color, border: 'none', color: '#fff' }
                ),
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Container ─────────────────────────────────────────────────────────────────

export function ToastContainer() {
  const toasts = useAppStore(s => s.toasts)
  if (toasts.length === 0) return null
  return (
    <div style={{
      position: 'fixed', top: 16, right: 16,
      zIndex: 10100,
      display: 'flex', flexDirection: 'column', gap: 10,
      width: 320, maxWidth: 'calc(100vw - 32px)',
      pointerEvents: 'none',
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{ pointerEvents: 'all' }}>
          <ToastItem toast={t} />
        </div>
      ))}
    </div>
  )
}
