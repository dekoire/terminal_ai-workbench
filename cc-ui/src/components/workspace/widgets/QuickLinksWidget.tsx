import { useState, useRef } from 'react'
import { useAppStore } from '../../../store/useAppStore'
import type { QuickLink } from '../../../store/useAppStore'
import { IPlus, IChevUp, IChevDown, IDrag, IClose, IEdit, ITrash } from '../../primitives/Icons'

// ── QuickLinksModal ───────────────────────────────────────────────────────────
// Full-screen modal to add, edit, remove and reorder quick links.

function QuickLinksModal({ onClose }: { onClose: () => void }) {
  const quickLinks    = useAppStore(s => s.quickLinks)
  const setQuickLinks = useAppStore(s => s.setQuickLinks)

  const [links, setLinks]           = useState<QuickLink[]>(quickLinks)
  const [editId, setEditId]         = useState<string | null>(null)
  const [editTitle, setEditTitle]   = useState('')
  const [editUrl, setEditUrl]       = useState('')
  const [newTitle, setNewTitle]     = useState('')
  const [newUrl, setNewUrl]         = useState('')
  const [dragIdx, setDragIdx]       = useState<number | null>(null)
  const [dragOver, setDragOver]     = useState<number | null>(null)

  const saveAll = (updated: QuickLink[]) => {
    setLinks(updated)
    setQuickLinks(updated)
  }

  const startEdit = (link: QuickLink) => {
    setEditId(link.id)
    setEditTitle(link.title)
    setEditUrl(link.url)
  }

  const commitEdit = () => {
    if (!editId) return
    saveAll(links.map(l => l.id === editId ? { ...l, title: editTitle.trim() || editUrl, url: editUrl.trim() } : l))
    setEditId(null)
  }

  const addLink = () => {
    const url = newUrl.trim()
    if (!url) return
    const id = `ql-${Date.now()}`
    const title = newTitle.trim() || url.replace(/^https?:\/\//, '').split('/')[0]
    saveAll([...links, { id, title, url }])
    setNewTitle('')
    setNewUrl('')
  }

  const removeLink = (id: string) => saveAll(links.filter(l => l.id !== id))

  const handleDrop = (targetIdx: number) => {
    if (dragIdx === null || dragIdx === targetIdx) return
    const arr = [...links]
    const [moved] = arr.splice(dragIdx, 1)
    arr.splice(targetIdx, 0, moved)
    saveAll(arr)
    setDragIdx(null)
    setDragOver(null)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)' }}
      onClick={onClose}>
      <div style={{ width: 480, minHeight: 280, maxHeight: '80vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-1)', border: '1px solid var(--line-strong)', borderRadius: 12, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)' }}>Quick Links verwalten</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-2)', display: 'flex', padding: 2 }}>
            <IClose style={{ width: 14, height: 14 }} />
          </button>
        </div>

        {/* Link list */}
        <div style={{ flex: 1, minHeight: 80, overflowY: 'auto', padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {links.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--fg-3)', textAlign: 'center', padding: '20px 0' }}>Noch keine Links — füge unten einen hinzu.</div>
          )}
          {links.map((link, i) => (
            <div key={link.id}
              draggable
              onDragStart={() => setDragIdx(i)}
              onDragOver={e => { e.preventDefault(); setDragOver(i) }}
              onDrop={() => handleDrop(i)}
              onDragEnd={() => { setDragIdx(null); setDragOver(null) }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, background: dragOver === i ? 'var(--bg-3)' : 'var(--bg-2)', border: `1px solid ${dragOver === i ? 'var(--accent-line)' : 'var(--line)'}`, cursor: 'grab', transition: 'border-color 0.1s' }}>
              <img src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(link.url)}&sz=16`}
                style={{ width: 16, height: 16, flexShrink: 0, borderRadius: 3 }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
              {editId === link.id ? (
                <>
                  <input value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="Titel" style={{ flex: '0 0 120px', padding: '3px 7px', borderRadius: 5, border: '1px solid var(--line-strong)', background: 'var(--bg-1)', color: 'var(--fg-0)', fontSize: 11, fontFamily: 'var(--font-ui)', outline: 'none' }} autoFocus />
                  <input value={editUrl} onChange={e => setEditUrl(e.target.value)} placeholder="https://…" style={{ flex: 1, padding: '3px 7px', borderRadius: 5, border: '1px solid var(--line-strong)', background: 'var(--bg-1)', color: 'var(--fg-0)', fontSize: 11, fontFamily: 'var(--font-mono)', outline: 'none' }} onKeyDown={e => e.key === 'Enter' && commitEdit()} />
                  <button onClick={commitEdit} style={{ background: 'var(--accent)', color: 'var(--accent-fg)', border: 'none', borderRadius: 5, padding: '3px 8px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>✓</button>
                  <button onClick={() => setEditId(null)} style={{ background: 'none', border: 'none', color: 'var(--fg-3)', cursor: 'pointer', fontSize: 14, padding: '0 2px' }}>✕</button>
                </>
              ) : (
                <>
                  <span style={{ flex: 1, fontSize: 12, color: 'var(--fg-0)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{link.title}</span>
                  <span style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{link.url.replace(/^https?:\/\//, '')}</span>
                  <button onClick={() => startEdit(link)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-3)', display: 'flex', padding: 2 }} title="Bearbeiten">
                    <IEdit style={{ width: 11, height: 11 }} />
                  </button>
                  <button onClick={() => removeLink(link.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-3)', display: 'flex', padding: 2 }} title="Entfernen">
                    <ITrash style={{ width: 11, height: 11 }} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Add new link */}
        <div style={{ padding: '10px 16px 14px', borderTop: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0, background: 'var(--bg-1)' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Titel (optional)" style={{ flex: 1, padding: '7px 10px', borderRadius: 6, border: '1px solid var(--line-strong)', background: 'var(--bg-2)', color: 'var(--fg-0)', fontSize: 11.5, fontFamily: 'var(--font-ui)', outline: 'none' }} />
            <input value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="https://…" style={{ flex: 1, padding: '7px 10px', borderRadius: 6, border: '1px solid var(--line-strong)', background: 'var(--bg-2)', color: 'var(--fg-0)', fontSize: 11.5, fontFamily: 'var(--font-mono)', outline: 'none' }} onKeyDown={e => e.key === 'Enter' && addLink()} />
          </div>
          <button onClick={addLink} style={{ background: 'var(--accent)', color: 'var(--accent-fg)', border: 'none', borderRadius: 6, padding: '8px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)', width: '100%' }}>
            Hinzufügen
          </button>
        </div>
      </div>
    </div>
  )
}

// ── QuickLinksWidget ──────────────────────────────────────────────────────────
// Collapsible list of user-defined quick links with drag-to-reorder.
// Used in both LeftSidebar (Session tab sections) and RightSidebar.

const QL_LIMIT = 4

export function QuickLinksWidget() {
  const quickLinks    = useAppStore(s => s.quickLinks)
  const setQuickLinks = useAppStore(s => s.setQuickLinks)
  const [showModal, setShowModal] = useState(false)
  const [open, setOpen]           = useState(true)
  const [expanded, setExpanded]   = useState(false)
  const dragQLIdx = useRef<number>(-1)
  const [dragOverQL, setDragOverQL] = useState<number>(-1)

  const openLink = (url: string) => window.open(url, '_blank', 'noopener,noreferrer')

  const visibleLinks = quickLinks.length > QL_LIMIT && !expanded
    ? quickLinks.slice(0, QL_LIMIT)
    : quickLinks
  const hiddenCount = quickLinks.length - QL_LIMIT

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        {/* Section header */}
        <div
          onClick={() => setOpen(o => !o)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none', paddingBottom: open ? 6 : 0 }}
        >
          <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--fg-3)', fontWeight: 500, flex: 1 }}>
            Quick Links
          </span>
          <button
            onClick={e => { e.stopPropagation(); setShowModal(true) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-2)', display: 'flex', alignItems: 'center', padding: '1px 3px', borderRadius: 4 }}
            title="Link hinzufügen"
          >
            <IPlus style={{ width: 12, height: 12 }} />
          </button>
          {open
            ? <IChevUp   style={{ width: 11, height: 11, color: 'var(--fg-3)', flexShrink: 0 }} />
            : <IChevDown style={{ width: 11, height: 11, color: 'var(--fg-3)', flexShrink: 0 }} />
          }
        </div>

        {/* Section body */}
        {open && (
          <div style={{ background: 'var(--bg-2)', border: '0.5px solid var(--line-strong)', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: 8 }}>
            {quickLinks.length === 0 ? (
              <div style={{ fontSize: 11, color: 'var(--fg-3)', textAlign: 'center', padding: '4px 0' }}>
                Noch keine Quick Links angelegt
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {visibleLinks.map((link, idx) => (
                  <div
                    key={link.id}
                    draggable
                    onDragStart={() => { dragQLIdx.current = idx }}
                    onDragOver={e => { e.preventDefault(); setDragOverQL(idx) }}
                    onDragLeave={() => setDragOverQL(-1)}
                    onDrop={e => {
                      e.preventDefault()
                      const from = dragQLIdx.current
                      if (from === idx || from < 0) { setDragOverQL(-1); return }
                      const reordered = [...quickLinks]
                      const [moved] = reordered.splice(from, 1)
                      reordered.splice(idx, 0, moved)
                      setQuickLinks(reordered)
                      dragQLIdx.current = -1
                      setDragOverQL(-1)
                    }}
                    onDragEnd={() => { dragQLIdx.current = -1; setDragOverQL(-1) }}
                    style={{
                      borderTop: dragOverQL === idx && dragQLIdx.current > idx ? '2px solid var(--accent)' : '2px solid transparent',
                      borderBottom: dragOverQL === idx && dragQLIdx.current < idx ? '2px solid var(--accent)' : '2px solid transparent',
                      borderRadius: 6,
                    }}
                  >
                    <button onClick={() => openLink(link.url)} title={link.url}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px', borderRadius: 6, background: 'var(--card-bg)', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left', transition: 'background 0.12s' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--accent-soft)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--card-bg)' }}>
                      <IDrag style={{ width: 10, height: 10, color: 'var(--fg-3)', flexShrink: 0, opacity: 0.5, cursor: 'grab' }} />
                      <img src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(link.url)}&sz=32`}
                        style={{ width: 14, height: 14, borderRadius: 3, flexShrink: 0 }}
                        onError={e => { (e.target as HTMLImageElement).src = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="%23888"/><text x="12" y="16" text-anchor="middle" fill="white" font-size="12">${encodeURIComponent(link.title.charAt(0).toUpperCase())}</text></svg>` }} />
                      <span style={{ flex: 1, fontSize: 11.5, color: 'var(--fg-0)' }}>{link.title}</span>
                      <span style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', maxWidth: 120, flexShrink: 0 }}>{link.url.replace(/^https?:\/\//, '').split('/')[0]}</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
            {/* Expand / collapse toggle */}
            {hiddenCount > 0 && (
              <button
                onClick={() => setExpanded(e => !e)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '7px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, width: '100%', color: 'var(--fg-3)', fontSize: 11, fontFamily: 'var(--font-ui)' }}
              >
                {expanded
                  ? <><IChevUp style={{ width: 11, height: 11 }} /> Weniger anzeigen</>
                  : <><IChevDown style={{ width: 11, height: 11 }} /> {hiddenCount} weitere…</>
                }
              </button>
            )}
          </div>
        )}
      </div>

      {showModal && <QuickLinksModal onClose={() => setShowModal(false)} />}
    </>
  )
}
