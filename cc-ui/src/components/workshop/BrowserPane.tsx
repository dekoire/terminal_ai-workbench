/**
 * BrowserPane — iframe browser with URL bar + unified mode toolbar.
 * Draw mode shows an integrated sub-toolbar (Speichern / Abbrechen + drawing tools).
 * DrawCanvas is positioned inside the iframe container so pointer coords are correct.
 *
 * Anforderung: In dark mode the browser chrome uses light colours (and vice versa)
 * so the embedded browser is visually distinct from the rest of the UI.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { WorkshopElementRef } from '../../store/useAppStore'
import { useAppStore } from '../../store/useAppStore'
import {
  IChevLeft, IEdit, IMousePointer, IMousePointerClick, ISave, IClose, IEraser,
  IUndo, ITrash, IRefresh, ICamera, IMessageSquare, IGlobe,
} from '../primitives/Icons'
import { DrawCanvas } from './DrawCanvas'
import type { DrawCanvasHandle, DrawTool } from './DrawCanvas'
import { ScreenshotCrop } from './ScreenshotCrop'

const DRAW_TOOLS: { id: DrawTool; label: string }[] = [
  { id: 'pen',    label: 'Stift' },
  { id: 'eraser', label: 'Radierer' },
  { id: 'text',   label: 'Text' },
]

export type BrowserMode = 'normal' | 'draw' | 'inspect'

const COLOR_PRESETS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#ffffff', '#000000']

interface Props {
  mode: BrowserMode
  onModeChange: (m: BrowserMode) => void
  onElementCaptured: (ref: WorkshopElementRef) => void
  onScreenshot: (dataUrl: string) => void
  /** Pre-filled URL from the active project's appPort. Empty = show placeholder. */
  initialUrl?: string
}

// ── Inject inspect script into iframe ────────────────────────────────────────
function injectInspect(doc: Document, onCapture: (r: WorkshopElementRef) => void): () => void {
  const win = doc.defaultView!

  // ── Overlay fill div (transparent red, no border) ────────────────────────
  const overlay = doc.createElement('div')
  overlay.style.cssText = [
    'position:fixed', 'pointer-events:none', 'z-index:2147483646',
    'background:rgba(139,92,246,0.45)', 'border:2px solid rgba(139,92,246,0.9)', 'border-radius:4px',
    'transition:top .06s,left .06s,width .06s,height .06s',
    'display:none',
  ].join(';')
  doc.body.appendChild(overlay)

  // ── Info badge shown above the hovered element ───────────────────────────
  const badge = doc.createElement('div')
  badge.style.cssText = [
    'position:fixed', 'pointer-events:none', 'z-index:2147483647',
    'background:rgba(15,15,15,0.88)', 'color:#fff',
    'font:600 11px/1.4 ui-monospace,monospace',
    'padding:3px 7px', 'border-radius:4px',
    'white-space:nowrap', 'display:none',
    'backdrop-filter:blur(4px)',
  ].join(';')
  doc.body.appendChild(badge)

  const positionOverlay = (el: HTMLElement) => {
    const r = el.getBoundingClientRect()
    overlay.style.display = 'block'
    overlay.style.left   = r.left   + 'px'
    overlay.style.top    = r.top    + 'px'
    overlay.style.width  = r.width  + 'px'
    overlay.style.height = r.height + 'px'

    // Badge content
    const tag    = el.tagName.toLowerCase()
    const idPart = el.id ? '#' + el.id : ''
    const clsPart = [...el.classList].slice(0, 3).map(c => '.' + c).join('')
    const ident  = (idPart + clsPart) || ''
    const size = `${Math.round(r.width)}×${Math.round(r.height)}`
    // React component name
    let compName: string | undefined
    try {
      const fk = Object.keys(el).find(k => k.startsWith('__reactFiber'))
      if (fk) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let f = (el as any)[fk]
        while (f) { if (f.type?.name) { compName = f.type.name; break }; f = f.return }
      }
    } catch {}
    badge.textContent = [compName ?? tag, ident, size].filter(Boolean).join('  ·  ')

    // Position badge above element; clamp to viewport
    badge.style.display = 'block'
    const bRect = badge.getBoundingClientRect()
    const bTop  = r.top - bRect.height - 6
    badge.style.top  = (bTop < 4 ? r.bottom + 4 : bTop) + 'px'
    badge.style.left = Math.min(Math.max(r.left, 4), win.innerWidth - bRect.width - 4) + 'px'
  }

  const clearOverlay = () => {
    overlay.style.display = 'none'
    badge.style.display   = 'none'
  }

  const onMove = (e: MouseEvent) => {
    const el = e.target as HTMLElement
    if (el === overlay || el === badge) return
    positionOverlay(el)
  }

  const onClick = (e: MouseEvent) => {
    if (!e.shiftKey) return
    e.preventDefault(); e.stopPropagation()
    const el = e.target as HTMLElement

    // ── React component name ────────────────────────────────────────────────
    let component: string | undefined
    try {
      const fk = Object.keys(el).find(k => k.startsWith('__reactFiber'))
      if (fk) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let f = (el as any)[fk]
        while (f) { if (f.type?.name) { component = f.type.name; break }; f = f.return }
      }
    } catch {}

    const classes  = [...el.classList].slice(0, 5)
    const selector = el.id ? '#' + el.id : classes.length ? '.' + classes[0] : el.tagName.toLowerCase()
    const page     = doc.title?.trim() || win.location.pathname.split('/').filter(Boolean).pop() || win.location.pathname || 'unbekannt'

    const rect = el.getBoundingClientRect()
    const vw = win.innerWidth, vh = win.innerHeight
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2
    const hPos = cx < vw * 0.33 ? 'links' : cx < vw * 0.67 ? 'mitte' : 'rechts'
    const vPos = cy < vh * 0.33 ? 'oben'  : cy < vh * 0.67 ? 'mitte' : 'unten'
    const position = vPos === 'mitte' && hPos === 'mitte' ? 'mitte' : vPos === hPos ? vPos : `${vPos} ${hPos}`

    const ancestors: string[] = []
    let parent = el.parentElement
    for (let i = 0; i < 2 && parent && parent.tagName !== 'BODY' && parent.tagName !== 'HTML'; i++, parent = parent.parentElement) {
      const pSel = parent.id ? '#' + parent.id : parent.classList[0] ? '.' + parent.classList[0] : parent.tagName.toLowerCase()
      ancestors.unshift(pSel)
    }
    const hierarchy = ancestors.length > 0 ? ancestors.join(' › ') + ' › ' + selector : undefined

    const rawText = el.textContent?.trim().replace(/\s+/g, ' ') ?? ''
    const text    = rawText.length > 15 ? rawText.slice(0, 15) + '…' : rawText || undefined

    onCapture({ tag: el.tagName.toLowerCase(), id: el.id, classes, text, component, selector, page, position, hierarchy })
    clearOverlay()
  }

  doc.addEventListener('mousemove', onMove)
  doc.addEventListener('mouseleave', clearOverlay)
  doc.addEventListener('click', onClick, true)
  return () => {
    clearOverlay()
    overlay.remove()
    badge.remove()
    doc.removeEventListener('mousemove', onMove)
    doc.removeEventListener('mouseleave', clearOverlay)
    doc.removeEventListener('click', onClick, true)
  }
}

// ── Server-side Playwright screenshot ────────────────────────────────────────
// Calls the Express /api/screenshot route which uses headless Chromium.
// Much more reliable than getDisplayMedia (no permissions, no black frames).
async function captureViaServer(url: string, width: number, height: number): Promise<string | null> {
  try {
    const resp = await fetch('/api/screenshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, width: Math.round(width) || 1280, height: Math.round(height) || 800 }),
    })
    const data: { ok: boolean; dataUrl?: string; error?: string } = await resp.json()
    if (data.ok && data.dataUrl) return data.dataUrl
    console.warn('[Workshop] Server screenshot failed:', data.error)
    return null
  } catch (err) {
    console.warn('[Workshop] Server screenshot fetch error:', err)
    return null
  }
}

export function BrowserPane({ mode, onModeChange, onElementCaptured, onScreenshot, initialUrl = '' }: Props) {
  // Only subscribe to `theme` — avoids re-rendering BrowserPane on every store change
  const theme = useAppStore(s => s.theme)
  const iframeRef      = useRef<HTMLIFrameElement>(null)
  const drawRef        = useRef<DrawCanvasHandle>(null)
  const cleanupInspect = useRef<(() => void) | null>(null)

  // Start with the project's app URL if known; otherwise blank (user enters manually)
  const [url, setUrl]           = useState(initialUrl)
  const [inputUrl, setInputUrl] = useState(initialUrl)
  const [error, setError]       = useState(false)
  const [loading, setLoading]   = useState(!!initialUrl) // show "Lädt…" if we have an initial URL

  // Draw sub-toolbar state
  const [drawTool,  setDrawTool]  = useState<DrawTool>('pen')
  const [drawColor, setDrawColor] = useState('#ef4444')
  const [drawSize,  setDrawSize]  = useState(4)

  // Screenshot crop modal
  const [snipData, setSnipData] = useState<string | null>(null)
  const [saving,   setSaving]   = useState(false)

  // ── Inverted browser chrome colours ─────────────────────────────────────────
  // Dark app theme → light browser chrome (so it looks like a real browser window)
  // Light app theme → dark browser chrome
  const bChrome: React.CSSProperties = theme === 'dark'
    ? { background: '#f0f0f0', borderColor: '#d0d0d0', color: '#1a1a1a' }
    : { background: '#1e1e1e', borderColor: '#3a3a3a', color: '#e0e0e0' }

  // ── Navigation ──────────────────────────────────────────────────────────────
  const navigate = useCallback((target: string) => {
    let u = target.trim()
    if (!u) { setUrl(''); setInputUrl(''); setError(false); return }
    if (!u.startsWith('http://') && !u.startsWith('https://') && !u.startsWith('/')) u = 'http://' + u
    setUrl(u); setInputUrl(u); setError(false); setLoading(true)
  }, [])

  const reload = () => { if (iframeRef.current && url) { setLoading(true); iframeRef.current.src = url } }
  const back   = () => { try { iframeRef.current?.contentWindow?.history.back()    } catch {} }
  const fwd    = () => { try { iframeRef.current?.contentWindow?.history.forward() } catch {} }

  // ── Inspect injection ───────────────────────────────────────────────────────
  useEffect(() => {
    if (cleanupInspect.current) { cleanupInspect.current(); cleanupInspect.current = null }
    if (mode !== 'inspect') return
    try {
      const doc = iframeRef.current?.contentDocument
      if (doc) cleanupInspect.current = injectInspect(doc, onElementCaptured)
    } catch { /* cross-origin — silently ignore */ }
  }, [mode, onElementCaptured, url])

  const onIframeLoad = useCallback(() => {
    setError(false); setLoading(false)
    try { const iwin = iframeRef.current?.contentWindow; if (iwin) setInputUrl(iwin.location.href) } catch {}
    if (mode === 'inspect') {
      if (cleanupInspect.current) cleanupInspect.current()
      try {
        const doc = iframeRef.current?.contentDocument
        if (doc) cleanupInspect.current = injectInspect(doc, onElementCaptured)
      } catch {}
    }
  }, [mode, onElementCaptured])

  // ── Draw: Speichern ──────────────────────────────────────────────────────────
  // Screenshots the current URL via Playwright, composites drawing strokes on top.
  const saveDraw = useCallback(async () => {
    const dc = drawRef.current
    if (!dc?.hasStrokes()) { onModeChange('normal'); return }

    setSaving(true)
    try {
      const iframe    = iframeRef.current
      const rect      = iframe?.getBoundingClientRect() ?? { width: 1280, height: 800 }
      const w         = Math.round(rect.width)  || 1280
      const h         = Math.round(rect.height) || 800

      // 1. Screenshot the current URL via headless Chromium
      const bgUrl = await captureViaServer(url, w, h)

      // 2. Get drawing strokes (transparent PNG at canvas resolution = w×h)
      const strokesUrl = await dc.screenshot()
      if (!strokesUrl) { onModeChange('normal'); return }

      // 3. Composite: page screenshot + drawing strokes
      const composite = document.createElement('canvas')
      composite.width = w; composite.height = h
      const ctx = composite.getContext('2d')!

      if (bgUrl) {
        await new Promise<void>(resolve => {
          const img = new Image()
          img.onload = () => { ctx.drawImage(img, 0, 0, w, h); resolve() }
          img.onerror = resolve; img.src = bgUrl
        })
      } else {
        ctx.fillStyle = '#f8f8f8'; ctx.fillRect(0, 0, w, h)
      }

      await new Promise<void>(resolve => {
        const img = new Image()
        img.onload = () => { ctx.drawImage(img, 0, 0, w, h); resolve() }
        img.onerror = resolve; img.src = strokesUrl
      })

      onScreenshot(composite.toDataURL('image/png'))
      dc.clear()
    } finally {
      setSaving(false)
      onModeChange('normal')
    }
  }, [onModeChange, onScreenshot, url])

  const cancelDraw = useCallback(() => {
    drawRef.current?.clear()
    onModeChange('normal')
  }, [onModeChange])

  // ── Screenshot button → captures via Playwright → opens ScreenshotCrop ──────
  const [screenshotError, setScreenshotError] = useState<string | null>(null)

  const takeScreenshot = useCallback(async () => {
    if (!url) return
    setScreenshotError(null)
    const iframe = iframeRef.current
    const rect   = iframe?.getBoundingClientRect() ?? { width: 1280, height: 800 }
    const w      = Math.round(rect.width)  || 1280
    const h      = Math.round(rect.height) || 800

    const captured = await captureViaServer(url, w, h)
    if (captured) { setSnipData(captured); return }

    setScreenshotError('Screenshot fehlgeschlagen. Ist die Seite erreichbar?')
  }, [url])

  // ── Button style helpers ──────────────────────────────────────────────────────
  const btnBase: React.CSSProperties = {
    background: 'none', border: 'none', padding: '4px 8px',
    cursor: 'pointer', color: bChrome.color, display: 'flex',
    alignItems: 'center', borderRadius: 5, fontSize: 11.5,
    fontFamily: 'var(--font-ui)', transition: 'background 0.1s',
  }
  const hoverBg = theme === 'dark' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.14)'
  const modeActive = (m: BrowserMode): React.CSSProperties => ({
    ...btnBase,
    background: mode === m ? 'var(--accent)' : 'transparent',
    color:      mode === m ? '#fff' : bChrome.color,
    fontWeight: mode === m ? 600 : 400,
  })

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

      {/* ── Main toolbar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px',
        background: bChrome.background,
        borderBottom: `1px solid ${bChrome.borderColor}`,
        flexShrink: 0,
      }}>
        <button onClick={back}   style={btnBase} title="Zurück"
          onMouseEnter={e => (e.currentTarget.style.background = hoverBg)}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <IChevLeft style={{ width: 15, height: 15, strokeWidth: 2.2 }} />
        </button>
        <button onClick={fwd}    style={btnBase} title="Vorwärts"
          onMouseEnter={e => (e.currentTarget.style.background = hoverBg)}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <IChevLeft style={{ width: 15, height: 15, strokeWidth: 2.2, transform: 'scaleX(-1)' }} />
        </button>
        <button onClick={reload} style={btnBase} title="Neu laden"
          onMouseEnter={e => (e.currentTarget.style.background = hoverBg)}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <IRefresh style={{ width: 15, height: 15, strokeWidth: 2.2 }} />
        </button>

        <form onSubmit={e => { e.preventDefault(); navigate(inputUrl) }}
          style={{ flex: 1, display: 'flex', position: 'relative', alignItems: 'center',
            borderRadius: 6,
            border: error ? '1px solid #ef4444' : `1px solid ${theme === 'dark' ? 'rgba(0,0,0,0.14)' : 'rgba(255,255,255,0.1)'}`,
            background: theme === 'dark' ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.07)',
            transition: 'border-color 0.12s, background 0.12s',
          }}
          onMouseEnter={e => { const f = e.currentTarget; f.style.borderColor = theme === 'dark' ? 'rgba(0,0,0,0.28)' : 'rgba(255,255,255,0.22)'; f.style.background = theme === 'dark' ? 'rgba(0,0,0,0.13)' : 'rgba(255,255,255,0.13)' }}
          onMouseLeave={e => { const f = e.currentTarget; f.style.borderColor = error ? '#ef4444' : theme === 'dark' ? 'rgba(0,0,0,0.14)' : 'rgba(255,255,255,0.1)'; f.style.background = theme === 'dark' ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.07)' }}
        >
          <IGlobe style={{ position: 'absolute', left: 9, width: 13, height: 13, color: theme === 'dark' ? 'rgba(26,26,26,0.4)' : 'rgba(224,224,224,0.45)', pointerEvents: 'none', flexShrink: 0 }} />
          <input
            value={inputUrl}
            onChange={e => setInputUrl(e.target.value)}
            placeholder="http://localhost:3000"
            style={{
              flex: 1, padding: '4px 10px 4px 28px', borderRadius: 6,
              border: 'none', background: 'transparent',
              color: bChrome.color,
              fontSize: 12, fontFamily: 'var(--font-ui)', outline: 'none',
            }}
          />
        </form>

        <button onClick={() => onModeChange('normal')} style={modeActive('normal')} title="Normal"
          onMouseEnter={e => { if (mode !== 'normal') e.currentTarget.style.background = hoverBg }}
          onMouseLeave={e => { if (mode !== 'normal') e.currentTarget.style.background = 'transparent' }}>
          <IMousePointer style={{ width: 14, height: 14, marginRight: 4, strokeWidth: 2.2 }} />Normal
        </button>
        <button onClick={() => onModeChange('draw')} style={modeActive('draw')} title="Zeichnen"
          onMouseEnter={e => { if (mode !== 'draw') e.currentTarget.style.background = hoverBg }}
          onMouseLeave={e => { if (mode !== 'draw') e.currentTarget.style.background = 'transparent' }}>
          <IEdit style={{ width: 14, height: 14, marginRight: 4, strokeWidth: 2.2 }} />Zeichnen
        </button>
        <button onClick={() => onModeChange('inspect')} style={modeActive('inspect')} title="Inspect (Shift+Klick)"
          onMouseEnter={e => { if (mode !== 'inspect') e.currentTarget.style.background = hoverBg }}
          onMouseLeave={e => { if (mode !== 'inspect') e.currentTarget.style.background = 'transparent' }}>
          <IMousePointerClick style={{ width: 14, height: 14, marginRight: 4, strokeWidth: 2.2 }} />Selektor
        </button>

        <button
          onClick={takeScreenshot}
          disabled={!url}
          style={{ ...btnBase, gap: 4, opacity: url ? 1 : 0.4, cursor: url ? 'pointer' : 'default' }}
          title={url ? 'Screenshot machen' : 'Zuerst eine URL eingeben'}
          onMouseEnter={e => { if (url) e.currentTarget.style.background = hoverBg }}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <ICamera style={{ width: 14, height: 14, strokeWidth: 2.2 }} />Screenshot
        </button>
      </div>

      {/* ── Screenshot error toast ── */}
      {screenshotError && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '4px 12px', background: 'rgba(239,68,68,0.12)',
          borderBottom: '1px solid rgba(239,68,68,0.3)', flexShrink: 0,
        }}>
          <span style={{ fontSize: 11, color: '#ef4444', fontFamily: 'var(--font-ui)' }}>
            {screenshotError}
          </span>
          <button
            onClick={() => setScreenshotError(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 14, lineHeight: 1, padding: '0 2px' }}
          >×</button>
        </div>
      )}

      {/* ── Draw sub-toolbar (only in draw mode) ── */}
      {mode === 'draw' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px',
          background: bChrome.background,
          borderBottom: `1px solid ${bChrome.borderColor}`,
          flexShrink: 0, flexWrap: 'wrap',
        }}>
          {/* Tool buttons */}
          {DRAW_TOOLS.map(t => (
            <button
              key={t.id}
              onClick={() => setDrawTool(t.id)}
              style={{
                ...btnBase,
                background: drawTool === t.id ? 'var(--accent)' : 'transparent',
                color: drawTool === t.id ? '#fff' : bChrome.color,
                fontWeight: drawTool === t.id ? 600 : 400,
              }}
              onMouseEnter={e => { if (drawTool !== t.id) e.currentTarget.style.background = hoverBg }}
              onMouseLeave={e => { if (drawTool !== t.id) e.currentTarget.style.background = 'transparent' }}
            >
              {t.id === 'pen'    && <IEdit          style={{ width: 13, height: 13, marginRight: 4, strokeWidth: 2.2 }} />}
              {t.id === 'eraser' && <IEraser        style={{ width: 13, height: 13, marginRight: 4, strokeWidth: 2.2 }} />}
              {t.id === 'text'   && <IMessageSquare style={{ width: 13, height: 13, marginRight: 4, strokeWidth: 2.2 }} />}
              {t.label}
            </button>
          ))}

          {/* Color presets */}
          {COLOR_PRESETS.map(c => (
            <button
              key={c} onClick={() => setDrawColor(c)}
              style={{
                width: 16, height: 16, borderRadius: '50%',
                border: drawColor === c ? `2px solid ${theme === 'dark' ? '#333' : '#ccc'}` : '2px solid transparent',
                background: c, cursor: 'pointer', padding: 0, flexShrink: 0,
              }}
            />
          ))}
          <input
            type="color" value={drawColor} onChange={e => setDrawColor(e.target.value)}
            style={{ width: 16, height: 16, borderRadius: '50%', border: 'none', padding: 0, cursor: 'pointer', background: 'transparent', flexShrink: 0 }}
          />

          <span style={{ fontSize: 10, color: bChrome.color, fontFamily: 'var(--font-ui)', opacity: 0.7 }}>
            {drawTool === 'text' ? 'Größe' : 'Stärke'}
          </span>
          <input
            type="range" min={1} max={30} value={drawSize}
            onChange={e => setDrawSize(+e.target.value)}
            style={{ width: 70, accentColor: 'var(--accent)' }}
          />
          <span style={{ fontSize: 10, color: bChrome.color, fontFamily: 'var(--font-mono)', minWidth: 14, opacity: 0.7 }}>{drawSize}</span>

          <button onClick={() => drawRef.current?.undo()} style={btnBase} title="Rückgängig (⌘Z)">
            <IUndo style={{ width: 13, height: 13, strokeWidth: 2.2 }} />
          </button>
          <button onClick={() => drawRef.current?.clear()} style={{ ...btnBase, color: '#ef4444' }} title="Löschen">
            <ITrash style={{ width: 13, height: 13, strokeWidth: 2.2 }} />
          </button>

          <div style={{ flex: 1 }} />

          <button
            onClick={saveDraw}
            disabled={saving}
            style={{ ...btnBase, background: 'var(--accent)', color: 'var(--accent-fg)', fontWeight: 600, padding: '4px 12px', gap: 4, opacity: saving ? 0.6 : 1 }}
            title="Zeichnung mit Browser-Inhalt speichern"
          >
            <ISave style={{ width: 13, height: 13, strokeWidth: 2.2 }} />
            {saving ? 'Wird erfasst…' : 'Speichern'}
          </button>
          <button onClick={cancelDraw} style={{ ...btnBase, gap: 4 }} title="Abbrechen">
            <IClose style={{ width: 13, height: 13, strokeWidth: 2.2 }} />Abbrechen
          </button>
        </div>
      )}

      {/* ── Iframe area + overlays ── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>

        {/* Inspect hint */}
        {mode === 'inspect' && (
          <div style={{
            position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
            zIndex: 20, pointerEvents: 'none', padding: '4px 12px', borderRadius: 6,
            background: 'rgba(239,68,68,0.85)', color: '#fff',
            fontSize: 11, fontFamily: 'var(--font-ui)', fontWeight: 600,
          }}>
            Shift+Klick auf ein Element, um es zu erfassen
          </div>
        )}

        {/* Empty-state: no URL entered yet */}
        {!url && !error && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 4,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 10, background: 'var(--bg-1)',
          }}>
            <span style={{ fontSize: 36 }}>🌐</span>
            <span style={{ color: 'var(--fg-1)', fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-ui)' }}>
              Live Browser / Selektor
            </span>
            <span style={{ color: 'var(--fg-3)', fontSize: 12, fontFamily: 'var(--font-ui)' }}>
              URL oben eingeben und Enter drücken
            </span>
            <span style={{ color: 'var(--fg-3)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
              z.B. http://localhost:3000
            </span>
          </div>
        )}

        {/* Loading spinner */}
        {loading && url && (
          <div style={{
            position: 'absolute', top: 6, left: '50%', transform: 'translateX(-50%)',
            zIndex: 3, pointerEvents: 'none',
            padding: '3px 10px', borderRadius: 5,
            background: 'rgba(0,0,0,0.55)', color: '#fff',
            fontSize: 10, fontFamily: 'var(--font-ui)',
          }}>
            Lädt…
          </div>
        )}

        {/* Error overlay */}
        {error && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 5, display: 'flex',
            flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 12, background: 'var(--bg-0)',
          }}>
            <span style={{ fontSize: 32 }}>🌐</span>
            <span style={{ color: 'var(--fg-2)', fontSize: 13, fontFamily: 'var(--font-ui)' }}>Seite nicht erreichbar: {url}</span>
            <button
              onClick={() => navigate(inputUrl || 'http://localhost:3000')}
              style={{ padding: '7px 16px', borderRadius: 7, border: 'none', background: 'var(--accent)', color: 'var(--accent-fg)', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
            >
              Neu versuchen
            </button>
          </div>
        )}

        {/* iframe — only render when url is set; absolute positioning for reliable sizing */}
        {url && (
          <iframe
            ref={iframeRef}
            src={url}
            onLoad={onIframeLoad}
            onError={() => { setError(true); setLoading(false) }}
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%',
              border: 'none', display: 'block',
              pointerEvents: mode === 'draw' ? 'none' : 'auto',
            }}
            title="Live Browser"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
          />
        )}

        {/* DrawCanvas — positioned inside iframe container so coords are correct */}
        <DrawCanvas
          ref={drawRef}
          active={mode === 'draw'}
          tool={drawTool}
          color={drawColor}
          size={drawSize}
        />
      </div>

      {/* Screenshot crop modal */}
      {snipData && (
        <ScreenshotCrop
          dataUrl={snipData}
          onConfirm={url => { setSnipData(null); onScreenshot(url) }}
          onCancel={() => setSnipData(null)}
        />
      )}
    </div>
  )
}
