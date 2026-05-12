/**
 * FileAttachmentArea — reusable file drop + upload component
 *
 * Features:
 * - Drag & drop any allowed file type onto the document
 * - Paste images from clipboard
 * - Immediate upload to Cloudflare R2 (via /api/r2-upload)
 * - Shows thumbnail (images) or file-type badge (docs) + spinner
 * - Max 6 files, 50 MB per file
 * - Returns R2 URLs on send
 */

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { IClose, IEdit, IFile, IImage, IPaperclip } from './Icons'
import { useAppStore } from '../../store/useAppStore'

// ── allowed types ──────────────────────────────────────────────────────────────
const ALLOWED_MIME_PREFIXES = ['image/']
const ALLOWED_EXTENSIONS = /\.(png|jpe?g|gif|webp|bmp|svg|avif|heic|pdf|json|txt|md|mdx|csv|xml|yaml|yml|toml|log|sh|ts|tsx|js|jsx|css|html|htm|sql)$/i
const BLOCKED_EXTENSIONS  = /\.(exe|bat|cmd|sh|ps1|app|dmg|pkg|deb|rpm|bin|com|msi|run|jar|pyc|so|dll|dylib)$/i

// sh is somewhat dual — allow for reading (Claude uses it), block .exe etc.
// Override: if it's executable binary, block regardless of extension
const MAX_FILES = 6
const MAX_BYTES = 50 * 1024 * 1024 // 50 MB

export type PendingFile = {
  id: string
  file: File
  name: string
  mimeType: string
  isImage: boolean
  previewUrl?: string       // object URL for images
  status: 'uploading' | 'done' | 'error'
  progress: number          // 0-100
  url?: string              // R2 URL after upload
  error?: string
}

type Props = {
  files: PendingFile[]
  onChange: (files: PendingFile[]) => void
  userId?: string
  folder?: string
}

function fileId() { return Math.random().toString(36).slice(2) }

function extLabel(name: string) {
  const m = name.match(/\.([^.]+)$/)
  return (m?.[1] ?? 'file').toLowerCase().slice(0, 5)
}

function isAllowed(f: File): string | null {
  if (f.size > MAX_BYTES) return `${f.name}: Max 50 MB`
  if (BLOCKED_EXTENSIONS.test(f.name)) return `${f.name}: Dateityp nicht erlaubt`
  if (f.type.startsWith('image/') || ALLOWED_EXTENSIONS.test(f.name)) return null
  // generic binary content-types
  if (f.type === 'application/octet-stream') return `${f.name}: Dateityp nicht erlaubt`
  return null
}

async function uploadToR2(file: File, userId: string, folder: string, onProgress: (p: number) => void): Promise<string> {
  onProgress(10)
  const res = await fetch('/api/r2-upload', {
    method: 'POST',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      'X-File-Name': encodeURIComponent(file.name),
      'X-User-Id': userId,
      'X-Folder': folder,
    },
    body: file,
  })
  onProgress(90)
  const data = await res.json() as { ok: boolean; url?: string; error?: string }
  if (!data.ok) throw new Error(data.error ?? 'Upload fehlgeschlagen')
  onProgress(100)
  return data.url!
}

export function useFileAttachments(userId?: string, folder = 'image-text-context') {
  const [files, setFiles] = useState<PendingFile[]>([])

  const addFiles = useCallback((incoming: File[]) => {
    const filtered: File[] = []
    for (const f of incoming) {
      if (files.length + filtered.length >= MAX_FILES) break
      const err = isAllowed(f)
      if (err) { console.warn('[r2-upload] blocked:', err); continue }
      filtered.push(f)
    }
    if (!filtered.length) return

    const newEntries: PendingFile[] = filtered.map(file => ({
      id: fileId(),
      file,
      name: file.name,
      mimeType: file.type || 'application/octet-stream',
      isImage: file.type.startsWith('image/'),
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      status: 'uploading' as const,
      progress: 0,
    }))

    setFiles(prev => [...prev, ...newEntries])

    // Upload each file
    for (const entry of newEntries) {
      const uid = userId ?? 'anonymous'
      uploadToR2(entry.file, uid, folder, (p) => {
        setFiles(prev => prev.map(f => f.id === entry.id ? { ...f, progress: p } : f))
      }).then(url => {
        setFiles(prev => prev.map(f => f.id === entry.id ? { ...f, status: 'done', url, progress: 100 } : f))
      }).catch(err => {
        setFiles(prev => prev.map(f => f.id === entry.id ? { ...f, status: 'error', error: String(err) } : f))
      })
    }
  }, [files.length, userId, folder])

  const removeFile = useCallback((id: string) => {
    setFiles(prev => {
      const f = prev.find(x => x.id === id)
      if (f?.previewUrl) URL.revokeObjectURL(f.previewUrl)
      return prev.filter(x => x.id !== id)
    })
  }, [])

  const clearFiles = useCallback(() => {
    setFiles(prev => { prev.forEach(f => { if (f.previewUrl) URL.revokeObjectURL(f.previewUrl) }); return [] })
  }, [])

  /** Build message suffix with R2 URLs for CLI/API */
  const buildUrlSuffix = useCallback(() => {
    const done = files.filter(f => f.status === 'done' && f.url)
    if (!done.length) return ''
    const parts = done.map(f => {
      if (f.isImage) return `[Bild: ${f.name}](${f.url})`
      return `[Datei: ${f.name}](${f.url})`
    })
    return '\n\n' + parts.join('\n')
  }, [files])

  /** Replace an existing file with an annotated version — removes old entry, re-uploads new one */
  const replaceFile = useCallback((id: string, newFile: File) => {
    // Remove the original entry
    setFiles(prev => {
      const old = prev.find(x => x.id === id)
      if (old?.previewUrl) URL.revokeObjectURL(old.previewUrl)
      return prev.filter(x => x.id !== id)
    })
    // Insert the annotated file and upload it
    const uid   = userId ?? 'anonymous'
    const entry: PendingFile = {
      id: fileId(),
      file: newFile,
      name: newFile.name,
      mimeType: 'image/png',
      isImage: true,
      previewUrl: URL.createObjectURL(newFile),
      status: 'uploading',
      progress: 0,
    }
    setFiles(prev => [...prev, entry])
    uploadToR2(entry.file, uid, folder, p => {
      setFiles(prev => prev.map(f => f.id === entry.id ? { ...f, progress: p } : f))
    }).then(url => {
      setFiles(prev => prev.map(f => f.id === entry.id ? { ...f, status: 'done', url, progress: 100 } : f))
    }).catch(err => {
      setFiles(prev => prev.map(f => f.id === entry.id ? { ...f, status: 'error', error: String(err) } : f))
    })
  }, [userId, folder])

  const hasUploading = files.some(f => f.status === 'uploading')
  const hasDone      = files.some(f => f.status === 'done')

  return { files, addFiles, removeFile, replaceFile, clearFiles, buildUrlSuffix, hasUploading, hasDone }
}

// ── FileAttachmentBar (rendered inside textbox) ───────────────────────────────

export function FileAttachmentBar({ files, onRemove, onPreview, onAnnotate }: {
  files: PendingFile[]
  onRemove: (id: string) => void
  onPreview?: (src: string) => void
  onAnnotate?: (id: string) => void
}) {
  if (!files.length) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
      {files.map(f => (
        <FileChip
          key={f.id}
          file={f}
          onRemove={() => onRemove(f.id)}
          onPreview={f.isImage && onPreview ? () => onPreview(f.previewUrl ?? f.url ?? '') : undefined}
          onAnnotate={f.isImage && onAnnotate ? () => onAnnotate(f.id) : undefined}
        />
      ))}
    </div>
  )
}

function FileChip({ file, onRemove, onPreview, onAnnotate }: { file: PendingFile; onRemove: () => void; onPreview?: () => void; onAnnotate?: () => void }) {
  const uploading = file.status === 'uploading'
  const hasErr    = file.status === 'error'

  return (
    <div style={{
      position: 'relative', flexShrink: 0,
      width: file.isImage ? 52 : 'auto',
      height: file.isImage ? 52 : 'auto',
      minWidth: file.isImage ? 52 : 80,
    }}>
      {file.isImage ? (
        /* Image thumbnail — clickable to preview */
        <div
          onClick={!uploading && onPreview ? onPreview : undefined}
          style={{
            width: 52, height: 52, borderRadius: 6, overflow: 'hidden',
            border: `1px solid ${hasErr ? 'var(--err)' : 'var(--line-strong)'}`,
            position: 'relative', flexShrink: 0,
            cursor: !uploading && onPreview ? 'zoom-in' : 'default',
          }}
        >
          {file.previewUrl ? (
            <img src={file.previewUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: uploading ? 0.5 : 1 }} />
          ) : (
            <div style={{ width: '100%', height: '100%', background: 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IImage style={{ width: 20, height: 20, color: 'var(--fg-3)' }} />
            </div>
          )}
          {uploading && <UploadOverlay progress={file.progress} />}
          {hasErr && <div style={{ position: 'absolute', inset: 0, background: 'rgba(239,68,68,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>⚠</div>}
        </div>
      ) : (
        /* Document chip */
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5, padding: '4px 8px 4px 6px',
          background: hasErr ? 'rgba(239,68,68,0.08)' : 'var(--bg-3)',
          border: `1px solid ${hasErr ? 'var(--err)' : 'var(--line-strong)'}`,
          borderRadius: 6, height: 36, position: 'relative', overflow: 'hidden',
        }}>
          {uploading
            ? <Spinner />
            : <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-soft)', padding: '1px 4px', borderRadius: 3, fontFamily: 'var(--font-mono)', letterSpacing: 0.3 }}>.{extLabel(file.name)}</span>
          }
          <span style={{ fontSize: 10.5, color: 'var(--fg-1)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-ui)' }}>
            {file.name}
          </span>
          {uploading && (
            <div style={{ position: 'absolute', bottom: 0, left: 0, height: 2, background: 'var(--accent)', width: `${file.progress}%`, transition: 'width 0.2s', borderRadius: 1 }} />
          )}
        </div>
      )}

      {/* Remove button */}
      <button
        onClick={onRemove}
        style={{ position: 'absolute', top: -5, right: -5, width: 16, height: 16, borderRadius: '50%', background: 'var(--bg-2)', border: '1px solid var(--line-strong)', cursor: 'pointer', color: 'var(--fg-2)', fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, padding: 0, zIndex: 2 }}
      >
        <IClose style={{ width: 8, height: 8 }} />
      </button>
      {/* Annotate button — only for done images */}
      {file.isImage && !uploading && onAnnotate && (
        <button
          onClick={e => { e.stopPropagation(); onAnnotate() }}
          title="Bild bearbeiten"
          style={{ position: 'absolute', bottom: -7, right: -7, width: 22, height: 22, borderRadius: '50%', background: 'var(--accent)', border: '2px solid var(--bg-0)', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, zIndex: 2, boxShadow: '0 2px 6px rgba(0,0,0,0.35)' }}
        >
          <IEdit style={{ width: 11, height: 11 }} />
        </button>
      )}
    </div>
  )
}

function UploadOverlay({ progress }: { progress: number }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 4 }}>
      <Spinner color="#fff" />
      <div style={{ fontSize: 9, color: '#fff', fontWeight: 600 }}>{progress}%</div>
    </div>
  )
}

function Spinner({ color = 'var(--accent)' }: { color?: string }) {
  return (
    <div style={{
      width: 14, height: 14, borderRadius: '50%',
      border: `2px solid ${color}33`,
      borderTopColor: color,
      animation: 'cc-spin 0.7s linear infinite',
      flexShrink: 0,
    }} />
  )
}

// ── useDragDrop — attach to document, call addFiles on drop ───────────────────

export function useDragDrop(addFiles: (files: File[]) => void, maxFiles: number, currentCount: number) {
  const [isDragOver, setIsDragOver] = useState(false)

  useEffect(() => {
    let counter = 0
    const onEnter = (e: DragEvent) => {
      if (Array.from(e.dataTransfer?.types ?? []).includes('Files')) { counter++; setIsDragOver(true) }
    }
    const onLeave = () => { counter--; if (counter <= 0) { counter = 0; setIsDragOver(false) } }
    const onOver  = (e: DragEvent) => e.preventDefault()
    const onDrop  = (e: DragEvent) => {
      e.preventDefault(); counter = 0; setIsDragOver(false)
      if (currentCount >= maxFiles) return
      const files = Array.from(e.dataTransfer?.files ?? [])
      addFiles(files)
    }
    document.addEventListener('dragenter', onEnter)
    document.addEventListener('dragleave', onLeave)
    document.addEventListener('dragover', onOver)
    document.addEventListener('drop', onDrop)
    return () => {
      document.removeEventListener('dragenter', onEnter)
      document.removeEventListener('dragleave', onLeave)
      document.removeEventListener('dragover', onOver)
      document.removeEventListener('drop', onDrop)
    }
  }, [addFiles, maxFiles, currentCount])

  return isDragOver
}

// ── usePasteFiles — paste images from clipboard ───────────────────────────────
export function usePasteFiles(addFiles: (files: File[]) => void) {
  useEffect(() => {
    const h = (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items ?? [])
      const files = items.flatMap(item => item.kind === 'file' ? [item.getAsFile()!] : []).filter(Boolean)
      if (files.length) { e.preventDefault(); addFiles(files) }
    }
    document.addEventListener('paste', h)
    return () => document.removeEventListener('paste', h)
  }, [addFiles])
}

// ── DragOverlay ───────────────────────────────────────────────────────────────
export function DragOverlay({ visible, maxReached }: { visible: boolean; maxReached: boolean }) {
  if (!visible) return null
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9998, pointerEvents: 'none',
      border: '2px dashed var(--accent)', borderRadius: 6,
      background: 'rgba(0,0,0,0.55)',
      backdropFilter: 'blur(6px)',
      WebkitBackdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        padding: '22px 40px', textAlign: 'center',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      }}>
        <IPaperclip size={32} style={{ color: 'var(--accent)' }} />
        <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
          {maxReached ? 'Max. 6 Dateien erreicht' : 'Dateien ablegen'}
        </div>
        {!maxReached && (
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
            Bilder, JSON, TXT, MD, PDF, CSV …
          </div>
        )}
      </div>
    </div>
  )
}
