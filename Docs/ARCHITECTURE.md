# Codera AI — Architecture

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript 5.8, Vite 6 |
| Styling | Tailwind CSS 4 (CSS-first) + CSS Custom Properties |
| State Management | Zustand 5 (persist → `~/.cc-ui-data.json`) |
| Terminal | xterm.js 6 + node-pty (server-side PTY via WebSocket) |
| Backend | Vite dev-server Plugin with inline API-Middleware |
| Build | TypeScript 5.8, ESLint 9 |

## Data Models

```typescript
interface Session { 
  id: string
  name: string
  alias: string
  cmd: string 
  args: string
  status: string
  permMode: 'normal' | 'dangerous'
  startedAt: string
}

interface Project {
  id: string
  name: string
  path: string
  branch: string
  dirty?: boolean
  sessions: Session[]
}

interface Template {
  id: string
  name: string
  hint: string
  body: string
  tag: string
  uses: number
  favorite?: boolean
}

interface KanbanTicket {
  id: string
  ticketNumber: string
  title: string
  text: string
  status: 'backlog' | 'testing' | 'done'
  priority: 'low' | 'medium' | 'high' | 'critical'
  type: string
  createdAt: string
  images?: string[]
}
```

## API Routes

### File System API
| Route | Method | Body/Params | Response |
|-------|--------|-------------|----------|
| `/api/browse` | GET | `path` | `{ items: [{name, path, isDir}], currentPath }` |
| `/api/file-read` | GET | `path` | `{ ok, content, size, mtime }` |
| `/api/file-write` | POST | `{ path, content }` | `{ ok }` |
| `/api/fs-create` | POST | `{ path, type: 'file'\|'dir' }` | `{ ok }` |
| `/api/fs-delete` | POST | `{ path }` | `{ ok }` |

### Git API
| Route | Method | Body/Params | Response |
|-------|--------|-------------|----------|
| `/api/git` | GET | `path` | `{ hasGit, status, log, branches, diffStat, remotes, lastCommit }` |
| `/api/git-action` | POST | `{ action, path, message?, remote?, branch? }` | `{ ok, out }` |

### AI API
| Route | Method | Body/Params | Response |
|-------|--------|-------------|----------|
| `/api/ai-refine` | POST | `{ provider, apiKey, model, text, systemPrompt? }` | `{ ok, text }` |

## Key Architectural Decisions
- **Single-Page-App**: Screens managed via Zustand `screen` state instead of react-router
- **Backend-in-Frontend**: All API routes implemented in `vite.config.ts` as Vite middleware
- **Terminal Communication**: Each session spawns a `node-pty` process. WebSocket (`ws://host/ws/terminal`) streams I/O between xterm.js and PTY
- **Persistence**: File-based storage via `~/.cc-ui-data.json`, with localStorage fallback
- **Theming**: Uses CSS Custom Properties on `:root` with dark/light toggle support
- **Development Port**: Uses port 4321 (Note: Chrome blocks port 6000/X11)

## External Services
- **Git**: Integrated for version control operations within projects
- **AI Providers**: Supports Anthropic, OpenAI, and DeepSeek for AI refinement features