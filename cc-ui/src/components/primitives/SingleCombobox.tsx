/**
 * SingleCombobox — styled single-select dropdown for Codera AI.
 * Uses a React portal so the dropdown is never clipped by overflow:hidden parents.
 * Automatically opens upward when there is not enough space below.
 */
import React, { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { IChev, ISearch, ICheck } from './Icons'

export interface SingleOption {
  value:  string
  label:  string
  desc?:  string
  group?: string
}

interface SingleComboboxProps {
  options:      SingleOption[]
  value:        string
  onChange:     (value: string) => void
  placeholder?: string
  searchable?:  boolean
  align?:       'left' | 'right'
  disabled?:    boolean
  loading?:     boolean
  style?:       React.CSSProperties
  maxHeight?:   number
}

interface DropPos {
  top:       number
  left?:     number
  right?:    number
  width:     number
}

export function SingleCombobox({
  options, value, onChange,
  placeholder = 'Auswählen…',
  searchable = false,
  align = 'left',
  disabled = false,
  loading = false,
  style,
  maxHeight = 280,
}: SingleComboboxProps) {
  const [open, setOpen]     = useState(false)
  const [query, setQuery]   = useState('')
  const [pos, setPos]       = useState<DropPos | null>(null)

  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropRef    = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLInputElement>(null)

  const selected = options.find(o => o.value === value)
  const label    = selected?.label ?? (loading ? 'Lädt…' : placeholder)

  // Estimated dropdown height for upward positioning
  const estimatedDropH = Math.min(
    (searchable ? 52 : 0) + Math.min(options.length, 8) * 32 + 12,
    maxHeight + (searchable ? 52 : 0) + 12
  )

  const calcPos = (): DropPos | null => {
    if (!triggerRef.current) return null
    const rect = triggerRef.current.getBoundingClientRect()

    const spaceBelow = window.innerHeight - rect.bottom
    const openDown   = spaceBelow >= estimatedDropH || spaceBelow >= rect.top

    const top  = openDown ? rect.bottom + 5 : rect.top - 5 - estimatedDropH
    const w    = Math.max(rect.width, 200)

    if (align === 'right') return { top, right: window.innerWidth - rect.right, width: w }
    return { top, left: rect.left, width: w }
  }

  const handleOpen = () => {
    if (disabled || loading) return
    if (!open) {
      setPos(calcPos())
      setOpen(true)
    } else {
      setOpen(false)
      setQuery('')
    }
  }

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const t = e.target as Node
      if (triggerRef.current?.contains(t) || dropRef.current?.contains(t)) return
      setOpen(false)
      setQuery('')
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Reposition on scroll / resize
  useEffect(() => {
    if (!open) return
    const update = () => setPos(calcPos())
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [open, align, estimatedDropH])

  // Auto-focus search
  useEffect(() => {
    if (open && searchable) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open, searchable])

  const filtered = useMemo(() => {
    if (!query.trim()) return options
    const q = query.toLowerCase()
    return options.filter(o =>
      o.label.toLowerCase().includes(q) ||
      o.value.toLowerCase().includes(q) ||
      (o.desc ?? '').toLowerCase().includes(q)
    )
  }, [options, query])

  const select = (v: string) => { onChange(v); setOpen(false); setQuery('') }

  let lastGroup: string | undefined = undefined

  const dropdown = open && pos ? createPortal(
    <div
      ref={dropRef}
      style={{
        position:  'fixed',
        top:       pos.top,
        left:      pos.left,
        right:     pos.right,
        width:     pos.width,
        maxWidth:  420,
        zIndex:    9999,
        background: 'var(--bg-1)',
        border:    '1px solid var(--line-strong)',
        borderRadius: 10,
        boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
        overflow:  'hidden',
        display:   'flex', flexDirection: 'column',
      }}
    >
      {searchable && (
        <div style={{ padding: '8px 10px 6px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <ISearch style={{ position: 'absolute', left: 8, width: 11, height: 11, color: 'var(--fg-3)', pointerEvents: 'none' }} />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Suchen…"
              style={{
                width: '100%', paddingLeft: 26, paddingRight: 8,
                paddingTop: 4, paddingBottom: 4,
                border: '1px solid var(--line)', borderRadius: 5,
                background: 'var(--bg-2)', color: 'var(--fg-1)',
                fontSize: 11, fontFamily: 'var(--font-ui)', outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>
      )}

      <div style={{ overflowY: 'auto', maxHeight, padding: '4px 0' }}>
        {filtered.length === 0 && (
          <div style={{ padding: '10px 13px', fontSize: 11, color: 'var(--fg-3)', fontStyle: 'italic' }}>
            Keine Treffer
          </div>
        )}
        {filtered.map(opt => {
          const isSelected = opt.value === value
          const showGroup  = opt.group && opt.group !== lastGroup
          lastGroup = opt.group

          return (
            <React.Fragment key={opt.value}>
              {showGroup && (
                <div style={{ padding: '6px 13px 3px', fontSize: 9.5, fontWeight: 700, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                  {opt.group}
                </div>
              )}
              <div
                onClick={() => select(opt.value)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 13px', cursor: 'pointer',
                  background: isSelected ? 'var(--accent-soft)' : 'transparent',
                  transition: 'background 0.08s',
                }}
                onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--bg-2)' }}
                onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <div style={{ width: 14, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
                  {isSelected && <ICheck style={{ width: 11, height: 11, color: 'var(--accent)' }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 11, fontFamily: 'var(--font-mono)',
                    color: isSelected ? 'var(--accent)' : 'var(--fg-0)',
                    fontWeight: isSelected ? 600 : 400,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {opt.label}
                  </div>
                  {opt.desc && (
                    <div style={{ fontSize: 9.5, color: 'var(--fg-3)', marginTop: 1 }}>{opt.desc}</div>
                  )}
                </div>
              </div>
            </React.Fragment>
          )
        })}
      </div>
    </div>,
    document.body
  ) : null

  return (
    <>
      <div style={{ position: 'relative', display: 'inline-block', width: '100%', ...style }}>
        <button
          ref={triggerRef}
          disabled={disabled || loading}
          onClick={handleOpen}
          style={{
            width: '100%',
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 9px', borderRadius: 7,
            border: `1px solid ${open ? 'var(--accent)' : 'var(--line)'}`,
            background: 'var(--bg-2)',
            color: selected ? 'var(--fg-0)' : 'var(--fg-3)',
            cursor: disabled ? 'default' : 'pointer',
            fontFamily: 'var(--font-ui)', fontSize: 11,
            textAlign: 'left',
            transition: 'border-color 0.15s',
            opacity: disabled ? 0.5 : 1,
          }}
        >
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', fontSize: 10.5 }}>
            {label}
          </span>
          <IChev style={{
            width: 11, height: 11, flexShrink: 0, opacity: 0.45,
            transform: open ? 'rotate(270deg)' : 'rotate(90deg)',
            transition: 'transform 0.15s',
          }} />
        </button>
      </div>
      {dropdown}
    </>
  )
}
