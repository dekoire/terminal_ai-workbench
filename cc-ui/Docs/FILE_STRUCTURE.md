# Codera AI — Datei- und Seitenstruktur

> Letzte Aktualisierung: Mai 2026  
> Stack: React 19 · TypeScript · Vite 6 · Zustand 5 · xterm.js · node-pty · Supabase

---

## Verzeichnisübersicht

```
cc-ui/
├── src/
│   ├── App.tsx                  ← Root-Komponente, Routing, globale Effekte
│   ├── main.tsx                 ← React-Einstiegspunkt
│   ├── vite-env.d.ts            ← Vite-Typ-Deklarationen
│   │
│   ├── store/
│   │   └── useAppStore.ts       ← Globaler Zustand (Zustand + persist)
│   │
│   ├── lib/                     ← Hooks & Helfer (kein UI)
│   │   ├── supabase.ts          ← Supabase-Client-Singleton
│   │   ├── supabaseSync.ts      ← Alle Supabase read/write Funktionen
│   │   ├── useSupabaseSync.ts   ← Orchestrator: ruft die 3 Sub-Hooks auf
│   │   ├── useAuthStateWatcher.ts  ← Supabase-Auth-Events + Inaktivitäts-Lock
│   │   ├── useUserDataLoader.ts    ← Lädt Nutzerdaten beim Login, lazy-chat-load
│   │   ├── useCloudSync.ts         ← Debounced Write-Back: Projekte, Sessions, etc.
│   │   ├── devLogger.ts         ← devLog/devWarn (tree-shaken im Prod-Build)
│   │   ├── agentSync.ts         ← Hilfsfunktionen für Agent-Session-Sync
│   │   ├── clipboard.ts         ← Clipboard-Zugriff-Wrapper
│   │   ├── ids.ts               ← ID-Generator-Funktionen (nanoid-basiert)
│   │   ├── projectBrain.ts      ← Projekt-Brain-Update-Logik (KI-Zusammenfassung)
│   │   └── resolveRefs.ts       ← Löst Workshop-ElementRefs auf (DOM-Selektor → Text)
│   │
│   ├── hooks/
│   │   └── useAppLauncher.ts    ← Zentraler Hook für App-Start-Lifecycle (Play-Button)
│   │
│   ├── utils/
│   │   ├── aiDetect.ts          ← KI-Erkennung von Dev-Server-Befehlen im Projekt
│   │   ├── launchUtils.ts       ← guessPort, readProjectConfig, writeProjectConfig
│   │   ├── orProvider.ts        ← OpenRouter-Provider-Helfer
│   │   ├── updateDocs.ts        ← Doc-Template-Update-Logik
│   │   └── useOpenRouterModels.ts  ← Hook: lädt verfügbare OR-Modelle
│   │
│   ├── theme/
│   │   └── presets.ts           ← Design-Presets (Farben, Akzente) + applyPreset()
│   │
│   └── components/
│       ├── screens/             ← Vollbild-Screens (ersetzen Workspace-View)
│       ├── workspace/           ← Haupt-Arbeitsbereiche (immer gemountet)
│       ├── agent/               ← KI-Agent-Ansichten (Chat, Orbit, Permissions)
│       ├── modals/              ← Dialog-Fenster (überlagern alles andere)
│       ├── primitives/          ← Wiederverwendbare UI-Bausteine
│       ├── terminal/            ← Terminal-Komponenten (xterm.js)
│       └── workshop/            ← UIWorkshop (Browser-Overlay + Draw-Tools)
│
├── server/
│   ├── index.ts                 ← Express-Server-Start (Vite-Dev-Server + API)
│   ├── state.ts                 ← Server-seitiger State (laufende Prozesse, PTY-Map)
│   └── routes/
│       ├── api.ts               ← REST-Endpunkte (/api/*)
│       └── ws.ts                ← WebSocket-Handler (PTY-Streams, Agent-Sessions)
│
├── Docs/                        ← Entwickler-Dokumentation
│   ├── FILE_STRUCTURE.md        ← Diese Datei
│   ├── UI_MAP.md                ← UI-Hierarchie und Screen-Übergänge
│   ├── ARCHITECTURE.md          ← Systemarchitektur
│   ├── RULES.md                 ← Coding-Konventionen
│   └── TESTING.md               ← Testanleitung
│
├── electron/                    ← Electron-Wrapper (macOS-App)
├── public/                      ← Statische Assets
└── vite.config.ts               ← Vite-Konfiguration + alle API-Routen
```

---

## Screens (`src/components/screens/`)

Screens sind vollständige Seitenansichten. Der aktive Screen wird in `useAppStore.screen` gespeichert und in `App.tsx` konditionell gerendert.

| Datei | Screen-Key | Beschreibung |
|-------|-----------|--------------|
| `LoginScreen.tsx` | `'login'` | Login-Formular (E-Mail + Passwort, Supabase-Auth) |
| `RegisterScreen.tsx` | `'register'` | Registrierungsformular (Name, E-Mail, Passwort + Bestätigung) |
| `AuthShared.tsx` | — | Shared-Bausteine für Login + Register: `AuthBackground`, `AuthBrandPanel`, `PasswordInput`, Style-Konstanten (`fieldLabel`, `fieldInput`, `btnPrimary`) |
| `AliasSettings.tsx` | `'settings'` | Einstellungen: Aliases, API-Keys, Provider, CLI-Config, Themes |
| `ProfileSettings.tsx` | `'profile'` | Profil bearbeiten: Name, Avatar, Passwort ändern |
| `PromptTemplates.tsx` | `'templates'` | Prompt-Vorlagen verwalten (CRUD) |
| `HistoryBrowser.tsx` | `'history'` | Session-Verlauf durchsuchen |
| `AdminPanel.tsx` | (overlay) | Admin-Ansicht (nur für Admin-E-Mails) |

### Screen-Übergänge

```
login ──── Anmelden ────────────────────────────────────► workspace
register ── Account erstellen ──────────────────────────► workspace
           └── (E-Mail-Bestätigung nötig) ──────────────► login

workspace ── Gear-Icon ─────────────────────────────────► settings
workspace ── Profil-Avatar ─────────────────────────────► profile
workspace ── Templates-Button ──────────────────────────► templates
workspace ── History-Button ────────────────────────────► history
workspace ── UIWorkshop-Button ─────────────────────────► workshop (Overlay)
settings/profile/templates/history ── Zurück-Button ───► workspace
```

---

## Workspace (`src/components/workspace/`)

Der Workspace bleibt **permanent gemountet** (auch wenn andere Screens aktiv sind), damit PTY-Verbindungen nicht unterbrochen werden.

| Datei | Beschreibung |
|-------|-------------|
| `Workspace.tsx` | Haupt-Layout: baut aus drei Spalten zusammen (`ProjectSidebar`, `CenterPane`, `UtilityPanel`) |
| `ProjectSidebar.tsx` | **Linke Spalte** — Projektliste, Session-Liste, Play-Button, Gear-Icon |
| `CenterPane.tsx` | **Mittlere Spalte** — Terminal (xterm.js via WebSocket), Agent-View-Umschalter, Session-Toolbar |
| `UtilityPanel.tsx` | **Rechte Spalte** — Tabs: Chat, Session, GitHub, Git Pro, Dateien, Data, Research, Monitoring |
| `KanbanBoard.tsx` | Kanban-Board (fullscreen-Modal, via `cc:open-kanban` Event) |
| `MonitoringPanel.tsx` | Monitoring-Tab: Live-Logs, Port-Status, Log-Filter des laufenden Dev-Servers |

### Spalten-Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ ProjectSidebar (240px) │   CenterPane (flex-1)   │ UtilityPanel │
│                        │                         │   (320px)    │
│  Projekte              │  Terminal / AgentView   │  Chat        │
│  └ Sessions            │  oder OrbitView         │  Session     │
│                        │                         │  GitHub      │
│  [▶ Play]              │                         │  Git Pro     │
│  [⚙ Gear]              │                         │  Dateien     │
│                        │                         │  Data        │
│                        │                         │  Research    │
│                        │                         │  Monitoring  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Agent-Komponenten (`src/components/agent/`)

| Datei | Beschreibung |
|-------|-------------|
| `AgentView.tsx` | Zeigt den Output einer laufenden Claude-Code-Session (PTY-Stream als strukturierte Karten) |
| `OrbitView.tsx` | KI-Chat-Interface (OpenRouter-Modelle: DeepSeek, Kimi etc.) mit Verlauf und Favoriten |
| `PermissionDialog.tsx` | Dialog wenn Claude um Erlaubnis fragt (Tool-Use-Bestätigung) |

---

## Modals (`src/components/modals/`)

Modals überlagern den gesamten Viewport (fixed, zIndex > 8000).

| Datei | Trigger | Beschreibung |
|-------|---------|-------------|
| `NewProjectModal.tsx` | `newProjectOpen` Store-State | Neues Projekt anlegen (Pfad, Name, Branch, Clone-URL) |
| `NewSessionModal.tsx` | `newSessionOpen` Store-State | Neue Agent-Session starten (Alias auswählen, Modus) |
| `SmartLaunchModal.tsx` | `useAppLauncher` `showModal` | App-Start bestätigen (Befehl + Port editierbar, Merken-Option) |
| `ModelBrowserModal.tsx` | Button in CenterPane/OrbitView | OpenRouter-Modell auswählen + Suche |
| `GettingStartedModal.tsx` | `setupWizardDone === false` | Einrichtungsassistent für neue Nutzer |
| `LayoutEditorModal.tsx` | Layout-Edit-Button | Sidebar-/Panel-Sektionen per Drag-and-Drop anordnen |

---

## Primitives (`src/components/primitives/`)

Wiederverwendbare, zustandslose UI-Bausteine.

| Datei | Beschreibung |
|-------|-------------|
| `Icons.tsx` | Alle Icons (I-Prefix, z.B. `ISpinner`, `ICheck`, `IWarn`). **Einzige Icon-Quelle** — kein SVG inline in Komponenten |
| `ToastContainer.tsx` | Globale Toast-Benachrichtigungen (oben rechts, gestapelt, Blur-Design) |
| `Avatar.tsx` | Nutzer-Avatar (Initialen-Fallback oder data-URL-Bild) |
| `MarkdownContent.tsx` | Markdown-Renderer für Chat-Nachrichten und Agent-Output |
| `FileAttachmentArea.tsx` | Drag-and-Drop-Bereich für Datei-Anhänge in Chat-Eingaben |
| `FileCard.tsx` | Darstellung einer angehängten Datei (Name, Größe, Remove-Button) |
| `ImageAnnotator.tsx` | Screenshot-Annotation (Pfeile, Rechtecke, Text) vor dem Senden |
| `CtxCard.tsx` | Kontext-Karte (zeigt referenzierte Dateien/Elemente in Nachrichten) |
| `GitHubRepoPicker.tsx` | GitHub-Repository-Suche + Auswahl (mit Token-Auth) |
| `Kbd.tsx` | Tastaturkürzel-Badge (`⌘K`, `Enter` etc.) |
| `Pill.tsx` | Status-Badge / Label-Chip |
| `SingleCombobox.tsx` | Einzel-Auswahl Dropdown mit Suchfeld |
| `MultiCombobox.tsx` | Mehrfach-Auswahl Dropdown mit Suchfeld |

---

## Terminal (`src/components/terminal/`)

| Datei | Beschreibung |
|-------|-------------|
| `XTermPane.tsx` | xterm.js Terminal-Instanz, verbunden via WebSocket mit `server/routes/ws.ts` (PTY) |
| `DiffBlock.tsx` | Git-Diff-Darstellung innerhalb der AgentView |
| `CrewTerminalMirror.tsx` | Read-only Terminal-Mirror für Crew/Multi-Agent-Ansichten |

---

## Workshop (`src/components/workshop/`)

Der UIWorkshop ist ein Overlay-Modal über dem Workspace — der Workspace bleibt darunter aktiv.

| Datei | Beschreibung |
|-------|-------------|
| `UIWorkshop.tsx` | Haupt-Container: Browser-Panel + Floating-Chat + Draw-Tools kombiniert |
| `BrowserPane.tsx` | Eingebetteter Browser (Electron `<webview>`) mit Navigation-Bar |
| `FloatingChatbox.tsx` | Chat-Eingabe die über dem Browser-Fenster schwebt |
| `DrawCanvas.tsx` | Freihand-Zeichnen auf dem Screenshot (vor dem Senden an KI) |
| `ScreenshotCrop.tsx` | Screenshot-Ausschnitt-Auswahl (Rechteck-Selektor) |

---

## Store (`src/store/useAppStore.ts`)

Einzelne Zustand-Datei für die gesamte App (Zustand 5 + persist Middleware).

### Wichtige State-Slices

| Slice | Typ | Beschreibung |
|-------|-----|-------------|
| `screen` | `Screen` | Aktiver Screen (`'login'` \| `'workspace'` \| `'settings'` \| …) |
| `currentUser` | `CurrentUser \| null` | Eingeloggter Nutzer (null = ausgeloggt) |
| `dataLoaded` | `boolean` | `true` sobald Supabase-Daten geladen sind (zeigt Spinner solange false) |
| `projects` | `Project[]` | Alle Projekte (mit Sessions) |
| `activeProjectId` | `string` | Aktuell ausgewähltes Projekt |
| `activeSessionId` | `string` | Aktuell aktive PTY-Session |
| `aliases` | `Alias[]` | Agent-Aliases (Befehle + Argumente) |
| `templates` | `Template[]` | Prompt-Vorlagen |
| `toasts` | `Toast[]` | Aktive Toast-Benachrichtigungen |
| `supabaseUrl` | `string` | Supabase-Projekt-URL |
| `supabaseAnonKey` | `string` | Supabase Public-Key (anon — RLS schützt die Daten) |
| `claudeProviders` | `ClaudeProvider[]` | Custom-AI-Provider (Kimi, DeepSeek etc.) |

### Persistenz

- **Primär:** Datei-basierter Storage via `/api/store-read` + `/api/store-write` → `~/.cc-ui-data-<userId>.json`
- **Fallback:** `localStorage` wenn API nicht erreichbar
- **Cloud:** Supabase (Settings, Projekte, Sessions, Chat-Nachrichten) — Supabase gewinnt bei Konflikten für Einstellungen, lokal gewinnt für Runtime-State

---

## Lib / Hooks (`src/lib/`, `src/hooks/`)

### Supabase-Schicht (Abhängigkeits-Kette)

```
useSupabaseSync.ts          ← Einstiegspunkt (App.tsx ruft diesen auf)
  ├── useAuthStateWatcher.ts   ← Auth-Events + Inaktivitäts-Lock
  ├── useUserDataLoader.ts     ← Login → DB-Load → Store-Merge
  └── useCloudSync.ts          ← Store-Änderungen → Supabase write-back
        ↑
   supabaseSync.ts             ← Alle read/write Funktionen (loadFromSupabase, saveSettings…)
        ↑
   supabase.ts                 ← Singleton-Client (getSupabase(url, key))
```

### Weitere Hooks / Libs

| Datei | Beschreibung |
|-------|-------------|
| `useAppLauncher.ts` | Zentraler Hook für App-Start-Lifecycle: Heuristik-Erkennung, SmartLaunchModal, Port-Polling |
| `aiDetect.ts` | KI-basierte Erkennung des Start-Befehls eines Projekts (analysiert package.json, pyproject.toml etc.) |
| `launchUtils.ts` | `guessPort()`, `readProjectConfig()`, `writeProjectConfig()` — für `project.config.json` |
| `devLogger.ts` | `devLog`/`devWarn` (DEV-only, tree-shaken im Prod-Build) |
| `ids.ts` | Eindeutige IDs generieren (`newAgentMsgId()` etc.) |
| `projectBrain.ts` | Projekt-Brain-Update: fasst Chat-Verlauf KI-gestützt zusammen |
| `agentSync.ts` | Sync-Helfer für Agent-Sessions |
| `clipboard.ts` | Clipboard read/write (Electron + Web) |
| `resolveRefs.ts` | Löst `WorkshopElementRef`s auf (DOM-Selector → lesbarer Text für KI) |
| `orProvider.ts` | OpenRouter-Provider-Konfiguration |
| `useOpenRouterModels.ts` | Hook: lädt verfügbare Modelle von OpenRouter API |
| `updateDocs.ts` | Aktualisiert Projekt-Dokumentations-Templates |

---

## Server (`server/`)

Der Vite-Dev-Server läuft als Express-App mit nativen API-Routen.

| Datei | Beschreibung |
|-------|-------------|
| `index.ts` | Server-Einstieg: Express-Setup, Vite-Middleware, Port 4321 |
| `state.ts` | Laufende PTY-Prozesse + Agent-Session-Map (server-side) |
| `routes/api.ts` | Alle REST-Endpunkte: Datei-I/O, Store-Read/Write, Shell-Aliases, Port-Check, App-Log, etc. |
| `routes/ws.ts` | WebSocket: PTY-Session-Lifecycle, JSON-Output-Parsing, Permission-Detection, Custom-Provider-Guard |

### Wichtige API-Endpunkte

| Endpunkt | Methode | Beschreibung |
|----------|---------|-------------|
| `/api/store-read` | GET | Liest `~/.cc-ui-data-<userId>.json` |
| `/api/store-write` | POST | Schreibt `~/.cc-ui-data-<userId>.json` |
| `/api/file-read` | GET | Liest beliebige Datei im System |
| `/api/file-write` | POST | Schreibt beliebige Datei |
| `/api/start-app` | POST | Startet Dev-Server-Prozess, gibt PID + LogFile zurück |
| `/api/check-port` | GET | Prüft ob Port belegt ist |
| `/api/process-status` | GET | Prüft ob PID noch läuft |
| `/api/app-log` | GET | Liest `/tmp/cc-app-<port>.log` (bis 100k Zeichen via `?chars=`) |
| `/api/zshrc-alias` | POST | Fügt Shell-Alias zu `~/.zshrc` hinzu |
| `/api/home` | GET | Gibt Home-Verzeichnis zurück |
| `/api/tweakcc/*` | POST | Claude-Code CLI-Config setzen und anwenden |

---

## Theme (`src/theme/presets.ts`)

Design-Presets definieren Farb-Paletten (Hintergrund, Vordergrund, Akzent). `applyPreset()` setzt CSS-Variablen auf `document.documentElement`.

CSS-Variablen (Auswahl):

| Variable | Bedeutung |
|----------|----------|
| `--bg-0` | Haupt-Hintergrund |
| `--bg-1` / `--bg-2` | Sekundäre Hintergründe |
| `--fg-0` / `--fg-1` / `--fg-2` / `--fg-3` | Vordergründe (primär → gedimmt) |
| `--accent` | Akzentfarbe (Buttons, Highlights) |
| `--accent-fg` | Text auf Akzent-Hintergrund |
| `--line` / `--line-strong` | Rahmen-Farben |
| `--ok` | Erfolgs-Grün |
| `--err` | Fehler-Rot |
| `--font-mono` | Monospace-Font (Terminal, Code) |
| `--font-ui` | UI-Font (konfigurierbar) |

---

## Routing-Logik (`App.tsx`)

Kein React-Router — Screen-Routing läuft über `useAppStore.screen` State:

```tsx
// Login / Register: vollständig gerendert, Workspace ist nicht gemountet
{screen === 'login'    && <LoginScreen />}
{screen === 'register' && <RegisterScreen />}

// Workspace: permanent gemountet (auch wenn andere Screens aktiv sind)
// → PTY-WebSocket-Verbindungen überleben Screen-Wechsel
{screen !== 'login' && screen !== 'register' && (
  <div style={{ display: workspaceActive ? 'flex' : 'none' }}>
    {!dataLoaded ? <Spinner /> : <Workspace />}
  </div>
)}

// Overlay-Screens (settings, profile, templates, history) überlagern den versteckten Workspace
{overlayScreen && (
  <div style={{ position: 'absolute', zIndex: 10 }}>
    {screen === 'settings'  && <AliasSettings />}
    {screen === 'profile'   && <ProfileSettings />}
    {screen === 'templates' && <PromptTemplates />}
    {screen === 'history'   && <HistoryBrowser />}
  </div>
)}

// Workshop: Blur-Overlay über dem Workspace (zIndex 9000)
{screen === 'workshop' && <UIWorkshop />}

// Toast-Notifications (fixed, immer sichtbar)
<ToastContainer />
```

---

## Namens-Konventionen

| Kategorie | Konvention | Beispiel |
|-----------|-----------|---------|
| Komponenten | PascalCase | `LoginScreen`, `ProjectSidebar` |
| Hooks | `use` + PascalCase | `useAppLauncher`, `useUserDataLoader` |
| Store-Actions | `set` + PascalCase | `setScreen`, `addToast` |
| Icons | `I` + PascalCase | `ISpinner`, `ICheck`, `IWarn` |
| API-Endpunkte | `/api/kebab-case` | `/api/store-read`, `/api/check-port` |
| CSS-Variablen | `--kebab-case` | `--bg-0`, `--accent-fg` |
| Libs (rein funktional) | camelCase | `supabaseSync`, `devLogger` |
