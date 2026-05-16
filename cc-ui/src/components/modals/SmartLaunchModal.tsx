import React, { useState, useEffect } from 'react'
import { IPlay, ILoader, IWarn } from '../primitives/Icons'
import type { AppLauncherState, LaunchStatus } from '../../hooks/useAppLauncher'
import type { DetectionMethod } from '../../utils/launchUtils'

// ── Badge ─────────────────────────────────────────────────────────────────────

function MethodBadge({ method, status }: { method: DetectionMethod; status: LaunchStatus }) {
  if (status === 'detecting') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', color: 'var(--fg-3)', background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 99, padding: '2px 8px' }}>
        <ILoader style={{ width: 9, height: 9 }} /> Erkenne…
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', color: 'var(--err)', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 99, padding: '2px 8px' }}>
        Fehler
      </span>
    )
  }
  if (status === 'starting') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', color: 'var(--ok)', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 99, padding: '2px 8px' }}>
        <ILoader style={{ width: 9, height: 9 }} /> Startet…
      </span>
    )
  }
  const map: Record<string, { label: string; color: string; bg: string; border: string }> = {
    config:    { label: 'Gespeichert', color: 'var(--fg-2)',    bg: 'var(--bg-3)',              border: 'var(--line)' },
    heuristic: { label: 'Heuristik',   color: 'var(--fg-2)',    bg: 'var(--bg-3)',              border: 'var(--line)' },
    ai:        { label: 'KI',          color: 'var(--accent)',  bg: 'var(--accent-soft)',       border: 'var(--accent)' },
    manual:    { label: 'Manuell',     color: '#5b9cf6',        bg: 'rgba(91,156,246,0.12)',    border: 'rgba(91,156,246,0.35)' },
  }
  const style = method ? map[method] : map['heuristic']
  return (
    <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', color: style.color, background: style.bg, border: `1px solid ${style.border}`, borderRadius: 99, padding: '2px 8px' }}>
      {style.label}
    </span>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────

interface SmartLaunchModalProps {
  projectName: string
  state: AppLauncherState
  onStart: (cmd: string, port: number | undefined, remember: boolean) => void
  onRetryWithAI: () => void
  onClose: () => void
}

export function SmartLaunchModal({ projectName, state, onStart, onRetryWithAI, onClose }: SmartLaunchModalProps) {
  const [cmd, setCmd] = useState(state.cmd)
  const [portStr, setPortStr] = useState(state.port ? String(state.port) : '')
  const [remember, setRemember] = useState(true)

  // Keep fields in sync as state updates (detection completes)
  useEffect(() => { if (state.cmd)  setCmd(state.cmd) },  [state.cmd])
  useEffect(() => { if (state.port) setPortStr(String(state.port)) }, [state.port])

  const port = parseInt(portStr, 10) || undefined
  const disabled = state.status === 'detecting' || state.status === 'starting'
  const canStart = !disabled && cmd.trim().length > 0

  const input: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    background: 'var(--bg-0)', border: '1px solid var(--line-strong)',
    borderRadius: 6, padding: '6px 10px', fontSize: 12,
    color: disabled ? 'var(--fg-3)' : 'var(--fg-0)', fontFamily: 'var(--font-mono)',
    outline: 'none',
  }

  return (
    /* Backdrop */
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: 440, background: 'var(--bg-1)', border: '1px solid var(--line-strong)', borderRadius: 10, boxShadow: '0 20px 60px rgba(0,0,0,0.5)', overflow: 'hidden' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
          <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--fg-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            App starten — {projectName}
          </span>
          <MethodBadge method={state.method} status={state.status} />
        </div>

        <div style={{ padding: '16px 16px 20px' }}>

          {/* Error state */}
          {state.status === 'error' && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 12px', marginBottom: 16 }}>
              <IWarn style={{ width: 13, height: 13, color: 'var(--err)', flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 12, color: 'var(--fg-1)', lineHeight: 1.5 }}>{state.errorMsg}</span>
            </div>
          )}

          {/* Fields */}
          {state.status !== 'error' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--fg-3)', fontWeight: 500, display: 'block', marginBottom: 5 }}>Startbefehl</label>
                <input
                  value={cmd}
                  onChange={e => setCmd(e.target.value)}
                  disabled={disabled}
                  placeholder={disabled ? 'Erkenne Projekttyp…' : 'z.B. npm run dev'}
                  style={input}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--fg-3)', fontWeight: 500, display: 'block', marginBottom: 5 }}>Port</label>
                <input
                  value={portStr}
                  onChange={e => setPortStr(e.target.value)}
                  disabled={disabled}
                  placeholder="z.B. 5173"
                  style={{ ...input, width: 100 }}
                  type="number"
                />
              </div>
            </div>
          )}

          {/* Remember toggle */}
          {state.status !== 'error' && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: disabled ? 'default' : 'pointer', marginBottom: 18, userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={remember}
                onChange={e => setRemember(e.target.checked)}
                disabled={disabled}
                style={{ width: 13, height: 13, cursor: disabled ? 'default' : 'pointer', accentColor: 'var(--accent)' }}
              />
              <span style={{ fontSize: 12, color: 'var(--fg-2)' }}>In <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-1)' }}>project.config.json</code> merken</span>
            </label>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              onClick={onClose}
              style={{ background: 'none', border: '1px solid var(--line-strong)', borderRadius: 6, padding: '6px 14px', fontSize: 12, color: 'var(--fg-2)', cursor: 'pointer', fontFamily: 'var(--font-ui)' }}
            >
              Abbrechen
            </button>

            {state.status === 'error' ? (
              <button
                onClick={onRetryWithAI}
                style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent)', borderRadius: 6, padding: '6px 14px', fontSize: 12, color: 'var(--accent)', cursor: 'pointer', fontWeight: 600, fontFamily: 'var(--font-ui)' }}
              >
                Mit KI erneut versuchen
              </button>
            ) : (
              <button
                onClick={() => onStart(cmd.trim(), port, remember)}
                disabled={!canStart}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: canStart ? 'var(--accent)' : 'var(--bg-3)', border: 'none', borderRadius: 6, padding: '6px 16px', fontSize: 12, color: canStart ? 'var(--accent-fg)' : 'var(--fg-3)', cursor: canStart ? 'pointer' : 'not-allowed', fontWeight: 600, fontFamily: 'var(--font-ui)', transition: 'background 0.15s' }}
              >
                {state.status === 'starting'
                  ? <ILoader style={{ width: 12, height: 12 }} />
                  : <IPlay style={{ width: 12, height: 12 }} />
                }
                Starten
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
