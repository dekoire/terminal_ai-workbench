import React, { useRef, useEffect, useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import type { TurnMessage } from '../../store/useAppStore'
import { IGit, IBranch, IPlus, IClose, IChev, IShield, IFile, ISpark, ISend, IWarn, ITerminal } from '../primitives/Icons'
import { Pill } from '../primitives/Pill'
import { Kbd } from '../primitives/Kbd'
import { Avatar } from '../primitives/Avatar'
import { DiffBlock } from '../terminal/DiffBlock'
import { XTermPane } from '../terminal/XTermPane'

export function CenterPane() {
  const { dangerMode, projects, activeProjectId, activeSessionId, setNewSessionOpen, aliases } = useAppStore()
  const project = projects.find(p => p.id === activeProjectId)
  const sessions = project?.sessions ?? []
  const activeSession = sessions.find(s => s.id === activeSessionId)

  // Resolve alias cmd+args from the session's alias name
  const alias = aliases.find(a => a.name === activeSession?.alias)
  const aliasCmd  = alias?.cmd  ?? 'zsh'
  const aliasArgs = alias?.args ?? ''

  return (
    <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--bg-0)' }}>
      <ProjectHeader />
      <SessionTabs sessions={sessions} activeId={activeSessionId} onNew={() => setNewSessionOpen(true)} />
      {dangerMode && <DangerBanner />}
      {/* flex:1 + minHeight:0 ensures xterm fills remaining space */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {activeSession ? (
          <XTermPane
            sessionId={activeSession.id}
            cmd={aliasCmd}
            args={aliasArgs}
            cwd={project?.path ?? '~'}
          />
        ) : (
          <TerminalPane />
        )}
      </div>
      <InputArea />
    </main>
  )
}

interface GitInfo {
  branch: string
  remote: string | null
  dirty: number        // number of changed files
  ahead: number        // commits ahead of remote
  lastCommit: string   // relative time string, e.g. "2 hours ago"
  hasGit: boolean
}

function useGitInfo(projectPath: string | undefined): GitInfo | null {
  const [info, setInfo] = useState<GitInfo | null>(null)

  useEffect(() => {
    if (!projectPath) { setInfo(null); return }
    let cancelled = false

    const load = async () => {
      try {
        const res = await fetch(`/api/git?path=${encodeURIComponent(projectPath)}`)
        const data = await res.json() as {
          status: { flag: string; file: string }[]
          log: { hash: string; msg: string; author: string; when: string; date: string }[]
          branches: { name: string; hash: string; msg: string; current: boolean }[]
          remotes: string[]
          lastCommit: string
          error?: string
        }

        if (cancelled) return

        // "fatal: not a git repository" lands in data.error or empty branches
        const hasGit = !data.error?.includes('not a git repository') && (data.branches.length > 0 || data.log.length > 0)

        if (!hasGit) {
          setInfo({ hasGit: false, branch: '', remote: null, dirty: 0, ahead: 0, lastCommit: '' })
          return
        }

        const currentBranch = data.branches.find(b => b.current)
        const branch = currentBranch?.name ?? data.branches[0]?.name ?? 'main'
        // Parse remote URL from first remote name (e.g. "origin")
        // We only have the remote name from the API, not the URL — show it as-is
        const remote = data.remotes[0] ?? null
        const dirty = data.status.filter(s => s.flag !== '??').length
        // Count commits ahead: look for "ahead X" in status, or just count since we don't have that — use 0
        const lastCommit = data.lastCommit ?? ''

        setInfo({ hasGit: true, branch, remote, dirty, ahead: 0, lastCommit })
      } catch {
        if (!cancelled) setInfo(null)
      }
    }

    load()
    const timer = setInterval(load, 8000) // refresh every 8s
    return () => { cancelled = true; clearInterval(timer) }
  }, [projectPath])

  return info
}

function ProjectHeader() {
  const { projects, activeProjectId } = useAppStore()
  const project = projects.find(p => p.id === activeProjectId)
  const git = useGitInfo(project?.path)

  if (!project) {
    return (
      <div style={{ height: 40, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', borderBottom: '1px solid var(--line)', background: 'linear-gradient(180deg, var(--bg-1), var(--bg-0))' }}>
        <IGit style={{ color: 'var(--fg-3)' }} />
        <span style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>Kein Projekt ausgewählt</span>
      </div>
    )
  }

  // Git not set up
  if (git && !git.hasGit) {
    return (
      <div style={{ height: 40, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', borderBottom: '1px solid var(--line)', background: 'linear-gradient(180deg, var(--bg-1), var(--bg-0))' }}>
        <IGit style={{ color: 'var(--fg-3)' }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)' }}>{project.name}</span>
        <span style={{ color: 'var(--fg-3)', fontSize: 11 }}>·</span>
        <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>Kein Git-Repository</span>
        <span style={{ flex: 1 }} />
        <Pill tone="neutral">git init?</Pill>
      </div>
    )
  }

  // Loading state (git === null = not yet fetched)
  const branch   = git?.branch    ?? project.branch ?? '…'
  const remote   = git?.remote    ?? null
  const dirty    = git?.dirty     ?? 0
  const lastCommit = git?.lastCommit ?? ''

  return (
    <div style={{ height: 40, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', borderBottom: '1px solid var(--line)', background: 'linear-gradient(180deg, var(--bg-1), var(--bg-0))' }}>
      <IGit style={{ color: 'var(--fg-2)', flexShrink: 0 }} />

      {/* Project name + remote */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, overflow: 'hidden' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)', whiteSpace: 'nowrap' }}>{project.name}</span>
        {remote && (
          <>
            <span style={{ color: 'var(--fg-3)', fontSize: 11 }}>·</span>
            <span className="mono" style={{ fontSize: 10.5, color: 'var(--fg-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{remote}</span>
          </>
        )}
      </div>

      <span style={{ flex: 1 }} />

      {/* Last commit time */}
      {lastCommit && (
        <span style={{ fontSize: 10.5, color: 'var(--fg-3)', whiteSpace: 'nowrap' }}>{lastCommit}</span>
      )}

      {/* Dirty files badge */}
      {dirty > 0 && (
        <Pill tone="warn" dot>{dirty} modified</Pill>
      )}

      {/* Branch pill */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 5, background: 'var(--bg-2)', border: '1px solid var(--line)', flexShrink: 0 }}>
        <IBranch style={{ color: 'var(--accent)', flexShrink: 0 }} />
        <span className="mono" style={{ fontSize: 11, color: 'var(--fg-0)' }}>{branch}</span>
      </div>
    </div>
  )
}

function SessionTabs({ sessions, activeId, onNew }: { sessions: { id: string; name: string; alias: string; status: string }[]; activeId: string; onNew: () => void }) {
  const { setActiveSession, activeProjectId, removeSession } = useAppStore()

  return (
    <div style={{ height: 34, flexShrink: 0, display: 'flex', alignItems: 'flex-end', borderBottom: '1px solid var(--line)', background: 'var(--bg-1)', paddingLeft: 4, gap: 1 }}>
      {sessions.map(s => {
        const active = s.id === activeId
        const dotColor = s.status === 'active' ? 'var(--accent)' : s.status === 'error' ? 'var(--err)' : 'var(--fg-3)'
        return (
          <div key={s.id} onClick={() => setActiveSession(s.id)} style={{ height: 30, padding: '0 10px 0 12px', display: 'flex', alignItems: 'center', gap: 7, borderRadius: '6px 6px 0 0', background: active ? 'var(--bg-0)' : 'transparent', borderTop: active ? '1px solid var(--accent)' : '1px solid transparent', borderLeft: active ? '1px solid var(--line)' : 'none', borderRight: active ? '1px solid var(--line)' : 'none', color: active ? 'var(--fg-0)' : 'var(--fg-2)', fontSize: 11.5, cursor: 'pointer', position: 'relative', marginBottom: -1, maxWidth: 240 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, flexShrink: 0, ...(s.status === 'active' ? { animation: 'cc-pulse 1.4s ease-in-out infinite' } : {}) }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
            <span className="mono" style={{ fontSize: 9.5, color: 'var(--fg-3)', flexShrink: 0 }}>{s.alias}</span>
            <IClose
              style={{ color: 'var(--fg-3)', opacity: 0.7, marginLeft: 2, flexShrink: 0 }}
              onClick={(e: React.MouseEvent) => { e.stopPropagation(); removeSession(activeProjectId, s.id) }}
            />
          </div>
        )
      })}
      <button onClick={onNew} style={{ background: 'transparent', border: 'none', color: 'var(--fg-2)', padding: '0 10px', height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontFamily: 'inherit' }}>
        <IPlus /><span>New</span><Kbd>⌘T</Kbd>
      </button>
    </div>
  )
}

function DangerBanner() {
  const { setDangerMode } = useAppStore()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 14px', background: 'var(--danger-soft)', borderBottom: '1px solid var(--danger-line)', color: 'var(--danger)', fontSize: 11.5 }}>
      <IShield />
      <span style={{ fontWeight: 600 }}>Dangerous mode armed</span>
      <span style={{ color: 'var(--fg-1)' }}>permission prompts skipped — agent can write & execute without confirmation</span>
      <span style={{ flex: 1 }} />
      <span className="mono" style={{ fontSize: 10.5, color: 'var(--fg-2)' }}>--dangerously-skip-permissions</span>
      <button onClick={() => setDangerMode(false)} style={{ background: 'transparent', border: '1px solid var(--danger-line)', color: 'var(--danger)', padding: '2px 8px', borderRadius: 4, fontSize: 10.5, cursor: 'pointer', fontFamily: 'inherit' }}>Disarm</button>
    </div>
  )
}

function TerminalPane() {
  const { turns, allowTool, denyTool } = useAppStore()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [turns])

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px 22px', fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.55, color: 'var(--fg-1)', minHeight: 0 }}>
      {turns.map(turn => <Turn key={turn.id} turn={turn} onAllow={allowTool} onDeny={denyTool} />)}
      <div ref={bottomRef} />
    </div>
  )
}

function Turn({ turn, onAllow, onDeny }: { turn: TurnMessage; onAllow: (id: string) => void; onDeny: (id: string) => void }) {
  if (turn.kind === 'user') {
    return (
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <Avatar kind="user" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-0)', fontFamily: 'var(--font-ui)' }}>You</span>
            <span style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-ui)' }}>now</span>
          </div>
          <div style={{ color: 'var(--fg-0)', whiteSpace: 'pre-wrap' }}>{turn.content}</div>
          {turn.attachments && turn.attachments.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
              {turn.attachments.map(a => (
                <span key={a} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 4, fontSize: 10.5, color: 'var(--fg-2)', fontFamily: 'var(--font-mono)' }}>
                  <IFile style={{ color: 'var(--fg-3)' }} />{a}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (turn.kind === 'agent') {
    return (
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <Avatar kind="agent" />
        <div style={{ flex: 1, minWidth: 0 }}>
          {turn.alias && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, fontFamily: 'var(--font-ui)' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)' }}>{turn.alias}</span>
              {turn.model && <Pill tone="neutral">{turn.model}</Pill>}
              {turn.elapsed && <span style={{ fontSize: 10, color: 'var(--fg-3)' }}>· {turn.elapsed}</span>}
              {turn.tokens && <span style={{ fontSize: 10, color: 'var(--fg-3)' }}>· {turn.tokens} tokens</span>}
            </div>
          )}
          {turn.content && <p style={{ color: 'var(--fg-0)', margin: '0 0 8px' }}>{turn.content}</p>}
          {turn.diff && <DiffBlock />}
        </div>
      </div>
    )
  }

  if (turn.kind === 'tool') {
    return (
      <div style={{ marginLeft: 32, marginBottom: 10, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 10px', background: turn.tone === 'accent' ? 'var(--accent-soft)' : 'var(--bg-1)', border: `1px solid ${turn.tone === 'accent' ? 'var(--accent-line)' : 'var(--line)'}`, borderRadius: 5, fontSize: 11 }}>
        <IChev style={{ color: 'var(--fg-3)', transform: 'rotate(90deg)' }} />
        <span style={{ color: turn.tone === 'accent' ? 'var(--accent)' : 'var(--ok)', fontWeight: 600 }}>{turn.toolName}</span>
        <span style={{ color: 'var(--fg-1)' }}>{turn.toolArgs}</span>
        {turn.toolLines && <span style={{ color: 'var(--fg-3)' }}>· {turn.toolLines} lines</span>}
        {turn.toolMatches && <span style={{ color: 'var(--fg-3)' }}>· {turn.toolMatches} matches</span>}
        {turn.pendingApproval && <Pill tone="warn">awaiting approval</Pill>}
      </div>
    )
  }

  if (turn.kind === 'status' && turn.pendingApproval) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'rgba(244,195,101,0.08)', border: '1px solid rgba(244,195,101,0.35)', borderRadius: 6, marginLeft: 32, marginBottom: 12, fontSize: 11.5, color: 'var(--warn)', fontFamily: 'var(--font-ui)' }}>
        <IWarn />
        <span style={{ fontWeight: 600 }}>Permission required</span>
        <span style={{ color: 'var(--fg-2)' }}>to write <span className="mono">src/charge-handler.ts</span></span>
        <span style={{ flex: 1 }} />
        <button onClick={() => onDeny(turn.id)} style={ghostBtn}>Deny</button>
        <button onClick={() => onAllow(turn.id)} style={primaryBtn}>Allow once</button>
        <button onClick={() => onAllow(turn.id)} style={ghostBtn}>Always</button>
      </div>
    )
  }

  return null
}

function InputArea() {
  const {
    inputValue, setInputValue, sendMessage, templates,
    projects, activeProjectId, activeSessionId,
    playwrightCheck, setPlaywrightCheck,
    localhostCheck, setLocalhostCheck,
  } = useAppStore()
  const [attachments, setAttachments] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const project = projects.find(p => p.id === activeProjectId)
  const activeSession = project?.sessions.find(s => s.id === activeSessionId)

  // Terminal-Modus: wenn Session aktiv ist
  const isTerminal = !!activeSession

  const handleAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    setAttachments(prev => [...prev, ...files.map(f => f.name)])
    e.target.value = ''
  }

  const removeAttachment = (name: string) => {
    setAttachments(prev => prev.filter(a => a !== name))
  }

  const send = () => {
    if (!inputValue.trim() && attachments.length === 0) return

    let fullMsg = inputValue
    if (playwrightCheck) fullMsg += '\n\nTeste es mit Playwright aus und fixe Fehler die du beim Testen findest'
    if (localhostCheck)  fullMsg += '\n\nNach dem du fertig bist starte es im Browser unter localhost und dem richtigen Port'

    if (isTerminal) {
      // Direkt ans Terminal-PTY übergeben
      window.dispatchEvent(new CustomEvent('cc:terminal-paste', { detail: fullMsg }))
    } else {
      sendMessage(attachments)
      setAttachments([])
    }
    setInputValue('')
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <div style={{ flexShrink: 0, padding: '10px 14px 12px', borderTop: `1px solid ${isTerminal ? 'var(--accent-line)' : 'var(--line)'}`, background: 'var(--bg-1)' }}>
      <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={handleAttach} />

      {/* Terminal-Modus Badge */}
      {isTerminal && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontSize: 10, color: 'var(--accent)', fontWeight: 500, letterSpacing: 0.3 }}>
          <ITerminal style={{ color: 'var(--accent)' }} />
          <span>Terminal-Eingabe → {activeSession.alias}</span>
          <span style={{ color: 'var(--fg-3)', marginLeft: 2 }}>·</span>
          <span style={{ color: 'var(--fg-3)' }}>⏎ sendet direkt ans Terminal</span>
        </div>
      )}

      <div style={{ border: `1px solid ${isTerminal ? 'var(--accent-line)' : 'var(--line-strong)'}`, borderRadius: 8, background: 'var(--bg-2)', padding: '8px 10px 6px', boxShadow: isTerminal ? '0 0 0 2px var(--accent-soft)' : inputValue ? '0 0 0 3px var(--accent-soft)' : 'none' }}>
        {attachments.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 6 }}>
            {attachments.map(name => (
              <span key={name} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 6px 2px 7px', background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 4, fontSize: 10.5, color: 'var(--fg-1)', fontFamily: 'var(--font-mono)' }}>
                <IFile style={{ color: 'var(--accent)', flexShrink: 0 }} />
                {name}
                <IClose style={{ color: 'var(--fg-3)', cursor: 'pointer', marginLeft: 2 }} onClick={() => removeAttachment(name)} />
              </span>
            ))}
          </div>
        )}

        <textarea
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKey}
          placeholder={isTerminal ? 'Befehl oder Text ans Terminal senden…' : 'Nachricht senden… (⏎ senden, ⇧⏎ neue Zeile)'}
          style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-0)', background: 'transparent', border: 'none', outline: 'none', resize: 'none', width: '100%', minHeight: 38, maxHeight: 120 }}
        />

        {/* Automation-Checkboxes (nur im Nicht-Terminal-Modus relevant, aber immer sichtbar) */}
        <div style={{ display: 'flex', gap: 14, padding: '5px 0 4px', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 10.5, color: playwrightCheck ? 'var(--accent)' : 'var(--fg-3)', userSelect: 'none' }}>
            <input type="checkbox" checked={playwrightCheck} onChange={e => setPlaywrightCheck(e.target.checked)} style={{ accentColor: 'var(--accent)', cursor: 'pointer' }} />
            Playwright-Test &amp; Fehler fixen
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 10.5, color: localhostCheck ? 'var(--accent)' : 'var(--fg-3)', userSelect: 'none' }}>
            <input type="checkbox" checked={localhostCheck} onChange={e => setLocalhostCheck(e.target.checked)} style={{ accentColor: 'var(--accent)', cursor: 'pointer' }} />
            Im Browser starten (localhost)
          </label>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 5, borderTop: '1px solid var(--line)' }}>
          {!isTerminal && (
            <>
              <button style={chip} onClick={() => setInputValue(inputValue ? inputValue + '\n' + (templates[0]?.body ?? '') : (templates[0]?.body ?? ''))}>
                <ISpark style={{ color: 'var(--accent)' }} />
                @{templates[0]?.name ?? 'template'}
              </button>
              <button style={chip} onClick={() => fileInputRef.current?.click()}>
                <IPlus /> Anhang
              </button>
            </>
          )}
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>
            <Kbd>⏎</Kbd>{isTerminal ? ' Terminal' : ' senden'} · <Kbd>⇧⏎</Kbd> Zeile
          </span>
          <button onClick={send} style={{ ...primaryBtn, display: 'flex', alignItems: 'center', gap: 5, background: isTerminal ? 'var(--accent)' : 'var(--accent)' }}>
            {isTerminal ? <ITerminal style={{ color: '#1a1410' }} /> : <ISend style={{ color: '#1a1410' }} />}
            {isTerminal ? 'Senden' : 'Senden'}
          </button>
        </div>
      </div>
    </div>
  )
}

const primaryBtn: React.CSSProperties = { background: 'var(--accent)', color: '#1a1410', border: 'none', padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)' }
const ghostBtn: React.CSSProperties = { background: 'transparent', color: 'var(--fg-1)', border: '1px solid var(--line-strong)', padding: '4px 10px', borderRadius: 4, fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-ui)' }
const chip: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 99, color: 'var(--fg-1)', fontSize: 10.5, cursor: 'pointer', fontFamily: 'var(--font-ui)' }
