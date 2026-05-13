/**
 * UIWorkshop — overlay modal: browser + inspect + draw + chat.
 * Rendered as a centered panel on top of the workspace.
 */

import React, { useCallback, useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import type { WorkshopElementRef, PendingWorkshopTransfer } from '../../store/useAppStore'
import { IChevLeft, IClose } from '../primitives/Icons'
import { BrowserPane } from './BrowserPane'
import type { BrowserMode } from './BrowserPane'
import { FloatingChatbox } from './FloatingChatbox'

type ChatItem =
  | { type: 'screenshot'; dataUrl: string; fileName: string }
  | { type: 'element'; ref: WorkshopElementRef }

let screenshotCount = 0

export function UIWorkshop() {
  const { closeWorkshop, transferToAgent, projects, activeProjectId, activeSessionId } = useAppStore()
  const [mode, setMode] = useState<BrowserMode>('normal')
  const [items, setItems] = useState<ChatItem[]>([])

  // Session label for header
  const project = projects.find(p => p.id === activeProjectId)
  const session = project?.sessions.find(s => s.id === activeSessionId)
  const sessionLabel = session?.name ?? project?.name ?? 'Workspace'

  // Auto-URL from project's configured port
  const initialUrl = project?.appPort ? `http://localhost:${project.appPort}` : ''

  // ── Screenshot from BrowserPane (page or drawing saved) ──────────────────
  const onScreenshot = useCallback((dataUrl: string) => {
    screenshotCount++
    setItems(prev => [...prev, {
      type: 'screenshot', dataUrl,
      fileName: `screenshot_${screenshotCount.toString().padStart(2, '0')}.png`,
    }])
  }, [])

  // ── Element captured via inspect ────────────────────────────────────────────
  const onElementCaptured = useCallback((ref: WorkshopElementRef) => {
    setItems(prev => [...prev, { type: 'element', ref }])
  }, [])

  // ── Remove item ─────────────────────────────────────────────────────────────
  const removeItem = useCallback((idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx))
  }, [])

  // ── Transfer to agent ───────────────────────────────────────────────────────
  const handleTransfer = useCallback((t: PendingWorkshopTransfer) => {
    transferToAgent(t)
  }, [transferToAgent])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '97vw', height: '97vh', background: 'var(--bg-0)', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--line-strong)', boxShadow: '0 8px 28px rgba(0,0,0,0.35)' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', height: 38, background: 'var(--bg-1)', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
        <button
          onClick={closeWorkshop}
          style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-2)', padding: '3px 6px', borderRadius: 5, fontSize: 11.5, fontFamily: 'var(--font-ui)' }}
          title={`Zurück zu ${sessionLabel}`}
        >
          <IChevLeft style={{ width: 13, height: 13 }} />
          {sessionLabel}
        </button>

        <div style={{ flex: 1, textAlign: 'center', fontSize: 11.5, fontWeight: 600, color: 'var(--fg-2)', fontFamily: 'var(--font-ui)', letterSpacing: 0.3 }}>
          Live Browser / Selektor
        </div>

        <button
          onClick={closeWorkshop}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-3)', padding: 4, display: 'flex', alignItems: 'center', borderRadius: 5 }}
          title="Schließen"
        >
          <IClose style={{ width: 13, height: 13 }} />
        </button>
      </div>

      {/* ── Browser area ── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <BrowserPane
          mode={mode}
          onModeChange={setMode}
          onElementCaptured={onElementCaptured}
          onScreenshot={onScreenshot}
          initialUrl={initialUrl}
        />

        {/* Floating chatbox */}
        <FloatingChatbox
          items={items}
          onRemoveItem={removeItem}
          onTransfer={handleTransfer}
        />
      </div>
    </div>
  )
}
