/**
 * UIWorkshop — overlay modal: browser + inspect + draw + chat.
 * Rendered as a centered panel on top of the workspace.
 */

import React, { useCallback, useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import type { WorkshopElementRef, PendingWorkshopTransfer } from '../../store/useAppStore'
import { IClose, IPlay } from '../primitives/Icons'
import { BrowserPane } from './BrowserPane'
import type { BrowserMode } from './BrowserPane'
import { FloatingChatbox } from './FloatingChatbox'
import { useAppLauncher } from '../../hooks/useAppLauncher'
import { SmartLaunchModal } from '../modals/SmartLaunchModal'

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
  void activeSessionId

  const { state, showModal, triggerDetect, launch, retryWithAI, dismissModal } = useAppLauncher(activeProjectId, false)

  const isRunning      = state.status === 'running'
  const isIdle         = state.status === 'idle'
  const hasConfig      = !!(project?.appStartCmd || project?.appPort)
  const browserUrl     = state.url ?? (project?.appPort ? `http://localhost:${project.appPort}` : '')

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
    <div style={{ display: 'flex', flexDirection: 'column', width: '89vw', height: '89vh', background: 'var(--bg-0)', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--line-strong)', boxShadow: '0 8px 28px rgba(0,0,0,0.35)', WebkitAppRegion: 'no-drag' } as React.CSSProperties}>

      {showModal && project && (
        <SmartLaunchModal
          projectName={project.name}
          state={state}
          onStart={launch}
          onRetryWithAI={retryWithAI}
          onClose={dismissModal}
        />
      )}

      {/* ── Header ── */}
      {(() => {
        const hdr = { bg: '#ffffff', border: '#e0e0e0', color: 'var(--bg-1)' }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', height: 38, background: hdr.bg, flexShrink: 0 }}>
            <div style={{ flex: 1, textAlign: 'left', fontSize: 13, fontWeight: 600, color: hdr.color, fontFamily: 'var(--font-ui)', letterSpacing: 0.3 }}>
              Live Browser / Selektor
            </div>

            <button
              onClick={closeWorkshop}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: hdr.color, padding: 4, display: 'flex', alignItems: 'center', borderRadius: 5, opacity: 0.7 }}
              title="Schließen"
            >
              <IClose style={{ width: 14, height: 14, strokeWidth: 2.2 }} />
            </button>
          </div>
        )
      })()}

      {/* ── Browser area ── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {isRunning ? (
          <BrowserPane
            mode={mode}
            onModeChange={setMode}
            onElementCaptured={onElementCaptured}
            onScreenshot={onScreenshot}
            initialUrl={browserUrl}
          />
        ) : isIdle ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-1)' }}>
              {hasConfig ? 'App ist nicht gestartet' : 'Keine App konfiguriert'}
            </div>
            {hasConfig && (
              <div style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
                {project?.appStartCmd ?? `Port ${project?.appPort}`}
              </div>
            )}
            <button
              onClick={triggerDetect}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--accent)', border: 'none', borderRadius: 6, padding: '7px 18px', fontSize: 12, color: 'var(--accent-fg)', cursor: 'pointer', fontWeight: 600, fontFamily: 'var(--font-ui)', marginTop: 4 }}
            >
              <IPlay style={{ width: 12, height: 12 }} />
              {hasConfig ? 'App starten' : 'Erkennen & starten'}
            </button>
          </div>
        ) : null /* starting/detecting/error — SmartLaunchModal is shown */}

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
