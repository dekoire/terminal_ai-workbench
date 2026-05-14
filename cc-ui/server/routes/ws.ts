/**
 * WebSocket handlers for /ws/terminal and /ws/agent
 * Attached to the shared http.Server in server/index.ts
 */
import { createRequire } from 'module'
import fs   from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import { WebSocketServer } from 'ws'

const _require = createRequire(import.meta.url)
import type { WebSocket } from 'ws'
import type { IncomingMessage } from 'http'
import type { Socket }          from 'net'

import { pendingPerms, sessionWs, claudeSessionIds, activePtys } from '../state.js'

// permission-mcp.cjs lives next to package.json (project root → two levels up from server/routes/)
const PROJECT_ROOT = process.env.APP_ROOT ?? process.cwd()
const MCP_SCRIPT   = path.join(PROJECT_ROOT, 'permission-mcp.cjs')
const BACKEND_PORT = 2003   // Express port that permission-mcp must call back

// ── terminal ──────────────────────────────────────────────────────────────────

const PTY_SCROLLBACK = 50_000

interface PtySession {
  pty: import('node-pty').IPty
  clients: Set<WebSocket>
  scrollback: string
}

const sessions = new Map<string, PtySession>()
const terminalWss = new WebSocketServer({ noServer: true })

terminalWss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
  const url       = new URL(req.url ?? '/', 'http://localhost')
  const sessionId = url.searchParams.get('sessionId') ?? 'default'

  // Reconnect — replay scrollback
  const existing = sessions.get(sessionId)
  if (existing) {
    existing.clients.add(ws)
    if (existing.scrollback) {
      ws.send(JSON.stringify({ type: 'data', data: existing.scrollback }))
    }
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as Record<string, unknown>
        if (msg.type === 'input')  existing.pty.write(String(msg.data))
        if (msg.type === 'resize') existing.pty.resize(Number(msg.cols) || 80, Number(msg.rows) || 24)
      } catch {}
    })
    ws.on('close', () => existing.clients.delete(ws))
    return
  }

  // First connection — wait for init message
  ws.once('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString()) as Record<string, unknown>
      if (msg.type !== 'init') return

      const cmd  = String(msg.cmd ?? 'zsh')
      const args = String(msg.args ?? '').trim()
      const cwd  = String(msg.cwd ?? process.env.HOME ?? '~').replace(/^~/, process.env.HOME ?? '/')
      const cols = Number(msg.cols) || 120
      const rows = Number(msg.rows) || 36

      const safePath = [
        '/opt/homebrew/bin', '/opt/homebrew/sbin',
        '/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin',
        process.env.PATH ?? '',
      ].filter(Boolean).join(':')

      const pty    = _require('node-pty') as typeof import('node-pty')
      const ptyEnv = {
        ...(process.env as Record<string, string>),
        PATH: safePath,
        TERM: 'xterm-256color',
        TERM_PROGRAM: 'Apple_Terminal',
        COLORTERM: 'truecolor',
        PYTHONUNBUFFERED: '1',
        PYTHONIOENCODING: 'utf-8',
      }

      const ptyProc = pty.spawn('/bin/zsh', ['-li'], {
        name: 'xterm-256color',
        cols, rows, cwd,
        env: ptyEnv,
      })

      const session: PtySession = { pty: ptyProc, clients: new Set([ws]), scrollback: '' }
      sessions.set(sessionId, session)

      // Auto-type the requested command after the shell is ready
      if (!(cmd === 'zsh' && !args)) {
        const fullCmd = args ? `${cmd} ${args}` : cmd
        setTimeout(() => {
          try { ptyProc.write(`${fullCmd}\r`) } catch {}
        }, 600)
      }

      const broadcast = (data: string) => {
        session.scrollback = (session.scrollback + data).slice(-PTY_SCROLLBACK)
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

      ws.on('message', (raw2) => {
        try {
          const m = JSON.parse(raw2.toString()) as Record<string, unknown>
          if (m.type === 'input')  ptyProc.write(String(m.data))
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

// ── agent ─────────────────────────────────────────────────────────────────────

const agentWss = new WebSocketServer({ noServer: true })

agentWss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
  const url       = new URL(req.url ?? '/', 'http://localhost')
  const sessionId = url.searchParams.get('sessionId') ?? 'default'

  sessionWs.set(sessionId, ws)
  ws.on('close', () => sessionWs.delete(sessionId))

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString()) as Record<string, unknown>

      // Raw keystroke passthrough
      if (msg.type === 'input') {
        activePtys.get(sessionId)?.write(String(msg.data))
        return
      }

      // Permission response → resolve pending MCP bridge request
      if (msg.type === 'permission_response') {
        const requestId = String(msg.requestId ?? '')
        const allow     = String(msg.allow) === 'true'
        const resolve   = pendingPerms.get(requestId)
        if (resolve) {
          resolve({
            allow,
            updatedInput: msg.updatedInput as Record<string, unknown> | undefined,
            message: msg.message ? String(msg.message) : undefined,
          })
        } else {
          // Fallback: Claude used the old terminal-based permission prompt (stdin Y/N).
          // Write the decision directly to the PTY stdin so Claude can continue.
          const ap = activePtys.get(sessionId)
          if (ap) ap.write(allow ? 'y\n' : 'n\n')
        }
        return
      }

      // Clear session → forget Claude session ID so next run starts fresh
      if (msg.type === 'clear_session') {
        claudeSessionIds.delete(sessionId)
        return
      }

      // Cancel → kill active PTY
      if (msg.type === 'cancel') {
        const ap = activePtys.get(sessionId)
        if (ap) {
          try { ap.kill() } catch {}
          activePtys.delete(sessionId)
        }
        ws.send(JSON.stringify({ type: 'exit', exitCode: -1 }))
        return
      }

      if (msg.type !== 'message') return

      // ── spawn Claude for this message ─────────────────────────────────────
      const rawText              = String(msg.text ?? '')
      const cwd                  = String(msg.cwd ?? process.env.HOME ?? '~').replace(/^~/, process.env.HOME ?? '/')

      // Extract --image flags from the prompt text so they become proper CLI args.
      // Claude Code CLI requires --image as a top-level argument, NOT embedded in --print.
      const imagePaths: string[] = []
      const IMAGE_FLAG_RE_SRV = /--image\s+"([^"]+)"|--image\s+'([^']+)'|--image\s+(\S+)/g
      const text = rawText.replace(IMAGE_FLAG_RE_SRV, (_match, q1, q2, bare) => {
        const p = (q1 ?? q2 ?? bare ?? '').trim()
        if (p) imagePaths.push(p)
        return ''
      }).trim()
      const orModel              = msg.orModel              ? String(msg.orModel)              : null
      const orKey                = msg.orKey                ? String(msg.orKey)                : null
      const providerSettingsJson = msg.providerSettingsJson ? String(msg.providerSettingsJson) : null

      const resume = claudeSessionIds.get(sessionId)

      const safePath = [
        '/opt/homebrew/bin', '/opt/homebrew/sbin',
        '/usr/local/bin', '/usr/bin', '/bin',
        process.env.PATH ?? '',
      ].filter(Boolean).join(':')

      const baseEnv: Record<string, string> = {
        ...(process.env as Record<string, string>),
        PATH: safePath,
      }

      let settingsFile: string | null = null

      if (providerSettingsJson) {
        // Apply env block from provider settings
        try {
          const ps = JSON.parse(providerSettingsJson) as { env?: Record<string, string> }
          if (ps.env && typeof ps.env === 'object') {
            for (const [k, v] of Object.entries(ps.env)) {
              if (typeof v === 'string') baseEnv[k] = v
            }
          }
        } catch {}

        // Enforce Bearer auth for custom providers
        if (baseEnv['ANTHROPIC_API_KEY'] && !baseEnv['ANTHROPIC_AUTH_TOKEN']) {
          baseEnv['ANTHROPIC_AUTH_TOKEN'] = baseEnv['ANTHROPIC_API_KEY']
        }
        baseEnv['ANTHROPIC_API_KEY'] = ''

        // Write cleaned settings file
        try {
          const ps = JSON.parse(providerSettingsJson) as { env?: Record<string, string>; [k: string]: unknown }
          if (ps.env) {
            if (ps.env['ANTHROPIC_API_KEY'] && !ps.env['ANTHROPIC_AUTH_TOKEN']) {
              ps.env['ANTHROPIC_AUTH_TOKEN'] = ps.env['ANTHROPIC_API_KEY']
            }
            ps.env['ANTHROPIC_API_KEY'] = ''
            settingsFile = path.join(process.env.HOME ?? '/tmp', `.cc-ui-provider-${sessionId}.json`)
            fs.writeFileSync(settingsFile, JSON.stringify(ps), 'utf8')
          } else {
            settingsFile = path.join(process.env.HOME ?? '/tmp', `.cc-ui-provider-${sessionId}.json`)
            fs.writeFileSync(settingsFile, providerSettingsJson, 'utf8')
          }
        } catch {
          settingsFile = path.join(process.env.HOME ?? '/tmp', `.cc-ui-provider-${sessionId}.json`)
          fs.writeFileSync(settingsFile, providerSettingsJson, 'utf8')
        }
      } else if (orModel && orKey) {
        baseEnv['ANTHROPIC_BASE_URL'] = 'https://openrouter.ai/api/v1'
        baseEnv['ANTHROPIC_API_KEY']  = orKey
        baseEnv['OPENROUTER_API_KEY'] = orKey
      }

      // Write MCP config for permission bridge
      const mcpConfigFile = path.join(process.env.HOME ?? '/tmp', `.cc-ui-mcp-${sessionId}.json`)
      fs.writeFileSync(mcpConfigFile, JSON.stringify({
        mcpServers: {
          perm: {
            command: 'node',
            args: [MCP_SCRIPT],
            env: { PERM_SESSION: sessionId, PERM_PORT: String(BACKEND_PORT) },
          },
        },
      }), 'utf8')

      const pty = _require('node-pty') as typeof import('node-pty')

      const isCustomProvider = !!settingsFile || !!baseEnv['ANTHROPIC_BASE_URL']

      // Base Claude args (without --print / --input-format — added below per path)
      const baseClaudeArgs = [
        '--output-format', 'stream-json',
        '--verbose',
        // --bare disables MCP tool use, so permission bridge only works for Anthropic sessions
        ...(isCustomProvider
          ? ['--dangerously-skip-permissions', '--bare', '--add-dir', cwd]
          : ['--mcp-config', mcpConfigFile, '--permission-prompt-tool', 'mcp__perm__permission_prompt']),
        ...(settingsFile ? ['--settings', settingsFile] : []),
        ...(!settingsFile && orModel ? ['--model', orModel] : []),
        ...(resume ? ['--resume', resume] : []),
      ]

      // ── Shared output processing ──────────────────────────────────────────────
      const stripAnsi = (s: string) => s
        .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '')          // CSI: ESC [ ... letter  (incl. ?-private)
        .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '') // OSC: ESC ] ... BEL/ST
        .replace(/\x1b[>=<()][0-9A-Za-z]*/g, '')          // Other ESC sequences
        .replace(/\x1b./g, '')                              // Any remaining ESC + char
        .replace(/[\x00-\x09\x0b-\x0c\x0e-\x1f\x7f]/g, '') // Other control chars
        .replace(/\r/g, '')
      let lastToolUse: { tool: string; input: Record<string, unknown> } | null = null

      const sendLine = (line: string) => {
        const clean = stripAnsi(line).trim()
        if (!clean) return
        if (clean[0] !== '{') {
          if (/allow|permission|do you want|y\/n|\[y\/n\]|proceed\?/i.test(clean)) {
            ws.send(JSON.stringify({ type: 'permission_request', text: clean, tool: lastToolUse }))
          }
          return
        }
        ws.send(JSON.stringify({ type: 'data', data: clean + '\n' }))
        try {
          const ev = JSON.parse(clean) as Record<string, unknown>
          if (ev.type === 'system' && ev.subtype === 'init' && ev.session_id) {
            claudeSessionIds.set(sessionId, String(ev.session_id))
            ws.send(JSON.stringify({ type: 'session_id', id: ev.session_id }))
          }
          if (ev.type === 'assistant') {
            const content = (ev.message as Record<string, unknown> | undefined)?.content as unknown[] | undefined
            if (Array.isArray(content)) {
              for (const block of content) {
                const b = block as Record<string, unknown>
                if (b.type === 'tool_use' && b.name) {
                  let toolName = String(b.name)
                  let toolInput = (b.input as Record<string, unknown>) ?? {}
                  // Unwrap MCP permission wrapper so lastToolUse has the real tool
                  if (toolName === 'mcp__perm__permission_prompt' && toolInput.tool_name) {
                    toolName  = String(toolInput.tool_name)
                    toolInput = (toolInput.tool_input as Record<string, unknown>) ?? {}
                  }
                  lastToolUse = { tool: toolName, input: toolInput }
                }
              }
            }
          }
        } catch {}
      }

      // ── Image path: child_process + stream-json stdin ──────────────────────────
      // claude --image flag doesn't exist; images must be embedded via --input-format stream-json.
      if (imagePaths.length > 0) {
        // Resolve MIME type from extension
        const mimeForExt = (p: string) => {
          const ext = path.extname(p).toLowerCase()
          if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
          if (ext === '.png')  return 'image/png'
          if (ext === '.gif')  return 'image/gif'
          if (ext === '.webp') return 'image/webp'
          return 'image/png'
        }

        // Build multipart content: images first, then text
        type ContentBlock =
          | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
          | { type: 'text'; text: string }

        const content: ContentBlock[] = []
        for (const p of imagePaths) {
          try {
            const data = fs.readFileSync(p)
            content.push({ type: 'image', source: { type: 'base64', media_type: mimeForExt(p), data: data.toString('base64') } })
          } catch { /* skip unreadable image */ }
        }
        if (text.trim()) content.push({ type: 'text', text })

        const jsonInput = JSON.stringify({
          type: 'user',
          message: { role: 'user', content },
        })

        const imageArgs = [...baseClaudeArgs, '--print', '--input-format', 'stream-json']
        const proc = spawn('claude', imageArgs, { cwd, env: baseEnv, stdio: ['pipe', 'pipe', 'pipe'] })

        proc.stdin.write(jsonInput + '\n')
        proc.stdin.end()

        activePtys.set(sessionId, { write: () => { /* no interactive input for image runs */ }, kill: () => { proc.kill() } })

        let imgBuf = ''
        const handleChunk = (chunk: Buffer) => {
          imgBuf += chunk.toString()
          const lines = imgBuf.split('\n')
          imgBuf = lines.pop() ?? ''
          lines.forEach(sendLine)
        }
        proc.stdout.on('data', handleChunk)
        proc.stderr.on('data', handleChunk)

        proc.on('close', (exitCode) => {
          if (imgBuf.trim()) sendLine(imgBuf)
          activePtys.delete(sessionId)
          ws.send(JSON.stringify({ type: 'exit', exitCode: exitCode ?? 0 }))
          if (settingsFile) { try { fs.unlinkSync(settingsFile) } catch {} }
          try { fs.unlinkSync(mcpConfigFile) } catch {}
        })

      } else {
        // ── Text-only path: PTY spawn (original behavior) ─────────────────────
        const claudeArgs = [...baseClaudeArgs, '--print', text]

        const ptyProc = pty.spawn('claude', claudeArgs, {
          name: 'xterm-color', cols: 220, rows: 50, cwd, env: baseEnv,
        })

        let lineBuf = ''

        // Debounce timer: if lineBuf has non-JSON content and Claude goes silent for
        // 600 ms, treat it as a terminal permission prompt (language-agnostic).
        let permDebounce: ReturnType<typeof setTimeout> | null = null

        const flushPermBuf = () => {
          // Skip: MCP bridge is already handling this permission
          if (pendingPerms.size > 0) { lineBuf = ''; return }
          const cleanBuf = stripAnsi(lineBuf).trim()
          // Skip: garbage/empty after stripping — need at least 8 printable chars
          if (!cleanBuf || cleanBuf[0] === '{' || cleanBuf.length < 8) { lineBuf = ''; return }
          ws.send(JSON.stringify({ type: 'permission_request', text: cleanBuf, tool: lastToolUse }))
          lineBuf = ''
        }

        ptyProc.onData((data: string) => {
          lineBuf += data
          const lines = lineBuf.split('\n')
          lineBuf = lines.pop() ?? ''
          lines.forEach(sendLine)

          // Clear any pending debounce — Claude is still outputting
          if (permDebounce) { clearTimeout(permDebounce); permDebounce = null }

          const cleanBuf = stripAnsi(lineBuf).trim()
          if (cleanBuf && cleanBuf[0] !== '{' && cleanBuf.length >= 8 && pendingPerms.size === 0) {
            permDebounce = setTimeout(flushPermBuf, 600)
          }
        })

        activePtys.set(sessionId, { write: (d) => ptyProc.write(d), kill: () => ptyProc.kill() })

        ptyProc.onExit(({ exitCode }) => {
          if (lineBuf.trim()) sendLine(lineBuf)
          activePtys.delete(sessionId)
          ws.send(JSON.stringify({ type: 'exit', exitCode: exitCode ?? 0 }))
          if (settingsFile) { try { fs.unlinkSync(settingsFile) } catch {} }
          try { fs.unlinkSync(mcpConfigFile) } catch {}
        })
      }

    } catch (e) {
      console.error('[ws/agent] error:', e)
    }
  })
})

// ── upgrade handler — call this from server/index.ts ─────────────────────────

export function attachWsUpgrade(httpServer: import('http').Server) {
  httpServer.on('upgrade', (req: IncomingMessage, socket: Socket, head: Buffer) => {
    if (req.url?.startsWith('/ws/terminal')) {
      terminalWss.handleUpgrade(req, socket, head, (ws) => {
        terminalWss.emit('connection', ws, req)
      })
    } else if (req.url?.startsWith('/ws/agent')) {
      agentWss.handleUpgrade(req, socket, head, (ws) => {
        agentWss.emit('connection', ws, req)
      })
    } else {
      socket.destroy()
    }
  })
}
