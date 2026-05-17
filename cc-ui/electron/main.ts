import { app, BrowserWindow, shell, nativeTheme, session, ipcMain, webContents, clipboard, safeStorage } from 'electron'

// Fix for Electron webview black screen on macOS — must be called before app.whenReady()
app.commandLine.appendSwitch('in-process-gpu')
import { createServer }  from 'http'
import { exec }          from 'child_process'
import path              from 'path'
import express           from 'express'
import apiRouter         from '../server/routes/api.js'
import { attachWsUpgrade } from '../server/routes/ws.js'
const isDev = !app.isPackaged

// Let server code find permission-mcp.cjs and other root-level files
process.env.APP_ROOT = app.getAppPath()

const BACKEND_PORT = 2003
const VITE_PORT    = 2002

// ── Backend (Express + WS) ────────────────────────────────────────────────────
function listenWithRetry(server: ReturnType<typeof createServer>, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const tryListen = () => {
      server.listen(port, resolve)
    }
    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        exec(`lsof -ti tcp:${port} | xargs kill -9 2>/dev/null; true`, () => {
          setTimeout(tryListen, 400)
        })
      } else {
        reject(err)
      }
    })
    tryListen()
  })
}

async function startBackend() {
  const expressApp = express()
  expressApp.use(apiRouter)

  // In production: serve the built Vite output
  if (!isDev) {
    const distPath = path.join(app.getAppPath(), 'dist')
    expressApp.use(express.static(distPath))
    expressApp.use((_req, res) =>
      res.sendFile(path.join(distPath, 'index.html')),
    )
  }

  const server = createServer(expressApp)
  attachWsUpgrade(server)

  await listenWithRetry(server, BACKEND_PORT)
  console.log(`[backend] ✓ http://localhost:${BACKEND_PORT}`)
}

// ── Window ────────────────────────────────────────────────────────────────────
function createWindow() {
  const win = new BrowserWindow({
    width:    1440,
    height:   900,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 14, y: 18 },
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#111111' : '#f5f5f5',
    webPreferences: {
      preload:          path.join(__dirname, 'preload.cjs'),
      nodeIntegration:  false,
      contextIsolation: true,
      webviewTag:       true,
    },
  })

  const url = isDev
    ? `http://localhost:${VITE_PORT}`
    : `http://localhost:${BACKEND_PORT}`

  win.loadURL(url)

  // Open external links in the system browser
  win.webContents.setWindowOpenHandler(({ url: u }) => {
    shell.openExternal(u)
    return { action: 'deny' }
  })

  return win
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  // In prod the renderer talks to our embedded Express; start it first.
  // In dev the external `tsx watch server/index.ts` already handles this.
  if (!isDev) {
    try {
      await startBackend()
    } catch (err) {
      console.error('[backend] failed to start:', err)
    }
  }

  // Grant microphone access so MediaRecorder works without crashing the renderer
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    const allowed = ['media', 'audioCapture', 'microphone'].includes(permission)
    callback(allowed)
  })
  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    return ['media', 'audioCapture', 'microphone'].includes(permission)
  })

  // IPC: clipboard write (navigator.clipboard fails under contextIsolation)
  ipcMain.handle('clipboard:write', (_e, text: string) => {
    clipboard.writeText(text)
  })

  // IPC: credential encryption via Electron safeStorage
  // macOS → Keychain, Windows → DPAPI, Linux → libsecret / kwallet
  ipcMain.handle('credential:encrypt', (_e, plaintext: string): string => {
    if (!safeStorage.isEncryptionAvailable()) {
      // safeStorage not available (e.g. headless CI) — return plaintext unchanged
      // The renderer marks it as __enc__: false so it can detect this on read.
      return plaintext
    }
    return safeStorage.encryptString(plaintext).toString('base64')
  })

  ipcMain.handle('credential:decrypt', (_e, ciphertext: string): string => {
    if (!safeStorage.isEncryptionAvailable()) return ciphertext
    try {
      return safeStorage.decryptString(Buffer.from(ciphertext, 'base64'))
    } catch {
      // Decryption failed — could be a plaintext value from an old store.
      // Return empty string; user will need to re-enter the credential.
      console.warn('[main] credential:decrypt failed for value, returning empty')
      return ''
    }
  })

  // IPC: force-repaint a webview by its webContentsId
  ipcMain.on('webview-invalidate', (_event, id: number) => {
    try {
      const wc = webContents.fromId(id)
      if (wc && !wc.isDestroyed()) wc.invalidate()
    } catch {}
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
