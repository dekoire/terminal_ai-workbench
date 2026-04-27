import { ReactNode } from 'react'

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <span style={{
      fontFamily: 'var(--font-mono)', fontSize: 10, padding: '1px 5px',
      border: '1px solid var(--line-strong)', borderRadius: 4, color: 'var(--fg-1)',
      background: 'var(--bg-2)', lineHeight: 1.4, flexShrink: 0,
    }}>
      {children}
    </span>
  )
}
