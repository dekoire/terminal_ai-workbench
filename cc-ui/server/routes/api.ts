/**
 * All REST API routes — extracted from vite.config.ts apiPlugin()
 * Mounted at / in the Express app (paths already start with /api/…)
 */
import { Router } from 'express'
import { exec, spawn }  from 'child_process'
import fs               from 'fs'
import path             from 'path'
import { pendingPerms, sessionWs, pendingPermsBySession } from '../state.js'

const router = Router()

// ── GET /api/app-config ────────────────────────────────────────────────────────
// Returns app-level config that is baked into the server environment.
// Groq key is returned so the frontend can use voice without user setup.
// Never expose service role keys or other admin secrets here.
router.get('/api/app-config', (_req, res) => {
  res.json({
    groqApiKey:    process.env.GROQ_API_KEY    || '',
    hasGroqKey:    !!process.env.GROQ_API_KEY,
  })
})

// ── helpers ────────────────────────────────────────────────────────────────────
const home = () => process.env.HOME ?? '/Users/' + (process.env.USER ?? '')
const tilde = (p: string) => p.replace(/^~/, home())

/** ~/Documents/Codera/var — created on first use */
function coderaVarDir(): string {
  const dir = path.join(home(), 'Documents', 'Codera', 'var')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

function readBody(req: import('express').Request): Promise<string> {
  return new Promise(resolve => {
    let d = ''
    req.on('data', (c: Buffer) => { d += c.toString() })
    req.on('end', () => resolve(d))
  })
}

// ── GET /api/home ──────────────────────────────────────────────────────────────
router.get('/api/home', (_req, res) => {
  res.json({ home: home() })
})

// ── GET /api/open ──────────────────────────────────────────────────────────────
router.get('/api/open', (req, res) => {
  const filePath = tilde(req.query.path as string ?? '')
  if (!filePath) { res.status(400).json({ ok: false }); return }
  exec(`open "${filePath}"`, err => res.json({ ok: !err, error: err?.message }))
})

// ── GET /api/which ─────────────────────────────────────────────────────────────
router.get('/api/which', (req, res) => {
  const cmd = (req.query.cmd as string ?? '').replace(/['"\\;|&$`]/g, '')
  if (!cmd) { res.json({ ok: false, path: null }); return }
  exec(`zsh -i -c "type -a '${cmd}' 2>/dev/null"`, { timeout: 4000 }, (err, out) => {
    const text = out?.trim() ?? ''
    if (err || !text) { res.json({ ok: false, path: null }); return }
    const m = text.match(/is (\/[^\s]+)/)
    res.json({ ok: true, path: m ? m[1] : text.split('\n')[0] })
  })
})

// ── POST /api/zshrc-alias ──────────────────────────────────────────────────────
router.post('/api/zshrc-alias', async (req, res) => {
  try {
    const { aliasName, aliasCmd } = JSON.parse(await readBody(req)) as { aliasName: string; aliasCmd: string }
    const zshrcPath = path.join(home(), '.zshrc')
    const line = `alias ${aliasName}='${aliasCmd}'`

    // 1. Write into ~/.zshrc (persists across all future sessions)
    let content = ''
    try { content = fs.readFileSync(zshrcPath, 'utf-8') } catch { /* new file */ }
    const filtered = content.split('\n').filter(l => !l.match(new RegExp(`^\\s*alias\\s+${aliasName}=`))).join('\n')
    fs.writeFileSync(zshrcPath, filtered.trimEnd() + '\n' + line + '\n', 'utf-8')

    // 2. Also write a small helper script and source it so the alias is immediately
    //    available in any new zsh session started by this process tree
    const helperDir  = path.join(home(), '.cc-ui-aliases')
    const helperFile = path.join(helperDir, `${aliasName}.sh`)
    fs.mkdirSync(helperDir, { recursive: true })
    fs.writeFileSync(helperFile, `#!/bin/zsh\nalias ${aliasName}='${aliasCmd}'\n`, 'utf-8')
    fs.chmodSync(helperFile, 0o755)

    // Ensure the helper dir is sourced from .zshrc too (one-time setup line)
    const sourceDir = path.join(home(), '.zshrc')
    const sourceLine = `[ -d ~/.cc-ui-aliases ] && for f in ~/.cc-ui-aliases/*.sh; do source "$f"; done`
    const currentZshrc = fs.readFileSync(sourceDir, 'utf-8')
    if (!currentZshrc.includes('.cc-ui-aliases')) {
      fs.appendFileSync(sourceDir, '\n# Codera AI — auto-registered aliases\n' + sourceLine + '\n')
    }

    res.json({ ok: true })
  } catch (e) { res.json({ ok: false, error: String(e) }) }
})

// ── GET /api/store-read ────────────────────────────────────────────────────────
router.get('/api/store-read', (req, res) => {
  const userId = typeof req.query.userId === 'string' && req.query.userId ? req.query.userId : ''
  const suffix = userId ? `-${userId}` : ''
  const filePath = path.join(home(), `.cc-ui-data${suffix}.json`)
  try { res.send(fs.readFileSync(filePath, 'utf-8') || 'null') }
  catch { res.send('null') }
})

// ── POST /api/store-write ──────────────────────────────────────────────────────
router.post('/api/store-write', async (req, res) => {
  const userId = typeof req.query.userId === 'string' && req.query.userId ? req.query.userId : ''
  const suffix = userId ? `-${userId}` : ''
  const filePath = path.join(home(), `.cc-ui-data${suffix}.json`)
  const body = await readBody(req)
  try {
    if (body && body !== 'null') fs.writeFileSync(filePath, body, 'utf-8')
    else try { fs.unlinkSync(filePath) } catch { /* no file */ }
    res.json({ ok: true })
  } catch (e) { res.json({ ok: false, error: String(e) }) }
})

// ── GET /api/browse ────────────────────────────────────────────────────────────
router.get('/api/browse', (req, res) => {
  const dirPath = tilde(req.query.path as string ?? home())
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    const items = entries
      .filter(e => !e.name.startsWith('.') || e.name === '..')
      .map(e => ({ name: e.name, path: path.join(dirPath, e.name), isDir: e.isDirectory() }))
      .sort((a, b) => (a.isDir !== b.isDir ? (a.isDir ? -1 : 1) : a.name.localeCompare(b.name)))
    const withParent = dirPath !== '/'
      ? [{ name: '..', path: path.dirname(dirPath), isDir: true }, ...items]
      : items
    res.json({ items: withParent, currentPath: dirPath })
  } catch (e) { res.json({ items: [], currentPath: dirPath, error: String(e) }) }
})

// ── GET /api/pick-folder ───────────────────────────────────────────────────────
router.get('/api/pick-folder', (req, res) => {
  const startPath = tilde(req.query.path as string ?? home()).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  const script = `POSIX path of (choose folder with prompt "Projektordner wählen:" default location POSIX file "${startPath}")`
  exec(`osascript -e '${script.replace(/'/g, "'\\''")}'`, { timeout: 60000 }, (err, out) => {
    if (err) res.json({ ok: false, path: null, error: err.message })
    else res.json({ ok: true, path: out.trim().replace(/\/$/, '') })
  })
})

// ── GET /api/pick-file ─────────────────────────────────────────────────────────
router.get('/api/pick-file', (req, res) => {
  const startPath = tilde(req.query.path as string ?? home()).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  const script = `POSIX path of (choose file with prompt "Datei auswählen:" default location POSIX file "${startPath}")`
  exec(`osascript -e '${script.replace(/'/g, "'\\''")}'`, { timeout: 60000 }, (err, out) => {
    if (err) res.json({ ok: false, path: null, error: err.message })
    else res.json({ ok: true, path: out.trim() })
  })
})

// ── GET/POST /api/git ──────────────────────────────────────────────────────────
router.get('/api/git', (req, res) => {
  const cwd = tilde(req.query.path as string ?? home())
  const run = (cmd: string) => new Promise<string>(resolve =>
    exec(cmd, { cwd }, (_, out, err) => resolve((out || err || '').trim()))
  )
  run('git rev-parse --is-inside-work-tree').then(async check => {
    if (check !== 'true') { res.json({ hasGit: false, status: [], log: [], branches: [], remotes: [], diffStat: '', lastCommit: '' }); return }
    // Check if repo has any commits — empty repos need safe defaults
    const hasCommits = await run('git rev-parse HEAD').then(r => !r.startsWith('fatal') && r.length > 0).catch(() => false)
    const [status, remoteUrl] = await Promise.all([
      run('git status --short'),
      run('git remote get-url origin 2>/dev/null || echo ""'),
    ])
    // Strip embedded token before sending to client
    const remotes = remoteUrl ? [remoteUrl.replace(/https?:\/\/[^@]+@/, 'https://')] : []
    const [log, branches, diffStat, lastCommit] = hasCommits ? await Promise.all([
      run('git log --oneline -20 --pretty=format:"%h|%s|%an|%ar|%ai"'),
      run('git branch -v --format="%(refname:short)|%(objectname:short)|%(subject)|%(HEAD)"'),
      run('git diff --stat HEAD 2>/dev/null | tail -1'),
      run('git log -1 --format="%ar"'),
    ]) : ['', 'main||||*', '', '']
    const isFatal = (s: string) => s.startsWith('fatal') || s.startsWith('error')
    res.json({
      hasGit: true,
      status:   status.split('\n').filter(Boolean).map(l => ({ flag: l.slice(0,2).trim(), file: l.slice(3) })),
      log:      log.split('\n').filter(l => Boolean(l) && !isFatal(l)).map(l => { const p = l.split('|'); return { hash: p[0], msg: p[1] ?? '', author: p[2] ?? '', when: p[3] ?? '', date: p[4] ?? '' } }).filter(e => e.hash && e.hash.length < 50),
      branches: branches.split('\n').filter(l => Boolean(l) && !isFatal(l)).map(l => { const p = l.split('|'); return { name: p[0], hash: p[1] ?? '', msg: p[2] ?? '', current: p[3] === '*' } }).filter(b => b.name),
      diffStat: isFatal(diffStat) ? '' : diffStat,
      remotes,
      lastCommit: isFatal(lastCommit) ? '' : lastCommit,
    })
  }).catch(e => res.json({ hasGit: false, error: String(e), status: [], log: [], branches: [], remotes: [], diffStat: '', lastCommit: '' }))
})

router.post('/api/git-action', async (req, res) => {
  try {
    const { action, path: cwd, message, remote, branch, token } = JSON.parse(await readBody(req)) as {
      action: string; path: string; message?: string; remote?: string; branch?: string; token?: string
    }
    const resolved = tilde(cwd)

    const run = (cmd: string, runCwd?: string) => new Promise<{ ok: boolean; out: string }>(resolve =>
      exec(cmd, { cwd: runCwd ?? resolved }, (err, stdout, stderr) =>
        resolve({ ok: !err, out: (err ? stderr || err.message : stdout).trim() })
      )
    )

    // Temporarily inject token into remote URL so pull/push can authenticate
    const withToken = async (fn: () => Promise<{ ok: boolean; out: string }>) => {
      if (!token) return fn()
      const urlResult = await run('git remote get-url origin')
      if (!urlResult.ok || !urlResult.out.includes('github.com') || urlResult.out.includes('@github.com')) return fn()
      const authedUrl = urlResult.out.replace('https://github.com/', `https://${token}@github.com/`)
      await run(`git remote set-url origin ${JSON.stringify(authedUrl)}`)
      try { return await fn() } finally { await run(`git remote set-url origin ${JSON.stringify(urlResult.out)}`) }
    }

    let result = { ok: false, out: 'unknown action' }
    if (action === 'stage')      result = await run('git add -A')
    if (action === 'commit')     result = await run(`git commit -m ${JSON.stringify(message ?? 'Update')}`)
    if (action === 'push')       result = await withToken(() => run(`git push -u ${remote ?? 'origin'} ${branch ?? 'HEAD'}`))
    if (action === 'push-u')     result = await withToken(() => run(`git push -u origin ${JSON.stringify(branch ?? 'main')}`))
    if (action === 'pull') {
      let r = await withToken(() => run('git pull'))
      if (!r.ok && r.out.includes('no tracking information')) {
        const branchResult = await run('git rev-parse --abbrev-ref HEAD')
        if (branchResult.ok) {
          await run(`git branch --set-upstream-to=origin/${branchResult.out.trim()} ${branchResult.out.trim()}`)
          r = await withToken(() => run(`git pull origin ${branchResult.out.trim()}`))
        }
      }
      result = r
    }
    if (action === 'checkout')   result = await run(`git checkout ${JSON.stringify(branch ?? '')}`)
    if (action === 'new-branch') result = await run(`git checkout -b ${JSON.stringify(branch ?? '')}`)
    if (action === 'init') {
      const r1 = await run('git init')
      const r2 = await run(`git checkout -b ${JSON.stringify(branch ?? 'main')}`)
      result = { ok: r1.ok && r2.ok, out: [r1.out, r2.out].filter(Boolean).join('\n') }
    }
    if (action === 'add-remote' && remote) {
      // Always store clean URL — token injected at runtime by withToken
      const cleanUrl = remote.replace(/https?:\/\/[^@]+@/, 'https://')
      result = await run(`git remote add origin ${JSON.stringify(cleanUrl)}`)
    }
    if (action === 'clone' && remote) {
      result = await (async () => {
        const cleanUrl = remote.replace(/https?:\/\/[^@]+@/, 'https://')
        const folderName = path.basename(resolved)
        const parentDir  = path.dirname(resolved)
        if (fs.existsSync(resolved)) {
          // Folder already exists — init + fetch + reset (git clone refuses non-empty dirs)
          await run('git init')
          await run(`git remote add origin ${JSON.stringify(remote)}`)
          const fetchR = await run('git fetch origin')
          if (!fetchR.ok) {
            await run(`git remote set-url origin ${JSON.stringify(cleanUrl)}`)
            return fetchR
          }
          // Detect default branch via remote HEAD symref (no extra network call needed)
          await run('git remote set-head origin --auto')
          const headR = await run('git symbolic-ref refs/remotes/origin/HEAD')
          // headR fails when the remote is empty (no commits pushed yet)
          if (!headR.ok) {
            // Empty remote repo — git init + remote set up, no checkout possible
            await run(`git remote set-url origin ${JSON.stringify(cleanUrl)}`)
            return { ok: true, out: 'empty' }
          }
          const defBranch = headR.out.replace('refs/remotes/origin/', '').trim()
          // -B creates or resets branch (handles case where git init already made 'main')
          const checkR = await run(`git checkout -B ${defBranch} origin/${defBranch}`)
          await run(`git branch --set-upstream-to=origin/${defBranch} ${defBranch}`)
          // Always strip token regardless of outcome
          await run(`git remote set-url origin ${JSON.stringify(cleanUrl)}`)
          return checkR.ok ? { ok: true, out: `Geklont auf ${defBranch}` } : checkR
        } else {
          const cloneR = await run(`git clone ${JSON.stringify(remote)} ${JSON.stringify(folderName)}`, parentDir)
          if (cloneR.ok && cleanUrl !== remote) await run(`git remote set-url origin ${JSON.stringify(cleanUrl)}`)
          // git clone on empty remote exits with error — treat as success (remote is set up)
          if (!cloneR.ok && cloneR.out.includes('empty repository')) {
            await run(`git remote set-url origin ${JSON.stringify(cleanUrl)}`)
            return { ok: true, out: 'empty' }
          }
          return cloneR
        }
      })()
    }
    if (action === 'discard-file' && message) {
      const statusResult = await run(`git status --porcelain -- ${JSON.stringify(message)}`)
      const flag = statusResult.out.slice(0, 2)
      if (flag === '??' || flag.startsWith('A')) {
        const fullPath = path.resolve(resolved, message)
        try { fs.unlinkSync(fullPath); result = { ok: true, out: '' } } catch (e) { result = { ok: false, out: String(e) } }
      } else {
        const r = await run(`git checkout HEAD -- ${JSON.stringify(message)}`)
        result = { ok: !r.out.includes('error:'), out: r.out }
      }
    }
    res.json(result)
  } catch (e) { res.json({ ok: false, out: String(e) }) }
})

router.get('/api/file-content', (req, res) => {
  const base = tilde(req.query.path as string ?? '')
  const file = req.query.file as string ?? ''
  if (!base || !file) { res.json({ ok: false, error: 'missing params' }); return }
  const full = path.resolve(base, file)
  if (!full.startsWith(base)) { res.json({ ok: false, error: 'forbidden' }); return }
  fs.readFile(full, 'utf-8', (err, content) => {
    if (err) res.json({ ok: false, error: String(err) })
    else res.json({ ok: true, content })
  })
})

router.get('/api/git-remote', (req, res) => {
  const cwd = tilde(req.query.path as string ?? '')
  exec('git remote get-url origin', { cwd }, (err, out) => {
    if (err) res.json({ ok: false, url: null }); else res.json({ ok: true, url: out.trim() })
  })
})

// ── GitHub API — list repos ───────────────────────────────────────────────────
router.get('/api/github/repos', async (req, res) => {
  const { token } = req.query as { token?: string }
  if (!token) return res.json({ ok: false, repos: [] })
  try {
    const headers: Record<string, string> = { Authorization: `token ${token}`, Accept: 'application/vnd.github+json' }
    const [userRepos, orgs]: [unknown, { login: string }[]] = await Promise.all([
      fetch('https://api.github.com/user/repos?per_page=100&sort=updated&visibility=all', { headers }).then(r => r.json()),
      fetch('https://api.github.com/user/orgs', { headers }).then(r => r.json()),
    ])
    const orgRepoArrays = await Promise.all(
      orgs.map((o) =>
        fetch(`https://api.github.com/orgs/${o.login}/repos?per_page=100&sort=updated`, { headers }).then(r => r.json())
      )
    )
    const all = [...(userRepos as unknown[]), ...(orgRepoArrays as unknown[][]).flat()]
      .filter((r: unknown) => r && typeof r === 'object' && 'clone_url' in r)
      .map((r: unknown) => {
        const repo = r as Record<string, unknown>
        const owner = repo.owner as Record<string, unknown> | undefined
        return {
          fullName:    repo.full_name as string,
          cloneUrl:    repo.clone_url as string,
          private:     repo.private as boolean,
          description: (repo.description as string) ?? '',
          org:         owner?.type === 'Organization' ? owner.login as string : null,
        }
      })
    res.json({ ok: true, repos: all })
  } catch (e) {
    res.json({ ok: false, repos: [], error: String(e) })
  }
})

// ── GitHub API — create repo ──────────────────────────────────────────────────
router.post('/api/github/create-repo', async (req, res) => {
  const { token, name, private: isPrivate, org } = JSON.parse(await readBody(req)) as { token: string; name: string; private: boolean; org?: string }
  if (!token || !name) return res.json({ ok: false, error: 'token and name required' })
  try {
    const url = org
      ? `https://api.github.com/orgs/${org}/repos`
      : 'https://api.github.com/user/repos'
    const r = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, private: isPrivate ?? true, auto_init: false }),
    })
    const data = await r.json() as Record<string, unknown>
    if (!r.ok) return res.json({ ok: false, error: data.message as string })
    res.json({ ok: true, cloneUrl: data.clone_url as string, htmlUrl: data.html_url as string })
  } catch (e) {
    res.json({ ok: false, error: String(e) })
  }
})

// ── GET /api/scan-project ──────────────────────────────────────────────────────
router.get('/api/scan-project', (req, res) => {
  const projectPath = tilde(req.query.path as string ?? '')
  if (!projectPath) { res.json({ ok: false, error: 'no path' }); return }

  const IGNORE = new Set(['node_modules','.git','dist','build','.next','.nuxt','out','coverage','__pycache__','.venv','venv','vendor','.cache','tmp','temp','graphify-out','.turbo','.vercel','.netlify','storybook-static'])
  const KEY_FILES = ['package.json','README.md','pyproject.toml','Cargo.toml','go.mod','tsconfig.json']
  const SKIP_EXT  = new Set(['.png','.jpg','.jpeg','.gif','.svg','.ico','.woff','.woff2','.ttf','.eot','.mp4','.webm','.zip','.gz'])

  interface DirResult { tree: string; keyFileContents: Record<string, string> }

  function scanDir(dir: string, relBase = '', depth = 0): DirResult {
    if (depth > 5) return { tree: '', keyFileContents: {} }
    let tree = ''; const keyFileContents: Record<string, string> = {}
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
        .filter(e => !IGNORE.has(e.name) && !e.name.startsWith('.'))
        .sort((a, b) => (a.isDirectory() !== b.isDirectory() ? (a.isDirectory() ? -1 : 1) : a.name.localeCompare(b.name)))
      const dirFiles: string[] = []
      for (const entry of entries) {
        const absPath = path.join(dir, entry.name)
        const relPath = relBase ? `${relBase}/${entry.name}` : entry.name
        if (entry.isDirectory()) {
          const sub = scanDir(absPath, relPath, depth + 1)
          if (sub.tree) tree += sub.tree
          Object.assign(keyFileContents, sub.keyFileContents)
        } else {
          if (!SKIP_EXT.has(path.extname(entry.name).toLowerCase())) dirFiles.push(entry.name)
          if (KEY_FILES.includes(entry.name) && depth <= 1) {
            try { keyFileContents[relPath] = fs.readFileSync(absPath, 'utf-8').slice(0, 600) } catch { /* skip */ }
          }
        }
      }
      if (dirFiles.length > 0) tree += `${relBase || '.'}/: ${dirFiles.join(', ')}\n`
    } catch { /* skip unreadable dirs */ }
    return { tree, keyFileContents }
  }

  try {
    const { tree, keyFileContents } = scanDir(projectPath)
    res.json({ ok: true, tree: tree.trim(), keyFileContents, projectPath })
  } catch (e) { res.json({ ok: false, error: String(e) }) }
})

// ── GET /api/orbit/list-chats?projectId=X ─────────────────────────────────────
// Returns all chat JSONL files for a project so OrbitView can restore from disk
router.get('/api/orbit/list-chats', (req, res) => {
  const projectId = req.query.projectId as string ?? ''
  if (!projectId) { res.json({ ok: false, chats: [] }); return }
  const dir = path.join(process.cwd(), 'context', 'raw', 'chat', projectId)
  try {
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsonl'))
    const chats = files.map(f => {
      const chatId = f.slice(0, -6)
      try {
        const lines = fs.readFileSync(path.join(dir, f), 'utf-8')
          .split('\n').filter(l => l.trim())
        const msgs = lines.map(l => { try { return JSON.parse(l) as { ts?: number } } catch { return null } }).filter(Boolean)
        const tsList = msgs.map(m => m?.ts ?? 0).filter(Boolean)
        return { chatId, messageCount: msgs.length, firstTs: Math.min(...tsList), lastTs: Math.max(...tsList) }
      } catch { return { chatId, messageCount: 0, firstTs: 0, lastTs: 0 } }
    }).sort((a, b) => b.lastTs - a.lastTs)
    res.json({ ok: true, chats })
  } catch { res.json({ ok: true, chats: [] }) }
})

// ── GET /api/orbit/load-chat?projectId=X&chatId=Y ─────────────────────────────
// Returns all messages from a chat JSONL file
router.get('/api/orbit/load-chat', (req, res) => {
  const projectId = req.query.projectId as string ?? ''
  const chatId    = req.query.chatId    as string ?? ''
  if (!projectId || !chatId) { res.json({ ok: false, messages: [] }); return }
  const file = path.join(process.cwd(), 'context', 'raw', 'chat', projectId, `${chatId}.jsonl`)
  try {
    const lines = fs.readFileSync(file, 'utf-8').split('\n').filter(l => l.trim())
    const messages = lines.map(l => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
    res.json({ ok: true, messages })
  } catch (e) { res.json({ ok: false, messages: [], error: String(e) }) }
})

// ── POST /api/orbit/save ───────────────────────────────────────────────────────
router.post('/api/orbit/save', async (req, res) => {
  try {
    const { projectId, chatId, message } = JSON.parse(await readBody(req)) as { projectId: string; chatId: string; message: unknown }
    const dir = path.join(process.cwd(), 'context', 'raw', 'chat', projectId)
    fs.mkdirSync(dir, { recursive: true })
    fs.appendFileSync(path.join(dir, `${chatId}.jsonl`), JSON.stringify(message) + '\n', 'utf-8')
    res.json({ ok: true })
  } catch (e) { res.json({ ok: false, error: String(e) }) }
})

// ── POST /api/session/save ─────────────────────────────────────────────────────
router.post('/api/session/save', async (req, res) => {
  try {
    const { projectId, sessionId, message } = JSON.parse(await readBody(req)) as { projectId: string; sessionId: string; message: unknown }
    const dir = path.join(process.cwd(), 'context', 'raw', 'chat', projectId, 'sessions')
    fs.mkdirSync(dir, { recursive: true })
    fs.appendFileSync(path.join(dir, `${sessionId}.jsonl`), JSON.stringify(message) + '\n', 'utf-8')
    res.json({ ok: true })
  } catch (e) { res.json({ ok: false, error: String(e) }) }
})

// ── POST /api/orbit/resolve ────────────────────────────────────────────────────
router.post('/api/orbit/resolve', async (req, res) => {
  try {
    const body = JSON.parse(await readBody(req)) as {
      ref: string; ctxBefore?: number; ctxAfter?: number
      supabaseUrl?: string; supabaseKey?: string; userId?: string
    }
    const { ref, ctxBefore = 2, ctxAfter = 2, supabaseUrl, supabaseKey, userId } = body
    const baseDir = path.join(process.cwd(), 'context', 'raw', 'chat')

    const readJsonl = (filePath: string): unknown[] =>
      fs.readFileSync(filePath, 'utf-8').split('\n').filter(l => l.trim())
        .map(l => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)

    const scanForChatFile = (matchFn: (id: string) => boolean): { filePath: string; chatId: string } | null => {
      try {
        for (const projId of fs.readdirSync(baseDir)) {
          const projDir = path.join(baseDir, projId)
          try { if (!fs.statSync(projDir).isDirectory()) continue } catch { continue }
          for (const file of fs.readdirSync(projDir).filter(f => f.endsWith('.jsonl'))) {
            const chatId = file.slice(0, -6)
            if (matchFn(chatId)) return { filePath: path.join(projDir, file), chatId }
          }
        }
      } catch { /* noop */ }
      return null
    }

    const colonIdx = ref.indexOf(':')
    if (colonIdx < 0) { res.json({ ok: false, error: 'Invalid ref format' }); return }
    const refType = ref.slice(0, colonIdx)
    const refId   = ref.slice(colonIdx + 1)

    if (refType === 'chat') {
      const found = scanForChatFile(id => id === refId)
      if (!found) { res.json({ ok: false, error: 'Chat not found' }); return }
      res.json({ ok: true, filePath: found.filePath, chatId: found.chatId, msgs: readJsonl(found.filePath).slice(0, 20) })
    } else if (refType === 'msg') {
      const chat6 = refId.split('-')[1] ?? ''
      const found = scanForChatFile(id => chat6 !== '' && id.replace(/-/g, '').includes(chat6))
      if (!found) { res.json({ ok: false, error: 'Message not found — chat not located' }); return }
      const msgs = readJsonl(found.filePath)
      const msgIdx = msgs.findIndex(m => (m as { id?: string }).id === refId)
      if (msgIdx < 0) { res.json({ ok: false, error: 'Message ID not found in file' }); return }
      res.json({ ok: true, filePath: found.filePath, chatId: found.chatId, refIdx: msgIdx,
        before: msgs.slice(Math.max(0, msgIdx - ctxBefore), msgIdx),
        target: msgs[msgIdx],
        after:  msgs.slice(msgIdx + 1, msgIdx + 1 + ctxAfter),
      })
    } else if (refType === 'amsg') {
      // Agent message from Supabase — requires credentials
      if (!supabaseUrl || !supabaseKey || !userId) {
        res.json({ ok: false, error: 'Supabase credentials required for amsg: refs' }); return
      }
      const { createClient } = await import('@supabase/supabase-js')
      const sb = createClient(supabaseUrl, supabaseKey)
      // Find the target message
      const { data: target } = await sb
        .from('agent_messages').select('id,session_id,role,content,ts')
        .eq('id', refId).eq('user_id', userId).maybeSingle()
      if (!target) { res.json({ ok: false, error: 'Agent message not found' }); return }
      // Fetch surrounding messages from the same session (ordered by ts)
      const { data: sessionMsgs } = await sb
        .from('agent_messages').select('id,session_id,role,content,ts')
        .eq('session_id', (target as { session_id: string }).session_id)
        .eq('user_id', userId)
        .order('ts', { ascending: true })
      const msgs = (sessionMsgs ?? []) as { id: string; session_id: string; role: string; content: string; ts: number }[]
      const msgIdx = msgs.findIndex(m => m.id === refId)
      res.json({
        ok: true,
        sessionId: (target as { session_id: string }).session_id,
        before: msgs.slice(Math.max(0, msgIdx - ctxBefore), msgIdx),
        target,
        after:  msgs.slice(msgIdx + 1, msgIdx + 1 + ctxAfter),
      })
    } else {
      res.json({ ok: false, error: `Unknown ref type: ${refType}` })
    }
  } catch (e) { res.json({ ok: false, error: String(e) }) }
})

// ── POST /api/file-write ───────────────────────────────────────────────────────
router.post('/api/file-write', async (req, res) => {
  try {
    const { path: filePath, content, executable } = JSON.parse(await readBody(req)) as { path: string; content: string; executable?: boolean }
    const resolved = tilde(filePath ?? '')
    fs.mkdirSync(path.dirname(resolved), { recursive: true })
    fs.writeFileSync(resolved, content, 'utf-8')
    if (executable) fs.chmodSync(resolved, 0o755)
    res.json({ ok: true })
  } catch (e) { res.json({ ok: false, error: String(e) }) }
})

// ── POST /api/fs-create ────────────────────────────────────────────────────────
router.post('/api/fs-create', async (req, res) => {
  try {
    const { path: target, type } = JSON.parse(await readBody(req)) as { path: string; type: 'file' | 'dir' }
    const resolved = tilde(target)
    if (type === 'dir') fs.mkdirSync(resolved, { recursive: true })
    else { fs.mkdirSync(path.dirname(resolved), { recursive: true }); if (!fs.existsSync(resolved)) fs.writeFileSync(resolved, '', 'utf-8') }
    res.json({ ok: true })
  } catch (e) { res.json({ ok: false, error: String(e) }) }
})

// ── POST /api/fs-delete ────────────────────────────────────────────────────────
router.post('/api/fs-delete', async (req, res) => {
  try {
    const { path: target } = JSON.parse(await readBody(req)) as { path: string }
    fs.rmSync(tilde(target), { recursive: true, force: true })
    res.json({ ok: true })
  } catch (e) { res.json({ ok: false, error: String(e) }) }
})

// ── GET /api/file-read ─────────────────────────────────────────────────────────
router.get('/api/file-read', (req, res) => {
  const filePath = tilde(req.query.path as string ?? '')
  try {
    const stat = fs.statSync(filePath)
    if (stat.size > 2 * 1024 * 1024) { res.json({ ok: false, error: 'File too large (> 2 MB)' }); return }
    res.json({ ok: true, content: fs.readFileSync(filePath, 'utf-8'), size: stat.size, mtime: stat.mtimeMs })
  } catch (e) { res.json({ ok: false, error: String(e) }) }
})

// ── GET /api/read-docs ─────────────────────────────────────────────────────────
router.get('/api/read-docs', (req, res) => {
  const projectPath = tilde(req.query.path as string ?? '')
  if (!projectPath) { res.json({ ok: false, error: 'missing path', files: [] }); return }
  const docsDir = path.join(projectPath, 'docs')
  const MAX_TOTAL = 80_000
  const files: { filename: string; content: string }[] = []
  const totalRef = { n: 0 }
  const readMdRecursive = (dir: string) => {
    let entries: fs.Dirent[]
    try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const e of entries) {
      if (totalRef.n >= MAX_TOTAL) break
      const full = path.join(dir, e.name)
      if (e.isDirectory()) readMdRecursive(full)
      else if (e.isFile() && /\.(md|txt)$/i.test(e.name)) {
        try { const c = fs.readFileSync(full, 'utf-8').slice(0, 20_000); files.push({ filename: full.replace(projectPath + '/', ''), content: c }); totalRef.n += c.length } catch { /* skip */ }
      }
    }
  }
  readMdRecursive(docsDir)
  if (files.length === 0) res.json({ ok: false, error: 'Keine Dokumentationsdateien unter docs/ gefunden', files: [] })
  else res.json({ ok: true, files })
})

// ── Admin User Management (proxies to Supabase with service role key) ──────────
async function sbFetch(supabaseUrl: string, serviceRoleKey: string, path: string, init: RequestInit = {}) {
  return fetch(`${supabaseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      ...(init.headers as Record<string, string> ?? {}),
    },
  })
}

router.get('/api/admin/users', async (req, res) => {
  const { supabaseUrl, serviceRoleKey } = req.query as Record<string, string>
  if (!supabaseUrl || !serviceRoleKey) { res.json({ ok: false, error: 'Missing credentials' }); return }
  try {
    const [usersR, adminsR] = await Promise.all([
      sbFetch(supabaseUrl, serviceRoleKey, '/auth/v1/admin/users?page=1&per_page=1000'),
      sbFetch(supabaseUrl, serviceRoleKey, '/rest/v1/admin_users?select=user_id'),
    ])
    const usersData = await usersR.json() as { users?: Record<string, unknown>[] }
    const adminsData = await adminsR.json() as { user_id: string }[]
    const adminIds = new Set(Array.isArray(adminsData) ? adminsData.map(a => a.user_id) : [])
    const users = (usersData.users ?? []).map((u: Record<string, unknown>) => ({
      id: u.id,
      email: u.email,
      firstName: (u.user_metadata as Record<string, string>)?.firstName ?? (u.user_metadata as Record<string, string>)?.first_name ?? '',
      lastName:  (u.user_metadata as Record<string, string>)?.lastName  ?? (u.user_metadata as Record<string, string>)?.last_name  ?? '',
      createdAt: u.created_at,
      lastSignIn: u.last_sign_in_at,
      isAdmin: adminIds.has(u.id as string),
    }))
    res.json({ ok: true, users })
  } catch (e) { res.json({ ok: false, error: String(e) }) }
})

router.post('/api/admin/users', async (req, res) => {
  try {
    const { supabaseUrl, serviceRoleKey, email, password, firstName, lastName } = JSON.parse(await readBody(req)) as Record<string, string>
    if (!supabaseUrl || !serviceRoleKey) { res.json({ ok: false, error: 'Missing credentials' }); return }
    const r = await sbFetch(supabaseUrl, serviceRoleKey, '/auth/v1/admin/users', {
      method: 'POST',
      body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { firstName, lastName } }),
    })
    const d = await r.json() as Record<string, unknown>
    if (d.id) res.json({ ok: true, user: d })
    else res.json({ ok: false, error: (d.msg ?? d.message ?? JSON.stringify(d)) as string })
  } catch (e) { res.json({ ok: false, error: String(e) }) }
})

router.put('/api/admin/users/:id', async (req, res) => {
  try {
    const { supabaseUrl, serviceRoleKey, email, firstName, lastName, password } = JSON.parse(await readBody(req)) as Record<string, string>
    if (!supabaseUrl || !serviceRoleKey) { res.json({ ok: false, error: 'Missing credentials' }); return }
    const payload: Record<string, unknown> = { user_metadata: { firstName, lastName } }
    if (email) payload.email = email
    if (password) payload.password = password
    const r = await sbFetch(supabaseUrl, serviceRoleKey, `/auth/v1/admin/users/${req.params.id}`, {
      method: 'PUT', body: JSON.stringify(payload),
    })
    const d = await r.json() as Record<string, unknown>
    res.json({ ok: !!d.id, error: d.id ? undefined : (d.msg ?? d.message) as string })
  } catch (e) { res.json({ ok: false, error: String(e) }) }
})

router.delete('/api/admin/users/:id', async (req, res) => {
  try {
    const { supabaseUrl, serviceRoleKey } = req.query as Record<string, string>
    if (!supabaseUrl || !serviceRoleKey) { res.json({ ok: false, error: 'Missing credentials' }); return }
    await sbFetch(supabaseUrl, serviceRoleKey, `/auth/v1/admin/users/${req.params.id}`, { method: 'DELETE' })
    res.json({ ok: true })
  } catch (e) { res.json({ ok: false, error: String(e) }) }
})

router.post('/api/admin/users/:id/admin', async (req, res) => {
  try {
    const { supabaseUrl, serviceRoleKey, grantedBy } = JSON.parse(await readBody(req)) as Record<string, string>
    if (!supabaseUrl || !serviceRoleKey) { res.json({ ok: false, error: 'Missing credentials' }); return }
    await sbFetch(supabaseUrl, serviceRoleKey, '/rest/v1/admin_users', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ user_id: req.params.id, granted_by: grantedBy }),
    })
    res.json({ ok: true })
  } catch (e) { res.json({ ok: false, error: String(e) }) }
})

router.delete('/api/admin/users/:id/admin', async (req, res) => {
  try {
    const { supabaseUrl, serviceRoleKey } = req.query as Record<string, string>
    if (!supabaseUrl || !serviceRoleKey) { res.json({ ok: false, error: 'Missing credentials' }); return }
    await sbFetch(supabaseUrl, serviceRoleKey, `/rest/v1/admin_users?user_id=eq.${req.params.id}`, { method: 'DELETE' })
    res.json({ ok: true })
  } catch (e) { res.json({ ok: false, error: String(e) }) }
})

// ── GET /api/installed-apps ────────────────────────────────────────────────────
let _appsCache: string[] | null = null
let _appsCacheAt = 0
router.get('/api/installed-apps', (_req, res) => {
  if (_appsCache && Date.now() - _appsCacheAt < 60_000) { res.json({ apps: _appsCache }); return }
  const dirs = ['/Applications', '/System/Applications', '/System/Applications/Utilities', `${process.env.HOME}/Applications`]
  const apps = new Set<string>()
  for (const dir of dirs) {
    try { for (const e of fs.readdirSync(dir)) { if (e.endsWith('.app')) apps.add(e.slice(0, -4)) } } catch { /* ignore */ }
  }
  _appsCache = [...apps]
  _appsCacheAt = Date.now()
  res.json({ apps: _appsCache })
})

// ── GET /api/open-with ─────────────────────────────────────────────────────────
router.get('/api/open-with', (req, res) => {
  const filePath = tilde(req.query.path as string ?? '')
  const app = req.query.app as string ?? ''
  if (!app) { res.json({ ok: false }); return }
  exec(`open -a ${JSON.stringify(app)} ${JSON.stringify(filePath)}`, err => res.json({ ok: !err, error: err?.message }))
})

// ── GET /api/check-port ────────────────────────────────────────────────────────
router.get('/api/check-port', (req, res) => {
  const port = parseInt(req.query.port as string ?? '0', 10)
  if (!port) { res.json({ ok: false, inUse: false }); return }
  exec(`lsof -ti tcp:${port}`, (err, stdout) => {
    if (err || !stdout.trim()) res.json({ ok: true, inUse: false })
    else res.json({ ok: true, inUse: true, pids: stdout.trim().split('\n').map(p => parseInt(p, 10)).filter(Boolean) })
  })
})

// ── POST /api/kill-port ────────────────────────────────────────────────────────
router.post('/api/kill-port', async (req, res) => {
  try {
    const { port } = JSON.parse(await readBody(req)) as { port: number }
    exec(`lsof -ti tcp:${port} | xargs kill -9 2>/dev/null; true`, () => res.json({ ok: true }))
  } catch (e) { res.json({ ok: false, error: String(e) }) }
})

// ── POST /api/start-app ────────────────────────────────────────────────────────
router.post('/api/start-app', async (req, res) => {
  try {
    const { projectPath, port, startCmd, extraPorts = [] } = JSON.parse(await readBody(req)) as {
      projectPath: string; port?: number; startCmd: string; extraPorts?: number[]
    }
    const logFile = `/tmp/cc-app-${port ?? 'unknown'}.log`

    // ── Kill by project CWD (catches all node/npm/python/bun processes in the dir) ──
    // Use ps + grep to find processes with the project path in their args or CWD
    const escaped = projectPath.replace(/'/g, "'\\''")
    const killByDir = `ps -eo pid,args | grep -E '(node|npm|yarn|pnpm|python3?|bun|deno|uvicorn|flask|cargo)' | grep '${escaped}' | grep -v grep | awk '{print $1}' | xargs kill -9 2>/dev/null; true`

    // ── Kill by all known ports (frontend + backend) ──
    const allPorts = [...new Set([port, ...extraPorts].filter((p): p is number => !!p))]
    const killByPorts = allPorts.length > 0
      ? allPorts.map(p => `lsof -ti tcp:${p} | xargs kill -9 2>/dev/null`).join('; ')
      : 'true'

    const killAll = `${killByDir}; ${killByPorts}`

    exec(killAll, () => {
      // Wait 400ms for processes to fully exit before spawning
      setTimeout(() => {
        const child = spawn('bash', ['-c', `cd ${JSON.stringify(projectPath)} && ${startCmd}`], {
          detached: true, stdio: ['ignore', fs.openSync(logFile, 'a'), fs.openSync(logFile, 'a')],
        })
        child.unref()
        // Open the primary port in default browser (macOS: `open`, fallback: ignore)
        if (port) setTimeout(() => exec(`open http://localhost:${port} 2>/dev/null || true`), 2500)
        res.json({ ok: true, pid: child.pid ?? 0, logFile })
      }, 400)
    })
  } catch (e) { res.json({ ok: false, error: String(e) }) }
})

// ── POST /api/ai-refine ────────────────────────────────────────────────────────
router.post('/api/ai-refine', async (req, res) => {
  try {
    const { provider, apiKey: rawApiKey, model, text, systemPrompt } = JSON.parse(await readBody(req)) as {
      provider: string; apiKey: string; model: string; text: string; systemPrompt?: string
    }
    const apiKey = rawApiKey.replace(/[^\x20-\x7E]/g, '').trim()
    const sysMsg = systemPrompt ?? 'Verbessere den folgenden Text sprachlich und inhaltlich. Mache ihn klarer, präziser und professioneller. Gib nur den verbesserten Text zurück, ohne Erklärungen oder zusätzliche Kommentare.'
    console.log('\n[ai-refine] ▶ provider:', provider, '| model:', model)

    type RefineUsage = { input_tokens?: number; output_tokens?: number; prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }

    if (provider === 'anthropic') {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model, max_tokens: 2048, system: sysMsg, messages: [{ role: 'user', content: text }] }),
      })
      const d = await r.json() as { content?: { text: string }[]; error?: { message: string }; usage?: RefineUsage }
      if (!r.ok) { res.json({ ok: false, error: d?.error?.message ?? 'API error' }); return }
      const u = d.usage ?? {}
      res.json({ ok: true, text: d.content?.[0]?.text ?? text, inputTokens: u.input_tokens ?? 0, outputTokens: u.output_tokens ?? 0 })
    } else {
      const baseUrl = provider === 'deepseek'   ? 'https://api.deepseek.com/v1'
              : provider === 'openrouter' ? 'https://openrouter.ai/api/v1'
              : provider === 'groq'       ? 'https://api.groq.com/openai/v1'
              : null
      if (!baseUrl) { res.json({ ok: false, error: `Unbekannter Provider: "${provider}". Bitte einen gültigen Provider wählen.` }); return }
      console.log(`[ai-refine] ▶ sending to ${baseUrl} | model: ${model}`)
      const r = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', ...(provider === 'openrouter' ? { 'HTTP-Referer': 'https://codera.ai', 'X-Title': 'Codera AI' } : {}) },
        body: JSON.stringify({ model, messages: [{ role: 'system', content: sysMsg }, { role: 'user', content: text }] }),
      })
      const d = await r.json() as { choices?: { message: { content: string } }[]; error?: { message: string }; usage?: RefineUsage }
      if (!r.ok) {
        const rawErr = d?.error?.message ?? 'API error'
        console.error(`[ai-refine] ✗ ${provider} HTTP ${r.status}: ${rawErr}`)
        const userErr = provider === 'openrouter' && r.status === 401
          ? `OpenRouter: Key ungültig/abgelaufen (HTTP 401). Bitte openrouter.ai/keys prüfen. Orig: ${rawErr.slice(0, 100)}`
          : provider === 'openrouter' && r.status === 402
          ? 'OpenRouter-Konto hat kein Guthaben. Bitte unter openrouter.ai/credits aufladen.'
          : provider === 'openrouter'
          ? `OpenRouter HTTP ${r.status}: ${rawErr}`
          : rawErr
        res.json({ ok: false, error: userErr }); return
      }
      const u = d.usage ?? {}
      const inputTokens  = u.input_tokens  ?? u.prompt_tokens  ?? 0
      const outputTokens = u.output_tokens ?? u.completion_tokens ?? (u.total_tokens ? u.total_tokens - inputTokens : 0)
      res.json({ ok: true, text: d.choices?.[0]?.message?.content ?? text, inputTokens, outputTokens })
    }
  } catch (e) { res.json({ ok: false, error: String(e) }) }
})

// ── POST /api/context-search ──────────────────────────────────────────────────
router.post('/api/context-search', async (req, res) => {
  try {
    const { query, messages, provider, apiKey: rawApiKey2, model, systemPromptOverride } = JSON.parse(await readBody(req)) as {
      query: string
      messages: Array<{ role: string; content: string; ts: number; model?: string; source: 'agent' | 'orbit' }>
      provider: string; apiKey: string; model: string
      systemPromptOverride?: string
    }
    const apiKey = rawApiKey2.replace(/[^\x20-\x7E]/g, '').trim()

    // Format messages as readable history block (newest last, truncate each to 600 chars)
    const historyText = messages
      .sort((a, b) => a.ts - b.ts)
      .map(m => {
        const date = new Date(m.ts).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })
        const src  = m.source === 'agent' ? 'AGENT' : 'ORBIT'
        const role = m.role === 'user' ? 'USER' : `AI${m.model ? ' (' + m.model + ')' : ''}`
        return `[${date}][${src}] ${role}:\n${m.content.slice(0, 600)}`
      })
      .join('\n\n---\n\n')

    const systemPrompt = systemPromptOverride?.trim() || `Du bist ein Kontext-Analyst für ein Software-Entwicklungsprojekt. Du bekommst die Chat-Historie und eine Suchanfrage.

Antworte AUSSCHLIESSLICH als gültiges JSON-Objekt (kein Markdown drumherum, nur reines JSON):
{
  "humanSummary": "2-4 Sätze: Was wurde gemacht, was ist der aktuelle Stand. Knapp und direkt — keine langen Absätze.",
  "detailed": "Stichpunktartige Auflistung (Bullet-Format mit •). Nur was relevant zur Suchanfrage ist. Bei Listen-Anfragen (z.B. 'welche X wurden aufgerufen') einfach alle aufzählen. Maximal 15 Punkte.",
  "agentContext": "Englischer Kontext-Block für einen KI-Agenten. Format: TOPIC: ... | FILES: ... | HISTORY: ... (kompakt, nur das Wesentliche, max 400 Tokens)"
}`

    const userMsg = `Suchanfrage: "${query}"\n\nProjekt-Chat-Historie (${messages.length} Nachrichten):\n\n${historyText}`

    type AIResult = { humanSummary: string; detailed: string; agentContext: string }
    type Usage = { input_tokens?: number; output_tokens?: number; prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }

    let rawText = ''
    let usage: Usage = {}

    if (provider === 'anthropic') {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model, max_tokens: 4096, system: systemPrompt, messages: [{ role: 'user', content: userMsg }] }),
      })
      const d = await r.json() as { content?: { text: string }[]; error?: { message: string }; usage?: Usage }
      if (!r.ok) { res.json({ ok: false, error: d?.error?.message ?? 'API error' }); return }
      rawText = d.content?.[0]?.text ?? ''
      usage = d.usage ?? {}
    } else {
      const baseUrl = provider === 'deepseek'   ? 'https://api.deepseek.com/v1'
        : provider === 'openrouter' ? 'https://openrouter.ai/api/v1'
        : provider === 'groq'       ? 'https://api.groq.com/openai/v1'
        : null
      if (!baseUrl) { res.json({ ok: false, error: `Unbekannter Provider: "${provider}"` }); return }
      const r = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', ...(provider === 'openrouter' ? { 'HTTP-Referer': 'https://codera.ai', 'X-Title': 'Codera AI' } : {}) },
        body: JSON.stringify({
          model,
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMsg }],
          max_tokens: 4096,
        }),
      })
      const d = await r.json() as { choices?: { message: { content: string } }[]; error?: { message: string }; usage?: Usage }
      if (!r.ok) {
        const rawErr = d?.error?.message ?? 'API error'
        const userErr = provider === 'openrouter' && r.status === 401
          ? `OpenRouter API-Key ungültig oder abgelaufen. Bitte unter openrouter.ai/keys prüfen. (${rawErr.slice(0, 80)})`
          : provider === 'openrouter' && r.status === 402
          ? 'OpenRouter-Konto hat kein Guthaben. Bitte unter openrouter.ai/credits aufladen.'
          : rawErr
        res.json({ ok: false, error: userErr }); return
      }
      rawText = d.choices?.[0]?.message?.content ?? ''
      usage = d.usage ?? {}
    }

    // Parse JSON — strip potential markdown fences
    const jsonStr = rawText.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()
    let result: AIResult
    try {
      result = JSON.parse(jsonStr) as AIResult
    } catch {
      res.json({ ok: false, error: 'KI hat kein gültiges JSON zurückgegeben. Rohtext: ' + rawText.slice(0, 200) }); return
    }

    const inputTokens  = usage.input_tokens  ?? usage.prompt_tokens  ?? 0
    const outputTokens = usage.output_tokens ?? usage.completion_tokens ?? (usage.total_tokens ? usage.total_tokens - inputTokens : 0)

    res.json({ ok: true, ...result, inputTokens, outputTokens })
  } catch (e) { res.json({ ok: false, error: String(e) }) }
})

// ── POST /api/transcribe ───────────────────────────────────────────────────────
router.post('/api/transcribe', async (req, res) => {
  const chunks: Buffer[] = []
  req.on('data', (c: Buffer) => chunks.push(c))
  req.on('end', async () => {
    try {
      const apiKey = (req.headers['x-api-key'] as string) || process.env.GROQ_API_KEY || ''
      const lang   = (req.headers['x-language'] as string) || 'de'
      if (!apiKey) { res.json({ ok: false, error: 'no api key' }); return }
      const provider = (req.headers['x-provider'] as string) || 'openai'
      const isGroq   = provider === 'groq'
      const audio    = Buffer.concat(chunks)
      const fd       = new FormData()
      fd.append('file', new Blob([audio], { type: 'audio/webm' }), 'recording.webm')
      fd.append('model', isGroq ? 'whisper-large-v3-turbo' : 'whisper-1')
      fd.append('language', lang)
      const baseUrl = isGroq ? 'https://api.groq.com/openai/v1' : 'https://api.openai.com/v1'
      const r = await fetch(`${baseUrl}/audio/transcriptions`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}` },
        body: fd,
      })
      const d = await r.json() as { text?: string; error?: { message: string } }
      if (!r.ok) { res.json({ ok: false, error: d?.error?.message ?? 'Whisper error' }); return }
      res.json({ ok: true, text: d.text })
    } catch (e) { res.json({ ok: false, error: String(e) }) }
  })
})

// ── GET /api/serve-image ───────────────────────────────────────────────────────
router.get('/api/serve-image', (req, res) => {
  const filePath = tilde(req.query.path as string ?? '')
  if (!filePath) { res.status(400).send('missing path'); return }
  try {
    const stat = fs.statSync(filePath)
    if (stat.size > 20 * 1024 * 1024) { res.status(413).send('too large'); return }
    const ext = path.extname(filePath).toLowerCase()
    const mime: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml' }
    res.setHeader('Content-Type', mime[ext] ?? 'application/octet-stream')
    res.setHeader('Cache-Control', 'private, max-age=86400')
    res.send(fs.readFileSync(filePath))
  } catch { res.status(404).send('not found') }
})

// ── GET /api/serve-local ──────────────────────────────────────────────────────
// Serves files from ~/Documents/Codera/var/ for locally saved attachments
router.get('/api/serve-local', (req, res) => {
  const filePath = tilde(req.query.path as string ?? '')
  if (!filePath) { res.status(400).send('missing path'); return }
  // Security: only allow serving from the Codera var dir
  const allowed = path.join(home(), 'Documents', 'Codera', 'var')
  if (!filePath.startsWith(allowed)) { res.status(403).send('forbidden'); return }
  try {
    const stat = fs.statSync(filePath)
    if (stat.size > 50 * 1024 * 1024) { res.status(413).send('too large'); return }
    const ext = path.extname(filePath).replace(/^\d+-/, '').toLowerCase()
    const mime: Record<string, string> = {
      '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg',
      '.gif':'image/gif', '.webp':'image/webp', '.svg':'image/svg+xml',
      '.avif':'image/avif', '.bmp':'image/bmp',
      '.pdf':'application/pdf', '.json':'application/json',
      '.txt':'text/plain', '.md':'text/plain', '.mdx':'text/plain',
      '.csv':'text/csv', '.xml':'text/xml', '.yaml':'text/plain', '.yml':'text/plain',
      '.ts':'text/plain', '.tsx':'text/plain', '.js':'text/plain', '.jsx':'text/plain',
      '.css':'text/plain', '.html':'text/html', '.sql':'text/plain', '.log':'text/plain',
    }
    res.setHeader('Content-Type', mime[ext] ?? 'application/octet-stream')
    res.setHeader('Cache-Control', 'private, max-age=3600')
    res.send(fs.readFileSync(filePath))
  } catch { res.status(404).send('not found') }
})

// ── POST /api/write-temp-image ─────────────────────────────────────────────────
router.post('/api/write-temp-image', (req, res) => {
  const chunks: Buffer[] = []
  req.on('data', (c: Buffer) => chunks.push(c))
  req.on('end', () => {
    try {
      const fileName = decodeURIComponent((req.headers['x-file-name'] as string) ?? 'image')
      const safeName = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '_')
      const filePath = path.join(coderaVarDir(), `${Date.now()}-${safeName}`)
      fs.writeFileSync(filePath, Buffer.concat(chunks))
      res.json({ ok: true, path: filePath })
    } catch (e) { res.json({ ok: false, error: String(e) }) }
  })
})

// ── R2 upload + proxy ──────────────────────────────────────────────────────────
const readStore = () => {
  const storePath = path.join(home(), '.cc-ui-data.json')
  try { return (JSON.parse(fs.readFileSync(storePath, 'utf8')) as { state?: Record<string, string> })?.state ?? {} }
  catch { return {} as Record<string, string> }
}

router.post('/api/r2-upload', (req, res) => {
  // Saves locally to ~/Documents/Codera/var/ — no CDN upload
  const chunks: Buffer[] = []
  req.on('data', (c: Buffer) => chunks.push(c))
  req.on('end', () => {
    try {
      const fileName = decodeURIComponent((req.headers['x-file-name'] as string) ?? 'file')
      const safeName = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '_')
      const filePath = path.join(coderaVarDir(), `${Date.now()}-${safeName}`)
      fs.writeFileSync(filePath, Buffer.concat(chunks))
      // Return a local serve URL — accessible by the frontend (same host)
      const fileUrl = `/api/serve-local?path=${encodeURIComponent(filePath)}`
      res.json({ ok: true, url: fileUrl })
    } catch (e) { res.status(500).json({ ok: false, error: String(e) }) }
  })
})

router.get('/api/r2-proxy', async (req, res) => {
  const key = req.query.key as string ?? ''
  if (!key) { res.status(400).send('missing key'); return }
  try {
    const store = readStore()
    const bucket = store['cloudflareR2BucketName'] ?? ''; const accessKey = store['cloudflareR2AccessKeyId'] ?? ''; const secretKey = store['cloudflareR2SecretAccessKey'] ?? ''
    const r2Endpoint = store['cloudflareR2Endpoint'] || (store['cloudflareAccountId'] ? `https://${store['cloudflareAccountId']}.r2.cloudflarestorage.com` : '')
    if (!r2Endpoint || !bucket || !accessKey || !secretKey) { res.status(503).send('R2 not configured'); return }
    const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3')
    const s3 = new S3Client({ region: 'auto', endpoint: r2Endpoint, forcePathStyle: true, credentials: { accessKeyId: accessKey, secretAccessKey: secretKey } })
    const result = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
    const ext = key.split('.').pop()?.toLowerCase() ?? ''
    const mimeMap: Record<string, string> = { png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp',svg:'image/svg+xml',avif:'image/avif',bmp:'image/bmp',pdf:'application/pdf',json:'application/json',txt:'text/plain',md:'text/plain' }
    const ct = (result.ContentType && result.ContentType !== 'application/octet-stream') ? result.ContentType : (mimeMap[ext] ?? 'application/octet-stream')
    res.setHeader('Content-Type', ct); res.setHeader('Cache-Control', 'public, max-age=3600')
    if (result.ContentLength) res.setHeader('Content-Length', result.ContentLength)
    const body = result.Body
    if (body && typeof (body as { pipe?: unknown }).pipe === 'function') (body as NodeJS.ReadableStream).pipe(res)
    else if (body && typeof (body as { transformToByteArray?: unknown }).transformToByteArray === 'function') res.end(Buffer.from(await (body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray()))
    else { res.status(404).send('empty body') }
  } catch (e) { res.status(500).send(String(e)) }
})

// ── tweakcc ────────────────────────────────────────────────────────────────────
router.all('/api/tweakcc/config', async (req, res) => {
  try {
    const { readTweakccConfig, getTweakccConfigPath } = await import('tweakcc')
    if (req.method === 'GET') {
      res.json({ ok: true, config: await readTweakccConfig() })
    } else {
      const { config } = JSON.parse(await readBody(req)) as { config: unknown }
      const configPath = getTweakccConfigPath()
      fs.mkdirSync(path.dirname(configPath), { recursive: true })
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
      res.json({ ok: true })
    }
  } catch (e) { res.json({ ok: false, error: String(e) }) }
})

router.post('/api/tweakcc/apply', async (_req, res) => {
  try {
    const { execSync } = await import('child_process')
    execSync('npx tweakcc --apply', { cwd: process.cwd(), stdio: 'ignore' })
    res.json({ ok: true })
  } catch (e) { res.json({ ok: false, error: String(e) }) }
})

router.all('/api/tweakcc/system-prompt', async (req, res) => {
  try {
    const { getTweakccSystemPromptsDir } = await import('tweakcc')
    const dir  = getTweakccSystemPromptsDir()
    const file = path.join(dir, 'codera.md')
    if (req.method === 'GET') {
      res.json({ ok: true, content: fs.existsSync(file) ? fs.readFileSync(file, 'utf-8') : '' })
    } else {
      const { content } = JSON.parse(await readBody(req)) as { content: string }
      fs.mkdirSync(dir, { recursive: true })
      if (content.trim()) fs.writeFileSync(file, content, 'utf-8')
      else if (fs.existsSync(file)) fs.unlinkSync(file)
      res.json({ ok: true })
    }
  } catch (e) { res.json({ ok: false, error: String(e) }) }
})

// ── GET /api/perm-pending?sessionId=X ─────────────────────────────────────────
// Polling fallback: frontend polls this every 2s to catch any permissions that
// the WS push may have missed (buffered, disconnected, etc.)
router.get('/api/perm-pending', (req, res) => {
  const sessionId = req.query.sessionId as string ?? ''
  res.json({ perms: pendingPermsBySession.get(sessionId) ?? [] })
})

// ── POST /api/perm-bridge ──────────────────────────────────────────────────────
// Called by permission-mcp.cjs; long-polls until user decides
router.post('/api/perm-bridge', async (req, res) => {
  try {
    const { sessionId, requestId, toolName, input } = JSON.parse(await readBody(req)) as {
      sessionId: string; requestId: string; toolName: string; input: Record<string, unknown>
    }

    const payload = JSON.stringify({ type: 'permission_request', requestId, toolName, input, toolUseId: '' })

    // Store for polling fallback — client polls /api/perm-pending every 2s
    const sessionPerms = pendingPermsBySession.get(sessionId) ?? []
    sessionPerms.push({ requestId, toolName, input })
    pendingPermsBySession.set(sessionId, sessionPerms)

    // Also push via WS (fast path) + retry every 2s in case WS was busy/disconnected
    const tryNotify = () => {
      const ws = sessionWs.get(sessionId)
      if (ws?.readyState === 1) ws.send(payload)
    }
    tryNotify()
    const retryInterval = setInterval(() => {
      if (!pendingPerms.has(requestId)) { clearInterval(retryInterval); return }
      tryNotify()
    }, 2000)

    const timer = setTimeout(() => {
      clearInterval(retryInterval)
      pendingPerms.delete(requestId)
      // Remove from polling map too
      const remaining = (pendingPermsBySession.get(sessionId) ?? []).filter(p => p.requestId !== requestId)
      if (remaining.length) pendingPermsBySession.set(sessionId, remaining)
      else pendingPermsBySession.delete(sessionId)
      res.json({ allow: false, message: 'Timeout' })
    }, 300_000)

    pendingPerms.set(requestId, decision => {
      clearTimeout(timer)
      clearInterval(retryInterval)
      pendingPerms.delete(requestId)
      const remaining = (pendingPermsBySession.get(sessionId) ?? []).filter(p => p.requestId !== requestId)
      if (remaining.length) pendingPermsBySession.set(sessionId, remaining)
      else pendingPermsBySession.delete(sessionId)
      res.json(decision)
    })
  } catch { res.status(400).end() }
})

// ── POST /api/screenshot ──────────────────────────────────────────────────────
// Uses Playwright (headless Chromium) to capture a given URL.
// Body: { url: string, width?: number, height?: number }
// Returns: { ok: true, dataUrl: 'data:image/png;base64,...' }
//       or { ok: false, error: string }
router.post('/api/screenshot', async (req, res) => {
  const body = await readBody(req)
  let url = '', width = 1280, height = 800
  try {
    const parsed = JSON.parse(body)
    url    = String(parsed.url ?? '')
    width  = Math.round(Number(parsed.width)  || 1280)
    height = Math.round(Number(parsed.height) || 800)
  } catch {
    res.status(400).json({ ok: false, error: 'Invalid JSON' }); return
  }
  if (!url) { res.status(400).json({ ok: false, error: 'url required' }); return }

  try {
    // Dynamic import so the module is not loaded at startup (keeps boot fast)
    const { chromium } = await import('playwright')
    const browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({
      viewport: { width, height },
      // Bypass CSP so localhost pages with strict CSP still render
      bypassCSP: true,
    })
    const page = await context.newPage()
    // Use 'load' (not 'networkidle') — networkidle never fires for apps with
    // WebSockets / SSE / polling (e.g. dev servers, real-time apps).
    await page.goto(url, { waitUntil: 'load', timeout: 15_000 })
    // Small extra delay so React / hydration finishes rendering
    await page.waitForTimeout(600)
    const buffer = await page.screenshot({ type: 'png', fullPage: false })
    await browser.close()
    res.json({ ok: true, dataUrl: 'data:image/png;base64,' + buffer.toString('base64') })
  } catch (err) {
    const msg = String(err)
    const needsInstall = msg.includes("Executable doesn't exist") || msg.includes('browserType.launch')
    res.status(500).json({
      ok: false,
      error: needsInstall
        ? 'Playwright-Browser fehlt — bitte im Terminal ausführen: npx playwright install chromium'
        : msg,
    })
  }
})

// ── GET /api/git-diff ─────────────────────────────────────────────────────────
router.get('/api/git-diff', (req, res) => {
  const cwd    = tilde(req.query.path   as string ?? '')
  const file   = req.query.file         as string ?? ''
  const commit = req.query.commit       as string ?? ''
  if (!cwd || !file) { res.json({ ok: false, diff: '' }); return }
  const run = (cmd: string) => new Promise<string>(ok =>
    exec(cmd, { cwd }, (err, out, errOut) => ok(err ? errOut || err.message : out))
  )
  ;(async () => {
    try {
      let diff = ''
      if (commit) {
        diff = await run(`git diff ${commit}^..${commit} -- ${JSON.stringify(file)} 2>/dev/null`)
      } else {
        const statusOut = await run(`git status --porcelain -- ${JSON.stringify(file)}`)
        const flag = statusOut.trim().slice(0, 2)
        const isNew = flag === '??' || flag.startsWith('A')
        if (isNew) {
          const fullPath = path.resolve(cwd, file)
          const content = fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf-8') : ''
          const lines = content.split('\n')
          diff = `--- /dev/null\n+++ b/${file}\n@@ -0,0 +1,${lines.length} @@\n` + lines.map((l: string) => '+' + l).join('\n')
        } else {
          diff = await run(`git diff HEAD -- ${JSON.stringify(file)}`)
          if (!diff.trim()) diff = await run(`git diff --cached -- ${JSON.stringify(file)}`)
        }
      }
      res.json({ ok: true, diff })
    } catch (e) { res.json({ ok: false, diff: '', error: String(e) }) }
  })()
})

export default router
