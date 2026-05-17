// ── Workspace Widgets ─────────────────────────────────────────────────────────
// Shared UI cards used by both LeftSidebar and RightSidebar.
// Import from here — not directly from RightSidebar — to avoid cross-panel coupling.
//
// TODO: CompactGitCard, UserStoriesCard, CtxLogButton, SessionInfoCard are still
// defined in RightSidebar.tsx and re-exported here. They will be moved to their
// own files in a future refactoring step (after tab extraction in Task 4).

export { CompactGitCard, UserStoriesCard, CtxLogButton, SessionInfoCard } from '../RightSidebar'
export { QuickLinksWidget } from './QuickLinksWidget'
