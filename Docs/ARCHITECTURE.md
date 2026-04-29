# Codera AI — Architecture

## Zweck
macOS GUI-Workbench für CLI-Coding-Agents (Claude Code, aider, DeepSeek, MiniMax etc.).
Wrapper-GUI mit Multi-Session-Management, Permissions, Templates, Git, File-Browser, Kanban.

## Tech Stack

| Layer | Technologie |
|-------|------------|
| UI | React 19, TypeScript 5.8, Vite 6 |
| Styling | Tailwind CSS 4 (CSS-first) + CSS Custom Properties |
| State | Zustand 5 (persist → `~/.cc-ui-data.json`) |
| Terminal | xterm.js 6 + node-pty (server-side PTY via WebSocket) |
| Backend | Vite dev-server Plugin mit inline API-Middleware |
| Build | TypeScript 5.8, ESLint 9 |

## Start / Build
```bash
cd cc-ui
npm install
npm run dev        # → http://localhost:4321
npm run build      # tsc -b && vite build
npm run lint       # eslint .
```

## Architektur-Entscheidungen
- **Single-Page-App**: Screens via Zustand `screen` state, kein react-router
- **Backend-in-Frontend**: Alle API-Routes in `vite.config.ts` als Vite-Middleware
- **Terminal**: Jede Session spawnt einen `node-pty` Prozess. WebSocket (`ws://host/ws/terminal`) streamt I/O zwischen xterm.js und PTY.
- **Persistenz**: File-basiert via `~/.cc-ui-data.json`, Fallback auf `localStorage`
- **Theming**: CSS Custom Properties auf `:root`, dark/light Toggle
- **Dev-Port**: 4321 (Hinweis: Chrome blockt Port 6000/X11)

## PTY-Spawn-Logik (vite.config.ts)
- Immer `zsh -li` starten (vollständig interaktive Login-Shell → .zshrc geladen)
- Bei Alias-Sessions: nach 600ms den Befehl per `ptyProc.write(cmd + '\r')` eintippen
- So funktionieren Shell-Aliases (cc-mini, cc-ds4pro etc.) zuverlässig

## Persistenz
- State-Key: `cc-app-state`
- Datei: `~/.cc-ui-data.json`
- Nur Felder in `partialize` (Zeile ~433 in `useAppStore.ts`) werden gespeichert

---

## Datenmodelle (store/useAppStore.ts)

```typescript
Session:      { id, name, alias, cmd, args, status, permMode, startedAt }
Project:      { id, name, path, branch, dirty?, sessions[] }
Alias:        { id, name, cmd, args, permMode, status }
Template:     { id, name, hint, body, tag, uses, favorite? }
KanbanTicket: { id, ticketNumber, title, text, status, priority, type, createdAt, images? }
RepoToken:    { id, label, host, token }
AIProvider:   { id, name, provider, apiKey, model }
TurnMessage:  { id, kind: 'user'|'agent'|'tool'|'status', ... }
```

Types:
- `Screen`: `'login' | 'workspace' | 'settings' | 'templates' | 'history'`
- `PermMode`: `'normal' | 'dangerous'`
- `KanbanStatus`: `'backlog' | 'testing' | 'done'`
- `TicketPriority`: `'low' | 'medium' | 'high' | 'critical'`

---

## API-Routes (alle in vite.config.ts, Zeile 17–396)

### File System API
| Route | Method | Params | Response |
|-------|--------|--------|----------|
| `/api/browse` | GET | `path` | `{ items: [{name, path, isDir}], currentPath }` |
| `/api/file-read` | GET | `path` | `{ ok, content, size, mtime }` (max 2MB) |
| `/api/file-write` | POST | `{ path, content }` | `{ ok }` |
| `/api/fs-create` | POST | `{ path, type: 'file'\|'dir' }` | `{ ok }` |
| `/api/fs-delete` | POST | `{ path }` | `{ ok }` (rekursiv) |
| `/api/pick-folder` | GET | `path` | `{ ok, path }` (macOS native) |
| `/api/pick-file` | GET | `path` | `{ ok, path }` |
| `/api/open` | GET | `path` | `{ ok }` |
| `/api/open-with` | GET | `path, app` | `{ ok }` |
| `/api/which` | GET | `cmd` | `{ ok, path }` (zsh -i, erkennt auch Shell-Aliases) |

### Git API
| Route | Method | Params | Response |
|-------|--------|--------|----------|
| `/api/git` | GET | `path` | `{ hasGit, status, log, branches, diffStat, remotes, lastCommit }` |
| `/api/git-action` | POST | `{ action, path, message?, remote?, branch? }` | `{ ok, out }` |
| `/api/git-remote` | GET | `path` | `{ ok, url }` |

Git actions: `stage`, `commit`, `push`, `pull`, `checkout`, `new-branch`

### Persistenz API
| Route | Method | Zweck |
|-------|--------|-------|
| `/api/store-read` | GET | `~/.cc-ui-data.json` lesen |
| `/api/store-write` | POST | `~/.cc-ui-data.json` schreiben |

### AI API
| Route | Method | Body | Response |
|-------|--------|------|----------|
| `/api/ai-refine` | POST | `{ provider, apiKey, model, text, systemPrompt? }` | `{ ok, text }` |

Provider: `anthropic`, `openai`, `deepseek`

### WebSocket Terminal
**Endpoint**: `ws://host/ws/terminal?sessionId=X`

**Client → Server**:
- `{ type: 'init', cmd, args, cwd, cols, rows }` — PTY starten
- `{ type: 'input', data }` — Tastatureingabe
- `{ type: 'resize', cols, rows }` — Terminal-Größe

**Server → Client**:
- `{ type: 'data', data }` — Terminal-Output
- `{ type: 'exit', exitCode }` — Prozess beendet

---

## Custom Events (Cross-Component-Kommunikation)

| Event | Detail | Von → Nach |
|-------|--------|-----------|
| `cc:open-file-tab` | `path: string` | LiveTreeNode → CenterPane |
| `cc:open-data-file` | `path: string` | LiveTreeNode → UtilityPanel |
| `cc:terminal-paste` | `text: string` | InputArea → XTermPane |
| `cc:terminal-send-raw` | `data: string` | InputArea → XTermPane |
| `cc:terminal-export` | `sessionId: string` | UtilityPanel → XTermPane |
| `cc:terminal-text` | `text: string` | XTermPane → UtilityPanel |
| `cc:goto-git-tab` | — | ProjectSidebar → UtilityPanel |
| `cc:fs-deleted` | `path: string` | DeleteModal → LiveTreeNode |
| `cc:terminal-refresh` | — | Modals → XTermPane (Neurender) |
