import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type Screen = 'login' | 'workspace' | 'settings' | 'templates' | 'history'
export type Theme = 'dark' | 'light'
export type PermMode = 'normal' | 'dangerous'

export interface Session {
  id: string
  name: string
  alias: string
  status: 'active' | 'idle' | 'error'
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

export interface AppState {
  screen: Screen
  theme: Theme
  accent: string
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
  playwrightCheck: boolean
  localhostCheck: boolean

  setScreen: (s: Screen) => void
  setTheme: (t: Theme) => void
  setAccent: (a: string) => void
  setDangerMode: (d: boolean) => void
  setActiveProject: (id: string) => void
  setActiveSession: (id: string) => void
  setInputValue: (v: string) => void
  setNewProjectOpen: (o: boolean) => void
  setNewSessionOpen: (o: boolean) => void
  setNote: (sessionId: string, text: string) => void
  setPlaywrightCheck: (v: boolean) => void
  setLocalhostCheck: (v: boolean) => void
  addProject: (p: Project) => void
  removeProject: (id: string) => void
  addSession: (projectId: string, s: Session) => void
  removeSession: (projectId: string, sessionId: string) => void
  addAlias: (a: Alias) => void
  updateAlias: (id: string, patch: Partial<Omit<Alias, 'id'>>) => void
  removeAlias: (id: string) => void
  addTemplate: (t: Template) => void
  updateTemplate: (id: string, patch: Partial<Omit<Template, 'id'>>) => void
  removeTemplate: (id: string) => void
  sendMessage: (attachments?: string[]) => void
  allowTool: (turnId: string) => void
  denyTool: (turnId: string) => void
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
      { id: 's1', name: 'main · refactor retries', alias: 'claude-code', status: 'active', permMode: 'normal', startedAt: Date.now() - 6 * 60_000 },
      { id: 's2', name: 'tests · add jest cases', alias: 'minimax', status: 'idle', permMode: 'normal', startedAt: Date.now() - 42 * 60_000 },
      { id: 's3', name: 'logs · trace pdfgen', alias: 'codex', status: 'idle', permMode: 'normal', startedAt: Date.now() - 120 * 60_000 },
    ],
  },
  { id: 'p2', name: 'design-system', path: '~/code/ds', branch: 'main', sessions: [] },
  {
    id: 'p3', name: 'growth-dash', path: '~/code/growth', branch: 'exp/cohorts', dirty: 1,
    sessions: [
      { id: 's4', name: 'main · debug cohort sql', alias: 'aider', status: 'idle', permMode: 'normal', startedAt: Date.now() - 90 * 60_000 },
    ],
  },
  { id: 'p4', name: 'infra', path: '~/work/infra', branch: 'main', sessions: [] },
]

const DEMO_ALIASES: Alias[] = [
  { id: 'a1', name: 'claude-code', cmd: 'claude', args: '--model sonnet-4.6', permMode: 'normal', status: 'ok' },
  { id: 'a2', name: 'minimax', cmd: 'minimax', args: '--model m1-coder', permMode: 'normal', status: 'ok' },
  { id: 'a3', name: 'aider', cmd: 'aider', args: '--no-auto-commit', permMode: 'normal', status: 'ok' },
  { id: 'a4', name: 'codex', cmd: 'codex', args: '--profile default', permMode: 'dangerous', status: 'warn' },
  { id: 'a5', name: 'claude-yolo', cmd: 'claude', args: '--dangerously-skip-permissions', permMode: 'dangerous', status: 'ok' },
]

const DEMO_TEMPLATES: Template[] = [
  { id: 'tp1', name: 'Analyze first', hint: '⌘1', body: 'Before making any changes, analyze the relevant files and explain your plan. Wait for approval.', tag: 'planning', uses: 124 },
  { id: 'tp2', name: 'Minimal invasive changes', hint: '⌘2', body: 'Make the smallest possible diff. Do not rename, refactor, or move code unless explicitly asked.', tag: 'safety', uses: 89 },
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
  playwrightCheck: false,
  localhostCheck: false,

  setScreen: (screen) => set({ screen }),
  setTheme: (theme) => set({ theme }),
  setAccent: (accent) => set({ accent }),
  setDangerMode: (dangerMode) => set({ dangerMode }),
  setActiveProject: (activeProjectId) => set({ activeProjectId }),
  setActiveSession: (activeSessionId) => set({ activeSessionId }),
  setInputValue: (inputValue) => set({ inputValue }),
  setNewProjectOpen: (newProjectOpen) => set({ newProjectOpen }),
  setNewSessionOpen: (newSessionOpen) => set({ newSessionOpen }),
  setNote: (sessionId, text) => set((s) => ({ notes: { ...s.notes, [sessionId]: text } })),
  setPlaywrightCheck: (v) => set({ playwrightCheck: v }),
  setLocalhostCheck: (v) => set({ localhostCheck: v }),

  addProject: (p) => set((s) => ({ projects: [...s.projects, p] })),
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
}), {
  name: 'cc-app-state',
  storage: createJSONStorage(() => fileStorage),
  partialize: (s) => ({
    projects:        s.projects,
    aliases:         s.aliases,
    templates:       s.templates,
    theme:           s.theme,
    accent:          s.accent,
    activeProjectId: s.activeProjectId,
    activeSessionId: s.activeSessionId,
    notes:           s.notes,
    playwrightCheck: s.playwrightCheck,
    localhostCheck:  s.localhostCheck,
  }),
}))
