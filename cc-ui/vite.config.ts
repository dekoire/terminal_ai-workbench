import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { exec } from 'child_process'
import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'
import { WebSocketServer } from 'ws'
import type { WebSocket } from 'ws'
import type { ViteDevServer } from 'vite'
import type { Connect } from 'vite'

const require = createRequire(import.meta.url)

// ── open file + browse ────────────────────────────────────────────────────────

function apiPlugin() {
  return {
    name: 'cc-api',
    configureServer(server: ViteDevServer) {

      // Open file in OS
      server.middlewares.use('/api/open', ((req, res) => {
        const url = new URL(req.url ?? '/', 'http://localhost')
        const filePath = url.searchParams.get('path') ?? ''
        if (!filePath) { res.statusCode = 400; res.end('missing path'); return }
        const resolved = filePath.replace(/^~/, process.env.HOME ?? '')
        exec(`open "${resolved}"`, (err) => {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: !err, error: err?.message }))
        })
      }) as Connect.NextHandleFunction)

      // Git write ops (POST)
      server.middlewares.use('/api/git-action', ((req, res) => {
        res.setHeader('Content-Type', 'application/json')
        let body = ''
        req.on('data', (d: Buffer) => { body += d.toString() })
        req.on('end', () => {
          try {
            const { action, path: cwd, message, remote, branch } =
              JSON.parse(body) as { action: string; path: string; message?: string; remote?: string; branch?: string }
            const resolved = cwd.replace(/^~/, process.env.HOME ?? '/')
            const run = (cmd: string) => new Promise<string>((ok) =>
              exec(cmd, { cwd: resolved }, (err, out, errOut) => ok(err ? errOut || err.message : out.trim()))
            )
            const go = async () => {
              if (action === 'stage')  return { ok: true, out: await run('git add -A') }
              if (action === 'commit') return { ok: true, out: await run(`git commit -m ${JSON.stringify(message ?? 'Update')}`) }
              if (action === 'push')   return { ok: true, out: await run(`git push ${remote ?? 'origin'} ${branch ?? 'HEAD'}`) }
              if (action === 'pull')   return { ok: true, out: await run(`git pull`) }
              if (action === 'checkout') return { ok: true, out: await run(`git checkout ${JSON.stringify(branch ?? '')}`) }
              if (action === 'new-branch') return { ok: true, out: await run(`git checkout -b ${JSON.stringify(branch ?? '')}`) }
              return { ok: false, out: 'unknown action' }
            }
            go().then(r => res.end(JSON.stringify(r))).catch(e => res.end(JSON.stringify({ ok: false, out: String(e) })))
          } catch (e) {
            res.end(JSON.stringify({ ok: false, out: String(e) }))
          }
        })
      }) as Connect.NextHandleFunction)

      // Git info
      server.middlewares.use('/api/git', ((req, res) => {
        const url = new URL(req.url ?? '/', 'http://localhost')
        const cwd  = (url.searchParams.get('path') ?? process.env.HOME ?? '/').replace(/^~/, process.env.HOME ?? '/')
        res.setHeader('Content-Type', 'application/json')

        const run = (cmd: string) => new Promise<string>((resolve) => {
          exec(cmd, { cwd }, (_, out, err) => resolve((out || err || '').trim()))
        })

        Promise.all([
          run('git status --short'),
          run('git log --oneline -20 --pretty=format:"%h|%s|%an|%ar|%ai"'),
          run('git branch -v --format="%(refname:short)|%(objectname:short)|%(subject)|%(HEAD)"'),
          run('git diff --stat HEAD 2>/dev/null | tail -1'),
          run('git remote -v | head -2'),
          run('git log -1 --format="%ar"'),
        ]).then(([status, log, branches, diffStat, remotes, lastCommit]) => {
          const statusLines = status.split('\n').filter(Boolean).map(l => ({ flag: l.slice(0,2).trim(), file: l.slice(3) }))
          const logLines = log.split('\n').filter(Boolean).map(l => { const p = l.split('|'); return { hash: p[0], msg: p[1], author: p[2], when: p[3], date: p[4] } })
          const branchLines = branches.split('\n').filter(Boolean).map(l => { const p = l.split('|'); return { name: p[0], hash: p[1], msg: p[2], current: p[3] === '*' } })
          const remoteList = [...new Set(remotes.split('\n').filter(Boolean).map(l => l.split('\t')[0]))]
          res.end(JSON.stringify({ status: statusLines, log: logLines, branches: branchLines, diffStat, remotes: remoteList, lastCommit }))
        }).catch(e => res.end(JSON.stringify({ error: String(e), status: [], log: [], branches: [] })))
      }) as Connect.NextHandleFunction)

      // Native folder picker via osascript (macOS)
      server.middlewares.use('/api/pick-folder', ((req, res) => {
        res.setHeader('Content-Type', 'application/json')
        const url = new URL(req.url ?? '/', 'http://localhost')
        const startPath = (url.searchParams.get('path') ?? process.env.HOME ?? '~')
          .replace(/^~/, process.env.HOME ?? '/')
        // Use choose folder directly (no Finder.app activation = much faster)
        const safeStart = startPath.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
        // Wrap in POSIX path of (...) so we get a Unix path back directly
        const script = `POSIX path of (choose folder with prompt "Projektordner wählen:" default location POSIX file "${safeStart}")`
        exec(`osascript -e '${script.replace(/'/g, "'\\''")}'`, { timeout: 60000 }, (err, out) => {
          if (err) {
            res.end(JSON.stringify({ ok: false, path: null, error: err.message }))
          } else {
            res.end(JSON.stringify({ ok: true, path: out.trim().replace(/\/$/, '') }))
          }
        })
      }) as Connect.NextHandleFunction)

      // Store read (GET ~/.cc-ui-data.json)
      server.middlewares.use('/api/store-read', ((req, res) => {
        res.setHeader('Content-Type', 'application/json')
        const filePath = path.join(process.env.HOME ?? '/', '.cc-ui-data.json')
        try {
          const data = fs.readFileSync(filePath, 'utf-8')
          res.end(data || 'null')
        } catch {
          res.end('null')
        }
      }) as Connect.NextHandleFunction)

      // Store write (POST → ~/.cc-ui-data.json)
      server.middlewares.use('/api/store-write', ((req, res) => {
        res.setHeader('Content-Type', 'application/json')
        const filePath = path.join(process.env.HOME ?? '/', '.cc-ui-data.json')
        let body = ''
        req.on('data', (d: Buffer) => { body += d.toString() })
        req.on('end', () => {
          try {
            if (body && body !== 'null') {
              fs.writeFileSync(filePath, body, 'utf-8')
            } else {
              try { fs.unlinkSync(filePath) } catch { /* no file — ignore */ }
            }
            res.end('{"ok":true}')
          } catch (e) {
            res.end(JSON.stringify({ ok: false, error: String(e) }))
          }
        })
      }) as Connect.NextHandleFunction)

      // Browse directory
      server.middlewares.use('/api/browse', ((req, res) => {
        const url = new URL(req.url ?? '/', 'http://localhost')
        const dirPath = (url.searchParams.get('path') ?? process.env.HOME ?? '/')
          .replace(/^~/, process.env.HOME ?? '/')

        res.setHeader('Content-Type', 'application/json')
        try {
          const entries = fs.readdirSync(dirPath, { withFileTypes: true })
          const items = entries
            .filter(e => !e.name.startsWith('.') || e.name === '..')
            .map(e => ({
              name: e.name,
              path: path.join(dirPath, e.name),
              isDir: e.isDirectory(),
            }))
            .sort((a, b) => {
              if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
              return a.name.localeCompare(b.name)
            })
          // Add parent entry
          const parentPath = path.dirname(dirPath)
          const withParent = dirPath !== '/'
            ? [{ name: '..', path: parentPath, isDir: true }, ...items]
            : items
          res.end(JSON.stringify({ items: withParent, currentPath: dirPath }))
        } catch (e: unknown) {
          res.end(JSON.stringify({ items: [], currentPath: dirPath, error: String(e) }))
        }
      }) as Connect.NextHandleFunction)
    },
  }
}

// ── terminal via node-pty ─────────────────────────────────────────────────────

interface PtySession {
  pty: import('node-pty').IPty
  clients: Set<WebSocket>
}

const sessions = new Map<string, PtySession>()
let wss: WebSocketServer | null = null

function terminalPlugin() {
  return {
    name: 'cc-terminal',
    configureServer(server: ViteDevServer) {
      if (!wss) {
        const pty = require('node-pty') as typeof import('node-pty')
        wss = new WebSocketServer({ noServer: true })

        wss.on('connection', (ws: WebSocket, req: { url?: string }) => {
          const url = new URL(req.url ?? '/', 'http://localhost')
          const sessionId = url.searchParams.get('sessionId') ?? 'default'

          // Reuse existing PTY session
          const existing = sessions.get(sessionId)
          if (existing) {
            existing.clients.add(ws)
            ws.on('message', (raw) => {
              try {
                const msg = JSON.parse(raw.toString()) as Record<string, unknown>
                if (msg.type === 'input') existing.pty.write(String(msg.data))
                if (msg.type === 'resize') existing.pty.resize(Number(msg.cols) || 80, Number(msg.rows) || 24)
              } catch {}
            })
            ws.on('close', () => existing.clients.delete(ws))
            return
          }

          // Wait for init message to create PTY
          ws.once('message', (raw) => {
            try {
              const msg = JSON.parse(raw.toString()) as Record<string, unknown>
              if (msg.type !== 'init') return

              const cmd   = String(msg.cmd ?? 'zsh')
              const args  = String(msg.args ?? '').trim()
              const cwd   = String(msg.cwd ?? process.env.HOME ?? '~').replace(/^~/, process.env.HOME ?? '/')
              const cols  = Number(msg.cols) || 120
              const rows  = Number(msg.rows) || 36

              // Always use the absolute path so posix_spawnp never fails due to
              // a minimal PATH in the Vite process environment.
              const ZSH = '/bin/zsh'

              // Ensure a useful PATH even when Vite is launched with a bare env
              const safePath = [
                '/opt/homebrew/bin', '/opt/homebrew/sbin',
                '/usr/local/bin', '/usr/bin', '/bin',
                '/usr/sbin', '/sbin',
                `${process.env.HOME ?? '/Users'}/.nvm/versions/node/current/bin`,
                process.env.PATH ?? '',
              ].filter(Boolean).join(':')

              let spawnCmd: string
              let spawnArgs: string[]
              if (cmd === 'zsh' && !args) {
                // Plain interactive login shell
                spawnCmd = ZSH
                spawnArgs = ['-l']
              } else {
                // Alias command (claude, aider, codex, …) — run via login shell
                const fullCmd = args ? `${cmd} ${args}` : cmd
                spawnCmd = ZSH
                spawnArgs = ['-lc', fullCmd]
              }

              const ptyEnv: Record<string, string> = {
                ...(process.env as Record<string, string>),
                PATH: safePath,
                TERM: 'xterm-256color',
                COLORTERM: 'truecolor',
                HOME: process.env.HOME ?? '/Users/' + (process.env.USER ?? 'user'),
                LANG: process.env.LANG ?? 'en_US.UTF-8',
              }

              const ptyProc = pty.spawn(spawnCmd, spawnArgs, {
                name: 'xterm-256color',
                cols,
                rows,
                cwd,
                env: ptyEnv,
              })

              const session: PtySession = { pty: ptyProc, clients: new Set([ws]) }
              sessions.set(sessionId, session)

              const broadcast = (data: string) => {
                const payload = JSON.stringify({ type: 'data', data })
                for (const c of session.clients) {
                  if (c.readyState === 1) c.send(payload)
                }
              }

              ptyProc.onData(broadcast)
              ptyProc.onExit(({ exitCode }) => {
                const payload = JSON.stringify({ type: 'exit', exitCode })
                for (const c of session.clients) {
                  if (c.readyState === 1) c.send(payload)
                }
                sessions.delete(sessionId)
              })

              // Handle subsequent messages
              ws.on('message', (raw2) => {
                try {
                  const m = JSON.parse(raw2.toString()) as Record<string, unknown>
                  if (m.type === 'input') ptyProc.write(String(m.data))
                  if (m.type === 'resize') ptyProc.resize(Number(m.cols) || 80, Number(m.rows) || 24)
                } catch {}
              })

              ws.on('close', () => {
                session.clients.delete(ws)
                if (session.clients.size === 0) {
                  try { ptyProc.kill() } catch {}
                  sessions.delete(sessionId)
                }
              })
            } catch (e) {
              console.error('[pty] init error', e)
            }
          })
        })
      }

      server.httpServer?.on('upgrade', (req, socket, head) => {
        if (req.url?.startsWith('/ws/terminal')) {
          wss!.handleUpgrade(req, socket as import('net').Socket, head, (ws) => {
            wss!.emit('connection', ws, req)
          })
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), apiPlugin(), terminalPlugin()],
  server: { port: 5174 },
})
