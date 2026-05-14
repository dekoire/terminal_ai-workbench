/**
 * Express backend — port 2003
 * Vite dev server (port 2002) proxies /api/* and /ws/* here.
 */
import http    from 'http'
import { exec } from 'child_process'
import express from 'express'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import apiRouter           from './routes/api.js'
import { attachWsUpgrade } from './routes/ws.js'

// Load app-level .env (bundled with the app, never per-user)
try {
  const envPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../.env')
  const lines = readFileSync(envPath, 'utf8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim()
    if (key && val && !process.env[key]) process.env[key] = val
  }
} catch { /* .env optional — ignore if missing */ }

const app  = express()
const PORT = 2003

// Mount all REST routes
app.use(apiRouter)

// 404 fallback — prevents Express from sending an HTML error page
app.use((_req, res) => { res.status(404).json({ ok: false, error: 'Not found' }) })

// Create HTTP server so we can share it with WebSocket upgrade handler
const server = http.createServer(app)
attachWsUpgrade(server)

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    // Kill whatever is on the port and retry once
    console.warn(`[backend] port ${PORT} in use — killing old process and retrying…`)
    exec(`lsof -ti tcp:${PORT} | xargs kill -9 2>/dev/null; true`, () => {
      setTimeout(() => server.listen(PORT, onListening), 500)
    })
  } else {
    console.error('[backend] server error:', err)
    process.exit(1)
  }
})

function onListening() {
  console.log(`[backend] ✓ listening on http://localhost:${PORT}`)
}

server.listen(PORT, onListening)
