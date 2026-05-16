/**
 * projectBrain.ts — Token-effizienter Projektkontex für LLM-Handoffs
 *
 * Der "Project Brain" ist ein kompakter (~500 Token) Markdown-Text pro Projekt,
 * der automatisch nach je 5 Antworten aktualisiert wird und als System-Prompt
 * in jeden Orbit-Chat injiziert wird.
 *
 * Vorteile:
 * - 50x günstiger als vollständige Chat-History
 * - Modell-agnostisch (Gemini, Claude, GPT etc. bekommen denselben Kontext)
 * - Persistiert in Supabase (project_brain Tabelle)
 */

import type { ProjectBrainEntry } from '../store/useAppStore'
import type { OrbitMessage } from '../store/useAppStore'
import { sanitizeKey } from '../utils/orProvider'

// ── Rendering ─────────────────────────────────────────────────────────────────

export function renderBrain(brain: ProjectBrainEntry, projectName?: string): string {
  const parts: string[] = []

  if (projectName || brain.projectId) {
    parts.push(`## Projekt: ${projectName ?? brain.projectId}`)
  }

  if (brain.summary) {
    parts.push(`**Was es macht:** ${brain.summary}`)
  }

  if (brain.architecture) {
    parts.push(`**Architektur:** ${brain.architecture}`)
  }

  if (brain.recentWork.length > 0) {
    parts.push('**Zuletzt gearbeitet:**')
    for (const w of brain.recentWork.slice(0, 10)) {
      parts.push(`• ${w.date} ${w.item}`)
    }
  }

  if (brain.openTasks.length > 0) {
    parts.push('**Offene Aufgaben:**')
    for (const t of brain.openTasks) {
      parts.push(`• ${t}`)
    }
  }

  if (brain.keyFiles.length > 0) {
    parts.push('**Wichtige Dateien:**')
    for (const f of brain.keyFiles) {
      parts.push(`• ${f.path} — ${f.purpose}`)
    }
  }

  return parts.join('\n')
}

export function estimateBrainTokens(text: string): number {
  return Math.ceil(text.length / 3.5)
}

// ── AI Update ────────────────────────────────────────────────────────────────

// Default brain-update prompt template.
// Placeholders: {brain}, {messages}, {n}, {date}, {projectName}
export const DEFAULT_BRAIN_UPDATE_PROMPT =
`Du bist ein Projekt-Dokumentations-Assistent. Aktualisiere den Project Brain basierend auf der neuen Konversation.

Aktueller Project Brain:
{brain}

Neue Konversation (letzte {n} Nachrichten):
{messages}

Aktuelles Datum: {date}

Gib NUR ein JSON-Objekt zurück (kein Markdown, keine Erklärungen):
{
  "summary": "2 Sätze max — was macht das Projekt",
  "architecture": "Schlüsselkomponenten, 1–2 Sätze",
  "recent_work": [{"date": "{date}", "item": "was wurde gemacht/besprochen"}],
  "open_tasks": ["Aufgabe 1", "Aufgabe 2"],
  "key_files": [{"path": "src/foo.ts", "purpose": "macht X"}]
}

Regeln:
- recent_work: maximal 10 Einträge, neueste zuerst, behalte alte die noch relevant sind
- open_tasks: nur was wirklich offen ist, abgeschlossenes entfernen
- key_files: maximal 8 wichtige Dateien mit kurzem Zweck
- Antworte NUR mit dem JSON, kein weiterer Text`

interface UpdateBrainParams {
  openrouterKey: string
  currentBrain?: ProjectBrainEntry
  recentMessages: OrbitMessage[]
  projectName: string
  projectId: string
  compressModel: string
  customPrompt?: string  // overrides DEFAULT_BRAIN_UPDATE_PROMPT; same placeholders apply
}

interface BrainJson {
  summary?: string
  architecture?: string
  recent_work?: Array<{ date: string; item: string }>
  open_tasks?: string[]
  key_files?: Array<{ path: string; purpose: string }>
}

export async function updateBrainWithAI(params: UpdateBrainParams): Promise<ProjectBrainEntry> {
  const { openrouterKey, currentBrain, recentMessages, projectName, projectId, compressModel, customPrompt } = params

  const currentBrainText = currentBrain ? renderBrain(currentBrain, projectName) : '(kein bisheriger Kontext)'

  const recentText = recentMessages
    .slice(-10)
    .map(m => `[${m.role === 'user' ? 'User' : 'AI'}]: ${m.content.slice(0, 400)}`)
    .join('\n\n')

  const today = new Date().toISOString().split('T')[0]
  const n = String(recentMessages.length)

  const template = customPrompt && customPrompt.trim() ? customPrompt : DEFAULT_BRAIN_UPDATE_PROMPT
  const prompt = template
    .replace(/\{brain\}/g, currentBrainText)
    .replace(/\{messages\}/g, recentText)
    .replace(/\{date\}/g, today)
    .replace(/\{n\}/g, n)
    .replace(/\{projectName\}/g, projectName)

  try {
    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sanitizeKey(openrouterKey)}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Codera AI · Brain',
      },
      body: JSON.stringify({
        model: compressModel,
        stream: false,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 800,
      }),
    })

    if (!resp.ok) throw new Error(`${resp.status}`)

    const json = await resp.json() as { choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } }
    const raw = json.choices?.[0]?.message?.content?.trim() ?? ''
    const inputTokens  = json.usage?.prompt_tokens     ?? 0
    const outputTokens = json.usage?.completion_tokens ?? 0

    // Strip potential markdown fences
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    const parsed = JSON.parse(cleaned) as BrainJson

    // Merge: keep existing recent_work entries not overwritten, cap at 10
    const existingWork = currentBrain?.recentWork ?? []
    const newWork = parsed.recent_work ?? []
    const mergedWork = [...newWork, ...existingWork]
      .filter((w, idx, arr) => arr.findIndex(x => x.item === w.item) === idx)
      .slice(0, 10)

    const updated: ProjectBrainEntry = {
      projectId,
      summary:       parsed.summary       ?? currentBrain?.summary       ?? '',
      architecture:  parsed.architecture  ?? currentBrain?.architecture  ?? '',
      recentWork:    mergedWork,
      openTasks:     parsed.open_tasks    ?? currentBrain?.openTasks     ?? [],
      keyFiles:      parsed.key_files     ?? currentBrain?.keyFiles      ?? [],
      brainTokens:            0,
      lastUpdatedAt:          new Date().toISOString(),
      generationModel:        compressModel,
      generationInputTokens:  inputTokens,
      generationOutputTokens: outputTokens,
    }
    updated.brainTokens = estimateBrainTokens(renderBrain(updated, projectName))
    return updated

  } catch (err) {
    console.error('[projectBrain] updateBrainWithAI failed:', err)
    // On failure: return current brain unchanged (never break the conversation)
    return currentBrain ?? {
      projectId,
      summary: '', architecture: '', recentWork: [],
      openTasks: [], keyFiles: [], brainTokens: 0,
      lastUpdatedAt: new Date().toISOString(),
    }
  }
}

// ── Project Scan ─────────────────────────────────────────────────────────────

interface ScanResult {
  ok: boolean
  tree: string
  keyFileContents: Record<string, string>
  projectPath: string
  error?: string
}

interface ScanBrainJson {
  summary?: string
  architecture?: string
  key_files?: Array<{ path: string; purpose: string }>
  open_tasks?: string[]
}

export async function scanProjectForBrain(params: {
  projectPath: string
  projectName: string
  projectId: string
  openrouterKey: string
  compressModel: string
  currentBrain?: ProjectBrainEntry
}): Promise<ProjectBrainEntry> {
  const { projectPath, projectName, projectId, openrouterKey, compressModel, currentBrain } = params

  // 1. Fetch the file tree from the Vite dev server
  const scanResp = await fetch(`/api/scan-project?path=${encodeURIComponent(projectPath)}`)
  const scan = await scanResp.json() as ScanResult

  if (!scan.ok) {
    throw new Error(`Scan fehlgeschlagen: ${scan.error ?? 'unbekannt'}`)
  }

  // 2. Build compact prompt
  const keyFilesSection = Object.entries(scan.keyFileContents)
    .map(([file, content]) => `=== ${file} ===\n${content}`)
    .join('\n\n')

  const prompt = `Du bist ein Code-Analyst. Analysiere die folgende Projektstruktur und erstelle eine kompakte Code-Map.

Projektname: ${projectName}
Pfad: ${projectPath}

Dateistruktur:
${scan.tree}

${keyFilesSection ? `Schlüsseldateien:\n${keyFilesSection}` : ''}

Gib NUR ein JSON-Objekt zurück (kein Markdown, keine Erklärungen):
{
  "summary": "2 Sätze: was macht das Projekt, welche Technologien",
  "architecture": "Wie ist der Code aufgebaut — Hauptverzeichnisse und ihr Zweck, 2–3 Sätze",
  "key_files": [
    {"path": "src/store/app.ts", "purpose": "globaler State, alle Typen"},
    {"path": "src/components/Header.tsx", "purpose": "Navigation und Auth"},
    ...max 12 wichtigste Dateien...
  ],
  "open_tasks": []
}

Regeln:
- key_files: nur die wichtigsten Einstiegspunkte — wo eine neue KI zuerst lesen würde
- architecture: so kompakt wie möglich, damit eine KI sofort die Struktur versteht
- Antworte NUR mit JSON`

  const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${sanitizeKey(openrouterKey)}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Codera AI · Brain Scan',
    },
    body: JSON.stringify({
      model: compressModel,
      stream: false,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000,
    }),
  })

  if (!resp.ok) throw new Error(`OpenRouter ${resp.status}`)

  const json = await resp.json() as { choices?: { message?: { content?: string } }[] }
  const raw = json.choices?.[0]?.message?.content?.trim() ?? ''
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  const parsed = JSON.parse(cleaned) as ScanBrainJson

  const updated: ProjectBrainEntry = {
    projectId,
    summary:       parsed.summary       ?? currentBrain?.summary      ?? '',
    architecture:  parsed.architecture  ?? currentBrain?.architecture ?? '',
    recentWork:    currentBrain?.recentWork  ?? [],
    openTasks:     parsed.open_tasks    ?? currentBrain?.openTasks    ?? [],
    keyFiles:      parsed.key_files     ?? [],
    brainTokens:   0,
    lastUpdatedAt: new Date().toISOString(),
  }
  updated.brainTokens = estimateBrainTokens(renderBrain(updated, projectName))
  return updated
}

// ── User Story Generator ──────────────────────────────────────────────────────

export function buildUserStoryPrompt(
  brain: ProjectBrainEntry | undefined,
  projectName: string,
  recentMsgs: OrbitMessage[],
): string {
  const brainText = brain ? renderBrain(brain, projectName) : '(noch kein Projektkontex verfügbar)'

  const msgContext = recentMsgs.length > 0
    ? `\n\nLetzte Konversation:\n${recentMsgs.slice(-6).map(m =>
        `[${m.role === 'user' ? 'User' : 'AI'}]: ${m.content.slice(0, 300)}`
      ).join('\n')}`
    : ''

  return `Du bist ein erfahrener Product Owner. Erstelle anhand des folgenden Projektkontexts eine User Story für das sinnvollste nächste Feature oder die wichtigste offene Aufgabe.

Projektkontext:
${brainText}${msgContext}

Antworte im folgenden Format:

**Titel:** [prägnanter Titel]

**User Story:**
Als [Rolle] möchte ich [Funktion], damit [Nutzen].

**Akzeptanzkriterien:**
- [ ] ...
- [ ] ...

**Technische Hinweise** (aus Kontext):
• ...`
}
