import type { AIProvider } from '../store/useAppStore'

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

export async function aiDetectStartCmd(
  projectPath: string,
  port: number | undefined,
  provider: AIProvider,
): Promise<string | null> {
  const [parts, binaries] = await Promise.all([
    (async () => {
      const acc: string[] = []
      for (const f of PROBE_FILES) {
        try {
          const r = await fetch(`/api/file-read?path=${encodeURIComponent(`${projectPath}/${f}`)}`)
          const d = await r.json() as { ok: boolean; content?: string }
          if (d.ok && d.content) {
            const c = d.content
            const chunk = c.length > 2400
              ? c.slice(0, 1200) + '\n…\n' + c.slice(-800)
              : c
            acc.push(`=== ${f} ===\n${chunk}`)
          }
        } catch { /* ignore */ }
      }
      return acc
    })(),
    detectAvailableBinaries(),
  ])

  const text = parts.join('\n\n') || '(keine Projektdateien gefunden)'
  const portHint = port ? ` Der Dev-Server soll auf Port ${port} laufen.` : ''

  // Build binary hints from what's actually available on this system
  const pythonBin = binaries['python3'] ?? binaries['python'] ?? 'python3'
  const nodeBin = binaries['node'] ? 'node' : 'node'
  const availableList = Object.keys(binaries).join(', ') || 'unbekannt'

  try {
    const r = await fetch('/api/ai-refine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: provider.provider,
        apiKey: provider.apiKey,
        model: provider.model,
        text,
        systemPrompt: `Du analysierst ein Software-Projekt und ermittelst den exakten Befehl zum Starten des Dev-Servers.${portHint}

Verfügbare Binaries auf diesem System: ${availableList}
Python-Binary auf diesem System: ${pythonBin}
Node-Binary auf diesem System: ${nodeBin}

Antworte NUR mit einem JSON-Objekt (kein Markdown):
{"startCmd": "${pythonBin} server.py"}

Regeln:
- Verwende IMMER die oben genannten verfügbaren Binaries — niemals andere
- Lies den Code GENAU — unterscheide besonders bei Python:
  • Hat die Datei "if __name__ == '__main__': app.run(...)" → Befehl ist "${pythonBin} dateiname.py" (NICHT flask run)
  • Hat die Datei KEINE main-Block-app.run → dann "flask run --port PORT"
- Schließe den Port IMMER ein:
  • python direkt:   PORT=5001 ${pythonBin} server.py
  • flask run:       flask run --port 5001
  • node direkt:     PORT=3000 ${nodeBin} index.js
  • npm script:      PORT=3000 npm start
  • vite/next/etc.:  npm run dev -- --port 3000
- Port wird vor dem Start automatisch freigegeben — kein kill nötig
- Nur JSON zurückgeben, keine Erklärung`,
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
