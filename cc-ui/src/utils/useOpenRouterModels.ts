import { useState, useEffect } from 'react'

export interface ORModel {
  value: string  // id, e.g. "anthropic/claude-sonnet-4-6"
  label: string  // display name
  supportsTools: boolean
}

interface ORApiModel {
  id: string
  name: string
  supported_parameters?: string[]
}

let cache: ORModel[] | null = null
let cacheTime = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 min

export function useOpenRouterModels() {
  const [models, setModels] = useState<ORModel[]>(cache ?? [])
  const [loading, setLoading] = useState(!cache)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (cache && Date.now() - cacheTime < CACHE_TTL) {
      setModels(cache)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    fetch('https://openrouter.ai/api/v1/models', {
      headers: { 'HTTP-Referer': window.location.origin, 'X-Title': 'Codera AI' },
    })
      .then(r => r.json())
      .then((d: { data?: ORApiModel[] }) => {
        if (cancelled) return
        const list: ORModel[] = (d.data ?? [])
          .filter(m => m.id && m.name)
          .map(m => ({
            value: m.id,
            label: m.name,
            supportsTools: (m.supported_parameters ?? []).includes('tools'),
          }))
          .sort((a, b) => a.label.localeCompare(b.label))
        cache = list
        cacheTime = Date.now()
        setModels(list)
        setLoading(false)
      })
      .catch(e => {
        if (cancelled) return
        setError(String(e))
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  return { models, loading, error }
}
