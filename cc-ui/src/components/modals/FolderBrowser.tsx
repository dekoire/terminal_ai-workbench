import React, { useState, useEffect } from 'react'
import { IFolder, IChev, IClose } from '../primitives/Icons'

interface BrowserItem {
  name: string
  path: string
  isDir: boolean
}

interface Props {
  currentPath: string
  onSelect: (path: string) => void
  onClose: () => void
}

export function FolderBrowser({ currentPath, onSelect, onClose }: Props) {
  const initialPath = currentPath.replace(/^~/, window.location.hostname === 'localhost' ? '' : '~')
    || (navigator.platform.includes('Mac') ? '/Users' : '/home')

  const [path, setPath]   = useState(initialPath || '/')
  const [items, setItems] = useState<BrowserItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = (p: string) => {
    setLoading(true)
    setError('')
    fetch(`/api/browse?path=${encodeURIComponent(p)}`)
      .then(r => r.json())
      .then(data => {
        setItems(data.items || [])
        setPath(data.currentPath || p)
        setLoading(false)
      })
      .catch(e => {
        setError(String(e))
        setLoading(false)
      })
  }

  useEffect(() => { load(path) }, [])

  const navigate = (item: BrowserItem) => {
    if (item.isDir) load(item.path)
  }

  const labelStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px',
    cursor: 'pointer', borderBottom: '1px solid var(--line)',
    color: 'var(--fg-0)', fontSize: 11.5, fontFamily: 'var(--font-mono)',
    userSelect: 'none',
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(8,7,5,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 520, maxHeight: '70vh', background: 'var(--bg-1)', border: '1px solid var(--line-strong)', borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>

        {/* Header */}
        <div style={{ height: 40, padding: '0 14px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--line)', background: 'var(--bg-0)', flexShrink: 0 }}>
          <IFolder style={{ color: 'var(--accent)' }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)' }}>Select folder</span>
          <span style={{ flex: 1 }} />
          <IClose onClick={onClose} style={{ color: 'var(--fg-2)', cursor: 'pointer' }} />
        </div>

        {/* Current path bar */}
        <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--line)', background: 'var(--bg-2)', flexShrink: 0 }}>
          <input
            type="text"
            value={path}
            onChange={e => setPath(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load(path)}
            style={{ width: '100%', padding: '5px 8px', border: '1px solid var(--line)', borderRadius: 4, background: 'var(--bg-1)', color: 'var(--fg-0)', fontSize: 11, fontFamily: 'var(--font-mono)', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        {/* File list */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {loading && (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--fg-3)', fontSize: 12 }}>Loading…</div>
          )}
          {error && (
            <div style={{ padding: 12, color: 'var(--err)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>{error}</div>
          )}
          {!loading && items.map(item => (
            <div
              key={item.path}
              onClick={() => navigate(item)}
              style={{
                ...labelStyle,
                opacity: item.isDir ? 1 : 0.4,
                cursor: item.isDir ? 'pointer' : 'default',
                background: item.name === '..' ? 'var(--bg-2)' : 'transparent',
              }}
            >
              {item.name === '..' ? (
                <IChev style={{ transform: 'rotate(-90deg)', color: 'var(--fg-3)' }} />
              ) : (
                <IFolder style={{ color: item.isDir ? 'var(--fg-2)' : 'var(--fg-3)', flexShrink: 0 }} />
              )}
              <span>{item.name === '..' ? 'Go up (..)' : item.name}</span>
              {item.isDir && item.name !== '..' && <IChev style={{ marginLeft: 'auto', color: 'var(--fg-3)' }} />}
            </div>
          ))}
          {!loading && items.filter(i => i.isDir).length === 0 && !error && (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--fg-3)', fontSize: 11 }}>No subfolders</div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 12px', borderTop: '1px solid var(--line)', display: 'flex', gap: 8, background: 'var(--bg-0)', flexShrink: 0 }}>
          <span style={{ flex: 1, fontSize: 10.5, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', alignSelf: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{path}</span>
          <button onClick={onClose} style={{ padding: '5px 12px', border: '1px solid var(--line-strong)', borderRadius: 4, background: 'transparent', color: 'var(--fg-1)', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-ui)' }}>Cancel</button>
          <button onClick={() => onSelect(path)} style={{ padding: '5px 12px', border: 'none', borderRadius: 4, background: 'var(--accent)', color: '#1a1410', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)' }}>Select this folder</button>
        </div>
      </div>
    </div>
  )
}
