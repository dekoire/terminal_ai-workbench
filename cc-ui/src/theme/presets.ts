// ── Accent Presets ────────────────────────────────────────────────────────────
// Every colour the preset touches is declared directly on the object.
// Nothing is hidden in a lookup table — edit a preset here and it takes effect.

export interface AccentPreset {
  id:      string
  name:    string
  dark:    boolean

  // ── Accent ──────────────────────────────────────────────────────────────────
  accent:   string   // primary highlight colour
  accentFg: string   // text on accent (e.g. buttons)

  // ── Backgrounds (bg-0 = darkest/lightest, bg-4 = most elevated) ─────────────
  bg0: string   // main workspace
  bg1: string   // sidebar
  bg2: string   // cards / panels
  bg3: string   // elevated surfaces
  bg4: string   // tooltips / popovers

  // ── Lines & borders ─────────────────────────────────────────────────────────
  line:      string  // subtle dividers
  lineStrong: string // prominent borders

  // ── Text ────────────────────────────────────────────────────────────────────
  fg0: string   // primary text
  fg1: string   // secondary text
  fg2: string   // muted text
  fg3: string   // very muted / placeholders

  // ── Status colours ──────────────────────────────────────────────────────────
  ok:   string
  warn: string
  err:  string
  info: string

  // ── Brand ───────────────────────────────────────────────────────────────────
  orbit: string   // orbit / AI chat accent
}

export const ACCENT_PRESETS: AccentPreset[] = [

  // ── Dark themes ─────────────────────────────────────────────────────────────

  {
    id: 'ember', name: 'Ember', dark: true,
    accent: '#ff7f4d', accentFg: '#ffffff',
    bg0: '#1F1F1E', bg1: '#262626', bg2: '#1F1F1E', bg3: '#444444', bg4: '#444444',
    line: '#333333', lineStrong: '#444444',
    fg0: '#ffffff', fg1: '#ffffff', fg2: '#ffffff', fg3: '#ababab',
    ok: '#7cd9a8', warn: '#f4c365', err: '#ef7a7a', info: '#8ab4ff',
    orbit: '#8b6cf7',
  },

  {
    id: 'cobalt', name: 'Cobalt', dark: true,
    accent: '#0073ff', accentFg: '#ffffff',
    bg0: '#1F1F1E', bg1: '#262626', bg2: '#1F1F1E', bg3: '#444444', bg4: '#444444',
    line: '#333333', lineStrong: '#444444',
    fg0: '#ffffff', fg1: '#ffffff', fg2: '#ffffff', fg3: '#ababab',
    ok: '#7cd9a8', warn: '#f4c365', err: '#ef7a7a', info: '#8ab4ff',
    orbit: '#8b6cf7',
  },

  {
    id: 'midnight', name: 'Midnight', dark: true,
    accent: '#9d6fff', accentFg: '#0a0a14',
    bg0: '#1F1F1E', bg1: '#262626', bg2: '#1F1F1E', bg3: '#444444', bg4: '#444444',
    line: '#333333', lineStrong: '#444444',
    fg0: '#ffffff', fg1: '#ffffff', fg2: '#ffffff', fg3: '#ababab',
    ok: '#7cd9a8', warn: '#f4c365', err: '#ef7a7a', info: '#8ab4ff',
    orbit: '#8b6cf7',
  },

  {
    id: 'forest', name: 'Forest', dark: true,
    accent: '#00e229', accentFg: '#ffffff',
    bg0: '#1F1F1E', bg1: '#262626', bg2: '#1F1F1E', bg3: '#444444', bg4: '#444444',
    line: '#333333', lineStrong: '#444444',
    fg0: '#ffffff', fg1: '#ffffff', fg2: '#ffffff', fg3: '#ababab',
    ok: '#7cd9a8', warn: '#f4c365', err: '#ef7a7a', info: '#8ab4ff',
    orbit: '#8b6cf7',
  },

  {
    id: 'rose', name: 'Rose', dark: true,
    accent: '#ff47a6', accentFg: '#FFFFFFF',
    bg0: '#1F1F1E', bg1: '#262626', bg2: '#1F1F1E', bg3: '#444444', bg4: '#444444',
    line: '#333333', lineStrong: '#444444',
    fg0: '#ffffff', fg1: '#ffffff', fg2: '#ffffff', fg3: '#ababab',
    ok: '#7cd9a8', warn: '#f4c365', err: '#ef7a7a', info: '#8ab4ff',
    orbit: '#8b6cf7',
  },

  // ── Light themes ─────────────────────────────────────────────────────────────

  {
    id: 'ember-light', name: 'Ember Light', dark: false,
    accent: '#d95f2a', accentFg: '#ffffff',
    bg0: '#ffffff', bg1: '#f6f6f6', bg2: '#ffffff', bg3: '#e8e8e8', bg4: '#dedede',
    line: '#D5D5D5', lineStrong: '#cccccc',
    fg0: '#090909', fg1: '#090909', fg2: '#444444', fg3: '#545454',
    ok: '#3d9b6c', warn: '#b88425', err: '#c0463f', info: '#4a7bce',
    orbit: '#7c5cf0',
  },

  {
    id: 'cobalt-light', name: 'Cobalt Light', dark: false,
    accent: '#1e40ff', accentFg: '#ffffff',
    bg0: '#ffffff', bg1: '#f6f6f6', bg2: '#ffffff', bg3: '#e8e8e8', bg4: '#dedede',
    line: '#D5D5D5', lineStrong: '#cccccc',
    fg0: '#090909', fg1: '#090909', fg2: '#444444', fg3: '#545454',
    ok: '#3d9b6c', warn: '#b88425', err: '#c0463f', info: '#4a7bce',
    orbit: '#7c5cf0',
  },

  {
    id: 'midnight-light', name: 'Midnight Light', dark: false,
    accent: '#8249ff', accentFg: '#ffffff',
    bg0: '#ffffff', bg1: '#f6f6f6', bg2: '#ffffff', bg3: '#e8e8e8', bg4: '#dedede',
    line: '#D5D5D5', lineStrong: '#cccccc',
    fg0: '#090909', fg1: '#090909', fg2: '#444444', fg3: '#545454',
    ok: '#3d9b6c', warn: '#b88425', err: '#c0463f', info: '#4a7bce',
    orbit: '#6a38d4',
  },

  {
    id: 'forest-light', name: 'Forest Light', dark: false,
    accent: '#1a9e5c', accentFg: '#ffffff',
    bg0: '#ffffff', bg1: '#f6f6f6', bg2: '#ffffff', bg3: '#e8e8e8', bg4: '#dedede',
    line: '#D5D5D5', lineStrong: '#cccccc',
    fg0: '#090909', fg1: '#090909', fg2: '#444444', fg3: '#545454',
    ok: '#2e8a58', warn: '#b88425', err: '#c0463f', info: '#4a7bce',
    orbit: '#7c5cf0',
  },

  {
    id: 'rose-light', name: 'Rose Light', dark: false,
    accent: '#e01e8c', accentFg: '#ffffff',
    bg0: '#ffffff', bg1: '#f6f6f6', bg2: '#ffffff', bg3: '#e8e8e8', bg4: '#dedede',
    line: '#D5D5D5', lineStrong: '#cccccc',
    fg0: '#090909', fg1: '#090909', fg2: '#444444', fg3: '#545454',
    ok: '#3d9b6c', warn: '#b88425', err: '#c0463f', info: '#4a7bce',
    orbit: '#7c5cf0',
  },

  // ── Crimson / Rot ───────────────────────────────────────────────────────────

  {
    id: 'crimson', name: 'Crimson', dark: true,
    accent: '#ff3b4e', accentFg: '#ffffff',
    bg0: '#1F1F1E', bg1: '#262626', bg2: '#1F1F1E', bg3: '#444444', bg4: '#444444',
    line: '#333333', lineStrong: '#444444',
    fg0: '#ffffff', fg1: '#ffffff', fg2: '#ffffff', fg3: '#ababab',
    ok: '#7cd9a8', warn: '#f4c365', err: '#ef7a7a', info: '#8ab4ff',
    orbit: '#8b6cf7',
  },

  {
    id: 'crimson-light', name: 'Crimson Light', dark: false,
    accent: '#c0192e', accentFg: '#ffffff',
    bg0: '#ffffff', bg1: '#f6f6f6', bg2: '#ffffff', bg3: '#e8e8e8', bg4: '#dedede',
    line: '#D5D5D5', lineStrong: '#cccccc',
    fg0: '#090909', fg1: '#090909', fg2: '#444444', fg3: '#545454',
    ok: '#3d9b6c', warn: '#b88425', err: '#c0463f', info: '#4a7bce',
    orbit: '#7c5cf0',
  },
]

// ── Apply preset to DOM ───────────────────────────────────────────────────────
// Reads all colour fields directly from the preset — no hidden lookup tables.
export function applyPreset(preset: AccentPreset, accentOverride?: string, accentFgOverride?: string) {
  const root     = document.documentElement
  const accent   = accentOverride   ?? preset.accent
  const accentFg = accentFgOverride ?? preset.accentFg

  root.style.setProperty('--bg-0',        preset.bg0)
  root.style.setProperty('--bg-1',        preset.bg1)
  root.style.setProperty('--bg-2',        preset.bg2)
  root.style.setProperty('--bg-3',        preset.bg3)
  root.style.setProperty('--bg-4',        preset.bg4)
  root.style.setProperty('--line',        preset.line)
  root.style.setProperty('--line-strong', preset.lineStrong)
  root.style.setProperty('--fg-0',        preset.fg0)
  root.style.setProperty('--fg-1',        preset.fg1)
  root.style.setProperty('--fg-2',        preset.fg2)
  root.style.setProperty('--fg-3',        preset.fg3)
  root.style.setProperty('--ok',          preset.ok)
  root.style.setProperty('--warn',        preset.warn)
  root.style.setProperty('--err',         preset.err)
  root.style.setProperty('--info',        preset.info)
  root.style.setProperty('--orbit',       preset.orbit)
  root.style.setProperty('--accent',      accent)
  root.style.setProperty('--accent-fg',   accentFg)

  // Danger (derives from err)
  root.style.setProperty('--danger',      preset.err)

  // Derived rgba variants
  const hexToRgba = (hex: string, alpha: number) => {
    const m = hex.match(/^#(..)(..)(..)$/)
    if (!m) return hex
    const [r, g, b] = m.slice(1).map(h => parseInt(h, 16))
    return `rgba(${r},${g},${b},${alpha})`
  }
  root.style.setProperty('--accent-soft', hexToRgba(accent,       preset.dark ? 0.14 : 0.10))
  root.style.setProperty('--accent-line', hexToRgba(accent,       0.45))
  root.style.setProperty('--orbit-soft',  hexToRgba(preset.orbit, 0.14))
  root.style.setProperty('--orbit-line',  hexToRgba(preset.orbit, 0.45))
  root.style.setProperty('--danger-soft', hexToRgba(preset.err,   preset.dark ? 0.12 : 0.08))
  root.style.setProperty('--danger-line', hexToRgba(preset.err,   0.40))

  // Syntax token defaults (dark / light) — only if NOT already overridden by customUiColors
  // (customUiColors are re-applied after this call in App.tsx, so these are safe to set here)
  if (preset.dark) {
    root.style.setProperty('--tok-keyword', '#df8ff4')
    root.style.setProperty('--tok-string',  '#8cf2b2')
    root.style.setProperty('--tok-number',  '#f8ca86')
    root.style.setProperty('--tok-comment', '#d8e2ff')
    root.style.setProperty('--tok-type',    '#59ffde')
    root.style.setProperty('--tok-fn',      '#fff9b6')
  } else {
    root.style.setProperty('--tok-keyword', '#8036ff')
    root.style.setProperty('--tok-string',  '#00ae40')
    root.style.setProperty('--tok-number',  '#ff8325')
    root.style.setProperty('--tok-comment', '#656a76')
    root.style.setProperty('--tok-type',    '#008cb3')
    root.style.setProperty('--tok-fn',      '#fc7623')
  }

  // Update Safari/browser toolbar color
  const metaBg = preset.dark ? preset.bg0 : preset.bg0
  let metaTheme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (!metaTheme) {
    metaTheme = document.createElement('meta')
    metaTheme.name = 'theme-color'
    document.head.appendChild(metaTheme)
  }
  metaTheme.content = metaBg

  // Keep CSS class in sync for any selectors that still rely on it
  root.classList.toggle('theme-light', !preset.dark)
}

// ── Terminal Themes ───────────────────────────────────────────────────────────
export interface TerminalTheme {
  id: string
  name: string
  theme: {
    background: string; foreground: string; cursor: string; cursorAccent: string
    selectionBackground: string
    black: string; red: string; green: string; yellow: string
    blue: string; magenta: string; cyan: string; white: string
    brightBlack: string; brightRed: string; brightGreen: string; brightYellow: string
    brightBlue: string; brightMagenta: string; brightCyan: string; brightWhite: string
  }
}

export const TERMINAL_THEMES: TerminalTheme[] = [
  {
    id: 'default', name: 'Default (Warm)',
    theme: {
      background: '#0e0d0b', foreground: '#c9c0b3', cursor: '#ff8a5b', cursorAccent: '#0e0d0b',
      selectionBackground: 'rgba(255,138,91,0.25)',
      black: '#1c1a16', red: '#ef7a7a', green: '#7cd9a8', yellow: '#f4c365',
      blue: '#8ab4ff', magenta: '#c49fff', cyan: '#40d0c0', white: '#c9c0b3',
      brightBlack: '#5e5950', brightRed: '#ff9e9e', brightGreen: '#a0e8c0', brightYellow: '#ffd680',
      brightBlue: '#aaccff', brightMagenta: '#d8bcff', brightCyan: '#70e0d8', brightWhite: '#f3ece2',
    },
  },
  {
    id: 'dracula', name: 'Dracula',
    theme: {
      background: '#282a36', foreground: '#f8f8f2', cursor: '#ff79c6', cursorAccent: '#282a36',
      selectionBackground: 'rgba(68,71,90,0.8)',
      black: '#21222c', red: '#ff5555', green: '#50fa7b', yellow: '#f1fa8c',
      blue: '#bd93f9', magenta: '#ff79c6', cyan: '#8be9fd', white: '#f8f8f2',
      brightBlack: '#6272a4', brightRed: '#ff6e6e', brightGreen: '#69ff94', brightYellow: '#ffffa5',
      brightBlue: '#d6acff', brightMagenta: '#ff92df', brightCyan: '#a4ffff', brightWhite: '#ffffff',
    },
  },
  {
    id: 'onedark', name: 'One Dark',
    theme: {
      background: '#282c34', foreground: '#abb2bf', cursor: '#528bff', cursorAccent: '#282c34',
      selectionBackground: 'rgba(82,139,255,0.25)',
      black: '#3f4451', red: '#e06c75', green: '#98c379', yellow: '#e5c07b',
      blue: '#61afef', magenta: '#c678dd', cyan: '#56b6c2', white: '#abb2bf',
      brightBlack: '#4f5666', brightRed: '#ff7b86', brightGreen: '#b1e18b', brightYellow: '#efcb8c',
      brightBlue: '#67bcfc', brightMagenta: '#d689ec', brightCyan: '#63c5cf', brightWhite: '#e6efff',
    },
  },
  {
    id: 'nord', name: 'Nord',
    theme: {
      background: '#2e3440', foreground: '#d8dee9', cursor: '#88c0d0', cursorAccent: '#2e3440',
      selectionBackground: 'rgba(136,192,208,0.25)',
      black: '#3b4252', red: '#bf616a', green: '#a3be8c', yellow: '#ebcb8b',
      blue: '#81a1c1', magenta: '#b48ead', cyan: '#88c0d0', white: '#e5e9f0',
      brightBlack: '#4c566a', brightRed: '#d08770', brightGreen: '#a3be8c', brightYellow: '#ebcb8b',
      brightBlue: '#81a1c1', brightMagenta: '#b48ead', brightCyan: '#8fbcbb', brightWhite: '#eceff4',
    },
  },
  {
    id: 'monokai', name: 'Monokai',
    theme: {
      background: '#272822', foreground: '#f8f8f2', cursor: '#f8f8f0', cursorAccent: '#272822',
      selectionBackground: 'rgba(248,248,242,0.2)',
      black: '#272822', red: '#f92672', green: '#a6e22e', yellow: '#f4bf75',
      blue: '#66d9e8', magenta: '#ae81ff', cyan: '#a1efe4', white: '#f8f8f2',
      brightBlack: '#75715e', brightRed: '#f92672', brightGreen: '#a6e22e', brightYellow: '#f4bf75',
      brightBlue: '#66d9e8', brightMagenta: '#ae81ff', brightCyan: '#a1efe4', brightWhite: '#f9f8f5',
    },
  },
  {
    id: 'solarized', name: 'Solarized Dark',
    theme: {
      background: '#002b36', foreground: '#839496', cursor: '#2aa198', cursorAccent: '#002b36',
      selectionBackground: 'rgba(42,161,152,0.25)',
      black: '#073642', red: '#dc322f', green: '#859900', yellow: '#b58900',
      blue: '#268bd2', magenta: '#d33682', cyan: '#2aa198', white: '#eee8d5',
      brightBlack: '#002b36', brightRed: '#cb4b16', brightGreen: '#586e75', brightYellow: '#657b83',
      brightBlue: '#839496', brightMagenta: '#6c71c4', brightCyan: '#93a1a1', brightWhite: '#fdf6e3',
    },
  },
  {
    id: 'github-light', name: 'GitHub Light',
    theme: {
      background: '#ffffff', foreground: '#24292f', cursor: '#0969da', cursorAccent: '#ffffff',
      selectionBackground: 'rgba(9,105,218,0.15)',
      black: '#24292f', red: '#cf222e', green: '#116329', yellow: '#953800',
      blue: '#0969da', magenta: '#8250df', cyan: '#1b7c83', white: '#6e7781',
      brightBlack: '#57606a', brightRed: '#a40e26', brightGreen: '#1a7f37', brightYellow: '#c96200',
      brightBlue: '#218bff', brightMagenta: '#a475f9', brightCyan: '#3192aa', brightWhite: '#8c959f',
    },
  },
  {
    id: 'midnight', name: 'Midnight',
    theme: {
      background: '#0a0a0f', foreground: '#c0b8d8', cursor: '#9d6fff', cursorAccent: '#0a0a0f',
      selectionBackground: 'rgba(157,111,255,0.25)',
      black: '#14121e', red: '#ff6b6b', green: '#4ecf8a', yellow: '#f0b830',
      blue: '#4d9fff', magenta: '#9d6fff', cyan: '#40d0c0', white: '#c0b8d8',
      brightBlack: '#4a4060', brightRed: '#ff9090', brightGreen: '#7eeaa8', brightYellow: '#ffd060',
      brightBlue: '#7ab8ff', brightMagenta: '#c09aff', brightCyan: '#70e0d8', brightWhite: '#e8e0f8',
    },
  },
]

// Legacy alias used in App.tsx and AppearancePanel
export const DESIGN_PRESETS = ACCENT_PRESETS
