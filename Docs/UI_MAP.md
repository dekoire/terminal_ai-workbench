# Codera AI — UI Map

## Screen-Routing (App.tsx)

| Screen | Trigger | Datei |
|--------|---------|-------|
| `login` | `screen === 'login'` | `screens/LoginScreen.tsx` |
| `workspace` | `screen === 'workspace'` | `workspace/Workspace.tsx` |
| `settings` | `screen === 'settings'` | `screens/AliasSettings.tsx` |
| `templates` | `screen === 'templates'` | `screens/PromptTemplates.tsx` |
| `history` | `screen === 'history'` | `screens/HistoryBrowser.tsx` |

## Modals (App-Level, über allem)

| Modal | Bedingung | Datei |
|-------|-----------|-------|
| New Project | `newProjectOpen === true` | `modals/NewProjectModal.tsx` |
| New Session | `newSessionOpen === true` | `modals/NewSessionModal.tsx` |

## Workspace-Layout (Workspace.tsx)

```
┌─────────────────────────────────────────────────────────────┐
│  Title bar (36px) — Logo · "Codera AI" · Theme · Logout     │
├───────────────┬──────────────────────────┬───────────────────┤
│  ProjectSide  │      CenterPane          │  UtilityPanel     │
│  bar (240px)  │                          │  (280px)          │
│               │  ProjectHeader (38px)    │                   │
│  App header   │  SessionTabs (34px)      │  [Session]        │
│  Projects     │  DangerBanner (opt.)     │  [Git]            │
│   └ Sessions  │  Terminal / FileViewer   │  [Files]          │
│  Templates    │    (flex: 1)             │  [Data]           │
│  User Stories │  ──────────────────────  │                   │
│               │  InputArea (220px)       │  Export bar       │
└───────────────┴──────────────────────────┴───────────────────┘
```

---

## Linke Sidebar — ProjectSidebar.tsx (Zeile 53)

- **App-Header**: Logo + "Codera AI" + Projektanzahl
- **Projekte**: Aufklappbare Liste
  - Projekt-Zeile: Ordner-Icon, Name, Git-Icon, Kanban-Icon, Dirty-Badge
  - Kontextmenü: Pfad kopieren, Name kopieren, In Finder öffnen, Repo öffnen, Löschen
  - Sessions darunter: Status-Dot, YOLO-Badge, Session-Name, Alias-Tag
  - "New session" Button pro Projekt
- **Prompt Templates**: Aufklappbar, Favoriten mit Stern, Rechtsklick-Menü
- **User Stories**: Aufklappbar (Kanban-Tickets)
- **Settings-Link** unten (⌘,)

---

## Center Pane — CenterPane.tsx (Zeile 40)

### ProjectHeader (38px)
- Git Branch, Dirty-Count, letzter Commit, Remote-Link

### SessionTabs (34px)
- Tab pro Session: Status-Dot (grün=active, grau=idle, rot=error, dash=exited)
- YOLO-Badge bei dangerous mode
- Datei-Tabs für geöffnete Dateien
- Schließen-Button pro Tab
- New Session Button (⌘T)

### DangerBanner
- Roter Warnbalken wenn `permMode === 'dangerous'`

### Terminal-Bereich (flex: 1)
- `XTermPane` — xterm.js Terminal (normal)
- `FileTabViewer` — wenn Datei-Tab aktiv
- `EmptyState` — wenn keine Session, zeigt Alias-Schnellstart-Karten

### InputArea (220px, unten)
- Textarea (Terminal-Eingabe oder Message-Mode)
- Datei-Anhang-Chip
- Voice-Input, AI-Refine-Button (✦)
- Send-Button
- Keyboard-Shortcuts-Modal (⌨ Icon)
- Automation-Checkboxen
- Favoriten-Templates Auto-Include

### Aktiver Befehls-Indikator (Bar zwischen Tabs und Terminal)
- Zeigt `aliasCmd` + `aliasArgs` der aktiven Session

---

## Rechtes Utility Panel — UtilityPanel.tsx (Zeile 812)

### Session-Tab
- Session-Info (Alias, Modell, Start-Zeit, Pfad, Branch)
- Notes-Feld
- Aliases-Liste (schneller Überblick)

### Git-Tab
- Branch-Management (checkout, new branch)
- Änderungen (staged/unstaged)
- Commit-Formular
- Push/Pull Buttons
- Commit-Log

### Files-Tab
- Live Dateibaum mit Kontextmenü (öffnen, Data Viewer, Tab öffnen, erstellen, löschen)

### Data-Tab
- Multi-Tab Datei-Viewer
- Suche, Suchen & Ersetzen
- Zeilennummern, Edit-Mode

### Export-Bar (unten)
- Terminal-Inhalt als txt/md/json exportieren

---

## Settings-Seite — AliasSettings.tsx

Sub-Tabs (NAV-Array Zeile 29):

| Tab | Panel-Funktion | Zweck |
|-----|----------------|-------|
| Aliases | `AliasesPanel` (Z.158) | CRUD + Drag-Reorder |
| Tokens | `TokensPanel` (Z.273) | Git-Tokens verwalten |
| Prompt templates | `TemplatesPanel` (Z.391) | Favoriten-Toggle |
| Appearance | `AppearancePanel` (Z.523) | Presets, Typography |
| Terminal | `TerminalFontPanel` (Z.454) | Font-Familie/Größe |
| Terminal-Befehle | `TerminalCommandsPanel` | Shortcut-Toggles |
| AI | `AIPanel` (Z.742) | AI-Provider konfigurieren |

---

## Alle Komponenten (Kurzübersicht)

| Komponente | Datei | Zweck |
|-----------|-------|-------|
| `Workspace` | `workspace/Workspace.tsx:68` | 3-Pane-Layout, Drag-Resize, Shortcuts |
| `ProjectSidebar` | `workspace/ProjectSidebar.tsx:53` | Projekt-Baum, Sessions, Templates |
| `CenterPane` | `workspace/CenterPane.tsx:40` | Tabs, Terminal, InputArea |
| `UtilityPanel` | `workspace/UtilityPanel.tsx:812` | 4-Tab: Session/Git/Files/Data |
| `KanbanBoard` | `workspace/KanbanBoard.tsx:42` | Vollbild-Kanban-Modal |
| `XTermPane` | `terminal/XTermPane.tsx:67` | xterm.js + WebSocket PTY |
| `DiffBlock` | `terminal/DiffBlock.tsx:21` | Code-Diff-Anzeige |
| `NewProjectModal` | `modals/NewProjectModal.tsx:10` | Projekt hinzufügen |
| `NewSessionModal` | `modals/NewSessionModal.tsx:11` | Terminal-Session starten |
| `DevPortModal` | `modals/DevPortModal.tsx:41` | Dev-Server-Port konfigurieren |
| `FolderBrowser` | `modals/FolderBrowser.tsx:16` | Ordner-Navigation |

## Primitives

| Komponente | Datei | Varianten |
|-----------|-------|-----------|
| Icons (30+) | `primitives/Icons.tsx` | I-Prefix, 11-14px, currentColor |
| `Pill` | `primitives/Pill.tsx` | 7 Tones: ok/warn/err/neutral/accent/info/muted |
| `Kbd` | `primitives/Kbd.tsx` | Tastatur-Taste Darstellung |
| `Avatar` | `primitives/Avatar.tsx` | User/Agent-Avatar |

## UI-Patterns

- **Status-Dot**: 6px Kreis, Farbe = Status (ok/warn/err/accent/fg-3)
- **Kontext-Menüs**: Fixed-Position, click-outside-to-close
- **Backdrop-Modals**: `rgba(8,7,5,0.65)` + `backdropFilter: blur()`
- **Drag-Divider**: 8px Hit-Area zwischen Panes, Accent-Farbe on-hover
- **Farb-Tokens**: `--accent`, `--danger`, `--ok`, `--warn`, `--fg-0..3`, `--bg-0..3`

## Interne Subkomponenten (nicht exportiert)

**ProjectSidebar.tsx**: `ProjectRow`, `SessionRow`, `TemplatesSection`, `CollapsibleSection`, `ContextMenu`

**CenterPane.tsx**: `SessionTabs`, `ProjectHeader`, `InputArea`, `TerminalPane`, `Turn`, `FileTabViewer`, `DangerBanner`, `EmptyState`, `AliasCard`

**UtilityPanel.tsx**: `FilesTab`, `GitTab`, `DataViewer`, `NotesCard`, `JsonNode`, `TextViewer`, `LiveTreeNode`

**KanbanBoard.tsx**: `NewTicketModal`, `TicketDetail`, `TicketCard`, `TicketModalShell`, `ModalFooter`
