import { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement>

const base = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

export const IFolder = (p: P) => <svg width="14" height="14" viewBox="0 0 16 16" strokeWidth="1.4" {...base} {...p}><path d="M2 4.5a1.5 1.5 0 0 1 1.5-1.5h2.4l1.6 1.6h5a1.5 1.5 0 0 1 1.5 1.5V12a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 12V4.5z"/></svg>
export const IFolderOpen = (p: P) => <svg width="14" height="14" viewBox="0 0 16 16" strokeWidth="1.4" {...base} {...p}><path d="M2 5.5V12a1.5 1.5 0 0 0 1.5 1.5h9a1.5 1.5 0 0 0 1.45-1.1L15.5 7H4.5L3 12"/><path d="M2 5.5V4a1.5 1.5 0 0 1 1.5-1.5h2.4l1.6 1.6h5A1.5 1.5 0 0 1 14 5.6V7"/></svg>
export const IChev = (p: P) => <svg width="10" height="10" viewBox="0 0 10 10" strokeWidth="1.5" {...base} {...p}><path d="M3 2l3 3-3 3"/></svg>
export const IChevDown = (p: P) => <svg width="10" height="10" viewBox="0 0 10 10" strokeWidth="1.5" {...base} {...p}><path d="M2 3l3 3 3-3"/></svg>
export const IPlus = (p: P) => <svg width="12" height="12" viewBox="0 0 12 12" strokeWidth="1.6" {...base} {...p}><path d="M6 2v8M2 6h8"/></svg>
export const IClose = (p: P) => <svg width="11" height="11" viewBox="0 0 12 12" strokeWidth="1.6" {...base} {...p}><path d="M3 3l6 6M9 3l-6 6"/></svg>
export const ISearch = (p: P) => <svg width="13" height="13" viewBox="0 0 14 14" strokeWidth="1.5" {...base} {...p}><circle cx="6" cy="6" r="4"/><path d="M9 9l3 3"/></svg>
export const ITerminal = (p: P) => <svg width="13" height="13" viewBox="0 0 14 14" strokeWidth="1.5" {...base} {...p}><path d="M2 4l3 3-3 3M7 10h5"/></svg>
export const IBolt = (p: P) => <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" {...p}><path d="M7 1L2.5 7H6l-1 4 4.5-6H6l1-4z"/></svg>
export const ISpark = (p: P) => <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" {...p}><path d="M6 1l1.2 3.3L10.5 5.5 7.2 6.7 6 10 4.8 6.7 1.5 5.5 4.8 4.3z"/></svg>
export const IGit = (p: P) => <svg width="13" height="13" viewBox="0 0 14 14" strokeWidth="1.4" {...base} {...p}><circle cx="3.5" cy="3" r="1.5"/><circle cx="3.5" cy="11" r="1.5"/><circle cx="10.5" cy="7" r="1.5"/><path d="M3.5 4.5v5M5 7h4M3.5 9.5c0-2 7-1 7-3"/></svg>
export const IBranch = (p: P) => <svg width="11" height="11" viewBox="0 0 12 12" strokeWidth="1.4" {...base} {...p}><circle cx="3" cy="2.5" r="1.2"/><circle cx="3" cy="9.5" r="1.2"/><circle cx="9" cy="6" r="1.2"/><path d="M3 3.7v4.6M3 8c0-1.5 4.8-1 4.8-2.5"/></svg>
export const ISettings = (p: P) => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a6.759 6.759 0 0 1 0 .255c-.008.378.137.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.241.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"/><path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"/></svg>
export const IHistory = (p: P) => <svg width="13" height="13" viewBox="0 0 14 14" strokeWidth="1.5" {...base} {...p}><path d="M4 10L10 4M10 4H5.5M10 4v4.5"/></svg>
export const IBookmark = (p: P) => <svg width="11" height="11" viewBox="0 0 12 12" strokeWidth="1.4" {...base} {...p}><path d="M3 1.5h6v9L6 8.5l-3 2z"/></svg>
export const IWarn = (p: P) => <svg width="12" height="12" viewBox="0 0 12 12" strokeWidth="1.5" {...base} {...p}><path d="M6 2L1 10.5h10z"/><path d="M6 5v2.5M6 9v.01"/></svg>
export const ICheck = (p: P) => <svg width="11" height="11" viewBox="0 0 12 12" strokeWidth="1.6" {...base} {...p}><path d="M2.5 6.5l2.5 2.5L10 3.5"/></svg>
export const IX = (p: P) => <svg width="11" height="11" viewBox="0 0 12 12" strokeWidth="1.6" {...base} {...p}><path d="M3 3l6 6M9 3l-6 6"/></svg>
export const ICopy = (p: P) => <svg width="12" height="12" viewBox="0 0 14 14" strokeWidth="1.4" {...base} {...p}><rect x="4" y="4" width="8" height="8" rx="1.5"/><path d="M2 9V3a1 1 0 0 1 1-1h6"/></svg>
export const ISend = (p: P) => <svg width="13" height="13" viewBox="0 0 14 14" strokeWidth="1.5" {...base} {...p}><path d="M2 7l10-5-3.5 11L7 8 2 7z"/></svg>
export const IMore = (p: P) => <svg width="13" height="3" viewBox="0 0 13 3" fill="currentColor" {...p}><circle cx="1.5" cy="1.5" r="1.2"/><circle cx="6.5" cy="1.5" r="1.2"/><circle cx="11.5" cy="1.5" r="1.2"/></svg>
export const IEdit = (p: P) => <svg width="12" height="12" viewBox="0 0 14 14" strokeWidth="1.4" {...base} {...p}><path d="M9.5 2.5l2 2L5 11l-2.5.5L3 9z"/></svg>
export const ITrash = (p: P) => <svg width="12" height="12" viewBox="0 0 14 14" strokeWidth="1.4" {...base} {...p}><path d="M2.5 4h9M5 4V2.5h4V4M4 4l.5 8h5L10 4"/></svg>
export const IDrag = (p: P) => <svg width="9" height="13" viewBox="0 0 9 13" fill="currentColor" {...p}><circle cx="2" cy="2" r="1"/><circle cx="7" cy="2" r="1"/><circle cx="2" cy="6.5" r="1"/><circle cx="7" cy="6.5" r="1"/><circle cx="2" cy="11" r="1"/><circle cx="7" cy="11" r="1"/></svg>
export const IShield = (p: P) => <svg width="12" height="12" viewBox="0 0 14 14" strokeWidth="1.4" {...base} {...p}><path d="M7 1.5L2 3.5v3.7c0 2.7 2.1 4.7 5 5.3 2.9-.6 5-2.6 5-5.3V3.5L7 1.5z"/></svg>
export const IFile = (p: P) => <svg width="12" height="12" viewBox="0 0 14 14" strokeWidth="1.4" {...base} {...p}><path d="M3 1.5h5l3 3V12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2.5a1 1 0 0 1 1-1z"/><path d="M8 1.5v3h3"/></svg>
export const IDrive = (p: P) => <svg width="13" height="13" viewBox="0 0 14 14" strokeWidth="1.4" {...base} {...p}><rect x="1.5" y="3" width="11" height="8" rx="1"/><circle cx="10" cy="7" r=".8" fill="currentColor"/></svg>
export const IMoon = (p: P) => <svg width="13" height="13" viewBox="0 0 14 14" strokeWidth="1.4" {...base} {...p}><path d="M11.5 9A5.5 5.5 0 0 1 5 2.5a5.5 5.5 0 1 0 6.5 6.5z"/></svg>
export const ISun  = (p: P) => <svg width="13" height="13" viewBox="0 0 14 14" strokeWidth="1.4" {...base} {...p}><circle cx="7" cy="7" r="2.5"/><path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.9 2.9l1 1M10.1 10.1l1 1M11.1 2.9l-1 1M3.9 10.1l-1 1"/></svg>
export const IMic  = (p: P) => <svg width="13" height="13" viewBox="0 0 14 14" strokeWidth="1.4" {...base} {...p}><rect x="4.5" y="1" width="5" height="8" rx="2.5"/><path d="M2 7a5 5 0 0 0 10 0M7 12v1.5M4.5 13.5h5"/></svg>
export const ILogout = (p: P) => <svg width="13" height="13" viewBox="0 0 14 14" strokeWidth="1.4" {...base} {...p}><path d="M9 10l3-3-3-3M12 7H5M5 2H3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h2"/></svg>
// ── AI wand icon ──────────────────────────────────────────────────────────────

export const IAiWand = (p: P) => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" {...p}>
    {/* wand stick */}
    <path d="M2.5 11.5l6-6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    {/* wand tip diamond */}
    <path d="M8.5 5.5L9.5 4l1 1.5-1 1.5z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/>
    {/* sparkles */}
    <path d="M11 1.5l.35 1L12.5 3l-1.15.5L11 4.5l-.35-1L9.5 3l1.15-.5z" fill="currentColor"/>
    <path d="M5 1.5l.25.7.7.3-.7.3L5 3.6l-.25-.8-.7-.3.7-.3z" fill="currentColor"/>
    <path d="M12.5 7.5l.2.55.55.2-.55.2L12.5 9l-.2-.55-.55-.2.55-.2z" fill="currentColor"/>
  </svg>
)
