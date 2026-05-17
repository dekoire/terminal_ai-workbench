import type { ReactNode } from 'react'
import { createElement } from 'react'

// ── highlightSegments ──────────────────────────────────────────────────────────
// Returns an array of React nodes where all case-insensitive occurrences of
// `query` inside `line` are wrapped in a <mark> element with a yellow
// background highlight.
//
// Used by FileTabViewer (CenterPanel) and DataViewer (RightSidebar).
//
// Usage:
//   {highlightSegments(line, search)}

export function highlightSegments(line: string, query: string): ReactNode {
  if (!query) return line
  const parts: ReactNode[] = []
  const lower = line.toLowerCase()
  const lowerQuery = query.toLowerCase()
  let cursor = 0
  let idx = lower.indexOf(lowerQuery)
  while (idx !== -1) {
    if (idx > cursor) parts.push(line.slice(cursor, idx))
    parts.push(
      createElement(
        'mark',
        { key: idx, style: { background: 'rgba(255,200,50,0.4)', color: 'inherit', borderRadius: 2 } },
        line.slice(idx, idx + query.length),
      ),
    )
    cursor = idx + query.length
    idx = lower.indexOf(lowerQuery, cursor)
  }
  if (cursor < line.length) parts.push(line.slice(cursor))
  return parts
}
