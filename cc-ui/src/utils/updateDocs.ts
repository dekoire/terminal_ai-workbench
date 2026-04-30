import { useAppStore } from '../store/useAppStore'

// Probe files in priority order — most informative first
const SOURCE_FILES = [
  'package.json', 'requirements.txt', 'pyproject.toml', 'Cargo.toml',
  'go.mod', 'pom.xml', 'build.gradle',
  'server.py', 'app.py', 'main.py', 'manage.py', 'run.py',
  'server.js', 'app.js', 'index.js', 'index.ts',
  'vite.config.ts', 'vite.config.js', 'next.config.js', 'next.config.ts',
  'docker-compose.yml', 'docker-compose.yaml', 'Makefile',
  '.env.example', '.env.sample', 'project.config.json',
  'README.md',
]

// Additional subdirectory files to try (routes, models, config — high-value for docs)
const SUB_SOURCE_FILES = [
  'src/routes.ts', 'src/routes.js', 'routes/index.ts', 'routes/index.js',
  'src/models', 'models/index.ts', 'models/index.js',
  'src/config.ts', 'src/config.js', 'config/index.ts',
  'prisma/schema.prisma', 'db/schema.sql', 'database/schema.sql',
  'src/app.ts', 'src/main.ts', 'src/index.ts',
  'api/index.ts', 'api/index.js',
]

async function readFile(path: string): Promise<{ file: string; content: string } | null> {
  try {
    const r = await fetch(`/api/file-read?path=${encodeURIComponent(path)}`)
    const d = await r.json() as { ok: boolean; content?: string }
    if (!d.ok || !d.content) return null
    const c = d.content
    // Keep first 2000 + last 800 chars so we see both imports AND bottom of file
    const chunk = c.length > 2800 ? c.slice(0, 2000) + '\n…[abgeschnitten]…\n' + c.slice(-800) : c
    return { file: path.split('/').pop()!, content: chunk }
  } catch { return null }
}

async function buildProjectContext(projectPath: string): Promise<string> {
  const results = await Promise.all([
    ...SOURCE_FILES.map(f => readFile(`${projectPath}/${f}`)),
    ...SUB_SOURCE_FILES.map(f => readFile(`${projectPath}/${f}`)),
  ])

  const parts = results
    .filter((r): r is { file: string; content: string } => r !== null)
    .map(r => `=== ${r.file} ===\n${r.content}`)

  if (parts.length === 0) return '(keine Quelldateien gefunden)'

  // Cap total context at ~40k chars to avoid token overload
  let total = 0
  const capped: string[] = []
  for (const p of parts) {
    if (total + p.length > 40000) break
    capped.push(p)
    total += p.length
  }
  return capped.join('\n\n')
}

export async function refreshProjectDocs(projectPath: string): Promise<{ updated: number; skipped: number }> {
  const { aiProviders, aiFunctionMap, docTemplates } = useAppStore.getState()
  const docProvId = aiFunctionMap['docUpdate']
  const provider = aiProviders.find(p => p.id === docProvId)
    ?? aiProviders.find(p => p.name === 'Initial Docu Check')
    ?? aiProviders.find(p => p.name === 'Docu Update')
    ?? aiProviders[0]
  if (!provider) return { updated: 0, skipped: 0 }

  // Use the enabled AI Prompt template for doc-update (configurable in Settings → Vorlagen → AI Prompts)
  const promptTemplate = docTemplates.find(t => t.category === 'ai-prompt' && t.relativePath === 'doc-update' && t.enabled)
    ?? docTemplates.find(t => t.category === 'ai-prompt' && t.enabled)
  const baseSystemPrompt = promptTemplate?.content ?? `Du aktualisierst Projektdokumentation strikt auf Basis der gegebenen Quelldateien. Erfinde nichts. Wenn etwas nicht im Code vorhanden ist, schreibe "nicht vorhanden". Gib nur den aktualisierten Dateiinhalt zurück.`

  const [projectContext, docsRes] = await Promise.all([
    buildProjectContext(projectPath),
    fetch(`/api/read-docs?path=${encodeURIComponent(projectPath)}`),
  ])
  const docsData = await docsRes.json() as { ok: boolean; files?: { filename: string; content: string }[] }
  if (!docsData.ok || !docsData.files?.length) return { updated: 0, skipped: 0 }

  let updated = 0
  let skipped = 0

  for (const doc of docsData.files) {
    try {
      const r = await fetch('/api/ai-refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: provider.provider,
          apiKey: provider.apiKey,
          model: provider.model,
          text: doc.content,
          systemPrompt: `${baseSystemPrompt}

QUELLCODE-KONTEXT (nur diese Dateien existieren):
${projectContext}

Datei zu aktualisieren: ${doc.filename}`,
        }),
      })
      const d = await r.json() as { ok: boolean; text?: string }
      if (d.ok && d.text) {
        await fetch('/api/file-write', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: `${projectPath}/${doc.filename}`, content: d.text }),
        })
        updated++
      } else {
        skipped++
      }
    } catch { skipped++ }
  }

  return { updated, skipped }
}

export async function updateDocsWithAI(projectPath: string) {
  const projectId = useAppStore.getState().projects.find(p => p.path === projectPath)?.id ?? projectPath
  useAppStore.getState().setDocApplying(projectId, true)
  try {
    const { docTemplates, aiProviders, aiFunctionMap } = useAppStore.getState()
    const enabled = docTemplates.filter(t => t.enabled)
    const docProvId = aiFunctionMap['docUpdate']
    const provider = aiProviders.find(p => p.id === docProvId)
      ?? aiProviders.find(p => p.name === 'Initial Docu Check')
      ?? aiProviders.find(p => p.name === 'Docu Update')

    for (const tpl of enabled) {
      const fullPath = `${projectPath}/${tpl.relativePath}`
      const checkRes = await fetch(`/api/file-read?path=${encodeURIComponent(fullPath)}`)
      const checkData = await checkRes.json() as { ok: boolean; content?: string }

      if (!checkData.ok || !checkData.content) {
        await fetch('/api/file-write', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: fullPath, content: tpl.content }),
        })
      } else if (provider) {
        const refineRes = await fetch('/api/ai-refine', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: provider.provider,
            apiKey: provider.apiKey,
            model: provider.model,
            text: checkData.content,
            systemPrompt: `You are updating a project documentation file. The documentation template for "${tpl.name}" is:\n\n${tpl.content}\n\nReview the existing file content and update it to better match the template structure. Preserve all project-specific information already present. Only improve structure and fill obvious gaps from the template. Return only the updated file content without any explanation.`,
          }),
        })
        const refineData = await refineRes.json() as { ok: boolean; text?: string }
        if (refineData.ok && refineData.text) {
          await fetch('/api/file-write', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: fullPath, content: refineData.text }),
          })
        }
      }
    }
  } finally {
    useAppStore.getState().setDocApplying(projectId, false)
  }
}
