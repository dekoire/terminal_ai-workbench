Here's the updated file following the template structure while preserving all project-specific information:

# Codera AI

macOS GUI-Workbench für CLI-Coding-Agents (Claude Code, aider, DeepSeek, MiniMax etc.)
Stack: React 19 + TypeScript + Vite 6 + Zustand 5 + xterm.js + node-pty
Start: `cd cc-ui && npm run dev` → http://localhost:4321

## Critical Rules
- Inline styles (`style={}`), keine CSS-Module, keine styled-components
- Kein react-router — Zustand `screen` state + konditionelles Rendering in `App.tsx`
- Keine neuen npm-Abhängigkeiten ohne Rückfrage
- TypeScript strict: kein `any`, kein unused, `import type` für type-only imports
- Icons: nur aus `primitives/Icons.tsx` (I-Prefix) — kein SVG inline in Komponenten
- Store-Mutationen nur über Zustand-Actions in `useAppStore.ts`
- `npx tsc --noEmit` nach **jeder** Änderung ausführen

## Dev Server
- Start: `cd cc-ui && npm run dev`
- URL: http://localhost:4321
- Config: project.config.json

## Which file to read when

| Task | File |
|------|------|
| UI changes | Docs/UI_MAP.md |
| Architecture | Docs/ARCHITECTURE.md |
| Coding rules | Docs/RULES.md |
| Testing | Docs/TESTING.md |
| Dependency tracing | /graphify query "..." |

## Key Files
- `cc-ui/src/store/useAppStore.ts` — State + alle Typen
- `cc-ui/src/theme/presets.ts` — Themes + Presets
- `cc-ui/vite.config.ts` — Alle API-Routes + PTY
- `cc-ui/src/index.css` — CSS-Variablen
- `cc-ui/src/components/primitives/Icons.tsx` — Icons
- `cc-ui/src/App.tsx` — App-Routing

## Monitoring — project.config.json
When starting a dev server or app (npm run dev, uvicorn, python manage.py runserver, cargo run, etc.):
Detect the port from the output and write it to `project.config.json` in the project root:
```json
{ "port": 3000, "lastStarted": "2026-05-16T12:00:00.000Z" }
```
This enables the monitoring tab in the right panel to automatically display logs.
Use the file write tool: path = `<projectpath>/project.config.json`