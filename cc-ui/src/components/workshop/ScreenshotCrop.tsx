/**
 * ScreenshotCrop — full-screen modal to crop a screenshot before sending.
 * User drags on the image to select a region. Buttons: "Ausschnitt senden",
 * "Ganzes Bild", "Abbrechen".
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { IClose } from '../primitives/Icons'

interface Props {
  dataUrl: string
  onConfirm: (dataUrl: string) => void
  onCancel: () => void
}

interface Sel {
  x1: number; y1: number
  x2: number; y2: number
}

function normalize(s: Sel) {
  return {
    x: Math.round(Math.min(s.x1, s.x2)),
    y: Math.round(Math.min(s.y1, s.y2)),
    w: Math.round(Math.abs(s.x2 - s.x1)),
    h: Math.round(Math.abs(s.y2 - s.y1)),
  }
}

export function ScreenshotCrop({ dataUrl, onConfirm, onCancel }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const imgRef     = useRef<HTMLImageElement | null>(null)
  const [sel, setSel]           = useState<Sel | null>(null)
  const [selecting, setSelecting] = useState(false)
  const startPos   = useRef<{ x: number; y: number } | null>(null)
  const [loaded, setLoaded]     = useState(false)

  // ── Load image into canvas ──────────────────────────────────────────────────
  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      const cv = canvasRef.current
      if (!cv) return
      cv.width  = img.naturalWidth  || img.width
      cv.height = img.naturalHeight || img.height
      setLoaded(true)
    }
    img.src = dataUrl
  }, [dataUrl])

  // ── Redraw canvas + selection overlay ──────────────────────────────────────
  useEffect(() => {
    const cv  = canvasRef.current
    const img = imgRef.current
    if (!cv || !img || !loaded) return
    const ctx = cv.getContext('2d')!

    ctx.clearRect(0, 0, cv.width, cv.height)
    ctx.drawImage(img, 0, 0)

    if (sel) {
      const { x, y, w, h } = normalize(sel)
      if (w > 4 && h > 4) {
        // Dark mask outside selection (4 rects)
        ctx.fillStyle = 'rgba(0,0,0,0.52)'
        ctx.fillRect(0, 0, cv.width, y)
        ctx.fillRect(0, y + h, cv.width, cv.height - y - h)
        ctx.fillRect(0, y, x, h)
        ctx.fillRect(x + w, y, cv.width - x - w, h)

        // Dashed selection border
        ctx.save()
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = Math.max(1, cv.width / 1000)
        ctx.setLineDash([8, 4])
        ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1)
        ctx.restore()

        // Corner handles
        const hs = Math.max(6, cv.width / 200)
        ctx.fillStyle = '#ffffff'
        ;[[x, y], [x + w, y], [x, y + h], [x + w, y + h]].forEach(([hx, hy]) => {
          ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs)
        })

        // Size label
        const scale = cv.getBoundingClientRect().width / cv.width
        ctx.save()
        ctx.fillStyle = 'rgba(0,0,0,0.7)'
        const label = `${w} × ${h}`
        const lx = x + 4, ly = y - 6
        ctx.font = `${Math.round(12 / scale)}px system-ui`
        ctx.fillStyle = '#fff'
        ctx.fillText(label, lx, ly > 0 ? ly : y + 14 / scale)
        ctx.restore()
      }
    }
  }, [sel, loaded])

  // ── Coord helper ──────────────────────────────────────────────────────────
  const toCanvas = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const cv   = canvasRef.current!
    const rect = cv.getBoundingClientRect()
    const sx = cv.width  / rect.width
    const sy = cv.height / rect.height
    return {
      x: Math.max(0, Math.min(cv.width,  (e.clientX - rect.left) * sx)),
      y: Math.max(0, Math.min(cv.height, (e.clientY - rect.top ) * sy)),
    }
  }

  // ── Pointer events ────────────────────────────────────────────────────────
  const onDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    const p = toCanvas(e)
    startPos.current = p
    setSelecting(true)
    setSel({ x1: p.x, y1: p.y, x2: p.x, y2: p.y })
  }, [])

  const onMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!selecting || !startPos.current) return
    const p = toCanvas(e)
    setSel({ x1: startPos.current.x, y1: startPos.current.y, x2: p.x, y2: p.y })
  }, [selecting])

  const onUp = useCallback(() => { setSelecting(false); startPos.current = null }, [])

  // ── Actions ───────────────────────────────────────────────────────────────
  const confirmCrop = useCallback(() => {
    if (!sel || !imgRef.current) return
    const { x, y, w, h } = normalize(sel)
    if (w < 5 || h < 5) { onConfirm(dataUrl); return }
    const crop = document.createElement('canvas')
    crop.width = w; crop.height = h
    crop.getContext('2d')!.drawImage(imgRef.current, x, y, w, h, 0, 0, w, h)
    onConfirm(crop.toDataURL('image/png'))
  }, [sel, dataUrl, onConfirm])

  const hasSelection = sel && normalize(sel).w > 5 && normalize(sel).h > 5

  // Keyboard
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
      if (e.key === 'Enter' && hasSelection) confirmCrop()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [hasSelection, confirmCrop, onCancel])

  const btn = (
    onClick: () => void,
    label: string,
    accent = false,
    disabled = false,
  ): React.CSSProperties => ({
    padding: '5px 14px', borderRadius: 6, border: accent ? 'none' : '1px solid rgba(255,255,255,0.22)',
    background: disabled ? 'rgba(255,255,255,0.08)' : accent ? 'var(--accent)' : 'rgba(255,255,255,0.08)',
    color: disabled ? 'rgba(255,255,255,0.3)' : accent ? 'var(--accent-fg)' : '#fff',
    fontSize: 12, fontFamily: 'var(--font-ui)', fontWeight: accent ? 600 : 400,
    cursor: disabled ? 'default' : 'pointer',
  })

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99000,
      background: 'rgba(0,0,0,0.88)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', padding: '12px 16px 16px', gap: 10,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', flexShrink: 0 }}>
        <span style={{ color: '#fff', fontSize: 13, fontFamily: 'var(--font-ui)', fontWeight: 600, flex: 1 }}>
          Screenshot — Bereich auswählen
        </span>
        <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, fontFamily: 'var(--font-ui)' }}>
          Ziehen zum Auswählen · Enter bestätigt · Esc abbricht
        </span>
        <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.18)' }} />
        <button
          onClick={confirmCrop}
          disabled={!hasSelection}
          style={btn(confirmCrop, 'Ausschnitt senden', true, !hasSelection)}
        >
          Ausschnitt senden
        </button>
        <button onClick={() => onConfirm(dataUrl)} style={btn(() => onConfirm(dataUrl), 'Ganzes Bild')}>
          Ganzes Bild
        </button>
        <button
          onClick={onCancel}
          style={{ ...btn(onCancel, 'Abbrechen'), padding: '5px 8px', display: 'flex', alignItems: 'center' }}
        >
          <IClose style={{ width: 12, height: 12 }} />
        </button>
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', overflow: 'hidden' }}>
        <canvas
          ref={canvasRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={onUp}
          style={{
            maxWidth: '100%', maxHeight: '100%',
            display: 'block',
            cursor: 'crosshair',
            touchAction: 'none',
            borderRadius: 6,
            boxShadow: '0 4px 30px rgba(0,0,0,0.5)',
          }}
        />
      </div>
    </div>
  )
}
