import React, { useState, useRef, useCallback, useEffect } from 'react'
import { useAppStore } from '../../store/useAppStore'
import type { KanbanTicket, KanbanStatus, TicketPriority, TicketType } from '../../store/useAppStore'
import { IClose, IPlus, ITrash, IFile, ISpark, IEdit, ICopy, IKanban, IBug, IStar, IUser } from '../primitives/Icons'

// ── Type & Priority config ─────────────────────────────────────────────────────

const PRIORITY_CFG: Record<TicketPriority, { label: string; color: string; bg: string; symbol: string }> = {
  low:      { label: 'Low',      color: 'var(--fg-3)',    bg: 'var(--bg-3)',                   symbol: '↓' },
  medium:   { label: 'Medium',   color: 'var(--warn)',    bg: 'rgba(244,195,101,0.12)',         symbol: '→' },
  high:     { label: 'High',     color: 'var(--accent)',  bg: 'rgba(255,138,91,0.12)',          symbol: '↑' },
  critical: { label: 'Critical', color: 'var(--err)',     bg: 'rgba(239,122,122,0.12)',         symbol: '!!' },
}

const TYPE_CFG: Record<TicketType, { label: string; color: string }> = {
  story: { label: 'User Story', color: 'var(--ok)'   },
  nfc:   { label: 'NRF',        color: '#5b9cf6'     },
  bug:   { label: 'Bug',        color: 'var(--err)'  },
}

function TypeIcon({ type, size = 11 }: { type?: TicketType; size?: number }) {
  const s: React.CSSProperties = { width: size, height: size, flexShrink: 0 }
  if (type === 'bug') return <IBug style={{ ...s, color: TYPE_CFG.bug.color }} />
  if (type === 'nfc') return <IStar style={{ ...s, color: TYPE_CFG.nfc.color }} />
  return <IUser style={{ ...s, color: TYPE_CFG.story.color }} />
}

function PriorityBadge({ priority }: { priority?: TicketPriority }) {
  const p = PRIORITY_CFG[priority ?? 'medium']
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, letterSpacing: 0.3,
      color: p.color, background: p.bg,
      border: `1px solid ${p.color}55`,
      borderRadius: 6, padding: '1px 5px', flexShrink: 0,
    }}>
      {p.symbol} {p.label}
    </span>
  )
}

function TypePriorityRow({ type, setType, priority, setPriority }: {
  type: TicketType; setType: (t: TicketType) => void
  priority: TicketPriority; setPriority: (p: TicketPriority) => void
}) {
  const segBase: React.CSSProperties = { padding: '3px 9px', fontSize: 11, borderRadius: 6, cursor: 'pointer', border: '1px solid var(--line)', background: 'var(--bg-3)', color: 'var(--fg-2)', fontWeight: 400 }
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      {/* Type */}
      <div style={{ display: 'flex', gap: 3 }}>
        {(Object.entries(TYPE_CFG) as [TicketType, typeof TYPE_CFG[TicketType]][]).map(([k, v]) => (
          <button key={k} onClick={() => setType(k)} style={{
            ...segBase,
            ...(type === k ? { background: v.color + '22', color: v.color, border: `1px solid ${v.color}88`, fontWeight: 600 } : {}),
          }}>
            {v.label}
          </button>
        ))}
      </div>
      <div style={{ width: 1, height: 16, background: 'var(--line)', flexShrink: 0 }} />
      {/* Priority */}
      <div style={{ display: 'flex', gap: 3 }}>
        {(Object.entries(PRIORITY_CFG) as [TicketPriority, typeof PRIORITY_CFG[TicketPriority]][]).map(([k, v]) => (
          <button key={k} onClick={() => setPriority(k)} style={{
            ...segBase,
            ...(priority === k ? { background: v.bg, color: v.color, border: `1px solid ${v.color}88`, fontWeight: 600 } : {}),
          }}>
            {v.symbol} {v.label}
          </button>
        ))}
      </div>
    </div>
  )
}

const COLUMNS: { id: KanbanStatus; label: string; color: string; bg: string }[] = [
  { id: 'backlog', label: 'Backlog', color: 'var(--fg-3)',  bg: 'rgba(120,114,108,0.12)' },
  { id: 'testing', label: 'Testing', color: 'var(--warn)',  bg: 'rgba(244,195,101,0.12)' },
  { id: 'done',    label: 'Done',    color: 'var(--ok)',    bg: 'rgba(124,217,168,0.12)' },
]

// US_PROMPT and ANALYSE_SYSTEM are now configurable in Settings → Vorlagen
// Defaults live in useAppStore DEFAULT_DOC_TEMPLATES ('ai-prompt-user-story-format', 'user-story-analyse')

interface Props {
  projectId: string
  projectName: string
  projectPath: string
  initialDetailId?: string   // pre-open a ticket in edit-detail on mount
  onClose: () => void
}

// ── Drag state type ────────────────────────────────────────────────────────────
interface DragState {
  ticketId: string
  ghost: HTMLElement
  offsetX: number
  offsetY: number
}

export function KanbanBoard({ projectId, projectName, projectPath, initialDetailId, onClose }: Props) {
  const { kanban, addKanbanTicket, moveKanbanTicket, removeKanbanTicket, updateKanbanTicket, setInputValue } = useAppStore()
  const tickets = kanban[projectId] ?? []

  const [newOpen, setNewOpen]   = useState(false)
  const [detail, setDetail]     = useState<KanbanTicket | null>(() => {
    if (initialDetailId) return tickets.find(t => t.id === initialDetailId) ?? null
    return null
  })
  const [dragOver, setDragOver] = useState<KanbanStatus | null>(null)

  // Refs for column hit-testing
  const colRefs = useRef<Partial<Record<KanbanStatus, HTMLDivElement>>>({})
  // Active drag state
  const dragState = useRef<DragState | null>(null)

  // Helper: which column rect contains the point?
  const getColumnAt = useCallback((x: number, y: number): KanbanStatus | null => {
    for (const col of COLUMNS) {
      const el = colRefs.current[col.id]
      if (!el) continue
      const r = el.getBoundingClientRect()
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return col.id
    }
    return null
  }, [])

  // Global pointer move / up listeners — installed once, read dragState ref
  useEffect(() => {
    function onMove(e: PointerEvent) {
      const ds = dragState.current
      if (!ds) return
      ds.ghost.style.left = `${e.clientX - ds.offsetX}px`
      ds.ghost.style.top  = `${e.clientY - ds.offsetY}px`
      setDragOver(getColumnAt(e.clientX, e.clientY))
    }

    function onUp(e: PointerEvent) {
      const ds = dragState.current
      if (!ds) return
      const col = getColumnAt(e.clientX, e.clientY)
      if (col) moveKanbanTicket(projectId, ds.ticketId, col)
      ds.ghost.remove()
      dragState.current = null
      setDragOver(null)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup',   onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup',   onUp)
    }
  }, [projectId, moveKanbanTicket, getColumnAt])

  // Start drag — called from TicketCard
  const startDrag = useCallback((e: React.PointerEvent, ticket: KanbanTicket) => {
    // Don't interfere with button clicks
    if ((e.target as HTMLElement).closest('button')) return
    e.preventDefault()

    const el  = e.currentTarget as HTMLElement
    const rect = el.getBoundingClientRect()

    // Clone the card as visual ghost
    const ghost = el.cloneNode(true) as HTMLElement
    ghost.style.cssText = [
      `position:fixed`,
      `left:${rect.left}px`,
      `top:${rect.top}px`,
      `width:${rect.width}px`,
      `pointer-events:none`,
      `z-index:9999`,
      `opacity:0.88`,
      `transform:rotate(1.5deg) scale(1.04)`,
      `transition:none`,
      `user-select:none`,
      `box-shadow:0 8px 24px rgba(0,0,0,0.45)`,
    ].join(';')
    document.body.appendChild(ghost)

    dragState.current = {
      ticketId: ticket.id,
      ghost,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    }
  }, [])

  function saveDetail(updated: KanbanTicket) {
    updateKanbanTicket(projectId, updated.id, {
      title: updated.title,
      text: updated.text,
      images: updated.images,
      type: updated.type,
      priority: updated.priority,
    })
    setDetail(null)
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '90vw', height: '90vh',
          background: 'var(--bg-1)', border: '1px solid var(--line)',
          borderRadius: 6, display: 'flex', flexDirection: 'column',
          overflow: 'hidden', boxShadow: '0 24px 72px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '11px 16px', borderBottom: '1px solid var(--line)', flexShrink: 0,
          background: 'var(--bg-2)',
        }}>
          <IKanban style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)', flex: 1 }}>
            {projectName} <span style={{ color: 'var(--fg-3)', fontWeight: 400 }}>· Kanban</span>
          </span>
          <span style={{ fontSize: 10.5, color: 'var(--fg-3)', marginRight: 4 }}>
            {tickets.length} Tickets
          </span>
          <button
            onClick={() => setNewOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '4px 11px',
              background: 'var(--accent)', color: 'var(--accent-fg, #1a1410)',
              border: 'none', borderRadius: 6, fontSize: 11.5, fontWeight: 500, cursor: 'pointer',
            }}
          >
            <IPlus style={{ width: 10, height: 10 }} /> New ticket
          </button>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-3)', display: 'flex', padding: 4 }}>
            <IClose />
          </button>
        </div>

        {/* Board */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 0 }}>
          {COLUMNS.map((col, i) => {
            const colTickets = tickets.filter(t => t.status === col.id)
            const isOver = dragOver === col.id
            return (
              <div
                key={col.id}
                ref={el => { if (el) colRefs.current[col.id] = el }}
                style={{
                  flex: 1, display: 'flex', flexDirection: 'column',
                  borderRight: i < COLUMNS.length - 1 ? '1px solid var(--line)' : 'none',
                  background: isOver ? col.bg : 'transparent',
                  transition: 'background 0.12s',
                  overflow: 'hidden',
                  outline: isOver ? `2px solid ${col.color}` : '2px solid transparent',
                  outlineOffset: '-2px',
                  borderRadius: isOver ? 2 : 0,
                }}
              >
                {/* Column header */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 14px 8px', flexShrink: 0,
                  borderBottom: `2px solid ${isOver ? col.color : 'transparent'}`,
                  transition: 'border-color 0.12s',
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: col.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--fg-2)', textTransform: 'uppercase', letterSpacing: 0.8, flex: 1 }}>
                    {col.label}
                  </span>
                  <span style={{
                    fontSize: 9.5, color: 'var(--fg-3)', background: 'var(--bg-3)',
                    border: '1px solid var(--line)', borderRadius: 99, padding: '1px 7px',
                  }}>
                    {colTickets.length}
                  </span>
                </div>

                {/* Tickets scroll area */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {colTickets.map(ticket => (
                    <TicketCard
                      key={ticket.id}
                      ticket={ticket}
                      isDragging={dragState.current?.ticketId === ticket.id}
                      onPointerDown={e => startDrag(e, ticket)}
                      onEdit={() => setDetail({ ...ticket })}
                      onRemove={() => removeKanbanTicket(projectId, ticket.id)}
                      onDuplicate={() => addKanbanTicket(projectId, {
                        title: `Kopie von ${ticket.title}`,
                        text: ticket.text,
                        status: ticket.status,
                        type: ticket.type,
                        priority: ticket.priority,
                        images: ticket.images ? [...ticket.images] : undefined,
                      })}
                      onDevelop={() => {
                        const content = ticket.text
                          ? `${ticket.title}\n\n${ticket.text}`
                          : ticket.title
                        setInputValue(content)
                        onClose()
                      }}
                    />
                  ))}
                  {colTickets.length === 0 && (
                    <div style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: isOver ? col.color : 'var(--fg-3)',
                      fontSize: 11, opacity: isOver ? 0.7 : 0.35,
                      paddingTop: 24, pointerEvents: 'none',
                      transition: 'color 0.12s, opacity 0.12s',
                    }}>
                      {isOver ? '↓ Hier ablegen' : 'Leer'}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* New ticket modal */}
      {newOpen && (
        <NewTicketModal
          projectId={projectId}
          projectPath={projectPath}
          onSave={(title, text, type, priority) => {
            addKanbanTicket(projectId, { title, text, status: 'backlog', type, priority })
            setNewOpen(false)
          }}
          onClose={() => setNewOpen(false)}
        />
      )}

      {/* Edit detail modal */}
      {detail && (
        <TicketDetail
          ticket={detail}
          projectId={projectId}
          projectPath={projectPath}
          onSave={saveDetail}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  )
}

// ── Ticket card ────────────────────────────────────────────────────────────────

function TicketCard({ ticket, isDragging, onPointerDown, onEdit, onRemove, onDuplicate, onDevelop }: {
  ticket: KanbanTicket
  isDragging: boolean
  onPointerDown: (e: React.PointerEvent) => void
  onEdit: () => void
  onRemove: () => void
  onDuplicate: () => void
  onDevelop: () => void
}) {
  const [hovered, setHovered] = useState(false)

  const dateStr = ticket.createdAt
    ? new Date(ticket.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
    : ''

  return (
    <div
      onPointerDown={onPointerDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onDoubleClick={onEdit}
      title="Doppelklick zum Bearbeiten · Ziehen zum Verschieben"
      style={{
        background: hovered ? 'rgba(255,138,91,0.15)' : 'rgba(255,138,91,0.07)',
        border: '1px solid var(--accent)',
        borderLeft: `4px solid ${TYPE_CFG[ticket.type ?? 'story'].color}`,
        borderRadius: 6,
        padding: '10px 12px 9px',
        cursor: isDragging ? 'grabbing' : 'grab',
        position: 'relative',
        userSelect: 'none',
        transition: 'background 0.12s, opacity 0.12s',
        opacity: isDragging ? 0.3 : 1,
        touchAction: 'none',
      }}
    >
      {/* Meta row: type icon + ID + priority + actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
        <TypeIcon type={ticket.type} />
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
          color: 'var(--accent)', background: 'rgba(255,138,91,0.15)',
          border: '1px solid rgba(255,138,91,0.35)',
          borderRadius: 6, padding: '1px 5px', flexShrink: 0,
          fontFamily: 'var(--font-mono, monospace)',
        }}>
          #{ticket.ticketNumber ?? '—'}
        </span>
        <span style={{ flex: 1 }} />
        <PriorityBadge priority={ticket.priority} />
        {hovered && (
          <>
            <button
              onPointerDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); onEdit() }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-3)', display: 'flex', padding: 3, borderRadius: 6 }}
              title="Bearbeiten"
            >
              <IEdit style={{ width: 11, height: 11 }} />
            </button>
            <button
              onPointerDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); onRemove() }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-3)', display: 'flex', padding: 3, borderRadius: 6 }}
              title="Löschen"
            >
              <ITrash style={{ width: 11, height: 11 }} />
            </button>
          </>
        )}
      </div>

      {/* Title */}
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-0)', lineHeight: 1.4, marginBottom: ticket.text ? 6 : 4 }}>
        {ticket.title}
      </div>

      {/* Body text */}
      {ticket.text && (
        <div style={{
          fontSize: 12.5, color: 'var(--fg-3)', lineHeight: 1.6,
          display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          marginBottom: 6,
        }}>
          {ticket.text.replace(/\*\*/g, '').replace(/^#+\s/gm, '').replace(/^- \[.\] /gm, '• ')}
        </div>
      )}

      {/* Image thumbnails */}
      {ticket.images && ticket.images.length > 0 && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 6, flexWrap: 'wrap' }}>
          {ticket.images.map((img, i) => (
            <img key={i} src={img} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--line)' }} />
          ))}
        </div>
      )}

      {/* Date + action bar */}
      <div
        onPointerDown={e => e.stopPropagation()}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          paddingTop: 6, marginTop: 2, borderTop: '1px solid rgba(255,138,91,0.15)',
        }}
      >
        {dateStr && (
          <span style={{ fontSize: 9.5, color: 'var(--fg-3)', opacity: 0.6 }}>{dateStr}</span>
        )}
        {hovered && (
          <>
            <button
              onClick={e => { e.stopPropagation(); onDuplicate() }}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                background: 'none', border: '1px solid var(--line)', borderRadius: 6,
                padding: '3px 8px', fontSize: 11, color: 'var(--fg-3)', cursor: 'pointer',
              }}
              title="Ticket duplizieren"
            >
              <ICopy style={{ width: 10, height: 10 }} />
              Duplizieren
            </button>
            <span style={{ flex: 1 }} />
            <button
              onClick={e => { e.stopPropagation(); onDevelop() }}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: 'var(--accent)', border: 'none', borderRadius: 6,
                padding: '4px 11px', fontSize: 11.5, fontWeight: 600,
                color: 'var(--accent-fg, #1a1410)', cursor: 'pointer',
              }}
              title="User Story in Textbox übernehmen"
            >
              Entwickeln →
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── New ticket modal ───────────────────────────────────────────────────────────

function useKanbanProvider() {
  const { openrouterKey, aiFunctionMap } = useAppStore()
  const model = aiFunctionMap['kanban'] || 'deepseek/deepseek-chat-v3-0324'
  if (!openrouterKey) return null
  return { provider: 'openrouter' as const, apiKey: openrouterKey, model }
}

function useKanbanPrompts() {
  const { docTemplates } = useAppStore()
  const US_PROMPT = docTemplates.find(t => t.id === 'ai-prompt-user-story-format')?.content
    ?? `Du bist ein erfahrener Product Owner. Forme den folgenden Text in eine vollständige User Story um.\n\nAntworte exakt in diesem Format:\n\n**Titel:** [prägnanter Titel]\n\n**User Story:**\nAls [Rolle] möchte ich [Funktion], damit [Nutzen].\n\n**Akzeptanzkriterien:**\n- [ ] ...\n\n**Testfälle:**\n1. **[Testfall-Name]:** [Schritte und erwartetes Ergebnis]`
  const ANALYSE_SYSTEM = docTemplates.find(t => t.id === 'user-story-analyse')?.content
    ?? `Du bist ein erfahrener Software-Architekt. Du formulierst Implementierungsaufträge für Claude Code — direkt, technisch und präzise.\n\nANTWORT-FORMAT:\n\n**Titel:** [prägnanter Titel]\n\n## Aufgabe\n[Was genau implementiert werden soll]\n\n## Akzeptanzkriterien\n- [ ] ...`
  return { US_PROMPT, ANALYSE_SYSTEM }
}

function NewTicketModal({ projectId, projectPath, onSave, onClose }: {
  projectId: string
  projectPath: string
  onSave: (title: string, text: string, type: TicketType, priority: TicketPriority) => void
  onClose: () => void
}) {
  const [title, setTitle]             = useState('')
  const [text, setText]               = useState('')
  const [ticketType, setTicketType]   = useState<TicketType>('story')
  const [priority, setPriority]       = useState<TicketPriority>('medium')
  const [aiLoading, setAiLoading]     = useState(false)
  const [analyseLoading, setAnalyse]  = useState(false)
  const [aiError, setAiError]         = useState('')

  const provider = useKanbanProvider()
  const { US_PROMPT, ANALYSE_SYSTEM } = useKanbanPrompts()

  const refineAsUserStory = async () => {
    const body = text.trim()
    if (!body) return
    if (!provider) { setAiError('OpenRouter API-Key fehlt. Bitte unter Einstellungen → API Credentials konfigurieren.'); return }
    setAiLoading(true); setAiError('')
    try {
      const r = await fetch('/api/ai-refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: provider.provider, apiKey: provider.apiKey, model: provider.model, text: body, systemPrompt: US_PROMPT }),
      })
      const d = await r.json() as { ok: boolean; text?: string; error?: string }
      if (d.ok && d.text) {
        const titleMatch = d.text.match(/\*\*Titel:\*\*\s*(.+)/)
        if (titleMatch) setTitle(titleMatch[1].trim())
        setText(d.text.replace(/\*\*Titel:\*\*\s*.+\n?/, '').trim())
      } else { setAiError(d.error ?? 'Fehler beim Überarbeiten') }
    } catch (e) { setAiError(String(e)) }
    setAiLoading(false)
  }

  const analyseWithDocs = async () => {
    if (!provider) { setAiError('OpenRouter API-Key fehlt. Bitte unter Einstellungen → API Credentials konfigurieren.'); return }
    setAnalyse(true); setAiError('')
    try {
      const docsRes = await fetch(`/api/read-docs?path=${encodeURIComponent(projectPath)}`)
      const docsData = await docsRes.json() as { ok: boolean; files?: { filename: string; content: string }[]; error?: string }
      if (!docsData.ok) { setAiError(docsData.error ?? 'Keine docs/ Dateien gefunden.'); setAnalyse(false); return }

      const docsContext = docsData.files!
        .map(f => `### ${f.filename}\n${f.content}`)
        .join('\n\n---\n\n')

      const ticketContext = `TICKET-TITEL: ${title || '(kein Titel)'}\nTICKET-BESCHREIBUNG:\n${text || '(leer)'}`
      const userMsg = `${ticketContext}\n\n---\n\nPROJEKT-DOKUMENTATION:\n${docsContext}`

      const r = await fetch('/api/ai-refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: provider.provider, apiKey: provider.apiKey, model: provider.model, text: userMsg, systemPrompt: ANALYSE_SYSTEM }),
      })
      const d = await r.json() as { ok: boolean; text?: string; error?: string }
      if (d.ok && d.text) {
        const titleMatch = d.text.match(/\*\*Titel:\*\*\s*(.+)/)
        if (titleMatch) setTitle(titleMatch[1].trim())
        setText(d.text.replace(/\*\*Titel:\*\*\s*.+\n?/, '').trim())
      } else { setAiError(d.error ?? 'Fehler bei der Analyse') }
    } catch (e) { setAiError(String(e)) }
    setAnalyse(false)
  }

  return (
    <TicketModalShell title="Neues Ticket" onClose={onClose}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <label style={labelStyle}>Titel</label>
          <input
            autoFocus
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') onClose() }}
            placeholder="Ticket-Titel"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Typ & Priorität</label>
          <TypePriorityRow type={ticketType} setType={setTicketType} priority={priority} setPriority={setPriority} />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <label style={labelStyle}>Beschreibung / User Story</label>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Beschreibung eingeben — AI kann daraus eine vollständige User Story generieren."
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', minHeight: 180, lineHeight: 1.6 }}
          />
        </div>
      </div>
      <ModalFooter
        aiLoading={aiLoading}
        analyseLoading={analyseLoading}
        aiError={aiError}
        hasText={!!(text.trim() || title.trim())}
        providerName={provider?.name ?? null}
        onRefine={refineAsUserStory}
        onAnalyse={analyseWithDocs}
        onClearError={() => setAiError('')}
        onCancel={onClose}
        onSave={() => { if (title.trim()) onSave(title.trim(), text.trim(), ticketType, priority) }}
        saveLabel="Anlegen → Backlog"
        saveDisabled={!title.trim()}
      />
    </TicketModalShell>
  )
}

// ── Ticket detail ──────────────────────────────────────────────────────────────

function TicketDetail({ ticket, projectId, projectPath, onSave, onClose }: {
  ticket: KanbanTicket
  projectId: string
  projectPath: string
  onSave: (t: KanbanTicket) => void
  onClose: () => void
}) {
  const provider                    = useKanbanProvider()
  const { US_PROMPT, ANALYSE_SYSTEM } = useKanbanPrompts()
  const [draft, setDraft]           = useState<KanbanTicket>({ ...ticket })
  const [aiLoading, setAiLoading]   = useState(false)
  const [analyseLoading, setAnalyse] = useState(false)
  const [aiError, setAiError]       = useState('')
  const fileRef                     = useRef<HTMLInputElement>(null)

  const update = useCallback((patch: Partial<KanbanTicket>) => {
    setDraft(d => ({ ...d, ...patch }))
  }, [])

  const addImages = (files: FileList | null) => {
    if (!files) return
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return
      const reader = new FileReader()
      reader.onload = e => {
        const dataUrl = e.target?.result as string
        update({ images: [...(draft.images ?? []), dataUrl] })
      }
      reader.readAsDataURL(file)
    })
  }

  const refineAsUserStory = async () => {
    const body = draft.text.trim()
    if (!body) return
    if (!provider) { setAiError('OpenRouter API-Key fehlt. Bitte unter Einstellungen → API Credentials konfigurieren.'); return }
    setAiLoading(true); setAiError('')
    try {
      const r = await fetch('/api/ai-refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: provider.provider, apiKey: provider.apiKey, model: provider.model, text: body, systemPrompt: US_PROMPT }),
      })
      const d = await r.json() as { ok: boolean; text?: string; error?: string }
      if (d.ok && d.text) {
        const titleMatch = d.text.match(/\*\*Titel:\*\*\s*(.+)/)
        const newTitle = titleMatch ? titleMatch[1].trim() : draft.title
        update({ title: newTitle, text: d.text.replace(/\*\*Titel:\*\*\s*.+\n?/, '').trim() })
      } else { setAiError(d.error ?? 'Fehler beim Überarbeiten') }
    } catch (e) { setAiError(String(e)) }
    setAiLoading(false)
  }

  const analyseWithDocs = async () => {
    if (!provider) { setAiError('OpenRouter API-Key fehlt. Bitte unter Einstellungen → API Credentials konfigurieren.'); return }
    setAnalyse(true); setAiError('')
    try {
      const docsRes = await fetch(`/api/read-docs?path=${encodeURIComponent(projectPath)}`)
      const docsData = await docsRes.json() as { ok: boolean; files?: { filename: string; content: string }[]; error?: string }
      if (!docsData.ok) { setAiError(docsData.error ?? 'Keine docs/ Dateien gefunden.'); setAnalyse(false); return }

      const docsContext = docsData.files!
        .map(f => `### ${f.filename}\n${f.content}`)
        .join('\n\n---\n\n')

      const ticketContext = `TICKET-TITEL: ${draft.title || '(kein Titel)'}\nTICKET-BESCHREIBUNG:\n${draft.text || '(leer)'}`
      const userMsg = `${ticketContext}\n\n---\n\nPROJEKT-DOKUMENTATION:\n${docsContext}`

      const r = await fetch('/api/ai-refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: provider.provider, apiKey: provider.apiKey, model: provider.model, text: userMsg, systemPrompt: ANALYSE_SYSTEM }),
      })
      const d = await r.json() as { ok: boolean; text?: string; error?: string }
      if (d.ok && d.text) {
        const titleMatch = d.text.match(/\*\*Titel:\*\*\s*(.+)/)
        const newTitle = titleMatch ? titleMatch[1].trim() : draft.title
        update({ title: newTitle, text: d.text.replace(/\*\*Titel:\*\*\s*.+\n?/, '').trim() })
      } else { setAiError(d.error ?? 'Fehler bei der Analyse') }
    } catch (e) { setAiError(String(e)) }
    setAnalyse(false)
  }

  return (
    <TicketModalShell title={`Ticket #${ticket.ticketNumber ?? '—'} bearbeiten`} onClose={onClose}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <label style={labelStyle}>Titel</label>
          <input
            value={draft.title}
            onChange={e => update({ title: e.target.value })}
            placeholder="Ticket-Titel"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Typ & Priorität</label>
          <TypePriorityRow
            type={draft.type ?? 'story'}
            setType={t => update({ type: t })}
            priority={draft.priority ?? 'medium'}
            setPriority={p => update({ priority: p })}
          />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <label style={labelStyle}>Beschreibung / User Story</label>
          <textarea
            value={draft.text}
            onChange={e => update({ text: e.target.value })}
            placeholder="Beschreibung eingeben — AI kann daraus eine vollständige User Story generieren."
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', minHeight: 180, lineHeight: 1.6 }}
          />
        </div>
        {draft.images && draft.images.length > 0 && (
          <div>
            <label style={labelStyle}>Bilder ({draft.images.length})</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {draft.images.map((img, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <img src={img} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--line)', display: 'block' }} />
                  <button
                    onClick={() => update({ images: draft.images?.filter((_, idx) => idx !== i) })}
                    style={{ position: 'absolute', top: -5, right: -5, width: 18, height: 18, borderRadius: '50%', background: 'var(--bg-2)', border: '1px solid var(--line)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-2)', padding: 0 }}
                  >
                    <IClose style={{ width: 8, height: 8 }} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => addImages(e.target.files)} />

      <ModalFooter
        aiLoading={aiLoading}
        analyseLoading={analyseLoading}
        aiError={aiError}
        hasText={!!(draft.text.trim() || draft.title.trim())}
        providerName={provider?.name ?? null}
        onRefine={refineAsUserStory}
        onAnalyse={analyseWithDocs}
        onClearError={() => setAiError('')}
        onCancel={onClose}
        onSave={() => onSave(draft)}
        saveLabel="Speichern"
        extraLeft={
          <button onClick={() => fileRef.current?.click()} style={chip} title="Bild anhängen">
            <IFile style={{ color: 'var(--accent)', flexShrink: 0 }} />
            Bild anhängen
          </button>
        }
      />
    </TicketModalShell>
  )
}

// ── Shared modal shell ─────────────────────────────────────────────────────────

function TicketModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '90vw', height: '90vh',
          background: 'var(--bg-1)', border: '1px solid var(--line)',
          borderRadius: 6, display: 'flex', flexDirection: 'column',
          boxShadow: '0 24px 64px rgba(0,0,0,0.55)', overflow: 'hidden',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 14px', borderBottom: '1px solid var(--line)',
          background: 'var(--bg-2)', flexShrink: 0,
        }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: 0.7, flex: 1 }}>
            {title}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-3)', display: 'flex', padding: 3 }}>
            <IClose />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Shared modal footer ────────────────────────────────────────────────────────

function ModalFooter({ aiLoading, analyseLoading, aiError, hasText, providerName, onRefine, onAnalyse, onClearError, onCancel, onSave, saveLabel, saveDisabled, extraLeft }: {
  aiLoading: boolean
  analyseLoading: boolean
  aiError: string
  hasText: boolean
  providerName: string | null
  onRefine: () => void
  onAnalyse: () => void
  onClearError: () => void
  onCancel: () => void
  onSave: () => void
  saveLabel: string
  saveDisabled?: boolean
  extraLeft?: React.ReactNode
}) {
  const busy = aiLoading || analyseLoading
  return (
    <div style={{ borderTop: '1px solid var(--line)', background: 'var(--bg-2)', padding: '8px 12px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button onClick={onCancel} style={ghostBtn}>Abbrechen</button>
        {extraLeft}
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: 'var(--fg-3)' }}>⌘S speichern</span>
        {/* Analyse button */}
        <button
          onClick={onAnalyse}
          disabled={busy}
          title={!providerName ? 'AI-Anbieter in Settings → AI einrichten' : `Docs analysieren & Implementierungsauftrag generieren (${providerName})`}
          style={{ ...chip, padding: '4px 9px', color: 'var(--fg-1)', border: '1px solid var(--line)', background: 'var(--bg-3)', opacity: busy ? 0.45 : 1, gap: 5 }}
        >
          <ISpark style={{ flexShrink: 0, color: 'var(--ok)', ...(analyseLoading ? { animation: 'cc-pulse 0.5s ease-in-out infinite' } : {}) }} />
          {analyseLoading ? 'Analysiere…' : 'Analyse'}
        </button>
        {/* Überarbeiten button */}
        <button
          onClick={onRefine}
          disabled={busy || !hasText}
          title={!providerName ? 'AI-Anbieter in Settings → AI einrichten' : `Überarbeiten mit ${providerName}`}
          style={{ ...chip, padding: '4px 9px', color: 'var(--accent)', border: '1px solid var(--accent-line, var(--accent))', background: 'var(--accent-soft, rgba(255,138,91,0.1))', opacity: (busy || !hasText) ? 0.45 : 1, gap: 5 }}
        >
          <ISpark style={{ flexShrink: 0, ...(aiLoading ? { animation: 'cc-pulse 0.5s ease-in-out infinite' } : {}) }} />
          {aiLoading ? 'Generiere…' : 'Überarbeiten'}
        </button>
        <button onClick={onSave} disabled={saveDisabled} style={{ ...primaryBtn, opacity: saveDisabled ? 0.45 : 1 }}>
          {saveLabel}
        </button>
      </div>
      {aiError && (
        <div style={{ fontSize: 10.5, color: 'var(--err)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>✗</span> {aiError}
          <span onClick={onClearError} style={{ marginLeft: 'auto', cursor: 'pointer', opacity: 0.6 }}>×</span>
        </div>
      )}
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────


const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--bg-1)', border: '1px solid var(--line)',
  borderRadius: 6, padding: '7px 10px', fontSize: 12, color: 'var(--fg-0)',
  outline: 'none', boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--fg-3)',
  textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 5,
}

const chip: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 5,
  background: 'var(--bg-3)', border: '1px solid var(--line)',
  borderRadius: 6, padding: '4px 9px', fontSize: 11.5,
  color: 'var(--fg-2)', cursor: 'pointer',
}

const ghostBtn: React.CSSProperties = {
  background: 'transparent', border: '1px solid var(--line)', borderRadius: 6,
  padding: '5px 12px', fontSize: 11.5, color: 'var(--fg-2)', cursor: 'pointer',
}

const primaryBtn: React.CSSProperties = {
  background: 'var(--accent)', border: 'none', borderRadius: 6,
  padding: '5px 14px', fontSize: 11.5, color: 'var(--accent-fg, #1a1410)',
  fontWeight: 500, cursor: 'pointer',
}

// ── Global Kanban Board ────────────────────────────────────────────────────────

// Fixed color palette cycling by project index
const PROJECT_PALETTE = [
  { bg: 'rgba(255,138,91,0.18)',  fg: '#ff8a5b',  border: 'rgba(255,138,91,0.5)'  },
  { bg: 'rgba(138,180,255,0.18)', fg: '#8ab4ff',  border: 'rgba(138,180,255,0.5)' },
  { bg: 'rgba(124,217,168,0.18)', fg: '#7cd9a8',  border: 'rgba(124,217,168,0.5)' },
  { bg: 'rgba(244,195,101,0.18)', fg: '#f4c365',  border: 'rgba(244,195,101,0.5)' },
  { bg: 'rgba(239,122,122,0.18)', fg: '#ef7a7a',  border: 'rgba(239,122,122,0.5)' },
  { bg: 'rgba(190,149,255,0.18)', fg: '#be95ff',  border: 'rgba(190,149,255,0.5)' },
]

interface GlobalTicket extends KanbanTicket {
  projectId: string
  projectName: string
  projectColor: typeof PROJECT_PALETTE[0]
}

interface SessionPickState {
  ticket: GlobalTicket
  sessions: import('../../store/useAppStore').Session[]
}

export function GlobalKanbanBoard({ onClose }: { onClose: () => void }) {
  const { kanban, projects, moveKanbanTicket, setInputValue, setActiveProject, setActiveSession } = useAppStore()

  // project → stable color
  const colorMap = Object.fromEntries(
    projects.map((p, i) => [p.id, PROJECT_PALETTE[i % PROJECT_PALETTE.length]])
  )

  // all tickets enriched
  const allTickets: GlobalTicket[] = projects.flatMap(proj =>
    (kanban[proj.id] ?? []).map(t => ({
      ...t, projectId: proj.id, projectName: proj.name, projectColor: colorMap[proj.id],
    }))
  )

  // ── filter by project ──────────────────────────────────────────────────────
  const [filterId, setFilterId]         = useState<string | null>(null)
  const visibleTickets = filterId ? allTickets.filter(t => t.projectId === filterId) : allTickets

  // ── session picker ─────────────────────────────────────────────────────────
  const [sessionPick, setSessionPick]   = useState<SessionPickState | null>(null)

  const handleDevelop = useCallback((ticket: GlobalTicket) => {
    const proj     = projects.find(p => p.id === ticket.projectId)
    const sessions = proj?.sessions ?? []
    if (sessions.length <= 1) {
      setActiveProject(ticket.projectId)
      if (sessions[0]) setActiveSession(sessions[0].id)
      setInputValue(ticket.text || ticket.title)
      onClose()
    } else {
      setSessionPick({ ticket, sessions })
    }
  }, [projects, setActiveProject, setActiveSession, setInputValue, onClose])

  const pickSession = (ticket: GlobalTicket, sessionId: string) => {
    setActiveProject(ticket.projectId)
    setActiveSession(sessionId)
    setInputValue(ticket.text || ticket.title)
    setSessionPick(null)
    onClose()
  }

  // ── drag & drop ────────────────────────────────────────────────────────────
  const [dragOver, setDragOver] = useState<KanbanStatus | null>(null)
  const colRefs   = useRef<Partial<Record<KanbanStatus, HTMLDivElement>>>({})
  const dragState = useRef<{ ticketId: string; projectId: string; ghost: HTMLElement; offsetX: number; offsetY: number } | null>(null)

  const getColumnAt = useCallback((x: number, y: number): KanbanStatus | null => {
    for (const col of COLUMNS) {
      const el = colRefs.current[col.id]
      if (!el) continue
      const r = el.getBoundingClientRect()
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return col.id
    }
    return null
  }, [])

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const ds = dragState.current; if (!ds) return
      ds.ghost.style.left = `${e.clientX - ds.offsetX}px`
      ds.ghost.style.top  = `${e.clientY - ds.offsetY}px`
      setDragOver(getColumnAt(e.clientX, e.clientY))
    }
    const onUp = (e: PointerEvent) => {
      const ds = dragState.current; if (!ds) return
      const col = getColumnAt(e.clientX, e.clientY)
      if (col) moveKanbanTicket(ds.projectId, ds.ticketId, col)
      ds.ghost.remove(); dragState.current = null; setDragOver(null)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup',   onUp)
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp) }
  }, [moveKanbanTicket, getColumnAt])

  const startDrag = useCallback((e: React.PointerEvent, ticket: GlobalTicket) => {
    if ((e.target as HTMLElement).closest('button')) return
    e.preventDefault()
    const el = e.currentTarget as HTMLElement; const rect = el.getBoundingClientRect()
    const ghost = el.cloneNode(true) as HTMLElement
    ghost.style.cssText = [`position:fixed`,`left:${rect.left}px`,`top:${rect.top}px`,`width:${rect.width}px`,`pointer-events:none`,`z-index:9999`,`opacity:0.88`,`transform:rotate(1.5deg) scale(1.04)`,`transition:none`,`user-select:none`,`box-shadow:0 8px 24px rgba(0,0,0,0.45)`].join(';')
    document.body.appendChild(ghost)
    dragState.current = { ticketId: ticket.id, projectId: ticket.projectId, ghost, offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top }
  }, [])

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div onClick={e => e.stopPropagation()} style={{ width: '90vw', height: '90vh', background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 6, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 72px rgba(0,0,0,0.5)' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', borderBottom: '1px solid var(--line)', flexShrink: 0, background: 'var(--bg-2)' }}>
          <IKanban style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)', flex: 1 }}>
            Alle User Stories
            <span style={{ color: 'var(--fg-3)', fontWeight: 400 }}> · {allTickets.length} Tickets</span>
          </span>
          <span style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>{projects.length} Projekte</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-3)', display: 'flex', padding: 4 }}>
            <IClose />
          </button>
        </div>

        {/* ── Project filter bar ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderBottom: '1px solid var(--line)', flexShrink: 0, background: 'var(--bg-2)', flexWrap: 'wrap' }}>
          <button
            onClick={() => setFilterId(null)}
            style={{ fontSize: 10.5, fontWeight: filterId === null ? 700 : 400, padding: '3px 10px', borderRadius: 99, border: `1px solid ${filterId === null ? 'var(--accent)' : 'var(--line)'}`, background: filterId === null ? 'rgba(255,138,91,0.12)' : 'var(--bg-3)', color: filterId === null ? 'var(--accent)' : 'var(--fg-2)', cursor: 'pointer' }}
          >
            Alle
          </button>
          {projects.map(proj => {
            const c = colorMap[proj.id]
            const active = filterId === proj.id
            const count = (kanban[proj.id] ?? []).length
            return (
              <button
                key={proj.id}
                onClick={() => setFilterId(active ? null : proj.id)}
                style={{ fontSize: 10.5, fontWeight: active ? 700 : 400, padding: '3px 10px', borderRadius: 99, border: `1px solid ${active ? c.fg : 'var(--line)'}`, background: active ? c.bg : 'var(--bg-3)', color: active ? c.fg : 'var(--fg-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
              >
                {proj.name}
                <span style={{ fontSize: 9.5, opacity: 0.7 }}>{count}</span>
              </button>
            )
          })}
        </div>

        {/* ── Board ── */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 0 }}>
          {COLUMNS.map((col, i) => {
            const colTickets = visibleTickets.filter(t => t.status === col.id)
            const isOver = dragOver === col.id
            return (
              <div key={col.id} ref={el => { if (el) colRefs.current[col.id] = el }}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: i < COLUMNS.length - 1 ? '1px solid var(--line)' : 'none', background: isOver ? col.bg : 'transparent', transition: 'background 0.12s', overflow: 'hidden', outline: isOver ? `2px solid ${col.color}` : '2px solid transparent', outlineOffset: '-2px' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px 8px', flexShrink: 0, borderBottom: `2px solid ${isOver ? col.color : 'transparent'}`, transition: 'border-color 0.12s' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: col.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--fg-2)', textTransform: 'uppercase', letterSpacing: 0.8, flex: 1 }}>{col.label}</span>
                  <span style={{ fontSize: 9.5, color: 'var(--fg-3)', background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 99, padding: '1px 7px' }}>{colTickets.length}</span>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {colTickets.map(ticket => (
                    <GlobalTicketCard
                      key={ticket.id}
                      ticket={ticket}
                      isDragging={dragState.current?.ticketId === ticket.id}
                      onPointerDown={e => startDrag(e, ticket)}
                      onDevelop={() => handleDevelop(ticket)}
                    />
                  ))}
                  {colTickets.length === 0 && (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: isOver ? col.color : 'var(--fg-3)', fontSize: 11, opacity: isOver ? 0.7 : 0.35, paddingTop: 24, pointerEvents: 'none', transition: 'color 0.12s, opacity 0.12s' }}>
                      {isOver ? '↓ Hier ablegen' : 'Leer'}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Session picker modal ── */}
      {sessionPick && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setSessionPick(null)}
        >
          <div onClick={e => e.stopPropagation()} style={{ width: 340, background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden', boxShadow: '0 16px 48px rgba(0,0,0,0.55)' }}>
            <div style={{ padding: '11px 14px', borderBottom: '1px solid var(--line)', background: 'var(--bg-2)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ flex: 1, fontSize: 11.5, fontWeight: 600, color: 'var(--fg-0)' }}>
                Session wählen
              </span>
              <span style={{ fontSize: 10, color: 'var(--fg-3)' }}>
                {sessionPick.ticket.projectName}
              </span>
              <button onClick={() => setSessionPick(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-3)', display: 'flex', padding: 2 }}>
                <IClose style={{ width: 10, height: 10 }} />
              </button>
            </div>
            <div style={{ padding: '6px 0' }}>
              {sessionPick.sessions.map(s => (
                <div
                  key={s.id}
                  onClick={() => pickSession(sessionPick.ticket, s.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-3)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.status === 'active' ? 'var(--ok)' : s.status === 'error' ? 'var(--err)' : 'var(--fg-3)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--fg-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--fg-3)' }}>{s.alias}</div>
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 600 }}>Entwickeln →</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function GlobalTicketCard({ ticket, isDragging, onPointerDown, onDevelop }: {
  ticket: GlobalTicket
  isDragging: boolean
  onPointerDown: (e: React.PointerEvent) => void
  onDevelop: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const c = ticket.projectColor

  const typeColor = TYPE_CFG[ticket.type ?? 'story'].color
  const dateStr = ticket.createdAt
    ? new Date(ticket.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
    : ''

  return (
    <div
      onPointerDown={onPointerDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? c.bg : c.bg.replace('0.18', '0.08'),
        border: `1px solid ${c.border}`, borderLeft: `4px solid ${typeColor}`,
        borderRadius: 6, padding: '9px 11px',
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none', touchAction: 'none',
        opacity: isDragging ? 0.3 : 1, transition: 'background 0.12s, opacity 0.12s',
      }}
    >
      {/* Row 1: type icon + project pill + ID + priority */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
        <TypeIcon type={ticket.type} size={10} />
        <span style={{ fontSize: 9.5, fontWeight: 600, padding: '1px 6px', borderRadius: 99, background: c.bg, color: c.fg, border: `1px solid ${c.border}`, flexShrink: 0 }}>
          {ticket.projectName}
        </span>
        <span style={{ flex: 1 }} />
        <PriorityBadge priority={ticket.priority} />
        <span className="mono" style={{ fontSize: 9.5, color: 'var(--accent)' }}>
          #{ticket.ticketNumber ?? '—'}
        </span>
      </div>

      {/* Title */}
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)', lineHeight: 1.4, marginBottom: ticket.text ? 5 : 4 }}>
        {ticket.title}
      </div>

      {/* Body */}
      {ticket.text && (
        <div style={{ fontSize: 11.5, color: 'var(--fg-3)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: 5 }}>
          {ticket.text.replace(/\*\*/g, '').replace(/^#+\s/gm, '').replace(/^- \[.\] /gm, '• ')}
        </div>
      )}

      {/* Footer: date + develop button */}
      <div onPointerDown={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 6, borderTop: `1px solid ${c.border}`, paddingTop: 5, marginTop: 2 }}>
        {dateStr && <span style={{ fontSize: 9.5, color: 'var(--fg-3)', opacity: 0.6 }}>{dateStr}</span>}
        <span style={{ flex: 1 }} />
        {hovered && (
          <button
            onClick={e => { e.stopPropagation(); onDevelop() }}
            style={{ background: 'var(--accent)', border: 'none', borderRadius: 6, padding: '3px 12px', fontSize: 11.5, fontWeight: 600, color: 'var(--accent-fg, #1a1410)', cursor: 'pointer' }}
          >
            Entwickeln →
          </button>
        )}
      </div>
    </div>
  )
}
