/**
 * Shared lightweight markdown renderer.
 * Supports: headings, bold, italic, inline-code, fenced code blocks,
 *           blockquotes, unordered/ordered lists, tables, horizontal rules.
 * No external dependencies.
 */
import React, { useState } from 'react'
import { writeClipboard } from '../../lib/clipboard'

// ── Inline code copy button ────────────────────────────────────────────────────
function MiniCodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    writeClipboard(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1400) }).catch(() => {})
  }
  return (
    <div style={{ margin: '8px 0', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--line-strong)' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '4px 10px', background: 'var(--bg-3)', borderBottom: '1px solid var(--line-strong)' }}>
        <button onClick={copy} style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? 'var(--ok)' : 'var(--fg-2)', fontSize: 11, fontFamily: 'var(--font-ui)', padding: '1px 4px' }}>
          {copied ? '✓ Kopiert' : 'Kopieren'}
        </button>
      </div>
      <pre style={{ margin: 0, padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.65, color: 'var(--fg-1)', whiteSpace: 'pre-wrap', wordBreak: 'break-all', overflowX: 'auto', background: 'var(--bg-1)' }}>
        {code}
      </pre>
    </div>
  )
}

// ── Inline markdown (bold, italic, inline-code) ────────────────────────────────
export function parseInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  const re = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|(?<!\*)\*(?!\*)[^*]+\*(?!\*)(?<!\*)|(?<!_)_(?!_)[^_]+_(?!_))/g
  let last = 0, m: RegExpExecArray | null, idx = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    const tok = m[0]
    if (tok.startsWith('`'))
      parts.push(<code key={idx++} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.88em', background: 'var(--bg-2)', color: 'var(--accent)', padding: '1px 5px', borderRadius: 3 }}>{tok.slice(1, -1)}</code>)
    else if (tok.startsWith('**') || tok.startsWith('__'))
      parts.push(<strong key={idx++}>{tok.slice(2, -2)}</strong>)
    else
      parts.push(<em key={idx++}>{tok.slice(1, -1)}</em>)
    last = m.index + tok.length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

// ── Block markdown renderer ────────────────────────────────────────────────────
export function MarkdownContent({ text }: { text: string }) {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Fenced code block
    if (line.trimStart().startsWith('```')) {
      const startI = i
      const lang = line.trim().slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        codeLines.push(lines[i]); i++
      }
      i++ // consume closing ```
      elements.push(<MiniCodeBlock key={startI} code={codeLines.join('\n')} />)
      void lang
      continue
    }

    // Heading
    const hm = line.match(/^(#{1,3})\s+(.+)/)
    if (hm) {
      const lvl = hm[1].length
      const sizes = [17, 15, 13.5]
      elements.push(<div key={i} style={{ fontWeight: 700, fontSize: sizes[lvl - 1] ?? 13, margin: '10px 0 4px', lineHeight: 1.3 }}>{parseInline(hm[2])}</div>)
      i++; continue
    }

    // Horizontal rule
    if (/^[-*]{3,}$/.test(line.trim())) {
      elements.push(<hr key={i} style={{ border: 'none', borderTop: '1px solid rgba(128,128,128,0.25)', margin: '10px 0' }} />)
      i++; continue
    }

    // Blockquote
    if (line.startsWith('> ')) {
      elements.push(
        <div key={i} style={{ borderLeft: '3px solid rgba(128,128,128,0.4)', paddingLeft: 10, margin: '4px 0', opacity: 0.8, fontStyle: 'italic', fontSize: 12.5 }}>
          {parseInline(line.slice(2))}
        </div>
      )
      i++; continue
    }

    // Unordered list
    if (/^[-*+]\s/.test(line)) {
      const startI = i
      const items: string[] = []
      while (i < lines.length && /^[-*+]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*+]\s/, '')); i++
      }
      elements.push(
        <ul key={startI} style={{ margin: '4px 0', paddingLeft: 18, lineHeight: 1.7 }}>
          {items.map((it, j) => <li key={j} style={{ fontSize: 13 }}>{parseInline(it)}</li>)}
        </ul>
      )
      continue
    }

    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      const startI = i
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, '')); i++
      }
      elements.push(
        <ol key={startI} style={{ margin: '4px 0', paddingLeft: 20, lineHeight: 1.7 }}>
          {items.map((it, j) => <li key={j} style={{ fontSize: 13 }}>{parseInline(it)}</li>)}
        </ol>
      )
      continue
    }

    // Markdown table
    if (line.trimStart().startsWith('|')) {
      const startI = i
      const tableLines: string[] = []
      while (i < lines.length && lines[i].trimStart().startsWith('|')) {
        tableLines.push(lines[i]); i++
      }
      const parseCells = (row: string) => row.replace(/^\||\|$/g, '').split('|').map(c => c.trim())
      const isSep = (row: string) => /^[\s|:\-]+$/.test(row)
      const rows = tableLines.filter(r => !isSep(r))
      const head = rows[0] ? parseCells(rows[0]) : []
      const body = rows.slice(1).map(r => parseCells(r))
      elements.push(
        <div key={startI} style={{ overflowX: 'auto', margin: '8px 0' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 12.5, width: '100%' }}>
            <thead>
              <tr>
                {head.map((cell, j) => (
                  <th key={j} style={{ padding: '4px 10px', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid rgba(128,128,128,0.3)', whiteSpace: 'nowrap' }}>
                    {parseInline(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((row, ri) => (
                <tr key={ri} style={{ background: ri % 2 === 0 ? 'transparent' : 'rgba(128,128,128,0.05)' }}>
                  {row.map((cell, j) => (
                    <td key={j} style={{ padding: '4px 10px', verticalAlign: 'top' }}>
                      {parseInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      continue
    }

    // Empty line → spacer
    if (line.trim() === '') {
      elements.push(<div key={i} style={{ height: 5 }} />)
      i++; continue
    }

    // Paragraph
    elements.push(<div key={i} style={{ fontSize: 13, lineHeight: 1.65, margin: '1px 0' }}>{parseInline(line)}</div>)
    i++
  }

  return <>{elements}</>
}
