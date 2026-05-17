import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  version:  process.versions.electron,
  invalidateWebview: (id: number) => ipcRenderer.send('webview-invalidate', id),
  writeClipboard: (text: string) => ipcRenderer.invoke('clipboard:write', text),

  // Credential encryption — backed by Electron safeStorage (OS keychain / DPAPI)
  // Returns base64-encoded ciphertext on success; plaintext if safeStorage unavailable.
  encryptCredential: (plaintext: string): Promise<string> =>
    ipcRenderer.invoke('credential:encrypt', plaintext),
  // Returns decrypted plaintext; empty string if decryption fails.
  decryptCredential: (ciphertext: string): Promise<string> =>
    ipcRenderer.invoke('credential:decrypt', ciphertext),
})
