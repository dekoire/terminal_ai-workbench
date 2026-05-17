import { useState } from 'react'

// ── JsonTree ───────────────────────────────────────────────────────────────────
// Unified collapsible JSON-tree renderer used in CenterPanel (FileTabViewer)
// and RightSidebar (DataViewer). Replaces the near-identical FtvJson* and
// Json* families which were defined independently in each file.
//
// Usage:
//   <JsonTreeNode value={parsedJson} depth={0} />

export function JsonTreeNode({ value, depth }: { value: unknown; depth: number }): React.ReactElement {
  if (value === null)             return <span style={{ color: 'var(--fg-3)' }}>null</span>
  if (value === undefined)        return <span style={{ color: 'var(--fg-3)' }}>undefined</span>
  if (typeof value === 'boolean') return <span style={{ color: '#3b82f6' }}>{String(value)}</span>
  if (typeof value === 'number')  return <span style={{ color: '#10b981' }}>{value}</span>
  if (typeof value === 'string')  return <span style={{ color: '#a78bfa' }}>"{value}"</span>
  if (Array.isArray(value))       return <JsonTreeArr arr={value} depth={depth} />
  if (typeof value === 'object')  return <JsonTreeObj obj={value as Record<string, unknown>} depth={depth} />
  return <span>{String(value)}</span>
}

function JsonTreeObj({ obj, depth }: { obj: Record<string, unknown>; depth: number }) {
  const [collapsed, setCollapsed] = useState(depth >= 2)
  const keys = Object.keys(obj)
  if (keys.length === 0) return <span style={{ color: 'var(--fg-2)' }}>{'{}'}</span>
  return (
    <span>
      <span
        onClick={() => setCollapsed(c => !c)}
        style={{ cursor: 'pointer', color: 'var(--fg-3)', userSelect: 'none', fontSize: 9 }}
      >{collapsed ? '▶' : '▼'}</span>
      {' '}
      {collapsed ? (
        <span
          onClick={() => setCollapsed(false)}
          style={{ color: 'var(--fg-3)', cursor: 'pointer', fontSize: 10 }}
        >{'{'} {keys.length} {keys.length === 1 ? 'key' : 'keys'} {'}'}</span>
      ) : (
        <>
          {'{'}
          <div style={{ paddingLeft: 16 }}>
            {keys.map((k, i) => (
              <div key={k}>
                <span style={{ color: 'var(--accent)' }}>"{k}"</span>
                <span style={{ color: 'var(--fg-3)' }}>: </span>
                <JsonTreeNode value={obj[k]} depth={depth + 1} />
                {i < keys.length - 1 && <span style={{ color: 'var(--fg-3)' }}>,</span>}
              </div>
            ))}
          </div>
          {'}'}
        </>
      )}
    </span>
  )
}

function JsonTreeArr({ arr, depth }: { arr: unknown[]; depth: number }) {
  const [collapsed, setCollapsed] = useState(depth >= 2)
  if (arr.length === 0) return <span style={{ color: 'var(--fg-2)' }}>{'[]'}</span>
  return (
    <span>
      <span
        onClick={() => setCollapsed(c => !c)}
        style={{ cursor: 'pointer', color: 'var(--fg-3)', userSelect: 'none', fontSize: 9 }}
      >{collapsed ? '▶' : '▼'}</span>
      {' '}
      {collapsed ? (
        <span
          onClick={() => setCollapsed(false)}
          style={{ color: 'var(--fg-3)', cursor: 'pointer', fontSize: 10 }}
        >{'['} {arr.length} items {']'}</span>
      ) : (
        <>
          {'['}
          <div style={{ paddingLeft: 16 }}>
            {arr.map((v, i) => (
              <div key={i}>
                <JsonTreeNode value={v} depth={depth + 1} />
                {i < arr.length - 1 && <span style={{ color: 'var(--fg-3)' }}>,</span>}
              </div>
            ))}
          </div>
          {']'}
        </>
      )}
    </span>
  )
}
