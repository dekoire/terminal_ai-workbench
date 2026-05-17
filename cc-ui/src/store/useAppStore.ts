import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { newAgentMsgId } from '../lib/ids'

export type Screen = 'login' | 'register' | 'workspace' | 'settings' | 'templates' | 'history' | 'profile' | 'workshop' | 'getting-started'

export type WorkshopElementRef = {
  tag: string
  id: string
  classes: string[]
  component?: string
  text?: string
  selector: string
  /** HTML page (document.title or pathname) */
  page?: string
  /** Position label in viewport, e.g. "oben rechts", "mitte" */
  position?: string
  /** CSS ancestor chain, e.g. ".navbar > .nav-item > button" */
  hierarchy?: string
}

export type PendingWorkshopTransfer = {
  text: string
  elementRefs: WorkshopElementRef[]
  imageDataUrls: string[]
}

export interface CurrentUser {
  id: string
  email: string
  firstName: string
  lastName: string
  avatarDataUrl?: string
}

export interface OrbitMessage {
  id?: string
  role: 'user' | 'assistant'
  content: string
  ts: number
  model?: string
  tokens?: number
  images?: string[]
}

export interface OrbitChatMeta {
  title?: string    // AI-generated or user-edited
  pinned?: boolean
  lastTs?: number   // last message timestamp from JSONL (for sorting before messages load)
}

export interface QuickLink {
  id:    string
  title: string
  url:   string
}

export type OrbitFavoriteKind = 'chat' | 'message'

export interface OrbitFavorite {
  id: string
  kind: OrbitFavoriteKind
  projectId: string
  chatId: string
  chatTitle?: string
  // message-specific
  messageId?: string
  messageContent?: string
  messageRole?: 'user' | 'assistant'
  messageModel?: string
  msgTs?: number
  ts: number   // when favorited
}
export interface ProjectBrainEntry {
  projectId: string
  summary: string
  architecture: string
  recentWork: Array<{ date: string; item: string }>
  openTasks: string[]
  keyFiles: Array<{ path: string; purpose: string }>
  brainTokens: number        // estimated tokens when injected as system prompt
  lastUpdatedAt: string
  generationModel?: string   // model used for last AI update
  generationInputTokens?: number   // tokens consumed reading messages
  generationOutputTokens?: number  // tokens produced by the model
}

export type Theme = 'dark' | 'light'
export type PermMode = 'normal' | 'dangerous'
export type SessionKind = 'single' | 'orbit' | 'openrouter-claude'

export interface Session {
  id: string
  name: string
  alias: string
  cmd: string      // resolved at session creation — never stale
  args: string     // includes --dangerously-skip-permissions when permMode=dangerous
  status: 'active' | 'idle' | 'error' | 'exited'
  permMode: PermMode
  startedAt: number
  kind?: SessionKind  // undefined treated as 'single' for backwards compatibility
  orModel?: string               // OpenRouter model ID for openrouter-claude sessions
  providerSettingsJson?: string  // Custom provider: full claude.json content
}

export interface Project {
  id: string
  name: string
  path: string
  branch: string
  dirty?: number
  sessions: Session[]
  appPort?: number
  appStartCmd?: string
  githubTokenId?: string   // ID eines RepoToken aus tokens[] — per-Projekt-Token
}

export interface Alias {
  id: string
  name: string
  cmd: string
  args: string
  permMode: PermMode
  status: 'ok' | 'warn'
}

export interface ClaudeProvider {
  id: string
  name: string
  baseUrl: string       // base URL (no /anthropic appended)
  authToken: string     // ANTHROPIC_AUTH_TOKEN
  modelName: string     // model name for API
  orModelId?: string    // OpenRouter model ID for display
  endpointOk?: boolean | null  // null = unchecked
  settingsJson?: string // full editable claude.json content written to disk on session start
}

export interface Template {
  id: string
  name: string
  hint: string
  body: string
  tag: string
  uses: number
  favorite?: boolean
}

export interface TurnMessage {
  id: string
  kind: 'user' | 'agent' | 'tool' | 'status'
  alias?: string
  model?: string
  elapsed?: string
  tokens?: string
  content?: string
  attachments?: string[]
  toolName?: string
  toolArgs?: string
  toolLines?: string
  toolMatches?: string
  pendingApproval?: boolean
  tone?: 'ok' | 'warn' | 'err' | 'info' | 'accent'
  diff?: boolean
}

export type KanbanStatus   = 'backlog' | 'testing' | 'done'
export type TicketPriority = 'low' | 'medium' | 'high' | 'critical'
export type TicketType     = 'story' | 'nfc' | 'bug'

export interface KanbanTicket {
  id: string
  ticketNumber: number   // sequential per-project: 1, 2, 3 …
  title: string
  text: string
  status: KanbanStatus
  priority?: TicketPriority
  type?: TicketType
  createdAt: number
  images?: string[]  // base64 data URLs
}

export interface RepoToken {
  id: string
  label: string      // e.g. "GitHub Personal"
  host: string       // e.g. "github.com"
  token: string      // the actual token value
}

/** @deprecated — kept only for migration from old JSON files, do not use */
export interface AIProvider {
  id: string
  name: string
  provider: 'openai' | 'anthropic' | 'deepseek' | 'groq'
  apiKey: string
  model: string
}

export type DocTemplateCategory = 'doc' | 'ai-prompt' | 'user-story' | 'prompt-support'

export type SidebarSectionId = 'workspaces' | 'prompts' | 'github' | 'quicklinks' | 'tasks'
export interface SidebarSection { id: SidebarSectionId; visible: boolean }
export const DEFAULT_SIDEBAR_SECTIONS: SidebarSection[] = [
  { id: 'workspaces', visible: true },
  { id: 'prompts',    visible: true },
  { id: 'github',     visible: true },
  { id: 'quicklinks', visible: true },
  { id: 'tasks',      visible: true },
]

export type RightSidebarSectionId = 'kontextlog' | 'github' | 'quicklinks' | 'tasks'
export interface RightSidebarSection { id: RightSidebarSectionId; visible: boolean }
export const DEFAULT_RIGHT_SIDEBAR_SECTIONS: RightSidebarSection[] = [
  { id: 'kontextlog', visible: true },
  { id: 'github',     visible: true },
  { id: 'quicklinks', visible: true },
  { id: 'tasks',      visible: true },
]

// ── Unified cross-panel layout sections ───────────────────────────────────────
export type AllSectionId =
  'workspaces' | 'prompts' | 'github' | 'quicklinks' | 'tasks' |
  'kontextlog' | 'projekt-terminal'

export interface LayoutSection {
  id: AllSectionId
  panel: 'left' | 'right'
  visible: boolean
}

export const DEFAULT_LAYOUT_SECTIONS: LayoutSection[] = [
  { id: 'workspaces',        panel: 'left',  visible: true },
  { id: 'prompts',           panel: 'left',  visible: true },
  { id: 'projekt-terminal',  panel: 'right', visible: true },
  { id: 'kontextlog',        panel: 'right', visible: true },
  { id: 'github',            panel: 'right', visible: true },
  { id: 'quicklinks',        panel: 'right', visible: true },
  { id: 'tasks',             panel: 'right', visible: true },
]

export interface DocTemplate {
  id: string
  name: string
  relativePath: string   // for 'doc': file path; for 'ai-prompt'/'user-story': empty or label
  content: string        // for 'doc': file content; for 'ai-prompt': system prompt; for 'user-story': story template
  enabled: boolean
  category?: DocTemplateCategory  // defaults to 'doc' if absent
}

// ── Toast notifications ───────────────────────────────────────────────────────
export interface ToastAction { label: string; variant?: 'primary' | 'ghost'; onClick: () => void }
export interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  body?: string
  actions?: ToastAction[]
  duration?: number  // ms — 0 = manual dismiss; defaults: success/info 4000, warning 6000, error 0
}

export type ShortcutCategory = 'control' | 'navigation' | 'editing'

export interface TerminalShortcut {
  id: string
  key: string          // e.g. 'c', 'Tab', 'ArrowUp'
  ctrl?: boolean
  shift?: boolean
  label: string        // display label, e.g. 'Ctrl+C'
  description: string  // human description
  signal: string       // raw bytes to send, e.g. '\x03'
  enabled: boolean
  category: ShortcutCategory
}

export const DEFAULT_TERMINAL_SHORTCUTS: TerminalShortcut[] = [
  { id: 'ctrl-c',     key: 'c',         ctrl: true,  label: 'Ctrl+C', description: 'Prozess unterbrechen (SIGINT)',       signal: '\x03',   enabled: true, category: 'control'    },
  { id: 'ctrl-d',     key: 'd',         ctrl: true,  label: 'Ctrl+D', description: 'EOF / Shell beenden',                signal: '\x04',   enabled: true, category: 'control'    },
  { id: 'ctrl-z',     key: 'z',         ctrl: true,  label: 'Ctrl+Z', description: 'Prozess suspendieren (SIGTSTP)',     signal: '\x1a',   enabled: true, category: 'control'    },
  { id: 'ctrl-l',     key: 'l',         ctrl: true,  label: 'Ctrl+L', description: 'Bildschirm leeren',                  signal: '\x0c',   enabled: true, category: 'control'    },
  { id: 'ctrl-r',     key: 'r',         ctrl: true,  label: 'Ctrl+R', description: 'Rückwärtssuche in History',          signal: '\x12',   enabled: true, category: 'control'    },
  { id: 'ctrl-a',     key: 'a',         ctrl: true,  label: 'Ctrl+A', description: 'Cursor zum Zeilenanfang',            signal: '\x01',   enabled: true, category: 'editing'    },
  { id: 'ctrl-e',     key: 'e',         ctrl: true,  label: 'Ctrl+E', description: 'Cursor zum Zeilenende',              signal: '\x05',   enabled: true, category: 'editing'    },
  { id: 'ctrl-u',     key: 'u',         ctrl: true,  label: 'Ctrl+U', description: 'Zeile löschen (bis Anfang)',         signal: '\x15',   enabled: true, category: 'editing'    },
  { id: 'ctrl-k',     key: 'k',         ctrl: true,  label: 'Ctrl+K', description: 'Zeile löschen (bis Ende)',           signal: '\x0b',   enabled: true, category: 'editing'    },
  { id: 'ctrl-w',     key: 'w',         ctrl: true,  label: 'Ctrl+W', description: 'Letztes Wort löschen',               signal: '\x17',   enabled: true, category: 'editing'    },
  { id: 'tab',        key: 'Tab',                    label: 'Tab',    description: 'Autovervollständigung',               signal: '\x09',   enabled: true, category: 'navigation' },
  { id: 'arrow-up',   key: 'ArrowUp',                label: '↑',      description: 'Vorheriger Befehl (History)',         signal: '\x1b[A', enabled: true, category: 'navigation' },
  { id: 'arrow-down', key: 'ArrowDown',               label: '↓',      description: 'Nächster Befehl (History)',          signal: '\x1b[B', enabled: true, category: 'navigation' },
]

export const DEFAULT_DOC_TEMPLATES: DocTemplate[] = [
  {
    id: 'dt-claude-md',
    name: 'CLAUDE.md',
    relativePath: 'CLAUDE.md',
    enabled: true,
    content: `# Project Name

Short description of what this project does.
Stack: [technology stack]
Start: \`[start command]\` → http://localhost:[port]

## Critical Rules
- [Key constraint 1]
- [Key constraint 2]

## Dev Server
- Start: \`[startCmd]\`
- URL: http://localhost:[port]
- Config: project.config.json

## Which file to read when

| Task | File |
|------|------|
| UI changes | Docs/UI_MAP.md |
| Architecture | Docs/ARCHITECTURE.md |
| Coding rules | Docs/RULES.md |
| Testing | Docs/TESTING.md |

## Key Files
- \`path/to/file\` — what it does
`,
  },
  {
    id: 'dt-rules',
    name: 'Docs/RULES.md',
    relativePath: 'Docs/RULES.md',
    enabled: true,
    content: `# Project — Coding Rules

## Architecture
- [Core architecture constraints]

## Naming Conventions
- Components: PascalCase
- Files: PascalCase for components, camelCase for utils
- [Additional naming rules]

## Styling
- [Styling approach — CSS modules / Tailwind / inline styles]

## TypeScript
- strict: true
- [Additional TS constraints]

## Security
- [Security rules — input validation, API keys, etc.]

## Change Patterns

### New Component
1. Create in \`src/components/\`
2. Export as named export
3. [Additional steps]

### New API Route
1. [Step 1]
2. [Step 2]
`,
  },
  {
    id: 'dt-ui-map',
    name: 'Docs/UI_MAP.md',
    relativePath: 'Docs/UI_MAP.md',
    enabled: true,
    content: `# Project — UI Map

## Screen / Route Structure

| Route | Component | Purpose |
|-------|-----------|---------|
| / | HomePage | [purpose] |
| /[route] | [Component] | [purpose] |

## Layout

\`\`\`
+------------------------+
| Header / Navbar        |
+--------+---------------+
| Sidebar| Main Content  |
+--------+---------------+
| Footer                 |
+------------------------+
\`\`\`

## Components

| Component | File | Purpose |
|-----------|------|---------|
| [Name] | [path/file.tsx] | [what it does] |

## State / Data Flow
- [Where global state lives]
- [How data flows between components]

## UI Patterns
- [Common pattern 1]
- [Common pattern 2]
`,
  },
  {
    id: 'dt-architecture',
    name: 'Docs/ARCHITECTURE.md',
    relativePath: 'Docs/ARCHITECTURE.md',
    enabled: true,
    content: `# Project — Architecture

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | [tech + version] |
| Backend | [tech + version] |
| Database | [tech + version] |
| Build | [bundler/compiler] |

## Data Models

\`\`\`typescript
interface ModelName {
  id: string
  // fields...
}
\`\`\`

## API Routes

| Route | Method | Body/Params | Response |
|-------|--------|-------------|----------|
| /api/[route] | GET | \`param\` | \`{ ok, data }\` |

## Key Architectural Decisions
- [Decision]: [reasoning]

## External Services
- [Service]: [what it's used for]
`,
  },
  {
    id: 'dt-testing',
    name: 'Docs/TESTING.md',
    relativePath: 'Docs/TESTING.md',
    enabled: true,
    content: `# Project — Testing Guide

## 1. Type Check (run after every change)
\`\`\`bash
npx tsc --noEmit
\`\`\`
No output = all good.

## 2. Dev Server
\`\`\`bash
[startCmd]   # → http://localhost:[port]
\`\`\`

## 3. Visual Verification
1. Start dev server
2. Check browser console for errors
3. Test the golden path
4. Test edge cases

## 4. Interaction Tests
- [Key user flow 1]
- [Key user flow 2]

## 5. Checklist before done
- [ ] TypeScript: no errors
- [ ] No console errors
- [ ] Core user flows work
- [ ] No regressions in existing features
`,
  },
  // ── AI Prompts ────────────────────────────────────────────────────────────
  {
    id: 'ai-prompt-doc-update',
    name: 'Dok-Update Prompt',
    relativePath: 'doc-update',
    enabled: true,
    category: 'ai-prompt' as const,
    content: `Du bist ein präziser Dokumentations-Updater. Du aktualisierst nur auf Basis der gegebenen Projektdateien — du erfindest NICHTS.

STRIKTE REGELN:
1. Schreibe NUR was aus den Quelldateien direkt belegbar ist.
2. Wenn etwas NICHT im Code vorkommt (z.B. keine Datenbank, kein Auth-System, keine Tests): schreibe explizit "nicht vorhanden" oder lasse das Feld leer — erfinde keine Platzhalter.
3. Verweise immer auf die konkrete Quelldatei, z.B. "(siehe package.json)" oder "(aus server.py)".
4. Versions- und Abhängigkeitsinformationen direkt aus package.json / requirements.txt / pyproject.toml übernehmen — nicht raten.
5. API-Endpunkte, Datenbankschemas, Umgebungsvariablen: nur dokumentieren wenn sie explizit im Code stehen.
6. Behalte die bestehende Markdown-Struktur der Datei bei. Ändere nur Inhalte, nicht Überschriften.
7. Gib NUR den aktualisierten Dateiinhalt zurück — kein Kommentar, kein Markdown-Wrapper, kein Präambel.`,
  },
  {
    id: 'ai-prompt-text-refine',
    name: 'Text Überarbeiten',
    relativePath: 'text-refine',
    enabled: true,
    category: 'ai-prompt' as const,
    content: `Du bist ein präziser Textverbesserer. Überarbeite den gegebenen Text — verbessere Klarheit, Struktur und Präzision, ohne den inhaltlichen Sinn zu verändern. Gib NUR den überarbeiteten Text zurück, ohne Kommentar oder Erklärung.`,
  },
  {
    id: 'ai-prompt-user-story-format',
    name: 'User Story Formatierung',
    relativePath: 'user-story-format',
    enabled: true,
    category: 'ai-prompt' as const,
    content: `Du bist ein erfahrener Product Owner. Forme den folgenden Text in eine vollständige User Story um.

Antworte exakt in diesem Format (ohne zusätzlichen Text davor oder danach):

**Titel:** [prägnanter Titel]

**User Story:**
Als [Rolle] möchte ich [Funktion], damit [Nutzen].

**Akzeptanzkriterien:**
- [ ] ...
- [ ] ...

**Testfälle:**
1. **[Testfall-Name]:** [Schritte und erwartetes Ergebnis]`,
  },
  {
    id: 'ai-prompt-start-detect',
    name: 'App-Start erkennen (Play)',
    relativePath: 'start-detect',
    enabled: true,
    category: 'ai-prompt' as const,
    content: `Du analysierst ein Software-Projekt und ermittelst den exakten Befehl zum Starten des Dev-Servers.{{portHint}}

Verfügbare Binaries auf diesem System: {{availableList}}
Python-Binary auf diesem System: {{pythonBin}}
Node-Binary auf diesem System: {{nodeBin}}

Antworte NUR mit einem JSON-Objekt (kein Markdown):
{"startCmd": "{{pythonBin}} server.py"}

Regeln:
- Verwende IMMER die oben genannten verfügbaren Binaries — niemals andere
- Lies den Code GENAU — unterscheide besonders bei Python:
  • Hat die Datei "if __name__ == '__main__': app.run(...)" → Befehl ist "{{pythonBin}} dateiname.py" (NICHT flask run)
  • Hat die Datei KEINE main-Block-app.run → dann "flask run --port PORT"
- Schließe den Port IMMER ein:
  • python direkt:   PORT=5001 {{pythonBin}} server.py
  • flask run:       flask run --port 5001
  • node direkt:     PORT=3000 {{nodeBin}} index.js
  • npm script:      PORT=3000 npm start
  • vite (WICHTIG):  npm run dev -- --port 3000  ← NIEMALS PORT=... npm run dev bei Vite!
  • next.js:         npm run dev -- --port 3000
  • react-scripts:   PORT=3000 npm start
- Vite erkennen: package.json enthält "vite" in devDependencies oder scripts → IMMER -- --port nutzen
- PORT=... npm run dev funktioniert bei Vite NICHT — nur -- --port
- Port wird vor dem Start automatisch freigegeben — kein kill nötig
- Nur JSON zurückgeben, keine Erklärung`,
  },
  {
    id: 'ai-prompt-context-search',
    name: 'Kontext Research (Research-Tab)',
    relativePath: 'context-search',
    enabled: true,
    category: 'ai-prompt' as const,
    content: `Du bist ein Kontext-Analyst für ein Software-Entwicklungsprojekt. Du bekommst die Chat-Historie und eine Suchanfrage.

Antworte AUSSCHLIESSLICH als gültiges JSON-Objekt (kein Markdown drumherum, nur reines JSON):
{
  "humanSummary": "2-4 Sätze: Was wurde gemacht, was ist der aktuelle Stand. Knapp und direkt — keine langen Absätze.",
  "detailed": "Stichpunktartige Auflistung (Bullet-Format mit •). Nur was relevant zur Suchanfrage ist. Bei Listen-Anfragen (z.B. 'welche X wurden aufgerufen') einfach alle aufzählen. Maximal 15 Punkte.",
  "agentContext": "Englischer Kontext-Block für einen KI-Agenten. Format: TOPIC: ... | FILES: ... | HISTORY: ... (kompakt, nur das Wesentliche, max 400 Tokens)"
}`,
  },
  // ── Prompt Support ───────────────────────────────────────────────────────
  {
    id: 'prompt-support',
    name: 'Prompt Support',
    relativePath: '',
    enabled: true,
    category: 'prompt-support' as const,
    content: `Du bist ein erfahrener Software-Architekt. Du formulierst Implementierungsaufträge für Claude Code — direkt, technisch und präzise.

WICHTIG:
- Kein klassisches User-Story-Format ("Als Nutzer möchte ich...").
- Direkte Sprache, wie ein Senior Developer an Claude Code spricht.
- Orientiere dich an den bestehenden Patterns und Architektur aus der Dokumentation.
- Erkenne Abhängigkeiten zu anderen Komponenten.
- Beachte UI-Konsistenz: neue Bereiche sollen so aussehen wie bestehende.

ANTWORT-FORMAT (exakt so, kein Prolog/Epilog):

**Titel:** [prägnanter Titel]

## Aufgabe
[Was genau implementiert werden soll — klar, direkt]

## Betroffene Dateien & Komponenten
[Basierend auf der Dokumentation: welche Dateien werden geändert/erstellt]

## Implementierungsdetails
[Technische Anforderungen, Patterns, Constraints — basierend auf der Doku-Architektur]

## Abhängigkeiten
[Andere Komponenten/Features/State die berücksichtigt werden müssen]

## Akzeptanzkriterien
- [ ] ...`,
  },
  // ── User Stories ──────────────────────────────────────────────────────────
  {
    id: 'user-story-analyse',
    name: 'Implementierungsauftrag',
    relativePath: 'analyse',
    enabled: true,
    category: 'user-story' as const,
    content: `Du bist ein erfahrener Software-Architekt. Du formulierst Implementierungsaufträge für Claude Code — direkt, technisch und präzise.

WICHTIG:
- Kein klassisches User-Story-Format ("Als Nutzer möchte ich...").
- Direkte Sprache, wie ein Senior Developer an Claude Code spricht.
- Orientiere dich an den bestehenden Patterns und Architektur aus der Dokumentation.
- Erkenne Abhängigkeiten zu anderen Komponenten.
- Beachte UI-Konsistenz: neue Bereiche sollen so aussehen wie bestehende.

ANTWORT-FORMAT (exakt so, kein Prolog/Epilog):

**Titel:** [prägnanter Titel]

## Aufgabe
[Was genau implementiert werden soll — klar, direkt]

## Betroffene Dateien & Komponenten
[Basierend auf der Dokumentation: welche Dateien werden geändert/erstellt]

## Implementierungsdetails
[Technische Anforderungen, Patterns, Constraints — basierend auf der Doku-Architektur]

## Abhängigkeiten
[Andere Komponenten/Features/State die berücksichtigt werden müssen]

## Akzeptanzkriterien
- [ ] ...`,
  },
]

export interface AppState {
  screen: Screen
  prevScreen: Screen
  pendingWorkshopTransfer: PendingWorkshopTransfer | null
  theme: Theme
  accent: string
  accentFg: string       // text colour on accent buttons/pills
  preset: string         // design preset id
  terminalTheme: string      // terminal colour scheme id
  terminalFontFamily: string // terminal font family
  terminalFontSize: number   // terminal font size (px)
  uiFont: string             // UI font family
  uiFontSize: number         // UI base font size (px)
  uiFontWeight: number       // UI base font weight (300/400/500/600)
  logoSize: number           // logo image height (px)
  showTitleBar: boolean      // show/hide top window chrome bar
  customTerminalColors: Record<string, string>  // key → hex, overrides terminal theme
  customUiColors: Record<string, string>        // css-var name → hex, persisted overrides
  logColors: { error: string; warn: string; info: string; debug: string }
  tokens: RepoToken[]    // repo/git tokens
  dangerMode: boolean
  activeProjectId: string
  activeSessionId: string
  projects: Project[]
  aliases: Alias[]
  templates: Template[]
  turns: TurnMessage[]
  inputValue: string
  newProjectOpen: boolean
  newSessionOpen: boolean
  newSessionPreKind: SessionKind | null
  notes: Record<string, string>        // sessionId → note text
  kanban: Record<string, KanbanTicket[]>  // projectId → tickets
  aiFunctionMap: Record<string, string>   // functionKey → OR model ID
  playwrightCheck: boolean
  localhostCheck: boolean
  groqApiKey: string
  voiceProvider: 'groq' | 'openai'
  /** @deprecated */ aiProviders: AIProvider[]
  /** @deprecated */ activeAiProvider: string
  terminalShortcuts: TerminalShortcut[]
  docTemplates: DocTemplate[]
  docApplying: Record<string, boolean>
  lastProjectPath: string
  openrouterKey: string
  githubToken: string
  codeReviewModel: string
  defaultManagerModel: string
  orbitMessages: Record<string, OrbitMessage[]>   // chatId → messages
  orbitMeta: Record<string, OrbitChatMeta>         // chatId → meta
  orbitChats: Record<string, string[]>             // projectId → [chatId, ...]
  activeOrbitChatId: Record<string, string>        // sessionId → chatId
  orbitCtxBefore: number                           // context window — messages before ref (orbit)
  orbitCtxAfter: number                            // context window — messages after ref (orbit)
  agentCtxBefore: number                           // context window — messages before ref (agent chat)
  agentCtxAfter: number                            // context window — messages after ref (agent chat)
  orbitCompressPrompt: string                      // prompt used to compress chat history
  orbitCompressModel: string                       // OR model used for compression
  agentContextMsgCount: number                     // how many messages to compress (default 20)
  agentCompressPrompt: string                      // compression prompt for agent sessions
  agentCompressModel: string                       // OR model for agent compression (default deepseek v4 flash)
  agentAutoCompressOnStart: boolean                // trigger background compression when session starts and tail exists
  agentTailMessageCount: number                    // how many raw tail messages to pass verbatim (0 = off)
  brainUpdatePrompt: string                        // template prompt for updateBrainWithAI ({brain},{messages},{date},{n},{projectName})
  orbitFavorites: Record<string, OrbitFavorite[]>  // projectId → favorites
  quickLinks:     QuickLink[]
  sidebarSections: SidebarSection[]
  utilitySections: RightSidebarSection[]
  layoutSections:  LayoutSection[]
  projectBrains: Record<string, ProjectBrainEntry>  // projectId → brain
  orbitChatsLoaded: Record<string, boolean>          // chatId → Supabase-fetch done (runtime only)
  dataLoaded: boolean                                // true once initial loadFromSupabase completes
  toasts: Toast[]
  claudeProviders: ClaudeProvider[]
  setupWizardDone: boolean
  preferredOrModels: string[]
  deletedProjectIds: string[]   // IDs intentionally removed by user — never restore from Supabase

  // Auth
  currentUser: CurrentUser | null
  setCurrentUser: (u: CurrentUser | null) => void

  // Admin
  adminEmails: string[]
  addAdminEmail: (email: string) => void
  removeAdminEmail: (email: string) => void

  // Integrationen
  supabaseUrl: string
  supabaseAnonKey: string
  supabaseServiceRoleKey: string
  cloudflareAccountId: string
  cloudflareR2AccessKeyId: string
  cloudflareR2SecretAccessKey: string
  cloudflareR2BucketName: string
  cloudflareR2Endpoint: string
  cloudflareR2PublicUrl: string

  setSupabaseUrl: (v: string) => void
  setSupabaseAnonKey: (v: string) => void
  setSupabaseServiceRoleKey: (v: string) => void
  setCloudflareAccountId: (v: string) => void
  setCloudflareR2AccessKeyId: (v: string) => void
  setCloudflareR2SecretAccessKey: (v: string) => void
  setCloudflareR2BucketName: (v: string) => void
  setCloudflareR2Endpoint: (v: string) => void
  setCloudflareR2PublicUrl: (v: string) => void

  setCustomTerminalColor: (key: string, value: string) => void
  resetCustomTerminalColors: () => void
  setCustomUiColor: (key: string, value: string) => void
  setCustomUiColors: (map: Record<string, string>) => void
  resetCustomUiColors: () => void
  setLogColor: (level: 'error' | 'warn' | 'info' | 'debug', color: string) => void
  resetLogColors: () => void

  resetUserData: () => void   // clears all user-scoped state before loading a different user
  setScreen: (s: Screen) => void
  openWorkshop: () => void
  closeWorkshop: () => void
  transferToAgent: (transfer: PendingWorkshopTransfer) => void
  clearWorkshopTransfer: () => void
  setTheme: (t: Theme) => void
  setAccent: (a: string) => void
  setAccentFg: (a: string) => void
  setPreset: (p: string) => void
  setTerminalTheme: (t: string) => void
  setTerminalFontFamily: (f: string) => void
  setTerminalFontSize: (s: number) => void
  setUiFont: (f: string) => void
  setUiFontSize: (s: number) => void
  setUiFontWeight: (w: number) => void
  setLogoSize: (s: number) => void
  setShowTitleBar: (v: boolean) => void
  addToken: (t: RepoToken) => void
  updateToken: (id: string, patch: Partial<Omit<RepoToken, 'id'>>) => void
  removeToken: (id: string) => void
  setDangerMode: (d: boolean) => void
  setActiveProject: (id: string) => void
  setActiveSession: (id: string) => void
  setInputValue: (v: string) => void
  setNewProjectOpen: (o: boolean) => void
  setNewSessionOpen: (o: boolean) => void
  setNewSessionPreKind: (k: SessionKind | null) => void
  setNote: (sessionId: string, text: string) => void
  setPlaywrightCheck: (v: boolean) => void
  setLocalhostCheck: (v: boolean) => void
  setGroqApiKey: (k: string) => void
  setVoiceProvider: (p: 'groq' | 'openai') => void
  /** @deprecated */ addAiProvider: (p: AIProvider) => void
  /** @deprecated */ updateAiProvider: (id: string, patch: Partial<Omit<AIProvider, 'id'>>) => void
  /** @deprecated */ removeAiProvider: (id: string) => void
  /** @deprecated */ setActiveAiProvider: (id: string) => void
  addProject: (p: Project) => void
  updateProject: (id: string, patch: Partial<Omit<Project, 'id'>>) => void
  removeProject: (id: string) => void
  reorderProjects: (ids: string[]) => void
  addSession: (projectId: string, s: Session) => void
  removeSession: (projectId: string, sessionId: string) => void
  clearAllSessions: () => void
  updateSession: (sessionId: string, patch: Partial<Omit<Session, 'id'>>) => void
  addAlias: (a: Alias) => void
  updateAlias: (id: string, patch: Partial<Omit<Alias, 'id'>>) => void
  removeAlias: (id: string) => void
  reorderAliases: (ids: string[]) => void
  addClaudeProvider: (p: ClaudeProvider) => void
  updateClaudeProvider: (id: string, patch: Partial<Omit<ClaudeProvider, 'id'>>) => void
  removeClaudeProvider: (id: string) => void
  addTemplate: (t: Template) => void
  updateTemplate: (id: string, patch: Partial<Omit<Template, 'id'>>) => void
  removeTemplate: (id: string) => void
  reorderTemplates: (fromIdx: number, toIdx: number) => void
  sendMessage: (attachments?: string[], text?: string) => void
  allowTool: (turnId: string) => void
  denyTool: (turnId: string) => void
  setAiFunctionMap: (key: string, providerId: string) => void
  updateTerminalShortcut: (id: string, patch: Partial<Omit<TerminalShortcut, 'id'>>) => void
  resetTerminalShortcuts: () => void
  addKanbanTicket: (projectId: string, ticket: Omit<KanbanTicket, 'id' | 'createdAt' | 'ticketNumber'>) => void
  updateKanbanTicket: (projectId: string, ticketId: string, patch: Partial<Omit<KanbanTicket, 'id' | 'createdAt'>>) => void
  moveKanbanTicket: (projectId: string, ticketId: string, status: KanbanStatus) => void
  removeKanbanTicket: (projectId: string, ticketId: string) => void
  addDocTemplate: (t: DocTemplate) => void
  updateDocTemplate: (id: string, patch: Partial<Omit<DocTemplate, 'id'>>) => void
  removeDocTemplate: (id: string) => void
  setDocTemplates: (templates: DocTemplate[]) => void
  setDocApplying: (projectId: string, applying: boolean) => void
  setLastProjectPath: (p: string) => void
  setOpenrouterKey: (key: string) => void
  setGithubToken: (token: string) => void
  setCodeReviewModel: (model: string) => void
  setDefaultManagerModel: (model: string) => void
  setOrbitCtxBefore: (n: number) => void
  setOrbitCtxAfter: (n: number) => void
  setAgentCtxBefore: (n: number) => void
  setAgentCtxAfter: (n: number) => void
  setOrbitCompressPrompt: (s: string) => void
  setOrbitCompressModel: (s: string) => void
  setAgentContextMsgCount: (agentContextMsgCount: number) => void
  setAgentCompressPrompt: (agentCompressPrompt: string) => void
  setAgentCompressModel: (agentCompressModel: string) => void
  setAgentAutoCompressOnStart: (v: boolean) => void
  setAgentTailMessageCount: (n: number) => void
  setBrainUpdatePrompt: (brainUpdatePrompt: string) => void
  addOrbitFavorite:  (fav: OrbitFavorite) => void
  setQuickLinks:     (links: QuickLink[]) => void
  setSidebarSections: (sections: SidebarSection[]) => void
  setUtilitySections: (sections: RightSidebarSection[]) => void
  setLayoutSections:  (sections: LayoutSection[]) => void
  addToast: (t: Omit<Toast, 'id'>) => string
  removeToast: (id: string) => void
  clearToasts: () => void
  removeOrbitFavorite: (projectId: string, favId: string) => void
  addOrbitMessage: (chatId: string, msg: OrbitMessage) => void
  setOrbitMessages: (chatId: string, msgs: OrbitMessage[]) => void
  clearOrbitMessages: (chatId: string) => void
  setOrbitMeta: (chatId: string, patch: OrbitChatMeta) => void
  createOrbitChat: (projectId: string, sessionId: string) => string
  setActiveOrbitChat: (sessionId: string, chatId: string) => void
  registerOrbitChats: (projectId: string, chatIds: string[]) => void
  removeOrbitChat: (projectId: string, chatId: string) => void
  setProjectBrain: (projectId: string, brain: ProjectBrainEntry) => void
  setProjectGithubToken: (projectId: string, tokenId: string | undefined) => void
  setOrbitChatLoaded: (chatId: string) => void
  setDataLoaded: (v: boolean) => void
  setSetupWizardDone: (v: boolean) => void
  setPreferredOrModels: (ids: string[]) => void
  isOnline: boolean
  setIsOnline: (v: boolean) => void
}

const DEMO_TURNS: TurnMessage[] = [
  {
    id: 't1', kind: 'user',
    content: 'Refactor the retry logic in charge-handler.ts — exponential backoff, max 5 attempts. Follow README rules.',
  },
  {
    id: 't2', kind: 'agent', alias: 'claude-code', model: 'sonnet-4.6', elapsed: '1.4s', tokens: '3.2k',
    content: "I'll start by reading the current implementation and the README, then propose minimal-diff changes.",
  },
  { id: 't3', kind: 'tool', toolName: 'Read', toolArgs: 'src/charge-handler.ts', toolLines: '86' },
  { id: 't4', kind: 'tool', toolName: 'Read', toolArgs: 'README.md', toolLines: '142' },
  { id: 't5', kind: 'tool', toolName: 'Grep', toolArgs: '"retry" in src/', toolMatches: '7' },
  {
    id: 't6', kind: 'agent',
    content: "The current handler retries on any error with linear delay. I'll switch to exponential backoff and only retry on transient failures (network, 5xx, rate-limit).",
    diff: true,
  },
  {
    id: 't7', kind: 'tool', toolName: 'Edit', toolArgs: 'src/charge-handler.ts',
    tone: 'accent', pendingApproval: true,
  },
  {
    id: 't8', kind: 'status', tone: 'warn',
    content: 'Permission required — write src/charge-handler.ts',
    pendingApproval: true,
  },
]

const DEMO_ALIASES: Alias[] = [
  { id: 'a1', name: 'claude-code', cmd: 'claude', args: '--model claude-sonnet-4-5', permMode: 'normal', status: 'ok' },
  { id: 'a2', name: 'minimax', cmd: 'minimax', args: '--model m1-coder', permMode: 'normal', status: 'ok' },
  { id: 'a3', name: 'aider', cmd: 'aider', args: '--no-auto-commit', permMode: 'normal', status: 'ok' },
  { id: 'a4', name: 'codex', cmd: 'codex', args: '--profile default', permMode: 'dangerous', status: 'warn' },
  { id: 'a5', name: 'claude-yolo', cmd: 'claude', args: '--dangerously-skip-permissions', permMode: 'dangerous', status: 'ok' },
]

const DEMO_TEMPLATES: Template[] = [
  { id: 'tp1', name: 'Analyze first', hint: '⌘1', body: 'Before making any changes, analyze the relevant files and explain your plan. Wait for approval.', tag: 'planning', uses: 124, favorite: true },
  { id: 'tp2', name: 'Minimal invasive changes', hint: '⌘2', body: 'Make the smallest possible diff. Do not rename, refactor, or move code unless explicitly asked.', tag: 'safety', uses: 89, favorite: true },
  { id: 'tp3', name: 'Follow README rules', hint: '⌘3', body: 'Read README.md and CONTRIBUTING.md first. Comply strictly with conventions, scripts, and gotchas listed.', tag: 'context', uses: 71 },
  { id: 'tp4', name: 'Write tests for diff', hint: '⌘4', body: 'For every change you make, add or update tests. Run them before reporting done.', tag: 'quality', uses: 56 },
  { id: 'tp5', name: 'Explain like reviewer', hint: '⌘5', body: 'Walk through the change as if reviewing a PR — what, why, risk, alternatives considered.', tag: 'review', uses: 33 },
  { id: 'tp6', name: 'Tracebug', hint: '⌘6', body: 'Reproduce the bug, identify root cause via tracing/logs only, then fix.', tag: 'debug', uses: 28 },
]

// ── File-based storage adapter ────────────────────────────────────────────────
// Reads/writes ~/.cc-ui-data.json via the Vite dev-server API.
// Active user ID for per-user file routing.
// Set on login, cleared on logout.
let _activeStorageUserId = ''
export const setActiveStorageUser = (id: string) => {
  _activeStorageUserId = id
  if (id) {
    localStorage.setItem('cc-user-id', id)
  } else {
    localStorage.removeItem('cc-user-id')
    localStorage.removeItem('cc-active-session')
    sessionStorage.removeItem('cc-active-session')
  }
}

const storeUrl = (base: string) =>
  _activeStorageUserId ? `${base}?userId=${encodeURIComponent(_activeStorageUserId)}` : base

// Per-user file storage: reads ~/.cc-ui-data-<userId>.json when logged in,
// falls back to ~/.cc-ui-data.json for anonymous use.
// On first read (no active user), bootstraps the userId from the shared file's currentUser.
const fileStorage = {
  getItem: async (_name: string): Promise<string | null> => {
    try {
      // Primary: use cached userId from localStorage (set on login, cleared on logout)
      const lsUid = localStorage.getItem('cc-user-id')
      const activeUid = _activeStorageUserId || lsUid || ''

      if (activeUid) {
        if (!_activeStorageUserId) _activeStorageUserId = activeUid
        const r = await fetch(`/api/store-read?userId=${encodeURIComponent(activeUid)}`)
        if (r.ok) {
          const text = await r.text()
          if (text && text !== 'null' && text.trim() !== '') return text
        }
      }

      // Fallback: read shared file (for users who haven't logged in yet, or first-ever launch)
      const r = await fetch('/api/store-read')
      if (!r.ok) throw new Error()
      const sharedText = await r.text()
      if (!sharedText || sharedText === 'null' || sharedText.trim() === '') return null

      // Legacy bootstrap: try to find userId in shared file for users upgrading from old version
      try {
        const parsed = JSON.parse(sharedText) as { state?: { currentUser?: { id?: string } } }
        const uid = parsed?.state?.currentUser?.id
        if (uid && !activeUid) {
          // Migrate: save to localStorage so future reloads use the fast path
          localStorage.setItem('cc-user-id', uid)
          _activeStorageUserId = uid
          const r2 = await fetch(`/api/store-read?userId=${encodeURIComponent(uid)}`)
          if (r2.ok) {
            const userText = await r2.text()
            if (userText && userText !== 'null') return userText
            // Seed user file from shared file
            await fetch(`/api/store-write?userId=${encodeURIComponent(uid)}`, {
              method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: sharedText,
            })
          }
        }
      } catch { /* shared file not parseable */ }
      return sharedText
    } catch {
      return localStorage.getItem(_name)
    }
  },
  setItem: async (_name: string, value: string): Promise<void> => {
    try {
      await fetch(storeUrl('/api/store-write'), {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: value,
      })
    } catch {
      localStorage.setItem(_name, value)
    }
  },
  removeItem: async (_name: string): Promise<void> => {
    try {
      await fetch(storeUrl('/api/store-write'), { method: 'POST', body: 'null' })
    } catch {
      localStorage.removeItem(_name)
    }
  },
}

export const useAppStore = create<AppState>()(persist((set, get) => ({
  screen: 'workspace',
  prevScreen: 'workspace',
  pendingWorkshopTransfer: null,
  theme: 'dark',
  accent: '#ff8a5b',
  accentFg: '#1a1410',
  preset: 'ember',
  terminalTheme: 'default',
  terminalFontFamily: 'jetbrains',
  terminalFontSize: 13,
  uiFont: 'system',
  uiFontSize: 13,
  uiFontWeight: 400,
  logoSize: 24,
  showTitleBar: true,
  customTerminalColors: {},
  customUiColors: {},
  logColors: { error: '#ef4444', warn: '#f59e0b', info: '#8b5cf6', debug: '#6b7280' },
  tokens: [],
  dangerMode: false,
  activeProjectId: '',
  activeSessionId: '',
  projects: [],
  aliases: DEMO_ALIASES,
  templates: DEMO_TEMPLATES,
  turns: [],
  inputValue: '',
  newProjectOpen: false,
  newSessionOpen: false,
  newSessionPreKind: null,
  notes: {},
  kanban: {},
  aiFunctionMap: {
    terminal:      'deepseek/deepseek-chat-v3-0324',
    kanban:        'deepseek/deepseek-chat-v3-0324',
    devDetect:     'deepseek/deepseek-chat-v3-0324',
    docUpdate:     'deepseek/deepseek-r1-0528',
    contextSearch: 'deepseek/deepseek-chat-v3-0324',
  },
  playwrightCheck: false,
  localhostCheck: false,
  groqApiKey: '',
  voiceProvider: 'groq' as const,
  aiProviders: [],
  activeAiProvider: '',
  terminalShortcuts: DEFAULT_TERMINAL_SHORTCUTS,
  docTemplates: DEFAULT_DOC_TEMPLATES,
  docApplying: {},
  lastProjectPath: '',
  openrouterKey: '',
  githubToken: '',
  codeReviewModel: 'deepseek/deepseek-chat-v3-0324',
  defaultManagerModel: 'anthropic/claude-sonnet-4-6',
  orbitMessages: {},
  orbitMeta: {},
  orbitChats: {},
  activeOrbitChatId: {},
  orbitCtxBefore: 2,
  orbitCtxAfter: 2,
  agentCtxBefore: 2,
  agentCtxAfter: 2,
  orbitCompressPrompt: `Du bist ein Kontext-Kompressor für Entwickler-Chats. Fasse den folgenden Chat-Verlauf in präzisen Stichpunkten zusammen.\n\nRegeln:\n- Nur entwicklungsrelevante Infos (Code, Dateipfade, Bugs, Entscheidungen, Architektur, Tools)\n- Kein Smalltalk, keine Begrüßungen, keine Wiederholungen, kein Lob\n- Bullet-Points (•), maximal 2–3 Zeilen pro Punkt\n- Technische Details (Dateinamen, Funktionsnamen, Fehlermeldungen) immer behalten\n- So kurz wie möglich — eine KI muss danach genau verstehen was besprochen und umgesetzt wurde\n- Max 25 Punkte`,
  orbitCompressModel: 'deepseek/deepseek-chat-v3-0324',
  agentContextMsgCount: 20,
  agentCompressPrompt: 'Du bist ein Kontext-Kompressor für Coding-Sessions. Fasse die folgende Session kurz und präzise zusammen — nur was technisch relevant ist: was gebaut/gefixt wurde, aktuelle Stand, offene Probleme, wichtige Dateien und Entscheidungen. Kein Smalltalk. Bullet-Points. Max 15 Punkte.',
  agentCompressModel: 'deepseek/deepseek-v4-flash:free',
  agentAutoCompressOnStart: true,
  agentTailMessageCount: 3,
  brainUpdatePrompt: '',
  orbitFavorites: {},
  quickLinks: [],
  sidebarSections: DEFAULT_SIDEBAR_SECTIONS,
  utilitySections: DEFAULT_RIGHT_SIDEBAR_SECTIONS,
  layoutSections:  DEFAULT_LAYOUT_SECTIONS,
  projectBrains: {},
  orbitChatsLoaded: {},
  dataLoaded: false,
  toasts: [],
  claudeProviders: [],
  setupWizardDone: false,
  preferredOrModels: [],
  deletedProjectIds: [],
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,

  currentUser: null,
  adminEmails: ['admin@codera.com'],

  supabaseUrl: 'https://fpphqkuizptypeawclsx.supabase.co',
  // Safe to ship: Supabase anon keys are intentionally public-facing (row-level security
  // enforces access control). Never store service_role key here.
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwcGhxa3VpenB0eXBlYXdjbHN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwMjY2ODksImV4cCI6MjA5MzYwMjY4OX0.A7n06LfElOmYPlzHpIGALAzEc1YK946pve-YsfJuSYk',
  supabaseServiceRoleKey: '',
  cloudflareAccountId: '',
  cloudflareR2AccessKeyId: '',
  cloudflareR2SecretAccessKey: '',
  cloudflareR2BucketName: '',
  cloudflareR2Endpoint: '',
  cloudflareR2PublicUrl: '',

  setCurrentUser: (currentUser) => set({ currentUser }),
  addAdminEmail:    (email) => set(s => ({ adminEmails: s.adminEmails.includes(email.toLowerCase()) ? s.adminEmails : [...s.adminEmails, email.toLowerCase()] })),
  removeAdminEmail: (email) => set(s => ({ adminEmails: s.adminEmails.filter(e => e !== email.toLowerCase()) })),

  resetUserData: () => set({
    // Clear ALL user-specific data so the next user starts with a blank slate
    projects:               [],
    activeProjectId:        undefined,
    activeSessionId:        undefined,
    orbitMessages:          {},
    orbitMeta:              {},
    orbitChats:             {},
    orbitChatsLoaded:       {},
    dataLoaded:             false,
    activeOrbitChatId:      {},
    orbitFavorites:         {},
    kanban:                 {},
    notes:                  {},
    projectBrains:          {},
    tokens:                 [],
    aliases:                [],
    templates:              [],
    docTemplates:           DEFAULT_DOC_TEMPLATES,
    claudeProviders:        [],
    quickLinks:             [],
    sidebarSections:        DEFAULT_SIDEBAR_SECTIONS,
    utilitySections:        DEFAULT_RIGHT_SIDEBAR_SECTIONS,
    layoutSections:         DEFAULT_LAYOUT_SECTIONS,
    deletedProjectIds:      [],
    // Credentials — must never bleed to another user
    openrouterKey:          '',
    groqApiKey:             '',
    supabaseServiceRoleKey: '',
    cloudflareAccountId:    '',
    cloudflareR2AccessKeyId: '',
    cloudflareR2SecretAccessKey: '',
    cloudflareR2BucketName: '',
    cloudflareR2Endpoint:   '',
    cloudflareR2PublicUrl:  '',
    aiFunctionMap:          { terminal: 'deepseek/deepseek-chat-v3-0324', kanban: 'deepseek/deepseek-chat-v3-0324', devDetect: 'deepseek/deepseek-chat-v3-0324', docUpdate: 'deepseek/deepseek-r1-0528', contextSearch: 'deepseek/deepseek-chat-v3-0324' },
    codeReviewModel:        'deepseek/deepseek-chat-v3-0324',
  }),

  setSupabaseUrl: (v) => set({ supabaseUrl: v }),
  setSupabaseAnonKey: (v) => set({ supabaseAnonKey: v }),
  setSupabaseServiceRoleKey: (v) => set({ supabaseServiceRoleKey: v }),
  setCloudflareAccountId: (v) => set({ cloudflareAccountId: v }),
  setCloudflareR2AccessKeyId: (v) => set({ cloudflareR2AccessKeyId: v }),
  setCloudflareR2SecretAccessKey: (v) => set({ cloudflareR2SecretAccessKey: v }),
  setCloudflareR2BucketName: (v) => set({ cloudflareR2BucketName: v }),
  setCloudflareR2Endpoint: (v) => set({ cloudflareR2Endpoint: v }),
  setCloudflareR2PublicUrl: (v) => set({ cloudflareR2PublicUrl: v }),

  setCustomTerminalColor: (key, value) => set(s => ({ customTerminalColors: { ...s.customTerminalColors, [key]: value } })),
  resetCustomTerminalColors: () => set({ customTerminalColors: {} }),
  setCustomUiColor: (key, value) => set(s => ({ customUiColors: { ...s.customUiColors, [key]: value } })),
  setCustomUiColors: (map) => set({ customUiColors: map }),
  resetCustomUiColors: () => set({ customUiColors: {} }),
  setLogColor: (level, color) => set(s => ({ logColors: { ...s.logColors, [level]: color } })),
  resetLogColors: () => set({ logColors: { error: '#ef4444', warn: '#f59e0b', info: '#8b5cf6', debug: '#6b7280' } }),

  setScreen: (screen) => set(s => ({ screen, prevScreen: s.screen })),
  openWorkshop: () => set(s => ({ screen: 'workshop', prevScreen: s.screen })),
  closeWorkshop: () => set(s => ({ screen: s.prevScreen === 'workshop' ? 'workspace' : s.prevScreen, prevScreen: 'workspace' })),
  transferToAgent: (transfer) => set(s => ({ pendingWorkshopTransfer: transfer, screen: s.prevScreen === 'workshop' ? 'workspace' : s.prevScreen })),
  clearWorkshopTransfer: () => set({ pendingWorkshopTransfer: null }),
  setTheme: (theme) => set({ theme }),
  setAccent: (accent) => set({ accent }),
  setAccentFg: (accentFg) => set({ accentFg }),
  setPreset: (preset) => set({ preset }),
  setTerminalTheme: (terminalTheme) => set({ terminalTheme }),
  setTerminalFontFamily: (terminalFontFamily) => set({ terminalFontFamily }),
  setTerminalFontSize: (terminalFontSize) => set({ terminalFontSize }),
  setUiFont: (uiFont) => set({ uiFont }),
  setUiFontSize: (uiFontSize) => set({ uiFontSize }),
  setUiFontWeight: (uiFontWeight) => set({ uiFontWeight }),
  setLogoSize: (logoSize) => set({ logoSize }),
  setShowTitleBar: (showTitleBar) => set({ showTitleBar }),
  addToken: (t) => set((s) => ({ tokens: [...s.tokens, t] })),
  updateToken: (id, patch) => set((s) => ({ tokens: s.tokens.map(t => t.id === id ? { ...t, ...patch } : t) })),
  removeToken: (id) => set((s) => ({ tokens: s.tokens.filter(t => t.id !== id) })),
  setDangerMode: (dangerMode) => set({ dangerMode }),
  setActiveProject: (activeProjectId) => set({ activeProjectId }),
  setActiveSession: (activeSessionId) => set({ activeSessionId }),
  setInputValue: (inputValue) => set({ inputValue }),
  setNewProjectOpen: (newProjectOpen) => set({ newProjectOpen }),
  setNewSessionOpen: (newSessionOpen) => set({ newSessionOpen }),
  setSetupWizardDone: (setupWizardDone) => set({ setupWizardDone }),
  setPreferredOrModels: (preferredOrModels) => set({ preferredOrModels }),
  setNewSessionPreKind: (newSessionPreKind) => set({ newSessionPreKind }),
  setNote: (sessionId, text) => set((s) => ({ notes: { ...s.notes, [sessionId]: text } })),
  setPlaywrightCheck: (v) => set({ playwrightCheck: v }),
  setLocalhostCheck: (v) => set({ localhostCheck: v }),
  setGroqApiKey: (groqApiKey) => set({ groqApiKey }),
  setVoiceProvider: (voiceProvider) => set({ voiceProvider }),
  addAiProvider: (p) => set((s) => ({ aiProviders: [...s.aiProviders, p], activeAiProvider: s.activeAiProvider || p.id })),
  updateAiProvider: (id, patch) => set((s) => ({ aiProviders: s.aiProviders.map(p => p.id === id ? { ...p, ...patch } : p) })),
  removeAiProvider: (id) => set((s) => {
    const remaining = s.aiProviders.filter(p => p.id !== id)
    return { aiProviders: remaining, activeAiProvider: s.activeAiProvider === id ? (remaining[0]?.id ?? '') : s.activeAiProvider }
  }),
  setActiveAiProvider: (activeAiProvider) => set({ activeAiProvider }),
  updateTerminalShortcut: (id, patch) => set((s) => ({
    terminalShortcuts: s.terminalShortcuts.map(sc => sc.id === id ? { ...sc, ...patch } : sc),
  })),
  resetTerminalShortcuts: () => set({ terminalShortcuts: DEFAULT_TERMINAL_SHORTCUTS }),

  addProject: (p) => set((s) => ({ projects: [...s.projects, p] })),
  updateProject: (id, patch) => set((s) => ({ projects: s.projects.map(p => p.id === id ? { ...p, ...patch } : p) })),
  reorderProjects: (ids) => set((s) => ({ projects: ids.map(id => s.projects.find(p => p.id === id)!).filter(Boolean) })),
  removeProject: (id) => set((s) => {
    const remaining = s.projects.filter((p) => p.id !== id)
    const project   = s.projects.find(p => p.id === id)
    const sessionIds = new Set(project?.sessions.map(sess => sess.id) ?? [])

    // Chat IDs belonging to this project
    const chatIds = new Set(s.orbitChats[id] ?? [])

    // Clean up orbit messages + meta for all chats of this project
    const orbitMessages    = { ...s.orbitMessages }
    const orbitMeta        = { ...s.orbitMeta }
    const orbitChatsLoaded = { ...s.orbitChatsLoaded }
    for (const chatId of chatIds) {
      delete orbitMessages[chatId]
      delete orbitMeta[chatId]
      delete orbitChatsLoaded[chatId]
    }

    // Clean up per-session state
    const notes            = { ...s.notes }
    const activeOrbitChatId = { ...s.activeOrbitChatId }
    for (const sessId of sessionIds) {
      delete notes[sessId]
      delete activeOrbitChatId[sessId]
    }

    // Clean up project-keyed maps
    const orbitChats    = { ...s.orbitChats };    delete orbitChats[id]
    const orbitFavorites = { ...s.orbitFavorites }; delete orbitFavorites[id]
    const projectBrains  = { ...s.projectBrains };  delete projectBrains[id]
    const kanban         = { ...s.kanban };          delete kanban[id]

    return {
      projects: remaining,
      activeProjectId:  s.activeProjectId === id ? (remaining[0]?.id ?? '') : s.activeProjectId,
      activeSessionId:  s.activeProjectId === id ? (remaining[0]?.sessions[0]?.id ?? '') : s.activeSessionId,
      deletedProjectIds: s.deletedProjectIds.includes(id) ? s.deletedProjectIds : [...s.deletedProjectIds, id],
      orbitMessages,
      orbitMeta,
      orbitChatsLoaded,
      orbitChats,
      orbitFavorites,
      projectBrains,
      kanban,
      notes,
      activeOrbitChatId,
    }
  }),

  addAlias: (a) => set((s) => ({ aliases: [...s.aliases, a] })),
  updateAlias: (id, patch) =>
    set((s) => ({ aliases: s.aliases.map((a) => a.id === id ? { ...a, ...patch } : a) })),
  removeAlias: (id) => set((s) => ({ aliases: s.aliases.filter((a) => a.id !== id) })),
  reorderAliases: (ids) => set((s) => ({
    aliases: ids.map(id => s.aliases.find(a => a.id === id)!).filter(Boolean),
  })),

  addClaudeProvider: (p) => set((s) => ({ claudeProviders: [...s.claudeProviders, p] })),
  updateClaudeProvider: (id, patch) => set((s) => ({ claudeProviders: s.claudeProviders.map(p => p.id === id ? { ...p, ...patch } : p) })),
  removeClaudeProvider: (id) => set((s) => ({ claudeProviders: s.claudeProviders.filter(p => p.id !== id) })),

  addTemplate: (t) => set((s) => ({ templates: [...s.templates, t] })),
  updateTemplate: (id, patch) =>
    set((s) => ({ templates: s.templates.map((t) => t.id === id ? { ...t, ...patch } : t) })),
  removeTemplate: (id) => set((s) => ({ templates: s.templates.filter((t) => t.id !== id) })),
  reorderTemplates: (fromIdx, toIdx) => set((s) => {
    const arr = [...s.templates]
    const [moved] = arr.splice(fromIdx, 1)
    arr.splice(toIdx, 0, moved)
    return { templates: arr }
  }),

  addSession: (projectId, session) =>
    set((s) => ({
      projects: s.projects.map((p) =>
        p.id === projectId ? { ...p, sessions: [...p.sessions, session] } : p
      ),
    })),
  updateSession: (sessionId, patch) =>
    set((s) => ({
      projects: s.projects.map((p) => ({
        ...p,
        sessions: p.sessions.map((sess) =>
          sess.id === sessionId ? { ...sess, ...patch } : sess
        ),
      })),
    })),
  removeSession: (projectId, sessionId) => set((s) => {
    const project = s.projects.find((p) => p.id === projectId)
    const remaining = project?.sessions.filter((sess) => sess.id !== sessionId) ?? []
    // Clean up note for removed session
    const notes = { ...s.notes }
    delete notes[sessionId]
    return {
      projects: s.projects.map((p) =>
        p.id === projectId ? { ...p, sessions: remaining } : p
      ),
      activeSessionId: s.activeSessionId === sessionId ? (remaining[0]?.id ?? '') : s.activeSessionId,
      notes,
    }
  }),
  clearAllSessions: () => set((s) => {
    const notes = { ...s.notes }
    s.projects.forEach(p => p.sessions.forEach(sess => { delete notes[sess.id] }))
    return {
      projects: s.projects.map(p => ({ ...p, sessions: [] })),
      activeSessionId: '',
      notes,
    }
  }),

  sendMessage: (attachments?: string[], text?: string) => {
    const { inputValue, turns } = get()
    const content = text ?? inputValue
    if (!content.trim() && !attachments?.length) return
    const userTurn: TurnMessage = { id: newAgentMsgId(get().activeSessionId ?? 'x'), kind: 'user', content, attachments }
    set({ turns: [...turns, userTurn], inputValue: '' })
  },
  allowTool: (turnId) =>
    set((s) => ({
      turns: s.turns.map((t) => t.id === turnId ? { ...t, pendingApproval: false } : t),
    })),
  denyTool: (turnId) =>
    set((s) => ({ turns: s.turns.filter((t) => t.id !== turnId) })),

  setAiFunctionMap: (key, providerId) => set((s) => ({ aiFunctionMap: { ...s.aiFunctionMap, [key]: providerId } })),

  addKanbanTicket: (projectId, ticket) => set((s) => {
    const existing = s.kanban[projectId] ?? []
    const nextNum = existing.reduce((max, t) => Math.max(max, t.ticketNumber ?? 0), 0) + 1
    const newTicket: KanbanTicket = {
      ...ticket,
      id: `kt-${Math.random().toString(36).slice(2, 8)}`,
      ticketNumber: nextNum,
      createdAt: Date.now(),
      priority: ticket.priority ?? 'medium',
      type: ticket.type ?? 'story',
    }
    return { kanban: { ...s.kanban, [projectId]: [...existing, newTicket] } }
  }),
  updateKanbanTicket: (projectId, ticketId, patch) => set((s) => ({
    kanban: {
      ...s.kanban,
      [projectId]: (s.kanban[projectId] ?? []).map(t => t.id === ticketId ? { ...t, ...patch } : t),
    },
  })),
  moveKanbanTicket: (projectId, ticketId, status) => set((s) => ({
    kanban: {
      ...s.kanban,
      [projectId]: (s.kanban[projectId] ?? []).map(t => t.id === ticketId ? { ...t, status } : t),
    },
  })),
  removeKanbanTicket: (projectId, ticketId) => set((s) => ({
    kanban: {
      ...s.kanban,
      [projectId]: (s.kanban[projectId] ?? []).filter(t => t.id !== ticketId),
    },
  })),
  addDocTemplate: (t) => set((s) => ({ docTemplates: [...s.docTemplates, t] })),
  updateDocTemplate: (id, patch) => set((s) => ({ docTemplates: s.docTemplates.map(t => t.id === id ? { ...t, ...patch } : t) })),
  removeDocTemplate: (id) => set((s) => ({ docTemplates: s.docTemplates.filter(t => t.id !== id) })),
  setDocTemplates: (templates) => set({ docTemplates: templates }),
  setDocApplying: (projectId, applying) => set((s) => ({ docApplying: { ...s.docApplying, [projectId]: applying } })),
  setLastProjectPath: (lastProjectPath) => set({ lastProjectPath }),
  setOpenrouterKey: (openrouterKey) => set({ openrouterKey }),
  setGithubToken: (githubToken) => set({ githubToken }),
  setCodeReviewModel: (codeReviewModel) => set({ codeReviewModel }),
  setDefaultManagerModel: (defaultManagerModel) => set({ defaultManagerModel }),
  setOrbitCtxBefore: (orbitCtxBefore) => set({ orbitCtxBefore }),
  setOrbitCtxAfter: (orbitCtxAfter) => set({ orbitCtxAfter }),
  setAgentCtxBefore: (agentCtxBefore) => set({ agentCtxBefore }),
  setAgentCtxAfter: (agentCtxAfter) => set({ agentCtxAfter }),
  setOrbitCompressPrompt: (orbitCompressPrompt) => set({ orbitCompressPrompt }),
  setOrbitCompressModel: (orbitCompressModel) => set({ orbitCompressModel }),
  setAgentContextMsgCount: (agentContextMsgCount) => set({ agentContextMsgCount }),
  setAgentCompressPrompt: (agentCompressPrompt) => set({ agentCompressPrompt }),
  setAgentCompressModel: (agentCompressModel) => set({ agentCompressModel }),
  setAgentAutoCompressOnStart: (agentAutoCompressOnStart) => set({ agentAutoCompressOnStart }),
  setAgentTailMessageCount: (agentTailMessageCount) => set({ agentTailMessageCount }),
  setBrainUpdatePrompt: (brainUpdatePrompt) => set({ brainUpdatePrompt }),
  setQuickLinks: (links) => set({ quickLinks: links }),
  setSidebarSections: (sections) => set({ sidebarSections: sections }),
  setUtilitySections: (sections) => set({ utilitySections: sections }),
  setLayoutSections:  (sections) => set({ layoutSections: sections }),
  addToast: (t) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    set(s => ({ toasts: [{ ...t, id }, ...s.toasts] }))
    return id
  },
  removeToast: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
  clearToasts: () => set({ toasts: [] }),
  addOrbitFavorite: (fav) => set(s => ({
    orbitFavorites: { ...s.orbitFavorites, [fav.projectId]: [...(s.orbitFavorites[fav.projectId] ?? []), fav] },
  })),
  removeOrbitFavorite: (projectId, favId) => set(s => ({
    orbitFavorites: { ...s.orbitFavorites, [projectId]: (s.orbitFavorites[projectId] ?? []).filter(f => f.id !== favId) },
  })),
  addOrbitMessage: (chatId, msg) => set(s => ({ orbitMessages: { ...s.orbitMessages, [chatId]: [...(s.orbitMessages[chatId] ?? []), msg] } })),
  setOrbitMessages: (chatId, msgs) => set(s => ({ orbitMessages: { ...s.orbitMessages, [chatId]: msgs } })),
  clearOrbitMessages: (chatId) => set(s => { const m = { ...s.orbitMessages }; delete m[chatId]; return { orbitMessages: m } }),
  setOrbitMeta: (chatId, patch) => set(s => ({ orbitMeta: { ...s.orbitMeta, [chatId]: { ...s.orbitMeta[chatId], ...patch } } })),
  createOrbitChat: (projectId, sessionId) => {
    const proj4 = projectId.replace(/[^a-z0-9]/gi, '').slice(-4).padStart(4, '0')
    const rand6 = Math.random().toString(36).slice(2, 8).padEnd(6, '0').slice(0, 6)
    const chatId = `oc-${proj4}-${rand6}`
    set(s => ({
      orbitChats: { ...s.orbitChats, [projectId]: [...(s.orbitChats[projectId] ?? []), chatId] },
      activeOrbitChatId: { ...s.activeOrbitChatId, [sessionId]: chatId },
    }))
    return chatId
  },
  setActiveOrbitChat: (sessionId, chatId) => set(s => ({ activeOrbitChatId: { ...s.activeOrbitChatId, [sessionId]: chatId } })),
  registerOrbitChats: (projectId, chatIds) => set(s => {
    const existing = new Set(s.orbitChats[projectId] ?? [])
    const merged = [...existing, ...chatIds.filter(id => !existing.has(id))]
    return { orbitChats: { ...s.orbitChats, [projectId]: merged } }
  }),
  removeOrbitChat: (projectId, chatId) => set(s => {
    const chats = (s.orbitChats[projectId] ?? []).filter(id => id !== chatId)
    const msgs = { ...s.orbitMessages }; delete msgs[chatId]
    const meta = { ...s.orbitMeta }; delete meta[chatId]
    const loaded = { ...s.orbitChatsLoaded }; delete loaded[chatId]
    return { orbitChats: { ...s.orbitChats, [projectId]: chats }, orbitMessages: msgs, orbitMeta: meta, orbitChatsLoaded: loaded }
  }),
  setProjectBrain: (projectId, brain) => set(s => ({ projectBrains: { ...s.projectBrains, [projectId]: brain } })),
  setProjectGithubToken: (projectId, tokenId) => set(s => ({
    projects: s.projects.map(p => p.id === projectId ? { ...p, githubTokenId: tokenId } : p)
  })),
  setOrbitChatLoaded: (chatId) => set(s => ({ orbitChatsLoaded: { ...s.orbitChatsLoaded, [chatId]: true } })),
  setDataLoaded: (dataLoaded) => set({ dataLoaded }),
}), {
  name: 'cc-app-state',
  storage: createJSONStorage(() => fileStorage),
  // Migrate old sessions that were saved without cmd/args
  onRehydrateStorage: () => (state) => {
    if (!state) return
    // Derive screen from currentUser — never restore 'login' from disk if user is set,
    // and never land on a stale overlay screen.
    state.screen = state.currentUser ? 'workspace' : 'login'
    // Migrate sessions missing cmd/args
    state.projects = state.projects.map(p => ({
      ...p,
      sessions: p.sessions.map(sess => {
        if (sess.cmd) return sess
        const alias = state.aliases.find(a => a.name === sess.alias)
        if (!alias) return sess
        const baseArgs = alias.args ?? ''
        const isDangerous = sess.permMode === 'dangerous' || alias.permMode === 'dangerous'
        const args = isDangerous && !baseArgs.includes('--dangerously-skip-permissions')
          ? (baseArgs ? baseArgs + ' --dangerously-skip-permissions' : '--dangerously-skip-permissions')
          : baseArgs
        return { ...sess, cmd: alias.cmd, args }
      }),
    }))
    // Migrate old devPort/devCmd field names → appPort/appStartCmd
    state.projects = state.projects.map(p => {
      const raw = p as unknown as Record<string, unknown>
      const migrated = { ...p }
      if (!migrated.appPort && raw['devPort']) migrated.appPort = raw['devPort'] as number
      if (!migrated.appStartCmd && raw['devCmd']) migrated.appStartCmd = raw['devCmd'] as string
      return migrated
    })
    // Ensure docTemplates always has defaults if not yet stored
    if (!state.docTemplates || state.docTemplates.length === 0) {
      state.docTemplates = DEFAULT_DOC_TEMPLATES
    }
    // Inject missing default AI prompts and user-story templates (idempotent — checks by id)
    for (const def of DEFAULT_DOC_TEMPLATES.filter(t => t.category === 'ai-prompt' || t.category === 'user-story')) {
      if (!state.docTemplates.find(t => t.id === def.id)) {
        state.docTemplates = [...state.docTemplates, def]
      }
    }
    // Ensure openrouterKey exists
    if (state.openrouterKey === undefined) state.openrouterKey = ''
    if (state.githubToken === undefined) state.githubToken = ''
    if (!state.codeReviewModel || state.codeReviewModel === 'anthropic/claude-sonnet-4-6') state.codeReviewModel = 'deepseek/deepseek-chat-v3-0324'
    if (state.defaultManagerModel === undefined) state.defaultManagerModel = 'anthropic/claude-sonnet-4-6'
    if (state.orbitCtxBefore === undefined) state.orbitCtxBefore = 2
    if (state.orbitCtxAfter === undefined) state.orbitCtxAfter = 2
    if (state.agentCtxBefore === undefined) state.agentCtxBefore = 2
    if (state.agentCtxAfter === undefined) state.agentCtxAfter = 2
    if (state.orbitFavorites === undefined) state.orbitFavorites = {}
    if (state.setupWizardDone === undefined) state.setupWizardDone = false
    if (state.preferredOrModels === undefined) state.preferredOrModels = []
    if (state.deletedProjectIds === undefined) state.deletedProjectIds = []
    if (!state.orbitCompressPrompt) state.orbitCompressPrompt = `Du bist ein Kontext-Kompressor für Entwickler-Chats. Fasse den folgenden Chat-Verlauf in präzisen Stichpunkten zusammen.\n\nRegeln:\n- Nur entwicklungsrelevante Infos (Code, Dateipfade, Bugs, Entscheidungen, Architektur, Tools)\n- Kein Smalltalk, keine Begrüßungen, keine Wiederholungen, kein Lob\n- Bullet-Points (•), maximal 2–3 Zeilen pro Punkt\n- Technische Details (Dateinamen, Funktionsnamen, Fehlermeldungen) immer behalten\n- So kurz wie möglich — eine KI muss danach genau verstehen was besprochen und umgesetzt wurde\n- Max 25 Punkte`
    if (!state.orbitCompressModel) state.orbitCompressModel = 'deepseek/deepseek-chat-v3-0324'
    if (!state.agentContextMsgCount) state.agentContextMsgCount = 20
    if (!state.agentCompressPrompt) state.agentCompressPrompt = 'Du bist ein Kontext-Kompressor für Coding-Sessions. Fasse die folgende Session kurz und präzise zusammen — nur was technisch relevant ist: was gebaut/gefixt wurde, aktuelle Stand, offene Probleme, wichtige Dateien und Entscheidungen. Kein Smalltalk. Bullet-Points. Max 15 Punkte.'
    if (!state.agentCompressModel) state.agentCompressModel = 'deepseek/deepseek-v4-flash:free'
    if (state.agentAutoCompressOnStart === undefined) state.agentAutoCompressOnStart = true
    if (state.agentTailMessageCount === undefined) state.agentTailMessageCount = 3
    if (state.projectBrains === undefined) state.projectBrains = {}
    if (state.orbitChatsLoaded === undefined) state.orbitChatsLoaded = {}
    if (!state.supabaseUrl) state.supabaseUrl = 'https://fpphqkuizptypeawclsx.supabase.co'
    if (!state.supabaseAnonKey) state.supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwcGhxa3VpenB0eXBlYXdjbHN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwMjY2ODksImV4cCI6MjA5MzYwMjY4OX0.A7n06LfElOmYPlzHpIGALAzEc1YK946pve-YsfJuSYk'
    if (state.supabaseServiceRoleKey === undefined) state.supabaseServiceRoleKey = ''
    if (state.cloudflareAccountId === undefined) state.cloudflareAccountId = ''
    if (state.cloudflareR2AccessKeyId === undefined) state.cloudflareR2AccessKeyId = ''
    if (state.cloudflareR2SecretAccessKey === undefined) state.cloudflareR2SecretAccessKey = ''
    if (state.cloudflareR2BucketName === undefined) state.cloudflareR2BucketName = ''
    if (state.cloudflareR2Endpoint === undefined) state.cloudflareR2Endpoint = ''
    if (state.cloudflareR2PublicUrl === undefined) state.cloudflareR2PublicUrl = ''
    if (state.currentUser === undefined) state.currentUser = null
    if (!state.sidebarSections || state.sidebarSections.length === 0) state.sidebarSections = DEFAULT_SIDEBAR_SECTIONS
    if (!state.utilitySections || state.utilitySections.length === 0) state.utilitySections = DEFAULT_RIGHT_SIDEBAR_SECTIONS
    if (!state.layoutSections  || state.layoutSections.length === 0)  state.layoutSections  = DEFAULT_LAYOUT_SECTIONS
    // Flush migrated values back to file storage so they persist across restarts
    // Use setTimeout(0) to let Zustand finish rehydration before triggering a set
    setTimeout(() => {
      useAppStore.setState({
        supabaseUrl:    state.supabaseUrl,
        supabaseAnonKey: state.supabaseAnonKey,
      })
    }, 0)
  },
  partialize: (s) => ({
    projects:        s.projects,
    aliases:         s.aliases,
    templates:       s.templates,
    theme:           s.theme,
    accent:          s.accent,
    accentFg:        s.accentFg,
    preset:          s.preset,
    terminalTheme:      s.terminalTheme,
    terminalFontFamily: s.terminalFontFamily,
    terminalFontSize:   s.terminalFontSize,
    uiFont:             s.uiFont,
    uiFontSize:         s.uiFontSize,
    uiFontWeight:       s.uiFontWeight,
    logoSize:        s.logoSize,
    showTitleBar:    s.showTitleBar,
    tokens:          s.tokens,
    activeProjectId: s.activeProjectId,
    activeSessionId: s.activeSessionId,
    notes:           s.notes,
    kanban:          s.kanban,
    aiFunctionMap:   s.aiFunctionMap,
    playwrightCheck: s.playwrightCheck,
    localhostCheck:  s.localhostCheck,
    groqApiKey:      s.groqApiKey,
    voiceProvider:   s.voiceProvider,
    aiProviders:     s.aiProviders,
    activeAiProvider: s.activeAiProvider,
    docTemplates:    s.docTemplates,
    lastProjectPath: s.lastProjectPath,
    openrouterKey:          s.openrouterKey,
    githubToken:            s.githubToken,
    codeReviewModel:        s.codeReviewModel,
    defaultManagerModel:    s.defaultManagerModel,
    orbitCtxBefore:         s.orbitCtxBefore,
    orbitCtxAfter:          s.orbitCtxAfter,
    orbitCompressPrompt:    s.orbitCompressPrompt,
    orbitCompressModel:     s.orbitCompressModel,
    agentContextMsgCount:   s.agentContextMsgCount,
    agentCompressPrompt:    s.agentCompressPrompt,
    orbitMessages:       s.orbitMessages,
    orbitMeta:           s.orbitMeta,
    orbitChats:          s.orbitChats,
    activeOrbitChatId:   s.activeOrbitChatId,
    orbitFavorites:      s.orbitFavorites,
    projectBrains:       s.projectBrains,
    claudeProviders:     s.claudeProviders,
    setupWizardDone:     s.setupWizardDone,
    preferredOrModels:   s.preferredOrModels,
    quickLinks:          s.quickLinks,
    sidebarSections:     s.sidebarSections,
    utilitySections:     s.utilitySections,
    layoutSections:      s.layoutSections,
    deletedProjectIds:   s.deletedProjectIds,
    currentUser:         s.currentUser,
    adminEmails:         s.adminEmails,
    supabaseUrl:              s.supabaseUrl,
    supabaseAnonKey:          s.supabaseAnonKey,
    // supabaseServiceRoleKey intentionally NOT persisted — stored server-side only
    cloudflareAccountId:      s.cloudflareAccountId,
    cloudflareR2AccessKeyId:  s.cloudflareR2AccessKeyId,
    cloudflareR2SecretAccessKey: s.cloudflareR2SecretAccessKey,
    cloudflareR2BucketName:   s.cloudflareR2BucketName,
    cloudflareR2Endpoint:     s.cloudflareR2Endpoint,
    cloudflareR2PublicUrl:    s.cloudflareR2PublicUrl,
  }),
}))
