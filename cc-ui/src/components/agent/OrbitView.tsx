import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useAppStore } from '../../store/useAppStore'
import type { OrbitMessage } from '../../store/useAppStore'
import { useOpenRouterModels } from '../../utils/useOpenRouterModels'
import { SingleCombobox } from '../primitives/SingleCombobox'
import { IOrbit, IClose, ICopy, ITrash, IPlus, IStar, IBookmark } from '../primitives/Icons'
import type { SingleOption } from '../primitives/SingleCombobox'
import { renderBrain, updateBrainWithAI } from '../../lib/projectBrain'
import { sanitizeKey } from '../../utils/orProvider'
import { getSupabase } from '../../lib/supabase'
import { saveProjectBrainToSupabase } from '../../lib/supabaseSync'
import { resolveRefs } from '../../lib/resolveRefs'
import { loadAgentMessageById } from '../../lib/agentSync'

// ── Syntax highlighter (shared with AgentView) ────────────────────────────────
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
      setCopied(true); setTimeout(() => setCopied(false), 1500)
    }).catch(() => {})
  }
  const lines    = code.split('\n')
  const plain    = PLAIN_LANGS.has(lang)
  const hashCmt  = HASH_COMMENT.has(lang)
  const lineNumW = lines.length >= 100 ? 40 : 28
  return (
    <div style={{ margin: '10px 0', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--line-strong)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 12px', background: 'var(--bg-3)', borderBottom: '1px solid var(--line-strong)' }}>
        <span style={{ fontFamily: '"JetBrains Mono","Cascadia Code",Menlo,monospace', fontSize: 11, color: 'var(--fg-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{lang || 'code'}</span>
        <button onClick={copy} title={copied ? 'Kopiert!' : 'Kopieren'} style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? 'var(--tok-string)' : 'var(--fg-2)', padding: '2px 4px', display: 'flex', alignItems: 'center', transition: 'color 0.15s' }}>
          <ICopy size={12} />
        </button>
      </div>
      <div style={{ display: 'flex', background: 'var(--bg-1)', overflowX: 'auto' }}>
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

// ── Lightweight markdown renderer ─────────────────────────────────────────────
function parseInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  // Regex: code, bold, italic
  const re = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|(?<!\*)\*(?!\*)[^*]+\*(?!\*)(?<!\*)|(?<!_)_(?!_)[^_]+_(?!_))/g
  let last = 0, m: RegExpExecArray | null, i = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    const tok = m[0]
    if (tok.startsWith('`'))
      parts.push(<code key={i++} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9em', background: 'var(--bg-2)', color: 'var(--accent)', padding: '1px 5px', borderRadius: 3 }}>{tok.slice(1, -1)}</code>)
    else if (tok.startsWith('**') || tok.startsWith('__'))
      parts.push(<strong key={i++}>{tok.slice(2, -2)}</strong>)
    else
      parts.push(<em key={i++}>{tok.slice(1, -1)}</em>)
    last = m.index + tok.length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

function MarkdownContent({ text }: { text: string }) {
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
      elements.push(<CodeBlock key={startI} lang={lang || 'code'} code={codeLines.join('\n')} />)
      continue
    }

    // Heading
    const hm = line.match(/^(#{1,3})\s+(.+)/)
    if (hm) {
      const lvl = hm[1].length
      const sizes = [17, 15, 13.5]
      elements.push(<div key={i} style={{ fontWeight: 700, fontSize: sizes[lvl - 1] ?? 13, margin: '12px 0 4px', color: 'var(--fg-0)', lineHeight: 1.3 }}>{parseInline(hm[2])}</div>)
      i++; continue
    }

    // Horizontal rule
    if (/^[-*]{3,}$/.test(line.trim())) {
      elements.push(<hr key={i} style={{ border: 'none', borderTop: '1px solid rgba(0,0,0,0.12)', margin: '10px 0' }} />)
      i++; continue
    }

    // Blockquote
    if (line.startsWith('> ')) {
      elements.push(
        <div key={i} style={{ borderLeft: '3px solid var(--line-strong)', paddingLeft: 10, margin: '6px 0', color: 'var(--fg-2)', fontStyle: 'italic', fontSize: 12.5 }}>
          {parseInline(line.slice(2))}
        </div>
      )
      i++; continue
    }

    // Unordered list — collect consecutive items
    if (/^[-*+]\s/.test(line)) {
      const startI = i
      const items: string[] = []
      while (i < lines.length && /^[-*+]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*+]\s/, '')); i++
      }
      elements.push(
        <ul key={startI} style={{ margin: '6px 0', paddingLeft: 18, lineHeight: 1.7 }}>
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
        <ol key={startI} style={{ margin: '6px 0', paddingLeft: 20, lineHeight: 1.7 }}>
          {items.map((it, j) => <li key={j} style={{ fontSize: 13 }}>{parseInline(it)}</li>)}
        </ol>
      )
      continue
    }

    // Markdown table — collect all | rows
    if (line.trimStart().startsWith('|')) {
      const startI = i
      const tableLines: string[] = []
      while (i < lines.length && lines[i].trimStart().startsWith('|')) {
        tableLines.push(lines[i]); i++
      }
      // parse cells from a row
      const parseCells = (row: string) =>
        row.replace(/^\||\|$/g, '').split('|').map(c => c.trim())
      const isSeparator = (row: string) => /^[\s|:\-]+$/.test(row)
      const rows = tableLines.filter(r => !isSeparator(r))
      const head = rows[0] ? parseCells(rows[0]) : []
      const body = rows.slice(1).map(r => parseCells(r))
      elements.push(
        <div key={startI} style={{ overflowX: 'auto', margin: '10px 0' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 12.5, width: '100%', tableLayout: 'auto' }}>
            <thead>
              <tr>
                {head.map((cell, j) => (
                  <th key={j} style={{ padding: '5px 12px', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid var(--line-strong)', whiteSpace: 'nowrap', color: 'var(--fg-0)' }}>
                    {parseInline(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((row, ri) => (
                <tr key={ri} style={{ background: ri % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.03)' }}>
                  {row.map((cell, j) => (
                    <td key={j} style={{ padding: '5px 12px', color: 'var(--fg-1)', verticalAlign: 'top' }}>
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
      elements.push(<div key={i} style={{ height: 6 }} />)
      i++; continue
    }

    // Paragraph line
    elements.push(<div key={i} style={{ fontSize: 13, lineHeight: 1.65, margin: '1px 0' }}>{parseInline(line)}</div>)
    i++
  }

  return <>{elements}</>
}

interface Message {
  id?: string
  role: 'user' | 'assistant'
  content: string
  images?: string[]   // base64 data URLs from image-gen models
  ts: number
  model?: string
  tokens?: number
}

// msg id: om-<chat6>-<rand4>  (chat6 = last 6 alphanum chars of chatId)
const mkMsgId = (chatId: string): string => {
  const c6 = chatId.replace(/[^a-z0-9]/gi, '').slice(-6).padStart(6, '0')
  const r4 = Math.random().toString(36).slice(2, 6).padEnd(4, '0')
  return `om-${c6}-${r4}`
}

// Detect id type from prefix
function idType(id: string): 'chat' | 'msg' | null {
  if (id.startsWith('oc-')) return 'chat'
  if (id.startsWith('om-')) return 'msg'
  return null
}

function saveMessage(projectId: string, chatId: string, msg: Message) {
  fetch('/api/orbit/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, chatId, message: msg }),
  }).catch(() => {})
}

// Rough output price per 1K tokens in USD (best-effort)
const MODEL_PRICE_PER_1K: Record<string, number> = {
  'moonshotai/kimi-k2':               0.00060,
  'anthropic/claude-sonnet-4-6':      0.00300,
  'anthropic/claude-opus-4':          0.01500,
  'openai/gpt-4o':                    0.00500,
  'openai/o3-mini':                   0.00110,
  'google/gemini-2.0-flash-001':      0.00010,
  'google/gemini-2.5-pro-preview':    0.00700,
  'perplexity/sonar-pro':             0.00300,
  'x-ai/grok-3':                      0.00500,
  'meta-llama/llama-4-maverick':      0.00040,
  'deepseek/deepseek-r2':             0.00140,
  'mistralai/mistral-large':          0.00200,
}

function estimateCost(modelValue: string, tokens: number): string | null {
  const price = MODEL_PRICE_PER_1K[modelValue]
  if (!price) return null
  const usd = (tokens / 1000) * price
  if (usd < 0.0001) return '<$0.0001'
  return `$${usd.toFixed(4)}`
}

function formatTs(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'gerade eben'
  if (mins < 60) return `vor ${mins} Min.`
  const hours = Math.floor(mins / 60)
  if (hours < 12) return `vor ${hours} Std.`
  return new Date(ts).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr'
}

const DEFAULT_MODELS: SingleOption[] = [
  { value: 'anthropic/claude-sonnet-4-6',     label: 'Claude Sonnet 4.6',     group: 'Anthropic' },
  { value: 'anthropic/claude-opus-4',          label: 'Claude Opus 4',          group: 'Anthropic' },
  { value: 'openai/gpt-4o',                    label: 'GPT-4o',                 group: 'OpenAI' },
  { value: 'openai/o3-mini',                   label: 'o3-mini',                group: 'OpenAI' },
  { value: 'google/gemini-2.0-flash-001',      label: 'Gemini 2.0 Flash',       group: 'Google' },
  { value: 'google/gemini-2.5-pro-preview',    label: 'Gemini 2.5 Pro',         group: 'Google' },
  { value: 'moonshotai/kimi-k2',               label: 'Kimi K2',                group: 'Moonshot' },
  { value: 'perplexity/sonar-pro',             label: 'Perplexity Sonar Pro',   group: 'Perplexity' },
  { value: 'x-ai/grok-3',                      label: 'Grok 3',                 group: 'xAI' },
  { value: 'meta-llama/llama-4-maverick',      label: 'Llama 4 Maverick',       group: 'Meta' },
  { value: 'deepseek/deepseek-r2',             label: 'DeepSeek R2',            group: 'DeepSeek' },
  { value: 'mistralai/mistral-large',          label: 'Mistral Large',          group: 'Mistral' },
]

function TypingDot() {
  return (
    <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center', padding: '2px 0' }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 5, height: 5, borderRadius: '50%', background: 'var(--fg-3)',
          animation: 'orbit-dot 1.2s ease-in-out infinite',
          animationDelay: `${i * 0.2}s`,
        }} />
      ))}
    </span>
  )
}

function AiAvatar({ pulsing = false }: { pulsing?: boolean; dark?: boolean }) {
  const fill = '#8b6cf7'
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
    <div style={{ width: 28, height: 28, flexShrink: 0, alignSelf: 'flex-start', marginTop: 2 }}>
      <svg
        viewBox="0 0 3508 3508"
        style={{ width: 22, height: 22, display: 'block', ...(pulsing ? { animation: 'orbit-pulse 1.8s ease-in-out infinite' } : {}) }}
      >
        {paths.map((p, i) => (
          <g key={i} transform={p.t}>
            <path d={d} fill={fill} style={{ animation: 'orbit-pulse 6s cubic-bezier(0.4,0,0.2,1) infinite', animationDelay: p.delay, transformBox: 'fill-box', transformOrigin: 'center' }} />
          </g>
        ))}
      </svg>
    </div>
  )
}

function IdBadge({ id }: { id: string }) {
  const [copied, setCopied] = useState(false)
  const type = idType(id)
  // copy value includes type prefix so AI immediately knows what it is
  const copyVal = type ? `#${type}:${id}` : `#${id}`
  // display: show type label + last 6 chars
  const short = id.slice(-6)
  const label = type === 'chat' ? 'chat' : type === 'msg' ? 'msg' : ''
  const copy = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    navigator.clipboard.writeText(copyVal).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1200) }).catch(() => {})
  }
  return (
    <span
      onClick={copy}
      title={copied ? 'Kopiert!' : `Kopieren: ${copyVal}`}
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
      {label && <span style={{ color: type === 'chat' ? 'var(--orbit)' : 'var(--accent)', opacity: 0.85 }}>{label}:</span>}
      <span>{short}</span>
    </span>
  )
}

function SwitchSeparator({ from: _from, to, promptTokens, costStr }: { from: string; to: string; promptTokens: number; costStr: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 28px', color: '#a78bfa', fontSize: 10, fontFamily: 'var(--font-ui)' }}>
      <div style={{ flex: 1, height: 1, background: 'rgba(167,139,250,0.25)' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', padding: '4px 10px', borderRadius: 6, background: 'rgba(167,139,250,0.07)', border: '1px solid rgba(167,139,250,0.3)' }}>
        <span style={{ opacity: 0.6 }}>⇄</span>
        <span>Inhalte übergeben an</span>
        <span style={{ color: '#c4b5fd', fontWeight: 600 }}>{to}</span>
        <span style={{ opacity: 0.35 }}>·</span>
        <span>Übertragung</span>
        <span style={{ fontFamily: '"JetBrains Mono","Cascadia Code",Menlo,monospace', color: '#c4b5fd' }}>{promptTokens.toLocaleString('de-DE')} tk</span>
        {costStr && <><span style={{ opacity: 0.35 }}>·</span><span style={{ color: 'var(--ok)' }}>{costStr}</span></>}
      </div>
      <div style={{ flex: 1, height: 1, background: 'rgba(167,139,250,0.25)' }} />
    </div>
  )
}

/** Extract [Bild: name](url) and ![name](url) from message text, return clean text + image URLs */
function extractImagesFromContent(content: string): { cleanText: string; urls: string[] } {
  const urls: string[] = []
  // Match standard markdown images: ![alt](url)
  let clean = content.replace(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g, (_, url: string) => {
    urls.push(url); return ''
  })
  // Match [Bild: name](url) or [Image: name](url) patterns
  clean = clean.replace(/\[(?:Bild|Image|Datei): [^\]]+\]\((https?:\/\/[^)\s]+\.(png|jpe?g|gif|webp|svg|avif|bmp|heic)(?:[^)\s]*))\)/gi, (_, url: string) => {
    urls.push(url); return ''
  })
  // Collapse triple+ newlines left over from stripping
  clean = clean.replace(/\n{3,}/g, '\n\n').trim()
  return { cleanText: clean, urls }
}

type OrbitTextPart = { kind: 'text'; value: string } | { kind: 'fileref'; name: string; url: string }

const ORBIT_FILEREF_RE = /\[Datei: ([^\]]+)\]\((https?:\/\/[^)\s]+)\)/gi

function parseOrbitText(text: string): OrbitTextPart[] {
  const parts: OrbitTextPart[] = []
  let last = 0
  for (const m of text.matchAll(ORBIT_FILEREF_RE)) {
    if (m.index! > last) parts.push({ kind: 'text', value: text.slice(last, m.index!) })
    parts.push({ kind: 'fileref', name: m[1], url: m[2] })
    last = m.index! + m[0].length
  }
  if (last < text.length) parts.push({ kind: 'text', value: text.slice(last) })
  return parts
}

function MessageBubble({ msg, onFavorite, isFavorited, onImageClick }: {
  msg: Message
  onFavorite?: () => void
  isFavorited?: boolean
  onImageClick?: (src: string) => void
}) {
  const isUser = msg.role === 'user'
  const [copied, setCopied] = useState(false)
  const [hovered, setHovered] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(msg.content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    })
  }

  const cost = (msg.tokens && msg.model) ? estimateCost(
    [...DEFAULT_MODELS].find(m => m.label === msg.model)?.value ?? '', msg.tokens
  ) : null

  // For user messages: extract image URLs embedded as markdown in content
  const { cleanText, urls: extractedUrls } = isUser ? extractImagesFromContent(msg.content) : { cleanText: msg.content, urls: [] }
  // Combine base64 images from msg.images + extracted URL images
  const allImages: string[] = [...(msg.images ?? []), ...extractedUrls]

  const starBtn = onFavorite && (
    <button
      onClick={onFavorite}
      title={isFavorited ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'}
      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', display: 'flex', alignItems: 'center', color: isFavorited ? '#a78bfa' : 'var(--fg-3)', opacity: (hovered || isFavorited) ? 1 : 0, transition: 'opacity 0.15s, color 0.15s' }}
    >
      <IBookmark style={{ width: 11, height: 11 }} />
    </button>
  )

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', alignItems: 'flex-start', gap: 10, marginBottom: 32, animation: 'orbit-fadein 0.18s ease-out both' }}
    >
      {!isUser && <AiAvatar />}
      {isUser ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, maxWidth: '72%' }}>
          {/* Image thumbnails — shown ABOVE the text bubble, clickable */}
          {allImages.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, justifyContent: 'flex-end' }}>
              {allImages.map((url, i) => (
                <img
                  key={i}
                  src={url}
                  onClick={() => onImageClick?.(url)}
                  style={{
                    width: 80, height: 80, objectFit: 'cover', borderRadius: 6,
                    border: '1px solid rgba(255,255,255,0.15)',
                    cursor: onImageClick ? 'zoom-in' : 'default',
                    transition: 'opacity 0.15s',
                  }}
                  alt=""
                />
              ))}
            </div>
          )}
          <div style={{
            padding: '10px 14px',
            borderRadius: '18px 18px 4px 18px',
            background: 'var(--orbit)', color: '#fff',
            fontWeight: 300, wordBreak: 'break-word', fontFamily: 'var(--font-ui)',
          }}>
            {/* Show clean text (image markdown stripped), file refs as chips */}
            {cleanText && (() => {
              const parts = parseOrbitText(cleanText)
              return (
                <div style={{ fontSize: 13, lineHeight: 1.65, wordBreak: 'break-word', fontWeight: 300 }}>
                  {parts.map((p, i) => {
                    if (p.kind === 'fileref') {
                      const ext = p.name.includes('.') ? p.name.split('.').pop()?.toUpperCase() ?? 'FILE' : 'FILE'
                      return (
                        <a key={i} href={p.url} download={p.name} target="_blank" rel="noreferrer"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 4,
                            padding: '4px 9px 4px 6px', background: 'rgba(0,0,0,0.25)', borderRadius: 6,
                            border: '1px solid rgba(255,255,255,0.2)', fontSize: 11,
                            fontFamily: 'var(--font-mono)', color: '#fff', textDecoration: 'none', cursor: 'pointer' }}>
                          <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 3,
                            background: 'rgba(255,255,255,0.2)', color: '#fff', letterSpacing: 0.4 }}>{ext}</span>
                          {p.name}
                        </a>
                      )
                    }
                    const trimmed = p.value.trim()
                    return trimmed ? (
                      <span key={i} style={{ whiteSpace: 'pre-wrap' }}>{trimmed}</span>
                    ) : null
                  })}
                </div>
              )
            })()}
          </div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {starBtn}
            {msg.id && <IdBadge id={msg.id} />}
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: 'var(--fg-0)', fontFamily: 'var(--font-ui)', wordBreak: 'break-word' }}>
            <MarkdownContent text={msg.content} />
            {/* AI-generated images — clickable */}
            {msg.images && msg.images.map((url, i) => (
              <img
                key={i}
                src={url}
                onClick={() => onImageClick?.(url)}
                style={{
                  maxWidth: '100%', borderRadius: 6, marginTop: 10, display: 'block',
                  cursor: onImageClick ? 'zoom-in' : 'default',
                }}
                alt="Generiertes Bild"
              />
            ))}
          </div>
          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, color: 'var(--fg-3)' }}>
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              {msg.model && <span style={{ fontWeight: 600 }}>{msg.model}</span>}
              {msg.tokens ? <><span style={{ opacity: 0.35 }}>·</span><span>{msg.tokens.toLocaleString('de-DE')} tk</span></> : null}
              {cost ? <><span style={{ opacity: 0.35 }}>·</span><span>{cost}</span></> : null}
              {msg.id && <><span style={{ opacity: 0.35 }}>·</span><IdBadge id={msg.id} /></>}
            </div>
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              <span>{formatTs(msg.ts)}</span>
              {starBtn}
              <button onClick={copy} title="Kopieren" style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? 'var(--ok)' : 'var(--fg-3)', padding: '0 2px', display: 'flex', alignItems: 'center' }}>
                <ICopy style={{ width: 10, height: 10 }} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StreamingBubble({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 10, marginBottom: 32, animation: 'orbit-fadein 0.18s ease-out both' }}>
      <AiAvatar pulsing />
      <div style={{ flex: 1, minWidth: 0, color: 'var(--fg-0)', fontFamily: 'var(--font-ui)', wordBreak: 'break-word' }}>
        {text ? <MarkdownContent text={text} /> : <TypingDot />}
      </div>
    </div>
  )
}

interface OrbitViewProps { sessionId: string; containerWidth?: number }

export function OrbitView({ sessionId, containerWidth = 9999 }: OrbitViewProps) {
  const {
    openrouterKey, setScreen,
    orbitMessages, orbitMeta, addOrbitMessage, setOrbitMessages, clearOrbitMessages, setOrbitMeta,
    orbitChats, activeOrbitChatId, createOrbitChat, setActiveOrbitChat, registerOrbitChats,
    activeProjectId, projects,
    orbitCtxBefore, orbitCtxAfter,
    orbitFavorites, addOrbitFavorite, removeOrbitFavorite,
    orbitCompressPrompt, orbitCompressModel,
    brainUpdatePrompt,
    projectBrains, setProjectBrain,
    supabaseUrl, supabaseAnonKey, currentUser,
    addToast,
  } = useAppStore()
  const { models: orModels, loading: orLoading } = useOpenRouterModels()

  // Ensure there's always an active chat for this session.
  const chatId: string = activeOrbitChatId[sessionId] ?? ''
  const chatCreatingRef = useRef(false)
  useEffect(() => {
    if (!activeProjectId) return
    if (chatId) { chatCreatingRef.current = false; return }
    if (chatCreatingRef.current) return
    chatCreatingRef.current = true
    // Reuse the most recent existing chat for this project instead of always creating a new empty one
    const existing = orbitChats[activeProjectId] ?? []
    if (existing.length > 0) {
      setActiveOrbitChat(sessionId, existing[existing.length - 1])
    } else {
      createOrbitChat(activeProjectId, sessionId)
    }
  }, [sessionId, chatId, activeProjectId])

  // Auto-discover chats from JSONL files when the store is empty for this project
  useEffect(() => {
    if (!activeProjectId) return
    fetch(`/api/orbit/list-chats?projectId=${encodeURIComponent(activeProjectId)}`)
      .then(r => r.json())
      .then((d: { ok: boolean; chats: ChatMeta[] }) => {
        if (!d.ok || !d.chats.length) return
        // Enrich with stored titles
        const enriched = d.chats.map(c => ({ ...c, title: orbitMeta[c.chatId]?.title }))
        setAvailableChats(enriched)
        registerOrbitChats(activeProjectId, d.chats.map(c => c.chatId))
        // Store lastTs so UtilityPanel can sort chats even before messages are loaded
        d.chats.forEach(c => { if (c.lastTs) setOrbitMeta(c.chatId, { ...orbitMeta[c.chatId], lastTs: c.lastTs }) })
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId])

  // Auto-load messages from JSONL when chatId is set but store is empty
  useEffect(() => {
    if (!chatId || !activeProjectId) return
    if ((orbitMessages[chatId] ?? []).length > 0) return   // already loaded
    fetch(`/api/orbit/load-chat?projectId=${encodeURIComponent(activeProjectId)}&chatId=${encodeURIComponent(chatId)}`)
      .then(r => r.json())
      .then((d: { ok: boolean; messages: OrbitMessage[] }) => {
        if (d.ok && d.messages.length > 0) setOrbitMessages(chatId, d.messages)
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, activeProjectId])

  const messages = (orbitMessages[chatId] ?? []).filter(m => m.content.trim() || (m.images?.length ?? 0) > 0)
  const meta     = orbitMeta[chatId]

  const [streaming, setStreaming]   = useState(false)
  const [streamText, setStreamText] = useState('')
  const [error, setError]           = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft]     = useState('')
  const [lightboxSrc, setLightboxSrc]   = useState<string | null>(null)
  const [chatIdCopied, setChatIdCopied] = useState(false)
  type ChatMeta = { chatId: string; messageCount: number; lastTs: number; title?: string }
  const [availableChats, setAvailableChats] = useState<ChatMeta[]>([])

  // Close lightbox on Escape
  useEffect(() => {
    if (!lightboxSrc) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightboxSrc(null) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [lightboxSrc])
  const [selectedModel, setSelectedModel] = useState<string>(
    () => localStorage.getItem('orbit:lastModel') ?? 'moonshotai/kimi-k2'
  )

  const bottomRef      = useRef<HTMLDivElement>(null)
  const orbitScrollRef = useRef<HTMLDivElement>(null)
  const orbitWidth = containerWidth
  const initialScrollDoneRef = useRef(false)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const abortRef  = useRef<AbortController | null>(null)
  const prevModelRef = useRef<string>(selectedModel)
  const pendingSwitchRef = useRef<{ from: string; to: string } | null>(null)
  const brainUpdateRef = useRef<{ chatId: string; lastCount: number }>({ chatId: '', lastCount: 0 })
  const BRAIN_UPDATE_EVERY = 5  // update brain every N assistant replies

  type SwitchEvent = { insertBeforeIdx: number; from: string; to: string; promptTokens: number; costStr: string }
  const [switchEvents, setSwitchEvents] = useState<SwitchEvent[]>([])

  useEffect(() => { localStorage.setItem('orbit:lastModel', selectedModel) }, [selectedModel])

  // Track model switch — store raw model values, resolve labels at send time using live modelOptions
  useEffect(() => {
    const prev = prevModelRef.current
    if (prev !== selectedModel && prev !== '') {
      pendingSwitchRef.current = { from: prev, to: selectedModel }
    }
    prevModelRef.current = selectedModel
  }, [selectedModel])

  const modelOptions: SingleOption[] = (orModels.length > 0 ? orModels : DEFAULT_MODELS).map(m => ({
    value: (m as SingleOption).value,
    label: (m as SingleOption).label,
    group: (m as SingleOption & { group?: string }).group,
  }))

  // Reset initial-scroll flag when chat switches
  useEffect(() => { initialScrollDoneRef.current = false }, [chatId])

  // Scroll to bottom whenever messages change:
  // – if already near bottom (streaming / new reply) → smooth
  // – on initial load (first render with messages) → instant
  useEffect(() => {
    const el = orbitScrollRef.current
    if (!el) return
    if (!initialScrollDoneRef.current && messages.length > 0) {
      // First load: jump instantly to bottom
      el.scrollTop = el.scrollHeight
      initialScrollDoneRef.current = true
      return
    }
    const isNear = el.scrollHeight - el.scrollTop - el.clientHeight < 120
    if (isNear) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, streamText])

  const handleOrbitScroll = useCallback(() => {
    const el = orbitScrollRef.current
    if (!el) return
    setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 120)
  }, [])

  // Generate AI title after 1st assistant reply, refresh after 2nd
  const titleGeneratedRef = useRef<{ chatId: string; count: number }>({ chatId: '', count: 0 })
  useEffect(() => {
    if (!chatId || !openrouterKey) return
    const assistantCount = messages.filter(m => m.role === 'assistant').length
    if (assistantCount < 1) return
    // Only re-generate at count 1 and 2; skip if manually edited beyond count 2
    const prev = titleGeneratedRef.current
    if (prev.chatId !== chatId) titleGeneratedRef.current = { chatId, count: 0 }
    if (titleGeneratedRef.current.count >= assistantCount) return
    if (assistantCount > 2) return
    titleGeneratedRef.current = { chatId, count: assistantCount }
    void (async () => {
      try {
        const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${sanitizeKey(openrouterKey)}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'google/gemini-2.0-flash-001',
            messages: [
              ...messages.slice(0, 4).map(m => ({ role: m.role, content: m.content.slice(0, 400) })),
              { role: 'user', content: 'Gib diesem Gespräch einen kurzen prägnanten Titel (max. 5 Wörter, keine Anführungszeichen, keine Satzzeichen am Ende).' },
            ],
            max_tokens: 20, stream: false,
          }),
        })
        if (resp.ok) {
          const d = await resp.json() as { choices?: { message?: { content?: string } }[] }
          const t = d.choices?.[0]?.message?.content?.trim()
          if (t) setOrbitMeta(chatId, { title: t })
        }
      } catch { /* ignore */ }
    })()
  }, [messages.length, chatId, openrouterKey])

  const projectId = activeProjectId ?? 'default'
  const projectFavs = orbitFavorites[projectId] ?? []

  const toggleMessageFavorite = useCallback((m: Message) => {
    if (!m.id) return
    const existing = projectFavs.find(f => f.kind === 'message' && f.messageId === m.id)
    if (existing) {
      removeOrbitFavorite(projectId, existing.id)
    } else {
      addOrbitFavorite({
        id: `fav-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        kind: 'message',
        projectId,
        chatId,
        chatTitle: meta?.title,
        messageId: m.id,
        messageContent: m.content.slice(0, 300),
        messageRole: m.role,
        messageModel: m.model,
        msgTs: m.ts,
        ts: Date.now(),
      })
    }
  }, [projectFavs, projectId, chatId, meta, addOrbitFavorite, removeOrbitFavorite])

  const isMessageFavorited = useCallback((m: Message) => {
    if (!m.id) return false
    return projectFavs.some(f => f.kind === 'message' && f.messageId === m.id)
  }, [projectFavs])

  const newChat = useCallback(() => {
    if (!activeProjectId) return
    createOrbitChat(activeProjectId, sessionId)
  }, [activeProjectId, sessionId, createOrbitChat])

  const clearChat = useCallback(() => {
    if (!chatId) return
    clearOrbitMessages(chatId)
    setOrbitMeta(chatId, { title: undefined })
  }, [chatId, clearOrbitMessages, setOrbitMeta])


  const sendText = useCallback(async (text: string, attachedImages?: { dataUrl: string; mimeType: string }[]) => {
    if (!text.trim() && !attachedImages?.length || streaming) return
    if (!openrouterKey) { addToast({ type: 'error', title: 'Kein OpenRouter-Key', body: 'Bitte in Einstellungen hinterlegen.' }); return }

    setError(null)
    const projName = projects.find(p => p.id === activeProjectId)?.name ?? activeProjectId ?? 'unknown'

    // Pre-resolve #amsg:am-xxx agent message refs from Supabase
    let preResolved = text
    const amsgMatches = [...text.matchAll(/#amsg:(am-[a-z0-9-]+)/gi)]
    if (amsgMatches.length > 0) {
      const sb = getSupabase(supabaseUrl, supabaseAnonKey)
      if (sb && currentUser?.id) {
        let appendix = '\n\n---\nAgent-Kontext-Referenzen:'
        for (const m of amsgMatches) {
          const msg = await loadAgentMessageById(sb, currentUser.id, m[1]).catch(() => null)
          if (msg) {
            const label = msg.role === 'user' ? 'Nutzer' : 'Assistent'
            appendix += `\n\n[${label} ${m[0]}]: ${msg.content.slice(0, 600)}`
          }
        }
        if (appendix !== '\n\n---\nAgent-Kontext-Referenzen:') preResolved = text + appendix
      }
    }

    // Resolve any #msg: or #chat: references embedded in the text
    const resolvedText = await resolveRefs(preResolved, orbitCtxBefore, orbitCtxAfter)

    const userMsg: Message = { id: mkMsgId(chatId), role: 'user', content: text, images: attachedImages?.map(i => i.dataUrl), ts: Date.now() }
    saveMessage(activeProjectId ?? 'default', chatId, userMsg)
    const history = [...messages, userMsg]
    setOrbitMessages(chatId, history)

    // Strip injected error messages (id ends with '-err') — never send them to the API.
    // Truncate remaining history to avoid context-window overflow.
    // Keep the first message (may be a compressed-context summary) + last MAX-1 messages.
    const MAX_API_MSGS = 40
    const cleanHistory = history.filter(m => !m.id?.endsWith('-err'))
    const sendHistory = cleanHistory.length > MAX_API_MSGS
      ? [cleanHistory[0], ...cleanHistory.slice(-(MAX_API_MSGS - 1))]
      : cleanHistory
    setStreaming(true)
    setStreamText('')

    const ctrl = new AbortController()
    abortRef.current = ctrl

    const isImageModel = selectedModel.toLowerCase().includes('image') || selectedModel.toLowerCase().includes('imagen') || selectedModel.toLowerCase().includes('flux') || selectedModel.toLowerCase().includes('dall-e')

    type InlineData = { mime_type?: string; mimeType?: string; data: string }
    type ContentItem =
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string } }
      | { type: 'image'; source?: { type?: string; media_type?: string; data?: string; url?: string } }
      | { b64_json?: string; mime_type?: string; url?: string }
      | { inline_data?: InlineData; inlineData?: InlineData }
      | { parts?: ContentItem[] }
    type DeltaContent = string | ContentItem[]

    let full = '', totalTokens = 0, promptTokens = 0
    const images: string[] = []
    const switchAtIdx = messages.length  // index before which the separator will appear
    const pendingSwitch = pendingSwitchRef.current

    const extractFromItems = (items: ContentItem[]) => {
      for (const item of items) {
        if ('parts' in item && Array.isArray(item.parts)) { extractFromItems(item.parts); continue }
        if ('type' in item) {
          if (item.type === 'image_url') images.push(item.image_url.url)
          else if (item.type === 'image' && item.source) {
            const s = item.source
            if (s.url) images.push(s.url)
            else if (s.data && s.media_type) images.push(`data:${s.media_type};base64,${s.data}`)
          } else if (item.type === 'text') { full += item.text }
        } else if ('b64_json' in item && item.b64_json) {
          images.push(`data:${item.mime_type ?? 'image/png'};base64,${item.b64_json}`)
        } else if ('url' in item && item.url) {
          images.push(item.url as string)
        } else {
          const id = (item as Record<string, unknown>).inline_data as { data?: string; mime_type?: string; mimeType?: string } | undefined ?? (item as Record<string, unknown>).inlineData as { data?: string; mime_type?: string; mimeType?: string } | undefined
          if (id?.data) images.push(`data:${id.mime_type ?? id.mimeType ?? 'image/png'};base64,${id.data}`)
        }
      }
    }

    try {
      const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        signal: ctrl.signal,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sanitizeKey(openrouterKey)}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Codera AI · Orbit',
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [
            // Inject project brain as system prompt (skip for image models)
            ...(!isImageModel && projectBrains[projectId]
              ? [{ role: 'system', content: renderBrain(projectBrains[projectId], projName) }]
              : []
            ),
            ...sendHistory.map((m, i) => {
              const isLastUser = i === sendHistory.length - 1 && m.role === 'user'
              const textContent = isLastUser && resolvedText !== text ? resolvedText : m.content
              if (isLastUser && attachedImages?.length) {
                return {
                  role: m.role,
                  content: [
                    ...attachedImages.map(img => ({ type: 'image_url', image_url: { url: img.dataUrl } })),
                    { type: 'text', text: textContent },
                  ],
                }
              }
              return { role: m.role, content: textContent }
            }),
          ],
          stream: !isImageModel,
          ...(isImageModel ? { modalities: ['text', 'image'] } : {}),
        }),
      })

      if (!resp.ok) {
        const errBody = await resp.text().catch(() => '')
        throw new Error(`${resp.status} ${resp.statusText}${errBody ? ' — ' + errBody.slice(0, 200) : ''}`)
      }

      if (isImageModel) {
        // Non-streaming: parse full JSON — handles Gemini inlineData, OpenAI data[], etc.
        const json = await resp.json() as {
          choices?: { message?: { content?: DeltaContent } }[]
          candidates?: { content?: { parts?: ContentItem[] } }[]
          data?: { url?: string; b64_json?: string }[]
          usage?: { total_tokens?: number }
        }
        // OpenAI images endpoint format (data[])
        if (json.data) {
          for (const d of json.data) {
            if (d.url) images.push(d.url)
            else if (d.b64_json) images.push(`data:image/png;base64,${d.b64_json}`)
          }
        }
        // Gemini native candidates format
        if (json.candidates) {
          for (const c of json.candidates) {
            if (c.content?.parts) extractFromItems(c.content.parts)
          }
        }
        // OpenAI-compat choices format
        const content = json.choices?.[0]?.message?.content
        if (typeof content === 'string') full = content
        else if (Array.isArray(content)) extractFromItems(content)
        if (json.usage?.total_tokens) totalTokens = json.usage.total_tokens
        if ((json.usage as Record<string, unknown> | undefined)?.['prompt_tokens']) promptTokens = (json.usage as Record<string, number>)['prompt_tokens']
      } else {
        // Streaming for text models
        const reader = resp.body!.getReader()
        const dec = new TextDecoder()
        let buf = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buf += dec.decode(value, { stream: true })
          const lines = buf.split('\n')
          buf = lines.pop()!
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6).trim()
            if (data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data) as {
                choices?: { delta?: { content?: DeltaContent; b64_json?: string }; message?: { content?: DeltaContent } }[]
                usage?: { total_tokens?: number }
              }
              const choice = parsed.choices?.[0]
              if (choice?.delta?.b64_json) images.push(`data:image/png;base64,${choice.delta.b64_json}`)
              const delta = choice?.delta?.content ?? choice?.message?.content
              if (typeof delta === 'string') { full += delta; setStreamText(full) }
              else if (Array.isArray(delta)) { extractFromItems(delta); setStreamText(full) }
              if (parsed.usage?.total_tokens) totalTokens = parsed.usage.total_tokens
              if ((parsed.usage as Record<string, unknown> | undefined)?.['prompt_tokens']) promptTokens = (parsed.usage as Record<string, number>)['prompt_tokens']
            } catch { /* skip */ }
          }
        }
      }

      const modelLabel = modelOptions.find(o => o.value === selectedModel)?.label ?? selectedModel.split('/').pop() ?? selectedModel
      const assistantMsg: Message = { id: mkMsgId(chatId), role: 'assistant', content: full, images: images.length > 0 ? images : undefined, ts: Date.now(), model: modelLabel, tokens: totalTokens || undefined }
      if (full.trim() || images.length > 0) {
        saveMessage(activeProjectId ?? 'default', chatId, assistantMsg)
        addOrbitMessage(chatId, assistantMsg)
      }
      // If this was the first message to a new model, insert the transfer separator
      if (pendingSwitch && promptTokens > 0) {
        const getLabel = (val: string) => modelOptions.find(o => o.value === val)?.label ?? val.split('/').pop() ?? val
        const fromLabel = getLabel(pendingSwitch.from)
        const toLabel   = getLabel(pendingSwitch.to)
        const price = MODEL_PRICE_PER_1K[selectedModel] ?? 0
        const cost = price > 0 ? (promptTokens / 1000) * price : 0
        const costStr = cost > 0 ? (cost < 0.0001 ? '~<$0.0001' : `~$${cost.toFixed(4)}`) : ''
        setSwitchEvents(prev => [...prev, { insertBeforeIdx: switchAtIdx, from: fromLabel, to: toLabel, promptTokens, costStr }])
        pendingSwitchRef.current = null
      }
      const allMsgs = [...history, assistantMsg]

      // Brain auto-update: fire-and-forget every BRAIN_UPDATE_EVERY assistant replies
      const assistantCount = allMsgs.filter(m => m.role === 'assistant').length
      const prevBrainCount = brainUpdateRef.current.chatId === chatId
        ? brainUpdateRef.current.lastCount : 0
      if (
        assistantCount > 0 &&
        assistantCount % BRAIN_UPDATE_EVERY === 0 &&
        assistantCount !== prevBrainCount &&
        openrouterKey
      ) {
        brainUpdateRef.current = { chatId, lastCount: assistantCount }
        void updateBrainWithAI({
          openrouterKey,
          currentBrain: projectBrains[projectId],
          recentMessages: allMsgs.slice(-10),
          projectName: projName,
          projectId,
          compressModel: orbitCompressModel,
          customPrompt: brainUpdatePrompt || undefined,
        }).then(updatedBrain => {
          setProjectBrain(projectId, updatedBrain)
          const sb = getSupabase(supabaseUrl, supabaseAnonKey)
          if (sb && currentUser?.id) {
            void saveProjectBrainToSupabase(sb, currentUser.id, updatedBrain)
          }
        })
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        const raw = String(e)
        const isCtx = raw.toLowerCase().includes('context_length') || raw.includes('maximum context') || raw.includes('too long')
        const is413 = raw.includes('413')
        const userMsg2 = isCtx || is413
          ? 'Kontext zu lang — der Chat-Verlauf übersteigt das Kontextfenster des Modells. Starte einen neuen Chat (+ Taste oben rechts), um weiterzumachen.'
          : raw
        setError(null)
        addToast({ type: 'error', title: 'Orbit-Fehler', body: userMsg2 })
        // Inject visible error into the chat thread so it's not missed
        const errMsg: Message = {
          id: mkMsgId(chatId) + '-err',
          role: 'assistant',
          content: `⚠️ **Fehler:** ${userMsg2}`,
          ts: Date.now(),
        }
        addOrbitMessage(chatId, errMsg)
      }
    } finally {
      setStreaming(false)
      setStreamText('')
      abortRef.current = null
    }
  }, [messages, streaming, openrouterKey, selectedModel, sessionId])

  // Listen to InputArea's cc:orbit-send event
  useEffect(() => {
    type OrbitSendDetail = { sessionId: string; text: string; images?: { dataUrl: string; mimeType: string }[] }
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<OrbitSendDetail>).detail
      if (detail.sessionId === sessionId) void sendText(detail.text, detail.images)
    }
    window.addEventListener('cc:orbit-send', handler)
    return () => window.removeEventListener('cc:orbit-send', handler)
  }, [sessionId, sendText])

  const stop = () => { abortRef.current?.abort() }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', background: 'var(--bg-0)' }}>
      <style>{`
        @keyframes orbit-dot { 0%,80%,100%{opacity:.2;transform:scale(.8)} 40%{opacity:1;transform:scale(1)} }
        @keyframes orbit-pulse { 0%,100%{opacity:.45;transform:scale(0.92)} 50%{opacity:1;transform:scale(1.16)} }
        @keyframes orbit-spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        @keyframes orbit-fadein { from { opacity:0; transform: translateY(5px); } to { opacity:1; transform: translateY(0); } }
        @keyframes orbit-shimmer { 0%{background-position:200% center} 100%{background-position:-200% center} }
      `}</style>



      {/* ── Top-left: title (editable) ── */}
      {messages.length > 0 && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, display: 'flex', alignItems: 'center', padding: '12px 270px 16px 100px', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', maskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)' }}>
          {editingTitle ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={e => setTitleDraft(e.target.value)}
              onBlur={() => { if (titleDraft.trim()) setOrbitMeta(chatId, { title: titleDraft.trim() }); setEditingTitle(false) }}
              onKeyDown={e => { if (e.key === 'Enter') { if (titleDraft.trim()) setOrbitMeta(chatId, { title: titleDraft.trim() }); setEditingTitle(false) } if (e.key === 'Escape') setEditingTitle(false) }}
              style={{ background: 'transparent', border: 'none', borderBottom: '1px solid var(--orbit)', padding: '2px 0', fontSize: 14, fontWeight: 700, color: 'var(--fg-0)', outline: 'none', width: '100%' }}
            />
          ) : (
            <span
              onClick={() => { setTitleDraft(meta?.title ?? ''); setEditingTitle(true) }}
              title="Titel bearbeiten"
              style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg-0)', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%', textShadow: '0 1px 8px var(--bg-0), 0 0 16px var(--bg-0)' }}
            >
              {meta?.title ?? (messages[0]?.content.slice(0, 40) + (messages[0]?.content.length > 40 ? '…' : ''))}
            </span>
          )}
        </div>
      )}

      {/* ── Top-right: action buttons + model combobox + chat-ID ── */}
      <div style={{ position: 'absolute', top: 8, right: 12, zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.15))' }}>
        {/* Row 1: action buttons + model combobox */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <SingleCombobox
            options={modelOptions}
            value={selectedModel}
            onChange={setSelectedModel}
            searchable
            align="right"
            loading={orLoading && orModels.length === 0}
            placeholder="Modell…"
            style={{ width: 180 }}
          />
        </div>
        {/* Row 2: Chat-ID below model selector */}
        {chatId && (
          <div
            onClick={() => {
              navigator.clipboard.writeText(chatId).then(() => { setChatIdCopied(true); setTimeout(() => setChatIdCopied(false), 1200) }).catch(() => {})
            }}
            title={chatIdCopied ? 'Kopiert!' : `Chat-ID kopieren: ${chatId}`}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '5px 9px', borderRadius: 6,
              background: 'var(--bg-2)', border: '1px solid var(--line-strong)',
              fontSize: 11, fontFamily: 'var(--font-ui)',
              color: chatIdCopied ? 'var(--ok)' : 'var(--fg-0)',
              cursor: 'pointer', userSelect: 'none',
              transition: 'color 0.15s',
            }}
          >
            <ICopy style={{ width: 10, height: 10, color: chatIdCopied ? 'var(--ok)' : 'var(--fg-3)' }} />
            <span style={{ color: 'var(--fg-3)', fontSize: 10 }}>#</span>
            <span>chat:{chatId.slice(-6)}</span>
          </div>
        )}
      </div>

      {/* ── Scroll-to-bottom button ── */}
      {showScrollBtn && (
        <button
          onClick={() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' })}
          style={{
            position: 'absolute', top: 50, left: '50%', marginLeft: -22, zIndex: 50,
            width: 44, height: 44, borderRadius: '50%',
            background: 'rgba(139,92,246,0.15)',
            backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
            border: '2px solid rgba(139,92,246,0.5)',
            boxShadow: '0 2px 12px rgba(139,92,246,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', padding: 0,
            color: 'rgb(139,92,246)', fontSize: 20, transition: 'opacity 0.2s',
            animation: 'scroll-bounce 1.4s ease-in-out infinite',
          }}
          title="Ganz nach unten"
        >↓</button>
      )}

      {/* ── Messages ── */}
      <div ref={orbitScrollRef} onScroll={handleOrbitScroll} style={{ flex: 1, overflowY: 'auto', scrollbarGutter: 'stable', marginRight: 5, maskImage: 'linear-gradient(to bottom, transparent 0%, black 60px, black calc(100% - 40px), transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 60px, black calc(100% - 40px), transparent 100%)' }}>
      <div style={{ padding: `0 ${orbitWidth < 680 ? '16px' : '132px'} 16px ${orbitWidth < 680 ? '16px' : '100px'}`, display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
        <div style={{ flex: 1, minHeight: 80 }} />
        {messages.length === 0 && !streaming && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14 }}>
            <IOrbit style={{ width: 52, height: 52, color: 'var(--orbit)', opacity: 0.85, strokeWidth: 1.2 }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--fg-0)', marginBottom: 8, letterSpacing: -0.3 }}>
                Willkommen im Orbit Bereich
              </div>
              <div style={{ fontSize: 12, color: 'var(--fg-3)', lineHeight: 1.7, maxWidth: 320 }}>
                Wähle zwischen 200+ KI-Modellen — GPT, Gemini, Kimi, Perplexity und mehr.<br />
                Dein letztes Modell wird automatisch gespeichert.
              </div>
            </div>
            {!openrouterKey && (
              <button onClick={() => setScreen('settings')} style={{ marginTop: 6, padding: '7px 18px', borderRadius: 6, border: 'none', background: 'var(--orbit)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                OpenRouter-Key hinterlegen
              </button>
            )}
          </div>
        )}

        {messages.map((m, i) => (
          <React.Fragment key={m.id ?? i}>
            {switchEvents.filter(se => se.insertBeforeIdx === i).map((se, si) => (
              <SwitchSeparator key={si} from={se.from} to={se.to} promptTokens={se.promptTokens} costStr={se.costStr} />
            ))}
            <MessageBubble
              msg={m}
              onFavorite={() => toggleMessageFavorite(m)}
              isFavorited={isMessageFavorited(m)}
              onImageClick={setLightboxSrc}
            />
          </React.Fragment>
        ))}
        {streaming && <StreamingBubble text={streamText} />}
        <div ref={bottomRef} />
      </div>
      </div>

      {/* ── Error bar ── */}
      {error && (
        <div style={{ padding: '6px 16px', background: 'rgba(239,68,68,0.08)', borderTop: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: 'var(--err)', flex: 1 }}>{error}</span>
          <IClose style={{ width: 10, height: 10, color: 'var(--err)', cursor: 'pointer' }} onClick={() => setError(null)} />
        </div>
      )}

      {/* ── Image lightbox (covers only OrbitView, not the textbox below) ── */}
      {lightboxSrc && (
        <div
          onClick={() => setLightboxSrc(null)}
          style={{
            position: 'absolute', inset: 0, zIndex: 50,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'zoom-out',
          }}
        >
          <img
            src={lightboxSrc}
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '90%', maxHeight: '90%',
              borderRadius: 6,
              boxShadow: '0 12px 60px rgba(0,0,0,0.6)',
              objectFit: 'contain',
              cursor: 'default',
              userSelect: 'none',
            }}
            alt=""
          />
          <button
            onClick={() => setLightboxSrc(null)}
            title="Schließen (Esc)"
            style={{
              position: 'absolute', top: 12, right: 12,
              width: 32, height: 32, borderRadius: '50%',
              background: 'rgba(255,255,255,0.12)',
              border: '1px solid rgba(255,255,255,0.25)',
              cursor: 'pointer', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 0,
            }}
          >
            <IClose style={{ width: 14, height: 14 }} />
          </button>
        </div>
      )}
    </div>
  )
}
