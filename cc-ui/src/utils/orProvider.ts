import { useAppStore } from '../store/useAppStore'

const DEFAULT_OR_MODELS: Record<string, string> = {
  terminal:      'deepseek/deepseek-chat-v3-0324',
  kanban:        'deepseek/deepseek-chat-v3-0324',
  devDetect:     'deepseek/deepseek-chat-v3-0324',
  docUpdate:     'deepseek/deepseek-r1-0528',
  contextSearch: 'deepseek/deepseek-chat-v3-0324',
}

// Strip characters invalid in HTTP header values (must be printable ASCII)
export function sanitizeKey(key: string): string {
  return key.replace(/[^\x20-\x7E]/g, '').trim()
}

export function getOrModel(functionKey: string): { provider: 'openrouter'; apiKey: string; model: string } | null {
  const { openrouterKey, aiFunctionMap } = useAppStore.getState()
  if (!openrouterKey) return null
  const apiKey = sanitizeKey(openrouterKey)
  if (!apiKey) return null
  const model = aiFunctionMap[functionKey] || DEFAULT_OR_MODELS[functionKey] || 'deepseek/deepseek-chat-v3-0324'
  return { provider: 'openrouter', apiKey, model }
}
