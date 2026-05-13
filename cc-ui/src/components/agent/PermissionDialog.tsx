import { useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { IShield, IFile, IEdit, ITerminal, IExternalLink, ISearch, IClose, ICheck, IWarn } from '../primitives/Icons'

export interface PermissionRequest {
  requestId:     string
  toolName:      string
  input:         Record<string, unknown>
  toolUseId:     string
  fallbackText?: string
  ts:            number
  resolved?:     { allow: boolean; scope: Scope }
}

export type Scope = 'once' | 'session' | 'always'

export interface PermissionDecision {
  requestId:     string
  allow:         boolean
  scope:         Scope
  updatedInput:  Record<string, unknown>
  message?:      string
  toolName:      string
  originalInput: Record<string, unknown>
  cwd:           string
}

interface Props {
  req:        PermissionRequest
  cwd:        string
  agentName?: string
}

// ── Tool metadata ─────────────────────────────────────────────────────────────
interface ToolMeta {
  icon:        React.ReactNode
  label:       string
  actionLabel: string   // "Freigabe erteilen" fallback description
  danger:      'low' | 'mid' | 'high'
}

function toolMeta(toolName: string): ToolMeta {
  const t = toolName.toLowerCase()
  if (t === 'bash' || t === 'computer')
    return { icon: <ITerminal size={13} />, label: 'Terminal-Befehl',  actionLabel: 'Terminal-Befehl auszuführen',   danger: 'high' }
  if (t === 'write')
    return { icon: <IFile size={13} />,    label: 'Datei schreiben',   actionLabel: 'Datei zu erstellen / schreiben', danger: 'mid' }
  if (t === 'notebookedit')
    return { icon: <IFile size={13} />,    label: 'Notebook bearbeiten', actionLabel: 'Notebook zu bearbeiten',      danger: 'mid' }
  if (t === 'edit' || t === 'multiedit')
    return { icon: <IEdit size={13} />,    label: 'Datei bearbeiten',  actionLabel: 'Datei zu bearbeiten',           danger: 'mid' }
  if (t === 'read')
    return { icon: <IFile size={13} />,    label: 'Datei lesen',       actionLabel: 'Datei zu lesen',                danger: 'low' }
  if (t === 'webfetch')
    return { icon: <IExternalLink size={13} />, label: 'Web-Anfrage',  actionLabel: 'Web-Anfrage zu stellen',        danger: 'mid' }
  if (t === 'websearch')
    return { icon: <ISearch size={13} />,  label: 'Web-Suche',         actionLabel: 'Websuche durchzuführen',        danger: 'low' }
  if (t === 'glob' || t === 'grep')
    return { icon: <ISearch size={13} />,  label: 'Datei-Suche',       actionLabel: 'Dateien zu durchsuchen',        danger: 'low' }
  if (t === 'task')
    return { icon: <IShield size={13} />,  label: 'Sub-Agent starten', actionLabel: 'Sub-Agent zu starten',          danger: 'high' }
  if (t.startsWith('mcp__'))
    return { icon: <IShield size={13} />,  label: `MCP: ${toolName}`,  actionLabel: `MCP-Tool ${toolName} zu nutzen`, danger: 'mid' }
  return   { icon: <IShield size={13} />,  label: toolName,             actionLabel: `${toolName} auszuführen`,       danger: 'mid' }
}

// ── Scope label ───────────────────────────────────────────────────────────────
function scopeLabel(scope: Scope): string {
  if (scope === 'always')  return 'Immer'
  if (scope === 'session') return 'Session'
  return 'Einmal'
}

// ── Tool body (read-only display) ─────────────────────────────────────────────
function ToolBody({
  toolName, input, fallbackText, actionLabel, isDark,
}: {
  toolName:     string
  input:        Record<string, unknown>
  fallbackText?: string
  actionLabel:  string
  isDark:       boolean
}) {
  const t = toolName.toLowerCase()
  const mono: React.CSSProperties = {
    fontFamily: 'var(--font-mono)', fontSize: 11,
    background: 'var(--bg-3)',
    borderRadius: 4,
    padding: '7px 10px',
    color: 'var(--fg-0)',
    border: '1px solid var(--line-strong)',
    maxHeight: 160, overflowY: 'auto', overflowX: 'auto',
    whiteSpace: 'pre-wrap', wordBreak: 'break-all',
    userSelect: 'text',
  }

  // Fallback: show "Freigabe erteilen · <actionLabel>"
  const noContent = (
    <div style={mono}>
      <span style={{ opacity: 0.55, fontStyle: 'italic' }}>
        Freigabe erteilen · {actionLabel}
        {fallbackText ? `\n${fallbackText.slice(0, 200)}` : ''}
      </span>
    </div>
  )

  if (t === 'bash') {
    const cmd = String(input.command ?? input.cmd ?? input.code ?? '')
    if (!cmd) return noContent
    const isDanger = /\brm\s+-rf|\bsudo\b|\bcurl\b.*\|\s*(ba)?sh|\bdrop\b|\btruncate\b/i.test(cmd)
    return (
      <div>
        <div style={mono}>
          <span style={{ color: isDanger ? (isDark ? '#ef7a7a' : '#c0463f') : 'var(--fg-0)' }}>
            {cmd}
          </span>
        </div>
        {input.description != null && (
          <div style={{ marginTop: 5, fontSize: 11, opacity: 0.55 }}>
            {String(input.description)}
          </div>
        )}
        {isDanger && (
          <div style={{ marginTop: 5, display: 'flex', gap: 5, alignItems: 'center', color: isDark ? '#ef7a7a' : '#c0463f', fontSize: 11 }}>
            <IWarn size={11} /> Potenziell destruktiver Befehl
          </div>
        )}
      </div>
    )
  }

  if (t === 'read') {
    const fp = String(input.file_path ?? '')
    return fp ? <div style={mono}>{fp}</div> : noContent
  }

  if (t === 'write' || t === 'notebookedit') {
    const fp      = String(input.file_path ?? '')
    const content = String(input.content ?? input.source ?? '')
    if (!fp) return noContent
    return (
      <div>
        <div style={mono}>{fp}</div>
        {content && (
          <div style={{ ...mono, marginTop: 4, opacity: 0.65, fontSize: 10 }}>
            {content.slice(0, 300)}{content.length > 300 ? '\n…' : ''}
          </div>
        )}
      </div>
    )
  }

  if (t === 'edit' || t === 'multiedit') {
    const fp     = String(input.file_path ?? '')
    const oldStr = String(input.old_string ?? '').slice(0, 200)
    const newStr = String(input.new_string ?? '').slice(0, 200)
    if (!fp) return noContent
    return (
      <div>
        <div style={mono}>{fp}</div>
        {(oldStr || newStr) && (
          <div style={{ ...mono, marginTop: 4, padding: 0, overflow: 'hidden' }}>
            {oldStr && (
              <div style={{ padding: '4px 8px', background: 'rgba(192,70,63,0.13)', borderLeft: '2px solid rgba(192,70,63,0.6)', whiteSpace: 'pre-wrap', fontSize: 10, color: isDark ? '#ef7a7a' : '#c0463f' }}>
                {oldStr}
              </div>
            )}
            {newStr && (
              <div style={{ padding: '4px 8px', background: 'rgba(61,155,108,0.1)', borderLeft: '2px solid rgba(61,155,108,0.6)', whiteSpace: 'pre-wrap', fontSize: 10, color: isDark ? '#7cd9a8' : '#3d9b6c' }}>
                {newStr}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  if (t === 'webfetch') {
    const url = String(input.url ?? '')
    if (!url) return noContent
    let domain = url
    try { domain = new URL(url).hostname } catch {}
    return (
      <div>
        <div style={mono}>{domain}</div>
        <div style={{ ...mono, marginTop: 4, fontSize: 10, opacity: 0.6 }}>{url}</div>
      </div>
    )
  }

  if (t === 'websearch') {
    const q = String(input.query ?? '')
    return q ? <div style={mono}>{q}</div> : noContent
  }

  const hasInput = Object.keys(input).length > 0
  return hasInput
    ? <div style={mono}>{JSON.stringify(input, null, 2).slice(0, 400)}</div>
    : noContent
}

// ── Main component ────────────────────────────────────────────────────────────
export function PermissionDialog({ req, cwd, agentName }: Props) {
  const [scope, setScope] = useState<Scope>('once')
  const theme  = useAppStore(s => s.theme)
  const isDark = theme !== 'light'

  const surface  = 'var(--bg-2)'
  const textMain = 'var(--fg-0)'
  const textSub  = 'var(--fg-3)'
  const linClr   = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.18)'
  const shadow   = isDark
    ? '0 1px 3px rgba(0,0,0,0.18)'
    : '0 1px 3px rgba(0,0,0,0.08)'

  const meta       = toolMeta(req.toolName)
  const accentClr  = 'var(--accent)'
  const btnClr     = 'var(--accent)'

  const dispatch = (decision: PermissionDecision) =>
    window.dispatchEvent(new CustomEvent('cc:permission-decision', { detail: decision }))

  const decide = (allow: boolean, s: Scope = scope, message?: string) =>
    dispatch({ requestId: req.requestId, allow, scope: s, updatedInput: req.input, originalInput: req.input, toolName: req.toolName, message, cwd })

  // ── Shared styles ───────────────────────────────────────────────────────────
  const cardStyle: React.CSSProperties = {
    background: surface, borderRadius: 6,
    padding: '18px 20px', marginBottom: 8,
    display: 'flex', flexDirection: 'column', gap: 13,
    boxShadow: shadow,
    border: `1px solid ${linClr}`,
    width: '100%',
  }

  const scopeBtn = (s: Scope, activeScope: Scope, interactive: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '5px 12px', borderRadius: 5,
    fontSize: 11, fontFamily: 'inherit',
    cursor: interactive ? 'pointer' : 'default',
    fontWeight: s === activeScope ? 700 : 500,
    background: s === activeScope
      ? (isDark ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.18)')
      : 'transparent',
    color: textMain,
    border: `1px solid ${s === activeScope
      ? (isDark ? 'rgba(0,0,0,0.28)' : 'rgba(255,255,255,0.38)')
      : linClr}`,
  })

  // ── Resolved state — plain flat row (no card) ──────────────────────────────
  if (req.resolved) {
    const { allow, scope: resolvedScope } = req.resolved

    const statusLabel = allow
      ? scopeLabel(resolvedScope) === 'Immer' ? 'Immer erlaubt' : scopeLabel(resolvedScope) === 'Session' ? 'Session erlaubt' : 'Einmal erlaubt'
      : 'Abgelehnt'

    const statusColor  = allow ? '#22c55e' : '#ef4444'
    const statusBg     = allow ? 'rgba(34,197,94,0.10)' : 'rgba(239,68,68,0.10)'
    const statusBorder = allow ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'

    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 7,
        padding: '7px 14px', borderRadius: 6, marginBottom: 8,
        background: surface, border: `1px solid ${linClr}`,
        boxShadow: shadow, opacity: 0.75,
        overflow: 'hidden', width: '100%',
      }}>
        {/* Icon */}
        <span style={{ color: textSub, display: 'flex', flexShrink: 0 }}>{meta.icon}</span>

        {/* Agent + tool */}
        <span style={{ fontSize: 11, color: textSub, whiteSpace: 'nowrap' }}>
          {agentName ?? 'Claude'} hat
        </span>
        <span style={{
          fontSize: 10.5, fontFamily: 'var(--font-mono)',
          background: `${accentClr}18`, borderRadius: 3,
          padding: '1px 5px', color: accentClr, fontWeight: 600,
          whiteSpace: 'nowrap', flexShrink: 0,
        }}>
          {req.toolName}
        </span>
        <span style={{ fontSize: 11, color: textSub, whiteSpace: 'nowrap' }}>
          · {meta.label}
        </span>

        {/* Content preview — truncated */}
        <span style={{
          flex: 1, fontSize: 10.5, color: textSub,
          fontFamily: 'var(--font-mono)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          opacity: 0.55,
        }}>
          {(() => {
            const t = req.toolName.toLowerCase()
            if (t === 'bash')   return String(req.input.command ?? req.input.cmd ?? '')
            if (t === 'read' || t === 'write' || t === 'edit' || t === 'multiedit')
              return String(req.input.file_path ?? '')
            if (t === 'webfetch') return String(req.input.url ?? '')
            if (t === 'websearch') return String(req.input.query ?? '')
            return req.fallbackText ?? ''
          })()}
        </span>

        {/* Status badge */}
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '2px 8px', borderRadius: 5,
          fontSize: 10, fontWeight: 700, fontFamily: 'inherit',
          color: statusColor, background: statusBg,
          border: `1px solid ${statusBorder}`,
          flexShrink: 0, whiteSpace: 'nowrap',
        }}>
          {allow ? <ICheck size={9} /> : <IClose size={9} />}
          {statusLabel}
        </span>
      </div>
    )
  }

  // ── Active state ────────────────────────────────────────────────────────────
  return (
    <div style={cardStyle}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: accentClr, display: 'flex' }}>{meta.icon}</span>
        <span style={{ fontSize: 12, color: textMain, fontWeight: 600 }}>{agentName ?? 'Claude'} möchte</span>
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', background: `${accentClr}22`, borderRadius: 3, padding: '1px 7px', color: accentClr, fontWeight: 600 }}>
          {req.toolName}
        </span>
        <span style={{ fontSize: 11, color: textSub }}>nutzen · {meta.label}</span>
      </div>

      {/* Tool body — read-only text */}
      <ToolBody toolName={req.toolName} input={req.input} fallbackText={req.fallbackText} actionLabel={meta.actionLabel} isDark={isDark} />

      {/* Action row */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {/* Left: scope selection */}
        {(['once', 'session', 'always'] as Scope[]).map(s => (
          <button key={s} onClick={() => setScope(s)} style={scopeBtn(s, scope, true)}>
            {scopeLabel(s)}
          </button>
        ))}

        <div style={{ flex: 1 }} />

        {/* Right: Abbrechen | Bestätigen */}
        <button
          onClick={() => decide(false, 'once', 'Vom Benutzer abgelehnt')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 5, cursor: 'pointer', fontSize: 11, fontWeight: 400, fontFamily: 'inherit', background: 'transparent', color: textSub, border: 'none' }}
        >
          Abbrechen
        </button>
        <button
          onClick={() => decide(true, scope)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 14px', borderRadius: 5, cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', background: btnClr, color: 'var(--accent-fg)', border: 'none' }}
        >
          <ICheck size={11} /> Bestätigen
        </button>
      </div>
    </div>
  )
}
