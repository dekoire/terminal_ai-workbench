import React, { useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { IHistory, IChev, IFolder, IBookmark, ISearch } from '../primitives/Icons'
import { Pill } from '../primitives/Pill'
import { Kbd } from '../primitives/Kbd'

const HISTORY = [
  { date: 'Today · 14:32', title: 'refactor retry logic in charge-handler', alias: 'claude-code', project: 'payments-api', dur: '6m', tokens: '12.4k', status: 'active' as const, expanded: true },
  { date: 'Today · 11:08', title: 'reduce p99 latency on /charges', alias: 'claude-code', project: 'payments-api', dur: '34m', tokens: '48.1k', status: 'done' as const },
  { date: 'Yesterday · 17:21', title: 'port redux store to zustand', alias: 'minimax', project: 'design-system', dur: '1h 12m', tokens: '88.2k', status: 'done' as const },
  { date: 'Yesterday · 09:55', title: 'audit dependencies', alias: 'aider', project: 'infra', dur: '4m', tokens: '5.6k', status: 'cancelled' as const },
  { date: '3 days ago · 22:14', title: 'debug cohort SQL', alias: 'aider', project: 'growth-dash', dur: '23m', tokens: '19.3k', status: 'done' as const },
  { date: '4 days ago · 16:02', title: 'add jest cases for retry', alias: 'minimax', project: 'payments-api', dur: '14m', tokens: '11.0k', status: 'done' as const },
]

const chip: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'var(--fg-1)', borderRadius: 6, fontSize: 11, fontFamily: 'var(--font-ui)', cursor: 'pointer' }

export function HistoryBrowser() {
  const { setScreen } = useAppStore()
  const [expandedIdx, setExpandedIdx] = useState(0)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-0)' }}>
      <div style={{ height: 36, display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px', background: 'var(--bg-1)', borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', gap: 7 }}>
          {['#3a3631','#3a3631','#3a3631'].map((c, i) => <span key={i} style={{ width: 11, height: 11, borderRadius: '50%', background: c }} />)}
        </div>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 11, color: 'var(--fg-2)' }}>History</div>
        <button onClick={() => setScreen('workspace')} style={{ background: 'transparent', border: 'none', color: 'var(--fg-2)', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>← Back</button>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ padding: '14px 22px 12px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--line)' }}>
          <IHistory style={{ color: 'var(--fg-2)' }} />
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--fg-0)' }}>Sessions</h2>
          <Pill tone="neutral">142</Pill>
          <span style={{ flex: 1 }} />
          {['Project: all', 'Alias: all', 'Last 7 days'].map((l, i) => (
            <button key={l} style={{ ...chip, background: i === 2 ? 'var(--accent-soft)' : 'var(--bg-2)', borderColor: i === 2 ? 'var(--accent-line)' : 'var(--line)', color: i === 2 ? 'var(--accent)' : 'var(--fg-1)' }}>
              {l}<IChev style={{ transform: 'rotate(90deg)', marginLeft: 4 }} />
            </button>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', border: '1px solid var(--line-strong)', borderRadius: 6, background: 'var(--bg-2)', width: 200 }}>
            <ISearch style={{ color: 'var(--fg-2)' }} />
            <input style={{ border: 'none', background: 'transparent', color: 'var(--fg-0)', fontSize: 12, outline: 'none', width: '100%' }} placeholder="Search sessions…" />
            <Kbd>⌘K</Kbd>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 22px 22px' }}>
          {HISTORY.map((item, i) => (
            <div key={i} style={{ border: '1px solid var(--line)', borderRadius: 6, marginBottom: 8, background: 'var(--bg-1)', borderColor: i === expandedIdx ? 'var(--accent-line)' : 'var(--line)', overflow: 'hidden' }}>
              <div onClick={() => setExpandedIdx(i === expandedIdx ? -1 : i)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer' }}>
                <IChev style={{ color: 'var(--fg-3)', transform: i === expandedIdx ? 'rotate(90deg)' : 'none', flexShrink: 0 }} />
                <div className="mono" style={{ width: 130, fontSize: 11, color: 'var(--fg-2)', flexShrink: 0 }}>{item.date}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, color: 'var(--fg-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--fg-3)', display: 'flex', gap: 8, marginTop: 2 }}>
                    <span><IFolder style={{ verticalAlign: -2 }} /> <span className="mono">{item.project}</span></span>
                    <span>·</span><span className="mono">{item.alias}</span><span>·</span>
                    <span>{item.dur}</span><span>·</span><span>{item.tokens} tokens</span>
                  </div>
                </div>
                {item.status === 'active' ? <Pill tone="accent" dot>active</Pill>
                  : item.status === 'done' ? <Pill tone="ok" dot>completed</Pill>
                  : <Pill tone="neutral" dot>cancelled</Pill>}
                <IBookmark style={{ color: 'var(--fg-3)', flexShrink: 0 }} />
              </div>
              {i === expandedIdx && (
                <div style={{ padding: '8px 14px 14px 36px', borderTop: '1px solid var(--line)', background: 'var(--bg-0)' }}>
                  <div style={{ fontSize: 11, color: 'var(--fg-2)', marginBottom: 8 }}>Preview · last 3 turns</div>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--fg-1)', lineHeight: 1.6 }}>
                    <div><span style={{ color: 'var(--fg-3)' }}>›</span> {item.title}</div>
                    <div><span style={{ color: 'var(--accent)' }}>◆</span> Read <span style={{ color: 'var(--fg-0)' }}>src/charge-handler.ts</span> · 86 lines</div>
                    <div><span style={{ color: 'var(--accent)' }}>◆</span> Edit <span style={{ color: 'var(--fg-0)' }}>src/charge-handler.ts</span> · <span style={{ color: 'var(--ok)' }}>+14</span> <span style={{ color: 'var(--err)' }}>-6</span></div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                    {['Resume', 'Fork', 'Export', 'Open project'].map(l => <button key={l} style={chip}>{l}</button>)}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
