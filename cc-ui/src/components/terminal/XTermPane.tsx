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

function resolveTheme(terminalTheme: string, appTheme: string) {
  // Named preset takes priority
  const preset = TERMINAL_THEMES.find(t => t.id === terminalTheme)
  if (preset) return preset.theme
  // Fallback: use built-in dark/light
  return appTheme === 'light' ? LIGHT_THEME : DARK_THEME
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

export function XTermPane({ sessionId, cmd, args, cwd }: Props) {
  const containerRef      = useRef<HTMLDivElement>(null)
  const appTheme          = useAppStore(s => s.theme)
  const terminalTheme     = useAppStore(s => s.terminalTheme)
  const terminalFontFamily = useAppStore(s => s.terminalFontFamily)
  const terminalFontSize   = useAppStore(s => s.terminalFontSize)
  const updateSession     = useAppStore(s => s.updateSession)
  const termRef = useRef<Terminal | null>(null)

  // Apply colour theme live
  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.theme = resolveTheme(terminalTheme, appTheme)
    }
  }, [terminalTheme, appTheme])

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
      theme: resolveTheme(terminalTheme, appTheme),
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

    // Fit after layout is resolved; also retry 150 ms later for safety
    requestAnimationFrame(() => {
      fit.fit()
      setTimeout(() => fit.fit(), 150)
    })

    // ── WebSocket ─────────────────────────────────────────────────────────────
    // Use window.location.host so the WS always hits the same server that
    // served this page, regardless of which port Vite is on.
    const wsHost = window.location.host   // e.g. "localhost:5174"
    const ws = new WebSocket(
      `ws://${wsHost}/ws/terminal?sessionId=${encodeURIComponent(sessionId)}`
    )

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'init',
        cmd,
        args,
        cwd,
        cols: term.cols,
        rows: term.rows,
      }))
    }

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as Record<string, unknown>
        if (msg.type === 'data') {
          term.write(String(msg.data))
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

    // Text paste from InputArea
    const onPaste = (e: Event) => {
      const text = (e as CustomEvent<string>).detail
      if (ws.readyState === WebSocket.OPEN)
        ws.send(JSON.stringify({ type: 'input', data: text + '\r' }))
    }
    window.addEventListener('cc:terminal-paste', onPaste)

    // Raw input (e.g. Ctrl+C = '\x03') from InputArea
    const onRaw = (e: Event) => {
      const data = (e as CustomEvent<string>).detail
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

    // Refit whenever the panel resizes
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(() => fit.fit())
    })
    ro.observe(el)

    return () => {
      termRef.current = null
      ro.disconnect()
      window.removeEventListener('cc:terminal-paste', onPaste)
      window.removeEventListener('cc:terminal-send-raw', onRaw)
      window.removeEventListener('cc:terminal-export', onExportRequest)
      ws.close()
      term.dispose()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        minHeight: 0,
        height: '100%',
        padding: '6px 4px',
        background: resolveTheme(terminalTheme, appTheme).background,
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    />
  )
}
