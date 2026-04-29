import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type Screen = 'login' | 'workspace' | 'settings' | 'templates' | 'history'
export type Theme = 'dark' | 'light'
export type PermMode = 'normal' | 'dangerous'

export interface Session {
  id: string
  name: string
  alias: string
  cmd: string      // resolved at session creation — never stale
  args: string     // includes --dangerously-skip-permissions when permMode=dangerous
  status: 'active' | 'idle' | 'error' | 'exited'
  permMode: PermMode
  startedAt: number
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
}

export interface Alias {
  id: string
  name: string
  cmd: string
  args: string
  permMode: PermMode
  status: 'ok' | 'warn'
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

export interface AIProvider {
  id: string
  name: string
  provider: 'openai' | 'anthropic' | 'deepseek'
  apiKey: string
  model: string
}

export interface DocTemplate {
  id: string
  name: string
  relativePath: string
  content: string
  enabled: boolean
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
]

export interface AppState {
  screen: Screen
  theme: Theme
  accent: string
  accentFg: string       // text colour on accent buttons/pills
  preset: string         // design preset id
  terminalTheme: string      // terminal colour scheme id
  terminalFontFamily: string // terminal font family
  terminalFontSize: number   // terminal font size (px)
  uiFont: string             // UI font family
  uiFontSize: number         // UI base font size (px)
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
  notes: Record<string, string>        // sessionId → note text
  kanban: Record<string, KanbanTicket[]>  // projectId → tickets
  aiFunctionMap: Record<string, string>   // functionKey → providerId
  playwrightCheck: boolean
  localhostCheck: boolean
  aiProviders: AIProvider[]
  activeAiProvider: string
  terminalShortcuts: TerminalShortcut[]
  docTemplates: DocTemplate[]
  docApplying: Record<string, boolean>

  setScreen: (s: Screen) => void
  setTheme: (t: Theme) => void
  setAccent: (a: string) => void
  setAccentFg: (a: string) => void
  setPreset: (p: string) => void
  setTerminalTheme: (t: string) => void
  setTerminalFontFamily: (f: string) => void
  setTerminalFontSize: (s: number) => void
  setUiFont: (f: string) => void
  setUiFontSize: (s: number) => void
  addToken: (t: RepoToken) => void
  updateToken: (id: string, patch: Partial<Omit<RepoToken, 'id'>>) => void
  removeToken: (id: string) => void
  setDangerMode: (d: boolean) => void
  setActiveProject: (id: string) => void
  setActiveSession: (id: string) => void
  setInputValue: (v: string) => void
  setNewProjectOpen: (o: boolean) => void
  setNewSessionOpen: (o: boolean) => void
  setNote: (sessionId: string, text: string) => void
  setPlaywrightCheck: (v: boolean) => void
  setLocalhostCheck: (v: boolean) => void
  addAiProvider: (p: AIProvider) => void
  updateAiProvider: (id: string, patch: Partial<Omit<AIProvider, 'id'>>) => void
  removeAiProvider: (id: string) => void
  setActiveAiProvider: (id: string) => void
  addProject: (p: Project) => void
  updateProject: (id: string, patch: Partial<Omit<Project, 'id'>>) => void
  removeProject: (id: string) => void
  addSession: (projectId: string, s: Session) => void
  removeSession: (projectId: string, sessionId: string) => void
  clearAllSessions: () => void
  updateSession: (sessionId: string, patch: Partial<Omit<Session, 'id'>>) => void
  addAlias: (a: Alias) => void
  updateAlias: (id: string, patch: Partial<Omit<Alias, 'id'>>) => void
  removeAlias: (id: string) => void
  reorderAliases: (ids: string[]) => void
  addTemplate: (t: Template) => void
  updateTemplate: (id: string, patch: Partial<Omit<Template, 'id'>>) => void
  removeTemplate: (id: string) => void
  sendMessage: (attachments?: string[]) => void
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
  setDocApplying: (projectId: string, applying: boolean) => void
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

const DEMO_PROJECTS: Project[] = [
  {
    id: 'p1', name: 'payments-api', path: '~/code/payments-api', branch: 'feat/payment-retries', dirty: 3,
    sessions: [
      { id: 's1', name: 'main · refactor retries', alias: 'claude-code', cmd: 'claude', args: '--model claude-sonnet-4-5', status: 'active', permMode: 'normal', startedAt: Date.now() - 6 * 60_000 },
      { id: 's2', name: 'tests · add jest cases', alias: 'minimax', cmd: 'minimax', args: '--model m1-coder', status: 'idle', permMode: 'normal', startedAt: Date.now() - 42 * 60_000 },
      { id: 's3', name: 'logs · trace pdfgen', alias: 'codex', cmd: 'codex', args: '--profile default --dangerously-skip-permissions', status: 'idle', permMode: 'dangerous', startedAt: Date.now() - 120 * 60_000 },
    ],
  },
  { id: 'p2', name: 'design-system', path: '~/code/ds', branch: 'main', sessions: [] },
  {
    id: 'p3', name: 'growth-dash', path: '~/code/growth', branch: 'exp/cohorts', dirty: 1,
    sessions: [
      { id: 's4', name: 'main · debug cohort sql', alias: 'aider', cmd: 'aider', args: '--no-auto-commit', status: 'idle', permMode: 'normal', startedAt: Date.now() - 90 * 60_000 },
    ],
  },
  { id: 'p4', name: 'infra', path: '~/work/infra', branch: 'main', sessions: [] },
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
// Falls back to localStorage when the server is unreachable.
const fileStorage = {
  getItem: async (_name: string): Promise<string | null> => {
    try {
      const r = await fetch('/api/store-read')
      if (!r.ok) throw new Error('store-read failed')
      const text = await r.text()
      return text === 'null' || text.trim() === '' ? null : text
    } catch {
      return localStorage.getItem(_name)
    }
  },
  setItem: async (_name: string, value: string): Promise<void> => {
    try {
      await fetch('/api/store-write', {
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
      await fetch('/api/store-write', { method: 'POST', body: 'null' })
    } catch {
      localStorage.removeItem(_name)
    }
  },
}

export const useAppStore = create<AppState>()(persist((set, get) => ({
  screen: 'workspace',
  theme: 'dark',
  accent: '#ff8a5b',
  accentFg: '#1a1410',
  preset: 'ember',
  terminalTheme: 'default',
  terminalFontFamily: 'jetbrains',
  terminalFontSize: 13,
  uiFont: 'system',
  uiFontSize: 13,
  tokens: [],
  dangerMode: false,
  activeProjectId: 'p1',
  activeSessionId: 's1',
  projects: DEMO_PROJECTS,
  aliases: DEMO_ALIASES,
  templates: DEMO_TEMPLATES,
  turns: DEMO_TURNS,
  inputValue: '',
  newProjectOpen: false,
  newSessionOpen: false,
  notes: {},
  kanban: {},
  aiFunctionMap: {},
  playwrightCheck: false,
  localhostCheck: false,
  aiProviders: [],
  activeAiProvider: '',
  terminalShortcuts: DEFAULT_TERMINAL_SHORTCUTS,
  docTemplates: DEFAULT_DOC_TEMPLATES,
  docApplying: {},

  setScreen: (screen) => set({ screen }),
  setTheme: (theme) => set({ theme }),
  setAccent: (accent) => set({ accent }),
  setAccentFg: (accentFg) => set({ accentFg }),
  setPreset: (preset) => set({ preset }),
  setTerminalTheme: (terminalTheme) => set({ terminalTheme }),
  setTerminalFontFamily: (terminalFontFamily) => set({ terminalFontFamily }),
  setTerminalFontSize: (terminalFontSize) => set({ terminalFontSize }),
  setUiFont: (uiFont) => set({ uiFont }),
  setUiFontSize: (uiFontSize) => set({ uiFontSize }),
  addToken: (t) => set((s) => ({ tokens: [...s.tokens, t] })),
  updateToken: (id, patch) => set((s) => ({ tokens: s.tokens.map(t => t.id === id ? { ...t, ...patch } : t) })),
  removeToken: (id) => set((s) => ({ tokens: s.tokens.filter(t => t.id !== id) })),
  setDangerMode: (dangerMode) => set({ dangerMode }),
  setActiveProject: (activeProjectId) => set({ activeProjectId }),
  setActiveSession: (activeSessionId) => set({ activeSessionId }),
  setInputValue: (inputValue) => set({ inputValue }),
  setNewProjectOpen: (newProjectOpen) => set({ newProjectOpen }),
  setNewSessionOpen: (newSessionOpen) => set({ newSessionOpen }),
  setNote: (sessionId, text) => set((s) => ({ notes: { ...s.notes, [sessionId]: text } })),
  setPlaywrightCheck: (v) => set({ playwrightCheck: v }),
  setLocalhostCheck: (v) => set({ localhostCheck: v }),
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
  removeProject: (id) => set((s) => {
    const remaining = s.projects.filter((p) => p.id !== id)
    return {
      projects: remaining,
      activeProjectId: s.activeProjectId === id ? (remaining[0]?.id ?? '') : s.activeProjectId,
      activeSessionId: s.activeProjectId === id ? (remaining[0]?.sessions[0]?.id ?? '') : s.activeSessionId,
    }
  }),

  addAlias: (a) => set((s) => ({ aliases: [...s.aliases, a] })),
  updateAlias: (id, patch) =>
    set((s) => ({ aliases: s.aliases.map((a) => a.id === id ? { ...a, ...patch } : a) })),
  removeAlias: (id) => set((s) => ({ aliases: s.aliases.filter((a) => a.id !== id) })),
  reorderAliases: (ids) => set((s) => ({
    aliases: ids.map(id => s.aliases.find(a => a.id === id)!).filter(Boolean),
  })),

  addTemplate: (t) => set((s) => ({ templates: [...s.templates, t] })),
  updateTemplate: (id, patch) =>
    set((s) => ({ templates: s.templates.map((t) => t.id === id ? { ...t, ...patch } : t) })),
  removeTemplate: (id) => set((s) => ({ templates: s.templates.filter((t) => t.id !== id) })),

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

  sendMessage: (attachments?: string[]) => {
    const { inputValue, turns } = get()
    if (!inputValue.trim() && !attachments?.length) return
    const userTurn: TurnMessage = { id: `t${Date.now()}`, kind: 'user', content: inputValue, attachments }
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
      id: `kt${Date.now()}`,
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
  setDocApplying: (projectId, applying) => set((s) => ({ docApplying: { ...s.docApplying, [projectId]: applying } })),
}), {
  name: 'cc-app-state',
  storage: createJSONStorage(() => fileStorage),
  // Migrate old sessions that were saved without cmd/args
  onRehydrateStorage: () => (state) => {
    if (!state) return
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
      const raw = p as Record<string, unknown>
      const migrated = { ...p }
      if (!migrated.appPort && raw['devPort']) migrated.appPort = raw['devPort'] as number
      if (!migrated.appStartCmd && raw['devCmd']) migrated.appStartCmd = raw['devCmd'] as string
      return migrated
    })
    // Ensure docTemplates always has defaults if not yet stored
    if (!state.docTemplates || state.docTemplates.length === 0) {
      state.docTemplates = DEFAULT_DOC_TEMPLATES
    }
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
    uiFontSize:      s.uiFontSize,
    tokens:          s.tokens,
    activeProjectId: s.activeProjectId,
    activeSessionId: s.activeSessionId,
    notes:           s.notes,
    kanban:          s.kanban,
    aiFunctionMap:   s.aiFunctionMap,
    playwrightCheck: s.playwrightCheck,
    localhostCheck:  s.localhostCheck,
    aiProviders:     s.aiProviders,
    activeAiProvider: s.activeAiProvider,
    docTemplates:    s.docTemplates,
  }),
}))
