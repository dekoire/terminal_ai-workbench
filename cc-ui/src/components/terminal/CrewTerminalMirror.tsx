import React, { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { useAppStore } from '../../store/useAppStore'
import { TERMINAL_THEMES } from '../../theme/presets'

// Resolve the same theme logic as XTermPane (lightweight copy)
function resolveTheme(terminalTheme: string, appTheme: string) {
  if (terminalTheme !== 'match-app') return TERMINAL_THEMES[terminalTheme] ?? TERMINAL_THEMES['dark']
  return appTheme === 'light' ? TERMINAL_THEMES['light'] : TERMINAL_THEMES['dark']
}

interface Props {
  sessionId: string
}

/**
 * Read-only xterm.js mirror of an existing PTY session.
 * Receives data via the `cc:terminal-data` custom event broadcast by XTermPane
 * — no second WebSocket/PTY connection needed.
 */
export function CrewTerminalMirror({ sessionId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef      = useRef<Terminal | null>(null)
  const fitRef       = useRef<FitAddon | null>(null)
  const appTheme          = useAppStore(s => s.theme)
  const terminalTheme     = useAppStore(s => s.terminalTheme)
  const terminalFontFamily = useAppStore(s => s.terminalFontFamily)
  const terminalFontSize   = useAppStore(s => s.terminalFontSize)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const FONT_MAP: Record<string, string> = {
      jetbrains:  '"JetBrains Mono", "Cascadia Code", monospace',
      cascadia:   '"Cascadia Code", "Fira Code", monospace',
      firacode:   '"Fira Code", monospace',
      menlo:      'Menlo, Monaco, monospace',
      sfmono:     '"SF Mono", Menlo, monospace',
      monaco:     'Monaco, "Courier New", monospace',
      courier:    '"Courier New", Courier, monospace',
      system:     'monospace',
    }

    const term = new Terminal({
      fontFamily: FONT_MAP[terminalFontFamily] ?? FONT_MAP.jetbrains,
      fontSize: Math.max(10, terminalFontSize - 1), // slightly smaller than main
      lineHeight: 1.35,
      theme: resolveTheme(terminalTheme, appTheme),
      cursorBlink: false,
      scrollback: 5000,
      allowTransparency: false,
      disableStdin: true, // read-only
    })
    termRef.current = term

    const fit = new FitAddon()
    fitRef.current = fit
    term.loadAddon(fit)
    term.open(el)

    requestAnimationFrame(() => { fit.fit() })

    // Resize observer to refit when the panel resizes
    const ro = new ResizeObserver(() => { fit.fit() })
    ro.observe(el)

    // Receive data from XTermPane broadcasts
    const handler = (e: Event) => {
      const { sessionId: sid, data } = (e as CustomEvent<{ sessionId: string; data: string }>).detail
      if (sid !== sessionId) return
      term.write(data)
      term.scrollToBottom()
    }
    window.addEventListener('cc:terminal-data', handler)

    // Replay handler — receives historical data from XTermPane on mount
    const replayHandler = (e: Event) => {
      const { sessionId: sid, data } = (e as CustomEvent<{ sessionId: string; data: string }>).detail
      if (sid !== sessionId) return
      if (data) {
        term.write(data)
        term.scrollToBottom()
      }
    }
    window.addEventListener('cc:terminal-replay', replayHandler)

    // Ask XTermPane to send its history — small delay lets the listeners register first
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('cc:terminal-replay-request', { detail: sessionId }))
    }, 50)

    return () => {
      window.removeEventListener('cc:terminal-data', handler)
      window.removeEventListener('cc:terminal-replay', replayHandler)
      ro.disconnect()
      term.dispose()
      termRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  // Update theme live
  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.theme = resolveTheme(terminalTheme, appTheme)
    }
  }, [terminalTheme, appTheme])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', overflow: 'hidden' }}
    />
  )
}
