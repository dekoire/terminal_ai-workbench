# Codera AI — Coding Rules

## Architecture
- **No react-router**: Screen routing via Zustand `screen` state + conditional rendering in `App.tsx`
- **No separate backend**: All API logic in Vite dev-server plugin (`vite.config.ts`)
- **Single Zustand Store**: `useAppStore` holds ALL state (no slice pattern)
- **CSS Variables for Theming**: All colors via `--bg-*`, `--fg-*`, `--accent` etc.
- **Inline Styles**: All components use `style={}` objects — no CSS modules, no styled-components
- **Cross-Component Communication**: Custom events with `cc:`-prefix via `window.dispatchEvent`

## Naming Conventions
- **Components**: PascalCase, named exports
- **Files**: PascalCase for components (`Workspace.tsx`), camelCase for logic (`useAppStore.ts`)
- **Interfaces/Types**: PascalCase, defined in `useAppStore.ts`
- **Icons**: `I`-prefix (`IFolder`, `ITerminal`, `IChev`)
- **Custom Events**: `cc:`-prefix (`cc:terminal-paste`, `cc:open-file-tab`)

## Styling
- Tailwind via `@import "tailwindcss"` in `index.css` (v4 CSS-first)
- Custom CSS vars in `:root` block in `index.css`
- Theme-Toggle: `.theme-light` class on `<html>` + JS-controlled CSS variable overrides
- No Tailwind utility classes in components — all inline `style={{}}` with px values
- Design Tokens: `--r-xs` (3px) to `--r-xl` (14px) for border-radius

## TypeScript
- `strict: true`, `noUnusedLocals`, `noUnusedParameters`
- `verbatimModuleSyntax: true` → `import type` for type-only imports
- `erasableSyntaxOnly: true` → no enums, no namespaces
- No `any`

## Security
- API keys in `~/.cc-ui-data.json` (local, never sent externally except to configured AI provider)
- `~` in paths expanded server-side to `process.env.HOME`
- Git tokens managed via `RepoToken` store
- Never version `~/.cc-ui-data.json`

## Reusable Primitives

| Component | Path | When to use |
|-----------|------|------------|
| `Pill` | `primitives/Pill.tsx` | Status badges, labels (7 tone variants) |
| `Kbd` | `primitives/Kbd.tsx` | Keyboard shortcut display |
| `Avatar` | `primitives/Avatar.tsx` | User/agent avatars |
| Icons (30+) | `primitives/Icons.tsx` | Always import instead of inline SVG |
| `applyPreset()` | `theme/presets.ts` | Apply presets programmatically |

## Reusable Style Objects (defined in multiple files — TODO: extract to `primitives/styles.ts`)
- `btnPrimary`: accent bg, accent-fg text, 6px radius, weight 600
- `btnGhost`: transparent, line-strong border, fg-1 text
- `fieldLabel`: 10px, uppercase, letter-spacing 0.7, fg-3
- `fieldInput`: full width, mono, border line-strong, bg-2, fg-0

## Modal Pattern
- Backdrop: `rgba(8,7,5,0.65)` + `backdropFilter: blur(6px)` + `onClick` to close
- Shell: fixed `inset:0`, max-width, `bg-1`, `line-strong` border, rounded, shadow
- Footer: `btnPrimary` (confirm) + `btnGhost` (cancel)

## Known Duplicates (clean up when touched)
- `toRepoUrl()`: duplicated in `UtilityPanel.tsx:531` and `ProjectSidebar.tsx:153`
- Style objects: copy-pasted in each modal file
- `JsonNode`/`JsonObject`: duplicated in `UtilityPanel.tsx` and `CenterPane.tsx`

## Change Patterns

### New Screen
1. Create component in `src/components/screens/`
2. Add screen name to `Screen` type in `useAppStore.ts`
3. Add conditional rendering in `App.tsx`
4. Add navigation to `AliasSettings.tsx` NAV array or sidebar

### New Store Field
1. Add field + type to `AppState` interface
2. Create setter action
3. Add field to `partialize` array (line ~433)
4. Set default value in store initial state

### New API Route
1. Add middleware handler in `vite.config.ts` in `apiPlugin().configureServer`
2. Pattern: `server.middlewares.use('/api/route', handler)`
3. Return: `JSON.stringify({ ok: true, ... })`

### New Icon
1. Add SVG component in `primitives/Icons.tsx` with `I`-prefix

### Theme Change
1. Add/modify preset in `theme/presets.ts` (ACCENT_PRESETS)
2. Add CSS variables in `index.css` for new design tokens

### Terminal Change
- Client: `XTermPane.tsx`
- Server/PTY: `vite.config.ts` → `terminalPlugin()`

## Always Check These Files First
- `useAppStore.ts` — Store shape is the data contract
- `App.tsx` — Screen routing
- `theme/presets.ts` — Color/theme data
- `index.css` — Global design tokens
- `Icons.tsx` — Before SVG inline code