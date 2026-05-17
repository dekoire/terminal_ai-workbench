/**
 * Clipboard write that works in Electron (contextIsolation) and browser.
 * navigator.clipboard.writeText silently fails under contextIsolation:true,
 * so we go through the IPC bridge when available.
 */
export function writeClipboard(text: string): Promise<void> {
  if (window.electronAPI?.writeClipboard) {
    return window.electronAPI.writeClipboard(text)
  }
  return navigator.clipboard.writeText(text)
}
