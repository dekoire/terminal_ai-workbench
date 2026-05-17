import { useState } from 'react'
import { IShield, IGit, ITerminal, ISpark, ISpinner, IEye, IEyeOff } from '../primitives/Icons'

// ── Shared style constants ────────────────────────────────────────────────────
export const fieldLabel: React.CSSProperties = { display: 'block', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.7, color: 'var(--fg-3)', fontWeight: 500, marginBottom: 6 }
export const fieldInput: React.CSSProperties = { width: '100%', padding: '9px 11px', border: '1px solid var(--line-strong)', borderRadius: 6, background: 'var(--bg-2)', color: 'var(--fg-0)', fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none', boxSizing: 'border-box' }
export const btnPrimary: React.CSSProperties = { background: 'var(--accent)', color: 'var(--accent-fg)', border: 'none', padding: '11px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)', width: '100%' }

// ── Animation data — defined once outside any component to avoid re-allocation on render ──
const DOTS = [
  { cx: 85.5,   cy: 141.5, dur: '3.2s', begin: '0s'   },
  { cx: 477.5,  cy: 85.5,  dur: '2.8s', begin: '0.6s' },
  { cx: 925.5,  cy: 477.5, dur: '3.6s', begin: '0.3s' },
  { cx: 365.5,  cy: 589.5, dur: '2.5s', begin: '1.2s' },
  { cx: 813.5,  cy: 365.5, dur: '3.3s', begin: '0.8s' },
  { cx: 141.5,  cy: 477.5, dur: '4.2s', begin: '1.5s' },
  { cx: 477.5,  cy: 813.5, dur: '5.2s', begin: '0.5s' },
  { cx: 701.5,  cy: 57.5,  dur: '2.6s', begin: '0.9s' },
  { cx: 253.5,  cy: 701.5, dur: '4.6s', begin: '1.8s' },
  { cx: 1093.5, cy: 421.5, dur: '3.8s', begin: '1.0s' },
  { cx: 589.5,  cy: 309.5, dur: '4.0s', begin: '1.3s' },
  { cx: 701.5,  cy: 253.5, dur: '5.0s', begin: '0.6s' },
  { cx: 1149.5, cy: 141.5, dur: '4.4s', begin: '1.1s' },
  { cx: 1037.5, cy: 589.5, dur: '2.9s', begin: '1.2s' },
  { cx: 57.5,   cy: 253.5, dur: '4.0s', begin: '0.4s' },
  { cx: 925.5,  cy: 813.5, dur: '3.9s', begin: '1.6s' },
  { cx: 1205.5, cy: 673.5, dur: '4.7s', begin: '0.4s' },
  { cx: 589.5,  cy: 701.5, dur: '4.8s', begin: '0.9s' },
  { cx: 1261.5, cy: 365.5, dur: '3.7s', begin: '0.5s' },
  { cx: 1373.5, cy: 589.5, dur: '3.1s', begin: '1.4s' },
  { cx: 1037.5, cy: 253.5, dur: '4.3s', begin: '0.7s' },
  { cx: 365.5,  cy: 141.5, dur: '3.5s', begin: '0.2s' },
  { cx: 729.5,  cy: 673.5, dur: '5.4s', begin: '1.7s' },
  { cx: 197.5,  cy: 813.5, dur: '3.0s', begin: '1.9s' },
  { cx: 169.5,  cy: 309.5, dur: '3.6s', begin: '1.3s' },
  { cx: 645.5,  cy: 449.5, dur: '4.9s', begin: '0.7s' },
  { cx: 421.5,  cy: 757.5, dur: '5.1s', begin: '1.0s' },
  { cx: 869.5,  cy: 533.5, dur: '2.7s', begin: '1.5s' },
  { cx: 309.5,  cy: 197.5, dur: '3.8s', begin: '0.3s' },
  { cx: 757.5,  cy: 589.5, dur: '3.5s', begin: '0.8s' },
  { cx: 1205.5, cy: 449.5, dur: '5.0s', begin: '1.1s' },
  { cx: 533.5,  cy: 757.5, dur: '2.9s', begin: '1.3s' },
  { cx: 981.5,  cy: 141.5, dur: '4.6s', begin: '1.7s' },
  { cx: 421.5,  cy: 253.5, dur: '4.3s', begin: '0.5s' },
] as const

const STARS = [
  { cx: 253.5,  cy: 365.5, dur: '8.0s',  begin: '0s'   },
  { cx: 869.5,  cy: 197.5, dur: '10.5s', begin: '2.5s' },
  { cx: 533.5,  cy: 533.5, dur: '9.0s',  begin: '4.8s' },
  { cx: 1093.5, cy: 729.5, dur: '11.0s', begin: '1.5s' },
  { cx: 113.5,  cy: 645.5, dur: '7.5s',  begin: '3.5s' },
  { cx: 1317.5, cy: 197.5, dur: '12.0s', begin: '6.0s' },
] as const

// ── FeatureRow ────────────────────────────────────────────────────────────────
export function FeatureRow({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: 'var(--fg-1)' }}>
      <span style={{
        width: 24, height: 24, borderRadius: 6, background: 'var(--bg-2)', flexShrink: 0,
        border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)',
      }}>{icon}</span>
      {label}
    </div>
  )
}

// ── PasswordInput — reusable password field with show/hide toggle ──────────────
interface PasswordInputProps {
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
  placeholder?: string
  style?: React.CSSProperties
}

export function PasswordInput({ value, onChange, onKeyDown, placeholder = '••••••••', style }: PasswordInputProps) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <input
        style={{ ...fieldInput, paddingRight: 36, ...style }}
        type={show ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
      />
      <button
        type="button"
        onClick={() => setShow(v => !v)}
        style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-3)', padding: 2, display: 'flex', alignItems: 'center' }}
        tabIndex={-1}
      >
        {show ? <IEyeOff style={{ width: 15, height: 15 }} /> : <IEye style={{ width: 15, height: 15 }} />}
      </button>
    </div>
  )
}

// ── AuthBackground — animated dot/star SVG with collision-safe IDs ────────────
export function AuthBackground({ id }: { id: string }) {
  return (
    <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
      <defs>
        <pattern id={`dots-${id}`} width="28" height="28" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="1.4" fill="var(--fg-3)" opacity="0.75" />
        </pattern>
        <radialGradient id={`fade-${id}`} cx="50%" cy="50%" r="65%">
          <stop offset="0%"   stopColor="var(--bg-0)" stopOpacity="0" />
          <stop offset="60%"  stopColor="var(--bg-0)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="var(--bg-0)" stopOpacity="1" />
        </radialGradient>
        <radialGradient id={`inner-${id}`} cx="30%" cy="50%" r="45%">
          <stop offset="50%"  stopColor="var(--bg-0)" stopOpacity="0" />
          <stop offset="100%" stopColor="var(--bg-0)" stopOpacity="0.55" />
        </radialGradient>
        <filter id={`glow-${id}`} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="6" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <rect width="100%" height="100%" fill={`url(#dots-${id})`} />
      {DOTS.map((d, i) => (
        <circle key={i} cx={d.cx} cy={d.cy} r="2.5" fill="var(--accent)" opacity="0" filter={`url(#glow-${id})`}>
          <animate attributeName="opacity" values="0;1;0" dur={d.dur} begin={d.begin} repeatCount="indefinite" />
        </circle>
      ))}
      {STARS.map((d, i) => (
        <g key={i} transform={`translate(${d.cx},${d.cy})`} opacity="0" filter={`url(#glow-${id})`}>
          <path d="M0,-5 L0.8,-0.8 L5,0 L0.8,0.8 L0,5 L-0.8,0.8 L-5,0 L-0.8,-0.8 Z" fill="var(--accent)" />
          <animate attributeName="opacity" values="0;0;0.9;1;0.9;0;0" dur={d.dur} begin={d.begin} repeatCount="indefinite" />
          <animateTransform attributeName="transform" type="scale" values="0.2;0.2;1;1.2;1;0.2;0.2" dur={d.dur} begin={d.begin} repeatCount="indefinite" additive="sum" />
        </g>
      ))}
      <rect width="100%" height="100%" fill={`url(#inner-${id})`} />
      <rect width="100%" height="100%" fill={`url(#fade-${id})`} />
    </svg>
  )
}

// ── AuthBrandPanel — left marketing panel shared between Login and Register ───
export function AuthBrandPanel({ headline }: { headline: React.ReactNode }) {
  return (
    <div style={{
      flex: 1, padding: '48px 56px', display: 'flex', flexDirection: 'column',
      position: 'relative', zIndex: 1, borderRight: '1px solid var(--line)',
    }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <ISpinner spin={false} size={34} style={{ color: 'var(--accent)' }} />
        <span style={{ fontSize: 26, fontWeight: 700, color: 'var(--fg-0)', fontFamily: 'var(--font-ui)', letterSpacing: -0.3, lineHeight: 1 }}>Codera</span>
      </span>
      <div style={{ flex: 1 }} />
      <div style={{ maxWidth: 380 }}>
        <h1 style={{ margin: '0 0 16px', fontSize: 32, fontWeight: 700, letterSpacing: -0.8, color: 'var(--fg-0)', lineHeight: 1.15 }}>
          {headline}
        </h1>
        <p style={{ margin: '0 0 28px', color: 'var(--fg-2)', fontSize: 13, lineHeight: 1.65 }}>
          Arbeite mit Claude Code, DeepSeek und weiteren Agenten in einer Oberfläche — inklusive Terminal, Projektkontext, Session-Verlauf, Prompt-Vorlagen und Git-Integration.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <FeatureRow icon={<ISpark />}    label="KI-Chat im Projektkontext" />
          <FeatureRow icon={<ITerminal />} label="Terminal mit Session-Verlauf" />
          <FeatureRow icon={<IShield />}   label="Modelle, Aliases & Templates verwalten" />
          <FeatureRow icon={<IGit />}      label="Git-Workflow direkt im Workspace" />
        </div>
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ fontSize: 10.5, color: 'var(--fg-3)', userSelect: 'none' }}>
        © 2025 Codera AI
      </div>
    </div>
  )
}
