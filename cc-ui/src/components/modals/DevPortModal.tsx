import React, { useState, useEffect } from 'react'
import { IClose, IPlay } from '../primitives/Icons'

const fieldLabel: React.CSSProperties = {
  display: 'block', fontSize: 10, textTransform: 'uppercase',
  letterSpacing: 0.7, color: 'var(--fg-3)', fontWeight: 500, marginBottom: 6,
}
const fieldInput: React.CSSProperties = {
  width: '100%', padding: '7px 10px', border: '1px solid var(--line-strong)',
  borderRadius: 6, background: 'var(--bg-2)', color: 'var(--fg-0)',
  fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none', boxSizing: 'border-box',
}
const btnPrimary: React.CSSProperties = {
  background: 'var(--accent)', color: 'var(--accent-fg, #1a1410)',
  border: 'none', padding: '7px 14px', borderRadius: 6,
  fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)',
}
const btnGhost: React.CSSProperties = {
  background: 'transparent', color: 'var(--fg-1)',
  border: '1px solid var(--line-strong)', padding: '7px 14px',
  borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-ui)',
}

const COMMON_PORTS = [3000, 3001, 4000, 4200, 5173, 5174, 8000, 8080]

export interface DevServerConfig {
  port: number
}

interface DetectResult {
  framework: string | null
}

interface Props {
  projectPath: string
  currentPort?: number
  onConfirm: (cfg: DevServerConfig) => void
  onClose: () => void
}

export function DevPortModal({ projectPath, currentPort, onConfirm, onClose }: Props) {
  const [portVal, setPortVal] = useState(currentPort ? String(currentPort) : '')
  const [detecting, setDetecting] = useState(false)
  const [detectedPort, setDetectedPort] = useState<number | null>(null)
  const [framework, setFramework] = useState<string | null>(null)
  const [detecting2, setDetecting2] = useState(false)

  const port = parseInt(portVal.trim(), 10)
  const validPort = !isNaN(port) && port >= 1 && port <= 65535

  useEffect(() => {
    detectRunningPort()
    if (currentPort) detectFramework(currentPort)
  }, [])

  useEffect(() => {
    if (!validPort) return
    const t = setTimeout(() => detectFramework(port), 300)
    return () => clearTimeout(t)
  }, [portVal])

  const detectRunningPort = async () => {
    setDetecting(true)
    try {
      const r = await fetch(`/api/detect-port?path=${encodeURIComponent(projectPath)}`)
      const d = await r.json() as { port: number | null }
      if (d.port) {
        setDetectedPort(d.port)
        if (!portVal) setPortVal(String(d.port))
      }
    } catch {}
    setDetecting(false)
  }

  const detectFramework = async (p: number) => {
    setDetecting2(true)
    try {
      const r = await fetch(`/api/detect-cmd?path=${encodeURIComponent(projectPath)}&port=${p}`)
      const d = await r.json() as DetectResult
      setFramework(d.framework)
    } catch {}
    setDetecting2(false)
  }

  const confirm = () => {
    if (!validPort) return
    onConfirm({ port })
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(8,7,5,0.65)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: 420, maxWidth: '92vw', background: 'var(--bg-1)', border: '1px solid var(--line-strong)', borderRadius: 10, boxShadow: '0 24px 64px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        {/* Header */}
        <div style={{ height: 44, padding: '0 16px', display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--line)' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)' }}>Dev-Server starten</div>
            <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginTop: 1 }}>
              {detecting2 ? 'Framework wird erkannt…' : framework ? `Erkannt: ${framework}` : 'Port für dieses Projekt festlegen'}
            </div>
          </div>
          <IClose onClick={onClose} style={{ color: 'var(--fg-2)', cursor: 'pointer' }} />
        </div>

        {/* Body */}
        <div style={{ padding: '20px 20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={fieldLabel}>Port</label>
            <div style={{ display: 'flex', alignItems: 'stretch', border: '1px solid var(--line-strong)', borderRadius: 6, background: 'var(--bg-2)', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', padding: '0 10px', color: 'var(--fg-3)', borderRight: '1px solid var(--line)' }}>
                <IPlay style={{ width: 11, height: 11 }} />
              </div>
              <input
                autoFocus
                style={{ ...fieldInput, border: 'none', borderRadius: 0, background: 'transparent', flex: 1 }}
                value={portVal}
                onChange={e => { setPortVal(e.target.value) }}
                onKeyDown={e => e.key === 'Enter' && validPort && confirm()}
                placeholder="z.B. 3000, 5173, 8080"
                type="number"
                min={1}
                max={65535}
              />
              <button
                onClick={detectRunningPort}
                disabled={detecting}
                style={{ border: 'none', borderLeft: '1px solid var(--line)', background: 'var(--bg-3)', color: 'var(--fg-1)', padding: '0 12px', fontSize: 11.5, cursor: detecting ? 'wait' : 'pointer', fontFamily: 'var(--font-ui)', opacity: detecting ? 0.6 : 1, whiteSpace: 'nowrap' }}
              >
                {detecting ? 'Suche…' : 'Erkennen'}
              </button>
            </div>

            {detectedPort && (
              <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 5, padding: '4px 8px', borderRadius: 4, background: 'var(--bg-2)', border: '1px solid var(--line)' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ok)', flexShrink: 0 }} />
                <span style={{ fontSize: 10.5, color: 'var(--fg-2)', fontFamily: 'var(--font-mono)' }}>localhost:{detectedPort} läuft bereits</span>
              </div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
              {COMMON_PORTS.map(p => (
                <button
                  key={p}
                  onClick={() => setPortVal(String(p))}
                  style={{
                    border: `1px solid ${portVal === String(p) ? 'var(--accent)' : 'var(--line-strong)'}`,
                    background: portVal === String(p) ? 'var(--accent-soft)' : 'var(--bg-2)',
                    color: portVal === String(p) ? 'var(--accent)' : 'var(--fg-2)',
                    padding: '3px 9px', borderRadius: 5, fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-mono)',
                  }}
                >{p}</button>
              ))}
            </div>
          </div>

          {framework && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 6, background: 'var(--accent-soft)', border: '1px solid var(--accent-line)' }}>
              <IPlay style={{ width: 9, height: 9, color: 'var(--accent)' }} />
              <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 500 }}>{framework} erkannt</span>
              <span style={{ fontSize: 10.5, color: 'var(--fg-3)', marginLeft: 'auto' }}>Befehl wird automatisch generiert</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, padding: '12px 20px', borderTop: '1px solid var(--line)' }}>
          <button style={btnGhost} onClick={onClose}>Abbrechen</button>
          <button
            style={{ ...btnPrimary, opacity: validPort ? 1 : 0.45, display: 'flex', alignItems: 'center', gap: 6 }}
            disabled={!validPort}
            onClick={confirm}
          >
            <IPlay style={{ width: 9, height: 9 }} />
            Starten
          </button>
        </div>
      </div>
    </div>
  )
}
