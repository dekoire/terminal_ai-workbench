/**
 * devLogger — dev-only console helpers
 *
 * Tree-shaken by Vite in production builds because of the import.meta.env.DEV guard.
 * Use devLog/devWarn instead of console.info/warn in any lib file.
 * console.error stays ungated — errors matter in production too.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const devLog  = (...a: any[]) => { if (import.meta.env.DEV) console.info(...a) }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const devWarn = (...a: any[]) => { if (import.meta.env.DEV) console.warn(...a) }
