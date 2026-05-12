/**
 * BrowserPane — iframe browser with URL bar + unified mode toolbar.
 * Draw mode shows an integrated sub-toolbar (Speichern / Abbrechen + drawing tools).
 * DrawCanvas is positioned inside the iframe container so pointer coords are correct.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { WorkshopElementRef } from '../../store/useAppStore'
import {
  IChevLeft, ISearch, IEdit, IMousePointer, ISave, IClose, IEraser,
  IUndo, ITrash, IRefresh, ICamera, IMessageSquare,
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
}

// ── Inject inspect script into iframe ────────────────────────────────────────
function injectInspect(doc: Document, onCapture: (r: WorkshopElementRef) => void): () => void {
  let hl: HTMLElement | null = null
  const clearHl = () => {
    if (hl) { try { hl.style.outline = ''; hl.style.outlineOffset = '' } catch {} hl = null }
  }

  const onMove = (e: MouseEvent) => {
    clearHl()
    hl = e.target as HTMLElement
    try { hl.style.outline = '2px solid #ef4444'; hl.style.outlineOffset = '1px' } catch {}
  }

  const onClick = (e: MouseEvent) => {
    if (!e.shiftKey) return
    e.preventDefault(); e.stopPropagation()
    const el = e.target as HTMLElement

    let component: string | undefined
    try {
      const fk = Object.keys(el).find(k => k.startsWith('__reactFiber'))
      if (fk) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let f = (el as any)[fk]
        while (f) { if (f.type?.name) { component = f.type.name; break }; f = f.return }
      }
    } catch {}

    const classes = [...el.classList].slice(0, 5)
    const selector = el.id ? '#' + el.id : classes.length ? '.' + classes[0] : el.tagName.toLowerCase()
    onCapture({
      tag: el.tagName.toLowerCase(), id: el.id, classes,
      text: el.textContent?.trim().replace(/\s+/g, ' ').slice(0, 60),
      component, selector,
    })
    clearHl()
  }

  doc.addEventListener('mousemove', onMove)
  doc.addEventListener('click', onClick, true)
  return () => { clearHl(); doc.removeEventListener('mousemove', onMove); doc.removeEventListener('click', onClick, true) }
}

export function BrowserPane({ mode, onModeChange, onElementCaptured, onScreenshot }: Props) {
  const iframeRef   = useRef<HTMLIFrameElement>(null)
  const drawRef     = useRef<DrawCanvasHandle>(null)
  const cleanupInspect = useRef<(() => void) | null>(null)

  const [url, setUrl]           = useState('http://localhost:2002')
  const [inputUrl, setInputUrl] = useState('http://localhost:2002')
  const [error, setError]       = useState(false)

  // Draw sub-toolbar state
  const [drawTool,  setDrawTool]  = useState<DrawTool>('pen')
  const [drawColor, setDrawColor] = useState('#ef4444')
  const [drawSize,  setDrawSize]  = useState(4)

  // Screenshot crop modal
  const [snipData, setSnipData] = useState<string | null>(null)

  // ── Navigation ──────────────────────────────────────────────────────────────
  const navigate = useCallback((target: string) => {
    let u = target.trim()
    if (!u.startsWith('http://') && !u.startsWith('https://') && !u.startsWith('/')) u = 'http://' + u
    setUrl(u); setInputUrl(u); setError(false)
  }, [])

  const reload = () => { if (iframeRef.current) iframeRef.current.src = url }
  const back   = () => { try { iframeRef.current?.contentWindow?.history.back() } catch {} }
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
    setError(false)
    try { const iwin = iframeRef.current?.contentWindow; if (iwin) setInputUrl(iwin.location.href) } catch {}
    if (mode === 'inspect') {
      if (cleanupInspect.current) cleanupInspect.current()
      try {
        const doc = iframeRef.current?.contentDocument
        if (doc) cleanupInspect.current = injectInspect(doc, onElementCaptured)
      } catch {}
    }
  }, [mode, onElementCaptured])

  // ── Draw: Speichern / Abbrechen ──────────────────────────────────────────────
  const saveDraw = useCallback(async () => {
    const cv = drawRef.current
    if (cv?.hasStrokes()) {
      const dataUrl = await cv.screenshot()
      if (dataUrl) onScreenshot(dataUrl)
      cv.clear()
    }
    onModeChange('normal')
  }, [onModeChange, onScreenshot])

  const cancelDraw = useCallback(() => {
    drawRef.current?.clear()
    onModeChange('normal')
  }, [onModeChange])

  // ── Screenshot via getDisplayMedia → opens ScreenshotCrop ──────────────────
  const takeScreenshot = useCallback(async () => {
    // ── Try real screen capture ────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gd = (navigator.mediaDevices as any)?.getDisplayMedia
    if (typeof gd === 'function') {
      try {
        const stream: MediaStream = await gd.call(navigator.mediaDevices, {
          video: { frameRate: 1 },
          audio: false,
          preferCurrentTab: true,   // Chrome 107+: auto-select current tab
        })

        const video = document.createElement('video')
        video.muted = true
        video.playsInline = true
        video.srcObject = stream

        // Wait until at least one frame is available
        await new Promise<void>((resolve, reject) => {
          video.onloadedmetadata = () => {
            video.play().then(() => {
              requestAnimationFrame(() => requestAnimationFrame(resolve))
            }).catch(reject)
          }
          video.onerror = reject
          setTimeout(reject, 8000)  // hard timeout
        })

        const canvas = document.createElement('canvas')
        canvas.width  = video.videoWidth  || 1280
        canvas.height = video.videoHeight || 720
        canvas.getContext('2d')!.drawImage(video, 0, 0)

        stream.getTracks().forEach(t => t.stop())
        video.srcObject = null

        setSnipData(canvas.toDataURL('image/png'))
        return
      } catch (err) {
        // User cancelled the picker — just do nothing
        const name = (err as { name?: string }).name
        if (name === 'NotAllowedError' || name === 'AbortError') return
        // Other errors fall through to fallback
        console.warn('[Workshop] getDisplayMedia error:', err)
      }
    }

    // ── Fallback: white canvas + any active drawing strokes ────────────────────
    const iframe = iframeRef.current
    const { width, height } = iframe?.getBoundingClientRect() ?? { width: 1280, height: 800 }
    const w = Math.round(width) || 1280
    const h = Math.round(height) || 800

    const canvas = document.createElement('canvas')
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)

    const drawingUrl = drawRef.current?.hasStrokes() ? await drawRef.current.screenshot() : null
    if (drawingUrl) {
      await new Promise<void>(resolve => {
        const img = new Image()
        img.onload = () => { ctx.drawImage(img, 0, 0); resolve() }
        img.onerror = resolve
        img.src = drawingUrl
      })
    }

    setSnipData(canvas.toDataURL('image/png'))
  }, [])

  // ── Styles ───────────────────────────────────────────────────────────────────
  const btnBase: React.CSSProperties = {
    background: 'none', border: 'none', padding: '4px 6px',
    cursor: 'pointer', color: 'var(--fg-2)', display: 'flex',
    alignItems: 'center', borderRadius: 5, fontSize: 11.5,
    fontFamily: 'var(--font-ui)',
  }
  const modeActive = (m: BrowserMode): React.CSSProperties => ({
    ...btnBase,
    background: mode === m ? 'var(--accent-soft)' : 'transparent',
    color:      mode === m ? 'var(--accent)'      : 'var(--fg-2)',
    fontWeight: mode === m ? 600 : 400,
  })
  const sep: React.CSSProperties = { width: 1, height: 18, background: 'var(--line-strong)', flexShrink: 0 }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

      {/* ── Main toolbar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px',
        background: 'var(--bg-1)', borderBottom: '1px solid var(--line)', flexShrink: 0,
      }}>
        <button onClick={back}   style={btnBase} title="Zurück"><IChevLeft style={{ width: 12, height: 12 }} /></button>
        <button onClick={fwd}    style={btnBase} title="Vorwärts" ><IChevLeft style={{ width: 12, height: 12, transform: 'scaleX(-1)' }} /></button>
        <button onClick={reload} style={btnBase} title="Neu laden"><IRefresh style={{ width: 12, height: 12 }} /></button>

        <form onSubmit={e => { e.preventDefault(); navigate(inputUrl) }} style={{ flex: 1, display: 'flex' }}>
          <input
            value={inputUrl}
            onChange={e => setInputUrl(e.target.value)}
            style={{
              flex: 1, padding: '4px 10px', borderRadius: 6,
              border: `1px solid ${error ? 'var(--err)' : 'var(--line-strong)'}`,
              background: 'var(--bg-2)', color: 'var(--fg-0)', fontSize: 12,
              fontFamily: 'var(--font-mono)', outline: 'none',
            }}
          />
        </form>

        <div style={sep} />

        <button onClick={() => onModeChange('normal')} style={modeActive('normal')} title="Normal">
          <IMousePointer style={{ width: 11, height: 11, marginRight: 3 }} />Normal
        </button>
        <button onClick={() => onModeChange('draw')} style={modeActive('draw')} title="Zeichnen">
          <IEdit style={{ width: 11, height: 11, marginRight: 3 }} />Zeichnen
        </button>
        <button onClick={() => onModeChange('inspect')} style={modeActive('inspect')} title="Inspect (Shift+Klick)">
          <ISearch style={{ width: 11, height: 11, marginRight: 3 }} />Inspect
        </button>

        <div style={sep} />

        <button onClick={takeScreenshot} style={{ ...btnBase, gap: 4 }} title="Screenshot machen">
          <ICamera style={{ width: 11, height: 11 }} />Screenshot
        </button>
      </div>

      {/* ── Draw sub-toolbar (only in draw mode) ── */}
      {mode === 'draw' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px',
          background: 'var(--bg-2)', borderBottom: '1px solid var(--line)',
          flexShrink: 0, flexWrap: 'wrap',
        }}>
          {/* Tool buttons */}
          {DRAW_TOOLS.map(t => (
            <button
              key={t.id}
              onClick={() => setDrawTool(t.id)}
              style={{ ...btnBase, background: drawTool === t.id ? 'var(--accent-soft)' : 'transparent', color: drawTool === t.id ? 'var(--accent)' : 'var(--fg-2)', fontWeight: drawTool === t.id ? 600 : 400 }}
            >
              {t.id === 'pen'    && <IEdit          style={{ width: 11, height: 11, marginRight: 3 }} />}
              {t.id === 'eraser' && <IEraser        style={{ width: 11, height: 11, marginRight: 3 }} />}
              {t.id === 'text'   && <IMessageSquare style={{ width: 11, height: 11, marginRight: 3 }} />}
              {t.label}
            </button>
          ))}

          <div style={sep} />

          {/* Color presets */}
          {COLOR_PRESETS.map(c => (
            <button
              key={c}
              onClick={() => setDrawColor(c)}
              style={{
                width: 16, height: 16, borderRadius: '50%',
                border: drawColor === c ? '2px solid var(--fg-0)' : '2px solid transparent',
                background: c, cursor: 'pointer', padding: 0, flexShrink: 0,
              }}
            />
          ))}
          <input
            type="color" value={drawColor} onChange={e => setDrawColor(e.target.value)}
            style={{ width: 16, height: 16, borderRadius: '50%', border: 'none', padding: 0, cursor: 'pointer', background: 'transparent', flexShrink: 0 }}
          />

          <div style={sep} />

          {/* Size — brush thickness or text font size */}
          <span style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-ui)' }}>
            {drawTool === 'text' ? 'Größe' : 'Stärke'}
          </span>
          <input
            type="range" min={1} max={30} value={drawSize}
            onChange={e => setDrawSize(+e.target.value)}
            style={{ width: 70, accentColor: 'var(--accent)' }}
          />
          <span style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', minWidth: 14 }}>{drawSize}</span>

          <div style={sep} />

          {/* Undo / Clear */}
          <button onClick={() => drawRef.current?.undo()} style={btnBase} title="Rückgängig (⌘Z)">
            <IUndo style={{ width: 11, height: 11 }} />
          </button>
          <button onClick={() => drawRef.current?.clear()} style={{ ...btnBase, color: 'var(--err)' }} title="Löschen">
            <ITrash style={{ width: 11, height: 11 }} />
          </button>

          <div style={{ flex: 1 }} />

          {/* Save / Cancel */}
          <button
            onClick={saveDraw}
            style={{ ...btnBase, background: 'var(--accent)', color: 'var(--accent-fg)', fontWeight: 600, padding: '4px 12px', gap: 4 }}
            title="Zeichnung speichern"
          >
            <ISave style={{ width: 11, height: 11 }} />Speichern
          </button>
          <button
            onClick={cancelDraw}
            style={{ ...btnBase, color: 'var(--fg-2)', gap: 4 }}
            title="Abbrechen"
          >
            <IClose style={{ width: 11, height: 11 }} />Abbrechen
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
              onClick={() => { navigate('http://localhost:2002'); reload() }}
              style={{ padding: '7px 16px', borderRadius: 7, border: 'none', background: 'var(--accent)', color: 'var(--accent-fg)', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
            >
              localhost:2002 öffnen
            </button>
          </div>
        )}

        {/* iframe */}
        <iframe
          ref={iframeRef}
          src={url}
          onLoad={onIframeLoad}
          onError={() => setError(true)}
          style={{
            width: '100%', height: '100%',
            border: 'none', display: 'block',
            pointerEvents: mode === 'draw' ? 'none' : 'auto',
          }}
          title="UI Workshop Browser"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
        />

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
