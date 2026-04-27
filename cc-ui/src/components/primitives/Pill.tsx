import { ReactNode, CSSProperties } from 'react'

type Tone = 'neutral' | 'accent' | 'ok' | 'warn' | 'err' | 'danger' | 'info'

const tones: Record<Tone, { bg: string; fg: string; dot: string }> = {
  neutral: { bg: 'var(--bg-3)', fg: 'var(--fg-1)', dot: 'var(--fg-2)' },
  accent:  { bg: 'var(--accent-soft)', fg: 'var(--accent)', dot: 'var(--accent)' },
  ok:      { bg: 'rgba(124,217,168,0.12)', fg: 'var(--ok)', dot: 'var(--ok)' },
  warn:    { bg: 'rgba(244,195,101,0.12)', fg: 'var(--warn)', dot: 'var(--warn)' },
  err:     { bg: 'rgba(239,122,122,0.12)', fg: 'var(--err)', dot: 'var(--err)' },
  danger:  { bg: 'var(--danger-soft)', fg: 'var(--danger)', dot: 'var(--danger)' },
  info:    { bg: 'rgba(138,180,255,0.12)', fg: 'var(--info)', dot: 'var(--info)' },
}

export function Pill({ tone = 'neutral', dot, children, style }: { tone?: Tone; dot?: boolean; children: ReactNode; style?: CSSProperties }) {
  const t = tones[tone]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 7px', borderRadius: 99, fontSize: 10.5, fontWeight: 500,
      background: t.bg, color: t.fg, letterSpacing: 0.1,
      ...style,
    }}>
      {dot && <span style={{ width: 5, height: 5, borderRadius: '50%', background: t.dot, flexShrink: 0 }} />}
      {children}
    </span>
  )
}
