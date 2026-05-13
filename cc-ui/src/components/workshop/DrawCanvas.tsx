/**
 * DrawCanvas — canvas overlay for drawing + moveable text annotations.
 * All toolbar state (tool, color, size) is managed by the parent (BrowserPane).
 * Text items are overlay divs that stay moveable until screenshot/export.
 */

import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { IClose } from '../primitives/Icons'

const MAX_UNDO = 25

export interface DrawCanvasHandle {
  screenshot: () => Promise<string | null>
  clear: () => void
  undo: () => void
  hasStrokes: () => boolean
}

export type DrawTool = 'pen' | 'eraser' | 'text'

interface TextItem {
  id: string
  x: number
  y: number
  content: string
  color: string
  fontSize: number
  editing: boolean
}

interface Props {
  active: boolean
  tool: DrawTool
  color: string
  size: number
}

let _id = 0
const uid = () => String(++_id)

// ── Sub-component: focuses after mount to avoid autoFocus + pointerup race ───
interface TextInputProps {
  value: string
  color: string
  fontSize: number
  onChange: (v: string) => void
  onConfirm: () => void
  onRemove: () => void
}
function TextInput({ value, color, fontSize, onChange, onConfirm, onRemove }: TextInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 60)
    return () => clearTimeout(t)
  }, [])
  return (
    <input
      ref={inputRef}
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
      style={{
        background: 'transparent', border: 'none',
        outline: '1.5px dashed rgba(255,255,255,0.7)',
        color, fontSize, fontWeight: 700, fontFamily: 'sans-serif',
        padding: '1px 3px', minWidth: 60,
        textShadow: '0 1px 3px rgba(0,0,0,0.8)',
        lineHeight: 1,
      }}
    />
  )
}

export const DrawCanvas = React.forwardRef<DrawCanvasHandle, Props>(
  function DrawCanvas({ active, tool, color, size }, ref) {
    const canvasRef    = useRef<HTMLCanvasElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const isDrawing    = useRef(false)
    const lastPos      = useRef<{ x: number; y: number } | null>(null)
    const [undoStack, setUndoStack] = useState<ImageData[]>([])
    const [hasContent, setHasContent] = useState(false)
    const [dims, setDims] = useState({ w: 0, h: 0 })
    const [textItems, setTextItems] = useState<TextItem[]>([])

    // text drag tracking
    const textDrag = useRef<{ id: string; startCx: number; startCy: number; origX: number; origY: number; moved: boolean } | null>(null)

    // ── Auto-size ─────────────────────────────────────────────────────────────
    useEffect(() => {
      const el = containerRef.current
      if (!el) return
      const ro = new ResizeObserver(entries => {
        const r = entries[0].contentRect
        setDims({ w: Math.round(r.width), h: Math.round(r.height) })
      })
      ro.observe(el)
      setDims({ w: el.clientWidth, h: el.clientHeight })
      return () => ro.disconnect()
    }, [active])

    // ── Canvas coord helper ───────────────────────────────────────────────────
    const toCanvas = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const cv = canvasRef.current!
      const r  = cv.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }

    // ── Undo snapshot ─────────────────────────────────────────────────────────
    const snap = useCallback(() => {
      const cv = canvasRef.current; if (!cv) return
      const d = cv.getContext('2d')!.getImageData(0, 0, cv.width, cv.height)
      setUndoStack(prev => { const n = [...prev, d]; return n.length > MAX_UNDO ? n.slice(-MAX_UNDO) : n })
    }, [])

    // ── Clear ─────────────────────────────────────────────────────────────────
    const clear = useCallback(() => {
      const cv = canvasRef.current; if (!cv) return
      cv.getContext('2d')!.clearRect(0, 0, cv.width, cv.height)
      setUndoStack([])
      setHasContent(false)
      setTextItems([])
    }, [])

    // ── Undo ──────────────────────────────────────────────────────────────────
    const undo = useCallback(() => {
      if (undoStack.length === 0) { clear(); return }
      const cv = canvasRef.current; if (!cv) return
      const ctx = cv.getContext('2d')!
      if (undoStack.length === 1) {
        ctx.clearRect(0, 0, cv.width, cv.height)
        setUndoStack([])
        setHasContent(false)
      } else {
        ctx.putImageData(undoStack[undoStack.length - 2], 0, 0)
        setUndoStack(s => s.slice(0, -1))
      }
    }, [undoStack, clear])

    // ── Keyboard ──────────────────────────────────────────────────────────────
    useEffect(() => {
      if (!active) return
      const h = (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); undo() }
      }
      window.addEventListener('keydown', h)
      return () => window.removeEventListener('keydown', h)
    }, [active, undo])

    // ── Drawing handlers ──────────────────────────────────────────────────────
    const onDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
      if (tool === 'text') {
        e.preventDefault() // prevent browser focus-management from stealing focus
        const cv = canvasRef.current!
        const r  = cv.getBoundingClientRect()
        const x  = e.clientX - r.left
        const y  = e.clientY - r.top
        const fontSize = Math.max(14, size * 3)
        setTextItems(prev => [...prev, { id: uid(), x, y, content: '', color, fontSize, editing: true }])
        return
      }
      e.currentTarget.setPointerCapture(e.pointerId)
      snap()
      isDrawing.current = true
      lastPos.current = toCanvas(e)
    }, [tool, color, size, snap])

    const onMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawing.current) return
      const cv = canvasRef.current!
      const ctx = cv.getContext('2d')!
      const pos = toCanvas(e)
      ctx.save()
      if (tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out'
        ctx.strokeStyle = 'rgba(0,0,0,1)'
        ctx.lineWidth = size * 4
      } else {
        ctx.globalCompositeOperation = 'source-over'
        ctx.strokeStyle = color
        ctx.lineWidth = size
      }
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(lastPos.current!.x, lastPos.current!.y)
      ctx.lineTo(pos.x, pos.y)
      ctx.stroke()
      ctx.restore()
      lastPos.current = pos
      setHasContent(true)
    }, [tool, color, size])

    const onUp = useCallback(() => { isDrawing.current = false; lastPos.current = null }, [])

    // ── Text item drag ────────────────────────────────────────────────────────
    const onTextPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>, item: TextItem) => {
      e.stopPropagation()  // must come first — prevents canvas from firing its onDown
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
        setTextItems(prev => prev.map(i => i.id === id ? { ...i, x: d.origX + dx, y: d.origY + dy } : i))
      }
    }, [])

    const onTextPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>, id: string) => {
      e.stopPropagation()
      const d = textDrag.current
      if (d && !d.moved) {
        // Was a click, not a drag → re-enter edit mode
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

    // ── Public API ────────────────────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      screenshot: async () => {
        const cv = canvasRef.current
        if (!cv) return null

        // Composite: strokes + text items
        const composite = document.createElement('canvas')
        composite.width  = cv.width
        composite.height = cv.height
        const ctx = composite.getContext('2d')!
        ctx.drawImage(cv, 0, 0)

        // Burn text items
        for (const item of textItems) {
          if (!item.content.trim()) continue
          ctx.save()
          ctx.font = `bold ${item.fontSize}px sans-serif`
          ctx.fillStyle = item.color
          ctx.shadowColor = 'rgba(0,0,0,0.55)'
          ctx.shadowBlur = 3
          ctx.fillText(item.content, item.x, item.y)
          ctx.restore()
        }

        return composite.toDataURL('image/png')
      },
      clear,
      undo,
      hasStrokes: () => hasContent || textItems.some(i => i.content.trim().length > 0),
    }), [clear, undo, hasContent, textItems])

    if (!active) return null

    return (
      <div
        ref={containerRef}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'auto' }}
      >
        {/* Drawing canvas */}
        <canvas
          ref={canvasRef}
          width={dims.w}
          height={dims.h}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={onUp}
          style={{
            display: 'block', width: '100%', height: '100%',
            cursor: tool === 'eraser' ? 'cell' : tool === 'text' ? 'text' : 'crosshair',
            touchAction: 'none',
          }}
        />

        {/* Text item overlays */}
        {textItems.map(item => (
          <div
            key={item.id}
            onPointerDown={e => onTextPointerDown(e, item)}
            onPointerMove={e => onTextPointerMove(e, item.id)}
            onPointerUp={e => onTextPointerUp(e, item.id)}
            style={{
              position: 'absolute',
              left: item.x,
              top: item.y,
              transform: 'translate(0, -80%)',
              cursor: item.editing ? 'text' : 'move',
              userSelect: 'none',
              zIndex: 30,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 2,
            }}
          >
            {item.editing ? (
              <TextInput
                value={item.content}
                color={item.color}
                fontSize={item.fontSize}
                onChange={val => setTextItems(prev => prev.map(i => i.id === item.id ? { ...i, content: val } : i))}
                onConfirm={() => finalizeText(item.id)}
                onRemove={() => removeText(item.id)}
              />
            ) : (
              <>
                <span style={{
                  color: item.color,
                  fontSize: item.fontSize,
                  fontWeight: 700,
                  fontFamily: 'sans-serif',
                  textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                  lineHeight: 1,
                  whiteSpace: 'pre',
                  display: 'block',
                  outline: '1px dashed rgba(255,255,255,0.35)',
                  padding: '1px 3px',
                }}>
                  {item.content}
                </span>
                <button
                  onPointerDown={e => e.stopPropagation()}
                  onClick={e => { e.stopPropagation(); removeText(item.id) }}
                  style={{
                    background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: 3,
                    cursor: 'pointer', padding: 1, display: 'flex', alignItems: 'center',
                    flexShrink: 0, marginTop: 1,
                  }}
                >
                  <IClose style={{ width: 9, height: 9, color: '#fff' }} />
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    )
  }
)
