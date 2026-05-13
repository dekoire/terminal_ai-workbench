/**
 * All REST API routes — extracted from vite.config.ts apiPlugin()
 * Mounted at / in the Express app (paths already start with /api/…)
 */
import { Router } from 'express'
import { exec, spawn }  from 'child_process'
import fs               from 'fs'
import path             from 'path'
import { tmpdir }        from 'os'
import { fileURLToPath } from 'url'
import { pendingPerms, sessionWs, pendingPermsBySession } from '../state.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

const router = Router()

// ── helpers ────────────────────────────────────────────────────────────────────
const home = () => process.env.HOME ?? '/Users/' + (process.env.USER ?? '')
const tilde = (p: string) => p.replace(/^~/, home())

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
    let content = ''
    try { content = fs.readFileSync(zshrcPath, 'utf-8') } catch { /* new file */ }
    const filtered = content.split('\n').filter(l => !l.match(new RegExp(`^\\s*alias\\s+${aliasName}=`))).join('\n')
    fs.writeFileSync(zshrcPath, filtered.trimEnd() + '\n' + line + '\n', 'utf-8')
    res.json({ ok: true })
  } catch (e) { res.json({ ok: false, error: String(e) }) }
})

// ── GET /api/store-read ────────────────────────────────────────────────────────
router.get('/api/store-read', (_req, res) => {
  const filePath = path.join(home(), '.cc-ui-data.json')
  try { res.send(fs.readFileSync(filePath, 'utf-8') || 'null') }
  catch { res.send('null') }
})

// ── POST /api/store-write ──────────────────────────────────────────────────────
router.post('/api/store-write', async (req, res) => {
  const filePath = path.join(home(), '.cc-ui-data.json')
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
    const [status, log, branches, diffStat, remotes, lastCommit] = await Promise.all([
      run('git status --short'),
      run('git log --oneline -20 --pretty=format:"%h|%s|%an|%ar|%ai"'),
      run('git branch -v --format="%(refname:short)|%(objectname:short)|%(subject)|%(HEAD)"'),
      run('git diff --stat HEAD 2>/dev/null | tail -1'),
      run('git remote -v | head -2'),
      run('git log -1 --format="%ar"'),
    ])
    res.json({
      hasGit: true,
      status:   status.split('\n').filter(Boolean).map(l => ({ flag: l.slice(0,2).trim(), file: l.slice(3) })),
      log:      log.split('\n').filter(Boolean).map(l => { const p = l.split('|'); return { hash: p[0], msg: p[1], author: p[2], when: p[3], date: p[4] } }),
      branches: branches.split('\n').filter(Boolean).map(l => { const p = l.split('|'); return { name: p[0], hash: p[1], msg: p[2], current: p[3] === '*' } }),
      diffStat, remotes: [...new Set(remotes.split('\n').filter(Boolean).map(l => l.split('\t')[0]))], lastCommit,
    })
  }).catch(e => res.json({ hasGit: false, error: String(e), status: [], log: [], branches: [], remotes: [], diffStat: '', lastCommit: '' }))
})

router.post('/api/git-action', async (req, res) => {
  try {
    const { action, path: cwd, message, remote, branch } = JSON.parse(await readBody(req)) as { action: string; path: string; message?: string; remote?: string; branch?: string }
    const resolved = tilde(cwd)
    const run = (cmd: string) => new Promise<string>(ok =>
      exec(cmd, { cwd: resolved }, (err, out, errOut) => ok(err ? errOut || err.message : out.trim()))
    )
    let result = { ok: false, out: 'unknown action' }
    if (action === 'stage')      result = { ok: true, out: await run('git add -A') }
    if (action === 'commit')     result = { ok: true, out: await run(`git commit -m ${JSON.stringify(message ?? 'Update')}`) }
    if (action === 'push')       result = { ok: true, out: await run(`git push ${remote ?? 'origin'} ${branch ?? 'HEAD'}`) }
    if (action === 'push-u')     result = { ok: true, out: await run(`git push -u origin ${JSON.stringify(branch ?? 'main')}`) }
    if (action === 'pull')       result = { ok: true, out: await run('git pull') }
    if (action === 'checkout')   result = { ok: true, out: await run(`git checkout ${JSON.stringify(branch ?? '')}`) }
    if (action === 'new-branch') result = { ok: true, out: await run(`git checkout -b ${JSON.stringify(branch ?? '')}`) }
    if (action === 'init') {
      const o1 = await run('git init')
      const o2 = await run(`git checkout -b ${JSON.stringify(branch ?? 'main')}`)
      result = { ok: true, out: o1 + '\n' + o2 }
    }
    if (action === 'add-remote' && remote) result = { ok: true, out: await run(`git remote add origin ${JSON.stringify(remote)}`) }
    if (action === 'clone' && remote) {
      // clone into the path itself — use parent dir + folder name
      const parentDir = path.dirname(resolved)
      const folderName = path.basename(resolved)
      const cloneRun = (cmd: string) => new Promise<string>(ok =>
        exec(cmd, { cwd: parentDir }, (err, out, errOut) => ok(err ? errOut || err.message : out.trim()))
      )
      result = { ok: true, out: await cloneRun(`git clone ${JSON.stringify(remote)} ${JSON.stringify(folderName)}`) }
    }
    if (action === 'discard-file' && message) {
      const statusOut = await run(`git status --porcelain -- ${JSON.stringify(message)}`)
      const flag = statusOut.trim().slice(0, 2)
      if (flag === '??' || flag.startsWith('A')) {
        const fullPath = path.resolve(resolved, message)
        try { fs.unlinkSync(fullPath); result = { ok: true, out: '' } } catch (e) { result = { ok: false, out: String(e) } }
      } else {
        const out = await run(`git checkout HEAD -- ${JSON.stringify(message)}`)
        result = { ok: !out.includes('error:'), out }
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
    const { provider, apiKey, model, text, systemPrompt } = JSON.parse(await readBody(req)) as {
      provider: string; apiKey: string; model: string; text: string; systemPrompt?: string
    }
    const sysMsg = systemPrompt ?? 'Verbessere den folgenden Text sprachlich und inhaltlich. Mache ihn klarer, präziser und professioneller. Gib nur den verbesserten Text zurück, ohne Erklärungen oder zusätzliche Kommentare.'
    console.log('\n[ai-refine] ▶ provider:', provider, '| model:', model)

    if (provider === 'anthropic') {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model, max_tokens: 2048, system: sysMsg, messages: [{ role: 'user', content: text }] }),
      })
      const d = await r.json() as { content?: { text: string }[]; error?: { message: string } }
      if (!r.ok) { res.json({ ok: false, error: d?.error?.message ?? 'API error' }); return }
      res.json({ ok: true, text: d.content?.[0]?.text ?? text })
    } else {
      const baseUrl = provider === 'deepseek' ? 'https://api.deepseek.com/v1' : 'https://api.openai.com/v1'
      const r = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages: [{ role: 'system', content: sysMsg }, { role: 'user', content: text }] }),
      })
      const d = await r.json() as { choices?: { message: { content: string } }[]; error?: { message: string } }
      if (!r.ok) { res.json({ ok: false, error: d?.error?.message ?? 'API error' }); return }
      res.json({ ok: true, text: d.choices?.[0]?.message?.content ?? text })
    }
  } catch (e) { res.json({ ok: false, error: String(e) }) }
})

// ── POST /api/context-search ──────────────────────────────────────────────────
router.post('/api/context-search', async (req, res) => {
  try {
    const { query, messages, provider, apiKey, model, systemPromptOverride } = JSON.parse(await readBody(req)) as {
      query: string
      messages: Array<{ role: string; content: string; ts: number; model?: string; source: 'agent' | 'orbit' }>
      provider: string; apiKey: string; model: string
      systemPromptOverride?: string
    }

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
      const baseUrl = provider === 'deepseek' ? 'https://api.deepseek.com/v1'
        : provider === 'groq' ? 'https://api.groq.com/openai/v1'
        : 'https://api.openai.com/v1'
      const r = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMsg }],
          max_tokens: 4096,
          response_format: provider === 'openai' ? { type: 'json_object' } : undefined,
        }),
      })
      const d = await r.json() as { choices?: { message: { content: string } }[]; error?: { message: string }; usage?: Usage }
      if (!r.ok) { res.json({ ok: false, error: d?.error?.message ?? 'API error' }); return }
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
      const apiKey = req.headers['x-api-key'] as string
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

// ── POST /api/write-temp-image ─────────────────────────────────────────────────
router.post('/api/write-temp-image', (req, res) => {
  const chunks: Buffer[] = []
  req.on('data', (c: Buffer) => chunks.push(c))
  req.on('end', () => {
    try {
      const fileName = decodeURIComponent((req.headers['x-file-name'] as string) ?? 'image')
      const safeName = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '_')
      const tmpPath  = path.join(tmpdir(), `cc-ui-img-${Date.now()}-${safeName}`)
      fs.writeFileSync(tmpPath, Buffer.concat(chunks))
      res.json({ ok: true, path: tmpPath })
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
  const chunks: Buffer[] = []
  req.on('data', (c: Buffer) => chunks.push(c))
  req.on('end', async () => {
    try {
      const store = readStore()
      const bucket = store['cloudflareR2BucketName'] ?? ''; const accessKey = store['cloudflareR2AccessKeyId'] ?? ''; const secretKey = store['cloudflareR2SecretAccessKey'] ?? ''
      const r2Endpoint = store['cloudflareR2Endpoint'] || (store['cloudflareAccountId'] ? `https://${store['cloudflareAccountId']}.r2.cloudflarestorage.com` : '')
      const publicUrl  = (store['cloudflareR2PublicUrl'] as string ?? '').replace(/\/$/, '')
      if (!r2Endpoint || !bucket || !accessKey || !secretKey) { res.status(400).json({ ok: false, error: 'Cloudflare R2 nicht konfiguriert.' }); return }
      const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3')
      const s3 = new S3Client({ region: 'auto', endpoint: r2Endpoint, forcePathStyle: true, credentials: { accessKeyId: accessKey, secretAccessKey: secretKey } })
      const fileName = decodeURIComponent((req.headers['x-file-name'] as string) ?? 'file')
      const userId   = (req.headers['x-user-id'] as string) ?? 'anonymous'
      const folder   = (req.headers['x-folder'] as string) ?? 'image-text-context'
      const mimeType = (req.headers['content-type'] as string) ?? 'application/octet-stream'
      const key = `${userId}/${folder}/${Date.now()}-${path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '_')}`
      await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: Buffer.concat(chunks), ContentType: mimeType }))
      // Use public URL if configured (no proxy), otherwise fall back to local proxy
      const fileUrl = publicUrl ? `${publicUrl}/${key}` : `/api/r2-proxy?key=${encodeURIComponent(key)}`
      res.json({ ok: true, url: fileUrl, key })
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
