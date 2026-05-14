import { useAppStore } from '../store/useAppStore'
import { getOrModel } from './orProvider'

const PROBE_FILES = [
  'package.json', 'Makefile', 'docker-compose.yml', 'docker-compose.yaml',
  'pom.xml', 'build.gradle', 'requirements.txt', 'Pipfile', 'pyproject.toml',
  'Cargo.toml', 'go.mod',
  'server.py', 'app.py', 'main.py', 'manage.py', 'run.py',
  'server.js', 'app.js', 'index.js',
  'README.md',
]

async function whichBinary(cmd: string): Promise<string | null> {
  try {
    const r = await fetch(`/api/which?cmd=${encodeURIComponent(cmd)}`)
    const d = await r.json() as { ok: boolean; path: string | null }
    return d.ok ? cmd : null
  } catch { return null }
}

async function detectAvailableBinaries(): Promise<Record<string, string>> {
  const checks = await Promise.all([
    whichBinary('python3'),
    whichBinary('python'),
    whichBinary('node'),
    whichBinary('npm'),
    whichBinary('yarn'),
    whichBinary('pnpm'),
    whichBinary('cargo'),
    whichBinary('go'),
    whichBinary('mvn'),
    whichBinary('gradle'),
    whichBinary('flask'),
  ])
  const names = ['python3','python','node','npm','yarn','pnpm','cargo','go','mvn','gradle','flask']
  const result: Record<string, string> = {}
  names.forEach((name, i) => { if (checks[i]) result[name] = checks[i]! })
  return result
}

async function probeFiles(basePath: string, label: string): Promise<string[]> {
  const acc: string[] = []
  for (const f of PROBE_FILES) {
    try {
      const r = await fetch(`/api/file-read?path=${encodeURIComponent(`${basePath}/${f}`)}`)
      const d = await r.json() as { ok: boolean; content?: string }
      if (d.ok && d.content) {
        const c = d.content
        const chunk = c.length > 2400 ? c.slice(0, 1200) + '\n…\n' + c.slice(-800) : c
        acc.push(`=== ${label}${f} ===\n${chunk}`)
      }
    } catch { /* ignore */ }
  }
  return acc
}

export async function aiDetectStartCmd(
  projectPath: string,
  port: number | undefined,
): Promise<string | null> {
  const provider = getOrModel('devDetect')
  if (!provider) return null
  const [rootParts, binaries] = await Promise.all([
    probeFiles(projectPath, ''),
    detectAvailableBinaries(),
  ])

  // If root package.json has no scripts, check common subdirectories too
  const rootHasScripts = rootParts.some(p => p.includes('"scripts"') && p.match(/"dev"|"start"|"serve"/))
  let subParts: string[] = []
  if (!rootHasScripts) {
    const SUB_DIRS = ['src', 'app', 'frontend', 'client', 'web', 'ui', 'backend', 'server',
      'cc-ui', 'packages/app', 'packages/web', 'apps/web', 'apps/app']
    const results = await Promise.all(SUB_DIRS.map(sub => probeFiles(`${projectPath}/${sub}`, `${sub}/`)))
    subParts = results.flat()
  }

  const parts = [...rootParts, ...subParts]

  const text = parts.join('\n\n') || '(keine Projektdateien gefunden)'
  const portHint = port ? ` Der Dev-Server soll auf Port ${port} laufen.` : ''

  // Build binary hints from what's actually available on this system
  const pythonBin = binaries['python3'] ?? binaries['python'] ?? 'python3'
  const nodeBin = binaries['node'] ? 'node' : 'node'
  const availableList = Object.keys(binaries).join(', ') || 'unbekannt'

  // Read prompt template from store (configurable in Settings → Vorlagen → AI Prompts)
  const promptTemplate = useAppStore.getState().docTemplates.find(t => t.id === 'ai-prompt-start-detect')?.content
    ?? `Du analysierst ein Software-Projekt und ermittelst den exakten Befehl zum Starten des Dev-Servers.{{portHint}}\n\nVerfügbare Binaries: {{availableList}}\nPython: {{pythonBin}}\nNode: {{nodeBin}}\n\nNur JSON zurückgeben: {"startCmd": "{{pythonBin}} server.py"}`
  const systemPrompt = promptTemplate
    .replace(/\{\{portHint\}\}/g, portHint)
    .replace(/\{\{availableList\}\}/g, availableList)
    .replace(/\{\{pythonBin\}\}/g, pythonBin)
    .replace(/\{\{nodeBin\}\}/g, nodeBin)

  try {
    const r = await fetch('/api/ai-refine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: provider.provider,
        apiKey: provider.apiKey,
        model: provider.model,
        text,
        systemPrompt,
      }),
    })
    const d = await r.json() as { ok: boolean; text?: string }
    if (!d.ok || !d.text) return null
    const clean = d.text.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    const result = JSON.parse(clean) as { startCmd?: string }
    return result.startCmd ?? null
  } catch {
    return null
  }
}
