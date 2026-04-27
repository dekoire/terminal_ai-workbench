import { IFile, ICopy } from '../primitives/Icons'

const DIFF_LINES = [
  { n: 42, tone: 'ctx', text: '  } catch (err) {' },
  { n: 43, tone: 'del', text: '-   await sleep(1000);' },
  { n: 43, tone: 'del', text: '-   return retry(charge, attempts + 1);' },
  { n: 44, tone: 'add', text: '+   if (!isTransient(err)) throw err;' },
  { n: 45, tone: 'add', text: '+   if (attempts >= MAX_ATTEMPTS) throw err;' },
  { n: 46, tone: 'add', text: '+   const delay = backoff(attempts);' },
  { n: 47, tone: 'add', text: '+   await sleep(delay);' },
  { n: 48, tone: 'add', text: '+   return retry(charge, attempts + 1);' },
  { n: 49, tone: 'ctx', text: '  }' },
]

const lineStyle: Record<string, { bg: string; fg: string }> = {
  add: { bg: 'rgba(124,217,168,0.06)', fg: 'var(--ok)' },
  del: { bg: 'rgba(239,122,122,0.06)', fg: 'var(--err)' },
  ctx: { bg: 'transparent', fg: 'var(--fg-1)' },
}

export function DiffBlock() {
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden', background: 'var(--bg-1)', marginTop: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--bg-2)', borderBottom: '1px solid var(--line)', fontSize: 11 }}>
        <IFile style={{ color: 'var(--fg-2)' }} />
        <span className="mono" style={{ color: 'var(--fg-0)' }}>src/charge-handler.ts</span>
        <span className="mono" style={{ color: 'var(--ok)' }}>+14</span>
        <span className="mono" style={{ color: 'var(--err)' }}>-6</span>
        <span style={{ flex: 1 }} />
        <ICopy style={{ color: 'var(--fg-3)', cursor: 'pointer' }} />
      </div>
      <pre style={{ margin: 0, padding: '8px 0', fontSize: 11.5, lineHeight: 1.55 }}>
        {DIFF_LINES.map((l, i) => (
          <div key={i} style={{ display: 'flex', background: lineStyle[l.tone].bg, color: lineStyle[l.tone].fg }}>
            <span style={{ width: 36, textAlign: 'right', paddingRight: 8, color: 'var(--fg-3)', flexShrink: 0, userSelect: 'none' }}>{l.n}</span>
            <span style={{ flex: 1, paddingRight: 12, whiteSpace: 'pre' }}>{l.text}</span>
          </div>
        ))}
      </pre>
    </div>
  )
}
