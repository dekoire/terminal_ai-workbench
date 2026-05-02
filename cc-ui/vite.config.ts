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

      // Check if a Python package is importable (GET /api/python-import?pkg=crewai)
      // Fallback for packages installed in venvs not on PATH
      server.middlewares.use('/api/python-import', ((req, res) => {
        res.setHeader('Content-Type', 'application/json')
        const url = new URL(req.url ?? '/', 'http://localhost')
        const pkg = (url.searchParams.get('pkg') ?? '').replace(/['"\\;|&$`]/g, '')
        if (!pkg) { res.end(JSON.stringify({ ok: false })); return }
        // Try system python3, then common venv locations
        exec(`python3 -c "import ${pkg}; print('ok')" 2>/dev/null`, { timeout: 5000 }, (err, out) => {
          if (!err && out?.trim() === 'ok') {
            res.end(JSON.stringify({ ok: true, via: 'python3' }))
            return
          }
          // Also try any crewai binary in common venv locations
          exec(`find "$HOME" -maxdepth 4 -name '${pkg}' -type f 2>/dev/null | head -1`, { timeout: 5000 }, (_, found) => {
            const foundPath = found?.trim()
            res.end(JSON.stringify({ ok: !!foundPath, via: foundPath || null }))
          })
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
      // Generate + write a CrewAI Python script, return shell command (POST /api/crew-script)
      server.middlewares.use('/api/crew-script', ((req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end('{}'); return }
        res.setHeader('Content-Type', 'application/json')
        let body = ''
        req.on('data', (c: Buffer) => { body += c.toString() })
        req.on('end', () => {
          try {
            const { crew, openrouterKey, crewaiPath, crewVerbose, crewTelemetryOff, crewQuietLogs, crewWrapperScript } = JSON.parse(body) as {
              crew: { name: string; goal?: string; orchestration: string; backend: string; process?: string; managerModel?: string; agents: { id: string; name: string; model: string; strengths: string[]; systemPrompt: string }[] }
              openrouterKey: string
              crewaiPath: string
              crewVerbose: boolean
              crewTelemetryOff: boolean
              crewQuietLogs: boolean
              crewWrapperScript: string
            }

            const venvDir   = path.dirname(path.dirname(crewaiPath))
            const pythonBin = path.join(venvDir, 'bin', 'python3')

            const verboseVal = crewVerbose ? 'True' : 'False'

            // Collect all unique tools across all agents for the import line
            const allTools = [...new Set(crew.agents.flatMap(a => a.tools ?? []))]
            const toolsImport = allTools.length > 0
              ? `from crewai_tools import ${allTools.join(', ')}\n`
              : ''

            const agentsCode = crew.agents.map((a, i) => {
              const varName = `agent_${i}`
              const safeModel = a.model.startsWith('openrouter/') ? a.model : `openrouter/${a.model}`
              const prompt = (a.systemPrompt || `Du bist ${a.name}. Stärken: ${a.strengths.join(', ')}.`).replace(/'/g, "\\'").replace(/\n/g, '\\n')
              const toolsList = (a.tools ?? []).length > 0
                ? `[${a.tools.map((t: string) => `${t}()`).join(', ')}]`
                : '[]'
              return `${varName} = Agent(\n    role=${JSON.stringify(a.name)},\n    goal=${JSON.stringify(a.strengths.slice(0, 2).join(', ') || a.name)},\n    backstory='${prompt}',\n    llm=LLM(model=${JSON.stringify(safeModel)}, base_url='https://openrouter.ai/api/v1', api_key=os.environ['OPENROUTER_API_KEY']),\n    tools=${toolsList},\n    verbose=${verboseVal}\n)`
            }).join('\n\n')

            const agentVars = crew.agents.map((_, i) => `agent_${i}`).join(', ')
            const crewName  = crew.name.replace(/'/g, "\\'")
            const crewGoal  = (crew.goal || '').replace(/'/g, "\\'")
            // Process mode and manager
            const isSequential = crew.process === 'sequential'
            const managerModelRaw = crew.managerModel ?? 'anthropic/claude-opus-4'
            const managerModel = managerModelRaw.startsWith('openrouter/') ? managerModelRaw : `openrouter/${managerModelRaw}`
            const managerModelLabel = managerModelRaw.split('/').pop() ?? managerModelRaw

            // Build agent_defs list for runtime: (agent_obj, role_name, model_short)
            const agentDefsTuple = crew.agents.map((a, i) => {
              const modelShort = (a.model.startsWith('openrouter/') ? a.model.slice('openrouter/'.length) : a.model).split('/').pop() ?? a.model
              return `    (agent_${i}, ${JSON.stringify(a.name)}, ${JSON.stringify(modelShort)})`
            }).join(',\n')

            const telemetryBlock = crewTelemetryOff ? `os.environ['OTEL_SDK_DISABLED']          = 'true'
os.environ['CREWAI_TELEMETRY_OPT_OUT']   = '1'
os.environ['ANONYMIZED_TELEMETRY']        = 'false'
os.environ['CREWAI_TRACING_ENABLED']     = 'false'
` : ''

            const quietLogsBlock = crewQuietLogs ? `import logging, os as _os
_os.environ['LITELLM_LOG']     = 'ERROR'
_os.environ['LITELLM_VERBOSE'] = 'False'
for _lg in ('crewai', 'litellm', 'opentelemetry', 'chromadb', 'httpx', 'httpcore', 'urllib3', 'asyncio'):
    logging.getLogger(_lg).setLevel(logging.ERROR)
logging.disable(logging.WARNING)

import warnings
warnings.filterwarnings('ignore')
` : ''

            const wrapperBlock = crewWrapperScript ? `\n# ── Custom wrapper script ──\n${crewWrapperScript}\n` : ''

            const script = `#!/usr/bin/env python3
# Codera AI — Auto-generated Crew Script
# Crew: ${crewName}
import os, sys
os.environ['OPENROUTER_API_KEY'] = ${JSON.stringify(openrouterKey)}
os.environ['OPENAI_API_KEY']     = ${JSON.stringify(openrouterKey)}
${telemetryBlock}${quietLogsBlock}${wrapperBlock}
import io as _io, re as _re
_old_stdout, sys.stdout = sys.stdout, _io.StringIO()
from crewai import Agent, Task, Crew, Process, LLM
sys.stdout = _old_stdout
${toolsImport}
# Fix: orphaned tool_result blocks crash Anthropic in hierarchical mode
def _sanitize_messages(msgs):
    """Remove tool_result/tool messages whose ID has no matching tool_use/tool_call in the preceding assistant message."""
    if not isinstance(msgs, list):
        return msgs
    cleaned, last_tool_ids = [], set()
    for msg in msgs:
        if not isinstance(msg, dict):
            cleaned.append(msg); continue
        role = msg.get('role', '')
        if role == 'assistant':
            # Collect IDs from both OpenAI format (tool_calls) and Anthropic native (content blocks)
            last_tool_ids = set()
            for tc in (msg.get('tool_calls') or []):
                if isinstance(tc, dict) and tc.get('id'):
                    last_tool_ids.add(tc['id'])
            c = msg.get('content', [])
            if isinstance(c, list):
                for b in c:
                    if isinstance(b, dict) and b.get('type') == 'tool_use' and b.get('id'):
                        last_tool_ids.add(b['id'])
            cleaned.append(msg)
        elif role == 'tool':
            # OpenAI format tool result — drop if orphaned
            if msg.get('tool_call_id') in last_tool_ids:
                cleaned.append(msg)
        elif role == 'user':
            # Anthropic native format — strip orphaned tool_result content blocks
            c = msg.get('content', '')
            if isinstance(c, list):
                c2 = [b for b in c if not (isinstance(b, dict) and b.get('type') == 'tool_result' and b.get('tool_use_id') not in last_tool_ids)]
                if len(c2) != len(c):
                    msg = {**msg, 'content': c2 or ''}
            last_tool_ids = set()
            cleaned.append(msg)
        else:
            cleaned.append(msg)
    return cleaned

# Patch 1: crewai agent_utils level
try:
    import crewai.utilities.agent_utils as _au
    _orig_llm_call = _au.get_llm_response
    def _safe_llm_call(llm, messages, *args, **kwargs):
        return _orig_llm_call(llm, _sanitize_messages(messages), *args, **kwargs)
    _au.get_llm_response = _safe_llm_call
    try:
        import crewai.agents.crew_agent_executor as _cae
        _cae.get_llm_response = _safe_llm_call
    except Exception:
        pass
except Exception:
    pass

# Patch 2: openai client level (last line of defence — catches any format)
try:
    import openai.resources.chat.completions as _oai_comp
    _orig_create = _oai_comp.Completions.create
    def _safe_create(self, *args, **kwargs):
        if 'messages' in kwargs:
            kwargs['messages'] = _sanitize_messages(kwargs['messages'])
        return _orig_create(self, *args, **kwargs)
    _oai_comp.Completions.create = _safe_create
except Exception:
    pass

# Strip emojis from all output
_EMOJI_RE = _re.compile(
    u'[\\U0001F300-\\U0001F9FF\\U00002600-\\U000027BF\\U0001FA00-\\U0001FA9F'
    u'\\U00002700-\\U000027BF\\U0001F1E0-\\U0001F1FF\\u2600-\\u26FF\\u2700-\\u27BF]+'
)
class _NoEmojiWriter:
    def __init__(self, w): self._w = w
    def write(self, s): self._w.write(_EMOJI_RE.sub('', s))
    def flush(self): self._w.flush()
    def fileno(self): return self._w.fileno()
    def isatty(self): return self._w.isatty()
sys.stdout = _NoEmojiWriter(sys.stdout)
sys.stderr = _NoEmojiWriter(sys.stderr)

${agentsCode}

# (agent_object, display_role, model_short_name)
_agent_defs = [
${agentDefsTuple}
]

# Patch each agent to emit markers when the manager delegates to it.
# Agent is a Pydantic v2 model, so we bypass __setattr__ via object.__setattr__.
# Instance __dict__ entries shadow class methods (non-data descriptors) in Python's MRO.
import base64 as _b64
_is_hierarchical = ${!isSequential ? 'True' : 'False'}
_orch_model = ${JSON.stringify(managerModelLabel)}
def _make_marked(agent, role, model_short):
    _orig = agent.execute_task          # capture bound method before we shadow it
    def _marked(*args, **kwargs):
        _task_desc = ''
        try: _task_desc = str(args[0].description) if args else ''
        except Exception: pass
        _task_b64 = _b64.b64encode(_task_desc[:400].encode('utf-8', errors='replace')).decode()
        if _is_hierarchical:
            print(f'\\n###CREW:Orchestrator:{_orch_model}:step:{_task_b64}###', flush=True)
        print(f'\\n###CREW:{role.replace(" ", "_")}:{model_short}:start:{_task_b64}###', flush=True)
        _result = _orig(*args, **kwargs)
        _out_str = str(_result)
        _tok = max(1, len(_out_str) // 4)
        _out_b64 = _b64.b64encode(_out_str[:150].encode('utf-8', errors='replace')).decode()
        print(f'###CREW_META:{role.replace(" ", "_")}:{model_short}:{_tok}:{_out_b64}:{_task_b64}###', flush=True)
        print(f'###CREW:{role.replace(" ", "_")}:{model_short}:done###', flush=True)
        return _result
    object.__setattr__(agent, 'execute_task', _marked)  # bypass Pydantic validation

for _ag, _role, _ms in _agent_defs:
    _make_marked(_ag, _role, _ms)

${isSequential ? '' : `_manager_llm = LLM(
    model=${JSON.stringify(managerModel)},
    base_url='https://openrouter.ai/api/v1',
    api_key=os.environ['OPENROUTER_API_KEY']
)

# Manager agent must have tools=[] — CrewAI raises if manager has tools
_manager_agent = Agent(
    role='Crew Manager',
    goal='IMMER an Spezialisten delegieren — niemals selbst antworten. Zerlege jede Aufgabe und delegiere jeden Teil an den passenden Agenten. Sammle alle Ergebnisse und fasse sie zusammen.',
    backstory='Du bist ein strikter Projektmanager. Deine einzige Aufgabe ist es zu delegieren. Du hast kein eigenes Wissen und kannst keine Aufgaben selbst loesen — du MUSST immer den passenden Spezialisten beauftragen. Antworte niemals direkt, delegiere immer zuerst.',
    llm=_manager_llm,
    tools=[],
    allow_delegation=True,
    verbose=${verboseVal}
)
`}
# Template task — description is filled at kickoff time via inputs dict
_task_template = Task(
    description='{task_input}',
    expected_output='Vollstaendige, detaillierte Antwort auf Deutsch',
)

_crew = Crew(
    agents=[ag for ag, _, _ in _agent_defs],
    tasks=[_task_template],
    process=Process.${isSequential ? 'sequential' : 'hierarchical'},
    ${isSequential ? '' : 'manager_agent=_manager_agent,'}
    verbose=${verboseVal}
)

print('\\n\\033[1;32m${crewName} bereit${crewGoal ? ' — ' + crewGoal : ''}\\033[0m')
print('\\033[90mAgenten: ${crew.agents.map(a => a.name).join(', ')}\\033[0m')
print('\\033[90mProzess: ${isSequential ? 'Sequentiell (kein Manager)' : `Hierarchisch — Manager: ${managerModelLabel}`}\\033[0m')
print('\\033[90mEingabe: Aufgabe beschreiben → Enter · quit zum Beenden\\033[0m\\n')

while True:
    try:
        task_input = input('\\033[1;36m> \\033[0m').strip()
        if not task_input:
            continue
        if task_input.lower() in ('quit', 'exit', 'q', ':q'):
            print('\\n\\033[90mCrew beendet.\\033[0m')
            break

        print(f'\\033[90m[Crew empfangen: {task_input[:60]}{"..." if len(task_input) > 60 else ""}]\\033[0m', flush=True)
        _input_b64 = _b64.b64encode(task_input.encode('utf-8', errors='replace')).decode()
        # Reset cached task output so CrewAI re-runs agents instead of returning stale result
        try:
            object.__setattr__(_task_template, 'output', None)
        except Exception:
            pass
        print(f'\\n###CREW_RUN_START:{_input_b64}###', flush=True)
${isSequential ? '' : `        print(f'\\n###CREW:Orchestrator:${managerModelLabel}:start###', flush=True)\n`}        result = _crew.kickoff(inputs={'task_input': task_input})
        try:
            _tok = getattr(result, 'token_usage', None)
            if _tok is not None:
                _total = getattr(_tok, 'total_tokens', 0) or 0
                print(f'\\n###CREW_TOTAL_TOKENS:{_total}###', flush=True)
        except Exception:
            pass
${isSequential ? '' : `        print(f'###CREW:Orchestrator:${managerModelLabel}:done###', flush=True)\n`}        print(f'\\n###CREW_RESULT_READY###', flush=True)
    except KeyboardInterrupt:
        print('\\n\\033[90mCrew beendet.\\033[0m')
        break
    except Exception as e:
        import traceback, base64 as _b64e
        _err_str = f'{type(e).__name__}: {e}'
        _tb_str  = traceback.format_exc()
        _err_b64 = _b64e.b64encode((_err_str[:300]).encode('utf-8', errors='replace')).decode()
        _tb_b64  = _b64e.b64encode((_tb_str[:2000]).encode('utf-8', errors='replace')).decode()
        print(f'\\n###CREW_ERROR:{_err_b64}:{_tb_b64}###', flush=True)
        print(f'\\n\\033[1;31mFehler: {e}\\033[0m')
        traceback.print_exc()
        print()
`

            const tmpFile = path.join(require('os').tmpdir(), `cc-crew-${Date.now()}.py`)
            fs.writeFileSync(tmpFile, script, { mode: 0o755 })

            const cmd = pythonBin
            const args = tmpFile
            res.end(JSON.stringify({ ok: true, cmd, args, scriptPath: tmpFile }))
          } catch (e) {
            res.end(JSON.stringify({ ok: false, error: String(e) }))
          }
        })
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

              // If cmd is an absolute path (e.g. /usr/bin/python3 for crew sessions),
              // spawn it directly — no shell echo, no alias resolution needed.
              // Otherwise spawn zsh -li so .zshrc aliases like cc-mini are available.
              const isAbsCmd    = cmd.startsWith('/')
              const isPlainShell = (cmd === 'zsh' && !args)
              const spawnCmd  = isAbsCmd ? cmd : ZSH
              const spawnArgs = isAbsCmd ? (args ? args.split(' ') : []) : ['-li']

              const ptyEnv: Record<string, string> = {
                ...(process.env as Record<string, string>),
                PATH: safePath,
                TERM: 'xterm-256color',
                COLORTERM: 'truecolor',
                HOME: process.env.HOME ?? '/Users/' + (process.env.USER ?? 'user'),
                LANG: process.env.LANG ?? 'en_US.UTF-8',
                PYTHONIOENCODING: 'utf-8',
                PYTHONUNBUFFERED: '1',
                CREWAI_TRACING_ENABLED: 'false',
                CREWAI_VERBOSE: 'false',
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

              // For named alias commands (not absolute paths), auto-type into the
              // interactive shell so .zshrc aliases get expanded.
              if (!isPlainShell && !isAbsCmd) {
                const fullCmd = args ? `${cmd} ${args}` : cmd
                setTimeout(() => {
                  try { ptyProc.write(fullCmd + '\r') } catch {}
                }, 600)
              }

              // Stateful: persists across PTY chunks so chunk-split panel lines are filtered
              let inPanel = false
              const filterPanels = (raw: string): string => {
                const lines = raw.split('\n')
                const out: string[] = []
                let blanks = 0
                for (const line of lines) {
                  const vis = line.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').replace(/\r/g, '').trim()
                  if (!vis) { if (!inPanel && ++blanks <= 1) out.push(line); continue }
                  blanks = 0
                  // New run → reset panel state so stale state doesn't bleed into next run
                  if (vis.startsWith('###CREW_RUN_START:')) inPanel = false
                  // Always let protocol markers through even when inside a Rich panel
                  if (vis.startsWith('###CREW')) { out.push(line); continue }
                  const fc = vis[0]
                  if (fc === '╭') { inPanel = true;  continue }
                  if (fc === '╰') { inPanel = false; continue }
                  if (inPanel || fc === '│') continue
                  const lc = vis[vis.length - 1]
                  if (lc === '│') continue
                  if (/^[─╌━┄╯╰]+$/.test(vis)) continue
                  out.push(line)
                }
                return out.join('\n')
              }

              const broadcast = (data: string) => {
                const filtered = filterPanels(data)
                if (!filtered && data.includes('\n')) return
                const payload = JSON.stringify({ type: 'data', data: filtered })
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
