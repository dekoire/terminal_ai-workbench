# Codera AI — UI Map

## Screen / Route Structure

| Route | Component | Purpose |
|-------|-----------|---------|
| `login` | `screens/LoginScreen.tsx` | Login screen |
| `workspace` | `workspace/Workspace.tsx` | Main workspace interface |
| `settings` | `screens/AliasSettings.tsx` | Application settings |
| `templates` | `screens/PromptTemplates.tsx` | Manage prompt templates |
| `history` | `screens/HistoryBrowser.tsx` | View command history |

## Layout Structure

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

## Components

| Component | File | Purpose |
|-----------|------|---------|
| `Workspace` | `workspace/Workspace.tsx` | Main 3-pane layout |
| `ProjectSidebar` | `workspace/ProjectSidebar.tsx` | Project and session navigation |
| `CenterPane` | `workspace/CenterPane.tsx` | Primary terminal and input area |
| `UtilityPanel` | `workspace/UtilityPanel.tsx` | Session utilities |
| `KanbanBoard` | `workspace/KanbanBoard.tsx` | Kanban task management |
| `XTermPane` | `terminal/XTermPane.tsx` | Terminal interface |
| `DiffBlock` | `terminal/DiffBlock.tsx` | Code diff visualization |
| `NewProjectModal` | `modals/NewProjectModal.tsx` | Create new projects |
| `NewSessionModal` | `modals/NewSessionModal.tsx` | Start new terminal sessions |
| `DevPortModal` | `modals/DevPortModal.tsx` | Development port configuration |
| `FolderBrowser` | `modals/FolderBrowser.tsx` | Folder navigation |

## State / Data Flow

- Global state managed via React context
- Data flows through props and context hooks
- Terminal state communicated via WebSocket

## UI Patterns

- **Status Indicators**: Colored dots for session states
- **Context Menus**: Right-click menus for quick actions
- **Modal Dialogs**: Centered with backdrop blur
- **Drag Handles**: Accent-colored dividers for pane resizing
- **Color Themes**: Defined via CSS variables for consistency