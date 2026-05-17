import { useRef, useEffect, useState, useCallback } from 'react'
import { useAppStore } from '../../store/useAppStore'
import type { TurnMessage, Template, TerminalShortcut } from '../../store/useAppStore'
import { ISpark, IBolt, ISend, IWarn, IMic, IAiWand, IDocAI, IImage, IKeyboard, IShieldPlus, IOrbit, IPaperclip, IEdit, ISpinner } from '../primitives/Icons'
import { useFileAttachments, useDragDrop, usePasteFiles, FileAttachmentBar, DragOverlay } from '../primitives/FileAttachmentArea'
import { ImageAnnotator } from '../primitives/ImageAnnotator'
import { TERMINAL_THEMES } from '../../theme/presets'
import { refreshProjectDocs } from '../../utils/updateDocs'
import { aiDetectStartCmd } from '../../utils/aiDetect'
import { getOrModel } from '../../utils/orProvider'
import { Pill } from '../primitives/Pill'
import { Kbd } from '../primitives/Kbd'
import { Avatar } from '../primitives/Avatar'
import { resolveRefs } from '../../lib/resolveRefs'
import { getSupabase } from '../../lib/supabase'
import { loadAgentMessageById } from '../../lib/agentSync'

// ── ChatInput (formerly InputArea) ───────────────────────────────────────────
// Full-featured chat input area: text, voice, AI refinement, file attachments,
// reference pills, template context menu, image annotation.
// Reads all state from the store directly — no props drilling needed.
// Used via ChatInputConnector in CenterPanel.tsx.

function TplCtxItem({ label, onClick }: { label: string; onClick: () => void }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ padding: '6px 14px', cursor: 'pointer', fontSize: 11.5, color: 'var(--fg-0)', background: hov ? 'var(--accent-soft)' : 'transparent', userSelect: 'none' }}
    >
      {label}
    </div>
  )
}

// ── Edit template modal ───────────────────────────────────────────────────────

function EditTemplateModal({ template, onClose }: { template: Template; onClose: () => void }) {
  const { updateTemplate } = useAppStore()
  const [name, setName] = useState(template.name)
  const [body, setBody] = useState(template.body)
  const [hint, setHint] = useState(template.hint ?? '')

  const save = () => {
    if (!name.trim() || !body.trim()) return
    updateTemplate(template.id, { name: name.trim(), body: body.trim(), hint: hint.trim() })
    onClose()
  }

  const fl: React.CSSProperties = { display: 'block', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.7, color: 'var(--fg-3)', fontWeight: 500, marginBottom: 5 }
  const fi: React.CSSProperties = { width: '100%', padding: '7px 10px', border: '1px solid var(--line-strong)', borderRadius: 6, background: 'var(--bg-2)', color: 'var(--fg-0)', fontSize: 12, fontFamily: 'var(--font-ui)', outline: 'none', boxSizing: 'border-box' }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'var(--bg-1)', border: '1px solid var(--line-strong)', borderRadius: 6, boxShadow: '0 16px 48px rgba(0,0,0,0.4)', width: 440, padding: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg-0)', marginBottom: 18 }}>Template bearbeiten</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
          <div>
            <label style={fl}>Name</label>
            <input style={fi} value={name} onChange={e => setName(e.target.value)} autoFocus />
          </div>
          <div>
            <label style={fl}>Inhalt</label>
            <textarea style={{ ...fi, resize: 'vertical', minHeight: 90, fontFamily: 'var(--font-mono)', lineHeight: 1.5 }} value={body} onChange={e => setBody(e.target.value)} />
          </div>
          <div>
            <label style={fl}>Hint (optional)</label>
            <input style={fi} value={hint} onChange={e => setHint(e.target.value)} placeholder="z.B. /check" />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--line-strong)', borderRadius: 6, padding: '6px 14px', color: 'var(--fg-1)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-ui)' }}>
            Abbrechen
          </button>
          <button onClick={save} disabled={!name.trim() || !body.trim()} style={{ background: 'var(--accent)', border: 'none', borderRadius: 6, padding: '6px 14px', color: 'var(--accent-fg)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)', opacity: (!name.trim() || !body.trim()) ? 0.5 : 1 }}>
            Speichern
          </button>
        </div>
      </div>
    </div>
  )
}


export function ChatInput({ containerWidth = 9999 }: { containerWidth?: number }) {
  const {
    inputValue, setInputValue, sendMessage, templates, updateTemplate,
    projects, activeProjectId, activeSessionId,
    playwrightCheck, setPlaywrightCheck,
    localhostCheck, setLocalhostCheck,
    openrouterKey, aiFunctionMap, groqApiKey, voiceProvider,
    terminalShortcuts, docTemplates,
    terminalTheme, theme: appTheme,
    currentUser,
    orbitCtxBefore, orbitCtxAfter, agentCtxBefore, agentCtxAfter,
    supabaseUrl, supabaseAnonKey,
    pendingWorkshopTransfer, clearWorkshopTransfer,
    addToast: addToastInput,
  } = useAppStore()
  const [attachments, setAttachments]   = useState<string[]>([])
  const [picking, setPicking]           = useState(false)
  const [recording, setRecording]       = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const mediaRef  = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const [editTemplate, setEditTemplate] = useState<Template | null>(null)
  const [tplMenu, setTplMenu]           = useState<{ x: number; y: number; tpl: Template } | null>(null)
  const [aiRefining, setAiRefining]   = useState(false)
  const [aiAnalysing, setAiAnalysing] = useState(false)
  const [pathInput, setPathInput]       = useState<'file' | 'image' | null>(null)
  const [pathInputVal, setPathInputVal] = useState('')
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [focused, setFocused] = useState(false)
  const isOrbit = projects.flatMap(p => p.sessions).find(s => s.id === activeSessionId)?.kind === 'orbit'
  const [attachPreviewSrc, setAttachPreviewSrc] = useState<string | null>(null)
  const borderWrapRef = useRef<HTMLDivElement>(null)
  // ── Chat history (ArrowUp/Down to cycle through last 20 sent messages) ───────
  const chatHistoryRef  = useRef<string[]>([])
  const historyIndexRef = useRef(-1)   // -1 = not navigating


  // ── R2 file attachments ────────────────────────────────────────────────────
  const userId = currentUser?.id
  const { files: pendingFiles, addFiles, removeFile: removePendingFile, replaceFile, clearFiles, buildUrlSuffix, hasUploading } = useFileAttachments(userId, 'image-text-context')
  const [annotatingFileId, setAnnotatingFileId] = useState<string | null>(null)
  const annotatingFile = annotatingFileId ? pendingFiles.find(f => f.id === annotatingFileId) ?? null : null
  const isDragOver = useDragDrop(addFiles, 6, pendingFiles.length)
  usePasteFiles(addFiles)

  // Derived session state — computed early so the ref-detection useEffect can use them
  const project       = projects.find(p => p.id === activeProjectId)
  const activeSession = project?.sessions.find(s => s.id === activeSessionId)
  const isTerminal    = !!activeSession
  const isPtyTerminal = isTerminal && (activeSession?.kind === 'single' || activeSession?.kind == null) && !isOrbit

  // ── Orbit reference detection ──────────────────────────────────────────────
  type RefStatus = 'checking' | 'found' | 'missing'
  const [orbitRefs, setOrbitRefs] = useState<Map<string, RefStatus>>(new Map())
  // Refs promoted out of input text → shown as pills; cleared on send
  const [confirmedRefs, setConfirmedRefs] = useState<Set<string>>(new Set())
  const refTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Stable ref to inputValue for use inside async callbacks
  const inputValueRef = useRef(inputValue)
  useEffect(() => { inputValueRef.current = inputValue }, [inputValue])

  // Clear confirmed refs when session changes
  useEffect(() => { setConfirmedRefs(new Set()); setOrbitRefs(new Map()) }, [activeSessionId])

  useEffect(() => {
    // Ref detection runs for all session types
    const REF_RE = /#(msg|chat|amsg):([a-z0-9-]{6,})/gi
    const matches = [...inputValue.matchAll(REF_RE)]
    const found = matches.map(m => `${m[1]}:${m[2]}`)
    const unique = [...new Set(found)]

    // Trim refs no longer in text
    setOrbitRefs(prev => {
      const next = new Map<string, RefStatus>()
      for (const ref of unique) next.set(ref, prev.get(ref) ?? 'checking')
      return next
    })

    // Debounced resolution for any 'checking' refs
    if (refTimerRef.current) clearTimeout(refTimerRef.current)
    refTimerRef.current = setTimeout(async () => {
      for (const ref of unique) {
        const [type, id] = ref.split(':')
        try {
          let ok = false
          if (type === 'amsg') {
            // Resolve agent messages client-side (RLS requires authenticated Supabase client)
            const sb = supabaseUrl && supabaseAnonKey ? getSupabase(supabaseUrl, supabaseAnonKey) : null
            if (sb && currentUser?.id) {
              const msg = await loadAgentMessageById(sb, currentUser.id, id).catch(() => null)
              ok = msg !== null
            }
          } else {
            const r = await fetch('/api/orbit/resolve', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ref: `${type}:${id}`, ctxBefore: 0, ctxAfter: 0 }),
            })
            const data = await r.json() as { ok: boolean }
            ok = data.ok
          }
          setOrbitRefs(prev => {
            const next = new Map(prev)
            next.set(ref, ok ? 'found' : 'missing')
            return next
          })
          // Promote found refs: remove from text, keep as pill
          if (ok) {
            const token = `#${type}:${id}`
            const next = inputValueRef.current.split(token).join('').replace(/\s{2,}/g, ' ').trim()
            setInputValue(next)
            setConfirmedRefs(prev => { const n = new Set(prev); n.add(ref); return n })
          }
        } catch {
          setOrbitRefs(prev => { const n = new Map(prev); n.set(ref, 'missing'); return n })
        }
      }
    }, 450)

    return () => { if (refTimerRef.current) clearTimeout(refTimerRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputValue, isTerminal, isOrbit, supabaseUrl, supabaseAnonKey, currentUser?.id])

  const taRef      = useRef<HTMLTextAreaElement>(null)
  const termBg = (TERMINAL_THEMES.find(t => t.id === terminalTheme)?.theme.background)
    ?? (appTheme === 'dark' ? '#0e0d0b' : '#faf8f4')
  const recRef     = useRef<SpeechRecognition | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // drag-drop + paste handled by useDragDrop / usePasteFiles hooks above

  const imageFiles = pendingFiles.filter(f => f.isImage)
  useEffect(() => {
    if (!attachPreviewSrc) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setAttachPreviewSrc(null) }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [attachPreviewSrc])

  // Insert a #msg: / #chat: reference into the input (fired by clicking ID badges in AgentView / OrbitView)
  useEffect(() => {
    const onInsertRef = (e: Event) => {
      const ref = (e as CustomEvent<string>).detail
      if (!ref) return
      const curr = inputValueRef.current
      setInputValue(curr ? curr + ' ' + ref : ref)
    }
    window.addEventListener('cc:insert-ref', onInsertRef)
    return () => window.removeEventListener('cc:insert-ref', onInsertRef)
  }, [])

  // Auto-grow textarea + sync outer container (re-runs when files are added/removed)
  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    const next = Math.min(Math.max(ta.scrollHeight, 68), 600)
    ta.style.height = next + 'px'
  }, [inputValue, pendingFiles.length])

  // ── Workshop transfer: inject text + element refs + images on return ────────
  useEffect(() => {
    if (!pendingWorkshopTransfer) return
    const { text, elementRefs, imageDataUrls } = pendingWorkshopTransfer
    // Build element-ref appendix
    const refLines = elementRefs.map(r => {
      const lines: string[] = []
      const selector = r.tag + (r.id ? '#'+r.id : r.classes[0] ? '.'+r.classes[0] : '')
      lines.push(`Komponente: ${r.component ?? selector}`)
      if (r.page)      lines.push(`  Seite: ${r.page}`)
      if (r.position)  lines.push(`  Position: ${r.position}`)
      if (r.hierarchy) lines.push(`  Pfad: ${r.hierarchy}`)
      if (r.selector && r.selector !== selector) lines.push(`  Selektor: ${r.selector}`)
      if (r.text)      lines.push(`  Text: "${r.text}"`)
      return lines.join('\n')
    })
    const appendix = refLines.length
      ? `\n\n── Erfasste UI-Elemente ──\n${refLines.join('\n\n')}`
      : ''
    setInputValue(text + appendix)

    // Convert dataUrls to File objects and add them as pending files
    if (imageDataUrls.length > 0) {
      void Promise.all(
        imageDataUrls.map(async (url, i) => {
          const res  = await fetch(url)
          const blob = await res.blob()
          return new File([blob], `workshop_${i+1}.png`, { type: 'image/png' })
        })
      ).then(files => addFiles(files))
    }

    clearWorkshopTransfer()
  }, [pendingWorkshopTransfer]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    addFiles(files)  // pendingFiles system: Orbit → base64/inline, Agent → temp file path
    e.target.value = ''
  }

  const removeAttachment = (name: string) => {
    setAttachments(prev => prev.filter(a => a !== name))
  }

  const insertFullPath = (fullPath: string, mode: 'file' | 'image') => {
    const p = fullPath.trim()
    if (!p) return
    const quoted = p.includes(' ') ? `"${p}"` : p
    const insert = mode === 'image' ? `--image ${quoted}` : quoted
    setInputValue(prev => prev ? prev + ' ' + insert : insert)
  }

  const confirmPathInput = () => {
    if (pathInput && pathInputVal.trim()) {
      insertFullPath(pathInputVal.trim(), pathInput)
    }
    setPathInput(null)
    setPathInputVal('')
    // DOM layout change can disrupt xterm canvas — force repaint after React flushes
    setTimeout(() => window.dispatchEvent(new CustomEvent('cc:terminal-refresh')), 50)
  }

  const toBase64 = (file: File): Promise<string> => new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = rej
    r.readAsDataURL(file)
  })

  const dispatchOrbit = async (fullMsg: string, images: { dataUrl: string; mimeType: string }[], jwt?: string) => {
    const resolved = await resolveRefs(fullMsg, orbitCtxBefore, orbitCtxAfter, supabaseUrl, supabaseAnonKey, currentUser?.id, agentCtxBefore, agentCtxAfter, jwt)
    window.dispatchEvent(new CustomEvent('cc:orbit-send', { detail: { sessionId: activeSessionId, text: resolved, images } }))
    setInputValue('')
    setAttachments([])
    clearFiles()
    setConfirmedRefs(new Set())
  }

  const send = async () => {
    const favBodies = templates.filter(t => t.favorite).map(t => t.body)
    if (!inputValue.trim() && attachments.length === 0 && favBodies.length === 0 && pendingFiles.length === 0) return
    if (hasUploading && isPtyTerminal) return  // only PTY terminal needs to wait for R2; orbit+agent read from File object directly

    // Save to history (max 20, no duplicates at top)
    if (inputValue.trim()) {
      const h = chatHistoryRef.current
      if (h[0] !== inputValue.trim()) {
        chatHistoryRef.current = [inputValue.trim(), ...h].slice(0, 20)
      }
      historyIndexRef.current = -1
    }

    let fullMsg = inputValue
    if (favBodies.length > 0) fullMsg += (fullMsg ? '\n\n' : '') + favBodies.join('\n\n')
    // Prepend confirmed pill-refs so resolveRefs can expand them
    if (confirmedRefs.size > 0) {
      const refTokens = [...confirmedRefs].map(r => `#${r}`).join(' ')
      fullMsg = refTokens + (fullMsg ? ' ' + fullMsg : '')
    }
    const clearConfirmedRefs = () => setConfirmedRefs(new Set())
    // JWT for authenticated Supabase queries (amsg: refs need RLS bypass)
    const _sbClient = getSupabase(supabaseUrl, supabaseAnonKey)
    const jwt = _sbClient ? (await _sbClient.auth.getSession()).data.session?.access_token : undefined

    if (activeSession?.kind === 'openrouter-claude') {
      // Agent session (Kimi/custom provider via Claude Code CLI):
      // Read file content directly from File object — no R2 URL needed, no upload wait.
      const sendAgentMsg = async () => {
        let msg = fullMsg
        const docFiles = pendingFiles.filter(f => !f.isImage)
        if (docFiles.length > 0) {
          const inlined = await Promise.all(docFiles.map(async f => {
            try {
              const text = await f.file.text()
              const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
              return `\n\n--- ${f.name} ---\n\`\`\`${ext}\n${text}\n\`\`\``
            } catch { return `\n\n[Anhang: ${f.name}]` }
          }))
          msg += inlined.join('')
        }
        const imageFiles = pendingFiles.filter(f => f.isImage && f.file)
        if (imageFiles.length > 0) {
          const paths = await Promise.all(imageFiles.map(async f => {
            try {
              const res = await fetch('/api/write-temp-image', {
                method: 'POST',
                headers: { 'Content-Type': f.mimeType || 'application/octet-stream', 'X-File-Name': encodeURIComponent(f.name) },
                body: f.file,
              })
              const data = await res.json() as { ok: boolean; path?: string }
              return data.ok && data.path ? data.path : null
            } catch { return null }
          }))
          const valid = paths.filter(Boolean) as string[]
          if (valid.length > 0) msg += ' ' + valid.map(p => `--image "${p}"`).join(' ')
        }
        const resolved = await resolveRefs(msg, orbitCtxBefore, orbitCtxAfter, supabaseUrl, supabaseAnonKey, currentUser?.id, agentCtxBefore, agentCtxAfter, jwt)
        window.dispatchEvent(new CustomEvent('cc:terminal-paste', { detail: { sessionId: activeSessionId, data: resolved } }))
        setInputValue('')
        clearFiles()
        clearConfirmedRefs()
        setTimeout(() => window.dispatchEvent(new CustomEvent('cc:terminal-refresh')), 50)
      }
      void sendAgentMsg()
      return
    } else if (activeSession?.kind === 'orbit') {
      // Orbit: images → base64 inline; text/doc files → fetch content and inline as code block
      // (R2 proxy URLs are localhost — unreachable by remote AI model servers)
      const imageFiles = pendingFiles.filter(f => f.isImage)
      const docFiles   = pendingFiles.filter(f => !f.isImage)

      const inlineDocContent = async (msg: string): Promise<string> => {
        if (docFiles.length === 0) return msg
        const inlined = await Promise.all(docFiles.map(async f => {
          try {
            const text = await f.file.text()
            const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
            return `\n\n--- ${f.name} ---\n\`\`\`${ext}\n${text}\n\`\`\``
          } catch {
            return `\n\n[Anhang: ${f.name}]`
          }
        }))
        return msg + inlined.join('')
      }

      if (imageFiles.length === 0) {
        void inlineDocContent(fullMsg).then(msg => dispatchOrbit(msg, [], jwt))
      } else {
        void Promise.all([
          inlineDocContent(fullMsg),
          ...imageFiles.map(img => toBase64(img.file).then(dataUrl => ({ dataUrl, mimeType: img.mimeType }))),
        ]).then(([msg, ...images]) => dispatchOrbit(msg as string, images as { dataUrl: string; mimeType: string }[], jwt))
      }
    } else if (isTerminal) {
      // Terminal: images → local temp file → --image flag (Claude Code CLI reads it)
      // Text docs → read content and inline (same reason: external models can't reach localhost)
      const imageFiles = pendingFiles.filter(f => f.isImage && f.file)
      const doneDocs   = pendingFiles.filter(f => !f.isImage && f.status === 'done' && f.url)

      if (doneDocs.length > 0) {
        // Inline text file content instead of sending an unreachable proxy URL
        const inlined = await Promise.all(doneDocs.map(async f => {
          try {
            const r = await fetch(f.url!)
            const text = await r.text()
            const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
            return `\n\n--- ${f.name} ---\n\`\`\`${ext}\n${text}\n\`\`\``
          } catch {
            return `\n\n[Anhang: ${f.name}]`
          }
        }))
        fullMsg += inlined.join('')
      }

      const writeTempAndSend = async () => {
        let msg = await resolveRefs(fullMsg, orbitCtxBefore, orbitCtxAfter, undefined, undefined, undefined, agentCtxBefore, agentCtxAfter)
        if (imageFiles.length > 0) {
          const paths = await Promise.all(imageFiles.map(async f => {
            try {
              const res = await fetch('/api/write-temp-image', {
                method: 'POST',
                headers: {
                  'Content-Type': f.mimeType || 'application/octet-stream',
                  'X-File-Name': encodeURIComponent(f.name),
                },
                body: f.file,
              })
              const data = await res.json() as { ok: boolean; path?: string }
              return data.ok && data.path ? data.path : null
            } catch { return null }
          }))
          const valid = paths.filter(Boolean) as string[]
          if (valid.length > 0) msg += ' ' + valid.map(p => `--image "${p}"`).join(' ')
        }
        window.dispatchEvent(new CustomEvent('cc:terminal-paste', { detail: { sessionId: activeSessionId, data: msg } }))
        setInputValue('')
        clearFiles()
        clearConfirmedRefs()
        setTimeout(() => window.dispatchEvent(new CustomEvent('cc:terminal-refresh')), 50)
      }

      void writeTempAndSend()
      return // async path handles setInputValue/clearFiles
    } else {
      // Agent session (Claude Code CLI): resolve refs, inline doc files, pass images as --image args
      const sendWithRefs = async () => {
        let msg = fullMsg

        // Inline text/doc files directly from File object (no R2 URL needed)
        const docFiles = pendingFiles.filter(f => !f.isImage)
        if (docFiles.length > 0) {
          const inlined = await Promise.all(docFiles.map(async f => {
            try {
              const text = await f.file.text()
              const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
              return `\n\n--- ${f.name} ---\n\`\`\`${ext}\n${text}\n\`\`\``
            } catch { return `\n\n[Anhang: ${f.name}]` }
          }))
          msg += inlined.join('')
        }

        // Images: write to temp file, then append --image "/path" flags
        // ws.ts extracts these flags from the text and passes them as proper CLI args
        const imageFiles = pendingFiles.filter(f => f.isImage && f.file)
        if (imageFiles.length > 0) {
          const paths = await Promise.all(imageFiles.map(async f => {
            try {
              const res = await fetch('/api/write-temp-image', {
                method: 'POST',
                headers: { 'Content-Type': f.mimeType || 'application/octet-stream', 'X-File-Name': encodeURIComponent(f.name) },
                body: f.file,
              })
              const data = await res.json() as { ok: boolean; path?: string }
              return data.ok && data.path ? data.path : null
            } catch { return null }
          }))
          const valid = paths.filter(Boolean) as string[]
          if (valid.length > 0) msg += ' ' + valid.map(p => `--image "${p}"`).join(' ')
        }

        const resolved = await resolveRefs(msg, orbitCtxBefore, orbitCtxAfter, supabaseUrl, supabaseAnonKey, currentUser?.id, agentCtxBefore, agentCtxAfter, jwt)
        sendMessage(pendingFiles.map(f => f.name), resolved)
        setInputValue('')
        clearFiles()
        clearConfirmedRefs()
        setTimeout(() => window.dispatchEvent(new CustomEvent('cc:terminal-refresh')), 50)
      }
      void sendWithRefs()
      return // async path handles setInputValue/clearFiles
    }
  }

  const refineWithAI = async () => {
    if (!inputValue.trim()) return
    const orP = getOrModel('terminal')
    if (!orP) { addToastInput({ type: 'error', title: 'OpenRouter API-Key fehlt', body: 'Bitte unter Einstellungen → API Credentials konfigurieren.' }); return }
    setAiRefining(true)
    const textRefinePrompt = docTemplates.find(t => t.id === 'ai-prompt-text-refine')?.content
    try {
      const r = await fetch('/api/ai-refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: orP.provider, apiKey: orP.apiKey, model: orP.model, text: inputValue, ...(textRefinePrompt ? { systemPrompt: textRefinePrompt } : {}) }),
      })
      const d = await r.json() as { ok: boolean; text?: string; error?: string }
      if (d.ok && d.text) setInputValue(d.text)
      else addToastInput({ type: 'error', title: 'Fehler beim Überarbeiten', body: d.error })
    } catch (e) { addToastInput({ type: 'error', title: 'Fehler beim Überarbeiten', body: String(e) }) }
    setAiRefining(false)
  }

  const analyseWithAI = async () => {
    if (!inputValue.trim()) return
    const orP = getOrModel('terminal')
    if (!orP) { addToastInput({ type: 'error', title: 'OpenRouter API-Key fehlt', body: 'Bitte unter Einstellungen → API Credentials konfigurieren.' }); return }
    setAiAnalysing(true)
    const analysePrompt = docTemplates.find(t => t.id === 'prompt-support')?.content
    try {
      let userMsg = inputValue
      if (project?.path) {
        try {
          const docsRes = await fetch(`/api/read-docs?path=${encodeURIComponent(project.path)}`)
          const docsData = await docsRes.json() as { ok: boolean; files?: { filename: string; content: string }[] }
          if (docsData.ok && docsData.files?.length) {
            const docsContext = docsData.files.map(f => `### ${f.filename}\n${f.content}`).join('\n\n---\n\n')
            userMsg = `${inputValue}\n\n---\n\nPROJEKT-DOKUMENTATION:\n${docsContext}`
          }
        } catch { /* no docs — proceed without */ }
      }
      const r = await fetch('/api/ai-refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: orP.provider, apiKey: orP.apiKey, model: orP.model, text: userMsg, ...(analysePrompt ? { systemPrompt: analysePrompt } : {}) }),
      })
      const d = await r.json() as { ok: boolean; text?: string; error?: string }
      if (d.ok && d.text) setInputValue(d.text)
      else addToastInput({ type: 'error', title: 'Fehler bei der Analyse', body: d.error })
    } catch (e) { addToastInput({ type: 'error', title: 'Fehler bei der Analyse', body: String(e) }) }
    setAiAnalysing(false)
  }

  const toggleVoice = async () => {
    if (recording) {
      mediaRef.current?.stop()
      recRef.current?.stop()
      setRecording(false)
      return
    }

    // Check server-side key availability first
    if (!groqApiKey) {
      try {
        const check = await fetch('/api/config').then(r => r.json() as Promise<{ hasGroqKey?: boolean }>)
        if (!check.hasGroqKey) {
          addToastInput({ type: 'error', title: 'Kein Groq-API-Key', body: 'Bitte unter Einstellungen → Stimme konfigurieren.' })
          return
        }
      } catch { /* server might not have /api/config — proceed anyway */ }
    }

    // Whisper via Groq (server-side key) or user-provided key
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus' : 'audio/webm'
      const recorder = new MediaRecorder(stream, { mimeType })
      chunksRef.current = []
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = () => {
        // Defer off MediaRecorder stack; stop tracks AFTER React state settles
        setTimeout(() => {
          try { stream.getTracks().forEach(t => t.stop()) } catch { /* ignore */ }
        }, 300)

        setTimeout(async () => {
          try {
            setTranscribing(true)
            const blob = new Blob(chunksRef.current, { type: mimeType })
            const headers: Record<string, string> = {
              'x-provider': groqApiKey ? voiceProvider : 'groq',
              'x-language': 'de',
              'Content-Type': mimeType,
            }
            if (groqApiKey) headers['x-api-key'] = groqApiKey
            const r = await fetch('/api/transcribe', { method: 'POST', body: blob, headers })
            const d = await r.json() as { ok: boolean; text?: string; error?: string }
            if (d.ok && d.text) {
              const current = useAppStore.getState().inputValue
              setInputValue(current ? current + ' ' + d.text : d.text!)
            } else if (!d.ok) {
              const body = d.error === 'no api key'
                ? 'Bitte unter Einstellungen → Stimme konfigurieren.'
                : (d.error ?? 'Unbekannter Fehler')
              addToastInput({ type: 'error', title: 'Transkription fehlgeschlagen', body })
            }
          } catch (err) {
            try { addToastInput({ type: 'error', title: 'Mikrofon-Fehler', body: String(err) }) } catch { /* ignore */ }
          } finally {
            try { setTranscribing(false) } catch { /* ignore */ }
          }
        }, 50)
      }
      recorder.start()
      mediaRef.current = recorder
      setRecording(true)
      setTimeout(() => window.dispatchEvent(new CustomEvent('cc:terminal-refresh')), 100)
    } catch (err) {
      setRecording(false)
      addToastInput({ type: 'error', title: 'Mikrofon nicht verfügbar', body: String(err) })
    }
    return

    // Fallback: Web Speech API
    const SR = (window as unknown as { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition
      ?? (window as unknown as { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition
    if (!SR) return
    const rec = new SR()
    rec.continuous = false; rec.interimResults = false; rec.lang = 'de-DE'
    rec.onresult = (e: SpeechRecognitionEvent) => {
      const t = Array.from(e.results).map(r => r[0].transcript).join('')
      setInputValue(prev => prev ? prev + ' ' + t : t)
    }
    rec.onend = () => setRecording(false)
    rec.onerror = () => setRecording(false)
    rec.start(); recRef.current = rec; setRecording(true)
  }

  const sendRaw = (signal: string) => {
    window.dispatchEvent(new CustomEvent('cc:terminal-send-raw', { detail: { sessionId: activeSessionId, data: signal } }))
  }

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter (no shift) → send command
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); return }

    if (!isTerminal) return

    const ta = e.currentTarget

    // Tab → send completion signal
    const tabSc = terminalShortcuts.find(s => s.id === 'tab' && s.enabled)
    if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey && tabSc) {
      e.preventDefault()
      sendRaw(tabSc.signal)
      return
    }

    // Arrow Up/Down → chat message history (when input is empty or navigating)
    if (e.key === 'ArrowUp' && !e.ctrlKey && !e.metaKey && !isTerminal) {
      const h = chatHistoryRef.current
      if (h.length > 0 && (ta.value === '' || historyIndexRef.current >= 0)) {
        e.preventDefault()
        const next = Math.min(historyIndexRef.current + 1, h.length - 1)
        historyIndexRef.current = next
        setInputValue(h[next])
        setTimeout(() => { ta.selectionStart = ta.selectionEnd = ta.value.length }, 0)
        return
      }
    }
    if (e.key === 'ArrowDown' && !e.ctrlKey && !e.metaKey && !isTerminal && historyIndexRef.current >= 0) {
      e.preventDefault()
      const next = historyIndexRef.current - 1
      historyIndexRef.current = next
      setInputValue(next < 0 ? '' : chatHistoryRef.current[next])
      setTimeout(() => { ta.selectionStart = ta.selectionEnd = ta.value.length }, 0)
      return
    }

    // Arrow Up/Down → history navigation (only when textarea is single-line or cursor at edge)
    if (e.key === 'ArrowUp' && !e.ctrlKey && !e.metaKey) {
      const sc = terminalShortcuts.find(s => s.id === 'arrow-up' && s.enabled)
      if (sc && (ta.value === '' || ta.selectionStart === 0)) {
        e.preventDefault()
        sendRaw(sc.signal)
        return
      }
    }
    if (e.key === 'ArrowDown' && !e.ctrlKey && !e.metaKey) {
      const sc = terminalShortcuts.find(s => s.id === 'arrow-down' && s.enabled)
      if (sc && (ta.value === '' || ta.selectionStart === ta.value.length)) {
        e.preventDefault()
        sendRaw(sc.signal)
        return
      }
    }

    // Ctrl+X shortcuts → send control characters
    if (e.ctrlKey && !e.metaKey) {
      const k = e.key.toLowerCase()
      const sc = terminalShortcuts.find(s => s.ctrl && s.key.toLowerCase() === k && s.enabled)
      if (sc) {
        e.preventDefault()
        sendRaw(sc.signal)
      }
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: `0px ${containerWidth < 680 ? '16px' : '100px'} 36px`, background: 'var(--bg-0)', position: 'relative' }}>
      <style>{`
        @property --orbit-angle {
          syntax: '<angle>';
          initial-value: 0deg;
          inherits: false;
        }
        @keyframes orbit-angle-spin {
          to { --orbit-angle: 360deg; }
        }
      `}</style>
      <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={handleAttach} />

      {/* Drag overlay — always in DOM so drop events always fire; visibility toggled via opacity/pointer-events */}
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 999,
          background: 'rgba(249,115,22,0.07)',
          border: '2px dashed rgba(249,115,22,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12,
          opacity: isDragOver ? 1 : 0,
          pointerEvents: 'none',
          transition: 'opacity 0.15s',
        }}
      >
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(249,115,22,0.85)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        <span style={{ fontSize: 14, color: 'rgba(249,115,22,0.9)', fontWeight: 600 }}>Bilder hier ablegen</span>
      </div>

      {/* Attachment image preview — floats above textbox, not fullscreen */}
      {attachPreviewSrc && (() => {
        const rect = borderWrapRef.current?.getBoundingClientRect()
        const bottom = rect ? window.innerHeight - rect.top + 8 : 200
        const previewFile = pendingFiles.find(f => f.previewUrl === attachPreviewSrc || f.url === attachPreviewSrc)
        return (
          <div
            onClick={() => setAttachPreviewSrc(null)}
            style={{
              position: 'fixed', left: 0, right: 0,
              bottom, zIndex: 200,
              display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
              cursor: 'zoom-out',
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                position: 'relative', borderRadius: 8,
                boxShadow: '0 8px 40px rgba(0,0,0,0.55)',
                overflow: 'hidden', cursor: 'default', maxWidth: '80vw',
              }}
            >
              <img
                src={attachPreviewSrc}
                style={{ display: 'block', maxWidth: '80vw', maxHeight: '62vh', objectFit: 'contain' }}
                alt=""
              />
              {/* Top bar with buttons */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 10px',
                background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 100%)',
              }}>
                {/* Bild bearbeiten — only if it's a pending file */}
                {previewFile ? (
                  <button
                    onClick={() => { setAttachPreviewSrc(null); setAnnotatingFileId(previewFile.id) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '5px 12px', borderRadius: 6,
                      background: 'var(--accent)', border: 'none',
                      cursor: 'pointer', color: '#fff',
                      fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-ui)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                    }}
                  >
                    <IEdit style={{ width: 12, height: 12 }} />
                    Bild bearbeiten
                  </button>
                ) : <div />}
                {/* Close */}
                <button
                  onClick={() => setAttachPreviewSrc(null)}
                  style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.2)',
                    cursor: 'pointer', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                  }}
                >
                  <IClose style={{ width: 12, height: 12 }} />
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Inline path input — shown when Pfad/Bild button is active */}
      {isTerminal && pathInput && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, padding: '5px 8px', background: 'var(--bg-2)', border: '1px solid var(--line-strong)', borderRadius: 6 }}>
          <IFile style={{ color: 'var(--fg-3)', flexShrink: 0, width: 11, height: 11 }} />
          <input
            autoFocus
            value={pathInputVal}
            onChange={e => setPathInputVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') confirmPathInput(); if (e.key === 'Escape') { setPathInput(null); setPathInputVal(''); setTimeout(() => window.dispatchEvent(new CustomEvent('cc:terminal-refresh')), 50) } }}
            onDrop={e => { e.preventDefault(); const txt = e.dataTransfer.getData('text/plain'); const file = Array.from(e.dataTransfer.files)[0] as (File & { path?: string }) | undefined; const p = txt || file?.path || file?.name || ''; if (p) setPathInputVal(p) }}
            onDragOver={e => e.preventDefault()}
            placeholder={pathInput === 'image' ? 'Pfad eintippen oder Bild aus Finder hier reinziehen…' : 'Pfad eintippen oder Datei aus Finder hier reinziehen…'}
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 11.5, color: 'var(--fg-0)', fontFamily: 'var(--font-mono)' }}
          />
          <button onClick={confirmPathInput} disabled={!pathInputVal.trim()} style={{ background: 'var(--bg-3)', border: '1px solid var(--line-strong)', borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 500, color: 'var(--fg-1)', cursor: pathInputVal.trim() ? 'pointer' : 'default', opacity: pathInputVal.trim() ? 1 : 0.4 }}>
            Einfügen
          </button>
          <button onClick={() => { setPathInput(null); setPathInputVal(''); setTimeout(() => window.dispatchEvent(new CustomEvent('cc:terminal-refresh')), 50) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-3)', display: 'flex', padding: 2 }}>
            <IClose style={{ width: 10, height: 10 }} />
          </button>
        </div>
      )}

      {/* ── Border wrapper ── */}
      <div ref={borderWrapRef} style={{
        flexShrink: 0, borderRadius: 6, padding: isOrbit ? 1 : 0,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)', position: 'relative', overflow: 'hidden',
        border: isOrbit ? 'none' : `1px solid ${focused ? 'var(--accent)' : 'var(--line-strong)'}`,
        ...(isOrbit ? {
          background: 'conic-gradient(from var(--orbit-angle), #3b82f6, #8b5cf6, #a855f7, #6366f1, #818cf8, #60a5fa, #7c3aed, #3b82f6)',
          animation: 'orbit-angle-spin 3s linear infinite',
        } : {}),
      }}>
        {/* Inner content */}
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', borderRadius: isOrbit ? 6 : 6, background: 'var(--bg-1)', padding: '8px 12px 6px', overflow: 'visible' }}>
        {/* File attachments (images + documents) */}
        <DragOverlay visible={isDragOver} maxReached={pendingFiles.length >= 6} />
        <FileAttachmentBar files={pendingFiles} onRemove={removePendingFile} onPreview={setAttachPreviewSrc} onAnnotate={setAnnotatingFileId} />
        {attachments.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 6 }}>
            {attachments.map(p => {
              const label = isTerminal ? p.split('/').pop() ?? p : p
              const title = isTerminal ? p : undefined
              return (
                <span key={p} title={title} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 6px 2px 7px', background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 6, fontSize: 10.5, color: 'var(--fg-1)', fontFamily: 'var(--font-mono)', maxWidth: 280 }}>
                  <IFile style={{ color: 'var(--accent)', flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
                  <IClose style={{ color: 'var(--fg-3)', cursor: 'pointer', marginLeft: 2, flexShrink: 0 }} onClick={() => removeAttachment(p)} />
                </span>
              )
            })}
          </div>
        )}

        <textarea
          ref={taRef}
          value={inputValue}
          onChange={e => { historyIndexRef.current = -1; setInputValue(e.target.value) }}
          onKeyDown={handleKey}
          // Prevent binary file drops into the terminal — they cause xterm to go black
          onDragOver={isTerminal ? e => e.preventDefault() : undefined}
          onDrop={isTerminal ? e => e.preventDefault() : undefined}
          placeholder={isTerminal ? 'Befehl eingeben oder Text tippen…' : isOrbit ? 'Schreib etwas an Orbit… · ⏎ Senden · ⇧⏎ Neue Zeile' : 'Nachricht an den Agenten… · ⏎ Senden · ⇧⏎ Neue Zeile'}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--fg-0)', background: 'transparent', border: 'none', outline: 'none', resize: 'vertical', width: '100%', minHeight: 68, maxHeight: 600 }}
        />


        {/* ── Reference pills — confirmed refs removed from text, kept until send or × ── */}
        {confirmedRefs.size > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, padding: '5px 0 2px' }}>
            {[...confirmedRefs].map(ref => {
              const [type, id] = ref.split(':')
              const short = id.slice(-8)
              const color = type === 'chat' ? 'var(--orbit)' : 'var(--accent)'
              const removeRef = () => setConfirmedRefs(prev => { const n = new Set(prev); n.delete(ref); return n })
              return (
                <span key={ref} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 6px', marginBottom: 3, background: 'var(--bg-2)', border: '1px solid var(--line-strong)', borderRadius: 6, fontSize: 10, fontFamily: 'var(--font-mono)', color, whiteSpace: 'nowrap' }}>
                  <span style={{ opacity: 0.6 }}>#</span>
                  <span style={{ opacity: 0.9 }}>{type}:</span>
                  <span>{short}</span>
                  <span onClick={removeRef} title="Entfernen" style={{ marginLeft: 2, cursor: 'pointer', opacity: 0.45, fontSize: 11, lineHeight: 1, display: 'flex', alignItems: 'center', fontFamily: 'var(--font-ui)' }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '0.45')}>×</span>
                </span>
              )
            })}
          </div>
        )}

        {/* Favorite templates — always auto-included on send */}
        {templates.some(t => t.favorite) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, padding: '5px 0 4px', borderTop: '1px solid var(--line)', alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: 'var(--fg-3)', letterSpacing: 0.3, userSelect: 'none' }}>auto:</span>
            {templates.filter(t => t.favorite).map(t => (
              <span
                key={t.id}
                title={t.body}
                onContextMenu={e => { e.preventDefault(); setTplMenu({ x: e.clientX, y: e.clientY, tpl: t }) }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px 2px 6px', background: 'var(--accent-soft)', border: '1px solid var(--accent-line)', borderRadius: 99, color: 'var(--accent)', fontSize: 10.5, userSelect: 'none' }}
              >
                <span style={{ fontSize: 10 }}>★</span>
                {t.name}
                <span
                  title="Aus Favoriten entfernen"
                  onClick={() => updateTemplate(t.id, { favorite: false })}
                  style={{ marginLeft: 2, lineHeight: 1, cursor: 'pointer', opacity: 0.6, fontSize: 11, display: 'flex', alignItems: 'center' }}
                >×</span>
              </span>
            ))}
          </div>
        )}
        {/* Template context menu */}
        {tplMenu && (
          <div
            onClick={() => setTplMenu(null)}
            style={{ position: 'fixed', inset: 0, zIndex: 1000 }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{ position: 'fixed', left: tplMenu.x, top: tplMenu.y, zIndex: 1001, background: 'var(--bg-1)', border: '1px solid var(--line-strong)', borderRadius: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.3)', minWidth: 160, padding: '3px 0' }}
            >
              {[
                { label: 'Bearbeiten', action: () => { setEditTemplate(tplMenu.tpl); setTplMenu(null) } },
                { label: 'Aus Favoriten entfernen', action: () => { updateTemplate(tplMenu.tpl.id, { favorite: false }); setTplMenu(null) } },
              ].map(item => (
                <TplCtxItem key={item.label} label={item.label} onClick={item.action} />
              ))}
            </div>
          </div>
        )}
        {editTemplate && (
          <EditTemplateModal template={editTemplate} onClose={() => setEditTemplate(null)} />
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 5, borderTop: '1px solid var(--line)' }}>
          {isPtyTerminal ? (
            <>
              <button
                style={{ ...chip, background: pathInput ? 'var(--accent-soft)' : 'var(--bg-2)', border: `1px solid ${pathInput ? 'var(--accent)' : 'var(--line)'}`, color: pathInput ? 'var(--accent)' : 'var(--fg-2)', padding: '5px 8px' }}
                onClick={() => { setPathInput(p => p ? null : 'file'); setPathInputVal('') }}
                title="Datei oder Pfad einfügen"
              >
                <IPaperclip style={{ width: 13, height: 13, flexShrink: 0 }} />
              </button>
              {isPtyTerminal && (
                <button
                  style={{ ...chip, background: showShortcuts ? 'var(--accent-soft)' : 'var(--bg-2)', border: `1px solid ${showShortcuts ? 'var(--accent)' : 'var(--line)'}`, color: showShortcuts ? 'var(--accent)' : 'var(--fg-2)', padding: '5px 8px' }}
                  onClick={() => setShowShortcuts(v => !v)}
                  title="Terminal-Tastenkürzel anzeigen"
                >
                  <IKeyboard style={{ width: 13, height: 13, flexShrink: 0 }} />
                </button>
              )}
            </>
          ) : (
            <button
              style={{ ...chip, background: 'var(--bg-2)', border: '1px solid var(--line)', color: 'var(--fg-2)', padding: '5px 8px' }}
              onClick={() => fileInputRef.current?.click()}
              title="Datei oder Bild anhängen"
            >
              <IPaperclip style={{ width: 13, height: 13, flexShrink: 0 }} />
            </button>
          )}
          <span style={{ flex: 1 }} />
          <button
            onClick={transcribing ? undefined : toggleVoice}
            disabled={transcribing}
            title={transcribing ? 'Transkribiere…' : recording ? 'Aufnahme stoppen' : 'Spracheingabe starten'}
            style={{ ...chip, padding: '5px 8px',
              color:      transcribing ? 'var(--accent)' : recording ? 'var(--err)' : 'var(--fg-2)',
              border:     `1px solid ${transcribing ? 'var(--accent)' : recording ? 'var(--err)' : 'var(--line)'}`,
              background: transcribing ? 'var(--accent-soft)' : recording ? 'rgba(239,122,122,0.1)' : 'var(--bg-2)',
            }}
          >
            {transcribing
              ? <ISpinner size={13} />
              : <IMic style={{ width: 13, height: 13, color: recording ? 'var(--err)' : 'var(--fg-3)', flexShrink: 0, ...(recording ? { animation: 'cc-pulse 1s ease-in-out infinite' } : {}) }} />}
          </button>
          <button
            onClick={refineWithAI}
            disabled={aiRefining || aiAnalysing || !inputValue.trim()}
            title={(() => {
              const model = aiFunctionMap['terminal'] || 'OpenRouter'
              return `Text mit ${model} überarbeiten`
            })()}
            style={{ ...chip, padding: '5px 8px', color: 'var(--accent)', border: '1px solid var(--accent-line)', background: 'var(--accent-soft)', opacity: (aiRefining || aiAnalysing || !inputValue.trim()) ? 0.5 : 1 }}
          >
            <ISpark style={{ flexShrink: 0, width: 13, height: 13, ...(aiRefining ? { animation: 'cc-pulse 0.5s ease-in-out infinite' } : {}) }} />
          </button>
          <button
            onClick={analyseWithAI}
            disabled={aiAnalysing || aiRefining || !inputValue.trim()}
            title={(() => {
              const model = aiFunctionMap['terminal'] || 'OpenRouter'
              return `Implementierungsauftrag mit ${model} generieren`
            })()}
            style={{ ...chip, padding: '5px 8px', color: 'var(--ok)', border: '1px solid color-mix(in srgb, var(--ok) 35%, transparent)', background: 'color-mix(in srgb, var(--ok) 12%, transparent)', opacity: (aiAnalysing || aiRefining || !inputValue.trim()) ? 0.5 : 1 }}
          >
            <IBolt style={{ flexShrink: 0, width: 13, height: 13, ...(aiAnalysing ? { animation: 'cc-pulse 0.5s ease-in-out infinite' } : {}) }} />
          </button>
          {(() => {
            const canSend = !!(inputValue.trim() || pendingFiles.length > 0 || attachments.length > 0 || templates.some(t => t.favorite))
            const sendDisabled = hasUploading || !canSend
            return (
              <button
                onClick={send}
                disabled={sendDisabled}
                title={hasUploading ? 'Dateien werden hochgeladen…' : !canSend ? 'Nachricht eingeben' : undefined}
                style={{ ...primaryBtn, display: 'flex', alignItems: 'center', gap: 5, opacity: sendDisabled ? 0.45 : 1, ...(isOrbit ? { background: 'var(--orbit)', color: '#fff' } : {}) }}
              >
                {hasUploading
                  ? <span style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid #fff4', borderTopColor: isOrbit ? '#fff' : 'var(--accent-fg)', animation: 'cc-spin 0.7s linear infinite', display: 'inline-block', flexShrink: 0 }} />
                  : isOrbit ? <ISend style={{ color: '#fff' }} /> : <ITerminal style={{ color: 'var(--accent-fg)' }} />
                }
                {hasUploading ? 'Uploading…' : 'Senden'}
              </button>
            )
          })()}
        </div>
        </div>{/* end inner content */}
      </div>{/* end animated border wrapper */}

      {/* Terminal shortcuts reference modal */}
      {showShortcuts && isTerminal && (
        <TerminalShortcutsModal shortcuts={terminalShortcuts} onClose={() => setShowShortcuts(false)} />
      )}

      {/* Image annotation modal */}
      {annotatingFile && (
        <ImageAnnotator
          src={annotatingFile.previewUrl ?? annotatingFile.url ?? ''}
          fileName={annotatingFile.name}
          onDone={(newFile) => {
            replaceFile(annotatingFileId!, newFile)
            setAnnotatingFileId(null)
          }}
          onCancel={() => setAnnotatingFileId(null)}
        />
      )}

    </div>
  )
}



const CATEGORY_LABELS: Record<string, string> = {
  control:    'Prozesssteuerung',
  editing:    'Zeile bearbeiten',
  navigation: 'Navigation & History',
}

function TerminalShortcutsModal({ shortcuts, onClose }: { shortcuts: TerminalShortcut[]; onClose: () => void }) {
  const { setScreen } = useAppStore()
  const categories = ['control', 'navigation', 'editing'] as const
  return (
    /* Full-screen backdrop — click outside closes */
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1500, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--bg-1)', border: '1px solid var(--line-strong)', borderRadius: 6, boxShadow: '0 20px 60px rgba(0,0,0,0.5)', width: 380, maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--line)', background: 'var(--bg-2)', flexShrink: 0 }}>
          <IKeyboard style={{ width: 13, height: 13, color: 'var(--accent)' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)', flex: 1 }}>Terminal-Tastenkürzel</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-3)', display: 'flex', padding: 4, fontSize: 16, lineHeight: 1 }}>×</button>
        </div>

        {/* Shortcut list */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '8px 0' }}>
          {categories.map(cat => {
            const items = shortcuts.filter(s => s.category === cat)
            if (!items.length) return null
            return (
              <div key={cat}>
                <div style={{ padding: '6px 16px 3px', fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--fg-3)' }}>
                  {CATEGORY_LABELS[cat]}
                </div>
                {items.map(sc => (
                  <div key={sc.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 16px', opacity: sc.enabled ? 1 : 0.38 }}>
                    <span style={{ minWidth: 64, fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: sc.enabled ? 'var(--accent)' : 'var(--fg-3)', background: sc.enabled ? 'var(--accent-soft)' : 'var(--bg-3)', border: `1px solid ${sc.enabled ? 'var(--accent-line)' : 'var(--line)'}`, borderRadius: 6, padding: '2px 7px', textAlign: 'center', flexShrink: 0 }}>
                      {sc.label}
                    </span>
                    <span style={{ fontSize: 11.5, color: 'var(--fg-1)', flex: 1 }}>{sc.description}</span>
                    {!sc.enabled && <span style={{ fontSize: 9.5, color: 'var(--fg-3)', flexShrink: 0 }}>aus</span>}
                  </div>
                ))}
              </div>
            )
          })}
        </div>

        {/* Footer with settings link */}
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--line)', background: 'var(--bg-2)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>Aktivieren / deaktivieren unter:</span>
          <button
            onClick={() => { onClose(); setScreen('settings') }}
            style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent-line)', borderRadius: 6, padding: '3px 10px', fontSize: 11, color: 'var(--accent)', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)' }}
          >
            Einstellungen →
          </button>
        </div>
      </div>
    </div>
  )
}
