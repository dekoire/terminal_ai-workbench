/**
 * FloatingChatbox — draggable, minimizable panel for collecting screenshots,
 * element refs, and a text description before sending to the agent.
 */

import React, { useCallback, useRef, useState } from 'react'
import type { WorkshopElementRef, PendingWorkshopTransfer } from '../../store/useAppStore'
import { IClose, IImage, ISearch, IChevDown, IChevUp } from '../primitives/Icons'

interface ChatItem {
  type: 'screenshot' | 'element'
  dataUrl?: string
  fileName?: string
  ref?: WorkshopElementRef
}

interface Props {
  items: ChatItem[]
  onRemoveItem: (idx: number) => void
  onTransfer: (t: PendingWorkshopTransfer) => void
}

export function FloatingChatbox({ items, onRemoveItem, onTransfer }: Props) {
  const [minimized, setMinimized] = useState(false)
  const [pos, setPos] = useState({ x: -1, y: -1 })  // -1 = default CSS anchor
  const [text, setText] = useState('')
  const isDragging = useRef(false)
  const dragStart  = useRef({ mx: 0, my: 0, px: 0, py: 0 })
  const panelRef   = useRef<HTMLDivElement>(null)

  // ── Drag ─────────────────────────────────────────────────────────────────────
  const onDragMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current) return
    const dx = e.clientX - dragStart.current.mx
    const dy = e.clientY - dragStart.current.my
    setPos({ x: dragStart.current.px + dx, y: dragStart.current.py + dy })
  }, [])

  const onDragEnd = useCallback(() => {
    isDragging.current = false
    window.removeEventListener('mousemove', onDragMove)
    window.removeEventListener('mouseup', onDragEnd)
  }, [onDragMove])

  const onDragStart = useCallback((e: React.MouseEvent) => {
    isDragging.current = true
    const panel = panelRef.current!
    const panelRect  = panel.getBoundingClientRect()
    // Use offsetParent for parent-relative coordinates; fall back to document
    const parentRect = (panel.offsetParent as HTMLElement | null)?.getBoundingClientRect() ?? { left: 0, top: 0 }
    dragStart.current = {
      mx: e.clientX,
      my: e.clientY,
      px: panelRect.left - parentRect.left,
      py: panelRect.top  - parentRect.top,
    }
    window.addEventListener('mousemove', onDragMove)
    window.addEventListener('mouseup', onDragEnd)
  }, [onDragMove, onDragEnd])

  // ── Transfer ──────────────────────────────────────────────────────────────────
  const handleTransfer = () => {
    const elementRefs   = items.filter(i => i.type === 'element').map(i => i.ref!)
    const imageDataUrls = items.filter(i => i.type === 'screenshot').map(i => i.dataUrl!)
    onTransfer({ text, elementRefs, imageDataUrls })
  }

  const hasContent = text.trim().length > 0 || items.length > 0

  // ── Positioning ───────────────────────────────────────────────────────────────
  const posStyle: React.CSSProperties = pos.x >= 0
    ? { position: 'absolute', left: pos.x, top: pos.y }
    : { position: 'absolute', right: 16, bottom: 16 }

  return (
    <div
      ref={panelRef}
      style={{
        ...posStyle,
        zIndex: 50,
        width: 340,
        borderRadius: 10,
        border: '1px solid var(--line-strong)',
        background: 'var(--bg-1)',
        boxShadow: '0 4px 14px rgba(0,0,0,0.22)',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* Title bar / drag handle */}
      <div
        onMouseDown={onDragStart}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px',
          background: 'var(--bg-2)', borderBottom: minimized ? 'none' : '1px solid var(--line)',
          cursor: 'grab', flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-ui)', color: 'var(--fg-1)', flex: 1 }}>
          Übergabe an Chatbox
          {items.length > 0 && (
            <span style={{ marginLeft: 5, fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 8, background: 'var(--accent-soft)', color: 'var(--accent)' }}>
              {items.length}
            </span>
          )}
        </span>
        <button
          onClick={() => setMinimized(m => !m)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-3)', padding: '1px 3px', display: 'flex', alignItems: 'center' }}
          title={minimized ? 'Aufklappen' : 'Minimieren'}
        >
          {minimized
            ? <IChevDown style={{ width: 13, height: 13 }} />
            : <IChevUp   style={{ width: 13, height: 13 }} />
          }
        </button>
      </div>

      {/* Body */}
      {!minimized && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

          {/* Items list */}
          {items.length > 0 && (
            <div style={{ padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 160, overflowY: 'auto', borderBottom: '1px solid var(--line)' }}>
              {items.map((item, idx) => (
                <div
                  key={idx}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 6px', background: 'var(--bg-2)', borderRadius: 6, border: '1px solid var(--line-strong)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                >
                  {item.type === 'screenshot' ? (
                    <>
                      {item.dataUrl
                        ? <img src={item.dataUrl} style={{ width: 32, height: 22, objectFit: 'cover', borderRadius: 3, flexShrink: 0 }} alt="" />
                        : <IImage style={{ width: 13, height: 13, color: 'var(--fg-2)', flexShrink: 0 }} />
                      }
                      <span style={{ flex: 1, color: 'var(--fg-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.fileName ?? 'screenshot.png'}
                      </span>
                    </>
                  ) : (
                    // ── Inspect element — new structured format ──────────────
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <ISearch style={{ width: 10, height: 10, color: '#ef4444', flexShrink: 0 }} />
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#ef4444', flexShrink: 0 }}>
                          {item.ref?.component ?? item.ref?.tag ?? '?'}
                        </span>
                        {item.ref?.position && (
                          <span style={{ fontSize: 8, padding: '0px 4px', borderRadius: 3, background: 'rgba(59,130,246,0.15)', color: '#3b82f6', fontWeight: 600, flexShrink: 0 }}>
                            {item.ref.position}
                          </span>
                        )}
                      </div>
                      {item.ref?.page && (
                        <div style={{ fontSize: 8.5, color: 'var(--fg-3)', fontFamily: 'var(--font-ui)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <span style={{ opacity: 0.6 }}>Seite: </span>{item.ref.page}
                        </div>
                      )}
                      <div style={{ fontSize: 8.5, color: 'var(--fg-2)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.ref?.hierarchy ?? item.ref?.selector}
                      </div>
                      {item.ref?.text && (
                        <div style={{ fontSize: 8.5, color: 'var(--fg-3)', fontFamily: 'var(--font-ui)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontStyle: 'italic' }}>
                          „{item.ref.text}"
                        </div>
                      )}
                    </div>
                  )}
                  <button
                    onClick={() => onRemoveItem(idx)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-3)', padding: 0, display: 'flex', flexShrink: 0 }}
                  >
                    <IClose style={{ width: 9, height: 9 }} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Text input */}
          <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--line)' }}>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Was soll geändert / übergeben werden?"
              rows={3}
              style={{
                width: '100%', resize: 'none', background: 'var(--bg-2)',
                border: '1px solid var(--line-strong)', borderRadius: 6,
                color: 'var(--fg-0)', fontSize: 11.5, fontFamily: 'var(--font-ui)',
                padding: '6px 8px', outline: 'none', boxSizing: 'border-box',
                lineHeight: 1.5,
              }}
            />
          </div>

          {/* Send button */}
          <div style={{ padding: '6px 8px' }}>
            <button
              onClick={handleTransfer}
              disabled={!hasContent}
              style={{
                width: '100%', padding: '7px', borderRadius: 7, border: 'none',
                background: hasContent ? 'var(--accent)' : 'var(--bg-3)',
                color: hasContent ? 'var(--accent-fg)' : 'var(--fg-3)',
                fontWeight: 600, fontSize: 12, fontFamily: 'var(--font-ui)',
                cursor: hasContent ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              An Chatbox übernehmen
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
