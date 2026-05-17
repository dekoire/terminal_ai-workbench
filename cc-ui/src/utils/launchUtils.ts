// ── Shared launch utilities ───────────────────────────────────────────────────
// Used by useAppLauncher, CenterPanel, and UIWorkshop.

export interface ProjectConfig {
  startCmd: string | null
  port: number | null
  appUrl: string | null
  detectedAt: string | null
  detectionMethod: 'heuristic' | 'ai' | 'manual' | null
  retries: number
  pid: number | null        // PID when started via Smart Launch; null if agent-started
  logFile: string | null    // log path (/tmp/cc-app-<port>.log); null if agent-started
  lastStarted: string | null // ISO timestamp of last start
}

export const DEFAULT_PROJECT_CONFIG: ProjectConfig = {
  startCmd: null,
  port: null,
  appUrl: null,
  detectedAt: null,
  detectionMethod: null,
  retries: 0,
  pid: null,
  logFile: null,
  lastStarted: null,
}

// ── Config I/O ────────────────────────────────────────────────────────────────

export async function readProjectConfig(projectPath: string): Promise<ProjectConfig | null> {
  try {
    const r = await fetch(`/api/file-read?path=${encodeURIComponent(projectPath + '/project.config.json')}`)
    const d = await r.json() as { ok: boolean; content?: string }
    if (d.ok && d.content) return JSON.parse(d.content) as ProjectConfig
  } catch { /* ignore */ }
  return null
}

export async function writeProjectConfig(projectPath: string, patch: Partial<ProjectConfig>): Promise<void> {
  try {
    const existing = await readProjectConfig(projectPath) ?? { ...DEFAULT_PROJECT_CONFIG }
    const updated: ProjectConfig = { ...existing, ...patch }
    await fetch('/api/file-write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: `${projectPath}/project.config.json`, content: JSON.stringify(updated, null, 2) }),
    })
  } catch { /* ignore */ }
}

// ── Port heuristic ────────────────────────────────────────────────────────────

export function guessPort(cmd: string, knownPort?: number): number | undefined {
  if (knownPort) return knownPort
  const m = cmd.match(/(?:--port[= ]|PORT=|:)(\d{4,5})/)
  if (m) return parseInt(m[1])
  if (/vite|npm run dev|yarn dev|pnpm dev/.test(cmd)) return 5173
  if (/next(js)?|next dev/.test(cmd)) return 3000
  if (/react-scripts|react-app/.test(cmd)) return 3000
  if (/flask/.test(cmd)) return 5000
  if (/manage\.py|django/.test(cmd)) return 8000
  if (/uvicorn|fastapi/.test(cmd)) return 8000
  if (/rails/.test(cmd)) return 3000
  if (/cargo run/.test(cmd)) return 3000
  if (/go run/.test(cmd)) return 8080
  if (/docker.compose/.test(cmd)) return 8080
  return undefined
}

// ── Heuristic detection — no AI, reads project files locally ─────────────────

export type DetectionMethod = 'config' | 'heuristic' | 'ai' | 'manual' | null

export interface HeuristicResult {
  cmd: string
  port?: number
  method: 'config' | 'heuristic'
}

async function readFile(path: string): Promise<string | null> {
  try {
    const r = await fetch(`/api/file-read?path=${encodeURIComponent(path)}`)
    const d = await r.json() as { ok: boolean; content?: string }
    return d.ok && d.content ? d.content : null
  } catch { return null }
}

async function fileExists(path: string): Promise<boolean> {
  return (await readFile(path)) !== null
}

function detectPackageManager(projectPath: string): Promise<'yarn' | 'pnpm' | 'npm'> {
  return Promise.all([
    fileExists(projectPath + '/yarn.lock'),
    fileExists(projectPath + '/pnpm-lock.yaml'),
  ]).then(([hasYarn, hasPnpm]) => hasYarn ? 'yarn' : hasPnpm ? 'pnpm' : 'npm')
}

export async function heuristicDetect(projectPath: string, knownPort?: number): Promise<HeuristicResult | null> {
  // 1. project.config.json with startCmd
  const cfg = await readProjectConfig(projectPath)
  if (cfg?.startCmd) {
    return { cmd: cfg.startCmd, port: cfg.port ?? guessPort(cfg.startCmd, knownPort), method: 'config' }
  }

  // 2. package.json scripts
  const pkgRaw = await readFile(projectPath + '/package.json')
  if (pkgRaw) {
    try {
      const pkg = JSON.parse(pkgRaw) as { scripts?: Record<string, string> }
      const key = ['dev', 'start', 'serve', 'preview'].find(k => pkg.scripts?.[k])
      if (key) {
        const pm = await detectPackageManager(projectPath)
        const cmd = `${pm} run ${key}`
        return { cmd, port: guessPort(cmd, knownPort), method: 'heuristic' }
      }
    } catch { /* ignore */ }
  }

  // 3. Python — check markers in priority order
  const [hasPyproject, hasRequirements, hasManagePy, hasAppPy, hasMainPy] = await Promise.all([
    readFile(projectPath + '/pyproject.toml'),
    fileExists(projectPath + '/requirements.txt'),
    fileExists(projectPath + '/manage.py'),
    fileExists(projectPath + '/app.py'),
    fileExists(projectPath + '/main.py'),
  ])

  if (hasManagePy) {
    return { cmd: 'python manage.py runserver', port: 8000, method: 'heuristic' }
  }

  if (hasPyproject) {
    const pyproj = hasPyproject
    if (/fastapi|uvicorn/.test(pyproj)) {
      const entry = hasMainPy ? 'main:app' : 'app:app'
      return { cmd: `uvicorn ${entry} --reload`, port: 8000, method: 'heuristic' }
    }
    if (/flask/.test(pyproj)) {
      return { cmd: 'python -m flask run', port: 5000, method: 'heuristic' }
    }
  }

  if (hasRequirements) {
    const req = await readFile(projectPath + '/requirements.txt') ?? ''
    if (/fastapi|uvicorn/.test(req)) {
      const entry = hasMainPy ? 'main:app' : hasAppPy ? 'app:app' : 'main:app'
      return { cmd: `uvicorn ${entry} --reload`, port: 8000, method: 'heuristic' }
    }
    if (/flask/.test(req)) {
      return { cmd: 'python -m flask run', port: 5000, method: 'heuristic' }
    }
    if (/django/.test(req)) {
      return { cmd: 'python manage.py runserver', port: 8000, method: 'heuristic' }
    }
    // Generic Python
    if (hasMainPy) return { cmd: 'python main.py', port: knownPort, method: 'heuristic' }
    if (hasAppPy)  return { cmd: 'python app.py',  port: knownPort, method: 'heuristic' }
  }

  // 4. Cargo (Rust)
  if (await fileExists(projectPath + '/Cargo.toml')) {
    return { cmd: 'cargo run', port: guessPort('cargo run', knownPort), method: 'heuristic' }
  }

  // 5. Go
  if (await fileExists(projectPath + '/go.mod')) {
    return { cmd: 'go run .', port: guessPort('go run .', knownPort), method: 'heuristic' }
  }

  // 6. Makefile — look for dev/start/run targets
  const makefile = await readFile(projectPath + '/Makefile')
  if (makefile) {
    const targetMatch = makefile.match(/^(dev|start|run|serve):/m)
    if (targetMatch) {
      return { cmd: `make ${targetMatch[1]}`, port: knownPort, method: 'heuristic' }
    }
  }

  // 7. docker-compose
  const dockerCompose = await readFile(projectPath + '/docker-compose.yml')
    ?? await readFile(projectPath + '/docker-compose.yaml')
  if (dockerCompose) {
    const portMatch = dockerCompose.match(/['"]?(\d{4,5}):/)
    const port = portMatch ? parseInt(portMatch[1]) : knownPort
    return { cmd: 'docker compose up', port, method: 'heuristic' }
  }

  return null
}

// ── Port polling ──────────────────────────────────────────────────────────────

export async function pollPort(
  port: number,
  timeoutMs = 30_000,
  intervalMs = 2_000,
): Promise<'open' | 'timeout'> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(`/api/check-port?port=${port}`)
      const d = await r.json() as { inUse: boolean }
      if (d.inUse) return 'open'
    } catch { /* ignore */ }
    await new Promise<void>(res => setTimeout(res, intervalMs))
  }
  return 'timeout'
}

// ── Extra ports (backend) from package.json proxy and vite.config ─────────────

export async function detectExtraPorts(projectPath: string): Promise<number[]> {
  const extras: number[] = []
  try {
    const pkgRaw = await readFile(projectPath + '/package.json')
    if (pkgRaw) {
      const pkg = JSON.parse(pkgRaw) as Record<string, unknown>
      if (typeof pkg.proxy === 'string') {
        const m = pkg.proxy.match(/:(\d{4,5})/)
        if (m) extras.push(parseInt(m[1]))
      }
    }
  } catch { /* ignore */ }
  for (const cfgFile of ['vite.config.ts', 'vite.config.js', 'vite.config.mjs']) {
    const raw = await readFile(projectPath + '/' + cfgFile)
    if (raw) {
      // server.port — the actual port vite will listen on
      const serverPort = raw.match(/server\s*:\s*\{[^}]*\bport\s*:\s*(\d{4,5})/s)
      if (serverPort) extras.push(parseInt(serverPort[1]))
      // proxy targets — backend URLs vite forwards to
      const proxyMatches = raw.matchAll(/['"]https?:\/\/(?:localhost|127\.0\.0\.1):(\d{4,5})['"]/g)
      for (const m of proxyMatches) extras.push(parseInt(m[1]))
      break
    }
  }
  return [...new Set(extras)]
}
