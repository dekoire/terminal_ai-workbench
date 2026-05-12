export function Avatar({ kind = 'user', size = 22 }: { kind?: 'user' | 'agent'; size?: number }) {
  if (kind === 'user') {
    return (
      <div style={{
        width: size, height: size, borderRadius: 6, background: 'var(--bg-4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.5, fontWeight: 600, color: 'var(--fg-1)', flexShrink: 0,
      }}>K</div>
    )
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: 6, background: 'var(--accent)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      color: 'var(--accent-fg)',
    }}>
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 12 12" fill="currentColor">
        <path d="M6 1L7.5 4.5 11 6 7.5 7.5 6 11 4.5 7.5 1 6 4.5 4.5z"/>
      </svg>
    </div>
  )
}
