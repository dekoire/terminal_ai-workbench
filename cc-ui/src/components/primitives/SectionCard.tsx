import React, { useState } from 'react'
import { IChevUp, IChevDown } from './Icons'

// ── SectionCard ───────────────────────────────────────────────────────────────
// Unified collapsible section card used in LeftSidebar and RightSidebar.
// Replaces CollapsibleSection (LeftSidebar) and Card (RightSidebar) which had
// nearly identical designs but two separate implementations.
//
// Design:
//  • Header: 10px uppercase, letterSpacing 0.6, var(--fg-3), weight 500
//  • Content: var(--bg-2) background, var(--line-strong) border, borderRadius 10
//  • Padding: 10px 12px inside content (optional via noPadding prop)
//  • Shadow: 0 1px 3px rgba(0,0,0,0.1) on content
//  • Action button color: var(--fg-2) (consistent across both panels)

interface SectionCardProps {
  label: string
  count?: number
  defaultOpen?: boolean
  collapsible?: boolean      // default: true
  action?: React.ReactNode   // button(s) in header right area (+ add etc.)
  noPadding?: boolean        // skip 10px 12px content padding (for list items)
  noMargin?: boolean         // skip marginBottom: 20 (for inline placement)
  children: React.ReactNode
}

export function SectionCard({
  label,
  count,
  defaultOpen = true,
  collapsible = true,
  action,
  noPadding = false,
  noMargin = false,
  children,
}: SectionCardProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div style={{ marginBottom: noMargin ? 0 : 20 }}>
      {/* Header */}
      <div
        onClick={collapsible ? () => setOpen(o => !o) : undefined}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          cursor: collapsible ? 'pointer' : 'default',
          userSelect: 'none',
          paddingBottom: open ? 6 : 0,
        }}
      >
        <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--fg-3)', fontWeight: 500, flex: 1, display: 'flex', alignItems: 'center', gap: 5 }}>
          {label}
          {count != null && <span style={{ fontWeight: 400, letterSpacing: 0 }}>({count})</span>}
        </span>
        {action && (
          <span onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', color: 'var(--fg-2)' }}>
            {action}
          </span>
        )}
        {collapsible && (open
          ? <IChevUp   style={{ width: 11, height: 11, color: 'var(--fg-3)', flexShrink: 0 }} />
          : <IChevDown style={{ width: 11, height: 11, color: 'var(--fg-3)', flexShrink: 0 }} />
        )}
      </div>

      {/* Content */}
      {open && React.Children.count(children) > 0 && (
        <div style={{
          background: 'var(--bg-2)',
          border: '0.5px solid var(--line-strong)',
          borderRadius: 10,
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          ...(noPadding ? {} : { padding: '10px 12px' }),
        }}>
          {children}
        </div>
      )}
    </div>
  )
}
