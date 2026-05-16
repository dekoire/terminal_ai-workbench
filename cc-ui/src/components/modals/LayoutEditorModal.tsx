import { useState, useRef } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { DEFAULT_LAYOUT_SECTIONS } from '../../store/useAppStore'
import type { LayoutSection, AllSectionId } from '../../store/useAppStore'
import { IClose, IFolder, ITag, IGit, IExternalLink, IKanban, IBrain, ITerminal } from '../primitives/Icons'

const SECTION_META: Record<AllSectionId, { label: string; icon: React.ReactNode }> = {
  workspaces:          { label: 'Workspaces',      icon: <IFolder style={{ width: 11, height: 11 }} /> },
  prompts:             { label: 'Prompts',          icon: <ITag style={{ width: 11, height: 11 }} /> },
  github:              { label: 'GitHub',           icon: <IGit style={{ width: 11, height: 11 }} /> },
  quicklinks:          { label: 'Quick Links',      icon: <IExternalLink style={{ width: 11, height: 11 }} /> },
  tasks:               { label: 'Tasks',            icon: <IKanban style={{ width: 11, height: 11 }} /> },
  kontextlog:          { label: 'Kontext Log',      icon: <IBrain style={{ width: 11, height: 11 }} /> },
  'projekt-terminal':  { label: 'Session Card',     icon: <ITerminal style={{ width: 11, height: 11 }} /> },
}

interface Props { onClose: () => void }

export function LayoutEditorModal({ onClose }: Props) {
  const layoutSections    = useAppStore(s => s.layoutSections ?? DEFAULT_LAYOUT_SECTIONS)
  const setLayoutSections = useAppStore(s => s.setLayoutSections)

  const [sections, setSections] = useState<LayoutSection[]>(() => [...layoutSections])

  const draggingId   = useRef<AllSectionId | null>(null)
  const draggingFrom = useRef<'left' | 'right' | null>(null)
  const [dropHint, setDropHint] = useState<{ panel: 'left' | 'right'; idx: number } | null>(null)

  const leftSections  = () => sections.filter(s => s.panel === 'left')
  const rightSections = () => sections.filter(s => s.panel === 'right')

  const handleDragStart = (e: React.DragEvent, id: AllSectionId, panel: 'left' | 'right') => {
    draggingId.current   = id
    draggingFrom.current = panel
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragEnd = () => {
    draggingId.current   = null
    draggingFrom.current = null
    setDropHint(null)
  }

  const handleDrop = (e: React.DragEvent, targetPanel: 'left' | 'right', targetIdx: number) => {
    e.preventDefault()
    e.stopPropagation()
    const id   = draggingId.current
    const from = draggingFrom.current
    if (!id || !from) return

    setSections(prev => {
      const item = prev.find(s => s.id === id)
      if (!item) return prev
      const without    = prev.filter(s => s.id !== id)
      const newItem    = { ...item, panel: targetPanel }
      const leftItems  = without.filter(s => s.panel === 'left')
      const rightItems = without.filter(s => s.panel === 'right')
      if (targetPanel === 'left') {
        leftItems.splice(targetIdx, 0, newItem)
        return [...leftItems, ...rightItems]
      } else {
        rightItems.splice(targetIdx, 0, newItem)
        return [...leftItems, ...rightItems]
      }
    })

    draggingId.current   = null
    draggingFrom.current = null
    setDropHint(null)
  }

  const handleDropColumn = (e: React.DragEvent, targetPanel: 'left' | 'right') => {
    e.preventDefault()
    const id   = draggingId.current
    const from = draggingFrom.current
    if (!id || !from) return

    setSections(prev => {
      const item = prev.find(s => s.id === id)
      if (!item) return prev
      const without    = prev.filter(s => s.id !== id)
      const newItem    = { ...item, panel: targetPanel }
      const leftItems  = without.filter(s => s.panel === 'left')
      const rightItems = without.filter(s => s.panel === 'right')
      if (targetPanel === 'left') {
        return [...leftItems, newItem, ...rightItems]
      } else {
        return [...leftItems, ...rightItems, newItem]
      }
    })

    draggingId.current   = null
    draggingFrom.current = null
    setDropHint(null)
  }

  const toggleVisible = (id: AllSectionId) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, visible: !s.visible } : s))
  }

  const handleSave  = () => { setLayoutSections(sections); onClose() }
  const handleReset = () => setSections([...DEFAULT_LAYOUT_SECTIONS])

  const renderCard = (s: LayoutSection, idx: number, panel: 'left' | 'right') => {
    const meta       = SECTION_META[s.id]
    const isDragging = draggingId.current === s.id
    const isHint     = dropHint?.panel === panel && dropHint?.idx === idx

    return (
      <div key={s.id}>
        {draggingId.current && draggingId.current !== s.id && (
          <div
            onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDropHint({ panel, idx }) }}
            onDrop={e => handleDrop(e, panel, idx)}
            style={{
              height: isHint ? 30 : 5,
              borderRadius: 5,
              background: isHint ? 'var(--accent-soft)' : 'transparent',
              border: isHint ? '1.5px dashed var(--accent-line)' : '1.5px solid transparent',
              transition: 'all 0.12s',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: isHint ? 4 : 0,
            }}
          >
            {isHint && <span style={{ fontSize: 9, color: 'var(--accent)', fontWeight: 600 }}>Hier ablegen</span>}
          </div>
        )}
        <div
          draggable
          onDragStart={e => handleDragStart(e, s.id, panel)}
          onDragEnd={handleDragEnd}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '7px 8px', borderRadius: 7, cursor: 'grab',
            background: isDragging ? 'transparent' : s.visible ? 'var(--bg-2)' : 'transparent',
            border: `0.5px solid ${isDragging ? 'var(--line)' : s.visible ? 'var(--line-strong)' : 'var(--line)'}`,
            opacity: isDragging ? 0.3 : s.visible ? 1 : 0.5,
            transition: 'all 0.1s', userSelect: 'none', marginBottom: 4,
          }}
        >
          <span style={{ color: 'var(--fg-3)', fontSize: 9, letterSpacing: 1, cursor: 'grab', flexShrink: 0 }}>⠿</span>
          <span style={{ color: s.visible ? 'var(--fg-2)' : 'var(--fg-3)', flexShrink: 0, display: 'flex', alignItems: 'center' }}>{meta.icon}</span>
          <span style={{ flex: 1, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6, color: s.visible ? 'var(--fg-1)' : 'var(--fg-3)' }}>{meta.label}</span>
          <button
            onMouseDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); e.preventDefault(); toggleVisible(s.id) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, color: s.visible ? 'var(--ok)' : 'var(--fg-3)', display: 'flex', alignItems: 'center', borderRadius: 4, flexShrink: 0 }}
            title={s.visible ? 'Ausblenden' : 'Einblenden'}
          >
            {s.visible
              ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
              : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
            }
          </button>
        </div>
      </div>
    )
  }

  const renderColumn = (panel: 'left' | 'right', label: string, items: LayoutSection[]) => (
    <div
      onDragOver={e => { e.preventDefault(); setDropHint({ panel, idx: items.length }) }}
      onDrop={e => handleDropColumn(e, panel)}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropHint(null) }}
      style={{ width: 180, display: 'flex', flexDirection: 'column' }}
    >
      <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--fg-3)', fontWeight: 700, padding: '0 2px 8px', borderBottom: '1px solid var(--line)', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: 60, flex: 1 }}>
        {items.map((s, idx) => renderCard(s, idx, panel))}
        {draggingId.current && items.every(s => s.id !== draggingId.current) && items.length === 0 && (
          <div style={{ height: 44, borderRadius: 7, border: '1.5px dashed var(--accent-line)', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 500 }}>Hier ablegen</span>
          </div>
        )}
      </div>
    </div>
  )

  const left  = leftSections()
  const right = rightSections()

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--bg-1)', borderRadius: 12, border: '0.5px solid var(--line-strong)', boxShadow: '0 24px 80px rgba(0,0,0,0.6)', width: 700, maxWidth: '95vw', overflow: 'hidden' }}>

        {/* ── Modal header — clean, no traffic lights ── */}
        <div style={{ height: 44, background: 'var(--bg-2)', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', padding: '0 14px' }}>
          <span style={{ flex: 1, textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--fg-1)', fontFamily: 'var(--font-ui)', letterSpacing: -0.2 }}>Layout-Editor</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-3)', padding: 2, display: 'flex', alignItems: 'center', borderRadius: 4 }}>
            <IClose style={{ width: 13, height: 13 }} />
          </button>
        </div>

        {/* ── Wireframe ── */}
        <div style={{ padding: '16px 40px 48px' }}>
          <p style={{ margin: '0 0 12px', paddingTop: 20, fontSize: 11.5, color: 'var(--fg-3)', lineHeight: 1.6, textAlign: 'center' }}>
            Sektionen zwischen den Panels ziehen — jede Sektion erscheint nur einmal.
          </p>

          {/* App window wireframe */}
          <div style={{ border: '1px solid var(--line-strong)', borderRadius: 10, overflow: 'hidden', background: 'var(--bg-0)' }}>

            {/* ── Wireframe title bar (Apple chrome) ── */}
            <div style={{ height: 32, background: 'var(--bg-2)', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', padding: '0 10px', gap: 6, flexShrink: 0 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f57', flexShrink: 0 }} />
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#febc2e', flexShrink: 0 }} />
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#28c840', flexShrink: 0 }} />
              <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--bg-3)', margin: '0 20px' }} />
              {/* Fake toolbar icons */}
              {[1,2,3,4].map(i => <div key={i} style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--bg-3)', flexShrink: 0 }} />)}
            </div>

            {/* ── Three-column body ── */}
            <div style={{ display: 'flex', minHeight: 260 }}>

              {/* Left sidebar column */}
              <div style={{ width: 210, borderRight: '1px solid var(--line)', background: 'var(--bg-1)', padding: '14px 10px', display: 'flex', flexDirection: 'column' }}>
                {/* Fake sidebar title row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14, paddingBottom: 10, borderBottom: '0.5px solid var(--line)' }}>
                  <div style={{ width: 18, height: 18, borderRadius: 5, background: 'var(--bg-3)', border: '1px solid var(--line)', flexShrink: 0 }} />
                  <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--bg-3)' }} />
                </div>
                {renderColumn('left', 'Linkes Panel', left)}
              </div>

              {/* Center — chat wireframe */}
              <div style={{ flex: 1, background: 'var(--bg-0)', display: 'flex', flexDirection: 'column' }}>
                {/* Fake session tab bar — no highlight boxes, just plain text */}
                <div style={{ height: 32, borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', padding: '0 10px', gap: 10, flexShrink: 0 }}>
                  <span style={{ fontSize: 8.5, color: 'var(--fg-2)', fontWeight: 600, borderBottom: '1.5px solid var(--fg-3)', paddingBottom: 1 }}>Tab 1</span>
                  <span style={{ fontSize: 8.5, color: 'var(--fg-3)' }}>Tab 2</span>
                  <span style={{ fontSize: 8.5, color: 'var(--fg-3)' }}>+ Neu</span>
                </div>

                {/* Chat messages — centered, no avatars, all gray */}
                <div style={{ flex: 1, padding: '14px 16px 10px', display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden', alignItems: 'center' }}>
                  {/* AI bubble — left-ish */}
                  <div style={{ alignSelf: 'flex-start', background: 'var(--bg-2)', border: '0.5px solid var(--line-strong)', borderRadius: '4px 10px 10px 10px', padding: '7px 10px', maxWidth: '80%' }}>
                    <div style={{ height: 5, width: 100, borderRadius: 3, background: 'var(--line-strong)', marginBottom: 5 }} />
                    <div style={{ height: 5, width: 75, borderRadius: 3, background: 'var(--bg-3)' }} />
                  </div>
                  {/* User bubble — right, gray */}
                  <div style={{ alignSelf: 'flex-end', background: 'var(--bg-3)', border: '0.5px solid var(--line-strong)', borderRadius: '10px 4px 10px 10px', padding: '7px 10px', maxWidth: '75%' }}>
                    <div style={{ height: 5, width: 85, borderRadius: 3, background: 'var(--line-strong)', marginBottom: 5 }} />
                    <div style={{ height: 5, width: 55, borderRadius: 3, background: 'var(--line)' }} />
                  </div>
                  {/* AI bubble 2 */}
                  <div style={{ alignSelf: 'flex-start', background: 'var(--bg-2)', border: '0.5px solid var(--line-strong)', borderRadius: '4px 10px 10px 10px', padding: '7px 10px', maxWidth: '80%' }}>
                    <div style={{ height: 5, width: 110, borderRadius: 3, background: 'var(--line-strong)', marginBottom: 5 }} />
                    <div style={{ height: 5, width: 80, borderRadius: 3, background: 'var(--bg-3)', marginBottom: 5 }} />
                    <div style={{ height: 5, width: 60, borderRadius: 3, background: 'var(--bg-3)' }} />
                  </div>
                </div>

                {/* Chat input — no top border */}
                <div style={{ padding: '8px 10px 10px', flexShrink: 0 }}>
                  <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line-strong)', borderRadius: 8, padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--bg-3)' }} />
                    <div style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--accent)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right panel column */}
              <div style={{ width: 210, borderLeft: '1px solid var(--line)', background: 'var(--bg-1)', padding: '14px 10px', display: 'flex', flexDirection: 'column' }}>
                {/* Fake tab bar — plain text, no highlight boxes */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 14, paddingBottom: 10, borderBottom: '0.5px solid var(--line)', alignItems: 'center' }}>
                  <span style={{ fontSize: 9, color: 'var(--fg-2)', fontWeight: 600, borderBottom: '1.5px solid var(--fg-3)', paddingBottom: 1 }}>Tab 1</span>
                  <span style={{ fontSize: 9, color: 'var(--fg-3)' }}>Git</span>
                  <span style={{ fontSize: 9, color: 'var(--fg-3)' }}>Files</span>
                </div>
                {renderColumn('right', 'Rechtes Panel', right)}
              </div>

            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', borderTop: '1px solid var(--line)' }}>
          <button
            onClick={handleReset}
            style={{ background: 'none', border: '1px solid var(--line-strong)', padding: '7px 14px', borderRadius: 7, fontSize: 11.5, color: 'var(--fg-2)', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontWeight: 500 }}
          >
            Zurücksetzen
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onClose}
              style={{ background: 'none', border: '1px solid var(--line-strong)', padding: '7px 16px', borderRadius: 7, fontSize: 11.5, color: 'var(--fg-2)', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontWeight: 500 }}
            >
              Abbrechen
            </button>
            <button
              onClick={handleSave}
              style={{ background: 'var(--accent)', color: 'var(--accent-fg)', border: 'none', padding: '7px 20px', borderRadius: 7, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)' }}
            >
              Speichern
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
