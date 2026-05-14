import React, { useEffect, useRef, useState, useCallback } from 'react'
import ReactDOM from 'react-dom'
import { useAppStore } from '../../store/useAppStore'
import type { SessionKind } from '../../store/useAppStore'
import { ISpinner, ICopy, IExternalLink, IBookmark, IChevDown, IChevUp, IMoveUpRight } from '../primitives/Icons'
import { getSupabase } from '../../lib/supabase'
import { saveAgentMessage, loadLastProjectMessages, loadLatestContextSummary, saveContextSummary, compressAgentHistory, loadAgentMessageById, type AgentMessage as DbAgentMessage } from '../../lib/agentSync'
import { resolveRefs } from '../../lib/resolveRefs'
import { newAgentMsgId } from '../../lib/ids'
import { PermissionDialog } from './PermissionDialog'
import type { PermissionDecision } from './PermissionDialog'

// ── ID helpers ────────────────────────────────────────────────────────────────
function newRunId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

function msgId(sessionId: string, runId: string, role: 'user' | 'assistant'): string {
  const sid = sessionId.replace(/[^a-z0-9]/gi, '').slice(-8).padStart(8, '0')
  return `${sid}-${runId}-${role}`
}

// ── Event types ───────────────────────────────────────────────────────────────
export type AgentEvent =
  | { type: 'run_start';   prompt: string;                                   ts: number }
  | { type: 'session_info'; model: string; session_id: string;              ts: number }
  | { type: 'thinking';    text: string;                                     ts: number }
  | { type: 'agent_start'; name: string; model: string; task?: string; goal?: string; backstory?: string; ts: number }
  | { type: 'tool_use';    id: string;   tool: string;  input: string;      ts: number }
  | { type: 'tool_result'; id: string;   output: string; ok: boolean;       ts: number }
  | { type: 'tool_start';  tool: string; args: string;  agent?: string;     ts: number }
  | { type: 'tool_done';   tool: string; output: string; agent?: string;    ts: number }
  | { type: 'text';        text: string;                                     ts: number }
  | { type: 'agent_done';  name: string; output?: string;                   ts: number }
  | { type: 'result';      text: string; tokens?: number; cost?: number; _msgId?: string; ts: number }
  | { type: 'error';       message: string;                                  ts: number }
  | { type: 'run_end';     tokens?: number; inputTokens?: number; outputTokens?: number; cost?: number; _textContent?: string; _msgId?: string; ts: number }
  | { type: 'permission';  requestId: string; toolName: string; input: Record<string, unknown>; toolUseId: string; fallbackText?: string; resolved?: { allow: boolean; scope: 'once' | 'session' | 'always' }; ts: number }
  | { type: 'rate_limit';  utilization: number; resets_at?: number;        ts: number }
  | { type: 'greeting';   suffix: string;                                   ts: number }
  | { type: 'session_start'; model: string; contextMsgCount?: number;       ts: number }

// ── Anthropic avatar — same SVG as orbit but in accent color ─────────────────
function AgentAvatar({ pulsing = false }: { pulsing?: boolean }) {
  const accentFill = { fill: 'var(--accent)' } as const
  const paths = [
    { t: 'matrix(40.987701,0,0,47.017293,-1066.181752,-723.213702)', delay: '0s' },
    { t: 'matrix(29.580315,28.930009,-31.91902,33.931797,1407.038703,-1975.472569)', delay: '-0.6s' },
    { t: 'matrix(29.238983,29.28855,-31.868474,33.077201,819.147115,-352.119241)', delay: '-2.4s' },
    { t: 'matrix(-40.986978,0.248248,-0.232396,-39.892632,4554.901946,4098.265856)', delay: '-3s' },
    { t: 'matrix(-27.307354,-31.16698,34.160049,-31.117626,1985.168069,4522.127633)', delay: '-4.8s' },
    { t: 'matrix(-29.582967,-33.764229,13.546438,-12.339941,2363.40733,3358.078607)', delay: '-5.4s' },
    { t: 'matrix(-29.582967,-33.764229,13.546438,-12.339941,3408.593705,4455.148787)', delay: '0s' },
    { t: 'matrix(-29.582967,-33.764229,13.546438,-12.339941,4423.039305,5458.184379)', delay: '-1.8s' },
    { t: 'matrix(-28.982321,-29.552586,32.605921,-33.245834,2047.144742,5568.348688)', delay: '-3.6s' },
    { t: 'matrix(0.231081,-41.792485,46.110431,0.265075,1710.296113,4624.331086)', delay: '-1.2s' },
    { t: 'matrix(-0.543775,-41.789472,43.312489,-0.585961,-625.339269,4646.686721)', delay: '-4.2s' },
  ]
  const d = 'M73,19.923L73,34.077C73,36.242 70.984,38 68.5,38C66.016,38 64,36.242 64,34.077L64,19.923C64,17.758 66.016,16 68.5,16C70.984,16 73,17.758 73,19.923Z'
  return (
    <div style={{ width: 26, height: 26, flexShrink: 0, alignSelf: 'flex-start', marginTop: 3 }}>
      <svg
        viewBox="0 0 3508 3508"
        style={{ width: 20, height: 20, display: 'block', animation: pulsing ? 'orbit-pulse 1.8s ease-in-out infinite' : 'orbit-spin 8s linear infinite' }}
      >
        {paths.map((p, k) => (
          <g key={k} transform={p.t}>
            <path d={d} style={{ ...accentFill, animation: 'orbit-pulse 6s cubic-bezier(0.4,0,0.2,1) infinite', animationDelay: p.delay, transformBox: 'fill-box', transformOrigin: 'center' }} />
          </g>
        ))}
      </svg>
    </div>
  )
}

// ── Claude parser — Claude Code stream-json --verbose format ──────────────────
// Returns ONE event per line (text/thinking/tool_use get their own events)
// Multiple events for one assistant message are returned from parseClaudeLine array form
function parseClaudeLine(line: string): AgentEvent | AgentEvent[] | null {
  const clean = line.trimEnd()
  if (!clean.trim().startsWith('{')) return null
  try {
    const ev = JSON.parse(clean) as Record<string, unknown>
    const ts = Date.now()
    switch (ev.type) {
      case 'system': {
        if (ev.subtype === 'init') {
          return {
            type: 'session_info',
            model: String((ev as Record<string, unknown>).model ?? ''),
            session_id: String((ev as Record<string, unknown>).session_id ?? ''),
            ts,
          }
        }
        return null
      }
      case 'assistant': {
        const msg = ev.message as Record<string, unknown> | undefined
        const content = (msg?.content ?? []) as Array<Record<string, unknown>>
        const results: AgentEvent[] = []
        for (const block of content) {
          if (block.type === 'thinking') {
            const t = String(block.thinking ?? '').trim()
            if (t) results.push({ type: 'thinking', text: t, ts })
          } else if (block.type === 'text') {
            const t = String(block.text ?? '').trim()
            if (t) results.push({ type: 'text', text: t, ts })
          } else if (block.type === 'tool_use') {
            const input = typeof block.input === 'object'
              ? JSON.stringify(block.input, null, 2)
              : String(block.input ?? '')
            results.push({ type: 'tool_use', id: String(block.id ?? ''), tool: String(block.name ?? ''), input, ts })
          }
        }
        return results.length ? results : null
      }
      case 'user': {
        // Tool results from claude's own tool calls
        const msg = ev.message as Record<string, unknown> | undefined
        const content = (msg?.content ?? []) as Array<Record<string, unknown>>
        const results: AgentEvent[] = []
        for (const block of content) {
          if (block.type === 'tool_result') {
            const inner = (block.content ?? []) as Array<Record<string, unknown>>
            const output = Array.isArray(inner)
              ? inner.map(b => String(b.text ?? '')).join('').trim()
              : String(block.content ?? '')
            results.push({
              type: 'tool_result',
              id: String(block.tool_use_id ?? ''),
              output,
              ok: !block.is_error,
              ts,
            })
          }
        }
        return results.length ? results : null
      }
      case 'rate_limit_event': {
        const info = ev.rate_limit_info as Record<string, unknown> | undefined
        const util = Number(info?.utilization ?? 0)
        if (util >= 0.75) {
          return { type: 'rate_limit', utilization: util, resets_at: info?.resetsAt ? Number(info.resetsAt) : undefined, ts }
        }
        return null
      }
      case 'result': {
        const usage = ev.usage as Record<string, unknown> | undefined
        const inputTokens  = usage ? Number(usage.input_tokens ?? 0) + Number(usage.cache_read_input_tokens ?? 0) : undefined
        const outputTokens = usage ? Number(usage.output_tokens ?? 0) : undefined
        const tokens = (inputTokens != null && outputTokens != null) ? inputTokens + outputTokens : undefined
        const cost = ev.total_cost_usd ?? ev.cost_usd
        return { type: 'run_end', tokens, inputTokens, outputTokens, cost: cost ? Number(cost) : undefined, ts }
      }
      default: return null
    }
  } catch { return null }
}


// ── Relative timestamp ────────────────────────────────────────────────────────
function formatTs(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'gerade eben'
  if (mins < 60) return `vor ${mins} Min.`
  const hours = Math.floor(mins / 60)
  if (hours < 12) return `vor ${hours} Std.`
  return new Date(ts).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr'
}

// ── Syntax highlighter ────────────────────────────────────────────────────────
type TokenType = 'keyword' | 'string' | 'number' | 'comment' | 'type' | 'fn' | 'plain'

const SYN_KEYWORDS = new Set([
  'const','let','var','function','return','if','else','for','while','do',
  'switch','case','break','continue','new','delete','typeof','instanceof',
  'in','of','import','export','default','from','class','extends','super',
  'this','null','undefined','true','false','async','await','try','catch',
  'finally','throw','yield','static','get','set','void','type','interface',
  'enum','implements','declare','namespace','module','as','keyof','readonly',
  'def','elif','except','with','pass','raise','lambda','and','or','not',
  'is','None','True','False','nonlocal','global','assert',
])
const SYN_TYPES = new Set([
  'string','number','boolean','object','any','never','unknown','Array',
  'Promise','Record','Map','Set','Date','Error','Object','Function',
  'Symbol','RegExp','JSON','Math','console','window','document','process',
])
const TOKEN_COLOR: Record<TokenType, string | undefined> = {
  keyword: 'var(--tok-keyword)',
  string:  'var(--tok-string)',
  number:  'var(--tok-number)',
  comment: 'var(--tok-comment)',
  type:    'var(--tok-type)',
  fn:      'var(--tok-fn)',
  plain:   undefined,
}
const HASH_COMMENT = new Set(['python','py','sh','bash','shell','yaml','yml','toml','ruby','rb','r'])
const PLAIN_LANGS  = new Set(['text','txt'])

function tokenize(line: string, hashComment: boolean): Array<{ t: TokenType; s: string }> {
  const toks: Array<{ t: TokenType; s: string }> = []
  let i = 0
  while (i < line.length) {
    const ch = line[i]
    if ((ch === '/' && line[i + 1] === '/') || (ch === '#' && hashComment)) {
      toks.push({ t: 'comment', s: line.slice(i) }); break
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      let j = i + 1
      while (j < line.length) {
        if (line[j] === '\\') { j += 2; continue }
        if (line[j] === ch) { j++; break }
        j++
      }
      toks.push({ t: 'string', s: line.slice(i, j) }); i = j; continue
    }
    if (/\d/.test(ch) && (i === 0 || !/\w/.test(line[i - 1]))) {
      let j = i
      while (j < line.length && /[\d.xXa-fA-F_]/.test(line[j])) j++
      toks.push({ t: 'number', s: line.slice(i, j) }); i = j; continue
    }
    if (/[a-zA-Z_$]/.test(ch)) {
      let j = i
      while (j < line.length && /[\w$]/.test(line[j])) j++
      const word = line.slice(i, j)
      const after = line.slice(j).trimStart()
      const t: TokenType = SYN_KEYWORDS.has(word) ? 'keyword'
        : SYN_TYPES.has(word) ? 'type'
        : after[0] === '(' ? 'fn'
        : 'plain'
      toks.push({ t, s: word }); i = j; continue
    }
    toks.push({ t: 'plain', s: ch }); i++
  }
  return toks
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }).catch(() => {})
  }
  const lines      = code.split('\n')
  const plain      = PLAIN_LANGS.has(lang)
  const hashCmt    = HASH_COMMENT.has(lang)
  const lineNumW   = lines.length >= 100 ? 40 : 28
  return (
    <div style={{ margin: '10px 0', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--line-strong)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 12px', background: 'var(--code-header-bg)', borderBottom: '1px solid var(--line-strong)' }}>
        <span style={{ fontFamily: '"JetBrains Mono","Cascadia Code",Menlo,monospace', fontSize: 11, color: 'var(--fg-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{lang || 'code'}</span>
        <button
          onClick={copy}
          title={copied ? 'Kopiert!' : 'Kopieren'}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? 'var(--tok-string)' : 'var(--fg-2)', padding: '2px 4px', display: 'flex', alignItems: 'center', transition: 'color 0.15s' }}
        >
          <ICopy size={12} />
        </button>
      </div>
      <div style={{ display: 'flex', background: 'var(--code-bg)', overflowX: 'auto' }}>
        <div style={{ padding: '12px 8px 12px 14px', textAlign: 'right', userSelect: 'none', fontFamily: '"JetBrains Mono","Cascadia Code",Menlo,monospace', fontSize: 12, lineHeight: 1.65, color: 'var(--fg-2)', minWidth: lineNumW, flexShrink: 0, borderRight: '1px solid var(--line-strong)' }}>
          {lines.map((_, idx) => <div key={idx}>{idx + 1}</div>)}
        </div>
        <pre style={{ margin: 0, padding: '12px 14px', fontFamily: '"JetBrains Mono","Cascadia Code",Menlo,monospace', fontSize: 12, lineHeight: 1.65, color: 'var(--fg-1)', whiteSpace: 'pre', flex: 1, minWidth: 0 }}>
          {lines.map((line, idx) => (
            <div key={idx}>
              {plain ? line : tokenize(line, hashCmt).map((tok, ti) => {
                const c = TOKEN_COLOR[tok.t]
                return c ? <span key={ti} style={{ color: c }}>{tok.s}</span> : tok.s
              })}
            </div>
          ))}
        </pre>
      </div>
    </div>
  )
}

// ── Minimal Markdown renderer (no deps) ───────────────────────────────────────

function InlineLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      style={{
        color: 'var(--info)', textDecoration: 'none',
        display: 'inline-flex', alignItems: 'center', gap: 3,
        verticalAlign: 'middle',
        background: 'rgba(138,180,255,0.08)', borderRadius: 4,
        padding: '0 4px',
      }}
    >
      {children}
      <IMoveUpRight style={{ width: 11, height: 11, flexShrink: 0 }} />
    </a>
  )
}

function InlinePath({ path }: { path: string }) {
  return (
    <span
      onClick={() => fetch(`/api/open?path=${encodeURIComponent(path)}`)}
      style={{
        cursor: 'pointer',
        color: 'var(--accent)',
        fontFamily: '"JetBrains Mono","Cascadia Code",Menlo,monospace',
        fontSize: '0.88em',
        display: 'inline-flex', alignItems: 'center', gap: 3,
        verticalAlign: 'middle',
        background: 'var(--accent-soft)', borderRadius: 4,
        padding: '0 4px',
      }}
    >
      {path}
      <IMoveUpRight style={{ width: 10, height: 10, flexShrink: 0, opacity: 0.8 }} />
    </span>
  )
}

function renderInline(text: string, key?: number): React.ReactNode {
  const parts: React.ReactNode[] = []
  const re = /(`[^`]+`)|(\*\*\*(.+?)\*\*\*)|(\*\*(.+?)\*\*)|(__(.+?)__)|(_((?:[^_])+?)_)|(\*(?!\*)((?:[^*])+?)\*)|(\[([^\]]+)\]\(([^)]+)\))|(https?:\/\/[^\s<>"'()\[\]{},]+)|((?:~\/|\.{1,2}\/|(?:\/[a-zA-Z0-9_.~-]+){2,})[^\s<>"'()\[\]{},]*)/g
  let last = 0; let m: RegExpExecArray | null; let idx = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(<React.Fragment key={idx++}>{text.slice(last, m.index)}</React.Fragment>)
    if (m[1])       parts.push(<code key={idx++} style={{ background: 'var(--inline-code-bg)', padding: '1px 5px', borderRadius: 3, fontFamily: '"JetBrains Mono","Cascadia Code",Menlo,monospace', fontSize: '0.88em', color: 'var(--accent)' }}>{m[1].slice(1, -1)}</code>)
    else if (m[2])  parts.push(<strong key={idx++}><em>{m[3]}</em></strong>)
    else if (m[4])  parts.push(<strong key={idx++}>{m[5]}</strong>)
    else if (m[6])  parts.push(<strong key={idx++}>{m[7]}</strong>)
    else if (m[8])  parts.push(<em key={idx++}>{m[9]}</em>)
    else if (m[10]) parts.push(<em key={idx++}>{m[11]}</em>)
    else if (m[12]) parts.push(<InlineLink key={idx++} href={m[14]}>{m[13]}</InlineLink>)
    else if (m[15]) parts.push(<InlineLink key={idx++} href={m[15]}>{m[15].length > 60 ? m[15].slice(0, 60) + '…' : m[15]}</InlineLink>)
    else if (m[16]) parts.push(<InlinePath key={idx++} path={m[16]} />)
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push(<React.Fragment key={idx++}>{text.slice(last)}</React.Fragment>)
  return key !== undefined ? <React.Fragment key={key}>{parts}</React.Fragment> : <>{parts}</>
}

// ── Auto code-block detection ─────────────────────────────────────────────────
function detectLang(text: string): string | null {
  const t = text.trim()
  if (/^<!DOCTYPE\s/i.test(t) || /^<html[\s>]/i.test(t)) return 'html'
  if (/^<[a-zA-Z][\s\S]*>[\s\S]*<\/[a-zA-Z]>/.test(t) && t.includes('\n')) return 'html'
  if ((t.startsWith('{') || t.startsWith('[')) && (() => { try { JSON.parse(t); return true } catch { return false } })()) return 'json'
  if (t.startsWith('<?xml') || t.startsWith('<svg')) return 'xml'
  const lines = t.split('\n')
  const codeScore = lines.filter(l => /^\s*(def |class |import |from |if |for |while |return |const |let |var |function |export )/.test(l)).length
  if (codeScore >= 3) return lines.some(l => l.trim().startsWith('def ') || l.trim().startsWith('import ')) ? 'python' : 'typescript'
  return null
}

function SmartOutput({ text, style }: { text: string; style?: React.CSSProperties }) {
  const lang = detectLang(text)
  if (lang) return <CodeBlock lang={lang} code={text.trim()} />
  return <TextBlock text={text} style={style} />
}

function parseCells(line: string): string[] {
  return line.split('|').slice(1, -1).map(c => c.trim())
}

function TableBlock({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div style={{ overflowX: 'auto', margin: '8px 0 12px' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} style={{ padding: '7px 14px', textAlign: 'left', borderBottom: '2px solid var(--accent)', color: 'var(--fg-2)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                {renderInline(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} style={{ background: ri % 2 === 1 ? 'var(--bg-1)' : 'transparent' }}>
              {row.map((cell, ci) => (
                <td key={ci} style={{ padding: '6px 14px', color: 'var(--fg-1)', verticalAlign: 'top', lineHeight: 1.5 }}>
                  {renderInline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Markdown({ text }: { text: string }) {
  const nodes: React.ReactNode[] = []
  const lines = text.split('\n')
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim()
      const code: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) { code.push(lines[i]); i++ }
      nodes.push(<CodeBlock key={i} lang={lang} code={code.join('\n')} />)
      i++; continue
    }
    const hm = line.match(/^(#{1,6})\s+(.+)/)
    if (hm) {
      const lvl = hm[1].length
      const sz = [17, 15, 13, 12, 12, 12][lvl - 1]
      nodes.push(<div key={i} style={{ fontWeight: 700, fontSize: sz, margin: `${lvl <= 2 ? 14 : 10}px 0 4px`, color: 'var(--fg-0)', lineHeight: 1.3 }}>{renderInline(hm[2])}</div>)
      if (lvl <= 2) nodes.push(<hr key={`${i}hr`} style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '4px 0 10px' }} />)
      i++; continue
    }
    // Table: line with | and next line is separator |---|
    if (line.startsWith('|') && i + 1 < lines.length && /^\|[\s\-:|]+\|/.test(lines[i + 1])) {
      const startI = i
      const headers = parseCells(line)
      i += 2 // skip header + separator
      const rows: string[][] = []
      while (i < lines.length && lines[i].startsWith('|')) { rows.push(parseCells(lines[i])); i++ }
      nodes.push(<TableBlock key={`t${startI}`} headers={headers} rows={rows} />)
      continue
    }
    if (/^[-*_]{3,}$/.test(line.trim())) {
      nodes.push(<hr key={i} style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '12px 0' }} />)
      i++; continue
    }
    if (line.startsWith('> ')) {
      const startI = i
      const qlines: string[] = []
      while (i < lines.length && lines[i].startsWith('> ')) { qlines.push(lines[i].slice(2)); i++ }
      nodes.push(
        <div key={startI} style={{ borderLeft: '3px solid var(--accent)', paddingLeft: 12, margin: '6px 0', color: 'var(--fg-2)', opacity: 0.8 }}>
          {qlines.map((ql, qi) => <div key={qi}>{renderInline(ql, qi)}</div>)}
        </div>
      )
      continue
    }
    if (/^[-*+]\s/.test(line)) {
      const startI = i
      const items: string[] = []
      while (i < lines.length && /^[-*+]\s/.test(lines[i])) { items.push(lines[i].replace(/^[-*+]\s/, '')); i++ }
      nodes.push(
        <ul key={startI} style={{ margin: '4px 0 8px', paddingLeft: 20, listStyle: 'none' }}>
          {items.map((it, ii) => (
            <li key={ii} style={{ marginBottom: 2, display: 'flex', gap: 8, alignItems: 'baseline' }}>
              <span style={{ color: 'var(--accent)', fontSize: 10, flexShrink: 0 }}>▸</span>
              <span>{renderInline(it)}</span>
            </li>
          ))}
        </ul>
      )
      continue
    }
    if (/^\d+\.\s/.test(line)) {
      const startI = i
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) { items.push(lines[i].replace(/^\d+\.\s/, '')); i++ }
      nodes.push(
        <ol key={startI} style={{ margin: '4px 0 8px', paddingLeft: 24 }}>
          {items.map((it, ii) => <li key={ii} style={{ marginBottom: 2 }}>{renderInline(it)}</li>)}
        </ol>
      )
      continue
    }
    if (line.trim() === '') { nodes.push(<div key={i} style={{ height: 6 }} />); i++; continue }
    nodes.push(<div key={i} style={{ lineHeight: 1.7 }}>{renderInline(line)}</div>)
    i++
  }
  return <>{nodes}</>
}

// ── Copyable text block ───────────────────────────────────────────────────────
function TextBlock({ text, style }: { text: string; style?: React.CSSProperties }) {
  const [copied, setCopied] = useState(false)
  const [hovered, setHovered] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }).catch(() => {})
  }
  return (
    <div
      style={{ position: 'relative', animation: 'agent-fadein 0.18s ease-out both', ...style }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Markdown text={text} />
      <button
        onClick={copy}
        title="Kopieren"
        style={{
          position: 'absolute', top: 0, right: 0,
          display: 'flex', alignItems: 'center', gap: 4,
          background: 'none', border: 'none', cursor: 'pointer',
          color: copied ? '#98c379' : 'var(--fg-3)',
          padding: '2px 0',
          fontSize: 10, opacity: hovered || copied ? 0.45 : 0,
          transition: 'opacity 0.15s',
        }}
      >
        {copied && <span>Kopiert</span>}
        <ICopy size={11} />
      </button>
    </div>
  )
}

// ── Popup-Marker Erkennung (Claude Text Output) ───────────────────────────────
// Erkennt [POPUP_REQUIRED], [ACTION_REQUIRED] etc. in Claudes Textausgabe.
const POPUP_RE = /\[(POPUP_REQUIRED|ACTION_REQUIRED[^\]]*|NEEDS_INTERACTION|AWAITING_USER_ACTION|DIALOG_OPEN)\]/i

function firePopupFromText(text: string, sid: string) {
  if (!POPUP_RE.test(text)) return
  const title   = text.match(/(?:Title|Titel):\s*"?([^"\n]{2,80})"?/i)?.[1]?.trim() ?? 'Aktion erforderlich'
  const message = text.match(/(?:Message|Nachricht|Content|Inhalt):\s*"?([^"\n]{2,300})"?/i)?.[1]?.trim() ?? ''
  const type    = text.match(/Type:\s*([a-z]+)/i)?.[1]?.toLowerCase() ?? 'alert'
  const bMatch  = text.match(/Buttons?:\s*\[([^\]]{2,400})\]/i)
  const buttons = bMatch
    ? bMatch[1].split(',').map(b => b.replace(/["']/g, '').trim()).filter(Boolean)
    : ['OK', 'Abbrechen']
  window.dispatchEvent(new CustomEvent('cc:popup', { detail: { sessionId: sid, title, message, type, buttons } }))
}

// ── Rendering helpers ─────────────────────────────────────────────────────────
const MONO: React.CSSProperties = { fontFamily: '"JetBrains Mono","Cascadia Code",Menlo,monospace', fontSize: 11 }

// Parse Python dict string → JS object (handles both JSON and Python dict syntax)
function tryParseArgs(s: string): Record<string, unknown> | null {
  try { return JSON.parse(s) as Record<string, unknown> } catch {}
  try {
    return JSON.parse(
      s.replace(/'/g, '"').replace(/\bTrue\b/g, 'true').replace(/\bFalse\b/g, 'false').replace(/\bNone\b/g, 'null')
    ) as Record<string, unknown>
  } catch {}
  return null
}

// Clean text: keep content, fix DeepSeek tool-call formatting + strip noise
const EMOJI_RE          = /[\u{1F300}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1FA00}-\u{1FA9F}]/gu
const DEEPSEEK_TOKEN_RE = /<｜[^｜]*｜>/g
function cleanText(s: string) {
  return s
    // Turn "function<｜tool▁sep｜>tool_name" into "**→ tool_name**" (bold label)
    .replace(/function<｜tool▁sep｜>(\S+)/g, '\n**→ $1**')
    // Remove remaining DeepSeek control tokens (end markers etc.)
    .replace(DEEPSEEK_TOKEN_RE, '')
    .replace(EMOJI_RE, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function AgentStartCard({ ev, delegatedRole }: { ev: Extract<AgentEvent, { type: 'agent_start' }>; delegatedRole?: string }) {
  const [open, setOpen] = useState(false)
  const hasMore = ev.task || ev.goal || ev.backstory
  const displayName = delegatedRole || ev.name
  const showModel   = ev.model && ev.model !== displayName
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 16 }}>{displayName}</span>
        {showModel && <span style={{ color: 'var(--fg-3)', ...MONO, fontSize: 12 }}>{ev.model}</span>}
        {hasMore && (
          <button
            onClick={() => setOpen(o => !o)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-3)', fontSize: 11, padding: '0 2px', opacity: 0.5 }}
          >
            {open ? '▼' : '▶'}
          </button>
        )}
      </div>
      {open && (
        <div style={{ marginTop: 6, padding: '8px 12px', background: 'var(--bg-1)', borderRadius: 6, border: '1px solid var(--line)', fontSize: 12, lineHeight: 1.65 }}>
          {ev.goal && (
            <div style={{ marginBottom: ev.backstory || ev.task ? 8 : 0 }}>
              <div style={{ color: 'var(--fg-3)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Ziel</div>
              <div style={{ color: 'var(--fg-1)', whiteSpace: 'pre-wrap' }}>{ev.goal}</div>
            </div>
          )}
          {ev.backstory && (
            <div style={{ marginBottom: ev.task ? 8 : 0 }}>
              <div style={{ color: 'var(--fg-3)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Hintergrund</div>
              <div style={{ color: 'var(--fg-2)', whiteSpace: 'pre-wrap', fontStyle: 'italic' }}>{ev.backstory}</div>
            </div>
          )}
          {ev.task && (
            <div>
              <div style={{ color: 'var(--fg-3)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Aufgabe</div>
              <div style={{ color: 'var(--fg-1)', whiteSpace: 'pre-wrap' }}>{ev.task}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ThinkingCard({ ev }: { ev: Extract<AgentEvent, { type: 'thinking' }> }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ marginBottom: 6 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', ...MONO, fontSize: 11 }}
      >
        <span style={{
          background: 'linear-gradient(90deg, var(--fg-3) 0%, var(--fg-0) 45%, var(--fg-2) 65%, var(--fg-3) 100%)',
          backgroundSize: '250% auto',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          animation: 'thinking-shimmer 4s ease-in-out infinite',
        } as React.CSSProperties}>Denkt</span>
        <span style={{ color: 'var(--fg-3)' }}>({ev.text.split(' ').length} Wörter)</span>
        <span style={{ color: 'var(--fg-3)', fontSize: 10 }}>{open ? '↑' : '›'}</span>
      </button>
      {open && (
        <div style={{ marginTop: 4, padding: '7px 12px', background: 'var(--bg-2)', borderRadius: '0 6px 6px 0', fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap', borderLeft: '2px solid var(--accent)' }}>
          <span style={{
            background: 'linear-gradient(135deg, var(--fg-3) 0%, var(--fg-0) 35%, var(--fg-1) 65%, var(--fg-3) 100%)',
            backgroundSize: '300% auto',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            animation: 'thinking-shimmer 5.5s ease-in-out infinite',
          } as React.CSSProperties}>{ev.text}</span>
        </div>
      )}
    </div>
  )
}

function ToolCard({ ev, result }: { ev: Extract<AgentEvent, { type: 'tool_use' }>, result?: Extract<AgentEvent, { type: 'tool_result' }> }) {
  const isFileSearch = ev.tool === 'Glob' || ev.tool === 'Grep'
  const isCollapsed  = isFileSearch || ev.tool === 'Read'
  const [open, setOpen] = useState(false)
  const ok = result ? result.ok : true
  const label = isFileSearch ? 'Suche Dateien' : ev.tool === 'Read' ? 'Lese Datei' : ev.tool === 'Bash' ? 'Bash' : ev.tool

  const displayHint = (() => {
    try {
      const p = JSON.parse(ev.input) as Record<string, unknown>
      if (ev.tool === 'Read') {
        const fp = String(p.file_path ?? p.path ?? '')
        return fp ? fp.split('/').pop() ?? fp : null
      }
      if (ev.tool === 'Glob' || ev.tool === 'Grep') {
        const pat = String(p.pattern ?? p.include ?? p.glob ?? '')
        return pat ? (pat.length > 42 ? pat.slice(0, 42) + '…' : pat) : null
      }
      if (ev.tool === 'Bash') {
        const cmd = String(p.command ?? '').trim().split('\n')[0]
        return cmd ? (cmd.length > 50 ? cmd.slice(0, 50) + '…' : cmd) : null
      }
    } catch { /* ignore */ }
    return null
  })()

  return (
    <div style={{ marginBottom: 6 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', ...MONO, fontSize: 11, color: ok ? 'var(--fg-2)' : '#ef7a7a' }}
      >
        <span>{label}</span>
        {displayHint && <span style={{ color: 'var(--fg-3)' }}>{displayHint}</span>}
        {result && !ok && <span style={{ color: '#ef7a7a' }}>fehlgeschlagen</span>}
        <span style={{ fontSize: 10, color: 'var(--fg-3)' }}>›</span>
      </button>
      {open && (
        <div style={{ marginTop: 4 }}>
          <CodeBlock lang="json" code={ev.input} />
          {result && (
            isCollapsed ? (
              <div style={{ margin: '2px 0 4px 0', paddingLeft: 14, fontSize: 12, color: 'var(--fg-2)', fontStyle: 'italic', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                {result.output || <span style={{ opacity: 0.5 }}>(leer)</span>}
              </div>
            ) : (
              <div style={{ margin: '4px 0', fontSize: 13, color: 'var(--fg-1)', lineHeight: 1.7 }}>
                {result.output ? <SmartOutput text={result.output} /> : <span style={{ opacity: 0.4 }}>(leer)</span>}
              </div>
            )
          )}
        </div>
      )}
    </div>
  )
}


// ── Working-group card (thinking + tool calls + text grouped) ────────────────
function WorkingGroupCard({ events, isActive = false }: { events: AgentEvent[]; isActive?: boolean }) {
  const [open, setOpen] = useState(false)

  // Split: work events (thinking/tools) vs text responses
  const textEvs = events.filter(e => e.type === 'text') as Extract<AgentEvent, { type: 'text' }>[]
  const workEvs = events.filter(e => e.type !== 'text')
  const hasWork = workEvs.length > 0

  const workInner: React.ReactNode[] = []
  let wi = 0
  while (wi < workEvs.length) {
    const ev = workEvs[wi]
    if (ev.type === 'thinking') {
      workInner.push(<div key={wi} style={{ paddingBottom: 5 }}><ThinkingCard ev={ev} /></div>)
    } else if (ev.type === 'tool_use') {
      const resultIdx = workEvs.findIndex((e, j) => j > wi && e.type === 'tool_result' && (e as Extract<AgentEvent, { type: 'tool_result' }>).id === ev.id)
      const result = resultIdx >= 0 ? workEvs[resultIdx] as Extract<AgentEvent, { type: 'tool_result' }> : undefined
      workInner.push(<div key={wi} style={{ paddingBottom: 5 }}><ToolCard ev={ev} result={result} /></div>)
    } else if (ev.type === 'tool_result') {
      const alreadyShown = workEvs.some((e, j) => j < wi && e.type === 'tool_use' && (e as Extract<AgentEvent, { type: 'tool_use' }>).id === ev.id)
      if (!alreadyShown) {
        workInner.push(
          <div key={wi} style={{ paddingBottom: 5, ...MONO, fontSize: 11, color: ev.ok ? 'var(--fg-2)' : '#ef7a7a' }}>
            {!ev.ok && <span style={{ color: '#ef7a7a', marginRight: 6 }}>fehlgeschlagen</span>}{ev.output}
          </div>
        )
      }
    }
    wi++
  }

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 14 }}>
      <AgentAvatar />
      <div style={{ flex: 1, minWidth: 0 }}>
      {/* Tool-calls/thinking — collapsible, only if present */}
      {hasWork && (
        <>
          <button
            onClick={() => setOpen(o => !o)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', fontSize: 11, marginBottom: 4 }}
          >
            <span style={isActive ? {
              background: 'linear-gradient(90deg, var(--fg-3) 0%, var(--fg-0) 40%, var(--fg-2) 65%, var(--fg-3) 100%)',
              backgroundSize: '250% auto',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              animation: 'thinking-shimmer 4.5s ease-in-out infinite',
            } as React.CSSProperties : { color: 'var(--fg-3)' }}>
              Codey denkt, analysiert, arbeitet an deiner Anfrage
            </span>
            <span style={{
              color: 'var(--fg-2)',
              animation: isActive ? 'thinking-pulse 2.2s ease-in-out infinite' : 'none',
              display: 'inline-block',
              fontSize: 12,
            }}>›</span>
          </button>
          {open && (
            <div style={{ marginBottom: 8, paddingLeft: 14, borderLeft: '1px solid var(--line)' }}>
              {workInner}
            </div>
          )}
        </>
      )}
      {/* Text response — always visible, no footer here (run_end owns the footer row) */}
      {textEvs.map((t, idx) => (
        <TextBlock key={idx} text={t.text} style={{ color: 'var(--fg-0)', fontSize: 14.5, lineHeight: 1.8, fontWeight: 430, marginBottom: idx < textEvs.length - 1 ? 8 : 0 }} />
      ))}
      </div>
    </div>
  )
}

function DelegationCard({ caller, task, context, isQuestion }: { caller: string; task: string; context: string; isQuestion?: boolean }) {
  const label = isQuestion ? 'stellt folgende Frage:' : 'stellt folgende Aufgabe:'
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ marginBottom: 8 }}>
        <span style={{ color: 'var(--fg-0)', fontWeight: 700, fontSize: 13 }}>{caller}</span>
        <span style={{ color: 'var(--fg-2)', fontSize: 13 }}> {label}</span>
      </div>
      {task && (
        <TextBlock
          text={cleanText(task)}
          style={{ color: 'var(--fg-1)', fontSize: 13, fontWeight: 700, lineHeight: 1.7, marginBottom: context ? 12 : 0 }}
        />
      )}
      {context && (
        <>
          <div style={{ color: 'var(--fg-3)', fontSize: 11, marginBottom: 4 }}>Kontext:</div>
          <TextBlock
            text={cleanText(context)}
            style={{ color: 'var(--fg-1)', fontSize: 13, lineHeight: 1.7 }}
          />
        </>
      )}
    </div>
  )
}

// Small external link
function UrlLink({ url }: { url: string }) {
  if (!url) return null
  const display = url.length > 72 ? url.slice(0, 72) + '…' : url
  return (
    <a href={url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--info)', fontSize: 11, marginTop: 3, textDecoration: 'none' }}>
      <IExternalLink size={10} />
      {display}
    </a>
  )
}


const WORKING_TYPES = new Set<AgentEvent['type']>(['thinking', 'tool_use', 'tool_result', 'text'])

// Render events, merging tool_use with their tool_result
function EventList({ events, kind, activeModel, cwd }: { events: AgentEvent[]; kind: string; activeModel: string; cwd: string }) {
  const rendered: React.ReactNode[] = []
  let i = 0
  while (i < events.length) {
    const ev = events[i]

    // Group consecutive working events (thinking + tool calls) for Claude sessions
    if (WORKING_TYPES.has(ev.type)) {
      const group: AgentEvent[] = []
      while (i < events.length && WORKING_TYPES.has(events[i].type)) {
        group.push(events[i++])
      }
      // Active only if no run_end follows this group yet (agent still working)
      const isActive = !events.slice(i).some(e => e.type === 'run_end' || e.type === 'result' || e.type === 'error')
      rendered.push(<div key={`wg-${i}`} style={{ paddingBottom: 10 }}><WorkingGroupCard events={group} isActive={isActive} /></div>)
      continue
    }

    // Try to find the role name from a preceding delegation event
    const findDelegatedRole = (): string | undefined => {
      for (let j = i - 1; j >= 0; j--) {
        const e = events[j]
        if (e.type === 'tool_start' && (e.tool === 'ask_question_to_coworker' || e.tool === 'delegate_work_to_coworker')) {
          try {
            const p = JSON.parse(e.args.replace(/'/g, '"').replace(/\bTrue\b/g,'true').replace(/\bFalse\b/g,'false').replace(/\bNone\b/g,'null')) as Record<string, unknown>
            return String(p.coworker ?? p.agent ?? '')
          } catch { return undefined }
        }
        if (e.type === 'agent_start') break // stop at previous agent
      }
      return undefined
    }

    const wrap = (node: React.ReactNode) => (
      <div key={i} style={{ paddingBottom: 5 }}>{node}</div>
    )
    if (ev.type === 'tool_use') {
      const resultIdx = events.findIndex((e, j) => j > i && e.type === 'tool_result' && (e as Extract<AgentEvent, { type: 'tool_result' }>).id === ev.id)
      const result = resultIdx >= 0 ? events[resultIdx] as Extract<AgentEvent, { type: 'tool_result' }> : undefined
      rendered.push(wrap(<ToolCard ev={ev} result={result} />))
    } else if (ev.type === 'tool_result') {
      const alreadyShown = events.some((e, j) => j < i && e.type === 'tool_use' && (e as Extract<AgentEvent, { type: 'tool_use' }>).id === (ev as Extract<AgentEvent, { type: 'tool_result' }>).id)
      if (!alreadyShown) {
        rendered.push(wrap(
          <div style={{ ...MONO, fontSize: 11, color: ev.ok ? 'var(--fg-2)' : '#ef7a7a' }}>
            {!ev.ok && <span style={{ color: '#ef7a7a', marginRight: 6 }}>fehlgeschlagen</span>}{ev.output}
          </div>
        ))
      }
    } else if (ev.type === 'agent_start') {
      const delegatedRole = findDelegatedRole()
      rendered.push(wrap(<AgentStartCard ev={ev} delegatedRole={delegatedRole} />))
    } else if (ev.type === 'run_end') {
      // Collect all text since the last run_start for the copy button
      const lastRunStart = events.slice(0, i).reduce((idx, e, j) => e.type === 'run_start' ? j : idx, -1)
      const textContent = events
        .slice(lastRunStart + 1, i)
        .filter(e => e.type === 'text')
        .map(e => (e as Extract<AgentEvent, { type: 'text' }>).text)
        .join('')
      rendered.push(wrap(<EventRow ev={{ ...ev, _textContent: textContent || undefined }} activeModel={activeModel} />))
    } else if (ev.type === 'run_start') {
      // Look ahead to the next run_end to get inputTokens for this prompt
      const nextRunEnd = events.slice(i + 1).find(e => e.type === 'run_end') as Extract<AgentEvent, { type: 'run_end' }> | undefined
      rendered.push(wrap(<EventRow ev={ev} activeModel={activeModel} inputTokens={nextRunEnd?.inputTokens} />))
    } else if (ev.type === 'permission') {
      rendered.push(
        <div key={ev.requestId} style={{ paddingLeft: 36 }}>
          <PermissionDialog req={ev} cwd={cwd} agentName={activeModel} />
        </div>
      )
    } else {
      rendered.push(wrap(<EventRow ev={ev} activeModel={activeModel} />))
    }
    i++
  }
  return <>{rendered}</>
}

function CollapsibleError({ message }: { message: string }) {
  const [open, setOpen] = useState(false)
  const short = message.length > 80 ? message.slice(0, 80) + '…' : message
  return (
    <div style={{ marginBottom: 8, padding: '7px 12px', background: 'rgba(239,122,122,0.07)', border: '1px solid rgba(239,122,122,0.25)', borderRadius: 6 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0, width: '100%', textAlign: 'left' }}
      >
        <span style={{ color: '#ef7a7a', fontSize: 12, flexShrink: 0 }}>⚠</span>
        <span style={{ color: '#ef7a7a', fontSize: 12, flex: 1 }}>{open ? 'Fehler' : short}</span>
        {open
          ? <IChevUp  style={{ width: 13, height: 13, color: '#ef7a7a', flexShrink: 0 }} />
          : <IChevDown style={{ width: 13, height: 13, color: '#ef7a7a', flexShrink: 0 }} />
        }
      </button>
      {open && (
        <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid rgba(239,122,122,0.2)', color: '#ef7a7a', ...MONO, fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          {message}
        </div>
      )}
    </div>
  )
}

function MsgFooterCopy({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1400) }).catch(() => {})
  }
  return (
    <button onClick={copy} title="Kopieren" style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? 'var(--ok)' : 'var(--fg-3)', padding: '0 2px', display: 'flex', alignItems: 'center' }}>
      <ICopy style={{ width: 10, height: 10 }} />
    </button>
  )
}

function MsgFooterFav({ id }: { id: string }) {
  const key = `fav-agent-${id}`
  const [faved, setFaved] = useState(() => localStorage.getItem(key) === '1')
  const toggle = () => {
    const next = !faved
    setFaved(next)
    if (next) localStorage.setItem(key, '1')
    else localStorage.removeItem(key)
  }
  return (
    <button onClick={toggle} title={faved ? 'Aus Favoriten entfernen' : 'Favorisieren'}
      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', display: 'flex', alignItems: 'center', color: faved ? '#a78bfa' : 'var(--fg-3)' }}>
      <IBookmark style={{ width: 10, height: 10 }} />
    </button>
  )
}

// ── Footer for historical (DB-loaded) messages ───────────────────────────────
function OldMsgIdBadge({ id }: { id: string }) {
  const [copied, setCopied] = useState(false)
  const ref = `#amsg:${id}`
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    navigator.clipboard.writeText(ref).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1200) }).catch(() => {})
  }
  return (
    <span
      onClick={handleClick}
      title={copied ? 'Kopiert!' : `Kopieren: ${ref}`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 3,
        padding: '2px 6px', borderRadius: 5,
        background: 'var(--bg-2)', border: '1px solid var(--line)',
        fontSize: 9.5, fontFamily: '"JetBrains Mono","Cascadia Code",Menlo,monospace',
        color: copied ? 'var(--ok)' : 'var(--fg-3)',
        cursor: 'pointer', userSelect: 'none', opacity: 0.85,
        transition: 'color 0.15s',
      }}
    >
      <ICopy style={{ width: 9, height: 9 }} />
      <span style={{ opacity: 0.5 }}>#</span>
      <span style={{ color: 'var(--accent)', opacity: 0.85 }}>amsg:</span>
      <span>{id.slice(-5)}</span>
    </span>
  )
}

function OldMsgFooter({ m }: { m: { id?: string; role: string; content: string; ts: number; model?: string; tokens?: number } }) {
  const isUser = m.role === 'user'
  if (isUser) {
    // User bubble: single right-aligned row, matching the bubble above
    return (
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end', fontSize: 10, color: 'var(--fg-3)', marginTop: 12 }}>
        {m.id && <OldMsgIdBadge id={m.id} />}
        {m.id && <span style={{ opacity: 0.3 }}>·</span>}
        <span style={{ opacity: 0.6 }}>{formatTs(m.ts)}</span>
        <MsgFooterCopy text={m.content} />
        {m.id && <MsgFooterFav id={m.id} />}
      </div>
    )
  }
  // Assistant: left meta · right timestamp+actions
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      fontSize: 10, color: 'var(--fg-3)',
      marginTop: 12, width: '100%',
    }}>
      <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
        {m.model && <span style={{ fontWeight: 600 }}>{m.model}</span>}
        {m.tokens ? <><span style={{ opacity: 0.35 }}>·</span><span>{m.tokens.toLocaleString('de-DE')} tk</span></> : null}
        {m.id && <><span style={{ opacity: 0.35 }}>·</span><OldMsgIdBadge id={m.id} /></>}
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{ opacity: 0.6 }}>{formatTs(m.ts)}</span>
        <MsgFooterCopy text={m.content} />
        {m.id && <MsgFooterFav id={m.id} />}
      </div>
    </div>
  )
}

// ── History slim cards (permission + error) ───────────────────────────────────

function HistoryPermissionCard({ data, ts }: { data: Record<string, unknown>; ts: number }) {
  const toolName = String(data.toolName ?? '')
  const allow    = Boolean(data.allow)
  const scope    = String(data.scope ?? 'once')
  const input    = data.input as Record<string, unknown> ?? {}

  const detail = (() => {
    const t = toolName.toLowerCase()
    if (t === 'bash')   return String(input.command ?? input.cmd ?? '')
    if (t === 'read' || t === 'write' || t === 'edit' || t === 'multiedit') return String(input.file_path ?? input.path ?? '')
    if (t === 'webfetch') return String(input.url ?? '')
    if (t === 'websearch') return String(input.query ?? '')
    const fp = input.file_path ?? input.path ?? input.url ?? input.query ?? input.command ?? input.cmd
    if (fp) return String(fp)
    return ''
  })()

  const scopeLabel = scope === 'always' ? 'Immer erlaubt' : scope === 'session' ? 'Session erlaubt' : 'Einmal erlaubt'
  const statusColor  = allow ? '#22c55e' : '#ef4444'
  const statusBg     = allow ? 'rgba(34,197,94,0.10)' : 'rgba(239,68,68,0.10)'
  const statusBorder = allow ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 7,
      padding: '7px 14px', borderRadius: 6, marginBottom: 8,
      background: 'var(--bg-2)', border: '1px solid var(--line)',
      boxShadow: '0 2px 6px rgba(0,0,0,0.18)', opacity: 0.75,
      overflow: 'hidden', width: '100%',
    }}>
      {/* Tool badge */}
      <span style={{
        fontSize: 10.5, fontFamily: 'var(--font-mono)',
        background: 'var(--accent-soft)', borderRadius: 3,
        padding: '1px 5px', color: 'var(--accent)', fontWeight: 600,
        whiteSpace: 'nowrap', flexShrink: 0,
      }}>
        {toolName}
      </span>

      {/* Content preview */}
      <span style={{
        flex: 1, fontSize: 10.5, color: 'var(--fg-3)',
        fontFamily: 'var(--font-mono)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        opacity: 0.6,
      }}>
        {detail.length > 120 ? detail.slice(0, 120) + '…' : detail}
      </span>

      {/* Timestamp */}
      <span style={{ fontSize: 9.5, color: 'var(--fg-3)', flexShrink: 0, opacity: 0.5 }}>{formatTs(ts)}</span>

      {/* Status badge */}
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '2px 8px', borderRadius: 5,
        fontSize: 10, fontWeight: 700, fontFamily: 'inherit',
        color: statusColor, background: statusBg,
        border: `1px solid ${statusBorder}`,
        flexShrink: 0, whiteSpace: 'nowrap',
      }}>
        {allow ? '✓' : '✗'} {scopeLabel}
      </span>
    </div>
  )
}

function HistoryErrorCard({ data, ts }: { data: Record<string, unknown>; ts: number }) {
  const message = String(data.message ?? '')
  const [open, setOpen] = useState(false)
  const short = message.length > 80 ? message.slice(0, 80) + '…' : message
  return (
    <div style={{ marginBottom: 8, padding: '7px 12px', background: 'rgba(239,122,122,0.07)', border: '1px solid rgba(239,122,122,0.25)', borderRadius: 6 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0, width: '100%', textAlign: 'left' }}
      >
        <span style={{ color: '#ef7a7a', fontSize: 12, flexShrink: 0 }}>⚠</span>
        <span style={{ color: '#ef7a7a', fontSize: 12, flex: 1 }}>{open ? 'Fehler' : short}</span>
        <span style={{ color: 'var(--fg-3)', fontSize: 9.5, marginRight: 4 }}>{formatTs(ts)}</span>
        {open
          ? <IChevUp  style={{ width: 13, height: 13, color: '#ef7a7a', flexShrink: 0 }} />
          : <IChevDown style={{ width: 13, height: 13, color: '#ef7a7a', flexShrink: 0 }} />
        }
      </button>
      {open && (
        <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid rgba(239,122,122,0.2)', color: '#ef7a7a', ...MONO, fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          {message}
        </div>
      )}
    </div>
  )
}

// ── Inline image rendering for user bubbles ───────────────────────────────────
const IMAGE_FLAG_RE = /--image\s+"([^"]+)"|--image\s+'([^']+)'/g

// Matches [Filename]: /api/... or [Filename]: https://...
const FILE_REF_RE = /\[([^\]]+)\]:\s*((?:https?:\/\/|\/api\/)\S+)/g

type BubblePart =
  | { kind: 'text'; value: string }
  | { kind: 'image'; path: string }
  | { kind: 'fileref'; name: string; url: string }

function parseBubble(text: string): BubblePart[] {
  const parts: BubblePart[] = []
  // Build a combined regex — file refs first, then image flags
  const combined: Array<{ index: number; len: number; part: BubblePart }> = []
  for (const m of text.matchAll(IMAGE_FLAG_RE)) {
    combined.push({ index: m.index!, len: m[0].length, part: { kind: 'image', path: m[1] ?? m[2] } })
  }
  for (const m of text.matchAll(FILE_REF_RE)) {
    combined.push({ index: m.index!, len: m[0].length, part: { kind: 'fileref', name: m[1], url: m[2] } })
  }
  combined.sort((a, b) => a.index - b.index)
  let last = 0
  for (const { index, len, part } of combined) {
    if (index > last) parts.push({ kind: 'text', value: text.slice(last, index) })
    parts.push(part)
    last = index + len
  }
  if (last < text.length) parts.push({ kind: 'text', value: text.slice(last) })
  return parts
}

function ImageLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  return ReactDOM.createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100000,
        background: 'rgba(0,0,0,0.88)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'zoom-out',
      }}
    >
      <img
        src={src}
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8, boxShadow: '0 8px 40px rgba(0,0,0,0.6)', cursor: 'default' }}
      />
    </div>,
    document.body
  )
}

function BubbleContent({ text }: { text: string }) {
  const [lightbox, setLightbox] = useState<string | null>(null)
  const parts = parseBubble(text)

  return (
    <>
      {parts.map((p, i) => {
        if (p.kind === 'text') {
          const trimmed = p.value.trim()
          return trimmed ? (
            <span key={i} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{trimmed}</span>
          ) : null
        }
        if (p.kind === 'fileref') {
          const ext = p.name.includes('.') ? p.name.split('.').pop()?.toUpperCase() ?? 'FILE' : 'FILE'
          return (
            <a
              key={i}
              href={p.url}
              download={p.name}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6,
                padding: '4px 9px 4px 6px',
                background: 'var(--bg-0)', borderRadius: 6,
                fontSize: 11, fontFamily: 'var(--font-mono)',
                color: 'var(--fg-1)',
                textDecoration: 'none', cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 3, background: 'var(--accent-soft)', color: 'var(--accent)', letterSpacing: 0.4 }}>{ext}</span>
              {p.name}
            </a>
          )
        }
        const url = `/api/serve-image?path=${encodeURIComponent(p.path)}`
        return (
          <img
            key={i}
            src={url}
            onClick={() => setLightbox(url)}
            style={{
              display: 'block',
              maxWidth: 160, maxHeight: 120,
              borderRadius: 5,
              marginTop: 5,
              cursor: 'zoom-in',
              objectFit: 'cover',
            }}
            title={p.path}
          />
        )
      })}
      {lightbox && <ImageLightbox src={lightbox} onClose={() => setLightbox(null)} />}
    </>
  )
}

function EventRow({ ev, activeModel, inputTokens }: { ev: AgentEvent; activeModel: string; inputTokens?: number }) {
  switch (ev.type) {
    case 'run_start':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginBottom: 16, marginTop: 8 }}>
          <div style={{
            maxWidth: '72%',
            background: 'var(--accent)',
            color: 'var(--accent-fg)',
            borderRadius: '18px 18px 4px 18px',
            padding: '10px 14px',
            fontSize: 13,
            fontWeight: 500,
            lineHeight: 1.65,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontFamily: 'var(--font-ui)',
          }}>
            <BubbleContent text={ev.prompt} />
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 6, alignItems: 'center', fontSize: 10, color: 'var(--fg-3)' }}>
            {inputTokens ? <span>{inputTokens.toLocaleString('de-DE')} tk</span> : null}
            {inputTokens ? <span style={{ opacity: 0.3 }}>·</span> : null}
            <span style={{ opacity: 0.6 }}>{formatTs(ev.ts)}</span>
            <MsgFooterCopy text={ev.prompt} />
          </div>
        </div>
      )
    case 'session_info':
      return null
    case 'session_start':
      return (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20, marginTop: 4, fontFamily: 'var(--font-mono)', fontSize: 10 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            width: '90%', padding: '5px 12px', borderRadius: 20,
            background: 'var(--bg-2)', border: '1px solid var(--line)',
            color: 'var(--fg-3)',
          }}>
            {/* Green traffic-light dot */}
            <div style={{
              width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
              background: '#22c55e',
              boxShadow: '0 0 5px rgba(34,197,94,0.55)',
            }} />
            <span>Session Start</span>
            {ev.model && (
              <>
                <span style={{ opacity: 0.25 }}>·</span>
                <span style={{ color: 'var(--fg-0)', fontWeight: 600 }}>{ev.model}</span>
              </>
            )}
            <span style={{ opacity: 0.25 }}>·</span>
            <span>{formatTs(ev.ts)}</span>
            {(ev.contextMsgCount ?? 0) > 0 && (
              <>
                <span style={{ opacity: 0.25 }}>·</span>
                <span style={{ opacity: 0.65 }}>Kontext {ev.contextMsgCount} Msg.</span>
              </>
            )}
          </div>
        </div>
      )
    case 'thinking':
      return <ThinkingCard ev={ev} />
    case 'agent_start':
      return <AgentStartCard ev={ev} delegatedRole={undefined} />
    case 'text':
      return (
        <div>
          <TextBlock text={ev.text} style={{ color: 'var(--fg-0)', fontSize: 13, lineHeight: 1.65 }} />
        </div>
      )
    case 'agent_done':
      return (
        <div style={{ color: 'var(--fg-2)', fontSize: 13, marginBottom: 8 }}>
          {ev.name} · fertig{ev.output ? `: ${ev.output}` : ''}
        </div>
      )
    case 'result': {
      const resultId = `res-${ev.ts}`
      return (
        <div style={{ marginTop: 12, marginBottom: 8 }}>
          <SmartOutput text={ev.text} style={{ color: 'var(--fg-0)', fontSize: 13, lineHeight: 1.75 }} />
          <div style={{ marginTop: 12, paddingLeft: 36, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, color: 'var(--fg-3)' }}>
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              {activeModel && <span style={{ fontWeight: 600 }}>{activeModel}</span>}
              {ev.tokens ? <><span style={{ opacity: 0.35 }}>·</span><span>{ev.tokens.toLocaleString('de-DE')} tk</span></> : null}
              {ev.cost ? <><span style={{ opacity: 0.35 }}>·</span><span>${ev.cost.toFixed(4)}</span></> : null}
              {ev._msgId ? <><span style={{ opacity: 0.35 }}>·</span><OldMsgIdBadge id={ev._msgId} /></> : null}
            </div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <span>{formatTs(ev.ts)}</span>
              <MsgFooterFav id={resultId} />
              <MsgFooterCopy text={ev.text} />
            </div>
          </div>
        </div>
      )
    }
    case 'error':
      if (ev.message === '__cancelled__') {
        return (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 8, padding: '4px 10px', background: 'var(--bg-2)', border: '1px solid var(--line-strong)', borderRadius: 99, color: 'var(--fg-3)', fontSize: 11, ...MONO }}>
            <span style={{ fontSize: 10 }}>◼</span>
            <span>Anfrage manuell abgebrochen</span>
          </div>
        )
      }
      return <CollapsibleError message={ev.message} />
    case 'run_end':
      return (
        <div style={{ marginTop: 10, marginBottom: 14, paddingLeft: 36, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, color: 'var(--fg-3)' }}>
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            {activeModel && <span style={{ fontWeight: 600 }}>{activeModel}</span>}
            {ev.tokens ? <><span style={{ opacity: 0.35 }}>·</span><span>{ev.tokens.toLocaleString('de-DE')} tk</span></> : null}
            {ev.cost ? <><span style={{ opacity: 0.35 }}>·</span><span>${ev.cost.toFixed(4)}</span></> : null}
            {ev._msgId ? <><span style={{ opacity: 0.35 }}>·</span><OldMsgIdBadge id={ev._msgId} /></> : null}
          </div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <span>{formatTs(ev.ts)}</span>
            <MsgFooterFav id={`run-${ev.ts}`} />
            {ev._textContent ? <MsgFooterCopy text={ev._textContent} /> : null}
          </div>
        </div>
      )
    case 'greeting':
      return null
    case 'rate_limit':
      return ev.utilization >= 0.9 ? (
        <div style={{ marginBottom: 6, padding: '6px 10px', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: 6, color: '#eab308', ...MONO, fontSize: 11 }}>
          Rate Limit {Math.round(ev.utilization * 100)}%
        </div>
      ) : null
    case 'permission':
      return null // rendered by EventList via PermissionDialog
    default:
      return null
  }
}

// ── Main component ────────────────────────────────────────────────────────────
interface Props {
  sessionId: string
  kind: SessionKind
  cmd: string
  args: string
  cwd: string
  orModel?: string
  providerSettingsJson?: string
  providerAlias?: string
  containerWidth?: number
}

export function AgentView({ sessionId, kind, cmd, args, cwd, orModel, providerSettingsJson, providerAlias, containerWidth = 9999 }: Props) {
  const [events, setEvents]       = useState<AgentEvent[]>([])
  const [connected, setConnected] = useState(false)
  const [running, setRunning]     = useState(false)
  const [runStartTs, setRunStartTs] = useState<number | null>(null)
  const [elapsed, setElapsed]       = useState(0)
  const [rateToast, setRateToast]         = useState<number | null>(null)
  const [activeModel, setActiveModel] = useState<string>(() => {
    if (providerSettingsJson) {
      try {
        const ps = JSON.parse(providerSettingsJson) as { env?: Record<string, string> }
        return ps.env?.ANTHROPIC_MODEL ?? ''
      } catch { return '' }
    }
    return orModel ?? ''
  })
  const { openrouterKey, projects, supabaseUrl, supabaseAnonKey, currentUser, agentContextMsgCount, agentCompressPrompt } = useAppStore()
  const projectId = projects.find(p => p.sessions.some(s => s.id === sessionId))?.id ?? 'unknown'
  // ── older messages (scroll-up pagination) ────────────────────────────────
  const [olderMessages, setOlderMessages] = useState<DbAgentMessage[]>([])
  const [loadingOlder, setLoadingOlder]   = useState(false)
  const loadingOlderRef                   = useRef(false)   // sync guard — prevents race condition
  const [olderOffset, setOlderOffset]     = useState(0)
  const olderOffsetRef                    = useRef(0)       // sync mirror of olderOffset
  const [hasMoreOlder, setHasMoreOlder]   = useState(false)
  const hasMoreOlderRef                   = useRef(false)   // sync mirror — used by scroll listener
  // Context summary — loaded silently, injected into first message of session
  const [contextSummary, setContextSummary] = useState<string | null>(null)
  const contextInjectedRef = useRef(false)
  // Sync mirror so WS onopen can read the count without stale-closure issues
  const olderMsgCountRef = useRef(0)
  useEffect(() => { olderMsgCountRef.current = olderMessages.length }, [olderMessages.length])
  const prevScrollHeightRef = useRef(0)
  const seenPermissionsRef  = useRef(new Set<string>())   // dedup permission requestIds
  const PAGE = 20

  const loadMoreOlder = useCallback(async () => {
    if (loadingOlderRef.current) return
    if (!currentUser?.id || !projectId || projectId === 'unknown') return
    const sb = getSupabase(supabaseUrl, supabaseAnonKey)
    if (!sb) return
    loadingOlderRef.current = true
    setLoadingOlder(true)
    prevScrollHeightRef.current = scrollRef.current?.scrollHeight ?? 0
    try {
      const msgs = await loadLastProjectMessages(sb, currentUser.id, projectId, PAGE, olderOffsetRef.current)
      if (msgs.length === 0) {
        hasMoreOlderRef.current = false
        setHasMoreOlder(false)
      } else {
        // msgs come back newest-first → reverse to oldest-first, then prepend
        // deduplicate by id to guard against any remaining double-fires
        setOlderMessages(prev => {
          const seen = new Set(prev.map(m => m.id))
          const fresh = msgs.slice().reverse().filter(m => !seen.has(m.id))
          return [...fresh, ...prev]
        })
        olderOffsetRef.current += msgs.length
        setOlderOffset(olderOffsetRef.current)
        hasMoreOlderRef.current = msgs.length === PAGE
        setHasMoreOlder(msgs.length === PAGE)
      }
    } finally {
      loadingOlderRef.current = false
      setLoadingOlder(false)
    }
  }, [currentUser?.id, projectId, supabaseUrl, supabaseAnonKey])

  // Initial load — 20 most recent messages + context summary for this project
  useEffect(() => {
    setOlderMessages([])
    setOlderOffset(0)
    olderOffsetRef.current = 0
    loadingOlderRef.current = false
    hasMoreOlderRef.current = false
    setHasMoreOlder(false)
    setContextSummary(null)
    contextInjectedRef.current = false
    if (!currentUser?.id || !projectId || projectId === 'unknown') return
    const sb = getSupabase(supabaseUrl, supabaseAnonKey)
    if (!sb) return
    Promise.all([
      loadLastProjectMessages(sb, currentUser.id, projectId, PAGE, 0),
      loadLatestContextSummary(sb, currentUser.id, projectId),
    ]).then(([msgs, ctx]) => {
      setOlderMessages(msgs.slice().reverse())
      olderOffsetRef.current = msgs.length
      setOlderOffset(msgs.length)
      hasMoreOlderRef.current = msgs.length === PAGE
      setHasMoreOlder(msgs.length === PAGE)
      if (ctx?.summary) setContextSummary(ctx.summary)
    }).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, projectId, currentUser?.id, supabaseUrl, supabaseAnonKey])

  // Restore scroll position after prepend so the view doesn't jump to top
  useEffect(() => {
    const el = scrollRef.current
    if (!el || prevScrollHeightRef.current === 0) return
    el.scrollTop += el.scrollHeight - prevScrollHeightRef.current
    prevScrollHeightRef.current = 0
  }, [olderMessages])

  const saveSessionMsg = (msg: object) => {
    if (kind === 'orbit') return
    fetch('/api/session/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, sessionId, message: msg }),
    }).catch(() => {})
  }
  const rateToastTimer              = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wsRef        = useRef<WebSocket | null>(null)
  const pendingMsg   = useRef<string | null>(null)   // queued while WS is CONNECTING
  const lineBuffer   = useRef('')
  const greeted      = useRef(false)
  const runIdRef     = useRef<string>('')          // shared by user msg + assistant result
  const scrollRef       = useRef<HTMLDivElement>(null)
  const sessionStartRef    = useRef<HTMLDivElement>(null)
  const sessionScrolledRef = useRef(false)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const chatWidth = containerWidth

  // ── Reset all per-session flags whenever the session changes ─────────────────
  useEffect(() => {
    sessionScrolledRef.current = false
    greeted.current            = false   // allow session_start to fire on next WS connect
    setEvents([])                        // clear stale events from previous session
    setConnected(false)
    setRunning(false)
  }, [sessionId])

  // ── On first events: scroll so session_start marker is at top ────────────────
  useEffect(() => {
    if (sessionScrolledRef.current) return
    if (events.length === 0) return
    const marker = sessionStartRef.current
    const scroller = scrollRef.current
    if (!marker || !scroller) return
    requestAnimationFrame(() => {
      const markerRect   = marker.getBoundingClientRect()
      const scrollerRect = scroller.getBoundingClientRect()
      const relativeTop  = markerRect.top - scrollerRect.top + scroller.scrollTop
      scroller.scrollTop = Math.max(0, relativeTop)
      sessionScrolledRef.current = true
    })
  }, [events.length]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!running || runStartTs === null) { setElapsed(0); return }
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - runStartTs) / 1000)), 500)
    return () => clearInterval(id)
  }, [running, runStartTs])

  const showRateToast = useCallback((util: number) => {
    setRateToast(util)
    if (rateToastTimer.current) clearTimeout(rateToastTimer.current)
    rateToastTimer.current = setTimeout(() => setRateToast(null), 6000)
  }, [])

  const triggerContextCompression = useCallback(async () => {
    if (!currentUser?.id || !projectId || projectId === 'unknown') return
    const sb = getSupabase(supabaseUrl, supabaseAnonKey)
    if (!sb) return
    // Get the Anthropic API key from providers
    const state = useAppStore.getState()
    const apiKey = state.claudeProviders.find(p => p.authToken)?.authToken ?? ''
    if (!apiKey) return

    const msgs = await loadLastProjectMessages(sb, currentUser.id, projectId, agentContextMsgCount)
    if (msgs.length < 3) return

    const summary = await compressAgentHistory(msgs, agentCompressPrompt, apiKey).catch(() => '')
    if (!summary) return

    await saveContextSummary(sb, currentUser.id, projectId, summary, msgs.length, msgs[0]?.ts ?? Date.now()).catch(() => {})
    setContextSummary(summary)
  }, [currentUser?.id, projectId, supabaseUrl, supabaseAnonKey, agentContextMsgCount, agentCompressPrompt])

  const addEvents = useCallback((evs: AgentEvent[]) => {
    // Intercept rate_limit events → toast instead of stream entry
    const streamEvs = evs.filter(ev => {
      if (ev.type === 'rate_limit') { showRateToast(ev.utilization); return false }
      return true
    })
    if (!streamEvs.length) return
    // Attach message IDs to result events before pushing so the UI can display them
    for (const ev of streamEvs) {
      if (ev.type === 'result' && kind === 'openrouter-claude') {
        (ev as Extract<AgentEvent, { type: 'result' }>)._msgId = msgId(sessionId, runIdRef.current, 'assistant')
      }
    }
    setEvents(prev => [...prev, ...streamEvs])
    for (const ev of streamEvs) {
      if (ev.type === 'run_start') { setRunning(true); setRunStartTs(Date.now()) }
      if (ev.type === 'run_end' || ev.type === 'result' || ev.type === 'error') {
        setRunning(false); setRunStartTs(null)
        // Persist errors to DB for history
        if (ev.type === 'error' && currentUser?.id && projectId && projectId !== 'unknown') {
          const sb = getSupabase(supabaseUrl, supabaseAnonKey)
          if (sb) {
            saveAgentMessage(sb, {
              id: newAgentMsgId(sessionId),
              session_id: sessionId,
              project_id: projectId,
              user_id: currentUser.id,
              role: 'assistant',
              content: JSON.stringify({ __type: 'error', message: ev.message }),
              ts: ev.ts,
            }).catch(() => {})
          }
        }
      }
      if (ev.type === 'session_info' && ev.model) setActiveModel(ev.model)
      if (ev.type === 'result' && kind === 'openrouter-claude') {
        saveSessionMsg({ id: msgId(sessionId, runIdRef.current, 'assistant'), runId: runIdRef.current, role: 'assistant', content: ev.text, ts: ev.ts, kind, model: activeModel || undefined, tokens: ev.tokens })
      }
      // Erkennt [POPUP_REQUIRED] / [ACTION_REQUIRED] etc. in Claudes Textausgabe
      if (ev.type === 'text') firePopupFromText(ev.text, sessionId)
      // Supabase persistence for agent messages
      if (ev.type === 'run_start' && currentUser?.id && projectId !== 'unknown') {
        const sb = getSupabase(supabaseUrl, supabaseAnonKey)
        if (sb) {
          const msgId_ = newAgentMsgId(sessionId)
          saveAgentMessage(sb, {
            id: msgId_,
            session_id: sessionId,
            project_id: projectId,
            user_id: currentUser.id,
            role: 'user',
            content: ev.prompt,
            ts: ev.ts,
          }).catch(() => {})
        }
      }
      if (ev.type === 'run_end' && currentUser?.id && projectId !== 'unknown') {
        // Generate the ID once outside the state updater. React Strict Mode
        // double-invokes state updaters in dev; using the same ID means both
        // calls upsert the same row rather than creating two duplicates.
        const assistantMsgId = newAgentMsgId(sessionId)
        const runEndEv = ev
        setEvents(prev => {
          const lastRunStart = [...prev].reverse().findIndex(e => e.type === 'run_start')
          if (lastRunStart < 0) return prev
          const runStartIdx = prev.length - 1 - lastRunStart
          const textContent = prev
            .slice(runStartIdx + 1)
            .filter(e => e.type === 'text')
            .map(e => (e as Extract<AgentEvent, { type: 'text' }>).text)
            .join('')
          if (textContent) {
            const sb = getSupabase(supabaseUrl, supabaseAnonKey)
            if (sb) {
              saveAgentMessage(sb, {
                id:         assistantMsgId,
                session_id: sessionId,
                project_id: projectId,
                user_id:    currentUser.id,
                role:       'assistant',
                content:    textContent,
                model:      activeModel || undefined,
                tokens:     runEndEv.tokens,
                ts:         runEndEv.ts,
              }).catch(() => {})
            }
          }
          // Attach the saved message ID to the run_end event so the UI can display it
          return prev.map(e => e === runEndEv ? { ...e, _msgId: assistantMsgId } : e)
        })
        // Trigger compression if we've accumulated enough messages
        triggerContextCompression().catch(() => {})
      }
    }
  }, [showRateToast, currentUser?.id, projectId, supabaseUrl, supabaseAnonKey, activeModel, sessionId, triggerContextCompression])

  const dispatch = useCallback((ev: AgentEvent) => {
    window.dispatchEvent(new CustomEvent('cc:agent-event', { detail: { sessionId, event: ev } }))
  }, [sessionId])

  const handleData = useCallback((data: string) => {
    const lines = (lineBuffer.current + data).split('\n')
    lineBuffer.current = lines.pop() ?? ''
    const evs: AgentEvent[] = []
    for (const line of lines) {
      // Strip ANSI/terminal control codes before parsing — raw PTY output can
      // prefix JSON claude events with escape sequences
      const clean = line.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').replace(/\r/g, '').trimEnd()
      const parsed = parseClaudeLine(clean)
      if (!parsed) continue
      const arr = Array.isArray(parsed) ? parsed : [parsed]
      for (const ev of arr) {
        evs.push(ev); dispatch(ev)
      }
    }
    addEvents(evs)
  }, [kind, addEvents, dispatch])

  useEffect(() => {
    const host = window.location.host
    const wsPath = `ws://${host}/ws/agent?sessionId=${encodeURIComponent(sessionId)}`
    let alive = true
    let retryMs = 1000

    const connect = () => {
      if (!alive) return
      const ws = new WebSocket(wsPath)
      wsRef.current = ws

      ws.onopen = () => {
        // React Strict Mode runs cleanup then re-mounts; if alive is false this
        // is the stale first-mount socket — close it silently and bail.
        if (!alive) { ws.close(); return }
        seenPermissionsRef.current.clear()
        retryMs = 1000
        setConnected(true)
        // Session-start separator — fires immediately on connect
        if (!greeted.current) {
          greeted.current = true
          addEvents([{ type: 'session_start', model: activeModel, ts: Date.now(), contextMsgCount: olderMsgCountRef.current }])
        }
        // Flush any message that was queued while WS was still connecting
        if (pendingMsg.current !== null) {
          ws.send(pendingMsg.current)
          pendingMsg.current = null
        }
      }

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data) as Record<string, unknown>
          if (msg.type === 'data') handleData(String(msg.data))
          if (msg.type === 'agent_error') {
            const ev: AgentEvent = { type: 'error', message: String(msg.message ?? 'Unbekannter Fehler'), ts: Date.now() }
            addEvents([ev]); dispatch(ev)
          }
          if (msg.type === 'permission_request') {
            // MCP bridge format:  { requestId, toolName, input }
            // PTY regex fallback: { tool: { tool, input } }
            const reqId = String(msg.requestId ?? `perm-${Date.now()}`)
            // Skip duplicate permission requests (server sometimes fires twice)
            if (seenPermissionsRef.current.has(reqId)) return
            seenPermissionsRef.current.add(reqId)
            let rawToolName = String(
              msg.toolName ??
              (msg.tool as Record<string, unknown> | null)?.tool ??
              'Unknown'
            )
            let rawInput: Record<string, unknown> = (
              (msg.input as Record<string, unknown> | null) ??
              ((msg.tool as Record<string, unknown> | null)?.input as Record<string, unknown>) ??
              {}
            )
            // Unwrap mcp__perm__permission_prompt wrapper if server didn't already
            if (rawToolName === 'mcp__perm__permission_prompt' && rawInput.tool_name) {
              rawToolName = String(rawInput.tool_name)
              rawInput    = (rawInput.tool_input as Record<string, unknown>) ?? {}
            }
            const ev: AgentEvent = {
              type: 'permission',
              requestId: reqId,
              toolName:  rawToolName,
              input:     rawInput,
              toolUseId: String(msg.toolUseId ?? ''),
              fallbackText: msg.text ? String(msg.text) : undefined,
              ts: Date.now(),
            }
            addEvents([ev])
            setRunning(false)
            // 🔔 Permission alert: chime + sidebar bell
            try {
              const ctx = new AudioContext()
              const osc = ctx.createOscillator()
              const gain = ctx.createGain()
              osc.connect(gain); gain.connect(ctx.destination)
              osc.type = 'sine'
              osc.frequency.setValueAtTime(880, ctx.currentTime)
              osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.18)
              gain.gain.setValueAtTime(0.18, ctx.currentTime)
              gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5)
              osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.5)
              osc.onended = () => ctx.close()
            } catch {}
            window.dispatchEvent(new CustomEvent('cc:permission-pending', { detail: { sessionId, pending: true } }))
            // Scroll to bottom so the permission dialog is visible (instant, not smooth)
            setTimeout(() => {
              const el = scrollRef.current
              if (el) el.scrollTop = el.scrollHeight
            }, 80)
            const clearBell = () => {
              window.dispatchEvent(new CustomEvent('cc:permission-pending', { detail: { sessionId, pending: false } }))
            }
            window.addEventListener('cc:permission-decision', clearBell, { once: true })
            setTimeout(clearBell, 30000)
          }
          if (msg.type === 'exit') {
            setRunning(false)
            const code = Number(msg.exitCode)
            if (code !== 0) {
              // Exit -1 = ESC/cancel, 129/130 = signal (SIGHUP/SIGINT) → show "Abgebrochen"
              const cancelled = code === -1 || code === 129 || code === 130
              const ev: AgentEvent = cancelled
                ? { type: 'run_end', tokens: undefined, cost: undefined, ts: Date.now() }
                : { type: 'error', message: `Codey beendet (Exit ${code})`, ts: Date.now() }
              if (cancelled) {
                addEvents([{ type: 'error', message: '__cancelled__', ts: Date.now() }])
              } else {
                addEvents([ev]); dispatch(ev)
              }
            }
          }
        } catch {}
      }

      ws.onclose = () => {
        // Only update state if this is still the active WS instance.
        // Strict Mode double-invoke creates a second socket while the first is
        // still connecting; when that stale socket closes, ignore it.
        if (wsRef.current !== ws && wsRef.current !== null) return
        if (wsRef.current === ws) wsRef.current = null
        setConnected(false)
        setRunning(false)
        if (alive) {
          setTimeout(connect, retryMs)
          retryMs = Math.min(retryMs * 2, 8000)
        }
      }
    }

    connect()
    return () => {
      alive = false
      const current = wsRef.current
      wsRef.current = null
      // Only close OPEN sockets. If still CONNECTING, the onopen guard above
      // will close it once it connects — calling close() on a CONNECTING socket
      // throws "closed before connection established" in the browser console.
      if (current && current.readyState === WebSocket.OPEN) current.close()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, kind])

  useEffect(() => {
    const onPaste = async (e: Event) => {
      const { sessionId: sid, data } = (e as CustomEvent<{ sessionId: string; data: string }>).detail
      if (sid !== sessionId) return
      const ws = wsRef.current
      // Show user's message immediately regardless of WS state
      const runEv: AgentEvent = { type: 'run_start', prompt: data, ts: Date.now() }
      addEvents([runEv]); dispatch(runEv)
      runIdRef.current = newRunId()
      saveSessionMsg({ id: msgId(sessionId, runIdRef.current, 'user'), runId: runIdRef.current, role: 'user', content: data, ts: runEv.ts, kind })

      // Pre-resolve #amsg:am-xxx agent message IDs — in-memory first, Supabase fallback
      const amsgMatches = [...data.matchAll(/#amsg:(am-[a-z0-9-]+)/gi)]
      let data2 = data
      if (amsgMatches.length > 0) {
        let appendix = ''
        const sb = getSupabase(supabaseUrl, supabaseAnonKey)
        for (const m of amsgMatches) {
          const id = m[1]
          const inMem = olderMessages.find(msg => msg.id === id)
          const found = inMem ?? (sb && currentUser?.id ? await loadAgentMessageById(sb, currentUser.id, id).catch(() => null) : null)
          if (found) {
            const label = found.role === 'user' ? 'Nutzer' : 'Assistent'
            appendix += `\n[Agent-Kontext ${label} ${m[0]}]: ${found.content.slice(0, 500)}`
          }
        }
        if (appendix) data2 = data + '\n\n---\nAgent-Kontext-Referenzen:' + appendix
      }

      // Resolve any #msg: / #chat: references in the text (orbit JSONL)
      let resolved = await resolveRefs(data2).catch(() => data2)

      // Inject context summary into the first message of this session
      if (contextSummary && !contextInjectedRef.current) {
        contextInjectedRef.current = true
        resolved = `[KONTEXT AUS VORHERIGER SESSION]:\n${contextSummary}\n\n[NEUE ANFRAGE]:\n${resolved}`
      }
      const payload = JSON.stringify({ type: 'message', text: resolved, cwd, ...(orModel ? { orModel, orKey: openrouterKey } : {}), ...(providerSettingsJson ? { providerSettingsJson } : {}), ...(providerAlias ? { providerAlias } : {}) })

      if (ws && ws.readyState === WebSocket.OPEN) {
        // Connected — send immediately
        setRunning(true)
        ws.send(payload)
      } else if (ws && ws.readyState === WebSocket.CONNECTING) {
        // Still connecting — queue and send as soon as it opens
        setRunning(true)
        pendingMsg.current = payload
      } else {
        // WS is closed/null — show error instead of infinite spinner
        const errEv: AgentEvent = { type: 'error', message: 'Nicht verbunden — bitte kurz warten und erneut senden.', ts: Date.now() }
        addEvents([errEv]); dispatch(errEv)
      }
    }
    const onRaw = (e: Event) => {
      const { sessionId: sid, data } = (e as CustomEvent<{ sessionId: string; data: string }>).detail
      if (sid !== sessionId) return
      wsRef.current?.send(JSON.stringify({ type: 'input', data }))
    }
    window.addEventListener('cc:terminal-paste', onPaste)
    window.addEventListener('cc:terminal-send-raw', onRaw)
    return () => {
      window.removeEventListener('cc:terminal-paste', onPaste)
      window.removeEventListener('cc:terminal-send-raw', onRaw)
    }
  }, [sessionId, kind, cwd, addEvents, dispatch])

  // Polling fallback: fetch pending permissions every 2s.
  // Catches any permissions the WS push may have missed (buffered, slow, disconnected).
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const r = await fetch(`/api/perm-pending?sessionId=${encodeURIComponent(sessionId)}`)
        const { perms } = await r.json() as { perms: Array<{ requestId: string; toolName: string; input: Record<string, unknown> }> }
        let hasNew = false
        for (const p of perms) {
          if (seenPermissionsRef.current.has(p.requestId)) continue
          seenPermissionsRef.current.add(p.requestId)
          hasNew = true
          let pToolName = p.toolName
          let pInput    = p.input
          if (pToolName === 'mcp__perm__permission_prompt' && pInput.tool_name) {
            pToolName = String(pInput.tool_name)
            pInput    = (pInput.tool_input as Record<string, unknown>) ?? {}
          }
          const ev: AgentEvent = {
            type: 'permission', requestId: p.requestId, toolName: pToolName,
            input: pInput, toolUseId: '', ts: Date.now(),
          }
          addEvents([ev])
          setRunning(false)
          try {
            const ctx = new AudioContext()
            const osc = ctx.createOscillator(); const gain = ctx.createGain()
            osc.connect(gain); gain.connect(ctx.destination)
            osc.type = 'sine'
            osc.frequency.setValueAtTime(880, ctx.currentTime)
            osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.18)
            gain.gain.setValueAtTime(0.18, ctx.currentTime)
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5)
            osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.5)
            osc.onended = () => ctx.close()
          } catch {}
          window.dispatchEvent(new CustomEvent('cc:permission-pending', { detail: { sessionId, pending: true } }))
        }
        // Keep the permission dialog in view every poll tick.
        // Use setTimeout so React has rendered the new events before we measure scrollHeight.
        if (perms.length > 0 || hasNew) {
          setTimeout(() => {
            const el = scrollRef.current
            if (el) el.scrollTop = el.scrollHeight
          }, 80)
        }
      } catch {}
    }, 2000)
    return () => clearInterval(interval)
  }, [sessionId, addEvents])

  // When the scroll container shrinks (input textarea grew), keep any open
  // permission dialog in view by scrolling back to bottom.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const hasPending = events.some(e => e.type === 'permission' && !e.resolved)
      if (hasPending) el.scrollTop = el.scrollHeight
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [events])

  // Clear session — wipe chat + tell server to forget Claude session ID
  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail !== sessionId) return
      setEvents([])
      setOlderMessages([])
      setOlderOffset(0)
      olderOffsetRef.current = 0
      setHasMoreOlder(false)
      hasMoreOlderRef.current = false
      const ws = wsRef.current
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'clear_session' }))
      }
    }
    window.addEventListener('cc:clear-agent-session', handler)
    return () => window.removeEventListener('cc:clear-agent-session', handler)
  }, [sessionId])

  // Auto-scroll to bottom when new events come in — only if already near bottom
  const isNearBottom = useCallback(() => {
    const el = scrollRef.current
    if (!el) return true
    return el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }, [])

  // Scroll to bottom whenever events change (auto-scroll only if already near bottom)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    // freshSessionStart: rAF in the session-scroll effect handles positioning — skip here
    if (events.length === 1 && events[0].type === 'session_start') return
    if (isNearBottom()) el.scrollTop = el.scrollHeight
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events])

  // Scroll to bottom on initial load (olderMessages first populate from DB)
  useEffect(() => {
    const el = scrollRef.current
    if (!el || olderMessages.length === 0) return
    // Only on first load (offset just set), not on pagination prepend
    if (olderOffsetRef.current === olderMessages.length) {
      el.scrollTop = el.scrollHeight
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [olderMessages.length === 0 ? 0 : 1])

  // Load older messages when user scrolls to top + show scroll-to-bottom button.
  // Uses refs for loadingOlder + hasMoreOlder to avoid stale-closure misses when
  // the listener would otherwise be re-registered mid-scroll.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => {
      if (el.scrollTop < 100 && !loadingOlderRef.current && hasMoreOlderRef.current) {
        void loadMoreOlder()
      }
      setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 120)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  // Re-register only when loadMoreOlder identity changes (i.e. user/project changed)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadMoreOlder])

  // ESC → Laufenden Run unterbrechen (Session bleibt offen)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !running) return
      e.preventDefault()
      const ws = wsRef.current
      if (!ws || ws.readyState !== WebSocket.OPEN) return
      ws.send(JSON.stringify({ type: 'cancel' }))
      setRunning(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [running, kind])

  // Permission dialog decisions → forward to server + mark resolved in events + persist to DB
  useEffect(() => {
    const onDecision = (e: Event) => {
      const d = (e as CustomEvent<PermissionDecision>).detail
      const ws = wsRef.current
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'permission_response', requestId: d.requestId, allow: d.allow }))
      }
      setEvents(prev => {
        const updated = prev.map(ev =>
          ev.type === 'permission' && ev.requestId === d.requestId
            ? { ...ev, resolved: { allow: d.allow, scope: d.scope } }
            : ev
        )
        // Persist permission decision to DB for history
        if (currentUser?.id && projectId && projectId !== 'unknown') {
          const permEv = prev.find(ev => ev.type === 'permission' && (ev as Extract<AgentEvent, { type: 'permission' }>).requestId === d.requestId) as Extract<AgentEvent, { type: 'permission' }> | undefined
          const sb = getSupabase(supabaseUrl, supabaseAnonKey)
          if (sb && permEv) {
            saveAgentMessage(sb, {
              id: newAgentMsgId(sessionId),
              session_id: sessionId,
              project_id: projectId,
              user_id: currentUser.id,
              role: 'user',
              content: JSON.stringify({ __type: 'permission', toolName: permEv.toolName, input: permEv.input, allow: d.allow, scope: d.scope }),
              ts: Date.now(),
            }).catch(() => {})
          }
        }
        return updated
      })
      if (d.allow) setRunning(true)
    }
    window.addEventListener('cc:permission-decision', onDecision)
    return () => window.removeEventListener('cc:permission-decision', onDecision)
  }, [currentUser?.id, projectId, supabaseUrl, supabaseAnonKey, sessionId])


  // Session ID copy badge (top-right inside chat)
  const [sidCopied, setSidCopied] = useState(false)
  const copySid = () => {
    navigator.clipboard.writeText(sessionId).then(() => { setSidCopied(true); setTimeout(() => setSidCopied(false), 1200) }).catch(() => {})
  }

  // freshSessionStart: events contains only the session_start marker (no real messages yet)
  const freshSessionStart = events.length === 1 && events[0].type === 'session_start'
  // onlySessionStart: fresh start with no older messages — spacer collapses, pill sits at top naturally
  const onlySessionStart = freshSessionStart && olderMessages.length === 0

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <style>{`
        @keyframes agent-fadein {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes thinking-shimmer {
          0%   { background-position: 220% center; }
          100% { background-position: -220% center; }
        }
        @keyframes thinking-pulse {
          0%, 100% { opacity: 0.35; transform: translateX(0px); }
          50%       { opacity: 1;    transform: translateX(2px); }
        }
        @keyframes scroll-bounce {
          0%, 100% { transform: translateY(0px); opacity: 0.8; }
          50%       { transform: translateY(6px); opacity: 1; }
        }
      `}</style>
      {/* Session ID copy badge — top-right corner */}
      <div
        onClick={copySid}
        title={sidCopied ? 'Kopiert!' : `Session-ID kopieren: ${sessionId}`}
        style={{
          position: 'absolute', top: 10, right: 14, zIndex: 20,
          display: 'flex', alignItems: 'center', gap: 3,
          padding: '3px 7px', borderRadius: 5,
          background: 'var(--bg-2)', border: '1px solid var(--line)',
          fontSize: 9.5, fontFamily: '"JetBrains Mono","Cascadia Code",Menlo,monospace',
          color: sidCopied ? 'var(--ok)' : 'var(--fg-3)',
          cursor: 'pointer', userSelect: 'none', opacity: 0.8,
          transition: 'color 0.15s',
        }}
      >
        <ICopy size={9} />
        <span style={{ opacity: 0.5 }}>#</span>
        <span>{sessionId.slice(-8)}</span>
      </div>

      <div
        ref={scrollRef}
        style={{
          flex: 1, minHeight: 0, overflowY: 'auto',
          padding: `0 ${chatWidth < 680 ? '16px' : '120px'} ${freshSessionStart ? '100vh' : '32px'} ${chatWidth < 680 ? '16px' : '100px'}`,
          background: 'var(--bg-0)',
          display: 'flex', flexDirection: 'column', gap: 0,
          marginRight: 5,
          fontSize: 13, lineHeight: 1.5, color: 'var(--fg-0)',
          scrollbarGutter: 'stable',
        }}
      >
        {/* ── Top spacer — pushes content to bottom; collapses when fresh session starts (pill sits at top) ── */}
        <div style={{ flex: onlySessionStart ? 0 : 1, minHeight: onlySessionStart ? 0 : 80 }} />

        {/* ── Load-more sentinel (scroll-up pagination) ── */}
        {hasMoreOlder && (
          <div style={{ textAlign: 'center', paddingBottom: 12 }}>
            {loadingOlder
              ? <span style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>Lädt…</span>
              : <button
                  onClick={loadMoreOlder}
                  style={{ background: 'none', border: 'none', fontSize: 10, color: 'var(--fg-3)', cursor: 'pointer', fontFamily: 'var(--font-mono)', padding: '2px 8px' }}
                >
                  ↑ Ältere laden
                </button>
            }
          </div>
        )}

        {/* ── Older messages from DB (paginated) ── */}
        {olderMessages.length > 0 && (
          <div style={{ marginBottom: 20, opacity: 0.72 }}>
            {olderMessages.map((m, i) => {
              // Detect special encoded entries (permission, error)
              if (m.content.startsWith('{"__type":')) {
                try {
                  const parsed = JSON.parse(m.content) as Record<string, unknown>
                  if (parsed.__type === 'permission') return <HistoryPermissionCard key={m.id ?? i} data={parsed} ts={m.ts} />
                  if (parsed.__type === 'error') return <HistoryErrorCard key={m.id ?? i} data={parsed} ts={m.ts} />
                } catch { /* fall through to normal rendering */ }
              }
              return m.role === 'user' ? (
                <div key={m.id ?? i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginBottom: 24, marginTop: 10 }}>
                  <div style={{
                    maxWidth: '72%', background: 'var(--accent)', color: 'var(--accent-fg)',
                    borderRadius: '18px 18px 4px 18px', padding: '10px 14px',
                    fontSize: 13, fontWeight: 500, lineHeight: 1.65,
                    fontFamily: 'var(--font-ui)',
                  }}>
                    <BubbleContent text={m.content} />
                  </div>
                  <OldMsgFooter m={m} />
                </div>
              ) : (
                <div key={m.id ?? i} style={{ display: 'flex', gap: 10, marginBottom: 24, marginTop: 10, alignItems: 'flex-start' }}>
                  <AgentAvatar />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: 'var(--fg-0)', fontSize: 13, lineHeight: 1.65 }}>
                      <Markdown text={m.content} />
                    </div>
                    <OldMsgFooter m={m} />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {!connected && events.length === 0 && (
          <div style={{ color: 'var(--fg-3)', fontSize: 12, marginTop: 8 }}>Verbinde...</div>
        )}
        <div ref={sessionStartRef} />
        <EventList events={events} kind={kind} activeModel={activeModel} cwd={cwd} />
        {running && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, paddingLeft: 4, color: 'var(--fg-3)', fontSize: 12 }}>
            <ISpinner size={18} />
            {elapsed > 0 && <span style={{ opacity: 0.5 }}>{elapsed}s</span>}
          </div>
        )}
      </div>

      {/* ── Scroll-to-bottom button ── */}
      {showScrollBtn && (
        <button
          onClick={() => { const el = scrollRef.current; if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }) }}
          style={{
            position: 'absolute', top: 50, left: '50%', marginLeft: -22, zIndex: 50,
            width: 44, height: 44, borderRadius: '50%',
            background: 'var(--accent-soft)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border: '2px solid var(--accent-line)',
            boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--accent)', fontSize: 20,
            transition: 'opacity 0.2s',
            animation: 'scroll-bounce 1.4s ease-in-out infinite',
            padding: 0,
          }}
          title="Ganz nach unten"
        >↓</button>
      )}

      {rateToast !== null && (
        <div
          onClick={() => { setRateToast(null); if (rateToastTimer.current) clearTimeout(rateToastTimer.current) }}
          style={{
            position: 'absolute', bottom: 12, left: 120, right: 120, zIndex: 200,
            background: '#ffffff', border: '1px solid #e5e7eb',
            borderRadius: 6, padding: '8px 16px',
            color: '#111', fontSize: 12, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 10,
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          }}
        >
          <span style={{ fontWeight: 700, color: 'var(--accent)', fontSize: 12.5 }}>Rate Limit {Math.round(rateToast * 100)}%</span>
          <span style={{ color: '#555', fontSize: 11 }}>
            {rateToast >= 1 ? 'Limit erreicht' : 'Anfragen werden gedrosselt'}
          </span>
          <span style={{ color: '#aaa', fontSize: 13, marginLeft: 'auto' }}>×</span>
        </div>
      )}
    </div>
  )
}
