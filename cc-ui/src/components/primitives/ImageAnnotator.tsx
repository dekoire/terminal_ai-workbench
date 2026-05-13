/**
 * ImageAnnotator — Draw, annotate and add moveable text to an image before sending.
 * Opens as a fullscreen modal overlay. Returns an annotated PNG File via onDone.
 *
 * Text items are overlay divs that stay moveable (drag to reposition, click to re-edit)
 * until the image is exported — they are composited onto the canvas on export.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { IClose, ITrash } from './Icons'

interface Props {
  src: string
  fileName: string
  onDone: (file: File) => void
  onCancel: () => void
}

type DrawTool = 'pen' | 'eraser' | 'text'

interface TextItem {
  id: string
  /** position in canvas (natural) pixels */
  x: number
  y: number
  content: string
  color: string
  fontSize: number
  editing: boolean
}

const COLOR_PRESETS = ['#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#007aff', '#ffffff', '#000000']
const MAX_UNDO = 30

let _id = 0
const uid = () => String(++_id)

// ── Sub-component: auto-focuses after mount (avoids autoFocus + pointerup race) ──
interface TextInputProps {
  value: string
  onChange: (v: string) => void
  onConfirm: () => void
  onRemove: () => void
  inputStyle: React.CSSProperties
}
function TextInputOverlay({ value, onChange, onConfirm, onRemove, inputStyle }: TextInputProps) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    // Delay focus so that the pointerup event from the canvas click has already fired
    const t = setTimeout(() => ref.current?.focus(), 60)
    return () => clearTimeout(t)
  }, [])
  return (
    <input
      ref={ref}
      value={value}
      onChange={e => onChange(e.target.value)}
      onPointerDown={e => e.stopPropagation()}
      onPointerUp={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
      onKeyDown={e => {
        if (e.key === 'Enter') { e.preventDefault(); onConfirm() }
        if (e.key === 'Escape') onRemove()
      }}
      onBlur={onConfirm}
      style={inputStyle}
    />
  )
}

export function ImageAnnotator({ src, fileName, onDone, onCancel }: Props) {
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [tool, setTool]           = useState<DrawTool>('pen')
  const [color, setColor]         = useState('#ff3b30')
  const [brushSize, setBrushSize] = useState(4)
  const [fontSize, setFontSize]   = useState(22)
  const [undoStack, setUndoStack] = useState<ImageData[]>([])
  const [ready, setReady]         = useState(false)
  const [textItems, setTextItems] = useState<TextItem[]>([])

  const isDrawing  = useRef(false)
  const lastPos    = useRef<{ x: number; y: number } | null>(null)
  // text drag tracking
  const textDrag   = useRef<{ id: string; startCx: number; startCy: number; origX: number; origY: number; moved: boolean } | null>(null)

  // ── Load image onto canvas ─────────────────────────────────────────────────
  useEffect(() => {
    if (!src) return
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      canvas.width  = img.naturalWidth  || img.width
      canvas.height = img.naturalHeight || img.height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      setUndoStack([ctx.getImageData(0, 0, canvas.width, canvas.height)])
      setReady(true)
    }
    img.onerror = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      canvas.width = 800; canvas.height = 600
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 800, 600)
      setUndoStack([ctx.getImageData(0, 0, 800, 600)])
      setReady(true)
    }
    img.src = src
  }, [src])

  // ── Scale: canvas natural px → canvas CSS px ─────────────────────────────
  const getScale = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return { scaleX: 1, scaleY: 1, offsetLeft: 0, offsetTop: 0 }
    const cr = canvas.getBoundingClientRect()
    const pr = containerRef.current!.getBoundingClientRect()
    return {
      scaleX: cr.width  / canvas.width,
      scaleY: cr.height / canvas.height,
      offsetLeft: cr.left - pr.left,
      offsetTop:  cr.top  - pr.top,
    }
  }, [])

  // ── Coordinate helper: CSS pointer → canvas px ────────────────────────────
  const toCanvas = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!
    const rect   = canvas.getBoundingClientRect()
    const scaleX = canvas.width  / rect.width
    const scaleY = canvas.height / rect.height
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
  }, [])

  // ── Save undo snapshot ─────────────────────────────────────────────────────
  const saveSnapshot = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx    = canvas.getContext('2d')!
    const snap   = ctx.getImageData(0, 0, canvas.width, canvas.height)
    setUndoStack(prev => {
      const next = [...prev, snap]
      return next.length > MAX_UNDO ? next.slice(next.length - MAX_UNDO) : next
    })
  }, [])

  // ── Undo ──────────────────────────────────────────────────────────────────
  const undo = useCallback(() => {
    if (undoStack.length <= 1) return
    const canvas = canvasRef.current; if (!canvas) return
    canvas.getContext('2d')!.putImageData(undoStack[undoStack.length - 2], 0, 0)
    setUndoStack(s => s.slice(0, -1))
  }, [undoStack])

  // ── Clear ─────────────────────────────────────────────────────────────────
  const clear = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas || undoStack.length === 0) return
    canvas.getContext('2d')!.putImageData(undoStack[0], 0, 0)
    setUndoStack([undoStack[0]])
    setTextItems([])
  }, [undoStack])

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); undo() }
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, onCancel])

  // ── Drawing handlers ──────────────────────────────────────────────────────
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (tool === 'text') {
      e.preventDefault() // prevent browser focus-management interference
      const pos = toCanvas(e)
      setTextItems(prev => [...prev, { id: uid(), x: pos.x, y: pos.y, content: '', color, fontSize, editing: true }])
      return
    }
    e.currentTarget.setPointerCapture(e.pointerId)
    saveSnapshot()
    isDrawing.current = true
    lastPos.current   = toCanvas(e)
  }, [tool, color, fontSize, toCanvas, saveSnapshot])

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current || tool === 'text') return
    const canvas = canvasRef.current!
    const ctx    = canvas.getContext('2d')!
    const pos    = toCanvas(e)
    ctx.save()
    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.strokeStyle = 'rgba(0,0,0,1)'
      ctx.lineWidth   = brushSize * 4
    } else {
      ctx.globalCompositeOperation = 'source-over'
      ctx.strokeStyle = color
      ctx.lineWidth   = brushSize
    }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(lastPos.current!.x, lastPos.current!.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    ctx.restore()
    lastPos.current = pos
  }, [tool, color, brushSize, toCanvas])

  const handlePointerUp = useCallback(() => { isDrawing.current = false; lastPos.current = null }, [])

  // ── Text item drag ────────────────────────────────────────────────────────
  const onTextPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>, item: TextItem) => {
    e.stopPropagation()  // must come first — prevents canvas from firing handlePointerDown
    if (item.editing) return
    e.currentTarget.setPointerCapture(e.pointerId)
    textDrag.current = { id: item.id, startCx: e.clientX, startCy: e.clientY, origX: item.x, origY: item.y, moved: false }
  }, [])

  const onTextPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>, id: string) => {
    const d = textDrag.current
    if (!d || d.id !== id) return
    const dx = e.clientX - d.startCx
    const dy = e.clientY - d.startCy
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) d.moved = true
    if (d.moved) {
      // Convert CSS delta to canvas delta
      const { scaleX, scaleY } = getScale()
      setTextItems(prev => prev.map(i => i.id === id
        ? { ...i, x: d.origX + dx / scaleX, y: d.origY + dy / scaleY }
        : i
      ))
    }
  }, [getScale])

  const onTextPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>, id: string) => {
    e.stopPropagation()
    const d = textDrag.current
    if (d && !d.moved) {
      setTextItems(prev => prev.map(i => i.id === id ? { ...i, editing: true } : i))
    }
    textDrag.current = null
  }, [])

  const finalizeText = useCallback((id: string) => {
    setTextItems(prev => {
      const item = prev.find(i => i.id === id)
      if (item && !item.content.trim()) return prev.filter(i => i.id !== id)
      return prev.map(i => i.id === id ? { ...i, editing: false } : i)
    })
  }, [])

  const removeText = useCallback((id: string) => {
    setTextItems(prev => prev.filter(i => i.id !== id))
  }, [])

  // ── Export: composite canvas + text items ─────────────────────────────────
  const handleDone = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return

    const composite = document.createElement('canvas')
    composite.width  = canvas.width
    composite.height = canvas.height
    const ctx = composite.getContext('2d')!
    ctx.drawImage(canvas, 0, 0)

    // Burn text items (stored in canvas coordinates)
    for (const item of textItems) {
      if (!item.content.trim()) continue
      ctx.save()
      ctx.font        = `bold ${item.fontSize}px sans-serif`
      ctx.fillStyle   = item.color
      ctx.shadowColor = 'rgba(0,0,0,0.6)'
      ctx.shadowBlur  = 3
      ctx.fillText(item.content, item.x, item.y)
      ctx.restore()
    }

    composite.toBlob(blob => {
      if (!blob) return
      const base = fileName.replace(/\.[^.]+$/, '')
      onDone(new File([blob], `${base}_annotiert.png`, { type: 'image/png' }))
    }, 'image/png')
  }, [fileName, onDone, textItems])

  // ── Cursor ────────────────────────────────────────────────────────────────
  const cursorStyle = tool === 'text' ? 'text' : tool === 'eraser' ? 'cell' : 'crosshair'

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100001,
        background: 'rgba(0,0,0,0.94)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 12, padding: '16px 24px 24px',
        userSelect: 'none',
      }}
    >
      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', width: '100%', maxWidth: 900, flexShrink: 0 }}>

        {/* Tool buttons */}
        <div style={{ display: 'flex', gap: 4 }}>
          {(['pen', 'eraser', 'text'] as DrawTool[]).map(t => (
            <button
              key={t}
              onClick={() => setTool(t)}
              title={t === 'pen' ? 'Stift' : t === 'eraser' ? 'Radierer' : 'Text (klicken → tippen → ziehen)'}
              style={{
                padding: '5px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                background: tool === t ? 'var(--accent)' : 'rgba(255,255,255,0.1)',
                color: '#fff', fontSize: 11, fontFamily: 'var(--font-ui)', fontWeight: 600,
              }}
            >
              {t === 'pen' ? '✏ Stift' : t === 'eraser' ? '◻ Radierer' : 'T Text'}
            </button>
          ))}
        </div>

        <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.15)' }} />

        {/* Color presets */}
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          {COLOR_PRESETS.map(c => (
            <button
              key={c} onClick={() => setColor(c)} title={c}
              style={{
                width: 18, height: 18, borderRadius: '50%',
                border: color === c ? '2px solid #fff' : '2px solid transparent',
                background: c, cursor: 'pointer', padding: 0, flexShrink: 0,
              }}
            />
          ))}
          <input
            type="color" value={color} onChange={e => setColor(e.target.value)} title="Eigene Farbe"
            style={{ width: 18, height: 18, borderRadius: '50%', border: 'none', padding: 0, cursor: 'pointer', background: 'transparent' }}
          />
        </div>

        <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.15)' }} />

        {/* Size slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-ui)' }}>
            {tool === 'text' ? 'Größe' : 'Stärke'}
          </span>
          <input
            type="range" min={tool === 'text' ? 10 : 1} max={tool === 'text' ? 72 : 40}
            value={tool === 'text' ? fontSize : brushSize}
            onChange={e => tool === 'text' ? setFontSize(+e.target.value) : setBrushSize(+e.target.value)}
            style={{ width: 80, accentColor: 'var(--accent)' }}
          />
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-mono)', minWidth: 20 }}>
            {tool === 'text' ? fontSize : brushSize}
          </span>
        </div>

        <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.15)' }} />

        {/* Undo / Clear */}
        <button
          onClick={undo} disabled={undoStack.length <= 1} title="Rückgängig (⌘Z)"
          style={{ padding: '5px 9px', borderRadius: 6, border: 'none', cursor: undoStack.length <= 1 ? 'default' : 'pointer', background: 'rgba(255,255,255,0.1)', color: undoStack.length <= 1 ? 'rgba(255,255,255,0.3)' : '#fff', fontSize: 12 }}
        >↩</button>
        <button
          onClick={clear} title="Alles löschen"
          style={{ padding: '5px 9px', borderRadius: 6, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.1)', color: 'rgba(255,100,100,0.85)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <ITrash style={{ width: 11, height: 11 }} /> Löschen
        </button>

        <div style={{ flex: 1 }} />

        {/* Hint */}
        {tool === 'text' && (
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-ui)' }}>
            Klicken → tippen → Enter · Ziehen zum Verschieben · Klick zum Bearbeiten
          </span>
        )}

        {/* Cancel / Done */}
        <button
          onClick={onCancel}
          style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', background: 'transparent', color: 'rgba(255,255,255,0.7)', fontSize: 12, fontFamily: 'var(--font-ui)' }}
        >Abbrechen</button>
        <button
          onClick={handleDone} disabled={!ready}
          style={{ padding: '6px 16px', borderRadius: 7, border: 'none', cursor: ready ? 'pointer' : 'default', background: ready ? 'var(--accent)' : 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-ui)' }}
        >Fertig ✓</button>
      </div>

      {/* ── Canvas + text overlay area ── */}
      <div
        ref={containerRef}
        style={{ position: 'relative', flexShrink: 1, flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', overflow: 'visible' }}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          style={{ maxWidth: '90vw', maxHeight: '80vh', cursor: cursorStyle, display: 'block', borderRadius: 8, boxShadow: '0 4px 40px rgba(0,0,0,0.6)', touchAction: 'none' }}
        />

        {/* ── Moveable text overlays ── */}
        {textItems.map(item => {
          const { scaleX, scaleY, offsetLeft, offsetTop } = getScale()
          const cssX = offsetLeft + item.x * scaleX
          const cssY = offsetTop  + item.y * scaleY
          const cssFontSize = item.fontSize * scaleY

          return (
            <div
              key={item.id}
              onPointerDown={e => onTextPointerDown(e, item)}
              onPointerMove={e => onTextPointerMove(e, item.id)}
              onPointerUp={e => onTextPointerUp(e, item.id)}
              style={{
                position: 'absolute',
                left: cssX,
                top: cssY,
                transform: 'translate(0, -85%)',
                cursor: item.editing ? 'text' : 'move',
                userSelect: 'none',
                zIndex: 30,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 2,
              }}
            >
              {item.editing ? (
                <TextInputOverlay
                  value={item.content}
                  onChange={val => setTextItems(prev => prev.map(i => i.id === item.id ? { ...i, content: val } : i))}
                  onConfirm={() => finalizeText(item.id)}
                  onRemove={() => removeText(item.id)}
                  inputStyle={{
                    background: 'transparent', border: 'none',
                    outline: '1.5px dashed rgba(255,255,255,0.7)',
                    color: item.color,
                    fontSize: cssFontSize,
                    fontWeight: 700, fontFamily: 'sans-serif',
                    padding: '1px 3px', minWidth: 70,
                    textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                    lineHeight: 1,
                  }}
                />
              ) : (
                <>
                  <span style={{
                    color: item.color, fontSize: cssFontSize, fontWeight: 700,
                    fontFamily: 'sans-serif', textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                    lineHeight: 1, whiteSpace: 'pre', display: 'block',
                    outline: '1px dashed rgba(255,255,255,0.35)',
                    padding: '1px 3px',
                  }}>
                    {item.content}
                  </span>
                  <button
                    onPointerDown={e => e.stopPropagation()}
                    onClick={e => { e.stopPropagation(); removeText(item.id) }}
                    style={{ background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: 3, cursor: 'pointer', padding: 1, display: 'flex', alignItems: 'center', flexShrink: 0, marginTop: 1 }}
                  >
                    <IClose style={{ width: 9, height: 9, color: '#fff' }} />
                  </button>
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Bottom hint */}
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-ui)', flexShrink: 0 }}>
        ⌘Z Rückgängig · Esc Schließen
      </div>
    </div>
  )
}
