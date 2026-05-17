/**
 * BrowserPane — iframe browser with URL bar + unified mode toolbar.
 * Draw mode shows an integrated sub-toolbar (Speichern / Abbrechen + drawing tools).
 * DrawCanvas is positioned inside the iframe container so pointer coords are correct.
 *
 * Anforderung: In dark mode the browser chrome uses light colours (and vice versa)
 * so the embedded browser is visually distinct from the rest of the UI.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { WorkshopElementRef } from '../../store/useAppStore'
import { useAppStore } from '../../store/useAppStore'
import {
  IChevLeft, IEdit, IMousePointer, IMousePointerClick, ISave, IClose, IEraser,
  IUndo, ITrash, IRotateCcw, ICamera, IMessageSquare, IGlobe,
} from '../primitives/Icons'
import { DrawCanvas } from './DrawCanvas'
import type { DrawCanvasHandle, DrawTool } from './DrawCanvas'
import { ScreenshotCrop } from './ScreenshotCrop'

const DRAW_TOOLS: { id: DrawTool; label: string }[] = [
  { id: 'pen',    label: 'Stift' },
  { id: 'eraser', label: 'Radierer' },
  { id: 'text',   label: 'Text' },
]

export type BrowserMode = 'normal' | 'draw' | 'inspect'

const COLOR_PRESETS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#ffffff', '#000000']

interface Props {
  mode: BrowserMode
  onModeChange: (m: BrowserMode) => void
  onElementCaptured: (ref: WorkshopElementRef) => void
  onScreenshot: (dataUrl: string) => void
  /** Pre-filled URL from the active project's appPort. Empty = show placeholder. */
  initialUrl?: string
  /** Close button handler — shown as × at far right of toolbar */
  onClose?: () => void
}

// ── Webview element type (Electron-specific, works cross-origin) ─────────────
interface WebviewEl extends HTMLElement {
  src: string
  getURL(): string
  reload(): void
  goBack(): void
  goForward(): void
  isLoading(): boolean
  getWebContentsId(): number
  executeJavaScript(code: string): Promise<unknown>
}

declare global {
  interface Window {
    electronAPI?: {
      platform?: string
      version?: string
      invalidateWebview?: (id: number) => void
      writeClipboard?: (text: string) => Promise<void>
    }
  }
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string; allowpopups?: string
      }
    }
  }
}

// ── Inspect script injected into webview via executeJavaScript ────────────────
// Communicates back via console.log('__cc_capture:{json}') → caught by console-message event.
const INSPECT_SCRIPT = `(function(){
  if(typeof window.__ccCleanup==='function')window.__ccCleanup();
  var ov=document.createElement('div');
  ov.style.cssText='position:fixed;pointer-events:none;z-index:2147483646;background:rgba(139,92,246,0.45);border:2px solid rgba(139,92,246,0.9);border-radius:4px;transition:top .06s,left .06s,width .06s,height .06s;display:none';
  document.body.appendChild(ov);
  var bd=document.createElement('div');
  bd.style.cssText='position:fixed;pointer-events:none;z-index:2147483647;background:rgba(15,15,15,0.88);color:#fff;font:600 11px/1.4 ui-monospace,monospace;padding:3px 7px;border-radius:4px;white-space:nowrap;display:none;backdrop-filter:blur(4px)';
  document.body.appendChild(bd);
  function pos(el){var r=el.getBoundingClientRect();ov.style.display='block';ov.style.left=r.left+'px';ov.style.top=r.top+'px';ov.style.width=r.width+'px';ov.style.height=r.height+'px';var tag=el.tagName.toLowerCase();var id=el.id?'#'+el.id:'';var cls=Array.from(el.classList).slice(0,3).map(function(c){return'.'+c;}).join('');var size=Math.round(r.width)+'×'+Math.round(r.height);bd.textContent=tag+id+cls+'  ·  '+size;bd.style.display='block';var br=bd.getBoundingClientRect();var bt=r.top-br.height-6;bd.style.top=(bt<4?r.bottom+4:bt)+'px';bd.style.left=Math.min(Math.max(r.left,4),window.innerWidth-br.width-4)+'px';}
  function clr(){ov.style.display='none';bd.style.display='none';}
  function onMove(e){var el=e.target;if(el===ov||el===bd)return;pos(el);}
  function onClick(e){
    if(!e.shiftKey)return;
    e.preventDefault();e.stopPropagation();
    var el=e.target;
    var classes=Array.from(el.classList).slice(0,5);
    var selector=el.id?'#'+el.id:classes.length?'.'+classes[0]:el.tagName.toLowerCase();
    var rect=el.getBoundingClientRect();
    var vw=window.innerWidth,vh=window.innerHeight;
    var cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;
    var hPos=cx<vw*0.33?'links':cx<vw*0.67?'mitte':'rechts';
    var vPos=cy<vh*0.33?'oben':cy<vh*0.67?'mitte':'unten';
    var position=vPos==='mitte'&&hPos==='mitte'?'mitte':vPos===hPos?vPos:vPos+' '+hPos;
    var ancestors=[];var parent=el.parentElement;
    for(var i=0;i<2&&parent&&parent.tagName!=='BODY'&&parent.tagName!=='HTML';i++,parent=parent.parentElement){
      ancestors.unshift(parent.id?'#'+parent.id:parent.classList[0]?'.'+parent.classList[0]:parent.tagName.toLowerCase());
    }
    var hierarchy=ancestors.length>0?ancestors.join(' › ')+' › '+selector:undefined;
    var rawText=(el.textContent||'').trim().replace(/\\s+/g,' ');
    var text=rawText.length>15?rawText.slice(0,15)+'…':rawText||undefined;
    console.log('__cc_capture:'+JSON.stringify({tag:el.tagName.toLowerCase(),id:el.id||'',classes:classes,text:text,selector:selector,page:document.title||window.location.pathname,position:position,hierarchy:hierarchy}));
    clr();
  }
  document.addEventListener('mousemove',onMove);
  document.addEventListener('mouseleave',clr);
  document.addEventListener('click',onClick,true);
  window.__ccCleanup=function(){clr();ov.remove();bd.remove();document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseleave',clr);document.removeEventListener('click',onClick,true);window.__ccCleanup=null;};
})();`

const INSPECT_CLEANUP = `if(typeof window.__ccCleanup==='function')window.__ccCleanup();`

// ── Legacy same-origin inject (kept for fallback) ─────────────────────────────
function injectInspect(doc: Document, onCapture: (r: WorkshopElementRef) => void): () => void {
  const win = doc.defaultView!

  // ── Overlay fill div (transparent red, no border) ────────────────────────
  const overlay = doc.createElement('div')
  overlay.style.cssText = [
    'position:fixed', 'pointer-events:none', 'z-index:2147483646',
    'background:rgba(139,92,246,0.45)', 'border:2px solid rgba(139,92,246,0.9)', 'border-radius:4px',
    'transition:top .06s,left .06s,width .06s,height .06s',
    'display:none',
  ].join(';')
  doc.body.appendChild(overlay)

  // ── Info badge shown above the hovered element ───────────────────────────
  const badge = doc.createElement('div')
  badge.style.cssText = [
    'position:fixed', 'pointer-events:none', 'z-index:2147483647',
    'background:rgba(15,15,15,0.88)', 'color:#fff',
    'font:600 11px/1.4 ui-monospace,monospace',
    'padding:3px 7px', 'border-radius:4px',
    'white-space:nowrap', 'display:none',
    'backdrop-filter:blur(4px)',
  ].join(';')
  doc.body.appendChild(badge)

  const positionOverlay = (el: HTMLElement) => {
    const r = el.getBoundingClientRect()
    overlay.style.display = 'block'
    overlay.style.left   = r.left   + 'px'
    overlay.style.top    = r.top    + 'px'
    overlay.style.width  = r.width  + 'px'
    overlay.style.height = r.height + 'px'

    // Badge content
    const tag    = el.tagName.toLowerCase()
    const idPart = el.id ? '#' + el.id : ''
    const clsPart = [...el.classList].slice(0, 3).map(c => '.' + c).join('')
    const ident  = (idPart + clsPart) || ''
    const size = `${Math.round(r.width)}×${Math.round(r.height)}`
    // React component name
    let compName: string | undefined
    try {
      const fk = Object.keys(el).find(k => k.startsWith('__reactFiber'))
      if (fk) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let f = (el as any)[fk]
        while (f) { if (f.type?.name) { compName = f.type.name; break }; f = f.return }
      }
    } catch {}
    badge.textContent = [compName ?? tag, ident, size].filter(Boolean).join('  ·  ')

    // Position badge above element; clamp to viewport
    badge.style.display = 'block'
    const bRect = badge.getBoundingClientRect()
    const bTop  = r.top - bRect.height - 6
    badge.style.top  = (bTop < 4 ? r.bottom + 4 : bTop) + 'px'
    badge.style.left = Math.min(Math.max(r.left, 4), win.innerWidth - bRect.width - 4) + 'px'
  }

  const clearOverlay = () => {
    overlay.style.display = 'none'
    badge.style.display   = 'none'
  }

  const onMove = (e: MouseEvent) => {
    const el = e.target as HTMLElement
    if (el === overlay || el === badge) return
    positionOverlay(el)
  }

  const onClick = (e: MouseEvent) => {
    if (!e.shiftKey) return
    e.preventDefault(); e.stopPropagation()
    const el = e.target as HTMLElement

    // ── React component name ────────────────────────────────────────────────
    let component: string | undefined
    try {
      const fk = Object.keys(el).find(k => k.startsWith('__reactFiber'))
      if (fk) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let f = (el as any)[fk]
        while (f) { if (f.type?.name) { component = f.type.name; break }; f = f.return }
      }
    } catch {}

    const classes  = [...el.classList].slice(0, 5)
    const selector = el.id ? '#' + el.id : classes.length ? '.' + classes[0] : el.tagName.toLowerCase()
    const page     = doc.title?.trim() || win.location.pathname.split('/').filter(Boolean).pop() || win.location.pathname || 'unbekannt'

    const rect = el.getBoundingClientRect()
    const vw = win.innerWidth, vh = win.innerHeight
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2
    const hPos = cx < vw * 0.33 ? 'links' : cx < vw * 0.67 ? 'mitte' : 'rechts'
    const vPos = cy < vh * 0.33 ? 'oben'  : cy < vh * 0.67 ? 'mitte' : 'unten'
    const position = vPos === 'mitte' && hPos === 'mitte' ? 'mitte' : vPos === hPos ? vPos : `${vPos} ${hPos}`

    const ancestors: string[] = []
    let parent = el.parentElement
    for (let i = 0; i < 2 && parent && parent.tagName !== 'BODY' && parent.tagName !== 'HTML'; i++, parent = parent.parentElement) {
      const pSel = parent.id ? '#' + parent.id : parent.classList[0] ? '.' + parent.classList[0] : parent.tagName.toLowerCase()
      ancestors.unshift(pSel)
    }
    const hierarchy = ancestors.length > 0 ? ancestors.join(' › ') + ' › ' + selector : undefined

    const rawText = el.textContent?.trim().replace(/\s+/g, ' ') ?? ''
    const text    = rawText.length > 15 ? rawText.slice(0, 15) + '…' : rawText || undefined

    onCapture({ tag: el.tagName.toLowerCase(), id: el.id, classes, text, component, selector, page, position, hierarchy })
    clearOverlay()
  }

  doc.addEventListener('mousemove', onMove)
  doc.addEventListener('mouseleave', clearOverlay)
  doc.addEventListener('click', onClick, true)
  return () => {
    clearOverlay()
    overlay.remove()
    badge.remove()
    doc.removeEventListener('mousemove', onMove)
    doc.removeEventListener('mouseleave', clearOverlay)
    doc.removeEventListener('click', onClick, true)
  }
}

// ── Server-side Playwright screenshot ────────────────────────────────────────
// Calls the Express /api/screenshot route which uses headless Chromium.
// Much more reliable than getDisplayMedia (no permissions, no black frames).
async function captureViaServer(url: string, width: number, height: number): Promise<string | null> {
  try {
    const resp = await fetch('/api/screenshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, width: Math.round(width) || 1280, height: Math.round(height) || 800 }),
    })
    const data: { ok: boolean; dataUrl?: string; error?: string } = await resp.json()
    if (data.ok && data.dataUrl) return data.dataUrl
    console.warn('[Workshop] Server screenshot failed:', data.error)
    return null
  } catch (err) {
    console.warn('[Workshop] Server screenshot fetch error:', err)
    return null
  }
}

export function BrowserPane({ mode, onModeChange, onElementCaptured, onScreenshot, initialUrl = '', onClose }: Props) {
  // Only subscribe to `theme` — avoids re-rendering BrowserPane on every store change
  const theme = useAppStore(s => s.theme)
  const webviewRef     = useRef<HTMLElement>(null)
  const drawRef        = useRef<DrawCanvasHandle>(null)
  const cleanupInspect = useRef<(() => void) | null>(null)
  const wvReady        = useRef(false)   // true after dom-ready fires
  const wv = () => webviewRef.current as WebviewEl | null

  // ResizeObserver disabled — was freezing wrong px values when firing before
  // final flex layout pass. width/height:'100%' + zoom:'1' handle sizing instead.

  const execJS = (script: string) => {
    const el = wv()
    if (!el || !wvReady.current) return
    el.executeJavaScript(script).catch(() => {})
  }

  // Start with the project's app URL if known; otherwise blank (user enters manually)
  const [url, setUrl]           = useState(initialUrl)
  const [inputUrl, setInputUrl] = useState(initialUrl)
  const [error, setError]       = useState(false)
  const [loading, setLoading]   = useState(!!initialUrl) // show "Lädt…" if we have an initial URL

  // Draw sub-toolbar state
  const [drawTool,  setDrawTool]  = useState<DrawTool>('pen')
  const [drawColor, setDrawColor] = useState('#ef4444')
  const [drawSize,  setDrawSize]  = useState(4)

  // Screenshot crop modal
  const [snipData, setSnipData] = useState<string | null>(null)
  const [saving,   setSaving]   = useState(false)

  // ── Browser chrome colours — always white toolbar with bg-1 text/icons ──────
  const bChrome: React.CSSProperties = { background: '#ffffff', borderColor: '#e8e8e8', color: 'rgba(0,0,0,0.6)' }

  // ── Navigation ──────────────────────────────────────────────────────────────
  const navigate = useCallback((target: string) => {
    let u = target.trim()
    if (!u) { setUrl(''); setInputUrl(''); setError(false); return }
    if (!u.startsWith('http://') && !u.startsWith('https://') && !u.startsWith('/')) u = 'http://' + u
    setUrl(u); setInputUrl(u); setError(false); setLoading(true)
  }, [])

  const reload = () => { if (url) { setLoading(true); wv()?.reload() } }
  const back   = () => { wv()?.goBack() }
  const fwd    = () => { wv()?.goForward() }

  // ── Webview events (load / error / console-message) ─────────────────────────
  useEffect(() => {
    const el = wv()
    if (!el) return

    // Force Electron GPU surface to repaint.
    // Primary: webContents.invalidate() via IPC (most reliable).
    // Fallback: resize trick forces compositor to re-rasterize.
    const forceRepaint = () => {
      // IPC invalidate — directly tells Electron to redraw the webview GPU surface
      try {
        const id = (el as WebviewEl).getWebContentsId()
        window.electronAPI?.invalidateWebview?.(id)
      } catch {}

      // Resize fallback
      const e = el as HTMLElement
      e.style.width = 'calc(100% + 1px)'
      requestAnimationFrame(() => {
        e.style.width = '100%'
        requestAnimationFrame(() => {
          e.style.visibility = 'hidden'
          requestAnimationFrame(() => { e.style.visibility = '' })
        })
      })
    }

    const onDomReady   = () => {
      wvReady.current = true
      if (mode === 'inspect') execJS(INSPECT_SCRIPT)
      forceRepaint()
    }
    const onLoad = () => {
      setError(false); setLoading(false)
      try { setInputUrl(el.getURL()) } catch {}
      if (mode === 'inspect') execJS(INSPECT_SCRIPT)
      forceRepaint()
    }

    // Polling fallback: did-finish-load sometimes doesn't fire (Electron timing issue).
    // Poll isLoading() every 500ms; clear loading state once the page is done.
    const poll = setInterval(() => {
      try {
        const wvEl = el as WebviewEl
        if (!wvEl.isLoading()) {
          clearInterval(poll)
          setLoading(false)
          setError(false)
          try { setInputUrl(wvEl.getURL()) } catch {}
          forceRepaint()
        }
      } catch { clearInterval(poll) }
    }, 500)

    // Absolute timeout: never show "Lädt…" more than 15s
    const loadTimeout = setTimeout(() => { setLoading(false) }, 15000)
    const onFailLoad = (e: Event) => {
      const ev = e as Event & { isMainFrame?: boolean; errorCode?: number }
      if (ev.isMainFrame && ev.errorCode !== -3) { setError(true); setLoading(false) }
    }
    const onStartLoad = () => { wvReady.current = false; setLoading(true) }
    const onNavigate  = () => { try { setInputUrl(el.getURL()) } catch {} }
    const onConsole   = (e: Event) => {
      const msg = (e as Event & { message?: string }).message ?? ''
      if (msg.startsWith('__cc_capture:')) {
        try { onElementCaptured(JSON.parse(msg.slice('__cc_capture:'.length)) as WorkshopElementRef) } catch {}
      }
    }

    el.addEventListener('dom-ready',            onDomReady)
    el.addEventListener('did-finish-load',      onLoad)
    el.addEventListener('did-fail-load',        onFailLoad)
    el.addEventListener('did-start-loading',    onStartLoad)
    el.addEventListener('did-navigate',         onNavigate)
    el.addEventListener('did-navigate-in-page', onNavigate)
    el.addEventListener('console-message',      onConsole)

    // Handle already-loaded webview (events fired before listeners attached)
    try {
      if (!el.isLoading()) { wvReady.current = true; setError(false); setLoading(false); try { setInputUrl(el.getURL()) } catch {} }
    } catch {}

    return () => {
      wvReady.current = false
      clearInterval(poll)
      clearTimeout(loadTimeout)
      el.removeEventListener('dom-ready',            onDomReady)
      el.removeEventListener('did-finish-load',      onLoad)
      el.removeEventListener('did-fail-load',        onFailLoad)
      el.removeEventListener('did-start-loading',    onStartLoad)
      el.removeEventListener('did-navigate',         onNavigate)
      el.removeEventListener('did-navigate-in-page', onNavigate)
      el.removeEventListener('console-message',      onConsole)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, mode, onElementCaptured])

  // ── Inject / cleanup inspect on mode change ─────────────────────────────────
  useEffect(() => {
    if (mode === 'inspect') {
      execJS(INSPECT_SCRIPT)
    } else {
      execJS(INSPECT_CLEANUP)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  // ── Draw: Speichern ──────────────────────────────────────────────────────────
  // Screenshots the current URL via Playwright, composites drawing strokes on top.
  const saveDraw = useCallback(async () => {
    const dc = drawRef.current
    if (!dc?.hasStrokes()) { onModeChange('normal'); return }

    setSaving(true)
    try {
      const rect      = webviewRef.current?.getBoundingClientRect() ?? { width: 1280, height: 800 }
      const w         = Math.round(rect.width)  || 1280
      const h         = Math.round(rect.height) || 800

      // 1. Screenshot the current URL via headless Chromium
      const bgUrl = await captureViaServer(url, w, h)

      // 2. Get drawing strokes (transparent PNG at canvas resolution = w×h)
      const strokesUrl = await dc.screenshot()
      if (!strokesUrl) { onModeChange('normal'); return }

      // 3. Composite: page screenshot + drawing strokes
      const composite = document.createElement('canvas')
      composite.width = w; composite.height = h
      const ctx = composite.getContext('2d')!

      if (bgUrl) {
        await new Promise<void>(resolve => {
          const img = new Image()
          img.onload = () => { ctx.drawImage(img, 0, 0, w, h); resolve() }
          img.onerror = resolve; img.src = bgUrl
        })
      } else {
        ctx.fillStyle = '#f8f8f8'; ctx.fillRect(0, 0, w, h)
      }

      await new Promise<void>(resolve => {
        const img = new Image()
        img.onload = () => { ctx.drawImage(img, 0, 0, w, h); resolve() }
        img.onerror = resolve; img.src = strokesUrl
      })

      onScreenshot(composite.toDataURL('image/png'))
      dc.clear()
    } finally {
      setSaving(false)
      onModeChange('normal')
    }
  }, [onModeChange, onScreenshot, url])

  const cancelDraw = useCallback(() => {
    drawRef.current?.clear()
    onModeChange('normal')
  }, [onModeChange])

  // ── Screenshot button → captures via Playwright → opens ScreenshotCrop ──────
  const [screenshotError, setScreenshotError] = useState<string | null>(null)

  const takeScreenshot = useCallback(async () => {
    if (!url) return
    setScreenshotError(null)
    const rect   = webviewRef.current?.getBoundingClientRect() ?? { width: 1280, height: 800 }
    const w      = Math.round(rect.width)  || 1280
    const h      = Math.round(rect.height) || 800

    const captured = await captureViaServer(url, w, h)
    if (captured) { setSnipData(captured); return }

    setScreenshotError('Screenshot fehlgeschlagen. Ist die Seite erreichbar?')
  }, [url])

  // ── Button style helpers ──────────────────────────────────────────────────────
  const btnBase: React.CSSProperties = {
    background: 'none', border: 'none', padding: '5px 7px',
    cursor: 'pointer', color: 'rgba(0,0,0,0.52)', display: 'flex',
    alignItems: 'center', borderRadius: 5, fontSize: 13,
    fontFamily: 'var(--font-ui)', transition: 'background 0.1s',
  }
  const hoverBg = 'rgba(0,0,0,0.08)'
  // Uniform icon size + stroke for every toolbar icon
  const icn: React.CSSProperties = { width: 15, height: 15, strokeWidth: 2 }
  const modeActive = (m: BrowserMode): React.CSSProperties => ({
    ...btnBase,
    background: mode === m ? 'var(--accent)' : 'transparent',
    color:      mode === m ? '#fff' : bChrome.color,
    fontWeight: mode === m ? 600 : 400,
  })

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

      {/* ── Main toolbar — browser-bar style ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 2, padding: '5px 8px',
        background: bChrome.background,
        borderBottom: `1px solid ${bChrome.borderColor}`,
        flexShrink: 0, WebkitAppRegion: 'no-drag',
      } as React.CSSProperties}>

        {/* Nav buttons */}
        <button onClick={back}   style={btnBase} title="Zurück"
          onMouseEnter={e => (e.currentTarget.style.background = hoverBg)}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <IChevLeft style={icn} />
        </button>
        <button onClick={fwd}    style={btnBase} title="Vorwärts"
          onMouseEnter={e => (e.currentTarget.style.background = hoverBg)}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <IChevLeft style={{ ...icn, transform: 'scaleX(-1)' }} />
        </button>
        <button onClick={reload} style={btnBase} title="Neu laden"
          onMouseEnter={e => (e.currentTarget.style.background = hoverBg)}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <IRotateCcw style={icn} />
        </button>

        {/* URL field — borderless, blends into white bar */}
        <form onSubmit={e => { e.preventDefault(); navigate(inputUrl) }}
          style={{ flex: 1, display: 'flex', position: 'relative', alignItems: 'center',
            borderRadius: 6,
            border: error ? '1px solid #ef4444' : '1px solid transparent',
            background: 'transparent',
            transition: 'background 0.12s',
            margin: '0 2px',
          }}
          onMouseEnter={e => { if (document.activeElement?.closest('form') !== e.currentTarget) e.currentTarget.style.background = 'rgba(0,0,0,0.05)' }}
          onMouseLeave={e => { if (document.activeElement?.closest('form') !== e.currentTarget) e.currentTarget.style.background = 'transparent' }}
          onFocus={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.10)' }}
          onBlur={e => { e.currentTarget.style.background = 'transparent' }}
        >
          <IGlobe style={{ ...icn, position: 'absolute', left: 9, color: 'rgba(0,0,0,0.52)', pointerEvents: 'none', flexShrink: 0 }} />
          <input
            value={inputUrl}
            onChange={e => setInputUrl(e.target.value)}
            placeholder="http://localhost:3000"
            style={{
              flex: 1, padding: '4px 10px 4px 28px', borderRadius: 6,
              border: 'none', background: 'transparent',
              color: 'rgba(0,0,0,0.8)', boxShadow: 'none',
              fontSize: 12, fontFamily: 'var(--font-ui)', outline: 'none',
            }}
          />
        </form>

        {/* Divider */}
        <div style={{ width: 1, height: 18, background: bChrome.borderColor, margin: '0 2px', flexShrink: 0 }} />

        {/* Mode buttons — icon only */}
        {(['normal', 'draw', 'inspect'] as BrowserMode[]).map((m, i) => (
          <button key={m}
            onClick={() => onModeChange(m)}
            style={modeActive(m)}
            title={['Normal', 'Zeichnen', 'Selektor (Shift+Klick)'][i]}
            onMouseEnter={e => { if (mode !== m) e.currentTarget.style.background = hoverBg }}
            onMouseLeave={e => { if (mode !== m) e.currentTarget.style.background = 'transparent' }}
          >
            {i === 0 && <IMousePointer style={icn} />}
            {i === 1 && <IEdit style={icn} />}
            {i === 2 && <IMousePointerClick style={icn} />}
          </button>
        ))}

        {/* Screenshot */}
        <button
          onClick={takeScreenshot}
          disabled={!url}
          style={{ ...btnBase, opacity: url ? 1 : 0.35, cursor: url ? 'pointer' : 'default' }}
          title={url ? 'Screenshot' : 'Zuerst URL eingeben'}
          onMouseEnter={e => { if (url) e.currentTarget.style.background = hoverBg }}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <ICamera style={icn} />
        </button>

        {/* Divider + Close */}
        {onClose && <>
          <div style={{ width: 1, height: 18, background: bChrome.borderColor, margin: '0 2px', flexShrink: 0 }} />
          <button
            onClick={onClose}
            style={btnBase}
            title="Schließen"
            onMouseEnter={e => (e.currentTarget.style.background = hoverBg)}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <IClose style={icn} />
          </button>
        </>}
      </div>

      {/* ── Screenshot error toast ── */}
      {screenshotError && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '4px 12px', background: 'rgba(239,68,68,0.12)',
          borderBottom: '1px solid rgba(239,68,68,0.3)', flexShrink: 0,
        }}>
          <span style={{ fontSize: 11, color: '#ef4444', fontFamily: 'var(--font-ui)' }}>
            {screenshotError}
          </span>
          <button
            onClick={() => setScreenshotError(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 14, lineHeight: 1, padding: '0 2px' }}
          >×</button>
        </div>
      )}

      {/* ── Draw sub-toolbar (only in draw mode) ── */}
      {mode === 'draw' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px',
          background: bChrome.background,
          borderBottom: `1px solid ${bChrome.borderColor}`,
          flexShrink: 0, flexWrap: 'wrap',
        }}>
          {/* Tool buttons */}
          {DRAW_TOOLS.map(t => (
            <button
              key={t.id}
              onClick={() => setDrawTool(t.id)}
              style={{
                ...btnBase,
                background: drawTool === t.id ? 'var(--accent)' : 'transparent',
                color: drawTool === t.id ? '#fff' : bChrome.color,
                fontWeight: drawTool === t.id ? 600 : 400,
              }}
              onMouseEnter={e => { if (drawTool !== t.id) e.currentTarget.style.background = hoverBg }}
              onMouseLeave={e => { if (drawTool !== t.id) e.currentTarget.style.background = 'transparent' }}
            >
              {t.id === 'pen'    && <IEdit          style={{ width: 13, height: 13, marginRight: 4, strokeWidth: 2.2 }} />}
              {t.id === 'eraser' && <IEraser        style={{ width: 13, height: 13, marginRight: 4, strokeWidth: 2.2 }} />}
              {t.id === 'text'   && <IMessageSquare style={{ width: 13, height: 13, marginRight: 4, strokeWidth: 2.2 }} />}
              {t.label}
            </button>
          ))}

          {/* Color presets */}
          {COLOR_PRESETS.map(c => (
            <button
              key={c} onClick={() => setDrawColor(c)}
              style={{
                width: 16, height: 16, borderRadius: '50%',
                border: drawColor === c ? `2px solid ${theme === 'dark' ? '#333' : '#ccc'}` : '2px solid transparent',
                background: c, cursor: 'pointer', padding: 0, flexShrink: 0,
              }}
            />
          ))}
          <input
            type="color" value={drawColor} onChange={e => setDrawColor(e.target.value)}
            style={{ width: 16, height: 16, borderRadius: '50%', border: 'none', padding: 0, cursor: 'pointer', background: 'transparent', flexShrink: 0 }}
          />

          <span style={{ fontSize: 10, color: bChrome.color, fontFamily: 'var(--font-ui)', opacity: 0.7 }}>
            {drawTool === 'text' ? 'Größe' : 'Stärke'}
          </span>
          <input
            type="range" min={1} max={30} value={drawSize}
            onChange={e => setDrawSize(+e.target.value)}
            style={{ width: 70, accentColor: 'var(--accent)' }}
          />
          <span style={{ fontSize: 10, color: bChrome.color, fontFamily: 'var(--font-mono)', minWidth: 14, opacity: 0.7 }}>{drawSize}</span>

          <button onClick={() => drawRef.current?.undo()} style={btnBase} title="Rückgängig (⌘Z)">
            <IUndo style={{ width: 13, height: 13, strokeWidth: 2.2 }} />
          </button>
          <button onClick={() => drawRef.current?.clear()} style={{ ...btnBase, color: '#ef4444' }} title="Löschen">
            <ITrash style={{ width: 13, height: 13, strokeWidth: 2.2 }} />
          </button>

          <div style={{ flex: 1 }} />

          <button
            onClick={saveDraw}
            disabled={saving}
            style={{ ...btnBase, background: 'var(--accent)', color: '#fff', fontWeight: 600, padding: '4px 12px', gap: 4, opacity: saving ? 0.6 : 1 }}
            title="Zeichnung mit Browser-Inhalt speichern"
          >
            <ISave style={{ width: 13, height: 13, strokeWidth: 2.2 }} />
            {saving ? 'Wird erfasst…' : 'Speichern'}
          </button>
          <button onClick={cancelDraw} style={{ ...btnBase, gap: 4 }} title="Abbrechen">
            <IClose style={{ width: 13, height: 13, strokeWidth: 2.2 }} />Abbrechen
          </button>
        </div>
      )}

      {/* ── Iframe area + overlays ── */}
      {/* NO overflow:hidden anywhere in the ancestor chain (clips GPU surface to black). */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>

        {/* Inspect hint */}
        {mode === 'inspect' && (
          <div style={{
            position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
            zIndex: 20, pointerEvents: 'none', padding: '4px 12px', borderRadius: 6,
            background: 'rgba(239,68,68,0.85)', color: '#fff',
            fontSize: 11, fontFamily: 'var(--font-ui)', fontWeight: 600,
          }}>
            Shift+Klick auf ein Element, um es zu erfassen
          </div>
        )}

        {/* Empty-state: no URL entered yet */}
        {!url && !error && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 4,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 10, background: '#ffffff',
          }}>
            <span style={{ fontSize: 36 }}>🌐</span>
            <span style={{ color: 'var(--fg-1)', fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-ui)' }}>
              Live Browser / Selektor
            </span>
            <span style={{ color: 'var(--fg-3)', fontSize: 12, fontFamily: 'var(--font-ui)' }}>
              URL oben eingeben und Enter drücken
            </span>
            <span style={{ color: 'var(--fg-3)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
              z.B. http://localhost:3000
            </span>
          </div>
        )}

        {/* Loading spinner */}
        {loading && url && (
          <div style={{
            position: 'absolute', top: 6, left: '50%', transform: 'translateX(-50%)',
            zIndex: 3, pointerEvents: 'none',
            padding: '3px 10px', borderRadius: 5,
            background: 'rgba(0,0,0,0.55)', color: '#fff',
            fontSize: 10, fontFamily: 'var(--font-ui)',
          }}>
            Lädt…
          </div>
        )}

        {/* Error overlay */}
        {error && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 5, display: 'flex',
            flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 12, background: 'var(--bg-0)',
          }}>
            <span style={{ fontSize: 32 }}>🌐</span>
            <span style={{ color: 'var(--fg-2)', fontSize: 13, fontFamily: 'var(--font-ui)' }}>Seite nicht erreichbar: {url}</span>
            <button
              onClick={() => navigate(inputUrl || 'http://localhost:3000')}
              style={{ padding: '7px 16px', borderRadius: 7, border: 'none', background: 'var(--accent)', color: 'var(--accent-fg)', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
            >
              Neu versuchen
            </button>
          </div>
        )}

        {/* webview — always mounted to avoid race condition on first layout pass.
            zoom:'1' neutralises the root CSS zoom that compresses the GPU surface.
            width/height:'100%' + inset:0 ensure the GPU surface fills the container. */}
        <webview
          ref={webviewRef}
          src={url || 'about:blank'}
          allowpopups=""
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            width: '100%',
            height: '100%',
            display: 'block',
            background: '#ffffff',
            zoom: 1,
            pointerEvents: url && mode !== 'draw' ? 'auto' : 'none',
          } as React.CSSProperties}
        />

        {/* DrawCanvas — positioned inside iframe container so coords are correct */}
        <DrawCanvas
          ref={drawRef}
          active={mode === 'draw'}
          tool={drawTool}
          color={drawColor}
          size={drawSize}
        />
      </div>

      {/* Screenshot crop modal */}
      {snipData && (
        <ScreenshotCrop
          dataUrl={snipData}
          onConfirm={url => { setSnipData(null); onScreenshot(url) }}
          onCancel={() => setSnipData(null)}
        />
      )}
    </div>
  )
}
