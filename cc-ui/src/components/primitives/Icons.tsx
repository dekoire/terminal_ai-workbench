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
export const ISettings = (p: P) => <svg width="13" height="13" viewBox="0 0 14 14" strokeWidth="1.4" {...base} {...p}><circle cx="7" cy="7" r="1.5"/><path d="M7 1.5v1.6M7 10.9v1.6M2.6 7H1M13 7h-1.6M3.5 3.5L4.5 4.5M9.5 9.5l1 1M3.5 10.5l1-1M9.5 4.5l1-1"/></svg>
export const IHistory = (p: P) => <svg width="13" height="13" viewBox="0 0 14 14" strokeWidth="1.4" {...base} {...p}><path d="M2 7a5 5 0 1 0 1.5-3.5L2 5M2 2v3h3M7 4v3l2 1.5"/></svg>
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
