import React, { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import { useAppStore } from '../../store/useAppStore'
import { TERMINAL_THEMES } from '../../theme/presets'

interface TerminalChatPanelProps {
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

function getCssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function resolveTheme(terminalTheme: string, appTheme: string) {
  const preset = TERMINAL_THEMES.find(t => t.id === terminalTheme)
  const base   = preset ? preset.theme : (appTheme === 'light' ? LIGHT_THEME : DARK_THEME)
  const accent = getCssVar('--accent') || base.cursor
  const bg0    = getCssVar('--bg-0')   || base.background
  const fg0    = getCssVar('--fg-0')   || base.foreground
  return { ...base, background: bg0, foreground: fg0, cursor: accent, cursorAccent: bg0, selectionBackground: accent + '44' }
}

export function TerminalChatPanel({ sessionId, cmd, args, cwd }: TerminalChatPanelProps) {
  const containerRef         = useRef<HTMLDivElement>(null)
  const appTheme             = useAppStore(s => s.theme)
  const terminalTheme        = useAppStore(s => s.terminalTheme)
  const customTerminalColors = useAppStore(s => s.customTerminalColors)
  const terminalFontFamily   = useAppStore(s => s.terminalFontFamily)
  const terminalFontSize     = useAppStore(s => s.terminalFontSize)
  const updateSession        = useAppStore(s => s.updateSession)
  const termRef              = useRef<Terminal | null>(null)

  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.theme = { ...resolveTheme(terminalTheme, appTheme), ...customTerminalColors }
    }
  }, [terminalTheme, appTheme, customTerminalColors])

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

    const fit      = new FitAddon()
    const webLinks = new WebLinksAddon()
    term.loadAddon(fit)
    term.loadAddon(webLinks)
    term.open(el)

    let fitAttempts = 0
    let wsReady     = false
    let initSent    = false

    let ws: WebSocket
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let destroyed = false

    const sendInit = () => {
      if (initSent || ws.readyState !== WebSocket.OPEN) return
      initSent = true
      ws.send(JSON.stringify({ type: 'init', cmd, args, cwd, cols: term.cols, rows: term.rows }))
    }

    const FIT_INTERVALS = [50, 100, 150, 200, 300, 450, 650, 900, 1300, 1800]
    const tryFit = () => {
      fitAttempts++
      const h = el.clientHeight, w = el.clientWidth
      if (h > 0 && w > 0) {
        fit.fit()
        term.refresh(0, term.rows - 1)
        term.focus()
        if (wsReady) sendInit()
        setTimeout(() => { fit.fit(); term.refresh(0, term.rows - 1) }, 200)
        return
      }
      if (fitAttempts < 20) {
        setTimeout(tryFit, FIT_INTERVALS[Math.min(fitAttempts - 1, FIT_INTERVALS.length - 1)])
      } else {
        if (wsReady) sendInit()
      }
    }

    const connect = () => {
      ws = new WebSocket(`ws://${window.location.host}/ws/terminal?sessionId=${encodeURIComponent(sessionId)}`)

      ws.onopen = () => {
        wsReady = true
        sendInit()
        if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
      }

      ws.onmessage = handleMessage

      ws.onclose = () => {
        if (termRef.current) term.write('\r\n\x1b[38;5;244m[reconnecting…]\x1b[0m\r\n')
        if (!destroyed) reconnectTimer = setTimeout(connect, 1500)
      }

      ws.onerror = () => {
        if (termRef.current) term.write('\r\n\x1b[31m[connection error]\x1b[0m\r\n')
      }
    }

    requestAnimationFrame(tryFit)
    connect()

    // ── Popup-Marker Erkennung ────────────────────────────────────────────────
    const ANSI_STRIP = /\x1b\[[0-9;?]*[a-zA-Z]|\x1b[()][B0-9]|\r/g
    const POPUP_RE   = /\[(POPUP_REQUIRED|ACTION_REQUIRED[^\]]*|NEEDS_INTERACTION|AWAITING_USER_ACTION|DIALOG_OPEN)\]/i
    let   ptybuf     = ''
    let   popupTimer: ReturnType<typeof setTimeout> | null = null

    function firePopup() {
      popupTimer = null
      if (!POPUP_RE.test(ptybuf)) return
      const title   = ptybuf.match(/(?:Title|Titel):\s*"?([^"\n]{2,80})"?/i)?.[1]?.trim() ?? 'Aktion erforderlich'
      const message = ptybuf.match(/(?:Message|Nachricht|Content|Inhalt):\s*"?([^"\n]{2,300})"?/i)?.[1]?.trim() ?? ''
      const type    = ptybuf.match(/Type:\s*([a-z]+)/i)?.[1]?.toLowerCase() ?? 'alert'
      const bMatch  = ptybuf.match(/Buttons?:\s*\[([^\]]{2,400})\]/i)
      const buttons = bMatch
        ? bMatch[1].split(',').map(b => b.replace(/["']/g, '').trim()).filter(Boolean)
        : ['OK', 'Abbrechen']
      window.dispatchEvent(new CustomEvent('cc:popup', { detail: { sessionId, title, message, type, buttons } }))
      ptybuf = ''
    }

    // Shared message handler — assigned to each ws on connect/reconnect
    function handleMessage(e: MessageEvent) {
      try {
        const msg = JSON.parse(e.data as string) as Record<string, unknown>
        if (msg.type === 'data') {
          const raw = String(msg.data)
          term.write(raw)
          ptybuf = (ptybuf + raw.replace(ANSI_STRIP, '')).slice(-3000)
          if (popupTimer) clearTimeout(popupTimer)
          popupTimer = setTimeout(firePopup, 300)
        }
        if (msg.type === 'exit') {
          if (popupTimer) clearTimeout(popupTimer)
          const code = Number(msg.exitCode)
          if (code === 0) { term.write('\r\n\x1b[32m✓ exited cleanly\x1b[0m\r\n'); updateSession(sessionId, { status: 'exited' }) }
          else            { term.write(`\r\n\x1b[31m✗ exited with code ${code}\x1b[0m\r\n`); updateSession(sessionId, { status: 'error' }) }
        }
      } catch {}
    }

    // Register input/resize once — ws variable is always current (let binding)
    term.onData(data => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'input', data })) })
    term.onResize(({ cols, rows }) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'resize', cols, rows })) })

    const onPaste = (e: Event) => {
      const { sessionId: sid, data } = (e as CustomEvent<{ sessionId: string; data: string }>).detail
      if (sid !== sessionId) return
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'input', data: data + '\r' }))
    }
    const onRaw = (e: Event) => {
      const { sessionId: sid, data } = (e as CustomEvent<{ sessionId: string; data: string }>).detail
      if (sid !== sessionId) return
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'input', data }))
    }
    const onExport = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== sessionId) return
      const buf   = term.buffer.active
      const lines: string[] = []
      for (let i = 0; i < buf.length; i++) lines.push(buf.getLine(i)?.translateToString(true) ?? '')
      while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop()
      window.dispatchEvent(new CustomEvent('cc:terminal-text', { detail: lines.join('\n') }))
    }
    window.addEventListener('cc:terminal-paste', onPaste)
    window.addEventListener('cc:terminal-send-raw', onRaw)
    window.addEventListener('cc:terminal-export', onExport)

    const ro = new ResizeObserver(() => requestAnimationFrame(() => {
      if (el.clientHeight > 0 && el.clientWidth > 0) { fit.fit(); term.refresh(0, term.rows - 1) }
    }))
    ro.observe(el)

    const onFocus   = () => requestAnimationFrame(() => { if (el.clientHeight > 0) { fit.fit(); term.refresh(0, term.rows - 1) } })
    const onRefresh = () => { fitAttempts = 0; requestAnimationFrame(tryFit) }
    window.addEventListener('focus', onFocus)
    window.addEventListener('cc:terminal-refresh', onRefresh)

    return () => {
      termRef.current = null
      if (popupTimer) clearTimeout(popupTimer)
      ro.disconnect()
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('cc:terminal-refresh', onRefresh)
      window.removeEventListener('cc:terminal-paste', onPaste)
      window.removeEventListener('cc:terminal-send-raw', onRaw)
      window.removeEventListener('cc:terminal-export', onExport)
      destroyed = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
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
        position: 'absolute', inset: 0,
        padding: '6px 4px',
        background: resolveTheme(terminalTheme, appTheme).background,
        overflow: 'hidden', boxSizing: 'border-box', cursor: 'text',
      }}
    />
  )
}
