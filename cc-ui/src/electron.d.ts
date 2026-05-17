// Global type declarations for Electron preload bridge (contextBridge.exposeInMainWorld)

interface Window {
  electronAPI?: {
    platform: string
    version: string
    invalidateWebview: (id: number) => void
    writeClipboard: (text: string) => Promise<void>
    /** Encrypt a plaintext credential string via Electron safeStorage. Returns base64. */
    encryptCredential: (plaintext: string) => Promise<string>
    /** Decrypt a base64 ciphertext credential string via Electron safeStorage. */
    decryptCredential: (ciphertext: string) => Promise<string>
  }
}
