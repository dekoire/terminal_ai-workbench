# Codera AI

macOS GUI-Workbench für CLI-Coding-Agents (Claude Code, aider, DeepSeek, MiniMax etc.)
Stack: React 19 + TypeScript + Vite 6 + Zustand 5 + xterm.js + node-pty
Start: `cd cc-ui && npm run dev` → http://localhost:4321

## Kritische Regeln (immer gültig)
- Inline styles (`style={}`), keine CSS-Module, keine styled-components
- Kein react-router — Zustand `screen` state + konditionelles Rendering in `App.tsx`
- Keine neuen npm-Abhängigkeiten ohne Rückfrage
- TypeScript strict: kein `any`, kein unused, `import type` für type-only imports
- Icons: nur aus `primitives/Icons.tsx` (I-Prefix) — kein SVG inline in Komponenten
- Store-Mutationen nur über Zustand-Actions in `useAppStore.ts`
- `npx tsc --noEmit` nach **jeder** Änderung ausführen

## Welche Datei wann lesen

| Aufgabe | Datei |
|---------|-------|
| UI-Änderung / neue Komponente | `Docs/UI_MAP.md` |
| Neue Funktion / Architektur-Frage | `Docs/ARCHITECTURE.md` |
| Coding-Pattern / Reuse / Naming | `Docs/RULES.md` |
| Testen / Verifizieren | `Docs/TESTING.md` |
| Abhängigkeiten tracen ("was bricht wenn X") | `/graphify query "..."` |

## Schnellreferenz Schlüsseldateien
- State + alle Typen: `cc-ui/src/store/useAppStore.ts`
- Themes + Presets: `cc-ui/src/theme/presets.ts`
- Alle API-Routes + PTY: `cc-ui/vite.config.ts`
- CSS-Variablen: `cc-ui/src/index.css`
- Icons: `cc-ui/src/components/primitives/Icons.tsx`
- App-Routing: `cc-ui/src/App.tsx`
