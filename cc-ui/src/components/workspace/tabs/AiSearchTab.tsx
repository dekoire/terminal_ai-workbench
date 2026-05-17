import { useState, useEffect, useRef } from 'react'
import { useAppStore } from '../../../store/useAppStore'
import { ISpark, ISearch, IClose, ICopy, ISend, ISpinner } from '../../primitives/Icons'
import { getOrModel } from '../../../utils/orProvider'
import { writeClipboard } from '../../../lib/clipboard'

// ── AiSearchTab — AI-powered codebase search ──────────────────────────────────
// Orbit-aware: shows different context depending on session type.
// Extracted from RightSidebar.tsx.

function SectionHeader({ label }: { label: string }) {
  return (
    <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--fg-3)', marginBottom: 7, marginTop: 2 }}>
      {label}
    </div>
  )
}


function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    writeClipboard(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1400) }).catch(() => {})
  }
  return (
    <button onClick={copy} title={copied ? 'Kopiert!' : 'Kopieren'} style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? 'var(--ok)' : 'var(--fg-3)', padding: '2px 4px', display: 'flex', alignItems: 'center', gap: 3, fontSize: 10 }}>
      <ICopy style={{ width: 10, height: 10 }} />
      {copied && <span>Kopiert</span>}
    </button>
  )
}


type SearchResult = { humanSummary: string; detailed: string; agentContext: string; inputTokens: number; outputTokens: number }


export function AiSearchTab({ projectId, isOrbitSession }: { projectId: string; isOrbitSession: boolean }) {
  const { aiFunctionMap, supabaseUrl, supabaseAnonKey, currentUser, setInputValue, docTemplates, addToast: addToastSearch } = useAppStore()
  const [query, setQuery]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [result, setResult]     = useState<SearchResult | null>(null)
  const [msgCount, setMsgCount] = useState(0)
  const taRef    = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Auto-grow textarea
  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 140) + 'px'
  }, [query])

  // Esc → abort running search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && loading) stopSearch() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  const stopSearch = () => {
    abortRef.current?.abort()
    setLoading(false)
  }

  const search = async () => {
    if (!query.trim() || loading) return
    const orP = getOrModel('contextSearch')
    if (!orP) { addToastSearch({ type: 'error', title: 'OpenRouter API-Key fehlt', body: 'Bitte unter Einstellungen → API Credentials konfigurieren.' }); return }

    const ctrl = new AbortController()
    abortRef.current = ctrl

    setLoading(true); setResult(null)
    try {
      // 1. Load agent messages from Supabase
      type Msg = { role: string; content: string; ts: number; model?: string; source: 'agent' | 'orbit' }
      const msgs: Msg[] = []
      const sb = getSupabase(supabaseUrl, supabaseAnonKey)
      if (sb && currentUser?.id) {
        const agentMsgs = await loadLastProjectMessages(sb, currentUser.id, projectId, 200).catch(() => [])
        for (const m of agentMsgs) msgs.push({ role: m.role, content: m.content, ts: m.ts, model: m.model, source: 'agent' })
      }

      // 2. Load orbit chat messages from JSONL
      const listRes = await fetch(`/api/orbit/list-chats?projectId=${encodeURIComponent(projectId)}`, { signal: ctrl.signal }).catch(() => null)
      if (listRes?.ok) {
        const listData = await listRes.json() as { ok: boolean; chats: { chatId: string }[] }
        if (listData.ok) {
          for (const chat of (listData.chats ?? []).slice(0, 30)) {
            if (ctrl.signal.aborted) break
            const chatRes = await fetch(`/api/orbit/load-chat?projectId=${encodeURIComponent(projectId)}&chatId=${encodeURIComponent(chat.chatId)}`, { signal: ctrl.signal }).catch(() => null)
            if (!chatRes?.ok) continue
            const chatData = await chatRes.json() as { ok: boolean; messages: Array<{ role: string; content: string; ts: number; model?: string }> }
            if (chatData.ok) {
              for (const m of (chatData.messages ?? [])) msgs.push({ role: m.role, content: m.content, ts: m.ts, model: m.model, source: 'orbit' })
            }
          }
        }
      }

      if (ctrl.signal.aborted) return

      // Deduplicate + sort + truncate to 300 messages
      const sorted = msgs
        .filter((m, i, a) => a.findIndex(x => x.ts === m.ts && x.role === m.role && x.source === m.source) === i)
        .sort((a, b) => a.ts - b.ts)
        .slice(-300)
      setMsgCount(sorted.length)

      // 3. Call backend
      const customPrompt = docTemplates.find(t => t.id === 'ai-prompt-context-search')?.content
      const r = await fetch('/api/context-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), messages: sorted, provider: orP.provider, apiKey: orP.apiKey, model: orP.model, systemPromptOverride: customPrompt }),
        signal: ctrl.signal,
      })
      const d = await r.json() as SearchResult & { ok: boolean; error?: string }
      if (!d.ok) { addToastSearch({ type: 'error', title: 'Kontext Search fehlgeschlagen', body: d.error ?? 'Unbekannter Fehler' }); return }
      setResult(d)
    } catch (e) {
      if ((e as { name?: string }).name !== 'AbortError') addToastSearch({ type: 'error', title: 'Kontext Search Fehler', body: String(e) })
    } finally {
      setLoading(false)
    }
  }

  const insertToChatbox = () => {
    if (!result?.agentContext) return
    setInputValue(result.agentContext)
  }

  const costStr = (() => {
    if (!result) return null
    const modelId = aiFunctionMap['contextSearch'] || 'deepseek/deepseek-chat-v3-0324'
    const key = Object.keys(CS_PRICE_1K).find(k => modelId.includes(k))
    if (!key) return null
    const cost = (result.outputTokens / 1000) * CS_PRICE_1K[key]
    return cost < 0.0001 ? '<$0.0001' : `~$${cost.toFixed(4)}`
  })()

  const pill: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', padding: '2px 7px', borderRadius: 99, fontSize: 10, background: 'var(--bg-3)', border: '1px solid var(--line)', color: 'var(--fg-3)' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 12, gap: 10, minHeight: 0 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, paddingBottom: 6 }}>
        <ISpinner size={22} spin={false} style={{ flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--fg-0)', lineHeight: 1.2 }}>Kontext Search</div>
          <div style={{ fontSize: 9.5, color: 'var(--fg-3)', lineHeight: 1.2 }}>Durchsucht Agent + Orbit Chat-Verlauf</div>
        </div>
      </div>

      {/* Query input + button stacked — no gap, merged borders */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <textarea
          ref={taRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void search() } }}
          placeholder="Frage stellen… (z.B. chatbox, login, welche html seiten wurden aufgerufen)"
          style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', background: 'var(--bg-2)', border: '1px solid var(--line-strong)', borderTop: '1px solid var(--line-strong)', borderBottom: 'none', borderRadius: '4px 4px 0 0', color: 'var(--fg-0)', fontSize: 12, fontFamily: 'var(--font-ui)', outline: 'none', resize: 'none', lineHeight: 1.5, minHeight: 72, overflow: 'hidden' }}
        />
        <button
          onClick={loading ? stopSearch : () => void search()}
          disabled={!loading && !query.trim()}
          title={loading ? 'Abbrechen (Esc)' : 'Suchen (Enter)'}
          style={{ width: '100%', background: loading ? 'rgba(239,122,122,0.12)' : !query.trim() ? 'var(--bg-2)' : 'var(--accent)', border: loading ? '1px solid rgba(239,122,122,0.3)' : '1px solid var(--line-strong)', borderTop: 'none', borderRadius: '0 0 4px 4px', padding: '8px 10px', cursor: loading || query.trim() ? 'pointer' : 'default', color: loading ? 'var(--err)' : !query.trim() ? 'var(--fg-3)' : 'var(--accent-fg)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-ui)', transition: 'background 0.15s', boxSizing: 'border-box' }}
        >
          {loading
            ? <><IX style={{ width: 12, height: 12 }} /> Stopp</>
            : <><ISpinner size={13} spin={false} style={{ opacity: !query.trim() ? 0.35 : 1, color: !query.trim() ? 'var(--accent)' : 'var(--accent-fg)' }} /> Kontext Search</>
          }
        </button>
      </div>

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--fg-3)', fontSize: 11, padding: '4px 0' }}>
          <ISpinner size={12} />
          <span>Durchsuche {msgCount > 0 ? `${msgCount} Nachrichten` : 'Projekt-Historie'}…</span>
          <span style={{ marginLeft: 'auto', fontSize: 9.5, opacity: 0.6 }}>Esc = Stopp</span>
        </div>
      )}

      {result && (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0 }}>

          {/* Human Summary */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 7 }}>
              <SectionHeader label="Zusammenfassung" />
              <span style={{ flex: 1 }} />
              <CopyButton text={result.humanSummary} />
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.7, color: 'var(--fg-1)', whiteSpace: 'pre-wrap' }}>{result.humanSummary}</div>
          </div>

          {/* Detailed */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 7 }}>
              <SectionHeader label="Detailliert" />
              <span style={{ flex: 1 }} />
              <CopyButton text={result.detailed} />
            </div>
            <div style={{ fontSize: 11.5, lineHeight: 1.7, color: 'var(--fg-2)', whiteSpace: 'pre-wrap', fontFamily: 'var(--font-ui)' }}>{result.detailed}</div>
          </div>

          {/* Agent Context */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
              <SectionHeader label="Für KI-Agent" />
              <span style={{ flex: 1 }} />
              <CopyButton text={result.agentContext} />
              <button
                onClick={insertToChatbox}
                title="Als Entwurf in Chatbox einfügen"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 99, border: '1px solid var(--accent-line)', background: 'var(--accent-soft)', color: 'var(--accent)', fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)' }}
              >
                <ISend style={{ width: 10, height: 10 }} />
                Chatbox
              </button>
            </div>
            <div style={{ padding: '8px 10px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6, fontSize: 11, lineHeight: 1.65, color: 'var(--fg-1)', whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)' }}>
              {result.agentContext}
            </div>
          </div>

          {/* Token stats */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingBottom: 4 }}>
            <span style={pill}>↑ {result.inputTokens.toLocaleString('de-DE')} tk</span>
            <span style={pill}>↓ {result.outputTokens.toLocaleString('de-DE')} tk</span>
            {costStr && <span style={{ ...pill, color: 'var(--ok)' }}>{costStr}</span>}
            <span style={{ ...pill, color: 'var(--fg-3)' }}>{msgCount} Nachrichten durchsucht</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Session Info card — shared by right panel and left sidebar ────────────────

