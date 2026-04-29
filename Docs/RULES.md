# Codera AI — Coding Rules

## Architektur-Regeln
- **Kein react-router**: Screen-Routing via Zustand `screen` state + konditionelles Rendering in `App.tsx`
- **Kein separates Backend**: Alle API-Logik im Vite dev-server Plugin (`vite.config.ts`)
- **Single Zustand Store**: `useAppStore` hält ALLEN State (kein Slice-Pattern)
- **CSS-Variablen für Theming**: Alle Farben über `--bg-*`, `--fg-*`, `--accent` etc.
- **Inline Styles**: Alle Komponenten nutzen `style={}` Objekte — keine CSS-Module, keine styled-components
- **Cross-Component-Kommunikation**: Custom Events mit `cc:`-Prefix via `window.dispatchEvent`

## Naming Conventions
- **Komponenten**: PascalCase, named exports
- **Dateien**: PascalCase für Komponenten (`Workspace.tsx`), camelCase für Logik (`useAppStore.ts`)
- **Interfaces/Types**: PascalCase, definiert in `useAppStore.ts`
- **Icons**: `I`-Prefix (`IFolder`, `ITerminal`, `IChev`)
- **Custom Events**: `cc:`-Prefix (`cc:terminal-paste`, `cc:open-file-tab`)

## Styling
- Tailwind via `@import "tailwindcss"` in `index.css` (v4 CSS-first)
- Custom CSS vars im `:root` Block in `index.css`
- Theme-Toggle: `.theme-light` Klasse auf `<html>` + JS-gesteuerte CSS-Variable-Overrides
- Keine Tailwind Utility-Klassen in Komponenten — alles inline `style={{}}` mit px-Werten
- Design Tokens: `--r-xs` (3px) bis `--r-xl` (14px) für border-radius

## TypeScript
- `strict: true`, `noUnusedLocals`, `noUnusedParameters`
- `verbatimModuleSyntax: true` → `import type` für type-only imports
- `erasableSyntaxOnly: true` → keine enums, keine namespaces
- Kein `any`

## State Management
- Alle Mutationen durch Zustand-Actions (kein direktes State-Manipulation)
- Nur persistierte Felder in `partialize` (Zeile ~433 in `useAppStore.ts`)
- Storage: `~/.cc-ui-data.json`, Fallback auf `localStorage`

## Security
- API-Keys in `~/.cc-ui-data.json` (lokal, nie extern gesendet außer zum konfigurierten AI-Provider)
- `~` in Pfaden wird server-seitig zu `process.env.HOME` expandiert
- Git-Tokens via `RepoToken`-Store verwaltet
- `~/.cc-ui-data.json` nie versionieren

## Reusable Primitives

| Komponente | Pfad | Wann nutzen |
|-----------|------|------------|
| `Pill` | `primitives/Pill.tsx` | Status-Badges, Labels (7 Tone-Varianten) |
| `Kbd` | `primitives/Kbd.tsx` | Tastaturkürzel-Anzeige |
| `Avatar` | `primitives/Avatar.tsx` | User/Agent-Avatare |
| Icons (30+) | `primitives/Icons.tsx` | Immer importieren statt SVG inline |
| `applyPreset()` | `theme/presets.ts` | Presets programmatisch anwenden |

## Reusable Style-Objekte (in mehreren Dateien definiert — TODO: nach `primitives/styles.ts` extrahieren)
- `btnPrimary`: accent bg, accent-fg text, 6px radius, weight 600
- `btnGhost`: transparent, line-strong border, fg-1 text
- `fieldLabel`: 10px, uppercase, letter-spacing 0.7, fg-3
- `fieldInput`: full width, mono, border line-strong, bg-2, fg-0

## Modal-Pattern
- Backdrop: `rgba(8,7,5,0.65)` + `backdropFilter: blur(6px)` + `onClick` zum Schließen
- Shell: fixed `inset:0`, max-width, `bg-1`, `line-strong` border, rounded, shadow
- Footer: `btnPrimary` (bestätigen) + `btnGhost` (abbrechen)

## Bekannte Duplikate (beim Anfassen bereinigen)
- `toRepoUrl()`: dupliziert in `UtilityPanel.tsx:531` und `ProjectSidebar.tsx:153`
- Style-Objekte: in jeder Modal-Datei copy-paste
- `JsonNode`/`JsonObject`: dupliziert in `UtilityPanel.tsx` und `CenterPane.tsx`

## Change Patterns

### Neuer Screen
1. Komponente in `src/components/screens/` erstellen
2. Screen-Name zu `Screen`-Type in `useAppStore.ts` hinzufügen
3. Konditionelles Rendering in `App.tsx` ergänzen
4. Navigation in `AliasSettings.tsx` NAV-Array oder Sidebar hinzufügen

### Neues Store-Feld
1. Feld + Typ in `AppState` Interface
2. Setter-Action erstellen
3. Feld in `partialize`-Array (Zeile ~433) hinzufügen
4. Default-Wert im Store-Initial-State setzen

### Neue API-Route
1. Middleware-Handler in `vite.config.ts` in `apiPlugin().configureServer`
2. Pattern: `server.middlewares.use('/api/route', handler)`
3. Rückgabe: `JSON.stringify({ ok: true, ... })`

### Neues Icon
1. SVG-Komponente in `primitives/Icons.tsx` mit `I`-Prefix

### Theme-Änderung
1. Preset in `theme/presets.ts` (ACCENT_PRESETS) hinzufügen/ändern
2. CSS-Variablen in `index.css` für neue Design-Tokens

### Terminal-Änderung
- Client: `XTermPane.tsx`
- Server/PTY: `vite.config.ts` → `terminalPlugin()`

## Dateien immer zuerst prüfen
- `useAppStore.ts` — Store-Shape ist der Datenvertrag
- `App.tsx` — Screen-Routing
- `theme/presets.ts` — Farb-/Theme-Daten
- `index.css` — globale Design-Tokens
- `Icons.tsx` — vor SVG-Inline-Code
