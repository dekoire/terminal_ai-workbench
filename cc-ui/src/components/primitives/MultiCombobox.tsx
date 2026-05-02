/**
 * MultiCombobox — reusable multi-select dropdown styled for Codera AI.
 * Uses a React portal so the dropdown is never clipped by overflow:hidden parents.
 *
 * Usage:
 *   <MultiCombobox
 *     options={[{ id, label, desc, color, Icon, badge }]}
 *     value={['id1', 'id2']}
 *     onChange={id => toggle(id)}
 *     onClear={() => setEmpty()}
 *     placeholder="Filter…"
 *     dropdownLabel="Abschnitt"
 *     align="right"          // dropdown opens left (default) or right
 *   />
 */
import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { IChev, ICheck } from './Icons'
import type { LucideProps } from 'lucide-react'

export interface ComboOption {
  id:     string
  label:  string
  desc?:  string
  color?: string                             // accent color for this option
  Icon?:  React.ComponentType<LucideProps>   // lucide icon
  badge?: number                             // small count shown on the right
}

interface MultiComboboxProps {
  options:        ComboOption[]
  value:          string[]                   // selected ids
  onChange:       (id: string) => void       // toggle one
  onClear?:       () => void
  placeholder?:   string                     // button text when nothing selected
  dropdownLabel?: string                     // small header inside dropdown
  align?:         'left' | 'right'           // which side the dropdown aligns to
  disabled?:      boolean
  style?:         React.CSSProperties        // override button wrapper style
}

export function MultiCombobox({
  options, value, onChange, onClear,
  placeholder = 'Auswählen…',
  dropdownLabel,
  align = 'left',
  disabled = false,
  style,
}: MultiComboboxProps) {
  const [open, setOpen] = useState(false)
  const [dropPos, setDropPos] = useState<{ top: number; left?: number; right?: number; minWidth: number } | null>(null)

  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropRef    = useRef<HTMLDivElement>(null)
  const hasValue   = value.length > 0

  // Calculate dropdown position from trigger bounding rect (opens upward if little space below)
  const updatePosition = () => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const estimatedH = 320
    const spaceBelow = window.innerHeight - rect.bottom
    const openDown   = spaceBelow >= estimatedH || spaceBelow >= rect.top
    const top        = openDown ? rect.bottom + 6 : rect.top - 6 - estimatedH

    if (align === 'right') {
      setDropPos({ top, right: window.innerWidth - rect.right, minWidth: 260 })
    } else {
      setDropPos({ top, left: rect.left, minWidth: 260 })
    }
  }

  const handleOpen = () => {
    if (disabled) return
    if (!open) {
      updatePosition()
      setOpen(true)
    } else {
      setOpen(false)
    }
  }

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const t = e.target as Node
      if (
        triggerRef.current && !triggerRef.current.contains(t) &&
        dropRef.current   && !dropRef.current.contains(t)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Reposition on scroll/resize
  useEffect(() => {
    if (!open) return
    const update = () => updatePosition()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [open, align])

  const dropdown = open && dropPos ? createPortal(
    <div
      ref={dropRef}
      style={{
        position: 'fixed',
        top:      dropPos.top,
        left:     dropPos.left,
        right:    dropPos.right,
        zIndex:   9999,
        background: 'var(--bg-1)',
        border: '1px solid var(--line-strong)',
        borderRadius: 10,
        boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
        minWidth: dropPos.minWidth,
        maxHeight: 320,
        overflowY: 'auto',
        padding: '6px 0',
      }}
    >
      {/* Header */}
      {(dropdownLabel || (onClear && hasValue)) && (
        <div style={{
          padding: '6px 13px 5px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid var(--line)',
          marginBottom: 2,
        }}>
          {dropdownLabel && (
            <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
              {dropdownLabel}
            </span>
          )}
          {onClear && hasValue && (
            <button
              onClick={e => { e.stopPropagation(); onClear() }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 10, padding: 0, fontFamily: 'var(--font-ui)', marginLeft: 'auto' }}
            >
              Zurücksetzen
            </button>
          )}
        </div>
      )}

      {/* Options */}
      {options.map(opt => {
        const active = value.includes(opt.id)
        const c = opt.color ?? 'var(--accent)'
        return (
          <div
            key={opt.id}
            onClick={() => onChange(opt.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 9,
              padding: '7px 13px', cursor: 'pointer',
              background: active ? c + '12' : 'transparent',
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--bg-2)' }}
            onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = active ? c + '12' : 'transparent' }}
          >
            {/* Checkbox */}
            <div style={{
              width: 14, height: 14, borderRadius: 4, flexShrink: 0,
              border: `1.5px solid ${active ? c : 'var(--fg-3)'}`,
              background: active ? c : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.12s',
            }}>
              {active && <ICheck style={{ width: 9, height: 9, color: '#fff' }} />}
            </div>

            {/* Icon (optional) */}
            {opt.Icon && (
              <opt.Icon style={{ width: 13, height: 13, color: active ? c : 'var(--fg-3)', flexShrink: 0 }} />
            )}

            {/* Label + description */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: active ? 700 : 500, color: active ? c : 'var(--fg-0)', lineHeight: 1.3 }}>
                {opt.label}
              </div>
              {opt.desc && (
                <div style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 1 }}>{opt.desc}</div>
              )}
            </div>

            {/* Badge (count etc.) */}
            {opt.badge !== undefined && (
              <span style={{
                fontSize: 10, flexShrink: 0,
                color: active ? c : 'var(--fg-3)',
                background: active ? c + '20' : 'var(--bg-3)',
                borderRadius: 99, padding: '1px 7px',
                fontFamily: 'var(--font-mono)', fontWeight: 600,
              }}>
                {opt.badge}
              </span>
            )}
          </div>
        )
      })}
    </div>,
    document.body
  ) : null

  return (
    <>
      <div style={{ position: 'relative', display: 'inline-block', ...style }}>
        {/* ── Trigger button ── */}
        <button
          ref={triggerRef}
          disabled={disabled}
          onClick={handleOpen}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 9px', borderRadius: 7,
            border: `1px solid ${hasValue ? 'var(--accent)' : 'var(--line)'}`,
            background: hasValue ? 'var(--accent-soft)' : 'var(--bg-2)',
            color: hasValue ? 'var(--accent)' : 'var(--fg-2)',
            cursor: disabled ? 'default' : 'pointer',
            fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 500,
            transition: 'border-color 0.15s, background 0.15s',
            opacity: disabled ? 0.5 : 1,
            whiteSpace: 'nowrap',
          }}
        >
          {hasValue
            ? value.map(id => {
                const opt = options.find(o => o.id === id)
                if (!opt) return null
                const c = opt.color ?? 'var(--accent)'
                return (
                  <span
                    key={id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 3,
                      padding: '1px 6px', borderRadius: 99,
                      background: c + '28', border: `1px solid ${c}66`,
                      color: c, fontSize: 9.5, fontWeight: 700,
                    }}
                  >
                    {opt.Icon && <opt.Icon style={{ width: 9, height: 9 }} />}
                    {opt.label}
                  </span>
                )
              })
            : <span>{placeholder}</span>
          }
          <IChev style={{
            width: 11, height: 11, opacity: 0.45, flexShrink: 0,
            transform: open ? 'rotate(270deg)' : 'rotate(90deg)',
            transition: 'transform 0.15s',
          }} />
        </button>
      </div>

      {/* ── Portal dropdown ── */}
      {dropdown}
    </>
  )
}
