import React, { useState, useEffect, useMemo, useRef } from 'react'
import { IClose, ISearch, ITrophy, IBookmark, ITerminal, IGitFork, ICpu, IStar, IBolt, IPlay } from '../primitives/Icons'
import type { LucideProps } from 'lucide-react'
import { MultiCombobox } from '../primitives/MultiCombobox'

// ── Types ────────────────────────────────────────────────────────────────────

interface ORModel {
  id: string
  name: string
  description: string
  context_length: number
  pricing: { prompt: string; completion: string }
  top_provider?: { max_completion_tokens?: number }
  architecture?: { modality?: string }
  supported_parameters?: string[]
  created?: number   // Unix timestamp (seconds)
}

interface ModelRow {
  id: string
  name: string
  provider: string
  contextK: number
  promptPer1M: number
  completionPer1M: number
  description: string
  tags: string[]
  quality: number    // Artificial Analysis Quality Index 0–100 (0 = unknown)
  globalRank: number // 1-based rank by quality (0 = unranked)
  createdAt: number  // Unix timestamp in seconds (0 = unknown)
  supportsTools: boolean
  supportsReasoning: boolean
  isVision: boolean
}

// ── Artificial Analysis Quality Index (artificialanalysis.ai, May 2026) ─────
// Scale 0–100. Higher = better overall quality across MMLU, Coding, Math, etc.
// Source: https://artificialanalysis.ai/leaderboards/models
const QUALITY_MAP: Record<string, number> = {
  // ── Anthropic Claude ──────────────────────────────────────────────────
  'anthropic/claude-opus-4':               86,
  'anthropic/claude-opus-4-5':             84,
  'anthropic/claude-sonnet-4-5':           79,
  'anthropic/claude-sonnet-4-6':           78,
  'anthropic/claude-sonnet-4':             76,
  'anthropic/claude-3-5-sonnet':           74,
  'anthropic/claude-3-5-sonnet-20241022':  73,
  'anthropic/claude-3-opus':               65,
  'anthropic/claude-3-5-haiku':            60,
  'anthropic/claude-haiku-4-5':            58,
  'anthropic/claude-3-haiku':              44,
  // ── OpenAI ───────────────────────────────────────────────────────────
  'openai/o3':                             90,
  'openai/o4-mini-high':                   85,
  'openai/o4-mini':                        82,
  'openai/o3-mini':                        77,
  'openai/o1':                             75,
  'openai/o1-preview':                     70,
  'openai/gpt-4.1':                        72,
  'openai/gpt-4o-2024-11-20':              71,
  'openai/gpt-4o':                         70,
  'openai/gpt-4o-2024-08-06':              69,
  'openai/gpt-4-turbo':                    63,
  'openai/gpt-4o-mini':                    52,
  'openai/gpt-3.5-turbo':                  32,
  // ── Google Gemini ─────────────────────────────────────────────────────
  'google/gemini-2.5-pro-preview':         88,
  'google/gemini-2.5-pro-preview-05-06':   88,
  'google/gemini-2.5-pro-preview-03-25':   86,
  'google/gemini-2.5-flash-preview-05-20': 76,
  'google/gemini-2.5-flash-preview':       75,
  'google/gemini-2.0-flash-001':           62,
  'google/gemini-2.0-flash-exp':           61,
  'google/gemini-pro-1.5':                 64,
  'google/gemini-flash-1.5':               50,
  // ── xAI Grok ─────────────────────────────────────────────────────────
  'x-ai/grok-3':                           80,
  'x-ai/grok-3-beta':                      79,
  'x-ai/grok-3-mini':                      66,
  'x-ai/grok-3-mini-beta':                 65,
  'x-ai/grok-2-1212':                      62,
  'x-ai/grok-vision-beta':                 48,
  // ── DeepSeek ─────────────────────────────────────────────────────────
  'deepseek/deepseek-r1':                  83,
  'deepseek/deepseek-r1-zero':             74,
  'deepseek/deepseek-chat-v3-0324':        73,
  'deepseek/deepseek-chat':                72,
  'deepseek/deepseek-r1-distill-llama-70b':63,
  'deepseek/deepseek-r1-distill-qwen-32b': 60,
  // ── Qwen ─────────────────────────────────────────────────────────────
  'qwen/qwen3-235b-a22b':                  81,
  'qwen/qwq-32b':                          78,
  'qwen/qwen3-110b-a35b':                  76,
  'qwen/qwen-2.5-72b-instruct':            67,
  'qwen/qwen-2.5-coder-32b-instruct':      65,
  'qwen/qwen3-72b':                        64,
  'qwen/qwen3-32b':                        60,
  'qwen/qwen3-14b':                        55,
  'qwen/qwen3-8b':                         48,
  // ── Meta Llama ───────────────────────────────────────────────────────
  'meta-llama/llama-3.1-405b-instruct':    67,
  'meta-llama/llama-3.3-70b-instruct':     65,
  'meta-llama/llama-3.1-70b-instruct':     60,
  'meta-llama/llama-3.2-90b-vision-instruct': 52,
  'meta-llama/llama-3.2-11b-vision-instruct': 42,
  'meta-llama/llama-3-70b-instruct':       55,
  // ── Mistral ──────────────────────────────────────────────────────────
  'mistralai/mistral-large-2411':          63,
  'mistralai/mistral-large':               62,
  'mistralai/codestral-2501':              60,
  'mistralai/mixtral-8x22b-instruct':      50,
  'mistralai/mistral-small':               44,
  'mistralai/mistral-7b-instruct':         35,
  // ── Microsoft ────────────────────────────────────────────────────────
  'microsoft/phi-4':                       58,
  'microsoft/phi-4-multimodal-instruct':   55,
  'microsoft/wizardlm-2-8x22b':            46,
  // ── Cohere ───────────────────────────────────────────────────────────
  'cohere/command-r-plus-08-2024':         55,
  'cohere/command-r-plus':                 54,
  'cohere/command-r7b-12-2024':            40,
  // ── Perplexity ───────────────────────────────────────────────────────
  'perplexity/sonar-reasoning-pro':        64,
  'perplexity/sonar-pro':                  58,
  'perplexity/sonar':                      46,
  // ── Nvidia / Amazon / Other ───────────────────────────────────────────
  'nvidia/llama-3.1-nemotron-70b-instruct':66,
  'amazon/nova-pro-v1':                    57,
  'amazon/nova-lite-v1':                   44,
  'inflection/inflection-3-pi':            50,
}

// ── Official model release dates (provider announcement, not OpenRouter ingestion) ─
// Stored as "YYYY-MM" strings for compact display.
const RELEASE_DATE_MAP: Record<string, string> = {
  // Anthropic
  'anthropic/claude-opus-4':               '2025-05',
  'anthropic/claude-opus-4-5':             '2025-07',
  'anthropic/claude-sonnet-4-6':           '2025-07',
  'anthropic/claude-sonnet-4-5':           '2025-06',
  'anthropic/claude-sonnet-4':             '2025-02',
  'anthropic/claude-3-5-sonnet':           '2024-10',
  'anthropic/claude-3-5-sonnet-20241022':  '2024-10',
  'anthropic/claude-3-5-haiku':            '2024-11',
  'anthropic/claude-haiku-4-5':            '2025-05',
  'anthropic/claude-3-opus':               '2024-03',
  'anthropic/claude-3-haiku':              '2024-03',
  // OpenAI
  'openai/o3':                             '2025-04',
  'openai/o4-mini':                        '2025-04',
  'openai/o4-mini-high':                   '2025-04',
  'openai/o3-mini':                        '2025-01',
  'openai/o1':                             '2024-12',
  'openai/o1-preview':                     '2024-09',
  'openai/gpt-4.1':                        '2025-04',
  'openai/gpt-4o':                         '2024-05',
  'openai/gpt-4o-2024-08-06':              '2024-08',
  'openai/gpt-4o-2024-11-20':              '2024-11',
  'openai/gpt-4o-mini':                    '2024-07',
  'openai/gpt-4-turbo':                    '2024-04',
  'openai/gpt-3.5-turbo':                  '2023-03',
  // Google
  'google/gemini-2.5-pro-preview':         '2025-03',
  'google/gemini-2.5-pro-preview-03-25':   '2025-03',
  'google/gemini-2.5-pro-preview-05-06':   '2025-05',
  'google/gemini-2.5-flash-preview':       '2025-05',
  'google/gemini-2.5-flash-preview-05-20': '2025-05',
  'google/gemini-2.0-flash-001':           '2025-01',
  'google/gemini-2.0-flash-exp':           '2024-12',
  'google/gemini-pro-1.5':                 '2024-05',
  'google/gemini-flash-1.5':               '2024-05',
  // xAI
  'x-ai/grok-3':                           '2025-02',
  'x-ai/grok-3-beta':                      '2025-02',
  'x-ai/grok-3-mini':                      '2025-02',
  'x-ai/grok-2-1212':                      '2024-12',
  // DeepSeek
  'deepseek/deepseek-r1':                  '2025-01',
  'deepseek/deepseek-r1-zero':             '2025-01',
  'deepseek/deepseek-chat-v3-0324':        '2025-03',
  'deepseek/deepseek-chat':                '2024-12',
  // Qwen
  'qwen/qwen3-235b-a22b':                  '2025-04',
  'qwen/qwq-32b':                          '2025-03',
  'qwen/qwen3-110b-a35b':                  '2025-04',
  'qwen/qwen3-72b':                        '2025-04',
  'qwen/qwen-2.5-72b-instruct':            '2024-09',
  // Meta
  'meta-llama/llama-3.1-405b-instruct':    '2024-07',
  'meta-llama/llama-3.3-70b-instruct':     '2024-12',
  'meta-llama/llama-3.1-70b-instruct':     '2024-07',
  // Mistral
  'mistralai/mistral-large-2411':          '2024-11',
  'mistralai/mistral-large':               '2024-02',
  'mistralai/codestral-2501':              '2025-01',
  'mistralai/mixtral-8x22b-instruct':      '2024-04',
}

function formatReleaseDate(modelId: string, createdAt: number): string {
  const mapped = RELEASE_DATE_MAP[modelId]
  if (mapped) {
    const [year, month] = mapped.split('-')
    const d = new Date(Number(year), Number(month) - 1)
    return d.toLocaleDateString('de-DE', { month: 'short', year: 'numeric' })
  }
  if (createdAt > 0) {
    return new Date(createdAt * 1000).toLocaleDateString('de-DE', { month: 'short', year: 'numeric' })
  }
  return '—'
}

// ── Display name overrides (makes version clearer than OpenRouter default) ─
const NAME_OVERRIDE: Record<string, string> = {
  'anthropic/claude-opus-4':               'Claude Opus 4 (Latest)',
  'anthropic/claude-opus-4-5':             'Claude Opus 4.5',
  'anthropic/claude-sonnet-4-5':           'Claude Sonnet 4.5',
  'anthropic/claude-sonnet-4-6':           'Claude Sonnet 4.6',
  'anthropic/claude-sonnet-4':             'Claude Sonnet 4',
  'anthropic/claude-3-5-sonnet-20241022':  'Claude 3.5 Sonnet (Oct 2024)',
  'anthropic/claude-3-5-sonnet':           'Claude 3.5 Sonnet (Latest)',
  'anthropic/claude-3-opus':               'Claude 3 Opus',
  'anthropic/claude-3-5-haiku':            'Claude 3.5 Haiku',
  'anthropic/claude-haiku-4-5':            'Claude Haiku 4.5',
  'anthropic/claude-3-haiku':              'Claude 3 Haiku',
  'openai/o3':                             'OpenAI o3',
  'openai/o4-mini':                        'OpenAI o4-mini',
  'openai/o4-mini-high':                   'OpenAI o4-mini (High)',
  'openai/o3-mini':                        'OpenAI o3-mini',
  'openai/o1':                             'OpenAI o1',
  'openai/gpt-4.1':                        'GPT-4.1',
  'openai/gpt-4o-2024-11-20':              'GPT-4o (Nov 2024)',
  'openai/gpt-4o-2024-08-06':              'GPT-4o (Aug 2024)',
  'openai/gpt-4o':                         'GPT-4o (Latest)',
  'openai/gpt-4o-mini':                    'GPT-4o mini',
  'google/gemini-2.5-pro-preview':         'Gemini 2.5 Pro Preview',
  'google/gemini-2.5-pro-preview-03-25':   'Gemini 2.5 Pro (Mar 25)',
  'google/gemini-2.5-pro-preview-05-06':   'Gemini 2.5 Pro (May 6)',
  'google/gemini-2.5-flash-preview-05-20': 'Gemini 2.5 Flash (May 20)',
  'google/gemini-2.5-flash-preview':       'Gemini 2.5 Flash Preview',
  'google/gemini-2.0-flash-001':           'Gemini 2.0 Flash',
  'x-ai/grok-3':                           'Grok 3',
  'x-ai/grok-3-beta':                      'Grok 3 Beta',
  'x-ai/grok-3-mini':                      'Grok 3 Mini',
  'x-ai/grok-2-1212':                      'Grok 2 (Dec 2024)',
  'deepseek/deepseek-r1':                  'DeepSeek R1',
  'deepseek/deepseek-chat':                'DeepSeek V3',
  'deepseek/deepseek-chat-v3-0324':        'DeepSeek V3 (Mar 2024)',
  'qwen/qwen3-235b-a22b':                  'Qwen3 235B (MoE)',
  'qwen/qwq-32b':                          'QwQ 32B (Reasoning)',
}

// ── Use-case tag definitions ─────────────────────────────────────────────────

const USE_CASES = [
  { id: 'coding',    label: 'Coding',      keywords: ['code','coder','coding','developer','programming','engineer','deepseekcoder','starcoder','codestral','qwen-coder','devstral'] },
  { id: 'analysis',  label: 'Analyse',     keywords: ['analysis','reasoning','o1','o3','o4','thinking','r1','deepthink','reflect','gemini-2.5'] },
  { id: 'research',  label: 'Recherche',   keywords: ['search','research','web','perplexity','sonar','brave','online','grounding'] },
  { id: 'reading',   label: 'Texte lesen', keywords: ['long','context','128k','200k','1m','claude','gemini','summariz','document','pdf'] },
  { id: 'creative',  label: 'Kreativ',     keywords: ['creative','story','write','novelist','roleplay','mistral','command-r','mytho'] },
  { id: 'fast',      label: 'Schnell',     keywords: ['flash','haiku','mini','turbo','fast','small','lite','instant','nano','micro'] },
  { id: 'vision',    label: 'Vision/Bild', keywords: ['vision','image','multimodal','visual','pixtral','llava','bakllava'] },
  { id: 'free',      label: 'Kostenlos',   keywords: ['free',':free'] },
]

// ── Benchmark filter definitions ─────────────────────────────────────────────

type BenchmarkFilter = {
  id: string; label: string; desc: string; color: string
  Icon: React.ComponentType<LucideProps>
  match: (id: string) => boolean
}

const BENCHMARK_FILTERS: BenchmarkFilter[] = [
  { id: 'mmlu',      label: 'MMLU',          desc: 'Allgemeinwissen',        color: '#8b5cf6', Icon: IBookmark,
    match: (id) => /claude|gpt-4o|gemini|qwen3|llama-3\.[23]|grok-3|deepseek-chat|mistral-large/.test(id) },
  { id: 'coding',    label: 'Coding',         desc: 'HumanEval / Code',       color: '#22c55e', Icon: ITerminal,
    match: (id) => /claude-sonnet|claude-opus|gpt-4o|deepseek|gemini-2\.|qwen-coder|codestral|devstral/.test(id) },
  { id: 'swebench',  label: 'SWE-bench',      desc: 'Software Engineering',   color: '#f59e0b', Icon: IGitFork,
    match: (id) => /claude-opus-4|\/o3|\/o4/.test(id) },
  { id: 'math',      label: 'MATH',           desc: 'Mathematik',             color: '#3b82f6', Icon: ICpu,
    match: (id) => /deepseek-r1|gemini-2\.5-pro|qwen3-235b|grok-3/.test(id) },
  { id: 'aime',      label: 'AIME',           desc: 'Mathe-Olympiade',        color: '#ef4444', Icon: ITrophy,
    match: (id) => /\/o3|\/o4|deepseek-r1|qwen3-235b|qwq/.test(id) },
  { id: 'gpqa',      label: 'GPQA',           desc: 'Wissenschaft',           color: '#06b6d4', Icon: IBolt,
    match: (id) => /gemini-2\.5-pro|claude-opus/.test(id) },
  { id: 'livecode',  label: 'LiveCodeBench',  desc: 'Live Code-Aufgaben',     color: '#e879f9', Icon: IPlay,
    match: (id) => /qwen3|\/o4|deepseek-r1/.test(id) },
  { id: 'arena',     label: 'AA Quality',     desc: 'Artificial Analysis bewertet', color: '#eab308', Icon: IStar,
    match: (id) => (QUALITY_MAP[id] ?? 0) > 0 },
]

function getModelBenchmarks(id: string): string[] {
  return BENCHMARK_FILTERS.filter(b => b.match(id)).map(b => b.id)
}

function inferTags(model: ORModel): string[] {
  const src = (model.id + ' ' + model.name + ' ' + model.description).toLowerCase()
  return USE_CASES.filter(uc => uc.keywords.some(kw => src.includes(kw))).map(uc => uc.id)
}

function inferStrengths(model: ORModel): string {
  const tags = inferTags(model)
  const map: Record<string, string> = {
    coding:   'Code',
    analysis: 'Reasoning',
    research: 'Web-Suche',
    reading:  'Lange Kontexte',
    creative: 'Kreativtexte',
    fast:     'Niedrige Latenz',
    vision:   'Bild-Verständnis',
    free:     'Kostenlos',
  }
  return tags.map(t => map[t]).filter(Boolean).join(', ') || '—'
}

function formatCost(usd: number): string {
  if (usd === 0) return 'Kostenlos'
  if (usd < 0.01) return `$${(usd * 1000).toFixed(3)}/1M`
  return `$${usd.toFixed(2)}/1M`
}

function parseModel(m: ORModel): ModelRow {
  const parts = m.id.split('/')
  const provider = parts[0] ?? ''
  const promptPer1M  = parseFloat(m.pricing?.prompt  ?? '0') * 1_000_000
  const completionPer1M = parseFloat(m.pricing?.completion ?? '0') * 1_000_000
  const quality = QUALITY_MAP[m.id] ?? 0
  const params = m.supported_parameters ?? []
  const modality = (m.architecture?.modality ?? '').toLowerCase()
  return {
    id: m.id,
    name: NAME_OVERRIDE[m.id] ?? m.name ?? m.id,
    provider,
    contextK: Math.round((m.context_length ?? 0) / 1000),
    promptPer1M,
    completionPer1M,
    description: m.description ?? '',
    tags: inferTags(m),
    quality,
    globalRank: 0,
    createdAt: m.created ?? 0,
    supportsTools: params.includes('tools'),
    supportsReasoning: params.includes('reasoning') || /\br1\b|o1|o3|o4|qwq|thinking|deepthink/.test(m.id),
    isVision: modality.includes('image') || modality.includes('multimodal'),
  }
}

function assignRanks(rows: ModelRow[]): ModelRow[] {
  const sorted = [...rows].sort((a, b) => b.quality - a.quality)
  return rows.map(r => {
    const pos = sorted.findIndex(s => s.id === r.id)
    return { ...r, globalRank: r.quality > 0 ? pos + 1 : 0 }
  })
}

// ── Component ────────────────────────────────────────────────────────────────

interface Props { onClose: () => void }

export function ModelBrowserModal({ onClose }: Props) {
  const [models, setModels]         = useState<ModelRow[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [search, setSearch]         = useState('')
  const [activeTag, setActiveTag]   = useState<string | null>(null)
  const [sortCol, setSortCol]       = useState<'name' | 'prompt' | 'completion' | 'context' | 'rank' | 'created'>('rank')
  const [sortDir, setSortDir]       = useState<'asc' | 'desc'>('desc')
  const [topFilter, setTopFilter]   = useState<number | null>(null)
  const [selected, setSelected]     = useState<ModelRow | null>(null)
  const [activeBenchmarks, setActiveBenchmarks] = useState<string[]>([])
  const [capFilter, setCapFilter] = useState<string | null>(null)

  const toggleBenchmark = (id: string) =>
    setActiveBenchmarks(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  useEffect(() => {
    fetch('https://openrouter.ai/api/v1/models')
      .then(r => r.json())
      .then(d => {
        const rows = assignRanks((d.data as ORModel[]).map(parseModel))
        setModels(rows)
      })
      .catch(() => setError('Konnte Modelle nicht laden. Internetverbindung prüfen.'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    let list = models
    if (activeTag) list = list.filter(m => m.tags.includes(activeTag))
    if (topFilter) list = list.filter(m => m.globalRank > 0 && m.globalRank <= topFilter)
    if (capFilter === 'tools')     list = list.filter(m => m.supportsTools)
    if (capFilter === 'reasoning') list = list.filter(m => m.supportsReasoning)
    if (capFilter === 'vision')    list = list.filter(m => m.isVision)
    if (capFilter === 'longctx')   list = list.filter(m => m.contextK >= 128)
    if (activeBenchmarks.length > 0) {
      list = list.filter(m => {
        const mb = getModelBenchmarks(m.id)
        return activeBenchmarks.every(b => mb.includes(b))
      })
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(m => m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q) || m.provider.toLowerCase().includes(q))
    }
    return [...list].sort((a, b) => {
      let va: number | string, vb: number | string
      if (sortCol === 'name')            { va = a.name; vb = b.name }
      else if (sortCol === 'prompt')     { va = a.promptPer1M; vb = b.promptPer1M }
      else if (sortCol === 'completion') { va = a.completionPer1M; vb = b.completionPer1M }
      else if (sortCol === 'context')    { va = a.contextK; vb = b.contextK }
      else if (sortCol === 'created')    { va = a.createdAt; vb = b.createdAt }
      else /* rank */                    {
        // ranked models first, then unranked at end
        if (a.quality === 0 && b.quality === 0) return 0
        if (a.quality === 0) return 1
        if (b.quality === 0) return -1
        va = a.quality; vb = b.quality
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [models, activeTag, topFilter, capFilter, activeBenchmarks, search, sortCol, sortDir])

  const toggleSort = (col: typeof sortCol) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir(col === 'rank' || col === 'context' || col === 'created' ? 'desc' : 'asc') }
  }

  const thStyle = (col: typeof sortCol): React.CSSProperties => ({
    padding: '9px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600,
    color: sortCol === col ? 'var(--accent)' : 'var(--fg-3)',
    cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
    borderBottom: '1px solid var(--line)', background: 'var(--bg-1)',
    position: 'sticky', top: 0, zIndex: 1,
  })

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ width: '89vw', height: '89vh', background: 'var(--bg-1)', borderRadius: 6, border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.5)' }}>

        {/* Header */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--line)', flexWrap: 'wrap', rowGap: 8 }}>
          <ITrophy style={{ width: 15, height: 15, color: 'var(--accent)', flexShrink: 0 }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg-0)', flexShrink: 0 }}>Modell-Browser</span>
          <span style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>via OpenRouter</span>
          {!loading && <span style={{ fontSize: 10, color: 'var(--fg-3)', background: 'var(--bg-3)', borderRadius: 6, padding: '2px 7px' }}>{filtered.length} / {models.length}</span>}

          <div style={{ flex: 1 }} />

          {/* ── Benchmark Combobox — right side ── */}
          <MultiCombobox
            placeholder="Benchmark-Filter"
            dropdownLabel="Benchmark-Filter"
            align="right"
            value={activeBenchmarks}
            onChange={toggleBenchmark}
            onClear={() => setActiveBenchmarks([])}
            options={BENCHMARK_FILTERS.map(b => ({
              id:    b.id,
              label: b.label,
              desc:  b.desc,
              color: b.color,
              Icon:  b.Icon,
              badge: models.filter(m => getModelBenchmarks(m.id).includes(b.id)).length,
            }))}
          />
          {/* Search */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <ISearch style={{ position: 'absolute', left: 9, width: 13, height: 13, color: 'var(--fg-3)', pointerEvents: 'none' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Suchen…"
              style={{ paddingLeft: 30, paddingRight: 10, paddingTop: 5, paddingBottom: 5, border: '1px solid var(--line)', borderRadius: 6, background: 'var(--bg-2)', color: 'var(--fg-1)', fontSize: 12, fontFamily: 'var(--font-ui)', outline: 'none', width: 190 }}
            />
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-2)', display: 'flex', padding: 4, flexShrink: 0 }}>
            <IClose style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* Body: sidebar + table */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

          {/* Sidebar — use cases */}
          <div style={{ width: 168, flexShrink: 0, borderRight: '1px solid var(--line)', padding: '14px 10px', display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto' }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: 0.6, padding: '0 6px', marginBottom: 4 }}>Filter</div>
            <button
              onClick={() => { setActiveTag(null); setTopFilter(null) }}
              style={{ textAlign: 'left', padding: '7px 10px', borderRadius: 6, border: `1px solid ${activeTag === null && topFilter === null ? 'var(--accent)' : 'transparent'}`, background: activeTag === null && topFilter === null ? 'var(--accent-soft)' : 'transparent', color: activeTag === null && topFilter === null ? 'var(--accent)' : 'var(--fg-1)', fontSize: 12, fontFamily: 'var(--font-ui)', cursor: 'pointer', fontWeight: activeTag === null && topFilter === null ? 600 : 400 }}
            >Alle Modelle</button>

            {/* Ranking filter */}
            <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: 0.6, padding: '0 6px', marginTop: 10, marginBottom: 4 }}>Ranking</div>
            {[
              { n: 10,  label: 'Top 10' },
              { n: 25,  label: 'Top 25' },
              { n: 50,  label: 'Top 50' },
            ].map(({ n, label }) => (
              <button
                key={n}
                onClick={() => { setTopFilter(topFilter === n ? null : n); setActiveTag(null) }}
                style={{ textAlign: 'left', padding: '7px 10px', borderRadius: 6, border: `1px solid ${topFilter === n ? 'var(--accent)' : 'transparent'}`, background: topFilter === n ? 'var(--accent-soft)' : 'transparent', color: topFilter === n ? 'var(--accent)' : 'var(--fg-1)', fontSize: 12, fontFamily: 'var(--font-ui)', cursor: 'pointer', fontWeight: topFilter === n ? 600 : 400, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <span>{n <= 10 ? '🥇' : n <= 25 ? '🥈' : '🥉'}</span>
                <span>{label}</span>
              </button>
            ))}

            <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: 0.6, padding: '0 6px', marginTop: 10, marginBottom: 4 }}>Fähigkeiten</div>
            {([
              { id: 'tools',     label: 'Tool-Use',      desc: 'Orchestrierung', count: models.filter(m => m.supportsTools).length },
              { id: 'reasoning', label: 'Reasoning',     desc: 'Schritt-für-Schritt', count: models.filter(m => m.supportsReasoning).length },
              { id: 'vision',    label: 'Vision',        desc: 'Bilder verstehen', count: models.filter(m => m.isVision).length },
              { id: 'longctx',   label: 'Long Context',  desc: '≥ 128k Token', count: models.filter(m => m.contextK >= 128).length },
            ] as const).map(cap => (
              <button
                key={cap.id}
                onClick={() => setCapFilter(capFilter === cap.id ? null : cap.id)}
                style={{ textAlign: 'left', padding: '7px 10px', borderRadius: 6, border: `1px solid ${capFilter === cap.id ? 'var(--accent)' : 'transparent'}`, background: capFilter === cap.id ? 'var(--accent-soft)' : 'transparent', color: capFilter === cap.id ? 'var(--accent)' : 'var(--fg-1)', fontSize: 12, fontFamily: 'var(--font-ui)', cursor: 'pointer', fontWeight: capFilter === cap.id ? 600 : 400, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <span>{cap.label}</span>
                <span style={{ fontSize: 10, color: capFilter === cap.id ? 'var(--accent)' : 'var(--fg-3)' }}>{cap.count}</span>
              </button>
            ))}

            <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: 0.6, padding: '0 6px', marginTop: 10, marginBottom: 4 }}>Anwendungsfall</div>
            {USE_CASES.map(uc => {
              const count = models.filter(m => m.tags.includes(uc.id)).length
              return (
                <button
                  key={uc.id}
                  onClick={() => setActiveTag(activeTag === uc.id ? null : uc.id)}
                  style={{ textAlign: 'left', padding: '7px 10px', borderRadius: 6, border: `1px solid ${activeTag === uc.id ? 'var(--accent)' : 'transparent'}`, background: activeTag === uc.id ? 'var(--accent-soft)' : 'transparent', color: activeTag === uc.id ? 'var(--accent)' : 'var(--fg-1)', fontSize: 12, fontFamily: 'var(--font-ui)', cursor: 'pointer', fontWeight: activeTag === uc.id ? 600 : 400, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <span>{uc.label}</span>
                  <span style={{ fontSize: 10, color: activeTag === uc.id ? 'var(--accent)' : 'var(--fg-3)' }}>{count}</span>
                </button>
              )
            })}

            {/* Spacer pushes Kosten-Guide to bottom */}
            <div style={{ flex: 1 }} />

            {/* Cost guide — bottom center */}
            <div style={{ padding: '10px', borderRadius: 6, background: 'var(--bg-2)', border: '1px solid var(--line)', marginTop: 8 }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6, textAlign: 'center' }}>Kosten-Guide</div>
              {[
                { label: 'Kostenlos', color: '#22c55e', range: '$0' },
                { label: 'Günstig',   color: '#3b82f6', range: '< $1/1M' },
                { label: 'Mittel',    color: '#eab308', range: '$1–10/1M' },
                { label: 'Premium',   color: '#ef4444', range: '> $10/1M' },
              ].map(t => (
                <div key={t.label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 10, color: 'var(--fg-2)', flex: 1 }}>{t.label}</span>
                  <span style={{ fontSize: 9.5, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>{t.range}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Main: table + detail */}
          <div style={{ flex: 1, display: 'flex', minWidth: 0, minHeight: 0 }}>

            {/* Table */}
            <div style={{ flex: selected ? '0 0 60%' : 1, minHeight: 0, overflowY: 'auto', borderRight: selected ? '1px solid var(--line)' : 'none' }}>
              {loading && (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--fg-3)', fontSize: 13 }}>Lade Modelle von OpenRouter…</div>
              )}
              {error && (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--err)', fontSize: 13 }}>{error}</div>
              )}
              {!loading && !error && (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ ...thStyle('rank'), width: 56 }} onClick={() => toggleSort('rank')}>
                        Rang {sortCol === 'rank' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                      </th>
                      <th style={thStyle('name')} onClick={() => toggleSort('name')}>
                        Modell {sortCol === 'name' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                      </th>
                      <th style={{ ...thStyle('prompt'), textAlign: 'right' }} onClick={() => toggleSort('prompt')}>
                        Input /1M {sortCol === 'prompt' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                      </th>
                      <th style={{ ...thStyle('completion'), textAlign: 'right' }} onClick={() => toggleSort('completion')}>
                        Output /1M {sortCol === 'completion' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                      </th>
                      <th style={{ ...thStyle('context'), textAlign: 'right' }} onClick={() => toggleSort('context')}>
                        Kontext {sortCol === 'context' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                      </th>
                      <th style={{ ...thStyle('created'), textAlign: 'right' }} onClick={() => toggleSort('created')}>
                        Veröffentlicht {sortCol === 'created' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                      </th>
                      <th style={{ ...thStyle('name'), cursor: 'default' }}>Stärken</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(m => {
                      const isSelected = selected?.id === m.id
                      const costColor = (v: number) => v === 0 ? '#22c55e' : v < 1 ? '#3b82f6' : v < 10 ? '#eab308' : '#ef4444'
                      return (
                        <tr
                          key={m.id}
                          onClick={() => setSelected(isSelected ? null : m)}
                          style={{ cursor: 'pointer', background: isSelected ? 'var(--accent-soft)' : 'transparent', borderBottom: '1px solid var(--line)', transition: 'background 0.1s' }}
                          onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--bg-2)' }}
                          onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                        >
                          <td style={{ padding: '8px 10px', textAlign: 'center', width: 56 }}>
                            {m.globalRank === 1 ? <span style={{ fontSize: 16 }}>🥇</span>
                            : m.globalRank === 2 ? <span style={{ fontSize: 16 }}>🥈</span>
                            : m.globalRank === 3 ? <span style={{ fontSize: 16 }}>🥉</span>
                            : m.globalRank > 0   ? <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>#{m.globalRank}</span>
                            : <span style={{ fontSize: 10, color: 'var(--fg-3)', opacity: 0.4 }}>—</span>}
                          </td>
                          <td style={{ padding: '8px 12px', maxWidth: 280 }}>
                            <div style={{ fontSize: 11.5, fontWeight: 600, color: isSelected ? 'var(--accent)' : 'var(--fg-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                            <div style={{ fontSize: 9.5, color: 'var(--fg-3)', marginTop: 1, fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.id}</div>
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: costColor(m.promptPer1M), fontWeight: 600 }}>
                              {m.promptPer1M === 0 ? 'Free' : `$${m.promptPer1M.toFixed(m.promptPer1M < 1 ? 3 : 2)}`}
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: costColor(m.completionPer1M), fontWeight: 600 }}>
                              {m.completionPer1M === 0 ? '—' : `$${m.completionPer1M.toFixed(m.completionPer1M < 1 ? 3 : 2)}`}
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--fg-2)' }}>
                              {m.contextK > 0 ? `${m.contextK}k` : '—'}
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                            <span style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', whiteSpace: 'nowrap' }}>
                              {formatReleaseDate(m.id, m.createdAt)}
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                              {m.tags.slice(0, 3).map(tag => {
                                const uc = USE_CASES.find(u => u.id === tag)
                                return uc ? (
                                  <span key={tag} style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'var(--bg-3)', color: 'var(--fg-2)', border: '1px solid var(--line)', whiteSpace: 'nowrap' }}>
                                    {uc.label}
                                  </span>
                                ) : null
                              })}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Detail panel */}
            {selected && (
              <div style={{ flex: '0 0 40%', minHeight: 0, overflowY: 'auto', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-0)', marginBottom: 3 }}>{selected.name}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>{selected.id}</div>
                    </div>
                    <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-3)', padding: 2, flexShrink: 0 }}>
                      <IClose style={{ width: 14, height: 14 }} />
                    </button>
                  </div>
                </div>

                {/* Kosten */}
                <div style={{ borderRadius: 6, border: '1px solid var(--line)', overflow: 'hidden' }}>
                  <div style={{ padding: '8px 12px', background: 'var(--bg-2)', fontSize: 10, fontWeight: 700, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Kosten</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 1, background: 'var(--line)' }}>
                    {[
                      { label: 'Input /1M', val: selected.promptPer1M === 0 ? 'Kostenlos' : `$${selected.promptPer1M.toFixed(3)}` },
                      { label: 'Output /1M', val: selected.completionPer1M === 0 ? '—' : `$${selected.completionPer1M.toFixed(3)}` },
                      { label: 'Kontext', val: selected.contextK > 0 ? `${selected.contextK}k Token` : '—' },
                    { label: 'AA Quality', val: selected.quality > 0 ? `${selected.quality}/100 (#${selected.globalRank})` : 'Nicht gerankt' },
                    { label: 'Veröffentlicht', val: formatReleaseDate(selected.id, selected.createdAt) },
                    ].map(f => (
                      <div key={f.label} style={{ padding: '10px 12px', background: 'var(--bg-1)' }}>
                        <div style={{ fontSize: 9.5, color: 'var(--fg-3)', marginBottom: 3 }}>{f.label}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-0)', fontFamily: 'var(--font-mono)' }}>{f.val}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Stärken */}
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Stärken</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {selected.tags.length > 0
                      ? selected.tags.map(tag => {
                          const uc = USE_CASES.find(u => u.id === tag)
                          return uc ? (
                            <span key={tag} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 6, background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--accent)', fontWeight: 600 }}>
                              {uc.label}
                            </span>
                          ) : null
                        })
                      : <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>Keine Stärken erkannt</span>
                    }
                  </div>
                </div>

                {/* Benchmarks */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Benchmarks dieses Modells</div>
                    <div style={{ fontSize: 9.5, color: 'var(--fg-3)', fontStyle: 'italic' }}>(nur technische Aufgaben – Kreativität nicht abgedeckt)</div>
                  </div>
                  {(() => {
                    const id = selected.id.toLowerCase()
                    const benchmarks: { name: string; score: string; desc: string }[] = []
                    if (id.includes('claude-opus-4'))
                      benchmarks.push(
                        { name: 'SWE-bench Verified', score: '72.5%', desc: 'Software Engineering (real Bugs)' },
                        { name: 'MMLU', score: '88.7%', desc: 'Allgemeinwissen' },
                        { name: 'Creative Writing', score: '★★★★★', desc: 'Bestes LLM für Kreativtexte (ELO)' },
                      )
                    else if (id.includes('claude-opus'))
                      benchmarks.push(
                        { name: 'MMLU', score: '86.8%', desc: 'Allgemeinwissen' },
                        { name: 'Creative Writing', score: '★★★★☆', desc: 'Sehr gut für Kreativtexte' },
                      )
                    if (id.includes('claude-sonnet-4-6') || id.includes('claude-sonnet-4-5'))
                      benchmarks.push(
                        { name: 'HumanEval', score: '93.7%', desc: 'Code-Generierung' },
                        { name: 'MMLU', score: '88.0%', desc: 'Allgemeinwissen' },
                      )
                    else if (id.includes('claude-sonnet'))
                      benchmarks.push(
                        { name: 'HumanEval', score: '92.0%', desc: 'Code-Generierung' },
                        { name: 'MMLU', score: '86.8%', desc: 'Allgemeinwissen' },
                      )
                    if (id.includes('o3') || id.includes('o4'))
                      benchmarks.push(
                        { name: 'AIME 2024', score: '96.7%', desc: 'Mathematik-Olympiade' },
                        { name: 'SWE-bench', score: '71.7%', desc: 'Software Engineering' },
                      )
                    else if (id.includes('gpt-4o'))
                      benchmarks.push(
                        { name: 'MMLU', score: '88.7%', desc: 'Allgemeinwissen' },
                        { name: 'HumanEval', score: '90.2%', desc: 'Code' },
                      )
                    if (id.includes('gemini-2.5-pro'))
                      benchmarks.push(
                        { name: 'MMLU', score: '90.0%', desc: 'Allgemeinwissen' },
                        { name: 'MATH', score: '91.5%', desc: 'Mathematik' },
                        { name: 'GPQA', score: '84.0%', desc: 'Wissenschaft (Experten)' },
                      )
                    else if (id.includes('gemini-2.5-flash'))
                      benchmarks.push(
                        { name: 'MMLU', score: '89.2%', desc: 'Allgemeinwissen' },
                        { name: 'HumanEval', score: '89.5%', desc: 'Code' },
                      )
                    if (id.includes('deepseek-r1'))
                      benchmarks.push(
                        { name: 'AIME 2024', score: '79.8%', desc: 'Mathematik-Olympiade' },
                        { name: 'MATH-500', score: '97.3%', desc: 'Mathematik' },
                        { name: 'HumanEval', score: '92.6%', desc: 'Code' },
                      )
                    else if (id.includes('deepseek'))
                      benchmarks.push(
                        { name: 'HumanEval', score: '89.1%', desc: 'Code' },
                        { name: 'MATH', score: '84.0%', desc: 'Mathematik' },
                      )
                    if (id.includes('qwen3-235b') || id.includes('qwq'))
                      benchmarks.push(
                        { name: 'AIME 2024', score: '85.7%', desc: 'Mathematik-Olympiade' },
                        { name: 'LiveCodeBench', score: '70.7%', desc: 'Live Code' },
                      )
                    else if (id.includes('qwen3'))
                      benchmarks.push(
                        { name: 'MMLU', score: '87.5%', desc: 'Allgemeinwissen' },
                        { name: 'LiveCodeBench', score: '65.0%', desc: 'Live Code' },
                      )
                    if (id.includes('grok-3'))
                      benchmarks.push(
                        { name: 'MMLU', score: '87.5%', desc: 'Allgemeinwissen' },
                        { name: 'MATH', score: '87.0%', desc: 'Mathematik' },
                      )
                    if (id.includes('llama-3.3') || id.includes('llama-3.1-405'))
                      benchmarks.push(
                        { name: 'MMLU', score: '86.0%', desc: 'Allgemeinwissen' },
                        { name: 'HumanEval', score: '85.0%', desc: 'Code' },
                      )
                    if (benchmarks.length === 0)
                      return <span style={{ fontSize: 11, color: 'var(--fg-3)', fontStyle: 'italic' }}>Keine Benchmark-Daten verfügbar</span>
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {benchmarks.map(b => (
                          <div key={b.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 6, background: 'var(--bg-2)', border: '1px solid var(--line)' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-0)' }}>{b.name}</div>
                              <div style={{ fontSize: 10, color: 'var(--fg-3)' }}>{b.desc}</div>
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{b.score}</div>
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                </div>

                {/* Beschreibung */}
                {selected.description && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Beschreibung</div>
                    <p style={{ margin: 0, fontSize: 11.5, color: 'var(--fg-2)', lineHeight: 1.6 }}>{selected.description.slice(0, 600)}{selected.description.length > 600 ? '…' : ''}</p>
                  </div>
                )}

                {/* Link */}
                <a href={`https://openrouter.ai/${selected.id}`} target="_blank" rel="noreferrer"
                  style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                  Auf OpenRouter ansehen →
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
