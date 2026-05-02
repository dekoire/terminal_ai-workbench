import React, { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import { useAppStore } from '../../store/useAppStore'
import { TERMINAL_THEMES } from '../../theme/presets'

interface Props {
  sessionId: string
  cmd: string
  args: string
  cwd: string
}

// ── crew output display filter ────────────────────────────────────────────────
function hexToAnsi(hex: string): string {
  const c = hex.replace('#', '')
  const r = parseInt(c.slice(0, 2), 16)
  const g = parseInt(c.slice(2, 4), 16)
  const b = parseInt(c.slice(4, 6), 16)
  return `\x1b[38;2;${r};${g};${b}m`
}

function decodeB64Task(b64: string): string {
  if (!b64) return ''
  try {
    // atob returns binary (Latin-1); decode bytes as UTF-8
    const binary = atob(b64)
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0))
    const t = new TextDecoder('utf-8').decode(bytes).trim().replace(/[\r\n]+/g, ' ')
    return t.length > 130 ? t.slice(0, 130) + '…' : t
  } catch { return '' }
}

function crewDisplayFilter(
  raw: string,
  inCodeBlock: { current: boolean },
  inAgent:     { current: string },
  inScrape:    { current: boolean },
  inResult:    { current: boolean },
  accent: string,
): string {
  const A   = hexToAnsi(accent)
  const A2  = `\x1b[2m${A}`
  const R   = '\x1b[0m'
  const DIM = '\x1b[2m'
  const GRY = '\x1b[38;5;244m'      // neutral grey (not accent-tinted)
  const RED = '\x1b[31m'            // red
  const ITA = '\x1b[3m'             // italic

  if (raw.includes('###CREW_RUN_START:')) {
    inCodeBlock.current = false
    inAgent.current     = ''
    inScrape.current    = false
    inResult.current    = false
  }
  if (raw.includes('###CREW_RESULT_READY###')) {
    inCodeBlock.current = false
    inScrape.current    = false
    inResult.current    = false
  }

  let s = raw
    // ── Protocol markers ──────────────────────────────────────────────────────
    .replace(/[^\r\n]*###CREW_RUN_START:([A-Za-z0-9+/=]*)###[^\r\n]*/g,
      (_m, b64) => {
        inCodeBlock.current = false; inScrape.current = false
        const req = decodeB64Task(b64)
        return `\r\n${A}✓ Anfrage${R}${req ? `\r\n${DIM}  ${req}${R}` : ''}\r\n`
      })
    .replace(/[^\r\n]*###CREW_TOTAL_TOKENS:\d+###[^\r\n]*/g, '')
    .replace(/[^\r\n]*###CREW_META:[^#\r\n]+###[^\r\n]*/g, '')
    .replace(/[^\r\n]*###CREW_ERROR:[^#\r\n]*###[^\r\n]*/g, '')
    .replace(/[^\r\n]*###CREW_RESULT_READY###[^\r\n]*/g,
      () => { inCodeBlock.current = false; inScrape.current = false; return `\r\n${A}Abfrage Abgeschlossen${R}\r\n` })
    // ── Orchestrator delegation step ──────────────────────────────────────────
    .replace(/###CREW:Orchestrator:([^:#\s]+):step(?::([A-Za-z0-9+/=]*))?###/g,
      (_m, model, b64) => {
        inCodeBlock.current = false; inScrape.current = false
        const task = b64 ? decodeB64Task(b64) : ''
        return `\r\n${A}◆ Orchestrator delegiert${R} ${DIM}· ${model}${R}${task ? `\r\n${DIM}  → ${task}${R}` : ''}\r\n`
      })
    // ── Agent start ───────────────────────────────────────────────────────────
    .replace(/###CREW:([^:#\s]+):([^:#\s]+):start(?::([A-Za-z0-9+/=]*))?###/g,
      (_m, agent, model, _b64) => {
        inCodeBlock.current = false; inScrape.current = false
        inAgent.current = agent
        return `\r\n${A}◆ ${agent.replace(/_/g, ' ')}${R} ${DIM}· ${model} · arbeitet...${R}\r\n`
      })
    // ── Agent done ────────────────────────────────────────────────────────────
    .replace(/###CREW:([^:#\s]+):([^:#\s]+):done###/g,
      (_m, agent, model) => {
        inCodeBlock.current = false; inScrape.current = false
        inAgent.current = ''
        return `${A2}  ◆  ${agent.replace(/_/g, ' ')} · ${model}  ·  Aufgabe abgeschlossen${R}\r\n`
      })
    // ── Tool results ──────────────────────────────────────────────────────────
    .replace(/[^\r\n]*Tool file_writer_tool executed with result:[^\r\n]*/g,
      () => {
        const who = inAgent.current ? inAgent.current.replace(/_/g, ' ') + ' — ' : ''
        return `${A}  ✓ ${who}Datei angelegt${R}`
      })
    .replace(/Tool [A-Za-z_]+ executed with result: /g, '')
    .replace(/\[Crew empfangen:[^\]\r\n]*\]\r?\n?/g, '')

  // ── Line-by-line: format errors, compact scraped content, strip code blocks
  const lines = s.split(/\r?\n/)
  const out: string[] = []
  let blanks = 0
  for (const ln of lines) {
    const vis = ln.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '').replace(/\r/g, '').trim()

    // Our own formatted marker lines — always reset filter state so nothing gets blocked
    if (/^[◆✓✗]/.test(vis) || vis.startsWith('→ ') || vis.startsWith('Abfrage Abgeschlossen')) {
      inCodeBlock.current = false
      inScrape.current    = false
      inResult.current    = false
    }

    // Green CrewAI result lines → right-indented italic "Ergebnis" block
    // eslint-disable-next-line no-control-regex
    const isGreen = /\x1b\[(?:0;)?(?:1;)?32m|\x1b\[92m/.test(ln)
    if (isGreen && vis && !/^[◆✓✗>]/.test(vis) && !vis.startsWith('exited')) {
      if (!inResult.current) {
        inResult.current = true
        out.push(`\r\n${A2}        Ergebnis${R}`)
      }
      out.push(`${GRY}${ITA}        ${vis}${R}`)
      blanks = 0; continue
    }
    if (inResult.current && !vis) { out.push(''); continue }
    if (inResult.current && vis && !isGreen) inResult.current = false

    // Scraped web content — compact to one header line, skip body
    if (vis.startsWith('The following text is scraped website content:') || vis.startsWith('Scraped content:')) {
      inScrape.current = true
      // Only push if last line wasn't the same (deduplicate consecutive hits)
      const last = out[out.length - 1] ?? ''
      if (!last.includes('Webinhalt abrufen'))
        out.push(`${GRY}${ITA}    ↳ Webinhalt abrufen...${R}`)
      blanks = 0; continue
    }
    if (inScrape.current) {
      if (!vis || /^[◆✓✗→↳]/.test(vis)) { inScrape.current = false }
      else { continue }
    }

    // Code blocks — suppress fence + content entirely
    if (vis.startsWith('```')) { inCodeBlock.current = !inCodeBlock.current; continue }
    if (inCodeBlock.current) continue

    // ERROR:root / ERROR:litellm / ERROR:openai → red italic, 4-space indent
    if (/^ERROR:[A-Za-z._]+:/.test(vis)) {
      const brief = vis.replace(/^ERROR:[A-Za-z._]+:\s*/, '').slice(0, 110)
      out.push(`${RED}${ITA}    ✗ ${brief || vis.slice(0, 110)}${R}`)
      blanks = 0; continue
    }

    // Tool / runtime errors → red italic (catches "Error: ...", "Error executing tool:", etc.)
    if (/^Error[: ]/.test(vis) || vis.startsWith('coworker mentioned not found')) {
      // Only strip a short "Error: " or "Error executing tool." prefix — not the whole message
      const brief = vis
        .replace(/^Error\s+executing\s+tool\.?\s*/i, '')
        .replace(/^Error\s*:\s*/i, '')
        .slice(0, 110)
      out.push(`${RED}${ITA}    ✗ ${brief || vis.slice(0, 110)}${R}`)
      blanks = 0; continue
    }

    // Noisy meta-lines + error option-list continuations → skip
    if (/^\[CrewAI|^Consider using a smaller|^An unknown error occurred|^Error details:/.test(vis)) continue
    // Suppress "- option" bullet lists and bare "..." that follow error messages
    if (/^\s*[-•]\s+\w/.test(vis) || /^\.\.\.\s*$/.test(vis)) continue

    if (!vis) { if (++blanks <= 1) out.push(ln) } else { blanks = 0; out.push(ln) }
  }
  return out.join('\r\n')
}

const DARK_THEME = {
  background:          '#0e0d0b',
  foreground:          '#d4cfc8',
  cursor:              '#ff8a5b',
  cursorAccent:        '#0e0d0b',
  selectionBackground: 'rgba(255,138,91,0.3)',
  black:         '#1a1814', brightBlack:   '#504a42',
  red:           '#ef7a7a', brightRed:     '#ff9a9a',
  green:         '#7cd9a8', brightGreen:   '#9cefb8',
  yellow:        '#f4c365', brightYellow:  '#ffd385',
  blue:          '#7aaeef', brightBlue:    '#9aceff',
  magenta:       '#c47aef', brightMagenta: '#e49aff',
  cyan:          '#7aefef', brightCyan:    '#9affff',
  white:         '#d4cfc8', brightWhite:   '#f0ece4',
}

const LIGHT_THEME = {
  background:          '#faf8f4',
  foreground:          '#2a2420',
  cursor:              '#d96a3a',
  cursorAccent:        '#faf8f4',
  selectionBackground: 'rgba(217,106,58,0.2)',
  black:         '#2a2420', brightBlack:   '#7a7368',
  red:           '#c0463f', brightRed:     '#d96060',
  green:         '#3d9b6c', brightGreen:   '#50b880',
  yellow:        '#b88425', brightYellow:  '#d09a35',
  blue:          '#4a7bce', brightBlue:    '#5a8be0',
  magenta:       '#8a4ece', brightMagenta: '#9a60e0',
  cyan:          '#2a9b9b', brightCyan:    '#3aafaf',
  white:         '#4a443c', brightWhite:   '#1c1814',
}

function getCssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function resolveTheme(terminalTheme: string, appTheme: string) {
  // Named preset takes priority for ANSI colors, foreground, etc.
  const preset = TERMINAL_THEMES.find(t => t.id === terminalTheme)
  const base = preset ? preset.theme : (appTheme === 'light' ? LIGHT_THEME : DARK_THEME)

  // Always sync background + cursor to the live UI preset values
  const accent = getCssVar('--accent') || base.cursor
  const bg0    = getCssVar('--bg-0')   || base.background
  const fg0    = getCssVar('--fg-0')   || base.foreground

  return {
    ...base,
    background:          bg0,
    foreground:          fg0,
    cursor:              accent,
    cursorAccent:        bg0,
    selectionBackground: accent + '44',
  }
}

const TERMINAL_FONT_MAP: Record<string, string> = {
  jetbrains: '"JetBrains Mono", "Cascadia Code", Menlo, monospace',
  cascadia:  '"Cascadia Code", "JetBrains Mono", monospace',
  fira:      '"Fira Code", "JetBrains Mono", monospace',
  menlo:     'Menlo, Monaco, monospace',
  sfmono:    '"SF Mono", Menlo, monospace',
  monaco:    'Monaco, "Courier New", monospace',
  courier:   '"Courier New", Courier, monospace',
  system:    'monospace',
}

// Strip ANSI escape sequences for marker detection
function stripAnsi(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*[A-Za-z]|\x1b\][^\x07]*\x07|\x1b[()][AB012]|\r/g, '')
}

export function XTermPane({ sessionId, cmd, args, cwd }: Props) {
  const containerRef      = useRef<HTMLDivElement>(null)
  const appTheme              = useAppStore(s => s.theme)
  const accent                = useAppStore(s => s.accent)
  const preset                = useAppStore(s => s.preset)
  const terminalTheme         = useAppStore(s => s.terminalTheme)
  const customTerminalColors  = useAppStore(s => s.customTerminalColors)
  const terminalFontFamily = useAppStore(s => s.terminalFontFamily)
  const terminalFontSize   = useAppStore(s => s.terminalFontSize)
  const updateSession     = useAppStore(s => s.updateSession)
  const sessionKind       = useAppStore(s =>
    s.projects.flatMap(p => p.sessions).find(sess => sess.id === sessionId)?.kind ?? 'single')
  const termRef = useRef<Terminal | null>(null)
  // Rolling buffer for crew marker detection across chunk boundaries
  const crewBufRef = useRef('')
  // Persistent code-block state across WebSocket chunks (crew sessions only)
  const inCodeBlockRef = useRef(false)
  // Tracks current active agent name for contextual done messages
  const inAgentRef = useRef('')
  // Tracks whether we're inside scraped web content (to compact it)
  const inScrapeRef = useRef(false)
  // Tracks whether we're inside a green result block from the Orchestrator
  const inResultRef = useRef(false)
  // Meta buffer: stores tokens + output preview per agent (keyed by role_underscore)
  const crewMetaRef = useRef<Record<string, { tokens: number; output: string; task?: string }>>({})
  // History buffer for mirror replay (raw data, capped at 200 KB)
  const historyBufRef = useRef('')

  // Apply colour theme live
  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.theme = { ...resolveTheme(terminalTheme, appTheme), ...customTerminalColors }
    }
  }, [terminalTheme, appTheme, accent, preset, customTerminalColors])

  // Apply font family + size live
  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.fontFamily = TERMINAL_FONT_MAP[terminalFontFamily] ?? TERMINAL_FONT_MAP.jetbrains
      termRef.current.options.fontSize   = terminalFontSize
    }
  }, [terminalFontFamily, terminalFontSize])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const term = new Terminal({
      fontFamily: TERMINAL_FONT_MAP[terminalFontFamily] ?? TERMINAL_FONT_MAP.jetbrains,
      fontSize: terminalFontSize,
      lineHeight: 1.4,
      theme: { ...resolveTheme(terminalTheme, appTheme), ...customTerminalColors },
      cursorBlink: true,
      scrollback: 10000,
      allowTransparency: false,
    })
    termRef.current = term

    const fit = new FitAddon()
    const webLinks = new WebLinksAddon()
    term.loadAddon(fit)
    term.loadAddon(webLinks)
    term.open(el)

    // ── Fit-before-init strategy ──────────────────────────────────────────────
    // We must NOT send the PTY 'init' until xterm has been fit to real
    // dimensions.  If the container still has height=0 (e.g. CrewBar mounting
    // simultaneously pushes the flex layout around), calling fit.fit() would
    // call terminal.resize(cols, 0) which corrupts the canvas and shows black.
    //
    // Solution: keep retrying until clientHeight > 0, then fit, then send init.
    // The WebSocket connection is opened immediately so there's no extra latency.

    let fitAttempts = 0
    let wsReady = false          // true once ws.onopen fires
    let initSent = false         // true once we've sent the PTY 'init' msg

    const sendInit = (ws: WebSocket) => {
      if (initSent || ws.readyState !== WebSocket.OPEN) return
      initSent = true
      ws.send(JSON.stringify({ type: 'init', cmd, args, cwd, cols: term.cols, rows: term.rows }))
    }

    const MAX_FIT_ATTEMPTS = 20
    const FIT_INTERVALS = [50, 100, 150, 200, 300, 450, 650, 900, 1300, 1800]
    const tryFit = (ws: WebSocket) => {
      fitAttempts++
      const h = el.clientHeight
      const w = el.clientWidth
      if (h > 0 && w > 0) {
        fit.fit()
        term.refresh(0, term.rows - 1)
        term.focus()
        // Send PTY init now that we have real dimensions
        if (wsReady) sendInit(ws)
        // One extra refit 200ms later to catch any remaining layout shift
        setTimeout(() => { fit.fit(); term.refresh(0, term.rows - 1) }, 200)
        return
      }
      // Still no dimensions — retry
      if (fitAttempts < MAX_FIT_ATTEMPTS) {
        const delay = FIT_INTERVALS[Math.min(fitAttempts - 1, FIT_INTERVALS.length - 1)]
        setTimeout(() => tryFit(ws), delay)
      } else {
        // Give up waiting — send init with whatever size we have as fallback
        if (wsReady) sendInit(ws)
      }
    }

    // ── WebSocket ─────────────────────────────────────────────────────────────
    const wsHost = window.location.host
    const ws = new WebSocket(
      `ws://${wsHost}/ws/terminal?sessionId=${encodeURIComponent(sessionId)}`
    )

    ws.onopen = () => {
      wsReady = true
      // If tryFit already succeeded, send init immediately; otherwise tryFit
      // will call sendInit when dimensions are available.
      if (initSent === false && term.rows > 0) sendInit(ws)
    }

    // Start trying to fit — passes ws reference so it can send init when ready
    requestAnimationFrame(() => tryFit(ws))

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as Record<string, unknown>
        if (msg.type === 'data') {
          const rawData = String(msg.data)
          const data = sessionKind === 'crew'
            ? crewDisplayFilter(rawData, inCodeBlockRef, inAgentRef, inScrapeRef, inResultRef, accent)
            : rawData
          term.write(data)
          // Accumulate history for late-mounting mirror terminals
          historyBufRef.current += data
          if (historyBufRef.current.length > 200_000) {
            historyBufRef.current = historyBufRef.current.slice(-200_000)
          }
          // Broadcast raw data for mirror terminals (e.g. Crew tab in UtilityPanel)
          window.dispatchEvent(new CustomEvent('cc:terminal-data', { detail: { sessionId, data } }))
          // Crew monitor: buffer raw (pre-transform) data so markers are still detectable
          crewBufRef.current += stripAnsi(rawData)
          // Keep buffer bounded — only last 2000 chars matter
          if (crewBufRef.current.length > 12000) {
            crewBufRef.current = crewBufRef.current.slice(-12000)
          }
          // Top-level run-start marker — unambiguous signal that a new crew execution began
          const runStartRe = /###CREW_RUN_START:([A-Za-z0-9+/=]*)###/g
          let rsm: RegExpExecArray | null
          const runStartMatches: RegExpExecArray[] = []
          while ((rsm = runStartRe.exec(crewBufRef.current)) !== null) runStartMatches.push(rsm)
          if (runStartMatches.length > 0) {
            crewBufRef.current = crewBufRef.current.replace(/###CREW_RUN_START:[A-Za-z0-9+/=]*###/g, '')
            const last = runStartMatches[runStartMatches.length - 1]
            let userInput: string | undefined
            try { userInput = last[1] ? atob(last[1]) : undefined } catch { /* ignore */ }
            window.dispatchEvent(new CustomEvent('cc:crew-run-start', { detail: { sessionId, userInput } }))
          }
          // Parse META markers first (tokens + output preview) before start/done
          const metaRe = /###CREW_META:([^:#\s]+):([^:#\s]+):(\d+):([A-Za-z0-9+/=]*):([A-Za-z0-9+/=]*)###/g
          let m: RegExpExecArray | null
          const metaFound: RegExpExecArray[] = []
          while ((m = metaRe.exec(crewBufRef.current)) !== null) metaFound.push(m)
          for (const match of metaFound) {
            try {
              crewMetaRef.current[match[1]] = {
                tokens: parseInt(match[3]),
                output: atob(match[4]),
                task: match[5] ? atob(match[5]) : undefined,
              }
            } catch { /* ignore */ }
          }
          if (metaFound.length > 0) {
            crewBufRef.current = crewBufRef.current.replace(/###CREW_META:[^#]*###/g, '')
          }
          // Find all start/done markers in buffer, dispatch events, then remove them
          // Total tokens after kickoff (includes manager + all agents)
          const totalTokRe = /###CREW_TOTAL_TOKENS:(\d+)###/g
          const totalTokFound: RegExpExecArray[] = []
          while ((m = totalTokRe.exec(crewBufRef.current)) !== null) totalTokFound.push(m)
          if (totalTokFound.length > 0) {
            crewBufRef.current = crewBufRef.current.replace(/###CREW_TOTAL_TOKENS:\d+###/g, '')
            const last = totalTokFound[totalTokFound.length - 1]
            window.dispatchEvent(new CustomEvent('cc:crew-total-tokens', { detail: { sessionId, totalTokens: parseInt(last[1]) } }))
          }
          // Error marker
          const errRe = /###CREW_ERROR:([A-Za-z0-9+/=]+):([A-Za-z0-9+/=]*)###/g
          const errFound: RegExpExecArray[] = []
          while ((m = errRe.exec(crewBufRef.current)) !== null) errFound.push(m)
          if (errFound.length > 0) {
            crewBufRef.current = crewBufRef.current.replace(/###CREW_ERROR:[^#]*###/g, '')
            const last = errFound[errFound.length - 1]
            try {
              const msg2 = atob(last[1])
              const tb   = last[2] ? atob(last[2]) : ''
              window.dispatchEvent(new CustomEvent('cc:crew-error', { detail: { sessionId, message: msg2, traceback: tb } }))
            } catch { /* ignore */ }
          }
          const markerRe = /###CREW:([^:#\s]+):([^:#\s]+):(start|done|step)(?::[A-Za-z0-9+/=]*)?###/g
          const found: RegExpExecArray[] = []
          while ((m = markerRe.exec(crewBufRef.current)) !== null) found.push(m)
          if (found.length > 0) {
            // Remove everything up to and including the last found marker
            crewBufRef.current = crewBufRef.current.slice(found[found.length - 1].index + found[found.length - 1][0].length)
            for (const match of found) {
              const meta = crewMetaRef.current[match[1]]
              window.dispatchEvent(new CustomEvent('cc:crew-event', {
                detail: { sessionId, agent: match[1].replace(/_/g, ' '), model: match[2], status: match[3], tokens: meta?.tokens, output: meta?.output, task: meta?.task }
              }))
            }
          }
          // Detect runtime errors in raw PTY output and surface them in the right panel
          if (sessionKind === 'crew') {
            const plain = stripAnsi(rawData)
            const errMatch =
              plain.match(/^ERROR:[A-Za-z._]+:\s*(.{1,200})/m) ??
              plain.match(/^Error[: ]\s*(.{1,200})/m)
            if (errMatch) {
              const msg2 = errMatch[0]
                .replace(/^ERROR:[A-Za-z._]+:\s*/, '')
                .replace(/^Error[^:]*:\s*/, '')
                .slice(0, 200)
              window.dispatchEvent(new CustomEvent('cc:crew-error', {
                detail: { sessionId, message: msg2, traceback: '' }
              }))
            }
          }
        }
        if (msg.type === 'exit') {
          const code = Number(msg.exitCode)
          if (code === 0) {
            term.write(`\r\n\x1b[32m✓ exited cleanly\x1b[0m\r\n`)
            updateSession(sessionId, { status: 'exited' })
          } else {
            term.write(`\r\n\x1b[31m✗ exited with code ${code}\x1b[0m\r\n`)
            updateSession(sessionId, { status: 'error' })
          }
        }
      } catch { /* ignore malformed frames */ }
    }

    ws.onclose = () => term.write('\r\n\x1b[38;5;244m[disconnected]\x1b[0m\r\n')
    ws.onerror = () => term.write('\r\n\x1b[31m[connection error — is the dev server running on this port?]\x1b[0m\r\n')

    // Keyboard → server
    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN)
        ws.send(JSON.stringify({ type: 'input', data }))
    })

    // Resize → server
    term.onResize(({ cols, rows }) => {
      if (ws.readyState === WebSocket.OPEN)
        ws.send(JSON.stringify({ type: 'resize', cols, rows }))
    })

    // Text paste from InputArea — detail is { sessionId, data }
    const onPaste = (e: Event) => {
      const { sessionId: sid, data: text } = (e as CustomEvent<{ sessionId: string; data: string }>).detail
      if (sid !== sessionId) return
      if (ws.readyState === WebSocket.OPEN)
        ws.send(JSON.stringify({ type: 'input', data: text + '\r' }))
    }
    window.addEventListener('cc:terminal-paste', onPaste)

    // Raw input (e.g. Ctrl+C = '\x03') from InputArea — detail is { sessionId, data }
    const onRaw = (e: Event) => {
      const { sessionId: sid, data } = (e as CustomEvent<{ sessionId: string; data: string }>).detail
      if (sid !== sessionId) return
      if (ws.readyState === WebSocket.OPEN)
        ws.send(JSON.stringify({ type: 'input', data }))
    }
    window.addEventListener('cc:terminal-send-raw', onRaw)

    // Export terminal buffer as plain text
    const onExportRequest = (e: Event) => {
      const sid = (e as CustomEvent<string>).detail
      if (sid !== sessionId) return
      const buf = term.buffer.active
      const lines: string[] = []
      for (let i = 0; i < buf.length; i++) {
        lines.push(buf.getLine(i)?.translateToString(true) ?? '')
      }
      // Trim trailing blank lines
      while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop()
      window.dispatchEvent(new CustomEvent('cc:terminal-text', { detail: lines.join('\n') }))
    }
    window.addEventListener('cc:terminal-export', onExportRequest)

    // Mirror replay — when a CrewTerminalMirror mounts it asks for our history
    const onReplayRequest = (e: Event) => {
      const sid = (e as CustomEvent<string>).detail
      if (sid !== sessionId) return
      window.dispatchEvent(new CustomEvent('cc:terminal-replay', {
        detail: { sessionId, data: historyBufRef.current }
      }))
    }
    window.addEventListener('cc:terminal-replay-request', onReplayRequest)

    // Refit whenever the panel resizes — also guard against zero-size frames
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        if (el.clientHeight > 0 && el.clientWidth > 0) {
          fit.fit()
          term.refresh(0, term.rows - 1)
        }
      })
    })
    ro.observe(el)

    // Re-render xterm when window regains focus (e.g. after native OS dialogs)
    const onWindowFocus = () => {
      requestAnimationFrame(() => {
        if (el.clientHeight > 0) { fit.fit(); term.refresh(0, term.rows - 1) }
      })
    }
    window.addEventListener('focus', onWindowFocus)

    // Force repaint after any in-app overlay closes (modals, pickers, etc.)
    // Re-run tryFit so we keep retrying until layout is settled.
    const onRefresh = () => {
      fitAttempts = 0
      requestAnimationFrame(() => tryFit(ws))
    }
    window.addEventListener('cc:terminal-refresh', onRefresh)

    return () => {
      termRef.current = null
      ro.disconnect()
      window.removeEventListener('focus', onWindowFocus)
      window.removeEventListener('cc:terminal-refresh', onRefresh)
      window.removeEventListener('cc:terminal-paste', onPaste)
      window.removeEventListener('cc:terminal-send-raw', onRaw)
      window.removeEventListener('cc:terminal-export', onExportRequest)
      window.removeEventListener('cc:terminal-replay-request', onReplayRequest)
      ws.close()
      term.dispose()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  return (
    <div
      ref={containerRef}
      onClick={() => termRef.current?.focus()}
      style={{
        flex: 1,
        minHeight: 0,
        height: '100%',
        padding: '6px 4px',
        background: resolveTheme(terminalTheme, appTheme).background,
        overflow: 'hidden',
        boxSizing: 'border-box',
        cursor: 'text',
      }}
    />
  )
}
