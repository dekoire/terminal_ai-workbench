// ── Accent Presets ────────────────────────────────────────────────────────────
// Each preset sets: accent colour, text-on-accent, and sidebar background tint.
// The main workspace bg (--bg-0) is NOT changed — only menu/sidebar colours shift.

export interface AccentPreset {
  id: string
  name: string
  accent: string      // primary highlight colour
  accentFg: string    // text colour on accent (e.g. on buttons)
  // Sidebar tint: overrides --bg-1 / --bg-2 / --bg-3 / --line
  sidebarBg: string
  sidebarBg2: string
  sidebarLine: string
  dark: boolean       // true = designed for dark mode, false = light mode
}

export const ACCENT_PRESETS: AccentPreset[] = [
  // ── Dark variants ──────────────────────────────────────────────────────────
  {
    id: 'ember',       name: 'Ember',      dark: true,
    accent: '#ff8a5b', accentFg: '#1a1410',
    sidebarBg: '#15130f', sidebarBg2: '#1c1a16', sidebarLine: '#2a2722',
  },
  {
    id: 'cobalt',      name: 'Cobalt',     dark: true,
    accent: '#4d9fff', accentFg: '#030811',
    sidebarBg: '#0d1220', sidebarBg2: '#111929', sidebarLine: '#1e2840',
  },
  {
    id: 'forest',      name: 'Forest',     dark: true,
    accent: '#4ecf8a', accentFg: '#061008',
    sidebarBg: '#0d1510', sidebarBg2: '#111c15', sidebarLine: '#1a2e20',
  },
  {
    id: 'amethyst',    name: 'Amethyst',   dark: true,
    accent: '#9d6fff', accentFg: '#0a0614',
    sidebarBg: '#120e18', sidebarBg2: '#1a1424', sidebarLine: '#221a38',
  },
  {
    id: 'rose',        name: 'Rose',       dark: true,
    accent: '#ff6b8a', accentFg: '#140408',
    sidebarBg: '#170d10', sidebarBg2: '#201318', sidebarLine: '#2e1820',
  },
  {
    id: 'amber',       name: 'Amber',      dark: true,
    accent: '#f0b830', accentFg: '#120c00',
    sidebarBg: '#151108', sidebarBg2: '#1d170a', sidebarLine: '#2a2210',
  },
  {
    id: 'slate',       name: 'Slate',      dark: true,
    accent: '#40d0c0', accentFg: '#041414',
    sidebarBg: '#10121a', sidebarBg2: '#181a24', sidebarLine: '#1e2030',
  },
  {
    id: 'carbon',      name: 'Carbon',     dark: true,
    accent: '#e8e8e8', accentFg: '#0a0a0a',
    sidebarBg: '#111111', sidebarBg2: '#1a1a1a', sidebarLine: '#222222',
  },
  // ── Light variants ─────────────────────────────────────────────────────────
  {
    id: 'light-ember', name: 'Ember Light', dark: false,
    accent: '#d96a3a', accentFg: '#fff8f4',
    sidebarBg: '#f3efe7', sidebarBg2: '#ece7dc', sidebarLine: '#e1dbcd',
  },
  {
    id: 'light-cobalt', name: 'Cobalt Light', dark: false,
    accent: '#2277cc', accentFg: '#f0f6ff',
    sidebarBg: '#eef3fc', sidebarBg2: '#e4edf8', sidebarLine: '#d0dcf0',
  },
  {
    id: 'light-forest', name: 'Forest Light', dark: false,
    accent: '#1e9a5e', accentFg: '#f0fff8',
    sidebarBg: '#edf8f2', sidebarBg2: '#e0f2e9', sidebarLine: '#c8e8d8',
  },
  {
    id: 'light-amethyst', name: 'Amethyst Light', dark: false,
    accent: '#7744cc', accentFg: '#f8f0ff',
    sidebarBg: '#f4eefc', sidebarBg2: '#ece0f8', sidebarLine: '#d8c8f0',
  },
  {
    id: 'light-rose', name: 'Rose Light', dark: false,
    accent: '#d04468', accentFg: '#fff0f4',
    sidebarBg: '#fceff3', sidebarBg2: '#f8e4ea', sidebarLine: '#f0ccd8',
  },
  {
    id: 'light-amber', name: 'Amber Light', dark: false,
    accent: '#b88425', accentFg: '#fff8e8',
    sidebarBg: '#fdf5e0', sidebarBg2: '#f8ecd0', sidebarLine: '#eeddb0',
  },
  {
    id: 'light-slate', name: 'Slate Light', dark: false,
    accent: '#1a9e94', accentFg: '#f0fffe',
    sidebarBg: '#edf6f5', sidebarBg2: '#e0eeec', sidebarLine: '#c4e0dc',
  },
  {
    id: 'light-carbon', name: 'Carbon Light', dark: false,
    accent: '#444444', accentFg: '#ffffff',
    sidebarBg: '#f0f0f0', sidebarBg2: '#e4e4e4', sidebarLine: '#d4d4d4',
  },
]

// ── Apply preset to DOM ───────────────────────────────────────────────────────
// Sets the FULL colour palette inline (no CSS-class dependency).
export function applyPreset(preset: AccentPreset, accentOverride?: string, accentFgOverride?: string) {
  const root = document.documentElement
  const accent   = accentOverride   ?? preset.accent
  const accentFg = accentFgOverride ?? preset.accentFg

  // Full bg/fg palette for dark vs. light
  if (preset.dark) {
    root.style.setProperty('--bg-0',         '#0e0d0b')
    root.style.setProperty('--bg-3',         '#24211c')
    root.style.setProperty('--bg-4',         '#2d2924')
    root.style.setProperty('--line-strong',  '#3a3631')
    root.style.setProperty('--fg-0',         '#f3ece2')
    root.style.setProperty('--fg-1',         '#c9c0b3')
    root.style.setProperty('--fg-2',         '#8a8478')
    root.style.setProperty('--fg-3',         '#5e5950')
    root.style.setProperty('--ok',           '#7cd9a8')
    root.style.setProperty('--warn',         '#f4c365')
    root.style.setProperty('--err',          '#ef7a7a')
    root.style.setProperty('--info',         '#8ab4ff')
    root.style.setProperty('--danger',       '#e25c5c')
    root.style.setProperty('--danger-soft',  'rgba(226,92,92,0.12)')
    root.style.setProperty('--danger-line',  'rgba(226,92,92,0.45)')
  } else {
    root.style.setProperty('--bg-0',         '#faf8f4')
    root.style.setProperty('--bg-3',         '#e3ddcf')
    root.style.setProperty('--bg-4',         '#d8d1c0')
    root.style.setProperty('--line-strong',  '#c8c0ad')
    root.style.setProperty('--fg-0',         '#1c1814')
    root.style.setProperty('--fg-1',         '#4a443c')
    root.style.setProperty('--fg-2',         '#7a7368')
    root.style.setProperty('--fg-3',         '#a09889')
    root.style.setProperty('--ok',           '#3d9b6c')
    root.style.setProperty('--warn',         '#b88425')
    root.style.setProperty('--err',          '#c0463f')
    root.style.setProperty('--info',         '#4a7bce')
    root.style.setProperty('--danger',       '#c0463f')
    root.style.setProperty('--danger-soft',  'rgba(192,70,63,0.08)')
    root.style.setProperty('--danger-line',  'rgba(192,70,63,0.40)')
  }

  // Preset-specific sidebar + accent
  root.style.setProperty('--bg-1',      preset.sidebarBg)
  root.style.setProperty('--bg-2',      preset.sidebarBg2)
  root.style.setProperty('--line',      preset.sidebarLine)
  root.style.setProperty('--accent',    accent)
  root.style.setProperty('--accent-fg', accentFg)

  // Derive soft/line variants from accent hex
  const m = accent.match(/^#(..)(..)(..)$/)
  if (m) {
    const [r, g, b] = [m[1], m[2], m[3]].map(h => parseInt(h, 16))
    root.style.setProperty('--accent-soft', `rgba(${r},${g},${b},0.14)`)
    root.style.setProperty('--accent-line', `rgba(${r},${g},${b},0.45)`)
  }

  // Update Safari/browser toolbar color
  const bgColor = preset.dark ? '#0e0d0b' : '#faf8f4'
  let metaTheme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (!metaTheme) {
    metaTheme = document.createElement('meta')
    metaTheme.name = 'theme-color'
    document.head.appendChild(metaTheme)
  }
  metaTheme.content = bgColor

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
