// ── Tab components for RightSidebar ──────────────────────────────────────────
// AiSearchTab is fully extracted. The remaining tabs (FilesTab, GitHubTab,
// GitTab, ChatTab, DataViewer) are still defined in RightSidebar.tsx and
// re-exported here. They will be moved to individual files in a future step
// once shared helper dependencies are resolved.

export { AiSearchTab } from './AiSearchTab'
export { LogsTab }    from './LogsTab'
// TODO: extract these tabs from RightSidebar.tsx:
// export { FilesTab }   from './FilesTab'
// export { GitHubTab }  from './GitHubTab'
// export { GitTab }     from './GitTab'
// export { ChatTab }    from './ChatTab'
// export { DataViewer } from './DataViewer'
