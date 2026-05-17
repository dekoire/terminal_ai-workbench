import React, { useState } from 'react'
import ReactDOM from 'react-dom'

interface FileCardProps {
  name: string
  content: string
  /** optional: overrides extension derived from filename */
  ext?: string
}

export function FileCard({ name, content, ext: extProp }: FileCardProps) {
  const [hov, setHov] = useState(false)
  const [open, setOpen] = useState(false)
  const ext = (extProp || name.split('.').pop() || 'FILE').toUpperCase().slice(0, 6)

  return (
    <>
      <div style={{ display: 'block', marginTop: 6 }}>
        <div
          onClick={() => setOpen(true)}
          onMouseEnter={() => setHov(true)}
          onMouseLeave={() => setHov(false)}
          title="Dateiinhalt anzeigen"
          style={{
            display: 'inline-flex', alignItems: 'stretch', borderRadius: 8,
            background: hov ? 'rgba(220,220,220,0.95)' : 'rgba(255,255,255,0.92)',
            border: '1px solid rgba(255,255,255,0.5)',
            cursor: 'pointer', overflow: 'hidden',
            transition: 'background 0.15s',
          }}
        >
          {/* Extension badge — fixed width */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 44, flexShrink: 0,
            background: hov ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.5)',
            borderRight: '1px solid rgba(0,0,0,0.08)',
            transition: 'background 0.15s',
          }}>
            <span style={{ fontSize: 9, fontWeight: 800, color: 'rgba(0,0,0,0.5)', letterSpacing: 0.5, fontFamily: 'var(--font-mono)' }}>
              {ext}
            </span>
          </div>
          {/* Right: label + filename */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '5px 10px', minWidth: 0 }}>
            <span style={{ fontSize: 11, color: 'rgba(0,0,0,0.75)', lineHeight: 1.2, fontFamily: 'var(--font-ui)' }}>Datei</span>
            <span style={{ fontSize: 10, color: 'rgba(0,0,0,0.4)', fontFamily: 'var(--font-mono)', lineHeight: 1.3, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
              {name}
            </span>
          </div>
        </div>
      </div>

      {open && ReactDOM.createPortal(
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 100002, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: 'var(--bg-1)', borderRadius: 12, width: '78vw', maxWidth: 860, maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--line)', boxShadow: '0 12px 48px rgba(0,0,0,0.5)' }}
          >
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 3, background: 'var(--bg-2)', color: 'var(--fg-2)', letterSpacing: 0.5, fontFamily: 'var(--font-mono)' }}>{ext}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--fg-1)' }}>{name}</span>
              </div>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-3)', fontSize: 20, lineHeight: 1, padding: '0 4px' }}>×</button>
            </div>
            <pre style={{ margin: 0, padding: '14px 16px', overflow: 'auto', flex: 1, fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--fg-1)', whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: 1.6 }}>{content}</pre>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
