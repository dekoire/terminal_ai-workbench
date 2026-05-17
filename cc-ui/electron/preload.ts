import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  version:  process.versions.electron,
  invalidateWebview: (id: number) => ipcRenderer.send('webview-invalidate', id),
  writeClipboard: (text: string) => ipcRenderer.invoke('clipboard:write', text),
})
