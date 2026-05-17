import React, { useState } from 'react'
import { IOrbit, IBot } from './Icons'

interface CtxCardProps {
  onClick: () => void
  refTokens: string[]
}

export function CtxCard({ onClick, refTokens }: CtxCardProps) {
  const [hov, setHov] = useState(false)
  const isAgent = refTokens.length > 0 && refTokens.every(t => t.startsWith('#amsg:'))
  const Icon = isAgent ? IBot : IOrbit
  const iconColor = isAgent ? 'var(--accent)' : 'var(--orbit)'

  return (
    <div style={{ display: 'block', marginTop: 6 }}>
      <div
        onClick={onClick}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        title="Kontext anzeigen"
        style={{
          display: 'inline-flex', alignItems: 'stretch', borderRadius: 8,
          background: hov ? 'rgba(220,220,220,0.95)' : 'rgba(255,255,255,0.92)',
          border: '1px solid rgba(255,255,255,0.5)',
          cursor: 'pointer', fontFamily: 'var(--font-ui)', overflow: 'hidden',
          transition: 'background 0.15s',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 9px',
          background: hov ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.5)',
          borderRight: '1px solid rgba(0,0,0,0.08)',
          transition: 'background 0.15s',
        }}>
          <Icon style={{ width: 13, height: 13, color: iconColor }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '5px 10px' }}>
          <span style={{ fontSize: 11, color: 'rgba(0,0,0,0.75)', lineHeight: 1.2 }}>Kontext</span>
          {refTokens.length > 0 && (
            <span style={{ fontSize: 10, color: 'rgba(0,0,0,0.4)', fontFamily: 'var(--font-mono)', lineHeight: 1.3, marginTop: 2 }}>
              {refTokens.join(' · ')}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
