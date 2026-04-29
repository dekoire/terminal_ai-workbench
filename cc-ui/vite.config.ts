import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { exec, spawn } from 'child_process'
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

        // First check if this is actually a git repo
        run('git rev-parse --is-inside-work-tree').then(async (check) => {
          if (check !== 'true') {
            res.end(JSON.stringify({ hasGit: false, status: [], log: [], branches: [], remotes: [], diffStat: '', lastCommit: '' }))
            return
          }
          const [status, log, branches, diffStat, remotes, lastCommit] = await Promise.all([
            run('git status --short'),
            run('git log --oneline -20 --pretty=format:"%h|%s|%an|%ar|%ai"'),
            run('git branch -v --format="%(refname:short)|%(objectname:short)|%(subject)|%(HEAD)"'),
            run('git diff --stat HEAD 2>/dev/null | tail -1'),
            run('git remote -v | head -2'),
            run('git log -1 --format="%ar"'),
          ])
          const statusLines = status.split('\n').filter(Boolean).map(l => ({ flag: l.slice(0,2).trim(), file: l.slice(3) }))
          const logLines = log.split('\n').filter(Boolean).map(l => { const p = l.split('|'); return { hash: p[0], msg: p[1], author: p[2], when: p[3], date: p[4] } })
          const branchLines = branches.split('\n').filter(Boolean).map(l => { const p = l.split('|'); return { name: p[0], hash: p[1], msg: p[2], current: p[3] === '*' } })
          const remoteList = [...new Set(remotes.split('\n').filter(Boolean).map(l => l.split('\t')[0]))]
          res.end(JSON.stringify({ hasGit: true, status: statusLines, log: logLines, branches: branchLines, diffStat, remotes: remoteList, lastCommit }))
        }).catch(e => res.end(JSON.stringify({ hasGit: false, error: String(e), status: [], log: [], branches: [], remotes: [], diffStat: '', lastCommit: '' })))
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

      // Native file picker via osascript (macOS)
      server.middlewares.use('/api/pick-file', ((req, res) => {
        res.setHeader('Content-Type', 'application/json')
        const url = new URL(req.url ?? '/', 'http://localhost')
        const startPath = (url.searchParams.get('path') ?? process.env.HOME ?? '~')
          .replace(/^~/, process.env.HOME ?? '/')
        const safeStart = startPath.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
        const script = `POSIX path of (choose file with prompt "Datei auswählen:" default location POSIX file "${safeStart}")`
        exec(`osascript -e '${script.replace(/'/g, "'\\''")}'`, { timeout: 60000 }, (err, out) => {
          if (err) {
            res.end(JSON.stringify({ ok: false, path: null, error: err.message }))
          } else {
            res.end(JSON.stringify({ ok: true, path: out.trim() }))
          }
        })
      }) as Connect.NextHandleFunction)

      // Check if a command exists (GET /api/which?cmd=claude)
      // Uses zsh -i so shell aliases from .zshrc are visible too
      server.middlewares.use('/api/which', ((req, res) => {
        res.setHeader('Content-Type', 'application/json')
        const url = new URL(req.url ?? '/', 'http://localhost')
        const cmd = url.searchParams.get('cmd') ?? ''
        if (!cmd) { res.end(JSON.stringify({ ok: false, path: null })); return }
        const safe = cmd.replace(/['"\\;|&$`]/g, '')   // sanitise
        // -i loads .zshrc so shell aliases like cc-mini are visible
        exec(`zsh -i -c "type -a '${safe}' 2>/dev/null"`, { timeout: 4000 }, (err, out) => {
          const text = out?.trim() ?? ''
          if (err || !text) {
            res.end(JSON.stringify({ ok: false, path: null }))
            return
          }
          // Extract binary path if available, otherwise use the type description
          const pathMatch = text.match(/is (\/[^\s]+)/)
          const display = pathMatch ? pathMatch[1] : text.split('\n')[0]
          res.end(JSON.stringify({ ok: true, path: display }))
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

      // File write (POST /api/file-write)
      server.middlewares.use('/api/file-write', ((req, res) => {
        res.setHeader('Content-Type', 'application/json')
        if (req.method !== 'POST') { res.statusCode = 405; res.end('{"ok":false}'); return }
        let body = ''
        req.on('data', (d: Buffer) => { body += d.toString() })
        req.on('end', () => {
          try {
            const { path: filePath, content } = JSON.parse(body) as { path: string; content: string }
            const resolved = (filePath ?? '').replace(/^~/, process.env.HOME ?? '/')
            fs.mkdirSync(path.dirname(resolved), { recursive: true })
            fs.writeFileSync(resolved, content, 'utf-8')
            res.end('{"ok":true}')
          } catch (e) {
            res.end(JSON.stringify({ ok: false, error: String(e) }))
          }
        })
      }) as Connect.NextHandleFunction)

      // Create file or directory (POST /api/fs-create)
      server.middlewares.use('/api/fs-create', ((req, res) => {
        res.setHeader('Content-Type', 'application/json')
        if (req.method !== 'POST') { res.statusCode = 405; res.end('{"ok":false}'); return }
        let body = ''
        req.on('data', (d: Buffer) => { body += d.toString() })
        req.on('end', () => {
          try {
            const { path: target, type } = JSON.parse(body) as { path: string; type: 'file' | 'dir' }
            const resolved = target.replace(/^~/, process.env.HOME ?? '/')
            if (type === 'dir') {
              fs.mkdirSync(resolved, { recursive: true })
            } else {
              // Ensure parent exists, then touch file
              fs.mkdirSync(path.dirname(resolved), { recursive: true })
              if (!fs.existsSync(resolved)) fs.writeFileSync(resolved, '', 'utf-8')
            }
            res.end('{"ok":true}')
          } catch (e) {
            res.end(JSON.stringify({ ok: false, error: String(e) }))
          }
        })
      }) as Connect.NextHandleFunction)

      // AI text refinement proxy (POST /api/ai-refine)
      server.middlewares.use('/api/ai-refine', ((req, res) => {
        res.setHeader('Content-Type', 'application/json')
        if (req.method !== 'POST') { res.statusCode = 405; res.end('{"ok":false}'); return }
        let body = ''
        req.on('data', (d: Buffer) => { body += d.toString() })
        req.on('end', async () => {
          try {
            const { provider, apiKey, model, text, systemPrompt } =
              JSON.parse(body) as { provider: string; apiKey: string; model: string; text: string; systemPrompt?: string }
            const sysMsg = systemPrompt ?? 'Verbessere den folgenden Text sprachlich und inhaltlich. Mache ihn klarer, präziser und professioneller. Gib nur den verbesserten Text zurück, ohne Erklärungen oder zusätzliche Kommentare.'
            console.log('\n[ai-refine] ▶ provider:', provider, '| model:', model)
            console.log('[ai-refine] systemPrompt:\n', sysMsg)
            console.log('[ai-refine] text (files sent):\n', text.slice(0, 800), text.length > 800 ? `\n...(${text.length} chars total)` : '')

            if (provider === 'anthropic') {
              const r = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
                body: JSON.stringify({ model, max_tokens: 2048, system: sysMsg, messages: [{ role: 'user', content: text }] }),
              })
              const d = await r.json() as { content?: { text: string }[]; error?: { message: string } }
              if (!r.ok) { res.end(JSON.stringify({ ok: false, error: d?.error?.message ?? 'API error' })); return }
              res.end(JSON.stringify({ ok: true, text: d.content?.[0]?.text ?? text }))
            } else {
              // OpenAI-compatible (openai + deepseek)
              const baseUrl = provider === 'deepseek' ? 'https://api.deepseek.com/v1' : 'https://api.openai.com/v1'
              const r = await fetch(`${baseUrl}/chat/completions`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ model, messages: [{ role: 'system', content: sysMsg }, { role: 'user', content: text }] }),
              })
              const d = await r.json() as { choices?: { message: { content: string } }[]; error?: { message: string } }
              if (!r.ok) { console.log('[ai-refine] ✗ error:', d?.error?.message); res.end(JSON.stringify({ ok: false, error: d?.error?.message ?? 'API error' })); return }
              const result = d.choices?.[0]?.message?.content ?? text
              console.log('[ai-refine] ✓ response:\n', result)
              res.end(JSON.stringify({ ok: true, text: result }))
            }
          } catch (e) {
            res.end(JSON.stringify({ ok: false, error: String(e) }))
          }
        })
      }) as Connect.NextHandleFunction)

      // Check if a port is in use (GET /api/check-port?port=N)
      server.middlewares.use('/api/check-port', ((req, res) => {
        const url = new URL(req.url ?? '/', 'http://localhost')
        const port = parseInt(url.searchParams.get('port') ?? '0', 10)
        res.setHeader('Content-Type', 'application/json')
        if (!port) { res.end(JSON.stringify({ ok: false, inUse: false })); return }
        exec(`lsof -ti tcp:${port}`, (err, stdout) => {
          if (err || !stdout.trim()) {
            res.end(JSON.stringify({ ok: true, inUse: false }))
          } else {
            const pids = stdout.trim().split('\n').map(p => parseInt(p, 10)).filter(Boolean)
            res.end(JSON.stringify({ ok: true, inUse: true, pids }))
          }
        })
      }) as Connect.NextHandleFunction)

      // Kill process on a port (POST /api/kill-port)
      server.middlewares.use('/api/kill-port', ((req, res) => {
        res.setHeader('Content-Type', 'application/json')
        if (req.method !== 'POST') { res.statusCode = 405; res.end('{"ok":false}'); return }
        let body = ''
        req.on('data', (d: Buffer) => { body += d.toString() })
        req.on('end', () => {
          try {
            const { port } = JSON.parse(body) as { port: number }
            exec(`lsof -ti tcp:${port} | xargs kill -9 2>/dev/null; true`, () => {
              res.end('{"ok":true}')
            })
          } catch (e) {
            res.end(JSON.stringify({ ok: false, error: String(e) }))
          }
        })
      }) as Connect.NextHandleFunction)

      // Start app in background (POST /api/start-app)
      server.middlewares.use('/api/start-app', ((req, res) => {
        res.setHeader('Content-Type', 'application/json')
        if (req.method !== 'POST') { res.statusCode = 405; res.end('{"ok":false}'); return }
        let body = ''
        req.on('data', (d: Buffer) => { body += d.toString() })
        req.on('end', () => {
          try {
            const { projectPath, port, startCmd } = JSON.parse(body) as { projectPath: string; port?: number; startCmd: string }
            const logFile = `/tmp/cc-app-${port ?? 'unknown'}.log`

            // Step 1: kill port if given
            const killCmd = port ? `lsof -ti tcp:${port} | xargs kill -9 2>/dev/null; true` : 'true'
            exec(killCmd, () => {
              // Step 2: spawn app detached from terminal
              const child = spawn('bash', ['-c', `cd ${JSON.stringify(projectPath)} && ${startCmd}`], {
                detached: true,
                stdio: ['ignore', fs.openSync(logFile, 'a'), fs.openSync(logFile, 'a')],
              })
              child.unref()
              const pid = child.pid ?? 0
              console.log(`[start-app] started PID ${pid} | ${startCmd} | log → ${logFile}`)

              // Step 3: open browser after 2s
              if (port) {
                setTimeout(() => {
                  exec(`open http://localhost:${port}`)
                }, 2000)
              }

              res.end(JSON.stringify({ ok: true, pid, logFile }))
            })
          } catch (e) {
            res.end(JSON.stringify({ ok: false, error: String(e) }))
          }
        })
      }) as Connect.NextHandleFunction)

      // Delete file or directory (POST /api/fs-delete)
      server.middlewares.use('/api/fs-delete', ((req, res) => {
        res.setHeader('Content-Type', 'application/json')
        if (req.method !== 'POST') { res.statusCode = 405; res.end('{"ok":false}'); return }
        let body = ''
        req.on('data', (d: Buffer) => { body += d.toString() })
        req.on('end', () => {
          try {
            const { path: target } = JSON.parse(body) as { path: string }
            const resolved = target.replace(/^~/, process.env.HOME ?? '/')
            fs.rmSync(resolved, { recursive: true, force: true })
            res.end('{"ok":true}')
          } catch (e) {
            res.end(JSON.stringify({ ok: false, error: String(e) }))
          }
        })
      }) as Connect.NextHandleFunction)

      // Read all .md files from docs/ directory (GET /api/read-docs?path=…)
      server.middlewares.use('/api/read-docs', ((req, res) => {
        const url = new URL(req.url ?? '/', 'http://localhost')
        const projectPath = (url.searchParams.get('path') ?? '').replace(/^~/, process.env.HOME ?? '/')
        res.setHeader('Content-Type', 'application/json')

        if (!projectPath) { res.end(JSON.stringify({ ok: false, error: 'missing path', files: [] })); return }

        const docsDir = path.join(projectPath, 'docs')
        const MAX_TOTAL = 80_000 // ~80 KB total to stay within AI context

        const readMdRecursive = (dir: string, collected: { filename: string; content: string }[], totalRef: { n: number }) => {
          let entries: fs.Dirent[]
          try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
          for (const e of entries) {
            if (totalRef.n >= MAX_TOTAL) break
            const full = path.join(dir, e.name)
            if (e.isDirectory()) {
              readMdRecursive(full, collected, totalRef)
            } else if (e.isFile() && /\.(md|txt)$/i.test(e.name)) {
              try {
                const content = fs.readFileSync(full, 'utf-8').slice(0, 20_000)
                const relative = full.replace(projectPath + '/', '')
                collected.push({ filename: relative, content })
                totalRef.n += content.length
              } catch { /* skip unreadable files */ }
            }
          }
        }

        const files: { filename: string; content: string }[] = []
        const totalRef = { n: 0 }
        readMdRecursive(docsDir, files, totalRef)

        if (files.length === 0) {
          res.end(JSON.stringify({ ok: false, error: 'Keine Dokumentationsdateien unter docs/ gefunden', files: [] }))
        } else {
          res.end(JSON.stringify({ ok: true, files }))
        }
      }) as Connect.NextHandleFunction)

      // Git remote URL (GET /api/git-remote?path=…)
      server.middlewares.use('/api/git-remote', ((req, res) => {
        const url = new URL(req.url ?? '/', 'http://localhost')
        const cwd = (url.searchParams.get('path') ?? '').replace(/^~/, process.env.HOME ?? '/')
        res.setHeader('Content-Type', 'application/json')
        exec('git remote get-url origin', { cwd }, (err, out) => {
          if (err) { res.end(JSON.stringify({ ok: false, url: null })); return }
          res.end(JSON.stringify({ ok: true, url: out.trim() }))
        })
      }) as Connect.NextHandleFunction)

      // Open with specific app (GET /api/open-with?path=…&app=…)
      server.middlewares.use('/api/open-with', ((req, res) => {
        const url = new URL(req.url ?? '/', 'http://localhost')
        const filePath = (url.searchParams.get('path') ?? '').replace(/^~/, process.env.HOME ?? '/')
        const app = url.searchParams.get('app') ?? ''
        res.setHeader('Content-Type', 'application/json')
        if (!app) { res.end('{"ok":false}'); return }
        exec(`open -a ${JSON.stringify(app)} ${JSON.stringify(filePath)}`, (err) => {
          res.end(JSON.stringify({ ok: !err, error: err?.message }))
        })
      }) as Connect.NextHandleFunction)

      // File read (GET /api/file-read?path=…) — returns plain text content
      server.middlewares.use('/api/file-read', ((req, res) => {
        const url = new URL(req.url ?? '/', 'http://localhost')
        const filePath = (url.searchParams.get('path') ?? '')
          .replace(/^~/, process.env.HOME ?? '/')
        res.setHeader('Content-Type', 'application/json')
        try {
          const stat = fs.statSync(filePath)
          if (stat.size > 2 * 1024 * 1024) {
            res.end(JSON.stringify({ ok: false, error: 'File too large (> 2 MB)' }))
            return
          }
          const content = fs.readFileSync(filePath, 'utf-8')
          res.end(JSON.stringify({ ok: true, content, size: stat.size, mtime: stat.mtimeMs }))
        } catch (e: unknown) {
          res.end(JSON.stringify({ ok: false, error: String(e) }))
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

              // Always spawn a fully-interactive login shell (-l -i).
              // This guarantees .zshrc aliases (like cc-mini, cc-ds4pro) are loaded.
              // For alias sessions we auto-type the command after the shell is ready,
              // exactly as if the user typed it — the most reliable way to invoke
              // shell aliases including those with spaces in arguments.
              const spawnCmd = ZSH
              const spawnArgs = ['-li']
              const isPlainShell = (cmd === 'zsh' && !args)

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

              // Auto-type the alias command once the shell has initialised.
              // Using a real interactive shell + write() is the only way to
              // reliably expand .zshrc aliases like cc-mini or cc-ds4pro.
              if (!isPlainShell) {
                const fullCmd = args ? `${cmd} ${args}` : cmd
                setTimeout(() => {
                  try { ptyProc.write(fullCmd + '\r') } catch {}
                }, 600)
              }

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
  server: { port: 2002 },
})
